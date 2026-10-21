// Generic contact update, used by L1/L2/L3. Only these fields may change, with checked values.
const ENUM = { engine_status: ['awaiting', 'replied', 'closed'] };
const out = [];
for (const item of $input.all()) {
  const d = item.json.data || {};
  const id = String(d.contact_id || '');
  if (!/^\d+$/.test(id)) throw new Error('L0 crm_update: contact_id must be a HubSpot numeric id, got "' + id + '"');
  const p = d.properties || {};
  const props = {};
  for (const k of Object.keys(p)) {
    const v = p[k];
    if (k === 'engine_status') {
      if (!ENUM.engine_status.includes(v)) throw new Error('L0 crm_update: bad engine_status "' + v + '"');
      props[k] = v;
    } else if (k === 'followup_stage') {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0 || n > 3) throw new Error('L0 crm_update: followup_stage must be 0-3');
      props[k] = String(n);
    } else if (k === 'first_reply_seconds') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) throw new Error('L0 crm_update: first_reply_seconds must be >= 0');
      props[k] = String(Math.round(n));
    } else if (k === 'next_followup_at') {
      const ms = typeof v === 'number' ? v : (/^\d+$/.test(String(v)) ? Number(v) : Date.parse(v));
      if (!Number.isFinite(ms)) throw new Error('L0 crm_update: next_followup_at is not a date');
      props[k] = String(ms);
    } else if (k === 'ai_summary') {
      props[k] = String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
    } else {
      throw new Error('L0 crm_update: field "' + k + '" is not allowed');
    }
  }
  if (!Object.keys(props).length) throw new Error('L0 crm_update: nothing to update');
  out.push({ json: { contact_id: id, hs_body: { properties: props } } });
}
return out;
