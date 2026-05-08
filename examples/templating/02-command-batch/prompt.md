---
description: Render a safe shell command batch for operator review
engine: liquid
args:
  - name: workdir
    required: true
    hint: Working directory
  - name: commands
    required: true
    type: string[]
    hint: Commands to render
  - name: dangerous
    required: false
    hint: Value that needs shell quoting
---
Prepare command batch for operator review.

```bash
cd {{ args.workdir | shell_quote }}
{% for command in args.commands %}
{{ command }}
{% endfor %}
printf '%s\n' {{ args.dangerous | shell_quote }}
```

Rules:
- Do not execute until operator confirms.
- Preserve command order.
- Stop on first failure when converting to an executable script.
