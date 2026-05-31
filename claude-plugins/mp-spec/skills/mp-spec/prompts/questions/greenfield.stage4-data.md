---
id: questions/greenfield.stage4-data
version: 1.0.0
inputs: [input/interview/stage2.yaml, input/interview/stage3.yaml]
outputs: [input/interview/stage4.yaml]
model: n/a
owner_agent: orchestrator
tags: [questions, greenfield, elicitation]
platform: neutral
---

<!-- Source: SKILL.md Step 2 — A-green stage 4 (data model, auth, integrations, offline) -->

## Stage 4 — Data (Step 2, greenfield)

**Intent:** Lock the data model (entities + relations), auth strategy, third-party
integrations, and offline posture. Uses propose-then-confirm for entities so the model
never invents the schema unilaterally.

Print to user: `⟳ Stage 4/5 — Данные, авторизация, интеграции`

---

### Batch 4-A — Entity inventory (propose-then-confirm)

**Before calling AskUserQuestion**, derive candidate entities from `stage2.yaml` (screens)
and `stage3.yaml` (actions + validation rules):

1. For every screen's `key_actions`, identify the nouns (things created, edited, or
   displayed) — each is a candidate entity.
2. Infer obvious relations (e.g., «Transaction belongs to Account»).
3. Annotate every entity option with the screen + action that motivated it, e.g.:
   *«(SCR-03 / «Сохранить транзакцию»)»*.
4. Include "Другая сущность (укажу)" as the last option.
5. Cap at 10 candidates to keep the question scannable.

Call **AskUserQuestion** (1 question):

```
Q-S4-1: Какие сущности данных нужны приложению?
         (Отметьте нужные, снимите лишние, добавьте недостающие.)
  multiSelect: true
  options:
    - <Entity-A> (из: <SCR-id> / «<action>»)
    - <Entity-B> (из: <SCR-id> / «<action>»)
    - … (up to 10)
    - Другая сущность (укажу)
```

Wait for reply. If "Другая сущность" selected, ask for name(s) and append.

---

### Batch 4-B — Auth, integrations, offline

Call **AskUserQuestion** (3 questions):

```
Q-S4-2: Способ аутентификации пользователей:
  - Нет (приложение без аккаунтов)
  - Email + пароль
  - OAuth — Google
  - OAuth — Apple
  - Phone OTP (SMS / WhatsApp)

Q-S4-3: Какие внешние интеграции нужны?
         (Выберите все; можно добавить своё.)
  multiSelect: true
  options:
    - Пуш-уведомления (FCM / APNs)
    - Платёжный шлюз (Stripe / RevenueCat / …)
    - Карты и геолокация
    - Аналитика (Amplitude / Firebase / Mixpanel)
    - Облачная синхронизация (Dropbox / Google Drive / iCloud)
    - Ничего из перечисленного
    - Другое (укажу)

Q-S4-4: Офлайн-режим:
  - Не нужен (только онлайн)
  - Кеш для чтения (показывать последние данные без сети)
  - Полная офлайн-синхронизация (создание/редактирование без сети, синхронизация при подключении)
```

---

**Save.** Write answers to `input/interview/stage4.yaml`:

```yaml
# stage4.yaml — Data
entities:
  - id: ENT-01
    name: <label>
    motivated_by: {screen_id: SCR-xx, action: <text>}
    source: proposed | user_added
  # …
auth: none | email_password | oauth_google | oauth_apple | phone_otp
integrations: [push, payments, maps, analytics, sync]   # subset or []
offline: none | read_cache | full_offline_sync
```

Append `stage4` to `phases_completed`.

> **Anti-hallucination note.** Every entity in `stage4.yaml` must reference at least one
> screen + action from `stage3.yaml`. Integration proposals are only offered when they
> map to a confirmed JTBD, screen, or action — never added because they "seem common".
> Stage 5 posture answers (a11y, security) apply on top of this confirmed model.
