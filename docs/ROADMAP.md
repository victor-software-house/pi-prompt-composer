# ROADMAP

This roadmap implements the product-level priorities defined in `FEATURE-SET.md` and the deeper design in `IMPLEMENTATION-PLAN.md`.

## PPC-001: Directory scanner and grouped prompt registry

Scan `~/.pi/agent/composed/` and `.pi/composed/` for composer-owned flat prompts and prompt subdirectories, migrating legacy grouped prompts from `prompts/<group>/` once.

Scope of scanning:

- only subdirectories participate in grouped routing
- flat `.md` prompt files under `composed/` become composer-owned commands
- flat `.md` prompt files under `prompts/` remain Pi-native and are ignored by this package
- `_index.md` is required group metadata under `composed/`
- other `.md` files become subcommands
- v1 supports one group level: `/group subcommand`

Acceptance criteria:

- discovers subdirectories in both global and project prompt locations
- loads `.md` files with Pi's `parseFrontmatter()` helper
- derives descriptions from frontmatter or first non-empty body line, matching Pi behavior
- records internal origin metadata (`bundled`, `user`, or `project`) for each group and subcommand
- ignores flat `.md` files under `prompts/` because Pi handles them natively
- discovers flat `.md` files under `composed/` because composer owns that location
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

## PPC-009: Lenient args validation and operator-visible warnings (mostly complete)

Harden the argument metadata pipeline so incomplete frontmatter degrades gracefully instead of silently breaking interactive collection.

See [`ISSUES.md`](ISSUES.md) for full defect descriptions (ISS-001 through ISS-004).

Acceptance criteria:

- ✅ `parseArgsMetadata` / `isValidArgsItem` accept items with missing `hint` (defaults to empty string) and missing `required` (defaults to `false`); only missing `name` rejects an individual item
- ✅ valid items in a partially malformed array are preserved; only the invalid items are dropped (with a per-item warning)
- ✅ discovery warnings surface through Pi's `ctx.ui.notify()` at load, reload, and startup — not just `console.warn`
- ✅ the dynamic usage hint and `ctx.ui.input()` title omit the ` — hint` suffix when hint is empty, rather than showing a dangling separator
- ⏳ mandatory vs optional args have a compact, obvious visual distinction in the selector (exact treatment to be validated visually before committing) — tracked as ISS-003
- ✅ tests cover: args with missing hint, args with missing required, mixed valid/invalid items in one array, empty hint rendering in selector and input, and warning surfacing

## PPC-011: Module extraction and test infrastructure (next — high priority)

Restructure the single-file implementation and test suite to support reliable, low-maintenance expansion of the rendering pipeline.

The current codebase ships all logic in one 586-line `extensions/index.ts` and tests it with hand-written assertions. This works for the current feature set but is not ready for PPC-006 (shell substitution) and beyond, where many rendering scenarios need snapshot validation and each pipeline stage needs independent testability.

Scope:

### Module extraction

- Extract `extensions/index.ts` into focused modules under `src/`:
  - `src/helpers.ts` — `parseCommandArgs`, `substituteArgs`, `toKebabCase`, `fmString`, and other pure helpers
  - `src/discovery.ts` — `getPromptRoots`, `discoverGroups`, args metadata parsing
  - `src/render.ts` — rendering pipeline: load template, substitute args, (future) preprocess, format output
  - `src/ui.ts` — `GroupSelectorComponent`, `showPromptSelector`, `formatUsageHint`, theme helpers
  - `src/types.ts` — shared interfaces (`ArgsItem`, `NestedPrompt`, `EffectivePromptGroup`, etc.)
- `extensions/index.ts` becomes thin wiring: imports modules, registers commands, handles lifecycle events

### Snapshot-based rendering tests

- Add `test/render.test.ts` — isolated pipeline tests: raw template content + args → rendered output
- Use `toMatchInlineSnapshot()` for all rendering and parsed-structure assertions
- Existing helper and discovery tests migrate to inline snapshots where it reduces maintenance

### Shared test fixtures

- Add `test/fixtures/` with real `.md` prompt files covering common and edge-case scenarios
- Add a `loadFixture()` helper or builder that returns `{ template, args, expected }` structs
- Replace hand-rolled `writeFileSync` frontmatter strings in discovery and extension-flow tests

### Mock factory hardening

- Extend the mock `ExtensionAPI` factory with `exec` call capture (needed for PPC-006 shell substitution)
- Add `on` event handler capture and invocation (needed to test `session_start` warning surfacing and reload)
- Add dispatch-mode tracking (needed for PPC-010 operator-only prompts)

Acceptance criteria:

- `extensions/index.ts` is thin wiring; all logic lives in `src/` modules
- each module is independently importable and testable
- `test/render.test.ts` exists with snapshot-based assertions for the full substitution pipeline
- `test/fixtures/` contains reusable `.md` prompt files used by discovery and extension-flow tests
- existing 75 tests continue to pass with equivalent or stronger coverage
- mock factory supports `exec`, `on` event capture, and dispatch-mode branching
- `pnpm run typecheck && pnpm run lint && pnpm run test` passes cleanly

## PPC-012: Bundled `/compose` helpers and authoring skill (complete)

Ship a package-owned `/compose` grouped command and a comprehensive `compose-grouped-prompts` skill.

Acceptance criteria:

- ✅ comprehensive skill with progressive disclosure lives in `skills/compose-grouped-prompts/`
- ✅ bundled `/compose new|add|remove` prompt files live in `prompts/compose/`
- ✅ discovery supports exact group roots (Case A: root itself is a group directory)
- ✅ bundled `/compose` is loaded first and can be overridden by user/project `/compose`
- ✅ `PromptScope` renamed to `PromptOrigin` with `'bundled' | 'user' | 'project'` values
- ✅ `resolveRelativePath()` uses `import.meta.url` for portable asset resolution
- ✅ `loadSingleGroup()` extracted as reusable helper
- ✅ `prompts/` and `skills/` included in package.json `files` and `pi` config
- ✅ 83 tests passing (8 new for bundled root, exact group root, override ordering)
- ✅ README documents `/compose` command and authoring skill

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
