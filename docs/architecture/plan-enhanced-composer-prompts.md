---
title: "Enhanced Composer Prompts"
prd: "PRD-001-enhanced-composer-prompts"
date: 2026-05-08
author: "Victor Software House"
status: Draft
---

# Plan: Enhanced Composer Prompts

## Source

* **PRD**: [docs/prd/PRD-001-enhanced-composer-prompts.md](../prd/PRD-001-enhanced-composer-prompts.md)
* **Date**: 2026-05-08
* **Author**: Victor Software House

## Architecture Overview

Enhanced composer prompts should evolve the current single-file grouped-command implementation into a small pipeline: discover prompt resources, normalize metadata and args, collect or validate missing input, render through the selected engine, then dispatch the final visible user message. The first implementation constraint is compatibility: existing `_index.md` groups, bundled `/compose`, Pi-style `$1` rendering, selector behavior, and warning surfaces must remain unchanged while the internals move from `extensions/index.ts` into testable `src/` modules.

Flat composer prompts are explicit opt-ins, but ownership cannot be expressed safely by frontmatter alone in Pi's native prompt roots. Pi auto-discovers root-level `.md` files under `.pi/prompts/` and `~/.pi/agent/prompts/` before extensions can filter the native prompt inventory. Composer-owned flat files therefore live in top-level `composed/` directories: `.pi/composed/` and `~/.pi/agent/composed/`. Pi reserves `extensions/`, `skills/`, `prompts/`, and `themes/` under those bases; `composed/` is unclaimed by current Pi versions. A file under `composed/` becomes composer-owned only when it declares `type: prompt`; `engine` chooses how that composer-owned resource renders. Grouped prompts remain gated by `_index.md` with `type: group`. Existing groups under `.pi/prompts/<group>/` keep working without migration; new groups may also live under `.pi/composed/<group>/`. This separates resource ownership from rendering so composer can support enable/disable, dispatch modes, typed args, preprocessing, and future `engine: pi` owned prompts without taking over native Pi prompt files.

Liquid is added as one renderer behind a `TemplateEngine` boundary, not as a replacement for Pi-style substitution. `engine: pi` continues to use the local copy of Pi's argument parser/substitution semantics. `engine: liquid` receives named `args` plus prompt metadata, supports only a documented safe filter allowlist, and never sees process globals, environment variables, filesystem state, shell output, or network access unless later providers explicitly add them.

## Pi Runtime Compatibility Findings

Checked against latest published Pi packages on 2026-05-08: `@earendil-works/pi-coding-agent@0.74.0` and legacy `@mariozechner/pi-coding-agent@0.73.1`. The current repo still develops against `@mariozechner/*@0.63.2`, so implementation should include a dependency/import migration decision before using 0.74-only package names.

Relevant current Pi behavior:

* Prompt processing order is extension commands → `input` event → `/skill:name` expansion → native prompt-template expansion → `before_agent_start` → agent turn.
* Extension commands are checked before `input`, so composer-owned commands should use `pi.registerCommand()` rather than an `input` transform.
* Native prompt templates are expanded only after `input`; disabled composer paths can be blocked in hybrid mode through `input` when no extension command is registered.
* `sendUserMessage()` is the right dispatch API for rendered composer prompts; use `deliverAs: 'followUp'` when dispatching during active work, matching current behavior.
* Latest native prompt templates support `description` and `argument-hint`; they still use non-recursive auto discovery for `.pi/prompts/*.md` and `~/.pi/agent/prompts/*.md`.
* Native prompt templates appear in interactive autocomplete and RPC `get_commands` from `session.promptTemplates`. Extensions can wrap interactive autocomplete, but there is no public extension hook to remove native prompt templates from `session.promptTemplates`, RPC command output, or native prompt expansion.
* Valid composer-owned flat prompt files must live outside native prompt roots. Root-level `.pi/prompts/*.md` files are native Pi prompt files, even if they contain composer-looking frontmatter.
* Pi has no migration or runtime claim on `composed/`. The only legacy migration moves `commands/` → `prompts/` when `prompts/` does not exist; `composed/` is unaffected.
* Native prompt rendering still uses `parseCommandArgs()` and `substituteArgs()` internally, but those helpers are not re-exported from the package root. Local copies remain necessary unless Pi exposes them publicly.
* Package resource filters and `pi config` can enable/disable package prompt resources, but they do not provide frontmatter-level group/subcommand disabling. Composer still needs its own `enabled: false` semantics.
* Pi resource precedence sorts project resources before user resources before package resources, and native prompt collisions are first-wins by prompt name. Composer should mirror that precedence for typed resources.
* Duplicate extension command names are resolved by Pi with invocation suffixes such as `name:2`; composer should avoid registering duplicates internally and surface diagnostics instead.
* The package scope moved from `@mariozechner/*` to `@earendil-works/*` in 0.74.0. New implementation should not import hidden `dist/core/*` paths, and should plan the public peer dependency/import migration deliberately.

Design implications:

* Keep hybrid processing. Full takeover would require reimplementing native prompt expansion and future native prompt features exactly.
* Keep typed ownership gates. `type` decides whether composer owns a resource; `engine` decides only how owned content renders.
* Use `input` only as a narrow guardrail for disabled or misplaced native-visible paths, not as the primary renderer.
* Preserve Pi-native prompt behavior by leaving root-level native `.md` files alone.

## Components

### Prompt Model and Types

**Purpose**: Define the internal data model shared by flat prompts and grouped subcommands.

**Key Details**:

* Add `src/types.ts` with `PromptDefinition`, `PromptOrigin`, `PromptKind`, `TemplateEngine`, `DispatchMode`, `PromptStatus`, `ArgDefinition`, and structured diagnostic types.
* Represent existing grouped subcommands and new flat prompt files through the same model so command handling and rendering do not branch by file layout.
* Keep `type` as the author-facing composer resource marker and `kind` as the internal normalized runtime shape.
* Track disabled resources as tombstones so higher-precedence disabled paths mask lower-precedence resources.
* Keep runtime behavior source-compatible with current `NestedPrompt` and `EffectivePromptGroup` semantics during extraction.

**ADR Reference**: None — straightforward implementation from PRD decisions D1 through D4.

### Discovery and Registry

**Purpose**: Discover composer-owned resources and apply origin precedence deterministically.

**Key Details**:

* Move `getPromptRoots()`, `loadSingleGroup()`, `discoverGroups()`, and metadata parsing from `extensions/index.ts` into `src/discovery.ts`.
* Add composer flat prompt roots: `.pi/composed/`, `~/.pi/agent/composed/`, and package-owned roots scanned by the extension itself.
* Keep accepting existing grouped prompts under `.pi/prompts/<group>/_index.md type: group` and `~/.pi/agent/prompts/<group>/_index.md type: group` for backwards compatibility; also accept grouped prompts under `.pi/composed/<group>/` and `~/.pi/agent/composed/<group>/`.
* Preserve bundled → user → project ordering, with project winning duplicates and warnings naming both origins/files.
* Keep `type: group` as the hard gate for grouped prompt discovery.
* Add flat file discovery only for `.md` files under `composed/` roots with `type: prompt`. Recursion inside `composed/` is allowed because Pi never enters that subtree.
* Treat root-level `.pi/prompts/*.md` files with `type: prompt` as misplaced resources: warn with a move instruction toward `.pi/composed/` instead of treating them as valid composer flat prompts.
* Continue ignoring native-root flat files without `type: prompt` so Pi-native prompt handling remains responsible for them.
* Parse `enabled: false` into disabled tombstones for groups, flat prompts, and grouped subcommands.

**ADR Reference**: Candidate — typed composer resource ownership is recorded in PRD D4; standalone ADR only if this becomes cross-package policy.

### Argument Parsing and Validation

**Purpose**: Normalize legacy positional args and enhanced named arg schemas into one validation contract.

**Key Details**:

* Add `src/args.ts` for legacy array parsing, object schema parsing, CLI named arg parsing, coercion, defaults, and validation.
* Support `--name value` and `name=value` for enhanced named args; document `--name value` as canonical.
* Keep positional binding limited to legacy `engine: pi` prompts.
* Support initial types: `string`, `boolean`, `number`, `enum`, and `string[]`.
* Reject invalid enum values, failed numeric coercion, unknown required fields, and empty required strings before rendering.

**ADR Reference**: None — PRD D3 and D5 capture public syntax choice.

### Rendering Pipeline

**Purpose**: Render prompts through Pi-compatible or Liquid engines while preserving visible dispatch output.

**Key Details**:

* Add `src/render.ts` with a `TemplateEngine` interface and implementations for `engine: pi` and `engine: liquid`.
* Keep `parseCommandArgs()` and `substituteArgs()` behavior covered by existing and new render tests.
* Add Liquid rendering with context shape `{ args, prompt }`.
* Configure Liquid with no filesystem access and a safe documented filter allowlist.
* Return structured render diagnostics rather than throwing raw errors through command handlers.

**ADR Reference**: Candidate — Liquid plus safe filter allowlist is recorded in PRD D2 and D6; create ADR if future providers or custom filters broaden security scope.

### Command Orchestration and Dispatch

**Purpose**: Keep `extensions/index.ts` as thin Pi lifecycle wiring and move command behavior into reusable functions.

**Key Details**:

* Add `src/commands.ts` for command registration, direct dispatch, bare-command selector routing, autocomplete, duplicate warnings, disabled path blocking, and `sendUserMessage()` dispatch.
* Preserve current visible-message behavior by dispatching final rendered content through `pi.sendUserMessage(rendered, { deliverAs: 'followUp' })`.
* Use hybrid processing: register enabled composer resources as extension commands and let Pi handle unowned native prompts.
* Keep valid flat composer prompt files under `composed/` so Pi native prompt discovery never sees them and `/prompt` appears once as an extension command, not once as an extension command plus once as a native prompt.
* Use `input` handling narrowly for disabled composer paths so native Pi prompt processing does not resurrect a path explicitly disabled through composer.
* Keep extension command precedence documented: composer commands win over native prompts only when composer registers the command.
* Leave future `dispatch: operator` as a first-class type field but do not implement operator-only behavior in this PRD slice.

**ADR Reference**: None — follows existing implementation plus PRD D9.

### UI and Diagnostics

**Purpose**: Keep operator feedback clear for selectors, missing input, invalid metadata, and render errors.

**Key Details**:

* Add `src/ui.ts` for existing group selector extraction, typed input collection, enum selector collection, usage hint formatting, and warning display.
* Add `src/diagnostics.ts` if diagnostics grow beyond simple arrays during extraction.
* Show malformed frontmatter, invalid schemas, unknown engines, duplicate commands, and render failures through Pi UI notifications.
* In noninteractive contexts, fail clearly for missing required args instead of hanging on input.

**ADR Reference**: None — implementation detail guided by PRD FR-8.

### Tests, Docs, and Examples

**Purpose**: Make feature behavior reviewable and prevent compatibility regressions.

**Key Details**:

* Add `test/render.test.ts` and `test/args.test.ts` for isolated engine and schema coverage.
* Extend `test/discovery.test.ts`, `test/extension-flow.test.ts`, and mocks for `composed/` flat prompts, misplaced native-visible typed prompts, named args, enum selection, duplicate warnings, and render diagnostics.
* Add `examples/composed/review.md` as the copyable flat enhanced prompt example.
* Update [README.md](../../README.md), [docs/FEATURE-SET.md](../FEATURE-SET.md), [docs/IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md), [docs/ROADMAP.md](../ROADMAP.md), and authoring skill docs only after behavior lands.

**ADR Reference**: None — delivery support.

## Implementation Order

| Phase | Component                                                | Dependencies   | Estimated Scope |
| ----- | -------------------------------------------------------- | -------------- | --------------- |
| 1     | Module extraction baseline                               | None           | L               |
| 2     | Typed resource model and disabled tombstones             | Phase 1        | M               |
| 3     | Named args parser and normalized arg schema              | Phase 1        | M               |
| 4     | Command orchestration update for hybrid processing       | Phases 2, 3    | M               |
| 5     | Liquid renderer and `composed/` flat discovery           | Phases 2, 3    | M               |
| 6     | Typed interactive collection and validation UI           | Phases 3, 4, 5 | M               |
| 7     | Docs, examples, roadmap updates, and manual Pi checklist | Phases 2-6     | M               |
| 8     | Full local verification and release readiness check      | Phase 7        | S               |

### Phase 1: Module extraction baseline

Move current behavior out of `extensions/index.ts` without product changes. Keep tests green at each extraction step, especially helper parsing, discovery, order, bundled `/compose`, and extension-flow tests. This phase should not add Liquid, flat prompts, or new arg semantics.

### Phase 2: Typed resource model and disabled tombstones

Introduce `PromptDefinition`, keep `type: group` as the grouped hard gate, add `type: prompt` for flat composer-owned files, and model `enabled: false` resources as tombstones. This phase should preserve current grouped behavior while making ownership explicit enough for later flat prompts and disabling.

### Phase 3: Named args and schema normalization

Add parser support for enhanced object schemas and named CLI inputs. Normalize legacy array args and object args into distinct internal variants so `engine: pi` compatibility cannot be broken by Liquid behavior.

### Phase 4: Command orchestration update

Make command handlers consume `PromptDefinition` instances regardless of whether the source is a flat prompt or a grouped subcommand. Preserve bare `/group` selector behavior and direct `/group subcommand` dispatch. Add hybrid-mode disabled path blocking without taking over all native Pi prompt rendering.

### Phase 5: Liquid renderer

Add `liquidjs` only after a small ESM/Node spike confirms the API shape. Configure a safe allowlist, render with `{ args, prompt }`, and snapshot documented syntax. Add flat prompt registration for `.md` files under `.pi/composed/` and `~/.pi/agent/composed/` with `type: prompt` and `engine: liquid`. Do not expose process/env/filesystem/shell providers.

### Phase 6: Typed collection and validation UI

Collect required strings/numbers/booleans through input prompts, enum args through selector UI, and arrays through documented splitting or repeated syntax chosen during implementation. Block render on validation failures and surface actionable diagnostics.

### Phase 7: Docs and examples

Document flat composer prompts, ownership rules, named args, Liquid context, supported filters, precedence, and migration guidance. Add one realistic flat enhanced prompt example and update roadmap status.

### Phase 8: Verification and release readiness

Run required repo gates: `mise run hooks:typecheck`, `mise run hooks:lint`, `mise run hooks:test`, and `mise run skills:validate`. Then run the PRD manual checklist in live Pi before closing issue #6 or publishing a release.

## Risks and Mitigations

| Risk                                                     | Likelihood | Impact | Mitigation                                                                                                    |
| -------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| Extraction changes behavior before new features land     | Medium     | High   | Keep Phase 1 behavior-only, commit separately, and require existing tests to stay green.                      |
| Typed resource markers feel like boilerplate             | Medium     | Medium | Document that `type` is ownership/kind and `engine` is rendering, with examples for groups and flat prompts.  |
| Flat composer prompts shadow native prompts unexpectedly | Medium     | High   | Require `type: prompt`, warn on composer duplicates, and document extension precedence.                       |
| Disabled resources reappear through fallback paths       | Medium     | High   | Model disabled resources as tombstones and block disabled paths in hybrid input handling.                     |
| Liquid default behavior exposes more than intended       | Low        | High   | Disable filesystem access, expose only `{ args, prompt }`, and use a documented filter allowlist.             |
| Named args parser becomes ambiguous                      | Medium     | Medium | Support only `--name value` and `name=value` first; keep positional mapping out of Liquid.                    |
| Typed UI collection blocks headless flows                | Medium     | Medium | Detect noninteractive contexts where possible and fail with clear diagnostics when required args are missing. |
| Docs drift from shipped behavior                         | Medium     | Medium | Update docs/examples only after tests prove behavior, then run `skills:validate` and manual checklist.        |

## Open Questions

Resolved by the PRD and treated as implementation constraints:

* Keep typed resource markers: `type: group` for group ownership and `type: prompt` for flat composer prompt ownership.
* Keep `engine` renderer-only; it does not imply ownership.
* Use hybrid processing: composer handles typed resources and Pi handles unowned native prompts.
* Model `enabled: false` as a tombstone that can disable a group, flat prompt, or individual grouped subcommand.
* Named Liquid args support `--name value` and `name=value`; `--name value` is canonical.
* Enum args use selector UI when interactive and reject invalid CLI values before render.
* Object args apply to both flat and grouped enhanced prompts.
* Liquid filters use a documented safe allowlist.
* `default.md` waits until flat prompts ship.

Implementation detail still to decide during Phase 6:

* Exact `string[]` CLI syntax beyond YAML defaults and interactive input, e.g. comma-separated values versus repeated named args.

## ADR Index

Decisions made during this plan:

| ADR       | Title                             | Status                                                                    |
| --------- | --------------------------------- | ------------------------------------------------------------------------- |
| Candidate | Typed composer resource ownership | Captured in PRD D4; create ADR only if policy becomes cross-package       |
| Candidate | Hybrid prompt processing boundary | Captured in PRD D9; create ADR if full takeover is reconsidered           |
| Candidate | Liquid safe filter allowlist      | Captured in PRD D6; create ADR if future providers broaden security scope |
