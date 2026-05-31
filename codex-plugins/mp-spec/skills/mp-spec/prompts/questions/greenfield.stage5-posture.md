---
id: questions/greenfield.stage5-posture
version: 1.0.0
inputs: [input/interview/stage1.yaml, input/interview/stage4.yaml]
outputs: [input/interview/stage5.yaml]
model: n/a
owner_agent: orchestrator
tags: [questions, greenfield, elicitation]
platform: neutral
---

<!-- Source: SKILL.md Step 2 — A-green stage 5 (NFR posture, a11y, security, analytics, i18n) -->

## Stage 5 — Posture (Step 2, greenfield)

**Intent:** Collect the closed-choice NFR posture answers that feed Phase E quality
artifacts (nfr.md, a11y.md, security-privacy.md, analytics.md, i18n.md). All choices
are constrained by prior stages — no open-ended invention.

Print to user: `⟳ Stage 5/5 — Доступность, локализация, данные, аналитика`

---

### Batch 5 — All posture questions in one call

Call **AskUserQuestion** (4 questions):

```
Q-S5-1: Целевой уровень доступности (a11y):
  - Не требуется (нет специальных требований)
  - WCAG 2.1 AA — стандартный производственный минимум
  - WCAG 2.1 AAA — расширенный (госзаказ, приложения для маломобильных групп)

Q-S5-2: Локализация:
  - Один язык (какой? укажите — иначе «ru» по умолчанию)
  - Два языка (укажите коды, например ru + en)
  - Три и более языков (укажите список)

Q-S5-3: Чувствительность данных и согласие пользователя:
  - Нет персональных данных (полностью анонимное приложение)
  - Есть ПД, согласие через in-app форму (GDPR/152-ФЗ consent flow)
  - Чувствительные или регулируемые данные (здоровье, финансы, дети — HIPAA/PCI/COPPA)

Q-S5-4: Цели продуктовой аналитики:
  - Не нужна
  - Базовые воронки (установка → онбординг → удержание)
  - Полная продуктовая аналитика (события по экранам, когорты, A/B-тесты)
```

**Locale follow-up.** If Q-S5-2 answer is not a full list (e.g., «один язык» without
specifying which, or «три языка» without codes), ask in a second single-question call:

```
Q-S5-2b: Уточните языковые коды (BCP-47), например: ru, en, de
  freeText: true
  placeholder: «ru» — или «ru, en» — или «ru, en, fr, de»
```

---

**Save.** Write answers to `input/interview/stage5.yaml`:

```yaml
# stage5.yaml — Posture
a11y_target: none | wcag_aa | wcag_aaa
locales: [ru]              # BCP-47 list
data_sensitivity: no_pii | pii_with_consent | sensitive_regulated
analytics_goals: none | basic_funnels | full_product_analytics
```

Append `stage5` to `phases_completed`.

---

**Post-stage action.** After writing `stage5.yaml`, immediately trigger GATE 1
(SKILL.md Step 3): synthesize the feature inventory from stages 1–5 and present it
to the user for confirmation before proceeding to Phase B.

> **Anti-hallucination note.** NFR and security artifact agents (Phase E) must
> reference `data_sensitivity` and `a11y_target` from this file as the single
> source of truth for their scope — they must not widen scope beyond what is
> declared here unless the user explicitly adds a concern at GATE 1 or GATE 2.
