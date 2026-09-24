/* bp-ui.js — «Схема» chrome around the canvas: toolbar (search, legend, help), document tabs, breadcrumbs,
 * stage bookmarks, Details panel (spec §7), tooltips, minimap, context menu, legend + shortcut dialogs,
 * preset banner and the hidden edit mode (Ctrl+Alt+E). Listens on the BPE bus; owns no graph state. */
(function () {
  'use strict';
  var MP = window.MP || {};
  var E = window.BPE;
  if (!E) return;
  var esc = E.esc, h = E.h, norm = E.norm, arr = E.arr;
  var ui = E.ui = { closed: {} };

  /* ---------------------------------------------------------------- small helpers */
  function catLabel(N) { return N.ci.ru + ' · ' + N.ci.ue; }
  function typeInfo(t) { return (E.D.types[t]) || { ru: t, ue: t, color: '#b8c0cc' }; }
  function tchip(t, isArr) {
    var T = typeInfo(t);
    return '<span class="bp-tchip' + (t === 'exec' ? ' is-exec' : '') + '" style="--pc:' + T.color + '"><i aria-hidden="true"></i>' + esc(T.ru) + (isArr ? ' [ ]' : '') + '<small>' + esc(T.ue) + '</small></span>';
  }
  function nchip(N, extra) {
    var G = N.graph;
    return '<button type="button" class="bp-nchip" data-g="' + esc(G.id) + '" data-n="' + esc(N.id) + '" style="--h1:' + N.ci.head[0] + '">' +
      '<i aria-hidden="true"></i><span>' + esc(N.title) + '</span>' + (extra ? '<small>' + esc(extra) + '</small>' : '') + '</button>';
  }
  function tierChip(m) {
    if (!m || !m.info) return '';
    return '<span class="bp-tier tier-' + m.info.l + '">' + m.info.l + '</span><span class="bp-tier-name">' + esc(m.info.ru) + '</span>';
  }
  function copyText(text, btn) {
    function done() { if (btn) { var o = btn.getAttribute('data-label') || btn.innerHTML; btn.setAttribute('data-label', o); btn.classList.add('is-done'); btn.innerHTML = E.icon('check') + 'Скопировано'; setTimeout(function () { btn.classList.remove('is-done'); btn.innerHTML = o; }, 1400); } }
    function fallback() {
      var ta = h('textarea', 'bp-copyta'); ta.value = text; ta.setAttribute('readonly', ''); E.root.appendChild(ta);
      ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      if (ok) { ta.remove(); done(); } else { ta.classList.add('is-visible'); ta.addEventListener('blur', function () { ta.remove(); }); ta.focus(); }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  ui.copyText = copyText;
  function sec(id, title, body, opts) {
    opts = opts || {};
    var closed = ui.closed[id] != null ? ui.closed[id] : !!opts.closed;
    return '<section class="bp-sec" data-sec="' + id + '"><h3 class="bp-sec-h"><button type="button" class="bp-sec-bar" aria-expanded="' + (!closed) + '">' +
      E.icon('chev') + '<span>' + esc(title) + '</span>' + (opts.count != null ? '<small>' + opts.count + '</small>' : '') + '</button></h3>' +
      '<div class="bp-sec-body"' + (closed ? ' hidden' : '') + '>' + body + '</div></section>';
  }
  function props(rows) {
    return '<dl class="bp-props">' + rows.filter(Boolean).map(function (r) { var w = r[2] ? ' class="is-wide"' : ''; return '<dt' + w + '>' + esc(r[0]) + '</dt><dd' + w + '>' + r[1] + '</dd>'; }).join('') + '</dl>';
  }
  function para(t) { return t ? '<p>' + esc(t) + '</p>' : ''; }
  function textBlock(v) {
    if (!v) return '';
    if (Array.isArray(v)) return '<ul class="bp-ul">' + v.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    return String(v).split(/\n{2,}/).map(para).join('');
  }

  /* ---------------------------------------------------------------- mount */
  E.on('mount', function (root) {
    ui.root = root;
    root.style.setProperty('--pin-inset', (E.D.M.PIN_INSET || 14) + 'px');
    buildToolbar(root);
    buildHud(root);
    buildDetails(root);
    buildTip();
    buildMinimap();
    buildIndex();
    bindGlobalKeys(root);
    try { var w = +localStorage.getItem('bp-dw'); if (w >= 300 && w <= 680) root.style.setProperty('--bp-dw', w + 'px'); } catch (e) {}
  });

  /* ---------------------------------------------------------------- toolbar */
  function buildToolbar(root) {
    var s = root.querySelector('.bp-tb-search');
    s.innerHTML = '<div class="bp-search" role="search">' + E.icon('search', 'bp-search-i') +
      '<input type="search" class="bp-search-in" placeholder="Поиск нод, агентов, файлов" aria-label="Поиск по всем графам" autocomplete="off" spellcheck="false" aria-controls="bp-search-list" aria-expanded="false" role="combobox" aria-autocomplete="list">' +
      '<kbd class="bp-kbd">/</kbd><div class="bp-search-list" id="bp-search-list" role="listbox" hidden></div></div>';
    var hp = root.querySelector('.bp-tb-help');
    hp.innerHTML = '<button type="button" class="bp-btn" data-act="legend" title="Легенда (L)">' + E.icon('legend') + '<span class="bp-lbl">Легенда</span></button>' +
      '<button type="button" class="bp-btn bp-btn--icon" data-act="keys" title="Клавиши (?)" aria-label="Клавиши и подсказки">' + E.icon('help') + '</button>';
    hp.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.getAttribute('data-act') === 'legend') openLegend(); else openKeys();
    });
    bindSearch(s.querySelector('.bp-search'));
  }

  /* ---------------------------------------------------------------- document tabs + crumbs + bookmarks */
  function renderTabs() {
    var nav = ui.root.querySelector('.bp-doctabs'), G = E.cur();
    if (!nav.childNodes.length) {
      nav.innerHTML = E.D.order.map(function (g) {
        return '<button type="button" class="bp-dtab" data-g="' + esc(g.id) + '">' + E.icon(g === E.D.root ? 'nodes' : 'graph') + '<span>' + esc(g.tab) + '</span><span class="bp-dtab-n">' + g.nodes.length + '</span></button>';
      }).join('');
      nav.addEventListener('click', function (e) {
        var b = e.target.closest('.bp-dtab'); if (!b) return;
        var id = b.getAttribute('data-g');
        if (!E.cur() || E.cur().id !== id) E.goGraph(id, {});
      });
    }
    Array.prototype.forEach.call(nav.querySelectorAll('.bp-dtab'), function (b) {
      var on = G && b.getAttribute('data-g') === G.id;
      if (on) { b.setAttribute('aria-current', 'page'); try { b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (x) {} } else b.removeAttribute('aria-current');
    });
  }
  function chain(G) {
    var out = [G], seen = {}; seen[G.id] = 1;
    var p = G.parent && E.D.graphs[G.parent];
    while (p && !seen[p.id]) { out.unshift(p); seen[p.id] = 1; p = p.parent && E.D.graphs[p.parent]; }
    return out;
  }
  function renderCrumbs() {
    var el = ui.root.querySelector('.bp-crumbs'), G = E.cur(); if (!G) return;
    var canBack = E.state.stack.length > 0 || !!G.parent;
    var c = chain(G);
    el.innerHTML = '<button type="button" class="bp-back" aria-label="Назад (Alt+↑)" title="Назад (Alt+↑ / Backspace)"' + (canBack ? '' : ' disabled') + '>' + E.icon('back') + '</button>' +
      '<nav class="bp-crumb" aria-label="Путь">' + c.map(function (g, i) {
        var last = i === c.length - 1;
        return (i ? '<span class="bp-crumb-sep" aria-hidden="true">›</span>' : '') +
          (last ? '<span class="bp-crumb-cur" aria-current="page">' + esc(g.tab) + '</span>' : '<button type="button" class="bp-crumb-a" data-g="' + esc(g.id) + '">' + esc(g.tab) + '</button>');
      }).join('') + '</nav>';
  }
  function renderMarks() {
    var el = ui.root.querySelector('.bp-marks'), G = E.cur(); if (!G) return;
    el.innerHTML = G.marks.map(function (C) {
      return '<button type="button" class="bp-mark" data-c="' + esc(C.id) + '" style="--cc:' + C.color + '" title="' + esc(C.title) + (C.key != null ? ' (клавиша ' + esc(C.key) + ')' : '') + '">' +
        '<i aria-hidden="true"></i><span>' + esc(C.title) + '</span></button>';
    }).join('');
    el.hidden = !G.marks.length;
  }
  function buildHud(root) {
    var hud = root.querySelector('.bp-hud');
    hud.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('.bp-back'))) { E.back(); return; }
      if ((b = e.target.closest('.bp-crumb-a'))) { E.goGraph(b.getAttribute('data-g'), {}); return; }
      if ((b = e.target.closest('.bp-mark'))) { E.selectComment(b.getAttribute('data-c'), {}); }
    });
    var ov = E.overlays;
    ov.insertAdjacentHTML('beforeend',
      '<div class="bp-zoomctl" role="group" aria-label="Масштаб">' +
        '<button type="button" class="bp-zb" data-z="out" aria-label="Отдалить (−)" title="Отдалить (−)"><svg class="bp-i" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3.5 8h9"/></svg></button>' +
        '<button type="button" class="bp-zb" data-z="in" aria-label="Приблизить (+)" title="Приблизить (+)"><svg class="bp-i" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3.5 8h9M8 3.5v9"/></svg></button>' +
        '<button type="button" class="bp-zb" data-z="fit" aria-label="Показать всё (F)" title="Показать всё (F)">' + E.icon('fit') + '</button>' +
      '</div>' +
      '<div class="bp-preset" hidden><span class="bp-preset-tag"></span><span class="bp-preset-t"></span><button type="button" class="bp-preset-x" aria-label="Скрыть режим">' + E.icon('close') + '</button></div>' +
      '<div class="bp-editbar" hidden><b>Режим правки</b><span>Перетаскивайте ноды · шаг 0,05</span><button type="button" class="bp-btn" data-edit="copy">' + E.icon('copy') + 'Скопировать at[]</button><button type="button" class="bp-btn bp-btn--icon" data-edit="close" aria-label="Выйти из режима правки">' + E.icon('close') + '</button></div>');
    ov.querySelector('.bp-zoomctl').addEventListener('click', function (e) {
      var b = e.target.closest('[data-z]'); if (!b) return;
      var G = E.cur(); if (!G) return;
      var z = b.getAttribute('data-z');
      if (z === 'fit') E.fit();
      else E.flyTo(zoomCam(G.cam, z === 'in' ? 1.25 : 0.8), 0.25);
    });
    ov.querySelector('.bp-preset-x').addEventListener('click', function () { E.setPreset(null); });
    ov.querySelector('.bp-editbar').addEventListener('click', function (e) {
      var b = e.target.closest('[data-edit]'); if (!b) return;
      if (b.getAttribute('data-edit') === 'close') toggleEdit(false); else copyText(editDump(), b);
    });
  }
  function zoomCam(c, f) {
    var v = E.view(), k = E.clamp(c.k * f, 0.08, 2), cx = (E.vw - v.r) / 2, cy = (E.vh + v.t - v.b) / 2;
    var wx = (cx - c.x) / c.k, wy = (cy - c.y) / c.k;
    return { x: cx - wx * k, y: cy - wy * k, k: k };
  }
  E.on('graph', function (G) {
    renderTabs(); renderCrumbs(); renderMarks();
    ui.renderDetails();
    mmReset(G);
    mm.cam0 = G.cam ? { x: G.cam.x, y: G.cam.y, k: G.cam.k } : null;
    if (E.editing) toggleEdit(false);
  });
  E.on('preset', function (P) {
    var el = E.overlays.querySelector('.bp-preset');
    if (!P || !P.banner) { el.hidden = true; if (ui.dscroll) ui.renderDetails(); return; }
    ui.renderDetails();
    el.querySelector('.bp-preset-tag').textContent = P.title || P.name;
    el.querySelector('.bp-preset-t').textContent = P.banner;
    el.hidden = false;
  });

  /* ---------------------------------------------------------------- details panel (spec §7) */
  function buildDetails(root) {
    var aside = root.querySelector('.bp-details');
    aside.innerHTML = '<div class="bp-dt-resize" role="separator" aria-orientation="vertical" aria-label="Ширина панели деталей" tabindex="-1"></div>' +
      '<div class="bp-dt-top"><span class="bp-dt-tab">' + E.icon('legend') + 'Детали</span><button type="button" class="bp-dt-close bp-btn bp-btn--icon" aria-label="Закрыть детали">' + E.icon('close') + '</button></div>' +
      '<div class="bp-dt-scroll bp-scroll"></div>';
    ui.aside = aside;
    ui.dscroll = aside.querySelector('.bp-dt-scroll');
    aside.addEventListener('click', onDetailsClick);
    aside.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var G = E.cur(), N = G && G.sel && G.byId[G.sel];
        e.preventDefault();
        if (N && N.el) try { N.el.focus({ preventScroll: true }); } catch (x) { N.el.focus(); } else E.canvas.focus();
        root.classList.remove('dt-open');
      }
    });
    aside.querySelector('.bp-dt-close').addEventListener('click', function () {
      root.classList.remove('dt-open');
      var G = E.cur(); if (G && G.sel) E.select(null);
      E.canvas.focus();
    });
    // resizer
    var rz = aside.querySelector('.bp-dt-resize'), drag = null;
    rz.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, w: aside.getBoundingClientRect().width }; rz.setPointerCapture(e.pointerId); root.classList.add('is-resizing'); });
    rz.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var w = E.clamp(drag.w - (e.clientX - drag.x), 300, 680);
      root.style.setProperty('--bp-dw', Math.round(w) + 'px');
    });
    function up() { if (!drag) return; drag = null; root.classList.remove('is-resizing'); try { localStorage.setItem('bp-dw', parseInt(getComputedStyle(root).getPropertyValue('--bp-dw'), 10)); } catch (x) {} }
    rz.addEventListener('pointerup', up); rz.addEventListener('pointercancel', up);
    rz.addEventListener('dblclick', function () { root.style.setProperty('--bp-dw', '400px'); try { localStorage.removeItem('bp-dw'); } catch (x) {} });
  }
  function onDetailsClick(e) {
    var b;
    if ((b = e.target.closest('.bp-sec-bar'))) {
      var body = b.parentNode.nextElementSibling, open = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', String(!open)); body.hidden = open;
      ui.closed[b.closest('.bp-sec').getAttribute('data-sec')] = open;
      return;
    }
    if ((b = e.target.closest('.bp-nchip'))) { E.jump(b.getAttribute('data-g'), b.getAttribute('data-n'), {}); return; }
    if ((b = e.target.closest('[data-copy]'))) { copyText(b.getAttribute('data-copy'), b); return; }
    if ((b = e.target.closest('[data-opengraph]'))) {
      var G = E.cur(), N = G.byId[b.getAttribute('data-opengraph')]; if (N) E.open(N); return;
    }
    if ((b = e.target.closest('[data-gograph]'))) { E.goGraph(b.getAttribute('data-gograph'), { entry: true }); return; }
    if ((b = e.target.closest('[data-cmt]'))) { E.selectComment(b.getAttribute('data-cmt'), {}); return; }
    if ((b = e.target.closest('[data-simshow]'))) { E.emit('simShow', b.getAttribute('data-simshow'), +b.getAttribute('data-step')); return; }
    if ((b = e.target.closest('[data-simplay]'))) { E.emit('simLoad', b.getAttribute('data-simplay'), { play: true }); }
  }

  function codexNote(c) {
    if (!c) return '';
    if (String(c).length > 24) return String(c);
    var s = norm(c);
    if (/toml|native|subagent/.test(s)) return 'Codex: нативный субагент (.codex/agents/*.toml)';
    if (/inline|main|session/.test(s)) return 'Codex: выполняется в главной сессии';
    if (/skill|bridge/.test(s)) return 'Codex: через skill-мост mp-dev';
    if (/none|claude-only|no/.test(s)) return 'Codex: только Claude Code';
    return 'Codex: ' + c;
  }
  function flagText(f) {
    if (E.D.flags && E.D.flags[f]) return E.D.flags[f];
    var s = norm(f);
    if (/^read-?only|readonly|reads/.test(s)) return 'Только читает (по контракту)';
    if (/commit/.test(s)) return 'Делает коммит';
    if (/no-?bash|nobash/.test(s)) return 'Запускает Bash: нет — тесты запускает runner-android.sh';
    if (/push/.test(s)) return 'Пушит в git';
    if (/network|net/.test(s)) return 'Ходит в сеть';
    if (/multimodal|images?/.test(s)) return 'Смотрит изображения';
    return f;
  }
  function executorRows(N) {
    var rows = [], c = N.cat, d = N.d || {};
    if (c === 'AG') {
      rows.push(['Модель', N.model ? '<span class="bp-model">' + tierChip(N.model) + '<code>' + esc(N.model.id) + '</code></span>' : '<span class="bp-mut">не указана</span>']);
      if (N.tech) rows.push(['Агент', '<code>' + esc(N.tech) + '</code>']);
    } else if (c === 'SC' || c === 'PS') rows.push(['Модель', 'нет — детерминированный bash, 0 токенов']);
    else if (c === 'MS' || c === 'PR') rows.push(['Модель', 'главная сессия' + (N.model && N.model.info ? ' · ' + tierChip(N.model) : '')]);
    else if (c === 'HG') rows.push(['Кто', 'человек — ответ в чате']);
    else if (E.FLOW[c]) rows.push(['Кто', 'управление потоком, без исполнителя']);
    else if (c === 'VA') rows.push(['Что', N.isSet ? 'файл или артефакт — сюда пишут' : 'файл или артефакт — отсюда читают']);
    else if (c === 'CP' || c === 'CL') rows.push(['Что', c === 'CP' ? 'составной граф: внутри своя цепочка' : 'свёрнутая группа нод']);
    else if (c === 'EV') rows.push(['Что', 'событие: отсюда начинается выполнение']);
    else if (c === 'IN' || c === 'RT') rows.push(['Что', c === 'IN' ? 'вход составного графа' : 'выход составного графа']);
    else if (c === 'END') rows.push(['Что', 'остановка конвейера']);
    if (N.tools.length) rows.push(['Инструменты', '<span class="bp-tools">' + N.tools.map(function (t) { return '<span class="bp-tool">' + esc(t) + '</span>'; }).join('') + '</span>']);
    var caps = [], flagCaps = [];
    N.flags.forEach(function (f) { var t = flagText(f); if ((c === 'SC' || c === 'PS') && /0 токенов/.test(t)) return; if (flagCaps.indexOf(t) < 0) flagCaps.push(t); });
    var fl = norm(flagCaps.join(' | '));
    if (c === 'AG' && N.tools.length) {
      // derived from tools, unless an explicit flag already says it
      var edits = N.tools.some(function (t) { return /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(t); });
      var bash = N.tools.indexOf('Bash') >= 0;
      if (!/правит файлы|только читает/.test(fl)) caps.push('Правит файлы: ' + (edits ? 'да' : 'нет'));
      if (!/bash/.test(fl)) caps.push('Запускает Bash: ' + (bash ? 'да' : 'нет' + (/tester|test/.test(N.tech) ? ' — тесты запускает runner-android.sh' : '')));
    }
    flagCaps.forEach(function (t) { if (caps.indexOf(t) < 0) caps.push(t); });
    arr(d.caps).forEach(function (t) { caps.push(t); });
    if (caps.length) rows.push(['Возможности', '<ul class="bp-ul bp-caps">' + caps.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>', caps.join('').length > 70]);
    if (N.codex || N.codexModel) {
      var cm = N.codexModel ? '<span class="bp-cxm mono">' + esc([N.codexModel.model, N.codexModel.effort ? 'effort ' + N.codexModel.effort : '', N.codexModel.sandbox || ''].filter(Boolean).join(' · ')) + '</span>' : '';
      rows.push(['Codex', cm + (N.codex ? '<span class="bp-cx">' + esc(codexNote(N.codex)) + '</span>' : ''), String(codexNote(N.codex || '')).length > 40]);
    }
    return rows;
  }
  function pinsBlock(N) {
    function rowsFor(side) {
      return N.pins[side].map(function (p) {
        var peers = p.wires.map(function (W) { return side === 'in' ? W.A : W.B; });
        var seen = {}; peers = peers.filter(function (x) { if (seen[x.id]) return false; seen[x.id] = 1; return true; });
        var lbl = p.l || (p.t === 'exec' ? (side === 'in' ? 'вход' : 'выход') : typeInfo(p.t).ru);
        return '<li class="bp-io-row"><span class="bp-io-l">' + esc(lbl) + '</span>' + tchip(p.t, p.arr) +
          '<span class="bp-io-peers">' + (peers.length ? peers.map(function (x) { return nchip(x); }).join('') : '<span class="bp-mut">не подключено</span>') + '</span></li>';
      }).join('');
    }
    var s = '';
    if (N.pins['in'].length) s += '<h4 class="bp-io-h">Входы</h4><ul class="bp-io">' + rowsFor('in') + '</ul>';
    if (N.pins.out.length) s += '<h4 class="bp-io-h">Выходы</h4><ul class="bp-io">' + rowsFor('out') + '</ul>';
    if (N.sample) {
      var sample = typeof N.sample === 'string' ? N.sample : JSON.stringify(N.sample);
      s += '<figure class="bp-sample"><figcaption>Пример вывода · <em>пример, не реальные данные</em></figcaption><pre class="bp-code"><code>' + esc(sample) + '</code></pre></figure>';
    }
    return s || '<p class="bp-mut">Пинов нет.</p>';
  }
  function orderText(N) {
    var d = N.d || {}, out = [];
    if (d.order) out.push(esc(d.order));
    var preds = [], par = [];
    N.inW.forEach(function (W) {
      if (!W.exec || W.kind === 'loop') return;
      if (preds.indexOf(W.A) < 0) preds.push(W.A);
      if (W.A.cat === 'PA') W.A.outW.forEach(function (X) { if (X.exec && X.B !== N && par.indexOf(X.B) < 0) par.push(X.B); });
    });
    if (preds.length) out.push('После: ' + preds.map(function (x) { return nchip(x); }).join(''));
    if (par.length) out.push('Одновременно с: ' + par.map(function (x) { return nchip(x); }).join(''));
    var succ = [];
    N.outW.forEach(function (W) { if (W.exec && W.kind !== 'loop' && succ.indexOf(W.B) < 0) succ.push(W.B); });
    if (succ.length) out.push('Дальше: ' + succ.map(function (x) { return nchip(x); }).join(''));
    if (N.cond) out.push('Условно: <b>' + esc(N.cond) + '</b>');
    if (N.fallback) out.push('Запасной путь: ' + esc(N.fallback));
    N.inW.forEach(function (W) { if (W.kind === 'loop') out.push('Повторяется по петле от ' + nchip(W.A) + (W.badge ? ' · ' + esc(W.badge) : '')); });
    if (N.badge && N.cat !== 'HG') out.push('Запуск: ' + esc(N.badge));
    if (N.instances > 1) out.push('Экземпляров одновременно: ' + N.instances);
    return out.map(function (x) { return '<p class="bp-order">' + x + '</p>'; }).join('');
  }
  function humanText(N) {
    var b = N.badge || '', d = N.d || {}, s = '';
    if (/HARD/.test(b)) s = '<p><span class="bp-badge hard">HARD STOP</span> Без явного «y» от человека ничего не происходит — даже в режиме --unattended.</p>';
    else if (/unattended/.test(b)) s = '<p><span class="bp-badge">--unattended: авто Y</span> Обычно ждёт человека; в режиме --unattended отвечает «Y» сам.</p>';
    else s = '<p><span class="bp-badge">всегда ждёт</span> Конвейер стоит, пока человек не ответит.</p>';
    if (d.human && !/^(всегда ждёт|hard stop|--unattended)/i.test(d.human)) s += para(d.human);
    return s;
  }
  function srcBlock(N) {
    var paths = N.srcPaths.concat(N.also);
    if (!paths.length) return '';
    var prefix = false;
    var s = '<ul class="bp-src">' + paths.map(function (p, i) {
      if (/\{\{PREFIX\}\}/.test(p)) prefix = true;
      var url = E.D.repoBlob + encodeURI(p).replace(/#/g, '%23');
      return '<li><code class="bp-path">' + esc(p) + '</code>' + (i >= N.srcPaths.length ? '<small class="bp-mut">контракт</small>' : '') +
        '<span class="bp-src-act"><button type="button" class="bp-mini" data-copy="' + esc(p) + '" aria-label="Скопировать путь ' + esc(p) + '">' + E.icon('copy') + '</button>' +
        '<a class="bp-mini bp-gh" href="' + esc(url) + '" target="_blank" rel="noopener">GitHub ' + E.icon('ext') + '</a></span></li>';
    }).join('') + '</ul>';
    if (prefix) s += '<p class="bp-note">' + (E.D.prefixNote ? esc(E.D.prefixNote).replace('{{PREFIX}}', '<code>{{PREFIX}}</code>') : '<code>{{PREFIX}}</code> в имени файла шаблона: mp — префикс по умолчанию.') + '</p>';
    return s;
  }
  function innerBlock(N) {
    return '<ul class="bp-inner">' + N.inner.map(function (x) {
      if (typeof x === 'string') {
        var d = E.D.defs[x];
        var m = d && d.model ? E.TIERS[String(d.model.tier || '').toLowerCase()] : null;
        return '<li>' + (m ? '<span class="bp-tier tier-' + m.l + '">' + m.l + '</span>' : '<span class="bp-inner-dot"></span>') + '<span><b>' + esc(d ? d.title : x) + '</b> <code>' + esc(d ? (d.tech || x) : x) + '</code></span></li>';
      }
      x = x || {};
      var url = x.src ? E.D.repoBlob + encodeURI(x.src) : '';
      return '<li><span class="bp-inner-dot is-sc"></span><span><code>' + esc(x.tech || x.id || '') + '</code>' + (x.note ? ' — ' + esc(x.note) : '') +
        (url ? ' <a class="bp-mini bp-gh" href="' + esc(url) + '" target="_blank" rel="noopener">GitHub ' + E.icon('ext') + '</a>' : '') + '</span></li>';
    }).join('') + '</ul>';
  }
  function relatedBlock(N) {
    var list = [], seen = {};
    seen[N.graph.id + '/' + N.id] = 1;
    function add(M, why) { var k = M.graph.id + '/' + M.id; if (seen[k]) return; seen[k] = 1; list.push(nchip(M, why)); }
    E.instancesOf(N).forEach(function (M) { add(M, M.graph === N.graph ? 'экземпляр' : M.graph.tab); });
    N.related.forEach(function (r) {
      var ref = String(r), gi = ref.indexOf('/'), g = gi > 0 ? E.D.graphs[ref.slice(0, gi)] : null, id = gi > 0 ? ref.slice(gi + 1) : ref;
      var M = g ? g.byId[id] : N.graph.byId[id];
      if (!M) E.D.order.some(function (G2) { M = G2.byId[id]; return !!M; });
      if (M) add(M, M.graph === N.graph ? '' : M.graph.tab);
    });
    if (E.isComposite(N)) {
      var T = E.D.graphs[N.opens];
      list.push('<button type="button" class="bp-nchip is-graph" data-gograph="' + esc(T.id) + '">' + E.icon('graph') + '<span>Граф «' + esc(T.tab) + '»</span></button>');
    }
    return list.join('');
  }
  function detailsNode(G, N) {
    var d = N.d || {}, s = '';
    var inst = '';
    if (N.id.indexOf('@') > 0) inst = 'Экземпляр ' + (N.defId || N.id.split('@')[0]) + ': та же роль, другой вызов';
    else if (N.instances > 1) inst = '×' + N.instances + ' экземпляра работают одновременно';
    else if (E.instancesOf(N).length > 1) {
      var more = E.instancesOf(N).length - 1;
      inst = 'Та же роль ещё в ' + more + ' ' + (more === 1 ? 'месте' : 'местах') + ' — см. «Связанные ноды»';
    }
    s += '<header class="bp-dt-head" style="--h1:' + N.ci.head[0] + ';--h2:' + N.ci.head[1] + '">' +
      '<div class="bp-dt-kicker"><span class="bp-dt-ico">' + E.icon(N.ci.icon) + '</span><span>' + esc(catLabel(N)) + '</span></div>' +
      '<h2 class="bp-dt-title" tabindex="-1">' + esc(N.title) + '</h2>' +
      '<div class="bp-dt-id"><code>' + esc(N.tech || N.id) + '</code>' + (N.tech && N.tech !== N.id ? '<span class="bp-mut mono">#' + esc(N.id) + '</span>' : '') + '</div>' +
      (inst ? '<div class="bp-dt-inst">' + esc(inst) + '</div>' : '') +
      (N.note ? '<p class="bp-dt-note">' + esc(N.note) + '</p>' : '') +
      presetNote(N) +
      (E.isComposite(N) ? '<button type="button" class="bp-btn bp-btn--primary bp-dt-open" data-opengraph="' + esc(N.id) + '">' + E.icon('graph') + 'Открыть граф ' + E.icon('open') + '</button>' : '') +
      '</header>';
    s += sec('exec', 'Исполнитель', props(executorRows(N)));
    var what = textBlock(d.what) + textBlock(d.why);
    if (N.cat === 'CL' && d.internals) what += '<h4 class="bp-io-h">Внутри</h4>' + textBlock(d.internals);
    if (N.inner.length) what += '<h4 class="bp-io-h">Внутри</h4>' + innerBlock(N);
    if (what) s += sec('what', 'Что делает', what);
    s += sec('io', 'Входы / Выходы', pinsBlock(N), { count: N.pins['in'].length + N.pins.out.length });
    var stops = textBlock(d.stops);
    if (N.cat === 'END' && !stops) stops = '<p>Здесь конвейер останавливается: «' + esc(N.title) + '».</p>';
    if (stops) s += sec('stops', 'Когда останавливается', stops);
    var ord = orderText(N);
    if (ord) s += sec('order', 'Порядок', ord);
    if (N.cat === 'HG') s += sec('human', 'Человек', humanText(N));
    var src = srcBlock(N);
    if (src) s += sec('src', 'Исходники', src);
    var rel = relatedBlock(N);
    if (rel) s += sec('rel', 'Связанные ноды', '<div class="bp-chips">' + rel + '</div>');
    var hit = E.simFind ? E.simFind(N) : null;
    s += '<footer class="bp-dt-foot">' + (hit ? '<button type="button" class="bp-btn bp-btn--primary" data-simshow="' + esc(hit.id) + '" data-step="' + hit.step + '">' + E.icon('play') + 'Показать в симуляции</button><small class="bp-mut">«' + esc(hit.title) + '», шаг ' + (hit.step + 1) + '</small>' : '<small class="bp-mut">Эта нода не встречается в учебных симуляциях.</small>') + '</footer>';
    return s;
  }
  function presetNote(N) {
    var P = E.state.preset;
    if (!P || P.G !== N.graph || !P.notes || !P.notes[N.id]) return '';
    return '<p class="bp-dt-preset"><span class="bp-preset-tag">' + esc(P.title || P.name) + '</span>' + esc(P.notes[N.id]) + '</p>';
  }
  function detailsComment(G, C) {
    var models = {}, gates = 0, agents = 0, scripts = 0;
    C.nodes.forEach(function (N) {
      if (N.cat === 'HG') gates++;
      if (N.cat === 'AG') agents++;
      if (N.cat === 'SC' || N.cat === 'PS') scripts++;
      if (N.model && N.model.info) models[N.model.info.l] = (models[N.model.info.l] || 0) + 1;
    });
    var s = '<header class="bp-dt-head is-cmt" style="--cc:' + C.color + '"><div class="bp-dt-kicker"><span class="bp-dt-sw"></span><span>Этап · Comment</span></div>' +
      '<h2 class="bp-dt-title" tabindex="-1">' + esc(C.title) + '</h2></header>';
    if (C.d) s += sec('cwhat', 'Зачем этот этап', textBlock(C.d));
    s += sec('cstat', 'Сводка', props([
      ['Ноды', String(C.nodes.length)], ['Агенты', String(agents)], ['Скрипты', String(scripts)],
      ['Гейты человека', gates ? String(gates) : 'нет'],
      Object.keys(models).length ? ['Модели', '<span class="bp-tiers">' + ['H', 'S', 'O'].filter(function (k) { return models[k]; }).map(function (k) { return '<span class="bp-tier tier-' + k + '">' + k + '</span>×' + models[k]; }).join(' ') + '</span>'] : null
    ]));
    s += sec('cnodes', 'Ноды этапа', '<div class="bp-chips">' + C.nodes.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; }).map(function (N) { return nchip(N); }).join('') + '</div>');
    return s;
  }
  function detailsGraph(G) {
    var st = G.stats;
    var s = '<header class="bp-dt-head is-graph"><div class="bp-dt-kicker"><span class="bp-dt-ico">' + E.icon('nodes') + '</span><span>Граф</span></div>' +
      '<h2 class="bp-dt-title" tabindex="-1">' + esc(G.title) + '</h2><div class="bp-dt-id"><code>' + esc(G.id) + '</code></div></header>';
    if (G.desc) s += '<div class="bp-dt-lead">' + textBlock(G.desc) + '</div>';
    s += '<div class="bp-stats">' + [['нода', 'ноды', 'нод', st.nodes], ['связь', 'связи', 'связей', st.wires], ['агент', 'агента', 'агентов', st.agents], ['скрипт', 'скрипта', 'скриптов', st.scripts], ['гейт', 'гейта', 'гейтов', st.gates]].map(function (r) {
      var w = E.plural(r[3], r[0], r[1], r[2]).split(' ').slice(1).join(' ');
      return '<div class="bp-stat"><b>' + r[3] + '</b><span>' + w + '</span></div>';
    }).join('') + '</div>';
    var tiers = ['haiku', 'sonnet', 'opus'].filter(function (t) { return st.models[t]; });
    if (tiers.length) s += '<p class="bp-dt-models">' + tiers.map(function (t) { var T = E.TIERS[t]; return '<span class="bp-tier tier-' + T.l + '">' + T.l + '</span> ' + T.ru + ' ×' + st.models[t]; }).join('<span class="bp-dot">·</span>') + '</p>';
    s += '<div class="bp-dt-sims"></div>';
    if (G.marks.length) s += sec('gstages', 'Этапы', '<ol class="bp-stages">' + G.marks.map(function (C) {
      return '<li><button type="button" class="bp-stage" data-cmt="' + esc(C.id) + '" style="--cc:' + C.color + '"><i aria-hidden="true"></i><span>' + esc(C.title) + '</span><small>' + C.nodes.length + '</small></button></li>';
    }).join('') + '</ol>');
    s += sec('ghow', 'Как смотреть', '<ul class="bp-ul bp-how">' +
      '<li>Щелчок по ноде — детали здесь; двойной щелчок по составной — открыть её граф.</li>' +
      '<li>Колесо — масштаб, перетаскивание — сдвиг; <kbd>F</kbd> — показать всё, <kbd>0</kbd> — 1:1.</li>' +
      '<li>Белые стрелки — порядок выполнения, цветные — данные. Пунктир — петля, точки — запасной путь.</li>' +
      '<li><kbd>/</kbd> — поиск по всем графам, <kbd>L</kbd> — легенда, <kbd>?</kbd> — все клавиши.</li></ul>', { closed: false });
    return s;
  }
  ui.detailsNode = detailsNode;
  ui.renderDetails = function (opts) {
    var G = E.cur(); if (!G || !ui.dscroll) return;
    var N = G.sel && G.byId[G.sel], C = G.selCmt && G.cById[G.selCmt];
    var html = N ? detailsNode(G, N) : C ? detailsComment(G, C) : detailsGraph(G);
    ui.dscroll.innerHTML = html;
    ui.dscroll.scrollTop = 0;
    ui.aside.classList.toggle('is-empty', !N && !C);
    if (!N && !C) E.emit('detailsGraph', ui.dscroll.querySelector('.bp-dt-sims'), G);
    if (MP.nbsp) try { MP.nbsp(ui.dscroll); } catch (e) {}
  };
  E.on('select', function (G, N, opts) {
    ui.renderDetails();
    ui.root.classList.toggle('dt-open', !!N);
    if (N && opts && opts.focusDetails) focusDetails();
  });
  E.on('selectComment', function () { ui.renderDetails(); ui.root.classList.add('dt-open'); });
  function focusDetails() {
    var t = ui.dscroll.querySelector('.bp-dt-title');
    if (t) try { t.focus({ preventScroll: false }); } catch (e) { t.focus(); }
  }
  ui.focusDetails = focusDetails;

  /* ---------------------------------------------------------------- tooltips */
  var tip, tipTimer = 0, tipKey = '';
  function buildTip() {
    tip = h('div', 'bp-tip'); tip.setAttribute('role', 'tooltip'); tip.hidden = true;
    E.overlays.appendChild(tip);
  }
  function hideTip() { clearTimeout(tipTimer); tipKey = ''; if (tip) tip.hidden = true; }
  E.on('tipHide', hideTip);
  E.on('gesture', hideTip);
  E.on('hover', function (e) {
    var G = E.cur(); if (!G || !tip) return;
    var t = e.target, key = '', html = '';
    var pinEl = t.closest && t.closest('.bp-pin'), hitEl = t.closest && t.closest('.bp-wh'), nodeEl = t.closest && t.closest('.bp-node');
    if (pinEl && nodeEl) {
      var N = nodeEl._N, pp = pinEl.getAttribute('data-pin').split(':'), side = pp[0], pid = pp.slice(1).join(':');
      var p = N.pins[side].filter(function (x) { return x.id === pid; })[0];
      if (p) {
        key = 'p:' + N.id + ':' + side + ':' + pid;
        var T = typeInfo(p.t);
        var peers = p.wires.map(function (W) { return side === 'in' ? W.A.title : W.B.title; });
        html = '<div class="bp-tip-h">' + tchip(p.t, p.arr) + '<b>' + esc(p.l || (p.t === 'exec' ? (side === 'in' ? 'вход' : 'выход') : T.ru)) + '</b></div>' +
          '<div class="bp-tip-m">' + (side === 'in' ? 'вход' : 'выход') + ' · ' + esc(T.ue) + (p.arr ? ' · массив' : '') + '</div>' +
          (p.tip ? '<div class="bp-tip-d">' + esc(p.tip) + '</div>' : '') +
          '<div class="bp-tip-d">' + (peers.length ? (side === 'in' ? 'от: ' : 'к: ') + esc(peers.join(', ')) : 'не подключено') + '</div>';
      }
    } else if (hitEl) {
      var W = G.wires[+hitEl.getAttribute('data-w')];
      if (W) {
        key = 'w:' + W.i;
        var kl = E.wireKindLabel(W);
        html = '<div class="bp-tip-h">' + tchip(W.type, W.from.arr) + (kl ? '<span class="bp-tip-k k-' + W.kind + '">' + esc(kl) + '</span>' : '') + '</div>' +
          '<div class="bp-tip-d"><b>' + esc(W.A.title) + '</b>' + (W.from.l ? ' · ' + esc(W.from.l) : '') + ' → <b>' + esc(W.B.title) + '</b>' + (W.to.l ? ' · ' + esc(W.to.l) : '') + '</div>' +
          (W.badge ? '<div class="bp-tip-m">' + esc(W.badge) + '</div>' : '') +
          '<div class="bp-tip-m mono">' + esc(W.id) + '</div>';
      }
    } else if (nodeEl && (E.canvas.classList.contains('lod-far') || E.canvas.classList.contains('lod-mid'))) {
      var M = nodeEl._N;
      key = 'n:' + M.id;
      html = '<div class="bp-tip-h"><b>' + esc(M.title) + '</b></div><div class="bp-tip-m">' + esc(catLabel(M)) + (M.tech ? ' · <span class="mono">' + esc(M.tech) + '</span>' : '') + '</div>';
    }
    var r = E.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (!key) { hideTip(); return; }
    if (key === tipKey && !tip.hidden) { place(x, y); return; }
    clearTimeout(tipTimer);
    tipKey = key;
    tipTimer = setTimeout(function () { tip.innerHTML = html; tip.hidden = false; place(x, y); }, tip.hidden ? 260 : 60);
  });
  function place(x, y) {
    var w = tip.offsetWidth, hh = tip.offsetHeight;
    var left = x + 16, top = y + 18;
    if (left + w > E.vw - 8) left = x - w - 12;
    if (top + hh > E.vh - 8) top = y - hh - 12;
    tip.style.transform = 'translate(' + Math.max(6, left) + 'px,' + Math.max(6, top) + 'px)';
  }

  /* ---------------------------------------------------------------- minimap */
  var mm = { el: null, ctx: null, G: null, base: null, s: 1, ox: 0, oy: 0, W: 200, H: 120, drag: false };
  function buildMinimap() {
    var c = h('canvas', 'bp-minimap');
    c.setAttribute('aria-hidden', 'true');
    c.classList.add('is-idle'); // the landing view stays clean: the minimap fades in once the camera moves
    c.width = mm.W * dpr(); c.height = mm.H * dpr();
    E.overlays.appendChild(c);
    mm.el = c; mm.ctx = c.getContext('2d');
    function go(e) {
      var r = c.getBoundingClientRect(), G = E.cur(); if (!G || !G.cam) return;
      var wx = (e.clientX - r.left - mm.ox) / mm.s, wy = (e.clientY - r.top - mm.oy) / mm.s;
      E.killCam();
      G.cam.x = E.vw / 2 - wx * G.cam.k; G.cam.y = E.vh / 2 - wy * G.cam.k;
      E.markMoving(); E.requestApply();
    }
    c.addEventListener('pointerdown', function (e) { mm.drag = true; c.setPointerCapture(e.pointerId); go(e); e.stopPropagation(); });
    c.addEventListener('pointermove', function (e) { if (mm.drag) go(e); });
    c.addEventListener('pointerup', function () { mm.drag = false; });
    c.addEventListener('pointercancel', function () { mm.drag = false; });
  }
  function dpr() { return Math.min(2, window.devicePixelRatio || 1); }
  function mmReset(G) {
    if (!mm.el || !G) return;
    mm.G = G;
    var b = G.bounds, pad = 8;
    mm.s = Math.min((mm.W - pad * 2) / b.w, (mm.H - pad * 2) / b.h);
    mm.ox = (mm.W - b.w * mm.s) / 2 - b.x * mm.s; mm.oy = (mm.H - b.h * mm.s) / 2 - b.y * mm.s;
    var base = document.createElement('canvas'), r = dpr();
    base.width = mm.W * r; base.height = mm.H * r;
    var x = base.getContext('2d');
    x.scale(r, r);
    G.comments.forEach(function (C) {
      x.fillStyle = hexA(C.color, 0.16); x.strokeStyle = hexA(C.color, 0.45); x.lineWidth = 1;
      x.fillRect(mm.ox + C.x * mm.s, mm.oy + C.y * mm.s, C.w * mm.s, C.h * mm.s);
      x.fillStyle = hexA(C.color, 0.8); x.fillRect(mm.ox + C.x * mm.s, mm.oy + C.y * mm.s, C.w * mm.s, Math.max(1.5, 36 * mm.s));
    });
    x.lineWidth = 0.8; x.strokeStyle = 'rgba(255,255,255,.28)';
    G.wires.forEach(function (W) {
      if (!W.exec) return;
      x.beginPath();
      W.samples.forEach(function (p, i) { if (i % 3 && i !== W.samples.length - 1) return; var px = mm.ox + p[0] * mm.s, py = mm.oy + p[1] * mm.s; if (!i) x.moveTo(px, py); else x.lineTo(px, py); });
      x.stroke();
    });
    G.nodes.forEach(function (N) {
      x.fillStyle = 'rgba(14,15,17,.95)';
      x.fillRect(mm.ox + N.x * mm.s, mm.oy + N.y * mm.s, Math.max(2, N.w * mm.s), Math.max(1.5, N.h * mm.s));
      x.fillStyle = N.ci.head[0];
      x.fillRect(mm.ox + N.x * mm.s, mm.oy + N.y * mm.s, Math.max(2, N.w * mm.s), Math.max(1.5, Math.min(N.h, 48) * mm.s));
    });
    mm.base = base;
    mmDraw();
  }
  function hexA(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim()); if (!m) return 'rgba(120,130,140,' + a + ')';
    var n = parseInt(m[1], 16); return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  ui.hexA = hexA;
  function mmDraw() {
    var G = E.cur(); if (!mm.ctx || !G || !G.cam || mm.G !== G || !mm.base) return;
    if (mm.el.offsetParent === null) return;
    var x = mm.ctx, r = dpr(), c = G.cam;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, mm.el.width, mm.el.height);
    x.drawImage(mm.base, 0, 0);
    x.scale(r, r);
    var vx = mm.ox + (-c.x / c.k) * mm.s, vy = mm.oy + (-c.y / c.k) * mm.s, vw = (E.vw / c.k) * mm.s, vh = (E.vh / c.k) * mm.s;
    x.fillStyle = 'rgba(194,247,121,.07)'; x.fillRect(vx, vy, vw, vh);
    x.strokeStyle = '#c2f779'; x.lineWidth = 1.2; x.strokeRect(vx + 0.5, vy + 0.5, vw - 1, vh - 1);
    // sim marker
    if (E.simActiveNode) {
      var N = E.simActiveNode();
      if (N && N.graph === G) { x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(mm.ox + (N.x + N.w / 2) * mm.s, mm.oy + (N.y + N.h / 2) * mm.s, 3, 0, Math.PI * 2); x.fill(); }
    }
  }
  E.on('cam', function (G) {
    if (mm.el && mm.el.classList.contains('is-idle') && G && G.cam && mm.cam0 && mm.G === G) {
      var c = G.cam, c0 = mm.cam0;
      if (Math.abs(c.x - c0.x) > 40 || Math.abs(c.y - c0.y) > 40 || Math.abs(c.k - c0.k) / c0.k > 0.04) mm.el.classList.remove('is-idle');
    }
    mmDraw();
  });
  E.on('resize', mmDraw);
  ui.mmDraw = mmDraw;

  /* ---------------------------------------------------------------- search (spec §9) */
  var index = [];
  function buildIndex() {
    index = [];
    E.D.order.forEach(function (G) {
      G.nodes.forEach(function (N) {
        var d = N.d || {};
        var pinL = N.pins['in'].concat(N.pins.out).map(function (p) { return p.l || ''; }).join(' ');
        var model = N.model ? (N.model.id + ' ' + N.model.tier + ' ' + (N.model.info ? N.model.info.ru : '')) : '';
        // agents/scripts folded inside collapsed groups (m-device, cp-crawl…) must be findable too
        var inner = (N.inner || []).map(function (x) { return typeof x === 'string' ? x : [x.tech, x.title, x.id, x.src].join(' '); }).join(' ');
        index.push({ N: N, G: G, t: norm(N.title), tech: norm(N.tech + ' ' + N.id + ' ' + (N.defId || '')),
          rest: norm([N.srcPaths.join(' '), N.also.join(' '), pinL, d.what || '', model, N.cond, N.ci.ru, N.ci.ue, inner].join(' ')) });
      });
    });
  }
  function search(q) {
    q = norm(q).trim(); if (!q) return [];
    var toks = q.split(/\s+/);
    var res = [];
    index.forEach(function (it) {
      var all = it.t + ' ' + it.tech + ' ' + it.rest, score = 0;
      for (var i = 0; i < toks.length; i++) if (all.indexOf(toks[i]) < 0) return;
      if (it.t.indexOf(q) === 0) score += 100; else if (it.t.indexOf(q) >= 0) score += 60;
      if (it.tech.indexOf(q) >= 0) score += 45;
      toks.forEach(function (t) { if (it.t.indexOf(t) >= 0) score += 12; if (it.tech.indexOf(t) >= 0) score += 8; });
      if (it.N.id.indexOf('@') > 0) score -= 5;
      if (E.cur() && it.G === E.cur()) score += 3;
      res.push({ it: it, s: score });
    });
    res.sort(function (a, b) { return b.s - a.s || a.it.G.nodes.length - b.it.G.nodes.length; });
    return res.slice(0, 12).map(function (r) { return r.it; });
  }
  function bindSearch(box) {
    var inp = box.querySelector('input'), list = box.querySelector('.bp-search-list'), items = [], act = -1;
    ui.searchInput = inp;
    function close() { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); act = -1; }
    function render() {
      items = search(inp.value);
      if (!inp.value.trim()) { close(); return; }
      if (!items.length) { list.innerHTML = '<div class="bp-sr-empty">Ничего не нашлось. Попробуйте id агента или имя файла.</div>'; list.hidden = false; inp.setAttribute('aria-expanded', 'true'); return; }
      var groups = {}, order = [];
      items.forEach(function (it, i) { if (!groups[it.G.id]) { groups[it.G.id] = []; order.push(it.G); } groups[it.G.id].push(i); });
      list.innerHTML = order.map(function (G) {
        return '<div class="bp-sr-g" role="group" aria-label="' + esc(G.tab) + '"><div class="bp-sr-gh">' + esc(G.tab) + '</div>' + groups[G.id].map(function (i) {
          var N = items[i].N;
          return '<div class="bp-sr" role="option" id="bp-sr-' + i + '" data-i="' + i + '" aria-selected="false" style="--h1:' + N.ci.head[0] + '"><i aria-hidden="true"></i><span class="bp-sr-t">' + esc(N.title) + '</span><span class="bp-sr-m mono">' + esc(N.tech || N.id) + '</span></div>';
        }).join('') + '</div>';
      }).join('');
      list.hidden = false; inp.setAttribute('aria-expanded', 'true');
      setAct(0);
    }
    function setAct(i) {
      act = i;
      Array.prototype.forEach.call(list.querySelectorAll('.bp-sr'), function (el) { var on = +el.getAttribute('data-i') === i; el.setAttribute('aria-selected', String(on)); el.classList.toggle('is-act', on); if (on) try { el.scrollIntoView({ block: 'nearest' }); } catch (x) {} });
      if (i >= 0) inp.setAttribute('aria-activedescendant', 'bp-sr-' + i); else inp.removeAttribute('aria-activedescendant');
    }
    function go(i) {
      var it = items[i]; if (!it) return;
      close(); inp.blur();
      if (E.state.view !== 'graph' && E.setView) E.setView('graph');
      E.jump(it.G.id, it.N.id, { focus: true });
    }
    inp.addEventListener('input', render);
    inp.addEventListener('focus', function () { if (inp.value.trim()) render(); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) render(); else setAct(Math.min(items.length - 1, act + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setAct(Math.max(0, act - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); go(act < 0 ? 0 : act); }
      else if (e.key === 'Escape') { e.preventDefault(); if (inp.value) { inp.value = ''; close(); } else { close(); E.canvas.focus(); } }
    });
    list.addEventListener('pointerdown', function (e) { e.preventDefault(); });
    list.addEventListener('click', function (e) { var el = e.target.closest('.bp-sr'); if (el) go(+el.getAttribute('data-i')); });
    inp.addEventListener('blur', function () { setTimeout(close, 120); });
  }
  E.on('searchFocus', function () { if (ui.searchInput) { ui.searchInput.focus(); ui.searchInput.select(); } });

  /* ---------------------------------------------------------------- dialogs: legend + keys */
  function dialog(id, title, body) {
    var old = ui.root.querySelector('.bp-dlg-wrap'); if (old) old.remove();
    var back = document.activeElement;
    var wrap = h('div', 'bp-dlg-wrap');
    wrap.innerHTML = '<div class="bp-dlg" role="dialog" aria-modal="true" aria-labelledby="bp-dlg-h-' + id + '"><header class="bp-dlg-top"><h2 id="bp-dlg-h-' + id + '">' + esc(title) + '</h2>' +
      '<button type="button" class="bp-btn bp-btn--icon bp-dlg-x" aria-label="Закрыть">' + E.icon('close') + '</button></header><div class="bp-dlg-body bp-scroll">' + body + '</div></div>';
    ui.root.appendChild(wrap);
    var dlg = wrap.querySelector('.bp-dlg');
    function close() { wrap.remove(); if (back && back.focus) try { back.focus({ preventScroll: true }); } catch (e) {} }
    wrap.addEventListener('click', function (e) { if (e.target === wrap || e.target.closest('.bp-dlg-x')) close(); });
    wrap.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      if (e.key === 'Tab') {
        var f = dlg.querySelectorAll('button, a, [tabindex="0"]'); if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
    wrap.querySelector('.bp-dlg-x').focus();
    if (MP.nbsp) try { MP.nbsp(dlg); } catch (e) {}
    return wrap;
  }
  function wireSample(cls, col) {
    return '<svg class="bp-lg-wire" viewBox="0 0 84 16" aria-hidden="true"><path class="bp-w ' + cls + '" d="M4 12C34 12 50 4 80 4" style="--wc:' + col + '"/></svg>';
  }
  function openLegend() {
    var D = E.D;
    var cats = Object.keys(D.cats).map(function (k) {
      var c = D.cats[k];
      return '<li><span class="bp-lg-head" style="--h1:' + c.head[0] + ';--h2:' + c.head[1] + '">' + E.icon(c.icon || 'fn') + '</span><b>' + esc(c.ru) + '</b><small>' + esc(c.ue) + '</small></li>';
    }).join('');
    var types = Object.keys(D.types).map(function (k) {
      var t = D.types[k];
      var g = k === 'exec' ? '<svg class="bp-pg pg-exec" viewBox="0 0 12 14"><path d="M1.6 1.6h4.6L10.6 7l-4.4 5.4H1.6z" style="fill:#fff"/></svg>' : '<i class="bp-pg pg-data" style="--pc:' + t.color + ';background:' + t.color + '"></i>';
      return '<li class="is-con">' + g + '<b>' + esc(t.ru) + '</b><small>' + esc(k) + ' · ' + esc(t.ue) + '</small></li>';
    }).join('');
    var body =
      '<section class="bp-lg"><h3>Ноды</h3><ul class="bp-lg-cats">' + cats + '</ul></section>' +
      '<section class="bp-lg"><h3>Пины и типы данных</h3><p class="bp-lg-p">Полый пин — не подключён, залитый — подключён. Квадрат из точек — массив.</p><ul class="bp-lg-types">' + types +
        '<li class="is-con"><svg class="bp-pg pg-arr" viewBox="0 0 11 11" style="--pc:#19A7F0">' + [0, 4, 8].map(function (y) { return [0, 4, 8].map(function (x) { return '<rect x="' + x + '" y="' + y + '" width="3" height="3" rx=".6"/>'; }).join(''); }).join('') + '</svg><b>Массив</b><small>array</small></li></ul></section>' +
      '<section class="bp-lg"><h3>Связи</h3><ul class="bp-lg-wires">' +
        '<li>' + wireSample('is-exec', '#fff') + '<b>Выполнение</b><small>порядок шагов, белая</small></li>' +
        '<li>' + wireSample('is-data', '#2E6FE8') + '<b>Данные</b><small>цвет — тип данных</small></li>' +
        '<li>' + wireSample('is-exec k-loop', '#fff') + '<b>Петля</b><small>возврат назад, пунктир</small></li>' +
        '<li>' + wireSample('is-exec k-fallback', '#9aa3ad') + '<b>Запасной путь</b><small>только если скрипт упал</small></li>' +
        '<li>' + wireSample('is-exec k-blocked', '#e5484d') + '<b>Заблокировано</b><small>дальше без человека нельзя</small></li></ul></section>' +
      '<section class="bp-lg"><h3>Значки</h3><ul class="bp-lg-badges">' +
        '<li><span class="bp-tier tier-H">H</span><b>Haiku</b><small>быстрый ИИ</small></li>' +
        '<li><span class="bp-tier tier-S">S</span><b>Sonnet</b><small>обычный ИИ</small></li>' +
        '<li><span class="bp-tier tier-O">O</span><b>Opus</b><small>самый сильный ИИ</small></li>' +
        '<li><span class="bp-chip gate">всегда ждёт</span><small>гейт: ждёт человека</small></li>' +
        '<li><span class="bp-chip gate">--unattended: авто Y</span><small>без человека отвечает Y</small></li>' +
        '<li><span class="bp-chip gate hard">HARD STOP</span><small>только явное «y»</small></li>' +
        '<li><span class="bp-lg-banner b-cond">если …</span><small>запускается по условию</small></li>' +
        '<li><span class="bp-lg-banner b-fb">только если скрипт упал</span><small>запасной исполнитель</small></li>' +
        '<li><span class="bp-lg-ghost"></span><small>×3 — несколько экземпляров сразу</small></li>' +
        '<li><span class="bp-chip sc">bash</span><small>скрипт: 0 токенов, всегда одинаковый результат</small></li></ul></section>';
    dialog('legend', 'Легенда', body);
  }
  function openKeys() {
    var rows = [
      ['Колесо', 'масштаб у курсора (Ctrl — плавно, Shift — сдвиг вбок)'], ['Перетаскивание', 'сдвиг холста (также правая/средняя кнопка, Space)'],
      ['Tab, стрелки', 'по нодам: → дальше по стрелке выполнения, ← назад, ↑ ↓ — соседи'], ['Enter', 'выбрать ноду; ещё раз — открыть составную'],
      ['Esc', 'снять выбор'], ['Alt+↑ / Backspace', 'назад к родительскому графу'], ['F', 'показать весь граф'], ['0', 'масштаб 1:1'],
      ['Home', 'к входу графа'], ['+ / −', 'приблизить / отдалить'], ['1–9', 'этапы (закладки)'], ['/ или Ctrl+F', 'поиск по всем графам'],
      ['Space', 'симуляция: пуск / пауза'], ['N', 'симуляция: следующий шаг'], ['F9', 'точка останова на выбранной ноде'],
      ['L', 'легенда'], ['?', 'эта подсказка']
    ];
    dialog('keys', 'Клавиши', '<p class="bp-lg-p">Однобуквенные клавиши работают, когда фокус на холсте.</p><table class="bp-keys"><tbody>' +
      rows.map(function (r) { return '<tr><th><kbd>' + esc(r[0]) + '</kbd></th><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table>');
  }
  ui.openLegend = openLegend; ui.openKeys = openKeys;
  E.on('key', function (e, N, key) {
    var k = key || e.key;
    if (k === 'l' || k === 'L' || k === 'д' || k === 'Д') { e.preventDefault(); openLegend(); }
    else if (k === '?') { e.preventDefault(); openKeys(); }
  });
  function bindGlobalKeys(root) {
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.closest && e.target.closest('.bp-node')) {
        var G = E.cur(), N = e.target._N;
        if (N && G && G.sel === N.id && !E.isComposite(N)) { e.preventDefault(); e.stopPropagation(); root.classList.add('dt-open'); focusDetails(); }
      }
    }, true);
  }

  /* ---------------------------------------------------------------- context menu */
  var menu = null;
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  E.on('context', function (N, p, C) {
    closeMenu();
    var items = [];
    if (N) {
      items.push(['sel', 'Выбрать', 'legend']);
      if (E.isComposite(N)) items.push(['open', 'Открыть граф', 'graph']);
      items.push(['center', 'Показать по центру', 'fit']);
      if (E.simToggleBreak) items.push(['bp', (E.simHasBreak && E.simHasBreak(N) ? 'Убрать точку останова' : 'Точка останова') + '  F9', 'bp']);
      if (E.simFind && E.simFind(N)) items.push(['sim', 'Показать в симуляции', 'play']);
      items.push(['copy', 'Скопировать id', 'copy']);
    } else {
      items.push(['fit', 'Показать всё  F', 'fit']);
      items.push(['one', 'Масштаб 1:1  0', 'nodes']);
      if (C) items.push(['cmt', 'Этап: ' + C.title, 'legend']);
    }
    menu = h('div', 'bp-menu');
    menu.setAttribute('role', 'menu');
    menu.innerHTML = items.map(function (it) { return '<button type="button" role="menuitem" data-m="' + it[0] + '">' + E.icon(it[2]) + '<span>' + esc(it[1]) + '</span></button>'; }).join('');
    E.overlays.appendChild(menu);
    var w = menu.offsetWidth, hh = menu.offsetHeight;
    menu.style.left = Math.min(p.x, E.vw - w - 8) + 'px';
    menu.style.top = Math.min(p.y, E.vh - hh - 8) + 'px';
    menu.addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]'); if (!b) return;
      var m = b.getAttribute('data-m');
      closeMenu();
      if (m === 'sel') E.select(N.id, {});
      else if (m === 'open') E.open(N);
      else if (m === 'center') { E.select(N.id, {}); E.centerNode(N); }
      else if (m === 'bp') E.simToggleBreak(N);
      else if (m === 'sim') { var hit = E.simFind(N); if (hit) E.emit('simShow', hit.id, hit.step); }
      else if (m === 'copy') copyText(N.id, null);
      else if (m === 'fit') E.fit();
      else if (m === 'one') { var c = E.cur().cam; E.flyTo(E.camFor((p.x - c.x) / c.k, (p.y - c.y) / c.k, 1), 0.3); }
      else if (m === 'cmt') E.selectComment(C.id, {});
    });
    menu.addEventListener('keydown', function (e) {
      var bs = Array.prototype.slice.call(menu.querySelectorAll('button')), i = bs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeMenu(); E.canvas.focus(); }
    });
    var first = menu.querySelector('button'); if (first) first.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', function (e) { if (menu && !menu.contains(e.target)) closeMenu(); }, true);
  E.on('gesture', closeMenu);
  E.on('escape', closeMenu);

  /* ---------------------------------------------------------------- hidden edit mode (Ctrl+Alt+E) */
  function toggleEdit(on) {
    E.editing = on == null ? !E.editing : !!on;
    var bar = E.overlays.querySelector('.bp-editbar');
    if (bar) bar.hidden = !E.editing;
    E.canvas.classList.toggle('is-editing', E.editing);
  }
  E.on('toggleEdit', function () { toggleEdit(); });
  E.on('editDrag', function (N, x, y) {
    var M = E.D.M;
    var col = Math.round(x / M.COL / 0.05) * 0.05, lane = Math.round(y / M.LANE / 0.05) * 0.05;
    N.at = [Math.round(col * 100) / 100, Math.round(lane * 100) / 100];
    N.x = Math.round(N.at[0] * M.COL / 8) * 8; N.y = Math.round(N.at[1] * M.LANE / 8) * 8;
    N.el.style.left = N.x + 'px'; N.el.style.top = N.y + 'px';
    E.rerouteNode(N);
  });
  E.on('editDrop', function (N) { E.live('Нода ' + N.id + ': at [' + N.at.join(', ') + ']'); });
  function editDump() {
    var G = E.cur();
    return '{\n' + G.nodes.map(function (N) { return '  "' + N.id + '": [' + N.at.join(', ') + ']'; }).join(',\n') + '\n}';
  }
})();
