# Research: Layered Extension Testing

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-03-31

## R-001: Test framework choice

**Decision**: vitest  
**Rationale**: The `pi-extension-testing` skill recommends vitest for all three test layers. Vitest is the de facto standard in the Pi extension ecosystem, works natively with TypeScript and ESM, and supports the node environment needed for filesystem tests. pnpm can run vitest through `pnpm exec vitest` or package scripts.  
**Alternatives considered**:
- Node built-in test runner — lacks the existing Vitest integration and would require a separate integration framework for Layer 3
- `jest` — heavier configuration overhead for ESM/TypeScript projects; no advantage over vitest for this use case

## R-002: Integration test framework for Layer 3

**Decision**: `@marcfargas/pi-test-harness@0.5.0`  
**Rationale**: Purpose-built for Pi extension integration testing. Provides `createTestSession()` with real Pi extension loading, playbook-driven model scripting, mock UI (`select`, `notify`), and event collection. Verified available on npm at version 0.5.0. Peer depends on `@mariozechner/pi-coding-agent >=0.50.0`, `@mariozechner/pi-ai`, and `@mariozechner/pi-agent-core` — all available.  
**Alternatives considered**:
- Hand-rolled mocks for `ExtensionAPI` — would duplicate significant Pi internals and miss real extension lifecycle behavior; the harness already solves this cleanly
- Testing only at Layer 1+2 and deferring Layer 3 — rejected by the spec, which explicitly commits to broad coverage across all three categories

## R-003: Testability approach for the single-file extension

**Decision**: Add named exports to `extensions/index.ts` for pure helpers, types, and discovery functions alongside the existing default export. No new source directories.  
**Rationale**:
- The default export is a function — importing `extensions/index.ts` in test files does not auto-execute anything; named exports are safe to import independently
- `discoverGroups(roots, warnings)` already accepts prompt roots as a parameter, so temp-dir injection works without refactoring
- All pure helpers (`parseCommandArgs`, `substituteArgs`, `toKebabCase`, `isValidArgsItem`, `parseArgsMetadata`, `fmString`, `formatArgsHint`, `formatSelectorLabel`) are stateless functions with no Pi runtime dependency
- The spec's FR-009 requires preserving current runtime behavior and keeping `extensions/index.ts` as implementation truth; named exports achieve testability without layout changes  
**Alternatives considered**:
- Extract to `src/helpers.ts` + `src/discovery.ts` — cleaner separation but introduces `src/` which the constitution says must not be treated as standard layout until committed; also adds import-path complexity and packaging changes
- Extract to `extensions/helpers.ts` siblings — could be confused with additional extension entry points by future readers; adds unnecessary files for this scope
- Keep everything private and test only through Layer 3 — loses the cost advantage of Layer 1+2 tests; also makes regression diagnosis harder per FR-006

## R-004: What to export for testing

**Decision**: Export the following as named exports from `extensions/index.ts`:

| Export | Layer | Purpose |
|--------|-------|---------|
| `parseCommandArgs` | 1 | Test argument splitting, quoting |
| `substituteArgs` | 1 | Test placeholder replacement |
| `toKebabCase` | 1 | Test name normalization |
| `isValidArgsItem` | 1 | Test metadata validation |
| `parseArgsMetadata` | 1 | Test args array validation, warnings |
| `fmString` | 1 | Test frontmatter string extraction |
| `formatArgsHint` | 1 | Test hint formatting |
| `formatSelectorLabel` | 1 | Test selector label composition |
| `discoverGroups` | 2 | Test filesystem discovery with injected roots |
| Types: `PromptScope`, `PromptRoot`, `ArgsItem`, `NestedPrompt`, `EffectivePromptGroup` | 1+2 | Type-safe test assertions |

**Not exported** (tested indirectly through Layer 3):
- `getPromptRoots()` — depends on `getAgentDir()` at runtime; tested indirectly when the harness creates a session with a controlled `cwd`
- `registerGroupedCommands()` — internal to the extension entry point; tested through Layer 3 command invocation

**Rationale**: Export the minimum needed to test each layer independently. Functions that depend on Pi runtime stay private and get covered by integration tests.

## R-005: Test file structure

**Decision**: Three test files in a `test/` directory at repo root:

```text
test/
  helpers.test.ts        # Layer 1 — pure functions
  discovery.test.ts      # Layer 2 — filesystem discovery
  extension-flow.test.ts # Layer 3 — pi-test-harness integration
```

**Rationale**: Mirrors the three named test categories from the spec. Keeps tests naturally grouped by cost and dependency. `test/` at repo root is the vitest convention and avoids placing test files inside `extensions/` where they could be confused with runtime code.

## R-006: TypeScript configuration for tests

**Decision**: Add a `tsconfig.test.json` that extends the base `tsconfig.json` and adds `test/**/*.ts` to `include`. Keep the base `tsconfig.json` unchanged (only includes `extensions/**/*.ts`) so production type-checking is unaffected.

**Rationale**: The existing `tsconfig.json` is strict and only includes `extensions/`. Tests need vitest globals, test-harness types, and access to `test/` files. A separate test config keeps production builds clean. Vitest reads `tsconfig.test.json` via its config.

**Alternatives considered**:
- Add `test/` to the base `tsconfig.json` include — would include test files in production type-checking (`pnpm run typecheck`), potentially changing error surface and slowing down the production gate
- Use only vitest's built-in TypeScript support without a tsconfig — loses strict checking in test files

## R-007: vitest configuration

**Decision**: Add `vitest.config.ts` at repo root:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30_000,
    include: ['test/**/*.test.ts'],
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
});
```

**Rationale**: `globals: true` enables `describe`/`test`/`expect` without imports, matching Pi ecosystem conventions. 30s timeout accommodates Layer 3 session creation. Explicit include avoids picking up files outside `test/`.

## R-008: Package.json and verification workflow changes

**Decision**: Add these scripts to `package.json`:

```json
{
  "test": "vitest --run",
  "test:watch": "vitest"
}
```

Update `AGENTS.md` and `README.md` verification guidance to include `pnpm run test` alongside existing `pnpm run typecheck` and `pnpm run lint`.

**Rationale**: FR-007 and FR-008 require adding the test command to the standard verification workflow and documenting it. CC-003 requires updating the verification workflow. `vitest --run` runs once and exits (CI-friendly). `vitest` alone enters watch mode for development.

## R-009: Dev dependency additions

**Decision**: Add these dev dependencies:

```
vitest                              # Layer 1+2 test runner
@marcfargas/pi-test-harness         # Layer 3 integration harness
@mariozechner/pi-ai                 # Peer dep of pi-test-harness
@mariozechner/pi-agent-core         # Peer dep of pi-test-harness
```

**Rationale**: vitest is needed for all test layers. The harness and its peers are needed for Layer 3. All are dev-only; they do not affect the published package.

## R-010: Discovery function testability

**Decision**: No refactoring needed for `discoverGroups()`.  
**Rationale**: The function already accepts `roots: PromptRoot[]` as a parameter, which allows injecting temp directory paths. The `warnings: string[]` output array is also injectable and inspectable. This design is test-friendly without modification.

`getPromptRoots()` cannot be unit-tested in isolation because it calls `getAgentDir()` (Pi runtime). This is acceptable — it is a thin glue function with minimal logic, and its behavior is covered by Layer 3 tests where the harness sets `cwd`.

## R-011: Extension-flow test strategy

**Decision**: Use `createTestSession()` with:
- `cwd` set to a temp dir containing pre-built prompt fixtures
- `extensions` pointing to the real `extensions/index.ts`
- `mockUI.select` controlling selector interaction
- `mockTools` stubbing bash/read/write/edit to prevent real filesystem operations by the model
- Event collection (`t.events.uiCallsFor('notify')`, `t.events.messages`) for asserting dispatch and feedback

**Key pattern**: Prompt directories must exist in `cwd` *before* `createTestSession()` because extension discovery runs at load time.

**Scenarios to cover**:
1. Direct `/group subcommand args` → assert `sendUserMessage` dispatches rendered content
2. Bare `/group` → mock select picks option → assert dispatched prompt
3. Unknown `/group badcmd` → assert `notify` called with warning and alternatives
4. Bare `/group` → select cancelled (undefined) → assert no message dispatched

**Rationale**: This strategy tests the real extension code paths through Pi's actual runtime without needing a live model. The harness's playbook can script the model's tool calls, and mock UI controls operator interactions.

## R-012: Fixture design for Layer 2 tests

**Decision**: Build prompt fixtures programmatically in `beforeEach` using `mkdtempSync` + `mkdirSync` + `writeFileSync`. Clean up in `afterEach` with `rmSync`.

Standard fixture helper:
```typescript
function createGroup(
  rootDir: string,
  name: string,
  prompts: Record<string, string>,
  indexFm = '---\ntype: group\ndescription: Test group\n---\n'
) {
  const groupDir = join(rootDir, name);
  mkdirSync(groupDir, { recursive: true });
  writeFileSync(join(groupDir, '_index.md'), indexFm);
  for (const [fileName, content] of Object.entries(prompts)) {
    writeFileSync(join(groupDir, fileName), content);
  }
}
```

**Rationale**: Programmatic fixtures are explicit, self-documenting, and avoid the need for committed fixture directories that could be confused with real prompt templates.
