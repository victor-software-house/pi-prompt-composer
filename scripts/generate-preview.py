#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow"]
# ///
"""
Render assets/preview.png from the sanitized ANSI dump.

1. Pipes assets/preview-dump.ansi through freeze
2. Extends the canvas right to compensate for freeze's font-metric clipping
3. Boosts contrast with Pillow

Prerequisites:
  - freeze (brew install charmbracelet/tap/freeze)
  - FiraCode Nerd Font Mono Regular installed
  - uv (handles Pillow automatically)

To regenerate from a fresh Pi capture:
  1. Resize terminal to 120 cols
  2. Show the /review selector in Pi
  3. Capture the raw dump to pi-dump.txt (not committed)
  4. Run: ./scripts/sanitize-dump.py
  5. Run: ./scripts/generate-preview.py
"""
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageColor, ImageEnhance

DUMP = Path("assets/preview-dump.ansi")
OUTPUT = Path("assets/preview.png")
BG = "#121212"
FONT_FILE = Path.home() / "Library/Fonts/FiraCodeNerdFontMono-Regular.ttf"
PADDING = "16"  # symmetric
RIGHT_EXTEND = 24  # extra px to compensate freeze clipping the last glyph
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
            "--padding", PADDING,
            "--window=false",
            "--font.family", "FiraCode Nerd Font Mono",
            "--font.file", str(FONT_FILE),
            "--font.ligatures",
            "--font.size", "15",
        ],
        stdin=f,
        check=True,
    )

# Post-process: extend right edge + boost contrast
img = Image.open(OUTPUT).convert("RGB")
w, h = img.size
bg_color = ImageColor.getrgb(BG)
canvas = Image.new("RGB", (w + RIGHT_EXTEND, h), bg_color)
canvas.paste(img, (0, 0))
canvas = ImageEnhance.Contrast(canvas).enhance(CONTRAST)
canvas.save(OUTPUT, optimize=True)

print(f"Preview written to {OUTPUT} ({w + RIGHT_EXTEND}x{h}, contrast ×{CONTRAST})")
