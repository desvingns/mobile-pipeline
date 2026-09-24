#!/usr/bin/env node
'use strict';
/*
 * process-music.cjs — the music bed: raw take -> assets/music/bed.wav (48 kHz stereo 16-bit).
 *
 *   source  .media/music/lyria-raw.wav (Google Lyria RealTime), or with --source synth / when the
 *           Lyria take is missing or too short: .media/music/synth-raw.wav (scripts/synth-music.cjs)
 *   trim    [offset, offset + total + 0.5 s]      total = film length from the timing plan
 *   fades   1.0 s in, 3.0 s out (equal-power-ish qsin)
 *   level   loudnorm pass 1 -> one linear gain to -20 LUFS; a limiter only if TP would pass -1 dBTP
 *           -> loudnorm pass 2 verifies. The carve (scripts/carve.cjs) later ducks it under the voice.
 *   meta    assets/music/bed.json {source, offset, duration, gainDb, measured}
 *
 * Usage: node scripts/process-music.cjs [--source lyria|synth] [--offset <s>]
 */
const fs = require('fs');
const path = require('path');
const C = require('./lib/common.cjs');
const { computePlan } = require('./lib/plan.cjs');

const RATE = 48000;
const TARGET_I = -20;
const TARGET_TP = -1;
const FADE_IN = 1.0;
const FADE_OUT = 3.0;

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

function main() {
  const plan = computePlan();
  const length = C.r3(plan.total + 0.5);
  const offset = Number(arg('--offset', '0'));
  let source = arg('--source', null);
  if (!source) {
    const ok = fs.existsSync(C.P.musicRaw) && C.wavInfo(C.P.musicRaw).duration >= offset + length;
    source = ok ? 'lyria' : 'synth';
    if (!ok) process.stderr.write('Lyria take missing or shorter than ' + (offset + length) + ' s — using the synth fallback\n');
  }
  const raw = source === 'lyria' ? C.P.musicRaw : C.P.musicSynth;
  if (!fs.existsSync(raw)) C.die(raw + ' missing' + (source === 'synth' ? ' — run scripts/synth-music.cjs first' : ''));
  const info = C.wavInfo(raw);
  if (info.duration < offset + length) C.die(raw + ' is ' + info.duration.toFixed(2) + ' s; need ' + (offset + length).toFixed(2) + ' s');

  fs.mkdirSync(C.P.tmp, { recursive: true });
  const shaped = path.join(C.P.tmp, 'bed-shaped.wav');
  const shape = 'atrim=start=' + offset + ':duration=' + length + ',asetpts=PTS-STARTPTS,' +
    'aresample=' + RATE + ':resampler=soxr,' +
    'afade=t=in:st=0:d=' + FADE_IN + ':curve=qsin,' +
    'afade=t=out:st=' + C.r3(length - FADE_OUT) + ':d=' + FADE_OUT + ':curve=qsin';
  let r = C.run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', shape, '-ac', '2', '-ar', String(RATE), '-c:a', 'pcm_f32le', shaped]);
  if (r.code !== 0) C.die('ffmpeg shape failed: ' + r.stderr);

  const before = C.measureLoudness(shaped, { I: TARGET_I, TP: TARGET_TP });
  const gainDb = TARGET_I - before.input_i;
  const limiter = before.input_tp + gainDb > TARGET_TP;
  const level = 'volume=' + gainDb.toFixed(3) + 'dB' + (limiter ? ',alimiter=limit=0.79433:attack=5:release=60:level=disabled:latency=1' : '');
  const outTmp = path.join(C.P.tmp, 'bed-out.wav');
  r = C.run('ffmpeg', ['-v', 'error', '-y', '-i', shaped, '-af', level, '-ac', '2', '-ar', String(RATE), '-c:a', 'pcm_s16le',
    '-fflags', '+bitexact', '-flags:a', '+bitexact', '-map_metadata', '-1', outTmp]);
  if (r.code !== 0) C.die('ffmpeg level failed: ' + r.stderr);
  // re-wrap as a canonical 44-byte-header WAV so the bytes are stable across ffmpeg versions
  const pcm = C.decodeF32(outTmp, { rate: RATE, channels: 2 });
  const frames = Math.round(length * RATE);
  const buf = new Float32Array(frames * 2);
  buf.set(pcm.subarray(0, Math.min(pcm.length, buf.length)));
  C.writeIfChanged(C.P.musicOut, C.wavBytes(buf, RATE, 2));
  const after = C.measureLoudness(C.P.musicOut, { I: TARGET_I, TP: TARGET_TP });

  const meta = {
    source: source === 'lyria' ? '.media/music/lyria-raw.wav (Google Lyria RealTime)' : '.media/music/synth-raw.wav (scripts/synth-music.cjs)',
    offset: offset, duration: C.r3(frames / RATE), fadeIn: FADE_IN, fadeOut: FADE_OUT,
    targetLufs: TARGET_I, gainDb: C.r3(gainDb), limiter: limiter,
    measured: { before: { I: before.input_i, TP: before.input_tp }, after: { I: after.input_i, TP: after.input_tp } },
  };
  C.writeIfChanged(C.P.musicMeta, JSON.stringify(meta, null, 1) + '\n');
  process.stdout.write(JSON.stringify(Object.assign({ ok: true, file: 'assets/music/bed.wav' }, meta)) + '\n');
}

main();
