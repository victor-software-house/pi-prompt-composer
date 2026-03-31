# pi-prompt-composer

Pi extension package for grouped slash-command routing from prompt directories.

## Orient quickly

Read these files in order before changing behavior:

1. [`README.md`](README.md) — package purpose, install shape, current status
2. [`docs/FEATURE-SET.md`](docs/FEATURE-SET.md) — product scope, priorities, non-goals
3. [`docs/ROADMAP.md`](docs/ROADMAP.md) — ordered work items and acceptance criteria
4. [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md) — design constraints and intended architecture
5. [`extensions/index.ts`](extensions/index.ts) — current implementation truth
6. [`package.json`](package.json), [`biome.json`](biome.json), [`tsconfig.json`](tsconfig.json), [`lefthook.yml`](lefthook.yml), [`release.config.mjs`](release.config.mjs) — commands, lint/type rules, hooks, and release flow

If a task is mostly documentation, also read [`docs/AGENTS.md`](docs/AGENTS.md).

## Current repo reality

- This repo is still scaffold-first. Do not describe roadmap items as implemented unless they exist in committed source.
- `extensions/index.ts` is the only runtime entrypoint today.
- `specs/` and `.specify/` contain planning and workflow artifacts, not shipped behavior.
- Planned paths such as `src/` or example prompt trees are not implementation truth until they exist.

## Implementation rules

- Reuse Pi helpers such as `parseCommandArgs`, `substituteArgs`, and `parseFrontmatter` when public exports exist.
- If Pi prompt helpers are not publicly exported, copy the smallest necessary logic locally and document that choice. Do not import hidden Pi internals.
- Grouped commands must be extension commands layered on top of Pi's flat prompt-template system.
- Extension-registered commands take precedence over flat prompt templates with the same name.
- Bare `/command` must open an interactive menu for nested prompts.
- Missing required arguments must pause and collect operator input before rendering.
- Expanded prompt content must be dispatched as visible Pi user-message content.
- Preserve user vs project prompt scope in package-owned metadata, diagnostics, and UI where possible.

## Verification

Run verification from the repo root.

Required gate before committing:

```bash
bun run typecheck
bun run lint
```

Useful helper before manual cleanup:

```bash
bun run fix
```

Additional checks:

- Run `bun install` when dependencies, hooks, or release tooling change.
- There is no test suite yet. Do not claim tests passed unless you added and ran a real test command.
- When touching packaging or release flow, verify `package.json`, `bun.lock`, `CHANGELOG.md`, and `release.config.mjs` stay aligned.

## Style and typing

- TypeScript is strict. Fix type errors; do not weaken config to get green checks.
- Use single quotes for imports.
- Omit `.ts` and `.js` extensions in import paths.
- Use `import type` for type-only imports.

## Git workflow

- Use frequent small commits for logical, reviewable slices.
- Use Conventional Commits; `commitlint.config.mjs` enforces them.
- Keep `lefthook` protections working unless the user explicitly asks to change them.
- Pre-commit currently runs `oxlint --fix`, `biome check --write`, `bun run lint`, and `bun run typecheck`.
- Pre-push currently runs `bun install`, `bun run typecheck`, and `bun run lint`, and it blocks pushes if `bun.lock` changed.
- This repo uses feature branches plus pull requests. Prefer doing substantive work on a feature branch, not directly on `main`.
- It is safe to push the current branch after committing validated work, unless the user says not to.
- `semantic-release` publishes from `main`; avoid ad hoc release-file edits unless the task specifically requires them.

## Docs synchronization

- Keep human onboarding and install/usage guidance in [`README.md`](README.md).
- Keep agent-operational guidance in `AGENTS.md` files.
- Keep canonical project docs under `docs/`; follow [`docs/AGENTS.md`](docs/AGENTS.md) when editing that subtree.
- Update [`docs/FEATURE-SET.md`](docs/FEATURE-SET.md) when product scope, priorities, or non-goals change.
- Update [`docs/ROADMAP.md`](docs/ROADMAP.md) when execution order or acceptance criteria change.
- Update [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md) when architecture decisions or implementation slices change.
- Update spec artifacts under `specs/` when the spec workflow itself changes; do not treat them as proof that code already exists.

## Stop conditions

Stop and ask before:

- changing public package shape or release flow
- weakening lint/type gates
- introducing a new template language instead of extending Pi-native behavior
- making a large docs reorganization beyond the existing root + `docs/` split

When docs, roadmap, and source disagree, trust committed source first and then update the stale docs.