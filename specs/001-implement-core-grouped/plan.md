# Implementation Plan: Core Grouped Prompt Routing

**Branch**: `[001-implement-core-grouped]` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-implement-core-grouped/spec.md`

**Note**: This plan covers the first useful implementation slice requested for `extensions/index.ts`. It intentionally stops before guided argument collection, preprocessing, or deeper nesting.

## Summary

Implement the first useful grouped-routing slice in `extensions/index.ts`: scan Pi's user and project prompt roots for first-level prompt directories, build an in-memory registry with scope metadata and project-over-user precedence, register one extension command per effective group, offer subcommand autocomplete, resolve `/group subcommand` and bare `/group` selector flows, render prompt bodies with Pi's native argument helpers, and send the final rendered prompt as a visible user message without changing flat prompt-template behavior.

## Technical Context

**Language/Version**: TypeScript 5.9, strict ESM  
**Primary Dependencies**: `@mariozechner/pi-coding-agent` (`registerCommand`, `ctx.ui.select`, `sendUserMessage`, `parseCommandArgs`, `substituteArgs`, `parseFrontmatter`, `getPromptsDir`, `CONFIG_DIR_NAME`); Node built-ins `node:fs` and `node:path`  
**Storage**: In-memory grouped-prompt registry rebuilt from local filesystem prompt roots on extension load/reload  
**Testing**: `bun install`, `bun run fix`, `bun run typecheck`, `bun run lint` (no test suite yet)  
**Target Platform**: Pi interactive extension runtime on the operator machine, reading `~/.pi/agent/prompts` and `<cwd>/.pi/prompts`  
**Project Type**: Single-package Pi extension library  
**Performance Goals**: Limit discovery to two prompt roots and one directory level; use prebuilt in-memory maps for autocomplete and dispatch; avoid per-keystroke rescans  
**Constraints**: Preserve flat prompt behavior; grouped commands remain extension commands; support exactly `/group subcommand`; first slice excludes guided argument collection and package-native preprocessing; selector UI only accepts `string[]`; public Pi APIs do not allow overriding command `sourceInfo`  
**Scale/Scope**: Two prompt roots, first-level directories only, expected tens to low hundreds of grouped prompts and nested prompt files per session

## Constitution Check

Status: PASS before Phase 0 research and after Phase 1 design.

- [x] Scope is grounded in the repository's current state and does not describe roadmap items as already implemented.
- [x] The design preserves Pi-native prompt behavior unless the spec explicitly changes that contract.
- [x] Planned file paths match the real repo layout, or this plan explicitly creates any new paths it depends on.
- [x] Documentation updates are identified for every operator-facing, packaging, or workflow change.
- [x] Validation steps include `bun install`, `bun run fix`, `bun run typecheck`, `bun run lint`, and any new test command added by this feature.

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

**Structure Decision**: Keep runtime code in the existing `extensions/index.ts` entrypoint for this first slice. `/spec plan` only adds design artifacts under `specs/001-implement-core-grouped/`. The implementation slice should not introduce `src/`, examples, or new top-level runtime directories. When code lands, update `README.md` to document grouped prompt layout, precedence, selector behavior, and visible user-message dispatch.

## Planned Implementation Files

- `extensions/index.ts` — add grouped prompt discovery, registry construction, duplicate resolution, command registration, autocomplete, bare-command selector flow, direct subcommand dispatch, and visible user-message sending.
- `README.md` — document the grouped directory convention, project-vs-user precedence, selector behavior, and the fact that grouped commands are extension commands layered over native flat prompt templates.
- `specs/001-implement-core-grouped/*` — maintain planning artifacts and validation notes for this slice.

## Implementation Phases

### Phase 0: Research and design closure

- Confirm the public Pi APIs available for grouped commands.
- Resolve open spec-quality gaps needed for implementation, especially directory eligibility, naming behavior, `_index.md` usage, duplicate precedence, and busy-session dispatch behavior.
- Record those decisions in `research.md`.

### Phase 1: Data model and interface design

- Define the registry entities needed to represent prompt roots, candidate groups, nested prompts, and effective commands.
- Document the grouped slash-command contract in `contracts/grouped-command-contract.md`.
- Produce `quickstart.md` with operator validation steps for direct dispatch, selector flow, coexistence with flat prompts, and precedence.
- Update `.specify/memory/pi-agent.md` with durable planning decisions.

### Phase 2: Implementation slice for `/spec tasks`

1. Add local types and discovery helpers in `extensions/index.ts`.
2. Scan `~/.pi/agent/prompts` and `.pi/prompts` for first-level grouped directories.
3. Load `_index.md` and nested prompt files with `parseFrontmatter()` and Pi-compatible description fallback.
4. Resolve duplicate groups with project-over-user precedence and preserve scope metadata on the winning registry entries.
5. Register one command per effective group with `getArgumentCompletions()` backed by the registry.
6. Route `/group subcommand ...` through `parseCommandArgs()` + `substituteArgs()` and send the rendered prompt via `pi.sendUserMessage()`.
7. Route bare `/group` through `ctx.ui.select()` and then dispatch the selected prompt.
8. Return clear unknown-subcommand feedback listing available nested prompts.
9. Run `bun install`, `bun run fix`, `bun run typecheck`, and `bun run lint`.
10. Update `README.md` if the implementation changes operator-visible behavior from current docs.

## Validation Strategy

- Static validation: `bun install`, `bun run fix`, `bun run typecheck`, `bun run lint`
- Operator validation:
  - Direct `/group subcommand arg1 arg2` dispatch sends rendered content as a visible user message.
  - Bare `/group` opens a selector and dispatches the chosen prompt.
  - Unknown subcommand shows the available alternatives.
  - A grouped command name that matches a flat prompt still resolves to the extension command.
  - Duplicate group names across user and project roots resolve consistently to the project-scoped group.

## Complexity Tracking

No constitution violations currently require justification.
