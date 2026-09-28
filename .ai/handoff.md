# Handoff

Last session: Claude · 2026-09-28 · showcase phone/tablet adaptation.

## DONE

- Adapted `showcase/` for phones (portrait + landscape) and tablets: square phone compositions for the sticky
  scenes (chertyozh/sborka/proverki), «stage band» sticky layout, short-landscape band (`pointer: coarse`),
  touch-tablet sizing, iOS fixes (toolbar resize, safe-area, sticky hover, Схема search zoom/tap), rotation keeps
  place and state, GSAP matchMedia `all`-key re-init bug, loop leak on rebuild. Details: showcase/docs/design-prosto.md
  «Responsive bands».
- Synced facts: version 1.18.1, releases 27. Added apple-touch-icon + og meta.

## VERIFIED

- Playwright sweeps (Chromium + WebKit) at 14 viewports; desktop pixel-identical to pristine except tap targets and facts.
- tools/check.cjs PASS; validate-blueprint PASS. Not verified on a real iPhone/iPad (keyboard in Схема search, Reduce Motion).

## DECISIONS

- Keep the 760px phone breakpoint (iPad mini portrait gets enlarged phone layouts).
- Browser probes must run muted (film autoplay).

## NEXT

- Check on a real iPhone/iPad; fix anything device-specific.

## OWNER

Codex.

## BLOCKERS

None.
