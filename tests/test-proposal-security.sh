#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
scripts="${MP_SECURITY_SCRIPTS:-$repo/templates/common/scripts}"
default_prefix='{{PREFIX}}'
prefix="${MP_SECURITY_PREFIX:-$default_prefix}"
# shellcheck source=templates/common/scripts/{{PREFIX}}-proposal-security.sh
. "$scripts/$prefix-proposal-security.sh"
root="$(mktemp -d "${TMPDIR:-/tmp}/mp-proposal-security.XXXXXX")"
export GIT_AUTHOR_NAME=security-test GIT_AUTHOR_EMAIL=test@example.invalid
export GIT_COMMITTER_NAME=security-test GIT_COMMITTER_EMAIL=test@example.invalid
expect_failure() { if "$@"; then printf "expected rejection: %s\n" "$*" >&2; exit 1; fi; }
fixture() {
  local dir="$root/$1"
  mkdir -p "$dir/templates" "$dir/.ai/proposals" "$dir/.ai/changes"
  git -C "$dir" init -q -b main
  git -C "$dir" config core.autocrlf false
  printf 'before\n' > "$dir/templates/demo.txt"
  printf 'log\n' > "$dir/.ai/changes/agent-skill-log.md"
  tr -d '\r' < "$repo/tests/fixtures/proposals/change-demo.patch" > "$dir/.ai/proposals/change-demo.patch"
  printf 'security fixture\n' > "$dir/.ai/proposals/change-demo.changelog"
  git -C "$dir" add .
  git -C "$dir" commit -qm fixture
}
for kind in untracked staged modified; do
  fixture "$kind"
  cd "$root/$kind"
  case "$kind" in
    untracked) printf 'dummy secret\n' > .env.backup ;;
    staged) printf 'dummy secret\n' > unrelated.txt; git add unrelated.txt ;;
    modified) printf 'unrelated\n' >> .ai/changes/agent-skill-log.md ;;
  esac
  out="$(bash "$scripts/$prefix-propose-improvement.sh" "$PWD" change-demo .ai/proposals/change-demo.patch .ai/proposals/change-demo.changelog)"
  [[ "$out" == *'"ok":false'* ]] && [[ "$out" == *'unrelated'* ]]
  [ "$(git branch --show-current)" = main ]
  grep -q '^before$' templates/demo.txt
done
fixture generated
cd "$root/generated"
mkdir lib
printf '%s\n' '#!/usr/bin/env bash' 'printf "dummy secret\n" > .env.backup' > lib/build-marketplace.sh
chmod +x lib/build-marketplace.sh
git add lib/build-marketplace.sh; git commit -qm generator
out="$(bash "$scripts/$prefix-propose-improvement.sh" "$PWD" change-demo .ai/proposals/change-demo.patch .ai/proposals/change-demo.changelog)"
[[ "$out" == *'"ok":true'* ]]
git show --format= --name-only HEAD | grep -q '^templates/demo.txt$'
expect_failure git cat-file -e HEAD:.env.backup 2>/dev/null
[ -f .env.backup ]
PROPOSAL_PATHS=()
printf '%s\n' 'diff --git a/lib/build-marketplace.sh b/lib/build-marketplace.sh' '--- a/lib/build-marketplace.sh' '+++ b/lib/build-marketplace.sh' '@@ -1 +1 @@' '-old' '+new' > "$root/outside.patch"
expect_failure proposal_patch_paths "$root/outside.patch"
expect_failure proposal_safe_path templates/.env.backup
mkdir "$root/bin"
real_git="$(command -v git)"
export MP_REAL_GIT="$real_git" MP_GIT_CALLS="$root/git-calls"
cat > "$root/bin/git" <<'EOF'
#!/usr/bin/env bash
if [ "${1:-}" = remote ]; then exec "$MP_REAL_GIT" "$@"; fi
printf '%s\n' "$*" >> "$MP_GIT_CALLS"
EOF
chmod +x "$root/bin/git"
git remote add origin https://attacker.invalid/team/repo.git
export GITHUB_TOKEN=dummy-security-token
export PATH="$root/bin:$PATH"
expect_failure proposal_push improve/test
[ ! -f "$MP_GIT_CALLS" ]
"$real_git" remote set-url origin https://github.com/team/repo.git
proposal_push improve/test
expect_failure grep -q 'dummy-security-token' "$MP_GIT_CALLS"
grep -q 'credential.helper=' "$MP_GIT_CALLS"
grep -q 'http.followRedirects=false' "$MP_GIT_CALLS"
"$real_git" remote set-url --push origin https://attacker.invalid/team/repo.git
before="$(wc -l < "$MP_GIT_CALLS")"
expect_failure proposal_push improve/test
[ "$(wc -l < "$MP_GIT_CALLS")" = "$before" ]
printf 'test-proposal-security: ok (%s)\n' "$root"
