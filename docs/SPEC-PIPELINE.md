# SPEC-PIPELINE — app-spec-creator spec tool

This document covers the second half of cmp: a **global** spec-creation pipeline that takes a
mobile app idea (or screenshots of an existing app) and produces a complete, traceable spec
bundle ready for handoff to any dev pipeline. For the per-project dev bootstrap (`bootstrap.sh`),
see `README.md` and `docs/USAGE.md`.

## Two halves of cmp

| Half | Entry point | Installed where | What it does |
|---|---|---|---|
| **Dev pipeline** | `bootstrap.sh` | Per project: `.claude/` or `.codex/` | architect → developer → reviewer → tester → runner → verifier chain for iterative feature work |
| **Spec tool** | `install-spec.sh` | Once globally: `~/.claude/` and/or `~/.codex/` | Requirements elicitation → design → quality artifacts → validated `spec/` bundle |

Both halves are harness-neutral (Claude Code + Codex CLI) and follow the same golden rules:
cross-platform Bash, markdown-first, `{{AGENT_DIR}}` placeholder, `<!-- tool:* -->` conditional
blocks.

## Install

`install-spec.sh` copies the `templates/spec/` group into `~/.claude/` and/or `~/.codex/`.
Unlike `bootstrap.sh`, it is run **once per machine**, not once per project.

```bash
# Default: install for both Claude Code and Codex CLI
./install-spec.sh

# Claude Code only
./install-spec.sh --harness claude

# Codex CLI only
./install-spec.sh --harness codex

# Preview actions without writing
./install-spec.sh --dry-run

# Overwrite an existing install
./install-spec.sh --force

# Custom home (CI, non-standard $HOME)
./install-spec.sh --home /custom/home
```

### Flags

| Flag | Default | Meaning |
|---|---|---|
| `--harness claude\|codex\|both` | `both` | Which harness(es) to target |
| `--home DIR` | `$HOME` | Home directory root |
| `--dry-run` | off | Print planned actions, write nothing |
| `--force` | off | Overwrite existing install |

### What gets created

**Claude form** (`--harness claude`):
- `~/.claude/skills/app-spec-creator/SKILL.md` + `prompts/` library
- `~/.claude/agents/<agent-name>.md` — 17 canonical agent specs (claude form, `tool:codex` blocks stripped)

**Codex form** (`--harness codex`):
- `~/.codex/skills/app-spec-creator/SKILL.md` + `prompts/` library
- `~/.codex/agents/<agent-name>.md` — 17 canonical agent specs (codex form, `tool:claude` blocks stripped)
- `~/.codex/agents/<agent-name>.toml` — native Codex subagent shims that re-read the `.md`
- `[agents]` block appended to `~/.codex/config.toml` (`max_threads=6`, `max_depth=1`)

## Usage

After install, invoke from any Claude Code or Codex session:

```
/app-spec-creator                          # greenfield (no inputs = interview mode)
/app-spec-creator --greenfield             # explicit greenfield
/app-spec-creator ./screenshots            # clone mode — screenshots folder
/app-spec-creator ./screenshots --apk app.apk --play "https://play.google.com/store/apps/details?id=..."
/app-spec-creator --dry-run                # plan phases only, write nothing
```

Full flag reference is in `templates/spec/skills/app-spec-creator/SKILL.md`.

## Two intake modes

Both modes converge on the same `spec/` bundle. Everything downstream is mode-agnostic.

### Greenfield (5-stage interview)

For a brand-new app concept. The skill interviews the user in 5 progressive batches (≤4
questions each), each batch's answers constraining the next (anti-hallucination via
propose-then-confirm):

1. **Vision** — idea, audience, platform(s), monetization.
2. **Inventory** — JTBD; skill proposes candidate screen list, user confirms/edits.
3. **Flows** — per top-3 screens: key actions, validation, empty/error states.
4. **Data** — entities/relations (skill proposes, user prunes); auth; integrations; offline.
5. **Posture** — a11y target, locales, data sensitivity, analytics goals.

### Clone (screenshots + optional APK + Google Play)

For reverse-engineering an existing app. Reuses the `app-tdd-creator` analyzer fan-out:

- **Parallel Phase A**: `play-store-scraper`, `screenshot-business-analyzer`,
  `screenshot-style-analyzer`, `apk-analyzer` (if APK provided). APK is ground-truth for
  palette/strings/manifest/permissions/SDKs/locales — wins on conflicts.
- **Sequential**: `navigation-flow-analyzer` → `data-model-extractor`.
- Then 5 question batches interleaved with analysis, same as app-tdd-creator.

## Two human gates

Progress halts at two explicit confirmation points — nothing downstream runs until the user
accepts:

| Gate | When | What the user sees |
|---|---|---|
| **GATE 1** | After intake, before artifact generation | Feature inventory table (screens, features, roles, entities, integrations + confidence flags) — confirm / remove / add / merge |
| **GATE 2** | After evaluator passes, before handoff | Evaluator verdict + coverage stats + warnings — accept / revise / accept-with-risks |

On Claude Code both gates use `AskUserQuestion`. On Codex CLI the skill asks in chat and
**stops** — it never proceeds past a gate without an explicit reply.

## Evaluator-optimizer loop

After Phase E (quality artifacts), `spec-evaluator` (opus, read-only) cross-checks the
bundle against four classes: cross-artifact consistency, grounding (no ungrounded
requirement), completeness, and constitution contradictions. It returns
`{verdict, findings[], coverage}` and writes `pipeline/eval_report.md` +
`spec/traceability.csv`.

On any `blocker` finding, only the owning agent(s) are re-invoked with the findings as input
(max 2 retries per blocker). `warn`/`info` findings never block — they land in `risks.md` or
design open-questions. If blockers remain after 2 retries, the skill surfaces them and asks
the user for guidance.

## The `spec/` bundle

One layout regardless of mode. The bundle path is `<BASE>/<APP>/spec/`:

```
spec/
├── 00_manifest.yaml          # metadata: mode, platforms, schema_version, evaluator_verdict
├── constitution.md           # standards layer (generated from project CLAUDE.md/conventions if present)
├── product-brief.md          # problem, audience, UVP, competitors, success metrics
├── requirements.md           # EARS functional requirements (FR-NNN)
├── user-stories.md           # US-NNN, each linking FR IDs
├── acceptance/               # Gherkin acceptance criteria per epic (UI-agnostic .feature files)
├── design.md                 # PLATFORM-NEUTRAL: architecture, navigation graph, data model, per-screen behaviour, business rules
├── platform/android.md       # Android-specific: Compose/Hilt/Room/gradle/minSdk/permissions
├── platform/ios.md           # iOS stub (populated if --platforms includes ios)
├── nfr.md                    # measurable non-functional requirements with numeric thresholds
├── a11y.md                   # WCAG 2.2 AA spec + per-screen checklist
├── security-privacy.md       # data classification, consent, per-permission justification
├── analytics.md              # event taxonomy keyed to user stories
├── i18n.md                   # locale list, string patterns, RTL notes
├── risks.md                  # risk register
├── estimate.md               # effort estimate from inventory, NFRs, integrations
└── traceability.csv          # FR ↔ US ↔ AC ↔ design ↔ platform coverage matrix
```

`design.md` is platform-neutral by design. iOS can be added later by populating
`platform/ios.md` without reworking any shared artifact.

## The 17 agents

All agents live in `templates/spec/agents/*.md` (canonical, tool-neutral). `install-spec.sh`
renders them into the target harness(es).

| Agent | Phase | Role |
|---|---|---|
| `play-store-scraper` | A-clone | Scrape Google Play listing metadata (needs Chrome MCP) |
| `screenshot-business-analyzer` | A-clone | Multimodal: screens, business rules, states, hints (opus) |
| `screenshot-style-analyzer` | A-clone | Multimodal: design tokens, contrast pairs (opus) |
| `apk-analyzer` | A-clone | Extract ground-truth from APK: palette, strings, manifest, libraries |
| `navigation-flow-analyzer` | A-clone | Build navigation graph from business analysis |
| `data-model-extractor` | A-clone | Derive neutral entities, relations, cache strategy |
| `backend-api-extractor` | A-clone | Infer REST API contracts and third-party SDKs from UI evidence |
| `constitution-author` | C | Write `constitution.md` from project conventions |
| `requirements-author` | C | EARS FR-NNN from analyzer output or interview answers |
| `user-story-writer` | C | US-NNN linked to FR IDs |
| `acceptance-criteria-writer` | C | UI-agnostic Gherkin `.feature` files per epic |
| `nfr-analyzer` | E | Measurable NFRs with numeric thresholds |
| `a11y-reviewer` | E | WCAG 2.2 AA spec + per-screen checklist |
| `security-privacy-reviewer` | E | Data classification, consent, permission justification |
| `analytics-taxonomy-designer` | E | Event taxonomy keyed to user stories |
| `risk-estimator` | E | Risk register + effort estimate |
| `spec-evaluator` | F | Evaluator-optimizer critic; builds traceability.csv; read-only |

Phase E specialists (`nfr-analyzer`, `a11y-reviewer`, `security-privacy-reviewer`,
`analytics-taxonomy-designer`, `risk-estimator`) run in parallel. Phase C agents run
sequentially (each builds on the previous output).

A shared **prompt library** (`prompts/`) holds question banks, rubrics, schemas, and templates
independently versioned. Agents reference prompts by ID (`Read prompt <id>`) rather than
inlining them, so a rubric can be bumped once and all consumers pick it up.

## Dual-harness mechanics

### Claude Code

- Skill: `~/.claude/skills/app-spec-creator/SKILL.md`
- Agents: `~/.claude/agents/<name>.md`
- Gates: `AskUserQuestion` tool
- Parallel phases: fan out all specialists in one message

### Codex CLI

- Skill: `~/.codex/skills/app-spec-creator/SKILL.md`
- Canonical agent specs: `~/.codex/agents/<name>.md` (the prose the shims read)
- Native shims: `~/.codex/agents/<name>.toml` — Codex-native subagent wrappers. Each `.toml`
  re-reads its `.md` so the canonical source stays authoritative.
- Generated shims pin both `model` and `model_reasoning_effort`: simple scrapers/constitution use
  `gpt-5.4-mini`, most authoring/analysis roles use `gpt-5.4`, screenshot analyzers use `gpt-5.5`,
  and `spec-evaluator` uses `gpt-5.5` with `xhigh` reasoning.
- Gates: ask in chat + **STOP** — the skill never proceeds past a gate without an explicit
  user reply (no `AskUserQuestion` tool available in Codex)
- Config: `[agents]` section merged into `~/.codex/config.toml`

### Codex config note

`max_threads` must be **≥ 6** to allow Phase E's 5-specialist fan-out to run in parallel
(the widest phase). With a lower value the fan-out serializes — output is still correct but
slower. `max_depth=1` prevents worker agents from spawning sub-agents.

If `~/.codex/config.toml` already has an `[agents]` section when `install-spec.sh` runs,
the installer prints a note and asks you to merge
`templates/spec/codex/config-fragment.toml` by hand.

### `{{AGENT_DIR}}` and `<!-- tool:* -->` markers

`{{AGENT_DIR}}` in agent prose resolves to `~/.claude` or `~/.codex` at install time.
`<!-- tool:claude -->…<!-- /tool:claude -->` and `<!-- tool:codex -->…<!-- /tool:codex -->`
blocks are stripped to the relevant half during rendering — same engine as the existing
`<!-- platform:* -->` axis in `bootstrap.sh`.

## Spec→dev handoff

The bundle is portable: `traceability.csv` + `design.md` + `acceptance/*.feature` feed any
dev pipeline.

**Portable handoff (default):** after GATE 2, the skill prints the bundle path. Use your
project's existing feature workflow: `/<prefix> --feature` once per epic, pointing at the
relevant acceptance file.

**Optional spec-bridge:** a project MAY ship a dedicated bridge agent that ingests the bundle
and creates the project's plan files in one step. Reference example: MyMoney's
`cmp-planner-android`, invoked as `/<prefix> --plan <bundle>`, which turns the bundle into
the project's phase/iteration plan files behind a `y/d/n` gate. If a spec-bridge is present,
the skill names it in the handoff step and prints the exact command.

A generic `--from-spec` orchestrator flow in the dev-pipeline side (auto-wire without a
per-project bridge) is a known follow-up, deferred until the `tool:` strip in
`lib/sync.sh` (codex-001) lands.
