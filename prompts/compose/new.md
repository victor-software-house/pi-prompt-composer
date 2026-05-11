---
description: Create a new grouped prompt set from scratch
args:
  - name: group-name
    required: true
    hint: Name for the new command group (kebab-case)
  - name: description
    required: false
    hint: "What this group is for (enter to skip)"
---
Create a new grouped prompt set named `$1`.

## Step 1 — Determine scope

Use `ask_user` to confirm where the group should live:

```json
{
  "question": "Where should the /$1 group live?",
  "context": "User composer prompts (~/.pi/agent/composed/) are personal and available everywhere.\nProject composer prompts (.pi/composed/) are shared via the repo.",
  "options": [
    { "title": "Project (.pi/composed/$1/)", "description": "Shared with the team via git" },
    { "title": "User (~/.pi/agent/composed/$1/)", "description": "Personal, available in all projects" }
  ],
  "allowFreeform": false
}
```

Record the chosen root as `$PROMPT_ROOT` for all subsequent steps.

## Step 2 — Check for conflicts

```bash
ls -d ~/.pi/agent/composed/$1/ .pi/composed/$1/ 2>/dev/null
```

If the directory exists in either root, **stop**. Tell the user and suggest `/compose add $1` instead. Do not proceed.

Also verify the name does not collide with a built-in Pi command:

```bash
# Known built-in commands — reject if $1 matches any
echo "help clear model reload config compact tree status" | tr ' ' '\n' | grep -x "$1" && echo "COLLISION" || echo "OK"
```

If there is a collision, use `ask_user` to pick an alternative name before continuing.

**Done when:** no directory exists and no name collision found.

## Step 3 — Gather subcommands

The operator provided this description of what the group should do:

> ${@:2}

If the quoted block above is empty, the operator did not provide a description — use `ask_user` to collect one:

```json
{
  "question": "What should /$1 do? Describe the purpose and I'll propose subcommands.",
  "allowFreeform": true
}
```

Once you have a description (from the block above or from `ask_user`), propose 2–6 subcommands based on it. Never propose more than 6 without confirmation.

Use `ask_user` to confirm the subcommand plan. Substitute the actual proposed names and purposes into the context — do not use angle-bracket placeholders:

```json
{
  "question": "Here's my proposed subcommand plan for /$1. Confirm or adjust:",
  "context": "Proposed subcommands:\n- summarize: Summarize current repository state and risks\n- checklist: Build a verification checklist for the requested change\n- handoff: Write a concise handoff for the next session\n\nReplace these example rows with the actual proposed names and purposes before calling ask_user. Each subcommand performs one focused operation. Names are short verbs or nouns in kebab-case.",
  "options": [
    { "title": "Use this plan", "description": "Create the subcommands listed above" },
    { "title": "Modify the plan", "description": "I'll describe what I want instead" }
  ],
  "allowFreeform": true
}
```

**Done when:** the user has confirmed a specific list of subcommand names and purposes. The order they are listed in the confirmed plan becomes the default display order in the selector and autocomplete.

Use `ask_user` to confirm the display order:

Use the exact subcommand names from the confirmed plan — do not use placeholders:

```json
{
  "question": "Should the subcommands appear in this order in the selector?",
  "context": "Proposed display order (matching the confirmed plan above):\n1. summarize\n2. checklist\n3. handoff\n\nReplace these example names with the exact confirmed names before calling ask_user. This becomes the order array in _index.md. It controls autocomplete and the interactive selector. Subcommands not listed are appended alphabetically.",
  "options": [
    { "title": "Use this order", "description": "order: [summarize, checklist, handoff]" },
    { "title": "Custom order", "description": "I'll specify a different order" }
  ],
  "allowFreeform": true
}
```

Record the confirmed order — it becomes the `order` field in `_index.md`.

## Step 4 — Decide on args per subcommand

For each confirmed subcommand, determine whether it needs `args` metadata:

- **Use `args`** when the prompt needs operator-provided values to be useful (file paths, names, specific targets)
- **Skip `args`** when the prompt is self-contained or the model gathers context naturally

Use `ask_user` to confirm args for any subcommand where it's ambiguous:

Substitute the actual group name and subcommand name from the confirmed plan:

```json
{
  "question": "Should /$1 summarize take arguments?",
  "context": "Purpose: Summarize current repository state and risks\n\nReplace the example subcommand and purpose with the actual confirmed values before calling ask_user. Arguments make sense when the prompt needs a specific target, name, or path from the operator. Skip args when the prompt works on its own.",
  "options": [
    { "title": "No args needed", "description": "The prompt is self-contained" },
    { "title": "Yes, here's what it needs", "description": "I'll describe the expected arguments" }
  ],
  "allowFreeform": true
}
```

## Step 5 — Generate files

Create the complete file set in `$PROMPT_ROOT/$1/`.

### Quality rules for generated prompts

Every generated subcommand `.md` file **must** meet these criteria:

1. **Frontmatter**: `description` is required. `args` array included when the subcommand takes arguments. Each arg has `name`, `required`, and `hint`. **YAML safety**: always quote `description` and `hint` values that contain colons, brackets, or other special YAML characters (e.g. `hint: "Session name, ID prefix, or 'all' (default: all)"`).
   Unquoted colons in YAML values cause parse errors that crash the extension.

   Add `engine: liquid` when the prompt needs named args, conditionals, loops, `json`, XML blocks, Markdown sections that disappear when empty, or shell blocks. Keep default `engine: pi` for simple positional prompts.

   Add `shell: ask` or `shell: allow` only for `engine: liquid` prompts with `{% shell %}` blocks. Shell-enabled prompts are trusted code, not sandboxed code. Prefer `shell: ask` unless the prompt is local-only and explicitly trusted.

   Use current fluent validation fields before writing prose validation: `required`, `type`, `values`, and `default`. Supported types are `string`, `string[]`, `number`, `boolean`, and `enum`. Use `type: string[]` for repeated values such as `checks=typecheck checks=lint`. Do not generate `validate:` frontmatter yet; it is a future design, not current runtime behavior.

   Use `rest: true` on the final `type: string[]` arg when a Liquid prompt needs Pi-like freeform tails, such as `/compose new group create that shit`.

2. **Actionable body**: The prompt body must contain specific, step-by-step instructions — not vague guidance. Tell the model *what to do*, *how to verify*, and *what to output*. When the subcommand takes args, use Pi substitution syntax (`\$1`, `\$2`, `\${@:2}`, `\$ARGUMENTS`) in Pi-engine bodies or Liquid syntax (`{{ args.name }}`) in Liquid bodies so the operator's input flows into the prompt.

3. **`ask_user` for interactive decisions**: If a subcommand needs operator input during execution (choosing between options, confirming destructive actions, providing missing context), include the **exact `ask_user` JSON payload** in the prompt body. Do not write "ask the user" — write the literal tool call.

4. **Verification steps**: Include `bash` blocks that verify the operation completed correctly. The model should be able to confirm success programmatically.

5. **Concrete output format**: Specify what the model should report after completion — a table, a summary, a file list. Do not leave the output format ambiguous.

6. **Error handling**: Include what to do when things go wrong — file not found, name collision, empty results. At minimum: detect the error, report it clearly, suggest a fix.

7. **Substitution syntax**: When a Pi-engine generated prompt uses args, the body must reference them with `\$1`, `\$2`, `\$@`, or `\${@:N}`. Example: a prompt with `args: [{ name: file }]` should contain `\$1` where the file path belongs. When a Liquid generated prompt uses args, the body must reference them with concrete variable names such as `{{ args.file }}`.

### Bad example (too vague):

```markdown
1. Read the file
2. Make the changes
3. Ask the user if they want to continue
4. Save the result
```

### Good example (concrete and verifiable):

```markdown
1. Read the target file and parse its frontmatter:

   ```bash
   cat "$TARGET_FILE"
   ```

   If the file does not exist, stop and report: "File not found: $TARGET_FILE".

2. Use `ask_user` to confirm the changes:

   ```json
   {
     "question": "Apply these changes to review/checklist.md?",
     "context": "Current state: description is missing; prompt has no verification step\nProposed changes: add description frontmatter and a numbered verification checklist",
     "options": [
       { "title": "Apply", "description": "Write the changes" },
       { "title": "Cancel", "description": "Discard and stop" }
     ]
   }
   ```

3. Write the updated file and verify:

   ```bash
   cat "$TARGET_FILE" | head -10
   ```

4. Report what changed:

   | Field | Before | After |
   |-------|--------|-------|
   | ... | ... | ... |
```

### File generation order

1. `_index.md` — with the confirmed `description` and an `order` array listing subcommand names in the display order confirmed by the user. Example:
   ```yaml
   ---
   description: Review workflows
   order: [summary, fix, lint]
   ---
   ```
   The `order` field controls how subcommands appear in autocomplete and the selector. Unlisted subcommands are appended alphabetically.
2. Each subcommand `.md` — in the order confirmed by the user

Output each file with its full path.

## Step 6 — Verify

After generating all files:

```bash
# 1. Directory exists with correct structure
ls "$PROMPT_ROOT/$1/"

# 2. _index.md has a description
grep -q '^description:' "$PROMPT_ROOT/$1/_index.md" && echo "PASS: description" || echo "FAIL: missing description"

# 3. Every subcommand has a description
for f in "$PROMPT_ROOT/$1/"*.md; do
  [ "$(basename "$f")" = "_index.md" ] && continue
  grep -q 'description:' "$f" && echo "PASS: $(basename "$f")" || echo "FAIL: $(basename "$f") missing description"
done

# 4. _index.md has order field
grep -q '^order:' "$PROMPT_ROOT/$1/_index.md" && echo "PASS: order field" || echo "FAIL: missing order"

# 5. No naming collisions with existing commands
ls ~/.pi/agent/composed/ .pi/composed/ 2>/dev/null | grep -v "$1"
```

**Done when:** all verification checks pass and the user sees the file list.

## Step 7 — Commit and next steps

Commit the new group:

```bash
git add "$PROMPT_ROOT/$1/"
git commit -m "feat: add /$1 grouped prompt set"
```

Report what was created as a table:

| File | Subcommand | Purpose |
|------|-----------|---------|
| `_index.md` | — | Group root |
| `<name>.md` | `/$1 <name>` | `<description>` |
| ... | ... | ... |

Tell the user: "Run `/reload` to pick up the new commands, then test with `/$1` to see the selector."

## Stop conditions

Stop and ask before:

- Creating more than 6 subcommands without explicit confirmation
- Using a name that shadows a built-in Pi command
- Overwriting any existing files
