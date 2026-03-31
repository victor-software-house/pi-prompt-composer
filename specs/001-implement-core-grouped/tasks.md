# Tasks: Core Grouped Prompt Routing

**Input**: Design documents from `/specs/001-implement-core-grouped/`
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/`

**Tests**: No automated test tasks are included because the spec and plan do not request TDD or a new test suite. Manual validation via `specs/001-implement-core-grouped/quickstart.md` and the required repo commands in `package.json` is mandatory.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story while respecting this repo's single-entrypoint runtime layout.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g. `US1`, `US2`, `US3`)
- Include exact file paths in descriptions

## Path Conventions

- Runtime code stays in `extensions/index.ts` for this slice
- Operator-facing docs stay in `README.md`
- Validation scenarios live in `specs/001-implement-core-grouped/quickstart.md`
- Repo validation commands are defined in `package.json`

---

## Phase 1: Setup (Shared Context)

**Purpose**: Confirm the active implementation surface and validation targets before changing code.

- [ ] T001 Review the current extension stub and existing Pi extension imports in `extensions/index.ts` before adding grouped prompt routing.
- [ ] T002 [P] Review the operator validation scenarios in `specs/001-implement-core-grouped/quickstart.md` and the required repo commands in `package.json` before implementation.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared runtime infrastructure that MUST exist before any user story can work.

**⚠️ CRITICAL**: No user story work should start until this phase is complete.

- [ ] T003 Add local `parseCommandArgs()` and `substituteArgs()` reimplementations with source-provenance comments in `extensions/index.ts`.
- [ ] T004 Add grouped prompt runtime types plus description fallback helpers for prompt roots, groups, and nested prompts in `extensions/index.ts`.
- [ ] T005 Add filesystem discovery helpers that scan `~/.pi/agent/prompts` and `<cwd>/.pi/prompts` for first-level grouped prompt candidates in `extensions/index.ts`.
- [ ] T006 Build the effective grouped-command registry with project-over-user precedence and preserved scope metadata in `extensions/index.ts`.

**Checkpoint**: Foundation ready. Grouped prompt data can now be used by story-specific command flows.

---

## Phase 3: User Story 1 - Run a nested prompt directly (Priority: P1) 🎯 MVP

**Goal**: Let operators run `/group subcommand ...` and receive the rendered grouped prompt as a visible user message.

**Independent Test**: Create a prompt folder with at least one nested prompt, run `/group subcommand` with example arguments, and confirm the matching prompt content is sent as a visible user message with Pi-compatible substitution.

### Implementation for User Story 1

- [ ] T007 [US1] Register one extension command per effective grouped prompt in `extensions/index.ts`.
- [ ] T008 [US1] Implement direct `/group subcommand ...` parsing and nested-prompt lookup in `extensions/index.ts`.
- [ ] T009 [US1] Render grouped prompt bodies with Pi-compatible argument substitution and dispatch them with `pi.sendUserMessage()` follow-up handling in `extensions/index.ts`.
- [ ] T010 [US1] Add package-owned unknown-subcommand feedback in `extensions/index.ts` that names the group, echoes the unknown subcommand, and lists the available nested prompts.
- [ ] T011 [US1] Validate the direct-dispatch and invalid-subcommand scenarios from `specs/001-implement-core-grouped/quickstart.md` against the implementation in `extensions/index.ts`.

**Checkpoint**: User Story 1 should now support direct grouped prompt execution independently of later stories.

---

## Phase 4: User Story 2 - Discover nested prompts from a bare group command (Priority: P2)

**Goal**: Let operators enter `/group` with no subcommand, discover available nested prompts, and dispatch the selected prompt.

**Independent Test**: Create a prompt group with multiple nested prompts, enter `/group`, select one option, and confirm the chosen prompt is dispatched as a visible user message.

### Implementation for User Story 2

- [ ] T012 [US2] Add nested-prompt autocomplete through `getArgumentCompletions()` in `extensions/index.ts`.
- [ ] T013 [US2] Implement the bare `/group` selector flow with `ctx.ui.select()` and selected-prompt dispatch in `extensions/index.ts`.
- [ ] T014 [US2] Use `_index.md` group descriptions and nested prompt description fallbacks in the grouped selector UX within `extensions/index.ts`.
- [ ] T015 [US2] Validate the bare-command discovery scenario from `specs/001-implement-core-grouped/quickstart.md` against the implementation in `extensions/index.ts`.

**Checkpoint**: User Story 2 should now make grouped prompts discoverable without memorizing subcommands.

---

## Phase 5: User Story 3 - Organize prompts by folder without breaking existing prompts (Priority: P3)

**Goal**: Support grouped prompt folders in both prompt roots while preserving flat prompt behavior and deterministic project-over-user precedence.

**Independent Test**: Add grouped prompt directories beside existing flat prompt files in both supported roots, reload discovery, and confirm grouped commands appear while non-conflicting flat prompts continue to work unchanged.

### Implementation for User Story 3

- [ ] T016 [US3] Ensure grouped discovery ignores root-level flat `.md` prompts, deeper nested directories, non-markdown files, and empty groups in `extensions/index.ts`.
- [ ] T017 [US3] Surface winning scope metadata for duplicate groups in package-owned command descriptions or feedback in `extensions/index.ts`.
- [ ] T018 [US3] Rebuild grouped prompt discovery during extension load or reload so added, removed, and overridden prompt groups refresh predictably in `extensions/index.ts`.
- [ ] T019 [US3] Validate coexistence, duplicate-precedence, and same-name flat-prompt conflict scenarios from `specs/001-implement-core-grouped/quickstart.md` against the implementation in `extensions/index.ts`.

**Checkpoint**: All three user stories should now work without breaking unrelated flat prompt templates.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final documentation and required repo-wide validation.

- [ ] T020 Update grouped prompt usage, precedence, selector behavior, and visible user-message dispatch guidance in `README.md`.
- [ ] T021 Run `bun install`, `bun run fix`, `bun run typecheck`, and `bun run lint` from `package.json` before completion.
- [ ] T022 Run the full operator validation flow documented in `specs/001-implement-core-grouped/quickstart.md` after all implementation tasks are complete.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** — no dependencies; start immediately.
- **Phase 2: Foundational** — depends on Phase 1 and blocks all story work.
- **Phase 3: User Story 1** — depends on Phase 2; this is the MVP slice.
- **Phase 4: User Story 2** — depends on Phase 2 and reuses the dispatch flow from Phase 3.
- **Phase 5: User Story 3** — depends on Phase 2 and hardens coexistence/reload behavior on top of the same registry.
- **Phase 6: Polish** — depends on the user stories you intend to ship.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundation. No dependency on other user stories.
- **US2 (P2)**: Starts after Foundation. Reuses the grouped registry and dispatch primitives from US1, so sequential delivery is recommended in this repo.
- **US3 (P3)**: Starts after Foundation. Reuses the same registry and command registration path, so sequential delivery is recommended in this repo.

### Within Each User Story

- Finish registry and helper work before story-specific command behavior.
- Implement operator-facing behavior before story validation.
- Complete the story's quickstart validation before moving to the next priority.

---

## Parallel Opportunities

- `T001` and `T002` can run in parallel during setup.
- Most runtime implementation tasks are intentionally **not** marked `[P]` because this slice concentrates almost all behavior in `extensions/index.ts`.
- Documentation and final validation should wait until the corresponding runtime behavior is stable.

---

## Parallel Example: Setup

```bash
Task: "Review the current extension stub and existing Pi extension imports in extensions/index.ts before adding grouped prompt routing."
Task: "Review the operator validation scenarios in specs/001-implement-core-grouped/quickstart.md and the required repo commands in package.json before implementation."
```

## Parallel Example: User Story 1

```bash
# No safe [P] implementation tasks for US1.
# Keep T007-T011 sequential because they all modify extensions/index.ts.
```

## Parallel Example: User Story 2

```bash
# No safe [P] implementation tasks for US2.
# Keep T012-T015 sequential because they all modify extensions/index.ts.
```

## Parallel Example: User Story 3

```bash
# No safe [P] implementation tasks for US3.
# Keep T016-T019 sequential because they all modify extensions/index.ts.
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1.
4. Validate the direct-dispatch scenarios in `specs/001-implement-core-grouped/quickstart.md`.
5. Stop and confirm the MVP works before adding discovery and coexistence hardening.

### Incremental Delivery

1. Setup + Foundation establish the grouped prompt registry and Pi-compatible helpers.
2. Add US1 for direct grouped prompt execution.
3. Add US2 for autocomplete and bare-command discovery.
4. Add US3 for coexistence, precedence UX, and reload hardening.
5. Finish with README and repo-wide validation.

### Recommended Execution Order

1. T001-T006
2. T007-T011
3. T012-T015
4. T016-T019
5. T020-T022

---

## Notes

- All tasks use the repository's actual current file layout.
- `README.md` is the only required documentation sync target for this implementation slice.
- `package.json` remains the source of truth for required validation commands.
- `specs/001-implement-core-grouped/quickstart.md` remains the source of truth for manual operator validation.
