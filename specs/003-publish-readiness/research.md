# Research: Publish Readiness

**Feature**: [spec.md](./spec.md)  
**Date**: 2026-04-01

## R-001: Release automation model

**Decision**: Keep the existing `semantic-release` model and finish it with npm trusted publishing through GitHub Actions OIDC.

**Rationale**:
- The repo already has the correct release stack shape: `semantic-release@25`, `@semantic-release/npm@13`, `@semantic-release/github@12`, `@semantic-release/git@10`, `release.config.mjs`, and a GitHub Actions workflow with `id-token: write`.
- The `npm-trusted-publishing` skill recommends this exact model as the preferred default for new single-package Pi repos.
- Trusted publishing removes the need for a long-lived npm token and matches the existing `publishConfig.provenance: true` manifest setting.
- The only missing repo-side release gate is `bun run test` before the release step.

**Alternatives considered**:
- **Classic `NPM_TOKEN` / `NODE_AUTH_TOKEN`** — works, but leaves long-lived credentials in GitHub and is explicitly not the preferred model for new Pi packages.
- **Release PR tooling (`changesets`, `release-please`)** — rejected because this is a single-package repo already aligned around direct releases from `main` with Conventional Commits.

## R-002: First-publish bootstrap for trusted publishing

**Decision**: Treat the first release as a two-stage process: one manual publish by the operator, then a matching git tag push, then `npm trust github ...`, then steady-state automated OIDC releases.

**Rationale**:
- npm trusted publishing cannot be configured for a package that does not yet exist on npm.
- The skill reference explicitly requires: (1) manual publish, (2) push matching bootstrap tag, (3) configure npm trust against `.github/workflows/publish.yml`.
- This means repo changes alone cannot complete first-release readiness; maintainers need documented external steps in `docs/PUBLISHING.md`.

**Alternatives considered**:
- **Attempt OIDC publish before package exists** — rejected because npm trust is unavailable until the package is already published.
- **Keep using a token permanently** — rejected because it solves bootstrap convenience but loses the longer-term security and maintenance benefits of OIDC trusted publishing.

## R-003: Preview asset delivery format

**Decision**: Generate and commit a single SVG preview asset (`assets/package-preview.svg`) and reuse it in both `README.md` and the Pi package manifest via `pi.image`.

**Rationale**:
- Pi package docs explicitly support `pi.image` gallery metadata in `package.json`.
- A committed asset makes the README and package gallery stable and reproducible.
- SVG is crisp, lightweight, and easier to regenerate deterministically from terminal output than a hand-cropped raster screenshot.
- A single source asset avoids drift between README marketing media and gallery media.

**Alternatives considered**:
- **PNG screenshot only** — acceptable, but less portable and more awkward to regenerate deterministically.
- **Video (`pi.video`)** — out of scope for the first publish-ready slice and more work than needed.
- **No committed asset, only README prose** — rejected because the user explicitly wants a screenshot/preview and the package gallery benefits from the same artifact.

## R-004: Preview generator architecture

**Decision**: Add a Bun/TypeScript maintainer script at `scripts/generate-package-preview.ts` that renders a deterministic Pi-style terminal frame and converts it to SVG using `ansi-to-svg`.

**Rationale**:
- The nearby reference repos establish two viable precedents:
  - `pi-curated-themes/scripts/list-themes-tui.ts` shows how to use `ProcessTerminal`, `TUI`, and Pi components to render actual Pi-style terminal output.
  - `pi-tui-renderer/scripts/render-preview-capture.ts` shows how to build deterministic, non-interactive preview capture in a standalone script without a live Pi session.
- `ansi-to-svg` is a small maintained package designed specifically to convert ANSI terminal output to SVG.
- This keeps the preview generator reproducible, scriptable, and decoupled from a live Pi session or external screenshot tooling.

**Alternatives considered**:
- **Manual screenshot captured by a maintainer** — rejected because it is not reproducible and will drift from the code.
- **Live Pi session automation + screenshot** — rejected because it adds more moving parts and brittleness than needed for a static README asset.
- **Hand-authored mock screenshot** — rejected because it would not guarantee Pi-native visual fidelity.

## R-005: Example prompt packaging strategy

**Decision**: Ship a realistic `examples/prompts/review/` directory in the published package and make it the canonical README walkthrough.

**Rationale**:
- The current README already uses `review/` in examples, so this keeps documentation and shipped examples aligned.
- A user should be able to copy the example tree directly into `~/.pi/agent/prompts/` or a project `.pi/prompts/` directory.
- Including examples in the tarball makes the npm package self-contained; users do not need to clone the GitHub repo just to get a starter prompt group.

**Alternatives considered**:
- **README snippets only** — rejected because copy-paste snippets are slower to verify and easier to get wrong than a bundled example tree.
- **Project-specific examples** — rejected because the examples need to be self-contained and broadly understandable.

## R-006: Maintainer documentation split

**Decision**: Keep onboarding in `README.md`, put live Pi validation in `docs/MANUAL-TESTING.md`, and put npm bootstrap/release flow in `docs/PUBLISHING.md`.

**Rationale**:
- Root `README.md` should remain the fast user entry point.
- Manual Pi verification is maintainer-facing operational guidance, not the first thing a package consumer needs.
- npm bootstrap/trust setup is a distinct maintainer workflow with external steps that would clutter the README.
- This follows the repo’s documentation model: README for humans, `docs/` for canonical maintainer documents.

**Alternatives considered**:
- **Put all details in README** — rejected because it would make the main package page too dense.
- **Store the checklist only under `specs/003...`** — rejected because the requirement is for a repo-level documented checklist, not a planning-only artifact.

## R-007: CI release gate scope

**Decision**: Add `bun run test` to the publish workflow before `npm pack --dry-run` and keep the release step environment to `GITHUB_TOKEN` only.

**Rationale**:
- The repo already has 65 passing tests, but the publish workflow does not run them today.
- The trusted-publishing references require package verification before publish and recommend `GITHUB_TOKEN` only for steady-state OIDC releases.
- Running tests in the publish workflow closes the last meaningful validation gap for automated release readiness.

**Alternatives considered**:
- **Keep tests out of the release workflow** — rejected because an automated release should not bypass the repo’s existing regression suite.
- **Add CI commitlint in this feature** — useful, but not required by the feature spec; defer unless explicitly requested.
