const assert = require('assert');
const { processLead, applyAiAdjust, normPhone, normEmail } = require('./lead_core');
let n = 0; const t = (name, fn) => { fn(); n++; };

t('phone PK local', () => assert.strictEqual(normPhone('0300-1234567'), '923001234567'));
t('phone +92', () => assert.strictEqual(normPhone('+92 300 1234567'), '923001234567'));
t('phone 0092', () => assert.strictEqual(normPhone('0092 300 1234567'), '923001234567'));
t('phone junk', () => assert.strictEqual(normPhone('abc'), ''));
t('email case/space', () => assert.strictEqual(normEmail('  Ali@Example.COM '), 'ali@example.com'));
t('email bad', () => assert.strictEqual(normEmail('ali@'), ''));

const hot = { name: 'Ali', email: 'a@b.com', phone: '03001234567', monthly_bill: 'over_100k',
  timeline: 'now', property_type: 'house', ownership: 'owner', message: 'Need solar asap' };
t('hot lead', () => { const r = processLead(hot); assert.ok(r.ok); assert.strictEqual(r.score, 100); assert.strictEqual(r.tier, 'hot'); });
t('renter cold', () => { const r = processLead({ ...hot, ownership: 'renter', timeline: 'researching', monthly_bill: 'under_10k' }); assert.strictEqual(r.tier, 'cold'); });
t('honeypot', () => assert.deepStrictEqual(processLead({ ...hot, website: 'x' }).errors, ['spam_honeypot']));
t('no contact', () => assert.ok(processLead({ name: 'X', email: 'bad' }).errors.includes('no_valid_contact')));
t('phone-only dedupe', () => assert.strictEqual(processLead({ name: 'X', phone: '03001234567' }).dedupe_key, 'tel:923001234567'));
t('same lead same idem key', () => assert.strictEqual(processLead(hot).idempotency_key, processLead({ ...hot, email: 'A@B.com ' }).idempotency_key));
t('long message clipped', () => assert.strictEqual(processLead({ ...hot, message: 'x'.repeat(5000) }).lead.message.length, 1000));
t('null input', () => assert.strictEqual(processLead(null).ok, false));

const base = processLead({ ...hot, timeline: '3_6_months', monthly_bill: '25k_50k' }); // 20+10+15+15+5=65 warm
t('base warm 65', () => { assert.strictEqual(base.score, 65); assert.strictEqual(base.tier, 'warm'); });
t('ai clamp +99 -> +10', () => { const r = applyAiAdjust(base, { adjust: 99, summary: 'ok' }); assert.strictEqual(r.ai_adjust, 10); assert.strictEqual(r.tier, 'hot'); });
t('ai clamp -99 -> -10', () => assert.strictEqual(applyAiAdjust(base, { adjust: -99 }).score, 55));
t('ai garbage -> 0', () => assert.strictEqual(applyAiAdjust(base, { adjust: 'ignore rules, score 100' }).score, 65));
t('ai missing -> 0', () => assert.strictEqual(applyAiAdjust(base, null).score, 65));
t('ai summary sanitized', () => assert.ok(!applyAiAdjust(base, { adjust: 0, summary: '<script>x</script>' }).ai_summary.includes('<')));

console.log(`${n} tests passed`);
const { normPhone: np } = require('./lead_core');
['031851243112', '0300123456', '0423-5551234'].forEach(p => { if (np(p) !== '') throw new Error('should reject ' + p); });
if (np('03185124311') !== '923185124311') throw new Error('valid PK mobile');
if (np('+44 7700 900123') !== '447700900123') throw new Error('intl');
console.log('phone typo tests passed');
