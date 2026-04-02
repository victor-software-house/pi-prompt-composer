---
description: Add subcommands to an existing grouped prompt set
args:
  - name: group-name
    required: true
    hint: Name of the existing command group
  - name: description
    required: false
    hint: What the new subcommand(s) should do (optional — will ask if missing)
---
Add subcommands to the `$1` grouped prompt set.

## Step 1 — Read the existing group

Find and read the current group directory:

```bash
# Check both roots
for d in ~/.pi/agent/prompts/$1 .pi/prompts/$1; do
  [ -d "$d" ] && echo "Found: $d" && ls "$d"
done
```

If the directory doesn't exist in either root, stop and tell the user. Suggest `/compose new $1` instead.

Read all existing `.md` files to understand the current style:
- frontmatter shape (which fields, what order)
- description tone and length
- whether existing subcommands use `args` metadata
- naming convention

## Step 2 — Determine what to add

If a description was provided (`${@:2}`), use it to propose specific subcommands.

Use `ask_user` to confirm:

```json
{
  "question": "What subcommands should I add to /$1?",
  "context": "Existing subcommands: <list them from Step 1>\n\nBased on: ${@:2}\n\nI'll propose additions — confirm which to create, or describe your own.",
  "options": [
    { "title": "Use proposed additions", "description": "Create the subcommands listed above" },
    { "title": "Modify the list", "description": "I'll describe what I want instead" }
  ],
  "allowFreeform": true
}
```

If no description was provided, ask directly:

```json
{
  "question": "What subcommands should I add to /$1? Here are the existing ones: <list>",
  "allowFreeform": true
}
```

## Step 3 — Check for overlap

Before generating, verify the proposed names don't collide with existing subcommands. If there's overlap, flag it and ask whether to replace or rename.

## Step 4 — Generate files

Create new `.md` files that match the existing group's style:

- Same frontmatter fields and order as existing subcommands
- Consistent description tone
- Consistent `args` naming patterns if other subcommands use args
- Focused, non-overlapping operations

Output each new file with its full relative path and complete content.
