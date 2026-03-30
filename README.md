# pi-prompt-composer

Folder-nested prompt routing extension for Pi.

## What it does

Adds subdirectory-based prompt routing to Pi's existing prompt template system. A folder of `.md` files under `prompts/` becomes a single `/command` with Tab-completable subcommands.

```
prompts/
├── workspace.md              # /workspace       (flat, native Pi)
├── superset/
│   ├── _index.md             # /superset        (bare invocation)
│   ├── create.md             # /superset create
│   ├── list.md               # /superset list
│   └── tasks.md              # /superset tasks
```

Each `.md` file uses the same frontmatter and `$1`/`$@` arg syntax as native Pi prompt templates.

## Status

Scaffold only. See `docs/FEATURE-SET.md` for the product feature model and `docs/ROADMAP.md` for the implementation plan.

## Package shape

```json
{
  "pi": {
    "extensions": ["./extensions"]
  }
}
```

## Development

```bash
bun install
bun run typecheck
bun run lint
```
