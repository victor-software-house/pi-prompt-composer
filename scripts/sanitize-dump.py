#!/usr/bin/env python3
"""
Sanitize a raw Pi terminal dump for use as a preview image.

Reads pi-dump.txt (not committed), applies placeholder replacements
while preserving column alignment and ANSI color codes, and writes
assets/preview-dump.ansi.

ANSI color mapping:
  - Colon-separated truecolor (38:2:1:R:G:B) -> semicolons (38;2;R;G;B)
  - [0;32m] (ANSI green) -> #ffc107 (iTerm2 profile maps ANSI 2 to yellow)
  - [0;2m]  (faint/dim)  -> #5f5f5f (dimmed default fg)

Replacements (all width-preserving):
  - Path: ~/workspace/victor/... -> ~/projects/my-app (feat/grouped-prompts)
  - Cost: add token stats + "ran for 2s" in accent orange
  - Model: (openai-codex) -> (openai)
  - Packages: 36 -> 14
  - Stats model: Codex -> Claude
  - Remove top notification + ACM banner
"""
import re
import sys

INPUT = "pi-dump.txt"
OUTPUT = "assets/preview-dump.ansi"


def strip_ansi(s):
    return re.sub(r"\x1b\[[0-9;]*m", "", s)


def find_and_replace_visible(line, old_vis, new_vis):
    stripped = strip_ansi(line)
    pos = stripped.find(old_vis)
    if pos < 0:
        return line
    result = []
    vi = 0
    i = 0
    replaced = False
    while i < len(line):
        m = re.match(r"\x1b\[[0-9;]*m", line[i:])
        if m:
            result.append(m.group())
            i += len(m.group())
            continue
        if not replaced and vi == pos:
            result.append(new_vis)
            skip = len(old_vis)
            while skip > 0 and i < len(line):
                m2 = re.match(r"\x1b\[[0-9;]*m", line[i:])
                if m2:
                    i += len(m2.group())
                    continue
                i += 1
                skip -= 1
            vi += len(old_vis)
            replaced = True
            continue
        result.append(line[i])
        vi += 1
        i += 1
    return "".join(result)


def main():
    with open(INPUT, "rb") as f:
        text = f.read().decode("utf-8")

    # Convert colon truecolor to semicolon (freeze needs semicolons)
    text = re.sub(r"38:2:1:(\d+):(\d+):(\d+)", r"38;2;\1;\2;\3", text)
    text = re.sub(r"48:2:1:(\d+):(\d+):(\d+)", r"48;2;\1;\2;\3", text)

    # Map basic ANSI codes to real iTerm2 profile truecolor values
    text = text.replace("\x1b[0;32m", "\x1b[0;38;2;255;193;7m")  # green -> yellow
    text = text.replace("\x1b[0;2m", "\x1b[0;38;2;95;95;95m")  # faint -> dimmed fg

    lines = text.split("\n")
    out = lines[5:]  # remove Reloaded + blank + ACM banner (3 lines)

    dim = "\x1b[0;38;2;124;111;100m"
    accent_orange = "\x1b[0;38;2;254;128;25m"
    reset = "\x1b[0m"

    result = []
    for line in out:
        stripped = strip_ansi(line)

        # Path: 61 -> 61 visible chars
        if "~/workspace/victor/pi-prompt-composer" in stripped:
            old = "~/workspace/victor/pi-prompt-composer (003-publish-readiness)"
            new = "~/projects/my-app (feat/grouped-prompts)                     "
            line = find_and_replace_visible(line, old, new)

        # Cost line: rebuild with token stats + ran for 2s
        if "$0.000 (sub)" in stripped:
            left = "\u21916 \u219351 R50k $0.032 (sub) 0.1%/1.0M (auto) ran for "  # 51 vis
            time_str = "2s"  # 2 vis
            right = "(openai) gpt-5.4"  # 16 vis
            spaces = 117 - 51 - 2 - 16  # 48
            line = (
                dim + left + accent_orange + time_str + dim + (" " * spaces) + right + reset + reset
            )

        # Packages: 36 -> 14
        if "36 pkgs" in stripped and "LSP" in stripped:
            line = find_and_replace_visible(line, "36 pkgs", "14 pkgs")

        # Stats bar: Codex -> Claude (eat 1 space to preserve width)
        if "Codex" in stripped and "Ctx" in stripped:
            line = find_and_replace_visible(line, "Codex  ", "Claude ")

        result.append(line)

    # Remove trailing empty lines
    while result and not strip_ansi(result[-1]).strip():
        result.pop()

    with open(OUTPUT, "wb") as f:
        f.write(("\n".join(result) + "\n").encode("utf-8"))

    print(f"Sanitized dump written to {OUTPUT}")


if __name__ == "__main__":
    main()
