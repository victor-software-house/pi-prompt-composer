#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow", "rich"]
# ///
"""
Render assets/preview.png from the sanitized ANSI dump.

Pure Python + Pillow + Rich. No external tools (no freeze, no imagemagick).
Rich parses ANSI sequences; Pillow draws glyphs onto a canvas using the
operator's monospace font.

Usage:
  ./scripts/generate-preview.py

The sanitized dump (assets/preview-dump.ansi) is committed.
To recapture from scratch (rare), see scripts/sanitize-dump.py.
"""
import sys
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageEnhance, ImageFont
from rich.console import Console
from rich.text import Text

# ── Config ───────────────────────────────────────────────────

DUMP = Path("assets/preview-dump.ansi")
OUTPUT = Path("assets/preview.png")
BG = "#121212"
DEFAULT_FG = "#bebebe"
FONT_FILE = Path.home() / "Library/Fonts/FiraCodeNerdFontMono-Regular.ttf"
FONT_SIZE = 30  # render at 2x for crisp downscale
LINE_HEIGHT = 40
PADDING_X = 32
PADDING_Y = 20
CONTRAST = 1.3
SCALE = 0.5  # final downscale factor

# ── Main ─────────────────────────────────────────────────────


def main() -> None:
    if not DUMP.exists():
        print(f"Error: {DUMP} not found.", file=sys.stderr)
        sys.exit(1)
    if not FONT_FILE.exists():
        print(f"Error: {FONT_FILE} not found.", file=sys.stderr)
        sys.exit(1)

    text = DUMP.read_text("utf-8")
    lines = text.rstrip("\n").split("\n")

    font = ImageFont.truetype(str(FONT_FILE), FONT_SIZE)
    default_fg = ImageColor.getrgb(DEFAULT_FG)
    bg = ImageColor.getrgb(BG)

    # Measure char width from the monospace font
    bbox = font.getbbox("M")
    char_w = bbox[2] - bbox[0]

    # Find max visible width (strip ANSI via Rich)
    max_cols = max(len(Text.from_ansi(line).plain) for line in lines)

    img_w = max_cols * char_w + PADDING_X * 2
    img_h = len(lines) * LINE_HEIGHT + PADDING_Y * 2

    img = Image.new("RGB", (img_w, img_h), bg)
    draw = ImageDraw.Draw(img)

    console = Console()

    for row, line in enumerate(lines):
        rich_text = Text.from_ansi(line)
        x = PADDING_X
        y = PADDING_Y + row * LINE_HEIGHT

        for chunk, style, _ in rich_text.render(console):
            color = default_fg
            if style and style.color:
                r, g, b = style.color.get_truecolor()
                color = (r, g, b)
            draw.text((x, y), chunk, font=font, fill=color)
            x += len(chunk) * char_w

    # Contrast boost
    img = ImageEnhance.Contrast(img).enhance(CONTRAST)

    # Downscale for crisp result
    final_w = int(img_w * SCALE)
    final_h = int(img_h * SCALE)
    img = img.resize((final_w, final_h), Image.LANCZOS)

    img.save(OUTPUT, optimize=True)
    print(f"Preview written to {OUTPUT} ({final_w}x{final_h})")


if __name__ == "__main__":
    main()
