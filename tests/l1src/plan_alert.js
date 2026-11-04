// Alert the team about hot leads (final tier, after the AI's clamped nudge).
const s = $('Intake: settings & normalize').first().json.settings;
const r = $('L0: ai_adjust').first().json;
const crm = $input.first().json;
const L = r.lead;
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const F = "'DM Sans','Helvetica Neue',Arial,sans-serif", H = "'DM Serif Display',Georgia,'Times New Roman',serif";
const href = s.HUBSPOT_PORTAL_ID ? `https://app.hubspot.com/contacts/${encodeURIComponent(s.HUBSPOT_PORTAL_ID)}/record/0-1/${encodeURIComponent(crm.contact_id)}` : '';
const phone = L.phone ? '+' + L.phone : '';
const btn = (url, label, solid) => `<a href="${esc(url)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:8px;font-family:${F};font-size:16px;line-height:20px;font-weight:700;text-decoration:none;${solid ? 'background:#145A55;color:#FFFFFF' : 'border:1px solid #145A55;color:#145A55'}">${label}</a>`;
const buttons = [phone ? btn('tel:' + phone, `Call ${esc(phone)}`, true) : '', href ? btn(href, 'Open in HubSpot', !phone) : ''].join('');
const isNew = $('L0: crm_upsert (rules)').first().json.is_new;
// Score reasons in plain words: "+20 bill 25k_50k" -> "+20 bill Rs 25–50k".
const WORDS = {
  'bill under_10k': 'bill under Rs 10k', 'bill 10k_25k': 'bill Rs 10–25k', 'bill 25k_50k': 'bill Rs 25–50k',
  'bill 50k_100k': 'bill Rs 50–100k', 'bill over_100k': 'bill over Rs 100k',
  'timeline now': 'wants it now', 'timeline 1_3_months': 'timeline 1–3 months', 'timeline 3_6_months': 'timeline 3–6 months',
  'property house': 'house', 'property business': 'business', 'ownership owner': 'owns it', 'ownership renter': 'rents',
  'both contacts': 'gave phone and email', 'ai': 'AI read of the message',
};
const plain = x => {
  const t = String(x == null ? '' : x).trim();
  if (t === 'ai 0') return '';
  const m = t.match(/^([+-]?[0-9]+) (.+)$/);
  if (!m) return t;
  const w = Object.prototype.hasOwnProperty.call(WORDS, m[2]) ? WORDS[m[2]] : m[2].replace(/_/g, ' ');
  return `${m[1]} ${w}`;
};
const why = (r.reasons || []).map(plain).filter(Boolean).join(' · ') || '—';
const rows = [['Phone', phone || '—'], ['Email', L.email || '—'], ['City', L.city || '—'], ['Why hot', why],
  ['AI note', r.ai_summary || '—'], ['Message', L.message || '—'], ['Contact', isNew ? 'First time we have seen them' : 'Returning. These details were NOT saved to HubSpot (anyone can type an email into the form). Check before acting.']]
  .map(([k, v]) => `<tr><td style="padding:8px 16px 8px 0;border-top:1px solid #DFE6E4;font-family:${F};font-size:14px;line-height:20px;color:#4E6260;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:8px 0;border-top:1px solid #DFE6E4;font-family:${F};font-size:16px;line-height:24px;color:#0F2624">${esc(v)}</td></tr>`).join('');
const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F6F8F7">
<span style="display:none;max-height:0;overflow:hidden">Score ${esc(r.score)}. Call within 5 minutes.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8F7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #DFE6E4;border-radius:12px">
<tr><td style="height:4px;line-height:4px;font-size:0;background:#E0A21B;border-radius:12px 12px 0 0">&nbsp;</td></tr>
<tr><td style="padding:24px 32px 0;font-family:${F};font-size:14px;line-height:20px;color:#4E6260"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#E0A21B;color:#0F2624;font-weight:700;margin-right:8px">Hot ${esc(r.score)}</span>Lead Engine, ${esc(s.BRAND)}</td></tr>
<tr><td style="padding:16px 32px 0;font-family:${H};font-size:28px;line-height:36px;color:#0F2624">${esc(L.name)}${L.city ? `, ${esc(L.city)}` : ''}</td></tr>
<tr><td style="padding:8px 32px 16px;font-family:${F};font-size:16px;line-height:26px;color:#0F2624">Call within 5 minutes. Leads cool fast.</td></tr>
<tr><td style="padding:0 32px 8px">${buttons}</td></tr>
<tr><td style="padding:8px 32px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
</table></td></tr></table></body></html>`;
const cap = $('Plan reply').first().json.cap_warning === true;
return [{ json: {
  send: r.tier === 'hot' || cap,
  to: s.TEAM_EMAIL,
  from: `Lead Engine <${s.FROM_EMAIL}>`,
  subject: cap ? `[HOLD] Over ${s.MAX_REPLIES_PER_HOUR} leads this hour: instant replies paused. Latest: ${L.name}` : `[HOT ${r.score}] ${L.name}${L.city ? ', ' + L.city : ''}: call now`,
  html,
} }];
