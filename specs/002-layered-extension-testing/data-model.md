# Data Model: Layered Extension Testing

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Date**: 2026-03-31

## Overview

This data model describes the entities that the test suite operates on. Tests do not introduce new runtime entities — they exercise the existing runtime types from `extensions/index.ts` plus test-specific constructs (fixtures, scenarios, assertions).

## Runtime Entities Under Test

These types already exist in `extensions/index.ts` and will be exported as named exports for test access.

### PromptScope

```typescript
type PromptScope = 'user' | 'project';
```

Discriminates prompt discovery source. Tests verify correct attribution.

### PromptRoot

```typescript
interface PromptRoot {
  scope: PromptScope;
  rootPath: string;
}
```

Input to `discoverGroups()`. Tests inject temp directory paths via this interface.

### ArgsItem

```typescript
interface ArgsItem {
  name: string;
  required: boolean;
  hint: string;
}
```

Validated metadata from nested prompt frontmatter `args` arrays. Tests verify `isValidArgsItem()` and `parseArgsMetadata()` against valid, invalid, and malformed inputs.

### NestedPrompt

```typescript
interface NestedPrompt {
  name: string;        // kebab-case normalized or frontmatter override
  filePath: string;    // absolute path to the .md file
  description: string; // from frontmatter or filename-stem fallback
  args: ArgsItem[] | undefined;  // validated args or undefined
  content: string;     // body after frontmatter stripping
  scope: PromptScope;  // inherited from parent PromptRoot
  groupName: string;   // parent directory name
}
```

Core entity for discovered prompts within a group. Tests verify field values from discovery and their use in formatting and dispatch.

### EffectivePromptGroup

```typescript
interface EffectivePromptGroup {
  name: string;                           // directory name
  scope: PromptScope;                     // from PromptRoot
  directoryPath: string;                  // absolute path
  description: string;                    // from _index.md or directory-name fallback
  promptsByName: Map<string, NestedPrompt>;  // name → prompt lookup
  promptNames: string[];                  // sorted name list for selector/autocomplete
}
```

Top-level discovery result. Tests verify correct group construction, prompt aggregation, and sorting.

## Test-Specific Entities

### PromptFixture

Not a runtime type — a programmatic construct used in Layer 2 and Layer 3 tests to build controlled prompt directory structures.

```
Fixture = {
  rootDir: string               // mkdtempSync result
  groups: {
    name: string                // directory name
    indexContent: string        // _index.md content (frontmatter + body)
    prompts: {
      fileName: string          // e.g. "create.md"
      content: string           // frontmatter + body
    }[]
  }[]
}
```

**Creation pattern**: `mkdtempSync` → `mkdirSync` for each group → `writeFileSync` for `_index.md` and nested prompts.  
**Cleanup**: `rmSync(rootDir, { recursive: true, force: true })` in `afterEach`.

### Test Scenario Model

Each test maps to a specific behavior path:

| Layer | Scenario Input | Observable Output | Assertion Target |
|-------|---------------|-------------------|------------------|
| 1 | Function arguments (strings, arrays, objects) | Return value | Direct equality or shape check |
| 2 | `PromptRoot[]` + temp directories | `EffectivePromptGroup[]` + `warnings[]` | Group structure, prompt fields, warning messages |
| 3 | Playbook turn (`/group subcommand args`) | Events (`messages`, `uiCallsFor`) | Dispatched content, notify calls, select interactions |

## Entity Relationships

```
PromptRoot (injected in tests)
  └─ EffectivePromptGroup (discovered)
       ├─ name, scope, description
       └─ NestedPrompt (discovered per .md file)
            ├─ name (toKebabCase or override)
            ├─ description (fmString or fallback)
            ├─ args (parseArgsMetadata)
            └─ content (substituteArgs target)
```

## Layer Coverage Map

| Entity / Function | Layer 1 | Layer 2 | Layer 3 |
|-------------------|---------|---------|---------|
| `parseCommandArgs` | ✓ direct | — | ✓ implicit |
| `substituteArgs` | ✓ direct | — | ✓ implicit |
| `toKebabCase` | ✓ direct | ✓ implicit | ✓ implicit |
| `isValidArgsItem` | ✓ direct | — | — |
| `parseArgsMetadata` | ✓ direct | ✓ implicit | — |
| `fmString` | ✓ direct | ✓ implicit | — |
| `formatArgsHint` | ✓ direct | — | — |
| `formatSelectorLabel` | ✓ direct | — | ✓ implicit |
| `discoverGroups` | — | ✓ direct | ✓ implicit |
| `getPromptRoots` | — | — | ✓ implicit |
| Command registration | — | — | ✓ direct |
| Selector flow | — | — | ✓ direct |
| Direct dispatch | — | — | ✓ direct |
| Unknown subcommand | — | — | ✓ direct |
| Autocomplete | — | — | — (manual) |

## State Transitions

Tests do not introduce persistent state. All state is within-test:

1. **Setup**: Create temp dir → build fixtures → import functions or create test session
2. **Exercise**: Call function or invoke command
3. **Assert**: Compare output/events against expected values
4. **Teardown**: Dispose session (Layer 3) → delete temp dir
