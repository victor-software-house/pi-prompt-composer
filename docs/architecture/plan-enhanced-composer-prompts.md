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

Flat composer prompts are explicit opt-ins. A root-level `.md` file becomes composer-owned when it declares `engine: liquid`; native Pi has no Liquid renderer, so this is enough to identify composer ownership without adding `type: prompt`. Grouped prompts are identified by `_index.md`; existing `type: group` frontmatter remains compatible metadata but should not be required after this implementation. This keeps native Pi flat prompts safe while reducing authoring boilerplate.

Liquid is added as one renderer behind a `TemplateEngine` boundary, not as a replacement for Pi-style substitution. `engine: pi` continues to use the local copy of Pi's argument parser/substitution semantics. `engine: liquid` receives named `args` plus prompt metadata, supports only a documented safe filter allowlist, and never sees process globals, environment variables, filesystem state, shell output, or network access unless later providers explicitly add them.

## Components

### Prompt Model and Types

**Purpose**: Define the internal data model shared by flat prompts and grouped subcommands.

**Key Details**:

* Add `src/types.ts` with `PromptDefinition`, `PromptOrigin`, `PromptKind`, `TemplateEngine`, `DispatchMode`, `ArgDefinition`, and structured diagnostic types.
* Represent existing grouped subcommands and new flat prompt files through the same model so command handling and rendering do not branch by file layout.
* Keep runtime behavior source-compatible with current `NestedPrompt` and `EffectivePromptGroup` semantics during extraction.

**ADR Reference**: None — straightforward implementation from PRD decisions D1 through D4.

### Discovery and Registry

**Purpose**: Discover composer-owned resources and apply origin precedence deterministically.

**Key Details**:

* Move `getPromptRoots()`, `loadSingleGroup()`, `discoverGroups()`, and metadata parsing from `extensions/index.ts` into `src/discovery.ts`.
* Preserve bundled → user → project ordering, with project winning duplicates and warnings naming both origins/files.
* Treat `_index.md` as the grouped prompt marker; keep accepting existing `type: group` frontmatter but do not require it.
* Add flat file discovery only for root-level `.md` files with `engine: liquid`.
* Continue ignoring flat files without `engine: liquid` so Pi-native prompt handling remains responsible for them.

**ADR Reference**: None — redundant `type` markers are removed by PRD D4.

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

* Add `src/commands.ts` for command registration, direct dispatch, bare-command selector routing, autocomplete, duplicate warnings, and `sendUserMessage()` dispatch.
* Preserve current visible-message behavior by dispatching final rendered content through `pi.sendUserMessage(rendered, { deliverAs: 'followUp' })`.
* Keep extension command precedence documented: composer commands win over native prompts only when composer registers the command.
* Leave future `dispatch: operator` as a first-class type field but do not implement operator-only behavior in this PRD slice.

**ADR Reference**: None — follows existing implementation and PRD FR-7.

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
* Extend `test/discovery.test.ts`, `test/extension-flow.test.ts`, and mocks for flat prompts, named args, enum selection, duplicate warnings, and render diagnostics.
* Add `examples/prompts/review.md` as the copyable flat enhanced prompt example.
* Update [README.md](../../README.md), [docs/FEATURE-SET.md](../FEATURE-SET.md), [docs/IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md), [docs/ROADMAP.md](../ROADMAP.md), and authoring skill docs only after behavior lands.

**ADR Reference**: None — delivery support.

## Implementation Order

| Phase | Component                                                     | Dependencies   | Estimated Scope |
| ----- | ------------------------------------------------------------- | -------------- | --------------- |
| 1     | Module extraction baseline                                    | None           | L               |
| 2     | Group gate cleanup and unified prompt model                   | Phase 1        | M               |
| 3     | Named args parser and normalized arg schema                   | Phase 1        | M               |
| 4     | Command orchestration update for flat and grouped definitions | Phases 2, 3    | M               |
| 5     | Liquid renderer and flat `engine: liquid` discovery           | Phases 2, 3    | M               |
| 6     | Typed interactive collection and validation UI                | Phases 3, 4, 5 | M               |
| 7     | Docs, examples, roadmap updates, and manual Pi checklist      | Phases 2-6     | M               |
| 8     | Full local verification and release readiness check           | Phase 7        | S               |

### Phase 1: Module extraction baseline

Move current behavior out of `extensions/index.ts` without product changes. Keep tests green at each extraction step, especially helper parsing, discovery, order, bundled `/compose`, and extension-flow tests. This phase should not add Liquid, flat prompts, or new arg semantics.

### Phase 2: Group gate cleanup and unified model

Introduce `PromptDefinition` and make `_index.md` sufficient for grouped prompt discovery. Keep existing `type: group` metadata accepted but inert. Native flat prompts remain untouched until Liquid discovery lands.

### Phase 3: Named args and schema normalization

Add parser support for enhanced object schemas and named CLI inputs. Normalize legacy array args and object args into distinct internal variants so `engine: pi` compatibility cannot be broken by Liquid behavior.

### Phase 4: Command orchestration update

Make command handlers consume `PromptDefinition` instances regardless of whether the source is a flat prompt or a grouped subcommand. Preserve bare `/group` selector behavior and direct `/group subcommand` dispatch.

### Phase 5: Liquid renderer

Add `liquidjs` only after a small ESM/Node spike confirms the API shape. Configure a safe allowlist, render with `{ args, prompt }`, and snapshot documented syntax. Add flat prompt registration for root-level `.md` files with `engine: liquid`. Do not expose process/env/filesystem/shell providers.

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
| Flat composer prompts shadow native prompts unexpectedly | Medium     | High   | Require `type: prompt`, warn on composer duplicates, and document extension precedence.                       |
| Liquid default behavior exposes more than intended       | Low        | High   | Disable filesystem access, expose only `{ args, prompt }`, and use a documented filter allowlist.             |
| Named args parser becomes ambiguous                      | Medium     | Medium | Support only `--name value` and `name=value` first; keep positional mapping out of Liquid.                    |
| Typed UI collection blocks headless flows                | Medium     | Medium | Detect noninteractive contexts where possible and fail with clear diagnostics when required args are missing. |
| Docs drift from shipped behavior                         | Medium     | Medium | Update docs/examples only after tests prove behavior, then run `skills:validate` and manual checklist.        |

## Open Questions

Resolved by the PRD and treated as implementation constraints:

* Do not add `type: prompt`; `engine: liquid` is the flat composer prompt opt-in.
* Do not require `type: group`; `_index.md` is the group marker, with existing `type: group` accepted for compatibility.
* Named Liquid args support `--name value` and `name=value`; `--name value` is canonical.
* Enum args use selector UI when interactive and reject invalid CLI values before render.
* Object args apply to both flat and grouped enhanced prompts.
* Liquid filters use a documented safe allowlist.
* `default.md` waits until flat prompts ship.

Implementation detail still to decide during Phase 6:

* Exact `string[]` CLI syntax beyond YAML defaults and interactive input, e.g. comma-separated values versus repeated named args.

## ADR Index

Decisions made during this plan:

| ADR       | Title                                    | Status                                                                    |
| --------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| Candidate | Composer ownership without type taxonomy | Captured in PRD D4; create ADR only if policy becomes cross-package       |
| Candidate | Liquid safe filter allowlist             | Captured in PRD D6; create ADR if future providers broaden security scope |
