// Turn the 4 HubSpot answers into numbers, then into the board page or the digest email.
// Brand: dark teal + saffron (dark mode), white + teal ink + saffron data (light mode). Fonts: DM Serif Display + DM Sans.
const Q = $('Queries').all().map(i => i.json);
const R = $input.all().map(i => i.json);
const { mode, now, settings: S } = Q[0];
const got = {}; Q.forEach((q, i) => { got[q.key] = R[i] || {}; });
const leads = (got.recent.results || []).map(r => ({ id: r.id, ...r.properties }));
const totalRecent = Number(got.recent.total || leads.length);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tsOf = v => /^\d+$/.test(String(v)) ? Number(v) : Date.parse(v);
const PKT = 5 * 3600 * 1000;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pkt = ms => {
  if (!Number.isFinite(Number(ms))) return '—';
  const d = new Date(Number(ms) + PKT);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};
const clock = h => { const hh = Math.floor(h), mm = String(Math.floor((h - hh) * 60)).padStart(2, '0'); return `${hh % 12 === 0 ? 12 : hh % 12}:${mm} ${hh < 12 ? 'am' : 'pm'}`; };
const secs = leads.filter(l => l.first_reply_seconds !== undefined && l.first_reply_seconds !== null && l.first_reply_seconds !== '')
  .map(l => Number(l.first_reply_seconds)).filter(n => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
const median = secs.length ? (secs.length % 2 ? secs[(secs.length - 1) / 2] : (secs[secs.length / 2 - 1] + secs[secs.length / 2]) / 2) : null;
const tiers = { hot: 0, warm: 0, cold: 0 }; leads.forEach(l => { if (tiers[l.lead_tier] !== undefined) tiers[l.lead_tier]++; });
const pipe = { awaiting: Number(got.awaiting.total || 0), replied: Number(got.replied.total || 0), closed: Number(got.closed.total || 0) };
const answered = pipe.replied + pipe.closed + pipe.awaiting;
const replyRate = answered ? Math.round(100 * pipe.replied / answered) : 0;
const split = s => s == null ? { num: '—', unit: '' } : s < 60 ? { num: s.toFixed(1), unit: 'sec' } : { num: (s / 60).toFixed(1), unit: 'min' };
const fmtSecs = s => { const p = split(s); return p.unit ? `${p.num} ${p.unit}` : p.num; };
const windowLabel = mode === 'board' ? 'Last 7 days' : 'Last 24 hours';
const capped = totalRecent > leads.length ? `Showing the newest ${leads.length} of ${totalRecent}.` : '';
const link = l => S.HUBSPOT_PORTAL_ID ? `https://app.hubspot.com/contacts/${encodeURIComponent(S.HUBSPOT_PORTAL_ID)}/record/0-1/${encodeURIComponent(l.id)}` : '';
const nameOf = l => [l.firstname, l.lastname].filter(Boolean).join(' ') || l.email || 'Unknown';

// ---------- Daily digest email (light, email-safe) ----------
if (mode === 'digest') {
  const F = "'DM Sans','Helvetica Neue',Arial,sans-serif", H = "'DM Serif Display',Georgia,'Times New Roman',serif";
  const hot = leads.filter(l => l.lead_tier === 'hot');
  const kpi = (v, label) => `<td width="25%" style="padding:12px 8px 12px 0;vertical-align:top"><div style="font-family:${H};font-size:30px;line-height:36px;color:#0F2624">${esc(v)}</div><div style="font-family:${F};font-size:14px;line-height:20px;color:#4E6260">${esc(label)}</div></td>`;
  const hotRows = hot.slice(0, 15).map(l => {
    const href = link(l);
    const nm = href ? `<a href="${esc(href)}" style="color:#145A55;text-decoration:underline">${esc(nameOf(l))}</a>` : esc(nameOf(l));
    return `<tr><td style="padding:12px 0;border-top:1px solid #DFE6E4;font-family:${F};font-size:16px;line-height:24px;color:#0F2624"><b>${nm}</b><br><span style="font-size:14px;color:#4E6260">${esc(l.city || 'No city')} · score ${esc(l.lead_score || '—')} · ${esc(l.engine_status || '—')}</span></td></tr>`;
  }).join('') || `<tr><td style="padding:12px 0;border-top:1px solid #DFE6E4;font-family:${F};font-size:16px;color:#4E6260">No hot leads in the last 24 hours.</td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F6F8F7">
<span style="display:none;max-height:0;overflow:hidden">${totalRecent} new leads, ${tiers.hot} hot, median first reply ${esc(fmtSecs(median))}.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8F7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #DFE6E4;border-radius:12px">
<tr><td style="height:4px;line-height:4px;font-size:0;background:#E0A21B;border-radius:12px 12px 0 0">&nbsp;</td></tr>
<tr><td style="padding:24px 32px 0;font-family:${H};font-size:20px;line-height:28px;color:#0F2624"><span style="display:inline-block;width:18px;height:9px;background:#E0A21B;border-radius:9px 9px 0 0;margin-right:8px;vertical-align:middle"></span>${esc(S.BRAND)}</td></tr>
<tr><td style="padding:16px 32px 0"><div style="font-family:${H};font-size:30px;line-height:38px;color:#0F2624">Daily leads</div><div style="font-family:${F};font-size:14px;line-height:20px;color:#4E6260">${esc(windowLabel)}, sent ${esc(pkt(now))} PKT. ${esc(capped)}</div></td></tr>
<tr><td style="padding:16px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${kpi(totalRecent, 'New leads')}${kpi(fmtSecs(median), 'Median first reply')}${kpi(`${tiers.hot}/${tiers.warm}/${tiers.cold}`, 'Hot / warm / cold')}${kpi(`${replyRate}%`, 'Replied')}</tr></table></td></tr>
<tr><td style="padding:8px 32px 0;font-family:${F};font-size:14px;line-height:20px;color:#4E6260">Pipeline now: ${pipe.awaiting} awaiting, ${pipe.replied} replied, ${pipe.closed} closed.</td></tr>
<tr><td style="padding:24px 32px 8px"><div style="font-family:${H};font-size:22px;line-height:28px;color:#0F2624">Hot leads</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${hotRows}</table></td></tr>
<tr><td style="padding:16px 32px 24px;border-top:1px solid #DFE6E4;font-family:${F};font-size:14px;line-height:20px;color:#4E6260">Lead Engine daily digest. Demo business; data from HubSpot.</td></tr>
</table></td></tr></table></body></html>`;
  return [{ json: { mode, to: S.TEAM_EMAIL, from: `Lead Engine <${S.FROM_EMAIL}>`,
    subject: `Daily leads: ${totalRecent} new, ${tiers.hot} hot, median reply ${fmtSecs(median)}`, html } }];
}

// ---------- Board page ----------
let theme = '';
try { theme = String((($('Board URL (GET)').first().json || {}).query || {}).theme || ''); } catch (e) { theme = ''; }
if (theme !== 'dark' && theme !== 'light') theme = '';

// Sun arc: one dot per lead, placed by the hour it arrived (PKT), 6 am to 10 pm.
const CX = 500, CY = 410, RAD = 370, H0 = 6, H1 = 22;
const k = leads.length > 60 ? 1 : 1.5;
const pos = (h, r) => { const a = Math.PI * (1 - (h - H0) / (H1 - H0)); return { x: Math.round(CX + r * Math.cos(a)), y: Math.round(CY - r * Math.sin(a)) }; };
const dots = leads.map((l, i) => {
  const t = tsOf(l.createdate);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t + PKT);
  const real = d.getUTCHours() + d.getUTCMinutes() / 60;
  const h = Math.min(H1, Math.max(H0, real));
  const tier = ['hot', 'warm', 'cold'].includes(l.lead_tier) ? l.lead_tier : 'cold';
  const p = pos(h, RAD + ((i % 3) - 1) * 24);
  const r = (tier === 'hot' ? 7 : tier === 'warm' ? 5.5 : 4) * k;
  return `<g><title>${esc(nameOf(l))}, ${tier}, arrived ${clock(real)}</title><circle class="d-${tier}" cx="${p.x}" cy="${p.y}" r="${r}"/></g>`;
}).join('');
const ticks = [[6, '6 am'], [10, '10 am'], [14, '2 pm'], [18, '6 pm'], [22, '10 pm']].map(([h, label]) => {
  const p = pos(h, RAD - 60); return (h === 6 || h === 22) ? `<text x="${h === 6 ? 130 : 870}" y="434" text-anchor="middle">${label}</text>` : `<text x="${p.x}" y="${p.y + 6}" text-anchor="middle">${label}</text>`;
}).join('');
const m = split(median);
const tb = (n, cls, first, last) => n ? `<span class="${cls}" style="flex:${n};border-radius:${first ? 4 : 0}px ${last ? 4 : 0}px ${last ? 4 : 0}px ${first ? 4 : 0}px"></span>` : '';
const tierBar = (tiers.hot + tiers.warm + tiers.cold)
  ? `<div class="tierbar">${tb(tiers.hot, 'b-hot', true, !tiers.warm && !tiers.cold)}${tb(tiers.warm, 'b-warm', !tiers.hot, !tiers.cold)}${tb(tiers.cold, 'b-cold', !tiers.hot && !tiers.warm, true)}</div>`
  : '<div class="tierbar"><span class="b-empty" style="flex:1;border-radius:4px"></span></div>';
const STATUS = { replied: ['Replied', 'st-good'], awaiting: ['Awaiting reply', 'st-wait'], closed: ['Closed', 'st-closed'] };
const rows = leads.map(l => {
  const href = link(l);
  const nm = href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(nameOf(l))}</a>` : esc(nameOf(l));
  const fr = (l.first_reply_seconds === undefined || l.first_reply_seconds === null || l.first_reply_seconds === '') ? NaN : Number(l.first_reply_seconds);
  const tier = ['hot', 'warm', 'cold'].includes(l.lead_tier) ? l.lead_tier : '';
  const st = STATUS[l.engine_status] || [l.engine_status || '—', 'st-closed'];
  const stage = Math.max(0, Math.min(3, Number(l.followup_stage) || 0));
  const fu = [1, 2, 3].map(n => `<span class="${n <= stage ? 'fu-on' : 'fu-off'}"></span>`).join('');
  return `<tr>
<td class="muted nowrap">${esc(pkt(tsOf(l.createdate)))}</td>
<td><div class="lead">${nm}</div><div class="small muted">${esc(l.city || 'No city')}</div></td>
<td class="nowrap">${tier ? `<span class="tier"><span class="g g-${tier}"></span>${tier[0].toUpperCase() + tier.slice(1)}</span> <span class="muted">${esc(l.lead_score || '')}</span>` : '<span class="muted">—</span>'}</td>
<td class="nowrap">${Number.isFinite(fr) ? esc(fmtSecs(fr)) : '<span class="muted">No email</span>'}</td>
<td class="nowrap"><span class="tier"><span class="sd ${st[1]}"></span>${esc(st[0])}</span></td>
<td><span class="fu" aria-label="${stage} of 3 follow-ups sent">${fu}</span></td>
<td class="muted note">${esc(l.ai_summary || '')}</td></tr>`;
}).join('') || '<tr><td colspan="7" class="empty">No leads in the last 7 days yet. New form submissions appear here within a minute.</td></tr>';
const sunIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const moonIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';

const html = `<!doctype html><html lang="en"${theme ? ` data-theme="${theme}"` : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="60"><title>Speed-to-lead · ${esc(S.BRAND)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap">
<style>
:root{--bg:#F6F8F7;--card:#FFFFFF;--ink:#0F2624;--muted:#4E6260;--rule:#DFE6E4;--accent:#145A55;--sun:#E0A21B;--good:#2F7D4F;--hot:#954F00;--warm:#CD7D00;--cold:#E3A257;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0F2624;--card:#153231;--ink:#EEF2EF;--muted:#9DB8B3;--rule:#24413F;--accent:#F5AC1F;--sun:#F5AC1F;--good:#5FCB9F;--hot:#F5AC1F;--warm:#B8831C;--cold:#7A5F25;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0F2624;--card:#153231;--ink:#EEF2EF;--muted:#9DB8B3;--rule:#24413F;--accent:#F5AC1F;--sun:#F5AC1F;--good:#5FCB9F;--hot:#F5AC1F;--warm:#B8831C;--cold:#7A5F25;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:400 16px/26px 'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;font-variant-numeric:tabular-nums}
a{color:inherit}
.wrap{max-width:1200px;margin:0 auto;padding:40px 40px 56px;display:flex;flex-direction:column;gap:48px}
.serif{font-family:'DM Serif Display',Georgia,serif;font-weight:400}
.muted{color:var(--muted)}.small{font-size:14px;line-height:20px}.nowrap{white-space:nowrap}
header{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px;border-bottom:1px solid var(--rule);padding-bottom:24px}
.brand{display:flex;align-items:center;gap:12px}
.brand .name{font-size:25px;line-height:32px}
.meta{display:flex;align-items:center;gap:16px;text-align:right}
.toggle{display:flex;border:1px solid var(--rule);border-radius:999px;padding:3px;background:var(--card)}
.toggle a{width:40px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:999px;color:var(--muted)}
.toggle a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.toggle .t-light{background:var(--bg);color:var(--ink)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .toggle .t-light{background:none;color:var(--muted)}:root:not([data-theme="light"]) .toggle .t-dark{background:var(--bg);color:var(--ink)}}
:root[data-theme="dark"] .toggle .t-light{background:none;color:var(--muted)}:root[data-theme="dark"] .toggle .t-dark{background:var(--bg);color:var(--ink)}
.hero{position:relative;margin:0}
.hero svg{display:block;width:100%;height:auto}
.hero .base{stroke:var(--rule);stroke-width:1.5}
.hero .path{fill:none;stroke:var(--muted);stroke-width:1.5;stroke-dasharray:2 8}
.hero text{fill:var(--muted);font:400 16px 'DM Sans',sans-serif}
.hero circle{stroke:var(--bg);stroke-width:3}
.d-hot{fill:var(--hot)}.d-warm{fill:var(--warm)}.d-cold{fill:var(--cold)}
.center{position:absolute;left:0;right:0;bottom:40px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;pointer-events:none}
.big{font-size:clamp(56px,9vw,95px);line-height:1;letter-spacing:-.02em}
.big .unit{font-size:.41em;color:var(--muted);letter-spacing:0}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:24px;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:24px 0}
.kpi .v{font-size:39px;line-height:44px}
.tierbar{display:flex;height:12px;gap:2px;margin:16px 0 8px}
.b-hot{background:var(--hot)}.b-warm{background:var(--warm)}.b-cold{background:var(--cold)}.b-empty{background:var(--rule)}
h2{margin:0;font-size:31px;line-height:38px}
.tablehead{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px}
.tbl{overflow-x:auto;border-top:2px solid var(--ink)}
table{width:100%;min-width:900px;border-collapse:collapse}
th{text-align:left;font-weight:500;font-size:14px;line-height:20px;color:var(--muted);padding:16px}
td{padding:16px;border-top:1px solid var(--rule);vertical-align:top}
th:first-child,td:first-child{padding-left:0}th:last-child,td:last-child{padding-right:0}
.lead{font-weight:500}.lead a{text-decoration:none;border-bottom:1px solid var(--rule)}.lead a:hover{border-color:var(--ink)}
.tier{display:inline-flex;align-items:center;gap:8px}
.g{border-radius:50%;display:inline-block}.g-hot{width:12px;height:12px;background:var(--hot)}.g-warm{width:10px;height:10px;background:var(--warm)}.g-cold{width:8px;height:8px;background:var(--cold)}
.sd{width:8px;height:8px;border-radius:50%;display:inline-block}.st-good{background:var(--good)}.st-wait{background:var(--accent)}.st-closed{background:var(--rule)}
.fu{display:inline-flex;gap:4px;padding-top:10px}.fu span{width:16px;height:6px;border-radius:3px}.fu-on{background:var(--ink)}.fu-off{background:var(--rule)}
.note{max-width:300px}
.empty{text-align:center;color:var(--muted);padding:40px 0}
footer{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;border-top:1px solid var(--rule);padding-top:16px;font-size:14px;line-height:20px;color:var(--muted)}
@media (max-width:640px){.wrap{padding:24px 16px 40px;gap:32px}.meta{text-align:left}.center{position:static;margin-top:16px}.hero text{font-size:30px}.kpi .v{font-size:31px;line-height:38px}}
</style></head><body><div class="wrap">
<header>
<div class="brand"><svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 26 A12 12 0 0 1 32 26 Z" fill="var(--sun)"/><path d="M4 26H36" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"/><path d="M20 6v4M9 11l2.8 2.8M31 11l-2.8 2.8" stroke="var(--sun)" stroke-width="2" stroke-linecap="round"/></svg>
<div><div class="serif name">${esc(S.BRAND)}</div><div class="small muted">Speed-to-lead, last 7 days</div></div></div>
<div class="meta"><div class="small muted">Updated ${esc(pkt(now))} PKT<br>Refreshes every minute</div>
<nav class="toggle" aria-label="Theme"><a class="t-light" href="?theme=light" aria-label="Light theme" title="Light theme">${sunIcon}</a><a class="t-dark" href="?theme=dark" aria-label="Dark theme" title="Dark theme">${moonIcon}</a></nav></div>
</header>
<figure class="hero">
<svg viewBox="0 0 1000 440" role="img" aria-label="Sun arc: each dot is a lead from the last 7 days, placed by the hour it arrived. Larger, darker dots are hotter leads.">
<line class="base" x1="40" y1="410" x2="960" y2="410"/><path class="path" d="M 130 410 A 370 370 0 0 1 870 410"/>${ticks}${dots}
</svg>
<figcaption class="center"><span class="muted">Median first reply</span><span class="serif big">${esc(m.num)}${m.unit ? `<span class="unit"> ${m.unit}</span>` : ''}</span><span class="small muted">${secs.length ? `From form sent to first email, ${secs.length} leads. Each dot is a lead, placed by the hour it arrived.` : 'No first replies yet in this window.'}</span></figcaption>
</figure>
<section class="kpis" aria-label="Summary">
<div class="kpi"><div class="serif v">${totalRecent}</div><div class="small muted">New leads</div></div>
<div class="kpi"><div class="serif v">${replyRate}%</div><div class="small muted">Replied, ${pipe.replied} people</div></div>
<div class="kpi"><div class="serif v">${pipe.awaiting}</div><div class="small muted">Awaiting reply, ${pipe.closed} closed</div></div>
<div class="kpi">${tierBar}<div class="small muted">${tiers.hot} hot, ${tiers.warm} warm, ${tiers.cold} cold</div></div>
</section>
<section style="display:flex;flex-direction:column;gap:16px">
<div class="tablehead"><h2 class="serif">All leads</h2><span class="small muted">Newest first.${S.HUBSPOT_PORTAL_ID ? ' Click a name to open it in HubSpot.' : ''} ${esc(capped)}</span></div>
<div class="tbl"><table><thead><tr><th>Arrived (PKT)</th><th>Lead</th><th>Tier</th><th>First reply</th><th>Status</th><th>Follow-ups</th><th>AI note</th></tr></thead>
<tbody>${rows}</tbody></table></div>
</section>
<footer><span>Demo business. Data from HubSpot.</span><span>Lead Engine</span></footer>
</div></body></html>`;
return [{ json: { mode, html } }];
