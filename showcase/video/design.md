---
name: Фабрика приложений — film
canvas: { width: 1920, height: 1080, fps: 30 }
colors:
  ink: "#16123A"
  cream: "#FFF6E6"
  violet: "#5B34F5"
  lemon: "#FFDA4F"
  mint: "#2BD99F"
  raspberry: "#FF4F8B"
  sky: "#3EC5FF"
  tangerine: "#FF8A1F"
  caption-pill: "rgba(22,18,58,.88)"
scene-fields:
  s01-hook: { field: cream, text: ink }
  s02-factory: { field: violet, text: cream }
  s03-talk: { field: tangerine, text: ink }
  s04-blueprint: { field: sky, text: ink }
  s05-critic: { field: raspberry, text: ink }
  s06-plan: { field: cream, text: ink }
  s07-belt: { field: violet, text: cream }
  s08-tests: { field: ink, text: cream }
  s09-release: { field: mint, text: ink }
  s10-memory: { field: sky, text: ink, endcard: ink }
typography:
  display: { family: "Unbounded", weights: [700, 800, 900], sizes: { mega: 220, h1: 112, h2: 72, h3: 52 } }
  text: { family: "Golos Text", weights: [400, 500, 600, 700, 800], sizes: { body: 40, label: 30, caption: 46, min: 26 } }
  mono: { family: "JetBrains Mono", weights: [500, 700], use: "commands: /mp-spec, /mp --feature --next" }
  source: "assets/fonts/*-{cyrillic,latin}-wght-normal.woff2 via %%FONTS%% in every composition"
rounded: { card: 28, chip: 999, caption-pill: 26 }
spacing: { title-safe: [192, 108, 1728, 972], caption-band: [800, 972], hud-band: [54, 106], ground-line: 740 }
components:
  outline: "4px solid #16123A"
  hard-shadow: "8px 8px 0 #16123A (no blur)"
  sticker-rim: "8px cream around characters (.kit-rim)"
  yes-button: "220px lemon disc, 6px ink outline, 10px hard shadow, «ДА» Unbounded 900 96px"
  caption-pill: "rgba(22,18,58,.88), radius 26, padding 16/32, Golos 600 46px cream, active word lemon, bottom at y=960, max-width 1360, ≤2 lines"
  hud: "cream pills, 3px ink outline, 5px hard shadow; chip «03 / 10 · Разговор» top-left, 5-station rail top-right"
motion:
  arrive: "back.out(1.7) 0.45–0.6s"
  slam: "scale 1.35→1, y −30→0, expo.out 0.3s"
  float: "sine.inOut 1.8–2.4s period, finite repeats"
  automat: "steps() / power4.inOut 0.2s"
  camera: "power2.inOut 0.8s"
  press: "0.08s to 0.92, then back.out(3) 0.35s"
---

## Overview

«Бодрая фабрика»: a bright toy/candy factory told in flat sticker graphics. Every scene has its own solid
field colour, one hero cast member drawn by the shared illustration kit, one kinetic word per beat and a
living background (ghost chapter word at 12–18 % opacity, drifting dots and pluses, themed decoration).
The viewer is «вы»; yellow (lemon) means *your decision* and nothing else.

## Colors

Brand palette from `../docs/brand.md` §2, quoted verbatim in the frontmatter. On violet and ink fields text
is cream (or lemon for «вы»); on every other field text is ink. Lemon `#FFDA4F` is reserved for «вы», «ДА»,
stamps, the HUD's decision dots and the active caption word — never a background, never decoration.
No full-frame gradients, no gradient text, no blurred shadows.

## Typography

Unbounded 700–900 for display (mega 220 / h1 112 / h2 72 / h3 52), Golos Text 400–800 for body and labels
(body 40, label 30, caption 46, never below 26), JetBrains Mono 500/700 only for the two commands. Every
composition declares the three families with local `@font-face` (`%%FONTS%%`). Russian typography:
«ёлочки», the letter ё, no-break space before «—» and after 1–2-letter words, decimal comma.

## Layout

Title-safe 192–1728 × 108–972. The caption band y 800–972 holds only captions; the HUD lives at y 54–106
from S02 to the end card; the ground line sits at y ≈ 740. Centre with flex/inset, never translate(-50%).

## Elevation

Flat. Depth comes from 4 px ink outlines and hard offset shadows (`8px 8px 0 #16123A`, no blur) and the
8 px cream sticker rim around characters.

## Components

Caption pill, HUD chip + station rail (upcoming ring · active ink pill · done mint check · lemon «да» dot),
the lemon «ДА» button, stamp «ОДОБРЕНО», kit characters/automats/phone/фиалка/belt (see
`src/partials/chars-bridge.cjs`), slanted block wipes and morph discs (`compositions/wipes.html`).

## Do's and Don'ts

- Do tie every beat to its narration cue (`C.<cue>`), keep one kinetic word per beat, keep backgrounds alive.
- Do hard-cut scenes under the wipes; transitions sit in silent gaps, never on a word.
- Don't use emoji or unicode pictographs, `<br>` in body text, exit animations before a transition,
  or lemon as decoration. Don't use the blacklisted words from brand.md §5 in on-screen copy.
