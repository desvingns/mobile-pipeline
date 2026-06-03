#!/usr/bin/env bash
# _crawl-lib.sh — shared helpers for the reference-APK crawl device primitives.
# SOURCED, never executed. Defines: adb resolution, JSON escaping, a one-line error emitter,
# and a thin adb wrapper. Cross-platform (Linux / macOS / Windows Git Bash). No jq dependency.
#
# Contract every crawl script follows (mirrors templates/android/scripts conventions):
#   - shebang #!/usr/bin/env bash, `set -uo pipefail`
#   - exactly ONE JSON object printed on stdout (success OR error); all adb/tool noise -> temp files
#   - device targeting via the adb-native $ANDROID_SERIAL env var (set by the orchestrator after
#     device-preflight.sh), so scripts never hard-code a serial and stay path-neutral.
#
# shellcheck shell=bash
# shellcheck disable=SC2034  # vars are consumed by the sourcing script

# ----- adb resolution: $ADB override -> PATH -> common SDK locations ---------------------------
_resolve_adb() {
  if [ -n "${ADB:-}" ] && { [ -x "$ADB" ] || command -v "$ADB" >/dev/null 2>&1; }; then
    printf '%s' "$ADB"; return 0
  fi
  if command -v adb >/dev/null 2>&1; then command -v adb; return 0; fi
  local c
  for c in \
    "${LOCALAPPDATA:-}/Android/Sdk/platform-tools/adb.exe" \
    "${ANDROID_HOME:-}/platform-tools/adb" \
    "${ANDROID_SDK_ROOT:-}/platform-tools/adb" \
    "$HOME/Android/Sdk/platform-tools/adb" \
    "$HOME/Library/Android/sdk/platform-tools/adb" \
    "/c/Program Files/Android/Android Studio/platform-tools/adb.exe"; do
    [ -n "$c" ] && [ -x "$c" ] && { printf '%s' "$c"; return 0; }
  done
  return 1
}

# ----- JSON string escaping (no jq) ------------------------------------------------------------
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

# ----- die "<message>": emit one JSON error line and exit 0 (the JSON line IS the contract) -----
die() {
  printf '{"ok":false,"error":"%s"}\n' "$(json_escape "$1")"
  exit 0
}

# ----- adb wrapper: relies on adb-native $ANDROID_SERIAL when set -------------------------------
# (Avoids an empty-array-under-`set -u` portability trap on bash 3.2 by leaning on the env var,
#  which adb honors natively, instead of passing -s ourselves.)
adbx() { "$ADB_BIN" "$@"; }
