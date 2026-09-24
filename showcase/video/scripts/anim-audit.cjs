#!/usr/bin/env node
'use strict';
/**
 * anim-audit.cjs — choreography audit of every registered GSAP timeline, the offline counterpart of the
 * hyperframes-animation skill's animation-map.mjs (which needs @hyperframes/producer, not installed here).
 *
 * Bundles the project with @hyperframes/core's compiler (bundleToSingleHtml, the same bundle render/check
 * use), opens it in the cached chrome-headless-shell via puppeteer-core, waits for all compositions to
 * register in window.__timelines, and walks every tween (nested timelines included). Reports, per scene:
 *   - fighting tweens: two tweens on the same element and property whose active windows overlap; a `revert`
 *     (the earlier tween outlives the later one) makes sequential render and cold seeks disagree -> must fix;
 *     a `handoff` (the later tween takes over mid-flight) is reported for review only;
 *   - beat dead zones: stretches ≥ 1.6 s (inside _voice.._out) where no beat tween (≤ 3 s long) runs —
 *     only ambient loops (bob/drift/blink) move, i.e. the picture holds while the voice talks;
 *   - frozen zones: stretches ≥ 0.5 s where NOTHING runs (not even ambient life);
 *   - late tweens: starting after _out (hidden under the outgoing wipe) or ending past the scene end.
 * Writes .hyperframes/qa/anim-audit.json and prints a one-line JSON summary.
 *
 *   node scripts/anim-audit.cjs
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { pathToFileURL } = require('url');
const C = require('./lib/common.cjs');

function findPuppeteer() {
  const base = 'C:/Users/Admin/AppData/Local/npm-cache/_npx';
  const cands = [];
  try { fs.readdirSync(base).forEach(function (d) { const p = path.join(base, d, 'node_modules', 'puppeteer-core'); if (fs.existsSync(p)) cands.push(p); }); } catch (e) { /* none */ }
  cands.sort(function (a, b) { return require(path.join(b, 'package.json')).version.localeCompare(require(path.join(a, 'package.json')).version, undefined, { numeric: true }); });
  if (!cands.length) C.die('puppeteer-core not found in the npx cache');
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
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

(async function main() {
  const compiler = await import(pathToFileURL(path.join(C.ROOT, 'node_modules', '@hyperframes', 'core', 'dist', 'compiler', 'index.js')).href);
  let html = await compiler.bundleToSingleHtml(C.ROOT);
  // audio is irrelevant here and 50 MB of WAV only slows the load
  html = html.replace(/<audio\b[^>]*>\s*<\/audio>/g, '');
  const srv = http.createServer(function (req, res) {
    const p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); res.end(html); return; }
    const file = path.join(C.ROOT, p);
    if (!file.startsWith(C.ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(function (r) { srv.listen(0, '127.0.0.1', r); });
  const browser = await findPuppeteer().launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const timing = C.readJSON(C.P.timing);
  const offsets = { captions: 0, wipes: 0, hud: timing.hud.start };
  timing.scenes.forEach(function (s) { offsets[s.id] = s.start; });
  let raw;
  try {
    const pg = await browser.newPage();
    await pg.setViewport({ width: 1920, height: 1080 });
    await pg.goto('http://127.0.0.1:' + srv.address().port + '/', { waitUntil: 'load', timeout: 180000 });
    await pg.waitForFunction(function (keys) { const t = window.__timelines || {}; return keys.every(function (k) { return !!t[k]; }); },
      { timeout: 120000 }, Object.keys(offsets));
    raw = await pg.evaluate(function (keys) {
      const out = {};
      // identity numbering: two tweens "share" a target only when it is the same DOM node (a readable CSS path is
      // not unique — every kit character has `svg.kit > g.c-char > g.c-body > g.c-arm-r`)
      const ids = new WeakMap();
      let nextId = 1;
      function uid(t) { if (!ids.has(t)) ids.set(t, nextId++); return ids.get(t); }
      function label(t) {
        if (!(t instanceof Element)) return null;
        return uid(t) + '|' + readable(t);
      }
      function readable(t) {
        if (t.id) return '#' + t.id;
        let p = t, path = [];
        while (p && p.nodeType === 1 && !p.id && path.length < 4) {
          const par = p.parentElement; if (!par) break;
          const same = Array.prototype.filter.call(par.children, function (c) { return c.tagName === p.tagName; });
          path.unshift(p.tagName.toLowerCase() + (same.length > 1 ? ':nth-of-type(' + (same.indexOf(p) + 1) + ')' : '') + (p.getAttribute('class') ? '.' + String(p.getAttribute('class')).trim().split(/\s+/)[0] : ''));
          p = par;
        }
        return (p && p.id ? '#' + p.id + ' > ' : '') + path.join(' > ');
      }
      keys.forEach(function (k) {
        const list = [];
        (function walk(tl, off) {
          tl.getChildren(false, true, true).forEach(function (ch) {
            const st = off + ch.startTime();
            if (typeof ch.getChildren === 'function') { walk(ch, st); return; }
            const targets = (ch.targets() || []).map(label);
            const elTargets = targets.filter(Boolean);
            const v = ch.vars || {};
            const props = Object.keys(v).filter(function (p) {
              return ['ease', 'duration', 'delay', 'repeat', 'yoyo', 'repeatDelay', 'immediateRender', 'overwrite', 'onUpdate', 'onComplete', 'onStart',
                'stagger', 'startAt', 'runBackwards', 'parent', 'id', 'data', 'callbackScope', 'onUpdateParams', 'lazy', 'inherit', 'keyframes', 'paused', 'reversed'].indexOf(p) < 0;
            });
            const stag = v.stagger != null;
            list.push({ s: +st.toFixed(3), e: +(st + ch.totalDuration()).toFixed(3), d: +ch.duration().toFixed(3), rep: ch.repeat ? ch.repeat() : 0,
              t: elTargets.length ? elTargets : (targets.length ? ['(proxy)'] : []), n: targets.length, props: props, driver: !elTargets.length && !!v.onUpdate, stagger: stag });
          });
        })(window.__timelines[k], 0);
        out[k] = list;
      });
      return out;
    }, Object.keys(offsets));
  } finally {
    await browser.close();
    srv.close();
  }

  // ---------------------------------------------------------------- analysis
  const norm = function (p) { return p === 'scale' ? ['scaleX', 'scaleY'] : p === 'autoAlpha' ? ['opacity'] : [p]; };
  const scenes = {};
  let fightsTotal = 0, revertTotal = 0, deadTotal = 0, frozenTotal = 0, lateTotal = 0;
  timing.scenes.forEach(function (s) {
    const tw = raw[s.id] || [];
    const cues = s.cues;
    // fighting: same element + prop, overlapping active windows (a stagger tween is split per target by GSAP, so only
    // compare tweens whose target lists intersect)
    // Two kinds (GSAP renders a timeline's children in start order, so the later-starting tween wins the overlap):
    //   handoff — the later tween also ends later: it takes over mid-flight; harmless when intended;
    //   revert  — the EARLIER tween outlives the later one: once the later tween completes it is no longer
    //             rendered during sequential playback, so the earlier one drags the property back (and writes
    //             its own end value when it completes), while a cold seek lands on the later tween's value.
    //             The render (sequential frames) and snapshots/check (cold seeks) then disagree — a real bug.
    const order = tw.map(function (x, i) { return { x: x, i: i }; }).sort(function (p, q) { return p.x.s - q.x.s || p.i - q.i; }).map(function (p) { return p.x; });
    const fights = [];
    for (let i = 0; i < order.length; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const a = order[i], b = order[j];
        if (a.driver || b.driver || a.t[0] === '(proxy)' || b.t[0] === '(proxy)') continue;
        const ov = Math.min(a.e, b.e) - Math.max(a.s, b.s);
        if (ov <= 0.021) continue;
        const shared = a.t.filter(function (x) { return b.t.indexOf(x) >= 0; });
        if (!shared.length) continue;
        const pa = [].concat.apply([], a.props.map(norm)), pb = [].concat.apply([], b.props.map(norm));
        const props = pa.filter(function (x) { return pb.indexOf(x) >= 0; });
        if (!props.length) continue;
        const kind = a.e > b.e + 0.001 ? 'revert' : 'handoff';
        fights.push({ kind: kind, el: shared[0].replace(/^\d+\|/, '') + (shared.length > 1 ? ' (+' + (shared.length - 1) + ')' : ''), props: props, a: [a.s, a.e], b: [b.s, b.e], overlap: +ov.toFixed(3) });
      }
    }
    // coverage bins (40 ms)
    const B = 0.04, n = Math.ceil(s.duration / B);
    const any = new Uint8Array(n), beat = new Uint8Array(n);
    tw.forEach(function (x) {
      const len = x.e - x.s;
      for (let k = Math.max(0, Math.floor(x.s / B)); k < Math.min(n, Math.ceil(x.e / B)); k++) { any[k] = 1; if (len <= 3) beat[k] = 1; }
    });
    function runs(arr, from, to, min) {
      const out = []; let st = null;
      for (let k = Math.floor(from / B); k <= Math.ceil(to / B); k++) {
        const on = k < n && k * B < to ? arr[k] : 1;
        if (!on && st == null) st = k * B;
        if (on && st != null) { if (k * B - st >= min) out.push([+st.toFixed(2), +(k * B).toFixed(2), +(k * B - st).toFixed(2)]); st = null; }
      }
      return out;
    }
    const dead = runs(beat, cues._voice, cues._out, 1.6);
    const frozen = runs(any, 0, s.duration, 0.5);
    const late = tw.filter(function (x) { return (x.s > cues._out + 0.05 && x.e - x.s < 3) || x.e > s.duration + 0.05; })
      .map(function (x) { return { el: String(x.t[0]).replace(/^d+|/, ''), s: x.s, e: x.e, props: x.props }; });
    fightsTotal += fights.length; revertTotal += fights.filter(function (f) { return f.kind === 'revert'; }).length; deadTotal += dead.length; frozenTotal += frozen.length; lateTotal += late.length;
    scenes[s.id] = { tweens: tw.length, fights: fights, beatDeadZones: dead, frozenZones: frozen, late: late };
  });
  const report = { tweens: Object.keys(raw).reduce(function (a, k) { return a + raw[k].length; }, 0), fights: fightsTotal, reverts: revertTotal, beatDeadZones: deadTotal, frozenZones: frozenTotal, late: lateTotal, scenes: scenes };
  fs.mkdirSync(path.join(C.ROOT, '.hyperframes', 'qa'), { recursive: true });
  fs.writeFileSync(path.join(C.ROOT, '.hyperframes', 'qa', 'anim-audit.json'), JSON.stringify(report, null, 1));
  process.stdout.write(JSON.stringify({ ok: revertTotal === 0 && lateTotal === 0, tweens: report.tweens, fights: fightsTotal, reverts: revertTotal, beatDeadZones: deadTotal, frozenZones: frozenTotal, late: lateTotal,
    perScene: Object.keys(scenes).map(function (k) { return k + ':' + scenes[k].tweens + 'tw/' + scenes[k].fights.length + 'f(' + scenes[k].fights.filter(function (f) { return f.kind === 'revert'; }).length + 'r)/' + scenes[k].beatDeadZones.length + 'd/' + scenes[k].frozenZones.length + 'z/' + scenes[k].late.length + 'l'; }),
    file: '.hyperframes/qa/anim-audit.json' }) + '\n');
})().catch(function (e) { process.stdout.write(JSON.stringify({ ok: false, error: String(e && e.stack || e) }) + '\n'); process.exit(1); });
