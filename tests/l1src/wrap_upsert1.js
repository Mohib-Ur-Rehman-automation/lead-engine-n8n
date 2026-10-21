// Save the rules-only score first, so the reply doesn't wait for the AI.
return [{ json: { action: 'crm_upsert', data: $('L0: process').first().json } }];
