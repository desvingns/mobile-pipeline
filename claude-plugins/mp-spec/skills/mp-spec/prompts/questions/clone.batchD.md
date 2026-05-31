---
id: questions/clone.batchD
version: 1.0.0
inputs: [pipeline/00_meta.yaml, user_answers_qA.yaml]
outputs: [user_answers_qD.yaml]
model: n/a
owner_agent: orchestrator
tags: [questions, clone]
platform: neutral
---

<!-- Source: monolith SKILL.md Step 7 — Q-batch D (technical) -->

## Q-batch D — Technical parameters (Step 7)

Print: `⟳ Уточняем технические параметры`

```
Q-D1: minSdk (target = 34):
  - minSdk 24 (Android 7.0) — максимальный охват
  - minSdk 26 (Android 8.0) — стандарт 2025 (рекомендую)
  - minSdk 28 (Android 9.0) — современный, без legacy
  - minSdk 31 (Android 12) — только Material You

Q-D2: Offline-режим:
  - Не нужен (требуется постоянный интернет)
  - Кэш чтения (просмотр без сети)
  - Полный offline + sync при появлении сети

Q-D3: Push-уведомления:
  - Не нужны
  - Базовые (FCM, системные уведомления)
  - Rich push (image, action buttons, deep-link)

Q-D4: Локализация:
  - Только русский
  - Только английский
  - Русский + английский
  - 3+ языков (укажу список)
```

Save to `pipeline/user_answers_qD.yaml`. Append `qD` to `phases_completed`.
