// L0 Rules: the ONLY place lead rules live.
// Actions handled here: "process" (validate + score) and "ai_adjust" (clamp the AI's opinion).
// Pure code: no network, no AI. The AI can only nudge the score through applyAiAdjust().

const RULES = {
  version: '1.1',
  tiers: { hot: 70, warm: 40 },          // score >= 70 hot, >= 40 warm, else cold
  aiMaxAdjust: 10,                       // AI may move the score by at most ±10
  maxField: { name: 80, email: 120, phone: 20, city: 60, message: 1000 },
};

// Plain text only: objects/arrays become '', control + invisible/bidi characters are removed,
// and text is cut by whole characters so an emoji is never split in half.
const INVISIBLE = /[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
function clean(s, max) {
  if (s === null || s === undefined || typeof s === 'object' || typeof s === 'function') return '';
  return Array.from(String(s).replace(INVISIBLE, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('').trim();
}

function normEmail(e) {
  const v = clean(e, RULES.maxField.email).toLowerCase();
  // local part: no leading/trailing/double dots; domain: real labels (letters, digits, inner hyphens) + a letter TLD
  return /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(v) ? v : '';
}

// Pakistani + international numbers -> digits with country code. 03xx... -> 923xx...
function normPhone(p) {
  let d = clean(p, 40).replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('00')) d = d.slice(2);
  if (/^03\d{9}$/.test(d)) d = '92' + d.slice(1);   // valid PK mobile, local format
  else if (d.startsWith('0')) return '';             // any other local-format number is a typo
  return d.length >= 10 && d.length <= 15 ? d : '';
}

function fnv1a(str) {               // stable short hash for idempotency keys
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

// Monthly bill bands sized for Pakistan 2026 (most rooftop-solar buyers pay Rs 25k+; 10 kW systems target ~Rs 50k+ bills).
const BILL = { 'under_10k': 0, '10k_25k': 10, '25k_50k': 20, '50k_100k': 30, 'over_100k': 35 };
const TIMELINE = { 'now': 30, '1_3_months': 20, '3_6_months': 10, 'researching': 0 };
const PROPERTY = { 'house': 15, 'business': 15, 'apartment': 0 };
const OWNER = { 'owner': 15, 'renter': -20 };
// Only the listed answers score points. Own-property check, so values like "__proto__" or "toString" score 0.
const pts = (map, k) => Object.prototype.hasOwnProperty.call(map, k) ? map[k] : 0;

function ruleScore(l) {
  const reasons = [];
  let s = 0;
  const add = (pts, why) => { s += pts; if (pts) reasons.push(`${pts > 0 ? '+' : ''}${pts} ${why}`); };
  add(pts(BILL, l.monthly_bill), `bill ${l.monthly_bill || 'unknown'}`);
  add(pts(TIMELINE, l.timeline), `timeline ${l.timeline || 'unknown'}`);
  add(pts(PROPERTY, l.property_type), `property ${l.property_type || 'unknown'}`);
  add(pts(OWNER, l.ownership), `ownership ${l.ownership || 'unknown'}`);
  if (l.phone && l.email) add(5, 'both contacts');
  return { score: Math.max(0, Math.min(100, s)), reasons };
}

function tierOf(score) {
  return score >= RULES.tiers.hot ? 'hot' : score >= RULES.tiers.warm ? 'warm' : 'cold';
}

// Main entry: raw form payload -> normalized lead or rejection.
function processLead(raw) {
  const r = raw || {};
  const lead = {
    name: clean(r.name, RULES.maxField.name),
    email: normEmail(r.email),
    phone: normPhone(r.phone),
    city: clean(r.city, RULES.maxField.city),
    monthly_bill: clean(r.monthly_bill, 20).toLowerCase(),
    timeline: clean(r.timeline, 20).toLowerCase(),
    property_type: clean(r.property_type, 20).toLowerCase(),
    ownership: clean(r.ownership, 20).toLowerCase(),
    message: clean(r.message, RULES.maxField.message),
    honeypot: clean(r.website, 200),            // hidden field; bots fill it
  };
  const errors = [];
  if (lead.honeypot) errors.push('spam_honeypot');
  if (!lead.name) errors.push('missing_name');
  if (!lead.email && !lead.phone) errors.push('no_valid_contact');
  if (errors.length) return { ok: false, errors, lead };

  const dedupe_key = lead.email || ('tel:' + lead.phone);
  const idempotency_key = fnv1a([lead.email, lead.phone, lead.message, lead.timeline].join('|'));
  const { score, reasons } = ruleScore(lead);
  delete lead.honeypot;
  return { ok: true, lead, dedupe_key, idempotency_key, rule_score: score, score, tier: tierOf(score),
           reasons, rules_version: RULES.version };
}

// AI layer contract: AI returns {adjust:int, summary:string}. Code clamps it; AI never sets the tier directly.
function applyAiAdjust(result, ai) {
  if (!result || !result.ok || !Number.isFinite(result.rule_score)) return result;
  let adj = Number.parseInt(ai && ai.adjust, 10);
  if (!Number.isFinite(adj)) adj = 0;
  adj = Math.max(-RULES.aiMaxAdjust, Math.min(RULES.aiMaxAdjust, adj));
  const summary = clean(ai && ai.summary, 160).replace(/[<>]/g, '');
  const score = Math.max(0, Math.min(100, result.rule_score + adj));
  return { ...result, ai_adjust: adj, ai_summary: summary, score, tier: tierOf(score),
           reasons: [...result.reasons, adj ? `${adj > 0 ? '+' : ''}${adj} ai` : 'ai 0'] };
}

// AI output may arrive as an object or as raw model text. Anything unreadable -> {} -> adjust 0.
function parseAi(ai) {
  if (ai && typeof ai === 'object') return ai;
  if (typeof ai !== 'string') return {};
  const m = ai.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return JSON.parse(m[0]); } catch (e) { return {}; }
}

const out = [];
for (const item of $input.all()) {
  const action = item.json.action;
  const data = item.json.data;
  if (action === 'process') {
    const r = processLead(data);
    if (data && (data._id || data._expect)) r.test = { id: String(data._id || ''), expect: String(data._expect || '') };
    out.push({ json: r });
  } else if (action === 'ai_adjust') {
    const result = data && data.result;
    if (!result || typeof result !== 'object') throw new Error('L0 ai_adjust: data.result is missing');
    out.push({ json: applyAiAdjust(result, parseAi(data.ai)) });
  } else {
    throw new Error('L0: unknown action "' + action + '". Use process, ai_adjust, crm_upsert, crm_update or log.');
  }
}
return out;
