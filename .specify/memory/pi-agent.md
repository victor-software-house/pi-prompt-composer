# pi-prompt-composer Development Guidelines

Last updated: 2026-03-30

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
- Reuse Pi utilities for prompt parsing and substitution when available.
- Treat flat `.md` prompt templates as Pi-native behavior and only layer
  directory-based routing on top.

## Grouped Prompt Routing Notes

- The first implementation slice stays in `extensions/index.ts`; no new runtime
  source directories are planned for this feature.
- Grouped prompt discovery is planned around two prompt roots:
  `~/.pi/agent/prompts` and `<cwd>/.pi/prompts`.
- Grouped routing scans only first-level directories; `_index.md` is metadata or
  help content, while other direct `.md` files become runnable subcommands.
- Duplicate group names resolve project scope over user scope.
- Grouped commands intentionally remain extension commands, which lets them take
  precedence over conflicting flat prompt-template names.
- Planned command handlers should rely on Pi public helpers and APIs:
  `parseFrontmatter`, `parseCommandArgs`, `substituteArgs`, `ctx.ui.select`,
  and `pi.sendUserMessage`.

## Recent Changes

- Native `/spec` scaffolding was initialized under `.specify/`.
- The repository constitution was adopted in `.specify/memory/constitution.md`.
- `AGENTS.md` was tightened to reflect scaffold-first reality, validation
  commands, and commit discipline.
- `/spec plan` for `001-implement-core-grouped` added research, data model,
  quickstart, and grouped-command contract artifacts for the first useful slice.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
