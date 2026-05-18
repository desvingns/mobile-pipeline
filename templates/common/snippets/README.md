# `templates/common/snippets/` — shared fragments for platform-specific agents

**v1.0.0: empty.** Reserved for future use when GREEN/RED-phase descriptions, test-rules,
manual-checklist generation prompt, and runner JSON shape grow large enough to justify
extracting from platform agents.

## Why empty now

The original cmp plan called for 4 shared snippets here:
- `green-phase-mode.md`
- `test-rules.md`
- `manual-checklist-prompt.md`
- `runner-json-shape.md`

In v1.0.0 these concepts are short enough (10-15 lines each) that **duplicating** them
across `templates/android/agents/` and `templates/ios/agents/` is simpler than building
a concat mechanism in `bootstrap.sh`. Duplication cost: ~60 lines repeated across 2
platforms. Bootstrap complexity cost: ~50 lines of include/concat logic + edge cases.

When a third platform lands (Flutter, RN), or when the shared concepts grow past
~25 lines, revisit this choice — at that point, extraction pays off.

## How extraction would work (when added)

If snippets are populated:

1. Bootstrap reads platform agent template (e.g. `templates/android/agents/{{PREFIX}}-developer-android.md`).
2. Looks for `<!-- INCLUDE common/snippets/<name>.md -->` markers.
3. For each marker, splices in the corresponding file's content.
4. Writes result to `.claude/agents/{{PREFIX}}-developer-android.md` in the target project.

The include mechanism is similar to how `common/agents/{{PREFIX}}-reviewer-base.md` is
concat'ed with `templates/android/agents/{{PREFIX}}-reviewer-android.md` overlay
in `bootstrap.sh` (`render_phase` → CONCAT case).

## See also

- `docs/CUSTOMIZATION.md` — option 2 (fork) vs option 3 (upstream conditional sections)
- `templates/android/snippets/` — Android-specific bash/markdown fragments (jbr-detect, gradle-commands) that are referenced from `CLAUDE.md.tmpl` and agents
