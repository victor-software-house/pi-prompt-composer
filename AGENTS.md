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
- Expanded prompt text must produce `{ role: 'user', content: [{ type: 'text', text }] }` — the same session entry shape as native prompt templates
- The TUI renders user messages as rich Markdown via `UserMessageComponent`. No custom renderer needed.
- `_index.md` is the fallback for bare `/command` invocations
- Flat `.md` files in prompts directories are not touched — Pi handles those natively

## Auto-fix before manual fix

Never manually fix what tooling can auto-fix. Run `bun run fix` before committing:

```bash
bun run fix        # oxlint --fix then biome --write (combined)
bun run fix:oxlint # oxlint auto-fixes only
bun run fix:biome  # biome format + lint fixes only
bun run format     # biome format only
```

The pre-commit hook runs `oxlint --fix` then `biome check --write` on staged files automatically. If you see lint errors during development, run `bun run fix` first — only investigate what remains after auto-fix.

DO NOT manually rewrite code to satisfy a lint rule that has an auto-fix. Let the tooling handle it.

## Verification

```bash
bun run typecheck  # tsc --noEmit
bun run lint       # biome check + oxlint (type-aware)
```

Run both before committing. The pre-commit hook enforces this, but catch issues early.

## Import rules

- Single quotes for all imports
- No `.ts` or `.js` file extensions in import paths
- Import sorting enforced by biome `organizeImports`
- Use `import type` for type-only imports (enforced by biome `useImportType`)
- Import aliases enforced by `@limegrass/import-alias` via oxlint (when path aliases are configured)
