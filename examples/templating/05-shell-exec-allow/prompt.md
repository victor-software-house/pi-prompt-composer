---
description: Run trusted helper scripts during rendering
engine: liquid
shell: allow
args:
  - name: topic
    required: true
    hint: Topic passed to the helper script
---
Render date:
{% shell %}
date +%Y-%m-%d
{% endshell %}

Relative Python helper output:
{% shell %}
python3 scripts/summarize.py --topic {{ args.topic | shell_quote }}
{% endshell %}
