#!/usr/bin/env node
'use strict';
/**
 * contact-sheet.cjs — QA helper: tile a folder of `hyperframes snapshot` frames into labelled
 * contact sheets with ffmpeg (one glance per 12 frames instead of 12 image reads).
 *
 *   node scripts/contact-sheet.cjs <snapshot-dir> [--cols 4] [--rows 3] [--w 480] [--out <dir>]
 *
 * Frames are read in name order (frame-NN-at-<t>s.png, as written by `hyperframes snapshot`); each
 * tile is labelled with its time and the scene it belongs to (from timing.json). Writes
 * <out>/sheet-<n>.png (default <snapshot-dir>/sheets) and prints one JSON line.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
function opt(name, dflt) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : dflt;
}
const dir = args[0] && !args[0].startsWith('--') ? path.resolve(args[0]) : null;
if (!dir || !fs.existsSync(dir)) {
  process.stdout.write(JSON.stringify({ ok: false, error: 'usage: contact-sheet.cjs <snapshot-dir>' }) + '\n');
  process.exit(1);
}
const cols = Number(opt('cols', 4));
const rows = Number(opt('rows', 3));
const tw = Number(opt('w', 480));
const th = Math.round(tw * 9 / 16);
const out = path.resolve(opt('out', path.join(dir, 'sheets')));
fs.mkdirSync(out, { recursive: true });

const timing = JSON.parse(fs.readFileSync(path.join(ROOT, 'timing.json'), 'utf8'));
function sceneAt(t) {
  const s = timing.scenes.filter(function (x) { return t >= x.start - 1e-6 && t < x.end + 1e-6; })[0];
  return s ? s.id.slice(0, 3).toUpperCase() + ' +' + (t - s.start).toFixed(2) : '';
}

function tOf(f) { const m = f.match(/-at-([\d.]+)s\.png$/); return m ? Number(m[1]) : 0; }
// by time, not by name: the CLI switches from 2- to 3-digit indices past frame 99
const frames = fs.readdirSync(dir).filter(function (f) { return /^frame-\d+.*\.png$/.test(f); })
  .sort(function (a, b) { return tOf(a) - tOf(b); });
const per = cols * rows;
const font = process.platform === 'win32' ? 'C\\:/Windows/Fonts/arialbd.ttf' : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const sheets = [];
for (let s = 0; s * per < frames.length; s++) {
  const batch = frames.slice(s * per, (s + 1) * per);
  const inputs = [];
  const parts = [];
  batch.forEach(function (f, i) {
    inputs.push('-i', path.join(dir, f));
    const m = f.match(/-at-([\d.]+)s\.png$/);
    const t = m ? Number(m[1]) : 0;
    const label = (t.toFixed(2) + 's  ' + sceneAt(t)).replace(/:/g, '\\:');
    parts.push('[' + i + ':v]scale=' + tw + ':' + th + ',drawbox=x=0:y=0:w=iw:h=26:color=black@0.72:t=fill,' +
      "drawtext=fontfile='" + font + "':text='" + label + "':x=8:y=5:fontsize=17:fontcolor=white[t" + i + ']');
  });
  // pad the last sheet with black tiles so xstack always gets cols*rows inputs
  for (let i = batch.length; i < per; i++) parts.push('color=c=0x222222:s=' + tw + 'x' + th + ':d=1[t' + i + ']');
  const layout = [];
  for (let i = 0; i < per; i++) layout.push((i % cols) * tw + '_' + Math.floor(i / cols) * th);
  const stack = Array.from({ length: per }, function (_, i) { return '[t' + i + ']'; }).join('') +
    'xstack=inputs=' + per + ':layout=' + layout.join('|') + '[out]';
  const file = path.join(out, 'sheet-' + (s + 1) + '.png');
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y'].concat(inputs, ['-filter_complex', parts.concat(stack).join(';'),
    '-map', '[out]', '-frames:v', '1', file]), { encoding: 'utf8' });
  if (r.status !== 0) {
    process.stdout.write(JSON.stringify({ ok: false, error: (r.stderr || '').slice(0, 800) }) + '\n');
    process.exit(1);
  }
  sheets.push(file);
}
process.stdout.write(JSON.stringify({ ok: true, frames: frames.length, sheets: sheets }) + '\n');
