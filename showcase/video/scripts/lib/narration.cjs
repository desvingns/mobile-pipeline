'use strict';
// Narration markup -> timed display words, cues and caption groups.
//
// Markup (narration/narration.json scenes[].text):
//   [[cue]]          time marker = start of the next spoken word
//   {shown|spoken}   captions show the left part, TTS says the right part (may span several words)
// Word timings come from edge-tts WordBoundary events (narration/words/<id>.json), relative to the
// start of that scene's voice take. Everything here returns take-relative seconds; the build adds
// the scene start + lead.

const CUE_RE = /\[\[([A-Za-z0-9_-]+)\]\]/g;
const ALT_RE = /\{([^{}|]*)\|([^{}]*)\}/g;
const NBSP = ' ';

function spokenText(text) {
  return text.replace(CUE_RE, '').replace(ALT_RE, function (m, a, b) { return b; }).replace(/\s+/g, ' ').trim();
}
function shownText(text) {
  return text.replace(CUE_RE, '').replace(ALT_RE, function (m, a) { return a; }).replace(/\s+/g, ' ').trim();
}

/** Case/ё/punctuation-insensitive comparison key (hyphens dropped too). */
function norm(s) {
  return String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]/gu, '');
}

/** Split markup into units: one per whitespace chunk (an {a|b} group is atomic). */
function parseUnits(text, sceneId) {
  const alts = [];
  const masked = text.replace(ALT_RE, function (m, a, b) {
    alts.push({ shown: a.trim(), spoken: b.trim() });
    return '\u0001' + (alts.length - 1) + '\u0002';
  });
  const units = [];
  let pending = [];
  masked.trim().split(/\s+/).forEach(function (chunk) {
    const cues = [];
    const bare = chunk.replace(CUE_RE, function (m, id) { cues.push(id); return ''; });
    if (!bare) { pending = pending.concat(cues); return; }
    const expand = function (which) {
      return bare.replace(/\u0001(\d+)\u0002/g, function (m, i) { return alts[Number(i)][which]; });
    };
    units.push({
      shown: expand('shown').split(/\s+/).filter(Boolean),
      spoken: expand('spoken').split(/\s+/).filter(Boolean),
      cues: pending.concat(cues),
    });
    pending = [];
  });
  if (pending.length) throw new Error(sceneId + ': cue(s) ' + pending.join(', ') + ' at the end of the text (no word follows)');
  return units;
}

/**
 * Align spoken tokens with WordBoundary events. Tolerates one token spanning up to 3 events
 * (hyphenated words) and up to 3 tokens sharing one event. Throws with a readable diff otherwise.
 */
function alignTokens(units, events, sceneId) {
  const ev = events.map(function (e) { return { text: e.text, n: norm(e.text), start: e.start, end: e.end }; })
    .filter(function (e) { return e.n; });
  const toks = [];
  units.forEach(function (u, ui) {
    u.spoken.forEach(function (w) {
      const n = norm(w);
      if (n) toks.push({ ui: ui, w: w, n: n, start: null, end: null });
    });
  });
  let i = 0, j = 0;
  const diff = function (why) {
    const lo = Math.max(0, i - 4);
    return new Error(sceneId + ': word alignment failed (' + why + ')\n' +
      '  text  : ' + toks.slice(lo, i + 5).map(function (t, k) { return (lo + k === i ? '>>' : '') + t.w; }).join(' ') + '\n' +
      '  events: ' + ev.slice(Math.max(0, j - 4), j + 5).map(function (e, k) { return (Math.max(0, j - 4) + k === j ? '>>' : '') + e.text; }).join(' ') + '\n' +
      '  Re-run generate-voice.py if the text changed; otherwise adjust the {shown|spoken} form.');
  };
  while (i < toks.length) {
    if (j >= ev.length) throw diff('ran out of events');
    const t = toks[i];
    if (ev[j].n === t.n) { t.start = ev[j].start; t.end = ev[j].end; i++; j++; continue; }
    let done = false;
    for (let k = 2; k <= 3 && j + k <= ev.length && !done; k++) {
      if (ev.slice(j, j + k).map(function (e) { return e.n; }).join('') === t.n) {
        t.start = ev[j].start; t.end = ev[j + k - 1].end; i++; j += k; done = true;
      }
    }
    for (let k = 2; k <= 3 && i + k <= toks.length && !done; k++) {
      const group = toks.slice(i, i + k);
      if (group.map(function (x) { return x.n; }).join('') === ev[j].n) {
        const total = group.reduce(function (a, x) { return a + x.n.length; }, 0);
        let s = ev[j].start;
        const span = ev[j].end - ev[j].start;
        group.forEach(function (x) { x.start = s; s += span * x.n.length / total; x.end = s; });
        i += k; j++; done = true;
      }
    }
    if (!done) throw diff('"' + t.w + '" vs event "' + ev[j].text + '"');
  }
  if (j < ev.length) throw diff('extra events after the last word: ' + ev.slice(j).map(function (e) { return e.text; }).join(' '));
  return toks;
}

/**
 * Timed display words + cues for one scene.
 * Returns {words:[{text,start,end,glue}], cues:{name:t}, speechStart, speechEnd} (take-relative).
 * glue = 'next' when the word must stay on one line with the following word (1–2 letter words).
 */
function timeScene(scene, events) {
  const units = parseUnits(scene.text, scene.id);
  const toks = alignTokens(units, events, scene.id);
  units.forEach(function (u) { u.toks = []; });
  toks.forEach(function (t) { units[t.ui].toks.push(t); });

  const words = [];
  const cues = {};
  const pendingCues = [];
  let leadingPunct = [];
  units.forEach(function (u) {
    if (!u.toks.length) {
      // punctuation-only unit («—»): glue to the previous word with a no-break space
      if (words.length) words[words.length - 1].text += NBSP + u.shown.join(' ');
      else leadingPunct = leadingPunct.concat(u.shown);
      u.cues.forEach(function (c) { pendingCues.push(c); });
      return;
    }
    const uStart = u.toks[0].start, uEnd = u.toks[u.toks.length - 1].end;
    u.cues.concat(pendingCues.splice(0)).forEach(function (c) {
      if (Object.prototype.hasOwnProperty.call(cues, c)) throw new Error(scene.id + ': cue [[' + c + ']] used twice');
      cues[c] = uStart;
    });
    let shown = u.shown.slice();
    if (leadingPunct.length) { shown[0] = leadingPunct.join(' ') + NBSP + shown[0]; leadingPunct = []; }
    if (shown.length === u.toks.length) {
      shown.forEach(function (w, k) { words.push({ text: w, start: u.toks[k].start, end: u.toks[k].end }); });
    } else {
      const total = shown.reduce(function (a, w) { return a + w.length; }, 0);
      let s = uStart;
      shown.forEach(function (w) {
        const e = s + (uEnd - uStart) * w.length / total;
        words.push({ text: w, start: s, end: e });
        s = e;
      });
    }
  });
  if (pendingCues.length) throw new Error(scene.id + ': cue(s) ' + pendingCues.join(', ') + ' not followed by a spoken word');
  words.forEach(function (w) {
    const letters = w.text.replace(/[^\p{L}\p{N}]/gu, '');
    w.glue = letters.length > 0 && letters.length <= 2 && !/[.,!?:;…»—]$/.test(w.text) ? 'next' : null;
  });
  return {
    words: words,
    cues: cues,
    speechStart: words[0].start,
    speechEnd: words[words.length - 1].end,
    wordCount: toks.length,
  };
}

// ---------------- caption grouping ----------------
const G = { maxChars: 84, maxWords: 12, pauseBreak: 0.35, softBreakAfter: 36, minDur: 0.9 };

function charsOf(ws) { return ws.map(function (w) { return w.text; }).join(' ').length; }
const SENTENCE_END = /[.!?…]["»”)]*$/;
const SOFT_END = /[:—]$/;

/** Split a run of words that must be broken (too long) into balanced parts, preferring commas. */
function balance(ws) {
  const n = ws.length;
  const k = Math.max(Math.ceil(charsOf(ws) / G.maxChars), Math.ceil(n / G.maxWords));
  if (k <= 1) return [ws];
  const target = charsOf(ws) / k;
  // DP over break positions: best[p][c] = min cost to split ws[0..p) into c parts
  const INF = 1e18;
  const best = [], from = [];
  for (let p = 0; p <= n; p++) { best.push(new Array(k + 1).fill(INF)); from.push(new Array(k + 1).fill(-1)); }
  best[0][0] = 0;
  for (let p = 1; p <= n; p++) {
    for (let c = 1; c <= k; c++) {
      for (let q = c - 1; q < p; q++) {
        if (best[q][c - 1] >= INF) continue;
        const part = ws.slice(q, p);
        const len = charsOf(part);
        if (len > G.maxChars || part.length > G.maxWords) continue;
        let cost = (len - target) * (len - target);
        const last = part[part.length - 1];
        if (p < n && /[,;]$/.test(last.text)) cost -= 400;
        if (p < n && last.glue) cost += 1e6;                   // never end a line on «в», «и», «не»
        const v = best[q][c - 1] + cost;
        if (v < best[p][c]) { best[p][c] = v; from[p][c] = q; }
      }
    }
  }
  if (best[n][k] >= INF) return [ws];
  const parts = [];
  let p = n;
  for (let c = k; c > 0; c--) { const q = from[p][c]; parts.unshift(ws.slice(q, p)); p = q; }
  return parts;
}

/** Group one scene's timed words (take-relative) into caption groups. */
function groupScene(words) {
  // pass 1: hard breaks (sentence end, pause, soft «:»/«—» after 36 chars)
  const runs = [];
  let cur = [];
  words.forEach(function (w, i) {
    if (cur.length) {
      const gap = w.start - cur[cur.length - 1].end;
      if (gap >= G.pauseBreak) { runs.push(cur); cur = []; }
    }
    cur.push(w);
    const next = words[i + 1];
    if (SENTENCE_END.test(w.text)) { runs.push(cur); cur = []; }
    else if (SOFT_END.test(w.text) && charsOf(cur) >= G.softBreakAfter && next && !orphanTail(cur, i)) { runs.push(cur); cur = []; }
  });
  // a soft break that would leave 1–2 words alone in the next pill («обычному.») is skipped when the
  // whole clause still fits one pill — an orphan caption reads as a glitch, not as rhythm
  function orphanTail(head, i) {
    const tail = [];
    for (let j = i + 1; j < words.length; j++) {
      if (j > i + 1 && words[j].start - words[j - 1].end >= G.pauseBreak) break;
      tail.push(words[j]);
      if (SENTENCE_END.test(words[j].text) || SOFT_END.test(words[j].text)) break;
    }
    return tail.length < 3 && charsOf(head.concat(tail)) <= G.maxChars && head.length + tail.length <= G.maxWords;
  }
  if (cur.length) runs.push(cur);
  // pass 2: balance runs that exceed the limits
  let groups = [];
  runs.forEach(function (r) { groups = groups.concat(balance(r)); });
  // pass 3: merge groups whose speech is too short to read, when the merge fits
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      const span = g[g.length - 1].end - g[0].start;
      if (span >= G.minDur - 0.3) continue;
      const tryMerge = function (a, b) {
        const m = groups[a].concat(groups[b]);
        return charsOf(m) <= G.maxChars && m.length <= G.maxWords ? m : null;
      };
      let m = null, at = -1;
      if (i + 1 < groups.length && (m = tryMerge(i, i + 1))) at = i;
      else if (i > 0 && (m = tryMerge(i - 1, i))) at = i - 1;
      if (m) { groups.splice(at, 2, m); changed = true; break; }
    }
  }
  return groups.map(function (ws) {
    return { words: ws, text: ws.map(function (w) { return w.text; }).join(' '), first: ws[0].start, last: ws[ws.length - 1].end };
  });
}

module.exports = { spokenText, shownText, norm, parseUnits, alignTokens, timeScene, groupScene, NBSP, G };
