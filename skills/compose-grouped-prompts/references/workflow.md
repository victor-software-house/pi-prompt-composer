# Creation Workflow

End-to-end steps for creating a new grouped prompt set.

## Step 1 — Define purpose

Before creating files, establish:

- **Who will use these prompts?** (you only, your team, all project contributors)
- **What task domain do they serve?** (code review, deployment, testing, etc.)
- **Where should they live?** User scope (`~/.pi/agent/composed/`) or project scope (`.pi/composed/`)

## Step 2 — Choose group name

The group name becomes the slash command: `/group-name`.

Rules:

- lowercase kebab-case (`my-group`, not `myGroup` or `My_Group`)
- short and descriptive (1–3 words)
- must not collide with existing Pi commands or other groups

## Step 3 — Design subcommands

List 2–6 subcommands. Each should:

- perform one focused operation
- have a clear, non-overlapping purpose
- use a short verb or noun as the name

If the list grows beyond 6, consider splitting into two groups.

## Step 4 — Write `_index.md`

Every group directory needs `_index.md`:

```markdown
---
description: Short description of what this group does
order: [subcommand-a, subcommand-b, subcommand-c]
---
```

The `description` is strongly recommended — it appears in menus and autocomplete. The `order` array is optional — it controls display order in autocomplete and the selector. Unlisted subcommands are appended alphabetically. No `type` marker is required under `composed/`.

## Step 5 — Write subcommand files

Each subcommand is a `.md` file in the group directory:

```markdown
---
description: What this subcommand does
args:
  - name: target
    required: true
    hint: Which item to operate on
---
Prompt body with $1 substitution and any instructions.
```

## Step 6 — Verify

After generating all files:

1. Check that the directory structure matches the layout convention
2. Confirm no naming conflicts with existing groups
3. Verify frontmatter parses correctly (no YAML syntax errors)
4. Test with `/group-name` to see the selector and `/group-name subcommand` for direct dispatch
