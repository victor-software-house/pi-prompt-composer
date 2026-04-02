# Directory Layout

## Standard structure

```
prompts/
├── flat-prompt.md              ← Pi-native flat prompt (ignored by composer)
├── my-group/
│   ├── _index.md               ← required: type: group + description
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
- Contains `_index.md` with `type: group` in frontmatter
- Contains at least one `.md` file besides `_index.md`

### What is ignored

- Flat `.md` files in the prompt root (Pi handles these natively)
- Non-`.md` files inside group directories
- Subdirectories inside group directories (no deep nesting in v1)
- Files named `_index.md` without `type: group`

### Prompt roots

| Scope | Path | Purpose |
|-------|------|---------|
| User | `~/.pi/agent/prompts/` | Personal prompts, available everywhere |
| Project | `.pi/prompts/` | Project-specific prompts, shared via repo |

Both roots are scanned. Project scope overrides user scope when group names collide.

## File naming

- Use lowercase kebab-case for both directory and file names
- The filename stem (without `.md`) becomes the subcommand name
- A `name` field in frontmatter overrides the filename-derived name
- `_index.md` is reserved for group metadata and is never a subcommand
