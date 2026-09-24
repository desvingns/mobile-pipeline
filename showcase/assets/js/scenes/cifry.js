/* scenes/cifry.js — «Фабрика в цифрах» (package C; docs/design-prosto.md §2.10).
 * Every tile gets a mini picture in its .tile-viz that is built FROM the number already in the DOM (filled from
 * MP_FACTS by MP.applyFacts — nothing is hard-coded): 49 → a grid of little faces (split «для чертежа / для сборки»
 * from MP_FACTS.agentsSpec when present), 23 → lamps on a control panel, 18 → a fan of sheets, 4 → lemon lamps (your
 * «да»), 1 → one wrench on one nut, 25 → calendar dots.
 * Animated: tiles pop in with a stagger; each number counts up from 0 (1.4 s, power2.out, snap 1) and its picture
 * fills in exactly in step with the counter (item k appears when the counter reaches k). Hovering a tile with a mouse
 * replays its count. Calm / no GSAP: final numbers, full static pictures (= the built DOM).
 * Accessibility: tiles are animated with opacity/transform only (never visibility), and build() splits each number
 * into an aria-hidden counter (the one that runs from 0) plus a visually hidden copy of the real value, so assistive
 * tech always reads the true number, before, during and after the count.
 */
(function () {
  'use strict';
  var MP = window.MP;
  if (!MP || !MP.scene) return;

  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', LEMON = '#FFDA4F', MINT = '#2BD99F',
    SKY = '#3EC5FF', TANG = '#FF8A1F', STEEL = '#C9D3E6', STEEL_D = '#8E9BB8', WHITE = '#FFFFFF', DIM = '#3A3474';
  var DUR = 1.4;

  function f(v) { return String(Math.round(v * 100) / 100); }
  function R(x, y, w, h, rx, fill, ex) {
    return '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '"' +
      (rx ? ' rx="' + f(rx) + '"' : '') + ' fill="' + fill + '"' + (ex || '') + '/>';
  }
  function C(cx, cy, r, fill, ex) {
    return '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + fill + '"' + (ex || '') + '/>';
  }
  function P(d, fill, ex) { return '<path d="' + d + '" fill="' + fill + '"' + (ex || '') + '/>'; }
  function Ln(d, col, w, ex) { return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + w + '"' + (ex || '') + '/>'; }
  var NS = ' stroke="none"';
  function grid(n, cols) { return { cols: cols || Math.ceil(Math.sqrt(n)), rows: Math.ceil(n / (cols || Math.ceil(Math.sqrt(n)))) }; }

  /* ---------- the pictures (viewBox 0 0 100 100); items carry class "cf-i" in counting order ---------- */
  var VIZ = {
    agents: function (n) {
      var F = window.MP_FACTS || {}, split = +F.agentsSpec > 0 && +F.agentsSpec < n ? +F.agentsSpec : 0;
      var g = grid(n), step = Math.min(88 / g.cols, 88 / g.rows), r = step * 0.4, x0 = 50 - (g.cols - 1) * step / 2,
        y0 = 50 - (g.rows - 1) * step / 2, s = '';
      for (var i = 0; i < n; i++) {
        var cx = x0 + (i % g.cols) * step, cy = y0 + Math.floor(i / g.cols) * step, col = split && i >= split ? TANG : MINT;
        s += '<g class="cf-i">' + C(cx, cy, r, col, ' stroke-width="1.6"') +
          C(cx - r * 0.34, cy - r * 0.12, r * 0.16, INK, NS) + C(cx + r * 0.34, cy - r * 0.12, r * 0.16, INK, NS) +
          Ln('M' + f(cx - r * 0.32) + ' ' + f(cy + r * 0.28) + 'Q' + f(cx) + ' ' + f(cy + r * 0.62) + ' ' + f(cx + r * 0.32) + ' ' + f(cy + r * 0.28), INK, 1.1, ' stroke-linecap="round"') + '</g>';
      }
      return s;
    },
    scripts: function (n) {
      var cols = n > 12 ? 6 : Math.min(n, 4), g = grid(n, cols), step = Math.min(84 / cols, 64 / g.rows), r = step * 0.34;
      var w = cols * step + 8, h = g.rows * step + 8, x0 = 50 - w / 2, y0 = 54 - h / 2;
      var s = R(x0 - 2, y0 - 12, w + 4, h + 16, 8, STEEL, ' stroke-width="2.6"') + R(x0 + 4, y0 - 8, w - 8, 5, 2.5, SKY, ' stroke-width="1.6"') +
        C(x0 + 2.5, y0 - 8.5, 1.3, INK, NS) + C(x0 + w - 2.5, y0 - 8.5, 1.3, INK, NS);
      for (var i = 0; i < g.cols * g.rows; i++) {
        var cx = x0 + 4 + step / 2 + (i % cols) * step, cy = y0 + 4 + step / 2 + Math.floor(i / cols) * step;
        if (i >= n) { s += R(cx - r * 0.5, cy - r * 1.1, r, r * 2.2, r * 0.5, INK, NS) + C(cx, cy - r * 1.1, r * 0.55, TANG, ' stroke-width="1.4"'); continue; }
        s += C(cx, cy, r, STEEL_D, ' stroke-width="1.6"') +
          '<g class="cf-i">' + C(cx, cy, r, MINT, ' stroke-width="1.6"') + C(cx - r * 0.32, cy - r * 0.34, r * 0.28, WHITE, NS) + '</g>';
      }
      return s;
    },
    specSheets: function (n) {
      var s = '', span = 136, px = 50, py = 84;
      for (var i = 0; i < n; i++) {
        var a = n > 1 ? -span / 2 + span * i / (n - 1) : 0;
        s += '<g transform="rotate(' + f(a) + ' ' + px + ' ' + py + ')"><g class="cf-i">' +
          R(px - 8, py - 56, 16, 25, 2.5, i === n - 1 ? WHITE : CREAM, ' stroke-width="1.7"') +
          Ln('M' + f(px - 4.5) + ' ' + f(py - 50) + 'h9M' + f(px - 4.5) + ' ' + f(py - 45.5) + 'h6', INK, 1.2, ' stroke-opacity=".45"') + '</g></g>';
      }
      return s + C(px, py, 6, VIOLET, ' stroke-width="2.2"') + C(px, py, 2, CREAM, NS);
    },
    humanYes: function (n) {
      var cols = n <= 4 ? 2 : 3, g = grid(n, cols), step = 36, w = cols * step + 14, h = g.rows * step + 14,
        x0 = 50 - w / 2, y0 = 52 - h / 2, s = R(x0 + 4, y0 + 4, w, h, 12, INK, NS + ' fill-opacity=".3"') + R(x0, y0, w, h, 12, INK, ' stroke-width="2"');
      for (var i = 0; i < n; i++) {
        var cx = x0 + 7 + step / 2 + (i % cols) * step, cy = y0 + 7 + step / 2 + Math.floor(i / cols) * step;
        s += C(cx, cy, 12, DIM, ' stroke="' + CREAM + '" stroke-opacity=".35" stroke-width="2"') +
          '<g class="cf-i">' + C(cx, cy, 16, LEMON, NS + ' fill-opacity=".28"') + C(cx, cy, 12, LEMON, ' stroke="' + CREAM + '" stroke-width="2"') +
          C(cx - 4, cy - 4.4, 3.2, WHITE, NS) + '</g>';
      }
      return s;
    },
    autofix: function (n) {
      /* one nut, one wrench; n > 1 would add nuts in a row. A lemon «?» = after that it is your call. */
      var s = '', k = Math.max(1, Math.min(n, 3)), i, j;
      for (i = 0; i < k; i++) {
        var cx = k === 1 ? 36 : 18 + i * 28, cy = 64, r = k === 1 ? 17 : 11, hex = '';
        for (j = 0; j < 6; j++) { var a = (j * 60 + 30) * Math.PI / 180; hex += (j ? 'L' : 'M') + f(cx + Math.cos(a) * r * 0.66) + ' ' + f(cy + Math.sin(a) * r * 0.66); }
        var p0 = [cx + Math.cos(165 * Math.PI / 180) * r, cy + Math.sin(165 * Math.PI / 180) * r],
          p1 = [cx + Math.cos(105 * Math.PI / 180) * r, cy + Math.sin(105 * Math.PI / 180) * r],
          h0 = [cx + Math.cos(-45 * Math.PI / 180) * (r + 1), cy + Math.sin(-45 * Math.PI / 180) * (r + 1)],
          h1 = [cx + (k === 1 ? 50 : 30), cy - (k === 1 ? 50 : 30)];
        var head = 'M' + f(p0[0]) + ' ' + f(p0[1]) + 'A' + r + ' ' + r + ' 0 1 1 ' + f(p1[0]) + ' ' + f(p1[1]);
        var arm = 'M' + f(h0[0]) + ' ' + f(h0[1]) + 'L' + f(h1[0]) + ' ' + f(h1[1]);
        s += '<g class="cf-nut">' + P(hex + 'Z', STEEL, ' stroke-width="2.2"') + C(cx, cy, r * 0.26, INK, NS) + '</g>';
        s += '<g class="cf-i" data-pivot="' + f(cx) + ' ' + f(cy) + '">' +
          Ln(arm, INK, k === 1 ? 17 : 12, ' stroke-linecap="round"') + Ln(head, INK, k === 1 ? 14 : 10, ' stroke-linecap="round"') +
          Ln(arm, CREAM, k === 1 ? 11 : 7, ' stroke-linecap="round"') + Ln(head, CREAM, k === 1 ? 8.5 : 5.5, ' stroke-linecap="round"') +
          Ln('M' + f(h0[0] + 6) + ' ' + f(h0[1] - 3) + 'L' + f(h1[0] - 4) + ' ' + f(h1[1] + 1), WHITE, 1.8, ' stroke-linecap="round"') + '</g>';
      }
      return s + '<g class="cf-once">' + C(80, 80, 13, LEMON, ' stroke-width="2.4"') +
        '<text x="80" y="86.5" font-family="Unbounded, Arial Black, sans-serif" font-size="17" font-weight="900" fill="' + INK + '" text-anchor="middle">?</text></g>';
    },
    releases: function (n) {
      var g = grid(n), step = Math.min(78 / g.cols, 62 / g.rows), r = step * 0.3;
      var s = R(8, 16, 88, 82, 9, INK, NS + ' fill-opacity=".3"') + R(4, 12, 88, 82, 9, CREAM, ' stroke-width="2.6"') +
        P('M4 30V21Q4 12 13 12H83Q92 12 92 21V30Z', VIOLET, ' stroke-width="2.6"') +
        R(22, 5, 6, 14, 3, STEEL, ' stroke-width="2"') + R(68, 5, 6, 14, 3, STEEL, ' stroke-width="2"');
      var x0 = 48 - (g.cols - 1) * step / 2, y0 = 62 - (g.rows - 1) * step / 2;
      for (var i = 0; i < n; i++) {
        var cx = x0 + (i % g.cols) * step, cy = y0 + Math.floor(i / g.cols) * step;
        s += C(cx, cy, r, 'none', ' stroke="' + INK + '" stroke-opacity=".35" stroke-width="1.4"') +
          '<g class="cf-i">' + C(cx, cy, r, VIOLET, ' stroke-width="1.4"') + '</g>';
      }
      return s;
    }
  };

  function readN(num) { var n = parseInt(String(num.textContent).replace(/\D+/g, ''), 10); return isNaN(n) ? null : n; }
  function tilesOf(sec) {
    return MP.$$('.tile', sec).map(function (tile) {
      var num = tile.querySelector('.num');
      return { el: tile, num: num, count: num && (num.querySelector('.cf-count') || num), key: num && num.getAttribute('data-fact'),
        n: num ? +num.getAttribute('data-cf-n') : NaN, viz: tile.querySelector('.tile-viz svg') };
    });
  }
  /* <span class="num">49</span> → <span class="num"><span class="cf-count" aria-hidden="true">49</span><span class="sr-only">49</span></span>
   * (same text, same box: the split never changes the layout) */
  function splitNum(num, n) {
    if (num.querySelector('.cf-count')) return;
    num.textContent = '';
    var count = document.createElement('span'), real = document.createElement('span');
    count.className = 'cf-count';
    count.setAttribute('aria-hidden', 'true');
    count.textContent = String(n);
    real.className = 'sr-only';
    real.textContent = String(n);
    num.appendChild(count);
    num.appendChild(real);
  }

  function build(sec) {
    MP.$$('.tile', sec).forEach(function (tile) {
      var num = tile.querySelector('.num'), box = tile.querySelector('.tile-viz');
      if (!num || num.hasAttribute('data-cf-n')) return;
      var n = readN(num), key = num.getAttribute('data-fact');   // the value MP.applyFacts put there — never hard-coded
      if (n === null) return;
      num.setAttribute('data-cf-n', String(n));
      splitNum(num, n);
      if (box && VIZ[key] && n > 0 && n <= 144) {
        box.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="cf-svg cf-svg--' + key +
          '" focusable="false" aria-hidden="true"><g stroke="' + INK + '" stroke-linejoin="round">' + VIZ[key](n) + '</g></svg>';
      }
    });
  }

  /* time at which a power2.out counter over DUR reaches k (of n) */
  function tAt(k, n) { return DUR * (1 - Math.sqrt(Math.max(0, 1 - k / n))); }

  function tileTimeline(g, t, delay) {
    var tl = g.timeline({ paused: true, delay: delay }), n = t.n;
    if (!(n >= 0)) return tl;
    tl.fromTo(t.count, { innerText: 0 }, { innerText: n, duration: DUR, ease: 'power2.out', snap: { innerText: 1 } }, 0);
    tl.fromTo(t.num, { scale: 1 }, { scale: 1.06, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out' }, DUR - 0.06);
    if (!t.viz) return tl;
    var items = MP.$$('.cf-i', t.viz), nuts = MP.$$('.cf-nut', t.viz), once = t.viz.querySelector('.cf-once');
    /* origins first, while every transform is still identity (see glavnyi.js setPre) */
    items.forEach(function (el) {
      var pv = el.getAttribute('data-pivot');
      if (pv) g.set(el, { svgOrigin: pv });
      else if (t.key === 'specSheets') g.set(el, { svgOrigin: '50 84' });
      else g.set(el, { transformOrigin: '50% 50%' });
    });
    if (nuts.length) g.set(nuts, { transformOrigin: '50% 50%' });
    if (once) g.set(once, { transformOrigin: '50% 50%' });
    items.forEach(function (el, k) {
      var at = tAt(k + 1, Math.max(n, items.length)) - 0.12;
      if (t.key === 'autofix') {
        tl.fromTo(el, { rotation: -75 }, { rotation: 0, duration: 1.1, ease: 'elastic.out(1,.45)' }, 0.1);
        if (nuts.length) tl.fromTo(nuts, { rotation: -60 }, { rotation: 0, duration: 1.1, ease: 'elastic.out(1,.45)' }, 0.1);
        return;
      }
      if (t.key === 'specSheets') {
        tl.fromTo(el, { opacity: 0, scale: 0.2 }, { opacity: 1, scale: 1, duration: 0.32, ease: 'back.out(2.2)' }, Math.max(0, at));
        return;
      }
      var elastic = t.key === 'scripts' || t.key === 'humanYes';
      tl.fromTo(el, { opacity: 0, scale: elastic ? 0.3 : 0 },
        { opacity: 1, scale: 1, duration: elastic ? 0.45 : 0.3, ease: elastic ? 'elastic.out(1,.5)' : 'back.out(3)' }, Math.max(0, at));
    });
    if (once) tl.fromTo(once, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(3)' }, DUR - 0.2);
    return tl;
  }

  function init(sec, api) {
    var g = api.gsap, T = tilesOf(sec);
    if (!T.length) return;
    /* safety net: if the scene is reverted mid-count, put the real numbers back */
    g.context(function () {
      return function () { T.forEach(function (t) { if (t.n >= 0) t.count.textContent = String(t.n); }); };
    });
    var master = g.timeline({ paused: true });
    var els = T.map(function (t) { return t.el; });
    /* opacity, not autoAlpha: a tile that has not popped in yet is invisible but still read by assistive tech */
    master.fromTo(els, { opacity: 0, y: 46, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'back.out(1.6)', stagger: 0.08 }, 0);
    /* each tile's count is its own timeline (so a hover can replay it); the entrance starts them with a stagger */
    var subs = T.map(function (t, i) { return tileTimeline(g, t, 0.18 + i * 0.08); });
    window.ScrollTrigger.create({
      trigger: sec.querySelector('.tiles') || sec, start: 'top 80%', once: true,
      onEnter: function () { master.play(); subs.forEach(function (s) { s.restart(true); }); }
    });

    /* a mouse hover replays that tile's count (after the entrance has finished) */
    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      T.forEach(function (t, i) {
        api.on(t.el, 'pointerenter', function () {
          if (master.progress() < 1 || subs[i].progress() < 1) return;
          subs[i].restart();
        });
      });
    }
  }

  function final(sec) {
    tilesOf(sec).forEach(function (t) { if (t.n >= 0) t.count.textContent = String(t.n); });
  }

  MP.scene('cifry', { build: build, init: init, final: final });
})();
