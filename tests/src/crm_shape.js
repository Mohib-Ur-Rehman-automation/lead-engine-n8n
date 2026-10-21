// Turn HubSpot's upsert reply into a small, predictable result.
// New contacts also get their starting follow-up state (set in the next step).
const built = $('CRM: build upsert').all();
return $input.all().map((it, i) => {
  const res = (it.json.results || [])[0] || {};
  if (!res.id) throw new Error('L0 crm_upsert: HubSpot returned no contact id: ' + JSON.stringify(it.json).slice(0, 300));
  const b = built[i] ? built[i].json : {};
  return { json: {
    ok: true,
    contact_id: String(res.id),
    is_new: res.new === true,
    lead_key: b.lead_key,
    tier: b.tier,
    score: b.score,
    init_props: {
      engine_status: 'awaiting',
      followup_stage: '0',
      next_followup_at: String(Date.now() + 24 * 3600 * 1000),
    },
  } };
});
