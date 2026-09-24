# «Просто» tab — implementation spec

Read first: `docs/brand.md` (binding: palette, cast, lexicon, facts). Audience: people who know almost
nothing about IT. Goal: a real WOW — colourful, big type, playful motion that *explains*, never a wall of text.

## 0. Contracts (already built by the lead — do not change these files unless told)
- `index.html` — owns ALL copy and section markup. Each section: `<section id="<scene>" class="scene field-*"
  data-scene="<scene>">` with `.scene-head` (h2 + .lead), optional `.steps` (`li.step[data-step]`), buttons
  with `data-action`, and ONE empty `.stage[data-stage]` (aria-hidden) where your SVG goes. **Do not edit
  index.html.** If you truly need extra markup, create it from JS inside your own section only (and make
  it aria-hidden unless it is an interactive control with proper labels), and report it.
- `assets/css/{tokens,base,shell,prosto}.css` — shared tokens and layout (stage aspect ratios are fixed there).
- `assets/js/core.js` (MP namespace), `facts.js` (MP_FACTS), `sprite.js` (inline icon sprite `#i-*`),
  `prosto.js` (boot, matchMedia, lazy init, `api.steps`, `api.loop`, progress belt, jumps, calm toggle,
  suspend/resume), `router.js` (tabs + hash).
- Script order (all `defer`): gsap + ScrollTrigger, ScrollToPlugin, DrawSVGPlugin, MotionPathPlugin,
  MorphSVGPlugin, SplitText, Flip, CustomEase → core → facts → sprite → chars → belt → confetti →
  scenes/*.js → media/chapters.js → media/transcript.js → prosto → router.
- Works from file:// AND http: no fetch, no ES modules, no external URLs (except the GitHub link), no
  localStorage dependence (wrap in try/catch).

### Scene API (core.js / prosto.js)
```js
MP.scene('<id>', {
  build(section, api)  // ONCE. Inject SVG into api.stage. The built DOM must already look like the FINAL,
                       // fully-shown state (so no-JS-animation, calm mode and reverts are always correct).
  init(section, api)   // animated mode. Set start states with gsap.set/fromTo and animate to the built state.
                       // Everything created synchronously here or via api.on/api.loop/api.steps is reverted
                       // automatically (gsap.matchMedia context). Never hide elements with CSS alone.
  final(section, api)  // calm mode (prefers-reduced-motion or the «Без анимации» toggle): static end state;
                       // interactive buttons still work but switch states instantly.
});
// api = { section, stage, wide (>=1024px), calm, gsap,
//         on(el,type,fn)         listener auto-removed on revert,
//         loop(anim)             idle loop: plays only while section visible & tab active; returns anim,
//         steps(fn)              sticky steps: fn(stepName, index, stepEl) when a .step becomes active (both
//                                directions). In init use gsap timelines with labels and tl.tweenTo(label);
//                                in final call it too but apply states instantly (tl.progress/seek),
//         live(text)             polite screen-reader announcement }
```
Other helpers: `MP.$`, `MP.$$`, `MP.html(str)`, `MP.svg(inner, viewBox, cls)`, `MP.seeded(seed)`,
`MP.watch(el, fn)`, `MP.lazy(el, fn)`, `MP.live(text)`, `MP.isCalm()`, `MP.prosto.jumpTo(id)`,
CustomEase names `mp.pop`, `mp.stamp`, `mp.travel` (registered in prosto.js).
Sticky steps (`chertyozh`, `sborka`, `proverki`) use CSS sticky `.stage-sticky` + `api.steps` — no GSAP pin.
The only allowed GSAP `pin`+`scrub` is `konveyer` at ≥1024px (`api.wide`).

### Illustration API (chars.js — built by the illustration package, used by all scenes)
```js
MP.char(type, opts) -> string   // SVG <g> markup (no outer <svg>) in a 120×140 box, origin top-left.
                                //   opts: {x, y, scale, expr:'happy'|'focus'|'oh'|'grumpy', id, cls, variant}
                                //   Structure classes: .c-body .c-eyes .c-pupil .c-lid .c-mouth .c-arm-l .c-arm-r
                                //   .c-hat .c-prop .c-shadow (+ .c-lamp for machines). transform-box set in chars.css.
MP.charSVG(type, opts) -> SVGElement   // standalone <svg viewBox="0 0 120 140"> for HTML contexts (cast cards).
MP.machine(type, opts) -> string       // automats: 'vesy','strelochnik','poryadok','stend','pochtalon','zhurnal'
MP.plant(state, opts) -> string        // фиалка in a pot: 'sad' | 'happy' | 'bloom' (viewBox 0 0 120 140)
MP.phone(state, opts) -> string        // phone 140×260: 'blank' | 'list' | 'notify' | 'notify-night' | 'app'
MP.stampHand(opts) -> string           // hand holding a round lemon stamp «ОДОБРЕНО»
MP.charTypes                            // array of all type ids (must include every data-char in index.html)
MP.blink(rootEl, api)                   // attaches deterministic blinking to every .c-lid in rootEl via api.loop
```
Type ids (must match `data-char` in index.html): brigadir, razvedchik, syshchik, obkhodchik, pisar, sovetnik,
pridira, planirovshchik, khudozhnik, master (variant 'chief' adds a star), revizor, arkhitektor, ispytatel,
priyomshchik, letopisets, bibliotekar, ratsionalizator, vesy, strelochnik, poryadok, stend, pochtalon, zhurnal,
vy (a lemon circle with a crown + stamp).
`belt.js`: `MP.belt(opts) -> string` (SVG conveyor segment: rollers + chevron group `.belt-chev` that scenes
move with a linear tween), `MP.beltPath(points)`; `confetti.js`: `MP.confetti({x, y, count=120, colors})` —
lazily creates a fixed full-viewport canvas, own tiny physics ~2.5 s, removes itself; no-op in calm mode.

## 1. Look & motion rules
- Sticker style: 3–4px ink outlines, flat fills, hard offset shadows (no blur), rounded shapes.
- Motion personality «бодрая фабрика»: pops `back.out(1.8)` / `mp.pop` 0.45–0.7 s, stagger 0.05–0.08;
  headlines split by WORDS (never letters) y 40→0, rotate 4→0, `power3.out` 0.6 s (use `SplitText.create(el,
  {type:'words', autoSplit:true, onSplit(self){return gsap.from(...)}})` ONLY inside init, and never on text
  containing interactive elements); travel `power2.inOut` 0.8–1.4 s; along the belt `none`; stamp/defect hits:
  scale 2→0.92 `power4.in` 0.18 s then →1 `elastic.out(1,.4)` 0.4 s + container shake x[−6,5,−3,0] 0.3 s +
  DrawSVG splash lines. Lamps `elastic.out(1,.5)` 0.25 s.
- At most ONE hero motion per viewport; at most 2 idle loops visible at once (idle loops only via api.loop).
- Animate only transform/opacity (plus DrawSVG dashoffset on short paths). No filters/blur/box-shadow tweens.
- Text must be ink on light fields, cream/lemon on violet/ink (brand §2). Texts inside SVG ≥ 16px rendered size.
- Any text drawn inside SVG must follow the lexicon (brand §5) — no jargon, no emoji, no unicode icons.

## 2. Scenes (copy is already in index.html; stage visuals below)
1. **start** (violet, hero): the idea machine — rounded factory with a funnel on top, a round window where
   Бригадир peeks out, a chimney, three lamps, an output chute. On load (not scroll): gears/blobs fade in;
   H1 words drop (y −80, back.out, stagger .08) — «сделано.» SLAMS (stamp ease) with a lemon ink-splat circle
   + 6 splash rays (DrawSVG) + small hero shake; lead rises; CTAs pop; machine assembles; bubble «Хочу
   напоминалку для цветов» drops into the funnel → machine squashes, lamps blink raspberry→sky→mint, chimney
   puffs, a PHONE pops out of the chute (back.out(2.5)) showing «Полей меня», a sprout grows. Loop every 7 s,
   max 4 cycles (api.loop), new ideas: «Хочу считать семейные расходы», «Хочу игру-раскраску для внучки»,
   «Хочу записываться к парикмахеру», each with a differently coloured phone. Desktop only: pointer parallax
   ±12px via gsap.quickTo. Calm: final composition, phone out, no loop.
2. **konveyer** (cream): a thick SVG pipe with bends. ≥1024px: pin +120%, scrub 0.6: 0–30% pipe draws while
   the letters P-I-P-E-L-I-N-E flow through as droplets; 30–50% pipe flattens into a belt (MorphSVG or crossfade);
   50–65% four characters drop onto 4 stations «Придумать · Собрать · Проверить · Выдать»; 65–100% a plain box
   rides the belt, at each station a lamp turns mint and the box gains a part (becomes a phone at the end).
   <1024px: no pin; a toggle-once 4 s timeline. Calm: static 4-station belt with arrows. (The .station-list
   under the stage stays as text.)
3. **ideya** (mint): windowsill with 3 potted plants with faces (фикус, кактус, **фиалка sad/drooping**).
   Toggle-once at top 65%: фиалка wilts further; a speech bubble "types" the phrase (chars revealed with stagger);
   bubble turns into a glowing lightbulb that rises; the target pops in: app icon «Полей меня» (drop + leaf) and
   a small phone with a plant list and water-level bars, caption «Вот что должно получиться».
4. **komanda** (tangerine): progressive enhancement of the `ul.cast-list`: JS upgrades it into a «доска почёта»
   character-select — a big spotlight (large animated character, name, line, chips, «Найти на схеме» link) +
   an avatar strip in 3 groups (Мастера / Автоматы / Вы). APG tabs pattern (strip = tablist of buttons, spotlight
   = tabpanel), arrows/Home/End, manual activation OK. On enter: avatars pop (stagger .06, back.out(2)); spotlight
   starts at Бригадир; switching: old squash-exits, new pops with a ≤5-word bubble. Easter egg: clicking Придира's
   spotlight cycles 3 nitpicks («Переделать! Тут непонятно.», «А если нет интернета?», «Запятая не там!»).
   Without JS the list of cards stays readable (every card gets its small character art via MP.charSVG).
   Bubbles (≤5 words): Бригадир «Всё по порядку!», Разведчик «Изучу ваш проект», Сыщик «Вижу три кнопки!»,
   Обходчик «Сам всё нажму», Писарь «Записываю каждую мелочь», Советники «Думаем одновременно!», Планировщик
   «Режу на карточки», Художник «Будет красиво!», Мастер «Готово, проверяйте!», Ревизор «Замечание номер один»,
   Архитектор «Решим по-хорошему», Испытатель «А если ночью?», Приёмщик «Подключено. Вот памятка», Летописец
   «Всё записано», Библиотекарь «Это запомним», Рационализатор «Есть идея!», automats start with «Бип.»
   («Бип. Вес в норме», «Бип. Налево!», «Бип. Всё по полочкам», «Бип. Испытания пройдены», «Бип. Отправлено»,
   «Бип. Записано»), Вы «Да — или нет».
5. **chertyozh** (cream + sky blueprint stage, sticky 6 steps). One master timeline with labels; api.steps →
   tl.tweenTo(label). doors: 3 doors pop (снимки экрана / беседа / готовый проект), the «с нуля» (беседа) door
   swings open. questions: 5-segment progress arc; bubbles «Какие у вас цветы?», «Во сколько напоминать?»,
   «Нужны фото?» pop and get answered. scribes: sheets fly from 2 Писари; then 5 advisors light up at the SAME
   instant with 5 rings filling in parallel + label «одновременно». critic: raspberry lamp; one sheet bounces back
   on a MotionPath arc to a Писарь, gets fixed, returns, stamped «Годится» (mint). yes: sheets stack into a rolled
   blueprint «18 листов»; two lemon barriers light; the lemon stamp hand stamps twice. board: scissors cut the
   blueprint; Flip animates 5 cards into a 3-column board «Ждут / В работе / Готово»; «Напоминание о поливе»
   glows; a small lemon «план одобрен» stamp.
6. **sborka** (sky, sticky 4 steps): belt with the card riding on MotionPath between stations. scales: Бригадир
   flicks through «Готово» (nod); card lands on Весы, needle wobbles, mint lamp, bubble «Бип. Вес в норме»; a
   ghost oversized card splits in two. switch: track switch with 2 lanes (Главный мастер / Мастер), lever flips,
   card takes the «Мастер» lane; bubble «Трудное — Главному». artist: palette splash, 3 swatches fly onto the card,
   it recolours. master: hammer ×3 with squash; the card becomes a puzzle-piece «деталь» with a bell icon.
7. **proverki** (cream, sticky 4 steps): belt continues; a raspberry RETURN belt runs underneath with arrows
   «назад к мастеру». order: scanner arch sweeps a light bar over the piece; shelf icons tick mint. auditor: dashed
   station tagged «если риск»; note cards «1» «2» pop; loop arrow counts «круг 1», «круг 2»; Архитектор walks in
   and seals a capsule «решение». tests: Испытатель pins 3 test tags (and does NOT run them); Стенд dials spin,
   RASPBERRY ALARM (siren wobble, «Бип! Ошибка!»); the piece rides the return belt (MotionPath loop) to Мастер,
   wrench spins, rides back, mint lamp «Бип. Испытания пройдены». The step's button [data-action=throw-defect]
   replays this defect loop on demand (calm: instant state swap + live text). verifier: plug into a socket; 6
   checkboxes tick (DrawSVG); a memo slides out.
8. **glavnyi** (violet): the 4 `.stop-chip`s light in sequence on enter (lemon glow pop). The `.btn--stamp`
   [data-action=stamp] (or auto when the memo's bottom passes 50% of the viewport if not pressed yet): STAMP
   SLAMS «ОДОБРЕНО» in the stage with splash + shake → the piece becomes a capsule and shoots on an arc into a
   phone → phone grows and buzzes with notification «Фиалка хочет пить. Пора полить!» → a watering can tilts
   and the фиалка perks up and BLOOMS (petals pop) → `[data-after-stamp]` lines fade in. Button then becomes
   «Ещё раз» (replays). MP.confetti burst on the stamp. Calm: stamped end state, bloom shown, button toggles.
9. **pamyat** (cream): stage = two shelves «Память этого проекта» (notebook) and «Копилка всей фабрики» (big
   book), Библиотекарь, Рационализатор with a bulb, a door «Проект №2». On enter demo: card «Оценка 3 из 5» →
   lesson card «Урок: напоминание должно звучать громче» → Библиотекарь sorts it onto a shelf → door «Проект №2»
   shows the same lesson → the two cards Flip-merge → Рационализатор's bulb lights → envelope «Рацпредложение:
   улучшить фабрику» → lemon stamp «Одобрено вами» → the factory icon gets a new shiny gear. Rating buttons
   `.rate[data-score]` (aria-pressed): 5 or 4 → `.rating-out` «Отлично! Значит, всё идёт как надо.» + stars
   sparkle; ≤3 → «Урок записан. Библиотекарь решит, куда его положить.» + replays the lesson flow.
10. **cifry** (sky): tiles pop in stagger; numbers count up (1.4 s, power2.out, snap 1) from 0 to the value in
   the DOM (already filled from MP_FACTS — read it, don't hardcode); each `.tile-viz` gets a mini visual
   running in sync: 49 → 7×7 grid of tiny faces popping; 23 → 23 lamps lighting; 18 → a fan of sheets; 4 → 4
   lemon lamps; 1 → a wrench; 25 → 25 calendar dots filling. Calm: final numbers, static visuals.
11. **zapusk** (ink «night shift»): the full simulation. Diorama (desktop 16:9 viewBox 1600×900 serpentine belt
   in 3 rows; <760px a vertical zigzag viewBox 720×1280 — rebuild by api.wide/matchMedia) with all stations and
   characters. One master `gsap.timeline({paused:true})` with labels; `[data-action=sim-play]` plays/pauses
   (label text «Запустить конвейер» ↔ «Пауза», icon swap), `[data-action=sim-reset]` rewinds, status
   `.sim-status` updated via tl.call (also MP.live for ~8 key moments). Timeline (s): 0 Воронка «Идея попала на
   фабрику» · 1.2 Бригадир «Бригадир расспрашивает» (3 «?» bubbles) · 2.4 Писари «Писари пишут чертёж» · 3.4
   Советники×5 «Пять советников — одновременно» · 4.4 Придира «Придира вернул лист. Исправлено!» · 5.4 gate
   «Вы сказали «да» чертежу» · 6.2 Доска «Планировщик нарезал карточки» · 7.2 Весы «Размер в порядке» · 8.0
   Стрелочник «Этому — к мастеру» · 8.8 Художник «Подобрал цвета» · 9.6 Мастер «Мастер пишет программу» · 10.6
   Порядок «Всё по полочкам» · 11.2 Ревизор (dimmed) «Задача несложная — Ревизор отдыхает» · 12.0 Испытатель+Стенд
   «Ошибка! Назад к мастеру» → return loop → «Починено. Испытания пройдены» · 15.0 Приёмщик «Подключено. Памятка
   готова» · 16.0 `addPause` «Фабрика ждёт вашей печати» — unhide `[data-action=sim-stamp]` and focus it
   (preventScroll) · on click: stamp slam, capsule arc into a centred phone, notification, MP.confetti · +1.5
   Библиотекарь «Урок записан» · +2.5 «Готово! «Полей меня» в телефоне». Expose `MP.sim = {pause()}` (used by
   prosto.suspend). IntersectionObserver pauses when the section leaves the viewport mid-run. Calm: same labels as
   a stepper with class toggles every 1.1 s (no travel), static burst badge instead of confetti, stamp gate kept.
12. **film** (violet) + **final** (lemon): film.js — custom lemon play overlay `[data-action=film-play]` plays the
   video and hides itself (`.film-frame.is-playing`); `error` on video/source (or missing file) → show
   `.film-fallback`; if `window.MP_VIDEO` exists, set h2 text to «Посмотрите фильм — N минуты» (ru plural,
   round to 0.5 with a comma, e.g. «2,5 минуты», «3 минуты»); fill `#film-transcript` from
   `window.MP_TRANSCRIPT` ([{start,end,text}] → paragraphs with mm:ss buttons that seek the video). Final
   stage: the whole cast lines up and WAVES (arm rotation) with the blooming фиалка next to a phone; pops up
   from the bottom (stagger) on enter. Calm: static line-up.

## 3. Package ownership (parallel work — touch ONLY your files)
- **Illustration**: `assets/js/{chars,belt,confetti}.js`, `assets/css/chars.css`, may extend `assets/js/sprite.js`
  (keep existing ids). Also add a hidden debug gallery: when location.search contains `debug=chars`, append a
  fixed overlay listing every type/expression (so reviewers can screenshot the cast).
- **Package A** start, konveyer, ideya, komanda → `assets/js/scenes/{start,konveyer,ideya,komanda}.js`, `assets/css/scenes-a.css`
- **Package B** chertyozh, sborka, proverki → `scenes/{chertyozh,sborka,proverki}.js`, `scenes-b.css`
- **Package C** glavnyi, pamyat, cifry → `scenes/{glavnyi,pamyat,cifry}.js`, `scenes-c.css`
- **Package D** zapusk, film (+ final stage inside `#final`) → `scenes/{zapusk,film}.js`, `scenes-d.css`
  (register the final section as its own scene id 'final' inside film.js).
Scope CSS by section id (e.g. `#chertyozh .x`). Do not restyle shared classes globally.

## 4. Quality bar (reviewers will check)
- Opens with zero console errors; every scene works in animated AND calm mode; tab switch away/back keeps
  positions; resize 360 ↔ 1440 works (matchMedia re-init).
- Text never overlaps illustrations at 360, 768, 1024, 1440; nothing overflows horizontally.
- Performance: transform/opacity only; lazy build; no rAF loops when off-screen.
- Accessibility: stages aria-hidden; all meaning in HTML text; buttons are real <button>s with visible labels;
  focus visible; live regions polite and throttled.
