#!/usr/bin/env node
/* test-chars.cjs — proves the illustration kit is pure (no DOM) and well-formed.
 * Loads assets/js/chars.js + belt.js in a Node vm with a fake `window = {MP:{}}` (no document), renders every
 * type × expression × variant, every machine, plant state, phone state, stampHand, seal, belts and beltPath, then:
 *   - checks tags are balanced (XML-ish parse with a stack), no <defs>, no ids unless opts.id was given;
 *   - checks structure classes (c-body, c-eyes, 2× c-lid, c-mouth, c-arm-l/r, c-shadow; c-lamp for machines);
 *   - checks lemon (#FFDA4F) appears only on «вы» things (vy, stampHand, seal) or a machine asked for lamp:'lemon';
 *   - checks output is deterministic (two renders are byte-identical) and MP.charTypes covers index.html data-char;
 *   - writes a static gallery HTML (default: $TMP/chars-gallery.html, or --out <file>).
 * Prints ONE JSON line: {"ok":true,"rendered":N,"bytes":…,"out":"…","errors":[]}. Exit code 1 on errors.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? args[outIdx + 1] : path.join(os.tmpdir(), 'chars-gallery.html');

const errors = [];
const sandbox = { window: { MP: {} }, console };
vm.createContext(sandbox);
for (const f of ['assets/js/chars.js', 'assets/js/belt.js']) {
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f }); }
  catch (e) { errors.push(f + ': ' + e.message); }
}
const MP = sandbox.window.MP;

const API = ['char', 'charSVG', 'machine', 'plant', 'phone', 'stampHand', 'seal', 'blink', 'setExpr', 'artSVG', 'belt', 'beltPath'];
API.forEach(k => { if (typeof MP[k] !== 'function') errors.push('missing MP.' + k); });
if (!Array.isArray(MP.charTypes)) errors.push('missing MP.charTypes');
if (MP.charSVG && MP.charSVG('brigadir') !== null) errors.push('charSVG must be a no-op without document');

/* index.html data-char coverage */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const used = [...new Set([...html.matchAll(/data-char="([a-z-]+)"/g)].map(m => m[1]))];
used.forEach(t => { if (!MP.charTypes.includes(t)) errors.push('index.html data-char not in MP.charTypes: ' + t); });

function checkXml(label, s) {
  if (/<defs[\s>]/.test(s)) errors.push(label + ': contains <defs>');
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|<!--[\s\S]*?-->/g;
  const stack = [];
  let m, last = 0, text = '';
  while ((m = re.exec(s))) {
    text += s.slice(last, m.index); last = re.lastIndex;
    if (!m[2]) continue;
    if (m[1]) {
      const top = stack.pop();
      if (top !== m[2]) { errors.push(label + ': </' + m[2] + '> closes <' + top + '>'); return false; }
    } else if (!m[4]) stack.push(m[2]);
  }
  text += s.slice(last);
  if (stack.length) { errors.push(label + ': unclosed ' + stack.join(',')); return false; }
  if (/[<>]/.test(text)) { errors.push(label + ': stray < or > outside tags (malformed attribute?)'); return false; }
  if (/NaN|undefined|Infinity/.test(s)) errors.push(label + ': NaN/undefined in markup');
  return true;
}
function has(label, s, cls, n) {
  const count = (s.match(new RegExp('class="[^"]*\\b' + cls + '\\b', 'g')) || []).length;
  if (count < (n || 1)) errors.push(label + ': expected ≥' + (n || 1) + ' .' + cls + ', got ' + count);
}
const LEMON = /#FFDA4F/i;
const items = [];   // {label, markup, vb}
function add(label, markup, vb, opts) {
  opts = opts || {};
  checkXml(label, markup);
  if (!opts.idOk && / id="/.test(markup)) errors.push(label + ': emits an id');
  /* CSS transform-origin (chars.css) also applies to the SVG transform attribute: classed groups must not carry one */
  const bad = markup.match(/<g class="(?!c-place"|belt)[^"]*"[^>]* transform="/);
  if (bad) errors.push(label + ': classed element with a transform attribute: ' + bad[0].slice(0, 60));
  if (!opts.lemonOk && LEMON.test(markup)) errors.push(label + ': uses lemon (reserved for «вы»)');
  items.push({ label, markup, vb: vb || '0 0 120 140' });
}

/* characters */
const exprs = MP.charExprs || ['happy', 'focus', 'oh', 'grumpy'];
(MP.masterTypes || []).forEach(t => {
  exprs.forEach(e => {
    const s = MP.char(t, { expr: e });
    const label = t + '/' + e;
    add(label, s, null, { lemonOk: t === 'vy' });
    ['c-char', 'c-body', 'c-face', 'c-eyes', 'c-pupil', 'c-mouth', 'c-arm-l', 'c-arm-r', 'c-shadow', 'c-legs'].forEach(c => has(label, s, c));
    has(label, s, 'c-lid', 2);
    if (!s.includes('data-expr="' + e + '"')) errors.push(label + ': data-expr mismatch');
    if (s !== MP.char(t, { expr: e })) errors.push(label + ': not deterministic');
  });
  ((MP.charVariants || {})[t] || []).forEach(v => add(t + '/' + v, MP.char(t, { variant: v })));
});
['brigadir', 'razvedchik', 'syshchik', 'obkhodchik', 'pisar', 'sovetnik', 'pridira', 'planirovshchik', 'khudozhnik', 'master',
  'revizor', 'arkhitektor', 'ispytatel', 'priyomshchik', 'letopisets', 'bibliotekar', 'ratsionalizator', 'vy']
  .forEach(t => { if (!(MP.masterTypes || []).includes(t)) errors.push('masterTypes lacks ' + t); });
if ((MP.charTypes || []).length !== 24) errors.push('charTypes should list 24 ids, has ' + (MP.charTypes || []).length);
/* hat present for hatted cast */
['brigadir', 'razvedchik', 'syshchik', 'pisar', 'khudozhnik', 'master', 'revizor', 'priyomshchik', 'vy'].forEach(t => has(t, MP.char(t), 'c-hat'));
if (!/c-hat[\s\S]*<path d="M[\d.]+ [\d.]+L[\d.]+ [\d.]+L/.test(MP.char('master', { variant: 'chief' }))) errors.push('master/chief: star missing');
/* positioning + id opt */
const pos = MP.char('pisar', { x: 100, y: 50, scale: 1.5, id: 'hero-pisar', cls: 'is-big' });
if (!pos.startsWith('<g class="c-place" transform="translate(100 50) scale(1.5)"')) errors.push('char opts x/y/scale not applied');
if (!pos.includes('id="hero-pisar"') || !pos.includes('is-big')) errors.push('char opts id/cls not applied');
add('pisar/positioned', pos, '0 0 300 300', { idOk: true });

/* machines */
(MP.machineTypes || []).forEach(t => {
  const s = MP.machine(t);
  add('machine/' + t, s);
  has('machine/' + t, s, 'c-lamp');
  has('machine/' + t, s, 'c-body');
  if (/c-eyes|c-mouth/.test(s)) errors.push('machine/' + t + ': automats must not have faces');
  if (MP.char(t) !== s) errors.push('MP.char(' + t + ') should forward to MP.machine');
  add('machine/' + t + '/lemon', MP.machine(t, { lamp: 'lemon' }), null, { lemonOk: true });
});
['vesy', 'stend'].forEach(t => has('machine/' + t, MP.machine(t), 'c-needle'));
['strelochnik', 'zhurnal'].forEach(t => has('machine/' + t, MP.machine(t), 'c-gear'));

/* plant, phone, stamp, seal */
(MP.plantStates || []).forEach(st => {
  const s = MP.plant(st);
  add('plant/' + st, s);
  ['c-plant', 'c-pot', 'c-leaf', 'c-eyes', 'c-mouth'].forEach(c => has('plant/' + st, s, c));
  if (st === 'bloom') has('plant/bloom', s, 'c-flower', 3);
  if (st === 'sad') { has('plant/sad', s, 'c-bud'); if (!s.includes('data-expr') && !/c-brows/.test(s)) errors.push('plant/sad: no face'); }
});
(MP.phoneStates || []).forEach(st => {
  const s = MP.phone(st);
  add('phone/' + st, s, '0 0 140 260');
  has('phone/' + st, s, 'ph-screen');
  const sizes = [...s.matchAll(/font-size="([\d.]+)"/g)].map(m => +m[1]);
  sizes.forEach(z => { if (z < 10.9) errors.push('phone/' + st + ': text smaller than 11 (' + z + ')'); });
});
if (!MP.phone('notify').includes('Фиалка хочет пить.') || !MP.phone('notify').includes('Пора полить!')) errors.push('phone/notify text');
if (!MP.phone('notify-night').includes('03:00')) errors.push('phone/notify-night: 03:00 missing');
if (!MP.phone('notify').includes('09:00')) errors.push('phone/notify: 09:00 missing');
add('stampHand', MP.stampHand(), null, { lemonOk: true });
if (!MP.stampHand().includes('ОДОБРЕНО')) errors.push('stampHand: ОДОБРЕНО missing');
add('seal', MP.seal(), '0 0 100 100', { lemonOk: true });
add('seal/Годится', MP.seal({ text: 'Годится', fill: '#2BD99F', rotate: 8 }), '0 0 100 100');

/* belts */
const belt = MP.belt({ x: 20, y: 120, w: 640, stations: [{ x: 90, lamp: 'mint', label: 'Придумать' }, { x: 260, lamp: 'sky', label: 'Собрать' },
  { x: 430, lamp: 'raspberry', label: 'Проверить' }, { x: 580, lamp: 'off', label: 'Выдать' }], legs: 30 });
add('belt/straight', belt, '0 0 700 220');
has('belt/straight', belt, 'belt-chev'); has('belt/straight', belt, 'belt-roller', 2); has('belt/straight', belt, 'belt-station', 4);
add('belt/reverse', MP.belt({ x: 20, y: 40, w: 400, dir: -1, color: '#FF4F8B' }), '0 0 440 100');
const serp = [[60, 60], [600, 60], [600, 200], [60, 200], [60, 340], [600, 340]];
const d = MP.beltPath(serp, 70);
if (!/^M[\d. ]+(L[\d. ]+A[\d. ]+)+L[\d. ]+$/.test(d)) errors.push('beltPath shape unexpected: ' + d.slice(0, 80));
if ((d.match(/A/g) || []).length !== 4) errors.push('beltPath should have 4 fillets');
add('belt/path', MP.belt({ points: serp, r: 70, w: 34 }), '0 0 660 400');
has('belt/path', MP.belt({ points: serp }), 'belt-flow');
if (MP.beltPath([[0, 0]]) !== '') errors.push('beltPath with <2 points should be empty');

/* gallery html */
const fontsCss = path.join(ROOT, 'assets/css/fonts.css').replace(/\\/g, '/');
let g = '<!doctype html><meta charset="utf-8"><title>chars gallery</title><link rel="stylesheet" href="file:///' + fontsCss + '">' +
  '<style>body{margin:0;padding:24px;background:#FFF6E6;font:600 13px system-ui;color:#16123A}' +
  '.grid{display:flex;flex-wrap:wrap;gap:10px}figure{margin:0;text-align:center}svg{background:#fff;border:2px solid #16123A22;border-radius:10px;height:140px}</style>' +
  '<h1>MP illustration kit — ' + items.length + ' renders</h1><div class="grid">';
items.forEach(it => {
  const [, , w, h] = it.vb.split(' ').map(Number);
  g += '<figure><svg viewBox="' + it.vb + '" style="width:' + Math.round(140 * w / h) + 'px">' + it.markup + '</svg><figcaption>' + it.label + '</figcaption></figure>';
});
g += '</div>';
fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
fs.writeFileSync(OUT, g);

const bytes = items.reduce((n, it) => n + it.markup.length, 0);
console.log(JSON.stringify({ ok: errors.length === 0, rendered: items.length, bytes, avgBytes: Math.round(bytes / items.length),
  out: path.resolve(OUT), dataChars: used.length, errors }));
if (errors.length) process.exitCode = 1;
