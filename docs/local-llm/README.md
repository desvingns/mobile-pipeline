# Local LLM Delegation — Design Notes

**Status:** design notes only — **not implemented** in cmp v1.x. This folder documents which
cmp tasks could plausibly be delegated to a small local LLM (≈3B–7B, Q4 quantisation, fits in
6 GB VRAM) and how the integration would shape up.

The goal is not to replace Claude. Claude remains the orchestrator and the brain for any
task that requires understanding the codebase or making decisions. The goal is to offload
**shaped, mechanical, low-stakes sub-tasks** to a cheap local model — saving Claude's context
budget and reducing API spend for projects that run the pipeline frequently.

## Why this folder exists separately

These notes intentionally live outside `templates/` and outside the agent files. Two reasons:

1. **Not all projects want this.** A hobbyist running cmp on one project has no reason to
   stand up an Ollama server. The integration must remain opt-in.
2. **The integration shape isn't decided yet.** Three plausible shapes (MCP server, bash
   `curl` in agents, sidecar router) trade off setup cost vs. depth of integration. Picking
   one prematurely would force a shape on every cmp consumer.

When/if cmp v1.x adds first-class local-LLM support, the templates that consume it (a new
deferred-tool agent or pre/post-hook) will reference this folder as the rationale doc.

## Files in this folder

| File | Purpose |
|---|---|
| [`models.md`](models.md) | Model picks for ≤6 GB VRAM, sized by task class. Why Qwen2.5-Coder-7B is the default recommendation. |
| [`integration-options.md`](integration-options.md) | Three integration shapes (MCP / bash-curl / router) with trade-offs. No code, just decision-shaping notes. |
| [`delegatable-tasks.md`](delegatable-tasks.md) | Table of cmp pipeline tasks ranked by how safely they can be delegated. Includes "do NOT delegate" rows with rationale. |
| [`prompts.md`](prompts.md) | Draft system + user prompt templates for each delegatable task. Useful when implementation starts — these are the contracts the local model would need to honour. |
| [`failure-modes.md`](failure-modes.md) | What can go wrong (latency spikes, JSON-shape drift, hallucinated paths) and how Claude as orchestrator detects and recovers. |

## Quick orientation

- **Local model never writes production code.** Its outputs are always reviewed by a Claude
  agent before they touch the repo. Treat the local model as a noisy preprocessor.
- **Local model never decides workflow.** Orchestrator decisions (which agent next, push or
  not, retry or stop) stay in Claude.
- **Local model output must be machine-parseable.** Same JSON-only contract as Claude
  sub-agents, otherwise the orchestrator can't compose with it.
- **All delegations are opt-in per project.** Even if cmp ships hooks, a project that doesn't
  set `LOCAL_LLM_URL` in env falls back to Claude transparently.

## Not in scope for these notes

- Cloud-hosted models other than Anthropic (OpenAI, Gemini, Mistral cloud, etc.). Multi-cloud
  routing is a separate concern.
- Fine-tuning a local model on cmp-specific outputs. Quality-tuning the prompts is enough
  for the task classes considered here.
- Replacing Claude entirely with a local model. The orchestrator role demands long-context
  reasoning that 6 GB VRAM models do not have.

See [`delegatable-tasks.md`](delegatable-tasks.md) for the concrete list of cmp pipeline
steps where delegation would be net-positive.
