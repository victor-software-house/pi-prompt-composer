---
description: Remove or simplify a subcommand from a group
args:
  - name: group-name
    required: true
    hint: Name of the command group to modify
---
Remove or simplify a subcommand in the `$1` grouped prompt set.

Before making changes:

1. Read the existing `$1/` directory and list all subcommands
2. Identify which subcommand(s) to remove or simplify
3. Check whether other prompts, docs, or scripts reference the target
4. Determine the approach: delete, merge into another subcommand, or simplify

Apply the change:

- **Delete**: Remove the `.md` file. If it was the last subcommand, confirm whether to remove the entire group.
- **Merge**: Move useful content into another subcommand and update its description.
- **Simplify**: Reduce the prompt body while keeping the subcommand name.

After the change:

- Verify the group still has at least one subcommand
- Update `_index.md` description if the group scope changed
- Update any references to the removed subcommand

If the compose-grouped-prompts skill is available, follow its removal playbook.

Output all changed files with their full paths and complete content.
