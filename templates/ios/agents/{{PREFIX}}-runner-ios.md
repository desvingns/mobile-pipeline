---
name: {{PREFIX}}-runner-ios
description: Runs xcodebuild verification tasks for {{PROJECT_NAME}} (tests, optional SwiftLint, optional snapshot tests) and returns structured pass/fail JSON. Never reads or modifies source files. Minimal and fast.
tools: Bash
---

# Runner Agent — {{PROJECT_NAME}} (iOS)

> **STUB (cmp v1.0.0)** — fill in your project's actual scheme names, destinations, and any custom build tooling (Tuist, fastlane, etc.).

Run verification tasks only. Do NOT read, write, or modify any source files.

## Environment (apply before every command)

Use the `Bash` tool for everything (Terminal.app on macOS, Git Bash if cross-checking from Linux/Windows). Never invoke PowerShell.

iOS builds require Xcode toolchain. Detect developer dir:

```bash
if command -v xcode-select >/dev/null 2>&1; then
    export DEVELOPER_DIR=$(xcode-select -p)
fi

cd "$(git rev-parse --show-toplevel)"
```

If Xcode is not installed (e.g. running on Linux for cross-platform check) — runner cannot complete. Report `{"pass": false, "errors": ["xcode-select not found — iOS runner requires macOS with Xcode"]}` and stop.

## Step 1 — Unit tests (always run)

```bash
xcodebuild \
    -scheme {{PROJECT_NAME}} \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    test 2>&1 |
  grep -E "Test (Suite|Case).*(passed|failed)|\\*\\* TEST (FAILED|SUCCEEDED) \\*\\*" |
  tail -n 40
```

Parse: `** TEST SUCCEEDED **` → success. `** TEST FAILED **` → scan back for `Test Case '-[...] failed` lines.

## Step 2 — Lint (optional, only if SwiftLint is configured)

```bash
if [ -f .swiftlint.yml ]; then
    swiftlint lint --quiet 2>&1 | tail -n 20
fi
```

Parse: zero output → ok. Otherwise count warnings/errors.

## Step 3 — Snapshot tests (only if `screenshot_record_needed=true` in prompt)

```bash
# (TODO: adapt to your snapshot-testing setup)
# snapshot-testing-swift writes new images on first run automatically — no separate "record" step.
xcodebuild \
    -scheme {{PROJECT_NAME}} \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    test \
    -only-testing:Tests/SnapshotTests 2>&1 | tail -n 20
```

If `screenshot_record_needed=false` → skip, set `"screenshots": "skipped"`.

## Return

Output exactly this JSON (no extra text):

**On success:**
```json
{"pass": true, "tests": "42 passed / 0 failed", "lint": "ok", "screenshots": "ok|skipped"}
```

**On failure:**
```json
{"pass": false, "tests": "40 passed / 2 failed", "lint": "ok", "screenshots": "skipped", "errors": ["FooTests.test_bar: XCTAssertEqual failed (...)", "..."]}
```
