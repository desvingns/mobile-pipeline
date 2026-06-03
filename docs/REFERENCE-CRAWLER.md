# Reference-APK crawler (`/mp-spec` Phase A.0)

The dynamic clone front-door: install a reference APK on a device and **drive it** to build an observed
state graph with screenshots — replacing the static path's *guessed* navigation, *inferred* gestures,
and *uncaptured* states with first-hand evidence. Additive: with no device or an un-runnable APK,
`/mp-spec` silently falls back to the static A-clone. See `CLONE-PLAYBOOK.md` for the end-user loop and
`.ai/memory/reference-crawler.md` for the durable design notes.

## When it runs
Auto-enabled when `--apk` is given AND `--depth reference` (the clone default) AND
`device-preflight.sh` finds a booted device. `--graph` forces it (asks for a device if none); `--no-graph`
disables it. The device is the user's own emulator/throwaway AVD — never a production device or account.

## The seam (why it doesn't fork the pipeline)
The crawler is an **upstream producer**. It fills `input/screenshots/` — the slot the analyzers already
read — and writes one new file, `input/crawl/state-graph.json`. Downstream agents change only by gaining
an *optional* input that upgrades confidence:
- `navigation-flow-analyzer` converts walked transitions to `source:observed` / `confidence:1.0` edges
  (mapping crawl `ST*` → business `S*` via the shared `screenshot_file`), inferring only the rest.
- `fidelity-checklist-author` grounds per-screen, **per-state** must-match checklists in the real
  empty/filled frames and emits a `registry.csv` row per (screen, state) for the `--fit` gate.

## The trio (separate sessions — state lives in files, never a shared context)
The orchestrator (the skill's main session) owns a file-persisted loop over three single-purpose agents:

| Agent | Model | Role |
|---|---|---|
| `crawl-navigator` | sonnet, read-only | Plans the next step: pick an untried affordance + its replay path; emit `auth`/`seed`/`explore` goals (unblock before breadth); decide `done`. |
| `crawl-executor` | opus, Read+Write+Bash | Drives the device vision-first: relaunch → replay path → perform the goal (explore one affordance / fill+submit auth / create N synthetic entries) → capture + dedup. |
| `crawl-reviewer` | opus, multimodal, read-only | Classifies the edge (flow/cycle/error/dead_end), judges the `success_test` from the screenshots, scores coverage confidence, gates accept vs continue, flags `needs_seeding`/`needs_human`. |

Loop: `navigator → (executor ⇄ reviewer, ≤2 retries — mirrors the Phase F evaluator-optimizer) → merge
→ coverage`, stopping on `done` / coverage plateau (K=4 iters, no new state) / budget (`40/25/60`).

## Device primitives (`skills/app-spec-creator/scripts/crawl/*.sh`)
Cross-platform bash, one JSON line each, target `$ANDROID_SERIAL`, no install-path assumptions (the
orchestrator passes `scripts_dir` at runtime). `_crawl-lib.sh` (adb resolve + json_escape + die),
`device-preflight.sh`, `app-control.sh` (install/clear/launch-with-confirm/stop/current),
`screencap.sh`, `ui-dump.sh` (reports `clickable`/`clickable_labeled`/`compose_degenerate`),
`input.sh` (tap by `--text`/`--id`/`--desc`/`--xy`, text, swipe, key).

## Artifacts (`<bundle>/input/crawl/`)
`trace.jsonl` (append-only action log), `states/ST*.png` + `ST*.xml` (raw per-state capture),
`state-graph.json` (+ `.mmd`), `coverage.md`, `session.md`. Representative frames are copied to
`input/screenshots/NN.png` at finalize, with `screenshot_file` recorded on each node (the `ST*`→`S*` bridge).

## State identity (the make-or-break)
Signature = `foreground-activity | sorted distinct ≤20 (node text= and resource-id=)`. Dedup against it
ends loops. Compose renders one anonymous `AndroidComposeView` with the label on a *separate*
non-clickable node → the dump is `compose_degenerate`; drive **vision-first** and tap by visible label
(its centre hits the clickable parent) or normalized `--xy`.

## Autonomy, guardrails, security
Full autonomy with hard rails: synthetic data only (deterministic ASCII fixtures → reproducible corpus);
no real-money purchase / send / share / logout / destructive confirmation; SMS/email-OTP/captcha walls →
`blocker:needs_human` (accept-and-prune, no retry). Optional **test credentials** are **runtime-only** —
held in the orchestrator session, passed to the executor for auth goals, and **never written** to
`00_meta.yaml`, `trace.jsonl`, `session.md`, the bundle, or any committed file.

## Build & device gotchas (validated on a real emulator, Android 34)
- **Git Bash (MSYS)** rewrites a POSIX `/sdcard/...` arg before it reaches `adb.exe`. `ui-dump.sh`
  sets `MSYS_NO_PATHCONV=1` and pulls via `adb exec-out cat "$DEV" > "$OUT"` (a bash redirect, so the
  local dest isn't an adb path arg). Do **not** use `MSYS2_ARG_CONV_EXCL='*'` — it also breaks the local arg.
- **`monkey -c LAUNCHER` can no-op** (e.g. app not installed); `app-control.sh launch` polls the
  foreground + retries, returning `ok:false` honestly.
- shellcheck is not installed on the dev host; rely on the `validate-plugins.yml` CI gate.

## Phasing (delivered incrementally, each ships independently)
1. Device primitives + single vision-first BFS executor (device-validated; MSYS/Compose/launch bugs fixed).
2. The trio + coverage gate + observed edges into `navigation-flow-analyzer`.
3. Autonomous seeding + auth + guardrails + `needs_human` degradation.
4. Real per-state frames → `fidelity-checklist-author`; auto-enable on `--depth reference` (this doc).

Status & open items: `.ai/tasks/claude-004-reference-crawler.md`.
