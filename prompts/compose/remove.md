---
description: Remove or simplify subcommands from a grouped prompt set
args:
  - name: group-name
    required: true
    hint: Name of the command group to modify
  - name: subcommand
    required: false
    hint: Subcommand to remove (optional — will show a list if missing)
---
Remove or simplify subcommands in the `$1` grouped prompt set.

## Step 1 — Find and read the existing group

```bash
for d in ~/.pi/agent/composed/$1 .pi/composed/$1; do
  [ -d "$d" ] && echo "Found: $d" && ls "$d"
done
```

If the directory doesn't exist in either root, **stop**. Tell the user the group was not found. Do not proceed.

Record the found path as `$GROUP_DIR`.

Read all subcommand files to understand the current set:

```bash
for f in "$GROUP_DIR"/*.md; do
  [ "$(basename "$f")" = "_index.md" ] && continue
  echo "--- $(basename "$f") ---"
  # Show description from frontmatter
  sed -n '/^description:/p' "$f"
done
```

## Step 2 — Identify what to remove

If a subcommand name was provided (`$2`), verify it exists:

```bash
[ -f "$GROUP_DIR/$2.md" ] && echo "Found: $2.md" || echo "NOT FOUND: $2.md"
```

If the file doesn't exist, **stop**. Report which subcommands are available and let the user try again.

If no subcommand was specified, use `ask_user` to let the operator choose:

Build the options from the Step 1 output — use the actual filenames and their `description:` lines:

```json
{
  "question": "Which subcommand(s) should I remove from /$1?",
  "context": "Current subcommands (from Step 1):\n<paste each filename and its description: line from the output above>",
  "options": [
    { "title": "<actual-filename-1>", "description": "<actual description from frontmatter>" },
    { "title": "<actual-filename-2>", "description": "<actual description from frontmatter>" }
  ],
  "allowFreeform": true,
  "allowMultiple": true
}
```

**Done when:** one or more specific subcommands are identified for removal.

## Step 3 — Check for references

Before removing, search for references to the target subcommand(s):

```bash
TARGET="$2"  # or each selected subcommand

# Check if other prompts reference this subcommand
grep -r "/$1 $TARGET" ~/.pi/agent/composed/ .pi/composed/ 2>/dev/null

# Check if docs or scripts reference it
grep -r "/$1 $TARGET" docs/ README.md AGENTS.md .specify/ 2>/dev/null

# Check if other subcommands in the same group reference it
grep -r "$TARGET" "$GROUP_DIR/"*.md 2>/dev/null | grep -v "$TARGET.md"
```

Record any references found — they must be addressed in the removal plan.

## Step 4 — Confirm the action

Use `ask_user` with the full context of what was found:

Paste the actual grep results from Step 3 into the context:

```json
{
  "question": "How should I handle /$1 $TARGET?",
  "context": "<paste Step 3 grep output, or 'No references found to this subcommand.' if grep returned nothing>\n\nCurrent subcommand count: <actual count from ls>. After removal: <count minus 1>.",
  "options": [
    { "title": "Delete", "description": "Remove the .md file entirely" },
    { "title": "Merge into another subcommand", "description": "Move useful content into an existing subcommand — I'll choose which one" },
    { "title": "Simplify", "description": "Keep the subcommand but reduce its scope" },
    { "title": "Cancel", "description": "Don't remove anything" }
  ],
  "allowFreeform": true
}
```

If the user chooses "Cancel", **stop** immediately. Report that no changes were made.

If this is the **last subcommand** in the group, use a separate `ask_user` to confirm:

```json
{
  "question": "This is the last subcommand in /$1. Removing it will leave the group empty. Remove the entire group directory?",
  "context": "An empty group directory serves no purpose — Pi ignores groups without subcommands.",
  "options": [
    { "title": "Yes, remove the entire group", "description": "Delete $GROUP_DIR/ including _index.md" },
    { "title": "No, keep the group", "description": "Leave _index.md in place for future subcommands" },
    { "title": "Cancel", "description": "Don't remove anything" }
  ],
  "allowFreeform": false
}
```

**Done when:** the user has confirmed a specific action (delete, merge, simplify, or cancel).

## Step 5 — Apply the change

### Delete

```bash
rm "$GROUP_DIR/$TARGET.md"
```

Verify:

```bash
[ ! -f "$GROUP_DIR/$TARGET.md" ] && echo "PASS: file removed" || echo "FAIL: file still exists"
```

If the entire group was confirmed for removal:

```bash
rm -r "$GROUP_DIR"
[ ! -d "$GROUP_DIR" ] && echo "PASS: group removed" || echo "FAIL: directory still exists"
```

### Merge

Use `ask_user` to choose the merge target:

Build the options from the remaining subcommands (excluding the target):

```json
{
  "question": "Which subcommand should absorb the content from $TARGET?",
  "context": "Available subcommands (excluding $TARGET):\n<paste each remaining filename and its description: line>",
  "options": [
    { "title": "<actual-remaining-name>", "description": "<actual description from frontmatter>" },
    { "title": "<actual-remaining-name>", "description": "<actual description from frontmatter>" }
  ],
  "allowFreeform": true
}
```

Then:
1. Read both files
2. Move the useful content from `$TARGET.md` into the merge target
3. Update the merge target's `description` if its scope broadened
4. Remove `$TARGET.md`

### Simplify

1. Read `$TARGET.md`
2. Edit the prompt body to reduce scope while keeping the subcommand name
3. Update `description` to reflect the narrower scope

## Step 6 — Update references

If references were found in Step 3, update them:

- If the subcommand was **deleted**: remove or replace the reference
- If the subcommand was **merged**: update the reference to point to the merge target
- If the subcommand was **simplified**: no reference changes needed

For each file that contained a reference, update it and verify:

```bash
# After updating each file, confirm the stale reference is gone
grep -c "/$1 $TARGET" "<updated-file>" && echo "FAIL: stale ref remains" || echo "PASS: <updated-file>"
```

## Step 7 — Update group metadata

After the removal, update `$GROUP_DIR/_index.md`:

1. Extract the current `order` field:

   ```bash
   grep '^order:' "$GROUP_DIR/_index.md" || echo "No order field found"
   ```

2. If `order` exists and contains the removed subcommand name, remove it from the array and write the updated `_index.md`.

3. If the removal changes the group's overall scope, update `description` to reflect the current set of subcommands.

## Step 8 — Verify and commit

```bash
# 1. Removed file is gone
[ ! -f "$GROUP_DIR/$TARGET.md" ] && echo "PASS" || echo "FAIL"

# 2. Group still has at least one subcommand (unless entirely removed)
if [ -d "$GROUP_DIR" ]; then
  count=$(ls "$GROUP_DIR"/*.md 2>/dev/null | grep -v _index.md | wc -l)
  echo "Remaining subcommands: $count"
  [ "$count" -ge 1 ] && echo "PASS" || echo "WARNING: empty group"
fi

# 3. No stale references remain
grep -r "/$1 $TARGET" ~/.pi/agent/composed/ .pi/composed/ docs/ README.md 2>/dev/null && echo "FAIL: stale refs" || echo "PASS: no stale refs"

# 4. Order array does not contain the removed name
grep '^order:' "$GROUP_DIR/_index.md" 2>/dev/null | grep -q "$TARGET" && echo "FAIL: $TARGET still in order" || echo "PASS: order clean"
```

Commit the changes:

```bash
git add -A "$GROUP_DIR/" 
git commit -m "refactor: remove /$1 $TARGET subcommand"
```

Report what changed:

| Action | Target | Details |
|--------|--------|---------|
| Removed | `$TARGET.md` | `<reason>` |
| Updated | `<file>` | `<what changed>` |
| ... | ... | ... |

Tell the user: "Run `/reload` to pick up the changes."

## Stop conditions

Stop and ask before:

- Removing a subcommand that other prompts reference
- Removing the last subcommand in a group
- Overwriting a merge target without confirmation
