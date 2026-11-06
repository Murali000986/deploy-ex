const { test } = require('node:test');
const assert = require('node:assert/strict');
const X = require('../js/adt1-extractor.js');

// Invented data shaped like a consent table, a board resolution and a one-page appointment letter.
const CONSENT = [
  "AUDITOR'S CONSENT AND CERTIFICATE", 'To          Date: 2 0   April , 2026', 'The Board of Directors', 'DEMO WIDGETS PRIVATE   LIMITED',
  'I hereby confirm that I am eligible to be appointed as auditor and have not incurred any disqualifications.',
  'Details of the Auditor are as follows:',
  '1  Name of the Auditor        Anil Demo Kumar', '2  Designation / Qualification        ACA', '3  Membership No.     123456',
  '4  PAN     ABCPK1234F', '5  Firm Registration Number (FRN)     0123456C'
].join('\n');
const flat = s => s.replace(/\s+/g, ' ');
const val = (r, k) => (r.proposals.find(p => p.key === k) || {}).value;

test('a repeated run over the same texts is fast and gives identical output (speed requirement)', () => {
  const docs = [{ name: 'c.pdf', text: CONSENT }, { name: 'c2.pdf', text: flat(CONSENT) }];
  X.extractAdt1(docs);                       // warm-up
  const t0 = process.hrtime.bigint();
  let r; for (let i = 0; i < 50; i++) r = X.extractAdt1(docs);
  const perRunMs = Number(process.hrtime.bigint() - t0) / 1e6 / 50;
  assert.ok(perRunMs < 25, `rules took ${perRunMs.toFixed(2)} ms per run`);
  assert.equal(val(r, 'auditorName'), 'Anil Demo Kumar');
  assert.equal(val(r, 'firmRegistrationNumber'), '0123456C');
  assert.equal(r.proposals.filter(p => p.key === 'membershipNumber').length, 1, 'same value in two files is one proposal');
});

test('layout text and flattened pdf.js text give the same answers', () => {
  const a = X.extractAdt1([{ name: 'a.pdf', text: CONSENT }]).proposals.map(p => [p.key, p.value]).sort();
  const b = X.extractAdt1([{ name: 'a.pdf', text: flat(CONSENT) }]).proposals.map(p => [p.key, p.value]).sort();
  assert.deepEqual(a, b);
});

test('nothing is guessed from an empty or unrelated text', () => {
  assert.deepEqual(X.extractAdt1([{ name: 'e.pdf', text: '' }]).proposals, []);
  assert.deepEqual(X.extractAdt1([{ name: 'e.pdf', text: '   \n  ' }]).proposals, []);
  assert.equal(X.extractAdt1([{ name: 'e.pdf', text: '' }]).docTypes[0].type, 'unknown');
});

test('AI text for all documents goes in ONE string, is deduplicated, trimmed and capped', () => {
  const big = 'Dear Sir\n' + 'The same boilerplate line repeated.\n'.repeat(500) + 'Membership No. 123456\n';
  const txt = X.prepareAiText([{ name: 'a.pdf', text: big }, { name: 'a-copy.pdf', text: big }, { name: 'b.pdf', text: CONSENT }]);
  assert.equal(txt.split('=== FILE:').length - 1, 2, 'an identical document is sent once');
  assert.equal(txt.split('The same boilerplate line repeated.').length - 1, 1, 'repeated lines are sent once');
  assert.ok(txt.length < 40000);
  const capped = X.prepareAiText([{ name: 'x.pdf', text: 'abc def\n'.repeat(5000).replace(/abc/g, (m, i) => 'w' + i) }], { perDoc: 3000, total: 3000 });
  assert.ok(capped.length < 3300);
});

test('AI values that cannot be found in the documents are kept only as low-confidence, unverified rows', () => {
  const docs = [{ name: 'c.pdf', text: CONSENT }];
  const n = X.normalizeAiOutput({ fields: [
    { key: 'auditorPan', value: 'ABCPK1234F', quote: 'PAN ABCPK1234F', file: 'c.pdf' },
    { key: 'firmPan', value: 'ZZZFZ9999Z', quote: 'Firm PAN ZZZFZ9999Z', file: 'c.pdf' },
    { key: 'periodFrom', value: '01/04/2026', quote: 'financial year from 1 April 2026', file: 'c.pdf' }
  ], notes: [] }, docs);
  const get = k => n.proposals.find(p => p.key === k);
  assert.ok(get('auditorPan').confidence >= 0.8 && !get('auditorPan').unverified);
  assert.ok(get('firmPan').unverified && get('firmPan').confidence < 0.5);
  assert.ok(get('periodFrom').unverified, 'a date that no document contains is unverified');
});

test('the order of the AI request: rules never depend on the AI, merged output keeps both values on a clash', () => {
  const docs = [{ name: 'c.pdf', text: CONSENT }];
  const rules = X.extractAdt1(docs).proposals;
  const ai = X.normalizeAiOutput({ fields: [{ key: 'auditorName', value: 'Anil D Kumar', quote: 'Name of the Auditor Anil D Kumar', file: 'c.pdf' }], notes: [] }, docs).proposals;
  const merged = X.mergeProposals(rules.concat(ai));
  const names = merged.filter(p => p.key === 'auditorName');
  assert.equal(names.length, 2);
  assert.ok(names.every(p => p.conflict && p.confidence <= 0.59));
  assert.deepEqual(names.map(p => p.method).sort(), ['ai', 'rules']);
});

test('the constants match the form module', () => {
  const F = require('../js/adt1-form.js');
  assert.deepEqual(X.NATURE_OPTIONS, F.ADT1_NATURE_OPTIONS);
  assert.deepEqual(X.DESIGNATIONS, F.ADT1_DESIGNATIONS);
  for (const f of F.ADT1_FIELD_LIST.filter(f => f.type === 'select')) assert.deepEqual(X.SELECTS[f.key], f.opts, f.key);
  for (const k of X.KEYS) assert.ok(F.ADT1_FIELD_LIST.some(f => f.key === k), k + ' is a form key');
});
