/* core.js — the MP namespace shared by every «Просто» module.
 * Contract (see docs/contracts.md):
 *   MP.scene(id, {build, init, final})  — register a scene for the <section id>.
 *     build(section, api)  once: inject SVG/DOM into section's [data-stage]. The built DOM IS the
 *                          final (fully shown) state. Never hide things with CSS alone.
 *     init(section, api)   animated mode: set start states with gsap and animate to the built state.
 *                          Everything created here (tweens, timelines, ScrollTriggers, listeners via
 *                          api.on) is reverted automatically on calm-mode or breakpoint changes.
 *     final(section, api)  calm mode (reduced motion / «Без анимации»): make the static end state
 *                          correct and interactive (buttons still work, but without motion).
 *   api = { section, stage, wide, calm, gsap, on(el, type, fn), loop(anim), steps(onStep), live(text) }
 */
(function () {
  'use strict';
  var MP = window.MP = window.MP || {};
  var doc = document;
  var root = doc.documentElement;

  MP.scenes = {};
  MP.scene = function (id, def) { MP.scenes[id] = def; };

  /* ---------- calm mode ---------- */
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  /* Stored preference: '1' = calm by choice, 'motion' = animate even though the OS asks for reduced
   * motion (an explicit opt-in from the toggle), absent/'0' = follow the OS setting. */
  var stored = null;
  try { stored = localStorage.getItem('mp-calm'); } catch (e) {}
  MP.userCalm = root.classList.contains('is-calm');
  MP.forceMotion = stored === 'motion';
  MP.isCalm = function () { return MP.userCalm || (mqReduce.matches && !MP.forceMotion); };
  var calmListeners = [];
  MP.onCalmChange = function (fn) { calmListeners.push(fn); };
  MP.setCalm = function (on) {
    MP.userCalm = !!on;
    MP.forceMotion = !on && mqReduce.matches;
    root.classList.toggle('is-calm', MP.userCalm);
    try { localStorage.setItem('mp-calm', MP.userCalm ? '1' : (MP.forceMotion ? 'motion' : '0')); } catch (e) {}
    calmListeners.forEach(function (fn) { try { fn(MP.isCalm()); } catch (e) { console.error(e); } });
  };

  /* ---------- tiny DOM helpers ---------- */
  MP.$ = function (sel, ctx) { return (ctx || doc).querySelector(sel); };
  MP.$$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); };
  MP.html = function (markup) {
    var t = doc.createElement('template'); t.innerHTML = markup.trim(); return t.content.firstElementChild;
  };
  /* Build an <svg> element from inner markup. */
  MP.svg = function (inner, viewBox, cls) {
    return MP.html('<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBox + '"' +
      (cls ? ' class="' + cls + '"' : '') + ' focusable="false">' + inner + '</svg>');
  };
  /* Deterministic PRNG so decorative randomness is stable between visits. */
  MP.seeded = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- accessibility live region ---------- */
  MP.live = function (text) {
    var el = doc.getElementById('mp-live'); if (!el) return;
    el.textContent = ''; setTimeout(function () { el.textContent = text; }, 30);
  };

  /* ---------- visibility helpers ---------- */
  MP.lazy = function (el, fn, margin) {
    if (!('IntersectionObserver' in window)) { fn(); return function () {}; }
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
    }, { rootMargin: margin || '60% 0px' });
    io.observe(el);
    return function () { io.disconnect(); };
  };
  MP.watch = function (el, onChange, margin) {
    if (!('IntersectionObserver' in window)) { onChange(true); return function () {}; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { onChange(e.isIntersecting); });
    }, { rootMargin: margin || '0px' });
    io.observe(el);
    return function () { io.disconnect(); };
  };

  /* ---------- sticky steps: which step is active ----------
   * Side by side (desktop, phones held sideways) a step is active while it crosses the line at 62% of the viewport.
   * Below 1024px in portrait the stage sits in a full-width band above the text (prosto.css, «stage band»): there the
   * active step is the one whose text is the most readable in the window below the band, so the stage always shows the
   * step being read (a fixed line would lag behind a reader who reads each step as it enters the window). */
  function stickyOf(section) { return section && section.querySelector('.stage-sticky'); }
  /* true when the stage rides in the band above the step text */
  MP.stepBand = function (section) {
    var sticky = stickyOf(section);
    if (!sticky || !sticky.offsetHeight) return false;
    return sticky.getBoundingClientRect().width >= 0.8 * sticky.parentNode.getBoundingClientRect().width;
  };
  /* the bottom edge of the band once it is stuck under the header (px from the viewport top) */
  MP.bandBottom = function (section) {
    var header = doc.querySelector('.site-header'), sticky = stickyOf(section);
    return (header ? header.offsetHeight : 0) + (sticky ? sticky.offsetHeight : 0);
  };
  /* the trigger line (px from the viewport top): 62% side by side, 40% down the reading window in the band layout */
  MP.stepLine = function (section) {
    var vh = window.innerHeight;
    if (MP.stepBand(section)) {
      var b = MP.bandBottom(section);
      return Math.round(Math.min(b + Math.max(32, 0.4 * (vh - b)), vh * 0.86));
    }
    return Math.round(vh * 0.62);
  };
  /* a step's text box: from its first child's top to its last child's bottom (the step's own padding excluded) */
  function textBox(step) {
    var a = step.firstElementChild, b = step.lastElementChild;
    if (!a) return step.getBoundingClientRect();
    return { top: a.getBoundingClientRect().top, bottom: b.getBoundingClientRect().bottom };
  }
  /* Index of the step that should be active now (-1: none yet). Band: the most readable text below the band (a near
   * tie keeps `cur`); when no text is readable, the last one already read (slid under the band). Side by side: the
   * last step whose top passed the line. */
  MP.stepAt = function (section, steps, cur) {
    steps = steps || MP.$$('.step[data-step]', section);
    var i, vh = window.innerHeight;
    if (MP.stepBand(section)) {
      var top = MP.bandBottom(section), best = -1, bestShare = 0.25, read = -1;
      for (i = 0; i < steps.length; i++) {
        var t = textBox(steps[i]);
        if (t.top < top) read = i;
        var share = (Math.min(t.bottom, vh) - Math.max(t.top, top)) / Math.max(1, t.bottom - t.top);
        if (share > bestShare + 0.02 || (i === cur && share >= bestShare - 0.02)) { best = i; bestShare = share; }
      }
      return best >= 0 ? best : read;
    }
    var line = MP.stepLine(section), p = -1;
    for (i = 0; i < steps.length; i++) if (steps[i].getBoundingClientRect().top < line) p = i;
    return p;
  };

  /* ---------- Russian typographer: nbsp after short words and before dashes ---------- */
  var SHORT = /(^|[\s(«"])(в|и|с|к|о|у|а|я|на|не|по|от|до|за|из|ко|со|во|же|ли|бы|но|да|то|об|ни)\s+/gi;
  MP.nbsp = function (rootEl) {
    var walker = doc.createTreeWalker(rootEl || doc.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode && n.parentNode.nodeName;
        return (p === 'SCRIPT' || p === 'STYLE' || p === 'TEXTAREA') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var n, list = [];
    while ((n = walker.nextNode())) list.push(n);
    list.forEach(function (t) {
      var v = t.nodeValue;
      if (!/\S/.test(v)) return;
      var out = v.replace(SHORT, function (m, pre, w) { return pre + w + ' '; })
                 .replace(/ (—|–)/g, ' $1')
                 .replace(/(\d) (?=[А-Яа-яЁёA-Za-z])/g, '$1 ')          // «18 мая», «20 секунд»
                 .replace(/\b(Claude|Google|Mobile) (Code|Play|Pipeline)\b/g, '$1 $2');
      if (out !== v) t.nodeValue = out;
    });
  };

  /* ---------- facts: fill [data-fact] nodes from MP_FACTS ---------- */
  MP.applyFacts = function (rootEl) {
    var F = window.MP_FACTS || {};
    MP.$$('[data-fact]', rootEl).forEach(function (el) {
      var k = el.getAttribute('data-fact');
      if (F[k] !== undefined) el.textContent = String(F[k]);
    });
  };

  MP.ready = function (fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn); else fn();
  };
})();
