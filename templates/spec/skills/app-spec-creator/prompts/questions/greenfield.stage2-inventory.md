---
id: questions/greenfield.stage2-inventory
version: 1.0.0
inputs: [input/interview/stage1.yaml, input/interview/idea_paragraph.txt]
outputs: [input/interview/stage2.yaml]
model: n/a
owner_agent: orchestrator
tags: [questions, greenfield, elicitation]
platform: neutral
---

<!-- Source: SKILL.md Step 2 — A-green stage 2 (JTBD, screen inventory, roles) -->

## Stage 2 — Inventory (Step 2, greenfield)

**Intent:** Establish the confirmed set of jobs-to-be-done, screens, and user roles that will
seed GATE 1. Uses propose-then-confirm throughout — the model generates candidates from the
idea + stage-1 answers; the user edits and prunes. Nothing is invented unilaterally.

Print to user: `⟳ Stage 2/5 — Задачи пользователей, экраны, роли`

---

### Batch 2-A — Jobs to be done

Before calling AskUserQuestion, **derive 3–4 candidate JTBDs** from `idea_paragraph.txt`
and `stage1.yaml`. Each candidate must cite the stage-1 field that motivated it, e.g.:
*«(из audience=B2C)»*. Include "Другое (укажу свой вариант)" as the final option.

Call **AskUserQuestion** (1 question):

```
Q-S2-1: Какие ключевые задачи пользователя должно решать приложение?
         (Выберите все подходящие; можно добавить свой вариант.)
  multiSelect: true
  options:
    - <JTBD-1> (из: <stage1 field that motivated it>)
    - <JTBD-2> (из: <stage1 field>)
    - <JTBD-3> (из: <stage1 field>)
    - <JTBD-4, if applicable> (из: <stage1 field>)
    - Другое (укажу свой вариант)
```

Wait for reply. Record confirmed JTBDs. If "Другое" selected, ask for the free-text JTBD
and append it to the list.

---

### Batch 2-B — Screen inventory (propose-then-confirm)

**Before calling AskUserQuestion**, generate a candidate screen list:
1. For each confirmed JTBD, derive 1–3 screens that directly serve it.
2. Annotate every screen option with `(JTBD: <which one>)` so the user sees the motivation.
3. Deduplicate (e.g., a Settings screen likely appears once regardless of JTBDs).
4. Include "Другой экран (укажу название)" as the last option.

Cap the candidate list at 12 screens to keep the question scannable.

Call **AskUserQuestion** (1 question):

```
Q-S2-2: Какие экраны нужны приложению?
         (Отметьте нужные, снимите флажок с ненужных, добавьте недостающие.)
  multiSelect: true
  options:
    - <Screen A> (JTBD: <which>)
    - <Screen B> (JTBD: <which>)
    - … (up to 12)
    - Другой экран (укажу название)
```

Wait for reply. If "Другой экран" selected, ask for the name(s) and append. The confirmed
list becomes the canonical screen inventory that seeds GATE 1.

---

### Batch 2-C — User roles

Derive 2–3 candidate roles from `audience` (stage1) and the confirmed screens. Include
"Другая роль" as the last option.

Call **AskUserQuestion** (1 question):

```
Q-S2-3: Кто будет пользоваться приложением?
         (Выберите все роли; добавьте свою при необходимости.)
  multiSelect: true
  options:
    - <Role-1> (из: audience=<value>)
    - <Role-2> (из: <screen that implies admin/owner/viewer distinction>)
    - <Role-3, if applicable>
    - Другая роль (укажу)
```

---

**Save.** Write answers to `input/interview/stage2.yaml`:

```yaml
# stage2.yaml — Inventory
jtbd:
  - id: JTBD-1
    label: <text>
    motivated_by: <stage1 field>
  # …
screens:
  - id: SCR-01
    name: <label>
    jtbd_refs: [JTBD-1, …]
    source: proposed | user_added
  # …
roles:
  - id: ROLE-1
    label: <text>
    source: proposed | user_added
```

Append `stage2` to `phases_completed`.

> **Anti-hallucination note.** Every screen in `stage2.yaml` must reference at least one
> confirmed JTBD. Every JTBD must trace to a stage-1 answer. Stage 3 must not introduce
> new screens; it may only describe the screens confirmed here.
