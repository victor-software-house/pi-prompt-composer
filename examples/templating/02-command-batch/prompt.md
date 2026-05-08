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
