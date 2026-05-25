# Integration options

Three plausible shapes for plugging a local LLM into the cmp pipeline. None of them is
implemented in cmp v1.x — this document is the trade-off analysis to make later.

## Option A — MCP server (most "native")

Stand up a small MCP server (~100 lines) that exposes one or more tools backed by the local
model:

```
tools provided:
  - ask_local_llm(prompt: str, system: str?) → str
  - classify(text: str, labels: [str]) → str
  - extract_json(text: str, shape_hint: str) → object
```

Register it in `.claude/settings.json` and Claude can call it from any agent.

### Pros
- Cleanest integration. Any cmp agent (developer, tester, runner, …) can invoke it without
  touching its prompt or its tool list — Claude decides when to call.
- Tool results are typed; orchestrator can `try/catch` integration failures.
- Survives Claude session boundaries; no per-agent setup.

### Cons
- Needs a small server process running alongside `claude` CLI.
- MCP setup is non-trivial for a first-time user (config file, port, registration).
- Requires Claude Code to detect and use the new tool — if it doesn't, the user sees nothing.

### Best for
Long-term, multi-project, "everyone in the org has a local LLM" deployments.

---

## Option B — Bash + `curl` inside agents (simplest)

Inside an agent's instructions, add an explicit step:

```bash
RESPONSE=$(curl -s http://localhost:11434/api/generate \
  -d '{"model":"qwen2.5-coder:7b","prompt":"…","stream":false}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['response'])")
```

The agent calls the local model directly, parses the output, and integrates it into its own
JSON return.

### Pros
- Zero infrastructure beyond Ollama. No MCP, no extra processes.
- Cross-platform — bash is already mandatory in cmp.
- Easy to fall back: if `curl` fails or the local model is offline, the agent skips the
  enhancement and continues as before.
- The decision to use local LLM lives in the **agent prompt**, so the user sees exactly
  which step is delegated.

### Cons
- Each agent that uses it duplicates the curl-and-parse code.
- The local model becomes a hidden dependency for that agent — runs that hit it without the
  model running degrade silently (or noisily, depending on fallback logic).
- Harder to swap models project-wide (each agent hard-codes the model name).

### Best for
A single, well-defined enhancement to one specific agent — e.g. "let `dh-runner` use a local
model to summarise stacktraces". Start here when prototyping.

---

## Option C — Routing proxy (third-party sidecar)

Use an external project (e.g. `claude-code-router`, LiteLLM, or a hand-rolled proxy) that
sits between `claude` and the Anthropic API, transparently routing some classes of request
to a local model.

### Pros
- Claude Code doesn't need to know. Agent prompts are unchanged.
- Bulk-routes whole categories of "cheap" turns (short turns, tool-call-only turns) to local
  inference, big savings on API spend for high-volume users.

### Cons
- **Significant** setup and maintenance cost. The router needs to maintain its own model
  catalogue and routing rules; you're now debugging two systems.
- Reliability and behaviour become harder to reason about — was that retry caused by my
  prompt or by the router's fallback?
- The routing logic is opaque to the agent prompts that cmp ships, so cmp can't reason
  about it.

### Best for
A user already running many Claude Code projects with high token spend, who is willing to
maintain a sidecar process. Not recommended as a default for cmp.

---

## Recommended sequence

If/when cmp adds local-LLM support, the staged approach:

1. **First** — implement Option B for **one** specific task class (e.g. JSON repair after
   an LLM agent returns malformed output). Single agent change, fully opt-in via env var.
2. **Validate** — run that for 5–10 pipeline iterations. Measure: how often does the local
   model help? How often does it produce garbage that needs Claude fallback?
3. **If positive** — promote to Option A (MCP server) so other agents can opt in without
   each copying the curl boilerplate.
4. **Skip Option C** unless a real user reports they need it.

## Decisions deferred

The following are explicitly *not* decided here — they're for the iteration that ships
local-LLM support:

- **How users configure the model name and URL.** Likely a `.claude/.cmp-local-llm` config
  file or env vars `CMP_LOCAL_LLM_URL`, `CMP_LOCAL_LLM_MODEL`.
- **How agents declare which tasks they delegate.** Probably a `local_llm:` block in
  frontmatter, listing task classes the agent will delegate when available.
- **Fallback policy.** "Always retry on Claude if local fails" vs "fail loudly so user
  knows local LLM is misconfigured". Likely first one.
- **Caching.** Many cmp tasks are repeat-friendly (same git diff → same conventional commit
  prefix). Whether to cache local-LLM responses on disk.
