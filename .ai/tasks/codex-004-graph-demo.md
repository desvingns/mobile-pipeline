# Mobile Pipeline demonstration

STATUS: COMPLETE
OWNER: Codex

Approved: 2026-09-23. Redesign graph/ with four Russian audience levels and a
narrated 3–4 minute HyperFrames video. Keep the existing technical graph and
legacy node links, file:// compatibility, and all unrelated working-tree edits.

Story: favorites in a recipe app; actual brownfield mp-spec feature research
(three grounding-scout instances), approved backlog, then sequential mp feature
implementation. Never invent parallel implementation agents.

Deliverables: accessible static website, shared story data, local fonts, video
source, H.264/AAC MP4, poster, transcript, validation evidence, updated handoff.

Prior baseline: bash tests/test-graph.sh PASS. Browser file:// inspection was
blocked by URL policy during planning; do not circumvent that restriction.

Delivered: four audience modes, source-linked story, local fonts, interactive
phone, preserved expert map, legacy routes, chapter player, transcript, and a
233.033-second narrated HyperFrames MP4 (1080p30 H.264/AAC, 22.4 MB).

Validation: graph guard, ShellCheck, DOM behavior tests, HyperFrames lint /
runtime / layout / contrast, measured caption bounds and ffprobe passed.
Video keyframes inspected; website browser layout could not be visually
verified because the local URL was blocked by browser policy. See
graph/VALIDATION.md for precise scope and reproducible test commands.
