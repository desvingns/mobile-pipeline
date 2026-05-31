#!/usr/bin/env bash
# build-marketplace.sh — emit the committed plugin trees (claude-plugins/, codex-plugins/)
# from the canonical templates/ sources. Principle: ONE canonical source + thin per-tool adapters,
# so you edit templates/ once and regenerate the marketplace instead of hand-syncing copies.
#
# Golden rules honoured: cross-platform Bash (Linux/macOS/Windows Git Bash); never `sed -i`
# (render writes to a temp file then `mv`); markdown-first.
#
#   ./lib/build-marketplace.sh [--dry-run]
#
# What it builds:
#   claude-plugins/mp-spec/  skills/mp-spec/{SKILL.md,prompts/} + agents/*.md   (skill + 17 subagents)
#   codex-plugins/mp-spec/   skills/mp-spec/{SKILL.md,prompts/}                  (skill only — Codex
#                            plugins cannot carry subagents; the .codex/agents/*.toml roster is
#                            installed per-project by install-spec.sh.)
#   claude-plugins/mp-dev/   commands/mp.md + agents/mp-*.md + scripts/mp-*.sh  (the /mp dev pipeline,
#                            de-specialized: agent bodies read project facts from .claude/mp/config.json
#                            + CLAUDE.md + .claude/mp/extras/*.md at runtime). Claude-only; the Codex
#                            dev roster is generated per-project during project wiring.
#
# Ownership: this script never edits templates/ — it reads them and writes transformed copies into
# the plugin trees. bootstrap.sh and templates/**/scripts/*.sh stay untouched.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC_SRC="$ROOT/templates/spec"
COMMON="$ROOT/templates/common"
ANDROID="$ROOT/templates/android"

# strip_platform_block / strip_platform_markers / strip_if_markers come from lib/render.sh
# (sourcing only DEFINES functions — no side effects).
# shellcheck source=lib/render.sh
. "$ROOT/lib/render.sh"

DRY=0
if [ "${1:-}" = "--dry-run" ]; then DRY=1; fi

[ -d "$SPEC_SRC" ] || { echo "spec source not found: $SPEC_SRC" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# ----- shared md render (mp-spec): {{AGENT_DIR}} + tool: only; leave platform: inert ------------
render_md() {
  local src="$1" dst="$2" agentdir="$3" tool="$4" other tmp
  if [ "$tool" = claude ]; then other=codex; else other=claude; fi
  if [ "$DRY" = 1 ]; then echo "  [dry] render $(basename "$src") -> ${dst#"$ROOT"/} ($tool)"; return; fi
  mkdir -p "$(dirname "$dst")"
  tmp="$(mktemp)"
  sed "s#{{AGENT_DIR}}#${agentdir}#g" "$src" \
    | sed "/<!-- tool:${other} -->/,/<!-- \/tool:${other} -->/d" \
    | sed -e "/<!-- tool:claude -->/d" -e "/<!-- \/tool:claude -->/d" \
          -e "/<!-- tool:codex -->/d"  -e "/<!-- \/tool:codex -->/d" \
    > "$tmp"
  mv "$tmp" "$dst"
}

set_skill_name() {
  local file="$1" newname="$2" tmp
  [ "$DRY" = 1 ] && return 0
  tmp="$(mktemp)"
  awk -v n="$newname" 'BEGIN{done=0} (!done && /^name:[[:space:]]/){print "name: " n; done=1; next} {print}' "$file" > "$tmp"
  mv "$tmp" "$file"
}

copy_dir() {
  local src="$1" dst="$2"
  [ -d "$src" ] || return 0
  if [ "$DRY" = 1 ]; then echo "  [dry] copy   ${src#"$ROOT"/} -> ${dst#"$ROOT"/}"; return; fi
  rm -rf "$dst"; mkdir -p "$(dirname "$dst")"; cp -r "$src" "$dst"
}

rewrite_mp_spec_file() {
  local file="$1" tool="$2" prompt_root tmp
  if [ "$tool" = claude ]; then
    prompt_root='${CLAUDE_PLUGIN_ROOT}/skills/mp-spec/prompts'
  else
    prompt_root='prompts'
  fi

  tmp="$(mktemp)"
  sed -e "s#{{AGENT_DIR}}/skills/app-spec-creator/prompts#${prompt_root}#g" \
      -e "s#\\.claude/skills/app-spec-creator/prompts#${prompt_root}#g" \
      -e "s#\\.codex/skills/app-spec-creator/prompts#${prompt_root}#g" \
      -e 's#/app-spec-creator#/mp-spec#g' \
      -e 's#app-spec-creator#mp-spec#g' \
      "$file" > "$tmp"
  mv "$tmp" "$file"

  tmp="$(mktemp)"
  if [ "$tool" = claude ]; then
    sed -e 's#^- Skill + agents live under `~/.claude/`; prompts at `.*`\.$#- Skill + agents live inside the `mp-spec` plugin; prompts at `${CLAUDE_PLUGIN_ROOT}/skills/mp-spec/prompts/`.#' \
        "$file" > "$tmp"
  else
    sed -e 's#^- Skill + agents live under `~/.codex/`; prompts at `.*`\.$#- Skill lives inside the `mp-spec` plugin; Codex sub-agent shims are installed separately; prompts live next to this SKILL.md under `prompts/`.#' \
        "$file" > "$tmp"
  fi
  mv "$tmp" "$file"
}

rewrite_mp_spec_tree() {
  local dir="$1" tool="$2" f
  [ "$DRY" = 1 ] && return 0
  while IFS= read -r f; do
    rewrite_mp_spec_file "$f" "$tool"
  done < <(find "$dir" -type f \( -name '*.md' -o -name '*.json' -o -name '*.yaml' -o -name '*.yml' \) -print)
}

# ----- mp-spec ----------------------------------------------------------------------------------
build_mp_spec() {
  local tool="$1" adir plugdir a
  if [ "$tool" = claude ]; then adir=".claude"; plugdir="$ROOT/claude-plugins/mp-spec"
  else                        adir=".codex";  plugdir="$ROOT/codex-plugins/mp-spec"; fi
  echo "==> mp-spec ($tool) -> ${plugdir#"$ROOT"/}"
  render_md "$SPEC_SRC/skills/app-spec-creator/SKILL.md" "$plugdir/skills/mp-spec/SKILL.md" "$adir" "$tool"
  set_skill_name "$plugdir/skills/mp-spec/SKILL.md" "mp-spec"
  copy_dir "$SPEC_SRC/skills/app-spec-creator/prompts" "$plugdir/skills/mp-spec/prompts"
  if [ "$tool" = claude ]; then
    for a in "$SPEC_SRC"/agents/*.md; do
      [ -f "$a" ] || continue
      render_md "$a" "$plugdir/agents/$(basename "$a")" "$adir" "$tool"
    done
  fi
  rewrite_mp_spec_tree "$plugdir" "$tool"
}

# ----- mp-dev (Claude-only): de-specialize templates into a generic /mp plugin ------------------

# Write the reusable snippets (preamble + reviewer resolver) once, as files, so awk can splice them
# in with getline — far safer than inline-escaping bash inside awk print statements.
write_dev_snippets() {
  PREAMBLE_FILE="$WORK/preamble.md"
  RESOLVER_FILE="$WORK/resolver.sh"
  cat > "$PREAMBLE_FILE" <<'EOF'

> **mp-dev — project config (read first).** This agent is project-agnostic. Resolve project
> specifics at runtime: read `.claude/mp/config.json` (`package`, `packagePath`, `platforms`,
> `sourceRoot`, `stack`, `uiLang`, `projectName`) and the repo-root `CLAUDE.md` for stack/architecture.
> If `.claude/mp/extras/<this-agent-name>.md` exists, read it **after** this file — its
> project-specific rules win on conflict. Tokens `<package>` / `<pkg-path>` below are `config.json`
> values (`package` / `packagePath`).
EOF
  cat > "$RESOLVER_FILE" <<'EOF'

# package + source root resolved at runtime from the mp-dev project config
CONFIG="$REPO_ROOT/.claude/mp/config.json"
_mpcfg() { grep -oE "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$CONFIG" 2>/dev/null | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/'; }
PACKAGE="$(_mpcfg package)"
SRC_ROOT="app/src/main/java/$(_mpcfg packagePath)"
if [ -z "$PACKAGE" ] || [ -z "$SRC_ROOT" ]; then
  printf '%s\n' '{"pass":false,"violations":["missing or invalid .claude/mp/config.json (need package + packagePath)"]}'
  exit 0
fi
EOF
}

# transform_dev_md <src> <dst> <is_agent:0|1>
transform_dev_md() {
  local src="$1" dst="$2" is_agent="$3" tmp
  if [ "$DRY" = 1 ]; then echo "  [dry] dev-md ${src#"$ROOT"/} -> ${dst#"$ROOT"/}"; return; fi
  mkdir -p "$(dirname "$dst")"
  tmp="$(mktemp)"
  sed -e 's#{{PREFIX}}#mp#g' \
      -e 's#the {{PROJECT_NAME}}#the project#g' \
      -e 's#The {{PROJECT_NAME}}#The project#g' \
      -e 's#{{PROJECT_NAME}}#the project#g' \
      -e "s#{{UI_LANGUAGE}}#the project's configured UI language#g" \
      -e 's#{{PACKAGE_PATH}}#<pkg-path>#g' \
      -e 's#{{PACKAGE}}#<package>#g' \
      -e 's#{{PLATFORM}}#android#g' \
      -e 's#\.claude/scripts/#${CLAUDE_PLUGIN_ROOT}/scripts/#g' \
      -e 's#\.claude/\.cmp-version#.claude/mp/config.json#g' \
      "$src" \
    | sed "/<!-- tool:codex -->/,/<!-- \/tool:codex -->/d" \
    | sed -e "/<!-- tool:claude -->/d" -e "/<!-- \/tool:claude -->/d" \
    > "$tmp"
  mv "$tmp" "$dst"
  strip_platform_block   "$dst" ios
  strip_platform_markers "$dst" android
  strip_if_markers       "$dst"
  if [ "$is_agent" = 1 ]; then
    tmp="$(mktemp)"
    awk -v pf="$PREAMBLE_FILE" 'BEGIN{c=0} {print} /^---[[:space:]]*$/{c++; if(c==2){while((getline l < pf)>0) print l}}' "$dst" > "$tmp"
    mv "$tmp" "$dst"
  fi
}

# transform_dev_command <src> <dst>
transform_dev_command() {
  local src="$1" dst="$2" tmp body
  transform_dev_md "$src" "$dst" 0
  [ "$DRY" = 1 ] && return 0
  # augment the Startup step to read the runtime config + extras
  tmp="$(mktemp)"
  sed -e 's#^1\. Read `CLAUDE.md` (at the repository root) for tech stack and architecture\.#1. Read `.claude/mp/config.json` (package, platforms, sourceRoot, stack, uiLang) and `CLAUDE.md` for tech stack/architecture, plus any `.claude/mp/extras/*.md` project overrides.#' \
      "$dst" > "$tmp"
  mv "$tmp" "$dst"
  # prepend command frontmatter (commands support description metadata; silences validate warning)
  body="$(mktemp)"; mv "$dst" "$body"
  {
    printf '%s\n' '---'
    printf '%s\n' 'description: Mobile dev orchestrator (/mp) — runs the SPEC → develop → review → test → verify pipeline (Android/iOS, Clean Architecture). Reads .claude/mp/config.json + CLAUDE.md + .claude/mp/extras for project specifics.'
    printf '%s\n' 'argument-hint: --feature|--bugfix|--discuss|--spec|--tdd|--coverage|--device <description>'
    printf '%s\n' '---'
    cat "$body"
  } > "$dst"
  rm -f "$body"
}

# transform_dev_script <src> <dst> <kind:runner|reviewer>
transform_dev_script() {
  local src="$1" dst="$2" kind="$3" tmp
  if [ "$DRY" = 1 ]; then echo "  [dry] dev-sh ${src#"$ROOT"/} -> ${dst#"$ROOT"/} ($kind)"; return; fi
  mkdir -p "$(dirname "$dst")"
  tmp="$(mktemp)"
  sed -e 's#{{PREFIX}}#mp#g' -e 's#{{PROJECT_NAME}}#the project#g' "$src" > "$tmp"
  mv "$tmp" "$dst"
  if [ "$kind" = reviewer ]; then
    tmp="$(mktemp)"
    sed -e '/^PACKAGE="{{PACKAGE}}"$/d' -e '\#^SRC_ROOT="app/src/main/java/{{PACKAGE_PATH}}"$#d' "$dst" > "$tmp"
    mv "$tmp" "$dst"
    tmp="$(mktemp)"
    awk -v rf="$RESOLVER_FILE" 'BEGIN{done=0} {print} /^cd "\$REPO_ROOT"$/ && !done {while((getline l < rf)>0) print l; done=1}' "$dst" > "$tmp"
    mv "$tmp" "$dst"
  fi
  chmod +x "$dst" 2>/dev/null || true
}

build_mp_dev() {
  local plugdir="$ROOT/claude-plugins/mp-dev" f base rv
  echo "==> mp-dev (claude, android) -> ${plugdir#"$ROOT"/}"
  [ "$DRY" = 1 ] || write_dev_snippets

  for base in architect docs maintainer intake knowledge planner improve reflect; do
    transform_dev_md "$COMMON/agents/{{PREFIX}}-$base.md" "$plugdir/agents/mp-$base.md" 1
  done

  # Reviewer = reviewer-base + android overlay (assemble, then transform once).
  if [ "$DRY" = 1 ]; then
    echo "  [dry] assemble reviewer-base + android overlay -> claude-plugins/mp-dev/agents/mp-reviewer-android.md"
  else
    rv="$(mktemp)"
    cat "$COMMON/agents/{{PREFIX}}-reviewer-base.md" > "$rv"
    printf '\n' >> "$rv"
    cat "$ANDROID/agents/{{PREFIX}}-reviewer-android.md" >> "$rv"
    transform_dev_md "$rv" "$plugdir/agents/mp-reviewer-android.md" 1
    rm -f "$rv"
  fi

  # Android specialist agents (skip the reviewer overlay — handled above).
  for f in "$ANDROID"/agents/*.md; do
    base="$(basename "$f")"
    [ "$base" = "{{PREFIX}}-reviewer-android.md" ] && continue
    transform_dev_md "$f" "$plugdir/agents/${base/\{\{PREFIX\}\}/mp}" 1
  done

  transform_dev_command "$COMMON/commands/{{PREFIX}}.md" "$plugdir/commands/mp.md"

  transform_dev_script "$ANDROID/scripts/{{PREFIX}}-runner-android.sh"   "$plugdir/scripts/mp-runner-android.sh"   runner
  transform_dev_script "$ANDROID/scripts/{{PREFIX}}-reviewer-android.sh" "$plugdir/scripts/mp-reviewer-android.sh" reviewer

  # Common (platform-neutral) scripts — e.g. the improvement → PR helper.
  if [ -d "$COMMON/scripts" ]; then
    for s in "$COMMON"/scripts/*.sh; do
      [ -f "$s" ] || continue
      base="$(basename "$s")"
      transform_dev_script "$s" "$plugdir/scripts/${base/\{\{PREFIX\}\}/mp}" neutral
    done
  fi
}

build_mp_spec claude
build_mp_spec codex
build_mp_dev

echo "build-marketplace: done ($([ "$DRY" = 1 ] && echo dry-run || echo wrote) mp-spec + mp-dev)."
