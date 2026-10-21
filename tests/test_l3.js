const assert = require('assert'); const fs = require('fs');
const { run: runL0 } = require('./harness');
let checks = 0; const ok = (c, m) => { assert.ok(c, m); checks++; };
function run(file, input, nodes = {}, patch) {
  let code = fs.readFileSync(__dirname + '/l3src/' + file, 'utf8');
  if (patch) code = patch(code);
  const wrap = a => ({ all: () => a.map(j => ({ json: j })), first: () => ({ json: a[0] }) });
  return new Function('$input', '$', code)(wrap(input), n => wrap(nodes[n])).map(x => x.json);
}
const P = c => c.replace("'PASTE_YOUR_SMTP_EMAIL'", "'Sys@Gmail.com'").replace("'PASTE_TEAM_ALERT_EMAIL'", "'team@x.com'");
const mails = [
  { from: 'Halden Solar Co. <sys@gmail.com>', subject: 'Quick follow-up on your solar request, Ali — Halden', textPlain: 'x' },   // own follow-up: skip
  { from: 'Lead Engine <sys@gmail.com>', subject: '[HOT 95] Ali — call now', textPlain: 'x' },                                     // own alert: skip
  { from: 'sys@gmail.com', subject: 'Re: Quick follow-up on your solar request', textPlain: 'Yes call me at 5\n\nOn Tue, Oct 21 Halden wrote:\n> Hi' }, // self-test reply: keep
  { from: { value: [{ address: 'Lead@Example.com', name: 'Lead' }], text: 'Lead <Lead@Example.com>' }, subject: 'quote', textPlain: '<script>x</script> how much?' }, // real lead, object form: keep
  { from: 'stranger@spam.com', subject: 'Buy now', textPlain: 'spam' },                                                          // not a lead: dropped later
  { from: 'done@x.com', subject: 'Re: hi', textPlain: 'again' },                                                                 // already replied: dropped
];
const parsed = run('parse.js', mails, {}, P);
// auto-replies and bounces never count
const auto = run('parse.js', [{ from: 'lead@example.com', subject: 'Automatic reply: We got your solar request', textPlain: 'away' },
  { from: 'lead@example.com', subject: 'Out of Office: x', textPlain: 'x' }, { from: 'lead@example.com', subject: 'Auto: Re: x', textPlain: 'x' },
  { from: 'Mail Delivery Subsystem <mailer-daemon@googlemail.com>', subject: 'Delivery Status Notification (Failure)', textPlain: 'x' },
  { from: 'noreply@x.com', subject: 'hello', textPlain: 'x' }], {}, P);
ok(auto.length === 0, 'auto-replies/bounces ignored: ' + auto.map(a => a.subject));
ok(run('parse.js', [{ from: 'lead@example.com', subject: 'Re: away from home, call me later', textPlain: 'x' }], {}, P).length === 1, 'human reply mentioning away kept');
ok(parsed.length === 4, 'own mail skipped, 4 candidates: ' + parsed.map(p => p.from));
ok(parsed[0].from === 'sys@gmail.com' && parsed[0].snippet === 'Yes call me at 5', 'quote stripped: ' + parsed[0].snippet);
ok(parsed[1].from === 'lead@example.com', 'object sender lowercased');
const hub = { 'sys@gmail.com': { id: '11', properties: { firstname: 'Armen', engine_status: 'awaiting', followup_stage: '1' } },
              'lead@example.com': { id: '12', properties: { firstname: 'Lead', engine_status: 'closed', followup_stage: '3', lead_tier: 'warm', lead_score: '55' } },
              'done@x.com': { id: '13', properties: { engine_status: 'replied' } } };
const searchOut = parsed.map(p => { const c = hub[p.search_body.filterGroups[0].filters[0].value]; return { total: c ? 1 : 0, results: c ? [c] : [] }; });
const dec = run('decide.js', searchOut, { 'Settings & parse': parsed });
ok(dec.length === 2 && dec[0].contact_id === '11' && dec[1].contact_id === '12', 'only un-replied leads');
const upd = runL0('crm_build_update.js', dec);
ok(upd.every(u => u.hs_body.properties.engine_status === 'replied'), 'L0 accepts replied update');
ok(runL0('log_shape.js', run('log.js', [], { Decide: dec })).every(r => r.event === 'replied'), 'log rows');
const al = run('alert.js', [], { Decide: dec });
ok(al.length === 2 && !al[1].html.includes('<script>') && al[1].html.includes('how much?'), 'alert escaped');
ok(al.every(a => a.subject.startsWith('[REPLY]') && a.to === 'team@x.com'), 'alert fields');
// the alert itself landing back in the inbox must be ignored
ok(run('parse.js', [{ from: al[0].from, subject: al[0].subject, textPlain: 'x' }], {}, P).length === 0, 'own [REPLY] alert ignored');
console.log(`L3 sim: ${checks} checks passed. 6 inbox emails -> 2 own skipped, 1 unknown sender dropped, 1 already-replied dropped, 2 marked replied + alerted.`);
