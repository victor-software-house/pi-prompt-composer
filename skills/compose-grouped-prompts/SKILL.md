---
description: >
  Create, extend, and maintain grouped slash-command prompt sets for pi-prompt-composer.
  Use when creating a new grouped prompt group, adding subcommands to an existing group,
  removing or simplifying subcommands, understanding grouped-prompt layout and frontmatter
  conventions, or deciding between grouped prompts, flat prompts, and skills.
  Triggers on "compose grouped prompts", "create prompt group", "add subcommand",
  "remove subcommand", "grouped prompt conventions", "_index.md", "type: group",
  "/compose new", "/compose add", "/compose remove".
---

# Compose Grouped Prompts

Create, extend, and maintain grouped slash-command prompts for `pi-prompt-composer`.

## When to use this skill

Use when the operator asks to:

- create a new set of grouped prompts (`/group subcommand` style)
- add subcommands to an existing group
- remove or simplify subcommands
- understand grouped-prompt conventions, layout, or frontmatter
- decide between grouped prompts, flat prompts, or skills

Do **not** use for flat Pi prompt templates — those are Pi-native and need no special tooling.

## Workflow map

```
Operator request
  │
  ├─ "create a new group"      → Workflow A: Create
  ├─ "add subcommand to X"     → Workflow B: Add
  ├─ "remove/simplify X"       → Workflow C: Remove
  └─ "how does this work?"     → Workflow D: Reference
```

## Required first checks

Before generating any files:

1. **Check prerequisites.** Verify recommended packages (e.g., `pi-ask-user`) are installed. If the `ask_user` tool is missing, a persistent warning banner will appear with install instructions.
2. **Identify the target prompt root.** User prompts live in `~/.pi/agent/prompts/`. Project prompts live in `.pi/prompts/`. Use `ask_user` if ambiguous.
3. **Scan for existing groups.** Check whether the group name already exists. Report conflicts before proceeding.
4. **Confirm scope.** A group name must not collide with a flat Pi prompt template the operator wants to keep.

## Interaction model

Use structured `ask_user` calls for:

- choosing the operation when the request is ambiguous
- resolving naming conflicts with existing groups or Pi commands
- confirming destructive operations (removals, renames)
- selecting between multiple valid file layouts

`ask_user` requires the `pi-ask-user` package to be installed separately (`pi install npm:pi-ask-user`). The extension shows a persistent warning banner when required tools are missing.

**Critical rule:** When writing `ask_user` calls, always include the **exact JSON payload** — `question`, `context`, `options`, and `allowFreeform`. Do not write "ask the user" without the literal tool call. The compose prompts (`/compose new`, `/compose add`, `/compose remove`) contain exact JSON examples for every interaction point.

**Escaping rule:** Pi substitutes `$1`, `$2`, `$@`, `$ARGUMENTS`, and `${@:N}` everywhere in prompt template bodies — including inside code blocks and instructional text. When a compose prompt or a generated prompt needs to mention substitution syntax literally (e.g., documenting that a prompt should use `$1`), escape with `\$`: write `\$1` in the source so the rendered output contains literal `$1`. This applies to:

- The quality rules sections in `/compose new` and `/compose add` that teach the model about substitution
- Any generated prompt that references substitution syntax in its instructions
- Example snippets showing how to write prompt bodies

## Quality bar for generated prompts

Every subcommand `.md` file produced by the compose workflows **must** include:

1. **`description` in frontmatter** — concise, menu-friendly. Quote values containing colons or brackets.
2. **`args` when needed** — each with `name`, `required`, and `hint`. Quote `hint` values containing colons.
3. **`order` in `_index.md`** — list subcommand names in the desired display order. Unlisted subcommands are appended alphabetically.
4. **Actionable body** — specific step-by-step instructions, not vague guidance
5. **Exact `ask_user` JSON** — when the subcommand needs operator input during execution, include the literal tool call payload. Never write "ask the user" without the JSON.
6. **Verification steps** — at least one `bash` block that confirms success
7. **Error handling** — what to do when the target doesn't exist, a name collides, or results are empty
8. **Output format** — specify what the model reports (table, summary, file list)
9. **Substitution syntax** — when the generated prompt uses args, the body must reference them with `$1`, `$2`, `$@`, or `${@:N}` so operator input flows into the rendered prompt

See the compose prompts themselves (`prompts/compose/new.md`, `prompts/compose/add.md`) for good-vs-bad examples.

## Stop conditions

Stop and ask before:

- overwriting an existing group without explicit confirmation
- removing subcommands that other prompts reference
- creating a group name that shadows a built-in Pi command
- generating more than 6 subcommands without confirming the scope

## Workflows

### Workflow A — Create a new grouped prompt set

1. Use `ask_user` to confirm scope (user vs project prompts)
2. Check for naming conflicts (existing groups, built-in commands)
3. Gather subcommand plan with `ask_user` confirmation
4. Confirm display order with `ask_user` — the confirmed order becomes the `order` field in `_index.md`
5. Decide args per subcommand (use `ask_user` when ambiguous)
6. Generate files following the quality bar above
   - For any subcommand that requires confirmation or user input during execution, include the full `ask_user` JSON payload inline in the body — not prose like "confirm with the user". See [references/args-and-frontmatter.md](references/args-and-frontmatter.md#interactive-prompt-bodies) and [references/examples.md](references/examples.md#example-3-interactive-group-with-confirmation-and-choices).
7. Verify with bash checks
8. Commit and report with a summary table

See: [references/workflow.md](references/workflow.md), [references/layout.md](references/layout.md)

### Workflow B — Add subcommands to an existing group

1. Read all existing subcommands — note style, tone, field order, and current `order` in `_index.md`
2. Propose additions with `ask_user` confirmation
3. Check for name collisions with existing subcommands
4. Generate files that **match the existing group's style exactly**
   - For any subcommand that requires confirmation or user input during execution, include the full `ask_user` JSON payload inline in the body. See [references/args-and-frontmatter.md](references/args-and-frontmatter.md#interactive-prompt-bodies).
5. Update `_index.md` `order` array — extract current order with `grep`, confirm placement with `ask_user`
6. Verify and commit

See: [references/operations.md](references/operations.md)

### Workflow C — Remove or simplify

1. Read the existing group directory
2. Use `ask_user` to select the target if not specified
3. Check for references (other prompts, docs, scripts)
4. Use `ask_user` to confirm action: delete, merge, simplify, or cancel
5. Apply change, update references
6. Update `_index.md` — remove deleted name from `order` array, update `description` if scope changed
7. Verify, commit

See: [references/operations.md](references/operations.md)

### Workflow D — Reference / help

Answer questions about:

- file layout conventions → [references/layout.md](references/layout.md)
- naming rules → [references/naming.md](references/naming.md)
- frontmatter and args → [references/args-and-frontmatter.md](references/args-and-frontmatter.md)
- examples → [references/examples.md](references/examples.md)
- when to use grouped prompts vs flat prompts vs skills → see below

### Grouped prompts vs flat prompts vs skills

| Mechanism | Best for |
|-----------|----------|
| Flat prompt (`.md` in prompts root) | Single reusable prompt, no subcommands |
| Grouped prompt (directory with `_index.md`) | Related prompts under one `/command` |
| Skill (`SKILL.md` + references) | Deep workflow guidance loaded on demand |

## Reference map

Detailed conventions and playbooks live in `references/`:

| File | Content |
|------|---------|
| [workflow.md](references/workflow.md) | End-to-end creation workflow |
| [layout.md](references/layout.md) | Directory structure and file conventions |
| [naming.md](references/naming.md) | Group and subcommand naming rules |
| [args-and-frontmatter.md](references/args-and-frontmatter.md) | Frontmatter fields, args metadata, substitution syntax |
| [operations.md](references/operations.md) | Add, remove, and migrate playbooks |
| [examples.md](references/examples.md) | Realistic grouped prompt examples |
