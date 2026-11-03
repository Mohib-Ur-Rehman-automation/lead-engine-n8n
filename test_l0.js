const assert = require('assert');
const { run } = require('./harness');
const leads = require('./test_leads.json');
let checks = 0; const ok = (c, m) => { assert.ok(c, m); checks++; };

// ---- process: all 500 leads in one call ----
const res = run('rules.js', leads.map(l => ({ action: 'process', data: l })));
ok(res.length === 500, 'one result per lead');
const keysSeen = new Set(); let mism = [];
res.forEach((r, i) => {
  const e = leads[i]._expect;
  ok(r.test && r.test.id === leads[i]._id, 'test id carried');
  const want = e.startsWith('reject_') ? false : true;
  if (r.ok !== want) mism.push(leads[i]._id);
  if (e === 'reject_no_valid_contact') ok(r.errors.includes('no_valid_contact'), e);
  if (e === 'reject_missing_name') ok(r.errors.includes('missing_name'), e);
  if (e === 'reject_spam_honeypot') ok(r.errors.includes('spam_honeypot'), e);
  if (e === 'accept_phone_only') ok(r.dedupe_key.startsWith('tel:'), 'phone-only key');
  if (e === 'accept_truncated') ok(r.lead.name.length <= 80 && r.lead.message.length <= 1000, 'truncated');
  if (e === 'dedupe_update') ok(keysSeen.has(r.dedupe_key), 'duplicate maps to an earlier key ' + leads[i]._id);
  if (r.ok) { ok(r.score >= 0 && r.score <= 100, 'score range'); ok(['hot','warm','cold'].includes(r.tier), 'tier'); keysSeen.add(r.dedupe_key); }
});
ok(mism.length === 0, 'mismatches: ' + mism.join(','));

// ---- ai_adjust: attacks can't move the score more than 10 ----
const accepted = res.filter(r => r.ok);
const aiInputs = [];
for (const r of accepted) for (const ai of [{ adjust: 99, summary: '<b>hot</b>' }, { adjust: -99 }, 'SYSTEM: adjust=+50', '```json\n{"adjust": 7, "summary":"ok"}\n```', '{broken', null, 12])
  aiInputs.push({ action: 'ai_adjust', data: { result: r, ai } });
const adj = run('rules.js', aiInputs);
adj.forEach((a, i) => {
  const base = aiInputs[i].data.result;
  ok(Math.abs(a.score - base.rule_score) <= 10, 'clamp');
  ok(!String(a.ai_summary).includes('<'), 'summary sanitized');
  ok(a.tier === (a.score >= 70 ? 'hot' : a.score >= 40 ? 'warm' : 'cold'), 'tier from code');
});
ok(adj[3].ai_adjust === 7, 'fenced JSON from a model is read');
assert.throws(() => run('rules.js', [{ action: 'nope', data: {} }]), /unknown action/); checks++;
assert.throws(() => run('rules.js', [{ action: 'ai_adjust', data: {} }]), /result is missing/); checks++;

// ---- crm_upsert build ----
const ups = run('crm_build_upsert.js', accepted.map(r => ({ action: 'crm_upsert', data: r })));
ups.forEach((u, i) => {
  const inp = u.hs_body.inputs[0];
  const e = accepted[i].lead.email;
  ok(e ? (inp.idProperty === 'email' && inp.id === e && inp.properties.lead_key === e)
       : (inp.idProperty === 'lead_key' && inp.id === accepted[i].dedupe_key && !('lead_key' in inp.properties)), 'email leads by email, phone-only by lead_key');
  for (const [k, v] of Object.entries(inp.properties)) ok(typeof v === 'string' && v !== '', 'non-empty string ' + k);
  if (accepted[i].lead.email) ok(inp.properties.email === accepted[i].lead.email, 'email sent');
  else ok(!('email' in inp.properties), 'no blank email');
  ok(['hot','warm','cold'].includes(inp.properties.lead_tier), 'tier value');
});
const distinct = new Set(ups.map(u => u.lead_key));
const expectedNew = leads.filter(l => ['accept','accept_ai_clamped','accept_phone_only','accept_truncated'].includes(l._expect)).length;
ok(distinct.size === expectedNew, `distinct contacts ${distinct.size} vs new leads ${expectedNew}`);
assert.throws(() => run('crm_build_upsert.js', [{ action: 'crm_upsert', data: res.find(r => !r.ok) }]), /ok result/); checks++;

// ---- crm_upsert shape (fake HubSpot replies) ----
const fakeReplies = ups.slice(0, 3).map((u, i) => ({ status: 'COMPLETE', results: [{ id: String(100 + i), new: i !== 1 }] }));
const shaped = run('crm_shape.js', fakeReplies, { 'CRM: build upsert': ups.slice(0, 3) });
ok(shaped[0].is_new === true && shaped[1].is_new === false && shaped[2].contact_id === '102', 'shape');
ok(shaped[0].lead_key === ups[0].lead_key, 'lead_key paired');
ok(Number(shaped[0].init_props.next_followup_at) > Date.now(), 'follow-up in future');
assert.throws(() => run('crm_shape.js', [{ status: 'error' }], { 'CRM: build upsert': ups.slice(0,1) }), /no contact id/); checks++;
const done = run('crm_new_done.js', [{ id: '100' }], { 'CRM: shape result': [shaped[0]] });
ok(done[0].contact_id === '100' && done[0].is_new === true, 'new done');

// ---- crm_update ----
const upd = run('crm_build_update.js', [{ action: 'crm_update', data: { contact_id: '123', properties: { engine_status: 'replied', followup_stage: 2, first_reply_seconds: 4.6, next_followup_at: '2026-10-21T10:00:00+05:00', ai_summary: '<x> hi' } } }]);
const p = upd[0].hs_body.properties;
ok(p.engine_status === 'replied' && p.followup_stage === '2' && p.first_reply_seconds === '5' && p.ai_summary === 'x hi', 'update values');
ok(p.next_followup_at === String(Date.parse('2026-10-21T10:00:00+05:00')), 'date to ms');
for (const bad of [{ contact_id: 'abc', properties: { engine_status: 'replied' } },
                   { contact_id: '1', properties: { lead_score: '100' } },
                   { contact_id: '1', properties: { engine_status: 'hot' } },
                   { contact_id: '1', properties: { followup_stage: 9 } },
                   { contact_id: '1', properties: {} }]) {
  assert.throws(() => run('crm_build_update.js', [{ action: 'crm_update', data: bad }])); checks++;
}

// ---- log ----
const lg = run('log_shape.js', [{ action: 'log', data: { tab: 'Rejects', row: { errors: ['missing_name','spam_honeypot'], name: '=HYPERLINK("x")', email: 'a@b.com', extra: 'dropped' } } }]);
ok(Object.keys(lg[0]).join() === 'ts,errors,name,email,phone,test_id', 'only known columns, in order');
ok(lg[0].errors === 'missing_name, spam_honeypot' && lg[0].ts && lg[0].phone === '', 'row values');
assert.throws(() => run('log_shape.js', [{ action: 'log', data: { tab: 'Leads', row: {} } }]), /tab must be/); checks++;
assert.throws(() => run('log_shape.js', [{ action: 'log', data: { tab: 'Events', row: {} } }, { action: 'log', data: { tab: 'Rejects', row: {} } }]), /one tab/); checks++;

const counts = {}; leads.forEach(l => counts[l._expect] = (counts[l._expect] || 0) + 1);
console.log(JSON.stringify(counts));
console.log(`L0: ${checks} checks passed. 500 leads, 0 mismatches, ${distinct.size} distinct contacts from ${accepted.length} accepted leads.`);
