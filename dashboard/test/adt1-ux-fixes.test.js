// Pure-logic checks for the data-entry UX fixes (prior block, scenario presets, draft keys, codes
// with spaces or symbols). They run against the pure half of js/adt1-form.js only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/adt1-form.js');

// A complete, valid re-appointment (the built-in sample) with overrides.
const full = over => Object.assign(F.adt1SampleState(), over);
const field = key => F.ADT1_FIELD_LIST.find(f => f.key === key);

test('prior block: derived from the answers, so 4(l) = No closes it whatever was ticked or typed before', () => {
  const a = st => F.adt1Active(st).prior;
  const base = Object.assign(F.adt1BlankState(), { natureOfAppointment: 'Appointment of Auditors in AGM' });
  assert.equal(a(Object.assign({}, base, { previouslyAudited: 'Yes' })), true, '4(l) Yes opens the block');
  assert.equal(a(Object.assign({}, base, { previouslyAudited: 'No' })), false);
  // what used to keep it open for good: a stale tick or a typed count left over from the Yes answer
  assert.equal(a(Object.assign({}, base, { previouslyAudited: 'No', _priorAppointed: true })), false, 'an explicit No wins over the tick');
  assert.equal(a(Object.assign({}, base, { previouslyAudited: 'No', numPriorFinancialYears: '3' })), false, 'an explicit No wins over a typed count');
  assert.equal(a(Object.assign({}, base, { previouslyAudited: '', _priorAppointed: true })), true, 'unanswered: the tick opens it');
  assert.equal(a(Object.assign({}, base, { previouslyAudited: '', numPriorFinancialYears: '2' })), true, 'unanswered: a typed count opens it');
  assert.equal(a(Object.assign({}, base, { natureOfAppointment: 'Re-appointment of Auditors in AGM', previouslyAudited: 'No' })), true, 'a re-appointment always needs the previous tenure');
  // the hidden rows are neither sent nor validated once the block is closed
  const closed = full({ natureOfAppointment: 'Appointment of Auditors in AGM', previouslyAudited: 'No', _priorAppointed: true, numPriorFinancialYears: '3', priorRow1Membership: '' });
  assert.ok(!('numPriorFinancialYears' in F.buildAdt1FormData(closed)));
  assert.ok(!F.validateAdt1(closed).errors.some(e => e.path === 'priorRow1Membership'));
  assert.equal(F.adt1Progress(closed).sections.find(s => s.id === 'prior').status, 'na');
});

test('scenarios: a new card clears what the earlier card pre-filled, but never an answer the user changed', () => {
  const blank = F.adt1BlankState();
  const re = F.adt1ApplyScenario(blank, 'reappoint');
  const note = { id: 'reappoint', changed: re.changed };
  // Re-appointment -> Casual vacancy: 3(c) and 4(l) came from the card, so they go, and the prior tick goes with them
  const casual = F.adt1ApplyScenario(re.state, 'casual', note);
  assert.equal(casual.state.appointedInAgm, '');
  assert.equal(casual.state.previouslyAudited, '');
  assert.equal(casual.state._priorAppointed, false);
  assert.ok(casual.changed.includes('appointedInAgm') && casual.changed.includes('previouslyAudited'), 'the info line can say what was cleared');
  assert.equal(F.adt1Active(casual.state).prior, false);
  // First auditor -> AGM: the pre-filled "No" for 4(l) is cleared (an AGM appointment may be either)
  const first = F.adt1ApplyScenario(blank, 'first');
  const agm = F.adt1ApplyScenario(first.state, 'agm', { id: 'first', changed: first.changed });
  assert.equal(agm.state.previouslyAudited, '');
  assert.equal(agm.state.appointedInAgm, 'Yes');
  // an answer the user changed after the card is kept
  const edited = Object.assign({}, re.state, { previouslyAudited: 'No' });
  const kept = F.adt1ApplyScenario(edited, 'casual', note);
  assert.equal(kept.state.previouslyAudited, 'No', 'user changed it: not ours to clear');
  assert.equal(kept.state.appointedInAgm, '', 'still the preset value: cleared');
  // a key the earlier card did not actually change (it was already that value) is not touched
  const already = Object.assign(F.adt1BlankState(), { appointedInAgm: 'Yes' });
  const re2 = F.adt1ApplyScenario(already, 'reappoint');
  assert.ok(!re2.changed.includes('appointedInAgm'));
  const after = F.adt1ApplyScenario(re2.state, 'casual', { id: 'reappoint', changed: re2.changed });
  assert.equal(after.state.appointedInAgm, 'Yes', 'the user had answered 3(c) before the card');
  // a key the new card sets itself is set once, not cleared then set
  const agm2 = F.adt1ApplyScenario(re.state, 'agm', note);
  assert.equal(agm2.state.appointedInAgm, 'Yes');
  assert.equal(agm2.changed.filter(k => k === 'appointedInAgm').length, 0, 'same value: not reported as changed');
  assert.equal(agm2.state.previouslyAudited, '', "4(l) is the user's to answer for an AGM appointment");
  // no record of the earlier card (after a reload): its whole `set` counts as pre-filled
  const noNote = F.adt1ApplyScenario(re.state, 'casual', { id: 'reappoint' });
  assert.equal(noNote.state.previouslyAudited, '');
  // the same card again, or no earlier card: nothing is cleared
  assert.equal(F.adt1ApplyScenario(re.state, 'reappoint', note).state.previouslyAudited, 'Yes');
  assert.equal(F.adt1ApplyScenario(re.state, 'casual').state.previouslyAudited, 'Yes', 'no prev given: old behaviour');
  assert.equal(F.adt1ApplyScenario(re.state, 'casual', { id: '' }).state.previouslyAudited, 'Yes');
  assert.equal(blank.natureOfAppointment, '', 'inputs are never modified');
  assert.equal(re.state.previouslyAudited, 'Yes', 'inputs are never modified');
});

test('drafts: a new, unsaved client never overwrites a saved client with the same CIN + year', () => {
  const st = full();
  const k = F.adt1PickDraftKey(st, null, []);
  assert.equal(k, 'adt1_draft_u80904ka2018ptc119370_2026');
  assert.equal(F.adt1PickDraftKey(st, null, [k]), k + '_2', 'collision: the saved one is kept, the new one gets _2');
  assert.equal(F.adt1PickDraftKey(st, null, [k, k + '_2']), k + '_3');
  assert.equal(F.adt1PickDraftKey(st, k, [k]), k, 'the saved client itself keeps its key');
  assert.equal(F.adt1PickDraftKey(st, k + '_2', [k, k + '_2']), k + '_2', 'and so does the copy');
});

test('codes: spaces and symbols in a CIN, PAN, FRN or SRN are named plainly, cleaned on import and stripped when sent', () => {
  assert.equal(F.adt1TidyId(field('cin'), 'u80904 ka2018-ptc119370'), 'U80904KA2018PTC119370');
  assert.equal(F.adt1TidyId(field('firmRegistrationNumber'), '018971 s'), '018971S');
  assert.equal(F.adt1TidyId(field('firmName'), 'Jain S A K & Co'), 'Jain S A K & Co', 'ordinary text is untouched');
  // validate: the message says what to do, not "CIN looks right"
  const cin = F.validateAdt1(full({ cin: 'U80904 KA2018PTC119370' })).errors.find(e => e.path === 'cin');
  assert.ok(cin, 'a CIN with a space in it is an error');
  assert.match(cin.msg, /spaces or symbols/);
  assert.match(cin.msg, /U80904KA2018PTC119370/);
  assert.ok(!/looks right/.test(cin.msg));
  const pan = F.validateAdt1(full({ firmPan: 'AAOFJ-5797P' })).errors.find(e => e.path === 'firmPan');
  assert.match(pan.msg, /spaces or symbols/);
  const frn = F.validateAdt1(full({ firmRegistrationNumber: '018971 S' })).errors.find(e => e.path === 'firmRegistrationNumber');
  assert.match(frn.msg, /spaces or symbols/);
  const onlyJunk = F.validateAdt1(full({ firmPan: '---' })).errors.find(e => e.path === 'firmPan');
  assert.match(onlyJunk.msg, /only spaces or symbols/);
  const srn = F.validateAdt1(full({ natureOfAppointment: 'Auditor appointed by the Tribunal', inc28Srn: 'F 12345678' }));
  assert.ok(!srn.errors.some(e => e.path === 'inc28Srn'), 'an SRN problem never blocks sending');
  assert.ok(srn.warnings.some(e => e.path === 'inc28Srn' && /spaces or symbols/.test(e.msg)));
  assert.deepEqual(F.validateAdt1(full({ cin: 'u80904ka2018ptc119370', firmPan: 'aaofj5797p' })).errors, [], 'lower case alone is fine');
  // import cleans the codes the way typing would; the extension never sees the space
  const { state } = F.adt1StateFromJson({ cin: 'U80904 KA2018PTC119370', firmPan: 'aaofj-5797p', firmRegistrationNumber: '018971 s', firmName: 'Jain S A K & Co' });
  assert.equal(state.cin, 'U80904KA2018PTC119370');
  assert.equal(state.firmPan, 'AAOFJ5797P');
  assert.equal(state.firmRegistrationNumber, '018971S');
  assert.equal(state.firmName, 'Jain S A K & Co');
  assert.equal(F.buildAdt1FormData(full({ cin: 'U80904 KA2018PTC119370' })).cin, 'U80904KA2018PTC119370');
  assert.equal(F.buildAdt1FormData(full({ firmPan: 'AAOFJ-5797P' })).firmPan, 'AAOFJ5797P');
});
