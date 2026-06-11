# Improvement roadmap — pipeline audit vs project goals

DATE: 2026-06-11 · OWNER: claude · SOURCE: deep audit session (plan
`C:\Users\k.shavrin\.claude\plans\generic-jumping-flame.md`, approved by user).
Execution is split into six `.ai/tasks/claude-006…011` briefs (one per stage, below).

This document is the **canonical catalog**: 46 improvements graded against the two project
goals, with evidence pointers into `templates/`. Task briefs reference items by ID (A1, C3, …).
When an item ships, tick it here AND in its task brief; never delete entries.

## The two goals (user-stated)

1. **Closed development loop** — user writes a rough idea; the system must infer the real
   intent, implement, keep autotests current, test, self-improve (the app AND the pipeline),
   and update cross-project memory about the user. Spec creation for delegating to other
   models is part of this.
2. **Clone a Google Play app** from a link/APK — plan what to copy, implement, maximise
   similarity. Last iteration (MyMoney/Monefy) failed on (a) design fidelity and
   (b) silently-forgotten features/buttons.

## Audit verdict (summary)

**Goal 1:** the dev conveyor (grill → SPEC gate → developer → reviewer → tester → runner →
verifier → push → docs) is solid and ~70 % automatic, but the *learning* loop is only ~30 %
closed: telemetry (`selfimprove/record-run.sh`) is never invoked, reflection
(`selfimprove/reflect.sh`, `{{PREFIX}}-cross-reflect.sh`) and proposal draining
(`/mp --improve --drain`) are manual flags, `lib/sync.sh` is still unbuilt (codex-owned), and
there is **no cross-project memory about the user** — only per-project technical memos. The
tester writes tests for new files but never updates existing tests when behaviour changes.

**Goal 2:** both failure modes of the last clone are reproducible from the templates.
*Forgotten button* — five lossy steps, none blocking: low-confidence CTAs sink into
`ambiguities[]`→risks; `coverage_gaps[]` / `stories_without_scenario[]` never reach the user;
`orphan_screen` / `state_coverage_gap` are warn-only; and neither `{{PREFIX}}-planner` nor
`{{PREFIX}}-phase-planner` audits that every FR/screen/registry row landed in a task.
*Design mismatch* — style tokens are LLM eyeball guesses (±2 sp, bucketed radii/elevation);
the crawl already captures uiautomator dumps with **exact pixel bounds per element** but they
feed nothing; APK assets (drawables/fonts) are not extracted; the `--fit` gate is a purely
multimodal judgment with no pixel diff, no enforced threshold, no capture normalization; crawl
Phases 2–4 have never run end-to-end on a device.

User decisions for this roadmap: **loop first, clone second**; allowed new tooling:
ImageMagick/SSIM pixel diff, apktool/aapt2 extraction, GitHub Actions CI, scheduled/hooked
auto-runs.

---

## Catalog

Tags: `[S/M/L]` effort · ★ = scheduled in a stage below (30 items); the rest are backlog (16).

### A. Closing the self-improvement loop (12)

- **A1 ★ [S]** Wire `selfimprove/record-run.sh` calls into the orchestrator steps (after
  runner / reviewer / verifier / fit) so telemetry accrues automatically.
  Evidence: `templates/common/commands/{{PREFIX}}.md` never invokes it; `selfimprove/runs/` ships empty.
- **A2 ★ [S]** Run counter: after N (default 10) recorded runs with no retro, the orchestrator
  itself offers/runs `selfimprove/reflect.sh` and shows the retro.
- **A3 ★ [S]** Auto-drain nudge: when `.ai/proposals/` holds ≥3 queued proposals, the
  orchestrator offers `--improve --drain` at session end (today the queue grows silently).
  Evidence: `templates/common/agents/{{PREFIX}}-reflect.md`, `scripts/{{PREFIX}}-improve-drain.sh`.
- **A4 ★ [S]** Post-ship feedback: one question after `--feature` ("does this match what you
  wanted? 1–5 + note") recorded into `runs/*.jsonl` + `lessons.md` — gives reflection a quality
  signal beyond pass/fail.
- **A5 ★ [S]** Intent echo-back: the SPEC gate opens with "How I understood the task" — a 2–3
  sentence reconstruction of intent (not a SPEC paraphrase) the user confirms.
  Evidence: Phase 1 in `templates/common/commands/{{PREFIX}}.md` shows the SPEC only.
- **A6 ★ [M]** `/mp --continue`: a state machine that reads PROGRESS / backlog / fit registry
  and proposes the next conveyor step — collapses the 4-command chain
  (`/mp-spec` → `--plan --phases` → `--phase`×N → `--fit`) into one re-entry point.
- **A7 ★ [S]** Phase-exit hook: ticking the last TASK of a phase auto-runs `--check`; in clone
  projects, finishing the final phase auto-offers/runs `--fit`.
- **A8 ★ [M]** Existing-test update rule: the tester MUST re-read tests of behaviour-changed
  prod files and update assertions; verifier gains a "behaviour changed ⇒ its test changed"
  check. Evidence: `templates/android/agents/{{PREFIX}}-tester-android.md` covers only new
  files from CHANGED_FILES.
- **A9 [M]** Regression diff in the runner: persist the last green test list; classify failures
  as new vs regression in the JSON payload.
- **A10 [S]** Coverage closing: on JaCoCo threshold failure, run an automatic tester top-up
  pass instead of STOP.
- **A11 ★ [M]** CI propagation: merge to main → `lib/build-marketplace.sh` → auto-commit plugin
  trees → projects consuming the git-source marketplace pick improvements up on next session.
- **A12 ★ [S]** Scheduled weekly `/mp --reflect` + auto-maintain
  `~/.config/mobile-pipeline/projects.txt` when a project is bootstrapped/wired.

### B. Memory & understanding the user (5)

- **B1 ★ [M]** Cross-project user profile: `~/.config/mobile-pipeline/user-profile.md`;
  `{{PREFIX}}-knowledge` gains a `user_preference` lesson category routed there.
  Evidence: `templates/common/agents/{{PREFIX}}-knowledge.md` routes only project/plugin lessons.
- **B2 ★ [S]** The `/mp` grill reads the profile: recommended answers reflect past choices
  (dark theme, Russian UI, minimalism, question tolerance…).
- **B3 ★ [S]** `/mp-spec` reads the profile too (greenfield stage questions pre-filled with
  profile defaults). Evidence: `templates/spec/skills/app-spec-creator/prompts/techniques/grill-me.md`.
- **B4 ★ [S]** Taste journal: after each `--fit` / post-ship feedback, record what the user
  liked/disliked visually → profile.
- **B5 [M]** Periodic memory consolidation across all pet projects (merge duplicates, distil
  shared facts into the profile) — mirror of the consolidate-memory pattern.

### C. Clone completeness — "no forgotten button" (10)

- **C1 ★ [M]** Element manifest: deterministic script turns crawl `ST*.xml` uiautomator dumps
  into `spec/fit/<Sxx>-elements.json` (id/text/type/bounds of every interactive element).
  Evidence: `templates/spec/skills/app-spec-creator/scripts/crawl/ui-dump.sh` output is unused
  downstream.
- **C2 ★ [M]** Affordance audit in `spec-evaluator` (new Class 5): every clickable in the
  manifest must match a feature/CTA/ambiguity; unmatched = **blocker**.
  Evidence: `templates/spec/agents/spec-evaluator.md` has 4 check classes, none element-level.
- **C3 ★ [M]** Structural diff in `--fit`: ui-dump the BUILT app and compare its element tree
  to the reference manifest — a missing button is caught deterministically, not by eye.
  Evidence: `templates/android/agents/{{PREFIX}}-fit-android.md` compares screenshots only.
- **C4 [M]** Tester generates a Compose-UI "all manifest elements exist" semantics test per
  cloned screen — a forgotten button fails in CI forever after.
- **C5 ★ [M]** Plan-coverage audit after `--plan --phases`: every FR/US/screen/registry row →
  ≥1 TASK; uncovered list is a blocker gate.
  Evidence: `templates/common/agents/{{PREFIX}}-phase-planner.md` emits phases without any
  completeness audit.
- **C6 ★ [S]** Clone-strict evaluator profile: `orphan_screen` and `state_coverage_gap`
  escalate warn → blocker in clone mode.
- **C7 ★ [S]** Surface `coverage_gaps[]` (user-story-writer) and `stories_without_scenario[]`
  (acceptance-criteria-writer) as an explicit list at GATE 2 — today they drown in JSON.
- **C8 [S]** Extend `--check` to cross-verify `traceability.csv` + `fit/registry.csv` (every
  Visual-QA task exists / is ticked).
- **C9 [S]** Ban silent ambiguity decay into risks: at GATE 1 each ambiguity demands an
  explicit decision (include / exclude / defer-with-record).
  Evidence: `templates/spec/agents/screenshot-business-analyzer.md` (confidence <0.7 → ambiguity).
- **C10 ★ [run]** Device-validate crawl Phases 2–4 end-to-end on a throwaway AVD
  (navigator/executor/reviewer trio + seeding/auth + per-state fit frames). Prerequisite for
  C1–C4. Evidence: `.ai/tasks/claude-004-reference-crawler.md` — "authored, not device-proven".

### D. Design fidelity (9)

- **D1 ★ [M]** bounds→dp: script converts ui-dump pixel bounds (+ device density) into exact
  margins/sizes per element → fit checklists state real dp values instead of "density: normal".
- **D2 ★ [M]** Pixel diff in `--fit` (ImageMagick compare / SSIM): objective per-screen score +
  heatmap artifact; the LLM keeps semantic judgment; threshold enforced.
- **D3 ★ [S]** Capture normalization: pinned AVD profile + `adb shell ... sysui_demo` demo mode
  (fixed clock/battery/locale/font-scale) for BOTH reference and built captures.
- **D4 ★ [M]** Asset extraction (apktool/aapt2): drawables/icons/fonts out of the reference APK
  into `spec/assets/` for personal reuse (legal caveat documented).
  Evidence: `templates/spec/agents/apk-analyzer.md` inventories assets but extracts none.
- **D5 ★ [M]** Generate `ColorScheme`/`Typography` Kotlin directly from `03_style.md`/APK token
  JSON — removes the manual Material Theme Builder seam in
  `templates/android/agents/{{PREFIX}}-ui-designer-android.md`
  (see `templates/android/snippets/material-theme-builder.md`).
- **D6 [S]** Palette by script (ImageMagick histogram quantization); the LLM only assigns
  colors to Material roles. Evidence: `templates/spec/agents/screenshot-style-analyzer.md`
  ("approximate to the nearest matchable hex").
- **D7 [S]** Fonts from APK (`res/font`, `assets/fonts`) → exact family into typography
  (subset of D4).
- **D8 [M]** Roborazzi baselines = reference frames with tolerance — fit becomes a continuous
  regression test instead of a one-off gate.
- **D9 ★ [S]** `--fit` walks the checklist row-by-row: explicit pass/fail per must-match line
  in `spec/fit/<Sxx>.md` (today the comparison is free-form).
  Evidence: `templates/spec/agents/fit-checklist-author.md` + `{{PREFIX}}-fit-android.md`.

### E. Spec pipeline / infrastructure / DX (10)

- **E1 ★ [S]** `fit_threshold` in `.claude/mp/config.json` + enforcement in `--fit` (today the
  score is advisory; no agent enforces a pass bar).
- **E2 [M]** `/mp-spec --update`: re-sync the spec bundle after implemented phases (bundles go
  stale once dev starts).
- **E3 [M]** Greenfield fit: structural checklists derived from `design.md` so non-clones get a
  (weaker) fit gate too.
- **E4 [S]** `--fast` spec mode (haiku/sonnet draft tier) for cheap iterations.
- **E5 ★ [S]** CI validation: `bash -n` + shellcheck + leak-grep + plugin-drift check on every
  PR (extend the existing validate workflow).
- **E6 [M]** `bootstrap --upgrade` + fill `docs/UPGRADE.md` (currently deferred).
- **E7 [L]** Golden-bundle eval in CI: mini-clone fixture → spec run → diff vs golden output
  (prompt-quality regression harness; seed exists in `eval/clone-fit/`).
- **E8 ★ [S]** Token/cost telemetry fields in `runs/*.jsonl` ("what did this feature cost").
- **E9 [decision]** iOS: either flesh out the stub agents or freeze them explicitly
  (`templates/ios/agents/*` are STUBs since v1.0.0).
- **E10 [S]** Single end-to-end tutorial "idea → APK → clone → fit" (today spread across
  CLONE-PLAYBOOK / REFERENCE-CRAWLER / MARKETPLACE docs).

---

## Stages (execution order — loop first, per user decision)

| Stage | Task brief | Items | Done when |
|---|---|---|---|
| 1. Learning loop | `.ai/tasks/claude-006-loop-telemetry.md` | A1 A2 A3 A4 E8 | A `/mp` run appends run events automatically; retro/drain offered without flags; feedback question lands in lessons. |
| 2. User memory | `.ai/tasks/claude-007-user-profile.md` | B1 B2 B3 B4 | Profile file exists & grows via knowledge routing; both grills read it for recommended answers. |
| 3. Conveyor continuity | `.ai/tasks/claude-008-orchestrator-continuity.md` | A5 A6 A7 A8 E1 | Echo-back in SPEC gate; `--continue` proposes next step; phase-exit auto-`--check`; tester updates stale tests; fit threshold enforced. |
| 4. CI propagation | `.ai/tasks/claude-009-ci-propagation.md` | A11 E5 A12 | Merge to main regenerates+commits plugins; PR CI runs shellcheck/leak/drift; weekly reflect scheduled. |
| 5. Clone completeness | `.ai/tasks/claude-010-clone-completeness.md` | C10 C1 C2 C3 C5 C6 C7 | Crawl trio device-proven; element manifests emitted; evaluator Class 5 + clone-strict; plan-coverage audit blocks gaps; structural diff in `--fit`. |
| 6. Clone fidelity | `.ai/tasks/claude-011-clone-fidelity.md` | D1 D2 D3 D4 D5 D9 | Fit checklists carry exact dp; `--fit` reports SSIM + per-row verdicts under a normalized capture env; assets extracted; theme generated from tokens. |

**Backlog (unscheduled):** A9 A10 B5 C4 C8 C9 D6 D7 D8 E2 E3 E4 E6 E7 E9 E10 — promote into a
stage when its prerequisites land (e.g. C4 after C1; D6/D7 alongside D4).

## Ownership & ground rules for implementation

- Codex-owned files stay untouched by these stages: `lib/render.sh`, `lib/sync.sh`,
  `bootstrap.sh`, `.codex/` (see `.ai/tasks/codex-001-dual-tool.md`). CI workflows (stage 4)
  are **additive new files**; anything needing render/bootstrap changes is flagged in
  `.ai/handoff.md` for codex instead.
- Every agent/skill/template edit gets an entry in `.ai/changes/agent-skill-log.md` and a
  plugin regeneration (`lib/build-marketplace.sh`) with a 0-leak grep, per repo discipline.
- Never delete files; SemVer bump per release (most stages are MINOR — additive agents/flags).
- New scripts: cross-platform bash, `#!/usr/bin/env bash`, no `sed -i`, one JSON line out.
