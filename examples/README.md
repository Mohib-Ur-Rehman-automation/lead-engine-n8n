# Examples

`sample-lead.json` is one lead in the shape the website webhook accepts. Send it to your own n8n (L1 must be published):

```bash
curl -X POST "http://localhost:5678/webhook/halden-lead" \
  -H "Content-Type: application/json" \
  --data @sample-lead.json
```

Accepted values:

| Field | Values |
|---|---|
| `monthly_bill` | `under_10k`, `10k_25k`, `25k_50k`, `50k_100k`, `over_100k` |
| `timeline` | `now`, `1_3_months`, `3_6_months`, `researching` |
| `property_type` | `house`, `business`, `apartment` |
| `ownership` | `owner`, `renter` |
| `phone` | Pakistani mobile, any common format (`0300 1234567`, `+92 300 1234567`) |
| `website` | Leave empty. It is a honeypot: anything here marks the lead as a bot. |

At least one of `email` or `phone` is required, plus `name`. This sample scores **85 (hot)**: bill 20, timeline 30, house 15, owner 15, plus 5 for giving both email and phone. So expect the instant reply and a hot-lead alert. Send it twice and the second one is ignored as an exact repeat.
