# ISSUES

Active defects with exact symptoms and verification criteria.

## ISS-001: ~~Strict args validation rejects all args when any item is incomplete~~ FIXED

**Status**: Fixed in `531939a`. Lenient per-item parsing: missing `hint` → `''`, missing `required` → `false`, only missing `name` rejects individual items.

**Severity**: High — breaks interactive arg collection entirely for affected prompts.

**Symptom**: If a prompt's frontmatter `args` array contains an item missing `hint` (or `required`, or `name`), `isValidArgsItem` returns `false` for that item, causing `parseArgsMetadata` to discard the entire `args` array. The prompt then behaves as if it has no args at all: no `ctx.ui.input()` prompt, no usage hint in the selector, no `<required>` / `[optional]` formatting.

**Root cause**: `parseArgsMetadata` calls `raw.every(isValidArgsItem)` — a single invalid item nukes the whole array.

**Expected behavior**: Lenient parsing. Missing `hint` should default to empty string. Missing `required` should default to `false`. Only a missing or non-string `name` should reject that individual item (with a warning). Valid items in the same array must still be kept.

**Verification**: A prompt with `args: [{ name: target, required: true }]` (no `hint`) should still trigger the input collection flow for `target`.

## ISS-002: ~~Discovery warnings only go to console.warn, not Pi UI~~ FIXED

**Status**: Fixed in `531939a`. Warnings now surface via `ctx.ui.notify()` on `session_start`.

**Severity**: Medium — operators never see the warnings unless they check terminal output.

**Symptom**: `discoverGroups` collects warnings into a `string[]` and the extension entry point logs them with `console.warn`. These never appear in Pi's UI (no `ctx.ui.notify()` at load time, no status bar update, no widget).

**Expected behavior**: Surface warnings through Pi's notification system at load, reload, and startup events so the operator knows when prompt metadata is malformed or incomplete.

**Verification**: A prompt group with a missing `_index.md` description shows a visible Pi notification on reload, not just a console log.

## ISS-003: No visual distinction between mandatory and optional args in selector

**Severity**: Low — cosmetic, but confusing for prompt groups with mixed arg requirements.

**Symptom**: In the dynamic usage hint below the selector list, `<required>` and `[optional]` use accent vs muted color, and `•` vs `◦` bullets. But these distinctions may not be obvious enough, especially in themes with low color contrast. There is no legend or inline label explaining the convention.

**Expected behavior**: The distinction should be compact yet obvious. Consider: bold for required names, dim for optional; or explicit `(required)` / `(optional)` suffixes in the hint line; or a single-line legend at the bottom. The exact solution should be validated visually before committing.

**Verification**: An operator seeing the selector for the first time can tell which args are mandatory without consulting docs.

## ISS-004: ~~`hint` field in args frontmatter is undocumented as recommended-but-optional~~ FIXED

**Status**: Fixed in `531939a`. Missing `hint` defaults to empty string. Selector and input prompt omit ` — ` suffix when hint is empty. Warning recommends adding hints.

**Severity**: Low — authoring friction.

**Symptom**: The `args` frontmatter schema requires `hint` as a string, but there is no doc or warning explaining that hints are recommended. If an author omits `hint`, ISS-001 causes silent breakage rather than a helpful warning.

**Expected behavior**: `hint` should be documented as recommended. When absent, it defaults to empty string. The selector and input prompt omit the ` — hint` suffix when the hint is empty rather than showing a dangling separator.

**Verification**: A prompt arg with no `hint` shows just the arg name in the input title and selector hint, with no trailing ` — `.
