#!/usr/bin/env bash
# lib/detect.sh — OS / git / JBR / Xcode detection helpers.
# Sourced by bootstrap.sh; not executed standalone.

# detect_os → "linux" | "macos" | "windows" | "unknown"
detect_os() {
    case "$(uname -s)" in
        Linux*)               echo "linux"   ;;
        Darwin*)              echo "macos"   ;;
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        *)                    echo "unknown" ;;
    esac
}

# is_git_repo [dir]
is_git_repo() {
    git -C "${1:-.}" rev-parse --git-dir >/dev/null 2>&1
}

# detect_jbr → prints first JBR path found, returns 0; otherwise returns 1.
# Mirrors the loop in diet_helper's CLAUDE.md cross-platform JBR snippet.
detect_jbr() {
    local candidates=(
        "$HOME"/.jbr/jbr_jcef-17*
        /snap/android-studio/current/jbr
        /opt/android-studio/jbr
        "/c/Program Files/Android/Android Studio/jbr"
        "${LOCALAPPDATA:-/c/Users/$USER/AppData/Local}/Programs/Android Studio/jbr"
    )
    for c in "${candidates[@]}"; do
        if [ -x "$c/bin/java" ] || [ -x "$c/bin/java.exe" ]; then
            echo "$c"
            return 0
        fi
    done
    return 1
}

# detect_xcode → prints Xcode developer dir if available; returns 0 on success.
detect_xcode() {
    if command -v xcode-select >/dev/null 2>&1; then
        local dir
        dir=$(xcode-select -p 2>/dev/null) || return 1
        [ -n "$dir" ] || return 1
        echo "$dir"
        return 0
    fi
    return 1
}

# sanitise_path <path>
# Claude Code memory-path convention: replace : / \ with -
# "C:\Pet\foo" → "C--Pet-foo" ; "/home/user/foo" → "-home-user-foo"
sanitise_path() {
    printf '%s' "$1" | tr ':/\\' '---'
}

# script_dir <invocation-path>
# Cross-platform `dirname $(readlink -f $0)`. macOS lacks `readlink -f`, fall back.
script_dir() {
    local src="$1"
    if readlink -f "$src" >/dev/null 2>&1; then
        dirname "$(readlink -f "$src")"
    else
        ( cd "$(dirname "$src")" && pwd )
    fi
}
