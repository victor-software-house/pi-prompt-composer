# Feature Specification: Core Grouped Prompt Routing

**Feature Branch**: `[001-implement-core-grouped]`  
**Created**: 2026-03-30  
**Status**: Draft  
**Input**: User description: "Implement core grouped prompt routing for nested prompt folders: scan Pi prompt roots for first-level directories, build a grouped-prompt registry, register one /group command per directory with subcommand autocomplete, dispatch /group subcommand to the matching markdown prompt using Pi-native argument substitution, and open an interactive selector for bare /group."

## Clarifications

### Session 2026-03-31

- Q: How should grouped prompt discovery treat unsupported directory contents when deciding whether a first-level directory becomes a prompt group? → A: A directory becomes a group only if it contains at least one direct `.md` file other than `_index.md`; non-markdown files and deeper nested directories are ignored without blocking registration.
- Q: What should the operator-visible subcommand naming rule be for nested prompt files? → A: Normalize nested prompt filenames to lowercase kebab-case before exposing them as subcommands.
- Q: How should user-vs-project scope be surfaced in package-owned UX or diagnostics for grouped commands? → A: Show scope labels only when duplicate group names exist across the two prompt roots.
- Q: What description fallback should grouped UX use when `_index.md` or a nested prompt file lacks a `description` field? → A: Require `description` frontmatter; if it is absent, show no description.
- Q: When must grouped prompt discovery refresh during this first slice? → A: Refresh grouped prompt discovery only when the extension loads or reloads.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a nested prompt directly (Priority: P1)

As an operator, I want to run a prompt stored inside a prompt folder by typing `/group subcommand ...` so that grouped prompts are as fast to use as existing flat slash prompts.

**Why this priority**: Direct invocation is the core value of grouped prompt routing. Without it, the feature does not deliver a usable command structure.

**Independent Test**: Create a prompt folder with at least one nested prompt, invoke `/group subcommand` with example arguments, and confirm that the matching prompt content appears as a visible user message with the expected substituted values.

**Acceptance Scenarios**:

1. **Given** a supported prompt root contains a first-level directory with a markdown prompt file, **When** the operator enters `/group subcommand` with valid arguments, **Then** the system routes to that prompt file and sends the rendered prompt text as a visible user message.
2. **Given** both flat prompts and grouped prompts exist, **When** the operator enters a valid grouped prompt command, **Then** the grouped command resolves to the intended nested prompt without changing the behavior of unrelated flat prompts.

---

### User Story 2 - Discover nested prompts from a bare group command (Priority: P2)

As an operator, I want bare `/group` to show me the available nested prompts so that I can discover and select the right prompt without memorizing every subcommand.

**Why this priority**: Discovery is the next most important usability requirement after direct invocation. It makes grouped prompts practical for occasional use and onboarding.

**Independent Test**: Create a prompt folder with multiple nested prompts, enter `/group` with no subcommand, select one option from the interactive list, and confirm the selected prompt is the one that runs.

**Acceptance Scenarios**:

1. **Given** a prompt group contains multiple nested prompts, **When** the operator enters `/group` with no subcommand, **Then** the system displays an interactive list of available nested prompts.
2. **Given** the operator is shown the interactive list, **When** the operator selects one nested prompt, **Then** the system routes to the matching prompt file and sends the rendered prompt text as a visible user message.

---

### User Story 3 - Organize prompts by folder without breaking existing prompts (Priority: P3)

As a prompt author, I want to place grouped prompts in supported user or project prompt roots while keeping existing flat prompts working, so that I can adopt grouped routing incrementally.

**Why this priority**: Safe coexistence protects current workflows and lowers adoption risk. The feature must add structure without forcing prompt authors to migrate everything at once.

**Independent Test**: Add a grouped prompt directory beside existing flat prompt files in both supported prompt roots, reload prompt discovery, and confirm grouped prompts appear as command groups while flat prompts still behave as before.

**Acceptance Scenarios**:

1. **Given** a supported prompt root contains both flat prompt files and grouped prompt directories, **When** prompt discovery runs, **Then** flat prompts remain available through their existing behavior and grouped directories become grouped slash commands.
2. **Given** the same group name exists in both user-scoped and project-scoped prompt roots, **When** prompt discovery runs, **Then** the system applies one documented precedence rule consistently and presents a single effective grouped command to the operator.

### Edge Cases

- A prompt directory that contains only `_index.md` and no direct runnable nested prompt files does not become a grouped command.
- An unknown subcommand entered after a valid group name returns package-owned feedback that names the group, echoes the unknown subcommand, and lists the available nested prompt options.
- When the same group name exists in both supported prompt roots, the project-scoped group wins, and package-owned UX or diagnostics identify the winning scope.
- If `_index.md` or a nested prompt file omits `description` frontmatter, grouped package-owned UX shows no description instead of deriving fallback copy.
- Nested prompt files continue to use Pi-compatible placeholder behavior when the operator provides no extra arguments; this feature does not add guided argument collection.

## Compatibility & Non-Goals *(mandatory)*

### Compatibility Commitments

- **CC-001**: Existing flat `.md` prompt templates MUST continue to work unchanged and remain outside this feature's grouped routing behavior.
- **CC-002**: Grouped commands MUST preserve the current prompt placeholder and argument-substitution behavior already expected from prompt templates.
- **CC-003**: Bare `/group` behavior MUST use `_index.md` only as group-level descriptive or fallback content and MUST NOT change the meaning of nested prompt files.
- **CC-004**: If a grouped command name conflicts with an existing flat prompt name, the grouped command MUST take precedence in a predictable, documented way.
- **CC-005**: When the same grouped command name exists in both supported prompt roots, package-owned UX or diagnostics MUST identify whether the effective command came from the project-scoped or user-scoped prompt root.

### Explicit Non-Goals

- **NG-001**: This feature will not add guided collection for missing prompt arguments beyond current prompt-template behavior.
- **NG-002**: This feature will not add prompt-body shell substitution or any other package-specific preprocessing stage.
- **NG-003**: This feature will not support nesting deeper than `/group subcommand`.
- **NG-004**: This feature will not add aliases, alternate command names, or dynamic generated subcommands.

## Assumptions

- Project-scoped grouped prompts take precedence over user-scoped grouped prompts when both define the same group name, because project-local behavior should win within the active repository.
- A directory is only treated as a runnable grouped command when it contains at least one nested markdown prompt other than `_index.md`.
- Group-level and nested-prompt descriptions come from `description` frontmatter; if that metadata is absent, package-owned grouped UX shows no description instead of deriving fallback copy from body text or filenames.
- Nested prompt subcommand names are derived from markdown filename stems and normalized to lowercase kebab-case for operator-visible command entry.
- A first-level directory becomes a grouped command only when it contains at least one direct `.md` file other than `_index.md`; non-markdown files and deeper nested directories are ignored and do not block registration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST scan both supported Pi prompt roots for first-level directories that qualify as grouped prompt candidates, where a qualifying directory contains at least one direct `.md` file other than `_index.md`.
- **FR-002**: The system MUST treat markdown files directly inside a grouped prompt directory as nested prompts, excluding `_index.md` from the runnable nested prompt list, and MUST ignore non-markdown files and deeper nested directories inside the group.
- **FR-003**: The system MUST create one slash command per discovered prompt group using the directory name as the command name.
- **FR-003a**: The system MUST derive each nested prompt subcommand from the markdown filename stem and normalize it to lowercase kebab-case before exposing it to operators.
- **FR-004**: The system MUST allow an operator to run a nested prompt by entering `/group subcommand` followed by any prompt arguments.
- **FR-005**: The system MUST show an interactive selection experience when an operator enters `/group` without a subcommand and MUST let the operator choose one of the available nested prompts.
- **FR-006**: The system MUST offer available nested prompt names as completions after the operator types `/group` and begins entering a subcommand.
- **FR-007**: The system MUST render grouped prompt content using the same prompt argument placeholder behavior already expected from flat prompt templates.
- **FR-008**: The system MUST send the final rendered grouped prompt content as a visible user message so the operator can inspect what was dispatched.
- **FR-009**: The system MUST preserve the existing behavior of flat `.md` prompt templates that are not inside grouped prompt directories.
- **FR-010**: The system MUST use `_index.md`, when present, as the preferred source for group-level description or help content shown in grouped prompt UX, and MUST show no derived description when `description` frontmatter is absent.
- **FR-011**: The system MUST return package-owned feedback when the operator enters an unknown subcommand, and that feedback MUST name the group, echo the unknown subcommand, and list the available nested prompt options.
- **FR-012**: The system MUST record whether each discovered grouped prompt came from the user-scoped or project-scoped prompt root.
- **FR-012a**: When duplicate group names exist across supported prompt roots, the system MUST surface the winning scope in package-owned descriptions, selector copy, or diagnostics.
- **FR-013**: The system MUST resolve duplicate group names across supported prompt roots using a single documented precedence rule and MUST apply that rule consistently.
- **FR-014**: The system MUST refresh grouped prompt discovery whenever the extension loads or is reloaded so the effective command list reflects added, changed, or removed grouped prompts. This first slice does not require additional in-session refresh triggers.

### Key Entities *(include if feature involves data)*

- **Prompt Root**: A supported source location for prompts. It has a scope, contains flat prompt files and grouped prompt directories, and participates in precedence decisions.
- **Prompt Group**: A first-level prompt directory that becomes one slash command. It has a name, scope, description, and a set of nested prompts.
- **Nested Prompt**: A markdown prompt file inside a prompt group that becomes a runnable subcommand. It has a normalized lowercase kebab-case name derived from the filename stem, prompt content, optional `description` frontmatter used for grouped UX, and an originating scope.
- **Effective Command**: The operator-visible grouped command that results after discovery and precedence resolution. It points to the prompt group that wins for a given command name.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation scenarios covering both supported prompt roots, 100% of eligible first-level prompt directories with runnable nested prompts appear as grouped slash commands after discovery or reload.
- **SC-002**: In validation scenarios for existing grouped prompts, 100% of valid `/group subcommand` invocations render the selected prompt content as a visible user message with the supplied argument values inserted correctly.
- **SC-003**: Operators can reach any nested prompt in a discovered group in no more than two interactions: either direct `/group subcommand` entry or bare `/group` followed by one selection.
- **SC-004**: In coexistence validation scenarios, existing flat prompt templates with non-conflicting names continue to behave unchanged after grouped prompt routing is enabled.
- **SC-005**: In validation scenarios with an invalid subcommand, operators receive corrective feedback that names the available alternatives every time.
