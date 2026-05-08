# Feature Specification: Layered Extension Testing

**Feature Branch**: `[002-layered-extension-testing]`  
**Created**: 2026-03-31  
**Status**: Draft  
**Input**: User description: "layered extension testing for prompt composer"

## Clarifications

### Session 2026-03-31

- Q: Which scope should this testing feature commit to in the spec? → A: Broad coverage across all three categories.
- Q: Should autocomplete (`getArgumentCompletions`) be in automated test scope? → A: No — autocomplete is verified via manual testing only; excluded from the automated suite.
- Q: Should Layer 3 tests assert dispatch-level contract details (deliverAs, substitution state, severity)? → A: Yes — one consolidated requirement; these are observable contract details that catch real regressions.

### Session 2026-04-01

- Q: Should `pnpm run test` be added to lefthook hooks, and if so, which hook? → A: Pre-push only — balances safety with developer speed; keeps every-commit latency low while catching test failures before code leaves the machine.
- Q: Should the test performance targets (<2s for Layer 1+2, <30s per Layer 3 scenario) be enforceable gates or advisory guidance? → A: Advisory — targets remain as design guidance in the plan, not as enforced gates or timing assertions.
- Q: When should the pi-test-harness API be verified against the assumed contract? → A: During T003 (dependency install) — inspect harness type exports after `pnpm install`; if API mismatches, update contract and Layer 3 tasks before writing test code.
- Q: Apply mechanical cleanups batch (merge T038→T037, T036 removes legacy sentence, optional spot check in T018, update plan scenario count)? → A: Yes — all four cleanups confirmed for downstream task/plan updates.

## Feature Summary

This feature adds the repository's first automated test coverage for the currently implemented grouped-prompt extension behavior in `extensions/index.ts`.

The spec uses three named test categories throughout:

1. **Helper tests** — fast isolated tests for pure behavior such as argument parsing, placeholder substitution, prompt-name normalization, metadata validation, and operator-facing label formatting.
2. **Discovery tests** — tests that create temporary prompt-directory fixtures and verify grouped-prompt scanning, scope attribution, warnings, and fallback behavior.
3. **Extension-flow tests** — higher-level tests that verify operator-visible command behavior through the extension boundary, including direct dispatch, bare-command selection, and unknown-subcommand feedback.

This feature commits to meaningful coverage in all three categories. It is not limited to helper-only or discovery-only validation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trust core helper behavior during refactors (Priority: P1)

As a maintainer, I want automated helper tests for prompt parsing, placeholder substitution, metadata validation, and formatting helpers so that I can change the extension without accidentally breaking its core grouped-prompt behavior.

**Why this priority**: The extension currently concentrates most behavior in one runtime file and has no automated safety net. Protecting the pure behavior with fast tests gives the highest confidence for the least setup effort.

**Independent Test**: Run the repository verification workflow plus the new test command against scenarios covering argument parsing, placeholder substitution, kebab-case normalization, metadata validation, and prompt-label formatting; the feature delivers value if regressions in those behaviors are caught automatically.

**Acceptance Scenarios**:

1. **Given** the extension's pure prompt helpers are exercised with representative valid inputs, **When** the automated test suite runs, **Then** the suite confirms that the rendered outputs match the documented grouped-prompt behavior.
2. **Given** the extension's pure prompt helpers are exercised with malformed or boundary-case inputs, **When** the automated test suite runs, **Then** the suite confirms that fallback behavior and warnings remain correct.
3. **Given** a future change alters a core helper's observable behavior, **When** the automated test suite runs, **Then** the suite fails with a targeted signal that identifies the regression.

---

### User Story 2 - Validate grouped-prompt discovery against realistic prompt trees (Priority: P2)

As a maintainer, I want automated discovery tests for prompt-root scanning and grouped-prompt discovery so that I can safely evolve prompt-loading logic without breaking supported directory layouts or warning behavior.

**Why this priority**: Discovery behavior encodes several repository-specific rules around `_index.md`, descriptions, args metadata, duplicate group names, and scope. These rules are central to the extension's operator experience and are best protected with realistic filesystem scenarios.

**Independent Test**: Create automated scenarios that build temporary prompt trees for user and project scopes, run discovery, and verify resulting groups, prompts, scope markers, and warning behavior without requiring a live Pi session.

**Acceptance Scenarios**:

1. **Given** supported prompt directories that contain valid grouped prompts, **When** automated discovery tests run, **Then** the resulting grouped registry matches the expected groups, nested prompts, descriptions, and scope attribution.
2. **Given** prompt directories with missing descriptions, malformed args metadata, duplicate group names, or unsupported contents, **When** automated discovery tests run, **Then** the suite confirms the documented warning and fallback behavior.
3. **Given** prompt directories that should be ignored because they do not qualify as grouped prompts, **When** automated discovery tests run, **Then** the suite confirms they do not become runnable grouped commands.

---

### User Story 3 - Prove grouped command flows through the extension boundary (Priority: P3)

As a maintainer, I want automated extension-flow tests for grouped commands so that command registration, direct dispatch, selector flow, and user-message delivery are verified as real extension behavior rather than only as isolated helpers.

**Why this priority**: Helper and discovery tests protect most logic, but extension behavior still depends on command registration and UI-triggered dispatch. This feature explicitly commits to broad coverage in this category so the extension does not only work in pieces.

**Independent Test**: Run automated scenarios that load the extension in a controlled session, invoke grouped commands through the same operator-facing entry points, and verify visible outcomes for direct dispatch, bare-command selection, and unknown-subcommand feedback.

**Acceptance Scenarios**:

1. **Given** a discovered grouped prompt, **When** an automated extension-level scenario invokes a valid `/group subcommand` command, **Then** the selected prompt is dispatched as a visible user message with the expected rendered content.
2. **Given** a discovered grouped prompt with multiple nested prompts, **When** an automated extension-level scenario invokes bare `/group` and selects one option, **Then** the selected prompt is dispatched as the visible follow-up message.
3. **Given** a discovered grouped prompt, **When** an automated extension-level scenario invokes an unknown subcommand, **Then** the scenario observes corrective feedback that lists the available alternatives.

### Edge Cases

- Helper tests must cover quoted arguments, empty argument positions, mixed placeholder forms, and cases where optional values are omitted.
- Discovery tests must cover both prompt scopes, duplicate group names across scopes, directories missing `_index.md`, `_index.md` with the wrong type, and groups with no runnable nested prompts.
- Discovery tests must cover nested prompt metadata cases where `description`, `name`, or `args` are absent or malformed without incorrectly preventing prompt registration.
- Extension-flow tests must cover selector cancellation and ensure that cancellation does not dispatch an unintended user message.
- The verification workflow must remain clear about which checks are mandatory when tests are added and which grouped-prompt behaviors are intentionally outside this feature's coverage.

## Compatibility & Non-Goals *(mandatory)*

### Compatibility Commitments

- **CC-001**: Adding automated tests MUST preserve the current observable behavior of grouped prompt routing, Pi-native placeholder handling, warning semantics, and command registration; tests are a safety net, not a behavior change.
- **CC-002**: Existing flat `.md` prompt-template behavior, grouped-command precedence over conflicting flat prompt names, `_index.md` group recognition rules, and user-versus-project scope attribution MUST remain documented and covered where relevant.
- **CC-003**: The repository's documented verification workflow MUST be updated to include any new test command so maintainers can run one consistent validation sequence. This includes updating `lefthook.yml` to add `pnpm run test` to the pre-push hook (not pre-commit, to avoid adding Layer 3 latency to every commit).

### Explicit Non-Goals

- **NG-001**: This feature will not introduce new grouped-prompt product behavior beyond what is needed to make existing behavior testable and verifiable.
- **NG-002**: This feature will not require exhaustive end-to-end coverage of every future roadmap item; it focuses on the current implemented extension behavior and the highest-value regression paths.
- **NG-003**: This feature will not define release gates based on a numeric code-coverage percentage.
- **NG-004**: This feature will not add automated tests for autocomplete (`getArgumentCompletions`) behavior; autocomplete is validated via manual testing during the quickstart verification.

## Assumptions

- This feature uses the three test categories defined in [Feature Summary](#feature-summary): helper tests, discovery tests, and extension-flow tests.
- The feature commits to broad coverage across all three test categories rather than treating extension-flow validation as an optional stretch goal.
- Some internal helpers may need to become importable or move into testable units, but any such refactor must preserve the repository's current runtime layout truth and avoid overstating architectural changes.
- The repository currently has no automated test suite, so this feature must also establish the minimal project-level commands and documentation needed to run tests reliably.
- The feature should prefer real Pi extension execution paths for higher-level validation when practical, while avoiding unnecessary external runtime complexity for lower-level behavior.
- The `@marcfargas/pi-test-harness` type exports MUST be verified against the assumed Layer 3 contract during dependency installation (Phase 1). If the actual API differs from the contract in `contracts/test-suite-contract.md`, the contract and Layer 3 tasks must be updated before Layer 3 implementation begins.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST add an automated test workflow for the repository that can be run from the repo root as part of normal validation.
- **FR-002**: The system MUST add automated tests for the currently implemented pure grouped-prompt helper behavior, including command-argument parsing, placeholder substitution, prompt-name normalization, metadata validation, and operator-facing label formatting.
- **FR-003**: The system MUST add automated discovery tests that exercise grouped-prompt scanning against realistic temporary prompt-directory structures for both user-scoped and project-scoped prompt roots.
- **FR-004**: Discovery tests MUST verify the documented rules for `_index.md` group recognition, missing description fallback, malformed args fallback, nested prompt registration, duplicate group-name warnings, and ignored unsupported contents.
- **FR-005**: The system MUST add automated extension-flow tests that exercise grouped command behavior through the extension boundary.
- **FR-005a**: Extension-flow tests MUST cover direct dispatch, bare-command selection, and unknown-subcommand feedback as separate observable behaviors within this feature, not as deferred follow-up work.
- **FR-005b**: Extension-flow tests MUST assert dispatch-level contract details: the `deliverAs: 'followUp'` option on dispatched messages, the absence of argument substitution in selector-flow dispatch, and the `'warning'` severity level on unknown-subcommand notifications.
- **FR-006**: The test suite MUST produce failures that identify the affected behavior clearly enough for a maintainer to distinguish helper regressions from discovery regressions and extension-flow regressions.
- **FR-007**: The repository MUST document how to install dependencies, run the automated tests, and include the test command in the standard verification guidance for future contributors. The test command MUST also be added to the lefthook pre-push hook so that test failures are caught before code leaves the developer machine.
- **FR-008**: The repository MUST preserve existing linting and type-checking gates while adding tests; the new test workflow must coexist with current validation commands rather than replacing them.
- **FR-009**: Any refactoring required to enable tests MUST preserve current runtime behavior and keep `extensions/index.ts` as the implementation truth unless and until committed source explicitly changes that layout.
- **FR-010**: The feature artifacts produced by the spec workflow for this change MUST stay aligned with current repository reality, including the absence of an existing test suite before this feature lands.

### Key Entities *(include if feature involves data)*

- **Test Category**: One of the three required validation slices in this feature: helper tests for isolated pure behavior, discovery tests for temporary-filesystem prompt scanning, and extension-flow tests for operator-visible grouped-command behavior through the extension boundary.
- **Test Scenario**: A concrete automated example with inputs, expected outputs, and pass/fail conditions tied to one observable aspect of grouped-prompt behavior.
- **Prompt Fixture**: A controlled prompt file or prompt-directory arrangement used to verify routing, metadata handling, fallback behavior, or warning behavior.
- **Validation Workflow**: The repository's documented sequence of commands maintainers run to verify formatting, linting, typing, and automated tests.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Maintainers can run one documented test command from the repo root and receive a pass/fail result for automated grouped-prompt validation within the normal repository workflow.
- **SC-002**: The automated suite covers all currently implemented pure helper behaviors and all documented grouped-prompt discovery rules at least once through explicit scenarios.
- **SC-003**: The automated suite covers all three required test categories — helper behavior, filesystem discovery, and extension-flow behavior — with explicit scenarios for each.
- **SC-003a**: Extension-flow coverage verifies direct dispatch, bare-command selection, and unknown-subcommand feedback without requiring manual interaction.
- **SC-004**: When a regression is intentionally introduced into helper behavior, discovery behavior, or command-flow behavior, the corresponding automated tests fail in the affected layer instead of passing silently.
- **SC-005**: Repository documentation and validation guidance remain internally consistent: a contributor following the documented commands can install dependencies, run tests, and understand where automated coverage applies.
