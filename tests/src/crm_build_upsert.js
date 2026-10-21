// Build one HubSpot upsert per lead.
// Email leads are matched BY EMAIL, so a contact that already existed in HubSpot (added by hand, imported,
// from another form) is updated instead of HubSpot refusing a 2nd contact with the same email.
// Phone-only leads are matched by the unique lead_key ("tel:...").
// Only non-empty values are sent, so a duplicate submission never blanks out existing data.
const out = [];
for (const item of $input.all()) {
  const r = item.json.data;
  if (!r || r.ok !== true || !r.dedupe_key) {
    throw new Error('L0 crm_upsert: data must be an ok result from action "process" (or "ai_adjust")');
  }
  const L = r.lead || {};
  const parts = String(L.name || '').split(' ');
  const props = {
    email: L.email,
    firstname: parts[0],
    lastname: parts.slice(1).join(' '),
    phone: L.phone ? '+' + L.phone : '',
    city: L.city,
    lead_score: r.score,
    lead_tier: r.tier,
    score_reasons: (r.reasons || []).join('; '),
    ai_summary: r.ai_summary,
    lead_key: L.email ? r.dedupe_key : undefined,   // email leads: also store the key; phone-only: it's the id below
  };
  for (const k of Object.keys(props)) {
    const v = props[k];
    if (v === undefined || v === null || v === '') delete props[k];
    else props[k] = String(v);
  }
  out.push({ json: {
    lead_key: r.dedupe_key, tier: r.tier, score: r.score,
    hs_body: { inputs: [L.email
      ? { idProperty: 'email', id: L.email, properties: props }
      : { idProperty: 'lead_key', id: r.dedupe_key, properties: props }] },
  } });
}
return out;
