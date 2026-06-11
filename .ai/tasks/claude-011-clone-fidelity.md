# claude-011 — Clone design fidelity: exact metrics, pixel diff, assets, generated theme

OWNER: claude
STATUS: **AUTHORED + 0-leak verified (both scripts fixture-tested); NOT committed; not yet exercised on a real clone.** (stage 6 of `docs/IMPROVEMENT-ROADMAP.md`)
PLAN: `C:\Users\k.shavrin\.claude\plans\generic-jumping-flame.md` (approved 2026-06-11)
ITEMS: D1, D2, D3, D4, D5, D9 · User approved ImageMagick/SSIM + apktool/aapt2.

## Why
The last clone "didn't look like the original". The audit found fidelity degrades at every
step: style tokens are LLM eyeball guesses (fonts "Roboto (guess)", sizes ±2 sp, radii/
elevation in buckets), the exact pixel bounds in crawl ui-dumps are unused, APK assets are
inventoried but never extracted, the `03_style.md` → `ui/theme/` bridge is a manual Material
Theme Builder step, and `--fit` is a free-form multimodal judgment with no objective number and
no normalized capture environment. This task makes the visual pipeline measurement-driven.

## Scope
- **D1** — `bounds-to-dp.sh`: from a screen's ui-dump + device density (preflight reports it),
  compute exact margins/paddings/sizes per element → feed `fit-checklist-author` so checklists
  say "16 dp gap title↔card" instead of "density: normal". Reuses C1 manifests when present.
- **D2** — `pixel-diff.sh` in `--fit`: ImageMagick `compare` (RMSE/SSIM if available, graceful
  degrade with a clear `tool_missing` JSON when ImageMagick absent) per (screen, state) →
  objective score + diff heatmap PNG under `build/fit/`; multimodal pass keeps semantic
  judgment; combined score feeds the E1 threshold (claude-008).
- **D3** — capture normalization: document + script a pinned AVD profile; both crawl capture
  and `--fit` capture enable demo mode (`adb shell settings put global sysui_demo_allowed 1` +
  `am broadcast -a com.android.systemui.demo …`: fixed clock/battery/wifi), fixed font scale,
  locale, gesture-nav — so pixel diffs measure the app, not the chrome.
- **D4** — asset extraction in `apk-analyzer` (optional step, tool-gated): apktool/aapt2 →
  `spec/assets/{drawable,font,raw}/` + an extraction manifest; legal caveat in CLONE-PLAYBOOK
  (private/educational reuse only). **D7 rides along**: extracted fonts give typography the
  exact family.
- **D5** — theme generation: replace the manual Material Theme Builder seam — a generator
  (script or designer-agent step) converts the `03_style.md`/APK token JSON into
  `Color.kt`/`Type.kt` bodies the `{{PREFIX}}-ui-designer-android` writes verbatim;
  Theme Builder remains documented as fallback for greenfield.
- **D9** — `--fit` walks `spec/fit/<Sxx>.md` row-by-row: every must-match line gets an explicit
  pass/fail/uncheckable verdict in the payload (today the checklist exists but comparison is
  free-form).

## Files
- `templates/spec/skills/app-spec-creator/scripts/crawl/` (or a new `scripts/fit/`) — D1, D2, D3 scripts.
- `templates/android/agents/{{PREFIX}}-fit-android.md` — D2 score merge, D3 capture, D9 row verdicts.
- `templates/spec/agents/apk-analyzer.md` — D4 extraction step.
- `templates/spec/agents/fit-checklist-author.md` — D1 exact-dp rows.
- `templates/android/agents/{{PREFIX}}-ui-designer-android.md` + `templates/android/snippets/material-theme-builder.md` — D5.
- `docs/CLONE-PLAYBOOK.md` — normalized-capture setup + legal caveat.

## Ownership / coordination
No codex-owned files. New external tools (ImageMagick, apktool/aapt2) are OPTIONAL
dependencies: every script must degrade to a single informative JSON line when the tool is
missing (mirror adb-resolve pattern in `_crawl-lib.sh`).

## Verify
- `bash -n` + shellcheck on new scripts; tool-missing path returns valid JSON.
- Fixture pair (two PNGs, known divergence) → pixel-diff score + heatmap emitted; identical
  pair scores ~100.
- bounds-to-dp on a Phase-1 ui-dump fixture reproduces hand-measured dp within ±1.
- Token JSON → generated Color.kt compiles in a sandbox project; matches APK colors.xml.
- Plugins regenerated 0 leaks.

## Checklist
- [x] D1 `bounds-to-dp.sh` (dp = px·160/density, in-place tmp+mv rewrite, fixture-verified
      880px@420dpi→335dp) + SKILL finalize wiring (density from `crawl.device.density` /
      `adb shell wm density`) + fit-checklist-author quotes exact dp in must-match rows
- [x] D2 `{{PREFIX}}-pixel-diff.sh` (IM7/IM6 autodetect, normalized RMSE→similarity, heatmap,
      auto-resize to reference dims, `tool_missing` graceful) + `--fit` Phase 2.5 pixel pass +
      fit agent anchors `fit_score` to the similarity (justify >15 pt; lenient on `resized`)
- [x] D3 normalized capture: demo-mode + `font_scale 1.0` blocks in SKILL A.0 (crawl side) and
      `--fit` Phase 2 (build side); AVD profile/density recorded in `00_meta.yaml`; mismatch →
      explicit warning
- [x] D4+D7 apk-analyzer Pass 7.5: fonts (always) + launcher icon + notable rasters →
      `spec/assets/` + extraction-manifest.md with the personal-use legal caveat;
      `assets_extracted_count`/`fonts_extracted[]` in JSON
- [x] D5 theme from ground truth: Phase D writes `spec/design-tokens.json` (style JSON + APK
      overrides + provenance); handoff copies it to `.claude/mp/design-tokens.json`;
      ui-designer 3-tier token resolution generates Color.kt/Type.kt directly (Theme Builder =
      greenfield fallback only; snippet updated)
- [x] D9 per-row checklist verdicts (`checklist_rows[]` per screen, fail rows must map to
      divergences; report prints pixel avg + row pass counts)
- [x] docs (CLONE-PLAYBOOK "Fidelity instrumentation") + change-log entry
      (`2026-06-11T10:30-clone-fidelity-instrumentation`) + CHANGELOG [Unreleased] + plugins
      regenerated 0 leaks (pixel-diff ships in mp-dev, bounds-to-dp in mp-spec)
- [ ] exercise on a real clone (after C10): pixel scores correlate with eyeball verdicts;
      generated Color.kt compiles and matches APK colors; demo-mode capture parity holds
- [ ] not committed (awaiting user go-ahead)
