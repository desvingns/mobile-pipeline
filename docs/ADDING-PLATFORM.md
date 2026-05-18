# ADDING-PLATFORM — extending cmp to Flutter / React Native / etc.

cmp v1.0.0 ships with Android (stable) and iOS (stubs). Adding a new mobile platform
(Flutter, React Native, Kotlin Multiplatform, etc.) follows a clear recipe.

## Step 1 — create the platform directory tree

```bash
cd templates/
mkdir -p flutter/{agents,snippets,memory}
touch flutter/{agents,snippets,memory}/.gitkeep
```

## Step 2 — create platform-specific agents

For each agent in `android/` that has direct platform coupling, create a Flutter equivalent.
Minimum set (mirrors android/ and ios/):

- `templates/flutter/agents/{{PREFIX}}-developer-flutter.md`
- `templates/flutter/agents/{{PREFIX}}-tester-flutter.md`
- `templates/flutter/agents/{{PREFIX}}-verifier-flutter.md`
- `templates/flutter/agents/{{PREFIX}}-reviewer-flutter.md` (overlay for `common/agents/{{PREFIX}}-reviewer-base.md`)
- `templates/flutter/agents/{{PREFIX}}-runner-flutter.md`

Use `templates/android/agents/{{PREFIX}}-developer-android.md` as your starting template
— it has the right structure (frontmatter, On Start, Layer Order, Critical Rules, GREEN
phase mode section). Replace Kotlin/Compose/Hilt/Room specifics with Dart/Flutter/Provider/Drift
(or your DI/DB choices).

## Step 3 — create platform-specific snippets

```
templates/flutter/snippets/
├── flutter-detect.sh    # equivalent of jbr-detect.sh, finds Flutter SDK
└── flutter-commands.md  # equivalent of gradle-commands.md, lists pub run / flutter test / etc.
```

## Step 4 — create platform-specific memory templates

Migrate any platform-specific traps you know:

```
templates/flutter/memory/
├── cross-platform-bash-flutter.md.tmpl   # Flutter SDK detection memo
├── dart-mockito-vs-mocktail.md.tmpl      # if you have such a memo from real Flutter work
└── widget-test-vs-integration-test.md.tmpl
```

Common memory (architecture, fakes, user style, git push) is already in
`templates/common/memory/` and applies to all platforms automatically.

## Step 5 — update `bootstrap.sh`

Add Flutter to the platform allowlist:

```bash
# In bootstrap.sh — argument parsing
SUPPORTED_PLATFORMS=(android ios flutter)
```

Update conditional source-root derivation:

```bash
# In bootstrap.sh — derive_vars
case "$platform" in
    android) source_root="app/src/main/java/$PACKAGE_PATH" ;;
    ios)     source_root="$PROJECT_NAME/Sources" ;;
    flutter) source_root="lib" ;;  # Flutter convention
esac
```

## Step 6 — update common templates' conditional blocks

In `templates/common/root/CLAUDE.md.tmpl` and `templates/common/root/DOCUMENTATION.md.tmpl`
— add Flutter sections:

```markdown
<!-- platform:flutter -->
## Stack & Versions (Flutter)
- Dart 3.x · Flutter 3.x
- ...
<!-- /platform:flutter -->
```

The bootstrap stripper will keep these only if `--platform=flutter` is selected.

## Step 7 — document the new platform

Update:
- `README.md` → "Supported platforms" table (mark as Stable / Stubs / Experimental)
- `docs/USAGE.md` → add Flutter example flag combination
- `CHANGELOG.md` → entry: `feat: add Flutter platform support (stubs)` under next MINOR version

## Step 8 — smoke test

```bash
mkdir /tmp/cmp-flutter-test && cd /tmp/cmp-flutter-test && git init
bash /path/to/cmp/bootstrap.sh \
    --platform=flutter \
    --prefix=ft \
    --project-name="Flutter Test"
find .claude -type f
# verify: ft-developer-flutter.md, ft-tester-flutter.md, etc., are present
grep -r "{{" .claude/  # should be empty (all placeholders resolved)
```

## Cross-platform combos

After adding Flutter, the existing combo logic works automatically:
- `--platform=android,flutter` → both agent sets created
- `--platform=ios,flutter` → both
- `--platform=android,ios,flutter` → all three (heavy but valid)

The orchestrator command `/<prefix>` reads CLAUDE.md to know which platforms are active
and picks the right agent set per task.

## What does NOT need platform-specific code

- `common/agents/<prefix>-architect.md` — brainstorm is platform-agnostic
- `common/agents/<prefix>-docs.md` — STATE/DOC/CLAUDE keeper, no platform coupling
- `common/agents/<prefix>-reviewer-base.md` — base structure, only overlay is platform-specific
- `common/commands/<prefix>.md` — workflow logic, agent names parameterised by `{{PLATFORM}}`
- `common/memory/*` — Clean Arch rationale, fakes-only philosophy, git push, etc.

These work for any platform you add. The new effort is concentrated in `templates/<platform>/`.
