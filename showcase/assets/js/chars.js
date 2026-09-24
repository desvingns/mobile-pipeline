/* chars.js — the illustration kit: ONE character system for the «Просто» tab and the video.
 * Owned by the illustration package (docs/design-prosto.md §0 «Illustration API», brand.md §4).
 *
 * PURE string generators — no DOM access, safe in a Node vm with a fake `window = {MP:{}}`:
 *   MP.char(type, opts) -> '<g …>'   sticker character in a 120×140 box, origin top-left (no outer <svg>).
 *        opts: {x=0, y=0, scale=1, expr, variant, id, cls}
 *        expr: 'happy' | 'focus' | 'oh' | 'grumpy'  (bonus: 'sad'). Default 'happy'; pridira → 'grumpy'.
 *        variant: sovetnik → 'team' (default: three advisors) | 'speed' | 'glasses' | 'lock' | 'abacus' | 'umbrella'
 *                 master   → 'chief' (Главный мастер: star on the cap, mint neckerchief)
 *        Automat ids passed to MP.char are forwarded to MP.machine.
 *   MP.machine(type, opts) -> '<g …>'  automats, NO faces: vesy, strelochnik, poryadok, stend, pochtalon, zhurnal.
 *        opts: {x, y, scale, id, cls, lamp: 'mint'|'raspberry'|'sky'|'lemon'|'off'} — lamp = colour of the main
 *        lamp (.c-lamp--main). Lemon only while the factory waits for YOU.
 *   MP.plant(state, opts) -> '<g …>'   фиалка in a terracotta pot with a face; 'sad' | 'happy' | 'bloom'; 120×140.
 *   MP.phone(state, opts) -> '<g …>'   phone in a 140×260 box; 'blank' | 'list' | 'notify' (09:00) | 'notify-night'
 *        (03:00, moon) | 'app' (home screen with the «Полей меня» icon). Aliases: 'reminder-0900', 'reminder-0300'.
 *   MP.stampHand(opts) -> '<g …>'      lemon sleeve + hand holding the round lemon stamp «ОДОБРЕНО»; 120×140.
 *   MP.seal(opts) -> '<g …>'           round stamp imprint in a 100×100 box. opts {text='ОДОБРЕНО', fill=lemon, rotate=-12}
 *   (all of them take {x, y, scale, id, cls}; x/y = top-left of the box in the parent's user units. With x/y/scale the
 *    result is <g class="c-place" transform="…"><g class="c-char …">…</g></g>: animate the inner root — its GSAP
 *    x/y/scale/rotation are then relative to the placed spot.)
 * Data:
 *   MP.charTypes    all 24 ids in cast order: brigadir, razvedchik, syshchik, obkhodchik, pisar, sovetnik, pridira,
 *                   planirovshchik, khudozhnik, master, revizor, arkhitektor, ispytatel, priyomshchik, letopisets,
 *                   bibliotekar, ratsionalizator, vesy, strelochnik, poryadok, stend, pochtalon, zhurnal, vy
 *   MP.masterTypes (18 with faces: 17 masters + vy) · MP.machineTypes (6) · MP.charNames {id: 'Русское имя'}
 *   MP.charExprs · MP.charVariants · MP.charDefaults · MP.plantStates · MP.phoneStates · MP.charPalette
 * DOM helpers (guarded with typeof document; no-ops in Node):
 *   MP.charSVG(type, opts) -> SVGElement   standalone <svg class="c-svg" viewBox="0 0 120 140"> (cast cards).
 *   MP.artSVG(markup, viewBox, cls)        wrap any markup above (plant 0 0 120 140, phone 0 0 140 260, seal 0 0 100 100).
 *   MP.setExpr(el, expr)                   swap the face of a rendered character in place (el = .c-char or its <svg>).
 *   MP.blink(rootEl, api)                  deterministic blinking of every .c-lid in rootEl: ONE gsap timeline,
 *                                          registered through api.loop (plays only on screen). No-op in calm mode.
 * Debug: open the page with ?debug=chars → full-page gallery of the whole kit (+ geometry self-check warnings).
 *
 * Structure classes (transform-box: fill-box + origins in chars.css; GSAP reads them, no transformOrigin needed):
 *   .c-char root — bbox is EXACTLY the 120×140 box (origin 50% 100% = between the feet)
 *   .c-shadow floor ellipse · .c-legs · .c-body = everything above the legs (origin bottom-centre, for squash/bob)
 *   .c-face > .c-cheek, .c-brows, .c-eyes > .c-lid (one per eye, blink = scaleY .1) > .c-pupil; .c-mouth
 *   .c-arm-l / .c-arm-r rotate around the SHOULDER with origin 50% 50% (an invisible .c-pivot box centres the bbox
 *     on the shoulder). Arms hang down-outwards and sit BEHIND the body; to raise/wave use .c-arm-r rotation
 *     -70…-110 and .c-arm-l +70…+110 (beyond ±120 the hand hides behind the head), e.g.
 *     gsap.fromTo(arm, {rotation: -70}, {rotation: -105, duration: .25, yoyo: true, repeat: 5}). The .c-prop moves with it.
 *   GSAP note: chars.css hands elements back to transform-box:view-box once GSAP marks them (data-svg-origin),
 *     so gsap.set/to/fromTo with or without transformOrigin both pivot correctly. Outside the site (the video)
 *     inline assets/css/chars.css too — without it GSAP's SVG default origin is the bbox top-left.
 *   .c-hat (origin bottom-centre) · .c-prop (held or floating item; Рационализатор's bulb: .c-prop > .c-bulb + .c-rays)
 *   machines: .c-machine, .c-lamp (+ --mint/--raspberry/--sky/--lemon/--off, --main), .c-needle (pivot = centre),
 *     .c-gear (spin around centre), .c-lever (pivot = centre), .c-screen
 *   plant: .c-plant, .c-pot, .c-leaf (pivot = stem base), .c-stem, .c-flower, .c-bud, .c-sparkle, .c-drop + face classes
 *   phone: .c-phone, .ph-screen, .ph-notif (notification card), .ph-icon (app icon), .ph-time
 *   stamp: .c-stamphand > .c-sleeve, .c-hand, .c-stamp;  seal: .c-seal
 * No <defs>/ids are emitted (flat fills), so hundreds of instances never collide; opts.id only names the root.
 */
(function () {
  'use strict';
  var MP = window.MP = window.MP || {};

  /* ---------- palette (brand.md §2) ---------- */
  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', LEMON = '#FFDA4F', MINT = '#2BD99F',
    RASP = '#FF4F8B', SKY = '#3EC5FF', TANG = '#FF8A1F', STEEL = '#C9D3E6', STEEL_D = '#8E9BB8',
    WHITE = '#FFFFFF', TERRA = '#E2673A', TERRA_L = '#F08250', LEAF_D = '#1BB283', LEAF_SAD = '#8FD9B8',
    NIGHT = '#2C2472', INK_L = '#2D2768', LILAC = '#8F6BFF';
  MP.charPalette = { ink: INK, cream: CREAM, violet: VIOLET, lemon: LEMON, mint: MINT, raspberry: RASP, sky: SKY,
    tangerine: TANG, steel: STEEL, steelDark: STEEL_D, terracotta: TERRA, leafDark: LEAF_D, night: NIGHT };
  var LAMP = { mint: MINT, raspberry: RASP, sky: SKY, lemon: LEMON, off: STEEL_D };

  var FONT_T = "'Golos Text', 'Segoe UI', system-ui, sans-serif";
  var FONT_D = "Unbounded, 'Arial Black', system-ui, sans-serif";

  /* ---------- tiny markup helpers (strings only) ---------- */
  var NS = ' stroke="none"';
  function f(v) { return String(Math.round(v * 100) / 100); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function R(x, y, w, h, rx, fill, ex) {
    return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' +
      (rx ? ' rx="' + f(rx) + '"' : '') + ' fill="' + fill + '"' + (ex || '') + '/>';
  }
  function C(cx, cy, r, fill, ex) {
    return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + fill + '"' + (ex || '') + '/>';
  }
  function E(cx, cy, rx, ry, fill, ex) {
    return '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="' + fill + '"' + (ex || '') + '/>';
  }
  function P(d, fill, ex) { return '<path d="' + d + '" fill="' + fill + '"' + (ex || '') + '/>'; }
  /* stroke-only path */
  function L(d, color, w, ex) {
    return '<path d="' + d + '" fill="none"' + (color ? ' stroke="' + color + '"' : '') +
      (w ? ' stroke-width="' + w + '"' : '') + (ex || '') + '/>';
  }
  function G(cls, inner, ex) { return '<g' + (cls ? ' class="' + cls + '"' : '') + (ex || '') + '>' + inner + '</g>'; }
  function T(x, y, s, size, o) {
    o = o || {};
    return '<text x="' + f(x) + '" y="' + f(y) + '" font-family="' + (o.display ? FONT_D : FONT_T) + '" font-size="' +
      size + '" font-weight="' + (o.weight || 700) + '" fill="' + (o.fill || INK) + '" stroke="none"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + (o.ex || '') + '>' + esc(s) + '</text>';
  }
  function tr(x, y, rot, s) {
    return ' transform="translate(' + f(x) + ' ' + f(y) + ')' + (rot ? ' rotate(' + f(rot) + ')' : '') +
      (s && s !== 1 ? ' scale(' + f(s) + ')' : '') + '"';
  }
  function polar(cx, cy, r, a) { var t = a * Math.PI / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; }
  /* arc path; angles in degrees, clockwise from +x (SVG screen space) */
  function arcD(cx, cy, r, a0, a1) {
    var p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
    return 'M' + f(p0[0]) + ' ' + f(p0[1]) + 'A' + f(r) + ' ' + f(r) + ' 0 ' + ((a1 - a0) > 180 ? 1 : 0) + ' 1 ' +
      f(p1[0]) + ' ' + f(p1[1]);
  }
  /* closed polygon with rounded (quadratic) corners */
  function roundPoly(pts, rad) {
    var n = pts.length, d = '';
    for (var i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      var ax = p0[0] - p1[0], ay = p0[1] - p1[1], bx = p2[0] - p1[0], by = p2[1] - p1[1];
      var la = Math.sqrt(ax * ax + ay * ay), lb = Math.sqrt(bx * bx + by * by);
      var rr = Math.min(rad, la / 2, lb / 2);
      d += (i ? 'L' : 'M') + f(p1[0] + ax / la * rr) + ' ' + f(p1[1] + ay / la * rr) +
        'Q' + f(p1[0]) + ' ' + f(p1[1]) + ' ' + f(p1[0] + bx / lb * rr) + ' ' + f(p1[1] + by / lb * rr);
    }
    return d + 'Z';
  }
  function starD(cx, cy, r, ri) {
    var d = '';
    for (var i = 0; i < 10; i++) {
      var p = polar(cx, cy, i % 2 ? (ri || r * 0.46) : r, -90 + i * 36);
      d += (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1]);
    }
    return d + 'Z';
  }
  function sparkleD(cx, cy, r) {
    var k = r * 0.28;
    return 'M' + f(cx) + ' ' + f(cy - r) + 'Q' + f(cx + k) + ' ' + f(cy - k) + ' ' + f(cx + r) + ' ' + f(cy) +
      'Q' + f(cx + k) + ' ' + f(cy + k) + ' ' + f(cx) + ' ' + f(cy + r) + 'Q' + f(cx - k) + ' ' + f(cy + k) + ' ' +
      f(cx - r) + ' ' + f(cy) + 'Q' + f(cx - k) + ' ' + f(cy - k) + ' ' + f(cx) + ' ' + f(cy - r) + 'Z';
  }
  function gearG(cx, cy, r, fill, teeth, ex) {
    var n = teeth || 8, d = '', ri = r * 0.74, step = 360 / n;
    for (var i = 0; i < n; i++) {
      var a = i * step, pts = [polar(cx, cy, ri, a - step * 0.36), polar(cx, cy, r, a - step * 0.2),
        polar(cx, cy, r, a + step * 0.2), polar(cx, cy, ri, a + step * 0.36)];
      for (var j = 0; j < 4; j++) d += (i || j ? 'L' : 'M') + f(pts[j][0]) + ' ' + f(pts[j][1]);
    }
    return G('c-gear', P(d + 'Z', fill, ' stroke-width="3"') + C(cx, cy, r * 0.3, CREAM, ' stroke-width="3"'), ex);
  }
  function dropD(cx, top, h) { /* water drop: tip at (cx, top), height h */
    var r = h * 0.36, cy = top + h - r;
    return 'M' + f(cx) + ' ' + f(top) + 'C' + f(cx - r * 0.3) + ' ' + f(top + h * 0.28) + ' ' + f(cx - r) + ' ' +
      f(cy - r * 0.5) + ' ' + f(cx - r) + ' ' + f(cy) + 'A' + f(r) + ' ' + f(r) + ' 0 0 0 ' + f(cx + r) + ' ' + f(cy) +
      'C' + f(cx + r) + ' ' + f(cy - r * 0.5) + ' ' + f(cx + r * 0.3) + ' ' + f(top + h * 0.28) + ' ' + f(cx) + ' ' + f(top) + 'Z';
  }
  function pivot(cx, cy, hw, hh) {
    if (hh == null) hh = hw;
    return '<rect class="c-pivot" x="' + f(cx - hw) + '" y="' + f(cy - hh) + '" width="' + f(2 * hw) + '" height="' +
      f(2 * hh) + '" fill="none" stroke="none"/>';
  }
  function hl(d, col, w) { return L(d, col || CREAM, w || 4.5, ' class="c-hl"'); }

  /* ---------- the rig ---------- */
  var ROOT = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';
  var FRAME = '<rect class="c-frame" width="120" height="140" fill="none" stroke="none"/>';
  function shadow(rx, cy) {
    return '<ellipse class="c-shadow" cx="60" cy="' + (cy || 132) + '" rx="' + (rx || 34) + '" ry="5" fill="' + INK +
      '" fill-opacity=".15" stroke="none"/>';
  }
  function legs(y0, lx, rx) {
    y0 = y0 || 110; lx = lx || 49; rx = rx || 71;
    return G('c-legs', L('M' + lx + ' ' + y0 + 'V123M' + rx + ' ' + y0 + 'V123', null, 9) +
      E(lx - 2, 127.3, 9, 5.2, INK, NS) + E(rx + 2, 127.3, 9, 5.2, INK, NS) +
      E(lx - 4.5, 125.3, 2.6, 1.3, WHITE, NS + ' fill-opacity=".45"') + E(rx - 0.5, 125.3, 2.6, 1.3, WHITE, NS + ' fill-opacity=".45"'));
  }
  /* capsule arm from shoulder (sx,sy) to hand (hx,hy); o.prop is drawn under the hand, o.over above it */
  function arm(side, sx, sy, hx, hy, fill, o) {
    o = o || {};
    var hw = Math.min(sx, 120 - sx), hh = Math.min(sy, 140 - sy);
    var d = 'M' + f(sx) + ' ' + f(sy) + 'L' + f(hx) + ' ' + f(hy);
    var s = pivot(sx, sy, hw, hh) + L(d, null, 14) + L(d, fill, 6) +
      (o.prop ? G('c-prop', o.prop) : '') + (o.hand === false ? '' : C(hx, hy, 6.2, o.handFill || fill)) + (o.over || '');
    return { m: G('c-arm-' + side, s), front: !!o.front };
  }
  /* face: o = {y, cx=60, dx=11.5, mdy=13, expr, eye, glint, mouth, brow, cheek (null = none), cheekA, inverse} */
  function face(o) {
    var cx = o.cx == null ? 60 : o.cx, y = o.y, dx = o.dx || 11.5, ex = o.expr || 'happy';
    var my = y + (o.mdy || 13), s = '';
    if (o.cheek !== null) {
      var ca = ' class="c-cheek" stroke="none" fill-opacity="' + (o.cheekA || 0.5) + '"';
      s += E(cx - dx - 8, y + 8.5, 5.4, 3.2, o.cheek || RASP, ca) + E(cx + dx + 8, y + 8.5, 5.4, 3.2, o.cheek || RASP, ca);
    }
    if (o.brows !== false) {
      s += G('c-brows', brow(cx - dx, y, -1, ex) + brow(cx + dx, y, 1, ex), ' fill="none" stroke="' + (o.brow || INK) + '" stroke-width="3.2"');
    }
    s += G('c-eyes', eye(cx - dx, y, ex, o) + eye(cx + dx, y, ex, o), NS);
    s += G('c-mouth', mouth(cx, my, ex, o.mouth || INK));
    return G('c-face', s);
  }
  function brow(ex, ey, side, expr) {
    var ix = ex - side * 5.2, ox = ex + side * 5.2, by;
    if (expr === 'oh') { by = ey - 14.5; return '<path d="M' + f(ox) + ' ' + f(by + 2) + 'Q' + f(ex) + ' ' + f(by - 3) + ' ' + f(ix) + ' ' + f(by + 2) + '"/>'; }
    if (expr === 'focus') { by = ey - 9.5; return '<path d="M' + f(ox) + ' ' + f(by - 0.8) + 'L' + f(ix) + ' ' + f(by + 1.4) + '"/>'; }
    if (expr === 'grumpy') { by = ey - 9.2; return '<path d="M' + f(ox) + ' ' + f(by - 3.2) + 'L' + f(ix) + ' ' + f(by + 2.6) + '"/>'; }
    if (expr === 'sad') { by = ey - 10.5; return '<path d="M' + f(ox) + ' ' + f(by + 2) + 'L' + f(ix) + ' ' + f(by - 2.6) + '"/>'; }
    by = ey - 12;
    return '<path d="M' + f(ox) + ' ' + f(by + 1.6) + 'Q' + f(ex) + ' ' + f(by - 2.6) + ' ' + f(ix) + ' ' + f(by + 1.6) + '"/>';
  }
  function eye(ex, ey, expr, o) {
    var fill = o.eye || INK, gl = o.glint || WHITE, s;
    if (expr === 'grumpy') {
      s = P('M' + f(ex - 5.4) + ' ' + f(ey - 2) + 'H' + f(ex + 5.4) + 'A5.4 5.8 0 0 1 ' + f(ex - 5.4) + ' ' + f(ey - 2) + 'Z', fill, ' class="c-pupil"');
      s += o.inverse ? C(ex, ey + 1, 2.3, INK) : C(ex + 2, ey + 0.6, 1.6, gl);
    } else {
      var rx = 5.2, ry = 6.6;
      if (expr === 'oh') { rx = 6; ry = 7.9; } else if (expr === 'focus') { rx = 5.3; ry = 4.3; } else if (expr === 'sad') { ry = 6.1; }
      s = E(ex, ey, rx, ry, fill, ' class="c-pupil"');
      s += o.inverse ? C(ex, ey + (expr === 'sad' ? 2 : 1), expr === 'oh' ? 2.8 : 2.4, INK)
        : C(ex + 1.8, ey - ry * 0.38, expr === 'oh' ? 2.2 : (expr === 'focus' ? 1.5 : 1.9), gl);
    }
    return G('c-lid', s);
  }
  function mouth(mx, my, expr, col) {
    if (expr === 'oh') return E(mx, my + 2, 3.8, 4.6, col, NS);
    if (expr === 'focus') {
      return P('M' + f(mx + 1.2) + ' ' + f(my + 1.2) + 'q2.6 5.6 5.4 -0.1', RASP, ' stroke="' + col + '" stroke-width="2"') +
        L('M' + f(mx - 5.5) + ' ' + f(my + 1.6) + 'Q' + f(mx) + ' ' + f(my + 0.2) + ' ' + f(mx + 5.5) + ' ' + f(my + 1), col, 3.2);
    }
    if (expr === 'grumpy') return L('M' + f(mx - 6.5) + ' ' + f(my + 4) + 'Q' + f(mx) + ' ' + f(my - 2.6) + ' ' + f(mx + 6.5) + ' ' + f(my + 4), col, 3.2);
    if (expr === 'sad') return L('M' + f(mx - 5.5) + ' ' + f(my + 4) + 'Q' + f(mx) + ' ' + f(my - 1.2) + ' ' + f(mx + 5.5) + ' ' + f(my + 4), col, 3.2);
    var d = 'M' + f(mx - 8) + ' ' + f(my - 1.5) + 'Q' + f(mx) + ' ' + f(my + 11) + ' ' + f(mx + 8) + ' ' + f(my - 1.5) + 'Z';
    return P(d, col, ' stroke="' + col + '" stroke-width="2.5"') + E(mx, my + 3, 3.4, 1.6, RASP, NS) +
      P(d, 'none', ' stroke="' + col + '" stroke-width="2.5"');
  }
  /* assemble: frame · shadow · legs · .c-body(backmost, back arms, back, body, highlight, face, front, hat, front arms, top) */
  function rig(p) {
    var arms = [p.armL, p.armR], b = p.backmost || '', i;
    for (i = 0; i < 2; i++) if (arms[i] && !arms[i].front) b += arms[i].m;
    b += (p.back || '') + p.body + (p.hl || '') + (p.face || '') + (p.front || '') + (p.hat ? G('c-hat', p.hat) : '');
    for (i = 0; i < 2; i++) if (arms[i] && arms[i].front) b += arms[i].m;
    b += p.top || '';
    return FRAME + shadow(p.shadow) + (p.legs === false ? '' : (p.legs || legs())) + G('c-body', b);
  }

  /* ---------- shared props ---------- */
  function clipboard(x, y, w, h, rot, inner) {
    var cx = x + w / 2, cy = y + h / 2;
    return G('', R(x, y, w, h, 3, CREAM, ' stroke-width="3.5"') + inner + R(cx - 5.5, y - 4, 11, 7.5, 2.5, STEEL_D, ' stroke-width="3"'),
      ' transform="rotate(' + f(rot) + ' ' + f(cx) + ' ' + f(cy) + ')"');
  }
  function magnifier(cx, cy, r, hx, hy) {
    return L('M' + f(hx) + ' ' + f(hy) + 'L' + f(cx + (hx - cx) * (r + 2) / Math.sqrt((hx - cx) * (hx - cx) + (hy - cy) * (hy - cy))) + ' ' +
      f(cy + (hy - cy) * (r + 2) / Math.sqrt((hx - cx) * (hx - cx) + (hy - cy) * (hy - cy))), null, 7.5) +
      C(cx, cy, r, SKY, ' stroke-width="4.5" fill-opacity=".45"') +
      L('M' + f(cx - r * 0.55) + ' ' + f(cy - r * 0.05) + 'Q' + f(cx - r * 0.5) + ' ' + f(cy - r * 0.5) + ' ' + f(cx - r * 0.05) + ' ' + f(cy - r * 0.58), CREAM, 2.8);
  }

  /* ---------- characters ---------- */
  var DEF = {};

  DEF.brigadir = function (o) {
    var rows = '';
    for (var i = 0; i < 3; i++) {
      var yy = 89 + i * 7.5;
      rows += L('M98.5 ' + f(yy) + 'l2 2.2 3.8-4.4', INK, 2.3) + L('M106.5 ' + f(yy + 0.4) + 'h7', INK, 2.3, ' stroke-opacity=".5"');
    }
    return rig({
      body: R(27, 46, 66, 72, 28, VIOLET),
      hl: hl('M34.5 96Q33 76 39.5 63'),
      face: face({ y: 73, expr: o.expr, cheekA: 0.6 }),
      hat: P('M31 52C31 24 89 24 89 52Z', TANG) + hl('M39 45Q40.5 36 48 33', CREAM, 3.5) +
        R(22, 47, 76, 9.5, 4.75, TANG) + C(60, 40, 6.5, CREAM, ' stroke-width="3.2"') + C(60, 40, 2.6, SKY, NS),
      armL: arm('l', 34, 86, 21, 106, VIOLET),
      armR: arm('r', 86, 86, 99, 102, VIOLET, { prop: clipboard(94, 80, 23, 31, 8, rows) })
    });
  };

  DEF.razvedchik = function (o) {
    var bino = G('', R(-11, -16, 8, 7, 2, STEEL_D, ' stroke-width="2.8"') + R(3, -16, 8, 7, 2, STEEL_D, ' stroke-width="2.8"') +
      R(-14, -11, 12, 22, 5, INK_L, ' stroke-width="3.2"') + R(2, -11, 12, 22, 5, INK_L, ' stroke-width="3.2"') +
      R(-3.5, -5, 7, 8, 2, STEEL_D, ' stroke-width="2.6"') +
      C(-8, 5, 4.6, SKY, ' stroke-width="2.6"') + C(8, 5, 4.6, SKY, ' stroke-width="2.6"') +
      C(-9.4, 3.4, 1.4, WHITE, NS) + C(6.6, 3.4, 1.4, WHITE, NS), tr(101, 98, 6, 1.18));
    return rig({
      shadow: 28,
      legs: legs(114, 51, 69),
      body: C(60, 91, 30, SKY),
      hl: hl('M36 101Q34.5 90 39 81'),
      face: face({ y: 94, dx: 11, mdy: 12, expr: o.expr }),
      hat: P('M43 76C29 71 15 73 11 80C20 84 32 84 45 82Z', VIOLET) + P('M33 81C33 50 87 50 87 81Z', VIOLET) +
        L('M60 59V80', INK, 2.4, ' stroke-opacity=".45"') + hl('M71 60Q78 63 80 71', CREAM, 3.2) + C(60, 57.5, 3.6, TANG, ' stroke-width="3"'),
      armL: arm('l', 35, 100, 22, 113, SKY),
      armR: arm('r', 85, 100, 99, 113, SKY, { prop: bino })
    });
  };

  DEF.syshchik = function (o) {
    var mg = magnifier(103, 80, 12.5, 95, 106);
    return rig({
      body: R(34, 40, 52, 80, 26, TANG),
      hl: hl('M41 102Q39.5 86 42 76'),
      face: face({ y: 77, dx: 11, expr: o.expr }),
      hat: P('M37 58C28 58 20 61 15 67C25 69 34 67 41 63Z', RASP) + P('M83 58C92 58 100 61 105 67C95 69 86 67 79 63Z', RASP) +
        P('M33 61C33 30 87 30 87 61Z', RASP) +
        L('M47 38V60M60 34V61M73 38V60M34 50H86', INK, 1.7, ' stroke-opacity=".32"') +
        E(53.5, 35.5, 5.5, 3.2, RASP, ' stroke-width="3"') + E(66.5, 35.5, 5.5, 3.2, RASP, ' stroke-width="3"') + C(60, 36, 2.8, RASP, ' stroke-width="3"') +
        hl('M40 52Q41 44 46 40', CREAM, 3.2),
      armL: arm('l', 40, 92, 26, 110, TANG),
      armR: arm('r', 80, 92, 95, 106, TANG, { prop: mg })
    });
  };

  DEF.obkhodchik = function (o) {
    var phone = R(5.5, 97, 15, 25, 3.5, INK, ' stroke-width="3"') + R(8.5, 100.5, 9, 16, 1.5, SKY, NS) + C(13, 119.2, 1.2, CREAM, NS);
    var finger = L('M101 80L114.5 66.5', null, 8) + L('M101 80L114.5 66.5', STEEL, 2.6) + C(115, 66, 3.4, RASP, ' stroke-width="2.6"');
    return rig({
      body: R(53, 68, 14, 12, 0, STEEL_D, ' stroke-width="3.5"') + R(30, 76, 60, 44, 13, SKY) +
        R(42, 86, 36, 22, 6, STEEL, ' stroke-width="3.2"') +
        G('c-lamp c-lamp--mint c-lamp--main', C(52, 97, 4.4, MINT, ' stroke-width="2.6"')) +
        G('c-lamp c-lamp--raspberry', C(64, 97, 4.4, RASP, ' stroke-width="2.6"')) +
        L('M71 93v8', INK, 2.6) + C(36.5, 82.5, 1.7, INK, NS) + C(83.5, 82.5, 1.7, INK, NS) + C(36.5, 113.5, 1.7, INK, NS) + C(83.5, 113.5, 1.7, INK, NS) +
        C(33.5, 52, 4.8, STEEL, ' stroke-width="3.2"') + C(86.5, 52, 4.8, STEEL, ' stroke-width="3.2"') +
        R(36, 32, 48, 40, 13, SKY),
      hl: hl('M41.5 62Q40.5 48 46.5 40.5', CREAM, 4),
      face: face({ y: 51, dx: 10.5, mdy: 11.5, expr: o.expr }),
      hat: L('M60 32V19', null, 3.6) + C(60, 15, 5.2, RASP, ' stroke-width="3.2"') + C(58.3, 13.4, 1.5, WHITE, NS),
      armL: arm('l', 35, 88, 21, 106, SKY, { prop: phone }),
      armR: arm('r', 85, 88, 101, 80, SKY, { over: finger })
    });
  };

  DEF.pisar = function (o) {
    var scroll = R(5, 91, 21, 28, 0, CREAM, ' stroke-width="3"') +
      L('M9.5 99h12M9.5 105h12M9.5 111h8', INK, 2, ' stroke-opacity=".55"') +
      R(2.5, 86.5, 26, 7.5, 3.75, CREAM, ' stroke-width="3"') + R(2.5, 116.5, 26, 7.5, 3.75, CREAM, ' stroke-width="3"');
    var quill = P('M98.5 105C100 88 105 73 115 60C117.5 75 111 92 101 104Z', CREAM, ' stroke-width="3.2"') +
      L('M99 107C104.5 90 108.5 76 114 63', INK, 1.8) + L('M98.8 106L96.8 112.5', INK, 3.2) +
      L('M104 84l4 -1.5M103 92l3.5 -1', INK, 1.6, ' stroke-opacity=".5"');
    return rig({
      body: P('M60 46C82 46 92 66 92 90C92 109 80 120 60 120C40 120 28 109 28 90C28 66 38 46 60 46Z', MINT),
      hl: hl('M35.5 98Q34 80 41.5 67'),
      face: face({ y: 79, expr: o.expr }),
      hat: P('M32 57C26 44 47 35 66 36C85 37 95 46 88 56C75 61 45 62 32 57Z', VIOLET) + L('M62 36L64 29.5', null, 4.5) +
        hl('M41 48Q48 42 57 40.5', CREAM, 3.2),
      armL: arm('l', 34, 92, 21, 106, MINT, { prop: scroll }),
      armR: arm('r', 86, 92, 100, 103, MINT, { prop: quill })
    });
  };

  /* Советники: small cream advisors with 5 props */
  var ADV = ['speed', 'glasses', 'lock', 'abacus', 'umbrella'];
  function advisor(o, v) {
    var fc = CREAM, propR = '', front = '', backmost = '';
    if (v === 'speed') {
      propR = C(101, 93, 12, CREAM, ' stroke-width="3.5"') +
        L(arcD(101, 93, 7.5, 200, 285), MINT, 3.4) + L(arcD(101, 93, 7.5, 285, 315), TANG, 3.4) + L(arcD(101, 93, 7.5, 315, 340), RASP, 3.4) +
        G('c-needle', pivot(101, 93, 9) + L('M101 93L105.5 84.5', INK, 2.8)) + C(101, 93, 2.4, INK, NS);
    } else if (v === 'glasses') {
      front = C(50, 95, 8.5, SKY, ' stroke-width="3" fill-opacity=".28"') + C(70, 95, 8.5, SKY, ' stroke-width="3" fill-opacity=".28"') +
        L('M58.5 94Q60 91.5 61.5 94', INK, 3);
      propR = R(90, 80, 24, 25, 4, WHITE, ' stroke-width="3.2"') + T(102, 97.5, 'Аа', 12.5, { weight: 900, anchor: 'middle' });
    } else if (v === 'lock') {
      propR = L('M96 88V82.5a6 6 0 0 1 12 0V88', null, 7.5) + L('M96 88V82.5a6 6 0 0 1 12 0V88', STEEL, 3) +
        R(91, 87, 22, 18, 4.5, TANG, ' stroke-width="3.4"') + C(102, 94.3, 2.4, INK, NS) + R(101.1, 95, 1.8, 5.2, 0.9, INK, NS);
    } else if (v === 'abacus') {
      var beads = [[92, 87, MINT], [97, 87, MINT], [108, 87, SKY], [92, 93.5, RASP], [103, 93.5, TANG], [108, 93.5, TANG],
        [92, 100, VIOLET], [97, 100, VIOLET], [102, 100, VIOLET]];
      propR = R(87.5, 80, 26, 27, 3.5, CREAM, ' stroke-width="3.4"') + L('M89 87H112M89 93.5H112M89 100H112', INK, 1.8);
      for (var i = 0; i < beads.length; i++) propR += C(beads[i][0], beads[i][1], 2.6, beads[i][2], ' stroke-width="1.6"');
    } else if (v === 'umbrella') {
      backmost = G('c-prop c-umbrella',
        L('M94 64V110', null, 3.6) +
        P('M71 64Q71 41 94 39Q117 41 117 64Q111.25 59.5 105.5 64Q99.75 59.5 94 64Q88.25 59.5 82.5 64Q76.75 59.5 71 64Z', RASP) +
        L('M94 40L82.5 64M94 40L105.5 64', INK, 2, ' stroke-opacity=".35"') + L('M94 39V34', null, 3.4) +
        hl('M76.5 56Q79.5 48 86.5 45', CREAM, 3));
    }
    return rig({
      shadow: 27,
      legs: legs(112, 51, 69),
      backmost: backmost,
      body: C(60, 95, 25, fc),
      hl: hl('M40.5 104Q39 95 43 87.5', WHITE, 4),
      face: face({ y: 95, dx: 10, mdy: 11.5, expr: o.expr }),
      front: front,
      hat: L('M57 70.5C54 63 60.5 59 64.5 63', null, 3.6),
      armL: arm('l', 39, 101, 27, 113, fc),
      armR: arm('r', 81, 101, 95, 108, fc, propR ? { prop: propR } : null)
    });
  }
  DEF.sovetnik = function (o) {
    var v = o.variant;
    if (ADV.indexOf(v) >= 0) return advisor(o, v);
    /* 'team': three advisors — back-left abacus, back-right umbrella, front speedometer */
    function sub(vv, x, y, s) { return G('', G('c-sub c-sovetnik--' + vv, advisor(o, vv)), tr(x, y, 0, s)); }
    return FRAME + sub('abacus', 0, 16, 0.6) + sub('umbrella', 48, 14, 0.6) + sub('speed', 18, 45, 0.675);
  };

  DEF.pridira = function (o) {
    var pencil = G('', R(-4.8, -26, 9.6, 34, 1.5, RASP, ' stroke-width="3"') + L('M0 -24V6', INK, 1.5, ' stroke-opacity=".35"') +
      P('M-4.8 -26L0 -38.5L4.8 -26Z', CREAM, ' stroke-width="3"') + P('M-1.7 -33.4L0 -38.5L1.7 -33.4Z', INK, NS) +
      R(-4.8, 5, 9.6, 5.5, 1, STEEL, ' stroke-width="3"'), tr(101, 99, 16));
    return rig({
      body: P(roundPoly([[60, 26], [101, 120], [19, 120]], 15), RASP),
      hl: hl('M31 106Q35 94 40.5 83'),
      face: face({ y: 89, dx: 11, expr: o.expr, cheek: CREAM, cheekA: 0.55 }),
      front: C(71, 89, 9.6, CREAM, ' stroke-width="3.2" fill-opacity=".32"') + L('M79 94.5Q85.5 104 79 113', INK, 1.8),
      hat: L('M60 29C55 20 63.5 15 66.5 21.5', null, 3.8),
      armL: arm('l', 36, 100, 23, 113, RASP),
      armR: arm('r', 84, 100, 100, 99, RASP, { prop: pencil })
    });
  };

  DEF.planirovshchik = function (o) {
    var scissors = G('', P('M-1.5 1L-8 -21Q-4.5 -22.5 -2 -19.5L2 -1Z', STEEL, ' stroke-width="2.8"') +
      P('M1.5 1L10 -19.5Q13 -18 12 -14.5L-1 1.5Z', STEEL, ' stroke-width="2.8"') +
      L('M-2 3.5L-6 10M2 3.5L6 10', null, 3.5) + C(-7.5, 13, 4.6, 'none', ' stroke-width="7"') + C(-7.5, 13, 4.6, 'none', ' stroke="' + RASP + '" stroke-width="2.6"') +
      C(7.5, 13, 4.6, 'none', ' stroke-width="7"') + C(7.5, 13, 4.6, 'none', ' stroke="' + RASP + '" stroke-width="2.6"') +
      C(0, 1.5, 1.8, INK, NS), tr(102, 88, 14));
    function card(x, y, rot, fill, pin) {
      return G('', R(-7, -8, 14, 16, 2, fill, ' stroke-width="2.6"') + L('M-3.5 -1.5h7M-3.5 3h5', INK, 1.7, ' stroke-opacity=".5"') +
        C(0, -6.2, 2.3, pin, ' stroke-width="1.8"'), tr(x, y, rot));
    }
    var held = card(15, 86, -12, CREAM, RASP);
    var board = R(36, 80, 48, 33, 6, CREAM, ' stroke-width="3.2"') +
      card(46, 96.5, -7, SKY, RASP) + card(60, 95.5, 4, TANG, MINT) + card(74, 97, -4, RASP, SKY);
    return rig({
      body: R(28, 40, 64, 80, 18, MINT),
      hl: hl('M35 72Q34 56 40 47.5'),
      face: face({ y: 60, mdy: 12, expr: o.expr }),
      front: board,
      hat: P('M33 42L60 13L87 42Z', CREAM, ' stroke-width="3.8"') + L('M60 16V41', INK, 1.8, ' stroke-opacity=".35"') +
        L('M49 38l7 -9', STEEL_D, 2) + C(48.5, 38.5, 3.2, RASP, ' stroke-width="2.6"'),
      armL: arm('l', 34, 82, 20, 98, MINT, { prop: held }),
      armR: arm('r', 86, 82, 99, 95, MINT, { prop: scissors })
    });
  };

  DEF.khudozhnik = function (o) {
    var palette = P('M3 101C3 92 12 88 20 89C28 90 32 95 31 100C30 104 26 103 25 106C24 110 27 113 20 113C11 113 3 109 3 101Z', CREAM, ' stroke-width="3.2"') +
      C(9.5, 97, 2.8, VIOLET, ' stroke-width="1.8"') + C(16, 94, 2.8, MINT, ' stroke-width="1.8"') + C(23, 95, 2.8, SKY, ' stroke-width="1.8"') +
      C(9, 105, 2.8, TANG, ' stroke-width="1.8"');
    var brush = G('', R(-2.6, -30, 5.2, 36, 2.6, TANG, ' stroke-width="2.6"') + R(-3.6, -37, 7.2, 8, 1.5, STEEL, ' stroke-width="2.6"') +
      P('M-3.6 -37Q-4.6 -45 0 -51Q4.6 -45 3.6 -37Z', SKY, ' stroke-width="2.6"'), tr(98, 100, 17));
    return rig({
      body: R(30, 48, 60, 72, 30, RASP) + C(76, 109, 4, SKY, ' stroke-width="2.6"') + C(82.5, 104, 1.8, SKY, ' stroke-width="1.8"'),
      hl: hl('M37 99Q35.5 82 41.5 69'),
      face: face({ y: 81, expr: o.expr, cheek: CREAM, cheekA: 0.55 }),
      hat: P('M23 64C16 50 38 34 63 35C86 36 99 46 90 57C80 62 64 58 52 60C40 62 30 71 23 64Z', VIOLET) + L('M63 35L65.5 28.5', null, 4.5) +
        hl('M33 52Q40 43 51 40', CREAM, 3.2),
      armL: arm('l', 35, 93, 23, 104, RASP, { prop: palette }),
      armR: arm('r', 85, 93, 99, 97, RASP, { prop: brush })
    });
  };

  DEF.master = function (o) {
    var chief = o.variant === 'chief';
    var wrench = G('', P('M-3 -37.9V-31H3V-37.9A8.5 8.5 0 1 1 -3 -37.9Z', STEEL, ' stroke-width="3.2"') +
      R(-3.4, -24, 6.8, 29, 3.4, STEEL, ' stroke-width="3.2"'), tr(101, 99, 14));
    return rig({
      body: R(28, 48, 64, 70, 22, TANG) +
        (chief ? P('M41 100Q60 106 79 100L60 117Z', MINT, ' stroke-width="3.2"') + C(60, 103.5, 3.4, MINT, ' stroke-width="2.8"') : ''),
      hl: hl('M35 98Q34 80 40 67'),
      face: face({ y: chief ? 77 : 77, expr: o.expr, mdy: 13 }),
      hat: P('M31 60C31 31 89 31 89 60Z', VIOLET) + P('M25 60Q60 53 95 60Q96 66 89 66.5Q60 62 31 66.5Q24 66 25 60Z', VIOLET) +
        L('M33 50H87', null, 3.5) + C(49, 50, 7.3, SKY, ' stroke-width="3.4"') + C(71, 50, 7.3, SKY, ' stroke-width="3.4"') +
        C(47, 47.8, 1.8, CREAM, NS) + C(69, 47.8, 1.8, CREAM, NS) +
        (chief ? P(starD(60, 31, 10), CREAM, ' stroke-width="3.2"') : hl('M38 51Q39 43 45 39', CREAM, 3)),
      armL: arm('l', 34, 90, 21, 106, TANG),
      armR: arm('r', 86, 90, 99, 97, TANG, { prop: wrench })
    });
  };

  DEF.revizor = function (o) {
    var mg = magnifier(15, 80, 11, 25, 101);
    var cards = G('', R(-9, -12, 18, 23, 3, CREAM, ' stroke-width="3"') + T(0, 6, '1', 14, { display: true, weight: 800, anchor: 'middle' }), tr(95, 86, -9)) +
      G('', R(-9, -12, 18, 23, 3, CREAM, ' stroke-width="3"') + T(0, 6, '2', 14, { display: true, weight: 800, anchor: 'middle' }), tr(107, 90, 9));
    return rig({
      legs: legs(110, 52, 68),
      body: R(36, 40, 48, 80, 21, VIOLET),
      hl: hl('M42 108Q40.5 94 42.5 84'),
      face: face({ y: 64, dx: 10.5, mdy: 15, expr: o.expr, cheekA: 0.6 }),
      front: P('M60 72C56 67.5 48.5 68 45 73.5C49 72.5 54 75 60 74.5C66 75 71 72.5 75 73.5C71.5 68 64 67.5 60 72Z', INK, NS),
      hat: R(29, 37.5, 62, 8, 4, INK) + R(40, 8, 40, 33, 4, INK) + R(40, 29, 40, 7, 0, RASP, ' stroke-width="3"') +
        L('M46 14V24', CREAM, 3.2, ' stroke-opacity=".6"'),
      armL: arm('l', 41, 86, 26, 102, VIOLET, { prop: mg }),
      armR: arm('r', 79, 86, 95, 99, VIOLET, { prop: cards })
    });
  };

  DEF.arkhitektor = function (o) {
    var roll = G('', R(-18, -6, 36, 12, 6, SKY, ' stroke-width="3.2"') + L('M-8 -6V6M2 -6V6', INK, 1.5, ' stroke-opacity=".4"') +
      E(16.5, 0, 3.4, 6, CREAM, ' stroke-width="2.6"') + C(16.5, 0, 1.2, INK, NS), tr(17, 105, -52));
    var square = P('M93 118V89L116 118Z', CREAM, ' stroke-width="3.2"') + P('M98 112.5V101.5L107 112.5Z', 'none', ' stroke-width="2.2"') +
      L('M95 95h3M95 101h3M95 107h3', INK, 1.6);
    return rig({
      body: R(75, 33, 11, 20, 2, INK_L) + R(73, 30, 15, 6, 2, INK_L) +
        P(roundPoly([[60, 32], [95, 62], [95, 120], [25, 120], [25, 62]], 11), INK_L),
      hl: hl('M32.5 108V73L45 62', CREAM, 3.6),
      face: face({ y: 82, dx: 12, mdy: 14, expr: o.expr, eye: CREAM, inverse: true, mouth: CREAM, brow: CREAM, cheekA: 0.7 }),
      armL: arm('l', 31, 94, 19, 108, INK_L, { prop: roll }),
      armR: arm('r', 89, 94, 101, 108, INK_L, { prop: square })
    });
  };

  DEF.ispytatel = function (o) {
    var watch = L('M104 75V71', null, 5) + R(100.5, 67.5, 7, 5.5, 1.5, STEEL, ' stroke-width="2.8"') +
      C(104, 87, 11.5, CREAM, ' stroke-width="4"') + L('M104 78.5v2.5M112.5 87h-2.5M104 95.5v-2.5M95.5 87h2.5', INK, 2) +
      G('c-needle', pivot(104, 87, 8) + L('M104 87L108.5 81', RASP, 2.8)) + C(104, 87, 2, INK, NS);
    return rig({
      body: P('M49 36H71V58L93 106Q98 120 84 120H36Q22 120 27 106L49 58Z', MINT) + C(57, 50, 2.6, CREAM, NS) + C(63.5, 43.5, 1.8, CREAM, NS) +
        C(59, 38.5, 1.3, CREAM, NS),
      hl: hl('M34.5 106L43 88'),
      face: face({ y: 88, dx: 11, mdy: 14, expr: o.expr }),
      front: L('M30 87H90', null, 3) + R(38, 79, 20, 17, 7, SKY, ' stroke-width="3.4" fill-opacity=".4"') +
        R(62, 79, 20, 17, 7, SKY, ' stroke-width="3.4" fill-opacity=".4"') + L('M58 86H62', null, 3.4),
      hat: R(44, 30, 32, 9, 4.5, MINT),
      armL: arm('l', 37, 98, 23, 111, MINT),
      armR: arm('r', 83, 98, 97, 101, MINT, { prop: watch })
    });
  };

  DEF.priyomshchik = function (o) {
    var boxes = '';
    for (var r = 0; r < 3; r++) for (var c = 0; c < 2; c++) {
      var bx = 99 + c * 9.5, by = 83 + r * 7.5;
      boxes += R(bx, by, 5.5, 5.5, 1, WHITE, ' stroke-width="1.8"');
      if (r * 2 + c < 4) boxes += L('M' + f(bx + 1) + ' ' + f(by + 2.8) + 'l1.6 1.8 3.4 -4.2', INK, 1.9);
    }
    var plug = L('M17 104C14 121 4 125 8 132.5C11.5 138 22 136 30 133', null, 3.6) +
      L('M16 90V83.5M22 90V83.5', null, 3.2) + R(11, 89, 16, 14, 3.5, STEEL, ' stroke-width="3.2"');
    return rig({
      body: P('M28 112V78A32 32 0 0 1 92 78V112Q92 120 84 120H36Q28 120 28 112Z', SKY),
      hl: hl('M35 102Q34 84 40.5 71'),
      face: face({ y: 81, expr: o.expr }),
      hat: L('M26 78C26 34 94 34 94 78', null, 5.5) + R(19, 67, 13, 21, 5.5, VIOLET, ' stroke-width="3.5"') +
        R(88, 67, 13, 21, 5.5, VIOLET, ' stroke-width="3.5"') + L('M25.5 85Q27.5 99 43 98.5', null, 3) + C(45.5, 98.5, 3.6, RASP, ' stroke-width="2.6"'),
      armL: arm('l', 33, 98, 19, 110, SKY, { prop: plug }),
      armR: arm('r', 87, 98, 99, 104, SKY, { prop: clipboard(95, 77, 23, 31, 6, boxes) })
    });
  };

  DEF.letopisets = function (o) {
    var book = R(3, 84, 29, 36, 4, VIOLET, ' stroke-width="3.5"') + R(28.5, 86.5, 6.5, 31, 1.5, CREAM, ' stroke-width="3"') +
      L('M30.8 91.5V112.5M32.8 91.5V112.5', INK, 1, ' stroke-opacity=".45"') + L('M8.5 93H26M8.5 111H26', CREAM, 2.6) +
      P('M17 118.5V127.5L19.5 125L22 127.5V118.5Z', TANG, ' stroke-width="2.2"');
    var hourglass = R(95, 78, 22, 4.5, 2, VIOLET, ' stroke-width="2.8"') + R(95, 107.5, 22, 4.5, 2, VIOLET, ' stroke-width="2.8"') +
      P('M98.5 82.5H113.5C113.5 90 106 92 106 95C106 98 113.5 100 113.5 107.5H98.5C98.5 100 106 98 106 95C106 92 98.5 90 98.5 82.5Z', CREAM, ' stroke-width="2.8"') +
      P('M101 105.5C102 101.5 104.5 99.5 106 99C107.5 99.5 110 101.5 111 105.5Z', TANG, NS) + L('M106 94.5V100', TANG, 1.6);
    return rig({
      body: P('M60 40C80 40 90 62 90 86C90 108 78 120 60 120C42 120 30 108 30 86C30 62 40 40 60 40Z', CREAM),
      hl: hl('M36.5 94Q35.5 76 42 63', WHITE, 4.5),
      face: face({ y: 70, dx: 11, mdy: 12.5, expr: o.expr }),
      front: P('M40.5 85C42 104 50 115 60 116C70 115 78 104 79.5 85C73 91 67 88.5 60 92.5C53 88.5 47 91 40.5 85Z', STEEL, ' stroke-width="3.4"') +
        L('M52 100Q55 106 58 101M62 103Q65 109 68 103', INK, 1.8, ' stroke-opacity=".35"'),
      hat: P('M41 51C41 34 79 34 79 51Q60 45 41 51Z', SKY) + C(60, 35.5, 3.4, TANG, ' stroke-width="2.8"'),
      armL: arm('l', 35, 92, 24, 104, CREAM, { prop: book }),
      armR: arm('r', 85, 92, 99, 103, CREAM, { prop: hourglass })
    });
  };

  DEF.bibliotekar = function (o) {
    var drawer = R(94, 83, 9, 12, 1.5, CREAM, ' stroke-width="2.4"') + R(94, 83, 9, 3.6, 1.2, SKY, ' stroke-width="2.4"') +
      R(103.5, 81, 9, 14, 1.5, CREAM, ' stroke-width="2.4"') + R(106.5, 81, 6, 3.6, 1.2, RASP, ' stroke-width="2.4"') +
      R(90, 91, 28, 21, 4, TANG, ' stroke-width="3.4"') + R(98, 99.5, 12, 4.6, 2.3, CREAM, ' stroke-width="2.2"');
    var card = G('', R(-10, -7.5, 20, 15, 2.5, CREAM, ' stroke-width="2.8"') + R(-10, -7.5, 20, 4.5, 2, MINT, ' stroke-width="2.8"') +
      L('M-6 1.5h12M-6 5h8', INK, 1.7, ' stroke-opacity=".5"'), tr(17, 90, -10));
    return rig({
      body: P('M60 42C80 42 88 58 88 78L90 108Q92 120 80 120H40Q28 120 30 108L32 78C32 58 40 42 60 42Z', VIOLET),
      hl: hl('M37 104Q36 88 39.5 80'),
      face: face({ y: 72, dx: 12, mdy: 14, expr: o.expr, cheekA: 0.6 }),
      front: C(48, 72, 9.4, CREAM, ' stroke-width="3" fill-opacity=".38"') + C(72, 72, 9.4, CREAM, ' stroke-width="3" fill-opacity=".38"') +
        L('M57.4 71Q60 68 62.6 71M38.6 70L33.5 67.5M81.4 70L86.5 67.5', INK, 3),
      hat: P('M30.5 70C29 50 41 38.5 60 38.5C79 38.5 91 50 89.5 70C86 62 80 57.5 72 58.5C66 52.5 56 51.5 49 55.5C42 55 34.5 60.5 30.5 70Z', INK_L) +
        hl('M40 50Q46 43.5 55 42.5', STEEL, 2.6) +
        P('M73 44.5L81.5 38.5L82.5 49Z', TANG, ' stroke-width="2.8"') + P('M73 44.5L66 37L64 47.5Z', TANG, ' stroke-width="2.8"') + C(73, 44.5, 3, TANG, ' stroke-width="2.6"'),
      armL: arm('l', 34, 88, 21, 101, VIOLET, { prop: card }),
      armR: arm('r', 86, 88, 97, 104, VIOLET, { prop: drawer })
    });
  };

  DEF.ratsionalizator = function (o) {
    var bulb = G('c-prop c-idea',
      G('c-rays', L('M60 5.5V0.5M41.5 13L38 9.5M78.5 13L82 9.5M35 30H30M85 30H90M41.5 46.5L38 50M78.5 46.5L82 50', null, 3.6)) +
      G('c-bulb', C(60, 29, 13.5, CREAM) + L('M54.5 31Q57.2 25 60 31Q62.8 37 65.5 31', TANG, 2.6) + hl('M51 26Q52 20 57 18.5', WHITE, 2.8)) +
      R(53.5, 40.5, 13, 9, 2, STEEL, ' stroke-width="3.2"') + L('M54 44.5h12', INK, 1.8));
    return rig({
      body: C(60, 89, 31.5, TANG),
      hl: hl('M36 97Q35 80 44 68'),
      face: face({ y: 89, expr: o.expr }),
      top: bulb,
      armL: arm('l', 35, 86, 22, 65, TANG, { over: L('M20.5 62L19.5 52.5', null, 8.5) + L('M20.5 62L19.5 52.5', TANG, 2.6) }),
      armR: arm('r', 85, 98, 99, 110, TANG, { prop: gearG(105, 104, 9.5, STEEL, 8) })
    });
  };

  DEF.vy = function (o) {
    var stamp = R(96.5, 104, 21, 8, 3, LEMON, ' stroke-width="3.2"') + R(97.5, 111, 19, 4.5, 1.5, INK, NS) +
      R(103.5, 90, 7, 15, 2, LEMON, ' stroke-width="3"') + C(107, 87, 6.5, LEMON, ' stroke-width="3.2"');
    return rig({
      body: C(60, 89, 31.5, LEMON),
      hl: hl('M36 97Q35 80 44 68', WHITE, 4),
      face: face({ y: 89, expr: o.expr }),
      hat: P('M39.5 62L37 39L50.5 50L60 33L69.5 50L83 39L80.5 62Q60 57 39.5 62Z', VIOLET) +
        C(37, 39, 3, CREAM, ' stroke-width="2.6"') + C(60, 33, 3.2, CREAM, ' stroke-width="2.6"') + C(83, 39, 3, CREAM, ' stroke-width="2.6"') +
        C(60, 53, 2.6, RASP, ' stroke-width="2.2"'),
      armL: arm('l', 34, 96, 22, 110, LEMON),
      armR: arm('r', 86, 94, 103, 92, LEMON, { prop: stamp })
    });
  };

  /* ---------- automats (no faces) ---------- */
  var MDEF = {};
  function lampG(cx, cy, r, color, extra) {
    return G('c-lamp c-lamp--' + color + (extra ? ' ' + extra : ''),
      C(cx, cy, r, LAMP[color] || MINT, ' stroke-width="3"') + (color === 'off' ? '' : C(cx - r * 0.32, cy - r * 0.34, r * 0.28, WHITE, NS)));
  }
  function rivets(pts) { var s = ''; for (var i = 0; i < pts.length; i++) s += C(pts[i][0], pts[i][1], 1.9, INK, NS); return s; }
  function feet() { return G('c-legs', R(27, 119, 17, 11, 4, INK, NS) + R(76, 119, 17, 11, 4, INK, NS)); }
  function mrig(inner, sh) { return FRAME + shadow(sh || 40) + inner; }
  function needle(cx, cy, len, ang, col) {
    var t = polar(cx, cy, len, ang), b1 = polar(cx, cy, 3, ang + 90), b2 = polar(cx, cy, 3, ang - 90);
    return G('c-needle', pivot(cx, cy, len + 1) + P('M' + f(b1[0]) + ' ' + f(b1[1]) + 'L' + f(t[0]) + ' ' + f(t[1]) + 'L' + f(b2[0]) + ' ' + f(b2[1]) + 'Z', col || RASP, ' stroke-width="2.4"'));
  }
  function dial(cx, cy, r, ang, zones) {
    var s = C(cx, cy, r, CREAM, ' stroke-width="4"');
    if (zones) s += L(arcD(cx, cy, r * 0.72, 200, 280), MINT, r * 0.2) + L(arcD(cx, cy, r * 0.72, 280, 312), TANG, r * 0.2) + L(arcD(cx, cy, r * 0.72, 312, 340), RASP, r * 0.2);
    for (var a = 200; a <= 340; a += 35) {
      var p0 = polar(cx, cy, r * 0.5, a), p1 = polar(cx, cy, r * 0.6, a);
      s += L('M' + f(p0[0]) + ' ' + f(p0[1]) + 'L' + f(p1[0]) + ' ' + f(p1[1]), INK, 1.8);
    }
    return s + needle(cx, cy, r * 0.78, ang) + C(cx, cy, r * 0.16 + 1.5, INK, NS);
  }

  MDEF.vesy = function (o) {
    return mrig(feet() + G('c-body',
      R(55, 56, 10, 28, 2, STEEL_D, ' stroke-width="3.5"') +
      dial(60, 40, 24, 250, true) +
      R(20, 88, 80, 33, 9, STEEL) + R(28, 95, 42, 19, 5, SKY, ' stroke-width="3.2"') +
      L('M34 104.5h8M46 104.5h8M58 104.5h6', INK, 3, ' stroke-opacity=".55"') +
      lampG(82, 104.5, 5.8, o.lamp || 'mint', 'c-lamp--main') + lampG(93.5, 104.5, 3.6, 'off') +
      rivets([[25.5, 93.5], [94.5, 93.5], [25.5, 115.5], [94.5, 115.5]]) +
      R(11, 80, 98, 10, 5, STEEL) + hl('M18 84.5H40', CREAM, 3) +
      hl('M41 33Q43.5 23.5 52 20', CREAM, 3)));
  };

  MDEF.strelochnik = function (o) {
    var lever = G('c-lever', pivot(44, 64, 37) + L('M44 64L30 38', null, 6.5) + L('M44 64L30 38', STEEL, 2) + C(29, 36, 6.5, RASP, ' stroke-width="3.4"') + C(27.2, 34.3, 1.8, WHITE, NS));
    return mrig(feet() + G('c-body',
      lever + R(35, 58, 18, 10, 3, STEEL_D, ' stroke-width="3.2"') +
      L('M88 62V34', null, 5) + R(79, 12, 18, 29, 9, INK) +
      lampG(88, 20.5, 4.6, o.lamp || 'mint', 'c-lamp--main') + lampG(88, 32.5, 4.6, 'raspberry') +
      R(22, 62, 76, 58, 10, STEEL) + gearG(86, 84, 10, STEEL_D, 8) +
      R(30, 72, 42, 38, 6, SKY, ' stroke-width="3.2"') +
      L('M51 105V92L40 80M51 92L62 80', null, 4) + P('M36 76.5L44 77.5L37 84.5Z', INK, ' stroke-width="1.6"') + P('M66 76.5L58 77.5L65 84.5Z', INK, ' stroke-width="1.6"') +
      rivets([[27.5, 67.5], [92.5, 67.5], [27.5, 114.5], [92.5, 114.5], [86, 107]]) +
      hl('M28 68.5V88', CREAM, 3)));
  };

  MDEF.poryadok = function (o) {
    var items = R(33, 50, 8, 14, 1.5, SKY, ' stroke-width="2.4"') + R(42, 52, 8, 12, 1.5, TANG, ' stroke-width="2.4"') +
      R(64, 49, 17, 15, 2, MINT, ' stroke-width="2.4"') +
      C(38, 81.5, 5, RASP, ' stroke-width="2.4"') + C(49.5, 81.5, 5, VIOLET, ' stroke-width="2.4"') +
      R(64, 76, 8, 11, 1.5, SKY, ' stroke-width="2.4"') + R(73, 76, 8, 11, 1.5, SKY, ' stroke-width="2.4"') +
      R(33, 96, 20, 9, 2, TANG, ' stroke-width="2.4"') + R(64, 93, 8, 12, 1.5, MINT, ' stroke-width="2.4"') + R(73, 95, 8, 10, 1.5, RASP, ' stroke-width="2.4"');
    return mrig(feet() + G('c-body',
      R(58, 12, 4, 10, 1, STEEL_D, NS) + lampG(60, 11, 6.2, o.lamp || 'mint', 'c-lamp--main') +
      R(22, 32, 76, 89, 9, STEEL) + R(29, 20, 62, 11, 5.5, SKY, ' stroke-width="3.4"') + L('M35 25.5H85', CREAM, 2.4, ' stroke-opacity=".8"') +
      R(29, 42, 56, 67, 3, CREAM, ' stroke-width="3.4"') + L('M57 42V109M29 64.3H85M29 86.6H85', null, 3.4) + items +
      lampG(91.5, 53, 3.4, 'mint') + lampG(91.5, 75.5, 3.4, 'mint') + lampG(91.5, 98, 3.4, 'mint') +
      rivets([[26.5, 37], [93.5, 37], [26.5, 115.5], [93.5, 115.5]]) + hl('M25.5 44V60', CREAM, 3)));
  };

  MDEF.stend = function (o) {
    return mrig(feet() + G('c-body',
      L('M106 99C117 102 118 118 108 125', null, 3.4) +
      R(47, 49, 26, 9, 2, STEEL_D, ' stroke-width="3.2"') +
      G('c-lamp c-lamp--raspberry c-siren', P('M49.5 49C49.5 33 70.5 33 70.5 49Z', o.lamp === 'off' ? STEEL_D : RASP, ' stroke-width="3.4"') + hl('M54 44Q55 38.5 59 37', WHITE, 2.4)) +
      R(12, 57, 96, 63, 10, STEEL) +
      G('c-screen', R(19, 65, 47, 32, 5, INK, ' stroke-width="3.2"') + L('M23.5 89L31 83L37 87.5L45 74.5L53 80L61.5 70.5', MINT, 2.8) +
        L('M23.5 92.5H61.5', STEEL_D, 1.2, ' stroke-opacity=".6"')) +
      C(81.5, 76, 9.5, CREAM, ' stroke-width="3.4"') + needle(81.5, 76, 7, 235) + C(81.5, 76, 2, INK, NS) +
      C(100, 76, 7.5, CREAM, ' stroke-width="3.4"') + needle(100, 76, 5.5, 300, INK) + C(100, 76, 1.8, INK, NS) +
      lampG(26, 108.5, 4.6, 'mint') + lampG(38, 108.5, 4.6, 'mint') + lampG(50, 108.5, 4.6, o.lamp || 'mint', 'c-lamp--main') +
      R(66, 104, 13, 9, 3, SKY, ' stroke-width="2.8"') + R(84, 104, 13, 9, 3, TANG, ' stroke-width="2.8"') +
      rivets([[17, 62], [103, 62], [17, 115], [103, 115]]) + hl('M17 70V90', CREAM, 3)));
  };

  MDEF.pochtalon = function (o) {
    var flag = G('c-lever', pivot(97, 92, 23) + L('M97 92H105V71', null, 4.5) + R(104, 69, 14, 11, 2, RASP, ' stroke-width="3.2"'));
    return mrig(G('c-legs', C(40, 124, 8, INK, NS) + C(80, 124, 8, INK, NS) + C(40, 124, 2.6, CREAM, NS) + C(80, 124, 2.6, CREAM, NS)) + G('c-body',
      L('M42 46L33 25', null, 3.4) + lampG(32, 21, 5.4, o.lamp || 'mint', 'c-lamp--main') +
      L('M20 15Q15 21 20 27M16 11Q8 21 16 31', SKY, 3) +
      flag +
      P('M23 116V70C23 52 38 44 60 44C82 44 97 52 97 70V116Q97 120 93 120H27Q23 120 23 116Z', SKY) +
      R(44, 50, 32, 16, 2, CREAM, ' stroke-width="3.2"') + L('M44 50L60 60L76 50', null, 2.6) +
      R(37, 61, 46, 7.5, 3.75, INK) +
      C(60, 92, 13, CREAM, ' stroke-width="3.4"') + P('M50.5 92.5L69 85L64 101L59.5 95.5Z', SKY, ' stroke-width="2.6"') + L('M59.5 95.5L69 85', INK, 2) +
      rivets([[29, 75], [91, 75], [29, 113], [91, 113]]) + hl('M30 82V100', CREAM, 3)));
  };

  MDEF.zhurnal = function (o) {
    return mrig(G('c-legs', R(26, 98, 10, 31, 3, INK, NS) + R(84, 98, 10, 31, 3, INK, NS)) + G('c-body',
      R(30, 36, 60, 17, 8.5, CREAM) + L('M40 40.5V48.5M50 40.5V48.5M60 40.5V48.5M70 40.5V48.5M80 40.5V48.5', INK, 1.4, ' stroke-opacity=".3"') +
      C(30, 44.5, 6, STEEL_D, ' stroke-width="3"') + C(90, 44.5, 6, STEEL_D, ' stroke-width="3"') +
      R(20, 51, 80, 50, 10, STEEL) +
      lampG(31, 63, 4.8, o.lamp || 'mint', 'c-lamp--main') + lampG(44, 63, 4.8, 'sky') +
      gearG(84, 68, 10.5, STEEL_D, 9) +
      P('M40 89H80V121Q74 125.5 67 121Q60 117 53 121Q46 125.5 40 121Z', CREAM, ' stroke-width="3.2"') +
      L('M47.5 97.5l2 2 3.4-4M56 98h17M47.5 105.5l2 2 3.4-4M56 106h13M47.5 113.5l2 2 3.4-4M56 114h16', INK, 2, ' stroke-opacity=".7"') +
      R(35, 85, 50, 7, 3.5, INK) +
      rivets([[25.5, 56.5], [94.5, 56.5], [25.5, 95.5], [94.5, 95.5]]) + hl('M26 60V78', CREAM, 3)));
  };

  /* ---------- public data ---------- */
  MP.masterTypes = ['brigadir', 'razvedchik', 'syshchik', 'obkhodchik', 'pisar', 'sovetnik', 'pridira', 'planirovshchik',
    'khudozhnik', 'master', 'revizor', 'arkhitektor', 'ispytatel', 'priyomshchik', 'letopisets', 'bibliotekar',
    'ratsionalizator', 'vy'];
  MP.machineTypes = ['vesy', 'strelochnik', 'poryadok', 'stend', 'pochtalon', 'zhurnal'];
  MP.charTypes = MP.masterTypes.slice(0, 17).concat(MP.machineTypes, ['vy']);
  MP.charNames = { brigadir: 'Бригадир', razvedchik: 'Разведчик', syshchik: 'Сыщик', obkhodchik: 'Робот-обходчик',
    pisar: 'Писарь', sovetnik: 'Советники', pridira: 'Придира', planirovshchik: 'Планировщик', khudozhnik: 'Художник',
    master: 'Мастер', revizor: 'Ревизор', arkhitektor: 'Архитектор', ispytatel: 'Испытатель', priyomshchik: 'Приёмщик',
    letopisets: 'Летописец', bibliotekar: 'Библиотекарь', ratsionalizator: 'Рационализатор', vesy: 'Автомат «Весы»',
    strelochnik: 'Автомат «Стрелочник»', poryadok: 'Автомат «Порядок»', stend: 'Автомат «Стенд»',
    pochtalon: 'Автомат «Почтальон»', zhurnal: 'Автомат «Журнал смены»', vy: 'Вы — директор' };
  MP.charExprs = ['happy', 'focus', 'oh', 'grumpy', 'sad'];
  MP.charVariants = { sovetnik: ['team'].concat(ADV), master: ['chief'] };
  MP.charDefaults = { pridira: 'grumpy' };
  MP.plantStates = ['sad', 'happy', 'bloom'];
  MP.phoneStates = ['blank', 'list', 'notify', 'notify-night', 'app'];

  function transformOf(o) {
    var x = +o.x || 0, y = +o.y || 0, s = o.scale == null ? 1 : +o.scale, t = '';
    if (x || y) t += 'translate(' + f(x) + ' ' + f(y) + ')';
    if (s !== 1) t += (t ? ' ' : '') + 'scale(' + f(s) + ')';
    return t ? ' transform="' + t + '"' : '';
  }
  /* Placement lives on an unclassed wrapper <g class="c-place" transform>: CSS transform-origin (chars.css) would
   * otherwise also re-centre the SVG transform attribute, and GSAP x/y/scale on the root stay relative to its spot. */
  function root(cls, o, data, inner) {
    var t = transformOf(o);
    var g = '<g class="' + cls + (o.cls ? ' ' + esc(o.cls) : '') + '"' + (o.id ? ' id="' + esc(o.id) + '"' : '') + data +
      ROOT + '>' + inner + '</g>';
    return t ? '<g class="c-place"' + t + '>' + g + '</g>' : g;
  }

  MP.char = function (type, opts) {
    var o = opts || {};
    if (MDEF[type]) return MP.machine(type, o);
    if (!DEF[type]) type = 'brigadir';
    var expr = MP.charExprs.indexOf(o.expr) >= 0 ? o.expr : (MP.charDefaults[type] || 'happy');
    var variant = o.variant && MP.charVariants[type] && MP.charVariants[type].indexOf(o.variant) >= 0 ? o.variant :
      (type === 'sovetnik' ? 'team' : '');
    var inner = DEF[type]({ expr: expr, variant: variant });
    return root('c-char c-' + type + (variant ? ' c-' + type + '--' + variant : ''), o,
      ' data-char="' + type + '" data-expr="' + expr + '"' + (variant ? ' data-variant="' + variant + '"' : ''), inner);
  };

  MP.machine = function (type, opts) {
    var o = opts || {};
    if (!MDEF[type]) type = 'vesy';
    return root('c-char c-machine c-' + type, o, ' data-char="' + type + '"', MDEF[type](o));
  };

  /* ---------- фиалка ---------- */
  function leaf(a, len, w, fill, bx, by) {
    bx = bx == null ? 60 : bx; by = by == null ? 80 : by;
    var st = len * 0.34, hp = Math.min(len + w * 0.5, bx, 120 - bx, by, 140 - by);
    return G('c-leaf', pivot(bx, by, hp) +
      G('', L('M0 0V' + f(-st - 2), null, 7) + L('M0 0V' + f(-st - 2), fill, 2.6) +
        E(0, -len * 0.66, w, len * 0.35, fill, ' stroke-width="3.5"') +
        L('M0 ' + f(-len * 0.4) + 'V' + f(-len * 0.9), INK, 1.9, ' stroke-opacity=".35"'), tr(bx, by, a)));
  }
  /* wilted leaf: the stalk arches over the rim and the blade hangs outside the pot (side -1 left, 1 right) */
  function droopLeaf(side) {
    var m = function (x) { return f(60 + side * (x - 60)); }, bx = 60 + side * -7;
    var d = 'M' + m(53) + ' 80C' + m(50) + ' 60 ' + m(33) + ' 53 ' + m(22) + ' 63';
    return G('c-leaf', pivot(bx, 80, 47) + L(d, null, 7) + L(d, LEAF_SAD, 2.6) +
      G('', E(0, 0, 8.6, 14.5, LEAF_SAD, ' stroke-width="3.5"') + L('M0 -10V10', INK, 1.9, ' stroke-opacity=".35"'),
        tr(60 + side * (21 - 60), 79, side * 14)));
  }
  function stem(d) { return G('c-stem', L(d, null, 6.6) + L(d, LEAF_D, 2.6)); }
  function flower(cx, cy, r, col) {
    var s = '';
    for (var i = 0; i < 5; i++) { var p = polar(cx, cy, r, -90 + i * 72); s += C(p[0], p[1], r * 1.02, col || VIOLET, ' stroke-width="3.2"'); }
    return G('c-flower', s + C(cx, cy, r * 0.6, CREAM, ' stroke-width="2.8"') + C(cx, cy, r * 0.24, TANG, NS));
  }
  function bud(cx, cy, rot) {
    return G('', G('c-bud', P('M0 -13C6.5 -8 7 1.5 0 5C-7 1.5 -6.5 -8 0 -13Z', VIOLET, ' stroke-width="3.2"') +
      P('M-5.4 2.4Q0 9 5.4 2.4Q3.2 8.4 0 8.8Q-3.2 8.4 -5.4 2.4Z', LEAF_D, ' stroke-width="2.6"')), tr(cx, cy, rot));
  }
  function sparkle(cx, cy, r) { return G('c-sparkle', P(sparkleD(cx, cy, r), CREAM, ' stroke-width="' + (r > 4 ? 2.6 : 2.2) + '"')); }
  MP.plant = function (state, opts) {
    var o = opts || {};
    if (MP.plantStates.indexOf(state) < 0) state = 'happy';
    var sad = state === 'sad', s = FRAME + '<ellipse class="c-shadow" cx="60" cy="134" rx="35" ry="4.5" fill="' + INK + '" fill-opacity=".15" stroke="none"/>';
    var pot = G('c-pot', P('M25 86H95L89.5 124Q88.5 132 80.5 132H39.5Q31.5 132 30.5 124Z', TERRA) +
      R(18, 73, 84, 16, 8, TERRA_L) + hl('M32.5 96L35.5 119', CREAM, 4.5) + hl('M25.5 78.8H40', CREAM, 3.2) +
      face({ y: 104, dx: 12.5, mdy: 12, expr: sad ? 'sad' : 'happy', cheek: RASP, cheekA: 0.55 }) +
      '');
    var back = '', mid = '', front = '', over = '';
    if (sad) {
      back = leaf(-40, 36, 11, LEAF_SAD) + leaf(34, 34, 11, LEAF_SAD) +
        stem('M60 80C59 56 67 47 73 53') + bud(74, 59, 160) +
        G('c-drop', P(dropD(24, 26, 17), SKY, ' stroke-width="3"') + hl('M20.5 37Q20.5 34 22.5 32', WHITE, 2.2));
      over = droopLeaf(-1) + droopLeaf(1);
    } else {
      back = leaf(-52, 46, 13.5, LEAF_D) + leaf(52, 46, 13.5, LEAF_D) + leaf(0, 42, 13, LEAF_D);
      if (state === 'bloom') {
        mid = stem('M60 80C55 66 45 54 40 41') + stem('M60 80C60 62 60 44 60 30') + stem('M60 80C65 66 75 54 80 39');
        front = flower(40, 40, 7.4, LILAC) + flower(80, 38, 7.4, LILAC) + flower(60, 28, 8.4) +
          sparkle(21, 33, 6.5) + sparkle(101, 23, 5.5) + sparkle(100, 58, 4);
      } else {
        mid = stem('M60 80C57 64 52 52 50 40') + stem('M60 80C62 62 68 50 71 37');
        front = bud(50, 38, -10) + bud(71.5, 35, 12);
      }
      mid += leaf(-86, 40, 13, MINT) + leaf(-30, 40, 12.5, MINT) + leaf(30, 40, 12.5, MINT) + leaf(86, 40, 13, MINT);
    }
    var inner = s + back + mid + front + pot + over;
    return root('c-plant c-plant--' + state, o, ' data-plant="' + state + '"', inner);
  };

  /* ---------- phone ---------- */
  function appIcon(x, y, size, cls) {
    var k = size / 52;
    return G('', G(cls || 'ph-icon', R(0, 0, 52, 52, 15, MINT, ' stroke-width="3.6"') +
      P(dropD(24, 8.5, 32), SKY, ' stroke-width="3.2"') + hl('M18 31Q18.5 26 21.5 23', WHITE, 2.8) +
      P('M31 20C33 11 41 7 46 8C46 16 40 22 32 21.5Z', LEAF_D, ' stroke-width="3"') + L('M32 21L41 12.5', INK, 1.8)),
      tr(x, y, 0, k) + (k < 0.6 ? ' stroke-width="' + f(3.2 / k * 0.55) + '"' : ''));
  }
  function miniPlant(x, y) {
    return C(x, y - 5, 5.5, MINT, ' stroke-width="2"') + C(x - 4, y - 1.5, 3.8, MINT, ' stroke-width="2"') + C(x + 4, y - 1.5, 3.8, MINT, ' stroke-width="2"') +
      P('M' + f(x - 6) + ' ' + f(y + 1) + 'H' + f(x + 6) + 'L' + f(x + 4.5) + ' ' + f(y + 9) + 'H' + f(x - 4.5) + 'Z', TERRA, ' stroke-width="2"');
  }
  function notif(y) {
    var ls = { weight: 600, ex: ' letter-spacing="-0.15"' };
    return G('ph-notif', R(12, y, 116, 62, 13, CREAM, ' stroke-width="3"') + appIcon(19, y + 7, 17, 'ph-notif-icon') +
      T(42, y + 19.5, 'Полей меня', 11, { weight: 800 }) +
      T(18.5, y + 39.5, 'Фиалка хочет пить.', 11, ls) + T(18.5, y + 53.5, 'Пора полить!', 11, ls));
  }
  var STARS = [[26, 44], [46, 58], [114, 88], [22, 96], [98, 108], [36, 190], [108, 196], [62, 206], [120, 150], [18, 150]];
  MP.phone = function (state, opts) {
    var o = opts || {};
    state = { 'reminder-0900': 'notify', 'reminder-0300': 'notify-night' }[state] || state;
    if (MP.phoneStates.indexOf(state) < 0) state = 'blank';
    var bg = { blank: '#261F5E', list: CREAM, notify: VIOLET, 'notify-night': NIGHT, app: VIOLET }[state];
    var sc = R(10, 12, 120, 236, 17, bg, NS), i;
    var bar = function (col) {
      return T(22, 31, '09:00', 11, { weight: 700, fill: col, ex: ' class="ph-clock"' }) +
        R(104, 23.5, 15, 8, 2.5, 'none', ' stroke="' + col + '" stroke-width="1.6"') + R(106, 25.5, 8, 4, 1, col, NS);
    };
    if (state === 'blank') {
      sc += C(70, 130, 13, 'none', ' stroke="' + CREAM + '" stroke-opacity=".22" stroke-width="3"') +
        L('M70 113V127', CREAM, 3, ' stroke-opacity=".22"');
    } else if (state === 'list') {
      sc += P('M10 29A17 17 0 0 1 27 12H113A17 17 0 0 1 130 29V63H10Z', MINT, NS) + L('M10 63H130', INK, 3) + bar(INK) +
        T(21, 53, 'Полей меня', 12, { display: true, weight: 800 });
      var rows = [['Фиалка', 0.16, RASP], ['Фикус', 0.72, SKY], ['Кактус', 0.46, SKY]];
      for (i = 0; i < 3; i++) {
        var y0 = 73 + i * 43;
        sc += G('ph-row', R(16, y0, 108, 36, 10, WHITE, ' stroke-width="2.6"') + miniPlant(30, y0 + 16) +
          T(43, y0 + 15.5, rows[i][0], 12, { weight: 700 }) +
          R(43, y0 + 21.5, 56, 7, 3.5, rows[i][2], NS + ' fill-opacity=".18"') + R(43, y0 + 21.5, Math.max(7, 56 * rows[i][1]), 7, 3.5, rows[i][2], NS) +
          R(43, y0 + 21.5, 56, 7, 3.5, 'none', ' stroke-width="1.8"') + P(dropD(112, y0 + 16, 12), rows[i][2], ' stroke-width="2"'));
      }
      sc += G('ph-add', R(24, 206, 92, 30, 15, VIOLET, ' stroke-width="3"') + L('M37 221h9M41.5 216.5v9', CREAM, 2.8) +
        T(51, 225, 'Добавить', 11.5, { fill: CREAM, weight: 700 }));
    } else if (state === 'app') {
      sc += C(118, 60, 44, WHITE, NS + ' fill-opacity=".07"') + C(20, 214, 38, WHITE, NS + ' fill-opacity=".07"') + bar(CREAM);
      var ghost = ' stroke="none" fill-opacity=".24"';
      for (i = 0; i < 8; i++) sc += R(20 + (i % 4) * 27, 46 + Math.floor(i / 4) * 30, 19, 19, 6, CREAM, ghost);
      for (i = 0; i < 4; i++) sc += R(20 + i * 27, 214, 19, 19, 6, CREAM, ghost);
      sc += appIcon(43, 112, 54) + T(70, 184, 'Полей меня', 11.5, { fill: CREAM, weight: 700, anchor: 'middle' });
    } else {
      var night = state === 'notify-night';
      if (night) {
        for (i = 0; i < STARS.length; i++) sc += C(STARS[i][0], STARS[i][1], i % 3 ? 1.3 : 1.9, CREAM, NS + ' fill-opacity=".8"');
        sc += G('ph-moon', C(103, 44, 9.5, CREAM, NS) + C(108, 40, 8, NIGHT, NS));
      } else {
        sc += C(116, 52, 40, WHITE, NS + ' fill-opacity=".08"') + C(24, 220, 34, WHITE, NS + ' fill-opacity=".08"');
      }
      sc += T(70, 79, night ? '03:00' : '09:00', 26, { display: true, weight: 800, fill: CREAM, anchor: 'middle', ex: ' class="ph-time"' }) +
        T(70, 98, night ? 'Ночь, все спят' : 'Вторник, утро', 11, { fill: CREAM, weight: 600, anchor: 'middle' }) +
        notif(116) +
        C(31, 222, 11, WHITE, NS + ' fill-opacity=".16"') + C(109, 222, 11, WHITE, NS + ' fill-opacity=".16"');
    }
    var inner = '<rect class="c-frame" width="140" height="260" fill="none" stroke="none"/>' +
      R(3, 3, 134, 254, 25, INK) + G('ph-screen', sc) +
      P('M10 70L68 12H92L10 94Z', WHITE, NS + ' fill-opacity=".07"') +
      R(56, 18, 28, 9.5, 4.75, INK, NS) + R(52, 240, 36, 3.6, 1.8, state === 'list' ? INK : CREAM, NS + ' fill-opacity=".45"');
    return root('c-phone c-phone--' + state, o, ' data-phone="' + state + '"', inner);
  };

  /* ---------- «вы»: hand with the stamp, and the seal it leaves ---------- */
  MP.stampHand = function (opts) {
    var o = opts || {};
    var inner = FRAME + G('c-stamp',
      E(60, 120.5, 40, 6.5, INK, NS) +
      P('M16 95A44 9.5 0 0 1 104 95V110A44 9.5 0 0 1 16 110Z', LEMON) + E(60, 95, 44, 9.5, LEMON) +
      hl('M26 97.5Q38 101 52 101.8', WHITE, 3) +
      T(60, 115.5, 'ОДОБРЕНО', 11.5, { weight: 900, anchor: 'middle', ex: ' letter-spacing="0.4"' }) +
      P('M51 62H69L67 76Q66.5 82 70 88V95H50V88Q53.5 82 53 76Z', LEMON) + C(60, 55, 15, LEMON)) +
      G('c-sleeve', R(37, 0, 46, 15, 0, LEMON, NS) + L('M37 0V15M83 0V15', null, 4) + R(33, 11, 54, 13, 6.5, LEMON) +
        L('M41 14V21M48.5 14V21M56 14V21M63.5 14V21M71 14V21M78.5 14V21', INK, 1.6, ' stroke-opacity=".35"')) +
      G('c-hand', P('M41 23H79Q86 23 86 30V47Q86 61 71.5 63.5H48.5Q34 61 34 47V30Q34 23 41 23Z', CREAM) +
        L('M47.5 49V60.5M56 50V63M64.5 50V63M73 49V60.5', INK, 2.4) +
        P('M35 33C27 35 25.5 46.5 31.5 51C35 53.5 40 52.5 41.5 48.5', CREAM, ' stroke-width="3.8"') + hl('M41 31H54', WHITE, 3));
    return root('c-stamphand', o, '', inner);
  };
  MP.seal = function (opts) {
    var o = opts || {};
    var text = String(o.text || 'ОДОБРЕНО'), size = Math.min(15, 62 / (text.length * (text === text.toUpperCase() ? 0.74 : 0.62)));
    var inner = '<rect class="c-frame" width="100" height="100" fill="none" stroke="none"/>' +
      G('', C(50, 50, 45, o.fill || LEMON, ' stroke-width="4.5"') + C(50, 50, 37.5, 'none', ' stroke-width="2.2"') +
        P(starD(50, 26, 5.5), INK, NS) + P(starD(50, 74, 5.5), INK, NS) +
        T(50, 50 + size * 0.36, text, f(size), { weight: 900, anchor: 'middle' }),
        ' transform="rotate(' + f(o.rotate == null ? -12 : o.rotate) + ' 50 50)"');
    return root('c-seal', o, '', inner);
  };

  /* ---------- DOM helpers (browser only) ---------- */
  var hasDoc = typeof document !== 'undefined';
  MP.artSVG = function (markup, viewBox, cls) {
    if (!hasDoc) return null;
    var t = document.createElement('template');
    t.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + (viewBox || '0 0 120 140') + '" class="c-svg' +
      (cls ? ' ' + cls : '') + '" focusable="false" aria-hidden="true">' + markup + '</svg>';
    return t.content.firstElementChild;
  };
  MP.charSVG = function (type, opts) {
    var o = {}, k;
    for (k in (opts || {})) if (k !== 'x' && k !== 'y' && k !== 'scale') o[k] = opts[k];
    return MP.artSVG(MP.char(type, o), '0 0 120 140', 'c-svg--' + type);
  };
  MP.setExpr = function (el, expr) {
    if (!hasDoc || !el) return;
    var rootEl = el.classList && el.classList.contains('c-char') ? el : el.querySelector && el.querySelector('.c-char');
    if (!rootEl) return;
    var fresh = MP.artSVG(MP.char(rootEl.getAttribute('data-char'), { expr: expr, variant: rootEl.getAttribute('data-variant') || undefined }));
    var oldF = rootEl.querySelectorAll('.c-face'), newF = fresh.querySelectorAll('.c-face');
    for (var i = 0; i < oldF.length && i < newF.length; i++) oldF[i].parentNode.replaceChild(newF[i].cloneNode(true), oldF[i]);
    rootEl.setAttribute('data-expr', expr);
  };
  /* deterministic blinks: one timeline for every face in rootEl */
  MP.blink = function (rootEl, api) {
    if (!hasDoc || !rootEl) return null;
    var gsap = (api && api.gsap) || window.gsap;
    if (!gsap) return null;
    if (api ? api.calm : (MP.isCalm && MP.isCalm())) return null;
    var lids = rootEl.querySelectorAll('.c-lid');
    if (!lids.length) return null;
    var owners = [], groups = [];
    for (var i = 0; i < lids.length; i++) {
      var own = lids[i].parentNode, k = owners.indexOf(own);
      if (k < 0) { owners.push(own); groups.push([lids[i]]); } else groups[k].push(lids[i]);
    }
    var period = 6.4, rnd = MP.seeded ? MP.seeded(4242) : function () { return 0.5; };
    var tl = gsap.timeline({ repeat: -1 });
    tl.to({}, { duration: period }, 0);
    groups.forEach(function (g, n) {
      var t = 0.25 + ((rnd() + n * 0.618) % 1) * (period - 1);
      tl.to(g, { scaleY: 0.1, duration: 0.07, ease: 'power1.in', transformOrigin: '50% 50%' }, t)
        .to(g, { scaleY: 1, duration: 0.13, ease: 'power1.out' }, t + 0.07);
      if (rnd() < 0.3) {
        tl.to(g, { scaleY: 0.1, duration: 0.07, ease: 'power1.in' }, t + 0.3)
          .to(g, { scaleY: 1, duration: 0.13, ease: 'power1.out' }, t + 0.37);
      }
    });
    return api && api.loop ? api.loop(tl) : tl;
  };

  /* ---------- ?debug=chars : full-page gallery of the kit + geometry self-check ---------- */
  function debugGallery() {
    var H = document.documentElement;
    H.classList.add('mp-dbg-on');
    var css = '.mp-dbg-on body>*:not(.mp-dbg):not(.mp-confetti){display:none!important}' +
      '.mp-dbg{position:absolute;inset:0 0 auto 0;min-height:100vh;z-index:10000;background:#FFF6E6;color:#16123A;padding:28px 32px 60px;font-family:var(--font-text)}' +
      '.mp-dbg h2{font:800 26px/1.2 var(--font-display);margin:26px 0 12px}.mp-dbg h2:first-child{margin-top:0}' +
      '.mp-dbg-grid{display:flex;flex-wrap:wrap;gap:10px 12px}' +
      '.mp-dbg-cell{display:flex;flex-direction:column;align-items:center;gap:2px;font-size:13px;font-weight:600}' +
      '.mp-dbg-cell svg{width:120px;height:140px;background:#fff;border:2px solid rgba(22,18,58,.12);border-radius:10px}' +
      '.mp-dbg-cell.ph svg{width:140px;height:260px}.mp-dbg-cell.big svg{width:240px;height:280px}' +
      '.mp-dbg-row{display:grid;grid-template-columns:150px repeat(5,120px) auto;gap:10px;align-items:center;margin-bottom:6px}' +
      '.mp-dbg-row>b{font-size:15px}.mp-dbg-fields{display:flex;flex-wrap:wrap;gap:12px}' +
      '.mp-dbg-field{padding:10px;border-radius:16px;display:flex;gap:4px;flex-wrap:wrap;width:100%}' +
      '.mp-dbg-field svg{width:96px;height:112px}.mp-dbg-wide{width:100%;height:auto;background:#fff;border-radius:12px;border:2px solid rgba(22,18,58,.12)}' +
      '@media (max-width:760px){.mp-dbg{padding:16px}.mp-dbg-row{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}' +
      '.mp-dbg-row>b{grid-column:1/-1}.mp-dbg-row .mp-dbg-grid{grid-column:1/-1}.mp-dbg-cell svg{width:100%;height:auto;aspect-ratio:120/140}' +
      '.mp-dbg-cell.ph svg{width:140px;aspect-ratio:140/260}.mp-dbg-field svg{width:68px;height:80px}.mp-dbg h2{font-size:21px}}';
    var box = document.createElement('div');
    box.className = 'mp-dbg';
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
    var h = '';
    function cell(markup, label, vb, cls) {
      return '<div class="mp-dbg-cell' + (cls ? ' ' + cls : '') + '"><svg viewBox="' + (vb || '0 0 120 140') + '">' + markup + '</svg><span>' + label + '</span></div>';
    }
    h += '<h2>Мастера × выражения</h2>';
    MP.masterTypes.forEach(function (t) {
      h += '<div class="mp-dbg-row"><b>' + MP.charNames[t] + '</b>';
      ['happy', 'focus', 'oh', 'grumpy', 'sad'].forEach(function (e) { h += cell(MP.char(t, { expr: e }), e); });
      h += '<div class="mp-dbg-grid">';
      (MP.charVariants[t] || []).forEach(function (v) { h += cell(MP.char(t, { variant: v }), v); });
      h += '</div></div>';
    });
    h += '<h2>Автоматы</h2><div class="mp-dbg-grid">';
    MP.machineTypes.forEach(function (t) { h += cell(MP.machine(t), MP.charNames[t]); });
    h += cell(MP.machine('stend', { lamp: 'raspberry' }), 'stend lamp:raspberry') + cell(MP.machine('vesy', { lamp: 'lemon' }), 'vesy lamp:lemon');
    h += '</div><h2>Фиалка, печать, рука</h2><div class="mp-dbg-grid">';
    MP.plantStates.forEach(function (s) { h += cell(MP.plant(s), s); });
    h += cell(MP.stampHand(), 'stampHand') + cell(MP.seal(), 'seal', '0 0 100 100') + cell(MP.seal({ text: 'Годится', fill: MINT, rotate: 8 }), 'seal Годится', '0 0 100 100');
    h += '</div><h2>Телефон</h2><div class="mp-dbg-grid">';
    MP.phoneStates.forEach(function (s) { h += cell(MP.phone(s), s, '0 0 140 260', 'ph'); });
    h += '</div><h2>96 px на полях</h2><div class="mp-dbg-fields">';
    [['#FFF6E6', 'cream'], ['#5B34F5', 'violet'], ['#FF8A1F', 'tangerine'], ['#2BD99F', 'mint'], ['#3EC5FF', 'sky'], ['#16123A', 'ink']].forEach(function (fl) {
      h += '<div class="mp-dbg-field" style="background:' + fl[0] + '">';
      MP.charTypes.forEach(function (t) { h += '<svg viewBox="0 0 120 140">' + MP.char(t) + '</svg>'; });
      h += '</div>';
    });
    h += '</div><h2>Лента</h2>';
    if (MP.belt) {
      h += '<svg class="mp-dbg-wide" viewBox="0 0 1000 250">' + MP.belt({ x: 30, y: 150, w: 700, stations: [{ x: 120, lamp: 'mint', label: 'Придумать' }, { x: 300, lamp: 'sky', label: 'Собрать' }, { x: 480, lamp: 'raspberry', label: 'Проверить' }, { x: 640, lamp: 'lemon', label: 'Выдать' }] }) +
        MP.char('master', { x: 180, y: 12 }) + MP.char('vy', { x: 522, y: 12 }) +
        MP.belt({ x: 760, y: 60, points: [[0, 0], [200, 0], [200, 120], [20, 120]], r: 60, w: 26 }) + '</svg>';
    }
    h += '<h2>Все вместе</h2><svg class="mp-dbg-wide" viewBox="0 0 2900 170">';
    MP.charTypes.forEach(function (t, i) { h += MP.char(t, { x: 10 + i * 120, y: 20 }); });
    h += MP.plant('bloom', { x: 2770, y: 20 }) + '</svg>';
    box.innerHTML = h;
    document.body.appendChild(box);
    try { MP.blink(box); } catch (e) {}
    /* geometry self-check: arm bboxes centred on the shoulder, root bbox = the 120×140 frame */
    var bad = [];
    Array.prototype.forEach.call(box.querySelectorAll('.c-arm-l, .c-arm-r, .c-needle, .c-lever, .c-leaf'), function (a) {
      var pv = a.querySelector('.c-pivot'); if (!pv) return;
      var b = a.getBBox(), p = pv.getBBox();
      if (Math.abs(b.x - p.x) > 0.6 || Math.abs(b.y - p.y) > 0.6 || Math.abs(b.width - p.width) > 1.2 || Math.abs(b.height - p.height) > 1.2) {
        var r = a.closest('[data-char],[data-plant]');
        bad.push((r ? (r.getAttribute('data-char') || r.getAttribute('data-plant')) + (r.getAttribute('data-variant') ? '/' + r.getAttribute('data-variant') : '') : '?') + ' ' + a.getAttribute('class') +
          ' bbox ' + [b.x, b.y, b.width, b.height].map(Math.round).join(',') + ' vs pivot ' + [p.x, p.y, p.width, p.height].map(Math.round).join(','));
      }
    });
    Array.prototype.forEach.call(box.querySelectorAll('.c-char, .c-plant, .c-stamphand'), function (r) {
      var b = r.getBBox();
      if (b.x < -0.6 || b.y < -0.6 || b.x + b.width > 120.6 || b.y + b.height > 140.6) {
        bad.push('root ' + (r.getAttribute('data-char') || r.getAttribute('data-plant') || 'stamphand') + ' bbox ' + [b.x, b.y, b.width, b.height].map(Math.round).join(','));
      }
    });
    var uniq = bad.filter(function (v, i) { return bad.indexOf(v) === i; });
    uniq.forEach(function (m) { console.warn('[chars] geometry: ' + m); });
    box.setAttribute('data-geometry', uniq.length ? 'bad' : 'ok');
  }
  if (hasDoc && typeof location !== 'undefined' && /[?&]debug=chars(?:&|$)/.test(location.search)) {
    /* wait for the other deferred modules (belt.js runs after this file) */
    var once = function () { if (once.done) return; once.done = true; debugGallery(); };
    if (document.readyState === 'complete') once();
    else { document.addEventListener('DOMContentLoaded', once); window.addEventListener('load', once); }
  }
})();
