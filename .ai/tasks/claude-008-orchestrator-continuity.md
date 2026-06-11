# claude-008 — Conveyor continuity: echo-back, --continue, phase-exit hooks, stale-test rule

OWNER: claude
STATUS: **AUTHORED + 0-leak verified; NOT committed; not yet exercised in a live session.** (stage 3 of `docs/IMPROVEMENT-ROADMAP.md`)
PLAN: `C:\Users\k.shavrin\.claude\plans\generic-jumping-flame.md` (approved 2026-06-11)
ITEMS: A5, A6, A7, A8, E1

## Why
Three audit findings break the "rough idea → correct result" promise of goal 1: (1) the SPEC
gate shows the SPEC but never reconstructs the user's INTENT, so a misread idea sails through;
(2) the happy path is 4+ commands the user must sequence by hand (`/mp-spec` →
`--plan --phases` → `--phase`×N → `--fit`) and phase completion triggers nothing; (3) the
tester only writes tests for NEW files — when behaviour of existing code changes, its old tests
silently rot. Plus the clone fit threshold exists nowhere in config and is never enforced (E1,
also a goal-2 item — it lands here because it is a config + orchestrator change).

## Scope
- **A5** — SPEC gate opens with a "How I understood the task" block: 2–3 plain-language
  sentences reconstructing the intent (goal, non-goals, the one thing that must be true),
  BEFORE the SPEC body. User corrects intent, not syntax.
- **A6** — `/mp --continue`: inspect project state (PROGRESS.md phase statuses, backlog board,
  `spec/fit/registry.csv`, last run events) → print the single recommended next command with a
  1-line why; `y` executes it. Pure state-machine over existing artifacts, no new state files.
- **A7** — phase-exit hook in `--phase`: when the last TASK-NN.k ticks, auto-run `--check`;
  in clone projects, when the final (Fit-gate) phase closes, auto-offer `--fit`.
- **A8** — stale-test rule: tester input gains `behaviour_changed_files[]`; for each, the
  tester MUST read the existing test file and update assertions (or state why none needed).
  Verifier gains check 6: prod file changed + its test untouched + no exception note → fail.
- **E1** — `fit_threshold` (default 85) read from `.claude/mp/config.json`; `--fit` compares
  `overall_score` against it and reports PASS/FAIL; FAIL blocks the clone-done claim.

## Files
- `templates/common/commands/{{PREFIX}}.md` — A5 gate block, A6 `--continue` flow, A7 hooks,
  E1 threshold plumbing.
- `templates/android/agents/{{PREFIX}}-tester-android.md` — A8 stale-test obligation.
- `templates/android/agents/{{PREFIX}}-verifier-android.md` — A8 check 6.
- `templates/android/agents/{{PREFIX}}-fit-android.md` — E1 threshold in payload.
- `templates/common/specs/README.md` / docs — document `--continue` + threshold.

## Ownership / coordination
No codex-owned files. `--continue` is additive (new flag); MyMoney_app's bespoke local
commands are unaffected (plugin namespace `mp-*`).

## Verify
- Plugins regenerate 0 leaks; orchestrator markdown renders with no broken `<!-- if -->` blocks.
- Dry-run transcript review: SPEC gate shows the intent block; `--continue` on a fixture
  PROGRESS.md picks the correct next step for: phases-open / fit-pending / all-done.
- A8 negative test: a SPEC changing an existing ViewModel without touching its test → verifier
  check 6 fails with the right message.

## Checklist
- [x] A5 intent echo-back in SPEC gate (ordered block ahead of the SPEC at the same gate;
      corrected echo-back → re-plan/re-grill before re-emitting; Rules bullet)
- [x] A6 `--continue` state machine (new workflow section: 5-step read-only inspection,
      first-match-wins recommendation, y/N gate, runs the chosen workflow with its own gates;
      usage line + argument-hint in build-marketplace.sh)
- [x] A7 phase-exit hook (`--phase` Phase 4: auto `--check` on zero unchecked tasks; clone →
      gated `--fit` offer, mandatory for the Fit-gate / screen-touching phases)
- [x] A8 stale-test rule (orchestrator derives MODIFIED_EXISTING from the developer commit →
      tester "Stale-Test Update Rule" section + `stale_tests_reviewed[]` return field →
      verifier Check 6 `stale_tests`, six-check pass logic, prompt carries
      MODIFIED_EXISTING/TEST_FILES/COVERAGE_EXCEPTIONS/STALE_TESTS_REVIEWED)
- [x] E1 fit_threshold (config `fitThreshold` default 85, resolved in `--fit` Phase 1, enforced
      in the report — PASS|FAIL line + "clone may not be declared done" on FAIL; telemetry
      verdict/metric carry it)
- [x] change-log entry (`2026-06-11T07:30-orchestrator-continuity`) + CHANGELOG [Unreleased] +
      plugins regenerated, 0 leaks
- [ ] exercise live: echo-back catches a deliberately vague request; `--continue` picks the
      right step on a phase-model project; Check 6 fails on a behaviour change with untouched
      tests; `--fit` FAILs below threshold
- [ ] not committed (awaiting user go-ahead)
