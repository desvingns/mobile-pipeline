# eval/ — placeholder for future eval framework

This directory will hold a regression-test framework for cmp agent prompts. Not implemented
in v1.0.0 — premature without ≥10 real pipeline runs to use as cases.

## Plan (when implemented)

After ≥10 `/<prefix> --feature` runs accumulate across cmp-using projects:

1. Each run's `SPEC`, `commit hash`, and `changed_files` becomes one eval case.
   Store as `eval/cases/<NNN>-<slug>.json`:
   ```json
   {
     "spec": { "task": "feature", "what": "...", "layers": [...], ... },
     "expected_commit_signature": {
       "changed_files_match_pattern": ["app/src/main/.../<Name>UseCase.kt", ...],
       "layer_order_respected": true,
       "no_files_outside_spec_scope": true
     },
     "actual_run_metadata": { "model": "sonnet-4.5", "duration_sec": 47, "passed_first_try": true }
   }
   ```

2. New agent `cmp-grader` (read-only: `Read, Glob, Grep, Bash`) takes a case + a fresh
   workflow run, compares actual vs expected, emits pass/fail with diff.

3. `eval/runner.sh` iterates all cases, runs each through current cmp agent set,
   reports `12/15 passed`. Baseline stored in `eval/baseline.json`.

4. CI hook on cmp repo PRs runs eval and blocks merge on regression.

## Why deferred to backlog

- Eval framework is meaningful only with a baseline. Without ≥10 historic runs, the
  baseline is fabricated and not predictive.
- Sonnet 4.5 in 2026-05 is the dominant model; eval value increases when comparing
  models (Sonnet 4.5 vs Haiku 4.5 vs Opus 4.7 vs whatever ships next).
- Building eval is ~2 weeks of work; reusing 10 historic real runs (each ~30 min) costs
  5 hours of usage — and produces a stronger baseline.

See `docs/ARCHITECTURE.md` → "Why each agent exists" and the project root `CHANGELOG.md`
for when this lands in cmp.
