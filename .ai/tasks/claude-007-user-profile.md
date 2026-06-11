# claude-007 — Cross-project user profile memory

OWNER: claude
STATUS: **AUTHORED + 0-leak verified; NOT committed; not yet exercised in a live session.** (stage 2 of `docs/IMPROVEMENT-ROADMAP.md`)
PLAN: `C:\Users\k.shavrin\.claude\plans\generic-jumping-flame.md` (approved 2026-06-11)
ITEMS: B1, B2, B3, B4

## Why
Goal 1 says the system should "update memory across all my pet projects to understand me
better". Today ALL memory is per-project and technical (generic memos stamped by bootstrap;
project extras written by mp-knowledge). There is no place that records what the USER likes —
UI language, theme taste, density, question tolerance, naming preferences — so every new
project re-learns him from zero and grill recommendations ignore history (audit finding §B).

## Scope
- **B1** — define `~/.config/mobile-pipeline/user-profile.md` (same root as `projects.txt`):
  sectioned markdown (UI & design taste / process preferences / tech defaults / anti-patterns),
  append-mostly, each fact with a one-line provenance (`project, date, source`).
  `{{PREFIX}}-knowledge` gains a third routing target `user_preference` → writes/merges there.
- **B2** — `/mp` grill (Phase 1 in `templates/common/commands/{{PREFIX}}.md`): read the profile
  at startup; recommended answers cite it ("recommended: dark theme — you chose dark in 3/3
  projects"); never auto-decide, only bias recommendations.
- **B3** — `/mp-spec` greenfield grill + stage questions
  (`templates/spec/skills/app-spec-creator/SKILL.md`, `prompts/techniques/grill-me.md`,
  `prompts/questions/greenfield.stage*.md`): same profile read, prefill defaults.
- **B4** — taste journal: `--fit` outcomes and A4 feedback (claude-006) append liked/disliked
  visual facts to the profile (e.g. "rejected serif headers in MyMoney fit round 2").

## Files
- `templates/common/agents/{{PREFIX}}-knowledge.md` — `user_preference` category + merge rules.
- `templates/common/commands/{{PREFIX}}.md` — profile read in startup + grill bias note.
- `templates/spec/skills/app-spec-creator/SKILL.md` + `prompts/techniques/grill-me.md` — same.
- `templates/android/agents/{{PREFIX}}-fit-android.md` — emit taste facts in the FIT payload.
- New doc section in `docs/ARCHITECTURE.md` (memory model) describing the profile layer.

## Ownership / coordination
No codex-owned files. The profile path is harness-neutral (`~/.config/mobile-pipeline/`), so
Codex sessions can read/write the same file — note this in the change-log entry for codex.

## Verify
- Plugins regenerate, 0 leaks; `bash -n` n/a (no scripts) unless a helper script is added.
- Simulated lesson routing: a `user_preference` lesson lands in the profile with provenance;
  re-routing the same fact merges instead of duplicating.
- Grill dry-run shows a profile-biased recommended answer when the profile has a matching fact,
  and behaves identically to today when the profile is absent (clean-machine path).

## Checklist
- [x] B1 profile format + knowledge routing (USER-PREFERENCE category, skeleton with 4 sections
      + provenance, merge rules incl. contradiction handling, ≤80-line cap, `kind:"user_profile"`
      in the return contract; profile = the ONLY file knowledge may write outside the project)
- [x] B2 /mp grill reads profile (Startup step 3 + grill protocol point 3 cites profile facts in
      a parenthetical; bias-only, absence changes nothing; Rules bullet pins the contract)
- [x] B3 /mp-spec reads profile (grill-me.md v1.2.0 "user profile" rule — neutral, marker-free,
      applies to all grill modes; SKILL.md Stage-0 block extends it to the five stages' defaults)
- [x] B4 taste facts (fit FIT payload gains optional `taste_signals[]` from INTENDED deviations
      only; `--fit` Phase 4 taste journal behind one y/N gate; post-ship feedback note flags
      durable "always/never" statements as `user_preference` candidates in SESSION_RECAP)
- [x] docs (ARCHITECTURE.md "Cross-project user profile" subsection) + change-log entry
      (`2026-06-11T06:30-cross-project-user-profile`) + CHANGELOG [Unreleased] + plugins
      regenerated, 0 leaks
- [ ] exercise once live: a `user_preference` lesson lands in the profile with provenance; a
      grill shows a profile-biased recommendation; `--fit` taste gate fires on a clone
- [ ] not committed (awaiting user go-ahead)
