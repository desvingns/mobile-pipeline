---
name: dual-tool-architecture
description: "Why cmp targets both Claude Code and Codex via one canonical source + thin per-tool adapters (AGENTS.md canonical, CLAUDE.md imports it)."
metadata:
  node_type: memory
  type: project
---

cmp is being made drivable by **both Claude Code and Codex CLI**, on two levels: (A) the two
tools co-develop this repo, and (B) `bootstrap.sh` emits config for both into generated
projects.

**Why:** Single-tool lock-in — everything assumed `.claude/`, the `Agent`/`Bash` tools, and
`CLAUDE.md`. The industry standard is one canonical instruction file, `AGENTS.md` (read by
Codex / Cursor / Copilot / Aider), with `CLAUDE.md` importing it (`@AGENTS.md`) so the two
never drift.

**How to apply:**
- Treat `AGENTS.md` as the canonical instruction source; `CLAUDE.md` stays a thin `@AGENTS.md`
  import + Claude-only notes. Never duplicate rules across the two.
- Keep agent / orchestrator prose tool-neutral; isolate the few tool-specific lines behind
  `<!-- tool:claude -->` / `<!-- tool:codex -->` markers (same render engine as
  `<!-- platform:* -->`).
- Use the `{{AGENT_DIR}}` placeholder for `.claude` vs `.codex` paths.
- Derive the Codex adapters (`AGENTS.md`, `.codex/`) from the canonical agent specs via
  `lib/sync.sh`; never hand-maintain two copies.

Related: [[handoff-protocol]], [[change-log-discipline]].
