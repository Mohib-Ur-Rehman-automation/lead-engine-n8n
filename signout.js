// Add a "Sign out" link to the board footer (the board itself is built in "Build page / email").
const it = $input.first().json;
let theme = '';
try { theme = String((($('Board URL (GET)').first().json || {}).query || {}).theme || ''); } catch (e) { theme = ''; }
const q = theme === 'light' || theme === 'dark' ? `&theme=${theme}` : '';
const link = `<a href="?logout=1${q}" style="color:inherit">Sign out</a>`;
const html = String(it.html || '');
return [{ json: { ...it, html: html.includes('</footer>') ? html.replace('</footer>', `<span>${link}</span></footer>`) : html } }];
