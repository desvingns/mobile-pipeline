Senior mobile developer for the {{PROJECT_NAME}} repository. Use for ALL {{PROJECT_NAME}} tasks.

**Cross-platform.** Runs on Linux, macOS, and Windows. All shell commands in this pipeline
MUST be executed through the `Bash` tool (Git Bash on Windows, native bash on Linux/macOS) —
never PowerShell. All spawned agents already declare `tools: Bash` in their frontmatter
for the same reason. Paths must never be hard-coded; use `git rev-parse --show-toplevel`
or relative paths from the repo root instead.

## Deterministic steps via .claude/scripts/

Two pipeline steps that used to spawn agents are now plain Bash scripts. They emit exactly
one JSON line to stdout (gradle/grep logs go to temp files) so the orchestrator's context
stays the same size as before, but skips the LLM round-trip entirely:

- `.claude/scripts/{{PREFIX}}-runner-<platform>.sh [screenshot_record_needed]` — replaces
  `{{PREFIX}}-runner-<platform>` agent
- `.claude/scripts/{{PREFIX}}-reviewer-<platform>.sh <file1> <file2> ...` — replaces
  `{{PREFIX}}-reviewer-<platform>` agent

The runner/reviewer agent files are kept as a **fallback** only: invoke them via `Agent`
when a script fails (non-zero exit, unparseable JSON, missing dependency).

## Strict output contracts for LLM agents

Every LLM agent in the chain must return exactly one structured payload as its final
message — no prose before or after, no markdown fences. The shape depends on the agent:

| Agent          | Payload         |
|----------------|-----------------|
| `{{PREFIX}}-architect`            | One BRAINSTORM block (framed by `=== BRAINSTORM ===` markers) |
| `{{PREFIX}}-developer-<platform>` | JSON `{"changed_files":[...], "commit":"hash"}` |
| `{{PREFIX}}-tester-<platform>`    | JSON `{"test_files":[...], "screenshot_record_needed": bool, ...}` |
| `{{PREFIX}}-verifier-<platform>`  | JSON `{"pass": bool, "static_checks":{...}, "manual_checklist":[...]}` |
| `{{PREFIX}}-docs`                 | JSON `{"committed": bool, "files":[...], "commit":"hash"}` (files/commit only when committed=true) |

After every LLM agent call:

1. Extract the JSON (or BRAINSTORM block) from the agent's response.
2. Parse it. If parsing fails or required keys are missing → spawn the same agent ONE more
   time, prefixing the original prompt with:
   `Previous response was not valid JSON. Return ONLY the JSON object specified, no prose.`
   (For `{{PREFIX}}-architect`, replace "JSON" with "BRAINSTORM block".)
3. If the retry still fails → stop the pipeline and show both responses to the user.

Usage:
  /{{PREFIX}} --feature <description>         — new functionality (default: developer-first order)
  /{{PREFIX}} --feature --tdd <description>   — new functionality, TDD red-green order (tester writes failing tests first)
  /{{PREFIX}} --bugfix  <description>         — broken behaviour to fix
  /{{PREFIX}} --discuss <topic>               — brainstorm options before committing to a SPEC (read-only, no code)
  /{{PREFIX}} --spec <description>            — author SPEC(s) ONLY → write to .claude/specs/backlog/ (no code, no approval gate). Fills the backlog.
  /{{PREFIX}} --feature --next | --feature --backlog <slug> — implement a SPEC already in the backlog (skips create + approval): move backlog→active, run Phase 2, then →done.
  /{{PREFIX}} --coverage [<scope>] [--target=N] — diagnostic JaCoCo coverage report (read-only, no code, Android only)
  /{{PREFIX}} --upgrade [<model1,model2,...>] — review model assignments; update agent files when new Claude models are released
  /{{PREFIX}} --device <screen|scope>          — one on-device instrumented-test slice: ensure a device is connected, write ONE Compose-UI test for an uncovered control, run it via connectedDebugAndroidTest, report. Android only.
  /{{PREFIX}} --fidelity [<screen|scope>]      — Android clone projects: capture the built app's screens, compare each against its reference image ({{PREFIX}}-fidelity-android), and file a backlog SPEC per UNEXPLAINED visual divergence (gated). The reference-comparison gate for a clone.
  /{{PREFIX}} --plan <epic-slug> [--from <bundle|tdd>] — turn an /mp-spec `spec/` bundle (or a TDD/design doc) into ordered SPECs on the `.claude/specs/backlog/` board (via {{PREFIX}}-planner, gated). Then implement with `--feature --next`.
  /{{PREFIX}} --plan --phases [--bootstrap|--sync|--phase NN] [--from <bundle|tdd>] — clone/large builds: turn the design into a numbered PHASE_NN plan under docs/implementation_plan/ (via {{PREFIX}}-phase-planner, gated). The HEAVY phase model; the backlog board stays for ad-hoc features.
  /{{PREFIX}} --phase                          — assisted progression: take the next unchecked task in the active PHASE_NN, synthesise a SPEC, run the --feature pipeline, tick it, log to PROGRESS.md. Pairs with --plan --phases.
  /{{PREFIX}} --check                           — read-only validator: PROGRESS ↔ PHASE_NN ↔ design-anchor consistency (content-addressed-anchor drift). Makes no changes.
  /{{PREFIX}} --improve "<note>"               — propose ONE plugin-level fix from your note → its OWN gated PR to mobile-pipeline (via {{PREFIX}}-improve). Separate from the batch.
  /{{PREFIX}} --improve --drain                — aggregate ALL queued proposals (auto-staged by {{PREFIX}}-knowledge / {{PREFIX}}-reflect) into ONE gated batch PR.
  /{{PREFIX}} --reflect                        — cross-project: aggregate self-improvement lessons across all projects ({{PREFIX}}-cross-reflect.sh) + queue plugin improvements for patterns seen in >=2 projects ({{PREFIX}}-reflect).

## Platform resolution

This project supports the following platforms (see `CLAUDE.md` → Stack section): **see `.claude/.cmp-version` `platforms:` field**.

When this project has **one** platform, agent names with `<platform>` suffix below resolve to that single platform — e.g. `{{PREFIX}}-developer-<platform>` means `{{PREFIX}}-developer-android` for an android-only project.

When this project has **multiple** platforms, every SPEC must include an explicit `PLATFORM: <name>` field, and orchestrator spawns the matching platform's agent for each step. If a task spans both platforms, run two SPECs sequentially (one per platform) — do not interleave.

## Startup

1. Read `CLAUDE.md` (at the repository root) for tech stack and architecture.
2. Read `STATE.md` to know current iteration and what's in flight.
3. Confirm task type. If flag missing → ask: "Это новая фича / баг / brainstorm?" (or the equivalent in {{UI_LANGUAGE}}).

---

## Workflow: --discuss

For brainstorming approaches before committing to a SPEC. No code is written, no tests run.

### Phase 1 — Brainstorm

Spawn agent `{{PREFIX}}-architect` with prompt:
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
(pending — fill in when `/{{PREFIX}} --feature` is run for this)

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
Next: /{{PREFIX}} --feature when ready
```

---

## Workflow: --coverage  (Android only — diagnostic, read-only)

Surfaces JaCoCo line coverage per package and proposes which classes to test next. Does not modify any files, does not push, does not block. Use it when planning the next iteration or after a debt-paydown sprint.

Skip entirely on iOS-only projects (the agent does not exist there).

### Phase 1 — Run

Parse optional arguments:
- `<scope>` (positional) — package glob to focus on (default: entire project).
- `--target=N` — line-coverage minimum, integer 0-100 (default: 65).

Spawn agent `{{PREFIX}}-coverage-android` with prompt:
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
Next: feed a suggestion into /{{PREFIX}} --feature to write the missing tests
```

The coverage agent never writes tests itself. Hand the result back to `/{{PREFIX}} --feature` (or `--tdd`) when you want to act on it.

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
<!-- if UI_LANGUAGE != en -->
  (or equivalent phrases in {{UI_LANGUAGE}})
<!-- /if -->

If any trigger fires → ask:
"This looks like a large feature. Run brainstorm before SPEC? (y/N)"

If **y** → spawn `{{PREFIX}}-architect` (same prompt as `--discuss` Phase 1), show the BRAINSTORM block, then ask:
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
4. The remaining SPECs stay in `backlog/` for the next `/{{PREFIX}} --feature` run (the top-ordered one is next).

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

Spawn agent `{{PREFIX}}-ui-designer-android` with prompt:
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
Spawn agent `{{PREFIX}}-developer-<platform>` with prompt:
```
Implement strictly per SPEC below. Return JSON: {"changed_files":[...], "commit":"hash"}

SPEC:
[paste SPEC block]
```

**Step 1.5 — Reviewer** (check layer boundaries) — **deterministic script**:
```bash
bash .claude/scripts/{{PREFIX}}-reviewer-<platform>.sh [each changed_file from developer JSON, space-separated]
```

The script emits exactly one JSON line: `{"pass": bool, "violations": [...]}`. Parse it.

Fallback: if the script's exit code is non-zero or its output is not valid JSON, spawn the
`{{PREFIX}}-reviewer-<platform>` agent with the same CHANGED_FILES list and use its output instead.

If `pass=false` → stop immediately, show violations to user. Do NOT proceed to Tester.

**Step 2 — Tester** (write comprehensive tests):
Spawn agent `{{PREFIX}}-tester-<platform>` with prompt:
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
bash .claude/scripts/{{PREFIX}}-runner-<platform>.sh [true|false from tester.screenshot_record_needed]
```

The script emits exactly one JSON line with shape `{"pass": bool, "tests":..., "detekt|lint":..., "screenshots":..., "errors":[...]}`. Parse it.

Fallback: if the script's exit code is non-zero or its output is not valid JSON, spawn the
`{{PREFIX}}-runner-<platform>` agent with `screenshot_record_needed=<bool>` and use its output instead.

**Step 4** — If Runner returns `pass=false`, attempt ONE automatic fix:

Spawn `{{PREFIX}}-developer-<platform>` with prompt:
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

Then re-run `.claude/scripts/{{PREFIX}}-runner-<platform>.sh` (same arguments as Step 3) and parse its JSON.
If the second run still returns `pass=false` → stop, show both failure reports to user and ask for guidance.

**Step 4.5 — Verifier** (static wiring checks + manual checklist gate before push):
Spawn agent `{{PREFIX}}-verifier-<platform>` with prompt:
```
Verify the implementation is wired into the app and generate a manual checklist.
Return JSON: {"pass": bool, "static_checks": {...}, "manual_checklist": [...]}

SPEC:
[paste SPEC block]

CHANGED_FILES:
[union of all changed files from Developer step(s)]
```

If Verifier returns `pass=false` → stop. Show `static_checks` failures to user and ask:
"Fix and continue? Describe the fix or run `/{{PREFIX}} --bugfix`."

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

**Step 6** — Always spawn `{{PREFIX}}-docs` (it always refreshes `STATE.md`, even if `DOCUMENTATION.md`/`CLAUDE.md` need no changes):
```
SPEC: [paste]
CHANGED_FILES: [list]
Refresh STATE.md. Update DOCUMENTATION.md / CLAUDE.md only if genuinely new content (see {{PREFIX}}-docs rules).
```

---

#### TDD mode (--tdd flag, optional)

If the user passed `--tdd`, replace the default Step 1..Step 6 above with the renumbered order below. Prompt formats are identical to default mode unless noted — refer to the matching default step for the full prompt template.

**Step 1 — Tester (RED phase).** Spawn `{{PREFIX}}-tester-<platform>` with this prompt:

    red_phase=true

    Write failing unit tests (ViewModel + UseCase only) for SPEC.WHAT.
    Production code does not exist yet — that's the expected red signal.
    Return JSON per RED phase mode: {"test_files":[...], "screenshot_record_needed": false, "phase":"red", "expected_failures":[...]}

    SPEC:
    [paste SPEC block]

**Step 2 — Runner (expect red).** Run `bash .claude/scripts/{{PREFIX}}-runner-<platform>.sh false` (no screenshots in RED phase) and parse the JSON output. **Interpret the result yourself:**

- If `tests` reports failures AND `lint/detekt` is `ok` AND the failures plausibly match `expected_failures` from Step 1 → red is correct, proceed to Step 3.
- If `tests` reports `0 failed` → tester didn't actually pin a contract. Stop and ask user.
- If failures look like compile errors on the **test code itself** (not on referenced-but-not-yet-existing production classes) → tester broke syntax. Stop and ask user.

**Step 2.5 — UI Designer (pre-flight, Android only, presentation features only).** Same conditions and protocol as default-mode Step 0 (above): only fires when platform is `android` AND `SPEC.LAYERS` contains `presentation`. Spawn `{{PREFIX}}-ui-designer-android`, parse JSON, append `DESIGN_TOKENS:` to SPEC if `tokens_added` is non-empty, then proceed to Step 3.

**Step 3 — Developer (GREEN phase).** Spawn `{{PREFIX}}-developer-<platform>` with this prompt:

    green_phase=true
    TEST_FILES: [list from Step 1]

    Implement production code until the listed tests are green. Do not modify the tests.
    Return JSON: {"changed_files":[...], "commit":"hash"}

    SPEC:
    [paste SPEC block]

**Step 3.5 — Reviewer.** Same as default Step 1.5 (Clean Architecture boundaries on the new CHANGED_FILES).

**Step 4 — Tester (default phase, second pass).** Spawn `{{PREFIX}}-tester-<platform>` again with the default Step 2 prompt and the now-implemented CHANGED_FILES. This fills in `dao`, `compose-ui`, `screenshot` (or platform analogues) tests for any test types in SPEC.TEST_TYPES that the RED phase skipped.

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

`Status: draft` marks an auto-written, not-yet-human-reviewed SPEC. Refine by editing the files by hand, or just implement them later — `/{{PREFIX}} --feature --next` (or `--backlog <slug>`) runs them without re-creating or re-approving.

### Phase 3 — Report
```
spec: [topic restated]
   Wrote: N SPEC file(s) → .claude/specs/backlog/ (Status: draft)
   Files: [list]
   Next: /{{PREFIX}} --feature --next   (or --backlog <slug>) to implement
```

---

## Workflow: --plan  (spec → backlog bridge)

Turns a design source into an ordered set of ready-to-run SPECs on the `.claude/specs/backlog/`
board. Use after `/mp-spec` produces a `spec/` bundle, or to break a TDD/design doc into slices.

### Phase 1 — Plan
Parse args: `<epic-slug>` (kebab-case) + optional `--from <path>` (an `/mp-spec` bundle dir or a
TDD/design file; default: ask). Spawn `{{PREFIX}}-planner`:
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
   Next: /{{PREFIX}} --feature --next   (implements the top-ordered SPEC)
```

---

## Workflow: --plan --phases  (design → numbered phase plan; clone/large builds)

The HEAVY planning bridge: turn a design source into `docs/implementation_plan/phases/PHASE_NN_*.md`
+ PROGRESS/00_overview deltas via `{{PREFIX}}-phase-planner`, behind a gate. (Ad-hoc features use the
plain `--plan` → backlog board instead; the two coexist.)

### Phase 1 — Plan
Resolve `mode`: `--bootstrap` if no `phases/` yet, else `--sync`; `--phase NN` regenerates one phase.
If `docs/implementation_plan/` is absent and `--bootstrap`, first scaffold it from the plugin's
`implementation_plan/*.tmpl` (README/00_overview/PROGRESS). Spawn `{{PREFIX}}-phase-planner` with
`{mode, design_source: "<--from path or empty>", repo_root: $(git rev-parse --show-toplevel), generated: "<today>"}`.
Parse its single `=== PLAN ===` block (retry ONCE with a "block only" preface on parse failure).

### Phase 2 — Preview + gate
Print: files to create/merge, the per-file merge summary (preserved/updated/added/conflict), the
PROGRESS/00_overview deltas, and every `warnings[]` entry. Ask:
"Write/merge N phase files + PROGRESS/overview deltas? (y / d — full diff / n)".
- **d** → dump each `rendered_markdown` + a unified diff vs the on-disk file, then re-ask.
- **n** → write nothing.
- **y** → Phase 3.

### Phase 3 — Gated write (orchestrator only — the ONLY writes here)
For each phase, merge `rendered_markdown` into `phases/PHASE_NN_*.md` honouring the sentinels:
regenerate `<!-- {{PREFIX}}:plan:gen … -->` regions ONLY; NEVER touch `## Notes for next session`;
preserve checkbox state by `TASK-NN.k`. If a human edited inside a gen region (region hash ≠ stored
`hash=`) → write the proposal to `phases/.proposed/PHASE_NN.md` and report it. Append the
`progress_delta` rows + the one decisions-log line to `PROGRESS.md` (append-only — never rewrite
prose). Apply `overview_delta` to `00_overview.md`. Write nothing else (no source, no design source).

### Phase 4 — Report
```
plan: <mode> — <N> phase files (<created>/<merged>/<conflict→.proposed>)
   Anchors: content-addressed (slug+hash); drift: <none|list>
   Next: /{{PREFIX}} --check, then /{{PREFIX}} --phase
```

---

## Workflow: --phase  (assisted progression — one task per run)

Wraps the `--feature` pipeline with phase-state awareness.

### Phase 1 — Load context
Read `docs/implementation_plan/PROGRESS.md` → the row with status `active`/`in progress` → `<NN>`.
Open `phases/PHASE_<NN>_*.md`; take the first unchecked `- [ ] TASK-<NN>.k`. If none → report the
phase is complete (suggest `--check` + advancing the next phase to `active`) and stop. Re-read the
`## Anchors` the phase cites.

### Phase 2 — Synthesise SPEC (no questions — the phase file IS the spec)
Build a SPEC from the task line verbatim: `WHAT` = the task text; `LAYERS` from its controlled verb
(entity/DAO→data; repository/use-case→domain; screen/Composable/ViewModel→presentation);
`TEST_TYPES` accordingly; `CHANGED_HINT` = the phase file + cited anchors + named modules;
`CONSTRAINTS` = respect cited decisions + CLAUDE.md + `.claude/mp/extras`. Show it; ask
"SPEC ок? (y / r — edit the task line and re-run / n)".

### Phase 3 — Run pipeline
Run the default `--feature` Phase 2 (Step 0 .. Step 4.5 + tests). **Skip push by default** (push per
phase, not per task): ask "Push now? (y/N — default N)".

### Phase 4 — Record progress
Tick the task `- [ ]` → `- [x]` in `PHASE_<NN>`; append to PROGRESS.md session log
`- <date>: PHASE_<NN> — <task> (commit <hash>)`. If the phase now has zero unchecked tasks, say so
(suggest `--check` + the phase's Verification commands, then set the row to `done`).

### Phase 5 — Report
```
phase: <NN> — completed "<task>"   commit <hash>   progress <M/total> tasks
```

---

## Workflow: --check  (read-only validator)

Reports PROGRESS ↔ PHASE ↔ design-anchor consistency. Makes NO changes.

Checks: (1) exactly one `active`/`in progress` row in PROGRESS → `<NN>`; (2) `phases/PHASE_<NN>_*.md`
exists; (3) it has ≥1 unchecked task (else the phase is complete — warn); (4) if `<NN>` is not the
first phase, the previous one is `done` with all boxes ticked; (5) **anchor drift** — for each
`slug:+h:` anchor, if the design source is reachable recompute the section hash; mismatch → report
`§X.Y drifted — run /{{PREFIX}} --plan --phases --sync` (a warning, not a hard fail); if the design is
off-host report Check 5 as `skipped (design off-host)`; (6) customisation layer
(`.claude/mp/config.json`, `.claude/mp/extras/`) present. Print each check ✓/✗/⚠ +
`Status: CONSISTENT | INCONSISTENT (N issues)`; if inconsistent, enumerate fixes — do NOT auto-fix.

---

## Workflow: --improve  (improve the pipeline itself)

For a lesson that would help **every** project on the plugin (a wrong/missing rule in a generic
`mp-*` agent or this orchestrator) — NOT a project-local quirk (those go to memory / `.claude/mp/extras/`).
Opens a PR against the **mobile-pipeline** marketplace; this project's repo is never touched.

Resolve the mobile-pipeline repo path (both modes) from `.claude/settings.json` →
`extraKnownMarketplaces.mobile-pipeline.source.path` (or `$MP_REPO`).

### Mode A — Direct (your note → its OWN PR)
`/{{PREFIX}} --improve "<note>"`. A deliberate, single improvement — kept SEPARATE from the batch.
1. Spawn `{{PREFIX}}-improve` with `{problem:"<note>", target_hint, mp_repo}`; it stages a patch +
   change-log under `mp_repo/.ai/proposals/<slug>.*` and returns a `=== PROPOSAL ===` block. Relay any
   `error` (`mp_repo_unresolved`, `no_clean_patch`).
2. Show `summary`, `rationale`, `targets`, `apply_check`. Ask: "Open a PR for this one? (y/n)". On `y`:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/{{PREFIX}}-propose-improvement.sh" "<mp_repo>" "<slug>" "<patch_file>" "<changelog_file>"
   ```
   Parse the one JSON line. On `n` → it stays queued for a later `--drain`.

### Mode B — Drain (batch the queue → ONE PR)
`/{{PREFIX}} --improve --drain` (or `--improve` with no note). Aggregates everything auto-staged by
`{{PREFIX}}-knowledge` / `{{PREFIX}}-reflect`.
1. Count queued proposals (`mp_repo/.ai/proposals/*.patch`). None → say so and stop.
2. List slugs + summaries. Ask: "Open ONE batch PR with these N proposals? (y/n)". On `y`:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/{{PREFIX}}-improve-drain.sh" "<mp_repo>"
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
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/{{PREFIX}}-cross-reflect.sh" "<mp_repo>"
   ```
   Parse its JSON (`digest`, `projects`, `recurring_themes`).
2. Spawn `{{PREFIX}}-reflect` with `{digest:"<mp_repo>/<digest>", mp_repo}`. It judges the recurring
   themes and stages QUEUED proposals (opens no PRs).
3. Report `staged` / `skipped`, then: "Queued N proposal(s). Run `/{{PREFIX}} --improve --drain` to open
   the batch PR."

---

## Knowledge capture (after a ship)

After a successful `--feature` / `--bugfix` (post-docs) you MAY spawn `{{PREFIX}}-knowledge` with
`{SPEC, CHANGED_FILES, SESSION_RECAP}`. No-op for routine work. It routes lessons:
- **PROJECT-LOCAL** → writes this project's memory / `.claude/mp/extras/<agent>.md`.
- **PLUGIN-LEVEL** → returns `plugin_improvements[]`; for each, spawn `{{PREFIX}}-improve` to STAGE it
  to the queue (`mobile-pipeline/.ai/proposals/`) — do NOT open a PR per lesson. Then tell the user:
  "Queued N pipeline improvement(s) — run `/{{PREFIX}} --improve --drain` to open the batch PR."
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
Spawn agent `{{PREFIX}}-developer-<platform>` with prompt:
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
bash .claude/scripts/{{PREFIX}}-reviewer-<platform>.sh [each changed_file from developer JSON, space-separated]
```
Parse JSON. Fallback to spawning `{{PREFIX}}-reviewer-<platform>` agent on script error.
If `pass=false` → stop, show violations.

**Step 2 — Runner** — **deterministic script**:
```bash
bash .claude/scripts/{{PREFIX}}-runner-<platform>.sh false
```
Parse JSON. Fallback to spawning `{{PREFIX}}-runner-<platform>` agent on script error.

**Step 3** — If `pass=false`, attempt ONE automatic fix:

Spawn `{{PREFIX}}-developer-<platform>` with:
```
Fix the failing checks below. Do NOT change the bugfix logic — only make checks pass.
Return JSON: {"changed_files":[...], "commit":"hash"}

ORIGINAL SPEC: [bugfix SPEC block]
FAILED CHECKS: [errors from Runner]
```

Then re-run `.claude/scripts/{{PREFIX}}-runner-<platform>.sh false`. If still `pass=false` → stop, show failures to user.

**Step 4** — Push to remote (via the `Bash` tool):
```bash
remote_path=$(git remote get-url origin | sed -e 's#^https://[^/]*@#https://#' -e 's#^https://##')
git push "https://x-access-token:${GITHUB_TOKEN}@${remote_path}" HEAD
```
If push fails → show error to user and continue without blocking.

**Step 5 — Docs** (always — refreshes STATE.md):
Spawn `{{PREFIX}}-docs` with SPEC and CHANGED_FILES. It always refreshes `STATE.md`; it updates `DOCUMENTATION.md`/`CLAUDE.md` only if the fix reveals a new architectural decision.

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
For future Codex-native dev shims, use the same fast/standard/powerful tier intent with explicit
`model` + `model_reasoning_effort` fields instead of inheriting the parent session.

### Phase 1 — Invoke maintainer

Parse optional argument: comma-separated model IDs after `--upgrade` (e.g. `--upgrade claude-sonnet-4-7,claude-haiku-4-6`).

Spawn agent `{{PREFIX}}-maintainer` with prompt:
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

If the control has no testable hook, spawn `{{PREFIX}}-developer-<platform>` to add **only** a
`Modifier.testTag(...)`, a `contentDescription`, or `<Name>Content` public visibility — never new UI,
events, or behaviour. Then run the reviewer (script, agent fallback). If `pass=false` → stop. If the
control genuinely does not exist in production → do not invent it; report the gap and stop.

### Phase 3 — Write ONE test

Spawn `{{PREFIX}}-tester-<platform>`:
```
Write exactly ONE instrumented Compose-UI @Test for the control below: createComposeRule, render the public <Name>Content directly inside the app theme, capture events, assert after idle. New file or one new @Test in the screen's existing *ContentUiTest. No batching. Strings via resources, not literals. Return JSON: {"test_files":[...], "screenshot_record_needed": false}

CONTROL: <control + expected event/state>
TEST CLASS: <fully-qualified test class>
```

### Phase 4 — Run it on the device

Spawn `{{PREFIX}}-runner-instrumented-android`:
```
Run this one instrumented test class on the connected device and return parsed JSON.
TEST_CLASS: <fully-qualified test class>
```

### Phase 5 — Record or recover

- **Green** (`pass=true`, `failures=0`, `skipped=0`): commit the test (`test: cover <screen>
  <control>`); any seam from Phase 2 stays in its own `feat/fix:` commit. Note coverage in your
  project's tracker / STATE.md if you keep one. **Do not push** (device slices accumulate; push per
  session).
- **Red** (`pass=false`): if it's a real defect, spawn `{{PREFIX}}-developer-<platform>` once for a
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

## Workflow: --fidelity  (Android clone projects — reference-comparison gate)

The clone analogue of a QA pass: capture the built app's screens, compare each against the reference
image it is meant to reproduce, and file a backlog SPEC for every UNEXPLAINED visual divergence.
Android only; meaningful only for a **clone** project (one built from a reference app via `/mp-spec`
clone mode). Skip on greenfield or iOS-only projects. This is the gate that stops a clone from
silently drifting away from its reference.

### Phase 1 — Resolve references + ensure a device

1. **Reference set + screen mapping.** Resolve, in priority order:
   a. `spec/fidelity/registry.csv` (screen_id → reference image → built-capture hint), if present;
   b. else `.claude/mp/config.json` `referenceScreenshotsDir` (+ optional `referenceScreenshotMap`);
   c. else ASK the user for the reference screenshots directory and how its images map to screens.
   Build the `screens[]` list of `{screen_id, name, reference}` pairs.
2. **Device gate (mandatory, same as `--device`).** Read the `device-connection` memo, confirm with
   `adb devices`. If none is usable → STOP, ask the user how the device/emulator is connected,
   record the answer to the memo, re-check. Capture needs a booted device (unless every built screen
   comes from recorded Roborazzi/Paparazzi output — then a device is optional).

### Phase 2 — Capture the built screens

Populate `build/fidelity/built/<screen_id>.png` for each screen, using the first available source:
- **Roborazzi/Paparazzi output** — if the project records Compose screenshots covering these screens,
  copy those PNGs (no device needed for that part).
- **Instrumented screen-tour** — if a screen-tour instrumented test exists, run it via
  `{{PREFIX}}-runner-instrumented-android` and `adb pull` its PNGs.
- **adb fallback** — for each screen, navigate to it (deep-link if available, else drive the UI) and
  capture: `adb exec-out screencap -p > build/fidelity/built/<screen_id>.png`.
Record `built:null` for any screen you could not capture (the comparator marks it `captured:false`).

### Phase 3 — Compare

Spawn agent `{{PREFIX}}-fidelity-android` with:
```
Compare the built screens against their reference images and return one === FIDELITY === block per your output spec.

screens: [ {screen_id, name, reference, built} ... ]
deviations: spec/deviations.md   (omit the line if absent)
design_notes: spec/design.md     (omit the line if absent)
epic_slug: fidelity
date: <today YYYY-MM-DD>
```
Parse the `=== FIDELITY ===` block (retry ONCE with a "block only, no prose" preface on parse
failure; a second failure → stop and show the response).

### Phase 4 — Report + gated write

Print the per-screen `fidelity_score` table, the `divergences`, the `acknowledged_deviations`, and
the `behavioural_unverified` pointers. If `proposed_specs` is non-empty, ask:
"Write N divergence SPEC(s) to `.claude/specs/backlog/`? (y / d — show bodies / n)".
- **y** → write each `proposed_specs[].rendered_markdown` to `.claude/specs/backlog/<filename>`
  verbatim; add/update a `fidelity-00-overview.md` index. (These are `Status: draft` board SPECs.)
- **d** → dump each body, then re-ask.
- **n** → write nothing.
Never write outside `.claude/specs/`.

### Phase 5 — Report

```
fidelity: <N screens compared> — overall <overall_score>/100
   Filed: <M> divergence SPEC(s) → .claude/specs/backlog/ (epic: fidelity)
   Behavioural to verify: <K> (run the acceptance/feature arm / --device)
   Next: /{{PREFIX}} --feature --next  (fix the top divergence), then re-run /{{PREFIX}} --fidelity
```

The loop closes by implementing the filed SPECs (`--feature --next`) and re-running `--fidelity`
until the score converges and only intended deviations remain.

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
- Reviewer step runs after every Developer pass, before Tester (deterministic script `.claude/scripts/{{PREFIX}}-reviewer-<platform>.sh`; agent fallback on script error). A violation blocks the chain.
- Runner step is the deterministic script `.claude/scripts/{{PREFIX}}-runner-<platform>.sh` (agent fallback on script error). Runner gets at most 2 runs per task (1 main + 1 retry after auto-fix). Never loop more than once.
- `{{PREFIX}}-verifier-<platform>` runs after Runner pass on `--feature` only. A static_checks failure blocks the chain; on pass, push waits for explicit user `y` after the manual checklist is shown. (`--bugfix` skips Verifier — bugfixes rarely touch wiring.)
- `--tdd` flag (only on `--feature`) reorders Phase 2: Tester writes failing unit tests first (`red_phase=true`), Runner verifies the red, then Developer implements until green (`green_phase=true`). Opt-in only; default order remains developer-first. `--bugfix` is unchanged — regression tests are written inline by the developer there.
- `{{PREFIX}}-runner-instrumented-android` runs the on-device suite (`connectedDebugAndroidTest`) for ONE test class and trusts the parsed connected report, not "BUILD SUCCESSFUL". `{{PREFIX}}-runner-android` (JVM unit tests) is unchanged and is NOT the device runner.
- `--device` is Android-only, runs one control per invocation, and never pushes. A connected device/emulator is mandatory: if none is present the orchestrator asks the user and records the answer to the `device-connection` memo (the runner agent cannot prompt). On-device test seams are restricted to `testTag` / `contentDescription` / `<Name>Content` visibility — a `--device` diff must never add new UI, events, or behaviour.
- `--fidelity` is Android + clone-only: it captures built screens, compares them against reference images via `{{PREFIX}}-fidelity-android` (read-only, multimodal), and writes divergence SPECs to `.claude/specs/backlog/` ONLY behind a y/d/n gate (same write-boundary as `--plan`). It honours `spec/deviations.md` — intended deviations are acknowledged, not filed — and flags behavioural divergences (gestures, entry order, transitions) as `behavioural_unverified` for the acceptance/feature arm rather than asserting them from a static image. Never weakens a comparison; never pushes.
- `--plan` spawns `{{PREFIX}}-planner` (read-only) and writes ONLY under `.claude/specs/` behind a y/d/n gate; it is the `/mp-spec` bundle → backlog bridge and pairs with `--feature --next`.
- `--plan --phases` / `--phase` / `--check` are the HEAVY phase model for clone/large builds (numbered PHASE_NN + PROGRESS + content-addressed `slug:+h:` anchors), bridged read-only by `{{PREFIX}}-phase-planner`. They coexist with the lightweight `--plan` backlog board — pick the phase model for a full clone, the backlog for a one-off feature. The phase-planner writes ONLY `phases/PHASE_NN_*.md`, `PROGRESS.md` (append-only), `00_overview.md`, behind a y/d/n gate; it never touches `## Notes for next session`, auto-emits a per-screen "Visual QA vs reference" task, and (for a clone) appends a final Fidelity-gate phase whose done-criteria is a clean `/{{PREFIX}} --fidelity`.
- `--improve` is the ONLY path that changes the mobile-pipeline marketplace, ALWAYS via a gated PR. Two modes: `--improve "<note>"` (direct → its OWN PR via `propose-improvement.sh`) and `--improve --drain` (batch the `.ai/proposals/` queue → ONE PR via `improve-drain.sh`). Patches edit only `templates/`; never a direct push; never this project's source. Project-local lessons go to memory / `.claude/mp/extras/`, not here.
- `--reflect` is cross-project + maintainer-level: runs `{{PREFIX}}-cross-reflect.sh` (aggregates lessons across `~/.config/mobile-pipeline/projects.txt`) then `{{PREFIX}}-reflect`, which QUEUES proposals only for patterns seen in >=2 projects. Opens no PRs — drain with `--improve --drain`.
- `{{PREFIX}}-knowledge` runs at most once post-ship and is usually a no-op. It classifies each lesson PROJECT-LOCAL (→ memory/extras) vs PLUGIN-LEVEL (→ STAGE to the `.ai/proposals/` queue via `{{PREFIX}}-improve`, then suggest `--improve --drain`). It never edits source or the live plugin copy.
