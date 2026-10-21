// Refuse to run on a dirty sheet: if test leads are already in Events, a 2nd run would see them all as repeats.
const leads = $('Load 500 test leads').all();
const testKeys = new Set();
for (const it of leads) {
  const d = it.json.data;
  const e = String(d.email || '').trim().toLowerCase();
  if (e) testKeys.add(e);
}
const dirty = $input.all().filter(r => r.json && testKeys.has(String(r.json.dedupe_key || '').toLowerCase()));
if (dirty.length) throw new Error(`L5: ${dirty.length} test leads already in the Events tab. Run "L5b Cleanup" and clear the test rows first.`);
return leads.map(i => ({ json: i.json }));
