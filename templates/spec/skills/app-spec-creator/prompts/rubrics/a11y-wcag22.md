---
id: rubrics/a11y-wcag22
version: 1.0.0
inputs: [feature_inventory, style_md]
outputs: [a11y.md]
model: sonnet
owner_agent: a11y-reviewer
tags: [a11y, wcag, accessibility, neutral, spec-layer]
platform: neutral
---

# WCAG 2.2 AA accessibility rubric

Write per-screen accessibility requirements targeting **WCAG 2.2 Level AA**. Every item is testable against a named WCAG success criterion.

## Mandatory checks per screen

| Check | WCAG SC | Metric |
|---|---|---|
| Touch target size | 2.5.8 (AA) | Minimum 24×24 CSS px (logical units); recommended 44×44 CSS px for primary actions |
| Text contrast | 1.4.3 | ≥ 4.5:1 for normal text (< 18 pt); ≥ 3:1 for large text (≥ 18 pt or 14 pt bold) |
| Non-text contrast | 1.4.11 | ≥ 3:1 for UI components and graphical objects against adjacent colours |
| Content description | 4.1.2 | Every interactive element must have a programmatic name; decorative images must be hidden from assistive tech |
| Focus order | 2.4.3 | Focus traversal must follow logical reading order (top-to-bottom, left-to-right for LTR layouts) |
| Focus visibility | 2.4.11 (AA, 2.2) | Focus indicator must have ≥ 3:1 contrast ratio against adjacent colours and ≥ 2 CSS px perimeter |
| Dynamic type / text scaling | 1.4.4 | Text must reflow without loss of content or functionality at 200 % zoom; no truncation without "show more" |
| No colour-only signaling | 1.4.1 | Information conveyed by colour must also be conveyed by text, pattern, or icon |
| Error identification | 3.3.1 | Errors identified programmatically and described in text, not colour alone |

<!-- platform:android -->
Touch target 24×24 CSS px maps to 48×48 dp on mdpi baseline (use `minimumTouchTargetSize` or `Modifier.semantics`).
Use `contentDescription` on `Image` and icon-only `IconButton`; set `Role.Button` on custom clickables.
TalkBack traversal order controlled via `traversalIndex` semantics property.
Test with Accessibility Scanner and TalkBack on API 31+.
<!-- end platform:android -->

## Rules

- **ID:** `A11Y-NNN` (zero-padded, stable).
- Format per item: `- **A11Y-NNN** — [Screen: Sxx] <WCAG SC ref> — <requirement>. (threshold: <metric>)`.
- Every screen listed in `feature-inventory.json` must appear in the per-screen checklist, even if only "no additional concerns".
- Contrast pairs from `03_style.md` (`contrast_pairs[]`) must be checked; flag any pair that fails.
- Source tag: `[src: wcag]` for derived items, `[src: style]` for pairs from style analysis.

## Output skeleton (`a11y.md`)

```markdown
# Accessibility Requirements (WCAG 2.2 AA)

## Per-screen checklist

### S01 — <screen name>
- **A11Y-001** — [Screen: S01] SC 2.5.8 — Every tappable control SHALL have a minimum touch target of 24×24 logical px. (threshold: ≥ 24×24 CSS px / 48×48 dp) [src: wcag]
- **A11Y-002** — [Screen: S01] SC 1.4.3 — Body text SHALL meet a 4.5:1 contrast ratio against its background. (threshold: ≥ 4.5:1) [src: style]
...

## Cross-cutting
- **A11Y-040** — THE SYSTEM SHALL expose a logical focus order on all screens following top-to-bottom, LTR reading sequence. [src: wcag]
...

## Contrast risk log
| Pair | Foreground | Background | Estimated ratio | Risk |
|------|------------|------------|----------------|------|
...
```

Return JSON: `{a11y:[{id,screen_id,requirement,wcag_ref}], contrast_risks:[], screens_uncovered:[], fetch_error}`.
