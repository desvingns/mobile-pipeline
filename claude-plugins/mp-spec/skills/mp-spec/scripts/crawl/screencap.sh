#!/usr/bin/env bash
# screencap.sh — capture the device screen to a PNG. One JSON line out.
# Uses `exec-out screencap -p` (the same call the --fit gate uses) to avoid CRLF mangling.
#
# Usage:  screencap.sh <out.png>
# Output: {"ok":true,"path":"/abs/ST07.png","bytes":188213}
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_crawl-lib.sh
. "$SCRIPT_DIR/_crawl-lib.sh"

OUT="${1:-}"
[ -n "$OUT" ] || die "usage: screencap.sh <out.png>"

ADB_BIN="$(_resolve_adb)" || die "adb not found (set \$ADB or add platform-tools to PATH)"
mkdir -p "$(dirname "$OUT")" 2>/dev/null || true

adbx exec-out screencap -p >"$OUT" 2>/dev/null || die "screencap failed"

# Size check (cross-platform stat is unreliable; use wc -c).
BYTES="$(wc -c <"$OUT" 2>/dev/null | tr -d ' ')"
BYTES="${BYTES:-0}"
[ "$BYTES" -gt 0 ] 2>/dev/null || die "screencap produced an empty file"

printf '{"ok":true,"path":"%s","bytes":%s}\n' "$(json_escape "$OUT")" "$BYTES"
