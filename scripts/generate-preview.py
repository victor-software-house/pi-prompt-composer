#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow"]
# ///
"""
Render assets/preview.png from the sanitized ANSI dump.

Pure Python + Pillow. No external tools (no freeze, no imagemagick).
Parses truecolor ANSI sequences and draws glyphs onto a Pillow canvas
using the operator's monospace font.

To regenerate from a fresh Pi capture:
  1. Resize terminal to 120 cols, show the /review selector in Pi
  2. Capture raw dump to pi-dump.txt (not committed)
  3. Run: ./scripts/sanitize-dump.py
  4. Run: ./scripts/generate-preview.py
"""
import re
import sys
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageEnhance, ImageFont

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

# ── ANSI parser ──────────────────────────────────────────────

ANSI_RE = re.compile(r"\x1b\[([0-9;]*)m")


def parse_line(line: str, default_fg: tuple[int, int, int]) -> list[tuple[str, tuple[int, int, int]]]:
    """Parse a line into [(text, (r,g,b)), ...] spans."""
    spans: list[tuple[str, tuple[int, int, int]]] = []
    fg = default_fg
    pos = 0

    for m in ANSI_RE.finditer(line):
        # Text before this escape
        if m.start() > pos:
            text = line[pos : m.start()]
            if text:
                spans.append((text, fg))
        pos = m.end()

        # Parse SGR codes
        codes = [int(c) for c in m.group(1).split(";") if c] if m.group(1) else [0]
        i = 0
        while i < len(codes):
            c = codes[i]
            if c == 0:
                fg = default_fg
            elif c == 38 and i + 1 < len(codes) and codes[i + 1] == 2:
                # Truecolor: 38;2;R;G;B
                if i + 4 < len(codes):
                    fg = (codes[i + 2], codes[i + 3], codes[i + 4])
                    i += 4
            elif c == 39:
                fg = default_fg
            i += 1

    # Remaining text
    if pos < len(line):
        text = line[pos:]
        if text:
            spans.append((text, fg))

    return spans


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

    # Find max visible width
    max_cols = max(len(ANSI_RE.sub("", line)) for line in lines)

    img_w = max_cols * char_w + PADDING_X * 2
    img_h = len(lines) * LINE_HEIGHT + PADDING_Y * 2

    img = Image.new("RGB", (img_w, img_h), bg)
    draw = ImageDraw.Draw(img)

    for row, line in enumerate(lines):
        spans = parse_line(line, default_fg)
        x = PADDING_X
        y = PADDING_Y + row * LINE_HEIGHT

        for text_chunk, color in spans:
            draw.text((x, y), text_chunk, font=font, fill=color)
            x += len(text_chunk) * char_w

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
