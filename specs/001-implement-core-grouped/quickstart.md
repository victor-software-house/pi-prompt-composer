# Quickstart: Core Grouped Prompt Routing

This quickstart validates the first useful grouped-routing slice after implementation.

## 1. Prepare example prompt groups

Create one user-scoped group and one project-scoped override.

### User-scoped prompt group

Create `~/.pi/agent/prompts/review/` with:

`_index.md`

```md
---
type: group
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
type: group
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

## 7. Validate duplicate warning

With both user and project `review/` groups present, verify:

- The system emits a warning about the duplicate `review` group name.
- Both groups are registered — Pi's own command registration order determines which wins.
- User-scoped `review/summary.md` is not merged into the project group.

## 8. Validate unknown-subcommand feedback

Run:

```text
/review unknown
```

Expected result:

- Pi shows corrective feedback naming the valid nested prompts for `/review`.

## 9. Validate metadata handling and argument hints

Verify lenient metadata handling:

- `_index.md` must include `type: group` (hard gate).
- `description` on `_index.md` and nested prompts is recommended; when missing, the system warns and uses directory/file name as fallback.
- `args` array on nested prompts is optional; when present, show hints in selector and autocomplete (e.g., `fix [issue, constraints?] Propose a fix`).
- Bare-command selector dispatch sends the prompt body with unsubstituted placeholders when no arguments are provided, consistent with NG-001.

### 9a. Validate missing description warns but still registers

Create a group directory with a nested prompt missing its description:

1. Create `.pi/prompts/lenient/` with `_index.md`:

```md
---
type: group
---
```

2. Add `nodesc.md` with no description:

```md
Do something.
```

3. Reload Pi and verify:
   - The `/lenient` grouped command is registered.
   - A warning was emitted about `_index.md` missing `description` (falls back to `lenient`).
   - A warning was emitted about `nodesc.md` missing `description` (falls back to `nodesc`).
   - `nodesc` appears as a subcommand in the selector.

### 9b. Validate missing `_index.md` skips the group

Create `.pi/prompts/noindex/` with a nested prompt but **no** `_index.md`. Reload and verify:

- The `/noindex` grouped command is **not** registered (no `type: group` marker).

### 9c. Validate `_index.md` without `type: group` skips the group

Create `.pi/prompts/nomarker/` with `_index.md` that has no `type: group`:

```md
---
description: Not a group
---
```

Reload and verify:

- The `/nomarker` grouped command is **not** registered.

### 9d. Validate malformed `args` warns but still registers

Create a nested prompt with malformed `args`:

```md
---
type: group
---
```

```md
---
description: Prompt with bad args
args: not-an-array
---
Do something.
```

Reload and verify:

- The prompt is registered as a subcommand.
- A warning was emitted about malformed `args` (treated as absent — no argument hints shown).

## 10. Run repository validation

From the repository root:

```bash
bun install
bun run fix
bun run typecheck
bun run lint
```

