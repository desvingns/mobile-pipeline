#!/usr/bin/env bash
# lib/prompts.sh — interactive prompt helpers.
# Sourced by bootstrap.sh.
#
# All prompts write to stderr (so caller can capture answers via stdout)
# and print only the chosen value to stdout.

# prompt_required <name> [pattern]
# Loops until non-empty input matching pattern (default: any non-empty).
prompt_required() {
    local name="$1" pattern="${2:-.+}" input=""
    while true; do
        printf '%s: ' "$name" >&2
        read -r input
        if [ -z "$input" ]; then
            echo "Required." >&2
            continue
        fi
        if [[ ! "$input" =~ $pattern ]]; then
            echo "Invalid format. Expected: $pattern" >&2
            continue
        fi
        printf '%s' "$input"
        return 0
    done
}

# prompt_optional <name> <default>
prompt_optional() {
    local name="$1" default="$2" input=""
    printf '%s [%s]: ' "$name" "$default" >&2
    read -r input
    printf '%s' "${input:-$default}"
}

# prompt_select <name> <opt1> <opt2> [...]
prompt_select() {
    local name="$1"; shift
    local options=("$@") input=""
    printf '%s — choose one of: %s\n' "$name" "${options[*]}" >&2
    while true; do
        printf '%s: ' "$name" >&2
        read -r input
        for o in "${options[@]}"; do
            if [ "$o" = "$input" ]; then
                printf '%s' "$input"
                return 0
            fi
        done
        echo "Invalid. Pick one of: ${options[*]}" >&2
    done
}

# confirm <question> [default=N]
# Echoes "y" or "n".
confirm() {
    local question="$1" default="${2:-N}" input=""
    local hint="y/N"
    [ "$default" = "Y" ] && hint="Y/n"
    printf '%s (%s): ' "$question" "$hint" >&2
    read -r input
    input="${input:-$default}"
    case "$input" in
        y|Y|yes|YES) printf 'y' ;;
        *)           printf 'n' ;;
    esac
}
