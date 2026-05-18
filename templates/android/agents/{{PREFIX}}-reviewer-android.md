<!-- ANDROID OVERLAY — appended to common/agents/{{PREFIX}}-reviewer-base.md by bootstrap.
     No frontmatter here — the base file already has it.
     This file's content goes immediately after the "PLATFORM CHECKS BELOW" marker
     in the assembled agent. -->

---

## Checks (Android — concrete commands)

Concrete grep commands for the 4 layer-boundary concepts described in the section above. Run each against files listed in CHANGED_FILES.

### Check 1 — Domain purity (no Android imports in domain layer)

```bash
grep -rn "^import android\." app/src/main/java/{{PACKAGE_PATH}}/domain/
```

Any match is a violation. `domain/` must be pure Kotlin with zero Android dependencies.

### Check 2 — Presentation isolation (no data layer imports in presentation)

```bash
grep -rn "^import {{PACKAGE}}\.data\." \
  app/src/main/java/{{PACKAGE_PATH}}/presentation/
```

Any match is a violation. `presentation/` depends only on `domain/`.

### Check 3 — ViewModel boundary (no direct Repository injection)

```bash
grep -rn "Repository" \
  app/src/main/java/{{PACKAGE_PATH}}/presentation/
```

A match inside a constructor parameter (e.g. `class FooViewModel(val repo: FooRepository)`) is a violation. Matches in comments or UseCase return-type signatures are acceptable — use context to judge.

### Check 4 — Screen testability (Content composable exposed)

For each new `*Screen.kt` file in CHANGED_FILES:

```bash
grep -n "fun .*Content(" <screen_file>
```

A Screen file that lacks a public `<Name>Content(...)` composable is a violation. (The `<Name>Screen` wrapper is the Hilt entry point; `<Name>Content` is the stateless, testable body.)

### Check 5 — Design-system discipline (no hardcoded UI values in presentation)

Run all three greps against each CHANGED_FILES path under `presentation/`. Lines inside comments (starting with `//` or part of `/* … */`) are exempt — judge by context.

**5a — Hardcoded color literals:**
```bash
grep -nE "Color\(0[xX]" app/src/main/java/{{PACKAGE_PATH}}/presentation/
```
Any match is a violation. Use `MaterialTheme.colorScheme.X`. If the color genuinely does not exist in the scheme → ask `{{PREFIX}}-ui-designer-android` to add it to `Color.kt`. See [[material3-design-tokens]].

**5b — Raw `.dp` integer literals (allowlist: `0.dp`, `1.dp`):**
```bash
grep -nE "\b([2-9]|[0-9]{2,})\.dp\b" app/src/main/java/{{PACKAGE_PATH}}/presentation/
```
Any match is a violation. Use `LocalSpacing.current.X` (`xxs`/`xs`/`s`/`m`/`l`/`xl`/`xxl` on the 4dp grid). See [[spacing-scale-discipline]].

**5c — Hardcoded `fontSize`:**
```bash
grep -nE "fontSize\s*=\s*[0-9]+\.sp" app/src/main/java/{{PACKAGE_PATH}}/presentation/
```
Any match is a violation. Use `style = MaterialTheme.typography.X` instead of inline `fontSize`. See [[material3-design-tokens]].

These checks enforce the design-system contract owned by `{{PREFIX}}-ui-designer-android`. Tokens live in `app/src/main/java/{{PACKAGE_PATH}}/ui/theme/` — that directory is allowed to contain raw literals; `presentation/` is not.
