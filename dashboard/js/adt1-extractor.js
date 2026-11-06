/* ADT-1 document extractor: shared by dashboard.html (browser) and the Node tests. No DOM.

   Input : docs = [{ name, text }]  (text = plain text of ONE document: pdf.js items joined with single
           spaces, pdftotext -layout output, DOCX or TXT text).
   Output: extractAdt1(docs) -> { proposals, docTypes, notes }
           proposals = [{ key, value, confidence 0..1, method: 'rules'|'ai'|'both',
                          evidence: { file, quote }, conflict?: true, alsoIn?: [file] }]
           `key` is an ADT-1 dataKey (see js/adt1-form.js). Dates are ISO (YYYY-MM-DD), selects hold the
           EXACT option strings. A value that is not clearly STATED in a document is never proposed.
   Where two documents (or the rules and the AI) disagree, both values are emitted with lower
   confidence and conflict:true, so the UI can show the clash and let the user decide.

   Speed: each document is normalised once into one string and every rule is a bounded regex; the four
   sample PDFs take a few milliseconds in total. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ADT1Extract = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ───────────── constants (kept in sync with js/adt1-form.js; a test checks this) ───────────── */
  const NATURE = {
    FIRST: 'First auditor by Board of directors/ members/ C&AG',
    AGM: 'Appointment of Auditors in AGM',
    REAPP: 'Re-appointment of Auditors in AGM',
    CAG: 'Appointment/ Re-appointment by C&AG',
    CASUAL: 'Auditor appointed in case of casual vacancy',
    NONREAPP: 'Auditor appointed in case of non-re-appointment/ removal of the previous auditor',
    TRIB: 'Auditor appointed by the Tribunal',
    CENTRAL: 'Auditor appointed by Central Government',
    OTHERS: 'Others'
  };
  const NATURE_OPTIONS = [NATURE.FIRST, NATURE.AGM, NATURE.REAPP, NATURE.CAG, NATURE.CASUAL, NATURE.NONREAPP, NATURE.TRIB, NATURE.CENTRAL, NATURE.OTHERS];
  const DESIGNATIONS = ['Director', 'Manager', 'Company Secretary', 'CEO', 'CFO', 'Liquidator', 'Interim Resolution Professional (IRP)', 'Resolution Professional (RP)'];
  const CAT_FIRM = "Auditor's Firm", CAT_IND = 'Individual';
  const YN = ['Yes', 'No'];
  const SELECTS = {
    classUnder139_2: YN, natureOfAppointment: NATURE_OPTIONS, appointedInAgm: YN, jointAuditors: YN,
    auditorCategory: [CAT_FIRM, CAT_IND], within20CompaniesLimit: YN, previouslyAudited: YN,
    auditCommitteeRecommendation: ['Yes', 'No', 'Not Applicable'],
    casualVacancyReason: ['Resignation', 'Others (death, disqualification)'], signatoryDesignation: DESIGNATIONS
  };
  const KIND = {};
  const kind = (k, ...keys) => keys.forEach(x => { KIND[x] = k; });
  kind('cin', 'cin'); kind('pan', 'firmPan', 'auditorPan'); kind('pin', 'firmPin', 'auditorPin');
  kind('int', 'numAuditorsAppointed', 'numFinancialYears', 'numPriorFinancialYears');
  kind('date', 'agmDate', 'dateOfAppointment', 'periodFrom', 'periodTo', 'priorRow1FyStart', 'priorRow1FyEnd', 'casualVacancyDate', 'resolutionDate');
  kind('email', 'companyEmail', 'firmEmail', 'auditorEmail');
  kind('frn', 'firmRegistrationNumber', 'priorRow1FirmReg', 'vacatedFirmRegNumber');
  kind('mem', 'membershipNumber', 'priorRow1Membership', 'vacatingAuditorMembership');
  kind('srn', 'inc28Srn', 'relevantFormSrn'); kind('resno', 'resolutionNumber'); kind('ident', 'signatoryIdentifier');
  kind('person', 'auditorName'); kind('org', 'companyName', 'firmName');
  kind('text', 'companyAddress', 'firmAddr1', 'firmAddr2', 'firmCountry', 'firmArea', 'firmCity', 'firmDistrict', 'firmState',
    'auditorAddr1', 'auditorAddr2', 'auditorCountry', 'auditorArea', 'auditorCity', 'auditorDistrict', 'auditorState',
    'natureOfAppointmentOther', 'casualVacancyOtherReason', 'casualVacancyReasonText');
  for (const k of Object.keys(SELECTS)) KIND[k] = 'select';
  const KEYS = Object.keys(KIND);
  const ID_KINDS = new Set(['cin', 'pan', 'pin', 'frn', 'mem', 'srn', 'ident', 'resno', 'email']);

  /* ───────────── text helpers ───────────── */
  const MON = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  // A date as written in the documents. pdf.js sometimes splits digits ("2 0th April , 202 6"), so digit groups may contain single spaces.
  const DT = `(?:(?<![\\d/.-])\\d(?: ?\\d)?\\s?(?:st|nd|rd|th)?\\s*(?:day\\s+of\\s+)?,?\\s*(?:${MON})\\.?\\s*,?\\s*\\d(?: ?\\d){3}|(?<![\\d/.-])\\d{1,2}\\s?[\\/.-]\\s?\\d{1,2}\\s?[\\/.-]\\s?\\d{4}|\\d{4}-\\d{2}-\\d{2})`;
  const DATE_RE = () => new RegExp(DT, 'gi');
  const pad2 = n => String(n).padStart(2, '0');
  const realDate = (y, m, d) => { if (y < 1990 || y > 2100) return false; const dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d; };
  const isoOf = (y, m, d) => (realDate(y, m, d) ? `${y}-${pad2(m)}-${pad2(d)}` : '');

  /** "2 0th April , 2026" | "20/04/2026" | "2026-04-20" -> "2026-04-20"; anything else -> ''. */
  function parseDate(raw) {
    const s = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return isoOf(+m[1], +m[2], +m[3]);
    m = /^(\d{1,2})\s?[\/.-]\s?(\d{1,2})\s?[\/.-]\s?(\d{4})$/.exec(s);
    if (m) return isoOf(+m[3], +m[2], +m[1]);
    m = new RegExp(`^(\\d(?: ?\\d)?)\\s?(?:st|nd|rd|th)?\\s*(?:day\\s+of\\s+)?,?\\s*(${MON})\\.?\\s*,?\\s*(\\d(?: ?\\d){3})$`, 'i').exec(s);
    if (m) return isoOf(+m[3].replace(/ /g, ''), MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1].replace(/ /g, ''));
    return '';
  }
  /** Every real date in `s`: [{ iso, index, end }]. */
  function findDates(s) {
    const out = []; const re = DATE_RE(); let m;
    while ((m = re.exec(s))) { const iso = parseDate(m[0]); if (iso) out.push({ iso, index: m.index, end: m.index + m[0].length }); }
    return out;
  }
  const firstDate = s => { const d = findDates(s || '')[0]; return d ? d.iso : ''; };

  /** One normalisation pass: smart quotes, bullets, runs of underscores, all whitespace -> single spaces. */
  const norm = s => String(s == null ? '' : s)
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/[ •●▪�]/g, ' ').replace(/_{3,}/g, ' ___ ')
    .replace(/\s+/g, ' ').trim();
  const loose = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const cap = (s, n) => (s.length > n ? s.slice(0, n).trim() : s);

  /* ───────────── value validation: one place for rules AND AI output ───────────── */
  const RE = {
    cin: /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/, pan: /^[A-Z]{5}\d{4}[A-Z]$/, din: /^\d{8}$/, pin: /^[1-9]\d{5}$/,
    email: /^[^\s@*]+@[^\s@*]+\.[^\s@*]+$/, srn: /^[A-Z]{1,2}\d{7,9}$/, frn: /^(?:\d{4,7}[A-Z]{1,2}|[A-Z]\d{5,7})$/, mem: /^\d{4,7}$/
  };
  const NAME_STOP = new Set(('of the to for by at on in is are was and or board directors director meeting copy company resolutions resolution passed certified true held ' +
    'appointment approval first statutory auditors auditor subject sub dear date thank you yours regards sincerely faithfully from with limited ltd private pvt llp name address ' +
    'mr mrs ms sir madam registered office situated place din cin pan certificate consent chartered accountants accountant members member shareholders m/s messrs').split(' '));
  const FIRM_WORD = /(?:&|\band\b)\s*(?:Co\b|Company|Associates|Partners|Assoc)|\bLLP\b|\bAssociates\b|\bChartered Accountants\b/i;
  // Words that start an address, so a firm-name candidate must stop before them ("M/s Test & Co Flat 4, ...").
  const ADDR_START = /\s+(?:Flat|Shop|Plot|House|Door|Office|Floor|Room|Unit|No\.?|#|H\.?\s?No\.?|\d)/i;
  const ADDR_STOP = new Set(['flat', 'shop', 'plot', 'house', 'door', 'office', 'floor', 'room', 'unit', 'no', 'hno', 'thank', 'you', 'for', 'regards', 'yours', 'sincerely', 'faithfully', 'truly', 'the', 'we', 'i']);
  const stripMs = s => String(s || '').replace(/^(?:M\/s\.?|Messrs\.?)\s*/i, '').replace(/[,\s]+$/, '').trim();

  /** A person's name. `heuristic` = the name was guessed from running text (walk-back, "I, <Name>", a signing line),
   *  so common document words are rejected too; a labelled row, a saved client file or an AI answer is not filtered
   *  that way, because real surnames such as "Date" or "Place" would be thrown out. */
  function cleanPerson(raw, heuristic) {
    let s = norm(raw).replace(/^(?:CA|C\.A\.?|Mr|Mrs|Ms|Shri|Smt|Dr)\.?\s+/i, '').replace(/[,.;:]+$/, '').trim();
    const words = s.split(' ');
    if (s.length < 3 || s.length > 60 || words.length > 6) return null;
    if (!/^[A-Za-z][A-Za-z.' -]*$/.test(s) || !words.some(w => w.replace(/\./g, '').length >= 2)) return null;
    if (FIRM_WORD.test(s)) return null;
    if (heuristic && words.some(w => NAME_STOP.has(w.toLowerCase().replace(/\./g, '')))) return null;
    return s;
  }
  const yesNo = v => { const s = norm(v).toLowerCase(); return /^(?:yes|y|true)$/.test(s) ? 'Yes' : /^(?:no|n|false)$/.test(s) ? 'No' : null; };

  /** Short phrase ("first auditor", "re-appointed in the AGM", ...) -> exact option, or null when it is not clear. */
  function natureFromPhrase(s) {
    const t = norm(s);
    const hit = [];
    if (/\bfirst\b/i.test(t)) hit.push(NATURE.FIRST);
    if (/casual\s+vacancy/i.test(t)) hit.push(NATURE.CASUAL);
    if (/non-?\s?re-?\s?appointment|removal/i.test(t)) hit.push(NATURE.NONREAPP);
    if (/tribunal/i.test(t)) hit.push(NATURE.TRIB);
    if (/central\s+government/i.test(t)) hit.push(NATURE.CENTRAL);
    if (/\bC\s?&\s?AG\b|comptroller/i.test(t)) hit.push(NATURE.CAG);
    if (!hit.length && /re-?\s?appoint/i.test(t) && /\bAGM\b|annual general/i.test(t)) hit.push(NATURE.REAPP);
    if (!hit.length && /appoint/i.test(t) && /\bAGM\b|annual general/i.test(t)) hit.push(NATURE.AGM);
    return hit.length === 1 ? hit[0] : null;
  }

  /** Normalise `raw` for dataKey `key`; returns the value to put in the form, or null when it is not valid.
   *  opts.heuristic: the value was guessed from running text (stricter name filter, see cleanPerson). */
  function normVal(key, raw, opts) {
    if (raw == null || typeof raw === 'object') return null;
    const k = KIND[key]; const s = norm(raw);
    if (!k || !s || /^(?:null|n\/a|na|nil|none|-+)$/i.test(s)) return null;
    const up = s.toUpperCase().replace(/\s+/g, '');
    switch (k) {
      case 'cin': return RE.cin.test(up) ? up : null;
      case 'pan': return RE.pan.test(up) ? up : null;
      case 'pin': { const d = s.replace(/\s+/g, ''); return RE.pin.test(d) ? d : null; }
      case 'int': return /^\d{1,3}$/.test(s) && (+s >= 1 || key === 'numPriorFinancialYears') ? String(+s) : null;
      case 'date': return parseDate(s) || null;
      case 'email': return RE.email.test(s) ? s.toLowerCase() : null;
      case 'frn': return RE.frn.test(up) ? up : null;
      case 'mem': return RE.mem.test(s) ? s : null;
      case 'srn': return RE.srn.test(up) ? up : null;
      case 'resno': return /^[A-Za-z0-9/-]{1,15}$/.test(s) && /\d/.test(s) ? s : null;
      case 'ident': return RE.din.test(s) || RE.pan.test(up) || /^[A-Z]?\d{3,7}$/.test(up) ? up : null;
      case 'person': return cleanPerson(s, !!(opts && opts.heuristic));
      case 'org': { const o = key === 'firmName' ? stripMs(s) : s; return o.length >= 3 && o.length <= 100 && /[A-Za-z]/.test(o) && !/\*/.test(o) ? o : null; }
      case 'text': return s.length <= 300 && /[A-Za-z0-9]/.test(s) && !/^\*+$/.test(s) ? s : null;
      case 'select': {
        const opts = SELECTS[key];
        if (key === 'natureOfAppointment') { const hit = opts.find(o => o.toLowerCase() === s.toLowerCase()); if (hit) return hit; return natureFromPhrase(s); }
        if (key === 'signatoryDesignation') return designationOf(s);
        if (opts === YN || key === 'auditCommitteeRecommendation') { const y = yesNo(s); if (y) return y; }
        if (key === 'auditorCategory') return /firm/i.test(s) ? CAT_FIRM : /individual/i.test(s) ? CAT_IND : null;
        return opts.find(o => o.toLowerCase() === s.toLowerCase()) || null;
      }
      default: return null;
    }
  }
  /** Public form of normVal: { ok, value } */
  function normalizeValue(key, raw, opts) { const v = normVal(key, raw, opts); return { ok: v != null, value: v }; }
  function designationOf(s) {
    const t = norm(s);
    if (/company\s+secretary|^CS$/i.test(t)) return 'Company Secretary';
    if (/interim resolution professional|\bIRP\b/i.test(t)) return DESIGNATIONS[6];
    if (/resolution professional|\bRP\b/i.test(t)) return DESIGNATIONS[7];
    if (/liquidator/i.test(t)) return 'Liquidator';
    if (/chief financial officer|\bCFO\b/i.test(t)) return 'CFO';
    if (/chief executive officer|\bCEO\b/i.test(t)) return 'CEO';
    if (/^manager$/i.test(t)) return 'Manager';
    if (/director/i.test(t)) return 'Director';
    return null;
  }

  /* ───────────── nature of appointment from wording ───────────── */
  function natureFromText(F) {
    const out = [];
    const add = (value, conf, re) => { const m = re.exec(F); if (m) out.push({ value, conf, index: m.index, len: m[0].length }); };
    const agmCtx = /annual general meeting|\bAGM\b/i.test(F);
    add(NATURE.FIRST, 0.85, /\bfirst\s+(?:statutory\s+)?auditors?\b/i);
    add(NATURE.CASUAL, 0.9, /casual\s+vacancy/i);
    add(NATURE.NONREAPP, 0.75, /non-?\s?re-?\s?appointment|removal\s+of\s+the\s+(?:previous|retiring|outgoing)\s+auditor/i);
    add(NATURE.TRIB, 0.7, /(?:order\s+of\s+(?:the\s+)?(?:national\s+company\s+law\s+)?tribunal|appointed\s+by\s+the\s+(?:national\s+company\s+law\s+)?tribunal)/i);
    add(NATURE.CENTRAL, 0.7, /(?:appointed\s+by\s+the\s+central\s+government|order\s+of\s+the\s+central\s+government)/i);
    add(NATURE.CAG, 0.7, /(?:comptroller\s+and\s+auditor\s+general|\bC\s?&\s?AG\b)[^.]{0,80}appoint|appoint[^.]{0,80}(?:comptroller\s+and\s+auditor\s+general|\bC\s?&\s?AG\b)/i);
    const re = /re-?\s?appoint(?:ed|ment)?[^.]{0,120}auditors?|auditors?[^.]{0,120}re-?\s?appoint(?:ed|ment)?/i.exec(F);
    if (re && agmCtx) out.push({ value: NATURE.REAPP, conf: 0.8, index: re.index, len: re[0].length });
    if (!re && agmCtx) {
      const ap = /(?:appoint(?:ed|ment)?[^.]{0,100}(?:in|at)\s+the\s+(?:[\w-]+\s+){0,2}(?:annual\s+general\s+meeting|\bAGM\b)|ordinary\s+business[^]{0,250}?appoint(?:ment)?[^.]{0,60}auditors?)/i.exec(F);
      if (ap && !out.some(o => o.value === NATURE.FIRST)) out.push({ value: NATURE.AGM, conf: 0.7, index: ap.index, len: ap[0].length });
    }
    return out;
  }

  /* ───────────── document type ───────────── */
  const DOC_LABELS = {
    'filed-adt1': 'Filed ADT-1 form', 'board-resolution': 'Board resolution', consent: "Auditor's consent / eligibility certificate",
    'letter': 'Appointment letter / intimation to auditor', agm: 'AGM notice / resolution', 'adt1-json': 'ADT-1 client file (JSON)',
    scanned: 'Scanned (no text to read)', unknown: 'Other document'
  };
  function isFiledText(F) { return /\bForm\s+No\.?\s*ADT-?\s?1\b/i.test(F) && /Nature of appointment/i.test(F); }
  function detectDocType(text) {
    const F = norm(text).slice(0, 80000);
    if (!F) return 'unknown';
    if (isFiledText(F)) return 'filed-adt1';
    const t = (re, n) => (re.test(F) ? n : 0);
    const score = {
      consent: t(/consent/i, 2) + t(/certificate/i, 1) + t(/eligible|not disqualified|disqualification/i, 2) + t(/section\s+141/i, 1) + t(/details of the auditor/i, 2),
      'board-resolution': t(/RESOLVED\s+(?:THAT|FURTHER)/i, 3) + t(/certified true copy/i, 1) + t(/meeting of the board|board meeting/i, 1) + t(/resolution/i, 1),
      'letter': t(/dear\s+(?:sir|madam|mr|ms)/i, 2) + t(/kindly acknowledge|send your written consent|we are (?:happy|pleased) to inform|hereby intimate/i, 2) + t(/you have been appointed/i, 3) + t(/\bsub(?:ject)?\s*:/i, 1),
      agm: t(/notice\s+(?:is\s+hereby\s+given|of\s+(?:the\s+)?(?:[\w-]+\s+)?annual\s+general\s+meeting)/i, 3) + t(/ordinary\s+business/i, 2) + t(/(?:at|in)\s+the\s+(?:[\w-]+\s+)?annual\s+general\s+meeting[^.]{0,40}held\s+on/i, 3) + t(/minutes/i, 1)
    };
    let best = 'unknown', top = 2;
    for (const k of ['consent', 'letter', 'agm', 'board-resolution']) if (score[k] > top) { best = k; top = score[k]; }
    return best;
  }

  /* ───────────── generic rules ───────────── */
  function walkBack(F, idx, max, extraStop) {
    const words = F.slice(Math.max(0, idx - 160), idx).trim().split(' ');
    const out = [];
    for (let i = words.length - 1; i >= 0 && out.length < max; i--) {
      const w = words[i].replace(/^[("']+/, ''); const bare = w.replace(/[,.;:]+$/, '');
      if (/[,;:]$/.test(w) || !/^[A-Za-z0-9][\w&.'\-/]*$/.test(bare) || NAME_STOP.has(bare.toLowerCase()) || (extraStop && extraStop.has(bare.toLowerCase())) || (/^[a-z]/.test(bare) && !/^\d/.test(bare))) break;
      out.unshift(bare);
    }
    return out;
  }
  const PRONOUN_PAN_CTX = /compan(?:y|ies)/i;

  function extractGeneric(file, F, docType, add) {
    let m, re;
    /* CIN */
    const cins = new Set();
    re = /\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/g;
    while ((m = re.exec(F))) {
      if (cins.has(m[1])) continue; cins.add(m[1]);
      add('cin', m[1], /CIN|Corporate Identity/i.test(F.slice(Math.max(0, m.index - 40), m.index)) ? 0.95 : 0.85, m.index, m[0].length);
    }
    /* Company name: walk back from "Private Limited" / "Limited" */
    const names = new Map();
    re = /\b((?:Private|Pvt\.?)\s+(?:Limited|Ltd\.?)|Limited|Ltd\.?)(?=[\s,.;:)"'(]|$)/gi;
    while ((m = re.exec(F))) {
      const w = walkBack(F, m.index, 7);
      if (!w.length) continue;
      const name = `${w.join(' ')} ${m[1]}`; const key = loose(name);
      const e = names.get(key) || { name, n: 0, index: m.index, len: m[0].length, start: m.index - w.join(' ').length - 1 };
      e.n++; names.set(key, e);
    }
    const ranked = [...names.values()].sort((a, b) => b.n - a.n || a.index - b.index);
    if (ranked.length) {
      const top = ranked[0]; const tie = ranked.length > 1 && ranked[1].n === top.n;
      add('companyName', top.name, tie ? 0.55 : top.n > 1 ? 0.85 : 0.7, Math.max(0, top.start), top.name.length);
    }
    /* Registered office address */
    m = /registered\s+office[^.]{0,40}?\b(?:(?:situated|situate|located)\s+(?:at\s+)?|at\s+)(.{8,220}?[\s,-]\d{6})\b/i.exec(F);
    if (m) add('companyAddress', m[1].replace(/\s*-\s*(\d{6})$/, ' - $1'), 0.85, m.index, m[0].length);
    m = /\bAddress\s*:\s*(.{8,220}?\b\d{6})\b/.exec(F);
    if (m) add('companyAddress', m[1], 0.65, m.index, m[0].length);
    /* Company e-mail printed in the letterhead next to the CIN */
    m = /CIN\s*:?\s*[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}\s*\|?\s*E\s*-?\s*mail\s*(?:ID)?\s*:?\s*([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/i.exec(F);
    if (m) add('companyEmail', m[1], 0.8, m.index, m[0].length);

    /* Dates */
    // "the Board recommends the appointment ... subject to the members' approval" is a proposal, not an appointment
    const definite = /\b(?:appointed|re-?appointed)\b|\bhereby\s+(?:appoints?|re-?appoints?)\b|\baccorded\s+to\s+(?:appoint|re-?appoint)\b/i.test(F);
    const recOnly = /\brecommend/i.test(F) && !definite;
    const resCtx = /appoint/i.test(F) && !recOnly;
    m = new RegExp(`\\b(?:meeting\\s+of\\s+the\\s+board|board\\s+meeting)\\b[^]{0,200}?\\bheld\\s+on\\s+(?:\\w+day,?\\s+)?(?:the\\s+)?(${DT})`, 'i').exec(F);
    if (m) {
      add('resolutionDate', parseDate(m[1]) || firstDate(m[1]), docType === 'board-resolution' ? 0.9 : 0.85, m.index, m[0].length);
      if (resCtx) add('dateOfAppointment', parseDate(m[1]) || firstDate(m[1]), 0.75, m.index, m[0].length);
    }
    m = new RegExp(`\\b(?:annual\\s+general\\s+meeting|AGM)\\b[^.;]{0,120}?\\b(?:held|to\\s+be\\s+held|will\\s+be\\s+held|convened|scheduled|conducted)\\s+on\\s+(?:\\w+day,?\\s+)?(?:the\\s+)?(${DT})`, 'i').exec(F);
    if (m) {
      const iso = firstDate(m[1]);
      add('agmDate', iso, /will be held|to be held|scheduled/i.test(m[0]) ? 0.8 : 0.85, m.index, m[0].length);
      if (resCtx) add('dateOfAppointment', iso, 0.7, m.index, m[0].length);
    }
    m = /\bresolution\s+(?:no\.?|number|nos?\.)\s*[:#.-]?\s*\*?\s*([A-Za-z0-9/-]{1,15})/i.exec(F);
    if (m && /\d/.test(m[1])) add('resolutionNumber', m[1], 0.85, m.index, m[0].length);

    /* Casual vacancy: the auditor who LEFT is named after "resignation of" / "vacated by" / "in place of". Everything in
       that stretch of text belongs to the outgoing auditor, so its FRN and membership number go to the vacated fields
       and are kept out of the appointed firm's name and FRN. */
    let vacSpan = null;
    if (/casual\s+vacancy/i.test(F)) {
      const vm = /\b(?:resignation\s+of|resigned\s+by|vacated\s+by|vacancy\s+caused\s+by|in\s+(?:the\s+)?place\s+of|outgoing\s+auditors?|previous\s+auditors?|erstwhile\s+auditors?|retiring\s+auditors?)\b[,\s]*(?:the\s+)?(?:M\/s\.?\s+|Messrs\.?\s+)?([A-Z][\w.&' -]{2,60}?)(?=\s*[,(]|\s+who\b|\s+having|\s+bearing|\s+FRN|\s+Chartered|\s*\.|$)/.exec(F);
      if (vm) {
        const nameEnd = vm.index + vm[0].length;
        // The span ends at the sentence end, or where the NEW appointment starts in the same sentence.
        const tail = F.slice(nameEnd, nameEnd + 140); const stop = tail.search(/[.;]\s|\b(?:appoint(?:ed|ing|ment|s)?|be\s+filled|is\s+hereby|in\s+(?:his|her|their|its)\s+place|RESOLVED)\b/i);
        vacSpan = [vm.index, nameEnd + (stop >= 0 ? stop : tail.length)];
      }
    }
    const inVac = i => !!vacSpan && i >= vacSpan[0] && i < vacSpan[1];
    /* Auditor identity */
    re = /\bMembership\s*(?:No\.?|Number|Nos?\.?)\s*[:\-]?\s*\*?\s*(\d{5,7})\b/gi;
    while ((m = re.exec(F))) add(inVac(m.index) ? 'vacatingAuditorMembership' : 'membershipNumber', m[1], inVac(m.index) ? 0.8 : 0.9, m.index, m[0].length);
    re = /\b(?:Firm\s+Registration\s+(?:Number|No\.?)|FRN|Firm\s+Reg(?:n|istration)?\.?\s*(?:No\.?|Number))\s*(?:\(\s*FRN\s*\))?\s*[:\-.]?\s*\*?\s*([A-Z]?\d{4,7}[A-Z]{0,2})\b/gi;
    let frnSeen = null;
    while ((m = re.exec(F))) {
      const v = normVal('firmRegistrationNumber', m[1]); if (!v) continue;
      if (inVac(m.index)) { add('vacatedFirmRegNumber', v, 0.8, m.index, m[0].length); continue; }
      add('firmRegistrationNumber', v, 0.9, m.index, m[0].length); frnSeen = frnSeen || m;
    }
    re = /\bPAN(?:\s*(?:No\.?|Number))?\s*[:\-]?\s*\*?\s*([A-Z]{5}\d{4}[A-Z])\b/g;
    while ((m = re.exec(F))) {
      const before = F.slice(Math.max(0, m.index - 40), m.index);
      const isFirm = /firm/i.test(before);
      if (!isFirm && PRONOUN_PAN_CTX.test(before) && !/auditor/i.test(before)) continue;
      add(isFirm ? 'firmPan' : 'auditorPan', m[1], isFirm ? 0.85 : (m[1][3] === 'P' ? 0.9 : 0.65), m.index, m[0].length);
    }
    /* Auditor name: labelled row, then "appoint <Name>, Chartered Accountant", then "I, <Name>," */
    const asFirmOrPerson = (raw, conf, idx, len, heuristic) => {
      const p = normVal('auditorName', raw, { heuristic });
      if (p) return add('auditorName', p, conf, idx, len);
      if (FIRM_WORD.test(raw)) add('firmName', norm(raw).replace(/\s+,/g, ','), Math.min(conf, 0.8), idx, len);
    };
    m = /\bName\s+of\s+(?:the\s+)?(?:Auditor|Proprietor|Partner)\s*:?\s*(.{3,70}?)\s+(?:\d\s+)?(?:Designation|Qualification|Membership|M\.?\s*No|PAN|Registration)/i.exec(F);
    if (m) asFirmOrPerson(m[1], 0.9, m.index, m[0].length, false);   // a labelled row: no stop-word filter
    m = /\bappoint(?:ment)?(?:\s+of)?\s+(?:the\s+firm\s+of\s+)?(?:M\/s\.?\s+|Messrs\.?\s+)?((?:(?:CA|Mr|Mrs|Ms|Shri|Smt)\.?\s+)?[A-Za-z][A-Za-z.'&-]*(?:\s+[A-Za-z&][A-Za-z.'&-]*){0,5})\s*,\s*(?:Chartered\s+Accountants?|\(?\s*FRN|having|a\s+firm|holding|bearing|\(?M\.?\s*No)/i.exec(F);
    if (m && !inVac(m.index)) asFirmOrPerson(m[1], 0.85, m.index, m[0].length, true);
    m = /\bI,?\s+((?:CA\s+)?[A-Z][a-z.']+(?:\s+[A-Z][a-z.']+){1,4})\s*,[^.]{0,200}?(?:hereby|consent)/.exec(F);
    if (m) { const p = normVal('auditorName', m[1], { heuristic: true }); if (p) add('auditorName', p, 0.65, m.index, m[0].length); }
    /* Addressee of an appointment letter: "To, [Date: ...] <Name> <address ... PIN> Dear" */
    m = new RegExp(`\\bTo,?\\s+(?:Date\\s*:?\\s*${DT}\\s+)?([A-Z][A-Za-z.']+(?:\\s+[A-Z][A-Za-z.']+){1,3}?)\\s+((?:Shop|Flat|Plot|House|Door|Office|No\\b|#|H\\.?\\s?No|\\d)[^]{5,200}?)\\s+Dear\\b`).exec(F);
    if (m && m[0].length < 400) {
      const p = normVal('auditorName', m[1], { heuristic: true });
      const addr = m[2].replace(/\s*,\s*$/, '');
      const pin = /(?:^|[\s,-])(\d{6})\s*$/.exec(addr);
      if (p) {
        add('auditorName', p, 0.75, m.index, m[0].length);
        if (pin) {
          const body = addr.slice(0, pin.index).replace(/[\s,-]+$/, '').trim(); const parts = body.split(/\s*,\s*/);
          add('auditorPin', pin[1], 0.7, m.index, m[0].length);
          if (parts.length > 1) { add('auditorAddr1', parts.slice(0, -1).join(', '), 0.6, m.index, m[0].length); add('auditorAddr2', parts[parts.length - 1], 0.6, m.index, m[0].length); }
          else add('auditorAddr1', body, 0.6, m.index, m[0].length);
        }
      }
    }
    /* Firm name: labelled, "M/s X", or "X & Co" / "X LLP" candidates */
    m = /\bName\s+of\s+the\s+(?:auditor'?s?\s+)?firm\s*:?\s*(.{3,80}?)\s+(?:\d\s+)?(?:Firm|PAN|Address|Registration|Membership)/i.exec(F);
    if (m) add('firmName', m[1], 0.9, m.index, m[0].length);
    // "M/s X & Co" (the first one that is not the outgoing auditor); the name stops where an address starts
    re = new RegExp(`\\b(?:M\\/s\\.?|Messrs\\.?)\\s+([A-Z][\\w.&' -]{2,60}?)(?=\\s*[,(]|\\s+Chartered|\\s+having|\\s+bearing|\\s+FRN|${ADDR_START.source})`, 'g');
    while ((m = re.exec(F))) {
      if (inVac(m.index)) continue;
      if (FIRM_WORD.test(m[1])) add('firmName', m[1], 0.8, m.index, m[0].length);
      break;
    }
    re = /(?:&|\band\b)\s*(Co\b\.?|Company|Associates|Partners)|\b(LLP)\b/g;
    const firms = new Map();
    while ((m = re.exec(F))) {
      if (inVac(m.index)) continue;
      const w = walkBack(F, m.index, 4, ADDR_STOP);
      if (!w.length && !m[2]) continue;
      const nm = m[2] ? `${w.join(' ')} LLP`.trim() : `${w.join(' ')} ${F.slice(m.index, m.index + m[0].length).replace(/^and\b/i, 'and')}`.replace(/\s+/g, ' ').trim();
      if (nm.length < 5 || /^(?:&|and)\b/i.test(nm) || firms.has(loose(nm))) continue;
      firms.set(loose(nm), { nm, index: m.index - w.join(' ').length - 1, len: nm.length });
    }
    const firmList = [...firms.values()];
    for (const f of firmList.slice(0, 2)) add('firmName', f.nm, firmList.length === 1 ? 0.7 : 0.55, Math.max(0, f.index), f.len);
    /* Signing line right after "Firm & Co": "... Jain Maneesh & Co Maneesh Kumar Jain" at the end of the text */
    m = /(?:&|\band\b)\s+(?:Co\.?|Associates)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*$/.exec(F);
    if (m) { const p = normVal('auditorName', m[1], { heuristic: true }); if (p) add('auditorName', p, 0.6, m.index, m[0].length); }
    /* Category: only when the wording is explicit or an FRN is printed */
    if (/\bappoint(?:ment)?(?:\s+of)?\s+(?:the\s+firm\s+of\s+)?M\/s\b/i.test(F) || firmList.length) {
      const q = /\bM\/s\b/i.exec(F) || { index: firmList[0].index, 0: firmList[0].nm };
      add('auditorCategory', CAT_FIRM, 0.8, Math.max(0, q.index), (q[0] || '').length || 10);
    } else if (frnSeen) add('auditorCategory', CAT_FIRM, 0.6, frnSeen.index, frnSeen[0].length);

    /* Period of account */
    m = new RegExp(`(?:financial\\s+year|period|accounting\\s+year|year)[^.]{0,60}?\\bfrom\\s+(${DT})\\s*(?:to|till|until|-)\\s*(${DT})`, 'i').exec(F);
    if (m) { add('periodFrom', firstDate(m[1]), 0.85, m.index, m[0].length); add('periodTo', firstDate(m[2]), 0.85, m.index, m[0].length); }
    else {
      m = /(?:financial\s+years?|F\.?Y\.?)\s*(\d{4})\s*-\s*(\d{2,4})\s*(?:to|till|through|-)\s*(?:(?:F\.?Y\.?|financial\s+year)\s*)?(\d{4})\s*-\s*(\d{2,4})/i.exec(F);
      if (m) {
        const y1 = +m[1], y2 = +m[3]; const n = y2 - y1 + 1;
        if (y2 >= y1 && n <= 10) {
          add('periodFrom', isoOf(y1, 4, 1), 0.55, m.index, m[0].length); add('periodTo', isoOf(y2 + 1, 3, 31), 0.55, m.index, m[0].length);
          add('numFinancialYears', String(n), 0.55, m.index, m[0].length);
        }
      }
    }

    /* Nature of appointment */
    const nat = recOnly ? [] : natureFromText(F);
    if (nat.length) {
      nat.sort((a, b) => b.conf - a.conf);
      for (const n of nat.slice(0, 3)) add('natureOfAppointment', n.value, nat.length === 1 ? n.conf : Math.min(n.conf, 0.55), n.index, n.len);
    }

    /* Casual vacancy: reason, date and the SRN of the form that reported it, only when the wording is there */
    if (/casual\s+vacancy/i.test(F) && !recOnly) {
      m = /\bresign(?:ed|ation)\b/i.exec(F);
      if (m) add('casualVacancyReason', 'Resignation', 0.75, m.index, m[0].length);
      else { m = /\b(?:death|died|disqualif\w+)\b/i.exec(F); if (m) add('casualVacancyReason', 'Others (death, disqualification)', 0.7, m.index, m[0].length); }
      m = new RegExp(`(?:resign(?:ed|ation)|vacan\\w+|vacated)[^.;]{0,100}?(?:with\\s+effect\\s+from|w\\.?e\\.?f\\.?|dated|\\bon\\b)\\s+(?:\\w+day,?\\s+)?(?:the\\s+)?(${DT})`, 'i').exec(F);
      if (m) add('casualVacancyDate', firstDate(m[1]), 0.8, m.index, m[0].length);
      m = /(?:ADT-?\s?3|23B|GNL-?\s?2)[^.;]{0,40}?\b(?:SRN|Service\s+Request\s+(?:Number|No\.?))\s*(?:no\.?|number)?\s*[:.-]?\s*([A-Z]{1,2}\d{7,9})\b/i.exec(F)
        || /\b(?:SRN|Service\s+Request\s+(?:Number|No\.?))\s*[:.-]?\s*([A-Z]{1,2}\d{7,9})\b/i.exec(F);
      if (m) add('relevantFormSrn', m[1], 0.75, m.index, m[0].length);
    }
    m = /INC-?\s?28[^.;]{0,60}?\b(?:SRN|Service\s+Request\s+(?:Number|No\.?))\s*[:.-]?\s*([A-Z]{1,2}\d{7,9})\b/i.exec(F);
    if (m) add('inc28Srn', m[1], 0.8, m.index, m[0].length);

    /* Yes/No answers that a document states outright */
    m = /(?:not\s+(?:exceed|in\s+excess\s+of)|within\s+the\s+limits?\s+of)[^.]{0,60}twenty\s+companies|twenty\s+companies[^.]{0,80}within/i.exec(F);
    if (m) add('within20CompaniesLimit', 'Yes', 0.85, m.index, m[0].length);
    else { m = /proposed\s+appointment\s+is\s+within\s+the\s+limits\s+laid\s+down/i.exec(F); if (m) add('within20CompaniesLimit', 'Yes', 0.65, m.index, m[0].length); }
    m = /audit\s+committee[^.]{0,80}(?:not\s+applicable|not\s+required|not\s+mandatory)|not\s+applicable[^.]{0,40}audit\s+committee/i.exec(F);
    if (m) add('auditCommitteeRecommendation', 'Not Applicable', 0.65, m.index, m[0].length);
    else { m = /recommendation\s+of\s+the\s+audit\s+committee[^.]{0,120}(?:considered|taken\s+into\s+account|accepted)|audit\s+committee[^.]{0,60}\brecommended\b/i.exec(F); if (m) add('auditCommitteeRecommendation', 'Yes', 0.7, m.index, m[0].length); }
    m = /\b(?:sole|single|one)\s+(?:statutory\s+)?auditor\b/i.exec(F);
    if (m) { add('numAuditorsAppointed', '1', 0.7, m.index, m[0].length); add('jointAuditors', 'No', 0.7, m.index, m[0].length); }
    else { m = /\bjoint\s+(?:statutory\s+)?auditors?\b[^.]{0,80}appoint|appoint[^.]{0,80}\bjoint\s+(?:statutory\s+)?auditors?\b/i.exec(F); if (m) add('jointAuditors', 'Yes', 0.7, m.index, m[0].length); }

    /* Signing director / officer: "<Name> Director DIN: 12345678" */
    re = /((?:[A-Z][A-Za-z.'-]+\s+){1,4})(Managing\s+Director|Whole[- ]time\s+Director|Director|Company\s+Secretary|CEO|CFO|Manager)\s*[,:-]?\s*(?:\(?DIN\)?|DIN\s*(?:No\.?)?|Director\s+Identification\s+Number)\s*[:\-]?\s*(\d{8})\b/g;
    while ((m = re.exec(F))) {
      const desig = designationOf(m[2]);
      add('signatoryDesignation', desig, 0.8, m.index, m[0].length);
      add('signatoryIdentifier', m[3], 0.85, m.index, m[0].length);
    }
  }

  /* ───────────── filed ADT-1 form: parse every printed label ───────────── */
  const SUBS = [['Addr1', /\*?\s*Address Line 1/i], ['Addr2', /Address Line 2/i], ['Country', /\*?\s*Country/i], ['Pin', /\*?\s*Pin Code\s*\/\s*Zip Code/i],
    ['Area', /\*?\s*Area\s*\/\s*Locality/i], ['City', /\*?\s*City/i], ['District', /District/i], ['State', /\*?\s*State\s*\/\s*UT/i], ['Email', /\*?\s*Email ID(?! of the company)/i]];
  const D = '(?:\\s*\\(DD\\/MM\\/YYYY\\))?';
  const FILED_LABELS = [
    ['_cin', /1\s*\*?\s*Corporate Identity Number\s*\(CIN\)/i],
    ['companyName', /2\s*\(a\)\s*\*?\s*Name of the company/i],
    ['companyAddress', /2\s*\(b\)\s*\*?\s*Address of the registered office(?: of the company)?/i],
    ['companyEmail', /2\s*\(c\)\s*\*?\s*Email ID of the company/i],
    ['_3a', /3\s*\(a\)\s*\*?\s*Whether company is falling[^]*?139\(2\)/i],
    ['_3b', /3\s*\(b\)\s*\*?\s*Nature of appointment/i],
    ['natureOfAppointmentOther', /3\s*\(b\)\s*\(i\)\s*If Others, please specify/i],
    ['_3c', /3\s*\(c\)\s*\*?\s*Whether auditor\(s\) has been appointed[^]*?\(AGM\)/i],
    ['agmDate', new RegExp(`3\\s*\\(d\\)\\s*If yes, date of AGM${D}`, 'i')],
    ['dateOfAppointment', new RegExp(`4\\s*\\(a\\)\\s*\\*?\\s*Date of appointment${D}`, 'i')],
    ['_4b', /4\s*\(b\)\s*\*?\s*Whether joint auditors have been appointed/i],
    ['numAuditorsAppointed', /4\s*\(c\)\s*\*?\s*Number of auditor\(s\) appointed/i],
    ['_4d', /4\s*\(d\)\s*\*?\s*Category of Auditor/i],
    ['firmRegistrationNumber', /4\s*\(e\)\s*\*?\s*Firm Registration Number/i],
    ['firmName', /4\s*\(f\)\s*\*?\s*Name of the Auditor'?s Firm/i],
    ['firmPan', /4\s*\(f\)\s*\(i\)\s*\*?\s*Income Tax permanent account number of auditor'?s firm/i],
    ['_4fii', /4\s*\(f\)\s*\(ii\)\s*\*?\s*Address of the auditor'?s firm/i],
    ...SUBS.map(([k, re]) => ['firm' + k, re]),
    ['membershipNumber', /4\s*\(g\)\s*\*?\s*Membership Number of Auditor signing the balance sheet of the company/i],
    ['auditorName', /4\s*\(h\)\s*\*?\s*Name of the Auditor/i],
    ['auditorPan', /4\s*\(h\)\s*\(i\)\s*\*?\s*Income Tax permanent account number of auditor(?!'?s firm)/i],
    ['_4hii', /4\s*\(h\)\s*\(ii\)\s*\*?\s*Address of the auditor(?!'?s firm)/i],
    ...SUBS.map(([k, re]) => ['auditor' + k, re]),
    ['_4i', /4\s*\(i\)\s*\*?\s*Period of account for which appointed/i],
    ['periodFrom', new RegExp(`\\*?\\s*From\\s*\\(DD\\/MM\\/YYYY\\)`, 'i')],
    ['periodTo', new RegExp(`\\*?\\s*To\\s*\\(DD\\/MM\\/YYYY\\)`, 'i')],
    ['numFinancialYears', /4\s*\(j\)\s*\*?\s*Number of financial year\(s\) to which appointment relates/i],
    ['_4k', /4\s*\(k\)\s*\*?\s*Whether the appointment of auditor is within the limits of twenty companies/i],
    ['_4l', /4\s*\(l\)\s*Has the auditor or auditor'?s firm/i],
    ['_4m', /4\s*\(m\)\s*Specify the tenure/i],
    ['numPriorFinancialYears', /4\s*\(n\)\s*\*?\s*Number of financial year\(s\)/i],
    ['_4o', /4\s*\(o\)\s*\*?\s*S\.\s*no\./i],
    ['priorRow1FirmReg', /4\s*\(p\)\s*Firm Registration Number/i],
    ['priorRow1Membership', /4\s*\(q\)\s*\*?\s*Membership Number of Auditor/i],
    ['priorRow1FyStart', new RegExp(`4\\s*\\(r\\)\\s*\\*?\\s*Financial Year Start Date${D}`, 'i')],
    ['priorRow1FyEnd', new RegExp(`4\\s*\\(s\\)\\s*\\*?\\s*Financial Year End Date${D}`, 'i')],
    ['_5', /\b5\s*\*?\s*Whether the recommendation of the Audit Committee/i],
    ['inc28Srn', /\b6\s*Specify the SRN of INC-28/i],
    ['_7', /\b7\s*Appointment of Auditor due to casual vacancy/i],
    ['casualVacancyOtherReason', /\(a\)\s*\(i\)\s*If Others, please specify/i],
    ['relevantFormSrn', /\(b\)\s*Specify the SRN of relevant form/i],
    ['casualVacancyDate', new RegExp(`\\(c\\)\\s*Mention the date of casual vacancy${D}`, 'i')],
    ['vacatedFirmRegNumber', /\(d\)\s*Registration number of auditor'?s firm who has vacated the office/i],
    ['vacatingAuditorMembership', /\(e\)\s*Membership number of the auditor/i],
    ['casualVacancyReasonText', /\(f\)\s*Reasons of the casual vacancy/i],
    ['_att', /\bAttachments\b/]
  ];
  const FILED_ALIAS = k => k.replace(/^(firm|auditor)(Addr1|Addr2|Country|Pin|Area|City|District|State|Email)$/, (_, p, s) => p + s);

  function extractFiled(file, F0, add, notes) {
    const F = F0.replace(/\bPage\s+\d+\s+of\s+\d+\b/gi, ' ').replace(/\s+/g, ' ');
    // sequential label search: the form's order is fixed, so repeated labels (the two address blocks) stay apart
    const found = []; let pos = 0;
    for (const [key, re] of FILED_LABELS) {
      const g = new RegExp(re.source, re.flags.replace('g', '') + 'g'); g.lastIndex = pos;
      const m = g.exec(F);
      if (m) { found.push({ key, start: m.index, end: m.index + m[0].length }); pos = m.index + m[0].length; }
    }
    const val = {}; const at = {};
    found.forEach((f, i) => { const next = i + 1 < found.length ? found[i + 1].start : F.length; val[f.key] = F.slice(f.end, next).replace(/^[\s:]+/, '').trim(); at[f.key] = f; });
    // pdftotext -layout prints many values on the row ABOVE their label ("value, label, value, label"). When an address block does not
    // read right with "label, value", try "value, label" for the whole block; if that is no better, leave it alone.
    const CHAINS = [['firm', ['_4fii', ...SUBS.map(([k]) => 'firm' + k), 'membershipNumber', 'auditorName', 'auditorPan']], ['auditor', ['_4hii', ...SUBS.map(([k]) => 'auditor' + k)]]];
    const aligned = who => /^[A-Za-z][A-Za-z ]{2,29}$/.test((val[who + 'Country'] || '').trim()) && RE.pin.test((val[who + 'Pin'] || '').trim());
    for (const [who, chain] of CHAINS) {
      if (aligned(who) || !chain.some(k => at[k])) continue;
      const old = Object.assign({}, val);
      chain.forEach((k, i) => { val[k] = i === 0 ? '' : (old[chain[i - 1]] || ''); });
      if (!aligned(who)) Object.assign(val, old);
    }
    // the same shift moves "Date of appointment" one label down (its date is printed beside 4(b))
    if (!firstDate(val.dateOfAppointment || '') && firstDate(val._4b || '')) val.dateOfAppointment = val._4b;
    notes.push('The tick boxes (the Yes/No answers, the nature of appointment, the category) are not part of the text in a PDF, so they were not read: answer them yourself, except where the form clearly shows them by what it has filled in.');
    const put = (key, raw, conf, label) => {
      if (raw == null || raw === '') return;
      const f = at[label || key]; const i = f ? f.start : 0;
      add(key, raw, conf, i, f ? (f.end - f.start) + Math.min(60, String(raw).length + 2) : 20);
    };
    // CIN anywhere on the first page (layout text puts it beside the heading, not the label)
    const cin = /\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/.exec(F);
    if (cin) add('cin', cin[1], 0.97, cin.index, cin[0].length);
    // Company name / address. Layout text can split "... PRIVATE" / "LIMITED No 26 ...": rejoin when that is clearly what happened.
    let name = val.companyName || ''; let addr = val.companyAddress || '';
    if (name && !/(?:LIMITED|LTD\.?|LLP)$/i.test(name) && /PRIVATE$|PVT\.?$/i.test(name) && /^(?:LIMITED|LTD\.?)\b/i.test(addr)) { name += ' ' + addr.match(/^(?:LIMITED|LTD\.?)/i)[0]; addr = addr.replace(/^(?:LIMITED|LTD\.?)\s*/i, ''); }
    if (/(?:LIMITED|LTD\.?|LLP)$/i.test(name)) put('companyName', name, 0.95, 'companyName');
    addr = addr.replace(/(?:,\s*)?-?\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+\s*$/, '').replace(/[,\s]+$/, '');
    if (addr.length > 8 && /\d{6}/.test(addr)) put('companyAddress', addr, 0.95, 'companyAddress');
    put('companyEmail', (/\S+@\S+/.exec(val.companyEmail || '') || [])[0], 0.9, 'companyEmail');
    const dateOf = k => firstDate(val[k] || '');
    for (const k of ['agmDate', 'dateOfAppointment', 'periodFrom', 'periodTo', 'priorRow1FyStart', 'priorRow1FyEnd', 'casualVacancyDate']) { const d = dateOf(k); if (d) put(k, d, 0.95); }
    const intOf = k => (/^\*?\s*(\d{1,3})\b/.exec(val[k] || '') || [])[1];
    for (const k of ['numAuditorsAppointed', 'numFinancialYears', 'numPriorFinancialYears']) put(k, intOf(k), 0.95);
    const tok = (k, re) => (re.exec(val[k] || '') || [])[1];
    put('firmRegistrationNumber', tok('firmRegistrationNumber', /^([A-Z]?\d{4,7}[A-Z]{0,2})\b/i), 0.95);
    put('priorRow1FirmReg', tok('priorRow1FirmReg', /^([A-Z]?\d{4,7}[A-Z]{0,2})\b/i), 0.95);
    put('firmPan', tok('firmPan', /\b([A-Z]{5}\d{4}[A-Z])\b/), 0.95);
    put('auditorPan', tok('auditorPan', /\b([A-Z]{5}\d{4}[A-Z])\b/), 0.95);
    put('membershipNumber', tok('membershipNumber', /^(\d{4,7})\b/), 0.95);
    put('priorRow1Membership', tok('priorRow1Membership', /^(\d{4,7})\b/), 0.95);
    if (val.firmName && !/\b[A-Z]{5}\d{4}[A-Z]\b/.test(val.firmName)) put('firmName', val.firmName, 0.95);
    put('auditorName', val.auditorName, 0.95);
    for (const k of ['inc28Srn', 'relevantFormSrn', 'vacatedFirmRegNumber', 'vacatingAuditorMembership']) put(k, (val[k] || '').split(' ')[0], 0.9);
    put('natureOfAppointmentOther', val.natureOfAppointmentOther, 0.9);
    put('casualVacancyReasonText', val.casualVacancyReasonText, 0.9);
    put('casualVacancyOtherReason', val.casualVacancyOtherReason, 0.9);
    // Address blocks: only trusted when the block is aligned (Country is a word, Pin Code is 6 digits). Layout text shifts values by one row.
    for (const who of ['firm', 'auditor']) {
      const g = k => val[who + k];
      if (!/^[A-Za-z][A-Za-z ]{2,29}$/.test(g('Country') || '') || !RE.pin.test((g('Pin') || '').trim())) { if (g('Addr1') || g('Pin') || g('Country')) notes.push(`The ${who === 'firm' ? "firm's" : "auditor's"} address block in ${file} is laid out in a way that could not be read safely; fill it in by hand.`); continue; }
      for (const [s, conf] of [['Addr1', 0.95], ['Addr2', 0.95], ['Country', 0.9], ['Pin', 0.95], ['Area', 0.9], ['City', 0.9], ['District', 0.9], ['State', 0.9], ['Email', 0.9]]) put(who + s, (g(s) || '').trim(), conf, who + s);
    }
    // Declaration
    const decl = /\bI am authorised by the Board of Directors of the Company vide resolution number\s*\*?/i.exec(F);
    if (decl) {
      const tail = F.slice(decl.index + decl[0].length); const signIdx = tail.search(/to sign this form/i);
      const seg1 = (signIdx >= 0 ? tail.slice(0, signIdx) : tail.slice(0, 80)).replace(/\bdated\b/gi, ' ').replace(/\(DD\/MM\/YYYY\)\*?/g, ' ').replace(/\*/g, ' ').trim();
      const rn = seg1.split(/\s+/).find(t => normVal('resolutionNumber', t));
      if (rn) add('resolutionNumber', rn, 0.95, decl.index, 100);
      const dEnd = tail.search(/and the rules made/i);
      const dd = firstDate(tail.slice(0, dEnd > 0 ? dEnd : 400));
      if (dd) add('resolutionDate', dd, 0.95, decl.index, 100);
      const ds = /Designation\s*\*?\s*(Director|Manager|Company Secretary|CEO|CFO|Liquidator)\b/i.exec(tail);
      if (ds) add('signatoryDesignation', designationOf(ds[1]), 0.95, decl.index + decl[0].length + ds.index, ds[0].length);
      const di = /digitally signed by(?:\s.{0,160}?)?\b(\d{8})\b/i.exec(tail);
      if (di) add('signatoryIdentifier', di[1], 0.7, decl.index + decl[0].length + di.index, Math.min(60, di[0].length));
    }
    // Answers that can be read from what is filled in (check-box states are not part of the text layer)
    if (dateOf('agmDate')) put('appointedInAgm', 'Yes', 0.85, 'agmDate');
    if (val.firmName || val.firmRegistrationNumber) put('auditorCategory', CAT_FIRM, 0.9, 'firmName');
    if (intOf('numPriorFinancialYears') && (dateOf('priorRow1FyStart') || tok('priorRow1Membership', /^(\d{4,7})\b/))) put('previouslyAudited', 'Yes', 0.7, 'numPriorFinancialYears');
    if (found.some(f => f.key === '_4o')) notes.push("the filed form's previous-tenure table has several rows; only row 1 has a field in the form, add the other rows on MCA.");
  }

  /* ───────────── per-document + merge ───────────── */
  const r2 = n => Math.round(n * 100) / 100;
  function extractAdt1Doc(doc, opts) {
    const file = (doc && doc.name) || 'document';
    const proposals = []; const notes = [];
    const wrap = (docType) => {
      const list = dedupeWithin(proposals);
      const cin = list.filter(p => p.key === 'cin').sort((a, b) => b.confidence - a.confidence)[0];
      return { file, docType, proposals: list, notes: notes.map(t => (typeof t === 'string' ? { file, text: t } : t)), cin: cin ? cin.value : '' };
    };
    // An exported ADT-1 client file: every value in it is already in the form's own format.
    if (doc && doc.json && typeof doc.json === 'object') {
      const data = doc.json.formData && typeof doc.json.formData === 'object' ? doc.json.formData : doc.json;
      const labels = fieldList();
      for (const key of KEYS) {
        const raw = data[key]; if (raw == null || typeof raw === 'object') continue;
        const v = normVal(key, raw);
        if (v != null) proposals.push({ key, value: v, confidence: 0.95, method: 'rules', evidence: { file, quote: 'value saved in this ADT-1 file' } });
        else if (String(raw).trim() !== '') {
          const f = labels.find(x => x.key === key);
          notes.push(`the saved value "${cap(norm(raw), 40)}" for ${f ? String(f.label).replace(/\s+/g, ' ') : key} is not something the form accepts, so it was skipped. Check that field in Data Entry.`);
        }
      }
      return wrap('adt1-json');
    }
    const F = norm(doc && doc.text);
    let docType = (doc && doc.docType) || detectDocType(F);
    if (!F) { notes.push('No text could be read from this file.'); return wrap(docType === 'scanned' ? 'scanned' : 'unknown'); }
    const add = (key, value, conf, idx, len, o) => {
      const v = normVal(key, value, o);
      if (v == null) return;
      const a = Math.max(0, idx - 25), b = Math.min(F.length, idx + len + 25);
      let quote = F.slice(a, b);
      if (a > 0 && F[a - 1] !== ' ') quote = quote.replace(/^\S*\s/, '');   // do not start or end in the middle of a word
      if (b < F.length && F[b] !== ' ') quote = quote.replace(/\s\S*$/, '');
      quote = cap(quote.trim(), 170);
      proposals.push({ key, value: v, confidence: r2(conf), method: 'rules', evidence: { file, quote } });
    };
    if (docType === 'filed-adt1') extractFiled(file, F, add, notes); else extractGeneric(file, F, docType, add);
    return wrap(docType);
  }
  const cmp = (key, v) => (KIND[key] === 'date' || KIND[key] === 'select' ? String(v) : loose(v));
  function dedupeWithin(list) {
    const seen = new Map(); const out = [];
    for (const p of list) {
      const k = p.key + '|' + cmp(p.key, p.value);
      const prev = seen.get(k);
      if (prev) { if (p.confidence > prev.confidence) { prev.confidence = p.confidence; prev.evidence = p.evidence; } continue; }
      seen.set(k, p); out.push(p);
    }
    return out;
  }

  /** Merge proposal lists (from several documents and/or the AI). Same value -> one proposal with higher confidence;
   *  different values for one key -> every value kept, flagged conflict:true, confidence lowered. */
  function mergeProposals(all) {
    const byKey = new Map();
    for (const p of all) { if (!byKey.has(p.key)) byKey.set(p.key, []); byKey.get(p.key).push(p); }
    const out = [];
    for (const [key, arr] of byKey) {
      const groups = new Map();
      for (const p of arr) { const k = cmp(key, p.value); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
      const merged = [...groups.values()].map(g => {
        g.sort((a, b) => b.confidence - a.confidence);
        const top = Object.assign({}, g[0]);
        if (g.length > 1) {
          const methods = new Set(g.map(x => x.method));
          const files = new Set(g.map(x => x.evidence && x.evidence.file));
          const bump = methods.size > 1 ? 0.1 : files.size > 1 ? 0.06 : 0.03;
          top.confidence = r2(Math.min(0.98, top.confidence + bump));
          if (methods.size > 1 || [...methods][0] === 'both') top.method = 'both';
          top.alsoIn = [...files].filter(f => f && f !== (top.evidence && top.evidence.file));
          const other = g.find(x => x.evidence && top.evidence && x.evidence.file !== top.evidence.file && x.method !== top.method);
          if (other) top.aiEvidence = other.evidence;
        }
        return top;
      });
      if (merged.length > 1) { if (!merged.every(m => m.conflict)) merged.forEach(m => { m.conflict = true; m.confidence = r2(Math.min(m.confidence * 0.75, 0.59)); }); }
      else delete merged[0].conflict;
      merged.sort((a, b) => b.confidence - a.confidence);
      out.push(...merged);
    }
    return out;
  }

  function extractAdt1(docs, opts) {
    const per = (docs || []).map(d => extractAdt1Doc(d, opts));
    const docTypes = per.map(p => ({ file: p.file, type: p.docType, label: DOC_LABELS[p.docType] || p.docType, cin: p.cin || '' }));
    return {
      proposals: mergeProposals([].concat(...per.map(p => p.proposals))),
      docTypes,
      notes: [].concat(...per.map(p => p.notes)),
      company: companyCheck(docTypes, opts && opts.formCin)
    };
  }

  /** Do the documents (and the CIN already in the form) all belong to ONE company?
   *  docs = [{ file, cin }] (cin '' when the document shows none). Returns { ok, reference, odd:[file...], groups, text }.
   *  The form's CIN is the reference when there is one; otherwise the CIN that most documents carry. Every document with
   *  another CIN is "odd": the UI must not tick its values by default. A document without a CIN is never odd. */
  function companyCheck(docs, formCin) {
    const list = (docs || []).filter(d => d && d.cin).map(d => ({ file: d.file, cin: String(d.cin).toUpperCase() }));
    const ref = normVal('cin', formCin || '') || '';
    const count = new Map();
    for (const d of list) count.set(d.cin, (count.get(d.cin) || 0) + 1);
    const cins = [...count.keys()];
    if (!cins.length) return { ok: true, reference: ref, odd: [], groups: [], text: '' };
    const major = ref || cins.slice().sort((a, b) => count.get(b) - count.get(a))[0];
    const groups = cins.map(c => ({ cin: c, files: list.filter(d => d.cin === c).map(d => d.file) }));
    const odd = list.filter(d => d.cin !== major).map(d => d.file);
    if (!odd.length) return { ok: true, reference: major, odd, groups, text: '' };
    const say = g => `${g.files.join(', ')} (CIN ${g.cin})`;
    const oddGroups = groups.filter(g => g.cin !== major);
    const text = ref
      ? `The form is for CIN ${ref}, but ${oddGroups.map(say).join(' and ')} ${odd.length > 1 ? 'belong' : 'belongs'} to a different company. Values from ${odd.length > 1 ? 'those files' : 'that file'} are not ticked: check that you uploaded the right company's documents before you use any of them.`
      : `These documents are for different companies: ${groups.map(say).join('; ')}. Only the values from ${groups.find(g => g.cin === major).files.join(', ')} are ticked by default; remove the other ${odd.length > 1 ? 'files' : 'file'}, or tick its values yourself if that is really the company you are filing for.`;
    return { ok: false, reference: major, odd, groups, text };
  }

  /** One row per field: the best value, with `conflict: { value, method, evidence, confidence }` when another value was proposed. */
  function consolidate(list) {
    const byKey = new Map();
    for (const p of mergeProposals(list || [])) { if (!byKey.has(p.key)) byKey.set(p.key, []); byKey.get(p.key).push(p); }
    return [...byKey.values()].map(arr => {
      const top = Object.assign({}, arr[0]);
      if (arr.length > 1) {
        const alt = arr[1];
        top.conflict = { value: alt.value, method: alt.method, evidence: alt.evidence, confidence: alt.confidence };
        top.alternatives = arr.slice(1);
        top.confidence = Math.min(top.confidence, 0.6);
      } else delete top.conflict;
      return top;
    });
  }

  /* ───────────── AI side: prompt, schema, validation of the answer ───────────── */
  const ATTACHMENTS = [
    { tag: 'mandatory', text: '(a) Copy of the intimation sent by the company to the auditor (the appointment letter)' },
    { tag: 'mandatory', text: "(b) Copy of the written consent given by the auditor (consent and eligibility certificate)" },
    { tag: 'optional', text: '(c) Copy of the resignation letter given by the earlier auditor (only for a casual vacancy)' },
    { tag: 'optional', text: '(d) Copy of the Central Government order (only when the Central Government appointed the auditor)' },
    { tag: 'optional', text: '(e) Optional attachments: the board resolution and, for an appointment or re-appointment at the AGM, the AGM resolution' }
  ];
  function fieldList() {
    if (typeof ADT1_FIELD_LIST !== 'undefined') return ADT1_FIELD_LIST;    // browser: js/adt1-form.js is loaded before this file
    try { if (typeof require === 'function') return require('./adt1-form.js').ADT1_FIELD_LIST; } catch (_) { /* no form module */ }
    return [];
  }
  /** Every field the AI may answer: { key, label, type, options? }. */
  function aiFieldCatalog(fields) {
    return (fields || fieldList()).filter(f => f.type !== 'check' && KIND[f.key]).map(f => {
      const type = f.type === 'date' ? 'date (write DD/MM/YYYY)' : f.type === 'select' ? 'one of the options' : f.fmt === 'cin' ? 'text (21-character CIN)' : f.fmt === 'pan' ? 'text (PAN, like AAAAA9999A)' : f.fmt === 'pin' ? 'text (6-digit PIN)' : f.fmt === 'int' ? 'whole number' : f.fmt === 'email' ? 'text (e-mail)' : 'text';
      const c = { key: f.key, label: String(f.label).replace(/\s+/g, ' '), type };
      if (f.type === 'select') c.options = f.opts.slice();
      return c;
    });
  }
  function aiSystemPrompt() {
    return [
      'You read documents for an Indian company filing Form ADT-1 (appointment of auditor, section 139 Companies Act 2013): board resolutions, auditor consent / eligibility certificates, appointment letters, AGM notices and resolutions, and earlier filed ADT-1 forms.',
      'Extract ONLY what the documents state. Never infer, calculate, guess or invent. If a value is not stated, leave that field out. Never fill a field from general knowledge.',
      'For every value give a short quote (under 12 words) copied exactly from the document, and the file name it came from. The quote must be the words that show the answer: for a Yes/No question or a count, quote the sentence that states it, not an unrelated line.',
      'If two documents disagree, return both values as separate entries.',
      'Use only the field keys listed in the user message. For a field with options, answer with EXACTLY one of the listed options.',
      'Answer with one JSON object {"fields":[{"key":"...","value":"...","quote":"...","file":"..."}],"notes":["..."]} and nothing else.'
    ].join('\n');
  }
  function aiSchema() {
    const keys = aiFieldCatalog().map(c => c.key);
    const key = keys.length ? { type: 'string', enum: keys } : { type: 'string' };
    return {
      type: 'object', additionalProperties: false, required: ['fields', 'notes'],
      properties: {
        fields: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'value', 'quote', 'file'], properties: { key, value: { type: 'string' }, quote: { type: 'string' }, file: { type: 'string' } } } },
        notes: { type: 'array', items: { type: 'string' } }
      }
    };
  }
  /** Trim boilerplate, dedupe identical lines and identical documents, cap the length. One string for ALL documents. */
  function prepareAiText(docs, opts) {
    const perDoc = (opts && opts.perDoc) || 12000, total = (opts && opts.total) || 40000;
    const seenDocs = new Set(); const parts = []; let used = 0;
    for (const d of docs || []) {
      if (!d || !d.text) continue;
      const lz = loose(d.text); const sig = lz.slice(0, 4000) + lz.length; if (seenDocs.has(sig)) continue; seenDocs.add(sig);
      const seenLines = new Set();
      const body = String(d.text).replace(/\r/g, '').split('\n').map(l => l.replace(/_{3,}/g, ' ').replace(/\bPage\s+\d+\s+of\s+\d+\b/gi, ' ').replace(/[ \t]+/g, ' ').trim())
        .filter(l => { if (l.length < 2 || seenLines.has(l)) return false; seenLines.add(l); return true; }).join('\n');
      const txt = cap(body, Math.min(perDoc, Math.max(0, total - used)));
      if (!txt) break;
      used += txt.length; parts.push(`=== FILE: ${d.name} ===\nType: ${DOC_LABELS[d.docType || detectDocType(d.text)] || 'document'}\n${txt}`);
    }
    return parts.join('\n\n');
  }
  /** The user message: the field list (with exact options) followed by the trimmed text of every document. */
  function aiUserText(docs, catalog, opts) {
    const cat = (catalog || aiFieldCatalog()).map(c => `- ${c.key}: ${c.label} [${c.type}${c.options ? ': ' + c.options.map(o => `"${o}"`).join(' | ') : ''}]`);
    return `Fields (use these keys only):\n${cat.join('\n')}\n\nDocuments:\n${prepareAiText(docs, opts) || '(no text could be extracted; read the attached files)'}`;
  }
  /* What the quote behind an AI answer to a Yes/No / option question must mention, or the answer counts as unverified. */
  const SELECT_EVIDENCE = {
    classUnder139_2: /139\s*\(?\s*2\s*\)?|class(?:es)?\s+of\s+compan|rotation|listed/i,
    natureOfAppointment: /first|casual|vacan|re-?\s?appoint|tribunal|central\s+government|c\s?&\s?ag|comptroller|removal|non-?\s?re|agm|annual\s+general|appoint/i,
    appointedInAgm: /agm|annual\s+general|general\s+meeting|members|shareholders|board/i,
    jointAuditors: /joint|sole|single|one\s+(?:statutory\s+)?auditor|only\s+auditor/i,
    auditorCategory: /firm|individual|proprietor|partner|chartered|llp|&\s*co|and\s+co|frn|registration/i,
    within20CompaniesLimit: /twenty|20\s+compan|limit|141|ceiling|exceed/i,
    previouslyAudited: /previous|earlier|prior|audited|re-?\s?appoint|eligible|term|years?|fresh|first\s+time|never|not\s+(?:been|held)/i,
    auditCommitteeRecommendation: /audit\s+committee|recommend|not\s+applicable|177/i,
    casualVacancyReason: /resign|death|died|disqualif|vacan|incapac|ceas/i,
    signatoryDesignation: /director|secretary|ceo|cfo|manager|liquidator|resolution\s+professional|\birp\b|\brp\b|chief/i
  };
  const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  /** "5" is backed by a quote that says "5", "(5)", "five" or "5 years"; a digit inside another number does not count. */
  function numberInQuote(value, quote) {
    const n = +value; if (!(n >= 0)) return false;
    const word = NUM_WORDS[n];
    return new RegExp(`(?<![\\d.])${n}(?![\\d.])${word ? `|\\b${word}\\b` : ''}`, 'i').test(norm(quote));
  }

  /** Validate the model's JSON the same way as the rules output. Returns { proposals, dropped:[{key,reason}], notes }. */
  function normalizeAiOutput(ai, docs) {
    const out = { proposals: [], dropped: [], notes: [] };
    if (!ai || typeof ai !== 'object') return out;
    if (Array.isArray(ai.notes)) out.notes = ai.notes.filter(n => typeof n === 'string').slice(0, 5);
    const texts = new Map((docs || []).map(d => [d.name, norm(d.text)]));
    const all = [...texts.values()].join(' ');
    const dateSets = new Map();
    const dateSet = t => { if (!dateSets.has(t)) dateSets.set(t, new Set(findDates(t).map(x => x.iso))); return dateSets.get(t); };
    let list = ai.fields;
    if (list && !Array.isArray(list) && typeof list === 'object') list = Object.entries(list).map(([key, v]) => (v && typeof v === 'object' ? Object.assign({ key }, v) : { key, value: v }));
    for (const f of Array.isArray(list) ? list : []) {
      if (!f || typeof f.key !== 'string' || !KIND[f.key]) { if (f && f.key) out.dropped.push({ key: String(f.key), reason: 'unknown field' }); continue; }
      if (f.value == null || f.value === '') continue;
      const value = normVal(f.key, f.value);
      if (value == null) { out.dropped.push({ key: f.key, reason: 'not a valid value' }); continue; }
      const file = texts.has(f.file) ? f.file : ([...texts.keys()].find(n => f.file && n.toLowerCase().includes(String(f.file).toLowerCase())) || (f.file ? String(f.file) : ''));
      const text = texts.get(file) || all;
      // The quote must really be in the document and long enough to mean something (a one-word "quote" proves nothing).
      const quote = norm(f.quote); const quoteOk = loose(quote).length >= 12 && loose(text).includes(loose(quote));
      const k = KIND[f.key];
      let valueOk;
      if (k === 'date') valueOk = dateSet(text).has(value) || dateSet(all).has(value);
      else if (ID_KINDS.has(k) || k === 'person' || k === 'org' || k === 'text') valueOk = loose(all).includes(loose(value));
      else if (k === 'select') valueOk = quoteOk && (SELECT_EVIDENCE[f.key] || /./).test(quote);   // the quote must show the answer
      else if (k === 'int') valueOk = quoteOk && numberInQuote(value, quote);
      else valueOk = quoteOk;
      const idLike = ID_KINDS.has(k) || k === 'date' || k === 'person';
      const answerLike = k === 'select' || k === 'int';
      const unverified = (idLike || answerLike) && !valueOk;
      let conf = unverified ? 0.35 : quoteOk && valueOk ? 0.85 : quoteOk || valueOk ? 0.7 : 0.5;
      if (answerLike) conf = Math.min(conf, 0.75);   // a Yes/No or a count that only the AI gives is never ticked by default
      const p = { key: f.key, value, confidence: conf, method: 'ai', evidence: { file, quote: cap(quote, 170) } };
      if (unverified) { p.unverified = true; if (answerLike) p.unverifiedWhy = 'quote'; }
      out.proposals.push(p);
    }
    out.proposals = dedupeWithin(out.proposals);
    return out;
  }

  return {
    NATURE, NATURE_OPTIONS, DESIGNATIONS, SELECTS, KEYS, KIND, DOC_LABELS, ATTACHMENTS,
    norm, parseDate, findDates, normalizeValue, natureFromText, detectDocType, designationOf,
    extractAdt1, extractAdt1Doc, mergeProposals, consolidate, companyCheck, aiFieldCatalog, aiSystemPrompt, aiUserText, aiSchema, prepareAiText, normalizeAiOutput
  };
});
