const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/adt1-form.js');

// A complete, valid "re-appointment of a firm" scenario (mirrors the extension's bundled sample).
function sample(over) {
  return Object.assign(F.adt1BlankState(), {
    cin: 'U80904KA2018PTC119370',
    natureOfAppointment: 'Re-appointment of Auditors in AGM',
    agmDate: '2026-09-30', dateOfAppointment: '2026-09-30',
    classUnder139_2: 'No', jointAuditors: 'No', numAuditorsAppointed: '1', auditorCategory: "Auditor's Firm",
    within20CompaniesLimit: 'Yes', auditCommitteeRecommendation: 'Not Applicable',
    firmRegistrationNumber: '018971s', firmName: 'Jain S A K and Co', firmPan: 'AAOFJ5797P', firmPin: '560001',
    firmAddr1: 'S3, 2nd Floor White House', firmEmail: 'firm@example.com',
    membershipNumber: '235818', auditorName: 'Sumit Jain', auditorPan: 'ABCDE1234F',
    auditorAddr1: '12 MG Road', auditorPin: '560001', auditorEmail: 'sumit@example.com',
    numPriorFinancialYears: '3', priorRow1Membership: '235818', priorRow1FyStart: '2022-04-01', priorRow1FyEnd: '2023-03-31',
    periodFrom: '2025-04-01', periodTo: '2026-03-31', numFinancialYears: '1',
    resolutionNumber: '04', resolutionDate: '2026-09-30', signatoryDesignation: 'Director', signatoryIdentifier: '08302207'
  }, over);
}
const paths = list => list.map(m => m.path);

test('adt1: dates convert ISO <-> DD/MM/YYYY and reject impossible dates', () => {
  assert.equal(F.adt1ToDMY('2026-09-30'), '30/09/2026');
  assert.equal(F.adt1ToDMY('30/09/2026'), '30/09/2026');
  assert.equal(F.adt1ToISO('30/09/2026'), '2026-09-30');
  assert.equal(F.adt1ToDMY('2026-02-30'), '');
  assert.equal(F.adt1ToDMY('garbage'), '');
  assert.equal(F.adt1ToDMY(''), '');
});

test('adt1: buildAdt1FormData converts every date field to DD/MM/YYYY and uppercases ids', () => {
  const d = F.buildAdt1FormData(sample());
  assert.equal(d.agmDate, '30/09/2026');
  assert.equal(d.dateOfAppointment, '30/09/2026');
  assert.equal(d.periodFrom, '01/04/2025');
  assert.equal(d.periodTo, '31/03/2026');
  assert.equal(d.resolutionDate, '30/09/2026');
  assert.equal(d.firmRegistrationNumber, '018971S');
  assert.equal(d.natureOfAppointment, 'Re-appointment of Auditors in AGM');
  assert.equal(d.auditorCategory, "Auditor's Firm");
  assert.equal(d.jointAuditors, 'No');
});

test('adt1: empty values are omitted, not sent as ""', () => {
  const d = F.buildAdt1FormData(sample());
  assert.ok(!('companyEmail' in d));
  assert.ok(!('auditorAddr2' in d));
  assert.ok(Object.values(d).every(v => v !== ''));
  assert.ok(!('_priorAppointed' in d));
});

test('adt1: firm fields are omitted for an Individual auditor', () => {
  const d = F.buildAdt1FormData(sample({ auditorCategory: 'Individual' }));
  for (const k of ['firmRegistrationNumber', 'firmName', 'firmPan', 'firmPin']) assert.ok(!(k in d), k);
  assert.equal(d.membershipNumber, '235818');
  assert.equal(d.auditorCategory, 'Individual');
});

test('adt1: prior / tribunal / casual-vacancy / "Others" groups are omitted unless they apply', () => {
  const stale = sample({ natureOfAppointment: 'Appointment of Auditors in AGM', numPriorFinancialYears: '', priorRow1FyStart: '', priorRow1FyEnd: '', priorRow1Membership: '999', inc28Srn: 'F12345678', relevantFormSrn: 'F7654321', casualVacancyReason: 'Resignation', natureOfAppointmentOther: 'x' });
  const d = F.buildAdt1FormData(stale);
  for (const k of ['priorRow1Membership', 'inc28Srn', 'relevantFormSrn', 'casualVacancyReason', 'natureOfAppointmentOther']) assert.ok(!(k in d), k);

  const t = F.buildAdt1FormData(sample({ natureOfAppointment: 'Auditor appointed by the Tribunal', inc28Srn: 'f12345678' }));
  assert.equal(t.inc28Srn, 'F12345678');
  assert.ok(!('casualVacancyReason' in t));

  const c = F.buildAdt1FormData(sample({ natureOfAppointment: 'Auditor appointed in case of casual vacancy', casualVacancyReason: 'Resignation', casualVacancyOtherReason: 'stale', casualVacancyDate: '2026-06-01' }));
  assert.equal(c.casualVacancyReason, 'Resignation');
  assert.equal(c.casualVacancyDate, '01/06/2026');
  assert.ok(!('casualVacancyOtherReason' in c), 'other-reason only when reason = Others');

  const o = F.buildAdt1FormData(sample({ natureOfAppointment: 'Others', natureOfAppointmentOther: 'Special case' }));
  assert.equal(o.natureOfAppointmentOther, 'Special case');

  const p = F.buildAdt1FormData(sample({ _priorAppointed: true, numPriorFinancialYears: '2', priorRow1Membership: '111', priorRow1FyStart: '2023-04-01', priorRow1FyEnd: '2024-03-31' }));
  assert.equal(p.numPriorFinancialYears, '2');
  assert.equal(p.priorRow1FyStart, '01/04/2023');
});

test('adt1: a typed prior-appointment count alone opens the prior group', () => {
  const fresh = { natureOfAppointment: 'Appointment of Auditors in AGM', numPriorFinancialYears: '' };
  assert.equal(F.adt1Active(sample(Object.assign({}, fresh, { numPriorFinancialYears: '1' }))).prior, true);
  assert.equal(F.adt1Active(sample(fresh)).prior, false);
  assert.equal(F.adt1Active(sample({ numPriorFinancialYears: '' })).prior, true, 'a re-appointment always asks for the previous tenure');
});

test('adt1: a complete valid scenario has no errors', () => {
  assert.deepEqual(F.validateAdt1(sample()).errors, []);
});

test('adt1: a blank form reports the required fields of the applicable sections only', () => {
  const p = paths(F.validateAdt1(F.adt1BlankState()).errors);
  for (const k of ['cin', 'natureOfAppointment', 'classUnder139_2', 'within20CompaniesLimit', 'auditCommitteeRecommendation', 'jointAuditors', 'numAuditorsAppointed', 'auditorCategory', 'membershipNumber', 'auditorName', 'auditorPan', 'periodFrom', 'periodTo', 'numFinancialYears']) assert.ok(p.includes(k), k);
  for (const k of ['firmRegistrationNumber', 'firmPan', 'inc28Srn', 'relevantFormSrn', 'numPriorFinancialYears']) assert.ok(!p.includes(k), k + ' should not apply yet');
});

test("adt1: firm fields become required only for Auditor's Firm", () => {
  const firm = F.validateAdt1(sample({ firmRegistrationNumber: '', firmName: '', firmPan: '' })).errors;
  assert.deepEqual(paths(firm).sort(), ['firmName', 'firmPan', 'firmRegistrationNumber']);
  const ind = F.validateAdt1(sample({ auditorCategory: 'Individual', firmRegistrationNumber: '', firmName: '', firmPan: '', firmAddr1: '', firmEmail: '', firmPin: '' })).errors;
  assert.deepEqual(ind, []);
});

test('adt1: CIN, PAN and pin code patterns', () => {
  assert.ok(paths(F.validateAdt1(sample({ cin: 'U123' })).errors).includes('cin'));
  assert.ok(paths(F.validateAdt1(sample({ firmPan: 'AAOFJ5797' })).errors).includes('firmPan'));
  assert.deepEqual(F.validateAdt1(sample({ auditorPan: 'abcde1234f' })).errors, [], 'lower-case PAN is normalised, not an error');
  assert.ok(paths(F.validateAdt1(sample({ firmPin: '5600' })).errors).includes('firmPin'));
  assert.deepEqual(F.validateAdt1(sample({ auditorCategory: 'Individual', firmPin: '5600' })).errors, [], 'hidden firm fields are not validated');
  assert.ok(paths(F.validateAdt1(sample({ auditorEmail: '', auditorAddr1: '', auditorPin: '' })).errors).includes('auditorEmail'), 'MCA requires the auditor address and email');
});

test('adt1: numeric fields must be whole numbers', () => {
  assert.ok(paths(F.validateAdt1(sample({ numAuditorsAppointed: 'one' })).errors).includes('numAuditorsAppointed'));
  assert.ok(paths(F.validateAdt1(sample({ numFinancialYears: '0' })).errors).includes('numFinancialYears'));
  assert.ok(paths(F.validateAdt1(sample({ numFinancialYears: '1.5' })).errors).includes('numFinancialYears'));
});

test('adt1: period from must be before period to', () => {
  assert.ok(paths(F.validateAdt1(sample({ periodFrom: '2026-03-31', periodTo: '2025-04-01' })).errors).includes('periodTo'));
  assert.ok(paths(F.validateAdt1(sample({ periodFrom: '2026-03-31', periodTo: '2026-03-31' })).errors).includes('periodTo'));
});

test('adt1: prior-appointment rows are required once the group applies, and dates must be ordered', () => {
  const e = F.validateAdt1(sample({ natureOfAppointment: 'Appointment of Auditors in AGM', numPriorFinancialYears: '', priorRow1Membership: '', priorRow1FyStart: '', priorRow1FyEnd: '', _priorAppointed: true })).errors;
  for (const k of ['numPriorFinancialYears', 'priorRow1Membership', 'priorRow1FyStart', 'priorRow1FyEnd']) assert.ok(paths(e).includes(k), k);
  const bad = F.validateAdt1(sample({ numPriorFinancialYears: '1', priorRow1Membership: '1', priorRow1FyStart: '2024-04-01', priorRow1FyEnd: '2023-03-31' })).errors;
  assert.ok(paths(bad).includes('priorRow1FyEnd'));
});

test('adt1: tribunal and casual-vacancy requirements follow the nature of appointment', () => {
  const t = F.validateAdt1(sample({ natureOfAppointment: 'Auditor appointed by the Tribunal' })).errors;
  assert.ok(paths(t).includes('inc28Srn'));
  const c = F.validateAdt1(sample({ natureOfAppointment: 'Auditor appointed in case of casual vacancy', casualVacancyReason: 'Others (death, disqualification)' })).errors;
  for (const k of ['relevantFormSrn', 'casualVacancyDate', 'vacatingAuditorMembership', 'casualVacancyReasonText', 'casualVacancyOtherReason']) assert.ok(paths(c).includes(k), k);
  const r = F.validateAdt1(sample({ natureOfAppointment: 'Auditor appointed in case of casual vacancy', casualVacancyReason: 'Resignation' })).errors;
  assert.ok(!paths(r).includes('casualVacancyOtherReason'));
});

test('adt1: declaration — missing is a warning, DIN must be 8 digits for a Director', () => {
  const missing = F.validateAdt1(sample({ resolutionNumber: '', resolutionDate: '', signatoryDesignation: '', signatoryIdentifier: '' }));
  assert.deepEqual(missing.errors, []);
  assert.ok(paths(missing.warnings).includes('resolutionNumber'));
  assert.ok(paths(F.validateAdt1(sample({ signatoryIdentifier: '1234' })).errors).includes('signatoryIdentifier'));
  assert.deepEqual(F.validateAdt1(sample({ signatoryDesignation: 'Company Secretary', signatoryIdentifier: 'A12345' })).errors, []);
});

test('adt1: envelope, clientInfo and import round trip', () => {
  const st = sample({ companyName: 'Lessonboard Edu Solutions Private Limited' });
  const env = F.buildAdt1Envelope(st);
  assert.equal(env.formType, 'adt1');
  assert.equal(env.clientInfo.cin, 'U80904KA2018PTC119370');
  assert.equal(env.clientInfo.source, 'dashboard');
  assert.match(env.clientInfo.id, /^adt1_u80904ka2018ptc119370_2026$/);

  const back = F.adt1StateFromJson(JSON.parse(JSON.stringify(env)));      // envelope
  assert.deepEqual(F.buildAdt1FormData(back.state), env.formData);
  const flat = F.adt1StateFromJson(env.formData);                        // flat formData
  assert.deepEqual(F.buildAdt1FormData(flat.state), env.formData);
  assert.equal(back.state.periodFrom, '2025-04-01', 'imported dates are held as ISO for <input type=date>');
});

test('adt1: import skips unknown dropdown values and rejects foreign files', () => {
  const r = F.adt1StateFromJson({ cin: 'U80904KA2018PTC119370', auditorCategory: 'Partnership', jointAuditors: 'yes' });
  assert.deepEqual(r.ignored, ['auditorCategory']);
  assert.equal(r.state.jointAuditors, 'Yes');
  assert.throws(() => F.adt1StateFromJson({ formType: 'spice_part_a', SPICE_NAME_1: 'x' }), /not ADT-1/);
  assert.throws(() => F.adt1StateFromJson({ general: { CIN: 'x' } }), /no ADT-1 fields/);
  assert.throws(() => F.adt1StateFromJson([]), /not a JSON object/);
});

// The sample ships in the extension folder, which is not present in every checkout — skipped, visibly, if absent.
const SAMPLE_PATH = require('node:path').join(__dirname, '..', '..', 'extension', 'clients', 'lessonboard_fy2025_26_adt1.json');
test('adt1: the extension\'s bundled sample imports cleanly and builds the same formData', { skip: !require('node:fs').existsSync(SAMPLE_PATH) && 'sample not in this checkout' }, () => {
  const fs = require('node:fs'), p = SAMPLE_PATH;
  const sampleJson = JSON.parse(fs.readFileSync(p, 'utf8'));
  const { state, ignored } = F.adt1StateFromJson(sampleJson);
  assert.deepEqual(ignored, []);
  const d = F.buildAdt1FormData(state);
  assert.equal(d.natureOfAppointment, 'Re-appointment of Auditors in AGM');
  assert.equal(d.periodTo, '31/03/2026');
  // Every non-empty value in the sample survives the round trip unchanged.
  for (const [k, v] of Object.entries(sampleJson.formData)) if (v !== '') assert.equal(d[k], v, k);
  // The sample deliberately leaves the signing auditor's PAN (and other contact details) blank.
  assert.ok(paths(F.validateAdt1(state).errors).includes('auditorPan'));
});

test('adt1: the built-in sample is complete — no errors, every required MCA question answered, keys all known', () => {
  const st = F.adt1SampleState();
  const { errors } = F.validateAdt1(st);
  assert.deepEqual(errors, []);
  const d = F.buildAdt1FormData(st);
  for (const k of ['classUnder139_2', 'within20CompaniesLimit', 'auditCommitteeRecommendation', 'auditorPan', 'auditorEmail', 'firmEmail', 'numPriorFinancialYears', 'priorRow1FyStart']) assert.ok(d[k], k);
  for (const k of Object.keys(F.ADT1_SAMPLE_FORMDATA)) assert.ok(k in d, 'sample key dropped from the payload: ' + k);
  assert.equal(d.priorRow1FyEnd, '31/03/2025');
});
