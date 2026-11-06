const { test } = require('node:test');
const assert = require('node:assert/strict');
const AOC4Compare = require('../js/comparison.js');

const FIELDS = [
  { path: 'balanceSheet.current.SHARE_CAPITAL', label: 'Share capital', type: 'number' },
  { path: 'balanceSheet.current.RESERVES_SURPLUS', label: 'Reserves and surplus', type: 'number' },
  { path: 'balanceSheet.current.PPE', label: 'PPE', type: 'number' },
  { path: 'balanceSheet.current.CASH_EQUIVALENTS', label: 'Cash', type: 'number' },
  { path: 'balanceSheet.previous.CASH_EQUIVALENTS', label: 'Cash (previous)', type: 'number' },
  { path: 'general.CIN', label: 'CIN', type: 'text' },
  { path: 'general.NATURE_FS', label: 'Nature of FS', type: 'select', comparable: false }
];

function dashboard(values) { return path => values[path]; }

test('comparison: exact match', () => {
  const proposals = new Map([['balanceSheet.current.SHARE_CAPITAL', { path: 'balanceSheet.current.SHARE_CAPITAL', value: 100000, confidence: 0.9, sources: ['rules'] }]]);
  const rows = AOC4Compare.buildComparisonRows(FIELDS, proposals, dashboard({ 'balanceSheet.current.SHARE_CAPITAL': 100000 }));
  assert.equal(rows.find(r => r.path === 'balanceSheet.current.SHARE_CAPITAL').status, 'MATCHED');
});

test('comparison: matched after rounding (small difference within tolerance)', () => {
  const proposals = new Map([['balanceSheet.current.PPE', { path: 'balanceSheet.current.PPE', value: 300001, confidence: 0.9, sources: ['rules'] }]]);
  const rows = AOC4Compare.buildComparisonRows(FIELDS, proposals, dashboard({ 'balanceSheet.current.PPE': 300000 }));
  assert.equal(rows.find(r => r.path === 'balanceSheet.current.PPE').status, 'MATCHED_AFTER_ROUNDING');
});

test('comparison: a real mismatch beyond tolerance', () => {
  const proposals = new Map([['balanceSheet.current.RESERVES_SURPLUS', { path: 'balanceSheet.current.RESERVES_SURPLUS', value: 500000, confidence: 0.9, sources: ['rules'] }]]);
  const rows = AOC4Compare.buildComparisonRows(FIELDS, proposals, dashboard({ 'balanceSheet.current.RESERVES_SURPLUS': 400000 }));
  const row = rows.find(r => r.path === 'balanceSheet.current.RESERVES_SURPLUS');
  assert.equal(row.status, 'MISMATCH');
  assert.match(row.detail, /4,00,000/);
});

test('comparison: dashboard has a value the documents never confirmed', () => {
  const proposals = new Map();
  const rows = AOC4Compare.buildComparisonRows(FIELDS, proposals, dashboard({ 'balanceSheet.current.SHARE_CAPITAL': 100000 }));
  assert.equal(rows.find(r => r.path === 'balanceSheet.current.SHARE_CAPITAL').status, 'MISSING_IN_DOCUMENT');
});

test('comparison: documents give a value not yet entered in the dashboard', () => {
  const proposals = new Map([['balanceSheet.current.CASH_EQUIVALENTS', { path: 'balanceSheet.current.CASH_EQUIVALENTS', value: 100000, confidence: 0.9, sources: ['rules'] }]]);
  const rows = AOC4Compare.buildComparisonRows(FIELDS, proposals, dashboard({}));
  assert.equal(rows.find(r => r.path === 'balanceSheet.current.CASH_EQUIVALENTS').status, 'MISSING_IN_DASHBOARD');
});

test('comparison: both sides empty produces no row at all', () => {
  const proposals = new Map();
  const rows = AOC4Compare.buildComparisonRows(FIELDS, proposals, dashboard({}));
  assert.equal(rows.find(r => r.path === 'balanceSheet.previous.CASH_EQUIVALENTS'), undefined);
});

test('comparison: a field whose FY column was absent from every uploaded document is NOT_COMPARABLE', () => {
  const proposals = new Map();
  const notComparable = new Set(['balanceSheet.previous.CASH_EQUIVALENTS']);
  const rows = AOC4Compare.buildComparisonRows(FIELDS, proposals, dashboard({}), notComparable);
  assert.equal(rows.find(r => r.path === 'balanceSheet.previous.CASH_EQUIVALENTS'), undefined); // doc empty + dashboard empty -> still "nothing to show" unless dashboard has something
});

test('comparison: NOT_COMPARABLE wins over MISSING_IN_DOCUMENT when the dashboard already has a value', () => {
  // The dashboard has last year's cash figure, but no uploaded document covered the previous year at
  // all — that's a structural "not available for comparison", more useful to a reviewer than a plain
  // "missing" (which would suggest the document simply omitted this one figure).
  const proposals = new Map();
  const notComparable = new Set(['balanceSheet.previous.CASH_EQUIVALENTS']);
  const rows = AOC4Compare.buildComparisonRows(FIELDS, proposals, dashboard({ 'balanceSheet.previous.CASH_EQUIVALENTS': 60000 }), notComparable);
  assert.equal(rows.find(r => r.path === 'balanceSheet.previous.CASH_EQUIVALENTS').status, 'NOT_COMPARABLE');
});

test('comparison: rules vs AI conflict needs review even if one of them matches the dashboard', () => {
  const proposals = new Map([['balanceSheet.current.SHARE_CAPITAL', { path: 'balanceSheet.current.SHARE_CAPITAL', value: 100000, conflict: { value: 110000 }, confidence: 0.7, sources: ['rules'] }]]);
  const rows = AOC4Compare.buildComparisonRows(FIELDS, proposals, dashboard({ 'balanceSheet.current.SHARE_CAPITAL': 100000 }));
  assert.equal(rows.find(r => r.path === 'balanceSheet.current.SHARE_CAPITAL').status, 'NEEDS_REVIEW');
});

test('comparison: a qualitative field marked not comparable is always NOT_VERIFIABLE', () => {
  const proposals = new Map([['general.NATURE_FS', { path: 'general.NATURE_FS', value: 'adopted', confidence: 0.6, sources: ['ai'] }]]);
  const rows = AOC4Compare.buildComparisonRows(FIELDS, proposals, dashboard({ 'general.NATURE_FS': 'provisional' }));
  assert.equal(rows.find(r => r.path === 'general.NATURE_FS').status, 'NOT_VERIFIABLE');
});

test('comparison: text fields compare case/whitespace-insensitively', () => {
  const proposals = new Map([['general.CIN', { path: 'general.CIN', value: 'U12345MH2020PTC123456', confidence: 0.95, sources: ['rules'] }]]);
  const rows = AOC4Compare.buildComparisonRows(FIELDS, proposals, dashboard({ 'general.CIN': ' u12345mh2020ptc123456 ' }));
  assert.equal(rows.find(r => r.path === 'general.CIN').status, 'MATCHED');
});

test('summarize: counts rows by status', () => {
  const rows = [{ status: 'MATCHED' }, { status: 'MATCHED' }, { status: 'MISMATCH' }];
  const s = AOC4Compare.summarize(rows);
  assert.equal(s.total, 3);
  assert.equal(s.MATCHED, 2);
  assert.equal(s.MISMATCH, 1);
});
