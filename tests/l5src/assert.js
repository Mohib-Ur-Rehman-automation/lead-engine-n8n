// Check every lead in this batch against its _expect and build TestReport rows.
const S = $('Load 500 test leads').first().json;
const results = $('L0: process').all().map(i => i.json);
const { status } = $('Decide batch').first().json;
const finals = $('L0: ai_adjust').all().map(i => i.json);
const crms = $('L0: crm_upsert').all().map(i => i.json);
const tierOf = s => s >= 70 ? 'hot' : s >= 40 ? 'warm' : 'cold';
let k = 0;
const rows = results.map((r, i) => {
  const exp = (r.test && r.test.expect) || '';
  const id = (r.test && r.test.id) || '';
  let got, pass, detail = '';
  if (status[i] === 'reject') {
    got = 'reject_' + (r.errors || []).join('+');
    pass = exp.startsWith('reject_') && (r.errors || []).includes(exp.slice(7));
  } else if (status[i] === 'repeat') {
    got = 'repeat_ignored';
    pass = exp === 'dedupe_update';
  } else {
    const f = finals[k], c = crms[k]; k++;
    const checks = [];
    const want = Math.max(0, Math.min(100, r.rule_score + (f.ai_adjust || 0)));
    if (!c || c.ok !== true || !c.contact_id) checks.push('no contact');
    if (c && c.is_new !== true) checks.push('contact already existed');
    if (Math.abs(f.score - r.rule_score) > 10) checks.push('AI moved score > 10');
    if (f.score !== want || f.tier !== tierOf(f.score)) checks.push('score/tier mismatch');
    if (/[<>]/.test(f.ai_summary || '')) checks.push('summary not sanitized');
    if (exp === 'accept_ai_clamped' && f.ai_adjust !== 10) checks.push('attack not clamped to +10');
    if (exp === 'accept_phone_only' && (!String(r.dedupe_key).startsWith('tel:') || r.lead.email)) checks.push('phone-only key wrong');
    if (exp === 'accept_truncated' && (r.lead.name.length > 80 || r.lead.message.length > 1000)) checks.push('not truncated');
    if (exp.startsWith('reject_') || exp === 'dedupe_update') checks.push('should not be accepted');
    got = checks.length ? 'FAIL: ' + checks.join('; ') : exp;
    pass = checks.length === 0;
    const reply = c && c.is_new === true && !!r.lead.email;
    detail = `cid:${c ? c.contact_id : ''};new:${c && c.is_new ? 1 : 0};reply:${reply ? 1 : 0};adj:${f.ai_adjust};score:${f.score};tier:${f.tier}`;
  }
  return { json: { action: 'log', data: { tab: 'TestReport', row: {
    run_ts: S.run_ts, test_id: id, expect: exp, got, pass: pass ? 'PASS' : 'FAIL', detail,
  } } } };
});
if (k !== finals.length || k !== crms.length) throw new Error(`L5: pairing error (${k} first-time vs ${finals.length} AI vs ${crms.length} CRM)`);
return rows;
