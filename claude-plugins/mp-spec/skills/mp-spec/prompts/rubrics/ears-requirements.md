---
id: rubrics/ears-requirements
version: 1.0.0
inputs: [feature_inventory, posture_answers, constitution]
outputs: [requirements.md]
model: sonnet
owner_agent: requirements-author
tags: [requirements, ears, neutral, spec-layer]
platform: neutral
---

# EARS requirements rubric

Write functional requirements in **EARS** (Easy Approach to Requirements Syntax). Each requirement is one unambiguous, testable sentence with the system as subject. Platform-neutral — no UI toolkit / DI / persistence vocabulary.

## The five EARS patterns (pick the one that fits)

| Pattern | Template | Use for |
|---|---|---|
| Ubiquitous | `THE SYSTEM SHALL <response>.` | always-true invariants |
| Event-driven | `WHEN <trigger> THE SYSTEM SHALL <response>.` | reactions to a user action / event |
| State-driven | `WHILE <state> THE SYSTEM SHALL <response>.` | behaviour that holds during a state |
| Unwanted behaviour | `IF <condition>, THEN THE SYSTEM SHALL <response>.` | errors, validation, failure handling |
| Optional feature | `WHERE <feature is included> THE SYSTEM SHALL <response>.` | behaviour gated by an optional capability |

Combine sparingly: `WHEN <trigger>, WHILE <state>, THE SYSTEM SHALL <response>.`

## Rules

- **ID:** `FR-NNN` (zero-padded, stable, never renumbered). One requirement per ID.
- **One trigger, ≥1 response.** No "and also" smuggling a second requirement in — split it.
- **Testable.** Every `FR` must be satisfiable by at least one Gherkin scenario (the acceptance-criteria-writer will pin it). If you can't imagine the test, the requirement is too vague.
- **Grounded.** Each `FR` cites its source in a trailing tag: `[src: S06]` (screen), `[src: apk]`, `[src: play]`, `[src: interview:stage3]`, or `[src: derived]`. An `FR` with no source is a finding the evaluator will reject — don't invent requirements.
- **Neutral.** Say "the system records the expense", not "the Room DAO inserts a row". Reference screens by `Sxx`, entities by inventory name.
- **Link down to inventory:** add `[scr: S06,S07]` and `[ent: Transaction]` tags where relevant so traceability can be built.

## ID policy (important — don't over-formalize)

Prefer the project's existing, already-testable scheme where it exists: screen-level behaviour as **user stories `US-x` + screen acceptance `ACn` + business rules `BR-x`**. Use `FR-NNN` (EARS) for:
- cross-cutting/system-wide behaviour not owned by one screen,
- greenfield apps with no screens yet,
- anything the evaluator flags as "story without a precise requirement".
Do **not** mechanically mint an `FR-x` for every `US-x`.

## Output skeleton (`requirements.md`)

```markdown
# Functional Requirements (EARS)

## <Group / epic name>
- **FR-001** — WHEN the user submits the login form with a valid email and password, THE SYSTEM SHALL authenticate and open the home screen. [src: S01] [scr: S01] 
- **FR-002** — IF the email field is empty, THEN THE SYSTEM SHALL keep the submit action disabled. [src: S01]
...

## Cross-cutting
- **FR-040** — WHILE offline, THE SYSTEM SHALL serve the last cached data and queue writes for sync. [src: interview:stage5]
```

Return JSON: `{frs:[{id, ears, pattern, sources, screens, entities}], cross_cutting_count, ungrounded:[], ambiguities:[]}`.
