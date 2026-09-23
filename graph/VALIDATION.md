# Demonstration validation — 2026-09-23

## Visual refinement — same day

- Replaced the small-text presentation with 17–19 px story copy, 22–25 px role
  headings, larger controls, a more dimensional phone and stronger role colors.
- Added explicit dark (default), light and paper palettes, including the expert
  map. Selection persists when localStorage is available and still works when
  storage is blocked. Themes do not change the route or current story stage.
- Focused DOM checks cover stored/invalid preferences, blocked file storage,
  selected-button state, parent-to-map synchronization and foreign-message rejection.
- Contrast calculations for primary, secondary, role and phone text/background
  pairs meet 4.5:1: minimum 6.58 dark, 4.91 light and 4.53 paper. These calculations
  are not a substitute for browser visual inspection; the earlier restriction remains.
- Responsive styles switch cards to a vertical sequence on small screens;
  reduced-motion mode disables hover transforms and keeps the phone still.

## Website

- `bash tests/test-graph.sh`: PASS. All canonical agents, scripts, modes, graph
  edges and source paths are still covered; no fetch or ES-module requirement.
- `bash -n tests/test-graph.sh` and ShellCheck 0.11.0: clean.
- `npm test --prefix tests/graph-demo`: PASS with Node 24 / jsdom 30.1.1.
  Checks story refs, three independent scout instances, the join barrier,
  sequential implementation, cancellation, all four modes, old node URLs,
  role dialogs, phone state, chapters, file URL routing, reduced motion,
  keyboard navigation, focus, and the retained map's search/zoom controls.
- Runtime fonts, scripts, video and poster are local. The website needs no
  installation or server. External source links in the expert map are optional.
- Responsive CSS includes vertical node flow at narrow widths and keeps the
  phone visible. **Website browser layout remains unverified:** the browser
  tool rejected its local URL during planning. That restriction was not
  bypassed. jsdom exercises behavior, not real layout or video playback.

## Film

- HyperFrames 0.8.65 `check --json`: all enabled lint, runtime, layout and
  contrast checks passed with zero errors/warnings. Full report:
  `../videos/mobile-pipeline/check.json`.
- Reviewed snapshots from all eight scenes, plus research join, repair start,
  repaired state and acceptance. Caption text, card states and phone counts
  remain visible; the three research reports join before continuation.
- Animation-map inspection produced no dead zones. Its heuristic collision
  list includes duplicate registrations of the same sub-composition tweens;
  zero-height SVG path bounds trigger degenerate flags, and the hidden repair
  heart reset triggers an invisible flag. These are not reported as a clean
  automated motion pass; the relevant visual states were inspected separately.
- 59 sentence captions use voice-provider boundaries, transformed with the
  same tempo factor as the frozen voice. Every caption fits its scene.
- Local render: 6,991 frames, 233.033 seconds. MP4: H.264, 1920×1080, 30fps;
  AAC, 48 kHz stereo. File: 22,376,655 bytes (about 22.4 MB).
- The final MP4 fully decoded through FFmpeg without errors. Frames extracted
  from the delivered file were inspected at 13, 50, 178 and 229 seconds.
- Minor AAC slot adjustments in render logs (under 0.1 second) reflect decoded
  encoder padding. Scenes retain their fixed duration and caption timeline.

No pipeline template or runtime behavior was changed. The site shows a teaching
scenario, not a real execution trace or a benchmark of agent running time.
