---
id: questions/greenfield.stage1-vision
version: 1.0.0
inputs: [app_idea_paragraph]
outputs: [input/interview/stage1.yaml]
model: n/a
owner_agent: orchestrator
tags: [questions, greenfield, elicitation]
platform: neutral
---

<!-- Source: SKILL.md Step 2 — A-green stage 1 (vision & strategic posture) -->

## Stage 1 — Vision (Step 2, greenfield)

**Pre-step (before AskUserQuestion).**

If the user invoked `/app-spec-creator --greenfield` without a description, ask first:

> «Опишите приложение в одном абзаце — что оно делает и кому. Пока без деталей.»

Wait for the reply. Save the raw text to `input/interview/idea_paragraph.txt` and record `app_working_title` in `pipeline/00_meta.yaml` (slugify the first noun phrase).

**Then run the Grill (Stage 0) — unless `--no-grill`.** Before this question batch, run the design-tree interrogation over the idea paragraph: `Read prompt techniques/grill-me.md` and follow it literally (one question at a time, recommended answer each, roots before branches, poke holes). Write `input/interview/grill.md` and append `grill` to `phases_completed`. The batch below — and stages 2–5 — then read that ledger: motivate every answer/proposal from a grilled decision or the idea paragraph, never re-introduce an "Out of scope" item, and carry deferred open-questions into the owning stage.

Only then proceed to the question batch below.

---

Print to user: `⟳ Stage 1/5 — Видение и стратегические параметры`

Call **AskUserQuestion** (single tool call, 4 questions):

```
Q-S1-1: Целевая аудитория:
  - B2C — массовый потребитель
  - B2B — малый бизнес / команды
  - Нишевый / профессиональный сегмент
  - Игровая аудитория

Q-S1-2: Целевая платформа(ы):
  - Android (только)
  - iOS (только)
  - Обе платформы

Q-S1-3: Монетизация:
  - Полностью бесплатно (без рекламы)
  - Реклама (IAB-баннеры / интерстишиалы)
  - Подписка или разовые покупки (IAP)
  - Freemium (базовый функционал бесплатно, расширенный — платно)

Q-S1-4: Целевая зрелость спецификации:
  - MVP — минимальный набор для прототипа (~30 страниц)
  - Production — детальные user stories + edge cases (~60 страниц, рекомендуется)
  - Reference — исчерпывающая документация (~100 страниц)
```

**Save.** Write answers to `input/interview/stage1.yaml`:

```yaml
# stage1.yaml — Vision
idea_paragraph: <verbatim from pre-step>
audience: <A1 value>
platforms: [<A2 value(s)>]
monetization: <A3 value>
depth: <A4 value>          # mvp | production | reference
```

Update `pipeline/00_meta.yaml`:
- `mode_depth: mvp | production | reference`
- `platforms: [android] | [ios] | [android, ios]`

Append `stage1` to `phases_completed`.

> **Anti-hallucination note.** Stage 2 must use `audience` and `monetization` from this file
> to motivate every candidate JTBD and screen it proposes. Never invent items that have no
> traceable root in the idea paragraph or a stage-1 answer.
