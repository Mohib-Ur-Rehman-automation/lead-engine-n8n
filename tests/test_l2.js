// Simulates two weeks of hourly L2 runs against a fake HubSpot with the search filter applied.
const assert = require('assert'); const fs = require('fs');
const { run: runL0 } = require('./harness');
let checks = 0; const ok = (c, m) => { assert.ok(c, m); checks++; };
function run(file, input, nodes) {
  const code = fs.readFileSync(__dirname + '/l2src/' + file, 'utf8');
  const wrap = a => ({ all: () => a.map(j => ({ json: j })), first: () => ({ json: a[0] }) });
  return new Function('$input', '$', code)(wrap(input), n => wrap(nodes[n])).map(x => x.json);
}
const H = 3600 * 1000, T0 = Date.now();
// contacts as L0 creates them: awaiting, stage 0, due in 24h
const db = [
  { id: '1', p: { email: 'a@x.com', firstname: 'Ali', city: 'Lahore', lead_key: 'a@x.com', engine_status: 'awaiting', followup_stage: '0', next_followup_at: String(T0 + 24 * H) } },
  { id: '2', p: { email: 'b@x.com', firstname: '<b>Bo</b>', city: '', lead_key: 'b@x.com', engine_status: 'awaiting', followup_stage: '0', next_followup_at: String(T0 + 24 * H) } },
  { id: '3', p: { email: '', firstname: 'Phone', lead_key: 'tel:92300', engine_status: 'awaiting', followup_stage: '0', next_followup_at: String(T0 + 24 * H) } },
];
const sent = [];
for (let h = 0; h <= 24 * 14; h++) {
  if (h === 50) db[1].p.engine_status = 'replied';        // Bo replies on day 2 (after #1, before #2)
  const code = fs.readFileSync(__dirname + '/l2src/settings.js', 'utf8').replace('TIME_TRAVEL_HOURS: 0', `TIME_TRAVEL_HOURS: ${h}`).replace(/Date\.now\(\)/g, String(T0));
  const S = new Function('$input', '$', code)({}, () => {}).map(x => x.json)[0];
  const f = S.search_body.filterGroups[0].filters;
  const results = db.filter(c => c.p.engine_status === f[0].value && Number(c.p.next_followup_at) <= Number(f[1].value) && c.p.email)
    .sort((a, b) => a.p.next_followup_at - b.p.next_followup_at).map(c => ({ id: c.id, properties: { ...c.p } }));
  const plan = run('plan.js', [{ results }], { Settings: [S] });
  if (!plan.length) continue;
  const upd = runL0('crm_build_update.js', plan);                // the real L0 validation
  upd.forEach(u => Object.assign(db.find(c => c.id === u.contact_id).p, u.hs_body.properties));
  plan.forEach(p => { sent.push({ h, id: p.data.contact_id, n: p.n }); ok(!/<b>Bo/.test(p.html), 'name escaped'); });
  const logs = run('log.js', [], { 'Plan follow-ups': plan });
  ok(runL0('log_shape.js', logs).every(r => r.event.startsWith('followup_')), 'log rows valid');
}
const a = sent.filter(s => s.id === '1');
ok(a.map(s => s.n).join() === '1,2,3', 'Ali gets exactly 3 follow-ups: ' + JSON.stringify(a));
ok(a[0].h === 24 && a[1].h === 72 && a[2].h === 168, 'days 1, 3, 7: hours ' + a.map(s => s.h));
ok(db[0].p.engine_status === 'closed' && db[0].p.followup_stage === '3', 'closed after #3');
ok(sent.filter(s => s.id === '2').map(s => s.n).join() === '1', 'reply stops follow-ups');
ok(!sent.some(s => s.id === '3'), 'phone-only never emailed');
console.log(`L2 sim: ${checks} checks passed. 14 days hourly: Ali got #1/#2/#3 at hours ${a.map(s => s.h)}, then closed; Bo replied after #1 and got nothing more; phone-only got none.`);
