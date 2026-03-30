# pi-prompt-composer

Pi extension package for folder-nested prompt routing.

## Orient quickly

Read these in order:

1. `README.md` — human-facing package purpose, install shape, and current status
2. `docs/FEATURE-SET.md` — product-level scope, priorities, and non-goals
3. `docs/ROADMAP.md` — ordered work items and acceptance criteria
4. `extensions/index.ts` — current extension entrypoint and implementation truth
5. `package.json`, `biome.json`, `tsconfig.json`, `lefthook.yml`, `release.config.mjs` — commands, lint/type rules, hooks, and release flow

## Current repo state

- This repo is still scaffold-first. Do not describe roadmap items as implemented unless they exist in `extensions/index.ts` or other committed source files.
- `extensions/index.ts` is the only code entrypoint today.
- `src/` and example prompt directories are planned, not current. Create guidance for them only after those paths exist.

## Implementation constraints

- Reuse Pi utilities such as `parseCommandArgs`, `substituteArgs`, and `parseFrontmatter` instead of reimplementing parser behavior.
- Extension-registered commands must take precedence over native flat prompt templates with the same name.
- Expanded prompt content must be sent as Pi user-message content, not through a custom render path.
- Bare `/command` should open an interactive menu of nested prompts.
- Prompts with missing required arguments should pause and collect operator input before expansion.
- Flat `.md` prompt templates remain Pi-native behavior. This package should only add directory-based routing on top.
- Preserve user vs project prompt scope when surfacing command metadata.

## Working rules

- Keep `README.md` for human onboarding and usage. Keep `AGENTS.md` focused on agent-operational guidance.
- Update `README.md` when operator-facing install, usage, or prompt-directory behavior changes.
- Update `docs/FEATURE-SET.md` when product priorities, scope, or non-goals change.
- Update `docs/ROADMAP.md` when acceptance criteria, execution order, or status meaningfully changes.
- Do not invent workflow rules that are not backed by repo files, scripts, or committed docs.
- Keep canonical docs under `docs/` unless they are `README.md` or `AGENTS.md`.

## Verification

Run these from the repo root:

```bash
bun install
bun run fix
bun run typecheck
bun run lint
```

Verification notes:

- Run `bun run fix` before manual lint cleanup. `oxlint` and `biome` already auto-fix part of the surface area.
- There is no test suite yet. If you add tests, add the command to `package.json`, then document it in both `README.md` and this file.
- When touching packaging or release files, verify `package.json`, `bun.lock`, `CHANGELOG.md`, and `release.config.mjs` stay aligned.

## Style and typing

- TypeScript is strict. Fix type errors directly; do not weaken types to get green checks.
- Use single quotes for imports.
- Do not include `.ts` or `.js` file extensions in import paths.
- Use `import type` for type-only imports.

## Git and release workflow

- Commit in small, reviewable slices during substantial work. Do not batch unrelated changes into one late commit.
- When a task produces a stable checkpoint, commit it before starting the next distinct change.
- Conventional commits are enforced by `commitlint` (`commitlint.config.mjs`).
- `lefthook` pre-commit runs `oxlint --fix`, `biome check --write`, `bun run lint`, and `bun run typecheck`.
- `lefthook` pre-push runs `bun install` and fails if it changes `bun.lock`; commit the updated lockfile before pushing.
- Releases are handled by `semantic-release` from `main` and update `package.json`, `bun.lock`, and `CHANGELOG.md`.
