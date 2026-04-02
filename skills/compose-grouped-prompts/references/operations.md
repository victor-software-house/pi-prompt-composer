# Operations Playbooks

## Adding subcommands to an existing group

### Before adding

1. Read all existing `.md` files in the group directory
2. Note the naming convention, description style, and frontmatter shape
3. Check whether the proposed subcommand overlaps with an existing one

### Adding steps

1. Create the new `.md` file in the group directory
2. Match the existing frontmatter style (same fields, same order)
3. Match the description tone and length
4. Use consistent argument naming if other subcommands have args

### After adding

1. Verify the new subcommand appears in `/group` selector
2. Confirm autocomplete includes the new name
3. Test direct dispatch: `/group new-subcommand`

## Removing a subcommand

### Before removing

1. Check whether other prompts or documentation reference the subcommand
2. Determine the impact: is this subcommand used frequently?
3. Decide: delete, merge into another subcommand, or deprecate

### Removal steps

**Delete:** Remove the `.md` file. If it was the last subcommand, consider removing the entire group.

**Merge:** Move the useful content into another subcommand file. Update the description to reflect the broader scope.

**Deprecate:** Rename with a `-deprecated` suffix and add a note in the body pointing to the replacement. Remove in a later pass.

### After removing

1. Verify the group still has at least one subcommand (otherwise the group is skipped)
2. Update `_index.md` description if the group scope changed
3. Update any docs that referenced the removed subcommand

## Migrating flat prompts to a group

When a set of related flat prompts should become a grouped command:

1. Create the group directory with `_index.md`
2. Move each flat `.md` file into the directory
3. Ensure each file has `description` in frontmatter
4. Remove or rename the original flat files to avoid command-name collisions
5. Test the grouped command

## Renaming a group

1. Create a new directory with the desired name
2. Copy all files from the old directory
3. Update any cross-references in prompts or docs
4. Delete the old directory
5. Test the new command name
