#!/usr/bin/env node
/* validate-blueprint.cjs — checks assets/js/blueprint-data.js (window.BP) against
 * docs/design-skhema.md §0 and §12 and against the repo it describes.
 *
 * Usage: node tools/validate-blueprint.cjs [--coverage] [--quiet] [--layout] [--render]
 *   --coverage   also list agent templates / scripts that no def references (informational)
 *   --quiet      print only FAIL / warn lines and the summary
 *   --layout     print every node rectangle and comment box (debug)
 * Prints "ok …", "warn …", "FAIL …" lines; exits 1 when any FAIL was printed.
 * Repo root = showcase/.. ; no dependencies.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SHOWCASE = path.resolve(__dirname, '..');
const REPO = path.resolve(SHOWCASE, '..');
const DATA = path.join(SHOWCASE, 'assets', 'js', 'blueprint-data.js');
const argv = process.argv.slice(2);
const QUIET = argv.includes('--quiet');
const COVERAGE = argv.includes('--coverage');
const LAYOUT = argv.includes('--layout');

let fails = 0, warns = 0, oks = 0;
function ok(name, detail) { oks++; if (!QUIET) console.log('ok   ' + name + (detail ? ' — ' + detail : '')); }
function fail(name, detail) { fails++; console.log('FAIL ' + name + (detail ? ': ' + detail : '')); }
function warn(name, detail) { warns++; console.log('warn ' + name + (detail ? ': ' + detail : '')); }
/* run one named check that collects problems; prints ok or FAIL (first 12 problems) */
function check(name, fn, level) {
  const probs = [];
  try { fn((m) => probs.push(m)); } catch (e) { probs.push('exception: ' + (e && e.stack || e)); }
  if (!probs.length) ok(name);
  else {
    const rep = level === 'warn' ? warn : fail;
    rep(name, probs.length + ' problem(s)');
    probs.slice(0, 40).forEach((p) => console.log('       · ' + p));
    if (probs.length > 40) console.log('       · … ' + (probs.length - 40) + ' more');
  }
  return probs.length === 0;
}

/* ------------------------------------------------------------------ load */
let BP;
try {
  const sandbox = { window: {}, console: console };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(DATA, 'utf8'), sandbox, { filename: 'blueprint-data.js' });
  BP = sandbox.window.BP;
  if (!BP) throw new Error('window.BP is not defined');
  ok('load', path.relative(REPO, DATA).split(path.sep).join('/'));
} catch (e) {
  fail('load', e.message);
  process.exit(1);
}

const GRAPH_IDS = ['overview', 'spec', 'feature', 'learn'];
const CATS = ['EV', 'IN', 'RT', 'END', 'AG', 'MS', 'SC', 'PS', 'HG', 'BR', 'SW', 'PA', 'JN', 'VA', 'CP', 'CL', 'PR'];
const FLOW = ['BR', 'SW', 'PA', 'JN'];
const TIERS = ['haiku', 'sonnet', 'opus'];
const KINDS = ['data', 'exec', 'loop', 'fallback', 'blocked'];
const ID_RE = /^[a-z0-9][a-z0-9@-]*$/;
const REQUIRED_NODES = ['overview/fn-plan', 'spec/fn-scout', 'spec/fn-biz', 'spec/cp-crawl', 'spec/fn-req', 'spec/fn-nfr', 'spec/fn-eval',
  'feature/fn-ui', 'feature/fn-dev', 'feature/fn-sem', 'feature/fn-arch', 'feature/fn-tester', 'feature/fn-verify', 'feature/fn-docs',
  'feature/sc-size', 'feature/sc-route', 'feature/sc-review', 'feature/sc-run', 'feature/g-push',
  'learn/fn-knowledge', 'learn/fn-reflect', 'learn/sc-deliver', 'learn/sc-record'];
const REQUIRED_SCENARIOS = { feature: ['ft-happy', 'ft-autofix', 'ft-repair', 'ft-reject'], spec: ['sp-clone-ok', 'sp-critic'], overview: ['ov-clone'], learn: ['ln-low'] };

const exists = (rel) => fs.existsSync(path.join(REPO, rel));
const isHex = (c) => /^#[0-9a-fA-F]{6}$/.test(String(c));

/* ------------------------------------------------------------------ top level */
check('top-level shape', (p) => {
  ['schema', 'pipelineVersion', 'repoBlob', 'metrics', 'types', 'cats', 'defs', 'graphs', 'presets', 'scenarios'].forEach((k) => {
    if (BP[k] == null) p('missing BP.' + k);
  });
  if (BP.schema !== 1) p('schema must be 1');
  if (!/^https:\/\/github\.com\/desvingns\/mobile-pipeline\/blob\/main\/$/.test(BP.repoBlob || '')) p('repoBlob: ' + BP.repoBlob);
  const ids = (BP.graphs || []).map((g) => g.id);
  if (JSON.stringify(ids) !== JSON.stringify(GRAPH_IDS)) p('graphs must be ' + GRAPH_IDS.join(',') + ' in order, got ' + ids.join(','));
  const m = BP.metrics || {};
  ['COL', 'LANE', 'HEAD', 'HEAD_FLOW', 'ROW', 'PAD_T', 'PAD_B', 'BANNER', 'PIN_INSET'].forEach((k) => { if (typeof m[k] !== 'number') p('metrics.' + k); });
  if (!m.W) p('metrics.W'); else ['full', 'composite', 'flow', 'var', 'tunnel', 'compact'].forEach((k) => { if (typeof m.W[k] !== 'number') p('metrics.W.' + k); });
  if (m.COL !== 336 || m.LANE !== 176) p('COL/LANE must be 336/176');
});

(function versionCheck() {
  let v = '';
  try { v = fs.readFileSync(path.join(REPO, 'VERSION'), 'utf8').trim(); } catch (e) { /* */ }
  if (v && v === BP.pipelineVersion) ok('pipelineVersion = ../VERSION', v);
  else warn('pipelineVersion = ../VERSION', 'data ' + BP.pipelineVersion + ' vs VERSION ' + (v || '?'));
})();

/* ------------------------------------------------------------------ types, cats */
function lum(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };

check('types: 14 pin types with ru/ue/color', (p) => {
  const keys = Object.keys(BP.types || {});
  if (keys.length !== 14) p('expected 14 types, got ' + keys.length);
  if (!BP.types.exec) p('missing exec');
  keys.forEach((k) => { const t = BP.types[k]; if (!t.ru || !t.ue || !isHex(t.color)) p(k + ' incomplete'); });
});
check('cats: known, header colours contrast ≥ 4.5 vs #fff', (p) => {
  CATS.forEach((c) => {
    const d = BP.cats[c];
    if (!d) return p('missing cat ' + c);
    if (!d.ru || !d.ue) p(c + ' ru/ue');
    if (!Array.isArray(d.head) || d.head.length !== 2 || !d.head.every(isHex)) return p(c + ' head colours');
    d.head.forEach((h) => { const r = contrast(h, '#ffffff'); if (r < 4.5) p(c + ' ' + h + ' contrast ' + r.toFixed(2)); });
    if (!BP.metrics.W[d.w]) p(c + ' width key ' + d.w);
  });
  Object.keys(BP.cats).forEach((c) => { if (!CATS.includes(c)) p('unknown cat ' + c); });
});

/* ------------------------------------------------------------------ text helpers */
function sentences(t) {
  return String(t || '').trim().split(/(?<=[.!?…])["»)]*\s+/).filter((s) => s.trim().length > 0);
}
function cyrRatio(t) {
  const cyr = (String(t).match(/[А-Яа-яЁё]/g) || []).length;
  const lat = (String(t).match(/[A-Za-z]/g) || []).length;
  return cyr + lat ? cyr / (cyr + lat) : 0;
}
function oneLine(s) { return typeof s === 'string' && !/[\r\n]/.test(s); }

/* ------------------------------------------------------------------ frontmatter / codex tables */
function frontmatter(abs) {
  let txt;
  try { txt = fs.readFileSync(abs, 'utf8').replace(/^\uFEFF/, ''); } catch (e) { return null; }
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(txt);
  if (!m) return null;
  const fm = {};
  m[1].split(/\r?\n/).forEach((line) => {
    const i = line.indexOf(':');
    if (i > 0 && /^[a-z_]+$/.test(line.slice(0, i).trim())) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return fm;
}
function tierOf(model) {
  const s = String(model).toLowerCase();
  return s.includes('opus') ? 'opus' : s.includes('haiku') ? 'haiku' : s.includes('sonnet') ? 'sonnet' : '?';
}
function codexTables() {
  const out = {};
  try {
    fs.readFileSync(path.join(REPO, 'templates/dev/codex/skills/mp-dev/references/codex-agent-shims.md'), 'utf8').split(/\r?\n/).forEach((l) => {
      const m = /^\|\s*`([a-z0-9-]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/.exec(l);
      if (m) out[m[1]] = { model: m[2], effort: m[3], sandbox: m[4] };
    });
  } catch (e) { /* */ }
  try {
    const m = /AGENTS='([\s\S]*?)'/.exec(fs.readFileSync(path.join(REPO, 'install-spec.sh'), 'utf8'));
    if (m) m[1].split(/\r?\n/).forEach((l) => { const q = l.split('|'); if (q.length >= 3) out[q[0].trim()] = { model: q[1].trim(), effort: q[2].trim() }; });
  } catch (e) { /* */ }
  return out;
}
const CODEX = codexTables();

/* ------------------------------------------------------------------ defs */
const defs = BP.defs || {};
function eff(node) {
  const d = defs[node.def] || {};
  const e = Object.assign({}, d, node);
  e.d = d.d; e._def = d;
  return e;
}
function checkPins(where, pins, p) {
  if (!pins || !Array.isArray(pins.in) || !Array.isArray(pins.out)) return p(where + ': pins {in,out} missing');
  ['in', 'out'].forEach((side) => {
    const seen = {};
    let dataSeen = false;
    pins[side].forEach((pin) => {
      if (!pin.id || !/^[a-z0-9][a-z0-9_-]*$/i.test(pin.id)) p(where + ' ' + side + ' pin id ' + JSON.stringify(pin.id));
      if (seen[pin.id]) p(where + ' duplicate ' + side + ' pin ' + pin.id);
      seen[pin.id] = 1;
      if (!BP.types[pin.t]) p(where + ' ' + side + '.' + pin.id + ' unknown type ' + pin.t);
      if (pin.t === 'exec') { if (dataSeen) p(where + ' ' + side + ': exec rows must come first (' + pin.id + ')'); }
      else dataSeen = true;
      if (pin.l && pin.l.length > 24) p(where + ' ' + side + '.' + pin.id + ' label > 24: "' + pin.l + '" (' + pin.l.length + ')');
      if (pin.t !== 'exec' && !pin.l) p(where + ' ' + side + '.' + pin.id + ' data pin without label');
    });
  });
}
const allSrc = new Set();
check('defs: category, required fields, pins, text', (p) => {
  Object.keys(defs).forEach((k) => {
    const d = defs[k];
    const w = 'def ' + k;
    if (!CATS.includes(d.cat)) return p(w + ': unknown cat ' + d.cat);
    if (!d.title) p(w + ': title'); else if (d.title.length > 32) p(w + ': title > 32 "' + d.title + '" (' + d.title.length + ')');
    checkPins(w, d.pins, p);
    if (!d.d || !d.d.what) p(w + ': d.what');
    else {
      const n = sentences(d.d.what).length;
      if (n < 2 || n > 4) p(w + ': d.what has ' + n + ' sentence(s)');
      const r = cyrRatio(d.d.what);
      if (r < 0.5) p(w + ': d.what mostly non-Cyrillic (' + Math.round(r * 100) + '%)');
    }
    if (!Array.isArray(d.src) || !d.src.length) p(w + ': src[]');
    (d.src || []).concat(d.also || []).forEach((s) => allSrc.add(s));
    if (d.cat === 'AG' || d.cat === 'SC' || d.cat === 'PS') {
      if (!d.tech) p(w + ': tech');
      if (!d.sample) p(w + ': sample');
      if (!d.d || !d.d.stops) p(w + ': d.stops');
      if (!d.d || !d.d.order) p(w + ': d.order');
      if (!d.codex) p(w + ': codex note');
    }
    if (d.cat === 'AG' && d.routed) {
      /* a routed role (DEVELOPER_AGENT): no model of its own — every option is a real agent def */
      if (d.model) p(w + ': a routed role has no fixed model');
      if (!Array.isArray(d.routed) || d.routed.length < 2) p(w + ': routed[] needs ≥2 agent defs');
      (d.routed || []).forEach((r) => {
        const o = defs[r];
        if (!o || o.cat !== 'AG' || o.routed) return p(w + ': routed option ' + r + ' is not an agent def');
        if (JSON.stringify(o.tools || []) !== JSON.stringify(d.tools || [])) p(w + ': tools differ from routed option ' + r);
      });
      if (!Array.isArray(d.tools) || !d.tools.length) p(w + ': tools[]');
    } else if (d.cat === 'AG') {
      if (!d.model || !TIERS.includes(d.model.tier) || !d.model.id) p(w + ': model {tier,id}');
      if (!Array.isArray(d.tools) || !d.tools.length) p(w + ': tools[]');
      if (!d.codexModel) p(w + ': codexModel');
    }
    if (d.routed && d.cat !== 'AG') p(w + ': routed[] only on agents');
    if (d.cat === 'SC' || d.cat === 'PS') {
      if (!(d.flags || []).includes('zero-tokens')) p(w + ': scripts carry the zero-tokens flag');
    }
    if (d.cat === 'PS' && d.pins && d.pins.in.concat(d.pins.out).some((x) => x.t === 'exec')) p(w + ': pure script with exec pins');
    if (d.cat === 'HG') {
      if (!BP.gates[d.gate] && d.gate !== 'always') p(w + ': gate ' + d.gate);
      if (!d.badge) p(w + ': badge');
      if (!d.d || !d.d.human) p(w + ': d.human');
      if (!d.codex) p(w + ': codex note (how the gate is asked)');
    }
    if (d.cat === 'CP' && !GRAPH_IDS.includes(d.graph)) p(w + ': composite graph ' + d.graph);
    if (d.cat === 'CL') {
      if (d.compact && d.pins && (d.pins.in.length || d.pins.out.length)) p(w + ': compact CL must have no pins');
      (d.inner || []).forEach((it) => {
        if (typeof it === 'string') { if (!defs[it]) p(w + ': inner def ' + it + ' missing'); }
        else { if (!it.tech || !it.src) p(w + ': inner item needs tech+src'); else allSrc.add(it.src); }
      });
      if (d.open && (!GRAPH_IDS.includes(d.open.graph) || (d.open.preset && !BP.presets[d.open.preset]))) p(w + ': open target');
    }
    if (d.cat === 'END' && d.pins && (d.pins.out.length || d.pins.in.some((x) => x.t !== 'exec'))) p(w + ': END is exec-in only');
    if ((d.cat === 'IN' || d.cat === 'EV') && d.pins && d.pins.in.length) p(w + ': ' + d.cat + ' has no inputs');
    if (d.cat === 'RT' && d.pins && d.pins.out.length) p(w + ': RT has no outputs');
    if (d.cat === 'VA' && d.pins && !d.exec) {
      if (d.pins.in.length > 1 || d.pins.out.length > 1) p(w + ': variable pill has ≤1 in and ≤1 out');
      if (d.pins.in.concat(d.pins.out).some((x) => x.t === 'exec')) p(w + ': variable pill without exec flag has exec pins');
    }
    if (d.cat === 'VA' && d.get && d.pins && d.pins.in.length) p(w + ': getter with inputs');
    if (d.sample != null) {
      if (!oneLine(d.sample)) p(w + ': sample must be one line');
      else if (/^[\[{]/.test(d.sample)) { try { JSON.parse(d.sample); } catch (e) { p(w + ': sample JSON: ' + e.message); } }
    }
    (d.flags || []).forEach((f) => { if (!BP.flags[f]) p(w + ': unknown flag ' + f); });
    const tools = d.tools || [];
    if ((d.flags || []).includes('edits') && !tools.some((t) => t === 'Write' || t === 'Edit')) p(w + ': flag edits without Write/Edit');
    if ((d.flags || []).includes('no-bash') && tools.includes('Bash')) p(w + ': flag no-bash but tools has Bash');
    if (d.cat === 'AG' && !tools.includes('Bash') && !(d.flags || []).includes('no-bash')) p(w + ': no Bash in tools — add the no-bash flag');
  });
});

check('src/also/inner paths exist (repo root = showcase/..)', (p) => {
  allSrc.forEach((s) => { if (!exists(s)) p(s); });
  if (BP.presets) Object.keys(BP.presets).forEach((k) => { if (BP.presets[k].src && !exists(BP.presets[k].src)) p('preset ' + k + ' src ' + BP.presets[k].src); });
});

check('model/tools = templates/**/agents/*.md frontmatter', (p) => {
  Object.keys(defs).filter((k) => defs[k].cat === 'AG' && !defs[k].routed).forEach((k) => {
    const d = defs[k];
    const agentSrc = (d.src || []).find((s) => /^templates\/.+\/agents\/[^/]+\.md$/.test(s));
    if (!agentSrc) return p(k + ': no templates/**/agents/*.md in src');
    let fm = frontmatter(path.join(REPO, agentSrc));
    let from = agentSrc;
    if (!fm) {
      const base = path.basename(agentSrc, '.md').replace('{{PREFIX}}', 'mp');
      for (const plug of ['claude-plugins/mp-dev/agents/', 'claude-plugins/mp-spec/agents/']) {
        const alt = path.join(REPO, plug + base + '.md');
        if (fs.existsSync(alt)) { fm = frontmatter(alt); from = plug + base + '.md'; break; }
      }
    }
    if (!fm) return p(k + ': no frontmatter (and no claude-plugins fallback) for ' + agentSrc);
    if (!d.model || fm.model !== d.model.id) p(k + ': model.id ' + (d.model && d.model.id) + ' ≠ ' + fm.model + ' (' + from + ')');
    if (d.model && tierOf(fm.model) !== d.model.tier) p(k + ': tier ' + d.model.tier + ' ≠ ' + tierOf(fm.model));
    const tools = (fm.tools || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (JSON.stringify(tools) !== JSON.stringify(d.tools || [])) p(k + ': tools ' + JSON.stringify(d.tools) + ' ≠ ' + JSON.stringify(tools) + ' (' + from + ')');
    const name = String(fm.name || '').replace('{{PREFIX}}', 'mp').replace('{{PLATFORM}}', 'android');
    if (name && name !== d.tech.split(' ')[0]) p(k + ': tech ' + d.tech + ' ≠ frontmatter name ' + name);
  });
});

check('codexModel = codex-agent-shims.md / install-spec.sh tables', (p) => {
  Object.keys(defs).filter((k) => defs[k].cat === 'AG' && !defs[k].routed).forEach((k) => {
    const d = defs[k], want = CODEX[d.tech.split(' ')[0]];
    if (!want) return p(k + ': no Codex tier row for ' + d.tech);
    if (!d.codexModel) return;
    ['model', 'effort', 'sandbox'].forEach((f) => { if (want[f] && want[f] !== d.codexModel[f]) p(k + ': codex ' + f + ' ' + d.codexModel[f] + ' ≠ ' + want[f]); });
    if (d.codex && d.codexModel && d.codex.indexOf(d.codexModel.model) < 0) p(k + ': codex note does not name ' + d.codexModel.model);
  });
});

/* ------------------------------------------------------------------ graphs */
const M = BP.metrics;
const snap = (v) => Math.round(v / 8) * 8;
function geom(n) {
  const e = eff(n);
  const cat = e.cat;
  const x = snap(n.at[0] * M.COL), y = snap(n.at[1] * M.LANE);
  let w, h;
  if (cat === 'CL' && e.compact) { w = M.W.compact; h = M.COMPACT_H || 36; }
  else if (cat === 'VA' && !e.exec) { w = M.W.var; h = M.VAR_H || 36; }
  else {
    w = M.W[BP.cats[cat].w];
    const head = (FLOW.includes(cat) || cat === 'PS') ? M.HEAD_FLOW : M.HEAD;
    const rows = Math.max(e.pins.in.length, e.pins.out.length, 1);
    h = head + M.PAD_T + rows * M.ROW + M.PAD_B + ((e.cond || e.fallback) ? M.BANNER : 0);
  }
  const ghost = e.instances > 1 ? (M.GHOST || 8) * (e.instances - 1) : 0;
  return { x: x, y: y, w: w, h: h, W: w + ghost, H: h + ghost, cat: cat, e: e };
}
function pinXY(g, side, pinId) {
  const e = g.e;
  const list = e.pins[side];
  const row = list.findIndex((q) => q.id === pinId);
  const px = side === 'in' ? g.x + M.PIN_INSET : g.x + g.w - M.PIN_INSET;
  if (g.h <= 36) return { x: px, y: g.y + g.h / 2 };
  const head = (FLOW.includes(g.cat) || g.cat === 'PS') ? M.HEAD_FLOW : M.HEAD;
  return { x: px, y: g.y + head + M.PAD_T + row * M.ROW + M.ROW / 2 };
}
function parseWire(w) {
  if (typeof w === 'string') { const s = w.split('>'); return { f: s[0], t: s[1], k: null, via: null, raw: w }; }
  return { f: w.f, t: w.t, k: w.k || null, via: w.via || null, badge: w.badge, raw: w.f + '>' + w.t };
}
const splitEnd = (s) => { const i = s.indexOf('.'); return [s.slice(0, i), s.slice(i + 1)]; };

const G = {};
(BP.graphs || []).forEach((g) => {
  const nodes = {};
  (g.nodes || []).forEach((n) => { nodes[n.id] = n; });
  G[g.id] = { g: g, nodes: nodes, wires: (g.wires || []).map(parseWire), geo: {} };
});

GRAPH_IDS.forEach((gid) => {
  const X = G[gid];
  if (!X) return;
  const g = X.g;
  check(gid + ': node ids, defs, overrides', (p) => {
    const seen = {};
    g.nodes.forEach((n) => {
      if (!ID_RE.test(n.id)) p('bad id ' + n.id);
      if (seen[n.id]) p('duplicate id ' + n.id);
      seen[n.id] = 1;
      if (!defs[n.def]) return p(n.id + ': def ' + n.def + ' missing');
      if (!Array.isArray(n.at) || n.at.length !== 2 || n.at.some((v) => typeof v !== 'number')) p(n.id + ': at[]');
      const e = eff(n);
      if (n.title && n.title.length > 32) p(n.id + ': title > 32 "' + n.title + '"');
      if (n.pins) checkPins(n.id, n.pins, p);
      if (n.id.indexOf('@') > 0) {
        const base = n.id.split('@')[0];
        if (!X.nodes[base]) p(n.id + ': instance without base node ' + base);
        else if (X.nodes[base].def !== n.def && !((defs[n.def] || {}).routed || []).includes(X.nodes[base].def))
          p(n.id + ': instance def ' + n.def + ' ≠ base def ' + X.nodes[base].def + ' (and not a routed role that includes it)');
      }
      if (e.cat === 'CP' && !GRAPH_IDS.includes(e.graph)) p(n.id + ': composite target');
      X.geo[n.id] = geom(n);
    });
    const entry = X.nodes[g.entry];
    if (!entry) p('entry ' + g.entry + ' missing');
    else if (!['IN', 'EV'].includes(eff(entry).cat)) p('entry must be IN or EV');
    if (!g.tab) p('tab');
    if (gid !== 'overview' && g.parent !== 'overview') p('parent must be overview');
  });

  check(gid + ': wires resolve, sides, exact types, fan rules', (p) => {
    const outCount = {}, inCount = {}, seen = {};
    X.wires.forEach((w) => {
      if (!w.f || !w.t || w.f.indexOf('.') < 0 || w.t.indexOf('.') < 0) return p('malformed ' + w.raw);
      if (seen[w.raw]) p('duplicate wire ' + w.raw);
      seen[w.raw] = 1;
      const [fn, fp] = splitEnd(w.f), [tn, tp] = splitEnd(w.t);
      const a = X.nodes[fn], b = X.nodes[tn];
      if (!a) return p(w.raw + ': no node ' + fn);
      if (!b) return p(w.raw + ': no node ' + tn);
      const ea = eff(a), eb = eff(b);
      const po = ea.pins.out.find((q) => q.id === fp);
      const pi = eb.pins.in.find((q) => q.id === tp);
      if (!po) return p(w.raw + ': ' + fn + ' has no OUT pin ' + fp + (ea.pins.in.find((q) => q.id === fp) ? ' (it is an IN pin)' : ''));
      if (!pi) return p(w.raw + ': ' + tn + ' has no IN pin ' + tp + (eb.pins.out.find((q) => q.id === tp) ? ' (it is an OUT pin)' : ''));
      if (po.t !== pi.t || !!po.arr !== !!pi.arr) p(w.raw + ': type ' + po.t + (po.arr ? '[]' : '') + ' → ' + pi.t + (pi.arr ? '[]' : ''));
      if (w.k && !KINDS.includes(w.k)) p(w.raw + ': kind ' + w.k);
      if (w.k === 'exec' && po.t !== 'exec') p(w.raw + ': k exec on a data pin');
      if (po.t === 'exec') outCount[w.f] = (outCount[w.f] || 0) + 1;
      else inCount[w.t] = (inCount[w.t] || 0) + 1;
      w.type = po.t;
      if (w.via) w.via.forEach((v) => { if (!Array.isArray(v) || v.length !== 2 || v.some((z) => typeof z !== 'number')) p(w.raw + ': via knot'); });
    });
    Object.keys(outCount).forEach((k) => { if (outCount[k] > 1) p('exec OUT ' + k + ' has ' + outCount[k] + ' wires (fan-out needs Switch/Parallel)'); });
    Object.keys(inCount).forEach((k) => {
      const n = X.nodes[k.split('.')[0]];
      if (inCount[k] > 1 && !eff(n).multiIn) p('data IN ' + k + ' has ' + inCount[k] + ' wires (not a multiIn variable)');
    });
  });

  check(gid + ': backward wires are loop or have via', (p) => {
    X.wires.forEach((w) => {
      const [fn, fp] = splitEnd(w.f), [tn, tp] = splitEnd(w.t);
      const ga = X.geo[fn], gb = X.geo[tn];
      if (!ga || !gb) return;
      const a = pinXY(ga, 'out', fp), b = pinXY(gb, 'in', tp);
      if (b.x < a.x && w.k !== 'loop' && !w.via) p(w.raw + ' goes backward (' + Math.round(a.x) + ' → ' + Math.round(b.x) + ')');
    });
  });

  check(gid + ': exec pins connected where the flow needs them', (p) => {
    const hasIn = {}, hasOut = {};
    X.wires.forEach((w) => { if (w.type === 'exec') { hasOut[w.f] = 1; hasIn[w.t.split('.')[0]] = 1; } });
    g.nodes.forEach((n) => {
      const e = eff(n);
      if (e.compact) return;
      const execIn = e.pins.in.some((q) => q.t === 'exec');
      if (execIn && !hasIn[n.id]) p(n.id + ': exec input never driven');
    });
  }, 'warn');

  check(gid + ': layout — no overlaps (24px gap)', (p) => {
    const ids = Object.keys(X.geo);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = X.geo[ids[i]], b = X.geo[ids[j]];
      const gap = M.GAP || 24;
      if (a.x < b.x + b.W + gap && b.x < a.x + a.W + gap && a.y < b.y + b.H + gap && b.y < a.y + a.H + gap)
        p(ids[i] + ' [' + a.x + ',' + a.y + ' ' + a.W + '×' + a.H + '] ↔ ' + ids[j] + ' [' + b.x + ',' + b.y + ' ' + b.W + '×' + b.H + ']');
    }
  });

  check(gid + ': comments — members exist, node in ≤1 comment, keys 1–9', (p) => {
    const owner = {}, keys = {};
    (g.comments || []).forEach((c) => {
      if (!c.id || !c.title || !isHex(c.color)) p('comment ' + (c.id || '?') + ' needs id/title/color');
      if (!(c.key >= 1 && c.key <= 9)) p(c.id + ': key ' + c.key);
      if (keys[c.key]) p('duplicate key ' + c.key); keys[c.key] = 1;
      if (!c.what) p(c.id + ': what (stage summary)');
      (c.nodes || []).forEach((id) => {
        if (!X.nodes[id]) p(c.id + ': member ' + id + ' missing');
        if (owner[id]) p(id + ' in ' + owner[id] + ' and ' + c.id);
        owner[id] = c.id;
      });
    });
  });

  /* comment boxes: +COMMENT_PAD around members, +COMMENT_BAR title bar on top */
  const boxes = (g.comments || []).map((c) => {
    const gs = (c.nodes || []).map((id) => X.geo[id]).filter(Boolean);
    if (!gs.length) return null;
    const pad = M.COMMENT_PAD || 40, bar = M.COMMENT_BAR || 36;
    const x0 = Math.min.apply(null, gs.map((q) => q.x)) - pad, y0 = Math.min.apply(null, gs.map((q) => q.y)) - pad - bar;
    const x1 = Math.max.apply(null, gs.map((q) => q.x + q.W)) + pad, y1 = Math.max.apply(null, gs.map((q) => q.y + q.H)) + pad;
    return { id: c.id, x0: x0, y0: y0, x1: x1, y1: y1, members: new Set(c.nodes) };
  }).filter(Boolean);
  X.boxes = boxes;
  check(gid + ': comment boxes do not overlap each other (8px)', (p) => {
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x0 < b.x1 + 8 && b.x0 < a.x1 + 8 && a.y0 < b.y1 + 8 && b.y0 < a.y1 + 8) {
        const dx = Math.min(a.x1 + 8 - b.x0, b.x1 + 8 - a.x0), dy = Math.min(a.y1 + 8 - b.y0, b.y1 + 8 - a.y0);
        p(a.id + ' ↔ ' + b.id + ' (overlap ' + dx + '×' + dy + 'px)');
      }
    }
  }, 'warn');
  check(gid + ': comment boxes do not swallow foreign nodes', (p) => {
    boxes.forEach((b) => {
      Object.keys(X.geo).forEach((id) => {
        if (b.members.has(id)) return;
        const q = X.geo[id];
        if (q.x < b.x1 && b.x0 < q.x + q.W && q.y < b.y1 && b.y0 < q.y + q.H) p(id + ' inside ' + b.id);
      });
    });
  }, 'warn');

  if (LAYOUT) {
    Object.keys(X.geo).forEach((id) => { const q = X.geo[id]; console.log('       ' + gid + ' ' + id.padEnd(18) + ' x ' + q.x + '..' + (q.x + q.W) + '  y ' + q.y + '..' + (q.y + q.H)); });
    boxes.forEach((b) => console.log('       ' + gid + ' [' + b.id + '] x ' + b.x0 + '..' + b.x1 + '  y ' + b.y0 + '..' + b.y1));
  }
});

check('composites: pins = target IN outs ∪ RT ins', (p) => {
  const sig = (list) => list.filter((q) => q.t !== 'exec').map((q) => q.id + ':' + q.t + (q.arr ? '[]' : '')).sort().join(', ');
  GRAPH_IDS.forEach((gid) => {
    const X = G[gid]; if (!X) return;
    X.g.nodes.forEach((n) => {
      const e = eff(n);
      if (e.cat !== 'CP') return;
      const T = G[e.graph];
      if (!T) return p(n.id + ': target ' + e.graph);
      const tunnels = T.g.nodes.map(eff);
      const ins = tunnels.filter((t) => t.cat === 'IN');
      const rts = tunnels.filter((t) => t.cat === 'RT');
      if (!ins.length || !rts.length) return p(e.graph + ': needs IN and RT tunnels');
      const inOuts = [].concat.apply([], ins.map((t) => t.pins.out));
      const rtIns = [];
      rts.forEach((t) => t.pins.in.forEach((q) => { if (!rtIns.some((r) => r.id === q.id && r.t === q.t)) rtIns.push(q); }));
      if (sig(e.pins.in) !== sig(inOuts)) p(gid + '/' + n.id + ' ins [' + sig(e.pins.in) + '] ≠ ' + e.graph + ' IN outs [' + sig(inOuts) + ']');
      if (sig(e.pins.out) !== sig(rtIns)) p(gid + '/' + n.id + ' outs [' + sig(e.pins.out) + '] ≠ ' + e.graph + ' RT ins [' + sig(rtIns) + ']');
      if (!e.pins.in.some((q) => q.t === 'exec') || !e.pins.out.some((q) => q.t === 'exec')) p(n.id + ': composite needs exec in and out');
      if (e.focus && !(T.g.comments || []).some((c) => c.id === e.focus)) p(n.id + ': focus ' + e.focus + ' is not a comment of ' + e.graph);
    });
  });
});

check('required node ids (§0 cast links)', (p) => {
  REQUIRED_NODES.forEach((r) => { const [gid, id] = r.split('/'); if (!G[gid] || !G[gid].nodes[id]) p(r); });
});

check('text: node titles ≤ 32, override titles, notes Cyrillic', (p) => {
  GRAPH_IDS.forEach((gid) => {
    const X = G[gid]; if (!X) return;
    X.g.nodes.forEach((n) => {
      const e = eff(n);
      if (!e.title) p(gid + '/' + n.id + ': no title');
      if (n.note && cyrRatio(n.note) < 0.5) p(gid + '/' + n.id + ': note mostly non-Cyrillic');
    });
  });
});

/* ------------------------------------------------------------------ presets */
check('presets', (p) => {
  Object.keys(BP.presets || {}).forEach((k) => {
    const pr = BP.presets[k];
    const X = G[pr.graph];
    if (!X) return p(k + ': graph ' + pr.graph);
    if (!pr.banner) p(k + ': banner');
    (pr.highlight || []).concat(pr.dim || []).concat(Object.keys(pr.notes || {})).forEach((id) => { if (!X.nodes[id]) p(k + ': node ' + id); });
  });
  if (!BP.presets.bugfix) p('bugfix preset missing');
});

/* ------------------------------------------------------------------ scenarios */
check('scenarios: required ids present', (p) => {
  Object.keys(REQUIRED_SCENARIOS).forEach((gid) => {
    const list = (BP.scenarios[gid] || []).map((s) => s.id);
    REQUIRED_SCENARIOS[gid].forEach((id) => { if (!list.includes(id)) p(gid + '/' + id); });
  });
  Object.keys(BP.scenarios).forEach((gid) => { if (!GRAPH_IDS.includes(gid)) p('unknown scenario graph ' + gid); });
});

const scenarioIds = {};
Object.keys(BP.scenarios || {}).forEach((gid) => {
  const X = G[gid];
  (BP.scenarios[gid] || []).forEach((sc) => {
    check('scenario ' + gid + '/' + sc.id, (p) => {
      if (scenarioIds[sc.id]) p('duplicate scenario id'); scenarioIds[sc.id] = 1;
      if (!sc.title || !sc.steps || !sc.steps.length) return p('title/steps');
      if (!ID_RE.test(sc.id)) p('bad id');
      const wireSet = {};
      X.wires.forEach((w) => { wireSet[w.raw] = w; });
      function checkStep(s, where) {
        const n = X.nodes[s.n];
        if (!n) { p(where + ': node ' + s.n + ' missing'); return null; }
        const e = eff(n);
        if (s.w) {
          const w = wireSet[s.w];
          if (!w) p(where + ': wire ' + s.w + ' not in graph');
          else if (w.type !== 'exec') p(where + ': w ' + s.w + ' is not an exec wire');
          if (s.w.split('>')[1].split('.')[0] !== s.n) p(where + ': w ' + s.w + ' does not end at ' + s.n);
        }
        if (s.out && !e.pins.out.some((q) => q.id === s.out && q.t === 'exec')) p(where + ': ' + s.n + ' has no exec out ' + s.out);
        (s.data || []).forEach((dw) => {
          const w = wireSet[dw];
          if (!w) p(where + ': data wire ' + dw + ' not in graph');
          else if (w.type === 'exec') p(where + ': data entry ' + dw + ' is an exec wire');
        });
        (s.ghost || []).forEach((id) => { if (!X.nodes[id]) p(where + ': ghost ' + id); });
        if (s.counter && (!X.nodes[s.counter.node] || !s.counter.text)) p(where + ': counter');
        if (e.cat === 'HG' && !s.answer) p(where + ': gate ' + s.n + ' needs answer');
        if (s.st && !['ok', 'fail', 'skip', 'wait', 'warn'].includes(s.st)) p(where + ': st ' + s.st);
        if (s.lvl && !['display', 'warning', 'error'].includes(s.lvl)) p(where + ': lvl ' + s.lvl);
        if (s.tag && !['LogScript', 'LogAgent', 'LogGate', 'LogFlow'].includes(s.tag)) p(where + ': tag ' + s.tag);
        if (s.json != null) {
          if (typeof s.json !== 'object') p(where + ': json must be an object');
          else if (/[\r\n]/.test(JSON.stringify(s.json))) p(where + ': json not one line');
        }
        if (s.text != null && !oneLine(s.text)) p(where + ': text not one line');
        if (s.json == null && s.text == null && e.cat !== 'JN') p(where + ': no log payload (json or text)');
        if (s.actor && !Object.keys(defs).some((k) => defs[k].tech && defs[k].tech.split(' ')[0] === s.actor)) p(where + ': actor ' + s.actor + ' unknown');
        if (e._def.routed) {
          const techs = e._def.routed.map((r) => (defs[r] || {}).tech);
          if (!s.actor) p(where + ': ' + s.n + ' is a routed role — the step must name its actor (' + techs.join(' | ') + ')');
          else if (!techs.includes(s.actor)) p(where + ': actor ' + s.actor + ' is not a routed option of ' + s.n);
        }
        return e;
      }
      function follows(prev, s, where) {
        if (!s.w) return p(where + ': missing w (exec continuity)');
        const [from] = s.w.split('>');
        const [fn, fp] = splitEnd(from);
        if (fn !== prev.n) p(where + ': w starts at ' + fn + ', previous step was ' + prev.n);
        else if (prev.out && fp !== prev.out) p(where + ': w leaves ' + fn + '.' + fp + ' but previous step chose out ' + prev.out);
      }
      let prev = null;
      sc.steps.forEach((s, i) => {
        const where = 'step ' + (i + 1);
        if (s.par) {
          if (!prev) return p(where + ': par cannot be first');
          const joins = [];
          s.par.forEach((branch, bi) => {
            let bp = prev;
            branch.forEach((bs, j) => {
              const bw = where + '.' + (bi + 1) + '.' + (j + 1);
              checkStep(bs, bw);
              follows(bp, bs, bw);
              bp = bs;
            });
            joins.push(branch[branch.length - 1].n);
          });
          const J = joins[0];
          if (!joins.every((j) => j === J)) p(where + ': branches end at different nodes ' + joins.join(','));
          else if (eff(X.nodes[J]).cat !== 'JN') p(where + ': branches must end at a Join node, not ' + J);
          if (eff(X.nodes[prev.n]).cat !== 'PA') p(where + ': par must follow a Parallel node');
          prev = { n: J };
          return;
        }
        const e = checkStep(s, where);
        if (i === 0) {
          if (s.w) p(where + ': first step has no w');
          if (e && !['IN', 'EV'].includes(e.cat)) p(where + ': first step must be an IN/EV node');
        } else follows(prev, s, where);
        prev = s;
      });
    });
  });
});

/* ------------------------------------------------------------------ counts + coverage */
const counts = GRAPH_IDS.map((gid) => {
  const X = G[gid]; if (!X) return gid + ': —';
  const exec = X.wires.filter((w) => w.type === 'exec').length;
  const sc = (BP.scenarios[gid] || []);
  const steps = sc.reduce((a, s) => a + s.steps.reduce((b, st) => b + (st.par ? st.par.reduce((c, br) => c + br.length, 0) : 1), 0), 0);
  return gid + ': ' + X.g.nodes.length + ' nodes, ' + X.wires.length + ' wires (' + exec + ' exec, ' + (X.wires.length - exec) + ' data), ' +
    (X.g.comments || []).length + ' comments, ' + sc.length + ' scenarios / ' + steps + ' steps';
});
console.log('\ncounts');
counts.forEach((c) => console.log('     ' + c));
console.log('     defs: ' + Object.keys(defs).length + ' (' + CATS.map((c) => c + ' ' + Object.keys(defs).filter((k) => defs[k].cat === c).length).filter((s) => !/ 0$/.test(s)).join(', ') + ')');

if (COVERAGE) {
  const walk = (dir, out) => { try { fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => { const p = path.join(dir, e.name); e.isDirectory() ? walk(p, out) : out.push(p); }); } catch (e) { /* */ } return out; };
  const rel = (p) => path.relative(REPO, p).split(path.sep).join('/');
  const all = walk(path.join(REPO, 'templates'), []).map(rel).filter((f) => /\/agents\/[^/]+\.md$/.test(f) || /\.sh$/.test(f));
  const miss = all.filter((f) => !allSrc.has(f));
  console.log('\ncoverage (informational): ' + (all.length - miss.length) + '/' + all.length + ' agent templates + scripts referenced');
  miss.forEach((m) => console.log('     unreferenced ' + m));
}

function finish() {
  console.log('\n' + (fails ? 'FAIL' : 'PASS') + ' — ' + oks + ' ok, ' + warns + ' warn, ' + fails + ' fail');
  process.exit(fails ? 1 : 0);
}

/* --render: open every graph in the real renderer (headless chrome from the HyperFrames cache, as
 * tools/shot.cjs does) at zoom 1:1 and report text that does not fit its box. Titles and pin labels
 * that overflow → warn; tech lines → info only (real agent/script ids are never shortened).
 * Console/page errors → FAIL. Skipped with a warn when no browser is available. */
async function renderCheck() {
  const http = require('http');
  let puppeteer, chrome;
  try {
    const base = 'C:/Users/Admin/AppData/Local/npm-cache/_npx';
    const cands = fs.readdirSync(base).map((d) => path.join(base, d, 'node_modules', 'puppeteer-core')).filter((p) => fs.existsSync(p));
    cands.sort((a, b) => require(path.join(b, 'package.json')).version.localeCompare(require(path.join(a, 'package.json')).version, undefined, { numeric: true }));
    puppeteer = require(cands[0]);
    const cb = path.join(process.env.USERPROFILE || 'C:/Users/Admin', '.cache/hyperframes/chrome/chrome-headless-shell');
    for (const v of fs.readdirSync(cb).sort().reverse()) {
      const exe = path.join(cb, v, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
      if (fs.existsSync(exe)) { chrome = exe; break; }
    }
    if (!chrome) throw new Error('chrome-headless-shell not found');
  } catch (e) { warn('render', 'skipped — ' + e.message); return; }
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(SHOWCASE, p);
    if (!f.startsWith(SHOWCASE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000 });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    for (const gid of GRAPH_IDS) {
      await page.goto('http://127.0.0.1:' + srv.address().port + '/index.html#skhema/' + gid, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await new Promise((r) => setTimeout(r, 1200));
      await page.evaluate(() => { const c = document.querySelector('.bp-canvas'); if (c) c.focus(); });
      await page.keyboard.press('0');
      await new Promise((r) => setTimeout(r, 800));
      const over = await page.evaluate(() => {
        const out = [];
        document.querySelectorAll('.bp-node').forEach((n) => {
          n.querySelectorAll('.bp-title, .bp-tech, .bp-pl').forEach((el) => {
            // fractional widths: scrollWidth rounds, and a text 0.4px too wide still gets its ellipsis
            if (!el.firstChild || !el.clientWidth) return;
            const rg = document.createRange(); rg.selectNodeContents(el);
            const tw = rg.getBoundingClientRect().width, cw = el.getBoundingClientRect().width;
            if (tw > cw + 0.02) out.push({ id: n.getAttribute('data-node'), kind: el.classList.contains('bp-tech') ? 'tech' : el.classList.contains('bp-pl') ? 'pin' : 'title', text: el.textContent, w: Math.round(tw * 10) / 10, cw: Math.round(cw * 10) / 10 });
          });
        });
        return { out: out, nodes: document.querySelectorAll('.bp-node').length };
      });
      const hard = over.out.filter((o) => o.kind !== 'tech');
      const soft = over.out.filter((o) => o.kind === 'tech');
      if (!over.nodes) fail('render ' + gid, 'no .bp-node rendered');
      else if (hard.length) { warn('render ' + gid + ': titles / pin labels fit', hard.length + ' truncated'); hard.forEach((o) => console.log('       · ' + o.id + ' ' + o.kind + ' "' + o.text + '" ' + o.w + '>' + o.cw)); }
      else ok('render ' + gid + ': titles / pin labels fit', over.nodes + ' nodes');
      if (soft.length && !QUIET) console.log('info tech lines clipped in ' + gid + ': ' + soft.map((o) => o.id + ' (' + o.text + ')').join(', '));
    }
    if (errors.length) { fail('render: no console errors', errors.length); errors.slice(0, 12).forEach((e) => console.log('       · ' + e)); }
    else ok('render: no console errors');
  } finally { await browser.close(); srv.close(); }
}

if (argv.includes('--render')) renderCheck().then(finish, (e) => { fail('render', e && e.message); finish(); });
else finish();
