/* End-to-end reproduction of the reported Cartrendz extraction run, built from the exact facts in the
 * bug report (since the real workbook/PDFs were not available to this fix): AOC-4 form for FY
 * 2024-25, workbook for FY 2025-26, balance sheet current/comparative dates 31/03/2026 and 31/03/2025,
 * a FY 2025-26 profit of 79,035 vs a Note 4 profit of 79,037, a zero short-term-borrowings face value
 * against a non-zero Note 8 breakup, a "figures in hundreds" unit declaration with one column actually
 * in absolute rupees, and two different audit firms (Jain Ankush K & Associates / FRN 018594S, and
 * Jain S A K & Co. / FRN 018971S). Runs the real pipeline end to end: analyzeDocument → buildProposals
 * → AOC4Reconcile.reconcile → AOC4IssueStore.collectIssues.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const AOC4Extract = require('../js/extractor.js');
const AOC4Reconcile = require('../js/reconciliation.js');
const AOC4IssueStore = require('../js/issue-store.js');

function workbookDoc(name, sheetsObj) {
  const sheets = Object.entries(sheetsObj).map(([sheetName, rows]) => ({ name: sheetName, rows }));
  const text = sheets.map(s => `## Sheet: ${s.name}\n` + s.rows.map(r => r.join('\t')).join('\n')).join('\n\n');
  return { name, kind: 'sheet', sheets, text };
}

// Workbook: Balance Sheet (FY 2025-26, current 31/03/2026 vs comparative 31/03/2025) — unit header
// says "hundreds", but the Cash column is actually already in absolute rupees (the real-world "some
// columns in full rupee amounts" bug).
const BS_ROWS = [
  ['Balance Sheet as at 31 March 2026 (Figures in Rs. hundreds unless otherwise stated)', '', ''],
  ['Particulars', '31-Mar-2026', '31-Mar-2025'],
  ['Share capital', 1000, 1000],
  ['Reserves and surplus', 4000, 3000],
  ['Short term borrowings', 0, 0], // reads as zero on the face of the BS — see Note 8 below
  ['Trade payables', 500, 400],
  ['Property, plant and equipment', 3000, 2500],
  ['Inventories', 1500, 1000],
  ['Trade receivables', 2000, 1800],
  ['Cash and cash equivalents', 100000, 60000] // already absolute rupees, NOT hundreds like the rest
];

// Workbook: a single "Notes" sheet (all amounts in absolute Rupees — declared once, up top, so it
// governs every note below regardless of the Balance Sheet sheet's own separate "hundreds" unit).
// Note 8 — short-term borrowings breakup (the figure the BS face misses entirely).
const NOTE8_ROWS = [
  ['Notes to the financial statements (All amounts stated in absolute Rupees, unless otherwise indicated)', '', ''],
  ['Note 8: Details of short-term borrowings (unsecured)', '', ''],
  ['Particulars', '31-Mar-2026', '31-Mar-2025'],
  ['Loans repayable on demand from banks', 45000, 38000],
  ['Loans and advances from related parties', 5000, 4000]
];

// A separate note restating cash and cash equivalents — the BS face (above) reads the SAME raw
// number but has it multiplied ×100 by the Balance Sheet sheet's own "in hundreds" header, so these
// two should disagree by almost exactly that 100x ratio (the real "unit conflict" bug).
const CASH_NOTE_ROWS = [
  ['Note 15: Cash and cash equivalents', '', ''],
  ['Particulars', '31-Mar-2026', '31-Mar-2025'],
  ['Cash and cash equivalents', 100000, 60000]
];

// Note 4 — profit for the year restated, off by ₹2 from the P&L figure.
const NOTE4_ROWS = [
  ['Note 4: Reserves and surplus', '', ''],
  ['Particulars', '31-Mar-2026', '31-Mar-2025'],
  ['Profit for the year', 79037, 60000]
];

const PL_ROWS = [
  ['Statement of Profit and Loss for the year ended 31 March 2026 (Amount in absolute Rupees)', '', ''],
  ['Particulars', '31-Mar-2026', '31-Mar-2025'],
  ['Revenue from operations', 500000, 400000],
  ['Other income', 0, 0],
  ['Employee benefit expenses', 300000, 250000],
  ['Finance costs', 100000, 80000],
  ['Profit for the year', 79035, 60000] // the P&L's own figure — differs from Note 4's 79,037
];

// The auditor's report names one firm; the board's report / a reference elsewhere names another.
const AUDITORS_REPORT_TEXT = `
  Independent Auditor's Report
  For Jain Ankush K & Associates
  Chartered Accountants
  ICAI Firm Registration No: 018594S
  per Ankush Jain
  Partner
  Membership No: 111111
  Date: 30/09/2025
`;
const BOARD_REPORT_TEXT = `
  Board's Report
  For Jain S A K & Co.
  Chartered Accountants
  ICAI Firm Registration No: 018971S
  per Sumit Jain
  Partner
  Membership No: 222222
  Date: 28/09/2025
`;

// Last year's filed AOC-4 form text — declares FY 2024-25 (From 01/04/2024 To 31/03/2025), which is a
// perfectly legitimate "previous year" source, but is a DIFFERENT financial year label than the
// workbook's FY 2025-26 and must never be treated as the filing year by mistake.
const AOC4_FORM_TEXT = `
  Form No. AOC-4
  Form for filing financial statement and other documents
  Corporate identity number (CIN) U12345MH2020PTC123456
  *From (DD/MM/YYYY) 01/04/2024
  *To (DD/MM/YYYY) 31/03/2025
`;

test('Cartrendz-pattern scenario: full pipeline end to end', () => {
  // One multi-sheet workbook — exactly how a real Cartrendz-style .xlsx is ingested (one `doc` with
  // several `sheets`, NOT a separate document per sheet), so the engine's cross-sheet reconciliation
  // (BS face vs Notes) actually has both sides to compare within the same analysis.
  const workbook = workbookDoc('cartrendz-workbook.xlsx', {
    BS: BS_ROWS,
    PL: PL_ROWS,
    Notes: [...NOTE8_ROWS, ...CASH_NOTE_ROWS, ...NOTE4_ROWS]
  });
  const workbookAnalysis = AOC4Extract.analyzeDocument(workbook);
  const auditorsReportDoc = AOC4Extract.analyzeDocument({ name: 'auditors-report.pdf', kind: 'text', text: AUDITORS_REPORT_TEXT, sheets: [], pages: [] });
  const boardReportDoc = AOC4Extract.analyzeDocument({ name: 'board-report.pdf', kind: 'text', text: BOARD_REPORT_TEXT, sheets: [], pages: [] });
  const aoc4FormDoc = AOC4Extract.analyzeDocument({ name: 'aoc4-last-year.pdf', kind: 'text', text: AOC4_FORM_TEXT, sheets: [], pages: [] });

  const analyses = [workbookAnalysis, auditorsReportDoc, boardReportDoc, aoc4FormDoc];
  const fy = '2025-26'; // the workbook's year — the correct filing year despite last year's form saying 2024-25
  const rules = AOC4Extract.buildProposals(analyses, fy);
  const reconciliation = AOC4Reconcile.reconcile(analyses, fy);
  const { issues, summary } = AOC4IssueStore.collectIssues({
    reconciliation,
    auditorCandidates: rules.auditorCandidates,
    signatoriesFS: rules.signatoriesFS,
    signatoriesBR: [],
    hasBoardReportDoc: true,
    docTypesPresent: ['financials', 'balance-sheet', 'profit-loss', 'auditor-report', 'board-report', 'aoc4-form']
  });

  // 1. FY intelligence: the form's FY 2024-25 is correctly recognised as a DIFFERENT year from the
  // filing year, surfaced once, explicitly — never silently merged or used to overwrite FY 2025-26 dates.
  assert.ok(issues.some(i => i.category === 'PERIOD_MISMATCH'), 'expected the FY 2024-25 vs FY 2025-26 disagreement to be surfaced');
  // The auditor's sign date comes from THIS year's auditor's report (30/09/2025), never from the
  // separately-uploaded prior-year AOC-4 form — the two financial years must stay strictly separate.
  const signDateProposal = rules.proposals.find(p => p.path === 'general.AUDITOR_SIGN_DATE');
  assert.ok(signDateProposal, 'expected an auditor sign date to be proposed from the current year auditor\'s report');
  assert.equal(signDateProposal.value, '30/09/2025');

  // 2. Auditor conflict: both firms are present, neither silently wins.
  const auditorIssue = issues.find(i => i.category === 'AUDITOR_CONFLICT');
  assert.ok(auditorIssue, 'expected an AUDITOR_CONFLICT issue for the two firms');
  assert.match(auditorIssue.detail, /018594S/);
  assert.match(auditorIssue.detail, /018971S/);

  // 3. Borrowings: BS face reads 0 (x100 = ₹0), Note 8 breakup is non-zero — flagged, not silently 0.
  assert.ok(reconciliation.issues.some(i => i.code === 'BORROWINGS_BREAKUP_MISMATCH'), 'expected the zero BS borrowings figure vs the non-zero Note 8 breakup to be flagged');

  // 4. Restated profit: ₹79,035 (P&L) vs ₹79,037 (Note 4) is flagged, not absorbed by rounding.
  assert.ok(reconciliation.issues.some(i => i.code === 'CROSS_REFERENCE_MISMATCH' && /79,035|79,037/.test(i.detail)), 'expected the ₹2 profit restatement difference to be flagged');

  // 5. Unit conflict: Cash and cash equivalents is ~100x every other BS line (hundreds vs absolute).
  assert.ok(reconciliation.issues.some(i => i.code === 'UNIT_CONFLICT'), 'expected the mixed hundreds/absolute-rupee cash figure to be flagged as a unit conflict');

  // Sanity: every category the summary reports sums to the total, and nothing was silently dropped.
  const sum = AOC4IssueStore.CATEGORIES.reduce((n, c) => n + summary[c], 0);
  assert.equal(sum, issues.length);
  assert.ok(issues.length >= 4, `expected several distinct issue categories to fire; got ${issues.length}`);
});
