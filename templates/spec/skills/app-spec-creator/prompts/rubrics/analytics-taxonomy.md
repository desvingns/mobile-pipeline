---
id: rubrics/analytics-taxonomy
version: 1.0.0
inputs: [feature_inventory, user_stories_md]
outputs: [analytics.md]
model: sonnet
owner_agent: analytics-taxonomy-designer
tags: [analytics, events, taxonomy, neutral, spec-layer]
platform: neutral
---

# Analytics event taxonomy rubric

Define the event taxonomy for product analytics. Every event must be keyed to ≥1 user story (`US-id`) from `user-stories.md`. An event with no `US-id` is an orphan and must be listed separately.

## Event naming convention

`<object>_<action>` in `snake_case`, e.g. `transaction_created`, `screen_viewed`, `sync_failed`.

- Object: the entity or screen the event pertains to (use inventory entity names or screen `Sxx` names).
- Action: past tense verb (`viewed`, `tapped`, `created`, `updated`, `deleted`, `failed`, `completed`, `skipped`).
- Max 40 characters.

## Event types

| Type | When to use | Required props |
|---|---|---|
| `screen_view` | Every screen transition (including deep link) | `screen_id` (Sxx), `referrer_screen_id` (nullable) |
| `action` | User-initiated discrete action (tap, submit, toggle) | `screen_id`, `element_id` (stable string), `value` (nullable) |
| `funnel` | Step in a multi-step flow (onboarding, checkout, form) | `screen_id`, `funnel_id`, `step_index` (0-based), `total_steps` |
| `error` | System or user error surfaced in UI | `screen_id`, `error_code`, `error_source` (`network`/`validation`/`storage`/`unknown`) |

## Required global props (on every event)

`user_id` (anonymised), `session_id`, `platform` (`android`|`ios`), `app_version`, `event_timestamp_utc`.

## Rules

- **ID:** `EVT-NNN` (zero-padded, stable).
- Every screen in `feature-inventory.json` must have ≥1 `screen_view` event.
- Every funnel flow (onboarding, multi-step form, checkout) must have a complete set of `funnel` events (one per step).
- Every error state in `feature-inventory.json` must have an `error` event.
- Events must be **neutral** (no Firebase/Amplitude/Mixpanel vocabulary in definitions; platform SDKs named in a `<!-- platform:android -->` block only).
- Source tag: `[src: US-NNN]` keyed to the user story; `[src: derived]` if inferred from inventory with no explicit story.

## Output skeleton (`analytics.md`)

```markdown
# Analytics Event Taxonomy

## Event table
| ID | Name | Type | Trigger | Required props | US-ids |
|----|------|------|---------|----------------|--------|
| EVT-001 | screen_viewed | screen_view | User navigates to any screen | screen_id, referrer_screen_id | US-001, US-002 |
| EVT-010 | transaction_created | action | User submits new transaction form | screen_id, element_id, value | US-010 |
| EVT-020 | sync_failed | error | Background sync returns error | screen_id, error_code, error_source | US-030 |
...

## Funnel definitions
### Onboarding funnel (funnel_id: onboarding)
| Step | step_index | Event |
|------|-----------|-------|
| Welcome screen | 0 | EVT-050 |
| Permissions | 1 | EVT-051 |
| Account setup | 2 | EVT-052 |

## Orphan events (no US-id — resolve before shipping)
| ID | Name | Reason orphaned |
|----|------|----------------|
...
```

<!-- platform:android -->
Dispatch via a thin wrapper `AnalyticsTracker.track(name, props)` so the underlying SDK (Firebase Analytics, Amplitude, etc.) can be swapped. Never call SDK APIs from feature modules directly.
<!-- end platform:android -->

Return JSON: `{events:[{id,name,trigger,props,type,us_ids}], orphan_events:[], fetch_error}`.
