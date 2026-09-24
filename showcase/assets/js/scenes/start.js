/* scenes/start.js — «Сказано — сделано.» hero: the idea machine (package A, docs/design-prosto.md §2.1).
 * build  : machine SVG (viewBox 600×600) + HTML overlays inside [data-stage] (idea bubbles, product tags),
 *          slam effect inside the H1 — all in the FINAL poster state (idea «цветы» → machine → phone «Полей меня»).
 * init   : on-load choreography (words drop, «сделано.» slams — the full stop splashes into a lemon ink splat with
 *          droplets, rays and a shock ring — machine assembles) + first idea, then 4 more
 *          idea cycles (7 s each) in ONE timeline registered through api.loop; desktop pointer parallax.
 * final  : calm — the poster state, no loop. */
(function () {
  'use strict';
  var MP = window.MP;

  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', MINT = '#2BD99F', RASP = '#FF4F8B',
    SKY = '#3EC5FF', TANG = '#FF8A1F', STEEL = '#C9D3E6', STEEL_D = '#8E9BB8', WHITE = '#FFFFFF', LEAF = '#1BB283';

  /* the four ideas; [0] is the story app and the resting poster state */
  var IDEAS = [
    { text: 'Хочу напоминалку для цветов', app: 'Полей меня', screen: VIOLET, emblem: 'sprout' },
    { text: 'Хочу считать семейные расходы', app: 'Копилка', screen: SKY, emblem: 'coin' },
    { text: 'Хочу игру-раскраску для внучки', app: 'Раскраска', screen: RASP, emblem: 'crayon' },
    { text: 'Хочу записываться к парикмахеру', app: 'Стрижка', screen: TANG, emblem: 'scissors' }
  ];

  /* ---------- markup helpers ---------- */
  function f(v) { return String(Math.round(v * 100) / 100); }
  function R(x, y, w, h, rx, fill, ex) {
    return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' + (rx ? ' rx="' + f(rx) + '"' : '') +
      ' fill="' + fill + '"' + (ex || '') + '/>';
  }
  function C(cx, cy, r, fill, ex) { return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + fill + '"' + (ex || '') + '/>'; }
  function E(cx, cy, rx, ry, fill, ex) {
    return '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" fill="' + fill + '"' + (ex || '') + '/>';
  }
  function P(d, fill, ex) { return '<path d="' + d + '" fill="' + fill + '"' + (ex || '') + '/>'; }
  function L(d, col, w, ex) { return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (ex || '') + '/>'; }
  function G(cls, inner, ex) { return '<g' + (cls ? ' class="' + cls + '"' : '') + (ex || '') + '>' + inner + '</g>'; }
  var NS = ' stroke="none"';
  function gearD(cx, cy, r, n) {
    var d = '', ri = r * 0.76, step = Math.PI * 2 / n;
    for (var i = 0; i < n; i++) {
      var a = i * step, pts = [[ri, a - step * 0.5], [ri, a - step * 0.24], [r, a - step * 0.16], [r, a + step * 0.16], [ri, a + step * 0.24]];
      for (var k = 0; k < pts.length; k++) {
        d += (i || k ? 'L' : 'M') + f(cx + pts[k][0] * Math.cos(pts[k][1])) + ' ' + f(cy + pts[k][0] * Math.sin(pts[k][1]));
      }
    }
    return d + 'Z';
  }
  function gear(cx, cy, r, n, fill, cls) {
    return G(cls, P(gearD(cx, cy, r, n), fill) + C(cx, cy, r * 0.34, CREAM, ' stroke-width="3.5"') + C(cx, cy, r * 0.12, INK, NS));
  }
  function spark(cx, cy, r, fill, ex) {
    var k = r * 0.26;
    return P('M' + f(cx) + ' ' + f(cy - r) + 'Q' + f(cx + k) + ' ' + f(cy - k) + ' ' + f(cx + r) + ' ' + f(cy) + 'Q' + f(cx + k) + ' ' +
      f(cy + k) + ' ' + f(cx) + ' ' + f(cy + r) + 'Q' + f(cx - k) + ' ' + f(cy + k) + ' ' + f(cx - r) + ' ' + f(cy) + 'Q' + f(cx - k) +
      ' ' + f(cy - k) + ' ' + f(cx) + ' ' + f(cy - r) + 'Z', fill, ex);
  }
  function polar(cx, cy, r, deg) { var t = deg * Math.PI / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; }
  function arc(cx, cy, r, a0, a1) {
    var p0 = polar(cx, cy, r, a0), p1 = polar(cx, cy, r, a1);
    return 'M' + f(p0[0]) + ' ' + f(p0[1]) + 'A' + r + ' ' + r + ' 0 0 1 ' + f(p1[0]) + ' ' + f(p1[1]);
  }

  /* ---------- geometry (viewBox 0 0 600 600) ---------- */
  var WIN = { x: 182, y: 380, r: 56 };          // porthole glass
  var PANEL = { x: 280, y: 288, w: 104, h: 200 };
  var LAMPS = [305, 332, 359], LAMP_Y = 316;
  var GAUGE = { x: 332, y: 388, r: 33 };
  var PHONE = { x: 516, y: 548, w: 112, h: 212 };  // bottom-centre of the phone at rest
  var FLOOR = 548;

  /* phone app icons (52×52 local box) */
  function iconPlant() {
    return R(0, 0, 52, 52, 15, MINT, ' stroke-width="3.6"') +
      P('M24 8.5C24 8.5 12 22 12 29.5A12 12 0 0 0 36 29.5C36 22 24 8.5 24 8.5Z', SKY, ' stroke-width="3.2"') +
      L('M18 31Q18.5 26 21.5 23', WHITE, 2.8, ' stroke-linecap="round"') +
      P('M31 20C33 11 41 7 46 8C46 16 40 22 32 21.5Z', LEAF, ' stroke-width="3"') + L('M32 21L41 12.5', INK, 1.8);
  }
  function iconCoins() {
    return R(0, 0, 52, 52, 15, CREAM, ' stroke-width="3.6"') +
      E(26, 36, 14, 5.5, TANG, ' stroke-width="3"') + P('M12 36V31H40V36', TANG, ' stroke-width="3"') + E(26, 31, 14, 5.5, TANG, ' stroke-width="3"') +
      P('M12 31V25H40V31', TANG, ' stroke-width="3"') + E(26, 25, 14, 5.5, TANG, ' stroke-width="3"') +
      C(26, 15, 9, MINT, ' stroke-width="3"') + L('M26 11V19M23 13.5h6', INK, 2.2, ' stroke-linecap="round"');
  }
  function iconPaint() {
    return R(0, 0, 52, 52, 15, CREAM, ' stroke-width="3.6"') +
      P('M11 30C8 20 16 10 27 10C38 10 44 18 42 26C41 31 36 30 33 31C30 32 31 36 29 39C26 43 14 40 11 30Z', SKY, ' stroke-width="3"') +
      C(20, 22, 3.6, RASP, ' stroke-width="2.2"') + C(28, 17, 3.6, MINT, ' stroke-width="2.2"') + C(35, 22, 3.6, TANG, ' stroke-width="2.2"') +
      C(19, 31, 3.6, VIOLET, ' stroke-width="2.2"');
  }
  function iconScissors() {
    return R(0, 0, 52, 52, 15, CREAM, ' stroke-width="3.6"') +
      L('M17 12L33 36M35 12L19 36', INK, 3.6, ' stroke-linecap="round"') +
      C(17, 39, 6, SKY, ' stroke-width="3"') + C(35, 39, 6, SKY, ' stroke-width="3"') + C(26, 24, 2.2, CREAM, ' stroke-width="1.8"');
  }
  var ICONS = { sprout: iconPlant, coin: iconCoins, crayon: iconPaint, scissors: iconScissors };

  function phoneScreen(i) {
    var idea = IDEAS[i], w = PHONE.w, h = PHONE.h;
    var s = R(7, 9, w - 14, h - 18, 15, idea.screen, NS) +
      C(w - 12, 48, 34, WHITE, NS + ' fill-opacity=".12"') + C(16, h - 40, 30, WHITE, NS + ' fill-opacity=".1"');
    for (var k = 0; k < 4; k++) s += R(19 + k * 20, 32, 13, 13, 4, CREAM, NS + ' fill-opacity=".3"');
    for (k = 0; k < 4; k++) s += R(19 + k * 20, 163, 13, 13, 4, CREAM, NS + ' fill-opacity=".3"');
    s += G('st-app', ICONS[idea.emblem](), ' transform="translate(' + f((w - 62) / 2) + ' 76) scale(1.19)"');
    return G('st-screen st-screen--' + i, s, i ? ' opacity="0" visibility="hidden"' : '');
  }
  function phone() {
    var w = PHONE.w, h = PHONE.h, s = '';
    s += R(0, 0, w, h, 22, INK);
    for (var i = 0; i < IDEAS.length; i++) s += phoneScreen(i);
    s += P('M7 60L58 9H80L7 82Z', WHITE, NS + ' fill-opacity=".1"') + R(w / 2 - 15, 15, 30, 8, 4, INK, NS) +
      R(w / 2 - 18, h - 16, 36, 3.5, 1.75, CREAM, NS + ' fill-opacity=".55"');
    return G('st-phone', s, ' transform="translate(' + f(PHONE.x - w / 2) + ' ' + f(PHONE.y - h) + ')"');
  }

  /* emblems above the phone: sprout / coin / crayon squiggle / scissors */
  function emblems() {
    var cx = PHONE.x - 4, top = PHONE.y - PHONE.h - 6, out = '';
    out += G('st-emb st-emb--0',
      L('M' + cx + ' ' + top + 'C' + (cx - 2) + ' ' + (top - 18) + ' ' + (cx + 4) + ' ' + (top - 30) + ' ' + cx + ' ' + (top - 44), INK, 9, ' stroke-linecap="round" class="st-stem-o"') +
      L('M' + cx + ' ' + top + 'C' + (cx - 2) + ' ' + (top - 18) + ' ' + (cx + 4) + ' ' + (top - 30) + ' ' + cx + ' ' + (top - 44), LEAF, 4, ' stroke-linecap="round" class="st-stem-i"') +
      G('st-leaf st-leaf--l', P('M' + cx + ' ' + (top - 40) + 'C' + (cx - 10) + ' ' + (top - 60) + ' ' + (cx - 34) + ' ' + (top - 58) + ' ' + (cx - 40) + ' ' + (top - 50) +
        'C' + (cx - 32) + ' ' + (top - 34) + ' ' + (cx - 12) + ' ' + (top - 32) + ' ' + cx + ' ' + (top - 40) + 'Z', MINT, ' stroke-width="4"')) +
      G('st-leaf st-leaf--r', P('M' + cx + ' ' + (top - 44) + 'C' + (cx + 6) + ' ' + (top - 68) + ' ' + (cx + 30) + ' ' + (top - 74) + ' ' + (cx + 40) + ' ' + (top - 66) +
        'C' + (cx + 36) + ' ' + (top - 48) + ' ' + (cx + 16) + ' ' + (top - 38) + ' ' + cx + ' ' + (top - 44) + 'Z', MINT, ' stroke-width="4"')), '');
    out += G('st-emb st-emb--1',
      G('st-coin', C(cx, top - 34, 24, TANG, ' stroke-width="4"') + C(cx, top - 34, 16, 'none', ' stroke-width="3" stroke-opacity=".45"') +
        L('M' + (cx - 6) + ' ' + (top - 44) + 'h8a6 6 0 0 1 0 12h-8M' + (cx - 6) + ' ' + (top - 44) + 'v22M' + (cx - 10) + ' ' + (top - 26) + 'h12', INK, 3.4,
          ' stroke-linecap="round" stroke-linejoin="round"') + L('M' + (cx - 15) + ' ' + (top - 44) + 'q3-6 9-8', WHITE, 3, ' stroke-linecap="round"')),
      ' opacity="0" visibility="hidden"');
    out += G('st-emb st-emb--2',
      L('M' + (cx - 44) + ' ' + (top - 20) + 'q11-26 22 0t22 0t22 0t22 0', RASP, 7, ' stroke-linecap="round" class="st-squiggle"') +
      G('st-crayon', R(cx + 34, top - 70, 16, 46, 4, SKY, ' stroke-width="3.5" transform="rotate(28 ' + (cx + 42) + ' ' + (top - 47) + ')"') +
        P('M' + (cx + 34) + ' ' + (top - 24) + 'l16 0l-8 16z', CREAM, ' stroke-width="3.5" stroke-linejoin="round" transform="rotate(28 ' + (cx + 42) + ' ' + (top - 47) + ')"')),
      ' opacity="0" visibility="hidden"');
    out += G('st-emb st-emb--3',
      G('st-blade st-blade--a', L('M' + (cx - 22) + ' ' + (top - 66) + 'L' + (cx + 12) + ' ' + (top - 22), INK, 7, ' stroke-linecap="round"') +
        C(cx + 17, top - 14, 9, SKY, ' stroke-width="4"')) +
      G('st-blade st-blade--b', L('M' + (cx + 22) + ' ' + (top - 66) + 'L' + (cx - 12) + ' ' + (top - 22), INK, 7, ' stroke-linecap="round"') +
        C(cx - 17, top - 14, 9, SKY, ' stroke-width="4"')) + C(cx, top - 40, 3, CREAM, ' stroke-width="2.4"'),
      ' opacity="0" visibility="hidden"');
    return G('st-emblems', out);
  }

  function machine() {
    var s = '';
    /* gears peeking behind the top-left corner */
    s += G('st-gears', gear(84, 250, 44, 10, STEEL, 'st-gear st-gear--a') + gear(34, 196, 26, 8, SKY, 'st-gear st-gear--b'));
    /* chimney */
    s += G('st-chimney', R(318, 150, 46, 110, 0, SKY) + R(318, 176, 46, 12, 0, CREAM) + R(318, 206, 46, 12, 0, CREAM) +
      L('M326 196V240', WHITE, 4, ' stroke-linecap="round" stroke-opacity=".6"') + R(308, 136, 66, 20, 7, INK));
    /* funnel */
    s += G('st-funnel',
      R(160, 214, 44, 44, 0, CREAM) + L('M168 222V250', INK, 3, ' stroke-opacity=".25"') +
      P('M98 122H266L208 220H156Z', CREAM) +
      G('', L('M96 150L180 100M112 190L220 124M150 222L268 150M190 232L290 172', RASP, 15), ' clip-path="url(#st-funnel-clip)"') +
      P('M98 122H266L208 220H156Z', 'none') +
      R(88, 104, 188, 24, 12, SKY) + L('M104 112H196', WHITE, 4, ' stroke-linecap="round" stroke-opacity=".75"'), '');
    /* feet */
    s += G('st-feet', R(108, 506, 58, 42, 16, INK) + R(300, 506, 58, 42, 16, INK));
    /* body */
    s += G('st-body',
      R(80, 260, 330, 272, 48, INK, NS) +
      R(70, 250, 330, 272, 48, TANG) +
      L('M92 300Q92 272 116 264', CREAM, 6, ' stroke-linecap="round"') +
      C(98, 500, 4, INK, NS) + C(126, 506, 4, INK, NS) + C(246, 508, 4, INK, NS) + C(270, 506, 4, INK, NS));
    /* porthole with the Бригадир */
    var glass = C(WIN.x, WIN.y, WIN.r, SKY, NS) +
      E(WIN.x - 4, WIN.y + 44, 44, 18, WHITE, NS + ' fill-opacity=".22"') +
      MP.char('brigadir', { x: WIN.x - 67, y: WIN.y - 84, scale: 1.12, cls: 'st-brig' });
    var rivets = '';
    for (var k = 0; k < 8; k++) { var p = polar(WIN.x, WIN.y, WIN.r + 11, k * 45 + 22.5); rivets += C(p[0], p[1], 3.2, INK, NS); }
    s += G('st-window',
      C(WIN.x, WIN.y, WIN.r + 20, CREAM, ' stroke-width="5"') + rivets +
      G('st-glass', glass, ' clip-path="url(#st-win-clip)"') +
      C(WIN.x, WIN.y, WIN.r, 'none', ' stroke-width="5"') +
      L(arc(WIN.x, WIN.y, WIN.r - 11, 200, 250), WHITE, 6, ' stroke-linecap="round" stroke-opacity=".85"'));
    /* control panel: three lamps (off / raspberry / sky / mint layers), gauge, buttons */
    var lamps = '';
    LAMPS.forEach(function (x, i) {
      lamps += G('st-lamp st-lamp--' + i,
        C(x, LAMP_Y, 10.5, STEEL_D, ' stroke-width="3" class="st-l-off"') +
        C(x, LAMP_Y, 10.5, RASP, ' stroke-width="3" class="st-l-rasp" opacity="0"') +
        C(x, LAMP_Y, 10.5, SKY, ' stroke-width="3" class="st-l-sky" opacity="0"') +
        C(x, LAMP_Y, 10.5, MINT, ' stroke-width="3" class="st-l-mint"') +
        C(x - 3.4, LAMP_Y - 3.6, 2.8, WHITE, NS));
    });
    var ticks = '';
    for (k = 0; k <= 6; k++) { var a = 200 + k * 140 / 6, q0 = polar(GAUGE.x, GAUGE.y, 26, a), q1 = polar(GAUGE.x, GAUGE.y, 21, a); ticks += 'M' + f(q0[0]) + ' ' + f(q0[1]) + 'L' + f(q1[0]) + ' ' + f(q1[1]); }
    s += G('st-panel',
      R(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 24, INK) +
      lamps +
      C(GAUGE.x, GAUGE.y, GAUGE.r, CREAM, ' stroke-width="3.5"') +
      L(arc(GAUGE.x, GAUGE.y, 23, 200, 247), MINT, 7) + L(arc(GAUGE.x, GAUGE.y, 23, 247, 294), TANG, 7) + L(arc(GAUGE.x, GAUGE.y, 23, 294, 340), RASP, 7) +
      L(ticks, INK, 2.2, ' stroke-linecap="round"') +
      G('st-needle', L('M' + GAUGE.x + ' ' + GAUGE.y + 'L' + GAUGE.x + ' ' + (GAUGE.y - 26), INK, 4.5, ' stroke-linecap="round"'),
        ' transform="rotate(38 ' + GAUGE.x + ' ' + GAUGE.y + ')"') +
      C(GAUGE.x, GAUGE.y, 5.5, INK, NS) +
      R(PANEL.x + 16, 446, 72, 22, 11, '#2D2768', ' stroke-width="0"') +
      C(PANEL.x + 30, 457, 7, RASP, ' stroke-width="2.6"') + C(PANEL.x + 52, 457, 7, SKY, ' stroke-width="2.6"') +
      C(PANEL.x + 74, 457, 7, MINT, ' stroke-width="2.6"'));
    /* output hatch + ramp */
    s += G('st-chute',
      R(382, 424, 34, 78, 14, CREAM) + R(390, 432, 18, 62, 9, '#2D2768', NS) +
      P('M404 470C440 470 462 496 474 540L476 548H452C446 522 432 504 404 502Z', CREAM) +
      L('M412 480C436 482 452 500 462 530', SKY, 5, ' stroke-linecap="round"'));
    return s;
  }

  function background() {
    var s = C(492, 150, 112, CREAM, NS + ' fill-opacity=".07"') + C(70, 520, 96, CREAM, NS + ' fill-opacity=".06"') +
      C(560, 430, 50, CREAM, NS + ' fill-opacity=".06"');
    s += G('st-bgear st-bgear--a', P(gearD(520, 280, 64, 12), CREAM, NS + ' fill-opacity=".09"') + C(520, 280, 22, VIOLET, NS));
    s += G('st-bgear st-bgear--b', P(gearD(438, 40, 40, 9), CREAM, NS + ' fill-opacity=".08"') + C(438, 40, 13, VIOLET, NS));
    s += G('st-sparks', spark(456, 176, 11, CREAM, NS) + spark(28, 330, 8, CREAM, NS + ' fill-opacity=".8"') +
      spark(570, 360, 7, CREAM, NS + ' fill-opacity=".7"') + spark(236, 36, 6, CREAM, NS + ' fill-opacity=".6"'));
    return s;
  }

  /* a little cloud: ink disks under cream disks = one merged outline */
  function cloud(cx, cy, s) {
    var b = [[-0.62, 0.22, 0.52], [0, -0.18, 0.74], [0.64, 0.18, 0.5], [0.05, 0.34, 0.5]], o = '', i;
    for (i = 0; i < b.length; i++) o += C(cx + b[i][0] * s, cy + b[i][1] * s, b[i][2] * s + 4, INK, NS);
    for (i = 0; i < b.length; i++) o += C(cx + b[i][0] * s, cy + b[i][1] * s, b[i][2] * s, CREAM, NS);
    return o + P('M' + f(cx - s * 0.36) + ' ' + f(cy - s * 0.36) + 'q' + f(s * 0.16) + ' ' + f(-s * 0.2) + ' ' + f(s * 0.4) + ' ' + f(-s * 0.18), 'none',
      ' stroke="' + WHITE + '" stroke-width="3.5" stroke-linecap="round"');
  }
  function puffs() {
    return G('st-puffs',
      G('st-puff st-puff--0', cloud(364, 112, 17)) +
      G('st-puff st-puff--1', cloud(404, 72, 25)) +
      G('st-puff st-puff--2', cloud(452, 30, 21), ' opacity="0" visibility="hidden"'));
  }

  function buildSVG() {
    var defs = '<defs><clipPath id="st-win-clip"><circle cx="' + WIN.x + '" cy="' + WIN.y + '" r="' + WIN.r + '"/></clipPath>' +
      '<clipPath id="st-funnel-clip"><path d="M98 122H266L208 220H156Z"/></clipPath></defs>';
    var inner = defs +
      G('st-par st-par--bg', G('st-bg', background())) +
      E(300, FLOOR + 6, 250, 15, INK, NS + ' fill-opacity=".22" class="st-floor"') +
      G('st-par st-par--phone', G('st-phone-wrap', phone()) + emblems()) +
      G('st-par st-par--machine', G('st-squash', machine()) + puffs());
    return MP.svg(G('', inner, ' stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"'), '0 0 600 600', 'st-svg');
  }

  function buildOverlays(stage) {
    var html = '<div class="st-ov" aria-hidden="true">';
    IDEAS.forEach(function (idea, i) {
      var hide = i ? ' style="visibility:hidden;opacity:0"' : '';
      html += '<div class="st-drop st-drop--' + i + '"' + hide + '><p class="st-bubble">' + idea.text + '</p></div>';
    });
    IDEAS.forEach(function (idea, i) {
      var hide = i ? ' style="visibility:hidden;opacity:0"' : '';
      html += '<p class="st-tag st-tag--' + i + '"' + hide + '><svg class="ico" aria-hidden="true"><use href="#i-check"/></svg>' + idea.app + '</p>';
    });
    html += '</div>';
    stage.appendChild(MP.html(html));
  }

  /* smooth irregular blob (closed Catmull-Rom through n jittered points) — the ink splat */
  function blobD(r, n, seed) {
    var rnd = MP.seeded(seed), pts = [], i;
    for (i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2, k = i % 2 ? 0.8 + rnd() * 0.08 : 1 + rnd() * 0.2;
      pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k]);
    }
    var d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    for (i = 0; i < n; i++) {
      var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      d += 'C' + f(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + f(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + f(p2[0] - (p3[0] - p1[0]) / 6) + ' ' +
        f(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
    }
    return d + 'Z';
  }

  /* the slam FX, all invisible in the resting state:
   *  - a shock ring stretched around «сделано.» (non-scaling stroke, so the stretch never shows);
   *  - a burst centred on the full stop — the stop is the stamp: a lemon ink splat, 5 droplets and 6 rays that fan to the
   *    right (never towards the left page edge, so nothing is clipped at 360px). */
  function buildSlam(hl) {
    if (!hl || hl.querySelector('.st-slam')) return;
    var rays = '', drops = '';
    [-78, -47, -16, 16, 47, 78].forEach(function (deg) {
      var a = deg * Math.PI / 180;
      rays += '<path class="st-ray" d="M' + f(Math.cos(a) * 60) + ' ' + f(Math.sin(a) * 60) + 'L' + f(Math.cos(a) * 97) + ' ' +
        f(Math.sin(a) * 97) + '" opacity="0"/>';
    });
    [[-122, 84, 9], [-62, 96, 12], [-4, 104, 8], [34, 92, 11], [100, 80, 8.5]].forEach(function (d) {
      var a = d[0] * Math.PI / 180;
      drops += '<circle class="st-drop-fx" cx="0" cy="0" r="' + d[2] + '" data-dx="' + f(Math.cos(a) * d[1]) + '" data-dy="' +
        f(Math.sin(a) * d[1]) + '" opacity="0"/>';
    });
    hl.appendChild(MP.html('<svg class="st-slam st-slam--ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<ellipse class="st-ring" cx="50" cy="50" rx="48" ry="46" vector-effect="non-scaling-stroke" opacity="0"/></svg>'));
    hl.appendChild(MP.html('<svg class="st-slam st-slam--burst" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">' +
      '<path class="st-splat" d="' + blobD(44, 14, 11) + '" opacity="0"/>' + drops + rays + '</svg>'));
  }

  /* extra faces for the Бригадир, stacked and toggled with autoAlpha (revert-safe; MP.blink blinks every face) */
  var EXPRS = ['happy', 'oh', 'focus'];
  function addFaces(charEl) {
    var orig = charEl && charEl.querySelector('.c-face');
    if (!orig || charEl.querySelector('.st-face--oh')) return;
    orig.classList.add('st-face', 'st-face--happy');
    EXPRS.slice(1).forEach(function (expr) {
      var tmp = MP.artSVG(MP.char('brigadir', { expr: expr }));
      var nf = tmp && tmp.querySelector('.c-face');
      if (!nf) return;
      nf.classList.add('st-face', 'st-face--' + expr);
      nf.setAttribute('style', 'visibility:hidden;opacity:0');
      orig.parentNode.insertBefore(nf, orig.nextSibling);
    });
  }

  function parts(section) {
    var st = section.querySelector('[data-stage]');
    var q = function (s) { return MP.$(s, st); }, qa = function (s) { return MP.$$(s, st); };
    return {
      stage: st, q: q, qa: qa,
      copy: MP.$('.copy', section), wrap: MP.$('.hero-grid', section),
      kicker: MP.$('.kicker', section), words: MP.$$('.h1 .w', section), hl: MP.$('.h1 .hl', section),
      lead: MP.$('.lead', section), btns: MP.$$('.ctas .btn', section), cue: MP.$('.scroll-cue', section),
      ring: MP.$('.st-ring', section), rays: MP.$$('.st-ray', section),
      splat: MP.$('.st-splat', section), drops: MP.$$('.st-drop-fx', section)
    };
  }

  /* built-state snapshot. GSAP reverts can leave SVG transforms / inline styles / morphed paths behind (seen with
   * MotionPath and DrawSVG fromTo), so final() and init() hard-restore what build() produced and drop GSAP's cache. */
  function snap(root) {
    MP.$$('*', root).concat([root]).forEach(function (el) {
      el.__mp0 = { t: el.getAttribute('transform'), s: el.getAttribute('style'), d: el.getAttribute('d') };
    });
  }
  function restore(root) {
    var gsap = window.gsap;
    MP.$$('*', root).concat([root]).forEach(function (el) {
      var o = el.__mp0;
      if (!o || !el._gsap) return;
      if (gsap) gsap.killTweensOf(el);
      if (o.t == null) el.removeAttribute('transform'); else el.setAttribute('transform', o.t);
      if (o.s == null) el.removeAttribute('style'); else el.setAttribute('style', o.s);
      if (o.d != null) el.setAttribute('d', o.d);
      el.removeAttribute('data-svg-origin');
      try { delete el._gsap; } catch (e) { el._gsap = undefined; }
    });
  }

  MP.scene('start', {
    build: function (section, api) {
      var st = api.stage;
      st.appendChild(buildSVG());
      addFaces(MP.$('.st-brig', st));
      buildOverlays(st);
      buildSlam(MP.$('.h1 .hl', section));
      snap(section);
    },

    final: function (section) {
      restore(section);
      section.classList.add('is-ready');
    },

    init: function (section, api) {
      restore(section);
      var gsap = api.gsap, p = parts(section), q = p.q, qa = p.qa;
      var brig = q('.st-brig'), phoneWrap = q('.st-phone-wrap'), screens = qa('.st-screen'), embs = qa('.st-emb'),
        drops = qa('.st-drop'), bubbles = qa('.st-bubble'), tags = qa('.st-tag'), lamps = qa('.st-lamp'),
        squash = q('.st-squash'), funnel = q('.st-funnel'), needle = q('.st-needle'), gears = qa('.st-gear'),
        bgears = qa('.st-bgear'), puffList = qa('.st-puff'), faces = qa('.st-face');

      /* ---- start states (recorded by the context, reverted on calm/breakpoint change) ---- */
      // HTML copy and CTAs animate opacity only (never visibility): they stay focusable and in the a11y tree
      gsap.set([p.kicker, p.lead, p.cue], { opacity: 0, y: 26 });
      gsap.set(p.words[0], { opacity: 0, y: -80, rotation: -3, transformOrigin: '50% 100%' });
      gsap.set(p.hl, { opacity: 0, scale: 2.3, transformOrigin: '50% 60%' });
      gsap.set(p.btns, { opacity: 0, scale: 0.6, transition: 'none' });
      gsap.set(q('.st-bg'), { autoAlpha: 0 });
      gsap.set(q('.st-floor'), { scaleX: 0, transformOrigin: '50% 50%' });
      gsap.set(q('.st-body'), { scaleY: 0.1, scaleX: 1.2, svgOrigin: '235 522', autoAlpha: 0 });
      gsap.set(q('.st-feet'), { scaleY: 0, svgOrigin: '235 548' });
      gsap.set(q('.st-window'), { scale: 0, rotation: -120, svgOrigin: WIN.x + ' ' + WIN.y });
      gsap.set(brig, { y: 90 });
      gsap.set(funnel, { y: -240, autoAlpha: 0 });
      gsap.set(q('.st-chimney'), { scaleY: 0, svgOrigin: '341 262' });
      gsap.set(q('.st-panel'), { scale: 0, svgOrigin: (PANEL.x + PANEL.w / 2) + ' ' + (PANEL.y + PANEL.h / 2) });
      gsap.set(q('.st-chute'), { scaleX: 0, svgOrigin: '386 460' });
      gsap.set(gears, { scale: 0, transformOrigin: '50% 50%' });
      gsap.set(qa('.st-l-mint'), { autoAlpha: 0 });
      gsap.set(puffList, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
      gsap.set(phoneWrap, { x: -190, y: -34, scale: 0.55, rotation: -24, autoAlpha: 0, svgOrigin: PHONE.x + ' ' + PHONE.y });
      gsap.set(embs, { autoAlpha: 0 });
      gsap.set(drops, { autoAlpha: 0, yPercent: 0 });
      gsap.set(bubbles, { scale: 0, transformOrigin: '50% 100%' });
      gsap.set(tags, { autoAlpha: 0, scale: 0, transformOrigin: '50% 100%' });
      gsap.set(needle, { rotation: -60, svgOrigin: GAUGE.x + ' ' + GAUGE.y });
      /* the slam fx (hidden in the poster state) */
      gsap.set(p.ring, { transformOrigin: '50% 50%' });
      gsap.set(p.splat, { transformOrigin: '50% 50%' });
      section.classList.add('is-ready');

      var tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      /* ---- type ---- */
      tl.to(p.kicker, { opacity: 1, y: 0, duration: 0.5 }, 0.05)
        .to(p.words[0], { opacity: 1, y: 0, rotation: 0, duration: 0.6, ease: 'back.out(1.8)' }, 0.18)
        .to(p.hl, { opacity: 1, scale: 0.92, duration: 0.2, ease: 'power4.in' }, 0.42)
        .to(p.hl, { scale: 1, duration: 0.45, ease: 'elastic.out(1,.4)' }, 0.62)
        .to(p.wrap, { keyframes: { x: [-7, 6, -3, 0] }, duration: 0.3, ease: 'none' }, 0.62)
        .fromTo(p.ring, { autoAlpha: 1, scale: 0.86 }, { autoAlpha: 0, scale: 1.3, duration: 0.5, ease: 'power2.out', immediateRender: false }, 0.62)
        .set(p.splat, { autoAlpha: 1 }, 0.62)
        .fromTo(p.splat, { scale: 0.1, rotation: -20 }, { scale: 1, rotation: 0, duration: 0.14, ease: 'power2.out', immediateRender: false }, 0.62)
        .to(p.splat, { scale: 0.18, duration: 0.42, ease: 'power3.in' }, 0.82)
        .set(p.splat, { autoAlpha: 0 }, 1.24)
        .set(p.rays, { autoAlpha: 1 }, 0.64)
        .fromTo(p.rays, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.2, ease: 'power2.out', stagger: 0.015, immediateRender: false }, 0.64)
        .to(p.rays, { drawSVG: '100% 100%', duration: 0.26, ease: 'power2.in', stagger: 0.015 }, 0.86)
        .set(p.rays, { autoAlpha: 0 }, 1.3);
      p.drops.forEach(function (d, k) {
        tl.set(d, { autoAlpha: 1 }, 0.64).fromTo(d, { x: 0, y: 0, scale: 1.2 }, { x: +d.getAttribute('data-dx'), y: +d.getAttribute('data-dy'), scale: 0.3,
          duration: 0.5 + k * 0.04, ease: 'power2.out', immediateRender: false }, 0.64)
          .to(d, { autoAlpha: 0, duration: 0.14 }, 1.0 + k * 0.04);
      });
      tl
        .to(p.lead, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.9)
        .to(p.btns, { opacity: 1, scale: 1, duration: 0.55, ease: 'back.out(2)', stagger: 0.08 }, 1.05)
        .set(p.btns, { clearProps: 'transform,transition' }, 1.8)
        .to(p.cue, { opacity: 0.9, y: 0, duration: 0.5 }, 1.3)
        .set(p.cue, { clearProps: 'opacity' }, 1.9);

      /* ---- machine assembles ---- */
      tl.to(q('.st-bg'), { autoAlpha: 1, duration: 0.8 }, 0)
        .fromTo(bgears, { rotation: -60, scale: 0.6, transformOrigin: '50% 50%' }, { rotation: 0, scale: 1, duration: 1.2, ease: 'power3.out', stagger: 0.1 }, 0)
        .to(q('.st-floor'), { scaleX: 1, duration: 0.5 }, 0.35)
        .to(q('.st-body'), { autoAlpha: 1, scaleY: 1, scaleX: 1, duration: 0.65, ease: 'mp.pop' }, 0.4)
        .to(q('.st-feet'), { scaleY: 1, duration: 0.3, ease: 'back.out(3)' }, 0.62)
        .to(q('.st-window'), { scale: 1, rotation: 0, duration: 0.7, ease: 'back.out(1.6)' }, 0.7)
        .to(funnel, { y: 0, autoAlpha: 1, duration: 0.55, ease: 'bounce.out' }, 0.8)
        .to(q('.st-chimney'), { scaleY: 1, duration: 0.45, ease: 'back.out(2.2)' }, 0.95)
        .to(q('.st-panel'), { scale: 1, duration: 0.5, ease: 'back.out(2)' }, 1.0)
        .to(gears, { scale: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.08 }, 1.05)
        .to(q('.st-chute'), { scaleX: 1, duration: 0.4, ease: 'back.out(2)' }, 1.2)
        .to(brig, { y: 0, duration: 0.6, ease: 'back.out(1.8)' }, 1.25)
        .to(needle, { rotation: 38, duration: 0.8, ease: 'elastic.out(1,.45)' }, 1.3)
        .fromTo(q('.st-brig .c-arm-r'), { rotation: -70, transformOrigin: '50% 50%' }, { rotation: -105, transformOrigin: '50% 50%', duration: 0.22, yoyo: true, repeat: 3, ease: 'sine.inOut', immediateRender: false }, 1.55)
        .to(q('.st-brig .c-arm-r'), { rotation: 0, duration: 0.3 }, 2.45);

      /* ---- idea cycles: 0 on load, then 4 more (expenses, colouring, haircut, back to flowers) ---- */
      var T0 = 2.2, PERIOD = 7;
      var order = [0, 1, 2, 3, 0];
      order.forEach(function (i, n) { cycle(n, i, T0 + n * PERIOD, n === order.length - 1); });

      function face(t, expr) {
        tl.set(faces, { autoAlpha: 0 }, t).set(q('.st-face--' + expr), { autoAlpha: 1 }, t);
      }

      function lampTo(t, layer) {
        lamps.forEach(function (lamp, k) {
          var on = MP.$('.st-l-' + layer, lamp), others = MP.$$('circle[class^="st-l-"]', lamp).filter(function (c) { return c !== on; });
          tl.set(others, { autoAlpha: 0 }, t + k * 0.09)
            .set(on, { autoAlpha: 1 }, t + k * 0.09)
            .fromTo(lamp, { scale: 1.45 }, { scale: 1, duration: 0.3, ease: 'elastic.out(1,.5)', svgOrigin: LAMPS[k] + ' ' + LAMP_Y, immediateRender: false }, t + k * 0.09);
        });
      }

      function cycle(n, i, t, last) {
        var drop = drops[i], bub = bubbles[i], tag = tags[i], emb = embs[i];
        /* previous product leaves (the phone is carried away to the right) */
        if (n > 0) {
          var prev = order[n - 1];
          tl.to(tags[prev], { autoAlpha: 0, scale: 0.4, duration: 0.3, ease: 'power2.in' }, t - 0.9)
            .to(embs[prev], { autoAlpha: 0, duration: 0.25 }, t - 0.9)
            .to(phoneWrap, { x: 150, y: -40, rotation: 28, autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, t - 0.75)
            .set(screens, { autoAlpha: 0 }, t - 0.2)
            .set(screens[i], { autoAlpha: 1 }, t - 0.2)
            .set(phoneWrap, { x: -190, y: -34, scale: 0.55, rotation: -24 }, t - 0.2);
        }
        /* the idea arrives … */
        tl.set(drop, { autoAlpha: 1, yPercent: 0 }, t)
          .fromTo(bub, { scale: 0, rotation: -8 }, { scale: 1, rotation: 0, duration: 0.55, ease: 'mp.pop', immediateRender: false }, t)
          
          /* … and drops into the funnel */
        face(t + 0.3, 'oh');
        tl.to(drop, { yPercent: 9, duration: 0.5, ease: 'power2.in' }, t + 1.5)
          .to(bub, { scale: 0.06, rotation: 14, duration: 0.5, ease: 'power2.in' }, t + 1.5)
          .set(drop, { autoAlpha: 0 }, t + 2.0)
          .fromTo(funnel, { scaleX: 1.14, scaleY: 0.86 }, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1,.35)', svgOrigin: '182 258', immediateRender: false }, t + 2.0)
          /* the factory works */
          .to(squash, { keyframes: { scaleY: [0.9, 1.04, 0.93, 1.02, 0.95, 1], scaleX: [1.06, 0.97, 1.05, 0.99, 1.03, 1] }, duration: 1.3, ease: 'none', svgOrigin: '235 548' }, t + 2.1)
          .to(gears[0], { rotation: '+=240', duration: 1.6, ease: 'power1.inOut' }, t + 2.1)
          .to(gears[1], { rotation: '-=380', duration: 1.6, ease: 'power1.inOut' }, t + 2.1)
          .to(bgears, { rotation: '+=40', duration: 1.8, ease: 'power1.inOut' }, t + 2.1)
          .to(needle, { keyframes: { rotation: [-50, 55, 10, 38] }, duration: 1.3, ease: 'none' }, t + 2.1);
        face(t + 2.05, 'focus');
        lampTo(t + 2.1, 'rasp');
        lampTo(t + 2.6, 'sky');
        lampTo(t + 3.1, 'mint');
        puffList.forEach(function (pf, k) {
          tl.fromTo(pf, { autoAlpha: 0, scale: 0.2, x: -6, y: 36 }, { autoAlpha: 1, scale: 1, x: 0, y: 0, duration: 0.5, ease: 'back.out(2)', immediateRender: false }, t + 2.2 + k * 0.28);
          if (k === 2) tl.to(pf, { autoAlpha: 0, y: -24, duration: 0.5 }, t + 3.2);
        });
        /* the phone pops out of the hatch */
        tl.set(phoneWrap, { autoAlpha: 1 }, t + 3.35)
          .to(phoneWrap, { x: 0, y: 0, scale: 1, rotation: -5, duration: 0.65, ease: 'back.out(2.5)' }, t + 3.35)
          .fromTo(phoneWrap, { scaleY: 0.9 }, { scaleY: 1, duration: 0.35, ease: 'elastic.out(1,.4)', immediateRender: false }, t + 4.0)
          .fromTo(tag, { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2.2)', immediateRender: false }, t + 3.75)
          .set(emb, { autoAlpha: 1 }, t + 3.8)
          .fromTo(q('.st-brig .c-arm-r'), { rotation: -70, transformOrigin: '50% 50%' }, { rotation: -105, transformOrigin: '50% 50%', duration: 0.2, yoyo: true, repeat: 3, ease: 'sine.inOut', immediateRender: false }, t + 3.9)
          .to(q('.st-brig .c-arm-r'), { rotation: 0, duration: 0.25 }, t + 4.7);
        face(t + 3.8, 'happy');
        emblemIn(emb, i, t + 3.8);
        if (last) {
          /* back to the poster: the story idea reappears above the funnel */
          tl.set(drops[0], { autoAlpha: 1, yPercent: 0 }, t + 5.2)
            .fromTo(bubbles[0], { scale: 0, rotation: -8 }, { scale: 1, rotation: 0, duration: 0.55, ease: 'mp.pop', immediateRender: false }, t + 5.2);
        }
      }

      function emblemIn(emb, i, t) {
        if (i === 0) {
          tl.fromTo(MP.$$('.st-stem-o, .st-stem-i', emb), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.45, ease: 'power2.out', immediateRender: false }, t)
            .fromTo(MP.$$('.st-leaf', emb), { scale: 0, transformOrigin: '100% 100%' }, { scale: 1, duration: 0.5, ease: 'back.out(2.4)', stagger: 0.1, immediateRender: false }, t + 0.3);
        } else if (i === 1) {
          tl.fromTo(MP.$('.st-coin', emb), { y: 30, scale: 0, transformOrigin: '50% 50%' }, { y: 0, scale: 1, duration: 0.5, ease: 'back.out(2.4)', immediateRender: false }, t)
            .fromTo(MP.$('.st-coin', emb), { scaleX: 1 }, { keyframes: { scaleX: [-1, 1] }, duration: 0.6, ease: 'none', immediateRender: false }, t + 0.5);
        } else if (i === 2) {
          tl.fromTo(MP.$('.st-squiggle', emb), { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.7, ease: 'power1.inOut', immediateRender: false }, t)
            .fromTo(MP.$('.st-crayon', emb), { x: -88, y: 0 }, { x: 0, y: 0, duration: 0.7, ease: 'power1.inOut', immediateRender: false }, t);
        } else {
          tl.fromTo(emb, { scale: 0, transformOrigin: '50% 100%' }, { scale: 1, duration: 0.45, ease: 'back.out(2.4)', immediateRender: false }, t)
            .fromTo(MP.$('.st-blade--a', emb), { rotation: 0 }, { keyframes: { rotation: [-16, 0, -16, 0] }, duration: 0.6, ease: 'none', svgOrigin: (PHONE.x - 4) + ' ' + (PHONE.y - PHONE.h - 46), immediateRender: false }, t + 0.4)
            .fromTo(MP.$('.st-blade--b', emb), { rotation: 0 }, { keyframes: { rotation: [16, 0, 16, 0] }, duration: 0.6, ease: 'none', svgOrigin: (PHONE.x - 4) + ' ' + (PHONE.y - PHONE.h - 46), immediateRender: false }, t + 0.4);
        }
      }

      api.loop(tl);
      MP.blink(api.stage, api);

      /* ---- desktop pointer parallax (±12px) ---- */
      var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (api.wide && fine) {
        var layers = [[q('.st-par--bg'), -12], [q('.st-par--machine'), 6], [q('.st-par--phone'), 11]];
        var movers = layers.map(function (l) {
          return { k: l[1], x: gsap.quickTo(l[0], 'x', { duration: 0.8, ease: 'power3.out' }), y: gsap.quickTo(l[0], 'y', { duration: 0.8, ease: 'power3.out' }) };
        });
        api.on(section, 'pointermove', function (e) {
          var r = section.getBoundingClientRect();
          var nx = (e.clientX - r.left) / r.width * 2 - 1, ny = (e.clientY - r.top) / r.height * 2 - 1;
          movers.forEach(function (m) { m.x(nx * m.k); m.y(ny * m.k * 0.7); });
        });
        api.on(section, 'pointerleave', function () { movers.forEach(function (m) { m.x(0); m.y(0); }); });
      }
    }
  });
})();
