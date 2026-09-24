#!/usr/bin/env node
'use strict';
/*
 * verify-output.cjs — gate the rendered film, then publish it to showcase/media/.
 *
 *   input     renders/mobile-pipeline.mp4 (or --input <file>)
 *   checks    ffprobe: H.264 High, yuv420p, 1920x1080, 30 fps CFR (r_frame_rate = avg_frame_rate = 30/1),
 *             AAC 48 kHz stereo, duration = timing.json total (±0.1 s)
 *             moov before mdat (+faststart) — remuxed with `-c copy -movflags +faststart` when it is not
 *             loudness −16 ±1 LUFS integrated, true peak ≤ −1 dBTP (ffmpeg loudnorm, measure only)
 *             `ffmpeg -v error -i out.mp4 -f null -` prints nothing
 *             optional --log <render log>: no "[WARN] [compile] Audio", and the three families are mentioned
 *   outputs   ../media/mobile-pipeline.mp4, ../media/poster.jpg (end card at total − 1.5 s),
 *             ../media/chapters.js refreshed with the probed duration (SRT/VTT/transcript come from the build)
 *   report    .hyperframes/verify-output.json + one JSON line on stdout; exit 1 if any check fails
 *
 * Usage: node scripts/verify-output.cjs [--input renders/mobile-pipeline.mp4] [--log renders/render.log] [--no-publish]
 */
const fs = require('fs');
const path = require('path');
const C = require('./lib/common.cjs');

function arg(name, def) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : def; }
const INPUT = path.resolve(C.ROOT, arg('--input', 'renders/mobile-pipeline.mp4'));
const LOG = arg('--log', null);
const PUBLISH = process.argv.indexOf('--no-publish') < 0;

/** Top-level MP4 boxes in file order (enough to see whether moov precedes mdat). */
function topBoxes(file) {
  const fd = fs.openSync(file, 'r');
  const size = fs.fstatSync(fd).size;
  const out = [];
  let off = 0;
  const hdr = Buffer.alloc(16);
  while (off + 8 <= size && out.length < 64) {
    fs.readSync(fd, hdr, 0, 16, off);
    let len = hdr.readUInt32BE(0);
    const type = hdr.toString('latin1', 4, 8);
    if (len === 1) len = Number(hdr.readBigUInt64BE(8));
    else if (len === 0) len = size - off;
    if (len < 8) break;
    out.push(type);
    off += len;
  }
  fs.closeSync(fd);
  return out;
}

function probe(file) {
  const r = C.run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file]);
  if (r.code !== 0) C.die('ffprobe failed: ' + r.stderr);
  return JSON.parse(r.stdout);
}

function main() {
  if (!fs.existsSync(INPUT)) C.die('no render at ' + INPUT + ' — render first (see README.md)');
  const timing = C.readJSON(C.P.timing);
  const checks = [];
  const check = function (name, ok, detail) { checks.push({ name: name, ok: !!ok, detail: detail }); };

  // faststart first (a remux does not change streams)
  let file = INPUT;
  const boxes = topBoxes(file);
  const moov = boxes.indexOf('moov'), mdat = boxes.indexOf('mdat');
  let remuxed = false;
  if (moov < 0 || mdat < 0 || moov > mdat) {
    const tmp = INPUT.replace(/\.mp4$/i, '.faststart.mp4');
    const r = C.run('ffmpeg', ['-v', 'error', '-y', '-i', INPUT, '-map', '0', '-c', 'copy', '-movflags', '+faststart', tmp]);
    if (r.code !== 0) C.die('faststart remux failed: ' + r.stderr);
    fs.renameSync(tmp, INPUT);
    remuxed = true;
  }
  const boxes2 = topBoxes(file);
  check('faststart', boxes2.indexOf('moov') >= 0 && boxes2.indexOf('moov') < boxes2.indexOf('mdat'), { boxes: boxes2.slice(0, 6), remuxed: remuxed });

  const p = probe(file);
  const v = p.streams.filter(function (s) { return s.codec_type === 'video'; })[0] || {};
  const a = p.streams.filter(function (s) { return s.codec_type === 'audio'; })[0] || {};
  check('video codec H.264 High', v.codec_name === 'h264' && /High/i.test(v.profile || ''), { codec: v.codec_name, profile: v.profile });
  check('pixel format yuv420p', v.pix_fmt === 'yuv420p', v.pix_fmt);
  check('size 1920x1080', v.width === 1920 && v.height === 1080, v.width + 'x' + v.height);
  check('30 fps CFR', v.r_frame_rate === '30/1' && v.avg_frame_rate === '30/1', { r: v.r_frame_rate, avg: v.avg_frame_rate });
  check('audio AAC 48 kHz stereo', a.codec_name === 'aac' && Number(a.sample_rate) === 48000 && Number(a.channels) === 2,
    { codec: a.codec_name, rate: a.sample_rate, channels: a.channels });
  const dur = Number(p.format.duration);
  check('duration matches plan', Math.abs(dur - timing.total) <= 0.1, { probed: dur, planned: timing.total });

  const ln = C.measureLoudness(file, { I: -16, TP: -1 });
  check('loudness -16 +/-1 LUFS', ln.input_i >= -17 && ln.input_i <= -15, ln.input_i);
  check('true peak <= -1 dBTP', ln.input_tp <= -1.0, ln.input_tp);

  const dec = C.run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-']);
  check('clean decode', dec.code === 0 && !dec.stderr.trim(), dec.stderr.trim().split('\n').slice(0, 5));

  if (LOG) {
    const log = fs.readFileSync(path.resolve(C.ROOT, LOG), 'utf8');
    check('render log: no compile audio warnings', !/\[WARN\]\s*\[compile\]\s*Audio/i.test(log), null);
    // HyperFrames 0.8.65 logs embedded font FILES (unbounded-cyrillic-…woff2), older builds log family names; accept either.
    const low = log.toLowerCase();
    const fams = [['Unbounded', 'unbounded'], ['Golos Text', 'golos-text'], ['JetBrains Mono', 'jetbrains-mono']]
      .filter(function (f) { return log.indexOf(f[0]) < 0 && low.indexOf(f[1]) < 0; }).map(function (f) { return f[0]; });
    check('render log: fonts mentioned', fams.length === 0, fams.length ? { missing: fams } : null);
  }

  const failed = checks.filter(function (c) { return !c.ok; });
  const report = { ok: failed.length === 0, input: path.relative(C.ROOT, INPUT).replace(/\\/g, '/'), duration: dur, checks: checks,
    loudness: { I: ln.input_i, TP: ln.input_tp, LRA: ln.input_lra }, published: false };

  if (PUBLISH && failed.length === 0) {
    fs.mkdirSync(C.P.media, { recursive: true });
    // The delivery master (~4.5 Mbit/s) stays in renders/; the site gets a web encode of the same frames:
    // flat-colour animation compresses well, CRF 21 keeps it visually identical at a fraction of the size.
    const web = path.join(C.P.media, 'mobile-pipeline.mp4');
    const enc = C.run('ffmpeg', ['-v', 'error', '-y', '-i', file, '-map', '0', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21',
      '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30', '-g', '60', '-c:a', 'copy', '-movflags', '+faststart', web]);
    if (enc.code !== 0) C.die('web encode failed: ' + enc.stderr);
    const wp = probe(web);
    if (wp && Math.abs(Number(wp.format.duration) - dur) > 0.1) C.die('web encode duration drift: ' + wp.format.duration);
    report.web = { file: '../media/mobile-pipeline.mp4', bytes: fs.statSync(web).size };
    const posterAt = Math.max(0, timing.total - 1.5).toFixed(3);
    const r = C.run('ffmpeg', ['-v', 'error', '-y', '-ss', posterAt, '-i', file, '-frames:v', '1', '-q:v', '2', path.join(C.P.media, 'poster.jpg')]);
    if (r.code !== 0) C.die('poster extraction failed: ' + r.stderr);
    C.writeIfChanged(path.join(C.P.media, 'chapters.js'), '/* Generated by video/scripts/build-video.cjs; duration refreshed by verify-output.cjs from the render. */\n' +
      'window.MP_VIDEO = ' + JSON.stringify({
        duration: Math.round(dur * 1000) / 1000,
        chapters: timing.scenes.map(function (s) { return { id: s.id, title: s.title, start: s.start }; }),
      }, null, 1) + ';\n');
    report.published = true;
    report.poster = { at: Number(posterAt), file: '../media/poster.jpg' };
  }
  fs.mkdirSync(path.join(C.ROOT, '.hyperframes'), { recursive: true });
  fs.writeFileSync(path.join(C.ROOT, '.hyperframes', 'verify-output.json'), JSON.stringify(report, null, 1) + '\n');
  process.stdout.write(JSON.stringify({ ok: report.ok, duration: dur, loudness: report.loudness, published: report.published,
    failed: failed.map(function (c) { return c.name; }) }) + '\n');
  if (failed.length) process.exit(1);
}

main();
