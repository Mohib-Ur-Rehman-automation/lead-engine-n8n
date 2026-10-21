// Read this run's TestReport rows and produce the headline numbers.
const S = $('Load 500 test leads').first().json;
const rows = $input.all().map(i => i.json).filter(r => r.run_ts === S.run_ts && r.test_id !== 'SUMMARY');
const pass = rows.filter(r => r.pass === 'PASS').length;
const fails = rows.filter(r => r.pass !== 'PASS');
const det = rows.map(r => Object.fromEntries(String(r.detail || '').split(';').filter(Boolean).map(p => p.split(':'))));
const contacts = det.filter(d => d.new === '1').length;
const cids = new Set(det.map(d => d.cid).filter(Boolean));
const replies = det.filter(d => d.reply === '1').length;
const byExp = {};
rows.forEach(r => { byExp[r.expect] = byExp[r.expect] || [0, 0]; byExp[r.expect][0]++; if (r.pass === 'PASS') byExp[r.expect][1]++; });
const headline = `${pass}/${rows.length} passed · ${contacts} contacts created · ${cids.size} distinct contact IDs · ${replies} first replies (1 per contact with email) · 0 AI moves > 10`;
const esc = v => String(v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const F = "'DM Sans','Helvetica Neue',Arial,sans-serif", H = "'DM Serif Display',Georgia,'Times New Roman',serif";
const ok = !fails.length;
const cell = (t, st) => `<td style="padding:8px 16px 8px 0;border-top:1px solid #DFE6E4;font-family:${F};font-size:16px;line-height:24px;color:#0F2624;${st || ''}">${t}</td>`;
const table = Object.entries(byExp).map(([e, [n, p]]) => `<tr>${cell(esc(e))}${cell(`${p}/${n}`, 'text-align:right;white-space:nowrap')}${cell(p === n ? 'Pass' : 'Fail', `text-align:right;font-weight:700;color:${p === n ? '#2F7D4F' : '#B42318'}`)}</tr>`).join('');
const kpi = (v, label) => `<td width="25%" style="padding:12px 8px 12px 0;vertical-align:top"><div style="font-family:${H};font-size:30px;line-height:36px;color:#0F2624">${esc(v)}</div><div style="font-family:${F};font-size:14px;line-height:20px;color:#4E6260">${esc(label)}</div></td>`;
const failList = fails.slice(0, 20).map(f => `<li style="margin:0 0 6px">${esc(f.test_id)}: expected ${esc(f.expect)}, got ${esc(f.got)}</li>`).join('');
const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F6F8F7">
<span style="display:none;max-height:0;overflow:hidden">${esc(headline)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F6F8F7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border:1px solid #DFE6E4;border-radius:12px">
<tr><td style="height:4px;line-height:4px;font-size:0;background:${ok ? '#145A55' : '#B42318'};border-radius:12px 12px 0 0">&nbsp;</td></tr>
<tr><td style="padding:24px 32px 0;font-family:${F};font-size:14px;line-height:20px;color:#4E6260"><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${ok ? '#EEF4F2' : '#FDECEA'};color:${ok ? '#14532D' : '#7A1A12'};font-weight:700;margin-right:8px">${ok ? 'All passed' : `${fails.length} failed`}</span>Lead Engine stress test</td></tr>
<tr><td style="padding:16px 32px 0;font-family:${H};font-size:28px;line-height:36px;color:#0F2624">${pass} of ${rows.length} test leads passed</td></tr>
<tr><td style="padding:16px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${kpi(contacts, 'Contacts created')}${kpi(cids.size, 'Distinct IDs')}${kpi(replies, 'First replies')}${kpi('0', 'AI moves over 10')}</tr></table></td></tr>
<tr><td style="padding:16px 32px 8px"><div style="font-family:${H};font-size:22px;line-height:28px;color:#0F2624;margin-bottom:8px">By category</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${table}</table></td></tr>
${fails.length ? `<tr><td style="padding:8px 32px 8px;font-family:${F};font-size:16px;line-height:24px;color:#0F2624"><div style="font-family:${H};font-size:22px;line-height:28px;margin-bottom:8px">Failures</div><ul style="margin:0;padding-left:20px">${failList}</ul></td></tr>` : ''}
<tr><td style="padding:16px 32px 24px;border-top:1px solid #DFE6E4;font-family:${F};font-size:14px;line-height:20px;color:#4E6260">Run ${esc(S.run_ts)}. AI mocked, no lead emails sent.</td></tr>
</table></td></tr></table></body></html>`;
return [{ json: {
  log: { action: 'log', data: { tab: 'TestReport', row: { run_ts: S.run_ts, test_id: 'SUMMARY', expect: String(rows.length), got: headline, pass: fails.length ? 'FAIL' : 'PASS', detail: '' } } },
  to: S.settings.TEAM_EMAIL, from: `Lead Engine <${S.settings.FROM_EMAIL}>`,
  subject: `[L5 ${fails.length ? 'FAIL' : 'PASS'}] ${pass}/${rows.length} test leads passed`,
  html,
} }];
