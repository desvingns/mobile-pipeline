#!/usr/bin/env node
'use strict';
/*
 * process-voice.cjs — raw edge-tts MP3s -> render-ready 48 kHz mono 16-bit WAVs.
 *
 *   .media/voice/<id>.mp3  --decode, highpass 70 Hz, resample 48 kHz (soxr)-->
 *   measure loudness over ALL scenes joined (loudnorm pass 1, target -16 LUFS / TP -1 dBTP)
 *   --> ONE shared linear gain for every scene (keeps the relative levels the voice had)
 *   --> the same delay-compensated peak limiter on every take when the gain would break TP -1
 *   --> assets/voice/<id>.wav, trimmed to a whole millisecond (duration = floor(samples/48)/1000)
 *   --> loudnorm pass 2 on the result (verification only) --> narration/voice.json
 *
 * No silence trimming: WordBoundary timings are measured from sample 0 of each take.
 * WAV, not m4a: AAC priming/padding shifts timing and triggered render warnings before.
 *
 * Usage: node scripts/process-voice.cjs
 */
const fs = require('fs');
const path = require('path');
const C = require('./lib/common.cjs');
const N = require('./lib/narration.cjs');

const RATE = 48000;
const TARGET_I = -16;
const TARGET_TP = -1.0;
const FILTER = 'highpass=f=70,aresample=' + RATE + ':resampler=soxr:precision=28';

function main() {
  const narration = C.readJSON(C.P.narration);
  const scenes = narration.scenes;
  fs.mkdirSync(C.P.voiceOut, { recursive: true });
  fs.mkdirSync(C.P.tmp, { recursive: true });

  // 1. decode every take (and make sure its word timings belong to the current text)
  const takes = scenes.map(function (s) {
    const mp3 = path.join(C.P.voiceSrc, s.id + '.mp3');
    const wordsFile = path.join(C.P.wordsDir, s.id + '.json');
    if (!fs.existsSync(mp3) || !fs.existsSync(wordsFile)) {
      C.die(s.id + ': missing ' + (fs.existsSync(mp3) ? wordsFile : mp3) + ' — run scripts/generate-voice.py first');
    }
    const words = C.readJSON(wordsFile);
    const spoken = N.spokenText(s.text);
    if (words.spoken !== spoken) {
      C.die(s.id + ': narration text changed since the TTS take was made — re-run scripts/generate-voice.py\n' +
        '  take : ' + words.spoken + '\n  text : ' + spoken);
    }
    const pcm = C.decodeF32(mp3, { rate: RATE, channels: 1, filter: FILTER });
    const frames = Math.floor(pcm.length / (RATE / 1000)) * (RATE / 1000);   // whole ms
    return { id: s.id, hash: words.hash, pcm: pcm.subarray(0, frames), frames: frames };
  });

  // 2. loudness of the whole narration, joined
  const joinedLen = takes.reduce(function (a, t) { return a + t.frames; }, 0);
  const joined = new Float32Array(joinedLen);
  let o = 0;
  takes.forEach(function (t) { joined.set(t.pcm, o); o += t.frames; });
  const tmpIn = path.join(C.P.tmp, 'voice-joined-in.wav');
  fs.writeFileSync(tmpIn, C.wavBytes(joined, RATE, 1));
  const before = C.measureLoudness(tmpIn, { I: TARGET_I, TP: TARGET_TP });

  // 3. one shared linear gain to -16 LUFS. edge-tts has a high crest factor, so that gain alone
  //    would push the true peak past -1 dBTP; the same transparent peak limiter (lookahead,
  //    delay-compensated so word timings do not move) then runs on every take with identical
  //    settings. The ceiling steps down until the joined result measures TP <= -1.0.
  const gainDb = TARGET_I - before.input_i;
  const needsLimiter = before.input_tp + gainDb > TARGET_TP;
  const tmpOut = path.join(C.P.tmp, 'voice-joined-out.wav');
  let ceilingDb = -2.0, after = null, rendered = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const filter = 'volume=' + gainDb.toFixed(3) + 'dB' + (needsLimiter
      ? ',alimiter=limit=' + Math.pow(10, ceilingDb / 20).toFixed(5) + ':attack=3:release=40:level=disabled:latency=1'
      : '');
    rendered = takes.map(function (t) {
      const src = path.join(C.P.tmp, 'voice-' + t.id + '-pre.wav');
      fs.writeFileSync(src, C.wavBytes(t.pcm, RATE, 1));
      const pcm = C.decodeF32(src, { rate: RATE, channels: 1, filter: filter });
      const buf = new Float32Array(t.frames);             // exact original length (limiter latency is compensated)
      buf.set(pcm.subarray(0, Math.min(pcm.length, t.frames)));
      return buf;
    });
    const joinedOut = new Float32Array(joinedLen);
    o = 0;
    rendered.forEach(function (b) { joinedOut.set(b, o); o += b.length; });
    fs.writeFileSync(tmpOut, C.wavBytes(joinedOut, RATE, 1));
    after = C.measureLoudness(tmpOut, { I: TARGET_I, TP: TARGET_TP });
    if (!needsLimiter || after.input_tp <= TARGET_TP) break;
    ceilingDb -= 0.5;
  }
  if (after.input_tp > TARGET_TP) C.die('voice true peak ' + after.input_tp + ' dBTP is still above ' + TARGET_TP);

  const out = { sampleRate: RATE, channels: 1, targetLufs: TARGET_I, targetTp: TARGET_TP,
    gainDb: C.r3(gainDb), limiter: needsLimiter ? { ceilingDb: ceilingDb, attackMs: 3, releaseMs: 40 } : null,
    scenes: {} };
  takes.forEach(function (t, k) {
    const file = path.join(C.P.voiceOut, t.id + '.wav');
    C.writeIfChanged(file, C.wavBytes(rendered[k], RATE, 1));
    out.scenes[t.id] = {
      file: 'assets/voice/' + t.id + '.wav',
      samples: t.frames,
      duration: t.frames / RATE,
      hash: t.hash,
    };
  });

  // 4. verified above (pass 2 on the joined result)
  out.measured = {
    before: { I: before.input_i, TP: before.input_tp, LRA: before.input_lra },
    after: { I: after.input_i, TP: after.input_tp, LRA: after.input_lra },
  };
  const total = takes.reduce(function (a, t) { return a + t.frames / RATE; }, 0);
  out.totalVoice = C.r3(total);
  C.writeIfChanged(C.P.voiceMeta, JSON.stringify(out, null, 1) + '\n');

  takes.forEach(function (t) {
    process.stdout.write(t.id.padEnd(14) + (t.frames / RATE).toFixed(3) + ' s\n');
  });
  process.stdout.write(JSON.stringify({
    ok: true, scenes: takes.length, totalVoice: out.totalVoice, gainDb: out.gainDb,
    limiter: out.limiter, before: out.measured.before, after: out.measured.after,
  }) + '\n');
}

main();
