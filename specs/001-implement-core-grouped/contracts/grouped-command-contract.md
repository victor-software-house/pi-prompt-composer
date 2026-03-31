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

### Invalid metadata handling

- A group directory without `_index.md` or with `_index.md` lacking `description` frontmatter is skipped during discovery with a diagnostic notification.
- A nested prompt file missing `description` frontmatter or with a missing/malformed `args` array is skipped during discovery with a diagnostic notification.
- If all nested prompts in a group are skipped due to invalid metadata, the group itself is not registered.

## Naming Contract

### Group command name

- Source: first-level directory name
- Registered as: `/<group>`

### Nested prompt name

- Source: markdown filename stem, normalized to lowercase kebab-case.
- Invoked as: `/<group> <subcommand>`
- Normalization example: `My Summary.md` → `my-summary`.
- After normalization, subcommand names should not require quoting under normal usage.

## Description Contract

### Group description

- Source: `_index.md` frontmatter `description` (required).
- A group directory without `_index.md` or with `_index.md` lacking a `description` field is skipped during discovery and not registered as a grouped command. The extension emits a diagnostic notification identifying the skipped directory.

### Nested prompt description

- Source: prompt frontmatter `description` (required).
- A nested prompt file missing `description` frontmatter is skipped during discovery and excluded from its group's runnable prompts. The extension emits a diagnostic notification identifying the skipped file.

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

1. Parse arguments with a local `parseCommandArgs()` (reimplemented near-verbatim from `@mariozechner/pi-coding-agent@0.64.0` internal `core/prompt-templates.ts`).
2. Treat the first parsed token as the nested prompt name.
3. Treat remaining parsed tokens as prompt arguments.
4. Render the prompt body with a local `substituteArgs()` (same source provenance).
5. Send the rendered content as a visible user message with `pi.sendUserMessage()`.

### Bare command selection

```text
/group
```

Behavior:

1. Open a selector listing nested prompt options for the effective group.
2. Each selector item shows the normalized subcommand name and its required description. When a nested prompt declares required arguments in its `args` metadata, the selector item appends a parenthetical hint listing those argument names (e.g., `fix — Propose a fix (issue, constraints?)`).
3. Resolve the selected option back to the matching nested prompt.
4. Render and dispatch it as a visible user message. If the selected prompt requires arguments and none were provided, the prompt body is sent with unsubstituted placeholders, consistent with NG-001 (no guided argument collection in this slice).

### Busy-session behavior

- If the agent is already streaming, grouped-prompt dispatch should queue via `pi.sendUserMessage(..., { deliverAs: 'followUp' })`.

## Autocomplete Contract

- `getArgumentCompletions()` returns nested prompt names filtered by the current prefix.
- Each completion item includes the subcommand name and its required description. When a nested prompt declares required arguments, the completion description appends a parenthetical hint listing those argument names.
- This first slice only guarantees subcommand completion, not prompt-argument completion.

## Error Contract

### Unknown subcommand

The command must provide package-owned corrective feedback that:

- names the current group command
- echoes the unknown subcommand value
- lists the available nested prompt names for that group

### Empty or unsupported layouts

- Empty groups are not registered.
- Unsupported deeper layouts are ignored in this slice rather than exposed as partial command trees.
