// Claim the submission in the Events tab before doing anything visible.
const r = $('L0: process').first().json;
return [{ json: { action: 'log', data: { tab: 'Events', row: {
  idempotency_key: r.idempotency_key, dedupe_key: r.dedupe_key, event: 'received',
} } } }];
