# Grouped Command Contract

## Purpose

Define the operator-visible contract for the first useful grouped prompt routing slice.

## Discovery Contract

### Supported prompt roots

- User scope: `~/.pi/agent/prompts`
- Project scope: `<repo>/.pi/prompts`

### Group qualification

A directory becomes a grouped command candidate when all of the following are true:

1. It is a first-level directory directly under one supported prompt root.
2. It contains at least one `.md` file other than `_index.md`.
3. At least one of those `.md` files can be loaded as a nested prompt.

### Ignored content

- Flat `.md` files at the prompt-root level
- Non-markdown files inside a group directory
- Directories nested deeper than `<root>/<group>/...`
- `_index.md` as a runnable prompt target

## Naming Contract

### Group command name

- Source: first-level directory name
- Registered as: `/<group>`

### Nested prompt name

- Source: markdown filename stem
- Invoked as: `/<group> <subcommand>`
- If the subcommand name contains spaces, direct invocation must quote it so Pi's `parseCommandArgs()` keeps it as one token.

## Description Contract

### Group description

Preferred order:

1. `_index.md` frontmatter `description`
2. First non-empty body line in `_index.md`
3. Group directory name

### Nested prompt description

Preferred order:

1. Prompt frontmatter `description`
2. First non-empty body line in the prompt body
3. Filename stem

## Precedence Contract

### Duplicate group names across scopes

- Project scope wins over user scope.
- Only one effective grouped command is registered for a given group name.
- The winning scope remains available in package-owned UX and registry data.

### Grouped command vs flat prompt conflict

- The grouped command wins because Pi executes extension commands before prompt-template expansion.
- Flat prompt behavior remains unchanged for non-conflicting names.

## Invocation Contract

### Direct execution

```text
/group subcommand arg1 arg2
/group "subcommand with spaces" arg1 arg2
```

Behavior:

1. Parse arguments with Pi's `parseCommandArgs()`.
2. Treat the first parsed token as the nested prompt name.
3. Treat remaining parsed tokens as prompt arguments.
4. Render the prompt body with Pi's `substituteArgs()`.
5. Send the rendered content as a visible user message with `pi.sendUserMessage()`.

### Bare command selection

```text
/group
```

Behavior:

1. Open a selector listing nested prompt options for the effective group.
2. Resolve the selected option back to the matching nested prompt.
3. Render and dispatch it as a visible user message.

### Busy-session behavior

- If the agent is already streaming, grouped-prompt dispatch should queue via `pi.sendUserMessage(..., { deliverAs: 'followUp' })`.

## Autocomplete Contract

- `getArgumentCompletions()` returns nested prompt names filtered by the current prefix.
- This first slice only guarantees subcommand completion, not prompt-argument completion.

## Error Contract

### Unknown subcommand

The command must provide corrective feedback that includes the available nested prompt names for the current group.

### Empty or unsupported layouts

- Empty groups are not registered.
- Unsupported deeper layouts are ignored in this slice rather than exposed as partial command trees.
