/* scenes/ideya.js — «Всё начинается с одной фразы» (package A, docs/design-prosto.md §2.3).
 * Stage (viewBox 600×600): a window with three potted plants with faces on the sill — фикус, кактус and a sad фиалка
 * (kit plant) — plus the goal: the «Полей меня» app icon and a phone with the plant list and water bars.
 * build : the final poster (фиалка sad, the idea bulb glowing, icon + phone + caption «Вот что должно получиться»).
 * init  : toggle-once at top 65% — фиалка wilts, a speech bubble types the phrase, turns into a glowing bulb that
 *         rises, then the target pops in.
 * final : the poster as built. */
(function () {
  'use strict';
  var MP = window.MP;

  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', MINT = '#2BD99F', RASP = '#FF4F8B', SKY = '#3EC5FF',
    TANG = '#FF8A1F', STEEL = '#C9D3E6', WHITE = '#FFFFFF', LEAF = '#1BB283';
  var FONT_T = "'Golos Text', 'Segoe UI', system-ui, sans-serif";
  var PHRASE = 'Хочу приложение, которое напомнит полить цветы';

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
  function T(x, y, s, size, o) {
    o = o || {};
    return '<text x="' + f(x) + '" y="' + f(y) + '" font-family="' + FONT_T + '" font-size="' + size + '" font-weight="' + (o.weight || 700) +
      '" fill="' + (o.fill || INK) + '" stroke="none"' + (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + '>' + s + '</text>';
  }
  var NS = ' stroke="none"';
  function tr(x, y, s, r) { return ' transform="translate(' + f(x) + ' ' + f(y) + ')' + (r ? ' rotate(' + f(r) + ')' : '') + (s && s !== 1 ? ' scale(' + f(s) + ')' : '') + '"'; }

  /* ---------- geometry: two layouts, built once, CSS shows one ----------
   * SQ   (≥760px, viewBox 600×600): window left, phone standing on the sill at the right.
   * TALL (<760px, viewBox 480×600 — the stage turns 4:5 on phones): a narrower, taller window and a bigger phone,
   *      so the phone list renders ≥16px on a 390px screen. Phone-screen text is 17–18 units in both. */
  var SQ = {
    key: 'sq', w: 600, h: 600,
    win: { x: 24, y: 18, w: 382, h: 454, fr: 16, bar: 214 }, sill: 472,
    clouds: [[0, 0], [0, 0]],
    bulb: { x: 118, y: 112 }, icon: { x: 262, y: 54, s: 96 },
    ph: { x: 432, scale: 1.1, rot: -3 },
    plants: [['ficus', 18, 1.15], ['cactus', 140, 1.04], ['violet', 236, 1.4]],
    arrow: ['M520 118C548 126 552 150 536 168', 'M526 160L535 172L547 162']
  };
  var TALL = {
    key: 'tall', w: 480, h: 600,
    win: { x: 14, y: 16, w: 300, h: 484, fr: 16, bar: 236 }, sill: 500,
    clouds: [[-34, 60], [-100, 60]],
    bulb: { x: 92, y: 124 }, icon: { x: 186, y: 50, s: 84 },
    ph: { x: 296, scale: 1.24, rot: -3 },
    plants: [['ficus', 2, 0.92], ['cactus', 104, 0.84], ['violet', 184, 1.02]],
    arrow: ['M426 124C452 130 458 148 446 164', 'M436 156L445 168L457 158']
  };
  function phBox(L0) { return { cx: L0.ph.x + 70 * L0.ph.scale, top: L0.sill - 260 * L0.ph.scale }; }

  /* ---------- plants: the kit pot + face, own foliage for фикус and кактус ---------- */
  function ficusLeaves() {
    var s = L('M60 80C60 60 58 40 60 8', INK, 8) + L('M60 80C60 60 58 40 60 8', LEAF, 3.4);
    [[60, 12, 0, 26], [44, 36, -38, 24], [77, 38, 40, 24], [42, 60, -52, 22], [79, 62, 52, 22]].forEach(function (l) {
      s += G('if-leaf', E(0, -l[3] * 0.62, 12.5, l[3] * 0.72, l[2] === 0 ? MINT : LEAF, ' stroke-width="4"') +
        L('M0 -3V' + f(-l[3] * 1.18), INK, 1.8, ' stroke-opacity=".35"'), tr(l[0], l[1] + 12, 1, l[2]));
    });
    return s;
  }
  function cactusBody() {
    var s = '';
    s += P('M44 64H32Q26 64 26 58V40Q26 34 32 34Q38 34 38 40V52H44Z', MINT, ' stroke-width="4"');
    s += P('M76 56H88V34Q88 28 94 28Q100 28 100 34V56Q100 66 90 66H76Z', MINT, ' stroke-width="4"');
    s += R(42, 22, 36, 64, 18, MINT, ' stroke-width="4"');
    s += L('M52 32V78M60 26V80M68 32V78', LEAF, 2.6, ' stroke-linecap="round"');
    s += L('M47 40l-4-2M73 44l4-2M47 58l-4-2M73 64l4-2M56 50l-3 2M65 36l3 2', INK, 2, ' stroke-linecap="round"');
    var fl = '';
    for (var i = 0; i < 5; i++) { var a = (-90 + i * 72) * Math.PI / 180; fl += C(60 + Math.cos(a) * 6.5, 19 + Math.sin(a) * 6.5, 5.6, RASP, ' stroke-width="2.8"'); }
    s += G('ic-flower', fl + C(60, 19, 3.8, CREAM, ' stroke-width="2.4"'));
    return s;
  }
  /* reuse the kit's happy pot (pot + face + shadow), drop its foliage, recolour the pot */
  function potted(kind, x, y, scale, potFill, rimFill) {
    var svg = MP.artSVG(MP.plant('happy'), '0 0 120 140');
    var root = svg.querySelector('.c-plant');
    MP.$$('.c-leaf, .c-stem, .c-bud, .c-flower, .c-sparkle', root).forEach(function (n) { n.parentNode.removeChild(n); });
    var pot = root.querySelector('.c-pot');
    if (pot) {
      var body = pot.querySelector('path'), rim = pot.querySelector('rect');
      if (body) body.setAttribute('fill', potFill);
      if (rim) rim.setAttribute('fill', rimFill);
    }
    var foliage = MP.html('<svg xmlns="http://www.w3.org/2000/svg"><g class="i-foliage">' + (kind === 'ficus' ? ficusLeaves() : cactusBody()) + '</g></svg>').firstElementChild;
    root.insertBefore(foliage, pot);
    var wrap = MP.html('<svg xmlns="http://www.w3.org/2000/svg"><g class="i-plant i-plant--' + kind + '"' + tr(x, y, scale) + '></g></svg>').firstElementChild;
    wrap.appendChild(root);
    return wrap;
  }
  function addPlants(svg, L0) {
    var box = MP.$('.i-plants', svg);
    L0.plants.forEach(function (p) {
      var y = L0.sill - 140 * p[2];
      if (p[0] === 'ficus') box.appendChild(potted('ficus', p[1], y, p[2], SKY, '#7FD8FF'));
      else if (p[0] === 'cactus') box.appendChild(potted('cactus', p[1], y, p[2], RASP, '#FF86AE'));
      else box.appendChild(MP.html('<svg xmlns="http://www.w3.org/2000/svg">' + MP.plant('sad', { x: p[1], y: y, scale: p[2], cls: 'i-violet' }) + '</svg>').firstElementChild);
    });
  }

  /* ---------- window, sill ---------- */
  function windowG(L0) {
    var w = L0.win, s = '', c1 = L0.clouds[0], c2 = L0.clouds[1];
    s += R(w.x + 8, w.y + 8, w.w, w.h, 26, INK, NS);
    s += R(w.x, w.y, w.w, w.h, 26, CREAM, ' stroke-width="4"');
    s += R(w.x + w.fr, w.y + w.fr, w.w - 2 * w.fr, w.h - 2 * w.fr - 10, 14, SKY, ' stroke-width="4"');
    /* clouds (offsets from the square layout's spots) */
    s += G('i-cloud', C(92, 250, 16, WHITE, NS + ' fill-opacity=".85"') + C(114, 242, 22, WHITE, NS + ' fill-opacity=".85"') + C(138, 252, 15, WHITE, NS + ' fill-opacity=".85"') +
      R(80, 250, 70, 16, 8, WHITE, NS + ' fill-opacity=".85"'), c1[0] || c1[1] ? tr(c1[0], c1[1]) : '');
    s += G('i-cloud', C(320, 286, 12, WHITE, NS + ' fill-opacity=".7"') + C(338, 280, 17, WHITE, NS + ' fill-opacity=".7"') + C(356, 288, 11, WHITE, NS + ' fill-opacity=".7"') +
      R(310, 286, 56, 12, 6, WHITE, NS + ' fill-opacity=".7"'), c2[0] || c2[1] ? tr(c2[0], c2[1]) : '');
    /* glass shine */
    s += L('M' + (w.x + 40) + ' ' + (w.y + 70) + 'L' + (w.x + 90) + ' ' + (w.y + 30), WHITE, 7, ' stroke-linecap="round" stroke-opacity=".55"');
    /* cross bars */
    var cx = w.x + w.w / 2, cy = w.y + w.bar;
    s += R(cx - 7, w.y + w.fr, 14, w.h - 2 * w.fr - 10, 0, CREAM, ' stroke-width="4"');
    s += R(w.x + w.fr, cy - 7, w.w - 2 * w.fr, 14, 0, CREAM, ' stroke-width="4"');
    return G('i-window', s);
  }
  function sill(L0) {
    var y = L0.sill, W = L0.w;
    return G('i-sill', R(0, y, W, 24, 8, CREAM, ' stroke-width="4"') + R(10, y + 24, W - 20, 26, 0, TANG, ' stroke-width="4"') +
      L('M14 ' + (y + 7) + 'H' + (W - 14), WHITE, 4, ' stroke-linecap="round" stroke-opacity=".7"'));
  }

  /* ---------- the idea bulb ---------- */
  function bulb(L0) {
    var x = L0.bulb.x, y = L0.bulb.y, rays = '';
    for (var i = 0; i < 8; i++) {
      var a = (i * 45 - 90) * Math.PI / 180;
      rays += 'M' + f(x + Math.cos(a) * 50) + ' ' + f(y - 6 + Math.sin(a) * 50) + 'L' + f(x + Math.cos(a) * 66) + ' ' + f(y - 6 + Math.sin(a) * 66);
    }
    return G('i-bulb',
      C(x, y - 6, 44, CREAM, NS + ' fill-opacity=".35" class="i-glow"') +
      L(rays, INK, 5, ' stroke-linecap="round" class="i-rays"') +
      G('i-bulb-body', C(x, y - 8, 30, CREAM, ' stroke-width="4"') + L('M' + (x - 12) + ' ' + (y - 4) + 'Q' + (x - 6) + ' ' + (y - 18) + ' ' + x + ' ' + (y - 4) + 'Q' + (x + 6) + ' ' + (y + 10) + ' ' + (x + 12) + ' ' + (y - 4), TANG, 4, ' stroke-linecap="round"') +
        L('M' + (x - 19) + ' ' + (y - 14) + 'Q' + (x - 16) + ' ' + (y - 28) + ' ' + (x - 4) + ' ' + (y - 31), WHITE, 4, ' stroke-linecap="round"') +
        R(x - 14, y + 20, 28, 20, 5, STEEL, ' stroke-width="4"') + L('M' + (x - 13) + ' ' + (y + 30) + 'H' + (x + 13), INK, 2.6)));
  }

  /* ---------- the goal: app icon + phone ---------- */
  function appIcon(L0) {
    var I = L0.icon, k = I.s / 52;
    return G('i-icon', G('', R(0, 0, 52, 52, 15, MINT, ' stroke-width="' + f(3.6 / k * 1.1) + '"') +
      P('M24 8.5C24 8.5 12 22 12 29.5A12 12 0 0 0 36 29.5C36 22 24 8.5 24 8.5Z', SKY, ' stroke-width="' + f(3.2 / k * 1.15) + '"') +
      L('M18 31Q18.5 26 21.5 23', WHITE, 2.4, ' stroke-linecap="round"') +
      P('M31 20C33 11 41 7 46 8C46 16 40 22 32 21.5Z', LEAF, ' stroke-width="' + f(3 / k * 1.15) + '"') + L('M32 21L41 12.5', INK, 1.4),
      tr(I.x, I.y, k)) +
      G('i-icon-label', R(I.x + I.s / 2 - 74, I.y + I.s + 12, 148, 38, 19, CREAM, ' stroke-width="3.5"') +
        T(I.x + I.s / 2, I.y + I.s + 38.5, 'Полей меня', 21, { weight: 800, anchor: 'middle' })));
  }
  function phoneScreen() {
    /* phone-local coordinates (140×260 box, screen 10,12 → 130,248); text 17–18 units: ≥16px on a 390px phone
       (TALL) and ≥14px on the 1024px split layout (SQ). Each row: name, water bar, drop. */
    var s = P('M10 29A17 17 0 0 1 27 12H113A17 17 0 0 1 130 29V58H10Z', MINT, NS) + L('M10 58H130', INK, 3) +
      T(70, 42.5, 'Полей меня', 18, { weight: 800, anchor: 'middle' });
    var rows = [['Фиалка', 0.16, RASP], ['Фикус', 0.74, SKY], ['Кактус', 0.46, SKY]];
    rows.forEach(function (r, i) {
      var y0 = 64 + i * 49;
      s += G('i-row', R(16, y0, 108, 44, 11, WHITE, ' stroke-width="2.8"') +
        T(25, y0 + 20, r[0], 18, { weight: 750 }) +
        R(25, y0 + 28, 70, 8, 4, r[2], NS + ' fill-opacity=".2"') +
        G('i-bar', R(25, y0 + 28, Math.max(8, 70 * r[1]), 8, 4, r[2], NS)) +
        R(25, y0 + 28, 70, 8, 4, 'none', ' stroke-width="2"') +
        P('M110 ' + (y0 + 12) + 'C110 ' + (y0 + 12) + ' 104 ' + (y0 + 19) + ' 104 ' + (y0 + 23) + 'A6 6 0 0 0 116 ' + (y0 + 23) + 'C116 ' + (y0 + 19) + ' 110 ' + (y0 + 12) + ' 110 ' + (y0 + 12) + 'Z', r[2], ' stroke-width="2.2"'));
    });
    /* «Добавить» button: plus drawn as a path (no text glyph) */
    s += G('i-add', R(16, 213, 108, 30, 15, VIOLET, ' stroke-width="2.6"') +
      L('M29 222V234M23 228H35', CREAM, 3, ' stroke-linecap="round"') + T(41, 234, 'Добавить', 17, { fill: CREAM, weight: 750 }));
    return s;
  }
  /* .i-phone (animated, no transform attribute) > tilt > placement > kit phone + own screen */
  function phone(L0) {
    var b = phBox(L0), t = tr(L0.ph.x, b.top, L0.ph.scale);
    return G('i-phone', G('', G('', MP.phone('blank') + G('i-screen', phoneScreen()), t),
      ' transform="rotate(' + L0.ph.rot + ' ' + f(b.cx) + ' ' + L0.sill + ')"'));
  }

  function arrowToPhone(L0) {
    return L(L0.arrow[0], INK, 4.5, ' stroke-linecap="round" class="i-arrow"') +
      P(L0.arrow[1], 'none', ' stroke-width="4.5" stroke-linecap="round" class="i-arrow-head"');
  }

  function buildSVG(L0) {
    var inner = windowG(L0) + bulb(L0) + appIcon(L0) + '<g class="i-plants"></g>' + sill(L0) + phone(L0) + arrowToPhone(L0);
    var svg = MP.svg(G('', inner, ' stroke="' + INK + '" stroke-linejoin="round"'), '0 0 ' + L0.w + ' ' + L0.h, 'i-svg i-svg--' + L0.key);
    addPlants(svg, L0);
    return svg;
  }
  /* the layout CSS shows right now (the square stage turns 4:5 below 760px) */
  function isTall() { return !!(window.matchMedia && window.matchMedia('(max-width: 759px)').matches); }

  /* built-state snapshot: final() and init() hard-restore what build() produced (GSAP reverts can leave SVG
   * transforms and inline styles behind) and drop GSAP's transform cache. */
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

  MP.scene('ideya', {
    build: function (section, api) {
      var st = api.stage;
      st.appendChild(buildSVG(SQ));
      st.appendChild(buildSVG(TALL));
      /* HTML overlays (the stage is aria-hidden) */
      var chars = PHRASE.split('').map(function (ch) { return '<span class="i-ch">' + (ch === ' ' ? ' ' : ch) + '</span>'; }).join('');
      st.appendChild(MP.html('<div class="i-ov" aria-hidden="true">' +
        '<p class="i-bubble" style="visibility:hidden;opacity:0">' + chars + '</p>' +
        '<p class="i-caption">Вот что должно получиться</p></div>'));
      snap(st);
    },

    final: function (section, api) { restore(api.stage); },

    init: function (section, api) {
      restore(api.stage);
      var gsap = api.gsap, st = api.stage, L0 = isTall() ? TALL : SQ, svg = MP.$('.i-svg--' + L0.key, st);
      /* the SVG parts come from the layout on screen (the other one keeps its built poster state) */
      var q = function (s) { return MP.$(s, svg); }, qa = function (s) { return MP.$$(s, svg); };
      headIn(section, api);
      var violet = q('.i-violet'), vLeaves = MP.$$('.c-leaf', violet), vBud = MP.$('.c-bud', violet), vDrop = MP.$('.c-drop', violet);
      var bubble = MP.$('.i-bubble', st), chs = MP.$$('.i-ch', st), bulbG = q('.i-bulb'), rays = q('.i-rays'), glow = q('.i-glow');
      var icon = q('.i-icon'), label = q('.i-icon-label'), phoneG = q('.i-phone > g'), rows = qa('.i-row'), bars = qa('.i-bar'),
        add = q('.i-add'), caption = MP.$('.i-caption', st), arrow = q('.i-arrow'), head = q('.i-arrow-head');
      phoneG = q('.i-phone');

      /* start states: the фиалка a little less wilted, nothing of the idea yet */
      gsap.set(vLeaves, { rotation: function (i) { return i < 2 ? (i ? -12 : 12) : (i === 2 ? 14 : -14); } });
      if (vBud) gsap.set(vBud, { rotation: -40 });
      if (vDrop) gsap.set(vDrop, { autoAlpha: 0 });
      gsap.set(bubble, { autoAlpha: 0, scale: 0, transformOrigin: '24% 60%' });
      gsap.set(chs, { autoAlpha: 0 });
      gsap.set(bulbG, { autoAlpha: 0, scale: 0.2, y: 60, svgOrigin: L0.bulb.x + ' ' + (L0.bulb.y + 40) });
      gsap.set(rays, { drawSVG: '50% 50%' });
      gsap.set([icon, label], { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
      gsap.set(phoneG, { autoAlpha: 0, scaleY: 0.1, scaleX: 0.6, svgOrigin: f(phBox(L0).cx) + ' ' + L0.sill });
      gsap.set(rows, { autoAlpha: 0, x: -14 });
      gsap.set(bars, { scaleX: 0, transformOrigin: '0% 50%' });
      gsap.set(add, { autoAlpha: 0 });
      gsap.set(caption, { autoAlpha: 0, scale: 0.4, rotation: -10 });
      gsap.set([arrow, head], { drawSVG: '0%' });

      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
      /* the фиалка wilts */
      tl.to(vLeaves, { rotation: 0, duration: 0.9, ease: 'power2.in', stagger: 0.05 }, 0);
      if (vBud) tl.to(vBud, { rotation: 0, duration: 0.8, ease: 'bounce.out' }, 0.2);
      tl.fromTo(violet, { scaleY: 1, transformOrigin: '50% 100%' }, { transformOrigin: '50% 100%', keyframes: { scaleY: [0.93, 1.02, 1] }, duration: 0.7, ease: 'none', immediateRender: false }, 0.5);
      if (vDrop) tl.fromTo(vDrop, { autoAlpha: 0, y: -8, transformOrigin: '50% 50%' }, { autoAlpha: 1, y: 0, transformOrigin: '50% 50%', duration: 0.4, immediateRender: false }, 0.9);
      /* the phrase */
      tl.to(bubble, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'mp.pop' }, 1.1)
        .to(chs, { autoAlpha: 1, duration: 0.01, stagger: 0.032, ease: 'none' }, 1.4);
      var typed = 1.4 + chs.length * 0.032;
      /* bubble → bulb that glows and rises */
      tl.to(bubble, { scale: 0.08, autoAlpha: 0, duration: 0.42, ease: 'power2.in' }, typed + 0.7)
        .to(bulbG, { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(2.2)' }, typed + 0.95)
        .to(bulbG, { y: 0, duration: 1.1, ease: 'power3.out' }, typed + 1.05)
        .to(rays, { drawSVG: '0% 100%', duration: 0.5, ease: 'power2.out' }, typed + 1.25)
        .fromTo(glow, { scale: 0.4, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.8, ease: 'elastic.out(1,.5)', immediateRender: false }, typed + 1.25);
      /* the goal */
      var g0 = typed + 1.9;
      tl.to(icon, { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'back.out(2.2)' }, g0)
        .to(label, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2.2)' }, g0 + 0.2)
        .to(phoneG, { autoAlpha: 1, scaleY: 1, scaleX: 1, duration: 0.6, ease: 'back.out(1.8)' }, g0 + 0.35)
        .to(rows, { autoAlpha: 1, x: 0, duration: 0.35, stagger: 0.1 }, g0 + 0.7)
        .to(bars, { scaleX: 1, duration: 0.6, ease: 'power2.out', stagger: 0.1 }, g0 + 0.85)
        .to(add, { autoAlpha: 1, duration: 0.3 }, g0 + 1.05)
        .to(caption, { autoAlpha: 1, scale: 1, rotation: 3, duration: 0.5, ease: 'back.out(2)' }, g0 + 1.0)
        .to(arrow, { drawSVG: '100%', duration: 0.4, ease: 'power1.inOut' }, g0 + 1.3)
        .to(head, { drawSVG: '100%', duration: 0.2 }, g0 + 1.65)
        .set(caption, { clearProps: 'transform' }, g0 + 1.6);

      window.ScrollTrigger.create({ trigger: st, start: 'top 65%', once: true, onEnter: function () { tl.play(0); } });
      MP.blink(st, api);
    }
  });

  function headIn(section, api) {
    var gsap = api.gsap, h2 = MP.$('.scene-head h2', section), lead = MP.$('.scene-head .lead', section);
    if (window.SplitText && h2) {
      SplitText.create(h2, {
        type: 'words', autoSplit: true,
        onSplit: function (self) {
          return gsap.from(self.words, { y: 40, rotation: 4, opacity: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06,
            scrollTrigger: { trigger: h2, start: 'top 85%', once: true } });
        }
      });
    }
    if (lead) gsap.from(lead, { y: 24, opacity: 0, duration: 0.6, ease: 'power3.out', delay: 0.15, scrollTrigger: { trigger: lead, start: 'top 88%', once: true } });
  }
})();
