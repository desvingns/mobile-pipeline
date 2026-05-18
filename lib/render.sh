#!/usr/bin/env bash
# lib/render.sh — placeholder replacement and conditional-block trimming.
# Sourced by bootstrap.sh.
#
# Cross-platform principle: never use `sed -i` (incompatible between GNU sed
# and BSD sed). Always write to a tmp file and `mv`.

# replace_placeholder <file> <key> <value>
# Replaces all `{{KEY}}` occurrences in <file> with <value>.
replace_placeholder() {
    local file="$1" key="$2" value="$3"
    local tmp="${file}.tmp.$$"
    # Escape value for sed replacement side: \, &, and our delimiter |
    local escaped
    escaped=$(printf '%s' "$value" | sed -e 's/[\&|]/\\&/g')
    sed -e "s|{{${key}}}|${escaped}|g" "$file" > "$tmp" && mv "$tmp" "$file"
}

# replace_in_filename <file> <key> <value>
# Renames <file> if its basename contains `{{KEY}}`. Echoes new path.
replace_in_filename() {
    local file="$1" key="$2" value="$3"
    local dir base new_base
    dir=$(dirname "$file")
    base=$(basename "$file")
    new_base="${base//\{\{${key}\}\}/${value}}"
    if [ "$new_base" != "$base" ]; then
        mv "$file" "$dir/$new_base"
        printf '%s' "$dir/$new_base"
    else
        printf '%s' "$file"
    fi
}

# strip_platform_block <file> <platform>
# Deletes lines from `<!-- platform:X -->` to `<!-- /platform:X -->` inclusive.
strip_platform_block() {
    local file="$1" platform="$2"
    local tmp="${file}.tmp.$$"
    sed -e "/<!-- platform:${platform} -->/,/<!-- \/platform:${platform} -->/d" \
        "$file" > "$tmp" && mv "$tmp" "$file"
}

# strip_platform_markers <file> <platform>
# Removes only the marker lines (keeps content) — for selected platforms.
strip_platform_markers() {
    local file="$1" platform="$2"
    local tmp="${file}.tmp.$$"
    sed -e "/<!-- platform:${platform} -->/d" \
        -e "/<!-- \/platform:${platform} -->/d" \
        "$file" > "$tmp" && mv "$tmp" "$file"
}

# strip_if_block <file> <condition>
# Removes `<!-- if CONDITION -->...<!-- /if -->` blocks. Condition is a literal
# string match (e.g. "UI_LANGUAGE != en").
strip_if_block() {
    local file="$1" condition="$2"
    local tmp="${file}.tmp.$$"
    sed -e "/<!-- if ${condition} -->/,/<!-- \/if -->/d" \
        "$file" > "$tmp" && mv "$tmp" "$file"
}

# strip_if_markers <file>
# Removes ALL `<!-- if ... -->` and `<!-- /if -->` markers. Call after
# strip_if_block has removed false branches — leftover markers wrap kept branches.
strip_if_markers() {
    local file="$1"
    local tmp="${file}.tmp.$$"
    sed -e '/<!-- if .* -->/d' -e '/<!-- \/if -->/d' "$file" > "$tmp" && mv "$tmp" "$file"
}

# render_file <file> <vars_file>
# Applies replace_placeholder for each `KEY=value` line in <vars_file>.
# Lines starting with `#` and blank lines are skipped.
render_file() {
    local file="$1" vars_file="$2"
    local key value
    while IFS='=' read -r key value; do
        case "$key" in
            ''|'#'*) continue ;;
        esac
        replace_placeholder "$file" "$key" "$value"
    done < "$vars_file"
}
