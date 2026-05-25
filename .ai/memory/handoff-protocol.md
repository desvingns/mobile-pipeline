---
name: handoff-protocol
description: "Rule: at every session boundary read and rewrite .ai/handoff.md; git is the transport between Claude and Codex."
metadata:
  node_type: memory
  type: feedback
---

When co-developing this repo with Claude Code and Codex CLI, coordination goes through
`.ai/handoff.md` — not memory, not chat.

**Why:** The two tools never share a live context window. A structured, git-tracked hand-off
file is the only reliable channel, and it leaves a full audit trail in `git log`. This extends
cmp's existing between-agents contract discipline to between-tools.

**How to apply:**
- Session start: read `.ai/handoff.md` before doing anything else.
- Session end / before switching tools: rewrite it — UPDATED, CURRENT TASK, STATUS, OWNER/NEXT,
  DONE (+ commit hashes), IN PROGRESS (+ files being touched, for collision avoidance),
  DECISIONS, NEXT, BLOCKERS. Commit it together with your work.
- Do not edit files another tool currently lists under IN PROGRESS.

Related: [[dual-tool-architecture]], [[change-log-discipline]].
