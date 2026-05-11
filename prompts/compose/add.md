---
description: Add subcommands to an existing grouped prompt set
engine: liquid
args:
  - name: group_name
    required: true
    hint: Name of the existing command group
  - name: description
    required: false
    type: string[]
    rest: true
    default: []
    hint: "What the new subcommand(s) should do (enter to skip)"
---
Add subcommands to the `{{ args.group_name }}` grouped prompt set.

## Step 1 — Find and read the existing group

```bash
# Check both prompt roots
for d in ~/.pi/agent/composed/{{ args.group_name }} .pi/composed/{{ args.group_name }}; do
  [ -d "$d" ] && echo "Found: $d" && ls "$d"
done
```

If the directory doesn't exist in either root, **stop**. Tell the user the group was not found and suggest `/compose new {{ args.group_name }}` instead. Do not proceed.

Record the found path as `$GROUP_DIR`.

Read **all** existing `.md` files in the group to understand the current style:

```bash
for f in "$GROUP_DIR"/*.md; do
  echo "=== $(basename "$f") ==="
  cat "$f"
  echo ""
done
```

Extract and record:

- Frontmatter fields and order (which fields, what sequence)
- Description tone and length
- Whether existing subcommands use `args` metadata
- Whether existing subcommands use `ask_user` calls
- Whether existing subcommands have verification steps
- Naming convention (verbs? nouns? kebab-case patterns?)
- **Current `order` field in `_index.md`** — if present, note the existing display order so new subcommands can be inserted appropriately

## Step 2 — Determine what to add

The operator provided this description of what to add:

> {{ args.description | join: " " }}

If the quoted block above is empty, the operator did not provide a description — use `ask_user` to collect one:

```json
{
  "question": "What subcommands should I add to /{{ args.group_name }}?",
  "context": "Existing subcommands (from Step 1 output):\n- summarize.md: Summarize current repository state\n- checklist.md: Build verification checklist\n\nReplace these example rows with actual filenames and descriptions from Step 1 before calling ask_user. Describe what new subcommands you need and I'll propose specific additions.",
  "allowFreeform": true
}
```

Once you have a description (from the block above or from `ask_user`), propose specific subcommands based on it. Match the existing group's scope — do not propose subcommands that drift into a different domain.

Use `ask_user` to confirm:

```json
{
  "question": "Here are my proposed additions to /{{ args.group_name }}. Confirm or adjust:",
  "context": "Existing subcommands (from Step 1):\n- summarize: Summarize current repository state\n- checklist: Build verification checklist\n\nProposed new subcommands:\n- security-review: Review changes for security risks\n- release-notes: Draft release notes from the change summary\n\nReplace these example rows with the actual existing and proposed subcommands before calling ask_user. Each performs one focused operation that complements the existing set.",
  "options": [
    { "title": "Use these additions", "description": "Create the subcommands listed above" },
    { "title": "Modify the list", "description": "I'll describe what I want instead" }
  ],
  "allowFreeform": true
}
```

**Done when:** the user has confirmed specific subcommand names and purposes.

## Step 3 — Check for overlap

Before generating, verify the proposed names don't collide with existing subcommands:

Substitute the actual confirmed names from Step 2:

```bash
for proposed in <confirmed-name-1> <confirmed-name-2>; do
  [ -f "$GROUP_DIR/$proposed.md" ] && echo "COLLISION: $proposed already exists" || echo "OK: $proposed"
done
```

If there is overlap, use `ask_user` to resolve:

Substitute the actual collision details:

```json
{
  "question": "The name 'security-review' already exists in /{{ args.group_name }}. How should I handle this?",
  "context": "Existing subcommand description: Review staged changes for security issues\nProposed purpose: Review changes for security risks\n\nReplace these example values with the actual collision details before calling ask_user.",
  "options": [
    { "title": "Replace it", "description": "Overwrite the existing subcommand" },
    { "title": "Pick a different name", "description": "I'll suggest an alternative" },
    { "title": "Skip it", "description": "Don't add this subcommand" }
  ],
  "allowFreeform": true
}
```

**Done when:** all proposed names are confirmed with no unresolved collisions.

## Step 4 — Generate files

Create new `.md` files that **match the existing group's style exactly**.

### Style-matching rules

1. **Same frontmatter fields and order** as existing subcommands — if they use `description` then `args`, do the same. Don't introduce fields the existing prompts don't use unless the new subcommand needs a Composer feature that existing files do not use.

2. **Use Composer features intentionally** — add `engine: liquid` for named args, loops, conditionals, structured Markdown, XML blocks, JSON, or shell blocks. Keep default `engine: pi` for simple positional substitution.

3. **Shell policy** — only use `{% raw %}{% shell %}{% endraw %}` blocks in Liquid prompts. Add `shell: ask` by default, or `shell: allow` only for trusted local-only helpers. Shell-enabled prompts are trusted code, not sandboxed code.

4. **Validation fields** — prefer current frontmatter fields before prose validation: `required`, `type`, `values`, and `default`. Use `type: enum` + `values` for fixed choices, `type: number` for numeric input, and `type: string[]` for repeated named args. Do not generate `validate:` frontmatter yet; it is future design.

   Use `rest: true` on the final `type: string[]` arg when a Liquid prompt needs freeform remaining positionals.

5. **Consistent description tone** — if existing descriptions are terse ("List all items"), match that. If they're sentence-form ("Lists all items in the current workspace and reports their status"), match that.

6. **Consistent `args` patterns** — if existing subcommands use args with `hint` fields, include hints. If they don't use args, only add them when clearly necessary.

7. **Match the prompt body quality level** — if existing subcommands have `ask_user` calls, verification steps, and structured output, the new ones must too. If existing subcommands are simpler, match that level.

### Quality rules for generated content

Every new subcommand `.md` file **must** include:

1. **`description` in frontmatter** — concise, shown in menus. Match the existing tone. **YAML safety**: always quote `description` and `hint` values that contain colons, brackets, or special YAML characters (e.g. `hint: "Session name, ID prefix, or 'all' (default: all)"`).
   Unquoted colons in YAML values cause parse errors that crash the extension.

2. **Actionable body** — specific step-by-step instructions, not vague guidance. "Read the file at `$1` and parse its YAML frontmatter" not "look at the file". When the subcommand takes args, use Pi substitution syntax (`$1`, `$2`, `${@:2}`, `$ARGUMENTS`) in Pi-engine bodies or Liquid syntax (`{{ args.name }}`) in Liquid bodies.

3. **`ask_user` for interactive decisions** — if the subcommand needs operator input during execution, include the **exact `ask_user` JSON payload**. Do not write "ask the user" — write the literal tool call with `question`, `context`, `options`, and `allowFreeform`.

4. **Verification** — include at least one `bash` block that confirms the operation succeeded.

5. **Error handling** — what to do when the target doesn't exist, a name collides, or results are empty. At minimum: detect, report, suggest a fix.

6. **Output format** — specify what the model reports after completion (table, summary, file list).

7. **Substitution syntax** — when a Pi-engine generated prompt uses args, the body must reference them with `$1`, `$2`, `$@`, or `${@:N}`. Example: a prompt with `args: [{ name: file }]` should contain `$1` where the file path belongs. When a Liquid generated prompt uses args, the body must reference them with concrete variable names such as `{% raw %}{{ args.file }}{% endraw %}`.

### Bad example (what not to generate):

```markdown
1. Read the file
2. Ask the user what to change
3. Make the changes
4. Save it
```

### Good example (what to generate):

```markdown
1. Read the session table from the vault note:

   ```bash
   cat ~/workspace/obsidian-vault/Tools/Pi/Active\ Sessions.md
   ```

   If the file does not exist, stop and report: "Vault note not found."

2. Use `ask_user` to confirm which row to update:

   ```json
   {
     "question": "Which session should I update?",
     "context": "Current sessions:\n- composer-migration — pi-prompt-composer — main\n- release-check — pi-prompt-composer — release-docs",
     "options": [
       { "title": "composer-migration", "description": "pi-prompt-composer — main" },
       { "title": "release-check", "description": "pi-prompt-composer — release-docs" }
     ],
     "allowFreeform": true
   }
   ```

3. Apply the update and verify:

   ```bash
   grep "<session-id>" ~/workspace/obsidian-vault/Tools/Pi/Active\ Sessions.md
   ```

4. Report the change:

   | Field | Before | After |
   |-------|--------|-------|
   | Status | In progress | Completed |
```

Output each new file with its full path under `$GROUP_DIR/`.

After generating the new files, update `_index.md` to include the new subcommands in the `order` array.

First, extract the current `order` field:

```bash
grep '^order:' "$GROUP_DIR/_index.md" || echo "No order field found"
```

- **If `order` exists**: read the current list, then use `ask_user` to confirm where the new subcommands go
- **If `order` is absent**: add one listing all subcommands in the desired display order

Use the extracted value verbatim in the `ask_user` context — do not paraphrase or omit it:

```json
{
  "question": "Where should the new subcommands appear in the display order?",
  "context": "Current order line from _index.md: order: [summarize, checklist]\nExisting subcommands: summarize, checklist\nNew subcommands: security-review, release-notes\n\nReplace these example values with the exact grep and ls output before calling ask_user. The order array in _index.md controls display in autocomplete and the selector. Subcommands not listed are appended alphabetically.",
  "options": [
    { "title": "Append at the end", "description": "Keep current order, add new subcommands after: [summarize, checklist, security-review, release-notes]" },
    { "title": "Custom order", "description": "I'll specify the full order" }
  ],
  "allowFreeform": true
}
```

After confirmation, write the updated `order` array into `_index.md`.

## Step 5 — Verify

Substitute the actual confirmed subcommand names from Step 2:

```bash
# 1. New files exist
for f in <confirmed-name-1> <confirmed-name-2>; do
  [ -f "$GROUP_DIR/$f.md" ] && echo "PASS: $f" || echo "FAIL: $f missing"
done

# 2. Every new file has a description
for f in <confirmed-name-1> <confirmed-name-2>; do
  grep -q 'description:' "$GROUP_DIR/$f.md" && echo "PASS: $f" || echo "FAIL: $f missing description"
done

# 3. Order field is up to date
grep '^order:' "$GROUP_DIR/_index.md" || echo "WARNING: no order field"

# 4. Total subcommand count is still reasonable (warn if > 8)
count=$(ls "$GROUP_DIR"/*.md | grep -v _index.md | wc -l)
echo "Total subcommands: $count"
[ "$count" -gt 8 ] && echo "WARNING: consider splitting this group"
```

**Done when:** all new files exist with valid frontmatter and the total count is reasonable.

## Step 6 — Commit and report

```bash
git add "$GROUP_DIR/"
git commit -m "feat: add subcommands to /{{ args.group_name }} group"
```

Report what was added as a table:

| File | Subcommand | Purpose |
|------|-----------|---------|
| `<name>.md` | `/{{ args.group_name }} <name>` | `<description>` |
| ... | ... | ... |

Tell the user: "Run `/reload` to pick up the new commands."

## Stop conditions

Stop and ask before:

- Adding more than 4 subcommands at once without explicit confirmation
- Overwriting an existing subcommand without confirmation
- Adding subcommands that overlap in purpose with existing ones
- Pushing the group past 8 total subcommands
