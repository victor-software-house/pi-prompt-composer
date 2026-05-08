# TEMPLATING

`pi-prompt-composer` supports two rendering engines for composer-owned prompts under `.pi/composed/` and `~/.pi/agent/composed/`.

## Engines

| Engine | Best for | Syntax |
|--------|----------|--------|
| `pi` (default) | Native-compatible positional prompts | `$1`, `$2`, `$ARGUMENTS`, `$@`, `${@:N}` |
| `liquid` | Rich structured prompts | `{{ args.name }}`, `{% if %}`, `{% for %}`, filters, XML blocks |

Use `engine: liquid` when prompt output needs conditional sections, repeated lists, data shaping, JSON snippets, safe shell command blocks, or Claude Code skill-style XML structure.

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
| `args` | Named argument object collected from frontmatter + CLI |
| `prompt.name` | Command name |
| `prompt.groupName` | Group name for grouped subcommands |
| `prompt.origin` | `bundled`, `user`, or `project` |
| `prompt.filePath` | Source prompt file path |

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

Templates do **not** execute shell commands. They render command text into the final visible user message. Actual command execution remains a separate operator/model action with normal Pi tool visibility and permissions.

## Fixture examples

See [examples/templating/README.md](../examples/templating/README.md) for grounded-compaction-style golden fixtures covering:

- Claude Code skill-style XML blocks
- command-batch rendering with shell quoting
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
