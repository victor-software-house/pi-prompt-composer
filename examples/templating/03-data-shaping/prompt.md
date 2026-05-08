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
