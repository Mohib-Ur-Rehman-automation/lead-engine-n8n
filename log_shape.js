// Shape a log row for one Sheet tab. Only known columns, plain text, max 500 chars each.
// The Sheets node writes in RAW mode, so text like =HYPERLINK(...) is stored as text, never run.
const COLS = {
  Events: ['idempotency_key', 'dedupe_key', 'event', 'ts'],
  Rejects: ['ts', 'errors', 'name', 'email', 'phone', 'test_id'],
  TestReport: ['run_ts', 'test_id', 'expect', 'got', 'pass', 'detail'],
};
const items = $input.all();
const tab = items[0].json.data && items[0].json.data.tab;
if (!COLS[tab]) throw new Error('L0 log: data.tab must be Events, Rejects or TestReport');
const now = new Date().toISOString();
return items.map(it => {
  const d = it.json.data || {};
  if (d.tab !== tab) throw new Error('L0 log: one call can only write to one tab');
  const src = d.row || {};
  const row = {};
  for (const c of COLS[tab]) {
    let v = src[c];
    if ((c === 'ts' || c === 'run_ts') && (v === undefined || v === '')) v = now;
    if (Array.isArray(v)) v = v.join(', ');
    row[c] = v === undefined || v === null ? '' : String(v).slice(0, 500);
  }
  return { json: row };
});
