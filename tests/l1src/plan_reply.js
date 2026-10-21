// One first reply per contact: only new contacts with an email get it.
const s = $('Intake: settings & normalize').first().json.settings;
const crm = $input.first().json;
const L = $('L0: process').first().json.lead;
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const first = String(L.name || '').split(' ')[0] || 'there';

// ---- Brand email shell (light, email-safe: tables + inline styles) ----
const F = "'DM Sans','Helvetica Neue',Arial,sans-serif", H = "'DM Serif Display',Georgia,'Times New Roman',serif";
const shell = ({ pre, title, body }) => `<!doctype html><html><body style="margin:0;padding:0;background:#F6F8F7">
<span style="display:none;max-height:0;overflow:hidden">${esc(pre)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8F7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #DFE6E4;border-radius:12px">
<tr><td style="height:4px;line-height:4px;font-size:0;background:#E0A21B;border-radius:12px 12px 0 0">&nbsp;</td></tr>
<tr><td style="padding:24px 32px 0;font-family:${H};font-size:20px;line-height:28px;color:#0F2624"><span style="display:inline-block;width:18px;height:9px;background:#E0A21B;border-radius:9px 9px 0 0;margin-right:8px;vertical-align:middle"></span>${esc(s.BRAND)}</td></tr>
<tr><td style="padding:24px 32px 0;font-family:${H};font-size:28px;line-height:36px;color:#0F2624">${title}</td></tr>
<tr><td style="padding:12px 32px 24px;font-family:${F};font-size:16px;line-height:26px;color:#0F2624">${body}</td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #DFE6E4;font-family:${F};font-size:14px;line-height:20px;color:#4E6260">${esc(s.BRAND)} is a demo business used to showcase an automation. No real service is offered.</td></tr>
</table></td></tr></table></body></html>`;
const p = t => `<p style="margin:0 0 16px">${t}</p>`;

// What they told us (only known answers are shown).
const LABELS = {
  monthly_bill: ['Monthly bill', { under_10k: 'Under Rs 10,000', '10k_25k': 'Rs 10,000 to 25,000', '25k_50k': 'Rs 25,000 to 50,000', '50k_100k': 'Rs 50,000 to 100,000', over_100k: 'Over Rs 100,000' }],
  timeline: ['Timeline', { now: 'As soon as possible', '1_3_months': 'In 1 to 3 months', '3_6_months': 'In 3 to 6 months', researching: 'Just researching' }],
  property_type: ['Property', { house: 'House', business: 'Business', apartment: 'Apartment' }],
  ownership: ['Ownership', { owner: 'You own it', renter: 'You rent it' }],
};
const facts = Object.entries(LABELS).map(([k, [label, map]]) => map[L[k]] ? [label, map[L[k]]] : null).filter(Boolean);
if (L.city) facts.push(['City', L.city]);
const factRows = facts.map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;font-family:${F};font-size:14px;line-height:20px;color:#4E6260;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-family:${F};font-size:16px;line-height:24px;color:#0F2624">${esc(v)}</td></tr>`).join('');
const factBox = factRows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF4F2;border-radius:8px;margin:8px 0 24px"><tr><td style="padding:16px 20px">
<div style="font-family:${F};font-size:14px;line-height:20px;font-weight:700;color:#0F2624;margin-bottom:4px">What you told us</div>
<table role="presentation" cellpadding="0" cellspacing="0">${factRows}</table></td></tr></table>` : '';
const step = (n, t) => `<tr><td style="padding:0 12px 12px 0;vertical-align:top"><span style="display:inline-block;width:24px;height:24px;line-height:24px;border-radius:12px;background:#145A55;color:#FFFFFF;text-align:center;font-family:${F};font-size:14px;font-weight:700">${n}</span></td><td style="padding:0 0 12px;font-family:${F};font-size:16px;line-height:24px;color:#0F2624">${t}</td></tr>`;

const body = p(`We have your solar request${L.city ? ` for <b>${esc(L.city)}</b>` : ''}. A solar advisor will call you within <b>one working hour</b> (9 am to 7 pm, Monday to Saturday).`)
  + factBox
  + `<div style="font-family:${F};font-size:16px;line-height:24px;font-weight:700;color:#0F2624;margin:0 0 12px">What happens next</div>
<table role="presentation" cellpadding="0" cellspacing="0">${step(1, 'We call to confirm a few details about your roof and usage.')}${step(2, 'We book a free site survey: roof, shade and meter.')}${step(3, 'You get a written quote sized to your bill.')}</table>`
  + p(`<span style="display:inline-block;margin-top:8px">Want to speed things up? Reply to this email with a photo of your latest electricity bill.</span>`)
  + `<p style="margin:0">The ${esc(s.BRAND)} team</p>`;

return [{ json: {
  send: crm.is_new === true && !!L.email,
  contact_id: crm.contact_id,
  to: L.email,
  from: `${s.BRAND} <${s.FROM_EMAIL}>`,
  subject: `We got your solar request, ${first}`,
  html: shell({ pre: 'A solar advisor will call you within one working hour.', title: `Thanks, ${esc(first)}. We are on it.`, body }),
} }];
