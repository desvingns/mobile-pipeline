#!/usr/bin/env bash
# input.sh — drive the device. One JSON line out. Targets $ANDROID_SERIAL.
# Tap resolution is hybrid: --text/--id/--desc resolve to a node centre from the latest ui-dump
# (structure-assisted); --xy is the vision fallback in NORMALIZED [0..1] coords scaled to the screen.
#
# Usage:
#   input.sh tap --text "Войти"   [--dump <file>] [--clickable]
#   input.sh tap --id   "fab_add" [--dump <file>]
#   input.sh tap --desc "Add"     [--dump <file>]
#   input.sh tap --xy 0.5 0.83    [--size 1080x2400]
#   input.sh text "hello world"
#   input.sh swipe up|down|left|right [--size 1080x2400]
#   input.sh key  back|enter|home|menu
#
# Output (tap):  {"ok":true,"action":"tap","x":540,"y":1990,"resolved_by":"text"}
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_crawl-lib.sh
. "$SCRIPT_DIR/_crawl-lib.sh"

SUB="${1:-}"; shift || true
[ -n "$SUB" ] || die "usage: input.sh <tap|text|swipe|key> ..."

ADB_BIN="$(_resolve_adb)" || die "adb not found (set \$ADB or add platform-tools to PATH)"

screen_size() {  # echoes "WxH"; honors --size override captured in $SIZE_OVERRIDE
  if [ -n "${SIZE_OVERRIDE:-}" ]; then printf '%s' "$SIZE_OVERRIDE"; return; fi
  adbx shell wm size 2>/dev/null | tr -d '\r' | grep -oE '[0-9]+x[0-9]+' | tail -n 1
}

# Extract the centre of the first node matching an attribute regex from a ui-dump file.
# $1=dump file, $2=attribute (text|resource-id|content-desc), $3=query (substring), $4=clickable_only(0|1)
resolve_center() {
  local dump="$1" attr="$2" query="$3" clickonly="$4" matches line bounds nums x1 y1 x2 y2
  [ -f "$dump" ] || return 1
  # one node per line, then filter; grep is ERE — escape regex metachars in the query.
  local q; q="$(printf '%s' "$query" | sed -e 's/[.[\*^$()+?{|]/\\&/g')"
  matches="$(tr '<' '\n' <"$dump" | grep -i -E "${attr}=\"[^\"]*${q}[^\"]*\"")"
  [ -n "$matches" ] || return 1
  # --clickable = PREFER a clickable match, but fall back to any match: in Compose the label often
  # sits on a non-clickable node while its clickable parent is an anonymous View — tapping the label's
  # centre still hits the button.
  if [ "$clickonly" = "1" ]; then
    line="$(printf '%s\n' "$matches" | grep -i 'clickable="true"' | head -n 1)"
    [ -n "$line" ] || line="$(printf '%s\n' "$matches" | head -n 1)"
  else
    line="$(printf '%s\n' "$matches" | head -n 1)"
  fi
  [ -n "$line" ] || return 1
  bounds="$(printf '%s' "$line" | grep -oE 'bounds="\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]"' | head -n1)"
  [ -n "$bounds" ] || return 1
  nums="$(printf '%s' "$bounds" | grep -oE '[0-9]+')"
  x1="$(printf '%s\n' "$nums" | sed -n '1p')"; y1="$(printf '%s\n' "$nums" | sed -n '2p')"
  x2="$(printf '%s\n' "$nums" | sed -n '3p')"; y2="$(printf '%s\n' "$nums" | sed -n '4p')"
  printf '%s %s' "$(( (x1 + x2) / 2 ))" "$(( (y1 + y2) / 2 ))"
}

case "$SUB" in
  tap)
    MODE=""; QUERY=""; DUMP=""; CLICKONLY=0; SIZE_OVERRIDE=""
    FX=""; FY=""
    while [ $# -gt 0 ]; do
      case "$1" in
        --text) MODE=text; QUERY="${2:-}"; shift ;;
        --id)   MODE=resource-id; QUERY="${2:-}"; shift ;;
        --desc) MODE=content-desc; QUERY="${2:-}"; shift ;;
        --xy)   MODE=xy; FX="${2:-}"; FY="${3:-}"; shift 2 ;;
        --dump) DUMP="${2:-}"; shift ;;
        --clickable) CLICKONLY=1 ;;
        --size) SIZE_OVERRIDE="${2:-}"; shift ;;
        *) ;;
      esac
      shift
    done
    if [ "$MODE" = xy ]; then
      [ -n "$FX" ] && [ -n "$FY" ] || die "tap --xy needs two normalized coords"
      SZ="$(screen_size)"; W="${SZ%x*}"; H="${SZ#*x}"
      [ -n "$W" ] && [ -n "$H" ] || die "could not read screen size for --xy"
      X="$(awk -v f="$FX" -v d="$W" 'BEGIN{printf "%d", f*d}')"
      Y="$(awk -v f="$FY" -v d="$H" 'BEGIN{printf "%d", f*d}')"
      adbx shell input tap "$X" "$Y" >/dev/null 2>&1 || die "tap failed"
      printf '{"ok":true,"action":"tap","x":%s,"y":%s,"resolved_by":"xy"}\n' "$X" "$Y"
    else
      [ -n "$MODE" ] || die "tap needs --text/--id/--desc/--xy"
      [ -n "$QUERY" ] || die "tap $MODE needs a value"
      CXY="$(resolve_center "$DUMP" "$MODE" "$QUERY" "$CLICKONLY")" \
        || die "no node matched $MODE~='$QUERY' in dump ($DUMP)"
      X="${CXY% *}"; Y="${CXY#* }"
      adbx shell input tap "$X" "$Y" >/dev/null 2>&1 || die "tap failed"
      printf '{"ok":true,"action":"tap","x":%s,"y":%s,"resolved_by":"%s"}\n' "$X" "$Y" "$(json_escape "$MODE")"
    fi
    ;;
  text)
    STR="${1:-}"
    [ -n "$STR" ] || die "text needs a string"
    ESC="${STR// /%s}"   # adb `input text` uses %s for spaces
    adbx shell input text "$ESC" >/dev/null 2>&1 || die "text input failed"
    printf '{"ok":true,"action":"text","chars":%s}\n' "${#STR}"
    ;;
  swipe)
    DIR="${1:-}"; shift || true
    SIZE_OVERRIDE=""
    while [ $# -gt 0 ]; do case "$1" in --size) SIZE_OVERRIDE="${2:-}"; shift ;; *) ;; esac; shift; done
    [ -n "$DIR" ] || die "swipe needs a direction"
    SZ="$(screen_size)"; W="${SZ%x*}"; H="${SZ#*x}"
    [ -n "$W" ] && [ -n "$H" ] || die "could not read screen size for swipe"
    CX=$(( W / 2 )); LO=$(( H * 3 / 10 )); HI=$(( H * 7 / 10 )); MIDX_L=$(( W * 2 / 10 )); MIDX_R=$(( W * 8 / 10 )); CY=$(( H / 2 ))
    case "$DIR" in
      up)    X1=$CX; Y1=$HI; X2=$CX; Y2=$LO ;;
      down)  X1=$CX; Y1=$LO; X2=$CX; Y2=$HI ;;
      left)  X1=$MIDX_R; Y1=$CY; X2=$MIDX_L; Y2=$CY ;;
      right) X1=$MIDX_L; Y1=$CY; X2=$MIDX_R; Y2=$CY ;;
      *) die "bad swipe direction: $DIR" ;;
    esac
    adbx shell input swipe "$X1" "$Y1" "$X2" "$Y2" 300 >/dev/null 2>&1 || die "swipe failed"
    printf '{"ok":true,"action":"swipe","dir":"%s"}\n' "$(json_escape "$DIR")"
    ;;
  key)
    K="${1:-}"
    case "$K" in
      back)  CODE=4 ;;
      enter) CODE=66 ;;
      home)  CODE=3 ;;
      menu)  CODE=82 ;;
      *) die "unknown key: $K (want back|enter|home|menu)" ;;
    esac
    adbx shell input keyevent "$CODE" >/dev/null 2>&1 || die "keyevent failed"
    printf '{"ok":true,"action":"key","key":"%s"}\n' "$(json_escape "$K")"
    ;;
  *)
    die "unknown subcommand: $SUB"
    ;;
esac
