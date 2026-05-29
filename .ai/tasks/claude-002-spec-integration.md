# claude-002 — spec-half integration (requirements → handoff)

OWNER: claude
STATUS: in-progress
OPENED: 2026-05-29

## Goal
Bring the **requirements→design→handoff** half into cmp (the repo so far covers the dev half).
Source: the `app-spec-creator` pipeline (a global skill + 17 agents + a harness-agnostic prompt
library) built in `~/.claude`. Ship it from this repo as a **global-install** spec tool, dual-harness
(Claude + Codex), without disturbing the per-project dev bootstrap or back-compat.

## Scope / files (claude owns these — NEW, additive)
- `templates/spec/` (NEW group): `skills/app-spec-creator/` (SKILL.md + prompts/), `agents/*.md`
  (17 canonical neutral specs), `codex/` (the `.toml` shim template + per-agent shims + `openai.yaml`
  + config fragment).
- `install-spec.sh` (NEW, repo root): cross-platform global installer → renders `{{AGENT_DIR}}` and
  copies the Claude form to `~/.claude` and the Codex form to `~/.codex` (shared prompts).
- `templates/common/commands/{{PREFIX}}.md`: a `--plan`/spec-handoff section (generic dev model).
- docs (USAGE/ARCHITECTURE/README), VERSION + CHANGELOG (MINOR), `.ai/` change-log + handoff.

## Coordination with codex-001 (Codex-owned, in-flight)
- I do NOT edit `bootstrap.sh`, `lib/render.sh`, or `lib/sync.sh` (codex-001's owned seams).
- `install-spec.sh` is a NEW standalone script (additive); later codex-001/sync.sh may fold spec
  install into `bootstrap.sh --install-spec`. The spec group already ships BOTH harness forms so it
  works before sync.sh exists. Flagged for Codex in the change-log + handoff.
- Reuse the agreed seams: `{{AGENT_DIR}}`, `<!-- tool:claude|codex -->`, change-log entry format.

## IN PROGRESS (files I hold — others don't touch)
- `templates/spec/**`, `install-spec.sh`

## NEXT
- neutralize prompt paths → `{{AGENT_DIR}}`; tool: markers on the 2 human gates; codex shims;
  installer; orchestrator handoff; docs; version; migration manifest (separate, outside repo).
