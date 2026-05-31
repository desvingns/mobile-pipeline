---
name: mp-spec
description: Builds a complete, testable, traceable specification BUNDLE for a mobile app (Android now, iOS-ready) and hands it off to development. Two intake modes that converge on one artifact set — GREENFIELD (staged interview elicitation for a brand-new app) and CLONE (screenshots + Google Play + optional APK, reusing the analyzer agents). Produces EARS requirements, user stories, Gherkin acceptance criteria, a platform-neutral design doc + platform appendix, NFR/a11y/security/analytics/i18n/risk/estimate artifacts, and a traceability matrix — validated by an evaluator-optimizer critic with two human gates. Supersedes app-tdd-creator. Triggers on "/mp-spec", "сделай спеку приложения", "собери требования по приложению", "spec bundle", "TDD по скриншотам", "воссоздай приложение", "придумай приложение с нуля". Use when the user wants structured requirements/specs for a mobile app — whether cloning an existing app or designing one from scratch — for handoff to coding agents.
---

# /mp-spec — Universal-Intake Spec Pipeline

You orchestrate a multi-agent pipeline that produces a **spec bundle** (`spec/`) for a mobile app and hands it to development (your project's dev pipeline — e.g. `/cmp --plan <bundle>` — via the handoff step). Two intake modes converge on one shared artifact set, so everything downstream is mode-agnostic.

This skill **supersedes** `app-tdd-creator` (which produced only a single TDD). It keeps that skill's proven analyzer fan-out and question-batching, adds a greenfield front-door, a validation critic, and the missing artifact types (testable requirements, NFR, a11y, security, analytics, i18n, risk, estimate, traceability), and emits a platform-neutral bundle so iOS can be added later without rework.

## Language rules (hard)

- This SKILL.md, agent prompts, prompt-library files, intermediate `pipeline/*.md`: **English**.
- Verbatim quotes (Google Play text, screenshot text, user's interview answers): **preserve original language**.
- Final bundle prose (`design.md`, `product-brief.md`, narrative parts): **Russian** by default (override per Q-A4).
- Requirement/AC IDs, code identifiers, Gherkin keywords: **English** always.
- Chat responses to the user: **Russian**. AskUserQuestion: questions/labels Russian, internal IDs (A1, B2, …) Latin.

## Scope rule (hard)

This skill produces the **spec bundle** and (on request) triggers the handoff. It does **not** write production Kotlin/Swift, Compose/SwiftUI, or run builds — that is the dev pipeline's job, fed by the handoff. If asked to code during this run, defer: «Этот скилл готовит спеку и хендофф. Кодогенерация — в дев-пайплайне (`/<prefix>`).»

**Personal-project scope.** This is personal tooling. Never pull in work/corporate agents or skills (no `testing`, no jira/confluence/slack/bitbucket agents, no `strikerz-*` plugins).

## Prompt library (include-by-reference)

Detailed question banks, rubrics, and templates live under `prompts/` next to this file, **not** inlined here. When a step says `Read prompt <id>`, open `prompts/<id>.md` and follow it. Index: `prompts/README.md`. This keeps the orchestrator thin and the rubrics independently versioned — bump a prompt's `version` to upgrade every consumer at once.

## Harness notes (Claude vs Codex)

This skill runs under **both** Claude Code and Codex CLI. The orchestration is identical; three touch-points differ by harness:

- **User gates** have no structured-question tool — **ask the question in chat and STOP** until the user replies. Never proceed past a gate without an answer.
- **Specialists** run as native Codex subagents (`.codex/agents/<name>.toml`). Request them by name; for a parallel phase, request all and **wait for every JSON result** before continuing (concurrency is bounded by `[agents] max_threads`, so a 5-way fan-out may queue — fine). Workers must not spawn descendants (`max_depth=1`).
- Skill lives inside the `mp-spec` plugin; Codex sub-agent shims are installed separately; prompts live next to this SKILL.md under `prompts/`.

## Step 0 — Parse input & detect mode

**Slash form:** `/mp-spec [<screenshots_dir>] [--apk <path>] [--play <url>] [--greenfield] [--name <APP>] [--platforms android[,ios]] [--depth mvp|production|reference] [--base <dir>] [flags]`

**Mode detection:**
- Any of `<screenshots_dir>` / `--apk` / `--play` present → **clone** mode.
- None present, or `--greenfield` → **greenfield** mode.
- `--mode greenfield|clone` overrides detection.

**Flags** (superset of app-tdd-creator's): `--name`, `--depth {mvp|production|reference}`, `--platforms` (default `android`), `--base` (output root; default `~/AppSpecs` — a personal folder you control, kept separate from any unrelated work context), `--resume`, `--fresh`, `--dry-run`, `--skip-play`, `--skip-apk`, `--only <list>`, `--no-bridge` (stop after bundle, don't offer handoff).

**Clone-mode validation** (reuse app-tdd-creator Step 0 verbatim): screenshots dir required & non-empty; ask for Play URL / APK if not given; reject `.aab/.apks/.xapk` with extraction hint. See `prompts/questions/clone.input.md`.

**Greenfield-mode validation:** no inputs needed; confirm the app idea is stated (if `/mp-spec --greenfield` with no description, ask for a one-paragraph idea first).

**Resolve `<APP>`:** `--name` → APK package stem → Play `id=` → screenshots folder → (greenfield) slugify the idea's working title.

## Step 1 — Bundle folder

Base: `<BASE>\<APP>\` (where `<BASE>` = `--base` or default personal folder). Layout:

```
<BASE>\<APP>\
├── input\
│   ├── screenshots\        (clone: normalized 01.png…NN.png)
│   ├── apk\ apk_decoded\ play_html\   (clone, as app-tdd-creator)
│   └── interview\          (greenfield: stage1.yaml … stage5.yaml)
├── pipeline\               (raw agent outputs 01..07 + elicitation.md, eval_report.md)
│   ├── 00_meta.yaml
│   └── user_answers_q*.yaml
└── spec\                   ← the shared bundle (what the bridge consumes)
    ├── 00_manifest.yaml
    ├── constitution.md       product-brief.md  requirements.md  user-stories.md
    ├── acceptance\*.feature  design.md  nfr.md  a11y.md  security-privacy.md
    ├── analytics.md  i18n.md  risks.md  estimate.md  traceability.csv
    └── platform\android.md   platform\ios.md   (ios = populated stub unless --platforms includes ios)
```

Existence handling (`--fresh` / `--resume` / ask) — same as app-tdd-creator Step 1. Init `pipeline/00_meta.yaml` (app, mode, platforms, base, schema_version, phases_completed[], started_utc) and `spec/00_manifest.yaml` (see `prompts/templates/00_manifest.tmpl.yaml`).

If `--dry-run` — print planned phases + gates, stop.

## Step 2 — Phase A: intake (mode-specific)

Print `⟳ Phase A — Сбор данных (<mode>)`.

### A-clone (reuse existing analyzer agents)
Run the app-tdd-creator fan-out **unchanged**:
1. Parallel: `play-store-scraper` (haiku), `screenshot-business-analyzer` (opus), `screenshot-style-analyzer` (opus), `apk-analyzer` (sonnet, if `--apk`). Merge JSON into `00_meta.yaml` with the same source-priority table (APK ground-truth wins palette/strings/manifest/permissions/SDKs/locales).
2. Sequential: `navigation-flow-analyzer` (sonnet) → `data-model-extractor` (sonnet).
Question batches A–E interleave exactly as app-tdd-creator does — `Read prompt questions/clone.batchA.md` … `clone.batchE.md`. Dynamic batch B from `ambiguities[]`.

### A-green (staged interview elicitation)
Funnel: broad → narrow, each stage's answers constrain the next (anti-hallucination via propose-then-confirm). Five batches via AskUserQuestion (≤4 Qs each), saved to `input/interview/stageN.yaml`:
1. `Read prompt questions/greenfield.stage1-vision.md` — idea, audience, platform(s), monetization.
2. `…stage2-inventory.md` — JTBD; model **proposes** a candidate screen list as options (each citing the stage-1 answer that drove it), user edits; user roles.
3. `…stage3-flows.md` — per top-3 screens: key actions, validation rules, empty/error states (dynamic, ≤3 batches).
4. `…stage4-data.md` — model proposes entities/relations, user prunes; auth; integrations; offline.
5. `…stage5-posture.md` — a11y target, locales, data sensitivity/consent, analytics goals.

## Step 3 — GATE 1: confirm inventory (human, hard stop)

Both modes produce a **feature inventory** (screens, features, roles, entities, integrations + per-item source & confidence). Validate against `prompts/schemas/feature-inventory.schema.json`. Print a compact table (low-confidence rows flagged) and call AskUserQuestion: всё верно / убрать лишнее / добавить недостающее / объединить дубликаты. **Nothing downstream runs until this is confirmed** — the locked inventory is the grounding for every artifact, so a wrong screen never propagates into 14 files.

## Step 4 — Phase B: normalize to neutral inventory

Write the confirmed inventory to `pipeline/feature-inventory.json` (the neutral merge format). Clone derives it from analyzer JSON; greenfield from interview YAML. Everything C–F reads this — identical regardless of mode.

## Step 5 — Phase C: requirements + stories + acceptance

1. `constitution-author` (haiku) → `spec/constitution.md` — `Read prompt templates/constitution.tmpl.md`. Generated **from** the target project's existing CLAUDE.md/memory when present (not a competing source of truth).
1b. Main session writes `spec/product-brief.md` (Product layer): problem, audience, UVP, competitors, success metrics, monetization — synthesised from `feature-inventory.json` + Q-batch/interview answers. This is the design's `product-brief-writer` aggregation step; no sub-agent.
2. `requirements-author` (sonnet, `source: analyzers|interview`) → `spec/requirements.md` (EARS `FR-NNN`) + neutral inventory enrichment. `Read prompt rubrics/ears-requirements.md`.
3. `user-story-writer` (sonnet) → `spec/user-stories.md` (`US-NNN`, each linking FR-IDs).
4. `acceptance-criteria-writer` (sonnet) → `spec/acceptance/*.feature` (UI-agnostic Gherkin). `Read prompt rubrics/gherkin-acceptance.md`.

> ID policy: prefer `US-x` + screen `ACn` + `BR-x` (already testable); `FR-x`/`NFR-x` EARS used for cross-cutting + greenfield. Do **not** force `FR-x` over existing story-level requirements.

## Step 6 — Phase D: design

`design-aggregator` (main session, no sub-agent — like app-tdd-creator Phase 4) writes:
- `spec/design.md` — **platform-neutral** body: overview, architecture, navigation graph, data model (neutral types), per-screen behaviour, business rules. `Read prompt templates/design.tmpl.md`.
- `spec/platform/android.md` — the **only** place Compose/Hilt/Room/gradle/minSdk/permissions appear. `Read prompt templates/platform.android.tmpl.md`.
- `spec/i18n.md` — via i18n sub-prompt (no separate agent).
- `spec/platform/ios.md` — populated stub unless `--platforms` includes `ios`.

## Step 7 — Phase E: quality artifacts (parallel fan-out)

One message, parallel: `nfr-analyzer`, `a11y-reviewer`, `security-privacy-reviewer`, `analytics-taxonomy-designer`, `risk-estimator` (writes both `risks.md` + `estimate.md`). Each reads `feature-inventory.json` + posture answers + relevant rubric, writes its artifact, returns JSON.

## Step 8 — Phase F: evaluate (evaluator-optimizer) + traceability

1. `spec-evaluator` (opus, **read-only**) → `spec/traceability.csv` + `pipeline/eval_report.md`. `Read prompt rubrics/evaluator-rubric.md`. Four check classes: cross-artifact consistency / grounding (no ungrounded requirement) / completeness / constitution contradictions. Returns `{verdict, findings[], coverage}`.
2. **Optimize loop:** on any `blocker` finding, re-invoke **only the owning agent(s)** (parsed from `finding.artifact`) with the findings as input. **Max 2 retries.** Still failing → stop, show residual blockers, ask the user for guidance (mirror `/cmp` Step 4 behaviour). `warn`/`info` never block — they land in `risks.md` / design open-questions tagged `(assumption)`.

## Step 9 — GATE 2: final acceptance (human)

On `pass`, print the verdict summary + coverage stats + warnings, then AskUserQuestion: принять и передать в разработку / внести правки / принять с зафиксированными рисками. Only on accept set `00_manifest.yaml: evaluator_verdict: pass` and continue.

## Step 10 — Handoff (auto-bridge)

Unless `--no-bridge`: tell the user the bundle is ready and how to hand it off to their dev pipeline. If the project ships a **spec-bridge** (e.g. MyMoney's `cmp-planner-android`, invoked as `/<prefix> --plan <bundle>`, which turns the bundle into the project's plan files behind a `y/d/n` gate), name it and print the command. Otherwise the **portable handoff is the bundle itself**: `traceability.csv` + `design.md` + `acceptance/*.feature` feed any coding pipeline (e.g. `/<prefix> --feature` per epic). Always print the bundle path.

## Step 11 — Report

Open the bundle folder (`Start-Process explorer.exe "<BASE>\<APP>"`). Final Russian summary: bundle path, mode, screen/feature/entity counts, artifact list with line counts, evaluator verdict + coverage, per-agent token totals (keep app-tdd-creator's token-cost table), and the handoff command.

## Edge cases

- Never write outside `<BASE>\<APP>\`. Never write code/tests. Never delete user files (list paths instead).
- Any agent fails 3× → note in meta, continue if possible.
- `screenshots_count == 1` → MVP depth. `> 50` → warn (opus cost) before business-analyzer, offer subset.
- Play/Chrome MCP unavailable, APK undecodable, invalid APK → same fallbacks as app-tdd-creator Step 0/3.
- Greenfield with a thin idea → ask one clarifying paragraph before stage 1; never invent the product.

## Mode hint footer

Append to `spec/design.md`:
```markdown
---
*Сгенерировано `/mp-spec` (mode `<mode>`, depth `<depth>`, platforms `<list>`).*
*Хендофф в разработку: `/<prefix> --plan <BASE>/<APP>/spec` (если у проекта есть spec-мост; иначе бандл портативен).*
```
