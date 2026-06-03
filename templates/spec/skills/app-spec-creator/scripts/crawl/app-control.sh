#!/usr/bin/env bash
# app-control.sh — lifecycle control of the reference app on the connected device.
# One JSON line out. Targets $ANDROID_SERIAL (set by device-preflight.sh).
#
# Usage:
#   app-control.sh install <apk-path>      # install -r -g -t (replace, grant runtime perms, allow test)
#   app-control.sh clear   <package>       # pm clear  (reset to first-run state for a deterministic crawl)
#   app-control.sh launch  <package>       # start the LAUNCHER activity, settle, report foreground
#   app-control.sh stop    <package>       # am force-stop
#   app-control.sh current                 # report the current foreground package/activity
#
# Output (ok):  {"ok":true,"action":"launch","pkg":"com.x","activity":"com.x/.MainActivity"}
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_crawl-lib.sh
. "$SCRIPT_DIR/_crawl-lib.sh"

ACTION="${1:-}"
ARG="${2:-}"
[ -n "$ACTION" ] || die "usage: app-control.sh <install|clear|launch|stop|current> [apk|package]"

ADB_BIN="$(_resolve_adb)" || die "adb not found (set \$ADB or add platform-tools to PATH)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# Resolve the current foreground "package/activity" component (best-effort, two sources).
current_component() {
  local c
  c="$(adbx shell dumpsys activity activities 2>/dev/null | tr -d '\r' \
        | grep -m1 -E 'mResumedActivity|topResumedActivity|mFocusedActivity' \
        | grep -oE '[A-Za-z0-9_.]+/[A-Za-z0-9_.]+' | head -n1)"
  if [ -z "$c" ]; then
    c="$(adbx shell dumpsys window 2>/dev/null | tr -d '\r' \
          | grep -m1 -E 'mCurrentFocus|mFocusedApp' \
          | grep -oE '[A-Za-z0-9_.]+/[A-Za-z0-9_.]+' | head -n1)"
  fi
  printf '%s' "$c"
}

case "$ACTION" in
  install)
    [ -n "$ARG" ] || die "install needs an apk path"
    [ -f "$ARG" ] || die "apk not found: $ARG"
    if adbx install -r -g -t "$ARG" >"$TMP/out.txt" 2>&1; then
      grep -q -i 'Success' "$TMP/out.txt" || true
      printf '{"ok":true,"action":"install","apk":"%s"}\n' "$(json_escape "$ARG")"
    else
      die "install failed: $(tr '\n' ' ' <"$TMP/out.txt" | tail -c 300)"
    fi
    ;;
  clear)
    [ -n "$ARG" ] || die "clear needs a package"
    adbx shell pm clear "$ARG" >"$TMP/out.txt" 2>&1
    grep -q -i 'Success' "$TMP/out.txt" \
      && printf '{"ok":true,"action":"clear","pkg":"%s"}\n' "$(json_escape "$ARG")" \
      || die "pm clear failed for $ARG: $(tr '\n' ' ' <"$TMP/out.txt" | tail -c 200)"
    ;;
  launch)
    [ -n "$ARG" ] || die "launch needs a package"
    # Launch, then CONFIRM the target actually reached the foreground (monkey can no-op, and splash /
    # consent screens delay it). Poll, and retry the launch once before giving up.
    COMP=""; tries=0
    while [ "$tries" -lt 2 ]; do
      adbx shell monkey -p "$ARG" -c android.intent.category.LAUNCHER 1 >"$TMP/out.txt" 2>&1
      n=0
      while [ "$n" -lt 6 ]; do
        sleep 1
        COMP="$(current_component)"
        case "$COMP" in "$ARG"/*) break 2 ;; esac
        n=$((n + 1))
      done
      tries=$((tries + 1))
    done
    case "$COMP" in
      "$ARG"/*) printf '{"ok":true,"action":"launch","pkg":"%s","activity":"%s"}\n' \
                  "$(json_escape "$ARG")" "$(json_escape "$COMP")" ;;
      *) die "launched $ARG but foreground is '$COMP' (no LAUNCHER activity, or a splash/consent is delaying it)" ;;
    esac
    ;;
  stop)
    [ -n "$ARG" ] || die "stop needs a package"
    adbx shell am force-stop "$ARG" >/dev/null 2>&1
    printf '{"ok":true,"action":"stop","pkg":"%s"}\n' "$(json_escape "$ARG")"
    ;;
  current)
    COMP="$(current_component)"
    PKG="${COMP%%/*}"
    printf '{"ok":true,"action":"current","pkg":"%s","activity":"%s"}\n' \
      "$(json_escape "$PKG")" "$(json_escape "$COMP")"
    ;;
  *)
    die "unknown action: $ACTION"
    ;;
esac
