# Handoff

Last session: Codex · 2026-09-23 · Russian audience modes and narrated film.
Previous uncommitted handoff preserved at `archive/handoff-2026-09-04-graph.md`.

## DONE

- Replaced graph/index.html with four audience modes. The simple route has
  three plain-language groups and eight readable scenes, role cards, coordinator,
  directed connections, a parallel join demonstration and interactive phone.
- Retained the full original technical viewer as graph/expert.html. Legacy node
  URLs route into it; stage and node selection survive mode changes.
- Added graph/story/scenario.js with grounded source refs and Russian explanations.
  Research uses three grounding-scout instances; implementation and tests stay
  sequential. Conditional agents, one repair retry and human acceptance are explicit.
- Delivered graph/media/mobile-pipeline.mp4: 233.033 seconds, 1920x1080, 30fps,
  H.264/AAC, 22.4 MB. Russian narration, 59 burned-in sentence captions, no music.
  Site includes chapter seeking, transcript, poster and the standalone file.
- HyperFrames source and frozen local audio/fonts live in videos/mobile-pipeline.
  Rebuild commands and provenance are documented. Playback has no CDN dependency.
- Extended graph guard and added jsdom behavior tests to CI. Updated graph docs,
  task index and change log. No pipeline templates or behavior were changed.

## VERIFIED

- bash tests/test-graph.sh, bash -n, ShellCheck 0.11.0: PASS.
- Node 24 / jsdom tests: four modes, old URLs, source refs, join barrier, sequential
  execution, cancellation, keyboard, reduced motion, file URL routing, focus,
  expert search/zoom, chapter navigation and phone state: PASS.
- HyperFrames check: lint/runtime/layout/contrast zero errors and warnings.
- Measured caption bounds, ffprobe parameters and full FFmpeg decode: PASS.
- Inspected all scene snapshots and selected frames from the actual delivered MP4.
- graphify update . rebuilt the local AST graph. See graph/VALIDATION.md for scope.

## DECISIONS

- Story is a teaching example of /mp-spec --feature then /mp --feature --next,
  not real execution telemetry. Animation speed does not imply pipeline latency.
- Plain script data preserves opening from disk and existing GitHub Pages hosting.
- Existing technical data retains its schema. Explanation is a separate story layer.
- Narration uses locally frozen ru-RU-DmitryNeural speech; regeneration needs
  edge-tts/network, but rebuilding with the committed audio and playback do not.

## NEXT

- User can open graph/index.html and watch the film in Presentation mode.
- Optional follow-up: inspect the website in a permitted browser at desktop and
  narrow widths. The browser tool blocked the local URL; DOM tests do not prove layout.
- GitHub Pages still needs repository Settings > Pages > GitHub Actions if not
  enabled previously. No remote deployment or push was requested in this session.
- Unrelated preexisting README.md, AGENTS.md and docs/ARCHITECTURE.md edits remain.

## OWNER

Free.

## BLOCKERS

No implementation blocker. Website browser visual verification was unavailable
because the browser tool rejected the local URL; this was not bypassed.
