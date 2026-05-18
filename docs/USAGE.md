# USAGE — `bootstrap.sh`

Single entry point for generating a new mobile project's `.claude/` infrastructure from
cmp templates.

## Synopsis

```
bootstrap.sh --platform=<list> --prefix=<word> --project-name="<string>" [options]
```

## Required flags

| Flag | Meaning | Example |
|---|---|---|
| `--platform` | Comma-separated list. Supported: `android`, `ios`. | `--platform=android` or `--platform=android,ios` |
| `--prefix` | Lowercase short word [a-z][a-z0-9_]{1,8}. Becomes slash-command name `/<prefix>` and agent prefix `<prefix>-*`. | `--prefix=ft` |
| `--project-name` | Human-readable project name. Used in CLAUDE.md / STATE.md titles. | `--project-name="Fitness Tracker"` |
| `--package` | Reverse-DNS package. Required if `android` in `--platform`. Validates `^[a-z]+(\.[a-z][a-z0-9_]*)+$`. | `--package=com.example.fitness` |

## Optional flags

| Flag | Default | Meaning |
|---|---|---|
| `--ui-lang` | `en` | UI language for user-facing strings. Affects `developer` agent's "User-facing strings in <lang>" rule. Common: `en`, `ru`. |
| `--memory-path` | derived from cwd | Where memory templates land. Default: `~/.claude/projects/<sanitised-cwd>/memory/` (Claude Code convention). |
| `--arch` | `clean` | Architecture style. `clean` enables `architecture-clean-rationale.md` memo. Other values currently skip it. |
| `--force` | off | Overwrite existing files in target. Without this, bootstrap stops if `.claude/`, `CLAUDE.md`, `STATE.md`, etc. already exist. |
| `--skip-memory` | off | Skip `~/.claude/projects/.../memory/` creation. Useful for re-bootstrapping an existing project. |
| `--dry-run` | off | Print actions, write nothing. |
| `--non-interactive` | off | Fail instead of prompting if a required flag is missing. |
| `--no-git` | off | Don't warn if cwd is not a git repo. |

## Examples

### Android only, Russian UI, learning project

```bash
bash ~/work/claude-mobile-pipeline/bootstrap.sh \
    --platform=android \
    --prefix=ft \
    --project-name="Fitness Tracker" \
    --package=com.example.fitness \
    --ui-lang=ru
```

After this, in Claude Code: `/ft --discuss добавить таб с историей тренировок`.

### iOS only, English UI

```bash
bash ~/work/claude-mobile-pipeline/bootstrap.sh \
    --platform=ios \
    --prefix=cn \
    --project-name="Cookbook Notes"
```

Note: iOS templates are stubs in cmp v1.0.0 — they have the right structure but need
real prompt content for your stack. See `docs/CUSTOMIZATION.md`.

### Cross-platform (Android + iOS sharing the same workflow)

```bash
bash ~/work/claude-mobile-pipeline/bootstrap.sh \
    --platform=android,ios \
    --prefix=mt \
    --project-name="Memo Time" \
    --package=com.example.memo
```

Both platform agent sets are created: `mt-developer-android`, `mt-developer-ios`, etc.
The orchestrator command `/mt` picks the right agent set per `--platform` flag at run time.

### Dry run before committing

```bash
bash ~/work/claude-mobile-pipeline/bootstrap.sh \
    --platform=android --prefix=ft --project-name="Test" --package=com.x.y \
    --dry-run
```

## What gets created

In the **current working directory** (assumed project root):
- `.claude/agents/<prefix>-*.md` — specialist agents for selected platforms
- `.claude/commands/<prefix>.md` — orchestrator
- `.claude/specs/README.md` — brainstorm artifacts directory marker
- `.claude/.cmp-version` — stamp with cmp version + bootstrap settings
- `CLAUDE.md`, `STATE.md`, `ROADMAP.md`, `DOCUMENTATION.md` — root project files

In **Claude Code user memory** at `~/.claude/projects/<sanitised-cwd>/memory/`:
- `MEMORY.md` — auto-generated index
- 6 common memos + N platform memos (4 for android, 2 for ios)

## What does NOT get created

- `.gitignore` (your project likely has one — bootstrap doesn't touch it)
- `~/.claude/settings.json` (user-level config — bootstrap leaves alone)
- Source code (this is `.claude/` infrastructure only, not a project scaffold)

## Exit codes

- `0` — success
- `1` — invalid flags / validation failure
- `2` — preflight check failed (existing files without `--force`)
- `3` — render error (sed failure, missing template file)
