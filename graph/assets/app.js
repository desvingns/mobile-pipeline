/* mobile-pipeline graph viewer.
 * Vanilla JS, no dependencies, no build step. Works from file:// and from GitHub Pages.
 * Data comes from data/*.js via window.MP_GRAPH_REGISTER (see index.html).
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------ const

  var KIND_LABEL = {
    mode: 'режим',
    agent: 'агент',
    script: 'скрипт',
    gate: 'гейт',
    artifact: 'артефакт',
    contract: 'контракт',
    board: 'доска',
    note: 'заметка'
  };

  var EDGE_KINDS = ['data', 'gate', 'retry', 'fallback', 'blocked'];

  var NODE_W = 268;
  var COL_GAP = 104;
  var ROW_GAP = 26;
  var MARGIN = 60;

  var REPO_BLOB = 'https://github.com/desvingns/mobile-pipeline/blob/main/';

  // ------------------------------------------------------------------ state

  var graphs = [];
  var byId = {};
  var state = {
    graphId: null,
    flowId: null,
    selected: null,
    query: '',
    contracts: false,
    tx: 0, ty: 0, k: 1
  };

  var view = { nodes: [], edges: [], index: {} };

  var el = {};

  // ------------------------------------------------------------------ utils

  function $(id) { return document.getElementById(id); }

  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function svgEl(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function storeKey() { return 'mpgraph:pos:' + state.graphId + ':' + state.flowId; }

  function loadPositions() {
    try {
      var raw = window.localStorage.getItem(storeKey());
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function savePositions(map) {
    try { window.localStorage.setItem(storeKey(), JSON.stringify(map)); } catch (e) { /* ignore */ }
  }

  function dropPositions() {
    try { window.localStorage.removeItem(storeKey()); } catch (e) { /* ignore */ }
  }

  // -------------------------------------------------------------- data prep

  function currentGraph() { return byId[state.graphId]; }

  function currentFlow() {
    var g = currentGraph();
    if (!g) return null;
    for (var i = 0; i < g.flows.length; i++) {
      if (g.flows[i].id === state.flowId) return g.flows[i];
    }
    return g.flows[0] || null;
  }

  function edgeAllowed(edge, flowId) {
    if (edge.only && edge.only.indexOf(flowId) < 0) return false;
    if (edge.not && edge.not.indexOf(flowId) >= 0) return false;
    return true;
  }

  function endpointNode(ref) { return String(ref).split(':')[0]; }
  function endpointPort(ref) {
    var parts = String(ref).split(':');
    return parts.length > 1 ? parts[1] : null;
  }

  /* Build the node + edge set for the active graph/flow. */
  function buildView() {
    var g = currentGraph(), f = currentFlow();
    view = { nodes: [], edges: [], index: {} };
    if (!g || !f) return;

    var nodeIndex = {};
    g.nodes.forEach(function (n) { nodeIndex[n.id] = n; });

    var seen = {};
    (f.nodes || []).forEach(function (id) {
      var n = nodeIndex[id];
      if (!n) { console.warn('graph: flow "' + f.id + '" references unknown node "' + id + '"'); return; }
      if (n.kind === 'contract' && !state.contracts) return;
      if (seen[id]) return;
      seen[id] = true;
      view.nodes.push(n);
      view.index[id] = n;
    });

    var wanted = null;
    if (f.edges) {
      wanted = {};
      f.edges.forEach(function (id) { wanted[id] = true; });
    }

    g.edges.forEach(function (e) {
      if (wanted && !wanted[e.id]) return;
      if (!edgeAllowed(e, f.id)) return;
      var a = endpointNode(e.from), b = endpointNode(e.to);
      if (!view.index[a] || !view.index[b]) return;
      view.edges.push(e);
    });
  }

  // ---------------------------------------------------------------- ranking

  /* Longest-path layering. Back edges (retry loops) are found by DFS first and
     excluded from ranking so a cycle cannot push nodes off to infinity. */
  function computeRanks() {
    var out = {}, backEdges = {};
    view.nodes.forEach(function (n) { out[n.id] = []; });
    view.edges.forEach(function (e) {
      var a = endpointNode(e.from), b = endpointNode(e.to);
      if (a !== b) out[a].push({ id: e.id, to: b });
    });

    var color = {};
    function dfs(id) {
      color[id] = 1;
      out[id].forEach(function (link) {
        if (color[link.to] === 1) { backEdges[link.id] = true; return; }
        if (!color[link.to]) dfs(link.to);
      });
      color[id] = 2;
    }
    view.nodes.forEach(function (n) { if (!color[n.id]) dfs(n.id); });

    var rank = {};
    view.nodes.forEach(function (n) { rank[n.id] = 0; });

    var forward = view.edges.filter(function (e) {
      return !backEdges[e.id] && endpointNode(e.from) !== endpointNode(e.to);
    });

    for (var pass = 0; pass < view.nodes.length + 1; pass++) {
      var changed = false;
      for (var i = 0; i < forward.length; i++) {
        var a = endpointNode(forward[i].from), b = endpointNode(forward[i].to);
        if (rank[b] < rank[a] + 1) { rank[b] = rank[a] + 1; changed = true; }
      }
      if (!changed) break;
    }
    return { rank: rank, back: backEdges };
  }

  // --------------------------------------------------------------- rendering

  function nodeElement(n) {
    var d = make('div', 'node');
    d.dataset.id = n.id;
    d.style.setProperty('--kc', 'var(--k-' + (n.kind || 'note') + ')');

    var head = make('div', 'head');
    head.appendChild(make('span', 'dot'));
    head.appendChild(make('span', 'title', n.title || n.id));
    head.appendChild(make('span', 'kindlabel', KIND_LABEL[n.kind] || n.kind || ''));
    d.appendChild(head);

    if (n.tech) d.appendChild(make('div', 'tech', n.tech));

    var badges = [];
    if (n.model) badges.push({ cls: 'badge model', text: n.model });
    (n.flags || []).forEach(function (fl) {
      var cls = 'badge';
      if (fl === 'fallback-only' || fl === 'legacy' || fl === 'не используется') cls = 'badge warn';
      if (fl === 'останавливает' || fl === 'blocks') cls = 'badge stop';
      badges.push({ cls: cls, text: fl });
    });
    if (badges.length) {
      var bw = make('div', 'badges');
      badges.forEach(function (b) {
        var s = make('span', b.cls, b.text);
        bw.appendChild(s);
      });
      d.appendChild(bw);
    }

    var ports = (n.ports || {});
    var hasPorts = (ports.in && ports.in.length) || (ports.out && ports.out.length);
    if (hasPorts) {
      var pw = make('div', 'ports');
      (ports.in || []).forEach(function (p) {
        var row = make('div', 'port in');
        row.appendChild(make('span', 'pin'));
        row.appendChild(make('span', null, p.label || p.id));
        row.dataset.port = 'in:' + p.id;
        pw.appendChild(row);
      });
      (ports.out || []).forEach(function (p) {
        var row = make('div', 'port out');
        row.appendChild(make('span', null, p.label || p.id));
        row.appendChild(make('span', 'pin'));
        row.dataset.port = 'out:' + p.id;
        pw.appendChild(row);
      });
      d.appendChild(pw);
    }

    return d;
  }

  function layoutAndDraw() {
    clear(el.nodes);
    clear(el.edges);

    if (!view.nodes.length) { el.empty.classList.add('show'); return; }
    el.empty.classList.remove('show');

    var ranking = computeRanks();
    var saved = loadPositions();

    // 1. create + measure
    var boxes = {};
    view.nodes.forEach(function (n, i) {
      var d = nodeElement(n);
      el.nodes.appendChild(d);
      boxes[n.id] = { node: n, el: d, order: i, w: NODE_W, h: 0, x: 0, y: 0 };
    });
    view.nodes.forEach(function (n) { boxes[n.id].h = boxes[n.id].el.offsetHeight; });

    // 2. columns
    var cols = {};
    view.nodes.forEach(function (n) {
      var r = ranking.rank[n.id] || 0;
      (cols[r] = cols[r] || []).push(boxes[n.id]);
    });
    Object.keys(cols).forEach(function (r) {
      cols[r].sort(function (a, b) {
        var ar = a.node.row, br = b.node.row;
        if (ar != null && br != null && ar !== br) return ar - br;
        return a.order - b.order;
      });
    });

    var ranks = Object.keys(cols).map(Number).sort(function (a, b) { return a - b; });
    ranks.forEach(function (r) {
      var col = cols[r];
      var total = 0;
      col.forEach(function (b) { total += b.h + ROW_GAP; });
      total -= ROW_GAP;
      var y = -total / 2;
      col.forEach(function (b) {
        b.x = r * (NODE_W + COL_GAP);
        b.y = y;
        y += b.h + ROW_GAP;
      });
    });

    // 3. explicit / dragged overrides
    view.nodes.forEach(function (n) {
      var b = boxes[n.id];
      if (n.pos) { b.x = n.pos.x; b.y = n.pos.y; }
      if (saved[n.id]) { b.x = saved[n.id].x; b.y = saved[n.id].y; }
    });

    // 4. normalise so everything is positive
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    view.nodes.forEach(function (n) {
      var b = boxes[n.id];
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    });
    var offX = MARGIN - minX, offY = MARGIN - minY;
    view.nodes.forEach(function (n) {
      var b = boxes[n.id];
      b.x += offX; b.y += offY;
      b.el.style.left = b.x + 'px';
      b.el.style.top = b.y + 'px';
    });

    var contentW = (maxX - minX) + MARGIN * 2;
    var contentH = (maxY - minY) + MARGIN * 2;
    el.edges.setAttribute('width', contentW);
    el.edges.setAttribute('height', contentH);
    el.edges.setAttribute('viewBox', '0 0 ' + contentW + ' ' + contentH);

    view.boxes = boxes;
    view.content = { w: contentW, h: contentH };

    drawEdges(ranking.back);
    applyHighlight();
  }

  function anchor(box, ref, side) {
    var portId = endpointPort(ref);
    if (portId) {
      var row = box.el.querySelector('[data-port="' + side + ':' + portId + '"]');
      if (row) {
        return {
          x: box.x + (side === 'in' ? 0 : box.w),
          y: box.y + row.offsetTop + row.offsetHeight / 2
        };
      }
    }
    var rows = box.el.querySelectorAll('.port.' + side);
    if (rows.length) {
      var r0 = rows[0];
      return {
        x: box.x + (side === 'in' ? 0 : box.w),
        y: box.y + r0.offsetTop + r0.offsetHeight / 2
      };
    }
    return { x: box.x + (side === 'in' ? 0 : box.w), y: box.y + box.h / 2 };
  }

  function edgeGeometry(a, b, isBack) {
    var dx = b.x - a.x;
    if (!isBack && dx > 30) {
      var c = Math.max(55, Math.min(170, dx * 0.5));
      return {
        d: 'M' + a.x + ',' + a.y + ' C' + (a.x + c) + ',' + a.y + ' ' + (b.x - c) + ',' + b.y + ' ' + b.x + ',' + b.y,
        lx: (a.x + b.x) / 2,
        ly: (a.y + b.y) / 2 - 7
      };
    }
    var bow = 96;
    var c2 = 120;
    return {
      d: 'M' + a.x + ',' + a.y +
         ' C' + (a.x + c2) + ',' + (a.y + bow) +
         ' ' + (b.x - c2) + ',' + (b.y + bow) +
         ' ' + b.x + ',' + b.y,
      lx: (a.x + b.x) / 2,
      ly: (a.y + b.y) / 2 + bow * 0.76
    };
  }

  function drawEdges(backEdges) {
    var defs = svgEl('defs');
    EDGE_KINDS.forEach(function (kind) {
      var m = svgEl('marker');
      m.setAttribute('id', 'arrow-' + kind);
      m.setAttribute('viewBox', '0 0 10 10');
      m.setAttribute('refX', '9');
      m.setAttribute('refY', '5');
      m.setAttribute('markerWidth', '6');
      m.setAttribute('markerHeight', '6');
      m.setAttribute('orient', 'auto-start-reverse');
      var p = svgEl('path');
      p.setAttribute('d', 'M0,0 L10,5 L0,10 z');
      p.setAttribute('fill', 'var(--e-' + kind + ')');
      m.appendChild(p);
      defs.appendChild(m);
    });
    el.edges.appendChild(defs);

    view.edges.forEach(function (e) {
      var ab = view.boxes[endpointNode(e.from)];
      var bb = view.boxes[endpointNode(e.to)];
      if (!ab || !bb) return;
      var a = anchor(ab, e.from, 'out');
      var b = anchor(bb, e.to, 'in');
      var kind = EDGE_KINDS.indexOf(e.kind) >= 0 ? e.kind : 'data';
      var geo = edgeGeometry(a, b, !!backEdges[e.id]);

      var path = svgEl('path');
      path.setAttribute('class', 'edge ' + kind);
      path.setAttribute('d', geo.d);
      path.setAttribute('marker-end', 'url(#arrow-' + kind + ')');
      path.dataset.edge = e.id;
      path.dataset.from = endpointNode(e.from);
      path.dataset.to = endpointNode(e.to);
      el.edges.appendChild(path);

      if (e.label) {
        var t = svgEl('text');
        t.setAttribute('class', 'edgelabel');
        t.setAttribute('x', geo.lx);
        t.setAttribute('y', geo.ly);
        t.setAttribute('text-anchor', 'middle');
        t.textContent = e.label;
        t.dataset.edge = e.id;
        t.dataset.from = endpointNode(e.from);
        t.dataset.to = endpointNode(e.to);
        el.edges.appendChild(t);
      }
    });
  }

  function redrawEdgesOnly() {
    var toRemove = [];
    for (var i = 0; i < el.edges.childNodes.length; i++) toRemove.push(el.edges.childNodes[i]);
    toRemove.forEach(function (n) { el.edges.removeChild(n); });
    drawEdges(computeRanks().back);
    applyHighlight();
  }

  // --------------------------------------------------------------- highlight

  function applyHighlight() {
    var q = state.query.trim().toLowerCase();
    var sel = state.selected;

    var related = null;
    if (sel) {
      related = {};
      related[sel] = true;
      view.edges.forEach(function (e) {
        var a = endpointNode(e.from), b = endpointNode(e.to);
        if (a === sel) related[b] = true;
        if (b === sel) related[a] = true;
      });
    }

    view.nodes.forEach(function (n) {
      var box = view.boxes[n.id];
      if (!box) return;
      var dim = false;
      if (q) {
        var hay = [n.id, n.title, n.tech, n.model, (n.ru && n.ru.what) || ''].join(' ').toLowerCase();
        if (hay.indexOf(q) < 0) dim = true;
      }
      if (related && !related[n.id]) dim = true;
      box.el.classList.toggle('dimmed', dim);
      box.el.classList.toggle('selected', n.id === sel);
    });

    var paths = el.edges.querySelectorAll('.edge, .edgelabel');
    for (var i = 0; i < paths.length; i++) {
      var p = paths[i];
      var touches = !sel || p.dataset.from === sel || p.dataset.to === sel;
      p.classList.toggle('dimmed', !touches);
      p.classList.toggle('hot', !!sel && touches);
    }
  }

  // ------------------------------------------------------------------- panel

  function section(title, html) {
    var s = make('section');
    s.appendChild(make('h3', null, title));
    var p = make('p');
    p.textContent = html;
    s.appendChild(p);
    return s;
  }

  function openPanel(n) {
    el.panelTitle.textContent = n.title || n.id;
    el.panelTech.textContent = n.tech || n.id;
    clear(el.panelBody);

    var ru = n.ru || {};

    if (ru.what) el.panelBody.appendChild(section('Что делает', ru.what));

    if (ru.example) {
      var ex = make('section');
      ex.appendChild(make('h3', null, 'На примере «Избранного»'));
      var box = make('div', 'example');
      box.appendChild(make('p', null, ru.example));
      ex.appendChild(box);
      el.panelBody.appendChild(ex);
    }

    if (ru['in']) el.panelBody.appendChild(section('Что получает на вход', ru['in']));
    if (ru.out) el.panelBody.appendChild(section('Что отдаёт', ru.out));
    if (ru.why) el.panelBody.appendChild(section('Зачем это отдельная нода', ru.why));
    if (ru.stops) el.panelBody.appendChild(section('Когда останавливает', ru.stops));

    var meta = make('section');
    meta.appendChild(make('h3', null, 'Техническое'));
    var kv = make('div', 'kv');
    kv.appendChild(make('span', 'badge', KIND_LABEL[n.kind] || n.kind || 'нода'));
    if (n.model) kv.appendChild(make('span', 'badge model', n.model));
    (n.tools || []).forEach(function (t) { kv.appendChild(make('span', 'badge', t)); });
    (n.flags || []).forEach(function (f) { kv.appendChild(make('span', 'badge warn', f)); });
    meta.appendChild(kv);
    var sources = [];
    if (n.src) sources.push(n.src);
    (n.also || []).forEach(function (p) { sources.push(p); });
    sources.forEach(function (path) {
      var link = make('a', 'src', path);
      link.href = REPO_BLOB + path;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.style.display = 'block';
      link.style.marginTop = '8px';
      meta.appendChild(link);
    });
    el.panelBody.appendChild(meta);

    el.panel.classList.add('open');
  }

  function closePanel() {
    el.panel.classList.remove('open');
    state.selected = null;
    applyHighlight();
    writeHash();
  }

  function select(id) {
    var n = view.index[id];
    if (!n) return;
    state.selected = id;
    openPanel(n);
    applyHighlight();
    writeHash();
  }

  // -------------------------------------------------------------- pan / zoom

  function applyTransform() {
    el.world.style.transform = 'translate(' + state.tx + 'px,' + state.ty + 'px) scale(' + state.k + ')';
    el.zoomVal.textContent = Math.round(state.k * 100) + '%';
  }

  function fit() {
    if (!view.content) return;
    var w = el.stage.clientWidth, h = el.stage.clientHeight;
    var k = Math.min(w / view.content.w, h / view.content.h, 1);
    k = Math.max(k, 0.12);
    state.k = k;
    state.tx = (w - view.content.w * k) / 2;
    state.ty = (h - view.content.h * k) / 2;
    applyTransform();
  }

  /* Opening view. A pipeline is a long horizontal chain, so fitting it to the
     window makes the labels unreadable. Start at a size you can actually read,
     anchored at the beginning of the chain; "Вписать" gives the bird's eye. */
  function initialView() {
    if (!view.content) return;
    var w = el.stage.clientWidth, h = el.stage.clientHeight;
    var k = Math.min(1, (h - 40) / view.content.h);
    k = Math.min(1, Math.max(0.5, k));
    state.k = k;
    state.tx = (view.content.w * k <= w) ? (w - view.content.w * k) / 2 : 24;
    state.ty = (h - view.content.h * k) / 2;
    if (state.ty < 0) state.ty = 12;
    applyTransform();
  }

  function zoomBy(factor, cx, cy) {
    var k2 = Math.min(2.2, Math.max(0.12, state.k * factor));
    var rect = el.stage.getBoundingClientRect();
    var px = (cx == null ? rect.width / 2 : cx - rect.left);
    var py = (cy == null ? rect.height / 2 : cy - rect.top);
    state.tx = px - (px - state.tx) * (k2 / state.k);
    state.ty = py - (py - state.ty) * (k2 / state.k);
    state.k = k2;
    applyTransform();
  }

  function bindCanvas() {
    var panning = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    var dragging = null, dsx = 0, dsy = 0, dox = 0, doy = 0;

    el.stage.addEventListener('mousedown', function (ev) {
      var nodeEl = ev.target.closest ? ev.target.closest('.node') : null;
      if (nodeEl) {
        dragging = view.boxes[nodeEl.dataset.id];
        if (!dragging) return;
        moved = false;
        dsx = ev.clientX; dsy = ev.clientY;
        dox = dragging.x; doy = dragging.y;
        nodeEl.classList.add('dragging');
        ev.preventDefault();
        return;
      }
      panning = true; moved = false;
      sx = ev.clientX; sy = ev.clientY; ox = state.tx; oy = state.ty;
      el.stage.classList.add('panning');
    });

    window.addEventListener('mousemove', function (ev) {
      if (dragging) {
        var dx = (ev.clientX - dsx) / state.k;
        var dy = (ev.clientY - dsy) / state.k;
        if (Math.abs(ev.clientX - dsx) + Math.abs(ev.clientY - dsy) > 3) moved = true;
        dragging.x = dox + dx;
        dragging.y = doy + dy;
        dragging.el.style.left = dragging.x + 'px';
        dragging.el.style.top = dragging.y + 'px';
        redrawEdgesOnly();
        return;
      }
      if (!panning) return;
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 3) moved = true;
      state.tx = ox + (ev.clientX - sx);
      state.ty = oy + (ev.clientY - sy);
      applyTransform();
    });

    window.addEventListener('mouseup', function (ev) {
      if (dragging) {
        dragging.el.classList.remove('dragging');
        if (moved) {
          var map = loadPositions();
          map[dragging.node.id] = { x: dragging.x, y: dragging.y };
          savePositions(map);
        } else {
          select(dragging.node.id);
        }
        dragging = null;
        return;
      }
      if (panning) {
        panning = false;
        el.stage.classList.remove('panning');
        if (!moved && ev.target === el.stage) closePanel();
      }
    });

    el.stage.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      zoomBy(ev.deltaY < 0 ? 1.12 : 1 / 1.12, ev.clientX, ev.clientY);
    }, { passive: false });
  }

  // -------------------------------------------------------------------- hash

  function writeHash() {
    var h = '#' + state.graphId + '/' + state.flowId + (state.selected ? '/' + state.selected : '');
    if (window.location.hash !== h) {
      try { window.history.replaceState(null, '', h); }
      catch (e) { window.location.hash = h; }
    }
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'mp-graph-route', ref: [state.graphId, state.flowId].concat(state.selected ? [state.selected] : []) }, '*');
    }
  }

  function readHash() {
    var raw = (window.location.hash || '').replace(/^#/, '');
    if (!raw) return null;
    var parts = raw.split('/');
    return { graphId: parts[0] || null, flowId: parts[1] || null, nodeId: parts[2] || null };
  }

  // ------------------------------------------------------------------ chrome

  function renderGraphSwitch() {
    clear(el.graphSwitch);
    graphs.forEach(function (g) {
      var b = make('button', null, g.tab || g.title || g.id);
      b.setAttribute('aria-pressed', String(g.id === state.graphId));
      b.addEventListener('click', function () { setGraph(g.id, null); });
      el.graphSwitch.appendChild(b);
    });
  }

  function renderFlowSelect() {
    var g = currentGraph();
    clear(el.flowSelect);
    if (!g) return;
    g.flows.forEach(function (f) {
      var o = make('option', null, f.label || f.id);
      o.value = f.id;
      if (f.id === state.flowId) o.selected = true;
      el.flowSelect.appendChild(o);
    });
  }

  function renderStorybar() {
    var g = currentGraph(), f = currentFlow();
    clear(el.storybar);
    if (!g) return;
    if (g.example) {
      el.storybar.appendChild(make('b', null, g.example.title + ' — '));
      el.storybar.appendChild(document.createTextNode(g.example.story));
    }
    if (f && f.hint) {
      el.storybar.appendChild(document.createElement('br'));
      el.storybar.appendChild(document.createTextNode(f.hint));
    }
    el.verBadge.textContent = g.pipelineVersion ? 'v' + g.pipelineVersion : '—';
  }

  function setGraph(graphId, flowId) {
    state.graphId = graphId;
    var g = currentGraph();
    if (!g) return;
    state.flowId = (flowId && g.flows.some(function (f) { return f.id === flowId; }))
      ? flowId
      : (g.flows[0] ? g.flows[0].id : null);
    state.selected = null;
    el.panel.classList.remove('open');
    renderGraphSwitch();
    renderFlowSelect();
    renderStorybar();
    buildView();
    layoutAndDraw();
    initialView();
    writeHash();
  }

  function setFlow(flowId) {
    state.flowId = flowId;
    state.selected = null;
    el.panel.classList.remove('open');
    renderStorybar();
    buildView();
    layoutAndDraw();
    initialView();
    writeHash();
  }

  function rerender() {
    buildView();
    layoutAndDraw();
    applyHighlight();
  }

  // -------------------------------------------------------------------- boot

  function boot() {
    el.stage = $('stage');
    el.world = $('world');
    el.nodes = $('nodes');
    el.edges = $('edges');
    el.panel = $('panel');
    el.panelTitle = $('panelTitle');
    el.panelTech = $('panelTech');
    el.panelBody = $('panelBody');
    el.graphSwitch = $('graphSwitch');
    el.flowSelect = $('flowSelect');
    el.storybar = $('storybar');
    el.search = $('search');
    el.empty = $('empty');
    el.zoomVal = $('zoomVal');
    el.verBadge = $('verBadge');

    graphs = (window.MP_GRAPHS || []).slice();
    graphs.forEach(function (g) { byId[g.id] = g; });

    if (!graphs.length) {
      el.empty.textContent = 'Файлы данных не загрузились. Открой graph/index.html целиком, вместе с папками assets/ и data/.';
      el.empty.classList.add('show');
      return;
    }

    function syncStageTop() {
      var top = $('topbar').offsetHeight + el.storybar.offsetHeight;
      document.documentElement.style.setProperty('--stage-top', top + 'px');
    }

    // Browsers restore checkbox state across a soft reload — adopt it, don't fight it.
    state.contracts = $('showContracts').checked;

    var h = readHash();
    var startGraph = (h && byId[h.graphId]) ? h.graphId : graphs[0].id;
    setGraph(startGraph, h ? h.flowId : null);
    syncStageTop();
    initialView();
    if (h && h.nodeId) select(h.nodeId);

    el.flowSelect.addEventListener('change', function () { setFlow(el.flowSelect.value); });

    $('showContracts').addEventListener('change', function (ev) {
      state.contracts = ev.target.checked;
      rerender();
      initialView();
    });

    $('fitBtn').addEventListener('click', fit);
    $('zoomIn').addEventListener('click', function () { zoomBy(1.2); });
    $('zoomOut').addEventListener('click', function () { zoomBy(1 / 1.2); });
    $('panelClose').addEventListener('click', closePanel);
    $('resetBtn').addEventListener('click', function () { dropPositions(); rerender(); initialView(); });
    $('legendToggle').addEventListener('click', function () {
      $('legend').classList.toggle('collapsed');
    });

    el.search.addEventListener('input', function () {
      state.query = el.search.value;
      applyHighlight();
    });
    el.search.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { el.search.value = ''; state.query = ''; applyHighlight(); el.search.blur(); }
      if (ev.key === 'Enter') {
        var q = state.query.trim().toLowerCase();
        if (!q) return;
        for (var i = 0; i < view.nodes.length; i++) {
          var n = view.nodes[i];
          if ((n.id + ' ' + (n.title || '')).toLowerCase().indexOf(q) >= 0) { select(n.id); break; }
        }
      }
    });

    window.addEventListener('keydown', function (ev) {
      if (ev.target === el.search) return;
      if (ev.key === '/') { ev.preventDefault(); el.search.focus(); return; }
      if (ev.key === 'Escape') { closePanel(); return; }
      if (ev.key === 'f' || ev.key === 'F' || ev.key === 'а' || ev.key === 'А') { fit(); }
    });

    window.addEventListener('resize', function () { syncStageTop(); });
    window.addEventListener('hashchange', function () {
      var hh = readHash();
      if (!hh) return;
      if (hh.graphId !== state.graphId) { setGraph(hh.graphId, hh.flowId); }
      else if (hh.flowId !== state.flowId) { setFlow(hh.flowId); }
      if (hh.nodeId && hh.nodeId !== state.selected) select(hh.nodeId);
    });

    bindCanvas();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
