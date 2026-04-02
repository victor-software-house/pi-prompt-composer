---
description: Add subcommands to an existing group
args:
  - name: group-name
    required: true
    hint: Name of the existing command group
---
Add one or more subcommands to the `$1` grouped prompt set.

Before generating files:

1. Read the existing `$1/` directory to understand current subcommands
2. Note the existing style: frontmatter shape, description tone, naming convention
3. Identify any overlap between proposed and existing subcommands

Generate new `.md` files that:

- Match the existing frontmatter style and description tone
- Use consistent argument naming if other subcommands have args
- Perform focused, non-overlapping operations
- Include `description` in frontmatter

If the compose-grouped-prompts skill is available, follow its conventions for consistency checks.

Output each new file with its full relative path and complete content.
