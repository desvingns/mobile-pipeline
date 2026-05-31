# claude-003 — mobile-pipeline plugin marketplace (Claude's half)

OWNER: claude
STATUS: done (v1.4.0) — base marketplace + mp-spec + mp-dev shipped; projects wired. Follow-ups listed.
RELATED: `docs/MARKETPLACE.md`, `lib/build-marketplace.sh`, `.ai/handoff.md`, `.ai/tasks/codex-001-dual-tool.md`

## Goal
Turn cmp from copy-per-project (`bootstrap.sh`) into a reusable **multi-harness plugin marketplace**
(`mobile-pipeline`), modelled on `D:\tools\ai-team-bootstrap`, so `diet_helper`, `MyMoney_app`, and
future mobile projects share one updatable source. (User request.)

## What was built
- Catalogs: `.claude-plugin/marketplace.json` (Claude), `.agents/plugins/marketplace.json` (Codex).
- `lib/build-marketplace.sh` — generator: canonical `templates/` → committed plugin trees. Reuses
  install-spec.sh-style render + `lib/render.sh` strip functions.
- `claude-plugins/mp-spec` (skill `/mp-spec` + 17 sub-agents) + `codex-plugins/mp-spec` (skill only).
- `claude-plugins/mp-dev` (Claude-only): `/mp` orchestrator + 11 specialist agents + 2 scripts,
  de-specialized (agent bodies read `.claude/mp/config.json` + `CLAUDE.md` + `.claude/mp/extras/*.md`;
  scripts via `${CLAUDE_PLUGIN_ROOT}`).
- Wired 3 projects via `.claude/settings.json` (+ `.claude/mp/config.json` + extras for the two apps);
  MyMoney_app `.codex` `max_threads` 4→6. Docs: `docs/MARKETPLACE.md`, README section; VERSION→1.4.0.

## Ownership boundary respected (re: codex-001)
- Did NOT edit `bootstrap.sh`, `lib/render.sh`, or `templates/**/scripts/*.sh` (codex-owned). The
  generator READS templates and writes transformed copies into the plugin trees only.
- `lib/build-marketplace.sh` is claude-owned and additive; it may later merge with `lib/sync.sh`
  when codex-001 ships it. Coordinate before merging.

## Follow-ups (open)
1. Fold diet_helper `intake`/`knowledge` + MyMoney `planner` into canonical `mp-dev`.
2. Per-project Codex **dev** agent generation (`.codex/agents/mp-*.toml` from `mp-*.md`).
3. After `git push`: switch project `extraKnownMarketplaces` from `directory` to a `git` source.
4. Manual cleanup of superseded `cmp-*` / `dh-*` locals (listed in `docs/MARKETPLACE.md`).
