---
id: rubrics/domain-math
version: 1.0.0
inputs: [feature_inventory, grounding, decision_ledger]
outputs: [a "Calculation" block in a SPEC or design.md]
model: n/a
owner_agent: orchestrator
tags: [rubric, domain-logic, math, calculation, testability, neutral]
platform: neutral
---

# Domain-math rubric

When a feature carries non-trivial **calculation** — money math (interest, annuity, amortization, tax),
projections (dates, run-rate), scheduling, unit/currency conversion, scoring/ranking — specify the math
precisely enough that it compiles to a **pure, unit-tested function**. Vague math is the highest-risk
part of a feature spec; pin it here so the coding pipeline turns the worked examples straight into tests.

## When to apply

Trigger this rubric for any requirement/SPEC whose output is a **computed number or date** and whose
formula is not obvious from its name. Skip it for plain CRUD.

## What every calculation block must pin

1. **Formula** — the exact expression, not prose. Define every symbol.
2. **Symbol & unit table** — for each input/output: name, type (prefer exact: `BigDecimal` / `LocalDate`
   / `Int`), unit, allowed range.
3. **Precision & rounding** — the math context (e.g. `DECIMAL64`), where rounding happens (boundary
   only), the mode (`HALF_UP` / `CEILING`) and dp. Money is never a floating `Double`.
4. **Edge cases** — divide-by-zero, zero/negative inputs, empty ranges, already-satisfied, unreachable;
   what each returns (a status enum, **not** a crash).
5. **≥3 worked numeric examples** — committed as **test fixtures** with hand-checked expected outputs:
   at minimum a trivial/zero case, a normal case, and a boundary/special case. These ARE the unit tests.
6. **Determinism** — pure function; inject `today`/clock as a parameter (no hidden `now()`); no I/O.

## Output skeleton (a "Calculation" block inside the SPEC or design.md)

```markdown
### Calculation: <name>
- Formula: `A = P·i·(1+i)^n / ((1+i)^n − 1)`   (annuity; if i == 0 → `A = P / n`)
- Symbols: P = principal (BigDecimal, ≥0); i = monthly rate = annual% / 100 / 12;
           n = term in months (Int, ≥1); A = monthly payment (BigDecimal, 2 dp).
- Precision: MathContext.DECIMAL64 internally; round A HALF_UP to 2 dp at the boundary only.
- Edge: P ≤ 0 → no loan (A = 0); n < 1 → invalid (reject); i == 0 → A = P / n.
- Worked examples (fixtures):
  | P         | annual% | n  | expected A |
  |-----------|---------|----|------------|
  | 1 000 000 | 0       | 10 | 100 000.00 |
  | 1 000 000 | 12      | 12 |  88 848.79 |
  | <boundary case>                        |
```

## Rule

A calculation requirement with **no formula + no worked examples is ungrounded** — the evaluator treats
it like a vague requirement and flags it. The worked examples are not decoration: the downstream coding
pipeline lifts them directly into the use-case's unit tests, so they must be hand-checked and exact.
