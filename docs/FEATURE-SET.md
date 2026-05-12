# FEATURE SET

## Purpose

`pi-prompt-composer` makes prompt directories behave like grouped slash commands while preserving Pi's existing prompt-template semantics where Pi already defines them.

It should improve prompt organization and authoring power without replacing Pi's prompt model with a separate command framework or opaque template engine.

## Core promise

Operators should be able to:

- create single-file composer prompts under `.pi/composed/`
- organize related prompts by folder under `.pi/composed/`
- invoke them as flat or grouped slash commands
- open an interactive menu from bare `/command`
- provide missing prompt arguments through guided input
- keep Pi-native frontmatter and argument semantics when using `engine: pi`
- opt into Liquid rendering for conditionals, loops, data shaping, JSON snippets, XML-style prompt blocks, frontmatter variables, prompt-local partials, safe command-batch text, and opt-in shell execution
- see every rendered prompt as normal visible user-message content before the agent responds

Example:

```text
.pi/composed/
├── workspace.md
├── review.md
└── superset/
    ├── _index.md
    ├── create.md
    ├── list.md
    └── tasks.md
```

Expected behavior:

- `.pi/composed/workspace.md` becomes composer-owned `/workspace`
- `.pi/composed/review.md` becomes composer-owned `/review`
- `.pi/composed/superset/create.md` becomes `/superset create`
- `.pi/composed/superset/list.md` becomes `/superset list`
- `/superset` opens an interactive menu for the nested prompts
- native Pi prompts under `.pi/prompts/*.md` remain native and are not composer-owned

## Design principles

- **Minimal mental model** — a prompt folder becomes a command group.
- **Pi-native semantics first** — reuse Pi frontmatter parsing, argument parsing, substitution, Markdown delivery, and prompt authoring conventions before adding package-owned behavior.
- **Explicit layering** — keep Pi-native rendering and package-native preprocessing as separate stages.
- **Visible rendering** — the operator should see the final expanded prompt text in the conversation, including preprocessing results.
- **Add structure where it helps** — grouped routing for related prompts, flat files for one-off commands, Liquid only when prompt logic earns it.
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

### Layer 2: Liquid rendering and package-native helpers

This layer adds rendering features Pi does not provide natively, such as:

- named args with `{{ args.name }}`, plus `argv`, `arguments`, and `rest: true` for Pi-like rest args
- conditionals and loops
- declarative data shaping through Liquid built-ins like `where`, `map`, `join`, and `size`
- XML-style prompt blocks with `{% xml "tag" %}` that omit empty sections
- safe formatting helpers: `present`, `quote`, `tokens`, `json`, and `shell_quote`
- command-batch rendering as text for operator/model review
- frontmatter `variables` for static constants exposed as `{{ variables.name }}`
- prompt-local `_partials/` includes for repeated prompt snippets
- opt-in shell execution with `shell: ask` or `shell: allow`, plus configurable default shell mode
- fluent current validation through `required`, `type`, `values`, `default`, repeatable `string[]` named args, and `rest: true`
- static prompt validation via `prompts:validate`

These features belong to the package, not to Pi's native prompt-template contract. Shell execution is deny-by-default and treated as trusted code, not sandboxed code.

## Priorities

### Priority 1: Core composer prompt routing

1.1 **Location-based ownership** — Files under `.pi/composed/` and `~/.pi/agent/composed/` are composer-owned without `type` markers.

1.2 **Flat file commands** — A `.md` file directly under a composed root becomes one slash command.

1.3 **Folder-to-command grouping** — A composed prompt directory with `_index.md` becomes one slash command group.

1.4 **File-to-subcommand mapping** — Markdown files inside a group directory become subcommands.

1.5 **Interactive bare command menu** — Bare `/command` opens a menu where each nested prompt is an option.

1.6 **Guided argument collection** — If a prompt is missing required arguments, the extension asks for them and waits before rendering. Args parsing is lenient: missing `hint` defaults to empty, missing `required` defaults to `false`.

1.7 **Pi-native prompt compatibility** — `engine: pi` preserves Pi-style argument parsing, substitution, Markdown rendering, and user-message delivery.

1.8 **Coexistence with native prompts** — Native flat `.md` prompts under `prompts/` keep working unchanged.

### Priority 2: Discoverability and operator UX

2.1 **Subcommand autocomplete** — `/command <tab>` shows available subcommands.

2.2 **Useful command descriptions** — Prefer metadata from `_index.md`.

2.3 **Helpful error handling** — Unknown subcommands, incomplete commands, and preprocessing failures should guide the operator. Discovery warnings surface through Pi notifications on session start.

2.4 **Visible rendered output** — The final rendered prompt, not hidden intermediate instructions, should be what appears in the user message bubble.

2.5 **Internal scope awareness** — The package tracks whether grouped prompts come from user or project prompt roots and surfaces that in its own UI and diagnostics.

### Priority 3: Liquid rendering and prompt power

3.1 **Liquid engine opt-in** — `engine: liquid` renders prompts through LiquidJS with named args, `argv`, `arguments`, and `rest: true` support.

3.2 **Declarative prompt logic** — Support `if`, `for`, dynamic `assign`, `where`, `map`, `join`, `size`, `default`, and other safe Liquid built-ins. Static constants belong in frontmatter `variables`.

3.3 **Structured prompt blocks** — `{% xml "tag" %}` renders Claude Code skill-style XML blocks and omits empty bodies.

3.4 **Safe formatting helpers** — Ship `present`, `quote`, `tokens`, `json`, and `shell_quote` filters.

3.5 **Command-batch rendering and shell blocks** — Prompt authors can render shell command blocks with safe quoting; shell blocks render command text unless prompt frontmatter or config opts into bounded execution.

3.6 **Configurable shell mode** — `shell: deny|ask|allow` frontmatter controls each prompt; `prompt-composer.json` can set a user or project default.

3.7 **Fluent current validation** — Prompt args can use `required`, `type`, `values`, `default`, repeatable `string[]` values, and `rest: true`. Unsupported semantic validation belongs in explicit prompt-body checks until declarative `validate:` exists.

3.8 **Golden fixture coverage** — Templating examples are captured in `examples/templating/` and verified byte-for-byte by tests.

3.9 **Prompt validation** — `pnpm run prompts:validate` validates grouped indexes, frontmatter, args, variables, Liquid syntax, partial includes, shell policy, and common unsafe shell anti-patterns.

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

### Priority 6: Operator-only prompts

6.1 **Operator-only dispatch mode** — A frontmatter flag opts a grouped prompt out of model dispatch; the rendered result is shown only to the operator.

6.2 **Full pipeline for operator-only prompts** — Argument collection, substitution, and shell preprocessing run the same way; only the final dispatch target changes.

6.3 **Unified discovery** — Operator-only prompts appear in menus, autocomplete, and diagnostics alongside regular grouped prompts.

## Non-goals for the first version

Keep these out of scope:

- deep multi-level nesting such as `/a b c`
- aliases or alternate command names
- pretending grouped commands are native Pi prompt commands inside Pi's internal command metadata
- arbitrary JavaScript or unbounded template execution
- hidden preprocessing that the operator cannot inspect after dispatch
- cross-directory prompt inheritance
- dynamic generated subcommands
- grouped-prompt-specific permission systems
- arbitrary unbounded shell command execution from Liquid templates

## Roadmap guidance

Implement these phases in order:

1. **Core routing**
2. **Argument collection and operator UX**
3. **Preprocessing pipeline**
4. **Runtime correctness and diagnostics**
5. **Documentation and examples**

A first useful release is done when grouped prompts route correctly, flat composer prompts work under `composed/`, bare commands open a usable menu, missing arguments are collected interactively, Pi-native argument semantics are preserved, Liquid templating renders powerful structured prompt output safely, the operator can see the final rendered prompt in the conversation history, and the known Pi API limitations are documented clearly.
