#!/usr/bin/env bash
# Render assets/preview.png from the sanitized ANSI dump.
#
# Prerequisites:
#   - freeze (brew install charmbracelet/tap/freeze)
#   - FiraCode Nerd Font Mono Regular installed
#
# The sanitized dump lives at assets/preview-dump.ansi.
# To regenerate from a fresh Pi capture:
#   1. Resize terminal to 120 cols
#   2. Show the /review selector in Pi
#   3. Capture the raw dump to pi-dump.txt (not committed)
#   4. Run: python3 scripts/sanitize-dump.py
#   5. Run this script
#
# Usage:
#   bash scripts/generate-preview.sh

set -euo pipefail

DUMP="assets/preview-dump.ansi"
OUTPUT="assets/preview.png"
BG="#121212"
FONT_FILE="$HOME/Library/Fonts/FiraCodeNerdFontMono-Regular.ttf"

if [ ! -f "$DUMP" ]; then
  echo "Error: $DUMP not found." >&2
  exit 1
fi

if [ ! -f "$FONT_FILE" ]; then
  echo "Error: $FONT_FILE not found. Install FiraCode Nerd Font Mono." >&2
  exit 1
fi

cat "$DUMP" | freeze \
  --output "$OUTPUT" \
  --background "$BG" \
  --padding 0 \
  --window=false \
  --font.family "FiraCode Nerd Font Mono" \
  --font.file "$FONT_FILE" \
  --font.ligatures \
  --font.size 15

echo "Preview written to $OUTPUT"
