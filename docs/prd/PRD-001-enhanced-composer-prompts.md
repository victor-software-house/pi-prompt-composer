---
title: "Enhanced Composer Prompts"
prd: PRD-001
status: Draft
owner: "Victor Software House"
issue: "#6"
date: 2026-05-07
version: "1.0"
---

# PRD: Enhanced Composer Prompts

---

## 1. Problem & Context

`pi-prompt-composer` currently adds grouped slash-command routing on top of Pi's native prompt-template system. A prompt directory with `_index.md` and nested `.md` files becomes `/group subcommand`; flat `.md` files remain Pi-native and are ignored by this package.

That model solves prompt organization, but it creates two product gaps:

1. **Single enhanced prompts are impossible without an artificial folder.** GitHub issue [#6](https://github.com/victor-software-house/pi-prompt-composer/issues/6) reports this directly: users want plain prompt files, not forced directories.
2. **Current rendering is not powerful enough for serious prompt workflows.** The package mostly mirrors Pi-native `$1`, `$@`, `$ARGUMENTS`, and `${@:N}` substitution. Planned shell substitution helps, but it still leaves composer below the customization bar expected from modern coding-agent prompt systems.

Current code reality:

* `extensions/index.ts` owns discovery, registry, command registration, selector UI, arg parsing, arg collection, rendering, and dispatch in one file.
* `discoverGroups()` only discovers directories; flat files are left to Pi.
* `parseArgsMetadata()` accepts a lenient ordered args array with named items, required/default behavior, enum values, booleans, numbers, repeatable `string[]`, and `rest: true` metadata.
* `substituteArgs()` implements Pi-like positional replacement plus escaped dollar support.
* `resolvePromptArgs()` collects required args through `ctx.ui.input()`, validates current typed fields, supports positional fallback for declared args, and preserves raw `argv` / `arguments` context for Liquid.
* `pi.sendUserMessage(rendered, { deliverAs: 'followUp' })` dispatches visible rendered content.

The next product step should be first-class **composer-owned prompt files** with a real template engine, typed argument schema, and a unified rendering pipeline for both flat and grouped prompts.

---

## 2. Goals & Success Metrics

| Goal                                   | Metric                                                                                 | Target                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **First-class flat composer prompts**  | A `.md` file can be registered and dispatched by composer without a folder             | 100% support for opted-in flat files in user, project, and bundled composer roots        |
| **Powerful semantic rendering**        | Prompt authors can use conditionals, loops, filters, and named variables               | Liquid-powered prompts cover core template use cases without custom ad hoc syntax        |
| **Robust typed arg collection**        | Args can declare type, required/default behavior, prompts, enum values, and validation | Invalid metadata yields visible diagnostics; valid metadata drives correct UI collection |
| **Compatibility-preserving migration** | Existing grouped prompts keep working unchanged                                        | Existing test suite stays green; current `engine: pi` behavior remains supported         |
| **Issue #6 resolution**                | User can author a single plain file instead of a folder                                | `/review` from `.pi/composed/review.md` works without any frontmatter `type` marker      |

**Guardrails (must not regress):**

* Existing grouped prompt routing: `/group`, `/group subcommand`, selector, autocomplete continue to dispatch the same rendered output after migration.
* Existing bundled `/compose` group and authoring skill (bundled package layout is unaffected by user-tree migration).
* Existing Pi-like substitution for current prompts.
* Visible rendered output in conversation history for model-dispatched prompts.
* Discovery warnings through Pi UI, not only console output.
* Flat Pi-native prompts that do not opt into composer behavior continue to work through Pi.

---

## 3. Users & Use Cases

### Primary: Prompt author

> As a prompt author, I want to create a single enhanced prompt file so that I do not need a folder and fake subcommand for one workflow.

**Preconditions:** The author has a composer prompt root such as `~/.pi/agent/composed/` or `.pi/composed/`. Anything under those roots is composer-owned by location alone; no frontmatter `type` marker is required. Files under native Pi prompt roots (`.pi/prompts/*.md`) are not composer-owned and stay native Pi resources.

### Primary: Power prompt author

> As a power prompt author, I want named variables, conditionals, loops, and typed inputs so that prompts can adapt to context without becoming brittle prose instructions.

**Preconditions:** The prompt file opts into the enhanced rendering engine.

### Secondary: Existing composer user

> As an existing grouped-prompt user, I want my current prompt groups to keep working so that adopting enhanced templates does not break my current workflows.

**Preconditions:** Existing prompts use `_index.md` (with or without legacy `type: group`) and current `args` array syntax.

### Future: Package maintainer

> As a package maintainer, I want rendering, discovery, args, and UI split into modules so that shell substitution, operator-only dispatch, and future context providers can be added without making `extensions/index.ts` harder to change.

---

## 4. Scope

### In scope

1. **Composer-owned flat prompt files** — discover eligible `.md` files directly under composer-owned prompt roots (`.pi/composed/`, `~/.pi/agent/composed/`) and register them as slash commands.
2. **Location-based prompt ownership** — `.pi/composed/` is composer-only; every `.md` under it is composer-owned without any frontmatter `type` marker. Folders under `composed/` containing `_index.md` are groups; sibling `.md` files are flat prompts.
3. **Template engine selection** — support `engine: pi` for current behavior and `engine: liquid` for enhanced rendering.
4. **Liquid rendering pipeline** — render named data, conditionals, loops, filters, and safe local context through a deterministic pipeline.
5. **Typed argument schema** — add expressive named args while preserving legacy positional args.
6. **Interactive collection and validation** — collect missing required args based on schema, validate inputs, and show actionable UI errors.
7. **Unified prompt model** — represent flat and grouped prompts through one internal `PromptDefinition` model.
8. **Legacy layout migration** — move existing user/project grouped prompts from `.pi/prompts/<group>/` and `~/.pi/agent/prompts/<group>/` into `.pi/composed/<group>/` and `~/.pi/agent/composed/<group>/` once at startup, warn on collisions, and stop reading the legacy location after migration.
9. **Docs and examples** — document flat enhanced prompts, grouped prompts, engine choices, arg schemas, and migration guidance.
10. **Tests** — cover discovery, rendering, args, command dispatch, diagnostics, migration, and compatibility.

### Out of scope / later

| What                                             | Why                                                              | Tracked in             |
| ------------------------------------------------ | ---------------------------------------------------------------- | ---------------------- |
| `default.md` for grouped folders                 | Useful sugar, but flat prompt files solve issue #6 more directly | Future issue           |
| Deep nested commands such as `/a b c`            | Routing complexity unrelated to enhanced single prompts          | Existing non-goal      |
| Full Claude Code prompt compatibility            | Target parity in capability, not byte-for-byte syntax            | Future research        |
| Remote/network context providers                 | Security and latency need separate design                        | Future issue           |
| Arbitrary unbounded shell execution in templates | Requires permission, timeout, and visibility policy              | PPC-006 / future issue |
| Prompt inheritance across directories            | Adds mental model cost before core flat-file support is proven   | Future issue           |

### Design for future (build with awareness)

The implementation should make later features cheaper without shipping them now:

* Model prompt rendering as a pipeline with explicit stages: load → normalize args → collect/validate → render → preprocess → dispatch.
* Keep `TemplateEngine` as an interface so `engine: liquid` does not hardcode all future rendering behavior.
* Keep context providers behind explicit allowlisted sources (`args`, `prompt`, `git`, later `shell`) rather than exposing broad process state by default.
* Make dispatch mode a first-class prompt property so `dispatch: model` and future `dispatch: operator` can share rendering.

---

## 5. Functional Requirements

### FR-1: Discover composer-owned flat prompt files

Composer must discover eligible flat `.md` files under composer-owned prompt roots and register each as a slash command. Valid roots are top-level paths Pi never reads as native prompt templates:

* project: `.pi/composed/**/*.md`
* user: `~/.pi/agent/composed/**/*.md`
* bundled/package-owned: package files scanned by the extension itself, not exposed through `pi.prompts`

Composer must not use root-level native Pi prompt paths such as `.pi/prompts/*.md` or `~/.pi/agent/prompts/*.md` for flat composer prompt files. Pi auto-discovers those files as native prompt templates, which would create duplicate command visibility and a native execution path. Pi reserves `extensions/`, `skills/`, `prompts/`, and `themes/` under `.pi/` and `~/.pi/agent/`; `composed/` is unclaimed by Pi.

Ownership is determined entirely by location. No `type: prompt` marker is required. Frontmatter is still parsed for `description`, `argument-hint`, `args`, `engine`, `enabled`, and other prompt metadata; the `type` field, if present, is preserved for backwards compatibility but never required for new prompts.

**Acceptance criteria:**

```gherkin
Given .pi/composed/review.md exists with no `type` frontmatter
When Pi reloads with pi-prompt-composer enabled
Then composer registers /review as an extension command
And invoking /review renders review.md through composer
And Pi native prompt discovery does not list review.md as a native prompt template
```

```gherkin
Given .pi/prompts/native.md exists under the native Pi prompt root
When Pi reloads with pi-prompt-composer enabled
Then composer does not register /native
And Pi native prompt handling remains responsible for /native
```

```gherkin
Given .pi/prompts/review.md declares any composer-style frontmatter such as `engine: liquid`
When Pi reloads with pi-prompt-composer enabled
Then composer reports review.md as misplaced
And tells the author to move it to .pi/composed/review.md
And Pi native prompt expansion still owns /review until the file is moved
```

**Files:**

* `extensions/index.ts` — current discovery entrypoint until module extraction.
* `src/discovery.ts` — target home for flat and grouped discovery.
* `src/types.ts` — prompt definition types.
* `test/discovery.test.ts` — flat prompt discovery coverage.

---

### FR-2: Preserve grouped prompt behavior across migration

Existing grouped prompt behavior must continue unchanged unless a prompt opts into new rendering features. Group source location must move from `.pi/prompts/<group>/` (legacy) to `.pi/composed/<group>/` (canonical) on first run after upgrade through a one-shot migration; runtime dispatch behavior, ordering, args, selectors, and autocomplete must remain identical to pre-migration behavior.

**Acceptance criteria:**

```gherkin
Given .pi/prompts/review/_index.md contains type: group
And .pi/prompts/review/summary.md is an existing current-style prompt
And .pi/composed/review/ does not yet exist
When the extension loads after upgrade
Then composer moves .pi/prompts/review/ to .pi/composed/review/
And emits a UI warning naming both paths
And /review summary "my change" dispatches the same rendered content as before this PRD
```

```gherkin
Given .pi/prompts/review/_index.md contains type: group
And .pi/composed/review/ already exists
When the extension loads after upgrade
Then composer skips the move
And emits an explicit collision warning naming both group locations
And the legacy group is ignored until the operator resolves the collision
```

**Files:**

* `extensions/index.ts` / `src/discovery.ts` — keep group detection and ordering after the migrated location is canonical.
* `src/migrate.ts` — new one-shot migration step run before discovery.
* `src/render.ts` — preserve `engine: pi` rendering.
* `test/extension-flow.test.ts` — existing direct dispatch and selector tests, plus migration scenarios.
* `test/order.test.ts` — group order compatibility.
* `test/migrate.test.ts` — migration coverage including collision behavior.

---

### FR-3: Support Liquid as enhanced template engine

Composer must support `engine: liquid` for flat and grouped prompts that opt in. Liquid templates must receive a named render context rather than positional-only strings.

Minimum context shape:

```ts
{
  args: Record<string, unknown>;
  argv: string[];
  arguments: string;
  prompt: {
    name: string;
    groupName?: string;
    origin: 'bundled' | 'user' | 'project';
    filePath: string;
  };
  now: string;
}
```

**Acceptance criteria:**

```gherkin
Given .pi/composed/review.md declares engine: liquid
And its body contains "Review {{ args.change }} in {{ args.mode }} mode"
When the user runs /review --change "fix auth" --mode deep
Then the visible dispatched message contains "Review fix auth in deep mode"
```

```gherkin
Given a Liquid prompt body contains a loop over args.files
When args.files contains ["a.ts", "b.ts"]
Then the rendered output contains one line for a.ts and one line for b.ts
```

```gherkin
Given a Liquid prompt body contains "{{ argv | join: ',' }}" and "{{ arguments }}"
When the user runs the prompt with "alpha beta gamma"
Then `argv` equals ["alpha", "beta", "gamma"]
And `arguments` equals "alpha beta gamma"
```

**Files:**

* `package.json` / `pnpm-lock.yaml` — add renderer dependency after implementation spike. `liquidjs` latest checked on 2026-05-07: `10.25.7`; `handlebars` latest checked: `4.7.9`.
* `src/render.ts` — engine dispatch and Liquid renderer.
* `test/render.test.ts` — inline snapshots for Liquid rendering.
* `docs/FEATURE-SET.md` — update product model.
* `README.md` — document `engine: liquid`.

---

### FR-4: Support typed named argument schemas

Composer must support the current ordered args array schema for enhanced prompts. Ordered array form is the public schema because it preserves positional fallback, required-arg collection order, and final-arg `rest: true` behavior without relying on object key order.

Current schema:

```yaml
args:
  - name: change
    type: string
    required: true
    hint: What changed?
  - name: mode
    type: enum
    values: [quick, normal, deep]
    default: normal
  - name: include_tests
    type: boolean
    default: true
  - name: files
    type: string[]
    required: false
  - name: description
    type: string[]
    required: false
    rest: true
```

Named CLI args must support both `--name value` and `name=value`; `--name value` is the documented canonical style. Optional `--name=value` support is acceptable if it falls out of the parser cleanly. Liquid prompts bind declared args from named values first, then from positionals when a named value is absent. Liquid prompts also expose `argv` and `arguments` for raw positional access.

Supported initial types and controls:

* `string`
* `boolean`
* `number`
* `enum`
* `string[]`
* `rest: true` on the final `string[]` arg to capture remaining positionals into that arg

Current validation scope is `required`, `type`, `values`, `default`, repeated named args, comma-separated `string[]` coercion, and `rest: true`. Future declarative validators such as `validate.pattern`, `validate.message`, numeric ranges, string lengths, and array item counts are allowed design extensions, but they are not prerequisites for bundled `/compose` Liquid migration.

**Acceptance criteria:**

```gherkin
Given a prompt declares args.change as a required string
When the user invokes the command without change
Then composer asks for change using the configured prompt text
And empty input is rejected with a warning
```

```gherkin
Given a prompt declares args.mode as enum values [quick, normal, deep]
When the user provides mode=invalid
Then composer does not render the prompt
And the UI warns that mode must be one of quick, normal, deep
```

```gherkin
Given a prompt declares args.mode with default normal
When the user omits mode
Then args.mode equals normal during template rendering
```

```gherkin
Given a prompt declares args.files with type string[]
When the user provides files=a.ts files=b.ts
Then args.files equals ["a.ts", "b.ts"] during template rendering
```

```gherkin
Given a prompt declares args.files with type string[]
When the user provides files=a.ts,b.ts
Then args.files equals ["a.ts", "b.ts"] during template rendering
```

```gherkin
Given a Liquid prompt declares the final arg with type string[] and rest true
When the user runs /compose new review create review workflows
Then args.description equals ["create", "review", "workflows"]
And the prompt can render "create review workflows" with join
```

**Files:**

* `src/args.ts` — new arg schema parser, coercion, validation, defaults.
* `src/ui.ts` — input/select collection for typed args.
* `src/render.ts` — pass typed args to engine.
* `test/helpers.test.ts` or `test/args.test.ts` — schema parser tests.
* `test/extension-flow.test.ts` — interactive collection tests.

---

### FR-5: Keep legacy args array and Pi-style engine compatible

Current minimal `args` array syntax and Pi-like substitution must remain valid for existing prompts.

**Acceptance criteria:**

```gherkin
Given a grouped prompt uses args as an array with name, required, and hint
And its body contains "Hello $1"
When the user invokes the prompt with "world"
Then the rendered output remains "Hello world"
```

**Files:**

* `src/args.ts` — normalize legacy and enhanced arg metadata into internal structures.
* `src/render.ts` — keep `engine: pi` renderer.
* `test/helpers.test.ts` — current `substituteArgs()` tests.
* `test/extension-flow.test.ts` — current command behavior tests.

---

### FR-6: Provide deterministic command precedence

Composer must define how flat composer prompts, grouped composer prompts, bundled prompts, and native Pi prompts interact.

Required precedence:

1. Project composer prompts
2. User composer prompts
3. Bundled composer prompts
4. Native Pi prompts only when composer did not register same command

Within composer, explicit duplicate detection must warn when two composer resources claim the same command.

**Acceptance criteria:**

```gherkin
Given user and project composer prompt roots both define a flat command review
When Pi reloads
Then project review wins
And composer shows a duplicate command warning naming both origins
```

```gherkin
Given native Pi has .pi/prompts/review.md
And composer has .pi/composed/review.md
When Pi reloads
Then invoking /review routes to the composer extension command
And composer warns that the native /review prompt is shadowed by a composer-owned command
And docs explain this is intentional hybrid precedence
```

**Files:**

* `src/discovery.ts` — duplicate detection.
* `src/commands.ts` or `extensions/index.ts` — registration ordering.
* `test/discovery.test.ts` — origin precedence tests.
* `README.md` — precedence docs.

---

### FR-7: Rendered output remains visible before model dispatch

Enhanced rendering must preserve the existing product promise that the operator sees the final expanded prompt as conversation content.

**Acceptance criteria:**

```gherkin
Given a Liquid prompt renders variables and conditionals
When composer dispatches it to the model
Then the user message bubble contains the final rendered text
And hidden intermediate template syntax is not sent
```

**Files:**

* `src/render.ts` — final rendered content contract.
* `src/dispatch.ts` or `extensions/index.ts` — dispatch mode handling.
* `test/extension-flow.test.ts` — `sendUserMessage()` content assertions.

---

### FR-8: Surface useful metadata diagnostics

Malformed prompt frontmatter, invalid arg schemas, unknown engines, and render failures must be visible through Pi UI notifications.

**Acceptance criteria:**

```gherkin
Given a prompt declares engine: liquid but has malformed Liquid syntax
When the user invokes the prompt
Then composer does not send a user message
And the UI notification names the prompt file and render error
```

```gherkin
Given a prompt declares args.mode as enum but omits values
When Pi reloads
Then composer warns that args.mode has invalid enum metadata
And the prompt is skipped or degraded according to documented rules
```

**Files:**

* `src/diagnostics.ts` — structured warnings/errors.
* `src/discovery.ts` — metadata diagnostics.
* `src/render.ts` — render diagnostics.
* `test/tool-guard.test.ts` / `test/discovery.test.ts` — notification behavior.

---

### FR-9: Document and ship examples for the new model

Docs must make the authoring model clear enough for cold readers.

**Acceptance criteria:**

```gherkin
Given a new user reads README.md
When they want one enhanced prompt
Then they can copy a flat .md example and invoke it successfully
```

```gherkin
Given an existing user reads the migration docs
When they have current grouped prompts
Then they understand they do not need to migrate unless they want Liquid or typed args
```

**Files:**

* `README.md` — quick start and authoring reference.
* `docs/FEATURE-SET.md` — revised product model.
* `docs/IMPLEMENTATION-PLAN.md` — architecture and slices.
* `docs/ROADMAP.md` — work items.
* `examples/prompts/` — flat enhanced prompt examples.
* `skills/compose-grouped-prompts/` — update if authoring workflows expand beyond groups.

---

### FR-10: Support resource-level enable and disable semantics

Composer must support disabling whole groups and individual prompts without relying on file deletion.

Resource defaults use frontmatter on the prompt file or `_index.md`:

```yaml

---

enabled: false

---

```

Required behavior:

* `enabled: false` on `_index.md` disables the whole group path and all children at that origin.
* `enabled: false` on a grouped subcommand disables only that subcommand path.
* `enabled: false` on a flat composer prompt disables that flat command path.
* A higher-precedence disabled resource acts as a tombstone for the same command path so lower-precedence composer resources do not unexpectedly reappear.
* Operator config may later add a global disabled path list such as `/review` or `/review fix`; that config should mask matching resources across origins.
* Disabled paths under `.pi/composed/` never need an `input`-event blocker because Pi never sees them; the blocker only applies to legacy or misplaced paths still resolving through native Pi prompts.

**Acceptance criteria:**

```gherkin
Given project .pi/composed/review/_index.md declares enabled: false
And user prompts also define /review
When Pi reloads
Then composer does not register /review
And /review is reported as disabled by the project resource
```

```gherkin
Given .pi/prompts/review/fix.md declares enabled: false
When Pi reloads
Then /review fix is not offered in autocomplete or the selector
And other enabled /review subcommands still work
```

**Files:**

* `src/discovery.ts` — parse enabled state and tombstones.
* `src/types.ts` — resource status and disabled path types.
* `src/commands.ts` — omit disabled resources and block disabled paths in hybrid mode.
* `test/discovery.test.ts` — group, prompt, and origin-precedence disable cases.
* `test/extension-flow.test.ts` — disabled path dispatch behavior.

---

## 6. Non-Functional Requirements

| Category              | Requirement                                                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Compatibility**     | Existing grouped prompts and bundled `/compose` must work without modification.                                                                                            |
| **Security**          | Template rendering must not expose arbitrary process globals, filesystem access, network access, or shell execution unless explicitly added through allowlisted providers. |
| **Determinism**       | Rendering with the same prompt file, args, and context must produce the same output.                                                                                       |
| **Diagnostics**       | Discovery and render errors must name the prompt command and file path.                                                                                                    |
| **Performance**       | Discovery should stay bounded to one prompt-root level for flat files and one group level for grouped prompts.                                                             |
| **Testability**       | Rendering, arg parsing, discovery, and UI collection must be independently testable after module extraction.                                                               |
| **Headless behavior** | Noninteractive contexts must fail clearly when required args are missing rather than hanging on UI input.                                                                  |

---

## 7. Risks & Assumptions

### Risks

| Risk                                                                  | Severity | Likelihood | Mitigation                                                                                                                                                                                                   |
| --------------------------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Liquid support creates a second mental model beside Pi-native prompts | Medium   | High       | Separate resource ownership (location) from rendering (`engine`) and document the model with examples.                                                                                                       |
| Composer flat prompts shadow native Pi prompts unexpectedly           | High     | Medium     | Keep flat composer prompt files under `.pi/composed/`; warn on duplicate composer commands.                                                                                                                  |
| Authors leak documentation files into `composed/`                     | Medium   | Medium     | Document that `composed/` is exclusively for prompts; warn on any `.md` whose frontmatter looks intentionally non-prompt; rely on social convention plus visible warnings rather than `type` gating.         |
| Disabled prompts reappear from lower-precedence or native resources   | High     | Medium     | Treat higher-precedence disabled composer resources as tombstones; keep valid flat composer files under `composed/` so native prompt discovery never sees them; only block misplaced/legacy paths if needed. |
| Migration moves user files unexpectedly                               | High     | Medium     | One-shot migration is idempotent, refuses to overwrite existing `composed/<group>/`, emits explicit warnings, and never deletes content. Operator-visible diagnostic always names source and target paths.   |
| Read-only filesystems or worktree-quirky setups break migration       | Medium   | Low        | If migration cannot move (permissions, EXDEV, locked files), emit an actionable warning and continue reading the legacy path for that session only; warn again next session until resolved.                  |
| Arg schema becomes too complex too soon                               | Medium   | Medium     | Ship small type set first; defer nested objects, computed defaults, and complex validation.                                                                                                                  |
| Template context leaks sensitive env or filesystem data               | High     | Low        | Expose only explicit `args`, `argv`, `arguments`, `now`, and prompt metadata by default; add providers through allowlists and docs.                                                                          |
| Single-file `extensions/index.ts` becomes harder to evolve            | Medium   | High       | Make module extraction part of rollout before or alongside enhanced rendering.                                                                                                                               |
| Liquid library behavior differs from prompt-author expectations       | Medium   | Medium     | Add snapshot tests for all documented syntax and link docs to supported subset.                                                                                                                              |

### Assumptions

* Composer resource ownership comes from location (`.pi/composed/` and `~/.pi/agent/composed/`); `engine` identifies rendering behavior.
* `_index.md` presence inside a `composed/` subfolder identifies a group; sibling `.md` files are subcommand prompts. No `type: group` marker is required on new content.
* Flat composer prompt ownership is established by location alone; future composer-owned `engine: pi` prompts with non-native behavior such as enable/disable, typed args, dispatch modes, or preprocessing also rely on location, not on a frontmatter marker.
* Valid flat composer prompt files live under top-level composer roots (`.pi/composed/` and `~/.pi/agent/composed/`) so the same file cannot also appear or execute as a native Pi prompt. Pi reserves `extensions/`, `skills/`, `prompts/`, and `themes/` under those bases; `composed/` is unclaimed by current Pi versions.
* `.pi/composed/` is the canonical composer prompt location. Existing user/project grouped prompts under `.pi/prompts/<group>/_index.md type: group` are migrated once at startup to `.pi/composed/<group>/` and the legacy path is no longer read after migration. Bundled package prompts stay inside the package source tree and are not migrated.
* Misplaced composer-style files in `.pi/prompts/*.md` (for example with `engine: liquid` or other composer-specific frontmatter) are warned about with move instructions; composer does not auto-move them because Pi has already loaded them as native prompts in the same session.
* Flat root files in native Pi prompt roots (`.pi/prompts/*.md` and `~/.pi/agent/prompts/*.md`) without composer-specific frontmatter remain owned by native Pi prompt processing.
* The default processing mode is hybrid: composer handles explicitly owned resources and Pi handles unowned native prompts.
* Liquid is preferred over Handlebars unless a spike finds a blocking API, security, size, or ESM issue.
* Liquid filters start as a documented safe allowlist. Filesystem, environment, network, shell, or process-state access is excluded unless added later as explicit package-owned providers.
* Current user/project/bundled origin model remains sufficient for flat prompts.
* Pi extension command precedence continues to put composer commands before native prompt templates.
* `pi.sendUserMessage()` remains the correct dispatch path for visible model-facing prompts.

---

## 8. Design Decisions

### D1: Flat enhanced prompts are first-class; `default.md` is deferred

**Options considered:**

1. Add `default.md` inside grouped folders — supports `/group` dispatch, but still forces a folder for one prompt.
2. Register composer-owned flat files — directly solves issue #6 and gives single prompts access to enhanced rendering.
3. Keep current folder-only design — simplest, but rejects direct user feedback.

**Decision:** Implement composer-owned flat prompt files first using top-level `composed/` composer prompt roots. Defer `default.md`.

**Rationale:** Issue #6 is about being forced into grouped folders. A `default.md` convention still requires folders and makes the common single-prompt case awkward. Native Pi auto-discovers root-level `.md` files under `.pi/prompts/`, so composer-owned single files need a separate top-level composer root (`.pi/composed/`) to guarantee one slash command and no native prompt execution path.

**Future path:** Add `default.md` later only if grouped folders need a default action in addition to selector behavior.

### D2: Use Liquid as enhanced engine, keep Pi engine for compatibility

**Options considered:**

1. Liquid — conditionals, loops, filters, sandbox-friendly model, readable syntax.
2. Handlebars — common ecosystem, but helpers add ceremony and logic is less natural for prompt authors.
3. Custom syntax — maximum control, but high design and maintenance cost.
4. Pi-native only — compatible, but not powerful enough for target workflows.

**Decision:** Add `engine: liquid` for enhanced prompts and keep `engine: pi` for existing behavior.

**Rationale:** Liquid provides the right balance of power, safety, readability, and authoring ergonomics. It is closer to “semantic prompt rendering” than positional substitution.

**Future path:** Keep engine dispatch pluggable, but do not add more engines until Liquid usage proves gaps.

### D3: Use ordered args array schema for enhanced prompts

**Options considered:**

1. Preserve only untyped positional args array — compatible but weak.
2. Add object-based named args schema — expressive, but conflicts with positional fallback, collection order, and final rest capture.
3. Add ordered named args array — expressive, validates well, maps naturally to `args.name` in Liquid, and preserves order-sensitive behavior.
4. Infer args from template variables — magical and brittle.

**Decision:** Use the ordered named args array as the current public schema for both Pi-engine and Liquid prompts.

**Rationale:** Liquid templates need named values, but composer also needs deterministic collection order, position-based fallback, and `rest: true` for freeform tails. Ordered array schema provides both without relying on object key order.

**Future path:** Object-map syntax may be considered later only as an ergonomic alias, not as replacement for ordered schema.

### D4: Drop typed composer resource markers in favor of location-based ownership

**Options considered:**

1. Keep author-facing `type: prompt` and `type: group` markers — explicit but redundant once `composed/` is a composer-only directory.
2. Drop both `type` markers and rely on `composed/` location plus `_index.md` presence — minimal frontmatter, no double-marking, no validation churn.
3. Use file extension variants like `.composer.md` — explicit but uglier and not aligned with native Pi.

**Decision:** Drop `type: prompt` and `type: group` requirements. Composer ownership is determined by location: any `.md` under `.pi/composed/` (or `~/.pi/agent/composed/`) is composer-owned. A subfolder under `composed/` containing `_index.md` is a group; sibling `.md` files are subcommand prompts. `engine` continues to choose how owned content renders.

**Rationale:** The original purpose of `type: prompt` was to gate composer ownership inside `.pi/prompts/`, where the directory was shared with native Pi prompts. With composer files in their own top-level `composed/` directory, the gate is redundant — location already provides unambiguous ownership. Same for `type: group`: `_index.md` is the marker. Removing the markers reduces author boilerplate, removes a class of validation work, and keeps the model uniform with how Pi already uses `_index.md`-style folder conventions. Legacy `type` fields encountered in migrated content are preserved unchanged so older repos keep working without rewrites.

**Future path:** If Pi later exposes native prompt enable/disable or typed prompt metadata, re-evaluate whether composer needs typed markers again. Until then, location is the contract.

### D5: Support named CLI args and positional fallback for Liquid

**Options considered:**

1. Use only `--name value` — familiar CLI style and easy to document.
2. Use only `name=value` — compact and prompt-template friendly, but less standard for flags.
3. Support both named styles — ergonomic for different author habits.
4. Map positional values into named Liquid args by schema order — concise and needed for Pi-style command UX, but requires clear precedence and rest rules.

**Decision:** Support `--name value` and `name=value` for named args, document `--name value` as canonical, and support positional fallback for declared Liquid args when named values are absent. Expose `argv`, `arguments`, and final-arg `rest: true` for freeform tails.

**Rationale:** Composer-owned prompts need readable named values and source-compatible Pi-like invocation. Named args win when provided; otherwise ordered positionals fill declared args. `rest: true` makes freeform tails explicit instead of overloading all array args.

**Future path:** Add boolean shorthand such as `--include-tests` only after the baseline parser and validation behavior are proven.

### D6: Start Liquid with a safe filter allowlist

**Options considered:**

1. Expose all Liquid defaults — fastest and closest to upstream, but harder to document and audit.
2. Expose a package-owned allowlist of safe filters — slower to curate, but deterministic and safer.
3. Disable filters entirely — safest, but removes core Liquid value.

**Decision:** Ship a documented allowlist of safe Liquid defaults and add package-owned filters explicitly over time.

**Rationale:** Prompt templates should not gain hidden access to filesystem, environment, process state, shell execution, or network behavior through rendering. A documented allowlist makes supported syntax testable and sets a clear extension point.

**Future path:** Add new filters only when a use case needs them, with tests and docs for each filter.

### D7: Use typed args for flat and grouped enhanced prompts

**Options considered:**

1. Restrict typed args to flat prompts first — smaller initial surface, but creates divergent behavior.
2. Support ordered typed args for any `engine: liquid` prompt, flat or grouped — one model for enhanced prompts.
3. Retain legacy arrays everywhere — compatible, but blocks typed Liquid use in groups.

**Decision:** Support ordered typed args for flat and grouped prompts that opt into enhanced rendering.

**Rationale:** Grouped and flat prompts should share the same internal `PromptDefinition` model and rendering pipeline. Artificially limiting typed args to flat prompts would add migration work later.

**Future path:** Keep legacy array args supported for current `engine: pi` prompts and document migration examples.

### D8: Keep `default.md` deferred

**Options considered:**

1. Track `default.md` immediately as a separate issue.
2. Wait until flat prompts ship, then reassess grouped-folder default actions.

**Decision:** Defer `default.md` tracking until flat composer prompts ship.

**Rationale:** `default.md` does not solve the source issue as directly as flat files and may conflict with the current bare `/group` selector behavior. Reassessing after flat prompt usage avoids designing sugar before the core model is proven.

### D9: Use hybrid processing, not full prompt takeover

**Options considered:**

1. Full takeover — intercept and render all `/name` prompts through composer.
2. Hybrid — composer registers only explicitly typed resources and lets Pi process native prompts.
3. Mirror-only — composer only reports collisions and never blocks native prompts.

**Decision:** Use hybrid processing for this PRD.

**Rationale:** Full takeover would require reimplementing Pi's prompt expansion, autocomplete, and future prompt behavior exactly. Hybrid mode keeps native Pi prompts on Pi's path while giving composer a clear surface for groups, Liquid prompts, typed args, dispatch modes, and disabled paths.

**Future path:** Consider full takeover only if Pi exposes enough public prompt APIs or if composer needs a unified prompt manager with parity tests against Pi native behavior.

### D10: One-shot migration of legacy grouped prompts with explicit deprecation timeline

**Options considered:**

1. Read both `.pi/prompts/<group>/` and `.pi/composed/<group>/` indefinitely — easy, but freezes drift between locations and turns "canonical home" into a lie.
2. One-shot migration on first run after upgrade with explicit collision handling and a bounded deprecation window — operator sees a clear warning, files end up in the canonical location, legacy reads stop, and the migration step is removed in a future release once it has had time to run.
3. Manual migration only — safest for files but worst UX, and most users will leave their groups in the legacy location forever.

**Decision:** Use a one-shot, idempotent migration on extension startup that moves user/project grouped prompts from `.pi/prompts/<group>/` and `~/.pi/agent/prompts/<group>/` into `.pi/composed/<group>/` and `~/.pi/agent/composed/<group>/`. If a target already exists, skip the move and emit a collision warning. After migration, composer reads only `.pi/composed/`. The migration is itself deprecated from the moment it ships and is removed in a later major release.

Deprecation timeline:

* **This release (the release that ships this PRD):** migration runs once on startup, moves legacy groups, emits a UI warning naming each migrated path, and writes a one-line note to the operator that legacy paths are deprecated. Composer reads only `composed/` going forward.
* **Next minor release:** migration still runs but emits a stronger deprecation warning, including a fixed removal version and a recommendation to commit the migrated layout. Operators discovering legacy paths in CI/dirty trees see the same hard warning.
* **Next major release:** migration step is removed entirely. Composer no longer scans `.pi/prompts/<group>/` or `~/.pi/agent/prompts/<group>/`. Operators with surviving legacy paths see a one-time warning telling them to move the files manually, then composer ignores them.

**Rationale:** `.pi/composed/` is the canonical home. Continuing to silently read `.pi/prompts/<group>/` long-term defeats the layout. A bounded, idempotent move with operator-visible warnings is the most predictable way to converge the user tree on the canonical layout without forcing every operator to run a migration command manually. Misplaced flat composer files in `.pi/prompts/*.md` are warned about but not auto-moved because Pi has already exposed them as native prompts and a silent move could surprise other tools.

**Future path:** Once the migration step is removed in the next major release, only the deprecation warning and operator-facing docs remain. If a future Pi version exposes a clean prompt-resource API, revisit whether composer can stop owning `engine: pi` flat prompts entirely.

---

## 9. File Breakdown

| File                          | Change type  | FR                           | Description                                                                                               |
| ----------------------------- | ------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `extensions/index.ts`         | Modify       | FR-1, FR-2, FR-6, FR-7       | Thin entrypoint after module extraction; registers commands and lifecycle hooks.                          |
| `src/types.ts`                | New          | FR-1, FR-2, FR-3, FR-4       | Shared prompt, engine, args, origin, diagnostics, and dispatch types.                                     |
| `src/discovery.ts`            | New          | FR-1, FR-2, FR-6, FR-8       | Discover top-level `composed/` flat composer prompts and grouped prompts; handle precedence and warnings. |
| `src/migrate.ts`              | New          | FR-2, FR-8                   | One-shot migration of legacy `.pi/prompts/<group>/` to `.pi/composed/<group>/` with collision detection.  |
| `src/args.ts`                 | New          | FR-4, FR-5                   | Parse legacy and enhanced arg schemas; apply defaults, coercion, validation.                              |
| `src/render.ts`               | New          | FR-3, FR-5, FR-7, FR-8       | Engine selection, Pi renderer, Liquid renderer, render diagnostics.                                       |
| `src/ui.ts`                   | New / Modify | FR-4, FR-8                   | Typed arg collection UI, including enum selectors, and existing selector UI extraction.                   |
| `src/commands.ts`             | New          | FR-1, FR-2, FR-6, FR-7       | Command registration and handler orchestration for flat and grouped prompts.                              |
| `test/discovery.test.ts`      | Modify       | FR-1, FR-2, FR-6, FR-8       | Add flat prompt, duplicate, and invalid metadata discovery cases.                                         |
| `test/render.test.ts`         | New          | FR-3, FR-5, FR-7             | Snapshot tests for Pi and Liquid rendering.                                                               |
| `test/args.test.ts`           | New          | FR-4, FR-5                   | Typed schema parser, validation, defaults, and coercion tests.                                            |
| `test/extension-flow.test.ts` | Modify       | FR-1, FR-2, FR-4, FR-7       | End-to-end command dispatch tests for flat and grouped prompts.                                           |
| `test/helpers/mock-pi.ts`     | Modify       | FR-4, FR-7, FR-8             | Extend mock UI and command capture for typed arg collection and diagnostics.                              |
| `package.json`                | Modify       | FR-3                         | Add selected Liquid renderer dependency and scripts if needed.                                            |
| `pnpm-lock.yaml`              | Modify       | FR-3                         | Lock dependency graph.                                                                                    |
| `README.md`                   | Modify       | FR-1, FR-3, FR-4, FR-6, FR-9 | Document flat prompts, Liquid examples, args schema, and precedence.                                      |
| `docs/FEATURE-SET.md`         | Modify       | FR-1, FR-3, FR-4, FR-9       | Update product scope from grouped routing to composer prompt rendering.                                   |
| `docs/IMPLEMENTATION-PLAN.md` | Modify       | FR-1, FR-3, FR-4, FR-9       | Add architecture and implementation slices.                                                               |
| `docs/ROADMAP.md`             | Modify       | FR-1, FR-3, FR-4, FR-9       | Add ordered work items for PRD implementation.                                                            |
| `examples/composed/review.md` | New          | FR-1, FR-3, FR-4, FR-9       | Flat enhanced prompt example using `composed/` composer layout.                                           |
| `test/migrate.test.ts`        | New          | FR-2, FR-8                   | Migration scenarios: clean move, collision skip, misplaced flat prompt warning, idempotence.              |

---

## 10. Dependencies & Constraints

* Latest Pi package checked on 2026-05-08 is `@earendil-works/pi-coding-agent@0.74.0`; latest legacy scope is `@mariozechner/pi-coding-agent@0.73.1`; this repo currently develops against `@earendil-works/*@0.74.0`.
* Pi prompt processing order is extension commands, then `input`, then skill expansion, then native prompt-template expansion, then `before_agent_start`.
* Pi prompt discovery is non-recursive for auto-discovered user/project prompt roots, but root-level `.pi/prompts/*.md` and `~/.pi/agent/prompts/*.md` always become native prompt templates when enabled.
* Pi command inventories and interactive autocomplete include native prompt templates from `session.promptTemplates`; extensions can wrap interactive autocomplete but cannot remove native prompt templates from `session.promptTemplates`, RPC `get_commands`, or native prompt expansion.
* Composer-owned flat prompt files must therefore live outside native prompt roots, under `.pi/composed/` or `~/.pi/agent/composed/`. Pi has no migration or runtime claim on `composed/`; the only legacy migration moves `commands/` → `prompts/` when `prompts/` does not exist.
* Extension commands take precedence over native prompt templates.
* `registerCommand()` cannot make composer commands appear as native Pi prompt commands in Pi's internal command inventory.
* Latest Pi native prompts support `argument-hint`; composer docs should account for it when describing autocomplete parity.
* Package filters and `pi config` can enable or disable package prompt resources, but not frontmatter-level groups or subcommands.
* `@earendil-works/pi-coding-agent` public exports include `parseFrontmatter()` and `stripFrontmatter()`, but not Pi's internal `parseCommandArgs()` and `substituteArgs()` helpers used by native prompts.
* Do not import hidden `dist/core/*` paths; copy small prompt helpers locally until Pi exports them publicly.
* `liquidjs` latest checked on 2026-05-07 is `10.25.7`; implementation must verify ESM/Node behavior before committing dependency choice.
* Existing repo has no `src/` directory yet; module extraction is part of this work or an immediate prerequisite.
* Required local verification remains the repo gate from `AGENTS.md`: `mise run hooks:typecheck`, `mise run hooks:lint`, `mise run hooks:test`, and `mise run skills:validate` before committing implementation.

---

## 11. Rollout Plan

1. **Architecture prep** — extract `extensions/index.ts` into `src/` modules without behavior changes.
2. **Location-based ownership model** — switch internal model to location-based discovery; preserve any legacy `type` fields in migrated content; do not require `type` markers on new prompts.
3. **Arg schema foundation** — implement normalized arg definitions supporting ordered typed arg arrays, positional fallback, repeated `string[]`, and final-arg `rest: true`.
4. **Legacy layout migration (deprecated from day one)** — implement one-shot migration from `.pi/prompts/<group>/` and `~/.pi/agent/prompts/<group>/` to `.pi/composed/<group>/` and `~/.pi/agent/composed/<group>/`; warn on collisions; never overwrite. Mark migration step as deprecated in code and docs from the release in which it lands.
5. **Liquid rendering and flat discovery** — add `engine: liquid`, named render context, safe filter allowlist, snapshots, and flat discovery under `.pi/composed/` and `~/.pi/agent/composed/`.
6. **Typed interactive collection** — add enum selector UI plus boolean/number/string/string\[] collection and validation.
7. **Docs and examples** — update README, feature set, implementation plan, roadmap, and examples; document the deprecation timeline for legacy `.pi/prompts/<group>/` paths and the migration removal target.
8. **Manual validation** — update and run manual testing checklist in live Pi.
9. **Close issue #6** — link release notes or PR to GitHub issue #6 once flat prompt files work.
10. **Next minor release follow-up (planning only)** — confirm migration warning text and removal version; track in roadmap.
11. **Next major release follow-up (planning only)** — remove migration step; keep only deprecation warning for surviving legacy paths.

---

## 12. Open Questions

| #   | Question                                                                                                                | Owner                 | Due        | Decision                                                                                                                                                             | Status   |
| --- | ----------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Q1  | Should flat composer prompts require `type: prompt`, or should `engine: liquid` imply composer ownership?               | Victor Software House | 2026-05-08 | Neither marker is required. Composer ownership comes from `.pi/composed/` location; `engine` stays renderer-only.                                                     | Resolved |
| Q2  | Which command-line syntax should set named args: `--mode deep`, `mode=deep`, positional mapping, or all of these?       | Victor Software House | 2026-05-08 | Support `--name value`, `name=value`, positional fallback for declared args, raw `argv` / `arguments`, and final-arg `rest: true`.                                   | Resolved |
| Q3  | Should enum args use a selector UI instead of free-text input?                                                          | Victor Software House | 2026-05-08 | Use selector UI when interactive; reject invalid CLI values before render.                                                                                           | Resolved |
| Q4  | Should enhanced grouped subcommands support typed args immediately, or should typed args start only for flat prompts?   | Victor Software House | 2026-05-08 | Support ordered typed args for flat and grouped prompts that opt into enhanced rendering.                                                                            | Resolved |
| Q5  | Should Liquid filters be limited to a documented allowlist?                                                             | Victor Software House | 2026-05-08 | Use a safe documented allowlist; add package-owned filters explicitly over time.                                                                                     | Resolved |
| Q6  | Should `default.md` be tracked as a separate issue now or wait until flat prompts ship?                                 | Victor Software House | 2026-05-08 | Wait until flat prompts ship, then reassess as grouped-folder sugar.                                                                                                 | Resolved |
| Q7  | Should composer take over all Pi prompt processing or run in hybrid mode?                                               | Victor Software House | 2026-05-08 | Use hybrid mode; composer handles typed resources and Pi handles unowned native prompts.                                                                             | Resolved |
| Q8  | Where should composer-owned flat prompt files live so Pi does not also load them as native prompts?                     | Victor Software House | 2026-05-08 | Use top-level composer roots: `.pi/composed/` and `~/.pi/agent/composed/`.                                                                                           | Resolved |
| Q9  | What should composer do with existing user/project groups under `.pi/prompts/<group>/`?                                 | Victor Software House | 2026-05-08 | Auto-migrate once at startup to `.pi/composed/<group>/`; warn on collisions; mark migration deprecated immediately; remove migration step in the next major release. | Resolved |
| Q10 | Should composer keep requiring `type: prompt` and `type: group` frontmatter markers?                                    | Victor Software House | 2026-05-08 | Drop both markers; ownership comes from `.pi/composed/` location and `_index.md` folder presence. Preserve any legacy `type` fields encountered in migrated content. | Resolved |

---

## 13. Related

| Issue                                                                                                  | Relationship                                                                                          |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| [#6 — Allow simple Prompt files](https://github.com/victor-software-house/pi-prompt-composer/issues/6) | Source issue; flat composer prompts complete the requested capability.                                |
| `docs/ROADMAP.md` PPC-006 / PPC-006B / PPC-006C                                                        | Related; Liquid rendering, shell substitution, and bundled compose migration share the render pipeline. |
| `docs/ROADMAP.md` PPC-010                                                                              | Related; operator-only prompts should share dispatch-mode plumbing after this work.                   |
| `docs/ROADMAP.md` PPC-011                                                                              | Enables; module extraction is prerequisite or first rollout step for this PRD.                        |

---

## 14. Changelog

| Date       | Change                                          | Author                |
| ---------- | ----------------------------------------------- | --------------------- |
| 2026-05-10 | Aligned args schema, Liquid positional fallback, rest args, and Pi package scope with current runtime | Victor Software House |
| 2026-05-08 | Clarified typed ownership and hybrid processing | Victor Software House |
| 2026-05-08 | Resolved design open questions                  | Victor Software House |
| 2026-05-07 | Initial draft                                   | Victor Software House |

---

## 15. Verification (Appendix)

Post-implementation checklist:

0. After upgrade, run the extension once and verify `.pi/prompts/<group>/` groups have been moved to `.pi/composed/<group>/` and a UI warning lists each migrated path plus the deprecation removal version.
1. Create `.pi/composed/review.md` with no `type` field, plus typed args, an `if` block, and a `for` loop, and verify composer registers `/review`.
2. Run `/reload` in Pi and verify `/review` appears as a composer command.
3. Invoke `/review` with no args and verify required args are collected interactively.
4. Invoke `/review --mode invalid` and verify validation blocks dispatch with a visible warning.
5. Invoke `/review --change "fix auth" --mode deep` and verify rendered Liquid output appears as the sent user message.
6. Create `.pi/prompts/native.md` (under the native Pi root) and verify composer does not register it; Pi handles `/native` natively.
7. Re-run existing grouped `/compose`, `/review summary`, and `/review fix` examples.
8. Add `enabled: false` to a group and a subcommand and verify disabled paths do not dispatch or fall through unexpectedly.
9. Run `mise run hooks:typecheck`, `mise run hooks:lint`, `mise run hooks:test`, and `mise run skills:validate`.
