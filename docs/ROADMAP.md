# ROADMAP

This roadmap implements the product-level priorities defined in `FEATURE-SET.md` and the deeper design in `IMPLEMENTATION-PLAN.md`.

## PPC-001: Directory scanner and grouped prompt registry

Scan `~/.pi/agent/prompts/` and `.pi/prompts/` for prompt subdirectories and build an in-memory grouped-prompt registry.

Scope of scanning:

- only subdirectories participate in grouped routing
- flat `.md` prompt files remain Pi-native and are ignored by this package
- `_index.md` is optional group metadata
- other `.md` files become subcommands
- v1 supports one group level: `/group subcommand`

Acceptance criteria:

- discovers subdirectories in both global and project prompt locations
- loads `.md` files with Pi's `parseFrontmatter()` helper
- derives descriptions from frontmatter or first non-empty body line, matching Pi behavior
- records internal scope metadata (`user` or `project`) for each group and subcommand
- ignores flat `.md` files because Pi handles them natively
- rebuilds the registry on startup and reload without stale duplicate state

## PPC-002: Command registration and autocomplete

For each discovered directory, register a single Pi extension command via `pi.registerCommand()`. The command name matches the directory name.

Acceptance criteria:

- one `/group` extension command per discovered prompt directory
- `getArgumentCompletions()` returns subcommand names from the directory listing, excluding `_index.md`
- command description prefers `_index.md` frontmatter description, then `_index.md` first non-empty body line, then the directory name
- extension commands intentionally take precedence over flat prompt templates with the same name
- command registration and docs explicitly acknowledge that Pi will report these as extension commands because the public API does not allow per-command `sourceInfo` overrides

## PPC-003: Subcommand dispatch and interactive bare-command selection

Command handlers resolve the target prompt from either a direct subcommand or an interactive selector opened from bare `/group`.

Acceptance criteria:

- `/superset create` resolves `superset/create.md`
- `/superset` with no subcommand opens an interactive menu listing the nested prompts
- selecting an option from the menu resolves the matching `.md` template
- unknown subcommand shows an error with available options
- selector UI shows useful labels and descriptions for nested prompts

## PPC-004: Pi-native argument semantics and guided argument collection

Grouped prompts should preserve Pi-native argument parsing and substitution while collecting missing arguments before rendering.

Acceptance criteria:

- invocation arguments follow Pi's `parseCommandArgs()` behavior exactly for the targeted Pi version
- template bodies follow Pi's `substituteArgs()` behavior exactly for the targeted Pi version
- public Pi exports are reused directly where available; non-exported prompt helpers are copied locally rather than imported from non-public Pi internals
- supported syntax remains Pi-native: `$1`, `$2`, `$@`, `$ARGUMENTS`, `${@:N}`, `${@:N:L}`
- missing required arguments are inferred conservatively from the template body and collected interactively before rendering
- `$@` and `$ARGUMENTS` alone do not force interactive collection
- rendered output after argument substitution matches Pi-native semantics as closely as the public extension API allows

## PPC-005: Render pipeline and visible user-message dispatch

Introduce a package-owned rendering pipeline that separates Pi-native substitution from extension-owned preprocessing, then dispatch the final result as a visible user message.

Acceptance criteria:

- rendering order is documented and implemented as: load template -> Pi-native arg substitution -> package-native preprocessing -> dispatch
- the final rendered prompt is sent with `pi.sendUserMessage()`
- the operator sees the actual expanded prompt in the conversation history
- Markdown in the rendered prompt appears as normal user-message content
- flat native Pi prompt templates continue to work unchanged outside grouped prompt directories

## PPC-006: Prompt-body shell substitution

Add shell command substitution inside grouped prompt bodies as a package-native preprocessing feature.

Planned syntax:

```text
!`command`
```

Acceptance criteria:

- shell substitutions run after Pi-native argument rendering and before dispatch
- multiple substitutions in one prompt body are supported
- substitutions execute with bounded timeouts through Pi's extension execution APIs
- command output replaces the placeholder in the rendered prompt body
- failure handling is visible and understandable to the operator
- rendered substitution output is present in the final user message bubble
- any helper duplicated from Pi internals is small, testable, and documented as a local copy rather than a hidden runtime dependency on Pi internals

## PPC-007: Scope-aware diagnostics and documented Pi API limits

Surface grouped prompt scope in package-owned UX while documenting where Pi public APIs do not expose the same metadata.

Acceptance criteria:

- internal registry distinguishes user-scoped and project-scoped grouped prompts
- package-owned selector UI, debug output, or diagnostics can surface that scope when useful
- docs clearly state that grouped commands appear as extension commands in Pi's built-in command inventory due to public API limits
- docs do not claim grouped commands are native Pi prompt commands internally

## PPC-008: Documentation and example prompts

Ship example prompt directories and document both Pi-native semantics and package-native preprocessing behavior.

Acceptance criteria:

- `docs/IMPLEMENTATION-PLAN.md` records the design, constraints, render pipeline, and implementation slices
- `docs/FEATURE-SET.md` distinguishes Pi-native semantics from package-native preprocessing
- `README.md` covers install, usage, directory convention, menu behavior, argument rules, and rendered-output behavior
- at least one realistic grouped prompt example is included
- docs clearly mark future conditional rendering as out of scope for the first useful release

## PPC-009: Lenient args validation and operator-visible warnings (next — high priority)

Harden the argument metadata pipeline so incomplete frontmatter degrades gracefully instead of silently breaking interactive collection.

See [`ISSUES.md`](ISSUES.md) for full defect descriptions (ISS-001 through ISS-004).

Acceptance criteria:

- `parseArgsMetadata` / `isValidArgsItem` accept items with missing `hint` (defaults to empty string) and missing `required` (defaults to `false`); only missing `name` rejects an individual item
- valid items in a partially malformed array are preserved; only the invalid items are dropped (with a per-item warning)
- discovery warnings surface through Pi's `ctx.ui.notify()` at load, reload, and startup — not just `console.warn`
- the dynamic usage hint and `ctx.ui.input()` title omit the ` — hint` suffix when hint is empty, rather than showing a dangling separator
- mandatory vs optional args have a compact, obvious visual distinction in the selector (exact treatment to be validated visually before committing)
- tests cover: args with missing hint, args with missing required, mixed valid/invalid items in one array, empty hint rendering in selector and input, and warning surfacing

## PPC-010: Operator-only prompts with custom logic

Support grouped prompts that execute custom logic and show results only to the operator, without dispatching a user message to the model.

Use cases include reminders, environment status checks, setup scripts, local tooling invocations, and any prompt whose purpose is operator-side effects rather than agent conversation.

Planned mechanism:

- a frontmatter flag (e.g. `dispatch: none` or `target: operator`) marks a prompt as operator-only
- the render pipeline runs normally: arg substitution, shell preprocessing, full expansion
- instead of `pi.sendUserMessage()`, the rendered output is displayed to the operator through `ctx.ui.notify()` or a similar operator-visible channel
- custom logic (shell substitution via `!\`command\``) runs and its output is part of the operator-visible result
- the model never sees the prompt or its output in conversation history

Acceptance criteria:

- a frontmatter key opts a grouped prompt out of model dispatch
- the full render pipeline (args, shell substitution) still executes
- rendered output is shown to the operator in a visible, readable form
- the conversation history is not affected
- operator-only prompts participate in the same menu, autocomplete, and discovery as regular grouped prompts
- docs clearly distinguish operator-only prompts from model-dispatched prompts

## Deferred work

These are explicit follow-on items, not first-release requirements:

- deeper nesting beyond `/group subcommand`
- aliases or alternate command names
- conditional rendering
- additional package-native render variables
- supporting-file conventions for grouped prompts beyond `_index.md`
