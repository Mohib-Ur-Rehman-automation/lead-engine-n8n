// Keep only senders who are leads in HubSpot and haven't been marked replied yet.
// (Already-replied leads don't trigger a second alert.)
const parsed = $('Settings & parse').all();
const out = [];
const done = new Set();   // two emails from the same lead in one check -> one update, one alert
$input.all().forEach((it, i) => {
  const c = (it.json.results || [])[0];
  const p = parsed[i] && parsed[i].json;
  if (!c || !p) return;
  const props = c.properties || {};
  if (props.engine_status === 'replied' || done.has(String(c.id))) return;
  done.add(String(c.id));
  out.push({ json: {
    action: 'crm_update',
    data: { contact_id: String(c.id), properties: { engine_status: 'replied' } },
    contact_id: String(c.id), from: p.from, subject: p.subject, snippet: p.snippet,
    name: [props.firstname, props.lastname].filter(Boolean).join(' ') || p.from,
    phone: props.phone || '', city: props.city || '', tier: props.lead_tier || '', score: props.lead_score || '',
    stage: props.followup_stage || '0', settings: p.settings,
  } });
});
return out;
