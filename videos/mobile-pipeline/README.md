# Mobile Pipeline film

Russian, narrated 1920×1080 / 30fps explanation of the real feature workflow.
Duration: 233.033 seconds (3:53). No music; 59 measured sentence captions.
Website delivery: `../../graph/media/mobile-pipeline.mp4`.
Delivery validation and known limits: `../../graph/VALIDATION.md`.

## Reproduce

Node 24, FFmpeg/ffprobe, and the pinned HyperFrames 0.8.65 CLI are required.
Existing frozen audio means regeneration does not need a voice service.

```bash
npm ci
node scripts/build-video.cjs
npm run check
npm run dev
npm run render -- --quality delivery --fps 30 --output ../../graph/media/mobile-pipeline.mp4
```

The build emits all eight sub-compositions, captions, timing, the website chapter
map and an audio provenance ledger. It is deterministic for the frozen assets.
The local GSAP file is from gsap 3.14.2; see assets/GSAP-NOTICE.txt and its retained license header. Fonts are Onest
(Fontsource 5.3.1) with the bundled OFL license. No runtime CDN dependencies.

## Change narration

Edit the Russian `narration` fields in `../../graph/story/scenario.js`, then:

```bash
node scripts/prepare-voice.cjs
python scripts/generate-voice.py
node scripts/build-video.cjs
```

Generation uses the installed `edge-tts` package and Microsoft's online TTS
service with `ru-RU-DmitryNeural`, rate +12%. Only the approved narration is sent.
Move affected prior `.mp3`, `.json`, and `-final.m4a` voice files into `archive/`
before regenerating changed lines: cached complete lines are intentionally reused.
FFmpeg applies atempo 1.23 and -16 LUFS normalization; caption timestamps use the
same tempo factor. No cloud rendering or paid service is required.

## Verify

```bash
npm run check -- --json
npx hyperframes@0.8.65 snapshot --at 13,43,68,97,127,158,188,217 --no-end --describe false
ffprobe -v error -show_format -show_streams ../../graph/media/mobile-pipeline.mp4
```

Inspect scene midpoints, the join after all three research reports, sequential
development/checks, the repair loop and the final frame. Story truth lives in
the canonical runtime templates; scenario refs are checked by the graph tests.

`archive/flowchart-reference.html.txt` retains the inspected registry reference;
its sticky-note layout was unsuitable for the approved design. The authored
scenes use its SVG path-draw technique with explicit deterministic timelines.
