# Frontmatter and Arguments

## `_index.md` frontmatter

Required fields:

```yaml
type: group           # must be exactly "group"
description: ...      # recommended — shown in menus and autocomplete
```

No other fields are used by the extension today. Additional fields are preserved but ignored.

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
