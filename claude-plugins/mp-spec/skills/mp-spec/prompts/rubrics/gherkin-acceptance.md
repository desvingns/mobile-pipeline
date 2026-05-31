---
id: rubrics/gherkin-acceptance
version: 1.0.0
inputs: [user-stories, requirements, feature_inventory]
outputs: [acceptance/*.feature]
model: sonnet
owner_agent: acceptance-criteria-writer
tags: [acceptance, gherkin, bdd, neutral, spec-layer]
platform: neutral
---

# Gherkin acceptance-criteria rubric

Turn user stories into **executable acceptance criteria** in Gherkin (Given/When/Then). These are the testable pinning of the requirements and the contract the dev pipeline's tester implements. **UI-toolkit-agnostic** so the same `.feature` drives Android (Compose/Robolectric) and a future iOS (XCTest) test.

## File organization
- One `.feature` file per epic / story group (e.g. `acceptance/auth.feature`, `acceptance/transactions.feature`).
- `Feature:` line names the capability; a short description line links the stories it covers.

## Scenario rules

- **Tag each scenario** with the story it satisfies: `@US-007` (and `@FR-012` if it pins a specific cross-cutting FR). This is what `traceability.csv` joins on.
- **Given/When/Then**, `And`/`But` for extra steps. Exactly one `When` per scenario (one trigger); split otherwise.
- **Cover the state matrix per screen:** happy path + the observed states — `empty`, `error`, `loading`, validation edges. A screen with only a happy-path scenario is an evaluator finding.
- **Deterministic & concrete:** assert observable outcomes ("the balance shows 1 250 ₽"), not internals.
- Use `Scenario Outline` + `Examples` for the same flow over multiple inputs (e.g. validation table).
- `Background:` for shared preconditions within a feature.

## Step language — NEUTRAL (hard rule)

Steps describe **user-visible behaviour in domain terms**, never UI-toolkit nouns.

- ✅ `When the user enters "100" as the amount and confirms`
- ✅ `Then the expense is recorded and the dashboard balance decreases by 100`
- ❌ `When the user taps the Compose Button with testTag "save"` (toolkit-specific — forbidden)
- ❌ `Then the Room database has a new row` (persistence-specific — forbidden)

Reference screens by their inventory name/`Sxx` in prose, not by widget type.

## Skeleton

```gherkin
Feature: Add expense
  Covers US-007, US-008. Source screens: S06.

  Background:
    Given the user is on the dashboard

  @US-007
  Scenario: Record a valid expense
    Given the user opens the add-expense screen
    When the user enters "100" as the amount, picks the "Food" category, and confirms
    Then the expense is recorded
    And the dashboard returns to view with the balance reduced by 100

  @US-007 @validation
  Scenario: Reject a zero amount
    Given the user opens the add-expense screen
    When the user enters "0" as the amount
    Then the confirm action remains disabled

  @US-008 @empty
  Scenario: First expense from the empty state
    Given the user has no transactions
    When the user records their first expense
    Then the empty-state illustration is replaced by the transaction list
```

Return JSON: `{features:[{file, feature, scenarios, us_ids, fr_ids, states_covered}], untestable_stories:[], stories_without_scenario:[]}`.
