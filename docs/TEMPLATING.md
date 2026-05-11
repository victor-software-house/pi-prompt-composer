# TEMPLATING

`pi-prompt-composer` supports two rendering engines for composer-owned prompts under `.pi/composed/` and `~/.pi/agent/composed/`.

## Engines

| Engine | Best for | Syntax |
|--------|----------|--------|
| `pi` (default) | Native-compatible positional prompts | `$1`, `$2`, `$ARGUMENTS`, `$@`, `${@:N}` |
| `liquid` | Rich structured prompts | `{{ args.name }}`, `{% if %}`, `{% for %}`, filters, XML blocks |

Use `engine: liquid` when prompt output needs conditional sections, repeated lists, data shaping, JSON snippets, safe shell command blocks, optional stdout injection from trusted local helpers, or Claude Code skill-style XML structure.

## Minimal Liquid prompt

```markdown
---
description: Review a change
engine: liquid
args:
  - name: change
    required: true
    hint: Change, diff, file, or PR to review
  - name: focus
    required: false
    hint: Optional focus
---
Review {{ args.change | quote }}.

{% if args.focus | present %}
Focus on: {{ args.focus }}
{% endif %}
```

Invoke it as:

```text
/review --change "auth fix" --focus security
```

## Render context

Liquid prompts receive:

| Variable | Meaning |
|----------|---------|
| `args` | Named/coerced arguments from frontmatter metadata |
| `argv` | Raw positional argument array after parsing |
| `arguments` | Raw positional arguments joined by spaces |
| `prompt.name` | Command name |
| `prompt.groupName` | Group name for grouped subcommands |
| `prompt.origin` | `bundled`, `user`, or `project` |
| `prompt.filePath` | Source prompt file path |
| `now` | ISO timestamp captured at render time |

Use `argv`/`arguments` when a Liquid prompt needs Pi-like rest behavior.

```liquid
First arg: {{ argv[0] }}
Everything: {{ arguments }}
Rest after first: {{ argv | slice: 1 | join: " " }}
```

## Variables, conditionals, and partial templates

Liquid supports inline variables with `assign` and multi-line reusable fragments with `capture`.

```liquid
{% assign preferred_search = "rg" %}
{% assign fallback_search = "grep" %}
{% capture search_command %}
if command -v {{ preferred_search }} >/dev/null 2>&1; then
  SEARCH={{ preferred_search | shell_quote }}
else
  SEARCH={{ fallback_search | shell_quote }}
fi
{% endcapture %}
```

Use variables when a value appears more than once: project IDs, channel IDs, repo slugs, ticket keys, paths, output headings, or selected local tools. Do not repeat literals in shell blocks, JSON snippets, and output templates when one `assign` can keep them aligned.

Use conditionals to include optional sections only when they apply:

```liquid
{% assign has_checks = args.checks | size %}
{% if has_checks > 0 %}
### Checks
{% for check in args.checks %}
- {{ check }}
{% endfor %}
{% endif %}
```

Prompt-local partials are supported for repeated snippets. Place partials next to the prompt in `_partials/` or beside the prompt file, then include them with Liquid. Partials share the current render context.

```text
.pi/composed/review/
├── _index.md
├── _partials/
│   └── local-context.md
└── create.md
```

```liquid
{% if args.include_context %}
{% include "local-context.md" %}
{% endif %}
```

Prefer partials for repeated prompt prose and repeated JSON/tool instruction blocks. Prefer shell variables inside a single `{% shell %}` block for command-local decisions such as `rg` vs `grep`, available CLIs, or temp file paths.

## Rest arguments

For nicer authoring, mark the final arg as `rest: true`. Composer captures all remaining positionals into that arg.

```yaml
args:
  - name: group_name
    required: true
    hint: Group name
  - name: description
    required: false
    type: string[]
    rest: true
    hint: Freeform description
```

Usage:

```text
/compose new review create review workflows
```

Liquid body:

```liquid
Group: {{ args.group_name }}
Description: {{ args.description | join: " " }}
```

## Helpers

Composer registers these safe helpers on top of Liquid built-ins:

| Helper | Use |
|--------|-----|
| `present` | True for non-empty strings/arrays and other truthy values |
| `quote` | Trim and double-quote a value for prompt prose |
| `tokens` | Rough chars/4 token estimate |
| `json` | JSON stringify a value; optional indentation: `{{ x | json: 2 }}` |
| `shell_quote` | Single-quote a value for shell command text |
| `{% xml "tag" %}...{% endxml %}` | Emit `<tag>...</tag>` only when rendered body is non-empty |
| `{% shell %}...{% endshell %}` | Render a command, optionally execute it when `shell` frontmatter opts in |

Liquid built-ins such as `where`, `map`, `join`, `size`, `first`, `last`, `default`, `if`, `for`, and `assign` also work.

## Claude Code skill-style XML

```liquid
{% xml "task" %}
Goal: {{ args.goal }}
{% endxml %}

{% xml "constraints" %}
{% for constraint in args.constraints %}
- {{ constraint }}
{% endfor %}
{% endxml %}
```

Empty XML blocks disappear. This keeps prompts structured without blank placeholder sections.

## Safe command-batch rendering

Liquid templates can generate command batches for operator review:

````liquid
```bash
cd {{ args.workdir | shell_quote }}
{% for command in args.commands %}
{{ command }}
{% endfor %}
```
````

Without shell opt-in, templates render command text instead of executing it. This is the safe default.

## Shell execution opt-in

Liquid supports `{% shell %}...{% endshell %}` blocks for trusted local helper commands.

```markdown
---
description: Render timestamp and helper output
engine: liquid
shell: ask
args:
  - name: topic
    required: true
    hint: Topic for the helper script
---
Generated on:
{% shell %}
date +%Y-%m-%d
{% endshell %}

Helper output:
{% shell %}
python3 scripts/summarize.py --topic {{ args.topic | shell_quote }}
{% endshell %}
```

Shell policy:

| Frontmatter | Behavior |
|-------------|----------|
| omitted / `shell: deny` | Do not execute. Render a visible "not executed" block with the command text. |
| `shell: ask` | Ask the operator before each render. If approved, stdout replaces the block. |
| `shell: allow` | Execute without prompting. Use only for trusted local/project prompts. |

You can also set the default shell mode in config. Project config overrides user config:

- user: `~/.pi/agent/prompt-composer.json`
- project: `.pi/prompt-composer.json`

```json
{
  "shell": {
    "mode": "ask",
    "timeoutMs": 30000
  }
}
```

Top-level aliases also work: `shellMode`, `defaultShellMode`, and `shellTimeoutMs`. Prompt frontmatter wins over config.

Execution details:

- commands run through `bash -lc`
- working directory is the prompt file's directory, so relative scripts like `scripts/summarize.py` resolve beside the prompt
- timeout is 30 seconds
- successful commands inject `stdout` into the rendered prompt
- failed commands inject exit code plus stdout/stderr

Why opt-in exists:

- shell can read files, call networks, mutate repos, or expose secrets
- prompt args can become command input, so use `shell_quote` for any user-provided values
- `shell: ask` keeps default behavior visible and consent-based
- `shell: allow` is a trusted-prompt bypass for workflows you own

Composer intentionally does not claim portable sandboxing. Cross-platform sandboxing differs across macOS, Linux, Windows, containers, and corporate hosts; a fake sandbox would create false confidence. Treat shell-enabled prompts as trusted code, same as Pi's normal shell execution model.

## Fixture examples

See [examples/templating/README.md](../examples/templating/README.md) for grounded-compaction-style golden fixtures covering:

- Claude Code skill-style XML blocks
- command-batch rendering with shell quoting
- opt-in shell execution with deterministic mocked stdout
- denied shell execution showing command text instead of running
- data shaping with `where`, `map`, `join`, and `json`
- Pi engine compatibility for `--flag` and `key=value`

Run fixture tests:

```bash
pnpm test -- --run test/template-fixtures.test.ts
```

Regenerate expected outputs after intentional template/helper changes:

```bash
UPDATE_TEMPLATE_EXAMPLES=1 pnpm test -- --run test/template-fixtures.test.ts
```

## Prompt validation

Validate composer-owned prompt roots before manual smoke testing:

```bash
pnpm run prompts:validate
mise run prompts:validate -- prompts ~/.pi/agent/composed/workflow
```

The validator checks:

- grouped `_index.md` shape and `order` references
- required `description` frontmatter
- supported `engine`, `shell`, and `args` fields
- Liquid parse errors, including prompt-local partial includes
- shell blocks only in `engine: liquid` prompts with `shell: ask` or `shell: allow`
- empty shell blocks
- unsafe `curl | jq` / raw response redirect patterns in shell blocks

Validation is static. It never executes shell blocks. After validation, smoke render with Pi `/reload` and the target command, approving shell execution when expected.
