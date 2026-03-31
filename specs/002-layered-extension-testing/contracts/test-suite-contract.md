# Test Suite Contract

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)  
**Date**: 2026-03-31

## Purpose

This contract defines the interface between the test suite and the repository's development workflow. It specifies how tests are invoked, what they guarantee, and how they integrate with existing validation gates.

## Invocation Interface

### Commands

| Command | Behavior | Exit Code |
|---------|----------|-----------|
| `bun run test` | Run all tests once, exit | 0 on pass, 1 on failure |
| `bun run test:watch` | Run tests in watch mode, re-run on file changes | Interactive |

### Implementation

```json
{
  "scripts": {
    "test": "vitest --run",
    "test:watch": "vitest"
  }
}
```

### Verification Workflow Integration

The complete repository verification workflow after this feature:

```bash
bun install
bun run fix
bun run typecheck
bun run lint
bun run test
```

`bun run test` is added at the end. It must pass independently and must not interfere with the existing lint and type-check gates.

## Test File Discovery

Vitest discovers test files matching:

```
test/**/*.test.ts
```

No test files exist inside `extensions/` or any other runtime directory.

## Layer Contracts

### Layer 1 — Helper Tests (`test/helpers.test.ts`)

**Dependencies**: vitest only  
**Imports from**: `../extensions/index` (named exports)  
**Pi runtime required**: No  
**Filesystem I/O**: No

**Covered functions and scenarios**:

| Function | Scenario Categories |
|----------|-------------------|
| `parseCommandArgs` | Simple splitting, quoted strings (single/double), mixed quotes, empty input, whitespace-only, tabs |
| `substituteArgs` | Positional `$1`/`$2`, `$@`/`$ARGUMENTS`, `${@:N}`, `${@:N:L}`, missing args → empty, no placeholders |
| `toKebabCase` | Filename stems, camelCase, PascalCase, spaces, underscores, `.md` suffix removal, already-kebab, special chars |
| `isValidArgsItem` | Valid items, missing fields, wrong types, null, non-objects |
| `parseArgsMetadata` | Valid arrays, null/undefined → undefined, non-array → warning + undefined, invalid items → warning + undefined |
| `fmString` | String values, non-string values → empty, missing keys → empty |
| `formatArgsHint` | No args → empty, required-only, optional-only, mixed |
| `formatSelectorLabel` | With args hint, without args |

**Guarantee**: If any pure helper's observable behavior changes, at least one Layer 1 test fails with a message identifying the specific function and scenario.

### Layer 2 — Discovery Tests (`test/discovery.test.ts`)

**Dependencies**: vitest + `node:fs` + `node:os` + `node:path`  
**Imports from**: `../extensions/index` (named exports: `discoverGroups`, types)  
**Pi runtime required**: No (discovery accepts `PromptRoot[]` directly)  
**Filesystem I/O**: Temp directories created and destroyed per test

**Covered behaviors and scenarios**:

| Behavior | Scenario |
|----------|----------|
| Group recognition | Directory with `_index.md` type: group → registered |
| Group rejection: no index | Directory without `_index.md` → skipped |
| Group rejection: wrong type | `_index.md` with `type: prompt` → skipped |
| Group rejection: empty | `_index.md` present but no nested `.md` → skipped |
| Nested prompt registration | `.md` files (not `_index.md`) → registered as prompts |
| Non-md files ignored | `.txt`, `.json` in group dir → not registered |
| Subdirectories ignored | Nested dirs inside group → not registered |
| Scope attribution | User root prompts get `scope: 'user'`; project root prompts get `scope: 'project'` |
| Description fallback | Missing description on `_index.md` → warning + directory name used |
| Description fallback | Missing description on nested prompt → warning + filename stem used |
| Name override | `name` in nested prompt frontmatter → used instead of kebab-case stem |
| Args metadata: valid | `args` array with valid items → parsed and attached |
| Args metadata: absent | No `args` in frontmatter → `undefined` (silent) |
| Args metadata: malformed | `args` not an array → warning + `undefined` |
| Args metadata: invalid items | `args` array with bad items → warning + `undefined` |
| Duplicate group names | Same group name in two roots → warning emitted, both registered |
| Multiple groups | Multiple valid groups across roots → all discovered and sorted |
| Nonexistent root | `PromptRoot` pointing to missing dir → skipped silently |

**Guarantee**: If grouped-prompt discovery rules change, at least one Layer 2 test fails with a message identifying the affected discovery behavior.

### Layer 3 — Extension-Flow Tests (`test/extension-flow.test.ts`)

**Dependencies**: vitest + `@marcfargas/pi-test-harness` + Pi peer deps  
**Imports from**: `@marcfargas/pi-test-harness` (`createTestSession`, `when`, `says`, `calls`)  
**Pi runtime required**: Yes (real Pi session via harness)  
**Filesystem I/O**: Temp directories created before session, cleaned after

**Covered behaviors and scenarios**:

| Behavior | Scenario | Observable |
|----------|----------|------------|
| Direct dispatch | `/group subcommand arg1 arg2` | `sendUserMessage` called with rendered content containing substituted args |
| Selector flow | Bare `/group` → mock select picks first option | `sendUserMessage` called with selected prompt content |
| Selector cancellation | Bare `/group` → mock select returns undefined | No `sendUserMessage` call |
| Unknown subcommand | `/group nonexistent` | `notify` called with warning listing available alternatives |

**Fixture requirement**: Prompt directories must exist in the test `cwd` before `createTestSession()` is called (extension discovery runs at session load time).

**Guarantee**: If extension command behavior changes for any of the four user-facing flows, the corresponding Layer 3 test fails.

## Import Contract

### What `extensions/index.ts` exports

```typescript
// Named exports (new — for test access)
export function parseCommandArgs(argsString: string): string[];
export function substituteArgs(content: string, args: string[]): string;
export function toKebabCase(input: string): string;
export function isValidArgsItem(item: unknown): item is { name: string; required: boolean; hint: string };
export function parseArgsMetadata(raw: unknown, filePath: string, warnings: string[]): ArgsItem[] | undefined;
export function fmString(fm: Record<string, unknown>, key: string): string;
export function formatArgsHint(args: ArgsItem[] | undefined): string;
export function formatSelectorLabel(prompt: NestedPrompt): string;
export function discoverGroups(roots: PromptRoot[], warnings: string[]): EffectivePromptGroup[];

export type { PromptScope, PromptRoot, ArgsItem, NestedPrompt, EffectivePromptGroup };

// Default export (existing — unchanged)
export default function (pi: ExtensionAPI): void;
```

### What remains private

- `getPromptRoots()` — Pi runtime dependency, tested implicitly via Layer 3
- `registerGroupedCommands()` — extension lifecycle, tested implicitly via Layer 3

## Non-Guarantees

- The test suite does not guarantee a numeric code-coverage percentage (NG-003).
- The test suite does not cover future roadmap features (NG-002).
- The test suite does not verify Pi's own prompt-template behavior — only the extension's layer on top.
- Layer 3 tests depend on `@marcfargas/pi-test-harness` continuing to match Pi's session API. If the harness breaks with a Pi update, Layer 3 tests may fail for infrastructure reasons rather than product regressions.
