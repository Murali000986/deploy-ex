// AOC-4 field map. Selectors derived from live DOM scan of mca.gov.in/content/mca/.../form-aoc4.html.
// `kind` = 'text' | 'date' | 'number' | 'radio' | 'select' | 'addRows'
// For radio: provide `name` (full radio-group name); pageFill in popup.js picks the option by aria-label.
// For text/date/number/select: provide `selector`.

// Phases = form sections filled one at a time. pageSave selects Save by the nearby
// saveAnchor; saveIndex is the fallback when an anchor is unavailable.
// Part A (Q1–12) has a single Save, so Phases 1 and 2 share index 0.
const PHASES = [
  { id: 1, label: 'Phase 1 — Part A: General info (Q1–7)', saveIndex: 0 },
  { id: 2, label: 'Phase 2 — Subsidiary, Auditor, General Info & Service Provider (Q8–12)', saveIndex: 0,
    saveAnchor: 'Particulars of the service provider (if any)' },
  { id: 3, label: 'Phase 3 — Part B: Balance sheet & Assets & Break-up of figures', saveIndex: 1,
    saveAnchor: 'Details of trade receivables' },
  { id: 4, label: 'Phase 4 — Financial parameters (Balance sheet items)', saveIndex: 2,
    saveAnchor: 'Financial parameters - Balance sheet items',
    navigationAnchor: 'Financial parameters - Balance sheet items' },
  { id: 5, label: 'Phase 5 — Share capital raised & Cost records', saveIndex: 3,
    saveAnchor: 'Details related to cost records and cost audit',
    navigationAnchor: 'Share capital raised during the reporting period' },
  { id: 6, label: 'Phase 6 — Segment II: Profit and Loss Account', saveIndex: 4,
    saveAnchor: 'Financial parameters - Profit and loss account items',
    navigationAnchor: 'Statement of Profit and Loss' },
  { id: 7, label: 'Phase 7 — Product/service details & Disclosures (Segments III–VI)', saveIndex: 5,
    saveAnchor: 'SEGMENT-VI MISCELLANEOUS',
    navigationAnchor: 'Details related to principal products or services of the company' }
];

// Nature of financial statements: data holds a code, the page option is picked by regex on its text.
const NATURE_FS_OPTIONS = {
  provisional: { re: 'provisional|un-?adopted' },
  adopted:     { re: 'adopted', not: 'provisional|un-?adopted' },
  revised130:  { re: '130' },
  revised131:  { re: '131' }
};

// Signatory tables. Row 1 has a fixed name; rows 2+ get a random GUID prefix, so rows are picked by position.
const FS_SIG = 'panel_478261092_copy_1688980105-table-Row1-';
const BR_SIG = 'panel_2074267803_cop-panel_478261092_copy-table-Row1-';

function sigRows(prefix, base, dinCol, rows, label) {
  const out = [];
  for (let i = 0; i < rows; i++) {
    const n = i + 1;
    const isFS = prefix === 'FS';
    // Use ONLY the aria-label selector for date — a comma-joined selector with querySelectorAll
    // returns hidden template rows too, making index: i pick the wrong element.
    const dateAria = isFS ? 'input[aria-label*="signing of financial statements"]' : 'input[aria-label*="signing of Board\'s Report"]';
    out.push(
      { id: `${prefix}${n}_DIN`, key: `${prefix}_SIG_${n}_DIN`, label: `${label} ${n}: DIN/PAN`, phase: 1, kind: 'text',
        selector: `input[name$="${base}${dinCol}___jqName"]`, index: i, typeChars: true,
        nameSelector: `input[name$="${base}tableItem1___jqName"]`,
        desigSelector: `select[name$="${base}headerItem1643788021607___jqName"]` },
      { id: `${prefix}${n}_NAME`, key: `${prefix}_SIG_${n}_NAME`, label: `${label} ${n}: Name`, phase: 1, kind: 'text',
        selector: `input[name$="${base}tableItem1___jqName"]`, index: i, onlyIfEmpty: true },
      // MCA's DIN lookup owns the designation: whatever it sets is kept, it is never unlocked or retried,
      // and it is only set (quietly, through the form model) when MCA left it empty. Every live run that
      // re-selected a designation through DOM events ended with a Part A Save that did nothing.
      { id: `${prefix}${n}_DESIG`, key: `${prefix}_SIG_${n}_DESIG`, label: `${label} ${n}: Designation`, phase: 1, kind: 'select',
        selector: `select[name$="${base}headerItem1643788021607___jqName"]`, index: i, mcaOwned: true, onlyIfEmpty: true },
      { id: `${prefix}${n}_DATE`, key: `${prefix}_SIG_${n}_DATE`, label: `${label} ${n}: Date signed`, phase: 1, kind: 'date',
        // Resolve the date input from this signatory's visible table row. MCA's
        // aria-labels vary and can be absent on repeated date widgets.
        selector: `input[name$="${base}${dinCol}___jqName"]`, index: i, dateInRow: true }
    );
  }
  return out;
}

// The visible CIN box is a type-ahead ("dropdownlist"); a hidden textbox copy also exists — never fill that one.
const CIN_SEL = 'input[name$="panel1AOC4-panel-panel-panel-guidedropdownlist_co___jqName"]';
const NAME_SEL = 'input[aria-label="2 (a) *Name of the company"]';

// The MCA supplementary schedules use repeated table rows whose generated AEM
// selectors change between sessions. Resolve these rows by their visible label
// and then select a value column (current, previous, etc.).
function periodRowFields(phase, sectionHeading, rows) {
  return rows.flatMap(row => [
    { suffix: 'CUR', columnIndex: 0, period: 'Current reporting period' },
    { suffix: 'PREV', columnIndex: 1, period: 'Previous reporting period' }
  ].map(column => ({
    id: `${row.id}_${column.suffix}`,
    key: `${row.key}_${column.suffix}`,
    label: `${row.label} (${column.period})`,
    phase,
    kind: 'number',
    selector: 'input:not([type="hidden"]), textarea',
    sectionHeading: row.sectionHeading || (
      row.id.startsWith('bslt_') ? 'Details of long term borrowings (unsecured)' :
      row.id.startsWith('bsst_') ? 'Details of short-term borrowings (unsecured)' :
      row.id.startsWith('bslg_') ? 'Details of long-term loans and advances (unsecured, considered good)' :
      row.id.startsWith('bsld_') ? 'Details of long-term loans and advances (doubtful)' :
      row.id.startsWith('bs_tr_') ? 'Details of trade receivables' : sectionHeading
    ),
    fieldLabel: row.fieldLabel || row.label,
    columnIndex: column.columnIndex,
    rowOccurrence: row.rowOccurrence || 0,
    requireSemantic: true
  })));
}

function tableColumnFields(phase, sectionHeading, rows) {
  return rows.flatMap(row => (row.columns || []).map((column, columnIndex) => ({
    id: `${row.id}_${column.id}`,
    key: column.key,
    label: `${row.label} (${column.label})`,
    phase,
    kind: 'number',
    selector: 'input:not([type="hidden"]), textarea',
    sectionHeading: row.sectionHeading || sectionHeading,
    fieldLabel: row.fieldLabel || row.label,
    columnIndex,
    rowOccurrence: row.rowOccurrence || 0,
    requireSemantic: true
  })));
}

function singleColumnFields(phase, sectionHeading, rows) {
  return rows.flatMap(row => (row.columns || [{ key: row.key, id: 'VALUE', label: 'Value', columnIndex: 0 }]).map(column => ({
    id: `${row.id}_${column.id}`,
    key: column.key,
    label: row.label,
    phase,
    kind: 'number',
    selector: 'input:not([type="hidden"]), textarea',
    sectionHeading: row.sectionHeading || sectionHeading,
    fieldLabel: row.fieldLabel || row.label,
    columnIndex: column.columnIndex || 0,
    rowOccurrence: row.rowOccurrence || 0,
    requireSemantic: true
  })));
}

const BS_BREAKUP_FIELDS = periodRowFields(3, 'Break-up of figures in Balance sheet', [
  { id: 'bslt_bonds', key: 'BS_UNSEC_LT_BONDS', label: 'Bonds / debentures' },
  { id: 'bslt_bank', key: 'BS_UNSEC_LT_BANK_LOANS', label: 'From banks', fieldLabel: 'From banks' },
  { id: 'bslt_other', key: 'BS_UNSEC_LT_OTHER_TERM_LOANS', label: 'From other parties', fieldLabel: 'From other parties' },
  { id: 'bslt_deferred', key: 'BS_UNSEC_LT_DEFERRED_PAYMENT', label: 'Deferred payment liabilities' },
  { id: 'bslt_deposits', key: 'BS_UNSEC_LT_DEPOSITS', label: 'Deposits' },
  { id: 'bslt_related', key: 'BS_UNSEC_LT_RELATED_PARTIES', label: 'Loans and advances from related parties' },
  { id: 'bslt_lease', key: 'BS_UNSEC_LT_FINANCE_LEASE', label: 'Long term maturities of financial lease obligations' },
  { id: 'bslt_other_advances', key: 'BS_UNSEC_LT_OTHER_ADVANCES', label: 'Other loans and advances' },
  { id: 'bslt_guaranteed', key: 'BS_UNSEC_LT_DIRECTOR_GUARANTEE', label: 'Out of above total, aggregate amount guaranteed by directors' },

  { id: 'bsst_bank_demand', key: 'BS_UNSEC_ST_BANK_DEMAND', label: 'From banks', fieldLabel: 'From banks' },
  { id: 'bsst_other_demand', key: 'BS_UNSEC_ST_OTHER_DEMAND', label: 'From other parties', fieldLabel: 'From other parties' },
  { id: 'bsst_related', key: 'BS_UNSEC_ST_RELATED_PARTIES', label: 'Loans and advances from related parties' },
  { id: 'bsst_deposits', key: 'BS_UNSEC_ST_DEPOSITS', label: 'Deposits' },
  { id: 'bsst_other', key: 'BS_UNSEC_ST_OTHER_ADVANCES', label: 'Other loans and advances' },
  { id: 'bsst_guaranteed', key: 'BS_UNSEC_ST_DIRECTOR_GUARANTEE', label: 'Out of above total, aggregate amount guaranteed by directors' },

  { id: 'bslg_capital', key: 'BS_LT_LOANS_GOOD_CAPITAL_ADVANCES', label: 'Capital advances' },
  { id: 'bslg_related', key: 'BS_LT_LOANS_GOOD_RELATED_PARTIES', label: 'Loans and advances to other related parties' },
  { id: 'bslg_other', key: 'BS_LT_LOANS_GOOD_OTHER', label: 'Other loans and advances' },
  { id: 'bslg_provision_related', key: 'BS_LT_LOANS_GOOD_PROVISION_RELATED', label: 'From related parties' },
  { id: 'bslg_provision_other', key: 'BS_LT_LOANS_GOOD_PROVISION_OTHER', label: 'From others' },
  { id: 'bslg_directors', key: 'BS_LT_LOANS_GOOD_DIRECTORS', label: 'Loans and advances due by directors / other officers of the company' },

  { id: 'bsld_capital', key: 'BS_LT_LOANS_DOUBTFUL_CAPITAL_ADVANCES', label: 'Capital advances', fieldLabel: 'Capital advances' },
  { id: 'bsld_related', key: 'BS_LT_LOANS_DOUBTFUL_RELATED_PARTIES', label: 'Loans and advances to related parties', fieldLabel: 'Loans and advances to related parties' },
  { id: 'bsld_other', key: 'BS_LT_LOANS_DOUBTFUL_OTHER', label: 'Other loans and advances', fieldLabel: 'Other loans and advances' },
  { id: 'bsld_provision_related', key: 'BS_LT_LOANS_DOUBTFUL_PROVISION_RELATED', label: 'From related parties', fieldLabel: 'From related parties' },
  { id: 'bsld_provision_other', key: 'BS_LT_LOANS_DOUBTFUL_PROVISION_OTHER', label: 'From others', fieldLabel: 'From others' },
  { id: 'bsld_directors', key: 'BS_LT_LOANS_DOUBTFUL_DIRECTORS', label: 'Loans and advances due by directors / other officers of the company', fieldLabel: 'Loans and advances due by directors / other officers of the company' },

  { id: 'bs_tr_secured', key: 'BS_TRADE_RECEIVABLES_SECURED_GOOD', label: 'Secured, considered good' },
  { id: 'bs_tr_unsecured', key: 'BS_TRADE_RECEIVABLES_UNSECURED_GOOD', label: 'Unsecured, considered good' },
  { id: 'bs_tr_doubtful', key: 'BS_TRADE_RECEIVABLES_DOUBTFUL', label: 'Doubtful' },
  { id: 'bs_tr_provision', key: 'BS_TRADE_RECEIVABLES_PROVISION', label: 'Less: provision / allowance for bad and doubtful debts' },
  { id: 'bs_tr_directors', key: 'BS_TRADE_RECEIVABLES_DIRECTORS', label: 'Debt due by (directors / others officers of the company)' }
]);

const FINANCIAL_PARAMETER_BS_FIELDS = singleColumnFields(4, 'Financial parameters - Balance sheet items', [
  { id: 'fp_bs_01', key: 'FP_BS_01', label: 'Amount of issue for contracts without payment received in cash during reporting period' },
  { id: 'fp_bs_02', key: 'FP_BS_02', label: 'Share application money given' },
  { id: 'fp_bs_03', key: 'FP_BS_03', label: 'Share application money given during the reporting period' },
  { id: 'fp_bs_04', key: 'FP_BS_04', label: 'Share application money received during the reporting period' },
  { id: 'fp_bs_05', key: 'FP_BS_05', label: 'Share application money received and due for refund' },
  { id: 'fp_bs_06', key: 'FP_BS_06', label: 'Paid-up capital held by foreign company', columns: [
    { id: 'AMOUNT', key: 'FP_BS_06', label: 'Amount', columnIndex: 0 },
    { id: 'PERCENT', key: 'FP_BS_06_PERCENT', label: 'Percentage', columnIndex: 1 }
  ] },
  { id: 'fp_bs_07', key: 'FP_BS_07', label: 'Paid-up capital held by foreign holding and / or through its subsidiaries', columns: [
    { id: 'AMOUNT', key: 'FP_BS_07', label: 'Amount', columnIndex: 0 },
    { id: 'PERCENT', key: 'FP_BS_07_PERCENT', label: 'Percentage', columnIndex: 1 }
  ] },
  { id: 'fp_bs_08', key: 'FP_BS_08', label: 'Number of shares bought back during the reporting period' },
  { id: 'fp_bs_09', key: 'FP_BS_09', label: 'Deposits accepted or renewed during the reporting period' },
  { id: 'fp_bs_10', key: 'FP_BS_10', label: 'Deposits matured and claimed but not paid during the reporting period' },
  { id: 'fp_bs_11', key: 'FP_BS_11', label: 'Deposits matured and claimed but not paid' },
  { id: 'fp_bs_12', key: 'FP_BS_12', label: 'Deposits matured, but not claimed' },
  { id: 'fp_bs_13', key: 'FP_BS_13', label: 'Unclaimed matured debentures' },
  { id: 'fp_bs_14', key: 'FP_BS_14', label: 'Debentures claimed but not paid' },
  { id: 'fp_bs_15', key: 'FP_BS_15', label: 'Interest on deposits accrued and due but not paid' },
  { id: 'fp_bs_16', key: 'FP_BS_16', label: 'Unpaid dividend' },
  { id: 'fp_bs_17', key: 'FP_BS_17', label: 'Investment in subsidiary companies' },
  { id: 'fp_bs_18', key: 'FP_BS_18', label: 'Investment in government companies' },
  { id: 'fp_bs_19', key: 'FP_BS_19', label: 'Capital reserve' },
  { id: 'fp_bs_20', key: 'FP_BS_20', label: 'Amount due for transfer to Investor Education and Protection Fund' },
  { id: 'fp_bs_21', key: 'FP_BS_21', label: 'Inter-corporate deposits' },
  { id: 'fp_bs_22', key: 'FP_BS_22', label: 'Gross value of transaction as per AS-18' },
  { id: 'fp_bs_23', key: 'FP_BS_23', label: 'Capital subsidies or grants received from government authority' },
  { id: 'fp_bs_24', key: 'FP_BS_24', label: 'Calls unpaid by directors' },
  { id: 'fp_bs_25', key: 'FP_BS_25', label: 'Calls unpaid by others' },
  { id: 'fp_bs_26', key: 'FP_BS_26', label: 'Forfeited shares (amount originally paid-up)' },
  { id: 'fp_bs_27', key: 'FP_BS_27', label: 'Forfeited shares reissued' },
  { id: 'fp_bs_28', key: 'FP_BS_28', label: 'Borrowing from foreign institutional agencies' },
  { id: 'fp_bs_29', key: 'FP_BS_29', label: 'Borrowing from foreign companies' },
  { id: 'fp_bs_30', key: 'FP_BS_30', label: 'Inter-corporate borrowings - secured' },
  { id: 'fp_bs_31', key: 'FP_BS_31', label: 'Inter-corporate borrowings - unsecured' },
  { id: 'fp_bs_32', key: 'FP_BS_32', label: 'Commercial Paper' },
  { id: 'fp_bs_33', key: 'FP_BS_33', label: 'Conversion of warrants into equity shares during the reporting period' },
  { id: 'fp_bs_34', key: 'FP_BS_34', label: 'Conversion of warrants into preference shares during the reporting period' },
  { id: 'fp_bs_35', key: 'FP_BS_35', label: 'Conversion of warrants into debentures during the reporting period' },
  { id: 'fp_bs_36', key: 'FP_BS_36', label: 'Warrants issued during the reporting period (in foreign currency)' },
  { id: 'fp_bs_37', key: 'FP_BS_37', label: 'Warrants issued during the reporting period (in Rupees)' },
  { id: 'fp_bs_38', key: 'FP_BS_38', label: 'Default in payment of short-term borrowings and interest thereon' },
  { id: 'fp_bs_39', key: 'FP_BS_39', label: 'Default in payment of long-term borrowings and interest thereon' },
  { id: 'fp_bs_42', key: 'FP_BS_42', label: 'Number of shareholders to whom shares allotted under private placement during the reporting period' },
  { id: 'fp_bs_43', key: 'FP_BS_43', label: 'Secured loan' },
  { id: 'fp_bs_46', key: 'FP_BS_46', label: 'Miscellaneous expenditure to the extent not written off or adjusted' },
  { id: 'fp_bs_47', key: 'FP_BS_47', label: 'Unhedged Foreign Exchange Exposure' }
]);

const SHARE_EQUITY_FIELDS = tableColumnFields(5, '(i) Equity shares', [
  { id: 'sc_eq_begin', key: 'SC_EQ_BEGIN', label: 'At the beginning of the year', columns: [
    { id: 'SHARES', key: 'SC_EQ_BEGIN_SHARES', label: 'Number of shares' },
    { id: 'NOMINAL', key: 'SC_EQ_BEGIN_NOMINAL', label: 'Total nominal amount' },
    { id: 'PAID', key: 'SC_EQ_BEGIN_PAID', label: 'Total paid-up amount' }
  ] },
  ...[
    ['public', 'Public issues'], ['rights', 'Rights issue'], ['bonus', 'Bonus issue'],
    ['placement', 'Private Placement / Preferential allotment'], ['esop', 'ESOPs'],
    ['sweat', 'Sweat equity shares allotted'], ['preference_conversion', 'Conversion of Preference share'],
    ['debenture_conversion', 'Conversion of Debentures'], ['gdr', 'GDRs / ADRs']
  ].map(([id, label]) => ({ id: `sc_eq_inc_${id}`, key: `SC_EQ_INC_${id.toUpperCase()}`, label,
    columns: [
      { id: 'SHARES', key: `SC_EQ_INC_${id.toUpperCase()}_SHARES`, label: 'Number of shares' },
      { id: 'NOMINAL', key: `SC_EQ_INC_${id.toUpperCase()}_NOMINAL`, label: 'Total nominal amount' },
      { id: 'PAID', key: `SC_EQ_INC_${id.toUpperCase()}_PAID`, label: 'Total paid-up amount' },
      { id: 'PREMIUM', key: `SC_EQ_INC_${id.toUpperCase()}_PREMIUM`, label: 'Total premium' }
    ]
  })),
  ...[
    ['buyback', 'Buy-back of shares'], ['forfeited', 'Shares forfeited'], ['reduction', 'Reduction of share capital']
  ].map(([id, label]) => ({ id: `sc_eq_dec_${id}`, key: `SC_EQ_DEC_${id.toUpperCase()}`, label,
    columns: [
      { id: 'SHARES', key: `SC_EQ_DEC_${id.toUpperCase()}_SHARES`, label: 'Number of shares' },
      { id: 'NOMINAL', key: `SC_EQ_DEC_${id.toUpperCase()}_NOMINAL`, label: 'Total nominal amount' },
      { id: 'PAID', key: `SC_EQ_DEC_${id.toUpperCase()}_PAID`, label: 'Total paid-up amount' },
      { id: 'PREMIUM', key: `SC_EQ_DEC_${id.toUpperCase()}_PREMIUM`, label: 'Total premium' }
    ]
  }))
]);

const SHARE_PREFERENCE_FIELDS = tableColumnFields(5, '(ii) Preference shares', [
  { id: 'sc_pref_begin', key: 'SC_PREF_BEGIN', label: 'At the beginning of the year', columns: [
    { id: 'SHARES', key: 'SC_PREF_BEGIN_SHARES', label: 'Number of shares' },
    { id: 'NOMINAL', key: 'SC_PREF_BEGIN_NOMINAL', label: 'Total nominal amount' },
    { id: 'PAID', key: 'SC_PREF_BEGIN_PAID', label: 'Total paid-up amount' }
  ], rowOccurrence: 1 },
  ...[
    ['issue', 'Issues of shares'], ['reissue', 'Re-issue of forfeited shares']
  ].map(([id, label]) => ({ id: `sc_pref_inc_${id}`, key: `SC_PREF_INC_${id.toUpperCase()}`, label,
    columns: [
      { id: 'SHARES', key: `SC_PREF_INC_${id.toUpperCase()}_SHARES`, label: 'Number of shares' },
      { id: 'NOMINAL', key: `SC_PREF_INC_${id.toUpperCase()}_NOMINAL`, label: 'Total nominal amount' },
      { id: 'PAID', key: `SC_PREF_INC_${id.toUpperCase()}_PAID`, label: 'Total paid-up amount' },
      { id: 'PREMIUM', key: `SC_PREF_INC_${id.toUpperCase()}_PREMIUM`, label: 'Total premium' }
    ]
  })),
  ...[
    ['redemption', 'Redemption of shares'], ['forfeited', 'Shares forfeited'], ['reduction', 'Reduction of share capital']
  ].map(([id, label]) => ({ id: `sc_pref_dec_${id}`, key: `SC_PREF_DEC_${id.toUpperCase()}`, label, rowOccurrence: id === 'forfeited' || id === 'reduction' ? 1 : 0,
    columns: [
      { id: 'SHARES', key: `SC_PREF_DEC_${id.toUpperCase()}_SHARES`, label: 'Number of shares' },
      { id: 'NOMINAL', key: `SC_PREF_DEC_${id.toUpperCase()}_NOMINAL`, label: 'Total nominal amount' },
      { id: 'PAID', key: `SC_PREF_DEC_${id.toUpperCase()}_PAID`, label: 'Total paid-up amount' },
      { id: 'PREMIUM', key: `SC_PREF_DEC_${id.toUpperCase()}_PREMIUM`, label: 'Total premium' }
    ]
  }))
]);

const PROFIT_LOSS_DETAIL_FIELDS = periodRowFields(6,
  'INFORMATION AND PARTICULARS IN RESPECT OF PROFIT AND LOSS ACCOUNT', [
    { id: 'pl_dom_manufactured', key: 'PL_DOMESTIC_MANUFACTURED', label: 'Sale of goods manufactured', rowOccurrence: 0 },
    { id: 'pl_dom_traded', key: 'PL_DOMESTIC_TRADED', label: 'Sale of goods traded', rowOccurrence: 0 },
    { id: 'pl_dom_services', key: 'PL_DOMESTIC_SERVICES', label: 'Sale or supply of services', rowOccurrence: 0 },
    { id: 'pl_export_manufactured', key: 'PL_EXPORT_MANUFACTURED', label: 'Sale of goods manufactured', rowOccurrence: 1 },
    { id: 'pl_export_traded', key: 'PL_EXPORT_TRADED', label: 'Sale of goods traded', rowOccurrence: 1 },
    { id: 'pl_export_services', key: 'PL_EXPORT_SERVICES', label: 'Sale or supply of services', rowOccurrence: 1 },
    { id: 'pl_dividend', key: 'PL_DIVIDEND_INCOME', label: 'Dividend income' },
    { id: 'pl_interest', key: 'PL_INTEREST_INCOME', label: 'Interest income' },
    { id: 'pl_investment_gain', key: 'PL_INVESTMENT_GAIN_LOSS', label: 'Net gain / loss on sale of investments' },
    { id: 'pl_nonoperating', key: 'PL_OTHER_NONOPERATING_INCOME', label: 'Other non-operating income' },
    { id: 'pl_materials', key: 'PL_MATERIALS_CONSUMED', label: 'Cost of materials consumed' },
    { id: 'pl_stock_purchases', key: 'PL_STOCK_PURCHASES', label: 'Purchases of stock in trade' },
    { id: 'pl_inventory_finished', key: 'PL_INVENTORY_FINISHED', label: 'Changes in inventories of finished goods' },
    { id: 'pl_inventory_wip', key: 'PL_INVENTORY_WIP', label: 'Work-in-progress' },
    { id: 'pl_inventory_stock', key: 'PL_INVENTORY_STOCK', label: 'Stock in trade' },
    { id: 'pl_employee', key: 'PL_EMPLOYEE_BENEFITS', label: 'Employee benefit expenses' },
    { id: 'pl_managerial', key: 'PL_MANAGERIAL_REMUNERATION', label: 'Managerial remuneration' },
    { id: 'pl_auditors', key: 'PL_AUDITOR_PAYMENT', label: 'Payment to auditors' },
    { id: 'pl_insurance', key: 'PL_INSURANCE', label: 'Insurance expenses' },
    { id: 'pl_power', key: 'PL_POWER_FUEL', label: 'Power and fuel' },
    { id: 'pl_finance', key: 'PL_FINANCE_COSTS', label: 'Finance costs' },
    { id: 'pl_depreciation', key: 'PL_DEPRECIATION', label: 'Depreciation and amortization expenses' },
    { id: 'pl_other_expenses', key: 'PL_OTHER_EXPENSES', label: 'Other expenses' },
    { id: 'pl_exceptional', key: 'PL_EXCEPTIONAL_ITEMS', label: 'Exceptional items' },
    { id: 'pl_extraordinary', key: 'PL_EXTRAORDINARY_ITEMS', label: 'Extraordinary items' },
    { id: 'pl_discontinued', key: 'PL_DISCONTINUED_OPERATIONS', label: 'Profit / (loss) from discontinuing operations' },
    { id: 'pl_discontinued_tax', key: 'PL_DISCONTINUED_TAX', label: 'Tax expense of discontinuing operations' },
    { id: 'pl_eps_basic_after', key: 'PL_EPS_BASIC_AFTER_EXTRAORDINARY', label: 'Basic', fieldLabel: 'Basic', rowOccurrence: 1 },
    { id: 'pl_eps_diluted_after', key: 'PL_EPS_DILUTED_AFTER_EXTRAORDINARY', label: 'Diluted', fieldLabel: 'Diluted', rowOccurrence: 1 }
  ]);

const FX_INCOME_FIELDS = periodRowFields(6, 'A Details of earning in foreign exchange', [
  { id: 'fxi_goods', key: 'FX_IN_EXPORT_GOODS', label: 'Export of goods calculated on FOB basis' },
  { id: 'fxi_interest', key: 'FX_IN_INTEREST_DIVIDEND', label: 'Interest and dividend' },
  { id: 'fxi_royalty', key: 'FX_IN_ROYALTY', label: 'Royalty', fieldLabel: '3 Royalty' },
  { id: 'fxi_knowhow', key: 'FX_IN_KNOW_HOW', label: 'Know-how', fieldLabel: '4 Know-how' },
  { id: 'fxi_professional', key: 'FX_IN_PROFESSIONAL_FEES',
    label: 'Professional and consultation fees', fieldLabel: '5 Professional and consultation fees' },
  { id: 'fxi_other', key: 'FX_IN_OTHER_INCOME', label: 'Other income' }
]);

const FX_EXPENSE_FIELDS = periodRowFields(6, 'Details of expenditure in foreign exchange', [
  { id: 'fxe_raw', key: 'FX_OUT_RAW_MATERIAL', label: 'Raw material' },
  { id: 'fxe_parts', key: 'FX_OUT_COMPONENTS_SPARES', label: 'Component and spare parts' },
  { id: 'fxe_capital', key: 'FX_OUT_CAPITAL_GOODS', label: 'Capital goods' },
  { id: 'fxe_royalty', key: 'FX_OUT_ROYALTY', label: 'Royalty' },
  { id: 'fxe_knowhow', key: 'FX_OUT_KNOW_HOW', label: 'Know-how' },
  { id: 'fxe_professional', key: 'FX_OUT_PROFESSIONAL_FEES', label: 'Professional and consultation fees' },
  { id: 'fxe_interest', key: 'FX_OUT_INTEREST', label: 'Interest' },
  { id: 'fxe_other', key: 'FX_OUT_OTHER_MATTERS', label: 'Other matters' },
  { id: 'fxe_dividend', key: 'FX_OUT_DIVIDEND', label: 'Dividend paid' }
]);

const FINANCIAL_PARAMETER_PL_FIELDS = singleColumnFields(6,
  'Financial parameters - Profit and loss account items', [
    { id: 'fp_pl_dividend', key: 'FP_PL_PROPOSED_DIVIDEND', label: 'Proposed Dividend', columns: [
      { id: 'AMOUNT', key: 'FP_PL_PROPOSED_DIVIDEND', label: 'Amount', columnIndex: 0 },
      { id: 'PERCENT', key: 'FP_PL_PROPOSED_DIVIDEND_PERCENT', label: 'Percentage', columnIndex: 1 }
    ] },
    { id: 'fp_pl_eps_basic', key: 'FP_PL_EPS_BASIC', label: 'Basic', fieldLabel: 'Basic' },
    { id: 'fp_pl_eps_diluted', key: 'FP_PL_EPS_DILUTED', label: 'Diluted', fieldLabel: 'Diluted' },
    { id: 'fp_pl_fx_income', key: 'FP_PL_FOREIGN_INCOME', label: 'Income in foreign currency' },
    { id: 'fp_pl_fx_expense', key: 'FP_PL_FOREIGN_EXPENDITURE', label: 'Expenditure in foreign currency' },
    { id: 'fp_pl_grants', key: 'FP_PL_GOVERNMENT_GRANTS', label: 'Revenue subsidies or grants received from government authority' },
    { id: 'fp_pl_rent', key: 'FP_PL_RENT_PAID', label: 'Rent paid' },
    { id: 'fp_pl_stores', key: 'FP_PL_STORES_SPARES', label: 'Consumption of stores and spare parts' },
    { id: 'fp_pl_related_gross', key: 'FP_PL_RELATED_PARTY_GROSS', label: 'Gross value of the transaction with the related parties as per AS-18' },
    { id: 'fp_pl_related_debt', key: 'FP_PL_RELATED_PARTY_BAD_DEBTS', label: 'Bad debts of related parties as per AS-18' },
    { id: 'fp_pl_s182', key: 'FP_PL_SECTION_182', label: 'Contribution made under sub-section (3) of section 182' }
  ]);

const FIELD_MAPPINGS = [
  /* ===== PHASE 1 — SEGMENT I Part A, in form order ===== */
  // Typed key by key so MCA's CIN lookup fires and auto-populates Name, Address, Email, Auth Cap, and Member count.
  { id: 'CIN', key: 'CIN', label: '1(a) CIN', phase: 1, kind: 'text', selector: CIN_SEL,
    typeChars: true, doneSelector: NAME_SEL, selectSuggestion: true },

  { id: 'FY_FROM', key: 'FY_FROM', label: '3 FY From', phase: 1, kind: 'date',
    selector: 'input[name$="panel_478261092_copy-panel_252196987-guidetextbox_copy___jqName"][placeholder="DD/MM/YYYY"]' },
  { id: 'FY_TO', key: 'FY_TO', label: '3 FY To', phase: 1, kind: 'date',
    selector: 'input[name$="panel_478261092_copy-panel_252196987-guidetextbox_copy_673278796___jqName"]' },

  { id: 'BM_DATE', key: 'BOARD_MEETING_DATE', label: '4(a) Board meeting (FS approved)', phase: 1, kind: 'date',
    selector: 'input[aria-label^="4 (a) *Date of Board of directors\' meeting"]' },
  { id: 'NATURE_FS', key: 'NATURE_FS', label: '4(b)(i) Nature of financial statements', phase: 1, kind: 'select',
    selector: 'select[aria-label="(b) (i) *Nature of financial statements"]', optionMap: NATURE_FS_OPTIONS },
  // Two Yes/No/N.A. groups shown for "adopted"; DOM order assumed to be (iii) then (iv).
  { id: 'PROV_EARLIER', key: 'PROVISIONAL_FILED_EARLIER', label: '4(b)(iii) Provisional FS filed earlier', phase: 1, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel1AOC4-panel_2074267803-panel_478261092_copy_1688980105-panel_252196987-guideradiobutton___jqName' },
  { id: 'ADJ_AGM', key: 'ADOPTED_IN_ADJOURNED_AGM', label: '4(b)(iv) Adopted in adjourned AGM', phase: 1, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel1AOC4-panel_2074267803-panel_478261092_copy_1688980105-panel_252196987-guideradiobutton_2135980083___jqName' },

  // `need` is the minimum; buildJobs raises it to the number of signatories in the client data.
  { id: 'FS_ADD_ROWS', label: '4(c) Ensure enough FS signatory rows', phase: 1, kind: 'addRows',
    selector: `input[name$="${FS_SIG}tableitem___jqName"]`, need: 2 },
  ...sigRows('FS', FS_SIG, 'tableitem', 5, '4(c) FS signatory'),

  { id: 'BR_DATE', key: 'BOARD_REPORT_DATE', label: "5(a) Board meeting (Board's report approved)", phase: 1, kind: 'date',
    selector: 'input[aria-label^="5 (a) Date of Board of directors\' meeting in which boards"]' },

  { id: 'BR_ADD_ROWS', label: "5(b) Ensure enough Board's report signatory rows", phase: 1, kind: 'addRows',
    selector: `input[name$="${BR_SIG}tableItem___jqName"]`, need: 2 },
  ...sigRows('BR', BR_SIG, 'tableItem', 3, "5(b) Board's report signatory"),

  { id: 'AUDITOR_SIGN', key: 'AUDITOR_SIGN_DATE', label: '6 Auditor signed reports', phase: 1, kind: 'date',
    selector: 'input[aria-label^="6 *Date of signing of reports"]' },

  { id: 'AGM_HELD', key: 'AGM_HELD', label: '7(a) AGM held', phase: 1, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel1AOC4-panel_2074267803_cop_606137638-panel_478261092_copy-guideradiobutton___jqName' },
  { id: 'AGM_DATE', key: 'AGM_DATE', label: '7(b) Date of AGM', phase: 1, kind: 'date',
    selector: 'input[aria-label^="(b) If yes, date of AGM"]' },
  { id: 'AGM_DUE', key: 'AGM_DUE_DATE', label: '7(c) Due date of AGM', phase: 1, kind: 'date',
    selector: 'input[aria-label^="(c) Due date of AGM"]' },
  { id: 'AGM_EXT', key: 'AGM_EXTENSION', label: '7(d) AGM extension granted', phase: 1, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel1AOC4-panel_2074267803_cop_606137638-panel_478261092_copy-guideradiobutton_cop___jqName' },
  { id: 'GNL1_SRN', key: 'GNL1_SRN', label: '7(e) SRN of GNL-1', phase: 1, kind: 'text',
    selector: 'input[aria-label="(e) SRN of GNL-1"]' },
  { id: 'AGM_EXT_DUE', key: 'AGM_EXT_DUE_DATE', label: '7(f) Due date after extension', phase: 1, kind: 'date',
    selector: 'input[aria-label^="(f) Due date of AGM after grant of extension"]' },

  // Check that CIN lookup completed after the rest of Part A has had time to trigger it.
  { id: 'CIN_WAIT', key: 'CIN', label: '1(a) Waiting for MCA company lookup', phase: 1, kind: 'waitFor',
    selector: NAME_SEL, timeout: 15000 },

  /* ===== Q8 Subsidiary Details ===== */
  { id: 'IS_SUB', key: 'IS_SUBSIDIARY', label: '8(a) Is Subsidiary?', phase: 2, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel2AOC4-panel_2074267803_cop_2081672660-panel_478261092_copy-guideradiobutton___jqName',
    selector: 'input[aria-label*="subsidiary company as defined under clause (87)"]' },

  { id: 'HOLD_CIN', key: 'HOLDING_CIN', label: '8(b) Holding CIN', phase: 2, kind: 'text',
    selector: 'input[aria-label*="CIN/any other registration number of the holding company"], input[aria-label*="holding company"]' },

  { id: 'HOLD_NAME', key: 'HOLDING_NAME', label: '8(c) Holding Name', phase: 2, kind: 'text',
    selector: 'input[aria-label*="Name of the holding company"]' },

  { id: 'PROV_SEC', key: 'PROVISION_SECTION', label: '8(d) Provision Section', phase: 2, kind: 'select',
    selector: 'select[aria-label^="(d) Provision pursuant"], select[aria-label*="Provision pursuant"]' },

  { id: 'HAS_SUB_JV', key: 'HAS_SUBSIDIARY_OR_JV', label: '8(e) Has Subsidiary/JV?', phase: 2, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel2AOC4-panel_2074267803_cop_2081672660-panel_478261092_copy-guideradiobutton_cop___jqName',
    selector: 'input[aria-label*="subsidiary company as defined under clause(87)"], input[aria-label*="joint venture"]' },

  /* ===== Q9 Auditor Details ===== */
  // Step 1: fill SRN — MCA then auto-fetches all auditor fields (PAN, category, name, address, member details)
  { id: 'ADT_SRN', key: 'ADT_SRN', label: '9 SRN of Form ADT-1', phase: 2, kind: 'text',
    selector: 'input[aria-label="9 *SRN of Form ADT-1"], input[aria-label*="SRN of Form ADT-1"]',
    typeChars: true, commitEnter: true },

  { id: 'NUM_AUD', key: 'NUM_AUDITORS', label: '9 Number of Auditors', phase: 2, kind: 'number',
    selector: 'input[aria-label="*Number of Auditors"], input[aria-label*="Number of Auditors"]',
    onlyIfEmpty: true },

  // onlyIfEmpty: MCA auto-fills from SRN; only touch if it didn't arrive
  { id: 'AUD_PAN', key: 'AUDITOR_PAN', label: '9(a) Auditor PAN', phase: 2, kind: 'text',
    selector: 'input[aria-label*="Income-tax PAN of auditor"], input[aria-label*="PAN of auditor"]',
    onlyIfEmpty: true },

  { id: 'AUD_CAT', key: 'AUDITOR_CATEGORY', label: '9(b) Auditor Category', phase: 2, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel2AOC4-panel_1603825367-panel-guideradiobutton___jqName',
    selector: 'input[aria-label*="Category of auditor"]',
    onlyIfEmpty: true },

  { id: 'FIRM_REG', key: 'AUDITOR_FIRM_REG', label: '9(c) Firm Reg / Membership No', phase: 2, kind: 'text',
    selector: 'input[aria-label*="Membership number of auditor or auditor"], input[aria-label*="registration number"]',
    onlyIfEmpty: true },

  { id: 'AUD_NAME', key: 'AUDITOR_NAME', label: '9(d) Auditor Name', phase: 2, kind: 'text',
    selector: 'input[aria-label*="(d) *Name of the auditor"], input[aria-label*="Name of the auditor"]',
    onlyIfEmpty: true },

  { id: 'AUD_ADDR1', key: 'AUDITOR_ADDR1', label: '9(e) Auditor Address Line 1', phase: 2, kind: 'text',
    selector: 'input[name$="panel_1603825367-panel-guidetextbox_2007049246___jqName"]',
    onlyIfEmpty: true },

  { id: 'AUD_ADDR2', key: 'AUDITOR_ADDR2', label: '9(e) Auditor Address Line 2', phase: 2, kind: 'text',
    selector: 'input[name$="panel_1603825367-panel-guidetextbox_382138727___jqName"]',
    onlyIfEmpty: true },

  { id: 'AUD_COUNTRY', key: 'AUDITOR_COUNTRY', label: '9(e) Auditor Country', phase: 2, kind: 'select',
    selector: 'select[name$="panel_1603825367-panel-guidedropdownlist___jqName"]',
    onlyIfEmpty: true },

  // PIN code typed key-by-key + Tab triggers MCA lookup to populate Area/Locality dropdown
  { id: 'AUD_PIN', key: 'AUDITOR_PIN', label: '9(e) Auditor Pin Code', phase: 2, kind: 'pinCode',
    pinSelector: 'input[name$="panel_1603825367-panel-guidetextbox_1574494336___jqName"]',
    areaSelector: 'select[name$="panel_1603825367-panel-guidedropdownlist_1886163539___jqName"]',
    citySelector: 'input[name$="panel_1603825367-panel-guidetextbox_1885532300___jqName"]',
    onlyIfEmpty: true },

  // Area/Locality — select populated after PIN lookup by MCA — waitFor city/area fill then select
  { id: 'AUD_AREA', key: 'AUDITOR_AREA', label: '9(e) Auditor Area/Locality', phase: 2, kind: 'select',
    selector: 'select[name$="panel_1603825367-panel-guidedropdownlist_1886163539___jqName"]',
    waitForOptions: true, sectionHeading: 'Auditor Details', fieldLabel: 'Area/Locality',
    onlyIfEmpty: true, optional: true },

  { id: 'AUD_CITY', key: 'AUDITOR_CITY', label: '9(e) Auditor City', phase: 2, kind: 'text',
    selector: 'input[name$="panel_1603825367-panel-guidetextbox_1885532300___jqName"]',
    onlyIfEmpty: true },

  { id: 'AUD_DIST', key: 'AUDITOR_DISTRICT', label: '9(e) Auditor District', phase: 2, kind: 'text',
    selector: 'input[name$="panel_1603825367-panel-guidetextbox_1885532300_copy___jqName"]',
    sectionHeading: 'Auditor Details', fieldLabel: 'District',
    onlyIfEmpty: true },

  { id: 'AUD_STATE', key: 'AUDITOR_STATE', label: '9(e) Auditor State', phase: 2, kind: 'text',
    selector: 'input[name$="panel_1603825367-panel-guidetextbox_1885532_621346261___jqName"]',
    onlyIfEmpty: true },

  { id: 'MEMBER_NM', key: 'MEMBER_NAME', label: '9(f)(i) Member Name', phase: 2, kind: 'text',
    selector: 'input[aria-label="(i) Name of the member"], input[aria-label*="Name of the member"]',
    onlyIfEmpty: true },

  { id: 'MEMBER_NO', key: 'MEMBER_NUMBER', label: '9(f)(ii) Membership Number', phase: 2, kind: 'text',
    selector: 'input[name$="panel_1603825367-panel-panel-guidetextbox_1509170263___jqName"]',
    onlyIfEmpty: true },

  /* ===== Q10–12 Industry & Books ===== */
  { id: 'IND_TYPE', key: 'TYPE_OF_INDUSTRY', label: '10(a) Industry Type', phase: 2, kind: 'select',
    selector: 'select[aria-label*="type of industry" i]',
    optionMap: {
      'Commercial & Industrial': { re: 'commercial\\s*(?:&|and)\\s*industrial' },
      'Commercial and Industrial': { re: 'commercial\\s*(?:&|and)\\s*industrial' },
      'Commercial and Industrial (C&I)': { re: 'commercial\\s*(?:&|and)\\s*industrial' }
    }
  },

  { id: 'SCH3', key: 'SCHEDULE_III', label: '10(b) Schedule III Applicable', phase: 2, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel2AOC4-panel_2074267803_cop_385433263-panel_478261092_copy-guideradiobutton___jqName',
    selector: 'input[aria-label*="Schedule III"]' },

  { id: 'CONSOL', key: 'CONSOLIDATED_FS', label: '11 Consolidated FS Required', phase: 2, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel2AOC4-panel_2074267803_cop_1118870191-guideradiobutton___jqName',
    selector: 'input[aria-label*="consolidated financial statements"]' },

  { id: 'BOOKS_E', key: 'MAINTAIN_ELECTRONIC_BOOKS', label: '12(a) Books in Electronic Form', phase: 2, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel2AOC4-panel_2074267803_cop_1118870191-panel_478261092_copy-guideradiobutton___jqName',
    selector: 'input[aria-label*="books of account and other relevant books and papers in electronic form"]' },

  // Q12(b) — server address fields (only shown when Books Electronic = Yes)
  { id: 'SRV_ADDR1', key: 'SERVER_ADDR1', label: '12(b) Server Address Line 1', phase: 2, kind: 'text',
    selector: 'input[name$="panel_2074267803_cop_1118870191-panel_478261092_copy-guidetextbox___jqName"]',
    sectionHeading: 'Complete Postal Address of the Place of maintenance of computer servers (Storing Accounting Data)', fieldLabel: 'Address Line 1' },

  { id: 'SRV_ADDR2', key: 'SERVER_ADDR2', label: '12(b) Server Address Line 2', phase: 2, kind: 'text',
    selector: 'input[name$="panel_2074267803_cop_1118870191-panel_478261092_copy-guidetextbox_copy___jqName"]',
    sectionHeading: 'Complete Postal Address of the Place of maintenance of computer servers (Storing Accounting Data)', fieldLabel: 'Address Line 2' },

  { id: 'SRV_COUNTRY', key: 'SERVER_COUNTRY', label: '12(b) Server Country', phase: 2, kind: 'select',
    selector: 'select[name$="panel_2074267803_cop_1118870191-panel_478261092_copy-guidedropdownlist___jqName"]',
    sectionHeading: 'Complete Postal Address of the Place of maintenance of computer servers (Storing Accounting Data)', fieldLabel: 'Country' },

  // PIN code typed key-by-key: MCA does AJAX lookup to populate Area/Locality, City, District, State
  { id: 'SRV_PIN', key: 'SERVER_PIN', label: '12(b) Server PIN', phase: 2, kind: 'pinCode',
    pinSelector: 'input[name$="panel_2074267803_cop_1118870191-panel_478261092_copy-guidetextbox_pin___jqName"]',
    areaSelector: 'select[name$="panel_2074267803_cop_1118870191-panel_478261092_copy-guidedropdownlist_area___jqName"]',
    citySelector: 'input[name$="panel_2074267803_cop_1118870191-panel_478261092_copy-guidetextbox_city___jqName"]',
    waitSentinel: 'input[name$="panel_2074267803_cop_1118870191-panel_478261092_copy-guidetextbox_city___jqName"]',
    sectionHeading: 'Complete Postal Address of the Place of maintenance of computer servers (Storing Accounting Data)', fieldLabel: 'Pin Code/Zip Code' },

  { id: 'SRV_AREA', key: 'SERVER_AREA', label: '12(b) Server Area', phase: 2, kind: 'select',
    selector: 'select[name$="panel_2074267803_cop_1118870191-panel_478261092_copy-guidedropdownlist_area___jqName"]',
    waitForOptions: true,
    sectionHeading: 'Complete Postal Address of the Place of maintenance of computer servers (Storing Accounting Data)', fieldLabel: 'Area/Locality' },

  { id: 'SRV_CITY', key: 'SERVER_CITY', label: '12(b) Server City', phase: 2, kind: 'text',
    selector: 'input[name$="panel_2074267803_cop_1118870191-panel_478261092_copy-guidetextbox_city___jqName"]',
    onlyIfEmpty: true,
    sectionHeading: 'Complete Postal Address of the Place of maintenance of computer servers (Storing Accounting Data)', fieldLabel: 'City' },

  { id: 'SRV_DIST', key: 'SERVER_DISTRICT', label: '12(b) Server District', phase: 2, kind: 'text',
    selector: 'input[name$="panel_2074267803_cop_1118870191-panel_478261092_copy-guidetextbox_district___jqName"]',
    onlyIfEmpty: true,
    sectionHeading: 'Complete Postal Address of the Place of maintenance of computer servers (Storing Accounting Data)', fieldLabel: 'District' },

  { id: 'SRV_STATE', key: 'SERVER_STATE', label: '12(b) Server State', phase: 2, kind: 'text',
    selector: 'input[name$="panel_2074267803_cop_1118870191-panel_478261092_copy-guidetextbox_state___jqName"]',
    onlyIfEmpty: true,
    sectionHeading: 'Complete Postal Address of the Place of maintenance of computer servers (Storing Accounting Data)', fieldLabel: 'State/UT' },

  { id: 'SRV_CLOUD', key: 'MAINTAINED_ON_CLOUD', label: '12(c)(iv) Maintained on cloud', phase: 2, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel2AOC4-panel_2074267803_cop_1118870191-panel_478261092_copy-guideradiobutton_cop___jqName',
    selector: 'input[aria-label*="maintained on cloud"]',
    optionalGroup: 'serviceProvider',
    sectionHeading: 'Particulars of the service provider (if any)',
    fieldLabel: 'Whether books of account and other books and papers are maintained on cloud' },

  // Q12(c) provider details are populated only when the client record contains them.
  // The supplied AOC-4 source has these fields blank, so do not invent provider data.
  { id: 'SRV_PROVIDER_NAME', key: 'SERVICE_PROVIDER_NAME', label: '12(c)(i) Service provider name', phase: 2, kind: 'text',
    selector: 'input:not([type="hidden"])',
    optionalGroup: 'serviceProvider',
    sectionHeading: 'Particulars of the service provider (if any)', fieldLabel: 'Name of the service provider', manualAfterFill: true },

  { id: 'SRV_PROVIDER_IP', key: 'SERVICE_PROVIDER_IP', label: '12(c)(ii) Service provider IP address', phase: 2, kind: 'text',
    selector: 'input:not([type="hidden"])',
    optionalGroup: 'serviceProvider',
    sectionHeading: 'Particulars of the service provider (if any)', fieldLabel: 'Internet protocol address of service provider' },

  { id: 'SRV_PROVIDER_LOCATION', key: 'SERVICE_PROVIDER_LOCATION', label: '12(c)(iii) Service provider location', phase: 2, kind: 'text',
    selector: 'input:not([type="hidden"])',
    optionalGroup: 'serviceProvider',
    sectionHeading: 'Particulars of the service provider (if any)', fieldLabel: 'Location of the service provider' },

  { id: 'SRV_PROVIDER_ADDRESS', key: 'SERVICE_PROVIDER_ADDRESS', label: '12(c)(v) Service provider address', phase: 2, kind: 'text',
    selector: 'input:not([type="hidden"])',
    optionalGroup: 'serviceProvider',
    sectionHeading: 'Particulars of the service provider (if any)', fieldLabel: 'Address as provided by the service provider' },

  // Check the SRN lookup after the following auditor/general fields have advanced the form.
  { id: 'ADT_WAIT', label: '9 Waiting for MCA auditor lookup…', phase: 2, kind: 'waitFor',
    selector: 'input[aria-label*="Income-tax PAN of auditor"], input[aria-label*="PAN of auditor"], input[aria-label*="Name of the auditor"]',
    timeout: 12000 },

  /* ===== BALANCE SHEET ===== */
  // Each Row has 3 inputs in order: current period, previous period, reason for change (not filled).

  { id: 'bs_date_cur',  key: 'asOf_CUR',  label: 'BS date (current)',  kind: 'date',
    selector: 'input[name$="table-HeaderRow-headerItem1643803865994___jqName"]' },
  { id: 'bs_date_prev', key: 'asOf_PREV', label: 'BS date (previous)', kind: 'date',
    selector: 'input[name$="table-HeaderRow-headerItem1643803870365___jqName"]' },

  { id: 'bs_sc_cur',  key: 'SHARE_CAPITAL_CUR',  kind: 'number',
    selector: 'input[name$="Row1643805949296-tableItem1643805949299___jqName"]' },
  { id: 'bs_sc_prev', key: 'SHARE_CAPITAL_PREV', kind: 'number',
    selector: 'input[name$="Row1643805949296-tableItem1643805949300___jqName"]' },

  { id: 'bs_rs_cur',  key: 'RESERVES_SURPLUS_CUR',  kind: 'number',
    selector: 'input[name$="Row1643810517442-tableItem1643810517445___jqName"]' },
  { id: 'bs_rs_prev', key: 'RESERVES_SURPLUS_PREV', kind: 'number',
    selector: 'input[name$="Row1643810517442-tableItem1643810517446___jqName"]' },

  { id: 'bs_mw_cur',  key: 'MONEY_AGAINST_WARRANTS_CUR',  kind: 'number',
    selector: 'input[name$="Row1643810556785-tableItem1643810556788___jqName"]' },
  { id: 'bs_mw_prev', key: 'MONEY_AGAINST_WARRANTS_PREV', kind: 'number',
    selector: 'input[name$="Row1643810556785-tableItem1643810556789___jqName"]' },

  { id: 'bs_sap_cur',  key: 'SHARE_APP_PENDING_CUR',  kind: 'number',
    selector: 'input[name$="Row1643810981304-tableItem1643810981307___jqName"]' },
  { id: 'bs_sap_prev', key: 'SHARE_APP_PENDING_PREV', kind: 'number',
    selector: 'input[name$="Row1643810981304-tableItem1643810981308___jqName"]' },

  { id: 'bs_ltb_cur',  key: 'LONG_TERM_BORROWINGS_CUR',  kind: 'number',
    selector: 'input[name$="Row1643811210415-tableItem1643811210419___jqName"]' },
  { id: 'bs_ltb_prev', key: 'LONG_TERM_BORROWINGS_PREV', kind: 'number',
    selector: 'input[name$="Row1643811210415-tableItem1643811210420___jqName"]' },

  { id: 'bs_dtl_cur',  key: 'DEFERRED_TAX_LIAB_CUR',  kind: 'number',
    selector: 'input[name$="Row1643811216485-tableItem1643811216488___jqName"]' },
  { id: 'bs_dtl_prev', key: 'DEFERRED_TAX_LIAB_PREV', kind: 'number',
    selector: 'input[name$="Row1643811216485-tableItem1643811216489___jqName"]' },

  { id: 'bs_oll_cur',  key: 'OTHER_LONG_TERM_LIAB_CUR',  kind: 'number',
    selector: 'input[name$="Row1643811233453-tableItem1643811233456___jqName"]' },
  { id: 'bs_oll_prev', key: 'OTHER_LONG_TERM_LIAB_PREV', kind: 'number',
    selector: 'input[name$="Row1643811233453-tableItem1643811233457___jqName"]' },

  { id: 'bs_ltp_cur',  key: 'LONG_TERM_PROVISIONS_CUR',  kind: 'number',
    selector: 'input[name$="Row1643811248414-tableItem1643811248417___jqName"]' },
  { id: 'bs_ltp_prev', key: 'LONG_TERM_PROVISIONS_PREV', kind: 'number',
    selector: 'input[name$="Row1643811248414-tableItem1643811248418___jqName"]' },

  { id: 'bs_stb_cur',  key: 'SHORT_TERM_BORROWINGS_CUR',  kind: 'number',
    selector: 'input[name$="Row1643811597352-tableItem1643811597355___jqName"]' },
  { id: 'bs_stb_prev', key: 'SHORT_TERM_BORROWINGS_PREV', kind: 'number',
    selector: 'input[name$="Row1643811597352-tableItem1643811597356___jqName"]' },

  { id: 'bs_tpm_cur',  key: 'TRADE_PAYABLES_MSME_CUR',  kind: 'number',
    selector: 'input[name$="Row1720502496918-tableItem1720502496921___jqName"]' },
  { id: 'bs_tpm_prev', key: 'TRADE_PAYABLES_MSME_PREV', kind: 'number',
    selector: 'input[name$="Row1720502496918-tableItem1720502496922___jqName"]' },

  { id: 'bs_tpo_cur',  key: 'TRADE_PAYABLES_OTHER_CUR',  kind: 'number',
    selector: 'input[name$="Row1720503320433-tableItem1720503320436___jqName"]' },
  { id: 'bs_tpo_prev', key: 'TRADE_PAYABLES_OTHER_PREV', kind: 'number',
    selector: 'input[name$="Row1720503320433-tableItem1720503320437___jqName"]' },

  { id: 'bs_ocl_cur',  key: 'OTHER_CURRENT_LIAB_CUR',  kind: 'number',
    selector: 'input[name$="Row1643867870853-tableItem1643867870856___jqName"]' },
  { id: 'bs_ocl_prev', key: 'OTHER_CURRENT_LIAB_PREV', kind: 'number',
    selector: 'input[name$="Row1643867870853-tableItem1643867870857___jqName"]' },

  { id: 'bs_stp_cur',  key: 'SHORT_TERM_PROVISIONS_CUR',  kind: 'number',
    selector: 'input[name$="Row1643867878141-tableItem1643867878144___jqName"]' },
  { id: 'bs_stp_prev', key: 'SHORT_TERM_PROVISIONS_PREV', kind: 'number',
    selector: 'input[name$="Row1643867878141-tableItem1643867878145___jqName"]' },

  /* Assets side */
  { id: 'as_ppe_cur',  key: 'PPE_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869054335-tableItem1643869054338___jqName"]' },
  { id: 'as_ppe_prev', key: 'PPE_PREV', kind: 'number',
    selector: 'input[name$="Row1643869054335-tableItem1643869054339___jqName"]' },

  { id: 'as_int_cur',  key: 'INTANGIBLE_ASSETS_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869059645-tableItem1643869059648___jqName"]' },
  { id: 'as_int_prev', key: 'INTANGIBLE_ASSETS_PREV', kind: 'number',
    selector: 'input[name$="Row1643869059645-tableItem1643869059649___jqName"]' },

  { id: 'as_cwip_cur',  key: 'CWIP_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869065899-tableItem1643869065902___jqName"]' },
  { id: 'as_cwip_prev', key: 'CWIP_PREV', kind: 'number',
    selector: 'input[name$="Row1643869065899-tableItem1643869065903___jqName"]' },

  { id: 'as_iud_cur',  key: 'INTANGIBLE_UNDER_DEV_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869072635-tableItem1643869072638___jqName"]' },
  { id: 'as_iud_prev', key: 'INTANGIBLE_UNDER_DEV_PREV', kind: 'number',
    selector: 'input[name$="Row1643869072635-tableItem1643869072639___jqName"]' },

  { id: 'as_nci_cur',  key: 'NON_CURRENT_INVESTMENTS_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869078500-tableItem1643869078503___jqName"]' },
  { id: 'as_nci_prev', key: 'NON_CURRENT_INVESTMENTS_PREV', kind: 'number',
    selector: 'input[name$="Row1643869078500-tableItem1643869078504___jqName"]' },

  { id: 'as_dta_cur',  key: 'DEFERRED_TAX_ASSETS_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869089142-tableItem1643869089145___jqName"]' },
  { id: 'as_dta_prev', key: 'DEFERRED_TAX_ASSETS_PREV', kind: 'number',
    selector: 'input[name$="Row1643869089142-tableItem1643869089146___jqName"]' },

  { id: 'as_ltla_cur',  key: 'LONG_TERM_LOANS_ADVANCES_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869103460-tableItem1643869103463___jqName"]' },
  { id: 'as_ltla_prev', key: 'LONG_TERM_LOANS_ADVANCES_PREV', kind: 'number',
    selector: 'input[name$="Row1643869103460-tableItem1643869103464___jqName"]' },

  { id: 'as_onc_cur',  key: 'OTHER_NON_CURRENT_ASSETS_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869110403-tableItem1643869110406___jqName"]' },
  { id: 'as_onc_prev', key: 'OTHER_NON_CURRENT_ASSETS_PREV', kind: 'number',
    selector: 'input[name$="Row1643869110403-tableItem1643869110407___jqName"]' },

  { id: 'as_ci_cur',  key: 'CURRENT_INVESTMENTS_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869677742-tableItem1643869677745___jqName"]' },
  { id: 'as_ci_prev', key: 'CURRENT_INVESTMENTS_PREV', kind: 'number',
    selector: 'input[name$="Row1643869677742-tableItem1643869677746___jqName"]' },

  { id: 'as_inv_cur',  key: 'INVENTORIES_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869683963-tableItem1643869683966___jqName"]' },
  { id: 'as_inv_prev', key: 'INVENTORIES_PREV', kind: 'number',
    selector: 'input[name$="Row1643869683963-tableItem1643869683967___jqName"]' },

  { id: 'as_tr_cur',  key: 'TRADE_RECEIVABLES_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869691133-tableItem1643869691136___jqName"]' },
  { id: 'as_tr_prev', key: 'TRADE_RECEIVABLES_PREV', kind: 'number',
    selector: 'input[name$="Row1643869691133-tableItem1643869691137___jqName"]' },

  { id: 'as_cc_cur',  key: 'CASH_EQUIVALENTS_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869700097-tableItem1643869700100___jqName"]' },
  { id: 'as_cc_prev', key: 'CASH_EQUIVALENTS_PREV', kind: 'number',
    selector: 'input[name$="Row1643869700097-tableItem1643869700101___jqName"]' },

  { id: 'as_stla_cur',  key: 'SHORT_TERM_LOANS_ADVANCES_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869710045-tableItem1643869710048___jqName"]' },
  { id: 'as_stla_prev', key: 'SHORT_TERM_LOANS_ADVANCES_PREV', kind: 'number',
    selector: 'input[name$="Row1643869710045-tableItem1643869710049___jqName"]' },

  { id: 'as_oca_cur',  key: 'OTHER_CURRENT_ASSETS_CUR',  kind: 'number',
    selector: 'input[name$="Row1643869716976-tableItem1643869716979___jqName"]' },
  { id: 'as_oca_prev', key: 'OTHER_CURRENT_ASSETS_PREV', kind: 'number',
    selector: 'input[name$="Row1643869716976-tableItem1643869716980___jqName"]' },

  ...BS_BREAKUP_FIELDS,

  /* ===== PHASE 4 — FINANCIAL PARAMETERS: BALANCE SHEET ITEMS ===== */
  { id: 'FP_LEASE', key: 'OPERATING_LEASE_CONVERTED', label: 'III(40) Operating lease converted to financial lease', phase: 4, kind: 'radio',
    selector: 'input[aria-label*="operating lease has been converted"]',
    sectionHeading: 'Financial parameters - Balance sheet items', fieldLabel: 'Whether any operating lease has been converted to financial lease or vice-versa',
    waitForSelector: 'input[aria-label*="Provide details of such conversions"]',
    waitForSectionHeading: 'Financial parameters - Balance sheet items',
    waitForFieldLabel: 'Provide details of such conversions' },
  { id: 'FP_LEASE_DETAILS', key: 'OPERATING_LEASE_DETAILS', label: 'III(40) Details of operating lease conversions', phase: 4, kind: 'text',
    selector: 'input[aria-label*="Provide details of such conversions"], textarea[aria-label*="Provide details of such conversions"]',
    sectionHeading: 'Financial parameters - Balance sheet items', fieldLabel: 'Provide details of such conversions', requireSemantic: true },
  { id: 'FP_NET_WORTH', key: 'NET_WORTH', label: 'III(41) Net Worth of the company', phase: 4, kind: 'number',
    selector: 'input[aria-label*="Net Worth of the company"], input[aria-label*="Net Worth"]',
    sectionHeading: 'Financial parameters - Balance sheet items', fieldLabel: 'Net Worth of the company' },
  { id: 'FP_GROSS_PPE', key: 'GROSS_PPE_INTANGIBLE', label: 'III(44) Gross Property Plant and Equipment and Intangible Assets', phase: 4, kind: 'number',
    selector: 'input[aria-label*="Gross Property Plant and Equipment"], input[aria-label*="Gross Property"]',
    sectionHeading: 'Financial parameters - Balance sheet items', fieldLabel: 'Gross Property Plant and Equipment and Intangible Assets' },
  { id: 'FP_DEP', key: 'DEPRECIATION_AMORTIZATION_BS', label: 'III(45) Depreciation and amortization', phase: 4, kind: 'number',
    selector: 'input[aria-label*="Depreciation and amortization"]',
    sectionHeading: 'Financial parameters - Balance sheet items', fieldLabel: 'Depreciation and amortization' },
  ...FINANCIAL_PARAMETER_BS_FIELDS,

  /* ===== PHASE 5 — SHARE CAPITAL RAISED & COST RECORDS ===== */
  { id: 'SC_BEG_SHARES', key: 'AUTH_SHARES', label: 'IV(i) Equity shares at beginning (Number of shares)', phase: 5, kind: 'number',
    selector: 'input[aria-label*="beginning of the year"], input[name*="beginning"]', index: 0 },
  { id: 'SC_BEG_NOM', key: 'AUTH_NOMINAL', label: 'IV(i) Equity shares at beginning (Total Nominal Amount)', phase: 5, kind: 'number',
    selector: 'input[aria-label*="beginning of the year"], input[name*="beginning"]', index: 1 },
  { id: 'SC_BEG_PAID', key: 'PAID_UP_NOMINAL', label: 'IV(i) Equity shares at beginning (Total Paid-up amount)', phase: 5, kind: 'number',
    selector: 'input[aria-label*="beginning of the year"], input[name*="beginning"]', index: 2 },
  ...SHARE_EQUITY_FIELDS,
  ...SHARE_PREFERENCE_FIELDS,
  { id: 'COST_REC_MAND', key: 'MAINTENANCE_MANDATED', label: 'VI(1) Cost records mandated under Rules 2014', phase: 5, kind: 'radio',
    selector: 'input[aria-label*="maintenance of cost records"], input[aria-label*="Cost Records and Audit"]',
    sectionHeading: 'Details related to cost records and cost audit', fieldLabel: 'Whether maintenance of cost records by the company has been mandated' },
  { id: 'COST_AUD_MAND', key: 'AUDIT_MANDATED', label: 'VI(2) Audit of cost records mandated', phase: 5, kind: 'radio',
    selector: 'input[aria-label*="audit of cost records"]',
    sectionHeading: 'Details related to cost records and cost audit', fieldLabel: 'Whether audit of cost records of the company has been mandated' },

  /* ===== PHASE 6 — SEGMENT II: PROFIT AND LOSS ACCOUNT ===== */
  { id: 'pl_rev_cur', key: 'REVENUE_OPERATIONS_CUR', label: 'P&L Revenue from operations (Current)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Sale or supply of services"], input[aria-label*="Revenue from operations"]' },
  { id: 'pl_rev_prev', key: 'REVENUE_OPERATIONS_PREV', label: 'P&L Revenue from operations (Previous)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Sale or supply of services"], input[aria-label*="Revenue from operations"]', index: 1 },

  { id: 'pl_oi_cur', key: 'OTHER_INCOME_CUR', label: 'P&L Other Income (Current)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Other non-operating income"], input[aria-label*="Other Income"]' },
  { id: 'pl_oi_prev', key: 'OTHER_INCOME_PREV', label: 'P&L Other Income (Previous)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Other non-operating income"], input[aria-label*="Other Income"]', index: 1 },

  { id: 'pl_emp_cur', key: 'EMPLOYEE_EXPENSES_CUR', label: 'P&L Employee benefits (Current)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Employee benefit expenses"]' },
  { id: 'pl_emp_prev', key: 'EMPLOYEE_EXPENSES_PREV', label: 'P&L Employee benefits (Previous)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Employee benefit expenses"]', index: 1 },

  { id: 'pl_fin_cur', key: 'FINANCE_COSTS_CUR', label: 'P&L Finance costs (Current)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Finance cost"]' },
  { id: 'pl_fin_prev', key: 'FINANCE_COSTS_PREV', label: 'P&L Finance costs (Previous)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Finance cost"]', index: 1 },

  { id: 'pl_dep_cur', key: 'DEPRECIATION_CUR', label: 'P&L Depreciation (Current)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Depreciation and amortization expenses"]' },
  { id: 'pl_dep_prev', key: 'DEPRECIATION_PREV', label: 'P&L Depreciation (Previous)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Depreciation and amortization expenses"]', index: 1 },

  { id: 'pl_oth_cur', key: 'OTHER_EXPENSES_CUR', label: 'P&L Other expenses (Current)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Other expenses"]' },
  { id: 'pl_oth_prev', key: 'OTHER_EXPENSES_PREV', label: 'P&L Other expenses (Previous)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Other expenses"]', index: 1 },

  { id: 'pl_tax_cur', key: 'CURRENT_TAX_CUR', label: 'P&L Current tax (Current)', phase: 6, kind: 'number',
    selector: 'input:not([type="hidden"]), textarea',
    sectionHeading: 'Statement of Profit and Loss', fieldLabel: 'Current tax', columnIndex: 0, requireSemantic: true },
  { id: 'pl_tax_prev', key: 'CURRENT_TAX_PREV', label: 'P&L Current tax (Previous)', phase: 6, kind: 'number',
    selector: 'input:not([type="hidden"]), textarea',
    sectionHeading: 'Statement of Profit and Loss', fieldLabel: 'Current tax', columnIndex: 1, requireSemantic: true },

  { id: 'pl_mgr_cur', key: 'MANAGERIAL_REMUNERATION_CUR', label: 'P&L Managerial remuneration (Current)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Managerial remuneration"]' },
  { id: 'pl_mgr_prev', key: 'MANAGERIAL_REMUNERATION_PREV', label: 'P&L Managerial remuneration (Previous)', phase: 6, kind: 'number',
    selector: 'input[aria-label*="Managerial remuneration"]', index: 1 },

  { id: 'pl_deftax_cur', key: 'DEFERRED_TAX_CUR', label: 'P&L Deferred tax (Current)', phase: 6, kind: 'number',
    selector: 'input:not([type="hidden"]), textarea',
    sectionHeading: 'Statement of Profit and Loss', fieldLabel: 'Deferred tax', columnIndex: 0, requireSemantic: true },
  { id: 'pl_deftax_prev', key: 'DEFERRED_TAX_PREV', label: 'P&L Deferred tax (Previous)', phase: 6, kind: 'number',
    selector: 'input:not([type="hidden"]), textarea',
    sectionHeading: 'Statement of Profit and Loss', fieldLabel: 'Deferred tax', columnIndex: 1, requireSemantic: true },

  { id: 'pl_eps_cur', key: 'EPS_BASIC_CUR', label: 'P&L Basic EPS (Current)', phase: 6, kind: 'number',
    selector: 'input:not([type="hidden"]), textarea',
    sectionHeading: 'Statement of Profit and Loss', fieldLabel: 'Basic', columnIndex: 0, rowOccurrence: 0, requireSemantic: true },
  { id: 'pl_eps_prev', key: 'EPS_BASIC_PREV', label: 'P&L Basic EPS (Previous)', phase: 6, kind: 'number',
    selector: 'input:not([type="hidden"]), textarea',
    sectionHeading: 'Statement of Profit and Loss', fieldLabel: 'Basic', columnIndex: 1, rowOccurrence: 0, requireSemantic: true },

  { id: 'pl_eps_diluted_cur', key: 'EPS_DILUTED_CUR', label: 'P&L Diluted EPS (Current)', phase: 6, kind: 'number',
    selector: 'input:not([type="hidden"]), textarea',
    sectionHeading: 'Statement of Profit and Loss', fieldLabel: 'Diluted', columnIndex: 0, rowOccurrence: 0, requireSemantic: true },
  { id: 'pl_eps_diluted_prev', key: 'EPS_DILUTED_PREV', label: 'P&L Diluted EPS (Previous)', phase: 6, kind: 'number',
    selector: 'input:not([type="hidden"]), textarea',
    sectionHeading: 'Statement of Profit and Loss', fieldLabel: 'Diluted', columnIndex: 1, rowOccurrence: 0, requireSemantic: true },

  ...PROFIT_LOSS_DETAIL_FIELDS,
  ...FX_INCOME_FIELDS,
  ...FX_EXPENSE_FIELDS,
  ...FINANCIAL_PARAMETER_PL_FIELDS,

  { id: 'PROD_CAT_NUM', key: 'TOTAL_CATEGORIES', label: 'IV Total number of product/services categories', phase: 7, kind: 'number',
    selector: 'input[aria-label*="Total number of product"]' },
  { id: 'PROD_CAT_CODE', key: 'CATEGORY_CODE', label: 'IV Product/service category code (ITC/NPCS 4 digit)', phase: 7, kind: 'text',
    selector: 'input[aria-label*="category code"]' },
  { id: 'PROD_CAT_DESC', key: 'CATEGORY_DESC', label: 'IV Description of product/service category', phase: 7, kind: 'text',
    selector: 'input[aria-label*="Description of the product or service category"]' },
  { id: 'PROD_CAT_TURNOVER', key: 'CATEGORY_TURNOVER', label: 'IV Turnover of product/service category', phase: 7, kind: 'number',
    selector: 'input[aria-label*="Turnover of the product or service category"]' },
  { id: 'PROD_HIGH_CODE', key: 'HIGHEST_CODE', label: 'IV Highest contributing code (8 digit)', phase: 7, kind: 'text',
    selector: 'input[aria-label*="Highest turnover contributing product"]' },
  { id: 'PROD_HIGH_DESC', key: 'HIGHEST_DESC', label: 'IV Description of highest product/service', phase: 7, kind: 'text',
    selector: 'input[aria-label*="Description of the product or service"]:not([aria-label*="category"])' },
  { id: 'PROD_HIGH_TURNOVER', key: 'HIGHEST_TURNOVER', label: 'IV Turnover of highest product/service', phase: 7, kind: 'number',
    selector: 'input[aria-label*="Turnover of highest contributing product"]' },

  /* ===== PHASE 7 — DISCLOSURES (SEGMENTS III–VI) ===== */
  { id: 'RPT_ANY', key: 'ANY_TRANSACTION', label: 'Segment III: Any Related Party Transactions', phase: 7, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel3AOC4-guideradiobutton___jqName',
    selector: 'input[aria-label*="transactions entered with related party"], input[aria-label*="related party"]',
    sectionHeading: 'DISCLOSURE ABOUT RELATED PARTY TRANSACTIONS',
    fieldLabel: 'Whether any transactions entered with related party' },

  { id: 'AUD_CAG', key: 'CAG_COMMENTED', label: 'Segment IV: CAG commented/supplemented', phase: 7, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel4AOC4-guideradiobutton___jqName',
    selector: 'input[aria-label*="Comptroller and Auditor-General"], input[aria-label*="CAG of India"], input[aria-label*="section 143"]',
    sectionHeading: 'AUDITOR\'S REPORT',
    fieldLabel: 'In case of a government company, whether Comptroller and Auditor-General of India (CAG of India) has commented upon or supplemented the audit report under section 143' },

  { id: 'CSR_APP', key: 'CSR_APPLICABILITY', label: 'Segment V: CSR Applicability', phase: 7, kind: 'select',
    selector: 'select[aria-label*="CSR applicability"], select[aria-label*="Corporate Social Responsibility"], select[name*="CSR"]',
    sectionHeading: 'REPORTING OF CORPORATE SOCIAL RESPONSIBILITY',
    fieldLabel: 'CSR applicability pursuant to' },

  { id: 'SEC_AUD_APP', key: 'SECRETARIAL_AUDIT_APPLICABLE', label: 'Segment VI: Secretarial Audit Applicable', phase: 7, kind: 'radio',
    name: 'guideContainer-rootPanel-panel-panel-panel6AOC4-guideradiobutton___jqName',
    selector: 'input[aria-label*="Secretarial Audit is applicable"], input[aria-label*="Secretarial Audit"]',
    sectionHeading: 'SEGMENT-VI MISCELLANEOUS',
    fieldLabel: 'Whether the Secretarial Audit is applicable' }
];

// All BS/Asset rows → Phase 3. Anything else without explicit phase → Phase 2.
for (const f of FIELD_MAPPINGS) if (!f.phase) f.phase = /^(bs|as)_/.test(f.id) ? 3 : 2;

function flattenClient(c) {
  const out = {};
  // Flatten top-level sections — order matters (general wins over others if keys clash)
  Object.assign(out,
    c.principalProducts   || {},
    c.costRecords         || {},
    c.financialParametersBS || {},
    c.financialParametersPL || {},
    c.shareCapital        || {},
    c.shareCapitalRaised  || {},
    c.secretarialAudit    || {},
    c.csr                 || {},
    c.auditorReport       || {},
    c.relatedParty        || {},
    c.disclosures         || {},
    c.industry            || {},
    c.subsidiary          || {},
    c.auditor             || {},
    c.general             || {}   // general last so it always overrides
  );
  for (const [prefix, list] of [['FS', c.signatoriesFS], ['BR', c.signatoriesBR]]) {
    (list || []).forEach((s, i) => {
      const n = i + 1;
      out[`${prefix}_SIG_${n}_DIN`]   = s.din;
      out[`${prefix}_SIG_${n}_NAME`]  = s.name;
      out[`${prefix}_SIG_${n}_DESIG`] = s.designation;
      out[`${prefix}_SIG_${n}_DATE`]  = s.date;
    });
  }
  const bsCur  = (c.balanceSheet && c.balanceSheet.current)  || {};
  const bsPrev = (c.balanceSheet && c.balanceSheet.previous) || {};
  for (const k of Object.keys(bsCur))  out[`${k}_CUR`]  = bsCur[k];
  for (const k of Object.keys(bsPrev)) out[`${k}_PREV`] = bsPrev[k];
  const plCur  = (c.profitLoss && c.profitLoss.current)  || {};
  const plPrev = (c.profitLoss && c.profitLoss.previous) || {};
  for (const k of Object.keys(plCur))  out[`${k}_CUR`]  = plCur[k];
  for (const k of Object.keys(plPrev)) out[`${k}_PREV`] = plPrev[k];
  for (const section of [c.balanceSheetBreakup, c.profitLossDetails, c.foreignExchange]) {
    for (const [key, values] of Object.entries(section || {})) {
      if (Object.prototype.hasOwnProperty.call(values || {}, 'current')) out[`${key}_CUR`] = values.current;
      if (Object.prototype.hasOwnProperty.call(values || {}, 'previous')) out[`${key}_PREV`] = values.previous;
    }
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FIELD_MAPPINGS, PHASES, flattenClient };
}
