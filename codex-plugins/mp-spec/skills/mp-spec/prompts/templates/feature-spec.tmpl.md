---
id: templates/feature-spec
version: 1.0.0
inputs: [pipeline/decomposition.json, pipeline/grounding.md, rubrics/gherkin-acceptance, rubrics/domain-math]
outputs: ["<board>/<epic>-NN-<slug>.md"]
model: n/a
owner_agent: orchestrator
tags: [template, feature, brownfield, spec]
platform: neutral
---

<!-- feature mode, Step F — one file per entry in decomposition.json. MATCH the project's SPEC-block
     shape from grounding.md; the skeleton below is the fallback. -->

## Numbered-SPEC template

Emit `<board>/<epic>-NN-<slug>.md`, matching the project's SPEC-block shape (from `grounding.md`).
Default skeleton:

```markdown
# <SPEC title>
Epic: <epic-slug>
Order: <NN of MM>
Status: backlog
Depends-on: <epic-NN | —>
Date: <YYYY-MM-DD>

## SPEC
=== SPEC ===
TASK: feature | bugfix | refactor
PLATFORM: <android|ios>
WHAT: <the goal — what the user sees / the contract this SPEC delivers>
LAYERS: <domain | data | presentation (or a combination)>
CHANGED_HINT:
  - <path/File.ext:LL> — <precise change; CITE a grounding fact (G#) or tag it (assumption)>
  - ...
TEST_TYPES: <unit | dao | compose-ui | instrumented>
CONSTRAINTS:
  - <non-obvious rule / gotcha from grounding (e.g. "update ALL N implementors of X"; "the runner
    compiles androidTest"; "the contract test hardcodes a count")>
  - <if domain_math: include a Calculation block — Read prompt rubrics/domain-math>
=== END SPEC ===

## Acceptance (Read prompt rubrics/gherkin-acceptance)
<2–4 UI-agnostic Gherkin scenarios: the happy path + at least one empty/error/validation case.
These pin testability and feed the project's traceability.>

## Gap / context
<1–2 lines: the concrete gap this SPEC closes.>

## Implementation links
- commit: <hash>
- files:  <changed files>
```

**Rules:**
- Every `CHANGED_HINT` line cites a grounding fact (`G#`) **or** is tagged `(assumption)` — an
  ungrounded hint is the brownfield "ungrounded requirement" and the light eval flags it.
- If the SPEC carries calculation (`domain_math: true`), include a Calculation block per
  `rubrics/domain-math` (formula + symbol table + rounding + edge cases + ≥3 worked-example fixtures).
- Each SPEC is independently shippable; honour `Depends-on`. If it shares a file with another SPEC,
  say so in CONSTRAINTS so the two are sequenced (no parallel edit of the same file).
