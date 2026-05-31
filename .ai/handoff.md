# Handoff

UPDATED: 2026-05-31 by claude
CURRENT TASK: mobile-pipeline marketplace — convert cmp into a multi-harness plugin marketplace
(`mp-spec` + `mp-dev`) modelled on `D:\tools\ai-team-bootstrap`; migrate diet_helper & MyMoney_app.
Approved plan: `C:\Users\k.shavrin\.claude\plans\noble-questing-muffin.md`. Brief: `.ai/tasks/claude-003-marketplace.md`.
STATUS: **DONE for v1.4.0** — marketplace + both plugins emitted/validated; 3 projects wired; docs +
VERSION + change-log updated. Branch: `feat/mobile-pipeline-marketplace`. **No commits yet** (awaiting
user go-ahead). Follow-ups + manual cleanup remain (below).

## DONE (claude, this session)
- **Phase 0** — verified plugin mechanics vs code.claude.com: Claude plugins carry `agents/`;
  `${CLAUDE_PLUGIN_ROOT}`; `enabledPlugins` object-map; Codex plugins = skills only (no sub-agents);
  local marketplace source `{"source":"directory","path":...}`.
- **Marketplace** — `.claude-plugin/marketplace.json` + `.agents/plugins/marketplace.json` (name
  `mobile-pipeline`, plugins `mp-spec` + `mp-dev`). `claude plugin validate .` ✔. Registered locally
  for test (`~/.claude/settings.json`); undo: `claude plugin marketplace remove mobile-pipeline`.
- **`lib/build-marketplace.sh`** — generator (canonical `templates/` → plugin trees). `bash -n` clean.
- **`mp-spec`** — `claude-plugins/mp-spec` (skill `/mp-spec` + 17 sub-agents + 25 prompts) +
  `codex-plugins/mp-spec` (skill only). 0 placeholder/tool leaks; validate ✔.
- **`mp-dev`** — `claude-plugins/mp-dev` (Claude-only): `/mp` + 11 agents + 2 scripts, de-specialized
  (runtime `.claude/mp/config.json` + `CLAUDE.md` + `.claude/mp/extras/*.md`; `${CLAUDE_PLUGIN_ROOT}`
  scripts). 0 leaks; scripts `bash -n` clean; validate ✔.
- **Projects wired** (downstream, outside this repo, additive + reversible — NO deletions):
  - `D:\Pet\TDD_creater\MyMoney` (spec staging) → `mp-spec`.
  - `D:\Pet\TDD_creater\MyMoney_app` → `mp-spec` + `mp-dev` + `.claude/mp/config.json` +
    `.claude/mp/extras/` (from `cmp-mymoney/`); `.codex` `max_threads` 4→6.
  - `D:\diet_helper` → `mp-spec` + `mp-dev` + `.claude/mp/config.json` + `.claude/mp/extras/`.
- **Docs/version** — `docs/MARKETPLACE.md` (full guide incl. manual-cleanup lists), README section,
  `install-spec.sh` superseded-note, `VERSION`→1.4.0, `CHANGELOG.md` [1.4.0], change-log entries
  (`2026-05-31T10:00/10:05/10:10`).

## OWNERSHIP BOUNDARY (re: codex-001 — respected)
- Did NOT edit `bootstrap.sh`, `lib/render.sh`, or `templates/**/scripts/*.sh` (codex-owned). The
  generator reads templates and writes transformed COPIES into the plugin trees only.
- `lib/build-marketplace.sh` is additive (claude-owned); may later merge with `lib/sync.sh`.

## NEXT / FOLLOW-UPS (open, ordered)
1. **User:** verify `/mp-spec` + `/mp` in a session (`/plugin` → enable). Then run the **manual
   cleanup** of superseded `cmp-*`/`dh-*` locals + diet_helper PowerShell `build`/`test` commands —
   exact paths in `docs/MARKETPLACE.md` (kept in place per never-delete rule).
2. Fold diet_helper `intake`/`knowledge` + MyMoney `planner` into canonical `mp-dev`.
3. Per-project Codex **dev** agent generation (`.codex/agents/mp-*.toml` from `mp-*.md`).
4. After `git push`: switch the 3 projects' `extraKnownMarketplaces` from `directory` → `git` source.
5. **[codex]** codex-001 (render `tool:` axis, `lib/sync.sh`, `bootstrap --tools`) still open + codex-owned.

## DECISIONS (+ why)
- Names: marketplace `mobile-pipeline`; `/mp` (dev), `/mp-spec` (spec). Unified `mp` prefix (user).
- `mp-dev` built from `templates/common`+`android` (generic, complete) via plugin-mode generator —
  not from MyMoney_app's `cmp-*` (which carry MyMoney-specifics). MyMoney_app keeps its project-
  specific `cmp-planner`/`--phase`/`--check`/`--device`/`--plan` local; generic agents come from plugin.
- Migration is ADDITIVE: marketplace + config + extras added; old local agents LEFT in place and
  listed for manual removal (never-delete rule). `cmp-*`/`dh-*` vs plugin `mp-*` names don't collide.
- mp-spec keeps `platform:` markers inert (matches install-spec); mp-dev strips them to android.

## CONTEXT LINKS
- Guide: `docs/MARKETPLACE.md`. Generator: `lib/build-marketplace.sh`. Brief: `.ai/tasks/claude-003-marketplace.md`.
- Reference pattern: `D:\tools\ai-team-bootstrap`.
