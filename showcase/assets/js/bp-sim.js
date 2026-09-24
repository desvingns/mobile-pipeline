/* bp-sim.js — ▶ Симуляция (spec §8): a scripted, seekable walk through a graph like UE execution debugging.
 * Nothing real runs. A scenario compiles to timed items; one clock (rAF, timeScale = speed) drives
 * render(t), which is idempotent: node / wire classes, pulses, log and badges are recomputed from t, so
 * seeking back and forth is exact. Reduced motion: no pulses or camera tweens, one step every 700 ms.
 * Also owns the Output Log panel and the simulation controls in the toolbar. */
(function () {
  'use strict';
  var MP = window.MP || {};
  var E = window.BPE;
  if (!E) return;
  var esc = E.esc, h = E.h, norm = E.norm, arr = E.arr;
  var CAPTION = 'Учебная симуляция: агенты не запускаются, значения — пример';
  function outLabel(N, out) { var p = N.pins.out.filter(function (x) { return x.id === out; })[0]; return p ? (p.l || p.id) : out; }
  var SPEEDS = [0.5, 1, 2, 4];
  var POOL = 10;

  var sim = E.sim = { list: {}, byId: {}, S: null, G: null, items: [], stops: [], total: 0, t: -0.01,
    playing: false, speed: 1, follow: true, breaks: {}, raf: 0, last: 0, stopAt: null, skipBreak: -1,
    started: -1, finished: -1, logFilter: 'all', collapsed: false, bpItem: -1 };

  /* ---------------------------------------------------------------- scenarios */
  function normScenarios() {
    var raw = (window.BP && window.BP.scenarios) || {};
    function add(s, gid) {
      if (!s || !s.id) return;
      var S = { id: String(s.id), title: s.title || s.id, graph: s.graph || gid, desc: s.summary || s.desc || s.d || '', preset: s.preset || null, steps: arr(s.steps), raw: s };
      if (!E.D.graphs[S.graph]) { E.warnings.push('scenario ' + S.id + ': unknown graph ' + S.graph); return; }
      if (sim.byId[S.id]) return;
      sim.byId[S.id] = S;
      (sim.list[S.graph] = sim.list[S.graph] || []).push(S);
    }
    if (Array.isArray(raw)) raw.forEach(function (s) { add(s, s && s.graph); });
    else Object.keys(raw).forEach(function (gid) { arr(raw[gid]).forEach(function (s) { add(s, gid); }); });
  }
  function workDur(N) {
    var c = N ? N.cat : '';
    if (c === 'AG' || c === 'MS' || c === 'PR') return 1.2;
    if (c === 'SC' || c === 'PS') return 0.6;
    if (c === 'HG') return 1.6;
    if (c === 'CP') return 1.0;
    return 0.25;
  }
  function compile(S, calm) {
    var G = E.D.graphs[S.graph], items = [], groups = [], GAP = 0.08;
    function mk(step, t, br) {
      var W = step.w ? E.findWire(G, step.w) : null;
      var N = (step.n && G.byId[step.n]) || (W && W.B) || null;
      if (!N) { E.warnings.push('scenario ' + S.id + ': step without a known node (' + (step.n || step.w) + ')'); return null; }
      var data = arr(step.data).map(function (r) { return E.findWire(G, r); }).filter(Boolean);
      var pd = W ? E.clamp(W.len / 900, 0.2, 1.6) : 0;
      var wd = step.dur != null ? +step.dur : workDur(N);
      return { st: step, N: N, W: W, data: data, t0: t, pd: pd, wd: wd, t1: t + pd + wd, br: br };
    }
    function seq(steps, t, br) {
      steps.forEach(function (step) {
        if (!step) return;
        if (step.par) {
          var end = t, lasts = [];
          arr(step.par).forEach(function (b, bi) {
            var n0 = items.length;
            end = Math.max(end, seq(arr(b), t, br + '.' + bi));
            if (items.length > n0) lasts.push({ it: items[items.length - 1], first: items[n0] });
          });
          groups.push(lasts);
          t = end; return;
        }
        var it = mk(step, t, br);
        if (!it) return;
        items.push(it); t = it.t1 + GAP;
      });
      return t;
    }
    seq(S.steps, 0, 'm');
    items.sort(function (a, b) { return a.t0 - b.t0 || (a.br < b.br ? -1 : 1); });
    if (calm) items.forEach(function (it, i) { it.t0 = i * 0.7; it.pd = 0; it.wd = 0.6; it.t1 = it.t0 + 0.6; });
    items.forEach(function (it, i) { it.i = i; it.arrive = it.t0 + it.pd + 0.001; });
    joinTexts(groups);
    var total = 0; items.forEach(function (it) { total = Math.max(total, it.t1); });
    return { items: items, total: total + 0.05 };
  }
  /* A Join step has no scripted text: its log line is written from the order in which the parallel
   * branches really finish in this timeline («готово 1/4» … «4/4 — все вернулись»), so the log can
   * never announce «все вернулись» before the last branch is in. Only the last one is «ok». */
  function joinTexts(groups) {
    groups.forEach(function (L) {
      var J = L.filter(function (x) { return x.it.N.cat === 'JN' && !x.it.st.text && !x.it.st.json; });
      if (J.length < 2) return;
      J.sort(function (a, b) { return a.it.t1 - b.it.t1 || a.it.i - b.it.i; });
      J.forEach(function (x, k) {
        var src = x.it.W ? x.it.W.A : x.first.N, last = k === J.length - 1;
        var skipped = x.first !== x.it && (x.first.st.st === 'skip');
        x.it.jtext = x.it.N.id + ' ← ' + (src.tech || src.title) + (skipped ? ': пропущен — считается завершённым' : ': готово') +
          ' · ' + (k + 1) + '/' + J.length + (last ? ' — все вернулись, дальше' : '');
        x.it.jst = last ? 'ok' : 'wait';
      });
    });
  }
  function stOf(it) { return it.jst || it.st.st || 'ok'; }
  E.simFind = function (N) {
    var L = sim.list[N.graph.id] || [];
    for (var i = 0; i < L.length; i++) {
      var c = L[i]._c || (L[i]._c = compile(L[i], false));
      for (var j = 0; j < c.items.length; j++) if (c.items[j].N === N) return { id: L[i].id, title: L[i].title, step: j };
    }
    return null;
  };
  E.simRoute = function () { return sim.S ? sim.S.id : null; };
  E.simActiveNode = function () {
    if (!sim.S) return null;
    var a = null; sim.items.forEach(function (it) { if (it.t0 <= sim.t && sim.t < it.t1) a = it.N; });
    return a;
  };

  /* ---------------------------------------------------------------- toolbar controls */
  var tb = {};
  E.on('mount', function (root) {
    normScenarios();
    if (E.D.simCaption) CAPTION = E.D.simCaption;
    var box = root.querySelector('.bp-tb-sim');
    box.innerHTML =
      '<button type="button" class="bp-btn bp-btn--primary bp-sim-go" title="Запустить симуляцию (Space)">' + E.icon('play') + '<span class="bp-lbl">Симуляция</span></button>' +
      '<label class="bp-selwrap"><span class="sr-only">Сценарий симуляции</span><select class="bp-sim-sel"></select>' + E.icon('chev', 'bp-sel-i') + '</label>' +
      '<span class="bp-sep" aria-hidden="true"></span>' +
      '<div class="bp-seg bp-transport" role="group" aria-label="Шаги симуляции">' +
        '<button type="button" class="bp-btn bp-btn--icon" data-t="first" aria-label="В начало" title="В начало">' + E.icon('first') + '</button>' +
        '<button type="button" class="bp-btn bp-btn--icon" data-t="back" aria-label="Шаг назад" title="Шаг назад">' + E.icon('stepb') + '</button>' +
        '<button type="button" class="bp-btn bp-btn--icon bp-sim-pp" data-t="pp" aria-label="Пуск" title="Пуск / пауза (Space)">' + E.icon('play') + '</button>' +
        '<button type="button" class="bp-btn bp-btn--icon" data-t="next" aria-label="Следующий шаг" title="Следующий шаг (N)">' + E.icon('stepf') + '</button>' +
      '</div>' +
      '<button type="button" class="bp-btn bp-sim-speed" aria-label="Скорость: 1×" title="Скорость">1×</button>' +
      '<button type="button" class="bp-btn bp-btn--icon bp-sim-follow" aria-pressed="true" aria-label="Камера следует" title="Камера следует за шагом">' + E.icon('cam') + '</button>' +
      '<button type="button" class="bp-btn bp-btn--icon bp-sim-stop" aria-label="Стоп" title="Стоп: убрать симуляцию">' + E.icon('stopsq') + '</button>';
    tb.go = box.querySelector('.bp-sim-go'); tb.sel = box.querySelector('.bp-sim-sel'); tb.pp = box.querySelector('.bp-sim-pp');
    tb.speed = box.querySelector('.bp-sim-speed'); tb.follow = box.querySelector('.bp-sim-follow'); tb.stop = box.querySelector('.bp-sim-stop');
    tb.transport = box.querySelector('.bp-transport');
    fillSelect();
    tb.go.addEventListener('click', function () {
      var id = tb.sel.value; if (!id) return;
      if (sim.S && sim.S.id === id) { togglePlay(); return; }
      load(id, { play: true });
    });
    tb.sel.addEventListener('change', function () { if (tb.sel.value) load(tb.sel.value, { play: false }); });
    tb.transport.addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b) return;
      var t = b.getAttribute('data-t');
      if (!sim.S) { if (tb.sel.value) load(tb.sel.value, { play: t === 'pp' || t === 'next' }); return; }
      if (t === 'first') restart(); else if (t === 'back') stepBack(); else if (t === 'next') stepNext(); else togglePlay();
    });
    tb.speed.addEventListener('click', function () {
      var i = (SPEEDS.indexOf(sim.speed) + 1) % SPEEDS.length; sim.speed = SPEEDS[i];
      var s = String(sim.speed).replace('.', ',') + '×';
      tb.speed.textContent = s; tb.speed.setAttribute('aria-label', 'Скорость: ' + s);
    });
    tb.follow.addEventListener('click', function () { sim.follow = !sim.follow; tb.follow.setAttribute('aria-pressed', String(sim.follow)); });
    tb.stop.addEventListener('click', function () { stop(); });
    buildOutput(root);
    buildSimbar();
    syncButtons();
  });
  function fillSelect() {
    var G = E.cur(), html = '';
    var gids = E.D.order.map(function (g) { return g.id; }).filter(function (id) { return sim.list[id]; });
    if (!gids.length) { tb.sel.innerHTML = '<option value="">Нет сценариев</option>'; tb.sel.disabled = true; return; }
    gids.forEach(function (gid) {
      html += '<optgroup label="' + esc(E.D.graphs[gid].tab) + '">' + sim.list[gid].map(function (S) { return '<option value="' + esc(S.id) + '">' + esc(S.title) + '</option>'; }).join('') + '</optgroup>';
    });
    tb.sel.innerHTML = html;
    var pick = sim.S ? sim.S.id : (G && sim.list[G.id] ? sim.list[G.id][0].id : sim.list[gids[0]][0].id);
    tb.sel.value = pick;
  }
  function isDone() { return !!sim.S && !sim.playing && sim.total > 0 && sim.t >= sim.total - 0.02; }
  function syncButtons() {
    if (!tb.pp) return;
    var done = isDone(), ic = sim.playing ? 'pause' : done ? 'loop' : 'play';
    var lbl = !sim.S ? 'Симуляция' : sim.playing ? 'Пауза' : done ? 'Повторить' : 'Дальше';
    var sig = ic + '|' + lbl + '|' + !!sim.S;
    if (sig === tb.sig) return;
    tb.sig = sig;
    tb.pp.innerHTML = E.icon(ic);
    tb.pp.setAttribute('aria-label', sim.playing ? 'Пауза' : done ? 'Повторить с начала' : 'Пуск');
    tb.go.classList.toggle('is-on', !!sim.S);
    tb.go.querySelector('.bp-lbl').textContent = lbl;
    tb.go.setAttribute('title', done ? 'Повторить симуляцию с начала (Space)' : 'Запустить симуляцию (Space)');
    tb.go.firstElementChild.outerHTML = E.icon(ic);
    tb.stop.disabled = !sim.S;
    E.root.classList.toggle('sim-live', !!sim.S);
  }
  E.on('graph', function (G, prev) {
    if (sim.S && sim.S.graph !== G.id) { stop(true); autoLog(false); }
    if (tb.sel && !sim.S && sim.list[G.id]) tb.sel.value = sim.list[G.id][0].id;
    logReset();
  });
  E.on('hide', function () { pause(); });
  E.on('scenarioRoute', function (id) { if (sim.byId[id]) load(id, { play: true }); });
  E.on('simLoad', function (id, o) { load(id, o || {}); });
  E.on('simShow', function (id, step) {
    if (!sim.byId[id]) return;
    if (!sim.S || sim.S.id !== id) load(id, { play: false, noFly: true });
    var it = sim.items[step]; if (!it) return;
    pause(); setTime(it.arrive);
    E.centerNode(it.N, Math.max(E.cur().cam.k, 0.8));
  });
  E.on('detailsGraph', function (box, G) {
    if (!box) return;
    var L = sim.list[G.id] || [];
    if (!L.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<h3 class="bp-dt-sub">' + E.icon('play') + 'Симуляции этого графа</h3><ul class="bp-simlist">' + L.map(function (S) {
      var c = S._c || (S._c = compile(S, false));
      return '<li><button type="button" class="bp-simitem" data-simplay="' + esc(S.id) + '"><span class="bp-simitem-i">' + E.icon('play') + '</span><span class="bp-simitem-t">' + esc(S.title) + (S.desc ? '<small class="bp-simitem-d">' + esc(S.desc) + '</small>' : '') + '</span><small>' + E.plural(c.items.length, 'шаг', 'шага', 'шагов') + '</small></button></li>';
    }).join('') + '</ul><p class="bp-note">' + esc(CAPTION) + '.</p>';
  });

  /* ---------------------------------------------------------------- load / clock */
  function load(id, o) {
    o = o || {};
    var S = sim.byId[id]; if (!S) return;
    if (sim.S) stop(true);
    if (!E.cur() || E.cur().id !== S.graph) { E.state.stack = []; E.setGraph(S.graph, { noRoute: true, preset: S.preset || undefined }); }
    var G = E.cur();
    var c = compile(S, E.calm());
    autoLog(true);
    sim.S = S; sim.G = G; sim.items = c.items; sim.total = c.total;
    sim.t = -0.01; sim.started = -2; sim.finished = -2; sim.stopAt = null; sim.skipBreak = -1; sim.bpItem = -1;
    tb.sel.value = S.id;
    if (G.sel || G.selCmt) E.select(null, { noRoute: true });
    ensurePulses(G);
    G.world.classList.add('sim-on');
    logReset(true);
    showSimbar(true);
    render(true);
    syncButtons();
    E.updateRoute();
    if (!o.noFly && sim.items[0] && !E.calm()) E.flyTo(E.camFor(sim.items[0].N.x + sim.items[0].N.w / 2 + E.vw * 0.25 / G.cam.k, sim.items[0].N.y + sim.items[0].N.h / 2, Math.max(G.cam.k, 0.62)), 0.6);
    else if (!o.noFly && sim.items[0]) E.centerNode(sim.items[0].N, Math.max(G.cam.k, 0.62), 0);
    E.live('Симуляция «' + S.title + '»: ' + E.plural(sim.items.length, 'шаг', 'шага', 'шагов') + '. ' + CAPTION + '.');
    if (o.play) play();
  }
  function stop(silent) {
    pause();
    var G = sim.G;
    if (G && G.world) {
      G.world.classList.remove('sim-on');
      clearState(G);
      hidePulses();
    }
    sim.S = null; sim.G = null; sim.items = []; sim.t = -0.01;
    showSimbar(false);
    if (!silent) autoLog(false);
    syncButtons();
    if (!silent) { logReset(); E.updateRoute(); E.live('Симуляция остановлена.'); }
    if (E.ui && E.ui.mmDraw) E.ui.mmDraw();
  }
  function play() {
    if (!sim.S) return;
    if (sim.t >= sim.total - 0.02) setTime(-0.01);
    sim.playing = true; sim.last = 0;
    cancelAnimationFrame(sim.raf);
    sim.raf = requestAnimationFrame(tick);
    syncButtons();
  }
  function pause() {
    sim.playing = false; sim.stopAt = null;
    cancelAnimationFrame(sim.raf);
    syncButtons();
  }
  function togglePlay() { if (sim.playing) pause(); else { hideBreakBanner(); play(); } }
  function tick(ts) {
    if (!sim.playing) return;
    if (!sim.last) sim.last = ts;
    var dt = Math.min(0.1, (ts - sim.last) / 1000); sim.last = ts;
    var nt = sim.t + dt * sim.speed;
    if (sim.stopAt != null && nt >= sim.stopAt) { nt = sim.stopAt; setTime(nt); pause(); return; }
    if (nt >= sim.total) { setTime(sim.total); pause(); finishedAll(); return; }
    setTime(nt, true);
    if (!sim.playing) return;
    sim.raf = requestAnimationFrame(tick);
  }
  function restart() { pause(); hideBreakBanner(); setTime(-0.01); }
  function curIndex() { var i = -1; sim.items.forEach(function (it, j) { if (it.arrive <= sim.t + 1e-6) i = j; }); return i; }
  function stepNext() {
    if (!sim.S) return;
    hideBreakBanner();
    var i = curIndex(), nx = sim.items[i + 1];
    if (!nx) { setTime(sim.total); pause(); finishedAll(); return; }
    if (E.calm()) { pause(); setTime(nx.arrive); return; }
    sim.stopAt = nx.arrive; sim.skipBreak = i + 1;
    sim.playing = true; sim.last = 0; cancelAnimationFrame(sim.raf); sim.raf = requestAnimationFrame(tick);
    syncButtons();
  }
  function stepBack() {
    if (!sim.S) return;
    pause(); hideBreakBanner();
    var i = curIndex();
    if (i <= 0) setTime(-0.01); else setTime(sim.items[i - 1].arrive);
  }
  function finishedAll() {
    var fails = sim.items.filter(function (it) { return stOf(it) === 'fail'; }).length;
    E.live('Симуляция завершена: ' + E.plural(sim.items.length, 'шаг', 'шага', 'шагов') + (fails ? ', ошибок: ' + fails : '') + '.');
  }
  function setTime(t, playing) {
    var prevStarted = sim.started;
    // breakpoints: stop at the arrival of a node with a breakpoint (only while playing forward)
    if (playing) {
      for (var j = 0; j < sim.items.length; j++) {
        var it = sim.items[j];
        if (it.arrive > sim.t + 1e-6 && it.arrive <= t && j !== sim.skipBreak && hasBreak(it.N)) {
          sim.t = it.arrive; sim.skipBreak = j; sim.bpItem = j;
          render(false, prevStarted); pause(); showBreakBanner(it); return;
        }
      }
    }
    sim.t = t;
    render(false, prevStarted);
  }

  /* ---------------------------------------------------------------- render(t): idempotent */
  var SIMCLS = ['sim-active', 'sim-done', 'sim-fail', 'sim-skip', 'sim-wait', 'sim-warn', 'sim-ghost', 'sim-seen'];
  /* tier letter of the agent a step names as its actor (a routed DEVELOPER_AGENT node) */
  function actorTier(st) {
    if (!st || !st.actor) return '';
    var defs = E.D.defs, a = String(st.actor), l = '';
    Object.keys(defs).some(function (k) { var d = defs[k]; if (d && d.model && (k === a || String(d.tech || '').split(' ')[0] === a)) { var T = E.TIERS[String(d.model.tier || '').toLowerCase()]; l = T ? T.l : ''; return true; } return false; });
    return l;
  }
  function clearState(G) {
    G.nodes.forEach(function (N) {
      if (!N.el) return;
      N.el.classList.remove.apply(N.el.classList, SIMCLS);
      N.el.removeAttribute('data-actor');
      var s = N.el.querySelector('.bp-state'), c = N.el.querySelector('.bp-counter');
      if (s) s.innerHTML = ''; if (c) c.innerHTML = '';
      N._simSig = '';
    });
    G.wires.forEach(function (W) { if (W.el) W.el.classList.remove('sim-flow', 'sim-seen'); });
    if (G.trailG) G.trailG.innerHTML = '';
    G._trail = {};
  }
  function render(force, prevStarted) {
    var G = sim.G; if (!G || !sim.S) return;
    var t = sim.t, started = -1, finished = 0;
    sim.items.forEach(function (it, j) { if (it.t0 <= t) started = j; if (it.t1 <= t) finished++; });
    if (force || started !== sim.started || finished !== sim.finished) {
      applyState(G, t);
      renderLog(t);
      updateSimbar(started);
      if (started > sim.started && sim.started >= -1 && !force) onStepStart(sim.items[started]);
      sim.started = started; sim.finished = finished;
      syncButtons();
      if (E.ui && E.ui.mmDraw) E.ui.mmDraw();
    } else updateProgress();
    renderPulses(G, t);
  }
  var ST_ICON = { ok: 'check', fail: 'cross', skip: 'skip', wait: 'pause', warn: 'warn' };
  function applyState(G, t) {
    var node = {}, ghosts = {}, counters = {}, answers = {}, trail = {}, flows = {}, lastW = null, lastT = -1;
    sim.items.forEach(function (it) {
      if (it.t0 > t) return;
      var active = t < it.t1;
      node[it.N.id] = { it: it, active: active };
      if (it.W && it.W.i >= 0) { trail[it.W.i] = it.W; if (it.t0 >= lastT) { lastT = it.t0; lastW = it.W; } }
      it.data.forEach(function (W) { if (W.i >= 0) flows[W.i] = W; });
      if (active) arr(it.st.ghost).forEach(function (id) { ghosts[id] = 1; });
      if (!active || it.st.st === 'wait') {
        if (it.st.counter && it.st.counter.node) counters[it.st.counter.node] = it.st.counter.text;
        if (it.st.answer != null && !active) answers[it.N.id] = it.st.answer;
      }
    });
    G.nodes.forEach(function (N) {
      if (!N.el) return;
      var s = node[N.id], cls = [], badge = '';
      if (s) {
        cls.push('sim-seen');
        var st = stOf(s.it);
        if (s.active) { cls.push('sim-active'); if (st === 'wait') { cls.push('sim-wait'); badge = 'wait'; } }
        else { cls.push(st === 'fail' ? 'sim-fail' : st === 'skip' ? 'sim-skip' : st === 'warn' ? 'sim-warn' : 'sim-done'); badge = st === 'wait' ? 'ok' : st; }
      }
      if (ghosts[N.id]) cls.push('sim-ghost');
      var chips = [];
      if (counters[N.id]) chips.push('<span class="bp-cc">' + esc(counters[N.id]) + '</span>');
      if (answers[N.id] != null) chips.push('<span class="bp-cc is-answer">ответ: ' + esc(answers[N.id]) + '</span>');
      if (s && !s.active && stOf(s.it) === 'skip') chips.push('<span class="bp-cc is-skip">пропущено</span>');
      if (s && !s.active && s.it.st.out && N.cat !== 'HG') chips.push('<span class="bp-cc is-out">→ ' + esc(outLabel(N, s.it.st.out)) + '</span>');
      var act = s && N.routed && N.routed.length ? actorTier(s.it.st) : '';
      var sig = cls.join(' ') + '|' + badge + '|' + chips.join('') + '|' + act;
      if (sig === N._simSig) return;
      N._simSig = sig;
      N.el.classList.remove.apply(N.el.classList, SIMCLS);
      if (cls.length) N.el.classList.add.apply(N.el.classList, cls);
      if (act) N.el.setAttribute('data-actor', act); else N.el.removeAttribute('data-actor');
      N.el.querySelector('.bp-state').innerHTML = badge ? '<span class="bp-sb sb-' + badge + '">' + E.icon(ST_ICON[badge] || 'check') + '</span>' : '';
      N.el.querySelector('.bp-counter').innerHTML = chips.join('');
    });
    // wires: data flow + exec trail (fresh one fades 1 → .35 over 4 s)
    G.wires.forEach(function (W) {
      if (!W.el) return;
      W.el.classList.toggle('sim-flow', !!flows[W.i]);
      W.el.classList.toggle('sim-seen', !!trail[W.i] || !!flows[W.i]);
    });
    var old = G._trail || {}, nu = {};
    Object.keys(trail).forEach(function (k) {
      var W = trail[k], el = old[k];
      if (!el) { el = document.createElementNS('http://www.w3.org/2000/svg', 'path'); el.setAttribute('class', 'bp-trail'); el.setAttribute('d', W.d); G.trailG.appendChild(el); }
      var fresh = W === lastW && sim.playing;
      if (fresh && !el.classList.contains('is-fresh')) { el.classList.remove('is-fresh'); void el.getBoundingClientRect(); el.classList.add('is-fresh'); }
      else if (!fresh) el.classList.remove('is-fresh');
      nu[k] = el;
    });
    Object.keys(old).forEach(function (k) { if (!nu[k]) old[k].remove(); });
    G._trail = nu;
  }
  function onStepStart(it) {
    if (!it) return;
    var G = sim.G;
    if (sim.follow && sim.playing && !E.nodeOnScreen(it.N, 0.2)) {
      // reduced motion: jump instantly (no camera tween)
      E.flyTo(E.camFor(it.N.x + it.N.w / 2, it.N.y + it.N.h / 2, Math.max(G.cam.k, 0.55)), E.calm() ? 0 : 0.6);
    }
    var st = stOf(it);
    var stRu = { ok: 'готово', fail: 'ошибка', skip: 'пропущено', wait: 'ждёт человека', warn: 'предупреждение' }[st] || st;
    E.live('Шаг ' + (it.i + 1) + ' из ' + sim.items.length + '. ' + (it.st.live || ((it.N.tech || it.N.title) + ': ' + stRu)));
  }

  /* pulses: exec chevron + data dots, pooled (≤10), positioned from t. They are counter-scaled by
   * 1/zoom (capped) so a zoomed-out graph still shows them, data dots get a white core so they do
   * not melt into the reroute knots, and the whole wire lights up while its pulse travels. */
  function ensurePulses(G) {
    if (G._pulses) return;
    var ns = 'http://www.w3.org/2000/svg', list = [];
    for (var i = 0; i < POOL; i++) {
      var g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'bp-pulse'); g.style.display = 'none';
      g.innerHTML = '<circle class="bp-pg-glow" r="12"/><path class="bp-pg-exec" d="M-6.5 -6.5 4.5 0 -6.5 6.5 -3.5 0Z"/><circle class="bp-pg-dot" r="4.2"/><circle class="bp-pg-core" r="1.7"/>';
      G.pulseG.appendChild(g); list.push(g);
    }
    G._pulses = list;
    G._live = [];
  }
  function hidePulses() {
    var G = sim.G; if (!G) return;
    if (G._pulses) G._pulses.forEach(function (g) { g.style.display = 'none'; });
    setLive(G, []);
  }
  function setLive(G, list) {
    var old = G._live || [];
    old.forEach(function (W) { if (list.indexOf(W) < 0 && W.el) { W.el.classList.remove('sim-live'); if (W.uel) W.uel.classList.remove('sim-live'); } });
    list.forEach(function (W) { if (old.indexOf(W) < 0 && W.el) { W.el.classList.add('sim-live'); if (W.uel) W.uel.classList.add('sim-live'); } });
    G._live = list;
  }
  function renderPulses(G, t) {
    var P = G._pulses; if (!P) return;
    var used = 0, live = [];
    var sc = E.clamp(1 / ((G.cam && G.cam.k) || 1), 1, 2.8);
    if (!E.calm()) {
      sim.items.forEach(function (it) {
        if (t < it.t0) return;
        if (it.W && it.pd > 0 && t < it.t0 + it.pd && used < POOL) { place(P[used++], it.W, (t - it.t0) / it.pd, true, '#ffd23f', sc); if (it.W.el) live.push(it.W); }
        it.data.forEach(function (W) {
          var dd = E.clamp(W.len / 900, 0.25, 1.4);
          if (t < it.t0 + dd && used < POOL) { place(P[used++], W, (t - it.t0) / dd, false, E.typeColor(W.type), sc); if (W.el) live.push(W); }
        });
      });
    }
    for (var i = used; i < P.length; i++) if (P[i].style.display !== 'none') P[i].style.display = 'none';
    setLive(G, live);
  }
  /* zooming while paused keeps the pulses at the same screen size */
  E.on('cam', function (G) { if (sim.S && sim.G === G && !sim.playing) renderPulses(G, sim.t); });
  function place(g, W, p, isExec, col, sc) {
    var q = E.pointAt(W, E.clamp(p, 0, 1) * W.len);
    g.style.display = '';
    g.setAttribute('transform', 'translate(' + q.x.toFixed(1) + ' ' + q.y.toFixed(1) + ') rotate(' + q.a.toFixed(1) + ')' + (sc > 1.01 ? ' scale(' + sc.toFixed(2) + ')' : ''));
    var cls = 'bp-pulse ' + (isExec ? 'is-exec' : 'is-data');
    if (g.getAttribute('class') !== cls) g.setAttribute('class', cls);
    g.style.setProperty('--pcol', col);
  }

  /* ---------------------------------------------------------------- breakpoints */
  function bkey(N) { return N.graph.id + '/' + N.id; }
  function hasBreak(N) { return !!sim.breaks[bkey(N)]; }
  E.simHasBreak = hasBreak;
  E.simToggleBreak = function (N) {
    if (!N) return;
    var k = bkey(N);
    if (sim.breaks[k]) delete sim.breaks[k]; else sim.breaks[k] = 1;
    if (N.el) N.el.classList.toggle('has-bp', !!sim.breaks[k]);
    E.live((sim.breaks[k] ? 'Точка останова: ' : 'Точка останова снята: ') + N.title);
  };
  E.on('rendered', function (G) { G.nodes.forEach(function (N) { if (N.el && sim.breaks[bkey(N)]) N.el.classList.add('has-bp'); }); });

  /* ---------------------------------------------------------------- keys */
  E.on('key', function (e, N, key) {
    var k = key || e.key;
    if (k === ' ' || k === 'Spacebar') {
      e.preventDefault();
      if (!sim.S) { if (tb.sel && tb.sel.value) load(tb.sel.value, { play: true }); }
      else togglePlay();
    } else if (k === 'n' || k === 'N' || k === 'т' || k === 'Т') {
      e.preventDefault();
      if (!sim.S) { if (tb.sel && tb.sel.value) { load(tb.sel.value, { play: false }); stepNext(); } }
      else stepNext();
    } else if (k === 'F9') {
      e.preventDefault();
      var G = E.cur(), M = N || (G.sel && G.byId[G.sel]);
      E.simToggleBreak(M);
    }
  });

  /* ---------------------------------------------------------------- sim bar (bottom of the canvas) */
  var bar = {};
  function buildSimbar() {
    var el = h('div', 'bp-simbar');
    el.hidden = true;
    el.innerHTML = '<div class="bp-simbar-row"><span class="bp-simdot" aria-hidden="true"></span><span class="bp-simtitle"></span><span class="bp-simstep mono"></span></div>' +
      '<div class="bp-simtrack" role="slider" tabindex="0" aria-label="Шаг симуляции" aria-valuemin="0"><div class="bp-simfill"></div><div class="bp-simticks"></div></div>' +
      '<div class="bp-simcap">' + esc(CAPTION) + '</div>' +
      '<div class="bp-simbreak" hidden>' + E.icon('bp') + '<span class="bp-simbreak-t"></span><button type="button" class="bp-btn bp-btn--primary bp-simbreak-go">' + E.icon('play') + 'Продолжить</button></div>';
    E.overlays.appendChild(el);
    bar.el = el; bar.title = el.querySelector('.bp-simtitle'); bar.step = el.querySelector('.bp-simstep');
    bar.track = el.querySelector('.bp-simtrack'); bar.fill = el.querySelector('.bp-simfill'); bar.ticks = el.querySelector('.bp-simticks');
    bar.brk = el.querySelector('.bp-simbreak');
    bar.brk.querySelector('.bp-simbreak-go').addEventListener('click', function () { hideBreakBanner(); play(); });
    bar.track.addEventListener('pointerdown', function (e) {
      if (!sim.S) return;
      var go = function (ev) { var r = bar.track.getBoundingClientRect(); var f = E.clamp((ev.clientX - r.left) / r.width, 0, 1); pause(); setTime(f * sim.total); };
      bar.track.setPointerCapture(e.pointerId); go(e);
      var mv = function (ev) { go(ev); }, up = function () { bar.track.removeEventListener('pointermove', mv); bar.track.removeEventListener('pointerup', up); };
      bar.track.addEventListener('pointermove', mv); bar.track.addEventListener('pointerup', up);
      e.stopPropagation();
    });
    bar.track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); stepNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stepBack(); }
      else if (e.key === 'Home') { e.preventDefault(); restart(); }
    });
  }
  function showSimbar(on) {
    if (!bar.el) return;
    bar.el.hidden = !on;
    E.inset.b = on ? bar.el.offsetHeight + 28 : 16;
    if (on) {
      bar.title.textContent = sim.S.title;
      bar.el.title = sim.S.desc || '';
      bar.ticks.innerHTML = sim.items.map(function (it) {
        return '<i class="t-' + (it.st.st || 'ok') + '" style="left:' + (it.t0 / sim.total * 100).toFixed(2) + '%"></i>';
      }).join('');
      bar.track.setAttribute('aria-valuemax', String(sim.items.length));
    } else hideBreakBanner();
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function updateSimbar(started) {
    if (!bar.el || !sim.S) return;
    var n = sim.items.length, cur = Math.max(0, started + 1);
    bar.step.textContent = 'шаг ' + pad2(cur) + '/' + pad2(n);
    bar.track.setAttribute('aria-valuenow', String(cur));
    bar.track.setAttribute('aria-valuetext', 'шаг ' + cur + ' из ' + n);
    updateProgress();
  }
  function updateProgress() { if (bar.fill && sim.total) bar.fill.style.transform = 'scaleX(' + E.clamp(sim.t / sim.total, 0, 1).toFixed(4) + ')'; }
  function showBreakBanner(it) {
    if (!bar.brk) return;
    bar.brk.hidden = false;
    bar.brk.querySelector('.bp-simbreak-t').textContent = 'Точка останова: ' + it.N.title;
    E.live('Точка останова: ' + it.N.title);
    if (!E.nodeOnScreen(it.N, 0.15)) E.centerNode(it.N, Math.max(E.cur().cam.k, 0.6));
  }
  function hideBreakBanner() { if (bar.brk) bar.brk.hidden = true; }

  /* ---------------------------------------------------------------- Output Log (UE) */
  var out = {};
  function buildOutput(root) {
    var el = root.querySelector('.bp-output');
    el.innerHTML = '<div class="bp-out-bar">' +
      '<button type="button" class="bp-out-toggle" aria-expanded="true" aria-controls="bp-out-body">' + E.icon('chev') + E.icon('log') + '<span>Журнал</span><small>Output Log</small></button>' +
      '<div class="bp-out-filters" role="group" aria-label="Фильтр журнала">' +
        [['all', 'Все'], ['LogAgent', 'Агенты'], ['LogScript', 'Скрипты'], ['LogGate', 'Гейты']].map(function (f, i) {
          return '<button type="button" class="bp-fl" data-f="' + f[0] + '" aria-pressed="' + (i === 0) + '">' + f[1] + '</button>';
        }).join('') + '</div>' +
      '<button type="button" class="bp-out-copy bp-mini" title="Копировать лог">' + E.icon('copy') + '<span>Копировать лог</span></button></div>' +
      '<div class="bp-out-body bp-scroll" id="bp-out-body" role="log" aria-live="off" aria-label="Журнал симуляции" tabindex="0"></div>';
    out.el = el; out.body = el.querySelector('.bp-out-body'); out.toggle = el.querySelector('.bp-out-toggle');
    el.querySelector('.bp-out-filters').addEventListener('click', function (e) {
      var b = e.target.closest('[data-f]'); if (!b) return;
      sim.logFilter = b.getAttribute('data-f');
      Array.prototype.forEach.call(el.querySelectorAll('.bp-fl'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      out.body.setAttribute('data-filter', sim.logFilter);
    });
    out.toggle.addEventListener('click', function () { sim.logUser = true; setCollapsed(!sim.collapsed); });
    el.querySelector('.bp-out-copy').addEventListener('click', function (e) {
      var text = Array.prototype.map.call(out.body.querySelectorAll('.bp-ll'), function (x) { return x.textContent; }).join('\n');
      if (E.ui) E.ui.copyText(text, e.currentTarget);
    });
    out.body.addEventListener('click', function (e) {
      var l = e.target.closest('.bp-ll[data-i]'); if (!l || !sim.S) return;
      var it = sim.items[+l.getAttribute('data-i')]; if (!it) return;
      pause(); setTime(it.arrive);
      E.select(it.N.id, { reveal: true });
    });
    // The log opens by itself when a scenario loads (desktop) and folds away again on «Стоп»,
    // unless the viewer has toggled it; the canvas keeps the room otherwise.
    setCollapsed(true);
  }
  function narrow() { return !!(window.matchMedia && window.matchMedia('(max-width: 760px)').matches); }
  function setCollapsed(c) {
    if (!out.el) return;
    sim.collapsed = c;
    out.el.classList.toggle('is-collapsed', c);
    out.toggle.setAttribute('aria-expanded', String(!c));
    E.measure();
  }
  function autoLog(open) { if (!sim.logUser && !(open && narrow())) setCollapsed(!open); }
  function tagFor(N) { return N.ci.tag || 'LogBlueprint'; }
  /* log subject: the agent id + tier; a step may name another actor on the same node (e.g. the one
   * auto-fix after failed tests is done by whichever developer tier the risk route picked) */
  function subject(N, st) {
    if (st && st.actor) {
      var defs = E.D.defs, a = String(st.actor), tier = '';
      Object.keys(defs).some(function (k) { var d = defs[k]; if (d && (k === a || String(d.tech || '').split(' ')[0] === a)) { tier = d.model && d.model.tier ? String(d.model.tier).toLowerCase() : ''; return true; } return false; });
      return a + (tier ? ' (' + tier + ')' : '');
    }
    if (N.cat === 'AG') return (N.tech || N.id) + (N.model && N.model.tier ? ' (' + N.model.tier + ')' : '');
    return N.tech || N.id;
  }
  function lineFor(it, n) {
    var st = it.st, N = it.N, s = st.st || 'ok';
    var tag = st.tag || tagFor(N);
    var lvl = st.lvl || (s === 'fail' ? 'error' : (s === 'warn' || s === 'wait') ? 'warning' : 'display');
    if (lvl === 'display' && s === 'ok' && (N.cat === 'RT' || (st.json && st.json.pass === true))) lvl = 'success';
    var pre = lvl === 'error' ? 'Error: ' : lvl === 'warning' ? 'Warning: ' : '';
    var body;
    if (st.json != null) body = subject(N, st) + ' → ' + (typeof st.json === 'string' ? st.json : JSON.stringify(st.json));
    else if (st.text) body = st.text;
    else if (s === 'skip') body = subject(N, st) + ' — пропущено' + (N.cond ? ' (' + N.cond + ')' : '');
    else if (st.answer != null) body = N.id + ' ждёт человека: «' + N.title + '» → ' + st.answer;
    else body = subject(N, st) + (st.out ? ' → ' + outLabel(N, st.out) : ' → ' + (s === 'ok' ? 'ok' : s));
    return { tag: tag, lvl: lvl, text: '[' + pad2(it.i + 1) + '/' + pad2(n) + '] ' + tag + ': ' + pre + body, i: it.i };
  }
  function logReset(forSim) {
    if (!out.body) return;
    var G = E.cur(); if (!G) return;
    out.body.setAttribute('data-filter', sim.logFilter);
    out.body.innerHTML = '<div class="bp-ll lvl-display is-sys" data-tag="LogBlueprint">LogBlueprint: граф «' + esc(G.tab) + '» загружен — ' + E.plural(G.nodes.length, 'нода', 'ноды', 'нод') + ', ' + E.plural(G.wires.length, 'связь', 'связи', 'связей') + ', ' + E.plural(G.comments.length, 'этап', 'этапа', 'этапов') + '</div>' +
      (forSim && sim.S ? '<div class="bp-ll lvl-display is-sys" data-tag="LogBlueprint">LogBlueprint: симуляция «' + esc(sim.S.title) + '» — ' + E.plural(sim.items.length, 'шаг', 'шага', 'шагов') + '. ' + esc(CAPTION) + '</div>'
        : '<div class="bp-ll lvl-hint is-sys" data-tag="LogBlueprint">' + ((sim.list[G.id] || []).length ? 'Выберите сценарий и нажмите «Симуляция» — журнал покажет каждый шаг.' : 'Для этого графа нет учебных сценариев.') + '</div>');
    out.count = 0;
  }
  function renderLog(t) {
    if (!out.body || !sim.S) return;
    var fin = sim.items.filter(function (it) { return it.t1 <= t; }).sort(function (a, b) { return a.t1 - b.t1; });
    var sys = out.body.querySelectorAll('.is-sys').length;
    var have = out.body.children.length - sys;
    if (have === fin.length) return;
    var stick = out.body.scrollTop + out.body.clientHeight >= out.body.scrollHeight - 24;
    if (have > fin.length) {
      while (out.body.children.length > sys + fin.length) out.body.removeChild(out.body.lastChild);
    } else {
      var frag = document.createDocumentFragment(), n = sim.items.length;
      fin.slice(have).forEach(function (it) {
        var L = lineFor(it, n);
        var d = h('div', 'bp-ll lvl-' + L.lvl);
        d.setAttribute('data-tag', L.tag); d.setAttribute('data-i', String(L.i));
        d.textContent = L.text; d.title = L.text;
        frag.appendChild(d);
      });
      out.body.appendChild(frag);
    }
    if (stick || sim.playing) out.body.scrollTop = out.body.scrollHeight;
  }
})();
