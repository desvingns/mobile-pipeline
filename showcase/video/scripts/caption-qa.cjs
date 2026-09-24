#!/usr/bin/env node
'use strict';
/**
 * caption-qa.cjs — caption gate for the karaoke layer (design-video.md §5 / §11), no render needed.
 *
 *  1. Layout: renders every caption group of compositions/captions.html in headless Chrome (the same
 *     chrome-headless-shell + puppeteer-core HyperFrames caches), with the real fonts, and measures it:
 *     lines ≤ 2, every word inside title-safe x 192–1728, pill bottom ≤ 972 (it sits at 960), pill top
 *     ≥ 800 (the caption band starts there; scene text is kept above it).
 *  2. Timing ("listening math"): for sample cues, the karaoke word active at cue + 0.05 s must be the cue's
 *     own word, and the voice must actually start there — the onset of the dual-mono voice stem written
 *     by scripts/preview-mix.cjs (10 ms RMS crossing -38 dBFS) is compared with the word's start.
 *
 *   node scripts/caption-qa.cjs [--cues s01-hook:wilt,s04-blueprint:check,...]   -> one JSON line
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const C = require('./lib/common.cjs');

const args = process.argv.slice(2);
function opt(name, dflt) { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; }
const CUES = opt('cues', 's01-hook:wilt,s03-talk:analysts,s05-critic:two,s08-tests:night,s10-memory:rational').split(',');

const capFile = path.join(C.ROOT, 'compositions', 'captions.html');
const cap = fs.readFileSync(capFile, 'utf8');
const style = (cap.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
const markup = (cap.match(/data-duration="[\d.]+">\s*([\s\S]*?)\s*<\/div>\s*<script>/) || [])[1] || '';
const words = JSON.parse((cap.match(/var TRANSCRIPT = (\[[\s\S]*?\]);/) || [])[1] || '[]');
const groups = JSON.parse((cap.match(/var GROUPS = (\[[\s\S]*?\]);/) || [])[1] || '[]');
if (!markup || !words.length || !groups.length) C.die('could not parse compositions/captions.html');

function findPuppeteer() {
  const base = 'C:/Users/Admin/AppData/Local/npm-cache/_npx';
  const cands = [];
  try { fs.readdirSync(base).forEach(function (d) { const p = path.join(base, d, 'node_modules', 'puppeteer-core'); if (fs.existsSync(p)) cands.push(p); }); } catch (e) { /* none */ }
  cands.sort(function (a, b) { return require(path.join(b, 'package.json')).version.localeCompare(require(path.join(a, 'package.json')).version, undefined, { numeric: true }); });
  if (!cands.length) C.die('puppeteer-core not found in the npx cache (run any hyperframes command once)');
  return require(cands[0]);
}
function findChrome() {
  const base = path.join(process.env.USERPROFILE || 'C:/Users/Admin', '.cache/hyperframes/chrome/chrome-headless-shell');
  const vers = fs.readdirSync(base).sort().reverse();
  for (let i = 0; i < vers.length; i++) {
    const exe = path.join(base, vers[i], 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  C.die('chrome-headless-shell not found');
}

// ------------------------------------------------------------------ 1. layout
async function layout() {
  const page = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><style>' + style +
    ' body{margin:0;width:1920px;height:1080px;background:#5B34F5;overflow:hidden}' +
    ' #captions{position:absolute;inset:0}</style></head><body><div id="captions">' + markup + '</div></body></html>';
  const srv = http.createServer(function (req, res) {
    const p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/qa.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(page); return; }
    const file = path.join(C.ROOT, p);
    if (!file.startsWith(C.ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': p.endsWith('.woff2') ? 'font/woff2' : 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(function (r) { srv.listen(0, '127.0.0.1', r); });
  const puppeteer = findPuppeteer();
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] });
  try {
    const pg = await browser.newPage();
    await pg.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await pg.goto('http://127.0.0.1:' + srv.address().port + '/qa.html', { waitUntil: 'load' });
    await pg.evaluate(function () { return document.fonts.ready; });
    return await pg.evaluate(function () {
      const out = [];
      const fontOk = document.fonts.check('600 46px "Golos Text"');
      document.querySelectorAll('.caption-group').forEach(function (g, gi) {
        document.querySelectorAll('.caption-group').forEach(function (x) { x.style.visibility = 'hidden'; x.style.opacity = '0'; });
        g.style.visibility = 'visible'; g.style.opacity = '1';
        const line = g.querySelector('.caption-line').getBoundingClientRect();
        const tops = [];
        let minX = 1e9, maxX = -1e9;
        g.querySelectorAll('.caption-word').forEach(function (w) {
          const r = w.getBoundingClientRect();
          if (!tops.some(function (t) { return Math.abs(t - r.top) < 8; })) tops.push(r.top);
          minX = Math.min(minX, r.left); maxX = Math.max(maxX, r.right);
        });
        out.push({ i: gi, text: g.textContent.replace(/\s+/g, ' ').trim(), lines: tops.length,
          pill: { left: Math.round(line.left), right: Math.round(line.right), top: Math.round(line.top), bottom: Math.round(line.bottom) },
          words: { left: Math.round(minX), right: Math.round(maxX) } });
      });
      return { fontOk: fontOk, groups: out };
    });
  } finally {
    await browser.close();
    srv.close();
  }
}

// ------------------------------------------------------------------ 2. timing
function timing() {
  const timingJson = C.readJSON(C.P.timing);
  const stem = path.join(C.ROOT, '.hyperframes', 'qa', 'stem-voice.wav');
  let env = null;
  if (fs.existsSync(stem)) {
    const d = C.decodeF32(stem, { rate: 48000, channels: 1 });
    const hop = 480; env = new Float32Array(Math.floor(d.length / hop));
    for (let i = 0; i < env.length; i++) {
      let s = 0; for (let k = 0; k < hop; k++) { const v = d[i * hop + k]; s += v * v; }
      env[i] = 10 * Math.log10(s / hop + 1e-12);
    }
  }
  return CUES.map(function (spec) {
    const p = spec.split(':');
    const sc = timingJson.scenes.filter(function (s) { return s.id === p[0]; })[0];
    if (!sc || sc.cuesGlobal[p[1]] == null) return { cue: spec, ok: false, error: 'unknown cue' };
    const T = sc.cuesGlobal[p[1]];
    const probe = T + 0.05;
    const r0 = {};
    // same lit window as the karaoke layer: ≥0.12 s, cut short when the next word starts
    const offOf = function (w, i) { const nx = words[i + 1]; let off = Math.max(w.end, w.start + 0.12); if (nx && nx.start > w.start && nx.start < off) off = nx.start; return off; };
    const lit = words.filter(function (w, i) { return probe >= w.start && probe < offOf(w, i); });
    const active = lit.length === 1 ? lit[0] : null;
    r0.litWords = lit.length;
    const own = words.filter(function (w) { return Math.abs(w.start - T) < 0.002; })[0];
    const grp = groups.filter(function (g) { return probe >= g.in && probe < g.out; })[0];
    const r = Object.assign(r0, { cue: spec, t: T, word: own ? own.text : null, activeAtCue: active ? active.text : null, groupOn: !!grp });
    if (env && own) {
      // onset = first 10 ms frame after a quieter stretch that crosses -38 dBFS, searched ±0.3 s around the word
      let onset = null;
      for (let f = Math.round((T - 0.3) * 100); f <= Math.round((T + 0.3) * 100); f++) {
        if (env[f] > -38 && env[f - 1] <= -38) { if (onset == null || Math.abs(f / 100 - T) < Math.abs(onset - T)) onset = f / 100; }
      }
      r.voiceOnset = onset; r.onsetDeltaMs = onset == null ? null : Math.round((onset - T) * 1000);
    }
    r.ok = !!own && active === own && r.groupOn && (r.onsetDeltaMs == null || Math.abs(r.onsetDeltaMs) <= 120);
    return r;
  });
}

(async function () {
  const L = await layout();
  const bad = L.groups.filter(function (g) {
    return g.lines > 2 || g.words.left < 192 || g.words.right > 1728 || g.pill.bottom > 972 || g.pill.top < 800;
  });
  const T = timing();
  const report = {
    ok: L.fontOk && !bad.length && T.every(function (x) { return x.ok; }),
    fontLoaded: L.fontOk,
    groups: L.groups.length,
    maxLines: Math.max.apply(null, L.groups.map(function (g) { return g.lines; })),
    twoLineGroups: L.groups.filter(function (g) { return g.lines === 2; }).length,
    highestPillTop: Math.min.apply(null, L.groups.map(function (g) { return g.pill.top; })),
    widestWords: [Math.min.apply(null, L.groups.map(function (g) { return g.words.left; })), Math.max.apply(null, L.groups.map(function (g) { return g.words.right; }))],
    layoutViolations: bad,
    timing: T,
  };
  process.stdout.write(JSON.stringify(report) + '\n');
  process.exit(report.ok ? 0 : 2);
})().catch(function (e) { process.stdout.write(JSON.stringify({ ok: false, error: String(e && e.stack || e) }) + '\n'); process.exit(1); });
