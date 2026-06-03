---
name: reference-crawler
description: "Dynamic reference-APK crawler for /mp-spec clone intake — install + drive the reference app vision-first to build a state graph with screenshots, replacing the static (inferred/guessed) clone evidence. The seam, the dedup invariant, and the 4-phase plan."
metadata:
  node_type: memory
  type: project
---

The CLONE side of `/mp-spec` was fully static: hand-collected screenshots, *inferred* gestures
(`interactions[]`), *flagged-but-uncaptured* states (`state_gaps[]`), *guessed* nav edges
(`confidence 0.6–0.95`), and an unzip-only `apk-analyzer`. That ceilings spec depth and UI fidelity.
The crawler observes the **running** reference instead of guessing about it.

**Why this design (not a parallel spec path):** the crawler is an *upstream producer*. It **fills
`input/screenshots/`** — the slot `screenshot-business-analyzer` + `screenshot-style-analyzer` already
read — and writes **one** new optional file `input/crawl/state-graph.json`. So existing analyzers gain
only an *optional* input that upgrades confidence; the static path keeps working unchanged when there
is no device or the APK won't run. Lives in `/mp-spec` (clone intake) as **Phase A.0**, because the
output is a richer spec — see [[change-log-discipline]] for how the agent/script edits propagate.

**The make-or-break invariant — state identity / dedup.** Without it the crawl loops forever. State
signature = `foreground-activity | sorted distinct (text= , resource-id=) values from the uiautomator
dump`. Compose apps render one `AndroidComposeView` with a near-empty dump (`compose_degenerate`) →
then drive **vision-first** (LLM picks the tap from the screenshot; the dump only resolves exact tap
bounds and dedup signatures, never the decision). Edge identity = `(from_sig, action) → to_sig`.

**How to apply / extend:**
- Device primitives live in `templates/spec/skills/app-spec-creator/scripts/crawl/*.sh` — cross-platform
  bash, one JSON line each, target `$ANDROID_SERIAL` (adb-native), no install-path assumptions. Both
  installers + `lib/build-marketplace.sh` copy `scripts/` into the skill; the orchestrator passes
  `scripts_dir` to the `crawl-executor` agent at runtime (so agents carry no hard-coded install path).
- **Device-validated gotchas (found on a real emulator, Android 34 — `bash -n` can't catch these):**
  - **MSYS path mangling.** On Windows Git Bash, a POSIX-looking arg like `/sdcard/window_dump.xml`
    passed to `adb.exe` is rewritten to a Windows path. Fix: `export MSYS_NO_PATHCONV=1` for the
    device-path arg, and pull via `adb exec-out cat "$DEV" > "$OUT"` (bash redirect — keeps the LOCAL
    dest from being an adb arg). Do **not** use the blunt `MSYS2_ARG_CONV_EXCL='*'` — it also stops the
    local destination from converting, so `adb pull <dev> <local>` writes nowhere.
  - **Compose uiautomator pattern.** A Compose screen's clickable node is usually an anonymous `View`
    with empty text; the visible label is a *separate non-clickable* node. So `--clickable`-only tap
    resolution finds nothing — PREFER clickable, else fall back to any text match (tapping the label's
    centre hits the clickable parent). `compose_degenerate` must consider `clickable_labeled==0`, not
    just node count. Hence the design's vision-first stance is mandatory, not optional.
  - **Verify launches.** `monkey -c LAUNCHER` can no-op (e.g. app not installed); `app-control.sh
    launch` polls the foreground and retries, returning `ok:false` rather than a false success.
- Full crawl autonomy is the chosen direction → guardrails are mandatory: the `crawl-executor` spec
  hard-codes a forbidden-action list (no real-money IAP / send / logout / destructive confirmations)
  and degrades gracefully (`needs_human` on OTP/captcha walls; fall back to static if the APK won't run).
- **Phase 3 seeding/auth decisions (durable):** synthetic fixtures are **deterministic + ASCII** (adb
  `input text` mangles non-Latin) so re-runs reproduce the same corpus. Test credentials are
  **runtime-only** — the orchestrator collects them in-session and passes them to the executor for auth
  goals; they must NEVER be written to `00_meta.yaml`, `trace.jsonl`, `session.md`, the bundle, or any
  committed file. Self-registration is attempted only when no credentials are given, and verification
  walls (SMS/email OTP, captcha) are impassable → `needs_human`, prune the branch.
- Phasing (de-risk first): **1** scripts + single vision-first BFS executor (DONE — `claude-004`);
  **2** navigator/executor/reviewer trio + coverage gate + wire observed edges into
  `navigation-flow-analyzer`; **3** autonomous seeding (auth/forms); **4** feed
  `fidelity-checklist-author` real per-state frames. Each phase ships independently.
- Plan: `C:\Users\k.shavrin\.claude\plans\ai-steady-galaxy.md`. Task: `.ai/tasks/claude-004-reference-crawler.md`.
- shellcheck was NOT run locally (not installed on this Windows host); `bash -n` is clean — rely on the
  `validate-plugins.yml` CI gate or run shellcheck before release.
