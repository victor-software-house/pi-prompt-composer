# templating examples

Declarative Liquid prompt examples for `pi-prompt-composer`.

Each example directory contains:

```text
NN-name/
  case.json     render input metadata and args
  prompt.md     real prompt source, including frontmatter
  expected.md   golden output
```

Tests auto-discover these examples through `test/template-fixtures.test.ts`.
Regenerate expected files after intentional helper/template changes:

```bash
UPDATE_TEMPLATE_EXAMPLES=1 pnpm test -- --run test/template-fixtures.test.ts
```

Current helpers covered:

- Liquid built-ins: `if`, `for`, `assign`, `where`, `map`, `join`, `size`, `default`
- Composer filters: `present`, `quote`, `tokens`, `json`, `shell_quote`
- Composer tag: `{% xml "tag" %}...{% endxml %}`
- Prompt metadata: `prompt.name`, `prompt.origin`, `prompt.filePath`
- Shell command policies: render command text by default, execute only with `shell: ask` or `shell: allow`
- Relative helper scripts: shell blocks run from the prompt file directory

## Catalogue

| # | Example | Shows |
|---|---------|-------|
| 01 | `01-claude-skill-style` | Full frontmatter, args, XML blocks, loops, JSON, token estimate |
| 02 | `02-command-batch` | Safe command-batch text with `shell_quote` |
| 03 | `03-data-shaping` | `where`, `map`, `join`, `present`, `json` |
| 04 | `04-pi-engine-compat` | `engine: pi`, positional args, escaped `$ARGUMENTS` |
| 05 | `05-shell-exec-allow` | `shell: allow`, timestamp command, relative Python helper command |
| 06 | `06-shell-denied` | Safe default when shell frontmatter is absent |
