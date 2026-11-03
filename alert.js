// Tell the team a lead replied (follow-ups for them have already stopped).
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const F = "'DM Sans','Helvetica Neue',Arial,sans-serif", H = "'DM Serif Display',Georgia,'Times New Roman',serif";
return $('Decide').all().map(({ json: d }) => {
  const s = d.settings;
  const href = s.HUBSPOT_PORTAL_ID ? `https://app.hubspot.com/contacts/${encodeURIComponent(s.HUBSPOT_PORTAL_ID)}/record/0-1/${encodeURIComponent(d.contact_id)}` : '';
  const btn = href ? `<a href="${esc(href)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#145A55;color:#FFFFFF;font-family:${F};font-size:16px;line-height:20px;font-weight:700;text-decoration:none">Open in HubSpot</a>` : '';
  const tierBadge = d.tier ? `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${d.tier === 'hot' ? '#E0A21B' : '#EEF4F2'};color:#0F2624;font-weight:700;margin-right:8px">${esc(d.tier[0].toUpperCase() + d.tier.slice(1))} ${esc(d.score)}</span>` : '';
  const rows = [['From', d.from], ['Phone', d.phone || '—'], ['City', d.city || '—'], ['Follow-ups sent', `${d.stage} of 3`], ['Subject', d.subject]]
    .map(([k, v]) => `<tr><td style="padding:8px 16px 8px 0;border-top:1px solid #DFE6E4;font-family:${F};font-size:14px;line-height:20px;color:#4E6260;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:8px 0;border-top:1px solid #DFE6E4;font-family:${F};font-size:16px;line-height:24px;color:#0F2624">${esc(v)}</td></tr>`).join('');
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F6F8F7">
<span style="display:none;max-height:0;overflow:hidden">Follow-ups are stopped. Take it from here.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8F7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #DFE6E4;border-radius:12px">
<tr><td style="height:4px;line-height:4px;font-size:0;background:#145A55;border-radius:12px 12px 0 0">&nbsp;</td></tr>
<tr><td style="padding:24px 32px 0;font-family:${F};font-size:14px;line-height:20px;color:#4E6260">${tierBadge}Lead Engine, ${esc(s.BRAND)}</td></tr>
<tr><td style="padding:16px 32px 0;font-family:${H};font-size:28px;line-height:36px;color:#0F2624">${esc(d.name)} replied</td></tr>
<tr><td style="padding:8px 32px 16px;font-family:${F};font-size:16px;line-height:26px;color:#0F2624">Automatic follow-ups are stopped. Take it from here.</td></tr>
<tr><td style="padding:0 32px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF4F2;border-radius:8px"><tr><td style="padding:16px 20px;font-family:${F};font-size:16px;line-height:26px;color:#0F2624"><div style="font-size:14px;line-height:20px;font-weight:700;margin-bottom:4px">They wrote</div>${esc(d.snippet || '(no text)')}</td></tr></table></td></tr>
<tr><td style="padding:0 32px 8px">${btn}</td></tr>
<tr><td style="padding:8px 32px 24px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr>
</table></td></tr></table></body></html>`;
  return { json: {
    to: s.TEAM_EMAIL, from: `Lead Engine <${s.FROM_EMAIL}>`,
    subject: `[REPLY] ${d.name} replied: follow-ups stopped`,
    html,
  } };
});
