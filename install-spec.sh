#!/usr/bin/env bash
# install-spec.sh — global install of the app-spec-creator spec pipeline for Claude Code and/or
# Codex CLI. Part of claude-mobile-pipeline. The spec tool is project-agnostic (fixed names), so it
# installs once into ~/.claude and/or ~/.codex — unlike the per-project dev pipeline (bootstrap.sh).
#
# NOTE (v1.4.0+): the spec tool is now also distributed as the `mp-spec` plugin in the
# `mobile-pipeline` marketplace (see README → Marketplace + docs/MARKETPLACE.md). Prefer enabling the
# plugin per project (one shared, updatable copy). This global installer is still useful for Codex
# sub-agents (`~/.codex/agents/*.toml` — which Codex plugins can't carry) and as a fallback; if you
# enable the plugin AND keep this global install, remove the older global copy to avoid duplicate
# skill/agent names (~/.claude/skills/app-spec-creator + ~/.claude/agents/<17 spec agents>).
#
# Golden rules honoured: cross-platform Bash (Linux/macOS/Windows Git Bash); never `sed -i`
# (render writes to a temp file then `mv`); markdown-first; structured payloads untouched.
#
#   ./install-spec.sh [--harness claude|codex|both] [--home DIR] [--dry-run] [--force]
#
# Defaults: --harness both, --home "$HOME".
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPEC_SRC="$SCRIPT_DIR/templates/spec"

HARNESS="both"
HOME_DIR="${HOME}"
DRY_RUN=0
FORCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    --harness=*) HARNESS="${1#*=}" ;;
    --harness)   HARNESS="${2:?--harness needs a value}"; shift ;;
    --home=*)    HOME_DIR="${1#*=}" ;;
    --home)      HOME_DIR="${2:?--home needs a value}"; shift ;;
    --dry-run)   DRY_RUN=1 ;;
    --force)     FORCE=1 ;;
    -h|--help)   echo "usage: install-spec.sh [--harness claude|codex|both] [--home DIR] [--dry-run] [--force]"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

[ -d "$SPEC_SRC" ] || { echo "spec source not found: $SPEC_SRC" >&2; exit 1; }

# Canonical agent table: name|codex_reasoning_effort|short_description (no '#' or '/' in description).
AGENTS='constitution-author|low|Generate the spec bundle constitution.md (standards layer) from project conventions.
requirements-author|medium|Author EARS functional requirements from analyzer outputs or interview answers; ground every FR.
user-story-writer|medium|Derive user stories (US-NNN) from requirements, linked to FR IDs, reporting coverage gaps.
acceptance-criteria-writer|medium|Write UI-agnostic Gherkin acceptance criteria per epic, covering the state matrix.
spec-evaluator|high|Evaluator-optimizer critic; cross-check the bundle, build traceability.csv, return a verdict. Read-only on artifacts.
nfr-analyzer|medium|Derive measurable non-functional requirements with numeric thresholds.
a11y-reviewer|medium|Produce the accessibility spec (WCAG 2.2 AA) plus a per-screen checklist.
security-privacy-reviewer|medium|Data classification, consent, and per-permission justification.
analytics-taxonomy-designer|medium|Design the analytics event taxonomy keyed to user stories.
risk-estimator|medium|Risk register plus effort estimate from inventory, NFRs, and integrations.
apk-analyzer|medium|Extract ground-truth from an APK (palette, strings, manifest, libraries).
play-store-scraper|low|Scrape a Google Play listing for app metadata (needs the Chrome MCP).
screenshot-business-analyzer|high|Multimodal screenshot analysis into screens, business rules, states, and hints.
screenshot-style-analyzer|high|Multimodal screenshot analysis into design tokens and contrast pairs.
navigation-flow-analyzer|medium|Build the navigation graph from the business analysis.
data-model-extractor|medium|Derive neutral data entities, relations, and a cache strategy.
backend-api-extractor|medium|Infer REST API contracts and third-party SDKs from UI evidence.'

say() { echo "$@"; }

# render a markdown file: substitute {{AGENT_DIR}}; drop the OTHER tool's conditional blocks; strip
# all remaining tool-marker lines. $agentdir is a portable literal ("~/.claude" / "~/.codex").
render_md() {
  local src="$1" dst="$2" agentdir="$3" tool="$4" other tmp
  if [ "$tool" = claude ]; then other=codex; else other=claude; fi
  if [ "$DRY_RUN" = 1 ]; then echo "  [dry] render $(basename "$src") -> $dst ($tool)"; return; fi
  tmp="$(mktemp)"
  sed "s#{{AGENT_DIR}}#${agentdir}#g" "$src" \
    | sed "/<!-- tool:${other} -->/,/<!-- \/tool:${other} -->/d" \
    | sed -e "/<!-- tool:claude -->/d" -e "/<!-- \/tool:claude -->/d" \
          -e "/<!-- tool:codex -->/d"  -e "/<!-- \/tool:codex -->/d" \
    > "$tmp"
  mv "$tmp" "$dst"
}

guard_existing() {
  local dir="$1"
  if [ -d "$dir" ] && [ "$FORCE" != 1 ] && [ "$DRY_RUN" != 1 ]; then
    echo "refusing to overwrite existing $dir (use --force)" >&2; exit 1
  fi
}

install_claude() {
  local home="$1" sk ag adir="~/.claude" name
  sk="$home/.claude/skills/app-spec-creator"; ag="$home/.claude/agents"
  say "==> Claude form -> $home/.claude"
  guard_existing "$sk"
  if [ "$DRY_RUN" != 1 ]; then mkdir -p "$sk" "$ag"; rm -rf "$sk/prompts"; cp -r "$SPEC_SRC/skills/app-spec-creator/prompts" "$sk/prompts"; fi
  render_md "$SPEC_SRC/skills/app-spec-creator/SKILL.md" "$sk/SKILL.md" "$adir" claude
  while IFS='|' read -r name _ _; do
    [ -n "$name" ] || continue
    render_md "$SPEC_SRC/agents/$name.md" "$ag/$name.md" "$adir" claude
  done <<EOF
$AGENTS
EOF
}

install_codex() {
  local home="$1" sk ag adir="~/.codex" tmpl cfg name effort desc out
  sk="$home/.codex/skills/app-spec-creator"; ag="$home/.codex/agents"
  tmpl="$SPEC_SRC/codex/agent.toml.tmpl"
  say "==> Codex form -> $home/.codex"
  guard_existing "$sk"
  if [ "$DRY_RUN" != 1 ]; then
    mkdir -p "$sk/agents" "$ag"
    rm -rf "$sk/prompts"; cp -r "$SPEC_SRC/skills/app-spec-creator/prompts" "$sk/prompts"
    cp "$SPEC_SRC/codex/skills/app-spec-creator/agents/openai.yaml" "$sk/agents/openai.yaml"
  fi
  render_md "$SPEC_SRC/skills/app-spec-creator/SKILL.md" "$sk/SKILL.md" "$adir" codex
  while IFS='|' read -r name effort desc; do
    [ -n "$name" ] || continue
    render_md "$SPEC_SRC/agents/$name.md" "$ag/$name.md" "$adir" codex     # canonical spec the shim reads
    if [ "$DRY_RUN" = 1 ]; then echo "  [dry] toml $ag/$name.toml"; continue; fi
    out="$(mktemp)"
    sed -e "s#{{NAME}}#${name}#g" -e "s#{{EFFORT}}#${effort}#g" \
        -e "s#{{AGENT_DIR}}#${adir}#g" -e "s#{{DESC}}#${desc}#g" "$tmpl" > "$out"
    mv "$out" "$ag/$name.toml"
  done <<EOF
$AGENTS
EOF
  cfg="$home/.codex/config.toml"
  if [ -f "$cfg" ] && grep -q '^\[agents\]' "$cfg" 2>/dev/null; then
    say "    NOTE: $cfg already defines [agents] — merge templates/spec/codex/config-fragment.toml by hand (need max_threads >= 6)."
  elif [ "$DRY_RUN" != 1 ]; then
    say "    appending [agents] to $cfg"
    cat "$SPEC_SRC/codex/config-fragment.toml" >> "$cfg"
  fi
}

case "$HARNESS" in
  claude) install_claude "$HOME_DIR" ;;
  codex)  install_codex  "$HOME_DIR" ;;
  both)   install_claude "$HOME_DIR"; install_codex "$HOME_DIR" ;;
  *) echo "bad --harness: $HARNESS (want claude|codex|both)" >&2; exit 2 ;;
esac

say "Done ($([ "$DRY_RUN" = 1 ] && echo dry-run || echo installed)). Verify: grep -R '{{' the installed dirs should find nothing."
