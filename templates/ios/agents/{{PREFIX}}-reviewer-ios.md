<!-- iOS OVERLAY — appended to common/agents/{{PREFIX}}-reviewer-base.md by bootstrap.
     No frontmatter here — the base file already has it.
     This file's content goes immediately after the "PLATFORM CHECKS BELOW" marker
     in the assembled agent.

     STUB (cmp v1.0.0) — patterns are TODO. See docs/CUSTOMIZATION.md. -->

---

## Checks (iOS — concrete commands)

> **STUB (cmp v1.0.0)** — adapt grep patterns to your iOS project's module layout (single target vs SPM modules vs Tuist modules).

Concrete grep commands for the 4 layer-boundary concepts described in the "Concept" section above. Run each against files listed in CHANGED_FILES.

### Check 1 — Domain purity (no UI/framework imports in domain layer)

```bash
# Adapt 'Sources/{{PROJECT_NAME}}/Domain' to your actual domain path
grep -rn "^import \(UIKit\|SwiftUI\|Combine\|CoreData\|Foundation\.NS\)" Sources/*/Domain/ 2>/dev/null
```

Any match is a violation. Domain must be pure Swift with no framework coupling. `Foundation` itself (for `Date`, `URL`, etc.) is acceptable; specific Foundation UI/UI-derived imports are not.

### Check 2 — Presentation isolation (no Data layer imports in Presentation)

```bash
grep -rn "^import .*Data\." Sources/*/Presentation/ 2>/dev/null
# Or, if Data is a separate SPM module:
# grep -rn "^import {{PROJECT_NAME}}Data" Sources/*/Presentation/
```

Any match is a violation. Presentation depends only on Domain.

### Check 3 — ViewModel boundary (no direct Repository injection)

```bash
grep -rn "Repository" Sources/*/Presentation/ 2>/dev/null
```

A match inside an initialiser parameter (e.g. `init(repo: FooRepository)` on a ViewModel) is a violation — ViewModels accept UseCases, not Repositories. Matches in comments or UseCase return-type signatures are acceptable — use context to judge.

### Check 4 — View testability (Content view exposed)

For each new `*Screen.swift` file in CHANGED_FILES:

```bash
grep -n "struct .*Content" <screen_file>
```

A Screen file that lacks a `<Name>Content` View struct is a violation. (The `<Name>Screen` wrapper handles DI; `<Name>Content` is the stateless, testable body — mirrors Compose Screen/Content split.)
