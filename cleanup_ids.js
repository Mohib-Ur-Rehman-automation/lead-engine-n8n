// Collect the HubSpot contact IDs the test run created (stored as cid:<id> in TestReport) -> archive in chunks of 100.
const rows = $input.all().filter(it => it.json && it.json.run_ts);
const latest = rows.map(it => String(it.json.run_ts)).sort().pop();   // older runs were already cleaned up
const ids = new Set();
for (const it of rows.filter(r => String(r.json.run_ts) === latest)) {
  const m = String((it.json && it.json.detail) || '').match(/cid:(\d+)/);
  if (m) ids.add(m[1]);
}
const list = [...ids];
if (!list.length) throw new Error('L5b: no test contact IDs found in TestReport. Nothing to delete.');
const out = [];
for (let i = 0; i < list.length; i += 100) out.push({ json: { count: list.slice(i, i + 100).length, body: { inputs: list.slice(i, i + 100).map(id => ({ id })) } } });
return out;
