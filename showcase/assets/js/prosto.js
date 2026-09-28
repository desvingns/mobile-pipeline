/* prosto.js — boots the «Просто» tab: plugins, matchMedia contexts, lazy scene init,
 * sticky-step helper, progress belt, in-page jumps, calm-mode switching, suspend/resume on tab change. */
(function () {
  'use strict';
  var MP = window.MP;
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var panel = document.getElementById('panel-prosto');
  var P = MP.prosto = { started: false, suspended: false, savedY: 0 };

  if (!gsap || !ST) {
    // Vendor scripts failed: show everything static; scenes still build their DOM.
    P.start = function () {
      if (P.started) return;
      P.started = true;
      MP.applyFacts(panel);
      Object.keys(MP.scenes).forEach(function (id) {
        var sec = document.getElementById(id); var s = MP.scenes[id];
        if (!sec || !s) return;
        var api = apiFor(sec, true, window.innerWidth >= 1024);
        try { s.build && s.build(sec, api); } catch (e) { console.error(e); }
        try { s.final && s.final(sec, api); } catch (e) { console.error(e); }
      });
    };
    P.suspend = function () {};
    P.resume = function (scrollToId) {
      P.start();
      var el = scrollToId && document.getElementById(scrollToId);
      if (el) el.scrollIntoView();
    };
    P.jumpTo = function (id) { var el = document.getElementById(id); if (el) el.scrollIntoView(); };
    return;
  }

  gsap.registerPlugin.apply(gsap, [ST, window.ScrollToPlugin, window.DrawSVGPlugin, window.MotionPathPlugin,
    window.MorphSVGPlugin, window.SplitText, window.Flip, window.CustomEase].filter(Boolean));
  if (window.CustomEase) {
    CustomEase.create('mp.pop', 'M0,0 C0.2,0 0.3,1.35 0.55,1.12 0.72,0.98 0.82,1 1,1');
    CustomEase.create('mp.stamp', 'M0,0 C0.5,0 0.75,1.25 0.86,1.02 0.93,0.97 1,1 1,1');
    CustomEase.create('mp.travel', 'M0,0 C0.45,0 0.55,1 1,1');
  }
  ST.config({ ignoreMobileResize: true });
  ST.defaults({ fastScrollEnd: true, preventOverlaps: true });

  /* ---------- per-scene api ---------- */
  function apiFor(sec, calm, wide) {
    var cleanups = [];
    var api = {
      section: sec,
      stage: sec.querySelector('[data-stage]'),
      calm: calm,
      wide: wide,
      gsap: gsap,
      /* addEventListener that is removed automatically when the scene is reverted */
      on: function (el, type, fn, opts) {
        if (!el) return;
        el.addEventListener(type, fn, opts);
        cleanups.push(function () { el.removeEventListener(type, fn, opts); });
      },
      /* idle loop: plays only while the section is on screen and the tab is visible */
      loop: function (anim) {
        if (calm || !anim || !anim.pause) return anim;
        anim.pause();
        var visible = false;
        // a scene may kill its own loop when it rebuilds its markup (e.g. a layout switch on rotation): a killed GSAP
        // animation has no parent, and play() would re-attach it to animate detached nodes forever — leave it dead
        var stop = MP.watch(sec, function (v) { visible = v; if (!anim.parent) { if (stop) stop(); return; } if (v && !P.suspended) anim.play(); else anim.pause(); });
        MP.loops.push({ anim: anim, isVisible: function () { return visible; } });
        cleanups.push(function () { stop(); anim.kill(); });
        return anim;
      },
      /* sticky steps: calls onStep(stepName, index, stepEl) when a .step becomes active (both directions) */
      steps: function (onStep) {
        var steps = MP.$$('.step[data-step]', sec);
        if (!ST) { if (steps.length) onStep(steps[steps.length - 1].getAttribute('data-step'), steps.length - 1, steps[steps.length - 1]); return; }
        if (!steps.length) return;
        // One trigger over the whole list; on every update MP.stepAt (core.js) names the active step from the live
        // layout: the 62% line side by side, the most readable text in the «stage band» layout. The layout can flip
        // between the two without a re-init (a phone rotating inside the same composition), so it is decided per update.
        var cur = -1;
        function set(i) {
          if (i === cur) return;
          steps.forEach(function (el, k) { el.classList.toggle('is-active', k === i); });
          cur = i;
          if (i >= 0) onStep(steps[i].getAttribute('data-step'), i, steps[i]);
        }
        function pick() { if (!P.suspended) set(MP.stepAt(sec, steps, cur)); }
        ST.create({ trigger: steps[0].parentNode, start: 'top bottom', end: 'bottom top',
          onUpdate: pick, onToggle: pick, onRefresh: pick });
        requestAnimationFrame(pick);
        cleanups.push(function () { cur = -1; steps.forEach(function (el) { el.classList.remove('is-active'); }); });
      },
      live: MP.live,
      _cleanup: function () { cleanups.splice(0).reverse().forEach(function (f) { try { f(); } catch (e) {} }); }
    };
    return api;
  }

  MP.loops = [];
  var sections = [];
  var mm = null;
  var liveApis = [];
  var lazyStops = [];

  /* One debounced refresh after a burst of lazy scene inits: a scene that grows (pin spacer,
   * cast upgrade) shifts every trigger below it, and triggers created in the same frame as a big
   * programmatic jump can otherwise be measured against a stale layout. */
  var refreshTimer = 0;
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    // refresh(true) = safe mode: waits for scrollEnd while the reader is scrolling (a refresh writes the scroll
    // position, and on iOS that stops a momentum fling dead)
    refreshTimer = setTimeout(function () { if (!P.suspended) ST.refresh(true); }, 180);
  }

  function setup() {
    mm = gsap.matchMedia();
    // 'any' (always true) keeps the callback alive on narrow screens: GSAP only runs it when at least one listed
    // condition matches, and without it phones/tablets would never build a scene. The KEY must not be 'all': GSAP
    // special-cases that key and never records it, then compares it on every media-query change anywhere on the page
    // (e.g. a scene's own phone query on rotation) and reverts + re-inits every scene (a stamp would be undone).
    mm.add({ any: '(min-width: 0px)', wide: '(min-width: 1024px)', reduce: '(prefers-reduced-motion: reduce)' }, function (ctx) {
      var wide = !!ctx.conditions.wide;
      var calm = (!!ctx.conditions.reduce && !MP.forceMotion) || MP.userCalm;
      document.documentElement.classList.toggle('is-calm', calm);
      sections.forEach(function (sec) {
        var s = MP.scenes[sec.id];
        if (!s) return;
        var stop = MP.lazy(sec, function () {
          ctx.add(function () {
            var api = apiFor(sec, calm, wide);
            liveApis.push(api);
            try {
              if (!sec.__mpBuilt && s.build) { s.build(sec, api); sec.__mpBuilt = true; sec.classList.add('is-built'); }
              if (calm) { s.final && s.final(sec, api); } else { s.init && s.init(sec, api); }
            } catch (e) { console.error('[scene ' + sec.id + ']', e); }
          });
          scheduleRefresh();
        }, '80% 0px');
        lazyStops.push(stop);
      });
      progressBelt(calm);
      return function () {
        lazyStops.splice(0).forEach(function (f) { f(); });
        liveApis.splice(0).forEach(function (a) { a._cleanup(); });
        MP.loops.length = 0;
      };
    });
  }

  /* ---------- progress belt in the header ---------- */
  function progressBelt(calm) {
    var fill = document.querySelector('.progress-belt .fill');
    var token = document.querySelector('.progress-belt .token');
    if (!fill) return;
    ST.create({
      trigger: panel, start: 'top top', end: 'bottom bottom',
      onUpdate: function (self) {
        var p = self.progress;
        gsap.set(fill, { scaleX: p });
        // keep the token inside the viewport (it is positioned by its left edge + margin-left:-11px)
        if (token) gsap.set(token, { x: 11 + p * (document.documentElement.clientWidth - 22) });
      }
    });
  }

  /* ---------- in-page jumps (hero CTAs etc.) ----------
   * The target is re-measured on every frame: scenes that build lazily while we fly past them
   * change the page height above the target, so a fixed scrollTo end point would overshoot. */
  function headerH() { return (document.querySelector('.site-header') || { offsetHeight: 0 }).offsetHeight; }
  function targetY(el) { return Math.max(0, el.getBoundingClientRect().top + window.pageYOffset - headerH()); }
  var jumpTween = null, jumpUser = false, jumpOff = null, jumpGen = 0;
  function settle(el, tries, gen) {
    // after the flight, keep correcting while lazily built scenes above the target settle their height — until the
    // reader takes over (a swipe right after landing must not be undone)
    setTimeout(function () {
      if (gen !== jumpGen) return;                        // a newer jump (or a tab switch) owns the scroll now
      if (jumpUser) { if (jumpOff) jumpOff(); return; }
      if (tries <= 0 && jumpOff) jumpOff();
      var d = targetY(el) - window.pageYOffset;
      if (Math.abs(d) > 3) window.scrollTo(0, targetY(el));
      if (tries > 0) settle(el, tries - 1, gen); else if (window.ScrollTrigger) ST.update();
    }, 160);
  }
  function jumpTo(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (jumpTween) { jumpTween.kill(); jumpTween = null; }
    if (jumpOff) jumpOff();
    // any wheel / touch / key from the reader cancels the flight AND the settling after it
    var USER = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    var cancel = function () { jumpUser = true; if (jumpTween) { jumpTween.kill(); jumpTween = null; } off(); };
    var off = function () { USER.forEach(function (t) { window.removeEventListener(t, cancel, true); }); if (jumpOff === off) jumpOff = null; };
    jumpUser = false; jumpOff = off;
    var gen = ++jumpGen;
    USER.forEach(function (t) { window.addEventListener(t, cancel, { capture: true, passive: true }); });
    if (MP.isCalm()) { window.scrollTo(0, targetY(el)); settle(el, 5, gen); return; }
    var from = window.pageYOffset;
    var st = { p: 0 };
    jumpTween = gsap.to(st, {
      p: 1, duration: 1.1, ease: 'power2.inOut',
      onUpdate: function () { window.scrollTo(0, from + (targetY(el) - from) * st.p); },
      onComplete: function () { jumpTween = null; settle(el, 5, gen); }
    });
  }
  P.jumpTo = jumpTo;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-jump]');
    if (!a) return;
    e.preventDefault();
    var id = a.getAttribute('data-jump');
    jumpTo(id);
    try { history.replaceState(null, '', '#' + id); } catch (err) {}
  });

  /* ---------- reading position = section + fraction (survives page-height changes) ----------
   * Inside a sticky-steps section the place is the ACTIVE STEP instead: the band and side-by-side layouts space their
   * steps differently, so the same fraction of the section would land on a neighbouring step after a rotation. */
  function sectionInView() {
    var probe = headerH() + 1;
    var list = sections.length ? sections : MP.$$('.scene[data-scene]', panel);
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) {
        var a = { el: list[i], probe: probe, frac: (probe - r.top) / Math.max(1, r.height) };
        var step = list[i].querySelector('.step.is-active');
        if (step) a.step = step;
        return a;
      }
    }
    return null;
  }
  function restoreAnchor(a) {
    if (!a) return;
    if (a.step && a.step.isConnected && a.step.offsetHeight) {
      // the step's text just below the band (band layout) or just past the trigger line (side by side)
      var want = MP.stepBand(a.el) ? MP.bandBottom(a.el) + 12 : MP.stepLine(a.el) - 40;
      window.scrollTo(0, a.step.getBoundingClientRect().top + window.pageYOffset - want);
      return;
    }
    var top = a.el.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo(0, top + a.frac * a.el.offsetHeight - a.probe);
  }
  P.anchor = sectionInView;

  /* Hold the reader's place through a relayout: every ScrollTrigger refresh in the next `ms` (scene re-inits run their
   * own, and a matchMedia revert scrolls to 0 first) restores it at once, so the top of the page never flashes in
   * between. A change of the page height during the hold (lazily rebuilt scenes above settle later) restores it too and
   * extends the hold until the page has been still for a moment (at most ~4 s). The reader's own touch / wheel / key
   * ends the hold. */
  var holding = null, holdTimer = 0, holdMax = 0, holdRO = null, HOLD_USER = ['touchstart', 'wheel', 'pointerdown', 'keydown'];
  function onHoldRefresh() { if (holding && holding.el.isConnected && !P.suspended) restoreAnchor(holding); }
  function onHoldResize() {
    if (!holding) return;
    onHoldRefresh();
    var left = holdMax - Date.now();
    if (left > 0) { clearTimeout(holdTimer); holdTimer = setTimeout(endHold, Math.min(600, left)); }
  }
  function endHold() {
    clearTimeout(holdTimer);
    if (!holding) return;
    holding = null;
    ST.removeEventListener('refresh', onHoldRefresh);
    if (holdRO) holdRO.disconnect();
    HOLD_USER.forEach(function (t) { window.removeEventListener(t, endHold, true); });
    lastAnchor = sectionInView();
  }
  function holdPlace(a, ms) {
    if (!a) return;
    if (!holding) {
      ST.addEventListener('refresh', onHoldRefresh);
      HOLD_USER.forEach(function (t) { window.addEventListener(t, endHold, { capture: true, passive: true }); });
      if (window.ResizeObserver) { holdRO = holdRO || new ResizeObserver(onHoldResize); holdRO.observe(panel); }
      holdMax = Date.now() + 4000;
    }
    holding = a;
    clearTimeout(holdTimer);
    holdTimer = setTimeout(endHold, ms);
  }

  // Width and layout changes (rotation, a window resize that flips a layout band) re-lay the page; capture the place
  // and restore it once the new layout has refreshed. A height-only change that flips no band is ignored: mobile
  // browsers fire 'resize' whenever the address bar collapses or expands during a scroll, and restoring then would
  // yank the reader back to where the bar moved. The place is recorded shortly after each scroll (in the OLD layout):
  // inside 'resize' the page is already laid out anew while pageYOffset still holds the old value.
  var LAYOUT_MQ = window.matchMedia ? ['(orientation: portrait)', '(max-height: 520px)'].map(function (q) { return window.matchMedia(q); }) : [];
  function layoutSig() { return window.innerWidth + '|' + LAYOUT_MQ.map(function (m) { return m.matches ? 1 : 0; }).join(''); }
  var resizeTimer = 0, lastSig = layoutSig(), lastAnchor = null, anchorTimer = 0;
  window.addEventListener('scroll', function () {
    if (!P.started || P.suspended || P.resizeAnchor || holding) return;
    clearTimeout(anchorTimer);
    anchorTimer = setTimeout(function () { if (!P.resizeAnchor && !holding && !P.suspended) lastAnchor = sectionInView(); }, 120);
  }, { passive: true });
  window.addEventListener('resize', function () {
    var sig = layoutSig();
    if (sig === lastSig && !P.resizeAnchor) return;
    lastSig = sig;
    if (!P.started || P.suspended) return;
    if (!P.resizeAnchor) P.resizeAnchor = (holding && holding.el.isConnected && holding) || lastAnchor || sectionInView();
    holdPlace(P.resizeAnchor, 1600);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var a = P.resizeAnchor; P.resizeAnchor = null;
      if (a && a.el.isConnected) { ST.refresh(); restoreAnchor(a); holdPlace(a, 900); }
    }, 300);
  });

  /* ---------- public lifecycle used by router.js ---------- */
  try { history.scrollRestoration = 'manual'; } catch (e) {}
  P.start = function () {
    if (P.started) return;
    P.started = true;
    sections = MP.$$('.scene[data-scene]', panel);
    MP.applyFacts(panel);
    MP.nbsp(panel);
    setup();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(true); });
    window.addEventListener('load', function () { ST.refresh(true); });
  };
  P.suspend = function () {
    if (!P.started || P.suspended) return;
    P.savedAnchor = sectionInView();
    P.suspended = true;
    jumpGen++;
    if (jumpOff) jumpOff();
    if (jumpTween) { jumpTween.kill(); jumpTween = null; }
    ST.getAll().forEach(function (t) { t.disable(false); });
    MP.loops.forEach(function (l) { l.anim.pause(); });
    document.documentElement.classList.add('is-paused');
    var v = document.getElementById('film-video'); if (v && !v.paused) v.pause();
    if (MP.sim && MP.sim.pause) MP.sim.pause();
  };
  P.resume = function (scrollToId) {
    if (!P.started) { P.start(); if (scrollToId) setTimeout(function () { jumpTo(scrollToId); }, 60); return; }
    if (!P.suspended) { if (scrollToId) jumpTo(scrollToId); return; }
    P.suspended = false;
    document.documentElement.classList.remove('is-paused');
    requestAnimationFrame(function () {
      ST.getAll().forEach(function (t) { t.enable(false); });
      ST.refresh();
      if (P.savedAnchor && P.savedAnchor.el.isConnected) restoreAnchor(P.savedAnchor); else window.scrollTo(0, 0);
      P.savedAnchor = null;
      ST.update();
      MP.loops = MP.loops.filter(function (l) { return !!l.anim.parent; });   // drop loops their scene has killed
      MP.loops.forEach(function (l) { if (l.isVisible()) l.anim.play(); });
      if (scrollToId) jumpTo(scrollToId);
    });
  };
  P.toTop = function () { P.savedAnchor = null; jumpGen++; if (jumpOff) jumpOff(); if (jumpTween) { jumpTween.kill(); jumpTween = null; } window.scrollTo(0, 0); };

  /* ---------- calm toggle ---------- */
  function syncCalmButton() {
    var btn = document.getElementById('calm-toggle');
    if (btn) btn.setAttribute('aria-pressed', MP.isCalm() ? 'true' : 'false');
  }
  MP.ready(function () {
    var btn = document.getElementById('calm-toggle');
    if (btn) btn.addEventListener('click', function () { MP.setCalm(!MP.isCalm()); });
    syncCalmButton();
  });
  MP.onCalmChange(function () {
    syncCalmButton();
    if (!P.started || !mm) return;
    // Page height differs between animated and calm mode (the konveyer pin spacer), so restore the
    // reader's place relative to the section in view instead of the absolute scroll position.
    var anchor = P.suspended ? null : sectionInView();
    mm.revert();
    setup();
    requestAnimationFrame(function () {
      ST.refresh();
      if (anchor) { restoreAnchor(anchor); holdPlace(anchor, 1200); }   // the lazily re-built konveyer pin spacer refreshes later
    });
  });
})();
