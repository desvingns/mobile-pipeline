# Draft prompts for delegatable tasks

These are sketch contracts for the Tier S / Tier A tasks from `delegatable-tasks.md`. Each
draft is "what the local LLM would need to honour to be a drop-in helper for that cmp step".

All drafts assume the local model is OpenAI-compatible (Ollama format works); system prompt
and user prompt are sent in the standard `messages` array. All outputs are **JSON only**, no
prose, to match cmp's strict-output contracts.

## 1. Gradle stacktrace summariser

**System:**
```
You summarise Gradle/JUnit test failure output. Input is a fragment of a Gradle stacktrace.
Output is exactly one JSON object: {"test": "ClassName.methodName", "cause": "one-line plain English"}.
Output JSON only. No prose. No markdown fences.
```

**User (filled by `<prefix>-runner-<plat>`):**
```
<paste gradle log lines around the FAILED test>
```

**Contract:** if the model can't identify a single failing test, return
`{"test": "unknown", "cause": "could not parse"}` — orchestrator falls back to raw log.

## 2. JSON repair

**System:**
```
You repair broken JSON. Input is a near-JSON string that may have: trailing commas, unquoted
keys, unescaped quotes in strings, mixed single/double quotes, or missing closing brackets.
Output is exactly one valid JSON object matching the requested shape. Output JSON only.
```

**User:**
```
EXPECTED SHAPE: {"pass": bool, "violations": [string, ...]}
BROKEN INPUT:
<paste broken JSON>
```

**Contract:** orchestrator parses the output. On parse failure → escalate to Claude for
repair. Maximum two retries before giving up.

## 3. Conventional-commit classifier

**System:**
```
You classify a code change into one of: feat, fix, refactor, test, chore, docs.
Input is a "git diff --stat" plus a short user-supplied description.
Output is exactly one JSON object: {"type": "<one of the labels>", "subject": "<imperative-mood short line, ≤72 chars, no period>"}.
Output JSON only.
```

**User (filled by pre-commit hook):**
```
git diff --stat:
<diff stat output>

description (optional):
<message from user>
```

**Contract:** human reviews the commit message before pushing. Wrong classification is
embarrassing but not destructive.

## 4. Mapper test boilerplate generator

**System:**
```
You write a Kotlin JUnit 4 unit test for a Mapper class. The Mapper has two functions:
- toDomain(entity: <EntityName>): <DomainName>
- toEntity(domain: <DomainName>): <EntityName>
You output a single test class with three @Test methods:
- `toDomain maps all fields`
- `toEntity maps all fields`
- `round-trip preserves all fields`
Output is exactly one Kotlin file body (no markdown fences). Use only fakes/factories
present in the inputs you receive — never invent new dependencies.
```

**User (filled by `<prefix>-tester-<plat>`):**
```
ENTITY:
<paste EntityName.kt contents>

DOMAIN:
<paste DomainName.kt contents>

MAPPER:
<paste MapperName.kt contents>

EXISTING FAKE FACTORIES (use these, do not import others):
<paste any factory helpers found via grep>
```

**Contract:** orchestrator writes the generated body to disk, then runs the test. If it
fails to compile or fails the assertions → revert and escalate to Claude tester.

## 5. UI-string proofreader (Russian / Cyrillic)

**System:**
```
You proofread short Russian UI strings for typos and obvious grammar mistakes.
Input is one Russian UI string. Output is exactly one JSON object:
- {"ok": true} if the string has no detectable issues
- {"ok": false, "suggestion": "<corrected string>"} if there's a likely typo
Output JSON only. Be conservative — flag only obvious mistakes, not stylistic choices.
```

**User (filled by `<prefix>-verifier-<plat>`):**
```
<one Russian UI string from grep output>
```

**Contract:** verifier reports the suggestion to the human as advisory; never auto-applies.

## 6. STATE.md "Recently shipped" one-liner

**System:**
```
You convert a git commit into a one-line STATE.md bullet.
Input: a commit hash, date (YYYY-MM-DD), and subject.
Output is exactly one JSON object: {"bullet": "- <YYYY-MM-DD> `<hash>` <subject>"}.
Output JSON only.
```

**User (filled by `<prefix>-docs`):**
```
HASH: abc1234
DATE: 2026-05-19
SUBJECT: feat: PDF export of diet report by date range
```

**Contract:** trivially mechanical — failure means docs agent falls back to printf.

## 7. Pre-screen review (mark "look here" hotspots)

**System:**
```
You scan a unified diff and tag hunks that may need closer human review. Tags:
- "API" — change to public function signature or exported type
- "FLOW" — change to control flow (new branch, removed branch, loop modification)
- "PERF" — change inside a tight loop or hot path
- "SEC" — change touching auth, crypto, or input parsing
- "STYLE" — style-only change (whitespace, imports, formatting)

Output is exactly one JSON array of objects:
[{"file": "...", "hunk_start_line": N, "tags": ["API", ...]}]

Output JSON only. Tag generously — false positives are cheap, false negatives waste a
reviewer's time.
```

**User (filled by a future `<prefix>-prereview` agent):**
```
<paste git diff output>
```

**Contract:** Claude reviewer agent reads tagged hunks first. Untagged hunks are still
reviewed, just lower priority. Local model tags are advisory, never authoritative.

---

## General notes

- Every contract above is **JSON-only output**. This matches cmp's strict-output contracts
  for Claude sub-agents — the orchestrator can parse local-LLM output the same way.
- System prompts are stable; only user prompts change per invocation. This is friendly to
  Ollama's prompt-cache reuse — first turn warms the cache, subsequent turns are fast.
- Token budgets: keep user prompts under 2k tokens. Local 7B models with 4k–8k context get
  cranky beyond that. Truncate diffs/logs before sending.
- All seven prompts are intentionally narrow. A "general assistant" prompt to a 6 GB model
  is too unconstrained to produce machine-parseable output reliably.
