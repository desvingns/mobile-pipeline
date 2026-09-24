/* scenes/chertyozh.js — «Сначала — подробный чертёж» (package B, sticky 6 steps).
 *
 * Also defines MP.pb — the tiny shared kit of package B (chertyozh / sborka / proverki load after this file):
 *   MP.pb.text(x, y, str, size, o)   SVG <text> (multi-line with '\n'); o = {d: display font, w, fill, anchor, mid, lh, cls}
 *   MP.pb.bubble(o)                  speech bubble whose TAIL TIP sits at (o.x, o.y); tail 'dl'|'dr'|'d'|'l'|'r'.
 *                                    Width is estimated, then MP.pb.fit(root) measures the real text and re-shapes it.
 *   MP.pb.stamp(o)                   rubber-stamp badge (rounded rect, double border) centred at (o.x, o.y), rotated.
 *   MP.pb.mount(api, inner, cls)     inject <svg viewBox="0 0 720 540"> into api.stage (all three stages are 720×540).
 *   MP.pb.frame(svg, api, box)       desktop viewBox 720×540 (4:3) / mobile crop `box` (16:10) — the stage ratio changes <1024px.
 *   MP.pb.drive(api, tl, o)          sticky-step driver: one paused master timeline with a label per step; a step change
 *                                    tweens the playhead to its label (long jumps compressed, rewinds quick); calm mode seeks.
 *                                    Also plays the first step as an intro once the stage is in view, and keeps the step
 *                                    triggers honest (MP.pb.watchLayout / verifySteps → one debounced ScrollTrigger.refresh).
 *                                    Returns {go(label), range(a, b), stop(), tl, last()}.
 *   MP.pb.arc(el, dx, dy, lift, d)   parabolic hop (x linear, y up/down) as a small timeline — reversible, seekable.
 *   MP.pb.slam(tl, el, pos, shake)   stamp hit: scale 2 → .92 (power4.in .18 s) → 1 (elastic) + container shake.
 *   MP.pb.splash(cx, cy, r0, r1, n)  radial DrawSVG splash lines (markup); MP.pb.burst(tl, g, pos) animates them.
 * Every scene builds its FINAL state; init/final build the same master timeline (init animates it, final seeks it).
 */
(function () {
  'use strict';
  var MP = window.MP = window.MP || {};
  var PB = MP.pb = MP.pb || {};

  var INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', LEMON = '#FFDA4F', MINT = '#2BD99F',
    RASP = '#FF4F8B', SKY = '#3EC5FF', TANG = '#FF8A1F', STEEL = '#C9D3E6', STEEL_D = '#8E9BB8';
  PB.col = { ink: INK, cream: CREAM, violet: VIOLET, lemon: LEMON, mint: MINT, raspberry: RASP, sky: SKY,
    tangerine: TANG, steel: STEEL, steelDark: STEEL_D };
  var FT = "'Golos Text', 'Segoe UI', system-ui, sans-serif";
  var FD = "Unbounded, 'Arial Black', system-ui, sans-serif";
  PB.W = 720; PB.H = 540;

  /* ---------- markup helpers (strings) ---------- */
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
  function L(d, color, w, ex) {
    return '<path d="' + d + '" fill="none"' + (color ? ' stroke="' + color + '"' : '') + (w ? ' stroke-width="' + w + '"' : '') + (ex || '') + '/>';
  }
  function G(cls, inner, ex) { return '<g' + (cls ? ' class="' + cls + '"' : '') + (ex || '') + '>' + inner + '</g>'; }
  /* place kit markup (a 120×140 box) with its top-left at x,y; sx < 0 mirrors it */
  function place(markup, x, y, s, sx) {
    return '<g transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + f(sx || s) + ' ' + f(s) + ')">' + markup + '</g>';
  }
  var NS = ' stroke="none"';
  PB.f = f; PB.esc = esc; PB.R = R; PB.C = C; PB.E = E; PB.P = P; PB.L = L; PB.G = G; PB.place = place; PB.NS = NS;
  PB.ROOT = ' stroke="' + INK + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"';

  PB.text = function (x, y, s, size, o) {
    o = o || {};
    var lines = String(s).split('\n'), lh = size * (o.lh || 1.14);
    var y0 = o.mid ? y - (lines.length - 1) * lh / 2 + size * 0.36 : y;
    var out = '<text' + (o.cls ? ' class="' + o.cls + '"' : '') + ' x="' + f(x) + '" y="' + f(y0) + '" font-family="' +
      (o.d ? FD : FT) + '" font-size="' + f(size) + '" font-weight="' + (o.w || (o.d ? 800 : 700)) + '" fill="' +
      (o.fill || INK) + '" stroke="none" text-anchor="' + (o.anchor || 'middle') + '">';
    if (lines.length === 1) out += esc(lines[0]);
    else lines.forEach(function (l, i) { out += '<tspan x="' + f(x) + '" dy="' + (i ? f(lh) : 0) + '">' + esc(l) + '</tspan>'; });
    return out + '</text>';
  };

  /* ---------- speech bubbles ---------- */
  function bubbleBox(tail, tx, ty, w, h) {
    if (tail === 'dl') return { x: tx - 24, y: ty - 14 - h };
    if (tail === 'dr') return { x: tx + 24 - w, y: ty - 14 - h };
    if (tail === 'd') return { x: tx - w / 2, y: ty - 14 - h };
    if (tail === 'l') return { x: tx + 16, y: ty + 2 - h };
    if (tail === 'r') return { x: tx - 16 - w, y: ty + 2 - h };
    return { x: tx - w / 2, y: ty - h / 2 };
  }
  function bubbleD(tail, tx, ty, bx, by, w, h) {
    var r = Math.min(16, h / 2), x1 = bx + w, y1 = by + h;
    var d = 'M' + f(bx + r) + ' ' + f(by) + 'H' + f(x1 - r) + 'Q' + f(x1) + ' ' + f(by) + ' ' + f(x1) + ' ' + f(by + r);
    if (tail === 'r') d += 'V' + f(y1 - 24) + 'L' + f(tx) + ' ' + f(ty) + 'L' + f(x1 - 14) + ' ' + f(y1);
    else d += 'V' + f(y1 - r) + 'Q' + f(x1) + ' ' + f(y1) + ' ' + f(x1 - r) + ' ' + f(y1);
    if (tail === 'dr') d += 'H' + f(x1 - 26) + 'L' + f(tx) + ' ' + f(ty) + 'L' + f(x1 - 50) + ' ' + f(y1);
    if (tail === 'd') d += 'H' + f(tx + 12) + 'L' + f(tx) + ' ' + f(ty) + 'L' + f(tx - 12) + ' ' + f(y1);
    if (tail === 'dl') d += 'H' + f(bx + 50) + 'L' + f(tx) + ' ' + f(ty) + 'L' + f(bx + 26) + ' ' + f(y1);
    if (tail === 'l') d += 'H' + f(bx + 14) + 'L' + f(tx) + ' ' + f(ty) + 'L' + f(bx) + ' ' + f(y1 - 24) + 'V' + f(by + r);
    else d += 'H' + f(bx + r) + 'Q' + f(bx) + ' ' + f(y1) + ' ' + f(bx) + ' ' + f(y1 - r) + 'V' + f(by + r);
    return d + 'Q' + f(bx) + ' ' + f(by) + ' ' + f(bx + r) + ' ' + f(by) + 'Z';
  }
  /* o = {x, y (tail tip), text, tail='dl', size=22, fill=cream, color=ink, cls, d (display font), off (hidden in build)} */
  PB.bubble = function (o) {
    var size = o.size || 22, pad = o.pad || 18, h = Math.round(size * 1.95), tail = o.tail || 'dl';
    var w = String(o.text).length * size * (o.d ? 0.84 : 0.6) + pad * 2;
    var b = bubbleBox(tail, o.x, o.y, w, h);
    return '<g class="pb-bub' + (o.cls ? ' ' + o.cls : '') + '" data-tail="' + tail + '" data-tx="' + f(o.x) + '" data-ty="' + f(o.y) +
      '" data-h="' + h + '" data-pad="' + pad + '"' + (o.off ? ' opacity="0"' : '') + '>' +
      P(bubbleD(tail, o.x, o.y, b.x, b.y, w, h), o.fill || CREAM, ' class="pb-bub-shape" stroke="' + INK + '" stroke-width="3.5" stroke-linejoin="round"') +
      PB.text(b.x + w / 2, b.y + h / 2 + size * 0.36, o.text, size, { fill: o.color || INK, d: o.d, w: o.w || (o.d ? 700 : 800) }) + '</g>';
  };
  /* measure every bubble's text and re-shape it (fonts differ slightly from the estimate) */
  PB.fit = function (root) {
    if (!root || !root.querySelectorAll) return;
    Array.prototype.forEach.call(root.querySelectorAll('.pb-bub'), function (g) {
      var t = g.querySelector('text'), p = g.querySelector('.pb-bub-shape'), tw = 0;
      try { tw = t.getComputedTextLength(); } catch (e) { return; }
      if (!tw) return;
      var tail = g.getAttribute('data-tail'), tx = +g.getAttribute('data-tx'), ty = +g.getAttribute('data-ty');
      var h = +g.getAttribute('data-h'), w = Math.round(tw + 2 * +g.getAttribute('data-pad'));
      var b = bubbleBox(tail, tx, ty, w, h);
      p.setAttribute('d', bubbleD(tail, tx, ty, b.x, b.y, w, h));
      t.setAttribute('x', f(b.x + w / 2));
    });
  };

  /* rubber stamp badge: o = {x, y (centre), text, fill, color, rot=-8, size=22, cls, off} */
  PB.stamp = function (o) {
    var size = o.size || 22, w = String(o.text).length * size * 0.84 + 34, h = size * 2.1, x = -w / 2, y = -h / 2;
    return '<g transform="translate(' + f(o.x) + ' ' + f(o.y) + ') rotate(' + f(o.rot == null ? -8 : o.rot) + ')">' +
      '<g class="pb-stamp' + (o.cls ? ' ' + o.cls : '') + '"' + (o.off ? ' opacity="0"' : '') + '>' +
      R(x, y, w, h, 12, o.fill || MINT, ' stroke="' + INK + '" stroke-width="4"') +
      R(x + 6, y + 6, w - 12, h - 12, 8, 'none', ' stroke="' + INK + '" stroke-width="2" stroke-dasharray="1 5" stroke-linecap="round"') +
      PB.text(0, size * 0.37, o.text, size, { d: true, w: 800, fill: o.color || INK }) + '</g></g>';
  };

  /* radial splash lines (DrawSVG): markup for a group of n short strokes around (cx, cy) */
  PB.splash = function (cx, cy, r0, r1, n, color, cls, rot) {
    var s = '', angs = Array.isArray(n) ? n : null, cnt = angs ? angs.length : n;
    for (var i = 0; i < cnt; i++) {
      var a = (angs ? angs[i] : (rot || -90) + i * 360 / n) * Math.PI / 180;
      s += '<path d="M' + f(cx + r0 * Math.cos(a)) + ' ' + f(cy + r0 * Math.sin(a)) + 'L' + f(cx + r1 * Math.cos(a)) + ' ' +
        f(cy + r1 * Math.sin(a)) + '" fill="none" stroke="' + (color || INK) + '" stroke-width="5" stroke-linecap="round"/>';
    }
    return '<g class="pb-splash' + (cls ? ' ' + cls : '') + '" opacity="0">' + s + '</g>';
  };

  /* ---------- DOM helpers ---------- */
  /* phone = the portrait layout (<760px, stage 4:5): its own 432×540 composition, so labels render ≥16px at 390px */
  PB.mount = function (api, inner, cls, phone) {
    var svg = MP.svg(inner, phone ? PB.PHONE_BOX : '0 0 720 540', 'pb-svg' + (cls ? ' ' + cls : ''));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    api.stage.innerHTML = '';
    api.stage.appendChild(svg);
    api.stage.__pbPhone = !!phone;
    PB.fit(svg);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { PB.fit(svg); });
    return svg;
  };
  PB.frame = function (svg, api, mobileBox, phone) {
    if (svg) svg.setAttribute('viewBox', phone ? PB.PHONE_BOX : api.wide ? '0 0 720 540' : (mobileBox || '0 45 720 450'));
  };

  /* ---------- phones: portrait stages (<760px) get a separate layout ---------- */
  PB.PHONE = '(max-width: 759px)';
  PB.PHONE_BOX = '0 0 432 540';
  PB.isPhone = function () {
    try { return !!(window.matchMedia && window.matchMedia(PB.PHONE).matches); } catch (e) { return false; }
  };
  /* Registers a package-B sticky-step scene. o = {build(section, api, phone), master(section, api, phone) -> paused
   * timeline, first (calm start label), wire(section, api) (once per init)}. The scene's work runs inside a nested
   * gsap.matchMedia on the phone breakpoint: prosto only re-inits at 1024px, so crossing 760px (rotation, resize)
   * reverts the timeline/triggers here, rebuilds the markup for the other layout and runs again. The stage box keeps
   * its CSS aspect ratio, so none of this ever changes the section height. */
  PB.scene = function (id, o) {
    function run(section, api) {
      var gsap = window.gsap;
      function go(phone) {
        if (api.stage.__pbPhone !== phone || !api.stage.querySelector('svg')) o.build(section, api, phone);
        var tl = o.master(section, api, phone);
        section.__pb = PB.drive(api, tl, api.calm ? { first: o.first } : null);
        if (!api.calm) MP.blink(api.stage, api);
      }
      if (!gsap || !gsap.matchMedia) { go(PB.isPhone()); return; }
      gsap.matchMedia().add({ phone: PB.PHONE, big: '(min-width: 760px)' }, function (ctx) { go(!!ctx.conditions.phone); });
    }
    MP.scene(id, {
      build: function (section, api) { o.build(section, api, PB.isPhone()); },
      init: function (section, api) { run(section, api); if (o.wire) o.wire(section, api); },
      final: function (section, api) { run(section, api); if (o.wire) o.wire(section, api); }
    });
  };
  PB.q = function (root) {
    return function (sel) { return root.querySelector(sel); };
  };
  PB.qa = function (root) {
    return function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };
  };

  /* ---------- motion helpers (all return / extend timelines, so the master timeline stays seekable) ---------- */
  PB.arc = function (el, dx, dy, lift, dur, vars) {
    var gsap = window.gsap, a = gsap.timeline(), cy = Math.min(0, dy) - lift;
    a.to(el, { x: dx, duration: dur, ease: 'power1.inOut' }, 0)
      .to(el, { y: cy, duration: dur * 0.45, ease: 'power2.out' }, 0)
      .to(el, { y: dy, duration: dur * 0.55, ease: 'power2.in' }, dur * 0.45);
    if (vars) a.to(el, Object.assign({ duration: dur, ease: 'power1.inOut' }, vars), 0);
    return a;
  };
  /* abs-arc: move from the current spot to (x, y) (GSAP x/y values) over a parabola */
  PB.hop = function (el, x, y, lift, dur, vars) {
    var gsap = window.gsap, a = gsap.timeline();
    a.to(el, { x: x, duration: dur, ease: 'power1.inOut' }, 0)
      .to(el, { y: '-=' + lift, duration: dur * 0.45, ease: 'power2.out' }, 0)
      .to(el, { y: y, duration: dur * 0.55, ease: 'power2.in' }, dur * 0.45);
    if (vars) a.to(el, Object.assign({ duration: dur, ease: 'power1.inOut' }, vars), 0);
    return a;
  };
  PB.pop = function (tl, els, pos, o) {
    o = o || {};
    return tl.to(els, { autoAlpha: 1, scale: 1, duration: o.d || 0.5, ease: o.ease || 'back.out(1.8)', stagger: o.stagger || 0 }, pos);
  };
  PB.out = function (tl, els, pos, o) {
    o = o || {};
    return tl.to(els, { autoAlpha: 0, scale: o.scale == null ? 0.6 : o.scale, y: o.y || 0, x: o.x || 0, duration: o.d || 0.35,
      ease: 'power2.in', stagger: o.stagger || 0 }, pos);
  };
  PB.slam = function (tl, el, pos, shakeEl) {
    tl.set(el, { autoAlpha: 1, scale: 2 }, pos)
      .to(el, { scale: 0.92, duration: 0.18, ease: 'power4.in' }, pos)
      .to(el, { scale: 1, duration: 0.4, ease: 'elastic.out(1,.4)' }, '>');
    if (shakeEl) tl.to(shakeEl, { keyframes: { x: [-6, 5, -3, 0] }, duration: 0.3, ease: 'none' }, '<');
    return tl;
  };
  PB.burst = function (tl, g, pos) {
    var lines = g.querySelectorAll('path');
    tl.set(g, { autoAlpha: 1 }, pos)
      .fromTo(lines, { drawSVG: '0% 0%' }, { drawSVG: '0% 100%', duration: 0.16, ease: 'power2.out', immediateRender: false }, '<')
      .to(lines, { drawSVG: '100% 100%', duration: 0.24, ease: 'power1.in' }, '>')
      .set(g, { autoAlpha: 0 }, '>');
    return tl;
  };
  PB.alive = function (tl) { return !!(tl && tl.parent); };
  /* lamp switch: the colour changes instantly (no colour tween), the lamp pops with an elastic scale */
  PB.lamp = function (tl, els, color, pos) {
    tl.set(els, { fill: color }, pos)
      .to(els, { scale: 1.35, duration: 0.07, ease: 'power2.out', transformOrigin: '50% 50%' }, pos)
      .to(els, { scale: 1, duration: 0.45, ease: 'elastic.out(1,.5)' }, '>');
    return tl;
  };

  /* Lazily built scenes above ours may change their height after our step triggers exist (e.g. a progressive
   * enhancement that collapses a list while another section grows, so the panel height alone can stay the same).
   * ScrollTrigger only re-measures on load/resize, so watch the height of every section once and re-measure
   * (debounced) when any of them really changes. Harmless for everybody else: refresh() is idempotent. */
  PB.watchLayout = function () {
    if (PB._ro || !window.ResizeObserver || !window.ScrollTrigger) return;
    var panel = document.getElementById('panel-prosto') || document.body;
    var scenes = Array.prototype.slice.call(panel.querySelectorAll('.scene'));
    if (!scenes.length) scenes = [panel];
    function sig() { return scenes.map(function (s) { return Math.round(s.offsetHeight); }).join(','); }
    var last = sig(), timer = null;
    PB._ro = new ResizeObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var now = sig();
        if (now === last || !panel.offsetHeight) return;   // hidden tab (display:none) or nothing moved
        last = now;
        PB.refreshSoon();                                   // skipped while suspended: resume() refreshes anyway
      }, 150);
    });
    scenes.forEach(function (s) { PB._ro.observe(s); });
  };
  /* one debounced global re-measure for everybody who asks within ~120 ms */
  PB.refreshSoon = function () {
    if (!window.ScrollTrigger || PB._rfT) return;
    PB._rfT = setTimeout(function () {
      PB._rfT = null;
      if (MP.prosto && MP.prosto.suspended) return;
      window.ScrollTrigger.refresh();
    }, 120);
  };
  /* A trigger created in the same frame as a big programmatic jump (deep link, «jump to» buttons) can be measured
   * against a stale layout/scroll value. Check the first step's trigger against the real DOM a few times after
   * creation and re-measure only when it is actually off. */
  PB.verifySteps = function (stepEls, alive) {
    if (!window.ScrollTrigger || !stepEls.length) return;
    function check() {
      if (!alive()) return;
      var st = null;
      window.ScrollTrigger.getAll().forEach(function (t) { if (t.trigger === stepEls[0]) st = t; });
      if (!st || !stepEls[0].offsetHeight) return;
      var want = stepEls[0].getBoundingClientRect().top + window.pageYOffset - window.innerHeight * 0.62;
      if (Math.abs(st.start - want) > 4) PB.refreshSoon();
    }
    requestAnimationFrame(check);
    setTimeout(check, 450);
    setTimeout(check, 1400);
  };

  /* sticky-step driver */
  PB.drive = function (api, tl, o) {
    o = o || {};
    PB.watchLayout();
    var stepEls = Array.prototype.slice.call(api.section.querySelectorAll('.step[data-step]'));
    /* step labels only (inner labels such as 'defect' are replay anchors, not segment boundaries) */
    var names = stepEls.map(function (el) { return el.getAttribute('data-step'); })
      .filter(function (n) { return tl.labels[n] != null; })
      .sort(function (a, b) { return tl.labels[a] - tl.labels[b]; });
    if (!names.length) names = Object.keys(tl.labels).sort(function (a, b) { return tl.labels[a] - tl.labels[b]; });
    var cur = null, last = null;
    /* start of the segment that ends at t (the previous step label, or 0) — a forward step plays at natural speed */
    function prevTime(t) {
      var p = 0;
      names.forEach(function (n) { var v = tl.labels[n]; if (v < t - 1e-4 && v > p) p = v; });
      return p;
    }
    function stop() { if (cur) { cur.kill(); cur = null; } }
    function go(label, vars) {
      var t = typeof label === 'number' ? label : tl.labels[label];
      if (t == null || !PB.alive(tl)) return null;
      stop();
      last = label;
      if (api.calm) { tl.pause(); tl.seek(t, false); return null; }
      var now = tl.time(), d = Math.abs(t - now), dur;
      if (d < 0.02) { tl.pause(); tl.seek(t, false); return null; }
      if (t > now) { var seg = t - prevTime(t); dur = d <= seg + 0.05 ? d : Math.min(d, seg * 0.55 + 0.9); }
      else dur = Math.min(d, 0.45 + d * 0.1);
      cur = tl.tweenTo(t, Object.assign({ duration: dur, ease: 'none', onComplete: function () { cur = null; } }, vars || {}));
      return cur;
    }
    /* play a sub-range (e.g. a replay button): from label a to label b at natural speed */
    function range(a, b, vars) {
      if (!PB.alive(tl)) return null;
      stop();
      var ta = tl.labels[a], tb = tl.labels[b];
      if (api.calm) { tl.pause(); tl.seek(tb, false); return null; }
      tl.pause(); tl.seek(ta, false);
      cur = tl.tweenTo(tb, Object.assign({ duration: tb - ta, ease: 'none', onComplete: function () { cur = null; } }, vars || {}));
      return cur;
    }
    /* the last step whose top already passed the trigger line (62% of the viewport, as in api.steps) */
    function passed() {
      var p = null;
      stepEls.forEach(function (el) { if (el.getBoundingClientRect().top < window.innerHeight * 0.62) p = el.getAttribute('data-step'); });
      return p;
    }
    /* initial sync: a reload / deep link below some steps starts at the state of the last step already passed */
    var p0 = passed();
    if (p0 && tl.labels[p0] != null) { tl.seek(tl.labels[p0], false); last = p0; }
    else if (api.calm && names.length) tl.seek(tl.labels[o.first || names[0]], false);
    api.steps(function (name, i, el) { go(name); if (o.onStep) o.onStep(name, i, el); });
    PB.verifySteps(stepEls, function () { return PB.alive(tl); });
    /* the stage often comes into view before the first step reaches the trigger line: play the first step's intro as
     * soon as the stage shows up, so the top of the section already shows the first step (never an empty hall) */
    if (!api.calm && window.ScrollTrigger && names.length) {
      window.ScrollTrigger.create({ trigger: api.stage, start: 'top 90%', once: true,
        onEnter: function () { if (!last && tl.time() < 0.01) go(names[0]); } });
    }
    /* Keep the stage honest after every re-measure: a step trigger created against a stale layout (a lazily built scene
     * above grew or shrank) can fire once and then turn off again, leaving the stage on a later step while the reader is
     * still above the list. After a refresh: the last step already passed, or the first step's state if none. */
    function resync() {
      if (!PB.alive(tl)) return;
      var p = passed();
      if (p) { if (p !== last) go(p); }
      else if (last && last !== names[0]) go(names[0]);
    }
    /* a fast jump can skip every step's toggle (e.g. landing below the list): resync when leaving the list */
    var list = stepEls.length && stepEls[0].parentNode;
    if (list && window.ScrollTrigger) {
      window.ScrollTrigger.create({ trigger: list, start: 'top 62%', endTrigger: stepEls[stepEls.length - 1], end: 'bottom 62%',
        onLeave: function () { var p = passed(); if (p && p !== last) go(p); },
        onRefresh: function () { requestAnimationFrame(resync); } });
    }
    return { go: go, range: range, stop: stop, tl: tl, last: function () { return last; } };
  };

  /* =====================================================================================================
   *  chertyozh — the blueprint room (sky blueprint stage, 720×540)
   * ===================================================================================================== */
  var SPEC_SHEETS = (window.MP_FACTS && window.MP_FACTS.specSheets) || 18;

  function arch(cx, r, ys, yb) {
    return 'M' + f(cx - r) + ' ' + f(yb) + 'V' + f(ys) + 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(cx + r) + ' ' + f(ys) + 'V' + f(yb) + 'Z';
  }
  function sheetMarkup(w, h, lines) {
    var s = P('M0 0H' + f(w - 18) + 'L' + f(w) + ' 18V' + f(h) + 'H0Z', CREAM, ' stroke-width="3.5"') +
      P('M' + f(w - 18) + ' 0V18H' + f(w) + 'Z', STEEL, ' stroke-width="3"');
    for (var i = 0; i < (lines || 4); i++) {
      var y = 30 + i * 18, x1 = i === 0 ? w * 0.55 : w - 16 - (i % 2) * 18;
      s += L('M14 ' + f(y) + 'H' + f(x1), SKY, 5, ' stroke-linecap="round"');
    }
    return s;
  }
  var SW = 96, SH = 116;           // blueprint sheet size
  var PILE = { x: 312, y: 318 };   // top sheet of the pile (top-left)

  function iconShots(c, cy) {
    return R(c - 19, cy - 31, 38, 62, 8, CREAM, ' stroke-width="3.5"') + R(c - 12, cy - 22, 24, 38, 3, SKY, ' stroke-width="2.6"') +
      P('M' + f(c - 12) + ' ' + f(cy + 12) + 'L' + f(c - 3) + ' ' + f(cy + 1) + 'L' + f(c + 3) + ' ' + f(cy + 8) + 'L' + f(c + 7) + ' ' + f(cy + 4) + 'L' + f(c + 12) + ' ' + f(cy + 12) + 'Z', MINT, ' stroke-width="2.2"') +
      C(c + 5, cy - 12, 3.6, CREAM, ' stroke-width="2"') + C(c, cy + 24.5, 2.2, INK, NS);
  }
  function iconTalk(c, cy) {
    return P('M' + f(c - 32) + ' ' + f(cy - 26) + 'H' + f(c + 12) + 'Q' + f(c + 18) + ' ' + f(cy - 26) + ' ' + f(c + 18) + ' ' + f(cy - 20) + 'V' + f(cy - 2) +
      'Q' + f(c + 18) + ' ' + f(cy + 4) + ' ' + f(c + 12) + ' ' + f(cy + 4) + 'H' + f(c - 14) + 'L' + f(c - 26) + ' ' + f(cy + 14) + 'V' + f(cy + 4) +
      'Q' + f(c - 38) + ' ' + f(cy + 4) + ' ' + f(c - 38) + ' ' + f(cy - 2) + 'V' + f(cy - 20) + 'Q' + f(c - 38) + ' ' + f(cy - 26) + ' ' + f(c - 32) + ' ' + f(cy - 26) + 'Z', CREAM, ' stroke-width="3.5"') +
      C(c - 20, cy - 11, 3, INK, NS) + C(c - 10, cy - 11, 3, INK, NS) + C(c, cy - 11, 3, INK, NS) +
      P('M' + f(c - 2) + ' ' + f(cy + 8) + 'H' + f(c + 32) + 'Q' + f(c + 38) + ' ' + f(cy + 8) + ' ' + f(c + 38) + ' ' + f(cy + 14) + 'V' + f(cy + 26) +
        'Q' + f(c + 38) + ' ' + f(cy + 32) + ' ' + f(c + 32) + ' ' + f(cy + 32) + 'H' + f(c + 26) + 'V' + f(cy + 40) + 'L' + f(c + 16) + ' ' + f(cy + 32) + 'H' + f(c - 2) +
        'Q' + f(c - 8) + ' ' + f(cy + 32) + ' ' + f(c - 8) + ' ' + f(cy + 26) + 'V' + f(cy + 14) + 'Q' + f(c - 8) + ' ' + f(cy + 8) + ' ' + f(c - 2) + ' ' + f(cy + 8) + 'Z', MINT, ' stroke-width="3.5"');
  }
  function iconBox(c, cy) {
    return R(c - 26, cy - 8, 52, 38, 4, CREAM, ' stroke-width="3.5"') + P('M' + f(c - 30) + ' ' + f(cy - 8) + 'L' + f(c - 24) + ' ' + f(cy - 22) + 'H' + f(c + 24) + 'L' + f(c + 30) + ' ' + f(cy - 8) + 'Z', STEEL, ' stroke-width="3.5"') +
      L('M' + f(c) + ' ' + f(cy - 8) + 'V' + f(cy + 30), TANG, 5) +
      C(c + 24, cy - 26, 11, RASP, ' stroke-width="3"') + L('M' + f(c + 24) + ' ' + f(cy - 32) + 'V' + f(cy - 20) + 'M' + f(c + 18) + ' ' + f(cy - 26) + 'H' + f(c + 30), INK, 3);
  }

  function markupDoors() {
    var D = [
      { c: 150, fill: TANG, label: 'Снимки\nэкрана', icon: iconShots },
      { c: 360, fill: VIOLET, label: 'Беседа', icon: iconTalk, open: true },
      { c: 570, fill: MINT, label: 'Готовый\nпроект', icon: iconBox }
    ];
    var s = '';
    D.forEach(function (d, i) {
      var c = d.c;
      s += '<g class="ch-door ch-door--' + i + '" opacity="0">';
      s += R(c - 98, 466, 196, 12, 6, STEEL, ' stroke-width="3.5"');
      s += P(arch(c, 86, 318, 468), d.open ? CREAM : INK, ' class="ch-hole" stroke-width="4"');
      if (d.open) {
        s += G('ch-glow', L('M' + f(c - 60) + ' 300L' + f(c - 30) + ' 330M' + f(c + 60) + ' 300L' + f(c + 30) + ' 330M' + f(c) + ' 262V300', TANG, 5, ' stroke-linecap="round" stroke-opacity=".7"'));
        s += '<g class="ch-brig1">' + place(MP.char('brigadir', { expr: 'happy' }), c - 60, 330, 1) + '</g>';
        s += PB.bubble({ x: c, y: 344, text: 'Заходите!', tail: 'd', cls: 'ch-bub-in' });
      }
      s += '<g class="ch-leaf">' + P(arch(c, 73, 318, 466), d.fill, ' stroke-width="4"') +
        L('M' + f(c - 56) + ' 440V322Q' + f(c - 54) + ' 280 ' + f(c - 26) + ' 262', CREAM, 5, ' stroke-linecap="round" stroke-opacity=".55"') +
        d.icon(c, 352) + C(c + 52, 408, 7, CREAM, ' stroke-width="3"') +
        P(arch(c, 73, 318, 466), INK, ' class="ch-shade" opacity="0" stroke="none"') + '</g>';
      s += '<g class="ch-plate">' + R(c - 84, 138, 168, 76, 16, CREAM, ' stroke-width="4"') + PB.text(c, 176, d.label, 24, { mid: true, w: 800 }) + '</g>';
      if (d.open) s += PB.stamp({ x: c, y: 124, text: 'с нуля', fill: MINT, rot: -6, cls: 'ch-zero', size: 20 });
      s += '</g>';
    });
    return G('ch-l1', s);
  }

  var CHAT = [
    { q: 'Какие у вас цветы?', a: 'Фиалка и фикус' },
    { q: 'Во сколько напоминать?', a: 'В девять утра' },
    { q: 'Нужны фото?', a: 'Да, пригодятся' }
  ];
  var ARC = { cx: 124, cy: 290, r: 86 };
  function arcD(cx, cy, r, a0, a1) {
    var t0 = a0 * Math.PI / 180, t1 = a1 * Math.PI / 180;
    return 'M' + f(cx + r * Math.cos(t0)) + ' ' + f(cy + r * Math.sin(t0)) + 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' +
      f(cx + r * Math.cos(t1)) + ' ' + f(cy + r * Math.sin(t1));
  }
  function markupQuestions() {
    var s = '', i;
    var arcs = '';
    for (i = 0; i < 5; i++) {
      var a0 = 180 + i * 36 + 3, a1 = a0 + 30;
      arcs += L(arcD(ARC.cx, ARC.cy, ARC.r, a0, a1), INK, 30, ' stroke-linecap="round"') +
        L(arcD(ARC.cx, ARC.cy, ARC.r, a0, a1), CREAM, 20, ' stroke-linecap="round"') +
        L(arcD(ARC.cx, ARC.cy, ARC.r, a0, a1), MINT, 20, ' class="ch-seg" stroke-linecap="round"');
    }
    s += '<g class="ch-arc" opacity="0">' + arcs + PB.text(ARC.cx, ARC.cy - 12, '5 заходов', 22, { w: 800 }) + '</g>';
    s += '<g class="ch-brig2" opacity="0">' + place(MP.char('brigadir', { expr: 'happy' }), 40, 280, 1.4) + '</g>';
    var y = 132;
    CHAT.forEach(function (c, k) {
      s += PB.bubble({ x: 262, y: y, text: c.q, tail: 'l', fill: VIOLET, color: CREAM, cls: 'ch-q ch-q' + k, off: true });
      s += PB.bubble({ x: 704, y: y + 58, text: c.a, tail: 'r', cls: 'ch-a ch-a' + k, off: true });
      y += 124;
    });
    return G('ch-l2', s);
  }

  var ADV = ['speed', 'glasses', 'lock', 'abacus', 'umbrella'];
  var ADV_X = [88, 224, 360, 496, 632];
  function pileSlots() {  // 9 sheets: bottom → top
    var out = [], rnd = MP.seeded ? MP.seeded(77) : Math.random;
    for (var i = 0; i < 9; i++) out.push({ x: PILE.x + (rnd() - 0.5) * 10, y: PILE.y + (8 - i) * 4, r: (rnd() - 0.5) * 8 });
    return out;
  }
  var PILE_SLOTS = pileSlots();
  function markupScribes() {
    var s = '';
    s += '<g class="ch-adv-label" opacity="0">' + L('M88 108V98H632V108M224 98V108M360 98V108M496 98V108', CREAM, 4, ' stroke-linecap="round" stroke-linejoin="round"') +
      R(222, 44, 276, 44, 22, VIOLET, ' stroke-width="4"') + PB.text(360, 74, 'одновременно', 22, { d: true, fill: CREAM }) + '</g>';
    ADV.forEach(function (v, i) {
      var cx = ADV_X[i];
      // data protection (lock) and analytics (abacus) are called only when the app needs them
      var optional = v === 'lock' || v === 'abacus';
      s += '<g class="ch-adv ch-adv' + i + (optional ? ' ch-adv--opt' : '') + '" opacity="0">' +
        C(cx, 176, 60, 'none', ' stroke="' + CREAM + '" stroke-opacity=".45" stroke-width="10"' + (optional ? ' stroke-dasharray="12 10"' : '')) +
        '<path class="ch-ring" d="M' + cx + ' 116A60 60 0 1 1 ' + (cx - 0.01) + ' 116" fill="none" stroke="' + MINT + '" stroke-width="10" stroke-linecap="round"/>' +
        place(MP.char('sovetnik', { variant: v, expr: 'happy' }), cx - 69, 67, 1.15) +
        (optional ? R(cx - 62, 246, 124, 32, 16, CREAM, ' stroke="' + INK + '" stroke-width="3"') + PB.text(cx, 268, 'если нужно', 17, {}) : '') +
        '</g>';
    });
    s += '<g class="ch-pis ch-pisL" opacity="0">' + place(MP.char('pisar', { expr: 'happy' }), 26, 302, 1.2) + '</g>';
    s += '<g class="ch-pis ch-pisR" opacity="0">' + place(MP.char('pisar', { expr: 'happy' }), 694, 302, 1.2, -1.2) + '</g>';
    var pile = '';
    PILE_SLOTS.forEach(function (p, i) {
      pile += '<g transform="translate(' + f(p.x) + ' ' + f(p.y) + ') rotate(' + f(p.r) + ' 48 58)"><g class="ch-sheet ch-sheet' + i + '">' + sheetMarkup(SW, SH, 4) + '</g></g>';
    });
    s += '<g class="ch-pile" opacity="0">' + pile + '</g>';
    return G('ch-l3', s);
  }

  function markupCritic() {
    var s = '';
    s += '<g class="ch-crit" opacity="0">' + R(292, 240, 136, 34, 10, TANG, ' stroke-width="4"') + L('M300 262H420', INK, 3, ' stroke-opacity=".25"') +
      place(MP.char('pridira'), 300, 108, 1) + '</g>';
    s += '<g class="ch-lamp" opacity="0">' + R(596, 170, 9, 84, 3, STEEL_D, ' stroke-width="3"') + R(582, 250, 37, 10, 5, INK, NS) +
      C(600, 160, 30, RASP, ' class="ch-lamp-halo" opacity="0" stroke="none"') +
      C(600, 160, 17, STEEL_D, ' class="ch-lamp-bulb" stroke-width="3.5"') + C(595, 155, 4.5, '#FFFFFF', NS + ' opacity=".8"') + '</g>';
    s += PB.bubble({ x: 396, y: 146, text: 'Переделать!', tail: 'dl', cls: 'ch-bub-crit', off: true });
    /* return counter: «не больше двух раз» — two slots, the first one fills */
    s += '<g class="ch-count" opacity="0">' + R(506, 268, 188, 52, 16, CREAM, ' stroke-width="3.5"') + PB.text(522, 302, 'возврат', 20, { anchor: 'start', w: 800 }) +
      '<circle class="ch-slot ch-slot1" cx="636" cy="294" r="12" fill="' + RASP + '" stroke-width="3.5"/>' +
      '<circle class="ch-slot" cx="670" cy="294" r="12" fill="none" stroke-width="3.5" stroke-dasharray="5 5"/>' + '</g>';
    /* the returned sheet (final: back on the pile, fixed and stamped) */
    var top = PILE_SLOTS[8];
    s += '<g transform="translate(' + f(top.x) + ' ' + f(top.y - 6) + ')"><g class="ch-bsheet" opacity="0">' + sheetMarkup(SW, SH, 4) +
      '<g class="ch-marks" opacity="0">' + L('M18 40q10-10 20 0t20 0t20 0M18 76q10-10 20 0t20 0', RASP, 5, ' stroke-linecap="round"') + '</g>' +
      L('M30 66l14 14 26-30', MINT, 9, ' class="ch-fix" stroke-linecap="round" stroke-linejoin="round"') + '</g></g>';
    s += PB.stamp({ x: top.x + 50, y: top.y + 70, text: 'Годится', fill: MINT, rot: -12, cls: 'ch-ok', off: true });
    s += PB.splash(top.x + 50, top.y + 70, 100, 130, [-165, -140, -40, -15, 15, 40, 140, 165], INK, 'ch-sp1');
    return G('ch-l4', s);
  }

  function stripes(x, y, w, h) {
    var s = '';
    for (var k = x + 14; k < x + w - 10; k += 30) s += P('M' + f(k) + ' ' + f(y + 3) + 'h12l-10 ' + f(h - 6) + 'h-12z', INK, NS);
    return s;
  }
  /* boom barrier: control box with the lamp at the foot of the post, arm pivoting at the post top */
  var BAR = { l: { px: 69, dir: 1 }, r: { px: 651, dir: -1 } };
  function barrier(side) {
    var b = BAR[side], px = b.px, x0 = b.dir > 0 ? px : px - 284, sx = px + b.dir * 142;
    return '<g class="ch-bar ch-bar-' + side + '" opacity="0">' +
      R(px - 11, 318, 22, 150, 6, STEEL, ' stroke-width="3.5"') +
      R(px - 30, 404, 60, 66, 10, STEEL, ' stroke-width="3.5"') + R(px - 36, 462, 72, 12, 6, INK, NS) +
      C(px, 431, 26, LEMON, ' class="ch-bar-halo" opacity=".35" stroke="none"') +
      C(px, 431, 15, LEMON, ' class="ch-bar-lamp" stroke-width="3.5"') + C(px - 4.5, 426.5, 4, '#FFFFFF', NS + ' opacity=".8"') +
      '<g class="ch-arm ch-arm-' + side + '">' + R(x0, 306, 284, 24, 12, LEMON, ' stroke-width="4"') + stripes(x0 + (b.dir > 0 ? 22 : 8), 306, 254, 24) +
      R(x0, 306, 284, 24, 12, 'none', ' stroke-width="4"') +
      place('<g class="ch-da-wrap">' + MP.seal({ text: 'ДА', rotate: b.dir > 0 ? -12 : 10 }) + '</g>', sx - 52.5, 265.5, 1.05) + '</g>' +
      C(px, 318, 13, STEEL_D, ' stroke-width="3.5"') + C(px, 318, 4, INK, NS) +
      '</g>';
  }
  function markupYes() {
    var s = '';
    /* rolled blueprint */
    var roll = '<g transform="translate(0 -20)">' + R(232, 152, 256, 86, 12, CREAM, ' stroke-width="4"');
    for (var gx = 262; gx < 480; gx += 28) roll += L('M' + gx + ' 158V232', SKY, 2.5, ' stroke-opacity=".7"');
    roll += L('M240 182H482M240 208H482', SKY, 2.5, ' stroke-opacity=".7"') +
      E(488, 195, 20, 43, CREAM, ' stroke-width="4"') + L('M488 195m-9 0a9 12 0 1 0 18 0a14 20 0 1 0 -28 0', INK, 3) +
      R(346, 150, 28, 90, 4, VIOLET, ' stroke-width="4"') + L('M360 240V258', INK, 3) +
      L('M246 166Q300 160 330 162', '#FFFFFF', 5, ' stroke-linecap="round" stroke-opacity=".8"') +
      R(262, 254, 196, 44, 14, TANG, ' stroke-width="4"') + PB.text(360, 284, SPEC_SHEETS + ' листов', 22, { d: true }) + '</g>';
    s += '<g class="ch-roll" opacity="0">' + roll + '</g>';
    s += barrier('l') + barrier('r');
    s += '<g class="ch-plates" opacity="0">' +
      R(110, 418, 252, 46, 14, CREAM, ' stroke-width="3.5"') + C(134, 441, 15, INK, NS) + PB.text(134, 449, '1', 20, { d: true, fill: CREAM }) +
      PB.text(158, 449, 'список экранов', 22, { anchor: 'start', w: 800 }) +
      R(398, 418, 212, 46, 14, CREAM, ' stroke-width="3.5"') + C(422, 441, 15, INK, NS) + PB.text(422, 449, '2', 20, { d: true, fill: CREAM }) +
      PB.text(446, 449, 'весь чертёж', 22, { anchor: 'start', w: 800 }) + '</g>';
    s += PB.splash(211, 318, 68, 96, 8, INK, 'ch-sp2') + PB.splash(509, 318, 68, 96, 8, INK, 'ch-sp3');
    s += '<g class="ch-hand" opacity="0">' + place(MP.stampHand(), 133, 172, 1.3) + '</g>';
    return G('ch-l5', s);
  }

  var BOARD = { x: 144, y: 54, w: 568, h: 262 };
  var COLS = [{ x: 156, name: 'Ждут', fill: STEEL }, { x: 341, name: 'В работе', fill: TANG }, { x: 526, name: 'Готово', fill: MINT }];
  var CARDS = [  // column, row, text, strip order
    { c: 1, r: 0, t: 'Напоминание\nо поливе', k: 2, hot: true },
    { c: 0, r: 0, t: 'Календарь\nполива', k: 3 },
    { c: 0, r: 1, t: 'Фото\nцветка', k: 4 },
    { c: 2, r: 0, t: 'Список\nцветов', k: 0 },
    { c: 2, r: 1, t: 'Добавить\nцветок', k: 1 }
  ];
  var CW = 162, CH = 76;
  function cardPos(c) { return { x: COLS[c.c].x + 6, y: 120 + c.r * 88 }; }
  var STRIP = { x: 182, y: 392, seg: 100 };   // 5 segments; card scale in the strip = STRIP.seg / CW
  var PLAN_OK = { x: 432, y: 328 };            // centre of the «План одобрен» imprint
  function markupBoard() {
    var s = '';
    s += '<g class="ch-board">' + R(BOARD.x + 7, BOARD.y + 7, BOARD.w, BOARD.h, 24, INK, NS) + R(BOARD.x, BOARD.y, BOARD.w, BOARD.h, 24, CREAM, ' stroke-width="4"');
    COLS.forEach(function (c) {
      s += R(c.x, 110, 174, 196, 14, INK, NS + ' fill-opacity=".06"') + R(c.x, 66, 174, 38, 12, c.fill, ' stroke-width="3.5"') +
        PB.text(c.x + 87, 93, c.name, 22, { w: 800 });
    });
    s += '</g>';
    var cards = '';
    CARDS.forEach(function (c, i) {
      var p = cardPos(c);
      cards += '<g transform="translate(' + p.x + ' ' + p.y + ')">' +
        (c.hot ? R(-9, -9, CW + 18, CH + 18, 20, MINT, ' class="ch-glow-ring" stroke-width="4"') : '') +
        '<g class="ch-card ch-card' + i + '">' + R(0, 0, CW, CH, 12, CREAM, ' stroke-width="3.5"') + C(CW / 2, 2, 6, RASP, ' stroke-width="3"') +
        PB.text(CW / 2, CH / 2 + 2, c.t, 21, { mid: true, w: 800, lh: 1.08 }) + '</g></g>';
    });
    s += '<g class="ch-cards">' + cards + '</g>';
    s += '<g class="ch-plan">' + place(MP.char('planirovshchik', { expr: 'focus' }), 0, 296, 1.3) + '</g>';
    s += PB.bubble({ x: 112, y: 306, text: 'Режу на карточки', tail: 'dl', cls: 'ch-bub-plan', off: true });
    var cuts = '';
    for (var k = 1; k < 5; k++) {
      var cx = STRIP.x + k * STRIP.seg;
      cuts += '<g class="ch-cut ch-cut' + k + '" opacity="0">' + L('M' + cx + ' ' + (STRIP.y - 8) + 'V' + (STRIP.y + 56), INK, 3, ' stroke-dasharray="7 7"') + '</g>';
    }
    s += cuts;
    /* scissors: blades pivot at (0,0) */
    s += '<g transform="translate(' + (STRIP.x + STRIP.seg) + ' ' + (STRIP.y - 2) + ')"><g class="ch-scis" opacity="0">' +
      '<g class="ch-blade-a">' + L('M3 -4L9 -13', INK, 5) + C(11, -22, 11, RASP, ' stroke-width="3.5"') + P('M0 0L-9 46Q-5 51 -1 47L6 4Z', STEEL, ' stroke-width="3.5"') + '</g>' +
      '<g class="ch-blade-b">' + L('M-3 -4L-9 -13', INK, 5) + C(-11, -22, 11, RASP, ' stroke-width="3.5"') + P('M0 0L9 46Q5 51 1 47L-6 4Z', STEEL, ' stroke-width="3.5"') + '</g>' +
      C(0, 0, 3.5, INK, NS) + '</g></g>';
    /* your third «да»: the lemon hand stamps the plan right onto the board's edge */
    s += PB.stamp({ x: PLAN_OK.x, y: PLAN_OK.y, text: 'План одобрен', fill: LEMON, rot: -6, cls: 'ch-planok' });
    s += PB.splash(PLAN_OK.x, PLAN_OK.y, 140, 172, [-170, -155, 155, 170, -25, -10, 10, 25], INK, 'ch-sp4');
    s += '<g class="ch-hand2" opacity="0">' + place(MP.stampHand(), PLAN_OK.x - 78, PLAN_OK.y - 156, 1.3) + '</g>';
    return G('ch-l6', s);
  }

  function build(section, api) {
    var deco = '<g class="ch-deco" opacity=".75">' +
      L('M22 36V22H36M684 22H698V36M22 504V518H36M684 518H698V504', CREAM, 3, ' stroke-linecap="round"') +
      L('M30 478H690', CREAM, 3, ' stroke-dasharray="2 10" stroke-linecap="round"') + '</g>';
    var inner = '<g' + PB.ROOT + '>' + deco + '<g class="ch-world">' + markupDoors() + markupQuestions() + markupScribes() +
      markupCritic() + markupYes() + markupBoard() + '</g></g>';
    PB.mount(api, inner, 'ch-svg');
  }

  /* the master timeline (shared by init and final) */
  function master(section, api) {
    var gsap = window.gsap, svg = api.stage.querySelector('svg');
    var $ = PB.q(svg), $$ = PB.qa(svg);
    PB.frame(svg, api, '0 45 720 450');
    var tl = gsap.timeline({ paused: true });
    var world = $('.ch-world');

    /* ----- start states (everything hidden; the board is the built end state) ----- */
    var doors = $$('.ch-door'), leaf = $('.ch-door--1 .ch-leaf'), shade = $('.ch-door--1 .ch-shade');
    gsap.set(doors, { autoAlpha: 0, y: 40, transformOrigin: '50% 100%' });
    gsap.set($('.ch-l1'), { svgOrigin: '360 380' });
    gsap.set(leaf, { transformOrigin: '0% 50%' });
    gsap.set($('.ch-brig1'), { autoAlpha: 0, y: 30 });
    gsap.set($('.ch-bub-in'), { autoAlpha: 0, scale: 0, svgOrigin: '360 344' });
    gsap.set($('.ch-zero'), { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' });
    gsap.set($('.ch-glow'), { autoAlpha: 0 });

    var q = $$('.ch-q'), a = $$('.ch-a'), segs = $$('.ch-seg');
    q.forEach(function (b) { gsap.set(b, { autoAlpha: 0, scale: 0, svgOrigin: b.getAttribute('data-tx') + ' ' + b.getAttribute('data-ty') }); });
    a.forEach(function (b) { gsap.set(b, { autoAlpha: 0, scale: 0, svgOrigin: b.getAttribute('data-tx') + ' ' + b.getAttribute('data-ty') }); });
    gsap.set(segs, { drawSVG: '0%' });
    gsap.set([$('.ch-arc'), $('.ch-brig2')], { autoAlpha: 0, x: -60 });

    var advs = $$('.ch-adv'), rings = $$('.ch-ring'), pis = $$('.ch-pis'), sheets = $$('.ch-sheet');
    gsap.set(advs, { autoAlpha: 0, scale: 0, transformOrigin: '50% 60%' });
    gsap.set(rings, { drawSVG: '0%' });
    gsap.set($('.ch-adv-label'), { autoAlpha: 0, y: -20 });
    gsap.set(pis, { autoAlpha: 0, y: 60 });
    gsap.set($('.ch-pile'), { autoAlpha: 1 });
    gsap.set(sheets, { autoAlpha: 0 });

    var crit = $('.ch-crit'), lamp = $('.ch-lamp'), bulb = $('.ch-lamp-bulb'), halo = $('.ch-lamp-halo');
    var bs = $('.ch-bsheet'), marks = $('.ch-marks'), fix = $('.ch-fix'), ok = $('.ch-ok');
    gsap.set(crit, { autoAlpha: 0, y: -40 });
    gsap.set(lamp, { autoAlpha: 0, scale: 0, transformOrigin: '50% 100%' });
    gsap.set($('.ch-bub-crit'), { autoAlpha: 0, scale: 0, svgOrigin: '334 160' });
    gsap.set(bs, { autoAlpha: 0, transformOrigin: '50% 50%' });
    gsap.set(marks, { autoAlpha: 0 });
    gsap.set(fix, { drawSVG: '0%' });
    gsap.set($('.ch-count'), { autoAlpha: 0, y: 16 });
    gsap.set($('.ch-slot1'), { scale: 0, transformOrigin: '50% 50%' });
    gsap.set(ok, { autoAlpha: 0, transformOrigin: '50% 50%' });

    var roll = $('.ch-roll'), bars = $$('.ch-bar'), armL = $('.ch-arm-l'), armR = $('.ch-arm-r'), hand = $('.ch-hand');
    var das = $$('.ch-da-wrap'), plates = $('.ch-plates'), lampsY = $$('.ch-bar-lamp'), halosY = $$('.ch-bar-halo');
    gsap.set(roll, { autoAlpha: 0, scale: 0.2, transformOrigin: '50% 50%' });
    gsap.set(bars, { autoAlpha: 0, y: 40 });
    gsap.set(armL, { svgOrigin: '69 318' });
    gsap.set(armR, { svgOrigin: '651 318' });
    gsap.set(das, { autoAlpha: 0, transformOrigin: '50% 50%' });
    gsap.set(plates, { autoAlpha: 0, y: 30 });
    gsap.set(hand, { autoAlpha: 0, y: -430 });

    var board = $('.ch-board'), cards = $$('.ch-card'), ring = $('.ch-glow-ring'), plan = $('.ch-plan');
    var cuts = $$('.ch-cut'), scis = $('.ch-scis'), bladeA = $('.ch-blade-a'), bladeB = $('.ch-blade-b'), planok = $('.ch-planok');
    gsap.set(board, { autoAlpha: 0, scale: 0.9, transformOrigin: '50% 50%' });
    gsap.set(ring, { autoAlpha: 0, transformOrigin: '50% 50%' });
    gsap.set(plan, { autoAlpha: 0, x: -80 });
    gsap.set($('.ch-bub-plan'), { autoAlpha: 0, scale: 0, svgOrigin: '112 306' });
    gsap.set(cuts, { autoAlpha: 0 });
    gsap.set(scis, { autoAlpha: 0, scale: 0.4, transformOrigin: '50% 50%' });
    gsap.set([bladeA, bladeB], { svgOrigin: '0 0' });
    gsap.set(planok, { autoAlpha: 0, transformOrigin: '50% 50%' });
    var hand2 = $('.ch-hand2');
    gsap.set(hand2, { autoAlpha: 0, y: -520, transformOrigin: '50% 100%' });
    /* FLIP: cards are built in their board slots (last); invert them into the roll's strip (first) */
    var S = STRIP.seg / CW;
    cards.forEach(function (el, i) {
      var c = CARDS[i], p = cardPos(c);
      el.__strip = { x: STRIP.x + c.k * STRIP.seg - p.x, y: STRIP.y - p.y, s: S };
      el.__roll = { x: 360 - CW * S / 2 - p.x, y: 175 - CH * S / 2 - p.y };
      gsap.set(el, { autoAlpha: 0, x: el.__roll.x, y: el.__roll.y, scale: 0.2, rotation: 0, transformOrigin: '0% 0%' });
    });
    gsap.set($$('.pb-splash'), { autoAlpha: 0 });

    /* ----- intro → doors ----- */
    tl.to(doors, { autoAlpha: 1, y: 0, duration: 0.55, ease: 'back.out(1.8)', stagger: 0.09 }, 0.1)
      .to(leaf, { scaleX: -0.24, duration: 0.7, ease: 'power2.inOut' }, 0.85)
      .to(shade, { opacity: 0.45, duration: 0.35, ease: 'power1.in' }, '<0.2')
      .to($('.ch-glow'), { autoAlpha: 1, duration: 0.3 }, '<0.3')
      .to($('.ch-brig1'), { autoAlpha: 1, y: 0, duration: 0.45, ease: 'back.out(2)' }, '<0.1')
      .to($('.ch-zero'), { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(2.2)' }, '<0.1')
      .to($('.ch-bub-in'), { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, '<0.15')
      .addLabel('doors', '+=0.15');

    /* ----- questions: walk through the door into the talk ----- */
    tl.to($('.ch-bub-in'), { autoAlpha: 0, scale: 0, duration: 0.2 }, 'doors')
      .to($('.ch-l1'), { scale: 2.4, autoAlpha: 0, duration: 0.6, ease: 'power2.in' }, 'doors+=0.1')
      .to([$('.ch-arc'), $('.ch-brig2')], { autoAlpha: 1, x: 0, duration: 0.5, ease: 'back.out(1.6)', stagger: 0.08 }, 'doors+=0.55');
    var t = 1.15;
    CHAT.forEach(function (c, k) {
      tl.to(q[k], { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 'doors+=' + t)
        .to(a[k], { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 'doors+=' + (t + 0.55))
        .to(segs[k], { drawSVG: '100%', duration: 0.35, ease: 'power2.out' }, 'doors+=' + (t + 0.75));
      t += 0.95;
    });
    tl.to(segs[3], { drawSVG: '100%', duration: 0.3, ease: 'power2.out' }, 'doors+=' + t)
      .to(segs[4], { drawSVG: '100%', duration: 0.3, ease: 'power2.out' }, 'doors+=' + (t + 0.2))
      .to($('.ch-arc'), { scale: 1.06, duration: 0.15, yoyo: true, repeat: 1, transformOrigin: '50% 100%' }, 'doors+=' + (t + 0.5))
      .addLabel('questions', 'doors+=' + (t + 0.85));

    /* ----- scribes + advisors ----- */
    var bubbles = q.concat(a);
    tl.to(bubbles, { autoAlpha: 0, scale: 0.3, x: function (i, el) { return 360 - +el.getAttribute('data-tx'); },
      y: function (i, el) { return 380 - +el.getAttribute('data-ty'); }, duration: 0.45, ease: 'power2.in', stagger: 0.03 }, 'questions')
      .to([$('.ch-arc'), $('.ch-brig2')], { autoAlpha: 0, x: -80, duration: 0.4, ease: 'power2.in' }, 'questions')
      .to(pis, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'back.out(1.8)', stagger: 0.1 }, 'questions+=0.45');
    var from = [{ x: 150, y: 400 }, { x: 570, y: 400 }];
    for (var i = 0; i < 4; i++) {
      var sp = PILE_SLOTS[i], src = from[i % 2], el = sheets[i];
      gsap.set(el, { x: src.x - sp.x - SW / 2, y: src.y - sp.y - SH / 2, scale: 0.4, rotation: i % 2 ? 40 : -40, transformOrigin: '50% 50%' });
      tl.set(el, { autoAlpha: 1 }, 'questions+=' + (0.95 + i * 0.28))
        .add(PB.arc(el, 0, 0, 120, 0.6, { scale: 1, rotation: 0 }), '<');
    }
    tl.to(advs, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, 'questions+=2.4')
      .to($('.ch-adv-label'), { autoAlpha: 1, y: 0, duration: 0.45, ease: 'back.out(2)' }, '<0.15')
      .to(rings, { drawSVG: '100%', duration: 1.0, ease: 'power1.inOut' }, 'questions+=2.75');
    for (i = 4; i < 9; i++) {
      sp = PILE_SLOTS[i]; el = sheets[i];
      var ax = ADV_X[i - 4];
      gsap.set(el, { x: ax - sp.x - SW / 2, y: 176 - sp.y - SH / 2, scale: 0.3, rotation: (i - 6) * 12, transformOrigin: '50% 50%' });
      tl.set(el, { autoAlpha: 1 }, 'questions+=3.8')
        .add(PB.arc(el, 0, 0, 40, 0.6, { scale: 1, rotation: 0 }), '<');
    }
    tl.addLabel('scribes', 'questions+=4.6');

    /* ----- critic ----- */
    tl.to(advs, { autoAlpha: 0, scale: 0, duration: 0.3, ease: 'power2.in', stagger: 0.04 }, 'scribes')
      .to($('.ch-adv-label'), { autoAlpha: 0, y: -20, duration: 0.3 }, 'scribes')
      .to(crit, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'back.out(1.8)' }, 'scribes+=0.35')
      .to(lamp, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, '<0.1')
      .set(bs, { autoAlpha: 1 }, 'scribes+=0.8')
      .add(PB.hop(bs, 124, -104, 40, 0.5, { rotation: 8 }), 'scribes+=0.8')
      .to($('.ch-crit .c-arm-r'), { rotation: 18, duration: 0.1, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 'scribes+=1.3')
      .to(marks, { autoAlpha: 1, duration: 0.2 }, 'scribes+=1.35')
      .to(halo, { opacity: 0.4, duration: 0.2 }, '<');
    PB.lamp(tl, bulb, RASP, 'scribes+=1.35');
    tl.to($('.ch-bub-crit'), { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, '<0.05')
      .add(PB.hop(bs, -210, 34, 90, 0.8, { rotation: -352 }), 'scribes+=2.0')
      .to($('.ch-count'), { autoAlpha: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, 'scribes+=1.9')
      .to($('.ch-slot1'), { scale: 1, duration: 0.45, ease: 'elastic.out(1,.5)' }, 'scribes+=2.2')
      .to($('.ch-bub-crit'), { autoAlpha: 0, scale: 0, duration: 0.2 }, '<0.3');
    var pisArmR = $('.ch-pisL .c-arm-r');
    tl.to(pisArmR, { rotation: -25, duration: 0.12, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 'scribes+=2.85')
      .to(marks, { autoAlpha: 0, duration: 0.3 }, 'scribes+=2.9')
      .to(fix, { drawSVG: '100%', duration: 0.35, ease: 'power2.out' }, 'scribes+=3.1')
      .add(PB.hop(bs, 0, 0, 120, 0.7, { rotation: 0 }), 'scribes+=3.45');
    PB.slam(tl, ok, 'scribes+=4.1', world);
    PB.burst(tl, $('.ch-sp1'), 'scribes+=4.28');
    PB.lamp(tl, bulb, MINT, 'scribes+=4.28');
    tl.set(halo, { fill: MINT }, 'scribes+=4.28')
      .addLabel('critic', 'scribes+=4.9');

    /* ----- your two «да» ----- */
    var pileAll = sheets.concat([bs]);
    tl.to([crit, lamp, $('.ch-count')], { autoAlpha: 0, y: -30, duration: 0.35, ease: 'power2.in' }, 'critic')
      .to(pis, { autoAlpha: 0, y: 60, duration: 0.35, ease: 'power2.in' }, 'critic')
      .to(ok, { autoAlpha: 0, scale: 0.5, duration: 0.25 }, 'critic')
      .to(pileAll, { y: '-=150', scaleX: 0.3, scaleY: 0.3, autoAlpha: 0, duration: 0.5, ease: 'power2.in', stagger: 0.02 }, 'critic+=0.2')
      .to(roll, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(1.6)' }, 'critic+=0.55')
      .to(bars, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'back.out(1.8)', stagger: 0.1 }, 'critic+=0.9')
      .to(plates, { autoAlpha: 1, y: 0, duration: 0.45, ease: 'back.out(1.8)' }, '<0.1')
      .to(halosY, { scale: 1.35, opacity: 0.15, duration: 0.5, yoyo: true, repeat: 1, transformOrigin: '50% 50%' }, 'critic+=1.3');
    /* stamp #1 */
    tl.to(hand, { autoAlpha: 1, y: -10, duration: 0.45, ease: 'power2.out' }, 'critic+=1.6')
      .to(hand, { y: 0, scaleY: 0.94, duration: 0.14, ease: 'power4.in', transformOrigin: '50% 100%' }, 'critic+=2.1')
      .to(hand, { scaleY: 1, duration: 0.2 }, '>');
    PB.slam(tl, das[0], 'critic+=2.1', world);
    PB.burst(tl, $('.ch-sp2'), 'critic+=2.28');
    tl.to(hand, { y: -110, x: 150, duration: 0.3, ease: 'power2.inOut' }, 'critic+=2.55')
      .set(halosY[0], { fill: MINT }, 'critic+=2.6')
      .to(armL, { rotation: -80, duration: 0.6, ease: 'back.out(1.4)' }, 'critic+=2.6')
      .to(das[0], { rotation: 80, duration: 0.6, ease: 'back.out(1.4)' }, '<');
    /* stamp #2 */
    PB.lamp(tl, lampsY[0], MINT, 'critic+=2.6');
    tl.to(hand, { x: 298, y: -10, duration: 0.35, ease: 'power2.inOut' }, 'critic+=2.95')
      .to(hand, { y: 0, scaleY: 0.94, duration: 0.14, ease: 'power4.in' }, 'critic+=3.3')
      .to(hand, { scaleY: 1, duration: 0.2 }, '>');
    PB.slam(tl, das[1], 'critic+=3.3', world);
    PB.burst(tl, $('.ch-sp3'), 'critic+=3.48');
    tl.to(hand, { y: -430, autoAlpha: 0, duration: 0.5, ease: 'power2.in' }, 'critic+=3.8')
      .set(halosY[1], { fill: MINT }, 'critic+=3.8')
      .to(armR, { rotation: 80, duration: 0.6, ease: 'back.out(1.4)' }, 'critic+=3.8')
      .to(das[1], { rotation: -80, duration: 0.6, ease: 'back.out(1.4)' }, '<')
      .to(roll, { y: 12, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 'critic+=4.2');
    PB.lamp(tl, lampsY[1], MINT, 'critic+=3.8');
    tl.addLabel('yes', 'critic+=4.7');

    /* ----- board: cut the roll into cards ----- */
    tl.to(bars.concat([plates]), { autoAlpha: 0, y: 50, duration: 0.4, ease: 'power2.in', stagger: 0.05 }, 'yes')
      .to(plan, { autoAlpha: 1, x: 0, duration: 0.5, ease: 'back.out(1.6)' }, 'yes+=0.3')
      .to($('.ch-bub-plan'), { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' }, 'yes+=0.7')
      .to(roll, { y: 230, scale: 0.8, duration: 0.5, ease: 'power2.inOut' }, 'yes+=0.4')
      .to(roll, { autoAlpha: 0, scaleX: 1.6, scaleY: 0.3, duration: 0.3, ease: 'power2.in' }, 'yes+=0.9');
    cards.forEach(function (el, i) {
      var st = el.__strip, p = cardPos(CARDS[i]);
      tl.to(el, { autoAlpha: 1, x: st.x, y: st.y, scale: st.s, duration: 0.45, ease: 'back.out(1.4)' }, 'yes+=' + (0.95 + Math.abs(CARDS[i].k - 2) * 0.07));
      el.__p = p;
    });
    tl.to(cuts, { autoAlpha: 1, duration: 0.2, stagger: 0.05 }, 'yes+=1.35')
      .to(scis, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }, 'yes+=1.4');
    var byK = [];
    cards.forEach(function (el, i) { byK[CARDS[i].k] = el; });
    for (var k = 1; k < 5; k++) {
      var tk = 1.6 + (k - 1) * 0.32;
      if (k > 1) tl.to(scis, { x: (k - 1) * STRIP.seg, duration: 0.14, ease: 'power2.inOut' }, 'yes+=' + (tk - 0.14));
      tl.to(bladeA, { rotation: 22, duration: 0.08, yoyo: true, repeat: 1 }, 'yes+=' + tk)
        .to(bladeB, { rotation: -22, duration: 0.08, yoyo: true, repeat: 1 }, '<')
        .to(cuts[k - 1], { autoAlpha: 0, duration: 0.1 }, 'yes+=' + (tk + 0.12))
        .to(byK.slice(k), { x: '+=5', duration: 0.12, ease: 'power1.out' }, '<');
    }
    tl.to(scis, { autoAlpha: 0, scale: 0.4, duration: 0.25 }, 'yes+=2.9')
      .to($('.ch-bub-plan'), { autoAlpha: 0, scale: 0, duration: 0.2 }, 'yes+=2.9')
      .to(board, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(1.6)' }, 'yes+=2.95');
    cards.forEach(function (el, i) {
      tl.to(el, { x: 0, y: 0, scale: 1, rotation: 0, duration: 0.75, ease: 'power2.inOut' }, 'yes+=' + (3.2 + i * 0.07))
        .to(el, { rotation: i % 2 ? 4 : -4, duration: 0.3, ease: 'sine.inOut', yoyo: true, repeat: 1 }, '<0.1');
    });
    tl.to(ring, { autoAlpha: 1, duration: 0.2 }, 'yes+=4.1')
      .to(ring, { scale: 1.08, duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '<');
    tl.to(hand2, { autoAlpha: 1, y: -12, duration: 0.45, ease: 'power2.out' }, 'yes+=3.95')
      .to(hand2, { y: 0, scaleY: 0.94, duration: 0.14, ease: 'power4.in' }, 'yes+=4.5')
      .to(hand2, { scaleY: 1, duration: 0.2 }, '>')
      .to(hand2, { y: -520, autoAlpha: 0, duration: 0.45, ease: 'power2.in' }, 'yes+=4.9');
    PB.slam(tl, planok, 'yes+=4.5', world);
    PB.burst(tl, $('.ch-sp4'), 'yes+=4.68');
    tl.addLabel('board', 'yes+=5.45');
    return tl;
  }

  MP.scene('chertyozh', {
    build: build,
    init: function (section, api) {
      var tl = master(section, api);
      section.__pb = PB.drive(api, tl);
      MP.blink(api.stage, api);
    },
    final: function (section, api) {
      var tl = master(section, api);
      section.__pb = PB.drive(api, tl, { first: 'doors' });
    }
  });
})();
