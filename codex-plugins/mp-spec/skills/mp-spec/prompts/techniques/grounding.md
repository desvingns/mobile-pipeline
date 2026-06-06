---
id: techniques/grounding
version: 1.0.0
inputs: [target_repo, feature_description]
outputs: [pipeline/grounding.md]
model: n/a
owner_agent: orchestrator
tags: [technique, grounding, brownfield, feature, anti-hallucination]
platform: neutral
---

<!-- Used by SKILL.md Step 2 A-feature, BEFORE the grill. The single biggest executability lever for
     a feature spec in an existing codebase. Optional in clone when a real source repo is also present. -->

## Grounding — verified-facts pass over the target codebase

Before specifying a feature for an **existing** project, read the actual code and record a ledger of
**verified facts, each with `file:line`**. A SPEC whose `CHANGED_HINT` cites real signatures and paths
is implementable as-written; one that guesses is not. This pass prevents the failure mode where the
gotchas — "balance is derived, not stored", "update ALL N implementors of interface X", "the runner
compiles androidTest", "the contract test hardcodes a count" — are discovered only at build time.

This is a *technique*, not an agent: the orchestrator (main session) runs it. It writes only the
ledger below — no `spec/` artifact, no code.

### What to extract (the fact categories)

- **Entry points & wiring** — where the feature plugs in (nav graph, menu/drawer, DI module, routing).
  Exact `file:line` + the symbol to edit.
- **Signatures to reuse** — the domain/data APIs the feature will call (repository methods, use-cases,
  models): exact signature + return type. *(e.g. "balance is derived: `AccountRepository.computeBalance(id): BigDecimal`".)*
- **Conventions** — money/time types, naming, layer-dependency rules, string/i18n policy.
- **Pattern to mirror** — the closest existing feature (its Screen/ViewModel/State shape) — name it as
  the template the new code should copy.
- **Test / CI gotchas** — what the runner compiles and asserts; contract tests with hardcoded counts;
  "must update all implementors / fakes of interface X".
- **The project's SPEC-board format** — read its `.claude/specs/README.md` + **one** sample SPEC; capture
  the exact front-matter fields, the SPEC-block shape, and the naming convention so the emitted epic
  matches house style. **Do not hardcode a format** — match what the project already uses.

### How to run it (read-only fan-out)

Spend the breadth on parallel read-only exploration; keep only the **conclusions** (file:line facts),
not raw file dumps. Cap at ~3 parallel explorers, one focus each (e.g. "nav + entry points",
"domain/data signatures + conventions", "SPEC-board format + test gotchas"). Read excerpts; cite
`file:line`. Stop when every fact a SPEC will need is captured.

> **Harness note.** Claude → spawn `Explore` subagents in parallel, keep their conclusions. Codex →
> native read-only subagents, or targeted main-session reads. Either way the orchestrator owns the
> ledger file; workers return facts, not file contents.

### Output — the grounding ledger (write this, then return)

`pipeline/grounding.md`. Markdown:

```markdown
# Grounding ledger — <feature> in <project>

## Verified facts
- G1 (entry):     <fact> — `path/File.kt:LL` <symbol>
- G2 (signature): `Repo.method(args): Type` — `path/File.kt:LL`
- G3 (convention):<rule> — `path:LL` | CLAUDE.md
- G4 (pattern):   mirror <FeatureX> — `path/...`
- G5 (gotcha):    <CI/test constraint> — `path:LL`

## Project SPEC format (house style to match)
- board: `<.claude/specs/backlog>` ; naming: `<epic>-NN-<slug>.md`
- front-matter fields: <list>
- SPEC block: <TASK / WHAT / LAYERS / CHANGED_HINT / TEST_TYPES / CONSTRAINTS>
- sample: `<path to one existing SPEC>`
```

### The hard rule (why this exists)

Every `CHANGED_HINT` line in every emitted SPEC must cite a grounding fact id (`G#`) **or** be tagged
`(assumption)`. A `CHANGED_HINT` with neither is the brownfield equivalent of an ungrounded
requirement — the evaluator flags it. Grounding is *grounding*, not a spec artifact.

### Language

Ledger prose: Russian (per SKILL language rules). Fact ids (`G1`…), paths, and signatures: Latin/verbatim.
