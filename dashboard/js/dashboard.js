
/* ═══════════════════════════════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════════════════════════════ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// A URL copy-pasted out of prose/markdown/a chat message often drags along trailing punctuation
// (a closing paren, bracket, period, comma or quote that belonged to the sentence, not the URL) —
// strip it so a stray character doesn't silently turn into a 404 nobody can see the cause of.
const sanitizeUrl = s => String(s ?? '').trim().replace(/[)\].,;:'"]+$/, '');
const pad2 = n => String(n).padStart(2, '0');
const toISO = d => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
const fromISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const parseDMY = d => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d || ''); return m ? new Date(+m[3], +m[2] - 1, +m[1]) : null; };
const fmtDMY = dt => `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;
const lastDay = (y, m) => new Date(y, m + 1, 0).getDate();
function addMonths(dt, n) {
  const endOfMonth = dt.getDate() === lastDay(dt.getFullYear(), dt.getMonth());
  const t = new Date(dt.getFullYear(), dt.getMonth() + n, 1);
  const day = endOfMonth ? lastDay(t.getFullYear(), t.getMonth()) : Math.min(dt.getDate(), lastDay(t.getFullYear(), t.getMonth()));
  return new Date(t.getFullYear(), t.getMonth(), day);
}
const addDays = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
const today = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
const num = v => { if (v === '' || v === null || v === undefined) return 0; const n = Number(String(v).replace(/[,\s₹]/g, '')); return Number.isFinite(n) ? n : 0; };
const round2 = n => Math.round(n * 100) / 100;
const fmtINR = n => (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
// Fields look quiet when empty: a zero renders blank with a "0" placeholder, a real number is grouped.
const numDisp = v => { const n = num(v); return n === 0 ? '' : n.toLocaleString('en-IN', { maximumFractionDigits: 2 }); };
const stripNum = v => String(v ?? '').replace(/[,\s₹]/g, '');
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function setPath(o, p, v) { const ks = p.split('.'); let c = o; for (let i = 0; i < ks.length - 1; i++) { if (c[ks[i]] == null || typeof c[ks[i]] !== 'object') c[ks[i]] = {}; c = c[ks[i]]; } c[ks.at(-1)] = v; }
const clone = o => JSON.parse(JSON.stringify(o));
// Shared inline SVG icons — one icon per purpose, reused everywhere rather than invented per screen.
const ICON_CHECK = '<svg class="t-ico" viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg>';
const ICON_ALERT = '<svg class="t-ico" viewBox="0 0 24 24"><line x1="12" y1="6" x2="12" y2="14"/><circle cx="12" cy="18" r="1"/></svg>';
const EMPTY_ICON_SVG = '<svg viewBox="0 0 24 24"><path d="M3 13h6l1 3h4l1-3h6"/><path d="M3 13l2.5-7h13L21 13"/><path d="M3 13v6h18v-6"/></svg>';
const ADMIN_LOCK_SVG = '<svg class="perm-ico" viewBox="0 0 24 24"><rect x="8" y="11" width="8" height="8" rx="1"/><path d="M9 11V9a3 3 0 0 1 6-1.2"/></svg>';
function emptyState(line, hint) { return `<div class="empty-state">${EMPTY_ICON_SVG}<span class="line">${esc(line)}</span>${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</div>`; }
function toast(msg, isErr) { const t = $('#toast'); t.innerHTML = `${isErr ? ICON_ALERT : ICON_CHECK}<span>${esc(msg)}</span>`; t.className = 'toast show' + (isErr ? ' err' : ''); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3500); }
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

/* ═══════════════════════════════════════════════════════════════════
   Schema (keys must match js/field-mapper.js flattenClient / FIELD_MAPPINGS)
   ═══════════════════════════════════════════════════════════════════ */
const BS_LIAB = [
  ['Shareholders’ funds', 'SHARE_CAPITAL', '(a) Share capital'],
  [null, 'RESERVES_SURPLUS', '(b) Reserves and surplus'],
  [null, 'MONEY_AGAINST_WARRANTS', '(c) Money received against share warrants'],
  ['Share application money', 'SHARE_APP_PENDING', 'Share application money pending allotment'],
  ['Non-current liabilities', 'LONG_TERM_BORROWINGS', '(a) Long term borrowings'],
  [null, 'DEFERRED_TAX_LIAB', '(b) Deferred tax liabilities (net)'],
  [null, 'OTHER_LONG_TERM_LIAB', '(c) Other long-term liabilities'],
  [null, 'LONG_TERM_PROVISIONS', '(d) Long term provisions'],
  ['Current liabilities', 'SHORT_TERM_BORROWINGS', '(a) Short term borrowings'],
  [null, 'TRADE_PAYABLES_MSME', '(b)(i) Trade payables — micro and small enterprises'],
  [null, 'TRADE_PAYABLES_OTHER', '(b)(ii) Trade payables — others'],
  [null, 'OTHER_CURRENT_LIAB', '(c) Other current liabilities'],
  [null, 'SHORT_TERM_PROVISIONS', '(d) Short term provisions']
];
const BS_ASSET = [
  ['Non-current assets', 'PPE', '(a)(i) Property, plant and equipment'],
  [null, 'INTANGIBLE_ASSETS', '(a)(ii) Intangible assets'],
  [null, 'CWIP', '(a)(iii) Capital work-in-progress'],
  [null, 'INTANGIBLE_UNDER_DEV', '(a)(iv) Intangible assets under development'],
  [null, 'NON_CURRENT_INVESTMENTS', '(b) Non-current investments'],
  [null, 'DEFERRED_TAX_ASSETS', '(c) Deferred tax assets (net)'],
  [null, 'LONG_TERM_LOANS_ADVANCES', '(d) Long term loans and advances'],
  [null, 'OTHER_NON_CURRENT_ASSETS', '(e) Other non-current assets'],
  ['Current assets', 'CURRENT_INVESTMENTS', '(a) Current investments'],
  [null, 'INVENTORIES', '(b) Inventories'],
  [null, 'TRADE_RECEIVABLES', '(c) Trade receivables'],
  [null, 'CASH_EQUIVALENTS', '(d) Cash and cash equivalents'],
  [null, 'SHORT_TERM_LOANS_ADVANCES', '(e) Short term loans and advances'],
  [null, 'OTHER_CURRENT_ASSETS', '(f) Other current assets']
];
const PL_IN = [
  ['Income', 'REVENUE_OPERATIONS', 'Revenue from operations'],
  [null, 'OTHER_INCOME', 'Other income'],
  ['Expenses', 'EMPLOYEE_EXPENSES', 'Employee benefit expenses'],
  [null, 'MANAGERIAL_REMUNERATION', 'Managerial remuneration'],
  [null, 'FINANCE_COSTS', 'Finance costs'],
  [null, 'DEPRECIATION', 'Depreciation and amortization'],
  [null, 'OTHER_EXPENSES', 'Other expenses'],
  ['Tax', 'CURRENT_TAX', 'Current tax'],
  [null, 'DEFERRED_TAX', 'Deferred tax']
];
const BREAKUP = [
  ['Long term borrowings (unsecured)', 'BS_UNSEC_LT_BONDS', 'Bonds / debentures'], [null, 'BS_UNSEC_LT_BANK_LOANS', 'Term loans from banks'], [null, 'BS_UNSEC_LT_OTHER_TERM_LOANS', 'Term loans from other parties'], [null, 'BS_UNSEC_LT_DEFERRED_PAYMENT', 'Deferred payment liabilities'], [null, 'BS_UNSEC_LT_DEPOSITS', 'Deposits'], [null, 'BS_UNSEC_LT_RELATED_PARTIES', 'Loans and advances from related parties'], [null, 'BS_UNSEC_LT_FINANCE_LEASE', 'Long term maturities of finance lease obligations'], [null, 'BS_UNSEC_LT_OTHER_ADVANCES', 'Other loans and advances'], [null, 'BS_UNSEC_LT_DIRECTOR_GUARANTEE', 'Of which guaranteed by directors'],
  ['Short-term borrowings (unsecured)', 'BS_UNSEC_ST_BANK_DEMAND', 'Loans repayable on demand from banks'], [null, 'BS_UNSEC_ST_OTHER_DEMAND', 'Loans repayable on demand from other parties'], [null, 'BS_UNSEC_ST_RELATED_PARTIES', 'Loans and advances from related parties'], [null, 'BS_UNSEC_ST_DEPOSITS', 'Deposits'], [null, 'BS_UNSEC_ST_OTHER_ADVANCES', 'Other loans and advances'], [null, 'BS_UNSEC_ST_DIRECTOR_GUARANTEE', 'Of which guaranteed by directors'],
  ['Long-term loans and advances (unsecured, considered good)', 'BS_LT_LOANS_GOOD_CAPITAL_ADVANCES', 'Capital advances'], [null, 'BS_LT_LOANS_GOOD_RELATED_PARTIES', 'Loans and advances to related parties'], [null, 'BS_LT_LOANS_GOOD_OTHER', 'Other loans and advances'], [null, 'BS_LT_LOANS_GOOD_PROVISION_RELATED', 'Less: provision — related parties'], [null, 'BS_LT_LOANS_GOOD_PROVISION_OTHER', 'Less: provision — others'], [null, 'BS_LT_LOANS_GOOD_DIRECTORS', 'Due by directors / officers'],
  ['Long-term loans and advances (doubtful)', 'BS_LT_LOANS_DOUBTFUL_CAPITAL_ADVANCES', 'Capital advances'], [null, 'BS_LT_LOANS_DOUBTFUL_RELATED_PARTIES', 'Loans and advances to related parties'], [null, 'BS_LT_LOANS_DOUBTFUL_OTHER', 'Other loans and advances'], [null, 'BS_LT_LOANS_DOUBTFUL_PROVISION_RELATED', 'Less: provision — related parties'], [null, 'BS_LT_LOANS_DOUBTFUL_PROVISION_OTHER', 'Less: provision — others'], [null, 'BS_LT_LOANS_DOUBTFUL_DIRECTORS', 'Due by directors / officers'],
  ['Trade receivables', 'BS_TRADE_RECEIVABLES_SECURED_GOOD', 'Secured, considered good'], [null, 'BS_TRADE_RECEIVABLES_UNSECURED_GOOD', 'Unsecured, considered good'], [null, 'BS_TRADE_RECEIVABLES_DOUBTFUL', 'Doubtful'], [null, 'BS_TRADE_RECEIVABLES_PROVISION', 'Less: provision for bad and doubtful debts'], [null, 'BS_TRADE_RECEIVABLES_DIRECTORS', 'Debt due by directors / officers']
];
const PL_DETAIL = [
  ['Domestic turnover', 'PL_DOMESTIC_MANUFACTURED', 'Sale of goods manufactured'], [null, 'PL_DOMESTIC_TRADED', 'Sale of goods traded'], [null, 'PL_DOMESTIC_SERVICES', 'Sale or supply of services'],
  ['Export turnover', 'PL_EXPORT_MANUFACTURED', 'Sale of goods manufactured'], [null, 'PL_EXPORT_TRADED', 'Sale of goods traded'], [null, 'PL_EXPORT_SERVICES', 'Sale or supply of services'],
  ['Other income', 'PL_DIVIDEND_INCOME', 'Dividend income'], [null, 'PL_INTEREST_INCOME', 'Interest income'], [null, 'PL_INVESTMENT_GAIN_LOSS', 'Net gain / loss on sale of investments'], [null, 'PL_OTHER_NONOPERATING_INCOME', 'Other non-operating income'],
  ['Expenses', 'PL_MATERIALS_CONSUMED', 'Cost of materials consumed'], [null, 'PL_STOCK_PURCHASES', 'Purchases of stock in trade'], [null, 'PL_INVENTORY_FINISHED', 'Changes in inventories — finished goods'], [null, 'PL_INVENTORY_WIP', 'Changes in inventories — work-in-progress'], [null, 'PL_INVENTORY_STOCK', 'Changes in inventories — stock in trade'], [null, 'PL_EMPLOYEE_BENEFITS', 'Employee benefit expenses'], [null, 'PL_MANAGERIAL_REMUNERATION', 'Managerial remuneration'], [null, 'PL_AUDITOR_PAYMENT', 'Payment to auditors'], [null, 'PL_INSURANCE', 'Insurance expenses'], [null, 'PL_POWER_FUEL', 'Power and fuel'], [null, 'PL_FINANCE_COSTS', 'Finance costs'], [null, 'PL_DEPRECIATION', 'Depreciation and amortization'], [null, 'PL_OTHER_EXPENSES', 'Other expenses'],
  ['Other items', 'PL_EXCEPTIONAL_ITEMS', 'Exceptional items'], [null, 'PL_EXTRAORDINARY_ITEMS', 'Extraordinary items'], [null, 'PL_DISCONTINUED_OPERATIONS', 'Profit / (loss) from discontinuing operations'], [null, 'PL_DISCONTINUED_TAX', 'Tax expense of discontinuing operations'], [null, 'PL_EPS_BASIC_AFTER_EXTRAORDINARY', 'EPS after extraordinary items — basic'], [null, 'PL_EPS_DILUTED_AFTER_EXTRAORDINARY', 'EPS after extraordinary items — diluted']
];
const FX = [
  ['Earnings in foreign exchange', 'FX_IN_EXPORT_GOODS', 'Export of goods (FOB)'], [null, 'FX_IN_INTEREST_DIVIDEND', 'Interest and dividend'], [null, 'FX_IN_ROYALTY', 'Royalty'], [null, 'FX_IN_KNOW_HOW', 'Know-how'], [null, 'FX_IN_PROFESSIONAL_FEES', 'Professional and consultation fees'], [null, 'FX_IN_OTHER_INCOME', 'Other income'],
  ['Expenditure in foreign exchange', 'FX_OUT_RAW_MATERIAL', 'Import — raw material (CIF)'], [null, 'FX_OUT_COMPONENTS_SPARES', 'Import — components and spare parts'], [null, 'FX_OUT_CAPITAL_GOODS', 'Import — capital goods'], [null, 'FX_OUT_ROYALTY', 'Royalty'], [null, 'FX_OUT_KNOW_HOW', 'Know-how'], [null, 'FX_OUT_PROFESSIONAL_FEES', 'Professional and consultation fees'], [null, 'FX_OUT_INTEREST', 'Interest'], [null, 'FX_OUT_OTHER_MATTERS', 'Other matters'], [null, 'FX_OUT_DIVIDEND', 'Dividend paid']
];
const FP_BS = [
  ['FP_BS_01', '1. Amount of issue for contracts without payment received in cash'], ['FP_BS_02', '2. Share application money given'], ['FP_BS_03', '3. Share application money given during the period'], ['FP_BS_04', '4. Share application money received during the period'], ['FP_BS_05', '5. Share application money received and due for refund'],
  ['FP_BS_06', '6. Paid-up capital held by foreign company'], ['FP_BS_06_PERCENT', '6. … percentage'], ['FP_BS_07', '7. Paid-up capital held by foreign holding / its subsidiaries'], ['FP_BS_07_PERCENT', '7. … percentage'],
  ['FP_BS_08', '8. Number of shares bought back'], ['FP_BS_09', '9. Deposits accepted or renewed'], ['FP_BS_10', '10. Deposits matured and claimed but not paid during the period'], ['FP_BS_11', '11. Deposits matured and claimed but not paid'], ['FP_BS_12', '12. Deposits matured, but not claimed'], ['FP_BS_13', '13. Unclaimed matured debentures'], ['FP_BS_14', '14. Debentures claimed but not paid'], ['FP_BS_15', '15. Interest on deposits accrued and due but not paid'], ['FP_BS_16', '16. Unpaid dividend'], ['FP_BS_17', '17. Investment in subsidiary companies'], ['FP_BS_18', '18. Investment in government companies'], ['FP_BS_19', '19. Capital reserve'], ['FP_BS_20', '20. Amount due for transfer to IEPF'], ['FP_BS_21', '21. Inter-corporate deposits'], ['FP_BS_22', '22. Gross value of transaction as per AS-18'], ['FP_BS_23', '23. Capital subsidies / grants from government'], ['FP_BS_24', '24. Calls unpaid by directors'], ['FP_BS_25', '25. Calls unpaid by others'], ['FP_BS_26', '26. Forfeited shares (amount originally paid-up)'], ['FP_BS_27', '27. Forfeited shares reissued'], ['FP_BS_28', '28. Borrowing from foreign institutional agencies'], ['FP_BS_29', '29. Borrowing from foreign companies'], ['FP_BS_30', '30. Inter-corporate borrowings — secured'], ['FP_BS_31', '31. Inter-corporate borrowings — unsecured'], ['FP_BS_32', '32. Commercial paper'], ['FP_BS_33', '33. Warrants converted into equity shares'], ['FP_BS_34', '34. Warrants converted into preference shares'], ['FP_BS_35', '35. Warrants converted into debentures'], ['FP_BS_36', '36. Warrants issued (foreign currency)'], ['FP_BS_37', '37. Warrants issued (Rupees)'], ['FP_BS_38', '38. Default in payment of short-term borrowings and interest'], ['FP_BS_39', '39. Default in payment of long-term borrowings and interest'],
  ['FP_BS_42', '42. Shareholders allotted shares under private placement'], ['FP_BS_43', '43. Secured loan'], ['FP_BS_46', '46. Miscellaneous expenditure not written off'], ['FP_BS_47', '47. Unhedged foreign exchange exposure']
];
const FP_PL = [
  ['FP_PL_PROPOSED_DIVIDEND', '1. Proposed dividend'], ['FP_PL_PROPOSED_DIVIDEND_PERCENT', '1. … percentage'], ['FP_PL_GOVERNMENT_GRANTS', '5. Revenue subsidies / grants from government'], ['FP_PL_RENT_PAID', '6. Rent paid'], ['FP_PL_STORES_SPARES', '7. Consumption of stores and spare parts'], ['FP_PL_RELATED_PARTY_GROSS', '8. Gross value of related-party transactions (AS-18)'], ['FP_PL_RELATED_PARTY_BAD_DEBTS', '9. Bad debts of related parties (AS-18)'], ['FP_PL_SECTION_182', '10. Contribution under section 182(3)']
];
const SC_MOVES = {
  EQ: { begin: 'SC_EQ_BEGIN', inc: ['PUBLIC', 'RIGHTS', 'BONUS', 'PLACEMENT', 'ESOP', 'SWEAT', 'PREFERENCE_CONVERSION', 'DEBENTURE_CONVERSION', 'GDR'], dec: ['BUYBACK', 'FORFEITED', 'REDUCTION'] },
  PREF: { begin: 'SC_PREF_BEGIN', inc: ['ISSUE', 'REISSUE'], dec: ['REDEMPTION', 'FORFEITED', 'REDUCTION'] }
};
const SC_LABEL = { PUBLIC: 'Public issues', RIGHTS: 'Rights issue', BONUS: 'Bonus issue', PLACEMENT: 'Private placement / preferential allotment', ESOP: 'ESOPs', SWEAT: 'Sweat equity', PREFERENCE_CONVERSION: 'Conversion of preference shares', DEBENTURE_CONVERSION: 'Conversion of debentures', GDR: 'GDRs / ADRs', BUYBACK: 'Buy-back', FORFEITED: 'Shares forfeited', REDUCTION: 'Reduction of share capital', ISSUE: 'Issues of shares', REISSUE: 'Re-issue of forfeited shares', REDEMPTION: 'Redemption of shares' };
function scKeys() {
  const out = [];
  for (const cls of ['EQ', 'PREF']) {
    const m = SC_MOVES[cls];
    for (const c of ['SHARES', 'NOMINAL', 'PAID']) out.push(`${m.begin}_${c}`);
    for (const kind of ['INC', 'DEC']) for (const id of m[kind === 'INC' ? 'inc' : 'dec']) for (const c of ['SHARES', 'NOMINAL', 'PAID', 'PREMIUM']) out.push(`SC_${cls}_${kind}_${id}_${c}`);
  }
  return out;
}
const AUDITOR_FIELDS = [
  ['AUDITOR_PAN', 'PAN of auditor / firm', 'text'], ['AUDITOR_CATEGORY', 'Category', 'select', ["Auditor's firm", 'Individual']], ['AUDITOR_FIRM_REG', 'Firm registration / membership no.', 'text'], ['AUDITOR_NAME', 'Name of auditor / firm', 'text'],
  ['AUDITOR_ADDR1', 'Address line 1', 'text'], ['AUDITOR_ADDR2', 'Address line 2', 'text'], ['AUDITOR_COUNTRY', 'Country', 'text'], ['AUDITOR_PIN', 'PIN code', 'pin'], ['AUDITOR_AREA', 'Area / locality', 'area'], ['AUDITOR_CITY', 'City', 'text'], ['AUDITOR_DISTRICT', 'District', 'text'], ['AUDITOR_STATE', 'State / UT', 'text'],
  ['MEMBER_NAME', 'Member signing for the firm', 'text'], ['MEMBER_NUMBER', 'Membership number', 'text']
];
const FORM_DEFS = {
  aoc4: { label: 'AOC-4', requirements: [
    { tag: 'mandatory', text: 'Copy of financial statements duly authenticated u/s 134 (incl. auditor’s report) — PDF' },
    { tag: 'optional', text: 'XBRL instance documents — only for companies filing AOC-4 XBRL' },
    { tag: 'optional', text: 'Consolidated financial statements — only if consolidated FS are filed' },
    { tag: 'optional', text: 'Supplementary / test audit report u/s 143 and CAG comments — government companies' },
    { tag: 'optional', text: 'Secretarial audit report — if applicable' },
    { tag: 'optional', text: 'Statement of facts/reasons — if AGM not held or FS not adopted' },
    { tag: 'optional', text: 'Optional attachments — up to 5' } ] }
};

/* ═══════════════════════════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════════════════════════ */
function blankState() {
  const s = {
    meta: { fy: '', faceValue: 10, companyName: '', registeredAddress: '', companyClass: '', companyStatus: '', registrationDate: '', revenueKind: 'services', brSameAsFs: true, prevClientId: '' },
    sources: {},
    general: { CIN: '', FY_FROM: '', FY_TO: '', BOARD_MEETING_DATE: '', NATURE_FS: 'adopted', PROVISIONAL_FILED_EARLIER: 'No', ADOPTED_IN_ADJOURNED_AGM: 'No', BOARD_REPORT_DATE: '', AUDITOR_SIGN_DATE: '', AGM_HELD: 'Yes', AGM_DATE: '', AGM_DUE_DATE: '', AGM_EXTENSION: 'No', GNL1_SRN: '', AGM_EXT_DUE_DATE: '' },
    signatoriesFS: [{ din: '', name: '', designation: 'Director', date: '' }, { din: '', name: '', designation: 'Director', date: '' }],
    signatoriesBR: [],
    subsidiary: { IS_SUBSIDIARY: 'No', HOLDING_CIN: '', HOLDING_NAME: '', PROVISION_SECTION: '', HAS_SUBSIDIARY_OR_JV: 'No' },
    auditor: { ADT_SRN: '', NUM_AUDITORS: '1', AUDITOR_PAN: '', AUDITOR_CATEGORY: "Auditor's firm", AUDITOR_FIRM_REG: '', AUDITOR_NAME: '', AUDITOR_ADDR1: '', AUDITOR_ADDR2: '', AUDITOR_COUNTRY: 'India', AUDITOR_PIN: '', AUDITOR_AREA: '', AUDITOR_CITY: '', AUDITOR_DISTRICT: '', AUDITOR_STATE: '', MEMBER_NAME: '', MEMBER_NUMBER: '' },
    industry: { TYPE_OF_INDUSTRY: 'Commercial & Industrial', SCHEDULE_III: 'Yes', CONSOLIDATED_FS: 'No', MAINTAIN_ELECTRONIC_BOOKS: 'Yes', SERVER_ADDR1: '', SERVER_ADDR2: '', SERVER_COUNTRY: 'India', SERVER_PIN: '', SERVER_AREA: '', SERVER_CITY: '', SERVER_DISTRICT: '', SERVER_STATE: '', MAINTAINED_ON_CLOUD: 'No', SERVICE_PROVIDER_NAME: '', SERVICE_PROVIDER_IP: '', SERVICE_PROVIDER_LOCATION: '', SERVICE_PROVIDER_ADDRESS: '' },
    balanceSheet: { current: { asOf: '' }, previous: { asOf: '' } },
    profitLoss: { current: { period: '' }, previous: { period: '' } },
    shareCapital: { FACE_VALUE: 10, AUTH_SHARES: 0, ISSUED_SHARES: 0, PAID_UP_SHARES: 0, AUTH_NOMINAL: 0, ISSUED_NOMINAL: 0, PAID_UP_NOMINAL: 0 },
    financialParametersBS: { OPERATING_LEASE_CONVERTED: 'No', OPERATING_LEASE_DETAILS: '', NET_WORTH: 0, GROSS_PPE_INTANGIBLE: 0, DEPRECIATION_AMORTIZATION_BS: 0 },
    costRecords: { MAINTENANCE_MANDATED: 'No', AUDIT_MANDATED: 'No' },
    // `extra` holds categories 2, 3, ... (category 1 stays in the flat fields above for
    // backward compatibility with the single-category layout). Each entry: { code, desc, turnover }.
    principalProducts: { TOTAL_CATEGORIES: 1, CATEGORY_CODE: '', CATEGORY_DESC: '', CATEGORY_TURNOVER: 0, HIGHEST_CODE: '', HIGHEST_DESC: '', HIGHEST_TURNOVER: 0, extra: [] },
    relatedParty: { ANY_TRANSACTION: 'No' },
    auditorReport: { CAG_COMMENTED: 'Not applicable' },
    csr: { CSR_APPLICABILITY: 'Not applicable' },
    secretarialAudit: { SECRETARIAL_AUDIT_APPLICABLE: 'No' },
    financialParametersPL: { FP_PL_EPS_BASIC: 0, FP_PL_EPS_DILUTED: 0, FP_PL_FOREIGN_INCOME: 0, FP_PL_FOREIGN_EXPENDITURE: 0 },
    balanceSheetBreakup: {}, profitLossDetails: {}, foreignExchange: {}, shareCapitalRaised: {}
  };
  for (const [, k] of [...BS_LIAB, ...BS_ASSET]) { s.balanceSheet.current[k] = 0; s.balanceSheet.previous[k] = 0; }
  for (const [, k] of PL_IN) { s.profitLoss.current[k] = 0; s.profitLoss.previous[k] = 0; }
  for (const [k] of FP_BS) s.financialParametersBS[k] = 0;
  for (const [k] of FP_PL) s.financialParametersPL[k] = 0;
  for (const [, k] of BREAKUP) s.balanceSheetBreakup[k] = { current: 0, previous: 0 };
  for (const [, k] of PL_DETAIL) s.profitLossDetails[k] = { current: 0, previous: 0 };
  for (const [, k] of FX) s.foreignExchange[k] = { current: 0, previous: 0 };
  for (const k of scKeys()) s.shareCapitalRaised[k] = 0;
  return s;
}
let state = blankState();
const FIXED = new Set(['manual', 'sandbox', 'ai', 'doc']); // sources derive() must not overwrite
const srcOf = p => state.sources[p];
function setValue(path, value, source = 'manual') {
  setPath(state, path, value);
  if (source === 'auto') { if (!FIXED.has(srcOf(path))) state.sources[path] = 'auto'; }
  else state.sources[path] = source;
}
const derivablePaths = new Set(); // every path derive() knows how to fill; only these get a "↺ auto" link
function auto(path, value) { derivablePaths.add(path); if (!FIXED.has(srcOf(path))) { setPath(state, path, value); state.sources[path] = 'auto'; } }
function computed(path, value) { setPath(state, path, value); state.sources[path] = 'computed'; }
function resetToAuto(path) { delete state.sources[path]; afterChange(); }

/* ═══════════════════════════════════════════════════════════════════
   Derivations: fill a little, get the rest
   ═══════════════════════════════════════════════════════════════════ */
function fyYears() { const m = /^(\d{4})-(\d{2})$/.exec(state.meta.fy || ''); return m ? { y1: +m[1], y2: +m[1] + 1 } : null; }
function derive() {
  const g = state.general, bs = state.balanceSheet, pl = state.profitLoss, sc = state.shareCapital;
  const fy = fyYears();
  if (fy) {
    auto('general.FY_FROM', `01/04/${fy.y1}`);
    auto('general.FY_TO', `31/03/${fy.y2}`);
    auto('balanceSheet.current.asOf', `31/03/${fy.y2}`);
    auto('balanceSheet.previous.asOf', `31/03/${fy.y1}`);
    auto('profitLoss.current.period', `FY ${fy.y1}-${String(fy.y2).slice(2)}`);
    auto('profitLoss.previous.period', `FY ${fy.y1 - 1}-${String(fy.y1).slice(2)}`);
  }
  const fyEnd = parseDMY(g.FY_TO);
  if (fyEnd) {
    // AGM: within 6 months of FY end (OPC: 180 days); a company's first AGM may be held within 9 months.
    const isOPC = /opc|one person/i.test(state.meta.companyClass || '');
    const reg = parseDMY(state.meta.registrationDate ? fromISO(state.meta.registrationDate) || state.meta.registrationDate : '');
    const firstAgm = reg && parseDMY(g.FY_FROM) && reg >= parseDMY(g.FY_FROM) && reg <= fyEnd;
    const due = isOPC ? addDays(fyEnd, 180) : addMonths(fyEnd, firstAgm ? 9 : 6);
    auto('general.AGM_DUE_DATE', fmtDMY(due));
    const agmDue = g.AGM_DUE_DATE;
    auto('general.AGM_DATE', g.AGM_HELD === 'Yes' ? agmDue : '');
    const board = g.AGM_DATE || agmDue;
    auto('general.BOARD_MEETING_DATE', board);
    auto('general.BOARD_REPORT_DATE', g.BOARD_MEETING_DATE);
    auto('general.AUDITOR_SIGN_DATE', g.BOARD_MEETING_DATE);
  }
  // Signatories: FS rows sign on the board-meeting date; Board's report rows mirror FS rows.
  state.signatoriesFS.forEach((row, i) => { auto(`signatoriesFS.${i}.date`, g.BOARD_MEETING_DATE); auto(`signatoriesFS.${i}.designation`, row.designation || 'Director'); });
  if (state.meta.brSameAsFs) {
    state.signatoriesBR = state.signatoriesFS.map(r => ({ din: r.din, name: r.name, designation: r.designation, date: g.BOARD_REPORT_DATE }));
  } else {
    state.signatoriesBR.forEach((row, i) => auto(`signatoriesBR.${i}.date`, g.BOARD_REPORT_DATE));
  }
  // Share capital: shares = nominal / face value; issued = paid-up unless edited.
  const fv = num(sc.FACE_VALUE) || 10;
  computed('shareCapital.AUTH_SHARES', fv ? Math.round(num(sc.AUTH_NOMINAL) / fv) : 0);
  auto('shareCapital.ISSUED_NOMINAL', num(sc.PAID_UP_NOMINAL));
  computed('shareCapital.PAID_UP_SHARES', fv ? Math.round(num(sc.PAID_UP_NOMINAL) / fv) : 0);
  computed('shareCapital.ISSUED_SHARES', fv ? Math.round(num(sc.ISSUED_NOMINAL) / fv) : 0);
  auto('shareCapitalRaised.SC_EQ_BEGIN_SHARES', sc.PAID_UP_SHARES);
  auto('shareCapitalRaised.SC_EQ_BEGIN_NOMINAL', num(sc.PAID_UP_NOMINAL));
  auto('shareCapitalRaised.SC_EQ_BEGIN_PAID', num(sc.PAID_UP_NOMINAL));
  // Balance sheet: share capital line defaults to paid-up capital; totals and net worth are computed.
  auto('balanceSheet.current.SHARE_CAPITAL', num(sc.PAID_UP_NOMINAL));
  for (const per of ['current', 'previous']) {
    const b = bs[per];
    const liab = BS_LIAB.reduce((a, [, k]) => a + num(b[k]), 0);
    const assets = BS_ASSET.reduce((a, [, k]) => a + num(b[k]), 0);
    computed(`balanceSheet.${per}.TOTAL_EQUITY_LIABILITIES`, liab);
    computed(`balanceSheet.${per}.TOTAL_ASSETS`, assets);
    auto(`balanceSheetBreakup.BS_TRADE_RECEIVABLES_UNSECURED_GOOD.${per}`, num(b.TRADE_RECEIVABLES));
  }
  computed('financialParametersBS.NET_WORTH', num(bs.current.SHARE_CAPITAL) + num(bs.current.RESERVES_SURPLUS));
  auto('financialParametersBS.DEPRECIATION_AMORTIZATION_BS', num(pl.current.DEPRECIATION));
  // Profit & loss: totals, PBT, PAT, EPS; detail rows mirror the inputs.
  const shares = num(sc.PAID_UP_SHARES);
  for (const per of ['current', 'previous']) {
    const p = pl[per];
    const ti = num(p.REVENUE_OPERATIONS) + num(p.OTHER_INCOME);
    const te = ['EMPLOYEE_EXPENSES', 'MANAGERIAL_REMUNERATION', 'FINANCE_COSTS', 'DEPRECIATION', 'OTHER_EXPENSES'].reduce((a, k) => a + num(p[k]), 0);
    const pbt = ti - te, tax = num(p.CURRENT_TAX) + num(p.DEFERRED_TAX), pat = pbt - tax;
    computed(`profitLoss.${per}.TOTAL_INCOME`, ti);
    computed(`profitLoss.${per}.TOTAL_EXPENSES`, te);
    computed(`profitLoss.${per}.PROFIT_BEFORE_TAX`, pbt);
    computed(`profitLoss.${per}.TOTAL_TAX`, tax);
    computed(`profitLoss.${per}.PROFIT_AFTER_TAX`, pat);
    const eps = shares ? round2(pat / shares) : 0;
    auto(`profitLoss.${per}.EPS_BASIC`, eps);
    auto(`profitLoss.${per}.EPS_DILUTED`, num(p.EPS_BASIC));
    const revKey = { services: 'PL_DOMESTIC_SERVICES', manufactured: 'PL_DOMESTIC_MANUFACTURED', traded: 'PL_DOMESTIC_TRADED' }[state.meta.revenueKind] || 'PL_DOMESTIC_SERVICES';
    for (const k of ['PL_DOMESTIC_SERVICES', 'PL_DOMESTIC_MANUFACTURED', 'PL_DOMESTIC_TRADED']) auto(`profitLossDetails.${k}.${per}`, k === revKey ? num(p.REVENUE_OPERATIONS) : 0);
    auto(`profitLossDetails.PL_OTHER_NONOPERATING_INCOME.${per}`, num(p.OTHER_INCOME));
    auto(`profitLossDetails.PL_EMPLOYEE_BENEFITS.${per}`, num(p.EMPLOYEE_EXPENSES));
    auto(`profitLossDetails.PL_MANAGERIAL_REMUNERATION.${per}`, num(p.MANAGERIAL_REMUNERATION));
    auto(`profitLossDetails.PL_FINANCE_COSTS.${per}`, num(p.FINANCE_COSTS));
    auto(`profitLossDetails.PL_DEPRECIATION.${per}`, num(p.DEPRECIATION));
    auto(`profitLossDetails.PL_OTHER_EXPENSES.${per}`, num(p.OTHER_EXPENSES));
    auto(`profitLossDetails.PL_EPS_BASIC_AFTER_EXTRAORDINARY.${per}`, num(p.EPS_BASIC));
    auto(`profitLossDetails.PL_EPS_DILUTED_AFTER_EXTRAORDINARY.${per}`, num(p.EPS_DILUTED));
  }
  auto('financialParametersPL.FP_PL_EPS_BASIC', num(pl.current.EPS_BASIC));
  auto('financialParametersPL.FP_PL_EPS_DILUTED', num(pl.current.EPS_DILUTED));
  computed('financialParametersPL.FP_PL_FOREIGN_INCOME', FX.filter(([, k]) => k.startsWith('FX_IN_')).reduce((a, [, k]) => a + num(state.foreignExchange[k].current), 0));
  computed('financialParametersPL.FP_PL_FOREIGN_EXPENDITURE', FX.filter(([, k]) => k.startsWith('FX_OUT_')).reduce((a, [, k]) => a + num(state.foreignExchange[k].current), 0));
  // Products / services: each MCA row (category 1, plus any extra categories) independently
  // reports its own category figures AND its own "highest turnover contributing product/service"
  // within that category — it is not a comparison across categories. Category 1's turnover
  // follows revenue; "Number of categories" follows how many extra rows are listed; and each
  // row's highest-turnover fields default to that row's own category figures as a starting
  // point (a single category's whole turnover trivially also describes its own top product,
  // same for an extra category until split further) — still just a default the preparer can
  // override (see HIGHEST_CODE's 4-vs-8-digit note below).
  const pp = state.principalProducts;
  auto('principalProducts.CATEGORY_TURNOVER', num(pl.current.REVENUE_OPERATIONS));
  computed('principalProducts.TOTAL_CATEGORIES', 1 + pp.extra.length);
  auto('principalProducts.HIGHEST_TURNOVER', num(pp.CATEGORY_TURNOVER));
  auto('principalProducts.HIGHEST_DESC', pp.CATEGORY_DESC);
  // Starting point only: with one category it is also the highest-turnover one, but NPCS's
  // 8-digit code is a finer sub-classification than the 4-digit category — pre-fill from it
  // so there's nothing to retype, then flag it in validate() until it is widened to 8 digits.
  auto('principalProducts.HIGHEST_CODE', pp.CATEGORY_CODE);
  pp.extra.forEach((c, i) => {
    auto(`principalProducts.extra.${i}.highTurnover`, num(c.turnover));
    auto(`principalProducts.extra.${i}.highDesc`, c.desc);
    auto(`principalProducts.extra.${i}.highCode`, c.code);
  });
  // Conditional sections.
  if (g.AGM_EXTENSION !== 'Yes') { auto('general.GNL1_SRN', ''); auto('general.AGM_EXT_DUE_DATE', ''); }
  if (state.subsidiary.IS_SUBSIDIARY !== 'Yes') { auto('subsidiary.HOLDING_CIN', ''); auto('subsidiary.HOLDING_NAME', ''); auto('subsidiary.PROVISION_SECTION', ''); }
}

/* ═══════════════════════════════════════════════════════════════════
   Validation (MCA instruction kit rules + extension constraints)
   ═══════════════════════════════════════════════════════════════════ */
const RE = { cin: /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/, pan: /^[A-Z]{5}\d{4}[A-Z]$/, din: /^\d{8}$/, srn: /^[A-Z]{1,2}\d{7,9}$/, pin: /^\d{6}$/ };
function validate() {
  const errors = [], warnings = [];
  const err = (path, msg) => errors.push({ path, msg });
  const warn = (path, msg) => warnings.push({ path, msg });
  const g = state.general, a = state.auditor, bs = state.balanceSheet, pl = state.profitLoss;
  if (!RE.cin.test(g.CIN)) err('general.CIN', 'CIN must be 21 characters (e.g. U80904KA2018PTC119370).');
  if (!state.meta.fy) err('meta.fy', 'Choose the financial year.');
  const from = parseDMY(g.FY_FROM), to = parseDMY(g.FY_TO), bm = parseDMY(g.BOARD_MEETING_DATE), agm = parseDMY(g.AGM_DATE), due = parseDMY(g.AGM_DUE_DATE), aud = parseDMY(g.AUDITOR_SIGN_DATE);
  if (from && to && to <= from) err('general.FY_TO', 'FY end must be after FY start.');
  if (!bm) err('general.BOARD_MEETING_DATE', 'Board meeting date (FS approval) is required.');
  if (bm && to && bm < to) err('general.BOARD_MEETING_DATE', 'Board meeting date must be on or after the FY end date.');
  if (bm && bm > today()) err('general.BOARD_MEETING_DATE', 'Board meeting date cannot be in the future.');
  if (aud && bm && aud > bm) warn('general.AUDITOR_SIGN_DATE', 'Auditor signing date is after the board meeting date.');
  if (to && due && due > addMonths(to, 9)) err('general.AGM_DUE_DATE', 'AGM due date cannot be more than 9 months after FY end.');
  if (g.AGM_HELD === 'Yes') {
    if (!agm) err('general.AGM_DATE', 'AGM date is required when AGM was held.');
    if (agm && agm > today()) err('general.AGM_DATE', 'AGM date cannot be in the future.');
    if (agm && to && agm < to) err('general.AGM_DATE', 'AGM date must be after the FY end date.');
    if (agm && due && agm > due && g.AGM_EXTENSION !== 'Yes') warn('general.AGM_DATE', 'AGM held after its due date without an extension — additional fee applies.');
  }
  if (g.AGM_EXTENSION === 'Yes' && !g.GNL1_SRN) err('general.GNL1_SRN', 'SRN of GNL-1 is required when an AGM extension was granted.');
  const fs = state.signatoriesFS.filter(r => r.din || r.name);
  if (!fs.length) err('signatoriesFS', 'At least one signatory of the financial statements is required.');
  fs.forEach((r, i) => { if (!RE.din.test(r.din)) err(`signatoriesFS.${i}.din`, `FS signatory ${i + 1}: DIN must be 8 digits (PAN for CEO/CFO/manager).`); if (!r.date) err(`signatoriesFS.${i}.date`, `FS signatory ${i + 1}: signing date missing.`); });
  if (!state.meta.brSameAsFs) {
    const br = state.signatoriesBR.filter(r => r.din || r.name);
    if (!br.length) err('signatoriesBR', 'At least one signatory of the Board’s report is required.');
    br.forEach((r, i) => { if (!RE.din.test(r.din)) err(`signatoriesBR.${i}.din`, `Board’s report signatory ${i + 1}: DIN must be 8 digits.`); });
  }
  if (!a.ADT_SRN) err('auditor.ADT_SRN', 'SRN of Form ADT-1 is required (MCA fills the auditor details from it).');
  else if (!RE.srn.test(a.ADT_SRN)) warn('auditor.ADT_SRN', 'ADT-1 SRN usually looks like AC0363504.');
  if (a.AUDITOR_PAN && !RE.pan.test(a.AUDITOR_PAN)) err('auditor.AUDITOR_PAN', 'Auditor PAN format is invalid.');
  if (a.AUDITOR_PIN && !RE.pin.test(a.AUDITOR_PIN)) err('auditor.AUDITOR_PIN', 'Auditor PIN must be 6 digits.');
  if (!a.AUDITOR_NAME) warn('auditor.AUDITOR_NAME', 'Auditor name is blank — the extension will rely on MCA’s ADT-1 lookup.');
  if (state.industry.MAINTAIN_ELECTRONIC_BOOKS === 'Yes') {
    if (!state.industry.SERVER_ADDR1) err('industry.SERVER_ADDR1', 'Server address line 1 (12b) is required when books are kept electronically.');
    if (!RE.pin.test(state.industry.SERVER_PIN)) err('industry.SERVER_PIN', 'Server address PIN (12b) must be 6 digits.');
  }
  for (const per of ['current', 'previous']) {
    const b = bs[per];
    if (Math.abs(num(b.TOTAL_EQUITY_LIABILITIES) - num(b.TOTAL_ASSETS)) > 0.5) err(`balanceSheet.${per}.TOTAL_ASSETS`, `Balance sheet (${per}) does not balance: equity & liabilities ${fmtINR(num(b.TOTAL_EQUITY_LIABILITIES))} vs assets ${fmtINR(num(b.TOTAL_ASSETS))}.`);
    if (num(b.TOTAL_ASSETS) === 0) warn(`balanceSheet.${per}.TOTAL_ASSETS`, `Balance sheet (${per}) is all zeros.`);
  }
  for (const per of ['current', 'previous']) {
    const p = pl[per];
    if (num(p.PROFIT_AFTER_TAX) !== 0 && Math.sign(num(p.EPS_BASIC)) !== Math.sign(num(p.PROFIT_AFTER_TAX))) warn(`profitLoss.${per}.EPS_BASIC`, `EPS sign (${per}) does not match profit/loss.`);
  }
  if (num(state.shareCapital.PAID_UP_NOMINAL) <= 0) err('shareCapital.PAID_UP_NOMINAL', 'Paid-up capital is required (fetch it from Filesure or enter it).');
  if (num(bs.current.SHARE_CAPITAL) !== num(state.shareCapital.PAID_UP_NOMINAL)) warn('balanceSheet.current.SHARE_CAPITAL', 'Share capital on the balance sheet differs from paid-up capital.');
  {
    const pp = state.principalProducts;
    if (!pp.CATEGORY_CODE) err('principalProducts.CATEGORY_CODE', 'Product / service category code (NPCS 4-digit) is required.');
    else if (!/^\d{4}$/.test(String(pp.CATEGORY_CODE).trim())) err('principalProducts.CATEGORY_CODE', 'Category code must be exactly 4 digits.');
    if (!pp.CATEGORY_DESC) err('principalProducts.CATEGORY_DESC', 'Category description is required.');
    if (num(pp.CATEGORY_TURNOVER) < 0) err('principalProducts.CATEGORY_TURNOVER', 'Category turnover cannot be negative.');
    if (!pp.HIGHEST_CODE) err('principalProducts.HIGHEST_CODE', 'Highest-turnover product / service code (8-digit) is required.');
    else if (!/^\d{8}$/.test(String(pp.HIGHEST_CODE).trim())) err('principalProducts.HIGHEST_CODE', 'Highest-turnover code must be exactly 8 digits — widen it from the 4-digit category code to the specific NPCS/ITC product code.');
    if (!pp.HIGHEST_DESC) err('principalProducts.HIGHEST_DESC', 'Description of the highest-turnover product/service is required.');
    if (num(pp.HIGHEST_TURNOVER) < 0) err('principalProducts.HIGHEST_TURNOVER', 'Highest-turnover amount cannot be negative.');
    if (num(pp.HIGHEST_TURNOVER) > num(pp.CATEGORY_TURNOVER)) err('principalProducts.HIGHEST_TURNOVER', 'Highest-turnover product/service amount cannot exceed its category\'s turnover.');
    pp.extra.forEach((c, i) => {
      const n = i + 2, p = `principalProducts.extra.${i}`;
      if (!c.code) err(`${p}.code`, `Category ${n} code (NPCS 4-digit) is required.`);
      else if (!/^\d{4}$/.test(String(c.code).trim())) err(`${p}.code`, `Category ${n} code must be exactly 4 digits.`);
      if (!c.desc) err(`${p}.desc`, `Category ${n} description is required.`);
      if (num(c.turnover) < 0) err(`${p}.turnover`, `Category ${n} turnover cannot be negative.`);
      if (!c.highCode) err(`${p}.highCode`, `Category ${n} highest-turnover code (8-digit) is required.`);
      else if (!/^\d{8}$/.test(String(c.highCode).trim())) err(`${p}.highCode`, `Category ${n} highest-turnover code must be exactly 8 digits.`);
      if (!c.highDesc) err(`${p}.highDesc`, `Category ${n} highest-turnover description is required.`);
      if (num(c.highTurnover) < 0) err(`${p}.highTurnover`, `Category ${n} highest-turnover amount cannot be negative.`);
      if (num(c.highTurnover) > num(c.turnover)) err(`${p}.highTurnover`, `Category ${n}'s highest-turnover amount cannot exceed that category's turnover.`);
    });
    const revenue = num(pl.current.REVENUE_OPERATIONS);
    const sumCategoryTurnover = num(pp.CATEGORY_TURNOVER) + pp.extra.reduce((a, c) => a + num(c.turnover), 0);
    if (revenue > 0 && sumCategoryTurnover > revenue + 0.5) warn('principalProducts.CATEGORY_TURNOVER', `Sum of category turnovers (${fmtINR(sumCategoryTurnover)}) exceeds current-year revenue from operations (${fmtINR(revenue)}).`);
  }
  const paidUp = num(state.shareCapital.PAID_UP_NOMINAL), turnover = num(pl.current.REVENUE_OPERATIONS), profit = num(pl.current.PROFIT_AFTER_TAX);
  if (state.csr.CSR_APPLICABILITY === 'Not applicable' && (paidUp >= 5e8 || turnover >= 1e9 || profit >= 5e7)) warn('csr.CSR_APPLICABILITY', 'Net worth / turnover / profit suggests CSR (Section 135) may apply.');
  // The extension refuses identifiers equal to "0".
  for (const [path, label] of [['general.CIN', 'CIN'], ['auditor.AUDITOR_PAN', 'Auditor PAN'], ['auditor.ADT_SRN', 'ADT-1 SRN'], ['auditor.MEMBER_NUMBER', 'Membership number'], ['auditor.AUDITOR_FIRM_REG', 'Firm registration no.']]) {
    if (/^0+$/.test(String(getPath(state, path) ?? '').trim())) err(path, `${label} cannot be "0".`);
  }
  return { errors, warnings };
}

/* ═══════════════════════════════════════════════════════════════════
   Client JSON (exact extension schema)
   ═══════════════════════════════════════════════════════════════════ */
function clientId() {
  const word = (state.meta.companyName || 'client').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'client';
  return `${word}_fy${(state.meta.fy || 'xxxx-xx').replace('-', '_')}`;
}
function buildClientJson() {
  const s = state;
  const per = (section, keys) => Object.fromEntries(keys.map(k => [k, { current: num(section[k]?.current), previous: num(section[k]?.previous) }]));
  const bsPer = p => { const o = { asOf: s.balanceSheet[p].asOf }; for (const [, k] of BS_LIAB) o[k] = num(s.balanceSheet[p][k]); o.TOTAL_EQUITY_LIABILITIES = num(s.balanceSheet[p].TOTAL_EQUITY_LIABILITIES); for (const [, k] of BS_ASSET) o[k] = num(s.balanceSheet[p][k]); o.TOTAL_ASSETS = num(s.balanceSheet[p].TOTAL_ASSETS); return o; };
  const plPer = p => { const src = s.profitLoss[p]; const o = { period: src.period }; for (const k of ['REVENUE_OPERATIONS', 'OTHER_INCOME', 'TOTAL_INCOME', 'EMPLOYEE_EXPENSES', 'MANAGERIAL_REMUNERATION', 'FINANCE_COSTS', 'DEPRECIATION', 'OTHER_EXPENSES', 'TOTAL_EXPENSES', 'PROFIT_BEFORE_TAX', 'CURRENT_TAX', 'DEFERRED_TAX', 'TOTAL_TAX', 'PROFIT_AFTER_TAX', 'EPS_BASIC', 'EPS_DILUTED']) o[k] = num(src[k]); return o; };
  const general = {};
  for (const [k, v] of Object.entries(s.general)) if (v !== '' && v !== null && v !== undefined) general[k] = v;
  const industry = {};
  for (const [k, v] of Object.entries(s.industry)) if (v !== '') industry[k] = v;
  const subsidiary = { IS_SUBSIDIARY: s.subsidiary.IS_SUBSIDIARY, HAS_SUBSIDIARY_OR_JV: s.subsidiary.HAS_SUBSIDIARY_OR_JV };
  if (s.subsidiary.IS_SUBSIDIARY === 'Yes') Object.assign(subsidiary, { HOLDING_CIN: s.subsidiary.HOLDING_CIN, HOLDING_NAME: s.subsidiary.HOLDING_NAME, PROVISION_SECTION: s.subsidiary.PROVISION_SECTION });
  const fpBS = { OPERATING_LEASE_CONVERTED: s.financialParametersBS.OPERATING_LEASE_CONVERTED, NET_WORTH: num(s.financialParametersBS.NET_WORTH), GROSS_PPE_INTANGIBLE: num(s.financialParametersBS.GROSS_PPE_INTANGIBLE), DEPRECIATION_AMORTIZATION_BS: num(s.financialParametersBS.DEPRECIATION_AMORTIZATION_BS) };
  if (s.financialParametersBS.OPERATING_LEASE_CONVERTED === 'Yes') fpBS.OPERATING_LEASE_DETAILS = s.financialParametersBS.OPERATING_LEASE_DETAILS;
  for (const [k] of FP_BS) fpBS[k] = num(s.financialParametersBS[k]);
  const fpPL = {};
  for (const k of ['FP_PL_PROPOSED_DIVIDEND', 'FP_PL_PROPOSED_DIVIDEND_PERCENT', 'FP_PL_EPS_BASIC', 'FP_PL_EPS_DILUTED', 'FP_PL_FOREIGN_INCOME', 'FP_PL_FOREIGN_EXPENDITURE', 'FP_PL_GOVERNMENT_GRANTS', 'FP_PL_RENT_PAID', 'FP_PL_STORES_SPARES', 'FP_PL_RELATED_PARTY_GROSS', 'FP_PL_RELATED_PARTY_BAD_DEBTS', 'FP_PL_SECTION_182']) fpPL[k] = num(s.financialParametersPL[k]);
  const sig = rows => rows.filter(r => r.din || r.name).map(r => ({ din: String(r.din || '').trim(), name: String(r.name || '').trim(), designation: r.designation || 'Director', date: r.date }));
  return {
    clientId: clientId(),
    displayName: `${s.meta.companyName || 'Client'} (FY ${s.meta.fy})`,
    source: `AOC-4 Dashboard, ${new Date().toISOString().slice(0, 10)}`,
    note: 'All values in absolute Rupees. CIN auto-fills company name, address, email, authorised capital and member count on MCA.',
    aocMode: aoc4Mode,  // 'online' | 'offline' — informational; the extension fills the same webform either way
    general,
    signatoriesFS: sig(s.signatoriesFS),
    signatoriesBR: sig(s.signatoriesBR),
    subsidiary,
    auditor: Object.fromEntries(Object.entries(s.auditor).map(([k, v]) => [k, String(v ?? '')])),
    industry,
    balanceSheet: { scaleNote: 'All values in absolute Rupees.', current: bsPer('current'), previous: bsPer('previous') },
    profitLoss: { current: plPer('current'), previous: plPer('previous') },
    shareCapital: Object.fromEntries(Object.entries(s.shareCapital).map(([k, v]) => [k, num(v)])),
    financialParametersBS: fpBS,
    costRecords: { ...s.costRecords },
    // Category 1 stays unprefixed (CATEGORY_CODE/HIGHEST_CODE/...) for backward compatibility;
    // extras become CATEGORY_2_CODE, CATEGORY_3_CODE, ... — the extension's field-mapper.js reads
    // these flat keys directly (flattenClient() spreads this whole object onto the top level),
    // and phase-runner.js's buildJobs() walks them up to TOTAL_CATEGORIES to fill each row.
    principalProducts: {
      TOTAL_CATEGORIES: num(s.principalProducts.TOTAL_CATEGORIES), CATEGORY_CODE: String(s.principalProducts.CATEGORY_CODE), CATEGORY_DESC: s.principalProducts.CATEGORY_DESC, CATEGORY_TURNOVER: num(s.principalProducts.CATEGORY_TURNOVER), HIGHEST_CODE: String(s.principalProducts.HIGHEST_CODE), HIGHEST_DESC: s.principalProducts.HIGHEST_DESC, HIGHEST_TURNOVER: num(s.principalProducts.HIGHEST_TURNOVER),
      ...Object.fromEntries((s.principalProducts.extra || []).flatMap((c, i) => {
        const n = i + 2;
        return [[`CATEGORY_${n}_CODE`, String(c.code)], [`CATEGORY_${n}_DESC`, c.desc], [`CATEGORY_${n}_TURNOVER`, num(c.turnover)], [`HIGHEST_${n}_CODE`, String(c.highCode)], [`HIGHEST_${n}_DESC`, c.highDesc], [`HIGHEST_${n}_TURNOVER`, num(c.highTurnover)]];
      }))
    },
    relatedParty: { ...s.relatedParty },
    auditorReport: { ...s.auditorReport },
    csr: { ...s.csr },
    secretarialAudit: { ...s.secretarialAudit },
    financialParametersPL: fpPL,
    balanceSheetBreakup: per(s.balanceSheetBreakup, BREAKUP.map(([, k]) => k)),
    profitLossDetails: per(s.profitLossDetails, PL_DETAIL.map(([, k]) => k)),
    foreignExchange: per(s.foreignExchange, FX.map(([, k]) => k)),
    shareCapitalRaised: Object.fromEntries(scKeys().map(k => [k, num(s.shareCapitalRaised[k])])),
    ...(s.extra || {}),
    _dashboard: { reviewer: $('#reviewer')?.value || '', notes: $('#reviewNotes')?.value || '', exportedAt: new Date().toISOString(), sources: summarizeSources() }
  };
}

// AOC-4 Offline targets a different page in the extension (MCA's separate v3offline form,
// automated by js/offline-engine.js there) which expects one flat object keyed by its own
// field-map's `dataKey` names (js/field-maps/aoc4-offline.js), not AOC-4 Online's nested shape —
// built here from the same `state` both modes share.
function buildAoc4OfflineFormData() {
  const g = state.general, a = state.auditor, ind = state.industry;
  const fs1 = state.signatoriesFS[0] || {}, fs2 = state.signatoriesFS[1] || {};
  const brSrc = state.meta.brSameAsFs ? state.signatoriesFS : state.signatoriesBR;
  const br1 = brSrc[0] || {}, br2 = brSrc[1] || {};
  return {
    cin: g.CIN, financialYearFrom: g.FY_FROM, financialYearTo: g.FY_TO,
    boardMeetingDateFS: g.BOARD_MEETING_DATE, natureOfFS: g.NATURE_FS,
    provisionalFSFiled: g.PROVISIONAL_FILED_EARLIER, adoptedInAdjournedAGM: g.ADOPTED_IN_ADJOURNED_AGM,
    boardMeetingDateBR: g.BOARD_REPORT_DATE, auditorSigningDate: g.AUDITOR_SIGN_DATE,
    agmHeld: g.AGM_HELD, agmDate: g.AGM_DATE, agmDueDate: g.AGM_DUE_DATE, agmExtension: g.AGM_EXTENSION,
    director1DIN: fs1.din, director1Name: fs1.name, director1Designation: fs1.designation, director1DateFS: fs1.date,
    director2DIN: fs2.din, director2Name: fs2.name, director2Designation: fs2.designation, director2DateFS: fs2.date,
    br1DIN: br1.din, br1Name: br1.name, br1Designation: br1.designation, br1DateBR: br1.date,
    br2DIN: br2.din, br2Name: br2.name, br2Designation: br2.designation, br2DateBR: br2.date,
    isSubsidiary: state.subsidiary.IS_SUBSIDIARY, hasSubsidiaryOrAssociate: state.subsidiary.HAS_SUBSIDIARY_OR_JV,
    srnADT1: a.ADT_SRN, numberOfAuditors: a.NUM_AUDITORS, auditorPAN: a.AUDITOR_PAN, auditorCategory: a.AUDITOR_CATEGORY,
    auditorMembershipNo: a.AUDITOR_FIRM_REG, auditorName: a.AUDITOR_NAME,
    auditorAddress1: a.AUDITOR_ADDR1, auditorAddress2: a.AUDITOR_ADDR2, auditorCountry: a.AUDITOR_COUNTRY,
    auditorPincode: a.AUDITOR_PIN, auditorLocality: a.AUDITOR_AREA, auditorCity: a.AUDITOR_CITY,
    auditorDistrict: a.AUDITOR_DISTRICT, auditorState: a.AUDITOR_STATE,
    signingMemberName: a.MEMBER_NAME, signingMembershipNo: a.MEMBER_NUMBER,
    industryType: ind.TYPE_OF_INDUSTRY, scheduleIIIApplicable: ind.SCHEDULE_III, consolidatedFS: ind.CONSOLIDATED_FS,
    booksInElectricForm: ind.MAINTAIN_ELECTRONIC_BOOKS,
    serverAddress1: ind.SERVER_ADDR1, serverAddress2: ind.SERVER_ADDR2, serverCountry: ind.SERVER_COUNTRY,
    serverPincode: ind.SERVER_PIN, serverLocality: ind.SERVER_AREA, serverCity: ind.SERVER_CITY,
    serverDistrict: ind.SERVER_DISTRICT, serverState: ind.SERVER_STATE,
    authorisedCapital: num(state.shareCapital.AUTH_NOMINAL),
    relatedPartyTransactions: state.relatedParty.ANY_TRANSACTION, cagCommented: state.auditorReport.CAG_COMMENTED,
    csrApplicability: state.csr.CSR_APPLICABILITY, secretarialAudit: state.secretarialAudit.SECRETARIAL_AUDIT_APPLICABLE,
  };
}
function aoc4ClientInfo() {
  return { id: clientId(), name: state.meta.companyName || clientId(), cin: state.general.CIN || null, fy: { from: state.general.FY_FROM, to: state.general.FY_TO }, source: 'dashboard' };
}

// Loads an existing client JSON (extension schema) into the form.
function loadClientJson(c, source = 'manual') {
  const s = blankState();
  const mark = (path, v) => { setPath(s, path, v); s.sources[path] = source; };
  const copy = (section, obj) => { for (const [k, v] of Object.entries(obj || {})) if (k in s[section] || section !== 'general') mark(`${section}.${k}`, v); };
  copy('general', c.general); copy('subsidiary', c.subsidiary); copy('auditor', c.auditor); copy('industry', c.industry);
  copy('costRecords', c.costRecords); copy('principalProducts', c.principalProducts); copy('relatedParty', c.relatedParty); copy('auditorReport', c.auditorReport); copy('csr', c.csr); copy('secretarialAudit', c.secretarialAudit);
  // copy() above also marks any CATEGORY_2_CODE/HIGHEST_2_CODE/... keys straight onto
  // principalProducts as flat stray properties (they aren't declared on blankState's
  // principalProducts); pull them into the extra[] array the UI actually reads instead.
  {
    const ppIn = c.principalProducts || {};
    const extra = [];
    for (let n = 2; ppIn[`CATEGORY_${n}_CODE`] !== undefined; n++) {
      extra.push({
        code: ppIn[`CATEGORY_${n}_CODE`] || '', desc: ppIn[`CATEGORY_${n}_DESC`] || '', turnover: num(ppIn[`CATEGORY_${n}_TURNOVER`]),
        highCode: ppIn[`HIGHEST_${n}_CODE`] || '', highDesc: ppIn[`HIGHEST_${n}_DESC`] || '', highTurnover: num(ppIn[`HIGHEST_${n}_TURNOVER`])
      });
      for (const prefix of ['CATEGORY', 'HIGHEST']) for (const suffix of ['CODE', 'DESC', 'TURNOVER']) {
        delete s.principalProducts[`${prefix}_${n}_${suffix}`];
        delete s.sources[`principalProducts.${prefix}_${n}_${suffix}`];
      }
    }
    s.principalProducts.extra = extra;
    extra.forEach((_, i) => { for (const k of ['code', 'desc', 'turnover', 'highCode', 'highDesc', 'highTurnover']) s.sources[`principalProducts.extra.${i}.${k}`] = source; });
  }
  for (const [k, v] of Object.entries(c.shareCapital || {})) mark(`shareCapital.${k}`, v);
  for (const [k, v] of Object.entries(c.financialParametersBS || {})) mark(`financialParametersBS.${k}`, v);
  for (const [k, v] of Object.entries(c.financialParametersPL || {})) mark(`financialParametersPL.${k}`, v);
  for (const per of ['current', 'previous']) {
    for (const [k, v] of Object.entries(c.balanceSheet?.[per] || {})) if (!/^TOTAL_/.test(k)) mark(`balanceSheet.${per}.${k}`, v);
    for (const [k, v] of Object.entries(c.profitLoss?.[per] || {})) if (!/^(TOTAL_|PROFIT_)/.test(k)) mark(`profitLoss.${per}.${k}`, v);
  }
  for (const section of ['balanceSheetBreakup', 'profitLossDetails', 'foreignExchange']) {
    for (const [k, v] of Object.entries(c[section] || {})) { if (v && typeof v === 'object') { mark(`${section}.${k}.current`, num(v.current)); mark(`${section}.${k}.previous`, num(v.previous)); } }
  }
  for (const [k, v] of Object.entries(c.shareCapitalRaised || {})) mark(`shareCapitalRaised.${k}`, v);
  s.signatoriesFS = (c.signatoriesFS || []).map(r => ({ din: r.din || '', name: r.name || '', designation: r.designation || 'Director', date: r.date || '' }));
  if (!s.signatoriesFS.length) s.signatoriesFS = blankState().signatoriesFS;
  s.signatoriesFS.forEach((r, i) => { for (const k of ['din', 'name', 'designation', 'date']) if (r[k]) s.sources[`signatoriesFS.${i}.${k}`] = source; });
  const brRows = (c.signatoriesBR || []).map(r => ({ din: r.din || '', name: r.name || '', designation: r.designation || 'Director', date: r.date || '' }));
  const sameAsFs = brRows.length === s.signatoriesFS.length && brRows.every((r, i) => r.din === s.signatoriesFS[i].din);
  s.meta.brSameAsFs = sameAsFs || !brRows.length;
  if (!s.meta.brSameAsFs) { s.signatoriesBR = brRows; brRows.forEach((r, i) => { for (const k of ['din', 'name', 'designation', 'date']) if (r[k]) s.sources[`signatoriesBR.${i}.${k}`] = source; }); }
  // Keep sections the dashboard does not edit (e.g. shareholders) so an import → export round trip loses nothing.
  const known = new Set(['clientId', 'displayName', 'source', 'note', 'general', 'signatoriesFS', 'signatoriesBR', 'subsidiary', 'auditor', 'industry', 'balanceSheet', 'profitLoss', 'shareCapital', 'financialParametersBS', 'costRecords', 'principalProducts', 'relatedParty', 'auditorReport', 'csr', 'secretarialAudit', 'financialParametersPL', 'balanceSheetBreakup', 'profitLossDetails', 'foreignExchange', 'shareCapitalRaised', '_dashboard']);
  s.extra = Object.fromEntries(Object.entries(c).filter(([k]) => !known.has(k)));
  const fyTo = /(\d{4})$/.exec(c.general?.FY_TO || '');
  if (fyTo) s.meta.fy = `${+fyTo[1] - 1}-${String(fyTo[1]).slice(2)}`;
  s.meta.companyName = (c.displayName || '').replace(/\s*\(FY.*$/, '') || c.companyName || '';
  s.meta.faceValue = num(c.shareCapital?.FACE_VALUE) || 10;
  if (c._dashboard?.meta) Object.assign(s.meta, c._dashboard.meta);
  state = s;
  // Imported values that equal what derive() would produce stay derived, so later edits
  // (a new FY, new figures) keep flowing through; only genuine overrides remain "manual".
  derive();
  const snapshot = {};
  for (const path of derivablePaths) {
    if (state.sources[path] !== source) continue;
    snapshot[path] = JSON.stringify(getPath(state, path));
    delete state.sources[path];
  }
  derive();
  for (const [path, imported] of Object.entries(snapshot)) {
    if (JSON.stringify(getPath(state, path)) !== imported) { setPath(state, path, JSON.parse(imported)); state.sources[path] = source; }
  }
  afterChange();
}
function summarizeSources() {
  const out = { manual: 0, sandbox: 0, ai: 0, doc: 0, auto: 0 };
  for (const v of Object.values(state.sources)) if (v in out) out[v]++;
  return out;
}

/* ═══════════════════════════════════════════════════════════════════
   Persistence: drafts, settings, firm master
   ═══════════════════════════════════════════════════════════════════ */
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } }, del(k) { try { localStorage.removeItem(k); } catch (_) { } } };
const SETTINGS_DEFAULTS = { llmProvider: 'anthropic', llmKey: '', gatewayUrl: '', gatewayToken: '', extId: '', pairingKey: '' };
const savedSettings = LS.get('aoc4_settings', {});
let settings = Object.assign({}, SETTINGS_DEFAULTS, savedSettings);
// "gateway" routes AI calls through the Germin8 API gateway (a Supabase edge function) instead of
// calling the provider directly from the browser, so the real Claude/SurePass/MCA keys never sit
// in this page's Settings or network tab — only the gateway's own scoped, revocable token does.
const aiKeyPresent = () => settings.llmProvider === 'gateway' ? !!settings.gatewayToken : !!settings.llmKey;
// config.local.js (git-ignored, optional) carries this machine's keys so nobody retypes them.
// Anything the user saved in Settings wins; the file only replaces values still at their default.
{
  const cfg = window.AOC4_LOCAL_CONFIG || {};
  const fromFile = {
    llmProvider: cfg.ai?.provider, llmKey: cfg.ai?.key, gatewayUrl: cfg.gateway?.url, gatewayToken: cfg.gateway?.token, extId: cfg.extensionId
  };
  for (const [k, v] of Object.entries(fromFile)) {
    if (!v) continue;
    const userChose = Object.prototype.hasOwnProperty.call(savedSettings, k) && savedSettings[k] !== '' && savedSettings[k] !== SETTINGS_DEFAULTS[k];
    if (!userChose) settings[k] = v;
  }
}
let firm = LS.get('aoc4_firm', null);
const draftKey = () => `aoc4_draft_${state.general.CIN || 'new'}_${state.meta.fy || 'nofy'}`;
function listDrafts() { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('aoc4_draft_')) { const d = LS.get(k, null); if (d) out.push({ key: k, name: d.meta?.companyName || d.general?.CIN || 'Unnamed', fy: d.meta?.fy || '', savedAt: d._savedAt || 0 }); } } return out.sort((a, b) => b.savedAt - a.savedAt); }
let currentDraftKey = null;
function setSaveState(text, saved) {
  const el = $('#saveState'); if (!el) return;
  el.textContent = text;
  el.classList.toggle('saved', !!saved);
}
const autosave = debounce(() => {
  const key = draftKey();
  if (currentDraftKey && currentDraftKey !== key) LS.del(currentDraftKey);
  currentDraftKey = key;
  state._savedAt = Date.now();
  if (LS.set(key, state)) {
    LS.set('aoc4_last_draft', key);
    setSaveState(`Saved · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, true);
    renderClientList();
  }
}, 800);
function renderClientList() {
  const sel = $('#clientSelect');
  const drafts = listDrafts();
  sel.innerHTML = '<option value="">New client</option>' + drafts.map(d => `<option value="${esc(d.key)}" ${d.key === currentDraftKey ? 'selected' : ''}>${esc(d.name)}${d.fy ? ` — FY ${esc(d.fy)}` : ''}</option>`).join('');
}

/* ═══════════════════════════════════════════════════════════════════
   Rendering
   ═══════════════════════════════════════════════════════════════════ */
const PANELS_AOC4 = ['data', 'sandbox', 'upload', 'review'];
const PANELS_SPICE = ['data-spice', 'sandbox-spice', 'upload-spice', 'review-spice'];
const PANELS_ADT1 = ['data-adt1', 'upload-adt1', 'review-adt1'];   // form logic + cards live in js/adt1-form.js
let PANELS = PANELS_AOC4;
const PANEL_TEXT = {
  data: ['Data Entry', 'Fill what you know; dependent values are derived automatically and marked auto.'],
  sandbox: ['Filesure lookup', 'Enter a CIN or search by name to pull the company master data from MCA.'],
  upload: ['Upload & AI', 'Upload the financial statements; AI proposes values which you accept into the form.'],
  review: ['Review & Send', 'Fix the checks, confirm the JSON, then hand it to the extension.'],
  'data-spice': ['Data Entry', 'Name reservation (SPICe+ Part A) — Rule 8 & 9, Companies (Incorporation) Rules, 2014.'],
  'sandbox-spice': ['Filesure lookup', 'Optional — useful for a name-change filing on an existing CIN, or confirming a conversion.'],
  'upload-spice': ['Upload & AI', 'Optional attachments for this filing; AI-assisted extraction is coming soon.'],
  'review-spice': ['Review & Send', 'Fix the checks, confirm the JSON, then hand it to the extension. Submit on MCA is never automated.'],
  'data-adt1': ['Data Entry', 'Notice of appointment of auditor (Form ADT-1) — Section 139, Companies Act, 2013.'],
  'upload-adt1': ['Upload & AI', 'Upload the appointment documents; the app reads them and proposes values, which you accept into the form.'],
  'review-adt1': ['Review & Send', 'Fix the checks, confirm the JSON, then hand it to the extension. Submit on MCA is never automated.']
};
let activePanel = 'data';
let currentForm = 'aoc4';   // 'aoc4' | 'spice' | 'adt1' — which form section is on screen
// AOC-4 Online and AOC-4 Offline are two MCA filing modes for the same data (company details,
// dates, signatories, balance sheet, …) — the live webform is identical either way, so they share
// every AOC-4 panel and `state`. aoc4Mode only changes which Review & Send actions apply (Offline
// additionally offers — eventually — filling MCA's per-filing Excel template; see aoc4OfflineExtra).
let aoc4Mode = 'online';    // 'online' | 'offline'
function setForm(value) {
  const prevForm = currentForm;
  currentForm = value === 'spice' ? 'spice' : value === 'adt1' ? 'adt1' : 'aoc4';
  if (currentForm === 'aoc4') aoc4Mode = value === 'aoc4_offline' ? 'offline' : 'online';
  PANELS = currentForm === 'spice' ? PANELS_SPICE : currentForm === 'adt1' ? PANELS_ADT1 : PANELS_AOC4;
  $('#formSwitch').value = currentForm === 'spice' ? 'spice' : currentForm === 'adt1' ? 'adt1' : (aoc4Mode === 'offline' ? 'aoc4_offline' : 'aoc4_online');
  $('#clientBoxAoc4').classList.toggle('hidden', currentForm !== 'aoc4');
  $('#clientBoxSpiceA').classList.toggle('hidden', currentForm !== 'spice');
  $('#clientBoxAdt1').classList.toggle('hidden', currentForm !== 'adt1');
  $('#navAoc4').classList.toggle('hidden', currentForm !== 'aoc4');
  $('#navSpiceA').classList.toggle('hidden', currentForm !== 'spice');
  $('#navAdt1').classList.toggle('hidden', currentForm !== 'adt1');
  $('#aoc4OfflineExtra').classList.toggle('hidden', !(currentForm === 'aoc4' && aoc4Mode === 'offline'));
  if (prevForm !== currentForm) showPanel(currentForm === 'spice' ? 'data-spice' : currentForm === 'adt1' ? 'data-adt1' : 'data');
  else if (activePanel === 'review') renderReview();
  // The top status pill is shared by every form: refresh it for the form now on screen so it never
  // keeps another form's "Ready" / "N to fix".
  if (currentForm === 'adt1') renderAdt1();
  else if (currentForm === 'spice') renderSpice();
  else if (prevForm !== currentForm) renderAoc4TopStatus();
}
function showPanel(name) {
  if (!PANELS.includes(name)) name = PANELS[0];
  activePanel = name;
  $$('.nav button').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
  $$('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  $('#panelTitle').textContent = PANEL_TEXT[name][0];
  $('#panelSub').textContent = PANEL_TEXT[name][1];
  $('#prevPanel').disabled = PANELS.indexOf(name) === 0;
  const isReview = name === 'review' || name === 'review-spice' || name === 'review-adt1';
  $('#nextPanel').textContent = isReview ? 'Download JSON' : 'Next →';
  $('#topReviewBtn').classList.toggle('hidden', isReview);
  const foot = { data: 'Values save automatically in this browser.', sandbox: 'Fetched master data fills CIN, name, address and capital.', upload: 'Nothing is applied to the form until you choose it.', review: 'Errors must be cleared before sending.', 'data-spice': 'Values save automatically in this browser.', 'sandbox-spice': 'Fetched master data fills NIC code and company type.', 'upload-spice': 'Attachments are kept with the client record.', 'review-spice': 'Errors must be cleared before sending.', 'data-adt1': 'Values save automatically in this browser.', 'upload-adt1': 'Nothing is applied to the form until you choose it.', 'review-adt1': 'Errors must be cleared before sending.' };
  $('#footLeft').textContent = foot[name] || foot.data;
  location.hash = name;
  window.scrollTo(0, 0);
  if (name === 'review') renderReview();
  if (name === 'review-spice') renderSpiceReview();
  if (name === 'upload-adt1' && typeof adt1UpOnShow === 'function') adt1UpOnShow();
  if (name === 'data-adt1' && typeof adt1MarkFromDoc === 'function') adt1MarkFromDoc();
  if (name === 'review-adt1') renderAdt1Review();
}

// Badges mark values the user did not type: auto, computed, sandbox, AI. A hand-typed value is
// labelled "manual" only when it overrides a derived one, and then offers "↺ auto" to go back.
function badgeHtml(path) {
  const s = srcOf(path);
  if (!s) return '';
  const derivable = derivablePaths.has(path);
  if (s === 'manual' && !derivable) return '';
  const label = s === 'auto' ? 'auto' : s === 'sandbox' ? 'MCA' : s === 'ai' ? 'AI' : s === 'doc' ? 'doc' : s === 'computed' ? 'computed' : 'manual';
  const reset = derivable && (s === 'manual' || s === 'ai' || s === 'doc') ? ` <button class="reset" data-reset="${esc(path)}" title="Return to the derived value">↺ auto</button>` : '';
  return `<span class="badge ${s}" data-badge="${esc(path)}">${label}</span>${reset}`;
}
function field(path, label, o = {}) {
  const v = getPath(state, path);
  const id = 'f_' + path.replace(/[^a-z0-9]/gi, '_');
  const req = o.required ? ' <span class="req">*</span>' : '';
  let control;
  if (o.type === 'select') control = `<select class="sel" id="${id}" data-path="${path}">${o.options.map(opt => { const [val, text] = Array.isArray(opt) ? opt : [opt, opt]; return `<option value="${esc(val)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(text)}</option>`; }).join('')}</select>`;
  else if (o.type === 'date') control = `<input class="in" type="date" id="${id}" data-path="${path}" data-type="date" value="${toISO(v)}">`;
  else if (o.type === 'number') control = `<input class="in num" type="text" inputmode="decimal" id="${id}" data-path="${path}" data-type="number" value="${esc(numDisp(v))}" placeholder="0" ${o.readonly ? 'readonly' : ''}>`;
  else if (o.type === 'textarea') control = `<textarea class="ta" id="${id}" data-path="${path}" placeholder="${esc(o.placeholder || '')}">${esc(v)}</textarea>`;
  else control = `<input class="in" type="text" id="${id}" data-path="${path}" value="${esc(v)}" ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ''} ${o.readonly ? 'readonly' : ''} ${o.upper ? 'style="text-transform:uppercase"' : ''} ${o.maxlength ? `maxlength="${o.maxlength}"` : ''}>`;
  return `<div class="f ${o.span ? 'span' + o.span : ''}" data-label="${esc(label)}"><label for="${id}">${label}${req}<span class="badges" data-badges="${path}">${badgeHtml(path)}</span></label>${control}${o.hint ? `<span class="hint">${o.hint}</span>` : ''}<span class="field-error" data-error="${esc(path)}"></span></div>`;
}
const YESNO = ['Yes', 'No'];
function fyOptions() { const y = today().getFullYear(); const out = []; for (let i = y; i >= y - 6; i--) out.push([`${i}-${String(i + 1).slice(2)}`, `FY ${i}-${String(i + 1).slice(2)}`]); return out; }
function periodTable(sectionPath, rows, opts = {}) {
  const cur = state.balanceSheet.current.asOf || 'Current', prev = state.balanceSheet.previous.asOf || 'Previous';
  const body = rows.map(([group, key, label]) => {
    const g = group ? `<tr class="group"><td colspan="3">${esc(group)}</td></tr>` : '';
    const p = opts.nested ? `${sectionPath}.${key}` : `${sectionPath}`;
    const cell = per => { const path = opts.nested ? `${p}.${per}` : `${sectionPath}.${per}.${key}`; const col = per === 'current' ? cur : prev; return `<td class="num"><input class="in num" type="text" inputmode="decimal" data-path="${path}" data-type="number" aria-label="${esc(label)}, ${esc(col)}" value="${esc(numDisp(getPath(state, path)))}" placeholder="0"></td>`; };
    return `${g}<tr><td class="lbl">${esc(label)}${badgeHtml(opts.nested ? `${p}.current` : `${sectionPath}.current.${key}`)}</td>${cell('current')}${cell('previous')}</tr>`;
  }).join('');
  return `<div class="scroll-x"><table class="tbl"><thead><tr><th scope="col" style="width:55%">Particulars</th><th scope="col" class="num">${esc(cur)}</th><th scope="col" class="num">${esc(prev)}</th></tr></thead><tbody>${body}${opts.footer || ''}</tbody></table></div>`;
}
function computedRow(label, keyCur, keyPrev, cls = 'total') { return `<tr class="${cls}"><td class="lbl">${esc(label)} <span class="badge computed">computed</span></td><td class="num computed" data-computed="${keyCur}">${fmtINR(num(getPath(state, keyCur)))}</td><td class="num computed" data-computed="${keyPrev}">${fmtINR(num(getPath(state, keyPrev)))}</td></tr>`; }
function singleTable(sectionPath, rows) {
  return `<div class="scroll-x"><table class="tbl compact"><tbody>${rows.map(([key, label]) => `<tr><td class="lbl" style="width:70%">${esc(label)}${badgeHtml(`${sectionPath}.${key}`)}</td><td class="num"><input class="in num" type="text" inputmode="decimal" data-path="${sectionPath}.${key}" data-type="number" aria-label="${esc(label)}" value="${esc(numDisp(getPath(state, `${sectionPath}.${key}`)))}" placeholder="0"></td></tr>`).join('')}</tbody></table></div>`;
}
function sigTable(which) {
  const rows = state[which];
  const canEdit = which === 'signatoriesFS' || !state.meta.brSameAsFs;
  const part = which === 'signatoriesFS' ? 'Financial statements' : 'Board’s report';
  return `<div class="scroll-x"><table class="tbl compact"><thead><tr><th scope="col" style="width:150px">DIN / PAN</th><th scope="col">Name <span class="muted" style="text-transform:none;letter-spacing:0">(optional — MCA fills it from the DIN)</span></th><th scope="col" style="width:170px">Designation</th><th scope="col" style="width:160px">Date signed</th><th scope="col" style="width:40px"></th></tr></thead><tbody>` +
    rows.map((r, i) => `<tr>
      <td><input class="in" data-path="${which}.${i}.din" aria-label="DIN or PAN, ${part}, signatory ${i + 1}" maxlength="10" value="${esc(r.din)}" ${canEdit ? '' : 'readonly'} placeholder="08302207"></td>
      <td><input class="in" data-path="${which}.${i}.name" aria-label="Name, ${part}, signatory ${i + 1}" value="${esc(r.name)}" ${canEdit ? '' : 'readonly'}></td>
      <td><select class="sel" data-path="${which}.${i}.designation" aria-label="Designation, ${part}, signatory ${i + 1}" ${canEdit ? '' : 'disabled'}>${['Director', 'Managing Director', 'CEO', 'CFO', 'Manager', 'Secretary', 'IRP', 'RP', 'Liquidator'].map(d => `<option ${r.designation === d ? 'selected' : ''}>${d}</option>`).join('')}</select></td>
      <td><input class="in" type="date" data-path="${which}.${i}.date" data-type="date" aria-label="Date signed, ${part}, signatory ${i + 1}" value="${toISO(r.date)}" ${canEdit ? '' : 'readonly'}></td>
      <td>${canEdit && rows.length > 1 ? `<button class="btn sm" data-remove-sig="${which}:${i}" aria-label="Remove signatory ${i + 1}" title="Remove"><svg class="ico" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}</td>
    </tr>`).join('') + `</tbody></table></div>` +
    (canEdit ? `<button class="btn sm mt8" data-add-sig="${which}"><svg class="ico" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add signatory</button>` : '');
}
// Categories 2, 3, ... of principal products/services. Category 1 stays in the flat
// principalProducts.CATEGORY_*/HIGHEST_* fields for backward compatibility. Each row is its
// own MCA row with its own 6 values (category code/desc/turnover + that row's own
// highest-turnover product code/desc/turnover) — not a comparison across categories; see
// derive() for how "Number of categories" and each row's highest-turnover defaults follow this list.
function prodCategoryExtraTable() {
  const rows = state.principalProducts.extra;
  return rows.map((r, i) => { const n = i + 2; const p = `principalProducts.extra.${i}`; return `
    <div class="subblock" style="margin-top:12px">
      <div class="block-meta" style="display:flex;justify-content:space-between;align-items:center">
        <span>Category ${n}</span>
        <button class="btn sm" data-remove-category="${i}" aria-label="Remove category ${n}" title="Remove"><svg class="ico" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </div>
      <div class="grid">
        ${field(`${p}.code`, `Category ${n} code (NPCS / ITC 4-digit)`, { required: true, placeholder: '9992' })}
        ${field(`${p}.desc`, `Category ${n} description`)}
        ${field(`${p}.turnover`, `Turnover of category ${n} (₹)`, { type: 'number' })}
        ${field(`${p}.highCode`, `Category ${n} highest-turnover code (8-digit)`, { required: true, placeholder: '99929199' })}
        ${field(`${p}.highDesc`, `Category ${n} highest-turnover description`)}
        ${field(`${p}.highTurnover`, `Category ${n} turnover of highest (₹)`, { type: 'number' })}
      </div>
    </div>`; }).join('') +
    `<button class="btn sm mt16" data-add-category="1"><svg class="ico" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add another category</button>`;
}
// ── Data Entry layout ───────────────────────────────────────────────────
// Top-level sections are cards; optional schedules live in one collapsed card.
const openSections = new Set(['company', 'dates']);
const advancedOpen = new Set();

function card(id, title, meta, body) {
  const open = openSections.has(id);
  return `<section class="card${open ? '' : ' collapsed'}" id="sec-${id}" data-section="${id}">
    <div class="card-head" data-toggle="${id}" role="button" tabindex="0" aria-expanded="${open}">
      <span class="card-chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></span>
      <div class="card-heading"><h3>${title}</h3><p>${meta || ''}</p></div>
      <div class="card-status" data-status="${id}"></div>
    </div>
    <div class="card-body">${body}</div>
  </section>`;
}

// Nested collapsible used inside a card (advanced schedules).
function block(id, title, meta, body, open = true) {
  return `<details class="subblock" id="blk-${id}" ${open ? 'open' : ''}><summary><span><svg class="chev" viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2"><polyline points="9 18 15 12 9 6"/></svg><span class="block-title">${title}</span></span><span class="block-meta">${meta || ''}</span></summary><div class="block-body">${body}</div></details>`;
}

function renderDataEntry() {
  const g = state.general;
  const essentials = [
    card('company', 'Company &amp; financial year', 'CIN, FY and capital', `
      <div class="grid">
        ${field('general.CIN', 'CIN', { required: true, upper: true, maxlength: 21, placeholder: 'U80904KA2018PTC119370', hint: 'Or fetch it in Filesure lookup.' })}
        <div class="f"><label for="metaCompanyName">Company name ${badgeHtml('meta.companyName')}</label><input class="in" id="metaCompanyName" data-path="meta.companyName" value="${esc(state.meta.companyName)}" placeholder="As per MCA"></div>
        ${field('meta.fy', 'Financial year', { type: 'select', required: true, options: [['', 'Select…'], ...fyOptions()] })}
        ${field('general.FY_FROM', 'FY from', { type: 'date' })}
        ${field('general.FY_TO', 'FY to', { type: 'date' })}
        ${field('shareCapital.PAID_UP_NOMINAL', 'Paid-up capital (₹)', { type: 'number', required: true, hint: 'From MCA master data when fetched.' })}
        ${field('shareCapital.AUTH_NOMINAL', 'Authorised capital (₹)', { type: 'number' })}
        ${field('shareCapital.FACE_VALUE', 'Face value per share (₹)', { type: 'number', hint: 'Used to compute the number of shares and EPS.' })}
        ${field('shareCapital.PAID_UP_SHARES', 'Paid-up shares', { type: 'number', readonly: true })}
        <div class="f span2"><label for="metaRegisteredAddress">Registered office ${badgeHtml('meta.registeredAddress')}</label><input class="in" id="metaRegisteredAddress" data-path="meta.registeredAddress" value="${esc(state.meta.registeredAddress)}" placeholder="MCA fills this on the form from the CIN"></div>
        <div class="f"><label for="metaCompanyClass">Company class ${badgeHtml('meta.companyClass')}</label><input class="in" id="metaCompanyClass" data-path="meta.companyClass" value="${esc(state.meta.companyClass)}" placeholder="Private / Public / OPC"><span class="hint">OPC changes the AGM due-date rule.</span></div>
      </div>`),
    card('dates', 'Dates, nature of statements &amp; AGM', 'Q3–Q7', `
      <div class="note">Dates default to the AGM due date (FY end + 6 months). Edit any of them; the others keep following your edits.</div>
      <div class="grid">
        ${field('general.NATURE_FS', 'Nature of financial statements', { type: 'select', options: [['adopted', 'Adopted financial statements'], ['provisional', 'Provisional un-adopted financial statements'], ['revised130', 'Revised financial statements u/s 130'], ['revised131', 'Revised financial statements u/s 131']] })}
        ${field('general.PROVISIONAL_FILED_EARLIER', 'Provisional FS filed earlier?', { type: 'select', options: ['No', 'Yes', 'Not applicable'] })}
        ${field('general.ADOPTED_IN_ADJOURNED_AGM', 'Adopted in adjourned AGM?', { type: 'select', options: ['No', 'Yes', 'Not applicable'] })}
        ${field('general.BOARD_MEETING_DATE', '4(a) Board meeting — FS approved', { type: 'date', required: true })}
        ${field('general.BOARD_REPORT_DATE', '5(a) Board meeting — Board’s report', { type: 'date' })}
        ${field('general.AUDITOR_SIGN_DATE', '6 Auditor’s report signed', { type: 'date', required: true })}
        ${field('general.AGM_HELD', '7(a) AGM held?', { type: 'select', options: ['Yes', 'No', 'Not applicable'] })}
        ${field('general.AGM_DATE', '7(b) AGM date', { type: 'date' })}
        ${field('general.AGM_DUE_DATE', '7(c) AGM due date', { type: 'date' })}
        ${field('general.AGM_EXTENSION', '7(d) AGM extension granted?', { type: 'select', options: YESNO })}
        ${g.AGM_EXTENSION === 'Yes' ? field('general.GNL1_SRN', '7(e) SRN of GNL-1', { upper: true }) + field('general.AGM_EXT_DUE_DATE', '7(f) Due date after extension', { type: 'date' }) : ''}
      </div>`),
    card('signatories', 'Signatories', '4(c) and 5(b)', `
      <div class="block-meta mb12">Financial statements (4c)</div>${sigTable('signatoriesFS')}
      <div class="mt16 mb12" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><span class="block-meta">Board’s report (5b)</span>
        <label class="toggle"><input type="checkbox" id="brSame" ${state.meta.brSameAsFs ? 'checked' : ''}> Same people as the financial statements</label></div>
      ${sigTable('signatoriesBR')}`),
    card('auditor', 'Auditor', 'Q9 — MCA fills most of this from the ADT-1 SRN', `
      <div class="btn-row mb12">
        <button class="btn sm" id="applyFirm" ${firm ? '' : 'disabled'}>${firm ? `Use my firm: ${esc(firm.AUDITOR_NAME || 'saved firm')}` : 'Save your firm in Settings to apply it with one click'}</button>
        <button class="btn sm" id="saveFirm">Save these auditor details as my firm</button>
      </div>
      <div class="grid">
        ${field('auditor.ADT_SRN', 'SRN of Form ADT-1', { required: true, upper: true, placeholder: 'AC0363504' })}
        ${field('auditor.NUM_AUDITORS', 'Number of auditors', { type: 'number' })}
        ${AUDITOR_FIELDS.map(([k, label, type, options]) => type === 'select' ? field(`auditor.${k}`, label, { type: 'select', options }) : type === 'pin' ? field(`auditor.${k}`, label, { maxlength: 6, hint: 'Area, city, district and state are looked up from the PIN.' }) : field(`auditor.${k}`, label, { upper: k === 'AUDITOR_PAN' })).join('')}
      </div>`),
    card('industry', 'Industry, books of account &amp; declarations', 'Q8, Q10–12, segments III–VI', `
      <div class="grid">
        ${field('industry.TYPE_OF_INDUSTRY', '10(a) Type of industry', { type: 'select', options: ['Commercial & Industrial', 'Banking', 'Insurance', 'Power', 'NBFC'] })}
        ${field('industry.SCHEDULE_III', '10(b) Schedule III applicable?', { type: 'select', options: YESNO })}
        ${field('industry.CONSOLIDATED_FS', '11 Consolidated FS required?', { type: 'select', options: YESNO })}
        ${field('subsidiary.IS_SUBSIDIARY', '8(a) Is a subsidiary?', { type: 'select', options: YESNO })}
        ${state.subsidiary.IS_SUBSIDIARY === 'Yes' ? field('subsidiary.HOLDING_CIN', '8(b) Holding company CIN', { upper: true }) + field('subsidiary.HOLDING_NAME', '8(c) Holding company name') + field('subsidiary.PROVISION_SECTION', '8(d) Provision', { type: 'select', options: ['Section 2(87)(i)', 'Section 2(87)(ii)'] }) : ''}
        ${field('subsidiary.HAS_SUBSIDIARY_OR_JV', '8(e) Has subsidiary / associate / JV?', { type: 'select', options: YESNO })}
        ${field('industry.MAINTAIN_ELECTRONIC_BOOKS', '12(a) Books kept electronically?', { type: 'select', options: YESNO })}
      </div>
      ${state.industry.MAINTAIN_ELECTRONIC_BOOKS === 'Yes' ? `
      <div class="mt16 mb12" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><span class="block-meta">12(b) Address where the servers are kept</span><button class="btn sm" id="serverFromRegistered" ${state.meta.registeredAddress ? '' : 'disabled'}>Same as registered office</button></div>
      <div class="grid">
        ${field('industry.SERVER_ADDR1', 'Address line 1', { required: true })}
        ${field('industry.SERVER_ADDR2', 'Address line 2')}
        ${field('industry.SERVER_COUNTRY', 'Country')}
        ${field('industry.SERVER_PIN', 'PIN code', { maxlength: 6, required: true, hint: 'Looked up automatically.' })}
        ${field('industry.SERVER_AREA', 'Area / locality')}
        ${field('industry.SERVER_CITY', 'City')}
        ${field('industry.SERVER_DISTRICT', 'District')}
        ${field('industry.SERVER_STATE', 'State / UT')}
        ${field('industry.MAINTAINED_ON_CLOUD', '12(c)(iv) Books on cloud?', { type: 'select', options: YESNO })}
        ${state.industry.MAINTAINED_ON_CLOUD === 'Yes' ? field('industry.SERVICE_PROVIDER_NAME', 'Service provider name') + field('industry.SERVICE_PROVIDER_IP', 'Provider IP address') + field('industry.SERVICE_PROVIDER_LOCATION', 'Provider location') + field('industry.SERVICE_PROVIDER_ADDRESS', 'Provider address', { span: 2 }) : ''}
      </div>` : ''}
      <div class="block-meta mt16 mb12">Segments III–VI and cost records</div>
      <div class="grid">
        ${field('relatedParty.ANY_TRANSACTION', 'III Related-party transactions?', { type: 'select', options: YESNO })}
        ${field('auditorReport.CAG_COMMENTED', 'IV CAG commented (government company)?', { type: 'select', options: ['Not applicable', 'Yes', 'No'] })}
        ${field('csr.CSR_APPLICABILITY', 'V CSR applicability', { type: 'select', options: ['Not applicable', 'Section 135', 'Report for unspent CSR amount'] })}
        ${field('secretarialAudit.SECRETARIAL_AUDIT_APPLICABLE', 'VI Secretarial audit applicable?', { type: 'select', options: YESNO })}
        ${field('costRecords.MAINTENANCE_MANDATED', 'Cost records mandated?', { type: 'select', options: YESNO })}
        ${field('costRecords.AUDIT_MANDATED', 'Cost audit mandated?', { type: 'select', options: YESNO })}
      </div>`)
  ].join('');

  const statements = [
    card('bs', 'Balance sheet', 'Part B — absolute rupees', `
      ${periodTable('balanceSheet', BS_LIAB, { footer: computedRow('Total equity and liabilities', 'balanceSheet.current.TOTAL_EQUITY_LIABILITIES', 'balanceSheet.previous.TOTAL_EQUITY_LIABILITIES') })}
      <div class="mt16"></div>
      ${periodTable('balanceSheet', BS_ASSET, { footer: computedRow('Total assets', 'balanceSheet.current.TOTAL_ASSETS', 'balanceSheet.previous.TOTAL_ASSETS') })}
      <div id="bsBalance" class="mt12"></div>
      <div class="grid mt16">
        ${field('financialParametersBS.NET_WORTH', 'III(41) Net worth', { type: 'number', readonly: true, hint: 'Share capital + reserves and surplus' })}
        ${field('financialParametersBS.GROSS_PPE_INTANGIBLE', 'III(44) Gross PPE and intangible assets', { type: 'number', hint: 'Gross block before depreciation' })}
        ${field('financialParametersBS.DEPRECIATION_AMORTIZATION_BS', 'III(45) Depreciation and amortization', { type: 'number' })}
        ${field('financialParametersBS.OPERATING_LEASE_CONVERTED', 'III(40) Operating lease converted?', { type: 'select', options: YESNO })}
        ${state.financialParametersBS.OPERATING_LEASE_CONVERTED === 'Yes' ? field('financialParametersBS.OPERATING_LEASE_DETAILS', 'Details of conversion', { span: 2 }) : ''}
      </div>`),
    card('pl', 'Profit and loss', 'Segment II — absolute rupees', `
      ${periodTable('profitLoss', PL_IN, { footer: computedRow('Total income', 'profitLoss.current.TOTAL_INCOME', 'profitLoss.previous.TOTAL_INCOME') + computedRow('Total expenses', 'profitLoss.current.TOTAL_EXPENSES', 'profitLoss.previous.TOTAL_EXPENSES') + computedRow('Profit before tax', 'profitLoss.current.PROFIT_BEFORE_TAX', 'profitLoss.previous.PROFIT_BEFORE_TAX') + computedRow('Total tax', 'profitLoss.current.TOTAL_TAX', 'profitLoss.previous.TOTAL_TAX', '') + computedRow('Profit / (loss) after tax', 'profitLoss.current.PROFIT_AFTER_TAX', 'profitLoss.previous.PROFIT_AFTER_TAX') })}
      <div class="grid mt16">
        ${field('meta.revenueKind', 'Revenue is mainly from', { type: 'select', options: [['services', 'Sale or supply of services'], ['manufactured', 'Sale of goods manufactured'], ['traded', 'Sale of goods traded']] })}
        ${field('profitLoss.current.EPS_BASIC', 'EPS basic — current (₹)', { type: 'number', hint: 'PAT ÷ paid-up shares' })}
        ${field('profitLoss.current.EPS_DILUTED', 'EPS diluted — current (₹)', { type: 'number' })}
        ${field('profitLoss.previous.EPS_BASIC', 'EPS basic — previous (₹)', { type: 'number' })}
        ${field('profitLoss.previous.EPS_DILUTED', 'EPS diluted — previous (₹)', { type: 'number' })}
      </div>
      <div class="block-meta mt16 mb12">IV Principal products / services</div>
      <div class="grid">
        ${field('principalProducts.TOTAL_CATEGORIES', 'Number of categories', { type: 'number', readonly: true, hint: 'Follows the categories listed below' })}
        ${field('principalProducts.CATEGORY_CODE', 'Category code (NPCS / ITC 4-digit)', { required: true, placeholder: '9992' })}
        ${field('principalProducts.CATEGORY_DESC', 'Category description', { placeholder: 'EDUCATION SERVICES' })}
        ${field('principalProducts.CATEGORY_TURNOVER', 'Turnover of category (₹)', { type: 'number' })}
        ${field('principalProducts.HIGHEST_CODE', 'Highest-turnover code (8-digit)', { required: true, placeholder: '99929199' })}
        ${field('principalProducts.HIGHEST_DESC', 'Highest-turnover description')}
        ${field('principalProducts.HIGHEST_TURNOVER', 'Turnover of highest (₹)', { type: 'number' })}
      </div>
      ${state.principalProducts.extra.length ? '<div class="block-meta mt16 mb12">Additional categories (2nd, 3rd, ...) — "Number of categories" above updates automatically, and each category\'s own highest-turnover fields default to that category\'s own figures until you narrow them</div>' + prodCategoryExtraTable() : `<button class="btn sm mt16" data-add-category="1"><svg class="ico" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add a 2nd product/service category</button>`}`),
    card('sc', 'Share capital raised during the year', 'IV — opening balance follows paid-up capital', scTable())
  ].join('');

  const advanced = card('advanced', 'Advanced schedules', 'Break-ups, financial parameters, FX and share movements', `
      ${block('bsbreakup', 'Break-up of figures (II A–E)', 'Trade receivables follow the balance sheet; everything else is 0 unless you edit it', periodTable('balanceSheetBreakup', BREAKUP, { nested: true }), false)}
      ${block('fpbs', 'Financial parameters — balance sheet items (III 1–47)', 'All 0 unless you edit them', singleTable('financialParametersBS', FP_BS), false)}
      ${block('pldetail', 'Detailed profit and loss items (II)', 'Mirrors the inputs above; edit to split further', periodTable('profitLossDetails', PL_DETAIL, { nested: true }), false)}
      ${block('fx', 'Foreign exchange earnings and expenditure', 'All 0 unless you edit them', periodTable('foreignExchange', FX, { nested: true }), false)}
      ${block('fppl', 'Financial parameters — P&amp;L items (III)', 'EPS and foreign currency totals are derived', singleTable('financialParametersPL', FP_PL), false)}
  `);

  $('#dataSections').innerHTML =
    `<div class="group-label">Essentials</div>` + essentials +
    `<div class="group-label">Statements</div>` + statements +
    `<div class="group-label">Optional detail</div>` + advanced;

  // Restore nested open/closed state.
  $$('#dataSections details.subblock').forEach(d => {
    const id = d.id.replace('blk-', '');
    d.open = advancedOpen.has(id);
    d.addEventListener('toggle', () => { if (d.open) advancedOpen.add(id); else advancedOpen.delete(id); });
  });
  renderBsBalance();
  applyInlineErrors();
  const q = $('#fieldSearch')?.value.trim().toLowerCase();
  if (q) applyFieldFilter(q);
}

// Expand/collapse a card. Delegated once in bindNav so re-renders do not stack listeners.
function onCardToggle(e) {
  const head = e.target.closest('[data-toggle]');
  if (!head) return;
  const id = head.dataset.toggle;
  const card = head.closest('.card');
  if (!card) return;
  const collapsed = card.classList.toggle('collapsed');
  head.setAttribute('aria-expanded', String(!collapsed));
  if (collapsed) openSections.delete(id); else openSections.add(id);
}

function scTable() {
  const COL = { SHARES: 'Number of shares', NOMINAL: 'Nominal amount', PAID: 'Paid-up amount', PREMIUM: 'Premium' };
  const row = (label, base, cols, group = '') => `<tr><td class="lbl">${esc(label)}</td>${cols.map(c => `<td class="num"><input class="in num" type="text" inputmode="decimal" data-path="shareCapitalRaised.${base}_${c}" data-type="number" aria-label="${esc(label)}${group ? ' — ' + esc(group) : ''} — ${COL[c]}" value="${esc(numDisp(getPath(state, `shareCapitalRaised.${base}_${c}`)))}" placeholder="0"></td>`).join('')}${cols.length === 3 ? '<td></td>' : ''}</tr>`;
  const section = (cls, title) => {
    const m = SC_MOVES[cls];
    return `<tr class="group"><td colspan="5">${title}</td></tr>` + row('At the beginning of the year', m.begin, ['SHARES', 'NOMINAL', 'PAID'], title) +
      `<tr class="group"><td colspan="5">Increase during the year</td></tr>` + m.inc.map(id => row(SC_LABEL[id], `SC_${cls}_INC_${id}`, ['SHARES', 'NOMINAL', 'PAID', 'PREMIUM'], title)).join('') +
      `<tr class="group"><td colspan="5">Decrease during the year</td></tr>` + m.dec.map(id => row(SC_LABEL[id], `SC_${cls}_DEC_${id}`, ['SHARES', 'NOMINAL', 'PAID', 'PREMIUM'], title)).join('');
  };
  return `<div class="scroll-x"><table class="tbl compact"><thead><tr><th scope="col">Particulars</th><th scope="col" class="num">Number of shares</th><th scope="col" class="num">Nominal amount</th><th scope="col" class="num">Paid-up amount</th><th scope="col" class="num">Premium</th></tr></thead><tbody>${section('EQ', '(i) Equity shares')}${section('PREF', '(ii) Preference shares')}</tbody></table></div>`;
}
function renderBsBalance() {
  const el = $('#bsBalance'); if (!el) return;
  const msgs = [];
  for (const per of ['current', 'previous']) {
    const b = state.balanceSheet[per]; const diff = num(b.TOTAL_EQUITY_LIABILITIES) - num(b.TOTAL_ASSETS);
    msgs.push(Math.abs(diff) > 0.5 ? `<div class="note err">${per === 'current' ? 'Current' : 'Previous'} year does not balance by ₹${fmtINR(Math.abs(diff))} (${diff > 0 ? 'liabilities exceed assets' : 'assets exceed liabilities'}).</div>` : num(b.TOTAL_ASSETS) ? `<div class="note ok">${per === 'current' ? 'Current' : 'Previous'} year balances at ₹${fmtINR(num(b.TOTAL_ASSETS))}.</div>` : '');
  }
  el.innerHTML = msgs.join('');
}
// Light refresh: update values/badges/computed cells in place (keeps focus and scroll).
function refreshValues() {
  $$('[data-path]').forEach(el => {
    if (el === document.activeElement) return;
    const v = getPath(state, el.dataset.path);
    if (el.tagName === 'SELECT') { el.value = String(v ?? ''); return; }
    if (el.dataset.type === 'date') { const iso = toISO(v); if (el.value !== iso) el.value = iso; return; }
    if (el.dataset.type === 'number') { const sv = numDisp(v); if (el.value !== sv) el.value = sv; return; }
    const sv = v == null ? '' : String(v);
    if (el.value !== sv) el.value = sv;
  });
  $$('[data-computed]').forEach(el => { el.textContent = fmtINR(num(getPath(state, el.dataset.computed))); });
  $$('[data-badges]').forEach(el => { el.innerHTML = badgeHtml(el.dataset.badges); });
  renderBsBalance();
}
// ── Dashboard chrome: summary rail, section status, top bar ─────────────
const SECTION_LABELS = {
  company: 'Company', dates: 'Dates & AGM', signatories: 'Signatories', auditor: 'Auditor',
  industry: 'Industry', bs: 'Balance sheet', pl: 'Profit & loss', sc: 'Share capital', advanced: 'Advanced'
};function sectionOf(path) {
  const p = String(path || '');
  if (p.startsWith('balanceSheetBreakup') || p.startsWith('profitLossDetails')) return 'advanced';
  if (p.startsWith('general.CIN') || p.startsWith('shareCapital.') || p.startsWith('meta.fy') || p.startsWith('meta.companyName') || p.startsWith('meta.registeredAddress') || p.startsWith('meta.companyClass')) return 'company';
  if (p.startsWith('general.')) return 'dates';
  if (p.startsWith('signatories')) return 'signatories';
  if (p.startsWith('auditor.')) return 'auditor';
  if (p.startsWith('industry.') || p.startsWith('subsidiary.') || p.startsWith('relatedParty.') || p.startsWith('auditorReport.') || p.startsWith('csr.') || p.startsWith('secretarialAudit.') || p.startsWith('costRecords.')) return 'industry';
  if (p.startsWith('balanceSheet') || p.startsWith('financialParametersBS')) return 'bs';
  if (p.startsWith('profitLoss') || p.startsWith('financialParametersPL') || p.startsWith('foreignExchange') || p.startsWith('principalProducts') || p.startsWith('meta.revenueKind')) return 'pl';
  if (p.startsWith('shareCapitalRaised')) return 'sc';
  return 'advanced';
}
function sectionHasValue(id) {
  return $$(`#sec-${id} [data-path]`).some(el => String(el.value || '').trim() !== '');
}
function updateChrome(errors, warnings) {
  const fields = $$('#panel-data [data-path]');
  const total = fields.length;
  const filled = fields.filter(el => String(el.value || '').trim() !== '').length;
  const pct = total ? Math.round((filled / total) * 100) : 0;

  const bar = $('#completenessBar'); if (bar) bar.style.width = pct + '%';
  const txt = $('#completenessText'); if (txt) txt.textContent = `${filled} of ${total} fields`;
  const pctEl = $('#completenessPct'); if (pctEl) pctEl.textContent = pct + '%';

  const money = n => {
    const v = num(n);
    if (v === 0) return '—';
    return (v < 0 ? '−₹' : '₹') + fmtINR(Math.abs(v));
  };
  const put = (id, value, negative) => {
    const el = $(id); if (!el) return;
    el.textContent = value;
    el.classList.toggle('neg', !!negative);
  };
  put('#sumPaidUp', money(state.shareCapital.PAID_UP_NOMINAL));
  put('#sumNetWorth', money(state.financialParametersBS.NET_WORTH));
  put('#sumAssets', money(state.balanceSheet.current.TOTAL_ASSETS));
  put('#sumPat', money(state.profitLoss.current.PROFIT_AFTER_TAX), num(state.profitLoss.current.PROFIT_AFTER_TAX) < 0);
  const eps = num(state.profitLoss.current.EPS_BASIC);
  put('#sumEps', eps === 0 ? '—' : (eps < 0 ? '−₹' : '₹') + Math.abs(eps).toLocaleString('en-IN', { maximumFractionDigits: 2 }), eps < 0);

  const balanced = Math.abs(num(state.balanceSheet.current.TOTAL_EQUITY_LIABILITIES) - num(state.balanceSheet.current.TOTAL_ASSETS)) <= 0.5
    && num(state.balanceSheet.current.TOTAL_ASSETS) !== 0;
  const issues = $('#railIssues');
  if (issues) {
    issues.innerHTML = `
      <div class="row err"><span>Errors</span><b>${errors.length}</b></div>
      <div class="row warn"><span>Warnings</span><b>${warnings.length}</b></div>
      <div class="row"><span>Balance sheet</span><b style="color:${balanced ? 'var(--ok)' : 'var(--text-3)'}">${balanced ? 'Balanced' : 'Not balanced'}</b></div>`;
  }

  const ready = state.meta.fy && num(state.shareCapital.PAID_UP_NOMINAL) > 0 && !errors.length;
  const pill = (el, text, cls) => { if (!el) return; el.textContent = text; el.className = 'pill ' + cls; };
  const stateText = errors.length ? 'Needs fixes' : warnings.length ? 'Warnings' : ready ? 'Ready' : 'Draft';
  const stateCls = errors.length ? 'err' : warnings.length ? 'warn' : ready ? 'ok' : '';
  pill($('#railState'), stateText, stateCls);
  pill($('#clientBadge'), stateText, stateCls);
  renderAoc4TopStatus(errors, warnings);

  for (const id of Object.keys(SECTION_LABELS)) {
    const el = $(`[data-status="${id}"]`);
    if (!el) continue;
    const n = errors.filter(e => sectionOf(e.path) === id).length;
    const w = warnings.filter(e => sectionOf(e.path) === id).length;
    el.innerHTML = n ? `<span class="pill err">${n} error${n === 1 ? '' : 's'}</span>`
      : w ? `<span class="pill warn">${w} warning${w === 1 ? '' : 's'}</span>`
      : sectionHasValue(id) ? `<span class="pill ok">Filled</span>` : '';
  }
  $$('#sectionTabs button').forEach(b => {
    const id = b.dataset.target.replace('sec-', '');
    const dot = b.querySelector('.dot'); if (!dot) return;
    const hasErr = errors.some(e => sectionOf(e.path) === id);
    dot.className = 'dot' + (hasErr ? ' err' : sectionHasValue(id) ? ' ok' : '');
  });
}

// The shared top pill, in AOC-4's words. Called from updateChrome on every AOC-4 refresh and from
// setForm when the user comes back to AOC-4 from another form (whose render overwrote the pill).
function renderAoc4TopStatus(errors, warnings) {
  const top = $('#topStatus');
  if (!top) return;
  if (!errors || !warnings) ({ errors, warnings } = validate());
  const ready = state.meta.fy && num(state.shareCapital.PAID_UP_NOMINAL) > 0 && !errors.length;
  const topText = errors.length ? `${errors.length} error${errors.length === 1 ? '' : 's'}` : warnings.length ? `${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ready ? 'Ready to send' : '';
  top.textContent = topText;
  top.className = 'pill ' + (errors.length ? 'err' : warnings.length ? 'warn' : 'ok');
  top.style.display = topText ? '' : 'none';
}

let touched = new Set();
function applyInlineErrors() {
  if (!$('#dataSections')) return;
  const { errors } = validate();
  const map = new Map(errors.map(e => [e.path, e.msg]));
  $$('#panel-data [data-path]').forEach(el => {
    const path = el.dataset.path;
    const field = el.closest('.f');
    const errEl = field?.querySelector('[data-error]');
    const show = touched.has(path) && map.has(path);
    el.classList.toggle('invalid', show);
    if (errEl) errEl.textContent = show ? map.get(path) : '';
  });
}

let structureKey = '';
function structureSignature() {
  return [state.general.AGM_EXTENSION, state.subsidiary.IS_SUBSIDIARY, state.industry.MAINTAIN_ELECTRONIC_BOOKS, state.industry.MAINTAINED_ON_CLOUD, state.financialParametersBS.OPERATING_LEASE_CONVERTED, state.meta.brSameAsFs, state.signatoriesFS.length, state.signatoriesBR.length, state.balanceSheet.current.asOf, state.balanceSheet.previous.asOf, !!firm, !!state.meta.registeredAddress].join('|');
}
// Chrome = counters, top bar, section status, inline errors, readiness.
function refreshChrome() {
  const { errors, warnings } = validate();
  const total = $$('#panel-data [data-path]').length, filled = $$('#panel-data [data-path]').filter(el => String(el.value || '').trim() !== '').length;
  $('#cnt-data').textContent = `${filled}/${total}`;
  $('#cnt-review').textContent = errors.length ? `${errors.length} error${errors.length > 1 ? 's' : ''}` : warnings.length ? `${warnings.length} warn` : (state.meta.fy ? 'ready' : '');
  $('#cnt-review').className = 'count ' + (errors.length ? 'err' : warnings.length ? '' : 'ok');
  $('#cnt-sandbox').textContent = state.sources['general.CIN'] === 'sandbox' ? '✓' : '';
  $('#cnt-sandbox').className = 'count ok';
  $('#cnt-upload').textContent = uploadedFiles.length ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}` : '';
  $('#companyTag').textContent = [state.meta.companyName, state.meta.fy ? `FY ${state.meta.fy}` : ''].filter(Boolean).join(' · ');
  updateChrome(errors, warnings);
  applyInlineErrors();
  if (activePanel === 'review') renderReview();
  return { errors, warnings };
}
function render(full = false) {
  const sig = structureSignature();
  if (full || sig !== structureKey || !$('#dataSections').children.length) { structureKey = sig; renderDataEntry(); }
  else refreshValues();
  refreshChrome();
}
function afterChange() { derive(); render(); autosave(); }

/* ═══════════════════════════════════════════════════════════════════
   Input binding
   ═══════════════════════════════════════════════════════════════════ */
function readControl(el) {
  if (el.dataset.type === 'date') return fromISO(el.value);
  if (el.dataset.type === 'number') { const t = el.value.trim(); return t === '' ? 0 : (Number.isFinite(Number(stripNum(t))) ? Number(stripNum(t)) : t); }
  return el.value;
}
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset?.path) return;
  if (el.tagName === 'SELECT' || el.dataset.type === 'date') return; // handled on change
  if (el.dataset.type === 'number') {
    const clean = el.value.replace(/[^0-9.,-]/g, '');
    if (clean !== el.value) el.value = clean;
  }
  setValue(el.dataset.path, readControl(el), 'manual');
  derive(); refreshValues(); refreshChrome(); autosave();
  if (el.dataset.path === 'meta.companyName' || el.dataset.path === 'general.CIN') $('#companyTag').textContent = [state.meta.companyName, state.meta.fy ? `FY ${state.meta.fy}` : ''].filter(Boolean).join(' · ');
});
document.addEventListener('change', e => {
  const el = e.target; if (!el.dataset?.path) return;
  const path = el.dataset.path;
  setValue(path, readControl(el), 'manual');
  touched.add(path);
  if (path === 'meta.fy' || path === 'meta.revenueKind') delete state.sources[path];
  if (/\.(AUDITOR_PIN|SERVER_PIN)$/.test(path) && RE.pin.test(el.value)) lookupPin(path.startsWith('auditor') ? 'auditor' : 'industry', el.value);
  afterChange();
});
document.addEventListener('click', e => {
  const t = e.target.closest('button, a'); if (!t) return;
  if (t.dataset.reset) { resetToAuto(t.dataset.reset); return; }
  if (t.dataset.go) { showPanel(t.dataset.go); return; }
  if (t.dataset.addSig) { state[t.dataset.addSig].push({ din: '', name: '', designation: 'Director', date: '' }); afterChange(); return; }
  if (t.dataset.removeSig) { const [which, i] = t.dataset.removeSig.split(':'); state[which].splice(+i, 1); for (const k of Object.keys(state.sources)) if (k.startsWith(which + '.')) delete state.sources[k]; afterChange(); return; }
  if (t.dataset.addCategory) { state.principalProducts.extra.push({ code: '', desc: '', turnover: 0, highCode: '', highDesc: '', highTurnover: 0 }); afterChange(); return; }
  if (t.dataset.removeCategory) { state.principalProducts.extra.splice(+t.dataset.removeCategory, 1); for (const k of Object.keys(state.sources)) if (k.startsWith('principalProducts.extra.')) delete state.sources[k]; afterChange(); return; }
  if (t.dataset.focus) { focusField(t.dataset.focus); return; }
  if (t.id === 'brSame') return;
  if (t.id === 'applyFirm' && firm) { for (const [k] of AUDITOR_FIELDS) if (firm[k] !== undefined) setValue(`auditor.${k}`, firm[k], 'manual'); afterChange(); toast('Firm details applied'); return; }
  if (t.id === 'saveFirm') { firm = {}; for (const [k] of AUDITOR_FIELDS) firm[k] = state.auditor[k]; LS.set('aoc4_firm', firm); render(true); toast('Saved as my firm'); return; }
  if (t.id === 'serverFromRegistered') { applyRegisteredAsServer(); return; }
});
document.addEventListener('change', e => { if (e.target.id === 'brSame') { state.meta.brSameAsFs = e.target.checked; if (!e.target.checked && !state.signatoriesBR.length) state.signatoriesBR = clone(state.signatoriesFS); afterChange(); } });
function focusField(path) {
  showPanel('data');
  touched.add(path);
  const el = $(`[data-path="${CSS.escape(path)}"]`) || $(`[data-path^="${CSS.escape(path)}"]`);
  if (el) {
    const crd = el.closest('.card');
    if (crd) { crd.classList.remove('collapsed'); if (crd.dataset.section) openSections.add(crd.dataset.section); }
    const blk = el.closest('details.subblock');
    if (blk) { blk.open = true; advancedOpen.add(blk.id.replace('blk-', '')); }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus();
    applyInlineErrors();
  }
}
// Number fields are quiet at rest: grouped while unfocused, raw digits while typing.
document.addEventListener('focusin', e => {
  const el = e.target;
  if (el?.dataset?.type === 'number') { const raw = stripNum(el.value); if (raw !== el.value) el.value = raw; }
});
document.addEventListener('focusout', e => {
  const el = e.target; if (!el?.dataset?.path) return;
  const path = el.dataset.path;
  touched.add(path);
  if (el.dataset.type === 'number') {
    const t = el.value.trim();
    if (t === '' || Number.isFinite(Number(stripNum(t)))) el.value = numDisp(t);
  }
  applyInlineErrors();
});
function applyRegisteredAsServer() {
  const addr = String(state.meta.registeredAddress || '').replace(/\s+/g, ' ').trim();
  if (!addr) return toast('No registered office address yet — fetch the company in Filesure lookup first.', true);
  const pin = (addr.match(/\b(\d{6})\b/) || [])[1] || '';
  const parts = addr.replace(/\b\d{6}\b/, '').replace(/,\s*India\s*,?/i, ',').split(',').map(s => s.trim()).filter(Boolean);
  const line1 = parts.slice(0, 2).join(', ');
  const line2 = parts.slice(2, -2).join(', ') || parts.slice(2).join(', ');
  setValue('industry.SERVER_ADDR1', line1.slice(0, 100), 'sandbox');
  setValue('industry.SERVER_ADDR2', line2.slice(0, 100), 'sandbox');
  setValue('industry.SERVER_COUNTRY', 'India', 'sandbox');
  if (pin) { setValue('industry.SERVER_PIN', pin, 'sandbox'); lookupPin('industry', pin); }
  afterChange();
  toast('Server address copied from the registered office');
}

/* ═══════════════════════════════════════════════════════════════════
   Lookups: India Post PIN, Filesure MCA
   ═══════════════════════════════════════════════════════════════════ */
const pinCache = {};
async function lookupPin(section, pin) {
  const prefix = section === 'auditor' ? 'auditor.AUDITOR_' : 'industry.SERVER_';
  try {
    if (!pinCache[pin]) {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const json = await res.json();
      pinCache[pin] = json?.[0]?.Status === 'Success' ? json[0].PostOffice : [];
    }
    const offices = pinCache[pin];
    if (!offices.length) return toast(`No post office found for PIN ${pin}`, true);
    const first = offices[0];
    const current = getPath(state, prefix + 'AREA');
    const areaMatch = offices.find(o => o.Name.trim().toLowerCase() === String(current || '').trim().toLowerCase());
    if (!areaMatch) setValue(prefix + 'AREA', first.Name.trim(), 'auto');
    const city = (first.Block && first.Block !== 'NA' ? first.Block : first.District).trim();
    if (!FIXED.has(srcOf(prefix + 'CITY'))) setValue(prefix + 'CITY', city, 'auto');
    if (!FIXED.has(srcOf(prefix + 'DISTRICT'))) setValue(prefix + 'DISTRICT', first.District.trim(), 'auto');
    if (!FIXED.has(srcOf(prefix + 'STATE'))) setValue(prefix + 'STATE', first.State.trim(), 'auto');
    state.sources[prefix + 'COUNTRY'] = state.sources[prefix + 'COUNTRY'] || 'auto';
    afterChange();
    toast(`PIN ${pin}: ${first.District}, ${first.State} (${offices.length} localities)`);
  } catch (e) { toast(`PIN lookup failed: ${e.message}`, true); }
}

function normalizeFilesureCompany(data) {
  const md = data.masterData?.companyData || {};
  const common = data.masterData?.commonData || {};
  const addr = md.MCAMDSCompanyAddress?.[0] || {};
  const registeredOffice = [addr.streetAddress, addr.streetAddress2, addr.locality, addr.city, addr.district, addr.state, addr.country, addr.postalCode]
    .map(s => String(s || '').trim()).filter(Boolean).join(', ');
  return {
    cin: data.cin || '',
    company_name: data.company || common.companyIncorporationName || '',
    registered_office_address: registeredOffice,
    company_class: md.classOfCompany || '',
    company_status: common.companyStatus || common.status || md.llpStatus || '',
    company_category: md.companyCategory || '',
    company_sub_category: md.companySubcategory || '',
    company_roc_code: md.rocName || common.ROCCode || '',
    company_registration_date: md.dateOfIncorporation || '',
    authorized_capital: md.authorisedCapital != null ? Number(md.authorisedCapital) : undefined,
    paidup_capital: md.paidUpCapital != null ? Number(md.paidUpCapital) : undefined,
    company_industrial_classification: common.NICCode1Desc || md.mainDivisionDescription || ''
  };
}
async function fetchCompanyMasterData(cin) {
  const id = String(cin || '').trim().toUpperCase();
  if (!/^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(id)) {
    throw new Error('That is not a valid 21-character CIN (for example U80904KA2018PTC119370).');
  }
  const gatewayUrl = sanitizeUrl(settings.gatewayUrl);
  const gatewayToken = String(settings.gatewayToken || '').trim();
  if (!gatewayUrl) throw new Error('No Gateway URL saved in Settings → AI extraction.');
  if (!gatewayToken) throw new Error('No Gateway Token saved in Settings → AI extraction.');
  const resp = await fetch('/api/gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: gatewayUrl, token: gatewayToken, body: { route: 'filesure-company', cin: id } })
  });
  const raw = await resp.text();
  let json; try { json = raw ? JSON.parse(raw) : {}; } catch (_) { json = { error: cleanErrorBody(raw, resp.status) }; }
  if (!resp.ok || json.error) throw new Error(`Company lookup failed (${resp.status})${json.error ? `: ${json.error}` : ''}`);
  if (!json.data) throw new Error('No master data returned');
  return normalizeFilesureCompany(json.data);
}
async function searchCompany(name) {
  // Filesure's company lookup is CIN-based. Name search is therefore limited to companies
  // previously saved in this browser.
  return Object.values(getMasterList()).filter(c => String(c.company_name || '').toLowerCase().includes(name.toLowerCase()))
    .map(c => ({ cin: c.cin, company_name: c.company_name }));
}
function getMasterList() { return LS.get('aoc4_company_master_list', {}); }
function applyMasterData(d) {
  state.master = d;
  setValue('general.CIN', d.cin, 'sandbox');
  setValue('meta.companyName', d.company_name || '', 'sandbox');
  setValue('meta.registeredAddress', d.registered_office_address || '', 'sandbox');
  setValue('meta.companyClass', d.company_class || '', 'sandbox');
  setValue('meta.companyStatus', d.company_status || '', 'sandbox');
  setValue('meta.registrationDate', d.company_registration_date || '', 'sandbox');
  if (d.authorized_capital != null) setValue('shareCapital.AUTH_NOMINAL', num(d.authorized_capital), 'sandbox');
  if (d.paidup_capital != null) setValue('shareCapital.PAID_UP_NOMINAL', num(d.paidup_capital), 'sandbox');
  const list = getMasterList(); list[d.cin] = Object.assign({}, d, { _savedAt: Date.now() }); LS.set('aoc4_company_master_list', list);
  afterChange();
  renderSandboxResult(d);
  renderSavedCompanies();
}
function renderSandboxResult(d) {
  const rows = [['Company name', d.company_name], ['CIN', d.cin], ['Status', d.company_status], ['Class', d.company_class], ['Category', d.company_category], ['Sub-category', d.company_sub_category], ['ROC', d.company_roc_code], ['Registered on', d.company_registration_date], ['Authorised capital', d.authorized_capital != null ? '₹' + fmtINR(num(d.authorized_capital)) : ''], ['Paid-up capital', d.paidup_capital != null ? '₹' + fmtINR(num(d.paidup_capital)) : ''], ['Registered office', d.registered_office_address], ['Industrial classification', d.company_industrial_classification]];
  $('#sbKv').innerHTML = rows.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  $('#sbApplied').textContent = 'Filled in the form: CIN, company name, registered office, company class, authorised and paid-up capital. Paid-up capital also seeds the share count, EPS and the opening share-capital row.';
  $('#sbResultBlock').classList.remove('hidden');
  $('#sbStatus').innerHTML = '';
}
function renderSavedCompanies() {
  const list = getMasterList(); const keys = Object.keys(list);
  $('#savedCompanyWrap').classList.toggle('hidden', !keys.length);
  $('#savedCompanies').innerHTML = '<option value="">Select…</option>' + keys.map(cin => `<option value="${esc(cin)}">${esc(list[cin].company_name)} (${esc(cin)})</option>`).join('');
}
function bindSandbox() {
  const cinIn = $('#sbCin'), fetchBtn = $('#sbFetchBtn');
  cinIn.value = state.general.CIN || '';
  fetchBtn.disabled = !RE.cin.test(cinIn.value.trim());
  cinIn.addEventListener('input', () => { const up = cinIn.value.toUpperCase(); if (up !== cinIn.value) cinIn.value = up; fetchBtn.disabled = !RE.cin.test(cinIn.value.trim()); });
  $$('#panel-sandbox .seg button').forEach(b => b.addEventListener('click', () => { $$('#panel-sandbox .seg button').forEach(x => x.classList.toggle('active', x === b)); $('#sbByCin').classList.toggle('hidden', b.dataset.mode !== 'cin'); $('#sbByName').classList.toggle('hidden', b.dataset.mode !== 'name'); }));
  fetchBtn.addEventListener('click', async () => {
    const cin = cinIn.value.trim().toUpperCase();
    fetchBtn.disabled = true; $('#sbStatus').innerHTML = '<span class="spin"></span> Fetching from MCA via Filesure…';
    try { applyMasterData(await fetchCompanyMasterData(cin)); toast('Company data fetched'); }
    catch (e) { $('#sbStatus').innerHTML = `<div class="note err">${esc(e.message)}</div>`; }
    finally { fetchBtn.disabled = !RE.cin.test(cinIn.value.trim()); }
  });
  const doSearch = async () => {
    const q = $('#sbName').value.trim();
    if (q.length < 3) return toast('Type at least 3 characters of the company name', true);
    $('#sbStatus').innerHTML = '<span class="spin"></span> Searching…'; $('#sbResults').classList.add('hidden');
    try {
      const recs = await searchCompany(q);
      $('#sbStatus').innerHTML = recs.length ? '' : '<div class="note">No saved company matches that name. Filesure master-data lookup needs a CIN; switch to By CIN or look up and save the company first.</div>';
      $('#sbResults').innerHTML = recs.map(r => `<button data-pick="${esc(r.cin)}"><span>${esc(r.company_name || '')}</span><span class="muted">${esc(r.cin)}</span></button>`).join('');
      $('#sbResults').classList.toggle('hidden', !recs.length);
    } catch (e) { $('#sbStatus').innerHTML = `<div class="note err">${esc(e.message)}</div>`; }
  };
  $('#sbSearchBtn').addEventListener('click', doSearch);
  $('#sbName').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  $('#sbResults').addEventListener('click', async e => {
    const b = e.target.closest('button[data-pick]'); if (!b) return;
    cinIn.value = b.dataset.pick; fetchBtn.disabled = false;
    $('#sbStatus').innerHTML = '<span class="spin"></span> Fetching master data…';
    try { applyMasterData(await fetchCompanyMasterData(b.dataset.pick)); toast('Company data fetched'); }
    catch (err) { $('#sbStatus').innerHTML = `<div class="note err">${esc(err.message)}</div>`; }
  });
  $('#savedCompanies').addEventListener('change', e => { const d = getMasterList()[e.target.value]; if (d) { cinIn.value = d.cin; fetchBtn.disabled = false; applyMasterData(d); toast('Loaded cached master data'); } });
  $('#sbServerAddrBtn').addEventListener('click', applyRegisteredAsServer);
  renderSavedCompanies();
}

/* ═══════════════════════════════════════════════════════════════════
   Filesure API test console — one row per endpoint, each callable on its own so you can see exactly
   what fields it returns before anything is wired into the form.
   CONFIRMED 2026-11-03 — the Gateway's full, authoritative route list (deployed version 8):
     No unlock needed:        filesure-resolve, filesure-company, filesure-filings,
                               filesure-director-resolve, filesure-director,
                               filesure-freshness, filesure-unlock-status
     Needs the company to already be unlocked: filesure-extraction-forms, filesure-extraction-years,
                               filesure-extraction, filesure-filing-doc
     Paid actions (group 'paid') — calling WITHOUT `confirm: true` returns a price quote only and
     charges nothing; only a second call WITH `confirm: true` actually executes and charges:
                               filesure-unlock (₹330), filesure-refresh (₹1), filesure-fetch-docs (₹150)
   ═══════════════════════════════════════════════════════════════════ */
// `price` is from the ORIGINAL price list you pasted, matched to its closest real route. It's shown
// as a reference figure only — for the 3 "paid" rows, the live quote the API itself returns (shown
// after clicking "Get quote") is the authoritative number, not this static label.
const FILESURE_ENDPOINTS = [
  { key: 'resolve', route: 'filesure-resolve', needs: ['q'], price: '₹5.00', label: 'Resolve a company by name or search text' },
  { key: 'company', route: 'filesure-company', needs: ['cin'], price: '₹5.00', label: 'Company master data (name, address, class, status, capital)' },
  { key: 'filings', route: 'filesure-filings', needs: ['cin'], price: '₹5.00', label: 'List filings on record for this company' },
  { key: 'director-resolve', route: 'filesure-director-resolve', needs: ['q'], price: '₹5.00', label: 'Resolve a director by name or search text' },
  { key: 'director', route: 'filesure-director', needs: ['din'], price: '₹5.00', label: 'Director profile (name, other directorships)' },
  { key: 'freshness', route: 'filesure-freshness', needs: ['cin'], price: 'Not in original price list — likely free', label: 'How current the cached data is' },
  { key: 'unlock-status', route: 'filesure-unlock-status', needs: ['cin'], price: 'Not in original price list — likely free', label: 'Whether this company is currently unlocked' },
  // Needs the company to already be unlocked (via filesure-unlock below) — will error until then.
  { key: 'extraction-forms', route: 'filesure-extraction-forms', needs: ['cin'], unlockRequired: true, price: '₹0.05', label: 'Which forms have extracted data available' },
  { key: 'extraction-years', route: 'filesure-extraction-years', needs: ['cin', 'form'], unlockRequired: true, price: '₹0.05', label: 'Which years are available for one form' },
  { key: 'extraction', route: 'filesure-extraction', needs: ['cin', 'form', 'year'], unlockRequired: true, price: '₹0.05', label: 'The actual extracted financial data (JSON)' },
  { key: 'filing-doc', route: 'filesure-filing-doc', needs: ['cin', 'filingId'], unlockRequired: true, price: '₹0.05', label: 'Download one filing (PDF)' },
  // Paid actions: the number here is a reference only — the live quote from the API is authoritative.
  { key: 'unlock', route: 'filesure-unlock', needs: ['cin'], paid: true, price: '₹330.00', label: 'Unlock one year of documents for this company' },
  { key: 'refresh', route: 'filesure-refresh', needs: ['cin'], paid: true, price: '₹1.00', label: "Re-read this company's data from MCA" },
  { key: 'fetch-docs', route: 'filesure-fetch-docs', needs: ['cin'], paid: true, price: '₹150.00', label: 'Download missing filings for this company' }
];
const FIELD_LABEL = { cin: 'CIN', din: 'DIN', q: 'Search text', filingId: 'Filing / SRN id', form: 'Form (e.g. AOC-4)', year: 'Year (e.g. 2025-26)' };

/** Calls one Filesure endpoint through the same /api/gateway proxy the CIN lookup already uses, and
 * returns the raw parsed response so the console can show exactly what came back — nothing here
 * reshapes or picks fields the way applyMasterData()/normalizeFilesureCompany() do for the real flow. */
async function callFilesureEndpoint(endpoint, params) {
  const gatewayUrl = sanitizeUrl(settings.gatewayUrl);
  const gatewayToken = String(settings.gatewayToken || '').trim();
  if (!gatewayUrl) throw new Error('No Gateway URL saved in Settings → AI extraction.');
  if (!gatewayToken) throw new Error('No Gateway Token saved in Settings → AI extraction.');
  const resp = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: gatewayUrl, token: gatewayToken, body: { route: endpoint.route, ...params } }) });
  const raw = await resp.text();
  let json; try { json = raw ? JSON.parse(raw) : {}; } catch (_) { json = { error: cleanErrorBody(raw, resp.status) }; }
  if (!resp.ok || json.error) throw new Error(`${endpoint.key} failed (${resp.status})${json.error ? `: ${json.error}` : ''}`);
  return json;
}

function renderFilesureConsole() {
  $('#filesureConsoleNote').innerHTML = `All routes are live (Gateway version 8, confirmed 2026-11-03). Rows marked 🔒 need the company unlocked first (<code>filesure-unlock</code> below) or they'll error. Rows marked 💰 are paid actions — clicking "Get quote" calls the route WITHOUT charging anything (the API itself returns a price quote); a "Confirm & execute (₹…)" button then appears to actually run it and charge.`;
  let html = '<thead><tr><th>Endpoint</th><th>Price</th><th>Extra input</th><th></th><th>Status</th></tr></thead><tbody>';
  FILESURE_ENDPOINTS.forEach((ep, i) => {
    const extraNeeds = ep.needs.filter(n => n !== 'cin' && n !== 'din' && n !== 'q');
    const extraInputs = extraNeeds.map(n => `<input class="in sm" data-fc-extra="${esc(n)}" data-fc-row="${i}" placeholder="${esc(FIELD_LABEL[n] || n)}" style="width:120px">`).join(' ');
    const action = `<button class="btn sm${ep.paid ? ' danger' : ''}" data-fc-call="${i}">${ep.paid ? 'Get quote' : 'Call'}</button>`;
    const flags = `${ep.unlockRequired ? ' 🔒' : ''}${ep.paid ? ' 💰' : ''}`;
    html += `<tr><td class="lbl">${esc(ep.key)}${flags}<small>${esc(ep.label)}</small></td><td class="muted">${esc(ep.price || '—')}</td><td>${extraInputs || '<span class="muted">—</span>'}</td><td>${action}</td><td class="muted" data-fc-status="${i}"></td></tr>`;
  });
  html += '</tbody>';
  $('#filesureEndpointTable').innerHTML = html;
}

/* ---- turns an arbitrary API response into a readable nested list instead of a raw JSON dump ---- */
function humanizeKey(k) {
  return String(k).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase()) || String(k);
}
function isEmptyValue(v) {
  if (v === null || v === undefined || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}
function readableValueHtml(v, depth) {
  if (isEmptyValue(v)) return '<span class="muted">—</span>';
  if (Array.isArray(v)) {
    if (v.every(x => x === null || typeof x !== 'object')) return esc(v.filter(x => !isEmptyValue(x)).map(String).join(', ')) || '<span class="muted">—</span>';
    return `<div class="readable-list">${v.map((item, i) => `<div class="readable-item"><div class="readable-item-head">#${i + 1}</div>${readableValueHtml(item, depth + 1)}</div>`).join('')}</div>`;
  }
  if (typeof v === 'object') return readableObjectHtml(v, depth + 1);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return esc(v.toLocaleString('en-IN'));
  return esc(String(v));
}
function readableObjectHtml(obj, depth = 0) {
  const entries = Object.entries(obj || {}).filter(([, v]) => !isEmptyValue(v));
  if (!entries.length) return '<span class="muted">(no data)</span>';
  return `<dl class="kv${depth ? ' nested' : ''}">${entries.map(([k, v]) => `<dt>${esc(humanizeKey(k))}</dt><dd>${readableValueHtml(v, depth)}</dd>`).join('')}</dl>`;
}

/** Renders one API response into #filesureConsoleResult, readable by default with a raw-JSON toggle.
 * `extraHtml` (e.g. a "Confirm & execute" button for a price quote) is inserted above the data. */
function renderFilesureResult(title, subtitle, json, extraHtml = '') {
  $('#filesureConsoleResult').innerHTML = `<div class="card-head" style="cursor:default"><div class="card-heading"><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div><button class="btn sm" id="fcToggleRaw">View raw JSON</button></div>${extraHtml}<div id="fcReadable">${readableObjectHtml(json, 0)}</div><pre class="json hidden" id="fcRawJson">${esc(JSON.stringify(json, null, 2))}</pre>`;
  $('#fcToggleRaw').addEventListener('click', () => {
    const readableEl = $('#fcReadable'), rawEl = $('#fcRawJson'), btn = $('#fcToggleRaw');
    const switchingToRaw = !readableEl.classList.contains('hidden'); // readable is showing now
    readableEl.classList.toggle('hidden', switchingToRaw);
    rawEl.classList.toggle('hidden', !switchingToRaw);
    btn.textContent = switchingToRaw ? 'View readable' : 'View raw JSON';
  });
}

function collectFilesureParams(ep, i) {
  const cin = $('#fcCin').value.trim().toUpperCase(), din = $('#fcDin').value.trim(), q = $('#fcQ').value.trim();
  const params = {};
  for (const n of ep.needs) {
    if (n === 'cin') { if (!cin) throw new Error('Enter a CIN first'); params.cin = cin; }
    else if (n === 'din') { if (!din) throw new Error('Enter a DIN first'); params.din = din; }
    else if (n === 'q') { if (!q) throw new Error('Enter search text first'); params.q = q; }
    else { const el = $(`[data-fc-extra="${n}"][data-fc-row="${i}"]`); const v = el ? el.value.trim() : ''; if (!v) throw new Error(`Enter ${FIELD_LABEL[n] || n} for this row first`); params[n] = v; }
  }
  return params;
}

/* ---- "Apply to form" for the two console endpoints that carry fillable data ----
   'company' reuses the exact same normalizeFilesureCompany()/applyMasterData() the Filesure lookup
   panel already uses. 'extraction' (a filed AOC-4's own figures, read back from MCA) is new: Filesure
   returns these as XBRL facts (qname + value), one row per Ind AS taxonomy concept, not under the
   dashboard's own field keys — so a small, explicit map translates the concepts we recognize. Nothing
   here is invented: a concept missing from the map, or missing from the response, is simply left out
   rather than guessed. */
const FS_BS_QNAME = {
  SHARE_CAPITAL: 'EquityShareCapital', RESERVES_SURPLUS: 'OtherEquity', LONG_TERM_BORROWINGS: 'BorrowingsNoncurrent',
  DEFERRED_TAX_LIAB: 'DeferredTaxLiabilities', OTHER_LONG_TERM_LIAB: 'OtherNoncurrentLiabilities', LONG_TERM_PROVISIONS: 'ProvisionsNoncurrent',
  SHORT_TERM_BORROWINGS: 'BorrowingsCurrent', TRADE_PAYABLES_OTHER: 'TradePayablesCurrent', OTHER_CURRENT_LIAB: 'OtherCurrentLiabilities',
  SHORT_TERM_PROVISIONS: 'ProvisionsCurrent', PPE: 'PropertyPlantAndEquipment', INTANGIBLE_ASSETS: 'OtherIntangibleAssets',
  CWIP: 'CapitalWorkInProgress', INTANGIBLE_UNDER_DEV: 'IntangibleAssetsUnderDevelopment', NON_CURRENT_INVESTMENTS: 'NoncurrentInvestments',
  DEFERRED_TAX_ASSETS: 'DeferredTaxAssets', LONG_TERM_LOANS_ADVANCES: 'LoansNoncurrent', OTHER_NON_CURRENT_ASSETS: 'OtherNoncurrentAssets',
  CURRENT_INVESTMENTS: 'CurrentInvestments', INVENTORIES: 'Inventories', TRADE_RECEIVABLES: 'TradeReceivablesCurrent',
  CASH_EQUIVALENTS: 'CashAndCashEquivalents', SHORT_TERM_LOANS_ADVANCES: 'LoansCurrent', OTHER_CURRENT_ASSETS: 'OtherCurrentAssets'
};
const FS_PL_QNAME = {
  REVENUE_OPERATIONS: 'RevenueFromOperations', OTHER_INCOME: 'OtherIncome', EMPLOYEE_EXPENSES: 'EmployeeBenefitExpense',
  FINANCE_COSTS: 'FinanceCosts', DEPRECIATION: 'DepreciationDepletionAndAmortisationExpense', OTHER_EXPENSES: 'OtherExpenses',
  CURRENT_TAX: 'CurrentTax', DEFERRED_TAX: 'DeferredTax', EPS_BASIC: 'BasicEarningsLossPerShare', EPS_DILUTED: 'DilutedEarningsLossPerShare'
};
const FS_FIELD_LABEL = Object.assign(
  Object.fromEntries([...BS_LIAB, ...BS_ASSET, ...PL_IN].map(([, k, label]) => [k, label])),
  { EPS_BASIC: 'EPS basic (₹)', EPS_DILUTED: 'EPS diluted (₹)' }
);
const localQname = q => String(q || '').split(':').pop();
/** Matches the filing's period_end against the form's current/previous balance-sheet dates
 * (set once the financial year is chosen in Data Entry) so figures land in the right column. */
function filesureExtractionToRows(data) {
  const bsLookup = {}; (data.balance_sheet || []).forEach(r => { bsLookup[localQname(r.qname)] = r.value; });
  const plLookup = {}; (data.profit_and_loss || []).forEach(r => { plLookup[localQname(r.qname)] = r.value; });
  const periodEndIso = data.period_end || '';
  const curIso = toISO(state.balanceSheet.current.asOf), prevIso = toISO(state.balanceSheet.previous.asOf);
  const period = (periodEndIso && periodEndIso === prevIso) ? 'previous' : 'current';
  const rows = [];
  for (const [key, qn] of Object.entries(FS_BS_QNAME)) {
    if (!(qn in bsLookup)) continue;
    rows.push({ ctx: 'balanceSheet', key, value: Number(bsLookup[qn]) || 0, label: FS_FIELD_LABEL[key] || key, current: num(getPath(state, `balanceSheet.${period}.${key}`)) });
  }
  for (const [key, qn] of Object.entries(FS_PL_QNAME)) {
    if (!(qn in plLookup)) continue;
    rows.push({ ctx: 'profitLoss', key, value: Number(plLookup[qn]) || 0, label: FS_FIELD_LABEL[key] || key, current: num(getPath(state, `profitLoss.${period}.${key}`)) });
  }
  return { rows, period, periodEndIso };
}
function filesureCompanyApplyHtml(companyData) {
  const d = normalizeFilesureCompany(companyData);
  if (!d.cin) return '';
  return `<div class="note mb12">Apply <strong>${esc(d.company_name || d.cin)}</strong>'s master data (CIN, name, address, class, capital) to the form — same as the Filesure lookup panel.<div class="mt8"><button class="btn sm primary" id="fcApplyCompany">Apply to form</button></div></div>`;
}
function filesureExtractionApplyHtml(data) {
  const { rows, period, periodEndIso } = filesureExtractionToRows(data);
  if (!rows.length) return '<div class="note warn">No figures in this response matched a known AOC-4 field (balance sheet / profit &amp; loss).</div>';
  const trs = rows.map((r, i) => `<tr><td><input type="checkbox" data-fx-row="${i}" ${r.value !== r.current ? 'checked' : ''}></td><td class="lbl">${esc(r.label)}</td><td class="muted">${esc(fmtINR(r.current))}</td><td>${esc(fmtINR(r.value))}</td></tr>`).join('');
  return `<div class="note mb12">Matched <strong>${rows.length}</strong> figure${rows.length === 1 ? '' : 's'} from this filing (period ending ${esc(fromISO(periodEndIso) || periodEndIso || '?')}) to the <strong>${period}</strong> column of the form. Set the financial year in Data Entry first if that's not the column you expect.
    <div class="mt8 scroll-x" style="max-height:280px;overflow:auto"><table class="tbl compact"><thead><tr><th></th><th>Field</th><th>In the form now</th><th>From Filesure</th></tr></thead><tbody>${trs}</tbody></table></div>
    <div class="mt8"><button class="btn sm primary" id="fcApplyExtraction">Apply checked to form</button></div></div>`;
}
function applyFilesureExtractionRows(data) {
  const { rows, period } = filesureExtractionToRows(data);
  let n = 0;
  $$('#filesureConsoleResult [data-fx-row]:checked').forEach(cb => {
    const r = rows[+cb.dataset.fxRow]; if (!r) return;
    setValue(`${r.ctx}.${period}.${r.key}`, r.value, 'sandbox');
    n++;
  });
  if (!n) return toast('Nothing checked', true);
  afterChange(); render(true);
  toast(`${n} figure${n === 1 ? '' : 's'} applied from Filesure to the ${period} column`);
}

async function runFilesureEndpoint(i) {
  const ep = FILESURE_ENDPOINTS[i];
  const statusCell = $(`[data-fc-status="${i}"]`);
  let params;
  try { params = collectFilesureParams(ep, i); } catch (e) { return toast(e.message, true); }
  statusCell.innerHTML = '<span class="spin"></span> Calling…';
  $('#filesureConsoleResult').innerHTML = '';
  try {
    // Paid actions: call WITHOUT confirm first — the API itself returns a price quote and charges
    // nothing. Only a second call WITH confirm:true (below, after the user explicitly clicks through
    // the quote) actually executes and spends money.
    const json = await callFilesureEndpoint(ep, params);
    statusCell.innerHTML = '<span class="pill ok">OK</span>';
    let extraHtml = '';
    if (ep.paid) extraHtml = `<div class="note warn mb12">This was a price quote only — nothing was charged. Review it, then confirm to actually run this and spend money.<div class="mt8"><button class="btn sm danger" id="fcConfirmExecute">Confirm &amp; execute</button></div></div>`;
    else if (ep.key === 'company' && json.data) extraHtml = filesureCompanyApplyHtml(json.data);
    else if (ep.key === 'extraction' && json.data) extraHtml = filesureExtractionApplyHtml(json.data);
    renderFilesureResult(ep.key, ep.paid ? 'Price quote — nothing charged yet' : 'What this endpoint returned, read out field by field', json, extraHtml);
    if (ep.paid) {
      $('#fcConfirmExecute').addEventListener('click', async () => {
        const ok = confirm(`This will actually run ${ep.key} and may charge money. Continue?`);
        if (!ok) return;
        statusCell.innerHTML = '<span class="spin"></span> Executing…';
        try {
          const executed = await callFilesureEndpoint(ep, { ...params, confirm: true });
          statusCell.innerHTML = '<span class="pill ok">Executed</span>';
          renderFilesureResult(ep.key, 'Executed — this call was charged', executed);
        } catch (e) {
          statusCell.innerHTML = '<span class="pill err">Failed</span>';
          $('#filesureConsoleResult').innerHTML = `<div class="note err">${esc(e.message)}</div>`;
        }
      });
    } else if (ep.key === 'company' && json.data) {
      const b = $('#fcApplyCompany'); if (b) b.addEventListener('click', () => { applyMasterData(normalizeFilesureCompany(json.data)); toast('Company data applied to the form'); });
    } else if (ep.key === 'extraction' && json.data) {
      const b = $('#fcApplyExtraction'); if (b) b.addEventListener('click', () => applyFilesureExtractionRows(json.data));
    }
  } catch (e) {
    statusCell.innerHTML = '<span class="pill err">Failed</span>';
    $('#filesureConsoleResult').innerHTML = `<div class="note err">${esc(e.message)}</div>`;
  }
}

/** Calls any route name typed in by hand, with a raw JSON body — for trying a route someone just
 * told you about without needing a code change + redeploy round-trip first. Shows the same
 * readable-by-default / raw-JSON-toggle result as the table rows above. */
async function runCustomFilesureRoute() {
  const route = $('#fcCustomRoute').value.trim();
  if (!route) return toast('Enter a route name first', true);
  let params = {};
  const bodyText = $('#fcCustomBody').value.trim();
  if (bodyText) {
    try { params = JSON.parse(bodyText); }
    catch (e) { return toast(`Body params aren't valid JSON: ${e.message}`, true); }
  }
  const btn = $('#fcCustomCallBtn');
  btn.disabled = true; btn.textContent = 'Calling…';
  $('#filesureConsoleResult').innerHTML = '';
  try {
    const json = await callFilesureEndpoint({ key: route, route }, params);
    renderFilesureResult(route, 'What this route returned, read out field by field', json);
    toast(`${route} worked`);
  } catch (e) {
    $('#filesureConsoleResult').innerHTML = `<div class="note err">${esc(e.message)}</div>`;
  } finally { btn.disabled = false; btn.textContent = 'Call'; }
}

function bindFilesureConsole() {
  renderFilesureConsole();
  $('#fcCin').value = state.general.CIN || '';
  $('#filesureEndpointTable').addEventListener('click', e => {
    const b = e.target.closest('button[data-fc-call]'); if (!b) return;
    runFilesureEndpoint(+b.dataset.fcCall);
  });
  $('#fcCustomCallBtn').addEventListener('click', runCustomFilesureRoute);
}

/* ═══════════════════════════════════════════════════════════════════
   Upload & AI extraction
   ═══════════════════════════════════════════════════════════════════ */
const uploadedFiles = [];
/* ═══════════════════════════════════════════════════════════════════
   Upload & AI: documents → proposals → review → form
   The parsing itself lives in js/extractor.js (shared with the tests).
   ═══════════════════════════════════════════════════════════════════ */
let docs = [];                       // ingested documents, parallel to uploadedFiles
let proposals = [];                  // merged proposals shown in the review table
let proposalSigs = { FS: [], BR: [] };
let proposalFilterMode = 'all';
let lastExtraction = null;

/* ── Reconciliation workspace state (Phases 4-8): deterministic checks and review tooling built on
   top of the proposals above. Kept out of `state` entirely — none of this is part of the AOC-4
   filing JSON contract, so it can never leak into "Send to extension". ── */
let reconciliation = null;          // AOC4Reconcile.reconcile() output: { issues, summary }
let comparisonRows = [];            // AOC4Compare.buildComparisonRows() output
let fieldRecords = [];              // AOC4FieldRecords.buildFieldRecord() output, one per proposal
let notComparablePaths = new Set(); // paths whose FY column was absent from every uploaded document
let comparisonFilterMode = 'all';
let unifiedIssues = { issues: [], summary: {} }; // AOC4IssueStore.collectIssues() — drives the Validation Centre
let completeness = null;            // AOC4FieldRecords.computeCompletenessMetrics() output
const reviewStore = new AOC4ReviewStore.ReviewStore();

const loadScript = (() => { const cache = {}; return src => cache[src] || (cache[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete cache[src]; rej(new Error(`Could not load ${src.split('/').pop()} — check the internet connection`)); }; document.head.appendChild(s); })); })();
const LIBS = { xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', jszip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js' };
if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';

const TYPE_LABEL = { 'aoc4-form': 'Filed AOC-4 form', financials: 'Financial statements', 'balance-sheet': 'Balance sheet', 'profit-loss': 'Profit & loss', 'auditor-report': "Auditor's report", 'board-report': "Board's report", workbook: 'Workbook', 'client-json': 'Client JSON', image: 'Image', text: 'Text', unreadable: 'Could not read' };
const SECTION_TITLES = { meta: 'Company & financial year', general: 'General information (Q1–7)', signatoriesFS: 'Signatories', subsidiary: 'Subsidiary (Q8)', auditor: 'Auditor (Q9)', industry: 'Industry, books of account & server (Q10–12)', shareCapital: 'Share capital', balanceSheet: 'Balance sheet', profitLoss: 'Profit and loss', financialParametersBS: 'Financial parameters — balance sheet', financialParametersPL: 'Financial parameters — profit and loss', costRecords: 'Cost records', principalProducts: 'Products / services', relatedParty: 'Related party', auditorReport: "Auditor's report", csr: 'CSR', secretarialAudit: 'Secretarial audit' };
const SECTION_ORDER = Object.keys(SECTION_TITLES);

/** Everything the model may return. Balance-sheet / P&L paths are period-neutral: the app maps period_end to current/previous. */
function aiCatalog() {
  const cat = [];
  const add = (path, label, type, options) => cat.push(options ? { path, label, type, options } : { path, label, type });
  add('meta.fy', 'Financial year of the statements being filed, written like 2025-26', 'text');
  add('meta.companyName', 'Company name', 'text'); add('general.CIN', 'Corporate identity number (CIN)', 'text');
  add('general.FY_FROM', 'Financial year start', 'date'); add('general.FY_TO', 'Financial year end', 'date');
  add('general.BOARD_MEETING_DATE', 'Board meeting date approving the financial statements', 'date'); add('general.BOARD_REPORT_DATE', "Board meeting date approving the board's report", 'date');
  add('general.AUDITOR_SIGN_DATE', "Date of the auditor's report (signing of the financial statements by the auditors)", 'date');
  add('general.AGM_DATE', 'AGM date', 'date'); add('general.AGM_DUE_DATE', 'AGM due date', 'date');
  add('general.NATURE_FS', 'Nature of financial statements', 'select', ['adopted', 'provisional', 'revised130', 'revised131']);
  add('general.AGM_HELD', 'Whether the AGM was held', 'select', ['Yes', 'No', 'Not applicable']); add('general.AGM_EXTENSION', 'Whether an AGM extension was granted', 'select', YESNO);
  for (const [k, label, type, opts] of AUDITOR_FIELDS) add(`auditor.${k}`, 'Auditor: ' + label, type === 'select' ? 'select' : 'text', opts);
  add('auditor.ADT_SRN', 'SRN of Form ADT-1 (auditor appointment)', 'text'); add('auditor.NUM_AUDITORS', 'Number of auditors', 'text');
  add('subsidiary.IS_SUBSIDIARY', 'Whether the company is a subsidiary', 'select', YESNO); add('subsidiary.HOLDING_CIN', 'CIN of the holding company', 'text'); add('subsidiary.HOLDING_NAME', 'Name of the holding company', 'text'); add('subsidiary.HAS_SUBSIDIARY_OR_JV', 'Whether the company has a subsidiary, associate or joint venture', 'select', YESNO);
  add('industry.TYPE_OF_INDUSTRY', 'Type of industry', 'select', ['Commercial & Industrial', 'Banking', 'Insurance', 'Power', 'NBFC']);
  add('industry.SCHEDULE_III', 'Whether Schedule III applies', 'select', YESNO); add('industry.CONSOLIDATED_FS', 'Whether consolidated financial statements are required', 'select', YESNO);
  add('industry.MAINTAIN_ELECTRONIC_BOOKS', 'Whether books of account are kept in electronic form', 'select', YESNO);
  for (const [k, label] of [['SERVER_ADDR1', 'address line 1'], ['SERVER_ADDR2', 'address line 2'], ['SERVER_COUNTRY', 'country'], ['SERVER_PIN', 'PIN code'], ['SERVER_AREA', 'area / locality'], ['SERVER_CITY', 'city'], ['SERVER_DISTRICT', 'district'], ['SERVER_STATE', 'state / UT']]) add(`industry.${k}`, `Computer servers (books of account) ${label}`, 'text');
  add('industry.MAINTAINED_ON_CLOUD', 'Whether books are maintained on cloud', 'select', YESNO);
  for (const [k, label] of [['SERVICE_PROVIDER_NAME', 'name'], ['SERVICE_PROVIDER_IP', 'IP address'], ['SERVICE_PROVIDER_LOCATION', 'location'], ['SERVICE_PROVIDER_ADDRESS', 'address']]) add(`industry.${k}`, `Cloud service provider ${label}`, 'text');
  for (const [k, label] of [['FACE_VALUE', 'Face value per equity share (Rs)'], ['AUTH_SHARES', 'Authorised number of equity shares'], ['ISSUED_SHARES', 'Issued number of equity shares'], ['PAID_UP_SHARES', 'Paid-up number of equity shares'], ['AUTH_NOMINAL', 'Authorised share capital (Rs)'], ['ISSUED_NOMINAL', 'Issued share capital (Rs)'], ['PAID_UP_NOMINAL', 'Paid-up share capital (Rs)']]) add(`shareCapital.${k}`, label, 'number');
  for (const [, k, label] of [...BS_LIAB, ...BS_ASSET]) add(`balanceSheet.${k}`, `Balance sheet: ${label} (give period_end)`, 'number');
  for (const [, k, label] of PL_IN) add(`profitLoss.${k}`, `Profit and loss: ${label} (give period_end = year end)`, 'number');
  // Break-up of balance sheet figures (unsecured borrowings by lender type, trade receivables ageing) —
  // these are sub-schedules of the balance sheet the AI catalogue previously never asked about at all.
  for (const [section, k, label] of BREAKUP) add(`balanceSheetBreakup.${k}`, `Balance sheet break-up${section ? ' — ' + section : ''}: ${label} (give period_end)`, 'number');
  // Detailed P&L break-up (domestic/export turnover, materials consumed, inventory movements...).
  for (const [section, k, label] of PL_DETAIL) add(`profitLossDetails.${k}`, `Profit and loss detail${section ? ' — ' + section : ''}: ${label} (give period_end = year end)`, 'number');
  // Earnings/expenditure in foreign exchange.
  for (const [section, k, label] of FX) add(`foreignExchange.${k}`, `Foreign exchange${section ? ' — ' + section : ''}: ${label} (give period_end = year end)`, 'number');
  add('financialParametersBS.NET_WORTH', 'Net worth of the company at year end (Rs)', 'number'); add('financialParametersBS.GROSS_PPE_INTANGIBLE', 'Gross block of PPE and intangible assets at year end (Rs)', 'number'); add('financialParametersBS.DEPRECIATION_AMORTIZATION_BS', 'Accumulated depreciation and amortisation at year end (Rs)', 'number');
  add('financialParametersBS.OPERATING_LEASE_CONVERTED', 'Whether an operating lease was converted to a finance lease', 'select', YESNO);
  // NOTE — scope decision: the dashboard also holds ~43 more numbered "financial parameter" fields
  // (FP_BS_01-47: share buy-backs, deposits, warrants, commercial paper...) and ~74 share-capital-
  // raised movement fields (issues/buy-backs/conversions during the period), none of which are wired
  // into the AI catalogue here. They are genuinely part of the dashboard's field set, but they are not
  // "Balance Sheet" or "P&L" line items — they're separate, much rarer disclosures — and asking the AI
  // about all of them on every extraction would roughly double the catalogue again (190 → ~310 fields),
  // which directly fights the chunking fix above. See the field-catalogue report for the full,
  // documented list and a proposed follow-up to wire them in behind an opt-in toggle.
  add('financialParametersPL.FP_PL_EPS_BASIC', 'Basic earnings per share (Rs)', 'number'); add('financialParametersPL.FP_PL_EPS_DILUTED', 'Diluted earnings per share (Rs)', 'number'); add('financialParametersPL.FP_PL_FOREIGN_INCOME', 'Income in foreign currency (Rs)', 'number'); add('financialParametersPL.FP_PL_FOREIGN_EXPENDITURE', 'Expenditure in foreign currency (Rs)', 'number');
  add('costRecords.MAINTENANCE_MANDATED', 'Whether maintenance of cost records is mandated', 'select', YESNO); add('costRecords.AUDIT_MANDATED', 'Whether cost audit is mandated', 'select', YESNO);
  add('principalProducts.TOTAL_CATEGORIES', 'Number of product / service categories', 'number'); add('principalProducts.CATEGORY_CODE', 'NPCS/ITC 4-digit product or service category code', 'text'); add('principalProducts.CATEGORY_DESC', 'Product or service category description', 'text'); add('principalProducts.CATEGORY_TURNOVER', 'Turnover of that category (Rs)', 'number');
  add('principalProducts.HIGHEST_CODE', 'NPCS/ITC 8-digit code of the highest-turnover product/service', 'text'); add('principalProducts.HIGHEST_DESC', 'Description of the highest-turnover product/service', 'text'); add('principalProducts.HIGHEST_TURNOVER', 'Turnover of the highest-turnover product/service (Rs)', 'number');
  add('relatedParty.ANY_TRANSACTION', 'Whether any related-party transactions were entered', 'select', YESNO);
  add('auditorReport.CAG_COMMENTED', 'Whether CAG commented (government company)', 'select', ['Not applicable', 'Yes', 'No']);
  add('csr.CSR_APPLICABILITY', 'CSR applicability', 'select', ['Not applicable', 'Section 135', 'Report for unspent CSR amount']);
  add('secretarialAudit.SECRETARIAL_AUDIT_APPLICABLE', 'Whether secretarial audit applies', 'select', YESNO);
  return cat;
}
let catalogIndex = null;
function catalogEntry(path) {
  if (!catalogIndex) catalogIndex = new Map(aiCatalog().map(c => [c.path, c]));
  if (path === 'signatoriesFS') return { path, label: 'Signatories of the financial statements', type: 'signatories' };
  if (path === 'signatoriesBR') return { path, label: "Signatories of the board's report", type: 'signatories' };
  const direct = catalogIndex.get(path);
  if (direct) return direct;
  // balanceSheet.KEY and profitLoss.KEY carry the period BEFORE the key (balanceSheet.current.PPE).
  const m1 = /^(balanceSheet|profitLoss)\.(current|previous)\.(.+)$/.exec(path);
  if (m1) { const base = catalogIndex.get(`${m1[1]}.${m1[3]}`); if (base) return { ...base, path, label: base.label.replace(/ \(give period_end.*\)$/, '') + (m1[2] === 'current' ? ' · current year' : ' · previous year') }; }
  // balanceSheetBreakup/profitLossDetails/foreignExchange carry the period AFTER the key (the exact
  // opposite nesting — this reuses the dashboard's existing state shape, not a new convention).
  const m2 = /^(balanceSheetBreakup|profitLossDetails|foreignExchange)\.(.+)\.(current|previous)$/.exec(path);
  if (m2) { const base = catalogIndex.get(`${m2[1]}.${m2[2]}`); if (base) return { ...base, path, label: base.label.replace(/ \(give period_end.*\)$/, '') + (m2[3] === 'current' ? ' · current year' : ' · previous year') }; }
  return { path, label: path, type: typeof getPath(state, path) === 'number' ? 'number' : 'text' };
}

function setStep(n) { $$('#docSteps .step').forEach(s => { const k = +s.dataset.step; s.classList.toggle('on', k === n); s.classList.toggle('done', k < n); }); }
function fileKind(name) { const ext = (name.split('.').pop() || '').toLowerCase(); return ['xlsx', 'xls', 'xlsm', 'csv'].includes(ext) ? 'sheet' : ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : ['png', 'jpg', 'jpeg'].includes(ext) ? 'image' : ext === 'json' ? 'json' : 'text'; }

function classifyDoc(doc) {
  if (doc.status === 'error') return 'unreadable';
  if (doc.clientJson) return 'client-json';
  if (doc.kind === 'image') return 'image';
  const t = (doc.text || '').slice(0, 30000);
  if (AOC4Extract.isFormText(t)) return 'aoc4-form';
  const bs = /balance sheet/i.test(t), pl = /statement of profit and loss|profit and loss|profit & loss/i.test(t);
  if (bs && pl) return 'financials';
  if (bs) return 'balance-sheet';
  if (pl) return 'profit-loss';
  if (/independent auditor'?s report|auditor'?s report/i.test(t)) return 'auditor-report';
  if (/board'?s report|directors'? report/i.test(t)) return 'board-report';
  if (doc.kind === 'sheet' || /trial balance/i.test(t)) return 'workbook';
  return 'text';
}

/** File → document the extractor understands (text, sheets, positioned PDF lines, bytes for the model). */
async function ingestFile(file) {
  const kind = fileKind(file.name);
  const doc = { name: file.name, size: file.size, kind: kind === 'docx' || kind === 'json' ? 'text' : kind, mime: file.type || '', text: '', pages: [], sheets: [], status: 'ok' };
  try {
    if (kind === 'sheet') {
      await loadScript(LIBS.xlsx);
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, sheetRows: 600 });
      // Cap the range BEFORE conversion, not with .slice() after: a real-world export's "used range"
      // routinely extends to tens of thousands of rows/hundreds of columns from leftover formatting
      // alone (no real data past the first few hundred rows) — converting all of that to JS objects
      // just to immediately discard most of it is where a lot of the upload-to-extract time went.
      // `sheetRows` above already caps XLSX's own parse; capping `range` too keeps sheet_to_json itself
      // from walking a huge formatted-but-empty column span.
      doc.sheets = wb.SheetNames.map(name => {
        const ws = wb.Sheets[name];
        if (!ws['!ref']) return { name, rows: [] };
        const range = XLSX.utils.decode_range(ws['!ref']);
        range.e.r = Math.min(range.e.r, range.s.r + 599);
        range.e.c = Math.min(range.e.c, range.s.c + 60);
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', range });
        return { name, rows };
      });
      doc.text = doc.sheets.map(s => `## Sheet: ${s.name}\n` + s.rows.slice(0, 250).filter(r => r.some(c => c !== '')).map(r => r.map(c => c instanceof Date ? AOC4Extract.parsePeriod(c) : c).join('\t')).join('\n')).join('\n\n');
    } else if (kind === 'pdf') {
      if (!window.pdfjsLib) throw new Error('pdf.js is missing from libs/ (see README)');
      doc.bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data: doc.bytes.slice() }).promise;
      doc.pageCount = pdf.numPages;
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p); const tc = await page.getTextContent();
        doc.pages.push({ n: p, lines: AOC4Extract.linesFromItems(tc.items) });
      }
      doc.text = doc.pages.map(pg => `--- page ${pg.n} ---\n` + pg.lines.map(l => l.text).join('\n')).join('\n');
      doc.scanned = AOC4Extract.isLikelyScanned(doc.text, pdf.numPages);   // no text layer: only the model (vision) can read it
    } else if (kind === 'docx') {
      await loadScript(LIBS.jszip);
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const xml = await zip.file('word/document.xml').async('string');
      doc.text = xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    } else if (kind === 'image') {
      doc.bytes = new Uint8Array(await file.arrayBuffer());
    } else {
      doc.text = await file.text();
      if (kind === 'json') { try { const j = JSON.parse(doc.text); if (j && j.general && j.general.CIN) doc.clientJson = j; } catch (_) { /* plain text */ } }
    }
  } catch (e) { doc.status = 'error'; doc.error = e.message; }
  doc.type = classifyDoc(doc);
  if (doc.status === 'ok' && doc.kind !== 'image' && !doc.clientJson) {
    try { doc.analysis = AOC4Extract.analyzeDocument(doc); } catch (e) { doc.analysisError = e.message; }
  }
  return doc;
}

function bindUpload() {
  const zone = $('#dropZone'), input = $('#fileInput');
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); addFiles(e.dataTransfer.files); });
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  $('#reqList').innerHTML = FORM_DEFS.aoc4.requirements.map(r => `<li><span class="tag ${r.tag}">${r.tag}</span><span>${esc(r.text)}</span></li>`).join('');
  $('#extractBtn').addEventListener('click', runExtraction);
  $('#aiSelectAll').addEventListener('click', () => $$('#aiDiffTable tr:not(.hidden) input[type=checkbox]').forEach(c => c.checked = true));
  $('#aiSelectNone').addEventListener('click', () => $$('#aiDiffTable input[type=checkbox]').forEach(c => c.checked = false));
  $('#aiSelectHigh').addEventListener('click', () => $$('#aiDiffTable input[type=checkbox]').forEach(c => { const p = proposals[+c.dataset.i]; c.checked = !!p && p.confidence >= 0.8 && !p.conflict; }));
  $$('#proposalFilter button').forEach(b => b.addEventListener('click', () => { proposalFilterMode = b.dataset.f; $$('#proposalFilter button').forEach(x => x.classList.toggle('on', x === b)); applyProposalFilter(); }));
  $('#aiApply').addEventListener('click', applyProposals);
  bindWorkspaceOnce();
  updateExtractBtn();
}

async function addFiles(files) {
  for (const f of files) {
    if (f.size > 25 * 1024 * 1024) { toast(`Too large: ${f.name} (25 MB limit)`, true); continue; }
    if (uploadedFiles.some(u => u.name === f.name && u.size === f.size)) { toast(`${f.name} is already in the list`); continue; }
    uploadedFiles.push(f); docs.push(null);
    renderFiles(); render();
    const i = uploadedFiles.indexOf(f);
    docs[i] = await ingestFile(f);
    renderFiles(); updateExtractBtn();
  }
}

function docSummary(doc) {
  if (!doc) return 'Reading…';
  if (doc.status === 'error') return doc.error;
  const a = doc.analysis;
  const bits = [];
  if (doc.pageCount) bits.push(`${doc.pageCount} page${doc.pageCount > 1 ? 's' : ''}`);
  if (doc.sheets.length) bits.push(`${doc.sheets.length} sheet${doc.sheets.length > 1 ? 's' : ''}`);
  if (doc.scanned) bits.push('scanned — needs the AI model (Claude) to read');
  if (a) {
    const fyEnd = a.fyEnd || (a.form && a.form.formFyTo ? toISO(a.form.formFyTo) : null);
    if (fyEnd) bits.push(`FY ${AOC4Extract.fyFromEnd(fyEnd)}`);
    const n = a.lines.filter(l => !l.check).length; if (n) bits.push(`${n} statement figures`);
    if (a.signatories.length) bits.push(`${a.signatories.length} signatories`);
    if (a.facts.length) bits.push(`${a.facts.length} details`);
  }
  if (doc.clientJson) bits.push('a client file prepared earlier');
  return bits.join(' · ');
}
function renderFiles() {
  $('#fileList').innerHTML = uploadedFiles.map((f, i) => {
    const d = docs[i];
    const kind = d ? (TYPE_LABEL[d.type] || d.type) : '';
    return `<div class="file"><span class="fname"><svg class="ico" viewBox="0 0 24 24" style="vertical-align:-2px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${esc(f.name)} <span class="muted">${(f.size / 1024).toFixed(0)} KB</span>${d ? `<span class="kind ${d.status === 'error' ? 'err' : ''}">${esc(kind)}</span>` : '<span class="spin"></span>'}</span><span class="meta">${esc(docSummary(d))}</span><span class="btn-row">${d && d.clientJson ? `<button class="btn sm" data-load-json="${i}">Load as client</button>` : ''}<button class="btn sm" data-rm-file="${i}">Remove</button></span></div>`;
  }).join('');
  $$('#fileList [data-rm-file]').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.rmFile; uploadedFiles.splice(i, 1); docs.splice(i, 1); renderFiles(); updateExtractBtn(); render(); }));
  $$('#fileList [data-load-json]').forEach(b => b.addEventListener('click', () => { const d = docs[+b.dataset.loadJson]; loadClientJson(d.clientJson, 'manual'); render(true); toast(`Loaded ${d.name} into the form`); showPanel('data'); }));
}
function updateExtractBtn() {
  const ready = docs.filter(d => d && d.status === 'ok' && !d.clientJson);
  const onlyImages = ready.length && ready.every(d => d.kind === 'image');
  const aiReady = aiKeyPresent();
  $('#extractBtn').disabled = !ready.length || (onlyImages && !aiReady);
  const useAi = $('#useAi');
  useAi.disabled = !aiReady;
  if (!aiReady) useAi.checked = false; else if (!useAi.dataset.touched) useAi.checked = true;
  useAi.onchange = () => { useAi.dataset.touched = '1'; };
  const provider = { anthropic: 'Claude (claude-opus-5-5)', openai: 'OpenAI', gemini: 'Gemini', gateway: 'Claude via Germin8 Gateway' }[settings.llmProvider] || settings.llmProvider;
  $('#aiProviderTag').textContent = aiReady ? `AI: ${provider} · ${settings.llmProvider === 'gateway' ? 'token' : 'key'} saved` : 'Rules only — add an AI API key (or the Gateway token) in Settings to also ask the model';
}

/* ---- running the extraction ---- */
async function runExtraction() {
  const ready = docs.filter(d => d && d.status === 'ok' && !d.clientJson);
  if (!ready.length) return;
  const btn = $('#extractBtn'); btn.disabled = true; setStep(2);
  $('#reviewBlock').classList.add('hidden'); $('#applyResult').innerHTML = ''; $('#docNotes').innerHTML = '';
  const status = html => { $('#extractStatus').innerHTML = html; };
  try {
    status('<span class="spin"></span> Reading the documents…');
    const analyses = ready.filter(d => d.analysis).map(d => d.analysis);
    const rules = AOC4Extract.buildProposals(analyses, state.meta.fy || null, { proposeFy: !state.meta.fy });
    const fy = rules.fy || state.meta.fy || null;
    let aiOut = null, aiError = null, aiNorm = { proposals: [], signatoriesFS: [], signatoriesBR: [], notes: [], unmappedPeriods: [] };
    if ($('#useAi').checked && aiKeyPresent()) {
      status(`<span class="spin"></span> Asking ${settings.llmProvider === 'anthropic' || settings.llmProvider === 'gateway' ? 'Claude' : settings.llmProvider}… ${settings.llmProvider === 'gateway' ? 'the Gateway answers in several small steps, this can take a few minutes' : 'this can take a minute for long statements'}`);
      try { aiOut = await extractWithModel(ready, fy); aiNorm = AOC4Extract.normalizeAiOutput(aiOut, aiCatalog(), fy); }
      catch (e) { aiError = e.message; }
    }
    const merged = AOC4Extract.mergeProposals(rules.proposals, aiNorm.proposals);
    proposals = merged.map(p => { const c = catalogEntry(p.path); return { ...p, label: c.label, type: c.type, options: c.options, current: getPath(state, p.path) }; })
      .filter(p => p.type !== 'number' || typeof p.value === 'number')
      .sort((a, b) => sectionRank(a.path) - sectionRank(b.path) || a.label.localeCompare(b.label));
    proposalSigs = { FS: rules.signatoriesFS.length ? rules.signatoriesFS : aiNorm.signatoriesFS, BR: aiNorm.signatoriesBR };
    if (proposalSigs.FS.length) proposals.push({ path: 'signatoriesFS', label: rules.signatoriesCarried ? "Signatories (last year's — confirm and add this year's signing dates)" : 'Signatories of the financial statements', type: 'signatories', value: proposalSigs.FS.map(s => ({ din: s.din, name: s.name, designation: s.designation, date: s.date })), current: state.signatoriesFS, confidence: rules.signatoriesCarried ? 0.5 : rules.signatoriesFS.length ? 0.85 : 0.7, sources: rules.signatoriesFS.length ? ['rules'] : ['ai'], evidence: { file: proposalSigs.FS[0].file || '', where: '', quote: proposalSigs.FS.map(s => `${s.name} (DIN ${s.din})`).join(', ') } });
    lastExtraction = { rules, aiNorm, aiError, aiOut, files: ready.map(d => d.name) };
    runReconciliationWorkspace(analyses, fy);
    renderProposals();
    setStep(3);
    status(proposals.length ? 'Review the values below, then apply the ones you accept.' : 'Nothing usable was found in these documents.');
    if (!proposals.length) setStep(1);
  } catch (e) {
    status(`<span style="color:var(--err)">${esc(e.message)}</span>`); setStep(1);
  } finally { updateExtractBtn(); }
}
const sectionRank = path => { const i = SECTION_ORDER.indexOf(path.split('.')[0]); return i < 0 ? 99 : i; };

function renderProposals() {
  const { rules, aiNorm, aiError, files } = lastExtraction;
  const agree = proposals.filter(p => p.sources && p.sources.length === 2).length;
  const conflicts = proposals.filter(p => p.conflict).length;
  const changes = proposals.filter(p => !sameAsCurrent(p)).length;
  const chips = [`<span class="chip"><strong>${proposals.length}</strong> values from ${files.length} file${files.length > 1 ? 's' : ''}</span>`, `<span class="chip"><strong>${changes}</strong> differ from the form</span>`];
  if (aiNorm.proposals.length) chips.push(`<span class="chip"><strong>${agree}</strong> confirmed by both the documents and the AI</span>`);
  if (conflicts) chips.push(`<span class="chip" style="color:var(--warn)"><strong>${conflicts}</strong> conflict${conflicts > 1 ? 's' : ''} to decide</span>`);
  if (rules.fyInferred) chips.push(`<span class="chip">Financial year taken from the documents: <strong>${esc(rules.fy)}</strong></span>`);
  $('#proposalChips').innerHTML = chips.join('');
  $('#aiDiffTitle').textContent = `${proposals.length} proposed value${proposals.length === 1 ? '' : 's'}`;
  const notes = [];
  const unmapped = [...new Set([...(rules.unmappedPeriods || []), ...(aiNorm.unmappedPeriods || [])])].filter(p => p && p !== '?');
  if (unmapped.length) notes.push(`<div class="note warn">Figures dated ${unmapped.map(p => fromISO(p) || p).join(', ')} were ignored because they belong to neither year of FY ${esc(rules.fy || '?')}. Change the financial year in Data Entry if that is wrong.</div>`);
  if (aiError) notes.push(`<div class="note err">AI step failed: ${esc(aiError)}. The values below come from the document rules only.</div>`);
  if (rules.notes && rules.notes.length) notes.push(...rules.notes.map(n => `<div class="note warn">${esc(n)}</div>`));
  if (aiNorm.notes.length) notes.push(`<div class="note">Model notes: ${aiNorm.notes.map(esc).join(' · ')}</div>`);
  const scanned = docs.filter(d => d && d.scanned).map(d => d.name);
  if (scanned.length && !((settings.llmProvider === 'anthropic' || settings.llmProvider === 'gateway') && aiKeyPresent() && $('#useAi').checked)) notes.push(`<div class="note warn">${scanned.map(esc).join(', ')} ${scanned.length > 1 ? 'have' : 'has'} no text layer (scanned). Only Claude can read it — save an Anthropic key (or the Gateway token) in Settings and tick "Also ask the AI model".</div>`);
  $('#docNotes').innerHTML = notes.join('');

  const fmtVal = p => p.type === 'number' ? fmtINR(p.value) : p.type === 'signatories' ? sigsHtml(p.value) : esc(String(p.value ?? ''));
  const fmtCur = p => { const v = p.current; if (p.type === 'signatories') return sigsHtml(v || []); if (v === undefined || v === null || v === '') return '<span class="muted">empty</span>'; return p.type === 'number' ? fmtINR(num(v)) : esc(String(v)); };
  const editor = (p, i) => {
    if (p.type === 'signatories') return fmtVal(p);
    if (p.type === 'select' && p.options) return `<select class="sel" data-edit="${i}">${p.options.map(o => `<option ${o === p.value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    if (p.type === 'number') return `<input class="in num" data-edit="${i}" value="${esc(String(p.value))}">`;
    return `<input class="in" data-edit="${i}" value="${esc(String(p.value))}">`;
  };
  const srcHtml = p => {
    const both = p.sources && p.sources.length === 2;
    const label = both ? 'Document + AI' : (p.sources || ['rules'])[0] === 'ai' ? 'AI' : 'Document';
    const cls = p.confidence >= 0.8 ? '' : p.confidence >= 0.6 ? 'mid' : 'low';
    return `<span class="src"><span class="badge ${both || label === 'Document' ? 'doc' : 'ai'}">${label}</span><span class="conf ${cls}" title="confidence ${Math.round(p.confidence * 100)}%"><i style="width:${Math.round(p.confidence * 100)}%"></i></span></span>`;
  };
  const evHtml = p => {
    const e = p.evidence || {};
    const parts = [];
    if (e.file) parts.push(`<b>${esc(e.file)}</b>`); if (e.where) parts.push(esc(e.where)); if (e.quote) parts.push(`“${esc(e.quote)}”`);
    if (p.aiEvidence && p.aiEvidence.quote) parts.push(`<span class="muted">AI: ${esc(p.aiEvidence.quote)}</span>`);
    if (p.period) parts.push(`<span class="muted">as at ${esc(fromISO(p.period) || p.period)}</span>`);
    return `<div class="ev">${parts.join(' · ')}</div>`;
  };
  const altHtml = (p, i) => p.conflict ? `<div class="alt">${p.conflict.method === 'ai' ? 'The AI read' : 'The document shows'} <strong>${p.type === 'number' ? fmtINR(num(p.conflict.value)) : esc(String(p.conflict.value))}</strong><button class="btn sm" data-swap="${i}">use that</button></div>` : '';

  let html = '<thead><tr><th style="width:28px"></th><th>Field</th><th>From the documents</th><th>In the form now</th><th>Source</th><th>Where it was read</th></tr></thead><tbody>';
  let section = null;
  proposals.forEach((p, i) => {
    const sec = p.path.split('.')[0];
    if (sec !== section) { section = sec; html += `<tr class="group"><td colspan="6">${esc(SECTION_TITLES[sec] || sec)}</td></tr>`; }
    const same = sameAsCurrent(p);
    html += `<tr data-row="${i}" class="${p.conflict ? 'conflict' : ''}" data-same="${same ? 1 : 0}" data-conflict="${p.conflict ? 1 : 0}" data-low="${p.confidence < 0.6 ? 1 : 0}"><td><input type="checkbox" data-i="${i}" ${same || p.confidence < 0.5 ? '' : 'checked'}></td><td class="lbl">${esc(p.label)}<small>${esc(p.path)}</small></td><td>${editor(p, i)}${altHtml(p, i)}</td><td class="muted">${fmtCur(p)}${same ? ' <span class="same">(same)</span>' : ''}</td><td>${srcHtml(p)}</td><td>${evHtml(p)}</td></tr>`;
  });
  html += '</tbody>';
  $('#aiDiffTable').innerHTML = html;
  $$('#aiDiffTable [data-swap]').forEach(b => b.addEventListener('click', () => { const p = proposals[+b.dataset.swap]; const prev = { value: p.value, method: p.sources[0], evidence: p.evidence }; p.value = p.conflict.value; p.evidence = p.conflict.evidence; p.sources = [p.conflict.method]; p.conflict = prev; renderProposals(); }));
  $$('#aiDiffTable [data-edit]').forEach(el => el.addEventListener('change', () => { const p = proposals[+el.dataset.edit]; p.value = p.type === 'number' ? num(el.value) : el.value; p.edited = true; const cb = $(`#aiDiffTable input[data-i="${el.dataset.edit}"]`); if (cb) cb.checked = true; }));
  $('#reviewBlock').classList.remove('hidden');
  applyProposalFilter();
}
function sigsHtml(rows) { return rows && rows.length ? `<div class="sigs">${rows.map(r => `<div>${esc(r.din)} · ${esc(r.name)} · ${esc(r.designation)}${r.date ? ' · ' + esc(r.date) : ''}</div>`).join('')}</div>` : '<span class="muted">none</span>'; }
function sameAsCurrent(p) {
  if (p.type === 'signatories') return JSON.stringify((p.current || []).map(r => [r.din, r.name])) === JSON.stringify(p.value.map(r => [r.din, r.name]));
  if (p.type === 'number') return num(p.current) === num(p.value);
  return String(p.current ?? '').trim().toLowerCase() === String(p.value ?? '').trim().toLowerCase();
}
function applyProposalFilter() {
  $$('#aiDiffTable tr[data-row]').forEach(tr => {
    const show = proposalFilterMode === 'all' || (proposalFilterMode === 'changes' && tr.dataset.same === '0') || (proposalFilterMode === 'conflicts' && tr.dataset.conflict === '1') || (proposalFilterMode === 'low' && tr.dataset.low === '1');
    tr.classList.toggle('hidden', !show);
  });
  // Hide section headings that have no visible rows.
  $$('#aiDiffTable tr.group').forEach(g => { let n = g.nextElementSibling, any = false; while (n && !n.classList.contains('group')) { if (!n.classList.contains('hidden')) any = true; n = n.nextElementSibling; } g.classList.toggle('hidden', !any); });
}
function applyProposals() {
  let n = 0; const sigRows = [];
  $$('#aiDiffTable input[type=checkbox]:checked').forEach(c => {
    const p = proposals[+c.dataset.i]; if (!p) return;
    if (p.type === 'signatories') { sigRows.push(p); return; }
    if (p.path === 'meta.fy' && !/^\d{4}-\d{2}$/.test(String(p.value))) return;
    const source = p.sources && p.sources.includes('rules') ? 'doc' : 'ai';
    setValue(p.path, p.type === 'number' ? num(p.value) : p.value, source);
    n++;
  });
  for (const p of sigRows) {
    const rows = p.value.map(r => ({ din: String(r.din || ''), name: String(r.name || ''), designation: r.designation || 'Director', date: r.date || '' }));
    state.signatoriesFS = rows;
    rows.forEach((r, i) => { for (const k of ['din', 'name', 'designation', 'date']) if (r[k]) state.sources[`signatoriesFS.${i}.${k}`] = 'doc'; });
    n++;
  }
  afterChange(); render(true);
  const { errors, warnings } = validate();
  setStep(4);
  $('#applyResult').innerHTML = `<div class="note ${errors.length ? 'warn' : 'ok'}"><strong>${n} value${n === 1 ? '' : 's'} applied.</strong> The form now has ${errors.length} error${errors.length === 1 ? '' : 's'} and ${warnings.length} warning${warnings.length === 1 ? '' : 's'}. Derived figures (totals, net worth, EPS, dates) were recalculated. <button class="btn sm primary" data-go="review" style="margin-left:8px">Open Review &amp; Send</button> <button class="btn sm" data-go="data">Check in Data Entry</button></div>`;
  $$('#applyResult [data-go]').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.go)));
  toast(`${n} value${n === 1 ? '' : 's'} applied from the documents`);
  renderProposals();
  if (lastExtraction && !$('#engineWorkspace').classList.contains('hidden')) { refreshComparisonAndRecords(); renderWorkspaceTab(activeWorkspaceTab); }
}

/* ═══════════════════════════════════════════════════════════════════
   Reconciliation workspace (Phases 4-8): Overview / Financial Summary / Data Comparison /
   Validation Centre / Source Evidence / Review & Approval. Everything here reads values the
   extraction pipeline and js/reconciliation.js already computed — nothing here re-derives a figure
   from raw text, and nothing here is part of the AOC-4 filing JSON contract.
   ═══════════════════════════════════════════════════════════════════ */
let activeWorkspaceTab = 'overview';
let workspaceBound = false;

// Numeric BS/P&L/share-capital fields are fully comparable; a short curated list of qualitative
// fields is marked not comparable because no deterministic check can confirm them.
function comparisonFieldList() {
  const fields = [];
  for (const per of ['current', 'previous']) {
    for (const [, k, label] of BS_LIAB) fields.push({ path: `balanceSheet.${per}.${k}`, label: `${label} (${per} year)`, type: 'number' });
    for (const [, k, label] of BS_ASSET) fields.push({ path: `balanceSheet.${per}.${k}`, label: `${label} (${per} year)`, type: 'number' });
    for (const [, k, label] of PL_IN) fields.push({ path: `profitLoss.${per}.${k}`, label: `${label} (${per} year)`, type: 'number' });
  }
  for (const k of ['FACE_VALUE', 'AUTH_SHARES', 'PAID_UP_SHARES', 'AUTH_NOMINAL', 'PAID_UP_NOMINAL']) fields.push({ path: `shareCapital.${k}`, label: `Share capital: ${k.replace(/_/g, ' ').toLowerCase()}`, type: 'number' });
  fields.push({ path: 'general.CIN', label: 'CIN', type: 'text' });
  fields.push({ path: 'general.FY_FROM', label: 'Financial year start', type: 'date' });
  fields.push({ path: 'general.FY_TO', label: 'Financial year end', type: 'date' });
  for (const p of ['general.NATURE_FS', 'general.AGM_HELD', 'industry.SCHEDULE_III', 'industry.CONSOLIDATED_FS', 'csr.CSR_APPLICABILITY']) { const c = catalogEntry(p); fields.push({ path: p, label: c.label, type: 'select', comparable: false }); }
  return fields;
}

function runReconciliationWorkspace(analyses, fy) {
  reconciliation = AOC4Reconcile.reconcile(analyses, fy);
  const fields = comparisonFieldList();
  // Which FY columns ANY uploaded document actually had a figure for, at all.
  const seenColumns = new Set();
  for (const a of analyses) for (const l of a.lines) for (const p of Object.keys(l.values)) { const col = AOC4Extract.columnForPeriod(p, fy); if (col) seenColumns.add(col); }
  notComparablePaths = new Set();
  for (const f of fields) { const m = /\.(current|previous)\./.exec(f.path); if (m && !seenColumns.has(m[1])) notComparablePaths.add(f.path); }
  refreshComparisonAndRecords(fields);
  const docTypesPresent = docs.filter(Boolean).map(d => d.type);
  unifiedIssues = AOC4IssueStore.collectIssues({
    reconciliation,
    extractionDiagnostics: lastExtraction.aiOut && lastExtraction.aiOut.diagnostics,
    unmappedFields: lastExtraction.aiNorm && lastExtraction.aiNorm.unmappedFields,
    auditorCandidates: lastExtraction.rules.auditorCandidates,
    signatoriesFS: proposalSigs.FS, signatoriesBR: proposalSigs.BR,
    hasBoardReportDoc: docTypesPresent.includes('board-report'),
    docTypesPresent
  });
  completeness = AOC4FieldRecords.computeCompletenessMetrics(aiCatalog(), proposals, lastExtraction.aiNorm, lastExtraction.aiOut);
  $('#engineWorkspace').classList.remove('hidden');
  renderWorkspaceTab(activeWorkspaceTab);
}

function refreshComparisonAndRecords(fields = comparisonFieldList()) {
  const proposalByPath = new Map(proposals.map(p => [p.path, p]));
  comparisonRows = AOC4Compare.buildComparisonRows(fields, proposalByPath, path => getPath(state, path), notComparablePaths);
  const statusByPath = new Map(comparisonRows.map(r => [r.path, r.status]));
  fieldRecords = proposals.filter(p => p.type !== 'signatories').map(p => {
    const m = /\.(current|previous)\./.exec(p.path);
    return AOC4FieldRecords.buildFieldRecord(p, { catalogLabel: p.label, financialYear: lastExtraction && lastExtraction.rules.fy, column: m ? m[1] : null, validationStatus: statusByPath.get(p.path) });
  });
}

function bindWorkspaceOnce() {
  if (workspaceBound) return; workspaceBound = true;
  $$('#workspaceTabs button').forEach(b => b.addEventListener('click', () => {
    $$('#workspaceTabs button').forEach(x => x.classList.toggle('active', x === b));
    renderWorkspaceTab(b.dataset.wtab);
  }));
  $$('#comparisonFilter button').forEach(b => b.addEventListener('click', () => { comparisonFilterMode = b.dataset.cf; $$('#comparisonFilter button').forEach(x => x.classList.toggle('on', x === b)); renderDataComparison(); }));
  $('#comparisonSearch').addEventListener('input', renderDataComparison);
  $('#comparisonExport').addEventListener('click', exportComparisonCsv);
  $('#evidenceField').addEventListener('change', renderSourceEvidenceDetail);
  $('#auditExport').addEventListener('click', exportAuditTrail);
}

function renderWorkspaceTab(tab) {
  activeWorkspaceTab = tab;
  $$('.wpanel').forEach(p => p.classList.toggle('active', p.id === `wpanel-${tab}`));
  if (!lastExtraction) return;
  if (tab === 'overview') renderOverview();
  else if (tab === 'financials') renderFinancialSummary();
  else if (tab === 'comparison') renderDataComparison();
  else if (tab === 'validation') renderValidationCentre();
  else if (tab === 'evidence') renderSourceEvidence();
  else if (tab === 'approval') renderReviewApproval();
}

const STATUS_PILL = { MATCHED: 'ok', MATCHED_AFTER_ROUNDING: 'ok', MISMATCH: 'err', MISSING_IN_DASHBOARD: 'warn', MISSING_IN_DOCUMENT: 'warn', NEEDS_REVIEW: 'warn', NOT_COMPARABLE: '', NOT_VERIFIABLE: '' };
const statusPillClass = status => STATUS_PILL[status] ?? '';

/* ---- Overview ---- */
function renderOverview() {
  const { rules, files } = lastExtraction;
  const s = reconciliation.summary;
  const cs = AOC4Compare.summarize(comparisonRows);
  const u = unifiedIssues.summary;
  const tiles = [
    ['Financial year', rules.fy ? `FY ${rules.fy}` : 'Not determined'],
    ['Files analysed', files.length],
    ['Fields proposed', completeness.successfullyExtracted],
    ['Fields expected (catalogue)', completeness.totalExpectedFields],
    ['Missing fields', completeness.missingFields],
    ['Failed fields (AI)', completeness.failedFields],
    ['Needs review', completeness.needsReviewFields],
    ['Source evidence coverage', `${completeness.sourceEvidenceCoveragePct}%`],
    ['Financial discrepancies', (u.FINANCIAL_MISMATCH || 0) + (u.UNIT_CONFLICT || 0)],
    ['Auditor conflicts', u.AUDITOR_CONFLICT || 0],
    ['Matched vs dashboard', cs.MATCHED || 0],
    ['Mismatched vs dashboard', cs.MISMATCH || 0]
  ];
  $('#wpanel-overview').innerHTML = `<dl class="kv-grid">${tiles.map(([k, v]) => `<div class="kv-tile"><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>`).join('')}</dl>` +
    (s.critical ? `<div class="note err mt12">${s.critical} critical issue${s.critical === 1 ? '' : 's'} found in the source documents — check the Validation Centre before relying on these figures.</div>` : `<div class="note ok mt12">No critical arithmetic issues found in the source documents.</div>`);
}

/* ---- Financial Summary: totals computed purely from the extracted figures, not the dashboard ---- */
function renderFinancialSummary() {
  const propVal = path => { const p = proposals.find(x => x.path === path); return p && typeof p.value === 'number' ? p.value : null; };
  const sumKeys = (base, per, keys) => keys.reduce((a, k) => a + (propVal(`${base}.${per}.${k}`) || 0), 0);
  const row = per => {
    const liab = sumKeys('balanceSheet', per, AOC4Reconcile.BS_LIAB_KEYS), asset = sumKeys('balanceSheet', per, AOC4Reconcile.BS_ASSET_KEYS);
    const income = sumKeys('profitLoss', per, AOC4Reconcile.PL_INCOME_KEYS), expense = sumKeys('profitLoss', per, AOC4Reconcile.PL_EXPENSE_KEYS), tax = sumKeys('profitLoss', per, AOC4Reconcile.PL_TAX_KEYS);
    return { liab, asset, income, expense, pbt: income - expense, tax, pat: income - expense - tax };
  };
  const cur = row('current'), prev = row('previous');
  const line = (label, key) => `<tr><td>${esc(label)}</td><td>${fmtINR(cur[key])}</td><td>${fmtINR(prev[key])}</td></tr>`;
  $('#wpanel-financials').innerHTML = `<div class="scroll-x"><table class="tbl compact"><thead><tr><th>Figure (sum of extracted line items)</th><th>Current year</th><th>Previous year</th></tr></thead><tbody>
    ${line('Total equity &amp; liabilities', 'liab')}
    ${line('Total assets', 'asset')}
    ${line('Income (revenue + other income)', 'income')}
    ${line('Expenses', 'expense')}
    ${line('Profit before tax (computed)', 'pbt')}
    ${line('Tax (current + deferred)', 'tax')}
    ${line('Profit after tax (computed)', 'pat')}
  </tbody></table></div><div class="note mt12">These totals are computed by summing the individual figures the engine extracted from the documents — they are not the document's own printed totals, which are cross-checked separately (and flagged on mismatch) in the Validation Centre.</div>`;
}

/* ---- Data Comparison ---- */
function renderDataComparison() {
  const q = ($('#comparisonSearch').value || '').toLowerCase();
  const rows = comparisonRows.filter(r => {
    if (q && !r.label.toLowerCase().includes(q) && !r.path.toLowerCase().includes(q)) return false;
    if (comparisonFilterMode === 'all') return true;
    if (comparisonFilterMode === 'issues') return r.status !== 'MATCHED' && r.status !== 'MATCHED_AFTER_ROUNDING';
    return r.status === comparisonFilterMode;
  });
  const fmt = (r, v) => r.type === 'number' ? fmtINR(num(v)) : esc(String(v ?? '—'));
  let html = '<thead><tr><th>Field</th><th>Dashboard</th><th>Document</th><th>Status</th><th>Confidence</th><th>Detail</th></tr></thead><tbody>';
  for (const r of rows) html += `<tr><td class="lbl">${esc(r.label)}<small>${esc(r.path)}</small></td><td>${fmt(r, r.dashboardValue)}</td><td>${fmt(r, r.extractedValue)}</td><td><span class="pill ${statusPillClass(r.status)}">${esc(r.status.replace(/_/g, ' '))}</span></td><td>${r.confidenceScore != null ? Math.round(r.confidenceScore * 100) + '%' : '—'}</td><td class="muted">${esc(r.detail || '')}</td></tr>`;
  html += '</tbody>';
  $('#comparisonTable').innerHTML = rows.length ? html : '<tbody><tr><td class="muted">No fields match this filter.</td></tr></tbody>';
}
function exportComparisonCsv() {
  const header = ['path', 'label', 'dashboardValue', 'extractedValue', 'status', 'confidence', 'detail'];
  const esc2 = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.join(','), ...comparisonRows.map(r => [r.path, r.label, r.dashboardValue, r.extractedValue, r.status, r.confidenceScore, r.detail].map(esc2).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${clientId()}_comparison.csv`; a.click();
}

/* ---- Validation Centre: driven by js/issue-store.js's unified, deduplicated issue list ---- */
const VALIDATION_CATEGORY = { PERIOD_MISMATCH: 'Financial year issues', JSON_PARSE_ERROR: 'AI response could not be parsed', FIELD_MAPPING_MISSING: 'Missing / unmapped fields', FINANCIAL_MISMATCH: 'Financial discrepancies', AUDITOR_CONFLICT: 'Auditor conflicts', SIGNATORY_MISSING: 'Missing signatories', UNIT_CONFLICT: 'Unit conflicts', SOURCE_PLACEHOLDER: 'Unconfirmed source', MISSING_DOCUMENT: 'Missing documents', EXTRACTION_FAILED: 'Extraction failures' };
const VALIDATION_ORDER = ['FINANCIAL_MISMATCH', 'AUDITOR_CONFLICT', 'UNIT_CONFLICT', 'PERIOD_MISMATCH', 'JSON_PARSE_ERROR', 'EXTRACTION_FAILED', 'FIELD_MAPPING_MISSING', 'SIGNATORY_MISSING', 'SOURCE_PLACEHOLDER', 'MISSING_DOCUMENT'];
const VALIDATION_TAG = { error: 'err', warning: 'warn', info: '' };
function renderValidationCentre() {
  const s = unifiedIssues.summary;
  $('#validationChips').innerHTML = VALIDATION_ORDER.filter(c => s[c]).map(c => `<span class="chip"><strong>${s[c]}</strong> ${esc(VALIDATION_CATEGORY[c])}</span>`).join('') || '<span class="chip"><strong>0</strong> issues</span>';
  if (!unifiedIssues.issues.length) { $('#validationList').innerHTML = '<div class="note ok">No issues found by the deterministic checks.</div>'; return; }
  $('#validationList').innerHTML = VALIDATION_ORDER.filter(c => s[c]).map(cat => {
    const items = unifiedIssues.issues.filter(i => i.category === cat);
    return `<h4 class="mt16">${esc(VALIDATION_CATEGORY[cat])} (${items.length})</h4>` + items.map(iss => `
      <div class="issue-row">
        <span class="pill ${VALIDATION_TAG[iss.severity] || ''}">${esc(cat)}</span>
        <div class="issue-body">
          <h4>${esc(iss.title)}${iss.occurrences > 1 ? ` <span class="muted">(×${iss.occurrences})</span>` : ''}</h4>
          <p>${esc(iss.detail)}</p>
          <p class="muted">${[iss.evidence && iss.evidence.file, iss.financialYear, iss.field].filter(Boolean).map(esc).join(' · ')}</p>
          <p class="muted"><strong>Recommended:</strong> ${esc(iss.recommendedAction)}</p>
          <button class="btn sm mt8" data-explain='${esc(JSON.stringify({ category: iss.category, code: cat, title: iss.title, detail: iss.detail, file: iss.evidence && iss.evidence.file, period: iss.financialYear }))}'>Ask AI to explain</button>
          <div class="issue-ai hidden"></div>
        </div>
      </div>`).join('');
  }).join('');
  $$('#validationList [data-explain]').forEach(b => b.addEventListener('click', () => explainIssueClick(b)));
}

/* ---- Source Evidence ---- */
function renderSourceEvidence() {
  const sel = $('#evidenceField');
  sel.innerHTML = fieldRecords.map((r, i) => `<option value="${i}">${esc(r.path)}</option>`).join('');
  renderSourceEvidenceDetail();
}
function renderSourceEvidenceDetail() {
  const i = +($('#evidenceField').value || 0);
  const r = fieldRecords[i];
  if (!r) { $('#evidenceDetail').innerHTML = '<div class="note">No extracted fields yet.</div>'; return; }
  $('#evidenceDetail').innerHTML = `<dl class="kv">
    <div><dt>Value</dt><dd>${esc(String(r.value))}</dd></div>
    <div><dt>Original (as printed)</dt><dd>${esc(String(r.originalValue))}</dd></div>
    <div><dt>Normalized value</dt><dd>${esc(String(r.normalizedValue))}</dd></div>
    <div><dt>Source file</dt><dd>${esc(r.sourceFile || '—')}</dd></div>
    <div><dt>Sheet / page</dt><dd>${esc(r.sourceSheetOrPage || '—')}</dd></div>
    <div><dt>Cell / location</dt><dd>${esc(r.sourceCellOrLocation || '—')}</dd></div>
    <div><dt>Financial year</dt><dd>${esc(r.financialYear || '—')}</dd></div>
    <div><dt>Confidence</dt><dd>${Math.round(r.confidenceScore * 100)}%</dd></div>
    <div><dt>Extraction method</dt><dd>${esc(r.extractionMethod)}</dd></div>
    <div><dt>Validation status</dt><dd><span class="pill ${statusPillClass(r.validationStatus)}">${esc(r.validationStatus)}</span></dd></div>
  </dl><div class="note mt12">${esc(r.mappingExplanation)}</div>`;
}

/* ---- Review & Approval: accept/reject/edit/mark-reviewed/note/re-validate, with an audit trail ---- */
function renderReviewApproval() {
  const cid = clientId();
  const counts = { pending: 0, accepted: 0, rejected: 0, edited: 0, reviewed: 0 };
  for (const r of fieldRecords) { const rec = reviewStore.getRecord(cid, r.path); counts[rec.status] = (counts[rec.status] || 0) + 1; }
  $('#approvalChips').innerHTML = Object.entries(counts).map(([k, v]) => `<span class="chip"><strong>${v}</strong> ${esc(k)}</span>`).join('');
  const rows = fieldRecords.filter(r => r.reviewRequired);
  let html = '<thead><tr><th>Field</th><th>Value</th><th>Status</th><th>Review</th><th>Actions</th><th>Note</th></tr></thead><tbody>';
  for (const r of rows) {
    const rec = reviewStore.getRecord(cid, r.path);
    html += `<tr><td class="lbl">${esc(r.path)}</td><td>${esc(String(r.value))}</td><td><span class="pill ${statusPillClass(r.validationStatus)}">${esc(r.validationStatus)}</span></td><td><span class="pill">${esc(rec.status)}</span></td>
      <td class="btn-row">
        <button class="btn sm" data-review="accept" data-path="${esc(r.path)}">Accept</button>
        <button class="btn sm" data-review="reject" data-path="${esc(r.path)}">Reject</button>
        <button class="btn sm" data-review="mark-reviewed" data-path="${esc(r.path)}">Mark reviewed</button>
        <button class="btn sm" data-review="re-validate" data-path="${esc(r.path)}">Re-validate</button>
      </td>
      <td><input class="in sm" data-note="${esc(r.path)}" placeholder="Add a note…" value="${esc(rec.note || '')}"></td>
    </tr>`;
  }
  html += '</tbody>';
  $('#approvalTable').innerHTML = rows.length ? html : '<tbody><tr><td class="muted">Nothing needs review right now.</td></tr></tbody>';
  $$('#approvalTable [data-review]').forEach(b => b.addEventListener('click', () => {
    const path = b.dataset.path, action = b.dataset.review;
    const rec = reviewStore.getRecord(cid, path);
    const fr = fieldRecords.find(r => r.path === path);
    reviewStore.apply(cid, path, action, { by: ($('#reviewer') && $('#reviewer').value) || 'Reviewer', value: fr && fr.value, prevValue: rec.value });
    renderReviewApproval();
  }));
  $$('#approvalTable [data-note]').forEach(inp => inp.addEventListener('change', () => {
    reviewStore.apply(cid, inp.dataset.note, 'note', { by: ($('#reviewer') && $('#reviewer').value) || 'Reviewer', note: inp.value });
    renderAuditTable();
  }));
  renderAuditTable();
}
function renderAuditTable() {
  const trail = reviewStore.getAuditTrail(clientId());
  let html = '<thead><tr><th>When</th><th>Field</th><th>Action</th><th>From → To</th><th>By</th><th>Note</th></tr></thead><tbody>';
  for (const e of [...trail].reverse()) html += `<tr><td class="muted">${esc(new Date(e.at).toLocaleString('en-IN'))}</td><td>${esc(e.path)}</td><td>${esc(e.action)}</td><td>${esc(String(e.prevStatus))} → ${esc(String(e.newStatus))}</td><td>${esc(e.by)}</td><td class="muted">${esc(e.note || '')}</td></tr>`;
  html += '</tbody>';
  $('#auditTable').innerHTML = trail.length ? html : '<tbody><tr><td class="muted">No review actions yet.</td></tr></tbody>';
}
function exportAuditTrail() {
  const blob = new Blob([reviewStore.exportAudit(clientId())], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${clientId()}_review_audit.json`; a.click();
}

/* ---- Phase 8: AI review assistant. It is given ONE already-computed finding and nothing else — no
   raw documents, no instruction to produce a value — so it can only explain, never invent. ---- */
function explainerSystemPrompt() {
  return [
    'You are helping a chartered accountant review AOC-4 reconciliation findings for an Indian company filing.',
    'You are given ONE finding already computed by deterministic rule-based code (an arithmetic check, a cross-reference between two figures, or a financial-year mismatch) and nothing else — you cannot see the source documents.',
    'Explain in plain English, in 2-4 short sentences: (1) what the finding means in plain accounting terms, (2) the most likely real-world cause(s) in an Indian Schedule III / AOC-4 filing, and (3) what the reviewer should check or ask the client for next.',
    'Hard rules: use ONLY the numbers and text given to you below — never state, estimate, correct, or imply any value, total or figure that is not already present in the finding. Never state or imply that the filing is compliant, correct, or ready to submit — that is the reviewer\'s judgement, not yours. If the finding does not give you enough to go on, say so plainly instead of guessing.'
  ].join('\n');
}
async function askModelText(system, user) {
  const { llmProvider: provider, llmKey: apiKey, gatewayUrl, gatewayToken } = settings;
  if (provider === 'anthropic') {
    const resp = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 700, system, messages: [{ role: 'user', content: user }] }) });
    if (!resp.ok) throw new Error(`Claude API ${resp.status}: ${cleanErrorBody(await resp.text(), resp.status)}`);
    const msg = await resp.json();
    if (msg.stop_reason === 'refusal') throw new Error('Claude declined to answer this.');
    return (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  }
  if (provider === 'gateway') {
    const url = sanitizeUrl(gatewayUrl);
    if (!url) throw new Error('No Gateway URL saved in Settings → AI extraction.');
    if (!gatewayToken) throw new Error('No Gateway Token saved in Settings → AI extraction.');
    const resp = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, token: gatewayToken, body: { route: 'claude', system, messages: [{ role: 'user', content: user }], max_tokens: 700 } }) });
    if (!resp.ok) throw new Error(`Gateway error ${resp.status}: ${cleanErrorBody(await resp.text(), resp.status)}`);
    const msg = await resp.json();
    if (msg.stop_reason === 'refusal') throw new Error('Claude declined to answer this.');
    return (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
  }
  if (provider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: 'gpt-4o', max_tokens: 700, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
    if (!resp.ok) throw new Error(`OpenAI API ${resp.status}: ${cleanErrorBody(await resp.text(), resp.status)}`);
    return (((await resp.json()).choices || [])[0]?.message?.content || '').trim();
  }
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { maxOutputTokens: 700 } }) });
  if (!resp.ok) throw new Error(`Gemini API ${resp.status}: ${cleanErrorBody(await resp.text(), resp.status)}`);
  return (((await resp.json()).candidates || [])[0]?.content?.parts?.[0]?.text || '').trim();
}
async function explainIssueClick(button) {
  const iss = JSON.parse(button.dataset.explain);
  const out = button.nextElementSibling;
  out.classList.remove('hidden');
  if (!aiKeyPresent()) { out.innerHTML = '<div class="note warn">Add an AI key or Gateway token in Settings to use the explain assistant.</div>'; return; }
  out.innerHTML = '<span class="spin"></span> Asking the AI model to explain this finding…';
  button.disabled = true;
  try {
    const user = `Finding (category: ${iss.category}, code: ${iss.code}):\nTitle: ${iss.title}\nDetail: ${iss.detail}\nFile: ${iss.file || 'n/a'}\nPeriod: ${iss.period || 'n/a'}`;
    const text = await askModelText(explainerSystemPrompt(), user);
    out.innerHTML = `<div class="note">${esc(text)}</div>`;
  } catch (e) {
    out.innerHTML = `<div class="note err">${esc(e.message)}</div>`;
  } finally { button.disabled = false; }
}

/* ---- the model call: Claude reads PDFs/images natively; other providers get the extracted text ---- */
function toBase64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
// A 502/503/504 in front of the Gateway (or any upstream provider) commonly comes back as an HTML
// error page, not JSON — showing that raw markup to a CA-firm user ("<html><head><title>502 Bad
// Gateway</title>...") reads as a crash. This turns it into one plain sentence instead.
function cleanErrorBody(txt, status) {
  const t = String(txt ?? '').trim();
  if (/^<!doctype html|^<html[\s>]/i.test(t)) {
    const title = /<title>([^<]*)<\/title>/i.exec(t);
    return `${title ? title[1].trim() : `HTTP ${status}`} — the server returned an HTML error page instead of a response. This usually means the service is temporarily down or being restarted, not a problem with what you entered. Wait a minute and try again.`;
  }
  return t.slice(0, 300);
}
function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch (_) { /* fall through */ }
  const m = String(text).match(/\{[\s\S]*\}/); if (!m) throw new Error('The model did not return JSON');
  return JSON.parse(m[0]);
}
async function extractWithModel(ready, fy) {
  const { llmProvider: provider, llmKey: apiKey, gatewayUrl, gatewayToken } = settings;
  const catalog = aiCatalog();
  const system = AOC4Extract.extractionSystemPrompt(fy);
  const schema = AOC4Extract.extractionSchema();
  const textDocs = ready.filter(d => d.text).map(d => `=== ${d.name} (${TYPE_LABEL[d.type] || d.type}) ===\n${d.text.slice(0, 150000)}`).join('\n\n');
  const readsPdfNatively = provider === 'anthropic' || provider === 'gateway';
  const context = { financialYear: fy, company: state.meta.companyName, cin: state.general.CIN, attachedInFull: readsPdfNatively ? ready.filter(d => d.bytes).map(d => d.name) : [] };
  const user = AOC4Extract.extractionUserText(catalog, textDocs || '(no text could be extracted; read the attached files)', context);
  if (provider === 'anthropic') return callClaude({ apiKey, system, user, schema, attachments: ready.filter(d => d.bytes) });
  if (provider === 'gateway') return extractWithGatewayChunked({ gatewayUrl, gatewayToken, catalog, system, textDocs: textDocs || '(no text could be extracted; read the attached files)', context, attachments: ready.filter(d => d.bytes) });
  if (provider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: 'gpt-4o', max_tokens: 16000, response_format: { type: 'json_schema', json_schema: { name: 'aoc4_extraction', schema } }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
    if (!resp.ok) throw new Error(`OpenAI API ${resp.status}: ${cleanErrorBody(await resp.text(), resp.status)}`);
    return parseJsonLoose((await resp.json()).choices?.[0]?.message?.content || '');
  }
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { maxOutputTokens: 16384, responseMimeType: 'application/json' } }) });
  if (!resp.ok) throw new Error(`Gemini API ${resp.status}: ${cleanErrorBody(await resp.text(), resp.status)}`);
  return parseJsonLoose((await resp.json()).candidates?.[0]?.content?.parts?.[0]?.text || '');
}
// Shared by the direct Anthropic call and the gateway call: PDFs/images go in natively, the request
// limit is 32 MB (the text of anything dropped is already in the prompt, so nothing is lost).
function buildClaudeContent(user, attachments) {
  const content = [];
  let bytes = 0;
  for (const d of attachments) {
    if (bytes + d.bytes.length > 28 * 1024 * 1024) break;
    bytes += d.bytes.length;
    const data = toBase64(d.bytes);
    if (d.kind === 'pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data }, title: d.name });
    else content.push({ type: 'image', source: { type: 'base64', media_type: d.mime || 'image/png', data } });
  }
  content.push({ type: 'text', text: user });
  return content;
}
async function callClaude({ apiKey, system, user, schema, attachments }) {
  const url = 'https://api.anthropic.com/v1/messages';
  const content = buildClaudeContent(user, attachments);
  const body = { model: 'claude-opus-5-5', max_tokens: 16000, system, messages: [{ role: 'user', content }], output_config: { effort: 'high', format: { type: 'json_schema', schema } }, fallbacks: 'default' };
  const headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  let resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (resp.status === 400) {
    const txt = await resp.text();
    if (!/output_config|format|fallbacks|anthropic-beta|unexpected|unknown/i.test(txt)) throw new Error(`Claude API 400: ${cleanErrorBody(txt, 400)}`);
    // A gateway that does not know structured output / fallbacks: ask plainly and parse the JSON from the text.
    delete body.output_config.format; delete body.fallbacks; delete headers['anthropic-beta'];
    body.system += '\nReturn only one JSON object with the keys fields, signatoriesFS, signatoriesBR and notes, and nothing else.';
    resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  }
  if (!resp.ok) throw new Error(`Claude API ${resp.status}: ${cleanErrorBody(await resp.text(), resp.status)}`);
  const msg = await resp.json();
  if (msg.stop_reason === 'refusal') throw new Error(`Claude declined this request${msg.stop_details && msg.stop_details.explanation ? ': ' + msg.stop_details.explanation : ''}`);
  const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (msg.stop_reason === 'max_tokens') console.warn('Claude output was cut at max_tokens; the JSON may be incomplete');
  return parseJsonLoose(text);
}

/* Generic "ask the configured AI for one JSON object" helper (used by the ADT-1 Upload & AI step, js/adt1-upload.js).
   Same providers, headers and gateway proxy as callClaude / callClaudeViaGateway above, but with a timeout and an
   AbortSignal so the caller can fall back to its own rules instead of waiting. AOC-4 does not use it. */
async function callAiJson({ system, user, schema, attachments = [], maxTokens = 4000, timeoutMs = 30000, signal }) {
  const { llmProvider: provider, llmKey: apiKey, gatewayUrl, gatewayToken } = settings;
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
  if (signal) { if (signal.aborted) ctl.abort(); else signal.addEventListener('abort', () => ctl.abort()); }
  const post = (url, headers, body) => fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctl.signal });
  const textOf = msg => (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  try {
    if (provider === 'anthropic' || provider === 'gateway') {
      const content = buildClaudeContent(user, attachments);
      const viaGateway = provider === 'gateway';
      const gUrl = viaGateway ? sanitizeUrl(gatewayUrl) : '';
      if (viaGateway && !gUrl) throw new Error('No Gateway URL saved in Settings → AI extraction.');
      if (viaGateway && !String(gatewayToken || '').trim()) throw new Error('No Gateway Token saved in Settings → AI extraction.');
      const call = async (withSchema) => {
        const sys = withSchema ? system : `${system}\nReturn only one JSON object that follows the format above, and nothing else.`;
        if (viaGateway) {
          const body = { route: 'claude', system: sys, messages: [{ role: 'user', content }], max_tokens: maxTokens };
          if (withSchema && schema) body.output_config = { format: { type: 'json_schema', schema } };
          return post('/api/gateway', { 'Content-Type': 'application/json' }, { url: gUrl, token: String(gatewayToken).trim(), body });
        }
        const body = { model: 'claude-opus-5-5', max_tokens: maxTokens, system: sys, messages: [{ role: 'user', content }] };
        if (withSchema && schema) body.output_config = { format: { type: 'json_schema', schema } };
        return post('https://api.anthropic.com/v1/messages', { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' }, body);
      };
      let resp = await call(true);
      if (resp.status === 400) {
        const txt = await resp.text();
        if (!/output_config|format|json_schema|unexpected|unknown/i.test(txt)) throw viaGateway ? gatewayHttpError(400, txt, gUrl) : new Error(`Claude API 400: ${cleanErrorBody(txt, 400)}`);
        resp = await call(false);
      }
      if (!resp.ok) { const t = await resp.text(); throw viaGateway ? gatewayHttpError(resp.status, t, gUrl) : new Error(`Claude API ${resp.status}: ${cleanErrorBody(t, resp.status)}`); }
      const msg = await resp.json();
      if (msg.stop_reason === 'refusal') throw new Error('Claude declined this request.');
      if (msg.stop_reason === 'max_tokens') throw new Error('The AI answer was cut off before it finished.');
      return parseJsonLoose(textOf(msg));
    }
    if (provider === 'openai') {
      const resp = await post('https://api.openai.com/v1/chat/completions', { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, { model: 'gpt-4o', max_tokens: maxTokens, response_format: { type: 'json_schema', json_schema: { name: 'extraction', schema } }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
      if (!resp.ok) throw new Error(`OpenAI API ${resp.status}: ${cleanErrorBody(await resp.text(), resp.status)}`);
      return parseJsonLoose((await resp.json()).choices?.[0]?.message?.content || '');
    }
    const resp = await post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(apiKey)}`, { 'Content-Type': 'application/json' }, { system_instruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json' } });
    if (!resp.ok) throw new Error(`Gemini API ${resp.status}: ${cleanErrorBody(await resp.text(), resp.status)}`);
    return parseJsonLoose((await resp.json()).candidates?.[0]?.content?.parts?.[0]?.text || '');
  } catch (e) {
    if (ctl.signal.aborted) throw new Error(timedOut ? `The AI did not answer within ${Math.round(timeoutMs / 1000)} seconds` : 'Cancelled');
    throw e;
  } finally { clearTimeout(timer); }
}

// The gateway caps total output (thinking + text, combined) at ~4096 tokens no matter what
// max_tokens we send — confirmed empirically: raising it to 60,000 made no difference. A single
// call asking for the full field catalog against a real statement reliably exceeds that before
// finishing the JSON, so the model gets cut off mid-answer and the array is left unterminated
// ("Expected ',' or ']' after array element" — that is literally what a JSON.parse of a
// mid-element truncation looks like). Splitting the catalog into small batches keeps each answer
// short enough to finish inside the cap, but a FIXED chunk size isn't enough on its own: some
// batches still overflow depending on how much the model has to say about THAT content (long
// evidence quotes, ambiguous mappings, multiple periods). So every chunk here is retried, and a
// chunk that still fails is halved and retried independently — recursively, down to one field —
// rather than the whole chunk's fields being silently lost. Direct Anthropic/OpenAI/Gemini calls
// have no such limit and stay as one call; this whole path is gateway-only.
const GATEWAY_CHUNK_SIZE = 8;
const GATEWAY_CHUNK_RETRIES = 2; // attempts at the SAME size before shrinking

// The retry/split/dedupe POLICY lives in js/chunk-resilience.js (provider-agnostic, unit-tested with
// a fake flaky caller in test/chunk-resilience.test.js) — this just supplies the actual HTTP call.
async function extractWithGatewayChunked({ gatewayUrl, gatewayToken, catalog, system, textDocs, context, attachments }) {
  const result = await AOC4ChunkResilience.processInChunks({
    items: catalog,
    chunkSize: GATEWAY_CHUNK_SIZE,
    retries: GATEWAY_CHUNK_RETRIES,
    // Only the "first" chunk carries native PDF/image attachments and asks for signatories —
    // resending 28 MB of attachments or the signatory schema on every one of 15-20 small calls would
    // multiply bandwidth/token cost for no benefit; the document TEXT (already in `textDocs`,
    // identical every call) is what each chunk actually matches fields against, and signatories are
    // a once-per-document fact, not a per-field one.
    callChunk: async (fieldsCatalog, { includeExtras }) => {
      const user = AOC4Extract.extractionUserText(fieldsCatalog, textDocs, context);
      const schema = AOC4Extract.extractionSchema({ fieldsOnly: !includeExtras });
      const out = await callClaudeViaGateway({ gatewayUrl, gatewayToken, system, user, attachments: includeExtras ? attachments : [], schema, includeSignatories: includeExtras });
      const { valid, dropped } = AOC4Extract.sanitizeFieldsArray(out.fields);
      const notes = Array.isArray(out.notes) ? [...out.notes] : [];
      if (dropped.length) notes.push(`${dropped.length} malformed field entr${dropped.length === 1 ? 'y' : 'ies'} dropped from an otherwise-valid response (missing path/value) — see Validation Centre → Extraction diagnostics.`);
      return { fields: valid, signatoriesFS: out.signatoriesFS || [], signatoriesBR: out.signatoriesBR || [], notes };
    }
  });
  result.notes = AOC4ChunkResilience.dedupeSimilarNotes(result.notes);
  if (result.diagnostics.length) {
    const failedFieldCount = result.diagnostics.reduce((n, d) => n + d.items.length, 0);
    result.notes.unshift(`${failedFieldCount} field${failedFieldCount === 1 ? '' : 's'} could not be extracted via the AI pass after retrying (parsing/truncation failures) — see Validation Centre → Extraction diagnostics for the raw detail. The document-rules pass and any other successful AI chunks are unaffected.`);
  }
  return result;
}

// Routes the same Claude call through the Germin8 API gateway (a Supabase edge function) instead of
// calling Anthropic directly: the gateway holds the real key server-side, so only its own scoped,
// revocable token ever sits in this page's Settings. See gateway docs: POST
// {route:'claude', messages, system, max_tokens} with `Authorization: Bearer <token>`, response is
// Anthropic's own Messages API shape ({content:[{type:'text', text}], stop_reason, ...}).
//
// Calling the gateway directly from the browser fails with "Failed to fetch": its CORS policy only
// allows https://www.mca.gov.in (it was built for the extension's content script, which runs on
// that origin), so the browser blocks the response before this page ever sees it. This dashboard's
// own server.js proxies the call instead (POST /api/gateway) — same-origin from the browser's side,
// and a server-to-server request on the way out, which CORS never applies to.
async function callClaudeViaGateway({ gatewayUrl, gatewayToken, system, user, attachments, schema, includeSignatories = true }) {
  gatewayUrl = sanitizeUrl(gatewayUrl);
  gatewayToken = String(gatewayToken || '').trim();
  if (!gatewayUrl) throw new Error('No Gateway URL saved in Settings → AI extraction.');
  if (!gatewayToken) throw new Error('No Gateway Token saved in Settings → AI extraction.');
  const content = buildClaudeContent(user, attachments);
  const plainJsonInstruction = `\nReturn only one JSON object with the keys fields${includeSignatories ? ', signatoriesFS, signatoriesBR' : ''} and notes, and nothing else. Keep each field's evidence quote under 10 words — every token here is scarce.`;
  const call = async (sys, withSchema) => {
    const body = { route: 'claude', system: sys, messages: [{ role: 'user', content }], max_tokens: 16000 };
    if (withSchema && schema) body.output_config = { format: { type: 'json_schema', schema } };
    const resp = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: gatewayUrl, token: gatewayToken, body }) });
    return resp;
  };
  // Try schema-constrained structured output first (the gateway may simply forward output_config to
  // Anthropic, same as the direct callClaude() path) — if it 400s specifically because of that extra
  // field, fall back to asking for JSON in plain language, exactly as callClaude() already does for a
  // proxy in front of Anthropic that rejects it.
  let resp = await call(system, true);
  if (resp.status === 400) {
    const txt = await resp.text();
    if (!/output_config|format|json_schema|unexpected|unknown/i.test(txt)) throw gatewayHttpError(resp.status, txt, gatewayUrl);
    resp = await call(`${system}${plainJsonInstruction}`, false);
  }
  if (!resp.ok) throw gatewayHttpError(resp.status, await resp.text(), gatewayUrl);
  const msg = await resp.json();
  if (msg.stop_reason === 'refusal') throw new Error(`Claude declined this request${msg.stop_details && msg.stop_details.explanation ? ': ' + msg.stop_details.explanation : ''}`);
  const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (msg.stop_reason === 'max_tokens') {
    // A guaranteed-incomplete JSON payload: fail loudly and tag it, rather than attempting to parse
    // (and silently truncating the array parsing would always fail anyway) or repairing it.
    const err = new Error('The response was cut off before it finished (hit the token limit) — the JSON is guaranteed incomplete.');
    err.truncated = true; err.rawText = text.slice(0, 4000);
    throw err;
  }
  try {
    return AOC4Extract.extractJsonPayload(text);
  } catch (e) {
    e.rawText = e.rawText || text.slice(0, 4000);
    throw e;
  }
}
function gatewayHttpError(status, txt, gatewayUrl) {
  if (status === 401) return new Error('Gateway token was not accepted — check Settings → AI extraction → Gateway Token.');
  if (status === 503) return new Error(`Gateway: Claude is not yet configured on the server side, or the Gateway is temporarily down. ${cleanErrorBody(txt, status)}`);
  if (status === 502 || status === 504) return new Error(`Gateway is temporarily unavailable (${status}) — this is an upstream server problem, not something to fix in Settings. Wait a minute and try again. ${cleanErrorBody(txt, status)}`);
  if (status === 404) return new Error(`Gateway error 404 at "${gatewayUrl}" — check Settings → AI extraction → Gateway URL is exactly right, no typos/extra characters. Raw: ${cleanErrorBody(txt, status)}`);
  return new Error(`Gateway error ${status}: ${cleanErrorBody(txt, status)}`);
}

/* ═══════════════════════════════════════════════════════════════════
   Review & send
   ═══════════════════════════════════════════════════════════════════ */
let jsonEditing = false;
function renderReview() {
  const { errors, warnings } = validate();

  const cls = errors.length ? 'err' : warnings.length ? 'warn' : 'ok';
  const title = errors.length
    ? `${errors.length} error${errors.length === 1 ? '' : 's'} to fix before sending`
    : warnings.length
      ? `Ready, with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
      : 'Ready to send';
  const sub = errors.length
    ? 'Sending is blocked until every error is cleared. Use Fix to jump straight to the field.'
    : warnings.length
      ? 'These will not block the filing — check them if they matter to this client.'
      : 'All checks passed. The client JSON is ready for the extension.';
  const icon = errors.length
    ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
    : warnings.length
      ? '<svg viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  $('#readiness').innerHTML = `<div class="readiness ${cls}">
      <span class="r-ico">${icon}</span>
      <div class="r-body"><strong>${title}</strong><span>${sub}</span></div>
    </div>`;

  const summary = $('#issueSummary');
  summary.textContent = errors.length || warnings.length
    ? `${errors.length} error${errors.length === 1 ? '' : 's'} · ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
    : 'All checks passed';
  summary.className = 'pill ' + cls;

  const li = (sev, i) => `<li><span class="sev ${sev}"></span><span>${esc(i.msg)}</span><span class="pill">${esc(SECTION_LABELS[sectionOf(i.path)] || 'General')}</span><a href="#" data-focus="${esc(i.path)}">Fix</a></li>`;
  $('#issueList').innerHTML = errors.map(i => li('err', i)).concat(warnings.map(i => li('warn', i))).join('') || '<li><span class="sev" style="background:var(--ok)"></span><span>No issues. The client JSON is ready for the extension.</span></li>';

  const s = summarizeSources();
  $('#sourceChips').innerHTML = [['manual', 'entered by hand'], ['sandbox', 'from MCA (Filesure)'], ['doc', 'read from documents'], ['ai', 'from the AI model'], ['auto', 'derived']].map(([k, label]) => `<span class="chip"><strong>${s[k]}</strong> ${label}</span>`).join('');
  if (!jsonEditing) $('#jsonPreview').textContent = JSON.stringify(buildClientJson(), null, 2);
  const send = $('#sendBtn');
  send.disabled = errors.length > 0;
  send.textContent = errors.length ? 'Sending blocked' : 'Send to extension';
  send.title = errors.length ? 'Clear the errors above first' : '';
}
function bindReview() {
  $('#issueList').addEventListener('click', e => { const a = e.target.closest('a[data-focus]'); if (a) { e.preventDefault(); focusField(a.dataset.focus); } });
  $('#jsonEditToggle').addEventListener('click', () => { jsonEditing = !jsonEditing; $('#jsonEditWrap').classList.toggle('hidden', !jsonEditing); $('#jsonPreview').classList.toggle('hidden', jsonEditing); if (jsonEditing) $('#jsonEditor').value = JSON.stringify(buildClientJson(), null, 2); $('#jsonEditToggle').textContent = jsonEditing ? 'Back to preview' : 'Edit as text'; });
  $('#jsonCancel').addEventListener('click', () => { jsonEditing = false; $('#jsonEditWrap').classList.add('hidden'); $('#jsonPreview').classList.remove('hidden'); $('#jsonEditToggle').textContent = 'Edit as text'; renderReview(); });
  $('#jsonApply').addEventListener('click', () => { try { loadClientJson(JSON.parse($('#jsonEditor').value), 'manual'); jsonEditing = false; $('#jsonEditWrap').classList.add('hidden'); $('#jsonPreview').classList.remove('hidden'); $('#jsonEditToggle').textContent = 'Edit as text'; render(true); toast('JSON applied to the form'); } catch (e) { toast(`Invalid JSON: ${e.message}`, true); } });
  $('#jsonCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(JSON.stringify(buildClientJson(), null, 2)); toast('JSON copied'); } catch (_) { toast('Copy failed — select the text instead', true); } });
  $('#downloadBtn').addEventListener('click', () => downloadClientJson());
  $('#sendBtn').addEventListener('click', async () => {
    const { errors } = validate(); if (errors.length) return toast('Clear the errors first', true);
    const json = buildClientJson();
    const note = html => { $('#sendResult').innerHTML = html; };
    if (!settings.extId) {
      downloadClientJson();
      return note('<div class="note warn">No extension id saved, so the client was downloaded instead. Add the id in <strong>Settings → Chrome extension</strong> to send it directly.</div>');
    }
    note('<div class="note"><span class="spin"></span> Sending to the extension…</div>');
    try {
      // AOC-4 Online: the extension already understands this exact nested shape (legacy format),
      // so the message is unchanged. AOC-4 Offline is a *different* automation target in Germin8
      // (MCA's separate v3offline page) that needs a flat formData object instead — see
      // buildAoc4OfflineFormData().
      const message = aoc4Mode === 'offline'
        ? { action: 'importClient', formType: 'aoc4_offline', formData: buildAoc4OfflineFormData(), clientInfo: aoc4ClientInfo() }
        : { action: 'importClient', client: json };
      const res = await sendToExtension(message);
      autosave();
      note(`<div class="note ok"><strong>${esc(res.name || json.clientId)}</strong> is now in the extension${res.replaced ? ' (it replaced the earlier copy)' : ''}. Open the AOC-4 ${aoc4Mode === 'offline' ? 'Offline' : 'Online'} form on MCA, pick it in the popup and click <strong>Fill</strong>.</div>`);
      toast('Sent to the extension');
    } catch (e) {
      downloadClientJson();
      note(`<div class="note err"><strong>Could not reach the extension:</strong> ${esc(e.message)}<br>The client was downloaded instead — import it in the popup with <strong>Import JSON…</strong>.</div>`);
    }
  });
  $('#draftBtn').addEventListener('click', () => { autosave(); toast('Draft saved in this browser'); });
  $('#downloadExcelBtn').addEventListener('click', () => downloadExcelWithAoc4Sheets());
}

function downloadClientJson() {
  const json = buildClientJson();
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${json.clientId}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  autosave();
  toast(`Downloaded ${json.clientId}.json`);
  return json;
}

// Turns a nested object (buildClientJson()/buildAoc4OfflineFormData()'s shape) into plain
// "Field path | Value" rows for a spreadsheet — generic, so it needs no per-field mapping of its own.
function flattenForSheet(value, path = '') {
  const rows = [];
  (function walk(v, p) {
    if (v === null || v === undefined || typeof v !== 'object' || v instanceof Date) { rows.push([p, v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? '')]); return; }
    const keys = Array.isArray(v) ? v.map((_, i) => i) : Object.keys(v);
    if (!keys.length) { rows.push([p, '']); return; }
    for (const k of keys) walk(v[k], p ? (Array.isArray(v) ? `${p}[${k}]` : `${p}.${k}`) : String(k));
  })(value, path);
  return rows;
}

// A raw field path ("balanceSheet.current.TRADE_PAYABLES_OTHER") is unreadable to anyone but the
// code — this turns the same flattened data into section headings and the plain-English labels
// the aiCatalog()/catalogEntry() already carry for the data-entry form, so the Excel download
// reads like the form itself instead of a dump of internal keys. Sections aiCatalog doesn't cover
// (arrays, the ~120 rarer parameter fields) still get a label, just title-cased from the key.
const EXCEL_SECTION_TITLES = {
  ...SECTION_TITLES,
  signatoriesBR: "Signatories (Board's report)",
  shareholders: 'Shareholders',
  balanceSheetBreakup: 'Balance sheet break-up',
  profitLossDetails: 'Profit and loss — detail',
  foreignExchange: 'Foreign exchange',
  shareCapitalRaised: 'Share capital raised during the year'
};
function prettyPathLabel(path) {
  const last = String(path).split(/[.[\]]/).filter(Boolean).pop() || String(path);
  return last.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}
function readableRowsForSheet(json) {
  const rows = [];
  for (const [section, value] of Object.entries(json)) {
    if (section === '_dashboard') continue; // prepared-by metadata, not a form answer
    rows.push([EXCEL_SECTION_TITLES[section] || prettyPathLabel(section), '']);
    for (const [k, v] of flattenForSheet(value)) {
      const path = k ? `${section}.${k}` : section;
      const entry = catalogEntry(path);
      const label = entry.label && entry.label !== path ? entry.label : prettyPathLabel(k || section);
      rows.push(['    ' + label, v]);
    }
  }
  return rows;
}

// Adds the dashboard's current, reviewed values as two reference sheets ("AOC-4 Online"/"AOC-4
// Offline") onto a copy of the spreadsheet you uploaded in Upload & AI — a fresh download, never
// overwriting the original file on disk. Values only, no live formulas back to your source cells:
// every CA's trial balance/P&L layout differs, so a wrong cell guess could silently misfile a real
// return — this way the sheet always holds exactly what you reviewed and approved here.
async function downloadExcelWithAoc4Sheets() {
  const idx = docs.findIndex(d => d && d.status === 'ok' && d.kind === 'sheet');
  if (idx < 0) return toast('Upload the financial Excel workbook first (Upload & AI), then try again', true);
  const file = uploadedFiles[idx];
  try {
    await loadScript(LIBS.xlsx);
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const addSheet = (name, obj) => {
      const ws = XLSX.utils.aoa_to_sheet([['Field', 'Value'], ...readableRowsForSheet(obj)]);
      ws['!cols'] = [{ wch: 60 }, { wch: 28 }];
      const at = wb.SheetNames.indexOf(name);
      if (at >= 0) wb.Sheets[name] = ws; else XLSX.utils.book_append_sheet(wb, ws, name);
    };
    addSheet('AOC-4 Online', buildClientJson());
    addSheet('AOC-4 Offline', buildAoc4OfflineFormData());
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${file.name.replace(/\.(xlsx|xlsm|xls|csv)$/i, '')} (AOC-4).xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`Downloaded ${a.download} — ${file.name} plus the AOC-4 Online/Offline sheets`);
  } catch (e) { toast(`Could not build the workbook: ${e.message}`, true); }
}

// Talks to the extension's background service worker. Chrome exposes chrome.runtime.sendMessage to
// a web page only when the extension lists this page's origin under "externally_connectable",
// which the manifest does for http://localhost and http://127.0.0.1.
function sendToExtension(message) {
  return new Promise((resolve, reject) => {
    const id = (settings.extId || '').trim();
    if (!id) return reject(new Error('no extension id is saved in Settings'));
    if (!/^[a-p]{32}$/.test(id)) return reject(new Error('that extension id does not look right — it is 32 letters a–p, copied from chrome://extensions'));
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      return reject(new Error(location.protocol === 'file:'
        ? 'this page is open as a file:// document; serve it over http://localhost so Chrome allows the connection'
        : 'this browser has no extension bridge on this page — open the dashboard in Chrome over http://localhost'));
    }
    let settled = false;
    const timer = setTimeout(() => { if (!settled) { settled = true; reject(new Error('the extension did not answer within 10 seconds — reload it at chrome://extensions and try again')); } }, 10000);
    // The pairing key (Settings → Extension) is only checked by the extension once one has been
    // generated there — harmless to send on every call, including "ping", if none is set.
    const payload = settings.pairingKey ? { ...message, key: settings.pairingKey } : message;
    try {
      chrome.runtime.sendMessage(id, payload, res => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        const err = chrome.runtime.lastError;
        if (err) return reject(new Error(/not exist|Could not establish|Receiving end/i.test(err.message)
          ? 'no extension with that id answered. Check the id, that the extension is enabled, and that it has been reloaded since this feature was added'
          : err.message));
        if (!res) return reject(new Error('the extension sent no answer'));
        if (!res.ok) return reject(new Error(res.error || 'the extension refused the client'));
        resolve(res);
      });
    } catch (e) { if (!settled) { settled = true; clearTimeout(timer); reject(e); } }
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Settings, clients, sample, navigation
   ═══════════════════════════════════════════════════════════════════ */
let myKeys = [];
async function loadKeys() {
  try {
    const res = await fetch('/api/keys');
    const data = await res.json();
    myKeys = data.keys || [];
  } catch (_) { myKeys = []; }
  renderKeysUi();
}
function markScrollableTables() { $$('.scroll-x').forEach(el => el.classList.toggle('has-scroll', el.scrollWidth > el.clientWidth + 1)); }
function bindScrollCue() {
  const topbar = $('.topbar');
  const onScroll = () => topbar.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', markScrollableTables);
  onScroll();
}
function renderKeysUi() {
  const tbl = $('#keysTable');
  if (tbl) {
    const rows = myKeys.filter(k => !k.revoked).map(k => `
      <tr>
        <td>${esc(k.label || '(no label)')}</td>
        <td style="font-family:var(--mono)">${esc(k.key.slice(0, 10))}…</td>
        <td>${new Date(k.createdAt).toLocaleDateString()}</td>
        <td><button class="btn sm danger" data-revoke-key="${k.id}">Revoke</button></td>
      </tr>`).join('');
    tbl.innerHTML = `<thead><tr><th>Label</th><th>Key</th><th>Created</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="4">${emptyState('No keys yet', 'Generate one below.')}</td></tr>`}</tbody>`;
    markScrollableTables();
  }
  const sel = $('#setPairingKey');
  if (sel) {
    const active = myKeys.some(k => !k.revoked && k.key === settings.pairingKey) ? settings.pairingKey : '';
    sel.innerHTML = `<option value="">None selected</option>` + myKeys.filter(k => !k.revoked).map(k => `<option value="${esc(k.key)}">${esc(k.label || k.key.slice(0, 10) + '…')}</option>`).join('');
    sel.value = active;
  }
}
function bindSettings() {
  const ov = $('#settingsOverlay');
  const close = () => { ov.classList.remove('show'); $('#settingsBtn').focus(); };
  const open = () => {
    $('#setLlmProvider').value = settings.llmProvider; $('#setLlmKey').value = settings.llmKey; $('#setGatewayUrl').value = settings.gatewayUrl || ''; $('#setGatewayToken').value = settings.gatewayToken || ''; $('#setExtId').value = settings.extId || '';
    $('#firmGrid').innerHTML = AUDITOR_FIELDS.map(([k, label, type, options]) => `<div class="f"><label for="firm_${k}">${esc(label)}</label>${type === 'select' ? `<select class="sel" id="firm_${k}" data-firm="${k}">${options.map(o => `<option ${firm?.[k] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : `<input class="in" id="firm_${k}" data-firm="${k}" value="${esc(firm?.[k] || '')}">`}</div>`).join('');
    ov.classList.add('show');
    loadKeys();
    $$('#settingsTabs button')[0]?.focus();
  };
  $('#settingsBtn').addEventListener('click', open);
  $('#settingsClose').addEventListener('click', close);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('show')) close(); });
  // Settings tabs.
  $$('#settingsTabs button').forEach(b => b.addEventListener('click', () => {
    $$('#settingsTabs button').forEach(x => x.classList.toggle('on', x === b));
    $$('#settingsOverlay .settings-pane').forEach(p => p.classList.toggle('on', p.dataset.pane === b.dataset.stab));
  }));
  $('#setExtTest').addEventListener('click', async () => {
    const status = $('#setExtStatus');
    const typed = $('#setExtId').value.trim();
    const saved = settings.extId;
    settings.extId = typed;                       // test what is on screen, not what was saved
    status.textContent = 'Checking…';
    try {
      const res = await sendToExtension({ action: 'ping' });
      status.innerHTML = `<span style="color:var(--ok)">Connected to ${esc(res.name || 'the extension')} v${esc(res.version || '?')}.</span>`;
    } catch (e) {
      status.innerHTML = `<span style="color:var(--err)">${esc(e.message)}</span>`;
    } finally { settings.extId = saved; }
  });
  $('#genPairingKey').addEventListener('click', async () => {
    const label = $('#newKeyLabel').value.trim();
    try {
      const res = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate a key.');
      $('#newKeyLabel').value = '';
      await loadKeys();
      $('#setPairingKey').value = data.key.key;
      toast('New key generated — paste it into the extension\'s Account section, then Save settings');
    } catch (e) { toast(e.message, true); }
  });
  $('#keysTable').addEventListener('click', async e => {
    const btn = e.target.closest('[data-revoke-key]');
    if (!btn) return;
    const id = btn.dataset.revokeKey;
    if (!confirm('Revoke this key? Anything still using it will stop working immediately.')) return;
    try {
      const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not revoke the key.');
      await loadKeys();
      toast('Key revoked');
    } catch (err) { toast(err.message, true); }
  });
  $('#copyPairingKey').addEventListener('click', async () => {
    const key = $('#setPairingKey').value.trim();
    if (!key) return toast('Select a key first', true);
    try { await navigator.clipboard.writeText(key); toast('Pairing key copied'); }
    catch (_) { toast('Copy failed — select the text instead', true); }
  });
  $('#settingsSave').addEventListener('click', () => {
    settings = { llmProvider: $('#setLlmProvider').value, llmKey: $('#setLlmKey').value.trim(), gatewayUrl: sanitizeUrl($('#setGatewayUrl').value), gatewayToken: $('#setGatewayToken').value.trim(), extId: $('#setExtId').value.trim(), pairingKey: $('#setPairingKey').value.trim() };
    LS.set('aoc4_settings', settings);
    const f = {}; let any = false; $$('[data-firm]').forEach(el => { f[el.dataset.firm] = el.value.trim(); if (el.value.trim()) any = true; });
    if (any) { firm = f; LS.set('aoc4_firm', firm); } else { firm = null; LS.del('aoc4_firm'); }
    close(); updateExtractBtn(); render(true); toast('Settings saved');
  });
}
function bindClients() {
  $('#clientSelect').addEventListener('change', e => {
    const key = e.target.value;
    if (!key) { newClient(); return; }
    const d = LS.get(key, null); if (!d) return;
    state = Object.assign(blankState(), d); currentDraftKey = key; LS.set('aoc4_last_draft', key);
    uploadedFiles.length = 0; renderFiles(); render(true); derive(); render(true); showPanel('data'); toast(`Loaded ${state.meta.companyName || 'draft'}`);
  });
  $('#newClientBtn').addEventListener('click', newClient);
  $('#importJsonBtn').addEventListener('click', () => $('#importJsonInput').click());
  $('#importJsonInput').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { loadClientJson(JSON.parse(await f.text()), 'manual'); currentDraftKey = null; render(true); showPanel('data'); toast(`Imported ${f.name}`); }
    catch (err) { toast(`Could not read ${f.name}: ${err.message}`, true); }
    e.target.value = '';
  });
  $('#sampleBtn').addEventListener('click', () => { loadSample(); showPanel('data'); toast('Sample client loaded (Lessonboard, FY 2025-26)'); });
  renderClientList();
}
function newClient() { state = blankState(); currentDraftKey = null; uploadedFiles.length = 0; renderFiles(); afterChange(); render(true); renderClientList(); setSaveState('New client — not saved yet'); showPanel('data'); }
function loadSample() {
  const s = blankState();
  s.meta.fy = '2025-26';
  const m = (path, v, src = 'manual') => { setPath(s, path, v); s.sources[path] = src; };
  m('general.CIN', 'U80904KA2018PTC119370', 'sandbox'); m('meta.companyName', 'LESSONBOARD EDU SOLUTIONS PRIVATE LIMITED', 'sandbox'); m('meta.registeredAddress', 'FLAT NO 4153 LEVEL 15, PRESTIGE SONG OF THE SOUTH, BEGUR KOPPA MAIN ROAD, NA, BANGALORE, Bangalore, Karnataka, India, 560068', 'sandbox'); m('meta.companyClass', 'Private', 'sandbox'); m('shareCapital.AUTH_NOMINAL', 1000000, 'sandbox'); m('shareCapital.PAID_UP_NOMINAL', 100000, 'sandbox');
  s.signatoriesFS = [{ din: '08302207', name: 'Punit Ahuja', designation: 'Director', date: '' }, { din: '08302208', name: 'Kirti Punit Ahuja', designation: 'Director', date: '' }];
  s.signatoriesFS.forEach((r, i) => { s.sources[`signatoriesFS.${i}.din`] = 'manual'; s.sources[`signatoriesFS.${i}.name`] = 'manual'; });
  for (const [k, v] of Object.entries({ ADT_SRN: 'AC0363504', AUDITOR_PAN: 'AAOFJ5797P', AUDITOR_CATEGORY: "Auditor's firm", AUDITOR_FIRM_REG: '018971S', AUDITOR_NAME: 'Jain S A K and Co', AUDITOR_ADDR1: 'S3, 2nd Floor White House', AUDITOR_ADDR2: 'St Marks Road, Bangalore', AUDITOR_COUNTRY: 'India', AUDITOR_PIN: '560001', AUDITOR_AREA: 'CMM Court Complex', AUDITOR_CITY: 'Bangalore', AUDITOR_DISTRICT: 'Bangalore', AUDITOR_STATE: 'Karnataka', MEMBER_NAME: 'Sumit Jain', MEMBER_NUMBER: '235818' })) m(`auditor.${k}`, v);
  for (const [k, v] of Object.entries({ SERVER_ADDR1: 'FLAT NO 4153 LEVEL 15,', SERVER_ADDR2: 'PRESTIGE SONG OF THE SOUTH BEGUR KOPPA MAIN ROAD, NA, BANGALORE,', SERVER_PIN: '560068', SERVER_AREA: 'Begur', SERVER_CITY: 'Bangalore South', SERVER_DISTRICT: 'Bangalore', SERVER_STATE: 'Karnataka' })) m(`industry.${k}`, v);
  const cur = { RESERVES_SURPLUS: 1014797, TRADE_PAYABLES_OTHER: 44908, OTHER_CURRENT_LIAB: 45974, PPE: 257604, INTANGIBLE_ASSETS: 357019, TRADE_RECEIVABLES: 19000, CASH_EQUIVALENTS: 148473, OTHER_CURRENT_ASSETS: 423583 };
  const prev = { SHARE_CAPITAL: 100000, RESERVES_SURPLUS: 3342799, LONG_TERM_BORROWINGS: 519012, SHORT_TERM_BORROWINGS: 312492, TRADE_PAYABLES_OTHER: 241433, OTHER_CURRENT_LIAB: 311795, SHORT_TERM_PROVISIONS: 314268, PPE: 1659293, INTANGIBLE_ASSETS: 715019, TRADE_RECEIVABLES: 127620, CASH_EQUIVALENTS: 2527242, OTHER_CURRENT_ASSETS: 112625 };
  for (const [k, v] of Object.entries(cur)) m(`balanceSheet.current.${k}`, v);
  for (const [k, v] of Object.entries(prev)) m(`balanceSheet.previous.${k}`, v);
  for (const [k, v] of Object.entries({ REVENUE_OPERATIONS: 2368543, OTHER_INCOME: 6357, EMPLOYEE_EXPENSES: 2091423, FINANCE_COSTS: 45276, DEPRECIATION: 596506, OTHER_EXPENSES: 1969698 })) m(`profitLoss.current.${k}`, v);
  for (const [k, v] of Object.entries({ REVENUE_OPERATIONS: 9961629, OTHER_INCOME: 2875, EMPLOYEE_EXPENSES: 5276732, MANAGERIAL_REMUNERATION: 88771, FINANCE_COSTS: 80648, DEPRECIATION: 735456, OTHER_EXPENSES: 3410510, CURRENT_TAX: 58092 })) m(`profitLoss.previous.${k}`, v);
  m('financialParametersBS.GROSS_PPE_INTANGIBLE', 2790528);
  m('foreignExchange.FX_IN_OTHER_INCOME.previous', 1657288);
  m('principalProducts.CATEGORY_CODE', '9992'); m('principalProducts.CATEGORY_DESC', 'EDUCATION SERVICES'); m('principalProducts.HIGHEST_CODE', '99929199'); m('principalProducts.HIGHEST_DESC', 'Other education and training services n.e.c.');
  state = s; currentDraftKey = null;
  afterChange(); render(true);
}
let searchOpenState = null;
function applyFieldFilter(q) {
  const cards = $$('#dataSections .card');
  if (!q) {
    cards.forEach(c => {
      c.classList.remove('hidden-by-search');
      const id = c.dataset.section;
      if (c.dataset.section) c.classList.toggle('collapsed', searchOpenState ? searchOpenState.has(id) : !openSections.has(id));
      c.querySelectorAll('.f, tbody tr').forEach(el => el.classList.remove('hidden-by-search'));
    });
    searchOpenState = null;
    return;
  }
  // Remember what the user had collapsed, so clearing the search restores it.
  if (!searchOpenState) searchOpenState = new Set($$('#dataSections .card.collapsed').map(c => c.dataset.section));
  // Every word must appear in the label, or the whole query in the data path.
  const tokens = q.split(/\s+/).filter(Boolean);
  const matches = text => tokens.every(t => text.includes(t));
  cards.forEach(c => {
    let hits = 0;
    c.querySelectorAll('.f').forEach(f => {
      const label = (f.dataset.label || f.textContent || '').toLowerCase();
      const path = (f.querySelector('[data-path]')?.dataset.path || '').toLowerCase();
      const match = matches(label) || path.includes(q);
      f.classList.toggle('hidden-by-search', !match);
      if (match) hits++;
    });
    c.querySelectorAll('tbody tr').forEach(tr => {
      if (tr.classList.contains('group') || tr.classList.contains('total')) return;
      const text = (tr.textContent || '').toLowerCase();
      const paths = [...tr.querySelectorAll('[data-path]')].map(el => el.dataset.path.toLowerCase());
      const match = matches(text) || paths.some(p => p.includes(q));
      tr.classList.toggle('hidden-by-search', !match);
      if (match) hits++;
    });
    c.classList.toggle('hidden-by-search', hits === 0);
    if (hits) c.classList.remove('collapsed');
  });
}

function bindNav() {
  $$('.nav button').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.panel)));
  $('#topReviewBtn').addEventListener('click', () => showPanel(currentForm === 'spice' ? 'review-spice' : currentForm === 'adt1' ? 'review-adt1' : 'review'));
  $('#railReviewBtn').addEventListener('click', () => showPanel('review'));
  $('#prevPanel').addEventListener('click', () => showPanel(PANELS[Math.max(0, PANELS.indexOf(activePanel) - 1)]));
  $('#nextPanel').addEventListener('click', () => {
    if (activePanel === 'review') $('#sendBtn').click();
    else if (activePanel === 'review-spice') $('#spSendBtn').click();
    else if (activePanel === 'review-adt1') $('#adSendBtn').click();
    else showPanel(PANELS[Math.min(PANELS.length - 1, PANELS.indexOf(activePanel) + 1)]);
  });
  window.addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (PANELS.includes(h) && h !== activePanel) showPanel(h); });

  // Collapse / expand cards (delegated once).
  const ds = $('#dataSections');
  ds.addEventListener('click', onCardToggle);
  ds.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-toggle]')) { e.preventDefault(); onCardToggle(e); }
  });

  // Section tab bar.
  $$('#sectionTabs button').forEach(b => b.addEventListener('click', () => {
    $$('#sectionTabs button').forEach(x => x.classList.toggle('on', x === b));
    const card = document.getElementById(b.dataset.target);
    if (!card) return;
    card.classList.remove('collapsed');
    if (card.dataset.section) openSections.add(card.dataset.section);
    const head = card.querySelector('[data-toggle]');
    if (head) head.setAttribute('aria-expanded', 'true');
    const y = card.getBoundingClientRect().top + window.scrollY - 150;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }));

  // Field search.
  const search = $('#fieldSearch');
  search.addEventListener('input', () => applyFieldFilter(search.value.trim().toLowerCase()));
  search.addEventListener('keydown', e => { if (e.key === 'Escape') { search.value = ''; applyFieldFilter(''); search.blur(); } });

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search.focus(); search.select(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault(); if (currentForm === 'adt1') saveAdt1Draft(); else autosave(); toast('Draft saved in this browser');
    }
    if (e.altKey && currentForm === 'aoc4' && ['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault(); showPanel(PANELS_AOC4[Number(e.key) - 1]);
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════
   SPICe+ Part A (Name Reservation) — same page, selected via the Form dropdown.
   Depends on js/spice-a-shared.js (SPICE_A_SUFFIX_OPTIONS, validateSpiceAName, …) and reuses
   this file's $, $$, esc, toast, LS, settings, sendToExtension — nothing is redeclared.
   ═══════════════════════════════════════════════════════════════════ */
function spiceBlankState() {
  return {
    SPICE_TYPE_OF_COMPANY: '', SPICE_LLPIN: '',
    SPICE_NIC_CODE_1: '', SPICE_NIC_DESC_1: '',
    SPICE_NIC_CODE_2: '', SPICE_NIC_DESC_2: '',
    SPICE_NIC_CODE_3: '', SPICE_NIC_DESC_3: '',
    SPICE_MAIN_SUBCLASS: '', SPICE_SUFFIX_CATEGORY: '',
    SPICE_NAME_1: '', SPICE_NAME_2: ''
  };
}
let spiceState = spiceBlankState();
let spiceMainSubclassAuto = true;
let spiceAttachments = [];

function deriveSpice() {
  if (spiceMainSubclassAuto) {
    spiceState.SPICE_MAIN_SUBCLASS = buildSpiceAMainSubclass([spiceState.SPICE_NIC_DESC_1, spiceState.SPICE_NIC_DESC_2, spiceState.SPICE_NIC_DESC_3]);
  }
}
function validateSpice() {
  const errors = [], warnings = [];
  if (!spiceState.SPICE_TYPE_OF_COMPANY) errors.push({ path: 'spTypeOfCompany', msg: 'Type of company is required.' });
  if (spiceState.SPICE_TYPE_OF_COMPANY === 'part1_llp_to_company' && !spiceState.SPICE_LLPIN) {
    errors.push({ path: 'spLlpin', msg: 'LLPIN is required for "Part I LLP to Company".' });
  }
  if (!spiceState.SPICE_NIC_CODE_1) errors.push({ path: 'spNic1', msg: 'At least one (primary) NIC code is required.' });
  for (const [path, code] of [['spNic1', spiceState.SPICE_NIC_CODE_1], ['spNic2', spiceState.SPICE_NIC_CODE_2], ['spNic3', spiceState.SPICE_NIC_CODE_3]]) {
    for (const w of validateSpiceANicCode(code)) warnings.push({ path, msg: w });
  }
  if (!spiceState.SPICE_NAME_1) errors.push({ path: 'spName1', msg: 'At least one proposed name is required.' });
  const r1 = validateSpiceAName(spiceState.SPICE_NAME_1, spiceState.SPICE_SUFFIX_CATEGORY);
  r1.errors.forEach(m => errors.push({ path: 'spName1', msg: m })); r1.warnings.forEach(m => warnings.push({ path: 'spName1', msg: m }));
  const r2 = validateSpiceAName(spiceState.SPICE_NAME_2, spiceState.SPICE_SUFFIX_CATEGORY);
  r2.errors.forEach(m => errors.push({ path: 'spName2', msg: m })); r2.warnings.forEach(m => warnings.push({ path: 'spName2', msg: m }));
  if (spiceAttachments.length > 5) errors.push({ path: 'spAttachments', msg: 'Up to 5 optional attachments are allowed.' });
  return { errors, warnings };
}
function renderSpice() {
  deriveSpice();
  $('#spTypeOfCompany').value = spiceState.SPICE_TYPE_OF_COMPANY;
  $('#spLlpin').value = spiceState.SPICE_LLPIN;
  $('#spNic1').value = spiceState.SPICE_NIC_CODE_1; $('#spNicDesc1').value = spiceState.SPICE_NIC_DESC_1;
  $('#spNic2').value = spiceState.SPICE_NIC_CODE_2; $('#spNicDesc2').value = spiceState.SPICE_NIC_DESC_2;
  $('#spNic3').value = spiceState.SPICE_NIC_CODE_3; $('#spNicDesc3').value = spiceState.SPICE_NIC_DESC_3;
  $('#spMainSubclass').value = spiceState.SPICE_MAIN_SUBCLASS;
  $('#spSuffixCategory').value = spiceState.SPICE_SUFFIX_CATEGORY;
  $('#spName1').value = spiceState.SPICE_NAME_1;
  $('#spName2').value = spiceState.SPICE_NAME_2;
  $('#spName1Count').textContent = `${spiceState.SPICE_NAME_1.length} / 75`;
  $('#spName2Count').textContent = `${spiceState.SPICE_NAME_2.length} / 75`;
  const r1 = validateSpiceAName(spiceState.SPICE_NAME_1, spiceState.SPICE_SUFFIX_CATEGORY);
  $('#spName1Msgs').innerHTML = [...r1.errors.map(m => `<div class="note err">${esc(m)}</div>`), ...r1.warnings.map(m => `<div class="note warn">${esc(m)}</div>`)].join('');
  const r2 = validateSpiceAName(spiceState.SPICE_NAME_2, spiceState.SPICE_SUFFIX_CATEGORY);
  $('#spName2Msgs').innerHTML = [...r2.errors.map(m => `<div class="note err">${esc(m)}</div>`), ...r2.warnings.map(m => `<div class="note warn">${esc(m)}</div>`)].join('');
  const { errors } = validateSpice();
  $('#sp-cnt-data').textContent = errors.length ? String(errors.length) : '';
  $('#sp-cnt-data').classList.toggle('err', errors.length > 0);
  if (currentForm === 'spice') {
    const top = $('#topStatus');
    top.textContent = errors.length ? `${errors.length} to fix` : 'Ready';
    top.className = 'pill ' + (errors.length ? 'err' : 'ok');
    top.style.display = '';   // AOC-4 hides the pill when it has nothing to say: show it again for SPICe+
  }
  $('#spFormBadge').textContent = spiceState.SPICE_NAME_1 ? 'In progress' : 'Draft';
}
function bindSpiceFields() {
  const bind = (id, key, transform) => $(id).addEventListener('input', () => {
    spiceState[key] = transform ? transform($(id).value) : $(id).value;
    if (key === 'SPICE_MAIN_SUBCLASS') spiceMainSubclassAuto = false;
    renderSpice();
    autosaveSpice();
  });
  bind('#spTypeOfCompany', 'SPICE_TYPE_OF_COMPANY');
  bind('#spLlpin', 'SPICE_LLPIN', v => v.toUpperCase());
  bind('#spNic1', 'SPICE_NIC_CODE_1', v => v.replace(/\D/g, '').slice(0, 5));
  bind('#spNicDesc1', 'SPICE_NIC_DESC_1');
  bind('#spNic2', 'SPICE_NIC_CODE_2', v => v.replace(/\D/g, '').slice(0, 5));
  bind('#spNicDesc2', 'SPICE_NIC_DESC_2');
  bind('#spNic3', 'SPICE_NIC_CODE_3', v => v.replace(/\D/g, '').slice(0, 5));
  bind('#spNicDesc3', 'SPICE_NIC_DESC_3');
  bind('#spMainSubclass', 'SPICE_MAIN_SUBCLASS');
  bind('#spSuffixCategory', 'SPICE_SUFFIX_CATEGORY');
  bind('#spName1', 'SPICE_NAME_1');
  bind('#spName2', 'SPICE_NAME_2');
  const sel = $('#spSuffixCategory');
  for (const c of SPICE_A_SUFFIX_OPTIONS) sel.add(new Option(c.label, c.id));
}
function bindSpiceUpload() {
  const zone = $('#spDropZone'), input = $('#spFileInput');
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); addSpiceAttachments(e.dataTransfer.files); });
  input.addEventListener('change', () => { addSpiceAttachments(input.files); input.value = ''; });
}
async function addSpiceAttachments(files) {
  for (const f of files) {
    if (spiceAttachments.length >= 5) { toast('Up to 5 optional attachments are allowed', true); break; }
    if (!/^(application\/pdf|image\/jpe?g)$/.test(f.type)) { toast(`${f.name}: only PDF or JPG is accepted`, true); continue; }
    if (f.size > 2 * 1024 * 1024) { toast(`${f.name}: over the 2 MB limit`, true); continue; }
    const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(f); });
    spiceAttachments.push({ name: f.name, type: f.type, size: f.size, dataUrl });
  }
  renderSpiceAttachments();
  renderSpice();
  autosaveSpice();
}
function renderSpiceAttachments() {
  $('#spFileList').innerHTML = spiceAttachments.map((a, i) =>
    `<div class="file"><span class="fname"><svg class="ico" viewBox="0 0 24 24" style="vertical-align:-2px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${esc(a.name)} <span class="muted">${(a.size / 1024).toFixed(0)} KB</span></span><span class="btn-row"><button class="btn sm" data-rm-spatt="${i}">Remove</button></span></div>`
  ).join('');
  $$('#spFileList [data-rm-spatt]').forEach(b => b.addEventListener('click', () => { spiceAttachments.splice(+b.dataset.rmSpatt, 1); renderSpiceAttachments(); renderSpice(); autosaveSpice(); }));
}

/* ── Filesure lookup for SPICe+ Part A — reuses fetchCompanyMasterData()/searchCompany() (CIN-based,
   not form-specific); only what gets applied to the form differs from applyMasterData() (AOC-4). ── */
function applyMasterDataSpice(d) {
  const guess = { 'Private': 'private', 'Public': 'public', 'OPC': 'opc' }[d.company_class] || '';
  if (guess) spiceState.SPICE_SUFFIX_CATEGORY = guess;
  renderSpice();
  autosaveSpice();
  const rows = [['Company name', d.company_name], ['CIN', d.cin], ['Status', d.company_status], ['Class', d.company_class], ['Registered office', d.registered_office_address], ['Industrial classification', d.company_industrial_classification]];
  $('#spSbKv').innerHTML = rows.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  $('#spSbApplied').textContent = guess ? 'Company type (for the name-suffix check) was set from this company\'s class. NIC codes and the proposed name are still yours to fill in.' : 'Nothing could be mapped into the SPICe+ Part A fields automatically — NIC codes and the proposed name are still yours to fill in.';
  $('#spSbResultBlock').classList.remove('hidden');
  $('#spSbStatus').innerHTML = '';
}
function bindSandboxSpice() {
  const cinIn = $('#spSbCin'), fetchBtn = $('#spSbFetchBtn');
  fetchBtn.disabled = !RE.cin.test(cinIn.value.trim());
  cinIn.addEventListener('input', () => { const up = cinIn.value.toUpperCase(); if (up !== cinIn.value) cinIn.value = up; fetchBtn.disabled = !RE.cin.test(cinIn.value.trim()); });
  fetchBtn.addEventListener('click', async () => {
    const cin = cinIn.value.trim().toUpperCase();
    fetchBtn.disabled = true; $('#spSbStatus').innerHTML = '<span class="spin"></span> Fetching from MCA via Filesure…';
    try { applyMasterDataSpice(await fetchCompanyMasterData(cin)); toast('Company data fetched'); }
    catch (e) { $('#spSbStatus').innerHTML = `<div class="note err">${esc(e.message)}</div>`; }
    finally { fetchBtn.disabled = !RE.cin.test(cinIn.value.trim()); }
  });
  $('#spSavedCompanies').addEventListener('change', e => { const d = getMasterList()[e.target.value]; if (d) { cinIn.value = d.cin; fetchBtn.disabled = false; applyMasterDataSpice(d); toast('Loaded cached master data'); } });
  $$('#spSbResultBlock [data-go]').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.go)));
  const list = getMasterList(); const keys = Object.keys(list);
  $('#spSavedCompanyWrap').classList.toggle('hidden', !keys.length);
  $('#spSavedCompanies').innerHTML = '<option value="">Select…</option>' + keys.map(cin => `<option value="${esc(cin)}">${esc(list[cin].company_name)} (${esc(cin)})</option>`).join('');
}

function spiceClientId() {
  return 'spice_' + (spiceState.SPICE_NAME_1 || 'new').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}
function buildSpiceClientJson() {
  return { formType: 'spice_part_a', clientId: spiceClientId(), displayName: spiceState.SPICE_NAME_1 || 'New SPICe+ Part A client', source: 'Germin8 Advisors — SPICe+ Part A Dashboard', ...spiceState, attachments: spiceAttachments };
}
function renderSpiceReview() {
  const { errors, warnings } = validateSpice();
  const summary = $('#spIssueSummary');
  summary.textContent = errors.length ? `${errors.length} error${errors.length > 1 ? 's' : ''}` : warnings.length ? `${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : 'All checks passed';
  summary.className = 'pill ' + (errors.length ? 'err' : warnings.length ? 'warn' : 'ok');
  const li = (sev, m) => `<li><span class="sev ${sev}"></span><span>${esc(m.msg)}</span></li>`;
  $('#spIssueList').innerHTML = errors.map(m => li('err', m)).concat(warnings.map(m => li('warn', m))).join('') || '<li><span class="sev" style="background:var(--ok)"></span><span>No issues. The client JSON is ready for the extension.</span></li>';
  $('#spJsonPreview').textContent = JSON.stringify(buildSpiceClientJson(), null, 2);
  const send = $('#spSendBtn');
  send.disabled = errors.length > 0;
  send.textContent = errors.length ? 'Sending blocked' : 'Send to extension';
  $('#sp-cnt-review').textContent = errors.length ? String(errors.length) : '';
  $('#sp-cnt-review').classList.toggle('err', errors.length > 0);
}
function downloadSpiceClientJson() {
  const json = buildSpiceClientJson();
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${json.clientId}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`Downloaded ${json.clientId}.json`);
  return json;
}
// Germin8's SPICe+ Part A field map (js/field-maps/spice-a.js) expects one flat object keyed by
// its own `dataKey` names — different naming from this dashboard's SPICE_* keys, and "Company
// type" there means legal form (maps from our suffix category, not Instruction Kit's filing-type
// dropdown, which Germin8 doesn't model separately).
const SPICE_SUFFIX_TO_GERMIN8_COMPANY_TYPE = { opc: 'OPC', private: 'PRIVATE_LIMITED', public: 'PUBLIC_LIMITED' };
function buildGermin8SpiceFormData() {
  return {
    proposedName1: spiceState.SPICE_NAME_1,
    proposedName2: spiceState.SPICE_NAME_2,
    LLPIN: spiceState.SPICE_LLPIN,
    CIN: '',
    'NIC code': spiceState.SPICE_NIC_CODE_1,
    'Business activity': spiceState.SPICE_MAIN_SUBCLASS || spiceState.SPICE_NIC_DESC_1,
    'Company type': SPICE_SUFFIX_TO_GERMIN8_COMPANY_TYPE[spiceState.SPICE_SUFFIX_CATEGORY] || 'PRIVATE_LIMITED',
  };
}
function germin8SpiceClientInfo() {
  return { id: spiceClientId(), name: spiceState.SPICE_NAME_1 || 'New SPICe+ Part A client', source: 'dashboard' };
}
function downloadSpiceAttachments() {
  if (!spiceAttachments.length) return toast('No attachments to download', true);
  for (const a of spiceAttachments) { const el = document.createElement('a'); el.href = a.dataUrl; el.download = a.name; document.body.appendChild(el); el.click(); el.remove(); }
  toast(`Downloaded ${spiceAttachments.length} file${spiceAttachments.length > 1 ? 's' : ''}`);
}
function bindSpiceReview() {
  $('#spJsonCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(JSON.stringify(buildSpiceClientJson(), null, 2)); toast('JSON copied'); } catch (_) { toast('Copy failed — select the text instead', true); } });
  $('#spDownloadBtn').addEventListener('click', () => downloadSpiceClientJson());
  $('#spDownloadAttachmentsBtn').addEventListener('click', downloadSpiceAttachments);
  $('#spSendBtn').addEventListener('click', async () => {
    const { errors } = validateSpice(); if (errors.length) return toast('Clear the errors first', true);
    const json = buildSpiceClientJson();
    const note = html => { $('#spSendResult').innerHTML = html; };
    if (!settings.extId) { downloadSpiceClientJson(); return note('<div class="note warn">No extension id saved, so the client was downloaded instead. Add the id in Settings → Extension.</div>'); }
    note('<div class="note"><span class="spin"></span> Sending to the extension…</div>');
    try {
      const res = await sendToExtension({ action: 'importClient', formType: 'spice_a', formData: buildGermin8SpiceFormData(), clientInfo: germin8SpiceClientInfo() });
      autosaveSpice();
      note(`<div class="note ok"><strong>${esc(res.name || json.clientId)}</strong> is now in the extension${res.replaced ? ' (it replaced the earlier copy)' : ''}. Open SPICe+ Part A on MCA, choose the form in the popup, pick it and click <strong>Load &amp; Fill SPICe+ Part A</strong>.</div>`);
      toast('Sent to the extension');
    } catch (e) {
      downloadSpiceClientJson();
      note(`<div class="note err"><strong>Could not reach the extension:</strong> ${esc(e.message)}<br>The client was downloaded instead — import it in the popup with <strong>Import JSON…</strong>.</div>`);
    }
  });
  $('#spDraftBtn').addEventListener('click', () => { autosaveSpice(); toast('Draft saved in this browser'); });
}
const autosaveSpice = debounce(() => { LS.set('spiceA_draft', { state: spiceState, attachments: spiceAttachments, mainSubclassAuto: spiceMainSubclassAuto, _savedAt: Date.now() }); setSaveState(`Saved · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, true); }, 800);
function loadSpiceDraft() {
  const d = LS.get('spiceA_draft', null);
  if (!d) return;
  spiceState = Object.assign(spiceBlankState(), d.state || {});
  spiceAttachments = d.attachments || [];
  spiceMainSubclassAuto = d.mainSubclassAuto !== false;
}
function loadSpiceClientJson(json) {
  spiceState = Object.assign(spiceBlankState(), json);
  spiceAttachments = Array.isArray(json.attachments) ? json.attachments : [];
  spiceMainSubclassAuto = false;
  renderSpiceAttachments();
  renderSpice();
  autosaveSpice();
}
function bindSpiceTop() {
  $('#spNewBtn').addEventListener('click', () => {
    spiceState = spiceBlankState(); spiceAttachments = []; spiceMainSubclassAuto = true;
    renderSpiceAttachments(); renderSpice(); autosaveSpice(); showPanel('data-spice'); toast('New client');
  });
  $('#spImportJsonBtn').addEventListener('click', () => $('#spImportJsonInput').click());
  $('#spImportJsonInput').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const json = JSON.parse(await f.text());
      loadSpiceClientJson(json);
      toast(`Loaded ${json.displayName || json.clientId || 'client'}`);
      showPanel('data-spice');
    } catch (err) { toast(`Invalid JSON: ${err.message}`, true); }
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Auth: who is logged in, and the Users & roles admin panel
   ═══════════════════════════════════════════════════════════════════ */
let currentUser = null, currentPermissions = [];
async function bindAuth() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    if (!data.user) { location.href = '/login.html'; return; }
    currentUser = data.user; currentPermissions = data.permissions || [];
  } catch (_) { /* server unreachable mid-session; let the rest of the app try anyway */ }
  if (currentUser) $('#whoAmI').textContent = `${currentUser.username} · ${currentUser.role.name}`;
  $('#adminBtn').classList.toggle('hidden', !currentPermissions.includes('users.manage'));
  $('#logoutBtn').addEventListener('click', async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (_) { }
    location.href = '/login.html';
  });
}

function bindAdmin() {
  const ov = $('#adminOverlay');
  const close = () => { ov.classList.remove('show'); $('#adminBtn').focus(); };
  let roles = [];
  async function loadAdminData() {
    try {
      const [uRes, rRes] = await Promise.all([fetch('/api/admin/users'), fetch('/api/admin/roles')]);
      const uData = await uRes.json(), rData = await rRes.json();
      if (!uRes.ok) throw new Error(uData.error || 'Could not load users.');
      if (!rRes.ok) throw new Error(rData.error || 'Could not load roles.');
      roles = rData.roles;
      renderUsers(uData.users);
      $('#newUserRole').innerHTML = roles.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
      renderRoles(rData.roles, rData.permissions);
      renderNewRolePerms(rData.permissions);
    } catch (e) { toast(e.message, true); }
  }
  // Splits "users.manage" -> category "users"; anything without a dot falls into "other" —
  // a client-side-only grouping, not a server-defined field, so it never needs a schema change.
  function groupPerms(keys) {
    const groups = {};
    keys.forEach(k => { const i = k.indexOf('.'); const cat = i > -1 ? k.slice(0, i) : 'other'; (groups[cat] = groups[cat] || []).push(k); });
    return groups;
  }
  function renderNewRolePerms(permissions) {
    const groups = groupPerms(permissions.map(p => p.key));
    const labelFor = k => permissions.find(p => p.key === k)?.label || k;
    $('#newRolePerms').innerHTML = Object.entries(groups).map(([cat, keys]) => `
      <div class="perm-group">
        <div class="perm-group-label">${esc(cat)}</div>
        ${keys.map(k => `<label class="chk" style="display:block;margin-bottom:4px"><input type="checkbox" value="${esc(k)}"> ${esc(labelFor(k))}</label>`).join('')}
      </div>`).join('');
  }
  function renderUsers(users) {
    $('#usersTable').innerHTML = `<thead><tr><th colspan="2">Account</th><th colspan="2">Status</th><th colspan="2">Credentials</th></tr><tr><th>Username</th><th>Role</th><th>Active</th><th>Created</th><th>New password</th><th></th></tr></thead><tbody>${users.map(u => {
      const self = currentUser && u.id === currentUser.id;
      return `<tr>
        <td><div class="user-cell"><span class="avatar${self ? ' self' : ''}">${esc(u.username.charAt(0).toUpperCase())}</span><div class="uname"><b>${esc(u.username)}</b>${self ? '<span class="hint">(you)</span>' : ''}</div></div></td>
        <td><select class="sel sm" data-role-for="${u.id}" ${self ? 'disabled title="You cannot change your own role"' : ''}>${roles.map(r => `<option value="${r.id}" ${r.id === u.role.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></td>
        <td><label class="pill ${u.active ? 'ok' : 'err'}" style="cursor:${self ? 'default' : 'pointer'}"><input type="checkbox" class="hidden" data-active-for="${u.id}" ${u.active ? 'checked' : ''} ${self ? 'disabled' : ''}> ${u.active ? 'Active' : 'Disabled'}</label></td>
        <td>${new Date(u.createdAt).toLocaleDateString()}</td>
        <td><input class="in" type="password" style="height:28px" placeholder="min. 8 chars" data-pass-for="${u.id}"></td>
        <td><button class="btn sm" type="button" data-reset-for="${u.id}">Reset</button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="6">${emptyState('No users yet', 'Add one using the form above.')}</td></tr>`}</tbody>`;
    markScrollableTables();
  }
  function renderRoles(roles, permissions) {
    const labelFor = k => permissions.find(p => p.key === k)?.label || k;
    $('#rolesList').innerHTML = `<div class="grid">${roles.map(r => {
      const groups = groupPerms(r.permissions);
      const body = Object.keys(groups).length
        ? Object.entries(groups).map(([cat, keys]) => `
            <div class="perm-group">
              <div class="perm-group-label">${esc(cat)}</div>
              <div class="chips">${keys.map(k => `<span class="chip">${cat === 'users' ? ADMIN_LOCK_SVG : ''}${esc(labelFor(k))}</span>`).join('')}</div>
            </div>`).join('')
        : emptyState('No permissions');
      return `
      <div class="card role-card span2${r.isSystem ? ' system' : ''}">
        <div class="card-head" style="cursor:default"><div class="card-heading"><h3>${esc(r.name)} <span class="badge ${r.isSystem ? 'computed' : 'manual'}">${r.isSystem ? 'Built-in' : 'Custom'}</span></h3></div></div>
        <div class="card-body">${body}</div>
      </div>`;
    }).join('')}</div>`;
  }
  $('#adminBtn').addEventListener('click', () => { ov.classList.add('show'); loadAdminData(); });
  $('#adminClose').addEventListener('click', close);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('show')) close(); });
  $$('#adminTabs button').forEach(b => b.addEventListener('click', () => {
    $$('#adminTabs button').forEach(x => x.classList.toggle('on', x === b));
    $$('#adminOverlay .admin-pane').forEach(p => p.classList.toggle('on', p.dataset.apane === b.dataset.atab));
  }));
  $('#createUserBtn').addEventListener('click', async () => {
    const username = $('#newUserName').value.trim();
    const password = $('#newUserPass').value;
    const roleId = Number($('#newUserRole').value);
    try {
      const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, roleId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create the user.');
      $('#newUserName').value = ''; $('#newUserPass').value = '';
      toast(`User "${data.user.username}" created`);
      await loadAdminData();
    } catch (e) { toast(e.message, true); }
  });
  $('#usersTable').addEventListener('change', async e => {
    const roleSel = e.target.closest('[data-role-for]');
    const activeChk = e.target.closest('[data-active-for]');
    try {
      if (roleSel) {
        const res = await fetch(`/api/admin/users/${roleSel.dataset.roleFor}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId: Number(roleSel.value) }) });
        const data = await res.json(); if (!res.ok) throw new Error(data.error);
        toast('Role updated');
      } else if (activeChk) {
        const res = await fetch(`/api/admin/users/${activeChk.dataset.activeFor}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: activeChk.checked }) });
        const data = await res.json(); if (!res.ok) throw new Error(data.error);
        toast(activeChk.checked ? 'User enabled' : 'User disabled');
        await loadAdminData(); // re-render so the Active/Disabled pill text reflects the new state
      }
    } catch (err) { toast(err.message, true); await loadAdminData(); }
  });
  $('#usersTable').addEventListener('click', async e => {
    const btn = e.target.closest('[data-reset-for]');
    if (!btn) return;
    const id = btn.dataset.resetFor;
    const input = $(`[data-pass-for="${id}"]`);
    const password = input.value;
    if (!password) return toast('Type a new password first', true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not reset the password.');
      input.value = '';
      toast(`Password updated for ${data.user.username}`);
    } catch (err) { toast(err.message, true); }
  });
  $('#createRoleBtn').addEventListener('click', async () => {
    const name = $('#newRoleName').value.trim();
    const permissions = $$('#newRolePerms input:checked').map(c => c.value);
    try {
      const res = await fetch('/api/admin/roles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, permissions }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not create the role.');
      $('#newRoleName').value = ''; $$('#newRolePerms input').forEach(c => c.checked = false);
      toast(`Role "${data.role.name}" created`);
      await loadAdminData();
    } catch (e) { toast(e.message, true); }
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Boot
   ═══════════════════════════════════════════════════════════════════ */
(async function boot() {
  await bindAuth();
  bindAdmin();
  bindScrollCue();
  bindNav(); bindSandbox(); bindFilesureConsole(); bindUpload(); bindReview(); bindSettings(); bindClients();
  bindSpiceFields(); bindSandboxSpice(); bindSpiceUpload(); bindSpiceReview(); bindSpiceTop();
  loadSpiceDraft(); renderSpiceAttachments(); renderSpice();
  initAdt1();
  if (typeof bindAdt1Upload === 'function') bindAdt1Upload();
  const last = LS.get('aoc4_last_draft', null);
  const draft = last ? LS.get(last, null) : null;
  if (draft) { state = Object.assign(blankState(), draft); currentDraftKey = last; setSaveState('Draft restored', true); }
  derive(); render(true); renderClientList();
  // Always boot into AOC-4 (matches the dashboard's behavior before the Form dropdown existed) —
  // a leftover "#data-spice"/"#review-spice" hash from a previous visit must never silently
  // switch the mode on reload.
  const h = location.hash.replace('#', '');
  setForm('aoc4_online');
  showPanel(PANELS_AOC4.includes(h) ? h : 'data');
})();
