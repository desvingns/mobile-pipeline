# claude-004 — Dynamic reference-APK crawler for `/mp-spec` clone intake

OWNER: claude
STATUS: **Phase 1 IN PROGRESS** — device primitives + single vision-first executor + SKILL hook.
PLAN: `C:\Users\k.shavrin\.claude\plans\ai-steady-galaxy.md` (approved 2026-06-03).

## Why
The CLONE side of `/mp-spec` is fully static: hand-collected screenshots, *inferred* gestures
(`interactions[]`), *flagged-but-uncaptured* states (`state_gaps[]`), *guessed* nav edges
(`confidence 0.6–0.95`), and an unzip-only `apk-analyzer`. Result: shallow spec, hand-tuned UI.
This task adds a **dynamic exploration loop** — install the reference APK, drive it vision-first,
build a state-graph + screenshot corpus, then feed it to the existing analyzers as high-confidence
*observed* evidence. Additive: the static path keeps working when there is no device / the APK won't run.

## Seam (the key design)
The crawler is an upstream producer: it **fills `input/screenshots/`** (the slot the analyzers already
read) and writes **one** new optional file `input/crawl/state-graph.json`. Existing analyzers gain only
an *optional* input that upgrades confidence — no breaking edits.

## Phasing
- **Phase 1 (this):** 5 device scripts + 1 `crawl-executor` agent doing autonomous vision-first BFS
  (depth ~2–3) with state dedup. No trio, no seeding. SKILL Step 0 (`--graph`) + Step 2.0. Prove the
  corpus beats hand-collected screenshots on one real app.
- **Phase 2:** split into navigator/executor/reviewer + coverage gate + loop-until-dry; wire observed
  edges into `navigation-flow-analyzer`.
- **Phase 3:** autonomous seeding (auth/forms) + guardrails (forbidden actions) + `needs_human`.
- **Phase 4:** feed `fit-checklist-author` real per-state frames; auto-enable on `--depth reference`.

## Files (Phase 1)
- `templates/spec/skills/app-spec-creator/scripts/crawl/_crawl-lib.sh` — shared adb resolve + json_escape + die.
- `…/scripts/crawl/{device-preflight,app-control,screencap,ui-dump,input}.sh` — device primitives,
  cross-platform bash, one JSON line each (mirror `mp-runner-android.sh` conventions).
- `templates/spec/agents/crawl-executor.md` — vision-first BFS driver (Read+Write+Bash, opus).
- `templates/spec/skills/app-spec-creator/SKILL.md` — Step 0 `--graph/--no-graph` + new Step 2.0.
- `templates/spec/skills/app-spec-creator/prompts/questions/clone.crawl-setup.md` — device/consent Qs.
- Shipping: add scripts copy to `lib/build-marketplace.sh` (claude-owned) **and** `install-spec.sh`
  (shared); add `crawl-executor` row to the `install-spec.sh` AGENTS table.

## Ownership / coordination (re: codex-001)
- I do **not** touch `lib/render.sh`, `lib/sync.sh`, `bootstrap.sh`, or `.codex/` (codex-owned).
- `lib/build-marketplace.sh` is claude-owned → safe to edit.
- `install-spec.sh` is shared; my edits are additive (`cp -r scripts` next to the existing `cp -r
  prompts`; one AGENTS-table row). Flagged in handoff for codex awareness.
- New device scripts touch the "bash scripts must be path-neutral" concern codex verifies → they take
  no install-path assumptions; the orchestrator passes `scripts_dir` + `crawl_dir` as runtime args, and
  scripts rely on `$ANDROID_SERIAL` (adb-native) rather than hard-coded serials.

## Verify (Phase 1)
- `bash -n` + `shellcheck` clean on every new `scripts/crawl/*.sh`.
- Dry-run `lib/build-marketplace.sh --dry-run` + `install-spec.sh --dry-run` show the scripts copy.
- Leak grep on regenerated plugin: no `{{…}}` / `<!-- tool:* -->` in rendered `crawl-executor`.
- Manual device smoke (user has an emulator from `--fit`): preflight → install → screencap → ui-dump →
  input tap; each prints exactly one valid JSON line.

## Checklist (Phase 1)
- [x] `_crawl-lib.sh` + 5 device scripts authored, `bash -n` clean (shellcheck not installed locally → CI)
- [x] `crawl-executor.md` agent authored
- [x] SKILL Step 0 + Step 2.0 wired (behind `--graph`, auto on `--apk`+device, graceful skip)
- [x] `clone.crawl-setup.md` prompt
- [x] build-marketplace.sh + install-spec.sh ship the scripts; crawl-executor in AGENTS table
- [x] CHANGELOG [Unreleased] + change-log entry + memory memo + handoff rewrite
- [x] lint + dry-run + isolated install verification; bounds-resolution unit test (540,2040 ✓); plugins regenerated, 0 leaks
- [x] **device smoke** on a real emulator (emulator-5554, Android 34): preflight/current/screencap/
      ui-dump/input(key,swipe,tap-xy,tap-by-text) all return valid JSON; `tap --text "Chrome"` →
      foreground became Chrome (full hybrid path proven). **Fixed 3 bugs the offline tests missed:**
      MSYS `/sdcard` path mangling (ui-dump → `MSYS_NO_PATHCONV` + `exec-out cat` redirect); `--clickable`
      too strict for Compose (resolve_center → prefer-clickable-then-fallback); `launch` now confirms
      foreground + retries. ui-dump now reports `clickable`/`clickable_labeled` + smarter `compose_degenerate`.
- [ ] real `/mp-spec --apk … --graph` A/B vs static on one app (needs the reference APK installed; the
      emulator is the user's live MyMoney dev device — coordinate before installing/clearing apps on it)
- [ ] not committed (awaiting user go-ahead)

STATUS: **Phase 1 code-complete & device-validated (primitives proven on hardware, 3 bugs fixed); full
APK A/B + commit pending.** Plugins regenerated with the fixed scripts.

## Phase 2 — agent trio + coverage gate (authored)
- New `templates/spec/agents/crawl-navigator.md` (sonnet, read-only) — picks the next affordance +
  replay path, decides `done`.
- New `templates/spec/agents/crawl-reviewer.md` (opus, multimodal, read-only) — classifies the edge
  (flow|cycle|error|dead_end), judges `success_test`, scores `coverage_confidence`, gates accept/continue.
- `crawl-executor.md` refactored → goal-scoped (relaunch → replay path → one affordance → capture+dedup).
- `SKILL.md` Step 2.0 rewritten as the orchestrator-owned loop: navigator → (executor⇄reviewer, ≤2
  retries) → merge into `state-graph.json` → update `coverage.md`; stop on done/plateau(K=4)/budget.
  Finalize records `screenshot_file` per node (the `ST*`→`S*` bridge).
- `navigation-flow-analyzer.md` consumes the optional `state-graph.json` → observed edges
  (`source:observed`, confidence 1.0) override inferred ones; map crawl→business by `screenshot_file`.
- `install-spec.sh` AGENTS table gains crawl-navigator + crawl-reviewer; plugins regenerated, 0 leaks,
  `bash -n` clean, dry-run roster shows all 3 crawl agents.
- [ ] device-validate the full trio loop on an emulator with a real reference APK (throwaway AVD —
      not the user's live MyMoney device); confirm state-graph.json + coverage.md + observed edges.
- [ ] Phase 3 (autonomous seeding: auth/forms + guardrails + needs_human), Phase 4 (fit frames).

STATUS (Phase 2): **authored, builds/lints clean, 0 leaks; trio loop not yet run end-to-end on a device.**

## Phase 3 — autonomous seeding + auth (authored)
- `crawl-navigator.md` — emits `auth` (pass a sign-in/onboarding wall — unblock before breadth) and
  `seed` (create entries to reveal a populated state) goals, plus the existing `explore`.
- `crawl-executor.md` — branches on `goal.type`: auth = fill+submit (user `credentials` if provided,
  else synthetic, detect verification walls); seed = open create flow + create `count` synthetic entries
  + capture `data_state:"filled"`. Added a deterministic ASCII synthetic-data fixture set; strengthened
  guardrails (synthetic only; no real-money/send/share; OTP/captcha → `blocker:needs_human`).
- `crawl-reviewer.md` — judges auth/seed success from the after-shot; `needs_human` blocker → accept+prune.
- `clone.crawl-setup.md` — Phase-3 consent (seed | explore-only | decline) + optional TEST credentials.
  **Security: credentials are runtime-only — never written to meta/trace/session/bundle.**
- `SKILL.md` Step 2.0 — collects consent/creds up front, passes `credentials` to the executor for auth
  goals; the loop now drives explore/auth/seed goals. No new agents/scripts; plugins regenerated, 0 leaks.
- [ ] device-validate auth + seed end-to-end on a throwaway AVD with a real reference app (login flow +
      a create flow); confirm a `data_state:"filled"` node + credentials never landing in artifacts.
- [ ] Phase 4 (feed `fit-checklist-author` the real per-state frames; auto-enable on depth reference).

STATUS (Phase 3): **authored, builds/lints clean, 0 leaks; seeding/auth not yet run on a device.**

## Phase 4 — close the clone loop (authored)
- `fit-checklist-author.md` — optional `crawl_graph` + `crawl_states_dir` inputs; grounds per-screen
  must-match in the OBSERVED per-state frames (empty AND filled), one `registry.csv` row per (screen,
  state) with a `data_state` column → `--fit` checks each state vs its own real reference frame.
- `SKILL.md` Step 7 — passes the crawl inputs to the fit author when A.0-crawl ran.
- `docs/CLONE-PLAYBOOK.md` — Step 0 (crawl front-door) + updated loop diagram + auto-state-capture note.
- `docs/REFERENCE-CRAWLER.md` — NEW maintainer doc consolidating the subsystem.
- Auto-enable on `--depth reference` was already wired in Phase 1. No new agents/scripts; plugins
  regenerated, 0 leaks.
- [ ] device-validate the full clone loop end-to-end (crawl → spec w/ per-state fit → build → --fit)
      on a throwaway AVD with a real reference app.

STATUS (Phase 4): **authored, builds/lints clean, 0 leaks.**

## Overall — crawler feature-complete (Phases 1–4 authored)
Phase 1 device-validated on hardware (3 bugs fixed). Phases 2–4 authored, build/lint/0-leak clean, but
the full trio loop + auth/seed + per-state fit have NOT been run end-to-end on a device. Not
committed (codex mp-dev-bridge WIP also in the tree — commit deliberately). Next real step is a
throwaway-AVD end-to-end run on a clonable app; expect replay/seeding rough edges like Phase 1 surfaced.
