@AGENTS.md

# CLAUDE.md — Claude Code-specific notes

The canonical instructions for this repo live in `AGENTS.md` (imported above). This file holds
only the Claude-Code-specific bits; never duplicate rules from `AGENTS.md` here.

- **Shared vs personal memory.** The canonical, git-tracked memory is `.ai/memory/` — put any
  durable framework knowledge there so Codex sees it too. Your auto-memory under
  `~/.claude/projects/.../memory/` is a personal mirror; do not let shared decisions live only
  there.
- **Exploration.** For codebase searches spanning more than ~3 lookups, use the Explore
  subagent; otherwise use Glob / Grep directly.
- **Coordination.** Follow the `.ai/` protocol in `AGENTS.md` → read `.ai/handoff.md` at start
  and rewrite it before handing back to Codex.
- **Ownership.** Claude's half of the dual-tool work is the canonical prose, the `tool:`
  branches in templates, the `.ai/` scaffold, and docs. Codex owns `render.sh` / `sync.sh` /
  `bootstrap.sh` / `.codex/` — see `.ai/tasks/codex-001-dual-tool.md`.
