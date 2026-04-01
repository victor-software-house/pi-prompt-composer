# pi-prompt-composer Development Guidelines

Last updated: 2026-04-01

## Active Technologies

- TypeScript 5.9 with strict compiler settings
- Bun for package management and repo commands
- Pi extension APIs from `@mariozechner/pi-coding-agent` and `@mariozechner/pi-tui`
- Biome 2.x and oxlint for formatting and linting
- Lefthook for commit and push validation
- semantic-release for releases from `main`

## Project Structure

```text
extensions/
└── index.ts

.specify/
├── memory/
│   ├── constitution.md
│   └── pi-agent.md
└── templates/

docs/
├── FEATURE-SET.md
├── IMPLEMENTATION-PLAN.md
└── ROADMAP.md

README.md
AGENTS.md
package.json
```

## Commands

```bash
bun install
bun run fix
bun run typecheck
bun run lint
```

## Code Style

- Keep TypeScript strict; do not weaken types to pass checks.
- Use single quotes for imports.
- Use `import type` for type-only imports.
- Do not include `.ts` or `.js` file extensions in import paths.
- Reuse Pi utilities for prompt parsing and substitution when they are
  publicly available.
- When required Pi behavior exists only in non-exported internals, faithfully
  reimplement it with source-provenance comments that identify the upstream Pi
  package version and internal module path.
- Treat flat `.md` prompt templates as Pi-native behavior and only layer
  directory-based routing on top.

## Grouped Prompt Routing Notes

- The first implementation slice stays in `extensions/index.ts`; no new runtime
  source directories are planned for this feature.
- Grouped prompt discovery is planned around two prompt roots:
  `~/.pi/agent/prompts` and `<cwd>/.pi/prompts`.
- Grouped routing scans only first-level directories; `_index.md` with
  `type: group` frontmatter is the hard gate for group recognition; other
  direct `.md` files become runnable subcommands.
- `description` on `_index.md` and nested prompts is recommended (warn + fallback
  to directory/file name). `args` array on nested prompts is optional (silent if
  absent, warn if malformed). `name` override on nested prompts is optional.
  Nested prompts are never skipped for metadata issues.
- Duplicate group names across scopes emit a warning but no package-owned
  precedence is enforced. Pi's command registration order determines which wins.
- Grouped commands intentionally remain extension commands, which lets them take
  precedence over conflicting flat prompt-template names.
- Planned command handlers use `parseFrontmatter` and `getAgentDir` from Pi's
  public API. `parseCommandArgs` and `substituteArgs` are reimplemented locally
  as near-verbatim copies of Pi's internal `core/prompt-templates.ts`
  (`@mariozechner/pi-coding-agent@0.64.0`), with source-reference comments.
  Prompt roots are derived from `getAgentDir() + '/prompts'` and
  `process.cwd() + '/.pi/prompts'` since `getPromptsDir()` and
  `CONFIG_DIR_NAME` are not publicly exported.
- These local helpers are candidates for future extraction to a shared
  `pi-provider-utils` npm package.
- Command dispatch uses `pi.sendUserMessage()` plus `ctx.ui.select()` for bare grouped commands, `ctx.ui.input()` for missing required args, and `ctx.ui.editor()` for selector-based or missing-arg confirmation before dispatch.

## Testing Infrastructure

- Test framework: vitest (via `bun run test` = `vitest --run`,
  `bun run test:watch` = `vitest`)
- Integration testing: Layer 3 uses direct mock-API approach (harness mock UI
  does not reach extension command handler ctx parameters)
- Three test layers:
  1. **Layer 1 — helpers**: pure function unit tests (`test/helpers.test.ts`)
  2. **Layer 2 — discovery**: filesystem-based tests with temp dirs
     (`test/discovery.test.ts`)
  3. **Layer 3 — extension-flow**: full Pi session via harness
     (`test/extension-flow.test.ts`)
- Test config: `vitest.config.ts` + `tsconfig.test.json` (extends base,
  adds `test/` to include)
- Dev deps for harness peer resolution: `@mariozechner/pi-ai`,
  `@mariozechner/pi-agent-core`, `@marcfargas/pi-test-harness`
- `extensions/index.ts` exports named functions and types for test access
  alongside the default extension export
- Production `tsconfig.json` unchanged — only includes `extensions/**/*.ts`
- oxlint type-aware checks exclude `test/` (uses separate tsconfig)
- lefthook pre-push runs `bun run test` (not pre-commit)
- Full verification workflow: `bun install`, `bun run fix`,
  `bun run typecheck`, `bun run lint`, `bun run test`

## Recent Changes

- Native `/spec` scaffolding was initialized under `.specify/`.
- The repository constitution was adopted in `.specify/memory/constitution.md`.
- `AGENTS.md` was tightened to reflect scaffold-first reality, validation
  commands, and commit discipline.
- `/spec plan` for `001-implement-core-grouped` added research, data model,
  quickstart, and grouped-command contract artifacts for the first useful slice.
- `/spec plan` for `002-layered-extension-testing` designed a three-layer test
  suite covering helpers, discovery, and extension-flow behavior. Research
  resolved all unknowns (vitest, pi-test-harness, named-export testability
  strategy, fixture design).
- `/spec implement` for `002-layered-extension-testing` completed all 38 tasks:
  65 tests across 3 layers, named exports, docs/hook/workflow updates.
- `/spec plan` for `003-publish-readiness` designed a package-polish slice
  with one focused runtime UX improvement in `extensions/index.ts`: missing
  required args are collected with `ctx.ui.input()` and selector-based or
  missing-arg prompts open in `ctx.ui.editor()` before dispatch. The same plan
  adds planned `examples/`, `assets/`, and `scripts/` paths for shipped prompt
  examples and a reproducible package preview. Research chose semantic-release
  + npm trusted publishing after a one-time manual bootstrap
  publish/tag/trust sequence, plus a single committed SVG preview asset reused
  by both `README.md` and `package.json` `pi.image` gallery metadata.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
