# Scene templates — the contract for scene packs

One hand-authored file per scene: `src/scenes/<id>.html`. `scripts/build-video.cjs` expands the
placeholders and writes `compositions/<id>.html` (never edit `compositions/` — it is regenerated).
Everything else in the film (transitions, HUD, captions, audio, timing) is owned by the foundation and
already wraps your scene; you only author what happens **inside** your scene's rectangle and time slot.

| id | title | start | dur | field (text) |
|---|---|---|---|---|
| `s01-hook` | Фиалка поникла | 0.0 | 15.7 | cream (ink) |
| `s02-factory` | Фабрика | 15.7 | 16.5 | violet (cream) |
| `s03-talk` | Разговор | 32.2 | 18.4 | tangerine (ink) |
| `s04-blueprint` | Чертёж | 50.6 | 15.2 | sky (ink) |
| `s05-critic` | Придира | 65.8 | 11.4 | raspberry (ink) |
| `s06-plan` | План | 77.2 | 14.7 | cream (ink) |
| `s07-belt` | Конвейер | 91.9 | 22.0 | violet (cream) |
| `s08-tests` | Испытания | 113.9 | 22.4 | ink «night» (cream) |
| `s09-release` | Выпуск | 136.3 | 20.1 | mint (ink) |
| `s10-memory` | Память | 156.4 | 21.4 | sky (ink) → ink end card at `C.brand` |

## Cues (seconds inside the scene; current build — the live values are in `timing.json`)

A cue is the start of the first spoken word after its `[[marker]]` in `narration/narration.json`.
`_voice` = voice starts, `_speechEnd` = last word ends, `_out` = the outgoing wipe starts covering your
scene (keep everything on screen until then; no exit animations), `_end` = scene duration.

| id | cues | _voice / _speechEnd / _out |
|---|---|---|
| s01-hook | q 1.30 · wilt 4.33 · forgot 5.31 · app 7.57 · coder 11.29 · bulb 13.51 | 1.2 / 14.15 / 15.18 |
| s02-factory | brand 1.67 · factory 2.81 · n49 5.75 · team 6.53 · belt 8.95 · you 14.72 | 0.5 / 14.97 / 16.19 |
| s03-talk | talk 1.63 · brig 3.23 · shots 9.94 · analysts 12.21 · inventory 14.06 · ok 16.20 | 0.5 / 16.49 / 18.09 |
| s04-blueprint | scribes 1.54 · docs 2.38 · n18 3.39 · what 4.70 · look 6.11 · check 6.87 · advisors 9.89 | 0.5 / 13.73 / 14.89 |
| s05-critic | critic 2.36 · gap 4.29 · back 4.69 · two 7.85 · accept 8.82 | 0.5 / 9.64 / 11.09 |
| s06-plan | planner 1.05 · tasks 2.36 · plants 3.46 · remind 4.51 · approve 8.21 · board 10.26 · todo 10.76 · doing 11.38 · done 12.17 | 0.5 / 12.73 / 14.39 |
| s07-belt | card 1.41 · scales 5.90 · switch 9.10 · chief 12.24 · master 15.69 · order 17.86 | 0.5 / 20.50 / 21.59 |
| s08-tests | auditor 2.25 · rounds 3.44 · tester 5.75 · stand 7.84 · red 9.97 · night 12.99 · fix 15.63 · stop 17.78 | 0.5 / 20.64 / 21.88 |
| s09-release | green 0.60 · verifier 2.25 · wired 4.36 · memo 6.34 · decide 8.89 · yes 10.60 · ship 13.43 · chron 13.79 · plant 16.86 | 0.5 / 18.55 / 19.79 |
| s10-memory | rate 2.04 · stars 2.57 · lib 3.73 · repeat 6.96 · rational 8.63 · approve 12.00 · brand 13.70 · slogan 15.87 | 0.5 / 17.32 / 21.40 |

Narration was trimmed per design-video.md §2 (total 186.5 → 177.8 s), so these §3 beats have **no cue**:
S02 `home` («живёт … в вашем проекте»), S07 `artist` (Художник line), S04 «удобстве», S05 «чтобы не
ходить по кругу». Show Художник as a silent station on the S07 belt if you want him; there is no S02 home beat.

## Placeholders

| placeholder | becomes |
|---|---|
| `%%ID%%` | the scene id, e.g. `s03-talk` (= `data-composition-id` = `window.__timelines` key) |
| `%%DUR%%` | scene duration in seconds (a number) |
| `%%CUES%%` | JSON `{cue: seconds}` incl. `_voice _speechEnd _out _end`. Assign it to `var C` and use `C.<cue>` / `C["cue"]`. **Every `C.<name>` in the file must exist or the build fails** (so `C` is reserved for cues). |
| `%%WORDS%%` | JSON `[{text,start,end}]` — every displayed word, scene-local (word-exact kinetic type) |
| `%%FIELD%%` / `%%INK%%` | the scene's background / text hex colour |
| `%%FONTS%%` | `@font-face` for Unbounded, Golos Text, JetBrains Mono (lint needs it in every file) |
| `%%HELPERS%%` | `src/runtime/helpers.js` → `window.MPV` (see its header for the API) |
| `%%KITCSS%%` | transform boxes/origins for the kit's structure classes + `.kit-rim` (cream sticker rim) |
| `%%CHAR:<type>[/variant]:<w>[:expr][#id][{json}]%%` | a cast member, viewBox 0 0 120 140, `<w>` px wide |
| `%%MACHINE:<type>:<w>[#id][{json}]%%` | an automat (`vesy strelochnik poryadok stend pochtalon zhurnal`), `{"lamp":"mint"}` |
| `%%PLANT:<sad\|happy\|bloom>:<w>[#id]%%` | фиалка in a pot |
| `%%PHONE:<state>:<w>[#id]%%` | phone 140×260: `blank list notify notify-night app` (`reminder-0900` / `reminder-0300` aliases) |
| `%%STAMP:<w>[#id]%%` · `%%SEAL:<w>[:text][#id]%%` | «вы»: hand with the lemon stamp · round stamp imprint |
| `%%BELT:<length>[:h[:legs]][#id][{json}]%%` | straight conveyor; `{"stations":[{"x":300,"lamp":"mint","label":"Весы"}],"dir":1}` |

Kit types: brigadir razvedchik syshchik obkhodchik pisar sovetnik pridira planirovshchik khudozhnik master
(`master/chief`) revizor arkhitektor ispytatel priyomshchik letopisets bibliotekar ratsionalizator vy + the 6
automats. Expressions: happy focus oh grumpy sad. Structure classes you can animate: see the header of
`showcase/assets/js/chars.js` (`.c-body .c-eyes .c-lid .c-mouth .c-arm-l .c-arm-r .c-hat .c-prop .c-lamp
.c-needle .c-gear .c-leaf .c-flower .ph-notif .belt-chev .belt-roller …`). Arms: rotate around the shoulder,
raise with `.c-arm-r` rotation −100…−150. Unknown types/states fail the build.

## Required skeleton

```html
<!doctype html>
<html lang="ru"><head><meta charset="UTF-8" /><title>s03-talk</title></head>
  <body>
    <template id="s03-talk-template">
      <style>
        %%FONTS%%
        %%KITCSS%%
        #s03-talk { position: absolute; inset: 0; overflow: hidden; background: %%FIELD%%; color: %%INK%%; }
        /* scope every rule under #s03-talk; prefix every id with s03-talk- */
      </style>
      <div id="s03-talk" data-composition-id="%%ID%%" data-width="1920" data-height="1080" data-duration="%%DUR%%">
        …markup (static end state; animate FROM hidden with fromTo)…
      </div>
      <script>
        (function () {
          %%HELPERS%%
          var C = %%CUES%%;
          var D = %%DUR%%;
          var H = window.MPV;
          var tl = gsap.timeline({ paused: true });
          H.slam(tl, "#s03-talk-word", C.talk);
          // …
          window.__timelines["%%ID%%"] = tl;
        })();
      </script>
    </template>
  </body>
</html>
```

## Rules (hyperframes-core determinism + design-video.md; the build/lint enforce some, the rest are on you)

- Everything (style, markup, script) inside `<template>`; root styled by `#<id>`; ids prefixed `<id>-`.
- One paused timeline, registered last as `window.__timelines["%%ID%%"]`; wrap the script in an IIFE.
- `fromTo` with `immediateRender: false` for every tween after the first on an element (`MPV.*` does it).
  No `Math.random` / `Date.now` (use `MPV.rng(seed)`), no `repeat: -1` (use `MPV.repeats(span, cycle)` — also
  for the kit's belt chevrons, whose doc shows `repeat:-1`), no CSS `transform` on anything GSAP moves
  (wrap it), no `translate(-50%)`, animated spans `display:inline-block`, no CSS transitions/animations,
  never tween `visibility/display` on a `.clip`, no `<br>` in body text, no DOM measuring inside tweens.
- Frame: title-safe x 192–1728, y 108–972. **y 800–972 is the caption band — no scene text there.**
  **y 40–120 is the HUD** (S02 onwards) — keep text out. Ground line y ≈ 740.
- Colour: text ink on light fields, cream on violet/ink. **Lemon #FFDA4F only for «вы» / «ДА» / your
  decision** (never a background). Outlines 4 px ink, hard shadows `8px 8px 0 #16123A`, no blur, no
  gradients, no emoji/pictographs. Russian copy with «ёлочки», ё, no-break spaces before «—».
- Motion personality: arrive `back.out(1.7)` 0.45–0.6 s · kinetic word slam (`MPV.slam`) · robots float
  (`MPV.bob`, sine 1.8–2.4 s) · automats snap `power4.inOut` 0.2 s / `steps()` · camera `power2.inOut` 0.8 s ·
  press (`MPV.press`). One kinetic word per beat. Background life in every scene (ghost word 12–18 %
  opacity, drifting dots/pluses, themed decoration) so no frame is frozen.
- Hand-offs to the transition layer (`compositions/wipes.html`, owned by the foundation):
  - T1 S01→S02 is a violet disc growing from **(1500, 360)** — put the S01 lightbulb there.
  - T8 S08→S09 is a mint disc growing from **(960, 400)** — put the S08 green lamp there.
  - S10: the ink dip covers `C.brand − 0.3 … C.brand + 0.37`; switch to the ink end card at `C.brand`.
    The last 0.8 s fade to ink is done by the wipes layer — do not fade out yourself.
  Need a different origin? Ask the foundation owner to change `src/scenes/scenes.json` (`out.origin`).
- GSAP plugins loaded + registered by `index.html`: CustomEase, MotionPathPlugin, DrawSVGPlugin,
  MorphSVGPlugin. If you use `motionPath`, ALSO add `<script src="assets/vendor/gsap/MotionPathPlugin.min.js"></script>`
  inside your template before your script (the linter checks per file).
- Asset paths are root-relative (`assets/...`), never `../`.
- Keep a scene file under ~300 lines if you can (lint warns above that).

## Work loop for one scene

```bash
cd /d/Pet/mobile-pipeline/showcase/video
node scripts/build-video.cjs --only s03-talk          # writes compositions/s03-talk.html only (safe in parallel)
npx --yes hyperframes@0.8.65 lint                      # 0 errors
PRODUCER_PAGE_NAVIGATION_TIMEOUT_MS=180000 npx --yes hyperframes@0.8.65 snapshot \
  --at 33.0,41.3,48.6 --no-end --describe false -o snapshots/s03   # global seconds = scene start + cue
```
Motion citations per scene (blueprints/rules from hyperframes-animation) are in `src/scenes/scenes.json`
and `STORYBOARD.md`. Timing/cue values: `timing.json` (`scenes[].cues` local, `cuesGlobal` absolute).
