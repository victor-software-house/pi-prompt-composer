# Quickstart: Publish Readiness

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)  
**Date**: 2026-04-01

## Purpose

This quickstart describes how to validate the publish-readiness slice once it is implemented. It covers local package verification, example prompt usage, preview regeneration, and the first-release bootstrap needed before automated npm publishing can take over.

## Prerequisites

- Bun installed
- Pi installed locally
- Repository checked out on `003-publish-readiness` (or a later merged branch)
- Dependencies installed with `bun install`

## 1. Run the repository verification workflow

```bash
bun install
bun run fix
bun run typecheck
bun run lint
bun run test
npm pack --dry-run
```

Expected results:
- lint, typecheck, and all tests pass
- `npm pack --dry-run` shows `extensions/`, `examples/`, `assets/`, `README.md`, and `LICENSE`

## 2. Regenerate the package preview asset

```bash
bun run preview:package
```

Expected results:
- `assets/package-preview.svg` is created or refreshed
- the SVG shows the grouped-command selector for the example `review` prompt group
- the README image reference still points to the same committed asset

## 3. Verify the example prompt bundle locally

Copy the shipped example prompts into your user prompt root:

```bash
mkdir -p ~/.pi/agent/prompts
cp -R examples/prompts/review ~/.pi/agent/prompts/
```

Expected results:
- `~/.pi/agent/prompts/review/_index.md` exists
- `summary.md` and `fix.md` exist under that group

## 4. Install the package locally in Pi

From the repo root:

```bash
pi install ./
```

Expected results:
- Pi accepts the local package path
- the package is listed by `pi list`
- the extension loads when Pi starts

## 5. Run live Pi manual validation

Open Pi in any project directory and verify these flows:

1. Type `/review` and press Enter.
   - Expected: a selector opens with the example subcommands.
2. Type `/review summary "my change"`.
   - Expected: a visible user message is sent containing the rendered prompt with `my change` substituted.
3. Type `/review` then use tab-completion after a space.
   - Expected: available subcommands appear.
4. Type `/review nonexistent`.
   - Expected: a warning shows the available subcommands.

Record the full checklist results in `docs/MANUAL-TESTING.md`.

## 6. Confirm README and package metadata

Check these outputs:
- GitHub README renders the preview image inline.
- npm-facing metadata in `package.json` includes `homepage`, `bugs`, `engines`, and `pi.image`.
- The README quick-start references the shipped example paths exactly.

## 7. Bootstrap the first npm release (one time only)

If `pi-prompt-composer` has never been published, the operator must do the initial publish manually.

### 7.1 Publish manually

```bash
script -q /dev/null bash -lc 'npm publish --access public'
```

If the environment cannot complete browser/passkey auth, the operator should run this step locally outside the agent.

### 7.2 Push the matching tag

After the manual publish succeeds, create and push the corresponding tag:

```bash
git tag v0.1.0 <commit-sha>
git push origin v0.1.0
```

Use the actual published version and source commit.

### 7.3 Configure npm trusted publishing

```bash
script -q /dev/null bash -lc 'npm trust github pi-prompt-composer --repository victor-software-house/pi-prompt-composer --file publish.yml --yes'
```

Expected result:
- `npm trust list pi-prompt-composer` shows the GitHub Actions trust relationship for `.github/workflows/publish.yml`

## 8. Validate steady-state automated release behavior

After bootstrap and trust configuration:

1. Merge a releasable Conventional Commit (`feat:` or `fix:`) to `main`
2. Wait for `.github/workflows/publish.yml` to complete
3. Confirm:
   - `bun run test` ran before release
   - semantic-release created the new tag and GitHub release
   - the new package version appears on npm
   - `package.json` in git reflects the released version

## Troubleshooting

### `npm pack --dry-run` is missing examples or assets

Check `package.json.files` and ensure `examples/` and `assets/` are included.

### GitHub Action fails with trusted-publishing or OIDC errors

Check:
- the package already exists on npm
- the bootstrap tag was pushed to remote
- `npm trust github ...` points to `victor-software-house/pi-prompt-composer` and `publish.yml`
- the workflow still uses `id-token: write`
- the release step sets only `GITHUB_TOKEN`

### Local Pi install works but README image is broken on npm

Check:
- the committed asset path matches the README reference
- `pi.image` points to a stable raw GitHub URL for the same file
- the asset is included in git and visible on the default branch
