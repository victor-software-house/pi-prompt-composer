# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/spec plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [ ] Scope is grounded in the repository's current state and does not describe roadmap items as already implemented.
- [ ] The design preserves Pi-native prompt behavior unless the spec explicitly changes that contract.
- [ ] Planned file paths match the real repo layout, or this plan explicitly creates any new paths it depends on.
- [ ] Documentation updates are identified for every operator-facing, packaging, or workflow change.
- [ ] Validation steps include `bun install`, `bun run fix`, `bun run typecheck`, `bun run lint`, and any new test command added by this feature.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/spec plan output)
├── research.md          # Phase 0 output (/spec plan)
├── data-model.md        # Phase 1 output (/spec plan)
├── quickstart.md        # Phase 1 output (/spec plan)
├── contracts/           # Phase 1 output (/spec plan)
└── tasks.md             # Phase 2 output (/spec tasks, not created by /spec plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# Current repo layout (default for this project today)
extensions/
└── index.ts

README.md
ROADMAP.md
AGENTS.md
.specify/
└── ...

# Add only if this feature creates them
src/
examples/
specs/[###-feature]/
```

**Structure Decision**: [Document the selected structure, reference the real directories captured above, and justify any newly introduced top-level paths]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
