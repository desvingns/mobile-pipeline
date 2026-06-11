# claude-010 — Clone completeness: element manifests, affordance audit, plan-coverage gate

OWNER: claude
STATUS: **C1–C7 AUTHORED + 0-leak verified (script fixture-tested); C10 device validation PENDING; NOT committed.** (stage 5 of `docs/IMPROVEMENT-ROADMAP.md`)
PLAN: `C:\Users\k.shavrin\.claude\plans\generic-jumping-flame.md` (approved 2026-06-11)
ITEMS: C10 (prerequisite run), C1, C2, C3, C5, C6, C7

## Why
The last clone iteration "forgot" buttons/features. The audit traced five lossy steps where a
visible affordance drops without ANY blocker: low-confidence CTAs decay into ambiguities→risks;
`coverage_gaps[]` / `stories_without_scenario[]` never reach the user; `orphan_screen` /
`state_coverage_gap` are warn-only; and neither planner audits that every FR/screen/registry
row landed in a task. Meanwhile the crawl already captures uiautomator dumps (`ST*.xml`) — a
deterministic ground-truth list of every interactive element — that nothing consumes. This
task turns "nothing forgotten" from hope into three deterministic gates (spec-time, plan-time,
build-time).

## Scope
- **C10 (run first)** — end-to-end device validation of crawl Phases 2–4 on a throwaway AVD
  with a real reference APK (NOT the live MyMoney emulator): trio loop, seeding/auth, per-state
  frames. Fix rough edges as found (expect Phase-1-style bugs). Tracked in claude-004; this
  task depends on it.
- **C1** — new script `scripts/crawl/element-manifest.sh` (or extend ui-dump finalize): per
  screen, distil `ST*.xml` into `spec/fit/<Sxx>-elements.json` — id/text/content-desc/class/
  clickable/bounds for every interactive node, deduped across states.
- **C2** — `spec-evaluator` Class 5 "affordance coverage": every manifest element matches a
  feature / CTA / explicit ambiguity decision; unmatched ⇒ **blocker** finding routed to the
  business analyzer/requirements author in the optimize loop.
- **C3** — `--fit` structural diff: capture a ui-dump of the BUILT app per (screen, state),
  diff its element tree against the reference manifest (missing/extra/renamed elements) BEFORE
  the multimodal pass; missing element ⇒ divergence with severity high, deterministic.
- **C5** — plan-coverage audit in `--plan --phases`: after the planner emits phases, a
  deterministic cross-check (script or orchestrator step) lists every FR / US / screen /
  registry row not referenced by any TASK; non-empty list blocks the write gate.
- **C6** — evaluator clone-strict profile: `orphan_screen`, `state_coverage_gap` warn→blocker
  when `mode: clone`.
- **C7** — GATE 2 surfacing: `coverage_gaps[]` + `stories_without_scenario[]` rendered as an
  explicit numbered list the user must acknowledge.

## Files
- `templates/spec/skills/app-spec-creator/scripts/crawl/` — C1 script (+ SKILL finalize step).
- `templates/spec/agents/spec-evaluator.md` (+ its rubric prompt) — C2, C6.
- `templates/spec/skills/app-spec-creator/SKILL.md` — C7 GATE 2, C1 wiring.
- `templates/android/agents/{{PREFIX}}-fit-android.md` — C3 structural-diff step.
- `templates/common/agents/{{PREFIX}}-phase-planner.md` + `templates/common/commands/{{PREFIX}}.md` — C5 audit gate.
- `docs/CLONE-PLAYBOOK.md`, `docs/REFERENCE-CRAWLER.md` — document the three gates.

## Ownership / coordination
No codex-owned files. New script follows repo script rules (cross-platform bash, one JSON
line). install-spec.sh / build-marketplace.sh already copy `scripts/` wholesale — verify the
new file ships.

## Verify
- C10: throwaway-AVD run produces state-graph + per-state frames + manifests; creds never in artifacts.
- Unit-style fixture: a reference manifest with a button the spec lacks ⇒ evaluator Class 5
  blocker; same button absent from built ui-dump ⇒ `--fit` files a high-severity divergence.
- Plan fixture: registry row without a Visual-QA task ⇒ C5 gate blocks with the row named.
- `bash -n` + shellcheck on new script; plugins regenerated 0 leaks.

## Checklist
- [ ] C10 device validation (depends on claude-004 NEXT — throwaway AVD; authored gates below
      need this run to be exercised end-to-end)
- [x] C1 `element-manifest.sh` (offline awk-only; fixture-tested: extracts only interactive
      nodes, Cyrillic-safe) + SKILL A.0 finalize wiring + fit-checklist-author
      `crawl_elements_dir` input → per-screen `spec/fit/elements/<Sxx>.json` (union/dedup,
      `expected:true` unless deviations exclude)
- [x] C2 evaluator-rubric v1.1.0 Class 5 affordance coverage (`unmatched_affordance` blocker →
      requirements-author, flagged as a GATE-1-level decision; conservative fuzzy matching;
      `coverage.unmatched_affordances[]`)
- [x] C3 structural diff in `--fit` (orchestrator captures built ui-dumps best-effort with the
      MSYS guard; fit agent runs the deterministic element diff BEFORE the visual pass — missing
      expected element = major/high-confidence divergence)
- [x] C5 plan-coverage audit in `--plan --phases` Phase 2 (registry screens + traceability
      FR/US ids → ≥1 task; uncovered = blocker → re-plan or explicit deferred rows in
      00_overview) + Rules bullet
- [x] C6 clone-strict (orphan_screen + state_coverage_gap warn→blocker on `app.mode=clone`)
- [x] C7 GATE 2 prints all coverage-gap lists explicitly (evaluator + story-writer + acceptance
      + fit author) as numbered, acknowledged items
- [x] docs (REFERENCE-CRAWLER "Element manifests", CLONE-PLAYBOOK "Completeness gates") +
      change-log entry (`2026-06-11T09:30-clone-completeness-gates`) + CHANGELOG [Unreleased] +
      plugins regenerated, 0 leaks, script shipped in mp-spec
- [ ] not committed (awaiting user go-ahead)
