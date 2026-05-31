---
id: questions/clone.batchA
version: 1.0.0
inputs: [screenshots_dir, play_url, apk_path]
outputs: [user_answers_qA.yaml]
model: n/a
owner_agent: orchestrator
tags: [questions, clone]
platform: neutral
---

<!-- Source: monolith SKILL.md Step 2 — Q-batch A (Phase 0, input clarifications) -->

## Q-batch A — Input clarifications (Step 2)

Print to user: `⟳ Phase 0/5 — Уточняем входные данные`

Call **AskUserQuestion** (single tool call, 4 questions):

```
Q-A1: Целевая аудитория приложения (для секции «Обзор проекта»):
  - Массовый потребительский (B2C)
  - Профессиональный/нишевый (B2B)
  - Игровая аудитория
  - Определить автоматически по Google Play

Q-A2: Есть ли дополнительные источники кроме скриншотов?
  - Только скриншоты + Google Play
  - Есть видео-демо (укажу путь позже)
  - Есть промо-лендинг (укажу URL)
  - Есть APK / реверс уже сделан

Q-A3: Глубина TDD:
  - MVP-spec (~30 страниц, минимум для прототипа)
  - Production-spec (~60 страниц, детальные user stories + edge cases) — рекомендую
  - Reference-spec (~100 страниц, исчерпывающе)

Q-A4: Язык финального TDD:
  - Русский (по умолчанию)
  - Английский
  - Двуязычный (русский + английский глоссарий)
```

Save answers to `pipeline/user_answers_qA.yaml`. Update `00_meta.yaml`:
- `mode_depth: mvp | production | reference`
- `language: ru | en | bilingual`

Append `qA` to `phases_completed`.
