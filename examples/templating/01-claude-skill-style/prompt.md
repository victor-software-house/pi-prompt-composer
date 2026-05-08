---
description: Build a Claude Code skill-style ship-readiness prompt
engine: liquid
args:
  - name: ticket
    required: true
    hint: Ticket or issue ID
  - name: goal
    required: true
    hint: Delivery goal
  - name: risks
    required: false
    type: string[]
    hint: Known risk list
  - name: checks
    required: false
    type: string[]
    hint: Verification checks
  - name: metadata
    required: false
    hint: Extra metadata object
---
{% xml "task" %}
Ticket: {{ args.ticket }}
Goal: {{ args.goal }}
{% endxml %}

{% xml "risk-register" %}
{% for risk in args.risks %}
- {{ risk }}
{% endfor %}
{% endxml %}

{% assign check_count = args.checks | size %}
Run {{ check_count }} checks:
{% for check in args.checks %}
{{ forloop.index }}. {{ check }}
{% endfor %}

Metadata JSON:
{{ args.metadata | json: 2 }}

Goal token estimate: {{ args.goal | tokens }}
