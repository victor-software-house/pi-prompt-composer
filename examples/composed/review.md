---
description: Review a change with Liquid named args
engine: liquid
args:
  - name: change
    required: true
    hint: Change, diff, file, or PR to review
  - name: focus
    required: false
    hint: Optional review focus
---
Review {{ args.change | quote }}.
{% if args.focus | present %}
Focus on: {{ args.focus }}
{% endif %}

Report:
- risks
- correctness issues
- missing verification
- suggested next steps
