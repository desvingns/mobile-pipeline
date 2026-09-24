#!/usr/bin/env node
'use strict';
/*
 * carve.cjs — voiceover carve of the music bed, then assert it really landed.
 *
 * build-video.cjs rewrites index.html from scratch, which drops the carve attributes, so run this after
 * EVERY build:  node scripts/build-video.cjs && node scripts/carve.cjs
 *
 * Runs the hyperframes-audio skill's carve.mjs (same analysis as Studio's carve panel):
 *   node <skills>/hyperframes-audio/scripts/carve.mjs --comp index.html --bed music-bed [--strength 0.55]
 * then checks #music-bed carries data-fx-carve (sources = ["voiceover"], the voice GROUP), a
 * data-fx-chain with peaking bands + a gain stage, and a data-automation lane per carved node.
 *
 * Usage: node scripts/carve.cjs [--strength 0.55] [--carve <path to carve.mjs>]
 */
const fs = require('fs');
const path = require('path');
const C = require('./lib/common.cjs');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }

const CARVE = arg('--carve', process.env.HF_CARVE || 'C:/Users/Admin/.claude/skills/hyperframes-audio/scripts/carve.mjs');
// 0.55, not the skill default 0.8: measured with scripts/preview-mix.cjs on this voice (-16 LUFS dual mono) and
// bed (-20 LUFS), 0.8 buried the bed at -36.5 LUFS-M under speech (19.8 LU below the voice) and -31 in the
// pauses; 0.55 puts it at -32 under speech (15.4 LU margin, inside design-video.md §7 -30..-34) and -28 in the
// short pauses between scenes, where the carve envelope never fully releases.
const STRENGTH = arg('--strength', '0.55');
const INDEX = path.join(C.ROOT, 'index.html');

function attr(tag, name) {
  const m = tag.match(new RegExp('\\s' + name + '="([^"]*)"'));
  return m ? m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&') : null;
}

function main() {
  if (!fs.existsSync(CARVE)) C.die('carve.mjs not found at ' + CARVE + ' (pass --carve <path> or set HF_CARVE)');
  const r = C.run(process.execPath, [CARVE, '--comp', 'index.html', '--bed', 'music-bed', '--strength', STRENGTH], { cwd: C.ROOT });
  process.stdout.write(r.stdout);
  if (r.stderr.trim()) process.stderr.write(r.stderr);
  if (r.code !== 0) C.die('carve.mjs exited with ' + r.code);

  const html = fs.readFileSync(INDEX, 'utf8');
  const tag = (html.match(/<audio\b[^>]*\sid="music-bed"[^>]*>/) || [])[0];
  if (!tag) C.die('index.html has no <audio id="music-bed">');
  const carve = attr(tag, 'data-fx-carve');
  const chain = attr(tag, 'data-fx-chain');
  const auto = attr(tag, 'data-automation');
  const problems = [];
  let carveJ = null, chainJ = null, autoJ = null;
  try { carveJ = JSON.parse(carve); } catch (e) { problems.push('data-fx-carve missing or not JSON'); }
  try { chainJ = JSON.parse(chain); } catch (e) { problems.push('data-fx-chain missing or not JSON'); }
  try { autoJ = JSON.parse(auto); } catch (e) { problems.push('data-automation missing or not JSON'); }
  if (carveJ) {
    if (!carveJ.enabled) problems.push('carve not enabled');
    if (JSON.stringify(carveJ.sources) !== JSON.stringify(['voiceover'])) problems.push('carve sources should be the voice group ["voiceover"], got ' + JSON.stringify(carveJ.sources));
  }
  const nodes = chainJ ? chainJ.nodes || [] : [];
  const bands = nodes.filter(function (n) { return n.type === 'peaking' && n.fromCarve; });
  const gains = nodes.filter(function (n) { return n.type === 'gain' && n.fromCarve; });
  if (chainJ && !bands.length) problems.push('no carve bands (peaking nodes) in data-fx-chain');
  if (chainJ && !gains.length) problems.push('no level-match gain stage in data-fx-chain');
  const lanes = autoJ ? autoJ.lanes || [] : [];
  const ids = nodes.map(function (n) { return n.id; });
  const orphan = lanes.filter(function (l) { const m = String(l.target).match(/^fx\.([^.]+)\./); return m && ids.indexOf(m[1]) < 0; });
  if (autoJ && !lanes.length) problems.push('no automation lanes (the carve should follow the voice)');
  if (orphan.length) problems.push(orphan.length + ' automation lane(s) point at nodes missing from the chain');
  // groups: the voice group must hold voices only
  const audios = html.match(/<audio\b[^>]*>/g) || [];
  const strays = audios.filter(function (a) { return attr(a, 'data-audio-group') === 'voiceover' && !/\sid="vo-/.test(a); });
  if (strays.length) problems.push('non-voice clips in the voiceover group: ' + strays.length);
  if (problems.length) C.die('carve assertions failed:\n  ' + problems.join('\n  '));

  const floor = gains.length && lanes.length ? Math.min.apply(null, lanes.filter(function (l) { return l.target.indexOf(gains[0].id) >= 0; })
    .reduce(function (a, l) { return a.concat(l.points.map(function (p) { return p.v; })); }, [0])) : null;
  process.stdout.write(JSON.stringify({ ok: true, bed: 'music-bed', sources: carveJ.sources, strength: carveJ.strength,
    bands: bands.length, gainStages: gains.length, lanes: lanes.length, duckFloorDb: floor }) + '\n');
}

main();
