return $input.all().map(i => ({ json: { action: 'crm_upsert', data: i.json } }));
