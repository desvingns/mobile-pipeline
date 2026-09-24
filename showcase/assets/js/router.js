/* router.js — two tabs («Просто» / «Схема») + hash routing, and lazy loading of the Схема bundle.
 * Hashes: '' | #prosto → Просто top · #<sectionId> → Просто, scrolled to that section ·
 *         #skhema | #skhema/<graph>[/<node>|/~<comment>|/!<scenario>] → Схема (sub-route passed to MP_SKHEMA).
 * Contract for the Схема bundle: window.MP_SKHEMA = { mount(rootEl, route), show(route), hide() }.
 * It may call MP.router.setSkhemaRoute('<graph>/<node>') to reflect its own navigation in the URL. */
(function () {
  'use strict';
  var MP = window.MP;
  var tabs = { prosto: document.getElementById('tab-prosto'), skhema: document.getElementById('tab-skhema') };
  var panels = { prosto: document.getElementById('panel-prosto'), skhema: document.getElementById('panel-skhema') };
  var current = null;
  var skhemaState = 'idle'; // idle | loading | ready | failed
  var pendingRoute = '';
  var ownHashChange = false;

  var SKHEMA_CSS = ['assets/css/blueprint.css'];
  var SKHEMA_JS = ['assets/js/blueprint-data.js', 'assets/js/bp-core.js', 'assets/js/bp-ui.js', 'assets/js/bp-sim.js', 'assets/js/bp-outline.js'];

  function parse(hash) {
    var h = (hash || '').replace(/^#/, '');
    try { h = decodeURIComponent(h); } catch (e) {}
    if (h === 'skhema' || h.indexOf('skhema/') === 0) return { tab: 'skhema', route: h.slice(7).replace(/^\//, '') };
    if (h && h !== 'prosto' && document.getElementById(h) && panels.prosto.contains(document.getElementById(h))) return { tab: 'prosto', section: h };
    return { tab: 'prosto', top: h === 'prosto' };
  }

  function loadSkhema(done) {
    if (skhemaState === 'ready') { done(); return; }
    if (skhemaState === 'loading') return;
    skhemaState = 'loading';
    SKHEMA_CSS.forEach(function (href) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; document.head.appendChild(l);
    });
    var i = 0;
    (function next() {
      if (i >= SKHEMA_JS.length) {
        if (window.MP_SKHEMA && window.MP_SKHEMA.mount) {
          skhemaState = 'ready';
          var sk = panels.skhema.querySelector('[data-skhema-skeleton]'); if (sk) sk.remove();
          try { window.MP_SKHEMA.mount(panels.skhema, pendingRoute); } catch (e) { console.error(e); }
          done();
        } else { fail(); }
        return;
      }
      var s = document.createElement('script');
      s.src = SKHEMA_JS[i++]; s.async = false;
      s.onload = next; s.onerror = fail;
      document.body.appendChild(s);
    })();
    function fail() {
      skhemaState = 'failed';
      var sk = panels.skhema.querySelector('[data-skhema-skeleton]');
      if (sk) sk.textContent = 'Схему не удалось загрузить. Обновите страницу.';
    }
  }

  function select(tab, opts) {
    opts = opts || {};
    var changed = current !== tab;
    Object.keys(tabs).forEach(function (k) {
      var on = k === tab;
      tabs[k].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[k].tabIndex = on ? 0 : -1;
    });
    document.body.classList.toggle('tab-skhema', tab === 'skhema');
    document.documentElement.classList.remove('boot-skhema');

    if (tab === 'skhema') {
      if (changed && MP.prosto) MP.prosto.suspend();
      panels.prosto.hidden = true;
      panels.skhema.hidden = false;
      pendingRoute = opts.route || '';
      if (changed) window.scrollTo(0, 0);
      loadSkhema(function () { if (window.MP_SKHEMA) window.MP_SKHEMA.show(pendingRoute); });
    } else {
      if (changed && current === 'skhema' && window.MP_SKHEMA && skhemaState === 'ready') window.MP_SKHEMA.hide();
      panels.skhema.hidden = true;
      panels.prosto.hidden = false;
      if (MP.prosto) MP.prosto.resume(opts.section);
      if (opts.top && !changed) window.scrollTo(0, 0);
    }
    current = tab;
  }

  function fromHash() {
    if (ownHashChange) { ownHashChange = false; return; }
    var r = parse(location.hash);
    var before = current;
    var focusWasInside = before && panels[before] && panels[before].contains(document.activeElement);
    select(r.tab, r);
    // A link (e.g. «Найти на схеме») switched the tab: its focused element is now hidden, so move focus
    // to the newly selected tab and announce the change.
    if (before && before !== r.tab && (focusWasInside || document.activeElement === document.body)) {
      tabs[r.tab].focus({ preventScroll: true });
      if (MP.live) MP.live(r.tab === 'skhema' ? 'Открыта вкладка «Схема»' : 'Открыта вкладка «Просто»');
    }
  }

  function setHash(h) {
    if (location.hash === h) return;
    ownHashChange = true;
    location.hash = h;
  }

  /* Public helpers */
  MP.router = {
    go: function (tab, route) {
      var h = tab === 'skhema' ? ('#skhema' + (route ? '/' + route : '')) : '#prosto';
      setHash(h);
      select(tab, { route: route || '' });
    },
    /* Схема reflects its own navigation without re-triggering show() */
    setSkhemaRoute: function (route) {
      var h = '#skhema' + (route ? '/' + route : '');
      if (location.hash === h) return;
      try { history.replaceState(null, '', h); } catch (e) { ownHashChange = true; location.hash = h; }
    }
  };

  /* Tab clicks + APG manual activation (arrows move focus, Enter/Space activates) */
  Object.keys(tabs).forEach(function (k) {
    tabs[k].addEventListener('click', function () { MP.router.go(k); });
    tabs[k].addEventListener('keydown', function (e) {
      var keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
      if (keys.indexOf(e.key) === -1) return;
      e.preventDefault();
      var other = k === 'prosto' ? tabs.skhema : tabs.prosto;
      if (e.key === 'Home') tabs.prosto.focus(); else if (e.key === 'End') tabs.skhema.focus(); else other.focus();
    });
  });

  /* Skip link: jump into the visible panel without touching the hash (a '#main' hash would switch tabs). */
  var skip = document.querySelector('.skip-link');
  if (skip) skip.addEventListener('click', function (e) {
    e.preventDefault();
    var target = current === 'skhema' ? (panels.skhema.querySelector('[tabindex="0"]') || panels.skhema) : document.getElementById('main');
    if (target === panels.skhema) panels.skhema.setAttribute('tabindex', '-1');
    target.focus();
  });
  /* Brand: always back to the very start of «Просто», whatever the current hash. */
  var brand = document.querySelector('.site-header .brand');
  if (brand) brand.addEventListener('click', function (e) {
    e.preventDefault();
    if (MP.prosto && MP.prosto.toTop) MP.prosto.toTop();
    if (current !== 'prosto') MP.router.go('prosto'); else setHash('#prosto');
    requestAnimationFrame(function () { window.scrollTo(0, 0); });
  });

  window.addEventListener('hashchange', fromHash);
  MP.ready(fromHash);
})();
