# Handoff

UPDATED: 2026-06-02 by claude

## LATEST (2026-06-02, claude) — flag rename `--fidelity` → `--fit`
Renamed the clone reference-comparison gate FLAG `--fidelity` → `--fit` repo-wide (Claude
`claude-plugins/**` + Codex `codex-plugins/**` + canonical `templates/**` + docs/README/playbook/eval).
Only the literal flag token changed; the "fidelity" CONCEPT is untouched (agent `mp-fidelity-android`,
`fidelity-checklist-author`, `spec/fidelity/` & `build/fidelity/` paths, `fidelity_score`, epic
`fidelity`, the Fidelity-gate phase). Historical `.ai/changes/agent-skill-log.md` entries left verbatim
(append-only) + new entry `2026-06-02T10:00-rename-fidelity-flag-to-fit` added; CHANGELOG `[Unreleased]`
updated. **Note:** `D:\Pet\TDD_creater\MyMoney(_app)` has NO `--fidelity` flag (older `cmp`-prefix
bootstrap predating the gate) — nothing to rename there. Codex: pick up the log entry on next sync.

---

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

## ALSO DONE (later this session)
- **mp-spec plugin cleanup (codex)** — `lib/build-marketplace.sh` now rewrites marketplace output from
  legacy `app-spec-creator` naming to `mp-spec` and changes Claude spec-agent prompt reads to
  `${CLAUDE_PLUGIN_ROOT}/skills/mp-spec/prompts/...`. Regenerated `claude-plugins/mp-spec` and
  `codex-plugins/mp-spec`. Verified with bash syntax, dry-run generation, Claude plugin validation,
  leak greps, JSON parsing, `git diff --check`, and `python -m graphify update .`.
- **Folded** `mp-intake` / `mp-knowledge` / `mp-planner` (generic /mp-spec→backlog bridge) / `mp-improve`
  into canonical mp-dev (15 agents now) + orchestrator `--plan` / `--improve` + post-ship Knowledge step
  + `scripts/{{PREFIX}}-propose-improvement.sh`. validate ✔, 0 leaks.
- **Self-improvement → PR loop** implemented (mp-knowledge routes PLUGIN-LEVEL lessons → `/mp --improve`
  → mp-improve stages a templates/ patch → gated `propose-improvement.sh` branches+regenerates+PRs).
  Documented in `docs/MARKETPLACE.md` → "Improvement workflow".
- **diet_helper cleaned up** — generic `dh-*` + `dh.md` + scripts + PowerShell `build`/`test` +
  folded `dh-intake`/`dh-knowledge` MOVED to `diet_helper/.claude/_archive_pre_mp/` (never deleted).
  Uses `/mp` now; `selfimprove-retro.md` kept.
- **Codex model tiering (codex)** — `install-spec.sh --harness codex` now emits explicit
  `model` + `model_reasoning_effort` in every generated MP Spec TOML. The generated `mp-spec` skill
  documents the tiers, and `mp-dev` maintainer/command templates + marketplace docs now define the
  future Codex dev-agent tier contract (`mini` for mechanical/checking, `gpt-5.4` for standard
  authoring/analysis, `gpt-5.5` for frontier/critic work). Regenerated marketplace outputs and
  validated temp Codex install + manifests.

## NEXT / FOLLOW-UPS (open, ordered)
1. **User:** verify `/mp-spec` + `/mp` in a session (`/plugin` → enable).
2. **MyMoney_app dev migration** (deferred by design — bespoke `--phase`/`--check`/`--plan` + `cmp.md`
   depends on local `cmp-*`). Rewire `cmp.md` `cmp-*`→`mp-*` then archive generic `cmp-*`; verify. NOT a blind archive.
3. **Finish the local folder rename** — repo renamed on GitHub to `mobile-pipeline`; the working folder
   is still `D:\Pet\claude-mobile-pipeline` (cwd-locked). User: move it + repoint the 3 `directory`
   sources (or switch to the `git` source now that it's pushed). See final chat message.
4. Per-project Codex **dev** agent generation (`.codex/agents/mp-*.toml` from `mp-*.md`) using the
   now-documented fast/standard/powerful Codex tier policy.
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
