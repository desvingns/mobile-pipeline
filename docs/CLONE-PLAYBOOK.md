# Clone playbook — reference → spec → phases → build → fidelity → fix

How to clone an existing Android app with mobile-pipeline so the build **converges to the reference**
instead of drifting. This closes the loop that, without it, let a real clone (MyMoney↔Monefy) diverge
in 7 ways before anyone noticed.

## The loop

```
/mp-spec (clone)         /mp --plan --phases        /mp --phase            /mp --fidelity
reference  ─────────►  spec bundle  ─────────►  PHASE_NN plan  ──────►  implement  ──────►  built vs reference
 (APK + Play +          (+ per-screen fidelity    (every screen        (one task        ├─ visual: LLM-judge
  screenshots)           checklist + deviations     anchored to its       at a time)      ├─ behavioural: acceptance/*.feature
                         + screen↔ref registry)     reference; LAST                       ├─ suppress deviations.md
                                                    phase = Fidelity gate)                 └─ divergences → backlog SPECs
                                                                                              └─ fixed → Roborazzi golden (CI)
```

## Step by step

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
When it flags a gap, capture the missing empty/loading/error screenshot — a clone that never sees a
state ships a wrong one.

### 2. Turn the bundle into a phase plan
`/mp --plan --phases --bootstrap --from <bundle>/spec`. The `mp-phase-planner` writes
`docs/implementation_plan/PHASE_NN_*.md` (+ PROGRESS/00_overview) with content-addressed anchors.
For a clone it auto-adds, per screen, a **"Visual QA vs reference"** task, and appends a terminal
**Fidelity-gate** phase whose done-criteria is a clean `--fidelity`. (Ad-hoc features still use the
lightweight `/mp --plan` backlog board — the two coexist.)

### 3. Implement, one task at a time
`/mp --phase` repeatedly: it takes the next unchecked `TASK-NN.k`, synthesises a SPEC, runs
develop → review → test → verify, ticks the box, logs to PROGRESS. `/mp --check` validates
PROGRESS ↔ PHASE ↔ anchor consistency (and flags design drift).

### 4. Compare the build to the reference
`/mp --fidelity` (Android, clone): captures the built screens (Roborazzi output → screen-tour →
`adb screencap`), runs the multimodal `mp-fidelity-android`, and prints a per-screen fidelity score +
divergences. Each **unexplained** divergence (intended ones in `deviations.md` are suppressed) becomes
a backlog SPEC. Behavioural divergences it can't see in a static image are flagged
`behavioural_unverified` for the `acceptance/*.feature` arm.

### 5. Fix and re-compare (converge)
`/mp --feature --next` to implement each filed divergence SPEC, then re-run `/mp --fidelity`. Repeat
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
