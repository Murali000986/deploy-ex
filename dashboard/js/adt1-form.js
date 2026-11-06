/* ═══════════════════════════════════════════════════════════════════
   ADT-1 (Notice to the Registrar for appointment of auditor) — manual data-entry form.

   Two halves in one file, loaded BEFORE js/dashboard.js:
     1. Pure logic (state, conditional sections, validation, build of the extension payload).
        No DOM, no dashboard globals — unit-tested by test/adt1-form.test.js under plain Node.
     2. Browser UI (cards, review panel, send/download/import, draft). Only runs in the page and
        reuses dashboard.js's $, $$, esc, toast, LS, settings, sendToExtension, showPanel,
        setSaveState at CALL time (never at load time), so script order does not matter for them.

   The field list is a compact copy of extension/js/field-maps/adt1.js (dataKey names, labels,
   required flags, exact option strings). The dashboard does not load that file, so keep the two in
   sync by hand: formData is ONE FLAT object keyed by those dataKeys.

   Output contract (extension background.js handleImportClient):
     { action:'importClient', formType:'adt1', formData:<flat>, clientInfo:{id,name,cin,source} }
   Dates leave this module as "DD/MM/YYYY"; inside the form they are ISO (what <input type=date>
   wants). Empty values are omitted entirely ("leave blank / do not fill").
   ═══════════════════════════════════════════════════════════════════ */

/* ───────────────────────── 1. Pure logic ───────────────────────── */

const ADT1_NATURE_OPTIONS = [
  'First auditor by Board of directors/ members/ C&AG',
  'Appointment of Auditors in AGM',
  'Re-appointment of Auditors in AGM',
  'Appointment/ Re-appointment by C&AG',
  'Auditor appointed in case of casual vacancy',
  'Auditor appointed in case of non-re-appointment/ removal of the previous auditor',
  'Auditor appointed by the Tribunal',
  'Auditor appointed by Central Government',
  'Others'
];
const ADT1_NATURE_OTHERS = 'Others';
const ADT1_NATURE_REAPPOINT = 'Re-appointment of Auditors in AGM';
const ADT1_NATURE_TRIBUNAL = 'Auditor appointed by the Tribunal';
const ADT1_NATURE_CASUAL = 'Auditor appointed in case of casual vacancy';
const ADT1_CAT_FIRM = "Auditor's Firm";
const ADT1_CAT_INDIVIDUAL = 'Individual';
const ADT1_REASON_RESIGNATION = 'Resignation';
const ADT1_REASON_OTHERS = 'Others (death, disqualification)';
const ADT1_DESIGNATIONS = ['Director', 'Manager', 'Company Secretary', 'CEO', 'CFO', 'Liquidator', 'Interim Resolution Professional (IRP)', 'Resolution Professional (RP)'];

const ADT1_RE = {
  cin: /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  din: /^\d{8}$/,
  srn: /^[A-Z]{1,2}\d{7,9}$/,
  pin: /^\d{6}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  int: /^\d+$/
};

// Field kinds: text | date | select | textarea | check (UI-only, never sent).
// fmt drives input cleaning + validation: cin pan pin srn int email.  upper = force upper case.
// `decl` marks Declaration-step fields: missing ones are WARNINGS (the extension's Phase 2 does not
// fill that step), malformed ones are still errors.
const ADT1_SECTIONS = [
  {
    id: 'company', title: 'Company', sub: 'Field 1 and 2 — only the CIN is needed; MCA looks up and fills the rest',
    fields: [
      { key: 'cin', label: '1. Corporate Identity Number (CIN)', type: 'text', req: true, fmt: 'cin', upper: true, ph: 'e.g. U80904KA2018PTC119370', span: 2 },
      { key: 'companyName', label: '2(a) Name of the company', type: 'text', hint: 'MCA autofills this from the CIN — optional', span: 2 },
      { key: 'companyAddress', label: '2(b) Address of the registered office', type: 'text', hint: 'MCA autofills this — optional', span: 4 },
      { key: 'companyEmail', label: '2(c) Email ID of the company', type: 'text', fmt: 'email', hint: 'MCA autofills this — optional', span: 2 }
    ]
  },
  {
    id: 'appointment', title: 'Appointment details', sub: 'Field 3 and 4(a)–(d)',
    fields: [
      // Yes/No questions found on the live page (their question text is how the extension finds them).
      { key: 'classUnder139_2', label: '3(a) Whether the company falls under any class of companies as per section 139(2)', type: 'select', req: true, opts: ['Yes', 'No'], span: 4 },
      { key: 'natureOfAppointment', label: '3(b) Nature of appointment', type: 'select', req: true, opts: ADT1_NATURE_OPTIONS, span: 4 },
      { key: 'appointedInAgm', label: '3(c) Whether the auditor(s) was appointed in the annual general meeting (AGM)', type: 'select', opts: ['Yes', 'No'], hint: 'MCA usually sets this itself from the nature of appointment: leave blank unless it stays unanswered.', span: 4 },
      { key: 'natureOfAppointmentOther', label: '3(b)(i) If Others, please specify', type: 'textarea', span: 4, when: s => s.natureOfAppointment === ADT1_NATURE_OTHERS },
      { key: 'agmDate', label: '(d) If yes, date of AGM', type: 'date', hint: 'Fill only if MCA shows this field for the chosen nature; blank is skipped.' },
      { key: 'dateOfAppointment', label: '4(a) Date of appointment', type: 'date', hint: 'Only some natures reveal this on MCA; blank is skipped.' },
      { key: 'jointAuditors', label: '4(b) Whether joint auditors appointed', type: 'select', req: true, opts: ['Yes', 'No'] },
      { key: 'numAuditorsAppointed', label: '4(c) Number of auditor(s) appointed', type: 'text', req: true, fmt: 'int', ph: '1' },
      { key: 'auditorCategory', label: '4(d) Category of auditor', type: 'select', req: true, opts: [ADT1_CAT_FIRM, ADT1_CAT_INDIVIDUAL] },
      { key: 'within20CompaniesLimit', label: '4(k) Whether the appointment is within the limit of twenty companies (section 141(3)(g))', type: 'select', req: true, opts: ['Yes', 'No'], span: 4 },
      { key: 'previouslyAudited', label: '4(l) Whether the auditor, the firm or one of its members has audited this company before (Rule 6)', type: 'select', opts: ['Yes', 'No'], hint: 'Answer No for a first appointment; Yes opens the previous-tenure block. MCA does not show it for every nature, so it is skipped if absent.', span: 4 },
      { key: 'auditCommitteeRecommendation', label: '5. Whether the Audit Committee\'s recommendation (section 177) was considered by the Board before the appointment', type: 'select', req: true, opts: ['Yes', 'No', 'Not Applicable'], span: 4 },
      { key: '_priorAppointed', label: 'This auditor was appointed before (fills the prior-appointments block, 4(n)–(s)); always on for a re-appointment', type: 'check', span: 4 }
    ]
  },
  {
    id: 'firm', title: "Auditor's firm", sub: "Fields 4(e)–(f) — shown because Category = Auditor's Firm",
    fields: [
      { key: 'firmRegistrationNumber', label: '4(e) Firm Registration Number', type: 'text', req: true, upper: true, ph: 'e.g. 018971S' },
      { key: 'firmName', label: "4(f) Name of the auditor's firm", type: 'text', req: true, span: 2 },
      { key: 'firmPan', label: "4(f)(i) PAN of the auditor's firm", type: 'text', req: true, fmt: 'pan', upper: true, ph: 'AAAAA9999A' },
      { key: 'firmAddr1', label: 'Address line 1', type: 'text', req: true, span: 2 },
      { key: 'firmAddr2', label: 'Address line 2', type: 'text', span: 2 },
      { key: 'firmCountry', label: 'Country', type: 'text', ph: 'India', hint: 'MCA pre-fills India; leave blank' },
      { key: 'firmPin', label: 'Pin code', type: 'text', req: true, fmt: 'pin', ph: '6 digits' },
      { key: 'firmArea', label: 'Area / Locality', type: 'text', hint: 'Leave blank: the extension picks the first locality MCA lists for the pin code and tells you to check it. Type the exact text to choose another.' },
      { key: 'firmCity', label: 'City', type: 'text', hint: 'MCA fills this after the locality; leave blank' },
      { key: 'firmDistrict', label: 'District', type: 'text', hint: 'MCA fills this after the locality; leave blank' },
      { key: 'firmState', label: 'State / UT', type: 'text', hint: 'MCA fills this after the locality; leave blank' },
      { key: 'firmEmail', label: 'Email ID', type: 'text', req: true, fmt: 'email', span: 2 }
    ]
  },
  {
    id: 'auditor', title: 'Signing auditor', sub: 'Fields 4(g)–(j) — the auditor who signs the balance sheet (the individual, even for a firm)',
    fields: [
      { key: 'membershipNumber', label: '4(g) Membership number of the auditor signing the balance sheet', type: 'text', req: true, span: 2 },
      { key: 'auditorName', label: '4(h) Name of the auditor', type: 'text', req: true, span: 2 },
      { key: 'auditorPan', label: '4(h)(i) PAN of the auditor', type: 'text', req: true, fmt: 'pan', upper: true, ph: 'AAAAA9999A' },
      { key: 'auditorAddr1', label: 'Address line 1', type: 'text', req: true, span: 2 },
      { key: 'auditorAddr2', label: 'Address line 2', type: 'text', span: 2 },
      { key: 'auditorCountry', label: 'Country', type: 'text', ph: 'India', hint: 'MCA pre-fills India; leave blank' },
      { key: 'auditorPin', label: 'Pin code', type: 'text', req: true, fmt: 'pin', ph: '6 digits' },
      { key: 'auditorArea', label: 'Area / Locality', type: 'text', hint: 'Leave blank: the extension picks the first locality MCA lists for the pin code and tells you to check it. Type the exact text to choose another.' },
      { key: 'auditorCity', label: 'City', type: 'text', hint: 'MCA fills this after the locality; leave blank' },
      { key: 'auditorDistrict', label: 'District', type: 'text', hint: 'MCA fills this after the locality; leave blank' },
      { key: 'auditorState', label: 'State / UT', type: 'text', hint: 'MCA fills this after the locality; leave blank' },
      { key: 'auditorEmail', label: 'Email ID', type: 'text', req: true, fmt: 'email', span: 2 },
      { key: 'periodFrom', label: '4(i) Period of account — from', type: 'date', req: true },
      { key: 'periodTo', label: '4(i) Period of account — to', type: 'date', req: true },
      { key: 'numFinancialYears', label: '4(j) Number of financial year(s) the appointment relates to', type: 'text', req: true, fmt: 'int', ph: '1', span: 2 }
    ]
  },
  {
    id: 'prior', title: 'Prior appointments', sub: 'Fields 4(m)–(s) — MCA asks for the tenure of previous appointments on a re-appointment. Only the first row is filled by the extension; add further rows on MCA',
    fields: [
      { key: 'numPriorFinancialYears', label: '4(n) Number of financial year(s) of prior appointment', type: 'text', req: true, fmt: 'int', span: 2 },
      { key: 'priorRow1FirmReg', label: '4(p) Row 1 — Firm Registration Number', type: 'text', upper: true, span: 2 },
      { key: 'priorRow1Membership', label: '4(q) Row 1 — Membership number of auditor', type: 'text', req: true, span: 2 },
      { key: 'priorRow1FyStart', label: '4(r) Row 1 — Financial year start date', type: 'date', req: true },
      { key: 'priorRow1FyEnd', label: '4(s) Row 1 — Financial year end date', type: 'date', req: true }
    ]
  },
  {
    id: 'tribunal', title: 'Tribunal order', sub: 'Field 6 — shown because Nature of appointment = Tribunal',
    fields: [
      { key: 'inc28Srn', label: '6. SRN of INC-28 (Tribunal order for appointment)', type: 'text', req: true, fmt: 'srn', upper: true, ph: 'e.g. F12345678', span: 2 }
    ]
  },
  {
    id: 'vacancy', title: 'Casual vacancy', sub: 'Field 7 — shown because Nature of appointment = casual vacancy',
    fields: [
      { key: 'casualVacancyReason', label: '7(a) Reason for the casual vacancy', type: 'select', req: true, opts: [ADT1_REASON_RESIGNATION, ADT1_REASON_OTHERS], span: 2 },
      { key: 'casualVacancyOtherReason', label: '7(a)(i) If Others, please specify', type: 'text', req: true, span: 2, hint: 'MCA shows this as a dropdown — type its exact option text', when: s => s.casualVacancyReason === ADT1_REASON_OTHERS },
      { key: 'relevantFormSrn', label: '7(b) SRN of relevant form (ADT-3 / 23B / GNL-2)', type: 'text', req: true, fmt: 'srn', upper: true, span: 2 },
      { key: 'casualVacancyDate', label: '7(c) Date of casual vacancy', type: 'date', req: true },
      { key: 'vacatedFirmRegNumber', label: '7(d) Registration number of the firm that vacated office', type: 'text', upper: true, span: 2 },
      { key: 'vacatingAuditorMembership', label: '7(e) Membership number of the (vacating) auditor', type: 'text', req: true, span: 2 },
      { key: 'casualVacancyReasonText', label: '7(f) Reasons for the casual vacancy', type: 'textarea', req: true, span: 4 }
    ]
  },
  {
    id: 'declaration', title: 'Declaration', sub: 'Collected here and sent along, but the extension does not fill this step yet — fill it on MCA, or leave it for later',
    decl: true,
    fields: [
      { key: 'resolutionNumber', label: 'Board resolution number', type: 'text', req: true },
      { key: 'resolutionDate', label: 'Board resolution date', type: 'date', req: true },
      { key: 'signatoryDesignation', label: 'Designation of the person signing', type: 'select', req: true, opts: ADT1_DESIGNATIONS, span: 2 },
      { key: 'signatoryIdentifier', label: 'DIN / PAN / Membership number of the signatory', type: 'text', req: true, upper: true, hint: 'DIN (8 digits) for a Director; membership number for a Company Secretary; PAN otherwise — per MCA', span: 2 }
    ]
  }
];

// Plain-English extras merged into the field/section definitions above (kept apart so the compact
// copy of the extension's field map stays easy to diff). short = name used in messages and tables;
// help = one or two friendly sentences with the MCA reference; quick/sameAs drive the date buttons.
// Where a legal fact is the filer's to decide, the help text says so and nothing is ever pre-filled.
const ADT1_FIELD_EXTRA = {
  cin: { short: 'CIN', help: 'The 21-character Corporate Identity Number from the certificate of incorporation. Paste it as it is: spaces and small letters are tidied for you.', hint: '' },
  companyName: { short: 'Company name' },
  companyAddress: { short: 'Registered office address' },
  companyEmail: { short: 'Company email' },
  classUnder139_2: { short: 'Class of company under section 139(2)', help: 'Section 139(2) (with Rule 5) makes some companies rotate their auditors: listed companies and larger unlisted companies. Answer Yes if this company is one of them. Most small private companies answer No. This is your professional call, so it is never pre-filled.' },
  natureOfAppointment: { short: 'Nature of appointment', help: 'What kind of appointment is this? The "What are you filing?" cards above set this for you.' },
  appointedInAgm: { short: 'Appointed at an AGM?', help: 'Yes if the shareholders appointed the auditor at an Annual General Meeting. Boards fill a casual vacancy or appoint a first auditor, so those are normally not AGM appointments. MCA often answers this itself, so you can leave it blank.', hint: '' },
  natureOfAppointmentOther: { short: 'What "Others" means' },
  agmDate: { short: 'Date of AGM', help: 'Date of the Annual General Meeting that appointed the auditor. Leave blank if there was no AGM.', hint: '', quick: true, sameAs: ['dateOfAppointment', 'resolutionDate'] },
  dateOfAppointment: { short: 'Date of appointment', help: 'The date the appointment takes effect: usually the date of the AGM or of the Board meeting. Some appointment types do not show this on MCA, so a blank answer is simply skipped.', hint: '', quick: true, sameAs: ['agmDate', 'resolutionDate'] },
  jointAuditors: { short: 'Joint auditors?', help: 'Yes only if two or more auditors (or firms) are appointed to audit together. Normally No.' },
  numAuditorsAppointed: { short: 'Number of auditors', help: 'How many auditors or firms this filing appoints. Normally 1.' },
  auditorCategory: { short: 'Category of auditor', help: "Choose Auditor's Firm when a CA firm (partnership, LLP or proprietorship with a firm registration number) is appointed. Choose Individual when a practising CA is appointed in their own name." },
  within20CompaniesLimit: { short: 'Within the 20-company limit?', help: 'Section 141(3)(g): one person may be auditor of at most 20 companies (some small and dormant companies do not count). Answer Yes if this appointment keeps the auditor within that limit. Your decision, so it is never pre-filled.' },
  previouslyAudited: { short: 'Audited this company before?', help: 'Rule 6: has this auditor, the firm or one of its partners audited this company in an earlier year? Yes opens the "Prior appointments" section. A first appointment is No.', hint: '' },
  auditCommitteeRecommendation: { short: 'Audit Committee recommendation', help: "Section 177: if the company has an Audit Committee, did the Board consider its recommendation before appointing the auditor? Choose Not Applicable if there is no Audit Committee. Your decision, so it is never pre-filled." },
  _priorAppointed: { short: 'Appointed before' },
  firmRegistrationNumber: { short: 'Firm Registration Number', help: 'The ICAI firm registration number (FRN), for example 018971S.' },
  firmName: { short: "Firm's name" },
  firmPan: { short: "Firm's PAN" },
  membershipNumber: { short: 'Membership number', help: 'ICAI membership number of the person who signs the balance sheet (the partner, or the individual auditor).', ph: 'e.g. 235818' },
  auditorName: { short: "Signing auditor's name" },
  auditorPan: { short: "Signing auditor's PAN" },
  periodFrom: { short: 'Period of account: from', help: 'Pick a financial year with the picker above, or type the dates.' },
  periodTo: { short: 'Period of account: to' },
  numFinancialYears: { short: 'Number of financial years', help: 'How many financial years the appointment covers. We suggest it from the period dates; change it if yours differs.' },
  numPriorFinancialYears: { short: 'Years of prior appointment' },
  priorRow1FirmReg: { short: 'Prior firm registration number' },
  priorRow1Membership: { short: 'Prior auditor membership number' },
  priorRow1FyStart: { short: 'Prior year start' },
  priorRow1FyEnd: { short: 'Prior year end' },
  inc28Srn: { short: 'INC-28 SRN', help: 'The Service Request Number (SRN) you received when the Tribunal order was filed in Form INC-28.' },
  casualVacancyReason: { short: 'Reason for the vacancy' },
  casualVacancyOtherReason: { short: 'Other reason' },
  relevantFormSrn: { short: 'SRN of the earlier form', help: 'The Service Request Number (SRN) of the earlier filing that reported the vacancy (ADT-3, Form 23B or GNL-2).' },
  casualVacancyDate: { short: 'Date of casual vacancy', quick: true },
  vacatedFirmRegNumber: { short: 'Registration number of the outgoing firm' },
  vacatingAuditorMembership: { short: 'Membership number of the outgoing auditor' },
  casualVacancyReasonText: { short: 'Reasons for the vacancy' },
  resolutionNumber: { short: 'Board resolution number' },
  resolutionDate: { short: 'Board resolution date', quick: true, sameAs: ['dateOfAppointment', 'agmDate'] },
  signatoryDesignation: { short: "Signatory's designation" },
  signatoryIdentifier: { short: "Signatory's DIN / PAN / membership number" }
};
const ADT1_SECTION_EXTRA = {
  company: { short: 'Company', plain: 'Which company is this filing for?' },
  appointment: { short: 'Appointment', plain: 'What was decided, and a few Yes/No answers MCA asks.' },
  firm: { short: 'Firm', plain: "The auditor's firm: registration number, PAN, address and email." },
  auditor: { short: 'Signing auditor', plain: 'The person who signs the balance sheet, and the period the appointment covers.' },
  prior: { short: 'Prior appointments', plain: 'Only for an auditor who has audited this company before.' },
  tribunal: { short: 'Tribunal order', plain: 'The INC-28 reference for the Tribunal order.' },
  vacancy: { short: 'Casual vacancy', plain: 'Why the seat fell vacant, and who left.' },
  declaration: { short: 'Declaration', plain: 'Board resolution and the person signing. Optional here: the extension does not fill this step.' }
};
const ADT1_FIELD_LIST = ADT1_SECTIONS.flatMap(s => s.fields.map(f => Object.assign({ section: s.id, decl: !!s.decl }, f, ADT1_FIELD_EXTRA[f.key] || {})));
ADT1_SECTIONS.forEach(s => Object.assign(s, ADT1_SECTION_EXTRA[s.id] || {}));
const ADT1_FIELD_BY_KEY = Object.fromEntries(ADT1_FIELD_LIST.map(f => [f.key, f]));
const ADT1_DATA_KEYS = ADT1_FIELD_LIST.filter(f => f.type !== 'check').map(f => f.key);
const ADT1_DATE_KEYS = ADT1_FIELD_LIST.filter(f => f.type === 'date').map(f => f.key);

function adt1BlankState() {
  const s = {};
  for (const k of ADT1_DATA_KEYS) s[k] = '';
  s._priorAppointed = false;
  return s;
}

const adt1Str = v => (v == null ? '' : String(v)).trim();

// "2026-09-30" -> "30/09/2026"; an already-DD/MM/YYYY value passes through; anything else -> ''.
function adt1ToDMY(v) {
  const s = adt1Str(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return adt1RealDate(+m[1], +m[2], +m[3]) ? `${m[3]}/${m[2]}/${m[1]}` : '';
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (m) return adt1RealDate(+m[3], +m[2], +m[1]) ? s : '';
  return '';
}
// "30/09/2026" -> "2026-09-30"; ISO passes through; anything else -> ''.
function adt1ToISO(v) {
  const dmy = adt1ToDMY(v);
  if (!dmy) return '';
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy);
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function adt1RealDate(y, mo, d) {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

// Which conditional groups apply for this state. Hidden groups keep their typed values in the
// state (so toggling back restores them) but are NOT validated and NOT sent.
function adt1Active(st) {
  // A re-appointment always asks for the tenure of the previous appointment(s) (seen on the live page),
  // and 4(l) = Yes opens the block. Otherwise the tick-box or a typed count opens it, unless 4(l) is an
  // explicit No: that answer closes the block (its typed values stay in the state, hidden and not sent).
  const saidNo = st.previouslyAudited === 'No';
  const prior = st.natureOfAppointment === ADT1_NATURE_REAPPOINT || st.previouslyAudited === 'Yes'
    || (!saidNo && (!!st._priorAppointed || adt1Str(st.numPriorFinancialYears) !== ''));
  return {
    firm: st.auditorCategory === ADT1_CAT_FIRM,
    prior,
    tribunal: st.natureOfAppointment === ADT1_NATURE_TRIBUNAL,
    vacancy: st.natureOfAppointment === ADT1_NATURE_CASUAL
  };
}
function adt1SectionActive(id, st) {
  const a = adt1Active(st);
  return id === 'firm' ? a.firm : id === 'prior' ? a.prior : id === 'tribunal' ? a.tribunal : id === 'vacancy' ? a.vacancy : true;
}
function adt1FieldActive(f, st) {
  return adt1SectionActive(f.section, st) && (!f.when || !!f.when(st));
}

// Identifier fields (CIN, PAN, SRN, FRN and other upper-case codes) never carry spaces or symbols:
// strip them the way the typing path does, so a pasted, imported or extracted value is judged and
// sent in the same shape. Other fields are returned as they are.
function adt1TidyId(f, v) {
  v = String(v == null ? '' : v);
  if (f.fmt === 'cin' || f.fmt === 'pan' || f.fmt === 'srn') return v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (f.upper) return v.toUpperCase().replace(/\s/g, '');
  return v;
}

// The flat object the extension stores as mcaFormData_adt1. Field order follows adt1.js.
function buildAdt1FormData(st) {
  const out = {};
  for (const f of ADT1_FIELD_LIST) {
    if (f.type === 'check' || !adt1FieldActive(f, st)) continue;
    let v = f.type === 'date' ? adt1ToDMY(st[f.key]) : adt1Str(st[f.key]);
    if (f.fmt === 'cin' || f.fmt === 'pan' || f.fmt === 'srn' || f.upper) v = adt1TidyId(f, v);
    if (v !== '') out[f.key] = v;
  }
  return out;
}

function adt1ClientInfo(st) {
  const cin = adt1Str(st.cin).toUpperCase();
  const to = adt1ToISO(st.periodTo);
  const base = cin || adt1Str(st.companyName).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'new';
  const id = ('adt1_' + base + (to ? '_' + to.slice(0, 4) : '')).toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const label = adt1Str(st.companyName) || cin || 'New ADT-1 client';
  return { id, name: `${label} — ADT-1 auditor appointment`, cin, source: 'dashboard' };
}
function buildAdt1Envelope(st) {
  return { formType: 'adt1', clientInfo: adt1ClientInfo(st), formData: buildAdt1FormData(st) };
}

// A complete re-appointment of a firm that passes every dashboard check and answers everything MCA
// requires on the first two steps, so a test run can go Phase 1 -> Phase 2 -> Save -> Next without
// anything left to answer by hand. Company, firm and signing-auditor identity come from the bundled
// Lessonboard client; the auditor PAN, e-mails and the auditor's address are PLACEHOLDERS (marked
// SAMPLE) that must be replaced with real ones before anything is filed.
const ADT1_SAMPLE_FORMDATA = {
  cin: 'U80904KA2018PTC119370',
  classUnder139_2: 'No',
  natureOfAppointment: 'Re-appointment of Auditors in AGM',
  agmDate: '30/09/2026',
  dateOfAppointment: '30/09/2026',
  jointAuditors: 'No',
  numAuditorsAppointed: '1',
  auditorCategory: "Auditor's Firm",
  within20CompaniesLimit: 'Yes',
  auditCommitteeRecommendation: 'Not Applicable',
  firmRegistrationNumber: '018971S',
  firmName: 'Jain S A K and Co',
  firmPan: 'AAOFJ5797P',
  firmAddr1: 'S3, 2nd Floor White House',
  firmAddr2: 'St Marks Road, Bangalore',
  firmPin: '560001',
  firmEmail: 'sample.firm@example.com',
  membershipNumber: '235818',
  auditorName: 'Sumit Jain',
  auditorPan: 'ABCPJ1234K',
  auditorAddr1: 'S3, 2nd Floor White House',
  auditorAddr2: 'St Marks Road, Bangalore',
  auditorPin: '560001',
  auditorEmail: 'sample.auditor@example.com',
  periodFrom: '01/04/2025',
  periodTo: '31/03/2026',
  numFinancialYears: '1',
  numPriorFinancialYears: '1',
  priorRow1FirmReg: '018971S',
  priorRow1Membership: '235818',
  priorRow1FyStart: '01/04/2024',
  priorRow1FyEnd: '31/03/2025',
  resolutionNumber: '04',
  resolutionDate: '30/09/2026',
  signatoryDesignation: 'Director',
  signatoryIdentifier: '08302207'
};
function adt1SampleState() {
  const { state } = adt1StateFromJson({ formType: 'adt1', formData: ADT1_SAMPLE_FORMDATA });
  state.companyName = 'SAMPLE — Lessonboard Edu Solutions Private Limited';   // label only: not sent to MCA, which fills the real name
  return state;
}

// Accepts the downloaded envelope {formType, clientInfo, formData} or a flat formData object.
// Returns { state, ignored:[...] } — `ignored` lists values dropped because they are not a valid
// option for a dropdown field. Throws Error on something that is clearly not ADT-1 data.
function adt1StateFromJson(json) {
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('not a JSON object');
  if (json.formType && json.formType !== 'adt1') throw new Error(`this file is for "${json.formType}", not ADT-1`);
  const data = json.formData && typeof json.formData === 'object' ? json.formData : json;
  const st = adt1BlankState();
  const ignored = [];
  let known = 0;
  for (const f of ADT1_FIELD_LIST) {
    if (f.type === 'check' || !Object.prototype.hasOwnProperty.call(data, f.key)) continue;
    const raw = data[f.key];
    if (raw == null || typeof raw === 'object') continue;
    known++;
    if (f.type === 'date') {
      const iso = adt1ToISO(raw);
      if (iso) st[f.key] = iso; else if (adt1Str(raw)) ignored.push(f.key);
    } else if (f.type === 'select' && f.opts) {
      const hit = f.opts.find(o => o.toLowerCase() === adt1Str(raw).toLowerCase());
      if (hit) st[f.key] = hit; else if (adt1Str(raw)) ignored.push(f.key);
    } else {
      // Codes such as the CIN or a PAN lose their spaces and symbols here, as they would when typed.
      st[f.key] = adt1TidyId(f, adt1Str(raw));
    }
  }
  if (!known) throw new Error('no ADT-1 fields found (expected keys like cin, natureOfAppointment, auditorCategory)');
  st._priorAppointed = adt1Str(st.numPriorFinancialYears) !== '' || ['priorRow1FirmReg', 'priorRow1Membership', 'priorRow1FyStart', 'priorRow1FyEnd'].some(k => st[k] !== '');
  return { state: st, ignored };
}

// errors block sending, warnings do not. Each issue: { path: field key, msg, kind: 'required'|'format'|'logic' }.
function validateAdt1(st) {
  const errors = [], warnings = [];
  const issue = (list, path, msg, kind) => list.push({ path, msg, kind: kind || 'format' });
  const val = k => adt1Str(st[k]);
  // Messages name the field the way the screen does ("Firm — Email ID (4(f))") so they read the same
  // inline, in the checklist and on the Review panel.
  const label = k => adt1FieldName(k) + adt1FieldRefSuffix(k);

  for (const f of ADT1_FIELD_LIST) {
    if (f.type === 'check' || !adt1FieldActive(f, st)) continue;
    const v = f.type === 'date' ? adt1ToDMY(st[f.key]) : val(f.key);
    const raw = val(f.key);
    if (raw === '') {
      if (f.req) {
        const ask = f.type === 'select' ? 'Please choose an answer for' : f.type === 'date' ? 'Please pick a date for' : 'Please fill in';
        issue(f.decl ? warnings : errors, f.key, f.decl
          ? `${ask} ${label(f.key)}. (Declaration step: the extension does not fill it, so this does not block sending.)`
          : `${ask} ${label(f.key)}.`, 'required');
      }
      continue;
    }
    if (f.type === 'date' && !v) { issue(errors, f.key, `${label(f.key)} is not a valid date. Use the date picker, or type it as DD/MM/YYYY.`); continue; }
    const u = raw.toUpperCase();
    // A pasted, imported or extracted code with spaces or symbols in it: say so plainly instead of
    // judging the raw text against the pattern (which would call a CIN with a space in it "right").
    const tidy = adt1TidyId(f, u);
    if (tidy !== u) {
      issue(f.fmt === 'srn' ? warnings : errors, f.key, tidy
        ? `${label(f.key)} has spaces or symbols in it. Please remove them so it reads ${tidy}.`
        : `${label(f.key)} has only spaces or symbols in it. Please type the value.`);
      continue;
    }
    if (f.fmt === 'cin' && !ADT1_RE.cin.test(u)) issue(errors, f.key, adt1CinStatus(u).msg);
    if (f.fmt === 'pan' && !ADT1_RE.pan.test(u)) issue(errors, f.key, `${label(f.key)} should be 10 characters: 5 letters, 4 digits, 1 letter (for example AAAAA9999A).`);
    if (f.fmt === 'pin' && !ADT1_RE.pin.test(raw)) issue(errors, f.key, `${label(f.key)} should be exactly 6 digits.`);
    if (f.fmt === 'int' && !ADT1_RE.int.test(raw)) issue(errors, f.key, `${label(f.key)} should be a whole number (digits only).`);
    if (f.fmt === 'int' && ADT1_RE.int.test(raw) && Number(raw) < 1 && f.key !== 'numPriorFinancialYears') issue(errors, f.key, `${label(f.key)} must be at least 1.`);
    if (f.fmt === 'email' && !ADT1_RE.email.test(raw)) issue(warnings, f.key, `${label(f.key)} does not look like an email address (name@example.com).`);
    if (f.fmt === 'srn' && !ADT1_RE.srn.test(u)) issue(warnings, f.key, `${label(f.key)} usually looks like F12345678: a letter followed by digits.`);
  }

  // Cross-field checks (only for groups that apply).
  const a = adt1Active(st);
  const pf = adt1ToISO(st.periodFrom), pt = adt1ToISO(st.periodTo);
  if (pf && pt && pf >= pt) issue(errors, 'periodTo', 'Period of account: the "from" date must be earlier than the "to" date.', 'logic');
  if (a.prior) {
    const s = adt1ToISO(st.priorRow1FyStart), e = adt1ToISO(st.priorRow1FyEnd);
    if (s && e && s >= e) issue(errors, 'priorRow1FyEnd', 'Prior appointment: the financial year start must be earlier than its end date.', 'logic');
  }
  const n = ADT1_RE.int.test(val('numAuditorsAppointed')) ? Number(val('numAuditorsAppointed')) : null;
  if (n !== null && st.jointAuditors === 'Yes' && n < 2) issue(warnings, 'numAuditorsAppointed', 'You said joint auditors, but the number of auditors is less than 2. Please check both answers.', 'logic');
  if (n !== null && st.jointAuditors === 'No' && n > 1) issue(warnings, 'numAuditorsAppointed', 'You said no joint auditors, but the number of auditors is more than 1. Please check both answers.', 'logic');
  if (!val('dateOfAppointment')) issue(warnings, 'dateOfAppointment', 'Date of appointment (4(a)) is blank. That is fine if MCA does not ask for it for this kind of appointment; otherwise answer it on MCA.', 'required');
  if (/AGM/.test(val('natureOfAppointment')) && !val('agmDate')) issue(warnings, 'agmDate', 'This appointment is made at an AGM, but the date of the AGM is blank.', 'required');
  if (val('natureOfAppointment') === ADT1_NATURE_OTHERS && !val('natureOfAppointmentOther')) issue(warnings, 'natureOfAppointmentOther', 'You chose "Others" for the nature of appointment: please say in a few words what it is (3(b)(i)).', 'required');
  if (st.auditorCategory === ADT1_CAT_INDIVIDUAL) issue(warnings, 'auditorCategory', "Category is Individual, so the firm details (4(e)/(f)) are not needed and will not be sent.", 'logic');

  // Declaration identifier: DIN for a Director.
  const ident = val('signatoryIdentifier');
  if (st.signatoryDesignation === 'Director' && ident && !ADT1_RE.din.test(ident)) issue(errors, 'signatoryIdentifier', 'For a Director, the signatory identifier must be the 8-digit DIN.');

  return { errors, warnings };
}

/* ───────── 1b. Friendly helpers (pure: no DOM, unit-tested) ───────── */

// ---- Field names for messages and tables ----
// "4(f)(i) PAN of the auditor's firm" -> ref "4(f)(i)", rest "PAN of the auditor's firm".
function adt1FieldParts(f) {
  const m = /^((?:\d+(?:\([a-z]+\))*\.?)|(?:\([a-z]\)))\s+([\s\S]*)$/i.exec(f.label || '');
  return m ? { ref: m[1].replace(/\.$/, ''), rest: m[2] } : { ref: '', rest: f.label || '' };
}
// A short, human name. The firm and the signing auditor share labels such as "Email ID": say whose it is.
function adt1FieldName(key) {
  const f = ADT1_FIELD_BY_KEY[key];
  if (!f) return key;
  const base = f.short || adt1FieldParts(f).rest;
  if (/^(Address|Country|Pin|Area|City|District|State|Email)/.test(f.label)) return (f.section === 'firm' ? 'Firm — ' : f.section === 'auditor' ? 'Auditor — ' : '') + base;
  return base;
}
function adt1FieldRefSuffix(key) {
  const f = ADT1_FIELD_BY_KEY[key];
  const ref = f ? adt1FieldParts(f).ref : '';
  return !ref ? '' : /\(/.test(ref) ? ` (${ref})` : ` (field ${ref})`;
}

// ---- Typing helpers: clean as you type, keep the caret where it was ----
// Character-wise filters only, so cleaning the text before the caret gives the new caret position.
function adt1CleanValue(f, v) {
  v = String(v == null ? '' : v);
  if (f.fmt === 'int') return v.replace(/\D/g, '').slice(0, 3);
  if (f.fmt === 'pin') return v.replace(/\D/g, '').slice(0, 6);
  if (f.fmt === 'cin') return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 21);
  if (f.fmt === 'pan') return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (f.fmt === 'srn') return v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (f.fmt === 'email') return v.replace(/\s/g, '');
  if (f.upper) return v.toUpperCase().replace(/\s/g, '');
  return v;
}
function adt1CleanWithCaret(f, raw, caret) {
  raw = String(raw == null ? '' : raw);
  const value = adt1CleanValue(f, raw);
  const c = caret == null ? value.length : Math.min(adt1CleanValue(f, raw.slice(0, Math.max(0, caret))).length, value.length);
  return { value, caret: c };
}

const ADT1_CIN_RULE = 'CIN has 21 characters: L or U, 5 digits, 2 letters, 4 digits, 3 letters, 6 digits.';
const ADT1_CIN_PARTS = [
  { n: 1, re: /[LU]/, what: 'L (listed) or U (unlisted)' },
  { n: 5, re: /\d/, what: '5 digits (industry code)' },
  { n: 2, re: /[A-Z]/, what: '2 letters (state code)' },
  { n: 4, re: /\d/, what: '4 digits (year of incorporation)' },
  { n: 3, re: /[A-Z]/, what: '3 letters (company type)' },
  { n: 6, re: /\d/, what: '6 digits (registration number)' }
];
// Instant, plain-language check of a CIN while it is typed or pasted.
// state: empty | typing | bad | ok.  msg is always safe to show to the user.
function adt1CinStatus(raw) {
  const v = String(raw == null ? '' : raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!v) return { state: 'empty', len: 0, msg: ADT1_CIN_RULE + ' You can paste it.' };
  let pos = 0;
  for (const p of ADT1_CIN_PARTS) {
    const start = pos;
    for (let i = 0; i < p.n; i++, pos++) {
      if (pos >= v.length) return { state: 'typing', len: v.length, msg: `${v.length} of 21 characters so far. Next: ${p.what}.` };
      if (!p.re.test(v[pos])) {
        const where = p.n === 1 ? `Character ${start + 1}` : `Characters ${start + 1}–${start + p.n}`;
        return { state: 'bad', len: v.length, msg: `${where} should be ${p.what}. ${ADT1_CIN_RULE}` };
      }
    }
  }
  if (v.length > 21) return { state: 'bad', len: v.length, msg: `That is ${v.length} characters; a CIN has exactly 21. ${ADT1_CIN_RULE}` };
  return { state: 'ok', len: 21, msg: `CIN looks right: ${v[0] === 'L' ? 'listed' : 'unlisted'} company, state code ${v.slice(6, 8)}, incorporated in ${v.slice(8, 12)}.` };
}

// ---- Financial-year helpers ----
const adt1Pad2 = n => String(n).padStart(2, '0');
function adt1FyLabel(startYear) { return `FY ${startYear}-${adt1Pad2((startYear + 1) % 100)}`; }
// Whole financial years starting 1 April of startYear.
function adt1FyRange(startYear, years) {
  const n = Math.max(1, Math.floor(Number(years)) || 1);
  return { from: `${startYear}-04-01`, to: `${startYear + n}-03-31` };
}
// { startYear, years } when from/to are exactly whole financial years (1 Apr .. 31 Mar), else null.
function adt1FyOfRange(from, to) {
  const f = adt1ToISO(from), t = adt1ToISO(to);
  const mf = /^(\d{4})-04-01$/.exec(f), mt = /^(\d{4})-03-31$/.exec(t);
  if (!mf || !mt) return null;
  const years = +mt[1] - +mf[1];
  return years >= 1 ? { startYear: +mf[1], years } : null;
}
// The financial years a filer is most likely to need (next year, this year, and three back).
function adt1FyOptions(now) {
  const d = now instanceof Date ? now : new Date(now || Date.now());
  const cur = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return [cur + 1, cur, cur - 1, cur - 2, cur - 3].map(y => ({ startYear: y, label: adt1FyLabel(y) }));
}
// A new company's first year: starts on the incorporation date and runs to the next 31 March. A stub
// shorter than 3 months is extended to the following 31 March (a first year may run up to 18 months).
function adt1FirstYearRange(start) {
  const f = adt1ToISO(start);
  if (!f) return null;
  const y = +f.slice(0, 4);
  let to = f <= `${y}-03-31` ? `${y}-03-31` : `${y + 1}-03-31`;
  const days = (Date.parse(to) - Date.parse(f)) / 86400000;
  if (days < 92) to = `${+to.slice(0, 4) + 1}-03-31`;
  return { from: f, to };
}
// Suggested "number of financial years" from the period dates, or null when it is not clear.
function adt1SuggestNumFY(from, to) {
  const f = adt1ToISO(from), t = adt1ToISO(to);
  if (!f || !t || f >= t) return null;
  const whole = adt1FyOfRange(f, t);
  if (whole) return whole.years;
  const days = (Date.parse(t) - Date.parse(f)) / 86400000;
  return days <= 548 ? 1 : null;   // a first period may run up to 18 months and still counts as one year
}

// ---- Quick date buttons ----
const ADT1_QUICK_NAMES = { agmDate: 'AGM date', dateOfAppointment: 'appointment date', resolutionDate: 'resolution date' };
// [{label, value(ISO)}]: "Today" plus "Same as ..." for related dates that are already filled in.
function adt1QuickDates(st, key, todayISO) {
  const f = ADT1_FIELD_BY_KEY[key];
  if (!f || f.type !== 'date' || !f.quick) return [];
  const out = [];
  if (todayISO && adt1ToISO(st[key]) !== todayISO) out.push({ label: 'Today', value: todayISO });
  for (const src of f.sameAs || []) {
    const v = adt1ToISO(st[src]);
    if (v && v !== adt1ToISO(st[key])) out.push({ label: 'Same as ' + (ADT1_QUICK_NAMES[src] || src), value: v });
  }
  return out;
}

// ---- Copy between the firm and the signing auditor ----
const ADT1_PARTY_FIELDS = ['Addr1', 'Addr2', 'Country', 'Pin', 'Area', 'City', 'District', 'State', 'Email'];
// from/to: 'firm' | 'auditor'. Copies the address and email (and the PAN when opts.pan: a sole
// proprietor's firm PAN is the proprietor's own PAN). Blank source values never wipe the target.
function adt1CopyParty(st, from, to, opts) {
  const next = Object.assign({}, st), copied = [];
  const pairs = ADT1_PARTY_FIELDS.map(s => [from + s, to + s]);
  if (opts && opts.pan) pairs.push([from + 'Pan', to + 'Pan']);
  for (const [a, b] of pairs) {
    const v = adt1Str(st[a]);
    if (v && v !== adt1Str(st[b])) { next[b] = st[a]; copied.push(b); }
  }
  return { state: next, copied };
}

// ---- What are you filing? scenarios ----
// `set` holds only values that follow with certainty from the choice. 3(a), 4(k) and 5 are never touched.
const ADT1_PRIOR_KEYS = ['numPriorFinancialYears', 'priorRow1FirmReg', 'priorRow1Membership', 'priorRow1FyStart', 'priorRow1FyEnd'];
const ADT1_SCENARIOS = [
  { id: 'first', title: 'First auditor', blurb: 'A new company: its first auditor is appointed by the Board (or members, or the C&AG).', nature: ADT1_NATURE_OPTIONS[0],
    set: { previouslyAudited: 'No' }, prior: false,
    next: 'MCA will ask for the date of appointment, the firm and the signing auditor. A first auditor has no earlier tenure, so the Prior appointments section is not needed.' },
  { id: 'agm', title: 'Appointment at the AGM', blurb: 'Shareholders appoint an auditor at the Annual General Meeting.', nature: ADT1_NATURE_OPTIONS[1],
    set: { appointedInAgm: 'Yes' },
    next: 'MCA will ask for the AGM date, the firm and the signing auditor. If this auditor (or the firm) has audited the company before, also answer 4(l) and fill the Prior appointments section.' },
  { id: 'reappoint', title: 'Re-appointment at the AGM', blurb: 'The same auditor is re-appointed at the AGM.', nature: ADT1_NATURE_REAPPOINT,
    set: { appointedInAgm: 'Yes', previouslyAudited: 'Yes' }, prior: true,
    next: 'MCA will ask for the AGM date, the firm and the signing auditor, and how long the auditor served before (4(n) to 4(s)). We opened the Prior appointments section for you.' },
  { id: 'casual', title: 'Casual vacancy', blurb: 'The seat fell vacant (resignation, death, disqualification) and a new auditor fills it.', nature: ADT1_NATURE_CASUAL,
    set: {},
    next: 'MCA will also ask why the seat fell vacant (field 7): the earlier form\'s SRN, the date, and the outgoing auditor. We opened the Casual vacancy section.' },
  { id: 'tribunal', title: 'Appointed by the Tribunal', blurb: 'The Tribunal (NCLT) ordered the appointment.', nature: ADT1_NATURE_TRIBUNAL,
    set: {},
    next: 'MCA will also ask for the SRN of the INC-28 filing of the Tribunal order (field 6). We opened the Tribunal order section.' },
  { id: 'others', title: 'Something else', blurb: 'None of these fits: describe it in your own words.', nature: ADT1_NATURE_OTHERS,
    set: {},
    next: 'Say in a few words what the appointment is (3(b)(i)). MCA decides what else it needs, and the extension tells you what is left.' },
  { id: 'cag', more: true, title: 'By the C&AG', blurb: 'Government company: the Comptroller and Auditor General appoints.', nature: ADT1_NATURE_OPTIONS[3], set: {},
    next: 'MCA will ask for the firm and the signing auditor. Check what else it shows for a C&AG appointment.' },
  { id: 'removal', more: true, title: 'Previous auditor not re-appointed / removed', blurb: 'A new auditor replaces one who was not re-appointed or was removed.', nature: ADT1_NATURE_OPTIONS[5], set: {},
    next: 'MCA will ask for the firm and the signing auditor. Check what else it shows for this kind of appointment.' },
  { id: 'central', more: true, title: 'By the Central Government', blurb: 'The Central Government appointed the auditor.', nature: ADT1_NATURE_OPTIONS[7], set: {},
    next: 'MCA will ask for the firm and the signing auditor. Check what else it shows for this kind of appointment.' }
];
function adt1ScenarioOf(st) {
  const n = adt1Str(st && st.natureOfAppointment);
  const s = ADT1_SCENARIOS.find(x => x.nature === n);
  return s ? s.id : '';
}
// Returns { state, changed:[keys], scenario } — a new state; the input is not modified.
// prev ({ id, changed? }: the card chosen before, as adt1ScenarioNote records it) lets a new card
// clear the answers the earlier card pre-filled (3(c), 4(l)), but only while they still hold what
// that card wrote and the new card does not set them itself: an answer the user changed is kept.
// Without prev.changed every answer in the earlier card's `set` is treated as pre-filled.
function adt1ApplyScenario(st, id, prev) {
  const sc = ADT1_SCENARIOS.find(x => x.id === id);
  if (!sc) return { state: st, changed: [], scenario: null };
  const next = Object.assign({}, st), changed = [];
  const put = (k, v) => { if (next[k] !== v) { next[k] = v; changed.push(k); } };
  const old = prev && prev.id && prev.id !== id ? ADT1_SCENARIOS.find(x => x.id === prev.id) : null;
  if (old) {
    const wrote = Array.isArray(prev.changed) ? prev.changed : Object.keys(old.set);
    for (const [k, v] of Object.entries(old.set)) if (wrote.includes(k) && !(k in sc.set) && next[k] === v) put(k, '');
    if (old.prior === true && sc.prior !== true && next._priorAppointed) next._priorAppointed = false;
  }
  put('natureOfAppointment', sc.nature);
  for (const [k, v] of Object.entries(sc.set)) put(k, v);
  if (sc.prior === true) { if (!next._priorAppointed) { next._priorAppointed = true; } }
  if (sc.prior === false) {
    next._priorAppointed = false;
    for (const k of ADT1_PRIOR_KEYS) if (adt1Str(next[k]) !== '') put(k, '');
  }
  return { state: next, changed, scenario: sc };
}

// ---- Saved auditor profiles (firm + signing auditor details) ----
const ADT1_PROFILE_KEYS = ['auditorCategory'].concat(
  ['firmRegistrationNumber', 'firmName', 'firmPan'], ADT1_PARTY_FIELDS.map(s => 'firm' + s),
  ['membershipNumber', 'auditorName', 'auditorPan'], ADT1_PARTY_FIELDS.map(s => 'auditor' + s));
function adt1ProfileHasData(st) { return ADT1_PROFILE_KEYS.some(k => k !== 'auditorCategory' && adt1Str(st[k]) !== ''); }
function adt1ProfileFromState(st, name, id, now) {
  const data = {};
  for (const k of ADT1_PROFILE_KEYS) { const v = adt1Str(st[k]); if (v !== '') data[k] = v; }
  const nm = adt1Str(name) || adt1Str(st.firmName) || adt1Str(st.auditorName) || 'Auditor profile';
  return { id: id || 'p_' + (now || Date.now()).toString(36), name: nm, savedAt: now || Date.now(), data };
}
function adt1ProfileSummary(p) {
  const d = (p && p.data) || {};
  return [d.firmName, d.auditorName].filter(Boolean).join(' · ') || 'No details';
}
// Fills only what the profile holds; everything else in the form stays. Returns { state, applied:[keys] }.
function adt1ApplyProfile(st, profile) {
  const next = Object.assign({}, st), applied = [];
  const d = (profile && profile.data) || {};
  for (const k of ADT1_PROFILE_KEYS) {
    const v = adt1Str(d[k]);
    if (v === '') continue;
    if (k === 'auditorCategory' && ![ADT1_CAT_FIRM, ADT1_CAT_INDIVIDUAL].includes(v)) continue;
    if (adt1Str(next[k]) !== v) { next[k] = v; applied.push(k); }
  }
  return { state: next, applied };
}
// Same id replaces; the same name (any case) replaces too. Sorted by name.
function adt1ProfilesUpsert(list, profile) {
  const keep = (list || []).filter(p => p.id !== profile.id && String(p.name).toLowerCase() !== String(profile.name).toLowerCase());
  return keep.concat([profile]).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
function adt1ProfilesRename(list, id, name) {
  const nm = adt1Str(name);
  if (!nm) return list || [];
  const clash = (list || []).some(p => p.id !== id && String(p.name).toLowerCase() === nm.toLowerCase());
  if (clash) return list;
  return (list || []).map(p => p.id === id ? Object.assign({}, p, { name: nm }) : p).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
function adt1ProfilesRemove(list, id) { return (list || []).filter(p => p.id !== id); }

// ---- Saved drafts ("clients") ----
const ADT1_DRAFT_PREFIX = 'adt1_draft_';
function adt1HasContent(st) { return ADT1_DATA_KEYS.some(k => adt1Str(st && st[k]) !== ''); }
// "FY 2025-26" for one whole financial year, else "01/04/2025 to 31/03/2030", else ''.
function adt1PeriodLabel(st) {
  const f = adt1ToISO(st.periodFrom), t = adt1ToISO(st.periodTo);
  if (!f && !t) return '';
  const fy = adt1FyOfRange(f, t);
  if (fy && fy.years === 1) return adt1FyLabel(fy.startYear);
  const a = adt1ToDMY(f), b = adt1ToDMY(t);
  return a && b ? `${a} to ${b}` : (a || b);
}
function adt1DraftLabel(st) {
  const who = adt1Str(st.firmName) || adt1Str(st.auditorName);
  const name = adt1Str(st.companyName) || adt1Str(st.cin).toUpperCase() || (who ? `${who} (company not entered yet)` : 'Unnamed client');
  const per = adt1PeriodLabel(st);
  return per ? `${name} — ${per}` : name;
}
// The storage key for a draft. A valid CIN + period year gives a stable, readable key; a draft
// without a valid CIN keeps whatever key it has (or gets a unique one). An existing different draft
// is never overwritten: not when a draft is renamed by editing its CIN/period, and not when a new,
// unsaved client (currentKey null) turns out to have the same CIN + year as a saved one (it gets a
// _2 suffix instead). opts.unique forces a fresh key.
function adt1PickDraftKey(st, currentKey, existingKeys, opts) {
  opts = opts || {};
  const existing = new Set(existingKeys || []);
  const cin = adt1Str(st.cin).toUpperCase();
  const stamp = String(opts.stamp || Date.now());
  if (!ADT1_RE.cin.test(cin)) return currentKey && !opts.unique ? currentKey : ADT1_DRAFT_PREFIX + 'new_' + stamp;
  const year = (adt1ToISO(st.periodTo) || adt1ToISO(st.periodFrom) || '').slice(0, 4) || 'noyear';
  const natural = `${ADT1_DRAFT_PREFIX}${cin.toLowerCase()}_${year}`;
  if (opts.unique || !currentKey) { let k = natural, n = 2; while (existing.has(k)) k = `${natural}_${n++}`; return k; }
  if (natural === currentKey) return natural;
  return existing.has(natural) ? currentKey : natural;
}
// entries: [{ key, value:{ state, _savedAt } }] -> newest first, only valid ADT-1 drafts.
function adt1SummarizeDrafts(entries) {
  return (entries || [])
    .filter(e => e && typeof e.key === 'string' && e.key.startsWith(ADT1_DRAFT_PREFIX) && e.value && typeof e.value.state === 'object' && e.value.state)
    .map(e => ({ key: e.key, label: adt1DraftLabel(e.value.state), savedAt: e.value._savedAt || 0 }))
    .sort((a, b) => b.savedAt - a.savedAt);
}
// A copy for the next filing: keeps who/what, clears dates, resolution and references that belong to one filing.
function adt1DuplicateState(st) {
  const next = Object.assign({}, st);
  for (const k of ['periodFrom', 'periodTo', 'numFinancialYears', 'agmDate', 'dateOfAppointment', 'resolutionNumber', 'resolutionDate', 'inc28Srn', 'relevantFormSrn', 'casualVacancyDate', 'casualVacancyReasonText', 'priorRow1FyStart', 'priorRow1FyEnd']) if (k in next) next[k] = '';
  return next;
}

// ---- Progress and the "what is still missing" checklist ----
const ADT1_NA_REASON = {
  firm: "Needed only when the category is Auditor's Firm",
  prior: 'Needed only for a re-appointment or an auditor who has audited the company before',
  tribunal: 'Needed only when the Tribunal appointed the auditor',
  vacancy: 'Needed only for a casual vacancy'
};
// status per section: done | todo | optional (Declaration, not filled by the extension) | na (not needed for this filing).
// total/done count REQUIRED answers outside the Declaration step; the Declaration is reported separately.
function adt1Progress(st, validation) {
  const v = validation || validateAdt1(st);
  const bad = k => v.errors.some(e => e.path === k && e.kind !== 'required');
  const sections = []; let total = 0, done = 0; const decl = { total: 0, done: 0 };
  for (const s of ADT1_SECTIONS) {
    const sec = { id: s.id, title: s.title, short: s.short || s.title, decl: !!s.decl, total: 0, done: 0, missing: [], errors: 0, status: 'na', reason: '' };
    if (!adt1SectionActive(s.id, st)) { sec.reason = ADT1_NA_REASON[s.id] || ''; sections.push(sec); continue; }
    for (const f of s.fields) {
      const ff = ADT1_FIELD_BY_KEY[f.key];
      if (ff.type === 'check' || !adt1FieldActive(ff, st) || !ff.req) continue;
      sec.total++;
      if (adt1Str(st[ff.key]) !== '' && !bad(ff.key)) sec.done++; else sec.missing.push(ff.key);
    }
    sec.errors = v.errors.filter(e => ADT1_FIELD_BY_KEY[e.path] && ADT1_FIELD_BY_KEY[e.path].section === s.id).length;
    const complete = sec.missing.length === 0 && sec.errors === 0;
    sec.status = complete ? 'done' : s.decl && sec.errors === 0 ? 'optional' : 'todo';
    if (s.decl) { decl.total += sec.total; decl.done += sec.done; } else { total += sec.total; done += sec.done; }
    sections.push(sec);
  }
  const sectionOf = k => (ADT1_FIELD_BY_KEY[k] || {}).section || '';
  const item = (m, severity) => ({ key: m.path, section: sectionOf(m.path), msg: m.msg, kind: m.kind, severity, decl: !!(ADT1_FIELD_BY_KEY[m.path] || {}).decl });
  return {
    total, done, pct: total ? Math.round(done / total * 100) : 0, decl, sections,
    ready: v.errors.length === 0, errorCount: v.errors.length,
    missing: v.errors.map(m => item(m, m.kind === 'required' ? 'todo' : 'error')),
    notes: v.warnings.map(m => item(m, 'warn'))
  };
}

// One line per section for a collapsed card.
function adt1SectionSummary(id, st) {
  const s = k => adt1Str(st[k]);
  const join = parts => parts.filter(Boolean).join(' · ');
  const per = () => { const a = adt1ToDMY(st.periodFrom), b = adt1ToDMY(st.periodTo); return a && b ? `${a} to ${b}` : ''; };
  switch (id) {
    case 'company': return join([s('cin').toUpperCase(), s('companyName')]);
    case 'appointment': return join([s('natureOfAppointment'), s('auditorCategory')]);
    case 'firm': return join([s('firmName'), s('firmRegistrationNumber').toUpperCase()]);
    case 'auditor': return join([s('auditorName'), s('membershipNumber') && 'M.No. ' + s('membershipNumber'), per()]);
    case 'prior': return join([s('numPriorFinancialYears') && s('numPriorFinancialYears') + ' year(s) before', s('priorRow1Membership') && 'M.No. ' + s('priorRow1Membership')]);
    case 'tribunal': return s('inc28Srn').toUpperCase();
    case 'vacancy': return join([s('casualVacancyReason'), adt1ToDMY(st.casualVacancyDate)]);
    case 'declaration': return join([s('resolutionNumber') && 'Resolution ' + s('resolutionNumber'), adt1ToDMY(st.resolutionDate), s('signatoryDesignation')]);
    default: return '';
  }
}

// ---- Plain-language summary and the "what the extension will fill" rows ----
const ADT1_SUMMARY_PHRASE = {
  [ADT1_NATURE_OPTIONS[0]]: who => `first auditor ${who}`,
  [ADT1_NATURE_OPTIONS[1]]: who => `appointment of ${who} at the AGM`,
  [ADT1_NATURE_OPTIONS[2]]: who => `re-appointment of ${who} at the AGM`,
  [ADT1_NATURE_OPTIONS[3]]: who => `${who} appointed by the C&AG`,
  [ADT1_NATURE_OPTIONS[4]]: who => `casual vacancy filled by ${who}`,
  [ADT1_NATURE_OPTIONS[5]]: who => `${who} replaces the previous auditor`,
  [ADT1_NATURE_OPTIONS[6]]: who => `${who} appointed by the Tribunal`,
  [ADT1_NATURE_OPTIONS[7]]: who => `${who} appointed by the Central Government`,
  [ADT1_NATURE_OPTIONS[8]]: who => `appointment of ${who}`
};
// "Germin8 Advisors Pvt Ltd — first auditor Jain Maneesh & Co, 23/03/2026 to 31/03/2027"
function adt1PlainSummary(st, opts) {
  const company = adt1Str(st.companyName) || adt1Str(opts && opts.companyName) || adt1Str(st.cin).toUpperCase() || 'This company';
  const who = (st.auditorCategory === ADT1_CAT_INDIVIDUAL ? adt1Str(st.auditorName) : adt1Str(st.firmName) || adt1Str(st.auditorName)) || 'an auditor (not named yet)';
  const phrase = (ADT1_SUMMARY_PHRASE[adt1Str(st.natureOfAppointment)] || (w => `appointment of ${w}`))(who);
  const a = adt1ToDMY(st.periodFrom), b = adt1ToDMY(st.periodTo);
  const per = a && b ? `, ${a} to ${b}` : '';
  return `${company} — ${phrase}${per}`;
}
// Rows for the review table: what the extension will type into MCA, in form order.
function adt1ReviewRows(st) {
  const data = buildAdt1FormData(st), rows = [];
  for (const s of ADT1_SECTIONS) {
    for (const f of s.fields) {
      const ff = ADT1_FIELD_BY_KEY[f.key];
      if (ff.type === 'check' || !(ff.key in data)) continue;
      rows.push({ section: s.id, sectionTitle: s.title, decl: !!s.decl, key: ff.key, label: adt1FieldName(ff.key), ref: adt1FieldParts(ff).ref, value: data[ff.key] });
    }
  }
  return rows;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ADT1_NATURE_OPTIONS, ADT1_DESIGNATIONS, ADT1_SECTIONS, ADT1_FIELD_LIST, ADT1_RE,
    adt1BlankState, adt1ToDMY, adt1ToISO, adt1Active, adt1SectionActive, adt1FieldActive,
    buildAdt1FormData, adt1ClientInfo, buildAdt1Envelope, adt1StateFromJson, validateAdt1,
    ADT1_SAMPLE_FORMDATA, adt1SampleState,
    adt1FieldName, adt1FieldParts, adt1CleanValue, adt1CleanWithCaret, adt1CinStatus, ADT1_CIN_RULE, adt1TidyId,
    adt1FyLabel, adt1FyRange, adt1FyOfRange, adt1FyOptions, adt1FirstYearRange, adt1SuggestNumFY, adt1QuickDates,
    adt1CopyParty, ADT1_SCENARIOS, adt1ScenarioOf, adt1ApplyScenario,
    ADT1_PROFILE_KEYS, adt1ProfileHasData, adt1ProfileFromState, adt1ProfileSummary, adt1ApplyProfile, adt1ProfilesUpsert, adt1ProfilesRename, adt1ProfilesRemove,
    adt1HasContent, adt1PeriodLabel, adt1DraftLabel, adt1PickDraftKey, adt1SummarizeDrafts, adt1DuplicateState,
    adt1Progress, adt1SectionSummary, adt1PlainSummary, adt1ReviewRows
  };
}

/* ───────────────────────── 2. Browser UI ───────────────────────── */

let adt1State = adt1BlankState();
const adt1Touched = new Set();   // fields the user has left once — "required" messages show only for these
let adt1SaveTimer = null;
let adt1ShowAll = false;         // "Check my answers" pressed: show every message, not only for visited fields
let adt1DraftKey = null;         // localStorage key of the draft on screen (null = not saved yet)
let adt1ForceUnique = false;     // next save must not overwrite another draft (sample / import / duplicate)
let adt1Open = {};               // section id -> open? (decided once per section, then by the user)
const adt1UserToggled = new Set();
let adt1Lookup = null;           // { cin, busy } | { cin, error } | { cin, data }
let adt1FirstYear = false;       // the FY picker is in "first year of a new company" mode
let adt1FirstStart = '';
let adt1ScenarioNote = null;     // { id, changed:[keys] } — what choosing a scenario filled in
let adt1ProfileSel = '', adt1ProfileName = '', adt1ProfOpen = false;
let adt1OpenInit = false;         // false until the first render of a freshly loaded client
let adt1MissOpen = null;         // null = automatic (open when the list is short)
const adt1Sig = {};              // last HTML per container: identical re-renders are skipped (keeps focus)

const adt1Id = k => 'ad_' + k;
const adt1TodayISO = () => { const d = new Date(); return `${d.getFullYear()}-${adt1Pad2(d.getMonth() + 1)}-${adt1Pad2(d.getDate())}`; };
const ADT1_CHECK_SVG = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
const ADT1_CHEV_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';

// Replace a container's HTML only when it changed, and put keyboard focus back on the same control.
function adt1SetHtml(el, key, html) {
  if (!el || adt1Sig[key] === html) return;
  adt1Sig[key] = html;
  const act = document.activeElement;
  const fk = act && el.contains(act) && act.dataset ? act.dataset.fk : '';
  el.innerHTML = html;
  if (fk) { const again = el.querySelector(`[data-fk="${fk}"]`); if (again && !again.disabled) again.focus({ preventScroll: true }); }
}

/* ── Fields and cards ── */

function adt1FieldHtml(f) {
  const id = adt1Id(f.key);
  const req = f.req ? ' <span class="req" aria-hidden="true">*</span><span class="sr-only"> (required)</span>' : '';
  const span = f.span ? ` span${f.span}` : '';
  const helpId = `adH_${f.key}`, hintId = `adHt_${f.key}`, errId = `adErr_${f.key}`;
  const ids = [f.help && helpId, f.hint && hintId, errId, f.fmt === 'cin' && 'adCinLive'].filter(Boolean).join(' ');
  const common = `id="${id}" data-key="${f.key}" aria-describedby="${ids}"${f.req ? ' aria-required="true"' : ''}`;
  if (f.type === 'check') {
    return `<div class="f${span}" id="adF_${f.key}"><label class="ad-check"><input type="checkbox" id="${id}" data-key="${f.key}"> <span>${esc(f.label)}</span></label></div>`;
  }
  let ctl;
  if (f.type === 'select') {
    ctl = `<select class="sel" ${common}><option value="">Choose…</option>${f.opts.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
  } else if (f.type === 'textarea') {
    ctl = `<textarea class="ta" ${common} rows="2"></textarea>`;
  } else if (f.type === 'date') {
    ctl = `<input class="in" type="date" ${common}>${f.quick ? `<div class="ad-quick" id="adQ_${f.key}"></div>` : ''}`;
  } else {
    const mode = f.fmt === 'int' || f.fmt === 'pin' ? ' inputmode="numeric"' : f.fmt === 'email' ? ' inputmode="email"' : '';
    const up = f.upper || f.fmt === 'cin' || f.fmt === 'pan' ? ' style="text-transform:uppercase"' : '';
    const input = `<input class="in" type="text" ${common} autocomplete="off" spellcheck="false"${mode}${up}${f.ph ? ` placeholder="${esc(f.ph)}"` : ''}>`;
    ctl = f.fmt === 'cin'
      ? `<div class="ad-cin-row">${input}<button type="button" class="btn" id="adLookupBtn" title="Shows the company name and address as a check. Needs the Filesure gateway (optional).">Look up company</button></div><div class="ad-cin-live" id="adCinLive" role="status" aria-live="polite"></div><div id="adLookupOut" aria-live="polite"></div>`
      : input;
    if (f.fmt === 'int' && f.key === 'numFinancialYears') ctl += `<div class="ad-suggest" id="adSug_${f.key}"></div>`;
  }
  return `<div class="f${span}" id="adF_${f.key}"><label for="${id}">${esc(f.label)}${req}</label>${f.help ? `<span class="hint ad-help" id="${helpId}">${esc(f.help)}</span>` : ''}${ctl}${f.hint ? `<span class="hint" id="${hintId}">${esc(f.hint)}</span>` : ''}<span class="field-error" id="${errId}" aria-live="polite"></span></div>`;
}

function adt1ToolsHtml(sectionId) {
  if (sectionId === 'firm') return `<div class="ad-tools"><span class="ad-tools-t">Is the firm the same person as the signing auditor?</span>
      <button type="button" class="btn sm" data-adcopy="auditor>firm">Copy address and email from the signing auditor</button>
      <button type="button" class="btn sm" data-adcopy="auditor>firm+pan" title="A sole proprietor's firm uses the proprietor's own PAN">Also copy the PAN (sole proprietor)</button></div>`;
  if (sectionId === 'auditor') return `<div class="ad-tools"><span class="ad-tools-t">Is the signing auditor the same person as the firm?</span>
      <button type="button" class="btn sm" data-adcopy="firm>auditor">Copy address and email from the firm</button>
      <button type="button" class="btn sm" data-adcopy="firm>auditor+pan" title="A sole proprietor's firm uses the proprietor's own PAN">Also copy the PAN (sole proprietor)</button></div>`;
  return '';
}

function adt1BuildCards() {
  $('#adt1Cards').innerHTML = ADT1_SECTIONS.map(s => {
    const body = s.fields.map(f => {
      const ff = ADT1_FIELD_BY_KEY[f.key];
      return (ff.key === 'periodFrom' ? '<div class="f span4 ad-fy" id="adFy"></div>' : '') + adt1FieldHtml(ff);
    }).join('');
    return `
    <section class="card ad-sec" id="adCard_${s.id}" data-adsection="${s.id}">
      <div class="card-head" data-adtoggle="${s.id}">
        <button type="button" class="card-chevron" id="adChev_${s.id}" data-adtoggle="${s.id}" aria-expanded="true" aria-controls="adBody_${s.id}" aria-label="Show or hide ${esc(s.title)}">${ADT1_CHEV_SVG}</button>
        <div class="card-heading"><h3>${esc(s.title)}</h3><p class="ad-plain">${esc(s.plain || '')}</p><p class="ad-sum" id="adSum_${s.id}"></p></div>
        <div class="card-status" id="adStatus_${s.id}"></div>
      </div>
      <div class="card-body" id="adBody_${s.id}">
        <p class="ad-sub">${esc(s.sub)}</p>
        ${adt1ToolsHtml(s.id)}
        <div class="grid">${body}</div>
        <div class="ad-sec-foot"><button type="button" class="btn sm" id="adNextSec_${s.id}" data-adnextsec="${s.id}"></button></div>
      </div>
    </section>`;
  }).join('');
}

/* ── Typing, clicking, keyboard ── */

function adt1SetPeriod(from, to) {
  const st = adt1State;
  const prev = adt1SuggestNumFY(st.periodFrom, st.periodTo);
  if (from !== undefined) st.periodFrom = from;
  if (to !== undefined) st.periodTo = to;
  const sug = adt1SuggestNumFY(st.periodFrom, st.periodTo);
  const cur = adt1Str(st.numFinancialYears);
  if (sug != null && (cur === '' || cur === String(prev))) st.numFinancialYears = String(sug);
}

function adt1AfterChange() { renderAdt1(); autosaveAdt1(); }

function adt1OnEdit(e) {
  const el = e.target.closest('[data-key]');
  if (!el) return;
  const f = ADT1_FIELD_BY_KEY[el.dataset.key];
  if (!f) return;
  if (f.type === 'check') {
    // The tick-box and 4(l) say the same thing, so they move together.
    adt1State._priorAppointed = el.checked;
    if (!el.checked) {
      // Un-ticking means "no prior appointment": clear the block so a stale count cannot keep it open.
      for (const k of ADT1_PRIOR_KEYS) adt1State[k] = '';
      if (adt1State.previouslyAudited === 'Yes') { adt1State.previouslyAudited = 'No'; toast('Also set 4(l) "audited this company before" to No'); }
    } else if (adt1State.previouslyAudited === 'No') { adt1State.previouslyAudited = 'Yes'; toast('Also set 4(l) "audited this company before" to Yes'); }
  } else {
    let v = el.value;
    if (f.type === 'text') {
      const c = adt1CleanWithCaret(f, el.value, el.selectionStart);
      v = c.value;
      if (el.value !== v) { el.value = v; try { el.setSelectionRange(c.caret, c.caret); } catch (_) { } }
    }
    if (f.key === 'periodFrom' || f.key === 'periodTo') adt1SetPeriod(f.key === 'periodFrom' ? v : undefined, f.key === 'periodTo' ? v : undefined);
    else adt1State[f.key] = v;
    // 4(l) = No closes the prior-appointments block: drop the tick so it cannot reopen the block later.
    if (f.key === 'previouslyAudited' && v === 'No') adt1State._priorAppointed = false;
  }
  adt1AfterChange();
}

function adt1Reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } }

// Open a section (and remember that the user chose it), then bring a field into view and focus it.
function adt1GoTo(key) {
  const f = ADT1_FIELD_BY_KEY[key];
  if (!f) return;
  if (typeof activePanel !== 'undefined' && activePanel !== 'data-adt1') showPanel('data-adt1');
  adt1Open[f.section] = true; adt1UserToggled.add(f.section); adt1ApplyOpen();
  const el = document.getElementById(adt1Id(key));
  if (!el) return;
  try { el.focus({ preventScroll: true }); } catch (_) { }
  (document.getElementById('adF_' + key) || el).scrollIntoView({ block: 'center', behavior: adt1Reduced() ? 'auto' : 'smooth' });
}
function adt1GoToSection(id) {
  const prog = adt1Progress(adt1State);
  const sec = prog.sections.find(s => s.id === id);
  if (!sec || sec.status === 'na') return;
  adt1Open[id] = true; adt1UserToggled.add(id); adt1ApplyOpen();
  const first = sec.missing[0] || (ADT1_SECTIONS.find(s => s.id === id).fields.find(f => f.type !== 'check') || {}).key;
  if (first) adt1GoTo(first);
}
function adt1ToggleSection(id) {
  adt1Open[id] = !adt1Open[id]; adt1UserToggled.add(id); adt1ApplyOpen();
}

// "Check my answers": show every message, then jump to the first thing that needs attention.
function adt1CheckAnswers() {
  adt1ShowAll = true; adt1MissOpen = true;
  renderAdt1();
  const prog = adt1Progress(adt1State);
  const first = prog.missing[0];
  if (first) { adt1GoTo(first.key); toast(`${prog.missing.length} thing${prog.missing.length > 1 ? 's' : ''} still to answer or fix`, true); }
  else toast(prog.notes.some(n => !n.decl) ? 'All required answers are in. A few notes are worth a look.' : 'Looks good: all required answers are in.');
}

function adt1ApplyScenarioClick(id) {
  // The card chosen before (or, after a reload, the one the current nature implies) so its pre-filled
  // answers are cleared instead of carried over into a different kind of filing.
  const prev = adt1ScenarioNote || { id: adt1ScenarioOf(adt1State) };
  const r = adt1ApplyScenario(adt1State, id, prev);
  if (!r.scenario) return;
  adt1State = r.state;
  adt1ScenarioNote = { id, changed: r.changed };
  adt1Touched.add('natureOfAppointment');
  adt1Open.appointment = true;
  for (const [sid, on] of Object.entries(adt1Active(adt1State))) if (on && sid !== 'firm') adt1Open[sid] = true;
  adt1AfterChange();
  adt1ApplyOpen();
}

function adt1DoCopy(spec) {
  const [dir, pan] = spec.split('+');
  const [from, to] = dir.split('>');
  const r = adt1CopyParty(adt1State, from, to, { pan: !!pan });
  if (!r.copied.length) return toast(`Nothing new to copy: the ${from === 'firm' ? "firm's" : "signing auditor's"} details are empty or already the same`, true);
  adt1State = r.state;
  r.copied.forEach(k => adt1Touched.add(k));
  adt1AfterChange();
  toast(`Copied ${r.copied.length} detail${r.copied.length > 1 ? 's' : ''} from the ${from === 'firm' ? 'firm' : 'signing auditor'}`);
}

function adt1OnFyChange(el) {
  const kind = el.dataset.fy;
  const st = adt1State;
  const yearSel = document.getElementById('adFyYear'), yearsSel = document.getElementById('adFyYears');
  if (kind === 'year') {
    if (el.value === 'first') { adt1FirstYear = true; adt1FirstStart = adt1FirstStart || st.periodFrom || ''; }
    else if (el.value) {
      adt1FirstYear = false;
      const r = adt1FyRange(+el.value, +(yearsSel && yearsSel.value) || 1);
      adt1SetPeriod(r.from, r.to); adt1Touched.add('periodFrom'); adt1Touched.add('periodTo');
    }
  } else if (kind === 'years') {
    const y = yearSel && /^\d{4}$/.test(yearSel.value) ? +yearSel.value : null;
    if (y) { const r = adt1FyRange(y, +el.value || 1); adt1SetPeriod(r.from, r.to); adt1Touched.add('periodTo'); }
  } else if (kind === 'start') {
    adt1FirstStart = el.value;
    const r = adt1FirstYearRange(el.value);
    if (r) { adt1SetPeriod(r.from, r.to); adt1Touched.add('periodFrom'); adt1Touched.add('periodTo'); }
  }
  adt1AfterChange();
}

async function adt1DoLookup() {
  const cin = adt1Str(adt1State.cin).toUpperCase();
  const live = adt1CinStatus(cin);
  if (live.state !== 'ok') { adt1Lookup = { cin, error: live.state === 'empty' ? 'Type or paste the CIN first, then look it up.' : live.msg }; return renderAdt1(); }
  if (typeof fetchCompanyMasterData !== 'function' || !settings.gatewayUrl || !settings.gatewayToken) {
    adt1Lookup = { cin, error: 'Company lookup is not set up on this computer: it needs the Filesure gateway (Settings → AI extraction). You can carry on without it, because MCA fills in the company name and address from the CIN anyway.', settingsLink: true };
    return renderAdt1();
  }
  adt1Lookup = { cin, busy: true }; renderAdt1();
  try {
    const d = await fetchCompanyMasterData(cin);
    if (adt1Str(adt1State.cin).toUpperCase() === cin) adt1Lookup = { cin, data: d };
  } catch (err) {
    adt1Lookup = { cin, error: `Could not look the company up: ${err.message}. You can carry on: MCA fills in the company details from the CIN.` };
  }
  renderAdt1();
}

// Two clicks within 4 s on the same button for the same `key` (which names the thing being deleted,
// so a different client or profile always asks again).
function adt1ConfirmTwice(btn, key, doIt) {
  if (adt1ConfirmTwice.armed === key && adt1ConfirmTwice.btn === btn) { adt1ConfirmReset(); doIt(); return; }
  adt1ConfirmReset();
  adt1ConfirmTwice.armed = key; adt1ConfirmTwice.btn = btn; btn.dataset.label = btn.textContent; btn.textContent = 'Click again to confirm';
  adt1ConfirmTwice.t = setTimeout(adt1ConfirmReset, 4000);
}
// Disarm a pending confirmation and put the button's label back (also called when the client changes).
function adt1ConfirmReset() {
  clearTimeout(adt1ConfirmTwice.t); adt1ConfirmTwice.t = null;
  const btn = adt1ConfirmTwice.btn;
  if (adt1ConfirmTwice.armed && btn && btn.isConnected && btn.dataset.label != null) btn.textContent = btn.dataset.label;
  adt1ConfirmTwice.armed = null; adt1ConfirmTwice.btn = null;
}

function bindAdt1Fields() {
  adt1BuildCards();
  const root = $('#panel-data-adt1');
  root.addEventListener('input', adt1OnEdit);
  root.addEventListener('change', e => {
    const fy = e.target.closest('[data-fy]');
    if (fy) return adt1OnFyChange(fy);
    const prof = e.target.closest('[data-adprof="sel"]');
    if (prof) { adt1ProfileSel = prof.value; const p = adt1Profiles().find(x => x.id === prof.value); if (p) adt1ProfileName = p.name; adt1ConfirmReset(); return renderAdt1(); }
    adt1OnEdit(e);
  });
  root.addEventListener('input', e => {
    if (e.target.matches('[data-adprof="name"]')) adt1ProfileName = e.target.value;
  });
  root.addEventListener('focusout', e => {
    const el = e.target.closest('[data-key]');
    if (el) { adt1Touched.add(el.dataset.key); renderAdt1(); }
  });
  root.addEventListener('click', e => {
    const t = e.target;
    const btn = t.closest('button');
    if (btn) {
      if (btn.dataset.adscn) return adt1ApplyScenarioClick(btn.dataset.adscn);
      if (btn.dataset.adcopy) return adt1DoCopy(btn.dataset.adcopy);
      if (btn.dataset.adq) { const [k, v] = btn.dataset.adq.split('|'); adt1State[k] = v; adt1Touched.add(k); return adt1AfterChange(); }
      if (btn.dataset.adnextsec) return adt1NextSection(btn.dataset.adnextsec);
      if (btn.dataset.adcheck !== undefined) return adt1CheckAnswers();
      if (btn.dataset.adgo) return adt1GoTo(btn.dataset.adgo);
      if (btn.dataset.adsec) return adt1GoToSection(btn.dataset.adsec);
      if (btn.dataset.adreview !== undefined) return showPanel('review-adt1');
      if (btn.dataset.admiss !== undefined) { adt1MissOpen = btn.getAttribute('aria-expanded') !== 'true'; return renderAdt1(); }
      if (btn.id === 'adLookupBtn') return adt1DoLookup();
      if (btn.dataset.adlookupfill !== undefined) {
        const d = adt1Lookup && adt1Lookup.data;
        if (d) { adt1State.companyName = d.company_name || adt1State.companyName; adt1State.companyAddress = d.registered_office_address || adt1State.companyAddress; adt1AfterChange(); toast('Filled 2(a) and 2(b) from the lookup'); }
        return;
      }
      if (btn.dataset.adopensettings !== undefined) { const s = $('#settingsBtn'); if (s) s.click(); return; }
      if (btn.dataset.adprof) return adt1ProfileAction(btn.dataset.adprof, btn);
    }
    const ph = t.closest('.card-head[data-adprof="toggle"]');
    if (ph) return adt1ProfileAction('toggle');
    const head = t.closest('[data-adtoggle]');
    if (head && !t.closest('a,input,select,textarea,button:not(.card-chevron)')) adt1ToggleSection(head.dataset.adtoggle);
  });
  // The review panel's "Go to field" / "Edit" links.
  $('#panel-review-adt1').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.adgo) adt1GoTo(b.dataset.adgo);
    else if (b.dataset.adsec) { showPanel('data-adt1'); adt1GoToSection(b.dataset.adsec); }
    else if (b.dataset.adback !== undefined) showPanel('data-adt1');
  });
}

function adt1NextSection(id) {
  const prog = adt1Progress(adt1State);
  const me = prog.sections.find(s => s.id === id);
  if (me && me.status === 'done') adt1Open[id] = false;
  const idx = prog.sections.findIndex(s => s.id === id);
  const next = prog.sections.slice(idx + 1).find(s => s.status !== 'na');
  adt1ApplyOpen();
  if (!next) return showPanel('review-adt1');
  adt1GoToSection(next.id);
}

/* ── Rendering ── */

function adt1StatusHtml(sec) {
  const total = sec.total ? `${sec.done} of ${sec.total}` : '';
  if (sec.status === 'done') return `<span class="pill ok">${ADT1_CHECK_SVG} Done</span><span class="ad-edit">Edit</span>`;
  if (sec.status === 'optional') return `<span class="pill">Optional here</span><span class="ad-edit">Edit</span>`;
  const n = sec.missing.length;
  return `<span class="pill ${sec.errors > 0 && !n ? 'err' : 'warn'}">${n ? `${n} to do` : `${sec.errors} to fix`}</span>${total ? `<span class="ad-count">${total}</span>` : ''}<span class="ad-edit">Edit</span>`;
}

function adt1SectionStarted(id, st) {
  const s = ADT1_SECTIONS.find(x => x.id === id);
  return s.fields.some(f => f.type !== 'check' && adt1Str(st[f.key]) !== '');
}
// Decide, once per section, whether it starts open: finished ones start closed, the first unfinished one
// opens, later ones open only if the user has already typed something there.
function adt1InitOpenState(prog) {
  const firstTodo = prog.sections.find(s => s.status === 'todo');
  for (const sec of prog.sections) {
    if (sec.status === 'na' || adt1Open[sec.id] !== undefined) continue;
    // A section that appears later (the firm after choosing "Auditor's Firm", the prior block after "Yes") opens at once.
    adt1Open[sec.id] = sec.status === 'done' ? false : (adt1OpenInit && sec.status === 'todo') || (firstTodo && firstTodo.id === sec.id) || adt1SectionStarted(sec.id, adt1State);
  }
  adt1OpenInit = true;
}
function adt1ApplyOpen() {
  for (const s of ADT1_SECTIONS) {
    const card = document.getElementById('adCard_' + s.id), chev = document.getElementById('adChev_' + s.id);
    if (!card) continue;
    const open = adt1Open[s.id] !== false;
    card.classList.toggle('collapsed', !open);
    if (chev) chev.setAttribute('aria-expanded', String(open));
  }
}

function adt1ProgressHtml(prog, mode) {
  const chips = prog.sections.map(sec => {
    const name = esc(sec.short);
    if (sec.status === 'na') return `<span class="ad-chip na" title="${esc(sec.reason)}">${name} · not needed</span>`;
    const label = sec.status === 'done' ? `${name}: done` : sec.status === 'optional' ? `${name}: optional here` : `${name}: needs attention`;
    const body = sec.status === 'done' ? `${ADT1_CHECK_SVG} ${name}` : sec.status === 'optional' ? `${name} · optional` : `${name} <b>${sec.missing.length || sec.errors}</b>`;
    return `<button type="button" class="ad-chip ${sec.status === 'optional' ? 'opt' : sec.status}" data-adsec="${sec.id}" data-fk="chip_${sec.id}" aria-label="${label}">${body}</button>`;
  }).join('');
  const bad = prog.missing.filter(m => m.severity === 'error').length;
  const todo = prog.missing.length - bad;
  const pill = prog.ready && prog.done === prog.total ? '<span class="pill ok">All required answers in</span>'
    : bad ? `<span class="pill err">${bad} to fix</span>${todo ? `<span class="pill warn">${todo} to answer</span>` : ''}`
      : `<span class="pill warn">${todo} to answer</span>`;
  const action = mode === 'review'
    ? '<button type="button" class="btn sm" data-adback data-fk="back">Back to the answers</button>'
    : '<button type="button" class="btn sm" data-adcheck data-fk="check">Check my answers</button>';
  const declLine = prog.decl.total ? `<span class="ad-decl">Declaration step (optional here): ${prog.decl.done} of ${prog.decl.total}</span>` : '';
  return `<div class="ad-prog-top"><strong>${prog.done} of ${prog.total} required answers</strong>${pill}${declLine}<span class="ad-spacer"></span>${action}</div>
    <div class="ad-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${prog.total}" aria-valuenow="${prog.done}" aria-label="Required answers filled in"><span style="width:${prog.pct}%"></span></div>
    <div class="ad-chips">${chips}</div>`;
}

function adt1ScenarioHtml(st) {
  const cur = adt1ScenarioOf(st);
  const card = s => `<button type="button" class="ad-scn${s.more ? ' small' : ''}${cur === s.id ? ' on' : ''}" aria-pressed="${cur === s.id}" data-adscn="${s.id}" data-fk="scn_${s.id}"><span class="ad-scn-t">${esc(s.title)}</span><span class="ad-scn-b">${esc(s.blurb)}</span></button>`;
  const sc = ADT1_SCENARIOS.find(x => x.id === cur);
  const touched = adt1ScenarioNote && adt1ScenarioNote.id === cur ? adt1ScenarioNote.changed.filter(k => k !== 'natureOfAppointment' && k !== '_priorAppointed') : [];
  const also = touched.filter(k => adt1Str(st[k]) !== ''), cleared = touched.filter(k => adt1Str(st[k]) === '');
  const alsoTxt = (also.length ? ` We also filled in: ${also.map(k => `${adt1FieldName(k)} = ${adt1Str(st[k])}`).join('; ')}.` : '')
    + (cleared.length ? ` We cleared the earlier answer for ${cleared.map(k => adt1FieldName(k)).join(' and ')}: please answer again if MCA asks.` : '');
  const info = sc
    ? `<div class="note ok ad-scn-info"><strong>${esc(sc.title)}.</strong> ${esc(sc.next)}${esc(alsoTxt)} <span class="ad-yours">Still yours to answer: 3(a) class of company, 4(k) 20-company limit and 5 Audit Committee. We never fill those in.</span></div>`
    : `<div class="note ad-scn-info">Choose what happened. We set <em>3(b) Nature of appointment</em> and only the answers that follow for certain. Nothing else is guessed: 3(a), 4(k) and 5 are always yours.</div>`;
  return `<div class="card-head ad-static"><div class="card-heading"><h3>What are you filing?</h3><p>Pick the situation that fits best. You can change it at any time.</p></div></div>
    <div class="card-body"><div class="ad-scn-grid" role="group" aria-label="What are you filing?">${ADT1_SCENARIOS.filter(s => !s.more).map(card).join('')}</div>
    <p class="ad-more-t">Less common</p><div class="ad-scn-grid small" role="group" aria-label="Less common situations">${ADT1_SCENARIOS.filter(s => s.more).map(card).join('')}</div>${info}</div>`;
}

function adt1Profiles() {
  const list = LS.get('adt1_profiles', []);
  return Array.isArray(list) ? list.filter(p => p && typeof p.id === 'string' && p.data && typeof p.data === 'object') : [];
}
function adt1ProfilesHtml() {
  const list = adt1Profiles();
  const sel = list.some(p => p.id === adt1ProfileSel) ? adt1ProfileSel : '';
  const hasData = adt1ProfileHasData(adt1State);
  const open = adt1ProfOpen;
  return `<div class="card-head" data-adprof="toggle">
      <button type="button" class="card-chevron" data-adprof="toggle" data-fk="proftoggle" aria-expanded="${open}" aria-controls="adProfBody" aria-label="Show or hide saved auditors">${ADT1_CHEV_SVG}</button>
      <div class="card-heading"><h3>Saved auditors</h3><p>Filing again for the same auditor? Save the firm and signing auditor once, then apply them in one click.</p></div>
      <div class="card-status"><span class="pill">${list.length} saved</span></div></div>
    <div class="card-body" id="adProfBody"${open ? '' : ' hidden'}>
      <div class="ad-prof-row"><label for="adProfSel">Saved auditors</label>
        <select class="sel" id="adProfSel" data-adprof="sel" data-fk="profsel"><option value="">${list.length ? 'Choose a saved auditor…' : 'None saved yet'}</option>${list.map(p => `<option value="${esc(p.id)}"${p.id === sel ? ' selected' : ''}>${esc(p.name)} (${esc(adt1ProfileSummary(p))})</option>`).join('')}</select>
        <button type="button" class="btn sm primary" data-adprof="apply" data-fk="profapply"${sel ? '' : ' disabled'}>Apply to this filing</button></div>
      <div class="ad-prof-row"><label for="adProfName">Name for the profile</label>
        <input class="in" id="adProfName" data-adprof="name" data-fk="profname" autocomplete="off" placeholder="e.g. Jain S A K and Co, Sumit Jain">
        <button type="button" class="btn sm" data-adprof="save" data-fk="profsave"${hasData ? '' : ' disabled'} title="${hasData ? 'Saves the firm and signing auditor details currently in the form' : 'Fill in the firm or signing auditor details first'}">Save current details</button>
        <button type="button" class="btn sm" data-adprof="rename" data-fk="profrename"${sel ? '' : ' disabled'}>Rename</button>
        <button type="button" class="btn sm danger" data-adprof="del" data-fk="profdel"${sel ? '' : ' disabled'}>Delete</button></div>
      <span class="hint">Profiles hold the firm and signing auditor details only. They are kept in this browser and never sent anywhere.</span>
    </div>`;
}
function adt1ProfileAction(action, btn) {
  const list = adt1Profiles();
  // false when the browser refused the write (storage full or blocked): the caller must not claim success.
  const save = l => {
    if (!LS.set('adt1_profiles', l)) { toast("Could not save: this browser's storage is full or blocked", true); return false; }
    renderAdt1(); return true;
  };
  if (action === 'toggle') { adt1ProfOpen = !adt1ProfOpen; delete adt1Sig.profiles; return renderAdt1(); }
  const nameEl = $('#adProfName');
  if (nameEl) adt1ProfileName = nameEl.value;
  const sel = list.find(p => p.id === adt1ProfileSel);
  if (action === 'save') {
    if (!adt1ProfileHasData(adt1State)) return toast('Fill in the firm or signing auditor details first', true);
    const existing = list.find(p => p.name.toLowerCase() === adt1Str(adt1ProfileName).toLowerCase());
    const p = adt1ProfileFromState(adt1State, adt1ProfileName, existing && existing.id);
    if (!save(adt1ProfilesUpsert(list, p))) return;
    adt1ProfileSel = p.id; adt1ProfileName = p.name; renderAdt1();
    return toast(existing ? `Updated "${p.name}"` : `Saved "${p.name}"`);
  }
  if (!sel) return;
  if (action === 'apply') {
    const r = adt1ApplyProfile(adt1State, sel);
    adt1State = r.state;
    r.applied.forEach(k => adt1Touched.add(k));
    adt1Open.firm = true; adt1Open.auditor = true;
    adt1AfterChange(); adt1ApplyOpen();
    return toast(r.applied.length ? `Applied "${sel.name}": ${r.applied.length} detail${r.applied.length > 1 ? 's' : ''} filled in` : `"${sel.name}" is already applied`);
  }
  if (action === 'rename') {
    const next = adt1ProfilesRename(list, sel.id, adt1ProfileName);
    if (next === list || !adt1Str(adt1ProfileName)) return toast('Type a new, different name first', true);
    if (save(next)) toast('Renamed');
    return;
  }
  if (action === 'del') {
    return adt1ConfirmTwice(btn, 'prof:' + sel.id, () => {
      if (!save(adt1ProfilesRemove(list, sel.id))) return;
      adt1ProfileSel = ''; adt1ProfileName = ''; renderAdt1(); toast(`Deleted "${sel.name}"`);
    });
  }
}

function adt1MissingHtml(prog) {
  const sevClass = m => m.severity === 'error' || (m.severity === 'todo' && adt1ShowAll) ? 'err' : m.severity === 'todo' ? 'todo' : 'warn';
  const li = m => `<li><span class="sev ${sevClass(m)}"></span><span>${esc(m.msg)}</span><button type="button" class="ad-link" data-adgo="${m.key}" data-fk="go_${m.key}">Go to it</button></li>`;
  const notes = prog.notes.filter(n => !n.decl), declMissing = prog.notes.filter(n => n.decl);
  if (!prog.missing.length && !notes.length && !declMissing.length) {
    return `<div class="note ok">Everything required is filled in. Next step: <button type="button" class="ad-link" data-adreview data-fk="review">Review &amp; Send</button>.</div>`;
  }
  const open = adt1MissOpen === null ? prog.missing.length <= 6 : adt1MissOpen;
  const list = prog.missing.length
    ? `<p class="ad-miss-s">Click an item to jump straight to it.</p><ul class="issues ad-issues">${prog.missing.map(li).join('')}</ul>`
    : `<div class="note ok">All required answers are in. Next step: <button type="button" class="ad-link" data-adreview data-fk="review">Review &amp; Send</button>.</div>`;
  const tail = (notes.length ? `<div class="ad-miss-h mt12"><h3>Worth a look</h3><span class="pill">${notes.length}</span></div><p class="ad-miss-s">These do not block sending.</p><ul class="issues ad-issues">${notes.map(li).join('')}</ul>` : '')
    + (declMissing.length ? `<p class="ad-miss-s mt12">Declaration step: ${declMissing.length} answer${declMissing.length > 1 ? 's' : ''} left blank. That is fine: the extension does not fill that step, so you can finish it on MCA.</p>` : '');
  return `<div class="ad-miss-h"><button type="button" class="ad-miss-toggle" data-admiss data-fk="misstoggle" aria-expanded="${open}" aria-controls="adMissBody"><span class="ad-chev">${ADT1_CHEV_SVG}</span><h3>What is still missing</h3></button><span class="pill ${prog.missing.length ? 'warn' : 'ok'}">${prog.missing.length ? prog.missing.length + ' to do' : 'Nothing missing'}</span></div><div id="adMissBody"${open ? '' : ' hidden'}>${list}${tail}</div>`;
}

function adt1LookupHtml() {
  const cin = adt1Str(adt1State.cin).toUpperCase();
  if (!adt1Lookup || adt1Lookup.cin !== cin) return '';
  if (adt1Lookup.busy) return `<div class="note"><span class="spin"></span> Looking up ${esc(cin)}…</div>`;
  if (adt1Lookup.error) return `<div class="note warn">${esc(adt1Lookup.error)}${adt1Lookup.settingsLink ? ' <button type="button" class="ad-link" data-adopensettings data-fk="opensettings">Open Settings</button>' : ''}</div>`;
  const d = adt1Lookup.data || {};
  return `<div class="note ok ad-lookup"><strong>${esc(d.company_name || 'Name not returned')}</strong>${d.registered_office_address ? `<br>${esc(d.registered_office_address)}` : ''}${d.company_status ? `<br>Status: ${esc(d.company_status)}` : ''}
    <br><span class="hint">Read-only check from Filesure. MCA fills these in itself from the CIN.</span>
    <div class="btn-row mt8"><button type="button" class="btn sm" data-adlookupfill data-fk="lookupfill">Fill 2(a) and 2(b) from this</button></div></div>`;
}

function adt1FyHtml(st) {
  const fy = adt1FyOfRange(st.periodFrom, st.periodTo);
  const opts = adt1FyOptions(new Date());
  if (fy && !opts.some(o => o.startYear === fy.startYear)) opts.push({ startYear: fy.startYear, label: adt1FyLabel(fy.startYear) });
  opts.sort((a, b) => b.startYear - a.startYear);
  const mode = adt1FirstYear ? 'first' : fy ? String(fy.startYear) : '';
  const yrs = fy ? fy.years : 1;
  const maxYears = Math.max(5, yrs);
  const first = mode === 'first';
  return `<div class="ad-fy-box"><div class="ad-fy-row">
      <label for="adFyYear">Financial year</label>
      <select class="sel" id="adFyYear" data-fy="year" data-fk="fyyear"><option value=""${mode === '' ? ' selected' : ''}>${mode === '' && (st.periodFrom || st.periodTo) ? 'Custom dates (typed below)' : 'Choose a financial year…'}</option>${opts.map(o => `<option value="${o.startYear}"${mode === String(o.startYear) ? ' selected' : ''}>${esc(o.label)} (1 Apr ${o.startYear} to 31 Mar ${o.startYear + 1})</option>`).join('')}<option value="first"${mode === 'first' ? ' selected' : ''}>First year of a new company…</option></select>
      <label for="adFyYears">for</label>
      <select class="sel ad-short" id="adFyYears" data-fy="years" data-fk="fyyears"${/^\d{4}$/.test(mode) ? '' : ' disabled'}>${Array.from({ length: maxYears }, (_, i) => `<option value="${i + 1}"${yrs === i + 1 ? ' selected' : ''}>${i + 1} year${i ? 's' : ''}</option>`).join('')}</select>
      ${first ? `<label for="adFyStart">Company's first day</label><input class="in ad-short" type="date" id="adFyStart" data-fy="start" data-fk="fystart" value="${esc(adt1ToISO(adt1FirstStart))}">` : ''}
    </div><span class="hint">${first ? 'The first year runs from that date to the next 31 March (to the one after, if that is under 3 months). A first year can be up to 18 months: change the "to" date below if yours differs.' : 'Fills the "from" and "to" dates below for you. Or just type the dates yourself.'}</span></div>`;
}

function adt1FillTableHtml(rows) {
  if (!rows.length) return '<p class="hint">Nothing to send yet: answer the questions on the Data Entry screen first.</p>';
  let html = '<div class="scroll-x"><table class="tbl"><thead><tr><th>What MCA asks</th><th>What the extension types</th><th></th></tr></thead><tbody>', cur = '';
  for (const r of rows) {
    if (r.section !== cur) { cur = r.section; html += `<tr class="group"><td colspan="3">${esc(r.sectionTitle)}${r.decl ? ' (sent along, but you finish this step on MCA)' : ''}</td></tr>`; }
    html += `<tr><td class="lbl">${esc(r.label)}${r.ref ? `<small>${esc(r.ref)}</small>` : ''}</td><td class="ad-val">${esc(r.value)}</td><td><button type="button" class="ad-link" data-adgo="${r.key}">Edit</button></td></tr>`;
  }
  return html + '</tbody></table></div>';
}

function renderAdt1() {
  const st = adt1State;
  const validation = validateAdt1(st);
  const { errors, warnings } = validation;
  const a = adt1Active(st);
  // a.prior is derived from the answers (4(l), nature, tick-box, typed count) and only SHOWN in the
  // tick-box below; it is never written back into st._priorAppointed, or 4(l) = No could not close the block.
  const prog = adt1Progress(st, validation);
  adt1InitOpenState(prog);
  const focusedKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : '';
  // Card + field visibility, then values.
  for (const s of ADT1_SECTIONS) {
    $('#adCard_' + s.id).classList.toggle('hidden', !adt1SectionActive(s.id, st));
    for (const sf of s.fields) {
      const f = ADT1_FIELD_BY_KEY[sf.key];
      const wrap = document.getElementById('adF_' + f.key);
      if (wrap) wrap.classList.toggle('hidden', !!f.when && !f.when(st));
      const el = document.getElementById(adt1Id(f.key));
      if (!el) continue;
      if (f.type === 'check') {
        const on = f.key === '_priorAppointed' ? a.prior : !!st[f.key];
        if (el.checked !== on) el.checked = on;
        // A re-appointment always needs the block (the label says so): lock the box so it cannot wipe the rows.
        const lock = f.key === '_priorAppointed' && st.natureOfAppointment === ADT1_NATURE_REAPPOINT;
        if (el.disabled !== lock) el.disabled = lock;
        continue;
      }
      const want = f.type === 'date' ? adt1ToISO(st[f.key]) : (st[f.key] ?? '');
      if (el.value !== want && !(f.type === 'date' && document.activeElement === el)) {
        // Rewriting a value moves the caret to the end: keep it where it was.
        const focused = document.activeElement === el && typeof el.selectionStart === 'number';
        const pos = focused ? el.selectionStart : 0;
        el.value = want;
        if (focused) { try { el.setSelectionRange(Math.min(pos, want.length), Math.min(pos, want.length)); } catch (_) { } }
      }
    }
    const sec = prog.sections.find(x => x.id === s.id);
    adt1SetHtml(document.getElementById('adStatus_' + s.id), 'status_' + s.id, adt1StatusHtml(sec));
    const sum = document.getElementById('adSum_' + s.id);
    const sumText = sec.status === 'na' ? '' : adt1SectionSummary(s.id, st);
    if (sum && sum.textContent !== sumText) sum.textContent = sumText;
    const nb = document.getElementById('adNextSec_' + s.id);
    if (nb) {
      const idx = prog.sections.findIndex(x => x.id === s.id);
      const next = prog.sections.slice(idx + 1).find(x => x.status !== 'na');
      const txt = next ? `${sec.status === 'done' ? 'Done' : 'Next'}: ${next.short} ↓` : 'On to Review & Send →';
      if (nb.textContent !== txt) nb.textContent = txt;
    }
  }
  adt1ApplyOpen();
  // Per-field messages: "required" only once the field was visited (or after "Check my answers").
  const byKey = {};
  for (const m of errors.concat(warnings)) {
    const seen = adt1Touched.has(m.path) || adt1ShowAll;
    if (m.kind === 'required' && !seen) continue;
    if (m.kind !== 'required' && !seen && focusedKey === m.path) continue;   // do not nag while the field is being typed
    (byKey[m.path] = byKey[m.path] || []).push(m);
  }
  for (const f of ADT1_FIELD_LIST) {
    const err = document.getElementById('adErr_' + f.key);
    if (!err) continue;
    const ms = f.fmt === 'cin' ? [] : (byKey[f.key] || []);   // the CIN has its own live check below
    const text = ms.length ? ms[0].msg : '';
    if (err.textContent !== text) err.textContent = text;
    err.classList.toggle('warn', ms.length > 0 && !errors.includes(ms[0]));
    const el = document.getElementById(adt1Id(f.key));
    if (el) {
      const bad = ms.some(m => errors.includes(m)) || (f.fmt === 'cin' && (byKey.cin || []).some(m => errors.includes(m)));
      el.classList.toggle('invalid', bad);
      el.setAttribute('aria-invalid', bad ? 'true' : 'false');
    }
  }
  // CIN: instant plain-language check + optional lookup.
  const live = document.getElementById('adCinLive');
  if (live) {
    const c = adt1CinStatus(st.cin);
    const seen = adt1Touched.has('cin') || adt1ShowAll;
    const cls = c.state === 'ok' ? 'ok' : c.state === 'empty' ? (seen ? 'bad' : '') : (c.state === 'bad' || seen) ? 'bad' : 'typing';
    const text = c.state === 'empty' ? (seen ? 'Please fill in the CIN. ' + c.msg : '') : c.msg;
    if (live.textContent !== text) live.textContent = text;
    live.className = 'ad-cin-live ' + cls;
    const ci = document.getElementById('ad_cin'); if (ci) ci.classList.toggle('invalid', cls === 'bad');
  }
  adt1SetHtml(document.getElementById('adLookupOut'), 'lookup', adt1LookupHtml());
  // Date quick buttons and the number-of-years suggestion.
  for (const f of ADT1_FIELD_LIST) {
    if (!f.quick) continue;
    const box = document.getElementById('adQ_' + f.key);
    if (box) adt1SetHtml(box, 'q_' + f.key, adt1QuickDates(st, f.key, adt1TodayISO()).map(q => `<button type="button" class="ad-qbtn" data-adq="${f.key}|${q.value}" data-fk="q_${f.key}_${q.label.replace(/\W/g, '')}">${esc(q.label)}</button>`).join(''));
  }
  const sug = adt1SuggestNumFY(st.periodFrom, st.periodTo);
  const sugBox = document.getElementById('adSug_numFinancialYears');
  if (sugBox) adt1SetHtml(sugBox, 'sug', sug != null && adt1Str(st.numFinancialYears) !== String(sug) ? `Based on the period above we suggest ${sug}. <button type="button" class="ad-qbtn" data-adq="numFinancialYears|${sug}" data-fk="sugnum">Use ${sug}</button>` : '');
  adt1SetHtml(document.getElementById('adFy'), 'fy', adt1FyHtml(st));
  // Top blocks.
  adt1SetHtml($('#adProgress'), 'progress', adt1ProgressHtml(prog, 'data'));
  adt1SetHtml($('#adScenario'), 'scenario', adt1ScenarioHtml(st));
  adt1SetHtml($('#adProfiles'), 'profiles', adt1ProfilesHtml());
  const pn = document.getElementById('adProfName'); if (pn && document.activeElement !== pn && pn.value !== adt1ProfileName) pn.value = adt1ProfileName;
  adt1SetHtml($('#adMissing'), 'missing', adt1MissingHtml(prog));
  const pill = $('#adFormBadge');
  pill.textContent = errors.length ? 'Needs fixes' : (st.cin ? 'Ready' : 'Draft');
  pill.className = 'pill ' + (errors.length ? 'err' : st.cin ? 'ok' : '');
  const dc = $('#ad-cnt-data');
  dc.textContent = errors.length ? String(errors.length) : '';
  dc.classList.toggle('err', errors.length > 0);
  if (typeof currentForm !== 'undefined' && currentForm === 'adt1') {
    const top = $('#topStatus');
    top.textContent = errors.length ? `${errors.length} to fix` : 'Ready';
    top.className = 'pill ' + (errors.length ? 'err' : 'ok');
    top.style.display = '';
  }
  if (typeof activePanel !== 'undefined' && activePanel === 'review-adt1') renderAdt1Review();
  // "from document" badges (js/adt1-upload.js) must follow every edit: a typed value is no longer the document's value
  if (typeof adt1MarkFromDoc === 'function') adt1MarkFromDoc();
}

/* ── Drafts ("clients"): several, keyed by CIN + period year ── */

function adt1ListDrafts() {
  const entries = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(ADT1_DRAFT_PREFIX)) entries.push({ key: k, value: LS.get(k, null) });
    }
  } catch (_) { }
  return adt1SummarizeDrafts(entries);
}
function adt1RenderClientList() {
  const sel = $('#adClientSelect');
  if (!sel) return;
  const drafts = adt1ListDrafts();
  const seen = {};
  drafts.forEach(d => { seen[d.label] = (seen[d.label] || 0) + 1; });
  sel.innerHTML = '<option value="">New client</option>' + drafts.map(d => {
    const when = seen[d.label] > 1 && d.savedAt ? ` (saved ${new Date(d.savedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })})` : '';
    return `<option value="${esc(d.key)}"${d.key === adt1DraftKey ? ' selected' : ''}>${esc(d.label + when)}</option>`;
  }).join('');
  if (!drafts.some(d => d.key === adt1DraftKey)) sel.value = '';
  const has = !!adt1DraftKey && drafts.some(d => d.key === adt1DraftKey);
  const dup = $('#adDupBtn'), del = $('#adDelBtn');
  if (dup) dup.disabled = !adt1HasContent(adt1State);
  if (del) del.disabled = !has;
}
function adt1ResetUi() {
  adt1Touched.clear(); adt1ShowAll = false; adt1Open = {}; adt1UserToggled.clear(); adt1OpenInit = false;
  adt1Lookup = null; adt1FirstYear = false; adt1FirstStart = ''; adt1ScenarioNote = null;
}
function saveAdt1Draft() {
  clearTimeout(adt1SaveTimer); adt1SaveTimer = null;
  if (!adt1DraftKey && !adt1HasContent(adt1State)) { setSaveState('New client: not saved yet'); adt1RenderClientList(); return; }
  const key = adt1PickDraftKey(adt1State, adt1DraftKey, adt1ListDrafts().map(d => d.key), { unique: adt1ForceUnique });
  adt1ForceUnique = false;
  const ok = LS.set(key, { state: adt1State, _savedAt: Date.now() });
  if (ok) {
    if (adt1DraftKey && adt1DraftKey !== key) LS.del(adt1DraftKey);
    adt1DraftKey = key;
    LS.set('adt1_last_draft', key);
    setSaveState(`Saved · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, true);
  } else setSaveState('Could not save: this browser blocked or filled its storage');
  adt1RenderClientList();
}
function autosaveAdt1() { clearTimeout(adt1SaveTimer); adt1SaveTimer = setTimeout(saveAdt1Draft, 800); }
function adt1Flush() { if (adt1SaveTimer) saveAdt1Draft(); }
// Put a different state on screen (new / sample / import / another saved draft).
function adt1Replace(state, opts) {
  adt1Flush();
  adt1ConfirmReset();   // a Delete armed for the previous client must not fire on this one
  adt1State = state; adt1ResetUi();
  if (typeof adt1UpReset === 'function') adt1UpReset();   // Upload & AI results belonged to the previous client
  adt1DraftKey = opts && opts.key ? opts.key : null;
  adt1ForceUnique = !!(opts && opts.unique);
  renderAdt1();
  if (!opts || opts.save !== false) saveAdt1Draft(); else adt1RenderClientList();
}
function loadAdt1Draft() {
  // One-off migration of the old single draft ("adt1_draft") into the saved-clients list.
  const old = LS.get('adt1_draft', null);
  if (old && old.state && typeof old.state === 'object') {
    const st = Object.assign(adt1BlankState(), old.state);
    if (adt1HasContent(st)) {
      const key = adt1PickDraftKey(st, null, adt1ListDrafts().map(d => d.key), { unique: true });
      if (LS.set(key, { state: st, _savedAt: old._savedAt || Date.now() })) { LS.set('adt1_last_draft', key); LS.del('adt1_draft'); }
    } else LS.del('adt1_draft');
  }
  const drafts = adt1ListDrafts();
  const last = LS.get('adt1_last_draft', null);
  const pick = drafts.find(d => d.key === last) || drafts[0];
  if (pick) {
    const d = LS.get(pick.key, null);
    if (d && d.state) { adt1State = Object.assign(adt1BlankState(), d.state); adt1DraftKey = pick.key; }
  }
}

/* ── Review & Send ── */

function renderAdt1Review() {
  const validation = validateAdt1(adt1State);
  const { errors, warnings } = validation;
  const prog = adt1Progress(adt1State, validation);
  const head = $('#adReviewHeadline');
  if (head) head.textContent = adt1PlainSummary(adt1State, { companyName: adt1Lookup && adt1Lookup.data && adt1Lookup.cin === adt1Str(adt1State.cin).toUpperCase() ? adt1Lookup.data.company_name : '' });
  const rp = $('#adReviewProgress');
  if (rp) adt1SetHtml(rp, 'reviewprogress', adt1ProgressHtml(prog, 'review'));
  const summary = $('#adIssueSummary');
  summary.textContent = errors.length ? `${errors.length} to fix` : warnings.length ? `${warnings.length} note${warnings.length > 1 ? 's' : ''}` : 'All checks passed';
  summary.className = 'pill ' + (errors.length ? 'err' : warnings.length ? 'warn' : 'ok');
  const li = (sev, m) => `<li><span class="sev ${sev}"></span><span>${esc(m.msg)}</span><button type="button" class="ad-link" data-adgo="${m.path}">Go to field</button></li>`;
  $('#adIssueList').innerHTML = errors.map(m => li('err', m)).concat(warnings.map(m => li('warn', m))).join('') || '<li><span class="sev" style="background:var(--ok)"></span><span>Everything checks out. The client is ready for the extension.</span></li>';
  const ft = $('#adFillTable');
  if (ft) ft.innerHTML = adt1FillTableHtml(adt1ReviewRows(adt1State));
  $('#adJsonPreview').textContent = JSON.stringify(buildAdt1Envelope(adt1State), null, 2);
  const send = $('#adSendBtn');
  send.disabled = errors.length > 0;
  send.textContent = errors.length ? 'Sending blocked' : 'Send to extension';
  $('#adSendForceBtn').classList.toggle('hidden', errors.length === 0);
  const c = $('#ad-cnt-review');
  c.textContent = errors.length ? String(errors.length) : '';
  c.classList.toggle('err', errors.length > 0);
}

function downloadAdt1Json() {
  const env = buildAdt1Envelope(adt1State);
  const blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${env.clientInfo.id}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`Downloaded ${env.clientInfo.id}.json`);
  return env;
}

// Keep the Extension ID / pairing key typed on the Review panel in the shared dashboard settings.
function persistAdt1Connection() {
  const idEl = $('#adExtId'), keyEl = $('#adPairKey');
  if (!idEl || !keyEl) return;
  settings.extId = idEl.value.trim();
  settings.pairingKey = keyEl.value.trim();
  LS.set('aoc4_settings', settings);
  const v = settings.extId;
  $('#adExtIdMsg').textContent = !v || /^[a-p]{32}$/.test(v) ? '' : 'An extension id is exactly 32 letters, a to p.';
}

// opts.force: send even though some checks still show errors (the extension lists what MCA still needs).
async function sendAdt1ToExtension(opts) {
  const force = !!(opts && opts.force);
  persistAdt1Connection();
  const { errors } = validateAdt1(adt1State);
  if (errors.length && !force) return toast('Clear the errors first, or use Send anyway', true);
  const env = buildAdt1Envelope(adt1State);
  const note = html => { $('#adSendResult').innerHTML = html; };
  if (!settings.extId) { $('#adExtId').focus(); return note('<div class="note warn">Paste the <strong>Extension ID</strong> above (chrome://extensions → Germin8 → ID), then send again.</div>'); }
  note('<div class="note"><span class="spin"></span> Sending to the extension…</div>');
  try {
    // An extension build that predates ADT-1 would store this under AOC-4 (background.js falls back
    // to "aoc4" for unknown form types), so ask what it supports before sending anything.
    const ping = await sendToExtension({ action: 'ping' });
    if (Array.isArray(ping.supports) && !ping.supports.includes('adt1')) {
      throw new Error('this extension build does not support ADT-1 yet (it supports: ' + ping.supports.join(', ') + ') — reload the updated extension at chrome://extensions');
    }
    const res = await sendToExtension({ action: 'importClient', formType: 'adt1', formData: env.formData, clientInfo: env.clientInfo });
    if (res.formType && res.formType !== 'adt1') throw new Error(`the extension stored it as "${res.formType}", not ADT-1 — update and reload the extension`);
    saveAdt1Draft();
    note(`<div class="note ok"><strong>${esc(res.name || env.clientInfo.name)}</strong> is now in the extension${res.replaced ? ' (it replaced the earlier copy)' : ''}. Open ADT-1 on MCA and use <strong>Fill ADT-1</strong> in the popup — Phase 1 (Company Information) first, then Phase 2 (Appointment and Auditor Details).</div>`);
    toast('Sent to the extension');
  } catch (e) {
    downloadAdt1Json();
    note(`<div class="note err"><strong>Could not reach the extension:</strong> ${esc(e.message)}<br>The client was downloaded instead — import it in the popup with <strong>Import JSON…</strong>.</div>`);
  }
}

// Load the ADT-1 JSON text (the exported envelope or a flat formData) into the form.
function loadAdt1FromText(text, goToData) {
  const { state, ignored } = adt1StateFromJson(JSON.parse(text));
  adt1Replace(state, { unique: true });
  toast(`Loaded ${adt1ClientInfo(state).name}` + (ignored.length ? ` — ${ignored.length} value${ignored.length > 1 ? 's' : ''} skipped (not a valid option/date): ${ignored.join(', ')}` : ''), ignored.length > 0);
  if (goToData) showPanel('data-adt1');
}
async function copyAdt1Json() {
  try { await navigator.clipboard.writeText(JSON.stringify(buildAdt1Envelope(adt1State), null, 2)); toast('JSON copied'); }
  catch (_) { toast('Copy failed — select the text instead', true); }
}

function bindAdt1Review() {
  // Extension ID / pairing key, remembered in the shared dashboard settings.
  const idEl = $('#adExtId'), keyEl = $('#adPairKey');
  idEl.value = settings.extId || ''; keyEl.value = settings.pairingKey || '';
  idEl.addEventListener('input', persistAdt1Connection); keyEl.addEventListener('input', persistAdt1Connection);
  persistAdt1Connection();
  $('#adTestBtn').addEventListener('click', async () => {
    persistAdt1Connection();
    const note = html => { $('#adSendResult').innerHTML = html; };
    if (!settings.extId) { idEl.focus(); return note('<div class="note warn">Paste the <strong>Extension ID</strong> above first.</div>'); }
    note('<div class="note"><span class="spin"></span> Checking the extension…</div>');
    try {
      const p = await sendToExtension({ action: 'ping' });
      const supportsAdt1 = !Array.isArray(p.supports) || p.supports.includes('adt1');
      note(supportsAdt1
        ? `<div class="note ok">Connected to <strong>${esc(p.name || 'the extension')}</strong> ${esc(p.version || '')}. ADT-1 is supported.</div>`
        : `<div class="note err">Connected, but this extension build does not support ADT-1 (it supports: ${esc((p.supports || []).join(', '))}). Reload the updated extension at chrome://extensions.</div>`);
    } catch (e) { note(`<div class="note err"><strong>Could not reach the extension:</strong> ${esc(e.message)}</div>`); }
  });
  $('#adSendForceBtn').addEventListener('click', () => {
    const { errors } = validateAdt1(adt1State);
    if (!confirm(`${errors.length} check${errors.length > 1 ? 's' : ''} still show errors (for example: ${errors.slice(0, 3).map(e => e.msg).join(' / ')}).\n\nSend to the extension anyway? The extension will list anything MCA still needs.`)) return;
    sendAdt1ToExtension({ force: true });
  });
  $('#adImportBtn').addEventListener('click', () => $('#adImportJsonInput2').click());
  $('#adImportJsonInput2').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { loadAdt1FromText(await f.text(), false); } catch (err) { toast(`Invalid ADT-1 JSON: ${err.message}`, true); }
  });
  $('#adPasteBtn').addEventListener('click', () => { $('#adPasteWrap').classList.toggle('hidden'); if (!$('#adPasteWrap').classList.contains('hidden')) $('#adPasteText').focus(); });
  $('#adPasteLoad').addEventListener('click', () => {
    try { loadAdt1FromText($('#adPasteText').value, false); $('#adPasteText').value = ''; $('#adPasteWrap').classList.add('hidden'); }
    catch (err) { toast(`Invalid ADT-1 JSON: ${err.message}`, true); }
  });
  $('#adCopyBtn2').addEventListener('click', copyAdt1Json);
  $('#adJsonCopy').addEventListener('click', copyAdt1Json);
  $('#adDownloadBtn').addEventListener('click', () => downloadAdt1Json());
  $('#adSendBtn').addEventListener('click', () => sendAdt1ToExtension());
  $('#adDraftBtn').addEventListener('click', () => { saveAdt1Draft(); toast('Draft saved in this browser'); });
}

function bindAdt1Top() {
  $('#adNewBtn').addEventListener('click', () => {
    adt1Replace(adt1BlankState(), { save: false });
    setSaveState('New client: not saved yet');
    showPanel('data-adt1'); toast('New client');
  });
  $('#adSampleBtn').addEventListener('click', () => {
    const sample = adt1SampleState();
    // Re-clicking Sample refreshes the earlier sample draft instead of piling up copies (a real draft is never overwritten).
    const nat = adt1PickDraftKey(sample, null, []), prev = LS.get(nat, null);
    adt1Replace(sample, prev && prev.state && /^SAMPLE/.test(prev.state.companyName || '') ? { key: nat } : { unique: true }); showPanel('data-adt1');
    toast('Sample loaded — the auditor PAN, e-mails and auditor address are placeholders; replace them before a real filing');
  });
  $('#adImportJsonBtn').addEventListener('click', () => $('#adImportJsonInput').click());
  $('#adImportJsonInput').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { loadAdt1FromText(await f.text(), true); } catch (err) { toast(`Invalid ADT-1 JSON: ${err.message}`, true); }
  });
  $('#adClientSelect').addEventListener('change', e => {
    const key = e.target.value;
    if (!key) { adt1Replace(adt1BlankState(), { save: false }); showPanel('data-adt1'); return toast('New client'); }
    adt1Flush();
    const d = LS.get(key, null);
    if (!d || !d.state) { adt1RenderClientList(); return toast('That saved client could not be read', true); }
    adt1Replace(Object.assign(adt1BlankState(), d.state), { key, save: false });
    LS.set('adt1_last_draft', key); showPanel('data-adt1');
    toast(`Opened ${adt1DraftLabel(adt1State)}`);
  });
  $('#adDupBtn').addEventListener('click', () => {
    if (!adt1HasContent(adt1State)) return;
    adt1Replace(adt1DuplicateState(adt1State), { unique: true }); showPanel('data-adt1');
    toast('Copied for the next filing: dates, resolution and SRNs are cleared, the rest is kept');
  });
  $('#adDelBtn').addEventListener('click', e => {
    const btn = e.currentTarget;
    if (!adt1DraftKey) return;
    adt1ConfirmTwice(btn, 'draft:' + adt1DraftKey, () => {
      const key = adt1DraftKey, name = adt1DraftLabel(adt1State);
      // An autosave still pending from a recent edit would write the client straight back: drop it first.
      clearTimeout(adt1SaveTimer); adt1SaveTimer = null;
      LS.del(key); if (LS.get('adt1_last_draft', null) === key) LS.del('adt1_last_draft');
      adt1Replace(adt1BlankState(), { save: false }); showPanel('data-adt1');
      toast(`Deleted ${name}`);
    });
  });
}

// One call from dashboard.js boot().
function initAdt1() {
  bindAdt1Fields(); bindAdt1Review(); bindAdt1Top();
  loadAdt1Draft(); adt1RenderClientList(); renderAdt1();
}
