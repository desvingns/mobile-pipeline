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

## 2026-05-31T10:00-marketplace-spec
type: add
target: lib/build-marketplace.sh, .claude-plugin/marketplace.json, .agents/plugins/marketplace.json
summary: cmp is now a multi-harness plugin marketplace (mobile-pipeline); new generator emits claude-plugins/mp-spec (skill /mp-spec + 17 sub-agents) and codex-plugins/mp-spec (skill only) from templates/spec
reason: reuse one updatable source across projects (diet_helper, MyMoney_app, future) instead of copy-per-project; modelled on the ai-team-bootstrap marketplace pattern (user request)
affects:
by: claude

## 2026-05-31T10:05-marketplace-dev
type: add
target: lib/build-marketplace.sh, claude-plugins/mp-dev/
summary: emit the dev pipeline as the Claude-only mp-dev plugin (/mp orchestrator + specialist agents + deterministic scripts), de-specialized — agent bodies read .claude/mp/config.json + CLAUDE.md + .claude/mp/extras/*.md at runtime; scripts resolve via ${CLAUDE_PLUGIN_ROOT}
reason: share the dev pipeline across projects without baking package/prefix per copy; honour the codex-001 ownership boundary by generating (not editing) bootstrap.sh / templates scripts
affects:
by: claude

## 2026-05-31T10:10-projects-wired
type: update
target: diet_helper/.claude, MyMoney_app/.claude, MyMoney/.claude (downstream — outside this repo)
summary: wired three projects to the mobile-pipeline marketplace via .claude/settings.json (extraKnownMarketplaces + enabledPlugins). MyMoney staging → mp-spec; MyMoney_app + diet_helper → mp-spec + mp-dev, each with .claude/mp/config.json + .claude/mp/extras/. MyMoney_app .codex max_threads 4→6. Old local cmp-*/dh-* agents left in place (file-safety) — listed for manual removal.
reason: deliver the cross-project reuse the marketplace exists for; additive + reversible (no deletions)
affects:
by: claude

## 2026-05-31T14:00-fold-and-improve
type: add
target: templates/common/agents/{{PREFIX}}-{intake,knowledge,planner,improve}.md, templates/common/scripts/{{PREFIX}}-propose-improvement.sh, templates/common/commands/{{PREFIX}}.md
summary: folded intake (SPEC synth), knowledge (post-ship lesson routing), planner (generic /mp-spec bundle to .claude/specs/backlog bridge), and improve (plugin-level fix drafter) into canonical mp-dev; added orchestrator --plan + --improve workflows + a post-ship Knowledge step + Rules. New propose-improvement.sh opens a gated PR against mobile-pipeline. build-marketplace.sh now also emits common agents + common scripts.
reason: bring diet_helper intake/knowledge + MyMoney planner into the shared canon (user request) and implement the downstream to mobile-pipeline self-improvement PR loop
affects:
by: claude

## 2026-05-31T14:05-diet-helper-archive
type: remove
target: diet_helper/.claude (downstream — outside this repo)
summary: archived diet_helper generic dh-* agents + dh.md + dh-runner/reviewer.sh + PowerShell build/test + folded dh-intake/dh-knowledge into .claude/_archive_pre_mp/ (MOVED not deleted). diet_helper now uses /mp; only selfimprove-retro.md stays local. MyMoney_app left intact (bespoke --phase/--check workflow).
reason: clean up superseded local copies now the mp-dev plugin provides them (user granted cleanup rights); reversible
affects:
by: claude

## 2026-05-31T16:00-improve-batch-reflect-ci
type: add
target: templates/common/scripts/{{PREFIX}}-{improve-drain,cross-reflect}.sh, templates/common/agents/{{PREFIX}}-reflect.md, templates/common/commands/{{PREFIX}}.md, .github/workflows/validate-plugins.yml
summary: improvement loop gains batch + cross-project + CI. --improve splits into direct (own PR) vs --drain (batch all queued proposals into one PR); mp-knowledge/mp-reflect now STAGE to the .ai/proposals/ queue. New --reflect aggregates lessons across projects (cross-reflect.sh + mp-reflect agent, projects from ~/.config/mobile-pipeline/projects.txt) and queues >=2-project patterns. New GitHub Actions CI gate: JSON validity + bash -n + leak check + regeneration-drift. gh installed for auto-PR.
reason: user-requested batch/cross-project/CI on the self-improvement workflow; reduce PR noise, catch systemic patterns, and protect the one-source discipline
affects:
by: claude

## 2026-05-31T17:00-mp-spec-plugin-paths
type: fix
target: lib/build-marketplace.sh, claude-plugins/mp-spec/, codex-plugins/mp-spec/
summary: marketplace mp-spec output now rewrites legacy app-spec-creator names to mp-spec and points Claude sub-agents at ${CLAUDE_PLUGIN_ROOT}/skills/mp-spec/prompts instead of the old global ~/.claude skill path
reason: avoid broken prompt reads after removing the old app-spec-creator global install; keep generated plugin trees cleanly named as mp-spec while preserving the canonical/global install source
affects:
by: codex

## 2026-06-01T09:00-codex-model-tiering
type: update
target: install-spec.sh, templates/spec/codex/agent.toml.tmpl, templates/spec/skills/app-spec-creator/SKILL.md, templates/common/agents/{{PREFIX}}-maintainer.md, templates/common/commands/{{PREFIX}}.md, docs/SPEC-PIPELINE.md, docs/MARKETPLACE.md, CHANGELOG.md
summary: Codex spec-agent install now emits explicit model and model_reasoning_effort tiers; mp-dev templates/docs define the future Codex dev-agent tier contract
reason: avoid every Codex subagent inheriting the parent session's expensive frontier model and reasoning effort
affects: codex
by: codex

## 2026-06-01T18:00-fidelity-loop
type: add
target: templates/android/agents/{{PREFIX}}-fidelity-android.md, templates/common/commands/{{PREFIX}}.md
summary: M1 clone-fidelity gate — new {{PREFIX}}-fidelity-android (multimodal opus, read-only) compares each built screen's screenshot against its reference image, scores per-screen fidelity, honours an intended-deviation ledger (spec/deviations.md), flags behavioural divergences as behavioural_unverified, and returns ready-to-file divergence SPECs; new orchestrator --fidelity workflow captures built screens (Roborazzi/screen-tour/adb), runs the comparator, prints the report, and writes divergence SPECs to .claude/specs/backlog/ behind a y/d/n gate; Usage line + Rules bullet added. Auto-emitted into claude-plugins/mp-dev by build-marketplace (android agents glob).
reason: M1 of the clone-loop closure — the pipeline captured business logic but never compared the built app to its reference, so clones drift (the 7 MyMoney↔Monefy divergences). This is the reference-comparison gate the user requested.
affects: claude, codex
by: claude

## 2026-06-01T18:10-fidelity-spec-inputs
type: add
target: templates/spec/agents/fidelity-checklist-author.md, templates/spec/skills/app-spec-creator/SKILL.md, install-spec.sh
summary: M2 spec-side fidelity inputs — new clone-only spec agent fidelity-checklist-author (opus, multimodal) writes spec/fidelity/<Sxx>.md (per-screen visual+behavioural must-match checklists), spec/fidelity/registry.csv (screen↔reference↔FR/AC), and a spec/deviations.md intended-deviation ledger; SKILL gains a Phase E clone fan-out for it, depth=reference default for clone, the bundle layout entries, and a handoff note about the --fidelity loop; install-spec.sh $AGENTS gains the new agent so the Codex shim is generated too. (Claude mp-spec auto-globs the agent.)
reason: give the M1 fidelity gate a precise, grounded contract per screen + a deviation ledger so intended departures aren't flagged — and default clones to full fidelity depth.
affects: claude, codex
by: claude

## 2026-06-01T18:20-phase-plan-model
type: add
target: templates/common/agents/{{PREFIX}}-phase-planner.md, templates/common/implementation_plan/*.tmpl, templates/common/commands/{{PREFIX}}.md, lib/build-marketplace.sh
summary: M3 generic phase-plan model — ported MyMoney cmp-planner-android into the generic {{PREFIX}}-phase-planner (read-only; design→PHASE_NN + PROGRESS/00_overview deltas; content-addressed slug+hash anchors; sentinel-gated merge; bootstrap/sync/phase modes) + 4 implementation_plan doc templates (README/00_overview/PROGRESS/PHASE_TEMPLATE) + orchestrator workflows --plan --phases / --phase / --check (Usage + sections + Rules). The phase-planner auto-emits a per-screen "Visual QA vs reference" task and (clone) appends a final Fidelity-gate phase. build-marketplace common-agent list gains phase-planner. Phases for clones/large builds; backlog board stays for ad-hoc.
reason: the heavy pofazovaya model that produced MyMoney lived only in MyMoney_app/.claude; bring it into the marketplace as a generic capability + wire reference-comparison as the explicit final phase (user request).
affects: claude
by: claude

## 2026-06-01T18:30-capture-depth
type: update
target: templates/spec/agents/screenshot-business-analyzer.md, templates/spec/skills/app-spec-creator/prompts/templates/design.tmpl.md, templates/spec/skills/app-spec-creator/SKILL.md
summary: M4 capture depth — business-analyzer now extracts a per-screen interactions[] map (gestures / entry order / partial-vs-full overlays) and state_gaps[] (states present in the app but not screenshotted); design.tmpl gains a per-screen "Поведение и жесты" section + an explicit per-state requirement; SKILL A-clone surfaces state_gaps in intake (capture the missing empty/loading/error states). Closes the behavioural/state class of divergence (swipe, entry order, empty state) that static single screenshots miss.
reason: the 7 MyMoney divergences included behavioural/state misses a single screenshot can't show; capture them up front so the fidelity gate (incl. its acceptance/feature arm) can check them.
affects: claude, codex
by: claude

## 2026-06-01T18:40-clone-hardening
type: add
target: templates/android/agents/{{PREFIX}}-tester-android.md, docs/CLONE-PLAYBOOK.md, eval/clone-fidelity/README.md, VERSION
summary: M5 hardening/DX/docs/eval — tester gains a Roborazzi golden-lock note (lock a screen as a CI golden once it passes --fidelity: the deterministic half of the hybrid strategy); new docs/CLONE-PLAYBOOK.md (end-to-end reference→spec→phases→build→fidelity→fix loop + definition-of-clone-done); new eval/clone-fidelity/README.md (MyMoney↔Monefy fixture: detection recall on the 7 known divergences, no intended-deviation false positives, non-increasing-divergence convergence guard); VERSION 1.4.0→1.5.0.
reason: make the clone loop teachable, regression-guarded, and CI-lockable; bump the marketplace version for the fidelity + phase-model feature set.
affects: claude, codex
by: claude

## 2026-06-02T10:00-rename-fidelity-flag-to-fit
type: update
target: claude-plugins/mp-dev/commands/mp.md, templates/common/commands/{{PREFIX}}.md, claude-plugins/mp-dev/agents/mp-fidelity-android.md, claude-plugins/mp-dev/agents/mp-phase-planner.md, claude-plugins/mp-dev/agents/mp-tester-android.md, claude-plugins/mp-spec/agents/fidelity-checklist-author.md, claude-plugins/mp-spec/skills/mp-spec/SKILL.md, codex-plugins/mp-spec/skills/mp-spec/SKILL.md, templates/spec/**, templates/android/agents/**, templates/common/agents/{{PREFIX}}-phase-planner.md, templates/common/implementation_plan/README.md.tmpl, docs/CLONE-PLAYBOOK.md, eval/clone-fidelity/README.md, README.md
summary: Renamed the orchestrator clone-gate FLAG from --fidelity to --fit across all command specs, agent docs, skill prose, templates, playbook and README. Only the literal flag token changed; the "fidelity" CONCEPT is untouched — agent names (mp-fidelity-android, fidelity-checklist-author), bundle paths (spec/fidelity/, build/fidelity/), epic slug (fidelity), fidelity_score, Fidelity-gate phase, and section titles all keep "fidelity". Historical log entries left verbatim (append-only).
reason: user request — shorter, friendlier flag name for the reference-comparison gate.
affects: claude, codex
by: claude

## 2026-06-02T12:30-visual-device-gate
type: update
target: templates/common/commands/{{PREFIX}}.md, templates/android/agents/{{PREFIX}}-runner-instrumented-android.md, templates/android/agents/{{PREFIX}}-runner-android.md, templates/android/agents/{{PREFIX}}-tester-android.md, templates/android/agents/{{PREFIX}}-verifier-android.md, claude-plugins/mp-dev/
summary: Added a hard Android visual autotest device pre-flight for explicitly visual /mp work; generated mp-dev copies now stop before implementation/test execution when required connected-device visual evidence is unavailable, and agents no longer allow JVM screenshots/manual checklist text to substitute for device visual tests.
reason: MyMoney visual work exposed that correct visual development cannot proceed when the required Pixel 5/device is not booted; make the generic pipeline stop early instead of developing or reporting visual tests blind.
affects: claude, codex
by: codex

## 2026-06-02T20:00-device-run-helper-extras-discovery
type: update
target: templates/android/agents/{{PREFIX}}-runner-instrumented-android.md, claude-plugins/mp-dev/agents/mp-runner-instrumented-android.md
summary: Broadened the instrumented runner's Step 2 "project-specific device-run helper" override to also discover the helper in the project's per-agent extras (not only CLAUDE.md), and explicitly sanctioned invoking a PowerShell host-AVD helper from the Bash tool (e.g. powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/<helper>.ps1 -TestClass '<FQN>') as the documented exception to the Bash-only default. Still parse the report, never the exit code.
reason: MyMoney clone migration — its on-device flow runs through scripts/run_connected_test_on_host_avd.ps1 because AGP 8.7.3 UTP rejects the host-AVD remote serial on this Windows host; the generic --device path forbade PowerShell and only looked in CLAUDE.md, so the per-project helper was not first-class.
affects: claude, codex
by: claude

## 2026-06-03T10:00-codex-mp-dev-bridge
type: add
target: templates/dev/codex/, codex-plugins/mp-dev/, lib/build-marketplace.sh, .agents/plugins/marketplace.json, templates/common/agents/{{PREFIX}}-maintainer.md, docs/MARKETPLACE.md, README.md
summary: Added the Codex mp-dev marketplace skill bridge, UI metadata, per-project agent-shim reference/template/config fragment, generator wiring, and marketplace entry; updated the dev-agent Codex tier policy from future guidance to the active shim contract.
reason: MyMoney hard-switch migration proved Codex needs the same mp-dev entrypoint as Claude while keeping project behavior synchronized through .claude/mp/extras/* and native .codex/agents/mp-*.toml shims.
affects: codex
by: codex

## 2026-06-03T14:00-reference-crawler-phase1
type: add
target: templates/spec/skills/app-spec-creator/scripts/crawl/{_crawl-lib,device-preflight,app-control,screencap,ui-dump,input}.sh, templates/spec/agents/crawl-executor.md, templates/spec/skills/app-spec-creator/SKILL.md, templates/spec/skills/app-spec-creator/prompts/questions/clone.crawl-setup.md, install-spec.sh, lib/build-marketplace.sh
summary: Phase 1 of the dynamic reference-APK crawler for /mp-spec clone intake. New optional Phase A.0 installs the reference APK on a connected device and drives it vision-first (crawl-executor, opus) to build a state graph with screenshots, dedup states, and fill input/screenshots/ with an observed corpus. Five cross-platform device primitives under scripts/crawl/ (one JSON line each, mirror mp-runner-android.sh conventions, target $ANDROID_SERIAL, no install-path assumptions). SKILL gains --crawl/--no-crawl + Step 2.0 + the input/crawl/ bundle slot; clone.crawl-setup prompt handles device/consent. install-spec.sh AGENTS table gains crawl-executor (gpt-5.5/high) and both installers + build-marketplace now copy scripts/ into the skill. Additive — auto-skips to static A-clone when no device or the APK won't run.
reason: static clone intake produces a shallow spec (inferred gestures, uncaptured states, guessed nav edges); observing the running reference yields real states + transitions. Phase 1 de-risks the core assumption (can we reliably drive an arbitrary APK) before the navigator/executor/reviewer trio (Phase 2), autonomous seeding (Phase 3), and fidelity wiring (Phase 4).
affects: claude, codex
by: claude

## 2026-06-03T15:00-reference-crawler-device-fixes
type: fix
target: templates/spec/skills/app-spec-creator/scripts/crawl/{ui-dump,input,app-control}.sh, templates/spec/agents/crawl-executor.md
summary: Device-validated the crawl primitives on a real emulator (emulator-5554, Android 34) and fixed three bugs the offline tests could not catch. (1) ui-dump.sh: Git Bash (MSYS) mangled the on-device /sdcard path before it reached adb.exe — now export MSYS_NO_PATHCONV=1 and stream via `adb exec-out cat "$DEV_PATH" > "$OUT"` (a bash redirect, so the LOCAL dest is not an adb path arg). (2) input.sh resolve_center: --clickable was too strict for Compose (the visible label sits on a non-clickable node while the clickable is an anonymous View) — now PREFER a clickable match, else fall back to any text match, so tapping the label's centre hits the parent. (3) app-control.sh launch: now CONFIRMS the target reached the foreground (poll + one retry) and reports ok:false honestly instead of a false success. Also: ui-dump now exposes clickable/clickable_labeled counts and flags compose_degenerate when clickables carry no label; crawl-executor.md documents the Compose label pattern. End-to-end proven: tap --text "Chrome" resolved+tapped → foreground became Chrome.
reason: a real device smoke (the user asked why it wasn't run) exposed Windows/MSYS path conversion, the Compose uiautomator pattern, and unverified launches — exactly the class of bug `bash -n` and synthetic-dump unit tests miss.
affects: claude, codex
by: claude

## 2026-06-03T16:00-reference-crawler-phase2
type: add
target: templates/spec/agents/{crawl-navigator,crawl-reviewer,crawl-executor,navigation-flow-analyzer}.md, templates/spec/skills/app-spec-creator/SKILL.md, install-spec.sh
summary: Phase 2 of the reference-APK crawler — split the single-agent crawler into a separate-session trio. New crawl-navigator (sonnet, read-only) plans the next affordance to explore + its replay path and decides done; new crawl-reviewer (opus, multimodal, read-only) classifies each edge (flow|cycle|error|dead_end), judges the success_test, scores coverage_confidence, and gates accept vs continue; crawl-executor refactored from whole-crawl to goal-scoped (relaunch → replay path → one affordance → capture+dedup → return). SKILL Step 2.0 rewritten: the orchestrator owns a file-persisted loop navigator→(executor⇄reviewer, max 2 retries — mirrors the Phase F evaluator-optimizer)→merge→coverage, stopping on done/plateau(K=4)/budget(40/25/60). navigation-flow-analyzer now accepts the optional observed state-graph.json and converts its edges to source:observed/confidence:1.0 (mapping crawl ST* → business S* via the shared screenshot_file), inferring only uncovered transitions. install-spec.sh AGENTS table gains crawl-navigator (gpt-5.4/medium) + crawl-reviewer (gpt-5.5/high); plugins regenerated, 0 leaks.
reason: the colleague's core advice — never reuse one session for multiple roles; navigator/executor/reviewer with a confidence-gated loop yields better decisions, classified edges, and a coverage stop, and lets observed transitions replace navigation guesses.
affects: claude, codex
by: claude

## 2026-06-03T17:00-reference-crawler-phase3
type: add
target: templates/spec/agents/{crawl-navigator,crawl-executor,crawl-reviewer}.md, templates/spec/skills/app-spec-creator/SKILL.md, templates/spec/skills/app-spec-creator/prompts/questions/clone.crawl-setup.md
summary: Phase 3 of the reference-APK crawler — autonomous data-seeding + auth so populated states are actually observed. crawl-navigator now emits auth goals (get past a sign-in/onboarding wall — unblock before breadth) and seed goals (create entries to reveal an empty state's populated form), in addition to explore. crawl-executor branches on goal.type: auth = fill the form (user-provided credentials if any, else synthetic) + submit + detect verification walls; seed = open the create flow and create `count` entries with synthetic data, then capture the filled list/dashboard. Added a deterministic ASCII synthetic-data fixture set (reproducible corpus) and strengthened guardrails (synthetic only; no real-money/send/share; SMS/email-OTP/captcha → blocker:needs_human, no retry). crawl-reviewer judges auth/seed success from the after-shot (authenticated landing / populated list) and treats needs_human blockers as accept-and-prune. clone.crawl-setup gains a Phase-3 consent (seed | explore-only | decline) + an optional TEST-credentials question; credentials are runtime-only and MUST NOT be written to any artifact. SKILL Step 2.0 collects consent/creds up front and passes credentials to the executor for auth goals. No new agents/scripts; plugins regenerated, 0 leaks.
reason: the static and explore-only paths only ever see empty UI; the user specifically wanted populated/filled states, which require getting past auth and creating data — done autonomously with synthetic fixtures and graceful needs_human degradation on walls the crawl cannot pass.
affects: claude, codex
by: claude

## 2026-06-03T18:00-reference-crawler-phase4
type: add
target: templates/spec/agents/fidelity-checklist-author.md, templates/spec/skills/app-spec-creator/SKILL.md, docs/CLONE-PLAYBOOK.md, docs/REFERENCE-CRAWLER.md
summary: Phase 4 of the reference-APK crawler — close the clone loop. fidelity-checklist-author now consumes the optional crawl_graph + crawl_states_dir: it grounds per-screen must-match checklists in the OBSERVED per-state frames (incl. the data_state:"filled" states seeding produced), writes a visual block per state when a screen was captured empty AND filled, and emits a registry.csv row per (screen, captured state) with a data_state column — so the build-time --fit gate drives the built app into each state and compares it against its own real reference frame. SKILL Step 7 passes the crawl inputs to the fidelity author when A.0-crawl ran. CLONE-PLAYBOOK gains a Step 0 (the dynamic crawl front-door) + updated loop diagram + the auto-state-capture note; new docs/REFERENCE-CRAWLER.md consolidates the subsystem (trio, scripts, artifacts, seam, gotchas, phasing). Auto-enable on --depth reference was already wired (Phase 1). No new agents/scripts; plugins regenerated, 0 leaks. Crawler now feature-complete across all 4 phases.
reason: the dynamic crawl's payoff is only realized when its observed empty+filled frames become the fidelity contract the --fit gate checks against — otherwise the build still drifts on the empty-state class of divergence. This anchors fidelity to states the reference actually showed.
affects: claude, codex
by: claude
