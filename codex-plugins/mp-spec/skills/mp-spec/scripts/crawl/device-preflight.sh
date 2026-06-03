#!/usr/bin/env bash
# device-preflight.sh — confirm exactly one booted Android device/emulator and report its geometry.
# Mirrors the dev pipeline's pre-flight gate, but standalone (the global spec tool has no project
# device memo). Emits ONE JSON line; the orchestrator exports the returned serial as $ANDROID_SERIAL
# for every later crawl call.
#
# Usage: device-preflight.sh [--serial <serial>]
# Output (ok):  {"ok":true,"serial":"emulator-5554","w":1080,"h":2400,"density":420,"android":"34"}
# Output (err): {"ok":false,"error":"no booted device (adb devices empty)"}
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_crawl-lib.sh
. "$SCRIPT_DIR/_crawl-lib.sh"

WANT_SERIAL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --serial=*) WANT_SERIAL="${1#*=}" ;;
    --serial)   WANT_SERIAL="${2:-}"; shift ;;
    *) ;;
  esac
  shift
done

ADB_BIN="$(_resolve_adb)" || die "adb not found (set \$ADB or add platform-tools to PATH)"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

adbx start-server >/dev/null 2>&1

# Collect serials in state "device" (skip header / offline / unauthorized).
adbx devices >"$TMP/devices.txt" 2>/dev/null
SERIALS=()
while IFS= read -r line; do
  case "$line" in
    "List of devices"*|"") continue ;;
  esac
  s="$(printf '%s' "$line" | awk '{print $1}')"
  st="$(printf '%s' "$line" | awk '{print $2}')"
  [ "$st" = "device" ] && [ -n "$s" ] && SERIALS+=("$s")
done <"$TMP/devices.txt"

[ "${#SERIALS[@]}" -eq 0 ] && die "no booted device (adb devices lists none in state 'device')"

SERIAL=""
if [ -n "$WANT_SERIAL" ]; then
  for s in "${SERIALS[@]}"; do [ "$s" = "$WANT_SERIAL" ] && SERIAL="$s"; done
  [ -z "$SERIAL" ] && die "requested serial '$WANT_SERIAL' not connected"
else
  SERIAL="${SERIALS[0]}"
fi
export ANDROID_SERIAL="$SERIAL"

# boot_completed guards against a half-booted emulator.
BOOTED="$(adbx shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n ' )"
[ "$BOOTED" = "1" ] || die "device '$SERIAL' present but not finished booting (sys.boot_completed != 1)"

SIZE="$(adbx shell wm size 2>/dev/null | tr -d '\r' | grep -oE '[0-9]+x[0-9]+' | tail -n 1)"
W="${SIZE%x*}"; H="${SIZE#*x}"
W="${W:-0}"; H="${H:-0}"
DENSITY="$(adbx shell wm density 2>/dev/null | tr -d '\r' | grep -oE '[0-9]+' | tail -n 1)"
DENSITY="${DENSITY:-0}"
ANDROID="$(adbx shell getprop ro.build.version.sdk 2>/dev/null | tr -d '\r\n ')"
ANDROID="${ANDROID:-unknown}"

printf '{"ok":true,"serial":"%s","w":%s,"h":%s,"density":%s,"android":"%s"}\n' \
  "$(json_escape "$SERIAL")" "$W" "$H" "$DENSITY" "$(json_escape "$ANDROID")"
