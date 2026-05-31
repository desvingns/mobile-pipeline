# Handoff

UPDATED: 2026-05-30 by claude
CURRENT TASK: spec-backlog-board — file-based SPEC task board (backlog/active/done) + a `--feature` auto-split rule; plus `--spec` (author-only → backlog) and `--feature` backlog-consume mode (`--next` / `--backlog <slug>`)
STATUS: spec-backlog-board done (this session); codex-001 (dual-tool render/sync) still open; claude-002 follow-ups still open

## DONE (claude, this session — spec-backlog-board)
- `templates/common/commands/{{PREFIX}}.md`: `--feature` Phase 1 gains a "Large features → split into a SPEC backlog" step; new `## SPEC backlog board` section; one new Rules bullet (orchestrator may create/edit/move SPEC files under `.claude/specs/{backlog,active,done}/`).
- `templates/common/specs/README.md`: rewritten to document the board (layout, epic naming, SPEC file format, lifecycle) and keep the `--discuss` brainstorm-artifact format.
- `templates/common/specs/{backlog,active,done}/.gitkeep`: new board folders in the template tree.
- `bootstrap.sh`: copy_phase creates `.claude/specs/{backlog,active,done}/` + copies their `.gitkeep`; dry-run lists them. (Minimal, additive — does NOT touch codex's `--tools`/`{{AGENT_DIR}}`/adapter-emission seams.)
- `--spec` authoring flow + `--feature` backlog-consume mode (`--next` / `--backlog <slug>`): `--spec` writes SPEC(s) to `backlog/` as `Status: draft` (no agents, no gate); `--feature --next` moves `backlog/ → active/`, skips Phase 0/1, runs Phase 2, then `→ done/`. Usage + a "Mode select" prelude in `--feature` + new `## Workflow: --spec` section + 2 Rules bullets + specs-README lifecycle (`draft` status) — in both the template and the MyMoney downstream copy.
- `CHANGELOG.md`: entry under `[Unreleased]`. `VERSION` left at 1.3.0 (bump to 1.4.0 at release; additive = MINOR per AGENTS.md rule 8).
- change-log: 3 entries — `2026-05-30T12:00-spec-backlog-board`, `2026-05-30T12:05-spec-backlog-bootstrap`, `2026-05-30T12:10-spec-flag-and-consume` (affects claude, codex).
- Also mirrored into the downstream MyMoney_app project (outside this repo): the same `cmp.md` + `specs/` edits, and the board dogfooded with a 6-file `redesign-monefy-fidelity` epic in its `backlog/`.
- Commits: not yet (awaiting user go-ahead) — same posture as claude-002.

## IN PROGRESS
- none — claude paused, holds no files.

## DECISIONS (+ why)
- A SPEC's status IS the folder it lives in (`backlog`/`active`/`done`); moving the file changes status. Simpler than a parsed state field and matches the user's "папка аля бэклог и текущие задачи".
- Prose stays tool-neutral; paths kept literal `.claude/specs/` (NOT migrated to `{{AGENT_DIR}}`) — respects the still-open deferral (no `{{AGENT_DIR}}` / `tool:` markers in the orchestrator until codex ships `strip_tool_block`). Change is purely additive → no back-compat break.
- The board is for ad-hoc large `--feature` epics; per-project phase plans (e.g. MyMoney `docs/implementation_plan/`) are unaffected and called out as separate in the downstream copy only.

## NEXT (ordered)
1. **[codex]** codex-001 steps 1–6 (render `tool:` axis → `lib/sync.sh` → `bootstrap.sh --tools` → `.codex/` dev adapters → path-neutral scripts → verification) — unchanged, still codex-owned.
2. **[claude, after codex-001]** add `tool:` markers + `{{AGENT_DIR}}` into the orchestrator + dev agent templates; wire a `--from-spec`/`--plan` spec-handoff flow; refresh docs; bump `VERSION`→1.4.0 + cut the CHANGELOG release (folds in spec-backlog-board).
3. **[optional]** once `lib/sync.sh` exists, propagate `2026-05-30T12:00-spec-backlog-board` into the `.codex/` adapter (affects: codex).

## BLOCKERS / QUESTIONS FOR THE OTHER TOOL
- none. spec-backlog-board is additive + back-compat: a claude-only bootstrap is unchanged except for three new empty board folders + the documented workflow.

## CONTEXT LINKS
- Briefs: `.ai/tasks/claude-002-spec-integration.md`, `.ai/tasks/codex-001-dual-tool.md`
- Board contract: `templates/common/specs/README.md`; orchestrator: `templates/common/commands/{{PREFIX}}.md` (`## SPEC backlog board`); change-log spec: `.ai/changes/README.md`
- Earlier sessions (claude-002 spec-half integration; graphify + self-improvement loop) are in git history + `.ai/memory/`; their open follow-ups are folded into NEXT above.
