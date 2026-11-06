/**
 * SPICe+ Part A field definitions — ported from the Chrome extension's field-map.js.
 * Each field has multiple fallback selectors so it works across MCA form versions.
 */

export const SPICE_PART_A_FIELDS = [
  {
    key: 'language',
    label: 'Form language',
    selector: "input[type='radio'][name='guideContainer-rootPanel-panel_2038535412-panel_388123247_copy-panel_1385805192-guideradiobutton___jqName'], input[type='radio'][name='guideContainer-rootPanel-panel_388123247_copy_2026367711-panel_1385805192-guideradiobutton___jqName']",
    type: 'radio',
    dataKey: 'Language',
    optional: true,
  },
  {
    key: 'companyType',
    label: 'Type of company',
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist___widget, select[name='guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist___jqName']",
    type: 'select',
    dataKey: 'Company type',
  },
  {
    key: 'companyClass',
    label: 'Class of company',
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co___widget, select[name='guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co___jqName'], select[name='companyClass']",
    type: 'select',
    dataKey: 'Company class',
  },
  {
    key: 'companyCategory',
    label: 'Company category',
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co_1813708729___widget, select[name='guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co_1813708729___jqName']",
    type: 'select',
    dataKey: 'Company category',
  },
  {
    key: 'companySubCategory',
    label: 'Company sub-category',
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co_175619313___widget, select[name='guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co_175619313___jqName']",
    type: 'select',
    dataKey: 'Company sub-category',
    optional: true,
  },
  {
    key: 'nicCode',
    label: 'Main NIC Code',
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-panel_77849537-panel_896788791_copy-guidetextbox___widget, input[name='guideContainer-rootPanel-panel_2017717670_cop-panel-panel_77849537-panel_896788791_copy-guidetextbox___jqName']",
    type: 'text',
    dataKey: 'NIC code',
  },
  {
    key: 'mainActivity',
    label: 'Business activity description',
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-panel_77849537-panel_896788791_copy-guidetextbox_3059927___widget, textarea[name='guideContainer-rootPanel-panel_2017717670_cop-panel-panel_77849537-panel_896788791_copy-guidetextbox_3059927___jqName']",
    type: 'text',
    dataKey: 'Business activity',
  },
  {
    key: 'proposedName1',
    label: 'Proposed Name 1',
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel_copy-panel-panel-guidetextbox_1884163___widget, input[name='guideContainer-rootPanel-panel_2017717670_cop-panel_copy-panel-panel-guidetextbox_1884163___jqName'], #guideContainer-rootPanel-panel_2038535412-panel_2017717670_cop-panel-panel_copy-guidetextbox_1884163___widget",
    type: 'text',
    dataKey: 'proposedName1',
  },
  {
    key: 'proposedName2',
    label: 'Proposed Name 2',
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel_copy-panel-panel_2003762916-guidetextbox_4394968___widget, input[name='guideContainer-rootPanel-panel_2017717670_cop-panel_copy-panel-panel_2003762916-guidetextbox_4394968___jqName'], #guideContainer-rootPanel-panel_2038535412-panel_2017717670_cop-panel-panel_2003762916_cop-guidetextbox_4394968___widget",
    type: 'text',
    dataKey: 'proposedName2',
    optional: true,
  },
  {
    key: 'llpin',
    label: 'LLPIN',
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-guidetextbox_1884163___widget, input[name='guideContainer-rootPanel-panel_2017717670_cop-panel-guidetextbox_1884163___jqName']",
    type: 'text',
    dataKey: 'LLPIN',
    optional: true,
  },
];

// Company type mapping — Ledgerly case data → MCA dropdown text
const COMPANY_TYPE_MAP = {
  PRIVATE_LIMITED: 'New Company (Others)',
  OPC: 'Private (OPC)',
  SECTION_8: 'Section 8 Company',
  NIDHI: 'Nidhi Company',
  PRODUCER: 'Producer Company',
  UNLIMITED: 'Unlimited Company',
  IFSC: 'IFSC Company',
  LLP_CONVERSION: 'Part I LLP to Company',
  FIRM_CONVERSION: 'Part I Firm to Company',
  PUBLIC_LIMITED: 'New Company (Others)',
};

const COMPANY_CLASS_MAP = {
  PRIVATE_LIMITED: 'Private',
  OPC: 'One Person Company',
  PUBLIC_LIMITED: 'Public',
};

const COMPANY_CATEGORY_MAP = {
  PRIVATE_LIMITED: 'Company limited by Shares',
  OPC: 'Company limited by Shares',
  PUBLIC_LIMITED: 'Company limited by Shares',
};

/**
 * Build a flat key→value map from Ledgerly case + director data.
 * Keys match the `dataKey` in SPICE_PART_A_FIELDS.
 */
export function buildFieldValues(caseData, directors = [], options = {}) {
  const ct = caseData.company_type || 'PRIVATE_LIMITED';

  return {
    Language: 'English',
    'Company type': COMPANY_TYPE_MAP[ct] || 'New Company (Others)',
    'Company class': COMPANY_CLASS_MAP[ct] || 'Private',
    'Company category': COMPANY_CATEGORY_MAP[ct] || 'Company limited by Shares',
    'Company sub-category': '',
    'NIC code': caseData.nic_code || options.nicCode || '',
    'Business activity': caseData.nic_description || options.businessActivity || '',
    proposedName1: caseData.proposed_company_name || '',
    proposedName2: options.alternateName || '',
    LLPIN: options.llpin || '',
  };
}
