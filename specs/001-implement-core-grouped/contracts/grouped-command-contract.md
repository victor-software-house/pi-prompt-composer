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
2. It contains an `_index.md` with `type: group` in frontmatter.
3. It contains at least one `.md` file other than `_index.md`.

### Ignored content

- Flat `.md` files at the prompt-root level
- Non-markdown files inside a group directory
- Directories nested deeper than `<root>/<group>/...`
- `_index.md` as a runnable prompt target

### Metadata handling

- **Hard gate**: `_index.md` must exist with `type: group` frontmatter. Without this, the directory is not a prompt group.
- **Soft (warn + fallback)**: `description` on `_index.md` — warn if missing, fall back to directory name. `description` on nested prompts — warn if missing, fall back to filename stem.
- **Optional (silent)**: `args` array on nested prompts — show hints if present, nothing if absent, warn only if present but malformed. `name` override on nested prompts — use if present, otherwise filename stem (kebab-case).
- **Never skip a nested prompt** for missing or malformed metadata. Every `.md` file (except `_index.md`) is always registered.

## Naming Contract

### Group command name

- Source: first-level directory name, used as-is (no normalization applied).
- Registered as: `/<group>`

### Nested prompt name

- Source: markdown filename stem, normalized to lowercase kebab-case.
- Invoked as: `/<group> <subcommand>`
- Normalization example: `My Summary.md` → `my-summary`.
- After normalization, subcommand names should not require quoting under normal usage.
- When a `name` override is provided in nested prompt frontmatter, it is used verbatim (no kebab-case normalization applied).

## Description Contract

### Group description

- Source: `_index.md` frontmatter `description`.
- Fallback: directory name (with a warning).

### Nested prompt description

- Source: prompt frontmatter `description`.
- Fallback: filename stem (with a warning).

## Precedence Contract

### Duplicate group names across scopes

- The system warns about the conflict.
- No package-owned precedence logic is enforced — Pi's own command registration order determines which wins.
- Scope metadata is preserved in registry data for diagnostic purposes.

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
2. Each selector item shows the subcommand name and its description (frontmatter or fallback). When a nested prompt declares arguments in its `args` metadata, the selector item appends a parenthetical hint listing those argument names (e.g., `fix [issue, constraints?] Propose a fix`).
3. Resolve the selected option back to the matching nested prompt.
4. Render and dispatch it as a visible user message. If the selected prompt requires arguments and none were provided, the prompt body is sent with unsubstituted placeholders, consistent with NG-001 (no guided argument collection in this slice).

### Busy-session behavior

- If the agent is already streaming, grouped-prompt dispatch should queue via `pi.sendUserMessage(..., { deliverAs: 'followUp' })`.

## Autocomplete Contract

- `getArgumentCompletions()` returns nested prompt names filtered by the current prefix.
- Each completion item includes the subcommand name and its description (frontmatter or fallback). When a nested prompt declares arguments in `args` metadata, the completion appends a hint listing those argument names.
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
