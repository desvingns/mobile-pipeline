/* bp-outline.js — «Список»: the accessible list view of every graph (spec §10) and the «Граф | Список»
 * toggle. h2 per graph, h3 per stage (comment), ol of steps in exec order (DFS from Entry/Event), nested
 * «параллельно» lists under Parallel nodes, gates marked «Требует человека»; each item is a disclosure
 * that renders the same Details content as the side panel. Default view below 760px. */
(function () {
  'use strict';
  var MP = window.MP || {};
  var E = window.BPE;
  if (!E) return;
  var esc = E.esc, h = E.h;
  var ol = { built: false, box: null, root: null };
  var mqNarrow = window.matchMedia ? window.matchMedia('(max-width: 760px)') : { matches: false };

  E.on('mount', function (root) {
    ol.root = root;
    ol.box = root.querySelector('.bp-outline');
    var v = root.querySelector('.bp-tb-view');
    v.innerHTML = '<div class="bp-seg bp-viewseg" role="group" aria-label="Вид схемы">' +
      '<button type="button" class="bp-btn" data-v="graph" aria-pressed="true">' + E.icon('nodes') + '<span class="bp-lbl">Граф</span></button>' +
      '<button type="button" class="bp-btn" data-v="list" aria-pressed="false">' + E.icon('list') + '<span class="bp-lbl">Список</span></button></div>';
    v.addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) E.setView(b.getAttribute('data-v'), { user: true }); });
    ol.box.addEventListener('click', onClick);
    ol.box.addEventListener('toggle', onToggle, true);
    if (mqNarrow.matches) E.setView('list');
  });

  E.setView = function (v, o) {
    o = o || {};
    var root = ol.root; if (!root) return;
    E.state.view = v === 'list' ? 'list' : 'graph';
    root.classList.toggle('view-list', E.state.view === 'list');
    Array.prototype.forEach.call(root.querySelectorAll('.bp-viewseg [data-v]'), function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-v') === E.state.view)); });
    ol.box.hidden = E.state.view !== 'list';
    if (E.state.view === 'list') {
      if (!ol.built) build();
      E.emit('gesture');
      var G = E.cur();
      if (G) {
        var target = (G.sel && itemFor(G.id, G.sel)) || document.getElementById('bp-ol-' + G.id);
        if (target) {
          if (target.tagName === 'DETAILS') openItem(target, false);
          var wrap = ol.box.querySelector('.bp-ol-wrap');
          if (G === E.D.order[0] && !G.sel && wrap) wrap.scrollTop = 0;
          else if (o.user || G.sel) try { target.scrollIntoView({ block: 'start' }); } catch (x) {}
        }
      }
      if (o.user) { var hd = ol.box.querySelector('.bp-ol-top h2'); if (hd) hd.focus({ preventScroll: true }); }
    } else {
      E.measure(); E.requestApply();
      if (o.user) try { E.canvas.focus({ preventScroll: true }); } catch (x) {}
    }
    E.emit('view', E.state.view);
  };

  /* exec order: DFS from Entry / Events along exec outs (pin order), then the rest by position */
  function execOrder(G) {
    var order = [], seen = {};
    function visit(N) {
      if (!N || seen[N.id]) return;
      seen[N.id] = 1; order.push(N);
      N.outW.filter(function (W) { return W.exec && W.kind !== 'loop'; })
        .sort(function (a, b) { return a.from.row - b.from.row; })
        .forEach(function (W) { visit(W.B); });
    }
    visit(G.entry);
    G.nodes.filter(function (N) { return N.cat === 'EV' || N.cat === 'IN'; }).forEach(visit);
    G.nodes.slice().sort(function (a, b) { return a.x - b.x || a.y - b.y; }).forEach(function (N) {
      if (seen[N.id]) return;
      // data-only nodes slot in right after their first consumer/producer when possible
      visit(N);
    });
    return order;
  }
  function badges(N) {
    var s = '';
    if (N.cat === 'HG') s += '<span class="bp-ol-human">Требует человека' + (N.badge ? ' · ' + esc(N.badge) : '') + '</span>';
    if (N.model && N.model.info) s += '<span class="bp-tier tier-' + N.model.info.l + '" title="' + esc(N.model.info.ru) + '">' + N.model.info.l + '</span>';
    if (N.cond) s += '<span class="bp-ol-cond">если ' + esc(N.cond.replace(/^если\s+/i, '')) + '</span>';
    if (N.fallback) s += '<span class="bp-ol-cond">запасной</span>';
    if (N.instances > 1) s += '<span class="bp-ol-cond">×' + N.instances + '</span>';
    return s;
  }
  function item(N, inner) {
    return '<li><details class="bp-ol-item" data-g="' + esc(N.graph.id) + '" data-n="' + esc(N.id) + '" id="bp-oli-' + esc(N.graph.id) + '--' + esc(N.id) + '">' +
      '<summary style="--h1:' + N.ci.head[0] + ';--h2:' + N.ci.head[1] + '"><span class="bp-ol-cat">' + E.icon(N.ci.icon) + '<span>' + esc(N.ci.ru) + '</span></span>' +
      '<span class="bp-ol-t">' + esc(N.title) + '</span>' + (N.tech ? '<code class="bp-ol-tech">' + esc(N.tech) + '</code>' : '') + badges(N) + '</summary>' +
      '<div class="bp-ol-body"></div></details>' + (inner || '') + '</li>';
  }
  function build() {
    var D = E.D, s = '';
    s += '<div class="bp-ol-top">' +
      (mqNarrow.matches ? '<div class="bp-ol-note"><p>На маленьком экране схема показана списком: те же ноды, в порядке выполнения.</p><button type="button" class="bp-btn bp-btn--primary" data-v="graph">' + E.icon('nodes') + 'Открыть граф всё равно</button></div>' : '') +
      '<h2 tabindex="-1">Схема списком</h2><p class="bp-ol-lead">Каждый граф — по этапам, шаги в порядке выполнения. Раскройте пункт, чтобы увидеть детали: исполнитель, входы и выходы, исходники.</p>' +
      '<nav class="bp-ol-toc" aria-label="Графы">' + D.order.map(function (G) { return '<a href="#bp-ol-' + esc(G.id) + '" data-toc="' + esc(G.id) + '">' + esc(G.tab) + '<small>' + G.nodes.length + '</small></a>'; }).join('') + '</nav></div>';
    D.order.forEach(function (G) {
      var order = execOrder(G), stages = [], byStage = {};
      order.forEach(function (N) {
        var key = N.cmt ? N.cmt.id : '_none';
        if (!byStage[key]) { byStage[key] = []; stages.push({ key: key, C: N.cmt || null }); }
        byStage[key].push(N);
      });
      // keep «вне этапов» last
      stages.sort(function (a, b) { return (a.key === '_none') - (b.key === '_none'); });
      s += '<section class="bp-ol-g" id="bp-ol-' + esc(G.id) + '" aria-labelledby="bp-olh-' + esc(G.id) + '">' +
        '<h2 id="bp-olh-' + esc(G.id) + '">' + esc(G.title) + ' <small class="mono">' + esc(G.id) + ' · ' + G.nodes.length + ' нод</small></h2>' +
        (G.desc ? '<p class="bp-ol-desc">' + esc(G.desc) + '</p>' : '');
      stages.forEach(function (st) {
        var list = byStage[st.key], used = {};
        s += '<h3 style="--cc:' + (st.C ? st.C.color : '#58657a') + '"><i aria-hidden="true"></i>' + esc(st.C ? st.C.title : 'Вне этапов') + '</h3><ol class="bp-ol-steps">';
        list.forEach(function (N) {
          if (used[N.id]) return;
          var inner = '';
          if (N.cat === 'PA') {
            var kids = N.outW.filter(function (W) { return W.exec; }).map(function (W) { return W.B; })
              .filter(function (K) { return (K.cmt ? K.cmt.id : '_none') === st.key && !used[K.id]; });
            if (kids.length) {
              kids.forEach(function (K) { used[K.id] = 1; });
              inner = '<ul class="bp-ol-par" aria-label="параллельно"><li class="bp-ol-parh">параллельно</li>' + kids.map(function (K) { return item(K).replace(/^<li>/, '<li>'); }).join('') + '</ul>';
            }
          }
          used[N.id] = 1;
          s += item(N, inner);
        });
        s += '</ol>';
      });
      s += '</section>';
    });
    ol.box.innerHTML = '<div class="bp-ol-wrap bp-scroll">' + s + '</div>';
    ol.built = true;
    if (MP.nbsp) try { MP.nbsp(ol.box); } catch (e) {}
  }
  function itemFor(gid, nid) { return document.getElementById('bp-oli-' + gid + '--' + nid); }
  function fill(det) {
    var body = det.querySelector('.bp-ol-body');
    if (body.childNodes.length) return;
    var G = E.D.graphs[det.getAttribute('data-g')], N = G && G.byId[det.getAttribute('data-n')];
    if (!N || !E.ui || !E.ui.detailsNode) return;
    body.innerHTML = E.ui.detailsNode(G, N);
    // the summary already shows category, title and id: keep only the head's extras (instance note, «Открыть граф»)
    var head = body.querySelector('.bp-dt-head');
    if (head) {
      Array.prototype.forEach.call(head.querySelectorAll('.bp-dt-kicker, .bp-dt-title, .bp-dt-id'), function (x) { x.remove(); });
      if (!head.children.length) head.remove(); else head.classList.add('is-slim');
    }
    if (MP.nbsp) try { MP.nbsp(body); } catch (e) {}
  }
  function openItem(det, focus) {
    fill(det); det.open = true;
    if (focus) { var s = det.querySelector('summary'); try { s.focus({ preventScroll: true }); } catch (e) { s.focus(); } }
  }
  function onToggle(e) {
    var det = e.target;
    if (det && det.classList && det.classList.contains('bp-ol-item') && det.open) fill(det);
  }
  function onClick(e) {
    var b;
    if ((b = e.target.closest('[data-v]'))) { E.setView(b.getAttribute('data-v'), { user: true }); return; }
    if ((b = e.target.closest('.bp-nchip'))) {
      e.preventDefault();
      var it = itemFor(b.getAttribute('data-g'), b.getAttribute('data-n'));
      if (it) { openItem(it, true); try { it.scrollIntoView({ block: 'center', behavior: E.calm() ? 'auto' : 'smooth' }); } catch (x) {} }
      return;
    }
    if ((b = e.target.closest('[data-toc]'))) {
      e.preventDefault();
      var sec = document.getElementById('bp-ol-' + b.getAttribute('data-toc'));
      if (sec) { try { sec.scrollIntoView({ block: 'start', behavior: E.calm() ? 'auto' : 'smooth' }); } catch (x) {} var hh = sec.querySelector('h2'); if (hh) { hh.setAttribute('tabindex', '-1'); hh.focus({ preventScroll: true }); } }
      return;
    }
    if ((b = e.target.closest('[data-gograph]')) || (b = e.target.closest('[data-opengraph]'))) {
      var gid = b.getAttribute('data-gograph');
      if (!gid) { var det = b.closest('.bp-ol-item'), G = E.D.graphs[det.getAttribute('data-g')], N = G.byId[b.getAttribute('data-opengraph')]; gid = N && N.opens; }
      var s2 = gid && document.getElementById('bp-ol-' + gid);
      if (s2) try { s2.scrollIntoView({ block: 'start', behavior: E.calm() ? 'auto' : 'smooth' }); } catch (x) {}
      return;
    }
    if ((b = e.target.closest('[data-copy]'))) { if (E.ui) E.ui.copyText(b.getAttribute('data-copy'), b); return; }
    if ((b = e.target.closest('[data-simshow]'))) {
      var d2 = b.closest('.bp-ol-item');
      E.setView('graph', { user: true });
      if (d2) E.jump(d2.getAttribute('data-g'), d2.getAttribute('data-n'), {});
      E.emit('simShow', b.getAttribute('data-simshow'), +b.getAttribute('data-step'));
      return;
    }
    if ((b = e.target.closest('.bp-sec-bar'))) {
      var body = b.parentNode.nextElementSibling, open = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', String(!open)); body.hidden = open;
    }
  }
  /* graph switches (doc tabs, deep links) scroll the list to that graph */
  E.on('graph', function (G) {
    if (E.state.view !== 'list' || !ol.built || !G) return;
    var sec = document.getElementById('bp-ol-' + G.id), wrap = ol.box.querySelector('.bp-ol-wrap');
    if (G === E.D.order[0] && !G.sel && wrap) { wrap.scrollTop = 0; return; }
    if (sec && !G.sel) try { sec.scrollIntoView({ block: 'start' }); } catch (x) {}
  });
  /* keep the list in sync with deep links */
  E.on('select', function (G, N) {
    if (E.state.view !== 'list' || !N || !ol.built) return;
    var it = itemFor(G.id, N.id);
    if (it) { openItem(it, false); try { it.scrollIntoView({ block: 'start' }); } catch (x) {} }
  });
})();
