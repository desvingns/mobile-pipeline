#!/usr/bin/env bash
# selfimprove/record-run.sh — L1 Capture
# Append one structured run event (a single JSON line) to selfimprove/runs/<YYYY-MM>.jsonl.
# No deps beyond coreutils. Wire this into your runner/reviewer/CI so events accrue automatically.
#
# Usage:
#   ./record-run.sh --agent <name> --verdict pass|fail|partial \
#       [--model M] [--metric "tests=42/0;cov=67%"] [--retry N] [--note "..."] [--project P] \
#       [--tokens-in N] [--tokens-out N] [--cost "..."]
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
runs_dir="$here/runs"
mkdir -p "$runs_dir"

agent=""; model=""; verdict=""; metric=""; retry="0"; note=""
tokens_in=""; tokens_out=""; cost=""
project="$(basename "$(cd "$here/.." && pwd)")"

while [ $# -gt 0 ]; do
  key="$1"; val="${2-}"
  case "$key" in
    --agent)      agent="$val" ;;
    --model)      model="$val" ;;
    --verdict)    verdict="$val" ;;
    --metric)     metric="$val" ;;
    --retry)      retry="$val" ;;
    --note)       note="$val" ;;
    --project)    project="$val" ;;
    --tokens-in)  tokens_in="$val" ;;
    --tokens-out) tokens_out="$val" ;;
    --cost)       cost="$val" ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "record-run: unknown arg: $key" >&2; exit 2 ;;
  esac
  shift 2 2>/dev/null || shift
done

[ -n "$agent" ]   || { echo "record-run: --agent is required" >&2; exit 2; }
[ -n "$verdict" ] || { echo "record-run: --verdict is required" >&2; exit 2; }
case "$retry" in ''|*[!0-9]*) retry=0 ;; esac
case "$tokens_in"  in *[!0-9]*) tokens_in=""  ;; esac
case "$tokens_out" in *[!0-9]*) tokens_out="" ;; esac

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
log="$runs_dir/$(date -u +%Y-%m).jsonl"

# minimal JSON-string escaping: backslash, double-quote, strip CR/LF
esc() { printf '%s' "$1" | tr -d '\r\n' | sed 's/\\/\\\\/g; s/"/\\"/g'; }

line="$(printf '{"ts":"%s","project":"%s","agent":"%s","model":"%s","verdict":"%s","metric":"%s","retry":%s,"note":"%s"' \
  "$(esc "$ts")" "$(esc "$project")" "$(esc "$agent")" "$(esc "$model")" \
  "$(esc "$verdict")" "$(esc "$metric")" "$retry" "$(esc "$note")")"
[ -n "$tokens_in" ]  && line="$line,\"tokens_in\":$tokens_in"
[ -n "$tokens_out" ] && line="$line,\"tokens_out\":$tokens_out"
[ -n "$cost" ]       && line="$line,\"cost\":\"$(esc "$cost")\""
printf '%s}\n' "$line" >> "$log"

echo "recorded -> $log"
