# Tasks: Layered Extension Testing

**Input**: Design documents from `/specs/002-layered-extension-testing/`  
**Prerequisites**: `plan.md` (required), `spec.md` (required for user stories), `research.md`, `data-model.md`, `contracts/test-suite-contract.md`, `quickstart.md`

**Tests**: This feature IS the test suite. All three user stories produce test files as their primary deliverable. Test tasks are mandatory per the spec and plan.

**Organization**: Tasks are grouped by user story. Each story maps to one test layer and can be implemented and validated independently once the foundational phase is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)
- Include exact file paths in descriptions

## Path Conventions

- Runtime code stays in `extensions/index.ts` (named exports added, no behavioral changes)
- Test files go in `test/` at repository root
- Test config: `vitest.config.ts` and `tsconfig.test.json` at repository root
- Operator-facing docs: `README.md` and `AGENTS.md`
- Validation scenarios: `specs/002-layered-extension-testing/quickstart.md`

---

## Phase 1: Setup (Test Infrastructure)

**Purpose**: Create the test runner configuration and TypeScript setup needed before any test file can be written.

- [ ] T001 [P] Create `vitest.config.ts` at repository root with `globals: true`, `environment: 'node'`, `testTimeout: 30_000`, `include: ['test/**/*.test.ts']`, and `typecheck.tsconfig` pointing to `./tsconfig.test.json` per research decision R-007
- [ ] T002 [P] Create `tsconfig.test.json` at repository root that extends `./tsconfig.json` and adds `test/**/*.ts` to `include`, adds `vitest/globals` to `types`, and keeps all strict settings from the base config per research decision R-006
- [ ] T003 Add `vitest`, `@marcfargas/pi-test-harness`, `@mariozechner/pi-ai`, and `@mariozechner/pi-agent-core` as dev dependencies in `package.json` and run `bun install` per research decision R-009
- [ ] T004 Add `"test": "vitest --run"` and `"test:watch": "vitest"` scripts to `package.json` per research decision R-008
- [ ] T005 Verify `bun run test` executes vitest and exits cleanly with zero tests found (no failures, no config errors)

---

## Phase 2: Foundational (Named Exports)

**Purpose**: Make the existing pure helpers, discovery function, and types importable from `extensions/index.ts` so that test files can access them.

**⚠️ CRITICAL**: No test file can import from `extensions/index.ts` until this phase is complete.

- [ ] T006 Add `export` keyword to these 8 helper functions in `extensions/index.ts`: `parseCommandArgs`, `substituteArgs`, `toKebabCase`, `isValidArgsItem`, `parseArgsMetadata`, `fmString`, `formatArgsHint`, `formatSelectorLabel` per research decision R-004 and the import contract in `contracts/test-suite-contract.md`
- [ ] T007 Add `export` keyword to the `discoverGroups` function in `extensions/index.ts` per research decision R-004
- [ ] T008 Add `export type` statements for `PromptScope`, `PromptRoot`, `ArgsItem`, `NestedPrompt`, and `EffectivePromptGroup` in `extensions/index.ts` per research decision R-004
- [ ] T009 Run `bun run typecheck` and `bun run lint` to confirm named exports do not break the existing strict TypeScript or lint gates in `extensions/index.ts`

**Checkpoint**: `extensions/index.ts` now has named exports alongside the unchanged default export. All existing lint and typecheck gates still pass.

---

## Phase 3: User Story 1 — Trust core helper behavior during refactors (Priority: P1) 🎯 MVP

**Goal**: Automated helper tests catch regressions in the 8 pure functions that power argument parsing, placeholder substitution, name normalization, metadata validation, and formatting.

**Independent Test**: Run `bun run test -- test/helpers.test.ts` — all tests pass. Intentionally break one helper and confirm only its tests fail with a clear signal identifying the function and scenario.

### Implementation for User Story 1

- [ ] T010 [US1] Create `test/helpers.test.ts` and add a `parseCommandArgs` describe block with scenarios: simple whitespace splitting, double-quoted strings, single-quoted strings, mixed quoting, empty input, whitespace-only input, and tab-separated input; import `parseCommandArgs` from `../extensions/index`
- [ ] T011 [US1] Add a `substituteArgs` describe block in `test/helpers.test.ts` with scenarios: positional `$1`/`$2` replacement, `$@` replacement, `$ARGUMENTS` replacement, `${@:N}` slice, `${@:N:L}` slice with length, missing positional args replaced with empty string, and template with no placeholders returned unchanged
- [ ] T012 [US1] Add a `toKebabCase` describe block in `test/helpers.test.ts` with scenarios: `.md` suffix removal, camelCase conversion, PascalCase conversion, spaces-to-dashes, underscores-to-dashes, already-kebab passthrough, special characters removed, and leading/trailing dashes stripped
- [ ] T013 [P] [US1] Add an `isValidArgsItem` describe block in `test/helpers.test.ts` with scenarios: valid item with all three fields, missing `name` → false, missing `required` → false, missing `hint` → false, wrong types → false, null → false, non-object → false
- [ ] T014 [P] [US1] Add a `parseArgsMetadata` describe block in `test/helpers.test.ts` with scenarios: valid array → returned as-is, `undefined`/`null` → returns `undefined` (no warning), non-array → returns `undefined` with warning, array with invalid items → returns `undefined` with warning, empty array → returned as-is
- [ ] T015 [P] [US1] Add an `fmString` describe block in `test/helpers.test.ts` with scenarios: string value → returned, number value → empty string, boolean value → empty string, missing key → empty string
- [ ] T016 [P] [US1] Add a `formatArgsHint` describe block in `test/helpers.test.ts` with scenarios: `undefined` args → empty string, empty array → empty string, required-only args, optional-only args (appends `?`), mixed required and optional
- [ ] T017 [P] [US1] Add a `formatSelectorLabel` describe block in `test/helpers.test.ts` with scenarios: prompt with args → `name [args] description`, prompt without args → `name description`; construct `NestedPrompt` objects using the exported type
- [ ] T018 [US1] Run `bun run test -- test/helpers.test.ts` and confirm all Layer 1 tests pass

**Checkpoint**: Layer 1 tests cover all 8 pure helpers with representative and boundary inputs. Regressions in any single helper produce a targeted, identifiable failure.

---

## Phase 4: User Story 2 — Validate grouped-prompt discovery against realistic prompt trees (Priority: P2)

**Goal**: Automated discovery tests verify grouped-prompt scanning against temporary filesystem fixtures covering both scopes, all metadata edge cases, and warning behavior.

**Independent Test**: Run `bun run test -- test/discovery.test.ts` — all tests pass. Each scenario creates its own temp directory tree, exercises `discoverGroups()`, and asserts on the resulting groups and warnings.

### Implementation for User Story 2

- [ ] T019 [US2] Create `test/discovery.test.ts` with `beforeEach`/`afterEach` helpers using `mkdtempSync`/`rmSync` for temp directory lifecycle, and a `createGroup` fixture helper that builds `_index.md` + nested prompt files in a given root directory; import `discoverGroups` and types from `../extensions/index`
- [ ] T020 [US2] Add a group-recognition describe block in `test/discovery.test.ts` with scenarios: directory with valid `_index.md` type: group and nested `.md` files → registered as `EffectivePromptGroup` with correct `name`, `scope`, `directoryPath`, `description`, `promptsByName`, and `promptNames`
- [ ] T021 [US2] Add a group-rejection describe block in `test/discovery.test.ts` with scenarios: directory without `_index.md` → skipped, `_index.md` with wrong type → skipped, `_index.md` present but no nested `.md` → skipped (empty group)
- [ ] T022 [P] [US2] Add a nested-prompt-filtering describe block in `test/discovery.test.ts` with scenarios: `.md` files registered, `_index.md` excluded from nested prompts, `.txt` and `.json` files ignored, subdirectories inside group ignored
- [ ] T023 [P] [US2] Add a scope-attribution describe block in `test/discovery.test.ts` with scenarios: prompts from user-scoped root get `scope: 'user'`, prompts from project-scoped root get `scope: 'project'`, pass two `PromptRoot` entries and verify both scopes appear
- [ ] T024 [US2] Add a metadata-fallback describe block in `test/discovery.test.ts` with scenarios: `_index.md` missing `description` → warning + directory name fallback, nested prompt missing `description` → warning + filename-stem fallback, nested prompt with `name` override → used instead of kebab-case stem
- [ ] T025 [US2] Add an args-metadata describe block in `test/discovery.test.ts` with scenarios: valid `args` array → parsed on prompt, absent `args` → `undefined` (no warning), malformed `args` (not array) → `undefined` + warning, invalid items in `args` array → `undefined` + warning
- [ ] T026 [US2] Add a duplicate-group-names describe block in `test/discovery.test.ts` with scenario: same directory name in two roots → both groups registered + a warning mentioning both scopes
- [ ] T027 [P] [US2] Add a nonexistent-root describe block in `test/discovery.test.ts` with scenario: `PromptRoot` pointing to a path that does not exist → skipped silently with no warnings and no errors
- [ ] T028 [US2] Run `bun run test -- test/discovery.test.ts` and confirm all Layer 2 tests pass

**Checkpoint**: Layer 2 tests cover all discovery rules from the contract, including recognition, rejection, scope, metadata fallbacks, warnings, and edge cases. Changes to discovery logic produce targeted failures.

---

## Phase 5: User Story 3 — Prove grouped command flows through the extension boundary (Priority: P3)

**Goal**: Automated extension-flow tests verify that command registration, direct dispatch, selector flow, and unknown-subcommand feedback work as real Pi extension behavior.

**Independent Test**: Run `bun run test -- test/extension-flow.test.ts` — all tests pass. Each scenario creates prompt fixtures, loads the extension in a `createTestSession()`, and asserts on dispatched messages or UI calls.

### Implementation for User Story 3

- [ ] T029 [US3] Create `test/extension-flow.test.ts` with a fixture helper that builds a project-scoped prompt directory (`.pi/prompts/<group>/`) in a temp `cwd`, including `_index.md` with `type: group` and at least two nested `.md` prompts with `$1`/`$ARGUMENTS` placeholders; import `createTestSession` and related utilities from `@marcfargas/pi-test-harness`
- [ ] T030 [US3] Add a direct-dispatch test in `test/extension-flow.test.ts`: create a session with the real `extensions/index.ts`, invoke `/group subcommand arg1 arg2` via playbook, and assert `sendUserMessage` is called with rendered content containing the substituted arguments
- [ ] T031 [US3] Add a selector-flow test in `test/extension-flow.test.ts`: create a session with `mockUI.select` returning the first option, invoke bare `/group` via playbook, and assert `sendUserMessage` is called with the selected prompt's body content
- [ ] T032 [US3] Add a selector-cancellation test in `test/extension-flow.test.ts`: create a session with `mockUI.select` returning `undefined`, invoke bare `/group` via playbook, and assert no `sendUserMessage` call is made
- [ ] T033 [US3] Add an unknown-subcommand test in `test/extension-flow.test.ts`: create a session, invoke `/group nonexistent` via playbook, and assert `ctx.ui.notify` is called with a warning containing the unknown name and a list of available alternatives
- [ ] T034 [US3] Run `bun run test -- test/extension-flow.test.ts` and confirm all Layer 3 tests pass

**Checkpoint**: Layer 3 tests prove the four operator-visible command flows work through the real Pi extension runtime. Extension behavior changes produce targeted failures.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation sync, workflow integration, and final end-to-end validation.

- [ ] T035 [P] Add `bun run test` to the verification section of `README.md` alongside existing `bun run typecheck` and `bun run lint` commands per CC-003 and FR-007
- [ ] T036 [P] Add `bun run test` to the verification workflow in `AGENTS.md` under the "Required gate before committing" and "Verification" sections per CC-003 and FR-007
- [ ] T037 Run the full verification workflow from the repository root: `bun install`, `bun run fix`, `bun run typecheck`, `bun run lint`, `bun run test` per the plan's validation strategy and `specs/002-layered-extension-testing/quickstart.md`
- [ ] T038 Verify existing `bun run typecheck` and `bun run lint` gates pass without regressions after all test infrastructure changes per FR-008

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1: Setup** — no dependencies; start immediately
- **Phase 2: Foundational** — depends on Phase 1 (vitest config must exist before exports are meaningful to tests)
- **Phase 3: US1 (Layer 1)** — depends on Phase 2 (needs named exports)
- **Phase 4: US2 (Layer 2)** — depends on Phase 2 (needs named exports including `discoverGroups`)
- **Phase 5: US3 (Layer 3)** — depends on Phase 2 (needs extension loaded by harness); independent of US1 and US2
- **Phase 6: Polish** — depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2. No dependency on other user stories. Layer 1 tests import only pure helpers.
- **US2 (P2)**: Starts after Phase 2. No dependency on other user stories. Layer 2 tests import `discoverGroups` and types.
- **US3 (P3)**: Starts after Phase 2. No dependency on other user stories. Layer 3 tests use `createTestSession` with the full extension.
- **US1, US2, US3 can all proceed in parallel** after Phase 2 since each writes to a different test file.

### Within Each User Story

- Create the test file and first describe block before adding additional scenario blocks
- All `[P]`-marked scenario blocks within a story can be written in parallel (different describe blocks in the same file)
- Run the layer-specific test command as the final task in each story
- Complete story validation before moving to the next priority

---

## Parallel Opportunities

### Setup Phase

```
T001 (vitest.config.ts) and T002 (tsconfig.test.json) can run in parallel
```

### After Phase 2

```
All three user stories write to different files and can proceed in parallel:
  T010-T018 → test/helpers.test.ts
  T019-T028 → test/discovery.test.ts
  T029-T034 → test/extension-flow.test.ts
```

### Within User Story 1

```
T013, T014, T015, T016, T017 can run in parallel (independent describe blocks in test/helpers.test.ts)
```

### Within User Story 2

```
T022, T023, T027 can run in parallel (independent describe blocks in test/discovery.test.ts)
```

### Polish Phase

```
T035 (README.md) and T036 (AGENTS.md) can run in parallel
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational (T006–T009)
3. Complete Phase 3: User Story 1 (T010–T018)
4. **STOP and VALIDATE**: `bun run test -- test/helpers.test.ts` passes
5. The repository now has its first automated test safety net

### Incremental Delivery

1. Setup + Foundational → vitest runs, named exports available
2. Add US1 → Layer 1 helper tests → validate independently → first regression safety net
3. Add US2 → Layer 2 discovery tests → validate independently → filesystem behavior covered
4. Add US3 → Layer 3 extension-flow tests → validate independently → full extension behavior covered
5. Polish → docs updated, full verification workflow confirmed
6. Each story adds independent value without breaking previous stories

### Recommended Execution Order

Sequential (single-agent):
1. T001–T005 (Setup)
2. T006–T009 (Foundational)
3. T010–T018 (US1 — Layer 1)
4. T019–T028 (US2 — Layer 2)
5. T029–T034 (US3 — Layer 3)
6. T035–T038 (Polish)

---

## Summary

| Phase | Story | Tasks | Parallel? |
|-------|-------|-------|-----------|
| 1: Setup | — | T001–T005 | T001, T002 parallel |
| 2: Foundational | — | T006–T009 | Sequential (same file) |
| 3: US1 – Layer 1 | Helper tests (P1) | T010–T018 | T013–T017 parallel |
| 4: US2 – Layer 2 | Discovery tests (P2) | T019–T028 | T022, T023, T027 parallel |
| 5: US3 – Layer 3 | Extension-flow tests (P3) | T029–T034 | Sequential (session setup) |
| 6: Polish | — | T035–T038 | T035, T036 parallel |
| **Total** | | **38 tasks** | |

- **Tasks per user story**: US1: 9, US2: 10, US3: 6
- **Parallel opportunities**: 3 stories can proceed in parallel after Phase 2; multiple describe blocks within stories are parallel-safe
- **Independent test criteria**: Each story has a layer-specific `bun run test` invocation that validates only that story's test file
- **Suggested MVP scope**: Phase 1 + Phase 2 + User Story 1 (T001–T018) delivers the first regression safety net with Layer 1 helper tests

## Notes

- All tasks use the repository's actual current file layout per the constitution's scaffold-truth principle.
- `extensions/index.ts` modifications are limited to adding `export` keywords — no behavioral changes.
- Test files import from `../extensions/index` — no new runtime source directories.
- `vitest.config.ts` and `tsconfig.test.json` are excluded from the published npm package via the existing `files` whitelist in `package.json`.
- The `test/` directory is not a runtime path and will not be discovered by Pi's extension loader.
