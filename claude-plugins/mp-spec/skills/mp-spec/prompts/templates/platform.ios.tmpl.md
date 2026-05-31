---
id: templates/platform.ios
version: 1.0.0
inputs: [design.md, feature_inventory, platform.android.md]
outputs: [platform/ios.md]
model: sonnet
owner_agent: design-aggregator
tags: [platform, ios, swiftui]
platform: ios
---

# iOS platform appendix (populated-stub)

This is the iOS sibling of `platform.android.tmpl.md`. It exists from day one so the bundle's directory shape is stable, but ships as a **populated stub** until iOS is in scope.

## How it gets populated later (the iOS drop-in route)
When the project adds iOS (`/app-spec-creator … --platforms android,ios`, or a later `design-aggregator --platform ios` pass), this file is generated from the **same frozen platform-neutral bundle** (requirements, user-stories, acceptance/*.feature, design.md body, nfr/a11y/security/analytics/i18n) — **no neutral artifact is touched**. Then the iOS agent set drops in from `CMP/templates/ios/agents/*` per `CMP/docs/ADDING-PLATFORM.md`. This is the whole point of the neutral-body / platform-fenced split.

## Body (wrap everything below in the iOS fence)
```markdown
<!-- platform:ios -->
# Platform appendix — iOS (SwiftUI)

> Status: (deferred). Generated from the neutral bundle when iOS enters scope.

## Design system (SwiftUI)
- Color tokens → `Color` asset catalog / `ShapeStyle` (map from the neutral palette table in design.md)
- Typography → `Font` scale (map from the neutral type scale)
- Spacing / corner radius → constants
- Components → SwiftUI `View` signatures mirroring the neutral component list

## Data model (iOS realization)
- Neutral entities → Core Data / SwiftData / GRDB types (decide per constitution)
- Neutral types map: String→String, Decimal→Decimal, Instant→Date, UUID→UUID, Ref<X>→relationship

## Screen realization
- Neutral State/Event/Action → `ObservableObject` ViewModel + `ViewState` struct per screen

## Technical requirements (iOS)
- Deployment target, capabilities/entitlements (map each neutral permission/capability)
- App size target (from nfr.md, same threshold)

## Integrations (iOS)
- SDKs via SPM (map from the neutral integrations list)

## Testing (iOS)
- XCTest · ViewInspector (SwiftUI unit) · snapshot-testing (screenshot) — fakes only, mirroring the neutral test types in acceptance/*.feature
<!-- /platform:ios -->
```

## Notes
- Until populated, write the body above verbatim (with `(deferred)`), so `00_manifest.yaml artifacts.platform_ios.status: stub`.
- The Gherkin in `acceptance/*.feature` is toolkit-agnostic, so it drives both `cmp-tester-android` and a future `cmp-tester-ios` unchanged.
