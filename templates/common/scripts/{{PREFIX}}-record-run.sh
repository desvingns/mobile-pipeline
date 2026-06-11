#!/usr/bin/env bash
# {{PREFIX}}-record-run.sh — L1 telemetry capture for the /{{PREFIX}} pipeline.
# Appends ONE structured event (a single JSON line) to <repo>/selfimprove/runs/<YYYY-MM>.jsonl
# and reports whether a per-project retro is due. Fire-and-forget by contract: ALWAYS exits 0
# with exactly one JSON line on stdout — telemetry must never block or fail the pipeline.
#
# Usage:
#   {{PREFIX}}-record-run.sh --agent <step> --verdict pass|fail|partial \
#     [--model M] [--metric "tests=42/0;cov=67%"] [--retry N] [--note "..."] \
#     [--tokens-in N] [--tokens-out N] [--cost "..."] [--root <repo-root>]
#
# Output: {"ok":true,"log":"...","events_total":N,"events_since_retro":N,"retro_due":false}
# retro_due fires when >= $REFLECT_AFTER (default 10) events were recorded after the newest
# selfimprove/retro/retro-YYYY-MM-DD.md (events from the retro's own day do not count).
set -u

emit() { printf '%s\n' "$1"; exit 0; }
esc() { printf '%s' "$1" | tr -d '\r\n' | sed 's/\\/\\\\/g; s/"/\\"/g'; }

agent=""; model=""; verdict=""; metric=""; retry="0"; note=""
tokens_in=""; tokens_out=""; cost=""; root=""
while [ $# -gt 0 ]; do
  key="$1"; val="${2-}"
  case "$key" in
    --agent)      agent="$val" ;;
    --model)      model="$val" ;;
    --verdict)    verdict="$val" ;;
    --metric)     metric="$val" ;;
    --retry)      retry="$val" ;;
    --note)       note="$val" ;;
    --tokens-in)  tokens_in="$val" ;;
    --tokens-out) tokens_out="$val" ;;
    --cost)       cost="$val" ;;
    --root)       root="$val" ;;
    -h|--help)    sed -n '2,15p' "$0"; exit 0 ;;
    *) emit "{\"ok\":false,\"error\":\"unknown arg: $(esc "$key")\"}" ;;
  esac
  shift 2 2>/dev/null || shift
done

[ -n "$agent" ]   || emit '{"ok":false,"error":"--agent is required"}'
[ -n "$verdict" ] || emit '{"ok":false,"error":"--verdict is required"}'
case "$retry" in ''|*[!0-9]*) retry=0 ;; esac
case "$tokens_in"  in *[!0-9]*) tokens_in=""  ;; esac
case "$tokens_out" in *[!0-9]*) tokens_out="" ;; esac

if [ -z "$root" ]; then
  root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
project="$(basename "$root")"
runs_dir="$root/selfimprove/runs"
mkdir -p "$runs_dir" 2>/dev/null || emit "{\"ok\":false,\"error\":\"cannot create $(esc "$runs_dir")\"}"

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
log="$runs_dir/$(date -u +%Y-%m).jsonl"

line="{\"ts\":\"$(esc "$ts")\",\"project\":\"$(esc "$project")\",\"agent\":\"$(esc "$agent")\""
line="$line,\"model\":\"$(esc "$model")\",\"verdict\":\"$(esc "$verdict")\",\"metric\":\"$(esc "$metric")\""
line="$line,\"retry\":$retry,\"note\":\"$(esc "$note")\""
[ -n "$tokens_in" ]  && line="$line,\"tokens_in\":$tokens_in"
[ -n "$tokens_out" ] && line="$line,\"tokens_out\":$tokens_out"
[ -n "$cost" ]       && line="$line,\"cost\":\"$(esc "$cost")\""
line="$line}"
printf '%s\n' "$line" >> "$log" 2>/dev/null || emit "{\"ok\":false,\"error\":\"cannot append to $(esc "$log")\"}"

# --- retro-due bookkeeping (lexicographic ISO-8601 compare; no GNU date needed) -----------------
cutoff=""
retro_dir="$root/selfimprove/retro"
if [ -d "$retro_dir" ]; then
  newest="$(ls "$retro_dir"/retro-????-??-??.md 2>/dev/null | sort | tail -1 || true)"
  if [ -n "$newest" ]; then
    d="$(basename "$newest" .md)"; d="${d#retro-}"
    cutoff="${d}T23:59:59Z"
  fi
fi
counts="$(cat "$runs_dir"/*.jsonl 2>/dev/null | awk -v c="$cutoff" '
  /"ts":"/ {
    total++
    if (match($0, /"ts":"[^"]*"/)) { t = substr($0, RSTART+6, RLENGTH-7); if (c == "" || t > c) since++ }
  }
  END { printf "%d %d", total+0, since+0 }')"
total="${counts%% *}"; since="${counts##* }"
case "$total" in ''|*[!0-9]*) total=0 ;; esac
case "$since" in ''|*[!0-9]*) since=0 ;; esac

threshold="${REFLECT_AFTER:-10}"
case "$threshold" in ''|*[!0-9]*) threshold=10 ;; esac
due=false
[ "$since" -ge "$threshold" ] && due=true

emit "{\"ok\":true,\"log\":\"$(esc "$log")\",\"events_total\":$total,\"events_since_retro\":$since,\"retro_due\":$due}"
