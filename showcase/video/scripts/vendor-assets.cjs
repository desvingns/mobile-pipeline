#!/usr/bin/env node
'use strict';
/*
 * vendor-assets.cjs — copy every third-party file the film needs into assets/ so renders never
 * touch the network, and write the licence notes next to them.
 *
 *   assets/fonts/<family>-{cyrillic,latin}-wght-normal.woff2   (from @fontsource-variable, OFL-1.1)
 *   assets/vendor/gsap/*.min.js                                   (gsap 3.14.2, GSAP standard licence)
 *   assets/sfx/<name>.wav  48 kHz stereo 16-bit, peak-normalised to -3 dBFS (Pixabay licence)
 *   assets/sfx/manifest.json  {name:{file,duration,peakAt,gainDb}}  peakAt = loudest 10 ms window (s)
 *   assets/LICENSES.md
 *
 * Usage: node scripts/vendor-assets.cjs            (idempotent; rewrites only changed files)
 */
const fs = require('fs');
const path = require('path');
const C = require('./lib/common.cjs');

const NM = path.join(C.ROOT, 'node_modules');
const FONTS = [
  { pkg: 'unbounded', family: 'Unbounded', weights: '200 900' },
  { pkg: 'golos-text', family: 'Golos Text', weights: '400 900' },
  { pkg: 'jetbrains-mono', family: 'JetBrains Mono', weights: '100 800' },
];
const SUBSETS = ['cyrillic', 'latin'];
const GSAP_FILES = ['gsap.min.js', 'CustomEase.min.js', 'MotionPathPlugin.min.js', 'DrawSVGPlugin.min.js', 'MorphSVGPlugin.min.js'];
const SFX = ['pop', 'click', 'click-soft', 'chime', 'sparkle', 'whoosh', 'whoosh-short', 'error', 'notification',
  'impact-bass-1', 'ping', 'typing', 'key-press', 'glitch-3'];
const SFX_RATE = 48000;
const SFX_PEAK_DB = -3;

function copy(src, dst) {
  if (!fs.existsSync(src)) C.die('missing ' + src + ' (npm install in showcase/video?)');
  return C.writeIfChanged(dst, fs.readFileSync(src));
}

function main() {
  const changed = [];
  // fonts
  FONTS.forEach(function (f) {
    SUBSETS.forEach(function (s) {
      const name = f.pkg + '-' + s + '-wght-normal.woff2';
      if (copy(path.join(NM, '@fontsource-variable', f.pkg, 'files', name), path.join(C.ROOT, 'assets', 'fonts', name))) changed.push(name);
    });
    if (copy(path.join(NM, '@fontsource-variable', f.pkg, 'LICENSE'), path.join(C.ROOT, 'assets', 'fonts', 'LICENSE-' + f.pkg + '.txt'))) changed.push('LICENSE-' + f.pkg);
  });
  // gsap
  const gsapVersion = C.readJSON(path.join(NM, 'gsap', 'package.json')).version;
  GSAP_FILES.forEach(function (f) {
    if (copy(path.join(NM, 'gsap', 'dist', f), path.join(C.ROOT, 'assets', 'vendor', 'gsap', f))) changed.push(f);
  });
  // sfx
  const manifest = {};
  SFX.forEach(function (name) {
    const src = path.join(C.P.sfxLib, name + '.mp3');
    if (!fs.existsSync(src)) C.die('missing SFX ' + src);
    const pcm = C.decodeF32(src, { rate: SFX_RATE, channels: 2 });
    const frames = pcm.length / 2;
    let peak = 0;
    for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > peak) peak = a; }
    const gainDb = SFX_PEAK_DB - 20 * Math.log10(peak || 1e-9);
    const g = Math.pow(10, gainDb / 20);
    const out = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] * g;
    // loudest 10 ms RMS window = where the hit "lands"
    const win = SFX_RATE / 100;
    let bestAt = 0, best = -1;
    for (let w = 0; w + win <= frames; w += win / 2) {
      let e = 0;
      for (let k = w; k < w + win; k++) { const l = pcm[2 * k], r = pcm[2 * k + 1]; e += l * l + r * r; }
      if (e > best) { best = e; bestAt = w; }
    }
    if (C.writeIfChanged(path.join(C.P.sfxOut, name + '.wav'), C.wavBytes(out, SFX_RATE, 2))) changed.push(name + '.wav');
    manifest[name] = { file: 'assets/sfx/' + name + '.wav', duration: C.r3(frames / SFX_RATE), peakAt: C.r3(bestAt / SFX_RATE), gainDb: C.r3(gainDb) };
  });
  C.writeIfChanged(path.join(C.P.sfxOut, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');

  const lic = [
    '# Third-party assets in this folder',
    '',
    '| Path | Source | Licence |',
    '|---|---|---|',
    '| `fonts/unbounded-*.woff2` | @fontsource-variable/unbounded (Unbounded Project Authors) | SIL OFL 1.1 — `fonts/LICENSE-unbounded.txt` |',
    '| `fonts/golos-text-*.woff2` | @fontsource-variable/golos-text (Golos Text Project Authors) | SIL OFL 1.1 — `fonts/LICENSE-golos-text.txt` |',
    '| `fonts/jetbrains-mono-*.woff2` | @fontsource-variable/jetbrains-mono (JetBrains) | SIL OFL 1.1 — `fonts/LICENSE-jetbrains-mono.txt` |',
    '| `vendor/gsap/*.min.js` | gsap ' + gsapVersion + ' (GreenSock / Webflow) | GSAP Standard "no charge" licence — https://gsap.com/standard-license |',
    '| `sfx/*.wav` | HyperFrames media-use bundled library, originally Pixabay | Pixabay Content License — https://pixabay.com/service/license-summary/ (no attribution required) |',
    '| `music/bed.wav` | Generated for this project with Google Lyria RealTime (or `scripts/synth-music.cjs`) | Project-owned generation; see `music/bed.json` for the source |',
    '| `voice/*.wav` | Generated with Microsoft Edge neural TTS (edge-tts, ru-RU-SvetlanaNeural) | Synthetic narration generated for this project |',
    '',
    'All files are copied by `node scripts/vendor-assets.cjs` (fonts, GSAP, SFX); voice and music by the',
    'audio scripts. Nothing is fetched at render time.',
    '',
  ].join('\n');
  C.writeIfChanged(path.join(C.ROOT, 'assets', 'LICENSES.md'), lic);

  process.stdout.write(JSON.stringify({ ok: true, fonts: FONTS.length * SUBSETS.length, gsap: gsapVersion,
    gsapFiles: GSAP_FILES.length, sfx: SFX.length, changed: changed.length }) + '\n');
}

main();
