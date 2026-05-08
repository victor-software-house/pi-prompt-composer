# Frontmatter and Arguments

## `_index.md` frontmatter

Recommended fields:

```yaml
description: ...      # recommended — shown in menus and autocomplete
order: [new, add, remove]  # optional — custom subcommand display order
```

No `type: group` marker is required. A subfolder under `composed/` with `_index.md` is composer-owned by location.

`order` controls the display order in autocomplete and the TUI selector. Listed names appear first in the given order; unlisted subcommands are appended alphabetically. Omit for default alphabetical ordering.

## Subcommand frontmatter

```yaml
description: What this subcommand does     # recommended
name: override-name                        # optional — overrides filename-derived name
args:                                      # optional — defines expected arguments
  - name: target
    required: true
    hint: Which item to operate on
  - name: format
    required: false
    hint: Output format (json, table)
```

### Field details

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `description` | string | filename stem | Shown in selector and autocomplete |
| `name` | string | kebab-case filename | Overrides the subcommand name |
| `args` | array | none | Defines positional arguments |

### Args items

Each item in the `args` array:

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `name` | string | **required** | Argument display name |
| `required` | boolean | `false` | Whether the arg is collected interactively if missing |
| `hint` | string | `""` | Placeholder text shown in the input prompt |

Parsing is lenient:

- Missing `required` defaults to `false` with a warning
- Missing `hint` defaults to `""` with a recommendation warning
- Missing `name` rejects the item entirely
- Valid items in a partially malformed array are preserved

## Substitution syntax

Template bodies use Pi-native argument substitution:

| Syntax | Meaning |
|--------|---------|
| `$1`, `$2`, … | Positional argument by index |
| `$@` | All arguments joined by space |
| `$ARGUMENTS` | Same as `$@` |
| `${@:N}` | All arguments from position N onward |
| `${@:N:L}` | L arguments starting from position N |
| `\$` | Literal `$` (escaped) |

### Example

```markdown
---
description: Review a file
args:
  - name: file
    required: true
    hint: Path to the file to review
  - name: focus
    required: false
    hint: Specific area to focus on
---
Review the file at `$1`.

${ focus ? "Focus specifically on: $2" : "" }

Provide a summary and list any issues found.
Additional context: ${@:3}
```

**Note:** Conditional rendering (`${ expr }`) is not yet supported. The example above uses plain substitution — `$2` renders as empty string when not provided.

## When to use args

Use `args` when:

- The prompt needs operator-provided values to be useful
- You want guided interactive collection for missing values
- The substitution makes the prompt significantly more focused

Skip `args` when:

- The prompt is self-contained with no variable parts
- The operator will provide context naturally in conversation
- All arguments are optional and the prompt works without them

## Interactive prompt bodies

When a prompt body requires user confirmation or input collection during execution, use `ask_user` with the **full JSON payload** inline. Do not use prose like "ask the user", "confirm before proceeding", or "prompt for the value" — these are not actionable instructions for a model.

### Confirmation pattern (destructive or irreversible operations)

````markdown
Use `ask_user` to confirm before proceeding:

```json
{
  "question": "Remove the X session from the vault?",
  "context": "<show the matched row or relevant details here>",
  "options": [
    { "title": "Yes, remove it" },
    { "title": "Cancel" }
  ],
  "allowFreeform": false
}
```
````

### Choice pattern (selecting between options mid-operation)

````markdown
Use `ask_user` to collect the choice:

```json
{
  "question": "Which fields should be updated for $1?",
  "options": [
    { "title": "Doing", "description": "Update the current task description" },
    { "title": "Messages", "description": "Update the message count" },
    { "title": "Cost", "description": "Update the session cost" }
  ],
  "allowFreeform": true,
  "allowMultiple": true
}
```
````

### Input collection pattern (value only knowable at runtime)

````markdown
If the value isn't available in context, use `ask_user` to collect it:

```json
{
  "question": "What is the session ID?",
  "context": "The session ID is shown in the Pi session header.",
  "allowFreeform": true
}
```
````

### `ask_user` vs `args` — when to use which

| Situation | Use |
|-----------|-----|
| Value known upfront (path, name, ID) | `args` in frontmatter |
| Confirmation before irreversible action | `ask_user` payload in body |
| Choice between options mid-operation | `ask_user` payload in body |
| Value only knowable at runtime (e.g. session ID from context) | `ask_user` payload in body |

### Anti-patterns

✘ `"Confirm with the user before removing"` — vague prose; use an `ask_user` payload with options\
✘ `"Ask which fields to update"` — use an `ask_user` payload with an options array\
✘ `"Prompt for the session ID if unavailable"` — use an `ask_user` payload with `allowFreeform: true`
