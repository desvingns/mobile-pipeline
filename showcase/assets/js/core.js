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
