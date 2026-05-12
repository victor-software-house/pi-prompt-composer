---
title: "Liquid-First Compose Prompt Migration"
prd: "PRD-001-enhanced-composer-prompts"
date: 2026-05-09
author: "Victor Software House"
status: Implemented
---

# Plan: Liquid-First Compose Prompt Migration

## Source

* **PRD**: [docs/prd/PRD-001-enhanced-composer-prompts.md](../prd/PRD-001-enhanced-composer-prompts.md)
* **Related plan**: [docs/architecture/plan-enhanced-composer-prompts.md](plan-enhanced-composer-prompts.md)
* **Date**: 2026-05-09
* **Author**: Victor Software House

## Current status — 2026-05-12

Implemented:

* Liquid `rest: true`, `argv`, and `arguments` support
* bundled `/compose new`, `/compose add`, and `/compose remove` migrated to Liquid
* raw-block protection for literal Liquid/shell examples
* static prompt validator for bundled and local composed prompt roots
* frontmatter `variables` support for static constants
* prompt-local `_partials/` includes
* compose skill and docs updated for Liquid-first authoring
* probe-level smoke of `/compose add`, `/compose remove`, local rest/validation fixtures, and private shell-enabled prompts
* invalid provided optional typed args now block render instead of warning and falling back to defaults
* temporary local fixture prompts removed after smoke

Remaining follow-ups:

* decide whether future `validate.pattern` / ranges / length validators are worth shipping
* module extraction remains tracked separately by roadmap PPC-011

## Architecture Overview

Migrate `pi-prompt-composer` authoring assets to a Liquid-first model without breaking Pi-engine compatibility. Runtime remains dual-engine: `engine: pi` stays for simple positional prompts, while `engine: liquid` becomes preferred path for bundled compose prompts, examples, and skill guidance because it supports named args, conditionals, repeatable arrays, shell blocks, rich Markdown, and structured XML-style blocks.

Full migration needs Liquid prompts to preserve current `/compose new NAME freeform description...` behavior. Composer now exposes raw positional context through `argv` and `arguments`, and supports `rest: true` on args so the final arg can capture remaining positionals. That unblocks replacing Pi `${@:2}` in bundled compose prompts with Liquid-friendly `{{ args.description | join: " " }}` or `{{ argv | slice: 1 | join: " " }}`.

Validation should stay fluent and declarative. Current runtime supports `required`, `type`, `values`, `default`, repeatable `string[]` named args, comma-separated `string[]` coercion, and `rest: true`. Migration should first document those as current validation, then add small declarative validators (`pattern`, ranges, lengths, item counts) only if tests prove they improve prompt authoring without turning frontmatter into a full schema language.

## Components

### Runtime Arg Context and Validation

**Purpose**: Make Liquid capable enough to replace Pi-engine bundled compose prompts without losing positional/rest behavior.

**Key Details**:

* `rest: true` on the final arg captures remaining positionals into that arg. Use with `type: string[]` for freeform text or repeatable tails.
* Liquid render context includes `argv` (raw positional array), `arguments` (raw positionals joined by spaces), and `variables` (static frontmatter constants).
* Keep existing positional fallback: declared Liquid args still bind from position when named value absent.
* Preserve repeated named args: `checks=a checks=b` remains `args.checks = ["a", "b"]` for `type: string[]`.
* Add validation only in small layers:
  * current: `required`, `type`, `values`, `default`, repeated/comma-separated `string[]`, `rest: true`
  * static prompt validation: `variables` shape, Liquid parse, partial includes, shell policy, and static literal assign enforcement
  * next: `validate.pattern`, `validate.message`
  * later: `min`, `max`, `minLength`, `maxLength`, `minItems`, `maxItems`
* Do not add arbitrary validator scripts in frontmatter. Shell validation belongs in prompt body or `{% shell %}` with explicit `shell` mode.

**ADR Reference**: Candidate — rest/argv contract and declarative validation shape affect future prompt authoring.

### Liquid Escaping and Raw Blocks

**Purpose**: Prevent Liquid migration from eating examples that teach Liquid, shell blocks, or Pi substitution syntax.

**Key Details**:

* Use `{% raw %}...{% endraw %}` around literal examples containing `{{ args.name }}`, `{% shell %}`, `{% xml %}`, or future `validate:` snippets.
* Continue escaping Pi substitution syntax in Pi-engine source prompts with `\$1`, `\$ARGUMENTS`, and `\${@:2}`.
* Add tests that render migrated `/compose` prompts and assert literal examples survive unchanged.
* Document raw-block rule in skill references and compose prompt quality rules.

**ADR Reference**: None — implementation safety rule.

### Bundled `/compose` Prompt Set

**Purpose**: Migrate package-owned compose prompts from Pi-engine instructional templates to Liquid-first authoring prompts.

**Files**:

* `prompts/compose/_index.md`
* `prompts/compose/new.md`
* `prompts/compose/add.md`
* `prompts/compose/remove.md`

**Key Details**:

* Add `engine: liquid` to `new.md`, `add.md`, and `remove.md` using current `rest: true`, `argv`, and `arguments` support.
* Keep command UX source-compatible:
  * `/compose new <group-name> [description...]`
  * `/compose add <group-name> [description...]`
  * `/compose remove <group-name> [subcommand]`
* Replace `$1`, `$2`, `${@:2}` in prose with `{{ args.group_name }}`, `{{ args.subcommand }}`, and rest/description helpers.
* Use Liquid conditionals to omit empty description sections instead of prose like “if empty”.
* Use Liquid loops to generate repeated examples from embedded arrays only where it improves readability.
* Keep generated prompt examples compatible with `.pi/composed/` and `~/.pi/agent/composed/`, not legacy `.pi/prompts/`.
* Include `type: group` in `_index.md` examples for validator clarity while keeping runtime ownership location-based; runtime still does not require it.

**ADR Reference**: None — product-facing migration, not standalone architecture decision.

### Migration Validation Gate

**Purpose**: Prevent the Liquid rewrite from changing `/compose` behavior or generating broken prompt files.

**Key Details**:

* Add golden tests before rewriting each bundled compose prompt.
* Render `prompts/compose/new.md`, `add.md`, and `remove.md` through the same extension path used at runtime, not a separate markdown-only fixture runner.
* Validate representative invocations:
  * `/compose new review create review workflows`
  * `/compose add review add security checklist`
  * `/compose remove review summary`
  * missing optional description
  * names with spaces rejected or normalized according to existing behavior
* Assert rendered instructions contain canonical `.pi/composed/` and `~/.pi/agent/composed/` paths, not legacy `.pi/prompts/` authoring paths.
* Assert generated `_index.md` examples include `order` and no required `type: group` marker.
* Assert every generated subcommand example includes `description` and correct `args` metadata when needed.
* Assert literal Liquid examples survive via `{% raw %}` and do not evaluate during `/compose` render.
* Assert literal Pi substitution examples remain escaped where needed.
* Assert no angle-bracket placeholders remain in final actionable `ask_user` JSON examples.
* Run `mise run skills:validate`, `pnpm test`, and `specdocs_validate` before committing the migration.

**ADR Reference**: None — release safety gate.

### Compose Skill and References

**Purpose**: Make `/skill:compose-grouped-prompts` match new Liquid-first behavior and stop teaching stale patterns.

**Files**:

* `skills/compose-grouped-prompts/SKILL.md`
* `skills/compose-grouped-prompts/references/workflow.md`
* `skills/compose-grouped-prompts/references/layout.md`
* `skills/compose-grouped-prompts/references/naming.md`
* `skills/compose-grouped-prompts/references/args-and-frontmatter.md`
* `skills/compose-grouped-prompts/references/operations.md`
* `skills/compose-grouped-prompts/references/examples.md`

**Key Details**:

* State Liquid-first default for powerful prompts.
* Keep Pi-engine guidance for simple prompts and backward compatibility.
* Add validation decision ladder:
  1. `required`
  2. `type`
  3. `values`
  4. `default`
  5. frontmatter `variables` for static constants
  6. `_partials/` includes for repeated snippets
  7. declarative `validate.*` once implemented
  8. prompt-body verification for semantic checks
* Add shell decision ladder:
  1. render command text only
  2. `shell: ask`
  3. `shell: allow` only for trusted local/project prompts
* Add raw-block guidance for prompts that generate prompt files containing Liquid syntax.
* Update examples to include rich Markdown, tables, callouts, repeatable args, and shell helpers.

**ADR Reference**: None — docs alignment.

### Repository Docs and Manual Tests

**Purpose**: Keep human docs, spec docs, and manual smoke tests aligned.

**Files**:

* `README.md`
* `docs/FEATURE-SET.md`
* `docs/ROADMAP.md`
* `docs/IMPLEMENTATION-PLAN.md`
* `docs/TEMPLATING.md`
* `docs/MANUAL-TESTING.md`
* `docs/prd/PRD-001-enhanced-composer-prompts.md` only if requirements change
* `docs/architecture/plan-enhanced-composer-prompts.md` only for cross-link/status update
* `.specify/` specs only if they remain active source, otherwise mark stale or leave as historical artifacts

**Key Details**:

* Docs should say final composer output displays as normal Pi user-message Markdown after `pi.sendUserMessage()`.
* Manual testing should include:
  * repeated named args
  * invalid enum
  * invalid number
  * Liquid raw examples surviving render
  * shell deny/ask/allow
  * rich Markdown rendering
* Remove stale `@mariozechner/*` references from active docs. Historical `.specify/` artifacts can keep old evidence if clearly archival.

**ADR Reference**: None — documentation hygiene.

### Tests and Golden Fixtures

**Purpose**: Make migration safe and reviewable.

**Files**:

* `test/template-fixtures.test.ts`
* `test/template-example-runner.ts`
* `test/extension-flow.test.ts`
* `test/helpers.test.ts`
* new focused tests if needed: `test/args.test.ts`, `test/compose-prompts.test.ts`
* `examples/templating/`

**Key Details**:

* Add golden fixtures for migrated `/compose new`, `/compose add`, `/compose remove` rendering.
* Keep tests for rest arg behavior and `argv`/`arguments` render context.
* Add tests for raw Liquid examples not being evaluated.
* Add tests for validation messages and blocked render.
* Add tests for rich Markdown output as raw final message text, not terminal rendering screenshots.

**ADR Reference**: None — verification support.

## Implementation Order

| Phase | Component                                         | Dependencies | Estimated Scope |
| ----- | ------------------------------------------------- | ------------ | --------------- |
| 1     | Audit references and freeze behavior              | None         | S               |
| 2     | Apply Liquid rest/argv support in bundled prompts | Phase 1      | S               |
| 3     | Add minimal declarative validators                | Phase 2      | M               |
| 4     | Add raw-block and compose golden tests            | Phase 2      | M               |
| 5     | Migrate bundled `/compose` prompts to Liquid      | Phases 2-4   | M               |
| 6     | Update compose skill references                   | Phase 5      | M               |
| 7     | Update docs/manual testing/spec links             | Phase 5      | S               |
| 8     | Probe smoke testing and cleanup temp prompts      | Phases 5-7   | S               |

### Phase 1: Audit references and freeze behavior

Inventory all references to composer paths, `engine`, args, validation, shell, and old Pi package scopes. Create a checklist from `grep` output and decide which files are active docs versus historical specs. Snapshot current `/compose` output through tests before migration.

Acceptance:

* Reference inventory committed or recorded in plan issue.
* Current `/compose new/add/remove` behavior covered by tests.
* No behavior change.

### Phase 2: Apply Liquid rest/argv support in bundled prompts

Runtime support for Pi `${@:N}` use cases in Liquid is available through `argv`, `arguments`, and `rest: true`. This phase applies that support to bundled prompts and locks it with tests.

Example target frontmatter:

```yaml
args:
  - name: group_name
    required: true
    hint: Group name
  - name: description
    required: false
    type: string[]
    rest: true
    hint: Freeform group purpose
```

Acceptance:

* `/compose new foo create that shit` can render `create that shit` as one description string.
* Existing Liquid prompts unchanged.
* Existing Pi-engine prompts unchanged.
* Golden tests prove `argv`, `arguments`, and `rest: true` survive future `/compose` migration work.

### Phase 3: Add minimal declarative validators

Implement first validator layer only if still needed after current fields. Keep syntax small.

Target shape:

```yaml
args:
  - name: ticket
    required: true
    hint: Ticket like PPC-123
    validate:
      pattern: "^[A-Z][A-Z0-9]+-[0-9]+$"
      message: "Use ticket like PPC-123"
```

Acceptance:

* Invalid pattern blocks render and surfaces actionable warning.
* Valid pattern continues.
* Unknown validation keys warn but do not enable unsafe behavior.

### Phase 4: Add raw-block and compose golden tests

Before rewriting bundled prompts, add tests that prove Liquid source can contain literal Liquid examples.

Acceptance:

* `{% raw %}{{ args.file }}{% endraw %}` renders literal `{{ args.file }}`.
* Literal `{% shell %}` examples survive where intended.
* Golden fixtures fail on accidental Liquid evaluation.
* `/compose new/add/remove` sample invocations render deterministic migration-safe output.
* Rendered instructions contain no stale composer-owned `.pi/prompts/` destinations.
* Rendered `ask_user` examples contain concrete JSON fields, not unresolved placeholders.

### Phase 5: Migrate bundled `/compose` prompts to Liquid

Rewrite `prompts/compose/new.md`, `add.md`, and `remove.md` to `engine: liquid`.

Migration rules:

* Preserve command names, args, and operator-visible workflow.
* Use `{{ args.* }}` in generated instruction text.
* Use Liquid conditionals for optional description blocks.
* Wrap generated Liquid examples in raw blocks.
* Keep exact `ask_user` JSON payloads.
* Keep generated files under `composed/` paths.

Acceptance:

* `/compose new foo create that shit` renders valid instructions.
* `/compose add foo add checker` renders valid instructions.
* `/compose remove foo bar` renders valid instructions.
* Existing tests pass.
* Migration validation gate passes before commit.

### Phase 6: Update compose skill references

Make skill docs match migrated prompts. Avoid duplicating long examples across files; keep concise decision ladder in `SKILL.md`, details in references.

Acceptance:

* `skills:validate` passes.
* Skill references mention current runtime support and future validators separately.
* No stale `.pi/prompts/` guidance for composer-owned groups except legacy migration notes.

### Phase 7: Update docs/manual testing/spec links

Update active docs and manual checklist. Cross-link this plan from roadmap or implementation plan if useful. Leave historical `.specify/` artifacts alone unless they confuse active docs.

Acceptance:

* `README.md`, `docs/TEMPLATING.md`, `docs/MANUAL-TESTING.md`, and `docs/ROADMAP.md` agree.
* `specdocs_validate` passes.
* No active docs tell users to put composer groups under `.pi/prompts/`.

### Phase 8: Probe smoke testing and temp prompt cleanup

Temporary local fixture prompts were used for smoke testing, then removed.

Acceptance:

* Probe-loaded extension entrypoint registered migrated `/compose`.
* `/compose add review add security checklist` and `/compose remove review summary` rendered follow-up user messages.
* Local fixture prompts verified `rest: true`, `argv`, `arguments`, invalid enum blocking, and invalid optional number blocking.
* Private shell-enabled prompts verified `shell: ask`, command execution handoff, shell output insertion, and no raw Liquid leaks.
* Temporary prompts were removed and a post-cleanup probe verified the fixture command no longer registers.

## Risks and Mitigations

| Risk                                                         | Likelihood | Impact | Mitigation                                                                       |
| ------------------------------------------------------------ | ---------- | ------ | -------------------------------------------------------------------------------- |
| Liquid migration breaks freeform `${@:2}` descriptions       | High       | High   | Add rest/argv support before migration                                           |
| Literal Liquid examples get evaluated inside compose prompts | High       | High   | Use `{% raw %}` and golden tests                                                 |
| Validation frontmatter grows into complex schema language    | Medium     | Medium | Ship only small declarative validators; semantic validation stays in prompt body |
| Shell guidance normalizes unsafe `shell: allow`              | Medium     | High   | Default docs to `shell: ask`; state trusted-code boundary everywhere             |
| Active docs and historical specs drift                       | Medium     | Medium | Update active docs; mark historical specs archival if touched                    |
| Built-in `/compose` behavior changes for existing users      | Medium     | High   | Snapshot behavior before migration and preserve command UX                       |

## Open Questions

* Should `arguments` stay a plain space-joined string, or should composer add named helpers for shell-safe/string-safe joins?
* `validate.pattern` remains follow-up after Liquid prompt migration; current runtime validation stays limited to shipped arg fields plus static prompt validator.
* `/compose new` should choose `engine: liquid` when named args, conditionals, loops, partials, variables, XML, JSON, or shell blocks are useful; keep `engine: pi` for simple positional prompts.

## ADR Index

Decisions surfaced by this plan:

| ADR | Title                                | Status                                                    |
| --- | ------------------------------------ | --------------------------------------------------------- |
| —   | Liquid rest/argv invocation contract | Captured in plan; ADR only if context shape changes again |
| —   | Declarative arg validation scope     | Candidate                                                 |
