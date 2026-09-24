/* scenes/konveyer.js — «Пайплайн — это просто конвейер» (package A, docs/design-prosto.md §2.2).
 * Two layouts are built once (CSS shows one): WIDE (≥1024px, viewBox 1600×700, straight belt) and TALL (<1024px,
 * viewBox 620×650, serpentine belt in two rows). The built DOM is the calm poster: a 4-station belt with arrows, a
 * worker at every station, lamps mint, the finished phone at the end (wide: end of the belt; tall: at «Выдать»).
 * init, wide  : pre-roll (pipe draws while the stage scrolls in) + pinned scrub (+120%, 0.6): letters P-I-P-E-L-I-N-E
 *               flow through the pipe → the pipe flattens into a belt → characters drop onto 4 stations → a box rides
 *               the belt, each station lights mint and adds a part → a phone.
 * init, narrow: the same story as one toggle-once timeline (~4.5 s).
 * final       : the poster as built. */
(function () {
  'use strict';
  var MP = window.MP;

  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', MINT = '#2BD99F', SKY = '#3EC5FF', STEEL_D = '#8E9BB8',
    WHITE = '#FFFFFF', LEAF = '#1BB283', TANG = '#FF8A1F';
  var FONT_T = "'Golos Text', 'Segoe UI', system-ui, sans-serif";
  var FONT_D = "Unbounded, 'Arial Black', system-ui, sans-serif";
  var LETTERS = 'PIPELINE'.split('');
  var STATIONS = [
    { label: 'Придумать', char: 'pisar' },
    { label: 'Собрать', char: 'master' },
    { label: 'Проверить', char: 'ispytatel' },
    { label: 'Выдать', char: 'priyomshchik' }
  ];

  /* ---------- layouts ----------
   * Every station: a sign (centred on st.x), a worker standing BEHIND the belt a little downstream (st.x + dir·off) and
   * the product's stop a little upstream (st.x − dir·off) — so the product never parks in front of a worker's face.
   * rows[] = the belt's top surface per row (the product track and the workers' feet). */
  var WIDE = {
    key: 'wide', w: 1600, h: 700,
    pipe: [[-70, 300], [380, 300], [380, 140], [760, 140], [760, 470], [1140, 470], [1140, 270], [1680, 270]], pipeR: 90, pipeW: 66,
    belt: { x: 28, y: 540, w: 1548, h: 48, pitch: 32, legs: 58 },
    flat: 'M28 564L1576 564',
    track: [[92, 540], [1528, 540]],
    st: [{ x: 220, row: 0, dir: 1 }, { x: 580, row: 0, dir: 1 }, { x: 940, row: 0, dir: 1 }, { x: 1300, row: 0, dir: 1 }],
    charOff: 70, stopOff: 66, rest: [1528, 540],
    rows: [540], charScale: 1.62, signY: 176, signSize: 30, rail: 92, product: 1.2, letter: 1.1,
    arrows: [[408, 207], [760, 207], [1128, 207]], arrowAt: [1, 2, 3],
    cap: [{ x: 60, y: 18, size: 34 }, { x: 800, y: 396, size: 40, center: true }], capOut: 4.75
  };
  var TALL = {
    key: 'tall', w: 620, h: 650,
    pipe: [[-60, 262], [560, 262], [560, 576], [-60, 576]], pipeR: 110, pipeW: 48,
    beltPts: [[20, 262], [560, 262], [560, 576], [20, 576]], beltR: 110, beltW: 44,
    track: [[40, 240], [582, 240], [582, 554], [40, 554]], trackR: 132,
    st: [{ x: 133, row: 0, dir: 1 }, { x: 373, row: 0, dir: 1 }, { x: 345, row: 1, dir: -1 }, { x: 125, row: 1, dir: -1 }],
    charOff: 55, stopOff: 55, restAtLast: true,
    rows: [240, 554], charScale: 1.1, signY: [22, 336], signSize: 28, product: 0.9, letter: 0.9, letterGap: 54,
    arrows: [[262, 310, 0], [242, 624, 180]], arrowAt: [1, 3],
    cap: [{ x: 310, y: 380, size: 34, center: true }, { x: 310, y: 380, size: 34, center: true }], capOut: 4.45
  };
  function stopX(L0, st) { return st.x - st.dir * L0.stopOff; }
  function charX(L0, st) { return st.x + st.dir * L0.charOff; }
  function restPos(L0) {
    if (L0.restAtLast) { var st = L0.st[L0.st.length - 1]; return [stopX(L0, st), L0.rows[st.row]]; }
    return L0.rest;
  }

  /* ---------- markup helpers ---------- */
  function f(v) { return String(Math.round(v * 100) / 100); }
  function R(x, y, w, h, rx, fill, ex) {
    return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' + (rx ? ' rx="' + f(rx) + '"' : '') +
      ' fill="' + fill + '"' + (ex || '') + '/>';
  }
  function C(cx, cy, r, fill, ex) { return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + fill + '"' + (ex || '') + '/>'; }
  function P(d, fill, ex) { return '<path d="' + d + '" fill="' + fill + '"' + (ex || '') + '/>'; }
  function L(d, col, w, ex) { return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (ex || '') + '/>'; }
  function G(cls, inner, ex) { return '<g' + (cls ? ' class="' + cls + '"' : '') + (ex || '') + '>' + inner + '</g>'; }
  function T(x, y, s, size, o) {
    o = o || {};
    return '<text x="' + f(x) + '" y="' + f(y) + '" font-family="' + (o.display ? FONT_D : FONT_T) + '" font-size="' + size +
      '" font-weight="' + (o.weight || 700) + '" fill="' + (o.fill || INK) + '" stroke="none"' + (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + '>' + s + '</text>';
  }
  var NS = ' stroke="none"', HIDE = ' opacity="0" visibility="hidden"';
  function sparkD(cx, cy, r) {
    var k = r * 0.26;
    return 'M' + f(cx) + ' ' + f(cy - r) + 'Q' + f(cx + k) + ' ' + f(cy - k) + ' ' + f(cx + r) + ' ' + f(cy) + 'Q' + f(cx + k) + ' ' + f(cy + k) +
      ' ' + f(cx) + ' ' + f(cy + r) + 'Q' + f(cx - k) + ' ' + f(cy + k) + ' ' + f(cx - r) + ' ' + f(cy) + 'Q' + f(cx - k) + ' ' + f(cy - k) +
      ' ' + f(cx) + ' ' + f(cy - r) + 'Z';
  }
  function tr(x, y, s, r) { return ' transform="translate(' + f(x) + ' ' + f(y) + ')' + (r ? ' rotate(' + f(r) + ')' : '') + (s && s !== 1 ? ' scale(' + f(s) + ')' : '') + '"'; }

  /* the thing riding the belt; origin = bottom centre. Layers: box → +sheet → phone → +check → +app icon */
  function product(L0) {
    var s = '';
    s += G('kv-p-box', R(-50, -84, 100, 84, 12, CREAM, ' stroke-width="4"') + R(-11, -84, 22, 84, 0, SKY, NS) +
      L('M-11 -84V0M11 -84V0', INK, 3) + L('M-50 -62H50', INK, 3, ' stroke-opacity=".25"') + R(-50, -84, 100, 84, 12, 'none', ' stroke-width="4"'), HIDE);
    s += G('kv-p-sheet', G('', R(-36, -74, 72, 58, 6, SKY, ' stroke-width="3.5"') +
      L('M-26 -60H14M-26 -50H24M-26 -40H6M-26 -30H18', CREAM, 3.2, ' stroke-linecap="round"') + C(22, -34, 7, 'none', ' stroke="' + CREAM + '" stroke-width="2.6"'),
      ' transform="rotate(-5)"'), HIDE);
    s += G('kv-p-phone', R(-36, -128, 72, 128, 15, INK) + R(-30, -121, 60, 114, 10, VIOLET, NS) +
      P('M-30 -70L10 -121H24L-30 -52Z', WHITE, NS + ' fill-opacity=".12"') + R(-11, -117, 22, 6, 3, INK, NS) +
      R(-12, -14, 24, 3, 1.5, CREAM, NS + ' fill-opacity=".5"'));
    s += G('kv-p-icon', R(-19, -84, 38, 38, 11, MINT, ' stroke-width="3.2"') +
      P('M-2 -78C-2 -78 -11 -68 -11 -62.5A9 9 0 0 0 7 -62.5C7 -68 -2 -78 -2 -78Z', SKY, ' stroke-width="2.6"') +
      P('M5 -71C6.5 -77 12 -80 15.5 -79C15.5 -73.5 11.5 -69.5 6 -70Z', LEAF, ' stroke-width="2.4"'));
    s += G('kv-p-check', C(34, -120, 17, MINT, ' stroke-width="4"') + L('M26 -120.5l5.5 5.5 10.5-11', INK, 4.4, ' stroke-linecap="round" stroke-linejoin="round"'));
    s += G('kv-p-spark', P(sparkD(-50, -146, 13), CREAM, ' stroke-width="3"') + P(sparkD(54, -66, 9), CREAM, ' stroke-width="3"'));
    var end = restPos(L0);
    return G('kv-product', s, tr(end[0], end[1], L0.product));
  }

  function sign(x, y, label, size, i) {
    var tw = label.length * size * 0.585, w = tw + size * 3.1, h = size * 2.05, x0 = x - w / 2, lx = x0 + size * 1.05;
    return G('kv-sign kv-sign--' + i,
      R(x0 + 6, y + 6, w, h, h / 2.6, INK, NS) + R(x0, y, w, h, h / 2.6, CREAM, ' stroke-width="4"') +
      G('kv-lamp kv-lamp--' + i, C(lx, y + h / 2, size * 0.42, STEEL_D, ' stroke-width="3.4" class="kv-lamp-off"') +
        C(lx, y + h / 2, size * 0.42, MINT, ' stroke-width="3.4" class="kv-lamp-on"') + C(lx - size * 0.13, y + h / 2 - size * 0.14, size * 0.11, WHITE, NS)) +
      T(lx + size * 0.72, y + h / 2 + size * 0.36, label, size, { weight: 750 }));
  }

  function arrow(x, y, rot) {
    return G('kv-arrow', P('M-26 -7H6V-17L26 0L6 17V7H-26Z', INK, ' stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"'), tr(x, y, 1, rot || 0));
  }

  /* caption chips: «Трубопровод» while it is a pipe, «Конвейер» once it is a belt (both transient: hidden when built) */
  function chip(c, text, cls) {
    var size = c.size, w = text.length * size * 0.6 + size * 1.5, h = size * 1.9, x0 = c.center ? c.x - w / 2 : c.x;
    return G('kv-cap ' + cls, R(x0 + 6, c.y + 6, w, h, h / 2, INK, NS) + R(x0, c.y, w, h, h / 2, CREAM, ' stroke-width="4"') +
      T(x0 + w / 2, c.y + h / 2 + size * 0.36, text, size, { weight: 800, anchor: 'middle' }), HIDE);
  }

  function letter(ch, k, s) {
    return G('kv-letter kv-letter--' + k, C(0, 0, 28, CREAM, ' stroke-width="4"') + T(0, 11, ch, 30, { display: true, weight: 800, anchor: 'middle' }),
      ' transform="translate(-200 -200) scale(' + s + ')"' + HIDE);
  }

  function pipe(L0) {
    var d = MP.beltPath(L0.pipe, L0.pipeR), w = L0.pipeW;
    return G('kv-pipe',
      '<path class="kv-pipe-flange" d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + (w + 30) + '" stroke-dasharray="16 190" stroke-linecap="butt"/>' +
      '<path class="kv-pipe-line kv-pipe-o" d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + (w + 12) + '"/>' +
      '<path class="kv-pipe-line kv-pipe-i" d="' + d + '" fill="none" stroke="' + SKY + '" stroke-width="' + w + '"/>' +
      '<path class="kv-pipe-line kv-pipe-hl" d="' + d + '" fill="none" stroke="' + WHITE + '" stroke-opacity=".55" stroke-width="' + Math.round(w * 0.14) +
      '" transform="translate(-' + Math.round(w * 0.2) + ' -' + Math.round(w * 0.22) + ')"/>', HIDE) +
      '<path class="kv-letter-track" d="' + d + '" fill="none" stroke="none"/>';
  }

  function build(L0) {
    var s = '', i;
    var trackD = L0.trackR ? MP.beltPath(L0.track, L0.trackR) : 'M' + L0.track[0].join(' ') + 'L' + L0.track[1].join(' ');
    s += '<path class="kv-track" d="' + trackD + '" fill="none" stroke="none"/>';
    /* ceiling rail (wide only) */
    if (L0.rail) {
      s += G('kv-rail', R(60, L0.rail, L0.w - 120, 14, 7, INK, NS) +
        L0.st.map(function (st) { return L('M' + (st.x - 70) + ' ' + (L0.rail + 10) + 'V' + (L0.signY + 4) + 'M' + (st.x + 70) + ' ' + (L0.rail + 10) + 'V' + (L0.signY + 4), INK, 4, ' stroke-dasharray="7 5"'); }).join(''));
    }
    /* signs + characters, row by row, belts in between */
    var signs = '', chars = '';
    L0.st.forEach(function (st, k) {
      var sy = Array.isArray(L0.signY) ? L0.signY[st.row] : L0.signY, base = L0.rows[st.row], cs = L0.charScale;
      signs += sign(st.x, sy, STATIONS[k].label, L0.signSize, k);
      chars += G('kv-char kv-char--' + k, MP.char(STATIONS[k].char, { x: charX(L0, st) - 60 * cs, y: base + 24 - 140 * cs, scale: cs }));
    });
    s += G('kv-signs', signs) + G('kv-arrows', L0.arrows.map(function (a) { return arrow(a[0], a[1], a[2]); }).join(''));
    s += G('kv-chars', chars);
    /* belt */
    if (L0.belt) {
      s += G('kv-belt', E_floor(L0) + MP.belt({ x: L0.belt.x, y: L0.belt.y, w: L0.belt.w, h: L0.belt.h, pitch: L0.belt.pitch, legs: L0.belt.legs }));
    } else {
      s += G('kv-belt', MP.belt({ points: L0.beltPts, r: L0.beltR, w: L0.beltW, pitch: 26 }));
    }
    s += product(L0);
    s += pipe(L0);
    var lt = '';
    for (i = 0; i < LETTERS.length; i++) lt += letter(LETTERS[i], i, L0.letter);
    s += G('kv-letters', lt);
    s += chip(L0.cap[0], 'Трубопровод', 'kv-cap--pipe') + chip(L0.cap[1], 'Конвейер', 'kv-cap--belt');
    return MP.svg(G('', s, ' stroke="' + INK + '" stroke-linejoin="round" stroke-linecap="round"'), '0 0 ' + L0.w + ' ' + L0.h, 'kv-svg kv-svg--' + L0.key);
  }
  function E_floor(L0) {
    return '<ellipse cx="' + (L0.w / 2) + '" cy="' + (L0.belt.y + L0.belt.h + L0.belt.legs + 8) + '" rx="' + (L0.belt.w / 2 + 20) + '" ry="12" fill="' + INK + '" fill-opacity=".12" stroke="none"/>';
  }

  /* ---------- timeline ---------- */
  /* draw: the pipe draws itself. main: letters → flatten → stations → product. Units are arbitrary (scrub) / seconds. */
  function timelines(svg, L0, gsap, parts) {
    var q = function (s) { return MP.$(s, svg); }, qa = function (s) { return MP.$$(s, svg); };
    var pipeG = q('.kv-pipe'), lines = qa('.kv-pipe-line'), flange = q('.kv-pipe-flange'), track = q('.kv-letter-track');
    var letters = qa('.kv-letter'), belt = q('.kv-belt'), chev = qa('.belt-chev'), rollers = qa('.belt-roller'), flow = qa('.belt-flow');
    var signs = qa('.kv-sign'), chars = qa('.kv-char'), arrows = qa('.kv-arrow'), rail = q('.kv-rail');
    var prod = q('.kv-product'), box = q('.kv-p-box'), sheet = q('.kv-p-sheet'), phone = q('.kv-p-phone'), icon = q('.kv-p-icon'),
      check = q('.kv-p-check'), spark = q('.kv-p-spark'), trackEl = q('.kv-track');
    var ps = L0.product, capPipe = q('.kv-cap--pipe'), capBelt = q('.kv-cap--belt');

    /* start states */
    gsap.set(pipeG, { autoAlpha: 1 });
    gsap.set(lines, { drawSVG: '0%' });
    gsap.set(flange, { autoAlpha: 0 });
    gsap.set(letters, { autoAlpha: 0, scale: L0.letter, transformOrigin: '50% 50%' });
    gsap.set(belt, { autoAlpha: 0 });
    gsap.set(signs, { autoAlpha: 0, y: L0.key === 'wide' ? -160 : -60 });
    if (rail) gsap.set(rail, { autoAlpha: 0, y: -60 });
    gsap.set(arrows, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set(chars, { autoAlpha: 0, y: L0.key === 'wide' ? -520 : -130 });
    gsap.set(qa('.kv-lamp-on'), { autoAlpha: 0 });
    gsap.set([sheet, phone, icon, check, spark], { autoAlpha: 0 });
    gsap.set(box, { autoAlpha: 1 });
    gsap.set(prod, { autoAlpha: 0, scale: ps });
    gsap.set([capPipe, capBelt], { autoAlpha: 0, transformOrigin: '50% 50%' });

    var draw = gsap.timeline({ paused: true });
    draw.to(lines, { drawSVG: '100%', duration: 1, ease: 'none' }, 0)
      .to(flange, { autoAlpha: 1, duration: 0.15 }, 0.85)
      .fromTo(capPipe, { autoAlpha: 0, scale: 0.4, rotation: -8 }, { autoAlpha: 1, scale: 1, rotation: -2, duration: 0.3, ease: 'back.out(2.2)', immediateRender: false }, 0.5);

    var tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
    /* 0–2.6 letters flow (last letter enters first, so the word reads left→right) */
    var n = letters.length, trackLen = track.getTotalLength() || 1600;
    for (var k = 0; k < n; k++) {
      var j = n - 1 - k, el = letters[k];
      /* wide: spread along the wavy pipe; tall: line up on the first straight run */
      var endAt = L0.key === 'wide' ? 0.9 - j * 0.1 : (100 + k * L0.letterGap) / trackLen;
      tl.set(el, { autoAlpha: 1 }, 0.1 + j * 0.2)
        .to(el, { motionPath: { path: track, start: 0, end: endAt }, duration: 2.5 - j * 0.2, ease: 'power1.inOut' }, 0.1 + j * 0.2);
    }
    /* the caption flips: «Трубопровод» → «Конвейер» */
    tl.to(capPipe, { scaleY: 0, duration: 0.2, ease: 'power2.in' }, 2.8)
      .set(capPipe, { autoAlpha: 0 }, 3.0)
      .set(capBelt, { autoAlpha: 1 }, 3.95)
      .fromTo(capBelt, { scaleY: 0, rotation: 0 }, { scaleY: 1, rotation: 2, duration: 0.4, ease: 'back.out(2.6)', immediateRender: false }, 3.95)
      .fromTo(capBelt, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -16, duration: 0.3, ease: 'power2.in', immediateRender: false }, L0.capOut);
    /* 2.6–3.3 letters pop out of the pipe */
    tl.to(letters, { scale: L0.letter * 1.35, duration: 0.18, ease: 'power2.out', stagger: 0.05 }, 2.65)
      .to(letters, { scale: 0, autoAlpha: 0, duration: 0.22, ease: 'power2.in', stagger: 0.05 }, 2.83);
    /* 3.0–4.6 the pipe flattens into a belt */
    if (L0.flat) {
      tl.to([flange, q('.kv-pipe-hl')], { autoAlpha: 0, duration: 0.2 }, 2.75)
        .to([q('.kv-pipe-o'), q('.kv-pipe-i')], { morphSVG: L0.flat, duration: 1.1, ease: 'power2.inOut' }, 2.9)
        .to(pipeG, { scaleY: 0.6, svgOrigin: '800 564', duration: 0.5, ease: 'power2.in' }, 3.7);
    } else {
      tl.to(pipeG, { scale: 0.97, svgOrigin: (L0.w / 2) + ' ' + (L0.h / 2), duration: 0.8, ease: 'power2.inOut' }, 3.0);
    }
    tl.to(belt, { autoAlpha: 1, duration: 0.5 }, 3.9)
      .to(pipeG, { autoAlpha: 0, duration: 0.5 }, 4.05);
    /* 4.6–6.2 stations: rail, signs, characters drop in */
    if (rail) tl.to(rail, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'back.out(1.6)' }, 4.5);
    signs.forEach(function (sg, i) {
      tl.to(sg, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'back.out(1.7)' }, 4.6 + i * 0.16);
    });
    chars.forEach(function (ch, i) {
      var t = 4.9 + i * 0.22, body = MP.$('.c-char', ch);
      tl.to(ch, { autoAlpha: 1, duration: 0.05 }, t)
        .to(ch, { y: 0, duration: 0.45, ease: 'power3.in' }, t)
        .fromTo(body, { scaleY: 0.72, scaleX: 1.18, transformOrigin: '50% 100%' }, { scaleY: 1, scaleX: 1, transformOrigin: '50% 100%', duration: 0.5, ease: 'elastic.out(1,.45)', immediateRender: false }, t + 0.45);
    });
    /* 6.3–10 the product rides; stations light and add parts */
    var fr = stationFractions(trackEl, L0), T0 = 6.4, T1 = 10, dwell = 0.22;
    var legs = [fr[0]].concat(fr.slice(1).map(function (v, i) { return v - fr[i]; }));
    if (!L0.restAtLast) legs.push(1 - fr[3]);
    var sum = legs.reduce(function (a, b) { return a + b; }, 0), travel = T1 - T0 - dwell * 4;
    tl.fromTo(prod, { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: ps, duration: 0.35, ease: 'back.out(2.4)', immediateRender: false }, 6.15)
      .set(prod, { motionPath: { path: trackEl, start: 0, end: 0 } }, 6.15);
    var t = T0, pos = 0;
    legs.forEach(function (len, i) {
      var dur = travel * len / sum, to = pos + len;
      tl.to(prod, { motionPath: { path: trackEl, start: pos, end: to }, duration: dur, ease: 'none' }, t);
      moveBelt(t, dur, len);
      t += dur; pos = to;
      if (i < 4) { stationHit(i, t); t += dwell; }
    });
    tl.to({}, { duration: 0.01 }, T1);

    function moveBelt(t, dur, len) {
      var dist = len * (L0.key === 'wide' ? 1400 : 1500);
      if (chev.length) {
        var pitch = +chev[0].getAttribute('data-pitch') || 32;
        tl.to(chev, { x: '+=' + dist, duration: dur, ease: 'none', modifiers: { x: gsap.utils.unitize(function (x) { return parseFloat(x) % pitch; }) } }, t);
        tl.to(rollers, { rotation: '+=' + dist * 2.4, duration: dur, ease: 'none' }, t);
      }
      if (flow.length) tl.to(flow, { strokeDashoffset: '-=' + dist, duration: dur, ease: 'none' }, t);
    }
    function stationHit(i, t) {
      var lamp = MP.$('.kv-lamp--' + i, svg), on = MP.$('.kv-lamp-on', lamp), ch = chars[i];
      /* the worker reaches towards the product (the arm on the product's side), leans in and hops */
      var dir = L0.st[i].dir, arm = MP.$(dir > 0 ? '.c-arm-l' : '.c-arm-r', ch), c = MP.$('.c-char', ch);
      tl.to(on, { autoAlpha: 1, duration: 0.05 }, t)
        .fromTo(lamp, { scale: 1.5, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.3, ease: 'elastic.out(1,.5)', immediateRender: false }, t)
        .fromTo(arm, { rotation: 0 }, { rotation: dir > 0 ? 80 : -80, duration: 0.14, ease: 'power2.out', yoyo: true, repeat: 1, immediateRender: false }, t - 0.08)
        .fromTo(c, { y: 0, rotation: 0 }, { y: -14, rotation: dir > 0 ? -7 : 7, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, t);
      var ai = L0.arrowAt.indexOf(i);
      if (ai >= 0 && arrows[ai]) tl.to(arrows[ai], { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)' }, t - 0.1);
      if (i === 0) {
        tl.fromTo(sheet, { autoAlpha: 0, scale: 1.8, rotation: -30, transformOrigin: '50% 50%' },
          { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.28, ease: 'back.out(2)', immediateRender: false }, t);
      } else if (i === 1) {
        tl.to([box, sheet], { scaleY: 0.2, autoAlpha: 0, transformOrigin: '50% 100%', duration: 0.16, ease: 'power2.in' }, t)
          .fromTo(phone, { autoAlpha: 0, scaleY: 0.2, transformOrigin: '50% 100%' }, { autoAlpha: 1, scaleY: 1, duration: 0.3, ease: 'back.out(2.6)', immediateRender: false }, t + 0.12);
      } else if (i === 2) {
        tl.fromTo(check, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(3)', immediateRender: false }, t);
      } else {
        tl.fromTo(icon, { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(3)', immediateRender: false }, t)
          .fromTo(spark, { autoAlpha: 0, scale: 0.3, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(3)', immediateRender: false }, t + 0.1);
      }
    }
    return { draw: draw, main: tl };
  }

  /* where along the product track each station sits (0…1) */
  function stationFractions(trackEl, L0) {
    var total = trackEl.getTotalLength(), out = [];
    L0.st.forEach(function (st) {
      var y = L0.rows[st.row], x = stopX(L0, st), best = 0, bestD = 1e9;
      for (var s = 0; s <= 800; s++) {
        var p = trackEl.getPointAtLength(total * s / 800), d = Math.abs(p.x - x) + Math.abs(p.y - y) * 3;
        if (d < bestD) { bestD = d; best = s / 800; }
      }
      out.push(best);
    });
    return out;
  }

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

  /* built-state snapshot: GSAP reverts can leave MotionPath transforms, DrawSVG styles and morphed paths behind,
   * so final() and init() hard-restore what build() produced and drop GSAP's transform cache. */
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

  MP.scene('konveyer', {
    build: function (section, api) {
      var st = api.stage;
      st.appendChild(build(WIDE));
      st.appendChild(build(TALL));
      snap(st);
    },
    final: function (section, api) { restore(api.stage); },
    init: function (section, api) {
      restore(api.stage);
      var gsap = api.gsap, ST = window.ScrollTrigger;
      headIn(section, api);
      var svg = MP.$(api.wide ? '.kv-svg--wide' : '.kv-svg--tall', api.stage);
      var L0 = api.wide ? WIDE : TALL;
      var t = timelines(svg, L0, gsap);
      if (api.wide) {
        var header = function () { var h = document.querySelector('.site-header'); return h ? h.offsetHeight : 0; };
        var pinStart = function () { return 'center ' + Math.round((window.innerHeight + header()) / 2) + 'px'; };
        ST.create({ trigger: api.stage, start: 'top 92%', end: pinStart, scrub: 0.6, animation: t.draw });
        ST.create({ trigger: api.stage, start: pinStart, end: '+=120%', pin: true, scrub: 0.6, animation: t.main, anticipatePin: 1 });
        requestAnimationFrame(function () { ST.refresh(); });
      } else {
        t.draw.paused(false).duration(0.8);
        t.main.paused(false);
        var all = gsap.timeline({ paused: true }).add(t.draw, 0).add(t.main, 0.6);
        all.timeScale(all.duration() / 4.8);
        ST.create({ trigger: api.stage, start: 'top 72%', once: true, onEnter: function () { all.play(0); } });
      }
    }
  });
})();
