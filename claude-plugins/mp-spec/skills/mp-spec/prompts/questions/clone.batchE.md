---
id: questions/clone.batchE
version: 1.0.0
inputs: [pipeline/00_meta.yaml, user_answers_qD.yaml]
outputs: [user_answers_qE.yaml]
model: n/a
owner_agent: orchestrator
tags: [questions, clone]
platform: neutral
---

<!-- Source: monolith SKILL.md Step 8 — Q-batch E (architectural) -->

## Q-batch E — Architectural choices (Step 8)

```
Q-E1: DI:
  - Hilt (рекомендую, официальный от Google)
  - Koin (легковесный, без kapt)
  - Без DI (manual injection, для маленького MVP)

Q-E2: Сетевой стек:
  - Retrofit + OkHttp + kotlinx.serialization (рекомендую)
  - Ktor Client
  - Ktor Client + own caching layer
  - Без сети (offline-only)

Q-E3: Хранилище:
  - Room (SQL, типобезопасные DAO)
  - DataStore Preferences (только key-value)
  - Room + DataStore (сложные данные + настройки) — рекомендую
  - SQLDelight

Q-E4: Navigation:
  - Compose Navigation (official) — рекомендую
  - Voyager (type-safe, проще state)
  - Decompose (для будущей миграции на KMP)
```

Save to `pipeline/user_answers_qE.yaml`. Append `qE` to `phases_completed`.
