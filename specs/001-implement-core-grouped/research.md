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

## Decision 3: Use deterministic precedence rules without merging scopes

- **Decision**: Resolve duplicate group names by selecting the project-scoped group over the user-scoped group. Keep the winning group's scope metadata in the registry and in package-owned UX. Do not merge nested prompts from both scopes into one effective group.
- **Rationale**:
  - The spec already assumes project-local behavior should win inside the active repository.
  - A single winner is easier to reason about than a cross-scope merge.
  - Pi already gives extension commands precedence over flat prompt templates because extension commands execute before prompt-template expansion.
- **Alternatives considered**:
  - **Merge user and project groups with the same name**: rejected because merged behavior would blur scope ownership and complicate diagnostics.
  - **Prefer user scope over project scope**: rejected because it makes repository-local prompt behavior harder to override intentionally.
  - **Expose two commands for the same group name**: rejected because the spec requires one effective operator-visible grouped command.

## Decision 4: Derive descriptions and names with Pi-compatible fallback rules

- **Decision**:
  - Group command names come from the first-level directory name.
  - Nested prompt names come from the markdown filename stem.
  - `_index.md` provides the group description by `frontmatter.description`, then first non-empty body line, then the directory name.
  - Nested prompts use the same fallback pattern: `frontmatter.description`, then first non-empty body line, then the filename stem.
  - No extra normalization is added in this slice.
- **Rationale**:
  - Pi's prompt-template loader already uses this description fallback model.
  - Avoiding custom normalization keeps the first slice predictable and easy to document.
  - Using raw filesystem stems preserves author control and avoids inventing a second naming layer.
- **Alternatives considered**:
  - **Require frontmatter descriptions everywhere**: rejected because the spec explicitly allows fallback behavior.
  - **Slugify or lowercase names automatically**: rejected because that diverges from current Pi filename semantics and would require extra migration rules.
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
