# Data Model: Core Grouped Prompt Routing

## Overview

The first useful slice needs a runtime-only model for scanning prompt roots, representing grouped directories, resolving precedence, and dispatching nested prompts without changing flat Pi prompt templates.

## Entities

### 1. Prompt Root

Represents one supported discovery root.

| Field | Type | Description |
|---|---|---|
| `scope` | `'user' | 'project'` | Where the prompt root lives. |
| `rootPath` | `string` | Absolute directory path to scan. |
| `exists` | `boolean` | Whether the directory exists at load time. |

**Validation rules**
- Only two roots participate in this slice: `~/.pi/agent/prompts` and `<cwd>/.pi/prompts`.
- Flat `.md` files at the root are ignored by this package because Pi already handles them natively.

### 2. Nested Prompt

Represents one runnable markdown prompt file inside a group directory.

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Subcommand name, derived from the filename stem and normalized to lowercase kebab-case. |
| `filePath` | `string` | Absolute path to the `.md` file. |
| `description` | `string` | Required `frontmatter.description` used in grouped UX. |
| `args` | `{ name: string; required: boolean; hint: string }[]` | Required operator-visible argument guidance metadata from frontmatter. |
| `content` | `string` | Prompt body after frontmatter stripping and before argument substitution. |
| `scope` | `'user' | 'project'` | Originating prompt-root scope. |
| `groupName` | `string` | Parent grouped command name. |

**Validation rules**
- Must be a `.md` file directly inside a first-level group directory.
- `frontmatter.description` is required.
- `frontmatter.args` is required and each item must define `name`, `required`, and `hint`.
- `_index.md` is never a runnable nested prompt.
- Non-markdown files and deeper directories are ignored.

### 3. Prompt Group Candidate

Represents a first-level directory discovered in one prompt root before precedence resolution.

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Group command name, derived from the directory name. |
| `directoryPath` | `string` | Absolute path to the group directory. |
| `scope` | `'user' | 'project'` | Originating prompt-root scope. |
| `description` | `string` | Required `_index.md` `frontmatter.description` used for group-level metadata. |
| `indexPath` | `string \| undefined` | Expected `_index.md` path for metadata/help. |
| `prompts` | `NestedPrompt[]` | Runnable nested prompts in this directory. |

**Validation rules**
- A candidate only becomes actionable when `prompts.length > 0`.
- `_index.md` must exist with `description` metadata for grouped UX.
- Invalid grouped metadata is skipped or surfaced through package-owned diagnostics according to implementation.

### 4. Effective Prompt Group

Represents the single operator-visible grouped command after duplicate resolution.

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Registered slash-command name. |
| `scope` | `'user' | 'project'` | Winning scope after precedence resolution. |
| `directoryPath` | `string` | Winning group directory path. |
| `description` | `string` | Group description used for command registration and selector UX. |
| `promptsByName` | `Map<string, NestedPrompt>` | Nested prompts keyed by subcommand name. |
| `promptNames` | `string[]` | Stable nested prompt names for autocomplete and errors. |

**Validation rules**
- Duplicate names resolve to the project-scoped candidate over the user-scoped candidate.
- The model does not merge prompts across scopes for the same group name.

## Relationships

- One `Prompt Root` contains zero or more `Prompt Group Candidate` records.
- One `Prompt Group Candidate` contains zero or more `Nested Prompt` records.
- One `Effective Prompt Group` is selected from at most one winning `Prompt Group Candidate` per group name.

## State Flow

```text
extension load/reload
  -> scan prompt roots
  -> build prompt group candidates
  -> discard empty groups
  -> resolve duplicate names to effective groups
  -> register one /group command per effective group
  -> command invocation
     -> direct subcommand path OR bare selector path
     -> render with Pi-native arg substitution
     -> send visible user message
```

## Derived Views

### Autocomplete view

- Input: `EffectivePromptGroup.promptNames`
- Output: filtered completion items for the first nested prompt token after `/group`

### Selector view

- Input: `EffectivePromptGroup.promptsByName`
- Output: human-readable list labels combining normalized nested prompt name and required description, plus `args` hints where grouped UX surfaces them

### Error view

- Input: attempted subcommand + `EffectivePromptGroup.promptNames`
- Output: helpful unknown-subcommand message with available alternatives
