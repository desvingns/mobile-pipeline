#!/usr/bin/env bash
# {{PREFIX}}-retro.sh — L2 per-project retro: aggregate selfimprove/runs/*.jsonl into
# selfimprove/retro/retro-<YYYY-MM-DD>.md (per-agent pass-rate, user feedback, token/cost
# totals, recent failures). Deterministic awk only — no LLM. Emits ONE JSON line.
#
# Usage: {{PREFIX}}-retro.sh [--root <repo-root>]
set -u

emit() { printf '%s\n' "$1"; exit "${2:-0}"; }
esc() { printf '%s' "$1" | tr -d '\r\n' | sed 's/\\/\\\\/g; s/"/\\"/g'; }

root=""
while [ $# -gt 0 ]; do
  case "$1" in
    --root)    root="${2-}"; shift 2 2>/dev/null || shift ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) emit "{\"ok\":false,\"error\":\"unknown arg: $(esc "$1")\"}" 2 ;;
  esac
done
[ -n "$root" ] || root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
runs_dir="$root/selfimprove/runs"
retro_dir="$root/selfimprove/retro"

events="$(cat "$runs_dir"/*.jsonl 2>/dev/null | grep -c '"agent"' || true)"
case "$events" in ''|*[!0-9]*) events=0 ;; esac
[ "$events" -gt 0 ] || emit "{\"ok\":false,\"error\":\"no run events in $(esc "$runs_dir") — record events first\"}" 1

mkdir -p "$retro_dir" 2>/dev/null || emit "{\"ok\":false,\"error\":\"cannot create $(esc "$retro_dir")\"}"
date_tag="$(date -u +%Y-%m-%d)"
out="$retro_dir/retro-$date_tag.md"

{
  echo "# Retro — $date_tag"
  echo
  echo "Auto-aggregated from \`selfimprove/runs/*.jsonl\` ($events events). This is the"
  echo "**observe→reflect** step of the self-improvement loop. Turn findings into lessons"
  echo "(\`selfimprove/lessons.md\`) or plugin improvements (\`/{{PREFIX}} --improve\`); raw telemetry"
  echo "stays in runs/ — only this digest is meant to be read."
  echo
  echo "## Per-agent pass-rate"
  echo
  echo "| agent | runs | pass | fail | partial | pass-rate |"
  echo "|---|---|---|---|---|---|"
  cat "$runs_dir"/*.jsonl 2>/dev/null | awk '
    {
      a=""; v="";
      if (match($0, /"agent":"[^"]*"/))   a=substr($0, RSTART+9,  RLENGTH-10);
      if (match($0, /"verdict":"[^"]*"/)) v=substr($0, RSTART+11, RLENGTH-12);
      if (a=="") next;
      runs[a]++;
      if (v=="pass") p[a]++; else if (v=="fail") f[a]++; else if (v=="partial") pt[a]++;
    }
    END {
      for (a in runs) {
        r=runs[a]; pr=(r>0)?int((p[a]/r)*100):0;
        printf "| %s | %d | %d | %d | %d | %d%% |\n", a, r, p[a]+0, f[a]+0, pt[a]+0, pr;
      }
    }
  ' | sort
  echo
  echo "## User feedback (post-ship, agent=feedback)"
  echo
  cat "$runs_dir"/*.jsonl 2>/dev/null | awk '
    /"agent":"feedback"/ {
      n++;
      if (match($0, /score=[0-9]+/)) { s=substr($0, RSTART+6, RLENGTH-6)+0; sum+=s; if (s<=3) low++ }
    }
    END {
      if (n>0) printf "Events: %d · avg score: %.1f · low (<=3): %d\n", n, sum/n, low+0;
      else print "_none recorded yet_";
    }
  '
  echo
  if cat "$runs_dir"/*.jsonl 2>/dev/null | grep '"agent":"feedback"' | grep -E 'score=[123][^0-9]' >/dev/null 2>&1; then
    echo "Low-score events (latest 10):"
    echo
    cat "$runs_dir"/*.jsonl 2>/dev/null | grep '"agent":"feedback"' | grep -E 'score=[123][^0-9]' | tail -10 | sed 's/^/    /'
    echo
  fi
  echo "## Recorded token/cost estimates"
  echo
  cat "$runs_dir"/*.jsonl 2>/dev/null | awk '
    {
      if (match($0, /"tokens_in":[0-9]+/))  { ti += substr($0, RSTART+12, RLENGTH-12)+0; n++ }
      if (match($0, /"tokens_out":[0-9]+/)) { to += substr($0, RSTART+13, RLENGTH-13)+0 }
    }
    END {
      if (n>0) printf "Events with estimates: %d · tokens_in total: %d · tokens_out total: %d\n", n, ti, to;
      else print "_no token estimates recorded_";
    }
  '
  echo
  echo "## Recent fail/partial events (latest 20)"
  echo
  if cat "$runs_dir"/*.jsonl 2>/dev/null | grep -E '"verdict":"(fail|partial)"' >/dev/null 2>&1; then
    cat "$runs_dir"/*.jsonl 2>/dev/null | grep -E '"verdict":"(fail|partial)"' | tail -20 | sed 's/^/    /'
  else
    echo "_none_"
  fi
  echo
  echo "## Proposed improvements (human-gated)"
  echo
  echo "- [ ] weakest agent by pass-rate → inspect its prompt/extras, propose one minimal edit"
  echo "- [ ] top recurring failure cluster → add a guard + a durable line to selfimprove/lessons.md"
  echo "- [ ] low feedback scores → mine the notes; plugin-level pattern → /{{PREFIX}} --improve"
  echo
} > "$out"

emit "{\"ok\":true,\"retro\":\"$(esc "$out")\",\"events\":$events}"
