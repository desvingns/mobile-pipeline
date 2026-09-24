'use strict';
/*
 * chars-bridge.cjs — lets video scene templates use the SITE illustration kit
 * (showcase/assets/js/chars.js + belt.js: pure string generators on window.MP).
 *
 * The kit files are evaluated in a Node vm sandbox (no DOM). If they are missing, still stubs, or
 * throw, the bridge falls back to simple brand-grammar placeholder drawings (same viewBoxes, same
 * structure classes) so every template still builds. `status` says which one is active.
 *
 * Template placeholders (expanded by scripts/build-video.cjs via expand()); every one may end with #id
 * (put on the <svg>) and/or a JSON object of extra kit options, e.g. %%MACHINE:vesy:220#s07-vesy{"lamp":"lemon"}%%
 *   %%CHAR:<type>[/variant]:<width>[:expr]%%   character (MP.charTypes; expr happy|focus|oh|grumpy|sad), 120x140
 *   %%MACHINE:<type>:<width>%%                 automat (vesy strelochnik poryadok stend pochtalon zhurnal), 120x140
 *   %%PLANT:<sad|happy|bloom>:<width>%%        фиалка in a pot, 120x140
 *   %%PHONE:<state>:<width>%%                  phone 140x260: blank | list | notify | notify-night | app
 *                                              (aliases reminder-0900 = notify, reminder-0300 = notify-night)
 *   %%STAMP:<width>%%                          «вы»: lemon sleeve + hand + stamp «ОДОБРЕНО», 120x140
 *   %%SEAL:<width>[:text]%%                    round stamp imprint, 100x100
 *   %%BELT:<length>[:h[:legs]]%%               straight conveyor (kit MP.belt: .belt-chev, .belt-roller)
 *   %%KITCSS%%                                 transform-box/origins for the structure classes (site chars.css)
 * Each becomes <svg class="kit kit-<kind> kit-<type>" viewBox=... width=<width> height=<by aspect>>.
 * Structure classes inside: see the header of showcase/assets/js/chars.js (.c-body .c-eyes .c-lid .c-mouth
 * .c-arm-l .c-arm-r .c-hat .c-prop .c-shadow .c-lamp .c-needle .c-leaf .ph-notif ...).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SITE_JS = path.resolve(__dirname, '..', '..', '..', 'assets', 'js');
const INK = '#16123A', CREAM = '#FFF6E6', VIOLET = '#5B34F5', LEMON = '#FFDA4F', MINT = '#2BD99F',
  RASP = '#FF4F8B', SKY = '#3EC5FF', TANG = '#FF8A1F', STEEL = '#B9C3D6';

// ---------------------------------------------------------------- load the site kit
function loadKit() {
  const files = ['chars.js', 'belt.js'].map(function (f) { return path.join(SITE_JS, f); });
  const MP = {
    seeded: function (seed) {
      let a = seed >>> 0;
      return function () {
        a = (a + 0x6D2B79F5) >>> 0; let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
  };
  const sandbox = { MP: MP, console: { log: function () {}, warn: function () {}, error: function () {} }, Math: Math };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);
  const notes = [];
  files.forEach(function (f) {
    if (!fs.existsSync(f)) { notes.push(path.basename(f) + ' missing'); return; }
    const src = fs.readFileSync(f, 'utf8');
    try { vm.runInContext(src, ctx, { filename: f, timeout: 2000 }); }
    catch (e) { notes.push(path.basename(f) + ' threw: ' + e.message); }
  });
  const kit = sandbox.window.MP || MP;
  const ok = typeof kit.char === 'function';
  return { kit: kit, ok: ok, notes: notes };
}

// ---------------------------------------------------------------- fallback drawings
const TYPE = {
  brigadir: { body: 'squircle', fill: VIOLET, eyes: CREAM, hat: 'hardhat', hatFill: TANG, prop: 'clipboard' },
  razvedchik: { body: 'circle', fill: SKY, hat: 'cap', hatFill: TANG, prop: 'binoculars' },
  syshchik: { body: 'capsule', fill: TANG, hat: 'deerstalker', hatFill: RASP, prop: 'magnifier' },
  obkhodchik: { body: 'box', fill: SKY, hat: 'antenna', hatFill: RASP, prop: 'finger' },
  pisar: { body: 'squircle', fill: MINT, hat: 'beret', hatFill: VIOLET, prop: 'quill' },
  sovetnik: { body: 'circle', fill: CREAM, hat: null, prop: 'dial' },
  pridira: { body: 'triangle', fill: RASP, hat: 'brows', prop: 'pencil', monocle: true },
  planirovshchik: { body: 'squircle', fill: MINT, hat: 'cap', hatFill: SKY, prop: 'scissors' },
  khudozhnik: { body: 'capsule', fill: RASP, hat: 'beret', hatFill: VIOLET, prop: 'palette' },
  master: { body: 'squircle', fill: TANG, hat: 'goggles', hatFill: SKY, prop: 'wrench' },
  revizor: { body: 'tall', fill: VIOLET, eyes: CREAM, hat: 'tophat', hatFill: INK, prop: 'cards' },
  arkhitektor: { body: 'squircle', fill: INK, eyes: CREAM, hat: null, prop: 'roll' },
  ispytatel: { body: 'squircle', fill: MINT, hat: 'goggles', hatFill: SKY, prop: 'stopwatch' },
  priyomshchik: { body: 'squircle', fill: SKY, hat: 'headset', hatFill: INK, prop: 'clipboard' },
  letopisets: { body: 'squircle', fill: CREAM, hat: null, prop: 'book' },
  bibliotekar: { body: 'squircle', fill: VIOLET, eyes: CREAM, hat: 'glasses', prop: 'drawer' },
  ratsionalizator: { body: 'squircle', fill: TANG, hat: 'bulb', hatFill: LEMON, prop: null },
  vy: { body: 'circle', fill: LEMON, hat: 'crown', hatFill: LEMON, prop: 'stamp' },
};
const MACHINES = ['vesy', 'strelochnik', 'poryadok', 'stend', 'pochtalon', 'zhurnal'];

function bodyPath(kind) {
  switch (kind) {
    case 'circle': return '<circle cx="60" cy="72" r="38"/>';
    case 'capsule': return '<rect x="30" y="28" width="60" height="86" rx="30"/>';
    case 'triangle': return '<path d="M60 26 C66 26 70 30 74 37 L100 98 C104 108 98 114 88 114 L32 114 C22 114 16 108 20 98 L46 37 C50 30 54 26 60 26 Z"/>';
    case 'tall': return '<rect x="34" y="22" width="52" height="92" rx="22"/>';
    case 'box': return '<rect x="26" y="34" width="68" height="78" rx="12"/>';
    default: return '<rect x="24" y="34" width="72" height="80" rx="26"/>';
  }
}
function mouth(expr) {
  switch (expr) {
    case 'focus': return '<path class="c-mouth" d="M52 92 H68" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>';
    case 'oh': return '<ellipse class="c-mouth" cx="60" cy="93" rx="5" ry="6" fill="' + INK + '"/>';
    case 'grumpy': return '<path class="c-mouth" d="M50 96 Q60 88 70 96" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>';
    case 'sad': return '<path class="c-mouth" d="M50 97 Q60 89 70 97" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>';
    default: return '<path class="c-mouth" d="M49 89 Q60 100 71 89" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>';
  }
}
function hat(t) {
  const f = t.hatFill || INK;
  const s = ' stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"';
  switch (t.hat) {
    case 'hardhat': return '<g class="c-hat"><path d="M30 40 Q60 6 90 40 Z" fill="' + f + '"' + s + '/><rect x="24" y="38" width="72" height="8" rx="4" fill="' + f + '"' + s + '/><circle cx="60" cy="28" r="5" fill="' + CREAM + '"' + s + '/></g>';
    case 'cap': return '<g class="c-hat"><path d="M34 40 Q60 16 86 40 Z" fill="' + f + '"' + s + '/><path d="M80 38 H100" stroke="' + INK + '" stroke-width="6" stroke-linecap="round"/></g>';
    case 'deerstalker': return '<g class="c-hat"><path d="M36 34 Q60 8 84 34 L88 40 H32 Z" fill="' + f + '"' + s + '/><path d="M44 18 L60 30 L76 18" fill="none" stroke="' + INK + '" stroke-width="4"/></g>';
    case 'antenna': return '<g class="c-hat"><path d="M60 34 V12" stroke="' + INK + '" stroke-width="4"/><circle cx="60" cy="10" r="6" fill="' + f + '"' + s + '/></g>';
    case 'beret': return '<g class="c-hat"><ellipse cx="56" cy="34" rx="28" ry="10" fill="' + f + '"' + s + '/><circle cx="60" cy="23" r="4" fill="' + f + '"' + s + '/></g>';
    case 'goggles': return '<g class="c-hat"><rect x="30" y="40" width="60" height="10" rx="5" fill="' + INK + '"/><circle cx="48" cy="45" r="9" fill="' + f + '"' + s + '/><circle cx="72" cy="45" r="9" fill="' + f + '"' + s + '/></g>';
    case 'tophat': return '<g class="c-hat"><rect x="42" y="0" width="36" height="24" rx="3" fill="' + f + '"' + s + '/><rect x="32" y="22" width="56" height="7" rx="3" fill="' + f + '"' + s + '/></g>';
    case 'headset': return '<g class="c-hat"><path d="M28 64 Q28 26 60 26 Q92 26 92 64" fill="none" stroke="' + INK + '" stroke-width="5"/><rect x="20" y="58" width="12" height="18" rx="5" fill="' + INK + '"/><path d="M26 76 Q30 92 46 94" fill="none" stroke="' + INK + '" stroke-width="4"/></g>';
    case 'glasses': return '<g class="c-hat"><circle cx="48" cy="62" r="11" fill="none" stroke="' + CREAM + '" stroke-width="4"/><circle cx="72" cy="62" r="11" fill="none" stroke="' + CREAM + '" stroke-width="4"/></g>';
    case 'bulb': return '<g class="c-hat"><circle cx="60" cy="14" r="11" fill="' + f + '"' + s + '/><rect x="54" y="24" width="12" height="7" rx="2" fill="' + STEEL + '"' + s + '/></g>';
    case 'crown': return '<g class="c-hat"><path d="M40 36 L44 18 L54 28 L60 14 L66 28 L76 18 L80 36 Z" fill="' + f + '"' + s + '/></g>';
    case 'brows': return '<g class="c-hat"><path d="M42 50 L55 56 M78 50 L65 56" stroke="' + INK + '" stroke-width="5" stroke-linecap="round"/></g>';
    default: return '';
  }
}
function prop(kind) {
  const s = ' stroke="' + INK + '" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';
  switch (kind) {
    case 'clipboard': return '<g class="c-prop"><rect x="92" y="70" width="22" height="30" rx="3" fill="' + CREAM + '"' + s + '/><path d="M97 80 H109 M97 88 H109" stroke="' + INK + '" stroke-width="3"/></g>';
    case 'magnifier': return '<g class="c-prop"><circle cx="104" cy="70" r="11" fill="' + SKY + '" fill-opacity="0.5"' + s + '/><path d="M96 80 L88 90"' + s + '/></g>';
    case 'binoculars': return '<g class="c-prop"><circle cx="96" cy="84" r="7" fill="' + INK + '"/><circle cx="110" cy="84" r="7" fill="' + INK + '"/></g>';
    case 'quill': return '<g class="c-prop"><path d="M92 102 L114 62 Q118 76 98 100 Z" fill="' + CREAM + '"' + s + '/></g>';
    case 'pencil': return '<g class="c-prop"><path d="M92 104 L112 70 L118 74 L98 108 Z" fill="' + RASP + '"' + s + '/></g>';
    case 'scissors': return '<g class="c-prop"><circle cx="100" cy="96" r="6" fill="none"' + s + '/><circle cx="112" cy="92" r="6" fill="none"' + s + '/><path d="M102 90 L116 68 M110 86 L104 66"' + s + '/></g>';
    case 'palette': return '<g class="c-prop"><ellipse cx="104" cy="86" rx="14" ry="11" fill="' + CREAM + '"' + s + '/><circle cx="100" cy="82" r="3" fill="' + MINT + '"/><circle cx="108" cy="82" r="3" fill="' + SKY + '"/><circle cx="104" cy="90" r="3" fill="' + TANG + '"/></g>';
    case 'wrench': return '<g class="c-prop"><path d="M96 104 L112 74" stroke="' + INK + '" stroke-width="8" stroke-linecap="round"/><circle cx="113" cy="71" r="7" fill="' + STEEL + '"' + s + '/></g>';
    case 'cards': return '<g class="c-prop"><rect x="92" y="72" width="18" height="24" rx="3" fill="' + CREAM + '"' + s + '/><rect x="100" y="66" width="18" height="24" rx="3" fill="' + CREAM + '"' + s + '/></g>';
    case 'roll': return '<g class="c-prop"><rect x="90" y="64" width="14" height="44" rx="7" fill="' + SKY + '"' + s + '/></g>';
    case 'stopwatch': return '<g class="c-prop"><circle cx="104" cy="86" r="12" fill="' + CREAM + '"' + s + '/><path d="M104 86 L104 78 M104 72 V68"' + s + '/></g>';
    case 'book': return '<g class="c-prop"><rect x="90" y="70" width="26" height="32" rx="3" fill="' + VIOLET + '"' + s + '/></g>';
    case 'drawer': return '<g class="c-prop"><rect x="90" y="76" width="26" height="22" rx="3" fill="' + TANG + '"' + s + '/><path d="M98 87 H108"' + s + '/></g>';
    case 'dial': return '<g class="c-prop"><circle cx="104" cy="88" r="11" fill="' + CREAM + '"' + s + '/><path d="M104 88 L110 82"' + s + '/></g>';
    case 'stamp': return '<g class="c-prop"><rect x="98" y="70" width="10" height="20" rx="3" fill="' + INK + '"/><rect x="92" y="88" width="22" height="10" rx="3" fill="' + LEMON + '"' + s + '/></g>';
    case 'finger': return '<g class="c-prop"><path d="M92 84 H118" stroke="' + INK + '" stroke-width="7" stroke-linecap="round"/></g>';
    default: return '';
  }
}
function fbChar(type, opts) {
  const base = type.split('/')[0];
  const variant = type.split('/')[1] || '';
  const t = TYPE[base] || TYPE.master;
  const eye = t.eyes || INK;
  const glint = t.eyes ? INK : '#FFFFFF';
  const s = ' stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"';
  let g = '';
  g += '<ellipse class="c-shadow" cx="60" cy="132" rx="34" ry="6" fill="' + INK + '" fill-opacity="0.15"/>';
  g += '<g class="c-legs"><rect x="42" y="110" width="12" height="18" rx="6" fill="' + INK + '"/><rect x="66" y="110" width="12" height="18" rx="6" fill="' + INK + '"/></g>';
  g += '<rect class="c-arm-l" x="12" y="70" width="14" height="32" rx="7" fill="' + t.fill + '"' + s + '/>';
  g += '<rect class="c-arm-r" x="94" y="70" width="14" height="32" rx="7" fill="' + t.fill + '"' + s + '/>';
  g += '<g class="c-body" fill="' + t.fill + '"' + s + '>' + bodyPath(t.body) + '</g>';
  g += '<path d="M38 52 Q44 44 54 44" fill="none" stroke="' + CREAM + '" stroke-width="4" stroke-linecap="round" opacity="0.8"/>';
  g += '<g class="c-eyes"><ellipse class="c-lid" cx="49" cy="66" rx="5.5" ry="7" fill="' + eye + '"/><ellipse class="c-lid" cx="71" cy="66" rx="5.5" ry="7" fill="' + eye + '"/>' +
    '<circle class="c-pupil" cx="51" cy="63" r="2" fill="' + glint + '"/><circle class="c-pupil" cx="73" cy="63" r="2" fill="' + glint + '"/></g>';
  if (t.monocle) g += '<circle cx="71" cy="66" r="11" fill="none" stroke="' + LEMON + '" stroke-width="3"/>';
  g += mouth((opts && opts.expr) || 'happy').replace(t.eyes ? INK : '§', t.eyes ? CREAM : '§');
  g += hat(t);
  if (variant === 'chief') g += '<path class="c-star" d="M60 20 L64 30 L75 30 L66 36 L69 46 L60 40 L51 46 L54 36 L45 30 L56 30 Z" fill="' + LEMON + '"' + s + '/>';
  g += prop(t.prop);
  return g;
}
function fbMachine(type) {
  const s = ' stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"';
  const lamps = { vesy: [MINT, SKY, MINT], strelochnik: [SKY, MINT, RASP], poryadok: [MINT, MINT, SKY],
    stend: [MINT, RASP, SKY], pochtalon: [SKY, MINT, SKY], zhurnal: [MINT, SKY, MINT] }[type] || [MINT, SKY, RASP];
  let g = '<ellipse class="c-shadow" cx="60" cy="132" rx="40" ry="6" fill="' + INK + '" fill-opacity="0.15"/>';
  g += '<g class="c-body"><rect x="14" y="30" width="92" height="96" rx="10" fill="' + STEEL + '"' + s + '/>' +
    '<rect x="26" y="44" width="68" height="36" rx="6" fill="' + CREAM + '"' + s + '/></g>';
  [22, 98].forEach(function (x) { [38, 118].forEach(function (y) { g += '<circle cx="' + x + '" cy="' + y + '" r="3" fill="' + INK + '"/>'; }); });
  lamps.forEach(function (c, i) { g += '<circle class="c-lamp" cx="' + (38 + i * 22) + '" cy="100" r="8" fill="' + c + '"' + s + '/>'; });
  const glyph = {
    vesy: '<path d="M40 70 H80 M60 52 V70 M46 60 L60 52 L74 60" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>',
    strelochnik: '<path d="M36 70 H56 L80 54 M56 70 L80 70" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>',
    poryadok: '<path d="M36 54 H84 M36 62 H84 M36 70 H84" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>',
    stend: '<path d="M36 70 L48 56 L58 64 L72 50 L84 58" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>',
    pochtalon: '<path d="M38 52 H82 V72 H38 Z M38 52 L60 64 L82 52" fill="none" stroke="' + INK + '" stroke-width="4" stroke-linejoin="round"/>',
    zhurnal: '<path d="M40 52 H80 M40 60 H74 M40 68 H78" stroke="' + INK + '" stroke-width="4" stroke-linecap="round"/>',
  }[type] || '';
  g += glyph;
  g += '<g class="c-prop"><path d="M60 30 V16" stroke="' + INK + '" stroke-width="4"/><circle cx="60" cy="12" r="5" fill="' + RASP + '"' + s + '/></g>';
  return g;
}
function fbPlant(state) {
  const s = ' stroke="' + INK + '" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';
  let g = '<ellipse class="c-shadow" cx="60" cy="134" rx="36" ry="5" fill="' + INK + '" fill-opacity="0.15"/>';
  const droop = state === 'sad';
  g += '<g class="c-leaves">';
  if (droop) {
    g += '<path d="M60 76 Q36 70 26 92 Q44 90 60 80 Z" fill="' + MINT + '"' + s + '/>';
    g += '<path d="M60 76 Q84 70 94 92 Q76 90 60 80 Z" fill="' + MINT + '"' + s + '/>';
    g += '<path d="M60 78 Q56 60 44 58 Q50 70 58 80 Z" fill="' + MINT + '"' + s + '/>';
  } else {
    g += '<path d="M60 78 Q30 66 24 44 Q48 48 60 74 Z" fill="' + MINT + '"' + s + '/>';
    g += '<path d="M60 78 Q90 66 96 44 Q72 48 60 74 Z" fill="' + MINT + '"' + s + '/>';
    g += '<path d="M60 76 Q52 46 60 28 Q68 46 60 76 Z" fill="' + MINT + '"' + s + '/>';
  }
  g += '</g>';
  if (state === 'bloom') {
    g += '<g class="c-flowers">';
    [[38, 40], [60, 24], [82, 40]].forEach(function (p) {
      for (let k = 0; k < 5; k++) {
        const a = k * Math.PI * 2 / 5;
        g += '<circle cx="' + (p[0] + Math.cos(a) * 6).toFixed(1) + '" cy="' + (p[1] + Math.sin(a) * 6).toFixed(1) + '" r="5.5" fill="' + VIOLET + '" stroke="' + INK + '" stroke-width="2.5"/>';
      }
      g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.5" fill="' + LEMON + '" stroke="' + INK + '" stroke-width="2"/>';
    });
    g += '</g>';
  }
  g += '<g class="c-body"><path d="M28 84 H92 L84 128 Q83 132 78 132 H42 Q37 132 36 128 Z" fill="' + TANG + '"' + s + '/><rect x="24" y="80" width="72" height="12" rx="5" fill="' + TANG + '"' + s + '/></g>';
  g += '<g class="c-eyes"><ellipse class="c-lid" cx="50" cy="106" rx="4" ry="5" fill="' + INK + '"/><ellipse class="c-lid" cx="70" cy="106" rx="4" ry="5" fill="' + INK + '"/></g>';
  g += droop ? '<path class="c-mouth" d="M53 121 Q60 115 67 121" fill="none"' + s + '/>' : '<path class="c-mouth" d="M52 116 Q60 124 68 116" fill="none"' + s + '/>';
  return g;
}
function fbPhone(state) {
  const s = ' stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"';
  const night = state === 'notify-night';
  let g = '<g class="c-body"><rect x="6" y="6" width="128" height="248" rx="24" fill="' + INK + '"' + s + '/>' +
    '<rect x="14" y="22" width="112" height="216" rx="14" fill="' + (night ? '#2A2466' : CREAM) + '"/>' +
    '<rect x="54" y="12" width="32" height="5" rx="2.5" fill="' + CREAM + '" opacity="0.6"/></g>';
  if (state === 'list' || state === 'app') {
    for (let i = 0; i < 4; i++) {
      g += '<rect x="24" y="' + (40 + i * 44) + '" width="92" height="34" rx="8" fill="#FFFFFF" stroke="' + INK + '" stroke-width="3"/>' +
        '<circle cx="40" cy="' + (57 + i * 44) + '" r="8" fill="' + [MINT, SKY, TANG, VIOLET][i] + '"/>' +
        '<rect x="54" y="' + (53 + i * 44) + '" width="50" height="7" rx="3.5" fill="' + INK + '" opacity="0.5"/>';
    }
  }
  if (state === 'notify' || night) {
    g += '<g class="c-prop"><rect x="20" y="44" width="100" height="58" rx="12" fill="#FFFFFF" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="36" cy="60" r="8" fill="' + (night ? VIOLET : MINT) + '"/>' +
      '<rect x="50" y="55" width="58" height="7" rx="3.5" fill="' + INK + '"/>' +
      '<rect x="30" y="78" width="80" height="6" rx="3" fill="' + INK + '" opacity="0.45"/>' +
      '<rect x="30" y="88" width="56" height="6" rx="3" fill="' + INK + '" opacity="0.45"/></g>';
    if (night) g += '<path d="M104 150 A18 18 0 1 1 86 128 A14 14 0 0 0 104 150 Z" fill="' + LEMON + '" opacity="0.9"/>';
  }
  return g;
}
function fbStamp() {
  const s = ' stroke="' + INK + '" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';
  return '<g class="c-prop"><circle cx="80" cy="108" r="44" fill="' + LEMON + '"' + s + '/>' +
    '<circle cx="80" cy="108" r="34" fill="none" stroke="' + INK + '" stroke-width="3" stroke-dasharray="6 5"/>' +
    '<text x="80" y="114" text-anchor="middle" font-family="Golos Text" font-weight="800" font-size="12.5" letter-spacing="0.5" fill="' + INK + '">ОДОБРЕНО</text></g>' +
    '<g class="c-arm-r"><rect x="68" y="30" width="24" height="40" rx="6" fill="' + INK + '"/>' +
    '<path d="M60 8 Q80 -2 100 8 L98 34 H62 Z" fill="' + CREAM + '"' + s + '/></g>';
}
function fbBelt(width) {
  const w = Math.max(120, Math.round(width));
  let g = '<g class="belt-body"><rect x="4" y="30" width="' + (w - 8) + '" height="44" rx="22" fill="' + INK + '"/>' +
    '<rect x="12" y="36" width="' + (w - 24) + '" height="32" rx="16" fill="#2A2466"/></g>';
  g += '<g class="belt-rollers">';
  for (let x = 30; x < w - 20; x += 60) g += '<circle cx="' + x + '" cy="52" r="10" fill="' + STEEL + '" stroke="' + INK + '" stroke-width="3"/>';
  g += '</g><g class="belt-chev">';
  for (let x = -60; x < w + 60; x += 48) g += '<path d="M' + x + ' 42 L' + (x + 12) + ' 52 L' + x + ' 62" fill="none" stroke="' + CREAM + '" stroke-width="4" stroke-linecap="round" opacity="0.55"/>';
  g += '</g><g class="belt-legs">';
  for (let x = 40; x < w - 30; x += 160) g += '<rect x="' + x + '" y="74" width="12" height="40" rx="3" fill="' + INK + '"/>';
  g += '</g>';
  return g;
}

// ---------------------------------------------------------------- public API
const loaded = loadKit();
const MP = loaded.kit;
const status = loaded.ok ? 'kit' : 'fallback';
const SITE_CSS = path.resolve(SITE_JS, '..', 'css', 'chars.css');

const ALIAS_PHONE = { 'reminder-0900': 'notify', 'reminder-0300': 'notify-night' };
// viewBoxes: the kit draws everything in fixed boxes (chars.js header); the fallback stamp is larger
const VB = { char: [120, 140], machine: [120, 140], plant: [120, 140], phone: [140, 260],
  stamp: loaded.ok ? [120, 140] : [160, 160], seal: [100, 100] };

function wrap(kind, type, inner, vb, width, id, vbOrigin) {
  const h = Math.round(width * vb[1] / vb[0]);
  const o = vbOrigin || [0, 0];
  return '<svg class="kit kit-' + kind + ' kit-' + String(type).replace(/[^A-Za-z0-9-]/g, '-') + '"' + (id ? ' id="' + id + '"' : '') +
    ' xmlns="http://www.w3.org/2000/svg" viewBox="' + o[0] + ' ' + o[1] + ' ' + vb[0] + ' ' + vb[1] + '" width="' + width + '" height="' + h +
    '" aria-hidden="true" focusable="false">' + inner + '</svg>';
}
function tryKit(fn, args, fallback) {
  if (!loaded.ok || typeof fn !== 'function') return fallback();
  const out = fn.apply(MP, args);           // a throwing kit call is a real bug: let it surface
  if (typeof out !== 'string' || !out.trim()) throw new Error('kit returned nothing for ' + JSON.stringify(args));
  return out;
}
function known(list, v, what, where) {
  if (list && list.length && list.indexOf(v) < 0) {
    throw new Error((where || 'template') + ': unknown ' + what + ' "' + v + '" (have: ' + list.join(', ') + ')');
  }
}
function pick(o, drop) {
  const r = {};
  Object.keys(o || {}).forEach(function (k) { if (drop.indexOf(k) < 0 && o[k] !== undefined) r[k] = o[k]; });
  return r;
}

// opts: {width, id, expr, variant, ...any extra kit option (lamp, cls, ...)}; the id goes on the <svg> only
function char(type, opts) {
  opts = opts || {};
  const base = type.split('/')[0];
  const kitOpts = pick(opts, ['width', 'id']);
  if (type.indexOf('/') > 0) kitOpts.variant = type.split('/')[1];
  const inner = tryKit(MP.char, [base, kitOpts], function () { return fbChar(type, opts); });
  return wrap('char', type, inner, VB.char, opts.width || 160, opts.id);
}
function machine(type, opts) {
  opts = opts || {};
  const inner = tryKit(MP.machine, [type, pick(opts, ['width', 'id'])], function () { return fbMachine(type); });
  return wrap('machine', type, inner, VB.machine, opts.width || 160, opts.id);
}
function plant(state, opts) {
  opts = opts || {};
  const inner = tryKit(MP.plant, [state, pick(opts, ['width', 'id'])], function () { return fbPlant(state); });
  return wrap('plant', state, inner, VB.plant, opts.width || 160, opts.id);
}
function phone(state, opts) {
  opts = opts || {};
  const st = ALIAS_PHONE[state] || state;
  const inner = tryKit(MP.phone, [st, pick(opts, ['width', 'id'])], function () { return fbPhone(st); });
  return wrap('phone', st, inner, VB.phone, opts.width || 200, opts.id);
}
function stampHand(opts) {
  opts = opts || {};
  const inner = tryKit(MP.stampHand, [pick(opts, ['width', 'id'])], function () { return fbStamp(); });
  return wrap('stamp', 'hand', inner, VB.stamp, opts.width || 200, opts.id);
}
function seal(opts) {
  opts = opts || {};
  const inner = tryKit(MP.seal, [pick(opts, ['width', 'id'])], function () {
    return '<circle cx="50" cy="50" r="45" fill="' + LEMON + '" stroke="' + INK + '" stroke-width="4.5"/>' +
      '<text x="50" y="55" text-anchor="middle" font-family="Unbounded" font-weight="900" font-size="12" fill="' + INK + '">' +
      String(opts.text || 'ОДОБРЕНО') + '</text>';
  });
  return wrap('seal', 'seal', inner, VB.seal, opts.width || 160, opts.id);
}
/** straight conveyor: opts {width (= belt length, px = user units), h=34, legs=0, pitch, dir, stations, color} */
function belt(opts) {
  opts = opts || {};
  const w = Math.round(opts.width || 1200);
  if (loaded.ok && typeof MP.belt === 'function') {
    const h = opts.h || 34, legs = opts.legs || 0;
    const kitOpts = pick(opts, ['width', 'id']);
    kitOpts.w = w; kitOpts.h = h; kitOpts.legs = legs;
    const inner = tryKit(MP.belt, [kitOpts], function () { return fbBelt(w); });
    const top = (opts.stations && opts.stations.length) ? 90 : 4;   // station posts/lamps rise above the belt
    return wrap('belt', 'segment', inner, [w + 8, h + legs + top + 8], w + 8, opts.id, [-4, -top]);
  }
  return wrap('belt', 'segment', fbBelt(w), [w, 120], w, opts.id);
}

const FALLBACK_CSS = [
  '.kit .c-body,.kit .c-eyes,.kit .c-lid,.kit .c-pupil,.kit .c-mouth,.kit .c-hat,.kit .c-prop,.kit .c-arm-l,.kit .c-arm-r,',
  '.kit .c-lamp,.kit .c-leaves,.kit .c-flowers,.kit .c-star,.kit .c-shadow,.kit .belt-chev{transform-box:fill-box}',
  '.kit .c-body,.kit .c-hat,.kit .c-leaves,.kit .c-flowers{transform-origin:50% 100%}',
  '.kit .c-eyes,.kit .c-lid,.kit .c-pupil,.kit .c-mouth,.kit .c-lamp,.kit .c-star,.kit .c-shadow{transform-origin:50% 50%}',
  '.kit .c-arm-l{transform-origin:100% 10%}.kit .c-arm-r{transform-origin:0% 10%}.kit .c-prop{transform-origin:30% 90%}',
].join('\n');
/** transform boxes for the structure classes: the SITE's chars.css when the kit is live (the origins the kit
 *  was drawn for), else the fallback rules. CSS comments are stripped. */
function kitCss() {
  let css = FALLBACK_CSS;
  if (loaded.ok && fs.existsSync(SITE_CSS)) {
    css = fs.readFileSync(SITE_CSS, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n{2,}/g, '\n').trim();
  }
  // .kit-rim = the 8 px cream sticker rim around characters (design-video.md §1), hard (no blur)
  return '.kit{display:block;overflow:visible}\n' +
    '.kit-rim{filter:drop-shadow(7px 0 0 #FFF6E6) drop-shadow(-7px 0 0 #FFF6E6) drop-shadow(0 7px 0 #FFF6E6) drop-shadow(0 -7px 0 #FFF6E6)}\n' + css;
}

// %%KIND:arg:arg[#id][{json options}]%%
const PH_RE = /%%(CHAR|MACHINE|PLANT|PHONE|STAMP|SEAL|BELT|KITCSS)(?::([^%{\s]*))?(\{[^%]*\})?%%/g;

/** Expand every kit placeholder in a template. Throws on a malformed one (fail loudly). */
function expand(html, where) {
  where = where || 'template';
  return html.replace(PH_RE, function (all, kind, argStr, jsonStr) {
    if (kind === 'KITCSS') return kitCss();
    const args = (argStr || '').split(':');
    let id = null;
    const last = args[args.length - 1];
    if (last && last.indexOf('#') >= 0) { args[args.length - 1] = last.split('#')[0]; id = last.split('#')[1]; }
    let extra = {};
    if (jsonStr) {
      try { extra = JSON.parse(jsonStr); } catch (e) { throw new Error(where + ': bad JSON options in ' + all + ' (' + e.message + ')'); }
    }
    const num = function (v, name) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) throw new Error(where + ': ' + all + ' needs a positive ' + name);
      return n;
    };
    const o = function (base) { return Object.assign({}, extra, base, { id: id }); };
    try {
      switch (kind) {
        case 'CHAR':
          known(loaded.ok ? MP.charTypes : Object.keys(TYPE).concat(MACHINES), args[0].split('/')[0], 'character', where);
          return char(args[0], o({ width: num(args[1], 'width'), expr: args[2] || extra.expr }));
        case 'MACHINE':
          known(loaded.ok ? MP.machineTypes : MACHINES, args[0], 'machine', where);
          return machine(args[0], o({ width: num(args[1], 'width') }));
        case 'PLANT':
          known(loaded.ok ? MP.plantStates : ['sad', 'happy', 'bloom'], args[0], 'plant state', where);
          return plant(args[0], o({ width: num(args[1], 'width') }));
        case 'PHONE':
          known(loaded.ok ? MP.phoneStates : ['blank', 'list', 'notify', 'notify-night', 'app'], ALIAS_PHONE[args[0]] || args[0], 'phone state', where);
          return phone(args[0], o({ width: num(args[1], 'width') }));
        case 'STAMP': return stampHand(o({ width: num(args[0], 'width') }));
        case 'SEAL': return seal(o({ width: num(args[0], 'width'), text: args[1] || extra.text }));
        case 'BELT': return belt(o({ width: num(args[0], 'width'), h: args[1] ? num(args[1], 'height') : extra.h, legs: args[2] ? Number(args[2]) : extra.legs }));
        default: throw new Error('unknown placeholder ' + all);
      }
    } catch (e) {
      throw new Error(e.message.indexOf(where) === 0 ? e.message : where + ': ' + all + ': ' + e.message);
    }
  });
}

module.exports = {
  status: status, notes: loaded.notes,
  types: loaded.ok ? MP.charTypes : Object.keys(TYPE), machines: loaded.ok ? MP.machineTypes : MACHINES,
  char: char, machine: machine, plant: plant, phone: phone, stampHand: stampHand, seal: seal, belt: belt,
  expand: expand, kitCss: kitCss,
};
