# Directory Layout

## Standard structure

```
composed/
├── flat-prompt.md              ← composer flat prompt: /flat-prompt
├── my-group/
│   ├── _index.md               ← required for groups: description + optional order
│   ├── create.md               ← subcommand: /my-group create
│   ├── list.md                 ← subcommand: /my-group list
│   └── delete.md               ← subcommand: /my-group delete
└── another-group/
    ├── _index.md
    ├── start.md
    └── stop.md
```

## Rules

### What makes a valid group

- A subdirectory of a prompt root
- Lives under `~/.pi/agent/composed/` or `.pi/composed/`
- Contains `_index.md`
- Contains at least one `.md` file besides `_index.md`

### What is ignored

- Native flat `.md` files in `prompts/` roots (Pi handles these natively)
- Non-`.md` files inside group directories
- Subdirectories inside group directories (no deep command nesting in v1)
- Files named `_index.md` are metadata, never subcommands

### Prompt roots

| Scope | Path | Purpose |
|-------|------|---------|
| User | `~/.pi/agent/composed/` | Personal composer prompts, available everywhere |
| Project | `.pi/composed/` | Project-specific composer prompts, shared via repo |

Both roots are scanned. Project scope overrides user scope when group names collide.

## File naming

- Use lowercase kebab-case for both directory and file names
- The filename stem (without `.md`) becomes the subcommand name
- A `name` field in frontmatter overrides the filename-derived name
- `_index.md` is reserved for group metadata and is never a subcommand
