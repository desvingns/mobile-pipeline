/* bp-core.js — «Схема» engine core (Unreal-Blueprint-style node editor).
 * Data normalisation (window.BP, see docs/design-skhema.md §12), geometry from BP.metrics only (no DOM
 * measuring), wire routing, per-graph rendering, camera (pan / zoom / inertia / LOD), selection, keyboard
 * navigation, drill-down, routing. Other modules (bp-ui, bp-sim, bp-outline) plug in through the tiny bus
 * window.BPE (E.on / E.emit). Public contract for router.js: window.MP_SKHEMA = { mount, show, hide }.
 * Plain ES5, globals only; works on file:// and http. */
(function () {
  'use strict';
  var MP = window.MP = window.MP || {};
  var E = window.BPE = window.BPE || {};
  var doc = document;

  /* ---------------------------------------------------------------- bus + helpers */
  var handlers = {};
  E.on = function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); };
  E.emit = function (name) {
    var args = Array.prototype.slice.call(arguments, 1);
    (handlers[name] || []).forEach(function (fn) { try { fn.apply(null, args); } catch (e) { console.error(e); } });
  };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function snap(v) { return Math.round(v / 8) * 8; }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е'); }
  function h(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function assign(t) { for (var i = 1; i < arguments.length; i++) { var s = arguments[i]; if (s) for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; } return t; }
  function arr(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  E.esc = esc; E.clamp = clamp; E.norm = norm; E.h = h; E.assign = assign; E.arr = arr; E.now = now;
  E.calm = function () { return !!(MP.isCalm && MP.isCalm()); };
  E.warnings = [];
  function warn(msg) { E.warnings.push(msg); }

  /* ---------------------------------------------------------------- defaults (spec §1, §6, §9) */
  var DEF_M = { COL: 336, LANE: 176, W: { full: 272, composite: 300, flow: 176, 'var': 208, tunnel: 208, compact: 272 },
    HEAD: 48, HEAD_FLOW: 30, ROW: 28, PAD_T: 8, PAD_B: 10, BANNER: 22, PIN_INSET: 14, VAR_H: 36, COMPACT_H: 36,
    GHOST: 6, COMMENT_PAD: 40, COMMENT_BAR: 36 };
  var DEF_TYPES = {
    exec: { ru: 'Выполнение', ue: 'Exec', color: '#FFFFFF' },
    Verdict: { ru: 'Вердикт pass/fail', ue: 'Boolean', color: '#C0282D' },
    Number: { ru: 'Число', ue: 'Integer', color: '#1EE0A5' },
    Route: { ru: 'Маршрут', ue: 'Enum', color: '#0F8A6A' },
    Idea: { ru: 'Идея / ответ человека', ue: 'Text', color: '#E27BA0' },
    SPEC: { ru: 'SPEC-блок', ue: 'String', color: '#F21FC9' },
    SpecBundle: { ru: 'Документ бандла', ue: 'Struct', color: '#2E6FE8' },
    Files: { ru: 'Файлы / дифф', ue: 'Object', color: '#19A7F0' },
    Report: { ru: 'JSON-отчёт скрипта', ue: 'Vector', color: '#F6C02B' },
    Findings: { ru: 'Замечания с ID', ue: 'Transform', color: '#F57A00' },
    Checklist: { ru: 'Чек-лист / матрица', ue: 'Name', color: '#C68BF5' },
    Screens: { ru: 'Скриншоты / эталоны', ue: 'Texture', color: '#A2E23A' },
    Memory: { ru: 'Урок / память', ue: 'Rotator', color: '#9EB1FF' },
    Proposal: { ru: 'Патч / PR', ue: 'Class', color: '#8B5CFF' }
  };
  var FLOWC = ['#55585f', '#36383d'];
  var DEF_CATS = {
    EV: { ru: 'Событие', ue: 'Event', head: ['#9b1c1c', '#5e1010'], icon: 'ev' },
    IN: { ru: 'Вход', ue: 'Entry (tunnel)', head: ['#5b3aa0', '#37225f'], icon: 'tin' },
    RT: { ru: 'Выход', ue: 'Return (tunnel)', head: ['#5b3aa0', '#37225f'], icon: 'tout' },
    END: { ru: 'Стоп', ue: 'Terminal', head: ['#5a2a2a', '#3a1b1b'], icon: 'stop' },
    AG: { ru: 'Агент', ue: 'Function', head: ['#13706a', '#0b4642'], icon: 'fn', tag: 'LogAgent' },
    MS: { ru: 'Главная сессия', ue: 'Macro', head: ['#3d5f5c', '#26403e'], icon: 'ms', tag: 'LogAgent' },
    SC: { ru: 'Скрипт', ue: 'Library Function', head: ['#2b56a8', '#1a356b'], icon: 'gear', tag: 'LogScript' },
    PS: { ru: 'Чистый скрипт', ue: 'Pure Function', head: ['#2b56a8', '#1a356b'], icon: 'gear', tag: 'LogScript' },
    HG: { ru: 'Человек', ue: 'Latent Macro', head: ['#94600f', '#5e3c09'], icon: 'hand', tag: 'LogGate' },
    BR: { ru: 'Ветвление', ue: 'Branch', head: FLOWC, icon: 'branch' },
    SW: { ru: 'Выбор', ue: 'Switch', head: FLOWC, icon: 'switch' },
    PA: { ru: 'Параллельно', ue: 'Parallel', head: FLOWC, icon: 'par' },
    JN: { ru: 'Слияние', ue: 'Join', head: FLOWC, icon: 'join' },
    VA: { ru: 'Артефакт', ue: 'Variable', head: ['#3a3f47', '#262a30'], icon: 'var' },
    CP: { ru: 'Составной граф', ue: 'Collapsed Graph', head: ['#3b4556', '#232a35'], icon: 'graph' },
    CL: { ru: 'Группа', ue: 'Collapsed Nodes', head: ['#3b4556', '#232a35'], icon: 'group' },
    PR: { ru: 'Подсказка', ue: 'Print String', head: ['#3d5f5c', '#26403e'], icon: 'print' }
  };
  var FLOW = { BR: 1, SW: 1, PA: 1, JN: 1 };
  var TIERS = { haiku: { l: 'H', ru: 'Haiku', plain: 'быстрый' }, sonnet: { l: 'S', ru: 'Sonnet', plain: 'обычный' }, opus: { l: 'O', ru: 'Opus', plain: 'самый сильный' } };
  E.TIERS = TIERS;
  E.FLOW = FLOW;

  /* ---------------------------------------------------------------- icons (16×16, stroke) */
  var IC = {
    ev: '<path d="M8 1.6 14.4 8 8 14.4 1.6 8z"/><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/>',
    tin: '<path d="M6.5 2.5h-4v11h4"/><path d="M5.5 8h8.5M11 5l3 3-3 3"/>',
    tout: '<path d="M9.5 2.5h4v11h-4"/><path d="M2 8h8.5M7.5 5l3 3-3 3"/>',
    stop: '<rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor" stroke="none"/>',
    fn: '<rect x="1.5" y="1.5" width="13" height="13" rx="3.5"/><path d="M10.4 4.4c-.7-.5-1.7-.4-2.2.3-.4.6-.5 1.3-.6 2.1l-.5 3.7c-.1.9-.5 1.6-1.3 1.9M5.6 7.3h4.2"/>',
    ms: '<rect x="1.5" y="2.5" width="13" height="11" rx="2.2"/><path d="M4.4 6.3 6.8 8.3 4.4 10.3M8.6 10.6h3"/>',
    gear: '<circle cx="8" cy="8" r="2.4"/><path d="M8 1.6v2.1M8 12.3v2.1M1.6 8h2.1M12.3 8h2.1M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5 5 11M11 5l1.5-1.5"/>',
    hand: '<path d="M5.2 8.4V3.6a1 1 0 0 1 2 0v4M7.2 7.4V2.7a1 1 0 0 1 2 0v4.7M9.2 7.4V3.6a1 1 0 0 1 2 0v4.2M11.2 7.8V5.8a1 1 0 0 1 2 0v4c0 2.8-1.9 4.7-4.6 4.7-1.8 0-2.9-.9-3.8-2.3L2.7 9.8a1 1 0 0 1 1.6-1.2l.9 1"/>',
    clock: '<circle cx="8" cy="8" r="6.2"/><path d="M8 4.4V8l2.6 1.7"/>',
    branch: '<path d="M2 8h4.5M6.5 8l3-4.2h4.3M6.5 8l3 4.2h4.3"/>',
    'switch': '<path d="M2 8h3.5M5.5 8 9 3h4.8M5.5 8h8.3M5.5 8 9 13h4.8"/>',
    par: '<path d="M2 8h3M5 3v10M5 3h8.8M5 8h8.8M5 13h8.8"/>',
    join: '<path d="M2 3h9M2 8h9M2 13h9M11 3v10M11 8h3"/>',
    'var': '<circle cx="8" cy="8" r="4"/>',
    graph: '<rect x="1.5" y="5" width="9" height="9" rx="1.8"/><path d="M5.5 5V3.3c0-1 .8-1.8 1.8-1.8h5.4c1 0 1.8.8 1.8 1.8v5.4c0 1-.8 1.8-1.8 1.8H10.5"/>',
    group: '<rect x="1.5" y="4.5" width="9" height="9" rx="1.8" stroke-dasharray="2 1.6"/><path d="M5.5 2h7c.8 0 1.5.7 1.5 1.5v7"/>',
    print: '<path d="M2.5 3h11v7.4H7.2L4.3 13v-2.6H2.5z"/><path d="M5 5.8h6M5 8h4"/>',
    check: '<path d="M3.2 8.4 6.4 11.4 12.8 4.6"/>',
    cross: '<path d="M4 4l8 8M12 4l-8 8"/>',
    skip: '<path d="M3 4l4 4-4 4M8 4l4 4-4 4"/>',
    pause: '<path d="M5.5 3.5v9M10.5 3.5v9"/>',
    warn: '<path d="M8 3.5v5.5"/><circle cx="8" cy="12" r=".6" fill="currentColor"/>',
    play: '<path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/>',
    ban: '<circle cx="8" cy="8" r="5.6"/><path d="M4 12 12 4"/>',
    open: '<path d="M6 3.5 10.5 8 6 12.5"/>',
    back: '<path d="M10 3.5 5.5 8 10 12.5"/>',
    copy: '<rect x="5" y="5" width="8.5" height="8.5" rx="1.6"/><path d="M11 5V3.5c0-.8-.7-1.5-1.5-1.5H4C3.2 2 2.5 2.7 2.5 3.5V9c0 .8.7 1.5 1.5 1.5h1"/>',
    ext: '<path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M11.5 9.5v3c0 .6-.4 1-1 1h-7c-.6 0-1-.4-1-1v-7c0-.6.4-1 1-1h3"/>',
    search: '<circle cx="7" cy="7" r="4.5"/><path d="m10.4 10.4 3.6 3.6"/>',
    list: '<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><circle cx="2.6" cy="4" r=".9" fill="currentColor"/><circle cx="2.6" cy="8" r=".9" fill="currentColor"/><circle cx="2.6" cy="12" r=".9" fill="currentColor"/>',
    nodes: '<rect x="1.5" y="2.5" width="5" height="4" rx="1"/><rect x="9.5" y="9.5" width="5" height="4" rx="1"/><path d="M6.5 4.5h2c1 0 1.5.5 1.5 1.5v2c0 1 .5 1.5 1.5 1.5"/>',
    help: '<circle cx="8" cy="8" r="6.2"/><path d="M6.2 6.3c.2-1 1-1.6 1.9-1.6 1.1 0 1.9.7 1.9 1.7 0 1.4-1.9 1.5-1.9 2.9"/><circle cx="8.1" cy="11.3" r=".5" fill="currentColor"/>',
    legend: '<rect x="2" y="2.5" width="4" height="4" rx="1"/><rect x="2" y="9.5" width="4" height="4" rx="2"/><path d="M8.5 4.5h5.5M8.5 11.5h5.5"/>',
    first: '<path d="M4 3.5v9M12 3.5 7 8l5 4.5z"/>',
    stepb: '<path d="M4 3.5v9"/><path d="M12.5 3.5 6.5 8l6 4.5z" fill="currentColor"/>',
    stepf: '<path d="M12 3.5v9"/><path d="M3.5 3.5 9.5 8l-6 4.5z" fill="currentColor"/>',
    stopsq: '<rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" stroke="none"/>',
    cam: '<path d="M2 5.5h8.5v6H2zM10.5 7.5l3.5-2v6l-3.5-2"/>',
    fit: '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>',
    chev: '<path d="M4 6l4 4 4-4"/>',
    close: '<path d="M4 4l8 8M12 4l-8 8"/>',
    log: '<rect x="2" y="2.5" width="12" height="11" rx="2"/><path d="M4.5 6h7M4.5 8.5h5M4.5 11h6"/>',
    bp: '<circle cx="8" cy="8" r="4.2" fill="currentColor" stroke="none"/>',
    loop: '<path d="M12.5 6.5A5 5 0 1 0 13 9.5"/><path d="M13.2 3.2v3.5H9.7"/>'
  };
  E.icon = function (name, cls) {
    return '<svg class="bp-i ' + (cls || '') + '" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + (IC[name] || '') + '</svg>';
  };
  E.IC = IC;
  /* Russian plural: E.plural(21, 'шаг', 'шага', 'шагов') → «21 шаг» */
  E.plural = function (n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    var w = (a > 10 && a < 20) ? many : (b === 1 ? one : (b >= 2 && b <= 4 ? few : many));
    return n + ' ' + w;
  };

  /* ---------------------------------------------------------------- data normalisation */
  function mergeMetrics(m) {
    var M = assign({}, DEF_M, m || {});
    M.W = assign({}, DEF_M.W, (m && m.W) || {});
    return M;
  }
  function normModel(m) {
    if (!m) return null;
    var id = typeof m === 'string' ? m : (m.id || m.model || m.tier || '');
    var tier = typeof m === 'object' && m.tier ? String(m.tier).toLowerCase() : '';
    if (!tier) { var s = norm(id); tier = /opus/.test(s) ? 'opus' : /haiku/.test(s) ? 'haiku' : /sonnet/.test(s) ? 'sonnet' : ''; }
    if (!TIERS[tier]) { var t2 = norm(tier); tier = /^o/.test(t2) ? 'opus' : /^h/.test(t2) ? 'haiku' : /^s/.test(t2) ? 'sonnet' : ''; }
    return { tier: tier, id: id || tier, info: TIERS[tier] || null };
  }
  function slug(s) { return norm(s).replace(/[^a-z0-9а-я@_-]+/g, '-').replace(/^-+|-+$/g, '') || 'p'; }
  function normPin(p, dir) {
    if (typeof p === 'string') {
      var s = p.trim(), c0 = s.charAt(0);
      if (c0 === '▷') { var nm = s.slice(1).trim(); return { id: nm || (dir === 'in' ? 'in' : 'then'), t: 'exec', l: nm }; }
      if (c0 === '●' || c0 === '▦') {
        var rest = s.slice(1), ci = rest.indexOf(':'), t = ci < 0 ? rest : rest.slice(0, ci), l = ci < 0 ? '' : rest.slice(ci + 1);
        return { id: slug(l || t), t: t.trim(), l: l.trim(), arr: c0 === '▦' };
      }
      return { id: s, t: 'exec', l: '' };
    }
    p = p || {};
    var tt = p.t || p.type || 'exec';
    return { id: String(p.id != null ? p.id : (tt === 'exec' ? (dir === 'in' ? 'in' : 'then') : slug(p.l || p.label || tt))),
      t: tt, l: p.l != null ? p.l : (p.label || ''), arr: !!(p.arr || p.array), tip: p.tip || p.d || '' };
  }
  function normPins(list, dir, N) {
    var out = [], seen = {};
    arr(list).forEach(function (raw) {
      var p = normPin(raw, dir);
      if (seen[p.id]) { var k = 2; while (seen[p.id + '-' + k]) k++; p.id = p.id + '-' + k; }
      seen[p.id] = 1; p.dir = dir; p.node = N; p.wires = [];
      out.push(p);
    });
    // exec rows first (stable)
    var ex = out.filter(function (p) { return p.t === 'exec'; }), da = out.filter(function (p) { return p.t !== 'exec'; });
    return ex.concat(da);
  }
  function catInfo(D, c) { return D.cats[c] || D.cats.AG; }
  function isSetVar(src) {
    if (src.set === true || src.writer === true) return true;
    var m = norm(src.mode || src.access || src.va || src.op || '');
    if (m === 'set' || m === 'write') return true;
    if (m === 'get' || m === 'read') return false;
    return false;
  }
  function gateText(g) {
    if (!g) return '';
    if (E.D && E.D.gates && E.D.gates[g]) return E.D.gates[g];
    var s = norm(g);
    if (/hard/.test(s)) return 'HARD STOP';
    if (/unatt|auto/.test(s)) return '--unattended: авто Y';
    if (/always|всегда/.test(s)) return 'всегда ждёт';
    return String(g);
  }

  function buildNode(D, G, n, rawById) {
    var id = String(n.id);
    var defKey = n.def || null, baseRaw = null;
    if (id.indexOf('@') > 0) {
      var base = id.split('@')[0];
      baseRaw = rawById[base] || D.rawNodes[base] || null;
      if (!defKey && baseRaw && baseRaw.def) defKey = baseRaw.def;
      if (!defKey && D.defs[base]) defKey = base;
    }
    if (!defKey && D.defs[id]) defKey = id;
    if (n.def && !D.defs[n.def]) warn('node ' + G.id + '/' + id + ': unknown def «' + n.def + '»');
    var def = (defKey && D.defs[defKey]) || {};
    var inherit = {};
    if (baseRaw && !baseRaw.def) { assign(inherit, baseRaw); ['id', 'at', 'cond', 'fallback', 'badge', 'instances', 'title'].forEach(function (k) { delete inherit[k]; }); }
    var src = assign({}, def, inherit, n);
    var N = { id: id, defId: defKey, graph: G, raw: n, def: def, src: src };
    N.cat = String(src.cat || 'AG').toUpperCase();
    if (!D.cats[N.cat]) { warn('node ' + G.id + '/' + id + ': unknown cat «' + N.cat + '»'); N.cat = 'AG'; }
    N.ci = catInfo(D, N.cat);
    N.title = src.title || id;
    N.tech = src.tech || '';
    N.model = normModel(src.model);
    N.tools = arr(src.tools);
    N.flags = arr(src.flags);
    N.srcPaths = arr(src.src);
    N.also = arr(src.also);
    N.codex = src.codex || '';
    N.d = src.d || {};
    N.sample = src.sample || '';
    N.related = arr(src.related || (N.d && N.d.related));
    N.cond = src.cond ? String(src.cond) : '';
    N.fallback = src.fallback ? (typeof src.fallback === 'string' ? src.fallback : 'только если скрипт упал') : '';
    N.badge = src.badge || gateText(src.gate);
    N.instances = +src.instances || 0;
    N.multiIn = !!src.multiIn;
    N.isSet = N.cat === 'VA' && isSetVar(src);
    var op = src.opens || src.open || src.target || src.sub || (typeof src.graph === 'string' ? src.graph : null) || null;
    if (op && typeof op === 'object') { N.preset = op.preset || null; N.focus = op.focus || null; op = op.graph || op.id || null; }
    N.opens = op;
    N.focus = src.focus || src.band || N.focus || null;
    N.preset = src.preset || N.preset || null;
    N.note = src.note || '';
    N.blocked = !!src.blocked;
    N.inner = arr(src.inner);
    N.codexModel = src.codexModel || null;
    N.compact = !!src.compact;
    N.at = Array.isArray(src.at) ? src.at : [0, 0];
    N.pins = { 'in': normPins(src.pins && (src.pins['in'] || src.pins.i), 'in', N), out: normPins(src.pins && (src.pins.out || src.pins.o), 'out', N) };
    N.inW = []; N.outW = [];
    return N;
  }

  /* Layout: widths / heights / pin offsets strictly from metrics (spec §9). */
  function layoutNode(D, N) {
    var M = D.M, W = M.W, c = N.cat;
    var hasExec = N.pins['in'].concat(N.pins.out).some(function (p) { return p.t === 'exec'; });
    var nin = N.pins['in'].length, nout = N.pins.out.length, rows = Math.max(nin, nout);
    var lay;
    if (c === 'VA') lay = (!hasExec && nin <= 1 && nout <= 1) ? 'pill' : 'setv';
    else if (c === 'CL' && (N.compact || nin + nout === 0)) lay = 'compact';
    else if (N.compact && nin + nout === 0) lay = 'compact';
    else if (FLOW[c]) lay = 'flow';
    else if (c === 'PS') lay = 'pure';
    else lay = 'full';
    N.lay = lay;
    var wk = c === 'CP' ? 'composite' : FLOW[c] ? 'flow' : c === 'VA' ? 'var' : (c === 'IN' || c === 'RT') ? 'tunnel' : lay === 'compact' ? 'compact' : 'full';
    if (lay !== 'compact' && N.ci.w && W[N.ci.w]) wk = N.ci.w;
    N.w = +N.src.w || W[wk] || W.full;
    N.banner = N.cond || N.fallback ? (N.fallback ? 'fb' : 'cond') : '';
    var bh = N.banner ? M.BANNER : 0;
    if (lay === 'pill') { N.headH = 0; N.h = M.VAR_H; }
    else if (lay === 'compact') { N.headH = M.COMPACT_H; N.h = M.COMPACT_H + bh; }
    else {
      N.headH = (lay === 'full') ? M.HEAD : M.HEAD_FLOW;
      N.h = rows ? N.headH + M.PAD_T + rows * M.ROW + M.PAD_B + bh : N.headH + 8 + bh;
    }
    N.x = snap(N.at[0] * M.COL);
    N.y = snap(N.at[1] * M.LANE);
    ['in', 'out'].forEach(function (side) {
      N.pins[side].forEach(function (p, r) {
        p.row = r;
        p.rx = side === 'in' ? M.PIN_INSET : N.w - M.PIN_INSET;
        p.ry = (lay === 'pill' || lay === 'compact') ? Math.round((lay === 'pill' ? N.h : M.COMPACT_H) / 2) : N.headH + M.PAD_T + r * M.ROW + M.ROW / 2;
      });
    });
  }
  E.pinPos = function (p) { return { x: p.node.x + p.rx, y: p.node.y + p.ry }; };

  function parseRef(s) {
    s = String(s == null ? '' : s).trim();
    var i = s.indexOf('.');
    return i < 0 ? { n: s, p: null } : { n: s.slice(0, i), p: s.slice(i + 1) };
  }
  E.parseRef = parseRef;
  function findPin(N, side, pid) {
    if (pid == null || pid === '') return null;
    var L = N.pins[side], i, np = norm(pid);
    for (i = 0; i < L.length; i++) if (L[i].id === pid) return L[i];
    for (i = 0; i < L.length; i++) if (norm(L[i].id) === np || (L[i].l && norm(L[i].l) === np)) return L[i];
    for (i = 0; i < L.length; i++) if (L[i].l && norm(L[i].l).indexOf(np) === 0) return L[i];
    if (/^\d+$/.test(pid)) {
      var ex = L.filter(function (p) { return p.t === 'exec'; });
      if (side === 'out' && ex[+pid]) return ex[+pid];
      if (side === 'in' && ex.length > 1 && ex[+pid]) return ex[+pid];
    }
    return null;
  }
  function defaultPin(N, side, type) {
    var L = N.pins[side], i;
    if (!L.length) return null;
    if (type) { for (i = 0; i < L.length; i++) if (L[i].t === type) return L[i]; }
    if (type && type !== 'exec') { for (i = 0; i < L.length; i++) if (L[i].t !== 'exec') return L[i]; }
    for (i = 0; i < L.length; i++) if (L[i].t === 'exec') return L[i];
    return L[0];
  }
  E.findPin = findPin;

  function buildWire(D, G, w, i) {
    var o;
    if (typeof w === 'string') { var gi = w.indexOf('>'); o = { f: w.slice(0, gi), t: w.slice(gi + 1) }; }
    else o = { f: w.f || w.from, t: w.t || w.to, k: w.k || w.kind, via: w.via, badge: w.badge || w.label };
    var a = parseRef(o.f), b = parseRef(o.t);
    var A = G.byId[a.n], B = G.byId[b.n];
    if (!A || !B) { warn('wire ' + G.id + ' «' + o.f + '>' + o.t + '»: unknown node ' + (!A ? a.n : b.n)); return null; }
    var pa = findPin(A, 'out', a.p), pb = findPin(B, 'in', b.p);
    if (a.p && !pa) warn('wire ' + G.id + ' «' + o.f + '>' + o.t + '»: no out pin «' + a.p + '» on ' + A.id);
    if (b.p && !pb) warn('wire ' + G.id + ' «' + o.f + '>' + o.t + '»: no in pin «' + b.p + '» on ' + B.id);
    if (!pa) pa = defaultPin(A, 'out', pb && pb.t);
    if (!pb) pb = defaultPin(B, 'in', pa && pa.t);
    if (!pa) { pa = { id: a.p || 'then', t: (pb && pb.t) || 'exec', l: '', dir: 'out', node: A, wires: [], implicit: true }; A.pins.out.push(pa); }
    if (!pb) { pb = { id: b.p || 'in', t: pa.t, l: '', dir: 'in', node: B, wires: [], implicit: true }; B.pins['in'].push(pb); }
    var k = norm(o.k || '');
    var W = { i: i, graph: G, from: pa, to: pb, A: A, B: B, raw: w, badge: o.badge || '' };
    W.exec = pa.t === 'exec' || k === 'exec';
    W.type = W.exec ? 'exec' : (pa.t !== 'exec' ? pa.t : pb.t);
    W.kind = (k === 'loop' || k === 'fallback' || k === 'blocked') ? k : 'normal';
    W.viaRaw = Array.isArray(o.via) && o.via.length ? (Array.isArray(o.via[0]) ? o.via : [o.via]) : null;
    W.id = A.id + '.' + pa.id + '>' + B.id + '.' + pb.id;
    pa.wires.push(W); pb.wires.push(W); A.outW.push(W); B.inW.push(W);
    return W;
  }

  /* ---------------------------------------------------------------- wire routing (spec §9) */
  function hdir(v) { return v >= 0 ? 1 : -1; }
  function segLen(P, dP, Q, dQ) {
    var dx = Q.x - P.x, dy = Q.y - P.y, adx = Math.abs(dx), ady = Math.abs(dy);
    var hP = dP.y === 0, hQ = dQ.y === 0;
    if (hP && hQ) {
      if (dP.x === dQ.x) {
        if (dx * dP.x >= 0) return clamp(adx * 0.5, Math.min(40, adx * 0.5 + ady * 0.5), 260);
        return clamp(ady * 0.5 + adx * 0.25, 80, 300);
      }
      return clamp(ady * 0.45 + adx * 0.25, 20, 240); // U-turn
    }
    return clamp(Math.max(adx, ady) * 0.55, 16, 260);   // quarter turn
  }
  function routeWire(D, G, W) {
    var M = D.M;
    var a = E.pinPos(W.from), b = E.pinPos(W.to);
    var knots = [];
    if (W.viaRaw) {
      knots = W.viaRaw.map(function (v) { return { x: snap(v[0] * M.COL), y: snap(v[1] * M.LANE), user: true }; });
    } else if (b.x < a.x - 8) {
      // Mildly backward with clear vertical separation → UE-like S-curve (single segment, backward tangents).
      // Strongly backward or overlapping rows → route below both nodes (spec §9).
      var sepV = W.A.y + W.A.h < W.B.y - 16 || W.B.y + W.B.h < W.A.y - 16;
      if (!(sepV && a.x - b.x < M.COL * 0.9 && Math.abs(b.y - a.y) > 70)) {
        var low = Math.max(W.A.y + W.A.h, W.B.y + W.B.h) + 56;
        knots = [{ x: a.x + 48, y: low }, { x: b.x - 48, y: low }];
      }
    }
    var pts = [a].concat(knots, [b]);
    var dirs = pts.map(function (p, i) {
      if (i === 0 || i === pts.length - 1) return { x: 1, y: 0 };
      var dx = pts[i + 1].x - pts[i - 1].x, dy = pts[i + 1].y - pts[i - 1].y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      return Math.abs(dx) >= 0.35 * len ? { x: hdir(dx), y: 0 } : { x: 0, y: hdir(dy) };
    });
    var segs = [], d = 'M' + r1(a.x) + ' ' + r1(a.y);
    for (var i = 0; i < pts.length - 1; i++) {
      var P = pts[i], Q = pts[i + 1], dP = dirs[i], dQ = dirs[i + 1];
      var L = segLen(P, dP, Q, dQ);
      var c1 = { x: P.x + dP.x * L, y: P.y + dP.y * L }, c2 = { x: Q.x - dQ.x * L, y: Q.y - dQ.y * L };
      segs.push([P, c1, c2, Q]);
      d += 'C' + r1(c1.x) + ' ' + r1(c1.y) + ' ' + r1(c2.x) + ' ' + r1(c2.y) + ' ' + r1(Q.x) + ' ' + r1(Q.y);
    }
    W.a = a; W.b = b; W.knots = knots; W.segs = segs; W.d = d;
    // sample for length / pointAt / bounds
    var S = [], len = 0, prev = null, best = { l: -1, i: 0 }, segStart = [];
    segs.forEach(function (s, si) {
      segStart.push(len);
      var sl0 = len;
      for (var k = (si === 0 ? 0 : 1); k <= 24; k++) {
        var t = k / 24, p = bez(s, t);
        if (prev) len += Math.sqrt((p.x - prev.x) * (p.x - prev.x) + (p.y - prev.y) * (p.y - prev.y));
        S.push([p.x, p.y, len]); prev = p;
      }
      if (len - sl0 > best.l) best = { l: len - sl0, i: si, s0: sl0 };
    });
    W.samples = S; W.len = len;
    W.mid = E.pointAt(W, best.s0 + best.l / 2);
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function bez(s, t) {
    var u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * s[0].x + b * s[1].x + c * s[2].x + d * s[3].x, y: a * s[0].y + b * s[1].y + c * s[2].y + d * s[3].y };
  }
  E.pointAt = function (W, l) {
    var S = W.samples; if (!S || !S.length) return { x: 0, y: 0, a: 0 };
    if (l <= 0) return { x: S[0][0], y: S[0][1], a: ang(S[0], S[1] || S[0]) };
    if (l >= W.len) { var z = S[S.length - 1]; return { x: z[0], y: z[1], a: ang(S[S.length - 2] || z, z) }; }
    var lo = 0, hi = S.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (S[mid][2] < l) lo = mid; else hi = mid; }
    var A = S[lo], B = S[hi], f = (l - A[2]) / ((B[2] - A[2]) || 1);
    return { x: A[0] + (B[0] - A[0]) * f, y: A[1] + (B[1] - A[1]) * f, a: ang(A, B) };
  };
  function ang(A, B) { return Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI; }

  function buildGraph(D, g, gi) {
    var G = { id: String(g.id || ('g' + gi)), raw: g, nodes: [], byId: {}, wires: [], wById: {}, comments: [], cById: {} };
    G.tab = g.tab || g.title || G.id;
    G.title = g.title || g.tab || G.id;
    G.parent = g.parent || null;
    G.desc = g.desc || g.d || g.what || '';
    var rawById = {};
    arr(g.nodes).forEach(function (n) { if (n && n.id) rawById[n.id] = n; });
    arr(g.nodes).forEach(function (n) {
      if (!n || !n.id) { warn('graph ' + G.id + ': node without id'); return; }
      if (G.byId[n.id]) { warn('graph ' + G.id + ': duplicate node id ' + n.id); return; }
      var N = buildNode(D, G, n, rawById);
      N.index = G.nodes.length; G.byId[N.id] = N; G.nodes.push(N);
    });
    arr(g.wires).forEach(function (w) {
      var W = buildWire(D, G, w, G.wires.length);
      if (!W) return;
      if (G.wById[W.id]) { W.id += '#' + W.i; }
      G.wById[W.id] = W; G.wires.push(W);
    });
    G.nodes.forEach(function (N) { layoutNode(D, N); });
    G.wires.forEach(function (W) { routeWire(D, G, W); });
    var M = D.M;
    arr(g.comments).forEach(function (c, ci) {
      var mem = arr(c.nodes).map(function (id) { var N = G.byId[id]; if (!N) warn('comment ' + G.id + '/' + (c.id || ci) + ': unknown node ' + id); return N; }).filter(Boolean);
      if (!mem.length) return;
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      mem.forEach(function (N) { var ex = N.instances > 1 ? M.GHOST * 2 : 0; x0 = Math.min(x0, N.x); y0 = Math.min(y0, N.y); x1 = Math.max(x1, N.x + N.w + ex); y1 = Math.max(y1, N.y + N.h + ex); });
      var CP = M.COMMENT_PAD, CB = M.COMMENT_BAR;
      var C = { id: String(c.id || ('c' + ci)), key: c.key != null ? c.key : null, title: c.title || '', color: c.color || '#6b7280',
        d: c.d || c.what || c.desc || c.text || '', nodes: mem, graph: G, raw: c,
        x: x0 - CP, y: y0 - CP - CB, w: (x1 - x0) + CP * 2, h: (y1 - y0) + CP * 2 + CB, bar: CB };
      mem.forEach(function (N) { if (!N.cmt) N.cmt = C; });
      G.cById[C.id] = C; G.comments.push(C);
    });
    // Far zoom counter-scales comment titles; cap each title so its bar never grows into whatever sits
    // above the box (another box or a stray node) and never needs more than the box width (world px).
    G.comments.forEach(function (C) {
      var free = 320;
      G.comments.forEach(function (O) {
        if (O === C || O.x > C.x + C.w || O.x + O.w < C.x || O.y + O.h > C.y + 1) return;
        free = Math.min(free, C.y - (O.y + O.h));
      });
      G.nodes.forEach(function (N) {
        if (C.nodes.indexOf(N) >= 0 || N.x > C.x + C.w || N.x + N.w < C.x || N.y + N.h > C.y + 1) return;
        free = Math.min(free, C.y - (N.y + N.h) - (N.badge && N.cat !== 'HG' ? 30 : 0));
      });
      var byH = (M.COMMENT_BAR + M.COMMENT_PAD - 10 + Math.max(0, free - 10)) / 1.3; // bar may also take the top padding
      var chars = String(C.title).length + (C.key != null ? 2.4 : 0);
      var byW = (C.w - 34) / (chars * 0.6);
      C.cmax = Math.max(18, Math.floor(Math.min(byH, byW)));
    });
    // bookmarks: comments ordered by key then position
    G.marks = G.comments.slice().sort(function (p, q) {
      var kp = p.key == null || !isFinite(+p.key) ? 99 : +p.key, kq = q.key == null || !isFinite(+q.key) ? 99 : +q.key;
      return kp - kq || p.x - q.x;
    });
    // bounds
    var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    function inc(x, y) { if (x < b.x0) b.x0 = x; if (y < b.y0) b.y0 = y; if (x > b.x1) b.x1 = x; if (y > b.y1) b.y1 = y; }
    G.nodes.forEach(function (N) { var ex = N.instances > 1 ? M.GHOST * 2 : 0; inc(N.x, N.y); inc(N.x + N.w + ex, N.y + N.h + ex); });
    G.comments.forEach(function (C) { inc(C.x, C.y); inc(C.x + C.w, C.y + C.h); });
    G.wires.forEach(function (W) { for (var i = 0; i < W.samples.length; i += 4) inc(W.samples[i][0], W.samples[i][1]); });
    if (!isFinite(b.x0)) b = { x0: 0, y0: 0, x1: 400, y1: 300 };
    G.bounds = { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
    G.entry = G.byId[g.entry] || G.nodes.filter(function (N) { return N.cat === 'IN'; })[0] ||
      G.nodes.filter(function (N) { return N.cat === 'EV'; })[0] || G.nodes[0] || null;
    // stats
    var st = { nodes: G.nodes.length, wires: G.wires.length, agents: 0, scripts: 0, gates: 0, models: {} };
    G.nodes.forEach(function (N) {
      if (N.cat === 'AG') st.agents++;
      if (N.cat === 'SC' || N.cat === 'PS') st.scripts++;
      if (N.cat === 'HG') st.gates++;
      if (N.model && N.model.tier) st.models[N.model.tier] = (st.models[N.model.tier] || 0) + 1;
    });
    G.stats = st;
    return G;
  }

  E.load = function (BP) {
    BP = BP || {};
    E.warnings = [];
    var D = { raw: BP, M: mergeMetrics(BP.metrics), defs: BP.defs || {}, graphs: {}, order: [], byDef: {}, rawNodes: {},
      version: BP.pipelineVersion || '', repoBlob: BP.repoBlob || 'https://github.com/desvingns/mobile-pipeline/blob/main/',
      presets: BP.presets || {}, flags: BP.flags || {}, gates: BP.gates || {},
      simCaption: BP.simCaption || '', prefixNote: BP.prefixNote || '' };
    E.D = D;
    D.types = {};
    Object.keys(DEF_TYPES).forEach(function (k) { D.types[k] = assign({}, DEF_TYPES[k]); });
    Object.keys(BP.types || {}).forEach(function (k) { D.types[k] = assign({}, DEF_TYPES[k] || { ru: k, ue: k, color: '#b8c0cc' }, BP.types[k]); });
    D.cats = {};
    Object.keys(DEF_CATS).forEach(function (k) { D.cats[k] = assign({}, DEF_CATS[k]); });
    Object.keys(BP.cats || {}).forEach(function (k) {
      var c = assign({}, DEF_CATS[k] || DEF_CATS.AG, BP.cats[k]);
      var col = BP.cats[k].head || BP.cats[k].colors || BP.cats[k].color;
      if (Array.isArray(col) && col.length) c.head = [col[0], col[1] || col[0]];
      else if (typeof col === 'string' && /^#/.test(col)) c.head = [col, (DEF_CATS[k] || DEF_CATS.AG).head[1]];
      else c.head = (DEF_CATS[k] || DEF_CATS.AG).head;
      D.cats[k] = c;
    });
    arr(BP.graphs).forEach(function (g) { arr(g && g.nodes).forEach(function (n) { if (n && n.id && !D.rawNodes[n.id]) D.rawNodes[n.id] = n; }); });
    arr(BP.graphs).forEach(function (g, gi) {
      if (!g) return;
      var G = buildGraph(D, g, gi);
      if (D.graphs[G.id]) { warn('duplicate graph id ' + G.id); return; }
      D.graphs[G.id] = G; D.order.push(G);
    });
    D.order.forEach(function (G) {
      G.nodes.forEach(function (N) {
        var key = N.defId || N.id.split('@')[0];
        N.instKey = key;
        (D.byDef[key] = D.byDef[key] || []).push(N);
      });
    });
    D.root = D.graphs.overview || D.order[0] || null;
    // composite targets: which node opens each graph (for Back when no stack)
    D.order.forEach(function (G) { G.nodes.forEach(function (N) { if (N.opens && D.graphs[N.opens] && !D.graphs[N.opens].openedBy) D.graphs[N.opens].openedBy = N; }); });
    D.order.forEach(function (G) { if (G.parent && !D.graphs[G.parent]) G.parent = null; });
    return D;
  };
  E.typeColor = function (t) { var T = E.D && E.D.types[t]; return T ? T.color : '#b8c0cc'; };
  E.instancesOf = function (N) { var L = E.D.byDef[N.instKey] || []; return L.length > 1 ? L : []; };
  E.isComposite = function (N) { return !!(N.opens && E.D.graphs[N.opens]); };

  /* ---------------------------------------------------------------- rendering */
  function pinGlyph(p) {
    if (p.t === 'exec') return '<svg class="bp-pg pg-exec" viewBox="0 0 12 14" aria-hidden="true"><path d="M1.6 1.6h4.6L10.6 7l-4.4 5.4H1.6z"/></svg>';
    if (p.arr) {
      var g = '';
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) g += '<rect x="' + (c * 4) + '" y="' + (r * 4) + '" width="3" height="3" rx=".6"/>';
      return '<svg class="bp-pg pg-arr" viewBox="0 0 11 11" aria-hidden="true">' + g + '</svg>';
    }
    return '<i class="bp-pg pg-data" aria-hidden="true"></i>';
  }
  function pinHTML(D, N, p, side) {
    var other = N.pins[side === 'in' ? 'out' : 'in'][p.row];
    var maxw = other ? Math.floor(N.w / 2 - D.M.PIN_INSET - 12) : Math.floor(N.w - 2 * D.M.PIN_INSET - 22);
    var lbl = p.l || '';
    var cls = 'bp-pin pin-' + side + (p.t === 'exec' ? ' is-exec' : ' is-data') + (p.arr ? ' is-arr' : '') + (p.wires.length ? ' is-con' : '');
    var style = 'top:' + p.ry + 'px;--pc:' + E.typeColor(p.t);
    return '<div class="' + cls + '" style="' + style + '" data-pin="' + side + ':' + esc(p.id) + '">' + pinGlyph(p) +
      (lbl && N.lay !== 'pill' ? '<span class="bp-pl" style="max-width:' + maxw + 'px">' + esc(lbl) + '</span>' : '') + '</div>';
  }
  function chipsHTML(N) {
    var s = '';
    if (N.cat === 'AG' && N.model && N.model.info) s += '<span class="bp-chip tier tier-' + N.model.info.l + '" title="' + esc(N.model.info.ru + ' · ' + N.model.id) + '">' + N.model.info.l + '</span>';
    else if (N.cat === 'MS' || N.cat === 'PR') s += '<span class="bp-chip ms">главная сессия</span>';
    else if (N.cat === 'SC' || N.cat === 'PS') s += '<span class="bp-chip sc" title="bash-скрипт · 0 токенов">bash</span>';
    if (N.cat === 'HG' && N.badge) s += '<span class="bp-chip gate' + (/HARD/.test(N.badge) ? ' hard' : '') + '">' + esc(N.badge) + '</span>';
    if (E.isComposite(N)) s += '<button type="button" class="bp-open" tabindex="-1" data-open="' + esc(N.id) + '">Открыть' + E.icon('open') + '</button>';
    return s;
  }
  function ariaLabel(G, N) {
    var t = N.ci.ru + (N.tech ? ' ' + N.tech : '') + ', ' + N.title;
    if (N.model && N.model.info) t += ', модель ' + N.model.info.ru;
    var ins = N.pins['in'].filter(function (p) { return p.t !== 'exec'; }).map(function (p) { return p.l || E.D.types[p.t] && E.D.types[p.t].ru || p.t; });
    var outs = N.pins.out.filter(function (p) { return p.t !== 'exec'; }).map(function (p) { return p.l || E.D.types[p.t] && E.D.types[p.t].ru || p.t; });
    if (ins.length) t += '. Входы: ' + ins.join(', ');
    if (outs.length) t += '. Выходы: ' + outs.join(', ');
    if (N.cond) t += '. Условие: ' + N.cond;
    if (E.isComposite(N)) t += '. Enter — открыть граф';
    return t + '. ' + (N.index + 1) + ' из ' + G.nodes.length;
  }
  /* Zoomed-out titles are counter-scaled; cap them per node (world px, no DOM measuring) so the longest
   * word still fits the header width and never breaks mid-word, and clamp the line count to the height. */
  function titleFit(N) {
    var L = 1;
    String(N.title || '').split(/\s+/).forEach(function (w) { if (w.length > L) L = w.length; });
    var far = Math.floor((N.w - 22) / (0.62 * L)), mid = Math.floor((N.w - 50) / (0.62 * L));
    var lines = N.lay === 'compact' || N.lay === 'pill' ? 1 : N.h >= 120 ? 3 : 2;
    return ';--tfar:' + far + 'px;--tmid:' + mid + 'px;--tl:' + lines;
  }
  function nodeHTML(D, G, N) {
    var ci = N.ci, lay = N.lay;
    var cls = 'bp-node c-' + N.cat + ' lay-' + lay + (N.banner ? ' has-banner' : '') + (N.isSet ? ' is-set' : '') + (E.isComposite(N) ? ' is-cp' : '') + (N.multiIn ? ' is-multi' : '') + (N.pins['in'].length ? ' has-in' : '') + (N.blocked ? ' is-blocked' : '');
    var style = 'left:' + N.x + 'px;top:' + N.y + 'px;width:' + N.w + 'px;height:' + N.h + 'px;--h1:' + ci.head[0] + ';--h2:' + ci.head[1] + titleFit(N);
    var s = '';
    if (N.instances > 1) {
      for (var gi = Math.min(N.instances - 1, 2); gi >= 1; gi--) s += '<div class="bp-ghostcard" style="left:' + (N.x + gi * D.M.GHOST) + 'px;top:' + (N.y + gi * D.M.GHOST) + 'px;width:' + N.w + 'px;height:' + N.h + 'px;--h1:' + ci.head[0] + ';--h2:' + ci.head[1] + '" aria-hidden="true"></div>';
    }
    s += '<div class="' + cls + '" style="' + style + '" data-node="' + esc(N.id) + '" role="button" tabindex="-1" aria-label="' + esc(ariaLabel(G, N)) + '">';
    if (lay === 'pill') {
      var pt = (N.pins.out[0] || N.pins['in'][0] || { t: 'Files' }).t;
      s += '<span class="bp-vstripe" style="background:' + E.typeColor(pt) + '"></span>';
      if (N.isSet) s += '<span class="bp-set">SET</span>';
      s += '<span class="bp-vt"><span class="bp-title">' + esc(N.title) + '</span>' + (N.tech ? '<span class="bp-tech">' + esc(N.tech) + '</span>' : '') + '</span>';
    } else if (lay === 'compact') {
      s += '<div class="bp-head" style="height:' + N.headH + 'px">' + E.icon(ci.icon, 'bp-hi') + '<span class="bp-ht"><span class="bp-title">' + esc(N.title) + '</span>' +
        (N.tech ? '<span class="bp-tech">' + esc(N.tech) + '</span>' : '') + '</span>' + '</div>';
    } else if (lay === 'full') {
      s += '<div class="bp-head" style="height:' + N.headH + 'px">' + E.icon(ci.icon, 'bp-hi') +
        (E.isComposite(N) ? '<span class="bp-cpmark" aria-hidden="true">' + E.icon('open') + '</span>' : '') +
        '<span class="bp-ht"><span class="bp-title">' + esc(N.title) + '</span><span class="bp-sub"><span class="bp-tech">' + esc(N.tech || ci.ue) + '</span>' + chipsHTML(N) + '</span></span>' +
        (N.cat === 'HG' ? E.icon('clock', 'bp-latent') : '') + '</div>';
    } else {
      var head = N.cat === 'VA' ? '<span class="bp-set">' + (N.isSet ? 'SET' : 'GET') + '</span><span class="bp-title">' + esc(N.title) + '</span>' :
        E.icon(ci.icon, 'bp-hi') + '<span class="bp-title">' + esc(N.title) + '</span>';
      var vs = '';
      if (N.cat === 'VA') {
        var dp = N.pins.out.filter(function (p) { return p.t !== 'exec'; })[0] || N.pins['in'].filter(function (p) { return p.t !== 'exec'; })[0];
        vs = ';--vs:' + E.typeColor(dp ? dp.t : 'Files');
      }
      s += '<div class="bp-head" style="height:' + N.headH + 'px' + vs + '">' + head + '</div>';
    }
    N.pins['in'].forEach(function (p) { s += pinHTML(D, N, p, 'in'); });
    N.pins.out.forEach(function (p) { s += pinHTML(D, N, p, 'out'); });
    if (N.banner) s += '<div class="bp-banner b-' + N.banner + '" style="height:' + D.M.BANNER + 'px">' + esc(N.fallback || N.cond) + '</div>';
    if (N.badge && N.cat !== 'HG') s += '<div class="bp-bubble" aria-hidden="true">' + esc(N.badge) + '</div>';
    s += '<div class="bp-state" aria-hidden="true"></div><div class="bp-counter" aria-hidden="true"></div></div>';
    return s;
  }
  function cmtHTML(C) {
    var lum = luminance(C.color);
    var style = 'left:' + C.x + 'px;top:' + C.y + 'px;width:' + C.w + 'px;height:' + C.h + 'px;--cc:' + C.color + ';--ct:' + (lum > 0.36 ? '#101114' : '#ffffff') + ';--cmax:' + (C.cmax || 18) + 'px';
    return '<div class="bp-cmt" style="' + style + '" data-cmt="' + esc(C.id) + '"><div class="bp-cmt-bar" role="button" tabindex="-1" aria-label="Этап: ' + esc(C.title) + '">' +
      (C.key != null ? '<span class="bp-cmt-key">' + esc(C.key) + '</span>' : '') + '<span class="bp-cmt-title">' + esc(C.title) + '</span></div></div>';
  }
  function luminance(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if (!m) return 0.2;
    var n = parseInt(m[1], 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  E.luminance = luminance;

  function wireKindLabel(W) {
    return W.kind === 'loop' ? 'петля' : W.kind === 'fallback' ? 'запасной путь' : W.kind === 'blocked' ? 'заблокировано' : '';
  }
  E.wireKindLabel = wireKindLabel;

  E.renderGraph = function (G) {
    if (G.world) return G.world;
    var D = E.D, B = G.bounds, pad = 400;
    var vb = { x: Math.floor(B.x - pad), y: Math.floor(B.y - pad), w: Math.ceil(B.w + pad * 2), h: Math.ceil(B.h + pad * 2) };
    var cm = G.comments.slice().sort(function (a, b) { return b.w * b.h - a.w * a.h; }).map(cmtHTML).join('');
    var under = '', dat = '', exe = '', knots = '', hit = '', ends = '', badges = '';
    G.wires.forEach(function (W, i) {
      var cls = 'bp-w k-' + W.kind + (W.exec ? ' is-exec' : ' is-data');
      var col = W.exec ? '#ffffff' : E.typeColor(W.type);
      under += '<path class="bp-wu" d="' + W.d + '" style="stroke:' + col + '" data-w="' + i + '"/>';
      var p = '<path class="' + cls + '" d="' + W.d + '" style="--wc:' + col + '" data-w="' + i + '"/>';
      if (W.exec) exe += p; else dat += p;
      hit += '<path class="bp-wh" d="' + W.d + '" data-w="' + i + '"/>';
      W.knots.forEach(function (k) { if (k.user) knots += '<circle class="bp-knot" cx="' + k.x + '" cy="' + k.y + '" r="4.5" style="--wc:' + (W.kind === 'fallback' ? '#9aa3ad' : W.kind === 'blocked' ? '#e5484d' : col) + '"/>'; });
      if (W.kind === 'blocked') ends += '<g class="bp-ban" transform="translate(' + (W.b.x - 22) + ' ' + W.b.y + ')"><circle r="6.5"/><path d="M-4.4 4.4 4.4-4.4"/></g>';
      if (W.badge) badges += '<div class="bp-wbadge k-' + W.kind + '" style="left:' + Math.round(W.mid.x) + 'px;top:' + Math.round(W.mid.y) + 'px">' +
        (W.kind === 'loop' ? E.icon('loop') : '') + esc(W.badge) + '</div>';
    });
    var svg = '<svg class="bp-wires" xmlns="http://www.w3.org/2000/svg" style="left:' + vb.x + 'px;top:' + vb.y + 'px;width:' + vb.w + 'px;height:' + vb.h + 'px" viewBox="' + vb.x + ' ' + vb.y + ' ' + vb.w + ' ' + vb.h + '" aria-hidden="true">' +
      '<g class="w-under">' + under + '</g><g class="w-trail"></g><g class="w-data">' + dat + '</g><g class="w-exec">' + exe + '</g><g class="w-ends">' + ends + '</g><g class="w-knots">' + knots + '</g><g class="w-hit">' + hit + '</g><g class="w-pulses"></g></svg>';
    var nd = G.nodes.map(function (N) { return nodeHTML(D, G, N); }).join('');
    var world = h('div', 'bp-world');
    world.setAttribute('data-graph', G.id);
    world.hidden = true;
    world.innerHTML = '<div class="bp-comments">' + cm + '</div>' + svg + '<div class="bp-nodes">' + nd + badges + '</div>';
    // refs
    var nEls = world.querySelectorAll('.bp-node');
    G.nodes.forEach(function (N, i) { N.el = nEls[i]; N.el._N = N; });
    var cEls = world.querySelectorAll('.bp-cmt');
    Array.prototype.forEach.call(cEls, function (el) { var C = G.cById[el.getAttribute('data-cmt')]; if (C) { C.el = el; el._C = C; } });
    var uEls = world.querySelectorAll('.bp-wu'), hEls = world.querySelectorAll('.bp-wh');
    var mEls = world.querySelectorAll('.w-data .bp-w, .w-exec .bp-w');
    Array.prototype.forEach.call(mEls, function (el) { G.wires[+el.getAttribute('data-w')].el = el; });
    G.wires.forEach(function (W, i) { W.uel = uEls[i]; W.hel = hEls[i]; });
    G.svg = world.querySelector('svg.bp-wires');
    G.trailG = world.querySelector('.w-trail');
    G.pulseG = world.querySelector('.w-pulses');
    G.world = world;
    E.worlds.appendChild(world);
    E.emit('rendered', G);
    return world;
  };

  /* Find a wire by «a.p>b.q» (pins optional, labels accepted); if the graph has no such wire but both
   * nodes exist, return a transient routed wire (not rendered) so a simulation pulse can still travel. */
  E.findWire = function (G, ref) {
    if (!ref || !G) return null;
    var f, t;
    if (typeof ref === 'object') { f = ref.f || ref.from; t = ref.t || ref.to; }
    else { var gi = String(ref).indexOf('>'); if (gi < 0) return null; f = ref.slice(0, gi); t = ref.slice(gi + 1); }
    if (G.wById[f + '>' + t]) return G.wById[f + '>' + t];
    var a = parseRef(f), b = parseRef(t);
    function pm(p, want) { return !want || p.id === want || norm(p.id) === norm(want) || (p.l && norm(p.l) === norm(want)); }
    var cands = G.wires.filter(function (W) { return W.A.id === a.n && W.B.id === b.n && pm(W.from, a.p) && pm(W.to, b.p); });
    if (!cands.length) cands = G.wires.filter(function (W) { return W.A.id === a.n && W.B.id === b.n && pm(W.to, b.p); });
    if (!cands.length) cands = G.wires.filter(function (W) { return W.A.id === a.n && W.B.id === b.n; });
    if (cands.length) return cands.filter(function (W) { return W.exec; })[0] || cands[0];
    var A = G.byId[a.n], B = G.byId[b.n];
    if (!A || !B) return null;
    var pa = findPin(A, 'out', a.p) || defaultPin(A, 'out'), pb = findPin(B, 'in', b.p) || defaultPin(B, 'in', pa && pa.t);
    if (!pa || !pb) return null;
    var W = { i: -1, graph: G, from: pa, to: pb, A: A, B: B, badge: '', exec: pa.t === 'exec', type: pa.t, kind: 'normal', viaRaw: null, temp: true, id: f + '>' + t };
    routeWire(E.D, G, W);
    return W;
  };

  /* edit mode: re-route the wires of one moved node in place */
  E.rerouteNode = function (N) {
    var G = N.graph;
    N.inW.concat(N.outW).forEach(function (W) {
      routeWire(E.D, G, W);
      if (W.el) { W.el.setAttribute('d', W.d); W.uel.setAttribute('d', W.d); W.hel.setAttribute('d', W.d); }
    });
  };

  /* ---------------------------------------------------------------- state */
  var S = E.state = { graph: null, stack: [], view: 'graph', preset: null, visible: false, mounted: false };
  E.cur = function () { return S.graph; };

  /* ---------------------------------------------------------------- camera */
  var KMIN = 0.08, KMAX = 2.0;
  var applyQueued = false, lodNow = '', ikLast = 0, movingTimer = 0;
  E.vw = 1000; E.vh = 600; E.dpr = 1;
  function measure() {
    if (!E.canvas) return;
    var w = E.canvas.clientWidth, hh = E.canvas.clientHeight;
    if (w > 0 && hh > 0) { E.vw = w; E.vh = hh; }
    E.dpr = Math.min(2, window.devicePixelRatio || 1);
    if (E.grid && (E.grid.width !== Math.round(E.vw * E.dpr) || E.grid.height !== Math.round(E.vh * E.dpr))) { E.grid.width = Math.round(E.vw * E.dpr); E.grid.height = Math.round(E.vh * E.dpr); }
    E.inset.t = E.vw < 760 ? 56 : 104;
  }
  E.measure = measure;
  E.requestApply = function () {
    if (applyQueued) return;
    applyQueued = true;
    requestAnimationFrame(function () { applyQueued = false; applyCam(); });
  };
  function applyCam() {
    var G = S.graph; if (!G || !G.world || !G.cam) return;
    var c = G.cam;
    var tx = c.x, ty = c.y;
    if (!E.canvas.classList.contains('is-moving')) { tx = Math.round(tx); ty = Math.round(ty); }
    G.world.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + c.k + ')';
    drawGrid(tx, ty, c.k);
    // LOD
    var lod = c.k >= 0.7 ? 'full' : c.k >= 0.4 ? 'mid' : 'far';
    if (lod !== lodNow) {
      E.canvas.classList.remove('lod-' + lodNow);
      E.canvas.classList.add('lod-' + lod);
      lodNow = lod;
    }
    E.canvas.classList.toggle('lod-xfar', c.k < 0.22);
    if (lod !== 'full' && (Math.abs(c.k - ikLast) / c.k > 0.03) && !E.canvas.classList.contains('is-moving')) {
      G.world.style.setProperty('--ik', (1 / c.k).toFixed(3)); ikLast = c.k;
    } else if (lod === 'full' && ikLast) { G.world.style.removeProperty('--ik'); ikLast = 0; }
    if (E.zoomLabel) E.zoomLabel.textContent = Math.abs(c.k - 1) < 0.02 ? 'Zoom 1:1' : 'Zoom ' + String(Math.round(c.k * 100) / 100).replace('.', ',') + '×';
    E.emit('cam', G);
    if (!E.canvas.classList.contains('is-moving') && lod !== 'full') scheduleIk();
  }
  var ikTimer = 0;
  /* UE grid: minor 16 px (hidden below k 0.5), major 128 px; drawn on a 2D canvas so a pan never
   * repaints DOM backgrounds, and lines stay one device pixel wide at any zoom. */
  function drawGrid(tx, ty, k) {
    var cv = E.grid, x = E.gridCtx; if (!x) return;
    var r = E.dpr, W = cv.width, H = cv.height, lw = Math.max(1, Math.round(r));
    x.clearRect(0, 0, W, H);
    function lines(step, color) {
      if (step < 6) return;
      x.fillStyle = color;
      var ox = ((tx % step) + step) % step, oy = ((ty % step) + step) % step, v;
      for (v = ox; v < E.vw; v += step) x.fillRect(Math.round(v * r), 0, lw, H);
      for (v = oy; v < E.vh; v += step) x.fillRect(0, Math.round(v * r), W, lw);
    }
    if (k >= 0.5) lines(16 * k, 'rgba(255,255,255,0.045)');
    var maj = 128 * k; while (maj < 28) maj *= 2;
    lines(maj, 'rgba(0,0,0,0.5)');
  }
  function scheduleIk() {
    clearTimeout(ikTimer);
    ikTimer = setTimeout(function () { var G = S.graph; if (G && G.cam && G.cam.k < 0.7) { G.world.style.setProperty('--ik', (1 / G.cam.k).toFixed(3)); ikLast = G.cam.k; } }, 120);
  }
  E.markMoving = function () {
    E.canvas.classList.add('is-moving');
    clearTimeout(movingTimer);
    movingTimer = setTimeout(function () { E.canvas.classList.remove('is-moving'); E.requestApply(); }, 160);
  };
  E.killCam = function () { if (E.camTween) { E.camTween.kill(); E.camTween = null; } stopInertia(); };
  E.setCam = function (x, y, k) {
    var G = S.graph; if (!G) return;
    G.cam = { x: x, y: y, k: clamp(k, KMIN, KMAX) };
    E.requestApply();
  };
  E.zoomAt = function (px, py, k2) {
    var G = S.graph; if (!G) return;
    var c = G.cam; k2 = clamp(k2, KMIN, KMAX);
    var wx = (px - c.x) / c.k, wy = (py - c.y) / c.k;
    c.x = px - wx * k2; c.y = py - wy * k2; c.k = k2;
    E.markMoving(); E.requestApply();
  };
  E.panBy = function (dx, dy) {
    var G = S.graph; if (!G) return;
    G.cam.x += dx; G.cam.y += dy; E.requestApply();
  };
  E.flyTo = function (cam, dur) {
    var G = S.graph; if (!G) return;
    E.killCam();
    cam.k = clamp(cam.k, KMIN, KMAX);
    if (E.calm() || !window.gsap || dur === 0) { G.cam = { x: cam.x, y: cam.y, k: cam.k }; E.requestApply(); return; }
    E.canvas.classList.add('is-moving');
    E.camTween = window.gsap.to(G.cam, { x: cam.x, y: cam.y, k: cam.k, duration: dur == null ? 0.55 : dur, ease: 'power3.inOut',
      onUpdate: E.requestApply, onComplete: function () { E.camTween = null; E.canvas.classList.remove('is-moving'); E.requestApply(); } });
  };
  /* Screen area not covered by the HUD (crumbs + stage chips on top). */
  E.inset = { t: 104, b: 16 };
  /* The visible part of the canvas: HUD on top, sim bar at the bottom, and — when the Details panel
   * overlays the canvas (drawer ≤1100px, bottom sheet ≤760px) — the panel too, so a selected node is
   * framed where the viewer can actually see it. */
  var mqDrawer = window.matchMedia ? window.matchMedia('(max-width: 1100px)') : { matches: false };
  var mqSheet = window.matchMedia ? window.matchMedia('(max-width: 760px)') : { matches: false };
  E.view = function () {
    var v = { t: E.inset.t, b: E.inset.b, r: 0 };
    var open = E.root && E.root.classList.contains('dt-open') && !E.root.classList.contains('view-list');
    var aside = open && E.root.querySelector('.bp-details');
    if (aside && mqSheet.matches) {
      var out = E.root.querySelector('.bp-output');
      v.b = Math.max(v.b, aside.offsetHeight - (out ? out.offsetHeight : 0) + 12);
    } else if (aside && mqDrawer.matches) v.r = Math.min(aside.offsetWidth, E.vw * 0.6);
    return v;
  };
  E.camFor = function (wx, wy, k) { var v = E.view(); return { x: (E.vw - v.r) / 2 - wx * k, y: (E.vh + v.t - v.b) / 2 - wy * k, k: k }; };
  E.frameRect = function (r, pad, kmax, kmin) {
    pad = pad == null ? 56 : pad;
    var v = E.view();
    var k = Math.min((E.vw - v.r - pad * 2) / Math.max(r.w, 1), (E.vh - v.t - v.b - pad) / Math.max(r.h, 1));
    k = clamp(k, kmin || KMIN, kmax || 1);
    return E.camFor(r.x + r.w / 2, r.y + r.h / 2, k);
  };
  /* «Show all» keeps the graph clear of the minimap (bottom-left, desktop only) */
  function frameClear(r, pad, kmax) {
    var mm = E.root && E.root.querySelector('.bp-minimap'), b0 = E.inset.b;
    if (mm && mm.offsetParent !== null) E.inset.b = Math.max(b0, mm.offsetHeight + 20);
    var cam = E.frameRect(r, pad, kmax);
    E.inset.b = b0;
    return cam;
  }
  E.fit = function (dur) { var G = S.graph; if (G) E.flyTo(frameClear(G.bounds, 48, 1), dur); };
  E.centerNode = function (N, k, dur) {
    var G = S.graph; if (!G) return;
    k = k || Math.max(G.cam ? G.cam.k : 1, 0.8);
    E.flyTo(E.camFor(N.x + N.w / 2, N.y + N.h / 2, k), dur);
  };
  E.nodeOnScreen = function (N, margin) {
    var G = S.graph, c = G.cam; margin = margin == null ? 0 : margin;
    var x0 = N.x * c.k + c.x, y0 = N.y * c.k + c.y, x1 = (N.x + N.w) * c.k + c.x, y1 = (N.y + N.h) * c.k + c.y;
    var v = E.view(), top = v.t * 0.6, h = E.vh - top - v.b, w = E.vw - v.r;
    return x0 >= w * margin && y0 >= top + h * margin && x1 <= w * (1 - margin) && y1 <= top + h * (1 - margin);
  };
  E.ensureVisible = function (N, dur) {
    if (E.nodeOnScreen(N, 0.04)) return;
    var G = S.graph;
    E.flyTo(E.camFor(N.x + N.w / 2, N.y + N.h / 2, Math.max(G.cam.k, 0.55)), dur == null ? 0.4 : dur);
  };
  E.initialCam = function (G) {
    var r = G.bounds;
    var cam = frameClear(r, 40, 1);
    if (cam.k < 0.4) {
      var k = 0.5, en = G.entry;
      var left = en ? en.x - 60 : r.x;
      var cy = r.y + r.h / 2;
      var avail = E.vh - E.inset.t - E.inset.b;
      if ((r.h * k) > avail - 40 && en) cy = clamp(en.y + en.h / 2, r.y + (avail / 2 - 20) / k, r.y + r.h - (avail / 2 - 20) / k);
      cam = { x: 48 - left * k, y: (E.vh + E.inset.t - E.inset.b) / 2 - cy * k, k: k };
    }
    return cam;
  };

  /* inertia */
  var inertia = null;
  function stopInertia() { if (inertia) { cancelAnimationFrame(inertia.raf); inertia = null; } }
  function startInertia(vx, vy) {
    stopInertia();
    if (E.calm()) return;
    if (Math.sqrt(vx * vx + vy * vy) < 0.25) return;
    var last = now();
    inertia = { vx: vx, vy: vy, raf: 0 };
    (function step() {
      if (!inertia) return;
      var t = now(), dt = Math.min(40, t - last); last = t;
      inertia.vx *= Math.pow(0.93, dt / 16.7); inertia.vy *= Math.pow(0.93, dt / 16.7);
      E.panBy(inertia.vx * dt, inertia.vy * dt); E.markMoving();
      if (Math.abs(inertia.vx) + Math.abs(inertia.vy) < 0.02) { inertia = null; return; }
      inertia.raf = requestAnimationFrame(step);
    })();
  }

  /* ---------------------------------------------------------------- selection */
  function clearSelClasses(G) {
    if (!G.world) return;
    G.world.classList.remove('has-sel');
    G.nodes.forEach(function (N) { if (N.el) N.el.classList.remove('is-sel', 'is-rel', 'is-inst'); });
    G.wires.forEach(function (W) { if (W.el) { W.el.classList.remove('is-hot'); W.uel.classList.remove('is-hot'); } });
    G.comments.forEach(function (C) { if (C.el) C.el.classList.remove('is-sel'); });
  }
  E.select = function (id, opts) {
    opts = opts || {};
    var G = S.graph; if (!G) return;
    var N = id ? G.byId[id] : null;
    clearSelClasses(G);
    G.sel = N ? N.id : null; G.selCmt = null;
    if (E.root) E.root.classList.toggle('dt-open', !!N); // before any camera move: the panel may overlay the canvas
    if (N && N.el) {
      G.world.classList.add('has-sel');
      N.el.classList.add('is-sel', 'is-rel');
      N.inW.concat(N.outW).forEach(function (W) {
        W.el.classList.add('is-hot'); W.uel.classList.add('is-hot');
        W.A.el.classList.add('is-rel'); W.B.el.classList.add('is-rel');
      });
      E.instancesOf(N).forEach(function (I) { if (I !== N && I.graph === G && I.el) I.el.classList.add('is-inst', 'is-rel'); });
      setRoving(N);
      if (opts.fly) E.centerNode(N, opts.k);
      else if (opts.reveal) E.ensureVisible(N);
      if (opts.focus) try { N.el.focus({ preventScroll: true }); } catch (e) { N.el.focus(); }
    }
    E.emit('select', G, N, opts);
    if (!opts.noRoute) E.updateRoute();
  };
  E.selectComment = function (id, opts) {
    opts = opts || {};
    var G = S.graph; if (!G) return;
    var C = G.cById[id]; if (!C) return;
    clearSelClasses(G);
    G.sel = null; G.selCmt = C.id;
    if (E.root) E.root.classList.add('dt-open');
    if (C.el) C.el.classList.add('is-sel');
    if (opts.fly !== false) E.flyTo(E.frameRect(C, 40, 1, 0.3), opts.dur);
    E.emit('selectComment', G, C, opts);
    if (!opts.noRoute) E.updateRoute();
  };
  function setRoving(N) {
    var G = N.graph;
    if (G.roving && G.roving !== N && G.roving.el) G.roving.el.tabIndex = -1;
    G.roving = N; if (N.el) N.el.tabIndex = 0;
  }
  E.setRoving = setRoving;

  /* ---------------------------------------------------------------- graphs & navigation */
  E.setGraph = function (id, opts) {
    opts = opts || {};
    var D = E.D, G = D.graphs[id]; if (!G) return null;
    var prev = S.graph;
    var hadFocus = E.canvas && E.canvas.contains(doc.activeElement);
    if (prev && prev !== G) {
      E.emit('leaveGraph', prev);
      if (prev.world) prev.world.hidden = true;
      E.killCam();
    }
    E.renderGraph(G);
    G.world.hidden = false;
    S.graph = G;
    measure();
    if (opts.cam) G.cam = { x: opts.cam.x, y: opts.cam.y, k: opts.cam.k };
    else if (!G.cam || opts.entry) G.cam = E.initialCam(G);
    lodNow = ''; ikLast = 0;
    E.canvas.classList.remove('lod-full', 'lod-mid', 'lod-far');
    applyCam();
    if (!G._intro) E.intro(G);
    if (!G.roving && G.entry) setRoving(G.entry);
    if (hadFocus && prev !== G && !E.canvas.contains(doc.activeElement)) { var fN = G.roving || G.entry; try { (fN && fN.el || E.canvas).focus({ preventScroll: true }); } catch (x) {} }
    if (opts.preset !== undefined) E.setPreset(opts.preset, G);
    else if (S.preset && S.preset.graph !== G.id) E.setPreset(null);
    E.emit('graph', G, prev, opts);
    if (opts.focusBand) {
      var C = G.cById[opts.focusBand] || G.comments.filter(function (c) { return norm(c.title).indexOf(norm(opts.focusBand)) >= 0; })[0];
      if (C) { G.cam = E.frameRect(C, 40, 1, 0.3); applyCam(); E.selectComment(C.id, { fly: false, noRoute: true }); }
    }
    if (!opts.noRoute) E.updateRoute();
    return G;
  };
  /* First appearance of a graph: comments fade, nodes rise in a left-to-right wave, wires draw along
   * (DrawSVG) like a Blueprint «compile». ≤ 0.9 s; skipped in calm mode. Only on-screen items animate. */
  E.intro = function (G) {
    G._intro = true;
    var gs = window.gsap;
    if (E.calm() || !gs || !G.world) return;
    var c = G.cam, B = G.bounds;
    var vx0 = -c.x / c.k, vy0 = -c.y / c.k, vx1 = vx0 + E.vw / c.k, vy1 = vy0 + E.vh / c.k;
    var span = Math.max(300, Math.min(B.w, vx1 - vx0));
    function vis(x0, y0, x1, y1) { return x1 >= vx0 && x0 <= vx1 && y1 >= vy0 && y0 <= vy1; }
    function delay(x) { return clamp((x - Math.max(B.x, vx0)) / span, 0, 1) * 0.5; }
    G.comments.forEach(function (C) { if (C.el && vis(C.x, C.y, C.x + C.w, C.y + C.h)) gs.fromTo(C.el, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: delay(C.x) * 0.6, ease: 'power1.out', clearProps: 'opacity' }); });
    G.nodes.forEach(function (N) {
      if (!N.el || !vis(N.x, N.y, N.x + N.w, N.y + N.h)) return;
      gs.fromTo(N.el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.38, delay: delay(N.x), ease: 'power2.out', clearProps: 'opacity,transform' });
    });
    var ghosts = G.world.querySelectorAll('.bp-ghostcard, .bp-wbadge, .w-knots, .w-ends');
    gs.fromTo(ghosts, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.45, clearProps: 'opacity' });
    var canDraw = !!(window.DrawSVGPlugin);
    G.wires.forEach(function (W) {
      if (!W.el) return;
      var x0 = Math.min(W.a.x, W.b.x), x1 = Math.max(W.a.x, W.b.x), y0 = Math.min(W.a.y, W.b.y), y1 = Math.max(W.a.y, W.b.y);
      if (!vis(x0, y0, x1, y1)) return;
      var d = delay(W.a.x) + 0.12;
      if (canDraw && W.kind === 'normal') {
        var el = W.el;
        gs.fromTo(el, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.42, delay: d, ease: 'power1.inOut',
          onComplete: function () { el.style.strokeDasharray = ''; el.style.strokeDashoffset = ''; } });
      } else gs.fromTo(W.el, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: d + 0.2, clearProps: 'opacity' });
    });
  };

  E.setPreset = function (name, G) {
    G = G || S.graph;
    var P = name && E.D.presets[name];
    if (S.preset && S.preset.G) S.preset.G.nodes.forEach(function (N) { if (N.el) N.el.classList.remove('is-preset', 'is-pdim'); });
    if (S.preset && S.preset.G && S.preset.G.world) S.preset.G.world.classList.remove('has-preset');
    S.preset = null;
    if (P && G) {
      S.preset = { name: name, graph: P.graph || G.id, banner: P.banner || '', G: G, title: P.title || name, notes: P.notes || {}, src: P.src || '' };
      arr(P.highlight).forEach(function (id) { var N = G.byId[id]; if (N && N.el) N.el.classList.add('is-preset'); });
      arr(P.dim).forEach(function (id) { var N = G.byId[id]; if (N && N.el) N.el.classList.add('is-pdim'); });
      if (G.world) G.world.classList.add('has-preset');
    }
    E.emit('preset', S.preset);
  };
  E.open = function (N) {
    if (!N || !E.isComposite(N)) return;
    var G = S.graph, T = E.D.graphs[N.opens];
    S.stack.push({ graph: G.id, cam: { x: G.cam.x, y: G.cam.y, k: G.cam.k }, sel: N.id });
    E.emit('drill', N, T);
    var go = function () {
      E.setGraph(T.id, { entry: true, preset: N.preset || null, focusBand: N.focus || null });
      var W = T.world;
      if (!E.calm() && window.gsap) window.gsap.fromTo(W, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: 'power1.out', clearProps: 'opacity' });
      if (T.entry && !N.focus) { setRoving(T.entry); try { T.entry.el.focus({ preventScroll: true }); } catch (x) {} }
    };
    if (E.calm() || !window.gsap) { go(); return; }
    var c = G.cam, k2 = Math.min(c.k * 1.9, 2);
    var tgt = E.camFor(N.x + N.w / 2, N.y + N.h / 2, k2);
    E.killCam();
    E.canvas.classList.add('is-moving');
    window.gsap.to(G.world, { opacity: 0, duration: 0.18, ease: 'power1.in' });
    E.camTween = window.gsap.to(G.cam, { x: tgt.x, y: tgt.y, k: tgt.k, duration: 0.18, ease: 'power2.in', onUpdate: E.requestApply,
      onComplete: function () {
        E.camTween = null; E.canvas.classList.remove('is-moving');
        G.cam = { x: S.stack[S.stack.length - 1].cam.x, y: S.stack[S.stack.length - 1].cam.y, k: S.stack[S.stack.length - 1].cam.k };
        window.gsap.set(G.world, { clearProps: 'opacity' });
        go();
      } });
  };
  E.back = function () {
    var G = S.graph; if (!G) return;
    var fr = S.stack.pop();
    if (!fr) {
      if (!G.parent) return;
      var P = E.D.graphs[G.parent];
      var by = G.openedBy && G.openedBy.graph === P ? G.openedBy : null;
      E.setGraph(P.id, {});
      if (by) E.select(by.id, { reveal: true });
      return;
    }
    E.setGraph(fr.graph, { cam: fr.cam });
    if (fr.sel) {
      E.select(fr.sel, {});
      // keep keyboard shortcuts alive: the focused node lived in the graph we just left
      var back = S.graph.byId && S.graph.byId[fr.sel];
      if (back && back.el) back.el.focus({ preventScroll: true });
    }
    var W = S.graph.world;
    if (!E.calm() && window.gsap) window.gsap.fromTo(W, { opacity: 0.2 }, { opacity: 1, duration: 0.2, clearProps: 'opacity' });
  };
  E.goGraph = function (id, opts) { S.stack = []; return E.setGraph(id, opts || {}); };
  E.jump = function (graphId, nodeId, opts) {
    opts = opts || {};
    if (!S.graph || S.graph.id !== graphId) { S.stack = []; E.setGraph(graphId, { noRoute: true }); }
    var G = S.graph, N = G.byId[nodeId];
    if (N) E.select(N.id, { fly: true, k: opts.k || Math.max(G.cam.k, 0.85), focus: opts.focus });
    else E.updateRoute();
  };

  /* ---------------------------------------------------------------- route */
  E.routeString = function () {
    var G = S.graph; if (!G) return '';
    var r = G.id;
    if (E.simRoute && E.simRoute()) r += '/!' + E.simRoute();
    else if (G.sel) r += '/' + G.sel;
    else if (G.selCmt) r += '/~' + G.selCmt;
    return r;
  };
  E.updateRoute = function () {
    if (!S.visible) return;
    var r = E.routeString();
    S.lastRoute = r;
    if (MP.router && MP.router.setSkhemaRoute) MP.router.setSkhemaRoute(r);
  };
  function parseRoute(r) {
    r = String(r || '').replace(/^#/, '').replace(/^skhema\/?/, '').replace(/^\/+|\/+$/g, '');
    var i = r.indexOf('/'), g = i < 0 ? r : r.slice(0, i), rest = i < 0 ? '' : r.slice(i + 1);
    var o = { graph: g, node: null, cmt: null, scen: null };
    if (rest.charAt(0) === '~') o.cmt = rest.slice(1);
    else if (rest.charAt(0) === '!') o.scen = rest.slice(1);
    else if (rest) o.node = rest;
    return o;
  }
  E.parseRoute = parseRoute;
  E.navigate = function (route) {
    var D = E.D, p = parseRoute(route);
    var G = D.graphs[p.graph] || D.root;
    if (!G) return;
    if (S.graph !== G) { S.stack = []; E.setGraph(G.id, { noRoute: true }); }
    if (p.node && G.byId[p.node]) E.select(p.node, { fly: true, k: Math.max(G.cam.k, 0.9), noRoute: true });
    else if (p.cmt && G.cById[p.cmt]) E.selectComment(p.cmt, { noRoute: true });
    else if (p.scen) E.emit('scenarioRoute', p.scen);
    E.updateRoute();
  };

  /* ---------------------------------------------------------------- keyboard navigation */
  function execTarget(N) {
    var w = N.outW.filter(function (W) { return W.exec; })[0] || N.outW[0];
    return w ? w.B : null;
  }
  function execSource(N) {
    var w = N.inW.filter(function (W) { return W.exec; })[0] || N.inW[0];
    return w ? w.A : null;
  }
  function vertNeighbour(N, dir) {
    var G = N.graph, cx = N.x + N.w / 2, cy = N.y + N.h / 2, best = null, bd = Infinity;
    G.nodes.forEach(function (O) {
      if (O === N) return;
      var ox = O.x + O.w / 2, oy = O.y + O.h / 2, dy = (oy - cy) * dir;
      if (dy <= 4) return;
      var d = dy + Math.abs(ox - cx) * 2.2;
      if (d < bd) { bd = d; best = O; }
    });
    return best;
  }
  E.navKey = function (N, key) {
    if (key === 'ArrowRight') return execTarget(N);
    if (key === 'ArrowLeft') return execSource(N);
    if (key === 'ArrowUp') return vertNeighbour(N, -1);
    if (key === 'ArrowDown') return vertNeighbour(N, 1);
    return null;
  };
  E.focusNode = function (N, select) {
    if (!N || !N.el) return;
    setRoving(N);
    E.ensureVisible(N);
    try { N.el.focus({ preventScroll: true }); } catch (e) { N.el.focus(); }
    if (select) E.select(N.id, {});
  };

  /* ---------------------------------------------------------------- shell */
  function buildShell(root) {
    var D = E.D;
    var sec = h('section', 'bp');
    sec.setAttribute('aria-label', 'Схема: технический граф конвейера Mobile Pipeline');
    sec.innerHTML =
      '<header class="bp-toolbar" role="toolbar" aria-label="Инструменты схемы">' +
        '<div class="bp-tb-sim"></div><div class="bp-tb-search"></div><div class="bp-tb-spacer"></div><div class="bp-tb-view"></div><div class="bp-tb-help"></div>' +
        '<span class="bp-ver mono">cmp v' + esc(D.version || '') + '</span>' +
      '</header>' +
      '<nav class="bp-doctabs" aria-label="Графы"></nav>' +
      '<div class="bp-body">' +
        '<div class="bp-main">' +
          '<div class="bp-canvas lod-full" tabindex="0" role="application" aria-roledescription="редактор графа" ' +
            'aria-label="Граф конвейера. Tab — к нодам; стрелки — переход по связям; Enter — выбрать или открыть; / — поиск; F — показать всё; ? — все клавиши.">' +
            '<canvas class="bp-grid" aria-hidden="true"></canvas>' +
            '<div class="bp-watermark" aria-hidden="true">BLUEPRINT</div>' +
            '<div class="bp-worlds"></div>' +
            '<div class="bp-hud bp-ui">' +
              '<div class="bp-crumbs"></div>' +
              '<div class="bp-marks"></div>' +
            '</div>' +
            '<div class="bp-zoom bp-ui" aria-hidden="true">Zoom 1:1</div>' +
            '<div class="bp-overlays bp-ui"></div>' +
          '</div>' +
          '<div class="bp-outline" hidden></div>' +
          '<div class="bp-output"></div>' +
        '</div>' +
        '<aside class="bp-details" role="complementary" aria-label="Детали"></aside>' +
      '</div>' +
      '<div id="bp-live" class="sr-only" aria-live="polite"></div>';
    root.appendChild(sec);
    E.root = sec;
    E.canvas = sec.querySelector('.bp-canvas');
    E.grid = sec.querySelector('.bp-grid');
    E.gridCtx = E.grid.getContext ? E.grid.getContext('2d') : null;
    E.worlds = sec.querySelector('.bp-worlds');
    E.zoomLabel = sec.querySelector('.bp-zoom');
    E.overlays = sec.querySelector('.bp-overlays');
    E.liveEl = sec.querySelector('#bp-live');
  }
  E.live = function (text) {
    var el = E.liveEl; if (!el) return;
    el.textContent = ''; setTimeout(function () { el.textContent = text; }, 30);
  };

  /* ---------------------------------------------------------------- input: pointer / wheel / keys */
  function bindInput() {
    var cv = E.canvas, pointers = {}, gest = null, pinch = null, lastClick = { t: 0, id: null };
    function local(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button, a, input, select, textarea, label, .bp-ui, .bp-menu')) return;
      if (e.pointerType === 'mouse' && e.button > 2) return;
      var p = local(e);
      pointers[e.pointerId] = p;
      E.killCam();
      E.emit('gesture');
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = { d: dist(a, b) || 1, k: S.graph.cam.k, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        gest = null; return;
      }
      var nodeEl = e.target.closest('.bp-node'), cbar = e.target.closest('.bp-cmt-bar');
      gest = { id: e.pointerId, sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: false, btn: e.button, node: nodeEl && nodeEl._N,
        cmt: cbar && cbar.parentNode._C, hist: [[now(), p.x, p.y]], edit: E.editing && nodeEl && e.button === 0 };
      if (gest.edit) gest.at0 = [gest.node.x, gest.node.y];
      if (!nodeEl) try { cv.focus({ preventScroll: true }); } catch (x) {}
    });
    cv.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) { E.emit('hover', e); return; }
      var p = local(e); pointers[e.pointerId] = p;
      if (pinch) {
        var ids = Object.keys(pointers); if (ids.length < 2) return;
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = dist(a, b), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        E.panBy(mx - pinch.mx, my - pinch.my); pinch.mx = mx; pinch.my = my;
        E.zoomAt(mx, my, pinch.k * d / pinch.d);
        return;
      }
      if (!gest || gest.id !== e.pointerId) return;
      var dx = p.x - gest.lx, dy = p.y - gest.ly;
      if (!gest.moved && Math.abs(p.x - gest.sx) + Math.abs(p.y - gest.sy) > 4) { gest.moved = true; cv.classList.add('is-panning'); E.emit('tipHide'); }
      if (gest.moved) {
        if (gest.edit) {
          var k = S.graph.cam.k;
          E.emit('editDrag', gest.node, gest.at0[0] + (p.x - gest.sx) / k, gest.at0[1] + (p.y - gest.sy) / k);
        } else { E.panBy(dx, dy); E.markMoving(); }
        gest.hist.push([now(), p.x, p.y]); if (gest.hist.length > 6) gest.hist.shift();
      }
      gest.lx = p.x; gest.ly = p.y;
    });
    function end(e) {
      if (!pointers[e.pointerId]) return;
      delete pointers[e.pointerId];
      cv.classList.remove('is-panning');
      if (pinch) { if (Object.keys(pointers).length < 2) pinch = null; E.markMoving(); return; }
      var g = gest; gest = null;
      if (!g || g.id !== e.pointerId) return;
      if (g.moved) {
        if (g.edit) { E.emit('editDrop', g.node); return; }
        var H = g.hist, t = now();
        var old = H.filter(function (q) { return t - q[0] < 90; })[0] || H[0], last = H[H.length - 1];
        var dt = Math.max(1, last[0] - old[0]);
        if (e.type === 'pointerup' && t - last[0] < 60) startInertia((last[1] - old[1]) / dt, (last[2] - old[2]) / dt);
        return;
      }
      if (e.type !== 'pointerup') return;
      var p = local(e);
      if (g.btn === 2) { E.emit('context', g.node, p, g.cmt); return; }
      if (g.btn === 1) return;
      if (g.node) {
        var dbl = now() - lastClick.t < 380 && lastClick.id === g.node.id;
        lastClick = { t: now(), id: g.node.id };
        if (dbl && E.isComposite(g.node)) { E.open(g.node); return; }
        E.select(g.node.id, {});
        try { g.node.el.focus({ preventScroll: true }); } catch (x) {}
      } else if (g.cmt) {
        E.selectComment(g.cmt.id, { fly: false });
      } else {
        E.select(null);
        E.emit('bgClick', p);
      }
    }
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('contextmenu', function (e) { if (!e.target.closest('input, textarea')) e.preventDefault(); });
    cv.addEventListener('pointerleave', function () { E.emit('tipHide'); });
    cv.addEventListener('wheel', function (e) {
      if (e.target.closest('.bp-ui .bp-scroll, .bp-menu')) return;
      e.preventDefault();
      if (!S.graph) return;
      E.killCam();
      var p = local(e);
      var dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      var dx = e.deltaMode === 1 ? e.deltaX * 33 : e.deltaX;
      if (e.shiftKey) { E.panBy(-(dy || dx), 0); E.markMoving(); return; }
      var k = S.graph.cam.k, f;
      if (e.ctrlKey) f = Math.exp(-dy * 0.01);
      else { var steps = clamp(dy / 100, -3, 3); if (Math.abs(steps) < 0.25) steps = steps < 0 ? -0.25 : 0.25; f = Math.pow(1.1, -steps); if (Math.abs(dy) >= 50) f = Math.pow(1.1, -Math.round(steps) || -hdir(dy)); }
      E.zoomAt(p.x, p.y, k * f);
      E.emit('tipHide');
    }, { passive: false });
    cv.addEventListener('click', function (e) {
      var ob = e.target.closest('.bp-open');
      if (ob) { var N = S.graph.byId[ob.getAttribute('data-open')]; if (N) E.open(N); }
    });
    cv.addEventListener('focusin', function (e) {
      var el = e.target.closest('.bp-node');
      if (el && el._N) { setRoving(el._N); if (!E.pointerFocus) E.ensureVisible(el._N); }
    });
    cv.addEventListener('keydown', onCanvasKey);
    E.root.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'f' || e.key === 'F' || e.key === 'k' || e.key === 'K')) { e.preventDefault(); E.emit('searchFocus'); }
      if (e.ctrlKey && e.altKey && (e.key === 'e' || e.key === 'E' || e.code === 'KeyE')) { e.preventDefault(); E.emit('toggleEdit'); }
    });
  }
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

  function onCanvasKey(e) {
    if (e.target.closest('input, textarea, select')) return;
    var G = S.graph; if (!G) return;
    var fe = doc.activeElement, N = fe && fe._N ? fe._N : null;
    var k = e.key, cam = G.cam;
    // layout-independent shortcuts (RU layout: the / key types «.», F types «а»)
    if (e.code === 'Slash') k = e.shiftKey ? '?' : '/';
    else if (/^Key[A-Z]$/.test(e.code || '') && k && k.length === 1 && !/[a-z]/i.test(k)) k = e.shiftKey ? e.code.slice(3) : e.code.slice(3).toLowerCase();
    if (e.altKey && k === 'ArrowUp') { e.preventDefault(); E.back(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^Arrow/.test(k)) {
      e.preventDefault();
      if (!N) {
        if (e.shiftKey || fe === E.canvas && !G.roving) { var st = 80; E.panBy(k === 'ArrowLeft' ? st : k === 'ArrowRight' ? -st : 0, k === 'ArrowUp' ? st : k === 'ArrowDown' ? -st : 0); return; }
        E.focusNode(G.roving || G.entry, false); return;
      }
      var T = E.navKey(N, k);
      if (T) E.focusNode(T, false);
      return;
    }
    switch (k) {
      case 'Enter':
        e.preventDefault();
        if (N) { if (G.sel === N.id && E.isComposite(N)) E.open(N); else E.select(N.id, {}); }
        else if (fe === E.canvas) E.focusNode(G.roving || G.entry, false);
        return;
      case 'Backspace': e.preventDefault(); E.back(); return;
      case 'Escape':
        if (G.sel || G.selCmt) { e.preventDefault(); E.select(null); }
        E.emit('escape');
        return;
      case 'f': case 'F': case 'а': case 'А': e.preventDefault(); E.fit(); return;
      case '0': e.preventDefault(); E.flyTo(E.camFor((E.vw / 2 - cam.x) / cam.k, (E.vh / 2 - cam.y) / cam.k, 1), 0.3); return;
      case 'Home': e.preventDefault(); if (G.entry) { E.centerNode(G.entry, Math.max(cam.k, 0.9)); E.focusNode(G.entry, false); } return;
      case '+': case '=': e.preventDefault(); E.zoomAt(E.vw / 2, E.vh / 2, cam.k * 1.2); return;
      case '-': case '_': e.preventDefault(); E.zoomAt(E.vw / 2, E.vh / 2, cam.k / 1.2); return;
      case '/': e.preventDefault(); E.emit('searchFocus'); return;
    }
    if (/^[1-9]$/.test(k)) {
      var C = G.marks.filter(function (c) { return String(c.key) === k; })[0] || G.marks[+k - 1];
      if (C) { e.preventDefault(); E.selectComment(C.id, {}); }
      return;
    }
    E.emit('key', e, N, k);
  }
  E.onCanvasKey = onCanvasKey;

  /* ---------------------------------------------------------------- public contract */
  function mount(rootEl, route) {
    if (S.mounted) return;
    if (!window.BP) { rootEl.insertAdjacentHTML('beforeend', '<div class="skhema-skeleton">Нет данных схемы (window.BP).</div>'); return; }
    if (window.gsap) { try { window.gsap.registerPlugin.apply(window.gsap, [window.MotionPathPlugin, window.DrawSVGPlugin].filter(Boolean)); } catch (e) {} }
    E.D = E.load(window.BP);
    if (E.warnings.length) console.warn('[bp] data warnings (' + E.warnings.length + '):\n  ' + E.warnings.slice(0, 40).join('\n  '));
    buildShell(rootEl);
    bindInput();
    S.mounted = true;
    E.emit('mount', E.root);
    measure();
    if (window.ResizeObserver) {
      new ResizeObserver(function () {
        var ow = E.vw, oh = E.vh; measure();
        var G = S.graph;
        if (G && G.cam && (ow !== E.vw || oh !== E.vh)) { G.cam.x += (E.vw - ow) / 2; G.cam.y += (E.vh - oh) / 2; E.requestApply(); }
        E.emit('resize');
      }).observe(E.canvas);
    } else window.addEventListener('resize', function () { measure(); E.emit('resize'); });
    S.pendingRoute = route || '';
  }
  /* router.js appends blueprint.css and the scripts at the same time; the first camera must not be
   * computed from an unstyled (zero-height) canvas, so wait until the stylesheet applies (≤ 2 s). */
  function styled() { return getComputedStyle(E.root).display === 'flex' && E.root.clientHeight > 40; }
  function whenStyled(fn) {
    if (styled()) { fn(); return; }
    var n = 0;
    (function poll() { if (styled() || ++n > 120) fn(); else requestAnimationFrame(poll); })();
  }
  function show(route) {
    if (!S.mounted) return;
    S.visible = true;
    var r = route == null ? '' : String(route);
    S.showSeq = (S.showSeq || 0) + 1;
    var seq = S.showSeq;
    whenStyled(function () {
      if (seq !== S.showSeq || !S.visible) return;
      measure();
      if (S.graph && (!r || r === S.lastRoute)) { E.requestApply(); E.updateRoute(); }
      else E.navigate(r);
      E.emit('show');
    });
  }
  function hide() {
    S.visible = false;
    E.killCam();
    E.emit('hide');
  }
  window.MP_SKHEMA = { mount: mount, show: show, hide: hide };
})();
