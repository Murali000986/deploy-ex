// SPICe+ Part A (Name Reservation) — field list for the extension's fill engine.
// Depends on js/spice-a-shared.js (SPICE_A_TYPE_OPTIONS) being loaded first.
//
// Unlike field-mapper.js (AOC-4), these fields are matched by LABEL TEXT, not by MCA's generated
// `name` attribute. SPICe+ Part A is a single short page (no repeated table rows), so label
// matching — the same technique content_script.js's scanner already uses to describe a field
// (aria-label, then placeholder, then <label for>, then the nearest row's text) — is simpler and
// more resilient than guessing AEM's per-session selectors. If MCA's live wording differs, tune
// `labelRe` here using Debug -> Scan Form Fields in the popup (works on any mca.gov.in tab).
//
// kind: 'select' | 'text' | 'nic' (text that also tries to pick an autocomplete suggestion)
// index: which match to use when more than one element on the page has a matching label
//        (e.g. three NIC code boxes, or Proposed name 1/2).

const SPICE_A_FIELDS = [
  { key: 'SPICE_TYPE_OF_COMPANY', label: 'Type of company', kind: 'select',
    labelRe: 'type\\s*of\\s*company', optionMap: SPICE_A_TYPE_OPTIONS, required: true },

  { key: 'SPICE_LLPIN', label: 'LLPIN', kind: 'text', labelRe: '\\bLLPIN\\b',
    requiredIf: d => d.SPICE_TYPE_OF_COMPANY === 'part1_llp_to_company' },

  { key: 'SPICE_NIC_CODE_1', label: 'NIC code 1 (primary)', kind: 'nic',
    labelRe: 'nic\\s*code|industry\\s*sub-?class', index: 0, required: true },
  { key: 'SPICE_NIC_CODE_2', label: 'NIC code 2', kind: 'nic',
    labelRe: 'nic\\s*code|industry\\s*sub-?class', index: 1 },
  { key: 'SPICE_NIC_CODE_3', label: 'NIC code 3', kind: 'nic',
    labelRe: 'nic\\s*code|industry\\s*sub-?class', index: 2 },

  { key: 'SPICE_MAIN_SUBCLASS', label: 'Main sub-class of industrial activity', kind: 'text',
    labelRe: 'main\\s*sub-?class', onlyIfEmpty: true },

  { key: 'SPICE_NAME_1', label: 'Proposed name 1', kind: 'text',
    labelRe: 'proposed.*name|particulars.*proposed', index: 0, required: true, maxLength: 75 },
  { key: 'SPICE_NAME_2', label: 'Proposed name 2', kind: 'text',
    labelRe: 'proposed.*name|particulars.*proposed', index: 1, maxLength: 75 }
];

function spiceAPhaseFields() {
  return SPICE_A_FIELDS;
}

// Builds fill jobs from flat client data ({KEY: value}), same convention as buildJobs() in
// phase-runner.js. requiredIf is evaluated here (on data), not inside the page.
function spiceABuildJobs(data) {
  const jobs = [];
  for (const f of SPICE_A_FIELDS) {
    const value = data[f.key];
    if (value === undefined || value === null || value === '') continue;
    jobs.push({
      key: f.key, label: f.label, kind: f.kind,
      labelRe: f.labelRe, index: f.index || 0, value: String(value),
      optionMap: f.optionMap || null, onlyIfEmpty: !!f.onlyIfEmpty
    });
  }
  return jobs;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SPICE_A_FIELDS, spiceAPhaseFields, spiceABuildJobs };
}
