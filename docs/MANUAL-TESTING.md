# Manual Testing Checklist

Run this checklist against a live Pi session before first publish and after significant changes.

## Setup

1. Install the package locally:
   ```bash
   pi install -l git:github.com/victor-software-house/pi-prompt-composer@003-publish-readiness
   ```
2. Copy example prompts into your project prompt root:
   ```bash
   mkdir -p .pi/composed/review
   cp -r node_modules/pi-prompt-composer/examples/prompts/review/* .pi/composed/review/
   ```
   Or symlink for development:
   ```bash
   ln -s ../../examples/prompts/review .pi/composed/review
   ```
3. Reload Pi.

## Checklist

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 1 | Type `/review` and press Enter | Rich selector opens with borders, accent title, aligned name + description columns, dynamic usage hint at bottom | |
| 2 | Navigate up/down in the selector | Usage hint updates showing `/review <subcommand> <args>` and per-arg bullet hints | |
| 3 | Select `fix` from the selector | Input prompt asks for `issue` argument | |
| 4 | Provide the issue value | Rendered prompt is sent as a visible user message with the value substituted | |
| 5 | Select `summary` from the selector | Input prompt asks for `change` argument | |
| 6 | Press Esc in the selector | Operation cancelled, no message sent | |
| 7 | Type `/review summary "my change"` | Prompt dispatched directly with `my change` substituted, no input prompt | |
| 8 | Type `/review fix` (no args) | Input prompt asks for `issue` | |
| 9 | Submit empty value for required arg | Warning notification, re-prompts | |
| 10 | Cancel input prompt (Esc/Ctrl+C) | Operation cancelled, no message sent | |
| 11 | Type `/review` then Tab after space | Autocomplete shows `fix` and `summary` with descriptions | |
| 12 | Type `/review nonexistent` | Warning notification listing available subcommands | |
| 13 | Reload Pi (`/reload`) | Commands still register correctly, no duplicate registrations | |
| 14 | Check for discovery warnings | If any prompt has malformed metadata, Pi notification appears on session start | |

## Recording results

Fill in the Pass? column with ✅ or ❌ and the date. Keep the last result committed.
