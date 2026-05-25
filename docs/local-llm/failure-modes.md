# Failure modes and recovery

What can go wrong when a cmp step delegates to a local LLM, and how the orchestrator (Claude)
detects and recovers. Read this before implementing any of the integration options — the
recovery strategy shapes the integration.

## Failure mode 1 — local model offline

User restarted, killed the Ollama server, GPU OOM, model not downloaded yet.

**Detection:** `curl` to `localhost:11434` (or whichever port) fails connection.

**Recovery:**
- The agent that delegated falls back to "Claude does it itself" silently.
- Log one line to the run log: `local LLM unreachable — falling back to Claude`.
- Do NOT halt the pipeline. The local LLM is always an optimisation, never a dependency.

**Implication for design:** any delegation must include a fallback path that Claude can
execute alone. If a task only works with the local LLM, it should not be delegated — it
should be a regular Claude task.

## Failure mode 2 — local model produces malformed JSON

7B models, even when prompted "JSON only", occasionally emit trailing prose, markdown
fences around the JSON, or unbalanced braces.

**Detection:** orchestrator parses the output; parse fails.

**Recovery:**
- Retry once with a stricter system prompt: "Previous output was not valid JSON. Output
  EXACTLY one JSON object, no prose, no fences, no preamble."
- If second attempt also fails → fall back to Claude for the task.
- Track the failure rate per task class. If a task class has >10% retry rate, narrow its
  prompt or drop it from the delegatable list.

**Implication for design:** the same JSON-repair retry pattern Claude already uses for its
own sub-agents (see `templates/common/commands/{{PREFIX}}.md` → "Strict output contracts")
applies here unchanged. Reuse the same logic.

## Failure mode 3 — local model hallucinates file paths, class names, or imports

Tier-A tasks (mapper test generation, lint auto-fix) can emit code that references things
that don't exist.

**Detection:** the output is downstream-validated:
- For test generators: orchestrator compiles the generated test (`./gradlew :app:compileDebugUnitTestKotlin`).
- For lint fixes: orchestrator re-runs the linter and checks the violation count strictly
  decreased.

**Recovery:**
- Revert the generated file (`git checkout -- <file>`).
- Escalate to Claude with the failure context: "local LLM produced unbuildable code for
  task X; please redo".
- Do NOT loop — Claude attempt is the final attempt.

**Implication for design:** every Tier A delegation must have a downstream verification gate
that's cheap enough to run on every output. If verification is expensive (full test suite,
emulator boot), don't delegate.

## Failure mode 4 — local model is slow

Cold-start latency on a model load can be 5–20 seconds. Subsequent calls are 1–4 seconds
for short outputs, but the first call after the user's machine has been idle is brutal.

**Detection:** measure call latency. If it exceeds a threshold (e.g. 30 s), abort and treat
as Failure mode 1.

**Recovery:**
- Set a per-call timeout (e.g. 15 s for short tasks, 60 s for code generation).
- On timeout: kill the request, fall back to Claude.
- Optionally: a `cmp warmup` command keeps the local model resident, paying the cold-start
  cost once at session start.

**Implication for design:** delegations should be on the "save Claude tokens" side of the
budget, not the "must finish fast" side. If a step is latency-critical (interactive
prompt-question round-trip), don't delegate.

## Failure mode 5 — local model contradicts Claude

Subtle. The local model classifies a commit as `feat:` and Claude classifies it as `fix:`.
Without conflict resolution this is silent disagreement.

**Detection:** orchestrator notices when a local-LLM output diverges from what Claude would
have produced. Only practical in tasks where Claude *also* runs (e.g. as fallback or audit).

**Recovery:**
- Generally, prefer Claude's output. Local LLM is the optimisation, not the authority.
- Log the divergence for analysis. If a task class diverges >5% of the time, the prompt
  needs work or the task isn't a good delegation candidate.

**Implication for design:** never delegate a task where Claude can't audit the output later.
Audit ability is a precondition for delegation, not a nice-to-have.

## Failure mode 6 — local model emits sensitive data

7B models are unlikely but not impossible to leak memorised training data into outputs
(e.g. example API keys, names, code from other repos). For cmp's task classes (classify,
summarise, repair) the risk is low — but worth noting.

**Detection:** post-process every local-LLM output through a regex pass for obvious
secrets (`(sk-|gh[ps]_|AIza|Bearer )[A-Za-z0-9_\-]{16,}`).

**Recovery:** if a match is found, drop the output, fall back to Claude, log the incident.

**Implication for design:** never pass the local model anything you wouldn't put in a
public gist. cmp doesn't pass secrets to its agents anyway, but the constraint is worth
making explicit.

## Failure mode 7 — local model output passes validation but is wrong

The hardest case. A test generator emits a test that compiles AND has plausible assertions,
but the assertions are slightly wrong, and they happen to pass against the current code by
coincidence. False green.

**Detection:** very hard. Best mitigation is to keep delegation **narrow** so wrong outputs
are detectable on inspection.

**Recovery:** human review is the backstop. The cmp pipeline already has a
human-in-the-loop gate at the manual-verification checklist step.

**Implication for design:** this is why the Tier F list in `delegatable-tasks.md` exists.
Tasks where wrong-but-plausible outputs are catastrophic (test assertions, security checks,
SPEC contents) are kept with Claude. Delegations are restricted to tasks where wrong
outputs are visible on inspection.

---

## Summary — what makes a task safely delegatable

1. Output is **machine-validatable** (JSON parses, code compiles, lint passes).
2. Failure is **detected at the validation step**, not in production.
3. **Claude can do the same task** as a fallback path, even if more expensively.
4. Wrong-but-plausible outputs are **visible on inspection** (short, structured, in human
   eyeshot before commit).
5. The task is **stateless** — no dependency on conversation history or prior delegated
   outputs.

Tasks failing any of these criteria stay with Claude.
