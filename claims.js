// Claim first-time leads in Events, exactly like L1 does.
const results = $('L0: process').all().map(i => i.json);
const { status } = $('Decide batch').first().json;
return results.filter((r, i) => status[i] === 'first').map(r => ({ json: { action: 'log', data: { tab: 'Events', row: {
  idempotency_key: r.idempotency_key, dedupe_key: r.dedupe_key, event: 'received',
} } } }));
