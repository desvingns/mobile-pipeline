#!/usr/bin/env bash
# mp-improve-drain.sh — batch ALL queued proposals in <mp_repo>/.ai/proposals/*.patch into
# ONE PR against the mobile-pipeline marketplace. Cross-platform bash; emits one JSON line.
# Queued proposals are staged by mp-improve / mp-reflect. A directly-entered
# improvement (`/mp --improve "<note>"`) goes through the single-PR path
# (mp-propose-improvement.sh) instead, so it stays a SEPARATE PR.
#
# Usage: mp-improve-drain.sh <mp_repo>
set -uo pipefail
MP="${1:-}"
emit() { printf '%s\n' "$1"; exit 0; }
[ -n "$MP" ] && [ -d "$MP/.git" ] || emit '{"ok":false,"error":"usage: <mp_repo> (a git repo)"}'
cd "$MP" || emit '{"ok":false,"error":"cd failed"}'
PROP=".ai/proposals"
shopt -s nullglob
patches=( "$PROP"/*.patch )
[ "${#patches[@]}" -gt 0 ] || emit '{"ok":true,"drained":0,"note":"no queued proposals in .ai/proposals/"}'

BASE=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
[ -n "$BASE" ] || BASE=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)
STAMP=$(date -u +%Y%m%d-%H%M)
BR="improve/batch-$STAMP"

# pre-check every patch applies against current templates/ before touching anything
for p in "${patches[@]}"; do
  git apply --check "$p" 2>/dev/null || emit "{\"ok\":false,\"error\":\"patch does not apply cleanly: $p — rebase the queue\"}"
done

git switch -c "$BR" "$BASE" 2>/dev/null || git switch "$BR" 2>/dev/null || emit "{\"ok\":false,\"error\":\"could not create branch $BR\"}"

mkdir -p "$PROP/.drained/$STAMP"
body="Batch improvement PR — aggregates the queued proposals below into one review."$'\n'
n=0
for p in "${patches[@]}"; do
  slug="$(basename "$p" .patch)"
  git apply "$p" || emit "{\"ok\":false,\"error\":\"apply failed mid-batch: $p\"}"
  cl="$PROP/$slug.changelog"
  if [ -f "$cl" ] && [ -f .ai/changes/agent-skill-log.md ]; then
    printf '\n' >> .ai/changes/agent-skill-log.md; cat "$cl" >> .ai/changes/agent-skill-log.md
  fi
  sumline=""; [ -f "$PROP/$slug.md" ] && sumline=" — $(head -n1 "$PROP/$slug.md")"
  body+="- ${slug}${sumline}"$'\n'
  n=$((n+1))
done

# regenerate the committed plugin trees once for the whole batch
[ -x lib/build-marketplace.sh ] && ./lib/build-marketplace.sh >/dev/null 2>&1

# archive drained proposals (file-safety: move, never delete)
for p in "${patches[@]}"; do
  slug="$(basename "$p" .patch)"
  for ext in patch changelog md meta; do
    [ -f "$PROP/$slug.$ext" ] && mv "$PROP/$slug.$ext" "$PROP/.drained/$STAMP/" 2>/dev/null || true
  done
done

git add -A
git commit -q -m "improve(batch): $STAMP — $n queued proposal(s)" -m "$body" \
  -m "Co-Authored-By: Claude <noreply@anthropic.com>" 2>/dev/null \
  || emit '{"ok":false,"error":"nothing to commit (patches produced no change?)"}'

PUSHED=false
RP=$(git remote get-url origin 2>/dev/null | sed -e 's#^https://[^/]*@#https://#' -e 's#^https://##')
if [ -n "${GITHUB_TOKEN:-}" ] && [ -n "$RP" ]; then
  git push "https://x-access-token:${GITHUB_TOKEN}@${RP}" "HEAD:refs/heads/$BR" >/dev/null 2>&1 && PUSHED=true
fi
[ "$PUSHED" = true ] || { git push -u origin "$BR" >/dev/null 2>&1 && PUSHED=true; }

PR_URL=""
if [ "$PUSHED" = true ] && command -v gh >/dev/null 2>&1; then
  PR_URL=$(gh pr create --base "$BASE" --head "$BR" --title "improve(batch): $STAMP ($n proposals)" --body "$body" 2>/dev/null | tail -n1)
fi
emit "{\"ok\":true,\"branch\":\"$BR\",\"base\":\"$BASE\",\"drained\":$n,\"pushed\":$PUSHED,\"pr_url\":\"$PR_URL\"}"
