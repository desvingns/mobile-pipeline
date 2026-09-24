#!/usr/bin/env node
'use strict';
/*
 * synth-music.cjs — offline, seeded fallback for the music bed (used when Lyria is unavailable).
 *
 * 112 BPM, D major, I–V–vi–IV (D A Bm G) one chord per bar. Voices: kick, clap, hat, bass,
 * marimba-like pluck (sine + 4th partial, fast decay), soft detuned-saw pad through a one-pole LPF.
 * The arrangement changes on the first bar line at/after each scene start (from the timing plan):
 *   s01 pad+pluck · s02 +bass+hat · s03–s06 groove (kick 1&3, clap 2&4) · s07 four-on-the-floor
 *   · s08 «night»: filtered pad, pulse bass, no clap · s09 full + bright pluck 16ths · s10 pad+pluck.
 * Same seed -> same bytes. Output: .media/music/synth-raw.wav (48 kHz stereo 16-bit), then run
 * `node scripts/process-music.cjs --source synth`.
 *
 * Usage: node scripts/synth-music.cjs [--seed 7]
 */
const fs = require('fs');
const path = require('path');
const C = require('./lib/common.cjs');
const { computePlan } = require('./lib/plan.cjs');

const RATE = 48000;
const BPM = 112;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// D major I–V–vi–IV as MIDI chord tones (root position around D3)
const CHORDS = [
  { root: 38, tones: [50, 54, 57] },   // D  (D3 F#3 A3), bass D2
  { root: 45, tones: [49, 52, 57] },   // A  (C#3 E3 A3), bass A2
  { root: 47, tones: [50, 54, 59] },   // Bm (D3 F#3 B3), bass B2
  { root: 43, tones: [50, 55, 59] },   // G  (D3 G3 B3), bass G2
];

const STYLES = {
  's01-hook':      { pad: 0.9, pluck: 0.7, bass: 0,   hat: 0,   kick: 0, clap: 0, lpf: 1800, pluck16: false },
  's02-factory':   { pad: 0.8, pluck: 0.8, bass: 0.8, hat: 0.5, kick: 0, clap: 0, lpf: 2600, pluck16: false },
  's03-talk':      { pad: 0.7, pluck: 0.8, bass: 0.9, hat: 0.6, kick: 1, clap: 0.7, lpf: 3200, pluck16: false },
  's04-blueprint': { pad: 0.7, pluck: 0.9, bass: 0.9, hat: 0.7, kick: 1, clap: 0.7, lpf: 3600, pluck16: false },
  's05-critic':    { pad: 0.6, pluck: 0.7, bass: 1.0, hat: 0.7, kick: 1, clap: 0.8, lpf: 3000, pluck16: false },
  's06-plan':      { pad: 0.7, pluck: 0.9, bass: 0.9, hat: 0.7, kick: 1, clap: 0.7, lpf: 3600, pluck16: false },
  's07-belt':      { pad: 0.6, pluck: 1.0, bass: 1.0, hat: 0.9, kick: 2, clap: 0.8, lpf: 4200, pluck16: false },
  's08-tests':     { pad: 0.9, pluck: 0.5, bass: 0.8, hat: 0.4, kick: 1, clap: 0, lpf: 1200, pluck16: false },
  's09-release':   { pad: 0.8, pluck: 1.0, bass: 1.0, hat: 1.0, kick: 2, clap: 1.0, lpf: 5200, pluck16: true },
  's10-memory':    { pad: 1.0, pluck: 0.8, bass: 0.5, hat: 0.3, kick: 0, clap: 0, lpf: 2400, pluck16: false },
};

function main() {
  const seedArg = process.argv.indexOf('--seed');
  const rnd = mulberry32(seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 7);
  const plan = computePlan();
  const length = plan.total + 1.0;
  const frames = Math.ceil(length * RATE);
  const L = new Float32Array(frames), R = new Float32Array(frames);

  // section per bar: the style of the scene that is playing at the bar's start (quantised forward)
  const bars = Math.ceil(length / BAR);
  const barStyle = [];
  for (let b = 0; b < bars; b++) {
    const t = b * BAR;
    let s = plan.scenes[0];
    plan.scenes.forEach(function (sc) { if (sc.start <= t + 1e-6) s = sc; });
    barStyle.push(STYLES[s.id] || STYLES['s03-talk']);
  }

  const add = function (buf, i, v) { if (i >= 0 && i < frames) buf[i] += v; };

  for (let b = 0; b < bars; b++) {
    const st = barStyle[b];
    const chord = CHORDS[b % 4];
    const t0 = b * BAR;
    const i0 = Math.round(t0 * RATE);
    // pad: 3 detuned saws per tone, slow attack, one-pole LPF, stereo spread
    if (st.pad) {
      const n = Math.round(BAR * RATE);
      let lpL = 0, lpR = 0;
      const a = 1 - Math.exp(-2 * Math.PI * st.lpf / RATE);
      for (let k = 0; k < n; k++) {
        const t = k / RATE;
        let sl = 0, sr = 0;
        chord.tones.forEach(function (m, ti) {
          const f = midiHz(m + 12);
          [-0.08, 0, 0.07].forEach(function (d, di) {
            const ph = (t * f * (1 + d / 100) + ti * 0.13 + di * 0.29) % 1;
            const saw = 2 * ph - 1;
            if (di === 0) sl += saw; else if (di === 2) sr += saw; else { sl += saw * 0.5; sr += saw * 0.5; }
          });
        });
        const env = Math.min(1, t / 0.35) * Math.min(1, (BAR - t) / 0.12 + 0.2);
        lpL += a * (sl - lpL); lpR += a * (sr - lpR);
        add(L, i0 + k, lpL * env * 0.028 * st.pad);
        add(R, i0 + k, lpR * env * 0.028 * st.pad);
      }
    }
    for (let e = 0; e < 8; e++) {                 // eighth notes
      const te = t0 + e * BEAT / 2;
      const ie = Math.round(te * RATE);
      const beat = e / 2;
      // kick
      const kickHere = st.kick === 2 ? e % 2 === 0 : (st.kick === 1 && (e === 0 || e === 4));
      if (kickHere) {
        const n = Math.round(0.28 * RATE); let ph = 0;
        for (let k = 0; k < n; k++) {
          const t = k / RATE; const f = 45 + 85 * Math.exp(-t * 28);
          ph += f / RATE;
          const v = Math.sin(2 * Math.PI * ph) * Math.exp(-t * 11) * 0.55;
          add(L, ie + k, v); add(R, ie + k, v);
        }
      }
      // clap on 2 and 4 (filtered noise, 3 quick bursts)
      if (st.clap && (e === 2 || e === 6)) {
        const n = Math.round(0.18 * RATE); let hp = 0, prev = 0;
        for (let k = 0; k < n; k++) {
          const t = k / RATE;
          const burst = t < 0.03 ? (Math.floor(t / 0.01) % 2 === 0 ? 1 : 0.35) : Math.exp(-(t - 0.03) * 30);
          const x = rnd() * 2 - 1; hp = 0.92 * (hp + x - prev); prev = x;
          const v = hp * burst * 0.16 * st.clap;
          add(L, ie + k, v * 0.9); add(R, ie + k, v);
        }
      }
      // hats on the off-beats (plus light ghost on the beat)
      if (st.hat) {
        const off = e % 2 === 1;
        const n = Math.round((off ? 0.06 : 0.03) * RATE); let hp = 0, prev = 0;
        for (let k = 0; k < n; k++) {
          const t = k / RATE; const x = rnd() * 2 - 1; hp = 0.6 * (hp + x - prev); prev = x;
          const v = hp * Math.exp(-t * (off ? 60 : 120)) * (off ? 0.07 : 0.03) * st.hat;
          add(L, ie + k, v * (off ? 1 : 0.6)); add(R, ie + k, v * (off ? 0.6 : 1));
        }
      }
      // bass: root on 1, root/fifth pulses
      if (st.bass) {
        const pattern = [0, null, 0, 7, 0, null, 12, 7];
        const iv = pattern[e];
        if (iv !== null) {
          const f = midiHz(chord.root + iv - (iv === 12 ? 12 : 0));
          const n = Math.round((BEAT / 2) * 0.95 * RATE); let ph = 0;
          for (let k = 0; k < n; k++) {
            const t = k / RATE; ph += f / RATE;
            const x = Math.sin(2 * Math.PI * ph) + 0.25 * Math.sin(4 * Math.PI * ph);
            const env = Math.min(1, t / 0.005) * Math.exp(-t * 5);
            const v = Math.tanh(x * 1.4) * env * 0.16 * st.bass;
            add(L, ie + k, v); add(R, ie + k, v);
          }
        }
      }
      // pluck arpeggio (seeded pattern), 16ths in the release section
      if (st.pluck) {
        const steps = st.pluck16 ? 2 : 1;
        for (let s = 0; s < steps; s++) {
          if (!st.pluck16 && rnd() < 0.18) continue;          // breathing gaps
          const tone = chord.tones[Math.floor(rnd() * 3)] + 12 + (rnd() < 0.3 ? 12 : 0);
          const f = midiHz(tone);
          const is = ie + Math.round(s * BEAT / 4 * RATE);
          const n = Math.round(0.45 * RATE);
          const pan = 0.5 + (rnd() - 0.5) * 0.7;
          for (let k = 0; k < n; k++) {
            const t = k / RATE;
            const x = Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(2 * Math.PI * f * 4 * t) * Math.exp(-t * 40);
            const v = x * Math.exp(-t * 9) * Math.min(1, t / 0.002) * 0.07 * st.pluck * (beat % 1 === 0 ? 1 : 0.8);
            add(L, is + k, v * (1 - pan) * 1.4); add(R, is + k, v * pan * 1.4);
          }
        }
      }
    }
  }
  // gentle bus: normalise to -6 dBFS peak with a soft clip
  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = 0.5 / (peak || 1);
  const inter = new Float32Array(frames * 2);
  for (let i = 0; i < frames; i++) { inter[2 * i] = Math.tanh(L[i] * g * 1.2); inter[2 * i + 1] = Math.tanh(R[i] * g * 1.2); }
  fs.mkdirSync(path.dirname(C.P.musicSynth), { recursive: true });
  fs.writeFileSync(C.P.musicSynth, C.wavBytes(inter, RATE, 2));
  process.stdout.write(JSON.stringify({ ok: true, file: path.relative(C.ROOT, C.P.musicSynth).replace(/\\/g, '/'),
    duration: C.r3(frames / RATE), bpm: BPM, bars: bars }) + '\n');
}

main();
