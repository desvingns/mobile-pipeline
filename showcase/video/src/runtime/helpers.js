/* helpers.js — tiny seek-safe motion helpers shared by every video composition.
 * Injected verbatim by scripts/build-video.cjs wherever a template writes %%HELPERS%% (inside the
 * template's own <script>, before the timeline is built). Idempotent: the first scene to load defines
 * window.MPV; later copies reuse it.
 *
 * Rules these helpers keep for you (hyperframes determinism contract):
 *   - no Math.random / Date.now: MPV.rng(seed) is a seeded mulberry32
 *   - no repeat:-1: loops get a finite repeat computed with floor (MPV.repeats)
 *   - every tween is a fromTo. Entrances (arrive, slam, type) are the first tween on their element and
 *     render their hidden from-state at build (immediateRender:true) so cold seeks never show an element
 *     before it arrives; everything else uses immediateRender:false so it never clobbers earlier state.
 *     YOUR OWN first tween on an element that must stay hidden until then: leave immediateRender default
 *     (true) or hide it in CSS; later tweens on the same props: immediateRender:false.
 *
 * API (t = scene-local seconds, tl = the scene's paused timeline):
 *   MPV.C                         brand palette {ink, cream, violet, lemon, mint, raspberry, sky, tangerine}
 *   MPV.rng(seed) -> fn()         seeded PRNG in [0,1)
 *   MPV.repeats(span, cycle)      finite repeat count that never overshoots span
 *   MPV.arrive(tl, el, t, o)      pop-in: scale o.from(0.6)->1, opacity 0->1, back.out(1.7), 0.5 s
 *   MPV.slam(tl, el, t, o)        kinetic word: scale 1.35->1, y -30->0, opacity 0->1, expo.out 0.3 s
 *   MPV.press(tl, el, t)          button press: scale 1->0.92 (0.08 s) -> 1 back.out(3) 0.35 s
 *   MPV.snap(tl, el, t, vars, o)  automat move: power4.inOut 0.2 s (or steps(n) with o.steps)
 *   MPV.bob(tl, el, from, to, o)  robot float: y 0->-o.y(10) yoyo, sine.inOut, period o.period(2.1 s)
 *   MPV.sway(tl, el, from, to, o) gentle rotation yoyo (deg o.deg(3)), period o.period(2.4 s)
 *   MPV.blink(tl, lids, from, to, o)  eyelid blink (scaleY 1->0.1->1, 0.1 s) on a seeded schedule,
 *                                 every o.every(2.6-4.2 s), o.seed
 *   MPV.drift(tl, el, from, to, o)    linear background drift by o.x/o.y px (ease none)
 *   MPV.count(tl, el, t, o)       count-up o.from->o.to over o.dur (default 0.9 s), o.fmt(n) -> text
 *   MPV.type(tl, spans, t, o)     typewriter: reveal pre-split char spans at o.cps (default 22/s)
 *   MPV.wait(tl, el, from, to, o) lamp/indicator pulse: opacity/scale yoyo, finite
 */
(function () {
  if (window.MPV) return;
  var C = {
    ink: '#16123A', cream: '#FFF6E6', violet: '#5B34F5', lemon: '#FFDA4F',
    mint: '#2BD99F', raspberry: '#FF4F8B', sky: '#3EC5FF', tangerine: '#FF8A1F'
  };
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0; var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function repeats(span, cycle) { return Math.max(0, Math.floor(span / cycle) - 1); }
  function o(x) { return x || {}; }
  var NIR = { immediateRender: false };
  function ext(a, b) { var r = {}, k; for (k in a) r[k] = a[k]; for (k in b) r[k] = b[k]; return r; }

  // Entrances are the FIRST tween on their element, so they render their hidden from-state at build
  // time (immediateRender true): a cold seek to any time before the entrance then shows the element
  // hidden, never its CSS end state. Pass {again: true} for a second entrance on the same element.
  function first(opt) { return { immediateRender: !opt.again }; }
  function arrive(tl, el, t, opt) {
    opt = o(opt);
    return tl.fromTo(el, { scale: opt.from != null ? opt.from : 0.6, opacity: 0, y: opt.y || 0 },
      ext(first(opt), { scale: 1, opacity: 1, y: 0, duration: opt.dur || 0.5, ease: opt.ease || 'back.out(1.7)' }), t);
  }
  function slam(tl, el, t, opt) {
    opt = o(opt);
    return tl.fromTo(el, { scale: 1.35, y: -30, opacity: 0 },
      ext(first(opt), { scale: 1, y: 0, opacity: 1, duration: opt.dur || 0.3, ease: 'expo.out' }), t);
  }
  function press(tl, el, t) {
    tl.fromTo(el, { scale: 1 }, ext(NIR, { scale: 0.92, duration: 0.08, ease: 'power2.in' }), t);
    return tl.fromTo(el, { scale: 0.92 }, ext(NIR, { scale: 1, duration: 0.35, ease: 'back.out(3)' }), t + 0.08);
  }
  function snap(tl, el, t, vars, opt) {
    opt = o(opt);
    var to = ext(NIR, vars);
    to.duration = opt.dur || 0.2;
    to.ease = opt.steps ? 'steps(' + opt.steps + ')' : 'power4.inOut';
    return opt.fromVars ? tl.fromTo(el, opt.fromVars, to, t) : tl.to(el, to, t);
  }
  function loop(tl, el, from, to, period, fromVars, toVars) {
    var half = period / 2;
    var n = repeats(to - from, half);
    return tl.fromTo(el, fromVars, ext(NIR, ext(toVars, { duration: half, ease: 'sine.inOut', yoyo: true, repeat: n })), from);
  }
  function bob(tl, el, from, to, opt) {
    opt = o(opt);
    return loop(tl, el, from, to, opt.period || 2.1, { y: 0 }, { y: -(opt.y != null ? opt.y : 10) });
  }
  function sway(tl, el, from, to, opt) {
    opt = o(opt);
    var d = opt.deg != null ? opt.deg : 3;
    return loop(tl, el, from, to, opt.period || 2.4, { rotation: -d }, { rotation: d });
  }
  function wait(tl, el, from, to, opt) {
    opt = o(opt);
    return loop(tl, el, from, to, opt.period || 0.9, { opacity: opt.lo != null ? opt.lo : 0.45, scale: 1 },
      { opacity: 1, scale: opt.scale || 1.08 });
  }
  function blink(tl, lids, from, to, opt) {
    opt = o(opt);
    // automats have no face: quietly skip instead of adding tweens on an empty target
    var els = typeof lids === 'string' ? document.querySelectorAll(lids) : lids;
    if (!els || els.length === 0) return tl;
    lids = els;
    var r = rng(opt.seed || 1);
    var lo = opt.min || 2.6, hi = opt.max || 4.2;
    var t = from + 0.4 + r() * 1.2;
    while (t + 0.12 < to) {
      tl.fromTo(lids, { scaleY: 1 }, ext(NIR, { scaleY: 0.1, duration: 0.05, ease: 'power1.in' }), t);
      tl.fromTo(lids, { scaleY: 0.1 }, ext(NIR, { scaleY: 1, duration: 0.05, ease: 'power1.out' }), t + 0.05);
      t += lo + r() * (hi - lo);
    }
    return tl;
  }
  function drift(tl, el, from, to, opt) {
    opt = o(opt);
    // only the axes asked for: a whole-scene drift that also pinned the other axis to 0 outlived any later
    // move on that axis (a camera pan), so sequential render snapped it back while cold seeks did not
    var a = {}, b = {};
    if (opt.x != null) { a.x = 0; b.x = opt.x; }
    if (opt.y != null) { a.y = 0; b.y = opt.y; }
    return tl.fromTo(el, a, ext(NIR, ext(b, { duration: Math.max(0.01, to - from), ease: 'none' })), from);
  }
  function count(tl, el, t, opt) {
    opt = o(opt);
    var fmt = opt.fmt || function (n) { return String(Math.round(n)); };
    var box = { v: opt.from || 0 };
    el.textContent = fmt(opt.from || 0);
    return tl.fromTo(box, { v: opt.from || 0 }, ext(NIR, {
      v: opt.to, duration: opt.dur || 0.9, ease: opt.ease || 'power2.out',
      onUpdate: function () { el.textContent = fmt(box.v); }
    }), t);
  }
  function type(tl, spans, t, opt) {
    opt = o(opt);
    var cps = opt.cps || 22;
    for (var i = 0; i < spans.length; i++) {   // first tween per char: hide it at build time
      tl.fromTo(spans[i], { opacity: 0 }, { opacity: 1, duration: 0.01, immediateRender: true }, t + i / cps);
    }
    return tl;
  }
  window.MPV = {
    C: C, rng: rng, repeats: repeats, arrive: arrive, slam: slam, press: press, snap: snap,
    bob: bob, sway: sway, wait: wait, blink: blink, drift: drift, count: count, type: type
  };
})();
