---
name: graphify-obsidian-integration
description: "Graphify (AST knowledge graph) + Obsidian wired across cmp, MyMoney_app, diet_helper; shared global graph + D:\\Pet\\ai-hub vault; semantic layer pending an LLM key."
metadata:
  node_type: memory
  type: reference
---

Graphify + Obsidian are integrated across three local projects: this repo (`cmp`),
`D:\Pet\TDD_creater\MyMoney_app` (`mymoney`), `D:\diet_helper` (`diet`).

**Why:** give every project a queryable code knowledge-graph and one shared cross-project base,
usable from both Claude Code and Codex — the navigation/observation layer discussed for cmp's
self-improvement loop (auto-rebuild hooks + queryable graph = the observe step).

**How to apply:**
- Graphify = pip `graphifyy`; exe `%APPDATA%\Python\Python314\Scripts\graphify.exe` (NOT on PATH —
  prepend that dir or call by full path). No LLM backend key is set, so graphs are **AST-only**
  (structural) today; (re)build a project graph with `graphify update <path>` (free, no API).
- Per project: `graphify-out/` (gitignored) holds graph.json + GRAPH_REPORT.md [+ graph.html if
  <5000 nodes]. post-commit / post-checkout git hooks rebuild it automatically. Node counts at
  setup: cmp 993, diet 2012, mymoney 5505.
- Shared base: `~/.graphify/global-graph.json` (tags cmp/mymoney/diet) via
  `graphify global add <graph.json> --as <tag>`. Refresh all three with
  `D:\Pet\ai-hub\refresh-global-graph.ps1`. Query across all: `graphify query "..." --graph <global>`.
- Obsidian hub vault: `D:\Pet\ai-hub` — junctions to each `graphify-out` + notes + `~/.graphify`;
  entry note `00-index.md`. Obsidian.exe at `%LOCALAPPDATA%\Programs\Obsidian\Obsidian.exe`.
- Wiring (user chose ALL three): a `## graphify` section is appended to each repo's CLAUDE.md
  (+ AGENTS.md for cmp & mymoney) plus PreToolUse hooks (`.claude/settings.json`,
  `.codex/hooks.json`). cmp's canonical AGENTS.md/CLAUDE.md were modified by explicit user choice.
- Codex: global skill `~/.agents/skills/graphify`; per-project via `graphify codex install`.
- **Semantic layer:** `GEMINI_API_KEY` stored in each project's gitignored `.env` file
  (template: `.env.example`). Loaded automatically by `scripts/graphify-hook.sh` (Codex hook)
  and by the git `post-commit` hook. To activate: copy `.env.example` → `.env`, fill in the key,
  then run `graphify extract <path> --backend gemini --global --as <tag>`. Re-run `global add`
  after any rebuild to refresh the shared base.

Related: [[dual-tool-architecture]], [[change-log-discipline]].
