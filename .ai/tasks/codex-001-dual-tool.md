# codex-001 — dual-tool support (Codex's half)

OWNER: codex
STATUS: ready
RELATED: `AGENTS.md`, `.ai/README.md`, `.ai/changes/README.md`, `.ai/handoff.md`

This brief is self-contained — you (Codex CLI) can execute it without any prior conversation.
It builds the **infrastructure** half of making `claude-mobile-pipeline` drivable by both
Claude Code and Codex. Claude owns the prose half (the `tool:` markers inside templates, the
`.ai/` scaffold, docs); you own the render engine, the sync engine, bootstrap wiring, and the
`.codex/` adapters. The seams between the two halves are **pinned in §3 — treat them as a
contract and do not change them unilaterally** (if one is wrong, note it in `.ai/handoff.md`
under BLOCKERS and stop, rather than diverging).

---

## 0. Before you start

1. Read `AGENTS.md` (repo root) and `.ai/README.md` for the golden rules and the coordination
   protocol. Read `.ai/changes/README.md` for the change-log format.
2. **Verify current Codex CLI specifics against official docs** before writing `.codex/`
   config — the config keys, the `AGENTS.md` discovery behavior, and custom-prompt paths may
   have changed since this brief was written. Confirm: project-scoped `.codex/config.toml`
   location, the key that controls how many bytes of `AGENTS.md` are loaded, and where custom
   prompts live. Reference: https://developers.openai.com/codex/config-reference and
   https://developers.openai.com/codex/config-basic .
3. Work on a branch; keep commits small. Update `.ai/handoff.md` when you finish or hand back.

## 1. Context (why)

Today cmp is single-tool: it only emits a `.claude/` setup and all prose assumes Claude Code
(the `Agent`/`Bash` tools, `CLAUDE.md`, home-dir memory). We are adding a tool-neutral layer so
the **same templates** produce a working pipeline for either tool, and so a generated project
carries a git-tracked shared workspace (`.ai/`). The design principle is *one canonical source
+ thin per-tool adapters* (see `.ai/memory/dual-tool-architecture.md`).

## 2. Files you own

- `lib/render.sh` — add the `tool:` conditional axis.
- `lib/sync.sh` — **new** — the change-log consumer / adapter generator.
- `bootstrap.sh` — `--tools` flag, `{{AGENT_DIR}}` handling, the adapter-emission phase, the
  in-project `.ai/` scaffold, and the `.cmp-version` `tools:` field.
- `templates/codex/` — **new** — the `.codex/` config + optional prompt templates (template
  form, with placeholders) emitted into generated projects.
- A repo-level `.codex/config.toml` so Codex works well *on this repo* too.
- `templates/android/scripts/*.sh`, `templates/ios/` scripts (if any) — verify path-neutrality
  (they should reference `{{AGENT_DIR}}/scripts/...`, not a hard-coded `.claude/scripts/...`).

**Do not edit** (Claude's half): the bodies of `templates/**/agents/*.md`, the orchestrator
`templates/common/commands/{{PREFIX}}.md`, the `.ai/` scaffold files, or `docs/`. You build the
engine; Claude adds the `tool:` markers into those templates afterwards.

## 3. Shared-seam contracts (AUTHORITATIVE — do not change unilaterally)

### 3.1 `{{AGENT_DIR}}` placeholder
A new content placeholder that resolves to the per-tool config dir: `.claude` for the claude
adapter, `.codex` for the codex adapter. Add it to the vars file in `bootstrap.sh`. Templates
use it for tool-config-relative paths, e.g. `{{AGENT_DIR}}/scripts/{{PREFIX}}-runner-android.sh`.

### 3.2 `tool:` conditional axis (in `lib/render.sh`)
Mirror the existing `platform:` functions exactly, including the GNU/BSD `sed` two-pass trick
and the "at most one inline block per line" limitation:

- `strip_tool_block <file> <tool>` — delete `<!-- tool:TOOL -->…<!-- /tool:TOOL -->` blocks
  (inline + multi-line), used for the **non-selected** tool.
- `strip_tool_markers <file> <tool>` — remove just the marker text, keep the wrapped content,
  used for the **selected** tool.

Valid tool names: `claude`, `codex`. Bootstrap applies, per generated adapter: keep the
selected tool's branch (`strip_tool_markers`), delete the other (`strip_tool_block`).
**Unit-test against a small fixture file you create under `test-output/` — do not rely on real
templates having markers yet** (Claude adds those later). Cover: inline block, multi-line
block, a line with marker + content, and two tools in one file.

### 3.3 Change-log + cursor
Format is fixed in `.ai/changes/README.md`. Ordering is **file order** (the log is append-only
and chronological); the cursor `sync-state.json[adapter]` holds the id of the last consumed
entry; "new" = entries appearing strictly after that entry, or all entries if cursor is `null`.
Entries are immutable. Only `lib/sync.sh` writes `sync-state.json`.

### 3.4 `lib/sync.sh` I/O contract
```
lib/sync.sh <adapter>            # adapter ∈ {claude, codex}
  [--changes-dir <dir>]          # default: .ai/changes
  [--root <dir>]                 # default: . (where canonical templates / generated tree live)
```
Behavior: read the cursor for `<adapter>`; for each change-log entry newer than the cursor
whose `affects` includes `<adapter>` (empty `affects` = nothing to propagate), (re)generate
that adapter's derived artifacts from the **current** canonical sources; then advance the
cursor to the newest processed id. Must be **idempotent** (safe to re-run), must not touch the
other adapter's cursor, and must exit non-zero on malformed log / state. Emit exactly one JSON
summary line to stdout (cmp script convention):
`{"adapter":"codex","processed":N,"from":"<id|null>","to":"<id>"}`.
This same routine is what `bootstrap.sh --tools` calls to produce the codex adapter.

### 3.5 Generated `AGENTS.md` format (what sync emits into a target project)
A single markdown file at the generated project root, derived from the agent roster +
orchestrator overview. Skeleton (fill from the rendered agent specs):
```
# AGENTS.md — <PROJECT_NAME> pipeline
Generated by cmp v<CMP_VERSION>. Canonical workflow: run the `<PREFIX>` pipeline.
## Pipeline       # short overview from the orchestrator command
## Agents         # one subsection per role: name, one-line description, output contract (JSON/BRAINSTORM)
## Memory & handoff   # point to .ai/ in the generated project
```
Must be robust whether or not the agent templates contain `tool:` markers yet.

### 3.6 `--tools` flag
`bootstrap.sh --tools=<csv>`, values from {`claude`,`codex`}, **default `claude`** (preserves
today's behavior). When `codex` is included, after the existing render/strip/rename phases, run
the codex adapter emission (`AGENTS.md`, `.codex/`, in-project `.ai/`). Record the chosen tools
in `.claude/.cmp-version` as `tools: <csv>`. A `claude`-only run must be byte-identical to
pre-change output.

## 4. Steps & acceptance criteria

1. **render.sh `tool:` axis** — implement 3.2; fixture unit test passes; `shellcheck` clean.
2. **lib/sync.sh** — implement 3.4; running it twice in a row is a no-op the second time
   (idempotent); malformed `sync-state.json` → non-zero exit with a clear message.
3. **bootstrap.sh** — add `--tools` (3.6) + `{{AGENT_DIR}}` (3.1) to the vars file + the
   emission phase (calls `lib/sync.sh codex`) + the in-project `.ai/` scaffold + `.cmp-version`
   `tools:`. `bash -n` clean.
4. **`.codex/` adapters** — repo-level `.codex/config.toml` (full-AGENTS.md read; sensible
   model/approval/sandbox defaults, commented) + `templates/codex/` template form for generated
   projects. Optional: a `.codex/prompts/` entry mirroring the `<PREFIX>` pipeline.
5. **Path-neutral scripts** — confirm/adjust `templates/**/scripts/*.sh` to use `{{AGENT_DIR}}`.
6. **Verify** (see §6).

## 5. Recording & hand-off (required)

- For each meaningful edit, append a change-log entry to `.ai/changes/agent-skill-log.md`
  (format in `.ai/changes/README.md`), `by: codex`, with the right `affects:`.
- When done or handing back, rewrite `.ai/handoff.md`: DONE (+ commit hashes), DECISIONS, NEXT,
  OWNER (→ `claude` for the template `tool:`-marker pass + integration), BLOCKERS. Commit it
  with your work.

## 6. Verification checklist

- `bash -n bootstrap.sh lib/render.sh lib/sync.sh` and `shellcheck` on all touched scripts:
  clean.
- `./bootstrap.sh --dry-run --tools=claude,codex --platform=android --prefix=ft
  --project-name=Demo --package=com.demo.app` lists `.claude/`, `AGENTS.md`,
  `.codex/config.toml`, and `.ai/` among planned outputs.
- Real bootstrap into a throwaway dir with `--tools=claude,codex`: all trees exist; **no
  `<!-- tool:* -->`, `<!-- platform:* -->`, or `{{...}}` markers leak** into rendered files.
- **Back-compat:** bootstrap with `--tools=claude` (and with the flag omitted) into a temp dir
  is byte-identical to a pre-change bootstrap (diff the two trees).
- **Incremental-sync round-trip:** append a test change-log entry with `affects: codex`, run
  `lib/sync.sh codex`, confirm only that entry is processed, the cursor advances, and a second
  run is a no-op. (Remove the test entry afterwards only if it was a throwaway in a temp
  checkout — never rewrite the committed log.)
