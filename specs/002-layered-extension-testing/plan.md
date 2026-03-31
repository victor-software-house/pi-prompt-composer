# Implementation Plan: Layered Extension Testing

**Branch**: `[002-layered-extension-testing]` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/002-layered-extension-testing/spec.md`

## Summary

Add the repository's first automated test suite covering the currently implemented grouped-prompt extension behavior in `extensions/index.ts`. The suite uses three test layers — helper tests for pure functions (Layer 1), discovery tests with temporary filesystem fixtures (Layer 2), and extension-flow tests via `@marcfargas/pi-test-harness` (Layer 3) — each tested at the cheapest layer that can exercise the behavior. The implementation adds named exports to `extensions/index.ts` for testability, introduces vitest with a separate test tsconfig, and updates the repository's verification workflow to include `bun run test`.

## Technical Context

**Language/Version**: TypeScript 5.9, strict ESM  
**Primary Dependencies**: `@mariozechner/pi-coding-agent@0.63.x` (runtime peer dep), `vitest@4.x` (test runner), `@marcfargas/pi-test-harness@0.5.0` (Layer 3 integration)  
**Storage**: N/A — tests use transient temp directories only  
**Testing**: vitest (`bun run test` = `vitest --run`, `bun run test:watch` = `vitest`)  
**Target Platform**: Developer machine running Bun and Pi  
**Project Type**: Single-package Pi extension library  
**Performance Goals**: Layer 1+2 tests complete in <2s total; Layer 3 tests complete in <30s per scenario  
**Constraints**: Must preserve current runtime behavior in `extensions/index.ts`; no new runtime source directories; all refactoring limited to adding named exports  
**Scale/Scope**: ~15–25 test scenarios across three test files covering the 8 exported pure functions, the discovery engine, and 4 extension-flow paths

## Constitution Check

*GATE: PASS — pre-Phase 0 and post-Phase 1 design.*

- [x] Scope is grounded in the repository's current state and does not describe roadmap items as already implemented.
- [x] The design preserves Pi-native prompt behavior unless the spec explicitly changes that contract.
- [x] Planned file paths match the real repo layout, or this plan explicitly creates any new paths it depends on.
- [x] Documentation updates are identified for every operator-facing, packaging, or workflow change.
- [x] Validation steps include `bun install`, `bun run fix`, `bun run typecheck`, `bun run lint`, and any new test command added by this feature.

**Specific grounding notes**:
- No new product behavior is introduced (CC-001, NG-001).
- `extensions/index.ts` remains the single runtime entrypoint; only named exports are added.
- `test/` is a new directory but is not a runtime path — it contains only test files.
- `vitest.config.ts` and `tsconfig.test.json` are new config files at repo root.
- Documentation updates required: `README.md` (verification guidance), `AGENTS.md` (verification commands), `package.json` (test scripts and dev deps).
- The verification workflow becomes: `bun install`, `bun run fix`, `bun run typecheck`, `bun run lint`, `bun run test`.

## Project Structure

### Documentation (this feature)

```text
specs/002-layered-extension-testing/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research output
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 quickstart
├── contracts/
│   └── test-suite-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (from /spec tasks)
```

### Source Code (repository root)

```text
# Existing — unchanged runtime layout
extensions/
└── index.ts             # Add named exports for testability

# New — test infrastructure
test/
├── helpers.test.ts      # Layer 1: pure function tests
├── discovery.test.ts    # Layer 2: filesystem discovery tests
└── extension-flow.test.ts  # Layer 3: pi-test-harness integration

# New — test configuration
vitest.config.ts
tsconfig.test.json

# Updated
package.json             # Add test scripts and dev deps
README.md                # Add test verification guidance
AGENTS.md                # Add test command to verification workflow
```

**Structure Decision**: Test files live in a top-level `test/` directory, not inside `extensions/`. This prevents confusion between test files and runtime extension code. The `extensions/` directory remains the single runtime source directory. `tsconfig.test.json` extends the base config to include `test/` without affecting production type-checking.

## Planned File Changes

### Modified files

| File | Change | Reason |
|------|--------|--------|
| `extensions/index.ts` | Add `export` keyword to 8 helper functions, export types, keep default export unchanged | Enable Layer 1+2 test imports (R-003, R-004) |
| `package.json` | Add `test` and `test:watch` scripts; add `vitest`, `@marcfargas/pi-test-harness`, `@mariozechner/pi-ai`, `@mariozechner/pi-agent-core` dev deps | FR-001, FR-007, R-008, R-009 |
| `README.md` | Add `bun run test` to verification section | CC-003, FR-007 |
| `AGENTS.md` | Add `bun run test` to verification workflow | CC-003, FR-007 |

### New files

| File | Purpose |
|------|---------|
| `test/helpers.test.ts` | Layer 1: tests for `parseCommandArgs`, `substituteArgs`, `toKebabCase`, `isValidArgsItem`, `parseArgsMetadata`, `fmString`, `formatArgsHint`, `formatSelectorLabel` |
| `test/discovery.test.ts` | Layer 2: tests for `discoverGroups` with temp dir fixtures |
| `test/extension-flow.test.ts` | Layer 3: tests for direct dispatch, bare-command selector, unknown subcommand feedback, selector cancellation |
| `vitest.config.ts` | vitest configuration |
| `tsconfig.test.json` | TypeScript config for test files |

## Implementation Phases

### Phase 0: Research and design closure (complete)

All unknowns resolved in [research.md](./research.md):
- Test framework: vitest (R-001)
- Integration framework: @marcfargas/pi-test-harness (R-002)
- Testability approach: named exports, no new source dirs (R-003)
- Export list with layer assignments (R-004)
- File structure (R-005)
- TypeScript config strategy (R-006)
- vitest config (R-007)
- Package.json changes (R-008)
- Dev dependencies (R-009)
- Discovery testability: already parameterized (R-010)
- Extension-flow strategy: harness + fixtures + events (R-011)
- Fixture design: programmatic temp dirs (R-012)

### Phase 1: Data model and interface design (this plan)

- [data-model.md](./data-model.md): test entity model
- [contracts/test-suite-contract.md](./contracts/test-suite-contract.md): test suite interface contract
- [quickstart.md](./quickstart.md): operator validation steps
- [.specify/memory/pi-agent.md](../../.specify/memory/pi-agent.md): durable context update

### Phase 2: Implementation slices (for `/spec tasks`)

1. **Infrastructure slice**: Add dev deps, vitest config, tsconfig.test.json, test scripts.
2. **Export slice**: Add named exports to `extensions/index.ts` (pure helpers, types, discovery function).
3. **Layer 1 slice**: Write `test/helpers.test.ts` covering all 8 pure functions with representative and boundary inputs.
4. **Layer 2 slice**: Write `test/discovery.test.ts` covering group recognition, scope attribution, metadata fallbacks, warnings, and edge cases.
5. **Layer 3 slice**: Write `test/extension-flow.test.ts` covering direct dispatch, selector flow, unknown subcommand, and cancellation.
6. **Documentation slice**: Update `README.md`, `AGENTS.md`, and `package.json` verification guidance.
7. **Validation slice**: Run full verification workflow: `bun install`, `bun run fix`, `bun run typecheck`, `bun run lint`, `bun run test`.

## Validation Strategy

- **Static validation**: `bun install`, `bun run fix`, `bun run typecheck`, `bun run lint`
- **Automated test validation**: `bun run test` (all three layers)
- **Regression signal**: FR-006 requires targeted failure messages — verify by intentionally breaking a helper and confirming the right test fails with a clear signal
- **Coexistence check**: FR-008 — verify `bun run typecheck` and `bun run lint` still pass after adding test infrastructure
- **Coverage scope**: Not a numeric coverage gate (NG-003), but all acceptance scenarios from the spec must have corresponding test cases

## Complexity Tracking

No constitution violations require justification. The implementation:
- Adds only named exports to the existing runtime file (no behavioral change)
- Creates a `test/` directory (not a runtime path)
- Adds config files that do not affect the published package
- Updates documentation to reflect the new test command
