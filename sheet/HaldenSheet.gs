/**
 * Halden Solar Co. · Lead Engine sheet design
 * Paste into Extensions > Apps Script (replace everything), save, then run setupHaldenSheet once.
 * After that, the "Halden" menu at the top of the sheet re-applies it any time.
 *
 * Safe for n8n: it never renames, moves or deletes the data tabs' columns. It only styles them,
 * freezes the header, adds colour rules, and builds a separate read-only "Overview" tab with formulas.
 */

const BRAND = {
  ink: '#0F2624',      // dark teal: header rows, titles
  muted: '#4E6260',
  rule: '#DFE6E4',
  bg: '#F6F8F7',
  white: '#FFFFFF',
  teal: '#145A55',
  tealPale: '#EEF4F2',
  saffron: '#E0A21B',
  saffronPale: '#FCF1D6',
  goodText: '#14532D',
  badPale: '#FDECEA',
  badText: '#7A1A12',
  font: 'DM Sans',            // if your sheet shows Arial instead, change to 'Roboto'
  display: 'DM Serif Display' // title font on the Overview tab
};

// Column order must match what the n8n workflows write. Do not reorder.
const TABS = {
  Events: { cols: ['idempotency_key', 'dedupe_key', 'event', 'ts'], widths: [170, 240, 130, 220], color: BRAND.teal },
  Rejects: { cols: ['ts', 'errors', 'name', 'email', 'phone', 'test_id'], widths: [220, 320, 180, 240, 150, 120], color: '#B42318' },
  TestReport: { cols: ['run_ts', 'test_id', 'expect', 'got', 'pass', 'detail'], widths: [220, 130, 200, 360, 80, 320], color: BRAND.saffron }
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Halden')
    .addItem('Apply design', 'setupHaldenSheet')
    .addItem('Rebuild Overview', 'buildOverview')
    .addToUi();
}

function setupHaldenSheet() {
  const ss = SpreadsheetApp.getActive();
  const notes = [];
  Object.keys(TABS).forEach(name => notes.push(styleDataTab_(ss, name, TABS[name])));
  buildOverview();
  ss.setActiveSheet(ss.getSheetByName('Overview'));
  const msg = notes.filter(Boolean);
  SpreadsheetApp.getActive().toast(msg.length ? msg.join(' ') : 'Design applied to all tabs.', 'Halden', 8);
}

function styleDataTab_(ss, name, spec) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const n = spec.cols.length;

  // Header row: write it only if empty; never overwrite what n8n relies on.
  const head = sh.getRange(1, 1, 1, n);
  const current = head.getValues()[0].map(String);
  let note = '';
  if (current.every(v => v === '')) head.setValues([spec.cols]);
  else if (current.join('|') !== spec.cols.join('|')) note = `Check the "${name}" header row: expected ${spec.cols.join(', ')}.`;

  const lastRow = Math.max(sh.getMaxRows(), 2);
  const all = sh.getRange(1, 1, lastRow, n);
  all.setFontFamily(BRAND.font).setFontSize(10).setFontColor(BRAND.ink).setVerticalAlignment('middle')
     .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  head.setBackground(BRAND.ink).setFontColor(BRAND.white).setFontWeight('bold').setFontSize(10)
      .setBorder(false, false, true, false, false, false, BRAND.saffron, SpreadsheetApp.BorderStyle.SOLID_THICK);
  sh.setRowHeight(1, 34);
  sh.setFrozenRows(1);
  spec.widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setTabColor(spec.color);

  // Soft zebra rows.
  sh.getBandings().forEach(b => b.remove());
  const band = all.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
  band.setHeaderRowColor(BRAND.ink).setFirstRowColor(BRAND.white).setSecondRowColor(BRAND.bg);

  // Colour rules per tab.
  const body = sh.getRange(2, 1, lastRow - 1, n);
  const col = c => sh.getRange(2, spec.cols.indexOf(c) + 1, lastRow - 1, 1);
  const rules = [];
  const R = () => SpreadsheetApp.newConditionalFormatRule();
  if (name === 'Events') {
    rules.push(R().whenTextEqualTo('received').setBackground(BRAND.tealPale).setFontColor(BRAND.teal).setBold(true).setRanges([col('event')]).build());
    rules.push(R().whenTextEqualTo('replied').setBackground(BRAND.saffronPale).setFontColor('#6B4200').setBold(true).setRanges([col('event')]).build());
    rules.push(R().whenTextStartsWith('followup_').setFontColor(BRAND.muted).setRanges([col('event')]).build());
  }
  if (name === 'Rejects') {
    col('errors').setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    rules.push(R().whenFormulaSatisfied('=$F2<>""').setFontColor(BRAND.muted).setItalic(true).setRanges([body]).build()); // test rejects
  }
  if (name === 'TestReport') {
    rules.push(R().whenFormulaSatisfied('=$B2="SUMMARY"').setBackground(BRAND.saffronPale).setBold(true).setRanges([body]).build());
    rules.push(R().whenTextEqualTo('PASS').setBackground(BRAND.tealPale).setFontColor(BRAND.goodText).setBold(true).setRanges([col('pass')]).build());
    rules.push(R().whenTextEqualTo('FAIL').setBackground(BRAND.badPale).setFontColor(BRAND.badText).setBold(true).setRanges([col('pass')]).build());
    col('pass').setHorizontalAlignment('center');
  }
  sh.setConditionalFormatRules(rules);

  // Warn (not block) before anyone edits the header by hand.
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => { if (p.getDescription() === 'n8n header') p.remove(); });
  head.protect().setDescription('n8n header').setWarningOnly(true);
  return note;
}

function buildOverview() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('Overview');
  if (!sh) sh = ss.insertSheet('Overview', 0);
  sh.clear();
  sh.clearConditionalFormatRules();
  sh.getBandings().forEach(b => b.remove());
  sh.setHiddenGridlines(true);
  sh.setTabColor(BRAND.saffron);
  ss.setActiveSheet(sh); ss.moveActiveSheet(1);

  const maxCols = 8;
  if (sh.getMaxColumns() < maxCols) sh.insertColumnsAfter(sh.getMaxColumns(), maxCols - sh.getMaxColumns());
  sh.getRange(1, 1, sh.getMaxRows(), maxCols).setFontFamily(BRAND.font).setFontColor(BRAND.ink).setFontSize(10)
    .setVerticalAlignment('middle').setBackground(BRAND.bg);
  [24, 190, 190, 190, 190, 24, 24, 24].forEach((w, i) => sh.setColumnWidth(i + 1, w));

  // Title band
  sh.getRange('A1:H1').setBackground(BRAND.saffron); sh.setRowHeight(1, 6);
  sh.getRange('B3').setValue('Halden Solar Co.').setFontFamily(BRAND.display).setFontSize(22);
  sh.getRange('B4').setValue('Lead Engine log. Times in Pakistan time (PKT). This tab updates itself; edit nothing here.')
    .setFontColor(BRAND.muted);
  sh.setRowHeight(3, 40);

  // KPI cards (value row + label row)
  const kpis = [
    ['B', '=COUNTIF(Events!C2:C,"received")', 'Leads received'],
    ['C', '=COUNTIF(Events!C2:C,"followup_*")', 'Follow-ups sent'],
    ['D', '=COUNTIF(Events!C2:C,"replied")', 'Replies detected'],
    ['E', '=COUNTIFS(Rejects!A2:A,"<>",Rejects!F2:F,"")', 'Rejected submissions']
  ];
  kpis.forEach(([c, f, label]) => {
    sh.getRange(c + '6').setFormula(f).setFontFamily(BRAND.display).setFontSize(26).setBackground(BRAND.white)
      .setHorizontalAlignment('left').setNumberFormat('0');
    sh.getRange(c + '7').setValue(label).setFontColor(BRAND.muted).setBackground(BRAND.white);
    sh.getRange(c + '6:' + c + '7').setBorder(true, true, true, true, false, false, BRAND.rule, SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(6, 48); sh.setRowHeight(7, 26);

  // Latest stress test
  sh.getRange('B9').setValue('Latest stress test').setFontWeight('bold');
  sh.getRange('B10').setFormula('=IFERROR(INDEX(FILTER(TestReport!E2:E,TestReport!B2:B="SUMMARY"),COUNTIF(TestReport!B2:B,"SUMMARY")),"No runs yet")')
    .setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange('C10:E10').merge().setFormula('=IFERROR(INDEX(FILTER(TestReport!D2:D,TestReport!B2:B="SUMMARY"),COUNTIF(TestReport!B2:B,"SUMMARY")),"Run L5 to fill this in.")')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP).setFontColor(BRAND.muted);
  sh.setRowHeight(10, 40);

  // Recent events
  sh.getRange('B12').setValue('Latest 15 events').setFontWeight('bold');
  sh.getRange('B13:D13').setValues([['Time (PKT)', 'Event', 'Lead (email or phone)']])
    .setBackground(BRAND.ink).setFontColor(BRAND.white).setFontWeight('bold');
  sh.getRange('B14').setFormula('=IFERROR(ARRAYFORMULA(SORTN(FILTER({DATEVALUE(LEFT(Events!D2:D,10))+TIMEVALUE(MID(Events!D2:D,12,8))+5/24,Events!C2:C,Events!B2:B},Events!C2:C<>""),15,0,1,FALSE)),"No events yet")');
  sh.getRange('B14:B28').setNumberFormat('d mmm yyyy, hh:mm');
  sh.getRange('B14:D28').setBackground(BRAND.white).setBorder(null, null, true, null, false, true, BRAND.rule, SpreadsheetApp.BorderStyle.SOLID);

  // Recent rejects (real submissions only, not test rows)
  sh.getRange('B30').setValue('Latest 8 rejected submissions').setFontWeight('bold');
  sh.getRange('B31:D31').setValues([['Time (PKT)', 'Why rejected', 'Name']])
    .setBackground(BRAND.ink).setFontColor(BRAND.white).setFontWeight('bold');
  sh.getRange('B32').setFormula('=IFERROR(ARRAYFORMULA(SORTN(FILTER({DATEVALUE(LEFT(Rejects!A2:A,10))+TIMEVALUE(MID(Rejects!A2:A,12,8))+5/24,Rejects!B2:B,Rejects!C2:C},Rejects!A2:A<>"",Rejects!F2:F=""),8,0,1,FALSE)),"None yet")');
  sh.getRange('B32:B39').setNumberFormat('d mmm yyyy, hh:mm');
  sh.getRange('B32:D39').setBackground(BRAND.white).setBorder(null, null, true, null, false, true, BRAND.rule, SpreadsheetApp.BorderStyle.SOLID);

  // Event colours inside the Overview list
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('received').setFontColor(BRAND.teal).setBold(true).setRanges([sh.getRange('C14:C28')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('replied').setBackground(BRAND.saffronPale).setFontColor('#6B4200').setBold(true).setRanges([sh.getRange('C14:C28')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('PASS').setBackground(BRAND.tealPale).setFontColor(BRAND.goodText).setRanges([sh.getRange('B10')]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('FAIL').setBackground(BRAND.badPale).setFontColor(BRAND.badText).setRanges([sh.getRange('B10')]).build()
  ]);

  sh.getRange('B41').setValue('Demo business. Leads live in HubSpot; this sheet keeps the engine\'s own log.').setFontColor(BRAND.muted);
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  sh.protect().setDescription('Overview is generated').setWarningOnly(true);
}
