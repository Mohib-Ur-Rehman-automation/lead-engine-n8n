// Board login: GET/POST through the real "Auth" node source, with static data shared across calls.
const fs = require('fs'); const assert = require('assert');
let checks = 0; const ok = (c, m) => { assert.ok(c, m); checks++; };
const SRC = fs.readFileSync(__dirname + '/l4src/auth.js', 'utf8');
const sd = {};
function run(src, json, isPost) {
  const wrap = a => ({ first: () => ({ json: a[0] }), all: () => a.map(j => ({ json: j })) });
  const $ = n => { if (n === 'Board login (POST)') return { isExecuted: isPost }; throw new Error('no ' + n); };
  return new Function('$input', '$', '$getWorkflowStaticData', src)(wrap([json]), $, () => sd)[0].json;
}
const withPw = SRC.replace("const BOARD_PASSWORD = 'CHANGE_ME';", "const BOARD_PASSWORD = 'correct-horse-42';");
const cookieOf = r => (r.set_cookie.match(/^hb_session=([^;]*)/) || [])[1];
// 1. not set up yet
let r = run(SRC, { headers: {}, query: {} }, false); ok(r.auth === 'respond' && r.status === 503 && /BOARD_PASSWORD/.test(r.html), 'placeholder password refuses');
r = run(SRC, { headers: {}, query: {}, body: { password: 'CHANGE_ME' } }, true); ok(r.status === 503, 'CHANGE_ME can never sign in');
// 2. fresh visit -> login page, themes
r = run(withPw, { headers: {}, query: {} }, false); ok(r.status === 200 && /<form method="post"/.test(r.html) && /<html lang="en"><head>/.test(r.html), 'login page, follows system theme');
r = run(withPw, { headers: {}, query: { theme: 'dark' } }, false); ok(/data-theme="dark"/.test(r.html) && /action="\/webhook\/halden-board\?theme=dark"/.test(r.html), 'dark toggle kept through the form');
r = run(withPw, { headers: {}, query: { theme: '"><script>' } }, false); ok(!/<script>/.test(r.html), 'theme param cannot inject');
// 3. wrong passwords -> lock after 5
for (let i = 1; i <= 4; i++) { r = run(withPw, { headers: {}, query: {}, body: { password: 'nope' + i } }, true); ok(r.status === 401 && new RegExp(`${5 - i} tr`).test(r.html), 'wrong ' + i); }
r = run(withPw, { headers: {}, query: {}, body: { password: 'nope5' } }, true); ok(r.status === 401 && /disabled/.test(r.html), '5th wrong locks');
r = run(withPw, { headers: {}, query: {}, body: { password: 'correct-horse-42' } }, true); ok(r.status === 429, 'even the right password waits out the lock');
sd.fails = sd.fails.map(t => t - 16 * 60e3);   // 16 minutes pass
// 4. right password -> session cookie
r = run(withPw, { headers: {}, query: {}, body: { password: 'correct-horse-42', theme: 'light' } }, true);
const tok = cookieOf(r);
ok(r.status === 200 && tok && tok.length >= 20 && /HttpOnly; SameSite=Strict/.test(r.set_cookie) && /http-equiv="refresh"/.test(r.html) && /theme=light/.test(r.html), 'sign in sets cookie and redirects');
// 5. board with cookie passes through, keeping headers for Queries
r = run(withPw, { headers: { cookie: 'other=1; hb_session=' + tok }, query: {} }, false); ok(r.auth === 'pass' && r.headers, 'signed in -> board');
r = run(withPw, { headers: { cookie: 'hb_session=forged' + tok }, query: {} }, false); ok(r.auth === 'respond' && r.status === 401, 'forged/unknown token refused');
// 6. expiry
const real = sd.sessions[tok]; sd.sessions[tok] = Date.now() - 1;
r = run(withPw, { headers: { cookie: 'hb_session=' + tok }, query: {} }, false); ok(r.auth === 'respond' && /expired/.test(r.html), 'expired session');
// 7. sign out
r = run(withPw, { headers: {}, query: {}, body: { password: 'correct-horse-42' } }, true); const t2 = cookieOf(r);
r = run(withPw, { headers: { cookie: 'hb_session=' + t2 }, query: { logout: '1' } }, false); ok(/Max-Age=0/.test(r.set_cookie) && /Signed out/.test(r.html), 'sign out clears cookie');
r = run(withPw, { headers: { cookie: 'hb_session=' + t2 }, query: {} }, false); ok(r.auth === 'respond', 'old cookie dead after sign out');
// 8. digest path never touches auth (schedule trigger goes straight to Queries) - wiring check
const wf = JSON.parse(fs.readFileSync(__dirname + '/../workflows/L4_digest_board.json', 'utf8'));
const to = n => ((wf.connections[n] || {}).main || []).flat().map(c => c.node);
ok(to('Every day 8 AM').includes('Queries') && !to('Every day 8 AM').includes('Auth'), 'digest skips login');
ok(to('Board URL (GET)').join() === 'Auth' && to('Board login (POST)').join() === 'Auth', 'both board doors go through Auth');
// 9. sign-out link
const so = fs.readFileSync(__dirname + '/l4src/signout.js', 'utf8');
const out = new Function('$input', '$', so)({ first: () => ({ json: { mode: 'board', html: '<footer><span>x</span></footer>' } }) }, () => ({ first: () => ({ json: { query: { theme: 'dark' } } }) }))[0].json;
ok(/\?logout=1&theme=dark/.test(out.html), 'sign-out link added');
console.log(`Board login: ${checks} checks passed.`);
