# CUSTOMIZATION — adapting cmp to your stack

cmp ships with assumptions baked into agents:

| Layer | Android assumption | iOS assumption |
|---|---|---|
| UI | Compose + Material3 | SwiftUI (stub) |
| DI | Hilt | TBD (stub) |
| DB | Room | Core Data (stub) |
| Tests | JUnit + Robolectric + Roborazzi + Turbine | XCTest + ViewInspector (stub) |
| Architecture | Clean Architecture (domain/data/presentation), Fakes only | Clean Architecture, Fakes only |

If your stack differs, you have three options.

## Option 1 — Edit your generated `.claude/` after bootstrap (per-project)

Quickest. Best when only one project deviates.

```bash
# After bootstrap
$ vim .claude/agents/ft-developer-android.md
# replace "Hilt 2.55" with "Koin 4.0", change `@HiltViewModel` to `class FooViewModel : ViewModel(), KoinComponent`
```

Trade-off: divergence from cmp templates. When cmp updates land, you'll merge by hand.
Document the deviation in `STATE.md` → Known tech debt so future-you remembers.

## Option 2 — Fork cmp (per-team / per-stack)

If you have a clear stack preference (e.g. "all my projects use Koin, never Hilt"), fork
cmp and modify `templates/android/agents/{{PREFIX}}-developer-android.md` once. Your fork
becomes the canonical template for your projects.

```bash
git clone https://github.com/yourname/claude-mobile-pipeline.git
cd claude-mobile-pipeline
# Edit templates/android/agents/{{PREFIX}}-developer-android.md
# Edit templates/android/memory/*.md.tmpl
# Bump VERSION → 1.1.0-koin
git commit -am "feat: switch Android default DI from Hilt to Koin"
```

Use your fork's `bootstrap.sh` from then on.

## Option 3 — Conditional sections in cmp (contribute upstream)

If your stack is a common alternative (Koin, RxJava, MVVM-not-Clean, ...), add a
conditional section to upstream cmp:

```markdown
<!-- if DI == hilt -->
ViewModel registration uses `@HiltViewModel` annotation...
<!-- /if -->
<!-- if DI == koin -->
ViewModel registration uses Koin module: `viewModel { FooViewModel(get()) }`...
<!-- /if -->
```

The `<!-- if ... -->` and `<!-- /if -->` markers **must each sit on their own
line**. Inline form (`text <!-- if X --> more <!-- /if --> tail`) silently eats
everything down to the next `<!-- /if -->` in the file — the underlying `sed`
range addressing has no way to stop at the same line. Same rule for
`<!-- platform:X -->` blocks.

Then add `--di=hilt|koin` flag to `bootstrap.sh`. `lib/render.sh` already has
`strip_if_block` — wire a new placeholder.

This is the right path if you want to upstream the change. Otherwise stick with Option 2.

## What stays in cmp regardless

Some structural assumptions are not negotiable in cmp because they define what cmp _is_:

- **Clean Architecture** — `dh-reviewer` checks domain/data/presentation boundaries. If
  your project uses a different architecture (e.g. flat MVVM), the reviewer agent makes
  no sense as-is. Either rewrite reviewer for your architecture or drop it.
- **Fakes-only testing** — `dh-tester` refuses mocks. If you prefer MockK / Mockito,
  rewrite `dh-tester` rules.
- **Verification gate before push** — `dh-verifier` blocks `git push` until you confirm
  manual checklist. If you want autopush, remove the gate from `dh.md` Step 4.5.
- **STATE.md / ROADMAP.md / DOCUMENTATION.md trinity** — three different files with
  different cadence. If you prefer a single doc file, merge in your fork and update `dh-docs`.

If you find yourself rewriting more than half of cmp, cmp is not the right base — you
likely want to start from scratch with cmp as inspiration.

## Memory customisation

Memory files in `~/.claude/projects/<sanitised>/memory/` are **yours**. Edit, add, delete
as you go. Bootstrap only seeds initial 8-10 files; subsequent learnings get added via
the `/remember` skill or by you directly.

Update `MEMORY.md` index after any change — it's a flat list, ≤200 lines.
