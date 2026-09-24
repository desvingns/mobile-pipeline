# Video spec — «Фабрика приложений» (HyperFrames, Russian, ~2:45–3:00)

Read `showcase/docs/brand.md` first (palette, cast, lexicon, facts — binding). Project dir:
`D:\Pet\mobile-pipeline\showcase\video\` (already scaffolded: `hyperframes init --example=blank
--skill=general-video`, HyperFrames CLI pinned **0.8.65** — always call `npx --yes hyperframes@0.8.65 …`).
Installed: `node_modules/{gsap@3.14.2,@fontsource-variable/{unbounded,golos-text,jetbrains-mono},
@hyperframes/core@0.8.65}`; Python venv `.venv` with `edge-tts 7.2.7` + `google-genai`.
Music: Lyria output lands in `.media/music/lyria-raw.wav` (200 s, generated separately).
Final deliverables go to `D:\Pet\mobile-pipeline\showcase\media\` : `mobile-pipeline.mp4`, `poster.jpg`,
`mobile-pipeline.srt`, `mobile-pipeline.vtt`, `chapters.js` (`window.MP_VIDEO={duration,chapters:[{id,title,start}]}`),
`transcript.js` (`window.MP_TRANSCRIPT=[{start,end,text}]`).

MANDATORY reads before writing composition HTML (do not rely on memory):
`C:\Users\Admin\.claude\skills\hyperframes-core\SKILL.md` (+ references/determinism-rules.md,
composition-patterns.md, variables-and-media.md), `hyperframes-animation\SKILL.md` (+ the named rules/
blueprints below and transitions references), `hyperframes-creative\references\{house-style,video-composition}.md`,
`hyperframes-audio\SKILL.md` (carve), `hyperframes\references\production-loop.md`, `media-use\audio\references\{tts,sfx,bgm}.md`.

## 1. Look (design.md — write it at project root with this frontmatter content)
canvas 1920×1080, 30 fps. Colours = brand palette. Scene fields (text colour): S01 cream (ink) ·
S02 violet (cream) · S03 tangerine (ink) · S04 sky (ink) · S05 raspberry (ink) · S06 cream (ink) ·
S07 violet (cream) · S08 ink «night» (cream) · S09 mint (ink) · S10 sky (ink) → end card on ink.
Lemon #FFDA4F only for «вы»/«ДА»/active caption word — never a background.
Type: Unbounded 700–900 display (mega 220, h1 112, h2 72, h3 52), Golos Text 400–800 (body 40,
label 30, caption 46, min 26), JetBrains Mono 500/700 for commands (`/mp-spec`, `/mp --feature --next`).
Local @font-face in EVERY composition file (lint requires it) from `assets/fonts/*.woff2` copied from
node_modules (cyrillic + latin `wght-normal`).
Components: outline 4px ink; hard shadow `8px 8px 0 #16123A` (no blur); sticker rim 8px cream around
characters; radius card 28 / chip 999; «ДА» button = 220px lemon disc, 6px ink outline, 10px hard shadow,
«ДА» Unbounded 900 96px; caption pill rgba(22,18,58,.88), radius 26, padding 16/32, Golos 600 46px cream,
active word lemon.
Frame: title-safe 192–1728 × 108–972; y 800–972 reserved for captions (no scene text there); ground line
y≈740; small HUD at top (y 54–106).
Motion personality «бодрая фабрика»: arrive back.out(1.7) 0.45–0.6s; kinetic-word slam fromTo scale
1.35→1, y −30→0, expo.out 0.3s; robots float sine.inOut 1.8–2.4s period, finite repeats; automats snap
steps()/power4.inOut 0.2s; camera power2.inOut 0.8s; press 0.08s to 0.92 then back.out(3) 0.35s.
Do: one kinetic word per beat; background layer on every scene (ghost chapter word 12–18% opacity,
drifting dots/pluses, themed decoration: drops, gears, stars). Don't: full-frame gradients, gradient text,
emoji, blurred shadows, `<br>` in body text, exit animations before a transition.
Characters: SVG generator `src/partials/chars.cjs` (same grammar as brand.md §4: viewBox 0 0 120 140,
ink stroke 4, faces for мастера, faceless lamp boxes for автоматы; blink by scaleY 0.1 for 0.1s on a
deterministic schedule per index; hover jets optional). Фиалка partial with states sad/happy/bloom.
Phone partial (rounded device, notification states: `reminder-0300`, `reminder-0900`, app list).

## 2. Narration (write `narration/narration.json`; `{shown|spoken}` = captions show left, TTS says right;
`[[cue]]` = time marker at the start of the next spoken word; TTS text = spoken form without markers)
Total ≈ 340 words. Scene lead-in 0.5 s, tail 0.6 s (S01 lead 1.2; S03/S05/S06/S08 tail 0.9; S10 tail 3.2).

S01 «Фиалка поникла» (cream):
`[[q]]Знакомо? Фиалка на окне опять [[wilt]]поникла: вы снова [[forgot]]забыли её полить. Вот бы [[app]]приложение, которое вовремя напомнит! Но вы не [[coder]]программист. Теперь это не [[bulb]]помеха.`
S02 «Фабрика» (violet):
`Знакомьтесь: [[brand]]{Mobile Pipeline|Мобайл Пайплайн} — [[factory]]фабрика приложений. В её каталоге [[n49]]{49|сорок девять} [[team]]ИИ-мастеров, и живёт она прямо в [[home]]вашем проекте. Работа идёт по [[belt]]конвейеру: каждый мастер делает свою часть и передаёт дальше. А главные решения принимаете [[you]]вы.`
S03 «Разговор» (tangerine):
`Всё начинается с [[talk]]разговора. [[brig]]Бригадир расспрашивает вас об идее — простыми словами. А если похожее приложение уже есть, хватит [[shots]]снимков экрана: их одновременно разглядывают [[analysts]]сыщики. Потом вы [[inventory]]проверяете список экранов и говорите [[ok]]«да».`
S04 «Чертёж» (sky):
`Из ваших ответов [[scribes]]писари составляют [[docs]]чертёж — около [[n18]]{18|восемнадцати} листов: [[what]]что умеет приложение, [[look]]как выглядит и [[check]]как проверить, что всё работает. А пять [[advisors]]советников одновременно думают о скорости, удобстве, защите данных и рисках.`
S05 «Придира» (raspberry):
`Готовый чертёж читает строгий [[critic]]Придира. Нашёл [[gap]]дыру — [[back]]возвращает автору на доработку. Но не больше [[two]]двух раз, чтобы не ходить по кругу. Чертёж [[accept]]принимаете вы.`
S06 «План» (cream):
`Дальше [[planner]]Планировщик режет чертёж на [[tasks]]карточки-задания: [[plants]]список цветов, [[remind]]напоминание о поливе, календарь, фото. Вы [[approve]]одобряете план — и карточки встают на [[board]]доску: [[todo]]«ждут», [[doing]]«в работе», [[done]]«готово».`
S07 «Конвейер» (violet):
`Фабрика берёт [[card]]следующую карточку — «Напоминание о поливе». Автомат [[scales]]«Весы»: не слишком ли она большая? [[switch]]Стрелочник решает, кому её поручить: трудное — [[chief]]Главному мастеру, простое — обычному. Меняется экран — цвета подбирает [[artist]]Художник. [[master]]Мастер пишет программу, а автомат [[order]]«Порядок» проверяет, что всё по полочкам.`
S08 «Испытания» (ink night):
`Рискованную работу перечитывает [[auditor]]Ревизор: не больше [[rounds]]двух кругов правок. Потом [[tester]]Испытатель придумывает испытания, а [[stand]]стенд их прогоняет. [[red]]Красный свет! Напоминание пришло в [[night]]три часа ночи. У мастера ровно [[fix]]одна попытка починить. [[stop]]Не выйдет — фабрика остановится и позовёт вас.`
S09 «Выпуск» (mint):
`[[green]]Зелёный! [[verifier]]Приёмщик проверяет, что новинка правда [[wired]]подключена, и пишет вам короткую [[memo]]памятку. А выпускать или нет — [[decide]]решаете только вы: без вашего [[yes]]«да» ничего не выходит в свет. После [[ship]]выпуска [[chron]]Летописец дописывает журнал проекта. А [[plant]]фиалка теперь всегда полита.`
S10 «Память» (sky → ink end card):
`Напоследок фабрика просит [[rate]]оценку от [[stars]]{5|пяти} до {1|одного}, а [[lib]]Библиотекарь записывает уроки. Если урок [[repeat]]повторяется в разных проектах, [[rational]]Рационализатор предлагает улучшить саму фабрику — тоже с вашего [[approve]]одобрения. [[brand]]{Mobile Pipeline|Мобайл Пайплайн}. [[slogan]]Сказано — сделано.`
Trim list if the measured total > 180 s (apply in order, re-measure after each): S07 «Меняется экран — цвета подбирает Художник.» → drop; S04 «, удобстве»; S02 «, и живёт она прямо в вашем проекте»; S08 «чтобы» parts; then raise TTS rate (max +15%). Never use ffmpeg atempo. If < 150 s lower rate to +4%.

## 3. Scene visuals (tie every beat to its cue: `C.cue` seconds within the scene)
Cite motion names only from `hyperframes-animation` blueprints-index.md / rules-index.md (read them;
the names below are candidates — verify they exist, otherwise pick the closest listed rule).
- S01 (kinetic-type-beats; discrete-text-sequence, spring-pop-entrance, svg-path-draw, particle-burst):
  big sad фиалка left on a windowsill; ghost word «ПОЛИВ»; q: «ЗНАКОМО?» slams right; wilt: leaves droop,
  pot face sad, one drop falls; forgot: sticky note «полить» scribbled out; app: phone outline draws with
  bell icon; coder: a «</>» sticker gets a raspberry cross; bulb: lemon lightbulb pops with 24 sparks
  (seeded) — origin of transition T1.
- S02 (grid-card-assemble → constellation-hub; counting-dynamic-scale): brand slams top «MOBILE PIPELINE»,
  chip «фабрика приложений»; n49/team: 7×7 grid of mini characters assembles from centre, «49» counts up
  200px, legend «22 — для чертежа · 27 — для сборки»; home: grid collapses into a ring around a phone
  «ваш проект»; belt: a conveyor draws under the ring, a box travels station to station; you: a lemon
  «ВЫ» slams (220px, lemon on violet, ink outline+hard shadow).
- S03 (agent-progress-theater; ai-tracking-box, press-release-spring): mono chip «/mp-spec» top-left;
  talk/brig: Бригадир and «вы» trade typed bubbles («Для кого?» → «Для себя», «Как часто поливать?» →
  «Раз в три дня»); shots: 3 screenshot cards fan in; analysts: 3 Сыщики scan them SIMULTANEOUSLY
  (bracket scans + status pills «экраны… / кнопки… / тексты…» flip to check marks); inventory: checklist card
  «Экраны: 4 · Возможности: 7» ticks; ok: lemon «ДА» stamp.
- S04 (grid-card-assemble; counting-dynamic-scale): Писарь with a giant quill; 18 mini sheets fly into a
  6×3 wall; «≈18» slams; what/look/check: three slams highlighting tiles; advisors: 5 Советники light up
  at the SAME instant with 5 filling rings + label «одновременно».
- S05 (css-marker-patterns, kinetic-beat-slam, vertical-spring-ticker): Придира slides in (monocle glint);
  gap: raspberry marker circles + diagonal stamp «ДОРАБОТАТЬ»; back: sheet arcs back to Писарь on a dashed
  loop; two: pill «круг 1 из 2» → «2 из 2»; accept: big lemon «ДА» button rises, a hand presses (ring
  burst, seeded confetti ≈30).
- S06 (grid-card-assemble, waterfall-entry): Планировщик's scissors cut the blueprint into 4 icon cards
  (one per spoken item); approve: small lemon «ОК» stamp; board: 3-column board lands; todo/doing/done
  headers drop on their words; tail: «Напоминание о поливе» slides to «В работе».
- S07 (spatial-pan-stations; viewport-change, multi-phase-camera, stat-bars-and-fills): one wide world
  (~4200px) with a conveyor (y 560–700) and 5 stations, a virtual camera pans; belt chevrons = one linear
  tween for the whole scene; mono chip «/mp --feature --next» types on card; stations: ① Весы (needle,
  «размер в норме»), ② Стрелочник (track switch, card takes a lane; chips «Главный мастер / обычный»),
  ③ Художник (paints phone screen, bell appears), ④ Мастер (hammer, coloured bars = the program, not real
  code), ⑤ automat «Порядок» (scanner arch, green lamp, tag «автомат · без ИИ»).
- S08 (agent-progress-theater; vertical-spring-ticker, chromatic-glitch burst, ambient-glow-bloom):
  auditor: Ревизор with note cards «1» «2», dashed sticker «только если рискованно»; rounds ticker;
  tester: test rows type «Напомнит в 09:00», «Не будит ночью», «Работает без интернета»; stand: steel
  Стенд lamps cycle; red: raspberry lamp glow + «КРАСНЫЙ» slam; night: phone glitches to «03:00 · Пора
  полить фиалку» with moon icon; fix: sticker «1 попытка», wrench spins, Мастер zips in, sparkle; stop:
  dimmed side panel «не вышло → СТОП, ждём вас» (rule, not what happens); tail: lamp mint, phone 09:00.
- S09 (device-surface-showcase, cta-morph-press): «ЗЕЛЁНЫЙ!» slam; Приёмщик's cable draws into the phone;
  3 «подключено» badges; memo card with 3 steps; decide: conveyor stops at a striped barrier «СТОП · решаете
  вы», its sign morphs into the lemon «ДА»; yes: press + ring burst, barrier lifts; ship: phone launches up,
  «Вышло в свет»; chron: Летописец writes «Запись № 12: напоминание о поливе»; plant: notification
  «09:00 · Фиалка хочет пить. Пора полить!», фиалка perks up and BLOOMS.
- S10 (constellation-hub → logo-assemble-lockup, dataviz-countup): 5 lemon stars fill; lessons fly into a
  jar «Память проекта»; three jars («Полей меня», «Рецепты», «Трекер сна»), the same lesson glows in all
  three, lines converge on card «Рацпредложение: улучшить фабрику»; approve: lemon «ДА» stamp; brand:
  cut to ink end card — wordmark «MOBILE PIPELINE» assembles, tagline «Сказано — сделано.», stats count up
  «49 помощников · 23 автомата · 15 режимов · версия 1.17.2», badge «4 раза ждёт вашего «да» · 1 попытка
  починки · ≤2 круга правок»; the cast lines up and waves; фиалка in bloom in a corner; final 0.8 s fade
  to ink (the only exit animation).
Background life in every scene so motion checks never see a frozen frame (bob, belt chevrons, drifting dots).

## 4. Transitions (one full-length overlay `compositions/wipes.html`; scenes hard-cut underneath)
Per hyperframes-animation transitions references: primary = staggered colour blocks (2 blocks, 12° slant,
lead cream/ink, trailing = next scene field; in 0.25s, 0.06s apart, out 0.28s power3.inOut; alternate
direction); accents = morph circle (T1 from the S01 bulb, violet; T8 S08→S09 from the green lamp, mint) and
dense 5-block wipe T7 (S07→S08); final colour dip to ink. Cover completes exactly at the cut T; reveal from
T+0.02. Transitions sit in silent gaps (never on a word). Whoosh SFX peaking at T.

## 5. Captions (one full-length sub-composition `compositions/captions.html`)
Word timings from edge-tts WordBoundary. Groups: break at sentence end, any pause ≥0.35 s, optionally at
«:»/«—» after 36 chars; max 84 chars / 12 words; ≥0.9 s; never cross scene boundaries. Style: caption pill
(design.md), max-width 1360px, `text-wrap: balance`, ≤2 lines, centred with flexbox (no translate(-50%)),
pill bottom at y=960. Karaoke: each word inline-block span; at its start → lemon + scale 1.05; at end → cream
(no weight change). Group fade in 0.14 s / out 0.08 s, then hard-kill `tl.set(g,{opacity:0,visibility:'hidden'},end)`.
Also emit SRT + VTT with the same groups and `transcript.js`.

## 6. HUD (compositions/hud.html, S02 → end card start)
Top-left chip «03 / 10 · РАЗГОВОР» style (Russian scene names); top-right rail of 5 stations: Идея ·
Чертёж · План · Сборка · Выпуск; a lemon dot appears at each human «да» (S03, S05, S06, S09).
Cream pills with ink text; above the wipes.

## 7. Audio
- Voice: `scripts/generate-voice.py` — edge_tts.Communicate(spoken, "ru-RU-SvetlanaNeural", rate="+8%",
  boundary="WordBoundary"); save mp3 + words.json per scene; cache by hash(voice,rate,pitch,text);
  3 concurrent, 4 retries with backoff. Run with `PYTHONUTF8=1 ./.venv/Scripts/python.exe`.
- `scripts/process-voice.cjs`: decode → highpass 70 Hz → measure loudness over ALL scenes joined (two-pass
  loudnorm, −16 LUFS, TP −1.0) → apply ONE shared linear gain → 48 kHz mono 16-bit WAV
  `assets/voice/<id>.wav`; duration = samples/sampleRate floored to ms (no m4a! GPT-6's m4a padding
  caused 4 render warnings). No silence trimming (word timings must stay valid).
- Word alignment in the build: match spoken tokens to WordBoundary events (case/ё/punctuation-insensitive;
  merge up to 3 events for hyphenated words); fail with a diff on mismatch; display tokens take times of
  their spoken words; cue time = start of the word after the marker.
- Music: `scripts/process-music.cjs` trims `.media/music/lyria-raw.wav` to total+0.5 s, 1.0 s fade-in,
  3.0 s fade-out, two-pass loudnorm to −20 LUFS → `assets/music/bed.wav` (48 kHz stereo). If Lyria failed
  or is too short, `scripts/synth-music.cjs` (seeded offline synth: 112 BPM, D major I–V–vi–IV, kick/clap/
  hat/bass/marimba-like pluck/pad, arrangement changes at scene starts) produces the raw WAV instead.
- Mix in HyperFrames: voice `<audio id="vo-s01" data-audio-group="voiceover" …>` track 10; music
  `<audio id="music-bed" data-audio-group="music" data-timeline-role="music" …>` track 11; SFX (converted
  to 48 kHz WAV from `C:\Users\Admin\.claude\skills\media-use\audio\assets\sfx\`, Pixabay licence) group
  "sfx", volume 0.18–0.35, track 12, ≈15–20 cues (pop, sparkle, chime, click, whoosh at transitions, error
  at red light, notification at the phone, impact-bass at the brand lockup). Then carve the bed under the
  voice: `node C:/Users/Admin/.claude/skills/hyperframes-audio/scripts/carve.mjs --comp index.html --bed music-bed`
  (verify attributes written; rerun after every build). Fallback: a volume automation lane ducking to 0.3
  during speech windows.
- Targets: voice −16 LUFS; bed −20 LUFS in gaps, ≈−30…−34 under speech; final mix −16±1 LUFS, TP ≤ −1 dBTP.

## 8. Build scripts (project-local, Node CommonJS `.cjs` because package.json has "type":"module")
`scripts/vendor-assets.cjs` (fonts + gsap.min.js into assets/, licence notes) · `scripts/generate-voice.py` ·
`scripts/process-voice.cjs` · `scripts/process-music.cjs` · `scripts/synth-music.cjs` (fallback) ·
`scripts/build-video.cjs` (reads narration + words + durations + `src/scenes/sNN-*.html` templates →
writes `index.html`, `compositions/*.html`, `timing.json`, captions/SRT/VTT, chapters, STORYBOARD.md;
flags `--plan-only`, `--print-snapshots`; placeholders `%%ID%% %%DUR%% %%CUES%% %%FONTS%% %%CHAR:<role>:<size>%%
%%PLANT:<state>%% %%PHONE:<state>%%`; fail if a template uses an undefined cue; byte-stable output, no
timestamps) · `scripts/carve.cjs` (runs carve.mjs and asserts) · `scripts/verify-output.cjs` (ffprobe
checks, +faststart remux, poster = end card at total−1.5 s, copies deliverables to ../media/).
Scene templates are HAND-AUTHORED per scene in `src/scenes/` (not one generic layout).
Timing: scene length = lead + voice + tail rounded UP to 0.1 s; voice starts at lead; transitions in gaps.

## 9. Determinism & lint pitfalls (from the skill docs — obey)
Sub-composition `<style>`/`<script>` inside `<template>`; host id = inner id = timeline key; root styled by
`#id`, `inset:0`. Exactly one paused timeline per composition registered at `window.__timelines[id]` at the
end of synchronous build; use fromTo; never add sub-timelines by hand. Every `<audio>` has an id; no
crossorigin; audio only in root. Never tween display/visibility/autoAlpha on a `.clip` (animate children).
No Math.random/Date.now/performance.now (use seeded mulberry32); no repeat:-1 (compute finite repeats).
Never CSS transform + GSAP on the same property; no translate(-50%) with GSAP x/y. inline-block for
animated spans. No DOM measurement during tweens. No CSS transitions on animated elements. Always pass
`--describe false` to `snapshot` (GEMINI key is in env and would otherwise send frames). Fix lint errors
first (they disable layout/contrast audits).

## 10. Commands
```bash
cd /d/Pet/mobile-pipeline/showcase/video
export PYTHONUTF8=1
node scripts/vendor-assets.cjs
./.venv/Scripts/python.exe scripts/generate-voice.py && node scripts/process-voice.cjs
node scripts/build-video.cjs --plan-only
node scripts/process-music.cjs            # or synth-music.cjs then process-music.cjs
node scripts/build-video.cjs && node scripts/carve.cjs
npx --yes hyperframes@0.8.65 lint
npx --yes hyperframes@0.8.65 check --json > .hyperframes/check.json
npx --yes hyperframes@0.8.65 snapshot --at "<times>" --no-end --describe false
node C:/Users/Admin/.claude/skills/hyperframes-animation/scripts/animation-map.mjs . --out .hyperframes/anim-map
npx --yes hyperframes@0.8.65 render --quality delivery --fps 30 --workers 4 --output renders/mobile-pipeline.mp4
node scripts/verify-output.cjs
```
(Check exact flag names with `npx --yes hyperframes@0.8.65 <cmd> --help` before use.)

## 11. QA
check: 0 errors (lint, runtime, layout, motion, contrast, caption zone). Render log: no `[WARN] [compile] Audio`,
fonts loaded (Unbounded, Golos Text, JetBrains Mono). Snapshots: each scene start+0.6, midpoint, end−0.3, plus
key beats (S01 wilt/bulb, S02 team/you, S03 analysts+1/ok, S04 check, S05 gap/accept, S06 board+1, S07 switch/
order, S08 night/final, S09 yes/plant, S10 stars/end card) and a Cyrillic glyph test. Captions ≤2 lines inside
x 192–1728, bottom ≤972. Pacing 1.9–2.6 words/s per scene; total 150–185 s. ffprobe: H.264 High yuv420p
1920×1080 30 fps CFR, AAC 48 kHz stereo, +faststart, −16±1 LUFS, TP ≤ −1 dBTP, `ffmpeg -v error -i out.mp4 -f null -` silent.
