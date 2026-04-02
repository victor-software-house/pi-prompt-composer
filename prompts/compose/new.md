---
description: Create a new grouped prompt set
args:
  - name: group-name
    required: true
    hint: Name for the new command group (kebab-case)
---
Create a new grouped prompt set named `$1`.

Before generating files:

1. Confirm where it should live — user prompts (`~/.pi/agent/prompts/`) or project prompts (`.pi/prompts/`)
2. Check for naming conflicts with existing groups or Pi commands
3. Determine the subcommands needed (aim for 2–6 focused operations)

Generate the complete file set:

- `$1/_index.md` with `type: group` and a clear `description`
- One `.md` file per subcommand with `description` in frontmatter
- Add `args` metadata only when the prompt needs operator-provided values

Each subcommand should perform one focused operation. Use kebab-case filenames. Include `description` frontmatter in every file.

If the compose-grouped-prompts skill is available, follow its conventions for naming, layout, and frontmatter.

Output each file with its full relative path and complete content.
