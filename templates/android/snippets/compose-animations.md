# Compose Animation API — common patterns

Animations are what separates a "functional" UI from a "polished" one. Compose ships a
rich animation API; the trick is knowing which tool fits which problem.

All durations / easings below come from `LocalMotion.current` (defined in `ui/theme/Motion.kt`):

| Token | Value | Use for |
|-------|-------|---------|
| `durationShort`  | 200ms | Micro-interactions (toggle, ripple feedback) |
| `durationMedium` | 300ms | Standard enter/exit, content swap |
| `durationLong`   | 500ms | Emphasized transition (hero/cross-fade) |
| `easeStandard`   | `FastOutSlowInEasing` | Default; nearly all transitions |
| `easeEmphasized` | M3 emphasized curve | "Look at me" moments (FAB transform, hero) |

**Never exceed 500ms for UI transitions** — sluggish animations actively hurt perceived
performance. Page transitions are the exception (handled by Navigation Compose).

## Pattern 1 — Show/hide a section

Use `AnimatedVisibility` for anything that appears/disappears from the layout.

```kotlin
val motion = LocalMotion.current
AnimatedVisibility(
    visible = state.hasError,
    enter = fadeIn(animationSpec = tween(motion.durationShort, easing = motion.easeStandard)) +
            expandVertically(animationSpec = tween(motion.durationMedium)),
    exit = fadeOut(animationSpec = tween(motion.durationShort)) +
           shrinkVertically(animationSpec = tween(motion.durationShort)),
) {
    ErrorBanner(state.error)
}
```

Common mistake: nesting an `AnimatedVisibility` inside a parent that itself uses
`animateContentSize` — pick one. Use `AnimatedVisibility` for the appearance, and let it
own the size animation.

## Pattern 2 — Resize a container as its content grows

Use `Modifier.animateContentSize()` on the parent. Compose handles the rest.

```kotlin
Card(
    modifier = Modifier
        .fillMaxWidth()
        .animateContentSize(animationSpec = tween(motion.durationMedium, easing = motion.easeStandard)),
) {
    Column {
        Text(state.summary)
        if (state.expanded) {
            Spacer(Modifier.height(spacing.s))
            Text(state.details, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
```

One line, zero state. Best ROI animation in Compose.

## Pattern 3 — Swap content (e.g. tabs, loading → loaded)

Use `Crossfade` for simple swaps, `AnimatedContent` when you need direction-aware
transitions or size animation between states.

```kotlin
// Simple — fades between two states
Crossfade(
    targetState = state.screenState,
    animationSpec = tween(motion.durationMedium),
    label = "screen state",
) { current ->
    when (current) {
        is Loading -> LoadingContent()
        is Loaded  -> LoadedContent(current.data)
        is Empty   -> EmptyContent()
    }
}
```

```kotlin
// Direction-aware — content slides in based on tab index
AnimatedContent(
    targetState = selectedTab,
    transitionSpec = {
        if (targetState.ordinal > initialState.ordinal) {
            slideInHorizontally { it } togetherWith slideOutHorizontally { -it }
        } else {
            slideInHorizontally { -it } togetherWith slideOutHorizontally { it }
        } using SizeTransform(clip = false)
    },
    label = "tab content",
) { tab ->
    TabContent(tab)
}
```

## Pattern 4 — Animate a single value (color, size, alpha)

`animate*AsState` family.

```kotlin
val borderColor by animateColorAsState(
    targetValue = if (state.selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline,
    animationSpec = tween(motion.durationShort),
    label = "border color",
)
Box(modifier = Modifier.border(2.dp, borderColor, MaterialTheme.shapes.medium)) { … }
```

Variants: `animateFloatAsState`, `animateDpAsState`, `animateIntAsState`.

## Pattern 5 — Shared element transition (Compose 1.7+)

Use for "open detail from list" flows where one element visually transforms.

```kotlin
// Requires SharedTransitionLayout as ancestor of both source and destination composables
SharedTransitionLayout {
    NavHost(navController, startDestination = "list") {
        composable("list") {
            ListScreen(onItemClick = { id ->
                navController.navigate("detail/$id")
            }, animatedVisibilityScope = this@composable)
        }
        composable("detail/{id}") { backStackEntry ->
            DetailScreen(
                id = backStackEntry.arguments?.getString("id").orEmpty(),
                animatedVisibilityScope = this@composable,
            )
        }
    }
}

// inside both composables, on the shared element:
Modifier.sharedElement(
    rememberSharedContentState(key = "item-$id"),
    animatedVisibilityScope = animatedVisibilityScope,
    boundsTransform = { _, _ -> tween(motion.durationLong, easing = motion.easeEmphasized) },
)
```

Compose BOM check: shared elements require Compose UI 1.7.0+. If CLAUDE.md pins an older
BOM, this pattern is unavailable — use a regular page transition instead.

## Pattern 6 — Infinite animation (loading shimmer, pulse)

`rememberInfiniteTransition` + `animateFloat`.

```kotlin
val transition = rememberInfiniteTransition(label = "shimmer")
val alpha by transition.animateFloat(
    initialValue = 0.3f,
    targetValue = 1f,
    animationSpec = infiniteRepeatable(
        animation = tween(durationMillis = 1000, easing = motion.easeStandard),
        repeatMode = RepeatMode.Reverse,
    ),
    label = "shimmer alpha",
)
Box(modifier = Modifier.alpha(alpha).background(MaterialTheme.colorScheme.surfaceVariant))
```

Stop infinite animations when the composable leaves composition — `rememberInfiniteTransition`
handles this automatically.

## Anti-patterns

- **Custom `Animatable` for simple cases.** If `animate*AsState` works, use it. `Animatable`
  is for gesture-driven animations and interrupt logic.
- **Animation longer than 500ms for non-navigation transitions.** Slow = laggy, not premium.
- **Multiple competing animations on the same element.** Pick one driver — Compose can't
  reconcile two animation specs on the same property gracefully.
- **Hardcoded `tween(300)`.** Use `LocalMotion.current.durationMedium` — same value, but
  changes propagate when the design system evolves.
