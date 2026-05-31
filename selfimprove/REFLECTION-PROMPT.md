# Reflection prompt — self-improvement loop · L3 Propose

Tool-neutral. Run this in Claude Code or Codex (or via the `selfimprove-retro` agent) once a
retro report exists. It turns aggregated telemetry into concrete, **human-gated** improvement
proposals. It does NOT auto-apply changes.

## Inputs
- `selfimprove/retro/retro-<latest>.md` — aggregated metrics (run `selfimprove/reflect.sh` first).
- `selfimprove/runs/*.jsonl` — raw telemetry (verbatim events).
- `selfimprove/lessons.md` — previously distilled lessons.

## Task
1. Read the latest retro + lessons. Identify, with evidence quoted from the telemetry:
   - the **weakest agent/step** by pass-rate,
   - the **top recurring failure cluster** (group similar `note`/`metric` values),
   - any **flaky** signal (same agent + similar input, different verdict).
2. For each finding, propose exactly ONE minimal change:
   - which agent prompt / template / rule to edit, with the exact wording change, OR
   - a new deterministic guard/check, OR
   - a new durable lesson for `lessons.md`.
3. Output a short list. Each item: `finding → proposed change → target file → expected effect`.

## Gate — do NOT skip
- These are **proposals**. Surface them for human review; do not edit agents/templates until approved.
- On approval:
  - apply the minimal edit,
  - record it once in the change-log
    (**cmp:** `.ai/changes/agent-skill-log.md`; **app projects:** append to `selfimprove/lessons.md`),
  - **cmp only:** let `lib/sync.sh` propagate the change to the per-tool adapters (the same rail
    dual-tool already uses) — never hand-edit two copies.
- Never invent metrics. If the telemetry is too sparse to support a finding, say so and recommend
  wiring more `record-run.sh` calls instead of guessing.
