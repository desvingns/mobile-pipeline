#!/usr/bin/env bash
# ui-dump.sh — pull the uiautomator view-hierarchy XML and report node stats. One JSON line out.
# The raw XML is written to <out>; the executor reads it directly (LLMs parse bounds/text/resource-id
# well) and resolves taps via input.sh. `compose_degenerate` warns when the tree is a single
# AndroidComposeView with few semantics nodes (so the executor leans on vision instead).
#
# Usage:  ui-dump.sh <out.xml>
# Output: {"ok":true,"path":"/abs/ST07.xml","nodes":37,"text_nodes":12,"compose_degenerate":false}
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_crawl-lib.sh
. "$SCRIPT_DIR/_crawl-lib.sh"

OUT="${1:-}"
[ -n "$OUT" ] || die "usage: ui-dump.sh <out.xml>"

ADB_BIN="$(_resolve_adb)" || die "adb not found (set \$ADB or add platform-tools to PATH)"
# Git Bash (MSYS) rewrites a POSIX-looking arg like `/sdcard/...` into a Windows path before it reaches
# adb.exe, mangling the on-device dump path. MSYS_NO_PATHCONV=1 disables that (harmless no-op on
# Linux/macOS). We must NOT broaden this to all args — the LOCAL destination must still resolve — so we
# pull via `exec-out cat > "$OUT"` (a bash redirect, not an adb path arg) below.
export MSYS_NO_PATHCONV=1
mkdir -p "$(dirname "$OUT")" 2>/dev/null || true
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# uiautomator dump writes on-device, then we pull. Retry once (it can miss on a busy/animating UI).
DEV_PATH="/sdcard/window_dump.xml"
if ! adbx shell uiautomator dump "$DEV_PATH" >"$TMP/d.txt" 2>&1; then
  sleep 1
  adbx shell uiautomator dump "$DEV_PATH" >"$TMP/d.txt" 2>&1 || true
fi
adbx exec-out cat "$DEV_PATH" >"$OUT" 2>/dev/null || die "uiautomator dump/pull failed: $(tr '\n' ' ' <"$TMP/d.txt" | tail -c 200)"
[ -s "$OUT" ] || die "ui dump produced an empty file"

NODES="$(grep -o '<node ' "$OUT" 2>/dev/null | wc -l | tr -d ' ')"; NODES="${NODES:-0}"
TEXT_NODES="$(grep -oE 'text="[^"]{1,}"' "$OUT" 2>/dev/null | wc -l | tr -d ' ')"; TEXT_NODES="${TEXT_NODES:-0}"
CLICKABLE="$(tr '<' '\n' <"$OUT" 2>/dev/null | grep -c 'clickable="true"')"; CLICKABLE="${CLICKABLE:-0}"
CLICKABLE_LABELED="$(tr '<' '\n' <"$OUT" 2>/dev/null | grep 'clickable="true"' | grep -cE '(text|content-desc)="[^"]+"')"; CLICKABLE_LABELED="${CLICKABLE_LABELED:-0}"

# "Degenerate" = the dump won't drive taps, so the executor must lean on vision + --xy:
#   too few nodes; OR there are tappable nodes but NONE carries a label (the Compose pattern — the
#   clickable is an anonymous View and the label sits on a separate non-clickable node); OR a Compose
#   host view with almost no text.
DEGEN=false
if [ "$NODES" -lt 8 ] 2>/dev/null; then DEGEN=true
elif [ "$CLICKABLE" -gt 0 ] 2>/dev/null && [ "$CLICKABLE_LABELED" -eq 0 ] 2>/dev/null; then DEGEN=true
elif grep -q 'AndroidComposeView' "$OUT" 2>/dev/null && [ "$TEXT_NODES" -lt 3 ] 2>/dev/null; then DEGEN=true
fi

printf '{"ok":true,"path":"%s","nodes":%s,"text_nodes":%s,"clickable":%s,"clickable_labeled":%s,"compose_degenerate":%s}\n' \
  "$(json_escape "$OUT")" "$NODES" "$TEXT_NODES" "$CLICKABLE" "$CLICKABLE_LABELED" "$DEGEN"
