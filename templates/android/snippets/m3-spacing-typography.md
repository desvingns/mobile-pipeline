# Material 3 — Spacing & Typography reference

The single most common cause of an Android app looking "amateur": inconsistent spacing
and typography. Both are solved by **disciplined use of a finite scale**.

## Spacing scale

M3 itself does **not** ship a spacing scale — you define one. The standard 4dp grid:

| Token | Value | Use for |
|-------|-------|---------|
| `xxs` | **2.dp** | Hairline gaps inside chips, dense list bullets |
| `xs`  | **4.dp** | Tight pairs (icon + label inline) |
| `s`   | **8.dp** | Default chip/button content padding, inter-item gap in compact lists |
| `m`   | **16.dp** | Standard screen edge padding, card content padding, inter-section gap |
| `l`   | **24.dp** | Major section gap, dialog padding |
| `xl`  | **32.dp** | Top-of-screen breathing room, large empty-state padding |
| `xxl` | **48.dp** | Hero spacing, full-bleed section dividers |

Exposed via `LocalSpacing.current.X` (a custom `CompositionLocal` provided by `Theme.kt`):

```kotlin
@Composable
fun InboxItem(item: Inbox) {
    val spacing = LocalSpacing.current
    Row(
        modifier = Modifier.padding(horizontal = spacing.m, vertical = spacing.s),
        horizontalArrangement = Arrangement.spacedBy(spacing.s),
    ) { … }
}
```

**Rule of thumb:** if you reach for `13.dp` or `17.dp` or `22.dp`, you're guessing. Pick
the nearest scale value or, if the design truly needs a new step, ask
`{{PREFIX}}-ui-designer-android` to add one (e.g. `xs2 = 6.dp`) — keep it in `Spacing.kt`.

**Allowlist for raw `.dp`:** `0.dp` (no padding), `1.dp` (divider hairline) — these are
fine inline.

## Typography — Material 3 type scale

M3 ships 15 type roles. Use them by **semantic intent**, not visual size.

| Role | Default size | Use for |
|------|----|---------|
| `displayLarge`  | 57sp | Onboarding hero, numeric KPIs |
| `displayMedium` | 45sp | Marketing-style headlines |
| `displaySmall`  | 36sp | Section landings |
| `headlineLarge` | 32sp | Modal sheet titles |
| `headlineMedium`| 28sp | Empty-state titles |
| `headlineSmall` | 24sp | Card section headers |
| `titleLarge`    | 22sp | Top app bar title |
| `titleMedium`   | 16sp | List item primary text (medium weight) |
| `titleSmall`    | 14sp | Dense list primary text |
| `bodyLarge`     | 16sp | Main reading text, dialog body |
| `bodyMedium`    | 14sp | Secondary text, list item subtitle |
| `bodySmall`     | 12sp | Captions, helper text |
| `labelLarge`    | 14sp | Button text |
| `labelMedium`   | 12sp | Chip text, small action |
| `labelSmall`    | 11sp | Tag, badge, dense overline |

Use via `MaterialTheme.typography.X`:

```kotlin
Text("Inbox", style = MaterialTheme.typography.titleLarge)
Text(item.preview, style = MaterialTheme.typography.bodyMedium)
```

**Rule of thumb:** `fontSize = 14.sp` in a screen file is a smell. The role you want
already exists.

## Font family

Default: M3 system font (`SansSerif` → Roboto on Android). To use a Google Font:

```kotlin
// in Type.kt
val InterFontProvider = GoogleFont.Provider(
    providerAuthority = "com.google.android.gms.fonts",
    providerPackage = "com.google.android.gms",
    certificates = R.array.com_google_android_gms_fonts_certs,
)
val Inter = FontFamily(
    Font(GoogleFont("Inter"), InterFontProvider, FontWeight.Normal),
    Font(GoogleFont("Inter"), InterFontProvider, FontWeight.Medium),
    Font(GoogleFont("Inter"), InterFontProvider, FontWeight.SemiBold),
)
```

Dependency: `androidx.compose.ui:ui-text-google-fonts`.

Then in your `Typography()`: set `fontFamily = Inter` on each role. The sizes from the M3
scale carry over — you only swap the family.

## Anti-patterns reviewer catches

- `fontSize = 14.sp` outside `ui/theme/` → use `style = MaterialTheme.typography.X`
- `Color(0xFF…)` outside `ui/theme/Color.kt` → use `MaterialTheme.colorScheme.X`
- `padding(13.dp)` → use `LocalSpacing.current.X` (Check 5 in reviewer)
