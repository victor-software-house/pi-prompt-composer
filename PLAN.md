# PLAN

## Feature: Bundled `/compose` helpers + comprehensive grouped-prompt authoring skill

## 1. Goal

Add a package-owned, built-in `/compose` grouped command that helps operators create and maintain grouped prompts, backed by a comprehensive skill with progressive disclosure.

This feature should let the package ship its own authoring assistance without depending on Pi-native prompt discovery for nested grouped commands.

## 2. Desired end state

When this work is complete:

1. the package ships a comprehensive skill for grouped-prompt authoring
2. the package ships a bundled `/compose` grouped command
3. `/compose` is loaded by `pi-prompt-composer` itself, not by Pi's native flat prompt-template loader
4. bundled `/compose` is registered first
5. user and project `/compose` groups discovered later can override the bundled one within the same extension
6. bundled prompt content lives in real `.md` files, not inline TypeScript strings
7. the skill provides the detailed workflow, references, and clarification behavior
8. the `/compose` prompts stay narrow and operational, pointing the model toward concrete actions and references

## 3. Top-level plan

### Phase 1 — Confirm and encode the runtime model

Establish the exact runtime and command-resolution assumptions in code and docs so the bundled feature is built on verified Pi behavior.

### Phase 2 — Add the comprehensive skill first

Create the full grouped-prompt authoring skill with progressive disclosure, references, and explicit clarification/interaction rules.

### Phase 3 — Add bundled `/compose` prompt assets

Create package-owned grouped prompt files under a bundled `compose/` directory. Keep them focused on concrete grouped-prompt operations.

### Phase 4 — Refactor discovery to support ordered roots cleanly

Adjust discovery so it can load both:
- ordinary prompt roots that contain many group directories
- exact group roots like the bundled `compose/` directory

### Phase 5 — Register bundled roots before dynamic roots

Ensure bundled `/compose` is loaded first, then user/project roots, so later registrations in the same extension override earlier ones.

### Phase 6 — Verify runtime behavior and document operator-facing usage

Validate the feature end-to-end, then document how the bundled skill and `/compose` command are intended to work together.

---

## 4. Verified constraints and assumptions

These are grounded in Pi source and docs already inspected during planning.

### 4.1 Extension command execution order

Pi executes extension commands before skill and native prompt-template expansion.

Evidence:
- `@mariozechner/pi-coding-agent/dist/core/agent-session.js`
- `prompt()` calls `_tryExecuteExtensionCommand()` before skill/template expansion

### 4.2 Duplicate extension commands across extensions do not override

Pi disambiguates duplicate command names across extensions instead of letting one override another.

Evidence:
- `@mariozechner/pi-coding-agent/dist/core/extensions/runner.js`
- `resolveRegisteredCommands()` assigns unique invocation names like `name:1`, `name:2`

### 4.3 Duplicate command names inside one extension overwrite by registration order

Within a single extension, command names are stored in a `Map`, so later `registerCommand(name, ...)` calls replace earlier ones.

Evidence:
- `@mariozechner/pi-coding-agent/dist/core/extensions/loader.js`
- `extension.commands.set(name, ...)`

### 4.4 Pi-native package prompt discovery is flat and unsuitable for grouped bundled prompts

Pi package prompt discovery is non-recursive and intended for flat templates, not grouped nested commands.

Evidence:
- `docs/prompt-templates.md`
- grouped routing in this package already exists because Pi does not natively support grouped nested prompt discovery

### 4.5 Relative file loading must use standard ESM paths

`import.meta.dir` is runtime-specific. The portable solution is `new URL(..., import.meta.url)` plus `fileURLToPath()`.

## 5. Product shape

## 5.1 Primary artifact: skill

The comprehensive skill is the primary authoring surface.

It should own:
- full workflow guidance
- clarifying-question logic
- ask-user payloads and fallbacks
- grouped-prompt conventions
- operational playbooks
- references and examples

The skill should be loaded on demand and keep detailed material in `references/`.

## 5.2 Secondary artifact: bundled `/compose` grouped command

The bundled `/compose` command is a focused operational surface layered on top of the skill.

It should provide narrow entrypoints for common grouped-prompt operations.

Initial operations:
- `/compose new`
- `/compose add`
- `/compose remove`

Optional follow-up operations after the first slice:
- `/compose migrate`
- `/compose refs`

## 5.3 Relationship between skill and prompts

The division of responsibility should be:

### Skill
- deep guidance
- progressive disclosure
- workflow branching
- clarifications
- conventions and trade-offs
- examples and references

### `/compose` prompts
- specific operations
- concise task framing
- reminders of required output shape
- references back to the skill when deeper guidance is needed

The prompts should not try to duplicate the entire skill.

---

## 6. Architecture plan

## 6.1 Root registry model

Use a single ordered registry of roots.

A root may be either:
- a parent prompt root that contains grouped prompt directories
- an exact grouped prompt directory itself

This keeps one abstraction instead of splitting into separate `rootDirs` and `groupDirs`.

### Proposed shape

```ts
type PromptOrigin = 'bundled' | 'user' | 'project';

interface PromptRoot {
  origin: PromptOrigin;
  rootPath: string;
}
```

### Ordered root list

The loader should build roots in this order:

1. bundled exact `/compose` root
2. user prompt root (`~/.pi/agent/prompts`)
3. project prompt root (`.pi/prompts`)

This order is critical because later command registration within the same extension overrides earlier registration.

## 6.2 Discovery behavior

Discovery should support two cases for every configured root:

### Case A — root is itself a grouped prompt directory

If the root contains `_index.md` with `type: group`, treat the root as exactly one grouped command.

This is how the bundled `compose/` directory should load.

### Case B — root is a parent prompt directory

If the root is not itself a grouped prompt directory, scan its immediate child directories and load any valid grouped prompt directories.

This preserves current user/project behavior.

## 6.3 Registration behavior

Registration should happen from the discovered groups list in root order.

Expected effective precedence:
- project overrides user
- user overrides bundled

This should apply naturally through registration order within the same extension rather than through a second custom precedence layer.

## 6.4 Asset loading

Bundled paths should be resolved with a helper like:

```ts
function resolveRelativePath(relativePath: string): string {
  return fileURLToPath(new URL(relativePath, import.meta.url));
}
```

This helper should be used to resolve:
- bundled prompt directory path
- any other package-owned asset path added later

---

## 7. Skill plan

## 7.1 Skill directory

Create a skill directory similar in style to the spec-kit setup skill.

### Proposed location

```text
skills/compose-grouped-prompts/
  SKILL.md
  references/
    workflow.md
    layout.md
    naming.md
    args-and-frontmatter.md
    operations.md
    examples.md
```

## 7.2 Skill responsibilities

The skill should help the model decide:
- whether grouped prompts are the right mechanism
- whether to create a new group or modify an existing one
- how to name the group and subcommands
- when to ask clarifying questions before generating files
- how to structure `_index.md`
- when `args` metadata is useful versus unnecessary
- how to remove or simplify subcommands without leaving drift behind

## 7.3 Progressive disclosure structure

### `SKILL.md` should include
- what the skill does
- when to use it
- a compact workflow map
- required first checks
- exact ask-user behavior
- stop conditions
- reference map

### `references/` should include
- detailed conventions
- grouped layout patterns
- examples and anti-patterns
- add/remove/migrate playbooks
- frontmatter and args guidance

## 7.4 Interaction model

The skill must explicitly define:

### If `ask_user` is available
Use structured `ask_user` calls for:
- choosing operation mode when ambiguous
- resolving naming conflicts
- confirming removals or restructures
- deciding between multiple valid shapes

### If `ask_user` is not available
Ask directly in chat using the same decision structure.

The skill should not assume `ask_user` always exists.

## 7.5 Skill workflows

The initial skill should cover at least these workflows:

### Workflow A — Create a new grouped prompt set
- gather purpose and target users
- choose group name
- choose 2–N subcommands
- define `_index.md`
- generate file set
- verify naming and overlap

### Workflow B — Add subcommands to an existing group
- inspect current group
- identify gaps or overlap
- propose focused additions
- generate files
- verify consistency with existing style

### Workflow C — Remove a subcommand or simplify a group
- inspect current group
- determine whether to delete, merge, or deprecate
- confirm impact
- update neighboring prompts if references change

### Workflow D — Reference/help mode
- answer questions about grouped prompt conventions
- explain file layout and authoring rules
- help the user choose between grouped prompts, skills, and flat prompts

---

## 8. Bundled `/compose` prompt plan

## 8.1 Directory layout

Create bundled prompt assets as real markdown files.

### Proposed layout

```text
prompts/
  compose/
    _index.md
    new.md
    add.md
    remove.md
```

These should ship in the package but should not be declared as native Pi flat prompts.

## 8.2 Prompt design rules

Each bundled `/compose` prompt should:
- focus on one operation
- stay relatively short
- assume the comprehensive skill exists
- refer to grouped-prompt conventions precisely
- request file-by-file output when generation is needed
- avoid trying to embed the whole reference manual

## 8.3 Prompt responsibilities

### `_index.md`
- define `type: group`
- provide concise description of `/compose`

### `new.md`
- create a new grouped prompt set
- ask for file tree and full file bodies
- emphasize focused subcommands

### `add.md`
- add one or more subcommands to an existing group
- preserve style and consistency
- avoid overlap

### `remove.md`
- remove or simplify a subcommand safely
- account for neighboring prompts and references
- prefer minimal necessary edits

## 8.4 Prompt and skill coupling

The prompts should be usable alone, but they should be designed to work best when the agent also uses the comprehensive skill.

That means:
- the prompt should be operationally complete enough to run
- the skill should provide the detailed decision framework behind the prompt

---

## 9. Code changes plan

## 9.1 Discovery refactor

Refactor discovery into smaller units.

### Step 1
Extract a helper that loads one grouped prompt directory.

Responsibilities:
- read `_index.md`
- verify `type: group`
- read nested `.md` prompt files
- parse frontmatter
- collect args metadata
- return `EffectivePromptGroup | undefined`

### Step 2
Update root discovery logic so each configured root is handled as:
- exact grouped root if the root itself is valid
- otherwise parent root whose child directories are scanned

### Step 3
Preserve current warning behavior for malformed groups and duplicate names.

## 9.2 Root ordering

Replace the current `getPromptRoots()` implementation with an ordered root list builder.

It should:
1. resolve bundled `compose/` path first
2. append user prompt root if present
3. append project prompt root if present

## 9.3 Naming model

Rename `PromptScope` to something origin-oriented if the change improves clarity.

Preferred candidate:

```ts
type PromptOrigin = 'bundled' | 'user' | 'project';
```

This is cleaner because bundled is an origin/source concept, not a user/project scope concept.

## 9.4 Packaging changes

Ensure the published package includes:
- `prompts/`
- `skills/`

Likely `package.json` update:
- include both directories in `files`

Do not add bundled `prompts/compose` to native Pi prompt discovery config.

---

## 10. Verification plan

## 10.1 Static verification

Run:

```bash
bun run typecheck
bun run lint
bun run test
```

## 10.2 Functional verification

Validate these behaviors:

### A. Bundled `/compose` exists when no custom `/compose` exists
Expected:
- `/compose` is registered
- bare `/compose` opens selector
- `/compose new`, `/compose add`, `/compose remove` dispatch correctly

### B. User or project `/compose` overrides bundled `/compose`
Expected:
- a later-discovered `/compose` replaces the bundled command inside the extension
- no extra custom precedence layer is required

### C. Non-compose groups still work
Expected:
- existing user/project grouped prompts behave unchanged

### D. Bundled assets are loadable in packaged form
Expected:
- extension resolves bundled paths successfully from installed package layout

### E. Skill is discovered and usable
Expected:
- bundled skill appears in Pi skill inventory
- skill references resolve correctly relative to skill base directory

## 10.3 Manual validation targets

Manual checks should include:
- `/compose`
- `/compose new`
- `/compose add`
- `/compose remove`
- `/skill:compose-grouped-prompts`
- custom override scenario with user/project `/compose`
- reload behavior after adding/removing custom `/compose`

---

## 11. Documentation plan

Update docs only after the implementation shape is stable.

## 11.1 README

Add:
- built-in `/compose` overview
- distinction between bundled compose helpers and user-authored grouped prompts
- how bundled `/compose` can be overridden by custom prompts
- mention of the comprehensive skill

## 11.2 FEATURE-SET / ROADMAP / IMPLEMENTATION-PLAN

Update only where needed to reflect:
- bundled `/compose` helpers
- comprehensive skill as first-class support
- override behavior and ordered root loading

## 11.3 Manual testing doc

Add exact operator validation steps for:
- bundled `/compose`
- custom override
- skill loading

---

## 12. Risks and design checks

## 12.1 Risk: bundled prompts accidentally become native flat prompts

Mitigation:
- do not add bundled `compose/` to native Pi `pi.prompts`
- treat bundled prompt files as extension-owned assets only

## 12.2 Risk: override behavior differs from expectation

Mitigation:
- rely on verified same-extension `Map.set()` behavior
- keep bundled registration before dynamic registration
- add tests or explicit manual verification for override order

## 12.3 Risk: skill becomes too large or repetitive

Mitigation:
- keep `SKILL.md` operational and compact
- push heavy detail into `references/`
- keep prompts narrow and avoid duplicating the full skill in each prompt

## 12.4 Risk: removal workflow becomes destructive or underspecified

Mitigation:
- make `remove` workflow inspect neighboring files and references
- require confirmation behavior in the skill when the change is ambiguous or high-impact

---

## 13. Execution order

Implement in this exact order:

1. create `PLAN.md`
2. add the comprehensive skill and references
3. add bundled `/compose` markdown assets
4. refactor discovery for exact grouped roots + ordered roots
5. wire bundled root before user/project roots
6. update package shipping config
7. run verification
8. update docs

---

## 14. Definition of done

This slice is done when:

1. the repo ships a comprehensive grouped-prompt authoring skill
2. the repo ships bundled `/compose new|add|remove` prompt files
3. the extension loads bundled `/compose` from package-owned markdown assets
4. bundled `/compose` is overridden by user/project `/compose` through later registration in the same extension
5. typecheck, lint, and tests pass
6. runtime behavior is manually validated
7. README and relevant docs explain the feature clearly
