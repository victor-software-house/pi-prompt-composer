# IMPLEMENTATION PLAN

This document translates the product goals in `FEATURE-SET.md` into an implementation design for `pi-prompt-composer`.

It focuses on three things:

1. grouped slash-command routing for prompt directories
2. Pi-native prompt-template semantics where Pi already has them
3. a package-native preprocessing pipeline for richer rendered prompts that remain fully visible to the operator

## Scope

`pi-prompt-composer` is not a separate prompt language.

It adds directory-based routing and a rendering pipeline on top of Pi's existing prompt-template model.

The extension should preserve Pi behavior wherever Pi already defines behavior, and only add new semantics in clearly separated, package-owned stages.

## Research summary

The current Pi implementation and official examples establish these facts.

### Pi prompt templates today

Pi prompt templates are:

- file-based Markdown snippets
- discovered non-recursively from `~/.pi/agent/prompts/*.md` and `.pi/prompts/*.md`
- expanded from `/name args`
- parsed with `parseFrontmatter()`
- rendered with `substituteArgs()` after argument parsing via `parseCommandArgs()`

Native Pi prompt-template substitution supports:

- `$1`, `$2`, ...
- `$@`
- `$ARGUMENTS`
- `${@:N}`
- `${@:N:L}`

### Pi prompt execution order

The runtime flow relevant to this package is:

1. extension commands are checked first
2. `input` event handlers run on raw text
3. skill expansion runs for `/skill:name`
4. prompt-template expansion runs for `/name`
5. `before_agent_start` runs
6. the rendered user message is sent to the agent

This matters because grouped prompt commands must be implemented as extension commands, not as native prompt templates.

### Official Pi examples that matter most

These examples are the main implementation references:

- `examples/extensions/commands.ts` — command registration and argument completions
- `examples/extensions/preset.ts` — interactive selector UI for bare command invocation
- `examples/extensions/send-user-message.ts` — sending rendered content as a real user message
- `examples/extensions/input-transform.ts` — confirms where `input` sits in the pipeline
- `examples/extensions/inline-bash.ts` — command-substitution mechanics and error handling
- `examples/extensions/dynamic-resources/index.ts` — dynamic resource discovery on startup and reload
- `examples/sdk/08-prompt-templates.ts` — internal prompt-template shape

## Design goals

### Goal 1: grouped prompt routing

A prompt directory becomes a slash-command group.

Example:

```text
prompts/
├── workspace.md
├── superset/
│   ├── _index.md
│   ├── create.md
│   ├── list.md
│   └── tasks.md
```

Expected behavior:

- `workspace.md` remains native Pi `/workspace`
- `superset/create.md` becomes `/superset create`
- `superset/list.md` becomes `/superset list`
- `/superset` opens an interactive menu for the nested prompts

### Goal 2: Pi-native rendering semantics first

Grouped prompts should reuse Pi's own helpers and conventions for:

- frontmatter parsing
- description extraction
- argument parsing
- positional and slice substitution
- delivery as Markdown in a user message bubble

The package should not fork Pi's prompt syntax for these basics.

### Goal 3: visible preprocessing

The extension should add a preprocessing pipeline that Pi does not provide natively, while keeping the final rendered result visible to the operator.

This includes:

- shell command substitution inside prompt bodies
- later, additional package-native template features such as conditional rendering
- rendering before dispatch, so the operator can see the expanded prompt text in the chat history

## Non-goals

These remain out of scope for the first implementation slice unless explicitly promoted later:

- multi-level nesting deeper than `/group subcommand`
- aliases or alternate command names
- pretending grouped commands are native Pi prompt commands in Pi internals
- a fully programmable template language in v1
- hidden preprocessing that the operator cannot inspect after dispatch

## Code reuse policy

The implementation should reuse Pi code aggressively where the public API allows it, and duplicate internal Pi logic only when there is no supported export.

### Reuse decision order

For every helper or behavior in this package, apply this order:

1. use a stable public export from `@mariozechner/pi-coding-agent` when one exists
2. copy a small Pi internal implementation locally when no public export exists and the logic is tightly coupled to this package
3. extract that copied logic into a shared utility package only if a second package needs the same behavior

Do not import Pi internals from `dist/core/*` or other non-public module paths at runtime. Treat internal source as reference material, not as a dependency contract.

### Reuse matrix

#### Reuse directly from Pi public exports

These should be imported directly rather than reimplemented:

- `parseFrontmatter()`
- `stripFrontmatter()` when needed
- `createSyntheticSourceInfo()`
- `getAgentDir()` if direct global path resolution is needed
- Pi TUI primitives such as `SelectList`, `Container`, `Text`, and related theme helpers if richer custom UI is built

#### Copy locally from Pi internals when needed

These behaviors exist in Pi but are not currently exported:

- `parseCommandArgs()` from Pi's prompt-template implementation
- `substituteArgs()` from Pi's prompt-template implementation
- description fallback behavior used when frontmatter description is absent
- simple prompt-path classification helpers used during prompt discovery

If these are copied, keep them:

- small
- clearly attributed in code comments to the Pi version they were copied from
- covered by tests that lock the expected behavior

#### Candidate future shared utility extraction

If another Pi package needs the same prompt-rendering logic, extract the duplicated helper surface into a shared library instead of letting multiple packages drift.

Likely candidates:

- prompt argument parsing
- prompt argument substitution
- description fallback extraction
- prompt-root and scope classification helpers
- prompt-body shell-substitution helpers

A shared extraction should happen only when there is a real second consumer. Until then, local duplication is cheaper than introducing an abstract utility package too early.

The current `pi-provider-utils` package proves the extraction pattern is viable, but its present scope is provider- and agent-path-focused. Prompt-rendering helpers should either live in a new focused shared package or in a newly added prompt/resource-oriented entrypoint only if multiple repos need them.

## Architectural constraints

### Constraint 1: grouped commands must be extension commands

Pi prompt discovery is non-recursive.

Therefore nested prompt routing must be implemented via `pi.registerCommand()`.

### Constraint 2: extension command dispatch is native-like, not identical to native prompt expansion

Once an extension command resolves a nested prompt, it should dispatch the fully rendered body with `pi.sendUserMessage()`.

This preserves:

- a real user message bubble
- visible rendered Markdown
- normal downstream agent execution

But it does not use Pi's native `/template` expansion path. That is acceptable as long as parsing and rendering semantics stay Pi-native where possible.

### Constraint 3: Pi public API does not let extension commands override `sourceInfo`

`registerCommand()` does not accept a custom `sourceInfo`.

Implications:

- grouped commands will be reported by Pi as extension commands
- they cannot appear as native prompt commands in Pi's built-in command inventory
- internal prompt scope must be tracked by this package's registry and surfaced in its own UI and diagnostics

This is a public API limitation, not a package bug.

## Proposed architecture

### 1. Scanner and registry

At startup and on reload, scan an ordered list of composer roots:

1. **Bundled** — package-owned `prompts/compose/` (exact group root, lowest precedence)
2. **User** — `~/.pi/agent/composed/` (parent root)
3. **Project** — `.pi/composed/` (parent root, highest precedence)

Before scanning, legacy user/project grouped prompts under `prompts/<group>/` are migrated once to `composed/<group>/` when no target collision exists.

Roots are handled as one of two cases:

- **Case A (exact group root):** The root directory itself contains `_index.md`. The directory name becomes the group name. Used by the bundled `/compose` root.
- **Case B (parent root):** The root is scanned for child directories that are valid groups and flat prompt files. Used by user and project roots.

Rules:

- flat `.md` files under `composed/` become composer-owned commands
- flat `.md` files under native `prompts/` roots remain Pi-native and are ignored by this package
- `_index.md` is required group metadata under `composed/`; no `type: group` marker is required
- all other `.md` files in a group directory are subcommands
- grouped commands are one level deep for v1

Origin precedence within the same extension relies on `Map.set()` semantics — later registrations of the same command name overwrite earlier ones. This means project overrides user, user overrides bundled.

Registry shape:

- `groupName`
- `origin` (`bundled`, `user`, or `project`)
- `groupPath`
- `indexTemplate` if present
- `subcommands[]`
  - `name`
  - `filePath`
  - `description`
  - `body`
  - `frontmatter`
  - `origin`

Parsing rules:

- use Pi's exported `parseFrontmatter()`
- copy Pi's description fallback behavior locally if no public helper exists
- keep the fallback behavior test-covered so it stays aligned with the Pi version this package targets

### 2. Command registration

Register one extension command per discovered group.

Examples:

- `/superset`
- `/db`
- `/review`

Command behavior:

- `/group subcommand args...` dispatches directly
- `/group` opens a selector UI
- `getArgumentCompletions()` returns subcommand names
- description prefers `_index.md` frontmatter description, then `_index.md` first non-empty body line, then directory name

Collision behavior:

- extension commands take precedence over flat prompt templates with the same name
- this matches the repository requirement and Pi runtime ordering

### 3. Interactive bare-command UX

Bare `/group` should open a menu listing the nested prompts.

Recommended implementation:

- v1 can use `ctx.ui.select()` for simplicity
- richer UI can follow the `examples/extensions/preset.ts` pattern with `ctx.ui.custom()` and `SelectList`

Menu content should include:

- subcommand name
- description
- scope or source hint when useful

### 4. Missing-argument collection

Grouped prompts should pause and collect missing arguments before rendering.

Implementation note:

- copy Pi's internal `parseCommandArgs()` and `substituteArgs()` behavior locally unless Pi exports them in the target version
- do not import non-public Pi runtime internals directly

Because Pi prompt templates do not declare required args explicitly, this package must infer requirements from the template body.

Recommended inference rules:

- `$1`, `$2`, ... imply a minimum positional argument count up to the highest referenced index
- `${@:N}` implies at least `N` positional arguments for a non-empty slice
- `${@:N:L}` implies at least `N + L - 1` positional arguments when the slice is intended to be fully populated
- `$@` and `$ARGUMENTS` alone do not imply a minimum count

Collection flow:

1. parse provided args with Pi's `parseCommandArgs()`
2. detect unresolved required positions
3. prompt the operator for the missing values in order
4. continue once enough arguments are available

The goal is not to invent a new authoring format. The extension should infer as conservatively as possible from existing Pi-native placeholders.

### 5. Rendering pipeline

The rendering pipeline must separate Pi-native semantics from package-native preprocessing.

### Stage A: load template

- read the selected file
- parse frontmatter with `parseFrontmatter()`
- keep raw body content

### Stage B: Pi-native arg substitution

- parse invocation args with `parseCommandArgs()`
- render with `substituteArgs()`

This stage should match Pi behavior as closely as possible.

### Stage C: package-native preprocessing

Apply package-owned features after Pi-native substitution.

Planned order:

1. shell command substitution
2. later, conditional rendering
3. later, other explicit package-native expansions if added

This ordering keeps Pi-native syntax stable and makes added features opt-in and obvious.

### Stage D: dispatch

Send the final rendered content via `pi.sendUserMessage()`.

This ensures:

- the operator sees the fully rendered result
- the conversation history shows the actual expanded prompt
- Markdown is rendered as user content in the normal Pi flow

### 6. Shell command substitution

This package should support inline shell substitution inside prompt bodies.

Planned syntax:

```text
!`command`
```

Examples:

```markdown
Current branch: !`git branch --show-current`
Changed files:
!`git status --short`
```

Behavior:

- execute substitutions after argument rendering, before dispatch
- replace the placeholder with trimmed command output
- treat this as preprocessing, not model-side execution
- preserve full operator visibility by sending the rendered result as the final user message

Implementation notes:

- use `pi.exec('bash', ['-c', command], { timeout })`
- if shell-substitution parsing or replacement logic becomes useful in multiple Pi packages, treat it as a candidate for shared extraction after the second real consumer appears
- collect multiple substitutions before final replacement
- surface failures clearly in the rendered output or via a visible error path
- consider a notification summarizing executed substitutions

This should be implemented in the package-owned render pipeline, not as a global `input` hook, because prompt-body expansion must work even when the operator does not type the shell syntax directly into the editor.

### 7. Future conditional rendering

Conditional rendering is a package-native future feature.

It should not be implemented until the core grouped-routing and shell-substitution flow is stable.

Requirements for any future conditional system:

- clearly separate it from Pi-native syntax
- keep the rendered result fully visible to the operator
- avoid introducing a large, opaque template language too early
- keep evaluation deterministic and local to the render pipeline

Conditional rendering syntax is intentionally undecided in v1.

### 8. Scope, source, and diagnostics

The package should track prompt origin in its own registry:

- `bundled` for package-owned `prompts/<group>/...`
- `user` for `~/.pi/agent/composed/<group>/...`
- `project` for `.pi/composed/<group>/...`

Use that internal origin for:

- selector UI
- error messages
- debug output
- future inspection commands if added

Do not promise that Pi's own slash-command inventory will show these grouped prompts as native prompt commands, because the public extension API does not support that.

### 9. Reload behavior

The registry should rebuild on:

- startup
- reload

Target behavior:

- prompt directories are re-scanned when Pi reloads extensions and resources
- command state reflects added, removed, or changed grouped prompts after reload
- no duplicate stale state survives a reload

### 10. Suggested implementation slices

### Slice 1: core grouped routing

Deliver:

- directory scanner
- in-memory registry
- one command per group
- direct `/group subcommand` dispatch
- bare `/group` selector
- Pi-native arg substitution
- `pi.sendUserMessage()` dispatch

### Slice 2: argument collection and better UX

Deliver:

- missing-argument inference
- guided input collection
- clearer unknown-subcommand errors
- richer selector descriptions from `_index.md`

### Slice 3: module extraction and test infrastructure

Prerequisite for Slice 4 (preprocessing pipeline). The single-file implementation and hand-assertion test suite do not scale to the rendering scenarios shell substitution and future preprocessing stages introduce.

Deliver:

- extract `extensions/index.ts` into focused `src/` modules: `helpers.ts`, `discovery.ts`, `render.ts`, `ui.ts`, `types.ts`
- `extensions/index.ts` becomes thin lifecycle wiring
- add `test/render.test.ts` with inline-snapshot assertions for the substitution pipeline
- add `test/fixtures/` with reusable `.md` prompt files replacing hand-rolled fixture strings
- extend mock `ExtensionAPI` factory with `exec` capture, `on` event capture, and dispatch-mode tracking
- all existing tests continue to pass with equivalent or stronger coverage

### Slice 4: preprocessing pipeline

Deliver:

- shell substitution with `!`-backtick syntax
- visible failure handling
- operator-visible rendered results as the stable contract

### Slice 5: runtime correctness and diagnostics

Deliver:

- reload-safe registry rebuilds
- collision diagnostics
- scope-aware internal debug output
- documentation polish

### Slice 6: future package-native rendering features

Candidates:

- conditional rendering
- additional explicit render variables
- supporting files referenced from prompt groups

These are follow-on enhancements, not prerequisites for the first useful release.

## Open issues to keep explicit

1. Pi's public command API cannot assign per-command `sourceInfo` for extension commands.
2. Grouped prompts can faithfully reuse Pi parsing and substitution helpers, but they do not run through Pi's native prompt-template dispatch path.
3. Missing-argument inference is heuristic because native Pi templates do not declare required arguments.
4. Shell substitution must be bounded with sensible timeouts and visible error handling.

## Definition of done for the first useful release

A first useful release is done when:

- grouped prompt folders map cleanly to `/group subcommand`
- bare `/group` opens a usable selector
- rendered prompt content uses Pi-native argument semantics
- missing required args are collected before dispatch
- shell substitution works inside prompt bodies
- the operator can see the final rendered prompt in the conversation history
- flat native Pi prompt templates continue to work unchanged
- the known Pi API limitations are documented clearly rather than hidden
