# FEATURE SET

## Purpose

`pi-prompt-composer` makes prompt directories behave like grouped slash commands while preserving Pi's existing prompt-template semantics where Pi already defines them.

It should improve prompt organization and authoring power without replacing Pi's prompt model with a separate command framework or opaque template engine.

## Core promise

Operators should be able to:

- organize prompts by folder
- invoke them as grouped slash commands
- open an interactive menu from bare `/command`
- provide missing prompt arguments through guided input
- keep Pi-native frontmatter and argument semantics
- opt into package-native preprocessing features that render before dispatch and remain fully visible in the resulting user message

Example:

```text
prompts/
├── workspace.md
├── superset/
│   ├── _index.md
│   ├── create.md
│   ├── list.md
│   └── tasks.md
```

Expected behavior:

- `workspace.md` stays native Pi `/workspace`
- `superset/create.md` becomes `/superset create`
- `superset/list.md` becomes `/superset list`
- `/superset` opens an interactive menu for the nested prompts

## Design principles

- **Minimal mental model** — a prompt folder becomes a command group.
- **Pi-native semantics first** — reuse Pi frontmatter parsing, argument parsing, substitution, Markdown delivery, and prompt authoring conventions before adding package-owned behavior.
- **Explicit layering** — keep Pi-native rendering and package-native preprocessing as separate stages.
- **Visible rendering** — the operator should see the final expanded prompt text in the conversation, including preprocessing results.
- **Add structure, not a new language** — improve organization and rendering power without jumping immediately to a large programmable template system.
- **Predictable behavior** — command precedence, missing-argument handling, and preprocessing failures must be explicit.

## Product model

The package owns two layers of behavior.

### Layer 1: grouped routing with Pi-native prompt semantics

This layer should preserve Pi behavior for:

- frontmatter parsing
- description fallback
- argument parsing
- positional and slice substitution
- final Markdown delivery as a user message

### Layer 2: package-native preprocessing

This layer adds rendering features Pi does not provide natively, such as:

- inline shell command substitution inside prompt bodies
- future conditional rendering
- future explicit render-time variables or supporting-file patterns

These features belong to the package, not to Pi's native prompt-template contract.

## Priorities

### Priority 1: Core grouped prompt routing

1.1 **Folder-to-command grouping** — A prompt directory becomes one slash command group.

1.2 **File-to-subcommand mapping** — Markdown files inside the directory become subcommands.

1.3 **Interactive bare command menu** — Bare `/command` opens a menu where each nested prompt is an option.

1.4 **Guided argument collection** — If a prompt is missing required arguments, the extension asks for them and waits before rendering. **Known limitation**: args metadata validation is currently too strict — a single incomplete item (e.g., missing `hint`) silently drops the entire args array, preventing interactive collection. See [`ISSUES.md`](ISSUES.md) ISS-001. Fix is tracked as PPC-009 (high priority).

1.5 **Pi-native prompt compatibility** — Frontmatter, argument parsing, substitution, Markdown rendering, and user-message delivery stay Pi-native.

1.6 **Coexistence with flat prompts** — Native flat `.md` prompts keep working unchanged.

### Priority 2: Discoverability and operator UX

2.1 **Subcommand autocomplete** — `/command <tab>` shows available subcommands.

2.2 **Useful command descriptions** — Prefer metadata from `_index.md`.

2.3 **Helpful error handling** — Unknown subcommands, incomplete commands, and preprocessing failures should guide the operator. **Known limitation**: discovery warnings (malformed metadata, missing descriptions) currently go to `console.warn` only, not Pi's UI. See [`ISSUES.md`](ISSUES.md) ISS-002. Fix is tracked as PPC-009.

2.4 **Visible rendered output** — The final rendered prompt, not hidden intermediate instructions, should be what appears in the user message bubble.

2.5 **Internal scope awareness** — The package tracks whether grouped prompts come from user or project prompt roots and surfaces that in its own UI and diagnostics.

### Priority 3: Package-native preprocessing

3.1 **Prompt-body shell substitution** — Support inline shell command substitution inside grouped prompt bodies.

3.2 **Deterministic render order** — Pi-native argument substitution happens before package-native preprocessing.

3.3 **Visible preprocessing results** — Preprocessing output is rendered into the final message sent to the agent.

3.4 **Future render-stage extensibility** — Leave room for later conditional rendering without committing to a large template language in v1.

### Priority 4: Reliability and runtime behavior

4.1 **Prompt directory scanning** — Discover grouped prompt directories from supported prompt roots.

4.2 **Reload-aware re-scan** — Refresh command state on reload.

4.3 **Deterministic conflict handling** — Command precedence must be explicit and predictable.

4.4 **Documented API limits** — Public Pi API constraints must be documented rather than hidden behind misleading behavior claims.

### Priority 5: Documentation and adoption

5.1 **Clear directory convention docs** — Explain folders, subcommands, menu behavior, guided input, and preprocessing stages.

5.2 **Example grouped prompts** — Include at least one realistic command group.

5.3 **Authoring guidance** — Distinguish Pi-native behavior from package-specific preprocessing behavior.

## Known platform constraints

These constraints shape the package design.

1. **Grouped commands must be extension commands** — Pi prompt discovery is non-recursive, so nested prompt groups cannot be implemented as native prompt templates.
2. **Grouped dispatch is native-like, not identical to native `/template` execution** — the package can faithfully reuse Pi parsing and substitution helpers, but final dispatch happens through extension-driven user-message sending.
3. **Extension commands cannot override `sourceInfo`** — Pi's public `registerCommand()` API does not allow per-command source metadata, so grouped commands will appear as extension commands in Pi's built-in command inventory.

## Non-goals for the first version

Keep these out of scope:

- deep multi-level nesting such as `/a b c`
- aliases or alternate command names
- pretending grouped commands are native Pi prompt commands inside Pi's internal command metadata
- a large custom template language in v1
- hidden preprocessing that the operator cannot inspect after dispatch
- prompt inheritance across directories
- dynamic generated subcommands
- grouped-prompt-specific permission systems

## Roadmap guidance

Implement these phases in order:

1. **Core routing**
2. **Argument collection and operator UX**
3. **Preprocessing pipeline**
4. **Runtime correctness and diagnostics**
5. **Documentation and examples**

A first useful release is done when grouped prompts route correctly, bare commands open a usable menu, missing arguments are collected interactively, Pi-native argument semantics are preserved, prompt-body shell substitution works, the operator can see the final rendered prompt in the conversation history, and the known Pi API limitations are documented clearly.
