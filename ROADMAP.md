# Roadmap

## PPC-001: Directory scanner

Scan `~/.pi/agent/prompts/` and `.pi/prompts/` for subdirectories containing `.md` files. Build an in-memory registry of grouped commands, each mapping a directory name to its set of subcommand templates.

Acceptance criteria:

- discovers subdirectories in both global and project prompt locations
- loads `.md` files with frontmatter parse (reuse Pi's `parseFrontmatter`)
- ignores flat `.md` files (those are handled natively by Pi)
- re-scans on `session_start` with reason `reload`

## PPC-002: Command registration

For each discovered directory, register a single Pi extension command via `pi.registerCommand()`. The command name matches the directory name.

Acceptance criteria:

- one `/command` per subdirectory
- `getArgumentCompletions` returns subcommand names from the directory listing (excluding `_index.md`)
- `description` pulled from `_index.md` frontmatter if present, otherwise from the directory name
- does not conflict with flat prompt templates of the same name (extension commands take priority)

## PPC-003: Subcommand dispatch and arg substitution

Handler parses the first positional arg as the subcommand, finds the matching `.md` template, runs arg substitution on the body, and sends the expanded text as a user message via `pi.sendUserMessage()`.

Acceptance criteria:

- `/superset create` loads `superset/create.md`, substitutes `$1` onwards from remaining args
- `/superset` with no subcommand loads `_index.md` if present, otherwise lists available subcommands via `ctx.ui.notify`
- unknown subcommand shows error with available options
- expanded text renders as rich Markdown in the user message bubble (same as native prompt templates)
- arg syntax compatible with Pi: `$1`, `$@`, `${@:N}`, `${@:N:L}`

## PPC-004: Scope and source info

Preserve correct scope attribution so `/commands` listing shows the right source and scope for grouped commands.

Acceptance criteria:

- commands from `~/.pi/agent/prompts/*/` show scope `user`
- commands from `.pi/prompts/*/` show scope `project`
- description shown in autocomplete matches `_index.md` frontmatter description

## PPC-005: Documentation and example prompts

Ship example prompt directories demonstrating the pattern. Document the directory convention, `_index.md` fallback, and arg substitution rules.

Acceptance criteria:

- `README.md` covers install, usage, directory convention, and arg syntax
- at least one example prompt directory included (e.g., `examples/superset/`)
