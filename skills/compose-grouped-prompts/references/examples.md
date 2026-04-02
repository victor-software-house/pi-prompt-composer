# Examples

## Example 1: Code review group

A project-scoped group for code review workflows.

### Directory

```
.pi/prompts/review/
├── _index.md
├── summary.md
├── checklist.md
└── fix.md
```

### `_index.md`

```markdown
---
type: group
description: Code review workflows
---
```

### `summary.md`

```markdown
---
description: Summarize changes in a file or directory
args:
  - name: path
    required: true
    hint: File or directory to review
---
Review the code at `$1` and provide:

1. A one-paragraph summary of what changed
2. Key architectural decisions
3. Potential concerns or risks

Keep the summary concise and actionable.
```

### `checklist.md`

```markdown
---
description: Run a review checklist against changes
args:
  - name: path
    required: true
    hint: File or directory to check
---
Review `$1` against this checklist:

- [ ] No hardcoded secrets or credentials
- [ ] Error handling is present and meaningful
- [ ] New public APIs have documentation
- [ ] Tests cover the main success and failure paths
- [ ] No obvious performance regressions

Report each item as pass/fail with a brief note.
```

### `fix.md`

```markdown
---
description: Apply review feedback to a file
args:
  - name: file
    required: true
    hint: File to fix
  - name: feedback
    required: true
    hint: Specific feedback to address
---
Apply the following review feedback to `$1`:

$2

Make minimal, targeted changes. Explain each change briefly.
```

## Example 2: Minimal group (no args)

A user-scoped group for daily standup helpers.

### Directory

```
~/.pi/agent/prompts/standup/
├── _index.md
├── prep.md
└── summary.md
```

### `_index.md`

```markdown
---
type: group
description: Daily standup helpers
---
```

### `prep.md`

```markdown
---
description: Prepare standup notes from recent git activity
---
Look at the git log from the last 24 hours in this repository.

Summarize:
- What I completed yesterday
- What I'm working on today
- Any blockers

Format as bullet points suitable for a standup update.
```

### `summary.md`

```markdown
---
description: Summarize the team's standup notes
---
Read the standup notes I'm about to paste and produce:

1. A one-line summary per person
2. Shared blockers or dependencies
3. Suggested follow-ups

Keep it brief.
```

## Example 3: Interactive group with confirmation and choices

A user-scoped group that manages a tracked list — demonstrates `ask_user` inside destructive and choice-driven prompt bodies.

### Directory

```
~/.pi/agent/prompts/wip/
├── _index.md
├── list.md
├── close.md
└── update.md
```

### `_index.md`

```markdown
---
type: group
description: Track active Pi sessions in the vault — list, update, and close session rows
---
```

### `list.md` (no interactivity — passive read)

```markdown
---
description: Display active session table and flag rows older than 24 hours
---
Read `~/workspace/obsidian-vault/Tools/Pi/Active Sessions.md` and display the full session table.

For each row, compute its age from the Started timestamp relative to the current time (`date`). Flag any session older than 24 hours as potentially stale.

End with a one-line summary: total sessions, combined cost, and any staleness warnings.
```

### `close.md` (destructive — requires `ask_user` confirmation)

````markdown
---
description: Remove a completed or stale session row from the vault
args:
  - name: session
    required: true
    hint: Session name or ID prefix to close
---
Close the `$1` session in `~/workspace/obsidian-vault/Tools/Pi/Active Sessions.md`.

Match the row by Name (partial, case-insensitive) or leading ID characters. Show the matched row, then use `ask_user` to confirm:

```json
{
  "question": "Remove this session from the vault?",
  "context": "<show the matched row here>",
  "options": [
    { "title": "Yes, remove it" },
    { "title": "Cancel" }
  ],
  "allowFreeform": false
}
```

If confirmed, delete the row, write the file back, and report the remaining session count and combined cost.
````

### `update.md` (choice-driven — requires `ask_user` for field selection)

````markdown
---
description: Update a session row's cost, message count, or current task
args:
  - name: session
    required: true
    hint: Session name or ID prefix to update
---
Update the `$1` session in `~/workspace/obsidian-vault/Tools/Pi/Active Sessions.md`.

Match the row by Name (partial, case-insensitive) or leading ID characters. Then use `ask_user` to collect what to change:

```json
{
  "question": "Which fields should be updated for $1?",
  "options": [
    { "title": "Doing", "description": "Update the current task description" },
    { "title": "Messages", "description": "Update the message count" },
    { "title": "Cost", "description": "Update the session cost" }
  ],
  "allowFreeform": true,
  "allowMultiple": true
}
```

Apply the selected changes, write the file back, and confirm the updated row.
````

## Anti-patterns

### Too many subcommands

✘ A group with 12 subcommands covering unrelated tasks. Split into focused groups.

### Duplicate purpose

✘ `/review quick` and `/review fast` that do the same thing. Pick one name.

### Missing `_index.md`

✘ A directory without `_index.md` is not recognized as a group. Always include it.

### Vague descriptions

✘ `description: Does stuff` — Write descriptions that help the operator choose between subcommands.
