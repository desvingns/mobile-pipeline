# claude-009 — CI propagation: auto-regen plugins, validation workflow, scheduled reflect

OWNER: claude
STATUS: **AUTHORED; NOT committed; workflows not yet exercised on GitHub (first push = real validation).** (stage 4 of `docs/IMPROVEMENT-ROADMAP.md`)
PLAN: `C:\Users\k.shavrin\.claude\plans\generic-jumping-flame.md` (approved 2026-06-11)
ITEMS: A11, E5, A12 · User approved GitHub Actions + scheduled runs.

## Why
Improvements merged into `templates/` reach downstream projects only after someone remembers to
run `lib/build-marketplace.sh` and commit the plugin trees — the propagation half of the
self-improvement loop is manual (audit finding A11). Validation (bash -n, shellcheck,
leak-grep, plugin-drift) is likewise run by hand per session. Closing both makes a merged
improvement land in every project automatically (git-source marketplace) with quality gates.

## Scope
- **A11** — workflow `regen-plugins.yml`: on push to `main` touching `templates/**` or
  `lib/build-marketplace.sh` → run the generator → if `claude-plugins/`/`codex-plugins/`
  changed, commit them back (bot commit, `[skip ci]` guard against loops).
- **E5** — workflow `validate.yml` on every PR/push: `bash -n` over all `*.sh`, shellcheck,
  leak-grep (`{{…}}`, `<!-- platform:* -->`, `<!-- tool:* -->` in generated trees), JSON parse
  of marketplace manifests, and a drift check (regen into temp, diff vs committed plugins).
  Extend/absorb the existing validate-plugins workflow if present rather than duplicating.
- **A12** — scheduled reflection: document (and provide a sample workflow or host-side
  scheduled task) for weekly `/mp --reflect` over `~/.config/mobile-pipeline/projects.txt`;
  bootstrap/wire instructions gain "append this project to projects.txt" so the list stays
  fresh. (The reflect run itself needs a local harness — the deliverable is the schedule
  scaffold + docs, not a cloud LLM run.)

## Files
- `.github/workflows/regen-plugins.yml` (new), `.github/workflows/validate.yml` (new or
  extended — check for an existing `validate-plugins.yml` first).
- `docs/MARKETPLACE.md` — propagation section update (merge → auto-regen → projects pull).
- `selfimprove/README.md` + `docs/IMPROVEMENT-ROADMAP.md` tick — A12 schedule scaffold.

## Ownership / coordination
Workflows are ADDITIVE new files — `bootstrap.sh`, `lib/render.sh`, `lib/sync.sh` untouched
(codex-owned; lib/sync.sh remains codex-001). Flag in handoff: CI now regenerates plugins, so
codex must pull before regenerating locally to avoid commit races.

## Verify
- `act`-style local dry-run not required: validate by pushing to a branch and checking both
  workflows green; force a deliberate leak in a scratch branch → validate.yml fails.
- Drift check: hand-edit a generated plugin file on a branch → workflow flags drift.
- Bot-commit loop guard proven (second run is a no-op).

## Checklist
- [x] inventory existing CI — `validate-plugins.yml` already had manifests/bash-n/leaks/drift →
      EXTENDED it rather than duplicating
- [x] E5 validate workflow (bash -n widened to templates/selfimprove/eval/bootstrap/install-spec
      via existence-guarded loops; new `shellcheck -S error` step — error severity only, so the
      retrofit doesn't block on legacy warnings)
- [x] A11 `regen-plugins.yml` (push to main + paths filter on templates/** and the generator →
      regen → commit/push when drifted; `contents: write`; loop-guarded — the bot commit touches
      only generated trees, excluded by the filter; safety net for direct pushes, PRs stay gated
      by drift)
- [x] A12 schedule scaffold (selfimprove/README "Scheduling the loop": cron + schtasks examples
      for weekly host-side `/mp --reflect`; projects.txt upkeep as a wiring step — host-side
      because reflect needs a local harness, not cloud CI)
- [x] docs/MARKETPLACE.md (auto-regen safety net + extended CI gate + projects.txt setup step) +
      change-log entry (`2026-06-11T08:30-ci-propagation`) + CHANGELOG [Unreleased]
- [ ] first push to GitHub: watch validate-plugins (new shellcheck step may surface findings in
      legacy scripts — fix or relax to targeted excludes) and one templates-touching merge to
      confirm regen-plugins commits/no-ops correctly
- [ ] not committed (awaiting user go-ahead)
