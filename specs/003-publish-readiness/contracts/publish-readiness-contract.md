# Publish Readiness Contract

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)  
**Date**: 2026-04-01

## Purpose

This contract defines what must be true for `pi-prompt-composer` to count as a properly publishable Pi package. It covers the package manifest, bundled examples, grouped prompt editor UX, preview-generation interface, maintainer documentation, and release workflow.

## 1. Package Manifest Contract

### Required metadata

`package.json` MUST provide all of the following:

| Field | Required Value / Shape |
|------|-------------------------|
| `name` | `pi-prompt-composer` |
| `description` | Short user-facing package description |
| `license` | `MIT` |
| `repository.url` | `git+https://github.com/victor-software-house/pi-prompt-composer.git` |
| `homepage` | GitHub repo URL |
| `bugs.url` | GitHub issues URL |
| `engines.node` | Minimum supported Node version |
| `keywords` | Must include `pi-package` |
| `pi.extensions` | `./extensions` |
| `pi.image` | Stable URL pointing to the committed preview asset |
| `publishConfig.access` | `public` |
| `publishConfig.provenance` | `true` |

### Published tarball contents

`package.json.files` MUST include at least:

- `extensions`
- `examples`
- `assets`
- `README.md`
- `LICENSE`

`npm pack --dry-run` is the source of truth for this contract.

## 2. Example Bundle Contract

The package MUST ship a runnable grouped prompt example at:

```text
examples/prompts/review/
├── _index.md
├── summary.md
└── fix.md
```

### Example requirements

- `_index.md` MUST contain `type: group`
- At least one nested prompt MUST define `args` metadata
- Each nested prompt MUST have a user-facing `description`
- The example MUST be self-contained and understandable without project-specific context
- The README quick-start MUST reference the shipped paths exactly

## 3. Preview Generator Contract

### Script command

`package.json` MUST expose a preview generator command:

```bash
bun run preview:package
```

### Script behavior

When run from the repo root, the command MUST:

1. Render a deterministic grouped-command selector preview based on the shipped example prompt group
2. Produce `assets/package-preview.svg` by default
3. Exit with code `0` on success and non-zero on failure
4. Fail clearly if the required example prompt inputs are missing

### Preview output contract

The generated asset MUST:

- render correctly on GitHub when referenced from `README.md`
- be suitable for the Pi package gallery via `pi.image`
- show a Pi-style terminal frame with grouped prompt selector content

## 4. README Contract

`README.md` MUST provide, in this order near the top:

1. A concise one-line description
2. The preview image embedded inline
3. An install command
4. A quick-start path from install to first working grouped command

The README MUST also:
- explain that grouped commands layer on top of native flat prompt templates
- document current limitations honestly (editor-based missing-arg handling is present; shell substitution is not)
- show the example directory layout with `_index.md` and nested prompts
- explain that selector-based invocation opens the rendered prompt in Pi's editor before dispatch

## 5. Maintainer Documentation Contract

Two maintainer-facing docs MUST exist:

### `docs/MANUAL-TESTING.md`

Must include a checklist for:
- local package install via `pi install ./`
- bare `/review` selector flow
- editor confirmation after selection
- direct `/review summary ...` dispatch
- missing-required-arg collection before send
- tab completion
- unknown subcommand feedback
- pass/fail recording before first publish

### `docs/PUBLISHING.md`

Must include:
- one-time manual bootstrap publish
- matching git tag push
- `npm trust github ...` setup for `.github/workflows/publish.yml`
- verification steps for the first automated release
- explicit note that steady-state workflow should not rely on `NPM_TOKEN`

## 6. Release Workflow Contract

`.github/workflows/publish.yml` MUST:

- trigger on push to `main`
- support `workflow_dispatch`
- use `actions/checkout@v5` with full history and tags
- grant `id-token: write` on the release job
- install dependencies from the lockfile
- run, in order:
  1. `bun run typecheck`
  2. `bun run lint`
  3. `bun run test`
  4. `npm pack --dry-run`
  5. `bunx semantic-release`
- set only `GITHUB_TOKEN` in the release step environment after trusted publishing is configured

## 7. Non-Contract Items

This feature does **not** require:

- shell substitution or preprocessing
- animated preview media
- a live Pi session to generate the preview asset
- a custom multi-field form UI beyond Pi's built-in input/editor primitives
