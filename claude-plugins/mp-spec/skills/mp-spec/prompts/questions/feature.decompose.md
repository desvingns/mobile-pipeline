---
id: questions/feature.decompose
version: 1.0.0
inputs: [pipeline/grounding.md, pipeline/grill.md, feature_description]
outputs: [pipeline/decomposition.json]
model: n/a
owner_agent: orchestrator
tags: [questions, feature, brownfield, decomposition, gate]
platform: neutral
---

<!-- Source: SKILL.md Step 2 — A-feature, sub-step 3. This propose-then-confirm step IS the
     feature-mode GATE 1 (analogous to the inventory gate in clone/greenfield). -->

## Feature decomposition (propose-then-confirm) — the feature-mode GATE 1

**Intent:** turn the grounded + grilled feature into an ordered, dependency-aware set of
**independently-shippable** SPECs (an "epic"), and confirm it with the user before any SPEC is
written. Propose-then-confirm: you generate the decomposition from the grounding + grill ledgers;
the user edits and prunes. Nothing is emitted unilaterally.

Print to user: `⟳ Decomposition — предлагаю разбивку фичи на SPEC-и`

---

### Before calling AskUserQuestion — derive the decomposition

From `grounding.md` (what plugs in where, the layers, the gotchas) and `grill.md` (locked decisions,
scope, out-of-scope):

1. Slice the feature into SPECs that are each **independently shippable** and lean toward a **single
   layer** (domain / data / presentation), **foundation first** (pure logic + persistence before UI).
2. Order them; record `Depends-on` (within the epic and any cross-epic dependency).
3. For each SPEC: a one-line WHAT, its layers, the **files it touches** (from grounding facts), and a
   `domain_math` flag if it carries a non-trivial calculation (→ `rubrics/domain-math`).
4. **Clash check:** flag any two SPECs that touch the **same file** — they must be sequenced; note it.
5. Pick an `epic` slug (kebab-case) and confirm the board path (default: the `.claude/specs/backlog/`
   captured in grounding; ask if the project has none).

Cap the proposal at ~8 SPECs; if the feature is bigger, group sub-features.

### Confirm with the user

Print the proposed epic as a table (`Order | SPEC | layers | depends-on | touches | clash?`), then
call **AskUserQuestion** (1 question):

```
Q-FD-1: Вот предлагаемая разбивка фичи на SPEC-и. Подтверждаешь?
  options:
    - Да, разбивка верна
    - Объединить/разделить какие-то SPEC-и (уточню)
    - Изменить порядок / зависимости (уточню)
    - Убрать или добавить SPEC (уточню)
```

Wait for the reply; apply edits; re-print if it changed. This is a **hard gate** — nothing is emitted
until the decomposition is confirmed (mirrors GATE 1 in the other modes).

> **Harness note.** Codex CLI has no structured-question tool: print the table and the four choices in
> chat and **STOP** until the user replies. Never emit SPECs past this gate without confirmation.

### Save

Write `pipeline/decomposition.json`:

```json
{
  "epic": "<epic-slug>",
  "board": "<.claude/specs/backlog>",
  "specs": [
    {"order": "01", "slug": "<slug>", "what": "<one line>", "layers": ["domain"],
     "depends_on": [], "touches": ["path/File.kt"], "domain_math": false, "clash_with": []}
  ]
}
```

This drives the epic emission in **Step F**.

### Language

Russian to the user; epic/slug ids + file paths Latin.
