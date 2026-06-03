# Eval: clone fit

Measures whether the clone loop (spec → phases → build → `--fit`) actually makes a build
**converge** to its reference — and guards the pipeline itself against regressing on that.

## Known reference fixture
`MyMoney ↔ Monefy v1.0` is the worked example:
- Reference: `D:\Pet\TDD_creater\MyMoney\input\screenshots` (+ `pipeline/*.md`, `MyMoney_TDD.md`).
- Build: `D:\Pet\TDD_creater\MyMoney_app` (the clone).
- Ground truth: the 7 documented divergences (left-drawer content, period selector location,
  empty-state donut, swipe semantics, amount-then-category order, full-window drawers,
  income-in-donut / balance bar / records drill-down) — authored as the
  `monefy-behavioral-fit` backlog after they were found by hand.

## What the eval checks
1. **Detection recall.** Run `mp-fit-android` over the MyMoney build vs the Monefy screenshots
   (with `deviations.md` listing the intended deviations, e.g. the range picker / 3% label
   threshold). It must independently re-derive the **visually-detectable** subset of the 7 known
   divergences (drawer width, period location, empty donut, income-in-donut, balance placement,
   partial drawers) as backlog SPECs — without flagging the intended deviations.
2. **No false positives on intended deviations.** Items in `deviations.md` appear under
   `acknowledged_deviations`, never as filed SPECs.
3. **Convergence (non-increasing divergences).** After the `monefy-behavioral-fit` fixes are
   applied, a re-run reports strictly fewer unexplained divergences. The eval fails if divergence
   count goes UP across iterations (a pipeline regression).
4. **Behavioural coverage.** The behavioural-only divergences (swipe, amount-then-category order) are
   reported as `behavioural_unverified` (not silently dropped, not falsely asserted from a static
   image).

## Running (manual, until automated)
1. Ensure built screenshots exist for the MyMoney screens (Roborazzi output or device capture).
2. Spawn `mp-fit-android` with the `screens[]` mapping (Monefy reference ↔ MyMoney built),
   `deviations: spec/deviations.md`.
3. Compare the returned `proposed_specs[]` against the 7-divergence ground truth above:
   recall on the visual subset, zero intended-deviation false positives.

## Eval: dynamic-crawl coverage (Phase A.0 / `--graph`)
Measures whether the **dynamic reference crawl** (install + drive the APK; see
`docs/REFERENCE-CRAWLER.md`) produces a materially better reference corpus than hand-collected
screenshots — the precondition for the fit checks above to be grounded in real states.

Run `/mp-spec --apk <ref.apk> --graph` on a clonable fixture (a throwaway AVD, **not** a live dev
device) and compare the bundle against a `--no-graph` (static) run of the same inputs:
1. **State-gap reduction.** `state_gaps[]` reported by the business-analyzer should be **strictly
   fewer** with the crawl (it observed the empty/loading/filled states first-hand) — ideally ~0 except
   states behind a `needs_human` wall.
2. **Observed-edge share.** In `navigation-flow-analyzer` output, the fraction of edges with
   `source:observed` (`confidence:1.0`) should be high; inferred guesses only for uncovered screens.
   The graph must contain **no** observed edge that contradicts a CTA in `02_business.md`.
3. **Populated-state capture.** With consent `seed`, at least one screen reaches `data_state:"filled"`
   and `fit/registry.csv` gains a per-(screen, state) row for both empty and filled — so `--fit`
   checks each state against its own frame.
4. **Determinism.** Two `--graph` runs on the same fixture (same synthetic fixtures, `pm clear` reset)
   produce the same set of states/screens (allowing list-content noise) — the corpus is reproducible.
5. **Safety.** No test credentials or synthetic secrets appear in any bundle artifact
   (`grep` the bundle for the fixture email/password → zero hits).
6. **Graceful degradation.** With no device (or an un-runnable APK) the run falls back to the static
   A-clone and still produces a valid bundle (`crawl.skipped` recorded in `00_meta.yaml`).

Suggested fixture: a small open-source Android app with an onboarding + a create flow (so `auth`/`seed`
goals exercise). MyMoney↔Monefy can serve once a throwaway AVD has the Monefy reference installed.

## Status
Fixture documented; harness automation is TODO (wire into the repo's eval runner). This README is the
spec for that harness — it pins what "the clone loop works" means so the pipeline can't quietly lose it.

> **Naming.** The reference-comparison concept is named **fit** throughout — the gate flag (`--fit`),
> this dir (`clone-fit`), the bundle dir (`spec/fit/`), the agents (`fit-checklist-author`,
> `mp-fit-android`), `fit_score`, and the Fit-gate phase. (Earlier releases used "fidelity"; renamed
> repo-wide — see `CHANGELOG`.)
