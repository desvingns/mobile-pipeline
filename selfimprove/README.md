# selfimprove/ — the self-improvement loop

A closed **observe → reflect → propose → gate → propagate** loop, built on this repo's own
primitives. Principle from the architecture review: *self-improvement is a loop, not a store* —
we persist the structured signals the agents already emit, reflect on them, and route proposed
fixes through a human gate into the existing change-log → sync rail.

## Two folders, two lifetimes
- **Telemetry (raw, high-volume, gitignored):** `runs/*.jsonl` — one JSON event per agent/run,
  append-only, never hand-edited.
- **Distilled lessons (low-volume, git-tracked signal):** `lessons.md` (+ cmp's `.ai/memory/`).
  The reflection step promotes patterns here; raw telemetry never pollutes the signal.

## The loop
1. **Capture (L1):** `./record-run.sh --agent <name> --verdict pass|fail|partial [--model M]
   [--metric "tests=42/0;cov=67%"] [--retry N] [--note "..."]` appends one JSON line. Wire it
   into the runner / reviewer / CI so events accrue automatically.
2. **Reflect (L2):** `./reflect.sh` aggregates the JSONL → `retro/retro-<date>.md` (per-agent
   pass-rate, failure clusters, flaky signals). Deterministic, no LLM.
3. **Propose (L3):** run `REFLECTION-PROMPT.md` in Claude/Codex — or the `selfimprove-retro`
   agent — to turn the retro into concrete, minimal change proposals.
4. **Gate:** a human approves. Approved changes get one entry in `.ai/changes/agent-skill-log.md`.
5. **Propagate:** `lib/sync.sh` carries the change to the per-tool adapters — the same rail the
   dual-tool design already uses. Never hand-maintain two copies.

```
record-run.sh ──▶ runs/*.jsonl ──▶ reflect.sh ──▶ retro/*.md ──▶ REFLECTION-PROMPT
      (L1)            (raw)            (L2)         (digest)            (L3)
                                                                         │ human gate
                                                                         ▼
                                              .ai/changes/agent-skill-log.md ──▶ lib/sync.sh ──▶ adapters
```

## Why on our own primitives
cmp already emits structured JSON (runner/reviewer) and has a change-log → `lib/sync.sh` rail plus
durable `.ai/memory/`. The loop just closes the open ends: persist the JSON we were throwing away,
reflect on it, and feed the rail. No external memory product required.

## Relation to `eval/`
`eval/` is for **regression cases** (expected vs actual on fixed inputs). `selfimprove/` is for
**live telemetry + reflection** across real runs. The retro can nominate new `eval/` cases; the
eval gate can later block improvement PRs that regress. They are complementary.
