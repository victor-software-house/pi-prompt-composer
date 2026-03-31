# [PROJECT_NAME] Constitution

## Core Principles

### I. Scaffold Truth Over Roadmap
All repository guidance, specifications, plans, and summaries MUST describe only
behavior that exists in committed source files. Planned paths, examples, or
future commands MUST remain clearly marked as planned until they are created.
`[IMPLEMENTATION_ENTRYPOINT]` is the current implementation truth for code, and
`ROADMAP.md` is the source of planned work.

Rationale: scaffold-first repositories drift quickly when planning language is
allowed to masquerade as shipped behavior.

### II. Pi-Native Compatibility
New features MUST layer on top of Pi's native behavior instead of replacing it.
Implementations MUST reuse Pi utilities when those utilities are publicly
available and cover the required behavior. When required Pi behavior exists
only in non-exported internals, implementations MUST faithfully reimplement
that behavior, keep the result compatible with Pi-native semantics, and add
source-provenance comments that identify the upstream Pi package version and
internal module path. Flat prompt templates MUST remain Pi-native, `_index.md`
MUST remain the bare-command fallback when applicable, extension-registered
commands MUST take precedence over conflicting flat prompt templates, and scope
attribution MUST remain correct wherever metadata is surfaced.

Rationale: Pi extensions should extend Pi, not fork its baseline behavior.
Faithful local copies of non-exported helpers should remain explicit and easy to
extract later into shared utilities when reuse justifies it.

### III. Verification Before Claims
Before a change is presented as complete, agents MUST run the repository's
verification workflow from the repo root: `[VALIDATION_COMMANDS]`. If a change
adds tests, the test command MUST be added to `package.json` and then included
in both the runtime workflow and the documentation. When packaging or release
files change, package metadata, lockfiles, changelogs, and release automation
MUST stay aligned.

Rationale: strict validation and release metadata consistency are the primary
quality gates in lightweight extension repositories.

### IV. Small, Reviewable Delivery
Substantial work MUST be split into small, reviewable slices. Agents MUST commit
stable checkpoints before starting the next distinct change, MUST use the
repository's commit convention, and MUST avoid batching unrelated work into a
single late commit. Any change that materially affects operator behavior or
workflow MUST ship its code, docs, and spec updates in the same reviewable
slice.

Rationale: small repositories benefit most from readable history and low-drift
documentation.

### V. Documentation and Spec Synchronization
`README.md` MUST stay focused on human onboarding and usage, `AGENTS.md` MUST
stay focused on always-on agent workflow guidance, `ROADMAP.md` MUST track
planned work, and `.specify/memory/pi-agent.md` MUST hold native Pi planning
context. Feature specs, plans, and tasks MUST reference the repository's real
layout at the time they are written and MUST include documentation-update work
whenever operator-facing behavior, verification commands, packaging, or release
flow changes.

Rationale: each durable document needs one clear role to remain trustworthy.

## Operational Baseline

- The repository is a single-package Pi extension unless the source tree says
  otherwise.
- `[IMPLEMENTATION_ENTRYPOINT]` is the only code entrypoint until additional
  paths exist in committed source.
- TypeScript, tooling, and repo structure details belong here once the project
  adopts them.
- New directories MUST not be treated as standard layout until they exist in
  committed source.

## Spec Workflow Quality Gates

- `/spec specify` outputs MUST define compatibility expectations whenever a
  feature can affect core Pi behavior or operator-facing workflow.
- `/spec plan` MUST confirm the feature is grounded in current repo reality,
  preserves Pi-native compatibility, lists the exact files to change, and
  includes the required validation commands.
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

**Version**: [CONSTITUTION_VERSION] | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]
