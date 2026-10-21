// Simulates L1 end to end: real L0 rules code, fake HubSpot/Sheets/AI, checks every decision.
const assert = require('assert'); const fs = require('fs');
const { run: runL0 } = require('./harness');
const leads = require('./test_leads.json');
let checks = 0; const ok = (c, m) => { assert.ok(c, m); checks++; };
function runL1(file, input, nodes) {
  const code = fs.readFileSync(__dirname + '/l1src/' + file, 'utf8');
  const wrap = arr => ({ all: () => arr.map(j => ({ json: j })), first: () => ({ json: arr[0] }) });
  const $input = wrap(input);
  const $ = n => { if (!(n in nodes)) throw new Error('unknown node ref ' + n); return wrap(nodes[n]); };
  return new Function('$input', '$', code)($input, $).map(x => x.json);
}
// Fake HubSpot keyed on lead_key; fake Events tab.
const hub = new Map(); const events = []; const sent = { reply: [], alert: [] }; let nextId = 1000;
const FORM_LABELS = { name: 'Full name', email: 'Email', phone: 'Phone (WhatsApp)', city: 'City', monthly_bill: 'Monthly electricity bill',
  timeline: 'When do you want solar?', property_type: 'Property type', ownership: 'Do you own the property?', message: 'Anything else? (English or Urdu)' };
const REV = { under_10k: 'Under Rs 10,000', '10k_25k': 'Rs 10,000 - 25,000', '25k_50k': 'Rs 25,000 - 50,000', '50k_100k': 'Rs 50,000 - 100,000', over_100k: 'Over Rs 100,000',
  now: 'As soon as possible', '1_3_months': 'In 1-3 months', '3_6_months': 'In 3-6 months', researching: 'Just researching',
  house: 'House', business: 'Business', apartment: 'Apartment', owner: 'Yes, I own it', renter: 'No, I rent' };

function upsert(res) {
  const key = res.dedupe_key; const isNew = !hub.has(key);
  if (isNew) hub.set(key, { id: String(nextId++), replies: 0 });
  const c = hub.get(key); c.score = res.score; c.tier = res.tier;
  return { ok: true, contact_id: c.id, is_new: isNew, lead_key: key, tier: res.tier, score: res.score };
}
function submit(trigger, aiText, aiError) {
  const N = {};
  N['Intake: settings & normalize'] = runL1('normalize.js', [trigger], N);
  N['L0: process'] = runL0('rules.js', N['Intake: settings & normalize']);
  const p = N['L0: process'][0];
  if (!p.ok) { const row = runL1('reject_row.js', [p], N); return { rejected: true, row: row[0] }; }
  const matches = events.filter(e => e.idempotency_key === p.idempotency_key);
  const ft = runL1('first_time.js', matches.length ? matches : [{}], N)[0];
  if (ft.seen) return { duplicate: true };
  events.push(runL1('claim.js', [ft], N)[0].data.row);
  const w1 = runL1('wrap_upsert1.js', [{}], N)[0];
  N['L0: crm_upsert (rules)'] = [upsert(w1.data)];
  N['Plan reply'] = runL1('plan_reply.js', N['L0: crm_upsert (rules)'], N);
  const pr = N['Plan reply'][0];
  let secs = null;
  if (pr.send) { sent.reply.push(pr); hub.get(p.dedupe_key).replies++;
    const t = runL1('reply_timing.js', [{}], N)[0]; secs = t.data.properties.first_reply_seconds; ok(t.data.contact_id === pr.contact_id, 'timing id'); }
  const aiOut = aiError ? { error: 'timeout' } : { text: aiText };
  const pa = runL1('prep_ai.js', [aiOut], N)[0];
  N['L0: ai_adjust'] = runL0('rules.js', [pa]);
  const w2 = runL1('wrap_upsert2.js', N['L0: ai_adjust'], N)[0];
  const c2 = upsert(w2.data);
  const al = runL1('plan_alert.js', [c2], N)[0];
  if (al.send) sent.alert.push(al);
  return { p, pr, al, final: N['L0: ai_adjust'][0], secs, c2 };
}
const AI = ['{"adjust": 8, "summary": "Wants install soon"}', '{"adjust": 50, "summary":"<script>x</script>"}', 'not json', '```json\n{"adjust":-4,"summary":"price shopping"}\n```'];
let rejected = 0, dup = 0, acc = 0;
leads.forEach((l, i) => {
  const viaForm = i % 2 === 0 && !l.website && !l._id.endsWith('9');
  const trigger = viaForm
    ? Object.fromEntries(Object.entries(FORM_LABELS).filter(([k]) => l[k] !== undefined).map(([k, lab]) => [lab, REV[l[k]] || l[k]]))
    : { body: i % 3 === 0 ? JSON.stringify(l) : l };          // some webhook calls arrive as text/plain JSON
  const r = submit(trigger, AI[i % 4], i % 7 === 0);
  const e = l._expect;
  if (e.startsWith('reject_')) { ok(r.rejected, 'reject ' + l._id); rejected++;
    if (!viaForm) ok(r.row.data.row.test_id === l._id, 'test id in reject row'); return; }
  if (e === 'dedupe_update') { ok(r.duplicate, 'exact repeat ignored ' + l._id); dup++; return; }
  ok(!r.rejected && !r.duplicate, 'accepted ' + l._id); acc++;
  ok(Math.abs(r.final.score - r.p.rule_score) <= 10, 'clamp');
  ok(r.c2.contact_id === r.pr.contact_id, 'same contact both saves');
  ok(r.pr.send === (!!r.p.lead.email), 'reply iff email (new contact)');
  ok(!r.pr.html.includes('<script'), 'reply escaped');
  ok(r.al.send === (r.final.tier === 'hot'), 'alert iff hot');
  if (r.al.send) ok(!/<script/i.test(r.al.html), 'alert escaped');
});
// Every contact got at most one reply; every email contact exactly one.
for (const [k, c] of hub) ok(c.replies === (k.startsWith('tel:') ? 0 : 1), 'exactly one first reply for ' + k);
// Same person, new message -> same contact, no second reply.
const before = sent.reply.length;
const firstOk = leads.find(l => l._expect === 'accept' && l.email);
const again = submit({ body: { ...firstOk, message: 'Any update on my quote?' } }, '{"adjust":2}', false);
ok(!again.duplicate && again.c2.is_new === false && sent.reply.length === before, 'returning contact: no 2nd reply');
// Garbage body
ok(submit({ body: 'not json at all' }, '', false).rejected, 'garbage body rejected');
console.log(`L1 sim: ${checks} checks passed. accepted ${acc}, exact repeats ignored ${dup}, rejected ${rejected}; contacts ${hub.size}; replies ${sent.reply.length}; hot alerts ${sent.alert.length}.`);
