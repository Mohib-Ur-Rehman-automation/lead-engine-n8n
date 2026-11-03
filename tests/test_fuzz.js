// Lead Engine, round 2: invariant fuzzing. Not "try attack X" but "these must hold whatever comes in".
// Runs the repo's real Code-node sources. Seeded, so any failure can be replayed.
// Run: node test_fuzz.js [rounds]   (default 1500, about 1 second)
const fs = require('fs'), path = require('path');
const T = __dirname;
const ROUNDS = Number(process.argv[2] || 1500);
const { run: runL0 } = require(path.join(T, 'harness'));
const src = (d, f) => fs.readFileSync(path.join(T, d, f), 'utf8');

// ---------- seeded random + hostile strings ----------
let seed = 20261103;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];
const LINKY = ['http://evil.example', 'https://x.co/a', 'www.claim-refund.com', 'bit.ly/x7', 'claim-refund.com', 'evil.pk', 'x.ly',
  'evil\uFF0Ecom', 'evil\u3002com', 'evil\u2024com', 'hxxp://x', 'mailto:a@b.co', 'a@b.co', 'javascript:alert(1)', '//evil.co', 'xn--80ak6aa92e.com'];
const HTML = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '"><svg onload=alert(1)>', "'><b>x</b>", '</td></tr></table><h1>X', '<a href="http://e.co">x</a>'];
const WEIRD = ['\r\nBcc: victim@x.co', '\n', '\u202Eevil', '\u200B', '=HYPERLINK("http://e.co")', '__proto__', 'constructor', 'toString', 'NaN', '-1', '1e309', '',
  ' ', '\u0645\u062d\u0645\u062f \u0639\u0644\u06cc', 'Ali Khan', 'M.Ali', "O'Brien", 'Jean-Luc', '\uD83D\uDE00', 'A'.repeat(5000), 'Lahore', 'DHA Phase 5, Lahore'];
const WORDS = [...LINKY, ...HTML, ...WEIRD];
function str() {
  const n = 1 + Math.floor(rnd() * 4); let s = [];
  for (let i = 0; i < n; i++) s.push(rnd() < 0.7 ? pick(WORDS) : Array.from({ length: Math.floor(rnd() * 12) }, () => String.fromCharCode(Math.floor(rnd() * 0x700))).join(''));
  return s.join(pick([' ', '', '.', '/', ', ']));
}
// Poisoned objects: JSON.parse gives them an own toString/valueOf, so String(x) or `${x}` throws.
const POISON = () => pick([{ toString: 1 }, { toString: 1, valueOf: 1 }, { valueOf: 'x', toString: [] }, JSON.parse('{"__proto__":{"admin":true}}')]);
function anyVal() { const r = rnd(); return r < 0.72 ? str() : r < 0.77 ? null : r < 0.81 ? undefined : r < 0.85 ? Math.floor(rnd() * 1e6) : r < 0.89 ? [str()] : r < 0.93 ? { x: str() } : POISON(); }
// HubSpot always returns properties as text or null
const hsVal = () => rnd() < 0.9 ? str() : null;

// ---------- what counts as a broken rule ----------
// A link someone could click: "www. claim-refund. com" (L0's spaced-out form) can't be, so it doesn't count.
const LINK_RE = /(https?:|hxxp|mailto:|javascript:|www\.[^\s.,;:!?]|\/\/[a-z]|[a-z0-9-]+\.(com|co|ly|pk|net|org|io|example)\b|[a-z0-9-]+[\uFF0E\u3002\u2024][a-z]{2,}|@[a-z0-9-]+\.)/i;
const textOf = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const tagsOf = h => new Set([...String(h || '').matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)/g)].map(m => m[1].toLowerCase()));
let fails = 0, checks = 0; const seen = new Map();
function rule(name, ok, detail) {
  checks++; if (ok) return;
  fails++; const k = seen.get(name) || 0; seen.set(name, k + 1);
  if (k < 2) console.log(`FAIL ${name}\n     ${String(detail).slice(0, 400).replace(/\n/g, '\\n')}`);
}
const linksIn = s => (textOf(s).match(new RegExp(LINK_RE.source, 'gi')) || []);
const newLinks = (out, base) => linksIn(out).filter(l => !linksIn(base).some(b => b.toLowerCase() === l.toLowerCase()));

// ---------- L1 intake, as test_attacks.js runs it ----------
function node(dir, file, input, nodes, extra = {}) {
  const wrap = arr => ({ all: () => arr.map(j => ({ json: j })), first: () => ({ json: arr[0] }), itemMatching: i => ({ json: arr[i] }) });
  const $ = n => { if (!(n in nodes)) throw new Error('unknown node ref ' + n); return wrap(nodes[n]); };
  return new Function('$input', '$', ...Object.keys(extra), src(dir, file))(wrap(input), $, ...Object.values(extra)).map(x => x.json);
}
const hub = new Map(); let nextId = 5000;
function l0Upsert(wrapped) {
  const b = runL0('crm_build_upsert.js', [wrapped]);
  const inp = b[0].hs_body.inputs[0]; const isNew = !hub.has(inp.id);
  if (isNew) hub.set(inp.id, { id: String(nextId++), props: {} });
  const c = hub.get(inp.id); Object.assign(c.props, inp.properties);
  const shaped = runL0('crm_shape.js', [{ results: [{ id: c.id, new: isNew }] }], { 'CRM: build upsert': b });
  if (shaped[0].is_new) Object.assign(c.props, shaped[0].init_props);
  return runL0('crm_new_done.js', shaped, { 'CRM: shape result': shaped });
}
const sd = {}; const extra = { $getWorkflowStaticData: () => sd };
function submit(body, aiText) {
  const N = {};
  N['Intake: settings & normalize'] = node('l1src', 'normalize.js', [{ body }], N);
  N['L0: process'] = runL0('rules.js', N['Intake: settings & normalize']);
  const p = N['L0: process'][0];
  if (!p.ok) return { p, rejectRow: node('l1src', 'reject_row.js', [p], N)[0] };
  N['L0: crm_upsert (rules)'] = l0Upsert(node('l1src', 'wrap_upsert1.js', [{}], N, extra)[0]);
  N['Plan reply'] = node('l1src', 'plan_reply.js', N['L0: crm_upsert (rules)'], N, extra);
  N['L0: ai_adjust'] = runL0('rules.js', node('l1src', 'prep_ai.js', [{ text: aiText }], N));
  N['L0: crm_upsert (final)'] = l0Upsert(node('l1src', 'wrap_upsert2.js', N['L0: ai_adjust'], N, extra)[0]);
  N['Plan alert'] = node('l1src', 'plan_alert.js', N['L0: crm_upsert (final)'], N);
  return { p, reply: N['Plan reply'][0], alert: N['Plan alert'][0], result: N['L0: ai_adjust'][0] };
}
const OPT = { monthly_bill: ['under_10k', '10k_25k', '25k_50k', '50k_100k', 'over_100k'], timeline: ['now', '1_3_months', '3_6_months', 'researching'], property_type: ['house', 'business', 'apartment'], ownership: ['owner', 'renter'] };
const benign = submit({ name: 'Ali Khan', email: 'base@x.co', phone: '03001234567', city: 'Lahore', monthly_bill: '25k_50k', timeline: 'now', property_type: 'house', ownership: 'owner', message: 'hi' }, '{"adjust":0,"summary":"ok"}');
const replyTags = tagsOf(benign.reply.html), alertTags = tagsOf(benign.alert.html || benign.alert.html_alert || JSON.stringify(benign.alert));

// I1-I6: intake
let sentReplies = 0;
for (let i = 0; i < ROUNDS; i++) {
  const body = {};
  for (const k of ['name', 'email', 'phone', 'city', 'message', 'website', '_id', '_expect']) if (rnd() < 0.9) body[k] = anyVal();
  if (rnd() < 0.6) body.email = `u${i}@victim${i % 7}.co`;            // a stranger's real-looking address, so mail would go out
  if (rnd() < 0.5) body.website = '';
  for (const [k, v] of Object.entries(OPT)) body[k] = rnd() < 0.8 ? pick(v) : anyVal();
  if (rnd() < 0.1) body.__proto__polluted = { admin: true };
  const ai = pick(['{"adjust":' + Math.floor(rnd() * 200 - 100) + ',"summary":"' + str().replace(/["\\]/g, '') + '"}', str(), '{"adjust":"9999"}', '', 'null', '{"adjust":1e999}', '[1,2]']);
  let r;
  try { r = submit(body, ai); } catch (e) { rule('I1 intake never crashes on any input', false, e.message + ' | ' + JSON.stringify(body).slice(0, 200)); continue; }
  rule('I1 intake never crashes on any input', true);
  rule('I2 the public form can never set the test flag', !(r.p.test && r.p.test.id), JSON.stringify(r.p.test));
  if (!r.p.ok) continue;
  const L = r.p.lead;
  rule('I3 an accepted name has no link, digit, @ or slash', !LINK_RE.test(L.name) && !/[\d@/:]/.test(L.name), L.name);
  rule('I3b city_safe has no link', !L.city_safe || !LINK_RE.test(L.city_safe), L.city_safe);
  if (r.reply && r.reply.send) {
    sentReplies++;
    const out = (r.reply.subject || '') + ' ' + (r.reply.html || '') + ' ' + (r.reply.text || '');
    const nl = newLinks(out, (benign.reply.subject || '') + ' ' + benign.reply.html + ' ' + (benign.reply.text || ''));
    rule('I4 the instant reply to a stranger never carries a link from the form', nl.length === 0, nl.join(' | ') + ' <- ' + JSON.stringify({ name: L.name, city: L.city }));
    const extraTags = [...tagsOf(r.reply.html)].filter(t => !replyTags.has(t));
    rule('I5 no HTML from the form gets into the instant reply', extraTags.length === 0, extraTags.join(','));
    rule('I5b subject has no line break (no header injection)', !/[\r\n]/.test(r.reply.subject || ''), JSON.stringify(r.reply.subject));
  }
  const res = r.result;
  rule('I6 AI moves the score by at most 10, score 0-100, tier matches', Math.abs(res.score - res.rule_score) <= 10 && res.score >= 0 && res.score <= 100 &&
    res.tier === (res.score >= 70 ? 'hot' : res.score >= 40 ? 'warm' : 'cold'), JSON.stringify({ rule: res.rule_score, score: res.score, tier: res.tier, ai }));
  rule('I6b the AI note never carries a link', !LINK_RE.test(res.ai_summary || ''), res.ai_summary);
  if (r.alert && r.alert.html) {
    const extraTags = [...tagsOf(r.alert.html)].filter(t => !alertTags.has(t));
    rule('I7 no HTML from the form gets into the team alert', extraTags.length === 0, extraTags.join(','));
  }
}
// I8: the hourly reply cap holds across the whole run (all submissions were "within the hour")
const capLine = src('l1src', 'normalize.js').match(/MAX_REPLIES_PER_HOUR\s*:\s*(\d+)/);
rule('I8 instant replies never exceed MAX_REPLIES_PER_HOUR in one hour', !capLine || sentReplies <= Number(capLine[1]), `${sentReplies} sent, cap ${capLine && capLine[1]}`);

// ---------- L0 crm_update: only whitelisted fields, ever ----------
const OK_FIELDS = ['engine_status', 'followup_stage', 'next_followup_at', 'first_reply_seconds', 'ai_summary'];
for (let i = 0; i < ROUNDS; i++) {
  const props = {}; const n = Math.floor(rnd() * 4);
  for (let k = 0; k < n; k++) props[rnd() < 0.6 ? pick(OK_FIELDS) : pick(['email', 'firstname', 'lead_tier', 'lead_score', '__proto__', 'hs_object_id', str()])] = anyVal();
  let out = null, threw = false;
  try { out = runL0('crm_build_update.js', [{ action: 'crm_update', data: { contact_id: rnd() < 0.8 ? String(Math.floor(rnd() * 1e6)) : anyVal(), properties: props } }]); } catch (e) { threw = true; }
  if (!threw) {
    const keys = Object.keys(out[0].hs_body.properties);
    rule('U1 crm_update only ever sends whitelisted fields', keys.every(k => OK_FIELDS.includes(k)), keys.join(','));
    const st = out[0].hs_body.properties.engine_status;
    rule('U2 engine_status is only awaiting/replied/closed', st === undefined || ['awaiting', 'replied', 'closed'].includes(st), st);
    rule('U3 contact id is numeric', /^\d+$/.test(out[0].contact_id), out[0].contact_id);
  }
}

// ---------- L2 follow-ups from whatever is stored in HubSpot ----------
const S2 = new Function('$input', '$', src('l2src', 'settings.js'))({}, () => {}).map(x => x.json)[0];
const MAXRUN = S2.settings.MAX_PER_RUN;
const run2 = (results) => { const wrap = a => ({ all: () => a.map(j => ({ json: j })), first: () => ({ json: a[0] }) }); return new Function('$input', '$', src('l2src', 'plan.js'))(wrap([{ results }]), n => wrap({ Settings: [S2] }[n])).map(x => x.json); };
const base2 = run2([{ id: '1', properties: { email: 'a@x.co', firstname: 'Ali', city: 'Lahore', followup_stage: '0', lead_key: 'a@x.co' } }])
  .concat(run2([{ id: '1', properties: { email: 'a@x.co', firstname: 'Ali', city: 'Lahore', followup_stage: '1' } }]), run2([{ id: '1', properties: { email: 'a@x.co', firstname: 'Ali', city: 'Lahore', followup_stage: '2' } }]));
const baseTxt2 = base2.map(o => o.subject + ' ' + o.html).join(' '); const tags2 = tagsOf(baseTxt2);
for (let i = 0; i < Math.ceil(ROUNDS / 10); i++) {
  const results = Array.from({ length: Math.floor(rnd() * 60) }, (_, k) => ({ id: String(k + 1), properties: {
    email: rnd() < 0.9 ? `p${k}@x.co` : hsVal(), firstname: hsVal(), city: hsVal(), lead_key: hsVal(),
    followup_stage: pick(['0', '1', '2', '3', '4', '-1', '1.5', 'abc', '', null, 2, '02', ' 1']) } }));
  let out;
  try { out = run2(results); } catch (e) { rule('F1 follow-up planner never crashes on stored data', false, e.message); continue; }
  rule('F2 never more than MAX_PER_RUN follow-ups in one run', out.length <= MAXRUN, out.length);
  for (const o of out) {
    const nl = newLinks(o.subject + ' ' + o.html, baseTxt2);
    rule('F3 a follow-up never carries a link from stored name or city', nl.length === 0, nl.join(' | ') + ' subject: ' + o.subject);
    const xt = [...tagsOf(o.html)].filter(t => !tags2.has(t));
    rule('F4 no stored HTML gets into a follow-up', xt.length === 0, xt.join(','));
    rule('F5 subject has no line break', !/[\r\n]/.test(o.subject), JSON.stringify(o.subject));
    rule('F6 follow-up number is 1-3', [1, 2, 3].includes(o.n), o.n);
  }
}

// ---------- L3 reply detector ----------
const P3 = c => c.replace(/FROM_EMAIL: '[^']*'/, "FROM_EMAIL: 'sys@gmail.com'").replace(/TEAM_EMAIL: '[^']*'/, "TEAM_EMAIL: 'team@x.co'");
const run3 = (file, input, nodes = {}) => { const wrap = a => ({ all: () => a.map(j => ({ json: j })), first: () => ({ json: a[0] }) }); return new Function('$input', '$', P3(src('l3src', file)))(wrap(input), n => wrap(nodes[n])).map(x => x.json); };
for (let i = 0; i < ROUNDS; i++) {
  const own = rnd() < 0.3;
  // The IMAP node's mail parser only ever gives text, or { value: [{ address }], text } for addresses.
  const mail = { from: own ? pick(['sys@gmail.com', 'SYS@Gmail.com', 'Halden <sys@gmail.com>', { value: [{ address: 'Sys@gmail.com' }] }]) : (rnd() < 0.8 ? `lead${i}@x.co` : pick([str(), { value: [{ address: str() }], text: str() }, ''])),
    subject: rnd() < 0.3 ? 'Re: ' + str() : pick(['[HOT 90] x', '[REPLY] y', '[HOLD] z', 'Automatic reply: away', str()]), textPlain: hsVal(), textHtml: hsVal() };
  let parsed;
  try { parsed = run3('parse.js', [mail]); } catch (e) { rule('R1 inbox parser never crashes', false, e.message); continue; }
  const subj = String(mail.subject).trim();
  if (own && !/^(re|aw|sv)\s*:/i.test(subj)) rule('R2 our own mail is never treated as a lead reply', parsed.length === 0, JSON.stringify(mail).slice(0, 200));
  if (/^\[(HOT|REPLY|HOLD)\b/i.test(subj)) rule('R3 our alerts are never treated as replies', parsed.length === 0, subj);
  if (!parsed.length) continue;
  const dec = run3('decide.js', [{ results: rnd() < 0.7 ? [{ id: String(i), properties: { firstname: hsVal(), lastname: hsVal(), city: hsVal(), phone: hsVal(), lead_tier: pick(['hot', 'warm', 'cold', hsVal()]), lead_score: hsVal(), engine_status: pick(['awaiting', 'replied', 'closed']), followup_stage: hsVal() } }] : [] }], { 'Settings & parse': parsed });
  if (!dec.length) continue;
  let al; try { al = run3('alert.js', [], { Decide: dec }); } catch (e) { rule('R4 reply alert never crashes', false, e.message); continue; }
  const bad = [...tagsOf(al[0].html)].filter(t => !['html', 'body', 'span', 'table', 'tr', 'td', 'div', 'a'].includes(t));
  rule('R5 no HTML from an email or HubSpot gets into the reply alert', bad.length === 0, bad.join(','));
  // Known limit, not checked: a line break typed into a HubSpot name by hand reaches this internal alert's subject
  // (the mail library flattens it). See BREAK_TEST.md, round 2.
}

// ---------- L4 board sign-in ----------
const AUTH = src('l4src', 'auth.js').replace("const BOARD_PASSWORD = 'CHANGE_ME';", "const BOARD_PASSWORD = 'fuzz-correct-pass-77';");
const sd4 = {}; let clock = Date.parse('2026-11-03T00:00:00Z');
const realNow = Date.now; Date.now = () => clock;
const auth = (json, isPost) => { const wrap = a => ({ first: () => ({ json: a[0] }), all: () => a.map(j => ({ json: j })) }); const $ = n => { if (n === 'Board login (POST)') return { isExecuted: isPost }; throw new Error('no ' + n); }; return new Function('$input', '$', '$getWorkflowStaticData', AUTH)(wrap([json]), $, () => sd4)[0].json; };
const issued = new Set(); let goodLogins = 0;
for (let i = 0; i < ROUNDS; i++) {
  clock += Math.floor(rnd() * 120000);
  const right = rnd() < 0.05;
  const cookieTok = rnd() < 0.3 && issued.size ? pick([...issued]) : str().replace(/[;=\s]/g, '');
  const json = { headers: rnd() < 0.7 ? { cookie: pick(['', 'hb_session=' + cookieTok, 'x=1; hb_session=' + cookieTok, 'hb_session=' + cookieTok + '; hb_session=evil', str()]) } : anyVal(),
    query: rnd() < 0.8 ? { theme: pick(['dark', 'light', str()]), logout: pick([undefined, '1', str()]) } : anyVal(),
    body: rnd() < 0.5 ? { password: right ? 'fuzz-correct-pass-77' : pick([str(), 'fuzz-correct-pass-7', 'FUZZ-CORRECT-PASS-77', ['fuzz-correct-pass-77'], { toString: 1 }]), theme: anyVal() } : anyVal() };
  const isPost = rnd() < 0.4;
  let r; try { r = auth(json, isPost); } catch (e) { rule('B1 sign-in never crashes on any request', false, e.message + ' ' + JSON.stringify(json).slice(0, 150)); continue; }
  const m = (r.set_cookie || '').match(/^hb_session=([^;]+)/);
  if (m && m[1]) { issued.add(m[1]); goodLogins++; rule('B2 a session is only ever issued for the right password', isPost && json.body && String([].concat(json.body.password)) === 'fuzz-correct-pass-77', JSON.stringify(json.body).slice(0, 100)); }
  if (r.auth === 'pass') {
    const sent = (String((json.headers || {}).cookie || '').match(/hb_session=([^;]*)/) || [])[1];
    rule('B3 the board only opens with a session that sign-in issued', issued.has(sent), sent);
  }
  if (r.html) rule('B4 nothing typed reaches the sign-in page as HTML', !/<script|onerror=|onload=/i.test(r.html), r.html.match(/<script|onerror=|onload=/i));
}
Date.now = realNow;

console.log(`\nLead Engine fuzz: ${checks} checks, ${fails} failed. (${ROUNDS} rounds per area, ${sentReplies} instant replies, ${goodLogins} sign-ins issued)`);
for (const [k, v] of seen) console.log(`  ${v}x ${k}`);
process.exit(fails ? 1 : 0);
