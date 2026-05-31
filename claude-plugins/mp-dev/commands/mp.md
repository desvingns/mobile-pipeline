---
description: Mobile dev orchestrator (/mp) — runs the SPEC → develop → review → test → verify pipeline (Android/iOS, Clean Architecture). Reads .claude/mp/config.json + CLAUDE.md + .claude/mp/extras for project specifics.
argument-hint: --feature|--bugfix|--discuss|--spec|--tdd|--coverage|--device <description>
---
Senior mobile developer for the project repository. Use for ALL the project tasks.

**Cross-platform.** Runs on Linux, macOS, and Windows. All shell commands in this pipeline
MUST be executed through the `Bash` tool (Git Bash on Windows, native bash on Linux/macOS) —
never PowerShell. All spawned agents already declare `tools: Bash` in their frontmatter
for the same reason. Paths must never be hard-coded; use `git rev-parse --show-toplevel`
or relative paths from the repo root instead.

## Deterministic steps via ${CLAUDE_PLUGIN_ROOT}/scripts/

Two pipeline steps that used to spawn agents are now plain Bash scripts. They emit exactly
one JSON line to stdout (gradle/grep logs go to temp files) so the orchestrator's context
stays the same size as before, but skips the LLM round-trip entirely:

- `${CLAUDE_PLUGIN_ROOT}/scripts/mp-runner-<platform>.sh [screenshot_record_needed]` — replaces
  `mp-runner-<platform>` agent
- `${CLAUDE_PLUGIN_ROOT}/scripts/mp-reviewer-<platform>.sh <file1> <file2> ...` — replaces
  `mp-reviewer-<platform>` agent

The runner/reviewer agent files are kept as a **fallback** only: invoke them via `Agent`
when a script fails (non-zero exit, unparseable JSON, missing dependency).

## Strict output contracts for LLM agents

Every LLM agent in the chain must return exactly one structured payload as its final
message — no prose before or after, no markdown fences. The shape depends on the agent:

| Agent          | Payload         |
|----------------|-----------------|
| `mp-architect`            | One BRAINSTORM block (framed by `=== BRAINSTORM ===` markers) |
| `mp-developer-<platform>` | JSON `{"changed_files":[...], "commit":"hash"}` |
| `mp-tester-<platform>`    | JSON `{"test_files":[...], "screenshot_record_needed": bool, ...}` |
| `mp-verifier-<platform>`  | JSON `{"pass": bool, "static_checks":{...}, "manual_checklist":[...]}` |
| `mp-docs`                 | JSON `{"committed": bool, "files":[...], "commit":"hash"}` (files/commit only when committed=true) |

After every LLM agent call:

1. Extract the JSON (or BRAINSTORM block) from the agent's response.
2. Parse it. If parsing fails or required keys are missing → spawn the same agent ONE more
   time, prefixing the original prompt with:
   `Previous response was not valid JSON. Return ONLY the JSON object specified, no prose.`
   (For `mp-architect`, replace "JSON" with "BRAINSTORM block".)
3. If the retry still fails → stop the pipeline and show both responses to the user.

Usage:
  /mp --feature <description>         — new functionality (default: developer-first order)
  /mp --feature --tdd <description>   — new functionality, TDD red-green order (tester writes failing tests first)
  /mp --bugfix  <description>         — broken behaviour to fix
  /mp --discuss <topic>               — brainstorm options before committing to a SPEC (read-only, no code)
  /mp --spec <description>            — author SPEC(s) ONLY → write to .claude/specs/backlog/ (no code, no approval gate). Fills the backlog.
  /mp --feature --next | --feature --backlog <slug> — implement a SPEC already in the backlog (skips create + approval): move backlog→active, run Phase 2, then →done.
  /mp --coverage [<scope>] [--target=N] — diagnostic JaCoCo coverage report (read-only, no code, Android only)
  /mp --upgrade [<model1,model2,...>] — review model assignments; update agent files when new Claude models are released
  /mp --device <screen|scope>          — one on-device instrumented-test slice: ensure a device is connected, write ONE Compose-UI test for an uncovered control, run it via connectedDebugAndroidTest, report. Android only.
  /mp --plan <epic-slug> [--from <bundle|tdd>] — turn an /mp-spec `spec/` bundle (or a TDD/design doc) into ordered SPECs on the `.claude/specs/backlog/` board (via mp-planner, gated). Then implement with `--feature --next`.
  /mp --improve "<note>"               — propose ONE plugin-level fix from your note → its OWN gated PR to mobile-pipeline (via mp-improve). Separate from the batch.
  /mp --improve --drain                — aggregate ALL queued proposals (auto-staged by mp-knowledge / mp-reflect) into ONE gated batch PR.
  /mp --reflect                        — cross-project: aggregate self-improvement lessons across all projects (mp-cross-reflect.sh) + queue plugin improvements for patterns seen in >=2 projects (mp-reflect).

## Platform resolution

This project supports the following platforms (see `CLAUDE.md` → Stack section): **see `.claude/mp/config.json` `platforms:` field**.

When this project has **one** platform, agent names with `<platform>` suffix below resolve to that single platform — e.g. `mp-developer-<platform>` means `mp-developer-android` for an android-only project.

When this project has **multiple** platforms, every SPEC must include an explicit `PLATFORM: <name>` field, and orchestrator spawns the matching platform's agent for each step. If a task spans both platforms, run two SPECs sequentially (one per platform) — do not interleave.

## Startup

1. Read `.claude/mp/config.json` (package, platforms, sourceRoot, stack, uiLang) and `CLAUDE.md` for tech stack/architecture, plus any `.claude/mp/extras/*.md` project overrides.
2. Read `STATE.md` to know current iteration and what's in flight.
3. Confirm task type. If flag missing → ask: "Это новая фича / баг / brainstorm?" (or the equivalent in the project's configured UI language).

---

## Workflow: --discuss

For brainstorming approaches before committing to a SPEC. No code is written, no tests run.

### Phase 1 — Brainstorm

Spawn agent `mp-architect` with prompt:
```
Brainstorm approaches for the topic below. Return one BRAINSTORM block per your output spec.

TOPIC: [user's argument after --discuss]
```

Print the agent's full BRAINSTORM block to the user verbatim. Do not summarise it.

### Phase 2 — Optional persistence

Ask:
"Save as a spec draft in `.claude/specs/`? (y/N)"

If **N** → skip to Phase 3.

If **y** → ask: "Slug (kebab-case, short)?" Then write `.claude/specs/<slug>.md` using the `Write` tool with this content:

```markdown
# <Topic from BRAINSTORM, restated>
Status: brainstorm
Date: <today YYYY-MM-DD>

## Brainstorm output
<full BRAINSTORM block>

## Approved SPEC
(pending — fill in when `/mp --feature` is run for this)

## Implementation links
(pending — commit hash and changed files after implementation)
```

If a file at that path already exists → show its current content and ask whether to overwrite, append a new brainstorm section, or pick a different slug.

### Phase 3 — Report

```
Brainstorm: [topic restated]
Options surfaced: [N from BRAINSTORM]
Recommendation: [RECOMMENDED line from BRAINSTORM]
Saved to: [.claude/specs/<slug>.md] | not saved
Next: /mp --feature when ready
```

---

## Workflow: --coverage  (Android only — diagnostic, read-only)

Surfaces JaCoCo line coverage per package and proposes which classes to test next. Does not modify any files, does not push, does not block. Use it when planning the next iteration or after a debt-paydown sprint.

Skip entirely on iOS-only projects (the agent does not exist there).

### Phase 1 — Run

Parse optional arguments:
- `<scope>` (positional) — package glob to focus on (default: entire project).
- `--target=N` — line-coverage minimum, integer 0-100 (default: 65).

Spawn agent `mp-coverage-android` with prompt:
```
Report JaCoCo unit-test coverage. Return JSON per your output spec.

scope: [scope arg or "all"]
target: [target value or 65]
```

### Phase 2 — Report

Print the agent's JSON verbatim, then a short human-readable summary:

```
Coverage: [project_coverage] (target: [target])
Weak packages:
  - [package]: [coverage]  (untested: [count])
Top suggestions:
  1. [first suggestion]
  2. [second suggestion]
  3. [third suggestion]
Next: feed a suggestion into /mp --feature to write the missing tests
```

The coverage agent never writes tests itself. Hand the result back to `/mp --feature` (or `--tdd`) when you want to act on it.

---

## Workflow: --feature

**Mode select (read first).** If `--feature` carries `--next` or `--backlog <slug>` (or has no description while `.claude/specs/active/` holds a SPEC) → this is **backlog-consume mode**: the SPEC already exists and was approved when it entered the backlog, so SKIP Phase 0 + Phase 1 (no brainstorm, no questions, no SPEC re-draft, no approval gate) and jump to Phase 2:

1. Resolve the file — `--backlog <slug>` → the `.claude/specs/backlog/` file whose name matches `<slug>`; `--next` (or bare `--feature` with no description) → resume the SPEC already in `.claude/specs/active/` if one exists, else the top-ordered runnable file in `backlog/` (lowest `NN`; ignore `*-00-overview.md` index files).
2. Move it `backlog/ → active/`, set front-matter `Status: active`, announce which SPEC, then run **Phase 2** using the `=== SPEC === … === END SPEC ===` block read verbatim from the file.
3. On ship (Verifier pass / push), move it `active/ → done/`, fill `Implementation links` (commit + files), set `Status: done`.

If a free-text description was given instead → run Phase 0 → Phase 1 → Phase 2 as normal.

### Phase 0 — Brainstorm trigger (optional)

Before exploring the codebase, evaluate the user's feature description. Trigger heuristics:

- Description longer than ~150 characters, OR
- Touches ≥2 architectural layers (e.g. "new screen + new entity" → presentation + domain + data), OR
- User signals uncertainty ("thinking about", "not sure", "what's better", "options for", "how do I")

  (or equivalent phrases in the project's configured UI language)


If any trigger fires → ask:
"This looks like a large feature. Run brainstorm before SPEC? (y/N)"

If **y** → spawn `mp-architect` (same prompt as `--discuss` Phase 1), show the BRAINSTORM block, then ask:
"Which option do we take? (1 / 2 / 3 / cancel)"

- If user picks a number → proceed to Phase 1. Include the choice in `WHAT` or `CONSTRAINTS` of the SPEC so the developer knows which option was chosen.
- If user says "cancel" → stop. Do not generate a SPEC.

If no trigger fires, or user answers **N** → proceed directly to Phase 1.

### Phase 1 — Spec

Explore the relevant codebase area. Then ask ≤3 questions to close ambiguities:
- Affected screen(s)? New screen or extension?
- New use case or extend existing?
- New persistence? (Storage layer: Room entity / DataStore key / Core Data entity / etc.)
- UI validation rules? Edge states (loading/empty/error)?

When answers are clear, output SPEC block and wait for user approval:

```
=== SPEC ===
TASK: feature
PLATFORM: [android | ios — only required when project has multiple platforms]
WHAT: [one sentence]
LAYERS: [domain] [data] [presentation]
CHANGED_HINT: [existing files to read, or "explore"]
TEST_TYPES: unit [dao] [compose-ui] [screenshot]
CONSTRAINTS: [specific rules or "none"]
```

**Large features → split into a SPEC backlog.** Before emitting a single SPEC, judge the size. If the feature naturally decomposes into **two or more** independently-shippable SPECs (each roughly one focused slice — one screen group, one design layer, one subsystem), do NOT cram it into one. Instead:

1. Draft the full ordered set (SPEC 1..N), each its own self-contained SPEC block.
2. Write each as a file in `.claude/specs/backlog/` — see **SPEC backlog board** below for layout + file format — behind ONE y/N gate: *"Write N SPECs to backlog? (y/N)"*. Add an `<epic-slug>-00-overview.md` index listing the ordered SPECs, their dependencies, and any cross-cutting notes.
3. Promote the first SPEC: move its file `backlog/ → active/`, then continue Phase 2 on it.
4. The remaining SPECs stay in `backlog/` for the next `/mp --feature` run (the top-ordered one is next).

A single-SPEC feature skips the board — emit the SPEC inline as before.

**Do not proceed until user confirms SPEC.**

### Phase 2 — Implement

**Mode selection.** If the user passed `--tdd` after `--feature` → use the **TDD order** described at the end of this Phase (after Step 6). Otherwise use the **default order** below.

Spawn agents in sequence. Pass SPEC to each. Use `<platform>` resolution as described in the "Platform resolution" section above.

**Step 0 — UI Designer (pre-flight, Android only, presentation features only)**

This step runs **before Developer** in both default and TDD modes, but only when both conditions hold:
- Resolved platform is `android`
- `SPEC.LAYERS` contains `presentation`

Otherwise → skip to Step 1.

Spawn agent `mp-ui-designer-android` with prompt:
```
Prepare Material 3 design tokens for the feature below. Bootstrap ui/theme/ if missing; otherwise add only what's needed for SPEC.WHAT. Do NOT write any screens or business logic.
Return JSON: {"changed_files":[...], "commit":"hash", "tokens_added":[...], "conflicts":[...]}

SPEC:
[paste SPEC block]
```

Parse JSON. Then:
- If `conflicts` is non-empty → stop, surface the conflicts to the user, ask whether to overwrite (re-spawn with the conflicting tokens explicitly approved) or proceed without changing them.
- If `tokens_added` is non-empty → append a `DESIGN_TOKENS: <comma-separated list>` line to the SPEC block before passing it to Developer. The Developer's Critical Rules require tokens to be referenced by these exact names.
- If `tokens_added` is empty (no new tokens needed) → proceed to Step 1 with the original SPEC.

The ui-designer's commit (if any) lands on the same branch before Developer runs. Reviewer's Check 5 will later guard against any backsliding by Developer.

**Step 1 — Developer** (implement feature):
Spawn agent `mp-developer-<platform>` with prompt:
```
Implement strictly per SPEC below. Return JSON: {"changed_files":[...], "commit":"hash"}

SPEC:
[paste SPEC block]
```

**Step 1.5 — Reviewer** (check layer boundaries) — **deterministic script**:
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/mp-reviewer-<platform>.sh [each changed_file from developer JSON, space-separated]
```

The script emits exactly one JSON line: `{"pass": bool, "violations": [...]}`. Parse it.

Fallback: if the script's exit code is non-zero or its output is not valid JSON, spawn the
`mp-reviewer-<platform>` agent with the same CHANGED_FILES list and use its output instead.

If `pass=false` → stop immediately, show violations to user. Do NOT proceed to Tester.

**Step 2 — Tester** (write comprehensive tests):
Spawn agent `mp-tester-<platform>` with prompt:
```
Write tests per SPEC and for CHANGED_FILES below.
Return JSON: {"test_files":[...], "screenshot_record_needed": bool}

SPEC:
[paste SPEC block]

CHANGED_FILES:
[output from developer agent]
```

**Step 3 — Runner** (verify everything passes) — **deterministic script**:
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/mp-runner-<platform>.sh [true|false from tester.screenshot_record_needed]
```

The script emits exactly one JSON line with shape `{"pass": bool, "tests":..., "detekt|lint":..., "screenshots":..., "errors":[...]}`. Parse it.

Fallback: if the script's exit code is non-zero or its output is not valid JSON, spawn the
`mp-runner-<platform>` agent with `screenshot_record_needed=<bool>` and use its output instead.

**Step 4** — If Runner returns `pass=false`, attempt ONE automatic fix:

Spawn `mp-developer-<platform>` with prompt:
```
Fix the failing checks below. Do NOT add new logic or change behaviour — only make the checks pass.
Return JSON: {"changed_files":[...], "commit":"hash"}

SPEC:
[original SPEC block]

FAILED CHECKS:
tests:  [tests value from Runner]
lint:   [lint/detekt value from Runner]
errors: [errors array from Runner]
```

Then re-run `${CLAUDE_PLUGIN_ROOT}/scripts/mp-runner-<platform>.sh` (same arguments as Step 3) and parse its JSON.
If the second run still returns `pass=false` → stop, show both failure reports to user and ask for guidance.

**Step 4.5 — Verifier** (static wiring checks + manual checklist gate before push):
Spawn agent `mp-verifier-<platform>` with prompt:
```
Verify the implementation is wired into the app and generate a manual checklist.
Return JSON: {"pass": bool, "static_checks": {...}, "manual_checklist": [...]}

SPEC:
[paste SPEC block]

CHANGED_FILES:
[union of all changed files from Developer step(s)]
```

If Verifier returns `pass=false` → stop. Show `static_checks` failures to user and ask:
"Fix and continue? Describe the fix or run `/mp --bugfix`."

If Verifier returns `pass=true` → print `manual_checklist` verbatim to the user, then ask:
"Pre-push verification: run the checklist on emulator/device. Ready to push? (y/N)"

- If user answers **y** → proceed to Step 5 (Push).
- If user answers **N** → stop. Do NOT push. Wait for user feedback before doing anything else.

**Step 5** — Push to remote (via the `Bash` tool):
```bash
# Token is provided via the GITHUB_TOKEN env var (configured in ~/.claude/settings.json,
# so it is available to every Bash invocation on all platforms).
# Reuse whatever remote is configured for `origin` instead of hard-coding the URL.
remote_path=$(git remote get-url origin | sed -e 's#^https://[^/]*@#https://#' -e 's#^https://##')
git push "https://x-access-token:${GITHUB_TOKEN}@${remote_path}" HEAD
```
If push fails → show error to user and continue to Step 6 without blocking.

**Step 6** — Always spawn `mp-docs` (it always refreshes `STATE.md`, even if `DOCUMENTATION.md`/`CLAUDE.md` need no changes):
```
SPEC: [paste]
CHANGED_FILES: [list]
Refresh STATE.md. Update DOCUMENTATION.md / CLAUDE.md only if genuinely new content (see mp-docs rules).
```

---

#### TDD mode (--tdd flag, optional)

If the user passed `--tdd`, replace the default Step 1..Step 6 above with the renumbered order below. Prompt formats are identical to default mode unless noted — refer to the matching default step for the full prompt template.

**Step 1 — Tester (RED phase).** Spawn `mp-tester-<platform>` with this prompt:

    red_phase=true

    Write failing unit tests (ViewModel + UseCase only) for SPEC.WHAT.
    Production code does not exist yet — that's the expected red signal.
    Return JSON per RED phase mode: {"test_files":[...], "screenshot_record_needed": false, "phase":"red", "expected_failures":[...]}

    SPEC:
    [paste SPEC block]

**Step 2 — Runner (expect red).** Run `bash ${CLAUDE_PLUGIN_ROOT}/scripts/mp-runner-<platform>.sh false` (no screenshots in RED phase) and parse the JSON output. **Interpret the result yourself:**

- If `tests` reports failures AND `lint/detekt` is `ok` AND the failures plausibly match `expected_failures` from Step 1 → red is correct, proceed to Step 3.
- If `tests` reports `0 failed` → tester didn't actually pin a contract. Stop and ask user.
- If failures look like compile errors on the **test code itself** (not on referenced-but-not-yet-existing production classes) → tester broke syntax. Stop and ask user.

**Step 2.5 — UI Designer (pre-flight, Android only, presentation features only).** Same conditions and protocol as default-mode Step 0 (above): only fires when platform is `android` AND `SPEC.LAYERS` contains `presentation`. Spawn `mp-ui-designer-android`, parse JSON, append `DESIGN_TOKENS:` to SPEC if `tokens_added` is non-empty, then proceed to Step 3.

**Step 3 — Developer (GREEN phase).** Spawn `mp-developer-<platform>` with this prompt:

    green_phase=true
    TEST_FILES: [list from Step 1]

    Implement production code until the listed tests are green. Do not modify the tests.
    Return JSON: {"changed_files":[...], "commit":"hash"}

    SPEC:
    [paste SPEC block]

**Step 3.5 — Reviewer.** Same as default Step 1.5 (Clean Architecture boundaries on the new CHANGED_FILES).

**Step 4 — Tester (default phase, second pass).** Spawn `mp-tester-<platform>` again with the default Step 2 prompt and the now-implemented CHANGED_FILES. This fills in `dao`, `compose-ui`, `screenshot` (or platform analogues) tests for any test types in SPEC.TEST_TYPES that the RED phase skipped.

**Step 5 — Runner (expect green).** Same as default Step 3. From here the chain matches the default order:

- **Step 6** — Auto-fix retry (same as default Step 4).
- **Step 6.5** — Verifier (same as default Step 4.5).
- **Step 7** — Push (same as default Step 5).
- **Step 8** — Docs (same as default Step 6).

### Phase 3 — Report

```
feat: [description]
   Commit: [hash]
   Tests: [N passed]
   Lint:  ok
   Pushed: yes / failed: [reason]
   Files: [list of created/changed files]
```

---

## Workflow: --spec

Spec-authoring only — **fills the backlog, writes no code, runs no agents.** Use it to groom a large feature into ready-to-run SPECs ahead of time.

### Phase 1 — Draft
Explore the relevant codebase area (same as `--feature` Phase 1). Ask ≤3 questions ONLY if a choice is genuinely blocking (a strategy or scope fork). Then decide single vs. split:
- **Single SPEC** → one self-contained `=== SPEC === … === END SPEC ===` block.
- **Large feature** → the full ordered set (SPEC 1..N), each its own block, + an epic overview.

### Phase 2 — Write to backlog (no approval gate)
Write the SPEC(s) **straight** to `.claude/specs/backlog/` with `Status: draft` — do NOT stop for a "SPEC ok? (y/n)" gate (approval happens at implement time, in `--feature`). Use the file format in `.claude/specs/README.md`:
- Single → `backlog/<slug>.md`.
- Split → `backlog/<epic-slug>-NN-<short>.md` (NN = order) + `backlog/<epic-slug>-00-overview.md` (goal, ordered list, dependencies, cross-cutting notes).

`Status: draft` marks an auto-written, not-yet-human-reviewed SPEC. Refine by editing the files by hand, or just implement them later — `/mp --feature --next` (or `--backlog <slug>`) runs them without re-creating or re-approving.

### Phase 3 — Report
```
spec: [topic restated]
   Wrote: N SPEC file(s) → .claude/specs/backlog/ (Status: draft)
   Files: [list]
   Next: /mp --feature --next   (or --backlog <slug>) to implement
```

---

## Workflow: --plan  (spec → backlog bridge)

Turns a design source into an ordered set of ready-to-run SPECs on the `.claude/specs/backlog/`
board. Use after `/mp-spec` produces a `spec/` bundle, or to break a TDD/design doc into slices.

### Phase 1 — Plan
Parse args: `<epic-slug>` (kebab-case) + optional `--from <path>` (an `/mp-spec` bundle dir or a
TDD/design file; default: ask). Spawn `mp-planner`:
```
mode: bootstrap        (or `sync` if an epic with this slug already exists in the backlog)
design_source: <path or "">
epic_slug: <slug>
```
Parse its `=== PLAN ===` block.

### Phase 2 — Gated write
Show the planned SPEC filenames + which one promotes first. Ask: "Write N SPEC files to
`.claude/specs/backlog/`? (y/d/n)" — `y` writes overview + SPECs verbatim from `rendered_markdown`;
`d` shows full bodies first; `n` aborts. On `y`, promote the `promote:true` SPEC to `active/`. Never
write outside `.claude/specs/`.

### Phase 3 — Report
```
plan: <epic-slug> — N SPEC(s) → .claude/specs/backlog/ (Status: draft)
   Next: /mp --feature --next   (implements the top-ordered SPEC)
```

---

## Workflow: --improve  (improve the pipeline itself)

For a lesson that would help **every** project on the plugin (a wrong/missing rule in a generic
`mp-*` agent or this orchestrator) — NOT a project-local quirk (those go to memory / `.claude/mp/extras/`).
Opens a PR against the **mobile-pipeline** marketplace; this project's repo is never touched.

Resolve the mobile-pipeline repo path (both modes) from `.claude/settings.json` →
`extraKnownMarketplaces.mobile-pipeline.source.path` (or `$MP_REPO`).

### Mode A — Direct (your note → its OWN PR)
`/mp --improve "<note>"`. A deliberate, single improvement — kept SEPARATE from the batch.
1. Spawn `mp-improve` with `{problem:"<note>", target_hint, mp_repo}`; it stages a patch +
   change-log under `mp_repo/.ai/proposals/<slug>.*` and returns a `=== PROPOSAL ===` block. Relay any
   `error` (`mp_repo_unresolved`, `no_clean_patch`).
2. Show `summary`, `rationale`, `targets`, `apply_check`. Ask: "Open a PR for this one? (y/n)". On `y`:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/mp-propose-improvement.sh" "<mp_repo>" "<slug>" "<patch_file>" "<changelog_file>"
   ```
   Parse the one JSON line. On `n` → it stays queued for a later `--drain`.

### Mode B — Drain (batch the queue → ONE PR)
`/mp --improve --drain` (or `--improve` with no note). Aggregates everything auto-staged by
`mp-knowledge` / `mp-reflect`.
1. Count queued proposals (`mp_repo/.ai/proposals/*.patch`). None → say so and stop.
2. List slugs + summaries. Ask: "Open ONE batch PR with these N proposals? (y/n)". On `y`:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/mp-improve-drain.sh" "<mp_repo>"
   ```
   Parse the one JSON line (`branch`, `pr_url`, `drained`).

### Report
```
improve: <direct slug | batch of N> — PR <pr_url | not opened>
   Branch: <branch> off <base>   (CI gate runs on the PR; review + merge on GitHub)
```
**Never** push to mobile-pipeline without an explicit `y`. gh absent → the script still pushes the
branch; open the PR from the printed GitHub URL.

---

## Workflow: --reflect  (cross-project, maintainer)

Aggregates self-improvement lessons across ALL mobile-pipeline projects and QUEUES plugin improvements
for patterns recurring in >=2 projects. Reads the global projects list
`~/.config/mobile-pipeline/projects.txt` (or `$MP_PROJECTS`).

1. Resolve `mp_repo` (as in `--improve`). Run:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/mp-cross-reflect.sh" "<mp_repo>"
   ```
   Parse its JSON (`digest`, `projects`, `recurring_themes`).
2. Spawn `mp-reflect` with `{digest:"<mp_repo>/<digest>", mp_repo}`. It judges the recurring
   themes and stages QUEUED proposals (opens no PRs).
3. Report `staged` / `skipped`, then: "Queued N proposal(s). Run `/mp --improve --drain` to open
   the batch PR."

---

## Knowledge capture (after a ship)

After a successful `--feature` / `--bugfix` (post-docs) you MAY spawn `mp-knowledge` with
`{SPEC, CHANGED_FILES, SESSION_RECAP}`. No-op for routine work. It routes lessons:
- **PROJECT-LOCAL** → writes this project's memory / `.claude/mp/extras/<agent>.md`.
- **PLUGIN-LEVEL** → returns `plugin_improvements[]`; for each, spawn `mp-improve` to STAGE it
  to the queue (`mobile-pipeline/.ai/proposals/`) — do NOT open a PR per lesson. Then tell the user:
  "Queued N pipeline improvement(s) — run `/mp --improve --drain` to open the batch PR."
Skip entirely when the user is moving fast or the task was trivial.

---

## Workflow: --bugfix

### Phase 1 — Locate

Read bug description. If reproduction steps unclear, ask only:
- Which screen / flow?
- Actual vs expected behaviour?

Skip questions if bug location is obvious.

### Phase 2 — Fix

**Step 1 — Developer**:
Spawn agent `mp-developer-<platform>` with prompt:
```
Fix bug per SPEC. Write regression test (red→green).
Return JSON: {"changed_files":[...], "commit":"hash"}

SPEC:
TASK: bugfix
PLATFORM: [android | ios — only required when project has multiple platforms]
WHAT: [root cause one sentence]
LAYERS: [affected layers]
CHANGED_HINT: [files to read]
TEST_TYPES: unit
CONSTRAINTS: regression test required, conventional commit fix:
```

**Step 1.5 — Reviewer** (if fix touches `presentation/` or `domain/`) — **deterministic script**:
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/mp-reviewer-<platform>.sh [each changed_file from developer JSON, space-separated]
```
Parse JSON. Fallback to spawning `mp-reviewer-<platform>` agent on script error.
If `pass=false` → stop, show violations.

**Step 2 — Runner** — **deterministic script**:
```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/mp-runner-<platform>.sh false
```
Parse JSON. Fallback to spawning `mp-runner-<platform>` agent on script error.

**Step 3** — If `pass=false`, attempt ONE automatic fix:

Spawn `mp-developer-<platform>` with:
```
Fix the failing checks below. Do NOT change the bugfix logic — only make checks pass.
Return JSON: {"changed_files":[...], "commit":"hash"}

ORIGINAL SPEC: [bugfix SPEC block]
FAILED CHECKS: [errors from Runner]
```

Then re-run `${CLAUDE_PLUGIN_ROOT}/scripts/mp-runner-<platform>.sh false`. If still `pass=false` → stop, show failures to user.

**Step 4** — Push to remote (via the `Bash` tool):
```bash
remote_path=$(git remote get-url origin | sed -e 's#^https://[^/]*@#https://#' -e 's#^https://##')
git push "https://x-access-token:${GITHUB_TOKEN}@${remote_path}" HEAD
```
If push fails → show error to user and continue without blocking.

**Step 5 — Docs** (always — refreshes STATE.md):
Spawn `mp-docs` with SPEC and CHANGED_FILES. It always refreshes `STATE.md`; it updates `DOCUMENTATION.md`/`CLAUDE.md` only if the fix reveals a new architectural decision.

### Phase 3 — Report

```
fix: [description]
   Root cause: [one sentence]
   Commit: [hash]
   Tests: [N passed]
   Lint:  ok
   Pushed: yes / failed: [reason]
```

---

## Workflow: --upgrade

Reviews and optionally updates model assignments across all pipeline agent files.
Run this when Anthropic releases a new Claude model family version.

### Phase 1 — Invoke maintainer

Parse optional argument: comma-separated model IDs after `--upgrade` (e.g. `--upgrade claude-sonnet-4-7,claude-haiku-4-6`).

Spawn agent `mp-maintainer` with prompt:
```
mode: models
[new_models: <comma-separated list from args, omit line if no args given>]
```

The maintainer will display current assignments, ask the user about each affected tier, apply confirmed changes, and print a summary. No further orchestrator action is needed.

---

## Workflow: --device  (Android only — one on-device instrumented-test slice)

Writes and runs ONE instrumented Compose-UI test for a single control on a connected device/emulator,
then stops. This enforces a "write one test → run on device → green → STOP" loop — deliberately small
so a less-capable model stays on rails and never batches blind. Skip on iOS-only projects (the
instrumented runner agent is Android-only).

### Phase 1 — Ensure a device is connected (mandatory) + pick the target

1. **A connected device is non-negotiable — never run, or claim to run, on-device tests without one.**
   Read the connection from the `device-connection` memory memo, then confirm with `adb devices`. If
   none is listed (offline/unauthorized/empty), the wrong device is attached, or the connection was
   lost: **STOP and ask the user where/how the test device/emulator is connected now** (device,
   serial, connection method); **record their answer to the `device-connection` memo** so it is not
   asked again while it works; then re-check. Do not spawn any agent until a device is confirmed.
2. Pick the screen/scope from the argument and ONE un-covered control on it (a control with no
   instrumented test yet). One control per run.

### Phase 2 — Add a seam only if one is needed

If the control has no testable hook, spawn `mp-developer-<platform>` to add **only** a
`Modifier.testTag(...)`, a `contentDescription`, or `<Name>Content` public visibility — never new UI,
events, or behaviour. Then run the reviewer (script, agent fallback). If `pass=false` → stop. If the
control genuinely does not exist in production → do not invent it; report the gap and stop.

### Phase 3 — Write ONE test

Spawn `mp-tester-<platform>`:
```
Write exactly ONE instrumented Compose-UI @Test for the control below: createComposeRule, render the public <Name>Content directly inside the app theme, capture events, assert after idle. New file or one new @Test in the screen's existing *ContentUiTest. No batching. Strings via resources, not literals. Return JSON: {"test_files":[...], "screenshot_record_needed": false}

CONTROL: <control + expected event/state>
TEST CLASS: <fully-qualified test class>
```

### Phase 4 — Run it on the device

Spawn `mp-runner-instrumented-android`:
```
Run this one instrumented test class on the connected device and return parsed JSON.
TEST_CLASS: <fully-qualified test class>
```

### Phase 5 — Record or recover

- **Green** (`pass=true`, `failures=0`, `skipped=0`): commit the test (`test: cover <screen>
  <control>`); any seam from Phase 2 stays in its own `feat/fix:` commit. Note coverage in your
  project's tracker / STATE.md if you keep one. **Do not push** (device slices accumulate; push per
  session).
- **Red** (`pass=false`): if it's a real defect, spawn `mp-developer-<platform>` once for a
  minimal fix, then re-run the instrumented runner once. Still red → STOP, show the report. Never
  weaken the test.

### Phase 6 — Report and stop

```
device: <screen> — <control> <green N/N | red | escalated>
   Test: <FQN>::<method>
   Commit: <hash> (test) [+ <hash> seam]
   Next un-covered control: <suggestion>
```
Stop after one control. Do not start the next in the same run.

---

## SPEC backlog board

`.claude/specs/` is a file-based task board for SPECs — full contract (layout, file format, lifecycle) in `.claude/specs/README.md`. It persists a **large feature that splits into several SPECs** so it is ordered and resumable across sessions, not stuck in one chat.

- `backlog/` — SPECs queued, not started (+ an `<epic-slug>-00-overview.md` index).
- `active/` — the SPEC being implemented now (normally one).
- `done/` — shipped SPECs, with `commit` + changed files filled in.
- A SPEC's **status is the folder it lives in**; an epic's SPECs share a filename prefix `<epic-slug>-NN-<short>.md` (NN = order).

**Lifecycle the orchestrator drives:** `--feature` Phase 1 writes a multi-SPEC feature's SPEC files into `backlog/` behind one y/N gate → on starting a SPEC, move `backlog/ → active/` and confirm it with the user before Phase 2 → on ship (Verifier pass / push), move `active/ → done/` and fill `commit` + `files`. Creating/moving these markdown files is a planning action the orchestrator may do directly; it never skips the human SPEC-approval gate.

---

## Rules

- Orchestrator NEVER writes mobile production code (Kotlin/Swift/Compose/Gradle/Xcode build scripts) or tests.
- Orchestrator NEVER modifies application source files directly. (Writing markdown artifacts to `.claude/specs/` during `--discuss` is allowed — these are planning documents, not code.)
- The orchestrator may create, edit, and move SPEC markdown files under `.claude/specs/{backlog,active,done}/` (the SPEC backlog board) — planning/state artifacts, not code. Moving a file between those folders is how a SPEC's status changes.
- `--spec <desc>` authors SPEC(s) and writes them straight to `.claude/specs/backlog/` with `Status: draft` — it runs NO agents and has NO approval gate (backlog grooming only).
- `--feature --next` / `--feature --backlog <slug>` implement a SPEC already in the backlog: it is treated as already created + approved, so Phase 0 + Phase 1 are SKIPPED — move `backlog/ → active/`, run Phase 2, then `active/ → done/`. `--next` resumes a SPEC already in `active/` if present, else takes the top-ordered backlog file (ignoring `*-00-overview.md`).
- All code changes happen inside spawned agents.
- If a spawned agent fails — stop the chain and report immediately.
- LLM agent output is validated as JSON (or BRAINSTORM block for architect). On parse failure, retry the same agent ONCE with an explicit "JSON only, no prose" preface. Second failure → stop.
- Maximum 3 clarifying questions before generating SPEC.
- Reviewer step runs after every Developer pass, before Tester (deterministic script `${CLAUDE_PLUGIN_ROOT}/scripts/mp-reviewer-<platform>.sh`; agent fallback on script error). A violation blocks the chain.
- Runner step is the deterministic script `${CLAUDE_PLUGIN_ROOT}/scripts/mp-runner-<platform>.sh` (agent fallback on script error). Runner gets at most 2 runs per task (1 main + 1 retry after auto-fix). Never loop more than once.
- `mp-verifier-<platform>` runs after Runner pass on `--feature` only. A static_checks failure blocks the chain; on pass, push waits for explicit user `y` after the manual checklist is shown. (`--bugfix` skips Verifier — bugfixes rarely touch wiring.)
- `--tdd` flag (only on `--feature`) reorders Phase 2: Tester writes failing unit tests first (`red_phase=true`), Runner verifies the red, then Developer implements until green (`green_phase=true`). Opt-in only; default order remains developer-first. `--bugfix` is unchanged — regression tests are written inline by the developer there.
- `mp-runner-instrumented-android` runs the on-device suite (`connectedDebugAndroidTest`) for ONE test class and trusts the parsed connected report, not "BUILD SUCCESSFUL". `mp-runner-android` (JVM unit tests) is unchanged and is NOT the device runner.
- `--device` is Android-only, runs one control per invocation, and never pushes. A connected device/emulator is mandatory: if none is present the orchestrator asks the user and records the answer to the `device-connection` memo (the runner agent cannot prompt). On-device test seams are restricted to `testTag` / `contentDescription` / `<Name>Content` visibility — a `--device` diff must never add new UI, events, or behaviour.
- `--plan` spawns `mp-planner` (read-only) and writes ONLY under `.claude/specs/` behind a y/d/n gate; it is the `/mp-spec` bundle → backlog bridge and pairs with `--feature --next`.
- `--improve` is the ONLY path that changes the mobile-pipeline marketplace, ALWAYS via a gated PR. Two modes: `--improve "<note>"` (direct → its OWN PR via `propose-improvement.sh`) and `--improve --drain` (batch the `.ai/proposals/` queue → ONE PR via `improve-drain.sh`). Patches edit only `templates/`; never a direct push; never this project's source. Project-local lessons go to memory / `.claude/mp/extras/`, not here.
- `--reflect` is cross-project + maintainer-level: runs `mp-cross-reflect.sh` (aggregates lessons across `~/.config/mobile-pipeline/projects.txt`) then `mp-reflect`, which QUEUES proposals only for patterns seen in >=2 projects. Opens no PRs — drain with `--improve --drain`.
- `mp-knowledge` runs at most once post-ship and is usually a no-op. It classifies each lesson PROJECT-LOCAL (→ memory/extras) vs PLUGIN-LEVEL (→ STAGE to the `.ai/proposals/` queue via `mp-improve`, then suggest `--improve --drain`). It never edits source or the live plugin copy.
