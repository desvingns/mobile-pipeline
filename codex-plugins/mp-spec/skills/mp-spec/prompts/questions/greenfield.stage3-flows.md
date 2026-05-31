---
id: questions/greenfield.stage3-flows
version: 1.0.0
inputs: [input/interview/stage2.yaml]
outputs: [input/interview/stage3.yaml]
model: n/a
owner_agent: orchestrator
tags: [questions, greenfield, elicitation]
platform: neutral
---

<!-- Source: SKILL.md Step 2 — A-green stage 3 (per-screen flows, dynamic) -->

## Stage 3 — Flows (Step 2, greenfield)

**Intent:** Gather the key actions, validation rules, and edge states for the most
important screens. This stage is **dynamic**: run up to 3 AskUserQuestion batches,
one per top-priority screen. The remaining screens are handled with a brief catch-all
question in Batch 3-D.

Print to user: `⟳ Stage 3/5 — Ключевые сценарии и правила`

---

### How to pick the top-3 screens

Before asking anything, rank the screens from `stage2.yaml` by these criteria (in order):
1. Screens directly serving the top JTBD (highest `jtbd_refs` overlap with the first
   confirmed JTBD).
2. Screens that typically carry the most business logic (e.g., detail/edit/form screens
   before pure list or settings screens).
3. If a tie, prefer screens mentioned first in the user's confirmed list.

Record the selected trio as `top_screens[0..2]` in a local variable. The remaining
screens are `remaining_screens`.

---

### Batch 3-1 through 3-3 — One batch per top screen

For each screen in `top_screens` (loop index `i` = 1, 2, 3), call one
**AskUserQuestion** (up to 3 questions):

```
Q-S3-{i}-1: Экран «{screen.name}» — какие ключевые действия пользователя?
  (Выберите все, что нужно; добавьте своё при необходимости.)
  multiSelect: true
  options:
    - <Action-A>   # model-generated from screen name + JTBD
    - <Action-B>
    - <Action-C>
    - <Action-D>
    - Другое (укажу)

Q-S3-{i}-2: Какие правила валидации или ограничения важны для этого экрана?
  (Примеры: обязательные поля, форматы ввода, лимиты.)
  freeText: true
  placeholder: «Например: email — обязателен; сумма — не более 1 000 000»

Q-S3-{i}-3: Какие пустые / ошибочные / загрузочные состояния нужно предусмотреть?
  multiSelect: true
  options:
    - Пустой список (нет данных — показать заглушку)
    - Ошибка загрузки (сеть / сервер) с кнопкой «Повторить»
    - Состояние загрузки (скелетон или спиннер)
    - Частичная ошибка (часть данных загружена, часть — нет)
    - Не нужно / не применимо
```

Wait for the reply before proceeding to the next screen's batch.

---

### Batch 3-D — Catch-all for remaining screens

After the top-3 batches, collect brief notes on `remaining_screens` in a single call.

If `remaining_screens` is empty, skip this batch.

```
Q-S3-D: Для остальных экранов — есть ли важные особенности?
  (Опишите кратко по каждому или укажите «стандартно».)
  freeText: true
  placeholder: «Экран X: обязательна авторизация. Экран Y: только чтение.»
```

---

**Save.** Write answers to `input/interview/stage3.yaml`:

```yaml
# stage3.yaml — Flows
screens_covered:
  - screen_id: SCR-01
    name: <screen.name>
    priority: top | remaining
    key_actions: [<action>, …]
    validation_notes: <free text>
    edge_states: [empty_list, load_error, loading, …]
  # … one entry per screen
```

Append `stage3` to `phases_completed`.

> **Anti-hallucination note.** Key actions proposed in Q-S3-{i}-1 must be derived from
> the screen's JTBD references in `stage2.yaml`. Stage 4 entity proposals must be
> traceable to the actions and validation rules recorded here — never to items
> invented outside this funnel.
