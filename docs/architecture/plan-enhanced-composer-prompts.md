---
title: "Enhanced Composer Prompts"
prd: "PRD-001-enhanced-composer-prompts"
date: 2026-05-08
author: "Victor Software House"
status: Archived
---

# Plan: Enhanced Composer Prompts

## Source

* **PRD**: [docs/prd/PRD-001-enhanced-composer-prompts.md](../prd/PRD-001-enhanced-composer-prompts.md)
* **Date**: 2026-05-08
* **Author**: Victor Software House

## Status note — 2026-05-11

This plan is historical baseline architecture. Core requirements shipped through the implementation tracked in [Liquid-First Compose Prompt Migration](plan-liquid-first-compose-migration.md), [ROADMAP](../ROADMAP.md), and [PRD-001](../prd/PRD-001-enhanced-composer-prompts.md). Some details below are intentionally stale (for example early dependency/import notes, no-filesystem Liquid assumptions, and pre-`variables` context shape). Treat current docs as source of truth before implementing new work.

## Architecture Overview

Enhanced composer prompts should evolve the current single-file grouped-command implementation into a small pipeline: discover prompt resources, normalize metadata and args, collect or validate missing input, render through the selected engine, then dispatch the final visible user message. The first implementation constraint is compatibility: existing `_index.md` groups, bundled `/compose`, Pi-style `$1` rendering, selector behavior, and warning surfaces must remain unchanged while the internals move from `extensions/index.ts` into testable `src/` modules.

Flat composer prompts are explicit opt-ins by location, not by frontmatter. Pi auto-discovers root-level `.md` files under `.pi/prompts/` and `~/.pi/agent/prompts/` before extensions can filter the native prompt inventory. Composer-owned flat files therefore live in top-level `composed/` directories: `.pi/composed/` and `~/.pi/agent/composed/`. Pi reserves `extensions/`, `skills/`, `prompts/`, and `themes/` under those bases; `composed/` is unclaimed by current Pi versions. Any `.md` under `composed/` is composer-owned by location alone. Subfolders under `composed/` containing `_index.md` are groups; sibling `.md` files are subcommand prompts. `engine` chooses how owned content renders. Existing groups under `.pi/prompts/<group>/` are migrated once into `.pi/composed/<group>/` on first upgrade run, and the migration step is itself deprecated from the moment it ships. This separates resource ownership from rendering so composer can support enable/disable, dispatch modes, typed args, preprocessing, and future `engine: pi` owned prompts without requiring frontmatter type markers.

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
* Pi has no migration or runtime claim on `composed/`. The only legacy migration in Pi itself moves `commands/` → `prompts/` when `prompts/` does not exist; `composed/` is unaffected. Composer adds its own one-shot migration of `.pi/prompts/<group>/` → `.pi/composed/<group>/`, deprecated from day one.
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
* Ownership is location-based: discovery sets `kind` from where the file lives, not from frontmatter.
* Frontmatter `type` fields encountered in legacy or migrated content are preserved on the model for diagnostics and round-trip safety, but never required for ownership.
* Track disabled resources as tombstones so higher-precedence disabled paths mask lower-precedence resources.
* Keep runtime behavior source-compatible with current `NestedPrompt` and `EffectivePromptGroup` semantics during extraction.

**ADR Reference**: None — straightforward implementation from PRD decisions D1 through D4.

### Discovery and Registry

**Purpose**: Discover composer-owned resources and apply origin precedence deterministically.

**Key Details**:

* Move `getPromptRoots()`, `loadSingleGroup()`, `discoverGroups()`, and metadata parsing from `extensions/index.ts` into `src/discovery.ts`.
* Composer prompt roots are `.pi/composed/`, `~/.pi/agent/composed/`, and package-owned roots scanned by the extension itself.
* No frontmatter `type: prompt` or `type: group` is required. Discovery rules:
  * any `.md` directly under a composer root is a flat composer prompt;
  * any subfolder containing `_index.md` is a group, with sibling `.md` files as subcommands;
  * other subfolders without `_index.md` are scanned recursively for flat prompts.
* Preserve bundled → user → project ordering, with project winning duplicates and warnings naming both origins/files.
* Treat `.pi/prompts/*.md` files that contain composer-style frontmatter (for example `engine: liquid`) as misplaced resources: warn with a move instruction toward `.pi/composed/` instead of treating them as valid composer flat prompts.
* Continue ignoring native-root flat files without composer-style frontmatter so Pi-native prompt handling remains responsible for them.
* Parse `enabled: false` into disabled tombstones for groups, flat prompts, and grouped subcommands. No `type` field required.

**ADR Reference**: Candidate — location-based composer resource ownership is recorded in PRD D4; standalone ADR only if this becomes cross-package policy.

### Legacy Layout Migration

**Purpose**: Move existing user/project grouped prompts from the legacy `.pi/prompts/<group>/` path into the canonical `.pi/composed/<group>/` location once, with explicit operator warnings, and run only inside a bounded deprecation window.

**Key Details**:

* Add `src/migrate.ts` containing the one-shot migration step run before discovery.
* Migration is idempotent: if the target `composed/<group>/` already exists, skip the move and emit an explicit collision warning naming both source and target paths.
* Migration is non-destructive: never overwrite, never delete content.
* If the move fails (read-only filesystem, EXDEV across mount boundaries, locked files), continue reading the legacy path for that session only and warn again next session.
* Migration is marked deprecated in code and docs from the release in which it ships:
  * **this release**: migrate, warn, write a one-line deprecation note for any operator with legacy paths;
  * **next minor release**: same migration plus a stronger deprecation warning that includes the planned removal version;
  * **next major release**: remove the migration step entirely; surviving legacy paths are ignored with a one-time warning telling the operator to move them manually.

**ADR Reference**: None — PRD D10 captures the timeline.

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
| 2     | Location-based ownership model and disabled tombstones   | Phase 1        | M               |
| 3     | Named args parser and normalized arg schema              | Phase 1        | M               |
| 4     | Legacy layout migration (deprecated from day one)        | Phase 2        | M               |
| 5     | Command orchestration update for hybrid processing       | Phases 2, 3, 4 | M               |
| 6     | Liquid renderer and `composed/` flat discovery           | Phases 2, 3    | M               |
| 7     | Typed interactive collection and validation UI           | Phases 3, 5, 6 | M               |
| 8     | Docs, examples, roadmap updates, and manual Pi checklist | Phases 2-7     | M               |
| 9     | Full local verification and release readiness check      | Phase 8        | S               |

### Phase 1: Module extraction baseline

Move current behavior out of `extensions/index.ts` without product changes. Keep tests green at each extraction step, especially helper parsing, discovery, order, bundled `/compose`, and extension-flow tests. This phase should not add Liquid, flat prompts, or new arg semantics.

### Phase 2: Location-based ownership model and disabled tombstones

Introduce `PromptDefinition` and switch ownership to location-based: any `.md` under `.pi/composed/` is composer-owned; folders with `_index.md` are groups; siblings are subcommand prompts. Drop required `type: prompt` and `type: group` frontmatter, but preserve any legacy `type` fields found in migrated or older content. Model `enabled: false` resources as tombstones. Existing grouped behavior must remain source-compatible.

### Phase 3: Named args and schema normalization

Add parser support for enhanced object schemas and named CLI inputs. Normalize legacy array args and object args into distinct internal variants so `engine: pi` compatibility cannot be broken by Liquid behavior.

### Phase 4: Legacy layout migration (deprecated from day one)

Implement one-shot migration from `.pi/prompts/<group>/` and `~/.pi/agent/prompts/<group>/` into `.pi/composed/<group>/` and `~/.pi/agent/composed/<group>/`. Migration is idempotent, never overwrites, and emits explicit warnings on collisions and filesystem failures. Mark the migration step as deprecated in code and docs from this release; plan a stronger warning next minor and removal in the next major release.

### Phase 5: Command orchestration update

Make command handlers consume `PromptDefinition` instances regardless of whether the source is a flat prompt or a grouped subcommand. Preserve bare `/group` selector behavior and direct `/group subcommand` dispatch. Add hybrid-mode disabled path blocking only for legacy or misplaced paths still resolving through native Pi prompts.

### Phase 6: Liquid renderer

Add `liquidjs` only after a small ESM/Node spike confirms the API shape. Configure a safe allowlist, render with `{ args, prompt }`, and snapshot documented syntax. Add flat prompt registration for `.md` files under `.pi/composed/` and `~/.pi/agent/composed/` with `engine: liquid`. Do not expose process/env/filesystem/shell providers.

### Phase 7: Typed collection and validation UI

Collect required strings/numbers/booleans through input prompts, enum args through selector UI, and arrays through documented splitting or repeated syntax chosen during implementation. Block render on validation failures and surface actionable diagnostics.

### Phase 8: Docs and examples

Document flat composer prompts, location-based ownership, named args, Liquid context, supported filters, precedence, the legacy `.pi/prompts/<group>/` deprecation timeline, and migration guidance. Add one realistic flat enhanced prompt example and update roadmap status.

### Phase 9: Full local verification and release readiness check

Run the repo gate from `AGENTS.md` (`mise run hooks:typecheck`, `mise run hooks:lint`, `mise run hooks:test`, and `mise run skills:validate`), update the manual testing checklist, and confirm release notes call out the location-based ownership change and the migration deprecation timeline.

## Risks and Mitigations

| Risk                                                     | Likelihood | Impact | Mitigation                                                                                                                |
| -------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Extraction changes behavior before new features land     | Medium     | High   | Keep Phase 1 behavior-only, commit separately, and require existing tests to stay green.                                  |
| Authors leak documentation files into `composed/`        | Medium     | Medium | Document that `composed/` is exclusively for prompts; warn on any `.md` whose frontmatter looks intentionally non-prompt. |
| Flat composer prompts shadow native prompts unexpectedly | Medium     | High   | Keep flat composer prompts under `.pi/composed/`, warn on composer duplicates, and document extension precedence.         |
| Disabled resources reappear through fallback paths       | Medium     | High   | Model disabled resources as tombstones and block disabled paths in hybrid input handling.                                 |
| Liquid default behavior exposes more than intended       | Low        | High   | Disable filesystem access, expose only `{ args, prompt }`, and use a documented filter allowlist.                         |
| Named args parser becomes ambiguous                      | Medium     | Medium | Support only `--name value` and `name=value` first; keep positional mapping out of Liquid.                                |
| Typed UI collection blocks headless flows                | Medium     | Medium | Detect noninteractive contexts where possible and fail with clear diagnostics when required args are missing.             |
| Docs drift from shipped behavior                         | Medium     | Medium | Update docs/examples only after tests prove behavior, then run `skills:validate` and manual checklist.                    |

## Open Questions

Resolved by the PRD and treated as implementation constraints:

* Drop typed resource markers; ownership comes from location under `.pi/composed/` and `_index.md` presence in subfolders. Preserve any legacy `type` fields encountered in migrated content.
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
