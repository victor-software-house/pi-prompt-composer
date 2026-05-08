---
description: Shape structured data inside a Liquid prompt
engine: liquid
args:
  - name: items
    required: true
    hint: Items to group and summarize
  - name: focus
    required: false
    hint: Optional review focus
---
{% assign risks = args.items | where: "kind", "risk" %}
Risk count: {{ risks | size }}
Risk names: {{ risks | map: "name" | join: ", " }}
Risk owners: {{ risks | map: "owner" | join: " / " }}

{% if args.focus | present %}
Focus: {{ args.focus }}
{% else %}
Focus: broad review
{% endif %}

Full first item:
{{ args.items | first | json }}
