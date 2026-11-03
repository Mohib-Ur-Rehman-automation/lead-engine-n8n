// One Events row per reply detected.
return $('Decide').all().map(i => ({ json: { action: 'log', data: { tab: 'Events', row: {
  idempotency_key: '', dedupe_key: i.json.from, event: 'replied',
} } } }));
