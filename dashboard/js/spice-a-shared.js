// SPICe+ Part A (Name Reservation) — rules shared by the Dashboard (spice-a.html) and the
// extension popup. Plain JS, no chrome.* calls, so both a browser page and the extension can
// load it directly. Source: Instruction Kit for webform SPICe+ Part A, Part III §3.1/3.2 and
// Annexure B (special characters MCA allows in a company name).

// Illustrative name forms by company type (Instruction Kit §3.1, "Particulars of the proposed
// or approved name", point v). Used only as a soft check — MCA's own Auto Check is authoritative.
const SPICE_A_SUFFIX_OPTIONS = [
  { id: 'opc', label: 'One Person Company', suffixRe: /\(opc\)\s*private\s*limited$/i, example: 'ABC (OPC) Private Limited' },
  { id: 'private', label: 'Private Limited (other than Producer company)', suffixRe: /(?<!\(opc\)\s)private\s*limited$/i, example: 'ABC Private Limited' },
  { id: 'producer', label: 'Producer Company', suffixRe: /producer\s*company\s*limited$/i, example: 'ABC Producer Company Limited' },
  { id: 'public', label: 'Public Limited', suffixRe: /(?<!private\s)(?<!unlimited\s)limited$/i, example: 'ABC Limited' },
  { id: 'unlimited_private', label: 'Unlimited liability — Private', suffixRe: /private\s*unlimited$/i, example: 'ABC Private Unlimited' },
  { id: 'unlimited_public', label: 'Unlimited liability — Public', suffixRe: /(?<!private\s)unlimited$/i, example: 'ABC Unlimited' }
];

// "Type of company" dropdown — the Instruction Kit does not print MCA's exact option text, only
// that it is "select[ed] from the dropdown options provided". These regexes match the common live
// wording; if MCA's page differs, tune them (Debug -> Scan Form Fields in the popup reads the live
// option text on any mca.gov.in tab, including this form).
const SPICE_A_TYPE_OPTIONS = {
  new_company: { id: 'new_company', label: 'New Company', re: '^new\\s*company$' },
  part1_company: { id: 'part1_company', label: 'Part I Company', re: '^part\\s*i\\s*company$' },
  producer_company: { id: 'producer_company', label: 'Producer Company', re: 'producer\\s*company' },
  section8_company: { id: 'section8_company', label: 'Section 8 Company', re: 'section\\s*8' },
  ifsc_company: { id: 'ifsc_company', label: 'IFSC Company', re: 'ifsc' },
  part1_llp_to_company: { id: 'part1_llp_to_company', label: 'Part I LLP to Company', re: 'part\\s*i\\s*llp\\s*to\\s*company' }
};

// Annexure B — special characters MCA allows in a company name (plus space, item 32).
const SPICE_A_ALLOWED_SPECIAL_CHARS = ['`', '@', '#', '$', '%', '&', '*', '(', ')', '-', '_', '=', '+', '[', '{', '}', ']', '|', '\\', ';', ':', '"', ',', '<', '.', '>', '/', '?', '~', '!', "'", ' '];

function spiceAIsAllowedNameChar(ch) {
  return /[A-Za-z0-9]/.test(ch) || SPICE_A_ALLOWED_SPECIAL_CHARS.indexOf(ch) !== -1;
}

function spiceAHasDisallowedChar(name) {
  return Array.from(String(name || '')).some(ch => !spiceAIsAllowedNameChar(ch));
}

// Returns { errors, warnings } — errors block sending/Auto Check, warnings are informational.
function validateSpiceAName(name, suffixCategoryId) {
  const errors = [];
  const warnings = [];
  const trimmed = String(name || '').trim();
  if (!trimmed) return { errors, warnings };
  if (trimmed.length > 75) errors.push('Exceeds the 75-character limit for a company name.');
  if (!/^[\x00-\x7F]*$/.test(trimmed)) errors.push('Contains a non-ASCII character — not allowed.');
  if (spiceAHasDisallowedChar(trimmed)) errors.push('Contains a character outside letters, digits and the special characters MCA allows (Annexure B).');
  if (/(^|\s)(pvt\.?|\(p\)|ltd\.?)\s*$/i.test(trimmed)) errors.push('Must not end in the abbreviation "Pvt"/"(P)"/"Ltd" — spell out "Private"/"Limited".');
  if (suffixCategoryId) {
    const cat = SPICE_A_SUFFIX_OPTIONS.find(c => c.id === suffixCategoryId);
    if (cat && !cat.suffixRe.test(trimmed)) {
      warnings.push(`Does not end like the illustrative form for this company type (e.g. "${cat.example}") — check before Auto Check.`);
    }
  }
  return { errors, warnings };
}

function validateSpiceANicCode(code) {
  const warnings = [];
  const trimmed = String(code || '').trim();
  if (trimmed && !/^\d{5}$/.test(trimmed)) warnings.push('NIC 2008 codes are normally 5 digits.');
  return warnings;
}

function buildSpiceAMainSubclass(descriptions) {
  return (descriptions || []).filter(Boolean).join(', ');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SPICE_A_SUFFIX_OPTIONS, SPICE_A_TYPE_OPTIONS, SPICE_A_ALLOWED_SPECIAL_CHARS,
    validateSpiceAName, validateSpiceANicCode, buildSpiceAMainSubclass
  };
}
