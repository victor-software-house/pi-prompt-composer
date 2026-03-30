# pi-prompt-composer

Folder-nested prompt routing extension for Pi.

## What it does

Adds subdirectory-based prompt routing to Pi's existing prompt template system. A folder of `.md` files under `prompts/` becomes a single `/command` with Tab-completable subcommands, an interactive menu on bare invocation, and guided input for missing arguments.

```
prompts/
├── workspace.md              # /workspace       (flat, native Pi)
├── superset/
│   ├── _index.md             # optional group metadata / help content
│   ├── create.md             # /superset create
│   ├── list.md               # /superset list
│   └── tasks.md              # /superset tasks
```

Each `.md` file uses the same frontmatter and `$1`/`$@` arg syntax as native Pi prompt templates. Bare `/command` opens an interactive menu for nested prompts, and prompts with missing arguments should collect input before expansion.

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
