const { test } = require('node:test');
const assert = require('node:assert/strict');
const AOC4Extract = require('../js/extractor.js');

test('parseAmount: Indian comma grouping', () => {
  assert.equal(AOC4Extract.parseAmount('33,42,799'), 3342799);
  assert.equal(AOC4Extract.parseAmount('1,00,000'), 100000);
});

test('parseAmount: parenthesized negative (debit/credit sign)', () => {
  assert.equal(AOC4Extract.parseAmount('(12,422)'), -12422);
  assert.equal(AOC4Extract.parseAmount('-12,422'), -12422);
  assert.equal(AOC4Extract.parseAmount('12,422-'), -12422);
});

test('parseAmount: nil / dash / none', () => {
  assert.equal(AOC4Extract.parseAmount('-'), 0);
  assert.equal(AOC4Extract.parseAmount('Nil'), 0);
  assert.equal(AOC4Extract.parseAmount('N/A'), 0);
});

test('parseAmount: decimals and percentages', () => {
  assert.equal(AOC4Extract.parseAmount('31.43'), 31.43);
  assert.equal(AOC4Extract.parseAmount('12%'), null);
});

test('parseAmount: rupee symbol / Rs. prefix and Cr/Dr suffix', () => {
  assert.equal(AOC4Extract.parseAmount('Rs. 5,000'), 5000);
  assert.equal(AOC4Extract.parseAmount('₹5,000'), 5000);
  assert.equal(AOC4Extract.parseAmount('5,000 Cr'), 5000);
});

test('detectUnit: lakhs / thousands / crores / hundreds scale', () => {
  assert.equal(AOC4Extract.detectUnit('(All amounts in Rs. lakhs unless otherwise stated)').mult, 100000);
  assert.equal(AOC4Extract.detectUnit("(Rs. '000)").mult, 1000);
  assert.equal(AOC4Extract.detectUnit('Amount in Rs. Crores').mult, 10000000);
  assert.equal(AOC4Extract.detectUnit("(Rs. '00)").mult, 100);
  assert.equal(AOC4Extract.detectUnit('figures in absolute Rupees').mult, 1);
  assert.equal(AOC4Extract.detectUnit('no unit mentioned here'), null);
});

test('parsePeriod: common date and FY-header formats', () => {
  assert.equal(AOC4Extract.parsePeriod('31st March, 2026'), '2026-03-31');
  assert.equal(AOC4Extract.parsePeriod('31-Mar-2026'), '2026-03-31');
  assert.equal(AOC4Extract.parsePeriod('31/03/2026'), '2026-03-31');
  assert.equal(AOC4Extract.parsePeriod('March 31, 2026'), '2026-03-31');
  assert.equal(AOC4Extract.parsePeriod('FY 2025-26'), '2026-03-31');
});

test('fyFromEnd / fyEnds round-trip', () => {
  assert.equal(AOC4Extract.fyFromEnd('2026-03-31'), '2025-26');
  const ends = AOC4Extract.fyEnds('2025-26');
  assert.equal(ends.current, '2026-03-31');
  assert.equal(ends.previous, '2025-03-31');
});

test('columnForPeriod: same FY maps current/previous correctly', () => {
  assert.equal(AOC4Extract.columnForPeriod('2026-03-31', '2025-26'), 'current');
  assert.equal(AOC4Extract.columnForPeriod('2025-03-31', '2025-26'), 'previous');
});

test('columnForPeriod: a few days of printing slop is tolerated', () => {
  assert.equal(AOC4Extract.columnForPeriod('2026-03-28', '2025-26'), 'current');
});

test('columnForPeriod: a document from a different financial year maps to neither column', () => {
  assert.equal(AOC4Extract.columnForPeriod('2023-03-31', '2025-26'), null);
  assert.equal(AOC4Extract.columnForPeriod('2024-03-31', '2025-26'), null);
});

test('columnForPeriod: missing fy or period is always "not comparable"', () => {
  assert.equal(AOC4Extract.columnForPeriod('2026-03-31', null), null);
  assert.equal(AOC4Extract.columnForPeriod(null, '2025-26'), null);
});

test('extractJsonPayload: parses plain JSON', () => {
  const obj = AOC4Extract.extractJsonPayload('{"fields":[],"notes":[]}');
  assert.deepEqual(obj, { fields: [], notes: [] });
});

test('extractJsonPayload: strips a markdown code fence without touching the JSON content', () => {
  const obj = AOC4Extract.extractJsonPayload('```json\n{"fields":[{"path":"a","value":"1"}],"notes":[]}\n```');
  assert.equal(obj.fields[0].value, '1');
});

test('extractJsonPayload: a truncated array throws a clear error with the raw text attached, never a partial repair', () => {
  // Exactly the reported symptom: "Expected \',\' or \']\' after array element" — the array was cut
  // off mid-element by a token limit. This must fail loudly, not parse a truncated object.
  const truncated = '{"fields":[{"path":"balanceSheet.current.PPE","value":"300000","period_end":"2026-03-31","evidence":"BS p2 PPE 3,00,000","confidence":0.9},{"path":"balanceSheet.current.INV';
  assert.throws(() => AOC4Extract.extractJsonPayload(truncated), /not valid JSON/);
  try { AOC4Extract.extractJsonPayload(truncated); } catch (e) { assert.ok(e.rawText.includes('balanceSheet.current.PPE')); }
});

test('sanitizeFieldsArray: keeps well-formed entries and drops malformed ones without guessing at them', () => {
  const { valid, dropped } = AOC4Extract.sanitizeFieldsArray([
    { path: 'general.CIN', value: 'U12345MH2020PTC123456' },
    { path: '', value: '100000' },          // empty path
    { value: '100000' },                     // no path at all
    { path: 'balanceSheet.current.PPE' },    // no value
    null,
    'not an object',
    { path: 'profitLoss.current.PAT', value: 0 } // falsy but DEFINED value must survive
  ]);
  assert.equal(valid.length, 2);
  assert.equal(valid[0].path, 'general.CIN');
  assert.equal(valid[1].path, 'profitLoss.current.PAT');
  assert.equal(dropped.length, 5);
});

test('sanitizeFieldsArray: a non-array input is reported as fully dropped, not crashed on', () => {
  const { valid, dropped } = AOC4Extract.sanitizeFieldsArray('not an array');
  assert.equal(valid.length, 0);
  assert.equal(dropped.length, 1);
});

test('isLikelyScanned: flags a PDF with (almost) no text layer', () => {
  assert.equal(AOC4Extract.isLikelyScanned('', 3), true);
  assert.equal(AOC4Extract.isLikelyScanned('a b', 1), true);
  const normalText = 'Balance Sheet as at 31 March 2026 '.repeat(20);
  assert.equal(AOC4Extract.isLikelyScanned(normalText, 1), false);
});
