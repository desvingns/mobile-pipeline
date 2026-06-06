---
id: templates/feature-epic-overview
version: 1.0.0
inputs: [pipeline/decomposition.json, pipeline/grounding.md, pipeline/grill.md]
outputs: ["<board>/<epic>-00-overview.md"]
model: n/a
owner_agent: orchestrator
tags: [template, feature, brownfield, epic]
platform: neutral
---

<!-- feature mode, Step F. FIRST match the target project's house format captured in grounding.md
     ("Project SPEC format"); this skeleton is the fallback when the project defines none. -->

## Epic-overview template

Emit `<board>/<epic>-00-overview.md`. **Match the project's house format** (front-matter fields,
section names) captured in `grounding.md`. The skeleton below is the default — it matches the common
`# Title / Epic / Order / Status / Depends-on / Date` + sections convention; adapt field names to
whatever the project already uses.

```markdown
# <Feature> — epic overview
Epic: <epic-slug>
Order: 00 of <NN>
Status: backlog
Depends-on: —
Date: <YYYY-MM-DD>

## Goal
<2–4 sentences: what the user gets; the entry point; the scope boundary (what's in / out).>

## Locked decisions
<from grill.md — each a one-liner with its rationale; deferred items tagged (assumption).>

## SPECs (run via <project handoff, e.g. /mp --feature --next> in Order)
| Order | File | Depends-on | Layers | Summary |
|---|---|---|---|---|
| 01 | `<epic>-01-<slug>.md` | — | <layers> | <one line> |
| 02 | `<epic>-02-<slug>.md` | 01 | <layers> | <one line> |

## Why this ordering
<dependency rationale; call out same-file clashes that force sequencing.>

## Key facts (verified)
<from grounding.md — the G# facts the SPECs rely on, each with file:line.>

## Implementation links
- commit: <hash>
- files:  <changed files>
```

**Rule:** the SPEC table, locked decisions, and key-facts sections MUST be sourced from the
decomposition + grill + grounding ledgers — never invented here. The overview is the interim
authority for any new screens / business rules the feature introduces until they are merged upstream.
