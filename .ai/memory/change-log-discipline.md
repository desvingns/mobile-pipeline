---
name: change-log-discipline
description: "Rule: every agent/skill/template edit gets one entry in .ai/changes/agent-skill-log.md; sync consumes only new entries via sync-state.json."
metadata:
  node_type: memory
  type: feedback
---

Every change to an agent, skill, or template is recorded as one append-only entry in
`.ai/changes/agent-skill-log.md`.

**Why:** So that syncing the canonical specs into the per-tool adapters (`AGENTS.md`,
`.codex/`) — or into a downstream generated project — reads only the *diff* since last time,
instead of re-reading and re-deriving the whole system. The cursor lives in
`.ai/changes/sync-state.json`.

**How to apply:**
- After editing a template / agent / skill, append an entry (format in
  `.ai/changes/README.md`): stable id, type, target path, summary, reason, `affects:` adapters.
- Never rewrite or delete past entries — the log is append-only and immutable; corrections are
  new entries.
- `lib/sync.sh` advances `sync-state.json` per adapter; never hand-edit the cursor.

Related: [[dual-tool-architecture]], [[handoff-protocol]].
