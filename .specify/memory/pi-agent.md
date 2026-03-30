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

README.md
ROADMAP.md
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

## Recent Changes

- Native `/spec` scaffolding was initialized under `.specify/`.
- The repository constitution was adopted in `.specify/memory/constitution.md`.
- `AGENTS.md` was tightened to reflect scaffold-first reality, validation
  commands, and commit discipline.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
