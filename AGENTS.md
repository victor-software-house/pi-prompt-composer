# pi-prompt-composer

Pi extension package for grouped slash-command routing from prompt directories.

## Orient quickly

Read these files in order before changing behavior:

1. [`README.md`](README.md) — package purpose, install shape, current status
2. [`docs/FEATURE-SET.md`](docs/FEATURE-SET.md) — product scope, priorities, non-goals
3. [`docs/ROADMAP.md`](docs/ROADMAP.md) — ordered work items and acceptance criteria
4. [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md) — design constraints and intended architecture
5. [`extensions/index.ts`](extensions/index.ts) — current implementation truth
6. [`package.json`](package.json), [`mise.toml`](mise.toml), [`mise-tasks/`](mise-tasks/), [`biome.json`](biome.json), [`tsconfig.json`](tsconfig.json), [`lefthook.yml`](lefthook.yml), [`release.config.mjs`](release.config.mjs) — commands, task entrypoints, lint/type rules, hooks, and release flow

If a task is mostly documentation, also read [`docs/AGENTS.md`](docs/AGENTS.md).

## Current repo reality

- This repo is still scaffold-first. Do not describe roadmap items as implemented unless they exist in committed source.
- `extensions/index.ts` is the only runtime entrypoint today.
- `specs/` and `.specify/` contain planning and workflow artifacts, not shipped behavior.
- Planned paths such as `src/` or example prompt trees are not implementation truth until they exist.

## Implementation rules

### Prompt template escaping

Pi substitutes `$1`, `$2`, `$@`, `$ARGUMENTS`, and `${@:N}` everywhere in prompt template bodies — including inside code blocks, JSON examples, and instructional text. When a prompt template needs to mention substitution syntax literally (e.g., teaching the model to use `$1` in generated prompts), escape with `\$`: write `\$1` in the source so the rendered output contains literal `$1`. This is test-covered in `test/bundled-compose.test.ts`.

### YAML frontmatter safety

Always quote `description` and `hint` values in prompt frontmatter when they contain colons, brackets, or other special YAML characters. Unquoted colons cause YAML parse errors that silently skip the prompt.

```yaml
# Bad — YAML parser sees a nested mapping at the colon
hint: Session name, ID prefix, or "all" (default: all)

# Good — quoted value is safe
hint: "Session name, ID prefix, or 'all' (default: all)"
```

The extension handles malformed frontmatter gracefully (warns and skips), but the prompt still won't load. The examples in [`examples/prompts/`](examples/prompts/) demonstrate correct quoting — models replicate what they see in examples, so keep them clean.

### General

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
mise run hooks:typecheck
mise run hooks:lint
mise run hooks:test
mise run skills:validate
```

These `mise` tasks are the canonical local workflow entrypoints. `lefthook` should call `mise` tasks rather than duplicating command bodies.

Useful helper before manual cleanup:

```bash
pnpm run fix
```

Additional checks:

- Run `pnpm install` when dependencies, hooks, or release tooling change.
- Validate skills with Pi's own parser via `mise run skills:validate` (this uses Pi's `loadSkillsFromDir()` directly and must stay warning-free).
- The test suite uses vitest with four layers: helpers (`test/helpers.test.ts`), discovery (`test/discovery.test.ts`), extension-flow (`test/extension-flow.test.ts`), and bundled-compose end-to-end (`test/bundled-compose.test.ts`). Run `mise run hooks:test` to execute all layers, or `pnpm run test:watch` during development.
- When touching packaging or release flow, verify `package.json`, `pnpm-lock.yaml`, `CHANGELOG.md`, and `release.config.mjs` stay aligned.

## Style and typing

- TypeScript is strict. Fix type errors; do not weaken config to get green checks.
- Use single quotes for imports.
- Omit `.ts` and `.js` extensions in import paths.
- Use `import type` for type-only imports.

## Git workflow

- Use frequent small commits for logical, reviewable slices.
- Use Conventional Commits; `commitlint.config.mjs` enforces them.
- Keep `lefthook` protections working unless the user explicitly asks to change them.
- Define hook command bodies in `mise-tasks/`; `lefthook.yml` should stay a thin caller of `mise run ...` entrypoints.
- Pre-commit currently runs `mise` tasks for `hooks:oxlint-fix`, `hooks:format`, `hooks:lint`, `hooks:typecheck`, and `skills:validate`.
- Pre-push currently runs `mise` tasks for `repo:lockfile-sync`, `hooks:typecheck`, `hooks:lint`, and `hooks:test`.
- If you add a new repo workflow check, prefer adding a `mise` task first, then wiring `lefthook` to that task instead of embedding shell directly in `lefthook.yml`.
- This repo uses feature branches plus pull requests. Prefer doing substantive work on a feature branch, not directly on `main`.
- It is safe to push the current branch after committing validated work, unless the user says not to.
- `semantic-release` publishes from `main`; avoid ad hoc release-file edits unless the task specifically requires them.

## Versioning

This package has no `exports` field and no compiled output. Consumers cannot import its TypeScript types — Pi loads the extension at runtime via the `pi.extensions` entry in `package.json`. The public API is **runtime behavior only**: which commands are registered, how autocomplete works, how args are collected, and what gets dispatched.

`BREAKING CHANGE:` applies only when that runtime behavior changes incompatibly for existing users — e.g. removing a bundled command, changing a required arg's position, altering dispatch output so existing prompts break. Internal type renames, helper refactors, and interface changes that only touch this repo's own source are never breaking.

Lesson from v1.0.0: the `PromptScope → PromptOrigin` rename was internal-only and should have been a plain `feat:` (→ 0.2.0). The `BREAKING CHANGE:` footer in the PR squash body burned a major version permanently and needlessly.

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