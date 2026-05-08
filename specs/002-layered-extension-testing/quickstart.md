# Quickstart: Layered Extension Testing

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Date**: 2026-03-31

## Prerequisites

- pnpm installed (project uses pnpm for package management)
- Repository cloned and on the `002-layered-extension-testing` branch (or later, after merge)
- Dependencies installed: `pnpm install`

## Running Tests

### Full test suite (CI mode)

```bash
pnpm run test
```

Runs all three test layers once and exits. Exit code 0 means all tests pass.

### Watch mode (development)

```bash
pnpm run test:watch
```

Runs tests and re-runs on file changes. Useful when writing or debugging tests.

### Full verification workflow

```bash
pnpm install
pnpm run fix
pnpm run typecheck
pnpm run lint
pnpm run test
```

This is the complete verification sequence. All five commands must pass before committing.

## Validation Checklist

After the feature is implemented, verify each item:

### 1. Infrastructure works

```bash
# Install should succeed with new dev deps
pnpm install

# Test command should exist and run
pnpm run test
```

Expected: vitest runs, discovers test files in `test/`, reports results.

### 2. Layer 1 — Helper tests pass

```bash
pnpm run test -- test/helpers.test.ts
```

Expected: All pure function tests pass. Each of the 8 exported helpers has at least one test scenario.

Spot check — intentionally break a helper and verify targeted failure:
1. Temporarily change `toKebabCase` to return input unchanged
2. Run `pnpm run test -- test/helpers.test.ts`
3. Verify that only `toKebabCase` tests fail, with clear messages
4. Revert the change

### 3. Layer 2 — Discovery tests pass

```bash
pnpm run test -- test/discovery.test.ts
```

Expected: All discovery tests pass. Scenarios cover:
- Group recognition and rejection (no `_index.md`, wrong type, empty groups)
- Scope attribution (user vs project)
- Metadata fallbacks and warnings (missing description, malformed args)
- Duplicate group name warnings
- Non-md file and subdirectory exclusion

### 4. Layer 3 — Extension-flow tests pass

```bash
pnpm run test -- test/extension-flow.test.ts
```

Expected: All extension-flow tests pass. Scenarios cover:
- Direct dispatch: `/group subcommand arg1 arg2` sends rendered content
- Selector flow: bare `/group` opens selector, selection dispatches prompt
- Selector cancellation: no message dispatched
- Unknown subcommand: warning notification with available alternatives

### 5. Existing gates still pass

```bash
pnpm run typecheck
pnpm run lint
```

Expected: No regressions. The test infrastructure does not affect production type-checking or linting.

### 6. Named exports don't break runtime

Load the extension in a real Pi session and verify grouped prompt behavior is unchanged:
1. Create a test prompt directory with `_index.md` (type: group) and at least one nested `.md` file
2. Start Pi in the project directory
3. Use `/groupname subcommand` — verify direct dispatch works
4. Use `/groupname` — verify selector opens
5. Use `/groupname badcmd` — verify unknown subcommand feedback

This manual step is optional if Layer 3 integration tests pass, but provides full end-to-end confidence.

## Troubleshooting

### vitest not found

```bash
pnpm install  # Ensure dev deps are installed
```

### Layer 3 tests fail with import errors

Check that all pi-test-harness peer deps are installed:

```bash
pnpm list | grep -E "pi-test-harness|pi-ai|pi-agent-core"
```

All three should appear in the output.

### Tests pass but typecheck fails

Ensure `tsconfig.test.json` exists and only `tsconfig.json` (not the test config) is used by `pnpm run typecheck`.

### Tests timeout

Layer 3 tests have a 30-second timeout per scenario. If timeouts occur:
- Check that prompt fixtures are created before `createTestSession()`
- Check that the harness session disposes correctly in `afterEach`
