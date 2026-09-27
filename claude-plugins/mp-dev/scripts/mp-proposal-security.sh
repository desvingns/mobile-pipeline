#!/usr/bin/env bash

proposal_clean_worktree() {
  git diff --quiet && git diff --cached --quiet || return 1
  local path
  while IFS= read -r -d '' path; do
    case "$path" in
      .ai/proposals/*.patch|.ai/proposals/*.changelog|.ai/proposals/*.md|.ai/proposals/*.meta) ;;
      *) return 1 ;;
    esac
  done < <(git ls-files --others --exclude-standard -z)
}

proposal_safe_path() {
  local path="$1" name="${1##*/}"
  case "$path" in *$'\n'*|*$'\r'*|*'../'*|*/..|/*) return 1 ;; esac
  case "$name" in .env|.env.*|*.pem|*.key|*.p12|*.pfx|*.jks|*.keystore) return 1 ;; esac
}

proposal_patch_paths() {
  local record path
  git apply --numstat "$1" >/dev/null 2>&1 || return 1
  while IFS= read -r -d '' record; do
    path="${record#*$'\t'}"; path="${path#*$'\t'}"
    case "$path" in templates/*) ;; *) return 1 ;; esac
    proposal_safe_path "$path" || return 1
    PROPOSAL_PATHS+=("$path")
  done < <(git apply --numstat -z "$1")
}

proposal_stage() {
  local path
  while IFS= read -r -d '' path; do
    case "$path" in
      claude-plugins/*|codex-plugins/*|.claude-plugin/marketplace.json|.agents/plugins/marketplace.json|.ai/changes/agent-skill-log.md)
        proposal_safe_path "$path" || return 1
        PROPOSAL_PATHS+=("$path") ;;
    esac
  done < <(git diff --name-only -z; git ls-files --others --exclude-standard -z)
  [ "${#PROPOSAL_PATHS[@]}" -gt 0 ] || return 1
  git add -- "${PROPOSAL_PATHS[@]}"
}

proposal_push() {
  local branch="$1" remote
  remote="$(git remote get-url --push --all origin 2>/dev/null)" || return 1
  [ -n "$remote" ] && [[ "$remote" != *$'\n'* ]] || return 1
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    if [[ "$remote" =~ ^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/?$ ]]; then
      # Git asks the helper for credentials only for this exact host; the secret stays in the environment.
      # shellcheck disable=SC2016
      git -c http.followRedirects=false -c credential.helper= \
        -c 'credential.helper=!f() { [ "$1" = get ] || exit 0; protocol=; host=; while IFS= read -r line && [ -n "$line" ]; do case "$line" in protocol=*) protocol=${line#protocol=} ;; host=*) host=${line#host=} ;; esac; done; [ "$protocol" = https ] && [ "$host" = github.com ] || exit 0; printf "username=x-access-token\npassword=%s\n" "$GITHUB_TOKEN"; }; f' \
        push -u "$remote" "HEAD:refs/heads/$branch"
    else
      case "$remote" in
        /*|[A-Za-z]:/*|./*|../*|git@github.com:*) env -u GITHUB_TOKEN git push -u origin "$branch" ;;
        *) return 1 ;;
      esac
    fi
  else
    git push -u origin "$branch"
  fi
}
