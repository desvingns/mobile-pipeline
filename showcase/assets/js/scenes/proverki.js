/* scenes/proverki.js — «Проверки: брак едет назад» (package B, sticky 4 steps).
 * The inspection hall continues the assembly hall: the puzzle-piece «деталь» rides the main belt past Порядок, Ревизор
 * (a dashed «если риск» station), the test stand and the Приёмщик. Under the main belt runs a RASPBERRY return belt
 * «назад к мастеру»: when the stand fails, the camera follows the piece all the way back to the Мастер's nook and
 * forward again. [data-action=throw-defect] replays that loop (calm mode: instant state swap + live text).
 * Two compositions of the same hall (MP.pb.scene rebuilds when the phone query flips): BIG — 720-wide stations for the
 * desktop stage and its tablet crop; PHONE (<760px, and phones held sideways) — every station re-laid into a 480-wide
 * slot of the square phone window.
 * Uses MP.pb (chertyozh.js).
 */
(function () {
  'use strict';
  var MP = window.MP = window.MP || {};

  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', MINT = '#2BD99F', RASP = '#FF4F8B', SKY = '#3EC5FF',
    TANG = '#FF8A1F', STEEL = '#C9D3E6', STEEL_D = '#8E9BB8';
  var SIGNS = ['Порядок', 'Ревизор', 'Испытания', 'Приёмщик'];
  var PIECE_D = 'M-70 0V-32A16 16 0 1 0 -70 -64V-96H-15A18 18 0 1 1 15 -96H70V-63A18 18 0 1 1 70 -33V0Z';
  var STAR = 'l3 6.5 7 .8-5.2 4.8 1.4 7-6.2-3.5-6.2 3.5 1.4-7-5.2-4.8 7-.8z';

  /* Geometry, world units. Station k owns the slot [k*pitch, (k+1)*pitch), the Мастер's nook is slot -1; the camera
   * steps one slot per station (the far wall at half speed). BIG = the desktop hall (720×540 stage, tablet crop
   * 0 50 720 450). PHONE = the hall re-laid for MP.pb.PHONE_BOX (480×480, ~370px wide on a 393px phone): a smaller
   * cast, every label ≥ 22 units (≥ 12px even on the ~275px stage of an iPhone SE), the tags / bubbles / badges placed so
   * nothing overlaps. Arrays are [x, y, scale] for characters and [x, y, w, h] for plates. */
  var BIG = {
    pitch: 720, W: 720, H: 540, beltY: 372, retY: 444, belt: { x: -760, w: 3680, h: 36, legs: 36, rh: 40, rlegs: 12 },
    floorY: 490, stop: [400, 1080, 1800, 2480], fixX: -330, startX: -140,
    far: { y: 30, x0: -520, x1: 2400, i0: -2, i1: 8, wx: 60, step: 300, cx: 150, cy: 250, r: 58, arm: 56, hook: [20, 16, 20] },
    sign: { hx: 100, hy: 56, y: 54, w: 272, h: 58, r: 16, tx: -14, ty: 92, ts: 24, lx: 108, ly: 83, lr: 11 },
    master: [-650, 191, 1.5], once: [-232, 150, 196, 42], onceT: [-134, 178, 20],
    pory: [30, 191, 1.5], tiles: [520, 212, 64, 0], arch: [84, 280], scan: [206, 138],
    risk: [740, 138, 680, 250, 30], riskTag: [758, 120, 150, 40], riskT: 20,
    rev: [766, 197, 1.45], loop: [1206, 226, 50, 19], arkh: [1276, 230, 1.2], arkhIn: 260,
    caps: [1262, 150, 150, 46], capsT: [64, 31, 20], wax: [136, 8, 16],
    isp: [1452, 204, 1.4], stend: [1960, 184, 1.55],
    rays: 'M2032 218l-14-14M2078 218l14-14M2055 206V186M2020 244h-18M2090 244h18',
    pri: [2176, 197, 1.45], phone: [2720, 153, 0.95], listT: 18,
    cable: 'M2566 330C2604 332 2598 296 2626 296H2700', plug: [2694, 284],
    memo: [2652, 220, -6, 132, 112, 22], memoFrom: [60, 40],
    retLabel: { x0: -560, y: 442, w: 226, h: 28, ax: 14, tx: 124, ty: 463, ts: 19 },
    tag: { w: 104, hole: -40, tx: 7, ts: 19 }, pieceT: 20,
    tags: [{ t: 'ночью', x: -104, y: -128, r: -8 }, { t: 'без сети', x: 0, y: -170, r: 3 }, { t: 'в 9:00', x: 104, y: -128, r: 8 }],
    spark: [-60, 300, 24, 46],
    bub: [[-560, 196], [170, 200], [900, 214], [1540, 214], [2040, 226], [2040, 226], [2290, 190]],
    tests: { out3: 3.2, tag0: 1.7, defect: 2.9 }
  };
  var PHONE = {
    pitch: 480, W: 480, H: 480, beltY: 336, retY: 398, belt: { x: -520, w: 2480, h: 32, legs: 30, rh: 36, rlegs: 10 },
    floorY: 444, stop: [256, 696, 1184, 1630], fixX: -150, startX: -100,
    far: { y: 6, x0: -360, x1: 1320, i0: -2, i1: 7, wx: 40, step: 200, cx: 100, cy: 196, r: 42, arm: 40, hook: [-2, 14, 16] },
    sign: { hx: 84, hy: 18, y: 16, w: 232, h: 46, r: 15, tx: -12, ty: 47, ts: 23, lx: 94, ly: 39, lr: 9 },
    master: [-476, 179, 1.3], once: [-218, 92, 190, 42], onceT: [-123, 120, 22],
    pory: [4, 197, 1.15], tiles: [387, 150, 0, 62], arch: [80, 262], scan: [192, 120],
    risk: [488, 94, 464, 258, 26], riskTag: [500, 76, 152, 40], riskT: 22,
    rev: [494, 203, 1.1], loop: [884, 160, 48, 22], arkh: [836, 218, 1], arkhIn: 200,
    caps: [690, 150, 134, 44], capsT: [58, 30, 22], wax: [120, 8, 15],
    isp: [940, 215, 1], stend: [1280, 179, 1.3],
    rays: 'M1339 214l-12-12M1377 214l12-12M1358 206V194M1329 236h-15M1387 236h15',
    pri: [1440, 215, 1], phone: [1772, 76, 1.05], listT: 21,
    cable: 'M1714 296C1738 298 1730 268 1746 268', plug: [1746, 256],
    memo: [1690, 106, -5, 108, 74, 22], memoFrom: [100, 90],
    retLabel: { x0: -356, y: 400, w: 232, h: 32, ax: 16, tx: 130, ty: 423, ts: 22 },
    tag: { w: 126, hole: -51, tx: 8, ts: 22 }, pieceT: 22,
    tags: [{ t: 'ночью', x: -76, y: -122, r: -8 }, { t: 'без сети', x: 0, y: -166, r: 3 }, { t: 'в 9:00', x: 76, y: -122, r: 8 }],
    spark: [-60, 284, 20, 40],
    bub: [[-418, 204], [56, 178], [540, 190], [1014, 204], [1414, 202], [1414, 202], [1480, 208]],
    /* the tag cluster needs the air above the Испытатель: his question goes first, then the tags pop */
    tests: { out3: 2.6, tag0: 2.65, defect: 3.8 }
  };
  function geo(phone) { return phone ? PHONE : BIG; }

  function markup(phone) {
    var PB = MP.pb, R = PB.R, C = PB.C, P = PB.P, L = PB.L, place = PB.place, NS = PB.NS, T = PB.text;
    var g = geo(phone), by = g.beltY, s = '', w = '', i;
    function at(a, markup) { return place(markup, a[0], a[1], a[2]); }

    s += R(-10, g.floorY, g.W + 20, 60, 0, INK, NS + ' fill-opacity=".07"') + L('M0 ' + g.floorY + 'H' + g.W, INK, 3, ' stroke-opacity=".18"');
    var fw = g.far, far = L('M' + fw.x0 + ' ' + fw.y + 'H' + fw.x1, STEEL_D, 12, ' stroke-linecap="butt"') +
      L('M' + fw.x0 + ' ' + fw.y + 'H' + fw.x1, STEEL, 6, ' stroke-linecap="butt"');
    for (i = fw.i0; i < fw.i1; i++) {
      var wx = fw.wx + i * fw.step, wc = wx + fw.cx;
      far += R(wx - 4, fw.hook[0], fw.hook[1], fw.hook[2], 3, STEEL_D, ' stroke-width="3"') +
        C(wc, fw.cy, fw.r, SKY, ' fill-opacity=".24" stroke-opacity=".3" stroke-width="4"') +
        L('M' + wc + ' ' + (fw.cy - fw.arm) + 'V' + (fw.cy + fw.arm) + 'M' + (wc - fw.arm) + ' ' + fw.cy + 'H' + (wc + fw.arm), INK, 3, ' stroke-opacity=".15"');
    }
    s += '<g class="pv-far">' + far + '</g>';

    /* hanging signs (the Мастер's nook gets one too) */
    var sg = g.sign;
    ['Мастер'].concat(SIGNS).forEach(function (name, k) {
      var cx = (k - 0.5) * g.pitch;
      w += '<g class="pv-sign">' + L('M' + (cx - sg.hx) + ' 0V' + sg.hy + 'M' + (cx + sg.hx) + ' 0V' + sg.hy, INK, 3) +
        R(cx - sg.w / 2, sg.y, sg.w, sg.h, sg.r, CREAM, ' stroke-width="4"') + T(cx + sg.tx, sg.ty, name, sg.ts, { d: true }) +
        C(cx + sg.lx, sg.ly, sg.lr, MINT, ' class="pv-slamp' + (k ? '' : ' pv-slamp-m') + '" stroke-width="3.5"') + '</g>';
    });

    /* Мастер's nook */
    w += '<g class="pv-master">' + at(g.master, MP.char('master', { expr: 'focus' })) + '</g>';
    w += '<g class="pv-once" opacity="0">' + R(g.once[0], g.once[1], g.once[2], g.once[3], 21, TANG, ' stroke-width="3.5"') +
      T(g.onceT[0], g.onceT[1], 'одна попытка', g.onceT[2], { w: 800 }) + '</g>';

    /* station 0: Порядок + scanner arch + shelf tiles (a row on the big stage, a rack on the phone) */
    w += '<g class="pv-pory">' + at(g.pory, MP.machine('poryadok')) + '</g>';
    var tiles = '';
    for (i = 0; i < 3; i++) {
      var tx = g.tiles[0] + i * g.tiles[2], ty = g.tiles[1] + i * g.tiles[3];
      tiles += '<g class="pv-tile">' + R(tx, ty, 54, 54, 12, CREAM, ' class="pv-tile-bg" stroke-width="3.5"') +
        L('M' + (tx + 10) + ' ' + (ty + 20) + 'H' + (tx + 44) + 'M' + (tx + 10) + ' ' + (ty + 40) + 'H' + (tx + 44), INK, 3) +
        R(tx + 14, ty + 8, 8, 11, 1.5, [SKY, TANG, RASP][i], ' stroke-width="2"') + R(tx + 28, ty + 28, 12, 11, 1.5, [MINT, SKY, VIOLET][i], ' stroke-width="2"') +
        '<g class="pv-tick">' + C(tx + 50, ty + 2, 13, MINT, ' stroke-width="3"') + L('M' + (tx + 44) + ' ' + (ty + 2) + 'l4.5 4.5 8-9', INK, 3.4, ' class="pv-tick-path"') + '</g></g>';
    }
    w += tiles;
    var s0 = g.stop[0], ar = g.arch[0], archD = 'M' + (s0 - ar) + ' ' + by + 'V' + g.arch[1] + 'A' + ar + ' ' + ar + ' 0 0 1 ' + (s0 + ar) + ' ' + g.arch[1] + 'V' + by;
    w += '<g class="pv-arch-back">' + L(archD, INK, 16) + L(archD, STEEL, 8) + '</g>';

    /* station 1: the optional «если риск» station */
    var rk = g.risk, rt = g.riskTag;
    w += R(rk[0], rk[1], rk[2], rk[3], rk[4], 'none', ' class="pv-risk" stroke-width="4" stroke-dasharray="14 12" stroke-opacity=".7"');
    w += '<g class="pv-risktag">' + R(rt[0], rt[1], rt[2], rt[3], 20, CREAM, ' stroke-width="3.5" stroke-dasharray="7 6"') +
      T(rt[0] + rt[2] / 2, rt[1] + 27, 'если риск', g.riskT, { w: 800 }) + '</g>';
    w += '<g class="pv-rev">' + at(g.rev, MP.char('revizor', { expr: 'focus' })) + '</g>';
    var lp = g.loop, lx = lp[0], ly = lp[1];
    w += '<g class="pv-loop">' + C(lx, ly, lp[2], CREAM, ' stroke-width="3.5"') +
      '<g class="pv-loop-arrow">' + L('M' + lx + ' ' + (ly - 40) + 'A40 40 0 1 1 ' + (lx - 38) + ' ' + (ly - 12), VIOLET, 7, ' stroke-linecap="round"') +
      P('M' + (lx - 48) + ' ' + (ly - 24) + 'L' + (lx - 40) + ' ' + (ly - 4) + 'L' + (lx - 26) + ' ' + (ly - 18) + 'Z', VIOLET, ' stroke-width="2.5"') + '</g>' +
      T(lx, ly + 8, 'круг 1', lp[3], { w: 800, cls: 'pv-k1' }) + T(lx, ly + 8, 'круг 2', lp[3], { w: 800, cls: 'pv-k2' }) + '</g>';
    w += '<g class="pv-arkh">' + at(g.arkh, MP.char('arkhitektor')) + '</g>';
    var cp = g.caps, wxx = cp[0] + g.wax[0], wy = cp[1] + g.wax[1];
    w += '<g class="pv-caps">' + R(cp[0], cp[1], cp[2], cp[3], cp[3] / 2, VIOLET, ' stroke-width="4"') +
      T(cp[0] + g.capsT[0], cp[1] + g.capsT[1], 'решение', g.capsT[2], { w: 800, fill: CREAM }) +
      '<g class="pv-wax">' + C(wxx, wy, g.wax[2], RASP, ' stroke-width="3.5"') + P('M' + wxx + ' ' + (wy - 10) + STAR, CREAM, ' stroke-width="1.6"') + '</g></g>';

    /* station 2: Испытатель + Стенд */
    w += '<g class="pv-isp">' + at(g.isp, MP.char('ispytatel')) + '</g>';
    w += '<g class="pv-stend">' + at(g.stend, MP.machine('stend')) + '</g>';
    w += '<g class="pv-rays" opacity="0">' + L(g.rays, RASP, 6, ' stroke-linecap="round"') + '</g>';

    /* station 3: Приёмщик + phone with the 6-check list + memo */
    w += '<g class="pv-pri">' + at(g.pri, MP.char('priyomshchik')) + '</g>';
    var list = '';
    for (i = 0; i < 6; i++) {
      var bx = 22 + (i % 2) * 52, bby = 70 + Math.floor(i / 2) * 52;
      list += '<g class="pv-chk">' + R(bx, bby, 44, 44, 11, '#261F5E', ' class="pv-chk-bg" stroke="' + CREAM + '" stroke-width="3"') +
        L('M' + (bx + 11) + ' ' + (bby + 23) + 'l8 8 15-17', INK, 5, ' class="pv-chk-path"') + '</g>';
    }
    list = PB.text(70, 52, '6 проверок', g.listT, { fill: CREAM, w: 800 }) + list;
    w += '<g class="pv-phone" transform="translate(' + g.phone[0] + ' ' + g.phone[1] + ') scale(' + g.phone[2] + ')">' + MP.phone('blank') + '<g class="pv-list">' + list + '</g>' +
      R(10, 12, 120, 236, 17, CREAM, ' class="pv-flashscr" opacity="0" stroke="none"') + '</g>';
    var pg = g.plug;
    w += '<path class="pv-cable" d="' + g.cable + '" fill="none" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/>' +
      '<g class="pv-plug">' + R(pg[0], pg[1], 26, 24, 6, STEEL, ' stroke-width="3.5"') +
      L('M' + (pg[0] + 26) + ' ' + (pg[1] + 6) + 'h8M' + (pg[0] + 26) + ' ' + (pg[1] + 18) + 'h8', INK, 3.5) + '</g>';

    /* the two belts: main (steel) and the return belt underneath (raspberry, moving left) */
    var bt = g.belt, rl = g.retLabel;
    w += MP.belt({ x: bt.x, y: by, w: bt.w, h: bt.h, pitch: 28, legs: bt.legs, cls: 'pv-main' });
    w += MP.belt({ x: bt.x, y: g.retY, w: bt.w, h: bt.rh, pitch: 28, dir: -1, color: RASP, legs: bt.rlegs, cls: 'pv-ret' });
    for (i = 0; i < 5; i++) {
      var rx = rl.x0 + i * g.pitch, ay = rl.y + rl.h / 2;
      w += '<g class="pv-retlabel">' + R(rx, rl.y, rl.w, rl.h, rl.h / 2, CREAM, ' stroke-width="3"') +
        P('M' + (rx + rl.ax) + ' ' + ay + 'l' + (phone ? '13-9v18' : '12-8v16') + 'z', RASP, ' stroke-width="2.4"') +
        T(rx + rl.tx, rl.ty, 'назад к мастеру', rl.ts, { w: 800 }) + '</g>';
    }
    /* scanner arch front leg + light bar (over the piece) */
    w += '<g class="pv-scan" opacity="0">' + R(s0 - 74, g.scan[0], 148, 16, 8, SKY, ' fill-opacity=".75" stroke-width="3"') +
      L('M' + (s0 - 64) + ' ' + (g.scan[0] + 8) + 'H' + (s0 + 64), '#FFFFFF', 4, ' stroke-opacity=".8"') + '</g>';

    /* the piece (final: plugged in at the Приёмщик) */
    var tg = g.tag;
    var piece = P(PIECE_D, VIOLET, ' stroke-width="4"') +
      '<g>' + P('M0 -88C-12 -88-19-79-19-68V-58L-25-50H25L19-58V-68C19-79 12-88 0-88Z', CREAM, ' stroke-width="3.5"') + C(0, -45, 5.5, CREAM, ' stroke-width="3"') + C(0, -91, 3.5, INK, NS) + '</g>' +
      T(0, -12, 'деталь', g.pieceT, { w: 800, fill: CREAM });
    g.tags.forEach(function (t) {
      piece += '<g class="pv-tag" opacity="0">' + L('M' + (t.x * 0.45) + ' -94L' + t.x + ' ' + (t.y + 12), INK, 2.5, ' class="pv-string"') +
        '<g transform="translate(' + t.x + ' ' + t.y + ') rotate(' + t.r + ')">' + R(-tg.w / 2, -17, tg.w, 34, 9, CREAM, ' stroke-width="3"') +
        C(tg.hole, 0, 4, INK, NS) + T(tg.tx, 7, t.t, tg.ts, { w: 800 }) + '</g></g>';
    });
    piece += '<g class="pv-note pv-note1" opacity="0"><g transform="translate(-60 -100) rotate(-10)">' + R(-19, -19, 38, 38, 5, TANG, ' stroke-width="3"') + T(0, 9, '1', 24, { d: true }) + '</g></g>' +
      '<g class="pv-note pv-note2" opacity="0"><g transform="translate(60 -100) rotate(9)">' + R(-19, -19, 38, 38, 5, TANG, ' stroke-width="3"') + T(0, 9, '2', 24, { d: true }) + '</g></g>' +
      '<g class="pv-patch"><g transform="translate(-40 -34) rotate(-24)">' + R(-24, -10, 48, 20, 10, MINT, ' stroke-width="3"') + R(-8, -10, 16, 20, 2, CREAM, NS + ' fill-opacity=".7"') + '</g></g>';
    w += '<g class="pv-piece" transform="translate(' + g.stop[3] + ' ' + by + ')">' + piece + '</g>';
    w += PB.splash(g.fixX + g.spark[0], g.spark[1], g.spark[2], g.spark[3], [-160, -120, -80, 180, 200], INK, 'pv-spark');

    /* bubbles on top */
    var b = g.bub;
    w += PB.bubble({ x: b[0][0], y: b[0][1], text: 'Сейчас починю!', cls: 'pv-b0', off: true });
    w += PB.bubble({ x: b[1][0], y: b[1][1], text: 'Бип. Всё по полочкам', cls: 'pv-b1', off: true });
    w += PB.bubble({ x: b[2][0], y: b[2][1], text: 'Замечание номер один', cls: 'pv-b2', off: true });
    w += PB.bubble({ x: b[3][0], y: b[3][1], text: 'А если ночью?', cls: 'pv-b3', off: true });
    w += PB.bubble({ x: b[4][0], y: b[4][1], text: 'Бип! Ошибка!', tail: 'dr', fill: RASP, cls: 'pv-b4', off: true });
    w += PB.bubble({ x: b[5][0], y: b[5][1], text: 'Бип. Испытания пройдены', tail: 'dr', fill: MINT, cls: 'pv-b5', off: true });
    w += PB.bubble({ x: b[6][0], y: b[6][1], text: 'Подключено. Вот памятка', cls: 'pv-b6' });
    /* the memo flies out of the phone */
    var m = g.memo, mw = m[3] / 2, mh = m[4] / 2;
    w += '<g transform="translate(' + m[0] + ' ' + m[1] + ') rotate(' + m[2] + ')"><g class="pv-memo">' + R(-mw, -mh, m[3], m[4], 10, CREAM, ' stroke-width="3.5"') +
      T(0, phone ? -10 : -24, 'Памятка', m[5], { w: 800 }) +
      L(phone ? 'M-38 12H38M-38 26H26' : 'M-46 2H46M-46 22H34M-46 42H40', INK, 4, ' stroke-opacity=".3" stroke-linecap="round"') + '</g></g>';

    s += '<g class="pv-world" transform="translate(' + (-3 * g.pitch) + ' 0)">' + w + '</g>';
    s += R(0, 0, g.W, g.H, 0, RASP, ' class="pv-flash" opacity="0" stroke="none"');
    return '<g' + PB.ROOT + '>' + s + '</g>';
  }

  function build(section, api, phone) {
    MP.pb.mount(api, markup(phone), 'pv-svg', phone);
    var far = api.stage.querySelector('.pv-far');
    if (far) far.setAttribute('transform', 'translate(' + (-1.5 * geo(phone).pitch) + ' 0)');
  }

  function master(section, api, phone) {
    var PB = MP.pb, gsap = window.gsap, svg = api.stage.querySelector('svg'), g = geo(phone);
    var $ = PB.q(svg), $$ = PB.qa(svg);
    var BELT_Y = g.beltY, RET_Y = g.retY, STOP = g.stop, FIX_X = g.fixX, PITCH = g.pitch, TS = g.tests;
    PB.frame(svg, api, '0 50 720 450', phone);
    var tl = gsap.timeline({ paused: true });
    var world = $('.pv-world'), far = $('.pv-far'), piece = $('.pv-piece'), flash = $('.pv-flash');
    var chevM = $('.pv-main .belt-chev'), chevR = $('.pv-ret .belt-chev'), pitch = 28;
    var rollM = $$('.pv-main .belt-roller'), rollR = $$('.pv-ret .belt-roller');
    var slamps = $$('.pv-slamp:not(.pv-slamp-m)');
    var wrapX = gsap.utils.unitize(gsap.utils.wrap(0, pitch)), wrapN = gsap.utils.unitize(gsap.utils.wrap(-pitch, 0));
    var bub = function (k) { return $('.pv-b' + k); };

    /* ----- start state ----- */
    gsap.set(world, { x: 0 });
    gsap.set(far, { x: 0 });
    gsap.set(piece, { x: g.startX, y: BELT_Y, transformOrigin: '50% 100%' });
    gsap.set(slamps, { fill: STEEL_D });
    $$('.pb-bub').forEach(function (b) {
      gsap.set(b, { autoAlpha: 0, scale: 0, svgOrigin: b.getAttribute('data-tx') + ' ' + b.getAttribute('data-ty') });
    });
    gsap.set($$('.pb-splash'), { autoAlpha: 0 });
    gsap.set(flash, { autoAlpha: 0 });

    var scan = $('.pv-scan'), tilesBg = $$('.pv-tile-bg'), ticks = $$('.pv-tick'), tickP = $$('.pv-tick-path');
    var poryLamps = $$('.pv-pory .c-lamp:not(.c-lamp--main) > circle:first-child');
    gsap.set(scan, { autoAlpha: 0, y: 0 });
    gsap.set(ticks, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(tickP, { drawSVG: '0%' });
    gsap.set(poryLamps, { fill: STEEL_D });

    var notes = $$('.pv-note'), loop = $('.pv-loop'), loopArrow = $('.pv-loop-arrow'), k1 = $('.pv-k1'), k2 = $('.pv-k2');
    var arkh = $('.pv-arkh .c-char'), caps = $('.pv-caps'), wax = $('.pv-wax');
    gsap.set(notes, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(loop, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(loopArrow, { svgOrigin: g.loop[0] + ' ' + g.loop[1] });
    gsap.set(k2, { autoAlpha: 0 });
    gsap.set(arkh, { x: g.arkhIn, autoAlpha: 0 });
    gsap.set(caps, { autoAlpha: 0, scale: 0, transformOrigin: '50% 100%' });
    gsap.set(wax, { autoAlpha: 0, transformOrigin: '50% 50%' });

    var tags = $$('.pv-tag'), strings = $$('.pv-string'), isp = $('.pv-isp .c-char');
    var needles = $$('.pv-stend .c-needle'), siren = $('.pv-stend .c-siren'), sirenFill = $('.pv-stend .c-siren path');
    var stLamp = $('.pv-stend .c-lamp--main circle'), rays = $('.pv-rays');
    gsap.set(tags, { autoAlpha: 0 });
    tags.forEach(function (t) { gsap.set(t.lastElementChild, { scale: 0, transformOrigin: '50% 0%' }); });
    gsap.set(strings, { drawSVG: '0%' });
    gsap.set(sirenFill, { fill: STEEL_D });
    gsap.set(stLamp, { fill: STEEL_D });
    gsap.set(rays, { autoAlpha: 0 });

    var mArm = $('.pv-master .c-arm-r'), once = $('.pv-once'), patch = $('.pv-patch'), spark = $('.pv-spark'), mSign = $('.pv-slamp-m');
    gsap.set(once, { autoAlpha: 0, scale: 0.4, transformOrigin: '50% 50%' });
    gsap.set(patch, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(mSign, { fill: STEEL_D });

    var cable = $('.pv-cable'), plug = $('.pv-plug'), chks = $$('.pv-chk-bg'), chkP = $$('.pv-chk-path'), flashScr = $('.pv-flashscr');
    var memo = $('.pv-memo'), pri = $('.pv-pri .c-char');
    gsap.set(cable, { drawSVG: '0%' });
    gsap.set(plug, { autoAlpha: 0, x: -30 });
    gsap.set(chks, { fill: '#261F5E' });
    gsap.set(chkP, { drawSVG: '0%' });
    gsap.set(flashScr, { autoAlpha: 0 });
    gsap.set(memo, { autoAlpha: 0, scale: 0.2, x: g.memoFrom[0], y: g.memoFrom[1], rotation: 20, transformOrigin: '50% 50%' });

    /* ----- helpers ----- */
    var at = { x: g.startX };
    function ride(pos, toX, cam, dur, back) {
      var dx = toX - at.x;
      at.x = toX;
      tl.to(piece, { x: toX, duration: dur, ease: 'power2.inOut' }, pos)
        .to(piece, { keyframes: { rotation: [0, dx > 0 ? -3 : 3, 2, -1, 0] }, duration: dur, ease: 'none' }, pos)
        .to(back ? chevR : chevM, { x: '+=' + dx, duration: dur, ease: 'power2.inOut', modifiers: { x: back ? wrapN : wrapX } }, pos)
        .to(back ? rollR : rollM, { rotation: '+=' + Math.round(dx * 1.2), duration: dur, ease: 'power2.inOut' }, pos);
      if (cam != null) {
        tl.to(world, { x: -cam * PITCH, duration: dur, ease: 'power2.inOut' }, pos)
          .to(far, { x: -cam * PITCH / 2, duration: dur, ease: 'power2.inOut' }, pos);
      }
    }
    function say(k, pos, out) {
      tl.to(bub(k), { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, pos);
      if (out != null) tl.to(bub(k), { autoAlpha: 0, scale: 0, duration: 0.2, ease: 'power2.in' }, out);
    }
    function lampOn(el, pos, col) { PB.lamp(tl, el, col || MINT, pos); }

    /* ----- order ----- */
    ride(0.1, STOP[0], null, 1.3);
    tl.set(scan, { autoAlpha: 1, y: 0 }, 1.45)
      .to(scan, { y: g.scan[1], duration: 0.55, ease: 'sine.inOut', yoyo: true, repeat: 3 }, 1.45);
    poryLamps.forEach(function (l, k) { PB.lamp(tl, l, MINT, 1.6 + k * 0.25); });
    ticks.forEach(function (t, k) {
      tl.to(t, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2.4)' }, 1.8 + k * 0.4)
        .to(tickP[k], { drawSVG: '100%', duration: 0.25, ease: 'power2.out' }, '<0.1')
        .set(tilesBg[k], { fill: MINT }, '<');
    });
    tl.to(scan, { autoAlpha: 0, duration: 0.2 }, 3.7);
    say(1, 3.2);
    lampOn(slamps[0], 3.6);
    tl.addLabel('order', 4.4);
    tl.to(bub(1), { autoAlpha: 0, scale: 0, duration: 0.2 }, 'order');

    /* ----- auditor ----- */
    ride('order', STOP[1], 1, 1.5);
    say(2, 'order+=1.4', 'order+=3.0');
    tl.to(notes[0], { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2.6)' }, 'order+=1.7')
      .to(loop, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 'order+=2.0')
      .to(loopArrow, { rotation: 360, duration: 0.8, ease: 'power2.inOut' }, 'order+=2.3')
      .to(notes[1], { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2.6)' }, 'order+=2.9')
      .to(k1, { autoAlpha: 0, duration: 0.12 }, 'order+=3.2')
      .to(k2, { autoAlpha: 1, duration: 0.12 }, '>')
      .to(loopArrow, { rotation: 720, duration: 0.8, ease: 'power2.inOut' }, 'order+=3.2')
      .set(arkh, { autoAlpha: 1 }, 'order+=3.9')
      .to(arkh, { x: 0, duration: 1.0, ease: 'power1.out' }, 'order+=3.9')
      .to(arkh, { keyframes: { y: [0, -10, 0, -10, 0, -8, 0] }, duration: 1.0, ease: 'none' }, 'order+=3.9')
      .to(caps, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2)' }, 'order+=5.0');
    PB.slam(tl, wax, 'order+=5.5');
    tl.to(notes, { autoAlpha: 0, scale: 0, duration: 0.3, ease: 'power2.in', stagger: 0.08 }, 'order+=5.9');
    if (!phone) tl.to(loop, { scale: 0.9, duration: 0.3, ease: 'power2.inOut' }, 'order+=5.9');   // the phone keeps «круг 2» full size
    lampOn(slamps[1], 'order+=6.0');
    tl.addLabel('auditor', 'order+=6.4');

    /* ----- tests (+ the defect loop) ----- */
    ride('auditor', STOP[2], 2, 1.5);
    say(3, 'auditor+=1.4', 'auditor+=' + TS.out3);
    tags.forEach(function (t, k) {
      var p = 'auditor+=' + (TS.tag0 + k * 0.3);
      tl.set(t, { autoAlpha: 1 }, p)
        .to(strings[k], { drawSVG: '100%', duration: 0.2 }, p)
        .to(t.lastElementChild, { scale: 1, duration: 0.4, ease: 'back.out(2.4)' }, 'auditor+=' + (TS.tag0 + 0.1 + k * 0.3));
    });
    tl.to(isp, { rotation: -8, duration: 0.15, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 'auditor+=1.7');
    tl.addLabel('defect', 'auditor+=' + TS.defect);
    tl.to(needles, { rotation: '+=540', duration: 1.0, ease: 'power2.inOut' }, 'defect')
      .set(sirenFill, { fill: RASP }, 'defect+=0.9')
      .to(siren, { keyframes: { rotation: [0, -16, 14, -12, 10, -6, 0] }, duration: 0.9, ease: 'none' }, 'defect+=0.9')
      .to(rays, { keyframes: { opacity: [0, 1, 0, 1, 0, 1] }, duration: 0.9, ease: 'none' }, 'defect+=0.9')
      .set(rays, { visibility: 'inherit' }, 'defect+=0.9')
      .to(flash, { keyframes: { opacity: [0, 0.22, 0, 0.22, 0, 0.18, 0] }, duration: 1.1, ease: 'none' }, 'defect+=0.9')
      .set(flash, { visibility: 'inherit' }, 'defect+=0.9');
    lampOn(stLamp, 'defect+=0.9', RASP);
    say(4, 'defect+=1.0', 'defect+=2.4');
    tl.addLabel('alarm', 'defect+=1.9');
    /* drop to the return belt and ride back to the Мастер (camera follows) */
    tl.to(piece, { motionPath: { path: [{ x: STOP[2] - 20, y: BELT_Y - 40 }, { x: STOP[2] - 40, y: RET_Y }], curviness: 1.4 }, duration: 0.5, ease: 'power2.in' }, 'defect+=2.3');
    at.x = STOP[2] - 40;
    ride('defect+=2.85', FIX_X, -1, 1.8, true);
    tl.to(piece, { motionPath: { path: [{ x: FIX_X, y: BELT_Y - 60 }, { x: FIX_X, y: BELT_Y }], curviness: 1 }, duration: 0.45, ease: 'power2.out' }, 'defect+=4.7');
    say(0, 'defect+=4.8', 'defect+=6.4');
    tl.to(once, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2.2)' }, 'defect+=5.0')
      .to(mArm, { rotation: -360, duration: 0.35, ease: 'none', repeat: 2 }, 'defect+=5.1');
    PB.burst(tl, spark, 'defect+=5.3');
    PB.burst(tl, spark, 'defect+=5.7');
    tl.to(patch, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2.6)' }, 'defect+=6.0');
    lampOn(mSign, 'defect+=6.1');
    tl.to(once, { autoAlpha: 0, scale: 0.4, duration: 0.25 }, 'defect+=6.4');
    ride('defect+=6.5', STOP[2], 2, 1.8);
    tl.to(needles, { rotation: '+=360', duration: 0.7, ease: 'power2.inOut' }, 'defect+=8.2')
      .set(sirenFill, { fill: STEEL_D }, 'defect+=8.2')
      .to(rays, { autoAlpha: 0, duration: 0.2 }, 'defect+=8.2');
    lampOn(stLamp, 'defect+=8.9');
    say(5, 'defect+=8.95');
    tl.to(tags, { autoAlpha: 0, duration: 0.3, stagger: 0.06 }, 'defect+=8.5');
    lampOn(slamps[2], 'defect+=9.3');
    tl.addLabel('tests', 'defect+=9.8');

    /* ----- verifier ----- */
    tl.to(bub(5), { autoAlpha: 0, scale: 0, duration: 0.2 }, 'tests');
    ride('tests', STOP[3], 3, 1.5);
    tl.to(pri, { scaleY: 0.92, duration: 0.14, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 'tests+=1.4')
      .to(cable, { drawSVG: '100%', duration: 0.45, ease: 'power2.inOut' }, 'tests+=1.5')
      .to(plug, { autoAlpha: 1, x: 0, duration: 0.3, ease: 'back.out(2)' }, 'tests+=1.85')
      .to(flashScr, { keyframes: { opacity: [0, 0.6, 0] }, duration: 0.35, ease: 'none' }, 'tests+=2.1')
      .set(flashScr, { visibility: 'inherit' }, 'tests+=2.1')
      .set(flashScr, { autoAlpha: 0 }, 'tests+=2.46');
    chks.forEach(function (c, k) {
      tl.set(c, { fill: MINT }, 'tests+=' + (2.3 + k * 0.22))
        .to(chkP[k], { drawSVG: '100%', duration: 0.2, ease: 'power2.out' }, '<');
    });
    say(6, 'tests+=3.4');
    tl.to(memo, { autoAlpha: 1, scale: 1, x: 0, y: 0, rotation: 0, duration: 0.6, ease: 'back.out(1.5)' }, 'tests+=3.7');
    lampOn(slamps[3], 'tests+=4.1');
    tl.addLabel('verifier', 'tests+=4.5');
    return tl;
  }

  /* once per init; the driver itself is rebuilt on every layout switch (section.__pb), so look it up per click */
  function wire(section, api) {
    var btn = section.querySelector('[data-action="throw-defect"]');
    if (!btn) return;
    var gsap = window.gsap;
    api.on(btn, 'click', function () {
      var drv = section.__pb;
      if (!drv || !MP.pb.alive(drv.tl)) return;
      if (api.calm) {
        drv.tl.pause(); drv.tl.seek('alarm', false);
        MP.live('Бип! Ошибка! Деталь едет по красной ленте назад к мастеру.');
        var tl = drv.tl;
        gsap.delayedCall(2.2, function () {
          if (!MP.pb.alive(tl)) return;
          var cur = drv.last();
          tl.seek(cur && cur !== 'tests' && tl.labels[cur] != null ? cur : 'tests', false);
          MP.live('Мастер починил. Бип. Испытания пройдены.');
        });
        return;
      }
      MP.live('Бип! Ошибка! Деталь едет по красной ленте назад к мастеру.');
      drv.range('defect', 'tests', { onComplete: function () {
        MP.live('Мастер починил. Бип. Испытания пройдены.');
        /* the reader may have scrolled on meanwhile: return to the step that is active now */
        var cur = drv.last();
        if (cur && cur !== 'tests') drv.go(cur);
      } });
    });
  }

  /* phones held sideways up to 1023px keep the square phone composition too (scenes-b.css squares the stage there) */
  MP.pb.scene('proverki', { build: build, master: master, first: 'order', wire: wire,
    phone: MP.pb.PHONE + ', (orientation: landscape) and (max-height: 520px) and (pointer: coarse) and (max-width: 1023px)' });
})();
