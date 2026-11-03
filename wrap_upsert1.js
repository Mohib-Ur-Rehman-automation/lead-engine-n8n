// Save the rules-only score first, so the reply doesn't wait for the AI.
// keep_existing: if this email/phone is already in HubSpot, change nothing on that contact.
return [{ json: { action: 'crm_upsert', data: { ...$('L0: process').first().json, keep_existing: true } } }];
