# Material Theme Builder — workflow reference

A free web tool from Google that generates a complete, M3-compliant color palette from one
or more seed colors. Output drops directly into Compose. No Figma account needed.

URL: <https://m3.material.io/theme-builder>

## When to use it

- First-time project setup → need a baseline palette.
- New brand color → regenerate light + dark schemes that satisfy WCAG contrast.
- Adding a tertiary/error accent that needs to feel coherent with the existing primary.

**NOT for clones:** when `.claude/mp/design-tokens.json` exists (copied from the spec bundle's
`spec/design-tokens.json`), the ui-designer generates `Color.kt`/`Type.kt` from the reference
app's exact tokens directly — Theme Builder would replace ground truth with a derived guess.

## Workflow (3 minutes)

1. **Open the tool**, switch to **Custom** in the left panel.
2. **Pick a seed** — paste a hex (`#6750A4`) or upload a logo (the tool extracts dominant colors).
   - The seed becomes the `primary` role. Other roles (secondary, tertiary, surface, etc.) are derived algorithmically.
3. **Adjust if needed** — click any role swatch to override; the tool re-balances contrast around your override.
4. **Export → Jetpack Compose** (top-right) → downloads a zip. The file you need is `theme/Color.kt`.
5. **Drop into `ui/theme/Color.kt`** — replace the existing `lightColorScheme()` / `darkColorScheme()` blocks. Keep file headers and imports as the tool exports them.
6. **Re-record Roborazzi baselines** (theme change is a visual change): `./gradlew :app:recordRoborazziDebug`.

## What the exported `Color.kt` looks like

```kotlin
package {{PACKAGE}}.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

private val Primary = Color(0xFF6750A4)
private val OnPrimary = Color(0xFFFFFFFF)
private val PrimaryContainer = Color(0xFFEADDFF)
private val OnPrimaryContainer = Color(0xFF21005D)
// … secondary, tertiary, error, surface, surfaceVariant, outline, etc.

val LightColorScheme = lightColorScheme(
    primary = Primary,
    onPrimary = OnPrimary,
    primaryContainer = PrimaryContainer,
    onPrimaryContainer = OnPrimaryContainer,
    // …
)

val DarkColorScheme = darkColorScheme(
    primary = PrimaryDark,
    // …
)
```

The tool exports ~30 color roles per scheme. Don't trim them — M3 components expect the
full set; missing roles fall back to defaults that may break dark mode.

## Roles you should actually use in code

Most common, ranked by frequency:

| Role | Use for |
|------|---------|
| `primary` / `onPrimary` | FAB, primary button, active state |
| `surface` / `onSurface` | Card / list background, main text |
| `surfaceVariant` / `onSurfaceVariant` | Subtle backgrounds, secondary text |
| `surfaceContainer` (M3 expressive) | Elevated cards on M3 expressive baseline |
| `outline` | Borders, dividers |
| `error` / `onError` | Validation errors, destructive actions |
| `secondary` / `tertiary` | Accents — use sparingly, primary should dominate |

Avoid: bespoke colors via `Color(0x…)` in screen code. If a screen needs a color that
isn't in the scheme, that's a token-design problem — request `{{PREFIX}}-ui-designer-android` adds it
to `Color.kt`, then reference via `MaterialTheme.colorScheme.X`.

## Dynamic Color (Android 12+)

Theme Builder colors are the **fallback** scheme. On Android 12+ devices, `Theme.kt` should
prefer `dynamicLightColorScheme(context)` / `dynamicDarkColorScheme(context)` (derived from
the user's wallpaper). Theme Builder output kicks in on older Android, on previews, and
when the user disables dynamic color.

## When NOT to use Theme Builder

- Updating a single role mid-development → edit `Color.kt` directly. Theme Builder is for
  full-palette regeneration, not micro-adjustments.
- Animating colors → use `animateColorAsState(MaterialTheme.colorScheme.X)`; Theme Builder
  is design-time only.
