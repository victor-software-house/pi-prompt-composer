# Quickstart: Core Grouped Prompt Routing

This quickstart validates the first useful grouped-routing slice after implementation.

## 1. Prepare example prompt groups

Create one user-scoped group and one project-scoped override.

### User-scoped prompt group

Create `~/.pi/agent/prompts/review/` with:

`_index.md`

```md
---
description: Review workflows
---
Run one of the review prompts.
```

`summary.md`

```md
---
description: Summarize a change
args:
  - name: change
    required: true
    hint: What changed?
---
Summarize the following change:
$ARGUMENTS
```

### Project-scoped prompt group

Create `.pi/prompts/review/` in this repository with:

`_index.md`

```md
---
description: Repo-local review workflows
---
Use the project-scoped review prompts.
```

`fix.md`

```md
---
description: Propose a fix
args:
  - name: issue
    required: true
    hint: What needs fixing?
  - name: constraints
    required: false
    hint: Extra constraints to preserve
---
Propose a fix for:
$1

Constraints:
${@:2}
```

## 2. Reload Pi

Reload the runtime so the extension rescans grouped prompt directories.

## 3. Validate direct dispatch

Run:

```text
/review fix "grouped prompt bug" preserve flat prompt behavior
```

Expected result:

- `/review` resolves to the project-scoped group.
- `fix.md` is selected.
- The final user-visible message contains:
  - `grouped prompt bug` substituted into `$1`
  - `preserve flat prompt behavior` substituted into `${@:2}`

## 4. Validate bare-command discovery

Run:

```text
/review
```

Expected result:

- Pi opens a selector listing at least `fix`.
- The selector shows the normalized subcommand name plus its required description.
- Choosing `fix` dispatches the rendered prompt as a visible user message.

## 5. Validate coexistence with flat prompts

Create a flat prompt like `.pi/prompts/workspace.md` if one does not already exist, reload, and verify:

```text
/workspace anything
```

Expected result:

- The flat prompt still behaves as a native Pi prompt template.
- The grouped-routing extension does not interfere with unrelated flat prompt names.

## 6. Validate grouped command precedence over a same-name flat prompt

Create a flat prompt with the same root-level name as the grouped command:

`.pi/prompts/review.md`

```md
---
description: Flat review prompt
---
This flat prompt should not win when the grouped `/review` command exists.
```

Reload Pi and verify:

```text
/review fix "grouped prompt bug" preserve flat prompt behavior
```

Expected result:

- The grouped `/review` command still wins over the flat `review.md` prompt.
- `fix.md` inside the grouped `review/` directory is selected.
- The flat `review.md` prompt is not dispatched for this command.

## 7. Validate duplicate precedence

With both user and project `review/` groups present, verify:

- `/review` uses the project-scoped description and nested prompts.
- User-scoped `review/summary.md` is not merged into the effective project group.
- If Pi surfaces scope markers in grouped command listings, the winning command is labeled with compact markers such as `[p]` or `[u]` at the listing level.

## 8. Validate unknown-subcommand feedback

Run:

```text
/review unknown
```

Expected result:

- Pi shows corrective feedback naming the valid nested prompts for `/review`.

## 9. Validate required grouped metadata and argument hints

Verify that grouped prompt metadata is author-provided and not derived:

- `_index.md` must include `description`.
- Nested prompt files must include `description` and `args[]` items with `name`, `required`, and `hint`.
- Grouped UX shows the prompt description and exposes the configured argument hints as parenthetical hints in selector items and autocomplete (e.g., `fix — Propose a fix (issue, constraints?)`).
- Bare-command selector dispatch sends the prompt body with unsubstituted placeholders when no arguments are provided, consistent with NG-001.

### 9a. Validate invalid metadata is skipped with diagnostics

Create a group directory with an invalid nested prompt to verify skip+diagnostic behavior:

1. Create `.pi/prompts/broken/` with a valid `_index.md`:

```md
---
description: Broken test group
---
```

2. Add `good.md` with valid metadata:

```md
---
description: A good prompt
args:
  - name: input
    required: true
    hint: Some input
---
Do something with $1
```

3. Add `bad.md` with **missing** `args` array:

```md
---
description: A bad prompt with no args
---
This prompt has no args metadata.
```

4. Reload Pi and verify:
   - The `/broken` grouped command is registered (because `good.md` is valid).
   - `bad.md` is **not** listed as a subcommand.
   - A diagnostic notification was emitted identifying `bad.md` and the reason it was skipped.

5. Now remove `good.md` so only `bad.md` remains. Reload and verify:
   - The `/broken` grouped command is **not** registered (zero valid nested prompts).
   - A diagnostic notification was emitted identifying the skipped directory.

### 9b. Validate missing `_index.md` skips the group

Create `.pi/prompts/noindex/` with a valid nested prompt but **no** `_index.md`. Reload and verify:

- The `/noindex` grouped command is **not** registered.
- A diagnostic notification was emitted identifying the missing `_index.md`.

## 10. Run repository validation

From the repository root:

```bash
bun install
bun run fix
bun run typecheck
bun run lint
```

