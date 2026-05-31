#!/usr/bin/env bash
# jbr-detect.sh — cross-platform Android Studio JBR detection (JDK 17+).
# Source this in ~/.bashrc / ~/.bash_profile / ~/.zshrc, or paste into agent prompts.
# First match wins.

for candidate in \
    "$HOME"/.jbr/jbr_jcef-17* \
    /snap/android-studio/current/jbr \
    /opt/android-studio/jbr \
    /Applications/Android\ Studio.app/Contents/jbr/Contents/Home \
    "/c/Program Files/Android/Android Studio/jbr" \
    "$LOCALAPPDATA/Programs/Android Studio/jbr"; do
    if [ -x "$candidate/bin/java" ] || [ -x "$candidate/bin/java.exe" ]; then
        export JAVA_HOME="$candidate"
        export PATH="$JAVA_HOME/bin:$PATH"
        break
    fi
done
