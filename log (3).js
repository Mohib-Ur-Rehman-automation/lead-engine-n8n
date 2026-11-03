// One Events row per follow-up sent (followup_1 / followup_2 / followup_3).
return $('Plan follow-ups').all().map(i => ({ json: { action: 'log', data: { tab: 'Events', row: {
  idempotency_key: '', dedupe_key: i.json.lead_key, event: 'followup_' + i.json.n,
} } } }));
