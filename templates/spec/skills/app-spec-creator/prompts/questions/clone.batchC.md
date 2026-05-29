---
id: questions/clone.batchC
version: 1.0.0
inputs: [pipeline/03_style.md, user_answers_qA.yaml]
outputs: [user_answers_qC.yaml]
model: n/a
owner_agent: orchestrator
tags: [questions, clone]
platform: neutral
---

<!-- Source: monolith SKILL.md Step 5 — Q-batch C (style clarifications) -->

## Q-batch C — Style clarifications (Step 5)

Print: `⟳ Уточняем стилистику`

Read `pipeline/03_style.md` (palette + dark_theme_detected). Substitute hex values into Q-C1.

```
Q-C1: Палитра из анализа: primary <HEX>, accent <HEX>. Что делать?
  - Использовать как есть
  - Сохранить только primary, остальное — Material 3 baseline
  - Полностью заменить на Material You (динамическая палитра)
  - Дам свою палитру (укажу HEX следующим сообщением)

Q-C2: Тёмная тема:
  - Только светлая
  - Только тёмная
  - Обе, переключение в настройках + следование системе
  - Обе, только следование системе

Q-C3: Шрифт:
  - Системный (Roboto)
  - Inter / Manrope
  - Кастомный (укажу TTF позже)
  - Не важно — выберите оптимальный

Q-C4: Уровень визуального соответствия оригиналу:
  - Точно как в оригинале (даже если потребуется кастом)
  - Близко, но с заменами на Material 3 baseline где удобно
  - Только идея + палитра, компоненты строго Material 3
```

> Note on hex substitution: the `<HEX>` placeholders in Q-C1 are replaced at runtime with the actual `primary` and `accent` values read from `pipeline/03_style.md` before the question is displayed to the user.

Save to `pipeline/user_answers_qC.yaml`. Append `qC` to `phases_completed`.
