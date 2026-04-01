# Data Model: Publish Readiness

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Date**: 2026-04-01

## Overview

This feature does not introduce new runtime entities in `extensions/index.ts`. Instead, it adds package-distribution and maintainer-workflow artifacts around the existing extension. The important entities are example prompts, preview media, manifest metadata, manual validation steps, and release bootstrap state.

## Entities

### PackageManifestMetadata

Tracks the package fields that affect discoverability, installability, and gallery presentation.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `name` | string | existing | `pi-prompt-composer` |
| `description` | string | existing | Should stay concise and user-facing |
| `homepage` | string | yes | GitHub repo homepage |
| `bugs.url` | string | yes | Issue tracker URL |
| `engines.node` | string | yes | Minimum supported Node version |
| `keywords` | string[] | existing | Must keep `pi-package` for gallery discoverability |
| `files` | string[] | yes | Must include `extensions`, `examples`, `assets`, `README.md`, `LICENSE` |
| `pi.extensions` | string[] | existing | Remains `./extensions` |
| `pi.image` | string | yes | Stable URL to committed preview asset |
| `publishConfig.access` | string | existing | `public` |
| `publishConfig.provenance` | boolean | existing | `true` |

**Validation rules**:
- `homepage` and `bugs.url` must point to the actual GitHub repo.
- `files` must match the intended published tarball contents.
- `pi.image` must resolve to the committed preview asset used in the README.

### ExamplePromptGroup

A runnable grouped-prompt example shipped with the package.

| Field | Type | Notes |
|------|------|-------|
| `groupPath` | string | `examples/prompts/review/` |
| `groupName` | string | `review` |
| `indexFile` | ExamplePromptFile | `_index.md` with `type: group` |
| `promptFiles` | ExamplePromptFile[] | At least `summary.md` and `fix.md` |
| `copyTargetScopes` | string[] | User prompt root and project prompt root |

**Relationships**:
- One `ExamplePromptGroup` has one group metadata file and multiple nested prompt files.
- The README quick-start and manual test checklist both consume the same example group.

### ExamplePromptFile

Represents a single markdown file inside the example bundle.

| Field | Type | Required | Notes |
|------|------|----------|-------|
| `relativePath` | string | yes | e.g. `review/summary.md` |
| `role` | enum | yes | `group-index` or `nested-prompt` |
| `description` | string | yes | Mirrors frontmatter description |
| `hasArgsMetadata` | boolean | yes | At least one nested prompt should be `true` |
| `bodyPurpose` | string | yes | Human explanation of what the prompt demonstrates |

**Validation rules**:
- `_index.md` must contain `type: group`.
- At least one nested prompt must include `args` metadata.
- All example files must be self-contained and free of project-specific assumptions.

### PreviewScenario

Defines the deterministic visual state rendered by the preview generator.

| Field | Type | Notes |
|------|------|-------|
| `commandName` | string | `review` |
| `selectorItems` | PreviewSelectorItem[] | Derived from the example prompt group |
| `selectedIndex` | number | Which item is highlighted in the screenshot |
| `themeName` | string | Default Pi theme used for generation |
| `width` | number | Terminal width for deterministic layout |
| `rows` | number | Terminal height for deterministic layout |
| `title` | string | Frame caption if needed |

### PreviewSelectorItem

A single line item shown in the selector preview.

| Field | Type | Notes |
|------|------|-------|
| `label` | string | Subcommand name |
| `description` | string | Prompt description + args hint |
| `selected` | boolean | One item should be selected |

### PreviewArtifact

The committed output of the preview generator.

| Field | Type | Notes |
|------|------|-------|
| `sourceScenario` | PreviewScenario | Deterministic input state |
| `outputPath` | string | `assets/package-preview.svg` |
| `format` | enum | `svg` |
| `generatedBy` | string | `scripts/generate-package-preview.ts` |
| `consumers` | string[] | `README.md`, `package.json.pi.image` |

**Validation rules**:
- Regeneration should overwrite the same file path.
- The asset should render correctly on GitHub and npm.

### ManualTestChecklist

Maintainer-facing checklist for validating the real Pi operator experience.

| Field | Type | Notes |
|------|------|-------|
| `docPath` | string | `docs/MANUAL-TESTING.md` |
| `steps` | ManualTestStep[] | Ordered end-to-end checks |
| `requiredBeforePublish` | boolean | `true` |

### ManualTestStep

| Field | Type | Notes |
|------|------|-------|
| `id` | string | Stable identifier like `MT-001` |
| `action` | string | Concrete maintainer action |
| `expectedResult` | string | Observable success condition |
| `blocking` | boolean | Whether failure blocks first publish |

### ReleaseBootstrapState

Represents the one-time external npm trust setup needed before steady-state automated releases work.

| State | Meaning |
|------|---------|
| `unpublished` | Package does not yet exist on npm |
| `bootstrap-published` | Operator completed first manual `npm publish` |
| `bootstrap-tagged` | Matching git tag pushed to remote |
| `trusted-publisher-configured` | `npm trust github ...` completed for `.github/workflows/publish.yml` |
| `ci-release-ready` | Repo workflow can publish future versions automatically |

**State transitions**:
1. `unpublished` → `bootstrap-published`
2. `bootstrap-published` → `bootstrap-tagged`
3. `bootstrap-tagged` → `trusted-publisher-configured`
4. `trusted-publisher-configured` → `ci-release-ready`

### ReleaseWorkflowConfig

The GitHub Actions release pipeline contract.

| Field | Type | Notes |
|------|------|-------|
| `workflowPath` | string | `.github/workflows/publish.yml` |
| `triggers` | string[] | `push` to `main`, `workflow_dispatch` |
| `permissions` | map | Must include `id-token: write` and `contents: write` |
| `checks` | string[] | `bun install`, `bun run typecheck`, `bun run lint`, `bun run test`, `npm pack --dry-run` |
| `releaseCommand` | string | `bunx semantic-release` |
| `releaseEnv` | string[] | `GITHUB_TOKEN` only in steady state |

## Relationships

```text
PackageManifestMetadata
  ├─ references PreviewArtifact via pi.image
  ├─ includes ExamplePromptGroup via files[]
  └─ is validated by ReleaseWorkflowConfig + npm pack --dry-run

ExamplePromptGroup
  ├─ feeds README quick-start
  ├─ feeds PreviewScenario selector content
  └─ feeds ManualTestChecklist actions

PreviewScenario
  └─ produces PreviewArtifact

ManualTestChecklist
  └─ verifies ExamplePromptGroup + installed package behavior in live Pi

ReleaseBootstrapState
  └─ gates when ReleaseWorkflowConfig can publish automatically
```

## Coverage Map

| Requirement Area | Primary Entity |
|------------------|----------------|
| README preview + onboarding | `PreviewArtifact`, `ExamplePromptGroup` |
| Example prompts in package | `ExamplePromptGroup`, `ExamplePromptFile` |
| npm metadata completeness | `PackageManifestMetadata` |
| Release automation | `ReleaseWorkflowConfig`, `ReleaseBootstrapState` |
| Manual end-to-end validation | `ManualTestChecklist`, `ManualTestStep` |
