# Delegatable tasks — ranked by safety

This is the working list of cmp pipeline tasks that **could** be delegated to a local LLM,
ranked from "safe and clearly net-positive" to "do not delegate".

The ranking is grounded in two questions per task:

1. **Cost of being wrong.** If the local model produces garbage, what's the blast radius?
2. **Cost of Claude doing it.** If Claude does it, how many tokens / how much context does
   it burn that could be used elsewhere?

A task is a good delegation candidate when (cost of wrong) is low AND (cost of Claude doing
it) is non-trivial.

---

## Tier S — safe and obviously net-positive

These are mechanical, shaped, and easy to validate. Local model output goes to Claude for a
final eyeball, but most of the structure work is done locally.

| Task | Which agent | Output | Why safe |
|---|---|---|---|
| **Gradle stacktrace summarisation** | `<prefix>-runner-<plat>` | "Failed: <Class>.<method>: <one-line cause>" — already structured | Wrong summary just means Claude re-reads the log. No code touched. |
| **JSON repair** | After any LLM agent | Fixed JSON object | Output is validated by parse. Fail-closed. |
| **Conventional-commit classifier** (feat/fix/refactor/test/chore from diff) | Pre-commit hook | One word | Human review at commit time anyway. |
| **Cyrillic / non-English UI string proofreading** | `<prefix>-verifier-<plat>` | List of suspicious strings | Verifier already does coarse regex; local model refines false positives. |
| **Name suggestions** (3 candidates for a new UseCase, ViewModel, etc.) | `<prefix>-architect` (inline) | List of 3 names | Architect already brainstorms; this is template-fill. |
| **STATE.md "Recently shipped" one-liner** from `git log -1` | `<prefix>-docs` | One markdown bullet | Already largely templated. |
| **Generating expected-text fixtures for screenshot tests** from a state object | `<prefix>-tester-<plat>` helper | List of expected strings | Tests fail loudly if wrong. |

---

## Tier A — useful with guardrails

Net-positive but needs a verification step before Claude trusts the output.

| Task | Which agent | Required guardrail |
|---|---|---|
| **Mapper test boilerplate** (round-trip `entity ↔ domain`) | `<prefix>-tester-<plat>` | Run the generated test; if it fails or won't compile, Claude rewrites. |
| **Detekt/lint auto-fix suggestions** (wildcard import, unused var) | `<prefix>-runner-<plat>` post-step | Re-run linter after applying; revert on regression. |
| **Russian translation suggestions** for UI strings ("Save" → 3 candidates) | `<prefix>-developer-<plat>` helper | User picks the final string; never auto-applied. |
| **Pre-screen code review** (mark "look here" hotspots in a diff) | New `<prefix>-prereview` agent | Hotspots flagged are advisory; Claude still reads the diff. False positives are cheap, false negatives are not — keep precision-recall balance loose. |

---

## Tier B — possible but marginal

The math is closer to break-even. Implement only after Tier S/A delivers value.

| Task | Concern |
|---|---|
| Generating commit-message body | Quality matters; Claude is better. |
| Picking which test type to add (unit / dao / compose-ui) given a diff | Already handled deterministically by Tester's Mandatory Coverage Rules. Local model adds noise. |
| Summarising what changed in DOCUMENTATION.md | DOCUMENTATION.md is small; Claude writes ~5 lines per iteration. Not worth the integration. |
| Filling in iOS stub agent contents from Android equivalents | One-shot task; do it once with Claude, not every iteration. |

---

## Tier F — do NOT delegate

These tasks require either whole-codebase reasoning, decision-making, or such tight
correctness that 6 GB models can't carry them.

| Task | Why not |
|---|---|
| **`<prefix>-architect` BRAINSTORM** | Requires reading multiple files and weighing trade-offs against project history. 6 GB models cannot hold the codebase context. |
| **`<prefix>-developer-<plat>` (default and GREEN modes)** | Writing Kotlin/Swift that compiles, follows Clean Architecture layer rules, matches existing patterns, and integrates with Hilt/Compose graph. Cost of being wrong is enormous. |
| **`<prefix>-reviewer-<plat>` Clean Arch checks** | Already deterministic bash; local model would only add nondeterminism. |
| **SPEC generation** | The SPEC is a contract between agents — every field matters. Claude has to write it. |
| **`<prefix>-verifier-<plat>` final pass/fail decision** | Blocks the push; must be correct. Static checks are bash; manual checklist generation needs UX judgement Claude has. |
| **Picking which agent to spawn next** | Orchestrator decisions are flow control. Local model can't see the conversation. |
| **Memory-file curation** (what's in `~/.claude/projects/<…>/memory/`) | Knowledge selection is high-stakes; long-lived files. Claude decides. |
| **Test assertion logic** | A wrong assertion that compiles is the worst failure mode — false green. Never delegate the actual `assertEquals(...)` content. |
| **Choosing whether to push** | Human-in-the-loop step. Never automate. |

---

## Rule of thumb

> Delegate the **scaffolding**, keep the **judgement**.

If a task can be described as "fill in this template" or "classify into one of N labels",
it's a candidate. If a task requires "decide what should happen", keep it with Claude.
