// Review fixes in js/adt1-extractor.js: firm names, the outgoing auditor in a casual vacancy, surnames that look like
// document words, AI quote checks and the company (CIN) check. All data below is invented.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const X = require('../js/adt1-extractor.js');

const CIN = 'U12345KA2024PTC123456';
const BOARD = 'ACME TEST PRIVATE LIMITED. CERTIFIED TRUE COPY OF THE RESOLUTIONS PASSED AT THE MEETING OF THE BOARD OF DIRECTORS HELD ON 5TH MAY 2025. ' +
  'RESOLVED THAT consent of the Board be and is hereby accorded to appoint Rahul Test Sharma, Chartered Accountant, having FRN 123456N as First Auditor of the Company. CIN: ' + CIN;
const byKey = r => { const m = {}; for (const p of r.proposals) (m[p.key] = m[p.key] || []).push(p); return m; };
const val = (r, k) => (byKey(r)[k] || [])[0]?.value;

test('firm name: "M/s" is stripped, the common "appoint M/s. X & Co, Chartered Accountants" wording gives ONE value, no fake conflict', () => {
  const r = X.extractAdt1([{ name: 'b.pdf', text: 'RESOLVED THAT consent of the Board be and is hereby accorded to appoint M/s. Test & Co, Chartered Accountants, having FRN 123456N as the statutory auditors of the Company.' }]);
  const names = byKey(r).firmName;
  assert.deepEqual(names.map(p => p.value), ['Test & Co']);
  assert.ok(!names[0].conflict && names[0].confidence >= 0.8);
  assert.equal(X.normalizeValue('firmName', 'M/s. Test & Co').value, 'Test & Co');
  assert.equal(X.normalizeValue('firmName', 'Messrs Test & Co').value, 'Test & Co');
});

test('firm name: an addressee line stops where the address starts', () => {
  const r = X.extractAdt1([{ name: 'l.pdf', text: 'To, M/s Test & Co Flat 4, Some Road, Gotham - 560001 Dear Sir, We are happy to inform you that you have been appointed as auditors.' }]);
  assert.deepEqual(byKey(r).firmName.map(p => p.value), ['Test & Co']);
});

test("casual vacancy: the outgoing auditor's FRN and membership go to the vacated fields, never to the appointed firm", () => {
  const text = 'RESOLVED THAT M/s New & Co (FRN 654321N), Membership No. 333333 be and are hereby appointed as statutory auditors to fill the casual vacancy caused by the resignation of M/s Old & Co (FRN 111111N), Membership No. 222222, who resigned with effect from 1st June 2025. RESOLVED FURTHER THAT the Board places on record its appreciation.';
  const r = X.extractAdt1([{ name: 'cv.pdf', text }]);
  assert.deepEqual(byKey(r).firmName.map(p => p.value), ['New & Co']);
  assert.deepEqual(byKey(r).firmRegistrationNumber.map(p => p.value), ['654321N']);
  assert.deepEqual(byKey(r).vacatedFirmRegNumber.map(p => p.value), ['111111N']);
  assert.deepEqual(byKey(r).membershipNumber.map(p => p.value), ['333333']);
  assert.deepEqual(byKey(r).vacatingAuditorMembership.map(p => p.value), ['222222']);
  assert.ok(byKey(r).firmName.every(p => !p.conflict) && byKey(r).firmRegistrationNumber.every(p => !p.conflict));
  // the outgoing firm mentioned FIRST: the appointed firm is still the one proposed
  const r2 = X.extractAdt1([{ name: 'cv2.pdf', text: 'Consequent to the resignation of M/s Old & Co (FRN 111111N) a casual vacancy arose. RESOLVED THAT M/s New & Co (FRN 654321N) be appointed to fill the casual vacancy.' }]);
  assert.deepEqual(byKey(r2).firmName.map(p => p.value), ['New & Co']);
  assert.deepEqual(byKey(r2).firmRegistrationNumber.map(p => p.value), ['654321N']);
  assert.deepEqual(byKey(r2).vacatedFirmRegNumber.map(p => p.value), ['111111N']);
  // resignation and appointment in ONE sentence, resignation first: the span ends where the appointment starts
  const r3 = X.extractAdt1([{ name: 'cv3.pdf', text: 'RESOLVED THAT pursuant to the resignation of M/s Old & Co, Chartered Accountants (FRN 111111N), the casual vacancy be filled by appointing M/s New & Co, Chartered Accountants, having FRN 654321N as auditors of the Company.' }]);
  assert.deepEqual(byKey(r3).firmName.map(p => p.value), ['New & Co']);
  assert.deepEqual(byKey(r3).firmRegistrationNumber.map(p => p.value), ['654321N']);
  assert.deepEqual(byKey(r3).vacatedFirmRegNumber.map(p => p.value), ['111111N']);
});

test('names: the stop-word filter applies only to names guessed from running text', () => {
  assert.equal(X.normalizeValue('auditorName', 'Anil Date').ok, true, 'a labelled row / saved file / AI answer');
  assert.equal(X.normalizeValue('auditorName', 'Anil Date', { heuristic: true }).ok, false, 'a walk-back guess');
  assert.equal(X.normalizeValue('auditorName', 'Test & Co').ok, false, 'a firm is never a person');
  const labelled = X.extractAdt1([{ name: 'c.pdf', text: 'CONSENT eligible. Details of the Auditor are as follows: 1 Name of the Auditor Anil Date 2 Designation ACA 3 Membership No. 123456' }]);
  assert.equal(val(labelled, 'auditorName'), 'Anil Date');
  const json = X.extractAdt1([{ name: 'c.json', json: { formType: 'adt1', formData: { auditorName: 'Anil Date', firmPan: 'BAD' } } }]);
  assert.equal(val(json, 'auditorName'), 'Anil Date');
  assert.equal(json.proposals.some(p => p.key === 'firmPan'), false);
  assert.ok(json.notes.some(n => n.file === 'c.json' && /"BAD"/.test(n.text) && /skipped/.test(n.text)), 'a dropped saved value is reported');
  const ai = X.normalizeAiOutput({ fields: [{ key: 'auditorName', value: 'Anil Date', quote: 'Name of the Auditor Anil Date', file: 'c.pdf' }] }, [{ name: 'c.pdf', text: 'Name of the Auditor Anil Date' }]);
  assert.equal(ai.proposals[0].value, 'Anil Date');
  // the heuristic paths still reject document words
  const r = X.extractAdt1([{ name: 'b.pdf', text: 'The Board of Directors hereby appoint Board of Directors, Chartered Accountants, as auditors. I, Yours Faithfully, hereby consent.' }]);
  assert.equal(byKey(r).auditorName, undefined);
});

test('AI answers to Yes/No and count questions: a bare or unrelated quote is unverified, a real one is never ticked by default', () => {
  const docs = [{ name: 'b.pdf', text: 'The company has appointed M/s Jain Maneesh & Co as its sole statutory auditor for a term of five years from the conclusion of this annual general meeting.' }];
  const n = X.normalizeAiOutput({ fields: [
    { key: 'previouslyAudited', value: 'Yes', quote: 'x', file: 'b.pdf' },
    { key: 'jointAuditors', value: 'Yes', quote: 'Jain Maneesh & Co', file: 'b.pdf' },
    { key: 'appointedInAgm', value: 'Yes', quote: 'conclusion of this annual general meeting', file: 'b.pdf' },
    { key: 'numFinancialYears', value: '5', quote: 'for a term of five years', file: 'b.pdf' },
    { key: 'numAuditorsAppointed', value: '3', quote: 'for a term of five years', file: 'b.pdf' },
    { key: 'membershipNumber', value: '123456', quote: 'x', file: 'b.pdf' }
  ], notes: [] }, docs);
  const get = k => n.proposals.find(p => p.key === k);
  assert.ok(get('previouslyAudited').unverified && get('previouslyAudited').confidence < 0.5, 'one-character quote');
  assert.ok(get('jointAuditors').unverified && get('jointAuditors').confidence < 0.5, 'a real quote that does not show the answer');
  assert.ok(!get('appointedInAgm').unverified && get('appointedInAgm').confidence >= 0.7 && get('appointedInAgm').confidence < 0.8, 'supported, but AI-only: below the auto-tick line');
  assert.ok(!get('numFinancialYears').unverified && get('numFinancialYears').confidence < 0.8);
  assert.ok(get('numAuditorsAppointed').unverified, 'the quoted number is not the answer');
  assert.ok(get('membershipNumber').unverified);
  // the rules say "No" (sole auditor); the unverified AI "Yes" stays a separate low row and does not drag the rules value down
  const merged = X.mergeProposals(X.extractAdt1(docs).proposals.concat(n.proposals)).filter(p => p.key === 'jointAuditors');
  assert.deepEqual(merged.map(p => p.value).sort(), ['No', 'Yes']);
});

test('company check: documents of another company are "odd" and named in the warning', () => {
  const a = 'U11111KA2020PTC111111', b = 'U22222MH2019PTC222222';
  const same = X.companyCheck([{ file: 'x.pdf', cin: a }, { file: 'y.pdf', cin: a }, { file: 'z.pdf', cin: '' }], '');
  assert.deepEqual([same.ok, same.odd, same.reference], [true, [], a]);
  const mixed = X.companyCheck([{ file: 'x.pdf', cin: a }, { file: 'y.pdf', cin: a }, { file: 'filed.pdf', cin: b }], '');
  assert.deepEqual([mixed.ok, mixed.odd, mixed.reference], [false, ['filed.pdf'], a]);
  assert.match(mixed.text, /filed\.pdf \(CIN U22222MH2019PTC222222\)/);
  assert.match(mixed.text, /different companies/);
  const vsForm = X.companyCheck([{ file: 'filed.pdf', cin: b }], a.toLowerCase());
  assert.deepEqual([vsForm.ok, vsForm.odd, vsForm.reference], [false, ['filed.pdf'], a]);
  assert.match(vsForm.text, /The form is for CIN U11111KA2020PTC111111/);
  assert.equal(X.companyCheck([{ file: 'x.pdf', cin: a }], b).odd.length, 1, 'the form CIN wins over the only document');
  assert.equal(X.companyCheck([], '').ok, true);
  // end to end: extractAdt1 reports the CIN per document and runs the check against the form CIN
  const r = X.extractAdt1([{ name: 'board.pdf', text: BOARD }, { name: 'other.pdf', text: BOARD.replace(CIN, b) }], { formCin: CIN });
  assert.equal(r.docTypes.find(d => d.file === 'board.pdf').cin, CIN);
  assert.deepEqual(r.company.odd, ['other.pdf']);
  assert.equal(X.extractAdt1([{ name: 'board.pdf', text: BOARD }]).company.ok, true);
});
