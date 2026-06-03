# Clone playbook — reference → spec → phases → build → fidelity → fix

How to clone an existing Android app with mobile-pipeline so the build **converges to the reference**
instead of drifting. This closes the loop that, without it, let a real clone (MyMoney↔Monefy) diverge
in 7 ways before anyone noticed.

## The loop

```
/mp-spec --apk --graph (clone)              /mp --plan --phases     /mp --phase       /mp --fit
reference APK ─► [A.0 crawl] ─► spec bundle ───────► PHASE_NN plan ──► implement ──► built vs reference
 (+ Play +       install +      (+ per-STATE          (every screen     (one task     ├─ visual: LLM-judge
  screenshots)   drive device   fidelity checklist     anchored to its   at a time)    ├─ behavioural: acceptance/*.feature
                 vision-first:   + deviations           reference; LAST                ├─ suppress deviations.md
                 observed state  + screen↔ref↔state                                     └─ divergences → backlog SPECs
                 graph + per-     registry)             phase = Fidelity gate)             └─ fixed → Roborazzi golden (CI)
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
- `spec/fidelity/<Sxx>.md` — per-screen **visual + behavioural must-match** checklist, each grounded
  in its reference screenshot (`fidelity-checklist-author`).
- `spec/fidelity/registry.csv` — screen ↔ reference image ↔ FR/AC ↔ checklist, + a `built_capture_hint`.
- `spec/deviations.md` — the **intended-deviation ledger**: where you deliberately depart from the
  reference (an added feature, a changed threshold). The fidelity gate suppresses these — review it.

**Capture every state.** The business-analyzer reports `state_gaps[]` (states the app has but that
weren't screenshotted) and an `interactions[]` map (gestures, entry order, partial-vs-full overlays).
If Step 0 ran, the crawl has already closed most gaps (it observed the states first-hand, and observed
transitions overrode the navigation guesses with `source:observed` edges) — only states behind a wall
it flagged `needs_human` remain. Without a crawl, capture the missing empty/loading/error screenshot
yourself — a clone that never sees a state ships a wrong one. When the crawl captured empty *and* filled
states, `fidelity-checklist-author` writes a must-match block per state and a `registry.csv` row per
(screen, state), so `--fit` checks each state against its own real reference frame.

### 2. Turn the bundle into a phase plan
`/mp --plan --phases --bootstrap --from <bundle>/spec`. The `mp-phase-planner` writes
`docs/implementation_plan/PHASE_NN_*.md` (+ PROGRESS/00_overview) with content-addressed anchors.
For a clone it auto-adds, per screen, a **"Visual QA vs reference"** task, and appends a terminal
**Fidelity-gate** phase whose done-criteria is a clean `--fit`. (Ad-hoc features still use the
lightweight `/mp --plan` backlog board — the two coexist.)

### 3. Implement, one task at a time
`/mp --phase` repeatedly: it takes the next unchecked `TASK-NN.k`, synthesises a SPEC, runs
develop → review → test → verify, ticks the box, logs to PROGRESS. `/mp --check` validates
PROGRESS ↔ PHASE ↔ anchor consistency (and flags design drift).

### 4. Compare the build to the reference
`/mp --fit` (Android, clone): captures the built screens (Roborazzi output → screen-tour →
`adb screencap`), runs the multimodal `mp-fidelity-android`, and prints a per-screen fidelity score +
divergences. Each **unexplained** divergence (intended ones in `deviations.md` are suppressed) becomes
a backlog SPEC. Behavioural divergences it can't see in a static image are flagged
`behavioural_unverified` for the `acceptance/*.feature` arm.

### 5. Fix and re-compare (converge)
`/mp --feature --next` to implement each filed divergence SPEC, then re-run `/mp --fit`. Repeat
until the score meets your clone-done threshold and only `deviations.md` entries remain. Lock each
correct screen with a Roborazzi golden (CI then catches future drift).

## Definition of clone-done
- Every screen in `fidelity/registry.csv` compared; overall fidelity ≥ threshold.
- Every divergence either fixed or recorded in `deviations.md` with a rationale.
- Behavioural must-match rows covered by `acceptance/*.feature` (driven on device).
- Approved screens golden-locked (Roborazzi) so CI guards against regression.

## Why this exists
The pipeline used to capture business logic but never anchored each screen to a reference image and
never compared the built app to the reference — so a clone drifted silently. This loop makes
reference fidelity a first-class, verifiable gate. See `eval/clone-fidelity/` for the regression eval.
