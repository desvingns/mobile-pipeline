'use strict';
// Shared helpers for the video build scripts (CommonJS: package.json is "type":"module").
// Everything here is deterministic: no clocks, no randomness, stable key order.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');           // showcase/video
const SHOWCASE = path.resolve(ROOT, '..');                  // showcase
const P = {
  root: ROOT,
  narration: path.join(ROOT, 'narration', 'narration.json'),
  wordsDir: path.join(ROOT, 'narration', 'words'),
  voiceMeta: path.join(ROOT, 'narration', 'voice.json'),
  voiceSrc: path.join(ROOT, '.media', 'voice'),
  voiceOut: path.join(ROOT, 'assets', 'voice'),
  musicRaw: path.join(ROOT, '.media', 'music', 'lyria-raw.wav'),
  musicSynth: path.join(ROOT, '.media', 'music', 'synth-raw.wav'),
  musicOut: path.join(ROOT, 'assets', 'music', 'bed.wav'),
  musicMeta: path.join(ROOT, 'assets', 'music', 'bed.json'),
  sfxOut: path.join(ROOT, 'assets', 'sfx'),
  sfxLib: 'C:/Users/Admin/.claude/skills/media-use/audio/assets/sfx',
  scenesDir: path.join(ROOT, 'src', 'scenes'),
  scenesMeta: path.join(ROOT, 'src', 'scenes', 'scenes.json'),
  layersDir: path.join(ROOT, 'src', 'layers'),
  sfxPlan: path.join(ROOT, 'src', 'sfx.json'),
  helpers: path.join(ROOT, 'src', 'runtime', 'helpers.js'),
  comps: path.join(ROOT, 'compositions'),
  timing: path.join(ROOT, 'timing.json'),
  media: path.join(SHOWCASE, 'media'),
  siteJs: path.join(SHOWCASE, 'assets', 'js'),
  tmp: path.join(ROOT, '.hyperframes', 'tmp'),
};

function readJSON(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

/** Write only when content changed; returns true if written. Keeps mtimes stable. */
function writeIfChanged(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  if (fs.existsSync(file) && fs.readFileSync(file).equals(buf)) return false;
  fs.writeFileSync(file, buf);
  return true;
}

function die(msg) {
  process.stderr.write('\nERROR: ' + msg + '\n');
  process.exit(1);
}

/** Run a command synchronously; returns {code, stdout, stderr}. Throws with context on spawn failure. */
function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, Object.assign({ encoding: 'utf8', maxBuffer: 1 << 30 }, opts || {}));
  if (r.error) throw new Error(cmd + ' failed to start: ' + r.error.message);
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** Decode any audio file to Float32 PCM via ffmpeg. */
function decodeF32(file, { rate = 48000, channels = 1, filter = null } = {}) {
  const args = ['-v', 'error', '-i', file, '-vn'];
  if (filter) args.push('-af', filter);
  args.push('-ac', String(channels), '-ar', String(rate), '-f', 'f32le', '-');
  const r = spawnSync('ffmpeg', args, { maxBuffer: 2 ** 31 });
  if (r.status !== 0) throw new Error('ffmpeg decode failed for ' + file + ': ' + String(r.stderr));
  const b = r.stdout;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}

/** 16-bit PCM WAV bytes from interleaved Float32 samples (no dither: deterministic). */
function wavBytes(samples, rate, channels) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * channels * 2, 28);
  buf.writeUInt16LE(channels * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    let v = samples[i];
    if (v > 1) v = 1; else if (v < -1) v = -1;
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

/** Minimal WAV header reader: {rate, channels, bits, frames, duration, dataOffset}. */
function wavInfo(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(4096);
  fs.readSync(fd, head, 0, 4096, 0);
  fs.closeSync(fd);
  if (head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(file + ' is not a RIFF/WAVE file');
  }
  let off = 12, fmt = null;
  while (off < head.length - 8) {
    const id = head.toString('ascii', off, off + 4);
    const size = head.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      fmt = { channels: head.readUInt16LE(off + 10), rate: head.readUInt32LE(off + 12), bits: head.readUInt16LE(off + 22) };
    } else if (id === 'data') {
      const frames = size / (fmt.channels * fmt.bits / 8);
      return Object.assign(fmt, { frames, duration: frames / fmt.rate, dataOffset: off + 8 });
    }
    off += 8 + size + (size & 1);
  }
  throw new Error(file + ': no data chunk in the first 4 KB');
}

/** ffmpeg loudnorm measurement (pass 1): {input_i, input_tp, input_lra, input_thresh, ...} as numbers. */
function measureLoudness(file, { I = -16, TP = -1, LRA = 11 } = {}) {
  const r = run('ffmpeg', ['-hide_banner', '-nostats', '-i', file,
    '-af', 'loudnorm=I=' + I + ':TP=' + TP + ':LRA=' + LRA + ':print_format=json', '-f', 'null', '-']);
  const m = r.stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (!m) throw new Error('loudnorm produced no JSON for ' + file + '\n' + r.stderr.slice(-2000));
  const j = JSON.parse(m[0]);
  const out = {};
  Object.keys(j).forEach(function (k) { const n = Number(j[k]); out[k] = Number.isFinite(n) ? n : j[k]; });
  return out;
}

const r3 = (x) => Math.round(x * 1000) / 1000;
const ceil1 = (x) => Math.ceil(Math.round(x * 1000) / 100) / 10;   // round UP to 0.1 s (ms-safe)
const fmtT = (x) => r3(x).toFixed(3);

/** Seconds -> "HH:MM:SS,mmm" (SRT) or "HH:MM:SS.mmm" (VTT). */
function clock(t, sep) {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  const pad = (n, w) => String(n).padStart(w, '0');
  return pad(h, 2) + ':' + pad(m, 2) + ':' + pad(s, 2) + sep + pad(ms % 1000, 3);
}

module.exports = {
  ROOT, SHOWCASE, P, readJSON, writeIfChanged, die, run, decodeF32, wavBytes, wavInfo,
  measureLoudness, r3, ceil1, fmtT, clock,
};
