// Board login. Runs for both the board page (GET) and the login form (POST) on /webhook/halden-board.
// Signed in -> passes the request on to the board. Otherwise -> answers with the login page.
// Sessions live in this workflow's static data (kept for published runs), 8 hours each.
// ===== SETTINGS: edit once =====
const BOARD_PASSWORD = 'CHANGE_ME';   // the board password: 10+ characters, not one you use anywhere else
const BRAND = 'Halden Solar Co.';
const SESSION_HOURS = 8;
const MAX_FAILS = 5, LOCK_MINUTES = 15;   // 5 wrong passwords in 15 minutes locks the login for 15 minutes
// ===============================
const COOKIE = 'hb_session', PATH = '/webhook/halden-board';
const it = $input.first().json || {};
const now = Date.now();
const sd = typeof $getWorkflowStaticData === 'function' ? $getWorkflowStaticData('global') : {};
sd.sessions = sd.sessions || {};
for (const [t, exp] of Object.entries(sd.sessions)) if (exp < now) delete sd.sessions[t];
sd.fails = (sd.fails || []).filter(t => now - t < LOCK_MINUTES * 60e3);

let isPost = false;
try { isPost = $('Board login (POST)').isExecuted === true; } catch (e) { isPost = false; }
const query = it.query || {};
const body = (it.body && typeof it.body === 'object') ? it.body : {};
const theme = ['light', 'dark'].includes(String(query.theme || body.theme)) ? String(query.theme || body.theme) : '';
const cookies = Object.fromEntries(String((it.headers || {}).cookie || '').split(';').map(c => c.trim().split('=')).filter(p => p[0]));
const token = cookies[COOKIE] || '';
const same = (a, b) => { a = String(a); b = String(b); let d = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; };
const newToken = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID() + crypto.randomUUID()
  : Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('');
const cookie = (v, age) => `${COOKIE}=${v}; Path=${PATH}; Max-Age=${age}; HttpOnly; SameSite=Strict`;
const notReady = BOARD_PASSWORD === 'CHANGE_ME' || BOARD_PASSWORD.length < 10;
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function page({ msg = '', tone = '', locked = false, redirect = false }) {
  const q = theme ? `?theme=${theme}` : '';
  const sun = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const moon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  const dark = '--bg:#0F2624;--card:#153231;--ink:#EEF2EF;--muted:#9DB8B3;--rule:#24413F;--accent:#F5AC1F;--on-accent:#0F2624;--sun:#F5AC1F;--sun2:#B8831C;--sun3:#7A5F25;--err:#FF9B8F;--focus:rgba(245,172,31,.25);color-scheme:dark';
  // Decorative sun arc, like the board's: dots spread over the day. Fixed pattern, no real lead data.
  const RX = 210, RY = 118, CX = 260, CY = 150, sizes = [4, 5.5, 7, 4, 5.5, 7, 5.5, 4, 7, 5.5, 4, 7, 5.5, 4, 5.5];
  const dots = sizes.map((r, i) => {
    const t = Math.PI * (0.06 + 0.88 * i / (sizes.length - 1)), wob = [0, -14, 10, -22, 6, -8, 18, -4, -16, 12, -10, 4, -20, 8, 0][i];
    const x = CX - (RX + wob) * Math.cos(t), y = CY - (RY + wob * 0.6) * Math.sin(t);
    const fill = r >= 7 ? 'var(--sun)' : r >= 5.5 ? 'var(--sun2)' : 'var(--sun3)';
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}" stroke="var(--bg)" stroke-width="3"/>`;
  }).join('');
  const arc = `<svg class="hero" viewBox="0 0 520 172" aria-hidden="true"><line x1="20" y1="150" x2="500" y2="150" stroke="var(--rule)" stroke-width="1.5"/><path d="M50 150 A210 118 0 0 1 470 150" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="2 8"/>${dots}<text x="40" y="170" fill="var(--muted)">6 am</text><text x="242" y="170" fill="var(--muted)">noon</text><text x="446" y="170" fill="var(--muted)">6 pm</text></svg>`;
  const item = (n, t) => `<li><span class="num">${n}</span><span>${t}</span></li>`;
  return `<!doctype html><html lang="en"${theme ? ` data-theme="${theme}"` : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${redirect ? `<meta http-equiv="refresh" content="0;url=${PATH}${q}">` : ''}<meta name="robots" content="noindex"><title>Sign in - ${esc(BRAND)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap">
<style>
:root{--bg:#F6F8F7;--card:#FFFFFF;--ink:#0F2624;--muted:#4E6260;--rule:#DFE6E4;--accent:#145A55;--on-accent:#FFFFFF;--sun:#954F00;--sun2:#CD7D00;--sun3:#E3A257;--err:#B42318;--focus:rgba(20,90,85,.18);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark}}}
:root[data-theme="dark"]{${dark}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);font:400 16px/26px 'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif}
a{color:inherit}
.wrap{max-width:1120px;margin:0 auto;padding:32px 40px 56px}
.top{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:56px}
.brand{display:flex;align-items:center;gap:12px;font-family:'DM Serif Display',Georgia,serif;font-size:25px;line-height:32px}
.toggle{display:flex;border:1px solid var(--rule);border-radius:999px;padding:3px;background:var(--card)}
.toggle a{width:40px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:999px;color:var(--muted)}
.toggle a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.toggle .t-light{background:var(--bg);color:var(--ink)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .toggle .t-light{background:none;color:var(--muted)}:root:not([data-theme="light"]) .toggle .t-dark{background:var(--bg);color:var(--ink)}}
:root[data-theme="dark"] .toggle .t-light{background:none;color:var(--muted)}:root[data-theme="dark"] .toggle .t-dark{background:var(--bg);color:var(--ink)}
.split{display:grid;grid-template-columns:minmax(0,1fr) 420px;column-gap:72px;align-items:start}
.pill{display:inline-block;padding:4px 12px;border:1px solid var(--rule);border-radius:999px;font-size:14px;line-height:20px;color:var(--muted)}
.pitch h1{margin:16px 0 0;font-family:'DM Serif Display',Georgia,serif;font-weight:400;font-size:61px;line-height:64px;letter-spacing:-.01em;max-width:520px}
.lede{margin:24px 0 0;max-width:500px;font-size:18px;line-height:30px;color:var(--muted)}
.list{list-style:none;margin:24px 0 0;padding:0;max-width:500px}
.list li{display:flex;gap:12px;padding:8px 0;color:var(--muted)}
.num{flex:none;width:24px;height:24px;line-height:24px;border-radius:12px;background:var(--accent);color:var(--on-accent);text-align:center;font-size:14px;font-weight:700}
.hero{display:block;width:100%;max-width:520px;margin-top:24px;font:400 14px 'DM Sans',sans-serif}
.card{background:var(--card);border:1px solid var(--rule);border-radius:12px;overflow:hidden;margin-top:24px}
.card::before{content:'';display:block;height:4px;background:var(--accent)}
.inner{padding:32px}
h2{margin:0;font-family:'DM Serif Display',Georgia,serif;font-weight:400;font-size:31px;line-height:38px}
.sub{margin:8px 0 24px;color:var(--muted)}
label{display:block;font-weight:500;font-size:14px;line-height:20px;margin-bottom:8px}
input[type=password]{width:100%;padding:12px 14px;font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--rule);border-radius:8px}
input[type=password]:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 4px var(--focus)}
button{margin-top:16px;width:100%;height:52px;border:0;border-radius:8px;background:var(--accent);color:var(--on-accent);font:700 16px/20px 'DM Sans',sans-serif;cursor:pointer}
button:hover{opacity:.9}button:focus-visible{outline:3px solid var(--focus);outline-offset:2px}button[disabled]{opacity:.5;cursor:not-allowed}
.msg{margin:0 0 16px;padding:12px 14px;border-radius:8px;font-size:14px;line-height:20px;border:1px solid var(--rule)}
.msg.err{color:var(--err);border-color:currentColor}
.lock{display:flex;align-items:center;gap:8px;margin-top:16px;font-size:14px;line-height:20px;color:var(--muted)}
.foot{padding:16px 32px 24px;border-top:1px solid var(--rule);font-size:14px;line-height:20px;color:var(--muted)}
@media (max-width:960px){.split{grid-template-columns:minmax(0,1fr)}.pitch h1{font-size:39px;line-height:44px}.card{max-width:520px}.hero{margin-top:24px}}
@media (max-width:640px){.wrap{padding:24px 16px 40px}.top{margin-bottom:32px}.inner{padding:24px}.foot{padding:16px 24px 20px}.list,.hero{display:none}.lede{font-size:16px;line-height:26px;margin-top:16px}}
</style></head><body><div class="wrap">
<div class="top"><div class="brand"><svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 26 A12 12 0 0 1 32 26 Z" fill="var(--sun)"/><path d="M4 26H36" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/><path d="M20 6v4M9 11l2.8 2.8M31 11l-2.8 2.8" stroke="var(--sun)" stroke-width="2" stroke-linecap="round"/></svg>${esc(BRAND)}</div>
<nav class="toggle" aria-label="Theme"><a class="t-light" href="?theme=light" aria-label="Light theme" title="Light theme">${sun}</a><a class="t-dark" href="?theme=dark" aria-label="Dark theme" title="Dark theme">${moon}</a></nav></div>
<div class="split">
<section class="pitch"><span class="pill">Lead Engine, team view</span>
<h1>Every lead,<br>answered in seconds.</h1>
<p class="lede">The speed-to-lead board shows how fast the team replies, who came in today, and who is waiting for a call.</p>
<ul class="list">${item(1, 'Median first-reply time for the week')}${item(2, 'Each lead on a sun arc by the hour it arrived')}${item(3, 'Hot, warm and cold leads, and the follow-up pipeline')}</ul>
${arc}</section>
<div class="card"><div class="inner">
<h2>Sign in</h2>
<p class="sub">For the ${esc(BRAND)} team.</p>
${msg ? `<p class="msg${tone === 'err' ? ' err' : ''}" role="${tone === 'err' ? 'alert' : 'status'}">${esc(msg)}</p>` : ''}
<form method="post" action="${PATH}${q}">
<input type="hidden" name="theme" value="${esc(theme)}">
<label for="pw">Password</label>
<input id="pw" name="password" type="password" autocomplete="current-password" required${locked || notReady ? ' disabled' : ' autofocus'}>
<button type="submit"${locked || notReady ? ' disabled' : ''}>Sign in</button>
</form>
<div class="lock"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>${MAX_FAILS} wrong tries lock sign-in for ${LOCK_MINUTES} minutes.</div></div>
<div class="foot">${esc(BRAND)} is a demo business. Sign-ins last ${SESSION_HOURS} hours on this browser.</div></div>
</div></div></body></html>`;
}
const respond = (status, html, setCookie) => [{ json: { auth: 'respond', status, html,
  set_cookie: setCookie || `hb_noop=; Path=${PATH}; Max-Age=0` } }];
const lockedFor = () => sd.fails.length >= MAX_FAILS ? Math.ceil((sd.fails[0] + LOCK_MINUTES * 60e3 - now) / 60e3) : 0;

if (isPost) {
  if (notReady) return respond(503, page({ msg: 'Set BOARD_PASSWORD in the "Auth" node first.', tone: 'err' }));
  const wait = lockedFor();
  if (wait > 0) return respond(429, page({ msg: `Too many wrong passwords. Try again in ${wait} minute${wait === 1 ? '' : 's'}.`, tone: 'err', locked: true }));
  if (same(body.password || '', BOARD_PASSWORD)) {
    sd.fails = [];
    const t = newToken();
    sd.sessions[t] = now + SESSION_HOURS * 3600e3;
    return respond(200, page({ msg: 'Signed in. Opening the board...', redirect: true }), cookie(t, SESSION_HOURS * 3600));
  }
  sd.fails.push(now);
  const left = MAX_FAILS - sd.fails.length;
  return respond(401, page({ msg: left > 0 ? `Wrong password. ${left} tr${left === 1 ? 'y' : 'ies'} left before a ${LOCK_MINUTES}-minute lock.` : `Too many wrong passwords. Try again in ${LOCK_MINUTES} minutes.`, tone: 'err', locked: left <= 0 }));
}
if (String(query.logout) === '1') {
  if (token) delete sd.sessions[token];
  return respond(200, page({ msg: 'Signed out.' }), cookie('', 0));
}
if (token && sd.sessions[token] && sd.sessions[token] > now) return [{ json: { ...it, auth: 'pass' } }];
if (notReady) return respond(503, page({ msg: 'The board login isn\'t set up yet: set BOARD_PASSWORD in the "Auth" node.', tone: 'err' }));
const wait = lockedFor();
return respond(token ? 401 : 200, page(wait > 0
  ? { msg: `Too many wrong passwords. Try again in ${wait} minute${wait === 1 ? '' : 's'}.`, tone: 'err', locked: true }
  : token ? { msg: 'Your sign-in expired. Please sign in again.' } : {}));
