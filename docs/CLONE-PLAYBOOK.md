# Clone playbook — reference → spec → phases → build → fit → fix

How to clone an existing Android app with mobile-pipeline so the build **converges to the reference**
instead of drifting. This closes the loop that, without it, let a real clone (MyMoney↔Monefy) diverge
in 7 ways before anyone noticed.

## The loop

```
/mp-spec --apk --graph (clone)              /mp --plan --phases     /mp --phase       /mp --fit
reference APK ─► [A.0 crawl] ─► spec bundle ───────► PHASE_NN plan ──► implement ──► built vs reference
 (+ Play +       install +      (+ per-STATE          (every screen     (one task     ├─ visual: LLM-judge
  screenshots)   drive device   fit checklist     anchored to its   at a time)    ├─ behavioural: acceptance/*.feature
                 vision-first:   + deviations           reference; LAST                ├─ suppress deviations.md
                 observed state  + screen↔ref↔state                                     └─ divergences → backlog SPECs
                 graph + per-     registry)             phase = Fit gate)             └─ fixed → Roborazzi golden (CI)
                 state shots
                 (empty+filled))
```

## Step by step

### 0. (optional, recommended) Let the crawler capture the reference for you
If you pass `--apk` at `--depth reference` (the clone default) **and a device/emulator is reachable**,
`/mp-spec` runs **Phase A.0 — a dynamic crawl** before anything else: it installs the APK, drives it
**vision-first** with a navigator → executor → reviewer trio, and builds an *observed* state graph with
screenshots. It auto-fills `input/screenshots/`, records transitions in `input/crawl/state-graph.json`,
and (with consent) **seeds synthetic data** to capture **populated** states — so you get real
empty *and* filled screens, not a partial hand-set. It is **additive**: no device or the APK won't run →
it silently falls back to the static path below. Force it with `--graph`, disable with `--no-graph`.
This is what makes "capture every state" automatic instead of manual.

### 1. Build the spec bundle (capture the reference faithfully)
`/mp-spec <screenshots_dir> --apk <app.apk> --play <play_url>` (clone mode; defaults to
`--depth reference`). Beyond the usual bundle it now produces, for a clone:
- `spec/fit/<Sxx>.md` — per-screen **visual + behavioural must-match** checklist, each grounded
  in its reference screenshot (`fit-checklist-author`).
- `spec/fit/registry.csv` — screen ↔ reference image ↔ FR/AC ↔ checklist, + a `built_capture_hint`.
- `spec/deviations.md` — the **intended-deviation ledger**: where you deliberately depart from the
  reference (an added feature, a changed threshold). The fit gate suppresses these — review it.

**Capture every state.** The business-analyzer reports `state_gaps[]` (states the app has but that
weren't screenshotted) and an `interactions[]` map (gestures, entry order, partial-vs-full overlays).
If Step 0 ran, the crawl has already closed most gaps (it observed the states first-hand, and observed
transitions overrode the navigation guesses with `source:observed` edges) — only states behind a wall
it flagged `needs_human` remain. Without a crawl, capture the missing empty/loading/error screenshot
yourself — a clone that never sees a state ships a wrong one. When the crawl captured empty *and* filled
states, `fit-checklist-author` writes a must-match block per state and a `registry.csv` row per
(screen, state), so `--fit` checks each state against its own real reference frame.

### 2. Turn the bundle into a phase plan
`/mp --plan --phases --bootstrap --from <bundle>/spec`. The `mp-phase-planner` writes
`docs/implementation_plan/PHASE_NN_*.md` (+ PROGRESS/00_overview) with content-addressed anchors.
For a clone it auto-adds, per screen, a **"Visual QA vs reference"** task, and appends a terminal
**Fit-gate** phase whose done-criteria is a clean `--fit`. (Ad-hoc features still use the
lightweight `/mp --plan` backlog board — the two coexist.)

### 3. Implement, one task at a time
`/mp --phase` repeatedly: it takes the next unchecked `TASK-NN.k`, synthesises a SPEC, runs
develop → review → test → verify, ticks the box, logs to PROGRESS. `/mp --check` validates
PROGRESS ↔ PHASE ↔ anchor consistency (and flags design drift).

### 4. Compare the build to the reference
`/mp --fit` (Android, clone): captures the built screens (Roborazzi output → screen-tour →
`adb screencap`), runs the multimodal `mp-fit-android`, and prints a per-screen fit score +
divergences. Each **unexplained** divergence (intended ones in `deviations.md` are suppressed) becomes
a backlog SPEC. Behavioural divergences it can't see in a static image are flagged
`behavioural_unverified` for the `acceptance/*.feature` arm.

### 5. Fix and re-compare (converge)
`/mp --feature --next` to implement each filed divergence SPEC, then re-run `/mp --fit`. Repeat
until the score meets your clone-done threshold and only `deviations.md` entries remain. Lock each
correct screen with a Roborazzi golden (CI then catches future drift).

## Definition of clone-done
- Every screen in `fit/registry.csv` compared; overall fit ≥ threshold.
- Every divergence either fixed or recorded in `deviations.md` with a rationale.
- Behavioural must-match rows covered by `acceptance/*.feature` (driven on device).
- Approved screens golden-locked (Roborazzi) so CI guards against regression.

## Why this exists
The pipeline used to capture business logic but never anchored each screen to a reference image and
never compared the built app to the reference — so a clone drifted silently. This loop makes
reference fit a first-class, verifiable gate. See `eval/clone-fit/` for the regression eval.

## Completeness gates (stage 5 — what stops a button being forgotten)

Three deterministic gates, one per pipeline stage:
- **Spec-time** — `spec-evaluator` Class 5 audits the crawl's element manifests against the
  inventory (unmatched affordance = blocker) and clone-strict escalates `orphan_screen` /
  `state_coverage_gap` to blockers; GATE 2 prints every coverage-gap list explicitly.
- **Plan-time** — `/mp --plan --phases` cross-checks that every `registry.csv` screen and every
  `FR-`/`US-` id from `traceability.csv` appears in ≥1 task; uncovered ids block the write until
  re-planned or explicitly deferred.
- **Build-time** — `/mp --fit` adds a structural element diff (built ui-dump vs
  `spec/fit/elements/<Sxx>.json`) ahead of the visual pass, and enforces `fitThreshold`
  (config, default 85) — below it, or with unexplained divergences, the clone is NOT done.

## Fidelity instrumentation (stage 6 — design that measures, not guesses)

- **Exact metrics** — `bounds-to-dp.sh` converts the crawl's element bounds into real dp
  (`bounds_dp`/`size_dp` per element, density from `adb shell wm density`); fit checklists quote
  numbers ("FAB 56×56dp"), not adjectives.
- **Objective pixel score** — `/mp --fit` Phase 2.5 runs `mp-pixel-diff.sh` (ImageMagick RMSE +
  heatmap into `build/fit/diff/`); the multimodal agent anchors `fit_score` to it and must
  justify big deviations. Graceful `tool_missing` when ImageMagick is absent.
- **Normalized captures** — both the crawl and `--fit` enable Android demo mode (fixed clock
  10:00, battery 100, wifi 4, no notifications) + `font_scale 1.0`, and record the AVD
  profile/density so both sides of the comparison shoot on the same canvas.
- **Real assets & fonts** — `apk-analyzer` Pass 7.5 extracts fonts (always) + launcher icon +
  notable raster drawables into `spec/assets/` with an extraction manifest. ⚠ Личное/учебное
  использование: ассеты принадлежат владельцу приложения — для публикации замените на свои.
- **Theme from ground truth** — Phase D writes `spec/design-tokens.json` (style analysis + APK
  exact overrides); copy it into the dev project as `.claude/mp/design-tokens.json` and the
  ui-designer generates `Color.kt`/`Type.kt` from it directly (Material Theme Builder remains
  the greenfield fallback only).
- **Row-by-row verdicts** — the fit agent walks every visual must-match row of
  `spec/fit/<Sxx>.md` and returns an explicit pass/fail/uncheckable per row; every fail maps to
  a divergence.
