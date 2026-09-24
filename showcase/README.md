# showcase — «Фабрика приложений» (Claude's presentation of Mobile Pipeline)

Untracked alternative to `graph/` (GPT-6's site). Nothing here is loaded from `graph/` at runtime.

## Open
- Double-click `index.html` (works from `file://`: no modules, no fetch, fonts inlined as data URIs), or
- serve the folder: `python -m http.server 8765 --directory showcase` → http://127.0.0.1:8765

Two tabs:
- **Просто** (`#prosto`) — scrollytelling for people who know nothing about IT: 12 animated scenes,
  interactive stamp / rating / defect / full «Запустить конвейер» simulation, embedded film.
- **Схема** (`#skhema/<graph>/<node>`) — Unreal-Blueprint-style node editor: 4 graphs, details panel,
  scripted execution simulations with an Output Log, search, list view (default on phones).

## Layout
```
index.html                 all «Просто» copy + tab shell
assets/css, assets/js      tokens/shell/prosto + scenes/*.js (one file per scene) + bp-*.js (Схема)
assets/vendor/gsap         GSAP 3.14.2 (standard no-charge licence)
assets/fonts               Unbounded, Golos Text, JetBrains Mono (OFL) → tools/build-fonts.cjs → css/fonts.css
media/                     film (web encode), poster, srt/vtt, chapters.js, transcript.js
docs/                      brand bible + specs the site and film were built from
tools/                     check.cjs, validate-blueprint.cjs, shot.cjs (headless screenshots), test-chars.cjs
video/                     HyperFrames project of the film (see video/README.md)
```

## Checks
```bash
node showcase/tools/check.cjs               # links, file:// safety, jargon blacklist, word limits, facts
node showcase/tools/validate-blueprint.cjs  # Схема data vs repo (models/tools/paths), wires, layout, scenarios
node showcase/tools/shot.cjs --out /tmp/x.png --section zapusk --at 0.2   # headless screenshot + console errors
```

## Film
`video/` → `npm`-free rebuild: see `video/README.md` (edge-tts voice, Lyria music, HyperFrames 0.8.65 render).
`scripts/verify-output.cjs` publishes a web encode to `media/mobile-pipeline.mp4`; the delivery master stays in
`video/renders/`.
