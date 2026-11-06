const { test } = require('node:test');
const assert = require('node:assert/strict');
const AOC4Extract = require('../js/extractor.js');

function sheetDoc(name, sheetName, rows) {
  return { name, kind: 'sheet', sheets: [{ name: sheetName, rows }], text: rows.map(r => r.join('\t')).join('\n') };
}

const BS_ROWS = [
  ['Balance Sheet as at 31 March 2026', '', ''],
  ['Particulars', '31-Mar-2026', '31-Mar-2025'],
  ['Equity and Liabilities', '', ''],
  ['Share capital', 100000, 100000],
  ['Reserves and surplus', 400000, 300000],
  ['Long term borrowings', 200000, 150000],
  ['Trade payables', 50000, 40000],
  ['Total', 750000, 590000],
  ['Assets', '', ''],
  ['Property, plant and equipment', 300000, 250000],
  ['Inventories', 150000, 100000],
  ['Trade receivables', 200000, 180000],
  ['Cash and cash equivalents', 100000, 60000],
  ['Total', 750000, 590000]
];

test('analyzeDocument + buildProposals: same-FY balance sheet, current vs previous comparative columns', () => {
  const doc = sheetDoc('bs.xlsx', 'BS', BS_ROWS);
  const analysis = AOC4Extract.analyzeDocument(doc);
  const result = AOC4Extract.buildProposals([analysis], '2025-26');
  const byPath = Object.fromEntries(result.proposals.map(p => [p.path, p]));
  assert.equal(byPath['balanceSheet.current.SHARE_CAPITAL'].value, 100000);
  assert.equal(byPath['balanceSheet.previous.SHARE_CAPITAL'].value, 100000);
  assert.equal(byPath['balanceSheet.current.RESERVES_SURPLUS'].value, 400000);
  assert.equal(byPath['balanceSheet.previous.RESERVES_SURPLUS'].value, 300000);
  assert.equal(byPath['balanceSheet.current.PPE'].value, 300000);
  assert.equal(byPath['balanceSheet.previous.CASH_EQUIVALENTS'].value, 60000);
  // Evidence is kept per proposal.
  assert.equal(byPath['balanceSheet.current.SHARE_CAPITAL'].evidence.file, 'bs.xlsx');
  assert.match(byPath['balanceSheet.current.SHARE_CAPITAL'].evidence.where, /^BS!R/);
});

test('buildProposals: a document dated for the wrong financial year is excluded from comparison, not silently wrong', () => {
  const wrongYearRows = BS_ROWS.map(r => r.map(c => (c === '31-Mar-2026' ? '31-Mar-2023' : c === '31-Mar-2025' ? '31-Mar-2022' : c)));
  wrongYearRows[0] = ['Balance Sheet as at 31 March 2023', '', ''];
  const doc = sheetDoc('old-bs.xlsx', 'BS', wrongYearRows);
  const analysis = AOC4Extract.analyzeDocument(doc);
  const result = AOC4Extract.buildProposals([analysis], '2025-26');
  assert.equal(result.proposals.filter(p => p.path.startsWith('balanceSheet.')).length, 0);
  assert.ok(result.unmappedPeriods.includes('2023-03-31') || result.unmappedPeriods.includes('2022-03-31'));
});

test('buildProposals: figures stated in lakhs are converted to absolute rupees', () => {
  const rows = [
    ['Balance Sheet as at 31 March 2026 (Rs. in lakhs)', '', ''],
    ['Particulars', '31-Mar-2026', '31-Mar-2025'],
    ['Share capital', 10, 10],
    ['Reserves and surplus', 40, 30]
  ];
  const doc = sheetDoc('bs-lakhs.xlsx', 'BS', rows);
  const analysis = AOC4Extract.analyzeDocument(doc);
  const result = AOC4Extract.buildProposals([analysis], '2025-26');
  const byPath = Object.fromEntries(result.proposals.map(p => [p.path, p]));
  assert.equal(byPath['balanceSheet.current.SHARE_CAPITAL'].value, 1000000);
  assert.equal(byPath['balanceSheet.current.RESERVES_SURPLUS'].value, 4000000);
});

test('buildProposals: a parenthesized figure (debit/credit sign) is read as negative', () => {
  const rows = [
    ['Statement of Profit and Loss for the year ended 31 March 2026', '', ''],
    ['Particulars', '31-Mar-2026', '31-Mar-2025'],
    ['Revenue from operations', 500000, 400000],
    ['Other expenses', '(20,000)', '(15,000)']
  ];
  const doc = sheetDoc('pl.xlsx', 'PL', rows);
  const analysis = AOC4Extract.analyzeDocument(doc);
  const result = AOC4Extract.buildProposals([analysis], '2025-26');
  const byPath = Object.fromEntries(result.proposals.map(p => [p.path, p]));
  assert.equal(byPath['profitLoss.current.OTHER_EXPENSES'].value, -20000);
});

test('buildProposals: differing labels for the same Schedule III line item map to the same key', () => {
  const rowsA = [['Balance Sheet', '', ''], ['Particulars', '31-Mar-2026', '31-Mar-2025'], ['Trade receivables', 100000, 90000]];
  const rowsB = [['Balance Sheet', '', ''], ['Particulars', '31-Mar-2026', '31-Mar-2025'], ['Sundry debtors', 100000, 90000]];
  for (const rows of [rowsA, rowsB]) {
    const analysis = AOC4Extract.analyzeDocument(sheetDoc('x.xlsx', 'BS', rows));
    const result = AOC4Extract.buildProposals([analysis], '2025-26');
    assert.equal(result.proposals.find(p => p.path === 'balanceSheet.current.TRADE_RECEIVABLES').value, 100000);
  }
});

test('mergeProposals + dedupeProposals: the same figure from two documents strengthens confidence; conflicting figures surface as a conflict', () => {
  const docA = AOC4Extract.analyzeDocument(sheetDoc('a.xlsx', 'BS', BS_ROWS));
  const docB = AOC4Extract.analyzeDocument(sheetDoc('b.xlsx', 'BS', BS_ROWS));
  const resultA = AOC4Extract.buildProposals([docA], '2025-26');
  const resultBoth = AOC4Extract.buildProposals([docA, docB], '2025-26');
  const same = resultBoth.proposals.find(p => p.path === 'balanceSheet.current.SHARE_CAPITAL');
  const once = resultA.proposals.find(p => p.path === 'balanceSheet.current.SHARE_CAPITAL');
  assert.ok(same.confidence >= once.confidence);

  const conflictingRows = BS_ROWS.map(r => r.map(c => (c === 100000 ? 999000 : c)));
  const docC = AOC4Extract.analyzeDocument(sheetDoc('c.xlsx', 'BS', conflictingRows));
  const resultConflict = AOC4Extract.buildProposals([docA, docC], '2025-26');
  const conflicted = resultConflict.proposals.find(p => p.path === 'balanceSheet.current.SHARE_CAPITAL');
  assert.ok(conflicted.conflict || conflicted.alternatives?.length, 'expected a recorded conflict between disagreeing documents');
});

test('extractFacts: two different audit firms in the same document are both captured, not one silently picked', () => {
  const text = `
    Independent Auditor's Report
    For Jain Ankush K & Associates
    Chartered Accountants
    ICAI Firm Registration No: 018594S
    per Ankush Jain
    Partner
    Membership No: 123456
    Date: 30/09/2025

    (Reference to the prior year's auditor)
    For Jain S A K & Co.
    Chartered Accountants
    ICAI Firm Registration No: 018971S
    per Sumit Jain
    Partner
    Membership No: 654321
    Date: 28/09/2024
  `;
  const { auditorCandidates } = AOC4Extract.extractFacts(text, null);
  assert.equal(auditorCandidates.length, 2);
  const frns = auditorCandidates.map(c => c.frn).sort();
  assert.deepEqual(frns, ['018594S', '018971S']);
  const byFrn = Object.fromEntries(auditorCandidates.map(c => [c.frn, c]));
  assert.equal(byFrn['018594S'].name, 'Jain Ankush K & Associates');
  assert.equal(byFrn['018971S'].name, 'Jain S A K & Co.');
});

test('buildProposals: two audit firms surface as a conflict on auditor.AUDITOR_FIRM_REG, neither silently wins', () => {
  const docText = `
    For Jain Ankush K & Associates
    Chartered Accountants
    ICAI Firm Registration No: 018594S
    per Ankush Jain
    Partner
    Date: 30/09/2025
  `;
  const doc2Text = `
    For Jain S A K & Co.
    Chartered Accountants
    ICAI Firm Registration No: 018971S
    per Sumit Jain
    Partner
    Date: 30/09/2025
  `;
  const a1 = AOC4Extract.analyzeDocument({ name: 'auditors-report.pdf', kind: 'text', text: docText, sheets: [], pages: [] });
  const a2 = AOC4Extract.analyzeDocument({ name: 'board-report.pdf', kind: 'text', text: doc2Text, sheets: [], pages: [] });
  const result = AOC4Extract.buildProposals([a1, a2], '2025-26');
  const frnProposal = result.proposals.find(p => p.path === 'auditor.AUDITOR_FIRM_REG');
  assert.ok(frnProposal.conflict, 'expected the two FRNs to be recorded as a conflict rather than one overwriting the other');
  assert.equal(result.auditorCandidates.length, 2);
});

test('extractFacts: signatories are read from AOC-4 form-layout DIN/designation/date lines', () => {
  const text = 'Signatories 08302207 PUNIT AHUJA Director 30/09/2025 07654321 MEENA RAO Managing Director 30/09/2025';
  const { signatories } = AOC4Extract.extractFacts(text, null);
  assert.equal(signatories.length, 2);
  assert.deepEqual(signatories.map(s => s.designation).sort(), ['Director', 'Managing Director']);
  assert.equal(signatories.find(s => s.din === '08302207').name, 'PUNIT AHUJA');
});

test('normalizeAiOutput: balance-sheet breakup / P&L detail / forex fields resolve with the REVERSED (key-then-period) nesting the dashboard actually uses', () => {
  const catalog = [
    { path: 'balanceSheetBreakup.BS_UNSEC_ST_BANK_DEMAND', label: 'Loans repayable on demand from banks', type: 'number' },
    { path: 'profitLossDetails.PL_MATERIALS_CONSUMED', label: 'Cost of materials consumed', type: 'number' },
    { path: 'foreignExchange.FX_IN_EXPORT_GOODS', label: 'Export of goods (FOB)', type: 'number' }
  ];
  const aiOutput = {
    fields: [
      { path: 'balanceSheetBreakup.BS_UNSEC_ST_BANK_DEMAND', value: '45000', period_end: '2026-03-31', evidence: 'Note 8', confidence: 0.8 },
      { path: 'profitLossDetails.PL_MATERIALS_CONSUMED', value: '200000', period_end: '2026-03-31', evidence: 'Note 20', confidence: 0.8 },
      { path: 'foreignExchange.FX_IN_EXPORT_GOODS', value: '50000', period_end: '2025-03-31', evidence: 'Note 30', confidence: 0.8 }
    ],
    signatoriesFS: [], signatoriesBR: [], notes: []
  };
  const norm = AOC4Extract.normalizeAiOutput(aiOutput, catalog, '2025-26');
  const byPath = Object.fromEntries(norm.proposals.map(p => [p.path, p]));
  assert.equal(byPath['balanceSheetBreakup.BS_UNSEC_ST_BANK_DEMAND.current'].value, 45000);
  assert.equal(byPath['profitLossDetails.PL_MATERIALS_CONSUMED.current'].value, 200000);
  assert.equal(byPath['foreignExchange.FX_IN_EXPORT_GOODS.previous'].value, 50000);
  assert.equal(norm.unmappedFields.length, 0);
});

test('normalizeAiOutput: fields the model returned but could not be used are reported, not silently dropped', () => {
  const catalog = [{ path: 'general.CIN', label: 'CIN', type: 'text' }, { path: 'balanceSheet.PPE', label: 'PPE', type: 'number' }];
  const aiOutput = {
    fields: [
      { path: 'general.CIN', value: 'U12345MH2020PTC123456', period_end: null, evidence: 'e', confidence: 0.9 },
      { path: 'general.DOES_NOT_EXIST', value: 'x', period_end: null, evidence: 'e', confidence: 0.9 }, // unknown path
      { path: 'balanceSheet.PPE', value: 'three lakh', period_end: '2026-03-31', evidence: 'e', confidence: 0.9 }, // unparseable number
      { path: 'balanceSheet.PPE', value: '300000', period_end: null, evidence: 'e', confidence: 0.9 } // BS field with no period
    ],
    signatoriesFS: [], signatoriesBR: [], notes: []
  };
  const norm = AOC4Extract.normalizeAiOutput(aiOutput, catalog, '2025-26');
  assert.equal(norm.proposals.length, 1);
  assert.equal(norm.proposals[0].path, 'general.CIN');
  assert.equal(norm.unmappedFields.length, 3);
  assert.ok(norm.unmappedFields.some(f => f.path === 'general.DOES_NOT_EXIST' && /not in the field catalogue/.test(f.reason)));
  assert.ok(norm.unmappedFields.some(f => f.reason.includes('not a usable number')));
  assert.ok(norm.unmappedFields.some(f => f.reason.includes('no period_end')));
});

test('normalizeAiOutput: FS signatories and Board Report signatories are kept as separate lists', () => {
  const aiOutput = {
    fields: [],
    signatoriesFS: [{ din_or_pan: '08302207', name: 'Punit Ahuja', designation: 'Director', date: '30/09/2025' }],
    signatoriesBR: [{ din_or_pan: '07654321', name: 'Meena Rao', designation: 'Managing Director', date: '28/09/2025' }],
    notes: []
  };
  const norm = AOC4Extract.normalizeAiOutput(aiOutput, [], '2025-26');
  assert.equal(norm.signatoriesFS.length, 1);
  assert.equal(norm.signatoriesBR.length, 1);
  assert.equal(norm.signatoriesFS[0].din, '08302207');
  assert.equal(norm.signatoriesBR[0].din, '07654321');
  assert.notEqual(norm.signatoriesFS[0].din, norm.signatoriesBR[0].din);
});

test('cash flow statement lines are captured as checks, not form fields', () => {
  const rows = [
    ['Cash Flow Statement for the year ended 31 March 2026', '', ''],
    ['Particulars', '31-Mar-2026', '31-Mar-2025'],
    ['Net cash flow from operating activities', 100000, 80000],
    ['Net cash flow from investing activities', '(40,000)', '(20,000)'],
    ['Net cash flow from financing activities', '(10,000)', '(5,000)'],
    ['Cash and cash equivalents at the beginning of the year', 50000, 0],
    ['Cash and cash equivalents at the end of the year', 100000, 50000]
  ];
  const analysis = AOC4Extract.analyzeDocument(sheetDoc('cf.xlsx', 'CF', rows));
  const checkKeys = analysis.lines.filter(l => l.check).map(l => l.key);
  assert.ok(checkKeys.includes('CF_NET_OPERATING'));
  assert.ok(checkKeys.includes('CF_OPENING_CASH'));
  assert.ok(checkKeys.includes('CF_CLOSING_CASH'));
});
