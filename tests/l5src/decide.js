// For this batch: rejected, exact repeat (key already in Events or earlier in this batch), or first-time.
const results = $('L0: process').all().map(i => i.json);
const seen = new Set($input.all().map(r => r.json && r.json.idempotency_key).filter(Boolean));
const status = results.map(r => {
  if (!r.ok) return 'reject';
  if (seen.has(r.idempotency_key)) return 'repeat';
  seen.add(r.idempotency_key);
  return 'first';
});
return [{ json: { status } }];
