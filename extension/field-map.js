// SPICe+ Part A field map
// Each entry: { key, label, selector, type, dataKey }
// dataKey: which key in the draft's submittedFields or proposedNames maps to this field
// Selectors are best-effort based on MCA's known form structure.
// Content script checks selector existence before filling; skips + reports if absent.

const SPICE_PART_A_FIELDS = [
  {
    key: "language",
    label: "Form language",
    selector: "input[type='radio'][name='guideContainer-rootPanel-panel_2038535412-panel_388123247_copy-panel_1385805192-guideradiobutton___jqName'], input[type='radio'][name='guideContainer-rootPanel-panel_388123247_copy_2026367711-panel_1385805192-guideradiobutton___jqName']",
    type: "radio",
    dataKey: "Language",
    optional: true,
  },
  {
    key: "requestType",
    label: "Request type",
    selector: "input[type='radio'][name='guideContainer-rootPanel-panel_2038535412-panel_2017717670_cop-panel-panel_1731458616-guideradiobutton___jqName']",
    type: "radio",
    dataKey: "Request type",
    optional: true,
  },
  {
    key: "companyType",
    label: "Type of company",
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist___widget, select[name='guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist___jqName']",
    type: "select",
    dataKey: "Company type",
  },
  {
    key: "llpin",
    label: "LLPIN",
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-guidetextbox_1884163___widget, input[name='guideContainer-rootPanel-panel_2017717670_cop-panel-guidetextbox_1884163___jqName']",
    type: "text",
    dataKey: "LLPIN",
    optional: true,
  },
  {
    key: "llpinCinType",
    label: "LLPIN or CIN type",
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co_226026912___widget, select[name='guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co_226026912___jqName']",
    type: "select",
    dataKey: "LLPIN/CIN type",
    optional: true,
  },
  {
    key: "cin",
    label: "CIN",
    selector: "#guideContainer-rootPanel-panel_2038535412-panel_2017717670_cop-panel-panel-guidetextbox_copy___widget, input[name='guideContainer-rootPanel-panel_2038535412-panel_2017717670_cop-panel-panel-guidetextbox_copy___jqName']",
    type: "text",
    dataKey: "CIN",
    optional: true,
  },
  {
    key: "proposedName1",
    label: "Proposed Name 1",
    selector: "#guideContainer-rootPanel-panel_2038535412-panel_2017717670_cop-panel-panel_copy-guidetextbox_1884163___widget, input[name='guideContainer-rootPanel-panel_2038535412-panel_2017717670_cop-panel-panel_copy-guidetextbox_1884163___jqName'], #guideContainer-rootPanel-panel_2017717670_cop-panel_copy-panel-panel-guidetextbox_1884163___widget, input[name='guideContainer-rootPanel-panel_2017717670_cop-panel_copy-panel-panel-guidetextbox_1884163___jqName'], input[name='proposedName1'], input[id='proposedName1'], input[placeholder*='proposed' i]",
    type: "text",
    dataKey: "proposedName1",
  },
  {
    key: "proposedName2",
    label: "Proposed Name 2",
    selector: "#guideContainer-rootPanel-panel_2038535412-panel_2017717670_cop-panel-panel_2003762916_cop-guidetextbox_4394968___widget, input[name='guideContainer-rootPanel-panel_2038535412-panel_2017717670_cop-panel-panel_2003762916_cop-guidetextbox_4394968___jqName'], #guideContainer-rootPanel-panel_2017717670_cop-panel_copy-panel-panel_2003762916-guidetextbox_4394968___widget, input[name='guideContainer-rootPanel-panel_2017717670_cop-panel_copy-panel-panel_2003762916-guidetextbox_4394968___jqName'], input[name='proposedName2'], input[id='proposedName2']",
    type: "text",
    dataKey: "proposedName2",
  },
  {
    key: "comments",
    label: "Comments",
    selector: "#guideContainer-rootPanel-panel_2038535412-panel_2017717670_cop-guidetextbox_8496882___widget, textarea[name='guideContainer-rootPanel-panel_2038535412-panel_2017717670_cop-guidetextbox_8496882___jqName']",
    type: "text",
    dataKey: "Comments",
    optional: true,
  },
  {
    key: "proposedName3",
    label: "Proposed company name (3rd choice)",
    selector: "input[name='proposedName3'], input[id='proposedName3']",
    type: "text",
    dataKey: "proposedName3",
  },
  {
    key: "companyClass",
    label: "Company class / type",
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co___widget, select[name='guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co___jqName'], select[name='companyClass'], select[id='companyClass'], select[name='class']",
    type: "select",
    dataKey: "Company class",
  },
  {
    key: "companyCategory",
    label: "Company category",
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co_1813708729___widget, select[name='guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co_1813708729___jqName'], select[name='companyCategory'], select[id='companyCategory']",
    type: "select",
    dataKey: "Company category",
  },
  {
    key: "companySubCategory",
    label: "Company sub-category",
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co_175619313___widget, select[name='guideContainer-rootPanel-panel_2017717670_cop-panel-guidedropdownlist_co_175619313___jqName'], select[name='companySubCategory'], select[id='companySubCategory']",
    type: "select",
    dataKey: "Company sub-category",
  },
  {
    key: "nicCode",
    label: "NIC code",
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-panel_77849537-panel_896788791_copy-guidetextbox___widget, input[name='guideContainer-rootPanel-panel_2017717670_cop-panel-panel_77849537-panel_896788791_copy-guidetextbox___jqName'], input[name='nicCode'], input[id='nicCode'], input[name='mainDivision']",
    type: "text",
    dataKey: "NIC code",
  },
  {
    key: "mainActivity",
    label: "Main industrial activity description",
    selector: "#guideContainer-rootPanel-panel_2017717670_cop-panel-panel_77849537-panel_896788791_copy-guidetextbox_3059927___widget, textarea[name='guideContainer-rootPanel-panel_2017717670_cop-panel-panel_77849537-panel_896788791_copy-guidetextbox_3059927___jqName'], input[name='mainActivity'], textarea[name='mainActivity'], input[id='mainActivity']",
    type: "text",
    dataKey: "Business activity",
  },
  {
    key: "trademarkNumber",
    label: "Trademark application number (if applicable)",
    selector: "input[name='trademarkNo'], input[id='trademarkNo']",
    type: "text",
    dataKey: "Trademark number",
    optional: true,
  },
];

// Company type label → MCA dropdown option text mapping
const COMPANY_TYPE_MAP = {
  "PRIVATE_LIMITED": "Private",
  "OPC":             "One Person Company",
  "PUBLIC_LIMITED":  "Public",
};

// MCA's first dropdown chooses the legal form; the class dropdown is separate.
const COMPANY_FORM_MAP = {
  "PRIVATE_LIMITED": "Company",
  "OPC":             "Company",
  "LLP":             "LLP",
  "PUBLIC_LIMITED":  "Company",
};

// Company category → MCA option text
const COMPANY_CATEGORY_MAP = {
  "PRIVATE_LIMITED": "Company limited by Shares",
  "OPC":             "Company limited by Shares",
  "PUBLIC_LIMITED":  "Company limited by Shares",
};
