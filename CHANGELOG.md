## [1.0.3](https://github.com/victor-software-house/pi-prompt-composer/compare/v1.0.2...v1.0.3) (2026-04-02)


### Bug Fixes

* use YAML block scalar for skill description to preserve quotes and colons ([d69e745](https://github.com/victor-software-house/pi-prompt-composer/commit/d69e745149f8308609da5019c858ee6fd77180ea))

## [1.0.2](https://github.com/victor-software-house/pi-prompt-composer/compare/v1.0.1...v1.0.2) (2026-04-02)


### Bug Fixes

* remove name from skill frontmatter and fix YAML parsing error ([1155b3f](https://github.com/victor-software-house/pi-prompt-composer/commit/1155b3f840f7b1bfa5df36bd2afe944aa5de74df))

## [1.0.1](https://github.com/victor-software-house/pi-prompt-composer/compare/v1.0.0...v1.0.1) (2026-04-02)


### Bug Fixes

* add required YAML frontmatter to compose-grouped-prompts skill ([b014104](https://github.com/victor-software-house/pi-prompt-composer/commit/b014104eeca3fdce41e265218b794defbf6bb39b))

# [1.0.0](https://github.com/victor-software-house/pi-prompt-composer/compare/v0.1.1...v1.0.0) (2026-04-02)


### Features

* bundled /compose command and grouped-prompt authoring skill ([#4](https://github.com/victor-software-house/pi-prompt-composer/issues/4)) ([8fd4bce](https://github.com/victor-software-house/pi-prompt-composer/commit/8fd4bce0e0026ae9774ec685d80bdbe1f4aaad86))


### BREAKING CHANGES

* PromptScope type is renamed to PromptOrigin with values
'bundled' | 'user' | 'project'. PromptRoot, NestedPrompt, and
EffectivePromptGroup now use 'origin' instead of 'scope'.

Discovery changes:
- Extract loadSingleGroup() helper for loading a single group directory
- discoverGroups() now handles two root types:
  Case A: root itself is a grouped prompt directory (_index.md with type: group)
  Case B: root is a parent directory whose children are scanned (existing behavior)
- Add resolveRelativePath() using import.meta.url for portable asset resolution
- getPromptRoots() now builds an ordered root list:
  1. bundled compose/ (lowest precedence)
  2. user prompts
  3. project prompts (highest precedence)
- Duplicate group warning now references 'origins' instead of 'scopes'

All 75 existing tests updated and passing.

* test: add tests for exact group roots, bundled origin, and loadSingleGroup

New tests:
- T028: exact group root (Case A) loads root as single group
- T028: root with wrong type falls through to Case B (parent scan)
- T029: bundled root loaded first, user root produces duplicate warning
- T030: loadSingleGroup helper validates valid/invalid/empty groups
- T031: resolveRelativePath resolves from source file location

Also:
- Register skills/ in pi config section of package.json
- Add prompts/ and skills/ to package.json files array

83 tests passing (8 new).

* docs: document bundled /compose command, skill, and ordered root model

README:
- Add bundled /compose command table with new|add|remove
- Add authoring skill description
- Add features table entries for bundled compose and skill
- Explain override behavior (user/project overrides bundled)

ROADMAP:
- Add PPC-012 as complete with all acceptance criteria checked
- Update PPC-001 to reference origin instead of scope

IMPLEMENTATION-PLAN:
- Update scanner section with ordered root list and Case A/B model
- Add bundled origin to scope/diagnostics section
- Document Map.set() override semantics for precedence

* fix: redesign /compose prompts with proper args and ask_user interaction

The previous prompts were vague instructions that told the model to
'figure it out'. Now each prompt:

- Has a trailing 'description' arg using ${@:2} so operators can provide
  context inline: /compose new review A set of code review prompts
- Uses explicit ask_user JSON payloads with structured options for every
  decision the model can't make alone (scope, subcommand plan, removal
  approach)
- Has concrete step-by-step operational bodies that produce real output
- Checks for conflicts and references before acting
- Falls back to freeform ask_user when the optional description arg is
  not provided

remove.md also gains a 'subcommand' arg so operators can target directly:
  /compose remove review checklist

Modeled after the speckit-pi-setup skill's interaction patterns.

Also removes PLAN.md — all infrastructure goals are implemented and the
prompt content gap that the plan failed to prevent is now fixed.

* test: add comprehensive end-to-end tests for bundled /compose commands

New test file: test/bundled-compose.test.ts (17 tests)

Coverage:
- Registration: /compose exists, correct description, 3 subcommands in autocomplete
- /compose new:  substitution with group-name only, ${@:2} trailing
  description capture, quoted args, missing required arg collection
- /compose add:  substitution, ${@:2} trailing context, missing arg
  collection
- /compose remove:  substitution,  subcommand substitution (grep
  commands, confirm question), missing required arg collection
- Bare /compose: selector opens showing new/add/remove, dispatches
  after selection + arg collection
- Override: project-level /compose replaces bundled description,
  subcommands, and autocomplete
- Unknown subcommand: warning lists available new, add, remove

Tests exercise the full pipeline: discovery → registration → arg
parsing → substitution → final sentUserMessage content.

100 tests total (17 new).

## [0.1.1](https://github.com/victor-software-house/pi-prompt-composer/compare/v0.1.0...v0.1.1) (2026-04-01)


### Bug Fixes

* force release ([690dcb9](https://github.com/victor-software-house/pi-prompt-composer/commit/690dcb998c633f4f2867b5327798419b127c2147))

# CHANGELOG

## [Unreleased]
