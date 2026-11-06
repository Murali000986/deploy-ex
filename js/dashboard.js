
/* ═══════════════════════════════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════════════════════════════ */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function setPath(o, p, v) { const ks = p.split('.'); let c = o; for (let i = 0; i < ks.length - 1; i++) { if (c[ks[i]] == null || typeof c[ks[i]] !== 'object') c[ks[i]] = {}; c = c[ks[i]]; } c[ks.at(-1)] = v; }
const clone = o => JSON.parse(JSON.stringify(o));
function toast(msg, isErr) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (isErr ? ' err' : ''); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3500); }
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
// Line icons (24px grid, stroke = currentColor). Field-map categories name one of these via `icon`.
const UI_ICONS = {
  building: `<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>`,
  pen: `<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>`,
  calendar: `<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>`,
  link: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>`,
  shield: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>`,
  file: `<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>`,
  users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
  user: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>`,
  clipboard: `<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>`,
  sliders: `<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>`,
  paperclip: `<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>`,
  wrench: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>`,
  map: `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>`,
  tag: `<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>`,
  check: `<path d="M20 6 9 17l-5-5"/>`,
  filedown: `<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>`,
  usercheck: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>`,
};
const iconSvg = key => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${UI_ICONS[key] || UI_ICONS.file}</svg>`;

const FORM_DEFS = {
  aoc4: { label: 'AOC-4', description: 'Financial statements (online)', requirements: [
    { tag: 'mandatory', text: 'Copy of financial statements duly authenticated u/s 134 (incl. auditor’s report) — PDF' },
    { tag: 'optional', text: 'XBRL instance documents — only for companies filing AOC-4 XBRL' },
    { tag: 'optional', text: 'Consolidated financial statements — only if consolidated FS are filed' },
    { tag: 'optional', text: 'Supplementary / test audit report u/s 143 and CAG comments — government companies' },
    { tag: 'optional', text: 'Secretarial audit report — if applicable' },
    { tag: 'optional', text: 'Statement of facts/reasons — if AGM not held or FS not adopted' },
    { tag: 'optional', text: 'Optional attachments — up to 5' } ] },
  aoc4_offline: { label: 'AOC-4 Offline', description: 'Financial statements (offline eForm)', requirements: [
    { tag: 'mandatory', text: 'Signed financial statements (PDF)' },
    { tag: 'mandatory', text: 'Board’s report and auditor’s report (PDF)' },
    { tag: 'optional', text: 'Secretarial audit report — if applicable' },
    { tag: 'optional', text: 'Statement of facts/reasons — if AGM not held' } ] },
  spice_a: { label: 'SPICe+ Part A', description: 'Name reservation', requirements: [
    { tag: 'mandatory', text: 'Proposed name(s) and NIC industrial activity code' },
    { tag: 'optional', text: 'Trademark approval / NOC — if the proposed name resembles a mark' } ] },
  inc32: { label: 'INC-32 (SPICe+ Part B)', description: 'Company incorporation', requirements: [
    { tag: 'mandatory', text: 'MoA / AoA — attached automatically for SPICe+' },
    { tag: 'mandatory', text: 'Proof of registered office (utility bill, NOC)' },
    { tag: 'mandatory', text: 'Director DIN / PAN / Aadhaar and ID proofs' },
    { tag: 'optional', text: 'INC-9 declaration — generated automatically where possible' } ] },
  dir3: { label: 'DIR-3 KYC', description: 'Director KYC', requirements: [
    { tag: 'mandatory', text: 'DIN, PAN, Aadhaar, personal mobile and personal email' },
    { tag: 'mandatory', text: 'Latest address proof (not older than two months)' },
    { tag: 'mandatory', text: 'OTP verification on the registered mobile and email' } ] }
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
    principalProducts: { TOTAL_CATEGORIES: 1, CATEGORY_CODE: '', CATEGORY_DESC: '', CATEGORY_TURNOVER: 0, HIGHEST_CODE: '', HIGHEST_DESC: '', HIGHEST_TURNOVER: 0 },
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
  // Products / services: turnover follows revenue; a single category is also the highest one.
  const pp = state.principalProducts;
  auto('principalProducts.CATEGORY_TURNOVER', num(pl.current.REVENUE_OPERATIONS));
  if (num(pp.TOTAL_CATEGORIES) <= 1) {
    auto('principalProducts.HIGHEST_TURNOVER', num(pp.CATEGORY_TURNOVER));
    auto('principalProducts.HIGHEST_DESC', pp.CATEGORY_DESC);
  }
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
  if (num(state.shareCapital.PAID_UP_NOMINAL) <= 0) err('shareCapital.PAID_UP_NOMINAL', 'Paid-up capital is required (fetch it from Sandbox or enter it).');
  if (num(bs.current.SHARE_CAPITAL) !== num(state.shareCapital.PAID_UP_NOMINAL)) warn('balanceSheet.current.SHARE_CAPITAL', 'Share capital on the balance sheet differs from paid-up capital.');
  if (!state.principalProducts.CATEGORY_CODE) err('principalProducts.CATEGORY_CODE', 'Product / service category code (NPCS 4-digit) is required.');
  if (!state.principalProducts.HIGHEST_CODE) err('principalProducts.HIGHEST_CODE', 'Highest-turnover product / service code (8-digit) is required.');
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
    principalProducts: { TOTAL_CATEGORIES: num(s.principalProducts.TOTAL_CATEGORIES), CATEGORY_CODE: String(s.principalProducts.CATEGORY_CODE), CATEGORY_DESC: s.principalProducts.CATEGORY_DESC, CATEGORY_TURNOVER: num(s.principalProducts.CATEGORY_TURNOVER), HIGHEST_CODE: String(s.principalProducts.HIGHEST_CODE), HIGHEST_DESC: s.principalProducts.HIGHEST_DESC, HIGHEST_TURNOVER: num(s.principalProducts.HIGHEST_TURNOVER) },
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
// Loads an existing client JSON (extension schema) into the form.
function loadClientJson(c, source = 'manual') {
  const s = blankState();
  const mark = (path, v) => { setPath(s, path, v); s.sources[path] = source; };
  const copy = (section, obj) => { for (const [k, v] of Object.entries(obj || {})) if (k in s[section] || section !== 'general') mark(`${section}.${k}`, v); };
  copy('general', c.general); copy('subsidiary', c.subsidiary); copy('auditor', c.auditor); copy('industry', c.industry);
  copy('costRecords', c.costRecords); copy('principalProducts', c.principalProducts); copy('relatedParty', c.relatedParty); copy('auditorReport', c.auditorReport); copy('csr', c.csr); copy('secretarialAudit', c.secretarialAudit);
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
const SETTINGS_DEFAULTS = { sbEnv: 'https://test-api.sandbox.co.in', sbVersion: '', sbKey: '', sbSecret: '', llmProvider: 'anthropic', llmKey: '', extId: '' };

/* ═══ Which MCA form the dashboard is preparing ═══
   Keys are the extension's form types: aoc4, aoc4_offline, spice_a, inc32, dir3. AOC-4 uses the engine in
   this file; the other four use js/form-flow.js. Every form is handed to the Germin8 extension with
   chrome.runtime.sendMessage (action importClient + formType). */
let currentForm = LS.get('aoc4Dashboard_currentForm', 'aoc4');
if (!FORM_DEFS[currentForm]) currentForm = 'aoc4';
window.AOC4_DB_CURRENT_FORM = currentForm;
function setCurrentForm(f) {
  if (!FORM_DEFS[f]) return;
  currentForm = f;
  window.AOC4_DB_CURRENT_FORM = f;
  LS.set('aoc4Dashboard_currentForm', f);
  const def = FORM_DEFS[f];
  const t = document.getElementById('formTag'); if (t) t.textContent = def.label;
  try { document.title = `Germin8 · ${def.label}`; } catch (_) {}
  FormFlow.onFormChange();
}
const savedSettings = LS.get('aoc4_settings', {});
let settings = Object.assign({}, SETTINGS_DEFAULTS, savedSettings);
// config.local.js (git-ignored, optional) carries this machine's keys so nobody retypes them.
// Anything the user saved in Settings wins; the file only replaces values still at their default.
{
  const cfg = window.AOC4_LOCAL_CONFIG || {};
  const fromFile = {
    sbEnv: cfg.sandbox?.env, sbKey: cfg.sandbox?.key, sbSecret: cfg.sandbox?.secret, sbVersion: cfg.sandbox?.version,
    llmProvider: cfg.ai?.provider, llmKey: cfg.ai?.key, extId: cfg.extensionId
  };
  for (const [k, v] of Object.entries(fromFile)) {
    if (!v) continue;
    const userChose = Object.prototype.hasOwnProperty.call(savedSettings, k) && savedSettings[k] !== '' && savedSettings[k] !== SETTINGS_DEFAULTS[k];
    if (!userChose) settings[k] = v;
  }
}
(function migrateOldCreds() { const old = LS.get('aoc4_sb_creds', null); if (old && !settings.sbKey) { settings.sbEnv = old.env || settings.sbEnv; settings.sbVersion = old.version || ''; settings.sbKey = old.key || ''; settings.sbSecret = old.secret || ''; LS.set('aoc4_settings', settings); } })();
let firm = LS.get('aoc4_firm', null);
const draftKey = () => `aoc4_draft_${currentForm}_${state.general.CIN || 'new'}_${state.meta.fy || 'nofy'}`;
function listDrafts() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('aoc4_draft_')) continue;
    const d = LS.get(k, null); if (!d) continue;
    // Keys are either `aoc4_draft_<CIN>_<FY>` (legacy) or `aoc4_draft_<form>_<CIN>_<FY>` (new).
    const rest = k.slice('aoc4_draft_'.length).split('_');
    const form = FORM_DEFS[rest[0]] ? rest[0] : 'aoc4';
    out.push({ key: k, name: d.meta?.companyName || d.general?.CIN || 'Unnamed', fy: d.meta?.fy || '', savedAt: d._savedAt || 0, form });
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}
let currentDraftKey = null;
const autosave = debounce(() => {
  const key = draftKey();
  if (currentDraftKey && currentDraftKey !== key) LS.del(currentDraftKey);
  currentDraftKey = key;
  state._savedAt = Date.now();
  if (LS.set(key, state)) { LS.set('aoc4_last_draft', key); $('#saveState').textContent = `Draft saved ${new Date().toLocaleTimeString()}`; renderClientList(); }
}, 800);
function renderClientList() {
  if (currentForm !== 'aoc4') return FormFlow.renderClientList();
  const sel = $('#clientSelect');
  const drafts = listDrafts();
  const formLabel = f => (FORM_DEFS[f]?.label || f);
  sel.innerHTML = '<option value="">New client</option>' + drafts.map(d => {
    const tag = d.form && d.form !== currentForm ? ` · ${esc(formLabel(d.form))}` : '';
    return `<option value="${esc(d.key)}" ${d.key === currentDraftKey ? 'selected' : ''}>${esc(d.name)}${d.fy ? ` — FY ${esc(d.fy)}` : ''}${tag}</option>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════════
   Rendering
   ═══════════════════════════════════════════════════════════════════ */
let PANELS = ['data', 'sandbox', 'upload', 'review'];   // replaced per form by FormFlow.onFormChange()
const PANEL_TEXT = {
  data: ['Data Entry', 'Fill what you know; dependent values are derived automatically and marked auto.'],
  sandbox: ['Sandbox lookup', 'Enter a CIN or search by name to pull the company master data from MCA.'],
  upload: ['Upload & AI', 'Upload the financial statements; AI proposes values which you accept into the form.'],
  review: ['Review & Send', 'Fix the checks, confirm the JSON, then hand it to the extension.']
};
let activePanel = 'data';
function showPanel(name) {
  if (!PANELS.includes(name)) name = 'data';
  activePanel = name;
  $$('.nav button').forEach(b => b.classList.toggle('active', b.dataset.panel === name));
  $$('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${name}`));
  const text = currentForm === 'aoc4' ? PANEL_TEXT[name] : FormFlow.panelText(name);
  $('#panelTitle').textContent = text[0];
  $('#panelSub').textContent = text[1];
  $('#prevPanel').disabled = PANELS.indexOf(name) === 0;
  $('#nextPanel').textContent = name === 'review' ? 'Download JSON' : 'Next';
  $('#nextPanel').dataset.final = name === 'review' ? '1' : '';
  location.hash = name;
  window.scrollTo(0, 0);
  if (name === 'review') renderReview();
}

// Badges mark values the user did not type: auto, computed, sandbox, AI. A hand-typed value is
// labelled "manual" only when it overrides a derived one, and then offers "↺ auto" to go back.
function badgeHtml(path) {
  const s = srcOf(path);
  if (!s) return '';
  const derivable = derivablePaths.has(path);
  if (s === 'manual' && !derivable) return '';
  const label = s === 'auto' ? 'auto' : s === 'sandbox' ? 'sandbox' : s === 'ai' ? 'AI' : s === 'doc' ? 'doc' : s === 'computed' ? 'computed' : 'manual';
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
  else if (o.type === 'number') control = `<input class="in num" type="text" inputmode="decimal" id="${id}" data-path="${path}" data-type="number" value="${v === '' || v == null ? '' : v}" ${o.readonly ? 'readonly' : ''}>`;
  else if (o.type === 'textarea') control = `<textarea class="ta" id="${id}" data-path="${path}">${esc(v)}</textarea>`;
  else control = `<input class="in" type="text" id="${id}" data-path="${path}" value="${esc(v)}" ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ''} ${o.readonly ? 'readonly' : ''} ${o.upper ? 'style="text-transform:uppercase"' : ''} ${o.maxlength ? `maxlength="${o.maxlength}"` : ''}>`;
  return `<div class="f ${o.span ? 'span' + o.span : ''}"><label for="${id}">${label}${req}<span class="badges" data-badges="${path}">${badgeHtml(path)}</span></label>${control}${o.hint ? `<span class="hint">${o.hint}</span>` : ''}</div>`;
}
const YESNO = ['Yes', 'No'];
function fyOptions() { const y = today().getFullYear(); const out = []; for (let i = y; i >= y - 6; i--) out.push([`${i}-${String(i + 1).slice(2)}`, `FY ${i}-${String(i + 1).slice(2)}`]); return out; }
function periodTable(sectionPath, rows, opts = {}) {
  const cur = state.balanceSheet.current.asOf || 'Current', prev = state.balanceSheet.previous.asOf || 'Previous';
  const body = rows.map(([group, key, label]) => {
    const g = group ? `<tr class="group"><td colspan="3">${esc(group)}</td></tr>` : '';
    const p = opts.nested ? `${sectionPath}.${key}` : `${sectionPath}`;
    const cell = per => { const path = opts.nested ? `${p}.${per}` : `${sectionPath}.${per}.${key}`; return `<td class="num"><input class="in num" type="text" inputmode="decimal" data-path="${path}" data-type="number" value="${getPath(state, path) ?? 0}"></td>`; };
    return `${g}<tr><td class="lbl">${esc(label)}${badgeHtml(opts.nested ? `${p}.current` : `${sectionPath}.current.${key}`)}</td>${cell('current')}${cell('previous')}</tr>`;
  }).join('');
  return `<div class="scroll-x"><table class="tbl"><thead><tr><th style="width:55%">Particulars</th><th class="num">${esc(cur)}</th><th class="num">${esc(prev)}</th></tr></thead><tbody>${body}${opts.footer || ''}</tbody></table></div>`;
}
function computedRow(label, keyCur, keyPrev, cls = 'total') { return `<tr class="${cls}"><td class="lbl">${esc(label)} <span class="badge computed">computed</span></td><td class="num computed" data-computed="${keyCur}">${fmtINR(num(getPath(state, keyCur)))}</td><td class="num computed" data-computed="${keyPrev}">${fmtINR(num(getPath(state, keyPrev)))}</td></tr>`; }
function singleTable(sectionPath, rows) {
  return `<div class="scroll-x"><table class="tbl compact"><tbody>${rows.map(([key, label]) => `<tr><td class="lbl" style="width:70%">${esc(label)}${badgeHtml(`${sectionPath}.${key}`)}</td><td class="num"><input class="in num" type="text" inputmode="decimal" data-path="${sectionPath}.${key}" data-type="number" value="${getPath(state, `${sectionPath}.${key}`) ?? 0}"></td></tr>`).join('')}</tbody></table></div>`;
}
function sigTable(which) {
  const rows = state[which];
  const canEdit = which === 'signatoriesFS' || !state.meta.brSameAsFs;
  return `<div class="scroll-x"><table class="tbl compact"><thead><tr><th style="width:150px">DIN / PAN</th><th>Name <span class="muted" style="text-transform:none;letter-spacing:0">(optional — MCA fills it from the DIN)</span></th><th style="width:170px">Designation</th><th style="width:160px">Date signed</th><th style="width:40px"></th></tr></thead><tbody>` +
    rows.map((r, i) => `<tr>
      <td><input class="in" data-path="${which}.${i}.din" maxlength="10" value="${esc(r.din)}" ${canEdit ? '' : 'readonly'} placeholder="08302207"></td>
      <td><input class="in" data-path="${which}.${i}.name" value="${esc(r.name)}" ${canEdit ? '' : 'readonly'}></td>
      <td><select class="sel" data-path="${which}.${i}.designation" ${canEdit ? '' : 'disabled'}>${['Director', 'Managing Director', 'CEO', 'CFO', 'Manager', 'Secretary', 'IRP', 'RP', 'Liquidator'].map(d => `<option ${r.designation === d ? 'selected' : ''}>${d}</option>`).join('')}</select></td>
      <td><input class="in" type="date" data-path="${which}.${i}.date" data-type="date" value="${toISO(r.date)}" ${canEdit ? '' : 'readonly'}></td>
      <td>${canEdit && rows.length > 1 ? `<button class="btn sm" data-remove-sig="${which}:${i}" title="Remove"><svg class="ico" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}</td>
    </tr>`).join('') + `</tbody></table></div>` +
    (canEdit ? `<button class="btn sm mt8" data-add-sig="${which}"><svg class="ico" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add signatory</button>` : '');
}
function block(id, title, meta, body, open = true) {
  return `<details class="block" id="blk-${id}" ${open ? 'open' : ''}><summary><span><svg class="chev" viewBox="0 0 24 24" style="stroke:currentColor;fill:none;stroke-width:2"><polyline points="9 18 15 12 9 6"/></svg><span class="block-title">${title}</span></span><span class="block-meta">${meta || ''}</span></summary><div class="block-body">${body}</div></details>`;
}
const openBlocks = new Set(['company', 'dates', 'signatories', 'auditor', 'industry', 'bs', 'pl', 'sc']);
function renderDataEntry() {
  const g = state.general;
  const html = [
    block('company', 'Company & financial year', 'CIN, FY, capital', `
      <div class="grid">
        ${field('general.CIN', 'CIN', { required: true, upper: true, maxlength: 21, placeholder: 'U80904KA2018PTC119370', hint: 'Or fetch it in Sandbox lookup.' })}
        <div class="f"><label>Company name ${badgeHtml('meta.companyName')}</label><input class="in" data-path="meta.companyName" value="${esc(state.meta.companyName)}" placeholder="As per MCA"></div>
        ${field('meta.fy', 'Financial year', { type: 'select', required: true, options: [['', 'Select…'], ...fyOptions()] })}
        ${field('general.FY_FROM', 'FY from', { type: 'date' })}
        ${field('general.FY_TO', 'FY to', { type: 'date' })}
        ${field('shareCapital.PAID_UP_NOMINAL', 'Paid-up capital (₹)', { type: 'number', required: true, hint: 'From MCA master data when fetched.' })}
        ${field('shareCapital.AUTH_NOMINAL', 'Authorised capital (₹)', { type: 'number' })}
        ${field('shareCapital.FACE_VALUE', 'Face value per share (₹)', { type: 'number', hint: 'Used to compute the number of shares and EPS.' })}
        ${field('shareCapital.PAID_UP_SHARES', 'Paid-up shares', { type: 'number', readonly: true })}
        <div class="f span2"><label>Registered office ${badgeHtml('meta.registeredAddress')}</label><input class="in" data-path="meta.registeredAddress" value="${esc(state.meta.registeredAddress)}" placeholder="MCA fills this on the form from the CIN"></div>
        <div class="f"><label>Company class ${badgeHtml('meta.companyClass')}</label><input class="in" data-path="meta.companyClass" value="${esc(state.meta.companyClass)}" placeholder="Private / Public / OPC"><span class="hint">OPC changes the AGM due-date rule.</span></div>
      </div>`),
    block('dates', 'Dates, nature of statements & AGM', 'Q3–Q7', `
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
    block('signatories', 'Signatories', '4(c) and 5(b)', `
      <div class="block-meta mb12">Financial statements (4c)</div>${sigTable('signatoriesFS')}
      <div class="mt16 mb12" style="display:flex;justify-content:space-between;align-items:center"><span class="block-meta">Board’s report (5b)</span>
        <label class="toggle"><input type="checkbox" id="brSame" ${state.meta.brSameAsFs ? 'checked' : ''}> Same people as the financial statements</label></div>
      ${sigTable('signatoriesBR')}`),
    block('auditor', 'Auditor', 'Q9 — MCA fills most of this from the ADT-1 SRN', `
      <div class="btn-row mb12">
        <button class="btn sm" id="applyFirm" ${firm ? '' : 'disabled'}>${firm ? `Use my firm: ${esc(firm.AUDITOR_NAME || 'saved firm')}` : 'Save your firm in Settings to apply it with one click'}</button>
        <button class="btn sm" id="saveFirm">Save these auditor details as my firm</button>
      </div>
      <div class="grid">
        ${field('auditor.ADT_SRN', 'SRN of Form ADT-1', { required: true, upper: true, placeholder: 'AC0363504' })}
        ${field('auditor.NUM_AUDITORS', 'Number of auditors', { type: 'number' })}
        ${AUDITOR_FIELDS.map(([k, label, type, options]) => type === 'select' ? field(`auditor.${k}`, label, { type: 'select', options }) : type === 'pin' ? field(`auditor.${k}`, label, { maxlength: 6, hint: 'Area, city, district and state are looked up from the PIN.' }) : field(`auditor.${k}`, label, { upper: k === 'AUDITOR_PAN' })).join('')}
      </div>`),
    block('industry', 'Industry, books of account & other declarations', 'Q8, Q10–12, segments III–VI', `
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
      <div class="mt16 mb12" style="display:flex;justify-content:space-between;align-items:center"><span class="block-meta">12(b) Address where the servers are kept</span><button class="btn sm" id="serverFromRegistered" ${state.meta.registeredAddress ? '' : 'disabled'}>Same as registered office</button></div>
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
      </div>`),
    block('bs', 'Balance sheet', 'Part B — absolute rupees', `
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
      </div>
      ${block('bsbreakup', 'Break-up of figures (II A–E)', 'Trade receivables follow the balance sheet; everything else is 0 unless you edit it', periodTable('balanceSheetBreakup', BREAKUP, { nested: true }), false)}
      ${block('fpbs', 'Financial parameters — balance sheet items (III 1–47)', 'All 0 unless you edit them', singleTable('financialParametersBS', FP_BS), false)}`),
    block('pl', 'Profit and loss', 'Segment II — absolute rupees', `
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
        ${field('principalProducts.TOTAL_CATEGORIES', 'Number of categories', { type: 'number' })}
        ${field('principalProducts.CATEGORY_CODE', 'Category code (NPCS / ITC 4-digit)', { required: true, placeholder: '9992' })}
        ${field('principalProducts.CATEGORY_DESC', 'Category description', { placeholder: 'EDUCATION SERVICES' })}
        ${field('principalProducts.CATEGORY_TURNOVER', 'Turnover of category (₹)', { type: 'number' })}
        ${field('principalProducts.HIGHEST_CODE', 'Highest-turnover code (8-digit)', { required: true, placeholder: '99929199' })}
        ${field('principalProducts.HIGHEST_DESC', 'Highest-turnover description')}
        ${field('principalProducts.HIGHEST_TURNOVER', 'Turnover of highest (₹)', { type: 'number' })}
      </div>
      ${block('pldetail', 'Detailed profit and loss items (II)', 'Mirrors the inputs above; edit to split further', periodTable('profitLossDetails', PL_DETAIL, { nested: true }), false)}
      ${block('fx', 'Foreign exchange earnings and expenditure', 'All 0 unless you edit them', periodTable('foreignExchange', FX, { nested: true }), false)}
      ${block('fppl', 'Financial parameters — P&amp;L items (III)', 'EPS and foreign-currency totals are derived', singleTable('financialParametersPL', FP_PL), false)}`),
    block('sc', 'Share capital raised during the year', 'IV — opening balance follows paid-up capital', scTable(), false)
  ].join('');
  $('#dataSections').innerHTML = html;
  // Restore open/closed state of blocks
  $$('#dataSections details.block').forEach(d => { const id = d.id.replace('blk-', ''); d.open = openBlocks.has(id); d.addEventListener('toggle', () => { if (d.open) openBlocks.add(id); else openBlocks.delete(id); }); });
  renderBsBalance();
}
function scTable() {
  const row = (label, base, cols) => `<tr><td class="lbl">${esc(label)}</td>${cols.map(c => `<td class="num"><input class="in num" type="text" inputmode="decimal" data-path="shareCapitalRaised.${base}_${c}" data-type="number" value="${getPath(state, `shareCapitalRaised.${base}_${c}`) ?? 0}"></td>`).join('')}${cols.length === 3 ? '<td></td>' : ''}</tr>`;
  const section = (cls, title) => {
    const m = SC_MOVES[cls];
    return `<tr class="group"><td colspan="5">${title}</td></tr>` + row('At the beginning of the year', m.begin, ['SHARES', 'NOMINAL', 'PAID']) +
      `<tr class="group"><td colspan="5">Increase during the year</td></tr>` + m.inc.map(id => row(SC_LABEL[id], `SC_${cls}_INC_${id}`, ['SHARES', 'NOMINAL', 'PAID', 'PREMIUM'])).join('') +
      `<tr class="group"><td colspan="5">Decrease during the year</td></tr>` + m.dec.map(id => row(SC_LABEL[id], `SC_${cls}_DEC_${id}`, ['SHARES', 'NOMINAL', 'PAID', 'PREMIUM'])).join('');
  };
  return `<div class="scroll-x"><table class="tbl compact"><thead><tr><th>Particulars</th><th class="num">Number of shares</th><th class="num">Nominal amount</th><th class="num">Paid-up amount</th><th class="num">Premium</th></tr></thead><tbody>${section('EQ', '(i) Equity shares')}${section('PREF', '(ii) Preference shares')}</tbody></table></div>`;
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
    const sv = v == null ? '' : String(v);
    if (el.value !== sv) el.value = sv;
  });
  $$('[data-computed]').forEach(el => { el.textContent = fmtINR(num(getPath(state, el.dataset.computed))); });
  $$('[data-badges]').forEach(el => { el.innerHTML = badgeHtml(el.dataset.badges); });
  renderBsBalance();
}
let structureKey = '';
function structureSignature() {
  return [state.general.AGM_EXTENSION, state.subsidiary.IS_SUBSIDIARY, state.industry.MAINTAIN_ELECTRONIC_BOOKS, state.industry.MAINTAINED_ON_CLOUD, state.financialParametersBS.OPERATING_LEASE_CONVERTED, state.meta.brSameAsFs, state.signatoriesFS.length, state.signatoriesBR.length, state.balanceSheet.current.asOf, state.balanceSheet.previous.asOf, !!firm, !!state.meta.registeredAddress].join('|');
}
function render(full = false) {
  const sig = structureSignature();
  if (full || sig !== structureKey || !$('#dataSections').children.length) { structureKey = sig; renderDataEntry(); }
  else refreshValues();
  const { errors, warnings } = validate();
  const total = $$('#panel-data [data-path]').length, filled = $$('#panel-data [data-path]').filter(el => el.tagName === 'SELECT' ? true : String(el.value || '').trim() !== '' && el.value !== '0').length;
  $('#cnt-data').textContent = `${filled}/${total}`;
  $('#cnt-sandbox').innerHTML = state.sources['general.CIN'] === 'sandbox' ? iconSvg('check') : '';
  $('#cnt-sandbox').className = 'count ok';
  $('#cnt-upload').textContent = uploadedFiles.length ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}` : '';
  $('#cnt-review').textContent = errors.length ? `${errors.length} error${errors.length > 1 ? 's' : ''}` : warnings.length ? `${warnings.length} warn` : (state.meta.fy ? 'ready' : '');
  $('#cnt-review').className = 'count ' + (errors.length ? 'err' : warnings.length ? '' : 'ok');
  $('#companyTag').textContent = [state.meta.companyName, state.meta.fy ? `FY ${state.meta.fy}` : ''].filter(Boolean).join(' · ');
  if (currentForm !== 'aoc4') FormFlow.updateCounts();
  if (activePanel === 'review') renderReview();
}
function afterChange() { derive(); render(); autosave(); }

/* ═══════════════════════════════════════════════════════════════════
   Input binding
   ═══════════════════════════════════════════════════════════════════ */
function readControl(el) {
  if (el.dataset.type === 'date') return fromISO(el.value);
  if (el.dataset.type === 'number') { const t = el.value.trim(); return t === '' ? 0 : (Number.isFinite(Number(t.replace(/,/g, ''))) ? Number(t.replace(/,/g, '')) : t); }
  return el.value;
}
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset?.path) return;
  if (el.tagName === 'SELECT' || el.dataset.type === 'date') return; // handled on change
  setValue(el.dataset.path, readControl(el), 'manual');
  derive(); refreshValues(); autosave();
  if (el.dataset.path === 'meta.companyName' || el.dataset.path === 'general.CIN') $('#companyTag').textContent = [state.meta.companyName, state.meta.fy ? `FY ${state.meta.fy}` : ''].filter(Boolean).join(' · ');
});
document.addEventListener('change', e => {
  const el = e.target; if (!el.dataset?.path) return;
  const path = el.dataset.path;
  setValue(path, readControl(el), 'manual');
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
  if (t.dataset.focus) { focusField(t.dataset.focus); return; }
  if (t.id === 'brSame') return;
  if (t.id === 'applyFirm' && firm) { for (const [k] of AUDITOR_FIELDS) if (firm[k] !== undefined) setValue(`auditor.${k}`, firm[k], 'manual'); afterChange(); toast('Firm details applied'); return; }
  if (t.id === 'saveFirm') { firm = {}; for (const [k] of AUDITOR_FIELDS) firm[k] = state.auditor[k]; LS.set('aoc4_firm', firm); render(true); toast('Saved as my firm'); return; }
  if (t.id === 'serverFromRegistered') { applyRegisteredAsServer(); return; }
});
document.addEventListener('change', e => { if (e.target.id === 'brSame') { state.meta.brSameAsFs = e.target.checked; if (!e.target.checked && !state.signatoriesBR.length) state.signatoriesBR = clone(state.signatoriesFS); afterChange(); } });
function focusField(path) {
  if (currentForm !== 'aoc4') return FormFlow.focusField(path);
  const panel = path.startsWith('meta.fy') || !path.startsWith('meta') ? 'data' : 'data';
  showPanel(panel);
  const el = $(`[data-path="${CSS.escape(path)}"]`) || $(`[data-path^="${CSS.escape(path)}"]`);
  if (el) { const blk = el.closest('details.block'); if (blk) blk.open = true; el.scrollIntoView({ block: 'center' }); el.focus(); el.classList.add('invalid'); setTimeout(() => el.classList.remove('invalid'), 2500); }
}
function applyRegisteredAsServer() {
  const addr = String(state.meta.registeredAddress || '').replace(/\s+/g, ' ').trim();
  if (!addr) return toast('No registered office address yet — fetch the company in Sandbox lookup first.', true);
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
   Lookups: India Post PIN, Sandbox MCA
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

let sbToken = null;
async function sandboxAuthenticate() {
  if (!settings.sbKey || !settings.sbSecret) throw new Error('Add the Sandbox API key and secret in Settings first.');
  if (sbToken && sbToken.env === settings.sbEnv && Date.now() < sbToken.expiresAt) return sbToken.token;
  const headers = sandboxHeadersForProxy(); headers['x-api-secret'] = settings.sbSecret;
  const resp = await fetch('/api/sandbox/authenticate', { method: 'POST', headers });
  const data = await readSandboxResponse(resp, 'Sandbox authentication failed');
  const token = data?.data?.access_token;
  if (!token) throw new Error('Sandbox did not return an access token');
  sbToken = { token, env: settings.sbEnv, expiresAt: Date.now() + 23 * 3600 * 1000 };
  return token;
}
function sandboxHeadersForProxy() {
  const h = { 'x-api-key': settings.sbKey, 'x-sandbox-environment': settings.sbEnv.includes('test-api') ? 'test' : 'production' };
  if (settings.sbVersion) h['x-api-version'] = settings.sbVersion;
  return h;
}
async function readSandboxResponse(resp, label) {
  const raw = await resp.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { message: raw.slice(0, 240) }; }
  if (!resp.ok) {
    const detail = data?.error || data?.message || data?.message?.[0]?.msg || raw.slice(0, 200);
    throw new Error(`${label} (${resp.status})${detail ? `: ${detail}` : ''}`);
  }
  return data;
}
async function sbHeaders() {
  const token = await sandboxAuthenticate();
  const h = sandboxHeadersForProxy(); h.Authorization = token; h['Content-Type'] = 'application/json';
  return h;
}
function normalizeSandboxCompany(data) {
  return {
    ...data,
    cin: data.cin || data.llpin || '',
    company_name: data.company_name || data.llp_name || '',
    registered_office_address: data.registered_address || data.registered_office_address || '',
    company_class: data.class_of_company || data.company_class || '',
    company_status: data['company_status(for_efiling)'] || data.company_status || data.llp_status || '',
    company_category: data.company_category || '',
    company_sub_category: data.company_subcategory || data.company_sub_category || '',
    company_roc_code: data.roc_code || data.company_roc_code || '',
    company_registration_date: data.date_of_incorporation || data.company_registration_date || '',
    authorized_capital: data['authorised_capital(rs)'] ?? data.authorized_capital ?? data.authorized_capital_rs,
    paidup_capital: data['paid_up_capital(rs)'] ?? data.paidup_capital ?? data.paid_up_capital_rs,
    company_industrial_classification: data.description_of_main_division || data.company_industrial_classification || ''
  };
}
async function fetchCompanyMasterData(cin) {
  // Sandbox's schema for this endpoint is exactly {"cin": "..."} with additionalProperties: false —
  // an "@entity", "id", "consent" or "reason" key makes it answer 400 "Invalid request body".
  const id = String(cin || '').trim().toUpperCase();
  if (!/^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(id)) {
    throw new Error('That is not a valid 21-character CIN (for example U80904KA2018PTC119370).');
  }
  const body = { cin: id };
  const resp = await fetch('/api/sandbox/mca/company-master-data', { method: 'POST', headers: await sbHeaders(), body: JSON.stringify(body) });
  const json = await readSandboxResponse(resp, 'Company master data lookup failed');
  const data = Array.isArray(json.data) ? json.data[0] : json.data;
  if (!data) throw new Error('No master data returned');
  return normalizeSandboxCompany(data);
}
async function searchCompany(name) {
  // Sandbox's documented Company Master Data endpoint is CIN/LLPIN based.
  // Name search is therefore limited to companies previously saved in this browser.
  return Object.values(getMasterList()).filter(c => String(c.company_name || '').toLowerCase().includes(name.toLowerCase()))
    .map(c => ({ cin: c.cin, company_name: c.company_name }));
}
function getMasterList() { return LS.get('aoc4_company_master_list', {}); }
function applyMasterData(d) {
  if (currentForm !== 'aoc4') return FormFlow.applyMaster(d);
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
    fetchBtn.disabled = true; $('#sbStatus').innerHTML = '<span class="spin"></span> Fetching from MCA via Sandbox…';
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
      $('#sbStatus').innerHTML = recs.length ? '' : '<div class="note">No saved company matches that name. Sandbox master-data lookup needs a CIN; switch to By CIN or look up and save the company first.</div>';
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
  add('financialParametersBS.NET_WORTH', 'Net worth of the company at year end (Rs)', 'number'); add('financialParametersBS.GROSS_PPE_INTANGIBLE', 'Gross block of PPE and intangible assets at year end (Rs)', 'number'); add('financialParametersBS.DEPRECIATION_AMORTIZATION_BS', 'Accumulated depreciation and amortisation at year end (Rs)', 'number');
  add('financialParametersBS.OPERATING_LEASE_CONVERTED', 'Whether an operating lease was converted to a finance lease', 'select', YESNO);
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
  const m = /^(balanceSheet|profitLoss)\.(current|previous)\.(.+)$/.exec(path);
  if (m) { const base = catalogIndex.get(`${m[1]}.${m[3]}`); if (base) return { ...base, path, label: base.label.replace(/ \(give period_end.*\)$/, '') + (m[2] === 'current' ? ' · current year' : ' · previous year') }; }
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
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      doc.sheets = wb.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' }).slice(0, 600) }));
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
      doc.scanned = doc.text.replace(/[^A-Za-z0-9]/g, '').length < 60 * pdf.numPages;   // no text layer: only the model (vision) can read it
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
  $('#extractBtn').disabled = !ready.length || (onlyImages && !settings.llmKey);
  const useAi = $('#useAi');
  useAi.disabled = !settings.llmKey;
  if (!settings.llmKey) useAi.checked = false; else if (!useAi.dataset.touched) useAi.checked = true;
  useAi.onchange = () => { useAi.dataset.touched = '1'; };
  const provider = { anthropic: 'Claude (claude-opus-5-5)', openai: 'OpenAI', gemini: 'Gemini' }[settings.llmProvider] || settings.llmProvider;
  $('#aiProviderTag').textContent = settings.llmKey ? `AI: ${provider} · key saved` : 'Rules only — add an AI API key in Settings to also ask the model';
}

/* ---- running the extraction ---- */
async function runExtraction() {
  if (currentForm !== 'aoc4') return FormFlow.runExtraction();
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
    if ($('#useAi').checked && settings.llmKey) {
      status(`<span class="spin"></span> Asking ${settings.llmProvider === 'anthropic' ? 'Claude' : settings.llmProvider}… this can take a minute for long statements`);
      try { aiOut = await extractWithModel(ready, fy); aiNorm = AOC4Extract.normalizeAiOutput(aiOut, aiCatalog(), fy); }
      catch (e) { aiError = e.message; }
    }
    const merged = AOC4Extract.mergeProposals(rules.proposals, aiNorm.proposals);
    proposals = merged.map(p => { const c = catalogEntry(p.path); return { ...p, label: c.label, type: c.type, options: c.options, current: getPath(state, p.path) }; })
      .filter(p => p.type !== 'number' || typeof p.value === 'number')
      .sort((a, b) => sectionRank(a.path) - sectionRank(b.path) || a.label.localeCompare(b.label));
    proposalSigs = { FS: rules.signatoriesFS.length ? rules.signatoriesFS : aiNorm.signatoriesFS, BR: aiNorm.signatoriesBR };
    if (proposalSigs.FS.length) proposals.push({ path: 'signatoriesFS', label: rules.signatoriesCarried ? "Signatories (last year's — confirm and add this year's signing dates)" : 'Signatories of the financial statements', type: 'signatories', value: proposalSigs.FS.map(s => ({ din: s.din, name: s.name, designation: s.designation, date: s.date })), current: state.signatoriesFS, confidence: rules.signatoriesCarried ? 0.5 : rules.signatoriesFS.length ? 0.85 : 0.7, sources: rules.signatoriesFS.length ? ['rules'] : ['ai'], evidence: { file: proposalSigs.FS[0].file || '', where: '', quote: proposalSigs.FS.map(s => `${s.name} (DIN ${s.din})`).join(', ') } });
    lastExtraction = { rules, aiNorm, aiError, files: ready.map(d => d.name) };
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
  if (aiNorm.notes.length) notes.push(`<div class="note">Model notes: ${aiNorm.notes.map(esc).join(' · ')}</div>`);
  const scanned = docs.filter(d => d && d.scanned).map(d => d.name);
  if (scanned.length && !(settings.llmProvider === 'anthropic' && settings.llmKey && $('#useAi').checked)) notes.push(`<div class="note warn">${scanned.map(esc).join(', ')} ${scanned.length > 1 ? 'have' : 'has'} no text layer (scanned). Only Claude can read it — save an Anthropic key in Settings and tick "Also ask the AI model".</div>`);
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
    const sec = p.group || p.path.split('.')[0];
    if (sec !== section) { section = sec; html += `<tr class="group"><td colspan="6">${esc(p.group || SECTION_TITLES[sec] || sec)}</td></tr>`; }
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
  if (currentForm !== 'aoc4') return FormFlow.applyProposals();
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
}

/* ---- the model call: Claude reads PDFs/images natively; other providers get the extracted text ---- */
function toBase64(bytes) { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
function parseJsonLoose(text) {
  try { return JSON.parse(text); } catch (_) { /* fall through */ }
  const m = String(text).match(/\{[\s\S]*\}/); if (!m) throw new Error('The model did not return JSON');
  return JSON.parse(m[0]);
}
async function extractWithModel(ready, fy) {
  const { llmProvider: provider } = settings;
  const catalog = aiCatalog();
  const system = AOC4Extract.extractionSystemPrompt(fy);
  const schema = AOC4Extract.extractionSchema();
  const textDocs = ready.filter(d => d.text).map(d => `=== ${d.name} (${TYPE_LABEL[d.type] || d.type}) ===\n${d.text.slice(0, 150000)}`).join('\n\n');
  const context = { financialYear: fy, company: state.meta.companyName, cin: state.general.CIN, attachedInFull: provider === 'anthropic' ? ready.filter(d => d.bytes).map(d => d.name) : [] };
  const user = AOC4Extract.extractionUserText(catalog, textDocs || '(no text could be extracted; read the attached files)', context);
  return callModel({ system, user, schema, schemaName: 'aoc4_extraction', attachments: ready });
}
// One structured call to the model provider chosen in Settings. Claude reads PDFs/images natively;
// the other providers get the text the app extracted.
async function callModel({ system, user, schema, schemaName, attachments, plainHint }) {
  const { llmProvider: provider, llmKey: apiKey } = settings;
  if (provider === 'anthropic') return callClaude({ apiKey, system, user, schema, attachments: attachments.filter(d => d.bytes), plainHint });
  if (provider === 'openai') {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: 'gpt-4o', max_tokens: 16000, response_format: { type: 'json_schema', json_schema: { name: schemaName, schema } }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
    if (!resp.ok) throw new Error(`OpenAI API ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    return parseJsonLoose((await resp.json()).choices?.[0]?.message?.content || '');
  }
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system_instruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { maxOutputTokens: 16384, responseMimeType: 'application/json' } }) });
  if (!resp.ok) throw new Error(`Gemini API ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  return parseJsonLoose((await resp.json()).candidates?.[0]?.content?.parts?.[0]?.text || '');
}
async function callClaude({ apiKey, system, user, schema, attachments, plainHint }) {
  const url = 'https://api.anthropic.com/v1/messages';
  const content = [];
  let bytes = 0;
  for (const d of attachments) {
    if (bytes + d.bytes.length > 28 * 1024 * 1024) break;          // request limit is 32 MB; the text of the rest is in the prompt anyway
    bytes += d.bytes.length;
    const data = toBase64(d.bytes);
    if (d.kind === 'pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data }, title: d.name });
    else content.push({ type: 'image', source: { type: 'base64', media_type: d.mime || 'image/png', data } });
  }
  content.push({ type: 'text', text: user });
  const body = { model: 'claude-opus-5-5', max_tokens: 16000, system, messages: [{ role: 'user', content }], output_config: { effort: 'high', format: { type: 'json_schema', schema } }, fallbacks: 'default' };
  const headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2026-10-21', 'anthropic-beta': 'server-side-fallback-2026-07-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  let resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (resp.status === 400) {
    const txt = await resp.text();
    if (!/output_config|format|fallbacks|anthropic-beta|unexpected|unknown/i.test(txt)) throw new Error(`Claude API 400: ${txt.slice(0, 300)}`);
    // A gateway that does not know structured output / fallbacks: ask plainly and parse the JSON from the text.
    delete body.output_config.format; delete body.fallbacks; delete headers['anthropic-beta'];
    body.system += '\n' + (plainHint || 'Return only one JSON object with the keys fields, signatoriesFS, signatoriesBR and notes, and nothing else.');
    resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  }
  if (!resp.ok) throw new Error(`Claude API ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const msg = await resp.json();
  if (msg.stop_reason === 'refusal') throw new Error(`Claude declined this request${msg.stop_details && msg.stop_details.explanation ? ': ' + msg.stop_details.explanation : ''}`);
  const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (msg.stop_reason === 'max_tokens') console.warn('Claude output was cut at max_tokens; the JSON may be incomplete');
  return parseJsonLoose(text);
}

/* ═══════════════════════════════════════════════════════════════════
   Review & send
   ═══════════════════════════════════════════════════════════════════ */
let jsonEditing = false;
const reviewJson = () => currentForm === 'aoc4' ? buildClientJson() : FormFlow.payload();
function renderReview() {
  if (currentForm !== 'aoc4') return FormFlow.renderReview();
  const { errors, warnings } = validate();
  $('#issueSummary').textContent = errors.length || warnings.length ? `${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : 'All checks passed';
  const li = (sev, i) => `<li><span class="sev ${sev}"></span><span>${esc(i.msg)}</span><a href="#" data-focus="${esc(i.path)}">Go to field</a></li>`;
  $('#issueList').innerHTML = errors.map(i => li('err', i)).concat(warnings.map(i => li('warn', i))).join('') || '<li><span class="sev" style="background:var(--ok)"></span><span>No issues. The client JSON is ready for the extension.</span></li>';
  const s = summarizeSources();
  $('#sourceChips').innerHTML = [['manual', 'entered by hand'], ['sandbox', 'from MCA (Sandbox)'], ['doc', 'read from documents'], ['ai', 'from the AI model'], ['auto', 'derived']].map(([k, label]) => `<span class="chip"><strong>${s[k]}</strong> ${label}</span>`).join('');
  if (!jsonEditing) $('#jsonPreview').textContent = JSON.stringify(buildClientJson(), null, 2);
  $('#sendBtn').disabled = errors.length > 0;
  $('#sendBtn').title = errors.length ? 'Clear the errors above first' : '';
}
function bindReview() {
  $('#issueList').addEventListener('click', e => { const a = e.target.closest('a[data-focus]'); if (a) { e.preventDefault(); focusField(a.dataset.focus); } });
  $('#jsonEditToggle').addEventListener('click', () => { jsonEditing = !jsonEditing; $('#jsonEditWrap').classList.toggle('hidden', !jsonEditing); $('#jsonPreview').classList.toggle('hidden', jsonEditing); if (jsonEditing) $('#jsonEditor').value = JSON.stringify(reviewJson(), null, 2); $('#jsonEditToggle').textContent = jsonEditing ? 'Back to preview' : 'Edit as text'; });
  $('#jsonCancel').addEventListener('click', () => { jsonEditing = false; $('#jsonEditWrap').classList.add('hidden'); $('#jsonPreview').classList.remove('hidden'); $('#jsonEditToggle').textContent = 'Edit as text'; renderReview(); });
  $('#jsonApply').addEventListener('click', () => { try { if (currentForm === 'aoc4') loadClientJson(JSON.parse($('#jsonEditor').value), 'manual'); else FormFlow.applyJson($('#jsonEditor').value); jsonEditing = false; $('#jsonEditWrap').classList.add('hidden'); $('#jsonPreview').classList.remove('hidden'); $('#jsonEditToggle').textContent = 'Edit as text'; render(true); toast('JSON applied to the form'); } catch (e) { toast(`Invalid JSON: ${e.message}`, true); } });
  $('#jsonCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(JSON.stringify(reviewJson(), null, 2)); toast('JSON copied'); } catch (_) { toast('Copy failed — select the text instead', true); } });
  $('#downloadBtn').addEventListener('click', () => downloadClientJson());
  $('#sendBtn').addEventListener('click', async () => {
    if (currentForm !== 'aoc4') return FormFlow.send();
    const json = buildClientJson();
    const note = html => { $('#sendResult').innerHTML = html; };
    const { errors } = validate(); if (errors.length) return toast('Clear the errors first', true);
    if (!settings.extId) {
      downloadClientJson();
      return note('<div class="note warn">No extension id saved, so the client was downloaded instead. Add the id in <strong>Settings → Chrome extension</strong> to send it directly.</div>');
    }
    note('<div class="note"><span class="spin"></span> Sending to the extension…</div>');
    try {
      const res = await sendToExtension({ action: 'importClient', client: json });
      autosave();
      note(`<div class="note ok"><strong>${esc(res.name || json.clientId)}</strong> is now in the extension${res.replaced ? ' (it replaced the earlier copy)' : ''}. Open the AOC-4 form on MCA, pick it in the popup and click <strong>Load &amp; Fill All Phases</strong>.</div>`);
      toast('Sent to the extension');
    } catch (e) {
      downloadClientJson();
      note(`<div class="note err"><strong>Could not reach the extension:</strong> ${esc(e.message)}<br>The client was downloaded instead — import it in the popup with <strong>Import JSON…</strong>.</div>`);
    }
  });
  $('#draftBtn').addEventListener('click', () => { autosave(); toast('Draft saved in this browser'); });
}

function downloadClientJson() {
  if (currentForm !== 'aoc4') return FormFlow.download();
  const json = buildClientJson();
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${json.clientId}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  autosave();
  toast(`Downloaded ${json.clientId}.json`);
  return json;
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
    try {
      chrome.runtime.sendMessage(id, message, res => {
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
function bindSettings() {
  const ov = $('#settingsOverlay');
  const open = () => {
    $('#setSbEnv').value = settings.sbEnv; $('#setSbVersion').value = settings.sbVersion; $('#setSbKey').value = settings.sbKey; $('#setSbSecret').value = settings.sbSecret; $('#setLlmProvider').value = settings.llmProvider; $('#setLlmKey').value = settings.llmKey; $('#setExtId').value = settings.extId || '';
    $('#firmGrid').innerHTML = AUDITOR_FIELDS.map(([k, label, type, options]) => `<div class="f"><label>${esc(label)}</label>${type === 'select' ? `<select class="sel" data-firm="${k}">${options.map(o => `<option ${firm?.[k] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>` : `<input class="in" data-firm="${k}" value="${esc(firm?.[k] || '')}">`}</div>`).join('');
    ov.classList.add('show');
  };
  $('#settingsBtn').addEventListener('click', open);
  $('#settingsClose').addEventListener('click', () => ov.classList.remove('show'));
  ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('show'); });
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
  $('#settingsSave').addEventListener('click', () => {
    settings = { sbEnv: $('#setSbEnv').value, sbVersion: $('#setSbVersion').value.trim(), sbKey: $('#setSbKey').value.trim(), sbSecret: $('#setSbSecret').value.trim(), llmProvider: $('#setLlmProvider').value, llmKey: $('#setLlmKey').value.trim(), extId: $('#setExtId').value.trim() };
    LS.set('aoc4_settings', settings); sbToken = null;
    const f = {}; let any = false; $$('[data-firm]').forEach(el => { f[el.dataset.firm] = el.value.trim(); if (el.value.trim()) any = true; });
    if (any) { firm = f; LS.set('aoc4_firm', firm); } else { firm = null; LS.del('aoc4_firm'); }
    ov.classList.remove('show'); updateExtractBtn(); render(true); FormFlow.checkExtension(); toast('Settings saved');
  });
}
function bindClients() {
  $('#clientSelect').addEventListener('change', e => {
    const key = e.target.value;
    if (currentForm !== 'aoc4') return key ? FormFlow.loadClient(key) : newClient();
    if (!key) { newClient(); return; }
    const d = LS.get(key, null); if (!d) return;
    // Infer the draft's form from the storage key, so switching clients also
    // flips the form-category selector when the draft belongs to another form.
    const rest = key.slice('aoc4_draft_'.length).split('_');
    const draftForm = FORM_DEFS[rest[0]] ? rest[0] : 'aoc4';
    setCurrentForm(draftForm, { silent: true });
    state = Object.assign(blankState(), d); currentDraftKey = key; LS.set('aoc4_last_draft', key);
    uploadedFiles.length = 0; renderFiles(); render(true); derive(); render(true); showPanel('data'); toast(`Loaded ${state.meta.companyName || 'draft'}`);
  });
  $('#newClientBtn').addEventListener('click', newClient);
  $('#importJsonBtn').addEventListener('click', () => $('#importJsonInput').click());
  $('#importJsonInput').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      if (currentForm !== 'aoc4') { await FormFlow.importFile(f); showPanel('data'); }
      else { loadClientJson(JSON.parse(await f.text()), 'manual'); currentDraftKey = null; render(true); showPanel('data'); toast(`Imported ${f.name}`); }
    }
    catch (err) { toast(`Could not read ${f.name}: ${err.message}`, true); }
    e.target.value = '';
  });
  $('#sampleBtn').addEventListener('click', () => { if (currentForm !== 'aoc4') { FormFlow.loadSample(); showPanel('data'); return; } loadSample(); showPanel('data'); toast('Sample client loaded (Lessonboard, FY 2025-26)'); });
  renderClientList();
}
function newClient() { if (currentForm !== 'aoc4') return FormFlow.newClient(); state = blankState(); currentDraftKey = null; uploadedFiles.length = 0; renderFiles(); afterChange(); render(true); renderClientList(); $('#saveState').textContent = 'New client — not saved yet'; showPanel('data'); }
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
function bindNav() {
  $$('.nav button').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.panel)));
  $('#prevPanel').addEventListener('click', () => showPanel(PANELS[Math.max(0, PANELS.indexOf(activePanel) - 1)]));
  $('#nextPanel').addEventListener('click', () => { if (activePanel === 'review') $('#sendBtn').click(); else showPanel(PANELS[Math.min(PANELS.length - 1, PANELS.indexOf(activePanel) + 1)]); });
  window.addEventListener('hashchange', () => { const h = location.hash.replace('#', ''); if (PANELS.includes(h) && h !== activePanel) showPanel(h); });
}

/* The form dropdown, per-form data entry, documents and review live in js/form-flow.js. */

/* ═══════════════════════════════════════════════════════════════════
   Boot
   ═══════════════════════════════════════════════════════════════════ */
(function boot() {
  bindNav(); bindSandbox(); bindUpload(); bindReview(); bindSettings(); bindClients();
  const last = LS.get('aoc4_last_draft', null);
  const draft = last ? LS.get(last, null) : null;
  if (draft) { state = Object.assign(blankState(), draft); currentDraftKey = last; $('#saveState').textContent = 'Draft restored'; }
  derive(); render(true); renderClientList();
  FormFlow.bind();
  setCurrentForm(currentForm);
  const h = location.hash.replace('#', '');
  showPanel(PANELS.includes(h) ? h : 'data');
})();
