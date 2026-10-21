// ===== SETTINGS: edit once =====
const SETTINGS = {
  L0_ID: 'PASTE_L0_ID_FROM_ADDRESS_BAR',
  FROM_EMAIL: 'PASTE_YOUR_SMTP_EMAIL',     // the system's own address
  TEAM_EMAIL: 'PASTE_TEAM_ALERT_EMAIL',
  HUBSPOT_PORTAL_ID: '',                   // optional, adds an "Open in HubSpot" link
};
// ===============================
// Which emails count as a lead reply?
//  - anything NOT sent by the system address, or
//  - a "Re:" reply (the system itself never sends "Re:" subjects)
// So the system's own alerts and follow-ups landing in this inbox are ignored.
function addressOf(v) {
  if (!v) return '';
  if (typeof v === 'object') {
    const a = (v.value && v.value[0] && v.value[0].address) || v.address || v.text || '';
    return addressOf(a);
  }
  const m = String(v).match(/<([^>]+)>/);
  return (m ? m[1] : String(v)).trim().toLowerCase();
}
// Machine-sent mail is never a lead reply: out-of-office, auto-replies, bounces, no-reply senders.
const AUTO_SUBJECT = /^\s*(automatic reply|auto[- ]?reply|autoreply|auto( |-)?response|auto:|out of (the )?office|ooo\b|on vacation|away from|undeliverable|undelivered|delivery (status notification|failure|has failed)|mail delivery (failed|subsystem)|returned mail|failure notice)/i;
const AUTO_SENDER = /^(mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounces?|auto-?reply)([+.@-]|$)/i;
function cleanBody(t) {
  // HTML-only emails: drop tags, keep text
  t = String(t || '').replace(/<(br|\/p|\/div)\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  // cut at the quoted thread, even when Gmail wraps "On ... wrote:" over two lines
  const cut = t.search(/(^|\n)\s*On [^\n]*(\n[^\n]*)?wrote:/);
  if (cut >= 0) t = t.slice(0, cut);
  const lines = t.split(/\r?\n/);
  const keep = [];
  for (const l of lines) {
    if (/^On .+wrote:\s*$/i.test(l.trim()) || /^-{2,}\s*Original Message/i.test(l.trim())) break;
    if (l.trim().startsWith('>')) continue;
    keep.push(l);
  }
  return keep.join(' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}
const own = SETTINGS.FROM_EMAIL.toLowerCase();
const out = [];
for (const it of $input.all()) {
  const j = it.json || {};
  const from = addressOf(j.from || (j.metadata && j.metadata.from));
  const subject = String(j.subject || '').trim();
  const isRe = /^(re|aw|sv)\s*:/i.test(subject);
  if (!from || !/@/.test(from)) continue;
  if (from === own && !isRe) continue;               // the system's own mail
  if (/^\[(HOT|REPLY)\b/i.test(subject)) continue;   // our alerts, even if forwarded
  if (AUTO_SUBJECT.test(subject) || AUTO_SENDER.test(from)) continue;   // machines, not people (marker comes first)   // machines, not people
  out.push({ json: {
    settings: SETTINGS, from, subject: subject.slice(0, 200),
    snippet: cleanBody(j.textPlain || j.text || j.textHtml || j.html),
    search_body: {
      filterGroups: [{ filters: [{ propertyName: 'lead_key', operator: 'EQ', value: from }] }],
      properties: ['firstname', 'lastname', 'phone', 'city', 'lead_tier', 'lead_score', 'engine_status', 'followup_stage'],
      limit: 1,
    },
  } });
}
return out;
