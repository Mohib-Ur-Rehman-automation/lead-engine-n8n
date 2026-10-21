// Save the final score, tier and AI summary on the same contact.
return [{ json: { action: 'crm_upsert', data: $input.first().json } }];
