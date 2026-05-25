# Model picks for ≤6 GB VRAM

Target hardware: a consumer GPU with 6 GB of VRAM (RTX 3060 6 GB Mobile, RTX 2060, etc.) or
Apple Silicon with shared 8 GB unified memory. Quantisation level: **Q4_K_M** for 7B models,
**Q4_K_M** or **Q5_K_M** for 3B–4B models, **FP16** for ≤2B models if you have headroom.

Budget breakdown for 6 GB:
- 4.0–4.5 GB — model weights (Q4_K_M 7B)
- ~0.7 GB — KV cache at 4096 ctx
- ~0.3 GB — runtime / fragmentation
- **Leaves ~0.5 GB free** — comfortable for 7B with 4k–6k context, tight for 8k+

## Tier 1 — recommended default

### Qwen2.5-Coder-7B-Instruct (Q4_K_M, ~4.5 GB)

Strong on Kotlin and Swift, follows JSON output instructions reliably, supports 32k context
(though 4k is plenty for cmp tasks). The default pick for any cmp delegation that involves
reading code, generating boilerplate, or structured output.

Tested well on:
- Kotlin mapper round-trip test generation
- Gradle log stacktrace summarisation
- JSON repair (fixing trailing commas, unquoted keys, broken escaping)
- Conventional-commit classification from a diff

Weak on:
- Anything requiring whole-repo reasoning (it can't see the repo)
- Multi-turn agent behaviour (no native tool-use; you must script tool calls)

## Tier 2 — when 7B is too slow

### Qwen2.5-Coder-3B-Instruct (Q5_K_M, ~2.5 GB)

Roughly 2× faster than the 7B variant. Loses some quality on free-form Kotlin generation but
remains solid on classification and structured output. Use when latency matters more than
nuance — e.g. a pre-commit hook that runs on every commit.

### Phi-3.5-mini-instruct (3.8B, Q4_K_M, ~2.5 GB)

Microsoft's small-model line is strongest at *following instructions* rather than at code.
Good for tasks framed as "given X, classify into one of these labels" or "given X, fill this
template". Weaker than Qwen for free-form code edits.

## Tier 3 — ultra-light

### Gemma 2 2B (Q4_K_M, ~1.5 GB)

Big quality drop vs. 7B, but useful for: typo checks, single-word classification, very simple
templating. Runs comfortably even on CPU.

### Llama 3.2 3B Instruct (Q4_K_M, ~2 GB)

Strong at multilingual output — useful for tasks involving Russian / non-English UI strings
(e.g. proofreading Cyrillic strings before they ship). Weaker on code than Qwen-Coder.

## Models that do NOT fit

For reference, so nobody loses time trying:

- **DeepSeek-Coder-V2-Lite (16B)** — ~10 GB at Q4. Excellent quality but does not fit.
- **Codestral 22B / Mistral Small** — ~13 GB at Q4. Does not fit.
- **Qwen2.5-Coder-14B / 32B** — ~9 GB / 20 GB at Q4. Does not fit.
- Anything labelled "13B", "20B", "30B" in its name — assume no fit until verified.

If you have 8–12 GB VRAM, the 13B–14B tier opens up — quality improves substantially, but
that's outside the 6 GB target this folder is scoped to.

## Runtime picks

Three viable runtimes, all OpenAI-compatible (the contract the integration options assume):

| Runtime | Setup cost | Strengths |
|---|---|---|
| **Ollama** | One command (`ollama pull <model>`) | Easiest. OpenAI-compatible on `localhost:11434`. Cross-platform. |
| **LM Studio** | GUI installer | Easiest to swap models / quantisation interactively. Same OpenAI API. |
| **llama.cpp `llama-server`** | Compile (or download release) | Lowest overhead, best tokens/sec. Manual model management. |

Default recommendation for cmp users: **Ollama**, because it's a one-liner and the same
process runs on Linux/macOS/Windows.

## Throughput expectations

Rough numbers on an RTX 3060 6GB / Apple M2:

| Model | Tokens/sec (decode) | First-token latency |
|---|---|---|
| Qwen2.5-Coder-7B Q4 | 25–45 | 200–400 ms |
| Qwen2.5-Coder-3B Q5 | 60–90 | 100–200 ms |
| Phi-3.5-mini Q4 | 50–80 | 150–300 ms |
| Gemma 2 2B Q4 | 80–120 | 80–150 ms |

For cmp tasks producing 100–300 tokens of output (classification, short JSON, short repair),
end-to-end latency is 1–4 seconds on the 7B and 0.5–1.5 seconds on the 3B tier. That's the
budget the integration design has to live within — see `integration-options.md`.
