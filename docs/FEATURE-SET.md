# FEATURE SET

## Purpose

`pi-prompt-composer` makes prompt directories behave like grouped slash commands.

It should improve prompt organization without introducing a new prompt language, UI model, or command system.

## Core promise

Operators should be able to:

- organize prompts by folder
- invoke them as grouped slash commands
- open an interactive menu from bare `/command`
- provide missing prompt arguments through guided input
- keep using Pi-native prompt template behavior

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
- **Native compatibility first** — reuse Pi frontmatter, arg substitution, markdown rendering, and user-message delivery.
- **Add structure, not complexity** — improve organization and invocation without becoming a general command framework.
- **Predictable behavior** — preserve scope and fail clearly when a command is incomplete or unknown.

## Priorities

### Priority 1: Core grouped prompt routing

1.1 **Folder-to-command grouping** — A prompt directory becomes one slash command group.

1.2 **File-to-subcommand mapping** — Markdown files inside the directory become subcommands.

1.3 **Interactive bare command menu** — Bare `/command` opens a menu where each nested prompt is an option.

1.4 **Guided argument collection** — If a prompt is missing required arguments, the extension asks for them and waits before expansion.

1.5 **Pi-native prompt compatibility** — Frontmatter, args, markdown, and message delivery stay Pi-compatible.

1.6 **Coexistence with flat prompts** — Native flat `.md` prompts keep working unchanged.

### Priority 2: Discoverability and operator UX

2.1 **Subcommand autocomplete** — `/command <tab>` shows available subcommands.

2.2 **Useful command descriptions** — Prefer metadata from `_index.md`.

2.3 **Helpful error handling** — Unknown subcommands and missing defaults should guide the operator.

2.4 **Correct scope attribution** — Commands preserve whether they come from user or project prompts.

### Priority 3: Reliability and runtime behavior

3.1 **Prompt directory scanning** — Discover grouped prompt directories from supported prompt roots.

3.2 **Reload-aware re-scan** — Refresh command state on reload.

3.3 **Deterministic conflict handling** — Command precedence must be explicit and predictable.

### Priority 4: Documentation and adoption

4.1 **Clear directory convention docs** — Explain folders, subcommands, menu behavior, and guided input.

4.2 **Example grouped prompts** — Include at least one realistic command group.

4.3 **Authoring guidance** — Separate Pi-native behavior from package-specific behavior.

## Non-goals for the first version

Keep these out of scope:

- deep multi-level nesting such as `/a b c`
- aliases or alternate command names
- custom syntax beyond Pi prompt-template behavior
- prompt inheritance across directories
- dynamic generated subcommands
- grouped-prompt-specific permission systems

## Roadmap guidance

Implement these phases in order:

1. **Core routing**
2. **UX and discoverability**
3. **Reliability and runtime correctness**
4. **Documentation and examples**

A first useful release is done when grouped prompts route correctly, bare commands open a usable menu, missing arguments are collected interactively, the result feels native, scope is preserved, and the behavior is documented clearly.
