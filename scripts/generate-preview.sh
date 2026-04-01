#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow"]
# ///
"""
Render assets/preview.png from the sanitized ANSI dump.

1. Pipes assets/preview-dump.ansi through freeze (must be on PATH)
2. Post-processes with Pillow to boost contrast

Prerequisites:
  - freeze (brew install charmbracelet/tap/freeze)
  - FiraCode Nerd Font Mono Regular installed
  - uv (handles Pillow automatically)

To regenerate from a fresh Pi capture:
  1. Resize terminal to 120 cols
  2. Show the /review selector in Pi
  3. Capture the raw dump to pi-dump.txt (not committed)
  4. Run: python3 scripts/sanitize-dump.py
  5. Run: ./scripts/generate-preview.sh
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageEnhance

DUMP = Path("assets/preview-dump.ansi")
OUTPUT = Path("assets/preview.png")
BG = "#121212"
FONT_FILE = Path.home() / "Library/Fonts/FiraCodeNerdFontMono-Regular.ttf"
CONTRAST = 1.3

if not DUMP.exists():
    print(f"Error: {DUMP} not found.", file=sys.stderr)
    sys.exit(1)

if not FONT_FILE.exists():
    print(f"Error: {FONT_FILE} not found. Install FiraCode Nerd Font Mono.", file=sys.stderr)
    sys.exit(1)

# Render ANSI → PNG via freeze
with DUMP.open("rb") as f:
    subprocess.run(
        [
            "freeze",
            "--output", str(OUTPUT),
            "--background", BG,
            "--padding", "0",
            "--window=false",
            "--font.family", "FiraCode Nerd Font Mono",
            "--font.file", str(FONT_FILE),
            "--font.ligatures",
            "--font.size", "15",
        ],
        stdin=f,
        check=True,
    )

# Boost contrast
img = Image.open(OUTPUT)
img = ImageEnhance.Contrast(img).enhance(CONTRAST)
img.save(OUTPUT, optimize=True)

print(f"Preview written to {OUTPUT} (contrast ×{CONTRAST})")
