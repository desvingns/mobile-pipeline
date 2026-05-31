# Agent / skill change-log

Append-only. Newest at the bottom. Format + semantics: see [README.md](README.md).
`sync-state.json` is the authoritative consumed-cursor; do not infer it from this file.

---

## 2026-05-25T00:00-baseline
type: add
target: .ai/
summary: established the dual-tool coordination layer — .ai/ workspace, canonical AGENTS.md, thin CLAUDE.md, and the Codex action-plan brief
reason: make cmp drivable by both Claude Code and Codex CLI (see .ai/tasks/codex-001-dual-tool.md)
affects:
by: claude

## 2026-05-28T12:00-instrumented-runner
type: add
target: templates/android/agents/{{PREFIX}}-runner-instrumented-android.md
summary: new Android agent that runs ONE connectedDebugAndroidTest class on a connected device and returns parsed pass/fail JSON (device suite, not JVM)
reason: the existing runner is JVM-only; on-device Compose-UI coverage had no runner
affects: claude, codex
by: claude

## 2026-05-28T12:01-device-workflow
type: add
target: templates/common/commands/{{PREFIX}}.md
summary: new --device <screen|scope> workflow (Android) — mandatory device-connection gate (ask user + record to memo if missing/lost), write ONE instrumented test, run via the instrumented runner; plus two Rules bullets
reason: give a less-capable model an on-rails one-test-at-a-time on-device loop
affects: claude, codex
by: claude

## 2026-05-28T12:02-device-connection-memo
type: add
target: templates/android/memory/device-connection.md.tmpl
summary: new memory template recording the verified device/emulator connection; holds the mandatory/ask/update-if-lost rule
reason: stop re-asking how the test device is connected; make a connected device a hard precondition
affects: claude, codex
by: claude

## 2026-05-28T12:03-device-seam-policy
type: update
target: templates/android/agents/{{PREFIX}}-tester-android.md, templates/android/agents/{{PREFIX}}-developer-android.md, templates/common/agents/{{PREFIX}}-reviewer-base.md
summary: device-test seam policy — tester gets an instrumented-compose-ui test type; developer may add only testTag/contentDescription/public seams; reviewer Check 7 blocks behaviour beyond a declared seam
reason: prevent a weaker model from inventing UI/events under the guise of a test seam
affects: claude, codex
by: claude

## 2026-05-29T10:00-spec-group
type: add
target: templates/spec/ (skills/app-spec-creator/ + agents/*.md ×17 + prompts/)
summary: ported the requirements→design→handoff half — the app-spec-creator skill, 17 spec/analyzer agents, and the harness-agnostic prompt library (EARS/Gherkin/NFR/a11y/security/analytics/evaluator rubrics, design+platform templates, feature-inventory schema). Prompt paths neutralized to {{AGENT_DIR}}; SKILL.md gets a tool:claude|codex harness-notes block (AskUserQuestion vs STOP gates; native-subagent dispatch).
reason: cmp covered only the dev half; bring in the spec-creation half so the pipeline spans requirements→implementation. See .ai/tasks/claude-002-spec-integration.md.
affects: claude, codex
by: claude

## 2026-05-29T10:01-spec-codex-adapters
type: add
target: templates/spec/codex/ (agent.toml.tmpl, skills/app-spec-creator/agents/openai.yaml, config-fragment.toml)
summary: Codex form of the spec tool — a thin .toml subagent-shim template (re-reads the canonical .md, maps Claude tool names, returns the same JSON, no descendants), the skill openai.yaml interface, and an [agents] config fragment (max_threads=6 >= widest fan-out, max_depth=1).
reason: dual-harness — Codex natively supports SKILL.md + .toml subagents; mirror MyMoney's proven .codex pattern.
affects: codex
by: claude

## 2026-05-29T10:02-install-spec
type: add
target: install-spec.sh (repo root)
summary: standalone global installer — renders {{AGENT_DIR}} to a portable ~/.claude or ~/.codex, strips off-tool blocks, copies the Claude form + generates the 17 Codex shims + merges [agents] config. --harness claude|codex|both, --dry-run, --force. Smoke-tested into a throwaway home (no {{}} / tool: leaks).
reason: the spec tool is GLOBAL (fixed names), not per-project — installs once. NOTE for codex-001: later lib/sync.sh or a bootstrap --install-spec mode may absorb this; install-spec.sh does NOT touch bootstrap.sh/lib/ (codex-owned), and the spec group already ships both forms so it works before sync.sh exists.
affects: claude, codex
by: claude

## 2026-05-29T22:00-selfimprove-loop
type: add
target: selfimprove/ (record-run.sh, reflect.sh, REFLECTION-PROMPT.md, lessons.md, README.md, runs/.gitkeep) + .claude/agents/selfimprove-retro.md
summary: self-improvement loop kit — L1 capture (record-run.sh → runs/*.jsonl, gitignored), L2 reflect (reflect.sh → retro/*.md, awk-only), L3 propose (REFLECTION-PROMPT.md + selfimprove-retro agent), human-gated into THIS change-log → lib/sync. Replicated as a uniform kit into MyMoney_app + diet_helper (app projects gate into their own lessons.md).
reason: close the observe→reflect→propose→gate loop on cmp's own primitives ("self-improvement is a loop, not a store"); it dogfoods the change-log rail it feeds. See .ai/memory/self-improvement-loop.md.
affects: claude, codex
by: claude

## 2026-05-30T12:00-spec-backlog-board
type: add
target: templates/common/commands/{{PREFIX}}.md, templates/common/specs/README.md, templates/common/specs/{backlog,active,done}/.gitkeep
summary: SPEC backlog board — large --feature epics that split into ≥2 SPECs are written as files under .claude/specs/{backlog,active,done}/ (a SPEC's status is the folder it lives in); --feature Phase 1 gains a split step, plus a "## SPEC backlog board" section + a Rules bullet; specs README rewritten to document layout/epic-naming/file-format/lifecycle while keeping the --discuss brainstorm-artifact format
reason: a feature too big for one SPEC was only ever printed to chat; persist + order + resume it as a file-based backlog/current/done board (user request)
affects: claude, codex
by: claude

## 2026-05-30T12:05-spec-backlog-bootstrap
type: update
target: bootstrap.sh
summary: copy_phase now also creates .claude/specs/{backlog,active,done}/ and copies their .gitkeep (so the SPEC backlog board ships to freshly bootstrapped projects, not just the README); dry-run output lists the board folders
reason: complete the spec-backlog-board feature for new projects (companion to 2026-05-30T12:00-spec-backlog-board); does NOT touch the codex-owned --tools/{{AGENT_DIR}}/adapter-emission seams
affects: claude, codex
by: claude

## 2026-05-30T12:10-spec-flag-and-consume
type: add
target: templates/common/commands/{{PREFIX}}.md, templates/common/specs/README.md
summary: --spec <desc> = author SPEC(s) ONLY → write straight to .claude/specs/backlog/ as Status:draft (no agents, no approval gate); --feature gains backlog-consume mode (--next / --backlog <slug>) that moves backlog→active and runs Phase 2 with the stored SPEC verbatim, SKIPPING Phase 0+1 (no re-create, no re-approve); Usage + Rules + specs-README lifecycle updated (draft status added)
reason: separate spec-authoring (fill the backlog) from implementation, and stop re-creating/re-approving a SPEC that was already approved when it entered the backlog (user request)
affects: claude, codex
by: claude
