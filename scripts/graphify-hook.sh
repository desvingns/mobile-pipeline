#!/usr/bin/env bash
# Wrapper used by .codex/hooks.json (PreToolUse) and can be called manually.
# Loads .env from the repo root (if present) so GEMINI_API_KEY is available,
# then delegates to graphify hook-check.
set -e
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if [ -f "$repo_root/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  . "$repo_root/.env"
  set +a
fi
graphify hook-check
