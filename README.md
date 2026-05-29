# claude-mobile-pipeline (cmp)

Reusable Claude Code agent pipeline for mobile projects (Android + iOS), with shared
workflow (`/discuss`, `/feature`, `/bugfix`, `/tdd`) and platform-specific specialists.

Battle-tested origin: extracted from a 6-iteration `diet_helper` Android project (Kotlin +
Compose + Hilt + Room) where the pattern was refined through real shipped features.

## What you get

Run `bootstrap.sh` in any new mobile project and you get:

- **Orchestrator command** `/<prefix>` with workflows: `--discuss`, `--feature` (default and
  `--tdd`), `--bugfix`, `--coverage` (Android, diagnostic).
- **Specialist agents**: architect (brainstorm), developer (per platform), reviewer (Clean
  Arch + design-system + test hygiene), tester (per platform — with Mandatory Coverage
  Rules), runner (per platform — with lint + JaCoCo threshold), verifier (per platform —
  with tests-exist check), docs (STATE/DOC/CLAUDE keeper), coverage (Android, opt-in).
- **Live state files** at the project root: `STATE.md` (current), `ROADMAP.md` (planned),
  `DOCUMENTATION.md` (history) — automatically maintained by the `docs` agent.
- **Cross-session memory** at `~/.claude/projects/<sanitized>/memory/` — preferences,
  traps, conventions that survive across sessions.
- **Brainstorm artifacts** at `.claude/specs/` — persistent records of `--discuss` runs.
- **Test-discipline guarantees** (1.1+) — every new production class lands with a dedicated
  test file; reviewer blocks the chain on disabled/empty/sleep-based tests; runner enforces
  a configurable JaCoCo coverage threshold; verifier blocks push on missing-test gaps.

## Supported platforms

| Platform | Status | Stack assumptions |
|----------|--------|-------------------|
| Android  | Stable | Kotlin · Compose · Hilt · Room · Robolectric · Roborazzi |
| iOS      | Stubs (v1.0) — workable starting point, fill in for your stack | SwiftUI · Combine · XCTest · ViewInspector · snapshot-testing-swift |
| Flutter / React Native | Not yet — see `docs/ADDING-PLATFORM.md` for how to extend | — |

Single-platform projects: pass `--platform=android` or `--platform=ios`. Cross-platform
(shared workflow over both targets): `--platform=android,ios`.

## Two halves

cmp ships two independent tools that can be used together or separately:

1. **Per-project dev pipeline** (`bootstrap.sh`) — the original cmp. Run once per project to
   install a `/<prefix>` orchestrator + specialist agents (architect, developer, reviewer,
   tester, runner, verifier) into `.claude/` / `.codex/`. See below.

2. **Global spec-creation tool** (`install-spec.sh`) — added in v1.3. Run once per machine to
   install `app-spec-creator` globally into `~/.claude/` and/or `~/.codex/`. Takes an app
   idea or screenshots of an existing app and produces a complete, traceable `spec/` bundle
   (EARS requirements, user stories, Gherkin acceptance criteria, platform-neutral design,
   NFR/a11y/security/analytics/risks/estimate, traceability matrix) with two human gates and
   an evaluator-optimizer critic. See `docs/SPEC-PIPELINE.md` for the full guide.

```bash
# Install the spec tool once (both Claude Code and Codex CLI)
./install-spec.sh

# Then from any session:
# /app-spec-creator --greenfield   (brand-new app — interview mode)
# /app-spec-creator ./screenshots  (clone an existing app)
```

---

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
- `docs/SPEC-PIPELINE.md` — spec tool: `install-spec.sh`, the `spec/` bundle, 17 agents, intake modes, dual-harness, handoff
- `docs/CUSTOMIZATION.md` — how to adapt templates for your stack (different DI / DB / test framework)
- `docs/UPGRADE.md` — how to pull cmp improvements into an existing project (`--upgrade` flow)
- `docs/ADDING-PLATFORM.md` — how to add a new platform (Flutter, React Native) to cmp
- `docs/local-llm/` — design notes for delegating shaped/mechanical subtasks to a small
  local LLM (≤6 GB VRAM). Not implemented yet — these are the trade-off analysis for a
  future iteration.

## Versioning

This repo follows [SemVer](https://semver.org/):

- **PATCH** — wording fixes, typos (safe to auto-merge into existing projects)
- **MINOR** — new agents, optional sections (review before merging into existing projects)
- **MAJOR** — breaking changes (renames, JSON shape changes between agents)

Current version: see `VERSION`. Each bootstrap stamps `.claude/.cmp-version` into the target
project so future upgrades know where to start the diff.

## License

[Choose your license — recommended: MIT for templates]
