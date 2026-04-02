---
description: Remove or simplify subcommands from a grouped prompt set
args:
  - name: group-name
    required: true
    hint: Name of the command group to modify
  - name: subcommand
    required: false
    hint: Subcommand to remove (optional — will show a list if missing)
---
Remove or simplify subcommands in the `$1` grouped prompt set.

## Step 1 — Read the existing group

Find and read the current group directory:

```bash
for d in ~/.pi/agent/prompts/$1 .pi/prompts/$1; do
  [ -d "$d" ] && echo "Found: $d" && ls "$d"
done
```

If the directory doesn't exist, stop and tell the user.

## Step 2 — Identify what to remove

If a subcommand name was provided (`$2`), target that file directly.

If no subcommand was specified, use `ask_user` to let the operator choose:

```json
{
  "question": "Which subcommand should I remove from /$1?",
  "context": "Current subcommands: <list them from Step 1 with descriptions>",
  "options": [
    <one option per subcommand, e.g.:>
    { "title": "<name>", "description": "<description from frontmatter>" }
  ],
  "allowFreeform": true,
  "allowMultiple": true
}
```

## Step 3 — Check references

Before removing, search for references to the target subcommand:

```bash
# Check if other prompts, docs, or scripts reference this subcommand
grep -r "/$1 $2" .pi/ docs/ README.md 2>/dev/null
grep -r "$2" <group-directory>/*.md 2>/dev/null
```

If references exist, report them and include updates in the change plan.

## Step 4 — Confirm approach

Use `ask_user` to confirm the action:

```json
{
  "question": "How should I handle /$1 $2?",
  "context": "<references found or 'No references found to this subcommand'>",
  "options": [
    { "title": "Delete", "description": "Remove the .md file entirely" },
    { "title": "Merge into another subcommand", "description": "Move useful content into an existing subcommand" },
    { "title": "Simplify", "description": "Keep the subcommand but reduce its scope" },
    { "title": "Cancel", "description": "Don't remove anything" }
  ],
  "allowFreeform": true
}
```

## Step 5 — Apply the change

Based on the confirmed approach:

- **Delete**: Remove the `.md` file. If it was the last subcommand, ask whether to remove the entire group directory.
- **Merge**: Move useful content into the target subcommand, update its description to reflect broader scope.
- **Simplify**: Edit the prompt body to reduce scope while keeping the subcommand name.

After applying:

- Verify the group still has at least one subcommand
- Update `_index.md` description if the group's overall scope changed
- Update any references found in Step 3

Output all changed or deleted files with their full paths.
