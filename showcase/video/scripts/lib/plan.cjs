'use strict';
// The film's time plan, derived ONLY from narration.json + word timings + measured voice durations.
//   scene length = lead + voice + tail, rounded UP to 0.1 s; the voice starts at `lead`.
//   cue time (scene-local) = lead + start of the first spoken word after the [[cue]] marker.
const path = require('path');
const fs = require('fs');
const C = require('./common.cjs');
const N = require('./narration.cjs');

function computePlan() {
  const narration = C.readJSON(C.P.narration);
  if (!fs.existsSync(C.P.voiceMeta)) C.die('narration/voice.json missing — run scripts/process-voice.cjs');
  const voice = C.readJSON(C.P.voiceMeta);
  const scenes = [];
  let t = 0;
  narration.scenes.forEach(function (s, i) {
    const wordsFile = path.join(C.P.wordsDir, s.id + '.json');
    if (!fs.existsSync(wordsFile)) C.die(s.id + ': ' + wordsFile + ' missing — run scripts/generate-voice.py');
    const take = C.readJSON(wordsFile);
    const spoken = N.spokenText(s.text);
    if (take.spoken !== spoken) C.die(s.id + ': narration text changed — re-run generate-voice.py and process-voice.cjs');
    const v = voice.scenes[s.id];
    if (!v || v.hash !== take.hash) C.die(s.id + ': assets/voice WAV is stale — re-run scripts/process-voice.cjs');
    const timed = N.timeScene(s, take.words);
    const lead = s.lead != null ? s.lead : narration.timing.lead;
    const tail = s.tail != null ? s.tail : narration.timing.tail;
    const dur = C.ceil1(lead + v.duration + tail);
    const cues = {};
    Object.keys(timed.cues).forEach(function (k) { cues[k] = C.r3(lead + timed.cues[k]); });
    scenes.push({
      n: i + 1,
      id: s.id,
      title: s.title,
      start: C.r3(t),
      duration: dur,
      end: C.r3(t + dur),
      lead: lead,
      tail: tail,
      voice: { file: v.file, start: C.r3(t + lead), duration: v.duration, samples: v.samples },
      speech: { start: C.r3(lead + timed.speechStart), end: C.r3(lead + timed.speechEnd) },
      wordCount: timed.wordCount,
      cues: cues,
      words: timed.words.map(function (w) {
        return { text: w.text, start: C.r3(lead + w.start), end: C.r3(lead + w.end), glue: w.glue };
      }),
    });
    t += dur;
  });
  return { total: C.r3(t), fps: 30, width: 1920, height: 1080, scenes: scenes };
}

module.exports = { computePlan };
