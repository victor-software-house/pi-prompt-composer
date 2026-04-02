---
description: Add subcommands to an existing grouped prompt set
args:
  - name: group-name
    required: true
    hint: Name of the existing command group
  - name: description
    required: false
    hint: What the new subcommand(s) should do (optional — will ask if missing)
---
Add subcommands to the `$1` grouped prompt set.

## Step 1 — Find and read the existing group

```bash
# Check both prompt roots
for d in ~/.pi/agent/prompts/$1 .pi/prompts/$1; do
  [ -d "$d" ] && echo "Found: $d" && ls "$d"
done
```

If the directory doesn't exist in either root, **stop**. Tell the user the group was not found and suggest `/compose new $1` instead. Do not proceed.

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

## Step 2 — Determine what to add

If a description was provided (`${@:2}`), use it to propose specific subcommands. Match the existing group's scope — do not propose subcommands that drift into a different domain.

Use `ask_user` to confirm:

```json
{
  "question": "Here are my proposed additions to /$1. Confirm or adjust:",
  "context": "Existing subcommands:\n<list each existing subcommand with its description>\n\nProposed new subcommands (based on: ${@:2}):\n- <name>: <one-line purpose>\n- <name>: <one-line purpose>\n\nEach performs one focused operation that complements the existing set.",
  "options": [
    { "title": "Use these additions", "description": "Create the subcommands listed above" },
    { "title": "Modify the list", "description": "I'll describe what I want instead" }
  ],
  "allowFreeform": true
}
```

If no description was provided, ask directly:

```json
{
  "question": "What subcommands should I add to /$1?",
  "context": "Existing subcommands:\n<list each with description>\n\nDescribe what new subcommands you need and I'll propose specific additions.",
  "allowFreeform": true
}
```

Then propose and confirm with the structured `ask_user` above.

**Done when:** the user has confirmed specific subcommand names and purposes.

## Step 3 — Check for overlap

Before generating, verify the proposed names don't collide with existing subcommands:

```bash
for proposed in <proposed-names>; do
  [ -f "$GROUP_DIR/$proposed.md" ] && echo "COLLISION: $proposed already exists" || echo "OK: $proposed"
done
```

If there is overlap, use `ask_user` to resolve:

```json
{
  "question": "The name '<name>' already exists in /$1. How should I handle this?",
  "context": "Existing subcommand description: <existing description>\nProposed purpose: <proposed purpose>",
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

1. **Same frontmatter fields and order** as existing subcommands — if they use `description` then `args`, do the same. Don't introduce fields the existing prompts don't use.

2. **Consistent description tone** — if existing descriptions are terse ("List all items"), match that. If they're sentence-form ("Lists all items in the current workspace and reports their status"), match that.

3. **Consistent `args` patterns** — if existing subcommands use args with `hint` fields, include hints. If they don't use args, only add them when clearly necessary.

4. **Match the prompt body quality level** — if existing subcommands have `ask_user` calls, verification steps, and structured output, the new ones must too. If existing subcommands are simpler, match that level.

### Quality rules for generated content

Every new subcommand `.md` file **must** include:

1. **`description` in frontmatter** — concise, shown in menus. Match the existing tone.

2. **Actionable body** — specific step-by-step instructions, not vague guidance. "Read the file at `\$1` and parse its YAML frontmatter" not "look at the file". When the subcommand takes args, use Pi substitution syntax (`\$1`, `\$2`, `\${@:2}`, `\$ARGUMENTS`) in the body.

3. **`ask_user` for interactive decisions** — if the subcommand needs operator input during execution, include the **exact `ask_user` JSON payload**. Do not write "ask the user" — write the literal tool call with `question`, `context`, `options`, and `allowFreeform`.

4. **Verification** — include at least one `bash` block that confirms the operation succeeded.

5. **Error handling** — what to do when the target doesn't exist, a name collides, or results are empty. At minimum: detect, report, suggest a fix.

6. **Output format** — specify what the model reports after completion (table, summary, file list).

7. **Substitution syntax** — when the generated prompt uses args, the body must reference them with `\$1`, `\$2`, `\$@`, or `\${@:N}`. Example: a prompt with `args: [{ name: file }]` should contain `\$1` where the file path belongs.

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
     "context": "Current sessions:\n<formatted table rows>",
     "options": [
       { "title": "<session 1 name>", "description": "<repo> — <branch>" },
       { "title": "<session 2 name>", "description": "<repo> — <branch>" }
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

## Step 5 — Verify

```bash
# 1. New files exist
for f in <new-filenames>; do
  [ -f "$GROUP_DIR/$f.md" ] && echo "PASS: $f" || echo "FAIL: $f missing"
done

# 2. Every new file has a description
for f in <new-filenames>; do
  grep -q 'description:' "$GROUP_DIR/$f.md" && echo "PASS: $f" || echo "FAIL: $f missing description"
done

# 3. Total subcommand count is still reasonable (warn if > 8)
count=$(ls "$GROUP_DIR"/*.md | grep -v _index.md | wc -l)
echo "Total subcommands: $count"
[ "$count" -gt 8 ] && echo "WARNING: consider splitting this group"
```

**Done when:** all new files exist with valid frontmatter and the total count is reasonable.

## Step 6 — Commit and report

```bash
git add "$GROUP_DIR/"
git commit -m "feat: add subcommands to /$1 group"
```

Report what was added as a table:

| File | Subcommand | Purpose |
|------|-----------|---------|
| `<name>.md` | `/$1 <name>` | `<description>` |
| ... | ... | ... |

Tell the user: "Run `/reload` to pick up the new commands."

## Stop conditions

Stop and ask before:

- Adding more than 4 subcommands at once without explicit confirmation
- Overwriting an existing subcommand without confirmation
- Adding subcommands that overlap in purpose with existing ones
- Pushing the group past 8 total subcommands
