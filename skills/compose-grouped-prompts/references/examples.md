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

## Anti-patterns

### Too many subcommands

❌ A group with 12 subcommands covering unrelated tasks. Split into focused groups.

### Duplicate purpose

❌ `/review quick` and `/review fast` that do the same thing. Pick one name.

### Missing `_index.md`

❌ A directory without `_index.md` is not recognized as a group. Always include it.

### Vague descriptions

❌ `description: Does stuff` — Write descriptions that help the operator choose between subcommands.
