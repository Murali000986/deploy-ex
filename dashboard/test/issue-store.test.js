const { test } = require('node:test');
const assert = require('node:assert/strict');
const AOC4Reconcile = require('../js/reconciliation.js');
const AOC4IssueStore = require('../js/issue-store.js');

test('collectIssues: a reconciliation fy-category issue becomes PERIOD_MISMATCH', () => {
  const { issues: reconIssues } = AOC4Reconcile.reconcile([{ doc: { name: 'old.xlsx' }, lines: [], fyEnd: '2023-03-31' }], '2025-26');
  const { issues, summary } = AOC4IssueStore.collectIssues({ reconciliation: { issues: reconIssues } });
  assert.ok(issues.some(i => i.category === 'PERIOD_MISMATCH'));
  assert.ok(summary.PERIOD_MISMATCH >= 1);
});

test('collectIssues: a reconciliation UNIT_CONFLICT code becomes category UNIT_CONFLICT, not FINANCIAL_MISMATCH', () => {
  const reconIssues = [{ category: 'classification', code: 'UNIT_CONFLICT', title: 'x', detail: 'y', file: 'a.xlsx', period: '2026-03-31', paths: [] }];
  const { issues } = AOC4IssueStore.collectIssues({ reconciliation: { issues: reconIssues } });
  assert.equal(issues[0].category, 'UNIT_CONFLICT');
});

test('collectIssues: a critical BS imbalance becomes FINANCIAL_MISMATCH with a recommended action', () => {
  const reconIssues = [{ category: 'critical', code: 'BS_DOES_NOT_BALANCE', title: 'x', detail: 'y', file: 'a.xlsx', period: '2026-03-31', paths: [] }];
  const { issues } = AOC4IssueStore.collectIssues({ reconciliation: { issues: reconIssues } });
  assert.equal(issues[0].category, 'FINANCIAL_MISMATCH');
  assert.equal(issues[0].severity, 'error');
  assert.match(issues[0].recommendedAction, /misread|misclassified/);
});

test('collectIssues: extraction diagnostics with a truncated/parse error become JSON_PARSE_ERROR', () => {
  const diagnostics = [{ items: [{ path: 'balanceSheet.current.PPE' }], attempt: 2, error: "Expected ',' or ']' after array element", truncated: true, rawTextSnippet: '{"fields":[{"path":"balanceSheet.current.PPE"' }];
  const { issues } = AOC4IssueStore.collectIssues({ extractionDiagnostics: diagnostics });
  assert.equal(issues[0].category, 'JSON_PARSE_ERROR');
  assert.equal(issues[0].field, 'balanceSheet.current.PPE');
  assert.match(issues[0].evidence.quote, /balanceSheet\.current\.PPE/);
});

test('collectIssues: a non-JSON extraction failure becomes EXTRACTION_FAILED', () => {
  const diagnostics = [{ items: [{ path: 'general.CIN' }], attempt: 2, error: 'Gateway error 503: Claude is not configured', truncated: false }];
  const { issues } = AOC4IssueStore.collectIssues({ extractionDiagnostics: diagnostics });
  assert.equal(issues[0].category, 'EXTRACTION_FAILED');
});

test('collectIssues: an unmapped AI field becomes FIELD_MAPPING_MISSING', () => {
  const unmappedFields = [{ path: 'general.DOES_NOT_EXIST', value: 'x', reason: 'path "general.DOES_NOT_EXIST" is not in the field catalogue' }];
  const { issues } = AOC4IssueStore.collectIssues({ unmappedFields });
  assert.equal(issues[0].category, 'FIELD_MAPPING_MISSING');
});

test('collectIssues: two audit firms become one AUDITOR_CONFLICT issue naming both', () => {
  const auditorCandidates = [
    { name: 'Jain Ankush K & Associates', frn: '018594S', memberNumber: '123456', file: 'auditors-report.pdf', date: '30/09/2025' },
    { name: 'Jain S A K & Co.', frn: '018971S', memberNumber: '654321', file: 'board-report.pdf', date: '30/09/2025' }
  ];
  const { issues } = AOC4IssueStore.collectIssues({ auditorCandidates });
  const issue = issues.find(i => i.category === 'AUDITOR_CONFLICT');
  assert.ok(issue);
  assert.match(issue.detail, /018594S/);
  assert.match(issue.detail, /018971S/);
  assert.equal(issue.candidates.length, 2);
});

test('collectIssues: one audit firm alone is not a conflict', () => {
  const { issues } = AOC4IssueStore.collectIssues({ auditorCandidates: [{ name: 'Jain S A K & Co.', frn: '018971S' }] });
  assert.equal(issues.filter(i => i.category === 'AUDITOR_CONFLICT').length, 0);
});

test('collectIssues: no FS signatories at all is flagged', () => {
  const { issues } = AOC4IssueStore.collectIssues({ signatoriesFS: [], signatoriesBR: [] });
  assert.ok(issues.some(i => i.category === 'SIGNATORY_MISSING' && i.field === 'signatoriesFS'));
});

test("collectIssues: Board Report signatories populated without a Board's Report document is a SOURCE_PLACEHOLDER, not silently accepted", () => {
  const { issues } = AOC4IssueStore.collectIssues({
    signatoriesFS: [{ din: '1', name: 'A' }],
    signatoriesBR: [{ din: '2', name: 'B' }],
    hasBoardReportDoc: false
  });
  const issue = issues.find(i => i.category === 'SOURCE_PLACEHOLDER');
  assert.ok(issue, "expected signatoriesBR with no Board's Report upload to be flagged");
});

test("collectIssues: Board Report signatories WITH a Board's Report document present raises no placeholder warning", () => {
  const { issues } = AOC4IssueStore.collectIssues({
    signatoriesFS: [{ din: '1', name: 'A' }],
    signatoriesBR: [{ din: '2', name: 'B' }],
    hasBoardReportDoc: true
  });
  assert.equal(issues.filter(i => i.category === 'SOURCE_PLACEHOLDER').length, 0);
});

test('collectIssues: missing balance sheet / P&L / auditor report document types are flagged', () => {
  const { issues } = AOC4IssueStore.collectIssues({ docTypesPresent: ['workbook'] });
  const categories = issues.filter(i => i.category === 'MISSING_DOCUMENT').map(i => i.title);
  assert.ok(categories.some(t => /Balance sheet/.test(t)));
  assert.ok(categories.some(t => /Profit and loss/.test(t)));
  assert.ok(categories.some(t => /Auditor/.test(t)));
});

test('collectIssues: uploading combined "financials" covers both balance sheet and P&L', () => {
  const { issues } = AOC4IssueStore.collectIssues({ docTypesPresent: ['financials', 'auditor-report'] });
  assert.equal(issues.filter(i => i.category === 'MISSING_DOCUMENT').length, 0);
});

test('collectIssues: the exact same field failing twice (e.g. reported by an overlapping split) collapses into one issue with an occurrence count', () => {
  const diagnostics = [
    { items: [{ path: 'balanceSheet.current.PPE' }], attempt: 2, error: "Expected ',' or ']' after array element" },
    { items: [{ path: 'balanceSheet.current.PPE' }], attempt: 2, error: "Expected ',' or ']' after array element" }
  ];
  const { issues } = AOC4IssueStore.collectIssues({ extractionDiagnostics: diagnostics });
  const parseErrors = issues.filter(i => i.category === 'JSON_PARSE_ERROR');
  assert.equal(parseErrors.length, 1, 'the same field failing twice should collapse into one issue');
  assert.equal(parseErrors[0].occurrences, 2);
});

test('collectIssues: different fields failing with a similarly-worded error stay as SEPARATE issues — grouping must never hide which fields failed', () => {
  const diagnostics = [
    { items: [{ path: 'a' }], attempt: 2, error: "Expected ',' or ']' after array element" },
    { items: [{ path: 'b' }], attempt: 2, error: "Expected ',' or ']' after array element" }
  ];
  const { issues } = AOC4IssueStore.collectIssues({ extractionDiagnostics: diagnostics });
  const parseErrors = issues.filter(i => i.category === 'JSON_PARSE_ERROR');
  assert.equal(parseErrors.length, 2);
  assert.deepEqual(parseErrors.map(i => i.field).sort(), ['a', 'b']);
});

test('collectIssues: summary counts match the issues returned, across every category key', () => {
  const { issues, summary } = AOC4IssueStore.collectIssues({ docTypesPresent: [] });
  const sum = AOC4IssueStore.CATEGORIES.reduce((n, c) => n + summary[c], 0);
  assert.equal(sum, issues.length);
  assert.equal(summary.total, issues.length);
});
