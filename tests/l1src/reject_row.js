// Rejected lead -> one row in the Rejects tab (via L0 log).
const r = $input.first().json;
const intake = $('Intake: settings & normalize').first().json;
const L = r.lead || {};
return [{ json: { action: 'log', data: { tab: 'Rejects', row: {
  errors: r.errors || [], name: L.name, email: L.email, phone: L.phone, test_id: intake.data._id || '',
} } } }];
