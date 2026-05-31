#!/usr/bin/env bash
# selfimprove/record-run.sh — L1 Capture
# Append one structured run event (a single JSON line) to selfimprove/runs/<YYYY-MM>.jsonl.
# No deps beyond coreutils. Wire this into your runner/reviewer/CI so events accrue automatically.
#
# Usage:
#   ./record-run.sh --agent <name> --verdict pass|fail|partial \
#       [--model M] [--metric "tests=42/0;cov=67%"] [--retry N] [--note "..."] [--project P]
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
runs_dir="$here/runs"
mkdir -p "$runs_dir"

agent=""; model=""; verdict=""; metric=""; retry="0"; note=""
project="$(basename "$(cd "$here/.." && pwd)")"

while [ $# -gt 0 ]; do
  key="$1"; val="${2-}"
  case "$key" in
    --agent)   agent="$val" ;;
    --model)   model="$val" ;;
    --verdict) verdict="$val" ;;
    --metric)  metric="$val" ;;
    --retry)   retry="$val" ;;
    --note)    note="$val" ;;
    --project) project="$val" ;;
    -h|--help) sed -n '2,11p' "$0"; exit 0 ;;
    *) echo "record-run: unknown arg: $key" >&2; exit 2 ;;
  esac
  shift 2 2>/dev/null || shift
done

[ -n "$agent" ]   || { echo "record-run: --agent is required" >&2; exit 2; }
[ -n "$verdict" ] || { echo "record-run: --verdict is required" >&2; exit 2; }
case "$retry" in ''|*[!0-9]*) retry=0 ;; esac

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
log="$runs_dir/$(date -u +%Y-%m).jsonl"

# minimal JSON-string escaping: backslash, double-quote, strip CR/LF
esc() { printf '%s' "$1" | tr -d '\r\n' | sed 's/\\/\\\\/g; s/"/\\"/g'; }

printf '{"ts":"%s","project":"%s","agent":"%s","model":"%s","verdict":"%s","metric":"%s","retry":%s,"note":"%s"}\n' \
  "$(esc "$ts")" "$(esc "$project")" "$(esc "$agent")" "$(esc "$model")" \
  "$(esc "$verdict")" "$(esc "$metric")" "$retry" "$(esc "$note")" >> "$log"

echo "recorded -> $log"
