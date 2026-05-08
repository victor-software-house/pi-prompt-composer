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
