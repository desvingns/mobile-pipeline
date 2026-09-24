/* blueprint-data.js — window.BP: everything the «Схема» tab draws (graphs, node definitions, pin
 * types, bugfix preset, simulation scenarios). Pure data plus a tiny builder; no DOM, no fetch.
 * Spec: docs/design-skhema.md §12. Checked by tools/validate-blueprint.cjs (run it after edits).
 *
 * Facts come from the repo, never from memory: model:/tools: are copied from the agent template
 * frontmatter, sample outputs follow the JSON shapes in the agent "Return" sections and the script
 * headers, stop rules follow templates/common/commands/runtime/*.md. Example app everywhere:
 * «Полей меня», task «Напоминание о поливе» (SPEC watering-reminder.md).
 *
 * Authoring shorthands (expanded by the builder; the final window.BP has the §12 shape):
 *   pins    '>id' | '>id:label'              exec pin (default ids: in «in», out «then»)
 *           'id:Type:label' | 'id:Type[]:label'  data pin / array pin
 *   wires   'a>b'         → 'a.then>b.in'    exec with default pins
 *           'a.pass>b'    → 'a.pass>b.in'    named exec out
 *           'a.x>b.y'     → as written        (data wires are always written in full)
 *           'a>b>c'       chain: a middle 'b.x' names b's OUT pin, a last 'c.y' names c's IN pin
 *   at      [col, lane] → x = col·336, y = lane·176 (snapped to 8px by the renderer).
 * Pin ids are ASCII; Russian text lives in labels. A scenario step's `out` is a pin id — show its label.
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ helpers */
  function mix(a) {
    for (var i = 1; i < arguments.length; i++) {
      var b = arguments[i]; if (!b) continue;
      for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k];
    }
    return a;
  }
  function pin(s) {
    if (s.charAt(0) === '>') {
      var r = s.slice(1), i = r.indexOf(':');
      return i < 0 ? { id: r, t: 'exec' } : { id: r.slice(0, i), t: 'exec', l: r.slice(i + 1) };
    }
    var a = s.indexOf(':'), id = s.slice(0, a), rest = s.slice(a + 1), b = rest.indexOf(':');
    var t = b < 0 ? rest : rest.slice(0, b);
    var p = { id: id, t: t.replace('[]', ''), l: b < 0 ? id : rest.slice(b + 1) };
    if (t.slice(-2) === '[]') p.arr = true;
    return p;
  }
  function io(ins, outs) { return { in: ins.map(pin), out: outs.map(pin) }; }
  function end(pinStr, isOut) {
    var i = pinStr.indexOf('.');
    return i < 0 ? pinStr + (isOut ? '.then' : '.in') : pinStr;
  }
  /* 'a>b' → 'a.then>b.in' (single hop) */
  function hop(s) { var p = s.split('>'); return end(p[0], true) + '>' + end(p[1], false); }
  /* 'a>b.x>c' → ['a.then>b.in', 'b.x>c.in'] */
  function chain(s) {
    var t = s.split('>'), out = [];
    for (var i = 0; i < t.length - 1; i++) {
      var from = t[i], to = t[i + 1];
      var toNode = (i + 1 === t.length - 1) ? to : to.split('.')[0];
      out.push(end(from, true) + '>' + end(toNode, false));
    }
    return out;
  }
  function W(s, o) { var h = hop(s).split('>'); return mix({ f: h[0], t: h[1] }, o); }

  var REPO_BLOB = 'https://github.com/desvingns/mobile-pipeline/blob/main/';
  var TA = 'templates/android/agents/{{PREFIX}}-';
  var TC = 'templates/common/agents/{{PREFIX}}-';
  var TS = 'templates/spec/agents/';
  var SCO = 'templates/common/scripts/{{PREFIX}}-';
  var SAN = 'templates/android/scripts/{{PREFIX}}-';
  var RT = 'templates/common/commands/runtime/';
  var SK = 'templates/spec/skills/app-spec-creator/';
  var SHIMS = 'templates/dev/codex/skills/mp-dev/references/codex-agent-shims.md';

  function cxDev(name, model, effort, sandbox) {
    return {
      codex: 'Codex: нативный субагент .codex/agents/' + name + '.toml — ' + model + ', effort ' + effort + ', ' + sandbox +
        '. Шим читает тот же канонический текст агента; таблица моделей — codex-agent-shims.md.',
      codexModel: { model: model, effort: effort, sandbox: sandbox }
    };
  }
  function cxSpec(name, model, effort) {
    return {
      codex: 'Codex: глобальный субагент ~/.codex/agents/' + name + '.toml — ' + model + ', effort ' + effort +
        '. Таблица уровней — install-spec.sh.',
      codexModel: { model: model, effort: effort }
    };
  }
  var CX_SCRIPT = 'Codex запускает тот же bash-скрипт через shell. Если Bash недоступен, используется запасной путь (нативный агент), как и в Claude.';
  var CX_MAIN = 'Codex: ту же работу делает основная сессия навыка ($mp / $mp-spec), без отдельного субагента.';
  var CX_GATE = 'Claude спрашивает через AskUserQuestion; Codex задаёт вопрос в чате и останавливается до ответа.';

  /* ------------------------------------------------------------------ vocabulary */
  var types = {
    exec:       { ru: 'Выполнение',            ue: 'Exec',      color: '#FFFFFF', d: 'Порядок работы: белый провод передаёт управление следующему узлу.' },
    Verdict:    { ru: 'Вердикт pass/fail',     ue: 'Boolean',   color: '#C0282D', d: 'Да или нет: прошла проверка или нет.' },
    Number:     { ru: 'Число',                 ue: 'Integer',   color: '#1EE0A5', d: 'Оценка, номер круга, процент сходства.' },
    Route:      { ru: 'Маршрут',               ue: 'Enum',      color: '#0F8A6A', d: 'Выбор из фиксированного списка: standard/powerful, PATCH ALLOWED/DESIGN DECISION REQUIRED.' },
    Idea:       { ru: 'Идея / ответ человека', ue: 'Text',      color: '#E27BA0', d: 'Свободный текст от человека: идея, ответы на вопросы, заметка к оценке.' },
    SPEC:       { ru: 'SPEC-блок',             ue: 'String',    color: '#F21FC9', d: 'Карточка-задание: TASK / WHAT / LAYERS / CHANGED_HINT / TEST_TYPES / CONSTRAINTS.' },
    SpecBundle: { ru: 'Документ бандла',       ue: 'Struct',    color: '#2E6FE8', d: 'Документ из spec/: требования, истории, приёмка, дизайн, трассировка.' },
    Files:      { ru: 'Файлы / дифф',          ue: 'Object',    color: '#19A7F0', d: 'Изменённые файлы, коммит, сборка приложения.' },
    Report:     { ru: 'JSON-отчёт',            ue: 'Vector',    color: '#F6C02B', d: 'Одна строка JSON — ровно такой выход у каждого детерминированного скрипта и у большинства агентов.' },
    Findings:   { ru: 'Замечания с ID',        ue: 'Transform', color: '#F57A00', d: 'Находки ревьюера или критика со стабильными ID вида STATE-001.' },
    Checklist:  { ru: 'Чек-лист / матрица',    ue: 'Name',      color: '#C68BF5', d: 'Замороженная матрица приёмки, ручной чек-лист, капсула дизайна.' },
    Screens:    { ru: 'Скриншоты / эталоны',   ue: 'Texture',   color: '#A2E23A', d: 'Снимки экрана оригинала, кадры робота-обходчика, эталоны для сверки.' },
    Memory:     { ru: 'Урок / память',         ue: 'Rotator',   color: '#9EB1FF', d: 'Урок для памяти проекта или кандидат во «второй мозг».' },
    Proposal:   { ru: 'Патч / PR',             ue: 'Class',     color: '#8B5CFF', d: 'Предложение улучшить сам конвейер: патч, очередь, pull request.' }
  };

  var cats = {
    EV:  { ru: 'Событие',               ue: 'Event',                 head: ['#9b1c1c', '#5e1010'], w: 'full' },
    IN:  { ru: 'Вход графа',            ue: 'Entry tunnel',          head: ['#5b3aa0', '#37225f'], w: 'tunnel' },
    RT:  { ru: 'Выход графа',           ue: 'Return tunnel',         head: ['#5b3aa0', '#37225f'], w: 'tunnel' },
    END: { ru: 'Стоп',                  ue: 'Terminal',              head: ['#5a2a2a', '#3a1b1b'], w: 'full' },
    AG:  { ru: 'Агент',                 ue: 'Function',              head: ['#13706a', '#0b4642'], w: 'full' },
    MS:  { ru: 'Главная сессия',        ue: 'Macro (inline)',        head: ['#3d5f5c', '#26403e'], w: 'full' },
    SC:  { ru: 'Скрипт',                ue: 'Function (bash)',       head: ['#2b56a8', '#1a356b'], w: 'full' },
    PS:  { ru: 'Чистый скрипт',         ue: 'Pure function',         head: ['#2b56a8', '#1a356b'], w: 'full' },
    HG:  { ru: 'Решение человека',      ue: 'Latent macro',          head: ['#94600f', '#5e3c09'], w: 'full' },
    BR:  { ru: 'Ветвление',             ue: 'Branch',                head: ['#55585f', '#36383d'], w: 'flow' },
    SW:  { ru: 'Переключатель',         ue: 'Switch on Enum',        head: ['#55585f', '#36383d'], w: 'flow' },
    PA:  { ru: 'Одновременно',          ue: 'Sequence (parallel)',   head: ['#55585f', '#36383d'], w: 'flow' },
    JN:  { ru: 'Дождаться всех',        ue: 'Join',                  head: ['#55585f', '#36383d'], w: 'flow' },
    VA:  { ru: 'Переменная',            ue: 'Variable',              head: ['#3b4556', '#232a35'], w: 'var' },
    CP:  { ru: 'Свёрнутый граф',        ue: 'Collapsed Graph',       head: ['#3b4556', '#232a35'], w: 'composite' },
    CL:  { ru: 'Свёрнутая группа',      ue: 'Collapsed Nodes',       head: ['#3b4556', '#232a35'], w: 'full' },
    PR:  { ru: 'Подсказка',             ue: 'Print String',          head: ['#3d5f5c', '#26403e'], w: 'full' }
  };

  var flags = {
    'edits':      'Правит файлы',
    'commits':    'Делает коммит',
    'read-only':  'Только читает (по контракту)',
    'no-bash':    'Запускает Bash: нет',
    'multimodal': 'Смотрит на картинки',
    'parallel':   'Работает одновременно с другими',
    'fallback':   'Запасной путь: только если скрипт упал',
    'stages':     'Готовит патч, но не коммитит',
    'device':     'Нужен телефон или эмулятор',
    'network':    'Ходит в сеть',
    'zero-tokens':'Детерминированный bash, 0 токенов'
  };

  var gates = {
    always: 'всегда ждёт',
    auto:   '--unattended: авто Y',
    hard:   'HARD STOP'
  };

  var metrics = {
    COL: 336, LANE: 176, SNAP: 8,
    W: { full: 272, composite: 300, flow: 176, 'var': 208, tunnel: 208, compact: 272 },
    HEAD: 48, HEAD_FLOW: 30, ROW: 28, PAD_T: 8, PAD_B: 10, BANNER: 22, PIN_INSET: 14,
    VAR_H: 36, COMPACT_H: 36, GHOST: 8, GAP: 24, COMMENT_PAD: 40, COMMENT_BAR: 36
  };

  /* ------------------------------------------------------------------ definitions */
  var defs = {};
  function D(key, o) {
    if (defs[key]) throw new Error('BP: duplicate def ' + key);
    if (o.sample && typeof o.sample !== 'string') o.sample = JSON.stringify(o.sample);
    defs[key] = o;
  }

  /* ===== Overview ===== */
  D('ev-start', {
    cat: 'EV', title: 'Идея или чужое приложение', tech: 'человек',
    pins: io([], ['>then', 'idea:Idea:идея', 'screens:Screens[]:скриншоты', 'apk:Files:APK']),
    src: [SK + 'SKILL.md'],
    d: {
      what: 'Точка входа всей фабрики. Человек приносит одно из трёх: словесную идею приложения, скриншоты чужого приложения со ссылкой Google Play и, по желанию, APK, или описание новой фичи для уже существующего проекта. От этого зависит, какой режим /mp-spec запустится.',
      order: 'Первый узел; всё остальное начинается отсюда.'
    }
  });
  D('sw-intake', {
    cat: 'SW', title: 'Что есть на входе?', tech: 'Switch on Intake',
    pins: io(['>in'], ['>clone:клон', '>green:с нуля', '>feature:фича в проект']),
    src: [SK + 'SKILL.md'],
    d: {
      what: 'Режим выбирает сам /mp-spec на шаге Step 0 по аргументам. Скриншоты, --apk или --play означают клон; --greenfield или пустой ввод — приложение с нуля; --feature или описание фичи внутри проекта с доской .claude/specs/ — фичу в готовый проект. Флаг --mode переопределяет автоопределение.'
    }
  });
  D('cp-spec', {
    cat: 'CP', graph: 'spec', title: '/mp-spec: собрать требования', tech: '/mp-spec',
    pins: io(['>in', 'idea:Idea:идея', 'screens:Screens[]:скриншоты', 'apk:Files:APK'],
      ['>then', 'bundle:SpecBundle:spec/', 'epic:SPEC[]:эпик']),
    src: [SK + 'SKILL.md'], also: ['docs/SPEC-PIPELINE.md', 'install-spec.sh'],
    d: {
      what: 'Свёрнутый граф глобального навыка app-spec-creator (в плагине — /mp-spec). Клон и «с нуля» сходятся на одном наборе артефактов: около 18 документов в spec/ с полной трассировкой. Навык опирается на 22 агента-специалиста из каталога, два человеческих гейта и петлю критика.',
      order: 'Один раз на приложение, до любого планирования.'
    }
  });
  D('cp-spec-feature', {
    cat: 'CP', graph: 'spec', focus: 'c-feature', title: '/mp-spec --feature: одна фича', tech: '/mp-spec --feature',
    pins: io(['>in', 'idea:Idea:идея', 'screens:Screens[]:скриншоты', 'apk:Files:APK'],
      ['>then', 'bundle:SpecBundle:spec/', 'epic:SPEC[]:эпик']),
    src: [SK + 'SKILL.md'],
    d: {
      what: 'Тот же навык в режиме --feature для уже существующего проекта. Вместо бандла spec/ он пишет эпик прямо на доску проекта: 00-overview плюс нумерованные SPEC-файлы. GATE 2 здесь нет — роль первого гейта играет подтверждение разбиения.',
      order: 'Открывает граф /mp-spec и сразу показывает полосу «Режим --feature».'
    }
  });
  D('sw-plan', {
    cat: 'SW', title: 'Как планировать?', tech: '/mp --plan | /mp --plan --phases',
    pins: io(['>in'], ['>epic:эпик', '>phases:по фазам']),
    src: [RT + 'plan.md'],
    d: {
      what: 'Бандл превращается в работу двумя способами. /mp --plan режет его на эпик SPEC-файлов на доске, а /mp --plan --phases строит нумерованный план в docs/implementation_plan/ — это тяжёлый мост для клонов и больших строек.'
    }
  });
  D('var-bundle', {
    cat: 'VA', set: true, multiIn: true, title: 'spec/ бандл', tech: '≈18 документов',
    pins: io(['bundle:SpecBundle:spec/'], ['bundle:SpecBundle:spec/']),
    src: [SK + 'SKILL.md'],
    d: {
      what: 'Результат /mp-spec: около восемнадцати документов — свод правил, продуктовый бриф, требования, истории, сценарии приёмки, дизайн, приложение про Android, качество, доступность, безопасность, аналитика, языки, риски, оценка и таблица трассировки. Бандл не зависит от платформы: всё про Compose и Gradle живёт только в platform/android.md.'
    }
  });
  D('mp-planner', mix({
    cat: 'AG', title: '/mp --plan: эпик из SPEC', tech: 'mp-planner',
    model: { tier: 'sonnet', id: 'sonnet' }, tools: ['Read', 'Glob', 'Grep'], flags: ['read-only', 'no-bash'],
    src: [TC + 'planner.md'], also: [RT + 'plan.md', 'templates/common/specs/README.md'],
    pins: io(['>in', 'bundle:SpecBundle:spec/ бандл'], ['>then', 'specs:SPEC[]:SPEC-файлы']),
    d: {
      what: 'Читает бандл или любой дизайн-документ и предлагает упорядоченный эпик: 00-overview с капсулой дизайна и SPEC-файлы со строками Acceptance-matrix и Risk-signals. Сам ничего не пишет: возвращает блок === PLAN === с готовым markdown, а файлы создаёт оркестратор после гейта.',
      stops: 'Если источник дизайна недоступен, ставит design_source_available:false и пишет предупреждение в warnings[]. На доску ничего не попадает без ответа «y».',
      order: 'Последовательно: после /mp-spec, перед гейтом «Записать N SPEC?». Режим sync — если эпик с таким slug уже есть.'
    },
    sample: { epic_slug: 'polei-menya', mode: 'bootstrap', specs: [{ file: '.claude/specs/backlog/polei-menya-00-overview.md', kind: 'overview' }, { file: '.claude/specs/backlog/polei-menya-03-watering-reminder.md', order: 3, promote: false }], warnings: [] }
  }, cxDev('mp-planner', 'gpt-5.4', 'high', 'workspace-write')));
  D('mp-phase-planner', mix({
    cat: 'AG', title: '/mp --plan --phases', tech: 'mp-phase-planner',
    model: { tier: 'sonnet', id: 'sonnet' }, tools: ['Read', 'Glob', 'Grep'], flags: ['read-only', 'no-bash'],
    src: [TC + 'phase-planner.md'], also: [RT + 'plan.md', 'templates/common/implementation_plan/PHASE_TEMPLATE.md.tmpl'],
    pins: io(['>in', 'bundle:SpecBundle:spec/ бандл'], ['>then', 'specs:SPEC[]:PHASE_NN']),
    d: {
      what: 'Строит план по фазам docs/implementation_plan/phases/PHASE_NN_*.md: якоря на разделы дизайна (slug и hash), задачи TASK-NN.k и трассировка к FR, US и экранам. В режиме sync сливает изменения, сохраняя отмеченные галочки и заметки.',
      stops: 'Перед записью оркестратор делает детерминированный аудит покрытия: каждый screen_id из fit/registry.csv и каждый FR/US должен попасть хотя бы в одну задачу. Непокрытые id — блокер: r перепланирует, a явно откладывает.',
      order: 'Последовательно после /mp-spec; пишет только оркестратор и только после гейта (y/d/n).'
    },
    sample: { clone: true, mode: 'bootstrap', phases: [{ n: '03', title: 'Напоминания о поливе', file: 'docs/implementation_plan/phases/PHASE_03_reminders.md', screens: ['S04'], tasks: [{ id: 'TASK-03.2', text: 'WateringReminderScheduler: время полива в локальной зоне' }] }], warnings: [] }
  }, cxDev('mp-phase-planner', 'gpt-5.4', 'high', 'workspace-write')));
  D('g-plan', {
    cat: 'HG', gate: 'always', badge: gates.always, title: 'Записать N SPEC? (y/d/n)', tech: '--plan · y/d/n',
    pins: io(['>in', 'specs:SPEC[]:план'], ['>y:y', '>n:n', 'specs:SPEC[]:SPEC-файлы']),
    src: [RT + 'plan.md'], codex: CX_GATE,
    d: {
      what: 'Оркестратор показывает имена файлов и какой SPEC станет первым. y записывает overview и SPEC-и дословно из rendered_markdown и продвигает первый в active/, d сначала показывает полные тексты, n ничего не пишет. Писать можно только внутри .claude/specs/.',
      human: 'Всегда ждёт ответа: это одно из четырёх «да» человека в истории.'
    }
  });
  D('g-phases', {
    cat: 'HG', gate: 'always', badge: gates.always, title: 'Аудит → записать фазы?', tech: '--plan --phases',
    pins: io(['>in', 'specs:SPEC[]:план'], ['>y:y', '>n:n', 'specs:SPEC[]:PHASE_NN']),
    src: [RT + 'plan.md'], codex: CX_GATE,
    d: {
      what: 'Сначала детерминированный аудит: все ли экраны и FR/US бандла покрыты задачами плана. Непокрытые id — блокер, их нельзя молча потерять. Затем превью файлов, слияний и дельт PROGRESS/overview и вопрос «Записать/слить N файлов фаз? (y / d / n)».',
      human: 'Всегда ждёт ответа.'
    }
  });
  D('var-board', {
    cat: 'VA', set: true, multiIn: true, title: 'Доска заданий', tech: '.claude/specs/',
    pins: io(['specs:SPEC[]:SPEC'], ['specs:SPEC[]:SPEC']),
    src: ['templates/common/specs/README.md'], also: [RT + 'contract-backlog.md'],
    d: {
      what: 'Доска заданий проекта: папки backlog/, active/ и done/ с SPEC-файлами. Статус SPEC — это папка, в которой он лежит; имя <epic>-NN-<slug>.md задаёт порядок, а *-00-overview.md служит индексом эпика. В active/ обычно ровно один SPEC.'
    }
  });
  D('var-phases', {
    cat: 'VA', set: true, title: 'План по фазам', tech: 'PHASE_NN_*.md',
    pins: io(['specs:SPEC[]:PHASE_NN'], ['specs:SPEC[]:PHASE_NN']),
    src: ['templates/common/implementation_plan/README.md.tmpl'], also: [RT + 'phase.md'],
    d: {
      what: 'PROGRESS.md с одной активной фазой и файлы phases/PHASE_NN_*.md с чекбоксами задач. /mp --phase берёт первую неотмеченную задачу, а /mp --check сверяет план с якорями дизайна.'
    }
  });
  D('cp-feature', {
    cat: 'CP', graph: 'feature', title: '/mp --feature --next', tech: 'feature.md',
    pins: io(['>in', 'specs:SPEC[]:SPEC'], ['>then', 'files:Files[]:коммит']),
    src: [RT + 'feature.md'], also: [RT + 'contract-feature-implementation.md', RT + 'contract-risk-routing.md'],
    d: {
      what: 'Главная цепочка сборки: взять верхний SPEC с доски и довести его до пуша. Внутри — размер и маршрут риска, разработчик нужного уровня, детерминированный ревьюер, смысловое ревью с петлёй ремонта, тесты, прогон, верификатор и HARD STOP перед пушем. Всё строго последовательно.',
      order: 'Повторяется по одному SPEC за запуск; --chain (только Codex) после успеха открывает следующую задачу.'
    }
  });
  D('cp-phase', {
    cat: 'CP', graph: 'feature', title: '/mp --phase: задача из плана', tech: 'phase.md',
    pins: io(['>in', 'specs:SPEC[]:SPEC'], ['>then', 'files:Files[]:коммит']),
    src: [RT + 'phase.md'], also: [RT + 'contract-feature-implementation.md'],
    d: {
      what: 'Обёртка над той же цепочкой --feature, которая знает про план по фазам. Берёт первую неотмеченную задачу TASK-NN.k и синтезирует из неё SPEC без расспросов, но один раз показывает его и ждёт ответа «SPEC ок» (y / r / n). Пуш — по фазе, а не по задаче: «Push now» предлагается с ответом N по умолчанию, а после прогона задача отмечается галочкой в файле фазы.',
      order: 'Одна задача за запуск; после всех фаз клона — /mp --fit.'
    }
  });
  D('var-app', {
    cat: 'VA', set: true, multiIn: true, title: 'Приложение', tech: 'Kotlin/Compose',
    pins: io(['files:Files[]:коммиты'], ['files:Files[]:сборка']),
    src: ['templates/common/root/CLAUDE.md.tmpl'],
    d: {
      what: 'Код приложения «Полей меня» в git: Kotlin, Jetpack Compose, Hilt и Room, слои domain, data и presentation. Каждый прогон цепочки добавляет сюда один проверенный коммит.'
    }
  });
  D('var-refs', {
    cat: 'VA', get: true, title: 'Эталоны клона', tech: 'spec/fit/',
    pins: io([], ['refs:Screens[]:эталоны']),
    src: [SK + 'SKILL.md'], also: ['templates/spec/agents/fit-checklist-author.md'],
    d: {
      what: 'Чек-листы сходства spec/fit/<Sxx>.md, реестр экран ↔ эталонный кадр и deviations.md с намеренными отличиями. Это контракт, по которому /mp --fit сверяет собранное приложение с оригиналом.'
    }
  });
  D('mp-fit-android', mix({
    cat: 'AG', title: '/mp --fit: сверка с оригиналом', tech: 'mp-fit-android',
    model: { tier: 'opus', id: 'claude-opus-4-7' }, tools: ['Read', 'Glob', 'Grep', 'Bash'], flags: ['read-only', 'multimodal', 'device'],
    src: [TA + 'fit-android.md'], also: [RT + 'fit.md', SCO + 'pixel-diff.sh', RT + 'contract-rules-fit.md'],
    pins: io(['>in', 'build:Files[]:сборка', 'refs:Screens[]:эталоны'], ['>then', 'specs:SPEC[]:расхождения', 'score:Number:похожесть']),
    d: {
      what: 'Снимает экраны собранного приложения на эмуляторе и сравнивает с эталонами клона. Опорой служит объективное число из mp-pixel-diff.sh (100 минус нормированный RMSE), поверх него агент проходит чек-лист экрана и ищет смысловые расхождения. Каждое необъяснённое расхождение превращается в готовый SPEC для доски.',
      stops: 'Порог fitThreshold по умолчанию 85: ниже — FAIL, клон нельзя объявлять готовым. Нет телефона или эталона — экран пропускается с пометкой. SPEC-и расхождений пишутся только после гейта (y / d / n).',
      order: 'После всех фаз клона; расхождения возвращаются в /mp --feature --next, затем --fit запускается снова.'
    },
    sample: { overall_score: 78, screens: [{ screen_id: 'S04', name: 'Карточка цветка', fit_score: 71, pixel_similarity: 76.2 }], proposed_specs: [{ filename: 'fit-01-reminder-card-spacing.md' }, { filename: 'fit-02-calendar-empty-state.md' }], errors: [] }
  }, cxDev('mp-fit-android', 'gpt-5.6', 'high', 'read-only')));
  D('cp-learn', {
    cat: 'CP', graph: 'learn', title: 'Самообучение', tech: '--improve · --reflect',
    pins: io(['>in', 'spec:SPEC:SPEC', 'files:Files[]:коммит'], ['>then', 'pr:Proposal:PR']),
    src: [RT + 'contract-post-ship.md'], also: [RT + 'improve.md', RT + 'reflect.md'],
    d: {
      what: 'Хвост после каждого пуша и два режима улучшения самой фабрики. Оценка человека и уроки попадают в память проекта, а повторяющиеся проблемы — в очередь патчей к шаблонам mobile-pipeline. Смерженный PR получают все проекты при следующем обновлении плагина.'
    }
  });
  D('var-repo', {
    cat: 'VA', set: true, multiIn: true, title: 'templates/', tech: 'mobile-pipeline',
    pins: io(['pr:Proposal:PR'], ['tpl:Files[]:templates/']),
    src: ['AGENTS.md'], also: ['.github/workflows/regen-plugins.yml', 'lib/build-marketplace.sh'],
    d: {
      what: 'Сам генератор: канонические шаблоны агентов, режимов и скриптов в templates/. Из них собираются плагины mp-dev и mp-spec для маркетплейса и Codex-адаптеры. Улучшение шаблона после мержа доходит до проектов при следующем обновлении плагина.'
    }
  });
  D('ev-install', {
    cat: 'EV', title: 'Установка (раз на проект)', tech: '/plugin install',
    pins: io([], ['>then']),
    src: ['docs/USAGE.md'], also: ['docs/MARKETPLACE.md'],
    d: {
      what: 'Фабрика ставится в проект один раз: плагином из маркетплейса или генератором bootstrap.sh. Инструмент для спецификаций ставится глобально через install-spec.sh — сразу для Claude Code и для Codex.'
    }
  });
  D('sc-install', {
    cat: 'SC', title: 'Собрать конвейер в проект', tech: 'bootstrap.sh',
    pins: io(['>in', 'tpl:Files[]:templates/'], ['>then', 'route:Route:Claude | Codex']),
    src: ['bootstrap.sh', 'install-spec.sh', 'lib/build-marketplace.sh'], also: ['lib/render.sh', 'lib/sync.sh'],
    flags: ['zero-tokens'], codex: CX_SCRIPT,
    d: {
      what: 'Рендерит шаблоны под платформу, инструмент и префикс команды (--prefix обязателен, значения по умолчанию нет; mp — префикс плагинов маркетплейса): копирование, подстановка {{KEY}}, обрезка блоков platform: и tool:, переименование, память. Для Codex дополнительно появляются AGENTS.md и .codex/agents/*.toml. Скрипты кроссплатформенные: Linux, macOS и Git Bash на Windows.',
      stops: 'Сгенерированная память никогда не перезаписывается; --dry-run только показывает план.',
      order: 'Один раз на проект; плагин из маркетплейса ставится без этого шага.'
    },
    sample: 'bootstrap.sh --platform=android --prefix=mp → Platforms: android · Prefix: mp (use /mp in Claude Code) · UI language: ru'
  });
  /* compact «other modes» (header only) */
  function modeDef(key, title, tech, file, what, extra) {
    D(key, mix({ cat: 'CL', compact: true, title: title, tech: tech, pins: io([], []), src: [RT + file], d: { what: what } }, extra));
  }
  modeDef('mode-bugfix', 'Починить ошибку', '--bugfix', 'bugfix.md',
    'Та же цепочка, что и --feature, но с шагом воспроизведения: при RUNTIME_BUG конвейер сначала повторяет буквальные шаги пользователя на телефоне. После прогона исправление перепроверяется на устройстве, а верификатор может быть облегчённым только при низком риске. Открывает граф /mp --feature с пресетом bugfix.',
    { open: { graph: 'feature', preset: 'bugfix' }, inner: ['mp-verifier-lite-android'] });
  modeDef('mode-discuss', 'Обсудить без кода', '--discuss', 'discuss.md',
    'Мозговой штурм без кода: mp-architect возвращает блок BRAINSTORM с вариантами и компромиссами. По желанию результат сохраняется черновиком в .claude/specs/.',
    { inner: ['mp-architect'] });
  modeDef('mode-spec', 'SPEC-и впрок', '--spec', 'spec.md',
    'Главная сессия расспрашивает так же, как --feature, и пишет SPEC-и прямо в backlog/ со статусом draft. Кода нет, агентов нет, гейта нет: одобрение происходит позже, при --feature --next.');
  modeDef('mode-device', 'Тест на телефоне', '--device', 'device.md',
    'Один инструментальный Compose-тест для одного элемента на подключённом устройстве, затем стоп. Без телефона режим не запускается вообще.',
    { inner: ['mp-runner-instrumented-android'] });
  modeDef('mode-coverage', 'Дыры в тестах', '--coverage', 'coverage.md',
    'Диагностика только на чтение: покрытие JaCoCo по пакетам и список классов, которые стоит покрыть следующими. Ничего не меняет и ничего не блокирует.',
    { inner: ['mp-coverage-android'] });
  modeDef('mode-deliver', 'Сборка в Telegram', '--deliver', 'deliver.md',
    'Отправляет свежий APK себе в Telegram через пользовательскую сессию MTProto, поэтому лимит файла 2 ГБ, а не 50 МБ бота. Секреты лежат в .env и никогда не коммитятся.',
    { inner: ['mp-deliver-telegram.sh'] });
  modeDef('mode-upgrade', 'Обновить модели', '--upgrade', 'upgrade.md',
    'Когда выходит новое семейство моделей, mp-maintainer пересматривает поля model: во всех агентах конвейера. Изменения показываются перед записью.',
    { inner: ['mp-maintainer'] });
  modeDef('mode-continue', 'Что дальше?', '--continue', 'continue.md',
    'Единая точка возврата: смотрит active/, PROGRESS.md, backlog/ и состояние клона и предлагает следующий шаг конвейера. До согласия человека только читает.');
  modeDef('mode-check', 'План цел?', '--check', 'check.md',
    'Сверяет PROGRESS, файлы фаз и якоря дизайна: одна активная фаза, есть неотмеченные задачи, хэши разделов не уехали. Ничего не исправляет — только перечисляет, что починить.');

  /* ===== /mp-spec ===== */
  D('in-spec', {
    cat: 'IN', title: 'Вход: /mp-spec', tech: 'SKILL.md · Step 0',
    pins: io([], ['>then', 'idea:Idea:идея', 'screens:Screens[]:скриншоты', 'apk:Files:APK']),
    src: [SK + 'SKILL.md'],
    d: { what: 'Вход свёрнутого графа. Сюда приходят идея, скриншоты и APK с узла /mp-spec в обзоре.' }
  });
  D('sw-mode', {
    cat: 'SW', title: 'Режим (Step 0)', tech: 'clone | greenfield | feature',
    pins: io(['>in'], ['>clone:clone', '>green:greenfield', '>feature:feature']),
    src: [SK + 'SKILL.md'],
    d: { what: 'Step 0 разбирает аргументы и выбирает режим: скриншоты, --apk или --play — clone, --greenfield — с нуля, --feature — фича в готовый проект. Клон по умолчанию идёт с глубиной reference, то есть с чек-листами сходства и последующей сверкой --fit.' }
  });
  D('crawl-trio', {
    cat: 'CL', title: 'Робот-обход (опц.)', tech: 'crawl ×3 · scripts/crawl/',
    cond: 'если --apk + телефон',
    pins: io(['>in', 'screens:Screens[]:скриншоты', 'apk:Files:APK'], ['>then', 'states:Screens[]:кадры экранов']),
    src: [SK + 'SKILL.md'], also: ['docs/REFERENCE-CRAWLER.md', SK + 'scripts/crawl/_crawl-lib.sh'],
    inner: ['crawl-navigator', 'crawl-executor', 'crawl-reviewer',
      { tech: 'device-preflight.sh', src: SK + 'scripts/crawl/device-preflight.sh', note: 'ровно один запущенный телефон + геометрия' },
      { tech: 'app-control.sh', src: SK + 'scripts/crawl/app-control.sh', note: 'install / clear / launch / stop' },
      { tech: 'screencap.sh', src: SK + 'scripts/crawl/screencap.sh', note: 'снимок экрана в PNG' },
      { tech: 'ui-dump.sh', src: SK + 'scripts/crawl/ui-dump.sh', note: 'дерево view в XML' },
      { tech: 'input.sh', src: SK + 'scripts/crawl/input.sh', note: 'нажатия, ввод, свайпы' },
      { tech: 'element-manifest.sh', src: SK + 'scripts/crawl/element-manifest.sh', note: 'все интерактивные элементы' },
      { tech: 'bounds-to-dp.sh', src: SK + 'scripts/crawl/bounds-to-dp.sh', note: 'точные размеры в dp' }],
    d: {
      what: 'Необязательный шаг клона: робот сам ходит по оригинальному приложению на эмуляторе. Три агента в отдельных сессиях — навигатор выбирает цель, исполнитель нажимает, ревьюер засчитывает шаг — плюс семь скриптов в scripts/crawl/. Результат — наблюдённые кадры состояний и граф переходов вместо догадок по скриншотам.',
      stops: 'Нет телефона или APK не ставится — шаг пропускается, дальше идут скриншоты пользователя. Цикл останавливается, когда навигатор говорит done, покрытие не растёт 4 итерации подряд или исчерпан бюджет 40/25/60.'
    }
  });
  D('par-a', {
    cat: 'PA', title: 'Одновременно ×4', tech: 'A-clone fan-out',
    pins: io(['>in'], ['>a0:Play', '>a1:логика', '>a2:стиль', '>a3:APK']),
    src: [SK + 'SKILL.md'],
    d: { what: 'Четыре анализатора стартуют одним сообщением и работают одновременно. Их JSON сливается в 00_meta.yaml по таблице приоритетов: точные данные из APK побеждают догадки по картинкам.' }
  });
  D('play-store-scraper', mix({
    cat: 'AG', title: 'Прочитать Google Play', tech: 'play-store-scraper',
    model: { tier: 'haiku', id: 'haiku' },
    tools: ['mcp__Claude_in_Chrome__navigate', 'mcp__Claude_in_Chrome__read_page', 'mcp__Claude_in_Chrome__get_page_text', 'mcp__Claude_in_Chrome__find', 'mcp__Claude_in_Chrome__javascript_tool', 'mcp__Claude_in_Chrome__list_connected_browsers', 'mcp__Claude_in_Chrome__tabs_create_mcp', 'Read', 'Write', 'Bash'],
    flags: ['parallel', 'network'],
    src: [TS + 'play-store-scraper.md'],
    pins: io(['>in', 'idea:Idea:ссылка Play'], ['>then', 'meta:Report:карточка Play']),
    d: {
      what: 'Открывает страницу приложения в Google Play через Chrome MCP и вытаскивает название, категорию, рейтинг, описание, отзывы и признаки рекламы и покупок. Самая дешёвая модель: задача механическая.',
      stops: 'Chrome MCP недоступен или страница не открылась — анализ продолжается без карточки (--skip-play), это не блокер.',
      order: 'Одновременно с тремя другими анализаторами клона.'
    },
    sample: { name: 'Полей меня', category: 'Дом и сад', rating: 4.6, downloads: '10K+', has_ads: false, has_iap: false, features_inferred: ['напоминания о поливе', 'календарь полива'], reviews_scraped_count: 10 }
  }, cxSpec('play-store-scraper', 'gpt-5.4-mini', 'low')));
  D('screenshot-business-analyzer', mix({
    cat: 'AG', title: 'Логика по скриншотам', tech: 'screenshot-business-analyzer',
    model: { tier: 'opus', id: 'opus' }, tools: ['Read', 'Glob', 'Write', 'Bash'], flags: ['parallel', 'multimodal'],
    src: [TS + 'screenshot-business-analyzer.md'],
    pins: io(['>in', 'shots:Screens[]:скриншоты'], ['>then', 'screens:Report:экраны, правила', 'amb:Checklist:ambiguities[]']),
    d: {
      what: 'Самая сильная модель разглядывает каждый снимок: тип экрана, назначение, блоки, кнопки, поля, взаимодействия и уверенность. Отдельно возвращает ambiguities[] — что по картинкам не понять — и state_gaps[] — состояния, которые приложение имеет, но их не сняли.',
      stops: 'Больше 50 скриншотов — предупреждение о стоимости и предложение взять подмножество.',
      order: 'Одновременно с Google Play, стилем и APK.'
    },
    sample: { screens_total: 14, screens_unique: 9, screens: [{ id: 'S04', type: 'detail', purpose_ru: 'Карточка цветка с напоминанием о поливе', confidence: 0.92 }], ambiguities: ['S07: что будет, если полив пропущен?'], state_gaps: ['S02: пустой список цветов'] }
  }, cxSpec('screenshot-business-analyzer', 'gpt-5.6', 'high')));
  D('screenshot-style-analyzer', mix({
    cat: 'AG', title: 'Цвета, шрифты, отступы', tech: 'screenshot-style-analyzer',
    model: { tier: 'opus', id: 'opus' }, tools: ['Read', 'Glob', 'Write', 'Bash'], flags: ['parallel', 'multimodal'],
    src: [TS + 'screenshot-style-analyzer.md'],
    pins: io(['>in', 'shots:Screens[]:скриншоты'], ['>then', 'tokens:Report:токены стиля']),
    d: {
      what: 'Снимает визуальный язык: палитру светлой и тёмной темы, типографику, отступы, скругления, тени и стиль иконок, плюс пары цветов с плохим контрастом. Из этого позже собирается design-tokens.json, который ui-designer превращает в тему без ручного Theme Builder.',
      stops: 'Не выдумывает точность: цвет приближается к ближайшему правдоподобному hex, сомнения уходят в вопросы.',
      order: 'Одновременно с остальными анализаторами клона.'
    },
    sample: { design_style: 'material-3', design_style_confidence: 0.85, palette: { primary: '#2E7D32', secondary: '#6D4C9F', background: '#FFFBF5' }, dark_theme_detected: true }
  }, cxSpec('screenshot-style-analyzer', 'gpt-5.6', 'high')));
  D('apk-analyzer', mix({
    cat: 'AG', title: 'Точные данные из APK', tech: 'apk-analyzer',
    model: { tier: 'sonnet', id: 'sonnet' }, tools: ['Read', 'Glob', 'Grep', 'Write', 'Bash'], flags: ['parallel'],
    cond: 'если --apk',
    src: [TS + 'apk-analyzer.md'],
    pins: io(['>in', 'apk:Files:APK'], ['>then', 'manifest:Report:манифест, цвета']),
    d: {
      what: 'Распаковывает APK (apktool, jadx) и достаёт истину: пакет, SDK, разрешения, deep links, точные colors.xml и strings.xml, размеры и библиотеки. Эти значения побеждают оценки по скриншотам везде, где пересекаются.',
      stops: 'Форматы .aab/.apks/.xapk отклоняются с подсказкой, как извлечь APK. Нет инструментов — стратегия деградирует и перечисляет tools_missing.',
      order: 'Одновременно с остальными; пропускается без --apk.'
    },
    sample: { extraction_strategy: 'A', tools_used: ['apktool', 'jadx'], package: 'app.poleimenya', min_sdk: 26, target_sdk: 34, permissions: ['android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED'] }
  }, cxSpec('apk-analyzer', 'gpt-5.4', 'medium')));
  D('join-a', {
    cat: 'JN', title: 'Ждать всех ×4', tech: 'join',
    pins: io(['>i0:Play', '>i1:бизнес', '>i2:стиль', '>i3:APK'], ['>then']),
    src: [SK + 'SKILL.md'],
    d: { what: 'Дальше идти можно только когда вернулись все запущенные анализаторы. Пропущенный по условию APK считается завершённым.' }
  });
  D('navigation-flow-analyzer', mix({
    cat: 'AG', title: 'Карта переходов', tech: 'navigation-flow-analyzer',
    model: { tier: 'sonnet', id: 'sonnet' }, tools: ['Read', 'Write', 'Bash'],
    src: [TS + 'navigation-flow-analyzer.md'],
    pins: io(['>in', 'screens:Report:экраны', 'meta:Report:карточка Play', 'manifest:Report:манифест'], ['>then', 'nav:Report:граф навигации']),
    d: {
      what: 'Строит граф навигации: корневые пункты нижнего меню, экраны авторизации, модальные окна, переходы с типом push/replace, deep links и правила back stack. Если работал робот-обход, наблюдённые переходы получают source:observed и уверенность 1.0 вместо догадок.',
      stops: 'Переход без улик получает низкую уверенность и source:inferred; наблюдённые роботом переходы всегда важнее догадок. Агент, упавший трижды, помечается в 00_meta.yaml, и работа продолжается, если возможно.',
      order: 'Последовательно после всех четырёх анализаторов.'
    },
    sample: { root_destinations: [{ screen_id: 'S02', label_ru: 'Мои цветы', icon: 'local_florist' }, { screen_id: 'S06', label_ru: 'Календарь', icon: 'calendar_month' }], edges: [{ from: 'S02', to: 'S04', trigger: 'tap_list_item', type: 'push', confidence: 1.0, source: 'observed' }] }
  }, cxSpec('navigation-flow-analyzer', 'gpt-5.4', 'medium')));
  D('data-model-extractor', mix({
    cat: 'AG', title: 'Сущности и поля', tech: 'data-model-extractor',
    model: { tier: 'sonnet', id: 'sonnet' }, tools: ['Read', 'Write', 'Bash'],
    src: [TS + 'data-model-extractor.md'],
    pins: io(['>in', 'nav:Report:граф навигации'], ['>then', 'model:Report:сущности']),
    d: {
      what: 'Выводит нейтральную модель данных: сущности с первичными ключами и полями, связи с кардинальностью и стратегию кеширования. Каждое поле ссылается на экран, где его видно.',
      stops: 'Поле без экрана-источника не придумывается. Трижды упавший агент помечается в 00_meta.yaml.',
      order: 'Сразу после карты переходов.'
    },
    sample: { entities: [{ name: 'Plant', purpose_ru: 'Цветок в коллекции', cache_strategy: 'room' }, { name: 'WateringReminder', purpose_ru: 'Расписание полива', cache_strategy: 'room' }], relations: [{ from: 'WateringReminder', to: 'Plant', cardinality: 'many_to_one', kind: 'belongs_to', fk_field: 'plantId' }] }
  }, cxSpec('data-model-extractor', 'gpt-5.4', 'high')));
  D('gt-questions', {
    cat: 'HG', gate: 'always', badge: gates.always, title: 'Вопросы A–E + grill', tech: 'clone.batchA–E',
    pins: io(['>in', 'amb:Checklist:неясности'], ['>then', 'ans:Idea:ответы']),
    src: [SK + 'prompts/techniques/grill-me.md'], also: [SK + 'prompts/questions/clone.batchA.md', SK + 'prompts/questions/clone.batchE.md'],
    codex: CX_GATE,
    d: {
      what: 'Пять пакетов вопросов по клону, не больше четырёх в пакете. Если анализаторы вернули неясности, вместо плоского пакета B идёт grill: по одному вопросу, сначала верхние решения, у каждого рекомендованный ответ из улик. Отложенное помечается (assumption) и всплывает на GATE 1.',
      human: 'Всегда ждёт ответов; флаг --no-grill отключает только допрос по дереву решений.'
    }
  });
  D('gt-grill', {
    cat: 'HG', gate: 'always', badge: gates.always, title: 'Grill: дерево решений', tech: 'grill-me.md',
    pins: io(['>in', 'idea:Idea:идея'], ['>then', 'dec:Idea:решения']),
    src: [SK + 'prompts/techniques/grill-me.md'], codex: CX_GATE,
    d: {
      what: 'Для приложения с нуля первым идёт допрос: идея разбирается как дерево решений, корни — аудитория, главная работа и что точно вне рамок — раньше веток. По одному вопросу с рекомендованным ответом; скрытые допущения, противоречия и забытые состояния становятся следующими вопросами. Итог — журнал input/interview/grill.md.',
      human: 'Всегда ждёт ответов.'
    }
  });
  D('gt-interview', {
    cat: 'HG', gate: 'always', badge: gates.always, title: 'Интервью: 5 этапов', tech: 'stage1…stage5',
    pins: io(['>in', 'dec:Idea:решения grill'], ['>then', 'ans:Idea:ответы этапов']),
    src: [SK + 'prompts/questions/greenfield.stage1-vision.md'], also: [SK + 'prompts/questions/greenfield.stage5-posture.md'],
    codex: CX_GATE,
    d: {
      what: 'Пять этапов от широкого к узкому, не больше четырёх вопросов в каждом: видение, экраны, потоки, данные, позиция по доступности, языкам, приватности и аналитике. Модель предлагает варианты, человек правит — это защищает от выдумок на тонкой идее.',
      human: 'Всегда ждёт ответов.'
    }
  });
  D('g-gate1', {
    cat: 'HG', gate: 'always', badge: gates.always, title: 'GATE 1: инвентарь верен?', tech: 'Step 3',
    pins: io(['>in', 'a:Report:инвентарь клона', 'ans:Idea:ответы A–E', 'g:Idea:интервью', 'tokens:Report:токены стиля'],
      ['>ok:всё верно', 'inv:SpecBundle:инвентарь']),
    src: [SK + 'prompts/schemas/feature-inventory.schema.json'], also: [SK + 'SKILL.md'], codex: CX_GATE,
    d: {
      what: 'Обе ветки приносят инвентарь: экраны, фичи, роли, сущности и интеграции с источником и уверенностью. Человек видит таблицу с подсвеченными сомнительными строками и отвечает: всё верно, убрать лишнее, добавить недостающее или объединить дубли. Ничего дальше не запускается, пока инвентарь не подтверждён.',
      human: 'Всегда ждёт: первое из четырёх «да» человека.'
    }
  });
  D('var-inv', {
    cat: 'VA', set: true, title: 'Инвентарь', tech: 'inventory.json',
    pins: io(['inv:SpecBundle:инвентарь'], ['inv:SpecBundle:инвентарь']),
    src: [SK + 'SKILL.md'],
    d: { what: 'Подтверждённый инвентарь в нейтральном формате и компактный пакет улик evidence/core.json. Специалисты получают этот пакет и одну свою рубрику, а не весь чат и не чужие отчёты.' }
  });
  D('constitution-author', mix({
    cat: 'AG', title: 'Свод правил проекта', tech: 'constitution-author',
    model: { tier: 'haiku', id: 'haiku' }, tools: ['Read', 'Glob', 'Write'], flags: ['no-bash'],
    src: [TS + 'constitution-author.md'], also: [SK + 'prompts/templates/constitution.tmpl.md'],
    pins: io(['>in', 'inv:SpecBundle:инвентарь'], ['>then', 'doc:SpecBundle:constitution.md']),
    d: {
      what: 'Пишет spec/constitution.md — принципы и стандарты, которым должны подчиняться все остальные документы. Если у проекта уже есть CLAUDE.md и память, свод выводится из них и не спорит с ними.',
      stops: 'Нет CLAUDE.md у целевого проекта — работает как для нового приложения и честно ставит defaults_used:true. Корпоративные соглашения не копирует.',
      order: 'Первым в фазе C, сразу после GATE 1.'
    },
    sample: { principles_count: 14, sources: ['CLAUDE.md'], defaults_used: false, fetch_error: null }
  }, cxSpec('constitution-author', 'gpt-5.4-mini', 'medium')));
  D('ms-brief', {
    cat: 'MS', title: 'product-brief.md', tech: 'product-brief',
    pins: io(['>in', 'doc:SpecBundle:constitution.md'], ['>then', 'doc:SpecBundle:product-brief.md']),
    src: [SK + 'SKILL.md'], codex: CX_MAIN,
    d: { what: 'Главная сессия сама пишет продуктовый бриф: проблема, аудитория, уникальная ценность, конкуренты, метрики успеха и монетизация. Отдельного агента нет — это сводка по инвентарю и ответам.' }
  });
  D('requirements-author', mix({
    cat: 'AG', title: 'Требования EARS: FR-NNN', tech: 'requirements-author',
    model: { tier: 'sonnet', id: 'sonnet' }, tools: ['Read', 'Write', 'Bash'],
    src: [TS + 'requirements-author.md'], also: [SK + 'prompts/rubrics/ears-requirements.md'],
    pins: io(['>in', 'doc:SpecBundle:product-brief.md'], ['>then', 'doc:SpecBundle:requirements.md']),
    d: {
      what: 'Пишет проверяемые требования в формате EARS с номерами FR-NNN: WHEN событие, THE SYSTEM SHALL поведение. Каждое требование ссылается на экран и сущность; ничем не подкреплённое попадает в ungrounded[].',
      stops: 'Требование без источника не пишется молча: оно попадает в ungrounded[], а критик считает необоснованное требование блокером.',
      order: 'Последовательно: после брифа, перед историями.'
    },
    sample: { frs: [{ id: 'FR-007', ears: 'WHEN the watering time of a plant arrives, THE SYSTEM SHALL show the notification «Фиалка хочет пить. Пора полить!»', pattern: 'event-driven', screens: ['S04'], entities: ['WateringReminder'] }], cross_cutting_count: 4, ungrounded: [], ambiguities: [], fetch_error: null }
  }, cxSpec('requirements-author', 'gpt-5.4', 'high')));
  D('user-story-writer', mix({
    cat: 'AG', title: 'Истории: US-NNN', tech: 'user-story-writer',
    model: { tier: 'sonnet', id: 'sonnet' }, tools: ['Read', 'Write'], flags: ['no-bash'],
    src: [TS + 'user-story-writer.md'],
    pins: io(['>in', 'doc:SpecBundle:requirements.md'], ['>then', 'doc:SpecBundle:user-stories.md']),
    d: {
      what: 'Превращает требования в пользовательские истории US-NNN: роль, желание, польза, ссылки на FR и экраны. Требования без истории перечисляются в coverage_gaps[] и позже видны человеку на GATE 2.',
      stops: 'Дыры не прячет: требования без истории возвращаются списком coverage_gaps[].',
      order: 'После требований, перед приёмкой.'
    },
    sample: { stories: [{ id: 'US-004', role: 'user', want: 'получать напоминание о поливе', so_that: 'цветы не засыхали', fr_ids: ['FR-007'], screen_ids: ['S04'] }], coverage_gaps: [], fetch_error: null }
  }, cxSpec('user-story-writer', 'gpt-5.4', 'high')));
  D('acceptance-criteria-writer', mix({
    cat: 'AG', title: 'Приёмка: Gherkin', tech: 'acceptance-criteria-writer',
    model: { tier: 'sonnet', id: 'sonnet' }, tools: ['Read', 'Write'], flags: ['no-bash'],
    src: [TS + 'acceptance-criteria-writer.md'], also: [SK + 'prompts/rubrics/gherkin-acceptance.md'],
    pins: io(['>in', 'doc:SpecBundle:user-stories.md'], ['>then', 'doc:SpecBundle:*.feature']),
    d: {
      what: 'Пишет сценарии приёмки на Gherkin в acceptance/*.feature, не привязанные к интерфейсу: только поведение, видимое человеку, без Compose и тестовых фреймворков. Покрывает матрицу состояний: успех, ошибка, пусто, валидация.',
      stops: 'Непроверяемые истории и истории без сценария перечисляются явно; если автор пропустил — критик вернёт работу именно ему.',
      order: 'После историй; последний автор в фазе C.'
    },
    sample: { features: [{ file: 'acceptance/reminders.feature', feature: 'Watering reminders', scenarios: 6, us_ids: ['US-004'], fr_ids: ['FR-007', 'FR-008'], states_covered: ['happy', 'error', 'empty'] }], untestable_stories: [], stories_without_scenario: [], fetch_error: null }
  }, cxSpec('acceptance-criteria-writer', 'gpt-5.4', 'high')));
  D('ms-design', {
    cat: 'MS', title: 'design.md + android.md', tech: 'design.tmpl.md',
    pins: io(['>in', 'doc:SpecBundle:*.feature'], ['>then', 'doc:SpecBundle:design.md']),
    src: [SK + 'prompts/templates/design.tmpl.md'], also: [SK + 'prompts/templates/platform.android.tmpl.md'], codex: CX_MAIN,
    d: { what: 'Главная сессия собирает платформенно-нейтральный design.md: архитектура, навигация, модель данных, поведение экранов и бизнес-правила. Всё про Compose, Hilt, Room и minSdk уходит только в platform/android.md, а design-tokens.json получает точные значения из APK с пометкой provenance.' }
  });
  D('par-e', {
    cat: 'PA', title: 'Одновременно ×6', tech: 'quality-plan.json',
    pins: io(['>in'], ['>e0:NFR', '>e1:доступность', '>e2:риски', '>e3:безопасность', '>e4:аналитика', '>e5:чек-листы fit']),
    src: [SK + 'SKILL.md'],
    d: { what: 'Сначала пишется quality-plan.json: кого звать и почему. NFR, доступность и риски — всегда, безопасность и аналитика — по условиям, чек-листы сходства — только для клона; все выбранные стартуют одним сообщением. Пропущенный вызов не означает пропущенный документ: главная сессия пишет явное «не применимо».' }
  });
  function specE(key, title, tech, file, pinOut, what, stops, sample, cx, extra) {
    D(key, mix({
      cat: 'AG', title: title, tech: tech,
      model: { tier: 'sonnet', id: 'sonnet' }, tools: ['Read', 'Write'], flags: ['parallel', 'no-bash'],
      src: [TS + file],
      pins: io(['>in', 'ev:SpecBundle:пакет улик'], ['>then', pinOut]),
      d: { what: what, stops: stops, order: 'Одновременно с остальными специалистами фазы E; каждый читает только пакет улик и свою рубрику.' },
      sample: sample
    }, cx, extra));
  }
  specE('nfr-analyzer', 'NFR: числа', 'nfr-analyzer', 'nfr-analyzer.md', 'doc:SpecBundle:nfr.md',
    'Выводит нефункциональные требования с измеримыми порогами: холодный старт, отклик, батарея, офлайн. Всё, чему нельзя приписать число, уходит в unmeasurable[] — критик считает расплывчатые NFR блокером.',
    'Порог, который нельзя назвать числом, уходит в unmeasurable[]: его надо уточнить или убрать. Нет инвентаря — fetch_error вместо выдуманных чисел.',
    { nfrs: [{ id: 'NFR-003', category: 'reliability', statement: 'reminder delivery time', threshold: '<= 60 s after the scheduled minute (p95)', source: 'posture' }], unmeasurable: [], fetch_error: null },
    cxSpec('nfr-analyzer', 'gpt-5.4', 'medium'), { also: [SK + 'prompts/rubrics/nfr-categories.md'] });
  specE('a11y-reviewer', 'Доступность', 'a11y-reviewer', 'a11y-reviewer.md', 'doc:SpecBundle:a11y.md',
    'Закладывает доступность по WCAG 2.2 AA для каждого интерактивного экрана: подписи, размеры целей, контраст, порядок фокуса. Экраны, которые не удалось покрыть, перечисляются в screens_uncovered[].',
    'Непокрытые экраны возвращаются списком, критик предупреждает о дырах. Пары цветов с плохим контрастом идут отдельным списком contrast_risks[].',
    { a11y: [{ id: 'A11Y-004', screen_id: 'S04', requirement: 'reminder toggle exposes state and time in its content description', wcag_ref: '4.1.2' }], contrast_risks: [], screens_uncovered: [], fetch_error: null },
    cxSpec('a11y-reviewer', 'gpt-5.4', 'medium'), { also: [SK + 'prompts/rubrics/a11y-wcag22.md'] });
  specE('risk-estimator', 'Риски + оценка', 'risk-estimator', 'risk-estimator.md', 'doc:SpecBundle:риски + оценка',
    'Пишет сразу два документа: реестр рисков с вероятностью, влиянием и смягчением и относительную оценку объёма по эпикам. Каждый риск привязан к улике — интеграции, порогу NFR или новому компоненту, без общих фраз.',
    'Риск без улики не записывается; нет входных данных — fetch_error вместо общих слов о сроках.',
    { risks: [{ id: 'RISK-002', risk: 'Doze mode delays exact reminders', likelihood: 'M', impact: 'H', mitigation: 'WorkManager + exact alarm fallback; test with adb deviceidle' }], estimates: [{ epic: 'reminders', tshirt: 'M', rationale: 'scheduling + reboot restore + notification channel' }], fetch_error: null },
    cxSpec('risk-estimator', 'gpt-5.4', 'medium'));
  specE('security-privacy-reviewer', 'Данные, права, приватность', 'security-privacy-reviewer', 'security-privacy-reviewer.md', 'doc:SpecBundle:безопасность',
    'Классифицирует данные, решает, где нужно согласие, и требует обоснование для каждого разрешения. Без авторизации, сети, личных данных и внешних SDK агент не вызывается: главная сессия пишет явный документ «низкий риск».',
    'Разрешение, которое не удалось привязать к фиче, уходит в permissions_to_justify[] на проверку человеку.',
    { sec: [{ id: 'SEC-002', control: 'reminder schedule stays on device; no network sync', source: 'posture' }], priv: [{ id: 'PRIV-001', data: 'plant photos', class: 'personal', consent: 'not_required' }], permissions_to_justify: [{ capability: 'post notifications', reason: 'S04 watering reminder' }], consent_required: false, fetch_error: null },
    cxSpec('security-privacy-reviewer', 'gpt-5.4', 'medium'), { cond: 'данные / права / сеть', also: [SK + 'prompts/rubrics/security-privacy-checklist.md'] });
  specE('analytics-taxonomy-designer', 'События аналитики', 'analytics-taxonomy-designer', 'analytics-taxonomy-designer.md', 'doc:SpecBundle:analytics.md',
    'Проектирует таксономию событий, каждое привязано хотя бы к одной истории, свойства — без сырых личных данных. Если аналитика не нужна, пишется явный документ analytics: disabled с причиной.',
    'События без истории попадают в orphan_events[]; сырые личные данные в свойства событий не пишутся.',
    { events: [{ id: 'EVT-002', name: 'reminder_fired', type: 'system', trigger: 'watering time reached', props: ['plant_kind'], us_ids: ['US-004'] }], orphan_events: [], fetch_error: null },
    cxSpec('analytics-taxonomy-designer', 'gpt-5.4', 'medium'), { cond: 'нужна аналитика', also: [SK + 'prompts/rubrics/analytics-taxonomy.md'] });
  D('fit-checklist-author', mix({
    cat: 'AG', title: 'Чек-листы сходства', tech: 'fit-checklist-author',
    model: { tier: 'opus', id: 'opus' }, tools: ['Read', 'Glob', 'Write'], flags: ['parallel', 'multimodal', 'no-bash'],
    cond: 'только клон',
    src: [TS + 'fit-checklist-author.md'],
    pins: io(['>in', 'ev:SpecBundle:пакет улик'], ['>then', 'doc:SpecBundle:fit/<Sxx>.md']),
    d: {
      what: 'Для каждого экрана клона пишет чек-лист «обязано совпасть»: визуальные строки и поведение, каждая опирается на свой эталонный кадр. Плюс реестр fit/registry.csv и заготовка deviations.md для намеренных отличий. Это контракт для будущей сверки /mp --fit.',
      stops: 'Экран без эталона или с сомнительным соответствием уходит в screens_uncovered[] и low_confidence_maps[] — их видно на GATE 2.',
      order: 'Одновременно с остальными специалистами фазы E, только при глубине reference.'
    },
    sample: { screens: [{ screen_id: 'S04', reference_image: '05.png', states_covered: ['empty', 'filled'], visual_rows: 7, behavioural_rows: 3, match_confidence: 'high' }], registry: 'spec/fit/registry.csv', deviations: 'spec/deviations.md', screens_uncovered: [], low_confidence_maps: [] }
  }, cxSpec('fit-checklist-author', 'gpt-5.6', 'high')));
  D('join-e', {
    cat: 'JN', title: 'Дождаться всех', tech: 'join',
    pins: io(['>i0:NFR', '>i1:доступность', '>i2:риски', '>i3:безопасность', '>i4:аналитика', '>i5:fit'], ['>then']),
    src: [SK + 'SKILL.md'],
    d: { what: 'Фаза E закончена, когда вернулся каждый запущенный специалист. Пропущенные по quality-plan.json считаются завершёнными с явной причиной.' }
  });
  D('spec-preflight.sh', {
    cat: 'SC', title: 'Механика: ID, ссылки, файлы', tech: 'spec-preflight.sh',
    pins: io(['>in', 'bundle:SpecBundle:spec/'], ['>pass:pass', '>fail:fail', 'report:Report:eval-preflight.json']),
    src: [SK + 'scripts/spec-preflight.sh'], flags: ['zero-tokens'], codex: CX_SCRIPT,
    d: {
      what: 'Детерминированные проверки бандла до дорогого критика: обязательные файлы на месте, ID не дублируются, ссылки FR ↔ US ↔ сценарии не битые, JSON валиден. Механическая ошибка идёт прямо владельцу документа, не тратя вызов сильной модели.',
      stops: 'pass:false — сразу к владельцу; критик не вызывается.',
      order: 'После фазы E и после каждого исправления владельцем.'
    },
    sample: { ok: true, pass: true, clone: true, required_files: 19, feature_files: 5, fr_count: 24, us_count: 11, blocker_count: 0, blockers: [] }
  });
  D('spec-evaluator', mix({
    cat: 'AG', title: 'Критик: 5 классов проверок', tech: 'spec-evaluator', badge: 'не правит бандл',
    model: { tier: 'opus', id: 'opus' }, tools: ['Read', 'Glob', 'Grep', 'Write'], flags: ['no-bash'],
    src: [TS + 'spec-evaluator.md'], also: [SK + 'prompts/rubrics/evaluator-rubric.md'],
    pins: io(['>in', 'bundle:SpecBundle:spec/', 'mech:Report:preflight'], ['>pass:pass', '>fail:fail', 'findings:Findings[]:findings', 'trace:SpecBundle:traceability.csv']),
    d: {
      what: 'Строгий критик читает весь бандл по пяти классам: согласованность документов, обоснованность, полнота, противоречия своду правил и покрытие всех кнопок оригинала. Пишет только traceability.csv и eval_report.md — сами документы не трогает. У каждой находки есть owner_agent, которому её вернут.',
      stops: 'Любой blocker — к владельцу, не больше двух кругов; потом стоп и вопрос человеку. warn и info не блокируют, а уходят в risks.md с пометкой (assumption). В клоне orphan_screen и state_coverage_gap становятся блокерами.',
      order: 'После механической проверки; в режиме --feature — облегчённая проверка эпика.',
      caps: ['Не правит документы бандла; пишет только traceability.csv и eval_report.md']
    },
    sample: { verdict: 'pass', retry: 0, findings: [], coverage: { fr_total: 24, fr_without_coverage: [], story_without_scenario: [], state_coverage_gaps: [] }, traceability_rows: 24, fetch_error: null }
  }, cxSpec('spec-evaluator', 'gpt-5.6', 'xhigh')));
  D('ms-owner', {
    cat: 'MS', title: 'Вернуть владельцу (≤2 круга)', tech: 'owner_agent',
    pins: io(['>in', 'findings:Findings[]:findings', 'mech:Report:preflight'], ['>retry:повтор', '>spent:бюджет вышел']),
    src: [SK + 'SKILL.md'], codex: CX_MAIN,
    related: ['fn-req', 'fn-stories', 'fn-ac', 'fn-design', 'fn-nfr', 'fn-a11y', 'fn-sec', 'fn-analytics', 'fn-const'],
    d: {
      what: 'Главная сессия разбирает finding.owner_agent и перезапускает только владельцев с провалившимися классами проверок. Остальные документы не пересобираются.',
      stops: 'Не больше двух повторов; дальше — стоп, показать оставшиеся блокеры и спросить человека.'
    }
  });
  D('end-ask', {
    cat: 'END', title: 'Стоп: спросить человека', tech: 'residual blockers',
    pins: io(['>in'], []), src: [SK + 'SKILL.md'],
    d: { what: 'После двух кругов критик всё ещё находит блокеры. Конвейер показывает их и ждёт указаний, а не правит бесконечно.' }
  });
  D('g-gate2', {
    cat: 'HG', gate: 'always', badge: gates.always, title: 'GATE 2: принять бандл?', tech: 'Step 9',
    pins: io(['>in', 'trace:SpecBundle:traceability.csv'], ['>ok:принять', 'bundle:SpecBundle:spec/']),
    src: [SK + 'SKILL.md'], codex: CX_GATE,
    d: {
      what: 'Человек видит вердикт, статистику покрытия и явные нумерованные списки дыр: требования без покрытия, истории без сценариев, непокрытые состояния и экраны. Варианты: принять и передать в разработку, внести правки или принять с зафиксированными рисками.',
      human: 'Всегда ждёт: второе «да» — за весь чертёж.'
    }
  });
  D('out-spec', {
    cat: 'RT', title: 'spec/ → /mp --plan', tech: 'Step 10 · handoff',
    pins: io(['>in', 'bundle:SpecBundle:spec/'], []),
    src: [SK + 'SKILL.md'],
    d: { what: 'Бандл готов и передаётся в разработку: /mp --plan или /mp --plan --phases. Для клона печатается ещё шаг с design-tokens.json и напоминание запустить /mp --fit после сборки экранов.' }
  });
  D('grounding-scout', mix({
    cat: 'AG', title: 'Разведка кода ×3', tech: 'grounding-scout',
    model: { tier: 'haiku', id: 'haiku' }, tools: ['Read', 'Glob', 'Grep', 'Bash'], flags: ['read-only', 'parallel'],
    instances: 3,
    src: [TS + 'grounding-scout.md'], also: [SK + 'prompts/techniques/grounding.md'],
    pins: io(['>in', 'idea:Idea:описание фичи'], ['>then', 'facts:Report:G# факты']),
    d: {
      what: 'До трёх дешёвых разведчиков одновременно читают готовый проект, у каждого свой фокус: навигация и точки входа, сигнатуры domain/data и соглашения, формат доски SPEC и подводные камни тестов. Каждый возвращает факты с file:line, без пересказа файлов. Главная сессия собирает из них grounding.md.',
      stops: 'Факт без ссылки на строку не считается фактом. Если харнесс не умеет запускать разведчика, тот же обход делается в основной сессии.',
      order: 'Первый шаг режима --feature, до вопросов.'
    },
    sample: { focus: 'domain/data signatures + conventions', facts: [{ id: 'G1', kind: 'signature', fact: 'PlantRepository.observePlants(): Flow<List<Plant>>', ref: 'data/plant/PlantRepository.kt:12 observePlants' }], spec_format: null, notes: null }
  }, cxSpec('grounding-scout', 'gpt-5.4-mini', 'medium')));
  D('gt-grill-f', {
    cat: 'HG', gate: 'always', badge: gates.always, title: 'Grill фичи', tech: 'grill-me.md',
    pins: io(['>in', 'facts:Report:G# факты'], ['>then', 'dec:Idea:решения']),
    src: [SK + 'prompts/techniques/grill-me.md'], codex: CX_GATE,
    d: { what: 'Тот же допрос по дереву решений, но на входе описание фичи и проверенные факты о коде. Бюджет вопросов зависит от неясности: простой фиче хватает одного подтверждения. Решения становятся зафиксированными решениями эпика.', human: 'Всегда ждёт ответов.' }
  });
  D('gt-decompose', {
    cat: 'HG', gate: 'always', badge: gates.always, title: 'GATE 1 фичи: разбиение', tech: 'decompose.md',
    pins: io(['>in', 'dec:Idea:решения'], ['>ok:подтвердить', 'plan:SPEC[]:decomposition']),
    src: [SK + 'prompts/questions/feature.decompose.md'], codex: CX_GATE,
    d: { what: 'Предлагается упорядоченный набор SPEC-ов с зависимостями и пометками о правке одного файла. Подтверждение разбиения и есть первый гейт режима --feature.', human: 'Всегда ждёт.' }
  });
  D('ms-emit', {
    cat: 'MS', title: 'Эпик: 00-overview + NN', tech: 'Step F',
    pins: io(['>in', 'plan:SPEC[]:decomposition'], ['>then', 'epic:SPEC[]:эпик']),
    src: [SK + 'prompts/templates/feature-spec.tmpl.md'], also: [SK + 'prompts/templates/feature-epic-overview.tmpl.md'], codex: CX_MAIN,
    d: { what: 'Главная сессия пишет эпик прямо на доску проекта в его собственном формате: overview с решениями и SPEC-файлы, у каждого CHANGED_HINT ссылается на факт G# и есть свои сценарии Gherkin. Существующие SPEC-и никогда не перезаписываются.' }
  });

  /* ===== /mp --feature ===== */
  D('in-feature', {
    cat: 'IN', title: 'Вход: SPEC с доски', tech: '--next | --phase',
    pins: io([], ['>then', 'specs:SPEC[]:доска или фаза']),
    src: [RT + 'feature.md'], also: [RT + 'phase.md'],
    d: { what: 'В режиме backlog-consume SPEC уже одобрен, когда попал на доску, поэтому фазы 0 и 1 пропускаются. Берётся SPEC из active/, а если его нет — верхний по номеру из backlog/.' }
  });
  D('ms-stale', {
    cat: 'MS', title: 'Не сделано ли уже?', tech: 'staleness',
    pins: io(['>in', 'specs:SPEC[]:backlog'], ['>todo:не сделано', '>done:уже есть', 'spec:SPEC:→ active/']),
    src: [RT + 'feature.md'], codex: CX_MAIN,
    d: {
      what: 'Дешёвая проверка перед стартом: несколько точечных grep по CHANGED_HINT и ключевым словам WHAT. Если всё уже построено и узкая проверка это подтверждает, SPEC закрывается автоматически, без вопроса человеку. Иначе файл переезжает backlog/ → active/, и к нему приклеивается капсула дизайна эпика.',
      stops: 'Частично сделано — предложить сузить SPEC до остатка; при --unattended это принимается само.'
    }
  });
  D('out-auto', {
    cat: 'RT', title: 'Уже сделано → done/', tech: 'auto_closed=1',
    pins: io(['>in'], []), src: [RT + 'feature.md'],
    d: { what: 'Уже сделанный SPEC переезжает прямо в done/ с заполненными ссылками на реализацию. Это не человеческий гейт и не повод спрашивать очевидное.' }
  });
  D('mp-spec-complexity.sh', {
    cat: 'SC', title: 'Размер: ячейки матрицы', tech: 'mp-spec-complexity.sh',
    pins: io(['>in', 'spec:SPEC:SPEC'], ['>ok:ok / warn', '>split:split', 'report:Report:verdict + cells', 'matrix:Checklist:матрица']),
    src: [SCO + 'spec-complexity.sh'], also: [RT + 'contract-risk-routing.md'], flags: ['zero-tokens'], codex: CX_SCRIPT,
    d: {
      what: 'Считает размер задачи по объявленной строке Acceptance-matrix, а не по прозе: произведение измерений роль × состояние × транспорт. Замораживает список ячеек в файл — по нему потом отчитывается смысловое ревью, поэтому петля ремонта сходится.',
      stops: 'Ячеек не меньше бюджета (по умолчанию 24) — split_recommended и вопрос разделить SPEC. Матрица не объявлена — undeclared: оркестратор сам выводит измерения и перезапускает гейт.',
      order: 'Первым, до маршрута и до любого агента; занимает секунды.'
    },
    sample: { ok: true, verdict: 'ok', cells: 8, cell_budget: 24, dimensions: [{ name: 'state', values: 2 }, { name: 'clock', values: 2 }, { name: 'device', values: 2 }], scenarios: 4, modules: 2, layers: 3, matrix_declared: true, frozen_matrix: '.ai/local/mp-matrix-watering-reminder.md', advice: '8 acceptance cells — within budget' }
  });
  D('g-size', {
    cat: 'HG', gate: 'auto', badge: gates.auto, title: 'Разделить на SPEC-и? (Y/n)', tech: 'size gate',
    pins: io(['>in', 'report:Report:cells'], ['>n:n — как есть', '>y:Y — разделить']),
    src: [RT + 'contract-risk-routing.md'], codex: CX_GATE,
    d: {
      what: 'Спрашивается один раз: поверхность приёмки N ячеек по D измерениям — разделить до реализации? Y возвращает SPEC планировщику на разделение, n продолжает как есть и дописывает size_override=1 в журнал.',
      human: 'Недеструктивный гейт: при --unattended автоматически принимается Y и попадает в сводку решений.'
    }
  });
  D('end-split', {
    cat: 'END', title: 'Вернуть планировщику', tech: 'mp-planner · split',
    pins: io(['>in'], []), src: [RT + 'contract-risk-routing.md'],
    d: { what: 'SPEC уходит в mp-planner на разделение. Гейт размера потом перезапускается на первом получившемся SPEC.' }
  });
  D('var-matrix', {
    cat: 'VA', set: true, title: 'Матрица ячеек', tech: '.ai/local/',
    pins: io(['matrix:Checklist:матрица'], ['matrix:Checklist:матрица']),
    src: [SCO + 'spec-complexity.sh'],
    d: { what: 'Список всех ячеек приёмки с колонкой «покрыто». Смысловой ревьюер может добавить пропущенную ячейку, но не может молча пересобрать задачу заново.' }
  });
  D('mp-risk-route.sh', {
    cat: 'SC', title: 'Маршрут риска', tech: 'mp-risk-route.sh', badge: '×2: до и после',
    pins: io(['>in', 'spec:SPEC:SPEC'], ['>then', 'tier:Route:developer_tier', 'report:Report:маршрут']),
    src: [SCO + 'risk-route.sh'], also: [RT + 'contract-risk-routing.md'], flags: ['zero-tokens'], codex: CX_SCRIPT,
    d: {
      what: 'Считает баллы риска по строке Risk-signals и по затронутым файлам: безопасность и платежи, миграции и Room, DI и навигация, фон и конкурентность, пересечение слоёв. Из суммы выходят уровень разработчика, нужно ли смысловое ревью, какой верификатор и нужен ли независимый критик.',
      stops: 'Скрипт отсутствует, упал или вернул мусор — безопасный запасной маршрут: мощный разработчик, ревью, полный верификатор и критик.',
      order: 'Дважды: до первого разработчика и ровно один раз после него, уже с --changed по файлам диффа.'
    },
    sample: { ok: true, risk: 'low', score: 2, developer_tier: 'standard', semantic_review: false, verifier: 'full', independent_critic: false, signals: 'state_or_concurrency' }
  });
  D('mp-ui-designer-android', mix({
    cat: 'AG', title: 'Токены темы Material 3', tech: 'mp-ui-designer-android',
    model: { tier: 'sonnet', id: 'claude-sonnet-4-6' }, tools: ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'], flags: ['edits', 'commits'],
    cond: 'LAYERS ∋ presentation',
    src: [TA + 'ui-designer-android.md'], also: [RT + 'contract-feature-implementation.md'],
    pins: io(['>in', 'spec:SPEC:SPEC'], ['>then', 'tokens:Report:DESIGN_TOKENS']),
    d: {
      what: 'Готовит токены Material 3 для фичи: цвета, типографику, отступы. Экранов и логики не пишет — только ui/theme/, и отдельным коммитом до разработчика. Новые токены добавляются в SPEC строкой DESIGN_TOKENS, и разработчик обязан ссылаться на них по именам.',
      stops: 'conflicts[] не пуст — стоп: показать конфликт и спросить, перезаписать или оставить.',
      order: 'Шаг 0: только Android и только если в LAYERS есть presentation.'
    },
    sample: { changed_files: ['ui/theme/Spacing.kt'], commit: 'b71c0e2', tokens_added: ['spacing.reminderRow'], conflicts: [] }
  }, cxDev('mp-ui-designer-android', 'gpt-5.4', 'high', 'workspace-write')));
  D('sw-tier', {
    cat: 'SW', title: 'Кто пишет код?', tech: 'DEVELOPER_AGENT',
    pins: io(['>in', 'sel:Route:tier'], ['>std:standard', '>pow:powerful']),
    src: [RT + 'contract-risk-routing.md'],
    d: { what: 'Маршрут выбирает уровень разработчика: standard — обычная модель, powerful — самая сильная. Выбранный здесь агент потом делает и ремонт, и автопочинку; после эскалации уровень только повышается.' }
  });
  D('var-spec', {
    cat: 'VA', get: true, title: 'SPEC (active/)', tech: '.claude/specs/active/*.md',
    pins: io([], ['spec:SPEC:SPEC']),
    src: ['templates/common/specs/README.md'],
    d: { what: 'Одобренный SPEC-блок, который читается дословно. В него уже вклеены DESIGN_CAPSULE эпика и строка DESIGN_TOKENS.' }
  });
  var DEV_TOOLS = ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep'];
  D('mp-developer-standard-android', mix({
    cat: 'AG', title: 'Разработчик (стандартный)', tech: 'mp-developer-standard-android',
    model: { tier: 'sonnet', id: 'claude-sonnet-4-6' }, tools: DEV_TOOLS.slice(), flags: ['edits', 'commits'],
    src: [TA + 'developer-standard-android.md'], also: [RT + 'contract-feature-implementation.md', RT + 'contract-rules-implementation.md'],
    pins: io(['>in', 'spec:SPEC:SPEC', 'tokens:Report:DESIGN_TOKENS'], ['>then', 'files:Files[]:файлы + коммит']),
    d: {
      what: 'Реализует SPEC строго по полям и по Clean Architecture: domain без Android, data с репозиториями и Room, presentation на Compose. Работает на обычной модели — маршрут отдал задачу ему, потому что риск низкий. Возвращает изменённые файлы и хэш коммита.',
      stops: 'Если смысловой ревьюер позже вернёт blocker или risk:"high", маршрут необратимо повышается: дальше ремонтирует мощный разработчик.',
      order: 'Последовательно: после маршрута, перед детерминированным ревьюером.'
    },
    sample: { changed_files: ['domain/reminder/WateringReminderScheduler.kt', 'data/reminder/ReminderWorker.kt', 'presentation/plant/ReminderToggle.kt'], commit: '8a41d07' }
  }, cxDev('mp-developer-standard-android', 'gpt-5.4', 'high', 'workspace-write')));
  D('mp-developer-android', mix({
    cat: 'AG', title: 'Разработчик (мощный)', tech: 'mp-developer-android',
    model: { tier: 'opus', id: 'claude-opus-4-8' }, tools: DEV_TOOLS.slice(), flags: ['edits', 'commits'],
    src: [TA + 'developer-android.md'], also: [RT + 'contract-feature-implementation.md', RT + 'contract-risk-routing.md'],
    pins: io(['>in', 'spec:SPEC:SPEC', 'tokens:Report:DESIGN_TOKENS'], ['>then', 'files:Files[]:файлы + коммит']),
    d: {
      what: 'Самая сильная модель для рискованной работы: авторизация, миграции, конкурентность, изменения через несколько слоёв. В петле ремонта получает все замечания одним пакетом и обязан переосмыслить реализацию целиком, а не латать строки. На каждое замечание пишет регрессионный тест и возвращает resolved_findings.',
      stops: 'Автопочинка после упавших тестов — ровно одна и без новой логики. После двух кругов ремонта — капсула дизайна архитектора, затем последний круг.',
      order: 'Последовательно: после маршрута, когда developer_tier = powerful. Ремонт и автопочинку делает разработчик маршрута; после эскалации это всегда он.'
    },
    sample: { changed_files: ['domain/reminder/WateringReminderScheduler.kt', 'data/reminder/BootReceiver.kt'], commit: 'c41e9a0', resolved_findings: [{ id: 'STATE-001', status: 'fixed', note: 'ZoneId.systemDefault()' }] }
  }, cxDev('mp-developer-android', 'gpt-5.6', 'high', 'workspace-write')));
  /* DEVELOPER_AGENT: not an agent file but a role — whichever developer the risk route picked
   * (contract-risk-routing.md «Resolve agents»). No fixed model: the node shows both tier chips. */
  D('developer-routed', {
    cat: 'AG', title: 'Разработчик (по маршруту)', tech: 'DEVELOPER_AGENT',
    routed: ['mp-developer-standard-android', 'mp-developer-android'],
    tools: DEV_TOOLS.slice(), flags: ['edits', 'commits'],
    src: [RT + 'contract-risk-routing.md'], also: [RT + 'contract-feature-implementation.md', TA + 'developer-standard-android.md', TA + 'developer-android.md'],
    codex: 'Codex: тот же выбор — нативный субагент mp-developer-standard-android или mp-developer-android (.codex/agents/*.toml), модели по таблице codex-agent-shims.md.',
    related: ['fn-dev-std', 'fn-dev'],
    pins: io(['>in', 'findings:Findings[]:замечания'], ['>then', 'files:Files[]:файлы + коммит']),
    d: {
      what: 'Не отдельный агент, а роль DEVELOPER_AGENT: её исполняет тот разработчик, которого выбрал маршрут риска, — стандартный на Sonnet или мощный на Opus. Он же делает единственную автопочинку после упавших тестов и ремонт по замечаниям смыслового ревью. Любой blocker или risk:"high" от ревьюера необратимо повышает маршрут, поэтому ремонт после блокеров достаётся мощному разработчику.',
      stops: 'Автопочинка — ровно одна и без новой логики, затем стоп и два отчёта человеку. Ремонт — два круга, потом капсула архитектора и один последний круг.',
      order: 'Уровень берётся из последнего ответа mp-risk-route.sh (он запускается до и после разработчика) и может только расти.'
    },
    sample: { changed_files: ['domain/reminder/WateringReminderScheduler.kt'], commit: '5d0b3e8' }
  });
  D('var-diff', {
    cat: 'VA', set: true, multiIn: true, title: 'CHANGED_FILES', tech: '--name-status',
    pins: io(['files:Files[]:changed_files'], ['files:Files[]:CHANGED_FILES']),
    src: [RT + 'contract-feature-implementation.md'],
    d: { what: 'Объединение всех изменённых файлов из шагов разработчика. Отсюда же выводится MODIFIED_EXISTING — какие файлы существовали до задачи, чтобы тестировщик обновил устаревшие тесты.' }
  });
  D('mp-reviewer-android.sh', {
    cat: 'SC', title: 'Границы слоёв (Clean Arch.)', tech: 'mp-reviewer-android.sh',
    pins: io(['>in', 'files:Files[]:CHANGED_FILES'], ['>pass:pass', '>fail:fail', '>crash:сбой / не JSON', 'report:Report:violations']),
    src: [SAN + 'reviewer-android.sh'], also: [RT + 'contract-feature-implementation.md'], flags: ['zero-tokens'], codex: CX_SCRIPT,
    d: {
      what: 'Проверяет только изменённые файлы: domain без import android, presentation без импортов data, ViewModel ходит к данным только через UseCase, у экрана есть тестируемый Content, цвета, отступы и шрифты только из темы, гигиена тестов, направление зависимостей модулей и свой тест у каждого затронутого use case. Понимает и одномодульную, и многомодульную раскладку проекта.',
      stops: 'pass:false — стоп, показать нарушения человеку; тестировщик не запускается. Режим --warn-only переносит находки в warnings и не блокирует. Ненулевой код или не-JSON — запасной агент-ревьюер.',
      order: 'После разработчика, перед смысловым ревью.'
    },
    sample: { pass: false, violations: ['presentation/plant/ReminderToggle.kt:31 — raw .dp literal; use LocalSpacing.current.X'], warnings: [], by_check: { 'design-tokens': 1 } }
  });
  D('mp-reviewer-android', mix({
    cat: 'AG', title: 'Запасной ревьюер', tech: 'mp-reviewer-android',
    model: { tier: 'haiku', id: 'claude-haiku-4-5-20251001' }, tools: ['Bash', 'Read', 'Glob', 'Grep'], flags: ['read-only', 'fallback'],
    fallback: true,
    src: [TA + 'reviewer-android.md', TC + 'reviewer-base.md'],
    also: ['claude-plugins/mp-dev/agents/mp-reviewer-android.md'],
    pins: io(['>in', 'files:Files[]:CHANGED_FILES'], ['>pass:pass', '>fail:fail', 'report:Report:violations']),
    d: {
      what: 'Тот же набор проверок слоёв, но руками дешёвой модели: общий текст reviewer-base плюс Android-оверлей с конкретными grep-командами. Нужен, только если скрипт не отработал.',
      stops: 'pass:false — стоп, как и у скрипта.',
      order: 'Только вместо упавшего скрипта mp-reviewer-android.sh.'
    },
    sample: { pass: true, violations: [] }
  }, cxDev('mp-reviewer-android', 'gpt-5.4-mini', 'medium', 'read-only')));
  D('end-review', {
    cat: 'END', title: 'Стоп: показать нарушения', tech: 'reviewer pass:false',
    pins: io(['>in'], []), src: [RT + 'contract-feature-implementation.md'],
    d: { what: 'Нарушение границ слоёв останавливает цепочку до тестов. Человек видит список нарушений с файлами и строками.' }
  });
  D('mp-semantic-reviewer-android', mix({
    cat: 'AG', title: 'Смысловое ревью по матрице', tech: 'mp-semantic-reviewer-android',
    model: { tier: 'sonnet', id: 'claude-sonnet-4-6' }, tools: ['Read', 'Glob', 'Grep', 'Bash'], flags: ['read-only'],
    cond: 'semantic_review',
    src: [TA + 'semantic-reviewer-android.md'], also: [RT + 'contract-risk-routing.md'],
    pins: io(['>in', 'files:Files[]:scoped diff', 'matrix:Checklist:матрица'], ['>pass:pass', '>fix:findings', 'findings:Findings[]:findings[]', 'round:Number:круг']),
    d: {
      what: 'Читает дифф против SPEC и замороженной матрицы приёмки и ищет смысловые дыры: состояние, хранение, безопасность, совместимость, тесты. Каждый blocker объясняется без кода: что не так, сценарий Given/When/Then, последствия и почему нельзя выпускать. Возвращает coverage — сколько ячеек матрицы покрыто.',
      stops: 'Любой blocker блокирует тесты и прогон. Своя оценка risk:"high" или любой blocker повышает маршрут до конца SPEC. Нет вывода 10 минут — перезапуск на свежем агенте с урезанным пакетом.',
      order: 'После детерминированного ревьюера, только если маршрут требует. Повторяется в петле ремонта: не больше двух кругов, затем капсула и последний круг.'
    },
    sample: { pass: false, risk: 'high', findings: [{ severity: 'blocker', file: 'domain/reminder/WateringReminderScheduler.kt', line: 42, rule: 'state', evidence: 'atDate(today).toInstant(ZoneOffset.UTC)', fix: 'считать время полива в ZoneId.systemDefault()' }], uncertainties: [], confidence: 'high', coverage: { total: 12, covered: 7 } }
  }, cxDev('mp-semantic-reviewer-android', 'gpt-5.4', 'high', 'read-only')));
  D('sw-round', {
    cat: 'SW', title: 'Круг ремонта', tech: 'repair budget: 2 + capsule + 1',
    pins: io(['>in', 'sel:Number:круг'], ['>r01:0–1', '>r2:2', '>r3:3: после капсулы']),
    src: [RT + 'contract-risk-routing.md'],
    d: { what: 'Считает, сколько кругов ремонта уже было. 0–1 — ещё один пакетный ремонт, 2 — бюджет исчерпан, зовём архитектора за капсулой, 3 — даже после капсулы не сошлось, передаём человеку.' }
  });
  D('mp-architect', mix({
    cat: 'AG', title: 'Капсула дизайна', tech: 'mp-architect', badge: 'только читает',
    model: { tier: 'sonnet', id: 'claude-sonnet-4-6' }, tools: ['Read', 'Glob', 'Grep'], flags: ['read-only', 'no-bash'],
    src: [TC + 'architect.md'], also: [RT + 'contract-risk-routing.md', RT + 'discuss.md'],
    pins: io(['>in', 'findings:Findings[]:ID-журнал'], ['>then', 'verdict:Route:VERDICT', 'capsule:Checklist:CAPSULE']),
    d: {
      what: 'Когда два круга ремонта не сошлись, архитектор называет одно общее решение, симптомами которого были все находки: владелец состояния, направление зависимостей, жизненный цикл, конкурентность, бюджет таймаутов, тестовые часы. Возвращает блок CAPSULE с честным VERDICT. В режиме --discuss тот же агент пишет BRAINSTORM с вариантами.',
      stops: 'PATCH ALLOWED — продолжаем без человека (gate_auto=1). DESIGN DECISION REQUIRED — настоящий гейт, решение за человеком.',
      order: 'Только после второго неудачного круга смыслового ревью.'
    },
    sample: '=== CAPSULE === AREA: кто владеет расписанием напоминаний · FINDINGS COVERED: STATE-001, STATE-002, STATE-003, PERSISTENCE-001 · VERDICT: PATCH ALLOWED · STATE OWNER: WateringReminderScheduler — один уникальный WorkRequest на цветок === END CAPSULE ==='
  }, cxDev('mp-architect', 'gpt-5.4', 'high', 'read-only')));
  D('sw-capsule', {
    cat: 'SW', title: 'Нужен человек?', tech: 'VERDICT',
    pins: io(['>in', 'sel:Route:VERDICT'], ['>patch:нет', '>design:да']),
    src: [RT + 'contract-risk-routing.md'],
    d: { what: 'Вердикт капсулы решает, будить ли человека: PATCH ALLOWED — нет, DESIGN DECISION REQUIRED — да. Безусловный гейт здесь однажды съел 65% времени задачи на ожидание одобрения капсулы, которая сама говорила, что решение человека не нужно.' }
  });
  D('g-capsule', {
    cat: 'HG', gate: 'always', badge: gates.always, title: 'Решение по архитектуре', tech: 'DESIGN DECISION',
    pins: io(['>in', 'capsule:Checklist:капсула'], ['>then:принято']),
    src: [RT + 'contract-risk-routing.md'], codex: CX_GATE,
    d: { what: 'Человек видит капсулу и её альтернативы и выбирает сам. Время ожидания записывается как human_wait_ms на возобновлённом событии.', human: 'Всегда ждёт — но только если архитектор честно не смог решить сам.' }
  });
  D('end-handoff', {
    cat: 'END', blocked: true, title: 'Blocked: ## Handoff', tech: 'SPEC остаётся в active/',
    pins: io(['>in'], []), src: [RT + 'contract-risk-routing.md'],
    d: { what: 'Последний круг после капсулы тоже вернул блокеры. Журнал находок, непокрытые ячейки и капсула записываются в раздел ## Handoff, SPEC остаётся в active/, латание прекращается.' }
  });
  D('mp-tester-android', mix({
    cat: 'AG', title: 'Тесты: пишет, не запускает', tech: 'mp-tester-android',
    model: { tier: 'sonnet', id: 'claude-sonnet-4-6' }, tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'], flags: ['edits', 'no-bash'],
    src: [TA + 'tester-android.md'], also: [RT + 'contract-feature-implementation.md'],
    pins: io(['>in', 'files:Files[]:CHANGED_FILES'], ['>then', 'tests:Files[]:test_files', 'shots:Verdict:screenshots']),
    d: {
      what: 'Пишет unit, DAO, Compose-UI и скриншот-тесты по TEST_TYPES, только на фейках — без моков. Для изменённых старых файлов применяет правило устаревших тестов: старые тесты должны говорить новую правду. Bash у агента нет физически — запускает стенд.',
      stops: 'Не может «починить» прогон: у него нет инструмента запуска. В режиме --tdd сначала пишет красные тесты.',
      order: 'После ревью (детерминированного и смыслового), перед прогоном.'
    },
    sample: { test_files: ['domain/reminder/WateringReminderSchedulerTest.kt', 'presentation/plant/ReminderToggleTest.kt'], screenshot_record_needed: false, missing_content_extraction: [], coverage_exceptions: [], stale_tests_reviewed: [] }
  }, cxDev('mp-tester-android', 'gpt-5.4', 'high', 'workspace-write')));
  D('mp-runner-android.sh', {
    cat: 'SC', title: 'Прогон: scoped → full', tech: 'mp-runner-android.sh',
    pins: io(['>in', 'tests:Files[]:test_files', 'record:Verdict:screenshots'], ['>pass:pass', '>fail:fail', '>crash:сбой / не JSON', 'report:Report:pass · tests · errors']),
    src: [SAN + 'runner-android.sh'], also: [RT + 'contract-feature-implementation.md'], flags: ['zero-tokens'], codex: CX_SCRIPT,
    d: {
      what: 'Сначала быстрый scoped-прогон только затронутых модулей, пока идёт починка. Затем ровно один полный прогон как выпускной гейт: тесты, detekt, lint, покрытие не ниже 65% и скриншоты. Весь шум Gradle уходит во временные файлы, наружу — одна строка JSON.',
      stops: 'pass:false — одна автопочинка, затем стоп. Модуль не найден — error_kind:"task_not_found", это не ошибка кода. Ненулевой код или не-JSON — запасной агент.',
      order: 'После тестировщика; повторяется один раз после автопочинки.'
    },
    sample: { pass: true, mode: 'full', tests: '42 passed / 0 failed', detekt: 'ok', lint: 'ok', coverage: '71%', screenshots: 'skipped' }
  });
  D('mp-runner-android', mix({
    cat: 'AG', title: 'Запасной прогон', tech: 'mp-runner-android',
    model: { tier: 'sonnet', id: 'claude-sonnet-4-6' }, tools: ['Bash'], flags: ['fallback'],
    fallback: true,
    src: [TA + 'runner-android.md'],
    pins: io(['>in', 'tests:Files[]:test_files'], ['>pass:pass', '>fail:fail', 'report:Report:pass · tests · errors']),
    d: {
      what: 'Тот же прогон Gradle, но агентом, который умеет разобраться, почему скрипт упал: окружение, JBR, задача не найдена. Инструмент у него один — Bash. Возвращает тот же JSON, что и скрипт.',
      stops: 'pass:false — дальше как у скрипта: одна автопочинка и стоп.',
      order: 'Только вместо упавшего mp-runner-android.sh.'
    },
    sample: { pass: true, tests: '42 passed / 0 failed', detekt: 'ok', lint: 'ok', coverage: '71%', screenshots: 'skipped' }
  }, cxDev('mp-runner-android', 'gpt-5.4-mini', 'low', 'workspace-write')));
  D('br-fixed', {
    cat: 'BR', title: 'Уже чинили?', tech: 'Step 4 · one retry',
    pins: io(['>in'], ['>no:нет', '>yes:да']),
    src: [RT + 'contract-feature-implementation.md'],
    d: { what: 'Упавший прогон получает ровно одну автоматическую попытку. Если прогон падает и после неё — конвейер останавливается и показывает оба отчёта.' }
  });
  D('end-run', {
    cat: 'END', title: 'Стоп: два отчёта, спросить', tech: 'runner pass:false ×2',
    pins: io(['>in'], []), src: [RT + 'contract-feature-implementation.md'],
    d: { what: 'Второй прогон тоже красный. Человек видит оба отчёта и решает, что делать дальше; конвейер не чинит по кругу.' }
  });
  D('mp-verifier-android', mix({
    cat: 'AG', title: 'Верификатор: 6 проверок', tech: 'mp-verifier-android',
    model: { tier: 'haiku', id: 'claude-haiku-4-5-20251001' }, tools: ['Read', 'Glob', 'Grep', 'Bash'], flags: ['read-only'],
    src: [TA + 'verifier-android.md'], also: [RT + 'contract-feature-implementation.md'],
    pins: io(['>in', 'files:Files[]:CHANGED_FILES'], ['>pass:pass', '>fail:fail', 'checklist:Checklist:manual_checklist']),
    d: {
      what: 'Убеждается, что новинка подключена к приложению: навигация, граф Hilt, схема Room, строки на языке интерфейса, тесты есть, устаревшие тесты обновлены — шесть статических проверок. Плюс пишет человеку ручной чек-лист на 3–5 шагов для проверки на телефоне.',
      stops: 'pass:false — стоп: показать провалившиеся проверки и предложить /mp --bugfix. Фича всегда получает полного верификатора, даже если маршрут сказал lite.',
      order: 'После прогона и критика, прямо перед HARD STOP.'
    },
    sample: { pass: true, static_checks: { nav_wired: 'ok', hilt_graph: 'ok', room_schema: 'ok', ru_strings: 'ok', tests_exist: 'ok', stale_tests: 'n/a' }, manual_checklist: ['Добавьте фиалку и включите напоминание на 09:00', 'Переведите часы телефона на 08:59 и подождите минуту', 'Проверьте текст: «Фиалка хочет пить. Пора полить!»'] }
  }, cxDev('mp-verifier-android', 'gpt-5.4-mini', 'medium', 'read-only')));
  D('mp-verifier-lite-android', mix({
    cat: 'AG', title: 'Верификатор lite', tech: 'mp-verifier-lite-android',
    model: { tier: 'haiku', id: 'claude-haiku-4-5-20251001' }, tools: ['Read', 'Glob', 'Grep', 'Bash'], flags: ['read-only'],
    src: [TA + 'verifier-lite-android.md'], also: [RT + 'bugfix.md'],
    pins: io(['>in', 'files:Files[]:CHANGED_FILES'], ['>pass:pass', '>fail:fail', 'checklist:Checklist:manual_checklist']),
    d: {
      what: 'Облегчённая проверка для исправления ошибки с низким риском: строки, тесты и устаревшие тесты, без навигации и Hilt. Ничего не меняет и Gradle не запускает.',
      stops: 'Если исправление не подходит под лёгкий путь, возвращает full_verifier_required.',
      order: 'Только в --bugfix и только на маршруте с risk:"low".'
    },
    sample: { pass: true, static_checks: { nav_wired: 'n/a', hilt_graph: 'n/a', room_schema: 'n/a', ru_strings: 'ok', tests_exist: 'ok', stale_tests: 'ok' }, manual_checklist: ['Перезапустите телефон и убедитесь, что напоминание на 09:00 сохранилось'] }
  }, cxDev('mp-verifier-lite-android', 'gpt-5.4-mini', 'low', 'read-only')));
  D('end-verify', {
    cat: 'END', title: 'Стоп: проверки не прошли', tech: 'critic / verifier pass:false',
    pins: io(['>in'], []), src: [RT + 'contract-feature-implementation.md'],
    d: { what: 'Критик или верификатор нашли, что новинка не подключена или не доказана. Пуша не будет; человек получает список провалов и предложение «Fix and continue?».' }
  });
  D('g-push', {
    cat: 'HG', gate: 'hard', badge: gates.hard, title: 'Готово к пушу? (y/N)', tech: 'Step 4.5',
    pins: io(['>in', 'checklist:Checklist:чек-лист'], ['>y:y', '>n:N']),
    src: [RT + 'contract-feature-implementation.md'], also: [RT + 'contract-risk-routing.md'], codex: CX_GATE,
    d: {
      what: 'Ручной чек-лист верификатора печатается дословно, и человек сам проходит его на телефоне или эмуляторе. Только «y» ведёт к пушу; «N» — стоп, ничего не пушим и ждём отзыва.',
      human: 'HARD STOP: не принимается автоматически даже при --unattended. Единственное исключение — точный режим --feature --next --chain (только Codex), который сам разрешает один пуш завершённого SPEC.'
    }
  });
  D('end-wait', {
    cat: 'END', title: 'N: не пушим, ждём отзыв', tech: 'Step 4.5 · N',
    pins: io(['>in'], []), src: [RT + 'contract-feature-implementation.md'],
    d: { what: 'Человек нашёл что-то при ручной проверке. Коммит остаётся локальным, конвейер больше ничего не делает до отзыва.' }
  });
  D('sc-push', {
    cat: 'SC', title: 'git push origin HEAD', tech: 'Step 5',
    pins: io(['>in'], ['>then']),
    src: [RT + 'contract-feature-implementation.md'], flags: ['zero-tokens', 'network'], codex: CX_SCRIPT,
    d: {
      what: 'Пушит через настроенный origin и его помощник учётных данных, с GIT_TERMINAL_PROMPT=0, чтобы отсутствующий пароль не повесил конвейер. GITHUB_TOKEN — только необязательный запасной путь для HTTPS.',
      stops: 'Пуш не удался — показать ошибку и продолжить к документации, не блокируя.',
      order: 'Шаг 5: сразу после «y» на HARD STOP, перед документацией.'
    },
    sample: 'To github.com:<you>/polei-menya.git   3c9e0f2..8a41d07  HEAD -> main'
  });
  D('mp-docs', mix({
    cat: 'AG', title: 'STATE / DOCS / CLAUDE.md', tech: 'mp-docs',
    model: { tier: 'sonnet', id: 'claude-sonnet-4-6' }, tools: ['Bash', 'Read', 'Edit'], flags: ['edits', 'commits'],
    cond: 'docsAgent ≠ inert',
    src: [TC + 'docs.md'], also: [RT + 'contract-feature-implementation.md'],
    pins: io(['>in'], ['>then']),
    d: {
      what: 'После каждого прогона обновляет STATE.md: последнее сделанное, недавно выпущенное, что дальше. DOCUMENTATION.md и CLAUDE.md трогает, только если появилось действительно новое, и ничего не удаляет.',
      stops: 'Настройка docsAgent: "inert" пропускает шаг целиком, чтобы не платить за вызов, который ничего не запишет.',
      order: 'После пуша, перед хвостом самообучения.'
    },
    sample: { committed: true, files: ['STATE.md'], commit: 'd51f0a3' }
  }, cxDev('mp-docs', 'gpt-5.4', 'high', 'workspace-write')));
  D('cp-post', {
    cat: 'CP', graph: 'learn', title: 'После пуша: оценка и уроки', tech: 'contract-post-ship.md',
    pins: io(['>in', 'spec:SPEC:SPEC', 'files:Files[]:коммит'], ['>then', 'pr:Proposal:PR']),
    src: [RT + 'contract-post-ship.md'],
    d: { what: 'Четыре закрывающих хода по порядку: сборка в Telegram, одна оценка от человека, запись уроков и дешёвые подсказки про очередь улучшений. Открывает граф «Самообучение».' }
  });
  D('out-done', {
    cat: 'RT', title: 'SPEC → done/ · отчёт', tech: 'Phase 3 · report',
    pins: io(['>in', 'files:Files[]:коммит'], []),
    src: [RT + 'feature.md'],
    d: { what: 'SPEC переезжает active/ → done/ со ссылками на коммит и файлы, а если это был последний SPEC эпика — эпик проходит финальную проверку и тоже закрывается. Человек получает короткий отчёт: коммит, тесты, lint, пуш и файлы.' }
  });

  /* ===== Самообучение ===== */
  D('in-post', {
    cat: 'IN', title: 'Вход: после пуша', tech: 'contract-post-ship.md',
    pins: io([], ['>then', 'spec:SPEC:SPEC', 'files:Files[]:коммит']),
    src: [RT + 'contract-post-ship.md'],
    d: { what: 'Хвост запускается после успешных --feature и --bugfix, уже после документации. Сюда приходят SPEC и коммит.' }
  });
  D('mp-deliver-telegram.sh', {
    cat: 'SC', title: 'Сборка в Telegram (y/N)', tech: 'mp-deliver-telegram.sh', cond: 'Telegram настроен',
    pins: io(['>in', 'files:Files[]:APK'], ['>then', 'report:Report:ok · target · mb']),
    src: [SCO + 'deliver-telegram.sh'], also: [RT + 'deliver.md', 'docs/TELEGRAM-DELIVERY.md'], flags: ['zero-tokens', 'network'], codex: CX_SCRIPT,
    d: {
      what: 'Сначала сборка, потом оценка: человек сперва пробует приложение у себя в телефоне. Скрипт отправляет свежий APK вам же в Telegram (Saved Messages) через пользовательскую сессию MTProto (Telethon), до 2 ГБ.',
      stops: 'Telegram не настроен — шаг молча пропускается. Код выхода повторяет ok, чтобы CI мог ветвиться.',
      order: 'Первый из четырёх ходов после пуша; предлагается один раз на эпик.'
    },
    sample: { ok: true, target: 'me', file: 'app-debug.apk', bytes: 12345678, mb: '11.8' }
  });
  D('g-feedback', {
    cat: 'HG', gate: 'always', badge: 'раз на эпик', title: 'Оценка 5..1 (раз на эпик)', tech: 'feedback',
    pins: io(['>in'], ['>then', 'score:Number:оценка', 'note:Idea:заметка']),
    src: [RT + 'contract-post-ship.md'], codex: CX_GATE,
    d: {
      what: 'Ровно один вопрос: совпадает ли результат с тем, что вы хотели — от 5 «идеально» до 1 «совсем нет», с короткой заметкой, если меньше пяти. В эпике вопрос задаётся один раз, когда закрывается последний SPEC, чтобы оценивать целое.',
      human: 'Пропускается только если человек явно торопится или это не последний SPEC эпика.'
    }
  });
  D('mp-record-run.sh', {
    cat: 'SC', title: 'Записать событие телеметрии', tech: 'mp-record-run.sh',
    pins: io(['>in', 'score:Number:score'], ['>then', 'report:Report:retro_due']),
    src: [SCO + 'record-run.sh'], also: [SCO + 'retro.sh', RT + 'contract-telemetry.md'], flags: ['zero-tokens'], codex: CX_SCRIPT,
    d: {
      what: 'Дописывает одну строку JSON в selfimprove/runs/<ГГГГ-ММ>.jsonl: шаг, вердикт, метрики, токены, длительность. Сообщает retro_due, когда после последнего ретро накопилось 10 событий — тогда mp-retro.sh детерминированно собирает retro/*.md без LLM.',
      stops: 'Никогда не блокирует и не роняет конвейер: всегда выход 0 и одна строка JSON.',
      order: 'После каждого значимого шага; здесь — с оценкой человека (--agent feedback).'
    },
    sample: { ok: true, log: 'selfimprove/runs/2026-09.jsonl', events_total: 41, events_since_retro: 11, retro_due: true }
  });
  D('var-telemetry', {
    cat: 'VA', set: true, title: 'selfimprove/', tech: 'runs · retro',
    pins: io(['rep:Report:событие'], ['rep:Report:журнал + ретро']),
    src: [SCO + 'record-run.sh'], also: [SCO + 'retro.sh'],
    d: { what: 'Журнал смены проекта: события в runs/*.jsonl и их сводки retro/retro-<дата>.md. Там же лежит lessons.md с уроками по низким оценкам.' }
  });
  D('var-telemetry-all', {
    cat: 'VA', get: true, title: 'Все проекты', tech: 'projects.txt',
    pins: io([], ['rep:Report:lessons + retro']),
    src: [SCO + 'cross-reflect.sh'],
    d: { what: 'Список корней всех проектов берётся из $MP_PROJECTS или projects.txt. У каждого читаются selfimprove/lessons.md и retro/*.md.' }
  });
  D('br-low', {
    cat: 'BR', title: 'Оценка ≤ 3?', tech: 'score <= 3',
    pins: io(['>in', 'score:Number:оценка'], ['>yes:да', '>no:нет']),
    src: [RT + 'contract-post-ship.md'],
    d: { what: 'Низкая оценка — самый сильный сигнал, что урок существует. Тогда в lessons.md добавляется одна строка.' }
  });
  D('set-lessons', {
    cat: 'VA', set: true, exec: true, title: 'lessons.md +1', tech: 'selfimprove/lessons.md',
    pins: io(['>in', 'note:Idea:заметка'], ['>then']),
    src: [RT + 'contract-post-ship.md'],
    d: { what: 'Добавляет ровно одну строку «- <дата> <slug>: feedback N/5 — заметка». Файл создаётся с заголовком, если его нет, а старые строки никогда не переписываются.' }
  });
  D('mp-knowledge', mix({
    cat: 'AG', title: 'Куда положить урок?', tech: 'mp-knowledge',
    model: { tier: 'sonnet', id: 'sonnet' }, tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'], flags: ['edits'],
    src: [TC + 'knowledge.md'], also: [RT + 'contract-post-ship.md', RT + 'contract-rules-learning.md'],
    pins: io(['>in', 'score:Number:оценка', 'note:Idea:заметка'], ['>then', 'local:Memory[]:проект', 'plugin:Proposal[]:в плагин', 'brain:Memory[]:кандидат']),
    d: {
      what: 'Библиотекарь решает, чей это урок. Особенность этого проекта — в его память или в .claude/mp/extras/<agent>.md; урок для всех проектов — в plugin_improvements[]; долгое предпочтение человека — кандидатом в inbox «второго мозга». Консервативен: рутинная работа — no-op.',
      stops: 'Никогда не редактирует копию плагина и курируемые файлы мозга — только предлагает.',
      order: 'После оценки; вызывается по желанию, пропускается на тривиальных задачах.'
    },
    sample: { updated: [{ file: '.claude/mp/extras/mp-tester-android.md', kind: 'extras', summary: 'время в тестах — только с явной TimeZone' }], plugin_improvements: [{ target: 'templates/android/agents/{{PREFIX}}-tester-android.md', problem: 'тесты расписаний идут в UTC и не ловят сдвиг зоны', proposed_change: 'требовать тест в зоне, отличной от UTC', rationale: 'ошибка часового пояса повторится в любом проекте с напоминаниями' }], brain_candidates: [] }
  }, cxDev('mp-knowledge', 'gpt-5.4', 'high', 'workspace-write')));
  D('var-memory', {
    cat: 'VA', set: true, title: 'Память', tech: 'extras/<agent>',
    pins: io(['mem:Memory[]:урок'], ['mem:Memory[]:урок']),
    src: [TC + 'knowledge.md'],
    d: { what: 'Память конкретного проекта и маленькие переопределения агентов в .claude/mp/extras/. Экстра читается агентом после канонического текста и побеждает его.' }
  });
  D('mp-brain-memory.sh', {
    cat: 'PS', title: 'В inbox «второго мозга»', tech: 'mp-brain-memory.sh append-candidate',
    pins: io(['mem:Memory[]:кандидат'], ['rep:Report:candidate']),
    src: [SCO + 'brain-memory.sh'], also: ['docs/BRAIN-INTEGRATION.md'], flags: ['zero-tokens'], codex: CX_SCRIPT,
    d: {
      what: 'Безопасный шлюз к общей базе знаний: курируемые файлы только читаются, а всё новое ложится кандидатом с отпечатком в brain/inbox/. В курируемый слой кандидат попадает только после решения человека.',
      stops: 'Мозг не найден — отказ одной строкой JSON; конвейер не блокируется.',
      order: 'Вызывает библиотекарь, когда урок похож на долгое предпочтение человека.'
    },
    sample: { ok: true, queued: true, deduplicated: false, candidate_id: 'cand-3f9a1c07b2e4d815', file: 'inbox/2026-09-23-local-time-in-tests.md', curated_writes: false }
  });
  D('mp-improve', mix({
    cat: 'AG', title: 'Патч конвейера (не коммитит)', tech: 'mp-improve',
    model: { tier: 'sonnet', id: 'sonnet' }, tools: ['Read', 'Write', 'Glob', 'Grep', 'Bash'], flags: ['stages'],
    cond: 'plugin_improvements ≠ ∅',
    src: [TC + 'improve.md'], also: [RT + 'improve.md'],
    pins: io(['>in', 'plugin:Proposal[]:уроки плагина'], ['>then', 'patch:Proposal:патч']),
    d: {
      what: 'Находит точный канонический файл в templates/ и готовит unified-diff патч плюс запись в журнал изменений в mobile-pipeline/.ai/proposals/. PR не открывает и ничего не коммитит — это делает оркестратор после «y». Возвращает блок === PROPOSAL ===.',
      stops: 'mp_repo не найден или патч не ложится чисто — ошибка mp_repo_unresolved или no_clean_patch.',
      order: 'После библиотекаря для каждого урока уровня плагина; по прямой команде --improve "<заметка>".'
    },
    sample: { slug: 'tester-non-utc-timezone', targets: ['templates/android/agents/{{PREFIX}}-tester-android.md'], patch_file: '.ai/proposals/tester-non-utc-timezone.patch', changelog_file: '.ai/proposals/tester-non-utc-timezone.changelog', apply_check: 'ok' }
  }, cxDev('mp-improve', 'gpt-5.4', 'high', 'workspace-write')));
  D('var-queue', {
    cat: 'VA', set: true, multiIn: true, title: 'Очередь', tech: '.ai/proposals/',
    pins: io(['patch:Proposal:патч'], ['queue:Proposal[]:очередь']),
    src: [SCO + 'improve-drain.sh'],
    d: { what: 'Сюда складываются патчи от библиотекаря и от --reflect. Один патч — не повод для PR: очередь сливается в один общий PR командой --improve --drain.' }
  });
  D('br-queue', {
    cat: 'BR', title: 'В очереди ≥ 3?', tech: 'count .ai/proposals/*.patch',
    pins: io(['>in'], ['>yes:да', '>no:нет']),
    src: [RT + 'contract-post-ship.md'],
    d: { what: 'Дешёвая молчаливая проверка. Три и больше патча — повод подсказать человеку слить очередь.' }
  });
  D('pr-nudge', {
    cat: 'PR', title: 'Подсказка: --drain', tech: 'post-ship',
    pins: io(['>in'], ['>then']),
    src: [RT + 'contract-post-ship.md'],
    d: { what: 'Печатает: N предложений по улучшению конвейера в очереди — запустите /mp --improve --drain. Если телеметрия вернула retro_due, отдельно предлагается ретро; это совет, а не гейт.' }
  });
  D('out-next', {
    cat: 'RT', title: 'Следующий SPEC', tech: '--chain · Codex',
    pins: io(['>in'], []),
    src: [RT + 'contract-post-ship.md'],
    d: { what: 'В Codex режим --feature --next --chain открывает новую задачу на следующий SPEC, если доска не пуста и ни один гейт не висит. Claude так не умеет: печатает следующую команду и останавливается.' }
  });
  D('ev-improve', {
    cat: 'EV', title: '/mp --improve [заметка]', tech: '"<заметка>" | --drain',
    pins: io([], ['>then', 'note:Idea:заметка']),
    src: [RT + 'improve.md'],
    d: { what: 'Ручной вход в улучшение самой фабрики. С заметкой — отдельный PR ровно для неё; с --drain или без заметки — один общий PR из всей очереди.' }
  });
  D('g-pr', {
    cat: 'HG', gate: 'always', badge: gates.always, title: 'Открыть PR фабрике? (y/n)', tech: 'Mode A / B',
    pins: io(['>in'], ['>y:y', '>n:n — в очередь']),
    src: [RT + 'improve.md'], codex: CX_GATE,
    d: {
      what: 'Человек видит summary, rationale, targets и apply_check патча или список всей очереди. Без явного «y» в mobile-pipeline ничего не пушится; «n» оставляет патч в очереди до следующего --drain.',
      human: 'Всегда ждёт.'
    }
  });
  D('sw-drain', {
    cat: 'SW', title: 'Что сливаем?', tech: 'Mode A | Mode B',
    pins: io(['>in'], ['>note:заметка', '>drain:--drain']),
    src: [RT + 'improve.md'],
    d: { what: 'Прямая заметка всегда получает свой отдельный PR и не смешивается с партией. Очередь уходит одним PR.' }
  });
  D('mp-propose-improvement.sh', {
    cat: 'SC', title: 'Патч → ветка + PR', tech: 'mp-propose-improvement.sh',
    pins: io(['>in', 'patch:Proposal:PROPOSAL'], ['>then', 'pr:Proposal:pr_url']),
    src: [SCO + 'propose-improvement.sh'], flags: ['zero-tokens', 'network'], codex: CX_SCRIPT,
    d: {
      what: 'Ветка improve/<slug> от ветки по умолчанию, git apply, запись в журнал изменений, пересборка плагинов из шаблонов, пуш и PR. Запускается только после одобрения человеком.',
      stops: 'Патч не ложится чисто или ничего не меняет — ошибка одной строкой JSON, без полусделанных веток.',
      order: 'Только после «y» на гейте, в режиме одной заметки.'
    },
    sample: { ok: true, branch: 'improve/tester-non-utc-timezone', base: 'main', pushed: true, pr_url: 'https://github.com/desvingns/mobile-pipeline/pull/14' }
  });
  D('mp-improve-drain.sh', {
    cat: 'SC', title: 'Очередь → один PR', tech: 'mp-improve-drain.sh',
    pins: io(['>in', 'queue:Proposal[]:.ai/proposals/'], ['>then', 'pr:Proposal:pr_url']),
    src: [SCO + 'improve-drain.sh'], flags: ['zero-tokens', 'network'], codex: CX_SCRIPT,
    d: {
      what: 'Проверяет, что каждый патч очереди ложится чисто, накладывает все на одну ветку improve/batch-<время>, пересобирает маркетплейс и открывает один PR. Умеет отклонять и архивировать отдельные предложения с причиной.',
      stops: 'Рабочая копия mobile-pipeline грязная или патч не ложится — стоп до любых изменений; очередь остаётся нетронутой.',
      order: 'Только после «y» на гейте, в режиме --drain.'
    },
    sample: { ok: true, branch: 'improve/batch-20260923-101500', base: 'main', drained: 3, pushed: true, pr_url: 'https://github.com/desvingns/mobile-pipeline/pull/15' }
  });
  D('g-merge', {
    cat: 'HG', gate: 'always', badge: gates.always, title: 'Человек мержит PR', tech: 'GitHub',
    pins: io(['>in'], ['>then', 'pr:Proposal:смерженный PR']),
    src: ['.github/workflows/validate-plugins.yml'], codex: CX_GATE,
    d: { what: 'На PR запускается CI validate-plugins: сгенерированные плагины обязаны совпадать с шаблонами. Мержит только человек, на GitHub.', human: 'Всегда ждёт — это решение вне конвейера.' }
  });
  D('sc-regen', {
    cat: 'SC', title: 'CI: пересобрать плагины', tech: 'regen-plugins',
    pins: io(['>in', 'tpl:Files[]:templates/'], ['>then']),
    src: ['.github/workflows/regen-plugins.yml'], also: ['lib/build-marketplace.sh'], flags: ['zero-tokens'], codex: CX_SCRIPT,
    d: {
      what: 'Пуш в main с изменениями в templates/ запускает сборку: плагины mp-dev и mp-spec перегенерируются из канонических шаблонов и коммитятся обратно. Обычно это страховка: гейт на PR уже заставил их совпасть.',
      stops: 'Защита от петли: сгенерированные деревья не входят в пути-триггеры, поэтому коммит бота не запускает сборку заново.',
      order: 'После мержа в main, уже на GitHub; в конвейере проекта не запускается.'
    },
    sample: 'regen-plugins: templates/android/agents/{{PREFIX}}-tester-android.md changed → claude-plugins/ regenerated and pushed'
  });
  D('out-all', {
    cat: 'RT', title: 'Все проекты', tech: 'marketplace update',
    pins: io(['>in', 'pr:Proposal:новая версия'], []),
    src: ['docs/MARKETPLACE.md'], also: ['docs/UPGRADE.md'],
    d: { what: 'Каждый проект, подключённый к маркетплейсу, получает улучшение при следующем обновлении плагина. Урок, найденный в одном проекте, начинает работать во всех.' }
  });
  D('ev-reflect', {
    cat: 'EV', title: '/mp --reflect', tech: '/mp --reflect',
    pins: io([], ['>then']),
    src: [RT + 'reflect.md'],
    d: { what: 'Режим сопровождающего: собрать уроки всех проектов на этой машине и найти повторяющиеся. Запускается вручную, обычно после серии ретро.' }
  });
  D('mp-cross-reflect.sh', {
    cat: 'SC', title: 'Уроки всех проектов', tech: 'mp-cross-reflect.sh',
    pins: io(['>in', 'rep:Report:lessons + retro'], ['>then', 'digest:Report:digest']),
    src: [SCO + 'cross-reflect.sh'], flags: ['zero-tokens'], codex: CX_SCRIPT,
    d: {
      what: 'Чистый сбор и группировка по ключевым словам, без модели: из lessons.md и retro/*.md каждого проекта в один дайджест .ai/reflections/<время>-digest.md. Темы, которые встречаются в двух и больше проектах, помечаются кандидатами в улучшение плагина.',
      stops: 'Нет списка проектов — ok:false с подсказкой, какой файл создать.',
      order: 'Первый шаг --reflect, до агента.'
    },
    sample: { ok: true, digest: '.ai/reflections/20260923-101500-4242-digest.md', evidence: '/tmp/cross-reflect.x1', projects: 4, recurring_themes: 2 }
  });
  D('mp-reflect', mix({
    cat: 'AG', title: 'Повторяющиеся уроки', tech: 'mp-reflect',
    model: { tier: 'sonnet', id: 'sonnet' }, tools: ['Read', 'Write', 'Glob', 'Grep', 'Bash'], flags: ['stages'],
    src: [TC + 'reflect.md'], also: [RT + 'reflect.md'],
    pins: io(['>in', 'digest:Report:digest'], ['>then', 'patch:Proposal:патчи в очередь']),
    d: {
      what: 'Рационализатор читает дайджест и оценивает каждую повторяющуюся тему: стоит ли она изменения шаблона для всех проектов. Достойные превращаются в патчи в очереди, остальные — в skipped с причиной. PR не открывает.',
      stops: 'Тема из одного проекта — не повод менять шаблон: в очередь идёт только то, что повторилось минимум в двух проектах.',
      order: 'После cross-reflect; итог сливается в PR через --improve --drain.'
    },
    sample: { staged: [{ slug: 'runner-timezone-env', targets: ['templates/android/scripts/{{PREFIX}}-runner-android.sh'], projects: ['polei-menya', 'diet_helper'], summary: 'фиксировать TZ при прогоне тестов' }], skipped: [{ theme: 'медленный Gradle', reason: 'проблема окружения, не шаблона' }] }
  }, cxDev('mp-reflect', 'gpt-5.4', 'high', 'workspace-write')));
  D('pr-reflect', {
    cat: 'PR', title: 'N предложений в очереди', tech: 'reflect.md',
    pins: io(['>in'], []),
    src: [RT + 'reflect.md'],
    d: { what: 'Отчёт: сколько поставлено в очередь и сколько пропущено. Дальше — /mp --improve --drain, чтобы открыть общий PR.' }
  });

  /* ===== defs referenced only from compact modes / crawl group ===== */
  D('crawl-navigator', mix({
    cat: 'AG', title: 'Робот: выбрать цель', tech: 'crawl-navigator',
    model: { tier: 'sonnet', id: 'sonnet' }, tools: ['Read'], flags: ['read-only', 'no-bash'],
    src: [TS + 'crawl-navigator.md'],
    pins: io(['>in'], ['>then']),
    d: {
      what: 'Читает граф наблюдённых состояний и отчёт о покрытии и выбирает одну следующую цель: исследовать непроверенный элемент, пройти экран входа или наполнить пустой список. Сначала разблокировать, потом вширь.',
      stops: 'Возвращает done:true, когда исследовать больше нечего; при согласии explore-only выдаёт только цели explore.',
      order: 'Каждая итерация цикла обхода начинается с него.'
    },
    sample: { done: false, type: 'explore', target_state: 'ST03', path: ['tap:Мои цветы'], affordance: 'tap:Напоминание', intent: 'open the reminder settings of a plant', success_test: 'a distinct new state is captured' }
  }, cxSpec('crawl-navigator', 'gpt-5.4', 'medium')));
  D('crawl-executor', mix({
    cat: 'AG', title: 'Робот: нажать на телефоне', tech: 'crawl-executor',
    model: { tier: 'opus', id: 'opus' }, tools: ['Read', 'Write', 'Bash'], flags: ['multimodal', 'device'],
    src: [TS + 'crawl-executor.md'],
    pins: io(['>in'], ['>then']),
    d: {
      what: 'Перезапускает приложение, повторяет путь до цели и делает одно действие через скрипты input.sh, screencap.sh и ui-dump.sh. Смотрит на экран глазами, а дерево view использует как подсказку.',
      stops: 'Код подтверждения или капча — возвращает needs_human; учётные данные хранятся только в сессии и никогда не пишутся в файлы.',
      order: 'Внутри итерации: после навигатора, перед ревьюером; до двух повторов на цель.'
    },
    sample: { reached_target: true, goal_type: 'explore', before_state: 'ST03', action: 'tap:Напоминание', seeded_count: 0, after: { new: true, id: 'ST08', screen_guess: 'settings', data_state: 'empty', shot: 'states/ST08.png' }, dead_end: false, blocker: null, errors: [] }
  }, cxSpec('crawl-executor', 'gpt-5.6', 'high')));
  D('crawl-reviewer', mix({
    cat: 'AG', title: 'Робот: засчитать шаг', tech: 'crawl-reviewer',
    model: { tier: 'opus', id: 'opus' }, tools: ['Read'], flags: ['read-only', 'multimodal', 'no-bash'],
    src: [TS + 'crawl-reviewer.md'],
    pins: io(['>in'], ['>then']),
    d: {
      what: 'Сравнивает кадры до и после, классифицирует переход и решает, достигнута ли цель. Не больше двух повторов исполнителя на одну цель — как петля критика в /mp-spec.',
      stops: 'decision:continue возможен, пока повторов меньше двух; дальше шаг принимается как есть.',
      order: 'Замыкает каждую итерацию обхода.'
    },
    sample: { edge_class: 'flow', success_met: true, coverage_confidence: 0.62, decision: 'accept', critique: '', needs_seeding: ['ST08: пустой список напоминаний — нужно наполнить'], needs_human: [] }
  }, cxSpec('crawl-reviewer', 'gpt-5.6', 'high')));
  D('mp-runner-instrumented-android', mix({
    cat: 'AG', title: 'Тест на телефоне', tech: 'mp-runner-instrumented-android',
    model: { tier: 'haiku', id: 'claude-haiku-4-5-20251001' }, tools: ['Bash'], flags: ['device'],
    src: [TA + 'runner-instrumented-android.md'], also: [RT + 'device.md'],
    pins: io(['>in'], ['>then']),
    d: {
      what: 'Запускает инструментальные тесты на подключённом телефоне или эмуляторе и возвращает счёт и путь к отчёту. Без устройства отказывается и просит человека подключить его.',
      stops: 'Нет устройства — pass:false и просьба к человеку; запуск «на глаз» не засчитывается.',
      order: 'Режим --device: один тест для одного элемента, затем стоп.'
    },
    sample: { pass: true, connected_tests: '3 passed / 0 failed / 0 skipped', report: 'app/build/reports/androidTests/connected/debug/index.html' }
  }, cxDev('mp-runner-instrumented-android', 'gpt-5.4-mini', 'low', 'workspace-write')));
  D('mp-coverage-android', mix({
    cat: 'AG', title: 'Покрытие JaCoCo', tech: 'mp-coverage-android',
    model: { tier: 'haiku', id: 'claude-haiku-4-5-20251001' }, tools: ['Bash', 'Read', 'Glob', 'Grep'], flags: ['read-only'],
    src: [TA + 'coverage-android.md'], also: [RT + 'coverage.md'],
    pins: io(['>in'], ['>then']),
    d: {
      what: 'Читает отчёт JaCoCo и показывает покрытие строк по пакетам против цели (по умолчанию 65%). Предлагает, какие классы покрыть следующими.',
      stops: 'Нет отчёта JaCoCo — pass:false с подсказкой, какую задачу Gradle запустить.',
      order: 'Режим --coverage, вне основной цепочки; ничего не меняет.'
    },
    sample: { pass: false, error: 'jacoco report missing — run ./gradlew :app:jacocoUnitTestReport first' }
  }, cxDev('mp-coverage-android', 'gpt-5.4-mini', 'low', 'read-only')));
  D('mp-maintainer', mix({
    cat: 'AG', title: 'Переназначить модели', tech: 'mp-maintainer',
    model: { tier: 'sonnet', id: 'claude-sonnet-4-6' }, tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep'], flags: ['edits', 'no-bash'],
    src: [TC + 'maintainer.md'], also: [RT + 'upgrade.md'],
    pins: io(['>in'], ['>then']),
    d: {
      what: 'Пересматривает поле model: у агентов конвейера под новое семейство моделей, сохраняя смысл уровней: быстрый, обычный, самый сильный. Возвращает список обновлённых файлов.',
      stops: 'Показывает текущие назначения и спрашивает про каждый затронутый уровень; пишет только подтверждённое.',
      order: 'Режим --upgrade, когда выходит новое семейство моделей.'
    },
    sample: { updated_files: ['.claude/agents/mp-developer-android.md'] }
  }, cxDev('mp-maintainer', 'gpt-5.4', 'high', 'workspace-write')));

  /* ------------------------------------------------------------------ graphs */
  function N(id, def, c, l, extra) { return mix({ id: id, def: def, at: [c, l] }, extra); }
  function expandWires(list) {
    var out = [];
    list.forEach(function (w) {
      if (typeof w === 'string') {
        if (w.split('>').length > 2) { chain(w).forEach(function (s) { out.push(s); }); } else out.push(hop(w));
      } else out.push(w);
    });
    return out;
  }
  function graph(g) {
    g.wires = expandWires(g.wires);
    return g;
  }

  /* Coordinates follow §2–§5; where the spec positions made comment boxes (+40px padding,
   * 36px bar) overlap, or made a wire run backwards, nodes were moved — see the notes per graph.
   * tools/validate-blueprint.cjs checks: no node overlaps, comment boxes disjoint, no stray nodes. */

  /* Обзор — spec layout shifted right at each stage boundary; var-board up, var-phases/var-app
   * down so the y/N exec wires run clear; cp-learn/var-repo after the «сверка» box; the bottom
   * band (install + other modes) sits under the requirements box. sw-intake sits above the
   * ev-start data fan so no data wire runs behind it; the fit→feature loop drops down in the gap
   * between the «План» and «Реализация» boxes. */
  var overview = graph({
    id: 'overview', tab: 'Обзор', crumb: ['Обзор'], parent: null, entry: 'ev-start',
    title: 'Mobile Pipeline: весь путь от идеи до выпуска',
    what: 'Весь путь одной картой: идея или чужое приложение → бандл требований (/mp-spec) → план из SPEC-ов (/mp --plan) → реализация по одной SPEC (/mp --feature) → для клона сверка с оригиналом (/mp --fit) → уроки после каждого пуша. Составные ноды открываются двойным щелчком или кнопкой «Открыть». Человек отвечает четыре раза: GATE 1 и GATE 2 в /mp-spec, план и пуш.',
    nodes: [
      N('ev-start', 'ev-start', 0, 1),
      N('sw-intake', 'sw-intake', 1.0, 0.15),
      N('cp-spec', 'cp-spec', 1.8, 0.4),
      N('cp-spec-feature', 'cp-spec-feature', 1.8, 2.3),
      N('sw-plan', 'sw-plan', 3.0, 0.45),
      N('var-bundle', 'var-bundle', 3.0, 1.5, { multiIn: false }),
      N('fn-plan', 'mp-planner', 3.8, 0),
      N('fn-phases', 'mp-phase-planner', 3.8, 1.25),
      N('g-plan', 'g-plan', 4.8, 0),
      N('g-phases', 'g-phases', 4.8, 1.25),
      N('var-board', 'var-board', 5.8, -0.3),
      N('var-phases', 'var-phases', 5.8, 1.9),
      N('cp-feature', 'cp-feature', 6.7, 0),
      N('cp-phase', 'cp-phase', 6.7, 1.25),
      N('var-app', 'var-app', 7.75, 1.95),
      N('var-refs', 'var-refs', 7.75, -0.75),
      N('fn-fit', 'mp-fit-android', 8.55, -1.0, { cond: 'только клон' }),
      N('cp-learn', 'cp-learn', 9.65, 0.4),
      N('var-repo', 'var-repo', 10.65, 0.45, { multiIn: false }),
      N('ev-install', 'ev-install', 0, 4.1),
      N('sc-install', 'sc-install', 0.9, 4.1),
      N('m-bugfix', 'mode-bugfix', 2.0, 4.1),
      N('m-discuss', 'mode-discuss', 2.95, 4.1),
      N('m-spec', 'mode-spec', 3.9, 4.1),
      N('m-device', 'mode-device', 4.85, 4.1),
      N('m-coverage', 'mode-coverage', 5.8, 4.1),
      N('m-deliver', 'mode-deliver', 2.0, 4.45),
      N('m-upgrade', 'mode-upgrade', 2.95, 4.45),
      N('m-continue', 'mode-continue', 3.9, 4.45),
      N('m-check', 'mode-check', 4.85, 4.45)
    ],
    wires: [
      'ev-start>sw-intake',
      'sw-intake.clone>cp-spec', 'sw-intake.green>cp-spec', 'sw-intake.feature>cp-spec-feature',
      'cp-spec>sw-plan',
      'sw-plan.epic>fn-plan>g-plan', 'sw-plan.phases>fn-phases>g-phases',
      'g-plan.y>cp-feature', 'g-phases.y>cp-phase',
      W('cp-spec-feature>cp-feature', { via: [[2.85, 3.0], [6.4, 3.0]] }),
      'cp-phase>fn-fit',
      W('fn-fit>cp-feature', { k: 'loop', via: [[9.5, -1.62], [6.55, -1.62], [6.55, -0.2]], badge: 'расхождения → новые SPEC' }),
      'cp-feature>cp-learn',
      'ev-install>sc-install',
      /* data */
      'ev-start.idea>cp-spec.idea', 'ev-start.idea>cp-spec-feature.idea',
      'ev-start.screens>cp-spec.screens', 'ev-start.apk>cp-spec.apk',
      'cp-spec.bundle>var-bundle.bundle',
      'var-bundle.bundle>fn-plan.bundle', 'var-bundle.bundle>fn-phases.bundle',
      'fn-plan.specs>g-plan.specs', 'g-plan.specs>var-board.specs',
      'fn-phases.specs>g-phases.specs', 'g-phases.specs>var-phases.specs',
      W('cp-spec-feature.epic>var-board.specs', { via: [[2.85, 3.1], [5.62, 3.1]] }),
      W('fn-fit.specs>var-board.specs', { k: 'loop', via: [[9.45, -1.52], [5.62, -1.52]] }),
      'var-board.specs>cp-feature.specs', 'var-phases.specs>cp-phase.specs',
      'cp-feature.files>var-app.files', 'cp-phase.files>var-app.files',
      'var-app.files>fn-fit.build', 'var-refs.refs>fn-fit.refs',
      'cp-feature.files>cp-learn.files',
      'cp-learn.pr>var-repo.pr',
      W('var-repo.tpl>sc-install.tpl', { k: 'loop', via: [[11.4, 5.2], [-0.4, 5.2]], badge: 'новая версия → все проекты' })
    ],
    comments: [
      { id: 'c-install', title: '0 · Установка', color: '#6b7280', nodes: ['ev-install', 'sc-install'],
        what: 'Один раз на проект: сгенерировать конвейер из шаблонов под Claude Code, Codex или оба.' },
      { id: 'c-req', title: '1 · Требования', color: '#4f7bd9', nodes: ['ev-start', 'sw-intake', 'cp-spec', 'cp-spec-feature'],
        what: 'Из идеи, чужого приложения или описания фичи — проверенный чертёж spec/ или эпик на доске.' },
      { id: 'c-plan', title: '2 · План', color: '#2aa198', nodes: ['sw-plan', 'var-bundle', 'fn-plan', 'fn-phases', 'g-plan', 'g-phases', 'var-board', 'var-phases'],
        what: 'Разложить чертёж на карточки-задания или план по фазам — за вашим «да».' },
      { id: 'c-build', title: '3 · Реализация и сверка', color: '#3f9d4a', nodes: ['cp-feature', 'cp-phase', 'var-app', 'var-refs', 'fn-fit'],
        what: 'По одному SPEC за запуск до пуша; клон потом сверяется с оригиналом, расхождения возвращаются на доску.' },
      { id: 'c-learn', title: '4 · Самообучение', color: '#c9a227', nodes: ['cp-learn', 'var-repo'],
        what: 'Оценка, уроки и патчи к шаблонам — новая версия фабрики достаётся всем проектам.' },
      { id: 'c-modes', title: 'Остальные режимы /mp', color: '#58657a', nodes: ['m-bugfix', 'm-discuss', 'm-spec', 'm-device', 'm-coverage', 'm-deliver', 'm-upgrade', 'm-continue', 'm-check'],
        what: 'Ещё девять режимов из 15: у каждого свой короткий рунбук в manifest.tsv.' }
    ]
  });

  /* /mp-spec — stage boxes separated left→right (Г1 from 7.75 to 7.8, C from 9.45 to 9.7, D/E/F
   * shifted +0.4…+0.8); greenfield band lowered to 4.55; fn-owner/end-ask one column right so the
   * critic's fail wire runs forward. Reroute knots keep every wire off other nodes: in-spec sits left
   * of sw-mode so its data fan clears the switch, the analysers reach fn-nav through the gap after
   * join-a, gt-questions is lifted so the model wire passes under it, and the critic reads the bundle
   * through its own getter (var-bundle@f) while preflight failures drop into a corridor under it.
   * Integration pass: the six E agents moved to 16.75 and join-e with everything after it +0.7, so the
   * Parallel fan-out and the Join fan-in get ~160px of horizontal run instead of vertical bundles. */
  var spec = graph({
    id: 'spec', tab: '/mp-spec', crumb: ['Обзор', '/mp-spec'], parent: 'overview', entry: 'in-spec',
    title: '/mp-spec: чертёж приложения',
    what: '/mp-spec собирает чертёж приложения — бандл spec/ примерно из 18 документов. Три входа: клон по скриншотам и APK, с нуля по интервью или одна фича в готовый проект (эпик сразу на доску). Дальше строгая цепочка C → D, параллельный блок качества E и критик F; человек подтверждает инвентарь (GATE 1) и весь бандл (GATE 2).',
    nodes: [
      N('in-spec', 'in-spec', -0.55, 3),
      N('sw-mode', 'sw-mode', 0.8, 3.25),
      N('cp-crawl', 'crawl-trio', 1.6, 1.4),
      N('par-a', 'par-a', 2.55, 1.5),
      N('fn-play', 'play-store-scraper', 3.2, 0),
      N('fn-biz', 'screenshot-business-analyzer', 3.2, 1),
      N('fn-style', 'screenshot-style-analyzer', 3.2, 2),
      N('fn-apk', 'apk-analyzer', 3.2, 3),
      N('join-a', 'join-a', 4.1, 1.5),
      N('fn-nav', 'navigation-flow-analyzer', 4.75, 1.1),
      N('fn-model', 'data-model-extractor', 5.75, 1.1),
      N('gt-questions', 'gt-questions', 6.7, 0.75),
      N('gt-grill', 'gt-grill', 1.6, 4.55),
      N('gt-interview', 'gt-interview', 2.6, 4.55),
      N('g-gate1', 'g-gate1', 7.8, 2.6),
      N('var-inv', 'var-inv', 8.8, 2.75),
      N('fn-const', 'constitution-author', 9.7, 2.6),
      N('fn-brief', 'ms-brief', 10.65, 2.6),
      N('fn-req', 'requirements-author', 11.6, 2.6),
      N('fn-stories', 'user-story-writer', 12.55, 2.6),
      N('fn-ac', 'acceptance-criteria-writer', 13.5, 2.6),
      N('fn-design', 'ms-design', 14.6, 2.6),
      N('par-e', 'par-e', 15.75, 2.6),
      N('fn-nfr', 'nfr-analyzer', 16.75, 0),
      N('fn-a11y', 'a11y-reviewer', 16.75, 1),
      N('fn-risk', 'risk-estimator', 16.75, 2),
      N('fn-sec', 'security-privacy-reviewer', 16.75, 3),
      N('fn-analytics', 'analytics-taxonomy-designer', 16.75, 4),
      N('fn-fitlist', 'fit-checklist-author', 16.75, 5),
      N('var-inv@e', 'var-inv', 15.85, 4.05, { get: true, set: false, title: 'Пакет улик', tech: 'evidence/core.json', pins: io([], ['inv:SpecBundle:пакет улик']), note: 'Тот же пакет улик, прочитанный для фазы E.' }),
      N('join-e', 'join-e', 18.05, 2.6),
      N('var-bundle', 'var-bundle', 18.05, 4.2, { title: 'spec/ бандл' }),
      N('sc-preflight', 'spec-preflight.sh', 18.95, 2.6),
      N('var-bundle@f', 'var-bundle', 19.0, 1.95, { get: true, set: false, title: 'spec/ бандл', pins: io([], ['bundle:SpecBundle:spec/']),
        note: 'Тот же бандл spec/, прочитанный критиком: механику уже проверил скрипт, критик читает смысл.' }),
      N('fn-eval', 'spec-evaluator', 20.05, 2.6),
      N('fn-owner', 'ms-owner', 21.0, 4.1),
      N('end-ask', 'end-ask', 22.0, 4.1),
      N('g-gate2', 'g-gate2', 21.0, 2.6),
      N('out-spec', 'out-spec', 22.0, 2.6),
      N('fn-scout', 'grounding-scout', 1.6, 6.3),
      N('gt-grill-f', 'gt-grill-f', 2.6, 6.3),
      N('gt-decompose', 'gt-decompose', 3.6, 6.3),
      N('fn-emit', 'ms-emit', 4.6, 6.3),
      N('fn-eval@feat', 'spec-evaluator', 5.6, 6.3, {
        title: 'Лёгкая проверка эпика', note: 'Тот же критик, настроенный на эпик: согласованность SPEC-ов, обоснованность CHANGED_HINT и порядок правок одного файла.',
        pins: io(['>in', 'epic:SPEC[]:эпик'], ['>pass:pass', '>fail:fail', 'epic:SPEC[]:эпик'])
      }),
      N('out-spec@feat', 'out-spec', 6.6, 6.3, {
        title: 'Выход: эпик на доске', tech: 'Step 10 · эпик',
        note: 'Печатает путь эпика, число SPEC-ов и команду /mp --feature --next.',
        pins: io(['>in', 'epic:SPEC[]:эпик'], [])
      })
    ],
    wires: [
      'in-spec>sw-mode',
      'sw-mode.clone>cp-crawl>par-a',
      'par-a.a0>fn-play', 'par-a.a1>fn-biz', 'par-a.a2>fn-style', 'par-a.a3>fn-apk',
      'fn-play.then>join-a.i0', 'fn-biz.then>join-a.i1', 'fn-style.then>join-a.i2', 'fn-apk.then>join-a.i3',
      'join-a>fn-nav>fn-model>gt-questions>g-gate1',
      'sw-mode.green>gt-grill>gt-interview',
      W('gt-interview>g-gate1', { via: [[7.3, 4.9]] }),
      'g-gate1.ok>fn-const>fn-brief>fn-req>fn-stories>fn-ac>fn-design>par-e',
      'par-e.e0>fn-nfr', 'par-e.e1>fn-a11y', 'par-e.e2>fn-risk', 'par-e.e3>fn-sec', 'par-e.e4>fn-analytics', 'par-e.e5>fn-fitlist',
      'fn-nfr.then>join-e.i0', 'fn-a11y.then>join-e.i1', 'fn-risk.then>join-e.i2', 'fn-sec.then>join-e.i3', 'fn-analytics.then>join-e.i4', 'fn-fitlist.then>join-e.i5',
      'join-e>sc-preflight',
      'sc-preflight.pass>fn-eval', W('sc-preflight.fail>fn-owner', { via: [[19.85, 3.85]] }),
      'fn-eval.pass>g-gate2.ok>out-spec',
      'fn-eval.fail>fn-owner',
      W('fn-owner.retry>sc-preflight', { k: 'loop', via: [[21.9, 5.15], [18.82, 5.15], [18.82, 3.3]], badge: '≤2 круга' }),
      'fn-owner.spent>end-ask',
      W('sw-mode.feature>fn-scout', { via: [[1.38, 4.1], [1.38, 6.55]] }),
      'fn-scout>gt-grill-f>gt-decompose.ok>fn-emit>fn-eval@feat',
      'fn-eval@feat.pass>out-spec@feat',
      W('fn-eval@feat.fail>fn-emit', { k: 'loop', badge: '≤2 круга' }),
      /* data */
      W('in-spec.idea>fn-play.idea', { via: [[1.45, 1.2]] }), 'in-spec.idea>gt-grill.idea', 'in-spec.idea>fn-scout.idea',
      'in-spec.screens>cp-crawl.screens', 'in-spec.apk>cp-crawl.apk', W('in-spec.apk>fn-apk.apk', { via: [[0.62, 2.95], [2.95, 2.95]] }),
      W('cp-crawl.states>fn-biz.shots', { via: [[2.5, 1.35], [3.1, 1.35]] }),
      W('cp-crawl.states>fn-style.shots', { via: [[2.5, 2.62], [3.1, 2.62]] }),
      W('fn-biz.screens>fn-nav.screens', { via: [[4.02, 1.35], [4.7, 1.35]] }),
      W('fn-biz.amb>gt-questions.amb', { via: [[4.08, 0.9], [6.55, 0.9]] }),
      W('fn-apk.manifest>fn-nav.manifest', { via: [[4.66, 2.73]] }), W('fn-play.meta>fn-nav.meta', { via: [[4.66, 1.2]] }),
      'fn-nav.nav>fn-model.nav', 'fn-model.model>g-gate1.a',
      'gt-questions.ans>g-gate1.ans',
      'gt-grill.dec>gt-interview.dec', W('gt-interview.ans>g-gate1.g', { via: [[7.2, 5.05]] }),
      'fn-style.tokens>g-gate1.tokens',
      'g-gate1.inv>var-inv.inv', 'var-inv.inv>fn-const.inv',
      'fn-const.doc>fn-brief.doc', 'fn-brief.doc>fn-req.doc', 'fn-req.doc>fn-stories.doc', 'fn-stories.doc>fn-ac.doc', 'fn-ac.doc>fn-design.doc',
      'var-inv@e.inv>fn-nfr.ev', 'var-inv@e.inv>fn-a11y.ev', 'var-inv@e.inv>fn-risk.ev', 'var-inv@e.inv>fn-sec.ev', 'var-inv@e.inv>fn-analytics.ev', 'var-inv@e.inv>fn-fitlist.ev',
      W('fn-design.doc>var-bundle.bundle', { via: [[15.5, 5.97], [17.9, 5.97]] }),
      'fn-nfr.doc>var-bundle.bundle', 'fn-a11y.doc>var-bundle.bundle', 'fn-risk.doc>var-bundle.bundle',
      'fn-sec.doc>var-bundle.bundle', 'fn-analytics.doc>var-bundle.bundle', 'fn-fitlist.doc>var-bundle.bundle',
      'var-bundle.bundle>sc-preflight.bundle', 'var-bundle@f.bundle>fn-eval.bundle',
      'sc-preflight.report>fn-eval.mech', W('sc-preflight.report>fn-owner.mech', { via: [[19.85, 3.97]] }),
      'fn-eval.findings>fn-owner.findings', 'fn-eval.trace>g-gate2.trace', 'g-gate2.bundle>out-spec.bundle',
      'fn-scout.facts>gt-grill-f.facts', 'gt-grill-f.dec>gt-decompose.dec', 'gt-decompose.plan>fn-emit.plan',
      'fn-emit.epic>fn-eval@feat.epic', 'fn-eval@feat.epic>out-spec@feat.epic'
    ],
    comments: [
      { id: 'c-clone', title: 'A · Клон', color: '#4f7bd9', nodes: ['cp-crawl', 'par-a', 'fn-play', 'fn-biz', 'fn-style', 'fn-apk', 'join-a', 'fn-nav', 'fn-model', 'gt-questions'],
        what: 'Разобрать чужое приложение: робот-обход по желанию, четыре анализатора одновременно, карта переходов, модель данных и вопросы.' },
      { id: 'c-green', title: 'A · С нуля', color: '#6d8fe0', nodes: ['gt-grill', 'gt-interview'],
        what: 'Идея без картинок: допрос по дереву решений и интервью в пять этапов.' },
      { id: 'c-feature', title: 'Режим --feature', color: '#3f9d4a', nodes: ['fn-scout', 'gt-grill-f', 'gt-decompose', 'fn-emit', 'fn-eval@feat', 'out-spec@feat'],
        what: 'Фича в готовый проект: разведка кода, вопросы, разбиение и эпик прямо на доске — без бандла spec/.' },
      { id: 'c-gate1', title: 'Г1 + B · Инвентарь', color: '#c9a227', nodes: ['g-gate1', 'var-inv'],
        what: 'Первое «да» человека: список экранов и сущностей, из которого растут все документы.' },
      { id: 'c-reqs', title: 'C · Требования → истории → приёмка', color: '#2aa198', nodes: ['fn-const', 'fn-brief', 'fn-req', 'fn-stories', 'fn-ac'],
        what: 'Строгая цепочка: свод правил, бриф, требования EARS, истории и сценарии Gherkin.' },
      { id: 'c-design', title: 'D · Дизайн', color: '#8e6bd8', nodes: ['fn-design'],
        what: 'Платформенно-нейтральный дизайн и отдельное приложение про Android.' },
      { id: 'c-quality', title: 'E · Качество — одновременно', color: '#d9822b', nodes: ['par-e', 'fn-nfr', 'fn-a11y', 'fn-risk', 'fn-sec', 'fn-analytics', 'fn-fitlist', 'var-inv@e', 'join-e', 'var-bundle'],
        what: 'До шести специалистов одновременно; кого звать — решает quality-plan.json.' },
      { id: 'c-critic', title: 'F · Критик и петля', color: '#d64545', nodes: ['var-bundle@f', 'sc-preflight', 'fn-eval', 'fn-owner', 'end-ask', 'g-gate2', 'out-spec'],
        what: 'Механика скриптом, смысл — критиком; блокеры возвращаются владельцу не больше двух раз, затем второе «да» человека.' }
    ]
  });

  /* /mp --feature — terminal exits (out-auto, end-split, end-review, end-verify) share the stops
   * lane −0.4 outside the stage boxes; the runner fallback AND the one auto-fix sit in the band
   * above the spine, so the repair box can live under «Тесты» (lanes 4.65–6.9); var-diff sits
   * between the two developers. Integration pass: «Ревью» +0.4 and everything after it +1.0 so the
   * gaps can carry reroutes; long data wires became getters next to their readers (var-diff@t,
   * var-spec@post, var-diff@post) or run in corridors under the spine; the repair box flows left →
   * right into the final repair (only the round loop back to fn-sem is dashed). */
  var feature = graph({
    id: 'feature', tab: '/mp --feature', crumb: ['Обзор', '/mp --feature'], parent: 'overview', entry: 'in-feature',
    title: '/mp --feature: одна задача до пуша',
    what: '/mp --feature --next берёт верхнюю SPEC с доски и доводит её до пуша — строго по одному шагу за раз. Автоматы взвешивают задачу и выбирают маршрут риска, разработчик нужного уровня пишет код, ревью идёт скриптом и по смыслу, тесты пишет агент, а запускает стенд; одна автопочинка, затем стоп. Пушит только ваше «y» (HARD STOP).',
    nodes: [
      N('in-feature', 'in-feature', 0, 2.2),
      N('fn-stale', 'ms-stale', 0.9, 2.2),
      N('out-auto', 'out-auto', 1.85, -0.4),
      N('sc-size', 'mp-spec-complexity.sh', 2, 2.2),
      N('g-size', 'g-size', 2.95, 0.65),
      N('end-split', 'end-split', 3.9, -0.4),
      N('var-matrix', 'var-matrix', 2.95, 3.45),
      N('sc-route', 'mp-risk-route.sh', 3, 2.2),
      N('fn-ui', 'mp-ui-designer-android', 4.1, 2.2),
      N('sw-tier', 'sw-tier', 5.05, 1.45),
      N('var-spec', 'var-spec', 5.05, 3.8),
      N('fn-dev-std', 'mp-developer-standard-android', 5.8, 1.35),
      N('fn-dev', 'mp-developer-android', 5.8, 3.05),
      N('var-diff', 'var-diff', 6.62, 2.4),
      N('sc-review', 'mp-reviewer-android.sh', 7.55, 2.2),
      N('fn-review-fb', 'mp-reviewer-android', 7.55, 0.65),
      N('end-review', 'end-review', 8.55, -0.4),
      N('var-matrix@sem', 'var-matrix', 7.8, 3.55, {
        get: true, set: false, title: 'Матрица для ревью', pins: io([], ['matrix:Checklist:матрица']),
        note: 'Та же замороженная матрица, прочитанная для ревью: покрытие covered/total отчитывается по ней каждый круг.'
      }),
      N('fn-sem', 'mp-semantic-reviewer-android', 9.05, 2.2),
      N('sw-round', 'sw-round', 10.35, 4.7),
      N('fn-dev@repair', 'developer-routed', 13.8, 4.65, {
        title: 'Ремонт: все ID пакетом', note: 'DEVELOPER_AGENT после эскалации: все finding ID одним пакетом, целостный пересмотр, регрессионный тест на каждое, resolved_findings в ответе.',
        pins: io(['>in', 'findings:Findings[]:все finding ID', 'capsule:Checklist:капсула'], ['>then', 'files:Files[]:файлы + ID'])
      }),
      N('fn-arch', 'mp-architect', 11.0, 5.5),
      N('sw-capsule', 'sw-capsule', 11.95, 5.55),
      N('g-capsule', 'g-capsule', 12.8, 6.3),
      N('end-handoff', 'end-handoff', 11.0, 6.9),
      N('var-diff@t', 'var-diff', 10.15, 3.25, {
        get: true, set: false, title: 'CHANGED_FILES', pins: io([], ['files:Files[]:CHANGED_FILES']),
        note: 'Те же CHANGED_FILES для тестировщика: по ним он находит, какие тесты писать и какие устарели (MODIFIED_EXISTING).'
      }),
      N('fn-tester', 'mp-tester-android', 10.75, 2.2),
      N('sc-run', 'mp-runner-android.sh', 11.75, 2.2),
      N('fn-run-fb', 'mp-runner-android', 12.6, 0.65),
      N('br-fixed', 'br-fixed', 13.62, 0.7),
      N('fn-dev@fix', 'developer-routed', 14.35, 0.62, {
        title: 'Одна автопочинка', note: 'Ровно одна попытка тем же DEVELOPER_AGENT, что выбрал маршрут: только сделать проверки зелёными, поведение не менять.',
        pins: io(['>in', 'failed:Report:FAILED CHECKS'], ['>then', 'files:Files[]:changed_files'])
      }),
      N('end-run', 'end-run', 14.35, -0.45),
      N('var-diff@v', 'var-diff', 15.45, 1.2, {
        get: true, set: false, title: 'Все CHANGED_FILES', pins: io([], ['files:Files[]:CHANGED_FILES']),
        note: 'Объединение файлов всех шагов разработчика, включая ремонт и автопочинку. Критик получает отсюда свежий пакет улик — пути, хэши и дифф, но не выводы первого ревью.'
      }),
      N('fn-critic', 'mp-semantic-reviewer-android', 16.15, 2.2, {
        title: 'Независимый критик', cond: 'independent_critic',
        note: 'Второй проход смыслового ревьюера со свежим пакетом улик: SPEC, пути и хэши, дифф, артефакты тестов — без выводов первого ревью.',
        pins: io(['>in', 'files:Files[]:свежие улики'], ['>pass:pass', '>fail:fail', 'findings:Findings[]:findings'])
      }),
      N('fn-verify', 'mp-verifier-android', 17.15, 2.2),
      N('end-verify', 'end-verify', 18.05, -0.4),
      N('g-push', 'g-push', 18.15, 2.2),
      N('end-wait', 'end-wait', 19.1, 0.65),
      N('sc-push', 'sc-push', 19.15, 2.2),
      N('fn-docs', 'mp-docs', 20.25, 2.2),
      N('var-spec@post', 'var-spec', 20.25, 3.0, { note: 'Тот же SPEC из active/: после пуша его читает хвост самообучения.' }),
      N('var-diff@post', 'var-diff', 20.25, 3.45, {
        get: true, set: false, title: 'CHANGED_FILES', pins: io([], ['files:Files[]:CHANGED_FILES']),
        note: 'Все изменённые файлы задачи — для оценки и уроков после пуша.'
      }),
      N('cp-post', 'cp-post', 21.25, 2.2),
      N('var-diff@out', 'var-diff', 21.5, 3.45, {
        get: true, set: false, title: 'коммит + файлы', pins: io([], ['files:Files[]:коммит']),
        note: 'Коммит и изменённые файлы — их вписывают в Implementation links SPEC-а в done/.'
      }),
      N('out-done', 'out-done', 22.25, 2.2)
    ],
    wires: [
      'in-feature>fn-stale',
      'fn-stale.todo>sc-size', 'fn-stale.done>out-auto',
      'sc-size.ok>sc-route', 'sc-size.split>g-size',
      W('g-size.n>sc-route', { via: [[3.85, 1.62], [2.93, 1.62], [2.93, 2.3]] }),
      'g-size.y>end-split',
      'sc-route>fn-ui>sw-tier',
      'sw-tier.std>fn-dev-std>sc-review', 'sw-tier.pow>fn-dev>sc-review',
      'sc-review.pass>fn-sem', 'sc-review.fail>end-review',
      W('sc-review.crash>fn-review-fb', { k: 'fallback', via: [[8.47, 1.85], [7.42, 1.85]] }),
      'fn-review-fb.pass>fn-sem', 'fn-review-fb.fail>end-review',
      'fn-sem.pass>fn-tester', 'fn-sem.fix>sw-round',
      'sw-round.r01>fn-dev@repair',
      W('fn-dev@repair>fn-sem', { k: 'loop', via: [[14.8, 3.88], [8.95, 3.88], [8.95, 3.0]], badge: 'круг 1–2' }),
      'sw-round.r2>fn-arch>sw-capsule',
      'sw-capsule.patch>fn-dev@repair',
      'sw-capsule.design>g-capsule',
      'g-capsule>fn-dev@repair',
      W('sw-round.r3>end-handoff', { k: 'blocked' }),
      'fn-tester>sc-run',
      'sc-run.pass>fn-critic', W('sc-run.fail>br-fixed', { via: [[13.52, 1.95]] }),
      W('sc-run.crash>fn-run-fb', { k: 'fallback' }),
      W('fn-run-fb.pass>fn-critic', { via: [[13.45, 1.95]] }), 'fn-run-fb.fail>br-fixed',
      'br-fixed.no>fn-dev@fix',
      W('fn-dev@fix>sc-run', { k: 'loop', via: [[15.3, 0.35], [11.62, 0.35], [11.62, 2.0]], badge: '1 попытка' }),
      'br-fixed.yes>end-run',
      'fn-critic.pass>fn-verify', W('fn-critic.fail>end-verify', { via: [[17.02, 1.25]] }),
      'fn-verify.pass>g-push', 'fn-verify.fail>end-verify',
      'g-push.y>sc-push>fn-docs>cp-post>out-done',
      'g-push.n>end-wait',
      /* data */
      'in-feature.specs>fn-stale.specs',
      'fn-stale.spec>sc-size.spec',
      W('fn-stale.spec>sc-route.spec', { via: [[1.95, 3.32], [2.92, 3.32]] }), W('fn-stale.spec>fn-ui.spec', { via: [[1.95, 3.32], [3.97, 3.32]] }),
      'sc-size.report>g-size.report', 'sc-size.matrix>var-matrix.matrix',
      W('sc-route.tier>sw-tier.sel', { via: [[3.95, 1.95], [4.97, 1.95]] }),
      'fn-ui.tokens>fn-dev.tokens', 'fn-ui.tokens>fn-dev-std.tokens',
      'var-spec.spec>fn-dev.spec', 'var-spec.spec>fn-dev-std.spec',
      'fn-dev.files>var-diff.files', 'fn-dev-std.files>var-diff.files',
      'var-diff.files>sc-review.files', 'var-diff.files>fn-review-fb.files', W('var-diff.files>fn-sem.files', { via: [[7.35, 3.35], [8.75, 3.35]] }),
      'var-diff@t.files>fn-tester.files',
      'var-matrix@sem.matrix>fn-sem.matrix',
      'fn-sem.round>sw-round.sel',
      W('fn-sem.findings>fn-dev@repair.findings', { via: [[9.9, 4.08], [13.6, 4.08]] }), W('fn-sem.findings>fn-arch.findings', { via: [[9.9, 4.25], [10.25, 5.95]] }),
      'fn-arch.verdict>sw-capsule.sel',
      W('fn-arch.capsule>fn-dev@repair.capsule', { via: [[11.93, 5.3]] }),
      'fn-arch.capsule>g-capsule.capsule',
      'fn-tester.tests>sc-run.tests', 'fn-tester.shots>sc-run.record', 'fn-tester.tests>fn-run-fb.tests',
      'sc-run.report>fn-dev@fix.failed',
      'var-diff@v.files>fn-critic.files', W('var-diff@v.files>fn-verify.files', { via: [[17.0, 1.7]] }),
      'fn-verify.checklist>g-push.checklist',
      'var-spec@post.spec>cp-post.spec', 'var-diff@post.files>cp-post.files',
      'var-diff@out.files>out-done.files'
    ],
    comments: [
      { id: 'c-take', title: '1 · Взять задачу', color: '#2aa198', nodes: ['in-feature', 'fn-stale'],
        what: 'Верхний SPEC с доски; сначала дешёвая проверка, не сделан ли он уже.' },
      { id: 'c-route', title: '2 · Размер и маршрут', color: '#c9a227', nodes: ['sc-size', 'g-size', 'var-matrix', 'sc-route'],
        what: 'Два автомата за секунды: не слишком ли велика задача и насколько она рискованная.' },
      { id: 'c-impl', title: '3 · Реализация', color: '#3f9d4a', nodes: ['fn-ui', 'sw-tier', 'var-spec', 'fn-dev-std', 'fn-dev', 'var-diff'],
        what: 'Токены темы, затем разработчик того уровня, который выбрал маршрут.' },
      { id: 'c-review', title: '4 · Ревью', color: '#d9822b', nodes: ['sc-review', 'fn-review-fb', 'var-matrix@sem', 'fn-sem'],
        what: 'Границы слоёв — скриптом за 0 токенов, смысл — ревьюером по замороженной матрице.' },
      { id: 'c-repair', title: 'Петля ремонта: ≤2 круга → капсула → последний круг', color: '#d64545', nodes: ['sw-round', 'fn-dev@repair', 'fn-arch', 'sw-capsule', 'g-capsule', 'end-handoff'],
        what: 'Замечания чинятся пакетом; если за два круга не сошлось — архитектор фиксирует решение, и остаётся один последний круг.' },
      { id: 'c-test', title: '5 · Тесты и автопочинка', color: '#5aa9e6', nodes: ['var-diff@t', 'fn-tester', 'sc-run', 'fn-run-fb', 'br-fixed', 'fn-dev@fix', 'end-run'],
        what: 'Тестировщик пишет, стенд запускает; одна автопочинка и стоп.' },
      { id: 'c-ship', title: '6 · Проверка и пуш', color: '#8e6bd8', nodes: ['var-diff@v', 'fn-critic', 'fn-verify', 'g-push', 'end-wait', 'sc-push'],
        what: 'Критик по свежим уликам, верификатор с чек-листом и HARD STOP — пушит только ваше «y».' },
      { id: 'c-close', title: '7 · Закрытие', color: '#6b7280', nodes: ['fn-docs', 'var-spec@post', 'var-diff@post', 'cp-post', 'var-diff@out', 'out-done'],
        what: 'Документы, хвост самообучения и SPEC в done/.' }
    ]
  });

  /* Самообучение — lessons stage shifted +0.25; var-telemetry moved right of sc-record so the
   * telemetry wire runs forward; the --improve chain from g-pr on (and the release stage) is pulled
   * 5.9 columns left under the lessons row, so no long empty exec wire and the graph is ~4 cols narrower; the
   * --reflect band drops to lane 6 and reads all projects through its own getter (var-projects).
   * The queue is drawn as UE variable instances: --reflect writes through its own SET (var-queue@r) and
   * --drain reads through a GET (var-queue@d), so no wire crosses the --improve band's title bar. */
  var learn = graph({
    id: 'learn', tab: 'Самообучение', crumb: ['Обзор', 'Самообучение'], parent: 'overview', entry: 'in-post',
    title: 'Самообучение: уроки и улучшение фабрики',
    what: 'Хвост после пуша и улучшение самой фабрики. Одна оценка на эпик, запись в журнал смены, урок — в память проекта или патчем в очередь; /mp --improve превращает заметку или очередь в PR в mobile-pipeline, /mp --reflect ищет уроки, повторившиеся в нескольких проектах.',
    nodes: [
      N('in-post', 'in-post', 0, 1.2),
      N('sc-deliver', 'mp-deliver-telegram.sh', 0.9, 1.2),
      N('g-feedback', 'g-feedback', 1.85, 1.2),
      N('sc-record', 'mp-record-run.sh', 2.85, 1.2),
      N('var-telemetry', 'var-telemetry', 3.65, 2.35),
      N('br-low', 'br-low', 3.8, 1.25),
      N('set-lessons', 'set-lessons', 4.55, 0.25),
      N('fn-knowledge', 'mp-knowledge', 5.65, 1.2),
      N('var-memory', 'var-memory', 6.65, 0.2),
      N('sc-brain', 'mp-brain-memory.sh', 6.65, 2.5),
      N('fn-improve', 'mp-improve', 6.65, 1.2),
      N('var-queue', 'var-queue', 7.65, 2.6),
      N('br-queue', 'br-queue', 7.65, 1.25),
      N('pr-nudge', 'pr-nudge', 8.55, 0.4),
      N('out-next', 'out-next', 9.45, 1.25),
      N('ev-improve', 'ev-improve', 0, 4.0),
      N('fn-improve@cmd', 'mp-improve', 1.0, 4.0, {
        title: 'Патч по заметке', cond: 'заметка, не --drain',
        note: 'Тот же агент, но по прямой заметке человека: ему передают проблему, подсказку, где искать, и путь к репозиторию фабрики.',
        pins: io(['>in', 'note:Idea:заметка'], ['>then', 'patch:Proposal:PROPOSAL'])
      }),
      N('g-pr', 'g-pr', 2.4, 4.0),
      N('sw-drain', 'sw-drain', 3.35, 4.05),
      N('sc-propose', 'mp-propose-improvement.sh', 4.1, 3.65),
      N('sc-drain', 'mp-improve-drain.sh', 4.1, 4.55),
      N('g-merge', 'g-merge', 5.2, 4.0),
      N('var-repo', 'var-repo', 5.2, 5.1),
      N('sc-regen', 'sc-regen', 6.2, 4.0),
      N('out-all', 'out-all', 7.2, 4.0),
      N('ev-reflect', 'ev-reflect', 0, 6.0),
      N('sc-cross', 'mp-cross-reflect.sh', 0.9, 6.0),
      N('fn-reflect', 'mp-reflect', 1.85, 6.0),
      N('pr-reflect', 'pr-reflect', 2.8, 6.0),
      N('var-projects', 'var-telemetry-all', 0, 6.7),
      N('var-queue@r', 'var-queue', 2.8, 6.72, {
        note: 'Та же очередь .ai/proposals/: сюда --reflect кладёт патчи по урокам, которые повторились в нескольких проектах.'
      }),
      N('var-queue@d', 'var-queue', 3.25, 4.85, {
        get: true, set: false, title: 'Очередь', pins: io([], ['queue:Proposal[]:очередь']),
        note: 'Та же очередь .ai/proposals/, прочитанная целиком: --drain сливает все патчи в один PR.'
      })
    ],
    wires: [
      'in-post>sc-deliver>g-feedback>sc-record>br-low',
      'br-low.yes>set-lessons>fn-knowledge', 'br-low.no>fn-knowledge',
      'fn-knowledge>fn-improve>br-queue',
      'br-queue.yes>pr-nudge>out-next', 'br-queue.no>out-next',
      'ev-improve>fn-improve@cmd>g-pr',
      'g-pr.y>sw-drain',
      'sw-drain.note>sc-propose>g-merge', 'sw-drain.drain>sc-drain>g-merge',
      'g-merge>sc-regen>out-all',
      'ev-reflect>sc-cross>fn-reflect>pr-reflect',
      /* data */
      'in-post.files>sc-deliver.files',
      'g-feedback.score>sc-record.score', 'g-feedback.score>br-low.score',
      W('g-feedback.score>fn-knowledge.score', { via: [[3.0, 2.05], [5.5, 2.05]] }),
      W('g-feedback.note>set-lessons.note', { via: [[2.75, 0.95], [4.3, 0.95]] }),
      W('g-feedback.note>fn-knowledge.note', { via: [[3.0, 2.2], [5.5, 2.2]] }),
      'sc-record.report>var-telemetry.rep',
      'var-projects.rep>sc-cross.rep',
      'fn-knowledge.local>var-memory.mem', 'fn-knowledge.brain>sc-brain.mem', 'fn-knowledge.plugin>fn-improve.plugin',
      'fn-improve.patch>var-queue.patch',
      'fn-reflect.patch>var-queue@r.patch',
      'var-queue@d.queue>sc-drain.queue',
      'ev-improve.note>fn-improve@cmd.note',
      W('fn-improve@cmd.patch>sc-propose.patch', { via: [[2.0, 3.8], [3.95, 3.8]] }),
      'sc-propose.pr>var-repo.pr', 'sc-drain.pr>var-repo.pr',
      'var-repo.tpl>sc-regen.tpl',
      W('g-merge.pr>out-all.pr', { via: [[6.15, 4.85], [7.05, 4.85]] }),
      'sc-cross.digest>fn-reflect.digest'
    ],
    comments: [
      { id: 'c-tail', title: 'Хвост после пуша', color: '#c9a227', nodes: ['in-post', 'sc-deliver', 'g-feedback', 'sc-record', 'var-telemetry', 'br-low', 'set-lessons'],
        what: 'Сборка в телефон, одна оценка человека и запись в журнал смены.' },
      { id: 'c-lessons', title: 'Куда идут уроки', color: '#9eb1ff', nodes: ['fn-knowledge', 'var-memory', 'sc-brain', 'fn-improve', 'var-queue', 'br-queue', 'pr-nudge', 'out-next'],
        what: 'Урок проекта — в его память, урок для всех — патчем в очередь, предпочтение человека — кандидатом во «второй мозг».' },
      { id: 'c-improve', title: '--improve: патч → PR', color: '#8e6bd8', nodes: ['ev-improve', 'fn-improve@cmd', 'g-pr', 'sw-drain', 'sc-propose', 'sc-drain', 'var-queue@d'],
        what: 'Одна заметка — свой PR; очередь — один общий PR. Без вашего «y» ничего не уходит.' },
      { id: 'c-reflect', title: '--reflect: уроки всех проектов', color: '#2aa198', nodes: ['ev-reflect', 'sc-cross', 'fn-reflect', 'pr-reflect', 'var-projects', 'var-queue@r'],
        what: 'Скрипт собирает уроки всех проектов без LLM, агент отбирает повторяющиеся.' },
      { id: 'c-release', title: 'Новая версия — всем', color: '#3f9d4a', nodes: ['g-merge', 'var-repo', 'sc-regen', 'out-all'],
        what: 'Человек мержит, CI пересобирает плагины, все проекты получают улучшение.' }
    ]
  });

  [overview, spec, feature, learn].forEach(function (g) {
    g.comments.forEach(function (c, i) { if (c.key == null) c.key = i + 1; });
  });

  /* ------------------------------------------------------------------ presets */
  var presets = {
    bugfix: {
      graph: 'feature', title: '/mp --bugfix', src: RT + 'bugfix.md',
      banner: 'Режим --bugfix: перед цепочкой — воспроизведение буквальных шагов пользователя на телефоне (при RUNTIME_BUG); после прогона — перепроверка на телефоне; верификатор может быть lite, только при низком риске.',
      highlight: ['sc-size', 'sc-route', 'sw-tier', 'fn-dev-std', 'fn-dev', 'var-diff', 'sc-review', 'fn-review-fb', 'fn-sem', 'sw-round', 'fn-dev@repair',
        'fn-arch', 'sw-capsule', 'g-capsule', 'sc-run', 'fn-run-fb', 'br-fixed', 'fn-dev@fix', 'fn-critic', 'fn-verify', 'g-push', 'sc-push', 'fn-docs', 'cp-post'],
      dim: ['fn-stale', 'out-auto', 'fn-ui', 'fn-tester'],
      notes: {
        'fn-dev': 'В --bugfix разработчик сам пишет регрессионный тест (красный → зелёный); отдельного тестировщика нет.',
        'sc-review': 'Запускается, если исправление трогает presentation/ или domain/ или маршрут требует смыслового ревью.',
        'sc-run': 'После зелёного прогона при RUNTIME_BUG — пересборка, установка и повтор шагов пользователя на устройстве (device_repro_confirmed).',
        'fn-verify': 'mp-verifier-lite-android только при маршруте risk:"low", иначе полный верификатор.'
      }
    }
  };

  /* ------------------------------------------------------------------ scenarios */
  function step(w, n, o) {
    var s = mix({}, o || {});
    if (w) s.w = hop(w);
    s.n = n;
    return s;
  }
  var SPEC_PATH = '.claude/specs/active/watering-reminder.md';
  var FILES3 = ['domain/reminder/WateringReminderScheduler.kt', 'data/reminder/ReminderWorker.kt', 'presentation/plant/ReminderToggle.kt'];
  var RUN_OK = { pass: true, mode: 'full', tests: '42 passed / 0 failed', detekt: 'ok', lint: 'ok', coverage: '71%', screenshots: 'skipped' };
  var VERIFY_OK = defs['mp-verifier-android'].sample;

  /* shared head of the /mp --feature scenarios; the route decides which developer writes the code */
  var DEV_STD = 'mp-developer-standard-android', DEV_POW = 'mp-developer-android';
  function ftHead(route, size, dev) {
    var pow = route.developer_tier === 'powerful';
    var devNode = pow ? 'fn-dev' : 'fn-dev-std', out = pow ? 'pow' : 'std';
    return [
      step(null, 'in-feature', { text: '/mp --feature --next → backlog/watering-reminder.md («Напоминание о поливе»)' }),
      step('in-feature>fn-stale', 'fn-stale', { out: 'todo', data: ['in-feature.specs>fn-stale.specs'],
        text: 'Не сделано ли уже? grep WateringReminderScheduler — не найдено → backlog/ → active/' }),
      step('fn-stale.todo>sc-size', 'sc-size', { out: 'ok', data: ['fn-stale.spec>sc-size.spec', 'sc-size.matrix>var-matrix.matrix'], json: size }),
      step('sc-size.ok>sc-route', 'sc-route', { data: ['fn-stale.spec>sc-route.spec'], json: route }),
      step('sc-route>fn-ui', 'fn-ui', { data: ['fn-stale.spec>fn-ui.spec'], json: defs['mp-ui-designer-android'].sample ? JSON.parse(defs['mp-ui-designer-android'].sample) : null }),
      step('fn-ui>sw-tier', 'sw-tier', { out: out, data: ['sc-route.tier>sw-tier.sel'],
        text: 'developer_tier = ' + route.developer_tier + ' → DEVELOPER_AGENT = ' + (pow ? DEV_POW : DEV_STD) }),
      step('sw-tier.' + out + '>' + devNode, devNode, { data: ['var-spec.spec>' + devNode + '.spec', 'fn-ui.tokens>' + devNode + '.tokens', devNode + '.files>var-diff.files'],
        json: dev || { changed_files: FILES3, commit: '8a41d07' } })
    ];
  }
  var SIZE_OK = JSON.parse(defs['mp-spec-complexity.sh'].sample);
  var ROUTE_LOW = { ok: true, risk: 'low', score: 2, developer_tier: 'standard', semantic_review: false, verifier: 'full', independent_critic: false, signals: 'state_or_concurrency' };

  function ftReviewSkipTest() {
    return [
      step('fn-dev-std>sc-review', 'sc-review', { out: 'pass', data: ['var-diff.files>sc-review.files'], json: { pass: true, violations: [], warnings: [], by_check: {} },
        counter: { node: 'sc-route', text: 'прогон 2/2: low' } }),
      step('sc-review.pass>fn-sem', 'fn-sem', { st: 'skip', out: 'pass', text: 'semantic_review=false → смысловое ревью пропущено' }),
      step('fn-sem.pass>fn-tester', 'fn-tester', { data: ['var-diff@t.files>fn-tester.files'], json: JSON.parse(defs['mp-tester-android'].sample) })
    ];
  }
  /* tail from the critic to done/: head = the commit that gets pushed, tests = the last runner count */
  function ftShip(critic, answer, head, tests) {
    var s = [];
    s.push(critic ? critic : step('sc-run.pass>fn-critic', 'fn-critic', { st: 'skip', out: 'pass', text: 'independent_critic=false → критик пропущен' }));
    s.push(step('fn-critic.pass>fn-verify', 'fn-verify', { out: 'pass', data: ['var-diff@v.files>fn-verify.files'], json: JSON.parse(VERIFY_OK) }));
    s.push(step('fn-verify.pass>g-push', 'g-push', { st: 'wait', out: answer === 'y' ? 'y' : 'n', answer: answer, data: ['fn-verify.checklist>g-push.checklist'],
      text: 'g-push ждёт человека: «Готово к пушу? (y/N)» → ' + answer }));
    if (answer !== 'y') {
      s.push(step('g-push.n>end-wait', 'end-wait', { st: 'warn', text: 'N: коммит ' + head + ' остаётся локальным, ждём отзыв' }));
      return s;
    }
    s.push(step('g-push.y>sc-push', 'sc-push', { text: 'git push origin HEAD → 3c9e0f2..' + head + '  HEAD -> main' }));
    s.push(step('sc-push>fn-docs', 'fn-docs', { json: JSON.parse(defs['mp-docs'].sample) }));
    s.push(step('fn-docs>cp-post', 'cp-post', { data: ['var-spec@post.spec>cp-post.spec', 'var-diff@post.files>cp-post.files'], text: 'Хвост после пуша: Telegram → оценка → уроки (граф «Самообучение»)' }));
    s.push(step('cp-post>out-done', 'out-done', { data: ['var-diff@out.files>out-done.files'],
      text: 'SPEC → done/ · feat: напоминание о поливе · Commit ' + head + ' · Tests ' + tests + ' passed · Pushed: yes' }));
    return s;
  }

  var ftHappy = ftHead(ROUTE_LOW, SIZE_OK).concat(ftReviewSkipTest(), [
    step('fn-tester>sc-run', 'sc-run', { out: 'pass', data: ['fn-tester.tests>sc-run.tests', 'fn-tester.shots>sc-run.record'], json: RUN_OK })
  ], ftShip(null, 'y', '8a41d07', 42));

  var RUN_FAIL = { pass: false, mode: 'full', tests: '40 passed / 2 failed', detekt: 'ok', lint: 'ok', coverage: '71%', screenshots: 'skipped',
    errors: ['WateringReminderSchedulerTest > fires at 09:00 local time FAILED', 'WateringReminderSchedulerTest > next reminder after 21:00 is tomorrow FAILED'] };
  var ftAutofix = ftHead(ROUTE_LOW, SIZE_OK).concat(ftReviewSkipTest(), [
    step('fn-tester>sc-run', 'sc-run', { st: 'fail', out: 'fail', data: ['fn-tester.tests>sc-run.tests', 'fn-tester.shots>sc-run.record'], json: RUN_FAIL }),
    step('sc-run.fail>br-fixed', 'br-fixed', { out: 'no', data: ['sc-run.report>fn-dev@fix.failed'], text: 'Автопочинки ещё не было → одна попытка без новой логики' }),
    step('br-fixed.no>fn-dev@fix', 'fn-dev@fix', { actor: DEV_STD, counter: { node: 'br-fixed', text: 'попытка 1/1' },
      json: { changed_files: ['domain/reminder/WateringReminderScheduler.kt'], commit: '5d0b3e8' } }),
    step('fn-dev@fix>sc-run', 'sc-run', { out: 'pass', json: RUN_OK })
  ], ftShip(null, 'y', '5d0b3e8', 42));

  var ftReject = ftHead(ROUTE_LOW, SIZE_OK).concat(ftReviewSkipTest(), [
    step('fn-tester>sc-run', 'sc-run', { out: 'pass', data: ['fn-tester.tests>sc-run.tests', 'fn-tester.shots>sc-run.record'], json: RUN_OK })
  ], ftShip(null, 'N', '8a41d07', 42));

  var SIZE_WARN = { ok: true, verdict: 'warn', cells: 12, cell_budget: 24, dimensions: [{ name: 'state', values: 3 }, { name: 'clock', values: 2 }, { name: 'device', values: 2 }],
    scenarios: 6, modules: 3, layers: 3, matrix_declared: true, frozen_matrix: '.ai/local/mp-matrix-watering-reminder.md',
    advice: '12 acceptance cells — near the budget; expect more than one semantic-review cycle' };
  var ROUTE_STD = { ok: true, risk: 'standard', score: 6, developer_tier: 'standard', semantic_review: true, verifier: 'full', independent_critic: false,
    signals: 'persistence_or_migration;state_or_concurrency' };
  var ROUTE_HIGH = { ok: true, risk: 'high', score: 9, developer_tier: 'powerful', semantic_review: true, verifier: 'full', independent_critic: true,
    signals: 'persistence_or_migration;wiring_or_build;state_or_concurrency' };
  var SEM_DATA = ['var-diff.files>fn-sem.files', 'var-matrix@sem.matrix>fn-sem.matrix'];
  var SEM_PASS = { pass: true, risk: 'standard', findings: [], uncertainties: [], confidence: 'high', coverage: { total: 12, covered: 12, uncovered: [] } };
  var ftRepair = ftHead(ROUTE_STD, SIZE_WARN).concat([
    step('fn-dev-std>sc-review', 'sc-review', { out: 'pass', data: ['var-diff.files>sc-review.files'], json: { pass: true, violations: [], warnings: [], by_check: {} },
      counter: { node: 'sc-route', text: 'прогон 2/2: standard' } }),
    step('sc-review.pass>fn-sem', 'fn-sem', { st: 'fail', out: 'fix', data: SEM_DATA, counter: { node: 'fn-sem', text: 'круг 1 · 7/12' },
      json: { pass: false, risk: 'high', findings: [
        { severity: 'blocker', file: 'domain/reminder/WateringReminderScheduler.kt', line: 42, rule: 'state', fix: 'считать 09:00 в ZoneId.systemDefault(), не в UTC' },
        { severity: 'blocker', file: 'data/reminder/ReminderWorker.kt', line: 17, rule: 'persistence', fix: 'перепланировать напоминания после BOOT_COMPLETED' }],
        uncertainties: [], confidence: 'high', coverage: { total: 12, covered: 7 } } }),
    step('fn-sem.fix>sw-round', 'sw-round', { out: 'r01', data: ['fn-sem.round>sw-round.sel'], st: 'warn',
      text: 'Круг ремонта 1 из 2 · ID: STATE-001, PERSISTENCE-001 · risk:"high" → маршрут повышен (route_escalated=1): DEVELOPER_AGENT = ' + DEV_POW }),
    step('sw-round.r01>fn-dev@repair', 'fn-dev@repair', { actor: DEV_POW, data: ['fn-sem.findings>fn-dev@repair.findings'],
      json: { changed_files: ['domain/reminder/WateringReminderScheduler.kt', 'data/reminder/BootReceiver.kt'], commit: 'c41e9a0',
        resolved_findings: [{ id: 'STATE-001', status: 'fixed', note: 'ZoneId.systemDefault()' }, { id: 'PERSISTENCE-001', status: 'fixed', note: 'BootReceiver перепланирует' }] } }),
    step('fn-dev@repair>fn-sem', 'fn-sem', { st: 'fail', out: 'fix', data: SEM_DATA, counter: { node: 'fn-sem', text: 'круг 2 · 10/12' },
      json: { pass: false, risk: 'high', findings: [{ severity: 'blocker', file: 'domain/reminder/WateringReminderScheduler.kt', line: 58, rule: 'state', fix: 'переход на летнее время: 09:00 не должно стать 10:00' }],
        uncertainties: [], confidence: 'high', coverage: { total: 12, covered: 10 } } }),
    step('fn-sem.fix>sw-round', 'sw-round', { out: 'r01', data: ['fn-sem.round>sw-round.sel'], st: 'warn', text: 'Круг ремонта 2 из 2 · новый ID: STATE-002' }),
    step('sw-round.r01>fn-dev@repair', 'fn-dev@repair', { actor: DEV_POW, data: ['fn-sem.findings>fn-dev@repair.findings'],
      json: { changed_files: ['domain/reminder/WateringReminderScheduler.kt', 'domain/reminder/WateringReminderSchedulerTest.kt'], commit: 'e93b2f4',
        resolved_findings: [{ id: 'STATE-002', status: 'fixed', note: 'ZonedDateTime + тест на переход DST' }] } }),
    step('fn-dev@repair>fn-sem', 'fn-sem', { st: 'fail', out: 'fix', data: SEM_DATA, counter: { node: 'fn-sem', text: 'круг 3 · 11/12' },
      json: { pass: false, risk: 'high', findings: [{ severity: 'blocker', file: 'data/reminder/ReminderWorker.kt', line: 33, rule: 'state', fix: 'при смене времени отменять старый WorkRequest' }],
        uncertainties: [], confidence: 'high', coverage: { total: 12, covered: 11 } } }),
    step('fn-sem.fix>sw-round', 'sw-round', { out: 'r2', data: ['fn-sem.round>sw-round.sel'], st: 'warn',
      text: 'Бюджет двух кругов исчерпан · непокрыто: state=enabled · clock=next-day · device=reboot → капсула дизайна' }),
    step('sw-round.r2>fn-arch', 'fn-arch', { data: ['fn-sem.findings>fn-arch.findings'], text: defs['mp-architect'].sample }),
    step('fn-arch>sw-capsule', 'sw-capsule', { out: 'patch', data: ['fn-arch.verdict>sw-capsule.sel'], text: 'VERDICT: PATCH ALLOWED → без гейта, капсула применена (gate_auto=1)' }),
    step('sw-capsule.patch>fn-dev@repair', 'fn-dev@repair', { actor: DEV_POW, data: ['fn-arch.capsule>fn-dev@repair.capsule'], counter: { node: 'sw-round', text: 'последний круг' },
      json: { changed_files: ['domain/reminder/WateringReminderScheduler.kt', 'data/reminder/ReminderWorker.kt'], commit: 'f07c2d1',
        resolved_findings: [{ id: 'STATE-003', status: 'fixed', note: 'enqueueUniqueWork(REPLACE) по id цветка' }] } }),
    step('fn-dev@repair>fn-sem', 'fn-sem', { out: 'pass', data: SEM_DATA, counter: { node: 'fn-sem', text: '12/12' }, json: SEM_PASS }),
    step('fn-sem.pass>fn-tester', 'fn-tester', { data: ['var-diff@t.files>fn-tester.files'],
      json: { test_files: ['domain/reminder/WateringReminderSchedulerTest.kt', 'data/reminder/BootReceiverTest.kt', 'presentation/plant/ReminderToggleTest.kt'], screenshot_record_needed: false, missing_content_extraction: [], coverage_exceptions: [], stale_tests_reviewed: ['presentation/plant/PlantCardTest.kt'] } }),
    step('fn-tester>sc-run', 'sc-run', { out: 'pass', data: ['fn-tester.tests>sc-run.tests', 'fn-tester.shots>sc-run.record'],
      json: { pass: true, mode: 'full', tests: '51 passed / 0 failed', detekt: 'ok', lint: 'ok', coverage: '74%', screenshots: 'skipped' } })
  ], ftShip(step('sc-run.pass>fn-critic', 'fn-critic', { out: 'pass', data: ['var-diff@v.files>fn-critic.files'],
    text: 'independent_critic=true после эскалации · свежие улики без выводов первого ревью',
    json: SEM_PASS }), 'y', 'f07c2d1', 51));

  /* high risk from the start: the powerful developer writes the code; semantic review and the
   * independent critic both run (and pass) */
  var DEV_POW_OUT = { changed_files: ['domain/reminder/WateringReminderScheduler.kt', 'data/reminder/ReminderWorker.kt', 'data/reminder/BootReceiver.kt', 'app/src/main/AndroidManifest.xml', 'presentation/plant/ReminderToggle.kt'], commit: '2b7e4c9' };
  var SEM_PASS8 = { pass: true, risk: 'high', findings: [], uncertainties: ['точность в Doze видна только на устройстве'], confidence: 'high', coverage: { total: 8, covered: 8, uncovered: [] } };
  var ftPowerful = ftHead(ROUTE_HIGH, SIZE_OK, DEV_POW_OUT).concat([
    step('fn-dev>sc-review', 'sc-review', { out: 'pass', data: ['var-diff.files>sc-review.files'], json: { pass: true, violations: [], warnings: [], by_check: {} },
      counter: { node: 'sc-route', text: 'прогон 2/2: high' } }),
    step('sc-review.pass>fn-sem', 'fn-sem', { out: 'pass', data: SEM_DATA, counter: { node: 'fn-sem', text: '8/8' }, json: SEM_PASS8 }),
    step('fn-sem.pass>fn-tester', 'fn-tester', { data: ['var-diff@t.files>fn-tester.files'],
      json: { test_files: ['domain/reminder/WateringReminderSchedulerTest.kt', 'data/reminder/BootReceiverTest.kt', 'presentation/plant/ReminderToggleTest.kt'], screenshot_record_needed: false, missing_content_extraction: [], coverage_exceptions: [], stale_tests_reviewed: [] } }),
    step('fn-tester>sc-run', 'sc-run', { out: 'pass', data: ['fn-tester.tests>sc-run.tests', 'fn-tester.shots>sc-run.record'],
      json: { pass: true, mode: 'full', tests: '47 passed / 0 failed', detekt: 'ok', lint: 'ok', coverage: '73%', screenshots: 'skipped' } })
  ], ftShip(step('sc-run.pass>fn-critic', 'fn-critic', { out: 'pass', data: ['var-diff@v.files>fn-critic.files'],
    text: 'independent_critic=true по маршруту · свежие улики без выводов первого ревью',
    json: mix({}, SEM_PASS8, { risk: 'standard', uncertainties: [] }) }), 'y', '2b7e4c9', 47));

  /* high risk; two repair rounds do not converge and the architect honestly says the choice is yours */
  var CAPSULE_DESIGN = '=== CAPSULE === AREA: точное время напоминаний в режиме Doze · FINDINGS COVERED: STATE-001, STATE-002, BACKGROUND-001 · VERDICT: DESIGN DECISION REQUIRED · OPTIONS: A) WorkManager, окно ±15 мин · B) AlarmManager.setExactAndAllowWhileIdle + разрешение SCHEDULE_EXACT_ALARM === END CAPSULE ===';
  var ftDesign = ftHead(ROUTE_HIGH, SIZE_WARN, DEV_POW_OUT).concat([
    step('fn-dev>sc-review', 'sc-review', { out: 'pass', data: ['var-diff.files>sc-review.files'], json: { pass: true, violations: [], warnings: [], by_check: {} },
      counter: { node: 'sc-route', text: 'прогон 2/2: high' } }),
    step('sc-review.pass>fn-sem', 'fn-sem', { st: 'fail', out: 'fix', data: SEM_DATA, counter: { node: 'fn-sem', text: 'круг 1 · 8/12' },
      json: { pass: false, risk: 'high', findings: [{ severity: 'blocker', file: 'data/reminder/ReminderWorker.kt', line: 21, rule: 'state', fix: 'в Doze WorkManager откладывает 09:00 на часы — нужна гарантия времени' }],
        uncertainties: [], confidence: 'high', coverage: { total: 12, covered: 8 } } }),
    step('fn-sem.fix>sw-round', 'sw-round', { out: 'r01', data: ['fn-sem.round>sw-round.sel'], st: 'warn', text: 'Круг ремонта 1 из 2 · ID: STATE-001' }),
    step('sw-round.r01>fn-dev@repair', 'fn-dev@repair', { actor: DEV_POW, data: ['fn-sem.findings>fn-dev@repair.findings'],
      json: { changed_files: ['data/reminder/ReminderWorker.kt'], commit: '6c1f8a2', resolved_findings: [{ id: 'STATE-001', status: 'fixed', note: 'setExpedited + ограничение по времени' }] } }),
    step('fn-dev@repair>fn-sem', 'fn-sem', { st: 'fail', out: 'fix', data: SEM_DATA, counter: { node: 'fn-sem', text: 'круг 2 · 10/12' },
      json: { pass: false, risk: 'high', findings: [{ severity: 'blocker', file: 'data/reminder/ReminderWorker.kt', line: 29, rule: 'state', fix: 'expedited-работа тоже не гарантирует минуту в Doze' }],
        uncertainties: [], confidence: 'high', coverage: { total: 12, covered: 10 } } }),
    step('fn-sem.fix>sw-round', 'sw-round', { out: 'r01', data: ['fn-sem.round>sw-round.sel'], st: 'warn', text: 'Круг ремонта 2 из 2 · новый ID: STATE-002' }),
    step('sw-round.r01>fn-dev@repair', 'fn-dev@repair', { actor: DEV_POW, data: ['fn-sem.findings>fn-dev@repair.findings'],
      json: { changed_files: ['data/reminder/ReminderWorker.kt', 'data/reminder/ReminderWorkerTest.kt'], commit: '0e47b95', resolved_findings: [{ id: 'STATE-002', status: 'fixed', note: 'повтор через 5 минут при опоздании' }] } }),
    step('fn-dev@repair>fn-sem', 'fn-sem', { st: 'fail', out: 'fix', data: SEM_DATA, counter: { node: 'fn-sem', text: 'круг 3 · 11/12' },
      json: { pass: false, risk: 'high', findings: [{ severity: 'blocker', file: 'data/reminder/ReminderWorker.kt', line: 44, rule: 'background', fix: 'выбрать механизм: точный будильник или честное окно' }],
        uncertainties: [], confidence: 'medium', coverage: { total: 12, covered: 11 } } }),
    step('fn-sem.fix>sw-round', 'sw-round', { out: 'r2', data: ['fn-sem.round>sw-round.sel'], st: 'warn', text: 'Бюджет двух кругов исчерпан · непокрыто: device=doze → капсула дизайна' }),
    step('sw-round.r2>fn-arch', 'fn-arch', { data: ['fn-sem.findings>fn-arch.findings'], text: CAPSULE_DESIGN }),
    step('fn-arch>sw-capsule', 'sw-capsule', { out: 'design', data: ['fn-arch.verdict>sw-capsule.sel'], st: 'warn', text: 'VERDICT: DESIGN DECISION REQUIRED → настоящий гейт: выбор за человеком' }),
    step('sw-capsule.design>g-capsule', 'g-capsule', { st: 'wait', answer: 'B: точный будильник', data: ['fn-arch.capsule>g-capsule.capsule'],
      text: 'g-capsule ждёт человека: «A — окно ±15 мин или B — точный будильник с разрешением?» → B (human_wait_ms записан)' }),
    step('g-capsule>fn-dev@repair', 'fn-dev@repair', { actor: DEV_POW, data: ['fn-arch.capsule>fn-dev@repair.capsule'], counter: { node: 'sw-round', text: 'последний круг' },
      json: { changed_files: ['data/reminder/ExactReminderScheduler.kt', 'app/src/main/AndroidManifest.xml', 'presentation/plant/ExactAlarmPermissionCard.kt'], commit: '9d3a6f1',
        resolved_findings: [{ id: 'BACKGROUND-001', status: 'fixed', note: 'setExactAndAllowWhileIdle + запрос SCHEDULE_EXACT_ALARM' }] } }),
    step('fn-dev@repair>fn-sem', 'fn-sem', { out: 'pass', data: SEM_DATA, counter: { node: 'fn-sem', text: '12/12' }, json: mix({}, SEM_PASS, { risk: 'high' }) }),
    step('fn-sem.pass>fn-tester', 'fn-tester', { data: ['var-diff@t.files>fn-tester.files'],
      json: { test_files: ['data/reminder/ExactReminderSchedulerTest.kt', 'presentation/plant/ExactAlarmPermissionCardTest.kt'], screenshot_record_needed: true, missing_content_extraction: [], coverage_exceptions: [], stale_tests_reviewed: ['data/reminder/ReminderWorkerTest.kt'] } }),
    step('fn-tester>sc-run', 'sc-run', { out: 'pass', data: ['fn-tester.tests>sc-run.tests', 'fn-tester.shots>sc-run.record'],
      json: { pass: true, mode: 'full', tests: '49 passed / 0 failed', detekt: 'ok', lint: 'ok', coverage: '72%', screenshots: 'recorded 2' } })
  ], ftShip(step('sc-run.pass>fn-critic', 'fn-critic', { out: 'pass', data: ['var-diff@v.files>fn-critic.files'],
    text: 'independent_critic=true по маршруту · свежие улики без выводов первого ревью', json: SEM_PASS }), 'y', '9d3a6f1', 49));

  /* nice-to-have feature scenarios */
  var SIZE_SPLIT = { ok: true, verdict: 'split_recommended', cells: 36, cell_budget: 24, dimensions: [{ name: 'state', values: 3 }, { name: 'clock', values: 3 }, { name: 'device', values: 2 }, { name: 'channel', values: 2 }],
    scenarios: 9, modules: 4, layers: 3, matrix_declared: true, frozen_matrix: '.ai/local/mp-matrix-watering-reminder.md',
    advice: '36 acceptance cells across 4 dimension(s) exceeds the budget of 24 — split into independently shippable SPECs before implementing' };
  var ftSplit = [
    step(null, 'in-feature', { text: '/mp --feature --next → backlog/watering-reminder.md' }),
    step('in-feature>fn-stale', 'fn-stale', { out: 'todo', data: ['in-feature.specs>fn-stale.specs'], text: 'Не сделано → active/' }),
    step('fn-stale.todo>sc-size', 'sc-size', { st: 'warn', out: 'split', data: ['fn-stale.spec>sc-size.spec'], json: SIZE_SPLIT }),
    step('sc-size.split>g-size', 'g-size', { st: 'wait', out: 'y', answer: 'Y', data: ['sc-size.report>g-size.report'],
      text: '«Поверхность приёмки — 36 ячеек по 4 измерениям. Разделить на меньшие SPEC-и? (Y/n)» → Y' }),
    step('g-size.y>end-split', 'end-split', { text: 'SPEC → mp-planner: разделить; гейт размера перезапустится на первом новом SPEC' })
  ];
  var ftFallback = ftHead(ROUTE_LOW, SIZE_OK).concat([
    step('fn-dev-std>sc-review', 'sc-review', { st: 'fail', out: 'crash', data: ['var-diff.files>sc-review.files'], lvl: 'warning',
      text: 'mp-reviewer-android.sh: exit 2, вывод не JSON → запасной ревьюер' }),
    step('sc-review.crash>fn-review-fb', 'fn-review-fb', { out: 'pass', data: ['var-diff.files>fn-review-fb.files'], json: { pass: true, violations: [] } }),
    step('fn-review-fb.pass>fn-sem', 'fn-sem', { st: 'skip', out: 'pass', text: 'semantic_review=false → пропущено' }),
    step('fn-sem.pass>fn-tester', 'fn-tester', { data: ['var-diff@t.files>fn-tester.files'], json: JSON.parse(defs['mp-tester-android'].sample) }),
    step('fn-tester>sc-run', 'sc-run', { st: 'fail', out: 'crash', data: ['fn-tester.tests>sc-run.tests', 'fn-tester.shots>sc-run.record'], lvl: 'warning',
      text: 'mp-runner-android.sh: {"pass":false,"mode":"full","error_kind":"task_not_found"} → запасной прогон' }),
    step('sc-run.crash>fn-run-fb', 'fn-run-fb', { out: 'pass', data: ['fn-tester.tests>fn-run-fb.tests'], json: RUN_OK })
  ], ftShip(step('fn-run-fb.pass>fn-critic', 'fn-critic', { st: 'skip', out: 'pass', text: 'independent_critic=false → критик пропущен' }), 'y', '8a41d07', 42));
  var ftBlocked = JSON.parse(JSON.stringify(ftRepair.slice(0, 19))).concat([
    step('fn-dev@repair>fn-sem', 'fn-sem', { st: 'fail', out: 'fix', data: SEM_DATA, counter: { node: 'fn-sem', text: 'после капсулы · 11/12' },
      json: { pass: false, risk: 'high', findings: [{ severity: 'blocker', file: 'data/reminder/ReminderWorker.kt', line: 40, rule: 'state', fix: 'Doze откладывает точное время — нужен exact alarm' }], uncertainties: [], confidence: 'medium', coverage: { total: 12, covered: 11 } } }),
    step('fn-sem.fix>sw-round', 'sw-round', { out: 'r3', st: 'fail', data: ['fn-sem.round>sw-round.sel'], text: 'Последний круг после капсулы не сошёлся → стоп, передать человеку' }),
    step('sw-round.r3>end-handoff', 'end-handoff', { st: 'fail', text: '## Handoff: журнал STATE-001..004, PERSISTENCE-001 · непокрыто: state=enabled · clock=next-day · device=reboot · капсула приложена · SPEC остаётся в active/' })
  ]);

  /* /mp-spec */
  /* a Join step carries no text: bp-sim writes «готово N/4 … все вернулись» in the order the
   * branches actually finish */
  var PAR_A = { par: [
    [step('par-a.a0>fn-play', 'fn-play', { data: ['in-spec.idea>fn-play.idea'], json: JSON.parse(defs['play-store-scraper'].sample) }), step('fn-play.then>join-a.i0', 'join-a')],
    [step('par-a.a1>fn-biz', 'fn-biz', { data: ['cp-crawl.states>fn-biz.shots'], json: JSON.parse(defs['screenshot-business-analyzer'].sample) }), step('fn-biz.then>join-a.i1', 'join-a')],
    [step('par-a.a2>fn-style', 'fn-style', { data: ['cp-crawl.states>fn-style.shots'], json: JSON.parse(defs['screenshot-style-analyzer'].sample) }), step('fn-style.then>join-a.i2', 'join-a')],
    [step('par-a.a3>fn-apk', 'fn-apk', { data: ['in-spec.apk>fn-apk.apk'], json: JSON.parse(defs['apk-analyzer'].sample) }), step('fn-apk.then>join-a.i3', 'join-a')]
  ] };
  function specSpine(fromGate1, acJson) {
    return [
      step(fromGate1, 'fn-const', { data: ['g-gate1.inv>var-inv.inv', 'var-inv.inv>fn-const.inv'], json: JSON.parse(defs['constitution-author'].sample) }),
      step('fn-const>fn-brief', 'fn-brief', { data: ['fn-const.doc>fn-brief.doc'], text: 'product-brief.md: проблема, аудитория, ценность, метрики успеха' }),
      step('fn-brief>fn-req', 'fn-req', { data: ['fn-brief.doc>fn-req.doc'], json: JSON.parse(defs['requirements-author'].sample) }),
      step('fn-req>fn-stories', 'fn-stories', { data: ['fn-req.doc>fn-stories.doc'], json: JSON.parse(defs['user-story-writer'].sample) }),
      step('fn-stories>fn-ac', 'fn-ac', { data: ['fn-stories.doc>fn-ac.doc'], json: acJson || JSON.parse(defs['acceptance-criteria-writer'].sample) }),
      step('fn-ac>fn-design', 'fn-design', { data: ['fn-ac.doc>fn-design.doc', 'fn-design.doc>var-bundle.bundle'], text: 'design.md + platform/android.md + design-tokens.json (provenance: apk / screenshot-estimate)' })
    ];
  }
  function parE(clone, analytics) {
    function br(pinOut, node, key, iPin, run) {
      var inv = 'var-inv@e.inv>' + node + '.ev';
      var first = run ? step('par-e.' + pinOut + '>' + node, node, { data: [inv, node + '.doc>var-bundle.bundle'], json: JSON.parse(defs[key].sample) })
        : step('par-e.' + pinOut + '>' + node, node, { st: 'skip', text: defs[key].tech + ': не выбран в quality-plan.json — главная сессия пишет явный документ «не применимо»' });
      return [first, step(node + '.then>join-e.' + iPin, 'join-e')];
    }
    return { par: [
      br('e0', 'fn-nfr', 'nfr-analyzer', 'i0', true),
      br('e1', 'fn-a11y', 'a11y-reviewer', 'i1', true),
      br('e2', 'fn-risk', 'risk-estimator', 'i2', true),
      br('e3', 'fn-sec', 'security-privacy-reviewer', 'i3', true),
      br('e4', 'fn-analytics', 'analytics-taxonomy-designer', 'i4', analytics),
      br('e5', 'fn-fitlist', 'fit-checklist-author', 'i5', clone)
    ] };
  }
  var PREFLIGHT_OK = JSON.parse(defs['spec-preflight.sh'].sample);
  var EVAL_OK = JSON.parse(defs['spec-evaluator'].sample);
  function specTail(evalJson) {
    return [
      step('fn-eval.pass>g-gate2', 'g-gate2', { st: 'wait', out: 'ok', answer: 'принять', data: ['fn-eval.trace>g-gate2.trace'],
        text: 'GATE 2: вердикт pass, покрытие полное → «принять и передать в разработку»' }),
      step('g-gate2.ok>out-spec', 'out-spec', { data: ['g-gate2.bundle>out-spec.bundle'], text: 'spec/ готов → /mp --plan --phases --from spec/ · для клона после сборки экранов — /mp --fit' })
    ];
  }
  var spCloneOk = [
    step(null, 'in-spec', { text: '/mp-spec ./shots --apk polei-menya.apk --play <ссылка Google Play>' }),
    step('in-spec>sw-mode', 'sw-mode', { out: 'clone', text: 'Step 0: скриншоты + --apk → режим clone, depth reference' }),
    step('sw-mode.clone>cp-crawl', 'cp-crawl', { data: ['in-spec.screens>cp-crawl.screens', 'in-spec.apk>cp-crawl.apk'],
      text: 'device-preflight.sh → {"ok":true,"serial":"emulator-5554","w":1080,"h":2400,"density":420,"android":"34"} · обход: 14 состояний, 31 действие, покрытие вышло на плато' }),
    step('cp-crawl>par-a', 'par-a', { text: 'Одновременно ×4: Google Play, бизнес-логика, стиль, APK' }),
    PAR_A,
    step('join-a>fn-nav', 'fn-nav', { data: ['fn-biz.screens>fn-nav.screens', 'fn-apk.manifest>fn-nav.manifest', 'fn-play.meta>fn-nav.meta'], json: JSON.parse(defs['navigation-flow-analyzer'].sample) }),
    step('fn-nav>fn-model', 'fn-model', { data: ['fn-nav.nav>fn-model.nav'], json: JSON.parse(defs['data-model-extractor'].sample) }),
    step('fn-model>gt-questions', 'gt-questions', { st: 'wait', answer: 'ответы A–E', data: ['fn-biz.amb>gt-questions.amb'],
      text: 'Вопросы A–E + grill: «Что будет, если полив пропущен?» → рекомендовано: напомнить ещё раз через 3 часа · принято' }),
    step('gt-questions>g-gate1', 'g-gate1', { st: 'wait', out: 'ok', answer: 'всё верно', data: ['fn-model.model>g-gate1.a', 'gt-questions.ans>g-gate1.ans', 'fn-style.tokens>g-gate1.tokens'],
      text: 'GATE 1: 9 экранов · 5 фич · 2 сущности · 1 строка (assumption) → всё верно' })
  ].concat(specSpine('g-gate1.ok>fn-const'), [
    step('fn-design>par-e', 'par-e', { text: 'quality-plan.json: NFR, доступность, риски — всегда; безопасность — есть уведомления; аналитика — не запрошена; чек-листы fit — клон' }),
    parE(true, false),
    step('join-e>sc-preflight', 'sc-preflight', { out: 'pass', data: ['var-bundle.bundle>sc-preflight.bundle'], json: PREFLIGHT_OK }),
    step('sc-preflight.pass>fn-eval', 'fn-eval', { out: 'pass', data: ['var-bundle@f.bundle>fn-eval.bundle', 'sc-preflight.report>fn-eval.mech'], json: EVAL_OK })
  ], specTail());

  var AC_MISS = { features: [{ file: 'acceptance/reminders.feature', feature: 'Watering reminders', scenarios: 5, us_ids: ['US-004', 'US-005'], fr_ids: ['FR-007', 'FR-008'], states_covered: ['happy', 'error'] }], untestable_stories: [], stories_without_scenario: [], fetch_error: null };
  var spCritic = [
    step(null, 'in-spec', { text: '/mp-spec --greenfield «Полей меня: напоминает поливать комнатные растения»' }),
    step('in-spec>sw-mode', 'sw-mode', { out: 'green', text: 'Step 0: без скриншотов и APK → greenfield, depth production' }),
    step('sw-mode.green>gt-grill', 'gt-grill', { st: 'wait', answer: '6 решений', data: ['in-spec.idea>gt-grill.idea'],
      text: 'Grill: аудитория — владельцы 3–15 растений · главная работа — не забыть полить · вне рамок — магазин и соцсеть' }),
    step('gt-grill>gt-interview', 'gt-interview', { st: 'wait', answer: '5 этапов', data: ['gt-grill.dec>gt-interview.dec'], text: 'Интервью: видение, экраны, потоки, данные, позиция — 5 этапов по ≤4 вопроса' }),
    step('gt-interview>g-gate1', 'g-gate1', { st: 'wait', out: 'ok', answer: 'всё верно', data: ['gt-interview.ans>g-gate1.g'], text: 'GATE 1: 7 экранов · 5 фич · 2 сущности → всё верно' })
  ].concat(specSpine('g-gate1.ok>fn-const', AC_MISS), [
    step('fn-design>par-e', 'par-e', { text: 'quality-plan.json: NFR, доступность, риски, безопасность; аналитика и чек-листы fit не нужны' }),
    parE(false, false),
    step('join-e>sc-preflight', 'sc-preflight', { out: 'pass', data: ['var-bundle.bundle>sc-preflight.bundle'], json: mix({}, PREFLIGHT_OK, { clone: false }) }),
    step('sc-preflight.pass>fn-eval', 'fn-eval', { st: 'fail', out: 'fail', data: ['var-bundle@f.bundle>fn-eval.bundle', 'sc-preflight.report>fn-eval.mech'],
      json: { verdict: 'fail', retry: 0, findings: [{ id: 'E-1', severity: 'blocker', class: 1, artifact: 'acceptance/reminders.feature', kind: 'story_without_scenario', detail: 'US-006 «Отложить полив» has no @US-006 scenario', fix_hint: 'add a scenario for snoozing a watering reminder', owner_agent: 'acceptance-criteria-writer' }], coverage: { fr_total: 18, story_without_scenario: ['US-006'] }, fetch_error: null } }),
    step('fn-eval.fail>fn-owner', 'fn-owner', { out: 'retry', data: ['fn-eval.findings>fn-owner.findings'], ghost: ['fn-ac'], counter: { node: 'fn-owner', text: 'круг 1/2' },
      text: 'E-1 → owner_agent acceptance-criteria-writer: перезапуск только его, с классом 1 и находкой; остальные документы не трогаем' }),
    step('fn-owner.retry>sc-preflight', 'sc-preflight', { out: 'pass', json: mix({}, PREFLIGHT_OK, { clone: false, feature_files: 6 }) }),
    step('sc-preflight.pass>fn-eval', 'fn-eval', { out: 'pass', data: ['sc-preflight.report>fn-eval.mech'], json: mix({}, EVAL_OK, { retry: 1, coverage: { fr_total: 18, fr_without_coverage: [], story_without_scenario: [], state_coverage_gaps: [] }, traceability_rows: 18 }) })
  ], specTail());

  var spGreen = [
    step(null, 'in-spec', { text: '/mp-spec --greenfield «Полей меня: напоминает поливать комнатные растения»' }),
    step('in-spec>sw-mode', 'sw-mode', { out: 'green', text: 'Step 0: без скриншотов и APK → greenfield, depth production' }),
    step('sw-mode.green>gt-grill', 'gt-grill', { st: 'wait', answer: '6 решений', data: ['in-spec.idea>gt-grill.idea'],
      text: 'Grill: аудитория — владельцы 3–15 растений · главная работа — не забыть полить · вне рамок — магазин и соцсеть' }),
    step('gt-grill>gt-interview', 'gt-interview', { st: 'wait', answer: '5 этапов', data: ['gt-grill.dec>gt-interview.dec'], text: 'Интервью: видение, экраны, потоки, данные, позиция — 5 этапов по ≤4 вопроса' }),
    step('gt-interview>g-gate1', 'g-gate1', { st: 'wait', out: 'ok', answer: 'всё верно', data: ['gt-interview.ans>g-gate1.g'], text: 'GATE 1: 7 экранов · 5 фич · 2 сущности → всё верно' })
  ].concat(specSpine('g-gate1.ok>fn-const'), [
    step('fn-design>par-e', 'par-e', { text: 'quality-plan.json: NFR, доступность, риски, безопасность; аналитика и чек-листы fit не нужны' }),
    parE(false, false),
    step('join-e>sc-preflight', 'sc-preflight', { out: 'pass', data: ['var-bundle.bundle>sc-preflight.bundle'], json: mix({}, PREFLIGHT_OK, { clone: false }) }),
    step('sc-preflight.pass>fn-eval', 'fn-eval', { out: 'pass', data: ['var-bundle@f.bundle>fn-eval.bundle', 'sc-preflight.report>fn-eval.mech'], json: mix({}, EVAL_OK, { coverage: { fr_total: 18, fr_without_coverage: [], story_without_scenario: [], state_coverage_gaps: [] }, traceability_rows: 18 }) })
  ], specTail());

  var spFeature = [
    step(null, 'in-spec', { text: '/mp-spec --feature «Напоминание о поливе» (внутри проекта с доской .claude/specs/)' }),
    step('in-spec>sw-mode', 'sw-mode', { out: 'feature', text: 'Step 0: --feature → brownfield, без бандла spec/' }),
    step('sw-mode.feature>fn-scout', 'fn-scout', { data: ['in-spec.idea>fn-scout.idea'], counter: { node: 'fn-scout', text: '×3 одновременно' }, json: JSON.parse(defs['grounding-scout'].sample) }),
    step('fn-scout>gt-grill-f', 'gt-grill-f', { st: 'wait', answer: '3 решения', data: ['fn-scout.facts>gt-grill-f.facts'], text: 'Grill фичи: время по умолчанию 09:00 · отложить на 3 часа · после перезагрузки восстановить' }),
    step('gt-grill-f>gt-decompose', 'gt-decompose', { st: 'wait', out: 'ok', answer: 'подтвердить', data: ['gt-grill-f.dec>gt-decompose.dec'], text: 'Разбиение: 01-schedule → 02-notification → 03-boot-restore · подтвердить' }),
    step('gt-decompose.ok>fn-emit', 'fn-emit', { data: ['gt-decompose.plan>fn-emit.plan'], text: 'backlog/: watering-reminder-00-overview.md + 01-schedule, 02-notification, 03-boot-restore' }),
    step('fn-emit>fn-eval@feat', 'fn-eval@feat', { out: 'pass', data: ['fn-emit.epic>fn-eval@feat.epic'], json: { verdict: 'pass', retry: 0, findings: [], coverage: { fr_total: 3 }, fetch_error: null } }),
    step('fn-eval@feat.pass>out-spec@feat', 'out-spec@feat', { data: ['fn-eval@feat.epic>out-spec@feat.epic'], text: 'Эпик на доске: 3 SPEC · дальше /mp --feature --next' })
  ];

  /* overview */
  var ovClone = [
    step(null, 'ev-start', { text: 'Скриншоты «Полей меня» + ссылка Google Play + APK' }),
    step('ev-start>sw-intake', 'sw-intake', { out: 'clone', text: 'Есть скриншоты → клон' }),
    step('sw-intake.clone>cp-spec', 'cp-spec', { data: ['ev-start.idea>cp-spec.idea', 'ev-start.screens>cp-spec.screens', 'ev-start.apk>cp-spec.apk'],
      text: '/mp-spec: анализаторы, авторы и критик; GATE 1 и GATE 2 пройдены → spec/ из 19 документов' }),
    step('cp-spec>sw-plan', 'sw-plan', { out: 'phases', data: ['cp-spec.bundle>var-bundle.bundle'], text: 'Клон → план по фазам' }),
    step('sw-plan.phases>fn-phases', 'fn-phases', { data: ['var-bundle.bundle>fn-phases.bundle'], json: JSON.parse(defs['mp-phase-planner'].sample) }),
    step('fn-phases>g-phases', 'g-phases', { st: 'wait', out: 'y', answer: 'y', data: ['fn-phases.specs>g-phases.specs'],
      text: 'Аудит покрытия: 9/9 экранов, 24/24 FR → «Записать/слить 5 файлов фаз? (y / d / n)» → y' }),
    step('g-phases.y>cp-phase', 'cp-phase', { data: ['g-phases.specs>var-phases.specs', 'var-phases.specs>cp-phase.specs', 'cp-phase.files>var-app.files'],
      text: '/mp --phase × 23: все задачи PHASE_01…PHASE_05 отмечены' }),
    step('cp-phase>fn-fit', 'fn-fit', { st: 'warn', data: ['var-app.files>fn-fit.build', 'var-refs.refs>fn-fit.refs'], lvl: 'warning',
      json: JSON.parse(defs['mp-fit-android'].sample) }),
    step('fn-fit>cp-feature', 'cp-feature', { data: ['fn-fit.specs>var-board.specs', 'var-board.specs>cp-feature.specs', 'cp-feature.files>var-app.files'],
      text: '78 < 85: 2 SPEC-а расхождений записаны в backlog/ (epic: fit) → /mp --feature --next, потом снова /mp --fit' }),
    step('cp-feature>cp-learn', 'cp-learn', { data: ['cp-feature.files>cp-learn.files', 'cp-learn.pr>var-repo.pr'], text: 'После каждого пуша — оценка и уроки' })
  ];
  var ovGreen = [
    step(null, 'ev-start', { text: 'Идея: «приложение, которое напоминает поливать цветы»' }),
    step('ev-start>sw-intake', 'sw-intake', { out: 'green', text: 'Нет скриншотов → с нуля' }),
    step('sw-intake.green>cp-spec', 'cp-spec', { data: ['ev-start.idea>cp-spec.idea'], text: '/mp-spec --greenfield: grill, интервью, GATE 1, чертёж, критик, GATE 2' }),
    step('cp-spec>sw-plan', 'sw-plan', { out: 'epic', data: ['cp-spec.bundle>var-bundle.bundle'], text: 'Небольшое приложение → эпик задач' }),
    step('sw-plan.epic>fn-plan', 'fn-plan', { data: ['var-bundle.bundle>fn-plan.bundle'], json: JSON.parse(defs['mp-planner'].sample) }),
    step('fn-plan>g-plan', 'g-plan', { st: 'wait', out: 'y', answer: 'y', data: ['fn-plan.specs>g-plan.specs'], text: '«Записать 5 SPEC-файлов в .claude/specs/backlog/? (y/d/n)» → y' }),
    step('g-plan.y>cp-feature', 'cp-feature', { data: ['g-plan.specs>var-board.specs', 'var-board.specs>cp-feature.specs', 'cp-feature.files>var-app.files'],
      text: '/mp --feature --next × 5: «Список цветов», «Добавить цветок», «Напоминание о поливе», «Календарь полива», «Фото цветка»' }),
    step('cp-feature>cp-learn', 'cp-learn', { data: ['cp-feature.files>cp-learn.files'], text: 'Эпик закрыт → одна оценка на весь эпик' })
  ];

  /* learn */
  var lnLow = [
    step(null, 'in-post', { text: 'После пуша watering-reminder (отдельный SPEC — сам себе эпик)' }),
    step('in-post>sc-deliver', 'sc-deliver', { answer: 'y', data: ['in-post.files>sc-deliver.files'], json: JSON.parse(defs['mp-deliver-telegram.sh'].sample) }),
    step('sc-deliver>g-feedback', 'g-feedback', { st: 'wait', answer: '2', lvl: 'warning',
      text: '«Совпадает с тем, что вы хотели? 5…1» → 2 — «напоминание пришло в 03:00 ночи»' }),
    step('g-feedback>sc-record', 'sc-record', { data: ['g-feedback.score>sc-record.score', 'sc-record.report>var-telemetry.rep'], json: JSON.parse(defs['mp-record-run.sh'].sample) }),
    step('sc-record>br-low', 'br-low', { out: 'yes', data: ['g-feedback.score>br-low.score'], text: '2 ≤ 3 → урок существует' }),
    step('br-low.yes>set-lessons', 'set-lessons', { data: ['g-feedback.note>set-lessons.note'],
      text: 'selfimprove/lessons.md += «- 2026-09-23 watering-reminder: feedback 2/5 — напоминание пришло в 03:00 ночи»' }),
    step('set-lessons>fn-knowledge', 'fn-knowledge', { data: ['g-feedback.score>fn-knowledge.score', 'g-feedback.note>fn-knowledge.note', 'fn-knowledge.local>var-memory.mem'],
      json: JSON.parse(defs['mp-knowledge'].sample) }),
    step('fn-knowledge>fn-improve', 'fn-improve', { data: ['fn-knowledge.plugin>fn-improve.plugin', 'fn-improve.patch>var-queue.patch'], json: JSON.parse(defs['mp-improve'].sample) }),
    step('fn-improve>br-queue', 'br-queue', { out: 'yes', text: 'mobile-pipeline/.ai/proposals/: 3 патча' }),
    step('br-queue.yes>pr-nudge', 'pr-nudge', { lvl: 'warning', text: 'В очереди 3 предложения по улучшению конвейера — запустите /mp --improve --drain · retro_due: можно запустить ретро (совет, не гейт)' }),
    step('pr-nudge>out-next', 'out-next', { text: 'Claude: следующая команда — /mp --feature --next --chain (запустите в Codex) · стоп' })
  ];
  var lnDrain = [
    step(null, 'ev-improve', { text: '/mp --improve --drain' }),
    step('ev-improve>fn-improve@cmd', 'fn-improve@cmd', { st: 'skip', text: '--drain без заметки → прямой патч не нужен' }),
    step('fn-improve@cmd>g-pr', 'g-pr', { st: 'wait', out: 'y', answer: 'y', text: '«Открыть ОДИН общий PR с этими 3 предложениями? (y/n)» → y' }),
    step('g-pr.y>sw-drain', 'sw-drain', { out: 'drain', text: 'Mode B: очередь → один PR' }),
    step('sw-drain.drain>sc-drain', 'sc-drain', { data: ['var-queue@d.queue>sc-drain.queue', 'sc-drain.pr>var-repo.pr'], json: JSON.parse(defs['mp-improve-drain.sh'].sample) }),
    step('sc-drain>g-merge', 'g-merge', { st: 'wait', answer: 'merged', text: 'validate-plugins: зелёный · человек мержит PR #15 на GitHub' }),
    step('g-merge>sc-regen', 'sc-regen', { data: ['var-repo.tpl>sc-regen.tpl'], text: defs['sc-regen'].sample }),
    step('sc-regen>out-all', 'out-all', { data: ['g-merge.pr>out-all.pr'], text: 'Все проекты получат правку при следующем /plugin marketplace update' })
  ];
  var lnReflect = [
    step(null, 'ev-reflect', { text: '/mp --reflect' }),
    step('ev-reflect>sc-cross', 'sc-cross', { data: ['var-projects.rep>sc-cross.rep'], json: JSON.parse(defs['mp-cross-reflect.sh'].sample) }),
    step('sc-cross>fn-reflect', 'fn-reflect', { data: ['sc-cross.digest>fn-reflect.digest', 'fn-reflect.patch>var-queue@r.patch'], json: JSON.parse(defs['mp-reflect'].sample) }),
    step('fn-reflect>pr-reflect', 'pr-reflect', { text: 'В очередь поставлено 1 предложение, пропущено 1. Дальше: /mp --improve --drain' })
  ];

  var scenarios = {
    overview: [
      { id: 'ov-clone', title: 'Клон целиком', summary: 'Чужое приложение → чертёж → план по фазам → сверка 78 < 85 → два SPEC-а расхождений снова в работу.', steps: ovClone },
      { id: 'ov-green', title: 'С нуля до эпика', summary: 'Идея → чертёж → эпик из пяти карточек → работа по одной.', steps: ovGreen }
    ],
    spec: [
      { id: 'sp-clone-ok', title: 'Клон: всё прошло', summary: 'Четыре анализатора одновременно, аналитика пропущена, критик доволен с первого раза.', steps: spCloneOk },
      { id: 'sp-critic', title: 'Критик нашёл дыру → владелец переделал', summary: 'У истории US-006 нет сценария; перезапускается только автор приёмки, второй круг чистый.', steps: spCritic },
      { id: 'sp-green', title: 'С нуля: всё прошло', summary: 'Grill и интервью вместо анализаторов; критик доволен с первого раза.', steps: spGreen },
      { id: 'sp-feature', title: 'Фича в готовый проект', summary: 'Разведчики, grill, разбиение — и эпик прямо на доске.', steps: spFeature }
    ],
    feature: [
      { id: 'ft-happy', title: 'Всё прошло', summary: 'Низкий риск, стандартный разработчик; смысловое ревью и критик пропущены.', steps: ftHappy },
      { id: 'ft-powerful', title: 'Высокий риск: мощный разработчик + критик', summary: 'Маршрут high: код пишет мощный разработчик, смысловое ревью и независимый критик проходят с первого раза.', steps: ftPowerful },
      { id: 'ft-autofix', title: 'Тесты упали → одна автопочинка', summary: 'Напоминание срабатывало в 03:00 вместо 09:00 — одна попытка без новой логики, и прогон зелёный.', steps: ftAutofix },
      { id: 'ft-repair', title: 'Ревьюер нашёл замечания → 2 круга → капсула', summary: 'Два круга ремонта не сошлись, архитектор: PATCH ALLOWED, последний круг — 12/12.', steps: ftRepair },
      { id: 'ft-design', title: 'Капсула: решение за человеком', summary: 'Два круга ремонта не сошлись, архитектор честно говорит DESIGN DECISION REQUIRED — вы выбираете вариант, дальше последний круг.', steps: ftDesign },
      { id: 'ft-reject', title: 'Человек не одобрил пуш', summary: 'Всё зелёное, но ручная проверка на телефоне не устроила: N — ждём отзыв.', steps: ftReject },
      { id: 'ft-split', title: 'Слишком большая задача', summary: '36 ячеек при бюджете 24 — SPEC возвращается планировщику.', steps: ftSplit },
      { id: 'ft-fallback', title: 'Скрипты упали → запасные агенты', summary: 'Ревьюер и стенд не вернули JSON — их работу сделали запасные агенты.', steps: ftFallback },
      { id: 'ft-blocked', title: 'Не сошлось даже после капсулы', summary: 'Последний круг после капсулы тоже с блокером — ## Handoff и стоп.', steps: ftBlocked }
    ],
    learn: [
      { id: 'ln-low', title: 'Оценка 2/5 → урок → патч в очередь', summary: 'Низкая оценка превращается в строку lessons.md, правку памяти и патч к шаблону тестировщика.', steps: lnLow },
      { id: 'ln-drain', title: 'Очередь → один PR → все проекты', summary: 'Три патча одним PR; после мержа CI пересобирает плагины.', steps: lnDrain },
      { id: 'ln-reflect', title: 'Уроки всех проектов', summary: 'Скрипт без LLM собирает дайджест, агент ставит повторяющееся в очередь.', steps: lnReflect }
    ]
  };

  /* default log tag / level, derived from the node category */
  var byId = {};
  [overview, spec, feature, learn].forEach(function (g) {
    byId[g.id] = {};
    g.nodes.forEach(function (n) { byId[g.id][n.id] = n; });
  });
  function catOf(gid, nid) {
    var n = byId[gid][nid]; if (!n) return null;
    return n.cat || (defs[n.def] && defs[n.def].cat);
  }
  function decorate(gid, s) {
    if (s.par) { s.par.forEach(function (b) { b.forEach(function (x) { decorate(gid, x); }); }); return; }
    var c = catOf(gid, s.n);
    if (!s.tag) s.tag = (c === 'AG' || c === 'MS') ? 'LogAgent' : (c === 'SC' || c === 'PS') ? 'LogScript' : c === 'HG' ? 'LogGate' : 'LogFlow';
    if (!s.st) s.st = 'ok';
    if (!s.lvl) s.lvl = s.st === 'fail' ? 'error' : (s.st === 'warn' || s.st === 'wait') ? 'warning' : 'display';
  }
  Object.keys(scenarios).forEach(function (gid) {
    scenarios[gid].forEach(function (sc) { sc.graph = gid; sc.steps.forEach(function (s) { decorate(gid, s); }); });
  });

  window.BP = {
    schema: 1,
    pipelineVersion: '1.17.2',
    repoBlob: REPO_BLOB,
    prefixNote: '{{PREFIX}} в именах файлов шаблонов подставляется при установке (bootstrap.sh --prefix=…); mp — префикс плагинов маркетплейса.',
    simCaption: 'Учебная симуляция: агенты не запускаются, значения — пример',
    exampleApp: { name: 'Полей меня', task: 'Напоминание о поливе', spec: SPEC_PATH },
    metrics: metrics,
    types: types,
    cats: cats,
    flags: flags,
    gates: gates,
    defs: defs,
    graphs: [overview, spec, feature, learn],
    presets: presets,
    scenarios: scenarios
  };
})();
