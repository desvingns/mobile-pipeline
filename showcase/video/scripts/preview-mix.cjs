#!/usr/bin/env node
'use strict';
/**
 * preview-mix.cjs — audio QA without a video render: rebuild the film's mix from index.html the way the
 * HyperFrames renderer does, then measure it.
 *
 * What the renderer does (hyperframes 0.8.65 producer, read from its bundle):
 *   - every <audio> is prepared to 48 kHz; a MONO source is upmixed with `pan=stereo|FL=FL+FC|FR=FR+FC`,
 *     i.e. dual mono at full level in BOTH channels (+3 dB of BS.1770 loudness vs the mono file);
 *   - data-fx-chain + data-automation are rendered by Web Audio (OfflineAudioContext): RBJ biquads for
 *     `peaking`, a dB gain node for `gain`, lanes ramped linearly in clip time;
 *   - tracks are delayed to data-start, scaled by data-volume and summed (amix, then × track count).
 * This script emulates exactly that in Float32 (biquad coefficients refreshed every 128 samples, like a
 * render quantum), writes .hyperframes/qa/preview-mix.wav (+ an .m4a to listen to) and stems, and
 * measures with a BS.1770-4 meter (K-weighting, 400 ms blocks, −70 / −10 LU gates) cross-checked by
 * ffmpeg `ebur128=peak=true` for the full mix.
 *
 *   node scripts/preview-mix.cjs [--no-files]      -> one JSON line
 *
 * Report: mix I / TP, voice stem I, bed momentary loudness in speech vs in gaps (median, speech-only),
 * voice-over-bed margin, SFX peak, and pass/fail against design-video.md §7 targets.
 */
const fs = require('fs');
const path = require('path');
const C = require('./lib/common.cjs');

const RATE = 48000;
const QA = path.join(C.ROOT, '.hyperframes', 'qa');
const writeFiles = process.argv.indexOf('--no-files') < 0;

// ------------------------------------------------------------------ parse index.html
const html = fs.readFileSync(path.join(C.ROOT, 'index.html'), 'utf8');
function unesc(s) { return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
const tracks = [];
(html.match(/<audio\b[^>]*>/g) || []).forEach(function (tag) {
  const a = {};
  tag.replace(/([\w-]+)="([^"]*)"/g, function (_, k, v) { a[k] = unesc(v); return ''; });
  if (!a.id || !a.src) return;
  tracks.push({
    id: a.id, src: a.src, group: a['data-audio-group'] || '',
    start: Number(a['data-start'] || 0), duration: Number(a['data-duration'] || 0),
    mediaStart: Number(a['data-media-start'] || 0), volume: a['data-volume'] != null ? Number(a['data-volume']) : 1,
    chain: a['data-fx-chain'] ? JSON.parse(a['data-fx-chain']) : null,
    automation: a['data-automation'] ? JSON.parse(a['data-automation']) : null,
  });
});
if (!tracks.length) C.die('no <audio> in index.html');
const total = Number((html.match(/data-composition-id="[^"]*"[^>]*data-duration="([\d.]+)"/) || html.match(/data-duration="([\d.]+)"/))[1]);
const N = Math.round(total * RATE);

// ------------------------------------------------------------------ DSP
function lane(auto, target) {
  if (!auto || !auto.lanes) return null;
  const l = auto.lanes.filter(function (x) { return x.target === target; })[0];
  return l && l.points && l.points.length ? l.points : null;
}
function valueAt(points, t, dflt) {
  if (!points) return dflt;
  if (t <= points[0].t) return points[0].v;
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i].t) {
      const p = points[i - 1], q = points[i];
      return q.t === p.t ? q.v : p.v + (q.v - p.v) * (t - p.t) / (q.t - p.t);
    }
  }
  return points[points.length - 1].v;
}
function peakingCoefs(f, gainDb, q) {
  const A = Math.pow(10, gainDb / 40), w0 = 2 * Math.PI * f / RATE, alpha = Math.sin(w0) / (2 * q), cw = Math.cos(w0);
  const a0 = 1 + alpha / A;
  return [(1 + alpha * A) / a0, (-2 * cw) / a0, (1 - alpha * A) / a0, (-2 * cw) / a0, (1 - alpha / A) / a0];
}
/** Apply a track's fx chain (peaking + gain nodes) with automation, in place, on stereo interleaved data. */
function applyChain(buf, frames, chain, auto) {
  if (!chain || !chain.nodes) return;
  const Q = 128;
  chain.nodes.forEach(function (node) {
    const p = node.params || {};
    if (node.type === 'peaking') {
      const gl = lane(auto, 'fx.' + node.id + '.gain'), fl = lane(auto, 'fx.' + node.id + '.frequency'), ql = lane(auto, 'fx.' + node.id + '.q');
      const st = [[0, 0, 0, 0], [0, 0, 0, 0]];   // per channel x1 x2 y1 y2
      for (let b = 0; b < frames; b += Q) {
        const t = b / RATE;
        const k = peakingCoefs(valueAt(fl, t, p.frequency), valueAt(gl, t, p.gain), valueAt(ql, t, p.q));
        const end = Math.min(frames, b + Q);
        for (let ch = 0; ch < 2; ch++) {
          const s = st[ch];
          for (let i = b; i < end; i++) {
            const x = buf[i * 2 + ch];
            const y = k[0] * x + k[1] * s[0] + k[2] * s[1] - k[3] * s[2] - k[4] * s[3];
            s[1] = s[0]; s[0] = x; s[3] = s[2]; s[2] = y;
            buf[i * 2 + ch] = y;
          }
        }
      }
    } else if (node.type === 'gain') {
      const gl = lane(auto, 'fx.' + node.id + '.gain');
      for (let i = 0; i < frames; i++) {
        const g = Math.pow(10, valueAt(gl, i / RATE, p.gain || 0) / 20);
        buf[i * 2] *= g; buf[i * 2 + 1] *= g;
      }
    } else {
      process.stderr.write('preview-mix: fx node type "' + node.type + '" is not emulated (skipped)\n');
    }
  });
}

// ------------------------------------------------------------------ mix
const cache = {};
function source(src) {
  if (cache[src]) return cache[src];
  const file = path.join(C.ROOT, src);
  const info = C.wavInfo(file);
  // mono -> dual mono at full level (renderer: pan=stereo|FL=FL+FC|FR=FR+FC); stereo stays stereo
  const filter = info.channels === 1 ? 'pan=stereo|FL=FC|FR=FC' : null;
  cache[src] = { channels: info.channels, data: C.decodeF32(file, { rate: RATE, channels: 2, filter: filter }) };
  return cache[src];
}
const stems = { mix: new Float32Array(N * 2), voice: new Float32Array(N * 2), bed: new Float32Array(N * 2), sfx: new Float32Array(N * 2) };
const monoSources = [];
tracks.forEach(function (tr) {
  const s = source(tr.src);
  if (s.channels === 1 && monoSources.indexOf(tr.id) < 0) monoSources.push(tr.id);
  const from = Math.round(tr.mediaStart * RATE);
  const frames = Math.min(Math.round(tr.duration * RATE), s.data.length / 2 - from);
  const buf = new Float32Array(frames * 2);
  for (let i = 0; i < frames * 2; i++) buf[i] = s.data[from * 2 + i] * tr.volume;
  applyChain(buf, frames, tr.chain, tr.automation);
  const volLane = lane(tr.automation, 'volume');
  const at = Math.round(tr.start * RATE);
  const stem = tr.group === 'voiceover' ? stems.voice : tr.group === 'music' ? stems.bed : stems.sfx;
  for (let i = 0; i < frames && at + i < N; i++) {
    const g = volLane ? valueAt(volLane, i / RATE, 1) : 1;
    const l = buf[i * 2] * g, r = buf[i * 2 + 1] * g;
    stems.mix[(at + i) * 2] += l; stems.mix[(at + i) * 2 + 1] += r;
    stem[(at + i) * 2] += l; stem[(at + i) * 2 + 1] += r;
  }
});

// ------------------------------------------------------------------ BS.1770-4 meter
const KS = [[1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]];
const KH = [[1, -2, 1], [1, -1.99004745483398, 0.99007225036621]];
/** momentary loudness (400 ms blocks, 100 ms hop): [{t: block centre, L}] and integrated I */
function meter(buf) {
  const frames = buf.length / 2;
  const sq = new Float64Array(frames);
  for (let ch = 0; ch < 2; ch++) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0, u1 = 0, u2 = 0, z1 = 0, z2 = 0;
    for (let i = 0; i < frames; i++) {
      const x = buf[i * 2 + ch];
      const y = KS[0][0] * x + KS[0][1] * x1 + KS[0][2] * x2 - KS[1][1] * y1 - KS[1][2] * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      const z = KH[0][0] * y + KH[0][1] * u1 + KH[0][2] * u2 - KH[1][1] * z1 - KH[1][2] * z2;
      u2 = u1; u1 = y; z2 = z1; z1 = z;
      sq[i] += z * z;
    }
  }
  const cum = new Float64Array(frames + 1);
  for (let i = 0; i < frames; i++) cum[i + 1] = cum[i] + sq[i];
  const W = Math.round(0.4 * RATE), H = Math.round(0.1 * RATE);
  const blocks = [];
  for (let s = 0; s + W <= frames; s += H) {
    const ms = (cum[s + W] - cum[s]) / W;
    blocks.push({ t: (s + W / 2) / RATE, ms: ms, L: ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity });
  }
  const abs = blocks.filter(function (b) { return b.L > -70; });
  const mean = function (bs) { return bs.reduce(function (a, b) { return a + b.ms; }, 0) / bs.length; };
  let I = -Infinity;
  if (abs.length) {
    const rel = -0.691 + 10 * Math.log10(mean(abs)) - 10;
    const gated = abs.filter(function (b) { return b.L > rel; });
    if (gated.length) I = -0.691 + 10 * Math.log10(mean(gated));
  }
  return { blocks: blocks, I: I };
}
function median(xs) {
  const a = xs.filter(Number.isFinite).slice().sort(function (p, q) { return p - q; });
  return a.length ? a[Math.floor(a.length / 2)] : null;
}
const r1 = function (x) { return x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10; };

// speech windows from the karaoke word list (composition seconds)
const capHtml = fs.readFileSync(path.join(C.ROOT, 'compositions', 'captions.html'), 'utf8');
const words = JSON.parse((capHtml.match(/var TRANSCRIPT = (\[[\s\S]*?\]);/) || [])[1] || '[]');
function speechAt(t, pad) {
  for (let i = 0; i < words.length; i++) if (t >= words[i].start - pad && t <= words[i].end + pad) return true;
  return false;
}
const mM = meter(stems.mix), vM = meter(stems.voice), bM = meter(stems.bed), sM = meter(stems.sfx);
const inSpeech = [], inGap = [], margin = [];
bM.blocks.forEach(function (b, i) {
  if (b.t < 3 || b.t > total - 4) return;                         // skip the bed's fades
  const sp = speechAt(b.t - 0.15, 0) && speechAt(b.t + 0.15, 0);   // the whole block is speech
  const gap = !speechAt(b.t, 0.45);                                // ≥0.45 s from any word
  if (sp) { inSpeech.push(b.L); margin.push(vM.blocks[i].L - b.L); }
  if (gap) inGap.push(b.L);
});
function peakDb(buf) { let m = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > m) m = v; } return m > 0 ? 20 * Math.log10(m) : -Infinity; }

let ff = null;
if (writeFiles) {
  fs.mkdirSync(QA, { recursive: true });
  const wav = path.join(QA, 'preview-mix.wav');
  fs.writeFileSync(wav, C.wavBytes(stems.mix, RATE, 2));
  ['voice', 'bed', 'sfx'].forEach(function (k) { fs.writeFileSync(path.join(QA, 'stem-' + k + '.wav'), C.wavBytes(stems[k], RATE, 2)); });
  C.run('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '192k', path.join(QA, 'preview-mix.m4a')]);
  const r = C.run('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const sum = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const I = sum.match(/I:\s+(-?[\d.]+) LUFS/), TP = sum.match(/Peak:\s+(-?[\d.]+) dBFS/), LRA = sum.match(/LRA:\s+(-?[\d.]+) LU/);
  ff = { I: I ? Number(I[1]) : null, TP: TP ? Number(TP[1]) : null, LRA: LRA ? Number(LRA[1]) : null };
}

const report = {
  ok: true,
  total: total,
  tracks: tracks.length,
  monoSourcesUpmixed: monoSources.length,
  mix: { I: r1(mM.I), ffmpegI: ff && ff.I, truePeak: ff && ff.TP, samplePeak: r1(peakDb(stems.mix)), LRA: ff && ff.LRA },
  voice: { I: r1(vM.I), samplePeak: r1(peakDb(stems.voice)) },
  bed: { I: r1(bM.I), speechMedianM: r1(median(inSpeech)), gapMedianM: r1(median(inGap)), speechBlocks: inSpeech.length, gapBlocks: inGap.length },
  voiceOverBedMedianLU: r1(median(margin)),
  sfx: { I: r1(sM.I), samplePeak: r1(peakDb(stems.sfx)) },
  targets: { mixI: '-16±1', mixTP: '<= -1', voiceI: '≈-16', bedGap: '≈-20..-24 M', bedSpeech: '≈-30..-34 M' },
  files: writeFiles ? ['.hyperframes/qa/preview-mix.wav', '.hyperframes/qa/preview-mix.m4a', '.hyperframes/qa/stem-{voice,bed,sfx}.wav'] : [],
};
const fails = [];
const I = report.mix.ffmpegI != null ? report.mix.ffmpegI : report.mix.I;
if (Math.abs(I + 16) > 1) fails.push('mix I ' + I + ' LUFS outside -16±1');
if (report.mix.truePeak != null && report.mix.truePeak > -1) fails.push('mix TP ' + report.mix.truePeak + ' dBTP > -1');
if (Math.abs(report.voice.I + 16) > 1) fails.push('voice I ' + report.voice.I + ' LUFS (dual mono) not ≈-16');
if (report.voiceOverBedMedianLU != null && report.voiceOverBedMedianLU < 10) fails.push('voice only ' + report.voiceOverBedMedianLU + ' LU over the bed in speech');
if (report.bed.gapMedianM != null && report.bed.gapMedianM < -28) fails.push('bed too quiet in gaps (' + report.bed.gapMedianM + ' LUFS M)');
report.ok = fails.length === 0;
report.fails = fails;
process.stdout.write(JSON.stringify(report) + '\n');
process.exit(report.ok ? 0 : 2);
