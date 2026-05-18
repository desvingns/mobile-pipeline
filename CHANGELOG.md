# Changelog

All notable changes to `claude-mobile-pipeline` (cmp) are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This repo uses [Semantic Versioning](https://semver.org/) — see `README.md` → Versioning.

## [Unreleased]

## [1.0.0] — 2026-05-18

Initial release. Templates extracted from the `diet_helper` Android project after
6 iterations of in-project refinement (memory infra, STATE/ROADMAP artifacts, brainstorm
phase, verification gate, TDD red-green mode).

### Added

- Repo skeleton: `templates/{common,android,ios}/`, `lib/`, `docs/`, `eval/`, `examples/`.
- `bootstrap.sh` — single entry point, copy + render + memory + version stamp.
- `lib/render.sh`, `lib/detect.sh`, `lib/prompts.sh` — cross-platform helpers (Linux + macOS + Windows Git Bash).
- Common agents (platform-agnostic): `architect`, `docs`, `reviewer-base`.
- Common command: `<prefix>.md` orchestrator with `--discuss`, `--feature` (default + `--tdd`), `--bugfix` workflows; Phase 0 brainstorm trigger; Step 4.5 verification gate.
- Common snippets: `green-phase-mode.md`, `test-rules.md`, `manual-checklist-prompt.md`, `runner-json-shape.md`.
- Common root templates: `CLAUDE.md.tmpl`, `STATE.md.tmpl`, `ROADMAP.md.tmpl`, `DOCUMENTATION.md.tmpl`.
- Common memory: 6 generic templates + index generator.
- Android agents: `developer-android`, `tester-android`, `verifier-android`, `reviewer-android`, `runner-android`.
- Android snippets: `jbr-detect.sh`, `gradle-commands.md`.
- Android memory: `cross-platform-bash-jbr`, `dao-test-config-trap`, `room-upsert-by-pk-not-unique`, `screen-content-extraction`.
- iOS stubs: developer / tester / verifier / reviewer / runner — minimal frontmatter + TODO sections.
- iOS snippets: `xcode-detect.sh`.
- iOS memory: `cross-platform-bash-xcode`, `view-extraction`.
- Docs: `USAGE.md`, `CUSTOMIZATION.md`, `UPGRADE.md`, `ADDING-PLATFORM.md`, `ARCHITECTURE.md`.
- `eval/README.md` — placeholder for future eval framework.

### Not included (deferred)

- `bootstrap.sh --upgrade` — manual upgrade flow. Add when ≥1 project needs to pull cmp improvements.
- Real iOS agent content beyond stubs — fill in when first iOS project starts.
- Eval framework (`cmp-grader` agent) — add after ≥10 pipeline runs accumulate as eval cases.
- Vector DB for memory — current plain-MD + index is sufficient at ≤15 memos per project.
- PostToolUse hooks for output sandboxing — runner-level `grep | tail` is sufficient until proven otherwise.
