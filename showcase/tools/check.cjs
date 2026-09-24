#!/usr/bin/env node
/* check.cjs — static checks for the showcase site. Prints ok/FAIL lines, exits 1 on any FAIL.
 * 1. every local src/href in index.html exists
 * 2. file:// safety: no ES modules, no fetch(), no remote resources (the GitHub link is allowed)
 * 3. «Просто» text (HTML + Cyrillic strings in scene/illustration JS) avoids the jargon blacklist (brand.md §5)
 * 4. word limits: h2 ≤ 7, .lead ≤ 30, .step p ≤ 22 words
 * 5. no emoji / unicode pictographs in «Просто» copy
 * 6. [data-fact] numbers match MP_FACTS, and MP_FACTS.version matches ../VERSION
 * 7. every data-char in index.html is a known MP.charTypes id */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const REPO = path.resolve(ROOT, '..');
let fails = 0;
const ok = (m) => console.log('ok   ' + m);
const fail = (m) => { fails++; console.log('FAIL ' + m); };
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const html = read('index.html');

/* 1. local references */
const refs = [...html.matchAll(/\b(?:src|href|poster)="([^"#][^"]*)"/g)].map(m => m[1]).filter(u => !/^(https?:|mailto:|data:)/.test(u));
const missing = refs.filter(u => !fs.existsSync(path.join(ROOT, u.split('?')[0])));
missing.length ? fail('missing local files: ' + missing.join(', ')) : ok(`all ${refs.length} local src/href exist`);
const lazy = read('assets/js/router.js').match(/'assets\/[^']+'/g) || [];
const lazyMissing = lazy.map(s => s.slice(1, -1)).filter(u => !fs.existsSync(path.join(ROOT, u)));
lazyMissing.length ? fail('router lazy files missing: ' + lazyMissing.join(', ')) : ok(`all ${lazy.length} lazily loaded Схема files exist`);

/* 2. file:// safety */
const jsFiles = [];
(function walk(dir) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, f);
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) { if (f !== 'vendor') walk(rel); }
    else if (f.endsWith('.js')) jsFiles.push(rel);
  }
})('assets/js');
const bad = [];
if (/type="module"/.test(html)) bad.push('index.html: type=module');
for (const f of jsFiles) {
  const s = read(f);
  if (/\bfetch\s*\(/.test(s)) bad.push(f + ': fetch(');
  if (/^\s*import\s[^(]/m.test(s) || /^\s*export\s/m.test(s)) bad.push(f + ': ES module syntax');
}
const remote = [...html.matchAll(/\b(?:src|href)="(https?:[^"]+)"/g)].map(m => m[1]).filter(u => !/^https:\/\/github\.com\/desvingns\/mobile-pipeline/.test(u));
if (remote.length) bad.push('remote resources: ' + remote.join(', '));
bad.length ? fail('file:// safety: ' + bad.join(' | ')) : ok('no modules, no fetch, no remote resources');

/* text of the «Просто» panel */
const start = html.indexOf('id="panel-prosto"');
const end = html.indexOf('id="panel-skhema"');
const prostoHtml = html.slice(start, end);
const strip = (s) => s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const prostoText = strip(prostoHtml).replace(/Найти на схеме|Открыть схему/g, ' ');
const sceneFiles = jsFiles.filter(f => /scenes[\\/]|chars\.js|belt\.js/.test(f));
const jsStrings = [];
for (const f of sceneFiles) {
  const s = read(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const m of s.matchAll(/(['"])((?:(?!\1)[^\\\n]|\\.)*[А-Яа-яЁё](?:(?!\1)[^\\\n]|\\.)*)\1/g)) jsStrings.push({ f, t: m[2] });
}

/* 3. jargon blacklist (Unicode-aware word boundaries; JS \b is ASCII-only) */
const L = '(?<![\\p{L}\\p{N}-])', R = '(?![\\p{L}\\p{N}])';
const JARGON = ['агент\\p{L}*', 'субагент\\p{L}*', 'скрипт\\p{L}*', 'детерминирован\\p{L}*', 'оркестратор\\p{L}*', 'координатор\\p{L}*',
  'спек\\p{L}{0,2}', 'спецификац\\p{L}*', 'ТЗ', 'бандл\\p{L}*', 'бэклог\\p{L}*', 'таск\\p{L}*', 'тикет\\p{L}*', 'SPEC',
  'код', 'кода', 'коду', 'кодом', 'коде', 'кодить', 'имплементац\\p{L}*', 'тест', 'тесты', 'тестов', 'тестами', 'тестах',
  'тестировщик\\p{L}*', 'ревью', 'ревьюер\\p{L}*', 'баг\\p{L}{0,2}', 'фейл\\p{L}*', 'фич\\p{L}{1,3}', 'пуш\\p{L}{0,2}', 'коммит\\p{L}*',
  'мерж\\p{L}*', 'деплой\\p{L}*', 'релиз\\p{L}*', 'репозитори\\p{L}*', 'PR', 'апрув\\p{L}*', 'гейт\\p{L}*', 'телеметри\\p{L}*',
  'метрик\\p{L}*', 'токен\\p{L}*', 'промпт\\p{L}*', 'плагин\\p{L}*', 'CLI', 'bash', 'терминал\\p{L}*', 'скриншот\\p{L}*',
  'opus', 'sonnet', 'haiku', 'UI', 'NFR', 'a11y', 'дизайн-токен\\p{L}*', 'интеграци\\p{L}*', 'архитектур\\p{L}*'];
const jre = new RegExp(L + '(' + JARGON.join('|') + ')' + R, 'giu');
const hitsHtml = [...new Set((prostoText.match(jre) || []).map(s => s.toLowerCase()))];
hitsHtml.length ? fail('jargon in «Просто» HTML: ' + hitsHtml.join(', ')) : ok('no jargon in «Просто» HTML copy');
const hitsJs = [];
for (const { f, t } of jsStrings) { const m = t.match(jre); if (m) hitsJs.push(path.basename(f) + ': «' + t.slice(0, 60) + '»'); }
hitsJs.length ? fail('jargon in scene/illustration strings: ' + hitsJs.slice(0, 20).join(' | ') + (hitsJs.length > 20 ? ` (+${hitsJs.length - 20})` : '')) : ok(`no jargon in ${jsStrings.length} Cyrillic strings of scene/illustration JS`);

/* 4. word limits */
const words = (s) => strip(s).split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
const over = [];
for (const m of prostoHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)) if (words(m[1]) > 7) over.push('h2 «' + strip(m[1]) + '» ' + words(m[1]));
for (const m of prostoHtml.matchAll(/<p class="lead"[^>]*>([\s\S]*?)<\/p>/g)) if (words(m[1]) > 30) over.push('lead ' + words(m[1]) + ': «' + strip(m[1]).slice(0, 40) + '…»');
for (const m of prostoHtml.matchAll(/<li class="step"[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/g)) if (words(m[1]) > 22) over.push('step ' + words(m[1]) + ': «' + strip(m[1]).slice(0, 40) + '…»');
over.length ? fail('word limits: ' + over.join(' | ')) : ok('word limits (h2 ≤ 7, lead ≤ 30, step ≤ 22)');

/* 5. emoji / pictographs */
const picto = /[\p{Extended_Pictographic}✓✔✳♥▶►▷★☆⌘⌕]/u;
const pHtml = prostoText.match(new RegExp(picto.source, 'gu')) || [];
const pJs = jsStrings.filter(({ t }) => picto.test(t)).map(({ f, t }) => path.basename(f) + ': «' + t.slice(0, 40) + '»');
(pHtml.length || pJs.length) ? fail('pictographs: ' + [...new Set(pHtml)].join(' ') + ' ' + pJs.slice(0, 10).join(' | ')) : ok('no emoji / unicode pictographs in «Просто» copy');

/* 6. facts */
const sandbox = { window: {} };
vm.runInNewContext(read('assets/js/facts.js'), sandbox);
const F = sandbox.window.MP_FACTS;
const version = fs.readFileSync(path.join(REPO, 'VERSION'), 'utf8').trim();
F.version === version ? ok('MP_FACTS.version = VERSION (' + version + ')') : fail(`MP_FACTS.version ${F.version} != VERSION ${version}`);
const factBad = [];
for (const m of html.matchAll(/data-fact="([^"]+)">([^<]*)</g)) if (String(F[m[1]]) !== m[2].trim()) factBad.push(`${m[1]}: html ${m[2]} vs facts ${F[m[1]]}`);
factBad.length ? fail('data-fact mismatch: ' + factBad.join(', ')) : ok('all data-fact numbers match MP_FACTS');

/* 7. cast ids */
const cs = { window: { MP: {} } };
cs.window.window = cs.window;
try {
  vm.runInNewContext(read('assets/js/chars.js'), cs);
  const types = cs.window.MP.charTypes || [];
  const used = [...new Set([...html.matchAll(/data-char="([^"]+)"/g)].map(m => m[1]))];
  const unknown = used.filter(t => !types.includes(t));
  unknown.length ? fail('unknown data-char ids: ' + unknown.join(', ')) : ok(`all ${used.length} data-char ids are MP.charTypes`);
} catch (e) { fail('chars.js did not load in vm: ' + e.message); }

console.log(fails ? `\n${fails} check(s) FAILED` : '\nPASS');
process.exit(fails ? 1 : 0);
