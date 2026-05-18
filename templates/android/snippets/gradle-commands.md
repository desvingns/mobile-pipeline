# Gradle Commands — quick reference

Common Gradle tasks used by `{{PREFIX}}-runner-android` and by manual development. All
commands run from the project root.

## Build & code generation

```bash
# KSP code generation (run after changing Room / Hilt annotations)
./gradlew :app:kspDebugKotlin

# Full debug build (compile + resource processing + APK assembly)
./gradlew :app:assembleDebug

# Faster: only compile main source (no APK packaging)
./gradlew :app:compileDebugKotlin
```

## Tests

```bash
# All unit tests (JVM-based, includes Robolectric DAO / Compose-UI tests)
./gradlew :app:testDebugUnitTest

# Specific test class
./gradlew :app:testDebugUnitTest --tests "com.example.foo.FooViewModelTest"

# Wildcard
./gradlew :app:testDebugUnitTest --tests "*ViewModelTest"

# Instrumented tests (require connected device or emulator — runner skips these)
./gradlew :app:connectedDebugAndroidTest
```

## Static analysis

```bash
# Detekt
./gradlew :app:detekt

# Lint (Android Lint, optional — runner doesn't run it by default)
./gradlew :app:lintDebug
```

## Screenshot tests (Roborazzi)

```bash
# Record new baselines (must run before first verify)
./gradlew :app:recordRoborazziDebug

# Verify against committed baselines (run by runner when screenshot_record_needed=true)
./gradlew :app:verifyRoborazziDebug

# Combined: record then verify
./gradlew :app:recordRoborazziDebug :app:verifyRoborazziDebug
```

Snapshots live in `app/src/test/snapshots/` (committed to git).

## Cleanup

```bash
# Stop Gradle daemon (useful if it gets stuck)
./gradlew --stop

# Clean build outputs
./gradlew :app:clean
```

## Useful flags

| Flag | When |
|------|------|
| `--no-daemon` | CI / one-off agent runs. Slightly slower but isolates from daemon state. |
| `--info` | Verbose output for debugging failures (large output, use sparingly). |
| `--rerun-tasks` | Force re-run even if Gradle thinks output is up-to-date. |
| `--offline` | Force Gradle to use local cache only — useful when remote is slow / down. |
