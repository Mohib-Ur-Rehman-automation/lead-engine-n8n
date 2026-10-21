const assert = require('assert'); const fs = require('fs');
const { run: runL0 } = require('./harness');
function run(file, input, nodes = {}) {
  const code = fs.readFileSync(__dirname + '/l5src/' + file, 'utf8');
  const wrap = a => ({ all: () => a.map(j => ({ json: j })), first: () => ({ json: a[0] }) });
  return new Function('$input', '$', code)(wrap(input), n => { if (!(n in nodes)) throw new Error('ref ' + n); return wrap(nodes[n]); }).map(x => x.json);
}
const N = {};
N['Load 500 test leads'] = run('load.js', []);
const leads = require('./test_leads.json');
assert.deepStrictEqual(N['Load 500 test leads'].map(i => i.data), leads, 'unpacked leads identical to test_leads.json');
const events = [], report = [], hub = new Map(); let id = 5000;
// dirty-sheet guard
assert.throws(() => run('precheck.js', [{ dedupe_key: leads[1].email }], N), /already in the Events/);
const items = run('precheck.js', [{}], N);
for (let b = 0; b < 500; b += 25) {
  const batch = items.slice(b, b + 25);
  N['L0: process'] = runL0('rules.js', batch);
  N['Decide batch'] = run('decide.js', events.length ? events : [{}], N);
  const claims = run('claims.js', [], N); assert.ok(claims.length > 0, 'batch has claims');
  runL0('log_shape.js', claims).forEach(r => events.push(r));
  N['L0: ai_adjust'] = runL0('rules.js', run('mock_ai.js', [], N));
  const ups = run('wrap_upsert.js', N['L0: ai_adjust'], N);
  N['L0: crm_upsert'] = ups.map(u => { const key = u.data.dedupe_key; const isNew = !hub.has(key); if (isNew) hub.set(key, String(id++));
    runL0('crm_build_upsert.js', [u]); return { ok: true, contact_id: hub.get(key), is_new: isNew, lead_key: key }; });
  runL0('log_shape.js', run('assert.js', [], N)).forEach(r => report.push(r));
}
N['Summary'] = run('summary.js', report, N);
const s = N['Summary'][0];
runL0('log_shape.js', run('summary_log.js', [], N));
console.log(s.subject); console.log(s.log.data.row.got);
assert.ok(s.subject.startsWith('[L5 PASS] 500/500'), 'all pass');
// a deliberately broken AI clamp must FAIL the report (proves the asserts bite)
const bad = fs.readFileSync('src/rules.js', 'utf8').replace('adj = Math.max(-RULES.aiMaxAdjust, Math.min(RULES.aiMaxAdjust, adj));', '');
const badRun = (items) => new Function('$input', '$', bad)({ all: () => items.map(j => ({ json: j })) }, () => {}).map(x => x.json);
N['L0: process'] = runL0('rules.js', items.slice(0, 25)); N['Decide batch'] = [{ status: N['L0: process'].map(r => r.ok ? 'first' : 'reject') }];
N['L0: ai_adjust'] = badRun(run('mock_ai.js', [], N));
N['L0: crm_upsert'] = N['L0: ai_adjust'].map(() => ({ ok: true, contact_id: '1', is_new: true }));
const fails = run('assert.js', [], N).filter(r => r.data.row.pass === 'FAIL');
assert.ok(fails.length > 0, 'broken clamp is caught'); console.log('sabotage check: broken clamp caught in', fails.length, 'rows');
