const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildFieldRecord, splitLocation } = require('../js/field-records.js');

test('splitLocation: sheet!row, pdf page, and plain-text line references', () => {
  assert.deepEqual(splitLocation('BS!R23'), { sheetOrPage: 'BS', cellOrLocation: 'Row 23' });
  assert.deepEqual(splitLocation('statement.pdf p4'), { sheetOrPage: 'statement.pdf p4', cellOrLocation: 'Page 4' });
  assert.deepEqual(splitLocation('notes.txt line 12'), { sheetOrPage: 'notes.txt line 12', cellOrLocation: 'Line 12' });
});

test('buildFieldRecord: rules-only proposal gets a rules-based explanation and method', () => {
  const proposal = { path: 'balanceSheet.current.PPE', value: 300000, confidence: 0.9, sources: ['rules'], evidence: { file: 'bs.xlsx', where: 'BS!R10', quote: 'Property, plant and equipment 3,00,000' } };
  const rec = buildFieldRecord(proposal, { catalogLabel: 'Balance sheet: PPE', financialYear: '2025-26', column: 'current' });
  assert.equal(rec.extractionMethod, 'rules');
  assert.equal(rec.sourceFile, 'bs.xlsx');
  assert.equal(rec.sourceSheetOrPage, 'BS');
  assert.equal(rec.financialYear, 'FY 2025-26 (current)');
  assert.match(rec.mappingExplanation, /Property, plant and equipment/);
});

test('buildFieldRecord: AI-only proposal is explained via the catalogue label', () => {
  const proposal = { path: 'general.NATURE_FS', value: 'adopted', confidence: 0.6, sources: ['ai'], evidence: { file: '', where: 'AI', quote: 'adopted financial statements' } };
  const rec = buildFieldRecord(proposal, { catalogLabel: 'Nature of financial statements' });
  assert.equal(rec.extractionMethod, 'ai');
  assert.match(rec.mappingExplanation, /AI model/);
});

test('buildFieldRecord: agreement between rules and AI is reflected in the explanation', () => {
  const proposal = { path: 'balanceSheet.current.PPE', value: 300000, confidence: 0.98, sources: ['rules', 'ai'], evidence: { file: 'bs.xlsx', where: 'BS!R10', quote: 'PPE 3,00,000' } };
  const rec = buildFieldRecord(proposal, { catalogLabel: 'PPE' });
  assert.equal(rec.extractionMethod, 'rules+ai');
  assert.match(rec.mappingExplanation, /agree/);
});

test('buildFieldRecord: a manually edited value is flagged as such', () => {
  const proposal = { path: 'balanceSheet.current.PPE', value: 310000, confidence: 0.9, sources: ['rules'], edited: true, evidence: { file: 'bs.xlsx', where: 'BS!R10', quote: 'PPE 3,00,000' } };
  const rec = buildFieldRecord(proposal, {});
  assert.match(rec.extractionMethod, /manual-edit/);
  assert.match(rec.mappingExplanation, /hand/);
});

test('buildFieldRecord: a proposal with no evidence at all does not crash and reports blank source fields', () => {
  const rec = buildFieldRecord({ path: 'general.CIN', value: 'U12345MH2020PTC123456', confidence: 0.5, sources: ['ai'] }, {});
  assert.equal(rec.sourceFile, '');
  assert.equal(rec.sourceSheetOrPage, '');
  assert.equal(rec.originalValue, 'U12345MH2020PTC123456');
  assert.equal(rec.reviewRequired, true); // confidence 0.5 < 0.7
});

test('buildFieldRecord: low confidence or a conflict marks reviewRequired', () => {
  const low = buildFieldRecord({ path: 'x', value: 1, confidence: 0.3, sources: ['rules'], evidence: {} }, {});
  assert.equal(low.reviewRequired, true);
  const conflicted = buildFieldRecord({ path: 'x', value: 1, confidence: 0.95, conflict: { value: 2 }, sources: ['rules'], evidence: {} }, {});
  assert.equal(conflicted.reviewRequired, true);
  const clean = buildFieldRecord({ path: 'x', value: 1, confidence: 0.95, sources: ['rules', 'ai'], evidence: {} }, { validationStatus: 'MATCHED' });
  assert.equal(clean.reviewRequired, false);
});
