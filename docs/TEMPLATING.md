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
