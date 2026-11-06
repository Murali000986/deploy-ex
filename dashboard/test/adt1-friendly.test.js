// Pure helpers behind the friendlier ADT-1 data entry (js/adt1-form.js, section "1b").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/adt1-form.js');

function full(over) {
  return Object.assign(F.adt1SampleState(), over);
}
const keys = list => list.map(m => m.path);

test('friendly: messages name the field in plain words and keep the MCA reference', () => {
  const st = F.adt1BlankState();
  const m = F.validateAdt1(st).errors;
  const by = k => m.find(e => e.path === k).msg;
  assert.match(by('cin'), /Please fill in CIN \(field 1\)\./);
  assert.match(by('classUnder139_2'), /Please choose an answer for Class of company under section 139\(2\) \(3\(a\)\)\./);
  assert.match(by('periodFrom'), /Please pick a date for Period of account: from \(4\(i\)\)\./);
  const firm = F.validateAdt1(Object.assign(F.adt1BlankState(), { auditorCategory: "Auditor's Firm" })).errors;
  assert.match(firm.find(e => e.path === 'firmEmail').msg, /Firm — Email ID/);
  assert.match(m.find(e => e.path === 'auditorEmail').msg, /Auditor — Email ID/);
});

test('friendly: format errors are plain language; the CIN message states the 21-character rule', () => {
  const bad = F.validateAdt1(full({ cin: 'U1234', firmPan: 'AB1', firmPin: '56', numFinancialYears: 'x' })).errors;
  assert.match(bad.find(e => e.path === 'cin').msg, /5 of 21|21 characters/);
  assert.match(bad.find(e => e.path === 'firmPan').msg, /10 characters: 5 letters, 4 digits, 1 letter/);
  assert.match(bad.find(e => e.path === 'firmPin').msg, /exactly 6 digits/);
  assert.match(bad.find(e => e.path === 'numFinancialYears').msg, /whole number/);
  const cin = F.validateAdt1(full({ cin: 'X80904KA2018PTC119370' })).errors.find(e => e.path === 'cin');
  assert.match(cin.msg, /Character 1 should be L \(listed\) or U \(unlisted\)/);
  assert.ok(cin.msg.endsWith(F.ADT1_CIN_RULE));
});

test('friendly: the validation outcome (which fields are errors / warnings) is unchanged by the new wording', () => {
  assert.deepEqual(F.validateAdt1(F.adt1SampleState()).errors, []);
  const e = keys(F.validateAdt1(F.adt1BlankState()).errors);
  for (const k of ['cin', 'classUnder139_2', 'natureOfAppointment', 'jointAuditors', 'numAuditorsAppointed', 'auditorCategory', 'within20CompaniesLimit', 'auditCommitteeRecommendation', 'membershipNumber', 'auditorName', 'auditorPan', 'auditorAddr1', 'auditorPin', 'auditorEmail', 'periodFrom', 'periodTo', 'numFinancialYears']) assert.ok(e.includes(k), k);
});

test('friendly: field help/short extras never leak into the extension payload', () => {
  const d = F.buildAdt1FormData(F.adt1SampleState());
  const ok = new Set(F.ADT1_FIELD_LIST.filter(f => f.type !== 'check').map(f => f.key));
  for (const k of Object.keys(d)) assert.ok(ok.has(k), k);
  assert.ok(!('_priorAppointed' in d));
  // every Yes/No question carries a plain-English help line
  for (const k of ['classUnder139_2', 'appointedInAgm', 'jointAuditors', 'within20CompaniesLimit', 'previouslyAudited', 'auditCommitteeRecommendation']) {
    const f = F.ADT1_FIELD_LIST.find(x => x.key === k);
    assert.ok(f.help && f.help.length > 30, 'help for ' + k);
  }
});

test('friendly: field names strip the reference but keep who owns shared labels', () => {
  assert.equal(F.adt1FieldName('firmEmail'), 'Firm — Email ID');
  assert.equal(F.adt1FieldName('auditorPin'), 'Auditor — Pin code');
  assert.equal(F.adt1FieldName('cin'), 'CIN');
  assert.equal(F.adt1FieldName('firmRegistrationNumber'), 'Firm Registration Number');
  assert.equal(F.adt1FieldParts(F.ADT1_FIELD_LIST.find(f => f.key === 'firmPan')).ref, '4(f)(i)');
  assert.equal(F.adt1FieldParts(F.ADT1_FIELD_LIST.find(f => f.key === 'agmDate')).ref, '(d)');
});

test('typing: cleaning keeps the caret where the user is typing', () => {
  const cin = F.ADT1_FIELD_LIST.find(f => f.key === 'cin');
  assert.deepEqual(F.adt1CleanWithCaret(cin, 'u80904 ka2018-ptc119370 ', 7), { value: 'U80904KA2018PTC119370', caret: 6 });
  assert.deepEqual(F.adt1CleanWithCaret(cin, 'u809', 4), { value: 'U809', caret: 4 });
  assert.equal(F.adt1CleanValue(cin, 'U80904KA2018PTC119370999'), 'U80904KA2018PTC119370', 'a CIN is never longer than 21');
  const pan = F.ADT1_FIELD_LIST.find(f => f.key === 'firmPan');
  assert.deepEqual(F.adt1CleanWithCaret(pan, 'aaoFj 5797p', 3), { value: 'AAOFJ5797P', caret: 3 });
  const pin = F.ADT1_FIELD_LIST.find(f => f.key === 'firmPin');
  assert.equal(F.adt1CleanValue(pin, '56 00-01x9'), '560001');
  const num = F.ADT1_FIELD_LIST.find(f => f.key === 'numFinancialYears');
  assert.equal(F.adt1CleanValue(num, '1a2'), '12');
  const name = F.ADT1_FIELD_LIST.find(f => f.key === 'firmName');
  assert.equal(F.adt1CleanValue(name, 'Jain S A K and Co'), 'Jain S A K and Co', 'names are left alone');
  const email = F.ADT1_FIELD_LIST.find(f => f.key === 'firmEmail');
  assert.equal(F.adt1CleanValue(email, ' a@b.co '), 'a@b.co');
});

test('CIN: instant plain-language check', () => {
  assert.equal(F.adt1CinStatus('').state, 'empty');
  const typing = F.adt1CinStatus('U80904');
  assert.equal(typing.state, 'typing');
  assert.match(typing.msg, /6 of 21 characters/);
  assert.match(typing.msg, /2 letters \(state code\)/);
  const bad = F.adt1CinStatus('U8090KA2018PTC119370');
  assert.equal(bad.state, 'bad');
  assert.match(bad.msg, /^Characters 2–6 should be 5 digits \(industry code\)\./);
  const bad2 = F.adt1CinStatus('X80904KA2018PTC119370');
  assert.match(bad2.msg, /^Character 1 should be L/);
  const ok = F.adt1CinStatus(' u80904ka2018ptc119370 ');
  assert.equal(ok.state, 'ok');
  assert.match(ok.msg, /unlisted company, state code KA, incorporated in 2018/);
  assert.equal(F.adt1CinStatus('L17110MH1973PLC019786').msg.includes('listed company'), true);
  assert.equal(F.ADT1_CIN_RULE, 'CIN has 21 characters: L or U, 5 digits, 2 letters, 4 digits, 3 letters, 6 digits.');
});

test('financial years: ranges, detection, options', () => {
  assert.equal(F.adt1FyLabel(2025), 'FY 2025-26');
  assert.equal(F.adt1FyLabel(2099), 'FY 2099-00');
  assert.deepEqual(F.adt1FyRange(2025, 1), { from: '2025-04-01', to: '2026-03-31' });
  assert.deepEqual(F.adt1FyRange(2025, 5), { from: '2025-04-01', to: '2030-03-31' });
  assert.deepEqual(F.adt1FyRange(2025, 0), { from: '2025-04-01', to: '2026-03-31' }, 'at least one year');
  assert.deepEqual(F.adt1FyOfRange('2025-04-01', '2026-03-31'), { startYear: 2025, years: 1 });
  assert.deepEqual(F.adt1FyOfRange('01/04/2025', '31/03/2030'), { startYear: 2025, years: 5 });
  assert.equal(F.adt1FyOfRange('2025-04-02', '2026-03-31'), null);
  assert.equal(F.adt1FyOfRange('2026-04-01', '2026-03-31'), null);
  const o = F.adt1FyOptions(new Date(2026, 10, 5));   // 5 Nov 2026 is in FY 2026-27
  assert.deepEqual(o.map(x => x.startYear), [2027, 2026, 2025, 2024, 2023]);
  assert.equal(F.adt1FyOptions(new Date(2026, 1, 10))[1].startYear, 2025, 'Feb 2026 is still FY 2025-26');
});

test('financial years: a first year starts on the incorporation date', () => {
  assert.deepEqual(F.adt1FirstYearRange('2026-03-23'), { from: '2026-03-23', to: '2027-03-31' }, 'a stub of a few days runs to the following 31 March');
  assert.deepEqual(F.adt1FirstYearRange('2025-06-10'), { from: '2025-06-10', to: '2026-03-31' });
  assert.deepEqual(F.adt1FirstYearRange('2025-04-01'), { from: '2025-04-01', to: '2026-03-31' });
  assert.deepEqual(F.adt1FirstYearRange('2026-01-15'), { from: '2026-01-15', to: '2027-03-31' }, 'under 3 months is extended');
  assert.equal(F.adt1FirstYearRange('garbage'), null);
});

test('financial years: number of years is suggested only when it is clear', () => {
  assert.equal(F.adt1SuggestNumFY('2025-04-01', '2026-03-31'), 1);
  assert.equal(F.adt1SuggestNumFY('2025-04-01', '2030-03-31'), 5);
  assert.equal(F.adt1SuggestNumFY('2026-03-23', '2027-03-31'), 1, 'first period up to 18 months is one year');
  assert.equal(F.adt1SuggestNumFY('2024-04-01', '2027-06-30'), null, 'unclear: no guess');
  assert.equal(F.adt1SuggestNumFY('2026-03-31', '2025-04-01'), null);
  assert.equal(F.adt1SuggestNumFY('', '2025-04-01'), null);
});

test('quick dates: Today plus "same as" for related dates already entered', () => {
  const st = F.adt1BlankState();
  assert.deepEqual(F.adt1QuickDates(st, 'agmDate', '2026-11-05').map(q => q.label), ['Today']);
  st.agmDate = '2026-09-30';
  assert.deepEqual(F.adt1QuickDates(st, 'dateOfAppointment', '2026-11-05'), [{ label: 'Today', value: '2026-11-05' }, { label: 'Same as AGM date', value: '2026-09-30' }]);
  st.dateOfAppointment = '2026-09-30';
  assert.deepEqual(F.adt1QuickDates(st, 'resolutionDate', '2026-11-05').map(q => q.label), ['Today', 'Same as appointment date', 'Same as AGM date']);
  assert.deepEqual(F.adt1QuickDates(st, 'dateOfAppointment', '2026-11-05').map(q => q.label), ['Today'], 'no button for a value already there');
  assert.deepEqual(F.adt1QuickDates(st, 'periodFrom', '2026-11-05'), [], 'only fields marked quick');
  assert.deepEqual(F.adt1QuickDates(st, 'cin', '2026-11-05'), []);
});

test('copy: firm <-> signing auditor, PAN only when asked, blanks never wipe', () => {
  const st = Object.assign(F.adt1BlankState(), { firmAddr1: 'S3 White House', firmAddr2: '', firmPin: '560001', firmEmail: 'f@x.co', firmPan: 'AAOFJ5797P', auditorAddr1: 'old', auditorEmail: 'f@x.co' });
  const r = F.adt1CopyParty(st, 'firm', 'auditor');
  assert.deepEqual(r.copied.sort(), ['auditorAddr1', 'auditorPin']);
  assert.equal(r.state.auditorAddr1, 'S3 White House');
  assert.equal(r.state.auditorPan, '', 'PAN is not copied unless asked');
  assert.equal(st.auditorAddr1, 'old', 'input state is not modified');
  const p = F.adt1CopyParty(st, 'firm', 'auditor', { pan: true });
  assert.ok(p.copied.includes('auditorPan'));
  assert.equal(p.state.auditorPan, 'AAOFJ5797P');
  const back = F.adt1CopyParty(Object.assign(F.adt1BlankState(), { auditorAddr1: 'A', auditorPan: 'ABCDE1234F' }), 'auditor', 'firm', { pan: true });
  assert.equal(back.state.firmAddr1, 'A');
  assert.equal(back.state.firmPan, 'ABCDE1234F');
  assert.deepEqual(F.adt1CopyParty(F.adt1BlankState(), 'firm', 'auditor').copied, []);
});

test('scenarios: set the nature and only the answers that follow for certain', () => {
  const blank = F.adt1BlankState();
  const re = F.adt1ApplyScenario(blank, 'reappoint');
  assert.equal(re.state.natureOfAppointment, 'Re-appointment of Auditors in AGM');
  assert.equal(re.state.appointedInAgm, 'Yes');
  assert.equal(re.state.previouslyAudited, 'Yes');
  assert.equal(re.state._priorAppointed, true);
  assert.equal(blank.natureOfAppointment, '', 'input is not modified');
  assert.equal(F.adt1ScenarioOf(re.state), 'reappoint');
  const first = F.adt1ApplyScenario(blank, 'first');
  assert.equal(first.state.natureOfAppointment, 'First auditor by Board of directors/ members/ C&AG');
  assert.equal(first.state.previouslyAudited, 'No');
  assert.equal(first.state.appointedInAgm, '', 'a first auditor can also be appointed by members: left for MCA / the user');
  const agm = F.adt1ApplyScenario(blank, 'agm');
  assert.equal(agm.state.appointedInAgm, 'Yes');
  assert.equal(agm.state.previouslyAudited, '', 'a new auditor at the AGM may or may not have audited before');
  // The facts that are the user's to decide are never defaulted, whatever the scenario.
  for (const s of F.ADT1_SCENARIOS) {
    const r = F.adt1ApplyScenario(blank, s.id);
    for (const k of ['classUnder139_2', 'within20CompaniesLimit', 'auditCommitteeRecommendation', 'jointAuditors', 'auditorCategory']) assert.equal(r.state[k], '', `${s.id} must not set ${k}`);
    assert.ok(F.ADT1_NATURE_OPTIONS.includes(r.state.natureOfAppointment), s.id);
    assert.ok(s.next && s.blurb && s.title);
  }
  assert.deepEqual(F.ADT1_SCENARIOS.filter(s => !s.more).map(s => s.id), ['first', 'agm', 'reappoint', 'casual', 'tribunal', 'others']);
  assert.equal(F.adt1ApplyScenario(blank, 'nope').scenario, null);
});

test('scenarios: sections follow the choice, and "first" clears a stale prior-appointment block', () => {
  const a = F.adt1Active;
  assert.equal(a(F.adt1ApplyScenario(F.adt1BlankState(), 'casual').state).vacancy, true);
  assert.equal(a(F.adt1ApplyScenario(F.adt1BlankState(), 'tribunal').state).tribunal, true);
  assert.equal(a(F.adt1ApplyScenario(F.adt1BlankState(), 'reappoint').state).prior, true);
  assert.equal(a(F.adt1ApplyScenario(F.adt1BlankState(), 'agm').state).prior, false);
  const stale = Object.assign(F.adt1BlankState(), { natureOfAppointment: 'Re-appointment of Auditors in AGM', _priorAppointed: true, numPriorFinancialYears: '3', priorRow1Membership: '111', previouslyAudited: 'Yes' });
  const r = F.adt1ApplyScenario(stale, 'first');
  assert.equal(r.state.numPriorFinancialYears, '');
  assert.equal(r.state.priorRow1Membership, '');
  assert.equal(r.state.previouslyAudited, 'No');
  assert.equal(a(r.state).prior, false);
  assert.ok(r.changed.includes('numPriorFinancialYears') && r.changed.includes('natureOfAppointment'));
  assert.equal(F.adt1ScenarioOf(F.adt1BlankState()), '');
});

test('profiles: build, apply, upsert, rename, remove', () => {
  const st = full({ auditorPan: 'ABCDE1234F' });
  assert.equal(F.adt1ProfileHasData(F.adt1BlankState()), false);
  assert.equal(F.adt1ProfileHasData(st), true);
  const p = F.adt1ProfileFromState(st, '  Jain SAK  ', 'p1', 1000);
  assert.equal(p.name, 'Jain SAK');
  assert.equal(p.data.firmName, 'Jain S A K and Co');
  assert.equal(p.data.auditorPan, 'ABCDE1234F');
  assert.ok(!('cin' in p.data) && !('natureOfAppointment' in p.data), 'only firm and signing auditor details');
  assert.equal(F.adt1ProfileSummary(p), 'Jain S A K and Co · Sumit Jain');
  assert.match(F.adt1ProfileFromState(F.adt1BlankState(), '', null, 5).id, /^p_/);
  assert.equal(F.adt1ProfileFromState(st, '').name, 'Jain S A K and Co');

  const fresh = Object.assign(F.adt1BlankState(), { cin: 'U80904KA2018PTC119370', firmName: 'will be replaced' });
  const r = F.adt1ApplyProfile(fresh, p);
  assert.equal(r.state.firmName, 'Jain S A K and Co');
  assert.equal(r.state.auditorCategory, "Auditor's Firm");
  assert.equal(r.state.cin, 'U80904KA2018PTC119370', 'company details are untouched');
  assert.ok(r.applied.includes('firmName') && r.applied.includes('auditorEmail'));
  assert.equal(F.adt1ApplyProfile(r.state, p).applied.length, 0, 'already applied');
  const odd = F.adt1ApplyProfile(F.adt1BlankState(), { data: { auditorCategory: 'Partnership', firmName: 'X' } });
  assert.equal(odd.state.auditorCategory, '', 'an unknown category is ignored');
  assert.equal(odd.state.firmName, 'X');
  // Blank values in a profile never wipe what is typed.
  const keep = F.adt1ApplyProfile(Object.assign(F.adt1BlankState(), { firmPan: 'KEEPE1234P' }), { data: { firmName: 'Z' } });
  assert.equal(keep.state.firmPan, 'KEEPE1234P');

  let list = F.adt1ProfilesUpsert([], p);
  list = F.adt1ProfilesUpsert(list, F.adt1ProfileFromState(st, 'Another', 'p2', 2));
  assert.deepEqual(list.map(x => x.name), ['Another', 'Jain SAK']);
  list = F.adt1ProfilesUpsert(list, F.adt1ProfileFromState(st, 'jain sak', 'p3', 3));
  assert.equal(list.length, 2, 'same name (any case) replaces');
  assert.equal(list.find(x => x.id === 'p3').name, 'jain sak');
  list = F.adt1ProfilesRename(list, 'p2', 'Zed');
  assert.deepEqual(list.map(x => x.name), ['jain sak', 'Zed']);
  assert.equal(F.adt1ProfilesRename(list, 'p2', 'JAIN SAK'), list, 'cannot rename onto an existing name');
  assert.equal(F.adt1ProfilesRename(list, 'p2', '   '), list);
  assert.deepEqual(F.adt1ProfilesRemove(list, 'p2').map(x => x.id), ['p3']);
});

test('drafts: stable keys from CIN + period year, never overwriting another draft by accident', () => {
  const st = full();
  const k = F.adt1PickDraftKey(st, null, [], { stamp: 1 });
  assert.equal(k, 'adt1_draft_u80904ka2018ptc119370_2026');
  assert.equal(F.adt1PickDraftKey(st, k, [k]), k);
  // editing the period moves the draft to a new key ...
  const later = Object.assign({}, st, { periodTo: '2027-03-31' });
  assert.equal(F.adt1PickDraftKey(later, k, [k]), 'adt1_draft_u80904ka2018ptc119370_2027');
  // ... unless another draft already owns that key
  assert.equal(F.adt1PickDraftKey(later, k, [k, 'adt1_draft_u80904ka2018ptc119370_2027']), k);
  // a brand-new, unsaved draft (no key yet) with the same CIN + year never overwrites the saved one:
  // it gets the next free suffix, exactly as `unique` does
  assert.equal(F.adt1PickDraftKey(st, null, [k]), k + '_2');
  assert.equal(F.adt1PickDraftKey(st, null, [k, k + '_2']), k + '_3');
  assert.equal(F.adt1PickDraftKey(st, null, []), k, 'nothing saved under that key: the natural key is free');
  assert.equal(F.adt1PickDraftKey(st, null, [k], { unique: true }), k + '_2');
  assert.equal(F.adt1PickDraftKey(st, null, [k, k + '_2'], { unique: true }), k + '_3');
  // no valid CIN yet: keep the current key, or take a fresh one
  const partial = Object.assign(F.adt1BlankState(), { cin: 'U809', companyName: 'Acme' });
  assert.equal(F.adt1PickDraftKey(partial, 'adt1_draft_new_7', []), 'adt1_draft_new_7');
  assert.equal(F.adt1PickDraftKey(partial, null, [], { stamp: 99 }), 'adt1_draft_new_99');
  assert.equal(F.adt1PickDraftKey(Object.assign({}, st, { periodFrom: '', periodTo: '' }), null, []), 'adt1_draft_u80904ka2018ptc119370_noyear');
});

test('drafts: labels, content check, listing and duplicating', () => {
  assert.equal(F.adt1HasContent(F.adt1BlankState()), false);
  assert.equal(F.adt1HasContent(Object.assign(F.adt1BlankState(), { cin: 'U' })), true);
  assert.equal(F.adt1PeriodLabel(full()), 'FY 2025-26');
  assert.equal(F.adt1PeriodLabel(full({ periodFrom: '2025-04-01', periodTo: '2030-03-31' })), '01/04/2025 to 31/03/2030');
  assert.equal(F.adt1PeriodLabel(F.adt1BlankState()), '');
  assert.equal(F.adt1DraftLabel(full({ companyName: 'Acme Pvt Ltd' })), 'Acme Pvt Ltd — FY 2025-26');
  assert.equal(F.adt1DraftLabel(Object.assign(F.adt1BlankState(), { cin: 'u80904ka2018ptc119370' })), 'U80904KA2018PTC119370');
  assert.equal(F.adt1DraftLabel(F.adt1BlankState()), 'Unnamed client');
  assert.match(F.adt1DraftLabel(Object.assign(F.adt1BlankState(), { firmName: 'Jain & Co' })), /Jain & Co \(company not entered yet\)/);

  const list = F.adt1SummarizeDrafts([
    { key: 'adt1_draft_a', value: { state: { cin: 'U80904KA2018PTC119370' }, _savedAt: 5 } },
    { key: 'adt1_draft_b', value: { state: { companyName: 'Newer' }, _savedAt: 9 } },
    { key: 'aoc4_draft_x', value: { state: {}, _savedAt: 99 } },
    { key: 'adt1_draft_bad', value: null },
    { key: 'adt1_draft_str', value: { state: 'nope' } }
  ]);
  assert.deepEqual(list.map(d => d.key), ['adt1_draft_b', 'adt1_draft_a']);
  assert.equal(list[0].label, 'Newer');

  const dup = F.adt1DuplicateState(full());
  for (const k of ['periodFrom', 'periodTo', 'numFinancialYears', 'agmDate', 'dateOfAppointment', 'resolutionNumber', 'resolutionDate', 'priorRow1FyStart', 'priorRow1FyEnd']) assert.equal(dup[k], '', k);
  assert.equal(dup.firmName, 'Jain S A K and Co');
  assert.equal(dup.cin, 'U80904KA2018PTC119370');
  assert.equal(full().periodFrom, '2025-04-01', 'original untouched');
});

test('progress: counts required answers, per-section status and the checklist', () => {
  const blank = F.adt1Progress(F.adt1BlankState());
  assert.equal(blank.done, 0);
  assert.ok(blank.total >= 14);
  const st = (id, p) => p.sections.find(s => s.id === id).status;
  assert.equal(st('company', blank), 'todo');
  assert.equal(st('firm', blank), 'na');
  assert.equal(st('prior', blank), 'na');
  assert.equal(st('tribunal', blank), 'na');
  assert.equal(st('vacancy', blank), 'na');
  assert.equal(st('declaration', blank), 'optional');
  assert.equal(blank.ready, false);
  assert.equal(blank.pct, 0);
  assert.ok(blank.missing.length >= blank.total);
  assert.ok(blank.missing.every(m => m.severity === 'todo' && m.key && m.section && m.msg));

  const done = F.adt1Progress(F.adt1SampleState());
  assert.equal(done.done, done.total);
  assert.equal(done.pct, 100);
  assert.equal(done.ready, true);
  assert.deepEqual(done.missing, []);
  assert.equal(done.sections.filter(s => s.status === 'done').length, 6);
  assert.equal(done.decl.done, done.decl.total);
  assert.equal(st('declaration', done), 'done');
});

test('progress: a malformed answer is "to fix", not "done"; hidden sections do not count', () => {
  const p = F.adt1Progress(full({ firmPan: 'AB1' }));
  assert.equal(p.done, p.total - 1);
  assert.equal(p.sections.find(s => s.id === 'firm').status, 'todo');
  const item = p.missing.find(m => m.key === 'firmPan');
  assert.equal(item.severity, 'error');
  assert.equal(p.ready, false);
  // switching to an individual auditor removes the firm section from the count
  const ind = F.adt1Progress(full({ auditorCategory: 'Individual', firmPan: 'AB1' }));
  assert.equal(ind.sections.find(s => s.id === 'firm').status, 'na');
  assert.ok(ind.total < p.total);
  assert.equal(ind.ready, true);
  assert.ok(ind.notes.some(n => n.key === 'auditorCategory'), 'warnings are listed as notes');
  // declaration gaps are notes flagged decl, and never block
  const noDecl = F.adt1Progress(full({ resolutionNumber: '', signatoryIdentifier: '' }));
  assert.equal(noDecl.ready, true);
  assert.equal(noDecl.sections.find(s => s.id === 'declaration').status, 'optional');
  assert.ok(noDecl.notes.filter(n => n.decl).length >= 2);
  assert.equal(noDecl.total, F.adt1Progress(F.adt1SampleState()).total, 'declaration is not in the main count');
  // a tribunal appointment adds its own section to the count
  const trib = F.adt1Progress(full({ natureOfAppointment: 'Auditor appointed by the Tribunal' }));
  assert.equal(trib.sections.find(s => s.id === 'tribunal').status, 'todo');
  assert.ok(trib.missing.some(m => m.key === 'inc28Srn'));
  // a precomputed validation can be passed in
  const v = F.validateAdt1(full());
  assert.deepEqual(F.adt1Progress(full(), v), F.adt1Progress(full()));
});

test('summary: one plain-language headline per kind of appointment', () => {
  const st = F.adt1BlankState();
  st.companyName = 'Germin8 Advisors Pvt Ltd'; st.firmName = 'Jain Maneesh & Co'; st.auditorCategory = "Auditor's Firm";
  st.periodFrom = '2026-03-23'; st.periodTo = '2027-03-31';
  assert.equal(F.adt1PlainSummary(F.adt1ApplyScenario(st, 'first').state), 'Germin8 Advisors Pvt Ltd — first auditor Jain Maneesh & Co, 23/03/2026 to 31/03/2027');
  assert.equal(F.adt1PlainSummary(F.adt1ApplyScenario(st, 'reappoint').state), 'Germin8 Advisors Pvt Ltd — re-appointment of Jain Maneesh & Co at the AGM, 23/03/2026 to 31/03/2027');
  assert.match(F.adt1PlainSummary(F.adt1ApplyScenario(st, 'casual').state), /casual vacancy filled by Jain Maneesh & Co/);
  assert.match(F.adt1PlainSummary(F.adt1ApplyScenario(st, 'tribunal').state), /Jain Maneesh & Co appointed by the Tribunal/);
  // missing pieces degrade gracefully
  assert.equal(F.adt1PlainSummary(F.adt1BlankState()), 'This company — appointment of an auditor (not named yet)');
  const onlyCin = Object.assign(F.adt1BlankState(), { cin: 'u80904ka2018ptc119370', auditorCategory: 'Individual', auditorName: 'Sumit Jain', natureOfAppointment: 'Appointment of Auditors in AGM' });
  assert.equal(F.adt1PlainSummary(onlyCin), 'U80904KA2018PTC119370 — appointment of Sumit Jain at the AGM');
  assert.match(F.adt1PlainSummary(F.adt1BlankState(), { companyName: 'From lookup' }), /^From lookup — /);
});

test('review rows: what the extension will fill, grouped by section, matching the payload exactly', () => {
  const st = F.adt1SampleState();
  const rows = F.adt1ReviewRows(st);
  const data = F.buildAdt1FormData(st);
  assert.deepEqual(rows.map(r => r.key), Object.keys(data));
  for (const r of rows) assert.equal(r.value, data[r.key]);
  assert.equal(rows.find(r => r.key === 'periodFrom').value, '01/04/2025');
  assert.equal(rows.find(r => r.key === 'cin').label, 'CIN');
  assert.equal(rows.find(r => r.key === 'cin').ref, '1');
  assert.equal(rows.find(r => r.key === 'firmEmail').label, 'Firm — Email ID');
  assert.equal(rows.find(r => r.key === 'resolutionNumber').decl, true);
  assert.equal(rows.find(r => r.key === 'firmName').sectionTitle, "Auditor's firm");
  // hidden sections are not listed
  const ind = F.adt1ReviewRows(full({ auditorCategory: 'Individual' }));
  assert.ok(!ind.some(r => r.section === 'firm'));
  assert.deepEqual(F.adt1ReviewRows(F.adt1BlankState()), []);
});

test('section summaries for collapsed cards', () => {
  const st = F.adt1SampleState();
  assert.match(F.adt1SectionSummary('company', st), /^U80904KA2018PTC119370 · SAMPLE/);
  assert.equal(F.adt1SectionSummary('firm', st), 'Jain S A K and Co · 018971S');
  assert.equal(F.adt1SectionSummary('auditor', st), 'Sumit Jain · M.No. 235818 · 01/04/2025 to 31/03/2026');
  assert.equal(F.adt1SectionSummary('prior', st), '1 year(s) before · M.No. 235818');
  assert.equal(F.adt1SectionSummary('declaration', st), 'Resolution 04 · 30/09/2026 · Director');
  assert.equal(F.adt1SectionSummary('appointment', st), "Re-appointment of Auditors in AGM · Auditor's Firm");
  assert.equal(F.adt1SectionSummary('tribunal', F.adt1BlankState()), '');
  assert.equal(F.adt1SectionSummary('nope', st), '');
});
