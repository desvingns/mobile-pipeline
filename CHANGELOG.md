# Changelog

All notable changes to `claude-mobile-pipeline` (cmp) are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This repo uses [Semantic Versioning](https://semver.org/) — see `README.md` → Versioning.

## [Unreleased]

## [1.4.0] — 2026-05-31

### Added

- **Multi-harness plugin marketplace (`mobile-pipeline`)** — cmp can now be consumed as a plugin
  marketplace (modelled on the multi-harness `ai-team-bootstrap` pattern), not only copy-per-project
  via `bootstrap.sh`. New `.claude-plugin/marketplace.json` (Claude) + `.agents/plugins/marketplace.json`
  (Codex) list two plugins:
  - **`mp-spec`** — the `app-spec-creator` skill (invoked as `/mp-spec`) + its 17 sub-agents →
    `claude-plugins/mp-spec/` (Claude: skill + agents) and `codex-plugins/mp-spec/` (Codex: skill
    only — Codex plugins can't carry sub-agents; the `.codex/agents/*.toml` roster stays per-project).
  - **`mp-dev`** — the dev orchestrator (`/mp`) + specialist agents + deterministic scripts →
    `claude-plugins/mp-dev/` (Claude-only). De-specialized: generic agent bodies read project facts
    from `.claude/mp/config.json` + `CLAUDE.md` + `.claude/mp/extras/*.md` at runtime; scripts resolve
    via `${CLAUDE_PLUGIN_ROOT}`.
- **`lib/build-marketplace.sh`** — generator that emits both plugin trees from the canonical
  `templates/` (one source → per-tool adapters). `bootstrap.sh` and `templates/**/scripts/*.sh` are
  untouched, so the legacy copy-per-project bootstrap stays byte-compatible.
- Projects consume the marketplace via `.claude/settings.json` (`extraKnownMarketplaces` +
  `enabledPlugins`). Wired into `diet_helper`, `MyMoney_app`, and the MyMoney spec-staging folder.
- **Folded into canonical `mp-dev`**: `{{PREFIX}}-intake` (SPEC synthesis from Q&A), `{{PREFIX}}-knowledge`
  (post-ship lesson routing), `{{PREFIX}}-planner` (the `/mp-spec` bundle → `.claude/specs/backlog/`
  bridge, generic — replaces MyMoney's PROGRESS.md-specific planner), and `{{PREFIX}}-improve`. New
  orchestrator workflows `--plan` and `--improve` + a post-ship Knowledge step.
- **Self-improvement → PR workflow**: a lesson found while running `/mp` in a downstream project can be
  routed by `{{PREFIX}}-knowledge` as PLUGIN-LEVEL → `/mp --improve` drafts a patch against the
  canonical `templates/` (via `{{PREFIX}}-improve`) and, behind a gate, branches mobile-pipeline,
  regenerates the plugin trees, and opens a PR (`scripts/{{PREFIX}}-propose-improvement.sh`). Project
  source is never touched; mobile-pipeline is changed only via a reviewed PR.
- **diet_helper migrated to `/mp`**: its generic `dh-*` agents, `dh.md`, deterministic scripts, and the
  PowerShell `build`/`test` commands moved to `.claude/_archive_pre_mp/` (reversible; never deleted).
- **SPEC backlog board** — `.claude/specs/` in a generated project is now a file-based task board
  (`backlog/` / `active/` / `done/`; a SPEC's status is the folder it lives in). The orchestrator's
  `--feature` Phase 1 splits a large feature into ≥2 ordered SPEC files written to `backlog/`
  (behind one y/N gate), promotes the first to `active/`, then moves it to `done/` on ship. Epics
  group by a `<epic-slug>-NN-<short>.md` filename prefix + an optional `-00-overview.md` index. New
  `## SPEC backlog board` section + a Rules bullet in `templates/common/commands/{{PREFIX}}.md`;
  full contract in `templates/common/specs/README.md`; `bootstrap.sh` now emits the
  `backlog/active/done` board folders (each with a `.gitkeep`) into new projects.
  Additive — single-SPEC features and the `--discuss` brainstorm-artifact flow are unchanged.
  (VERSION bump to 1.4.0 deferred to release time per SemVer: additive = MINOR.)
- **`--spec` + backlog-consume** — `/{{PREFIX}} --spec <desc>` authors SPEC(s) and writes them
  straight to `.claude/specs/backlog/` as `Status: draft` (no code, no approval gate) — fills the
  backlog ahead of time. `/{{PREFIX}} --feature --next` (or `--backlog <slug>`) implements a SPEC
  already in the backlog: it is treated as already created + approved, so Phase 0/1 are skipped —
  the file moves `backlog/ → active/`, runs Phase 2, then `active/ → done/`. Usage block, Rules,
  and the specs-README lifecycle (new `draft` status) updated accordingly.

## [1.3.0] — 2026-05-29

Spec-creation half: a global `app-spec-creator` spec pipeline and its installer. Produces a
complete, traceable `spec/` bundle from a brand-new app idea (greenfield interview) or from
screenshots of an existing app (clone). Dual-harness: installs once into `~/.claude/` and/or
`~/.codex/` via `install-spec.sh`.

### Added

- **`templates/spec/`** — new template group: 17 canonical agent specs
  (`templates/spec/agents/*.md`), the `app-spec-creator` skill
  (`templates/spec/skills/app-spec-creator/SKILL.md`), and an independently-versioned prompt
  library (`prompts/`). Supersedes `app-tdd-creator` (kept as deprecation shim).
- **`install-spec.sh`** — global installer. Flags: `--harness claude|codex|both` (default
  `both`), `--home DIR`, `--dry-run`, `--force`. Claude form: copies skill + 17 `.md` agents
  into `~/.claude/`. Codex form: copies skill + `.md` agents + generates `.toml` native
  subagent shims + appends `[agents]` to `~/.codex/config.toml` (`max_threads=6`,
  `max_depth=1`).
- **Codex adapters** — per-agent `.toml` shims (re-read the canonical `.md`) so specialists
  run as native Codex subagents; `config-fragment.toml` with the required `[agents]` settings.
- **Spec→dev handoff docs** — portable handoff path (`traceability.csv` + `design.md` +
  `acceptance/*.feature`) described; optional per-project spec-bridge pattern documented
  (reference: MyMoney `cmp-planner-android`); generic `--from-spec` dev-pipeline flow noted
  as a known follow-up (deferred until `lib/sync.sh` `tool:` strip lands).
- **`docs/SPEC-PIPELINE.md`** — full guide: overview of both cmp halves, install, `spec/`
  bundle anatomy, 17-agent table, two intake modes + two gates + evaluator loop, dual-harness
  mechanics (Claude vs Codex, `.toml` shim idiom, config caveat), and spec→dev handoff.

### Migration notes (1.2 → 1.3)

- No changes to existing per-project dev-pipeline templates. `bootstrap.sh` and all `templates/
  {common,android,ios}/` are unchanged — existing projects are unaffected.
- Run `./install-spec.sh` once to get the spec tool globally. Existing `~/.claude/skills/
  app-spec-creator/` (if any, from a pre-template install) must be removed or use `--force`.

## [1.2.0] — 2026-05-28

On-device instrumented testing. The pipeline gains a dedicated runner for
`connectedDebugAndroidTest` and a small `--device` workflow that writes and runs ONE Compose-UI
test on a connected device/emulator at a time — sized so a less-capable model stays on rails.
A connected device is now mandatory for on-device runs, with an ask-the-user-and-remember rule.

### Added

- **`{{PREFIX}}-runner-instrumented-android`** — new Android agent (model: haiku) that runs ONE
  instrumented test class on a connected device/emulator and returns parsed pass/fail JSON. Trusts
  the connected report XML, never "BUILD SUCCESSFUL". A connected device is mandatory; with none it
  returns a "no device connected" error (it cannot prompt — the orchestrator asks). Distinct from the
  JVM-only `{{PREFIX}}-runner-android`.
- **Orchestrator** — new `--device <screen|scope>` workflow (Android only): mandatory device-connection
  gate (ask the user + record to the `device-connection` memo if missing/lost), then write ONE
  instrumented Compose-UI test for an uncovered control → run via the instrumented runner → report.
  One control per invocation; never pushes.
- **`device-connection` memory template** (android) — records the verified device/emulator connection
  so it is not re-asked; the mandatory/ask/update-if-lost rule lives here.
- **`{{PREFIX}}-tester-android`** — new "instrumented-compose-ui (on a real device)" test type:
  one `@Test` per `--device` slice, real-device `AndroidJUnit4` + `createComposeRule` pattern, strings
  via resources, missing-seam policy (testTag/contentDescription/public only, never invent UI).
- **`{{PREFIX}}-developer-android`** — new "Device-test seams" section: a `--device` seam is limited to
  testTag / contentDescription / `<Name>Content` public visibility; no new UI/events.
- **`{{PREFIX}}-reviewer-base`** — Check 7 (Device-test seam scope): a `--device` production diff must
  not add behaviour beyond a declared seam.

### Changed

- `bootstrap.sh` dry-run preview lists the new `runner-instrumented-android` agent (the copy loop
  already globs `templates/<plat>/agents/*.md`, so it is generated automatically).

### Migration notes (1.1 → 1.2)

- Re-bootstrap, or copy the new files by hand: `templates/android/agents/{{PREFIX}}-runner-instrumented-android.md`
  and `templates/android/memory/device-connection.md.tmpl`, plus the `--device` workflow + Rules in
  `templates/common/commands/{{PREFIX}}.md` and the device sections in the tester/developer/reviewer
  templates. No existing agent signatures changed — purely additive.

## [1.1.0] — 2026-05-19

Test-coverage hardening: the pipeline now enforces "every new prod class has a dedicated
test file" and "tests are clean" alongside the existing layer-boundary checks. Runner gains
Android Lint and JaCoCo coverage threshold. New optional `--coverage` workflow surfaces
weak packages on demand. Design notes for local-LLM delegation added but not yet
implemented.

### Added

- **`{{PREFIX}}-tester-<plat>`** — new "Mandatory Coverage Rules" section. Every new prod
  file in CHANGED_FILES requires a matching dedicated test file (no use-case grouping).
  Return JSON gains `missing_content_extraction` and `coverage_exceptions` fields.
- **`{{PREFIX}}-tester-android`** — new "navigation" test type for `AppNavHost.kt` changes
  (TestNavHostController pattern).
- **`{{PREFIX}}-runner-android`** + script — adds Android Lint (`:app:lintDebug`) and
  JaCoCo coverage threshold (`:app:jacocoUnitTestReport` → XML parse, default 65%). Return
  JSON gains `lint` and `coverage` fields. Script takes second positional arg
  `target_coverage_pct`.
- **`{{PREFIX}}-runner-ios`** — `target_coverage` support via xccov parsing.
- **`{{PREFIX}}-reviewer-base`** — Check 6 (Test Hygiene): bans `@Ignore` without
  TODO/issue ref, empty `@Test`, trivially-true assertions, `Thread.sleep`, `runBlocking`
  in tests.
- **`{{PREFIX}}-reviewer-android`** + script — concrete grep commands for Check 6.
- **`{{PREFIX}}-verifier-<plat>`** — Check 5 (`tests_exist`): for each new prod file, the
  matching dedicated test file must exist (or be explicitly excepted by tester).
- **`{{PREFIX}}-coverage-android`** — new on-demand read-only agent that parses JaCoCo XML
  and reports weak packages with concrete "test this next" suggestions.
- **Orchestrator** — new `--coverage [<scope>] [--target=N]` workflow (Android only,
  diagnostic, read-only).
- **`docs/local-llm/`** — design notes for delegating shaped/mechanical subtasks to a small
  local LLM (≤6 GB VRAM): models, integration options (MCP / bash-curl / router), task
  ranking (Tier S / A / B / F), draft prompts, failure modes. **No implementation in cmp
  v1.1 — these are notes for a future iteration.**

### Changed

- `templates/common/agents/{{PREFIX}}-reviewer-base.md` Concept section grows from four
  layer-boundary checks to six (adds design-system and test-hygiene concepts at the
  framework-agnostic level).
- Runner agent JSON shape gains `lint` and `coverage` keys — projects upgrading from 1.0
  must update any logic that parses the runner output.

### Migration notes (1.0 → 1.1)

- Re-bootstrap or merge templates by hand. The reviewer / runner script signatures changed
  (runner accepts a second positional arg). Orchestrators in already-shipped projects can
  continue passing only the first arg — coverage defaults to 65 when omitted.
- If your project does not yet have `jacocoUnitTestReport` configured in `app/build.gradle.kts`,
  the runner's Step 4 will emit `"coverage": "unknown"` and fail-close. Either add the
  JaCoCo task (recommended, see `diet_helper/app/build.gradle.kts` for a working example)
  or pass `target_coverage=0` to disable the gate.
- Existing test files with grouped use-case tests (`<Group>UseCasesTest.kt`) are tolerated;
  the no-grouping rule applies only to NEW use cases added after upgrade.

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
