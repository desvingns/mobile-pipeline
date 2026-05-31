# MARKETPLACE — `mobile-pipeline` plugin marketplace

cmp can be consumed as a **multi-harness plugin marketplace** (modelled on the proven
`ai-team-bootstrap` pattern) instead of copy-per-project via `bootstrap.sh`. One canonical source in
`templates/`, emitted into committed plugin trees, enabled per project. Edit once → regenerate →
every project picks it up.

## What ships

| Plugin | Slash | Harness | Contents |
|--------|-------|---------|----------|
| `mp-spec` | `/mp-spec` | Claude (skill + agents), Codex (skill only) | Spec-bundle creator (renamed from `app-spec-creator`) + 17 analysis sub-agents |
| `mp-dev`  | `/mp`     | Claude only | Dev orchestrator + specialist agents (architect, developer, reviewer, tester, runner, verifier, docs, …) + deterministic scripts |

**Why Codex differs:** Claude plugins can carry sub-agents (`agents/`); Codex plugins carry only
`skills`/`.mcp.json`/`.app.json`. So Codex gets the `mp-spec` *skill* via the marketplace, but the
sub-agent roster (`.codex/agents/*.toml`) is installed **per project** (via `install-spec.sh` for
spec; per-project generation for dev — see below).

## Layout

```
mobile-pipeline/                          # this repo (rename optional — see bottom)
├── .claude-plugin/marketplace.json       # Claude marketplace catalog
├── .agents/plugins/marketplace.json      # Codex marketplace catalog
├── claude-plugins/
│   ├── mp-spec/{.claude-plugin/plugin.json, skills/mp-spec/{SKILL.md,prompts/}, agents/*.md}
│   └── mp-dev/{.claude-plugin/plugin.json, commands/mp.md, agents/mp-*.md, scripts/mp-*.sh}
├── codex-plugins/
│   └── mp-spec/{.codex-plugin/plugin.json, skills/mp-spec/{SKILL.md,prompts/}}
├── templates/                            # CANONICAL source (unchanged; bootstrap.sh still uses it)
└── lib/build-marketplace.sh              # generator: templates/ → plugin trees
```

## Enable in a project (Claude)

Add to the project's `.claude/settings.json` (merge with existing keys):

```json
{
  "extraKnownMarketplaces": {
    "mobile-pipeline": { "source": { "source": "directory", "path": "D:\\Pet\\claude-mobile-pipeline" } }
  },
  "enabledPlugins": { "mp-spec@mobile-pipeline": true, "mp-dev@mobile-pipeline": true }
}
```

Then in a Claude Code session: `/plugin` → confirm `mp-spec` / `mp-dev` are enabled → use `/mp-spec`
and `/mp`. (Or register globally once: `claude plugin marketplace add <path>`.)

> The `directory` source is **machine-local**. After you `git push` this repo to a remote, swap it
> for a portable git source:
> ```json
> "mobile-pipeline": { "source": { "source": "git", "url": "https://…/mobile-pipeline.git" }, "autoUpdate": true }
> ```

## Enable in a project (Codex)

```bash
codex plugin marketplace add /d/Pet/claude-mobile-pipeline   # or the git URL
codex plugin add mp-spec@mobile-pipeline
```
Codex sub-agents (spec): `./install-spec.sh --harness codex` writes `~/.codex/agents/*.toml` +
`[agents]` config (needs `max_threads >= 6`). Codex dev agents are not yet auto-generated — see
"Follow-ups".

## `mp-dev` runtime config (per project)

The plugin agents are project-agnostic; project facts are read at runtime from
**`.claude/mp/config.json`**:

```json
{
  "projectName": "MyMoney",
  "package": "com.kshavrin.mymoney",
  "packagePath": "com/kshavrin/mymoney",
  "platforms": ["android"],
  "sourceRoot": "app/src/main/java/com/kshavrin/mymoney",
  "stack": "Kotlin · Compose Material3 · Hilt · Room · …",
  "uiLang": "en"
}
```

Optional per-agent overrides go in **`.claude/mp/extras/<agent-name>.md`** (e.g.
`.claude/mp/extras/mp-developer-android.md`). Each agent reads its extras file *after* its body;
extras win on conflict. (This generalizes MyMoney_app's old `cmp-mymoney/*-extras.md` layer.)

## Regenerate after editing `templates/`

```bash
./lib/build-marketplace.sh           # emits claude-plugins/ + codex-plugins/
./lib/build-marketplace.sh --dry-run # preview
```
Transforms applied for `mp-dev`: `{{PREFIX}}`→`mp`; `{{PACKAGE}}`/`{{PACKAGE_PATH}}`→`<package>`/
`<pkg-path>` tokens; `{{PROJECT_NAME}}`→"the project"; `.claude/scripts/`→`${CLAUDE_PLUGIN_ROOT}/scripts/`;
`.claude/.cmp-version`→`.claude/mp/config.json`; `platform:`→android; a config-read preamble injected
after each agent's frontmatter. `bootstrap.sh` and `templates/**/scripts/*.sh` are never edited
(codex-owned; legacy bootstrap stays byte-compatible). Validate: `claude plugin validate .`.

## Manual cleanup of superseded local copies (do AFTER confirming `/mp` + `/mp-spec` work)

Per the never-delete rule these were left in place; remove them yourself once the plugins are
verified, so you don't run two divergent copies. Names differ (`cmp-*`/`dh-*` vs plugin `mp-*`) so
they coexist harmlessly until you remove them.

**MyMoney_app** (`D:\Pet\TDD_creater\MyMoney_app`):
- Remove generic locals now provided by the plugin: `.claude/agents/cmp-architect.md`,
  `cmp-docs.md`, `cmp-developer-android.md`, `cmp-reviewer-android.md`, `cmp-runner-android.md`,
  `cmp-runner-instrumented-android.md`, `cmp-tester-android.md`, `cmp-verifier-android.md`.
- Remove the old extras dir `.claude/cmp-mymoney/` (migrated to `.claude/mp/extras/`).
- **Keep** `.claude/agents/cmp-planner-android.md`, `selfimprove-retro.md`, and `.claude/commands/cmp.md`
  for the MyMoney-specific `--phase`/`--check`/`--device`/`--plan` flows (not in the generic plugin).

**diet_helper** (`D:\diet_helper`):
- Remove generic locals: `.claude/agents/{dh-architect,dh-developer,dh-docs,dh-reviewer,dh-runner,dh-tester,dh-verifier,dh-coverage}.md`,
  `.claude/scripts/{dh-runner.sh,dh-reviewer.sh}`, `.claude/commands/dh.md`.
- Remove the PowerShell commands `.claude/commands/build.md` + `.claude/commands/test.md`
  (**golden-rule violation** — PowerShell; superseded by the deterministic bash scripts in `/mp`).
- **Keep** `.claude/agents/{dh-intake,dh-knowledge}.md` + `selfimprove-retro.md` until their behaviour
  is folded into the plugin (see Follow-ups).

**Old global spec install** (if you ever ran `install-spec.sh` for Claude): remove
`~/.claude/skills/app-spec-creator` + the 17 `~/.claude/agents/<spec-agent>.md` to avoid duplicate
names with the `mp-spec` plugin.

## Follow-ups (not done in v1.4.0)

- Fold diet_helper's `intake`/`knowledge` agents and MyMoney's `planner` into the canonical
  `mp-dev` set (currently the plugin is the proven base pipeline only).
- Per-project Codex **dev** agent generation (`.codex/agents/mp-*.toml` from the plugin's `mp-*.md`).
- `lib/build-marketplace.sh` may later merge with the codex-owned `lib/sync.sh` (codex-001).

## Renaming the repo / folder (manual)

The marketplace `name` is already `mobile-pipeline`; the local folder is still
`claude-mobile-pipeline`. To rename the folder/remote (optional), do it yourself (it's the cwd):
`git remote set-url …`, move the directory, then update the `directory` source paths in the three
projects' `.claude/settings.json` (or switch to a git source).
