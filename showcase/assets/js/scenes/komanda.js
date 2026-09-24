/* scenes/komanda.js — «Знакомьтесь: команда фабрики» (package A, docs/design-prosto.md §2.4).
 * Progressive enhancement of ul.cast-list:
 *   - every card gets its character art (MP.charSVG) — also the plain list (vendor failure) stays illustrated;
 *   - JS upgrades it into a «доска почёта» character select: a roster (APG tabs: role=tablist of buttons, grouped
 *     Мастера / Автоматы / Вы, arrows/Home/End, automatic activation) + ONE tabpanel spotlight that holds the ul with
 *     only the selected card visible, a big animated character on a coloured backdrop and a ≤5-word bubble.
 *   - the big art is a button: poke a character for its line (Придира cycles three nitpicks), announced politely.
 *   - «Назад» / «Дальше» buttons + an «N из 24» counter under the card walk the whole cast (wrap-around), so a phone
 *     user never has to scroll back up to the strip.
 * The card art AND the upgrade run eagerly at DOM-ready (static DOM work, no animation): the section reaches its final
 * height before any scrolling or in-page jump, and even a tab that never boots shows an illustrated list. Reveals animate
 * opacity/transform only (never visibility), so tabs and cards stay in the accessibility tree while they wait.
 * The «Найти на схеме» links are untouched. Extra DOM lives only inside #komanda .cast. */
(function () {
  'use strict';
  var MP = window.MP;

  var LINES = {
    brigadir: 'Всё по порядку!', razvedchik: 'Изучу ваш проект', syshchik: 'Вижу три кнопки!', obkhodchik: 'Сам всё нажму',
    pisar: 'Записываю каждую мелочь', sovetnik: 'Думаем одновременно!', pridira: 'Переделать! Тут непонятно.',
    planirovshchik: 'Режу на карточки', khudozhnik: 'Будет красиво!', master: 'Готово, проверяйте!',
    revizor: 'Замечание номер один', arkhitektor: 'Решим по-хорошему', ispytatel: 'А если ночью?',
    priyomshchik: 'Подключено. Вот памятка', letopisets: 'Всё записано', bibliotekar: 'Это запомним',
    ratsionalizator: 'Есть идея!', vesy: 'Бип. Вес в норме', strelochnik: 'Бип. Налево!', poryadok: 'Бип. Всё по полочкам',
    stend: 'Бип. Испытания пройдены', pochtalon: 'Бип. Отправлено', zhurnal: 'Бип. Записано', vy: 'Да — или нет'
  };
  var NITPICKS = ['Переделать! Тут непонятно.', 'А если нет интернета?', 'Запятая не там!'];
  /* backdrop colour behind each character (contrasts with its body) */
  var BACK = {
    brigadir: '#2BD99F', razvedchik: '#FF8A1F', syshchik: '#3EC5FF', obkhodchik: '#FF8A1F', pisar: '#3EC5FF',
    sovetnik: '#5B34F5', pridira: '#2BD99F', planirovshchik: '#FF4F8B', khudozhnik: '#3EC5FF', master: '#3EC5FF',
    revizor: '#2BD99F', arkhitektor: '#3EC5FF', ispytatel: '#FF4F8B', priyomshchik: '#FF8A1F', letopisets: '#5B34F5',
    bibliotekar: '#2BD99F', ratsionalizator: '#3EC5FF', vesy: '#5B34F5', strelochnik: '#FF4F8B', poryadok: '#2BD99F',
    stend: '#5B34F5', pochtalon: '#FF8A1F', zhurnal: '#FF4F8B', vy: '#5B34F5'
  };
  var GROUPS = [['master', 'Мастера'], ['automat', 'Автоматы'], ['you', 'Вы']];

  function spotBackSVG() {
    var rays = '';
    for (var i = 0; i < 16; i++) {
      var a0 = (i * 22.5 - 4.5) * Math.PI / 180, a1 = (i * 22.5 + 4.5) * Math.PI / 180;
      rays += 'M200 210L' + (200 + Math.cos(a0) * 260).toFixed(1) + ' ' + (210 + Math.sin(a0) * 260).toFixed(1) + 'L' +
        (200 + Math.cos(a1) * 260).toFixed(1) + ' ' + (210 + Math.sin(a1) * 260).toFixed(1) + 'Z';
    }
    return '<svg class="spot-back" viewBox="0 0 400 400" aria-hidden="true" focusable="false">' +
      '<defs><clipPath id="cast-spot-clip"><circle cx="200" cy="200" r="176"/></clipPath></defs>' +
      '<g clip-path="url(#cast-spot-clip)"><g class="spot-fills"><circle class="spot-fill" cx="200" cy="200" r="178" fill="' + BACK.brigadir + '"/></g>' +
      '<g class="spot-rays"><path d="' + rays + '" fill="#FFF6E6" fill-opacity=".22"/></g>' +
      '<ellipse cx="200" cy="352" rx="120" ry="20" fill="#16123A" fill-opacity=".18"/></g>' +
      '<circle cx="200" cy="200" r="176" fill="none" stroke="#16123A" stroke-width="5"/></svg>';
  }

  function artFor(type) {
    var box = document.createElement('span');
    box.className = 'spot-figure' + (type === 'master' ? ' spot-figure--duo' : '');
    if (type === 'master') {
      var chief = MP.charSVG('master', { variant: 'chief' });
      chief.classList.add('spot-chief');
      box.appendChild(chief);
    }
    box.appendChild(MP.charSVG(type, type === 'pridira' ? { expr: 'grumpy' } : {}));
    return box;
  }

  /* every card gets its small character art — static, no animation, so it is done as soon as the DOM is ready
     (independent of the scene lifecycle: the plain list stays illustrated even if the tab never boots) */
  function fillArt(root) {
    if (!MP.charSVG) return;
    MP.$$('.cast-card', root).forEach(function (li) {
      var art = MP.$('.cast-art', li);
      if (art && !art.querySelector('svg')) { var svg = MP.charSVG(li.getAttribute('data-char')); if (svg) art.appendChild(svg); }
    });
  }
  MP.ready(function () { var sec = document.getElementById('komanda'); if (sec) { fillArt(sec); upgrade(sec); } });

  function upgrade(section) {
    var cast = MP.$('.cast', section), ul = cast && MP.$('.cast-list', cast);
    if (!ul || !MP.charSVG) return null;
    var cards = MP.$$('.cast-card', ul);
    /* 1. every card gets its art */
    fillArt(section);
    if (cast.classList.contains('is-upgraded')) return cast;
    /* re-parenting the ul drops focus to <body>: remember what had it (and keep its card selected) */
    var active = document.activeElement, keep = active && active !== cast && cast.contains(active) ? active : null;
    var keepCard = keep && keep.closest ? keep.closest('.cast-card') : null;
    /* 2. roster (tablist) under a short hint */
    var pick = document.createElement('div');
    pick.className = 'cast-pick';
    pick.appendChild(MP.html('<p class="cast-hint"><svg class="ico" aria-hidden="true" focusable="false"><use href="#i-arrow-down"/></svg>Нажмите на любого героя</p>'));
    var ui = document.createElement('div');
    ui.className = 'cast-ui';
    var roster = document.createElement('div');
    roster.className = 'cast-roster';
    roster.setAttribute('role', 'tablist');
    roster.setAttribute('aria-label', 'Персонажи фабрики');
    GROUPS.forEach(function (g) {
      var grp = document.createElement('div');
      grp.className = 'cast-group cast-group--' + g[0];
      grp.setAttribute('role', 'presentation');
      grp.innerHTML = '<p class="cast-group-label" aria-hidden="true">' + g[1] + '</p><div class="cast-tabs" role="presentation"></div>';
      var tabs = MP.$('.cast-tabs', grp);
      cards.filter(function (li) { return li.getAttribute('data-group') === g[0]; }).forEach(function (li) {
        var id = li.getAttribute('data-char'), name = MP.$('.cast-name', li).textContent;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'cast-tab cast-tab--' + g[0];
        b.id = 'cast-tab-' + id;
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-controls', 'cast-panel');
        b.setAttribute('aria-label', name);
        b.setAttribute('data-char', id);
        b.setAttribute('data-name', name.replace(/^Автомат\s+/, ''));
        var art = MP.charSVG(id, id === 'sovetnik' ? {} : {});
        art.classList.add('cast-tab-art');
        b.appendChild(art);
        tabs.appendChild(b);
      });
      roster.appendChild(grp);
    });
    /* 3. spotlight (the single tabpanel) */
    var spot = document.createElement('div');
    spot.className = 'cast-spot';
    spot.id = 'cast-panel';
    spot.setAttribute('role', 'tabpanel');
    spot.innerHTML = '<div class="spot-stage">' + spotBackSVG() +
      '<button type="button" class="spot-poke"><span class="spot-art" aria-hidden="true"></span></button>' +
      '<p class="spot-bubble" aria-hidden="true"></p></div>';
    /* the text column: the (single visible) card + step buttons, so phones can walk the cast without the strip */
    var copy = document.createElement('div');
    copy.className = 'spot-copy';
    copy.appendChild(ul);
    copy.appendChild(MP.html('<div class="spot-nav">' +
      '<button type="button" class="spot-step spot-step--prev"><svg class="ico" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg>Назад</button>' +
      '<span class="spot-count" aria-hidden="true"></span>' +
      '<button type="button" class="spot-step spot-step--next">Дальше<svg class="ico" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg></button></div>'));
    spot.appendChild(copy);
    pick.appendChild(roster);
    ui.appendChild(pick);
    ui.appendChild(spot);
    cast.appendChild(ui);
    cast.classList.add('is-upgraded');
    var first = keepCard ? Math.max(0, tabsOf(cast).map(function (t) { return t.getAttribute('data-char'); }).indexOf(keepCard.getAttribute('data-char'))) : 0;
    select(cast, first, null);
    if (keep && document.activeElement !== keep && document.contains(keep)) {
      try { keep.focus({ preventScroll: true }); } catch (e) { keep.focus(); }
    }
    return cast;
  }

  /* ---------- state ---------- */
  function tabsOf(cast) { return MP.$$('.cast-tab', cast); }
  function current(cast) { var t = tabsOf(cast); for (var i = 0; i < t.length; i++) if (t[i].getAttribute('aria-selected') === 'true') return i; return 0; }

  /* select tab i. fx = {gsap, ctx} to animate, null = instant. Returns the new art element. */
  function select(cast, i, fx, opts) {
    opts = opts || {};
    var tabs = tabsOf(cast), tab = tabs[i];
    if (!tab) return;
    var id = tab.getAttribute('data-char'), prev = current(cast);
    var same = prev === i && tab.getAttribute('aria-selected') === 'true';
    tabs.forEach(function (t, k) {
      t.setAttribute('aria-selected', k === i ? 'true' : 'false');
      t.tabIndex = k === i ? 0 : -1;
    });
    var spot = MP.$('.cast-spot', cast), ul = MP.$('.cast-list', cast);
    spot.setAttribute('aria-labelledby', tab.id);
    spot.classList.toggle('is-you', id === 'vy');
    spot.setAttribute('data-char', id);
    MP.$$('.cast-card', ul).forEach(function (li) { li.hidden = li.getAttribute('data-char') !== id; });
    var name = MP.$('.cast-name', MP.$('.cast-card[data-char="' + id + '"]', ul)).textContent;
    var poke = MP.$('.spot-poke', spot);
    poke.setAttribute('aria-label', id === 'pridira' ? 'Придира, ещё придирку!' : name + ': что скажешь?');
    spot.removeAttribute('data-nit');
    var count = MP.$('.spot-count', spot);
    if (count) count.textContent = (i + 1) + ' из ' + tabs.length;
    if (opts.focus) tab.focus();
    if (same && !opts.force) return;
    var artBox = MP.$('.spot-art', spot), bubble = MP.$('.spot-bubble', spot);
    var fresh = artFor(id), olds = MP.$$('.spot-figure', artBox);
    artBox.appendChild(fresh);
    bubble.textContent = LINES[id] || '';
    var fills = MP.$('.spot-fills', spot);
    var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('class', 'spot-fill');
    circle.setAttribute('cx', '200'); circle.setAttribute('cy', '200'); circle.setAttribute('r', '178');
    circle.setAttribute('fill', BACK[id] || '#3EC5FF');
    fills.appendChild(circle);
    var oldFills = MP.$$('.spot-fill', fills).filter(function (c) { return c !== circle; });
    /* keep the strip scrolled to the selection (narrow screens) */
    var strip = MP.$('.cast-roster', cast);
    if (strip && strip.scrollWidth > strip.clientWidth + 4) {
      var left = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2;
      try { strip.scrollTo({ left: Math.max(0, left), behavior: fx ? 'smooth' : 'auto' }); } catch (e) { strip.scrollLeft = Math.max(0, left); }
    }
    if (!fx) {
      olds.forEach(function (o) { o.parentNode && o.parentNode.removeChild(o); });
      oldFills.forEach(function (c) { c.parentNode && c.parentNode.removeChild(c); });
      return fresh;
    }
    var gsap = fx.gsap;
    fx.ctx.add(function () {
      olds.forEach(function (o) {
        gsap.killTweensOf(o);
        gsap.to(o, { scaleY: 0.3, scaleX: 1.3, y: 18, autoAlpha: 0, duration: 0.18, ease: 'power2.in', transformOrigin: '50% 100%',
          onComplete: function () { o.parentNode && o.parentNode.removeChild(o); } });
      });
      gsap.fromTo(circle, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.5, ease: 'power3.out',
        onComplete: function () { oldFills.forEach(function (c) { c.parentNode && c.parentNode.removeChild(c); }); } });
      gsap.fromTo(fresh, { scale: 0, y: 30, autoAlpha: 0, transformOrigin: '50% 100%' },
        { scale: 1, y: 0, autoAlpha: 1, duration: 0.6, ease: 'back.out(2)', delay: 0.12 });
      gsap.fromTo(bubble, { scale: 0, autoAlpha: 0, transformOrigin: '88% 100%' }, { scale: 1, autoAlpha: 1, duration: 0.45, ease: 'back.out(2.5)', delay: 0.32 });
      var li = MP.$('.cast-card[data-char="' + id + '"]', ul);
      gsap.fromTo(li.children, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power3.out', stagger: 0.05, clearProps: 'transform,opacity' });
      if (fx.onArt) fx.onArt(fresh);
    });
    return fresh;
  }

  function wire(section, api, fx) {
    var cast = MP.$('.cast', section);
    if (!cast || !cast.classList.contains('is-upgraded')) return;
    var roster = MP.$('.cast-roster', cast), spot = MP.$('.cast-spot', cast), poke = MP.$('.spot-poke', spot);
    api.on(roster, 'click', function (e) {
      var b = e.target.closest && e.target.closest('.cast-tab');
      if (!b) return;
      select(cast, tabsOf(cast).indexOf(b), fx);
    });
    api.on(roster, 'keydown', function (e) {
      var tabs = tabsOf(cast), i = tabs.indexOf(document.activeElement), n = tabs.length;
      if (i < 0) return;
      var k = e.key, to = -1;
      if (k === 'ArrowRight' || k === 'ArrowDown') to = (i + 1) % n;
      else if (k === 'ArrowLeft' || k === 'ArrowUp') to = (i - 1 + n) % n;
      else if (k === 'Home') to = 0;
      else if (k === 'End') to = n - 1;
      if (to < 0) return;
      e.preventDefault();
      select(cast, to, fx, { focus: true });
    });
    /* Назад / Дальше: step through the whole cast (wraps), announce who is in the spotlight now */
    MP.$$('.spot-step', spot).forEach(function (btn) {
      api.on(btn, 'click', function () {
        var n = tabsOf(cast).length, to = (current(cast) + (btn.classList.contains('spot-step--prev') ? -1 : 1) + n) % n;
        select(cast, to, fx);
        var li = MP.$('.cast-card[data-char="' + tabsOf(cast)[to].getAttribute('data-char') + '"]', cast);
        api.live(MP.$('.cast-name', li).textContent + '. ' + MP.$('.cast-line', li).textContent);
      });
    });
    api.on(poke, 'click', function () {
      var id = spot.getAttribute('data-char'), bubble = MP.$('.spot-bubble', spot), line = LINES[id];
      if (id === 'pridira') {
        var n = ((+spot.getAttribute('data-nit') || 0) + 1) % NITPICKS.length;
        spot.setAttribute('data-nit', n);
        line = NITPICKS[n];
      }
      bubble.textContent = line;
      api.live(line);
      if (!fx) return;
      var fig = MP.$$('.spot-figure', spot).pop(), gsap = fx.gsap;
      fx.ctx.add(function () {
        gsap.fromTo(bubble, { scale: 0.6, transformOrigin: '88% 100%' }, { scale: 1, duration: 0.4, ease: 'back.out(3)', transformOrigin: '88% 100%' });
        if (!fig) return;
        gsap.timeline()
          .to(fig, { scaleY: 0.86, scaleX: 1.1, duration: 0.1, ease: 'power2.out', transformOrigin: '50% 100%' })
          .to(fig, { scaleY: 1.06, scaleX: 0.96, y: -26, duration: 0.2, ease: 'power2.out' })
          .to(fig, { scaleY: 1, scaleX: 1, y: 0, duration: 0.35, ease: 'bounce.out' });
        var arms = MP.$$('.c-arm-r', fig);
        if (arms.length) gsap.fromTo(arms, { rotation: -70, transformOrigin: '50% 50%' }, { rotation: -105, transformOrigin: '50% 50%', duration: 0.16, yoyo: true, repeat: 3, ease: 'sine.inOut',
          onComplete: function () { gsap.set(arms, { rotation: 0 }); } });
      });
    });
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

  /* built-state snapshot: final()/init() hard-restore the roster + spotlight chrome (GSAP reverts can leave inline
   * transforms behind) and re-render the current figure fresh. */
  function snap(root) {
    MP.$$('*', root).concat([root]).forEach(function (el) {
      el.__mp0 = { t: el.getAttribute('transform'), s: el.getAttribute('style') };
    });
  }
  function restore(cast) {
    var gsap = window.gsap;
    MP.$$('*', cast).concat([cast]).forEach(function (el) {
      var o = el.__mp0;
      if (!o || !el._gsap) return;
      if (gsap) gsap.killTweensOf(el);
      if (o.t == null) el.removeAttribute('transform'); else el.setAttribute('transform', o.t);
      if (o.s == null) el.removeAttribute('style'); else el.setAttribute('style', o.s);
      el.removeAttribute('data-svg-origin');
      try { delete el._gsap; } catch (e) { el._gsap = undefined; }
    });
    if (cast.classList.contains('is-upgraded')) select(cast, current(cast), null, { force: true });
  }

  MP.scene('komanda', {
    build: function (section) {
      var cast = upgrade(section);
      if (cast) snap(cast);
    },

    final: function (section, api) {
      var cast = upgrade(section);
      if (!cast) return;
      restore(cast);
      wire(section, api, null);
    },

    init: function (section, api) {
      var gsap = api.gsap, cast = upgrade(section);
      if (!cast) return;
      restore(cast);
      headIn(section, api);
      var spot = MP.$('.cast-spot', cast), tabs = tabsOf(cast), artBox = MP.$('.spot-art', spot);
      /* handler-created tweens live in a child context of the scene's matchMedia context (reverted with it);
         on revert, also reset any half-closed eyes left by the blink driver */
      var ctx = gsap.context(function () {
        return function () { gsap.set(MP.$$('.c-lid', spot), { clearProps: 'transform' }); };
      });
      var fx = { gsap: gsap, ctx: ctx };
      wire(section, api, fx);
      /* enter: avatars pop, the spotlight pops in with Бригадир (or whoever is selected). Opacity/transform only:
         the waiting tabs stay focusable and in the accessibility tree; focus arriving early finishes the intro at once. */
      var labels = MP.$$('.cast-group-label, .cast-hint', cast);
      gsap.set(tabs, { opacity: 0, scale: 0.3, y: 20 });
      gsap.set(labels, { opacity: 0, x: -12 });
      gsap.set(spot, { opacity: 0, y: 40, rotation: -2 });
      var tl = gsap.timeline({ paused: true }), entered = false;
      tl.to(labels, { opacity: 1, x: 0, duration: 0.4, stagger: 0.15 }, 0)
        .to(tabs, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'back.out(2)', stagger: 0.06 }, 0.05)
        .set(tabs, { clearProps: 'transform,opacity' }, 0.05 + tabs.length * 0.06 + 0.55)
        .set(labels, { clearProps: 'transform,opacity' }, 0.05 + tabs.length * 0.06 + 0.55)
        .to(spot, { opacity: 1, y: 0, rotation: 0, duration: 0.7, ease: 'back.out(1.6)' }, 0.2)
        .set(spot, { clearProps: 'transform,opacity' }, 0.95)
        .add(function () { select(cast, current(cast), fx, { force: true }); }, 0.45);
      window.ScrollTrigger.create({ trigger: cast, start: 'top 78%', once: true, onEnter: function () { if (!entered) { entered = true; tl.play(0); } } });
      api.on(cast, 'focusin', function () { if (!entered) { entered = true; tl.progress(1); } });
      /* idle (2 loops, both paused off screen): the sunburst turns slowly; whoever is in the spotlight blinks */
      api.loop(gsap.to(MP.$('.spot-rays', spot), { rotation: 360, svgOrigin: '200 210', duration: 60, ease: 'none', repeat: -1 }));
      var blinkNow = function () {
        var lids = MP.$$('.c-lid', artBox);
        if (lids.length) gsap.fromTo(lids, { scaleY: 1 }, { scaleY: 0.1, duration: 0.07, ease: 'power1.in', yoyo: true, repeat: 1, transformOrigin: '50% 50%' });
      };
      api.loop(gsap.timeline({ repeat: -1 }).to({}, { duration: 6.4 }, 0).call(blinkNow, null, 1.6).call(blinkNow, null, 4.3).call(blinkNow, null, 4.62));
    }
  });
})();
