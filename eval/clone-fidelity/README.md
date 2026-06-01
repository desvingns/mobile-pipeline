# Eval: clone fidelity

Measures whether the clone loop (spec → phases → build → `--fidelity`) actually makes a build
**converge** to its reference — and guards the pipeline itself against regressing on that.

## Known reference fixture
`MyMoney ↔ Monefy v1.0` is the worked example:
- Reference: `D:\Pet\TDD_creater\MyMoney\input\screenshots` (+ `pipeline/*.md`, `MyMoney_TDD.md`).
- Build: `D:\Pet\TDD_creater\MyMoney_app` (the clone).
- Ground truth: the 7 documented divergences (left-drawer content, period selector location,
  empty-state donut, swipe semantics, amount-then-category order, full-window drawers,
  income-in-donut / balance bar / records drill-down) — authored as the
  `monefy-behavioral-fidelity` backlog after they were found by hand.

## What the eval checks
1. **Detection recall.** Run `mp-fidelity-android` over the MyMoney build vs the Monefy screenshots
   (with `deviations.md` listing the intended deviations, e.g. the range picker / 3% label
   threshold). It must independently re-derive the **visually-detectable** subset of the 7 known
   divergences (drawer width, period location, empty donut, income-in-donut, balance placement,
   partial drawers) as backlog SPECs — without flagging the intended deviations.
2. **No false positives on intended deviations.** Items in `deviations.md` appear under
   `acknowledged_deviations`, never as filed SPECs.
3. **Convergence (non-increasing divergences).** After the `monefy-behavioral-fidelity` fixes are
   applied, a re-run reports strictly fewer unexplained divergences. The eval fails if divergence
   count goes UP across iterations (a pipeline regression).
4. **Behavioural coverage.** The behavioural-only divergences (swipe, amount-then-category order) are
   reported as `behavioural_unverified` (not silently dropped, not falsely asserted from a static
   image).

## Running (manual, until automated)
1. Ensure built screenshots exist for the MyMoney screens (Roborazzi output or device capture).
2. Spawn `mp-fidelity-android` with the `screens[]` mapping (Monefy reference ↔ MyMoney built),
   `deviations: spec/deviations.md`.
3. Compare the returned `proposed_specs[]` against the 7-divergence ground truth above:
   recall on the visual subset, zero intended-deviation false positives.

## Status
Fixture documented; harness automation is TODO (wire into the repo's eval runner). This README is the
spec for that harness — it pins what "the clone loop works" means so the pipeline can't quietly lose it.
