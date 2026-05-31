#!/usr/bin/env bash
# xcode-detect.sh — set DEVELOPER_DIR from xcode-select.
# Source this in ~/.zshrc / ~/.bash_profile, or paste into agent prompts.

if command -v xcode-select >/dev/null 2>&1; then
    if dir=$(xcode-select -p 2>/dev/null) && [ -n "$dir" ]; then
        export DEVELOPER_DIR="$dir"
    fi
fi

# Verify:
#   echo $DEVELOPER_DIR
#   xcodebuild -version
