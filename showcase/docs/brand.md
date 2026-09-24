# Showcase brand bible (shared by site «Просто», site «Схема», and the video)

Everything user-facing is Russian. This file is the single source of truth for metaphor, cast,
palette, type, lexicon and facts. If another doc disagrees, this file wins.

## 1. Concept
- Metaphor: **«Фабрика приложений»** — a bright toy/candy factory (not a grey plant).
  A pipeline = a conveyor belt. Explain the word once: «Английское слово pipeline значит
  «трубопровод». Так называют работу по цепочке: каждый мастер делает свою часть и передаёт
  дальше. Как лента на кассе в магазине.» After that say «конвейер».
- Slogan: **«Сказано — сделано.»**
- Example app: **«Полей меня»** — reminds you to water houseplants. The task card we follow:
  **«Напоминание о поливе»**. Mascot: a **фиалка** (violet) in a pot with a face — sad/drooping
  at the start, blooms after release. Final phone notification: «Фиалка хочет пить. Пора полить!»
  Board cards: «Список цветов», «Добавить цветок», «Напоминание о поливе», «Календарь полива»,
  «Фото цветка». The injected defect in the story: the reminder arrived at 03:00 at night.
- Voice: the narrator addresses the viewer as **«вы»** (lowercase), warm, short sentences,
  active verbs. Characters speak only in bubbles of ≤5 words, first person, lightly funny.
  No first-person narrator. No disclaimers except once: «В жизни это дольше, но порядок тот же».
  The word «ИИ» may appear only in: hero lead («команда ИИ-мастеров») and the cast intro
  («Все они — искусственный интеллект: программы, которые понимают обычную речь»).
  Never use «команда» to mean a command (ambiguous) — say «в один шаг».

## 2. Palette (WCAG contrast pre-checked)
| token | hex | role | text on it |
|---|---|---|---|
| --ink | #16123A | text, outlines, hard shadows, night field | cream/lemon |
| --cream | #FFF6E6 | calm fields, cards | ink (violet allowed, 6.0:1) |
| --violet | #5B34F5 | brand, hero, Бригадир | cream or lemon only |
| --lemon | #FFDA4F | RESERVED for «вы» / human decisions: stamp, stops, «ДА», primary CTA | ink |
| --mint | #2BD99F | success lamps, plants | ink |
| --raspberry | #FF4F8B | defect / return / Придира | ink |
| --sky | #3EC5FF | automats, water, blueprint | ink |
| --tangerine | #FF8A1F | мастера, number tiles | ink |
Hard rules: on violet/ink → cream or lemon text only; on every other fill → ink text only.
Body text always on a solid fill. Lemon never decorates — yellow means *your decision*.
Focus ring: `outline:3px solid var(--ink); box-shadow:0 0 0 7px var(--lemon)` (on ink/violet
fields invert: outline cream). Hard offset shadows (no blur): `6px 6px 0 var(--ink)`.
Outlines: 3–4px ink.

## 3. Type
- Display: **Unbounded** (variable 200–900). Text: **Golos Text** (400–900). Mono: **JetBrains Mono**
  (Схема + commands). All inlined in `assets/css/fonts.css` (base64; do not add url() fonts).
- Site scale: H1 clamp(44px,11vw,150px)/900; H2 clamp(30px,6vw,80px)/800; H3 36/24px 700;
  lead 30/21px Golos 500; body 22/18px (≥20px at ≥1024px); buttons 20/18px Unbounded 700,
  min-height 56px; smallest caption 16px. Never uppercase micro-labels; never <16px.
- Russian typography: non-breaking space after 1–2-letter words and before «—»; «ёлочки»;
  the letter ё; decimal comma («2,5»). Unbounded is very wide: long character names switch to
  Golos 800 below 480px.

## 4. Cast (same names on site and video)
Мастера (AI, have faces) · Автоматы (scripts: metal boxes with lamps, NO face, bubbles start
«Бип.») · Вы (never drawn as a person on the site: a hand holding a round lemon stamp «ОДОБРЕНО»,
or a lemon «ДА» button; in the video a lemon-sweater person silhouette is allowed).

| Персонаж | Plain one-liner | Real ids (for «Схема» links) | Tier badge |
|---|---|---|---|
| Бригадир | Ведёт работу: кого позвать, в каком порядке, когда остановиться и спросить вас. | orchestrators `/mp`, `/mp-spec` (main session) | — |
| Разведчик (до 3 сразу) | Читает ваш готовый проект, чтобы новое легло на место. | grounding-scout (haiku) | быстрый |
| Сыщик | Разглядывает снимки экрана и страницу в магазине: что где лежит и как выглядит. | screenshot-business-analyzer, screenshot-style-analyzer (opus), play-store-scraper, apk-analyzer, navigation-flow-analyzer, data-model-extractor | самый сильный |
| Робот-обходчик | Сам нажимает кнопки в оригинальном приложении на телефоне. | crawl-navigator, crawl-executor, crawl-reviewer | — |
| Писарь | Записывает, что умеет приложение, как им пользуются и как это проверить. | requirements-author, user-story-writer, acceptance-criteria-writer, constitution-author | — |
| Советники (5) | Одновременно думают о скорости, удобстве, защите данных, статистике, рисках и сроках. | nfr-analyzer, a11y-reviewer, security-privacy-reviewer, analytics-taxonomy-designer, risk-estimator | — |
| Придира | Строгий критик: ищет дыры в чертеже и возвращает на доработку, не больше двух раз. | spec-evaluator (opus) | самый сильный |
| Планировщик | Режет чертёж на карточки-задания и ставит их в очередь. | mp-planner, mp-phase-planner | — |
| Художник | Подбирает цвета, шрифты и отступы, когда меняется экран. | mp-ui-designer-android | — |
| Мастер / Главный мастер | Пишет программу. Трудное — Главному (самый сильный ИИ), простое — обычному. | mp-developer-standard-android (sonnet) / mp-developer-android (opus) | самый сильный (Главный) |
| Ревизор | Вчитывается в смысл рискованной работы, пишет замечания по номерам. | mp-semantic-reviewer-android | — |
| Архитектор | Решает спор, если за два круга не договорились, и записывает решение. | mp-architect | — |
| Испытатель | Придумывает испытания. Сам не запускает — это делает стенд. | mp-tester-android | — |
| Приёмщик | Убеждается, что новинка подключена, и пишет вам памятку на 3–5 шагов. | mp-verifier-android (haiku), mp-verifier-lite-android | быстрый |
| Летописец | Записывает, что изменилось в проекте. | mp-docs | — |
| Библиотекарь | Решает, что запомнить: для этого проекта или для всей фабрики. | mp-knowledge | — |
| Рационализатор | Замечает повторяющиеся уроки и предлагает улучшить саму фабрику. | mp-reflect, mp-improve | — |
| Автомат «Весы» | Взвешивают задачу: не слишком ли большая. | mp-spec-complexity.sh | — |
| Автомат «Стрелочник» | Решает, какому мастеру отдать задачу и сколько нужно проверок. | mp-risk-route.sh | — |
| Автомат «Порядок» | Проверяет, что всё разложено по своим полочкам. | mp-reviewer-android.sh | — |
| Автомат «Стенд» | Прогоняет испытания: прошло или нет. | mp-runner-android.sh | — |
| Автомат «Почтальон» | По желанию присылает готовое приложение в Telegram. | mp-deliver-telegram.sh | — |
| Автомат «Журнал смены» | Записывает, как прошла каждая работа. | mp-record-run.sh | — |
| Вы — директор | Даёте «да» четыре раза. Без вашей печати ничего не выходит. | human gates | — |

Character colours (site + video): Бригадир violet squircle + lemon hard hat? NO — lemon is reserved
for «вы»: Бригадир wears a **tangerine** hard hat with headlamp and holds a clipboard.
Разведчик small sky circles, cap, binoculars · Сыщик tangerine capsule, raspberry deerstalker,
magnifier · Робот-обходчик sky metal body WITH eyes, antenna, long finger · Писарь mint, violet
beret, quill + scroll · Советники small cream bodies, props: speedometer/glasses/padlock/abacus/umbrella ·
Придира raspberry rounded triangle, monocle, stern brows, red pencil · Планировщик mint, scissors + pins ·
Художник raspberry capsule, violet beret, palette · Мастер tangerine squircle, goggles, wrench;
Главный мастер adds a star on the cap · Ревизор tall violet, top hat, magnifier + note cards «1»«2» ·
Архитектор ink body with cream eyes, blueprint roll · Испытатель mint, lab goggles, stopwatch ·
Приёмщик sky, headset, plug with cable, clipboard with 6 boxes · Летописец cream, thick book ·
Библиотекарь violet, round glasses, card drawer · Рационализатор tangerine, lightbulb above head ·
Automats: sky/steel boxes with rivets, lamps (raspberry/lemon-free: use mint/raspberry/sky lamps; a
lemon lamp only when waiting for YOU), gauges, gears.
Character grammar: viewBox 0 0 120 140, 4px ink stroke, flat fills, one cream highlight, 2 ink
ellipse eyes with white glints, mouths happy/focus/oh/grumpy, capsule arms (shoulder pivot),
stubby legs, floor shadow ellipse (ink 15%).

## 5. Lexicon — blacklist → plain words (site «Просто» + video narration + captions)
агент/ИИ-агент/субагент → мастер (or the job name) · скрипт/детерминированный → автомат
(«строго по правилам, всегда одинаково») · оркестратор/координатор → Бригадир · пайплайн → конвейер
(explained once) · спека/спецификация/ТЗ/бандл → чертёж · бэклог/таска/тикет/SPEC → доска заданий,
карточка-задание · код/кодить/имплементация → программа («пишет программу») · тесты/прогон/
тестировщик → испытания, стенд, Испытатель · ревью/ревьюер → проверка, Ревизор · баг/фейл → ошибка,
брак · фича → новинка · пуш/коммит/мерж/деплой/релиз → выпуск, «выходит в свет» · репозиторий →
проект · PR → рацпредложение · апрув/гейт → «фабрика ждёт вашего «да»», печать · параллельно →
одновременно · архитектура/слои → «всё по своим полочкам» · интеграция → «подключено к приложению» ·
UI/дизайн-токены → экран, внешний вид, цвета и шрифты · a11y → «удобно всем, и тем, кто плохо видит» ·
NFR → скорость и надёжность · телеметрия/метрики → журнал смены, статистика · opus/sonnet/haiku/
токены → «самый сильный / обычный / быстрый ИИ» · промпт → задание · плагин/CLI/терминал/bash →
don't mention · скриншот → снимок экрана.
Allowed proper nouns: ИИ (twice), Android, iPhone, Telegram, Google Play, Claude Code, Codex, GitHub
(final band only), "pipeline" (once, Latin). No emoji, no unicode pictographs (✓ ✳ ♥ ▶ ⌘) —
draw SVG icons from the inline sprite.
The «Схема» tab is technical and MAY use real terms (agent ids, SPEC, bash, JSON) — the blacklist
does not apply there, but its UI copy stays Russian.

## 6. Facts (must match window.MP_FACTS in assets/js/facts.js; verified against the repo)
- Version **1.17.2** (file `VERSION`); **25** releases since **18 мая 2026** (CHANGELOG).
- **49** agent templates = **22** for the blueprint (/mp-spec) + **27** for building (/mp; incl. 5 iOS
  stubs). Say «49 помощников в каталоге фабрики» — do not claim all 49 run in every task.
- **22** runnable deterministic scripts («автоматов»; 23 .sh files minus the sourced crawl library). **15** work modes of /mp.
- Human «да» in the story: **4** — (1) список экранов (GATE 1), (2) весь чертёж (GATE 2),
  (3) план заданий (/mp --plan y/d/n), (4) выпуск (push, hard stop). Phrase as «2 — за чертёж,
  1 — за план, 1 — за каждый выпуск».
- **1** automatic fix after failed tests, then stop and ask you. Semantic repair: **2** rounds, then
  Архитектор writes a decision capsule, then one final round (so never say «не больше двух кругов» alone).
  Придира returns work **≤2** times. «Порядок» (layer check) and Приёмщик (verifier) do NOT send work back:
  a failure there stops the factory and asks you.
- Blueprint ≈ **18** documents. Interview: first a one-question-at-a-time «grill» about the essentials, then **5** stages × ≤**4** questions; GATE 1 (список экранов) comes BEFORE the scribes write anything. Up to **3** scouts at once.
  Clone look-alike threshold **85** («сходство — не меньше 85 из 100»). Verifier: **6** checks + a
  3–5-step memo for you.
- Only these run simultaneously: clone analysers (Google Play, 2 screenshot analysers, APK), up to 5
  advisors (3 always: скорость/NFR, удобство/a11y, риски; защита данных и статистика only if needed; plus the
  fit checklist for clones), the scouts. The whole build chain (/mp) runs strictly one after another.
- Works in **Claude Code** and **Codex**. Android now; iPhone later.
- Model tiers: fast (haiku) for checkers/scouts, standard (sonnet) for most, strongest (opus) for the
  main developer, the critic (spec-evaluator), screenshot analysers, crawl executor/reviewer, fit agents.
- The release stamp approves the push; it does not install anything on a phone. Telegram delivery and the
  5..1 score happen once per epic (after the last card).
