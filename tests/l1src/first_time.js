// Did this exact submission (same contact + message + timeline) arrive before?
// n8n runs one production execution at a time here, so check-then-claim can't race.
const key = $('L0: process').first().json.idempotency_key;
const seen = $input.all().some(i => i.json && i.json.idempotency_key === key);
return [{ json: { seen } }];
