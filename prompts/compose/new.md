---
description: Create a new grouped prompt set from scratch
args:
  - name: group-name
    required: true
    hint: Name for the new command group (kebab-case)
  - name: description
    required: false
    hint: What this group is for (optional — will ask if missing)
---
Create a new grouped prompt set named `$1`.

## Step 1 — Determine scope

Use `ask_user` to confirm where the group should live:

```json
{
  "question": "Where should the /$1 group live?",
  "context": "User prompts (~/.pi/agent/prompts/) are personal and available everywhere. Project prompts (.pi/prompts/) are shared via the repo.",
  "options": [
    { "title": "Project (.pi/prompts/$1/)", "description": "Shared with the team via git" },
    { "title": "User (~/.pi/agent/prompts/$1/)", "description": "Personal, available in all projects" }
  ],
  "allowFreeform": false
}
```

## Step 2 — Check for conflicts

Before creating anything, verify the name is available:

```bash
# Check both prompt roots for existing group
ls -d ~/.pi/agent/prompts/$1/ .pi/prompts/$1/ 2>/dev/null
```

If the directory exists, stop and tell the user. Suggest `/compose add $1` instead.

## Step 3 — Gather subcommands

If a description was provided (`${@:2}`), use it as context for proposing subcommands.

Use `ask_user` to confirm the subcommand plan:

```json
{
  "question": "What subcommands should /$1 have?",
  "context": "Based on: ${@:2}\n\nEach subcommand should perform one focused operation. Aim for 2–6. I'll propose a starting set — pick which to keep, or describe your own.",
  "options": [
    { "title": "Use proposed set", "description": "I'll generate the subcommands listed above" },
    { "title": "Modify the set", "description": "I'll describe what I want instead" }
  ],
  "allowFreeform": true
}
```

If no description was provided, ask directly:

```json
{
  "question": "What should /$1 do? Describe the purpose and I'll propose subcommands.",
  "allowFreeform": true
}
```

## Step 4 — Decide on args

For each subcommand, determine whether it needs `args` metadata:

- Use `args` when the prompt needs operator-provided values to be useful (file paths, names, specific targets)
- Skip `args` when the prompt is self-contained or the model will gather context naturally

## Step 5 — Generate files

Create the complete file set in the confirmed location:

1. `_index.md` with `type: group` and a clear `description`
2. One `.md` file per confirmed subcommand with:
   - `description` in frontmatter (concise, shown in menus)
   - `args` metadata when needed (each with `name`, `required`, `hint`)
   - A focused prompt body using `$1`, `$2`, `$ARGUMENTS` substitution where appropriate

Use kebab-case filenames. Output each file with its full relative path and complete content.

## Conventions

- Group names: lowercase kebab-case, 1–3 words, no collisions with Pi built-in commands
- Subcommand names: short verbs or verb phrases (`create`, `list`, `run-tests`)
- Descriptions: one line, enough to choose between subcommands in a menu
- Bodies: actionable instructions, not vague guidance
