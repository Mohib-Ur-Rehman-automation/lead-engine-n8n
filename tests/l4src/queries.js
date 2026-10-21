// ===== SETTINGS: edit once =====
const SETTINGS = {
  BRAND: 'Halden Solar Co.',
  FROM_EMAIL: 'PASTE_YOUR_SMTP_EMAIL',
  TEAM_EMAIL: 'PASTE_TEAM_ALERT_EMAIL',
  HUBSPOT_PORTAL_ID: '',               // optional: makes lead names clickable on the board
};
// ===============================
// Board (opened in a browser) looks at the last 7 days; the 8 AM digest at the last 24 hours.
const it = $input.first().json || {};
const mode = it.headers !== undefined ? 'board' : 'digest';
const now = Date.now();
const since = now - (mode === 'board' ? 7 : 1) * 24 * 3600 * 1000;
const PROPS = ['firstname', 'lastname', 'city', 'lead_score', 'lead_tier', 'engine_status', 'followup_stage',
  'first_reply_seconds', 'ai_summary', 'createdate', 'email', 'phone'];
const status = s => ({ filterGroups: [{ filters: [{ propertyName: 'engine_status', operator: 'EQ', value: s }] }], limit: 1, properties: ['engine_status'] });
const queries = [
  { key: 'recent', body: { filterGroups: [{ filters: [
      { propertyName: 'lead_key', operator: 'HAS_PROPERTY' },
      { propertyName: 'createdate', operator: 'GTE', value: String(since) }] }],
    sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }], properties: PROPS, limit: 100 } },
  { key: 'awaiting', body: status('awaiting') },
  { key: 'replied', body: status('replied') },
  { key: 'closed', body: status('closed') },
];
return queries.map(q => ({ json: { mode, now, since, settings: SETTINGS, key: q.key, search_body: q.body } }));
