# Feature Specification: Publish Readiness

**Feature Branch**: `003-publish-readiness`
**Created**: 2026-04-01
**Status**: Draft
**Input**: User description: "help me identify what's left until this becomes a proper publishable pi package. we need a friendly readme, examples and to manually test them. and we need to publish the package to npm. would be good to have a screenshot (just like the ones in pi-curated-themes, which are actually script generated). or even better, like ../pi-tui-renderer/ preview helper that can output the exact native pi output."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — New User Installs and Uses a Grouped Prompt (Priority: P1)

A Pi operator discovers pi-prompt-composer on npm. They read the README, install the package, copy the bundled example prompts into their prompt root, and invoke a grouped command within 2 minutes. The README guides them from zero to a working `/review summary` invocation.

**Why this priority**: Without a clear, friendly onboarding path, the package will not gain adoption regardless of how correct the runtime is. This is the gate to every other user journey.

**Independent Test**: Can be fully tested by following only the README quick-start section with a fresh Pi install and verifying that the example prompts produce working grouped commands.

**Acceptance Scenarios**:

1. **Given** a Pi installation without pi-prompt-composer, **When** the operator runs `pi install pi-prompt-composer`, **Then** the package installs without errors and the extension loads on the next Pi session.
2. **Given** the package is installed and example prompts are copied to `~/.pi/agent/prompts/review/`, **When** the operator types `/review` and presses Enter, **Then** an interactive selector menu appears listing the nested prompts and the selected prompt opens an editor before dispatch.
3. **Given** the example prompts are in place, **When** the operator types `/review summary some change description`, **Then** the rendered prompt appears as a visible user message with the arguments substituted.
4. **Given** the operator selects a prompt or directly invokes one without all required arguments, **When** the extension detects missing required args from prompt metadata, **Then** it pauses, collects the missing values interactively, opens an editor with the rendered prompt, and only dispatches after confirmation.
4. **Given** the example prompts are in place, **When** the operator types `/review <Tab>`, **Then** available subcommands (`summary`, `fix`) appear as completions.

---

### User Story 2 — README Communicates Value at a Glance (Priority: P1)

A potential user lands on the npm page or GitHub repo. Within 10 seconds of scanning the README, they understand what the package does, see a visual preview of the grouped command UX, and know how to install it.

**Why this priority**: The README is the package's storefront. A wall of spec-level prose loses most visitors. Visual proof of the UX (screenshot or TUI preview) makes the value proposition immediate.

**Independent Test**: Show the README to someone unfamiliar with the project; they can explain what the package does and how to start using it without reading beyond the first two sections.

**Acceptance Scenarios**:

1. **Given** the README is rendered on GitHub or npm, **When** a visitor scans the first screen, **Then** they see a one-line description, an install command, and a visual preview of the grouped command selector.
2. **Given** the README, **When** a visitor reads the quick-start section, **Then** they find a complete copy-paste recipe (install → create prompt folder → invoke command) with no ambiguity.
3. **Given** the README, **When** a visitor looks for the directory layout convention, **Then** they find a clear tree diagram with annotations explaining `_index.md`, nested prompts, and frontmatter fields.

---

### User Story 3 — Package Publishes Successfully to npm (Priority: P1)

A maintainer merges a `feat:` or `fix:` commit to `main`. The CI workflow runs typecheck, lint, and tests, then semantic-release publishes a new version to npm with provenance attestation. The npm listing shows correct metadata (description, homepage, keywords, license).

**Why this priority**: The package cannot be adopted if it cannot be installed from the public registry. Publishing is the hard prerequisite for every downstream user.

**Independent Test**: Trigger a release by merging a conventional commit to `main` and verify the package appears on npmjs.com with correct metadata and installable via `pi install pi-prompt-composer`.

**Acceptance Scenarios**:

1. **Given** a `feat:` commit is pushed to `main`, **When** the CI workflow runs, **Then** `pnpm run typecheck`, `pnpm run lint`, and `pnpm run test` all pass before the release step.
2. **Given** CI checks pass, **When** semantic-release runs, **Then** a new version is published to npm with provenance and the correct `pi` extension metadata.
3. **Given** the package is published, **When** a user visits the npm page, **Then** they see the description, homepage link, repository link, keywords, and license.

---

### User Story 4 — Maintainer Generates a Visual Preview for the README (Priority: P2)

A maintainer runs a script that produces a terminal screenshot showing the grouped command selector UX as it appears in a real Pi session. The output is a file suitable for embedding in the README (SVG, PNG, or ANSI text rendered to an image).

**Why this priority**: A visual preview is the strongest onboarding signal, but the package is usable without it. This is high-value polish that can follow the core publishing work.

**Independent Test**: Run the preview script from the repo root and verify it produces an image file that accurately represents the selector menu for the example prompt group.

**Acceptance Scenarios**:

1. **Given** the repo with example prompts in place, **When** the maintainer runs the preview script, **Then** it produces an image file in a known output directory.
2. **Given** the produced image, **When** it is viewed, **Then** it shows a Pi-style terminal frame with the grouped command selector listing subcommands with descriptions.
3. **Given** the image is committed to the repo, **When** the README references it, **Then** GitHub and npm render the image inline.

---

### User Story 5 — Maintainer Manually Tests the End-to-End UX (Priority: P2)

Before publishing, a maintainer installs the package locally from the repo (`pi install ./`), creates example prompt groups, and verifies every user-facing behavior: selector, direct dispatch, autocomplete, and error feedback.

**Why this priority**: Automated tests cover logic correctness but cannot validate the full operator experience through Pi's real runtime. Manual validation catches integration gaps.

**Independent Test**: Follow a documented manual test checklist and confirm every item passes against a live Pi session.

**Acceptance Scenarios**:

1. **Given** the package is installed locally, **When** the maintainer invokes `/review`, **Then** the interactive selector opens with correct labels and descriptions and the selected prompt opens in an editor before dispatch.
2. **Given** example prompts with argument metadata, **When** the maintainer invokes `/review summary "my change"`, **Then** the rendered prompt shows "my change" substituted into the template body.
3. **Given** example prompts with required args metadata, **When** the maintainer invokes `/review summary` without the required value, **Then** the extension asks for the missing value, opens an editor with the rendered prompt, and waits for confirmation before sending.
3. **Given** example prompts, **When** the maintainer types `/review <Tab>`, **Then** subcommand completions appear.
4. **Given** example prompts, **When** the maintainer types `/review nonexistent`, **Then** a warning notification shows the available subcommands.

### Edge Cases

- What happens when the preview script is run without example prompts in place? It should fail with a clear error message rather than producing an empty or broken image.
- What happens when `pi install pi-prompt-composer` is run on a Pi version that does not export `parseFrontmatter`? The extension should fail to load with a clear error rather than silently breaking.
- What happens when the npm publish step runs but npm OIDC trusted publishing is not configured for the repo? The CI job should fail with a clear authentication error rather than silently skipping the publish.
- What happens when the README image path is wrong or the image is not committed? GitHub/npm should show a broken image indicator, not silently hide the section.

## Compatibility & Non-Goals *(mandatory)*

### Compatibility Commitments

- **CC-001**: Existing grouped prompt routing behavior (discovery, command registration, autocomplete, and unknown-subcommand feedback) MUST remain intact while selector and missing-argument UX are improved. This feature may extend `extensions/index.ts` to collect required args interactively and route selected prompts through an editor before dispatch.
- **CC-002**: The `package.json` `pi` field, `files` array, and extension entry point (`./extensions`) MUST remain compatible with Pi's package installation mechanism.
- **CC-003**: The existing 65-test automated suite MUST continue to pass. New CI configuration MUST run the test suite before publishing.
- **CC-004**: Flat Pi-native `.md` prompt templates MUST remain unaffected. The README and examples MUST not imply that pi-prompt-composer replaces Pi's native prompt system.

### Explicit Non-Goals

- **NG-001**: This feature will not implement shell substitution (PPC-006). The README will not document it as available.
- **NG-002**: This feature will not add a rich custom form UI beyond Pi's built-in input/editor primitives.
- **NG-003**: The preview script will not produce animated GIFs or video. A single static terminal frame is sufficient for the first release.
- **NG-004**: The preview script will not require a running Pi session. It will compose Pi TUI components programmatically to produce the output.

## Requirements *(mandatory)*

### Functional Requirements

#### README & Documentation

- **FR-001**: The README MUST open with a one-line description and a visual preview (image or rendered terminal frame) above the fold.
- **FR-002**: The README MUST include a quick-start section that takes a new user from install to working grouped command in a single copy-paste sequence.
- **FR-003**: The README MUST include a directory layout diagram with annotations for `_index.md`, nested prompt files, and frontmatter fields.
- **FR-004**: The README MUST document current behavior honestly — including that prompts with required args metadata pause for missing values, then open an editor with the rendered prompt before dispatch.
- **FR-005**: The README MUST distinguish between Pi-native prompt template behavior and pi-prompt-composer's grouped routing additions, including the package-owned editor confirmation flow for selector and missing-arg cases.

#### Example Prompts

- **FR-006**: The package MUST ship at least one realistic example prompt group in an `examples/` directory that users can copy into their prompt root.
- **FR-007**: The example prompt group MUST demonstrate: `_index.md` with `type: group`, at least two nested prompts with descriptions, and at least one prompt with `args` metadata.
- **FR-008**: The example prompts MUST be self-contained — no external dependencies or project-specific assumptions.

#### CI & Publishing

- **FR-009**: The CI workflow MUST run `pnpm run test` before the release step.
- **FR-010**: The CI workflow MUST authenticate to npm via OIDC trusted publishing (provenance-based, no stored secrets) or via an explicit `NPM_TOKEN` / `NODE_AUTH_TOKEN` secret.
- **FR-011**: `package.json` MUST include `homepage`, `bugs`, and `engines` fields with correct values.
- **FR-012**: The published tarball MUST include `extensions/`, `README.md`, `LICENSE`, and `examples/` (if examples are meant for user consumption from the installed package).

#### Preview Script

- **FR-013**: The repo MUST include a script that produces a static terminal frame image showing the grouped command selector UX.
- **FR-014**: The preview script MUST compose Pi TUI components programmatically to render the frame, not require a running Pi session.
- **FR-015**: The preview script MUST produce output suitable for GitHub/npm README embedding (SVG or PNG).
- **FR-016**: The preview image MUST be committed to the repo and referenced from the README.

#### Manual Testing

- **FR-017**: The repo MUST include a documented manual test checklist covering: local install, selector invocation, editor confirmation after selection, direct dispatch with args, missing-required-arg collection, autocomplete, unknown subcommand feedback, and reload behavior.

### Key Entities

- **Example Prompt Group**: A directory under `examples/prompts/` containing `_index.md` and nested `.md` files that demonstrate the grouped prompt convention.
- **Preview Image**: A committed image file (SVG or PNG) showing the grouped command selector as rendered by Pi's TUI components.
- **Manual Test Checklist**: A markdown document listing step-by-step verification procedures for the end-to-end operator experience.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can go from `pi install pi-prompt-composer` to a working grouped command invocation in under 2 minutes by following only the README.
- **SC-002**: The package is installable from the public npm registry via `pi install pi-prompt-composer` after the first release merge.
- **SC-003**: The CI pipeline runs typecheck, lint, and all 65+ tests before every release. No release proceeds with failing checks.
- **SC-004**: The README includes at least one visual preview image that renders correctly on both GitHub and npm.
- **SC-005**: Every item in the manual test checklist passes against a live Pi session before the first publish.
- **SC-006**: The npm package listing shows correct homepage, repository, description, keywords, and license metadata.

## Assumptions

- npm OIDC trusted publishing is the preferred authentication method for CI publishing (no stored NPM_TOKEN). If the GitHub repo is not yet linked on npmjs.com, the maintainer will configure it manually before the first release.
- The preview script will use Pi's `ProcessTerminal` and TUI component APIs (from `@mariozechner/pi-tui`) to render frames, following the pattern established by `pi-tui-renderer/scripts/render-preview-capture.ts` and `pi-curated-themes/scripts/list-themes-tui.ts`.
- SVG is the preferred output format for the preview image because it renders crisply at any resolution and keeps the repo lightweight. PNG is acceptable as a fallback.
- The example prompt group will use a "review" theme (code review workflows) as the running example, consistent with the existing README prose.
- `examples/` will be added to the `files` array in `package.json` so that installed packages include the examples for easy copying.
