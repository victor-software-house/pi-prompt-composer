# Research: Core Grouped Prompt Routing

## Decision 1: Build grouped discovery directly in `extensions/index.ts`, reimplementing Pi's internal helpers locally

- **Decision**: Implement first-level directory scanning and prompt-file loading in `extensions/index.ts`. Import `parseFrontmatter()` and `getAgentDir()` from `@mariozechner/pi-coding-agent` (the only relevant public exports). Reimplement `parseCommandArgs()` and `substituteArgs()` locally as near-verbatim copies of Pi's internal implementations, with source-reference comments. Derive prompt roots from `getAgentDir() + '/prompts'` and `process.cwd() + '/.pi/prompts'` since `getPromptsDir()` and `CONFIG_DIR_NAME` are not publicly exported.
- **Rationale**:
  - The repository currently has a single runtime entrypoint: `extensions/index.ts`.
  - Only `parseFrontmatter`, `stripFrontmatter`, and `getAgentDir` are exported from `@mariozechner/pi-coding-agent@0.64.0`. The helpers `parseCommandArgs`, `substituteArgs`, `getPromptsDir`, `CONFIG_DIR_NAME`, `loadPromptTemplates`, and `expandPromptTemplate` are internal to `core/prompt-templates.js` and `config.js` respectively.
  - Pi's own prompt-template loader uses straightforward filesystem access and non-recursive scanning, which matches this feature's limited scope.
  - The `@ifi/pi-spec` extension (a production Pi extension) follows the same pattern: it imports only public types and APIs, does its own tokenization, and calls `pi.sendUserMessage()` for dispatch.
- **Source references for reimplemented helpers**:
  - `parseCommandArgs`: `@mariozechner/pi-coding-agent@0.64.0` — `packages/coding-agent/src/core/prompt-templates.ts` ([GitHub: badlogic/pi-mono](https://github.com/badlogic/pi-mono))
  - `substituteArgs`: same module, same version
  - `CONFIG_DIR_NAME` (`.pi`): `@mariozechner/pi-coding-agent@0.64.0` — `packages/coding-agent/src/config.ts`
- **Future extraction**: These reimplemented helpers are candidates for a shared `pi-provider-utils` package (public on npm) to avoid duplication across Pi extension packages. Until that package exists, keep the local copies with clear provenance comments so extraction is mechanical.
- **Alternatives considered**:
  - **Use `loadPromptTemplates()` directly**: rejected because it only loads flat `.md` templates and does not expose grouped directory semantics.
  - **Import non-public Pi internals via deep subpath**: rejected because deep imports into `dist/core/` are fragile, undocumented, and may break across Pi versions.
  - **Create a new `src/` runtime module for the first slice**: rejected because the repo is scaffold-first and the requested slice fits in the current entrypoint.

## Decision 2: Treat only first-level directories with at least one runnable nested prompt as groups

- **Decision**: A grouped prompt candidate is a first-level directory under `~/.pi/agent/prompts` or `<cwd>/.pi/prompts` that contains at least one `.md` file other than `_index.md`. Non-markdown files are ignored. Deeper nested directories are ignored for this slice.
- **Rationale**:
  - This matches the feature's explicit one-level scope: `/group subcommand` only.
  - It resolves checklist ambiguity around empty or mixed-content directories.
  - It keeps flat `.md` files outside grouped routing so Pi-native prompt behavior remains unchanged.
- **Alternatives considered**:
  - **Treat `_index.md` alone as enough to create a runnable group**: rejected because the spec defines `_index.md` as descriptive or fallback content, not a nested runnable prompt.
  - **Error on non-markdown files or nested directories**: rejected for the first slice because ignoring unsupported content is simpler and predictable.
  - **Allow deeper nested directories**: rejected because deeper nesting is an explicit non-goal.

## Decision 3: Warn on duplicate group names, do not enforce precedence

- **Decision**: When the same group name exists in both prompt roots, warn about the conflict but do not enforce package-owned precedence. Pi's own command registration order determines which wins. Scope metadata is preserved in the registry for diagnostics.
- **Rationale**:
  - Keeping precedence logic out of the package simplifies the implementation and avoids second-guessing Pi's own command resolution.
  - A warning gives the operator enough information to resolve the conflict themselves.
  - Cross-scope merging is still explicitly out of scope.
- **Alternatives considered**:
  - **Enforce project-over-user precedence**: rejected to keep the package simpler and avoid duplicating Pi's command resolution.
  - **Merge user and project groups with the same name**: rejected because merged behavior would blur scope ownership.
  - **Silently ignore duplicates**: rejected because operators need to know about the conflict.

## Decision 4: Lenient frontmatter with fallbacks and warnings; normalize subcommand names to lowercase kebab-case

- **Decision**:
  - `_index.md` with `type: group` frontmatter is the hard gate for group recognition.
  - Group command names come from the first-level directory name.
  - Nested prompt subcommand names come from the markdown filename stem, normalized to lowercase kebab-case, or from an optional `name` frontmatter override.
  - `description` on `_index.md` is recommended; when missing, warn and fall back to the directory name.
  - `description` on nested prompts is recommended; when missing, warn and fall back to the filename stem.
  - `args` array on nested prompts is optional; when present, show argument hints; when absent, no hints and no warning; when present but malformed, warn and treat as absent.
  - Nested prompts are always registered — metadata issues never prevent registration, only degrade UX.
- **Rationale**:
  - `type: group` is a clear opt-in marker that prevents accidental group registration from arbitrary directories.
  - Lenient registration with warnings is simpler and more forgiving than skipping prompts for metadata issues.
  - Lowercase kebab-case normalization (FR-003a) provides consistent, predictable subcommand entry.
  - Warnings give prompt authors actionable feedback without breaking their workflow.
- **Alternatives considered**:
  - **Require frontmatter descriptions everywhere (skip on missing)**: rejected because it blocks registration for cosmetic metadata issues.
  - **Use raw filesystem stems without normalization**: rejected because the spec requires kebab-case normalization for operator-facing consistency.
  - **Treat `_index.md` as a runnable nested prompt**: rejected because it conflicts with the compatibility commitments.

## Decision 5: Use the built-in selector for bare `/group` and visible user-message dispatch for execution

- **Decision**:
  - Bare `/group` opens `ctx.ui.select()` with one item per nested prompt in the effective group.
  - `/group subcommand ...` parses the argument string with a local `parseCommandArgs()` (reimplemented from Pi internals); the first parsed token is the nested prompt name and the remaining tokens are prompt arguments.
  - The chosen prompt body is rendered with a local `substituteArgs()` (reimplemented from Pi internals) and dispatched with `pi.sendUserMessage()` so the operator sees the final rendered message.
  - If the agent is already streaming, dispatch should use `deliverAs: 'followUp'` to avoid `sendUserMessage()` throwing.
- **Rationale**:
  - `ctx.ui.select()` is the simplest public Pi UI for a first useful selector flow.
  - `pi.sendUserMessage()` is the public API that produces visible user-message content, which the spec requires.
  - `followUp` is safer than failing when the grouped command is invoked during streaming.
- **Alternatives considered**:
  - **Build a custom selector component**: rejected because the built-in selector is enough for the first slice.
  - **Dispatch via `pi.sendMessage()` or hidden extension messages**: rejected because the operator must see the rendered prompt content.
  - **Reject grouped commands while streaming**: rejected because follow-up delivery better matches user expectations for queued interaction.

## Decision 6: Unknown-subcommand and unsupported-layout behavior should guide without overreaching

- **Decision**:
  - Unknown subcommands produce an error notification that includes the list of available nested prompt names.
  - Unsupported deeper directories and non-markdown files are ignored rather than surfaced as blocking errors.
  - Directories whose winning effective group has no runnable nested prompts are not registered.
- **Rationale**:
  - This satisfies the spec's requirement for helpful corrective feedback.
  - It keeps the first slice focused on usable grouped routing instead of author diagnostics.
  - It avoids exposing partially implemented layouts as broken commands.
- **Alternatives considered**:
  - **Hard-fail registry construction on unsupported files**: rejected because it would make unrelated prompt content more fragile.
  - **Register empty groups and show only `_index.md`**: rejected because it creates commands that cannot complete the core routing task.
  - **Silently ignore unknown subcommands with no feedback**: rejected because the spec requires visible alternatives.
