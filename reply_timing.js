// Seconds from submission to the reply leaving n8n -> HubSpot first_reply_seconds.
const p = $('Plan reply').first().json;
const received = $('Intake: settings & normalize').first().json.received_at;
const secs = Math.max(0, (Date.now() - received) / 1000);
return [{ json: { action: 'crm_update', data: { contact_id: p.contact_id, properties: { first_reply_seconds: secs } } } }];
