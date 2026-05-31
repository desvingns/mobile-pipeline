---
id: rubrics/nfr-categories
version: 1.0.0
inputs: [feature_inventory, posture_answers, design_md]
outputs: [nfr.md]
model: sonnet
owner_agent: nfr-analyzer
tags: [nfr, performance, reliability, security, a11y, neutral, spec-layer]
platform: neutral
---

# NFR categories rubric

Write **Non-Functional Requirements** in EARS style. Every NFR must carry a **measurable threshold** (number + unit). A statement without a metric is invalid and must be reformulated or dropped.

## Required categories and mandatory metrics

| Category | ID prefix | Mandatory thresholds to include |
|---|---|---|
| Performance — startup | NFR-P | Cold start ≤ N ms (measured from process start to first interactive frame); warm start ≤ M ms |
| Performance — rendering | NFR-P | Frame budget ≤ 16 ms (60 fps) on target device tier; list scroll jank ≤ 1 dropped frame per 300 ms window |
| Performance — network | NFR-P | Key-screen data load ≤ N ms on 4G (define 4G as ≥ 10 Mbps / ≤ 50 ms RTT) |
| Reliability / offline | NFR-R | Crash-free session rate ≥ X % (instrument via crash reporter); offline read coverage: N % of features available without connectivity; write queue survives process kill |
| Battery / data | NFR-B | Background battery drain ≤ X mAh/hr (no foreground service unless user-initiated); data transferred per session ≤ N MB on default quality settings |
| App size | NFR-S | Install size ≤ N MB (download); on-disk footprint ≤ M MB after first launch |
| Security baselines | NFR-SEC | TLS 1.2+ enforced on all network calls; secrets never written to shared preferences in plaintext; auth token TTL ≤ N hours |
| Scalability | NFR-SC | Local data store handles ≥ N records without perceptible degradation (list render ≤ M ms); pagination / virtual scroll required above P items |

## Rules

- **"No metric → invalid."** Every NFR body must end with a parenthesised threshold: `(threshold: ≤ 300 ms on mid-range device)`.
- IDs: `NFR-P-001`, `NFR-R-001`, `NFR-B-001`, `NFR-S-001`, `NFR-SEC-001`, `NFR-SC-001` (category infix, zero-padded).
- EARS pattern: prefer `THE SYSTEM SHALL` (ubiquitous) or `WHILE <state> THE SYSTEM SHALL` (state-driven).
- **Neutral.** No Android/iOS vocabulary in the NFR body. Device-tier notes go in a fenced `<!-- platform:android -->` block below the NFR.
- Source tag: `[src: posture]`, `[src: derived]`, or `[src: play]` where evidence exists.
- Calibrate thresholds from `posture_answers` (e.g. `target_device_tier`, `offline_first`, `data_sensitivity`). Where posture is silent, use the values in the table above as defaults and mark `(default)`.

## Output skeleton (`nfr.md`)

```markdown
# Non-Functional Requirements

## Performance
- **NFR-P-001** — THE SYSTEM SHALL reach first interactive frame within 2 000 ms of cold launch. (threshold: ≤ 2 000 ms cold, ≤ 800 ms warm, mid-range device) [src: posture]
<!-- platform:android -->
Measured with Macrobenchmark StartupMode.COLD on Pixel 4a (API 31) or equivalent mid-range AVD.
<!-- end platform:android -->
- **NFR-P-002** — THE SYSTEM SHALL render each frame within 16 ms on the target device tier. (threshold: ≤ 16 ms/frame; ≤ 1 jank frame per 300 ms scroll) [src: derived]

## Reliability / Offline
...

## Battery / Data
...

## App Size
...

## Security Baselines
...

## Scalability
...
```

Return JSON: `{nfrs:[{id,category,statement,threshold,source}], unmeasurable:[], fetch_error}`.
