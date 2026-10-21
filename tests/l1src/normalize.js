// ===== SETTINGS: edit these four lines once =====
const SETTINGS = {
  L0_ID: 'PASTE_L0_ID_FROM_ADDRESS_BAR',   // L0 Core's workflow ID (copy exactly, leading letters included)
  BRAND: 'Halden Solar Co.',
  FROM_EMAIL: 'PASTE_YOUR_SMTP_EMAIL',      // the Gmail your SMTP credential sends from
  TEAM_EMAIL: 'PASTE_TEAM_ALERT_EMAIL',     // where hot-lead alerts go (can be the same Gmail)
  HUBSPOT_PORTAL_ID: '',                    // optional: the number in your HubSpot URL, adds a link to alerts
};
// =================================================

// Accepts both the n8n form (labels) and the website webhook (JSON codes, or text/plain JSON).
const FORM = {
  'Full name': 'name', 'Email': 'email', 'Phone (WhatsApp)': 'phone', 'City': 'city',
  'Monthly electricity bill': 'monthly_bill', 'When do you want solar?': 'timeline',
  'Property type': 'property_type', 'Do you own the property?': 'ownership',
  'Anything else? (English or Urdu)': 'message',
};
const OPTIONS = {
  'Under Rs 10,000': 'under_10k', 'Rs 10,000 - 25,000': '10k_25k', 'Rs 25,000 - 50,000': '25k_50k', 'Rs 50,000 - 100,000': '50k_100k', 'Over Rs 100,000': 'over_100k',
  'As soon as possible': 'now', 'In 1-3 months': '1_3_months', 'In 3-6 months': '3_6_months', 'Just researching': 'researching',
  'House': 'house', 'Business': 'business', 'Apartment': 'apartment',
  'Yes, I own it': 'owner', 'No, I rent': 'renter',
};
const KEYS = ['name', 'email', 'phone', 'city', 'monthly_bill', 'timeline', 'property_type', 'ownership', 'message', 'website', '_id'];

const it = $input.first().json;
let src = {}, source;
if (it.body !== undefined) {
  source = 'webhook';
  src = it.body;
  if (typeof src === 'string') { try { src = JSON.parse(src); } catch (e) { src = {}; } }
  if (!src || typeof src !== 'object' || Array.isArray(src)) src = {};
} else {
  source = 'form';
  for (const [label, key] of Object.entries(FORM)) if (it[label] !== undefined) src[key] = it[label];
}
const data = {};
for (const k of KEYS) {
  if (src[k] === undefined || src[k] === null) continue;
  const raw = src[k];
  let v;
  try { v = typeof raw === 'object' ? JSON.stringify(raw) : String(raw); } catch (e) { v = ''; }
  data[k] = OPTIONS[v] || v;
}
return [{ json: { settings: SETTINGS, source, received_at: Date.now(), action: 'process', data } }];
