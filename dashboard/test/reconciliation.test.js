const { test } = require('node:test');
const assert = require('node:assert/strict');
const AOC4Reconcile = require('../js/reconciliation.js');

function line(key, ctx, period, value, extra = {}) {
  return { key, ctx, check: !!extra.check, section: false, label: extra.label || key, values: { [period]: value }, where: extra.where || 'Sheet!R1', ...extra };
}

test('reconciliation: a balanced balance sheet raises no critical issue', () => {
  const p = '2026-03-31';
  const lines = [
    line('SHARE_CAPITAL', 'bs', p, 100000), line('RESERVES_SURPLUS', 'bs', p, 400000),
    line('PPE', 'bs', p, 300000), line('CASH_EQUIVALENTS', 'bs', p, 200000)
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'bs.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.equal(issues.filter(i => i.category === 'critical').length, 0);
});

test('reconciliation: assets != equity+liabilities is flagged critical (BS_DOES_NOT_BALANCE)', () => {
  const p = '2026-03-31';
  const lines = [
    line('SHARE_CAPITAL', 'bs', p, 100000), line('RESERVES_SURPLUS', 'bs', p, 400000),
    line('PPE', 'bs', p, 300000), line('CASH_EQUIVALENTS', 'bs', p, 100000) // assets 400k != liab+equity 500k
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'bs.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.ok(issues.some(i => i.code === 'BS_DOES_NOT_BALANCE'));
});

test("reconciliation: the document's own two 'Total' rows disagreeing is critical", () => {
  const p = '2026-03-31';
  const lines = [
    line('SHARE_CAPITAL', 'bs', p, 100000),
    line('TOTAL_BS', 'bs', p, 500000, { check: true, label: 'Total equity and liabilities', where: 'BS!R8' }),
    line('TOTAL_BS', 'bs', p, 480000, { check: true, label: 'Total assets', where: 'BS!R14' })
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'bs.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.ok(issues.some(i => i.code === 'BS_TOTALS_DISAGREE'));
});

test('reconciliation: PBT/PAT arithmetic errors are flagged critical', () => {
  const p = '2026-03-31';
  const lines = [
    line('REVENUE_OPERATIONS', 'pl', p, 500000), line('OTHER_INCOME', 'pl', p, 0),
    line('EMPLOYEE_EXPENSES', 'pl', p, 200000),
    line('PBT', 'pl', p, 999999, { check: true, label: 'Profit before tax' }), // should be 300000
    line('CURRENT_TAX', 'pl', p, 60000),
    line('PAT', 'pl', p, 240000, { check: true, label: 'Profit after tax' })
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'pl.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.ok(issues.some(i => i.code === 'PBT_ARITHMETIC'));
});

test('reconciliation: correct PBT/tax/PAT arithmetic raises no critical issue', () => {
  const p = '2026-03-31';
  const lines = [
    line('REVENUE_OPERATIONS', 'pl', p, 500000), line('OTHER_INCOME', 'pl', p, 0),
    line('EMPLOYEE_EXPENSES', 'pl', p, 200000),
    line('PBT', 'pl', p, 300000, { check: true, label: 'Profit before tax' }),
    line('CURRENT_TAX', 'pl', p, 60000),
    line('PAT', 'pl', p, 240000, { check: true, label: 'Profit after tax' })
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'pl.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.equal(issues.filter(i => i.category === 'critical').length, 0);
});

test('reconciliation: rounding differences of a rupee or two are tolerated, not flagged', () => {
  const p = '2026-03-31';
  const lines = [
    line('REVENUE_OPERATIONS', 'pl', p, 500000.4), line('OTHER_INCOME', 'pl', p, 0),
    line('EMPLOYEE_EXPENSES', 'pl', p, 200000),
    line('PBT', 'pl', p, 300000, { check: true, label: 'Profit before tax' }) // off by 0.4
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'pl.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.equal(issues.filter(i => i.code === 'PBT_ARITHMETIC').length, 0);
});

test('reconciliation: share capital nominal must equal shares x face value', () => {
  const p = '2026-03-31';
  const lines = [
    line('AUTH_SHARES', 'sc', p, 100000), line('FACE_VALUE', 'sc', p, 10),
    line('AUTH_NOMINAL', 'sc', p, 5000000) // should be 1,000,000
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'sc.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.ok(issues.some(i => i.code === 'AUTH_CAPITAL_ARITHMETIC'));
});

test('reconciliation: paid-up shares exceeding authorised shares is critical', () => {
  const p = '2026-03-31';
  const lines = [line('AUTH_SHARES', 'sc', p, 1000), line('PAID_UP_SHARES', 'sc', p, 1500)];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'sc.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.ok(issues.some(i => i.code === 'PAID_UP_EXCEEDS_AUTHORISED'));
});

test('reconciliation: cash flow opening + net != closing is critical, and ties to the balance sheet cash figure', () => {
  const p = '2026-03-31';
  const lines = [
    line('CF_OPENING_CASH', 'cf', p, 50000), line('CF_NET_OPERATING', 'cf', p, 100000),
    line('CF_NET_INVESTING', 'cf', p, -40000), line('CF_NET_FINANCING', 'cf', p, -10000),
    line('CF_CLOSING_CASH', 'cf', p, 999999), // should be 100000
    line('CASH_EQUIVALENTS', 'bs', p, 100000)
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'cf.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.ok(issues.some(i => i.code === 'CASH_FLOW_ARITHMETIC'));
  assert.ok(issues.some(i => i.code === 'CASH_FLOW_VS_BALANCE_SHEET'));
});

test('reconciliation: a consistent cash flow statement raises no cash-flow issue', () => {
  const p = '2026-03-31';
  const lines = [
    line('CF_OPENING_CASH', 'cf', p, 50000), line('CF_NET_OPERATING', 'cf', p, 100000),
    line('CF_NET_INVESTING', 'cf', p, -40000), line('CF_NET_FINANCING', 'cf', p, -10000),
    line('CF_CLOSING_CASH', 'cf', p, 100000),
    line('CASH_EQUIVALENTS', 'bs', p, 100000)
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'cf.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.equal(issues.filter(i => i.code && i.code.startsWith('CASH_FLOW')).length, 0);
});

test('reconciliation: a ₹1 balance-sheet difference is surfaced (not silently tolerated), but is not critical', () => {
  const p = '2026-03-31';
  const lines = [
    line('SHARE_CAPITAL', 'bs', p, 100000), line('RESERVES_SURPLUS', 'bs', p, 400001), // liab total 500001
    line('PPE', 'bs', p, 300000), line('CASH_EQUIVALENTS', 'bs', p, 200000) // asset total 500000 — off by ₹1
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'bs.xlsx' }, lines, fyEnd: p }], '2025-26');
  const rounding = issues.find(i => i.code === 'BS_ROUNDING_DIFFERENCE');
  assert.ok(rounding, 'expected a ₹1 difference to be reported, not swallowed by tolerance');
  assert.equal(rounding.category, 'discrepancy');
  assert.equal(issues.filter(i => i.code === 'BS_DOES_NOT_BALANCE').length, 0);
});

test('reconciliation: a restated profit figure that differs by just ₹2 (79,035 vs 79,037) is flagged, not absorbed by percentage tolerance', () => {
  const p = '2026-03-31';
  const lines = [
    line('PAT', 'pl', p, 79035, { check: true, label: 'Profit for the year', where: 'PL!R30' }),
    line('PAT', 'notes', p, 79037, { label: 'Profit for the year (Note 4)', where: 'Notes!R80' })
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'cartrendz.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.ok(issues.some(i => i.code === 'CROSS_REFERENCE_MISMATCH' && /79,035|79,037/.test(i.detail)));
});

test('reconciliation: two values whose ratio is close to 100/1000/lakh/crore is flagged as a unit conflict, not a plain mismatch', () => {
  const p = '2026-03-31';
  const lines = [
    line('SHORT_TERM_BORROWINGS', 'bs', p, 500, { label: 'Short term borrowings (in hundreds)', where: 'BS!R12' }),
    line('SHORT_TERM_BORROWINGS', 'notes', p, 50000, { label: 'Short term borrowings (Note 8, absolute Rs.)', where: 'Notes!R60' })
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'x.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.ok(issues.some(i => i.code === 'UNIT_CONFLICT'));
  assert.equal(issues.filter(i => i.code === 'CROSS_REFERENCE_MISMATCH').length, 0);
});

test('reconciliation: short-term borrowings reading zero on the balance sheet but non-zero in the Note 8 breakup is flagged', () => {
  const p = '2026-03-31';
  const lines = [
    line('SHORT_TERM_BORROWINGS', 'bs', p, 0, { label: 'Short term borrowings', where: 'BS!R12' }),
    line('BS_UNSEC_ST_BANK_DEMAND', 'notes', p, 45000, { label: 'Loans repayable on demand from banks', where: 'Notes!R61' }),
    line('BS_UNSEC_ST_RELATED_PARTIES', 'notes', p, 5000, { label: 'Loans and advances from related parties', where: 'Notes!R62' })
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'x.xlsx' }, lines, fyEnd: p }], '2025-26');
  const issue = issues.find(i => i.code === 'BORROWINGS_BREAKUP_MISMATCH');
  assert.ok(issue, 'expected the zero BS figure vs the non-zero note breakup to be flagged');
  assert.match(issue.detail, /50,000/);
});

test('reconciliation: a borrowings breakup that agrees with the balance sheet raises no mismatch', () => {
  const p = '2026-03-31';
  const lines = [
    line('SHORT_TERM_BORROWINGS', 'bs', p, 50000, { label: 'Short term borrowings', where: 'BS!R12' }),
    line('BS_UNSEC_ST_BANK_DEMAND', 'notes', p, 45000, { label: 'Loans repayable on demand from banks', where: 'Notes!R61' }),
    line('BS_UNSEC_ST_RELATED_PARTIES', 'notes', p, 5000, { label: 'Loans and advances from related parties', where: 'Notes!R62' })
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'x.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.equal(issues.filter(i => i.code === 'BORROWINGS_BREAKUP_MISMATCH').length, 0);
});

test('reconciliation: the same line item at two different values in notes vs the face of the statement is a classification issue', () => {
  const p = '2026-03-31';
  const lines = [
    line('PPE', 'bs', p, 300000, { label: 'Property, plant and equipment', where: 'BS!R10' }),
    line('PPE', 'notes', p, 280000, { label: 'Net block (Note 4)', where: 'Notes!R40' })
  ];
  const { issues } = AOC4Reconcile.reconcile([{ doc: { name: 'x.xlsx' }, lines, fyEnd: p }], '2025-26');
  assert.ok(issues.some(i => i.code === 'CROSS_REFERENCE_MISMATCH'));
});

test('reconciliation: a document whose year does not match the filing year is flagged under the fy category', () => {
  const { issues, summary } = AOC4Reconcile.reconcile([{ doc: { name: 'old.xlsx' }, lines: [], fyEnd: '2023-03-31' }], '2025-26');
  assert.ok(issues.some(i => i.code === 'DOC_WRONG_YEAR'));
  assert.ok(summary.fy >= 1);
});

test('reconciliation: several off-year documents collapse into ONE consolidated warning, not one per file', () => {
  const { issues } = AOC4Reconcile.reconcile([
    { doc: { name: 'old-bs.xlsx' }, lines: [], fyEnd: '2023-03-31' },
    { doc: { name: 'old-pl.xlsx' }, lines: [], fyEnd: '2023-03-31' },
    { doc: { name: 'old-cf.xlsx' }, lines: [], fyEnd: '2023-03-31' }
  ], '2025-26');
  const wrongYear = issues.filter(i => i.code === 'DOC_WRONG_YEAR');
  assert.equal(wrongYear.length, 1, 'expected one consolidated issue, not three repeats');
  assert.match(wrongYear[0].detail, /old-bs\.xlsx/);
  assert.match(wrongYear[0].detail, /old-pl\.xlsx/);
  assert.match(wrongYear[0].detail, /old-cf\.xlsx/);
});

test('reconciliation: a filed AOC-4 form (FY 2024-25) and a workbook (FY 2025-26) disagreeing on the year is flagged once, explicitly', () => {
  const { issues } = AOC4Reconcile.reconcile([
    { doc: { name: 'aoc4-last-year.pdf' }, lines: [], fyEnd: '2025-03-31' }, // FY 2024-25
    { doc: { name: 'workbook.xlsx' }, lines: [], fyEnd: '2026-03-31' }       // FY 2025-26
  ], '2025-26');
  const mismatch = issues.find(i => i.code === 'MULTIPLE_CANDIDATE_FY');
  assert.ok(mismatch, 'expected the form-vs-workbook FY disagreement to be surfaced explicitly');
  assert.match(mismatch.detail, /2024-25/);
  assert.match(mismatch.detail, /2025-26/);
});

test('reconciliation: summary counts add up to the total', () => {
  const p = '2026-03-31';
  const lines = [line('AUTH_SHARES', 'sc', p, 1000), line('PAID_UP_SHARES', 'sc', p, 1500)];
  const { issues, summary } = AOC4Reconcile.reconcile([{ doc: { name: 'sc.xlsx' }, lines, fyEnd: p }], '2025-26');
  const sum = summary.critical + summary.discrepancy + summary.missing + summary.classification + summary.fy + summary.warning;
  assert.equal(sum, issues.length);
  assert.equal(summary.total, issues.length);
});
