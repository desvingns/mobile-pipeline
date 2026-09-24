#!/usr/bin/env node
/* shot.cjs — headless screenshots of the showcase for self-verification (no shared browser needed).
 * Serves showcase/ from an in-process static server on a free port, opens it in HyperFrames' cached
 * chrome-headless-shell via the cached puppeteer-core, and prints ONE JSON line:
 *   {"ok":true,"png":"...","errors":[...console errors / page errors / failed requests...]}
 *
 * Usage:
 *   node tools/shot.cjs --out <file.png> [--hash skhema/feature] [--width 1440] [--height 900]
 *        [--section chertyozh] [--at 0.5]      scroll to section top + at*sectionHeight (0..1)
 *        [--y 2400]                            or an absolute scrollY
 *        [--wait 1800]                         ms to wait after load/scroll (animations)
 *        [--calm]                              emulate prefers-reduced-motion: reduce
 *        [--click "<css selector>"]            click before the final wait (repeatable)
 *        [--eval "<js expression>"]            evaluate before the final wait (repeatable)
 *        [--full]                              full-page screenshot
 *        [--steps 4]                           scroll through the section in N steps (triggers sticky steps), shot at the end
 *        [--query "?debug=chars"]              query string
 *        [--page tools/bp-test.html]           page to open instead of index.html (path relative to showcase/)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
function opt(name, def) { const i = args.indexOf('--' + name); return i === -1 ? def : args[i + 1]; }
function flag(name) { return args.includes('--' + name); }
function all(name) { const out = []; args.forEach((a, i) => { if (a === '--' + name) out.push(args[i + 1]); }); return out; }

function findPuppeteer() {
  const base = 'C:/Users/Admin/AppData/Local/npm-cache/_npx';
  const cands = [];
  try { for (const d of fs.readdirSync(base)) { const p = path.join(base, d, 'node_modules', 'puppeteer-core'); if (fs.existsSync(p)) cands.push(p); } } catch (e) {}
  cands.sort((a, b) => {
    const va = require(path.join(a, 'package.json')).version, vb = require(path.join(b, 'package.json')).version;
    return vb.localeCompare(va, undefined, { numeric: true });
  });
  if (!cands.length) throw new Error('puppeteer-core not found in npx cache');
  return require(cands[0]);
}
function findChrome() {
  const base = path.join(process.env.USERPROFILE || 'C:/Users/Admin', '.cache/hyperframes/chrome/chrome-headless-shell');
  const vers = fs.readdirSync(base).sort().reverse();
  for (const v of vers) {
    const exe = path.join(base, v, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
    if (fs.existsSync(exe)) return exe;
  }
  throw new Error('chrome-headless-shell not found');
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.json': 'application/json' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

(async () => {
  const out = opt('out');
  if (!out) { console.log(JSON.stringify({ ok: false, error: '--out required' })); process.exit(2); }
  const width = +opt('width', 1440), height = +opt('height', 900), wait = +opt('wait', 1800);
  const srv = await serve();
  const port = srv.address().port;
  const puppeteer = findPuppeteer();
  const browser = await puppeteer.launch({ executablePath: findChrome(), headless: true,
    args: ['--no-sandbox', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'] });
  const errors = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width < 760, hasTouch: width < 760 });
    if (flag('calm')) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warn') && !/Failed to load resource/.test(m.text())) errors.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', e => errors.push('pageerror: ' + (e && e.message)));
    // aborted range requests for the film are normal browser behaviour, not a failure
    page.on('requestfailed', r => { if (!/\.mp4(\?|$)/.test(r.url())) errors.push('requestfailed: ' + r.url().replace(/^http:\/\/127\.0\.0\.1:\d+/, '')); });
    page.on('response', r => { if (r.status() >= 400 && !/poster\.jpg|mobile-pipeline\.mp4|favicon\.ico/.test(r.url())) errors.push('http ' + r.status() + ': ' + r.url().replace(/^http:\/\/127\.0\.0\.1:\d+/, '')); });
    const hash = opt('hash', '');
    const url = `http://127.0.0.1:${port}/${opt('page', 'index.html')}${opt('query', '')}${hash ? '#' + hash : ''}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await new Promise(r => setTimeout(r, 400));
    const section = opt('section');
    const steps = +opt('steps', 0);
    if (section) {
      const at = +opt('at', 0);
      const box = await page.evaluate((id) => {
        const el = document.getElementById(id); if (!el) return null;
        const r = el.getBoundingClientRect(); return { top: r.top + window.scrollY, h: r.height };
      }, section);
      if (!box) errors.push('section not found: ' + section);
      else {
        const header = await page.evaluate(() => (document.querySelector('.site-header') || { offsetHeight: 0 }).offsetHeight);
        const target = box.top - header + at * box.h;
        if (steps > 0) {
          for (let i = 1; i <= steps; i++) {
            await page.evaluate(y => window.scrollTo(0, y), box.top - header + (i / steps) * at * box.h);
            await new Promise(r => setTimeout(r, 700));
          }
        } else {
          // scroll in a few hops so IntersectionObserver/ScrollTrigger fire naturally
          const start = await page.evaluate(() => window.scrollY);
          for (let i = 1; i <= 4; i++) { await page.evaluate(y => window.scrollTo(0, y), start + (target - start) * i / 4); await new Promise(r => setTimeout(r, 120)); }
          // lazily built scenes above can grow (pin spacers, upgrades): re-measure until stable
          for (let k = 0; k < 4; k++) {
            await new Promise(r => setTimeout(r, 350));
            const again = await page.evaluate((id) => { const el = document.getElementById(id); const r = el.getBoundingClientRect(); return { top: r.top + window.scrollY, h: r.height }; }, section);
            const t2 = again.top - header + at * again.h;
            const cur = await page.evaluate(() => window.scrollY);
            if (Math.abs(t2 - cur) < 4) break;
            await page.evaluate(y => window.scrollTo(0, y), t2);
          }
        }
      }
    } else if (opt('y')) {
      await page.evaluate(y => window.scrollTo(0, y), +opt('y'));
    }
    for (const sel of all('click')) {
      try { await page.click(sel); } catch (e) { errors.push('click failed: ' + sel); }
      await new Promise(r => setTimeout(r, 300));
    }
    for (const js of all('eval')) {
      try { await page.evaluate(js); } catch (e) { errors.push('eval failed: ' + e.message); }
    }
    await new Promise(r => setTimeout(r, wait));
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    await page.screenshot({ path: out, fullPage: flag('full') });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) errors.push('horizontal overflow: scrollWidth > viewport');
    console.log(JSON.stringify({ ok: true, png: path.resolve(out), url, errors }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: String(e && e.stack || e), errors }));
    process.exitCode = 1;
  } finally {
    await browser.close();
    srv.close();
  }
})();
