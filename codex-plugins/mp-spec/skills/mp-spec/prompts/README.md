# mp-spec — prompt library

Versioned, parameterized prompt fragments included **by reference** from `SKILL.md` and from the agents. This is the layer that was missing in the old monolith (`app-tdd-creator`, 645 lines, everything inline). Keeping rubrics/templates/question-banks here lets the orchestrator stay thin and lets each fragment evolve and be tested independently.

## How includes work

When a step says **`Read prompt <id>`**, open `prompts/<id>.md` and follow it literally. Agents are instructed the same way (e.g. "Read prompt `rubrics/ears-requirements` before authoring"). This mirrors the proven convention where `cmp-*` agents read `.claude/cmp-mymoney/<role>-extras.md`. Agents pin a fragment by its `id`, never by copying its content — so bumping a rubric's `version` upgrades every consumer at once.

## Prompt-file frontmatter (every fragment carries this)

```yaml
---
id: <dir>/<name>            # e.g. rubrics/ears-requirements — matches the path, no extension
version: 1.0.0              # bump on any behavioural change
inputs: [<artifact|answers>]   # what the consumer feeds in
outputs: [<artifact>]          # what the consumer produces using this fragment
model: <haiku|sonnet|opus|n/a> # n/a = used by the orchestrator's AskUserQuestion, not an agent
owner_agent: <agent-name|orchestrator>
tags: [<...>]
platform: <neutral|android|ios>  # neutral fragments must contain NO Compose/Kotlin/SwiftUI vocabulary
---
```

## Layout

| Dir | Holds |
|---|---|
| `questions/` | AskUserQuestion banks: `clone.*` (5 batches A–E + input), `greenfield.*` (5 stages) |
| `rubrics/` | Authoring rules: `ears-requirements`, `gherkin-acceptance`, `nfr-categories`, `a11y-wcag22`, `security-privacy-checklist`, `analytics-taxonomy`, `evaluator-rubric` |
| `templates/` | Output skeletons: `constitution`, `product-brief`, `design` (neutral), `platform.android`, `platform.ios`, `00_manifest` |
| `schemas/` | `feature-inventory.schema.json` — the neutral merge format both modes converge on |

## Extraction priority (when populating from the old monolith)

1. The 5 clone question batches (monolith Steps 2,4,5,7,8) → `questions/clone.*` — lift verbatim, zero behaviour change.
2. The TDD section template (monolith Step 10) → split into `templates/design.tmpl.md` (neutral) + `templates/platform.android.tmpl.md`.
3. New rubrics (`evaluator-rubric`, `ears-requirements`, `gherkin-acceptance`) — needed before the new agents can run.

## Neutrality rule (iOS-readiness)

Fragments tagged `platform: neutral` must not name a UI toolkit, DI framework, or persistence engine. Platform specifics live only in `templates/platform.<p>.md`, mirroring the `<!-- platform:android -->` / `<!-- platform:ios -->` fenced-block convention in `CMP/templates/common/root/CLAUDE.md.tmpl`. `spec-evaluator` enforces this.
