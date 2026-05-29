---
id: questions/clone.batchB
version: 1.0.0
inputs: [pipeline/02_business.md, user_answers_qA.yaml]
outputs: [user_answers_qB.yaml]
model: n/a
owner_agent: orchestrator
tags: [questions, clone, dynamic]
platform: neutral
---

<!-- Source: monolith SKILL.md Step 4 — Q-batch B (business clarifications — partly dynamic) -->

## Q-batch B — Business clarifications (Step 4)

Print: `⟳ Уточняем бизнес-логику`

Read `pipeline/02_business.md` (the agent's JSON has `ambiguities[]`).

Build **AskUserQuestion** call with these questions (up to 4 — if `ambiguities[]` is empty, drop B4; if `ambiguities[]` has >1 item, call AskUserQuestion a second time as B-dynamic batch with up to 4 items):

```
Q-B1: Что критично для MVP?
  - Только основной флоу (логин + главный экран + 1 ключевое действие)
  - Основной флоу + профиль + поиск
  - Всё, что видно на скриншотах
  - Дам выбрать поэкранно (покажу список и спрошу повторно)

Q-B2: Нужны ли экраны, которых нет на скриншотах?
  - Только то, что видно
  - Добавить онбординг (3 слайда)
  - Добавить экран согласия (GDPR/152-ФЗ)
  - Добавить paywall

Q-B3: Монетизация:
  - Бесплатно, без рекламы
  - Реклама (AdMob)
  - Подписка / IAP (Google Play Billing)
  - Freemium

Q-B4 (динамический, если ambiguities[] не пуст):
  Подставить первый элемент `ambiguities[0].question` как текст вопроса.
  Опции: 4 варианта, сформулированные по контексту экрана.
```

### Dynamic rule

If `ambiguities[]` ≥ 2, после первого батча сделать второй вызов AskUserQuestion (Q-B-dynamic) с оставшимися (до 4 шт). Сохранить в `user_answers_qB_dynamic.yaml`.

Save answers to `pipeline/user_answers_qB.yaml`. Append `qB` to `phases_completed`.
