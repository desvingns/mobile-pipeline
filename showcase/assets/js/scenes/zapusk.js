/* scenes/zapusk.js — «Запустите конвейер сами»: the whole factory as one playable simulation (package D).
 *
 * A night-shift diorama: a serpentine belt with every station, a token that rides it
 * (идея → чертёж → карточка → деталь → капсула), HTML speech bubbles (always ≥16px) and the status line.
 * ONE master gsap timeline (paused) with labels drives everything, including the part after your stamp.
 * Your four «да» (brand.md §6) in story order: a quick lemon «ДА» stamp after Бригадир (список экранов), the gate
 * barrier (весь чертёж), a quick stamp after Планировщик (план) — these three need no click — and the release stamp.
 *   play    [data-action=sim-play]  idle → play · running ↔ paused · done → «Ещё раз» (restart)
 *   reset   [data-action=sim-reset] rewinds to 0 at any moment (hidden once the run is done: «Ещё раз» does that)
 *   stamp   [data-action=sim-stamp] unhidden + focused at the addPause «Фабрика ждёт вашей печати»; its pulse
 *           (waitLoop) runs only while the section is seen, the tab visible and the panel not suspended
 * Layouts (re-rendered on every init/final and on the 760px switch, so no stale inline styles survive):
 *   wide ≥1024: viewBox 1600×900 (16:9), 3 rows · mid 760–1023: 1600×1200 (stage 4:3, scenes-d.css), 4 rows
 *   · tall <760: vertical zigzag, viewBox 720×1280 (stage 9:16), 6 rows. SVG text is sized per layout so it never
 *   renders below 16px (see L.minPx); the phone and the big seal are scaled the same way. Bubbles are HTML and are
 *   kept inside the stage by fitBubbles(). A work lamp (.zp-spot) follows the order; a mint bar under the status
 *   line (--zp-p on .sim-status) shows how far it has travelled.
 * Calm mode: the SAME timeline is seeked (no travel) by a 1.1 s stepper; stamp gate kept; the reveal shows a static
 *   burst instead of confetti. Without gsap the stepper only updates the status line.
 * Public: MP.sim = { pause() } (prosto.suspend). Tools only: MP.sim.seek(labelOrSeconds), MP.sim.state().
 * The built DOM is the diorama at rest (ready to run); transient things are hidden by SVG attributes, so a context
 * revert always falls back to that state.
 */
(function () {
  'use strict';
  var MP = window.MP;
  if (!MP || !MP.scene) return;

  /* ---------- palette (brand.md §2) ---------- */
  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', LEMON = '#FFDA4F', MINT = '#2BD99F', RASP = '#FF4F8B',
    SKY = '#3EC5FF', TANG = '#FF8A1F', STEEL = '#C9D3E6', STEEL_D = '#8E9BB8', NIGHT = '#2C2472', WHITE = '#FFFFFF',
    DEEP = '#241E58';
  var FONT_D = "Unbounded, 'Arial Black', system-ui, sans-serif";

  /* ---------- markup helpers (strings) ---------- */
  function f(v) { return String(Math.round(v * 100) / 100); }
  function R(x, y, w, h, rx, fill, ex) {
    return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' +
      (rx ? ' rx="' + f(rx) + '"' : '') + ' fill="' + fill + '"' + (ex || '') + '/>';
  }
  function C(cx, cy, r, fill, ex) { return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + fill + '"' + (ex || '') + '/>'; }
  function E(cx, cy, rx, ry, fill, ex) {
    return '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="' + fill + '"' + (ex || '') + '/>';
  }
  function P(d, fill, ex) { return '<path d="' + d + '" fill="' + fill + '"' + (ex || '') + '/>'; }
  function L(d, col, w, ex) {
    return '<path d="' + d + '" fill="none"' + (col ? ' stroke="' + col + '"' : '') + (w ? ' stroke-width="' + f(w) + '"' : '') + (ex || '') + '/>';
  }
  function G(cls, inner, ex) { return '<g' + (cls ? ' class="' + cls + '"' : '') + (ex || '') + '>' + inner + '</g>'; }
  function T(x, y, s, size, o) {
    o = o || {};
    return '<text x="' + f(x) + '" y="' + f(y) + '" font-family="' + FONT_D + '" font-size="' + f(size) + '" font-weight="' +
      (o.weight || 900) + '" fill="' + (o.fill || INK) + '" text-anchor="' + (o.anchor || 'middle') + '"' + (o.ex || '') + '>' + s + '</text>';
  }
  function tr(x, y, s, rot) {
    return ' transform="translate(' + f(x) + ' ' + f(y) + ')' + (rot ? ' rotate(' + f(rot) + ')' : '') + (s && s !== 1 ? ' scale(' + f(s) + ')' : '') + '"';
  }
  var HIDE = ' opacity="0" visibility="hidden"';
  var SW = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  function dropD(cx, top, h) {
    var r = h * 0.36, cy = top + h - r;
    return 'M' + f(cx) + ' ' + f(top) + 'C' + f(cx - r * 0.3) + ' ' + f(top + h * 0.28) + ' ' + f(cx - r) + ' ' + f(cy - r * 0.5) + ' ' +
      f(cx - r) + ' ' + f(cy) + 'A' + f(r) + ' ' + f(r) + ' 0 0 0 ' + f(cx + r) + ' ' + f(cy) + 'C' + f(cx + r) + ' ' +
      f(cy - r * 0.5) + ' ' + f(cx + r * 0.3) + ' ' + f(top + h * 0.28) + ' ' + f(cx) + ' ' + f(top) + 'Z';
  }
  function sparkleD(cx, cy, r) {
    var k = r * 0.28;
    return 'M' + f(cx) + ' ' + f(cy - r) + 'Q' + f(cx + k) + ' ' + f(cy - k) + ' ' + f(cx + r) + ' ' + f(cy) + 'Q' + f(cx + k) + ' ' +
      f(cy + k) + ' ' + f(cx) + ' ' + f(cy + r) + 'Q' + f(cx - k) + ' ' + f(cy + k) + ' ' + f(cx - r) + ' ' + f(cy) + 'Q' + f(cx - k) +
      ' ' + f(cy - k) + ' ' + f(cx) + ' ' + f(cy - r) + 'Z';
  }
  function checkD(cx, cy, k) {
    return 'M' + f(cx - 7 * k) + ' ' + f(cy) + 'L' + f(cx - 2 * k) + ' ' + f(cy + 5 * k) + 'L' + f(cx + 7.5 * k) + ' ' + f(cy - 5 * k);
  }

  /* ---------- stations along the belt, in travel order ---------- */
  var ORDER = ['funnel', 'brigadir', 'pisari', 'sovetniki', 'pridira', 'gate1', 'board', 'vesy', 'strelochnik', 'khudozhnik',
    'master', 'poryadok', 'revizor', 'tests', 'priyomshchik', 'gate2', 'exit'];
  var WIDTH = { funnel: 0, brigadir: 150, pisari: 250, sovetniki: 300, pridira: 140, gate1: 150, board: 300, vesy: 140,
    strelochnik: 140, khudozhnik: 140, master: 140, poryadok: 140, revizor: 140, tests: 290, priyomshchik: 140, gate2: 170, exit: 150 };

  /* minPx = rendered px per viewBox unit at the narrowest viewport of the layout (text is sized from it) */
  var LAYOUTS = {
    wide: { vb: [0, 0, 1600, 900], s: 0.9, r: 137.5, xL: 64, xR: 1536, xStart: 200, xEnd: 1572, rows: [275, 550, 825],
      split: [6, 6, 5], beltW: 32, minPx: 0.589, reveal: [800, 440] },
    /* tablet 4:3: the same belt folded into four rows, so the characters get ~20% bigger than a letterboxed wide view */
    mid: { vb: [0, 0, 1600, 1200], s: 1.05, r: 137.5, xL: 64, xR: 1536, xStart: 200, xEnd: 40, rows: [300, 575, 850, 1125],
      split: [5, 4, 4, 4], beltW: 32, minPx: 0.4375, reveal: [800, 590] },
    tall: { vb: [0, 0, 720, 1280], s: 0.72, r: 90, xL: 30, xR: 690, xStart: 140, xEnd: 36, rows: [300, 480, 660, 840, 1020, 1200],
      split: [3, 3, 3, 3, 3, 2], beltW: 26, minPx: 0.44, reveal: [360, 522] }
  };
  function modeNow() {
    if (!window.matchMedia) return 'wide';
    if (window.matchMedia('(max-width: 759px)').matches) return 'tall';
    if (window.matchMedia('(max-width: 1023px)').matches) return 'mid';
    return 'wide';
  }

  /* serpentine geometry: straight rows joined by semicircles of radius r (MP.beltPath fillets) */
  function geometry(Lo) {
    var r = Lo.r, rows = Lo.rows, n = rows.length, pts = [[Lo.xStart, rows[0]]], segs = [], cum = 0;
    for (var k = 0; k < n; k++) {
      var dir = k % 2 ? -1 : 1, y = rows[k];
      var sx = k === 0 ? Lo.xStart : (dir > 0 ? Lo.xL + r : Lo.xR - r);
      var ex = k === n - 1 ? Lo.xEnd : (dir > 0 ? Lo.xR - r : Lo.xL + r);
      segs.push({ y: y, dir: dir, sx: sx, ex: ex, cum: cum });
      cum += Math.abs(ex - sx);
      if (k < n - 1) { var tx = dir > 0 ? Lo.xR : Lo.xL; pts.push([tx, y], [tx, rows[k + 1]]); cum += Math.PI * r; }
    }
    pts.push([Lo.xEnd, rows[n - 1]]);
    return { d: MP.beltPath(pts, r), pts: pts, segs: segs, total: cum };
  }
  function place(Lo, Ge) {
    var st = {}, idx = 0, s = Lo.s;
    Lo.split.forEach(function (count, k) {
      var seg = Ge.segs[k], ids = ORDER.slice(idx, idx + count), dir = seg.dir, a = seg.sx, b = seg.ex;
      idx += count;
      if (ids[0] === 'funnel') {
        st.funnel = { id: 'funnel', row: k, dir: dir, y: seg.y, w: 0, x: a + dir * 34 * s };
        a = st.funnel.x + dir * 64 * s; ids = ids.slice(1);
      }
      var W = 0;
      ids.forEach(function (id) { W += WIDTH[id] * s; });
      var gap = (Math.abs(b - a) - W) / ids.length, cur = a + dir * gap / 2;
      ids.forEach(function (id) {
        var w = WIDTH[id] * s;
        st[id] = { id: id, row: k, dir: dir, y: seg.y, w: w, x: cur + dir * w / 2 };
        cur += dir * (w + gap);
      });
    });
    return st;
  }
  function progAt(Ge, row, x) { var sg = Ge.segs[row]; return (sg.cum + Math.abs(x - sg.sx)) / Ge.total; }

  /* ---------- speech bubbles (HTML, ≤5 words, first person) and status lines ---------- */
  var SAY = {
    idea: 'Хочу напоминалку для цветов', brigadir: 'Во сколько напоминать?', pisari: 'Записываем каждую мелочь',
    sovetniki: 'Думаем одновременно!', pridira: 'Переделать! Тут непонятно.', pridira2: 'Годится!', gate1: 'Да, всё верно!',
    board: 'Режу на карточки', vesy: 'Бип. Вес в норме', strelochnik: 'Бип. Это — к мастеру', khudozhnik: 'Будет красиво!',
    master: 'Готово, проверяйте!', poryadok: 'Бип. Всё по полочкам', revizor: 'Задача лёгкая. Отдыхаю',
    ispytatel: 'А если ночью?', stend: 'Бип! Ошибка!', master2: 'Сейчас починю!', stend2: 'Бип. Испытания пройдены',
    priyomshchik: 'Подключено. Вот памятка', gate2: 'Нужна ваша печать!', bibliotekar: 'Это запомним'
  };
  var TONE = { pridira: 'rasp', stend: 'rasp', pridira2: 'mint', stend2: 'mint', gate1: 'lemon', gate2: 'lemon' };
  /* status steps: key → [text, announce to screen readers] (9 key moments are announced). The four human «да» of
   * brand.md §6 in story order: yes1 (список экранов), gate1 (весь чертёж), plan (план заданий), wait (выпуск). */
  var STEPS = [
    ['funnel', 'Идея попала на фабрику', 1], ['brigadir', 'Бригадир расспрашивает'], ['yes1', 'Вы сказали «да» списку экранов', 1],
    ['pisari', 'Писари пишут чертёж'], ['sovetniki', 'Пять советников — одновременно'], ['pridira', 'Придира вернул лист…'],
    ['pridira2', 'Придира вернул лист. Исправлено!'], ['gate1', 'Вы сказали «да» чертежу', 1],
    ['board', 'Планировщик нарезал карточки'], ['plan', 'Вы одобрили план', 1], ['vesy', 'Весы: размер в порядке'],
    ['strelochnik', 'Стрелочник: этому — к мастеру'],
    ['khudozhnik', 'Художник подобрал цвета'], ['master', 'Мастер пишет программу', 1], ['poryadok', 'Всё по полочкам'],
    ['revizor', 'Задача несложная — Ревизор отдыхает'], ['ispytatel', 'Испытатель придумал испытания'],
    ['defect', 'Ошибка! Назад к мастеру', 1], ['fixed', 'Починено. Испытания пройдены', 1],
    ['priyomshchik', 'Подключено. Памятка готова'], ['wait', 'Фабрика ждёт вашей печати', 1],
    ['stamped', 'Одобрено! Новинка выходит в свет'], ['lesson', 'Библиотекарь: урок записан'],
    ['done', 'Новинка вышла! Фиалку не забудут полить', 1]
  ];
  var STEP_IX = {};
  STEPS.forEach(function (st, i) { STEP_IX[st[0]] = i; });
  /* calm mode: the timeline label each status step is shown at */
  var CALM_AT = {
    funnel: 'd:funnel', brigadir: 'd:brigadir', yes1: 'yes1', pisari: 'd:pisari', sovetniki: 'd:sovetniki', pridira: 'a:pridira',
    pridira2: 'd:pridira', gate1: 'd:gate1', board: 'd:board', plan: 'plan', vesy: 'd:vesy', strelochnik: 'd:strelochnik',
    khudozhnik: 'd:khudozhnik', master: 'd:master', poryadok: 'd:poryadok', revizor: 'd:revizor', ispytatel: 'd:ispytatel',
    defect: 'defect', fixed: 'fixed', priyomshchik: 'd:priyomshchik', wait: 'wait', stamped: 'reveal0', lesson: 'lesson', done: 'end'
  };
  var IDLE_TEXT = 'Нажмите «Запустить конвейер».';

  /* ================================================================== render ================================== */
  function render(stage, mode) {
    var Lo = LAYOUTS[mode], Ge = geometry(Lo), S = place(Lo, Ge), s = Lo.s;
    var vb = Lo.vb, bh = Lo.beltW / 2 + 4;
    var fz = function (base) { return Math.max(base, 16.5 / Lo.minPx); };
    var back = '', front = '', top = '', leds = '', bg = '';
    var H = { bubbles: {} };          /* HUD anchors: key → [x, yTop, align] */
    var rnd = MP.seeded ? MP.seeded(mode === 'tall' ? 77 : 1337) : Math.random;

    function foot(st) { return st.y - bh - 3; }
    function ch(type, cx, fy, sc, o) {
      o = o || {}; o.x = cx - 60 * sc; o.y = fy - 140 * sc; o.scale = sc;
      return MP.char(type, o);
    }
    function say(key, x, yTop, al) { H.bubbles[key] = [x, yTop, al]; }
    function led(st, x) {
      var y = st.y + bh + 12 * s, r = 8.5 * Math.max(s, 0.8);
      leds += G('zp-led zp-led-' + st.id, R(x - 2.5, st.y + bh - 3, 5, 12 * s, 1, STEEL_D, ' stroke="none"') +
        C(x, y, r, STEEL_D, ' stroke="' + INK + '" stroke-width="3"') + C(x - r * 0.3, y - r * 0.32, r * 0.26, WHITE, ' fill-opacity=".8"'));
    }
    function stop(st, x, w) { return { x: x, y: st.y, row: st.row, p: progAt(Ge, st.row, x), w: w || st.w || 150 * s }; }
    /* your quick «да» (no click needed): a round lemon «ДА» stamp that lands on the order + a lemon flash ring.
     * «ДА» is sized from fz() like every SVG text here, so it never renders below 16px. */
    function yesStamp(key, st) {
      var dy = fz(28 * s), r = dy * 1.22, cx = st.x + 14 * s, cy = st.y - 34 * s;
      return G('zp-yes zp-yes-' + key,
        G('zp-yes-flash', C(cx, cy, r * 1.2, 'none', ' stroke="' + LEMON + '" stroke-width="' + f(Math.max(5, 7 * s)) + '"'), HIDE) +
        G('zp-yes-in', C(cx, cy, r, LEMON, SW) +
          C(cx, cy, r - 7 * s - 2, 'none', ' stroke="' + INK + '" stroke-width="2.5" stroke-opacity=".4" stroke-dasharray="' + f(6 * s) + ' ' + f(5 * s) + '"') +
          T(cx, cy + dy * 0.37, 'ДА', dy), HIDE));
    }

    /* --- background: stars, moon, catwalks --- */
    for (var i = 0; i < (mode === 'tall' ? 34 : 46); i++) {
      var sx = vb[0] + rnd() * vb[2], sy = vb[1] + rnd() * vb[3], sr = 1.2 + rnd() * 2.2;
      bg += C(sx, sy, sr, CREAM, ' fill-opacity="' + f(0.18 + rnd() * 0.4) + '"');
    }
    var mx = mode === 'tall' ? 640 : 1500, my = 70, mr = mode === 'tall' ? 30 : 38;
    bg += C(mx, my, mr, CREAM, ' fill-opacity=".9"') + C(mx + mr * 0.42, my - mr * 0.28, mr * 0.86, '#1f1a4e');
    bg += P(sparkleD(mx - mr * 2.1, my + mr * 0.9, 9), CREAM, ' fill-opacity=".55"');
    Lo.rows.forEach(function (y) {
      bg += R(Lo.xL - 10, y + bh - 2, Lo.xR - Lo.xL + 20, 16 * s + 6, 8, DEEP);
    });

    /* --- 1. funnel + the sad фиалка --- */
    var fu = S.funnel, fy = foot(fu), fx = fu.x;
    var mouthY = fu.y - 150 * s, mw = 54 * s;
    back += G('zp-funnel-posts', R(fx - 44 * s, mouthY + 26 * s, 9 * s, fu.y - mouthY, 3, STEEL_D, SW) +
      R(fx + 35 * s, mouthY + 26 * s, 9 * s, fu.y - mouthY, 3, STEEL_D, SW));
    var cone = 'M' + f(fx - mw) + ' ' + f(mouthY) + 'L' + f(fx - 15 * s) + ' ' + f(fu.y - 88 * s) + 'V' + f(fu.y - 52 * s) +
      'H' + f(fx + 15 * s) + 'V' + f(fu.y - 88 * s) + 'L' + f(fx + mw) + ' ' + f(mouthY) + 'Z';
    back += G('zp-funnel', P(cone, TANG, SW) +
      L('M' + f(fx - mw * 0.62) + ' ' + f(mouthY + 12 * s) + 'L' + f(fx - 10 * s) + ' ' + f(fu.y - 86 * s), CREAM, 4.5 * s, ' stroke-linecap="round"') +
      L('M' + f(fx - 34 * s) + ' ' + f(mouthY + 30 * s) + 'H' + f(fx + 34 * s), VIOLET, 7 * s, ' stroke-opacity=".9"') +
      E(fx, mouthY, mw, 13 * s, TANG, SW) + E(fx, mouthY + 1.5 * s, mw - 12 * s, 6.5 * s, INK));
    var plx = fx - 104 * s, pls = 0.84 * s;
    back += MP.plant('sad', { x: plx - 60 * pls, y: fu.y + bh - 140 * pls, scale: pls, cls: 'zp-plant0' });
    var ideaPos = { x: fx, y: mouthY - 26 * s }, mouthPos = { x: fx, y: mouthY + 12 * s };
    say('idea', fx + 30 * s, mouthY - 12 * s, 'l');

    /* --- 2. Бригадир + three «?» --- */
    var br = S.brigadir, bfy = foot(br);
    back += ch('brigadir', br.x, bfy, s, { cls: 'zp-c-brigadir' });
    /* the «?» hang beside his head, so the bubble can sit right above it (it must fit under the stage top on phones) */
    var qs = [[-68, -84, -14, TANG], [66, -104, 12, SKY], [-60, -124, -8, MINT]], qm = '';
    qs.forEach(function (q) {
      qm += G('zp-q', T(br.x + q[0] * s, bfy + q[1] * s, '?', fz(40 * s), { fill: q[3], ex: ' stroke="' + INK + '" stroke-width="' + f(4 * s + 1) + '" paint-order="stroke" stroke-linejoin="round"' }), HIDE);
    });
    front += qm;
    say('brigadir', br.x, bfy - 140 * s);
    led(br, br.x);
    front += yesStamp('yes1', br);

    /* --- 3. Писари: two scribes and flying sheets --- */
    var pi = S.pisari, pfy = foot(pi), pxL = pi.x - 62 * s, pxR = pi.x + 62 * s;
    back += ch('pisar', pxL, pfy, s, { cls: 'zp-c-pisar1' }) + ch('pisar', pxR, pfy, s, { cls: 'zp-c-pisar2', expr: 'focus' });
    var sheet = G('', R(-11, -14, 22, 28, 3, CREAM, ' stroke="' + INK + '" stroke-width="3"') +
      L('M-6 -6H6M-6 0H6M-6 6H3', INK, 2, ' stroke-opacity=".5"'));
    var sheetsFrom = [];
    for (i = 0; i < 4; i++) {
      var hx = (i % 2 ? pxR : pxL) + 40 * s, hy = pfy - 52 * s;
      sheetsFrom.push([hx, hy]);
      front += G('zp-fly zp-sheet', G('', sheet, tr(0, 0, s, (i % 2 ? 12 : -10))), HIDE);
    }
    front += G('zp-fly zp-sheet-back', G('', sheet, tr(0, 0, s * 1.15, 8)), HIDE);
    say('pisari', pi.x, pfy - 136 * s);
    led(pi, pi.x);

    /* --- 4. Советники ×5 with rings that fill at the same instant --- */
    var so = S.sovetniki, sfy = foot(so), sa = 0.62 * s, adv = ['speed', 'glasses', 'lock', 'abacus', 'umbrella'], rings = '';
    var advBack = '', advFront = '';
    adv.forEach(function (v, k) {
      var ax = so.x + (k - 2) * 56 * s, lift = k % 2 ? 34 * s : 0, afy = sfy - lift;
      var m = ch('sovetnik', ax, afy, sa, { variant: v, cls: 'zp-c-adv zp-c-adv' + k });
      if (lift) advBack += R(ax - 27 * s, afy - 2 * s, 54 * s, lift + 2 * s + 12, 6 * s, STEEL_D, SW) + m;
      else advFront += m;
      var rc = afy - 140 * sa + 8 * s, rr = 11 * s, ry = rc - 14 * s;
      rings += G('zp-ring', C(ax, ry, rr, CREAM, ' fill-opacity=".12"') + C(ax, ry, rr, 'none', ' stroke="' + CREAM + '" stroke-opacity=".28" stroke-width="' + f(5 * s) + '"') +
        '<path class="zp-ring-p" d="M' + f(ax) + ' ' + f(ry - rr) + 'A' + f(rr) + ' ' + f(rr) + ' 0 1 1 ' + f(ax - 0.01) + ' ' + f(ry - rr) +
        '" fill="none" stroke="' + MINT + '" stroke-width="' + f(5 * s) + '" stroke-linecap="round"' + HIDE + '/>' +
        G('zp-ring-ok', C(ax, ry, rr - 1, MINT, ' stroke="' + INK + '" stroke-width="3"') + L(checkD(ax, ry, 0.75 * s), INK, 3 * s, ' stroke-linecap="round" stroke-linejoin="round"'), HIDE), HIDE);
    });
    back += advBack + advFront;
    front += rings;
    say('sovetniki', so.x, sfy - 34 * s - 140 * sa - 30 * s);
    led(so, so.x);

    /* --- 5. Придира --- */
    var pr = S.pridira, prfy = foot(pr);
    back += ch('pridira', pr.x, prfy, s, { cls: 'zp-c-pridira' });
    say('pridira', pr.x, prfy - 146 * s);
    say('pridira2', pr.x, prfy - 146 * s);
    led(pr, pr.x);

    /* --- 6. gate 1: your «да» to the blueprint --- */
    var g1 = S.gate1, gd = g1.dir, gpx = g1.x + gd * 48 * s, gArmY = g1.y - 36 * s;
    var g1stopX = g1.x - gd * 22 * s;
    back += R(gpx - 6 * s, g1.y - 118 * s, 12 * s, 118 * s + bh, 3, STEEL_D, SW) +
      G('zp-g1-lamp', C(gpx, g1.y - 126 * s, 12 * s, LEMON, SW) + C(gpx - 4 * s, g1.y - 130 * s, 3.4 * s, WHITE, ' stroke="none"'));
    var armLen = 128 * s, armH = 15 * s, stripes = '';
    for (i = 0; i < 5; i++) {
      stripes += R(i * armLen / 5, -armH / 2, armLen / 10, armH, 0, INK, ' stroke="none"');
    }
    var armInner = R(0, -armH / 2, armLen, armH, armH / 2, LEMON, ' stroke="none"') + stripes +
      R(0, -armH / 2, armLen, armH, armH / 2, 'none', SW) + C(0, 0, 7 * s, STEEL, SW);
    front += G('zp-g1-arm', G('', G('', armInner, gd > 0 ? ' transform="scale(-1 1)"' : ''), tr(gpx, gArmY)));
    var dz = fz(34 * s), sw = dz * 2.3, shh = dz * 1.45, sgy = g1.y - 136 * s - shh;
    front += G('zp-g1-sign', R(gpx - sw / 2 - gd * 20 * s, sgy, sw, shh, dz * 0.4, LEMON, SW) +
      T(gpx - gd * 20 * s, sgy + shh * 0.72, 'ДА', dz), HIDE);
    say('gate1', gpx - gd * 20 * s, sgy - 6);
    led(g1, g1.x);

    /* --- 7. Планировщик + the task board --- */
    var bo = S.board, bd = bo.dir, bfy2 = foot(bo), plX = bo.x - bd * 82 * s, bx = bo.x + bd * 72 * s;
    back += ch('planirovshchik', plX, bfy2, s, { cls: 'zp-c-planner' });
    var bw = 132 * s, bht = 102 * s, btop = bfy2 - 158 * s, bl = bx - bw / 2, cols = [SKY, TANG, MINT], board = '';
    board += R(bl + 16 * s, btop + bht - 4, 8 * s, bfy2 - btop - bht + 8, 2, STEEL_D, SW) + R(bl + bw - 24 * s, btop + bht - 4, 8 * s, bfy2 - btop - bht + 8, 2, STEEL_D, SW);
    board += R(bl, btop, bw, bht, 10 * s, CREAM, SW);
    for (i = 0; i < 3; i++) {
      var cx0 = bl + 8 * s + i * (bw - 16 * s) / 3;
      board += R(cx0 + 3 * s, btop + 9 * s, (bw - 16 * s) / 3 - 6 * s, 11 * s, 4 * s, cols[i], ' stroke="' + INK + '" stroke-width="2.5"');
      if (i) board += L('M' + f(cx0) + ' ' + f(btop + 8 * s) + 'V' + f(btop + bht - 8 * s), INK, 2, ' stroke-opacity=".25"');
    }
    back += G('zp-board', board);
    var colW = (bw - 16 * s) / 3, slots = [[0, 0], [0, 1], [0, 2], [2, 0], [2, 1]], cards = '', cardSlots = [];
    slots.forEach(function (sl, k) {
      var cx1 = bl + 8 * s + sl[0] * colW + colW / 2, cy1 = btop + 34 * s + sl[1] * 22 * s;
      cardSlots.push([cx1, cy1]);
      cards += G('zp-fly zp-bcard', R(-15 * s, -8 * s, 30 * s, 16 * s, 3 * s, k === 0 ? VIOLET : WHITE, ' stroke="' + INK + '" stroke-width="2.5"') +
        (k === 0 ? P(dropD(-7 * s, -5 * s, 10 * s), SKY, ' stroke="' + INK + '" stroke-width="1.6"') : L('M' + f(-9 * s) + ' 0H' + f(8 * s), INK, 2, ' stroke-opacity=".4"')), HIDE);
    });
    front += cards;
    front += G('zp-snip', L('M' + f(bo.x - 30 * s) + ' ' + f(bo.y - 30 * s) + 'L' + f(bo.x + 30 * s) + ' ' + f(bo.y - 30 * s), CREAM, 3.4 * s, ' stroke-linecap="round"'), HIDE);
    say('board', plX, bfy2 - 150 * s);
    led(bo, bo.x);
    front += yesStamp('plan', bo);

    /* --- 8–10. automats + Художник --- */
    function machineAt(st, type, cls) {
      var fyM = foot(st);
      return MP.machine(type, { x: st.x - 60 * s, y: fyM - 140 * s, scale: s, lamp: 'off', cls: cls });
    }
    var ve = S.vesy, stl = S.strelochnik;
    back += machineAt(ve, 'vesy', 'zp-m-vesy') + machineAt(stl, 'strelochnik', 'zp-m-strel');
    say('vesy', ve.x, foot(ve) - 132 * s); led(ve, ve.x);
    say('strelochnik', stl.x, foot(stl) - 136 * s); led(stl, stl.x);
    var kh = S.khudozhnik, kfy = foot(kh);
    back += ch('khudozhnik', kh.x, kfy, s, { cls: 'zp-c-artist' });
    [RASP, SKY, MINT].forEach(function (c) {
      front += G('zp-fly zp-swatch', C(0, 0, 9 * s, c, ' stroke="' + INK + '" stroke-width="3"'), HIDE);
    });
    var palettePos = [kh.x - 42 * s, kfy - 40 * s];
    say('khudozhnik', kh.x, kfy - 150 * s); led(kh, kh.x);

    /* --- 11. Мастер --- */
    var ma = S.master, mfy = foot(ma);
    back += ch('master', ma.x, mfy, s, { cls: 'zp-c-master', expr: 'focus' });
    var sparks = '';
    for (i = 0; i < 5; i++) {
      var a = (-150 + i * 30) * Math.PI / 180, r0 = 34 * s, r1 = 52 * s, scx = ma.x, scy = ma.y - 34 * s;
      sparks += L('M' + f(scx + Math.cos(a) * r0) + ' ' + f(scy + Math.sin(a) * r0) + 'L' + f(scx + Math.cos(a) * r1) + ' ' + f(scy + Math.sin(a) * r1), i % 2 ? TANG : CREAM, 4 * s, ' stroke-linecap="round"');
    }
    front += G('zp-sparks', sparks, HIDE);
    say('master', ma.x, mfy - 146 * s);
    say('master2', ma.x, mfy - 146 * s);
    led(ma, ma.x);

    /* --- 12. Порядок: scanner --- */
    var po = S.poryadok;
    back += machineAt(po, 'poryadok', 'zp-m-poryadok');
    front += G('zp-scan', G('', R(-7 * s, -64 * s, 14 * s, 70 * s, 7 * s, SKY, ' fill-opacity=".55" stroke="' + CREAM + '" stroke-width="2.5"'), tr(po.x - 44 * s, po.y)), HIDE);
    say('poryadok', po.x, foot(po) - 148 * s); led(po, po.x);

    /* --- 13. Ревизор (rests: the task is simple) --- */
    var rv = S.revizor, rfy = foot(rv), zz = '';
    back += ch('revizor', rv.x, rfy, s, { cls: 'zp-c-revizor' });
    for (i = 0; i < 3; i++) {
      var zs = (10 + i * 4) * s, zx = rv.x + (28 + i * 16) * s, zy = rfy - (128 + i * 22) * s;
      zz += G('zp-z', L('M' + f(zx) + ' ' + f(zy) + 'H' + f(zx + zs) + 'L' + f(zx) + ' ' + f(zy + zs) + 'H' + f(zx + zs), CREAM, 3.4 * s, ' stroke-linecap="round" stroke-linejoin="round"'), HIDE);
    }
    front += zz;
    say('revizor', rv.x - 10 * s, rfy - 176 * s);
    led(rv, rv.x);

    /* --- 14. Испытатель + Стенд, and the raspberry return arc to Мастер --- */
    var te = S.tests, td = te.dir, tfy = foot(te), isX = te.x - td * 72 * s, stX = te.x + td * 72 * s;
    back += ch('ispytatel', isX, tfy, s, { cls: 'zp-c-tester' }) +
      MP.machine('stend', { x: stX - 60 * s, y: tfy - 140 * s, scale: s, lamp: 'off', cls: 'zp-m-stend' });
    /* a little moon on the stand's screen: the reminder fired at night */
    var scrX = stX - 60 * s + 42.5 * s, scrY = tfy - 140 * s + 81 * s;
    front += G('zp-moon', R(scrX - 21.5 * s, scrY - 14 * s, 43 * s, 28 * s, 4 * s, NIGHT, ' stroke="' + INK + '" stroke-width="3"') +
      C(scrX - 2 * s, scrY, 8.5 * s, CREAM) + C(scrX + 2.5 * s, scrY - 3 * s, 7.5 * s, NIGHT) +
      C(scrX + 12 * s, scrY - 7 * s, 1.6 * s, CREAM) + C(scrX + 14 * s, scrY + 6 * s, 1.3 * s, CREAM), HIDE);
    say('ispytatel', isX, tfy - 150 * s);
    say('stend', stX, tfy - 150 * s);
    say('stend2', stX, tfy - 150 * s);
    led(te, stX);
    var ret0 = [stX, te.y], ret1 = [ma.x, ma.y];
    var rside = te.dir > 0 ? -1 : 1, rcx = Math.min(ret0[0], ret1[0]) * (rside < 0 ? 1 : 0) + Math.max(ret0[0], ret1[0]) * (rside > 0 ? 1 : 0) + rside * 170 * s,
      rcy = (ret0[1] + ret1[1]) / 2 - 10 * s;
    var retD = 'M' + f(ret0[0]) + ' ' + f(ret0[1]) + 'Q' + f(rcx) + ' ' + f(rcy) + ' ' + f(ret1[0]) + ' ' + f(ret1[1]);
    var retPath = '<path class="zp-return" d="' + retD + '" fill="none" stroke="' + RASP + '" stroke-width="' + f(6 * s) +
      '" stroke-linecap="round" stroke-dasharray="' + f(2 * s) + ' ' + f(14 * s) + '"' + HIDE + '/>';

    /* --- 15. Приёмщик --- */
    var pq = S.priyomshchik, qfy = foot(pq);
    back += ch('priyomshchik', pq.x, qfy, s, { cls: 'zp-c-verifier' });
    var memo = R(-17 * s, -22 * s, 34 * s, 44 * s, 4 * s, CREAM, ' stroke="' + INK + '" stroke-width="3"');
    for (i = 0; i < 4; i++) memo += L(checkD(-9 * s, -12 * s + i * 10 * s, 0.35 * s), MINT, 2.4 * s, ' stroke-linecap="round"') + L('M' + f(-3 * s) + ' ' + f(-12 * s + i * 10 * s) + 'H' + f(11 * s), INK, 2, ' stroke-opacity=".45"');
    front += G('zp-memo', G('', memo, tr(pq.x + 46 * s, qfy - 112 * s, 1, 6)), HIDE);
    say('priyomshchik', pq.x, qfy - 150 * s);
    led(pq, pq.x);

    /* --- 16. gate 2: YOUR stamp --- */
    var g2 = S.gate2, g2t = g2.y - 214 * s, kh2 = 0.86 * s;
    back += R(g2.x - 66 * s, g2t, 11 * s, g2.y - g2t + bh, 3, STEEL_D, SW) + R(g2.x + 55 * s, g2t, 11 * s, g2.y - g2t + bh, 3, STEEL_D, SW) +
      R(g2.x - 74 * s, g2t - 8 * s, 148 * s, 16 * s, 8 * s, STEEL, SW) +
      G('zp-g2-lamp', C(g2.x + 60.5 * s, g2t - 20 * s, 11 * s, LEMON, SW) + C(g2.x + 57 * s, g2t - 24 * s, 3 * s, WHITE, ' stroke="none"'));
    var stampBottom = g2.y - 64 * s, handY = stampBottom - 122 * kh2;
    front += G('zp-g2-rod', R(g2.x - 5 * s, g2t + 6 * s, 10 * s, handY - g2t, 3, STEEL_D, SW));
    front += G('zp-g2-ring', G('zp-g2-ring-in', C(g2.x, handY + 78 * kh2, 66 * s, 'none', ' stroke="' + LEMON + '" stroke-width="' + f(7 * s) + '" stroke-dasharray="' + f(12 * s) + ' ' + f(10 * s) + '" stroke-linecap="round"')), HIDE);
    front += MP.stampHand({ x: g2.x - 60 * kh2, y: handY, scale: kh2, cls: 'zp-hand' });
    var slam = [];
    for (i = 0; i < 6; i++) {
      var sa2 = (-160 + i * 28) * Math.PI / 180, s0 = 44 * s, s1 = 70 * s, cyS = g2.y - 30 * s;
      slam.push('M' + f(g2.x + Math.cos(sa2) * s0) + ' ' + f(cyS + Math.sin(sa2) * s0) + 'L' + f(g2.x + Math.cos(sa2) * s1) + ' ' + f(cyS + Math.sin(sa2) * s1));
    }
    front += G('zp-splash', slam.map(function (d) { return L(d, LEMON, 5 * s, ' class="zp-splash-l" stroke-linecap="round"'); }).join(''), HIDE);
    say('gate2', g2.x, g2t - 36 * s);
    led(g2, g2.x);
    H.hot = [g2.x - 70 * s, g2t - 34 * s, 140 * s, g2.y - g2t + 34 * s];

    /* --- 17. the end of the belt: Библиотекарь keeps the lesson (drawn on top of the scrim) --- */
    var ex = S.exit, efy = ex.y - bh - 1;
    top += ch('bibliotekar', ex.x, efy, s, { cls: 'zp-c-librarian' });
    say('bibliotekar', ex.x, efy - 146 * s);
    var drawerPos = [ex.x + 40 * s, efy - 40 * s];

    /* --- the token (rides the belt) --- */
    var tk = '';
    tk += G('tk tk-idea', P('M-36 -58H36Q46 -58 46 -48V-22Q46 -12 36 -12H-6L-20 0L-18 -12H-36Q-46 -12 -46 -22V-48Q-46 -58 -36 -58Z', CREAM, SW) +
      P(dropD(-10, -52, 32), SKY, ' stroke="' + INK + '" stroke-width="3"') +
      P('M6 -30C8 -44 20 -50 28 -48C28 -38 20 -30 7 -30Z', MINT, ' stroke="' + INK + '" stroke-width="3"'));
    tk += G('tk tk-sheet', R(-26, -58, 50, 46, 4, '#8FDDFF', SW) + R(-32, -52, 52, 46, 4, SKY, SW) +
      L('M-24 -40H12M-24 -30H4M-24 -20H10', WHITE, 3, ' stroke-linecap="round"') + C(10, -18, 5, 'none', ' stroke="' + WHITE + '" stroke-width="2.5"'), HIDE);
    tk += G('tk tk-ok', C(24, -56, 12, MINT, SW) + L(checkD(24, -56, 0.8), INK, 3.5, ' stroke-linecap="round" stroke-linejoin="round"'), HIDE);
    tk += G('tk tk-card', R(-38, -50, 76, 44, 8, CREAM, SW) + R(-38, -50, 76, 13, 6, VIOLET, SW) +
      P(dropD(-22, -32, 20), SKY, ' stroke="' + INK + '" stroke-width="3"') + L('M-6 -26H26M-6 -16H18', INK, 3, ' stroke-opacity=".45" stroke-linecap="round"') +
      G('tk-colors', C(12, -44, 5, RASP, ' stroke="' + INK + '" stroke-width="2.5"') + C(24, -44, 5, SKY, ' stroke="' + INK + '" stroke-width="2.5"') +
        C(36, -44, 5, MINT, ' stroke="' + INK + '" stroke-width="2.5"') + R(-2, -12, 36, 4, 2, TANG, ' stroke="none"'), HIDE), HIDE);
    var piece = 'M-30 -46H-8Q-8 -58 2 -58Q12 -58 12 -46H30V-26Q42 -26 42 -18Q42 -10 30 -10V-6H-30Z';
    tk += G('tk tk-part', P(piece, TANG, SW) + L('M-22 -40V-16', CREAM, 4, ' stroke-linecap="round"') +
      P('M0 -40Q-9 -40 -9 -30V-22L-13 -17H13L9 -22V-30Q9 -40 0 -40Z', CREAM, ' stroke="' + INK + '" stroke-width="3"') + C(0, -13, 3.2, INK), HIDE);
    var tags = '';
    [[-18, SKY, -12], [2, MINT, 0], [22, VIOLET, 12]].forEach(function (tg) {
      tags += G('tk-tag', L('M' + tg[0] + ' -50V-74', INK, 3) + P('M' + tg[0] + ' -74L' + (tg[0] + 16) + ' -69L' + tg[0] + ' -63Z', tg[1], ' stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"'), HIDE);
    });
    tk += tags;
    tk += G('tk tk-fixed', C(30, -52, 12, MINT, SW) + L(checkD(30, -52, 0.8), INK, 3.5, ' stroke-linecap="round" stroke-linejoin="round"'), HIDE);
    var token = G('zp-token', G('zp-tk-body', G('', tk, ' transform="translate(0 ' + f(12 * s) + ') scale(' + f(s * 0.92) + ')"')));

    /* --- reveal: scrim, burst, big seal, phone, blooming фиалка, capsule, lesson card --- */
    var rv0 = Lo.reveal, pk = Math.max(2.3, 16.4 / (11 * Lo.minPx)), phW = 140 * pk, phH = 260 * pk;
    if (mode === 'wide') pk = Math.max(pk, 2.5);
    phW = 140 * pk; phH = 260 * pk;
    var phX = rv0[0] - phW / 2, phY = rv0[1] - phH / 2;
    var burst = '', nR = 16, bR = Math.max(phH * 0.8, 420);
    for (i = 0; i < nR; i++) {
      var a0 = (i / nR) * Math.PI * 2, a1 = ((i + 0.5) / nR) * Math.PI * 2;
      burst += P('M' + f(rv0[0]) + ' ' + f(rv0[1]) + 'L' + f(rv0[0] + Math.cos(a0) * bR) + ' ' + f(rv0[1] + Math.sin(a0) * bR) + 'L' +
        f(rv0[0] + Math.cos(a1) * bR) + ' ' + f(rv0[1] + Math.sin(a1) * bR) + 'Z', i % 2 ? VIOLET : '#3B2A9E');
    }
    var sealK = Math.max(1.9, 16.4 / (10.5 * Lo.minPx)), sealW = 100 * sealK;
    var plK = mode === 'tall' ? 1.5 : 1.75 * (pk / 2.5), plW = 120 * plK;
    /* tall: the phone fills the width, so the blooming фиалка stands under its right half (clear of the librarian's bubble) */
    /* the фиалка stands on the side away from the librarian at the belt's end (right end on wide, left end on mid) */
    var plantX = mode === 'tall' ? Math.min(vb[2] - plW - 16, phX + phW * 0.62) : (mode === 'mid' ? phX + phW + 18 : phX - plW - 18),
      plantY = mode === 'tall' ? Math.min(vb[1] + vb[3] - 140 * plK - 8, phY + phH + 6) : phY + phH - 140 * plK;
    var reveal = '<rect class="zp-scrim" x="' + vb[0] + '" y="' + vb[1] + '" width="' + vb[2] + '" height="' + vb[3] + '" fill="' + INK + '" fill-opacity=".78"' + HIDE + '/>' +
      G('zp-burst', G('zp-burst-in', burst, ' opacity=".9"'), HIDE) +
      G('zp-bloom', MP.plant('bloom', { x: plantX, y: plantY, scale: plK }), HIDE) +
      G('zp-phone', MP.phone('notify', { x: phX, y: phY, scale: pk }), HIDE) +
      G('zp-seal', MP.seal({ x: rv0[0] - sealW / 2, y: rv0[1] - sealW / 2, scale: sealK }), HIDE) +
      G('zp-fly zp-cap', G('', R(-30, -15, 60, 30, 15, MINT, SW) + R(-30, -15, 30, 30, 15, SKY, SW) +
        L('M-20 -7H14', WHITE, 4, ' stroke-linecap="round" stroke-opacity=".8"') + P(sparkleD(36, -22, 9), CREAM, ' stroke="' + INK + '" stroke-width="2.4"'), ' transform="scale(' + f(s * 1.2) + ')"'), HIDE) +
      G('zp-fly zp-lesson', G('', R(-20, -14, 40, 28, 5, CREAM, SW) + P('M0 -8L2.4 -2.6L8 -2L3.8 1.8L5 7.4L0 4.6L-5 7.4L-3.8 1.8L-8 -2L-2.4 -2.6Z', TANG, ' stroke="' + INK + '" stroke-width="2"'), ' transform="scale(' + f(s) + ')"'), HIDE);

    /* --- the work lamp: a soft beam that follows the order from station to station (moved by the timeline) --- */
    var wireTop = -(2 * Lo.r - bh - 6);   /* hangs from the underside of the belt above */
    var spot = G('zp-spot', G('zp-spot-beam', P('M' + f(-18 * s) + ' ' + f(-bh - 210 * s) + 'H' + f(18 * s) + 'L' + f(92 * s) + ' ' + f(-bh) + 'H' + f(-92 * s) + 'Z', CREAM, ' fill-opacity=".07"') +
      E(0, -bh - 2, 96 * s, 15 * s, CREAM, ' fill-opacity=".1"')) + (wireTop < -bh - 222 * s ? L('M0 ' + f(-bh - 220 * s) + 'V' + f(wireTop), STEEL_D, 3) : '') + R(-22 * s, -bh - 222 * s, 44 * s, 14 * s, 7 * s, STEEL_D, ' stroke="' + INK + '" stroke-width="3"'), HIDE);

    /* --- assemble --- */
    var belt = MP.belt({ points: Ge.pts, r: Lo.r, w: Lo.beltW, pitch: 24 * s + 6, color: STEEL, cls: 'zp-belt' });
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb.join(' ') + '" class="zp-svg" focusable="false" aria-hidden="true">' +
      G('zp-world', G('zp-bg', bg) + spot + G('zp-back', back) + belt + G('zp-leds', leds) + retPath + token + G('zp-front', front)) +
      G('zp-reveal', reveal) + G('zp-top', top) + '</svg>';

    /* HUD (HTML bubbles, always ≥16px) + in-stage start button and stamp hotspot (pointer conveniences; the real
     * controls are the buttons under the stage) */
    var hud = '<div class="zp-hud">';
    Object.keys(H.bubbles).forEach(function (k) {
      var b = H.bubbles[k], lx = (b[0] - vb[0]) / vb[2] * 100, ly = (b[1] - vb[1]) / vb[3] * 100;
      var al = b[2] ? ' is-' + b[2] : (lx < 17 ? ' is-l' : (lx > 83 ? ' is-r' : ''));
      hud += '<div class="zp-say' + al + '" data-say="' + k + '" style="left:' + f(lx) + '%;top:' + f(ly) + '%">' +
        '<span class="zp-say-in zp-tone-' + (TONE[k] || 'cream') + '" style="visibility:hidden;opacity:0">' + SAY[k] + '</span></div>';
    });
    var hot = H.hot;
    hud += '</div><div class="zp-go" aria-hidden="true"><span class="zp-go-in"><span class="zp-go-disc"><svg class="ico"><use href="#i-play"/></svg></span>' +
      '<span class="zp-go-label">Запустить</span></span></div>' +
      '<div class="zp-hot" aria-hidden="true" hidden style="left:' + f((hot[0] - vb[0]) / vb[2] * 100) + '%;top:' + f((hot[1] - vb[1]) / vb[3] * 100) +
      '%;width:' + f(hot[2] / vb[2] * 100) + '%;height:' + f(hot[3] / vb[3] * 100) + '%"></div>';

    stage.innerHTML = svg + hud;
    stage.setAttribute('data-mode', mode);
    if (MP.nbsp) MP.nbsp(stage.querySelector('.zp-hud'));

    return {
      mode: mode, Lo: Lo, Ge: Ge, S: S, s: s,
      pos: {
        idea: ideaPos, mouth: mouthPos, sheetsFrom: sheetsFrom, pisarBack: [pxR + 40 * s, pfy - 52 * s], cardSlots: cardSlots,
        palette: palettePos, retD: retD, gatePivot: [gpx, gArmY], drawer: drawerPos, reveal: rv0, phone: [phX, phY, pk], plant: [plantX, plantY, plK]
      },
      stops: {
        funnel: stop(fu, fu.x), brigadir: stop(br, br.x), pisari: stop(pi, pi.x), sovetniki: stop(so, so.x), pridira: stop(pr, pr.x),
        gate1: stop(g1, g1stopX), board: stop(bo, bo.x), vesy: stop(ve, ve.x),
        strelochnik: stop(stl, stl.x), khudozhnik: stop(kh, kh.x), master: stop(ma, ma.x), poryadok: stop(po, po.x),
        revizor: stop(rv, rv.x), ispytatel: stop(te, isX, 150 * s), stend: stop(te, stX, 150 * s), priyomshchik: stop(pq, pq.x), gate2: stop(g2, g2.x)
      },
      ret0: ret0, ret1: ret1
    };
  }

  /* keep every bubble inside the stage: slide it sideways (--dx) and move its tail (--tail) so it still points at the
   * speaker. Pixel maths, so it is redone whenever the stage changes size (ResizeObserver in start()). */
  function fitBubbles(stage) {
    var hud = stage.querySelector('.zp-hud'), W = hud ? hud.clientWidth : 0;
    if (!W) return;
    qa(hud, '.zp-say').forEach(function (el) {
      var w = el.offsetWidth, ax = el.offsetLeft;
      var natural = el.classList.contains('is-l') ? ax - 22 : (el.classList.contains('is-r') ? ax - w + 22 : ax - w / 2);
      var left = Math.max(6, Math.min(W - 6 - w, natural));
      el.style.setProperty('--dx', f(left - natural) + 'px');
      el.style.setProperty('--tail', f(Math.max(20, Math.min(w - 20, ax - left))) + 'px');
    });
  }

  /* ================================================================== timeline ================================ */
  function q(root, sel) { return root.querySelector(sel); }
  function qa(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function mainLamp(el) { return el ? el.querySelector('.c-lamp--main circle') : null; }

  function buildTimeline(stage, D, hooks) {
    var gsap = window.gsap, s = D.s, P0 = D.pos, ST = D.stops, Ge = D.Ge;
    var svg = q(stage, 'svg'), world = q(svg, '.zp-world');
    var token = q(svg, '.zp-token'), body = q(svg, '.zp-tk-body'), flow = q(svg, '.belt-flow');
    var tkv = {};
    ['idea', 'sheet', 'ok', 'card', 'part', 'fixed'].forEach(function (k) { tkv[k] = q(svg, '.tk-' + k); });
    var colors = q(svg, '.tk-colors'), tags = qa(svg, '.tk-tag');
    var say = {};
    qa(stage, '.zp-say').forEach(function (el) { say[el.getAttribute('data-say')] = el.firstChild; });
    var led = function (id) { return q(svg, '.zp-led-' + id + ' circle'); };
    var C_ = function (cls) { return q(svg, '.' + cls); };

    var tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
    /* fromTo renders its from-state as a separate startAt tween: give it the same origin, or GSAP's smoothOrigin
     * compensation leaves a permanent offset of -(origin) on SVG groups */
    function ft(el, from, to, at) {
      if (to.transformOrigin && !from.transformOrigin) from.transformOrigin = to.transformOrigin;
      if (to.svgOrigin && !from.svgOrigin) from.svgOrigin = to.svgOrigin;
      from.smoothOrigin = false;
      return tl.fromTo(el, from, to, at);
    }
    var t = 0, cur = null, labels = {};

    /* initial state (the built DOM already is it; this pins the token + bubbles for the timeline) */
    gsap.set(token, { x: P0.idea.x, y: P0.idea.y });
    gsap.set(qa(stage, '.zp-say-in'), { autoAlpha: 0, scale: 0.6, y: 10, transformOrigin: '50% 100%' });
    var spot = q(svg, '.zp-spot'), beam = q(svg, '.zp-spot-beam'), beamK = function (st) { return Math.max(0.85, Math.min(1.7, st.w / (180 * s))); };
    gsap.set(spot, { x: ST.funnel.x, y: ST.funnel.y });
    gsap.set(beam, { scaleX: beamK(ST.funnel), transformOrigin: '50% 100%' });

    function lab(name, at) { labels[name] = at == null ? t : at; tl.addLabel(name, labels[name]); }
    function status(k, at) { tl.call(hooks.status, [STEP_IX[k]], at == null ? t : at); }
    function sayIn(k, at) {
      tl.to(say[k], { autoAlpha: 1, scale: 1, y: 0, duration: 0.34, ease: 'back.out(2.2)' }, at == null ? t : at);
    }
    function sayOut(k, at) { tl.to(say[k], { autoAlpha: 0, scale: 0.8, y: 4, duration: 0.16, ease: 'power2.in' }, at); }
    function ledTo(id, col, at) { tl.set(led(id), { attr: { fill: col } }, at); ft(q(svg, '.zp-led-' + id), { scale: 1.5 }, { scale: 1, duration: 0.3, ease: 'elastic.out(1,.5)', transformOrigin: '50% 60%', immediateRender: false }, at); }
    function ride(to, dur) {
      var p0 = cur.p, p1 = to.p, dist = Math.abs(p1 - p0) * Ge.total;
      var d = dur || Math.min(0.5, Math.max(0.26, dist / (D.Lo.vb[2] * 1.5)));
      tl.to(token, { motionPath: { path: Ge.d, start: p0, end: p1 }, duration: d, ease: 'power1.inOut' }, t);
      if (flow) tl.to(flow, { strokeDashoffset: '-=' + f(dist), duration: d, ease: 'power1.inOut' }, t);
      lampTo(to, t, d);
      t += d; cur = to;
    }
    /* the work lamp slides along a row; to another row it dims and comes back on above the next station */
    function lampTo(to, at, d) {
      var k = beamK(to);
      if (!cur || cur.row === to.row) {
        tl.to(spot, { x: to.x, y: to.y, duration: d, ease: 'power1.inOut' }, at);
        tl.to(beam, { scaleX: k, duration: d, ease: 'power1.inOut' }, at);
      } else {
        tl.to(spot, { autoAlpha: 0, duration: d * 0.35, ease: 'power1.in' }, at);
        tl.set(spot, { x: to.x, y: to.y }, at + d * 0.5);
        tl.set(beam, { scaleX: k }, at + d * 0.5);
        tl.to(spot, { autoAlpha: 1, duration: d * 0.45, ease: 'power1.out' }, at + d * 0.55);
      }
    }
    function morph(from, to, at) {
      tl.to(from, { scale: 0.2, autoAlpha: 0, duration: 0.14, ease: 'power2.in', transformOrigin: '50% 100%' }, at);
      ft(to, { scale: 0.3, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.34, ease: 'back.out(2.4)', transformOrigin: '50% 100%', immediateRender: false }, at + 0.12);
    }
    function squash(at) {
      ft(body, { scaleX: 1.18, scaleY: 0.78 }, { scaleX: 1, scaleY: 1, duration: 0.4, ease: 'elastic.out(1,.45)', transformOrigin: '50% 100%', immediateRender: false }, at);
    }
    function fly(el, from, to, at, dur, lift, rot) {
      var cx = (from[0] + to[0]) / 2, cy = Math.min(from[1], to[1]) - (lift == null ? 60 * s : lift);
      tl.set(el, { x: from[0], y: from[1], autoAlpha: 1, scale: 1, rotation: 0, transformOrigin: '50% 50%' }, at);
      tl.to(el, { motionPath: { path: 'M' + f(from[0]) + ' ' + f(from[1]) + 'Q' + f(cx) + ' ' + f(cy) + ' ' + f(to[0]) + ' ' + f(to[1]) },
        rotation: rot || 0, transformOrigin: '50% 50%', duration: dur, ease: 'power1.inOut' }, at);
    }
    function hop(el, at, h) { tl.to(el, { y: -(h || 10) * s, duration: 0.14, ease: 'power2.out', yoyo: true, repeat: 1 }, at); }
    function armWiggle(arm, at, amp, n, base) {
      if (!arm) return;
      tl.to(arm, { rotation: (base || 0) + amp, duration: 0.1, ease: 'sine.inOut', yoyo: true, repeat: (n || 3) * 2 - 1 }, at);
    }
    var tokAt = function (st, dy) { return [st.x, st.y - (dy == null ? 28 : dy) * s]; };
    /* a quick «да» of yours (≈0.6 s, no click): the station lamp and the work lamp turn lemon, the «ДА» stamp slams on
     * the order (stamp ease), a lemon ring flashes, then the lamps go mint and the stamp lifts. Returns the new t. */
    function quickYes(key, ledId, at) {
      var g = q(svg, '.zp-yes-' + key), inn = q(g, '.zp-yes-in'), fl = q(g, '.zp-yes-flash');
      status(key, at);
      ledTo(ledId, LEMON, at);
      tl.set(beam.children, { attr: { fill: LEMON } }, at);
      ft(inn, { autoAlpha: 0, scale: 2, rotation: -30 }, { autoAlpha: 1, scale: 0.92, rotation: -10, duration: 0.18, ease: 'power4.in', transformOrigin: '50% 50%', immediateRender: false }, at + 0.02);
      tl.to(inn, { scale: 1, duration: 0.28, ease: 'elastic.out(1,.4)' }, at + 0.2);
      squash(at + 0.2);
      ft(fl, { autoAlpha: 0.95, scale: 0.7 }, { autoAlpha: 0, scale: 1.5, duration: 0.4, ease: 'power2.out', transformOrigin: '50% 50%', immediateRender: false }, at + 0.2);
      lab(key, at + 0.42);                       /* calm mode shows this step here: the stamp is on */
      ledTo(ledId, MINT, at + 0.46);
      tl.set(beam.children, { attr: { fill: CREAM } }, at + 0.6);
      tl.to(inn, { autoAlpha: 0, scale: 0.7, duration: 0.14, ease: 'power2.in' }, at + 0.46);
      return at + 0.6;
    }

    /* ---- 1. the idea drops into the funnel ---- */
    lab('a:funnel'); status('funnel');
    ft(spot, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, ease: 'power1.out', immediateRender: false }, 0.05);
    sayIn('idea', 0.05);
    tl.to(q(svg, '.zp-plant0'), { scaleY: 0.9, scaleX: 1.05, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.inOut' }, 0.1);
    tl.to(token, { y: P0.mouth.y, duration: 0.38, ease: 'power2.in' }, 0.34);
    tl.to(body, { scale: 0.45, duration: 0.38, ease: 'power2.in', transformOrigin: '50% 100%' }, 0.34);
    tl.set(token, { autoAlpha: 0 }, 0.72);
    ft(q(svg, '.zp-funnel'), { scaleY: 0.86, scaleX: 1.08 }, { scaleY: 1, scaleX: 1, duration: 0.45, ease: 'elastic.out(1,.4)', transformOrigin: '50% 100%', immediateRender: false }, 0.72);
    tl.set(token, { x: ST.funnel.x, y: ST.funnel.y, autoAlpha: 1 }, 0.84);
    ft(body, { scale: 0.45 }, { scale: 1, duration: 0.36, ease: 'back.out(2.6)', transformOrigin: '50% 100%', immediateRender: false }, 0.84);
    t = 1.12; cur = ST.funnel; lab('d:funnel');
    sayOut('idea', 1.12);

    /* ---- 2. Бригадир asks ---- */
    ride(ST.brigadir);
    lab('a:brigadir'); status('brigadir'); sayIn('brigadir');
    var bri = C_('zp-c-brigadir');
    hop(bri, t, 8);
    qa(svg, '.zp-q').forEach(function (qq, k) {
      ft(qq, { autoAlpha: 0, scale: 0, rotation: -30 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.36, ease: 'back.out(2.6)', transformOrigin: '50% 100%', immediateRender: false }, t + 0.1 + k * 0.14);
    });
    armWiggle(q(bri, '.c-arm-r'), t + 0.1, -16, 2);
    tl.to(qa(svg, '.zp-q'), { autoAlpha: 0, scale: 0.4, y: -12, duration: 0.2, stagger: 0.04, ease: 'power2.in' }, t + 0.78);
    t += 0.9; lab('d:brigadir');
    sayOut('brigadir', t);

    /* ---- 2b. your first «да»: the list of screens ---- */
    t = quickYes('yes1', 'brigadir', t);

    /* ---- 3. Писари write the blueprint ---- */
    ride(ST.pisari);
    lab('a:pisari'); status('pisari'); sayIn('pisari');
    armWiggle(q(C_('zp-c-pisar1'), '.c-arm-r'), t, -14, 3);
    armWiggle(q(C_('zp-c-pisar2'), '.c-arm-r'), t + 0.05, -14, 3);
    qa(svg, '.zp-sheet').forEach(function (sh, k) {
      var at = t + 0.12 + k * 0.1;
      fly(sh, P0.sheetsFrom[k], tokAt(ST.pisari, 34), at, 0.36, 70 * s, k % 2 ? -200 : 200);
      tl.to(sh, { autoAlpha: 0, scale: 0.4, duration: 0.1 }, at + 0.34);
    });
    morph(tkv.idea, tkv.sheet, t + 0.55);
    squash(t + 0.67);
    t += 0.92; lab('d:pisari'); ledTo('pisari', MINT, t - 0.15);
    sayOut('pisari', t);

    /* ---- 4. five advisors at the same instant ---- */
    ride(ST.sovetniki);
    lab('a:sovetniki'); status('sovetniki'); sayIn('sovetniki');
    var ringsP = qa(svg, '.zp-ring-p'), ringsOk = qa(svg, '.zp-ring-ok'), advs = qa(svg, '.zp-c-adv');
    tl.set(ringsP, { drawSVG: '0%', autoAlpha: 1 }, t + 0.05);
    tl.to(ringsP, { drawSVG: '100%', duration: 0.62, ease: 'power1.inOut' }, t + 0.1);
    tl.to(advs, { y: -9 * s, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out' }, t + 0.1);
    ft(ringsOk, { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)', transformOrigin: '50% 50%', immediateRender: false }, t + 0.72);
    t += 0.95; lab('d:sovetniki'); ledTo('sovetniki', MINT, t - 0.15);
    sayOut('sovetniki', t);

    /* ---- 5. Придира returns one sheet, it comes back fixed ---- */
    ride(ST.pridira);
    lab('a:pridira'); status('pridira'); sayIn('pridira');
    var pri = C_('zp-c-pridira');
    ledTo('pridira', RASP, t + 0.05);
    armWiggle(q(pri, '.c-arm-r'), t, -22, 2);
    tl.to(pri, { rotation: -5, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, t + 0.05);
    var back = q(svg, '.zp-sheet-back');
    fly(back, tokAt(ST.pridira, 40), P0.pisarBack, t + 0.15, 0.38, 110 * s, -360);
    armWiggle(q(C_('zp-c-pisar2'), '.c-arm-r'), t + 0.5, -14, 2);
    fly(back, P0.pisarBack, tokAt(ST.pridira, 40), t + 0.82, 0.36, 110 * s, 0);
    tl.to(back, { autoAlpha: 0, scale: 0.4, duration: 0.1 }, t + 1.16);
    sayOut('pridira', t + 0.9);
    ft(tkv.ok, { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: 0.36, ease: 'back.out(3)', transformOrigin: '50% 50%', immediateRender: false }, t + 1.18);
    squash(t + 1.18);
    status('pridira2', t + 1.18); sayIn('pridira2', t + 1.18);
    t += 1.6; lab('d:pridira'); ledTo('pridira', MINT, t - 0.4);
    sayOut('pridira2', t);

    /* ---- 6. gate 1: «да» for the blueprint ---- */
    ride(ST.gate1);
    lab('a:gate1'); status('gate1');
    var g1lamp = q(svg, '.zp-g1-lamp');
    tl.to(g1lamp, { scale: 1.3, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '50% 50%' }, t);
    ft(q(svg, '.zp-g1-sign'), { autoAlpha: 0, scale: 2, rotation: -8 }, { autoAlpha: 1, scale: 1, rotation: -4, duration: 0.3, ease: 'power4.in', transformOrigin: '50% 50%', immediateRender: false }, t + 0.1);
    sayIn('gate1', t + 0.2);
    tl.to(q(svg, '.zp-g1-arm'), { rotation: (D.S.gate1.dir > 0 ? 1 : -1) * 78, duration: 0.42, ease: 'back.out(1.6)', svgOrigin: f(D.pos.gatePivot[0]) + ' ' + f(D.pos.gatePivot[1]) }, t + 0.45);
    tl.set(q(svg, '.zp-g1-lamp circle'), { attr: { fill: MINT } }, t + 0.45);
    t += 0.8; lab('d:gate1'); ledTo('gate1', MINT, t - 0.3);
    sayOut('gate1', t + 0.1);
    tl.to(q(svg, '.zp-g1-sign'), { autoAlpha: 0, scale: 0.6, duration: 0.2 }, t + 0.1);

    /* ---- 7. Планировщик cuts the blueprint into task cards ---- */
    ride(ST.board, 0.6);
    lab('a:board'); status('board'); sayIn('board');
    var planner = C_('zp-c-planner');
    armWiggle(q(planner, '.c-arm-r'), t, -18, 3);
    var snip = q(svg, '.zp-snip');
    tl.set(snip, { autoAlpha: 1, drawSVG: '0%' }, t + 0.05);
    tl.to(snip, { drawSVG: '100%', duration: 0.22, ease: 'none' }, t + 0.05);
    tl.to(snip, { autoAlpha: 0, duration: 0.1 }, t + 0.3);
    tl.to([tkv.sheet, tkv.ok], { scale: 0, autoAlpha: 0, duration: 0.16, ease: 'power2.in', transformOrigin: '50% 100%' }, t + 0.28);
    qa(svg, '.zp-bcard').forEach(function (cd, k) {
      var at = t + 0.34 + k * 0.07;
      fly(cd, tokAt(ST.board, 34), P0.cardSlots[k], at, 0.34, 50 * s, 0);
    });
    var chosen = q(svg, '.zp-bcard');
    tl.to(chosen, { scale: 1.35, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out' }, t + 0.86);
    fly(chosen, P0.cardSlots[0], tokAt(ST.board, 30), t + 1.1, 0.34, 40 * s, 0);
    tl.to(chosen, { autoAlpha: 0, duration: 0.06 }, t + 1.43);
    ft(tkv.card, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.32, ease: 'back.out(2.4)', transformOrigin: '50% 100%', immediateRender: false }, t + 1.42);
    t += 1.45; lab('d:board');
    sayOut('board', t);

    /* ---- 7b. your «да» to the plan ---- */
    t = quickYes('plan', 'board', t);

    /* ---- 8. Весы ---- */
    ride(ST.vesy);
    lab('a:vesy'); status('vesy'); sayIn('vesy');
    var vesy = C_('zp-m-vesy');
    tl.to(body, { y: -10, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out' }, t);
    tl.to(q(vesy, '.c-needle'), { keyframes: { rotation: [0, 48, -18, 22, 6] }, duration: 0.6, ease: 'none' }, t + 0.05);
    tl.set(mainLamp(vesy), { attr: { fill: MINT } }, t + 0.5);
    t += 0.68; lab('d:vesy'); ledTo('vesy', MINT, t - 0.15);
    sayOut('vesy', t);

    /* ---- 9. Стрелочник ---- */
    ride(ST.strelochnik);
    lab('a:strelochnik'); status('strelochnik'); sayIn('strelochnik');
    var strel = C_('zp-m-strel');
    tl.to(q(strel, '.c-lever'), { rotation: 52, duration: 0.3, ease: 'back.out(2)' }, t + 0.1);
    tl.to(q(strel, '.c-gear'), { rotation: 180, duration: 0.5, ease: 'power2.out' }, t + 0.1);
    tl.set(mainLamp(strel), { attr: { fill: MINT } }, t + 0.4);
    t += 0.62; lab('d:strelochnik'); ledTo('strelochnik', MINT, t - 0.15);
    sayOut('strelochnik', t);

    /* ---- 10. Художник ---- */
    ride(ST.khudozhnik);
    lab('a:khudozhnik'); status('khudozhnik'); sayIn('khudozhnik');
    var art = C_('zp-c-artist');
    armWiggle(q(art, '.c-arm-r'), t, -20, 3);
    qa(svg, '.zp-swatch').forEach(function (sw, k) {
      fly(sw, P0.palette, [ST.khudozhnik.x + (k - 1) * 14 * s, ST.khudozhnik.y - 40 * s], t + 0.1 + k * 0.1, 0.34, 70 * s, 0);
      tl.to(sw, { autoAlpha: 0, scale: 0.3, duration: 0.1 }, t + 0.42 + k * 0.1);
    });
    ft(colors, { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2.6)', transformOrigin: '50% 50%', immediateRender: false }, t + 0.52);
    squash(t + 0.6);
    t += 0.85; lab('d:khudozhnik'); ledTo('khudozhnik', MINT, t - 0.15);
    sayOut('khudozhnik', t);

    /* ---- 11. Мастер writes the program: the card becomes a part ---- */
    ride(ST.master);
    lab('a:master'); status('master'); sayIn('master');
    var mas = C_('zp-c-master'), marm = q(mas, '.c-arm-r'), sparks = q(svg, '.zp-sparks');
    for (var h = 0; h < 3; h++) {
      var hat = t + 0.08 + h * 0.24;
      tl.to(marm, { rotation: -46, duration: 0.1, ease: 'power2.out' }, hat);
      tl.to(marm, { rotation: 0, duration: 0.1, ease: 'power3.in' }, hat + 0.1);
      squash(hat + 0.2);
      ft(sparks, { autoAlpha: 1, scale: 0.7 }, { autoAlpha: 0, scale: 1.25, duration: 0.2, ease: 'power2.out', transformOrigin: '50% 100%', immediateRender: false }, hat + 0.2);
    }
    morph(tkv.card, tkv.part, t + 0.82);
    t += 1.05; lab('d:master'); ledTo('master', MINT, t - 0.15);
    sayOut('master', t);

    /* ---- 12. Порядок scans ---- */
    ride(ST.poryadok);
    lab('a:poryadok'); status('poryadok'); sayIn('poryadok');
    var por = C_('zp-m-poryadok'), scan = q(svg, '.zp-scan');
    tl.set(scan, { autoAlpha: 1, x: 0 }, t + 0.05);
    tl.to(scan, { x: 88 * s, duration: 0.42, ease: 'power1.inOut' }, t + 0.05);
    tl.to(scan, { autoAlpha: 0, duration: 0.1 }, t + 0.47);
    tl.set(mainLamp(por), { attr: { fill: MINT } }, t + 0.5);
    t += 0.64; lab('d:poryadok'); ledTo('poryadok', MINT, t - 0.15);
    sayOut('poryadok', t);

    /* ---- 13. Ревизор rests ---- */
    ride(ST.revizor, 0.62);
    lab('a:revizor'); status('revizor'); sayIn('revizor');
    var rev = C_('zp-c-revizor');
    tl.to(rev, { autoAlpha: 0.5, duration: 0.3 }, t - 0.4);
    qa(svg, '.zp-z').forEach(function (z, k) {
      ft(z, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: -6, duration: 0.3, ease: 'power2.out', immediateRender: false }, t - 0.2 + k * 0.12);
    });
    t += 0.55; lab('d:revizor'); ledTo('revizor', STEEL, t - 0.15);
    sayOut('revizor', t);

    /* ---- 14. Испытатель pins tests, Стенд runs them: error → back to Мастер → fixed ---- */
    ride(ST.ispytatel);
    lab('a:ispytatel'); status('ispytatel'); sayIn('ispytatel');
    var tester = C_('zp-c-tester');
    armWiggle(q(tester, '.c-arm-r'), t, -20, 2);
    tags.forEach(function (tg, k) {
      ft(tg, { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: 0.26, ease: 'back.out(3)', transformOrigin: '50% 100%', immediateRender: false }, t + 0.12 + k * 0.1);
    });
    t += 0.55; lab('d:ispytatel');
    sayOut('ispytatel', t);
    ride(ST.stend, 0.3);
    lab('a:stend');
    var stend = C_('zp-m-stend'), siren = q(stend, '.c-siren'), sirenP = siren ? siren.querySelector('path') : null;
    tl.to(qa(stend, '.c-needle'), { rotation: '+=300', duration: 0.5, ease: 'power2.inOut' }, t);
    tl.set(sirenP, { attr: { fill: RASP } }, t + 0.35);
    tl.set(mainLamp(stend), { attr: { fill: RASP } }, t + 0.35);
    ft(q(svg, '.zp-moon'), { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)', transformOrigin: '50% 50%', immediateRender: false }, t + 0.35);
    tl.to(siren, { keyframes: { rotation: [0, -16, 14, -10, 8, 0] }, duration: 0.5, ease: 'none' }, t + 0.35);
    ledTo('tests', RASP, t + 0.35);
    tl.to(world, { keyframes: { x: [0, -6, 5, -3, 0] }, duration: 0.3, ease: 'none' }, t + 0.35);
    status('defect', t + 0.35); sayIn('stend', t + 0.35);
    lab('defect', t + 0.75);
    var ret = q(svg, '.zp-return'), m2 = t + 0.62;
    tl.to(ret, { autoAlpha: 1, duration: 0.2 }, m2);
    tl.to(ret, { strokeDashoffset: -64 * s, duration: 1.9, ease: 'none' }, m2);
    sayOut('stend', m2 + 0.2);
    tl.to(token, { motionPath: { path: P0.retD, start: 0, end: 1 }, duration: 0.5, ease: 'power2.inOut' }, m2 + 0.12);
    cur = ST.stend; lampTo(ST.master, m2 + 0.12, 0.5);
    var fixAt = m2 + 0.64;
    sayIn('master2', fixAt);
    for (h = 0; h < 2; h++) {
      tl.to(marm, { rotation: -46, duration: 0.1, ease: 'power2.out' }, fixAt + h * 0.22);
      tl.to(marm, { rotation: 0, duration: 0.1, ease: 'power3.in' }, fixAt + h * 0.22 + 0.1);
      squash(fixAt + h * 0.22 + 0.2);
    }
    ft(tkv.fixed, { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(3)', transformOrigin: '50% 50%', immediateRender: false }, fixAt + 0.45);
    sayOut('master2', fixAt + 0.6);
    tl.to(token, { motionPath: { path: P0.retD, start: 1, end: 0 }, duration: 0.46, ease: 'power2.inOut' }, fixAt + 0.58);
    cur = ST.master; lampTo(ST.stend, fixAt + 0.58, 0.46); cur = ST.stend;
    tl.to(ret, { autoAlpha: 0, duration: 0.25 }, fixAt + 1.0);
    t = fixAt + 1.05;
    tl.set(sirenP, { attr: { fill: STEEL_D } }, t);
    tl.set(mainLamp(stend), { attr: { fill: MINT } }, t);
    tl.to(q(svg, '.zp-moon'), { autoAlpha: 0, scale: 0.5, duration: 0.2 }, t);
    ledTo('tests', MINT, t);
    status('fixed', t); sayIn('stend2', t);
    hop(stend, t, 8);
    t += 0.66; lab('fixed');
    sayOut('stend2', t);

    /* ---- 15. Приёмщик plugs it in and writes the memo ---- */
    ride(ST.priyomshchik);
    lab('a:priyomshchik'); status('priyomshchik'); sayIn('priyomshchik');
    var ver = C_('zp-c-verifier');
    tl.to(q(ver, '.c-arm-l'), { rotation: 34, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, t);
    ft(q(svg, '.zp-memo'), { autoAlpha: 0, y: 24 * s, scale: 0.6 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.36, ease: 'back.out(2.2)', transformOrigin: '50% 100%', immediateRender: false }, t + 0.3);
    t += 0.8; lab('d:priyomshchik'); ledTo('priyomshchik', MINT, t - 0.15);
    sayOut('priyomshchik', t);
    tl.to(q(svg, '.zp-memo'), { autoAlpha: 0, duration: 0.25 }, t);

    /* ---- 16. gate 2 waits for YOUR stamp ---- */
    ride(ST.gate2);
    lab('a:gate2'); status('wait');
    tl.set(beam.children, { attr: { fill: LEMON } }, t);   /* lemon light: now it is your turn */
    ledTo('gate2', LEMON, t);
    sayIn('gate2', t + 0.05);
    tl.to(q(svg, '.zp-g2-lamp'), { scale: 1.3, duration: 0.14, yoyo: true, repeat: 1, transformOrigin: '50% 50%' }, t);
    t += 0.35;
    lab('wait');
    tl.addPause(t, hooks.waiting);

    /* ---- after the stamp ---- */
    var P1 = t + 0.02;
    lab('stamp', P1);
    var hand = q(svg, '.zp-hand'), rod = q(svg, '.zp-g2-rod'), slamY = 44 * s;
    sayOut('gate2', P1);
    tl.to(hand, { y: slamY, duration: 0.18, ease: 'power4.in' }, P1);
    tl.to(rod, { scaleY: 1 + slamY / Math.max(1, rod.getBBox ? rod.getBBox().height : 100), duration: 0.18, ease: 'power4.in', transformOrigin: '50% 0%' }, P1);
    squash(P1 + 0.18);
    var splash = q(svg, '.zp-splash'), splashL = qa(svg, '.zp-splash-l');
    tl.set(splash, { autoAlpha: 1 }, P1 + 0.18);
    ft(splashL, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.16, ease: 'power2.out', immediateRender: false }, P1 + 0.18);
    tl.to(splashL, { drawSVG: '100% 100%', duration: 0.2, ease: 'power2.in' }, P1 + 0.36);
    tl.set(splash, { autoAlpha: 0 }, P1 + 0.58);
    tl.to(stage, { keyframes: { x: [0, -6, 5, -3, 0] }, duration: 0.3, ease: 'none' }, P1 + 0.18);
    tl.set(q(svg, '.zp-g2-lamp circle'), { attr: { fill: MINT } }, P1 + 0.18);
    ledTo('gate2', MINT, P1 + 0.18);
    var seal = q(svg, '.zp-seal'), sealIn = q(seal, '.c-seal');
    tl.set(seal, { autoAlpha: 1 }, P1 + 0.02);
    ft(sealIn, { scale: 2, autoAlpha: 0 }, { scale: 0.92, autoAlpha: 1, duration: 0.18, ease: 'power4.in', immediateRender: false, transformOrigin: '50% 50%' }, P1 + 0.02);
    tl.to(sealIn, { scale: 1, duration: 0.4, ease: 'elastic.out(1,.4)' }, P1 + 0.2);
    tl.call(hooks.confetti, [seal], P1 + 0.2);
    status('stamped', P1 + 0.2);
    tl.to(hand, { y: 0, duration: 0.35, ease: 'power2.inOut' }, P1 + 0.5);
    tl.to(rod, { scaleY: 1, duration: 0.35, ease: 'power2.inOut' }, P1 + 0.5);

    var R0 = P1 + 0.95;
    lab('reveal0', R0);
    tl.to(spot, { autoAlpha: 0, duration: 0.3 }, R0);
    tl.to(sealIn, { scale: 0.5, autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, R0);
    ft(q(svg, '.zp-scrim'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, immediateRender: false }, R0);
    ft(q(svg, '.zp-burst'), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, immediateRender: false }, R0 + 0.15);
    ft(q(svg, '.zp-burst-in'), { rotation: -40, scale: 0.6 }, { rotation: 0, scale: 1, duration: 1.1, ease: 'power3.out', transformOrigin: '50% 50%', immediateRender: false }, R0 + 0.15);
    var phone = q(svg, '.zp-phone'), phIn = q(phone, '.c-phone'), notif = q(phone, '.ph-notif');
    tl.set(notif, { autoAlpha: 0 }, R0);
    tl.set(phone, { autoAlpha: 1 }, R0 + 0.2);
    ft(phIn, { scale: 0.2, rotation: -12, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.55, ease: 'back.out(1.8)', transformOrigin: '50% 50%', immediateRender: false }, R0 + 0.2);
    var bloom = q(svg, '.zp-bloom');
    tl.set(bloom, { autoAlpha: 1 }, R0 + 0.35);
    ft(q(bloom, '.c-plant'), { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(2)', immediateRender: false }, R0 + 0.35);
    ft(qa(bloom, '.c-flower'), { scale: 0 }, { scale: 1, duration: 0.4, stagger: 0.08, ease: 'back.out(3)', immediateRender: false }, R0 + 0.6);
    var cap = q(svg, '.zp-cap');
    tl.to(tkv.part, { scale: 0, autoAlpha: 0, duration: 0.15, transformOrigin: '50% 100%' }, R0 - 0.1);
    tl.to([tkv.fixed].concat(tags), { autoAlpha: 0, duration: 0.1 }, R0 - 0.1);
    fly(cap, [ST.gate2.x, ST.gate2.y - 30 * s], D.pos.reveal, R0 + 0.05, 0.75, (D.mode === 'tall' ? 260 : 320) * s, 360);
    tl.to(cap, { scale: 0.3, autoAlpha: 0, duration: 0.16, ease: 'power2.in' }, R0 + 0.72);
    var N0 = R0 + 0.85;
    lab('phone', N0 + 0.3);
    tl.to(phIn, { keyframes: { rotation: [0, -4, 4, -3, 3, 0] }, duration: 0.45, ease: 'none' }, N0);
    ft(notif, { autoAlpha: 0, scale: 0.5, y: -18 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.4, ease: 'back.out(2.2)', transformOrigin: '50% 50%', immediateRender: false }, N0 + 0.05);
    tl.call(hooks.confetti, [phone, 0.7], N0 + 0.1);

    var B0 = N0 + 0.75;
    lab('lesson', B0 + 0.95);
    var lib = C_('zp-c-librarian'), lesson = q(svg, '.zp-lesson');
    status('lesson', B0); sayIn('bibliotekar', B0);
    fly(lesson, [D.pos.reveal[0] + 40 * s, D.pos.reveal[1] - 20 * s], D.pos.drawer, B0 + 0.1, 0.6, 120 * s, 0);
    tl.to(lesson, { scale: 0.3, autoAlpha: 0, duration: 0.14 }, B0 + 0.68);
    hop(lib, B0 + 0.7, 12);
    var Z0 = B0 + 1.1;
    status('done', Z0);
    tl.call(hooks.done, [], Z0 + 0.3);
    lab('end', Z0 + 0.35);
    tl.to({}, { duration: 0.01 }, Z0 + 0.35);

    return { tl: tl, labels: labels };
  }

  /* ================================================================== controller ============================== */
  var current = null;
  MP.sim = {
    pause: function () { if (current) current.pause(true); },
    seek: function (at) { if (current) current.seek(at); },
    state: function () { return current ? current.state() : 'none'; },
    debug: function () { return current ? current.debug() : null; }
  };

  function onRevert(api, fn) {
    /* api.on() removes its listeners when the scene is reverted; a stub target turns that into a cleanup hook */
    api.on({ addEventListener: function () {}, removeEventListener: function () { fn(); } }, 'mp-revert', fn);
  }

  function start(section, api) {
    var gsap = window.gsap, calm = api.calm || !gsap;
    var stage = api.stage;
    var btnPlay = section.querySelector('[data-action="sim-play"]');
    var btnReset = section.querySelector('[data-action="sim-reset"]');
    var btnStamp = section.querySelector('[data-action="sim-stamp"]');
    var statusEl = section.querySelector('.sim-status');
    var D = null, T = null, blinkAnim = null, waitLoop = null, idleLoop = null;
    var state = 'idle', timer = 0, stepIdx = -1;
    /* the «waiting for your stamp» pulse runs only while the section is on screen (seen: api.loop's watcher, which
     * prosto.suspend/resume also drive when the «Схема» tab is shown), the stage has not scrolled away (stageOn:
     * ScrollTrigger) and the browser tab is visible — see syncWait() */
    var seen = false, stageOn = true;

    if (statusEl) statusEl.setAttribute('aria-live', 'off');   /* ~8 key moments go through MP.live instead */

    function setStatus(i) {
      var st = STEPS[i];
      if (!st || !statusEl) return;
      statusEl.textContent = st[1];
      if (MP.nbsp) MP.nbsp(statusEl);
      if (st[2]) {
        var extra = st[0] === 'wait' ? '. Нажмите кнопку «Поставить печать».' : '';
        MP.live(st[1] + extra);
      }
    }
    /* the thin mint bar under the status line: how far the order has travelled (transform only, see scenes-d.css) */
    function setProg(p) {
      if (statusEl) statusEl.style.setProperty('--zp-p', String(Math.round(Math.max(0, Math.min(1, p)) * 1000) / 1000));
    }
    function syncProg() { if (T) setProg(T.tl.progress()); }
    function setPlay(label, icon, disabled) {
      if (!btnPlay) return;
      var span = btnPlay.querySelector('span'), use = btnPlay.querySelector('use');
      if (span) span.textContent = label;
      if (use) use.setAttribute('href', '#i-' + icon);
      if (disabled) btnPlay.setAttribute('aria-disabled', 'true'); else btnPlay.removeAttribute('aria-disabled');
      btnPlay.classList.toggle('is-waiting', !!disabled);
    }
    function showGo(on, label) {
      var go = stage.querySelector('.zp-go');
      if (!go) return;
      go.hidden = !on;
      var l = go.querySelector('.zp-go-label'); if (l && label) l.textContent = label;
    }
    function showHot(on) { var h = stage.querySelector('.zp-hot'); if (h) h.hidden = !on; }
    function setState(s) {
      state = s;
      section.setAttribute('data-sim', s);
      if (s === 'idle') { setPlay('Запустить конвейер', 'play'); showGo(true, 'Запустить'); }
      else if (s === 'running') { setPlay('Пауза', 'pause'); showGo(false); }
      else if (s === 'paused') { setPlay('Продолжить', 'play'); showGo(true, 'Продолжить'); }
      else if (s === 'waiting') { setPlay('Ждём печать', 'stamp', true); showGo(false); }
      else if (s === 'done') { setPlay('Ещё раз', 'replay'); showGo(false); }
      if (btnStamp) btnStamp.hidden = s !== 'waiting';
      if (btnPlay) btnPlay.hidden = s === 'waiting';
      /* after the run «Ещё раз» already restarts it: a second replay button («Сначала») would only confuse */
      if (btnReset) {
        if (s === 'done' && document.activeElement === btnReset && btnPlay) { try { btnPlay.focus({ preventScroll: true }); } catch (e) {} }
        btnReset.hidden = s === 'done';
      }
      showHot(s === 'waiting');
      var ring = stage.querySelector('.zp-g2-ring');
      if (ring) { ring.setAttribute('opacity', s === 'waiting' ? '1' : '0'); ring.setAttribute('visibility', s === 'waiting' ? 'visible' : 'hidden'); }
      if (waitLoop && s !== 'waiting') waitLoop.pause(0);
      syncWait();
    }
    function syncWait() {
      if (!waitLoop) return;
      if (state === 'waiting' && seen && stageOn && !document.hidden) waitLoop.play(); else waitLoop.pause();
    }

    /* ---- (re)render the stage for the current layout ---- */
    function build() {
      teardownAnims();
      D = render(stage, modeNow());
      fitBubbles(stage);
      T = null;
      if (gsap) {
        T = buildTimeline(stage, D, {
          status: function (i) { setStatus(i); },
          waiting: function () { onWaiting(); },
          confetti: function (el, power) {
            if (calm || !MP.confetti || !el) return;
            var r = el.getBoundingClientRect();
            if (r.bottom < 0 || r.top > window.innerHeight) return;
            MP.confetti({ x: r.left + r.width / 2, y: r.top + r.height * 0.45, count: power ? 70 : 130, power: power || 1.1,
              colors: [LEMON, MINT, SKY, RASP, VIOLET, CREAM, TANG] });
          },
          done: function () { if (!calm) setState('done'); }
        });
        /* half the original pace (1.18 → 0.59) so the eye can follow every station: ≈39 s up to the stamp,
         * matching the promised «40 секунд» in the lead */
        T.tl.timeScale(0.59);
        T.tl.eventCallback('onUpdate', syncProg);
        if (!calm) {
          blinkAnim = MP.blink ? MP.blink(stage.querySelector('svg'), api) : null;
          var hand = stage.querySelector('.zp-hand'), lamp = stage.querySelector('.zp-g2-lamp');
          waitLoop = gsap.timeline({ paused: true, repeat: -1 });
          waitLoop.to(hand, { y: -8 * D.s, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0)
            .to(lamp, { scale: 1.22, duration: 0.25, yoyo: true, repeat: 3, ease: 'sine.inOut', transformOrigin: '50% 50%' }, 0)
            .fromTo(stage.querySelector('.zp-g2-ring-in'), { scale: 0.85, opacity: 1, transformOrigin: '50% 50%' }, { scale: 1.2, opacity: 0.25, duration: 1, ease: 'power1.out', transformOrigin: '50% 50%' }, 0);
          var disc = stage.querySelector('.zp-go-disc');
          idleLoop = api.loop(gsap.timeline({ repeat: -1, repeatDelay: 1.2 }).to(disc, { scale: 1.08, duration: 0.35, yoyo: true, repeat: 1, ease: 'sine.inOut' }));
        }
      }
      stepIdx = -1;
      setState('idle');
      if (statusEl) statusEl.textContent = IDLE_TEXT;
      setProg(0);
    }
    function teardownAnims() {
      clearTimeout(timer); timer = 0;
      if (T && T.tl) T.tl.kill();
      if (waitLoop) { waitLoop.kill(); waitLoop = null; }
      if (blinkAnim) { blinkAnim.kill(); blinkAnim = null; }
      if (idleLoop) { idleLoop.kill(); idleLoop = null; }
      if (gsap && stage) gsap.set(stage, { clearProps: 'transform' });
    }

    /* ---- animated mode ---- */
    function onWaiting() {
      setState('waiting');
      if (btnStamp) {
        try { btnStamp.focus({ preventScroll: true }); } catch (e) { btnStamp.focus(); }
      }
    }
    function play() {
      if (calm) { calmPlay(); return; }
      if (!T) return;
      if (state === 'waiting') { nudgeStamp(); return; }
      if (state === 'running') { pause(); return; }
      if (state === 'idle' || state === 'done' || T.tl.progress() >= 1) { T.tl.play(0); }
      else T.tl.play();
      setState('running');
    }
    function pause(auto) {
      /* suspend (MP.sim.pause), a hidden tab or a scrolled-away stage also stop the stamp pulse; syncWait() restarts it */
      if (waitLoop) waitLoop.pause();
      if (calm) { if (state === 'running') { clearTimeout(timer); setState('paused'); } return; }
      if (state === 'waiting' || !T) return;
      if (state !== 'running') return;
      T.tl.pause();
      setState('paused');
      if (auto && statusEl) MP.live('Конвейер на паузе.');
    }
    function reset() {
      clearTimeout(timer);
      if (T) T.tl.pause(0);
      stepIdx = -1;
      setState('idle');
      if (statusEl) statusEl.textContent = IDLE_TEXT;
      if (gsap && stage) gsap.set(stage, { x: 0 });
      setProg(0);
    }
    function stamp() {
      if (state !== 'waiting') return;
      if (calm) { calmStamp(); return; }
      setState('running');
      if (btnPlay) { try { btnPlay.focus({ preventScroll: true }); } catch (e) {} }
      T.tl.play();
    }
    function nudgeStamp() {
      if (!btnStamp) return;
      MP.live('Нужна ваша печать: кнопка «Поставить печать».');
      if (!calm && gsap) gsap.fromTo(btnStamp, { x: 0 }, { keyframes: { x: [0, -8, 7, -4, 0] }, duration: 0.35, ease: 'none', clearProps: 'x' });
      try { btnStamp.focus({ preventScroll: true }); } catch (e) {}
    }

    /* ---- calm mode: a stepper that seeks the same timeline (no travel) ---- */
    function calmApply(i) {
      stepIdx = i;
      var label = CALM_AT[STEPS[i][0]];
      if (T && T.labels[label] != null) T.tl.seek(T.labels[label], true);
      if (T) syncProg(); else setProg((i + 1) / STEPS.length);
      setStatus(i);
    }
    function calmNext() {
      var i = stepIdx + 1;
      if (i >= STEPS.length) { setState('done'); return; }
      calmApply(i);
      if (STEPS[i][0] === 'wait') { onWaiting(); return; }
      if (STEPS[i][0] === 'done') { setState('done'); return; }
      timer = setTimeout(calmNext, 2200);
    }
    function calmPlay() {
      if (state === 'waiting') { nudgeStamp(); return; }
      if (state === 'running') { pause(); return; }
      if (state === 'idle' || state === 'done') { reset(); }
      setState('running');
      calmNext();
    }
    function calmStamp() {
      setState('running');
      if (btnPlay) { try { btnPlay.focus({ preventScroll: true }); } catch (e) {} }
      timer = setTimeout(calmNext, 150);
    }

    /* ---- wiring ---- */
    build();
    var me = current = {
      pause: function (auto) { pause(auto); },
      seek: function (at) {
        if (!T) return;
        var tt = typeof at === 'string' ? T.labels[at] : at;
        if (tt == null) return;
        T.tl.pause(); T.tl.seek(tt, true); state = 'paused'; syncProg();
      },
      state: function () { return state; },
      debug: function () { return T ? { dur: T.tl.duration(), time: T.tl.time(), labels: T.labels, kids: T.tl.getChildren().length } : null; }
    };
    api.on(btnPlay, 'click', function () { if (btnPlay.getAttribute('aria-disabled') === 'true') { nudgeStamp(); return; } play(); });
    api.on(btnReset, 'click', reset);
    api.on(btnStamp, 'click', stamp);
    api.on(stage, 'click', function (e) {
      var tgt = e.target;
      if (tgt.closest && tgt.closest('.zp-hot')) { stamp(); return; }
      if (tgt.closest && tgt.closest('.zp-go')) { play(); }
    });
    api.on(document, 'visibilitychange', function () { if (document.hidden) pause(true); else syncWait(); });
    /* a stand-in «loop» so the stamp pulse follows the section's visibility and prosto.suspend/resume like any idle loop */
    api.loop({
      play: function () { seen = true; syncWait(); },
      pause: function () { seen = false; syncWait(); },
      kill: function () { seen = false; if (waitLoop) waitLoop.pause(); }
    });
    if (window.matchMedia) {
      /* phone ↔ tablet: a different diorama (the ≥1024 switch re-inits the whole scene through prosto's matchMedia) */
      var mq = window.matchMedia('(max-width: 759px)');
      var onMq = function () { build(); };
      if (mq.addEventListener) api.on(mq, 'change', onMq);
    }
    var ro = null;
    if (window.ResizeObserver) {
      var lastW = 0;
      ro = new ResizeObserver(function () {
        var w = stage.clientWidth;
        if (w && Math.abs(w - lastW) > 1) { lastW = w; fitBubbles(stage); }
      });
      ro.observe(stage);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (current === me) fitBubbles(stage); });
    if (window.ScrollTrigger && gsap) {
      window.ScrollTrigger.create({
        trigger: stage, start: 'top 88%', end: 'bottom 12%',
        /* leaving the viewport pauses a running conveyor; the «waiting for your stamp» pulse only runs while seen */
        onLeave: function () { stageOn = false; pause(true); },
        onLeaveBack: function () { stageOn = false; pause(true); },
        onEnter: function () { stageOn = true; syncWait(); },
        onEnterBack: function () { stageOn = true; syncWait(); }
      });
    }
    onRevert(api, function () {
      if (ro) ro.disconnect();
      teardownAnims();
      if (T && T.tl) T.tl.kill();
      if (current === me) current = null;
      if (statusEl) { statusEl.setAttribute('aria-live', 'polite'); statusEl.style.removeProperty('--zp-p'); }
      if (btnStamp) btnStamp.hidden = true;
      if (btnPlay) btnPlay.hidden = false;
      if (btnReset) btnReset.hidden = false;
    });
  }

  MP.scene('zapusk', {
    build: function (section, api) { render(api.stage, modeNow()); },
    init: function (section, api) { start(section, api); },
    final: function (section, api) { start(section, api); }
  });
})();
