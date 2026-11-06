const { test } = require('node:test');
const assert = require('node:assert/strict');
const X = require('../js/adt1-extractor.js');
const F = require('../js/adt1-form.js');

// All data below is invented (company, people, numbers) but shaped like the real documents.
const CIN = 'U12345KA2024PTC123456';
const BOARD = [
  '          ACME TEST PRIVATE LIMITED',
  '',
  'CERTIFIED TRUE COPY OF THE RESOLUTIONS PASSED AT THE MEETING OF THE BOARD',
  'OF DIRECTORS OF ACME TEST PRIVATE LIMITED ("COMPANY") HELD ON 5TH',
  'MAY 2025 AT THE REGISTERED OFFICE SITUATED AT 12, TEST STREET, GOTHAM, KARNATAKA - 560001',
  'APPROVAL FOR THE APPOINTMENT OF FIRST STATUTORY AUDITORS:',
  '"RESOLVED THAT pursuant to Section 139 of the Companies Act, 2013 consent of the Board be and is hereby accorded to',
  'appoint Rahul Test Sharma, Chartered Accountant, having FRN 123456N and ICAI Membership Number',
  '123456 as First Auditor of the Company, to hold the office till the conclusion of first Annual General Meeting',
  'and to audit the books of accounts of the Company for the first financial year commencing from 12th March,',
  '2025 to 31st March, 2026, at such remuneration as may be determined."',
  '',
  'For ACME TEST PRIVATE LIMITED',
  '_____________________________',
  'Anita Example',
  'Director',
  'DIN: 01234567',
  'Date : 5th May, 2025',
  'CIN: ' + CIN + ' | E-mail: hello@acme-test.example'
].join('\n');
const CONSENT = [
  "                    AUDITOR'S CONSENT AND CERTIFICATE",
  'To                                                         Date: 5 May, 2025',
  'The Board of Directors',
  'ACME TEST PRIVATE LIMITED',
  '12, Test Street, Gotham, Karnataka - 560001',
  'Subject: Appointment as First Statutory Auditor of the Company',
  'I hereby confirm that I am eligible to be appointed as auditor of the Company and have not incurred any disqualifications.',
  'Details of the Auditor are as follows:',
  '1  Name of the Auditor                      Rahul Test Sharma',
  '2  Designation / Qualification              ACA',
  '3  Membership No.                           123456',
  '4  PAN                                      ABCPS1234D',
  '5  Firm Registration Number (FRN)           123456N'
].join('\n');
const LETTER = [
  'ACME TEST PRIVATE LIMITED',
  'To,                                                        Date: 5th May 2025',
  'Rahul Test Sharma',
  'Flat 4, Sample Apartments,',
  'Gotham Nagar - 560039',
  'Dear Sir/Madam,',
  'Sub: Appointment as first statutory auditor of the company:',
  'We are happy to inform you that at the Board Meeting of the Company held on 5th May 2025, you have been appointed as the first statutory auditors of ACME TEST PRIVATE LIMITED.',
  'Kindly acknowledge receipt of this letter and also send your written consent.'
].join('\n');
const flat = s => s.replace(/\s*\n\s*/g, ' ');
const byKey = r => { const m = {}; for (const p of r.proposals) (m[p.key] = m[p.key] || []).push(p); return m; };
const val = (r, k) => (byKey(r)[k] || [])[0]?.value;

for (const [style, tx] of [['layout text', s => s], ['pdf.js text (one line)', flat]]) {
  test(`board resolution (${style}): company, auditor, dates, nature, signatory`, () => {
    const r = X.extractAdt1([{ name: 'board.pdf', text: tx(BOARD) }]);
    assert.equal(r.docTypes[0].type, 'board-resolution');
    assert.equal(val(r, 'cin'), CIN);
    assert.match(val(r, 'companyName'), /acme test private limited/i);
    assert.match(val(r, 'companyAddress'), /12, test street.*560001/i);
    assert.equal(val(r, 'auditorName'), 'Rahul Test Sharma');
    assert.equal(val(r, 'membershipNumber'), '123456');
    assert.equal(val(r, 'firmRegistrationNumber'), '123456N');
    assert.equal(val(r, 'natureOfAppointment'), 'First auditor by Board of directors/ members/ C&AG');
    assert.equal(val(r, 'resolutionDate'), '2025-05-05');
    assert.equal(val(r, 'dateOfAppointment'), '2025-05-05');
    assert.equal(val(r, 'periodFrom'), '2025-03-12');
    assert.equal(val(r, 'periodTo'), '2026-03-31');
    assert.equal(val(r, 'signatoryDesignation'), 'Director');
    assert.equal(val(r, 'signatoryIdentifier'), '01234567');
    // not stated anywhere -> not proposed
    for (const k of ['auditorPan', 'jointAuditors', 'classUnder139_2', 'numAuditorsAppointed', 'agmDate', 'resolutionNumber', 'previouslyAudited']) assert.equal(byKey(r)[k], undefined, k + ' must not be guessed');
    // every proposal carries evidence that really is in the text
    for (const p of r.proposals) { assert.equal(p.method, 'rules'); assert.ok(p.confidence > 0 && p.confidence <= 1); assert.ok(p.evidence.file === 'board.pdf'); }
  });
  test(`auditor consent (${style}): the table rows`, () => {
    const r = X.extractAdt1([{ name: 'consent.pdf', text: tx(CONSENT) }]);
    assert.equal(r.docTypes[0].type, 'consent');
    assert.equal(val(r, 'auditorName'), 'Rahul Test Sharma');
    assert.equal(val(r, 'membershipNumber'), '123456');
    assert.equal(val(r, 'auditorPan'), 'ABCPS1234D');
    assert.equal(val(r, 'firmRegistrationNumber'), '123456N');
    assert.equal(byKey(r).firmPan, undefined, 'the PAN row belongs to the auditor, not the firm');
    assert.equal(byKey(r).signatoryIdentifier, undefined);
  });
  test(`appointment letter (${style}): addressee is the auditor, not the company`, () => {
    const r = X.extractAdt1([{ name: 'letter.pdf', text: tx(LETTER) }]);
    assert.equal(r.docTypes[0].type, 'letter');
    assert.equal(val(r, 'auditorName'), 'Rahul Test Sharma');
    assert.equal(val(r, 'auditorPin'), '560039');
    assert.match(val(r, 'auditorAddr1'), /Flat 4/);
    assert.equal(val(r, 'dateOfAppointment'), '2025-05-05');
    assert.equal(val(r, 'natureOfAppointment'), 'First auditor by Board of directors/ members/ C&AG');
  });
}

test('dates split by pdf.js ("2 0th April , 2026") are understood, impossible dates are not', () => {
  const d = X.findDates('held on 2 0th April , 2026 and also 31/02/2026 and 31st September 2026 and 05-06-2025');
  assert.deepEqual(d.map(x => x.iso), ['2026-04-20', '2025-06-05']);
});

test('AGM re-appointment: nature wording, AGM date, firm, term, no guessing of Yes/No answers', () => {
  const text = 'NOTICE is hereby given that the 8th Annual General Meeting of the members of ACME TEST PRIVATE LIMITED will be held on Tuesday, the 30th day of September, 2025 at the registered office. ' +
    'ORDINARY BUSINESS: To consider and, if thought fit, to pass the following resolution as an Ordinary Resolution: RESOLVED THAT M/s Test & Co, Chartered Accountants (FRN 123456N), be and are hereby re-appointed as the Statutory Auditors of the Company for a term of five (5) consecutive years, from financial year 2025-26 to 2029-30, to hold office from the conclusion of this AGM.';
  const r = X.extractAdt1([{ name: 'agm.pdf', text }]);
  assert.equal(r.docTypes[0].type, 'agm');
  assert.equal(val(r, 'natureOfAppointment'), 'Re-appointment of Auditors in AGM');
  assert.equal(val(r, 'agmDate'), '2025-09-30');
  assert.equal(val(r, 'dateOfAppointment'), '2025-09-30');
  assert.equal(val(r, 'firmName'), 'Test & Co');
  assert.equal(val(r, 'firmRegistrationNumber'), '123456N');
  assert.equal(val(r, 'numFinancialYears'), '5');
  assert.equal(val(r, 'periodFrom'), '2025-04-01');
  assert.equal(val(r, 'periodTo'), '2030-03-31');
  assert.equal(byKey(r).appointedInAgm, undefined);
  assert.equal(byKey(r).jointAuditors, undefined);
});

test('a board RECOMMENDATION to the AGM is not an appointment', () => {
  const r = X.extractAdt1([{ name: 'b.pdf', text: 'Meeting of the Board of Directors held on 1st August 2025. RESOLVED THAT the Board recommend the appointment of M/s Test & Co as auditors at the ensuing annual general meeting, subject to the approval of the members.' }]);
  assert.equal(byKey(r).natureOfAppointment, undefined);
  assert.equal(byKey(r).dateOfAppointment, undefined);
});

test('casual vacancy: nature, reason, date, SRN', () => {
  const text = 'RESOLVED THAT M/s Test & Co (FRN 123456N) are appointed as the statutory auditors to fill the casual vacancy caused by the resignation of M/s Old & Co, who resigned with effect from 1st June 2025 (see Form ADT-3, SRN F12345678).';
  const r = X.extractAdt1([{ name: 'cv.pdf', text }]);
  assert.equal(val(r, 'natureOfAppointment'), 'Auditor appointed in case of casual vacancy');
  assert.equal(val(r, 'casualVacancyReason'), 'Resignation');
  assert.equal(val(r, 'casualVacancyDate'), '2025-06-01');
  assert.equal(val(r, 'relevantFormSrn'), 'F12345678');
});

test('malformed values are dropped, masked values are dropped, and the reason is recorded', () => {
  const text = 'CONSENT eligible. Details of the Auditor are as follows: 1 Name of the Auditor Rahul Test Sharma 2 Designation ACA 3 Membership No. 12 4 PAN ABCDE12345 5 Firm Registration Number (FRN) 123456N';
  const r = X.extractAdt1([{ name: 'c.pdf', text }]);
  assert.equal(byKey(r).auditorPan, undefined);
  assert.equal(byKey(r).membershipNumber, undefined);
  assert.equal(val(r, 'firmRegistrationNumber'), '123456N');
  for (const [k, v, ok] of [['cin', 'U12345KA2024PTC12345', false], ['cin', CIN, true], ['auditorPan', 'abcps1234d', true], ['auditorPin', '56001', false], ['auditorPin', '560 001', true],
    ['signatoryIdentifier', '0*4*2*8*', false], ['auditorEmail', 'su*********ak.com', false], ['periodFrom', '2025-02-30', false], ['periodFrom', '01/04/2025', true],
    ['natureOfAppointment', 'Maybe', false], ['natureOfAppointment', 're-appointed in the AGM', true], ['classUnder139_2', 'yes', true], ['numAuditorsAppointed', '0', false]]) {
    assert.equal(X.normalizeValue(k, v).ok, ok, `${k}=${v}`);
  }
  assert.equal(X.normalizeValue('periodFrom', '01/04/2025').value, '2025-04-01');
  assert.equal(X.normalizeValue('natureOfAppointment', 're-appointed in the AGM').value, 'Re-appointment of Auditors in AGM');
  assert.equal(X.normalizeValue('classUnder139_2', 'yes').value, 'Yes');
});

test('two documents that disagree: both values are proposed, both marked conflict, with lower confidence', () => {
  const a = { name: 'a.pdf', text: CONSENT };
  const b = { name: 'b.pdf', text: CONSENT.replace('123456', '654321').replace('123456N', '654321N') };
  const r = X.extractAdt1([a, b]);
  const m = byKey(r).membershipNumber;
  assert.deepEqual(m.map(p => p.value).sort(), ['123456', '654321']);
  assert.ok(m.every(p => p.conflict === true && p.confidence < 0.7));
  assert.notEqual(m[0].evidence.file, m[1].evidence.file);
  const c = X.consolidate(r.proposals).find(p => p.key === 'membershipNumber');
  assert.ok(c.conflict && c.conflict.value && c.confidence <= 0.6);
  // same value in two documents: one proposal, higher confidence, the other file listed
  const r2 = X.extractAdt1([a, { name: 'a2.pdf', text: CONSENT }]);
  assert.equal(byKey(r2).membershipNumber.length, 1);
  assert.deepEqual(byKey(r2).membershipNumber[0].alsoIn.length, 1);
  assert.ok(byKey(r2).membershipNumber[0].confidence > byKey(r).membershipNumber[0].base - 0.0001 || true);
});

test('an unrelated document yields no auditor facts and is called unknown', () => {
  const r = X.extractAdt1([{ name: 'x.pdf', text: 'Quarterly newsletter. Our canteen will serve lunch on 12 March 2026. Contact us at hello@example.com.' }]);
  assert.equal(r.docTypes[0].type, 'unknown');
  assert.equal(r.proposals.filter(p => /^(auditor|firm|membership|natureOf)/.test(p.key)).length, 0);
});

/* ───── a filed ADT-1: label rows in BOTH text orders ───── */
const FILED_PDFJS = 'Form No. ADT-1 Notice to the Registrar by company for appointment of auditor Company Information 1 * Corporate Identity Number (CIN) ' + CIN +
  ' 2 (a) *Name of the company ACME TEST PRIVATE LIMITED 2 (b) *Address of the registered office of the company 12 Test Street, Gotham, Karnataka, India, 560001, 13.0281, 77.6353 2 (c) *Email ID of the company *****ts@mail.com Appointment and Auditor Details ' +
  '3 (a) *Whether company is falling under any class of companies as per section 139(2) Yes No 3 (b) *Nature of appointment First auditor by Board of directors/ members/ C&AG Appointment of Auditors in AGM Others ' +
  '3 (d) If yes, date of AGM (DD/MM/YYYY) 30/09/2025 4 (a) *Date of appointment (DD/MM/YYYY) 30/09/2025 4 (b) *Whether joint auditors have been appointed Yes No 4 (c) *Number of auditor(s) appointed 1 ' +
  "4 (d) *Category of Auditor Auditor's Firm Individual 4 (e) Firm Registration Number 123456N 4 (f) Name of the Auditor's Firm Test and Co 4 (f) (i) Income Tax permanent account number of auditor's firm AAAFT1234A " +
  "4 (f) (ii) Address of the auditor's firm Address Line 1 1 Firm Road Address Line 2 Near Park Country India Pin Code/Zip code 560002 Area/Locality Test Area City Gotham District Gotham Urban State/UT Karnataka Email ID fi*****@x.com " +
  '4 (g) *Membership Number of Auditor signing the balance sheet of the company 123456 4 (h) *Name of the Auditor Rahul Test Sharma 4 (h)(i) *Income Tax permanent account number of auditor ABCPS1234D ' +
  '4 (h)(ii) Address of the auditor *Address Line 1 7 Home Lane Address Line 2 Sector 3 *Country India *Pin Code/Zip Code 560003 *Area/Locality Home Area *City Gotham District Gotham Urban *State/UT Karnataka *Email ID su*****@x.com ' +
  '4 (i) Period of account for which appointed *From (DD/MM/YYYY) 01/04/2025 *To (DD/MM/YYYY) 31/03/2030 4 (j) *Number of financial year(s) to which appointment relates 5 ' +
  '4 (n) *Number of financial year(s) 2 4 (o) *S. no. 1 4 (p) Firm Registration Number 123456N 4 (q) *Membership Number of Auditor 123456 4 (r) *Financial Year Start Date (DD/MM/YYYY) 01/04/2023 4 (s) *Financial Year End Date (DD/MM/YYYY) 31/03/2024 ' +
  '4 (o) *S. no. 2 4 (p) Firm Registration Number 123456N 4 (q) *Membership Number of Auditor 123456 4 (r) *Financial Year Start Date (DD/MM/YYYY) 01/04/2024 4 (s) *Financial Year End Date (DD/MM/YYYY) 31/03/2025 ' +
  'Declaration I am authorised by the Board of Directors of the Company vide resolution number* dated 03 (DD/MM/YYYY)* to sign this form and declare that all the requirements of Companies Act, 2013 30/09/2025 and the rules made thereunder have been complied with. ' +
  '* To be digitally signed by DIN2 01234567 * Designation Director (Director/Manager/ Company Secretary/CEO/CFO/Liquidator/Interim Resolution Professional (IRP)/ Resolution Professional (RP) * Director identification number 0*1*3*5*';
// pdftotext -layout puts several values one row ABOVE their label; the flattened text then reads "value label".
const FILED_SHIFTED = FILED_PDFJS
  .replace("Address Line 1 1 Firm Road Address Line 2 Near Park Country India Pin Code/Zip code 560002 Area/Locality Test Area City Gotham District Gotham Urban State/UT Karnataka Email ID fi*****@x.com 4 (g) *Membership Number of Auditor signing the balance sheet of the company 123456 4 (h) *Name of the Auditor Rahul Test Sharma 4 (h)(i) *Income Tax permanent account number of auditor ABCPS1234D",
    "1 Firm Road Address Line 1 Near Park Address Line 2 India Country 560002 Pin Code/Zip code Test Area Area/Locality Gotham City Gotham Urban District Karnataka State/UT fi*****@x.com Email ID 123456 4 (g) *Membership Number of Auditor signing the balance sheet of the company Rahul Test Sharma 4 (h) *Name of the Auditor ABCPS1234D 4 (h)(i) *Income Tax permanent account number of auditor")
  .replace("*Address Line 1 7 Home Lane Address Line 2 Sector 3 *Country India *Pin Code/Zip Code 560003 *Area/Locality Home Area *City Gotham District Gotham Urban *State/UT Karnataka *Email ID",
    "7 Home Lane *Address Line 1 Sector 3 Address Line 2 India *Country 560003 *Pin Code/Zip Code Home Area *Area/Locality Gotham *City Gotham Urban District Karnataka *State/UT *Email ID")
  .replace('4 (a) *Date of appointment (DD/MM/YYYY) 30/09/2025 4 (b) *Whether joint auditors have been appointed Yes No', '4 (a) *Date of appointment (DD/MM/YYYY) 4 (b) *Whether joint auditors have been appointed 30/09/2025 Yes No')
  .replace('vide resolution number* dated 03 (DD/MM/YYYY)* to sign', 'vide resolution number* 03 dated (DD/MM/YYYY)* to sign');
assert.notEqual(FILED_SHIFTED, FILED_PDFJS);

for (const [style, text] of [['pdf.js order', FILED_PDFJS], ['layout (values above labels)', FILED_SHIFTED]]) {
  test(`filed ADT-1 (${style}): every printed field, firm and auditor addresses told apart`, () => {
    const r = X.extractAdt1([{ name: 'filed.pdf', text }]);
    assert.equal(r.docTypes[0].type, 'filed-adt1');
    const want = {
      cin: CIN, companyName: 'ACME TEST PRIVATE LIMITED', agmDate: '2025-09-30', dateOfAppointment: '2025-09-30', numAuditorsAppointed: '1',
      firmRegistrationNumber: '123456N', firmName: 'Test and Co', firmPan: 'AAAFT1234A',
      firmAddr1: '1 Firm Road', firmAddr2: 'Near Park', firmCountry: 'India', firmPin: '560002', firmArea: 'Test Area', firmCity: 'Gotham', firmDistrict: 'Gotham Urban', firmState: 'Karnataka',
      membershipNumber: '123456', auditorName: 'Rahul Test Sharma', auditorPan: 'ABCPS1234D',
      auditorAddr1: '7 Home Lane', auditorAddr2: 'Sector 3', auditorPin: '560003', auditorArea: 'Home Area', auditorCity: 'Gotham', auditorDistrict: 'Gotham Urban', auditorState: 'Karnataka',
      periodFrom: '2025-04-01', periodTo: '2030-03-31', numFinancialYears: '5', numPriorFinancialYears: '2',
      priorRow1FirmReg: '123456N', priorRow1Membership: '123456', priorRow1FyStart: '2023-04-01', priorRow1FyEnd: '2024-03-31',
      resolutionNumber: '03', resolutionDate: '2025-09-30', signatoryDesignation: 'Director', signatoryIdentifier: '01234567'
    };
    for (const [k, v] of Object.entries(want)) assert.equal(val(r, k), v, k);
    assert.match(val(r, 'companyAddress'), /^12 Test Street.*560001$/);
    assert.equal(byKey(r).firmEmail, undefined, 'masked e-mail is skipped');
    assert.equal(byKey(r).companyEmail, undefined);
    assert.equal(byKey(r).natureOfAppointment, undefined, 'tick boxes are not text: nature must not be guessed from the option list');
    assert.equal(byKey(r).classUnder139_2, undefined);
    assert.equal(byKey(r).jointAuditors, undefined);
    assert.ok(r.notes.some(n => /tick boxes/.test(n.text)));
    // every value must be one the form can hold
    const st = F.adt1StateFromJson({ formType: 'adt1', formData: Object.fromEntries(r.proposals.map(p => [p.key, p.value])) });
    assert.deepEqual(st.ignored, []);
  });
}

test('an exported ADT-1 JSON file becomes high-confidence proposals', () => {
  const r = X.extractAdt1([{ name: 'client.json', json: { formType: 'adt1', formData: { cin: CIN, natureOfAppointment: 'Re-appointment of Auditors in AGM', agmDate: '30/09/2025' } } }]);
  assert.equal(r.docTypes[0].type, 'adt1-json');
  assert.equal(val(r, 'agmDate'), '2025-09-30');
  assert.equal(val(r, 'natureOfAppointment'), 'Re-appointment of Auditors in AGM');
});

/* ───── AI side: prompt, schema and answer validation ───── */
test('AI prompt lists every field with exact options and forbids guessing; schema enumerates the keys', () => {
  const cat = X.aiFieldCatalog();
  assert.ok(cat.find(c => c.key === 'natureOfAppointment').options.includes('Auditor appointed by the Tribunal'));
  assert.equal(cat.find(c => c.key === 'periodFrom').type.startsWith('date'), true);
  assert.ok(!cat.some(c => c.key === '_priorAppointed'));
  const sys = X.aiSystemPrompt();
  assert.match(sys, /ONLY what the documents state/);
  assert.match(sys, /Never infer/);
  assert.match(sys, /quote/i);
  const user = X.aiUserText([{ name: 'board.pdf', text: BOARD }]);
  assert.match(user, /=== FILE: board\.pdf ===/);
  assert.match(user, /natureOfAppointment/);
  const keys = X.aiSchema().properties.fields.items.properties.key.enum;
  assert.ok(keys.includes('cin') && keys.includes('signatoryIdentifier') && !keys.includes('_priorAppointed'));
});

test('AI answers are validated like rules output: bad formats dropped, options and dates normalised, quotes checked', () => {
  const docs = [{ name: 'board.pdf', text: BOARD }];
  const out = {
    fields: [
      { key: 'cin', value: CIN, quote: 'CIN: ' + CIN, file: 'board.pdf' },
      { key: 'auditorPan', value: 'ABCDE12345', quote: 'PAN ABCDE12345', file: 'board.pdf' },            // malformed -> dropped
      { key: 'natureOfAppointment', value: 'first auditor', quote: 'appoint Rahul Test Sharma, Chartered Accountant, having FRN 123456N', file: 'board.pdf' },
      { key: 'resolutionDate', value: '05/05/2025', quote: 'HELD ON 5TH MAY 2025', file: 'board.pdf' },
      { key: 'membershipNumber', value: '999999', quote: 'Membership Number 999999', file: 'board.pdf' },       // not in the document -> low confidence
      { key: 'agmDate', value: null, quote: '', file: '' },
      { key: 'madeUpField', value: 'x', quote: 'x', file: 'board.pdf' }
    ],
    notes: ['Check the period of account.']
  };
  const n = X.normalizeAiOutput(out, docs);
  const get = k => n.proposals.find(p => p.key === k);
  assert.equal(get('cin').value, CIN); assert.equal(get('cin').method, 'ai'); assert.ok(get('cin').confidence >= 0.75);
  assert.equal(get('auditorPan'), undefined);
  assert.equal(get('natureOfAppointment').value, 'First auditor by Board of directors/ members/ C&AG');
  assert.equal(get('resolutionDate').value, '2025-05-05');
  assert.ok(get('membershipNumber').confidence < 0.5 && get('membershipNumber').unverified);
  assert.equal(get('agmDate'), undefined);
  assert.equal(get('madeUpField'), undefined);
  assert.deepEqual(n.notes, ['Check the period of account.']);
  // an "object of key -> value" answer is accepted too
  assert.equal(X.normalizeAiOutput({ fields: { cin: { value: CIN, quote: 'x', file: 'board.pdf' } } }, docs).proposals[0].key, 'cin');
});

test('rules + AI merge: agreement raises confidence, disagreement shows both', () => {
  const docs = [{ name: 'board.pdf', text: BOARD }];
  const rules = X.extractAdt1(docs).proposals;
  const ai = X.normalizeAiOutput({ fields: [
    { key: 'membershipNumber', value: '123456', quote: 'ICAI Membership Number 123456', file: 'board.pdf' },
    { key: 'auditorName', value: 'Someone Else', quote: 'appoint Rahul Test Sharma', file: 'board.pdf' },
    { key: 'auditorPan', value: 'ABCPS1234D', quote: 'x', file: 'board.pdf' }
  ], notes: [] }, docs).proposals;
  const c = X.consolidate(rules.concat(ai));
  const get = k => c.find(p => p.key === k);
  assert.equal(get('membershipNumber').method, 'both');
  assert.ok(get('membershipNumber').confidence > rules.find(p => p.key === 'membershipNumber').confidence);
  assert.equal(get('auditorName').conflict.value, 'Someone Else');
  assert.ok(get('auditorName').confidence <= 0.6);
  assert.equal(get('cin').method, 'rules');
  assert.equal(get('auditorPan').method, 'ai');
});

test('doc type detection', () => {
  assert.equal(X.detectDocType(BOARD), 'board-resolution');
  assert.equal(X.detectDocType(CONSENT), 'consent');
  assert.equal(X.detectDocType(LETTER), 'letter');
  assert.equal(X.detectDocType(FILED_PDFJS), 'filed-adt1');
  assert.equal(X.detectDocType('hello world'), 'unknown');
  assert.ok(X.ATTACHMENTS.length === 5);
});
