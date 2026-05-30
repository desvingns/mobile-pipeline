---
name: self-improvement-loop
description: "cmp's observe→reflect→propose→gate→propagate loop — the selfimprove/ kit (capture JSONL → reflect → human-gated change-log → lib/sync). Built on cmp's own primitives, replicated to the app projects."
metadata:
  node_type: memory
  type: project
---

The self-improvement loop closes the open ends in cmp's existing scaffolding: it persists the
structured JSON the runner/reviewer agents already emit, reflects on it, and routes proposed fixes
through a human gate into the change-log → sync rail.

**Why:** *self-improvement is a loop, not a store.* cmp already had the store (`.ai/memory/`) and
the rail (`.ai/changes/agent-skill-log.md` → `lib/sync.sh` → adapters); the missing links were
**capture** (the agent JSON was thrown away) and **reflection**.

**How to apply:**
- `selfimprove/record-run.sh` (L1) appends one JSON event to `selfimprove/runs/*.jsonl`
  (gitignored). Wire it into the runner/reviewer/CI so events accrue automatically.
- `selfimprove/reflect.sh` (L2) aggregates → `selfimprove/retro/retro-<date>.md` (per-agent
  pass-rate, failure clusters, flaky signals). Pure awk, no LLM.
- `selfimprove/REFLECTION-PROMPT.md` + the `selfimprove-retro` Claude agent (L3) turn the retro
  into minimal, human-gated proposals.
- Gate → one entry in `.ai/changes/agent-skill-log.md` → `lib/sync.sh` propagates to adapters.
  Distilled lessons live in `selfimprove/lessons.md` (+ here in `.ai/memory/`).
- Two-folder discipline: raw telemetry (`runs/*.jsonl`, gitignored) vs distilled signal
  (`lessons.md` / memory, tracked). The reflection step is the valve — raw never pollutes signal.
- Replicated as a uniform kit to `MyMoney_app` + `diet_helper`; for those app projects the gate
  appends to their own `selfimprove/lessons.md` (no `.ai/changes` rail there).

Complements `eval/` (regression cases): the retro can nominate eval cases; eval can later gate
improvement PRs that regress. Related: [[graphify-obsidian-integration]], [[change-log-discipline]],
[[dual-tool-architecture]].
