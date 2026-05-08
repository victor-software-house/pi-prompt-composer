# templating examples

Declarative Liquid prompt examples for `pi-prompt-composer`.

Each example directory contains:

```text
NN-name/
  case.json     render input metadata and args
  prompt.md     prompt body rendered by composer
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
- Command-batch rendering: generate safe shell command blocks; templates do **not** execute shell commands
