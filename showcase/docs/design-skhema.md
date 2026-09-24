# «Схема» tab — Unreal-Blueprint-style node editor (implementation spec)

Audience: technical viewers. UI copy Russian; agent ids / file names / JSON stay English. The brand lexicon
blacklist does NOT apply here. Running example in samples/simulation: the app «Полей меня», task «Напоминание о
поливе» (NOT recipes/«Избранное»). Fixed caption in sim mode: «Учебная симуляция: агенты не запускаются,
значения — пример». Never invent timings: steps are labelled «шаг 07/21».

## 0. Integration contract
- Lazy-loaded by `router.js` on first activation: CSS `assets/css/blueprint.css`, then scripts in order
  `assets/js/blueprint-data.js` (window.BP), `bp-core.js`, `bp-ui.js`, `bp-sim.js`, `bp-outline.js`.
  After the last script, `window.MP_SKHEMA` must exist: `{ mount(rootEl, route), show(route), hide() }`.
  rootEl = `#panel-skhema` (height = viewport − header, background #17191c). `mount` builds the UI once;
  `show(route)` is called on every activation (also right after mount); `hide()` pauses the simulation,
  camera tweens and any rAF.
- Route = `<graph>[/<node>|/~<commentId>|/!<scenarioId>]`, graph ∈ overview|spec|feature|learn; empty → overview.
  On internal navigation call `MP.router.setSkhemaRoute('<graph>/<node>')` (replaceState; no reload).
  Required node ids (linked from the «Просто» cast cards — must exist): overview (graph) · overview/fn-plan ·
  spec/fn-scout · spec/fn-biz · spec/cp-crawl · spec/fn-req · spec/fn-nfr · spec/fn-eval · feature/fn-ui ·
  feature/fn-dev · feature/fn-sem · feature/fn-arch · feature/fn-tester · feature/fn-verify · feature/fn-docs ·
  feature/sc-size · feature/sc-route · feature/sc-review · feature/sc-run · feature/g-push · learn/fn-knowledge ·
  learn/fn-reflect · learn/sc-deliver · learn/sc-record.
- Globals only; no modules/fetch; works on file:// and http. GSAP is already loaded globally (window.gsap,
  MotionPathPlugin, DrawSVGPlugin registered by prosto.js — call gsap.registerPlugin again defensively).
  Fonts: 'Golos Text' (UI), 'JetBrains Mono' (ids/paths/JSON) — already loaded via fonts.css.
- CSS: everything scoped under `.bp` (root class you add inside #panel-skhema). Tokens from tokens.css
  (`--cat-agent`, `--cat-script`, `--cat-human`, `--cat-artifact`, palette vars).
- Self-contained: do NOT load anything from `../graph/` at runtime.

## 1. Graphs & navigation
| id | tab / crumb | opened from | ~nodes |
|---|---|---|---|
| overview | Обзор | root | 29 |
| spec | Обзор › /mp-spec | cp-spec, cp-spec-feature (focus its band) | 42 |
| feature | Обзор › /mp --feature | cp-feature, cp-phase, m-bugfix (bugfix preset) | 42 |
| learn | Обзор › Самообучение | cp-learn (overview), cp-post (feature) | 29 |
Document tabs row (4 fixed tabs, UE-like) + breadcrumb inside canvas top-left. Composite (CP) nodes: double-
click / Enter / header button «Открыть ▸» → 180 ms zoom-in, crossfade to the sub-graph, camera on its Entry.
Back: crumb click, Alt+↑ or Backspace (restores parent camera, reselects composite). Comment boxes = bookmarks
(keys 1–9 + stage chips).

### Conventions
- `at:[col,lane]` = node top-left, x = col·336, y = lane·176 (snapped to 8px). Fractions allowed. No overlaps
  (validator: ≥24px gap).
- Pins: `▷` exec (named outs `▷pass`), `●T:label` data pin of type T, `▦T` array pin. Exec rows first.
- Wires: `a.pin>b.pin` string or `{f,t,k,via,badge}`. k: data (default) | exec (inferred from pin type) |
  loop (dashed) | fallback (dotted grey) | blocked (red dashed, ends ⊘). `via` = reroute knots [col,lane].
  Backward wire without via → auto route below both nodes.
- Instances `id@suffix` reuse a definition (`def`) — selecting one highlights all instances (dashed ring).
- UE rules enforced by validator: an exec OUT has ≤1 wire (fan-out needs Switch/Parallel nodes); a data IN has
  ≤1 wire unless the node is a `multiIn` variable; pins hollow when unconnected, filled when connected.

### Categories (code · UE analogue · header colour base→end · extras)
EV Event `#9b1c1c→#5e1010` rounded head ◆ · IN/RT Entry/Return tunnel `#5b3aa0→#37225f` · END terminal «Стоп»
`#5a2a2a→#3a1b1b` ⏹ exec-in only · AG Agent (Function) `#13706a→#0b4642` tier chip H/S/O · MS main-session work
`#3d5f5c→#26403e` chip «главная сессия» · SC Script (deterministic) `#2b56a8→#1a356b` chip «bash · 0 токенов» ·
PS Pure script (no exec) same colour, 30px head · HG Human gate (latent Macro) `#94600f→#5e3c09` hand icon +
clock icon, badge «всегда ждёт» / «--unattended: авто Y» / «HARD STOP» · BR/SW/PA/JN Branch/Switch/Parallel/Join
`#55585f→#36383d` width 176 · VA Variable (artifact/file/board) pill with left stripe in its pin-type colour,
«SET» head for writers · CP Collapsed graph (drillable) `#3b4556→#232a35` ⧉ + lime «Открыть ▸» · CL inline
collapsed group (not drillable; dashed inner outline; details list internals) · PR Print String (nudge) MS colours.
Banners: `cond` diagonal-striped strip «если …»; `fallback` hatched strip «только если скрипт упал».
`instances:3` → two ghost cards behind (grounding-scout ×3). Icons: draw with inline SVG, not emoji.

## 2. Graph «Обзор» (overview)
Nodes (id · cat · title · tech · in → out · at):
- ev-start · EV · Старт: идея или чужое приложение · человек · — → ▷, ●Idea:идея, ▦Screens:скриншоты, ●Files:APK · [0,1]
- sw-intake · SW · Что есть на входе? · Switch on Intake · ▷ → ▷клон ▷с нуля ▷фича в проект · [0.95,1.1]
- cp-spec · CP→spec · /mp-spec: собрать требования · `/mp-spec [shots] --apk --play | --greenfield` · ▷,●Idea,▦Screens,●Files → ▷,●SpecBundle:spec/,▦SPEC:эпик · [1.8,0.4]
- cp-spec-feature · CP→spec (focus band «Режим --feature») · /mp-spec --feature: одна фича · same pins · [1.8,2.3]
- sw-plan · SW · Как планировать? · ▷ → ▷эпик задач ▷по фазам · [2.85,0.45]
- var-bundle · VA set · spec/ бандл (≈18 файлов) · `spec/*.md + traceability.csv` · ●SpecBundle → ●SpecBundle · [2.85,1.5]
- fn-plan · AG sonnet · /mp --plan: разложить на SPEC · mp-planner · ▷,●SpecBundle → ▷,▦SPEC · [3.65,0]
- fn-phases · AG sonnet · /mp --plan --phases · mp-phase-planner · ▷,●SpecBundle → ▷,▦SPEC:PHASE_NN · [3.65,1.25]
- g-plan · HG · Записать N SPEC? (y/d/n) · ▷,▦SPEC → ▷y ▷n,▦SPEC · [4.65,0]
- g-phases · HG · Аудит покрытия → записать? · ▷,▦SPEC → ▷y ▷n,▦SPEC · [4.65,1.25]
- var-board · VA set multiIn · Доска: backlog → active → done · `.claude/specs/` · ▦SPEC → ▦SPEC · [5.65,0.2]
- var-phases · VA set · План по фазам · `docs/implementation_plan/` · [5.65,1.45]
- cp-feature · CP→feature · /mp --feature --next · ▷,▦SPEC → ▷,▦Files:коммит · [6.45,0]
- cp-phase · CP→feature · /mp --phase: задача из плана · [6.45,1.25]
- var-app · VA set multiIn · Приложение · Kotlin · Compose · Hilt · Room · ▦Files → ▦Files · [7.5,0.7]
- var-refs · VA get · Эталоны клона · `spec/fit/` · → ▦Screens · [7.5,-0.75]
- fn-fit · AG (claude-opus-4-7) cond «только клон» · /mp --fit: сверка с оригиналом · mp-fit-android + pixel-diff.sh · ▷,▦Files,▦Screens → ▷,▦SPEC:расхождения,●Number:похожесть · [8.3,-1.0]
- cp-learn · CP→learn · Самообучение · post-ship · --improve · --reflect · ▷,●SPEC,▦Files → ▷,●Proposal:PR · [8.3,1.25]
- var-repo · VA set · mobile-pipeline: templates/ · github.com/desvingns/mobile-pipeline · ●Proposal → ▦Files:templates/ · [9.3,1.3]
- ev-install · EV · Установка (раз на проект) · `/plugin install · bootstrap.sh` · → ▷ · [0,3.9]
- sc-install · SC · Сгенерировать конвейер в проект · bootstrap.sh · install-spec.sh · build-marketplace.sh · ▷,▦Files:templates/ → ▷,●Route:Claude|Codex · [0.9,3.9]
- 9 compact CL nodes (header only 272×36): m-bugfix (opens feature with preset bugfix) [2.1,3.75] · m-discuss
  (mp-architect, BRAINSTORM) [3.0,3.75] · m-spec (main session writes backlog SPECs) [3.9,3.75] · m-device
  (mp-runner-instrumented-android, haiku) [4.8,3.75] · m-coverage (mp-coverage-android, haiku) [5.7,3.75] ·
  m-deliver (mp-deliver-telegram.sh) [2.1,4.1] · m-upgrade (mp-maintainer) [3.0,4.1] · m-continue [3.9,4.1] · m-check [4.8,4.1]
Exec: ev-start>sw-intake; sw-intake.клон>cp-spec; .с нуля>cp-spec (second exec into same in is fine — exec INs may
have many wires); .фича>cp-spec-feature; cp-spec>sw-plan; sw-plan.эпик>fn-plan>g-plan; sw-plan.фазы>fn-phases>g-phases;
g-plan.y>cp-feature; g-phases.y>cp-phase; cp-spec-feature>cp-feature via [[2.9,3.2],[6.2,3.2]]; cp-phase>fn-fit;
loop fn-fit>cp-feature via [[9.3,-1.4],[6.2,-1.4]] badge «расхождения → новые SPEC»; cp-feature>cp-learn; ev-install>sc-install.
Data: ev-start.idea>cp-spec.idea & cp-spec-feature.idea (data OUT may fan out); .screens>cp-spec.screens; .apk>cp-spec.apk;
cp-spec.bundle>var-bundle>fn-plan.bundle, fn-phases.bundle; fn-plan.specs>g-plan>var-board; fn-phases.specs>g-phases>var-phases;
cp-spec-feature.epic>var-board; loop fn-fit.specs>var-board; var-board>cp-feature; var-phases>cp-phase; cp-feature.files,
cp-phase.files>var-app; var-app>fn-fit.build; var-refs>fn-fit.refs; cp-feature.files>cp-learn.files; cp-learn.pr>var-repo;
loop var-repo.templates>sc-install.templates via [[9.7,4.7],[-0.4,4.7]] badge «новая версия → все проекты».
Comments: «0 · Установка» #6b7280 (ev-install, sc-install) · «1 · Требования» #4f7bd9 · «2 · План» #2aa198 ·
«3 · Реализация и сверка» #3f9d4a · «4 · Самообучение» #c9a227 · «Остальные режимы /mp» #58657a.

## 3. Graph «/mp-spec» (spec) — bands clone/greenfield/feature merge at GATE 1, spine B→F at lane 2.6
- in-spec IN [0,3] → ▷,●Idea,▦Screens,●Files:APK · sw-mode SW «Режим (Step 0)» ▷clone ▷greenfield ▷feature [0.8,3.05]
- cp-crawl CL cond «--apk + телефон» «Робот-обход (опц.)» crawl-navigator sonnet · crawl-executor opus · crawl-reviewer opus + 7 scripts in scripts/crawl/ [1.6,1.4]
- par-a PA «Параллельно ×4» [2.55,1.5]; fn-play AG haiku «Прочитать Google Play» play-store-scraper [3.2,0];
  fn-biz AG opus «Логика по скриншотам» screenshot-business-analyzer [3.2,1]; fn-style AG opus «Цвета, шрифты,
  отступы» screenshot-style-analyzer [3.2,2]; fn-apk AG sonnet cond «если --apk» «Точные данные из APK» apk-analyzer [3.2,3];
  join-a JN «Дождаться всех ×4» [4.1,1.5]
- fn-nav AG sonnet «Карта переходов» navigation-flow-analyzer [4.75,1.1]; fn-model AG sonnet «Сущности и поля»
  data-model-extractor [5.75,1.1]; gt-questions HG «Вопросы A–E + grill неясностей» [6.75,1.1]
- gt-grill HG «Grill: дерево решений» techniques/grill-me.md [1.6,4.4]; gt-interview HG «Интервью: 5 этапов» [2.6,4.4]
- g-gate1 HG «всегда ждёт» «GATE 1: инвентарь верен?» [7.75,2.6]; var-inv VA set «Инвентарь + evidence» [8.75,2.75]
- fn-const AG haiku «Свод правил проекта» constitution-author [9.45,2.6]; fn-brief MS «product-brief.md» [10.4,2.6];
  fn-req AG sonnet «Требования EARS: FR-NNN» requirements-author [11.35,2.6]; fn-stories AG sonnet «Истории: US-NNN»
  user-story-writer [12.3,2.6]; fn-ac AG sonnet «Приёмка: Gherkin» acceptance-criteria-writer [13.25,2.6];
  fn-design MS «design.md + android.md + токены» design-aggregator [14.2,2.6]
- par-e PA «Параллельно (quality-plan.json)» [15.15,2.6]; fn-nfr/fn-a11y/fn-risk AG sonnet «NFR: числа» /
  «Доступность» / «Риски + оценка» [15.8,0/1/2]; fn-sec AG sonnet cond «данные/права/сеть» [15.8,3];
  fn-analytics AG sonnet cond «нужна аналитика» [15.8,4]; fn-fitlist AG opus cond «только клон» [15.8,5];
  var-inv@e VA get evidence/core.json [15.15,3.6]; join-e JN [16.75,2.6]; var-bundle VA set multiIn «spec/ бандл» [16.75,4.2]
- sc-preflight SC «Механика: ID, ссылки, файлы» spec-preflight.sh ▷pass ▷fail [17.4,2.6]; fn-eval AG opus
  «только читает» «Критик: 5 классов проверок» spec-evaluator ▷pass ▷fail,▦Findings,●SpecBundle:traceability.csv [18.35,2.6];
  fn-owner MS «Вернуть владельцу (≤2 круга)» ▷повтор ▷бюджет исчерпан [18.35,4.1]; end-ask END «Стоп: спросить
  человека» [19.35,4.1]; g-gate2 HG «всегда ждёт» «GATE 2: принять бандл?» [19.35,2.6]; out-spec RT «Выход:
  spec/ → /mp --plan» [20.35,2.6]
- Feature band: fn-scout AG haiku instances:3 «Разведка кода ×3» grounding-scout [1.6,6.3]; gt-grill-f HG «Grill
  фичи» [2.6,6.3]; gt-decompose HG «GATE 1 фичи: разбиение» [3.6,6.3]; fn-emit MS «Записать эпик: 00-overview + NN»
  [4.6,6.3]; fn-eval@feat instance «Лёгкая проверка эпика» [5.6,6.3]; out-spec@feat RT «Выход: эпик на доске» [6.6,6.3]
Exec: in-spec>sw-mode; clone: sw-mode.clone>cp-crawl>par-a; par-a.0..3>fn-play/biz/style/apk>join-a.0..3;
join-a>fn-nav>fn-model>gt-questions>g-gate1; greenfield: sw-mode.greenfield>gt-grill>gt-interview>g-gate1 via [[7.3,4.9]];
spine g-gate1.ok>fn-const>fn-brief>fn-req>fn-stories>fn-ac>fn-design>par-e; par-e.0..5>E agents>join-e.0..5;
join-e>sc-preflight; sc-preflight.pass>fn-eval; sc-preflight.fail>fn-owner; fn-eval.pass>g-gate2>out-spec;
fn-eval.fail>fn-owner; loop fn-owner.повтор>sc-preflight via [[19.2,5.0],[17.2,5.0]] badge «≤2 круга»;
fn-owner.исчерпан>end-ask; feature: sw-mode.feature>fn-scout via [[1.2,6.6]]; fn-scout>gt-grill-f>gt-decompose>fn-emit>fn-eval@feat; fn-eval@feat.pass>out-spec@feat.
Data (key ones): in-spec.idea>fn-play, gt-grill, fn-scout; in-spec.screens>cp-crawl; in-spec.apk>cp-crawl, fn-apk;
cp-crawl.states>fn-biz, fn-style; fn-biz>fn-nav.screens & gt-questions.amb; fn-apk>fn-nav.manifest; fn-play>fn-nav.meta;
fn-nav>fn-model>g-gate1.a; gt-interview>g-gate1.g; fn-style.tokens>g-gate1.tokens; g-gate1>var-inv>fn-const;
C chain pass-through; var-inv@e>6 E agents; fn-design + 6 E agents>var-bundle; var-bundle>sc-preflight, fn-eval;
sc-preflight.report>fn-eval.mech; fn-eval.findings>fn-owner; fn-eval.trace>g-gate2; g-gate2>out-spec.bundle.
fn-owner.related = [fn-req, fn-stories, fn-ac, fn-design, fn-nfr, fn-a11y, fn-sec, fn-analytics, fn-const] (ghost-glow in sim;
only the owning agent re-runs).
Comments: «A · Клон» #4f7bd9 · «A · С нуля» #6d8fe0 · «Режим --feature» #3f9d4a · «Г1 + B · Инвентарь» #c9a227 ·
«C · Требования → истории → приёмка» #2aa198 · «D · Дизайн» #8e6bd8 · «E · Качество — параллельно» #d9822b ·
«F · Критик и петля» #d64545.

## 4. Graph «/mp --feature» (feature) — also --phase; preset bugfix shows a banner «перед цепочкой — g-repro;
после прогона — перепроверка на телефоне; верификатор может быть lite» and highlights shared nodes.
Lanes: spine 2.2 · fallbacks 0.65 · stops −0.4 · auto-fix 3.4 · repair box 4.4–6.4.
- in-feature IN «Вход: --feature --next / --phase» [0,2.2]; fn-stale MS «Не сделано ли уже?» ▷не сделано ▷уже есть,●SPEC:→active/ [0.9,2.2];
  out-auto RT «Авто-закрытие → done/» [1.85,0.65]
- sc-size SC «Размер: ячейки матрицы» mp-spec-complexity.sh ▷ok ▷split,●Report,▦Checklist:матрица [1.9,2.2];
  g-size HG «--unattended: авто Y» «Разделить на SPEC-и? (Y/n)» ▷n ▷Y [2.85,0.65]; end-split END «Вернуть планировщику» [3.8,0.65];
  var-matrix VA set «Матрица приёмки (заморожена)» [2.85,3.45]
- sc-route SC badge «×2: до и после» «Маршрут риска» mp-risk-route.sh → ▷,●Route:developer_tier,●Report [2.9,2.2]
- fn-ui AG claude-sonnet-4-6 cond «LAYERS ∋ presentation» «Токены темы Material 3» mp-ui-designer-android [3.9,2.2]
- sw-tier SW «Кто пишет код?» ▷standard ▷powerful [4.85,2.25]; var-spec VA get «SPEC (active/)» [4.85,3.5]
- fn-dev-std AG claude-sonnet-4-6 «Разработчик (стандартный)» mp-developer-standard-android [5.6,1.35];
  fn-dev AG claude-opus-4-8 «Разработчик (мощный)» mp-developer-android [5.6,3.05]; var-diff VA set multiIn «CHANGED_FILES» [6.25,3.6]
- sc-review SC «Границы слоёв (Clean Arch.)» mp-reviewer-android.sh ▷pass ▷fail ▷crash [6.65,2.2];
  fn-review-fb AG haiku fallback «Запасной ревьюер» mp-reviewer-android [6.65,0.65]; end-review END «Стоп: показать нарушения» [7.6,-0.4]
- var-matrix@sem VA get [7.1,3.45]; fn-sem AG claude-sonnet-4-6 cond «semantic_review» «Смысловое ревью по матрице»
  mp-semantic-reviewer-android ▷pass ▷findings,▦Findings,●Number:круг [7.7,2.2]
- Repair box: sw-round SW «Круг ремонта» ▷0–1 ▷2 ▷3: после капсулы [8.6,4.5]; fn-dev@repair «Ремонт: все замечания
  пакетом» [9.5,4.2]; fn-arch AG claude-sonnet-4-6 «только читает» «Капсула дизайна (PREFLIGHT)» mp-architect [9.5,5.4];
  sw-capsule SW «Нужен человек?» ▷PATCH ALLOWED ▷DESIGN DECISION REQUIRED [10.5,5.45]; g-capsule HG «всегда ждёт»
  «Решение по архитектуре» [11.4,5.95]; end-handoff END blocked «Blocked: ## Handoff в SPEC» [9.6,6.45]
- fn-tester AG claude-sonnet-4-6 no Bash «Тесты: пишет, не запускает» mp-tester-android [8.7,2.2]
- sc-run SC «Прогон: scoped → full» mp-runner-android.sh (tests, detekt, lint, coverage ≥65%) ▷pass ▷fail ▷crash [9.7,2.2];
  fn-run-fb AG claude-sonnet-4-6 fallback «Запасной прогон» mp-runner-android [9.7,0.65]
- br-fixed BR «Автопочинка уже была?» ▷нет ▷да [10.7,3.4]; fn-dev@fix «Одна автопочинка, без новой логики» [11.55,3.4];
  end-run END «Стоп: два отчёта, спросить» [11.55,4.35]
- fn-critic instance of fn-sem cond «independent_critic» «Независимый критик (свежие улики)» [10.75,2.2]; var-diff@v VA get [11.3,1.2]
- fn-verify AG haiku «Верификатор: 6 проверок + чек-лист» mp-verifier-android ▷pass ▷fail,▦Checklist [11.75,2.2];
  end-verify END «Стоп: проверки не прошли» [12.7,-0.4]
- g-push HG HARD STOP «Готово к пушу? (y/N)» ▷y ▷N [12.75,2.2]; end-wait END «N: не пушим, ждём отзыв» [13.7,0.65]
- sc-push SC «git push origin HEAD» [13.75,2.2]; fn-docs AG claude-sonnet-4-6 cond «docsAgent ≠ inert» «STATE /
  DOCUMENTATION / CLAUDE.md» mp-docs [14.75,2.2]; cp-post CP→learn «После пуша: оценка и уроки» [15.75,2.2];
  out-done RT «SPEC → done/ · отчёт» [16.75,2.2]
Exec: in-feature>fn-stale; fn-stale.не сделано>sc-size; .уже есть>out-auto; sc-size.ok>sc-route; .split>g-size;
g-size.n>sc-route; g-size.Y>end-split; sc-route>fn-ui>sw-tier; sw-tier.standard>fn-dev-std>sc-review;
sw-tier.powerful>fn-dev>sc-review; sc-review.pass>fn-sem; .fail>end-review; fallback .crash>fn-review-fb;
fn-review-fb.pass>fn-sem; fn-review-fb.fail>end-review; fn-sem.pass>fn-tester; fn-sem.findings>sw-round;
sw-round.0–1>fn-dev@repair; loop fn-dev@repair>fn-sem (below) badge «круг 1–2»; sw-round.2>fn-arch>sw-capsule;
loop sw-capsule.PATCH>fn-dev@repair; sw-capsule.DESIGN>g-capsule; loop g-capsule>fn-dev@repair; sw-round.3>end-handoff (blocked);
fn-tester>sc-run; sc-run.pass>fn-critic; sc-run.fail>br-fixed; fallback sc-run.crash>fn-run-fb; fn-run-fb.pass>fn-critic;
fn-run-fb.fail>br-fixed; br-fixed.нет>fn-dev@fix; loop fn-dev@fix>sc-run (below) badge «1 попытка»; br-fixed.да>end-run;
fn-critic.pass>fn-verify; fn-critic.fail>end-verify; fn-verify.pass>g-push; fn-verify.fail>end-verify;
g-push.y>sc-push>fn-docs>cp-post>out-done; g-push.N>end-wait.
Data: fn-stale.spec>sc-size, sc-route, fn-ui, cp-post; sc-size.report>g-size; sc-size.matrix>var-matrix;
sc-route.tier>sw-tier.sel; fn-ui.tokens>fn-dev.tokens, fn-dev-std.tokens; var-spec>fn-dev.spec, fn-dev-std.spec;
fn-dev.files, fn-dev-std.files>var-diff; var-diff>sc-review, fn-review-fb, fn-sem, fn-tester, cp-post;
var-matrix@sem>fn-sem; fn-sem.round>sw-round.sel; fn-sem.findings>fn-dev@repair, fn-arch; fn-arch.verdict>sw-capsule.sel;
fn-tester.tests>sc-run.tests; fn-tester.shots>sc-run.record; sc-run.report>fn-dev@fix; var-diff@v>fn-critic, fn-verify;
fn-verify.checklist>g-push.
Comments: «1 · Взять задачу» #2aa198 · «2 · Размер и маршрут» #c9a227 · «3 · Реализация» #3f9d4a · «4 · Ревью» #d9822b ·
«Петля ремонта: ≤2 круга → капсула → последний круг» #d64545 · «5 · Тесты и автопочинка» #5aa9e6 · «6 · Проверка и пуш»
#8e6bd8 · «7 · Закрытие» #6b7280.

## 5. Graph «Самообучение» (learn)
- in-post IN «Вход: после пуша» contract-post-ship.md [0,1.2]; sc-deliver SC cond «Telegram настроен» «Сборка в
  Telegram (y/N)» mp-deliver-telegram.sh [0.9,1.2]; g-feedback HG «Оценка 5..1 (раз на эпик)» →▷,●Number:оценка,●Idea:заметка [1.85,1.2];
  sc-record SC «Записать событие телеметрии» mp-record-run.sh (+ retro.sh via retro_due) [2.85,1.2];
  var-telemetry VA set «selfimprove/runs/*.jsonl» [2.85,2.45]; br-low BR «Оценка ≤ 3?» [3.8,1.25];
  set-lessons VA SET with exec «SET lessons.md (+1 строка)» [4.55,0.25]; fn-knowledge AG sonnet «Куда положить урок?»
  mp-knowledge → ▷,▦Memory:проект,▦Proposal:plugin_improvements,▦Memory:кандидат [5.4,1.2]; var-memory VA set
  «Память проекта + extras/<agent>.md» [6.4,0.2]; sc-brain PS «В inbox «второго мозга»» mp-brain-memory.sh [6.4,2.5];
  fn-improve AG sonnet cond «plugin_improvements ≠ ∅» «Патч конвейера (не коммитит)» mp-improve [6.4,1.2];
  var-queue VA set multiIn «Очередь .ai/proposals/*.patch» [7.4,2.6]; br-queue BR «В очереди ≥ 3?» [7.4,1.25];
  pr-nudge PR «Подсказка: /mp --improve --drain» [8.3,0.4]; out-next RT «Дальше: следующая задача» (--chain, Codex only) [9.2,1.25]
- ev-improve EV «/mp --improve "<заметка>" | --drain» [0,4.0]; fn-improve@cmd instance cond «заметка, не --drain» [1.0,4.0];
  g-pr HG «Открыть PR в конвейер? (y/n)» [8.3,4.0]; sw-drain SW «Одна заметка или очередь?» [9.2,4.05];
  sc-propose SC «Патч → ветка + PR» mp-propose-improvement.sh [10.0,3.5]; sc-drain SC «Очередь → один PR»
  mp-improve-drain.sh [10.0,4.55]; g-merge HG «Человек мержит PR» [11.0,4.0]; var-repo VA set multiIn
  «mobile-pipeline: templates/» [11.0,5.1]; sc-regen SC «CI: пересобрать плагины» regen-plugins.yml + lib/build-marketplace.sh [12.0,4.0];
  out-all RT «Все проекты: /plugin update» [13.0,4.0]
- ev-reflect EV «/mp --reflect» [0,5.6]; sc-cross SC «Уроки всех проектов (без LLM)» mp-cross-reflect.sh [0.9,5.6];
  fn-reflect AG sonnet «Отобрать повторяющиеся уроки» mp-reflect [1.85,5.6]; pr-reflect PR «N предложений в очереди» [2.8,5.6]
Exec: in-post>sc-deliver>g-feedback>sc-record>br-low; br-low.да>set-lessons>fn-knowledge; br-low.нет>fn-knowledge;
fn-knowledge>fn-improve>br-queue; br-queue.да>pr-nudge>out-next; br-queue.нет>out-next; ev-improve>fn-improve@cmd>g-pr;
g-pr.y>sw-drain; sw-drain.заметка>sc-propose>g-merge; sw-drain.--drain>sc-drain>g-merge; g-merge>sc-regen>out-all;
ev-reflect>sc-cross>fn-reflect>pr-reflect.
Data: g-feedback.score>sc-record, br-low, fn-knowledge; g-feedback.note>set-lessons, fn-knowledge; sc-record>var-telemetry;
var-telemetry>sc-cross; fn-knowledge.local>var-memory; fn-knowledge.brain>sc-brain; fn-knowledge.plugin>fn-improve;
fn-improve, fn-reflect>var-queue; var-queue>sc-drain; ev-improve.note>fn-improve@cmd>sc-propose; sc-propose.pr,
sc-drain.pr>var-repo; var-repo>sc-regen.
Comments: «Хвост после пуша» #c9a227 · «Куда идут уроки» #9eb1ff · «--improve: патч → PR» #8e6bd8 ·
«--reflect: уроки всех проектов» #2aa198 · «Новая версия — всем» #3f9d4a.
(Where pins/types are not listed, infer sensible ones consistent with the wires; the validator must pass.)

## 6. Pin types (UE analogue · colour)
exec «Выполнение» Exec #FFFFFF (chevron) · Verdict «Вердикт pass/fail» Boolean #C0282D · Number «Число» Integer
#1EE0A5 · Route «Маршрут» Enum #0F8A6A · Idea «Идея / ответ человека» Text #E27BA0 · SPEC «SPEC-блок» String
#F21FC9 · SpecBundle «Документ бандла» Struct #2E6FE8 · Files «Файлы / дифф» Object #19A7F0 · Report «JSON-отчёт
скрипта» Vector #F6C02B · Findings «Замечания с ID» Transform #F57A00 · Checklist «Чек-лист / матрица» Name
#C68BF5 · Screens «Скриншоты / эталоны» Texture #A2E23A · Memory «Урок / память» Rotator #9EB1FF · Proposal
«Патч / PR» Class #8B5CFF. Data pin = 11px circle, 2px stroke (hollow unconnected / filled connected); exec pin =
12×14 chevron; array pin = 3×3 grid square. Wires: exec white 3px; data 2.25px type colour 0.9; loop dashed 7 5;
fallback dotted 1.5 5 grey #9aa3ad; blocked red #e5484d dashed 4 4 ending ⊘. Legend dialog (button «Легенда», key L):
pin types, categories, wire kinds, badges.

## 7. Details panel (right, 400px, resizable; UE «Details»)
Header: category icon + badge («Агент · Function»), title 22/700, tech id mono, instance note. Collapsible
sections (UE dark bars ▾, property grid 40% labels): 1 Исполнитель — model tier chip (Haiku/Sonnet/Opus) + exact
frontmatter id, or «нет — детерминированный bash, 0 токенов» / «главная сессия»; tools chips; capabilities
(«Правит файлы», «Запускает Bash: нет — тесты запускает runner-android.sh», «Только читает (по контракту)»);
Codex note. 2 Что делает (2–4 sentences). 3 Входы / Выходы (label · type chip · connected node clickable) +
«Пример вывода» one-line JSON captioned «пример, не реальные данные». 4 Когда останавливается / эскалирует.
5 Порядок (sequential after X / parallel with … / conditional / repeats ≤2 / ×2 before & after). 6 Человек
(gates): «Всегда ждёт» / «--unattended: авто Y» / «HARD STOP». 7 Исходники: mono paths + copy + «Открыть на
GitHub ↗» (`https://github.com/desvingns/mobile-pipeline/blob/main/` + encodeURI(path); `{{PREFIX}}` is literal
in template file names — note «mp — префикс по умолчанию»). 8 Связанные ноды (chips, cross-graph switches graph).
9 Composite: «Открыть граф ▸». 10 Footer «Показать в симуляции» (first scenario visiting the node, seek to it).
Selecting a comment → stage summary (purpose, nodes, gate count, models).

## 8. ▶ Симуляция (UE execution debugging; scripted, nothing real runs)
Required scenarios: feature: ft-happy «Всё прошло» (low risk, standard dev, semantic + critic skipped), ft-autofix
«Тесты упали → одна автопочинка», ft-repair «Ревьюер нашёл замечания → 2 круга → капсула» (sem#1 → repair →
sem#2 → repair → sem#3 → architect PATCH ALLOWED → final repair → sem pass 12/12), ft-reject «Человек не одобрил
пуш» (g-push.N → end-wait); spec: sp-clone-ok «Клон: всё прошло» (4 analysers in parallel, analytics skipped),
sp-critic «Критик нашёл дыру → владелец переделал» (fn-owner, fn-ac ghost, eval passes); overview: ov-clone «Клон
целиком» (fit 78 < 85 → 2 divergence SPECs → loop back to feature); learn: ln-low «Оценка 2/5 → урок → патч в
очередь → подсказка». Nice-to-have: ft-blocked, ft-fallback, ft-split, sp-green, sp-feature, ov-green, ln-drain, ln-reflect.
Step schema: `{ w:"sc-run.fail>br-fixed.in", n:"br-fixed", out:"нет", st:"ok|fail|skip|wait|warn",
data:["sc-run.report>fn-dev@fix.failed"], json:{…}|text:"…", lvl:"display|warning|error", tag:"LogScript|LogAgent|LogGate",
counter:{node,text}, ghost:[ids], answer:"y", dur:1.2 }` and `{ par:[[steps…],[steps…]] }` (branches joined after the longest).
Algorithm: compile scenario → paused gsap timeline; per step: addLabel("s"+i); exec pulse travels the wire path at
900 px/s (MotionPathPlugin, pulse element inside the wires SVG); data dots in type colour in parallel; call
applyStepState(i); "work" tween (agent 1.2 s, script 0.6 s, gate 1.6 s, flow 0.25 s); call finishStep(i) (state
badge ✓ ✗ ⏭ ⏸ drawn as SVG, log line, live-region message, counters); call checkBreakpoint(n). applyStepState(i)
recomputes all node/wire classes from steps[0..i] (active/done/failed/skipped/trail) → idempotent seek; step back =
goTo(i−1). Controls: ⏮ ◀| ⏯ ▶| speed 0.5/1/2/4× (timeScale), «Камера следует» (tween only when active node leaves
central 60%), «Стоп» restores. Breakpoints: F9 / context menu → red dot; banner «⏸ Точка останова». Visuals: trail
fades 1→0.35 over 4 s; active glow #ffd23f; skipped grey «пропущено»; gates chip «ответ: y». Reduced motion
(MP.isCalm()): no pulses/camera tweens, steps apply instantly every 700 ms or manually.
Output Log (bottom, 150px, collapsible, role=log aria-live=off): UE levels Display #cfd4da / Warning #f5c451 / Error
#ff6b6b / success #7ee787; filters Все/Агенты/Скрипты/Гейты; «Копировать лог»; click a line → select node + seek.
Example lines (shapes from the real script headers; example = «Полей меня»):
`[05/21] LogScript: mp-risk-route.sh → {"risk":"low","developer_tier":"standard","semantic_review":false,"verifier":"full","independent_critic":false}`
`[09/21] LogScript: Error: mp-runner-android.sh → {"pass":false,"mode":"full","tests":"40 passed / 2 failed","detekt":"ok","lint":"ok","coverage":"71%","errors":["WateringReminderSchedulerTest > fires at 09:00 local time FAILED"]}`
`[10/21] LogAgent: mp-developer-standard-android (sonnet) → {"changed_files":["domain/reminder/WateringReminderScheduler.kt"],"commit":"8a41d07"}`
`[15/21] LogGate: Warning: g-push ждёт человека: «Готово к пушу? (y/N)» → y`
A separate `#bp-live` polite region announces «Шаг 9 из 21. runner-android.sh: тесты упали».

## 9. Rendering architecture
DOM: `section.bp` → `header.bp-toolbar` [▶ Симуляция ▾ scenario select] [⏮ ◀| ⏯ ▶| 1×] [Поиск] [Граф|Список]
[Легенда] [?] «cmp v1.17.2» · `nav.bp-doctabs` · `div.bp-body` → `div.bp-canvas` (tabindex=0, role=application,
touch-action:none) with crumbs, bookmarks, zoom label «Zoom 1:1», watermark «BLUEPRINT», `div.bp-world`
(transform translate/scale, origin 0 0) containing `div.bp-comments` (z1), `svg.bp-wires` (z2; groups data, exec,
knots, hit, pulses), `div.bp-nodes` (z3); `canvas.bp-minimap` 200×120 bottom-left; tooltip; `aside.bp-details`;
`div.bp-output`; `#bp-live`.
Geometry from `BP.metrics` (COL 336, LANE 176, W{full 272, composite 300, flow 176, var 208, tunnel 208, compact 272},
HEAD 48, HEAD_FLOW 30, ROW 28, PAD_T 8, PAD_B 10, BANNER 22, PIN_INSET 14); node height = HEAD + PAD_T +
max(in,out)·ROW + PAD_B (+BANNER if cond/fallback); var pills 36px. Pin centre x = node.x + (in ? PIN_INSET :
w − PIN_INSET), y = node.y + HEAD + PAD_T + row·ROW + ROW/2 — NO getBoundingClientRect for wires.
Wire path: cubic Béziers with horizontal tangents through knots: forward t = clamp(|dx|·0.5, 40, 260), backward
t = clamp(|dy|·0.5 + |dx|·0.25, 80, 300); backward wire without via → knots [[a.x+48, low],[b.x−48, low]],
low = max(bottom(a), bottom(b)) + 56. Knots = 6px dots. Transparent 14px hit path per wire.
Interaction: pan = left-drag background (4px threshold) / right/middle drag / Space+drag, inertia; wheel = zoom at
cursor ×1.1/notch, Ctrl+wheel = pinch, Shift+wheel = horizontal pan; limits 0.15–2.0; 0 = 1:1, F = fit, Home =
Entry; touch: 1 pointer pans, 2 pinch. LOD classes: k ≥ 0.7 full; 0.4–0.7 hide pin labels & tech line; < 0.4
collapse bodies to headers, counter-scale titles to ~14px screen, comment titles ~20px. Selection: lime #c2f779
outline + glow; connected wires .is-hot (+1px, 22% underlay); others dim (wires 18%, nodes 35%); instances dashed
ring; Esc clears. Tooltips on pins/wires. Search (/ or Ctrl+F) across all graphs (title, tech, id, src, pin labels,
what, model; lowercase, ё→е), dropdown ≤12 grouped by graph, Enter jumps. Minimap (hidden <1100px). Keyboard:
roving tabindex; → first exec out; ← exec source; ↑/↓ nearest in column; Enter select/open; Alt+↑ up; 1–9 bookmarks;
Space play/pause; N next step; F9 breakpoint; ? shortcut sheet; single-key shortcuts only while the canvas has focus.
Hidden edit mode (Ctrl+Alt+E): drag nodes snapping 0.05 col/lane; «Скопировать at[]» (textarea fallback).
Performance: static DOM; per-frame only the world transform; will-change only during gestures; no SVG filters
(glow = underlay stroke); rAF-coalesced; ≤10 pulse elements.
Mobile (<760px): outline (list) view default + «Открыть граф всё равно». Desktop toggle «Граф | Список».

## 10. Accessibility
List view: h2 per graph, h3 per stage (comment), `ol` steps in exec order (DFS from Entry/Event), nested `ul`
«параллельно», gates marked «Требует человека», each item a disclosure rendering the same details. Canvas
role=application with instructions label; nodes role=button with composed aria-label («Агент mp-developer-android,
Разработчик (мощный), модель Opus. Входы: SPEC. Выходы: изменённые файлы. 11 из 42»); focus ring 2px dashed white
distinct from selection. Details role=complementary; Enter moves focus to its heading; Esc returns. No colour-only
meaning (dash patterns, icons, text badges, glyph states). Chrome sized in rem.

## 11. Visual spec
Canvas #17191c; minor grid 16px rgba(255,255,255,.04); major 128px rgba(0,0,0,.5) (background-image following the
camera; hide minor below k 0.5); faint vignette; watermark «BLUEPRINT» 64px/800 rgba(255,255,255,.05) bottom-right.
Node body rgba(14,15,17,.88), border 1px rgba(0,0,0,.9), inset top highlight, radius 7px, shadow 0 6px 18px
rgba(0,0,0,.55); header gradient `linear-gradient(90deg, C 0%, C 55%, color-mix(in oklab, C 35%, transparent) 100%)` +
gloss. Type: title 15/600 white (text-shadow 0 1px 1px #000); tech 13px mono #a9b1bb; pin label 13px #d6dbe1;
comment title 18/700; details title 22/700; section headers 13/700 uppercase .06em (the only uppercase allowed);
details body 16px/1.55; log 13px mono; toolbar 14px. Tier chips H #34c4b3 · S #9b7bff · O #f2a33a. Pulses: exec
10px chevron #ffd23f + glow; data 7px dot. States: selection 2px #c2f779; sim active glow #ffd23f pulsing 1.2 s;
failed #ff6b6b; skipped 45%; breakpoint #e5484d. Comments: fill colour 9%, border 40%, 36px title bar 88%.
Chrome: details #1e2023, bars #2b2e33, text #e6e9ed, muted #9aa3ad, primary lime #c2f779 on #192a10; log #121315.
Headers derive from brand tokens via color-mix so the tab harmonises with «Просто».

## 12. Data file `assets/js/blueprint-data.js` (window.BP) and tools
```js
window.BP = { schema:1, pipelineVersion:"1.17.2", repoBlob:"https://github.com/desvingns/mobile-pipeline/blob/main/",
  metrics:{…}, types:{exec:{ru,ue,color}, …14}, cats:{AG:{ru:"Агент",ue:"Function"}, …},
  defs:{ "mp-developer-android":{ cat:"AG", title:"Разработчик (мощный)", tech:"mp-developer-android",
      model:{tier:"opus", id:"claude-opus-4-8"}, tools:["Bash","Read","Write","Edit","Glob","Grep"], flags:["commits"],
      src:["templates/android/agents/{{PREFIX}}-developer-android.md"],
      also:["templates/common/commands/runtime/contract-feature-implementation.md"], codex:"subagent-toml",
      pins:{ in:[{id:"in",t:"exec"},{id:"spec",t:"SPEC",l:"SPEC"},{id:"tokens",t:"Report",l:"DESIGN_TOKENS"}],
             out:[{id:"then",t:"exec"},{id:"files",t:"Files",l:"changed_files + commit",arr:true}] },
      d:{ what:"…", stops:"…", order:"…" }, sample:'{"changed_files":[…],"commit":"3f9c2e1"}' }, … },
  graphs:[{ id:"feature", tab:"/mp --feature", parent:"overview", entry:"in-feature",
    nodes:[{id:"fn-dev", def:"mp-developer-android", at:[5.6,3.05]}, {id:"fn-dev@fix", def:"mp-developer-android",
      at:[11.55,3.4], title:"…", pins:{…override}}, {id:"fn-ui", def:"…", at:[3.9,2.2], cond:"если LAYERS ∋ presentation"}],
    wires:["fn-tester.then>sc-run.in", {f:"fn-dev@fix.then", t:"sc-run.in", k:"loop", via:[[12.3,4.0],[9.5,4.0]], badge:"1 попытка"}],
    comments:[{id:"c-repair", key:5, title:"…", color:"#d64545", nodes:[…]}] }, …],
  presets:{ bugfix:{graph:"feature", banner:"…", highlight:[…]} },
  scenarios:{ feature:[{id:"ft-autofix", title:"…", steps:[…]}], … } };
```
Comment boxes computed from member bounding boxes (+40px padding, 36px title bar).
Tools (Node, no deps, CommonJS `.cjs`):
- `tools/seed-defs.cjs` (one-off): reads `../graph/data/*.js` (skip if absent) + `templates/**/agents/*.md` frontmatter
  → prints draft defs (title, model, tools, src/also, ru.what/why/stops) for copy-edit.
- `tools/validate-blueprint.cjs`: loads the data in `vm` with `window={}`; prints ok/FAIL lines; exit 1 on failure.
  Checks: ids unique `/^[a-z0-9][a-z0-9@-]*$/`, defs exist, cats/types known, required fields per cat; wires
  resolve, right sides, exact type match, exec-out ≤1 wire, data-in ≤1 unless multiIn, backward wires are loop or
  have via; composites' pins = target graph IN outs ∪ RT ins; layout no overlaps (24px), comment members exist, node
  in ≤1 comment; text: title ≤32 chars, pin label ≤24, `d.what` 2–4 sentences mostly Cyrillic; header contrast ≥4.5
  vs #fff; every src/also path exists (repo root = showcase/..); model/tools equal `templates/**/agents/*.md`
  frontmatter (`model:`, `tools:`; overlays without frontmatter fall back to `claude-plugins/mp-dev/agents/*.md`);
  scenarios reference existing nodes/wires, exec continuity, gates carry answer, json one line, par branches join;
  pipelineVersion = ../VERSION (warn); required node ids from §0 exist; `--coverage` lists unreferenced agents/scripts
  (informational).
