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
* `parseArgsMetadata()` accepts a lenient positional args array, but cannot express named args, enums, booleans, arrays, defaults, validation, or data sources.
* `substituteArgs()` implements Pi-like positional replacement plus escaped dollar support.
* `resolvePromptArgs()` collects args by position through `ctx.ui.input()`.
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
| **Issue #6 resolution**                | User can author a single plain file instead of a folder                                | `/review` from `.pi/composed/review.md` works when file opts into composer handling      |

**Guardrails (must not regress):**

* Existing grouped prompt routing: `/group`, `/group subcommand`, selector, autocomplete.
* Existing bundled `/compose` group and authoring skill.
* Existing Pi-like substitution for current prompts.
* Visible rendered output in conversation history for model-dispatched prompts.
* Discovery warnings through Pi UI, not only console output.
* Flat Pi-native prompts that do not opt into composer behavior should continue to work through Pi.

---

## 3. Users & Use Cases

### Primary: Prompt author

> As a prompt author, I want to create a single enhanced prompt file so that I do not need a folder and fake subcommand for one workflow.

**Preconditions:** The author has a composer prompt root such as `~/.pi/agent/composed/` or `.pi/composed/`. Root-level native Pi prompt files such as `.pi/prompts/review.md` stay native Pi resources and are not valid composer-owned flat prompt locations.

### Primary: Power prompt author

> As a power prompt author, I want named variables, conditionals, loops, and typed inputs so that prompts can adapt to context without becoming brittle prose instructions.

**Preconditions:** The prompt file opts into the enhanced rendering engine.

### Secondary: Existing composer user

> As an existing grouped-prompt user, I want my current prompt groups to keep working so that adopting enhanced templates does not break my current workflows.

**Preconditions:** Existing prompts use `_index.md` with `type: group` and current `args` array syntax.

### Future: Package maintainer

> As a package maintainer, I want rendering, discovery, args, and UI split into modules so that shell substitution, operator-only dispatch, and future context providers can be added without making `extensions/index.ts` harder to change.

---

## 4. Scope

### In scope

1. **Composer-owned flat prompt files** — discover eligible `.md` files directly under composer-owned prompt roots and register them as slash commands.
2. **Prompt kind detection** — distinguish native Pi prompts, composer flat prompts, and composer grouped prompts through explicit frontmatter and a top-level `composed/` layout that is invisible to native Pi prompt discovery.
3. **Template engine selection** — support `engine: pi` for current behavior and `engine: liquid` for enhanced rendering.
4. **Liquid rendering pipeline** — render named data, conditionals, loops, filters, and safe local context through a deterministic pipeline.
5. **Typed argument schema** — add expressive named args while preserving legacy positional args.
6. **Interactive collection and validation** — collect missing required args based on schema, validate inputs, and show actionable UI errors.
7. **Unified prompt model** — represent flat and grouped prompts through one internal `PromptDefinition` model.
8. **Docs and examples** — document flat enhanced prompts, grouped prompts, engine choices, arg schemas, and migration guidance.
9. **Tests** — cover discovery, rendering, args, command dispatch, diagnostics, and compatibility.

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

Composer must discover eligible flat `.md` files directly under composer-owned prompt roots and register each as a slash command. Valid roots are top-level paths Pi never reads as native prompt templates:

* project: `.pi/composed/**/*.md`
* user: `~/.pi/agent/composed/**/*.md`
* bundled/package-owned: package files scanned by the extension itself, not exposed through `pi.prompts`

Composer must not use root-level native Pi prompt paths such as `.pi/prompts/*.md` or `~/.pi/agent/prompts/*.md` for flat composer prompt files. Pi auto-discovers those files as native prompt templates, which would create duplicate command visibility and a native execution path. Pi reserves `extensions/`, `skills/`, `prompts/`, and `themes/` under `.pi/` and `~/.pi/agent/`; `composed/` is unclaimed by Pi.

Eligibility must still be explicit:

```yaml

---

type: prompt
engine: liquid

---

```

`type: prompt` marks the file as a composer-owned prompt resource. `engine` chooses how that resource renders. Files without `type: prompt` remain ignored by composer. Native Pi prompt roots remain owned by Pi for root-level `.md` files.

**Acceptance criteria:**

```gherkin
Given .pi/composed/review.md contains frontmatter type: prompt and engine: liquid
When Pi reloads with pi-prompt-composer enabled
Then composer registers /review as an extension command
And invoking /review renders review.md through composer
And Pi native prompt discovery does not list review.md as a native prompt template
```

```gherkin
Given .pi/prompts/native.md has no type: prompt frontmatter
When Pi reloads with pi-prompt-composer enabled
Then composer does not register /native
And Pi native prompt handling remains responsible for /native
```

```gherkin
Given .pi/prompts/review.md declares type: prompt
When Pi reloads with pi-prompt-composer enabled
Then composer reports review.md as an invalid native-visible composer prompt location
And the docs tell the author to move it to .pi/composed/review.md
```

**Files:**

* `extensions/index.ts` — current discovery entrypoint until module extraction.
* `src/discovery.ts` — target home for flat and grouped discovery.
* `src/types.ts` — prompt definition types.
* `test/discovery.test.ts` — flat prompt discovery coverage.

---

### FR-2: Preserve grouped prompt behavior

Existing grouped prompt behavior must continue unchanged unless a prompt opts into new rendering features.

**Acceptance criteria:**

```gherkin
Given .pi/prompts/review/_index.md contains type: group
And .pi/prompts/review/summary.md is an existing current-style prompt
When the user runs /review summary "my change"
Then composer dispatches the same rendered content as before this PRD
```

**Files:**

* `extensions/index.ts` / `src/discovery.ts` — keep group detection and ordering.
* `src/render.ts` — preserve `engine: pi` rendering.
* `test/extension-flow.test.ts` — existing direct dispatch and selector tests.
* `test/order.test.ts` — group order compatibility.

---

### FR-3: Support Liquid as enhanced template engine

Composer must support `engine: liquid` for flat and grouped prompts that opt in. Liquid templates must receive a named render context rather than positional-only strings.

Minimum context shape:

```ts
{
  args: Record<string, unknown>;
  prompt: {
    name: string;
    groupName?: string;
    origin: 'bundled' | 'user' | 'project';
    filePath: string;
  };
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

**Files:**

* `package.json` / `pnpm-lock.yaml` — add renderer dependency after implementation spike. `liquidjs` latest checked on 2026-05-07: `10.25.7`; `handlebars` latest checked: `4.7.9`.
* `src/render.ts` — engine dispatch and Liquid renderer.
* `test/render.test.ts` — inline snapshots for Liquid rendering.
* `docs/FEATURE-SET.md` — update product model.
* `README.md` — document `engine: liquid`.

---

### FR-4: Support typed named argument schemas

Composer must support an object-based args schema for enhanced prompts.

Initial schema:

```yaml
args:
  change:
    type: string
    required: true
    prompt: What changed?
  mode:
    type: enum
    values: [quick, normal, deep]
    default: normal
  include_tests:
    type: boolean
    default: true
  files:
    type: string[]
    required: false
```

Named CLI args must support both `--name value` and `name=value`; `--name value` is the documented canonical style. Optional `--name=value` support is acceptable if it falls out of the parser cleanly. Positional mapping remains limited to legacy `engine: pi` prompts so Liquid prompts do not have two competing ways to bind the same named value.

Supported initial types:

* `string`
* `boolean`
* `number`
* `enum`
* `string[]`

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

**Files:**

* `src/args.ts` — new arg schema parser, coercion, validation, defaults.
* `src/ui.ts` — input/select collection for typed args.
* `src/render.ts` — pass typed args to engine.
* `test/helpers.test.ts` or `test/args.test.ts` — schema parser tests.
* `test/extension-flow.test.ts` — interactive collection tests.

---

### FR-5: Keep legacy args array and Pi-style engine compatible

Current `args` array syntax and Pi-like substitution must remain valid for existing prompts.

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
Given user and project composer prompt roots both define type: prompt command review
When Pi reloads
Then project review wins
And composer shows a duplicate command warning naming both origins
```

```gherkin
Given native Pi has .pi/prompts/review.md without type: prompt
And composer has .pi/composed/review.md with type: prompt
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

Resource defaults use frontmatter:

```yaml

---

type: group
enabled: false

---

```

```yaml

---

type: prompt
enabled: false

---

```

Required behavior:

* `enabled: false` on `_index.md` disables the whole group path and all children at that origin.
* `enabled: false` on a grouped subcommand disables only that subcommand path.
* `enabled: false` on a flat composer prompt disables that flat command path.
* A higher-precedence disabled resource acts as a tombstone for the same command path so lower-precedence composer resources do not unexpectedly reappear.
* Operator config may later add a global disabled path list such as `/review` or `/review fix`; that config should mask matching resources across origins.
* In hybrid mode, disabled composer paths may be blocked through the `input` event only for native-visible legacy/misplaced paths; valid flat composer prompt files live outside native prompt discovery and should not appear as native prompts.

**Acceptance criteria:**

```gherkin
Given project .pi/prompts/review/_index.md declares type: group and enabled: false
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
| Liquid support creates a second mental model beside Pi-native prompts | Medium   | High       | Separate resource ownership (`type`) from rendering (`engine`) and document the model with examples.                                                                                                         |
| Composer flat prompts shadow native Pi prompts unexpectedly           | High     | Medium     | Keep flat composer prompt files under `.pi/composed/`; require `type: prompt`; warn on duplicate composer commands.                                                                                          |
| Disabled prompts reappear from lower-precedence or native resources   | High     | Medium     | Treat higher-precedence disabled composer resources as tombstones; keep valid flat composer files under `composed/` so native prompt discovery never sees them; only block misplaced/legacy paths if needed. |
| Arg schema becomes too complex too soon                               | Medium   | Medium     | Ship small type set first; defer nested objects, computed defaults, and complex validation.                                                                                                                  |
| Template context leaks sensitive env or filesystem data               | High     | Low        | Expose only explicit `args` and prompt metadata in first slice; add providers through allowlists and docs.                                                                                                   |
| Single-file `extensions/index.ts` becomes harder to evolve            | Medium   | High       | Make module extraction part of rollout before or alongside enhanced rendering.                                                                                                                               |
| Liquid library behavior differs from prompt-author expectations       | Medium   | Medium     | Add snapshot tests for all documented syntax and link docs to supported subset.                                                                                                                              |

### Assumptions

* `type` identifies composer resource ownership and kind; `engine` identifies rendering behavior.
* `type: group` stays the hard gate for grouped folders, even when `_index.md` exists, because `_index.md` alone is too easy to create accidentally as folder documentation.
* `type: prompt` is required for flat composer prompt ownership, including future composer-owned `engine: pi` prompts with non-native behavior such as enable/disable, typed args, dispatch modes, or preprocessing.
* Valid flat composer prompt files live under top-level composer roots (`.pi/composed/` and `~/.pi/agent/composed/`) so the same file cannot also appear or execute as a native Pi prompt. Pi reserves `extensions/`, `skills/`, `prompts/`, and `themes/` under those bases; `composed/` is unclaimed by current Pi versions.
* Existing grouped composer prompts under `.pi/prompts/<group>/_index.md type: group` keep working without migration; composer also accepts grouped prompts under `.pi/composed/<group>/` for authors who prefer consolidation.
* Flat root files in native Pi prompt roots (`.pi/prompts/*.md` and `~/.pi/agent/prompts/*.md`) remain owned by native Pi prompt processing.
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

### D3: Use object-based args schema for enhanced prompts

**Options considered:**

1. Preserve only positional args array — compatible but weak.
2. Add object-based named args schema — expressive, validates well, maps naturally to `args.name` in Liquid.
3. Infer args from template variables — magical and brittle.

**Decision:** Add object-based named args schema while accepting legacy arrays for `engine: pi` compatibility.

**Rationale:** Liquid templates should use named values. Explicit schemas make UI collection and validation predictable.

**Future path:** Add richer sources and validation only after baseline types ship.

### D4: Keep typed composer resource markers

**Options considered:**

1. Use only layout and `engine` — less metadata, but mixes resource ownership with rendering and makes disable/tombstone semantics weaker.
2. Use file extension variants like `.composer.md` — explicit but uglier and less Pi-like.
3. Keep typed composer resources: `type: group` for group ownership and `type: prompt` for flat prompt ownership.

**Decision:** Keep author-facing `type` markers for composer-owned resources. A grouped folder is composer-owned only when `_index.md` declares `type: group`. A flat file under `.pi/composed/` (or `~/.pi/agent/composed/`) is composer-owned only when it declares `type: prompt`. `engine` remains a renderer selector, not an ownership marker.

**Rationale:** The hard gate is valuable. It prevents accidental command registration from documentation-like folders, separates “composer owns this resource” from “render this with Liquid,” and gives enable/disable semantics a stable target. This also leaves room for composer-owned `engine: pi` prompts that need typed args, dispatch modes, shell preprocessing, or disabled-path behavior without pretending they are native Pi prompts. A separate top-level `composed/` directory is required because Pi's native prompt inventory has no extension-level filter for removing already discovered `.pi/prompts/*.md` files.

**Future path:** If Pi later exposes native prompt enable/disable or typed prompt metadata, re-evaluate whether composer still needs to own `engine: pi` flat prompts.

### D5: Support named CLI args without positional binding for Liquid

**Options considered:**

1. Use only `--name value` — familiar CLI style and easy to document.
2. Use only `name=value` — compact and prompt-template friendly, but less standard for flags.
3. Support both named styles — ergonomic for different author habits.
4. Map positional values into named Liquid args by schema order — concise, but ambiguous once optional/defaulted args exist.

**Decision:** Support `--name value` and `name=value` for named args, document `--name value` as canonical, and keep positional mapping limited to legacy `engine: pi` prompts.

**Rationale:** Liquid prompts should bind values by name so templates remain readable and invocation errors stay diagnosable. Supporting both named syntaxes eases migration without making schema order part of the public contract.

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

1. Restrict object args to flat prompts first — smaller initial surface, but creates divergent behavior.
2. Support object args for any `engine: liquid` prompt, flat or grouped — one model for enhanced prompts.
3. Retain legacy arrays everywhere — compatible, but blocks typed Liquid use in groups.

**Decision:** Support object-based args for flat and grouped prompts that opt into enhanced rendering.

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

---

## 9. File Breakdown

| File                          | Change type  | FR                           | Description                                                                                               |
| ----------------------------- | ------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| `extensions/index.ts`         | Modify       | FR-1, FR-2, FR-6, FR-7       | Thin entrypoint after module extraction; registers commands and lifecycle hooks.                          |
| `src/types.ts`                | New          | FR-1, FR-2, FR-3, FR-4       | Shared prompt, engine, args, origin, diagnostics, and dispatch types.                                     |
| `src/discovery.ts`            | New          | FR-1, FR-2, FR-6, FR-8       | Discover top-level `composed/` flat composer prompts and grouped prompts; handle precedence and warnings. |
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

---

## 10. Dependencies & Constraints

* Latest Pi package checked on 2026-05-08 is `@earendil-works/pi-coding-agent@0.74.0`; latest legacy scope is `@mariozechner/pi-coding-agent@0.73.1`; this repo currently develops against `@mariozechner/*@0.63.2`.
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
2. **Typed resource model** — keep `type: group`, add `type: prompt`, and model disabled tombstones without changing current grouped behavior.
3. **Arg schema foundation** — implement normalized arg definitions supporting both legacy arrays and object schemas.
4. **Liquid rendering and flat discovery** — add `engine: liquid`, named render context, safe filter allowlist, snapshots, and flat `type: prompt` registration under `.pi/composed/` and `~/.pi/agent/composed/`.
5. **Typed interactive collection** — add enum selector UI plus boolean/number/string/string\[] collection and validation.
6. **Docs and examples** — update README, feature set, implementation plan, roadmap, and examples.
7. **Manual validation** — update and run manual testing checklist in live Pi.
8. **Close issue #6** — link release notes or PR to GitHub issue #6 once flat prompt files work.

---

## 12. Open Questions

| #  | Question                                                                                                                | Owner                 | Due        | Decision                                                                                            | Status   |
| -- | ----------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------- | --------------------------------------------------------------------------------------------------- | -------- |
| Q1 | Should flat composer prompts require `type: prompt`, or should `engine: liquid` imply composer ownership?               | Victor Software House | 2026-05-08 | Require `type: prompt`; `engine` stays renderer-only.                                               | Resolved |
| Q2 | Which command-line syntax should set named args: `--mode deep`, `mode=deep`, positional mapping, or all of these?       | Victor Software House | 2026-05-08 | Support `--name value` and `name=value`; document `--name value`; keep positional for `engine: pi`. | Resolved |
| Q3 | Should enum args use a selector UI instead of free-text input?                                                          | Victor Software House | 2026-05-08 | Use selector UI when interactive; reject invalid CLI values before render.                          | Resolved |
| Q4 | Should enhanced grouped subcommands support object args immediately, or should object args start only for flat prompts? | Victor Software House | 2026-05-08 | Support object args for flat and grouped prompts that opt into enhanced rendering.                  | Resolved |
| Q5 | Should Liquid filters be limited to a documented allowlist?                                                             | Victor Software House | 2026-05-08 | Use a safe documented allowlist; add package-owned filters explicitly over time.                    | Resolved |
| Q6 | Should `default.md` be tracked as a separate issue now or wait until flat prompts ship?                                 | Victor Software House | 2026-05-08 | Wait until flat prompts ship, then reassess as grouped-folder sugar.                                | Resolved |
| Q7 | Should composer take over all Pi prompt processing or run in hybrid mode?                                               | Victor Software House | 2026-05-08 | Use hybrid mode; composer handles typed resources and Pi handles unowned native prompts.            | Resolved |
| Q8 | Where should composer-owned flat prompt files live so Pi does not also load them as native prompts?                     | Victor Software House | 2026-05-08 | Use top-level composer roots: `.pi/composed/` and `~/.pi/agent/composed/`.                          | Resolved |

---

## 13. Related

| Issue                                                                                                  | Relationship                                                                                          |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| [#6 — Allow simple Prompt files](https://github.com/victor-software-house/pi-prompt-composer/issues/6) | Source issue; flat composer prompts complete the requested capability.                                |
| `docs/ROADMAP.md` PPC-006                                                                              | Related; shell substitution is a future preprocessing stage and should share the new render pipeline. |
| `docs/ROADMAP.md` PPC-010                                                                              | Related; operator-only prompts should share dispatch-mode plumbing after this work.                   |
| `docs/ROADMAP.md` PPC-011                                                                              | Enables; module extraction is prerequisite or first rollout step for this PRD.                        |

---

## 14. Changelog

| Date       | Change                                          | Author                |
| ---------- | ----------------------------------------------- | --------------------- |
| 2026-05-08 | Clarified typed ownership and hybrid processing | Victor Software House |
| 2026-05-08 | Resolved design open questions                  | Victor Software House |
| 2026-05-07 | Initial draft                                   | Victor Software House |

---

## 15. Verification (Appendix)

Post-implementation checklist:

1. Create `.pi/composed/review.md` with `type: prompt`, `engine: liquid`, typed args, an `if` block, and a `for` loop.
2. Run `/reload` in Pi and verify `/review` appears as a composer command.
3. Invoke `/review` with no args and verify required args are collected interactively.
4. Invoke `/review --mode invalid` and verify validation blocks dispatch with a visible warning.
5. Invoke `/review --change "fix auth" --mode deep` and verify rendered Liquid output appears as the sent user message.
6. Create `.pi/prompts/native.md` without `type: prompt` and verify composer does not register it.
7. Re-run existing grouped `/compose`, `/review summary`, and `/review fix` examples.
8. Add `enabled: false` to a group and a subcommand and verify disabled paths do not dispatch or fall through unexpectedly.
9. Run `mise run hooks:typecheck`, `mise run hooks:lint`, `mise run hooks:test`, and `mise run skills:validate`.
