# `.claude/specs/` — Persistent Brainstorm Artifacts

This directory stores persistent records of `/{{PREFIX}} --discuss <topic>` brainstorms — the
options surfaced, the recommendation, and (later) the SPEC that was approved and the
commit that shipped it.

**Committed to git** — gives long-term visibility into "what were we thinking about a
month ago." If a brainstorm went nowhere, the file is still useful evidence of considered
trade-offs. Delete only when the file is genuinely obsolete and you'd rather forget the
context.

## How files get created

1. User runs `/{{PREFIX}} --discuss <topic>`.
2. `{{PREFIX}}-architect` agent returns a BRAINSTORM block.
3. The `/{{PREFIX}}` orchestrator asks: *"Save as a spec draft in `.claude/specs/`? (y/N)"*
4. If yes, orchestrator asks for a `kebab-case` slug and writes `<slug>.md` here.

Later, when `/{{PREFIX}} --feature` is run for the same topic, the orchestrator fills in
the **Approved SPEC** and **Implementation links** sections.

## File format

```markdown
# <Topic, one-line restatement>
Status: brainstorm | spec-ready | in-progress | done
Date: YYYY-MM-DD

## Brainstorm output
<full BRAINSTORM block from {{PREFIX}}-architect — verbatim>

## Approved SPEC
<full SPEC block from /{{PREFIX}} --feature, or "(pending)" if not yet approved>

## Implementation links
- commit: <hash>
- files: <list of changed files>
(or "(pending)" if not yet implemented)
```

## Status lifecycle

| Status | Meaning |
|--------|---------|
| `brainstorm` | Just options + recommendation. No SPEC yet, no code. |
| `spec-ready` | User picked an option and approved a SPEC. Ready to implement. |
| `in-progress` | `/{{PREFIX}} --feature` started but didn't complete (interrupted, blocked, etc). |
| `done` | Feature shipped. Implementation links filled in. |

Status is updated manually or by the orchestrator at the relevant moment.

## Naming

`<slug>.md` — short, kebab-case, descriptive. Examples: `csv-export.md`, `offline-sync.md`,
`onboarding-flow.md`. Avoid version suffixes — if the topic evolves, edit the existing file
or start a new one with a clearly different scope.
