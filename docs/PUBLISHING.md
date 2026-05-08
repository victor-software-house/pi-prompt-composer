# Publishing

`pi-prompt-composer` uses semantic-release with npm OIDC trusted publishing.

Steady-state releases are fully automated: push to `main` → CI evaluates commits → publishes if releasable.

## One-time bootstrap (first publish only)

Trusted publishing requires the package to already exist on npm. Bootstrap sequence:

### 1. Publish manually

From the repo root, authenticated to npm:

```bash
npm publish --access public
```

### 2. Create and push the bootstrap tag

```bash
git tag v0.1.0 HEAD
git push origin v0.1.0
```

### 3. Configure trusted publishing

```bash
npm trust github pi-prompt-composer --repository victor-software-house/pi-prompt-composer --file publish.yml --yes
```

### 4. Verify

```bash
npm trust list pi-prompt-composer
```

Expected output: a trust entry pointing to `victor-software-house/pi-prompt-composer` and `.github/workflows/publish.yml`.

## Steady-state releases

After bootstrap, every push to `main` with releasable commits triggers:

1. CI runs typecheck, lint, test, commitlint, and `npm pack --dry-run`
2. `semantic-release` evaluates unreleased commits since the last tag
3. If releasable: bumps version, publishes to npm, creates GitHub release, commits `package.json` + `pnpm-lock.yaml` + `CHANGELOG.md` back to `main`

Non-releasable commits (`docs:`, `chore:`, `test:`, `refactor:`) produce no release.

## Commit message discipline

| Prefix | Bump | Use for |
|--------|------|---------|
| `fix:` | patch | Bug fixes |
| `feat:` | minor | New features |
| `feat!:` / `BREAKING CHANGE:` | **major** | Changes that break npm consumers' imports or runtime |
| `chore:`, `docs:`, `test:`, `refactor:` | none | Internal changes |

**Never** use `!` or `BREAKING CHANGE:` for internal refactors. npm versions are permanent.

## Troubleshooting

### `EINVALIDNPMTOKEN`

Check:
- `@semantic-release/npm` is `>=13.0.0` (not 12)
- No `NPM_TOKEN` or `NODE_AUTH_TOKEN` in workflow
- `id-token: write` permission on the release job

### Version mismatch

```bash
git tag --list
node -p "require('./package.json').version"
```

Tags must exist on the remote (`git push origin --tags`).

### Package contents wrong

```bash
npm pack --dry-run
```

Check `files` in `package.json`.
