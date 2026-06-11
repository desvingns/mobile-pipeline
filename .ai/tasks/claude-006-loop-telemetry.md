# claude-006 — Learning loop: automatic telemetry, retro & drain nudges, post-ship feedback

OWNER: claude
STATUS: **AUTHORED + validated (scripts tested in a temp root); NOT committed; not yet observed in a live `/mp` session.** (stage 1 of `docs/IMPROVEMENT-ROADMAP.md`)
PLAN: `C:\Users\k.shavrin\.claude\plans\generic-jumping-flame.md` (approved 2026-06-11)
ITEMS: A1, A2, A3, A4, E8

## Why
The self-improvement chain exists end-to-end (record-run.sh → reflect.sh → REFLECTION-PROMPT →
mp-knowledge → mp-improve → --drain → PR) but nothing FEEDS it and nothing NUDGES it:
`selfimprove/record-run.sh` is never invoked by the orchestrator, `reflect.sh` and
`--improve --drain` are flags the user must remember, and the only signal is pass/fail — the
user's actual satisfaction is never captured. Result: `runs/*.jsonl` stays empty and the loop
never closes (audit finding, goal 1).

## Scope
- **A1** — orchestrator (`templates/common/commands/{{PREFIX}}.md`) invokes `record-run.sh`
  after each structured-payload step (runner, reviewer, verifier, fit) with the step verdict.
  Generated projects get the selfimprove kit wired, not just shipped.
- **A2** — run counter (derived from `runs/*.jsonl` line count vs last retro marker): at ≥10
  unreflected runs the orchestrator offers (or runs) `selfimprove/reflect.sh` and surfaces the
  retro summary.
- **A3** — at session end, if `.ai/proposals/` in the mobile-pipeline repo holds ≥3 queued
  proposals, the post-ship Knowledge step prints a drain nudge with the exact
  `/mp --improve --drain` command.
- **A4** — post-ship feedback: ONE question after `--feature` ("matches what you wanted? 1–5 +
  optional note") recorded as a run event + appended to `selfimprove/lessons.md` when <4.
- **E8** — run events gain `tokens_in/tokens_out/cost_estimate` fields (best-effort estimates),
  so retros can report what a feature cost.

## Files
- `templates/common/commands/{{PREFIX}}.md` — step hooks, run counter, feedback question, drain nudge.
- `selfimprove/record-run.sh` — accept new event fields (verdict source, feedback, tokens).
- `selfimprove/reflect.sh` / `REFLECTION-PROMPT.md` — consume the new fields.
- `templates/common/agents/{{PREFIX}}-knowledge.md` — read the feedback score as a lesson signal.
- Regenerate plugins via `lib/build-marketplace.sh`.

## Ownership / coordination
No codex-owned files (`lib/render.sh`, `lib/sync.sh`, `bootstrap.sh`, `.codex/`). The
selfimprove kit is claude-owned; orchestrator edits propagate to codex via the normal
change-log entry + plugin regen.

## Verify
- `bash -n` + shellcheck on touched scripts; plugins regenerate with 0 `{{…}}`/tool-marker leaks.
- Sandbox project dry-run: one `/mp --bugfix` run appends ≥3 events to `runs/*.jsonl`
  (developer/runner/verifier) + 1 feedback event; 10 synthetic events trigger the retro offer.
- Credentials/PII check: events carry verdicts and counters only, no SPEC bodies.

## Checklist
- [x] A1 step hooks in orchestrator ("Run telemetry" section + record points after reviewer /
      final-runner / verifier / fit) + NEW `{{PREFIX}}-record-run.sh` pipeline script (the kit's
      record-run ported to ship with the plugin; resolves repo root via git, fire-and-forget JSON)
- [x] A2 run counter + retro offer (`retro_due` in record-run output, threshold `$REFLECT_AFTER`
      default 10, resets via newest `retro-*.md`; NEW `{{PREFIX}}-retro.sh` per-project aggregator)
- [x] A3 drain nudge (post-ship step 3: count `mp_repo/.ai/proposals/*.patch`, ≥3 → suggest
      `--improve --drain`)
- [x] A4 feedback question + lessons routing (post-ship step 1: one score-1–5 question →
      `agent=feedback` event; ≤3 → bullet in `selfimprove/lessons.md` + into SESSION_RECAP;
      `{{PREFIX}}-knowledge` input contract updated)
- [x] E8 token/cost fields (`--tokens-in/--tokens-out/--cost` in both record-run scripts; totals
      section in both retro/reflect aggregators)
- [x] change-log entry (`2026-06-11T05:30-loop-telemetry-feedback`) + CHANGELOG [Unreleased] +
      plugins regenerated, 0 leaks, generated scripts `bash -n` clean (shellcheck → CI)
- [x] script validation in a temp root: 11 events → `retro_due:true`; retro file has pass-rate +
      feedback + token sections; post-retro counter resets to 0; bad/missing args → `ok:false`
      exit 0; root-kit parity verified the same way
- [ ] observe one live `/mp --feature` run end-to-end (events appear, feedback recorded, nudges
      fire) — first real session on a wired project
- [ ] not committed (awaiting user go-ahead)
