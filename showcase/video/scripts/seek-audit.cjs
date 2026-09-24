#!/usr/bin/env node
'use strict';
/**
 * seek-audit.cjs — does the film look the same whether a frame is reached by PLAYING or by JUMPING?
 *
 * The renderer plays each worker's chunk frame by frame (eventful seeks, 1/30 s apart), but every chunk
 * starts with a jump, and `snapshot` / `check` only ever jump. Anything that depends on the path — a tween
 * that outlives a later tween on the same property (it drags the value back during playback only), a
 * callback-driven proxy that misses its last update on a jump, DOM written once in a callback — renders
 * differently in the MP4 than in every QA frame. This audit makes that visible without a render.
 *
 * For each scene timeline (and the three layers) in the bundled film (same bundle as render/check):
 *   pass A  play:  totalTime(0), then totalTime(f / 30) for every frame f, fingerprinting every 5th frame
 *   pass B  jump:  for each fingerprinted time t: totalTime(0) then totalTime(t)
 * A fingerprint is every element's attributes (inline style, SVG transform, attr-tweened geometry) plus leaf
 * text. Numbers compare with a 0.05 tolerance. Any difference is reported with the element and both values.
 *
 *   node scripts/seek-audit.cjs [--only s05-critic] [--every 5]      -> one JSON line; .hyperframes/qa/seek-audit.json
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');
const C = require('./lib/common.cjs');

const args = process.argv.slice(2);
function opt(name, dflt) { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : dflt; }
const ONLY = opt('only', null);
const EVERY = Number(opt('every', 5));
const FPS = 30;

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
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

// runs in the page: one scene, both passes, returns the differences
function auditInPage(id, dur, fps, every) {
  const tl = window.__timelines[id];
  const root = document.querySelector('[data-composition-id="' + id + '"]');
  if (!tl || !root) return { error: 'missing timeline or root for ' + id };
  const els = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));
  // what is PAINTED, not how it is spelled: computed values (an untouched element and one GSAP reset to
  // translate(0px, 0px) look the same), plus the SVG geometry attributes GSAP's attr plugin writes, plus leaf text
  const PROPS = ['display', 'visibility', 'opacity', 'transform', 'translate', 'rotate', 'scale', 'clipPath', 'filter',
    'strokeDashoffset', 'strokeDasharray', 'fill', 'stroke', 'color', 'backgroundColor', 'width', 'height', 'left', 'top'];
  const ATTRS = ['transform', 'd', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'x1', 'x2', 'y1', 'y2', 'points', 'stroke-dashoffset'];
  const IDENT = /^matrix\(1, 0, 0, 1, 0, 0\)$|^none$/;
  const SVGID = /^matrix\(1,0,0,1,0,0\)$|^translate\(0(px)?,0(px)?\)$/;
  function sig(el) {
    const cs = getComputedStyle(el);
    let s = '';
    for (let i = 0; i < PROPS.length; i++) { let v = cs[PROPS[i]]; if (PROPS[i] === 'transform' && IDENT.test(v)) v = 'id'; s += v + ';'; }
    for (let i = 0; i < ATTRS.length; i++) {
      const v = el.getAttribute(ATTRS[i]);
      if (v == null || (ATTRS[i] === 'transform' && SVGID.test(v.replace(/\s+/g, '')))) continue;
      s += ATTRS[i] + '=' + v + ';';
    }
    if (!el.childElementCount) s += '#' + (el.textContent || '').trim().slice(0, 60);
    return s;
  }
  function fp() { return els.map(sig); }
  function label(el) {
    if (el.id) return '#' + el.id;
    let p = el, out = [];
    while (p && p !== root && !p.id && out.length < 4) { out.unshift(p.tagName.toLowerCase() + (p.getAttribute('class') ? '.' + String(p.getAttribute('class')).trim().split(/\s+/)[0] : '')); p = p.parentElement; }
    return (p && p.id ? '#' + p.id + ' > ' : '') + out.join(' > ');
  }
  const NUM = /-?\d*\.?\d+(?:e-?\d+)?/g;
  // an element that is invisible in both passes cannot differ on screen (fields: display;visibility;opacity;…)
  function hidden(s) { const p = s.split(';'); return p[0] === 'none' || p[1] === 'hidden' || Number(p[2]) === 0; }
  function same(a, b) {
    if (a === b) return true;
    if (hidden(a) && hidden(b)) return true;
    const ta = a.replace(NUM, '§'), tb = b.replace(NUM, '§');
    if (ta !== tb) return false;
    const na = a.match(NUM) || [], nb = b.match(NUM) || [];
    for (let i = 0; i < na.length; i++) if (Math.abs(Number(na[i]) - Number(nb[i])) > 0.05) return false;
    return true;
  }
  const N = Math.floor(dur * fps + 1e-6);
  const times = [], play = [];
  tl.totalTime(0);
  for (let f = 0; f <= N; f++) {
    const t = Math.min(dur, f / fps);
    tl.totalTime(t);
    if (f % every === 0 || f === N) { times.push(t); play.push(fp()); }
  }
  const diffs = [];
  for (let k = 0; k < times.length; k++) {
    tl.totalTime(0);
    tl.totalTime(times[k]);
    const jump = fp();
    for (let i = 0; i < els.length; i++) {
      if (!same(play[k][i], jump[i])) diffs.push({ t: +times[k].toFixed(3), el: label(els[i]), play: play[k][i].slice(0, 220), jump: jump[i].slice(0, 220) });
    }
  }
  tl.totalTime(0);
  return { samples: times.length, elements: els.length, diffs: diffs };
}

(async function main() {
  const compiler = await import(pathToFileURL(path.join(C.ROOT, 'node_modules', '@hyperframes', 'core', 'dist', 'compiler', 'index.js')).href);
  let html = await compiler.bundleToSingleHtml(C.ROOT);
  html = html.replace(/<audio\b[^>]*>\s*<\/audio>/g, '');   // 50 MB of WAV is irrelevant here
  const srv = http.createServer(function (req, res) {
    const p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); res.end(html); return; }
    const file = path.join(C.ROOT, p);
    if (!file.startsWith(C.ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(function (r) { srv.listen(0, '127.0.0.1', r); });
  const browser = await findPuppeteer().launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] });
  const timing = C.readJSON(C.P.timing);
  const comps = timing.scenes.map(function (s) { return { id: s.id, dur: s.duration }; })
    .concat([{ id: 'captions', dur: timing.total }, { id: 'wipes', dur: timing.total }, { id: 'hud', dur: timing.hud.duration || (timing.total - timing.hud.start) }])
    .filter(function (c) { return !ONLY || c.id === ONLY; });
  const report = { every: EVERY, fps: FPS, comps: {} };
  let total = 0;
  try {
    const pg = await browser.newPage();
    await pg.setViewport({ width: 1920, height: 1080 });
    pg.setDefaultTimeout(600000);
    await pg.goto('http://127.0.0.1:' + srv.address().port + '/', { waitUntil: 'load', timeout: 180000 });
    await pg.waitForFunction(function (keys) { const t = window.__timelines || {}; return keys.every(function (k) { return !!t[k]; }); },
      { timeout: 120000 }, comps.map(function (c) { return c.id; }));
    for (const c of comps) {
      const r = await pg.evaluate(auditInPage, c.id, c.dur, FPS, EVERY);
      report.comps[c.id] = r;
      total += r.diffs ? r.diffs.length : 1;
    }
  } finally {
    await browser.close();
    srv.close();
  }
  fs.mkdirSync(path.join(C.ROOT, '.hyperframes', 'qa'), { recursive: true });
  fs.writeFileSync(path.join(C.ROOT, '.hyperframes', 'qa', 'seek-audit.json'), JSON.stringify(report, null, 1));
  const per = Object.keys(report.comps).map(function (k) {
    const r = report.comps[k];
    if (r.error) return k + ':ERR';
    const els = {}; r.diffs.forEach(function (d) { els[d.el] = (els[d.el] || 0) + 1; });
    return k + ':' + r.samples + 's/' + r.diffs.length + 'd' + (r.diffs.length ? '[' + Object.keys(els).slice(0, 3).join(' | ') + ']' : '');
  });
  process.stdout.write(JSON.stringify({ ok: total === 0, differences: total, perComp: per, file: '.hyperframes/qa/seek-audit.json' }) + '\n');
  process.exit(total === 0 ? 0 : 2);
})().catch(function (e) { process.stdout.write(JSON.stringify({ ok: false, error: String(e && e.stack || e) }) + '\n'); process.exit(1); });
