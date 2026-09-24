#!/usr/bin/env node
'use strict';
/*
 * build-video.cjs — assemble the whole HyperFrames film from narration + templates.
 *
 * Inputs   narration/narration.json, narration/words/<id>.json, narration/voice.json (process-voice),
 *          src/scenes/<id>.html (hand-authored scene templates), src/scenes/scenes.json (fields,
 *          transitions, HUD stations), src/sfx.json, src/layers/{captions,hud,wipes}.html,
 *          src/runtime/helpers.js, src/partials/chars-bridge.cjs, assets/sfx/manifest.json
 * Outputs  index.html (root: scene hosts, layers, voice/music/SFX audio), compositions/<id>.html,
 *          compositions/{captions,hud,wipes}.html, timing.json, STORYBOARD.md,
 *          ../media/{mobile-pipeline.srt, mobile-pipeline.vtt, chapters.js, transcript.js}
 *          Output is byte-stable (no timestamps); files are only rewritten when their bytes change.
 *
 * Flags    --plan-only         write timing.json + print the plan, nothing else
 *          --print-snapshots   print the QA snapshot times (for `hyperframes snapshot --at`) and exit
 *          --only <sceneId>    write only compositions/<sceneId>.html (parallel scene work)
 *
 * Scene template placeholders (full contract: src/scenes/README.md)
 *   %%ID%%        scene id (= data-composition-id = window.__timelines key), e.g. s03-talk
 *   %%DUR%%       scene duration in seconds (number)
 *   %%CUES%%      JSON {cue: seconds within the scene} + _voice _speechEnd _out _end. Use as C.<cue>.
 *                 Every C.<name> / C["name"] in the template must exist, or the build fails.
 *   %%WORDS%%     JSON [{text,start,end}] scene-local display words (for word-exact kinetic type)
 *   %%FIELD%% %%INK%%  scene background / text colour (hex)
 *   %%FONTS%%     @font-face rules (Unbounded, Golos Text, JetBrains Mono; cyrillic + latin)
 *   %%HELPERS%%   src/runtime/helpers.js (defines window.MPV)
 *   %%KITCSS%% %%CHAR:..%% %%MACHINE:..%% %%PLANT:..%% %%PHONE:..%% %%STAMP:..%% %%BELT:..%%
 *                 illustration kit, see src/partials/chars-bridge.cjs
 */
const fs = require('fs');
const path = require('path');
const C = require('./lib/common.cjs');
const N = require('./lib/narration.cjs');
const { computePlan } = require('./lib/plan.cjs');
const KIT = require('../src/partials/chars-bridge.cjs');

const argv = process.argv.slice(2);
const has = (f) => argv.indexOf(f) >= 0;
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const PLAN_ONLY = has('--plan-only');
const PRINT_SNAPS = has('--print-snapshots');
const ONLY = val('--only');

const W = 1920, H = 1080;
const BLOCK_IN = 0.25, BLOCK_OUT = 0.28, MORPH_IN = 0.52, MORPH_OUT = 0.32;
// The voice WAVs are MONO, mastered to -16 LUFS as mono. The renderer upmixes mono with
// `pan=stereo|FL=FL+FC|FR=FR+FC` (full level in both channels = dual mono), which reads +3.01 dB
// louder on a BS.1770 meter (measured: -13.2 LUFS mix, 0 dBTP). -3.01 dB on every voice clip puts the
// voice back at -16 LUFS in the stereo mix (scripts/preview-mix.cjs verifies).
const VOICE_VOLUME = 0.707;

const r3 = C.r3;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const json = (x) => JSON.stringify(x);

// ------------------------------------------------------------------ fonts
const CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116';
const LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const FAMILIES = [['Unbounded', 'unbounded', '200 900'], ['Golos Text', 'golos-text', '400 900'], ['JetBrains Mono', 'jetbrains-mono', '100 800']];
function fontsCss() {
  const out = [];
  FAMILIES.forEach(function (f) {
    [['cyrillic', CYR], ['latin', LAT]].forEach(function (s) {
      const file = 'assets/fonts/' + f[1] + '-' + s[0] + '-wght-normal.woff2';
      if (!fs.existsSync(path.join(C.ROOT, file))) C.die(file + ' missing — run node scripts/vendor-assets.cjs');
      out.push("@font-face{font-family:'" + f[0] + "';font-style:normal;font-weight:" + f[2] + ";font-display:block;" +
        "src:url('" + file + "') format('woff2');unicode-range:" + s[1] + ';}');
    });
  });
  return out.join('\n');
}

// ------------------------------------------------------------------ plan + metadata
function loadAll() {
  const plan = computePlan();
  const meta = C.readJSON(C.P.scenesMeta);
  const pal = meta.palette;
  plan.scenes.forEach(function (s, i) {
    const m = meta.scenes[s.id];
    if (!m) C.die('src/scenes/scenes.json has no entry for ' + s.id);
    s.meta = m;
    s.field = pal[m.field];
    s.ink = pal[m.ink];
    if (!s.field || !s.ink) C.die(s.id + ': unknown field/ink colour name');
    const next = plan.scenes[i + 1];
    // synthetic cues
    let outStart = s.duration;
    if (next) {
      const o = m.out || { type: 'blocks' };
      if (o.type === 'morph') outStart = s.duration - MORPH_IN;
      else if (o.type === 'blocks5') outStart = s.duration - BLOCK_IN - 4 * 0.04;
      else outStart = s.duration - BLOCK_IN - 0.06;
    }
    s.cues._voice = r3(s.lead);
    s.cues._speechEnd = s.speech.end;
    s.cues._out = r3(outStart);
    s.cues._end = s.duration;
  });
  return { plan: plan, meta: meta, pal: pal };
}

function globalCue(scene, name) {
  const t = scene.cues[name];
  if (t == null) C.die(scene.id + ': unknown cue "' + name + '" (have: ' + Object.keys(scene.cues).join(', ') + ')');
  return r3(scene.start + t);
}
/** "cue", "cue+0.5", "_end-0.5" -> scene-local seconds */
function cueExpr(scene, expr) {
  const m = String(expr).match(/^([A-Za-z0-9_]+)([+-]\d+(?:\.\d+)?)?$/);
  if (!m) C.die(scene.id + ': bad cue expression ' + expr);
  const t = scene.cues[m[1]];
  if (t == null) C.die(scene.id + ': unknown cue "' + m[1] + '" in scenes.json snap/yes');
  return r3(t + (m[2] ? Number(m[2]) : 0));
}

// ------------------------------------------------------------------ transitions
function buildTransitions(plan, pal) {
  const blocks = [], morphs = [], list = [];
  const problems = [];
  plan.scenes.forEach(function (s, i) {
    const next = plan.scenes[i + 1];
    if (!next) return;
    const T = s.end;
    const o = s.meta.out || { type: 'blocks', lead: 'cream', dir: 1 };
    const tag = 't' + (i + 1);
    let start, end;
    if (o.type === 'morph') {
      const org = o.origin || [W / 2, H / 2];
      const r = Math.ceil(Math.max.apply(null, [[0, 0], [W, 0], [0, H], [W, H]].map(function (c) {
        return Math.hypot(c[0] - org[0], c[1] - org[1]);
      })) + 24);
      morphs.push({ id: 'wp-' + tag, T: T, r: r, cx: org[0], cy: org[1], color: pal[o.color] || next.field });
      start = T - MORPH_IN; end = T + MORPH_OUT;
    } else {
      const dense = o.type === 'blocks5';
      const colors = dense ? o.colors.map(function (c) { return pal[c]; }) : [pal[o.lead || 'cream'], next.field];
      if (dense && colors[colors.length - 1] !== next.field) problems.push(tag + ': last dense block must be the next field colour');
      const stagger = dense ? 0.04 : 0.06;
      const ids = colors.map(function (c, k) { return 'wp-' + tag + '-' + String.fromCharCode(97 + k); });
      blocks.push({ tag: tag, ids: ids, colors: colors, T: T, dir: o.dir === -1 ? -1 : 1, stagger: stagger });
      start = T - BLOCK_IN - (colors.length - 1) * stagger;
      end = T + 0.02 + (colors.length - 1) * stagger + BLOCK_OUT;
    }
    // transitions must sit in silence
    const prevSpeechEnd = s.start + s.speech.end;
    const nextSpeechStart = next.start + next.speech.start;
    if (start < prevSpeechEnd + 0.05) problems.push(tag + ' (' + s.id + ' -> ' + next.id + ') starts at ' + r3(start) + ' s but speech ends at ' + r3(prevSpeechEnd) + ' s');
    if (end > nextSpeechStart - 0.02) problems.push(tag + ' (' + s.id + ' -> ' + next.id + ') ends at ' + r3(end) + ' s but speech starts at ' + r3(nextSpeechStart) + ' s');
    list.push({ id: tag, T: r3(T), from: s.id, to: next.id, type: o.type, window: [r3(start), r3(end)] });
  });
  if (problems.length) C.die('transition timing:\n  ' + problems.join('\n  '));
  const last = plan.scenes[plan.scenes.length - 1];
  let dip = null;
  if (last.meta.endcard) {
    const T = globalCue(last, last.meta.endcard.cue);
    const prevWord = last.words.filter(function (w) { return last.start + w.end <= T - 0.001; }).pop();
    if (prevWord && last.start + prevWord.end > T - 0.3) {
      process.stderr.write('note: end-card dip starts ' + r3(last.start + prevWord.end - (T - 0.3)) + ' s before the previous word ends\n');
    }
    dip = { T: T };
    list.push({ id: 'dip', T: T, from: last.id, to: last.id + ':endcard', type: 'dip', window: [r3(T - 0.3), r3(T + 0.37)] });
  }
  const final = { start: r3(plan.total - 0.8) };
  list.push({ id: 'final', T: plan.total, type: 'fade-to-ink', window: [final.start, plan.total] });
  return { blocks: blocks, morphs: morphs, dip: dip, final: final, list: list };
}

// ------------------------------------------------------------------ captions
function buildCaptions(plan) {
  const groups = [];
  plan.scenes.forEach(function (s) {
    const gs = N.groupScene(s.words);
    gs.forEach(function (g, i) {
      const prev = gs[i - 1], next = gs[i + 1];
      if (!prev) g.in = Math.max(0.1, g.first - 0.12);
      if (next) {
        const gap = next.first - g.last;
        if (gap >= 0.5) { g.out = g.last + Math.min(0.45, gap - 0.2); next.in = next.first - 0.12; }
        else { const mid = g.last + gap / 2; g.out = mid; next.in = mid; }
      } else {
        g.out = Math.min(g.last + 0.6, s.cues._out - 0.08);
      }
    });
    gs.forEach(function (g, i) {
      const next = gs[i + 1];
      if (g.out - g.in < N.G.minDur) {
        const limit = next ? next.first - 0.05 : s.cues._out - 0.08;
        g.out = Math.min(g.in + N.G.minDur, limit);
        if (next && next.in < g.out) next.in = g.out;
      }
      groups.push({
        scene: s.id,
        in: r3(s.start + g.in),
        out: r3(s.start + g.out),
        text: g.text,
        // on the ink «night» field and the ink end card the ink pill needs a cream rim to read as a pill
        night: s.meta.field === 'ink' || !!(s.meta.endcard && s.meta.endcard.field === 'ink' && g.in >= s.cues[s.meta.endcard.cue] - 0.35),
        words: g.words.map(function (w) { return { text: w.text, start: r3(s.start + w.start), end: r3(s.start + w.end), glue: w.glue }; }),
      });
    });
  });
  // sanity: one group at a time, inside the frame's time
  for (let i = 1; i < groups.length; i++) {
    if (groups[i].in < groups[i - 1].out - 0.001) C.die('caption groups overlap: ' + groups[i - 1].text + ' / ' + groups[i].text);
  }
  const lengths = groups.map(function (g) { return g.text.length; });
  return { groups: groups, maxChars: Math.max.apply(null, lengths), maxWords: Math.max.apply(null, groups.map(function (g) { return g.words.length; })) };
}

function captionsMarkup(groups) {
  let wi = 0;
  const lines = [];
  groups.forEach(function (g, gi) {
    let html = '';
    let keep = [];
    g.words.forEach(function (w, k) {
      const span = '<span class="caption-word" id="cw-' + (wi++) + '">' + esc(w.text) + '</span>';
      keep.push(span);
      if (w.glue === 'next' && k < g.words.length - 1) return;
      html += (html ? ' ' : '') + (keep.length > 1 ? '<span class="cw-keep">' + keep.join(' ') + '</span>' : keep[0]);
      keep = [];
    });
    if (keep.length) html += (html ? ' ' : '') + keep.join(' ');
    lines.push('        <div class="caption-group" id="cg-' + gi + '" data-layout-allow-caption-zone><div class="caption-line' + (g.night ? ' caption-night' : '') + '">' + html + '</div></div>');
  });
  return lines.join('\n');
}

// ------------------------------------------------------------------ HUD
function buildHud(plan, meta, transitions) {
  const scenes = plan.scenes;
  const first = scenes[1];
  const last = scenes[scenes.length - 1];
  const start = first.start;
  const end = transitions.dip ? transitions.dip.T : plan.total;
  const stationIds = meta.stations.map(function (s) { return s.id; });
  const idx = function (st) { return st === 'done' ? stationIds.length : (st ? stationIds.indexOf(st) : -1); };
  const chips = [], states = [], yes = [];
  let markup = '';
  scenes.slice(1).forEach(function (s) {
    const t = r3(s.start - start);
    const id = 'hud-chip-' + s.id;
    chips.push({ id: id, t: t });
    markup += '        <div class="hud-chip" id="' + id + '"><span class="hud-num">' + String(s.n).padStart(2, '0') + ' / ' +
      String(scenes.length).padStart(2, '0') + '</span><span class="hud-dot"></span><span class="hud-name">' + esc(s.title) + '</span></div>\n';
    const k = idx(s.meta.station);
    states.push({ t: t, st: stationIds.map(function (_, i) { return k === stationIds.length ? 2 : (i < k ? 2 : (i === k ? 1 : 0)); }) });
    if (s.meta.yes) yes.push({ t: r3(s.start + cueExpr(s, s.meta.yes) - start), i: k });
  });
  const ic = function (i) {
    return '<svg class="hud-ic" id="hud-ic-' + i + '" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle class="ic-ring" cx="12" cy="12" r="7.5" fill="none" stroke="#16123A" stroke-width="3"/>' +
      '<circle class="ic-dot" cx="12" cy="12" r="6.5" fill="#FFF6E6" opacity="0"/>' +
      '<g class="ic-check" opacity="0"><circle cx="12" cy="12" r="11" fill="#2BD99F" stroke="#16123A" stroke-width="2.5"/>' +
      '<path d="M7 12.5 L10.5 16 L17 8.5" fill="none" stroke="#16123A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g></svg>';
  };
  markup += '        <div class="hud-rail" id="hud-rail">\n';
  meta.stations.forEach(function (st, i) {
    markup += '          <div class="hud-st" id="hud-st-' + i + '">' + ic(i) + '<span class="hud-st-name">' + esc(st.label) +
      '</span><span class="hud-yes-ring" id="hud-yesr-' + i + '"></span><span class="hud-yes" id="hud-yes-' + i + '"></span></div>\n';
  });
  markup += '        </div>';
  return { start: r3(start), duration: r3(end - start), markup: markup, data: { enter: 0.35, chips: chips, states: states, yes: yes } };
}

// ------------------------------------------------------------------ wipes markup
function wipesMarkup(tr) {
  const items = [];
  tr.blocks.forEach(function (b) {
    b.ids.forEach(function (id, k) {
      items.push({ T: b.T, k: k, html: '        <div class="wb" id="' + id + '" data-layout-allow-overflow style="left:' + (b.dir === 1 ? -2880 : 2400) + 'px"><div class="wb-i" style="background:' + b.colors[k] + '"></div></div>' });
    });
  });
  tr.morphs.forEach(function (m) {
    items.push({ T: m.T, k: 0, html: '        <svg class="wm" id="' + m.id + '" viewBox="0 0 1920 1080" aria-hidden="true">' +
      '<circle id="' + m.id + '-rim" cx="' + m.cx + '" cy="' + m.cy + '" r="0" fill="none" stroke="#16123A" stroke-width="14"/>' +
      '<circle id="' + m.id + '-fill" cx="' + m.cx + '" cy="' + m.cy + '" r="0" fill="' + m.color + '"/></svg>' });
  });
  items.sort(function (a, b) { return a.T - b.T || a.k - b.k; });
  const out = items.map(function (x) { return x.html; });
  if (tr.dip) out.push('        <div class="wdip" id="wp-dip"></div>');
  out.push('        <div class="wfinal" id="wp-final"></div>');
  return out.join('\n');
}

// ------------------------------------------------------------------ SFX
function buildSfx(plan, transitions) {
  const lib = C.readJSON(path.join(C.P.sfxOut, 'manifest.json'));
  const spec = C.readJSON(C.P.sfxPlan);
  const byId = {};
  plan.scenes.forEach(function (s) { byId[s.id] = s; });
  const items = [];
  const add = function (name, t, volume, why) {
    const f = lib[name];
    if (!f) C.die('SFX "' + name + '" not in assets/sfx/manifest.json — add it to scripts/vendor-assets.cjs');
    const start = Math.max(0, r3(t - f.peakAt));
    items.push({ name: name, at: r3(t), start: start, duration: f.duration, volume: volume, file: f.file, why: why });
  };
  transitions.list.forEach(function (tr) {
    if (tr.id === 'final' || tr.id === 'dip') return;
    add(spec.whoosh.name, tr.T, spec.whoosh.volume, 'cut ' + tr.id);
  });
  spec.cues.forEach(function (c) {
    const s = byId[c.scene];
    if (!s) C.die('src/sfx.json: unknown scene ' + c.scene);
    add(c.name, s.start + cueExpr(s, c.at), c.volume, c.scene + ' ' + c.at);
  });
  items.sort(function (a, b) { return a.start - b.start || (a.name < b.name ? -1 : 1); });
  const tracks = [];
  items.forEach(function (it, i) {
    it.id = 'sfx-' + String(i + 1).padStart(2, '0') + '-' + it.name;
    let tr = 0;
    while (tracks[tr] != null && tracks[tr] > it.start - 0.001) tr++;
    tracks[tr] = it.start + it.duration;
    it.track = 12 + tr;
  });
  return items;
}

// ------------------------------------------------------------------ scene templates
const CUE_USE_RE = [/\bC\.([A-Za-z_$][\w$]*)/g, /\bC\[\s*["']([^"']+)["']\s*\]/g];

function renderScene(s, fonts, helpers) {
  const src = path.join(C.P.scenesDir, s.id + '.html');
  if (!fs.existsSync(src)) C.die('missing scene template ' + path.relative(C.ROOT, src));
  let html = fs.readFileSync(src, 'utf8');
  const where = 'src/scenes/' + s.id + '.html';
  if (!/<template[\s>]/.test(html)) C.die(where + ': the composition must be wrapped in <template>');
  // cue usage
  const used = {};
  CUE_USE_RE.forEach(function (re) { let m; re.lastIndex = 0; while ((m = re.exec(html))) used[m[1]] = true; });
  const missing = Object.keys(used).filter(function (k) { return !Object.prototype.hasOwnProperty.call(s.cues, k); });
  if (missing.length) {
    C.die(where + ' uses undefined cue(s): ' + missing.map(function (k) { return 'C.' + k; }).join(', ') +
      '\n  cues of ' + s.id + ': ' + Object.keys(s.cues).join(', '));
  }
  const words = s.words.map(function (w) { return { text: w.text, start: w.start, end: w.end }; });
  const rep = {
    ID: s.id, DUR: String(s.duration), CUES: json(s.cues), WORDS: json(words),
    FIELD: s.field, INK: s.ink, FONTS: fonts, HELPERS: helpers,
  };
  html = html.replace(/%%(ID|DUR|CUES|WORDS|FIELD|INK|FONTS|HELPERS)%%/g, function (m, k) { return rep[k]; });
  try { html = KIT.expand(html, where); } catch (e) { C.die(e.message); }
  const left = html.match(/%%[A-Z][A-Z0-9_]*(?::[^%\s]*)?%%/g);
  if (left) C.die(where + ': unknown placeholder(s) ' + Array.from(new Set(left)).join(', '));
  if (html.indexOf('data-composition-id="' + s.id + '"') < 0) C.die(where + ': root must carry data-composition-id="' + s.id + '" (use %%ID%%)');
  if (!/window\.__timelines\[\s*["']/.test(html) || html.indexOf('window.__timelines["' + s.id + '"]') < 0 && html.indexOf("window.__timelines['" + s.id + "']") < 0) {
    C.die(where + ': must register window.__timelines["' + s.id + '"] (use %%ID%%)');
  }
  html = html.replace(/^(\s*<!doctype html>\s*\n?)?/i, function (m) {
    return '<!doctype html>\n<!-- GENERATED by scripts/build-video.cjs from ' + where + ' - edit the source, not this file. -->\n';
  });
  return html;
}

function renderLayer(name, rep) {
  const src = path.join(C.P.layersDir, name + '.html');
  let html = fs.readFileSync(src, 'utf8');
  html = html.replace(/%%([A-Z]+)%%/g, function (m, k) {
    if (!Object.prototype.hasOwnProperty.call(rep, k)) C.die('src/layers/' + name + '.html: unknown placeholder ' + m);
    return rep[k];
  });
  html = html.replace(/<!--\s*Source template[\s\S]*?-->\n/, '<!-- GENERATED by scripts/build-video.cjs from src/layers/' + name + '.html - edit the source, not this file. -->\n');
  return html;
}

// ------------------------------------------------------------------ root index.html
function renderIndex(plan, hud, sfx, fonts) {
  const L = [];
  L.push('<!doctype html>');
  L.push('<!-- GENERATED by scripts/build-video.cjs - edit narration/, src/ and scripts/, not this file. -->');
  L.push('<html lang="ru">');
  L.push('  <head>');
  L.push('    <meta charset="UTF-8" />');
  L.push('    <meta name="viewport" content="width=1920, height=1080" />');
  L.push('    <title>Mobile Pipeline — Фабрика приложений</title>');
  ['gsap.min.js', 'CustomEase.min.js', 'MotionPathPlugin.min.js', 'DrawSVGPlugin.min.js', 'MorphSVGPlugin.min.js'].forEach(function (f) {
    L.push('    <script src="assets/vendor/gsap/' + f + '"></script>');
  });
  L.push('    <script>');
  L.push('      gsap.registerPlugin(CustomEase, MotionPathPlugin, DrawSVGPlugin, MorphSVGPlugin);');
  L.push('    </script>');
  L.push('    <style>');
  L.push(fonts.split('\n').map(function (l) { return '      ' + l; }).join('\n'));
  L.push('      * { margin: 0; padding: 0; box-sizing: border-box; }');
  L.push('      html, body { width: 1920px; height: 1080px; overflow: hidden; background: #16123a; }');
  L.push('      #main { position: relative; width: 100%; height: 100%; overflow: hidden; background: #16123a; }');
  L.push('      #main > div[data-composition-src] { position: absolute; inset: 0; }');
  L.push('      #wipes { z-index: 5; }');
  L.push('      #hud { z-index: 6; }');
  L.push('      #captions { z-index: 7; }');
  L.push('    </style>');
  L.push('  </head>');
  L.push('  <body>');
  L.push('    <div id="main" data-composition-id="main" data-width="1920" data-height="1080" data-duration="' + plan.total + '">');
  const host = function (id, start, dur, track, kind) {
    return '      <div id="' + id + '" data-composition-id="' + id + '" data-composition-src="compositions/' + id + '.html"' +
      ' data-start="' + start + '" data-duration="' + dur + '" data-track-index="' + track + '" data-track-kind="' + kind + '"' +
      ' data-width="1920" data-height="1080"></div>';
  };
  L.push('      <!-- scenes: hard cuts on track 1; the wipes overlay hides every cut -->');
  plan.scenes.forEach(function (s) { L.push(host(s.id, s.start, s.duration, 1, 'graphics')); });
  L.push('      <!-- full-length layers: transitions, HUD (S02 -> end card), karaoke captions -->');
  L.push(host('wipes', 0, plan.total, 2, 'graphics'));
  L.push(host('hud', hud.start, hud.duration, 3, 'graphics'));
  L.push(host('captions', 0, plan.total, 4, 'captions'));
  L.push('      <!-- narration: one take per scene, starts at scene start + lead -->');
  plan.scenes.forEach(function (s) {
    L.push('      <audio id="vo-' + s.id + '" data-audio-group="voiceover" src="' + s.voice.file + '" data-start="' + s.voice.start +
      '" data-duration="' + r3(s.voice.duration) + '" data-track-index="10" data-volume="' + VOICE_VOLUME + '"></audio>');
  });
  L.push('      <!-- music bed (-20 LUFS); scripts/carve.cjs carves it under the voiceover group -->');
  L.push('      <audio id="music-bed" data-audio-group="music" data-timeline-role="music" src="assets/music/bed.wav" data-start="0" data-duration="' +
    plan.total + '" data-track-index="11" data-volume="1"></audio>');
  L.push('      <!-- sound effects: loudest instant lands on the cue / cut -->');
  sfx.forEach(function (x) {
    L.push('      <audio id="' + x.id + '" data-audio-group="sfx" src="' + x.file + '" data-start="' + x.start + '" data-duration="' + x.duration +
      '" data-track-index="' + x.track + '" data-volume="' + x.volume + '"></audio>');
  });
  L.push('    </div>');
  L.push('    <script>');
  L.push('      window.__timelines["main"] = gsap.timeline({ paused: true });');
  L.push('    </script>');
  L.push('  </body>');
  L.push('</html>');
  return L.join('\n') + '\n';
}

// ------------------------------------------------------------------ side outputs
function srt(groups) {
  return groups.map(function (g, i) {
    return (i + 1) + '\n' + C.clock(g.in, ',') + ' --> ' + C.clock(g.out, ',') + '\n' + g.text.replace(/ /g, ' ') + '\n';
  }).join('\n');
}
function vtt(groups) {
  return 'WEBVTT\n\n' + groups.map(function (g, i) {
    return (i + 1) + '\n' + C.clock(g.in, '.') + ' --> ' + C.clock(g.out, '.') + '\n' + g.text.replace(/ /g, ' ') + '\n';
  }).join('\n');
}

function storyboard(plan, meta, transitions, narration) {
  const L = [];
  L.push('---');
  L.push('format: 1920x1080');
  L.push('duration: ' + plan.total + 's');
  L.push('message: "Фабрика приложений: вы говорите идею — команда ИИ-мастеров строит приложение, а последнее слово за вами"');
  L.push('arc: Hook → Factory → Talk → Blueprint → Critic → Plan → Belt → Tests → Release → Memory');
  L.push('audience: non-IT viewers (Russian)');
  L.push('mode: autonomous');
  L.push('---');
  L.push('');
  L.push('<!-- GENERATED by scripts/build-video.cjs from narration/narration.json + src/scenes/scenes.json. -->');
  L.push('');
  L.push('Design truth: `design.md` · narration: `narration/narration.json` · timing: `timing.json`.');
  L.push('Scenes hard-cut underneath `compositions/wipes.html`; HUD and karaoke captions are full-length layers.');
  L.push('');
  plan.scenes.forEach(function (s, i) {
    const m = s.meta;
    const tr = transitions.list[i - 1];
    L.push('## Frame ' + s.n + ' — ' + s.title);
    L.push('');
    L.push('- status: ' + (fs.existsSync(path.join(C.P.scenesDir, s.id + '.html')) && /PLACEHOLDER/.test(fs.readFileSync(path.join(C.P.scenesDir, s.id + '.html'), 'utf8')) ? 'outline' : 'built'));
    L.push('- src: compositions/' + s.id + '.html');
    L.push('- duration: ' + s.duration + 's');
    L.push('- start: ' + s.start + 's');
    L.push('- transition_in: ' + (tr ? tr.type : 'cut'));
    L.push('- scene: ' + m.field + ' field' + (m.station ? ', HUD station ' + m.station : ''));
    L.push('- poster: ' + r3(s.duration / 2) + 's');
    L.push('- blueprint: ' + (m.blueprint || '—'));
    L.push('- rules: ' + (m.rules || []).join(', '));
    L.push('- cues: ' + Object.keys(s.cues).filter(function (k) { return k[0] !== '_'; }).map(function (k) { return k + ' ' + s.cues[k].toFixed(2); }).join(' · '));
    L.push('- voiceover: "' + N.shownText(narration.scenes[i].text) + '"');
    L.push('');
  });
  return L.join('\n');
}

// ------------------------------------------------------------------ main
function main() {
  const all = loadAll();
  const plan = all.plan, meta = all.meta, pal = all.pal;
  const narration = C.readJSON(C.P.narration);
  const transitions = buildTransitions(plan, pal);
  const caps = buildCaptions(plan);
  const hud = buildHud(plan, meta, transitions);
  const sfx = buildSfx(plan, transitions);

  const timing = {
    total: plan.total, fps: 30, width: W, height: H,
    scenes: plan.scenes.map(function (s) {
      const cg = {};
      Object.keys(s.cues).forEach(function (k) { cg[k] = r3(s.start + s.cues[k]); });
      return {
        n: s.n, id: s.id, title: s.title, field: s.field, ink: s.ink, start: s.start, duration: s.duration, end: s.end,
        lead: s.lead, tail: s.tail, voice: { file: s.voice.file, start: s.voice.start, duration: r3(s.voice.duration) },
        speech: s.speech, words: s.wordCount, wordsPerSecond: r3(s.wordCount / (s.speech.end - s.speech.start)),
        cues: s.cues, cuesGlobal: cg,
      };
    }),
    transitions: transitions.list,
    hud: { start: hud.start, duration: hud.duration },
    captions: { groups: caps.groups.length, maxChars: caps.maxChars, maxWords: caps.maxWords },
    sfx: sfx.map(function (x) { return { id: x.id, at: x.at, start: x.start, volume: x.volume, why: x.why }; }),
    kit: KIT.status,
  };

  if (PRINT_SNAPS) {
    const times = [];
    plan.scenes.forEach(function (s) {
      times.push(s.start + 0.6, s.start + s.duration / 2, s.end - 0.3);
      (s.meta.snap || []).forEach(function (e) { times.push(s.start + cueExpr(s, e)); });
    });
    const uniq = Array.from(new Set(times.map(function (t) { return Math.min(plan.total - 0.05, t).toFixed(2); })))
      .sort(function (a, b) { return a - b; });
    process.stdout.write(uniq.join(',') + '\n');
    return;
  }

  C.writeIfChanged(C.P.timing, JSON.stringify(timing, null, 1) + '\n');
  if (PLAN_ONLY) {
    plan.scenes.forEach(function (s) {
      process.stdout.write(s.id.padEnd(14) + ' start ' + s.start.toFixed(1).padStart(6) + '  dur ' + s.duration.toFixed(1).padStart(5) +
        '  words ' + String(s.wordCount).padStart(3) + '  wps ' + (s.wordCount / (s.speech.end - s.speech.start)).toFixed(2) +
        '  cues ' + Object.keys(s.cues).filter(function (k) { return k[0] !== '_'; }).join(' ') + '\n');
    });
    process.stdout.write(JSON.stringify({ ok: true, planOnly: true, total: plan.total, scenes: plan.scenes.length,
      captionGroups: caps.groups.length, sfx: sfx.length, kit: KIT.status }) + '\n');
    return;
  }

  const fonts = fontsCss();
  // inject the code only: the header comment documents the API (and would leak placeholder names)
  // it is inlined into every scene, so also drop whole-line // comments and blank lines (lint counts lines)
  const helpers = fs.readFileSync(C.P.helpers, 'utf8').replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '').split(/\r?\n/)
    .filter(function (l) { return l.trim() && !/^\s*\/\//.test(l); }).join('\n').trim();
  const written = [];
  const put = function (rel, content) { if (C.writeIfChanged(path.join(C.ROOT, rel), content)) written.push(rel); };

  if (ONLY) {
    const s = plan.scenes.filter(function (x) { return x.id === ONLY; })[0];
    if (!s) C.die('--only: no scene ' + ONLY + ' (have: ' + plan.scenes.map(function (x) { return x.id; }).join(', ') + ')');
    put('compositions/' + s.id + '.html', renderScene(s, fonts, helpers));
    process.stdout.write(JSON.stringify({ ok: true, only: s.id, duration: s.duration, start: s.start, cues: s.cues, written: written, kit: KIT.status }) + '\n');
    return;
  }

  plan.scenes.forEach(function (s) { put('compositions/' + s.id + '.html', renderScene(s, fonts, helpers)); });

  let wi = 0;
  const groupsData = caps.groups.map(function (g) {
    const first = wi; wi += g.words.length;
    return { in: g.in, out: g.out, w: [first, wi - 1] };
  });
  put('compositions/captions.html', renderLayer('captions', {
    FONTS: fonts, DUR: String(plan.total), MARKUP: captionsMarkup(caps.groups),
    // Studio's caption editor reads an inline `var TRANSCRIPT = [{text,start,end}]`; one line per group
    TRANSCRIPT: '[\n' + caps.groups.map(function (g) {
      return '            ' + g.words.map(function (w) { return json({ text: w.text, start: w.start, end: w.end }); }).join(', ');
    }).join(',\n') + '\n          ]',
    GROUPS: json(groupsData),
  }));
  put('compositions/hud.html', renderLayer('hud', { FONTS: fonts, DUR: String(hud.duration), MARKUP: hud.markup, DATA: json(hud.data) }));
  put('compositions/wipes.html', renderLayer('wipes', {
    DUR: String(plan.total), MARKUP: wipesMarkup(transitions),
    DATA: json({
      blocks: transitions.blocks.map(function (b) { return { ids: b.ids, T: b.T, dir: b.dir, stagger: b.stagger }; }),
      morphs: transitions.morphs.map(function (m) { return { id: m.id, T: m.T, r: m.r }; }),
      dip: transitions.dip, final: transitions.final,
    }),
  }));
  put('index.html', renderIndex(plan, hud, sfx, fonts));
  put('STORYBOARD.md', storyboard(plan, meta, transitions, narration));

  // deliverables for the site
  const rel = function (p) { return path.relative(C.ROOT, p).replace(/\\/g, '/'); };
  put(rel(path.join(C.P.media, 'mobile-pipeline.srt')), srt(caps.groups));
  put(rel(path.join(C.P.media, 'mobile-pipeline.vtt')), vtt(caps.groups));
  put(rel(path.join(C.P.media, 'chapters.js')), '/* Generated by video/scripts/build-video.cjs (verify-output.cjs refreshes duration after render). */\n' +
    'window.MP_VIDEO = ' + JSON.stringify({
      duration: plan.total,
      chapters: plan.scenes.map(function (s) { return { id: s.id, title: s.title, start: s.start }; }),
    }, null, 1) + ';\n');
  put(rel(path.join(C.P.media, 'transcript.js')), '/* Generated by video/scripts/build-video.cjs from the caption groups. */\n' +
    'window.MP_TRANSCRIPT = [\n' + caps.groups.map(function (g) { return ' ' + JSON.stringify({ start: g.in, end: g.out, text: g.text }); }).join(',\n') + '\n];\n');

  process.stdout.write(JSON.stringify({ ok: true, total: plan.total, scenes: plan.scenes.length, captionGroups: caps.groups.length,
    maxCaptionChars: caps.maxChars, sfx: sfx.length, transitions: transitions.list.length, kit: KIT.status,
    written: written.length }) + '\n');
}

main();
