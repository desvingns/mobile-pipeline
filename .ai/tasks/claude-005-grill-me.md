# claude-005 — grill-me design-tree interrogation in /mp-spec intake

OWNER: claude
STATUS: DONE (authored + plugins regenerated + 0-leak verified; not committed)
STARTED: 2026-06-05
RELATES: claude-002-spec-integration (the spec tool this extends)

## Goal

Port the **grill-me** technique (Matt Pocock's skill — "walk down each branch of the design
tree", one adversarial question at a time, recommended answer each) into the `/mp-spec`
(`app-spec-creator`) intake as a reusable elicitation technique. Decided with the user:
- **Scope:** both modes. Greenfield gets a mandatory Stage 0 grill; clone grills the analyzer
  `ambiguities[]` / `state_gaps[]` instead of a flat dynamic batch.
- **Activation:** always in greenfield (escape hatch `--no-grill`).

## Design

- Technique, **not** an agent — the orchestrator runs it directly via AskUserQuestion (Claude) /
  chat-and-STOP (Codex). `model: n/a`. No new agent ⇒ no `install-spec.sh` AGENTS row, no
  `openai.yaml` change. Prompt-library files are copied raw by both installers, so the new file
  propagates automatically.
- One reusable fragment: `prompts/techniques/grill-me.md` (id `techniques/grill-me`, v1.0.0,
  platform neutral). Encodes the design-tree rule (roots before branches), ask-one-at-a-time,
  recommended-answer convention, adversarial hole-poking, stop conditions/budgets, and the
  decisions-ledger output. **No `tool:` / `{{ }}` markers** — prompt-library files are NOT
  rendered (only SKILL.md is), so harness differences are written as neutral prose (matches the
  convention: grill-me was the only prompt that ever carried markers — caught + removed).
- Output ledger grounds downstream: greenfield → `input/interview/grill.md`; clone →
  `pipeline/grill.md`. Consumed at GATE 1 (trace every inventory row to a decision; honour
  "Out of scope"; carry deferred items as `(assumption)`).

## Touched (canonical)

- NEW `templates/spec/skills/app-spec-creator/prompts/techniques/grill-me.md`
- `…/SKILL.md` — `--no-grill` flag; A-green Stage 0 grill (mandatory); A-clone ambiguity grill;
  GATE 1 ledger reconciliation; bundle-layout slots (`interview/grill.md`, `pipeline/grill.md`)
- `…/prompts/questions/greenfield.stage1-vision.md` — run grill after the idea paragraph
- `…/prompts/README.md` — new `techniques/` layout row
- `docs/SPEC-PIPELINE.md` — greenfield Stage 0 + clone grill notes
- Regenerated: `claude-plugins/mp-spec`, `codex-plugins/mp-spec` (via `lib/build-marketplace.sh`)

## Verify done

- `bash lib/build-marketplace.sh` OK; 0 `{{…}}` / `<!-- tool:* -->` leaks in the new prompt +
  SKILL + stage1 across **both** plugin trees.

## Follow-ups

- [codex] On next sync, pick up change-log `2026-06-05T10:30-grill-me-design-tree` (affects
  claude, codex). No codex-owned file needed changing (no agent added).
- Optional: a worked greenfield example in `docs/` showing a grill ledger feeding the 5 stages.
- Not yet run end-to-end in a live `/mp-spec --greenfield` session.
