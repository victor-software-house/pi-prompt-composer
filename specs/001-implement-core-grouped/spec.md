# Feature Specification: Core Grouped Prompt Routing

**Feature Branch**: `[001-implement-core-grouped]`  
**Created**: 2026-03-30  
**Status**: Draft  
**Input**: User description: "Implement core grouped prompt routing for nested prompt folders: scan Pi prompt roots for first-level directories, build a grouped-prompt registry, register one /group command per directory with subcommand autocomplete, dispatch /group subcommand to the matching markdown prompt using Pi-native argument substitution, and open an interactive selector for bare /group."

## Clarifications

### Session 2026-03-31

- Q: How should grouped prompt discovery treat unsupported directory contents when deciding whether a first-level directory becomes a prompt group? → A: A directory becomes a group only if it contains at least one direct `.md` file other than `_index.md`; non-markdown files and deeper nested directories are ignored without blocking registration.
- Q: What should the operator-visible subcommand naming rule be for nested prompt files? → A: Normalize nested prompt filenames to lowercase kebab-case before exposing them as subcommands.
- Q: How should user-vs-project scope be surfaced in package-owned UX or diagnostics for grouped commands? → A: Show scope labels only at the group listing level when duplicate group names exist across the two prompt roots; subcommands remain unambiguous without scope labels.
- Q: What description fallback should grouped UX use when `_index.md` or a nested prompt file lacks a `description` field? → A: Require `description` frontmatter for grouped prompt metadata instead of deriving fallback descriptions.
- Q: When must grouped prompt discovery refresh during this first slice? → A: Refresh grouped prompt discovery only when the extension loads or reloads.
- Q: How should the spec cover duplicate-group precedence and same-name flat-prompt conflict in acceptance scenarios? → A: Add one acceptance scenario under User Story 3 for duplicate group precedence and one under User Story 1 for grouped-vs-flat same-name command conflict.
- Q: What minimum selector UX detail should be mandatory for the interactive selection experience? → A: Each selector item must show the normalized subcommand name and its required description; scope labels appear only at the group listing level when duplicate groups exist.
- Q: What frontmatter schema should grouped prompts require for operator-facing metadata and argument hints? → A: For nested prompts, require `description` and an `args` array where each arg has `name`, `required`, and `hint`; for `_index.md`, require `description` only.
- Q: What scope indicator format should the spec require at the group listing level when duplicate groups exist? → A: Use compact bracketed scope markers such as `[u]` for user and `[p]` for project at the group listing level, but rely on Pi-native listing behavior where available and investigate later whether package-owned implementation is needed.
- Q: For this first slice, should the spec explicitly exclude numeric performance thresholds for discovery and autocomplete, or require them now? → A: Explicitly exclude numeric performance thresholds from this slice; keep only the behavioral constraint that grouped discovery happens on load/reload, not per keystroke.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a nested prompt directly (Priority: P1)

As an operator, I want to run a prompt stored inside a prompt folder by typing `/group subcommand ...` so that grouped prompts are as fast to use as existing flat slash prompts.

**Why this priority**: Direct invocation is the core value of grouped prompt routing. Without it, the feature does not deliver a usable command structure.

**Independent Test**: Create a prompt folder with at least one nested prompt, invoke `/group subcommand` with example arguments, and confirm that the matching prompt content appears as a visible user message with the expected substituted values.

**Acceptance Scenarios**:

1. **Given** a supported prompt root contains a first-level directory with a markdown prompt file, **When** the operator enters `/group subcommand` with valid arguments, **Then** the system routes to that prompt file and sends the rendered prompt text as a visible user message.
2. **Given** both flat prompts and grouped prompts exist, **When** the operator enters a valid grouped prompt command, **Then** the grouped command resolves to the intended nested prompt without changing the behavior of unrelated flat prompts.
3. **Given** a grouped command name conflicts with a flat prompt template name, **When** the operator enters the grouped command with a valid nested subcommand, **Then** the grouped command takes precedence and the flat prompt template is not dispatched for that command.

---

### User Story 2 - Discover nested prompts from a bare group command (Priority: P2)

As an operator, I want bare `/group` to show me the available nested prompts so that I can discover and select the right prompt without memorizing every subcommand.

**Why this priority**: Discovery is the next most important usability requirement after direct invocation. It makes grouped prompts practical for occasional use and onboarding.

**Independent Test**: Create a prompt folder with multiple nested prompts, enter `/group` with no subcommand, select one option from the interactive list, and confirm the selected prompt is the one that runs.

**Acceptance Scenarios**:

1. **Given** a prompt group contains multiple nested prompts, **When** the operator enters `/group` with no subcommand, **Then** the system displays an interactive list of available nested prompts.
2. **Given** the operator is shown the interactive list, **When** the operator selects one nested prompt, **Then** the system routes to the matching prompt file and sends the rendered prompt text as a visible user message.
3. **Given** the operator is shown the interactive list, **When** nested prompts are presented, **Then** each selector item shows the normalized subcommand name and its required description.

---

### User Story 3 - Organize prompts by folder without breaking existing prompts (Priority: P3)

As a prompt author, I want to place grouped prompts in supported user or project prompt roots while keeping existing flat prompts working, so that I can adopt grouped routing incrementally.

**Why this priority**: Safe coexistence protects current workflows and lowers adoption risk. The feature must add structure without forcing prompt authors to migrate everything at once.

**Independent Test**: Add a grouped prompt directory beside existing flat prompt files in both supported prompt roots, reload prompt discovery, and confirm grouped prompts appear as command groups while flat prompts still behave as before.

**Acceptance Scenarios**:

1. **Given** a supported prompt root contains both flat prompt files and grouped prompt directories, **When** prompt discovery runs, **Then** flat prompts remain available through their existing behavior and grouped directories become grouped slash commands.
2. **Given** the same group name exists in both user-scoped and project-scoped prompt roots, **When** prompt discovery runs, **Then** the system applies one documented precedence rule consistently and presents a single effective grouped command to the operator.
3. **Given** the same group name exists in both user-scoped and project-scoped prompt roots, **When** prompt discovery runs, **Then** the project-scoped group wins, only one effective grouped command is exposed, and scope markers apply per FR-012a.

### Edge Cases

- A prompt directory that contains only `_index.md` and no direct runnable nested prompt files does not become a grouped command.
- An unknown subcommand entered after a valid group name returns package-owned feedback that names the group, echoes the unknown subcommand, and lists the available nested prompt options.
- When the same group name exists in both supported prompt roots, the project-scoped group wins and scope markers apply per FR-012a.
- `_index.md` MUST include `description` frontmatter, and each nested prompt file MUST include `description` plus an `args` array whose items define `name`, `required`, and `hint` for operator-visible argument guidance.
- Nested prompt files continue to use Pi-compatible placeholder behavior when the operator provides no extra arguments; this feature does not add guided argument collection.
- A group directory without `_index.md`, or with `_index.md` that lacks `description` frontmatter, MUST be skipped during discovery and MUST NOT be registered as a grouped command. The extension MUST emit a diagnostic notification identifying the skipped directory and the reason.
- A nested prompt file that is missing `description` frontmatter or has a missing or malformed `args` array MUST be skipped during discovery and excluded from its group's runnable prompts. The extension MUST emit a diagnostic notification identifying the skipped file and the reason. If skipping all nested prompts in a group leaves zero runnable prompts, the group itself is not registered.

## Compatibility & Non-Goals *(mandatory)*

### Compatibility Commitments

- **CC-001**: Existing flat `.md` prompt templates MUST continue to work unchanged and remain outside this feature's grouped routing behavior.
- **CC-002**: Grouped commands MUST preserve the current prompt placeholder and argument-substitution behavior already expected from prompt templates.
- **CC-003**: Bare `/group` behavior MUST use `_index.md` only as group-level descriptive or fallback content and MUST NOT change the meaning of nested prompt files.
- **CC-004**: If a grouped command name conflicts with an existing flat prompt name, the grouped command MUST take precedence in a predictable, documented way.
- **CC-005**: When the same grouped command name exists in both supported prompt roots, grouped command listing UX MUST identify whether the effective command came from the project-scoped or user-scoped prompt root, preferably using compact markers such as `[u]` or `[p]` when Pi-native listing behavior supports them.

### Explicit Non-Goals

- **NG-001**: This feature will not add guided collection for missing prompt arguments beyond current prompt-template behavior.
- **NG-002**: This feature will not add prompt-body shell substitution or any other package-specific preprocessing stage.
- **NG-003**: This feature will not support nesting deeper than `/group subcommand`.
- **NG-004**: This feature will not add aliases, alternate command names, or dynamic generated subcommands.
- **NG-005**: This first slice will not define numeric performance thresholds or latency SLAs for grouped discovery, autocomplete, or selector rendering.

## Assumptions

- Project-scoped grouped prompts take precedence over user-scoped grouped prompts when both define the same group name, because project-local behavior should win within the active repository.
- A directory is only treated as a runnable grouped command when it contains at least one nested markdown prompt other than `_index.md`.
- Group-level and nested-prompt descriptions are required in frontmatter and are not derived from body text or filenames.
- Nested prompt frontmatter includes an `args` array for operator-visible argument guidance; each item defines `name`, `required`, and `hint`.
- Nested prompt subcommand names are derived from markdown filename stems and normalized to lowercase kebab-case for operator-visible command entry.
- A first-level directory becomes a grouped command only when it contains at least one direct `.md` file other than `_index.md`; non-markdown files and deeper nested directories are ignored and do not block registration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST scan both supported Pi prompt roots for first-level directories that qualify as grouped prompt candidates, where a qualifying directory contains at least one direct `.md` file other than `_index.md`.
- **FR-002**: The system MUST treat markdown files directly inside a grouped prompt directory as nested prompts, excluding `_index.md` from the runnable nested prompt list, and MUST ignore non-markdown files and deeper nested directories inside the group.
- **FR-003**: The system MUST create one slash command per discovered prompt group using the directory name as the command name.
- **FR-003a**: The system MUST derive each nested prompt subcommand from the markdown filename stem and normalize it to lowercase kebab-case before exposing it to operators.
- **FR-004**: The system MUST allow an operator to run a nested prompt by entering `/group subcommand` followed by any prompt arguments.
- **FR-005**: The system MUST show an interactive selection experience when an operator enters `/group` without a subcommand and MUST let the operator choose one of the available nested prompts. Each selector item MUST show the normalized subcommand name and that prompt's required description. When a nested prompt declares required arguments in its `args` metadata, the selector item MUST append a parenthetical hint listing those argument names. When the operator selects a prompt via the bare-command selector and provides no arguments, the prompt body is sent with unsubstituted placeholders, consistent with NG-001.
- **FR-006**: The system MUST offer available nested prompt names as completions after the operator types `/group` and begins entering a subcommand.
- **FR-007**: The system MUST render grouped prompt content using the same prompt argument placeholder behavior already expected from flat prompt templates.
- **FR-008**: The system MUST send the final rendered grouped prompt content as a visible user message so the operator can inspect what was dispatched.
- **FR-009**: The system MUST preserve the existing behavior of flat `.md` prompt templates that are not inside grouped prompt directories.
- **FR-010**: The system MUST use `_index.md` as the group-level metadata file for grouped prompt UX, and `_index.md` MUST include `description` frontmatter.
- **FR-010a**: Each nested prompt file MUST include `description` frontmatter used in grouped prompt UX.
- **FR-010b**: Each nested prompt file MUST declare an `args` frontmatter array for operator-visible argument guidance, where every argument item includes `name`, `required`, and `hint`.
- **FR-011**: The system MUST return package-owned feedback when the operator enters an unknown subcommand, and that feedback MUST name the group, echo the unknown subcommand, and list the available nested prompt options.
- **FR-012**: The system MUST record whether each discovered grouped prompt came from the user-scoped or project-scoped prompt root.
- **FR-012a**: When duplicate group names exist across supported prompt roots, the grouped command listing MUST surface the winning scope, preferably using compact markers such as `[u]` or `[p]` when Pi-native listing behavior supports them.
- **FR-013**: The system MUST resolve duplicate group names across supported prompt roots using a single documented precedence rule and MUST apply that rule consistently.
- **FR-014**: The system MUST refresh grouped prompt discovery whenever the extension loads or is reloaded so the effective command list reflects added, changed, or removed grouped prompts. This first slice does not require additional in-session refresh triggers or numeric performance thresholds.

### Key Entities *(include if feature involves data)*

- **Prompt Root**: A supported source location for prompts. It has a scope, contains flat prompt files and grouped prompt directories, and participates in precedence decisions.
- **Prompt Group**: A first-level prompt directory that becomes one slash command. It has a name, scope, a required `_index.md` description used for group-level metadata, and a set of nested prompts.
- **Nested Prompt**: A markdown prompt file inside a prompt group that becomes a runnable subcommand. It has a normalized lowercase kebab-case name derived from the filename stem, prompt content, required `description` frontmatter, a required `args` array of `{ name, required, hint }` metadata for operator-visible argument guidance, and an originating scope.
- **Effective Command**: The operator-visible grouped command that results after discovery and precedence resolution. It points to the prompt group that wins for a given command name.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In validation scenarios covering both supported prompt roots, 100% of eligible first-level prompt directories with runnable nested prompts appear as grouped slash commands after discovery or reload.
- **SC-002**: In validation scenarios for existing grouped prompts, 100% of valid `/group subcommand` invocations render the selected prompt content as a visible user message with the supplied argument values inserted correctly.
- **SC-003**: Operators can reach any nested prompt in a discovered group in no more than two interactions: either direct `/group subcommand` entry or bare `/group` followed by one selection.
- **SC-004**: In coexistence validation scenarios, existing flat prompt templates with non-conflicting names continue to behave unchanged after grouped prompt routing is enabled.
- **SC-005**: In validation scenarios with an invalid subcommand, operators receive corrective feedback that names the available alternatives every time.
