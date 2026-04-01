# Implementation Plan: Publish Readiness

**Branch**: `[003-publish-readiness]` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-publish-readiness/spec.md`

## Summary

Make `pi-prompt-composer` a real publishable Pi package while also closing a key operator-UX gap in grouped prompt execution. The implementation focuses on package polish and distribution readiness plus one essential runtime improvement: rewrite `README.md` for fast user onboarding, ship copyable example prompts, add a reproducible preview-image generator and committed preview asset, complete npm/GitHub package metadata (including gallery image support), strengthen the publish workflow so tests gate releases, document both manual end-to-end Pi validation and the one-time npm trusted-publishing bootstrap needed before fully automated releases, and update `extensions/index.ts` so missing required args are collected interactively and selector-based prompts open in an editor before dispatch.

## Technical Context

**Language/Version**: TypeScript 5.9, strict ESM; Bun scripts; GitHub Actions YAML  
**Primary Dependencies**: existing Pi extension peers (`@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`), semantic-release 25 stack already present, GitHub Actions release workflow, and a lightweight ANSI-to-SVG conversion library for the preview generator (`ansi-to-svg` selected in research)  
**Storage**: Repository-tracked markdown/docs/examples/assets, GitHub Actions workflow config, npm package metadata, and temporary local directories used by the preview generator  
**Testing**: Existing vitest suite (`bun run test`) plus package smoke checks (`npm pack --dry-run`) and documented live Pi manual validation via `pi install ./`  
**Target Platform**: Pi package consumers installing from npm or local path; maintainers running Bun locally; GitHub Actions publishing from `main`  
**Project Type**: Single-package Pi extension library  
**Performance Goals**: README quick-start should get a user to a working grouped command in under 2 minutes; preview generation should be fast enough for routine regeneration (<30s advisory, not a hard gate)  
**Constraints**: Keep flat Pi prompt templates unaffected; preserve grouped command discovery, autocomplete, and precedence; guided collection should use Pi's built-in UI primitives (`input`, `editor`) rather than a custom form system; first npm publish must be bootstrapped manually before trusted publishing can work; steady-state publish workflow should be tokenless (OIDC + `GITHUB_TOKEN` only); committed preview asset must be stable enough for both README embedding and Pi package gallery metadata  
**Scale/Scope**: Add package-facing assets and docs (`examples/`, `assets/`, `scripts/`, maintainer docs), update `package.json` and `.github/workflows/publish.yml`, and make a focused runtime change in `extensions/index.ts` for missing-arg and selector editor UX

## Constitution Check

*GATE: PASS — pre-Phase 0 and post-Phase 1 design.*

- [x] Scope is grounded in the repository's current state and does not describe roadmap items as already implemented.
- [x] The design preserves Pi-native prompt behavior unless the spec explicitly changes that contract.
- [x] Planned file paths match the real repo layout, or this plan explicitly creates any new paths it depends on.
- [x] Documentation updates are identified for every operator-facing, packaging, or workflow change.
- [x] Validation steps include `bun install`, `bun run fix`, `bun run typecheck`, `bun run lint`, and any new test command added by this feature.

**Specific grounding notes**:
- `extensions/index.ts` remains the only runtime entrypoint and is intentionally the only runtime file changed by this feature.
- The current publish workflow already uses semantic-release and `id-token: write`, but it does not yet run tests and does not document the required npm-side trusted-publisher bootstrap.
- `README.md` is currently accurate but engineer-oriented; this feature improves presentation, examples, and package metadata without changing grouped command semantics.
- New top-level paths introduced by this feature are limited to `examples/`, `assets/`, and `scripts/`, each with package/distribution or maintainer-preview purpose.

## Project Structure

### Documentation (this feature)

```text
specs/003-publish-readiness/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── publish-readiness-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code and Package Assets (repository root)

```text
extensions/
└── index.ts                     # Runtime entrypoint, plus missing-arg/editor UX

examples/
└── prompts/
    └── review/
        ├── _index.md
        ├── summary.md
        └── fix.md

assets/
└── package-preview.svg         # Generated README/gallery image

scripts/
└── generate-package-preview.ts # Maintainer preview generator

docs/
├── FEATURE-SET.md
├── IMPLEMENTATION-PLAN.md
├── ROADMAP.md
├── MANUAL-TESTING.md
└── PUBLISHING.md

.github/
└── workflows/
    └── publish.yml

README.md
package.json
bun.lock
release.config.mjs
.specify/
└── ...
```

**Structure Decision**: Keep runtime code in `extensions/index.ts` and place all publish-readiness additions in package-facing or maintainer-facing paths. `examples/` ships runnable prompt bundles for users, `assets/` stores the committed preview artifact used by README and package gallery metadata, `scripts/` contains the reproducible preview generator, and `docs/` gets dedicated maintainer checklists for manual Pi validation and npm bootstrap/release steps.

## Planned File Changes

### Modified files

| File | Change | Reason |
|------|--------|--------|
| `extensions/index.ts` | Add interactive missing-required-arg collection and editor confirmation for selector / missing-arg flows | Updated UX requirements |
| `README.md` | Rewrite for user-friendly onboarding; add hero description, preview image, quick-start, example copy instructions, and honest editor/missing-arg behavior notes | FR-001 to FR-005 |
| `package.json` | Add `homepage`, `bugs`, `engines`, `pi.image`, updated `files`, preview script entry, and any new preview-generator dependency | FR-011 to FR-016 |
| `.github/workflows/publish.yml` | Add `bun run test` before `npm pack --dry-run`; keep trusted-publishing-compatible env (`GITHUB_TOKEN` only) | FR-009, FR-010 |
| `bun.lock` | Sync lockfile for any dependency/script additions | Required by repo workflow |
| `docs/ROADMAP.md` | Update documentation/adoption status once examples, README polish, and publish readiness land | Documentation sync |
| `.specify/memory/pi-agent.md` | Record durable planning context for package polish, preview generation, and npm bootstrap workflow | Required by `/spec plan` |

### New files

| File | Purpose |
|------|---------|
| `examples/prompts/review/_index.md` | Group metadata example with `type: group` |
| `examples/prompts/review/summary.md` | Direct-dispatch example with args metadata |
| `examples/prompts/review/fix.md` | Second subcommand for selector/autocomplete/manual testing |
| `scripts/generate-package-preview.ts` | Deterministic SVG preview generator for README/package gallery |
| `assets/package-preview.svg` | Generated preview artifact committed to git |
| `docs/MANUAL-TESTING.md` | Live Pi end-to-end validation checklist |
| `docs/PUBLISHING.md` | Maintainer guide for first publish, bootstrap tag, npm trust, and release verification |
| `specs/003-publish-readiness/contracts/publish-readiness-contract.md` | Contract for package metadata, preview generation, docs, and release workflow |

## Implementation Phases

### Phase 0: Research and design closure (complete)

All planning unknowns are resolved in [research.md](./research.md):
- Release model: semantic-release + npm trusted publishing through GitHub Actions OIDC after one manual bootstrap publish/tag/trust sequence
- Preview format: single committed SVG asset reused by README and Pi package gallery metadata
- Preview architecture: Bun/TypeScript script that composes Pi TUI output programmatically and converts ANSI frames to SVG without a live Pi session
- Documentation split: onboarding in `README.md`, maintainer validation in `docs/MANUAL-TESTING.md`, bootstrap/release guidance in `docs/PUBLISHING.md`
- Example prompt packaging: ship a realistic `examples/prompts/review/` group in the published tarball

### Phase 1: Data model and interface design (this plan)

- [data-model.md](./data-model.md): artifact model for example prompts, preview asset, manual checklist, and release bootstrap state
- [contracts/publish-readiness-contract.md](./contracts/publish-readiness-contract.md): package/distribution contract
- [quickstart.md](./quickstart.md): maintainer validation and first-release walkthrough
- [.specify/memory/pi-agent.md](../../.specify/memory/pi-agent.md): durable planning context update

### Phase 2: Implementation slices (for `/spec tasks`)

1. **Runtime UX slice**
   - Update `extensions/index.ts` so bare selector choices render through an editor before dispatch.
   - Collect missing required args from prompt metadata with Pi's `ctx.ui.input(...)` and then open `ctx.ui.editor(...)` with the rendered prompt before send.
   - Preserve existing direct dispatch behavior when all required args are already present.

2. **Package metadata and workflow slice**
   - Update `package.json` with `homepage`, `bugs`, `engines`, `pi.image`, and `files` entries for `examples/` and `assets/`.
   - Add a preview-generation script entry and the selected preview dependency.
   - Update `.github/workflows/publish.yml` so `bun run test` gates the release step.

3. **Examples and onboarding docs slice**
   - Add `examples/prompts/review/` with `_index.md`, `summary.md`, and `fix.md`.
   - Rewrite `README.md` around install, copy, invoke, and current limitations.
   - Add explicit notes that grouped commands layer on top of native flat prompts.

4. **Preview generation slice**
   - Implement `scripts/generate-package-preview.ts`.
   - Generate and commit `assets/package-preview.svg`.
   - Reference the asset from `README.md` and `package.json` (`pi.image`).

5. **Maintainer workflow docs slice**
   - Add `docs/MANUAL-TESTING.md` covering local install and real Pi validation.
   - Add `docs/PUBLISHING.md` covering one-time manual publish, bootstrap tag push, npm trust setup, and controlled first automated release.
   - Update `docs/ROADMAP.md` to reflect the publish-readiness slice and any remaining deferred work.

6. **Validation slice**
   - Run `bun install`, `bun run fix`, `bun run typecheck`, `bun run lint`, `bun run test`, and `npm pack --dry-run`.
   - Execute the documented live Pi manual test checklist via `pi install ./`.
   - If the package is still unpublished, hand off the one-time manual npm publish / trust setup to the operator after the repo changes are merged.

## Validation Strategy

- **Static validation**: `bun install`, `bun run fix`, `bun run typecheck`, `bun run lint`
- **Automated regression validation**: `bun run test`
- **Package validation**: `npm pack --dry-run` must show `extensions/`, `README.md`, `LICENSE`, `examples/`, and `assets/` in the tarball
- **Preview validation**: Regenerate `assets/package-preview.svg` and visually confirm it matches the example grouped-command selector state used in the README
- **Operator validation**: Follow `docs/MANUAL-TESTING.md` in a real Pi session using `pi install ./`
- **Release readiness validation**: Confirm `docs/PUBLISHING.md` covers manual bootstrap publish, matching git tag push, `npm trust github ...`, and the expected post-bootstrap CI release flow
- **Post-bootstrap release check**: After npm trust is configured, verify `.github/workflows/publish.yml` uses `id-token: write`, sets no `NPM_TOKEN`/`NODE_AUTH_TOKEN`, and runs `semantic-release` with only `GITHUB_TOKEN`

## Complexity Tracking

No constitution violations require justification.
