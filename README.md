# pi-prompt-composer

Build multi-option slash commands from plain prompts — variable expansion, arg collection & interactive selectors for [Pi](https://github.com/badlogic/pi-mono).

<p align="center">
  <img src="assets/preview.png" alt="Grouped prompt selector preview" width="700">
</p>

Turn a directory of `.md` prompt files into a single `/command` with Tab-completable subcommands, a rich interactive selector, and automatic missing-argument collection.

## Quick start

```bash
# Install
pi install pi-prompt-composer

# Copy the bundled examples into your project prompt root
mkdir -p .pi/prompts/review
cp -r $(pi resolve pi-prompt-composer)/examples/prompts/review/* .pi/prompts/review/

# Reload Pi, then try:
#   /review           → interactive selector
#   /review summary   → asks for missing "change" arg, then sends
#   /review fix "bug" → dispatches immediately
```

## How it works

A folder with an `_index.md` (containing `type: group`) becomes a grouped command. Every other `.md` file in that folder becomes a subcommand.

```text
.pi/prompts/
├── workspace.md              ← flat Pi prompt, unchanged
├── review/
│   ├── _index.md             ← type: group  →  /review
│   ├── summary.md            ←                  /review summary
│   └── fix.md                ←                  /review fix
```

Both prompt roots are scanned:
- **User**: `~/.pi/agent/prompts/`
- **Project**: `<project>/.pi/prompts/`

Flat `.md` files outside group directories continue to work as native Pi prompts.

## Features

| Feature | Behavior |
|---------|----------|
| **Direct dispatch** | `/review fix "the bug"` → substitutes args, sends immediately |
| **Bare-command selector** | `/review` → rich TUI selector with aligned descriptions and dynamic usage hints |
| **Missing-arg collection** | Prompts with required `args` metadata pause and ask before sending |
| **Autocomplete** | Tab after `/review ` shows subcommand names with descriptions |
| **Unknown subcommand** | Typos show a warning with available alternatives |
| **Escape syntax** | `\$ARGUMENTS` renders as literal `$ARGUMENTS` |
| **Discovery warnings** | Malformed metadata surfaces as Pi notifications on session start |
| **Bundled `/compose`** | Built-in helpers for creating, extending, and simplifying grouped prompts |
| **Authoring skill** | Comprehensive `compose-grouped-prompts` skill loaded on demand for deep guidance |

## Bundled `/compose` command

The package ships a built-in `/compose` grouped command for authoring grouped prompts:

| Command | Purpose |
|---------|---------|
| `/compose` | Interactive selector for compose operations |
| `/compose new <group-name>` | Create a new grouped prompt set |
| `/compose add <group-name>` | Add subcommands to an existing group |
| `/compose remove <group-name>` | Remove or simplify a subcommand |

The bundled `/compose` is loaded with lowest precedence. If you create your own `compose/` group in user or project prompts, it overrides the built-in version.

### Required tools

The `/compose` prompts work best with [`pi-ask-user`](https://www.npmjs.com/package/pi-ask-user) installed — it provides the `ask_user` tool for interactive decision handshakes during prompt authoring. If required tools are missing, a persistent warning banner appears at session start:

```
 Missing tools: ask_user — run pi install pi-ask-user
```

### Authoring skill

The package also ships a `compose-grouped-prompts` skill with:

- Workflow guidance for creating, adding, and removing prompts
- Layout conventions and naming rules
- Frontmatter and args reference
- Realistic examples and anti-patterns

The skill is loaded on demand when the model needs deeper guidance beyond what the `/compose` prompts provide.

## Writing prompts

### `_index.md` (required)

```yaml
---
type: group
description: Review workflows
---
```

`type: group` is the hard gate — directories without it are ignored.

### Nested prompt files

```yaml
---
description: Summarize a change
args:
  - name: change
    required: true
    hint: What changed?
  - name: context
    required: false
    hint: Additional context
---
Summarize the following change:
$ARGUMENTS
```

**Argument syntax** is Pi-native: `$1`, `$2`, `$@`, `$ARGUMENTS`, `${@:N}`, `${@:N:L}`.

Use `\$` to escape a literal dollar sign (e.g., `\$ARGUMENTS` renders as `$ARGUMENTS`).

### `args` metadata

Each item needs:

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `name` | **yes** | — | Items without `name` are skipped with a warning |
| `required` | no | `false` | Whether the extension asks for this arg when missing |
| `hint` | no | `""` | Shown in the input prompt and selector usage hint |

Parsing is lenient — a missing `hint` or `required` won't break the prompt. Only a missing `name` drops that individual arg item.

## What this package owns vs Pi-native

| Concern | Owned by |
|---------|----------|
| Frontmatter parsing, arg syntax, substitution | **Pi** (reused) |
| Folder → command grouping, selector, arg collection | **pi-prompt-composer** |
| Flat `.md` prompt behavior | **Pi** (unchanged) |
| Command precedence (grouped wins over flat) | **Pi** (extension commands take precedence) |

## Known limitations

See [`docs/ISSUES.md`](docs/ISSUES.md) for tracked defects and status.

## Non-goals (this version)

- No shell substitution or preprocessing
- No nesting deeper than `/group subcommand`
- No aliases or dynamic subcommands

## Development

```bash
bun install
bun run typecheck && bun run lint && bun run test
```

Autofix: `bun run fix` · Watch: `bun run test:watch`

## Related packages

| Package | Description |
|---------|-------------|
| [`@victor-software-house/pi-openai-proxy`](https://www.npmjs.com/package/@victor-software-house/pi-openai-proxy) | OpenAI-compatible HTTP proxy for Pi's multi-provider model registry |

## License

[MIT](LICENSE)
