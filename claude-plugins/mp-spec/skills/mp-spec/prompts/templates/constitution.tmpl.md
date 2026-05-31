---
id: templates/constitution
version: 1.0.0
inputs: [target_project_claude_md, target_project_memory, posture_answers]
outputs: [constitution.md]
model: haiku
owner_agent: constitution-author
tags: [standards, constitution, neutral]
platform: neutral
---

# Constitution template (Standards layer)

`constitution.md` is the project's governing principles — the Agent-OS "Standards" layer and Spec-Kit "constitution". It is the **first** artifact and every other artifact (and the `spec-evaluator`) checks against it.

## Generation rule (avoid a competing source of truth)

If the target project already has a `CLAUDE.md` and/or a memory index (`MEMORY.md` + memory files), **derive** the constitution FROM them — restate, don't reinvent. The constitution is a distilled, spec-facing view of conventions that already live in `CLAUDE.md`; when they disagree, `CLAUDE.md` wins and `spec-evaluator` flags the drift. For a greenfield app with no `CLAUDE.md` yet, seed sensible defaults from the posture answers (Stage 5) and the sections below, and mark each principle `(default — confirm)`.

## Required sections (fill; keep each principle one testable sentence)

```markdown
# Constitution — <APP>

> Governing principles for this spec and its implementation. Derived from <CLAUDE.md | defaults>.
> Conflicts: CLAUDE.md is authoritative; this file is the spec-facing restatement.

## Architecture
- <e.g. Clean Architecture, verbose layering kept intentionally — no "simplifications">
- <unidirectional data flow: State / Event / Action>
- <neutral: UI → ViewModel/Presenter → UseCase → Repository → DataSource>

## Testing
- <e.g. Fakes only, no mocking framework>
- <test pyramid: unit (logic) / component (storage) / UI / screenshot>
- <every acceptance criterion must be expressible as a test>

## Data & types
- <money/precision rules, time representation, id scheme — stated in NEUTRAL types>

## Localization (i18n)
- <all user-facing strings externalized; default + translated locales; plural rules>

## Accessibility (a11y)
- <WCAG target level; min touch target; content descriptions on interactive elements>

## Security & privacy
- <secrets never in plain prefs; permission justification required; consent posture>

## Code & process
- <identifiers in English; comments only when WHY is non-obvious>
- <requirements/AC/NFR artifacts MUST be platform-neutral — platform specifics only in platform/*.md>

## Platform realization (informative)
- android: <toolkit/DI/persistence — pointer to platform/android.md>
- ios: <pointer to platform/ios.md, or "(deferred)">
```

## Notes
- Principles are **neutral** (no Compose/Kotlin/SwiftUI in the body). The "Platform realization" section only *points at* `platform/*.md`.
- Keep it short (≤ ~60 lines). It's a checklist for the evaluator, not a manual.
