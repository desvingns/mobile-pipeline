---
workflow: general-video
flow: automation
storyboard: no
message: "Фабрика приложений: вы говорите идею — команда ИИ-мастеров строит приложение, а последнее слово за вами"
destination: website
aspect: 1920x1080
language: ru
audience: non-IT
length: 150-185s
angle: story
narration: yes
---

## Intent

A narrated explainer film for the «Фабрика приложений» showcase site (the «Просто» tab embeds it in the
violet «film» section). It explains Mobile Pipeline — a generator that installs a team of AI agents into a
mobile-app project — to people who have never written code. We follow one idea, «Полей меня» (a reminder
to water houseplants), from a drooping violet on the windowsill to a blooming one: talk → blueprint →
critic → plan → conveyor → tests → release → memory. Warm, bright, a little funny; a toy/candy factory,
not a grey plant. The viewer is always «вы», and every human decision is yellow.

## Assets

- `../docs/brand.md` — binding brand bible: palette, cast, lexicon blacklist, facts.
- `../docs/design-video.md` — the video spec (narration, scenes, transitions, captions, HUD, audio, build).
- `../assets/js/chars.js`, `../assets/js/belt.js` — the site illustration kit, reused through `src/partials/chars-bridge.cjs`.
- `.media/music/lyria-raw.wav` — Google Lyria RealTime take (200 s), trimmed into `assets/music/bed.wav`.

## Customizations

- Narration: edge-tts ru-RU-SvetlanaNeural, rate +8 %, WordBoundary timings; trim list §2 steps 1–4 applied.
- Karaoke captions (lemon active word), top HUD with the five stations and a lemon dot at each human «да».
- Transitions: slanted two-block wipes, morph discs from the S01 bulb and the S08 green lamp, dense
  five-block wipe into the night scene, ink dip into the end card, final fade to ink.
- Mix: voice −16 LUFS, bed −20 LUFS carved under the voice group, ≈20 SFX at 0.18–0.35.

## Notes

- Deliverables land in `../media/` (mp4, poster, srt, vtt, chapters.js, transcript.js).
- Rendering stays user-gated; the build/lint/check loop is in `README.md`.
