---
id: techniques/grill-me
version: 1.2.0
inputs: [idea_paragraph, feature-inventory-draft, ambiguities, state_gaps, feature_description, grounding_ledger]
outputs: [input/interview/grill.md, pipeline/grill.md]
model: n/a
owner_agent: orchestrator
tags: [technique, elicitation, interrogation, anti-hallucination, greenfield, clone, feature]
platform: neutral
---

<!-- Source: the grill-me skill (Matt Pocock) — design-tree interrogation, adapted as a reusable
     spec-creation technique. Used by SKILL.md Step 2 A-green (Stage 0) and A-clone (ambiguity walk). -->

## Grill-me — design-tree interrogation

A focused, **adversarial** elicitation pass that resolves the app/feature as a **tree of
decisions** instead of a flat questionnaire. You interview the user **one decision at a time**,
resolving **upstream** (root) choices before the **downstream** (leaf) ones they constrain, and
you actively **poke holes** — surface hidden assumptions, contradictions, unhandled states, and
silent scope creep — before any artifact is written. The output is a small resolved-decisions
ledger that grounds every later stage (anti-hallucination: nothing downstream invents what the
grill did not establish).

This is a *technique*, not an agent: the orchestrator (main session) runs it directly. It does
not write Kotlin/Swift or any `spec/` artifact — only the ledger below.

### The mental model (the rule)

> **Walk down each branch of the design tree. Resolve a parent decision before its children.**

1. From the available input — the idea paragraph (greenfield), the draft inventory +
   `ambiguities[]` / `state_gaps[]` (clone), or the feature description + grounding ledger
   (feature) — sketch (internally) the **decision tree**: the
   small set of choices that, once made, determine everything downstream. Roots first:
   *who is this for / what is the single core job / what is explicitly out of scope* →
   then the branches each root opens (entities, flows, states, integrations, constraints).
2. Order questions so a parent is settled before its children. Never ask a leaf question whose
   answer depends on an unresolved parent — settle the parent first.
3. For **each** open decision, ask **one** question (see harness note for the mechanism) and
   always offer a **recommended answer** — the option you'd pick from the context so far, marked
   `(рекоменд.)` — so the user can accept with a single tap or correct you.
4. Be a skeptic, not a stenographer. On every answer, look for: an **assumption** the user did
   not state, a **contradiction** with an earlier answer, a **state** nobody handled
   (empty / loading / error / offline / first-run / unauthenticated), **scope creep** (a feature
   with no traceable root in the core job), or a **dependency** the answer just created. If you
   find one, that becomes the next question — follow the new branch before returning to breadth.
5. Recommend an answer to your own hole when you have a defensible default; mark it
   `(assumption)` in the ledger if the user defers to your recommendation rather than deciding.

### The user profile (bias recommendations, never decide)

Before the first question, read the **cross-project user profile** once if it exists —
`$MP_USER_PROFILE` or `~/.config/mobile-pipeline/user-profile.md` (durable facts about the
user's taste, language, and process preferences, accumulated across all their projects). Use it
to pick better **recommended answers** and to skip questions whose answer the profile makes
obvious — when a profile fact informs a recommendation, say so in a short parenthetical (e.g.
«рекоменд.: тёмная тема — ваш обычный выбор»). The profile **never auto-decides**: every
profile-informed choice still goes through the user (as the recommended option) or into the
ledger as an explicit `(assumption)` citing the profile. No profile file → proceed exactly as
before.

### Ask-one-at-a-time (hard)

Do **not** dump the whole tree as a batch. The value is the *funnel*: each answer reshapes the
remaining tree (prunes dead branches, opens new ones, re-orders priority). Ask → absorb →
re-plan → ask the next. A small **coherent cluster** (2–3 tightly-coupled sub-choices of the
same parent) in one turn is fine; an unrelated grab-bag is not.

### Budget — scale to the ambiguity, don't grill on rails

Before the first question, **list the open decisions** you can see (internally) and rank them by
**leverage** — how much downstream each one determines. Grill the high-leverage ones first. A feature
with two real unknowns deserves two questions, not eight; a genuinely tangled one may need more than a
small fixed cap. So the budget **scales with the count of open decisions**, and the numeric cap below is
a backstop, not a target.

### Stop conditions

Stop the grill when **any** holds, then write the ledger:
- All root / high-leverage decisions are settled and no open branch has an unresolved hole; **or**
- The user says "достаточно" / "хватит" / "дальше" (accept remaining open items as
  `(assumption)` with your recommended defaults, logged as such); **or**
- A turn budget is hit — **≤ 8** (greenfield) / **≤ 8, scaled to the open-decision count** (feature) /
  **≤ 1 per ambiguity, max 6** (clone) — with a **hard ceiling of ≤ 12** in any mode. Surface what is
  still open rather than grilling indefinitely.

Never let the grill block forever. Unresolved branches become logged assumptions + open
questions, not a stall.

### Output — the decisions ledger (write this, then return)

Greenfield → `input/interview/grill.md`. Clone → `pipeline/grill.md`. Markdown:

```markdown
# Grill ledger — <APP> (<mode>)

## Resolved decisions
- D1 (<root|branch>): <decision> — <why / which input drove it>  [confirmed | assumption]
- D2 ...

## Surfaced holes
- H1: <assumption / contradiction / unhandled state / scope-creep> → <how it was resolved, or "open">

## Open questions (deferred)
- O1: <question> — recommended default: <…>  (carried into the relevant stage/batch as an assumption)

## Out of scope (explicit)
- <thing the user ruled out — so no later stage re-introduces it>
```

This ledger is **grounding**, not a spec artifact. Downstream consumers:
- **Greenfield** — the 5 interview stages read it: every candidate JTBD / screen / entity must
  trace to a resolved decision or the idea paragraph; deferred open-questions seed the stage that
  owns them; "Out of scope" items must never be proposed.
- **Clone** — the resolved decisions close `ambiguities[]` / `state_gaps[]`; remaining open items
  flow into GATE 1 inventory notes and `risks.md` (tagged `(assumption)`).
- **Feature (brownfield)** — the resolved decisions become the epic's **locked decisions**; the
  decomposition step reads them so every proposed SPEC traces to one; deferred open-questions become
  `(assumption)`-tagged rows in the epic overview + per-SPEC CONSTRAINTS.

### Harness note

Use the question mechanism your harness provides (same split as the SKILL's gates):
- **Claude Code** — ask each decision with **AskUserQuestion**: one question per call, the
  recommended option **first** and labelled `(рекоменд.)`. Re-plan the tree from the answer
  before the next call. A 2–3 sub-choice cluster of one parent may be one multi-question call.
- **Codex CLI** — no structured-question tool: ask the one question **in chat and STOP** until
  the user replies. State your recommended answer in the question text. Never batch the tree;
  never proceed on an unanswered question.

### Language

Questions, options, and ledger prose to the user: **Russian** (per SKILL language rules).
Decision IDs (D1, H1, O1) and any code identifiers: Latin.
