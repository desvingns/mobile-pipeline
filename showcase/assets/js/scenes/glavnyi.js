/* scenes/glavnyi.js — «Главный на фабрике — вы» (package C; docs/design-prosto.md §2.8).
 * Stage: a sticker diorama split into the factory (cream) and the world (sky). The release sheet «Выпуск» waits
 * for YOUR stamp; the finished piece waits on the belt behind a lemon barrier. Nothing happens until the visitor
 * presses the lemon button (it breathes with a soft lemon halo meanwhile): the seal slams with splash + shake +
 * confetti → barrier lifts → the piece rides out, turns into a capsule and arcs into the phone → the phone wakes up
 * and buzzes, a big notification «Фиалка хочет пить. Пора полить!» pops out → the watering can pours → the фиалка
 * perks up and blooms → the [data-after-stamp] notes appear; the button becomes «Ещё раз» (fast rewind + replay).
 * The stop-chips light up one by one when they scroll in; each carries a mint check, the 4th («Выпуск») gets its
 * check only from the stamp.
 * Two stage layouts live side by side (wide 800×560 and tall 400×500 = the shared 4:5 phone stage below 760px,
 * switched in scenes-c.css); every animation drives both, so crossing the breakpoint never needs a rebuild.
 * The phone's own tiny notification lines are drawn as bars: the readable text is the big notification bubble.
 * build() renders the FINAL (stamped) state. init() and final() both set the pre-stamp state and build ONE paused
 * master timeline; init plays it on click, final (calm) toggles its progress 0/1 instantly on click.
 */
(function () {
  'use strict';
  var MP = window.MP;
  if (!MP || !MP.scene) return;

  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', LEMON = '#FFDA4F', MINT = '#2BD99F',
    RASP = '#FF4F8B', SKY = '#3EC5FF', TANG = '#FF8A1F', STEEL = '#C9D3E6', STEEL_D = '#8E9BB8', WHITE = '#FFFFFF',
    LEAF_D = '#1BB283';
  var FT = "'Golos Text', 'Segoe UI', system-ui, sans-serif";
  var FD = "Unbounded, 'Arial Black', system-ui, sans-serif";
  var TALL_MQ = '(max-width: 759px)';
  var STAMPED = 'Печать поставлена — новинка вышла в свет. Теперь фиалку не забудут полить.';
  var UNSTAMPED = 'Печать убрана: фабрика снова ждёт вашего «да».';
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- tiny SVG string helpers ---------- */
  function f(v) { return String(Math.round(v * 100) / 100); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
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
  function Ln(d, col, w, ex) {
    return '<path d="' + d + '" fill="none"' + (col ? ' stroke="' + col + '"' : '') + (w ? ' stroke-width="' + w + '"' : '') + (ex || '') + '/>';
  }
  function G(cls, inner, ex) { return '<g' + (cls ? ' class="' + cls + '"' : '') + (ex || '') + '>' + inner + '</g>'; }
  function T(x, y, s, size, o) {
    o = o || {};
    return '<text x="' + f(x) + '" y="' + f(y) + '" font-family="' + (o.display ? FD : FT) + '" font-size="' + size +
      '" font-weight="' + (o.weight || 700) + '" fill="' + (o.fill || INK) + '" stroke="none"' +
      (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + '>' + esc(s) + '</text>';
  }
  function at(x, y, extra) { return ' transform="translate(' + f(x) + ' ' + f(y) + ')' + (extra || '') + '"'; }
  var NS = ' stroke="none"';
  function dropD(cx, top, h) {
    var r = h * 0.36, cy = top + h - r;
    return 'M' + f(cx) + ' ' + f(top) + 'C' + f(cx - r * 0.3) + ' ' + f(top + h * 0.28) + ' ' + f(cx - r) + ' ' +
      f(cy - r * 0.5) + ' ' + f(cx - r) + ' ' + f(cy) + 'A' + f(r) + ' ' + f(r) + ' 0 0 0 ' + f(cx + r) + ' ' + f(cy) +
      'C' + f(cx + r) + ' ' + f(cy - r * 0.5) + ' ' + f(cx + r * 0.3) + ' ' + f(top + h * 0.28) + ' ' + f(cx) + ' ' + f(top) + 'Z';
  }
  function bez(p, t) {
    var u = 1 - t;
    return [u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
      u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]];
  }
  function bezD(p) {
    return 'M' + f(p[0][0]) + ' ' + f(p[0][1]) + 'C' + f(p[1][0]) + ' ' + f(p[1][1]) + ' ' + f(p[2][0]) + ' ' +
      f(p[2][1]) + ' ' + f(p[3][0]) + ' ' + f(p[3][1]);
  }

  /* ---------- the two layouts (user units) ---------- */
  /* The «вы» hand hovers over the release sheet with its cuff entering from the top edge (an arm reaching in from
   * off-stage), so the sheet sits low enough for the whole hand to stay in frame: hand top = seal.cy − 119.5·s − lift. */
  var LAYOUTS = {
    wide: {
      W: 800, H: 560, floor: 512, zoneX: 344,
      paper: { x: 22, y: 112, rot: -3, w: 292, h: 198, pad: 20, ty: 44, ts: 26, sy: 76, ss: 19, cx: 222, cy: 116, cr: 60, lines: 3 },
      seal: { s: 1.64 },
      hand: { s: 1.6, lift: 40 },
      belt: { x: 14, y: 440, w: 306, h: 30, legs: 36, pitch: 26 },
      piece: { x: 78, y: 440, s: 1, ride: 150 },
      barrier: { x: 312, y: 400, len: 90, up: 82 },
      can: { x: 430, y: 296, s: 1, tilt: 32, px: 392 },
      plant: { x: 452, y: 337, s: 1.25 },
      phone: { x: 606, y: 208, s: 1.15 },
      toast: { x: 680, y: 210, rx: -250, ry: -150, w: 346, h: 120, dir: 'down', icon: 56, ts: 20, xs: 23, row: [44, 78, 106] },
      arc: [[228, 398], [282, 150], [560, 90], [686.5, 357.5]],
      rays: [90, 118],
      clouds: [[548, 250, 1], [400, 214, 0.7], [470, 74, 0.8]]
    },
    tall: {
      /* the shared 4:5 phone stage: the release sheet spans the top (title left, seal right, the hand reaching in
       * from above), the phone sits beside it, the notification gets its own band, belt | can + фиалка below */
      W: 400, H: 500, floor: 460, zoneX: 206,
      paper: { x: 12, y: 70, rot: -3, w: 280, h: 170, pad: 16, ty: 40, ts: 24, sy: 64, ss: 18, cx: 206, cy: 96, cr: 56, lines: 3, l0: 24, lg: 18 },
      seal: { s: 1.5 },
      hand: { s: 1.3, lift: 30 },
      belt: { x: 12, y: 418, w: 188, h: 24, legs: 12, pitch: 22 },
      piece: { x: 56, y: 418, s: 0.72, ride: 90 },
      barrier: { x: 196, y: 390, len: 70, up: 82 },
      can: { x: 267, y: 363, s: 0.62, tilt: 32, px: 244 },
      plant: { x: 290, y: 347, s: 0.8 },
      phone: { x: 302, y: 62, s: 0.6, noShadow: true },
      toast: { x: 344, y: 230, rx: -328, ry: 16, w: 368, h: 88, dir: 'up', icon: 46, ts: 18, xs: 19, row: [32, 57, 79] },
      arc: [[146, 390], [150, 290], [300, 262], [344, 140]],
      rays: [76, 98],
      clouds: [[362, 34, 0.55]]
    }
  };
  var DROPS = [[72, 26], [65, 50], [76, 74]];   // drop tops relative to the can centre (final, tilted pose)
  /* the seal sits on the sheet: map the sheet-local target (cx, cy) through translate + rotate */
  Object.keys(LAYOUTS).forEach(function (k) {
    var L = LAYOUTS[k], p = L.paper, a = p.rot * Math.PI / 180;
    L.seal.cx = p.x + p.cx * Math.cos(a) - p.cy * Math.sin(a);
    L.seal.cy = p.y + p.cx * Math.sin(a) + p.cy * Math.cos(a);
  });
  var TRAIL_N = 14;

  /* ---------- art ---------- */
  function cloud(x, y, k) {
    return '<g' + at(x, y, ' scale(' + f(k) + ')') + '>' +
      P('M-34 12Q-40 -4 -24 -6Q-22 -24 -4 -20Q6 -34 22 -20Q40 -22 38 -4Q48 6 36 12Z', CREAM, ' stroke-width="3.5"') +
      Ln('M-22 -2Q-18 -12 -8 -12', WHITE, 3) + '</g>';
  }
  function backdrop(L) {
    var s = R(L.zoneX, 0, L.W - L.zoneX, L.H, 0, SKY, NS);
    L.clouds.forEach(function (c) { s += cloud(c[0], c[1], c[2]); });
    s += R(0, L.floor, L.zoneX, L.H - L.floor, 0, STEEL, NS) + R(L.zoneX, L.floor, L.W - L.zoneX, L.H - L.floor, 0, MINT, NS);
    /* factory side: a row of rivets on the wall trim; world side: grass tufts */
    for (var x = 18; x < L.zoneX - 8; x += 28) s += C(x, L.floor + 14, 2.2, INK, NS + ' fill-opacity=".25"');
    for (var g = L.zoneX + 26; g < L.W - 20; g += 64) s += Ln('M' + f(g) + ' ' + f(L.floor + 16) + 'l5 -8 4 8 5 -8', INK, 2.4, ' stroke-opacity=".35"');
    s += Ln('M' + f(L.zoneX) + ' 0V' + f(L.floor), INK, 4) + Ln('M0 ' + f(L.floor) + 'H' + f(L.W), INK, 4);
    return s;
  }
  function paper(L) {
    var p = L.paper, s = '';
    s += R(7, 7, p.w, p.h, 14, INK, NS) + R(0, 0, p.w, p.h, 14, WHITE);
    s += '<g transform="rotate(-8 50 0)">' + R(20, -11, 60, 22, 4, TANG, ' stroke-width="3" fill-opacity=".9"') + '</g>';
    /* grey placeholder lines always sit BELOW the title */
    for (var i = 0; i < (p.lines || 0); i++) s += Ln('M' + p.pad + ' ' + f(p.sy + (p.l0 || 30) + i * (p.lg || 20)) + 'h' + f(i === 2 ? 64 : 104), INK, 4, ' stroke-opacity=".16"');
    s += T(p.pad, p.ty, 'Выпуск', p.ts, { display: true, weight: 800 });
    s += T(p.pad, p.sy, '«Полей меня»', p.ss, { weight: 700 });
    s += C(p.cx, p.cy, p.cr, 'none', ' stroke-width="3" stroke-dasharray="7 9" stroke-opacity=".3"');
    s += Ln('M' + p.pad + ' ' + f(p.h - 22) + 'h' + f(p.w * 0.22), INK, 3, ' stroke-opacity=".3"');
    return '<g' + at(p.x, p.y, ' rotate(' + p.rot + ')') + '>' + G('gl-paper', s) + '</g>';
  }
  function splash(L) {
    var c = L.seal, s = '', i, a, r0 = L.rays[0], r1 = L.rays[1];
    for (i = 0; i < 10; i++) {
      a = (i * 36 - 72) * Math.PI / 180;
      s += '<line class="gl-ray" x1="' + f(c.cx + Math.cos(a) * r0) + '" y1="' + f(c.cy + Math.sin(a) * r0) + '" x2="' +
        f(c.cx + Math.cos(a) * r1) + '" y2="' + f(c.cy + Math.sin(a) * r1) + '" stroke-width="5"/>';
    }
    for (i = 0; i < 5; i++) {
      a = (i * 72 - 54) * Math.PI / 180;
      s += C(c.cx + Math.cos(a) * (r0 + r1) / 2, c.cy + Math.sin(a) * (r0 + r1) / 2, 5.5, LEMON, ' class="gl-dot" stroke-width="3"');
    }
    return G('gl-splash', s, ' opacity="0"');
  }
  /* hover spot of the «вы» hand (kit box top-left), and how far up (kit units) it must go to leave the frame */
  function handAt(L) { var h = L.hand, c = L.seal; return [c.cx - 60 * h.s, c.cy - 119.5 * h.s - h.lift]; }
  function handExit(L) { return -(handAt(L)[1] / L.hand.s) - 140; }
  function hand(L) {
    var p = handAt(L);
    /* final state: the hand has stamped and left — only the seal stays (init/final bring it back for the story) */
    return G('gl-bob', MP.stampHand({ x: p[0], y: p[1], scale: L.hand.s, cls: 'gl-hand' }), ' opacity="0"');
  }
  function seal(L) {
    var c = L.seal;
    return MP.seal({ x: c.cx - 50 * c.s, y: c.cy - 50 * c.s, scale: c.s, cls: 'gl-seal' });
  }
  /* the finished piece: a tangerine puzzle piece with a bell, drawn with its bottom-centre at (0,0) */
  function piece(L) {
    var p = L.piece;
    var d = 'M-30 -76H-12A13 13 0 1 1 12 -76H30Q46 -76 46 -60V-48A11 11 0 1 1 46 -26V-16Q46 0 30 0H-30Q-46 0 -46 -16V-60Q-46 -76 -30 -76Z';
    var bell = P('M-11 -27Q-11 -50 0 -50Q11 -50 11 -27L14 -23H-14Z', INK, NS) + C(0, -19.5, 4, INK, NS) + C(0, -52.5, 3, INK, NS) +
      Ln('M-5 -42Q-4 -46 -1 -47', CREAM, 2.4);
    var inner = P(d, TANG) + Ln('M-38 -22Q-40 -48 -30 -64', CREAM, 4.5) + C(0, -36, 22, CREAM, ' stroke-width="3.5"') + bell;
    return '<g' + at(p.x, p.y, ' scale(' + f(p.s) + ')') + '>' + G('gl-piece', inner, ' opacity="0"') + '</g>';
  }
  function barrier(L) {
    var b = L.barrier, post = L.floor - b.y;
    var boom = R(-b.len, -8, b.len, 16, 8, LEMON) +
      Ln('M' + f(-b.len + 10) + ' 0H-8', INK, 12, ' stroke-dasharray="11 11" stroke-linecap="butt"') +
      R(-b.len, -8, b.len, 16, 8, 'none');
    var lamp = function (col) { return C(0, -44, 11, col, ' stroke-width="3.5"') + C(-3.6, -47.6, 3, WHITE, NS); };
    return '<g' + at(b.x, b.y) + '>' +
      R(-7, -34, 14, post + 34, 3, STEEL_D, ' stroke-width="3.5"') + R(-16, post - 8, 32, 10, 4, INK, NS) +
      G('gl-lamp-g', lamp(MINT)) +
      G('gl-lamp-y', G('gl-halo', C(0, -44, 21, LEMON, NS + ' fill-opacity=".55"')) + lamp(LEMON), ' opacity="0"') +
      '<g transform="rotate(' + b.up + ')">' + G('gl-boom', boom) + '</g>' +
      C(0, 0, 8, STEEL, ' stroke-width="3.5"') + C(0, 0, 2.6, INK, NS) + '</g>';
  }
  function can(L) {
    var c = L.can;
    var hd = 'M-38 -10C-64 -12 -64 26 -40 24';
    var body = Ln(hd, null, 12) + Ln(hd, TANG, 4.5) +
      P('M14 4L58 -30Q62 -33 65 -30L67 -27Q69 -23 66 -20L16 28Z', TANG) +
      '<g transform="translate(66 -28) rotate(-40)">' + P('M-9 6L-6 -7Q0 -10 6 -7L9 6Z', TANG, ' stroke-width="3.5"') +
      C(-3.5, 0, 1.7, INK, NS) + C(3.5, 0, 1.7, INK, NS) + C(0, -4, 1.7, INK, NS) + '</g>' +
      P('M-36 -22H18L24 29Q25 36 18 36H-38Q-45 36 -44 29Z', TANG) +
      R(-41, -29, 64, 11, 5.5, TANG) +
      P('M-14 8C-14 -2 -4 -6 2 -6C2 4 -6 9 -14 8Z', MINT, ' stroke-width="3"') + Ln('M-13 7L-3 -2', INK, 2) +
      Ln('M-35 24Q-36 6 -32 -10', CREAM, 4.5);
    var drops = '';
    DROPS.forEach(function (d) { drops += P(dropD(d[0] * c.s, d[1] * c.s, 15 * Math.max(0.8, c.s)), WHITE, ' class="gl-drop" stroke-width="3"'); });
    return '<g' + at(c.x, c.y, ' scale(' + f(c.s) + ')') + '>' + G('gl-can', '<g transform="rotate(' + c.tilt + ')">' + body + '</g>') + '</g>' +
      '<g' + at(c.x, c.y) + '>' + G('gl-drops', drops) + '</g>';
  }
  function plant(L) {
    var p = L.plant;
    return '<g' + at(p.x, p.y) + '>' + G('gl-plant',
      G('gl-pl-sad', MP.plant('sad', { scale: p.s }), ' opacity="0"') +
      G('gl-pl-happy', MP.plant('happy', { scale: p.s }), ' opacity="0"') +
      G('gl-pl-bloom', MP.plant('bloom', { scale: p.s }))) + '</g>';
  }
  function phone(L) {
    var p = L.phone, s = p.s;
    var buzz = Ln('M-6 80Q-16 110 -6 140M-17 68Q-31 110 -17 152M146 80Q156 110 146 140M157 68Q171 110 157 152', INK, 4 / s);
    return (p.noShadow ? '' : E(p.x + 70 * s, L.floor, 62 * s, 5, INK, NS + ' fill-opacity=".15"')) +
      '<g' + at(p.x, p.y) + '>' + G('gl-phone',
        G('gl-ph-off', MP.phone('blank', { scale: s }), ' opacity="0"') +
        G('gl-ph-on', MP.phone('notify', { scale: s })) +
        G('gl-flash', R(10 * s, 12 * s, 120 * s, 236 * s, 17 * s, CREAM, NS), ' opacity="0"') +
        G('gl-buzz', '<g transform="scale(' + f(s) + ')">' + buzz + '</g>', ' opacity="0"')) + '</g>';
  }
  function appIcon(x, y, size) {
    var k = size / 52;
    return '<g' + at(x, y, ' scale(' + f(k) + ')') + ' stroke-width="' + f(3.4 / k) + '">' + R(0, 0, 52, 52, 15, MINT) +
      P(dropD(24, 8.5, 32), SKY, ' stroke-width="' + f(3 / k) + '"') + Ln('M18 31Q18.5 26 21.5 23', WHITE, 2.8) +
      P('M31 20C33 11 41 7 46 8C46 16 40 22 32 21.5Z', LEAF_D, ' stroke-width="' + f(2.8 / k) + '"') + Ln('M32 21L41 12.5', INK, 1.8) + '</g>';
  }
  function toast(L) {
    var t = L.toast, x0 = t.rx, y0 = t.ry, tail, patch;
    if (t.dir === 'down') {
      var by = y0 + t.h;
      tail = 'M-40 ' + f(by - 2) + 'L0 0L-14 ' + f(by - 2) + 'Z';
      patch = 'M-37 ' + f(by - 4) + 'L-5 ' + f(by - 8) + 'L-17 ' + f(by - 4) + 'Z';
    } else {
      tail = 'M-12 ' + f(y0 + 2) + 'L0 0L14 ' + f(y0 + 2) + 'Z';
      patch = 'M-9.5 ' + f(y0 + 4) + 'L0 ' + f(y0 - 4) + 'L11.5 ' + f(y0 + 4) + 'Z';
    }
    var ix = x0 + 16, tx = ix + t.icon + 16;
    var s = R(x0 + 7, y0 + 7, t.w, t.h, 22, INK, NS) + P(tail, CREAM) + R(x0, y0, t.w, t.h, 22, CREAM) + P(patch, CREAM, NS) +
      appIcon(ix, y0 + (t.h - t.icon) / 2, t.icon) +
      T(tx, y0 + t.row[0], 'Полей меня', t.ts, { display: true, weight: 800 }) +
      T(tx, y0 + t.row[1], 'Фиалка хочет пить.', t.xs, { weight: 600 }) +
      T(tx, y0 + t.row[2], 'Пора полить!', t.xs, { weight: 800, fill: VIOLET });
    return '<g' + at(t.x, t.y) + '>' + G('gl-toast', s) + '</g>';
  }
  function capsule(L) {
    var trail = '', i;
    for (i = 1; i <= TRAIL_N; i++) {
      var q = bez(L.arc, i / (TRAIL_N + 1));
      trail += C(q[0], q[1], 3.6, INK, ' class="gl-tdot" stroke="none" fill-opacity=".35" opacity="0"');
    }
    var cap = Ln('M-58 -10H-46M-66 0H-48M-58 10H-46', INK, 4, ' stroke-opacity=".55"') +
      P('M0 -18H-20A18 18 0 0 0 -20 18H0Z', TANG, NS) + P('M0 -18H20A18 18 0 0 1 20 18H0Z', CREAM, NS) +
      R(-38, -18, 76, 36, 18, 'none') + Ln('M0 -18V18', INK, 3) + Ln('M-28 -8Q-26 -12 -20 -12', CREAM, 3.5) +
      C(20, 0, 7, MINT, ' stroke-width="3"');
    return trail + G('gl-cap', cap, ' opacity="0"');
  }

  function markup(key) {
    var L = LAYOUTS[key], W = L.W, H = L.H;
    var clip = 'gl-clip-' + key;
    var body = backdrop(L) + MP.belt({ x: L.belt.x, y: L.belt.y, w: L.belt.w, h: L.belt.h, legs: L.belt.legs, pitch: L.belt.pitch }) +
      piece(L) + barrier(L) + can(L) + plant(L) + phone(L) + paper(L) + seal(L) + splash(L) + hand(L) + toast(L) + capsule(L);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" class="gl-svg gl-svg--' + key +
      '" focusable="false" aria-hidden="true">' +
      '<defs><clipPath id="' + clip + '"><rect x="4" y="4" width="' + (W - 16) + '" height="' + (H - 16) + '" rx="26"/></clipPath></defs>' +
      '<g stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">' +
      R(12, 12, W - 16, H - 16, 26, INK, NS) +
      G('gl-shake', R(4, 4, W - 16, H - 16, 26, CREAM, NS) + '<g clip-path="url(#' + clip + ')">' + body + '</g>' +
        R(4, 4, W - 16, H - 16, 26, 'none')) +
      '</g></svg>';
  }

  /* ---------- DOM ---------- */
  function trees(sec) { return MP.$$('.gl-svg', sec).map(refs); }
  function refs(svg) {
    var key = svg.classList.contains('gl-svg--tall') ? 'tall' : 'wide';
    var q = function (s) { return svg.querySelector(s); }, qa = function (s) { return MP.$$(s, svg); };
    return {
      key: key, L: LAYOUTS[key], svg: svg, shake: q('.gl-shake'), bob: q('.gl-bob'), hand: q('.gl-hand'), seal: q('.gl-seal'),
      splash: q('.gl-splash'), rays: qa('.gl-ray'), dots: qa('.gl-dot'), paper: q('.gl-paper'),
      lampY: q('.gl-lamp-y'), lampG: q('.gl-lamp-g'), halo: q('.gl-halo'), boom: q('.gl-boom'), piece: q('.gl-piece'),
      chev: qa('.belt-chev'), rollers: qa('.belt-roller'), cap: q('.gl-cap'), trail: qa('.gl-tdot'),
      phone: q('.gl-phone'), phOff: q('.gl-ph-off'), phOn: q('.gl-ph-on'), flash: q('.gl-flash'), buzz: q('.gl-buzz'),
      toast: q('.gl-toast'), can: q('.gl-can'), dropsG: q('.gl-drops'), drops: qa('.gl-drop'), plant: q('.gl-plant'),
      sad: q('.gl-pl-sad'), happy: q('.gl-pl-happy'), bloom: q('.gl-pl-bloom'),
      stems: qa('.gl-pl-bloom .c-stem'), flowers: qa('.gl-pl-bloom .c-flower'), sparkles: qa('.gl-pl-bloom .c-sparkle')
    };
  }
  function shared(sec) {
    var chips = MP.$$('.stop-chip', sec);
    return {
      chips: chips, checks: MP.$$('.gl-chk', sec), glows: MP.$$('.gl-glow', sec),
      btn: MP.$('[data-action="stamp"]', sec), memo: MP.$('.memo', sec), after: MP.$$('[data-after-stamp] > *', sec)
    };
  }
  function setLabel(S, stamped) {
    if (!S.btn) return;
    var lab = S.btn.querySelector('.gl-btn-label'), use = S.btn.querySelector('use');
    if (lab) lab.textContent = stamped ? 'Ещё раз' : 'Поставить печать';
    if (use) use.setAttribute('href', stamped ? '#i-replay' : '#i-stamp');
    S.btn.classList.toggle('is-stamped', !!stamped);
  }
  function visibleTree(T) {
    var tall = window.matchMedia && window.matchMedia(TALL_MQ).matches;
    for (var i = 0; i < T.length; i++) if ((T[i].key === 'tall') === !!tall) return T[i];
    return T[0];
  }

  var NOTE_ICONS = [
    /* paper plane */
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M2.8 11.2L21 3.2L14.6 20.8L11.2 13.2Z" fill="' + CREAM + '" stroke="' + INK +
      '" stroke-width="2.2" stroke-linejoin="round"/><path d="M11.2 13.2L21 3.2" fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round"/></svg>',
    /* open journal */
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 6.5Q8 4 3.5 5V19Q8 18 12 20.5Q16 18 20.5 19V5Q16 4 12 6.5Z" fill="' + CREAM + '" stroke="' + INK +
      '" stroke-width="2.2" stroke-linejoin="round"/><path d="M12 6.5V20.5M6 9.2Q8 8.8 9.8 9.8M6 12.8Q8 12.4 9.8 13.4" fill="none" stroke="' + INK + '" stroke-width="1.8" stroke-linecap="round"/></svg>'
  ];

  /* The phone's own notification (chars.js) is lettered at 11 units — far below 16px on any stage. The big
   * notification bubble carries the words, so inside the phone every small line becomes a rounded bar of the same
   * colour (only the large «09:00» stays lettering). */
  function barPhoneText(svg) {
    MP.$$('.gl-ph-on text', svg).forEach(function (t) {
      if (t.classList.contains('ph-time')) return;
      var fs = parseFloat(t.getAttribute('font-size')) || 11, x = parseFloat(t.getAttribute('x')) || 0,
        y = parseFloat(t.getAttribute('y')) || 0, w = Math.min(98, Math.max(24, t.textContent.length * fs * 0.5)),
        h = fs * 0.46, bar = document.createElementNS(SVGNS, 'rect');
      if (t.getAttribute('text-anchor') === 'middle') x -= w / 2;
      [['x', x], ['y', y - fs * 0.6], ['width', w], ['height', h], ['rx', h / 2]].forEach(function (a) { bar.setAttribute(a[0], f(a[1])); });
      bar.setAttribute('fill', t.getAttribute('fill') || INK);
      bar.setAttribute('fill-opacity', '.42');
      bar.setAttribute('stroke', 'none');
      t.parentNode.replaceChild(bar, t);
    });
  }

  function build(sec, api) {
    var stage = api.stage;
    if (!stage) return;
    stage.innerHTML = markup('wide') + markup('tall');
    MP.$$('.gl-svg', stage).forEach(barPhoneText);
    /* chips and notes get their icons here; scenes-c.css reserves the room for them up front (html.js), so this
     * lazy build never changes the height of the section */
    MP.$$('.stop-chip', sec).forEach(function (chip) {
      if (chip.querySelector('.gl-chk')) return;
      chip.insertAdjacentHTML('beforeend', '<span class="gl-chk" aria-hidden="true"><svg class="ico" focusable="false"><use href="#i-check"/></svg></span>' +
        '<span class="gl-glow" aria-hidden="true"></span>');
    });
    /* the two «after» lines become little sticker notes: a paper plane (delivery) and the project journal */
    MP.$$('[data-after-stamp] > p', sec).forEach(function (p, i) {
      if (p.querySelector('.gl-note-ico')) return;
      p.insertAdjacentHTML('afterbegin', '<span class="gl-note-ico" aria-hidden="true">' + NOTE_ICONS[i % NOTE_ICONS.length] + '</span>');
    });
    var btn = MP.$('[data-action="stamp"]', sec);
    if (btn && !btn.querySelector('.gl-btn-label')) {
      var nodes = Array.prototype.slice.call(btn.childNodes);
      nodes.forEach(function (n) {
        if (n.nodeType === 3 && /\S/.test(n.nodeValue)) {
          var span = document.createElement('span');
          span.className = 'gl-btn-label';
          span.textContent = n.nodeValue.trim();
          btn.replaceChild(span, n);
        }
      });
    }
    /* «waiting for you» halo around the lemon button (animated only in init; hidden once stamped) */
    if (btn && !btn.querySelector('.gl-btn-halo')) btn.insertAdjacentHTML('afterbegin', '<span class="gl-btn-halo" aria-hidden="true"></span>');
  }

  /* Pre-stamp state: every value the timeline animates away from, and every transform origin, is set HERE.
   * The timeline itself only uses to() and set(): a fromTo(..., {immediateRender:false}) would be reverted to its
   * FROM values by gsap.context().revert() (calm switch), and an origin given mid-way (after a scale) is shifted
   * by GSAP's smoothOrigin. */
  function setPre(g, T, S) {
    T.forEach(function (R) {
      var L = R.L;
      g.set([R.dots, R.trail, R.lampG, R.buzz], { transformOrigin: '50% 50%' });
      g.set(R.piece, { transformOrigin: '50% 100%' });
      g.set(R.bob, { autoAlpha: 1 });
      g.set(R.seal, { autoAlpha: 0, scale: 1.9 });
      g.set(R.rays, { drawSVG: '0% 0%' });
      g.set(R.dots, { scale: 0 });
      g.set(R.lampY, { autoAlpha: 1 });
      g.set(R.lampG, { autoAlpha: 0, scale: 0.3 });
      g.set(R.trail, { scale: 0 });
      g.set(R.buzz, { scale: 0.85 });
      g.set(R.drops, { y: -24, autoAlpha: 0 });
      g.set(R.stems, { scaleY: 0 });
      g.set(R.flowers, { scale: 0, rotation: -70 });
      g.set(R.sparkles, { scale: 0, rotation: -90 });
      g.set(R.boom, { rotation: -L.barrier.up, svgOrigin: '0 0' });
      g.set(R.piece, { autoAlpha: 1 });
      g.set(R.phOff, { autoAlpha: 1 });
      g.set(R.phOn, { autoAlpha: 0 });
      g.set(R.phone, { svgOrigin: f(70 * L.phone.s) + ' ' + f(150 * L.phone.s) });
      g.set(R.toast, { autoAlpha: 0, scale: 0.3, svgOrigin: '0 0' });
      g.set(R.can, { x: (L.can.px - L.can.x) / L.can.s, y: (L.floor - 34 * L.can.s - L.can.y) / L.can.s, rotation: -L.can.tilt, svgOrigin: '0 0' });
      g.set(R.dropsG, { autoAlpha: 0 });
      g.set(R.plant, { svgOrigin: f(60 * L.plant.s) + ' ' + f(134 * L.plant.s) });
      g.set(R.sad, { autoAlpha: 1 });
      g.set(R.happy, { autoAlpha: 0 });
      g.set(R.bloom, { autoAlpha: 0 });
      g.set(R.cap, { svgOrigin: '0 0' });
      g.set(R.cap, { scale: 0.4 });
    });
    if (S.checks[3]) g.set(S.checks[3], { scale: 0, rotation: -40 });
    /* opacity, not autoAlpha: the notes stay in the accessibility tree before the stamp */
    g.set(S.after, { opacity: 0, y: 14 });
  }

  function treeTimeline(g, R, pitch) {
    var L = R.L, tl = g.timeline(), hs = L.hand.s, drop = L.hand.lift / hs;
    /* 0 · the stamp slams */
    tl.to(R.hand, { y: drop, duration: 0.2, ease: 'power4.in' }, 0);
    tl.to(R.seal, { autoAlpha: 1, scale: 0.92, duration: 0.18, ease: 'power4.in' }, 0.03);
    tl.to(R.seal, { scale: 1, duration: 0.4, ease: 'elastic.out(1,.4)' }, 0.21);
    tl.to(R.hand, { scaleY: 0.93, duration: 0.07, yoyo: true, repeat: 1, ease: 'power1.out' }, 0.2);
    tl.to(R.shake, { keyframes: { x: [-6, 5, -3, 0] }, duration: 0.3, ease: 'none' }, 0.2);
    tl.to(R.paper, { y: 3, duration: 0.06, yoyo: true, repeat: 1, ease: 'power1.out' }, 0.2);
    tl.set(R.splash, { autoAlpha: 1 }, 0.2);
    tl.to(R.rays, { drawSVG: '0% 100%', duration: 0.16, ease: 'power2.out' }, 0.2);
    tl.to(R.rays, { drawSVG: '100% 100%', duration: 0.24, ease: 'power2.in' }, 0.36);
    tl.to(R.dots, { scale: 1, duration: 0.3, ease: 'back.out(3)', stagger: 0.03 }, 0.22);
    tl.to(R.splash, { autoAlpha: 0, duration: 0.2 }, 0.62);
    /* 0.36 · job done: the hand bounces off the sheet and leaves the frame, the seal stays */
    tl.to(R.hand, { y: -drop * 0.4, duration: 0.24, ease: 'power2.out' }, 0.36);
    tl.to(R.hand, { y: handExit(L), duration: 0.5, ease: 'power2.in' }, 0.66);
    tl.set(R.bob, { autoAlpha: 0 }, 1.17);
    /* 0.55 · the gate opens */
    tl.to(R.lampY, { autoAlpha: 0, duration: 0.12 }, 0.55);
    tl.to(R.lampG, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'elastic.out(1,.5)' }, 0.55);
    tl.to(R.boom, { rotation: 0, duration: 0.6, ease: 'back.out(1.4)' }, 0.62);
    /* 0.95 · the piece rides to the end of the belt */
    tl.to(R.piece, { x: L.piece.ride / L.piece.s, duration: 0.75, ease: 'power2.inOut' }, 0.95);
    tl.to(R.chev, { x: pitch, duration: 0.25, ease: 'none', repeat: 2 }, 0.95);
    tl.to(R.rollers, { rotation: 360, duration: 0.75, ease: 'power2.inOut' }, 0.95);
    /* 1.7 · it squashes into a capsule and flies into the phone */
    tl.to(R.piece, { scaleX: 1.22, scaleY: 0.66, duration: 0.12, ease: 'power2.in' }, 1.7);
    tl.to(R.piece, { autoAlpha: 0, duration: 0.08 }, 1.82);
    tl.set(R.cap, { autoAlpha: 1 }, 1.82);
    tl.to(R.cap, { scale: 1, duration: 0.22, ease: 'back.out(2)' }, 1.82);
    tl.to(R.cap, { motionPath: { path: bezD(L.arc), autoRotate: true }, duration: 0.9, ease: 'power1.inOut' }, 1.82);
    tl.to(R.trail, { autoAlpha: 1, scale: 1, duration: 0.14, ease: 'back.out(2)', stagger: 0.9 / (TRAIL_N + 1) }, 1.88);
    tl.to(R.trail, { autoAlpha: 0, duration: 0.3, stagger: 0.025 }, 2.9);
    /* 2.72 · the phone wakes up and buzzes */
    tl.to(R.cap, { scale: 0.2, autoAlpha: 0, duration: 0.14, ease: 'power2.in' }, 2.7);
    tl.to(R.phOff, { autoAlpha: 0, duration: 0.15 }, 2.78);
    tl.to(R.phOn, { autoAlpha: 1, duration: 0.15 }, 2.78);
    tl.set(R.flash, { autoAlpha: 0.95 }, 2.78);
    tl.to(R.flash, { autoAlpha: 0, duration: 0.5, ease: 'power1.out' }, 2.78);
    tl.to(R.phone, { keyframes: { rotation: [-5, 5, -4, 4, -2, 0] }, duration: 0.6, ease: 'none' }, 2.8);
    tl.to(R.phone, { scale: 1.06, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' }, 2.8);
    tl.to(R.buzz, { autoAlpha: 1, duration: 0.12 }, 2.82);
    tl.to(R.buzz, { scale: 1.08, duration: 0.2, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 2.82);
    tl.to(R.buzz, { autoAlpha: 0, duration: 0.25 }, 3.6);
    /* 3.0 · the notification pops out */
    tl.to(R.toast, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(1.7)' }, 3.0);
    /* 3.5 · the watering can lifts and pours */
    tl.to(R.can, { x: 0, duration: 0.6, ease: 'power1.inOut' }, 3.5);
    tl.to(R.can, { y: 0, duration: 0.6, ease: 'back.out(1.6)' }, 3.5);
    tl.to(R.can, { rotation: -L.can.tilt * 0.4, duration: 0.45, ease: 'power2.out' }, 3.5);
    tl.to(R.can, { rotation: 0, duration: 0.35, ease: 'back.out(2.2)' }, 4.05);
    tl.set(R.dropsG, { autoAlpha: 1 }, 4.2);
    tl.to(R.drops, { y: 0, autoAlpha: 1, duration: 0.32, ease: 'power1.in', stagger: { each: 0.09, repeat: 2 } }, 4.2);
    /* 4.5 · the фиалка perks up … */
    tl.to(R.plant, { scaleY: 0.86, scaleX: 1.07, duration: 0.14, ease: 'power2.in' }, 4.55);
    tl.to(R.plant, { scaleY: 1.12, scaleX: 0.95, duration: 0.16, ease: 'power2.out' }, 4.69);
    tl.set(R.sad, { autoAlpha: 0 }, 4.7);
    tl.set(R.happy, { autoAlpha: 1 }, 4.7);
    tl.to(R.plant, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1,.45)' }, 4.85);
    /* 5.2 · … and blooms */
    tl.set(R.happy, { autoAlpha: 0 }, 5.2);
    tl.set(R.bloom, { autoAlpha: 1 }, 5.2);
    tl.to(R.stems, { scaleY: 1, duration: 0.3, ease: 'power2.out', stagger: 0.07 }, 5.2);
    tl.to(R.flowers, { scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(2.6)', stagger: 0.12 }, 5.32);
    tl.to(R.sparkles, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(3)', stagger: 0.1 }, 5.6);
    return tl;
  }

  /* master timeline shared by init (played) and final (parked at the end) */
  function master(g, T, S, calm) {
    var tl = g.timeline({ paused: true });
    var pitch = 0;
    T.forEach(function (R) {
      pitch = R.L.belt.pitch;
      tl.add(treeTimeline(g, R, pitch), 0);
    });
    if (S.checks[3]) tl.to(S.checks[3], { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(3)' }, 0.24);
    if (S.glows[3]) {
      tl.set(S.glows[3], { autoAlpha: 0.95, scale: 0.92 }, 0.24);
      tl.to(S.glows[3], { autoAlpha: 0, scale: 1.2, duration: 0.7, ease: 'power2.out' }, 0.24);
    }
    tl.to(S.after, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.16 }, 5.7);
    if (!calm) {
      tl.call(function () {
        if (tl.reversed()) return;
        var R = visibleTree(T), box = R.seal.getBoundingClientRect();
        /* only when the seal is on screen (the page may have been scrolled away since the click) */
        if (box.bottom < 0 || box.top > (window.innerHeight || 0)) return;
        MP.confetti && MP.confetti({ el: R.seal, count: 150, power: 1.05, colors: [LEMON, VIOLET, MINT, SKY, TANG, CREAM, RASP] });
      }, null, 0.22);
    }
    return tl;
  }

  /* stop-chips light up in sequence when they scroll in (checks 1–3; the 4th waits for the stamp) */
  function chipsIntro(g, S) {
    if (!S.chips.length || !window.ScrollTrigger) return;
    var ct = g.timeline({ paused: true });
    g.set(S.chips, { opacity: 0.4, scale: 0.94 });
    g.set(S.checks.slice(0, 3), { scale: 0 });
    S.chips.forEach(function (chip, i) {
      var t0 = i * 0.28;
      ct.to(chip, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2.2)' }, t0);
      if (S.glows[i]) {
        ct.set(S.glows[i], { autoAlpha: 0.95, scale: 0.94 }, t0 + 0.05);
        ct.to(S.glows[i], { autoAlpha: 0, scale: 1.14, duration: 0.7, ease: 'power2.out' }, t0 + 0.05);
      }
      if (i < 3 && S.checks[i]) ct.to(S.checks[i], { scale: 1, duration: 0.45, ease: 'back.out(3)' }, t0 + 0.16);
    });
    window.ScrollTrigger.create({ trigger: S.chips[0].parentNode, start: 'top 78%', once: true, onEnter: function () { ct.play(); } });
  }

  /* Animated mode. Nothing is stamped until the visitor presses the button: «Без вашей печати ничего не выходит». */
  function init(sec, api) {
    var g = api.gsap, T = trees(sec), S = shared(sec);
    if (!T.length) return;
    var ctx = g.context(function () {});   // nested in the scene's matchMedia context: handler-made tweens go here
    setPre(g, T, S);
    setLabel(S, false);
    var tl = master(g, T, S, false);
    var busy = false;

    /* Idle loops, both owned by api.loop (they play only while the section is on screen and the tab is visible;
     * this scene never calls play() on them itself):
     *  · wait — the lemon lamp breathes, the фиалка sways, the button's lemon halo pulses (the halo and the lamp
     *    are simply hidden once stamped, so the loop may keep running);
     *  · bob — the «вы» hand hovers over the sheet; paused for good on the first stamp (after it the hand is gone). */
    var bobs = T.map(function (R) { return R.bob; }), halos = T.map(function (R) { return R.halo; }),
      plants = T.map(function (R) { return R.plant; }), btnHalo = S.btn && S.btn.querySelector('.gl-btn-halo');
    var wait = g.timeline({ repeat: -1, yoyo: true });
    g.set(halos, { transformOrigin: '50% 50%', scale: 0.7, autoAlpha: 0.9 });
    wait.to(halos, { scale: 1.3, autoAlpha: 0.15, duration: 1.3, ease: 'sine.inOut' }, 0);
    g.set(plants, { rotation: -1.8 });
    wait.to(plants, { rotation: 1.8, duration: 1.3, ease: 'sine.inOut' }, 0);
    if (btnHalo) {
      g.set(btnHalo, { opacity: 1, scale: 0.98 });
      wait.to(btnHalo, { opacity: 0.2, scale: 1.08, duration: 1.3, ease: 'sine.inOut' }, 0);
    }
    api.loop(wait);
    var bob = g.timeline({ repeat: -1, yoyo: true });
    bob.to(bobs, { y: -8, duration: 1.3, ease: 'sine.inOut' }, 0);
    api.loop(bob);
    MP.blink(api.stage, api);

    function play() {
      busy = true;
      bob.pause();
      ctx.add(function () { g.to(bobs, { y: 0, duration: 0.12, ease: 'power2.out', overwrite: 'auto' }); });
      tl.timeScale(1).play();
    }
    tl.eventCallback('onComplete', function () {
      busy = false;
      setLabel(S, true);
      api.live(STAMPED);   // only ever reached from a click: there is no automatic stamp
    });
    tl.eventCallback('onReverseComplete', function () { play(); });
    function stamp() {
      if (busy) return;
      if (tl.progress() === 0) play();
      else { busy = true; tl.timeScale(4.5).reverse(); }
    }
    api.on(S.btn, 'click', stamp);
    chipsIntro(g, S);
  }

  /* Calm mode: the same pre-stamp state (sad фиалка, lemon lamp, the hand over the sheet, «Выпуск» unchecked);
   * the button switches between the two end states instantly. */
  function final(sec, api) {
    var g = api.gsap, T = trees(sec), S = shared(sec);
    if (!T.length) return;
    if (!g) {   /* vendor scripts missing: the built DOM is the stamped state and cannot be rewound */
      setLabel(S, true);
      api.on(S.btn, 'click', function () { api.live(STAMPED); });
      return;
    }
    setPre(g, T, S);
    var tl = master(g, T, S, true);
    tl.progress(0, true);
    setLabel(S, false);
    api.on(S.btn, 'click', function () {
      var stamped = tl.progress() > 0.5;
      tl.progress(stamped ? 0 : 1, true);
      setLabel(S, !stamped);
      api.live(stamped ? UNSTAMPED : STAMPED);
    });
  }

  MP.scene('glavnyi', { build: build, init: init, final: final });
})();
