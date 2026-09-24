/* scenes/pamyat.js — «Фабрика запоминает и учится» (package C; docs/design-prosto.md §2.9).
 * Stage: a sky-blue memory room. Left shelf «Память этого проекта» (a notebook), right shelf «Копилка всей фабрики»
 * (a big book + a model of the factory), a door «Проект №2», Библиотекарь and Рационализатор on the floor.
 * Demo (on enter, and again after a rating ≤ 3): card «Оценка 3 из 5» → flips into the lesson «Урок: напоминание
 * должно звучать громче» → Библиотекарь («Это запомним») files it on the project shelf → the door «Проект №2» opens
 * with the same lesson → its copy flies over and merges (badge «2 проекта») → a copy goes into the factory's book →
 * Рационализатор's bulb lights («Есть идея!») → envelope «Рацпредложение: улучшить фабрику» → lemon stamp
 * «Одобрено вами» → a new shiny gear flies into the factory model.
 * Rating buttons: aria-pressed + .rating-out; 5/4 → stars sparkle around the rating card; ≤ 3 → the lesson flow replays.
 * Two layouts (wide 800×600; tall 440×550 = the shared 4:5 phone stage below 760px, see scenes-c.css), both driven
 * by the same timelines. The rating card is a passing reaction: it fades after ~2 s (calm: hidden after ~2 s).
 * build() = FINAL state (lesson filed, door open, bulb lit, envelope stamped, gear in place).
 */
(function () {
  'use strict';
  var MP = window.MP;
  if (!MP || !MP.scene) return;

  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', LEMON = '#FFDA4F', MINT = '#2BD99F',
    SKY = '#3EC5FF', TANG = '#FF8A1F', STEEL = '#C9D3E6', STEEL_D = '#8E9BB8', WHITE = '#FFFFFF';
  var FT = "'Golos Text', 'Segoe UI', system-ui, sans-serif";
  var FD = "Unbounded, 'Arial Black', system-ui, sans-serif";
  var RATE_HOLD = 2;   // seconds the «Оценка N из 5» card stays up after a good rating
  var GOOD = 'Отлично! Значит, всё идёт как надо.';
  var LESSON = 'Урок записан. Библиотекарь решит, куда его положить.';

  /* ---------- SVG string helpers ---------- */
  function f(v) { return String(Math.round(v * 100) / 100); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function R(x, y, w, h, rx, fill, ex) {
    return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' +
      (rx ? ' rx="' + f(rx) + '"' : '') + ' fill="' + fill + '"' + (ex || '') + '/>';
  }
  function C(cx, cy, r, fill, ex) {
    return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + fill + '"' + (ex || '') + '/>';
  }
  function P(d, fill, ex) { return '<path d="' + d + '" fill="' + fill + '"' + (ex || '') + '/>'; }
  function Ln(d, col, w, ex) {
    return '<path d="' + d + '" fill="none"' + (col ? ' stroke="' + col + '"' : '') + (w ? ' stroke-width="' + w + '"' : '') + (ex || '') + '/>';
  }
  function G(cls, inner, ex) { return '<g' + (cls ? ' class="' + cls + '"' : '') + (ex || '') + '>' + inner + '</g>'; }
  function T(x, y, s, size, o) {
    o = o || {};
    return '<text x="' + f(x) + '" y="' + f(y) + '" font-family="' + (o.display ? FD : FT) + '" font-size="' + size +
      '" font-weight="' + (o.weight || 700) + '" fill="' + (o.fill || INK) + '" stroke="none"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + (o.cls ? ' class="' + o.cls + '"' : '') + '>' + esc(s) + '</text>';
  }
  function at(x, y, extra) { return ' transform="translate(' + f(x) + ' ' + f(y) + ')' + (extra || '') + '"'; }
  var NS = ' stroke="none"';
  function polar(cx, cy, r, a) { var t = a * Math.PI / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; }
  function starD(cx, cy, r) {
    var d = '';
    for (var i = 0; i < 10; i++) { var p = polar(cx, cy, i % 2 ? r * 0.48 : r, -90 + i * 36); d += (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1]); }
    return d + 'Z';
  }
  function sparkD(cx, cy, r) {
    var k = r * 0.28;
    return 'M' + f(cx) + ' ' + f(cy - r) + 'Q' + f(cx + k) + ' ' + f(cy - k) + ' ' + f(cx + r) + ' ' + f(cy) +
      'Q' + f(cx + k) + ' ' + f(cy + k) + ' ' + f(cx) + ' ' + f(cy + r) + 'Q' + f(cx - k) + ' ' + f(cy + k) + ' ' +
      f(cx - r) + ' ' + f(cy) + 'Q' + f(cx - k) + ' ' + f(cy - k) + ' ' + f(cx) + ' ' + f(cy - r) + 'Z';
  }
  function gearD(cx, cy, r, n) {
    var d = '', ri = r * 0.74, step = 360 / n;
    for (var i = 0; i < n; i++) {
      var a = i * step, pts = [polar(cx, cy, ri, a - step * 0.36), polar(cx, cy, r, a - step * 0.2),
        polar(cx, cy, r, a + step * 0.2), polar(cx, cy, ri, a + step * 0.36)];
      for (var j = 0; j < 4; j++) d += (i || j ? 'L' : 'M') + f(pts[j][0]) + ' ' + f(pts[j][1]);
    }
    return d + 'Z';
  }
  function gear(r) {   /* shiny tangerine gear centred at (0,0) */
    return P(gearD(0, 0, r, 9), TANG, ' stroke-width="3.5"') + C(0, 0, r * 0.34, CREAM, ' stroke-width="3"') +
      Ln('M' + f(-r * 0.5) + ' ' + f(-r * 0.2) + 'Q' + f(-r * 0.45) + ' ' + f(-r * 0.5) + ' ' + f(-r * 0.15) + ' ' + f(-r * 0.58), CREAM, 3);
  }
  function sparkle(x, y, r, cls, ex) { return P(sparkD(x, y, r), WHITE, ' class="' + cls + '" stroke-width="2.6"' + (ex || '')); }

  /* ---------- layouts ---------- */
  var LAYOUTS = {
    wide: {
      W: 800, H: 600, floor: 540,
      shelfA: { x: 24, w: 316, y: 196, plate: [34, 212, 296, 40], label: ['Память этого проекта'], ls: 21 },
      note: { x: 36, y: 82, w: 62, h: 114 },
      lesson: { cx: 214, cy: 138, rot: 2 },
      shelfB: { x: 358, w: 266, y: 196, plate: [364, 212, 254, 40], label: ['Копилка всей фабрики'], ls: 21 },
      book: { x: 372, y: 62, w: 76, h: 134 },
      factory: { x: 464, y: 88, s: 1 },
      door: { x: 664, y: 272, w: 108, h: 268, plate: [648, 212, 138, 40], ls: 20, cdx: 8 },
      mini: 1,
      lib: { x: 26, y: 330, s: 1.5 },
      rat: { x: 466, y: 330, s: 1.5 },
      env: { cx: 336, cy: 436, s: 1 },
      rate: { cx: 380, cy: 318, s: 1 },
      bubLib: { x: 132, y: 372, w: 184, dx: 20 },
      bubRat: { x: 530, y: 350, w: 150, dx: -64 }
    },
    tall: {
      /* the shared 4:5 phone stage: project shelf on top, the factory shelf and the door «Проект №2» in the
       * middle, Библиотекарь and Рационализатор on the floor; the approved envelope leans on the door */
      W: 440, H: 550, floor: 510,
      shelfA: { x: 16, w: 408, y: 156, plate: [70, 176, 300, 36], label: ['Память этого проекта'], ls: 21 },
      note: { x: 30, y: 58, w: 48, h: 98 },
      lesson: { cx: 262, cy: 100, rot: 2 },
      shelfB: { x: 16, w: 262, y: 336, plate: [20, 352, 254, 36], label: ['Копилка всей фабрики'], ls: 20 },
      book: { x: 30, y: 234, w: 58, h: 102 },
      factory: { x: 104, y: 258, s: 0.72 },
      door: { x: 322, y: 284, w: 90, h: 226, plate: [298, 228, 126, 36], ls: 19, cdx: 4 },
      mini: 1.1,
      lib: { x: 0, y: 391, s: 0.85 },
      rat: { x: 100, y: 391, s: 0.85 },
      env: { cx: 314, cy: 462, s: 0.92 },
      rate: { cx: 170, cy: 282, s: 0.9 },
      bubLib: { x: 58, y: 404, w: 170, dx: 50 },
      bubRat: { x: 176, y: 404, w: 146, dx: 40 }
    }
  };
  /* derived points */
  Object.keys(LAYOUTS).forEach(function (k) {
    var L = LAYOUTS[k], fa = L.factory, d = L.door, r = L.rat;
    L.gearAt = [fa.x + 122 * fa.s, fa.y + 74 * fa.s];
    L.gearR = 22 * fa.s;
    L.copyAt = [d.x + d.w / 2 + d.cdx, d.y + d.h * 0.36];
    L.bookAt = [L.book.x + L.book.w / 2, L.book.y + L.book.h / 2];
    L.bulbAt = [r.x + 60 * r.s, r.y + 29 * r.s];
    L.handsAt = [r.x + 60 * r.s, r.y + 96 * r.s];
  });

  /* ---------- art ---------- */
  function backdrop(L) {
    var s = R(0, 0, L.W, L.H, 0, SKY, NS), x, y;
    for (y = 30; y < L.floor - 10; y += 44) for (x = 26 + (Math.round((y - 30) / 44) % 2) * 22; x < L.W; x += 44) s += C(x, y, 2.2, CREAM, NS + ' fill-opacity=".35"');
    s += R(0, L.floor, L.W, L.H - L.floor, 0, CREAM, NS);
    for (x = 30; x < L.W; x += 60) s += Ln('M' + x + ' ' + f(L.floor + 14) + 'h26', INK, 3, ' stroke-opacity=".12"');
    s += Ln('M0 ' + L.floor + 'H' + L.W, INK, 4);
    if (L.clock) {   /* a wall clock fills the free corner of the tall room */
      var c = L.clock;
      s += C(c[0] + 4, c[1] + 4, c[2], INK, NS) + C(c[0], c[1], c[2], CREAM) + C(c[0], c[1], c[2] - 7, 'none', ' stroke-width="2" stroke-opacity=".3"');
      for (var k = 0; k < 12; k++) { var a = k * 30 * Math.PI / 180, r0 = c[2] - 9, r1 = c[2] - (k % 3 ? 12 : 15);
        s += Ln('M' + f(c[0] + Math.cos(a) * r0) + ' ' + f(c[1] + Math.sin(a) * r0) + 'L' + f(c[0] + Math.cos(a) * r1) + ' ' + f(c[1] + Math.sin(a) * r1), INK, k % 3 ? 2 : 3); }
      s += Ln('M' + c[0] + ' ' + c[1] + 'l0 -' + f(c[2] * 0.55) + 'M' + c[0] + ' ' + c[1] + 'l' + f(c[2] * 0.4) + ' ' + f(c[2] * 0.2), INK, 4) + C(c[0], c[1], 4, TANG, ' stroke-width="2.5"');
    }
    return s;
  }
  function plate(p, lines, size) {
    var s = R(p[0] + 5, p[1] + 5, p[2], p[3], 10, INK, NS) + R(p[0], p[1], p[2], p[3], 10, CREAM, ' stroke-width="3.5"');
    var cx = p[0] + p[2] / 2, lh = size * 1.12, y0 = p[1] + p[3] / 2 - (lines.length - 1) * lh / 2 + size * 0.36;
    lines.forEach(function (t, i) { s += T(cx, y0 + i * lh, t, size, { weight: 800, anchor: 'middle' }); });
    return s;
  }
  function shelf(sh) {
    var s = '';
    [sh.x + 26, sh.x + sh.w - 26].forEach(function (bx) { s += P('M' + f(bx - 10) + ' ' + f(sh.y + 12) + 'H' + f(bx + 10) + 'L' + f(bx) + ' ' + f(sh.y + 34) + 'Z', STEEL_D, ' stroke-width="3"'); });
    return s + R(sh.x, sh.y, sh.w, 14, 6, TANG) + Ln('M' + f(sh.x + 10) + ' ' + f(sh.y + 5) + 'H' + f(sh.x + sh.w * 0.4), CREAM, 3);
  }
  function notebook(n) {
    var s = R(n.x, n.y, n.w, n.h, 8, MINT) + R(n.x + 14, n.y + 18, n.w - 24, 22, 4, CREAM, ' stroke-width="3"') +
      Ln('M' + f(n.x + 19) + ' ' + f(n.y + 26) + 'h' + f(n.w - 36) + 'M' + f(n.x + 19) + ' ' + f(n.y + 33) + 'h' + f((n.w - 36) * 0.6), INK, 2, ' stroke-opacity=".45"');
    for (var y = n.y + 12; y < n.y + n.h - 6; y += 14) s += R(n.x - 5, y, 12, 6, 3, STEEL, ' stroke-width="2.4"');
    return s + Ln('M' + f(n.x + n.w - 9) + ' ' + f(n.y + 50) + 'V' + f(n.y + n.h - 12), CREAM, 3.5);
  }
  function book(b) {
    var s = R(b.x + b.w - 6, b.y + 6, 12, b.h - 12, 3, CREAM, ' stroke-width="3"') +
      Ln('M' + f(b.x + b.w + 1) + ' ' + f(b.y + 14) + 'V' + f(b.y + b.h - 14), INK, 1.6, ' stroke-opacity=".4"') +
      R(b.x, b.y, b.w, b.h, 8, VIOLET) + R(b.x, b.y, 14, b.h, 6, INK, NS + ' fill-opacity=".35"') +
      R(b.x + 22, b.y + 20, b.w - 34, 30, 5, CREAM, ' stroke-width="3"') +
      P(gearD(b.x + 22 + (b.w - 34) / 2, b.y + 35, 9, 7), TANG, ' stroke-width="2.4"') +
      Ln('M' + f(b.x + 24) + ' ' + f(b.y + b.h - 26) + 'h' + f(b.w - 38), CREAM, 3, ' stroke-opacity=".7"');
    var mark = P('M' + f(b.x + b.w - 26) + ' ' + f(b.y - 2) + 'h14v40l-7 -7 -7 7Z', MINT, ' stroke-width="3"');
    return s + G('pm-mark', mark);
  }
  function factory(fa) {
    var s = R(12, 2, 18, 40, 3, TANG) + R(8, 0, 26, 8, 3, TANG) +
      P('M0 108V40L32 22V40L64 22V40L96 22V40L128 22V40L150 30V108Z', VIOLET) +
      R(0, 46, 150, 62, 6, CREAM) +
      R(12, 58, 20, 18, 3, SKY, ' stroke-width="3"') + R(40, 58, 20, 18, 3, SKY, ' stroke-width="3"') + R(68, 58, 20, 18, 3, SKY, ' stroke-width="3"') +
      R(20, 84, 26, 24, 3, TANG, ' stroke-width="3"') +
      C(122, 74, 24, 'none', ' stroke-width="3" stroke-dasharray="5 6" stroke-opacity=".45"') +
      '<g transform="translate(122 74)">' + G('pm-gear', gear(22)) + '</g>' +
      sparkle(92, 36, 7, 'pm-fspark') + sparkle(146, 50, 5.5, 'pm-fspark') + sparkle(150, 100, 6, 'pm-fspark');
    return '<g' + at(fa.x, fa.y, fa.s !== 1 ? ' scale(' + f(fa.s) + ')' : '') + (fa.s !== 1 ? ' stroke-width="' + f(4 / fa.s * 0.7) + '"' : '') + '>' + s + '</g>';
  }
  function lessonCard(big) {
    /* 250×112, centred at (0,0) */
    var s = R(-119, -50, 250, 112, 14, INK, NS) + R(-125, -56, 250, 112, 14, CREAM) +
      P('M-125 -24V-42Q-125 -56 -111 -56H111Q125 -56 125 -42V-24Z', MINT, ' stroke-width="3.5"') +
      T(-109, -32, 'Урок', 20, { display: true, weight: 800 }) +
      T(-109, 6, 'напоминание должно', 21, { weight: 700 }) + T(-109, 33, 'звучать громче', 21, { weight: 700 });
    if (big) s += G('pm-badge', R(-30, -80, 128, 38, 19, TANG, ' stroke-width="3.5"') + T(34, -54, '2 проекта', 20, { weight: 800, anchor: 'middle' }), ' transform="rotate(4 34 -61)"');
    return s;
  }
  function miniCard(cls, ex, k) {
    /* 100×64 copy of the lesson card, centred; k scales it for the tall room */
    var s = R(-46, -29, 100, 64, 10, INK, NS) + R(-50, -32, 100, 64, 10, CREAM, ' stroke-width="3.5"') +
      P('M-50 -8V-22Q-50 -32 -40 -32H40Q50 -32 50 -22V-8Z', MINT, ' stroke-width="3"') +
      T(-40, -14, 'Урок', 18, { display: true, weight: 800 }) +
      Ln('M-38 10h70M-38 22h46', INK, 3.5, ' stroke-opacity=".35"');
    return G(cls, k && k !== 1 ? '<g transform="scale(' + f(k) + ')">' + s + '</g>' : s, ex);
  }
  function door(L) {
    var d = L.door, s = '';
    s += R(d.x - 9, d.y - 9, d.w + 18, d.h + 9, 10, TANG);
    s += R(d.x, d.y, d.w, d.h, 5, INK);
    /* open leaf (perspective sliver on the hinge) and the closed leaf */
    s += G('pm-leaf-o', P('M' + f(d.x) + ' ' + f(d.y) + 'L' + f(d.x + 24) + ' ' + f(d.y + 16) + 'V' + f(d.y + d.h - 10) + 'L' + f(d.x) + ' ' + f(d.y + d.h) + 'Z', VIOLET) +
      C(d.x + 17, d.y + d.h * 0.55, 3.5, CREAM, ' stroke-width="2.4"'));
    s += G('pm-leaf-c', R(d.x, d.y, d.w, d.h, 5, VIOLET) + R(d.x + 14, d.y + 16, d.w - 28, d.h * 0.36, 5, 'none', ' stroke-width="3" stroke-opacity=".5"') +
      R(d.x + 14, d.y + d.h * 0.46, d.w - 28, d.h * 0.44, 5, 'none', ' stroke-width="3" stroke-opacity=".5"') +
      C(d.x + d.w - 16, d.y + d.h * 0.55, 6, CREAM, ' stroke-width="3"'), ' opacity="0"');
    /* the same lesson glows in the open doorway (drawn over the open leaf: it is a vision, not furniture) */
    s += C(L.copyAt[0], L.copyAt[1], 56, MINT, ' class="pm-halo" stroke="none" fill-opacity=".35"');
    s += '<g' + at(L.copyAt[0], L.copyAt[1]) + '>' + miniCard('pm-copy', '', L.mini) + '</g>';
    s += plate(d.plate, ['Проект №2'], d.ls);
    return s;
  }
  function bubble(b, text, cls) {
    var w = b.w, h = 50, dx = b.dx || 0, x0 = -w / 2 + dx, y0 = -h - 14;
    return '<g' + at(b.x, b.y) + '>' + G(cls,
      R(x0 + 5, y0 + 5, w, h, 16, INK, NS) + P('M-10 ' + f(y0 + h - 2) + 'L0 0L10 ' + f(y0 + h - 2) + 'Z', WHITE) +
      R(x0, y0, w, h, 16, WHITE) + P('M-7.5 ' + f(y0 + h - 4) + 'L0 ' + f(y0 + h + 6) + 'L7.5 ' + f(y0 + h - 4) + 'Z', WHITE, NS) +
      T(x0 + w / 2, y0 + 33, text, 20, { weight: 700, anchor: 'middle' }), ' opacity="0"') + '</g>';
  }
  function envelope(L) {
    var e = L.env;
    var s = R(-112, -57, 236, 126, 12, INK, NS) + R(-118, -63, 236, 126, 12, CREAM) +
      P('M-114 -60L0 6L114 -60Z', TANG, ' stroke-width="3.5"') + Ln('M-118 63L-32 12M118 63L32 12', INK, 2.5, ' stroke-opacity=".25"') +
      /* the words sit on a small cream label, so the fold lines never run through them */
      R(-107, 10, 214, 50, 10, CREAM, ' stroke-width="2.5"') +
      T(0, 31, 'Рацпредложение:', 20, { weight: 800, anchor: 'middle' }) + T(0, 53, 'улучшить фабрику', 20, { weight: 700, anchor: 'middle' });
    var stamp = '<g transform="translate(56 -30) rotate(-9)">' + G('pm-stamp',
      R(-68, -29, 136, 58, 12, LEMON) + R(-61, -22, 122, 44, 8, 'none', ' stroke-width="2.2" stroke-dasharray="5 4"') +
      T(0, -3, 'Одобрено', 20, { weight: 900, anchor: 'middle' }) + T(0, 19, 'вами', 20, { weight: 900, anchor: 'middle' })) + '</g>';
    return '<g' + at(e.cx, e.cy, e.s !== 1 ? ' scale(' + f(e.s) + ')' : '') + '>' + G('pm-env', s + stamp) + '</g>';
  }
  function rateCard(L) {
    var r = L.rate, s = R(-144, -53, 300, 118, 18, INK, NS) + R(-150, -59, 300, 118, 18, CREAM), i;
    for (i = 0; i < 5; i++) s += P(starD(-88 + i * 44, -18, 18), i < 3 ? TANG : CREAM, ' class="pm-star" stroke-width="3.2"');
    s += T(0, 38, 'Оценка 3 из 5', 22, { display: true, weight: 800, anchor: 'middle', cls: 'pm-rate-text' });
    var sp = '';
    [[-176, -40, 11], [-160, 44, 8], [172, -52, 12], [184, 30, 8], [-40, -84, 9], [60, -80, 7], [-100, 82, 7], [110, 84, 9]].forEach(function (p) {
      sp += sparkle(p[0], p[1], p[2], 'pm-rsp', ' opacity="0"');
    });
    return '<g' + at(r.cx, r.cy, r.s !== 1 ? ' scale(' + f(r.s) + ')' : '') + '>' + G('pm-rate', s + sp, ' opacity="0"') + '</g>';
  }

  function markup(key) {
    var L = LAYOUTS[key], W = L.W, H = L.H, clip = 'pm-clip-' + key;
    var ls = L.lesson;
    var body = backdrop(L) +
      shelf(L.shelfA) + notebook(L.note) + shelf(L.shelfB) + book(L.book) + factory(L.factory) +
      plate(L.shelfA.plate, L.shelfA.label, L.shelfA.ls) + plate(L.shelfB.plate, L.shelfB.label, L.shelfB.ls) +
      door(L) +
      C(L.bulbAt[0], L.bulbAt[1], 30 * L.rat.s, WHITE, ' class="pm-glow" stroke="none" fill-opacity=".6"') +
      MP.char('bibliotekar', { x: L.lib.x, y: L.lib.y, scale: L.lib.s, cls: 'pm-lib' }) +
      MP.char('ratsionalizator', { x: L.rat.x, y: L.rat.y, scale: L.rat.s, cls: 'pm-rat' }) +
      envelope(L) +
      '<g' + at(ls.cx, ls.cy) + '>' + G('pm-lesson', '<g transform="rotate(' + ls.rot + ')">' + lessonCard(true) + '</g>') + '</g>' +
      miniCard('pm-echo', ' opacity="0"', L.mini) + miniCard('pm-echo2', ' opacity="0"', L.mini) +
      G('pm-fly', gear(L.gearR * 1.25), ' opacity="0"') +
      rateCard(L) +
      bubble(L.bubLib, 'Это запомним', 'pm-bub-lib') + bubble(L.bubRat, 'Есть идея!', 'pm-bub-rat');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" class="pm-svg pm-svg--' + key +
      '" focusable="false" aria-hidden="true">' +
      '<defs><clipPath id="' + clip + '"><rect x="4" y="4" width="' + (W - 16) + '" height="' + (H - 16) + '" rx="26"/></clipPath></defs>' +
      '<g stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
      R(12, 12, W - 16, H - 16, 26, INK, NS) +
      G('pm-shake', '<g clip-path="url(#' + clip + ')">' + body + '</g>' + R(4, 4, W - 16, H - 16, 26, 'none')) +
      '</g></svg>';
  }

  /* ---------- DOM ---------- */
  function refs(svg) {
    var key = svg.classList.contains('pm-svg--tall') ? 'tall' : 'wide';
    var q = function (s) { return svg.querySelector(s); }, qa = function (s) { return MP.$$(s, svg); };
    return {
      key: key, L: LAYOUTS[key], svg: svg, shake: q('.pm-shake'),
      rate: q('.pm-rate'), stars: qa('.pm-star'), rateText: q('.pm-rate-text'), rsp: qa('.pm-rsp'),
      lesson: q('.pm-lesson'), badge: q('.pm-badge'), echo: q('.pm-echo'), echo2: q('.pm-echo2'),
      leafC: q('.pm-leaf-c'), leafO: q('.pm-leaf-o'), copy: q('.pm-copy'), halo: q('.pm-halo'),
      mark: q('.pm-mark'), lib: q('.pm-lib'), libArm: q('.pm-lib .c-arm-r'), libArmL: q('.pm-lib .c-arm-l'), rat: q('.pm-rat'), rays: q('.pm-rat .c-rays'),
      bulb: q('.pm-rat .c-bulb'), glow: q('.pm-glow'), bubLib: q('.pm-bub-lib'), bubRat: q('.pm-bub-rat'),
      env: q('.pm-env'), stamp: q('.pm-stamp'), fly: q('.pm-fly'), gear: q('.pm-gear'), fsp: qa('.pm-fspark')
    };
  }
  function trees(sec) { return MP.$$('.pm-svg', sec).map(refs); }
  function setScore(T, n) {
    T.forEach(function (R) {
      R.stars.forEach(function (s, i) { s.setAttribute('fill', i < n ? TANG : CREAM); });
      if (R.rateText) R.rateText.textContent = 'Оценка ' + n + ' из 5';
    });
  }

  function build(sec, api) {
    if (!api.stage) return;
    api.stage.innerHTML = markup('wide') + markup('tall');
    MP.$$('.rate', sec).forEach(function (b) { if (!b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', 'false'); });
  }

  /* start of the lesson flow */
  /* Origins are fixed ONCE here, before any transform exists: GSAP's smoothOrigin would otherwise shift
   * x/y when an origin is first given to an element that is already scaled/rotated (replays). */
  function origins(g, R) {
    var L = R.L, c = '50% 50%', hinge = f(L.door.x) + ' ' + f(L.door.y + L.door.h / 2);
    g.set([R.rate, R.lesson, R.badge, R.echo, R.echo2, R.copy, R.halo, R.glow, R.env, R.stamp, R.fly, R.gear], { transformOrigin: c });
    g.set(R.stars, { transformOrigin: c });
    g.set(R.rsp, { transformOrigin: c });
    g.set(R.fsp, { transformOrigin: c });
    g.set(R.mark, { transformOrigin: '50% 0%' });
    g.set([R.leafC, R.leafO], { svgOrigin: hinge });
    [[R.bubLib, L.bubLib], [R.bubRat, L.bubRat]].forEach(function (p) {   /* pop from the tail tip */
      g.set(p[0], { transformOrigin: f(p[1].w / 2 - (p[1].dx || 0)) + 'px ' + f(64) + 'px' });
    });
  }
  /* start of the lesson flow */
  function setPre(g, T) {
    T.forEach(function (R) {
      var L = R.L;
      origins(g, R);
      g.set(R.rate, { autoAlpha: 0 });
      g.set(R.rsp, { autoAlpha: 0 });
      g.set(R.lesson, { autoAlpha: 0, x: L.rate.cx - L.lesson.cx, y: L.rate.cy - L.lesson.cy, rotation: -L.lesson.rot, scale: 1.12 });
      g.set(R.badge, { scale: 0 });
      g.set(R.leafC, { autoAlpha: 1 });
      g.set(R.leafO, { autoAlpha: 0 });
      g.set(R.copy, { scale: 0 });
      g.set(R.halo, { autoAlpha: 0 });
      g.set(R.mark, { scaleY: 0 });
      g.set([R.glow, R.rays], { autoAlpha: 0 });
      g.set(R.env, { autoAlpha: 0 });
      g.set(R.stamp, { autoAlpha: 0 });
      g.set(R.gear, { autoAlpha: 0 });
      g.set(R.fsp, { scale: 0 });
    });
  }

  /* Timelines: fromTo() only where the FROM values equal the pre-state (immediate render is then invisible and
   * gsap.context().revert() restores the built DOM); everything that must change mid-way uses set() + to(). */
  function flowTree(g, R) {
    var L = R.L, tl = g.timeline();
    var dx = L.rate.cx - L.lesson.cx, dy = L.rate.cy - L.lesson.cy;
    /* 0 · your rating card */
    tl.fromTo(R.rate, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(1.8)' }, 0);
    tl.fromTo(R.stars, { scale: 0 }, { scale: 1, duration: 0.35, ease: 'back.out(3)', stagger: 0.07 }, 0.15);
    /* 0.9 · it flips into a lesson */
    tl.to(R.rate, { scaleX: 0, duration: 0.18, ease: 'power2.in' }, 0.95);
    tl.set(R.rate, { autoAlpha: 0 }, 1.13);
    tl.set(R.lesson, { autoAlpha: 1 }, 1.13);
    tl.fromTo(R.lesson, { scaleX: 0 }, { scaleX: 1.12, duration: 0.26, ease: 'power2.out' }, 1.13);
    /* 1.6 · Библиотекарь files it on the project shelf */
    tl.fromTo(R.bubLib, { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 1.6);
    tl.fromTo(R.lib, { y: 0 }, { y: -14, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' }, 1.6);
    tl.fromTo(R.libArm, { rotation: 0 }, { rotation: -70, duration: 0.35, yoyo: true, repeat: 1, repeatDelay: 0.5, ease: 'power2.out' }, 1.7);
    tl.to(R.lesson, { motionPath: { path: 'M' + f(dx) + ' ' + f(dy) + 'Q' + f(dx * 0.4) + ' ' + f(Math.min(dy, 0) - 110) + ' 0 0' }, duration: 0.85, ease: 'power2.inOut' }, 2.15);
    tl.to(R.lesson, { scale: 1, rotation: 0, duration: 0.85, ease: 'power2.inOut' }, 2.15);
    tl.to(R.bubLib, { autoAlpha: 0, duration: 0.25 }, 2.8);
    /* 3.1 · project №2 has the same lesson */
    tl.to(R.leafC, { scaleX: 0.12, duration: 0.32, ease: 'power2.in' }, 3.1);
    tl.set(R.leafC, { autoAlpha: 0 }, 3.42);
    tl.set(R.leafO, { autoAlpha: 1, scaleX: 0.4 }, 3.42);
    tl.to(R.leafO, { scaleX: 1, duration: 0.3, ease: 'back.out(2)' }, 3.42);
    tl.fromTo(R.halo, { autoAlpha: 0, scale: 0.4 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, 3.45);
    tl.to(R.copy, { scale: 1, duration: 0.45, ease: 'back.out(2.4)' }, 3.5);
    /* 4.0 · its copy flies over and merges */
    var ca = L.copyAt, la = [L.lesson.cx, L.lesson.cy];
    tl.set(R.echo, { autoAlpha: 1, scale: 1 }, 4.0);
    tl.to(R.echo,
      { motionPath: { path: 'M' + f(ca[0]) + ' ' + f(ca[1]) + 'Q' + f((ca[0] + la[0]) / 2) + ' ' + f(Math.min(ca[1], la[1]) - 90) + ' ' + f(la[0]) + ' ' + f(la[1]) },
        scale: 2.4, duration: 0.75, ease: 'power2.inOut' }, 4.0);
    tl.to(R.echo, { autoAlpha: 0, duration: 0.12 }, 4.72);
    tl.to(R.lesson, { scale: 1.08, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }, 4.72);
    tl.to(R.badge, { scale: 1, duration: 0.5, ease: 'back.out(3)' }, 4.8);
    /* 5.1 · Библиотекарь also puts it into the whole factory's book */
    var ba = L.bookAt;
    tl.set(R.echo2, { autoAlpha: 1, scale: 1.2 }, 5.15);
    tl.to(R.echo2,
      { motionPath: { path: 'M' + f(la[0]) + ' ' + f(la[1]) + 'Q' + f((la[0] + ba[0]) / 2) + ' ' + f(Math.min(la[1], ba[1]) - 70) + ' ' + f(ba[0]) + ' ' + f(ba[1]) },
        scale: 0.45, duration: 0.6, ease: 'power2.inOut' }, 5.15);
    tl.to(R.echo2, { autoAlpha: 0, duration: 0.1 }, 5.7);
    tl.to(R.mark, { scaleY: 1, duration: 0.4, ease: 'back.out(2.4)' }, 5.72);
    /* 6.0 · the lesson repeated — Рационализатор's bulb lights up */
    tl.fromTo(R.glow, { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'elastic.out(1,.5)' }, 6.0);
    tl.fromTo(R.rays, { autoAlpha: 0, scale: 0.2 }, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(3)' }, 6.05);
    tl.fromTo(R.bulb, { scale: 1 }, { scale: 1.25, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out' }, 6.05);
    tl.fromTo(R.rat, { y: 0 }, { y: -16, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' }, 6.05);
    tl.fromTo(R.bubRat, { autoAlpha: 0, scale: 0.3 }, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 6.15);
    tl.to(R.bubRat, { autoAlpha: 0, duration: 0.25 }, 7.0);
    /* 7.0 · an envelope «Рацпредложение» */
    var ha = L.handsAt, e = L.env;
    tl.fromTo(R.env, { autoAlpha: 0, x: (ha[0] - e.cx) / e.s, y: (ha[1] - e.cy) / e.s, scale: 0.2, rotation: -16 },
      { autoAlpha: 1, x: 0, y: 0, scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(1.3)' }, 7.05);
    /* 7.9 · your stamp «Одобрено вами» */
    tl.fromTo(R.stamp, { autoAlpha: 0, scale: 2.2 }, { autoAlpha: 1, scale: 0.92, duration: 0.18, ease: 'power4.in' }, 7.9);
    tl.to(R.stamp, { scale: 1, duration: 0.4, ease: 'elastic.out(1,.4)' }, 8.08);
    tl.to(R.shake, { keyframes: { x: [-6, 5, -3, 0] }, duration: 0.3, ease: 'none' }, 8.08);
    /* 8.5 · a new shiny gear for the factory */
    var ga = L.gearAt;
    tl.set(R.fly, { autoAlpha: 1, rotation: 0, scale: 0.6 }, 8.5);
    tl.to(R.fly,
      { motionPath: { path: 'M' + f(e.cx) + ' ' + f(e.cy) + 'Q' + f((e.cx + ga[0]) / 2) + ' ' + f(Math.min(e.cy, ga[1]) - 120) + ' ' + f(ga[0]) + ' ' + f(ga[1]) },
        rotation: 540, scale: 1 / 1.25, duration: 0.85, ease: 'power2.inOut' }, 8.5);
    tl.set(R.fly, { autoAlpha: 0 }, 9.35);
    tl.set(R.gear, { autoAlpha: 1, scale: 1.5, rotation: 0 }, 9.35);
    tl.to(R.gear, { scale: 1, rotation: 180, duration: 0.8, ease: 'elastic.out(1,.45)' }, 9.35);
    tl.to(R.fsp, { scale: 1, duration: 0.45, ease: 'back.out(3)', stagger: 0.08 }, 9.4);
    return tl;
  }
  function goodTree(g, R) {
    var tl = g.timeline();
    tl.fromTo(R.rate, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(1.8)' }, 0);
    tl.fromTo(R.stars, { scale: 0 }, { scale: 1, duration: 0.35, ease: 'back.out(3)', stagger: 0.07 }, 0.15);
    tl.fromTo(R.rsp, { autoAlpha: 0, scale: 0, rotation: -90 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(3)', stagger: 0.05 }, 0.45);
    tl.to(R.rsp, { scale: 0.6, rotation: 45, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut', stagger: 0.05 }, 0.95);
    tl.fromTo([R.lib, R.rat], { y: 0 }, { y: -18, duration: 0.18, yoyo: true, repeat: 3, ease: 'power2.out', stagger: 0.12 }, 0.3);
    /* Библиотекарь cheers: both arms up (props travel with the arms) */
    tl.fromTo([R.libArmL, R.libArm], { rotation: 0 }, { rotation: function (i) { return i ? -105 : 105; }, duration: 0.28, yoyo: true, repeat: 3, ease: 'power2.out' }, 0.3);
    /* a passing reaction: gone after ~2 s so it never sits over the shelves, the door or the envelope */
    tl.to(R.rsp, { autoAlpha: 0, duration: 0.3 }, RATE_HOLD - 0.3);
    tl.to(R.rate, { autoAlpha: 0, scale: 0.85, duration: 0.35, ease: 'power2.in' }, RATE_HOLD);
    return tl;
  }

  function wireRating(sec, api, onRate) {
    var buttons = MP.$$('.rate', sec), out = MP.$('.rating-out', sec);
    buttons.forEach(function (b) {
      api.on(b, 'click', function () {
        var n = +b.getAttribute('data-score') || 3;
        buttons.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        if (out) out.textContent = n >= 4 ? GOOD : LESSON;
        onRate(n);
      });
    });
  }

  function init(sec, api) {
    var g = api.gsap, T = trees(sec);
    if (!T.length) return;
    setScore(T, 3);
    setPre(g, T);
    var flow = g.timeline({ paused: true }), good = g.timeline({ paused: true });
    T.forEach(function (R) { flow.add(flowTree(g, R), 0); good.add(goodTree(g, R), 0); });
    MP.blink(api.stage, api);
    window.ScrollTrigger.create({ trigger: api.stage, start: 'top 72%', once: true, onEnter: function () { if (flow.progress() === 0) flow.play(); } });
    wireRating(sec, api, function (n) {
      setScore(T, n);
      if (n >= 4) {
        if (flow.progress() > 0 && flow.progress() < 1) flow.progress(1);
        good.restart();
      } else {
        if (good.progress() > 0 && good.progress() < 1) good.progress(1);
        flow.restart();
      }
    });
  }

  /* Calm: the built (final) room stays; a good rating shows the card with its sparkles for ~2 s, then hides it
   * again (instant switches, no motion). The delayed hide lives in a context, so a mode switch kills it. */
  function final(sec, api) {
    var g = api.gsap, T = trees(sec);
    if (!T.length) return;
    setScore(T, 3);
    var ctx = g && g.context(function () {}), hide = null;
    function show(on) {
      T.forEach(function (R) { g.set([R.rate, R.rsp], { autoAlpha: on ? 1 : 0 }); });
    }
    wireRating(sec, api, function (n) {
      setScore(T, n);
      if (!g) return;
      if (hide) { hide.kill(); hide = null; }
      show(n >= 4);
      if (n >= 4) ctx.add(function () { hide = g.delayedCall(RATE_HOLD + 0.3, function () { hide = null; show(false); }); });
    });
  }

  MP.scene('pamyat', { build: build, init: init, final: final });
})();
