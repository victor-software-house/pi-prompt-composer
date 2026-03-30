# pi-prompt-composer

Folder-nested prompt routing extension for Pi.

## Orient quickly

1. `README.md` — package scope and install shape
2. `ROADMAP.md` — ordered work items with acceptance criteria

## Repo shape

- Extension entrypoint: `extensions/index.ts`
- Implementation: `src/` (not yet created)

## Working rules

- Reuse Pi's exported utilities (`parseCommandArgs`, `substituteArgs`, `parseFrontmatter`) instead of reimplementing
- Extension commands registered here take priority over native flat prompt templates with the same name
- Expanded prompt text must produce `{ role: "user", content: [{ type: "text", text }] }` — the same session entry shape as native prompt templates
- The TUI renders user messages as rich Markdown via `UserMessageComponent`. No custom renderer needed.
- `_index.md` is the fallback for bare `/command` invocations
- Flat `.md` files in prompts directories are not touched — Pi handles those natively

## Verification

```bash
bun run typecheck
bun run lint
```
