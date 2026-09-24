#!/usr/bin/env node
/* seed-defs.cjs — one-off helper for authoring assets/js/blueprint-data.js.
 *
 * Reads every agent template (templates/**\/agents/*.md) and, when present, the older hand-authored
 * node data in ../graph/data/*.js, and prints DRAFT def entries (title, model {tier,id}, tools,
 * src/also, codex tier, ru.what/why/stops) for copy-editing into blueprint-data.js.
 * The runtime never depends on graph/ — this is an authoring aid only.
 *
 * Usage:
 *   node tools/seed-defs.cjs                 draft defs for every agent (JS object literal text)
 *   node tools/seed-defs.cjs --json          same data as JSON
 *   node tools/seed-defs.cjs --only mp-docs,spec-evaluator
 *   node tools/seed-defs.cjs --scripts       also list script headers ("Output:" lines = sample shapes)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const withScripts = args.includes('--scripts');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? String(args[onlyIdx + 1] || '').split(',').filter(Boolean) : null;

function walk(dir, out) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(REPO, p).split(path.sep).join('/');

/* ---- frontmatter ---- */
function frontmatter(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
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
  const m = String(model || '').toLowerCase();
  if (m.includes('opus')) return 'opus';
  if (m.includes('haiku')) return 'haiku';
  if (m.includes('sonnet')) return 'sonnet';
  return '?';
}

/* ---- Codex tiers (dev shims table + install-spec.sh table) ---- */
function codexTiers() {
  const out = {};
  try {
    const t = fs.readFileSync(path.join(REPO, 'templates/dev/codex/skills/mp-dev/references/codex-agent-shims.md'), 'utf8');
    t.split(/\r?\n/).forEach((l) => {
      const m = /^\|\s*`([a-z0-9-]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/.exec(l);
      if (m) out[m[1]] = { model: m[2], effort: m[3], sandbox: m[4] };
    });
  } catch (e) { /* optional */ }
  try {
    const s = fs.readFileSync(path.join(REPO, 'install-spec.sh'), 'utf8');
    const m = /AGENTS='([\s\S]*?)'/.exec(s);
    if (m) m[1].split(/\r?\n/).forEach((l) => {
      const p = l.split('|');
      if (p.length >= 3) out[p[0].trim()] = { model: p[1].trim(), effort: p[2].trim() };
    });
  } catch (e) { /* optional */ }
  return out;
}

/* ---- old graph data (optional) ---- */
function oldGraphNodes() {
  const dir = path.join(REPO, 'graph', 'data');
  const byKey = {};
  if (!fs.existsSync(dir)) return byKey;
  const reg = [];
  const sandbox = { window: { MP_GRAPH_REGISTER: (g) => reg.push(g) } };
  vm.createContext(sandbox);
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.js'))) {
    try { vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), sandbox, { filename: f }); } catch (e) {
      process.stderr.write('skip ' + f + ': ' + e.message + '\n');
    }
  }
  reg.forEach((g) => (g.nodes || []).forEach((n) => {
    const key = n.src ? path.basename(n.src).replace(/\.(md|sh)$/, '').replace('{{PREFIX}}', 'mp') : n.id;
    if (!byKey[key]) byKey[key] = n;
  }));
  return byKey;
}

const agentFiles = walk(path.join(REPO, 'templates'), [])
  .filter((f) => /[\\/]agents[\\/][^\\/]+\.md$/.test(f)).sort();
const tiers = codexTiers();
const old = oldGraphNodes();
const drafts = [];

agentFiles.forEach((file) => {
  const base = path.basename(file, '.md').replace('{{PREFIX}}', 'mp');
  if (only && !only.includes(base)) return;
  let fm = frontmatter(file);
  let fmFrom = rel(file);
  if (!fm) { // overlay without frontmatter → generated plugin copy
    for (const plug of ['claude-plugins/mp-dev/agents', 'claude-plugins/mp-spec/agents']) {
      const alt = path.join(REPO, plug, base + '.md');
      if (fs.existsSync(alt)) { fm = frontmatter(alt); fmFrom = rel(alt); break; }
    }
  }
  const o = old[base] || {};
  const ru = o.ru || {};
  drafts.push({
    key: base,
    cat: 'AG',
    title: o.title || '',
    tech: base,
    model: fm ? { tier: tierOf(fm.model), id: fm.model } : null,
    tools: fm && fm.tools ? fm.tools.split(',').map((s) => s.trim()).filter(Boolean) : [],
    src: [rel(file)],
    also: (o.also || []).filter((p) => fs.existsSync(path.join(REPO, p))),
    frontmatterFrom: fmFrom,
    codex: tiers[base] || null,
    ru: { what: ru.what || '', why: ru.why || '', stops: ru.stops || '' }
  });
});

if (asJson) {
  process.stdout.write(JSON.stringify(drafts, null, 2) + '\n');
} else {
  drafts.forEach((d) => {
    process.stdout.write('  // ' + d.src[0] + (d.frontmatterFrom !== d.src[0] ? '  (frontmatter: ' + d.frontmatterFrom + ')' : '') + '\n');
    process.stdout.write('  ' + JSON.stringify(d.key) + ': { cat:"AG", title:' + JSON.stringify(d.title) +
      ', tech:' + JSON.stringify(d.tech) + ',\n    model:' + JSON.stringify(d.model) +
      ', tools:' + JSON.stringify(d.tools) + ',\n    src:' + JSON.stringify(d.src) +
      (d.also.length ? ', also:' + JSON.stringify(d.also) : '') +
      (d.codex ? ',\n    codexModel:' + JSON.stringify(d.codex) : '') + ',\n    d:{ what:' + JSON.stringify(d.ru.what) +
      ', stops:' + JSON.stringify(d.ru.stops) + ' } },\n');
  });
}

if (withScripts) {
  const scripts = walk(path.join(REPO, 'templates'), []).filter((f) => f.endsWith('.sh')).sort();
  process.stdout.write('\n/* ---- script output shapes (header "Output" lines) ---- */\n');
  scripts.forEach((f) => {
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/).slice(0, 60);
    const outs = lines.filter((l) => /^#.*(Output|\{"(ok|pass)")/.test(l)).map((l) => l.replace(/^#\s?/, ''));
    process.stdout.write('// ' + rel(f) + '\n' + outs.map((l) => '//   ' + l).join('\n') + (outs.length ? '\n' : ''));
  });
}
