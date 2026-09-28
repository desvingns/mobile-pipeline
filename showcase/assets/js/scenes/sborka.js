/* scenes/sborka.js — «Сборка: одна карточка за раз» (package B, sticky 4 steps).
 * One long factory hall (world 2880 wide = 4 stations × 720) behind a 720×540 window: the camera pans one station per
 * step while the task card rides the belt (the belt surface moves with it). Stations: Весы → Стрелочник → Художник →
 * Мастер; the card is weighed, routed, recoloured and finally hammered into a puzzle-piece «деталь».
 * Phones (<760px, and phones held sideways up to 1023px) get their own layout of the same hall for the square 480×480
 * window (MP.pb.PHONE_BOX): stations 480–640 units apart, every label ≥ 22 units; MP.pb.scene rebuilds it when the
 * phone query flips (rotation, resize).
 * Uses MP.pb (defined in chertyozh.js) for bubbles, the step driver and the stamp/hop helpers.
 */
(function () {
  'use strict';
  var MP = window.MP = window.MP || {};

  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', MINT = '#2BD99F', RASP = '#FF4F8B', SKY = '#3EC5FF',
    TANG = '#FF8A1F', STEEL = '#C9D3E6', STEEL_D = '#8E9BB8';
  var BELT_Y = 430, STOP = [400, 980, 1860, 2520];   // card stop x per station (world units)
  var SIGNS = ['Весы', 'Стрелочник', 'Художник', 'Мастер'];
  var FORK = 1100, RAMP_A = 35;                         // the lane fork at station 1 (world x) and the ramp angle

  var CARD_D = 'M-74 -96H74Q86 -96 86 -84V-12Q86 0 74 0H-74Q-86 0 -86 -12V-84Q-86 -96 -74 -96Z';
  var PIECE_D = 'M-70 0V-32A16 16 0 1 0 -70 -64V-96H-15A18 18 0 1 1 15 -96H70V-63A18 18 0 1 1 70 -33V0Z';

  /* Geometry the master timeline needs, per layout. BY belt top · STOP card stop per station · PAN the Весы pan top ·
   * HOP where the weighed card lands · CAM camera (world x of the window's left edge) per station, CAM0 the extra pan
   * inside the scales step · SW the palette the swatches fly from. */
  var BIG = { BY: BELT_Y, STOP: STOP, PAN: 354, HOP: 600, CAM: [0, 720, 1440, 2160], CAM0: 0, FORK: FORK, RAMP: RAMP_A,
    SW: [1507, 396] };
  var PH = { BY: 394, STOP: [331, 816, 1440, 1960], PAN: 339, HOP: 490, CAM: [0, 640, 1140, 1640], CAM0: 100, FORK: 910,
    RAMP: 38, SW: [1175, 367] };

  /* the task card: plain → styled → puzzle piece (built as the piece at the Мастер); sz = text sizes */
  function cardMarkup(x, y, sz) {
    var PB = MP.pb, C = PB.C, P = PB.P, L = PB.L, NS = PB.NS, T = PB.text;
    var plain = P(CARD_D, CREAM, ' stroke-width="3.5"') + C(0, -96, 6.5, RASP, ' stroke-width="3"') +
      T(0, -46, 'Напоминание\nо поливе', sz.txt, { mid: true, w: 800, lh: 1.08 });
    var styled = P(CARD_D, CREAM, ' stroke-width="3.5"') +
      P('M-74 -96H74Q86 -96 86 -84V-66H-86V-84Q-86 -96 -74 -96Z', VIOLET, ' stroke-width="3.5"') +
      P('M-64 -90c-5 7-8 11-8 15a8 8 0 0 0 16 0c0-4-3-8-8-15z', SKY, ' stroke-width="2.6"') +
      T(62, -73, '9:00', sz.time, { anchor: 'end', fill: CREAM, w: 800 }) +
      T(0, -34, 'Напоминание\nо поливе', sz.txt, { mid: true, w: 800, lh: 1.08 }) + C(70, -12, 6, MINT, ' stroke-width="2.6"');
    var bell = '<g class="sb-bell">' + P('M0 -88C-12 -88-19-79-19-68V-58L-25-50H25L19-58V-68C19-79 12-88 0-88Z', CREAM, ' stroke-width="3.5"') +
      C(0, -45, 5.5, CREAM, ' stroke-width="3"') + C(0, -91, 3.5, INK, NS) + L('M-30 -76q-5 8 0 16M30 -76q5 8 0 16', INK, 3) + '</g>';
    return '<g class="sb-card" transform="translate(' + x + ' ' + y + ')">' +
      '<g class="sb-plain" opacity="0">' + plain + '</g>' + '<g class="sb-styled" opacity="0">' + styled + '</g>' +
      P(PIECE_D, VIOLET, ' class="sb-morph" stroke-width="4"') + bell + T(0, -12, 'деталь', sz.det, { w: 800, cls: 'sb-dlabel', fill: CREAM }) + '</g>';
  }

  function markup() {
    var PB = MP.pb, R = PB.R, C = PB.C, P = PB.P, L = PB.L, G = PB.G, place = PB.place, NS = PB.NS, T = PB.text;
    var s = '', i;

    /* static floor */
    s += R(-10, 474, 740, 80, 0, INK, NS + ' fill-opacity=".07"') + L('M0 474H720', INK, 3, ' stroke-opacity=".18"');

    /* far layer (parallax ×0.5): windows + a pipe */
    var far = L('M-40 26H1840', STEEL_D, 12, ' stroke-linecap="butt"') + L('M-40 26H1840', STEEL, 6, ' stroke-linecap="butt"');
    for (i = 0; i < 6; i++) {
      var wx = 150 + i * 330;
      far += R(wx - 4, 16, 16, 20, 3, STEEL_D, ' stroke-width="3"') +
        R(wx - 70, 150, 140, 150, 70, SKY, ' fill-opacity=".28" stroke-opacity=".35" stroke-width="4"') +
        L('M' + wx + ' 152V298M' + (wx - 68) + ' 226H' + (wx + 68), INK, 3, ' stroke-opacity=".18"');
    }
    s += '<g class="sb-far">' + far + '</g>';

    var w = '';
    /* hanging signs */
    SIGNS.forEach(function (name, k) {
      var cx = 360 + k * 720;
      w += '<g class="sb-sign">' + L('M' + (cx - 100) + ' 0V56M' + (cx + 100) + ' 0V56', INK, 3) +
        R(cx - 136, 54, 272, 58, 16, CREAM, ' stroke-width="4"') + T(cx - 14, 92, name, 24, { d: true }) +
        C(cx + 108, 83, 11, MINT, ' class="sb-slamp" stroke-width="3.5"') + '</g>';
    });

    /* station 0: Бригадир + «Готово» drawer + Весы + ghost card */
    var fc = '';
    for (i = 0; i < 3; i++) fc += '<g class="sb-fcard">' + R(198 + i * 10, 270 - i * 4, 62, 44, 6, CREAM, ' stroke-width="3"') +
      L('M' + (208 + i * 10) + ' ' + (286 - i * 4) + 'h30', SKY, 4) + '</g>';
    w += '<g class="sb-drawer">' + fc + R(186, 296, 112, 148, 12, MINT, ' stroke-width="4"') + R(198, 314, 88, 38, 9, CREAM, ' stroke-width="3"') +
      T(242, 340, 'Готово', 19, { w: 800 }) + C(242, 390, 6.5, CREAM, ' stroke-width="3"') + '</g>';
    w += '<g class="sb-brig">' + place(MP.char('brigadir'), 16, 269, 1.35) + '</g>';
    w += '<g class="sb-vesy">' + place(MP.machine('vesy'), 298, 218, 1.7) + '</g>';
    w += '<g class="sb-ghost">' + R(516, 132, 188, 168, 22, CREAM, ' stroke-width="3.5" stroke-dasharray="10 9"') +
      '<g class="sb-gh sb-gh-l">' + R(542, 156, 68, 116, 10, CREAM, ' stroke-width="3.5"') + T(576, 226, '1', 30, { d: true }) + '</g>' +
      '<g class="sb-gh sb-gh-r">' + R(610, 156, 68, 116, 10, CREAM, ' stroke-width="3.5"') + T(644, 226, '2', 30, { d: true }) + '</g>' +
      '<g class="sb-gh-whole" opacity="0">' + R(542, 156, 136, 116, 12, CREAM, ' stroke-width="3.5"') + T(610, 222, 'Большая', 22, { w: 800 }) + '</g>' +
      L('M610 144V284', RASP, 4, ' class="sb-gh-cut" stroke-dasharray="8 8" opacity="0"') +
      R(532, 114, 156, 36, 18, CREAM, ' stroke-width="3.5" stroke-dasharray="7 6"') + T(610, 139, 'если большая', 19, { w: 800 }) + '</g>';

    /* station 1: Стрелочник, a railway-like fork: the ramp climbs to Главный мастер's balcony, the main belt runs on
     * to the ordinary Мастер. A two-arm signpost at the fork names both lanes; the chosen arm lights mint. */
    w += '<g class="sb-strel">' + place(MP.machine('strelochnik'), 722, 262, 1.4) + '</g>';
    w += L('M1226 352V432', STEEL_D, 10, ' stroke-linecap="butt"') + L('M1226 352V432', INK, 3, ' stroke-opacity=".35"');
    w += '<g transform="translate(' + FORK + ' 430) rotate(' + (-RAMP_A) + ')">' + MP.belt({ w: 232, h: 26, pitch: 24, rollers: false, cls: 'sb-ramp' }) + '</g>';
    w += '<g class="sb-balcony">' + P('M1282 362V398L1320 362ZM1394 362V398L1356 362Z', STEEL_D, ' stroke-width="3.5"') +
      R(1262, 300, 174, 62, 12, STEEL, ' stroke-width="4"') + R(1273, 307, 152, 48, 10, CREAM, ' stroke-width="3"') +
      T(1349, 331, 'Главный\nмастер', 19, { mid: true, w: 800, lh: 1.02 }) + '</g>';
    w += '<g class="sb-chief">' + place(MP.char('master', { variant: 'chief' }), 1290, 169, 1) + '</g>';
    /* signpost: pole + two arrow boards (upper → the balcony, lower → straight on to the Мастер) */
    w += '<g class="sb-post">' + R(FORK - 2, 246, 12, 186, 4, STEEL, ' stroke-width="3.5"') + C(FORK + 4, 244, 9, STEEL_D, ' stroke-width="3.5"') +
      '<g transform="translate(' + (FORK + 6) + ' 278) rotate(-27)">' + laneBoard('sb-lane-hi', 'Главному', CREAM) + '</g>' +
      '<g transform="translate(' + (FORK + 6) + ' 324)">' + laneBoard('sb-lane-lo', 'Мастеру', MINT) + '</g></g>';

    /* station 2: Художник + paint */
    w += '<g class="sb-splats">' +
      '<g class="sb-splat">' + P('M1822 194c20-18 50-6 48 18 16 4 16 26-2 30-4 22-34 26-44 8-22 4-32-22-14-34-10-14 2-30 12-22z', VIOLET, ' stroke-width="3.5"') + C(1810, 262, 7, VIOLET, ' stroke-width="3"') + '</g>' +
      '<g class="sb-splat">' + P('M1972 170c18-10 40 4 36 22 14 8 8 30-8 28-6 18-30 18-36 2-18-2-20-24-4-30-4-14 4-24 12-22z', MINT, ' stroke-width="3.5"') + C(2024, 166, 6, MINT, ' stroke-width="3"') + '</g>' +
      '<g class="sb-splat">' + P('M1998 300c14-8 32 2 30 16 12 6 6 24-6 22-4 14-24 14-28 2-14-2-16-18-4-24-2-10 2-18 8-16z', SKY, ' stroke-width="3.5"') + '</g>' +
      '</g>';
    w += '<g class="sb-khud">' + place(MP.char('khudozhnik'), 1470, 237, 1.6) + '</g>';

    /* station 3: Мастер */
    w += '<g class="sb-master">' + place(MP.char('master'), 2250, 237, 1.6) + '</g>';

    /* the main belt (in front of everybody) + the switch plate */
    w += MP.belt({ x: -120, y: BELT_Y, w: 3120, h: 40, pitch: 28, legs: 34 });
    /* the switch blade (pivot at the fork): points up the ramp at the start, lies straight once the Стрелочник decides */
    w += '<g class="sb-switch">' + R(FORK - 6, 416, 104, 14, 7, TANG, ' stroke-width="3.5"') + L('M' + (FORK + 10) + ' 423H' + (FORK + 88), INK, 3, ' stroke-opacity=".3" stroke-dasharray="6 8"') +
      C(FORK, 423, 9, STEEL_D, ' stroke-width="3.2"') + C(FORK, 423, 3, INK, NS) + '</g>';

    /* swatches (fly from the palette) and sparks */
    w += '<g class="sb-sw">' + R(-23, -16, 46, 32, 9, VIOLET, ' stroke-width="3.5"') + '</g>' +
      '<g class="sb-sw">' + R(-23, -16, 46, 32, 9, MINT, ' stroke-width="3.5"') + '</g>' +
      '<g class="sb-sw">' + R(-26, -18, 52, 36, 9, CREAM, ' stroke-width="3.5"') + T(0, 8, 'Аа', 20, { d: true }) + '</g>';
    w += PB.splash(2452, 346, 26, 50, [-150, -110, -70, 170, 200], INK, 'sb-spark');

    w += cardMarkup(STOP[3], BELT_Y, { txt: 21, time: 19, det: 20 });

    /* speech bubbles last (always on top) */
    w += PB.bubble({ x: 110, y: 272, text: 'Такого ещё не было', cls: 'sb-b0', off: true });
    w += PB.bubble({ x: 356, y: 240, text: 'Бип. Вес в норме', tail: 'dr', cls: 'sb-b1', off: true });
    w += PB.bubble({ x: 818, y: 250, text: 'Бип. Трудное — Главному', size: 20, cls: 'sb-b2', off: true });
    w += PB.bubble({ x: 818, y: 250, text: 'Бип. Простое — Мастеру', size: 20, cls: 'sb-b3', off: true });
    w += PB.bubble({ x: 1600, y: 256, text: 'Будет красиво!', cls: 'sb-b4', off: true });
    w += PB.bubble({ x: 2330, y: 256, text: 'Готово, проверяйте!', cls: 'sb-b5' });

    s += '<g class="sb-world" transform="translate(-2160 0)">' + w + '</g>';
    return '<g' + PB.ROOT + '>' + s + '</g>';
  }

  /* a signpost arm: arrow board (rect `a` long + an 18-unit tip) with the lane name; defaults = the desktop board */
  function laneBoard(cls, txt, fill, a, size) {
    var PB = MP.pb, hh = size ? 20 : 18;
    a = a || 106;
    return '<g class="sb-lane ' + cls + '">' + PB.P('M0 -' + hh + 'H' + a + 'L' + (a + 18) + ' 0L' + a + ' ' + hh + 'H0Z', fill, ' class="sb-lane-shape" stroke-width="3.5"') +
      PB.text(size ? a / 2 : 55, size ? 8 : 7, txt, size || 19, { w: 800 }) + '</g>';
  }

  /* ---------- phones: the same hall re-laid for the 480×480 window ----------
   * Station frames start at PH.CAM[k]. Station 0 is wider than the window: after the weighing the camera pans on by
   * PH.CAM0 so the ghost card (right of the scales) and the weighed card share the frame. At the Стрелочник the signpost
   * stands before the fork, behind the waiting card, and the machine speaks in two-line bubbles — so the fork, the
   * ramp and Главный мастер's balcony fit the right half. */
  var PH_SIGN_X = [300, 810, 1380, 1880];    // sign centres: station 0's stays in frame before and after its pan

  /* multi-line speech bubble ('\n' breaks), tail down-left (tip at o.x, o.y): PB.bubble is one line only and PB.fit
   * measures the whole <text>, so these carry their own class (.sb-bub2) and sbFit re-measures the longest line */
  function bubbleD2(tx, ty, bx, by, w, h) {
    var f = MP.pb.f, r = 16, x1 = bx + w, y1 = by + h;
    return 'M' + f(bx + r) + ' ' + f(by) + 'H' + f(x1 - r) + 'Q' + f(x1) + ' ' + f(by) + ' ' + f(x1) + ' ' + f(by + r) +
      'V' + f(y1 - r) + 'Q' + f(x1) + ' ' + f(y1) + ' ' + f(x1 - r) + ' ' + f(y1) +
      'H' + f(bx + 50) + 'L' + f(tx) + ' ' + f(ty) + 'L' + f(bx + 26) + ' ' + f(y1) +
      'H' + f(bx + r) + 'Q' + f(bx) + ' ' + f(y1) + ' ' + f(bx) + ' ' + f(y1 - r) + 'V' + f(by + r) +
      'Q' + f(bx) + ' ' + f(by) + ' ' + f(bx + r) + ' ' + f(by) + 'Z';
  }
  function bubble2(o) {
    var PB = MP.pb, size = 22, pad = 18, lh = 1.12, lines = o.text.split('\n');
    var h = Math.round(size * (1.95 + lh * (lines.length - 1)));
    var w = Math.max.apply(null, lines.map(function (l) { return l.length; })) * size * 0.6 + pad * 2;
    var bx = o.x - 24, by = o.y - 14 - h;
    return '<g class="sb-bub2 ' + o.cls + '" data-tx="' + o.x + '" data-ty="' + o.y + '" data-h="' + h + '" data-pad="' + pad + '" opacity="0">' +
      PB.P(bubbleD2(o.x, o.y, bx, by, w, h), CREAM, ' class="pb-bub-shape" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"') +
      PB.text(bx + w / 2, by + h / 2, o.text, size, { mid: true, w: 800, lh: lh }) + '</g>';
  }
  function sbFit(root) {
    Array.prototype.forEach.call(root.querySelectorAll('.sb-bub2'), function (g) {
      var spans = g.querySelectorAll('tspan'), p = g.querySelector('.pb-bub-shape'), tw = 0;
      try { Array.prototype.forEach.call(spans, function (t) { tw = Math.max(tw, t.getComputedTextLength()); }); } catch (e) { return; }
      if (!tw) return;
      var tx = +g.getAttribute('data-tx'), ty = +g.getAttribute('data-ty'), h = +g.getAttribute('data-h');
      var w = Math.round(tw + 2 * +g.getAttribute('data-pad')), bx = tx - 24, by = ty - 14 - h;
      p.setAttribute('d', bubbleD2(tx, ty, bx, by, w, h));
      g.querySelector('text').setAttribute('x', MP.pb.f(bx + w / 2));
      Array.prototype.forEach.call(spans, function (t) { t.setAttribute('x', MP.pb.f(bx + w / 2)); });
    });
  }

  function markupPhone() {
    var PB = MP.pb, R = PB.R, C = PB.C, P = PB.P, L = PB.L, place = PB.place, NS = PB.NS, T = PB.text;
    var BY = PH.BY, S = PH.CAM, FK = PH.FORK, s = '', w = '', i;

    /* static floor */
    s += R(-10, BY + 44, 500, 60, 0, INK, NS + ' fill-opacity=".07"') + L('M0 ' + (BY + 44) + 'H480', INK, 3, ' stroke-opacity=".18"');

    /* far layer (parallax ×0.5): smaller windows + the pipe */
    var far = L('M-40 20H1400', STEEL_D, 12, ' stroke-linecap="butt"') + L('M-40 20H1400', STEEL, 6, ' stroke-linecap="butt"');
    for (i = 0; i < 6; i++) {
      var wx = 100 + i * 240;
      far += R(wx - 4, 10, 16, 20, 3, STEEL_D, ' stroke-width="3"') +
        R(wx - 56, 112, 112, 120, 56, SKY, ' fill-opacity=".28" stroke-opacity=".35" stroke-width="4"') +
        L('M' + wx + ' 114V230M' + (wx - 54) + ' 172H' + (wx + 54), INK, 3, ' stroke-opacity=".18"');
    }
    s += '<g class="sb-far">' + far + '</g>';

    /* hanging signs */
    SIGNS.forEach(function (name, k) {
      var cx = PH_SIGN_X[k];
      w += '<g class="sb-sign">' + L('M' + (cx - 96) + ' 0V30M' + (cx + 96) + ' 0V30', INK, 3) +
        R(cx - 128, 28, 256, 50, 14, CREAM, ' stroke-width="4"') + T(cx - 14, 61, name, 22, { d: true }) +
        C(cx + 102, 53, 10, MINT, ' class="sb-slamp" stroke-width="3.5"') + '</g>';
    });

    /* station 0: Бригадир + «Готово» drawer + Весы; the ghost card sits past the frame's right edge until the camera
     * pans on by PH.CAM0 after the weighing */
    var fc = '';
    for (i = 0; i < 3; i++) fc += '<g class="sb-fcard">' + R(148 + i * 10, 252 - i * 4, 62, 44, 6, CREAM, ' stroke-width="3"') +
      L('M' + (158 + i * 10) + ' ' + (268 - i * 4) + 'h30', SKY, 4) + '</g>';
    w += '<g class="sb-drawer">' + fc + R(138, 276, 108, 132, 12, MINT, ' stroke-width="4"') + R(148, 292, 88, 40, 9, CREAM, ' stroke-width="3"') +
      T(192, 320, 'Готово', 22, { w: 800 }) + C(192, 372, 6.5, CREAM, ' stroke-width="3"') + '</g>';
    w += '<g class="sb-brig">' + place(MP.char('brigadir'), 0, 264, 1.1) + '</g>';
    w += '<g class="sb-vesy">' + place(MP.machine('vesy'), 250, 231, 1.35) + '</g>';
    w += '<g class="sb-ghost">' + R(400, 126, 176, 152, 22, CREAM, ' stroke-width="3.5" stroke-dasharray="10 9"') +
      '<g class="sb-gh sb-gh-l">' + R(422, 150, 64, 108, 10, CREAM, ' stroke-width="3.5"') + T(454, 216, '1', 30, { d: true }) + '</g>' +
      '<g class="sb-gh sb-gh-r">' + R(490, 150, 64, 108, 10, CREAM, ' stroke-width="3.5"') + T(522, 216, '2', 30, { d: true }) + '</g>' +
      '<g class="sb-gh-whole" opacity="0">' + R(422, 150, 132, 108, 12, CREAM, ' stroke-width="3.5"') + T(488, 212, 'Большая', 22, { w: 800 }) + '</g>' +
      L('M488 138V270', RASP, 4, ' class="sb-gh-cut" stroke-dasharray="8 8" opacity="0"') +
      R(400, 106, 176, 40, 20, CREAM, ' stroke-width="3.5" stroke-dasharray="7 6"') + T(488, 134, 'если большая', 22, { w: 800 }) + '</g>';

    /* station 1: the machine at the left edge, the card waits in front of the signpost, the fork, the ramp up to the
     * balcony in the right half */
    var x1 = S[1];
    w += '<g class="sb-strel">' + place(MP.machine('strelochnik'), x1 - 16, 280, 1) + '</g>';
    w += L('M' + (x1 + 380) + ' 318V396', STEEL_D, 10, ' stroke-linecap="butt"') + L('M' + (x1 + 380) + ' 318V396', INK, 3, ' stroke-opacity=".35"');
    w += '<g transform="translate(' + FK + ' ' + BY + ') rotate(' + (-PH.RAMP) + ')">' + MP.belt({ w: 214, h: 26, pitch: 24, rollers: false, cls: 'sb-ramp' }) + '</g>';
    w += '<g class="sb-balcony">' + R(x1 + 362, 204, 118, 60, 12, STEEL, ' stroke-width="4"') + R(x1 + 368, 210, 106, 48, 10, CREAM, ' stroke-width="3"') +
      T(x1 + 421, 234, 'Главный\nмастер', 22, { mid: true, w: 800, lh: 1 }) + '</g>';
    w += '<g class="sb-chief">' + place(MP.char('master', { variant: 'chief' }), x1 + 373, 100, 0.8) + '</g>';
    w += '<g class="sb-post">' + R(x1 + 214, 206, 12, 188, 4, STEEL, ' stroke-width="3.5"') + C(x1 + 220, 204, 9, STEEL_D, ' stroke-width="3.5"') +
      '<g transform="translate(' + (x1 + 226) + ' 226) rotate(-18)">' + laneBoard('sb-lane-hi', 'Главному', CREAM, 123, 22) + '</g>' +
      '<g transform="translate(' + (x1 + 226) + ' 272)">' + laneBoard('sb-lane-lo', 'Мастеру', MINT, 113, 22) + '</g></g>';

    /* station 2: Художник + paint (the desktop splats, each moved into the upper right of the frame) */
    var x2 = S[2];
    w += '<g class="sb-splats">' +
      '<g transform="translate(' + (x2 - 1490) + ' -72)"><g class="sb-splat">' + P('M1822 194c20-18 50-6 48 18 16 4 16 26-2 30-4 22-34 26-44 8-22 4-32-22-14-34-10-14 2-30 12-22z', VIOLET, ' stroke-width="3.5"') + C(1810, 262, 7, VIOLET, ' stroke-width="3"') + '</g></g>' +
      '<g transform="translate(' + (x2 - 1560) + ' -76)"><g class="sb-splat">' + P('M1972 170c18-10 40 4 36 22 14 8 8 30-8 28-6 18-30 18-36 2-18-2-20-24-4-30-4-14 4-24 12-22z', MINT, ' stroke-width="3.5"') + C(2024, 166, 6, MINT, ' stroke-width="3"') + '</g></g>' +
      '<g transform="translate(' + (x2 - 1566) + ' -80)"><g class="sb-splat">' + P('M1998 300c14-8 32 2 30 16 12 6 6 24-6 22-4 14-24 14-28 2-14-2-16-18-4-24-2-10 2-18 8-16z', SKY, ' stroke-width="3.5"') + '</g></g>' +
      '</g>';
    w += '<g class="sb-khud">' + place(MP.char('khudozhnik'), x2 + 6, 243, 1.25) + '</g>';

    /* station 3: Мастер */
    w += '<g class="sb-master">' + place(MP.char('master'), S[3] + 90, 243, 1.25) + '</g>';

    /* the main belt + the switch blade (pivot at the fork) */
    w += MP.belt({ x: -120, y: BY, w: 2360, h: 40, pitch: 28, legs: 34 });
    w += '<g class="sb-switch">' + R(FK - 6, BY - 14, 104, 14, 7, TANG, ' stroke-width="3.5"') + L('M' + (FK + 10) + ' ' + (BY - 7) + 'H' + (FK + 88), INK, 3, ' stroke-opacity=".3" stroke-dasharray="6 8"') +
      C(FK, BY - 7, 9, STEEL_D, ' stroke-width="3.2"') + C(FK, BY - 7, 3, INK, NS) + '</g>';

    /* swatches and sparks */
    w += '<g class="sb-sw">' + R(-23, -16, 46, 32, 9, VIOLET, ' stroke-width="3.5"') + '</g>' +
      '<g class="sb-sw">' + R(-23, -16, 46, 32, 9, MINT, ' stroke-width="3.5"') + '</g>' +
      '<g class="sb-sw">' + R(-30, -20, 60, 40, 10, CREAM, ' stroke-width="3.5"') + T(0, 8, 'Аа', 22, { d: true }) + '</g>';
    w += PB.splash(PH.STOP[3] - 68, BY - 84, 26, 50, [-150, -110, -70, 170, 200], INK, 'sb-spark');

    w += cardMarkup(PH.STOP[3], BY, { txt: 22, time: 22, det: 22 });

    /* speech bubbles last (always on top) */
    w += PB.bubble({ x: 60, y: 240, text: 'Такого ещё не было', cls: 'sb-b0', off: true });
    w += PB.bubble({ x: 340, y: 246, text: 'Бип. Вес в норме', tail: 'dr', cls: 'sb-b1', off: true });
    w += bubble2({ x: x1 + 28, y: 282, text: 'Бип. Трудное —\nГлавному', cls: 'sb-b2' });
    w += bubble2({ x: x1 + 28, y: 282, text: 'Бип. Простое —\nМастеру', cls: 'sb-b3' });
    w += PB.bubble({ x: x2 + 107, y: 258, text: 'Будет красиво!', cls: 'sb-b4', off: true });
    w += PB.bubble({ x: S[3] + 152, y: 258, text: 'Готово, проверяйте!', cls: 'sb-b5' });

    s += '<g class="sb-world" transform="translate(-' + S[3] + ' 0)">' + w + '</g>';
    return '<g' + PB.ROOT + '>' + s + '</g>';
  }

  function build(section, api, phone) {
    var g = phone ? PH : BIG;
    var svg = MP.pb.mount(api, phone ? markupPhone() : markup(), 'sb-svg', phone);
    /* the far layer's final (station 3) offset */
    var far = api.stage.querySelector('.sb-far');
    if (far) far.setAttribute('transform', 'translate(' + (-g.CAM[3] / 2) + ' 0)');
    if (phone) {
      sbFit(svg);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { sbFit(svg); });
    }
  }

  function master(section, api, phone) {
    var PB = MP.pb, gsap = window.gsap, svg = api.stage.querySelector('svg');
    var $ = PB.q(svg), $$ = PB.qa(svg), g = phone ? PH : BIG, BY = g.BY, ST = g.STOP;
    PB.frame(svg, api, '0 50 720 450', phone);
    var tl = gsap.timeline({ paused: true });
    var world = $('.sb-world'), far = $('.sb-far'), card = $('.sb-card');
    var plain = $('.sb-plain'), styled = $('.sb-styled'), morph = $('.sb-morph'), bell = $('.sb-bell'), dlabel = $('.sb-dlabel');
    var chev = $('.sb-world > .belt .belt-chev'), pitch = 28;
    var rollers = $$('.sb-world > .belt .belt-roller');
    var slamps = $$('.sb-slamp');
    var bub = function (k) { return $('.sb-b' + k); };
    var wrapX = gsap.utils.unitize(gsap.utils.wrap(0, pitch));

    /* ----- start state: camera at station 0, card off-stage left, plain ----- */
    gsap.set(world, { x: 0 });
    gsap.set(far, { x: 0 });
    gsap.set(card, { x: -140, y: BY, rotation: 0, transformOrigin: '50% 100%' });
    gsap.set(plain, { autoAlpha: 1 });
    gsap.set(styled, { autoAlpha: 0, scale: 1, transformOrigin: '50% 100%' });
    gsap.set(morph, { autoAlpha: 0, attr: { d: CARD_D }, fill: VIOLET });
    gsap.set([bell, dlabel], { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(slamps, { fill: STEEL_D });
    $$('.pb-bub, .sb-bub2').forEach(function (b) {
      gsap.set(b, { autoAlpha: 0, scale: 0, svgOrigin: b.getAttribute('data-tx') + ' ' + b.getAttribute('data-ty') });
    });
    gsap.set($$('.pb-splash'), { autoAlpha: 0 });

    var fcards = $$('.sb-fcard'), brig = $('.sb-brig .c-char');
    var vNeedle = $('.sb-vesy .c-needle'), vLamp = $('.sb-vesy .c-lamp--main circle');
    var ghost = $('.sb-ghost'), ghWhole = $('.sb-gh-whole'), ghCut = $('.sb-gh-cut'), ghL = $('.sb-gh-l'), ghR = $('.sb-gh-r');
    gsap.set(fcards, { transformOrigin: '50% 100%' });
    gsap.set(vLamp, { fill: STEEL_D });
    gsap.set(ghost, { autoAlpha: 0, scale: 0.6, transformOrigin: '50% 50%' });
    gsap.set(ghWhole, { autoAlpha: 1 });
    gsap.set([ghL, ghR], { autoAlpha: 0 });
    gsap.set(ghCut, { autoAlpha: 0, drawSVG: '0%' });

    var lever = $('.sb-strel .c-lever'), sLamp = $('.sb-strel .c-lamp--main circle'), sw = $('.sb-switch');
    var laneHi = $('.sb-lane-hi'), laneLo = $('.sb-lane-lo'), loShape = $('.sb-lane-lo .sb-lane-shape'), chiefArm = $('.sb-chief .c-arm-r');
    gsap.set(sw, { svgOrigin: g.FORK + ' ' + (BY - 7), rotation: -g.RAMP });
    gsap.set(sLamp, { fill: STEEL_D });
    gsap.set(loShape, { fill: CREAM });
    gsap.set([laneHi, laneLo], { transformOrigin: '0% 50%' });

    var splats = $$('.sb-splat'), sws = $$('.sb-sw'), khud = $('.sb-khud .c-char');
    gsap.set(splats, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(sws, { autoAlpha: 0, x: g.SW[0], y: g.SW[1], scale: 0.6 });

    var mArm = $('.sb-master .c-arm-r'), spark = $('.sb-spark');

    /* a ride = card along the belt + the belt surface + rollers, with the camera following (cam = world x of the
     * window's left edge) */
    function ride(pos, toX, cam, dur) {
      var dx = toX - (ride.x || -140);
      ride.x = toX;
      tl.to(card, { x: toX, duration: dur, ease: 'power2.inOut' }, pos)
        .to(card, { keyframes: { rotation: [0, -3, 2, -1, 0] }, duration: dur, ease: 'none' }, pos)
        .to(chev, { x: '+=' + dx, duration: dur, ease: 'power2.inOut', modifiers: { x: wrapX } }, pos)
        .to(rollers, { rotation: '+=' + Math.round(dx * 1.2), duration: dur, ease: 'power2.inOut' }, pos);
      if (cam != null) pan(pos, cam, dur);
    }
    function pan(pos, cam, dur) {
      tl.to(world, { x: -cam, duration: dur, ease: 'power2.inOut' }, pos)
        .to(far, { x: -cam / 2, duration: dur, ease: 'power2.inOut' }, pos);
    }
    function say(k, pos, out) {
      tl.to(bub(k), { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, pos);
      if (out != null) tl.to(bub(k), { autoAlpha: 0, scale: 0, duration: 0.2, ease: 'power2.in' }, out);
    }
    function lampOn(el, pos) {
      PB.lamp(tl, el, MINT, pos);
    }

    /* ----- scales ----- */
    fcards.forEach(function (c, k) {
      tl.to(c, { y: -26, rotation: k % 2 ? 9 : -9, duration: 0.16, ease: 'power2.out', yoyo: true, repeat: 1 }, 0.15 + k * 0.2);
    });
    tl.to(brig, { scaleY: 0.9, duration: 0.14, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.85);
    say(0, 0.9, 2.3);
    ride(0.5, ST[0], null, 1.3);
    tl.to(card, { motionPath: { path: [{ x: ST[0] - 10, y: g.PAN - 34 }, { x: ST[0], y: g.PAN }], curviness: 1.2 }, duration: 0.5, ease: 'power1.inOut' }, 1.9)
      .to(card, { scaleY: 0.3, scaleX: 1.05, duration: 0.18, ease: 'power2.in' }, 2.33)
      .to(vNeedle, { keyframes: { rotation: [0, 55, -28, 30, -14, 12, 8] }, duration: 1.2, ease: 'power1.out' }, 2.45);
    lampOn(vLamp, 3.5);
    say(1, 3.55);
    tl.to(card, { scaleY: 1, scaleX: 1, duration: 0.3, ease: 'back.out(2)' }, 4.1)
      .to(card, { motionPath: { path: [{ x: (ST[0] + g.HOP) / 2, y: BY - 130 }, { x: g.HOP, y: BY }], curviness: 1.2 }, duration: 0.5, ease: 'power1.inOut' }, 4.1);
    if (g.CAM0) pan(4.1, g.CAM0, 0.9);
    tl.to(ghost, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(1.8)' }, 4.5)
      .to(ghCut, { autoAlpha: 1, drawSVG: '100%', duration: 0.35, ease: 'power2.out' }, 5.0)
      .set(ghWhole, { autoAlpha: 0 }, 5.4)
      .set([ghL, ghR], { autoAlpha: 1 }, 5.4)
      .to(ghCut, { autoAlpha: 0, duration: 0.2 }, 5.4)
      .to(ghL, { x: -10, rotation: -7, duration: 0.4, ease: 'back.out(2.4)', transformOrigin: '50% 100%' }, 5.4)
      .to(ghR, { x: 10, rotation: 7, duration: 0.4, ease: 'back.out(2.4)', transformOrigin: '50% 100%' }, 5.4);
    lampOn(slamps[0], 5.6);
    ride.x = g.HOP;
    tl.addLabel('scales', 6.0);
    tl.to(bub(1), { autoAlpha: 0, scale: 0, duration: 0.2 }, 'scales');

    /* ----- switch ----- */
    /* the card waits before the fork; the rule is said, Главный мастер perks up, the lever flips the blade straight */
    ride('scales', ST[1], g.CAM[1], 1.5);
    say(2, 'scales+=1.45', 'scales+=2.6');
    tl.to(laneHi, { scale: 1.12, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 'scales+=1.55')
      .to(chiefArm, { rotation: -100, duration: 0.3, ease: 'back.out(2)' }, 'scales+=1.6')
      .to(chiefArm, { rotation: -78, duration: 0.16, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '>')
      .to(lever, { rotation: 62, duration: 0.35, ease: 'back.out(2.5)' }, 'scales+=2.5')
      .to(sw, { rotation: 0, duration: 0.4, ease: 'back.out(2)' }, 'scales+=2.6')
      .to(chiefArm, { rotation: 0, duration: 0.35, ease: 'power2.inOut' }, 'scales+=2.7');
    lampOn(sLamp, 'scales+=2.75');
    say(3, 'scales+=2.8');
    tl.set(loShape, { fill: MINT }, 'scales+=2.95')
      .to(laneLo, { scale: 1.15, duration: 0.14, ease: 'power2.out' }, 'scales+=2.95')
      .to(laneLo, { scale: 1, duration: 0.45, ease: 'elastic.out(1,.5)' }, '>')
      .to(card, { y: BY - 22, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }, 'scales+=3.15');
    lampOn(slamps[1], 'scales+=3.35');
    tl.addLabel('switch', 'scales+=3.8');
    tl.to(bub(3), { autoAlpha: 0, scale: 0, duration: 0.2 }, 'switch');

    /* ----- artist ----- */
    ride('switch', ST[2], g.CAM[2], 1.5);
    say(4, 'switch+=1.3');
    tl.to(khud, { rotation: -6, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 'switch+=1.5')
      .to(splats, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(3)', stagger: 0.1 }, 'switch+=1.6');
    sws.forEach(function (el, k) {
      var tgt = [{ x: ST[2] - 40, y: BY - 60 }, { x: ST[2] + 30, y: BY - 64 }, { x: ST[2] - 2, y: BY - 40 }][k];
      tl.set(el, { autoAlpha: 1 }, 'switch+=' + (1.9 + k * 0.22))
        .to(el, { scale: 1, duration: 0.2 }, '<')
        .add(PB.hop(el, tgt.x, tgt.y, 110, 0.55, { rotation: k === 1 ? 200 : -160 }), '<')
        .to(el, { scale: 0, autoAlpha: 0, duration: 0.18, ease: 'power2.in' }, '>-0.02');
    });
    tl.to(styled, { autoAlpha: 1, duration: 0.15 }, 'switch+=2.75')
      .fromTo(styled, { scale: 1.18 }, { scale: 1, duration: 0.45, ease: 'back.out(2.4)', immediateRender: false }, 'switch+=2.75')
      .to(plain, { autoAlpha: 0, duration: 0.15 }, 'switch+=2.8');
    lampOn(slamps[2], 'switch+=3.3');
    tl.addLabel('artist', 'switch+=3.8');
    tl.to(bub(4), { autoAlpha: 0, scale: 0, duration: 0.2 }, 'artist');

    /* ----- master ----- */
    ride('artist', ST[3], g.CAM[3], 1.5);
    tl.to(mArm, { rotation: -55, duration: 0.3, ease: 'power2.out' }, 'artist+=1.4');
    for (var h = 0; h < 3; h++) {
      var th = 1.75 + h * 0.5;
      tl.to(mArm, { rotation: 32, duration: 0.14, ease: 'power3.in' }, 'artist+=' + th)
        .to(card, { scaleY: 0.84, scaleX: 1.08, duration: 0.08, ease: 'power2.out' }, 'artist+=' + (th + 0.13))
        .to(card, { scaleY: 1, scaleX: 1, duration: 0.3, ease: 'elastic.out(1,.45)' }, '>');
      PB.burst(tl, spark, 'artist+=' + (th + 0.12));
      if (h < 2) tl.to(mArm, { rotation: -55, duration: 0.24, ease: 'power2.out' }, 'artist+=' + (th + 0.2));
    }
    tl.to(mArm, { rotation: 0, duration: 0.35, ease: 'back.out(2)' }, 'artist+=3.05')
      .set(morph, { autoAlpha: 1 }, 'artist+=3.1')
      .to(styled, { autoAlpha: 0, duration: 0.2 }, 'artist+=3.1')
      .to(morph, { morphSVG: PIECE_D, duration: 0.55, ease: 'back.out(1.6)' }, 'artist+=3.15')
      .to(bell, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2.4)' }, 'artist+=3.55')
      .to(bell, { rotation: 14, duration: 0.09, yoyo: true, repeat: 5, ease: 'sine.inOut' }, '>')
      .to(dlabel, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 'artist+=3.7');
    say(5, 'artist+=3.9');
    lampOn(slamps[3], 'artist+=4.0');
    tl.addLabel('master', 'artist+=4.4');
    return tl;
  }

  /* phones held sideways (≤ 520px tall) keep the phone composition up to 1023px wide too: the stage there is capped by
   * the height (~310px), where the 16:10 crop's labels would shrink to ~11px; scenes-b.css gives #sborka the square
   * stage to match */
  MP.pb.scene('sborka', { build: build, master: master, first: 'scales',
    phone: MP.pb.PHONE + ', (orientation: landscape) and (max-height: 520px) and (pointer: coarse) and (max-width: 1023px)' });
})();
