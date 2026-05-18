# claude-mobile-pipeline (cmp)

Reusable Claude Code agent pipeline for mobile projects (Android + iOS), with shared
workflow (`/discuss`, `/feature`, `/bugfix`, `/tdd`) and platform-specific specialists.

Battle-tested origin: extracted from a 6-iteration `diet_helper` Android project (Kotlin +
Compose + Hilt + Room) where the pattern was refined through real shipped features.

## What you get

Run `bootstrap.sh` in any new mobile project and you get:

- **Orchestrator command** `/<prefix>` with workflows: `--discuss`, `--feature` (default and
  `--tdd`), `--bugfix`.
- **Specialist agents**: architect (brainstorm), developer (per platform), reviewer (Clean
  Arch boundaries), tester (per platform), runner (per platform), verifier (per platform),
  docs (STATE/DOC/CLAUDE keeper).
- **Live state files** at the project root: `STATE.md` (current), `ROADMAP.md` (planned),
  `DOCUMENTATION.md` (history) — automatically maintained by the `docs` agent.
- **Cross-session memory** at `~/.claude/projects/<sanitized>/memory/` — preferences,
  traps, conventions that survive across sessions.
- **Brainstorm artifacts** at `.claude/specs/` — persistent records of `--discuss` runs.

## Supported platforms

| Platform | Status | Stack assumptions |
|----------|--------|-------------------|
| Android  | Stable | Kotlin · Compose · Hilt · Room · Robolectric · Roborazzi |
| iOS      | Stubs (v1.0) — workable starting point, fill in for your stack | SwiftUI · Combine · XCTest · ViewInspector · snapshot-testing-swift |
| Flutter / React Native | Not yet — see `docs/ADDING-PLATFORM.md` for how to extend | — |

Single-platform projects: pass `--platform=android` or `--platform=ios`. Cross-platform
(shared workflow over both targets): `--platform=android,ios`.

## Quick start

```bash
# Android, Russian UI, with custom prefix
bash /path/to/claude-mobile-pipeline/bootstrap.sh \
    --platform=android \
    --prefix=ft \
    --project-name="Fitness Tracker" \
    --package=com.example.fitness \
    --ui-lang=ru

# iOS minimal (stubs — you'll need to flesh out the agent prompts)
bash /path/to/claude-mobile-pipeline/bootstrap.sh \
    --platform=ios \
    --prefix=cn \
    --project-name="Cookbook Notes"

# Cross-platform shared workflow
bash /path/to/claude-mobile-pipeline/bootstrap.sh \
    --platform=android,ios \
    --prefix=mt \
    --project-name="Memo Time" \
    --package=com.example.memo
```

After bootstrap: edit `ROADMAP.md` to add Iteration 1, then run `/<prefix> --discuss <topic>`
in Claude Code to start.

## Docs

- `docs/USAGE.md` — full `bootstrap.sh` flags, examples for each platform
- `docs/ARCHITECTURE.md` — agent graph, how context flows between agents, why each layer exists
- `docs/CUSTOMIZATION.md` — how to adapt templates for your stack (different DI / DB / test framework)
- `docs/UPGRADE.md` — how to pull cmp improvements into an existing project (`--upgrade` flow)
- `docs/ADDING-PLATFORM.md` — how to add a new platform (Flutter, React Native) to cmp

## Versioning

This repo follows [SemVer](https://semver.org/):

- **PATCH** — wording fixes, typos (safe to auto-merge into existing projects)
- **MINOR** — new agents, optional sections (review before merging into existing projects)
- **MAJOR** — breaking changes (renames, JSON shape changes between agents)

Current version: see `VERSION`. Each bootstrap stamps `.claude/.cmp-version` into the target
project so future upgrades know where to start the diff.

## License

[Choose your license — recommended: MIT for templates]
