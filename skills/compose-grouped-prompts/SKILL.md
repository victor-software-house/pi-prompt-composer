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

1. **Identify the target prompt root.** User prompts live in `~/.pi/agent/prompts/`. Project prompts live in `.pi/prompts/`. Ask if ambiguous.
2. **Scan for existing groups.** Check whether the group name already exists. Report conflicts before proceeding.
3. **Confirm scope.** A group name must not collide with a flat Pi prompt template the operator wants to keep.

## Interaction model

### When `ask_user` is available

Use structured `ask_user` calls for:

- choosing the operation when the request is ambiguous
- resolving naming conflicts with existing groups or Pi commands
- confirming destructive operations (removals, renames)
- selecting between multiple valid file layouts

### When `ask_user` is not available

Ask the same questions directly in chat. Present numbered options and wait for a response before generating files.

## Stop conditions

Stop and ask before:

- overwriting an existing group without explicit confirmation
- removing subcommands that other prompts reference
- creating a group name that shadows a built-in Pi command
- generating more than 6 subcommands without confirming the scope

## Workflows

### Workflow A — Create a new grouped prompt set

1. Gather purpose and target audience (operator-facing? team-shared?)
2. Choose group name (lowercase kebab-case, no spaces)
3. Define 2–N subcommands with names and one-line descriptions
4. Generate `_index.md` with `type: group` and a `description`
5. Generate each subcommand `.md` file with frontmatter and body
6. Verify no naming overlap with existing groups

Output: file-by-file content with exact paths.

See: [references/workflow.md](references/workflow.md), [references/layout.md](references/layout.md)

### Workflow B — Add subcommands to an existing group

1. Read the existing group directory
2. List current subcommands
3. Identify gaps or overlap with proposed additions
4. Generate new `.md` files matching the existing style
5. Verify consistency: naming convention, frontmatter shape, description style

See: [references/operations.md](references/operations.md)

### Workflow C — Remove or simplify

1. Read the existing group directory
2. Determine whether to delete, merge, or deprecate
3. Check whether other prompts or docs reference the target
4. Confirm the change with the operator
5. Apply minimal edits; update `_index.md` if the group description needs revision

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
