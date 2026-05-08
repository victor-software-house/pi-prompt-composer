# Implementation Plan: Core Grouped Prompt Routing

**Branch**: `[001-implement-core-grouped]` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-implement-core-grouped/spec.md`

**Note**: This plan covers the first useful implementation slice requested for `extensions/index.ts`. It intentionally stops before guided argument collection beyond schema-defined hints, preprocessing, or deeper nesting.

## Summary

Implement the first useful grouped-routing slice in `extensions/index.ts`: scan Pi's user and project prompt roots for first-level prompt directories marked by `_index.md` with `type: group` frontmatter, build an in-memory registry with scope metadata and lenient frontmatter handling (warn + fallback for missing descriptions, optional `args`), warn on duplicate group names without enforcing precedence, register one extension command per discovered group, offer subcommand autocomplete, resolve `/group subcommand` and bare `/group` selector flows, surface descriptions and optional `args`-based argument hints in grouped UX, render prompt bodies with Pi's native argument helpers, and send the final rendered prompt as a visible user message without changing flat prompt-template behavior.

## Technical Context

**Language/Version**: TypeScript 5.9, strict ESM  
**Primary Dependencies**: `@mariozechner/pi-coding-agent` (`registerCommand`, `ctx.ui.select`, `sendUserMessage`, `parseFrontmatter`, `getAgentDir`); local reimplementations of Pi's internal `parseCommandArgs` and `substituteArgs` (from `@mariozechner/pi-coding-agent@0.64.0/core/prompt-templates`); Node built-ins `node:fs` and `node:path`  
**Non-exported Pi internals reimplemented locally**: `parseCommandArgs`, `substituteArgs` (near-verbatim copies with source-reference comments pointing to `@mariozechner/pi-coding-agent@0.64.0` — `packages/coding-agent/src/core/prompt-templates.ts` in [badlogic/pi-mono](https://github.com/badlogic/pi-mono)); prompt root paths derived from `getAgentDir() + '/prompts'` and `process.cwd() + '/.pi/prompts'` since `getPromptsDir()` and `CONFIG_DIR_NAME` are not publicly exported  
**Future extraction target**: These local helpers are candidates for a shared `pi-provider-utils` npm package to avoid duplication across Pi extension repos  
**Storage**: In-memory grouped-prompt registry rebuilt from local filesystem prompt roots on extension load/reload; `_index.md` with `type: group` frontmatter is the hard gate for group recognition  
**Testing**: `pnpm install`, `pnpm run fix`, `pnpm run typecheck`, `pnpm run lint` (no test suite yet)  
**Target Platform**: Pi interactive extension runtime on the operator machine, reading `~/.pi/agent/prompts` and `<cwd>/.pi/prompts`  
**Project Type**: Single-package Pi extension library  
**Performance Guidance**: Limit discovery to two prompt roots and one directory level; use prebuilt in-memory maps for autocomplete and dispatch; avoid per-keystroke rescans. This is implementation guidance only — the spec explicitly excludes numeric latency thresholds for this slice.  
**Constraints**: Preserve flat prompt behavior; grouped commands remain extension commands; support exactly `/group subcommand`; first slice excludes guided argument collection beyond schema-defined hints and package-native preprocessing; selector UI only accepts `string[]`; public Pi APIs do not allow overriding command `sourceInfo`; duplicate group names are warned but not resolved by the package; `description` and `args` are lenient (warn+fallback, never skip prompts)  
**Scale/Scope**: Two prompt roots, first-level directories only, expected tens to low hundreds of grouped prompts and nested prompt files per session

## Constitution Check

Status: PASS before Phase 0 research and after Phase 1 design.

- [x] Scope is grounded in the repository's current state and does not describe roadmap items as already implemented.
- [x] The design preserves Pi-native prompt behavior unless the spec explicitly changes that contract.
- [x] Planned file paths match the real repo layout, or this plan explicitly creates any new paths it depends on.
- [x] Documentation updates are identified for every operator-facing, packaging, or workflow change.
- [x] Validation steps include `pnpm install`, `pnpm run fix`, `pnpm run typecheck`, `pnpm run lint`, and any new test command added by this feature.

## Project Structure

### Documentation (this feature)

```text
specs/001-implement-core-grouped/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── grouped-command-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
extensions/
└── index.ts

docs/
├── FEATURE-SET.md
├── IMPLEMENTATION-PLAN.md
└── ROADMAP.md

README.md
AGENTS.md
package.json
.specify/
└── ...
specs/
└── 001-implement-core-grouped/
```

**Structure Decision**: Keep runtime code in the existing `extensions/index.ts` entrypoint for this first slice. `/spec plan` only adds design artifacts under `specs/001-implement-core-grouped/`. The implementation slice should not introduce `src/`, examples, or new top-level runtime directories. When code lands, update `README.md` to document grouped prompt layout, required frontmatter schema, precedence, selector behavior, argument hints, and visible user-message dispatch.

## Planned Implementation Files

- `extensions/index.ts` — add local `parseCommandArgs()` and `substituteArgs()` reimplementations with source-reference comments; add grouped prompt discovery, registry construction, duplicate resolution, required frontmatter parsing and validation, command registration, autocomplete, bare-command selector flow, argument-hint surfacing, direct subcommand dispatch, and visible user-message sending.
- `README.md` — document the grouped directory convention, `_index.md` `type: group` gate, recommended vs optional frontmatter fields, duplicate-warning behavior, selector behavior, argument hints, and the fact that grouped commands are extension commands layered over native flat prompt templates.
- `specs/001-implement-core-grouped/*` — maintain planning artifacts and validation notes for this slice.

## Implementation Phases

### Phase 0: Research and design closure

- Confirm the public Pi APIs available for grouped commands.
- Resolve open spec-quality gaps needed for implementation, especially directory eligibility, naming behavior, required frontmatter schema, duplicate precedence, Pi-native scope marker behavior, and busy-session dispatch behavior.
- Record those decisions in `research.md`.

### Phase 1: Data model and interface design

- Define the registry entities needed to represent prompt roots, candidate groups, nested prompts, and effective commands.
- Document the grouped slash-command contract in `contracts/grouped-command-contract.md`.
- Produce `quickstart.md` with operator validation steps for direct dispatch, selector flow, coexistence with flat prompts, and precedence.
- Update `.specify/memory/pi-agent.md` with durable planning decisions.

### Phase 2: Implementation slice for `/spec tasks`

1. Add local reimplementations of `parseCommandArgs()` and `substituteArgs()` in `extensions/index.ts`, near-verbatim from Pi's `core/prompt-templates.ts`, with comments referencing `@mariozechner/pi-coding-agent@0.64.0` source paths and a note about future extraction to `pi-provider-utils`.
2. Add local types and discovery helpers in `extensions/index.ts`.
3. Scan prompt roots (`getAgentDir() + '/prompts'` and `process.cwd() + '/.pi/prompts'`) for first-level grouped directories.
4. Load `_index.md` and nested prompt files with `parseFrontmatter()` (imported from Pi). `_index.md` must have `type: group` (hard gate). `description` is recommended on both `_index.md` and nested prompts (warn + fallback to directory/file name). `args` is optional on nested prompts (silent if absent, warn if malformed). `name` override on nested prompts is optional. Never skip a nested prompt for metadata issues.
5. Warn on duplicate group names across scopes but do not enforce package-owned precedence. Preserve scope metadata in registry entries for diagnostics.
6. Register one command per effective group with `getArgumentCompletions()` backed by the registry and normalized lowercase kebab-case subcommand names.
7. Route `/group subcommand ...` through local `parseCommandArgs()` + `substituteArgs()`, and use optional nested prompt `args` metadata to surface operator-visible argument hints without adding guided collection.
8. Route bare `/group` through `ctx.ui.select()` and show the normalized subcommand name plus required description for each selector item before dispatch.
9. Return clear unknown-subcommand feedback listing available nested prompts.
10. Run `pnpm install`, `pnpm run fix`, `pnpm run typecheck`, and `pnpm run lint`.
11. Update `README.md` if the implementation changes operator-visible behavior from current docs.

## Validation Strategy

- Static validation: `pnpm install`, `pnpm run fix`, `pnpm run typecheck`, `pnpm run lint`
- Operator validation:
  - Direct `/group subcommand arg1 arg2` dispatch sends rendered content as a visible user message.
  - Bare `/group` opens a selector that shows normalized subcommand names plus required descriptions, then dispatches the chosen prompt.
  - Nested prompt metadata exposes `args`-based hints to operators without introducing guided argument collection.
  - Unknown subcommand shows the available alternatives.
  - A grouped command name that matches a flat prompt still resolves to the extension command.
  - Duplicate group names across user and project roots emit a warning; no package-owned precedence is enforced.

## Complexity Tracking

No constitution violations currently require justification.
