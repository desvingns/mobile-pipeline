#!/usr/bin/env python3
"""Synthesise the narration with edge-tts, one MP3 + word timings per scene.

Reads   narration/narration.json   (scenes[].text with [[cue]] markers and {shown|spoken})
Writes  .media/voice/<id>.mp3                 raw TTS take (gitignored; process-voice.cjs -> WAV)
        narration/words/<id>.json             {id, hash, voice, rate, pitch, spoken, words:[{text,start,end}]}
Cache   .media/voice/cache/<hash>.{mp3,json}  hash = sha256(voice|rate|pitch|spoken)

Run from showcase/video:
    PYTHONUTF8=1 ./.venv/Scripts/python.exe scripts/generate-voice.py [--only <sceneId>] [--force]

edge-tts >= 7 defaults to SentenceBoundary; we ask for WordBoundary explicitly.
Offsets/durations arrive in 100 ns ticks; stored in seconds (6 decimals).
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8", errors=_stream.errors)

import edge_tts  # noqa: E402  (after the stdio fix so import errors print cleanly)

ROOT = Path(__file__).resolve().parent.parent
NARRATION = ROOT / "narration" / "narration.json"
WORDS_DIR = ROOT / "narration" / "words"
VOICE_DIR = ROOT / ".media" / "voice"
CACHE_DIR = VOICE_DIR / "cache"

CONCURRENCY = 3
RETRIES = 4
TICKS = 10_000_000  # 100 ns ticks per second

CUE_RE = re.compile(r"\[\[[A-Za-z0-9_-]+\]\]")
ALT_RE = re.compile(r"\{([^{}|]*)\|([^{}]*)\}")


def spoken_text(text: str) -> str:
    """TTS form: drop cue markers, keep the spoken half of {shown|spoken}."""
    out = CUE_RE.sub("", text)
    out = ALT_RE.sub(lambda m: m.group(2), out)
    return re.sub(r"\s+", " ", out).strip()


def take_hash(voice: str, rate: str, pitch: str, text: str) -> str:
    return hashlib.sha256(f"{voice}|{rate}|{pitch}|{text}".encode("utf-8")).hexdigest()[:16]


async def synthesise(text: str, voice: str, rate: str, pitch: str, mp3_path: Path) -> list[dict]:
    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    words: list[dict] = []
    tmp = mp3_path.with_suffix(".part")
    with open(tmp, "wb") as fh:
        async for chunk in communicate.stream():
            kind = chunk.get("type")
            if kind == "audio":
                fh.write(chunk["data"])
            elif kind == "WordBoundary":
                start = chunk["offset"] / TICKS
                end = (chunk["offset"] + chunk["duration"]) / TICKS
                words.append({"text": chunk["text"], "start": round(start, 6), "end": round(end, 6)})
    if tmp.stat().st_size == 0:
        tmp.unlink()
        raise RuntimeError("edge-tts returned no audio")
    if not words:
        raise RuntimeError("edge-tts returned no WordBoundary events")
    tmp.replace(mp3_path)
    return words


async def run_scene(scene: dict, cfg: dict, sem: asyncio.Semaphore, force: bool) -> dict:
    sid = scene["id"]
    voice, rate, pitch = cfg["name"], cfg["rate"], cfg.get("pitch", "+0Hz")
    text = spoken_text(scene["text"])
    h = take_hash(voice, rate, pitch, text)
    cache_mp3 = CACHE_DIR / f"{h}.mp3"
    cache_words = CACHE_DIR / f"{h}.json"
    cached = cache_mp3.exists() and cache_words.exists() and not force
    if not cached:
        async with sem:
            delay = 1.0
            for attempt in range(1, RETRIES + 1):
                try:
                    words = await synthesise(text, voice, rate, pitch, cache_mp3)
                    cache_words.write_text(json.dumps(words, ensure_ascii=False), encoding="utf-8")
                    break
                except Exception as exc:  # network hiccups are common; retry with backoff
                    if attempt == RETRIES:
                        raise RuntimeError(f"{sid}: TTS failed after {RETRIES} attempts: {exc}") from exc
                    print(f"  {sid}: attempt {attempt} failed ({exc}); retry in {delay:.0f}s", file=sys.stderr)
                    await asyncio.sleep(delay)
                    delay *= 2
    words = json.loads(cache_words.read_text(encoding="utf-8"))
    shutil.copyfile(cache_mp3, VOICE_DIR / f"{sid}.mp3")
    record = {
        "id": sid,
        "hash": h,
        "voice": voice,
        "rate": rate,
        "pitch": pitch,
        "spoken": text,
        "words": words,
    }
    (WORDS_DIR / f"{sid}.json").write_text(json.dumps(record, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return {"id": sid, "cached": cached, "words": len(words), "last_end": words[-1]["end"], "hash": h}


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="synthesise one scene id only")
    ap.add_argument("--force", action="store_true", help="ignore the cache")
    args = ap.parse_args()

    data = json.loads(NARRATION.read_text(encoding="utf-8"))
    cfg = data["voice"]
    scenes = data["scenes"]
    if args.only:
        scenes = [s for s in scenes if s["id"] == args.only]
        if not scenes:
            print(f"no scene with id {args.only}", file=sys.stderr)
            return 2
    for d in (WORDS_DIR, VOICE_DIR, CACHE_DIR):
        d.mkdir(parents=True, exist_ok=True)

    sem = asyncio.Semaphore(CONCURRENCY)
    results = await asyncio.gather(*(run_scene(s, cfg, sem, args.force) for s in scenes))
    total_words = 0
    for r in results:
        total_words += r["words"]
        tag = "cache" if r["cached"] else "fresh"
        print(f"{r['id']:<14} {tag}  words={r['words']:<3} speech~{r['last_end']:6.2f}s  {r['hash']}")
    print(json.dumps({"ok": True, "scenes": len(results), "words": total_words,
                      "voice": cfg["name"], "rate": cfg["rate"]}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
