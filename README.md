# pi-prompt-composer

Folder-nested prompt routing extension for [Pi](https://github.com/badlogic/pi-mono).

## What it does

Adds subdirectory-based prompt routing to Pi's existing prompt template system. A folder of `.md` files under a prompt root becomes a single `/command` with Tab-completable subcommands, an interactive selector on bare invocation, and Pi-native argument substitution.

```text
~/.pi/agent/prompts/          # user-scoped prompt root
├── workspace.md              # /workspace       (flat, native Pi)
├── review/
│   ├── _index.md             # group metadata (type: group required)
│   ├── summary.md            # /review summary
│   └── fix.md                # /review fix

<project>/.pi/prompts/        # project-scoped prompt root
├── deploy/
│   ├── _index.md             # group metadata
│   └── staging.md            # /deploy staging
```

Each nested `.md` file uses the same frontmatter and `$1`/`$@`/`$ARGUMENTS`/`${@:N}` arg syntax as native Pi prompt templates.

## Features

- **Direct dispatch**: `/review fix "some issue" preserve behavior` routes to `fix.md` with argument substitution
- **Bare-command selector**: `/review` opens an interactive menu listing all nested prompts
- **Autocomplete**: Tab-complete subcommand names after typing `/review `
- **Unknown-subcommand feedback**: Typos show available alternatives
- **Dual prompt roots**: Scans both `~/.pi/agent/prompts` and `<project>/.pi/prompts`
- **Flat prompt coexistence**: Existing flat `.md` prompt templates continue to work unchanged
- **Grouped command precedence**: If a grouped command name matches a flat prompt, the grouped command wins

## Prompt directory layout

### Required: `_index.md`

Every grouped prompt directory **must** have an `_index.md` with `type: group` in frontmatter. This is the hard gate — directories without it are not recognized as prompt groups.

```markdown
---
type: group
description: Review workflows
---
Optional help content shown nowhere currently.
```

### Nested prompt files

Every `.md` file (except `_index.md`) inside a group directory is registered as a subcommand.

```markdown
---
description: Summarize a change
args:
  - name: change
    required: true
    hint: What changed?
---
Summarize the following change:
$ARGUMENTS
```

### Frontmatter fields

| Field | Location | Required | Behavior when missing |
|---|---|---|---|
| `type: group` | `_index.md` | **Yes (hard gate)** | Directory is not a prompt group |
| `description` | `_index.md` | Recommended | Warns, falls back to directory name |
| `description` | nested `.md` | Recommended | Warns, falls back to filename stem |
| `args` | nested `.md` | Optional | No argument hints shown; silent |
| `name` | nested `.md` | Optional | Uses kebab-case filename stem |

- **`args`** items must each have `name` (string), `required` (boolean), and `hint` (string). Malformed arrays warn and are treated as absent.
- **`name`** overrides the filename stem as the subcommand name (used verbatim, no normalization).
- Subcommand names derived from filenames are normalized to **lowercase kebab-case** (e.g., `My Summary.md` → `my-summary`).
- Metadata issues **never** prevent a nested prompt from being registered.

## Duplicate groups

When the same group name exists in both user and project prompt roots, the extension warns but does not enforce its own precedence. Pi's command registration order determines which wins. Groups are not merged across scopes.

## Discovery refresh

Grouped prompt discovery runs when the extension loads or reloads. There is no per-keystroke or file-watch rescan in this version.

## Non-goals (this version)

- No guided collection for missing arguments (prompts dispatch with unsubstituted placeholders)
- No shell substitution or preprocessing
- No nesting deeper than `/group subcommand`
- No aliases or dynamic subcommands
- No numeric performance thresholds

## Package shape

```json
{
  "pi": {
    "extensions": ["./extensions"]
  }
}
```

## Install

```bash
pi install pi-prompt-composer
```

## Development

```bash
bun install
bun run typecheck
bun run lint
bun run test
```

Autofix:

```bash
bun run fix
```

Watch mode for tests:

```bash
bun run test:watch
```

## License

MIT
