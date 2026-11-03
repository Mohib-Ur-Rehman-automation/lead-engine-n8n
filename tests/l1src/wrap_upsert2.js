// Save the final score, tier and AI summary, but only on a contact this submission just created.
// A returning contact is left as it was (see L0 "CRM: build upsert", keep_existing).
const isNew = $('L0: crm_upsert (rules)').first().json.is_new === true;
return [{ json: { action: 'crm_upsert', data: { ...$input.first().json, keep_existing: !isNew } } }];
