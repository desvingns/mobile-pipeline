# Handoff

UPDATED: 2026-05-25 by claude
CURRENT TASK: dual-tool (Claude Code + Codex) support — brief `.ai/tasks/codex-001-dual-tool.md`
STATUS: in-progress
OWNER / NEXT: **codex** — execute `codex-001` (render.sh `tool:` axis → `lib/sync.sh` →
  `bootstrap.sh --tools` → `.codex/` adapters)

## DONE (claude, this session)
- `.ai/` workspace: `README.md`, `memory/` (×3 memos + `MEMORY.md`), `changes/` (`README.md`
  spec + `agent-skill-log.md` + `sync-state.json`).
- Canonical `AGENTS.md` (repo root) + thin `CLAUDE.md` (`@AGENTS.md` import).
- Codex brief `.ai/tasks/codex-001-dual-tool.md` with the four shared seams pinned.
- `.gitignore`: ignore `.ai/local/`.
- Commits: not yet (awaiting user go-ahead). Codex CLI shares this checkout, so it can read
  these files uncommitted.

## IN PROGRESS
- none — Claude is paused and holds no files.

## DECISIONS (+ why)
- `AGENTS.md` canonical, `CLAUDE.md` thin import — zero drift.
- Reuse the `lib/render.sh` conditional engine for a `tool:` axis — low risk vs new tooling.
- `{{AGENT_DIR}}` placeholder for `.claude` / `.codex` paths.
- Change-log = append-only markdown journal + `sync-state.json` cursor — sync reads only the diff.
- `--tools` default = `claude` (back-compat); `codex` is opt-in.
- Defer inserting `tool:` markers into real templates until Codex ships `strip_tool_block`, so
  a mid-flight bootstrap can't leak codex-only content.

## NEXT (ordered)
1. **[codex]** `codex-001` steps 1–6 (render axis, sync engine, bootstrap wiring, `.codex/`
   adapters, path-neutral scripts, verification).
2. **[claude]** add `tool:` markers + `{{AGENT_DIR}}` into the orchestrator + agent templates;
   draft Layer-B template forms of `AGENTS.md` / `.codex`; run sync; verify no leaks +
   back-compat; update `docs/ARCHITECTURE.md` + `README.md` + `CHANGELOG.md`; bump `VERSION`
   (MINOR).

## BLOCKERS / QUESTIONS FOR THE OTHER TOOL
- none.

## CONTEXT LINKS
- Plan: `~/.claude/plans/ai-flickering-stardust.md`
- Brief: `.ai/tasks/codex-001-dual-tool.md`
- Rules: `AGENTS.md`; change-log spec: `.ai/changes/README.md`
