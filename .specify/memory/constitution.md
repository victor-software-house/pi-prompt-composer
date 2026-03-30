<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.0.1
- Modified principles:
  - Clarified II. Pi-Native Compatibility for non-exported Pi internals
- Templates requiring updates:
  - ✅ .specify/templates/constitution-template.md
  - ✅ .specify/memory/pi-agent.md
- Follow-up TODOs:
  - Consider extracting faithful Pi helper reimplementations to a shared package such as pi-provider-utils
-->
# pi-prompt-composer Constitution

## Core Principles

### I. Scaffold Truth Over Roadmap
All repository guidance, specifications, plans, and summaries MUST describe only
behavior that exists in committed source files. Planned paths such as `src/`,
example prompt directories, or future commands MUST remain clearly marked as
planned until they are created. `extensions/index.ts` is the current
implementation truth for code, and `ROADMAP.md` is the source of planned work.

Rationale: this repository is scaffold-first. Overstating roadmap items would
mislead both operators and future agents.

### II. Pi-Native Compatibility
New features MUST layer on top of Pi's native prompt-template behavior instead
of replacing it. Implementations MUST reuse Pi utilities such as
`parseCommandArgs`, `substituteArgs`, and `parseFrontmatter` when those
utilities are publicly available and cover the required behavior. When required
Pi behavior exists only in non-exported internals, implementations MUST
faithfully reimplement that behavior, keep the result compatible with Pi-native
semantics, and add source-provenance comments that identify the upstream Pi
package version and internal module path. Flat `.md` prompt templates MUST
remain Pi-native, `_index.md` MUST be the bare-command fallback,
extension-registered commands MUST take precedence over conflicting flat prompt
templates, and user-versus-project prompt scope MUST remain correct wherever
command metadata is surfaced.

Rationale: the package exists to extend Pi prompt routing, not to fork or shadow
Pi's baseline prompt system. Faithful local copies of non-exported helpers
should remain explicit and easy to extract later into shared utilities such as
`pi-provider-utils` when reuse justifies it.

### III. Verification Before Claims
Before a change is presented as complete, agents MUST run the repository's
verification workflow from the repo root: `bun install`, `bun run fix`,
`bun run typecheck`, and `bun run lint`. If a change adds tests, the test
command MUST be added to `package.json` and then included in both the runtime
workflow and the documentation. When packaging or release files change,
`package.json`, `bun.lock`, `CHANGELOG.md`, and `release.config.mjs` MUST stay
aligned.

Rationale: this repo relies on strict TypeScript, automated linting, and release
metadata consistency rather than a large runtime test suite.

### IV. Small, Reviewable Delivery
Substantial work MUST be split into small, reviewable slices. Agents MUST commit
stable checkpoints before starting the next distinct change, MUST use
conventional commits, and MUST avoid batching unrelated work into a single late
commit. Any change that materially affects operator behavior or workflow MUST
ship its code, docs, and spec updates in the same reviewable slice.

Rationale: the repository is small enough that disciplined incremental changes
keep history readable and reduce drift between code and guidance.

### V. Documentation and Spec Synchronization
`README.md` MUST stay focused on human onboarding and usage, `AGENTS.md` MUST
stay focused on always-on agent workflow guidance, `ROADMAP.md` MUST track
planned work, and `.specify/memory/pi-agent.md` MUST hold native Pi planning
context. Feature specs, plans, and tasks MUST reference the repository's real
layout at the time they are written and MUST include documentation-update work
whenever operator-facing behavior, verification commands, packaging, or release
flow changes.

Rationale: this repository depends on a small set of high-signal docs; each file
needs a single clear role to stay trustworthy.

## Operational Baseline

- The repository is a single-package Pi extension today.
- `extensions/index.ts` is the only code entrypoint today.
- TypeScript is strict and runs with Bun-based tooling.
- There is no test suite yet; adding one requires adding the command to
  `package.json` and documenting it.
- New directories such as `src/`, `examples/`, or nested package folders MUST
  not be treated as standard layout until they exist in committed source.

## Spec Workflow Quality Gates

- `/spec specify` outputs MUST define compatibility expectations whenever a
  feature can affect prompt discovery, command precedence, `_index.md`
  fallback behavior, argument substitution, or prompt scope attribution.
- `/spec plan` MUST pass a constitution check that confirms the feature is
  grounded in current repo reality, preserves Pi-native compatibility, lists the
  exact files to change, and includes the required validation commands.
- `/spec tasks` MUST include documentation-sync tasks whenever behavior,
  packaging, or release flow changes, and MUST include the required validation
  tasks before completion.
- `/spec analyze` MUST treat constitution violations as blocking, even when
  code or task coverage appears otherwise complete.

## Governance

This constitution governs the repository's spec workflow and supersedes local
planning habits when they conflict. Explicit user instructions override this
constitution for the current session, and higher-level repository guidance still
applies where this file is silent.

Amendments MUST update this file and any affected templates in
`.specify/templates/` or `.specify/memory/pi-agent.md` in the same change.
Amendments use semantic versioning:

- MAJOR for removing or redefining a core principle
- MINOR for adding a principle or materially expanding governance
- PATCH for clarifications that do not change expected behavior

Compliance review is required during `/spec plan`, during `/spec analyze`, and
before merge for any change that affects code, workflow templates, release
configuration, or operator-facing behavior.

**Version**: 1.0.1 | **Ratified**: 2026-03-30 | **Last Amended**: 2026-03-30
