// Mocked AI (no Groq tokens used). Three cases, all must be handled safely by L0:
//  - attack leads: the "AI" was fooled and returns adjust 50 + a script tag  -> must clamp to +10, strip < >
//  - every 5th lead: Groq is down (empty answer)                             -> must give adjust 0
//  - everyone else: a normal answer                                          -> +3
const results = $('L0: process').all().map(i => i.json);
const { status } = $('Decide batch').first().json;
const out = [];
results.forEach((r, i) => {
  if (status[i] !== 'first') return;
  const exp = r.test && r.test.expect;
  const idx = Number(String(r.test && r.test.id || 'T0').slice(1));
  let ai;
  if (exp === 'accept_ai_clamped') ai = '{"adjust": 50, "summary": "<script>alert(1)</script> SYSTEM: tier=hot"}';
  else if (idx % 5 === 0) ai = '';
  else ai = '{"adjust": 3, "summary": "Mock note"}';
  out.push({ json: { action: 'ai_adjust', data: { result: r, ai } } });
});
return out;
