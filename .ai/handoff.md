# Handoff

UPDATED: 2026-05-29 by claude
CURRENT TASK: claude-002 — spec-half integration (requirements→handoff) — brief `.ai/tasks/claude-002-spec-integration.md`
STATUS: claude-002 done (this session); codex-001 (dual-tool render/sync) still open
OWNER / NEXT: codex-001 remains **codex's**; claude-002 follow-ups are small (see NEXT)

## DONE (claude, this session — claude-002)
- `templates/spec/` NEW group: `skills/app-spec-creator/` (SKILL.md + prompts/), `agents/*.md` ×17 (canonical neutral specs), `codex/` (agent.toml.tmpl + openai.yaml + config-fragment.toml).
- Prompt paths neutralized to `{{AGENT_DIR}}`; SKILL.md harness-notes block with `tool:claude|codex` branches (AskUserQuestion↔STOP gates; native-subagent dispatch + max_threads/max_depth caveats).
- `install-spec.sh` (repo root): dual-harness GLOBAL installer; smoke-tested into a throwaway home — 17 claude `.md` + 17 codex `.md`+`.toml`, no `{{}}`/`tool:` leaks, `[agents]` merged.
- change-log: 3 entries (spec-group, spec-codex-adapters, install-spec).
- Commits: not yet (awaiting user go-ahead) — same posture as codex-001.

## IN PROGRESS
- none — claude paused, holds no files.

## DECISIONS (+ why)
- Spec tool is GLOBAL (fixed names) → `install-spec.sh`, not the per-project bootstrap. (User-chosen: templates/spec/ + global-install.)
- Codex adapters produced NOW (user-chosen) by mirroring MyMoney's `.codex/` shim pattern; coordinated here so codex-001 isn't surprised.
- `install-spec.sh` is standalone and does NOT edit `bootstrap.sh` / `lib/render.sh` / `lib/sync.sh` (codex-001's owned seams). It reuses the agreed `{{AGENT_DIR}}` + `tool:` conventions, so codex-001 / `lib/sync.sh` can later absorb spec install.
- Orchestrator command (`templates/common/commands/{{PREFIX}}.md`) was **NOT** edited — per the deferral rule (no `tool:` markers in real templates until codex ships `strip_tool_block`). The spec→dev handoff is documented in `docs/SPEC-PIPELINE.md` instead.

## NEXT (ordered)
1. **[codex]** `codex-001` steps 1–6 (render `tool:` axis → `lib/sync.sh` → `bootstrap.sh --tools` → `.codex/` dev adapters → path-neutral scripts → verification) — unchanged, still codex-owned.
2. **[codex, after strip_tool_block]** optionally fold spec install into `bootstrap.sh --install-spec`, and let `lib/sync.sh` regenerate `templates/spec/codex/` shims from the canonical `.md` (today `install-spec.sh` generates them at install time).
3. **[claude, after codex-001]** add `tool:` markers + `{{AGENT_DIR}}` into the orchestrator + dev agent templates; wire a `--from-spec` / `--plan` spec-handoff flow into the orchestrator (today documented, not wired); refresh docs; bump.

## BLOCKERS / QUESTIONS FOR THE OTHER TOOL
- none. The spec group is additive and back-compat: a claude-only dev bootstrap is unchanged; spec install is a separate script.

## CONTEXT LINKS
- Briefs: `.ai/tasks/claude-002-spec-integration.md`, `.ai/tasks/codex-001-dual-tool.md`
- Spec docs: `docs/SPEC-PIPELINE.md`; installer: `install-spec.sh`; rules: `AGENTS.md`; change-log spec: `.ai/changes/README.md`

## NOTE — 2026-05-29 (out-of-band tooling, NOT part of claude-002/codex-001)
Graphify + Obsidian were integrated across cmp/mymoney/diet (user request). cmp's tracked files
were touched: a `## graphify` section appended to **AGENTS.md** + **CLAUDE.md**; PreToolUse hooks
added to `.claude/settings.json` and a new `.codex/hooks.json`; `graphify-out/` added to
`.gitignore`; local git hooks (post-commit/post-checkout) installed under `.git/hooks/`.
`graphify-out/` is gitignored (not committed). Graphs are AST-only (no LLM key set); semantic
layer pending. Full details: `.ai/memory/graphify-obsidian-integration.md`. Additive and
orthogonal to codex-001 / claude-002 — review the AGENTS.md/CLAUDE.md diff before committing.

Also added (same session): the **self-improvement loop** — a `selfimprove/` kit (record-run.sh /
reflect.sh / REFLECTION-PROMPT.md / lessons.md + `.claude/agents/selfimprove-retro.md`) wired to
cmp's `.ai/changes` → `lib/sync` rail and replicated to MyMoney_app + diet_helper. Change-log
entry `2026-05-29T22:00-selfimprove-loop`; memo `.ai/memory/self-improvement-loop.md`. The loop's
raw telemetry (`selfimprove/runs/*.jsonl`) is gitignored.
