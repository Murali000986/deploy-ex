/* AOC-4 document extractor — shared by dashboard.html (browser) and the Node tests.
 *
 * Input: documents ingested from Excel/CSV (sheets of cells), PDFs (positioned text items from
 * pdf.js), plain text, or the text of a filed AOC-4 form. Output: proposals
 *   { path, value, period, evidence: { file, where, quote }, confidence, method: 'rules' }
 * where `period` is the balance-sheet date (YYYY-MM-DD) a figure belongs to; the caller maps it to
 * the form's current/previous column with assignPeriods(). Nothing here touches the DOM.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AOC4Extract = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ───────────── small helpers ───────────── */
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const monthOf = name => MONTHS[String(name || '').toLowerCase().slice(0, 3)] || null;
  const pad2 = n => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
  const normText = s => String(s ?? '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  const normLabel = s => normText(s).toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/^[\s(]*(?:[ivx]+|[a-z]|\d{1,2})[).:]\s*/i, '')      // leading "(a)", "I.", "12."
    .replace(/^[\s(]*(?:[ivx]+|[a-z]|\d{1,2})[).:]\s*/i, '')      // twice: "(b) (i) Trade payables"
    .replace(/[:\-–—]+$/g, '')
    .replace(/\s+/g, ' ').trim();
  const dmyFromISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };

  /** "33,42,799" → 3342799, "(12,422)" → -12422, "-" → 0, "31.43" → 31.43, "12%" → null. */
  function parseAmount(raw) {
    if (raw == null) return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
    let s = normText(raw).replace(/−/g, '-');
    if (!s) return null;
    if (/^(?:[-–—]|nil|none|n\/?a)$/i.test(s)) return 0;
    if (/%/.test(s)) return null;
    s = s.replace(/^(?:rs\.?|inr|₹)\s*/i, '').replace(/\s*(?:cr|dr)\.?$/i, m => /cr/i.test(m) ? '' : '');
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim(); }
    if (/^-\s*/.test(s)) { neg = !neg; s = s.replace(/^-\s*/, ''); }
    if (/-$/.test(s)) { neg = !neg; s = s.replace(/-$/, ''); }
    s = s.replace(/,/g, '').replace(/\s+/g, '');
    if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) ? (neg ? -n : n) : null;
  }

  /** Period-end date from a header or title. Returns YYYY-MM-DD or null. */
  function parsePeriod(raw, opts = {}) {
    if (raw instanceof Date && !isNaN(raw)) return iso(raw.getFullYear(), raw.getMonth() + 1, raw.getDate());
    const s = normText(raw);
    if (!s) return null;
    let m;
    if ((m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s))) return iso(+m[1], +m[2], +m[3]);
    if ((m = /\b(\d{1,2})(?:st|nd|rd|th)?[\s\-/.,]*([a-z]{3,9})[\s\-/.,]*(\d{2,4})\b/i.exec(s)) && monthOf(m[2])) return iso(year4(m[3]), monthOf(m[2]), +m[1]);
    if ((m = /\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i.exec(s)) && monthOf(m[1])) return iso(+m[3], monthOf(m[1]), +m[2]);
    if ((m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(s))) {
      let d = +m[1], mo = +m[2];
      if (d <= 12 && mo > 12) [d, mo] = [mo, d];
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return iso(year4(m[3]), mo, d);
    }
    if ((m = /\b(?:fy|f\.y\.|financial year)?\s*(\d{4})\s*[-–/]\s*(\d{2}|\d{4})\b/i.exec(s))) {
      const y1 = +m[1]; const y2 = m[2].length === 2 ? Math.floor(y1 / 100) * 100 + +m[2] : +m[2];
      if (y2 === y1 + 1) return iso(y2, 3, 31);
    }
    if (opts.bareYear && (m = /^(?:as at|as on)?\s*(20\d{2})$/i.exec(s))) return iso(+m[1], 3, 31);
    return null;
  }
  function year4(y) { const n = +y; return n < 100 ? 2000 + n : n; }

  /** Unit multiplier declared in a note ("Indian Rupees Hundred", "Rs. in lakhs", "(Rs. '00)"). */
  function detectUnit(text) {
    const s = normText(text).toLowerCase();
    if (!s) return null;
    if (/rs\.?\s*'?00\b(?!0)|rupees? (?:in )?hundreds?\b|in hundreds?\b|\('00\)/.test(s)) return { mult: 100, label: 'hundreds' };
    if (/'000\b|in thousands?\b|rupees? (?:in )?thousands?\b|\(000s?\)/.test(s)) return { mult: 1000, label: 'thousands' };
    if (/\blakhs?\b|\blacs?\b/.test(s)) return { mult: 100000, label: 'lakhs' };
    if (/\bcrores?\b/.test(s)) return { mult: 10000000, label: 'crores' };
    if (/\bmillions?\b|\bmn\b/.test(s)) return { mult: 1000000, label: 'millions' };
    if (/\(rs\.?\)|\(in rs\.?\)|in rupees\b|absolute rupees|\(₹\)|\(inr\)/.test(s)) return { mult: 1, label: 'rupees' };
    return null;
  }

  /* ───────────── what we look for ───────────── */
  // Schedule III line items. ctx: which statement they live in. section: a heading whose figure is
  // the subtotal of the rows below it (used when the statement shows no figure on the heading row).
  const LINE_ITEMS = [
    { key: 'SHARE_CAPITAL', ctx: 'bs', re: [/^(?:equity )?share capital$/, /^total issued, subscribed and (?:fully )?paid[- ]?up share capital$/] },
    { key: 'RESERVES_SURPLUS', ctx: 'bs', re: [/^reserves? and surplus/, /^other equity$/] },
    { key: 'MONEY_AGAINST_WARRANTS', ctx: 'bs', re: [/money received against share warrants/] },
    { key: 'SHARE_APP_PENDING', ctx: 'bs', re: [/share application money pending allotment/] },
    { key: 'LONG_TERM_BORROWINGS', ctx: 'bs', re: [/^long[- ]term borrowings?$/, /^(?:total )?non[- ]current borrowings?$/], sectionRe: [/^long[- ]term liabilit(?:y|ies)$/] },
    { key: 'DEFERRED_TAX_LIAB', ctx: 'bs', re: [/^deferred tax liabilit(?:y|ies)/] },
    { key: 'OTHER_LONG_TERM_LIAB', ctx: 'bs', re: [/^other (?:long[- ]term|non[- ]current) liabilit/] },
    { key: 'LONG_TERM_PROVISIONS', ctx: 'bs', re: [/^long[- ]term provisions?$/, /^non[- ]current provisions?$/] },
    { key: 'SHORT_TERM_BORROWINGS', ctx: 'bs', re: [/^short[- ]term borrowings?$/, /^current borrowings?$/] },
    { key: 'TRADE_PAYABLES_MSME', ctx: 'bs', re: [/trade payables?.*micro (?:and|,) small/, /^(?:total outstanding dues of )?micro (?:enterprises )?and small enterprises$/] },
    { key: 'TRADE_PAYABLES_OTHER', ctx: 'bs', re: [/^trade payables?$/, /trade payables?.*other than micro/, /^(?:total outstanding dues of )?creditors other than micro/] },
    { key: 'OTHER_CURRENT_LIAB', ctx: 'bs', re: [/^other current liabilit/, /^other financial liabilit.*current/] },
    { key: 'SHORT_TERM_PROVISIONS', ctx: 'bs', re: [/^short[- ]term provisions?$/, /^current provisions?$/] },
    { key: 'PPE', ctx: 'bs', re: [/^property,? ?plant and equipment$/, /^tangible assets$/, /^fixed assets$/, /^property,? ?plant and equipment \(net\)$/] },
    { key: 'INTANGIBLE_ASSETS', ctx: 'bs', re: [/^intangible assets$/, /^other intangible assets$/] },
    { key: 'CWIP', ctx: 'bs', re: [/^capital work[- ]in[- ]progress$/] },
    { key: 'INTANGIBLE_UNDER_DEV', ctx: 'bs', re: [/^intangible assets under development$/] },
    { key: 'NON_CURRENT_INVESTMENTS', ctx: 'bs', re: [/^non[- ]current investments?$/, /^long[- ]term investments?$/] },
    { key: 'DEFERRED_TAX_ASSETS', ctx: 'bs', re: [/^deferred tax assets?/] },
    { key: 'LONG_TERM_LOANS_ADVANCES', ctx: 'bs', re: [/^long[- ]term loans and advances$/] },
    { key: 'OTHER_NON_CURRENT_ASSETS', ctx: 'bs', re: [/^other non[- ]current assets$/] },
    { key: 'CURRENT_INVESTMENTS', ctx: 'bs', re: [/^current investments?$/] },
    { key: 'INVENTORIES', ctx: 'bs', re: [/^inventories$/, /^stock[- ]in[- ]trade$/] },
    { key: 'TRADE_RECEIVABLES', ctx: 'bs', re: [/^trade receivables?$/, /^sundry debtors$/] },
    { key: 'CASH_EQUIVALENTS', ctx: 'bs', re: [/^cash and cash equivalents$/, /^cash and bank balances?$/] },
    { key: 'SHORT_TERM_LOANS_ADVANCES', ctx: 'bs', re: [/^short[- ]term loans and advances$/] },
    { key: 'OTHER_CURRENT_ASSETS', ctx: 'bs', re: [/^other current assets$/] },
    { key: 'REVENUE_OPERATIONS', ctx: 'pl', re: [/^revenue from operations/, /^sales?$/, /^turnover$/] },
    { key: 'OTHER_INCOME', ctx: 'pl', re: [/^other income$/] },
    { key: 'EMPLOYEE_EXPENSES', ctx: 'pl', re: [/^employee benefits? expenses?$/, /^employee costs?$/, /^salaries and wages$/] },
    { key: 'MANAGERIAL_REMUNERATION', ctx: 'pl', re: [/^managerial remuneration$/, /^directors'? remuneration$/, /^salary to directors$/] },
    { key: 'FINANCE_COSTS', ctx: 'pl', re: [/^finance costs?$/, /^interest and finance charges$/] },
    { key: 'DEPRECIATION', ctx: 'pl', re: [/^depreciation and amorti[sz]ation/, /^depreciation$/] },
    { key: 'OTHER_EXPENSES', ctx: 'pl', re: [/^other expenses$/, /^administrative and other expenses$/] },
    { key: 'CURRENT_TAX', ctx: 'pl', re: [/^current tax/, /^income tax$/, /^provision for (?:income )?tax(?:ation)?$/] },
    { key: 'DEFERRED_TAX', ctx: 'pl', re: [/^deferred tax(?: expense| charge| \(credit\))?$/] }
  ];
  // Figures kept for cross-checks only (not form fields).
  const CHECK_ITEMS = [
    { key: 'TOTAL_BS', ctx: 'bs', re: [/^total$/, /^total equity and liabilities$/, /^total assets$/] },
    { key: 'TOTAL_INCOME', ctx: 'pl', re: [/^total income$/, /^total revenue$/] },
    { key: 'TOTAL_EXPENSES', ctx: 'pl', re: [/^total expenses$/] },
    { key: 'PBT', ctx: 'pl', re: [/^profit\b.*before tax/] },
    { key: 'PAT', ctx: 'pl', re: [/^profit\b.*(?:after tax|for the (?:year|period))/] },
    { key: 'EPS_BASIC', ctx: 'pl', re: [/^basic(?: and diluted)?(?: \(in indian rupees\))?$/, /^basic eps/] },
    { key: 'EPS_DILUTED', ctx: 'pl', re: [/^diluted(?: \(in indian rupees\))?$/, /^basic and diluted/] }
  ];
  const BS_KEYS = new Set(LINE_ITEMS.filter(i => i.ctx === 'bs').map(i => i.key));
  const PL_KEYS = new Set(LINE_ITEMS.filter(i => i.ctx === 'pl').map(i => i.key));
  const DESIGNATIONS = ['Managing Director', 'Director', 'CEO', 'CFO', 'Manager', 'Secretary', 'IRP', 'RP', 'Liquidator', 'Partner', 'Proprietor'];

  function matchItem(labelNorm, items = LINE_ITEMS) {
    for (const it of items) if (it.re.some(r => r.test(labelNorm))) return { item: it, section: false };
    for (const it of items) if (it.sectionRe && it.sectionRe.some(r => r.test(labelNorm))) return { item: it, section: true };
    return null;
  }
  const isTotalLabel = l => /^total\b|^grand total$/.test(l);
  const isHeadingLabel = l => /^(?:equity and liabilities|assets|income|expenses|shareholders'? funds|non[- ]current (?:liabilities|assets)|current (?:liabilities|assets)|tax expenses?|liabilities)$/.test(l);

  /* ───────────── grids: sheets and PDF pages become rows of cells ───────────── */
  /** pdf.js text items ({str, transform, width}) → lines of cells {text, x, w}, top to bottom. */
  function linesFromItems(items) {
    const lines = [];
    for (const it of items) {
      const s = String(it.str ?? it.s ?? '');
      if (!s.trim()) continue;
      const x = it.transform ? it.transform[4] : it.x, y = it.transform ? it.transform[5] : it.y, w = it.width ?? it.w ?? s.length * 4;
      let line = lines.find(l => Math.abs(l.y - y) <= 2.5);
      if (!line) { line = { y, cells: [] }; lines.push(line); }
      line.cells.push({ text: s, x, w });
    }
    lines.sort((a, b) => b.y - a.y);
    for (const line of lines) {
      line.cells.sort((a, b) => a.x - b.x);
      // Merge items that touch (one word split across items), keep real column gaps.
      const merged = [];
      for (const c of line.cells) {
        const prev = merged[merged.length - 1];
        if (prev && c.x - (prev.x + prev.w) <= 6 && !(looksNumeric(prev.text) && looksNumeric(c.text) && c.x - (prev.x + prev.w) > 2.5)) {
          prev.text = `${prev.text} ${c.text}`.replace(/\s+/g, ' ').trim(); prev.w = c.x + c.w - prev.x;
        } else merged.push({ text: c.text.trim(), x: c.x, w: c.w });
      }
      line.cells = merged.filter(c => c.text);
      line.text = line.cells.map(c => c.text).join(' ');
    }
    return lines.filter(l => l.cells.length);
  }
  const looksNumeric = t => /^\(?-?[\d,]+(?:\.\d+)?\)?$/.test(normText(t));
  const isNilToken = t => /^[-–—]$/.test(normText(t));

  /** A sheet (array of arrays) → rows of cells {text, x: column}. */
  function rowsFromSheet(rows) {
    return rows.map((r, ri) => {
      const cells = [];
      (r || []).forEach((v, ci) => {
        if (v === '' || v == null) return;
        const text = v instanceof Date ? parsePeriod(v) : typeof v === 'number' ? v : normText(v);
        if (text === '' || text == null) return;
        cells.push({ text, x: ci });
      });
      return { y: ri, cells, text: cells.map(c => String(c.text)).join(' ') };
    }).filter(r => r.cells.length);
  }

  /* ───────────── tables: header rows with period columns, data rows with label + values ───────────── */
  function headerColumns(row, mode) {
    const cols = [];
    for (const c of row.cells) {
      if (typeof c.text === 'number') continue;
      const period = parsePeriod(c.text) || (mode === 'sheet' ? parsePeriod(c.text, { bareYear: true }) : null);
      if (!period) continue;
      const unit = detectUnit(c.text);
      cols.push({ x: c.x, right: mode === 'pdf' ? c.x + c.w : c.x, period, unit });
    }
    if (cols.length < 1) return null;
    // Two period columns at least, or one period column in a note-style table with a label column.
    if (cols.length < 2 && !/particulars|as at|year ended/i.test(row.text)) return null;
    return cols;
  }

  function cellValuesForColumns(row, cols, mode, tol) {
    const assigned = cols.map(() => []);
    const rest = [], nils = [];
    for (const c of row.cells) {
      if (mode === 'sheet') {
        const ci = cols.findIndex(col => col.x === c.x);
        if (ci >= 0) assigned[ci].push(c); else rest.push(c);
        continue;
      }
      const right = c.x + c.w;
      let best = -1, bestD = Infinity;
      cols.forEach((col, i) => { const d = Math.abs(col.right - right); if (d < bestD) { bestD = d; best = i; } });
      const txt = normText(c.text);
      if (best >= 0 && bestD <= tol && looksNumeric(txt.replace(/^-\s+/, '-'))) assigned[best].push(c);
      else if (isNilToken(txt)) nils.push(c);
      else rest.push(c);
    }
    // A lone "-" inside a column's span is the sign of that column's number when there is one (a loss
    // printed "-      23,28,002", sign left-aligned, figure right-aligned) and a nil cell otherwise.
    for (const n of nils) {
      const idx = cols.findIndex((col, i) => n.x >= (i ? cols[i - 1].right + 3 : col.x - 80) && n.x + n.w <= col.right + 3);
      if (idx < 0) { rest.push(n); continue; }
      if (assigned[idx].length) assigned[idx].unshift(n); else assigned[idx].push(n);
    }
    const values = assigned.map(cells => cells.length ? parseAmount(cells.map(c => String(c.text)).join(' ').replace(/^-\s*(?=[\d(])/, '-')) : null);
    return { values, rest };
  }

  function labelFromCells(cells, firstColX, mode) {
    const parts = [];
    for (const c of cells) {
      if (mode === 'sheet' ? c.x >= firstColX : c.x >= firstColX - 1) continue;
      const t = String(c.text);
      if (typeof c.text === 'number' && Number.isInteger(c.text) && c.text >= 0 && c.text < 100) continue; // note number
      if (/^(?:[ivx]+|[a-z]|\d{1,2})\.?$/i.test(t)) continue;                                              // "I.", "(a)", "3"
      parts.push(t);
    }
    return normText(parts.join(' ')).replace(/\s+\d{1,2}(?:\.\d)?$/, '').replace(/\s+\d{1,2}(?:\.\d)?$/, '');
  }

  /** Scan one grid (sheet or PDF page) for period tables; returns matched line rows. */
  function scanGrid(rows, { mode, docUnit, where, ctxHint }) {
    const out = [];          // { key, check, section, label, values: {period: amount}, where, ctx }
    let cols = null, tol = 20, colUnits = [];
    let shareNote = null;    // 'auth' | 'issued' while inside the share capital note
    const ctx = ctxHint || detectContext(rows.slice(0, 8).map(r => r.text).join(' \n '));
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const hdr = headerColumns(row, mode);
      if (hdr && (!cols || hdr.length >= 1)) {
        cols = hdr;
        if (mode === 'pdf') {
          const rights = cols.map(c => c.right).sort((a, b) => a - b);
          const gaps = rights.slice(1).map((r, k) => r - rights[k]);
          tol = Math.max(15, (gaps.length ? Math.min(...gaps) : 60) * 0.45);
        }
        colUnits = cols.map(c => c.unit ? c.unit.mult : (docUnit ? docUnit.mult : 1));
        continue;
      }
      if (!cols) continue;
      const firstColX = Math.min(...cols.map(c => mode === 'sheet' ? c.x : c.x));
      const { values, rest } = cellValuesForColumns(row, cols, mode, tol);
      const label = labelFromCells(rest, firstColX, mode);
      const labelNorm = normLabel(label);
      const hasValues = values.some(v => v !== null);
      // Share capital note: counts and nominal amounts.
      if (/^authori[sz]ed/.test(labelNorm)) shareNote = 'auth';
      else if (/^issued|subscribed|paid[- ]?up/.test(labelNorm) && !/total/.test(labelNorm)) shareNote = 'issued';
      else if (/^reconciliation|^terms|^details of shareholders|^\(?[a-z]\)? ?(?:reconciliation|terms|details)/.test(labelNorm) || /^note \d|^\d+[:.]? [a-z]/.test(labelNorm) && !/share capital/.test(labelNorm)) shareNote = null;
      const shareLine = /([\d,]+)\s*\(.*?previous year.*?\)\s*(?:equity )?shares? of rs\.?\s*([\d.]+)/i.exec(label) || /^([\d,]+)\s+(?:equity )?shares? of rs\.?\s*([\d.]+)/i.exec(label);
      if (shareLine && hasValues) {
        const count = parseAmount(shareLine[1]), face = parseAmount(shareLine[2]);
        const vals = periodValues(values, cols, colUnits, docUnit);
        if (shareNote === 'auth') { out.push({ key: 'AUTH_SHARES', values: constValues(vals, count), label, where: where(row), ctx: 'sc', raw: true }); out.push({ key: 'AUTH_NOMINAL', values: vals, label, where: where(row), ctx: 'sc' }); }
        if (shareNote === 'issued') { out.push({ key: 'PAID_UP_SHARES', values: constValues(vals, count), label, where: where(row), ctx: 'sc', raw: true }); out.push({ key: 'PAID_UP_NOMINAL', values: vals, label, where: where(row), ctx: 'sc' }); }
        if (face) out.push({ key: 'FACE_VALUE', values: constValues(vals, face), label, where: where(row), ctx: 'sc', raw: true });
        continue;
      }
      if (!labelNorm) continue;
      const m = matchItem(labelNorm) || matchItem(labelNorm, CHECK_ITEMS);
      if (!m) continue;
      const isCheck = CHECK_ITEMS.includes(m.item);
      if (m.item.key === 'TOTAL_BS' && ctx !== 'bs') continue;
      let vals = hasValues ? periodValues(values, cols, colUnits, docUnit) : null;
      if (!vals && m.section) {
        // Heading without figures: the subtotal row (empty label with numbers) or the sum of the items below.
        let sum = null;
        for (let j = i + 1; j < Math.min(rows.length, i + 10); j++) {
          const r2 = cellValuesForColumns(rows[j], cols, mode, tol);
          const l2 = normLabel(labelFromCells(r2.rest, firstColX, mode));
          const has2 = r2.values.some(v => v !== null);
          if (!has2) { if (l2 && (isHeadingLabel(l2) || matchItem(l2))) break; continue; }
          const v2 = periodValues(r2.values, cols, colUnits, docUnit);
          if (!l2 || isTotalLabel(l2)) { sum = v2; break; }                // explicit subtotal row
          if (isHeadingLabel(l2) || matchItem(l2)) break;
          sum = sum ? addValues(sum, v2) : v2;
        }
        vals = sum;
      }
      if (!vals) continue;
      out.push({ key: m.item.key, check: isCheck, section: m.section, label, values: vals, where: where(row), ctx });
    }
    return out;
  }
  const constValues = (vals, c) => Object.fromEntries(Object.keys(vals).map(p => [p, c]));
  const addValues = (a, b) => { const o = { ...a }; for (const [p, v] of Object.entries(b)) o[p] = (o[p] ?? 0) + (v ?? 0); return o; };

  /** Column values → { period: amount } with unit multipliers; duplicate period columns resolved. */
  function periodValues(values, cols, colUnits, docUnit) {
    const byPeriod = {};
    cols.forEach((col, i) => {
      if (values[i] === null || values[i] === undefined) return;
      (byPeriod[col.period] = byPeriod[col.period] || []).push({ v: values[i], mult: colUnits[i], explicit: !!col.unit });
    });
    const out = {};
    for (const [p, list] of Object.entries(byPeriod)) {
      if (list.length === 1) { out[p] = Math.round(list[0].v * list[0].mult * 100) / 100; continue; }
      // Same date twice (e.g. "in hundreds" beside absolute rupees): the pair whose ratio equals the
      // declared unit tells which column is already absolute.
      const nz = list.filter(e => e.v !== 0);
      if (nz.length >= 2) {
        const hi = Math.max(...nz.map(e => Math.abs(e.v))), lo = Math.min(...nz.map(e => Math.abs(e.v)));
        const mult = docUnit ? docUnit.mult : 1;
        if (mult > 1 && lo > 0 && Math.abs(hi / lo - mult) / mult < 0.03) { out[p] = nz.find(e => Math.abs(e.v) === hi).v; continue; }
      }
      const e = list.find(x => x.explicit) || list[list.length - 1];
      out[p] = Math.round(e.v * e.mult * 100) / 100;
    }
    return out;
  }

  function detectContext(text) {
    const t = String(text || '').toLowerCase();
    if (/statement of profit and loss|profit and loss (?:account|statement)|profit & loss/.test(t)) return 'pl';
    if (/balance sheet/.test(t)) return 'bs';
    if (/notes? to (?:the )?financial statements|notes forming part/.test(t)) return 'notes';
    return 'other';
  }

  /* ───────────── facts from free text (any document) ───────────── */
  function extractFacts(text, grid) {
    const t = normText(text);
    const facts = [];
    const add = (path, value, quote, confidence = 0.8) => { if (value !== '' && value != null) facts.push({ path, value, quote: normText(quote).slice(0, 140), confidence }); };
    let m;
    if ((m = /\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/.exec(t))) add('general.CIN', m[1], m[0], 0.95);
    if ((m = /ICAI Firm Registration No\.?\s*:?\s*([0-9]{6}[A-Z]\b)/i.exec(t))) add('auditor.AUDITOR_FIRM_REG', m[1], m[0], 0.9);
    if ((m = /Membership No\.?\s*:?\s*(\d{6})\b/i.exec(t))) add('auditor.MEMBER_NUMBER', m[1], m[0], 0.9);
    if ((m = /\bFor\s+((?:(?!\bFor\b|Chartered|ICAI|Firm Registration)[A-Za-z.&' ]){2,60}?)\s+(?:For and on behalf|Chartered Accountants|ICAI|Firm Registration)/.exec(t))) add('auditor.AUDITOR_NAME', normText(m[1]), m[0], 0.85);
    // "per Sumit Jain" sits in its own cell/column; the plain text may run on into the directors' names.
    const perCell = grid && grid.flatMap(r => r.cells).map(c => /^per\s+([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,3})$/.exec(normText(c.text))).find(Boolean);
    if (perCell) add('auditor.MEMBER_NAME', perCell[1], perCell[0], 0.8);
    else if ((m = /\bper\s+([A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){0,2})\s+(?:Partner|Proprietor)\b/.exec(t))) add('auditor.MEMBER_NAME', m[1], m[0], 0.75);
    if ((m = /\bUDIN\s*:?\s*([0-9A-Z]{18})\b/i.exec(t))) add('_meta.udin', m[1], m[0], 0.9);
    const company = /\b([A-Z][A-Za-z0-9&.'()\- ]{2,80}?(?:Private Limited|Pvt\.? Ltd\.?|Limited|Ltd\.?|LLP))\b/.exec(t);
    if (company && !/for and on behalf of/i.test(t.slice(Math.max(0, company.index - 25), company.index))) add('meta.companyName', normText(company[1]), company[0], 0.7);
    // Statement dates: "Balance Sheet as at March 31, 2026" fixes the financial year.
    const asAt = /(?:balance sheet as at|as at|for the (?:year|period) ended)\s+([A-Za-z0-9 ,.\-/]{6,30}?)(?=\s*(?:\(|particulars|notes?|$|[A-Z]))/i.exec(t);
    const fyEnd = asAt ? parsePeriod(asAt[1]) : null;
    if (fyEnd) add('_meta.fyEnd', fyEnd, asAt[0], 0.9);
    // Signing date: "Date: 30th September, 2025" / "Date: 30-9-26".
    const dateM = /\bDate\s*:?\s*([0-9]{1,2}(?:st|nd|rd|th)?[\s\-/.,]*(?:[A-Za-z]{3,9}|\d{1,2})[\s\-/.,]*\d{2,4})/i.exec(t);
    const signed = dateM ? parsePeriod(dateM[1]) : null;
    if (signed) { add('general.AUDITOR_SIGN_DATE', dmyFromISO(signed), dateM[0], 0.7); add('general.BOARD_MEETING_DATE', dmyFromISO(signed), dateM[0], 0.6); }
    // Signatories from "DIN: 08302207" cells, name two rows up, designation one row up, same column.
    const signatories = [];
    if (grid) {
      grid.forEach((row, ri) => {
        for (const c of row.cells) {
          const dm = /\bDIN\s*:?\s*(\d{8})\b/i.exec(String(c.text));
          if (!dm) continue;
          const near = (r, ref) => r && r.cells.filter(k => Math.abs(k.x - c.x) <= (typeof c.x === 'number' && Number.isInteger(c.x) && grid.mode === 'sheet' ? 0 : 60)).map(k => String(k.text));
          const up1 = near(grid[ri - 1], c), up2 = near(grid[ri - 2], c);
          const desig = (up1 || []).map(s => DESIGNATIONS.find(d => new RegExp(`^${d}$`, 'i').test(normText(s)))).find(Boolean) || 'Director';
          const name = (up2 || []).find(s => /^[A-Z][A-Za-z.]+(?:\s+[A-Z][A-Za-z.]+){1,4}$/.test(normText(s)) && !/^(?:per|for|date|place)\b/i.test(s));
          if (name) signatories.push({ din: dm[1], name: normText(name).toUpperCase(), designation: desig, date: signed ? dmyFromISO(signed) : '', quote: `${name} / ${desig} / DIN ${dm[1]}` });
        }
      });
    }
    // AOC-4 form layout: "08302207 PUNIT AHUJA Director 30/09/2025".
    const formSig = /\b(\d{8})\s+([A-Z][A-Z .]{2,60}?)\s+(Managing Director|Director|CEO|CFO|Manager|Secretary|IRP|RP|Liquidator)\s+(\d{2}\/\d{2}\/\d{4})/g;
    while ((m = formSig.exec(t))) if (!signatories.some(s => s.din === m[1])) signatories.push({ din: m[1], name: normText(m[2]), designation: m[3], date: m[4], quote: m[0] });
    return { facts, signatories: dedupe(signatories, s => s.din), fyEnd, signed };
  }
  const dedupe = (arr, keyFn) => { const seen = new Set(); return arr.filter(x => { const k = keyFn(x); if (seen.has(k)) return false; seen.add(k); return true; }); };

  /* ───────────── filed AOC-4 form text (previous year's form is a rich source) ───────────── */
  const FORM_FIELDS = [
    ['general.CIN', /Corporate identity number \(CIN\)\s+([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})/i],
    ['meta.companyName', /Name of the company\s+(.+?)\s+\(b\)\s*\*?Address of the registered office/i],
    ['meta.registeredAddress', /Address of the registered office of the company\s+(.+?)\s+\(c\)\s*\*?e-?mail/i],
    ['_form.FY_FROM', /\*From \(DD\/MM\/YYYY\)\s+(\d{2}\/\d{2}\/\d{4})/i],
    ['_form.FY_TO', /\*To \(DD\/MM\/YYYY\)\s+(\d{2}\/\d{2}\/\d{4})/i],
    ['_form.BOARD_MEETING_DATE', /meeting in which financial statements are approved \(DD\/MM\/YYYY\)\s+(\d{2}\/\d{2}\/\d{4})/i],
    ['_form.BOARD_REPORT_DATE', /boards'? report referred under section 134 was approved \(DD\/MM\/YYYY\)\s+(\d{2}\/\d{2}\/\d{4})/i],
    ['_form.AUDITOR_SIGN_DATE', /reports on the financial statements by the auditors \(DD\/MM\/YYYY\)\s+(\d{2}\/\d{2}\/\d{4})/i],
    ['_form.AGM_DATE', /If yes, date of AGM \(DD\/MM\/YYYY\)\s+(\d{2}\/\d{2}\/\d{4})/i],
    ['_form.AGM_DUE_DATE', /Due date of AGM \(DD\/MM\/YYYY\)\s+(\d{2}\/\d{2}\/\d{4})/i],
    ['auditor.NUM_AUDITORS', /\*Number of Auditors\s+(\d{1,2})\b/i],
    ['auditor.ADT_SRN', /\b([A-Z]{1,2}\d{7,9})\b\s+\d*\s*\*?SRN of Form ADT-1|SRN of Form ADT-1\s+([A-Z]{1,2}\d{7,9})\b/i],
    ['auditor.AUDITOR_PAN', /PAN of auditor or auditor's firm\s+([A-Z]{5}\d{4}[A-Z])/i],
    ['auditor.AUDITOR_FIRM_REG', /Membership number of auditor or auditor's firm's registration number\s+([0-9A-Z]{6,8})\b/i],
    ['auditor.AUDITOR_NAME', /Name of the auditor or auditor's firm\s+(.+?)\s+\(e\) Address of the auditor/i],
    ['auditor.AUDITOR_ADDR1', /Address of the auditor or auditor's firm\s+(.+?)\s+\*Address Line 1/i],
    ['auditor.AUDITOR_ADDR2', /Address of the auditor.*?Address Line 2\s+(.+?)\s+\*Country/i],
    ['auditor.AUDITOR_COUNTRY', /Address of the auditor.*?\*Country\s+([A-Za-z ]+?)\s+\*Pin Code/i],
    ['auditor.AUDITOR_PIN', /Address of the auditor.*?\*Pin Code\/Zip Code\s+(\d{6})/i],
    ['auditor.AUDITOR_AREA', /Address of the auditor.*?\*Area\/Locality\s+(.+?)\s+\*City/i],
    ['auditor.AUDITOR_CITY', /Address of the auditor.*?\*City\s+(.+?)\s+\*District/i],
    ['auditor.AUDITOR_DISTRICT', /Address of the auditor.*?\*District\s+(.+?)\s+\*State\/UT/i],
    ['auditor.AUDITOR_STATE', /Address of the auditor.*?\*State\/UT\s+([A-Za-z ]+?)\s+\(f\)/i],
    ['auditor.MEMBER_NAME', /member signing for the above firm\s+(.+?)\s+\(i\) Name of the member/i],
    ['auditor.MEMBER_NUMBER', /\(ii\) Membership number\s+(\d{6})\b/i],
    ['industry.TYPE_OF_INDUSTRY', /\(Commercial & Industrial\/Banking Company\/Insurance Company\/Power Company\/Non-banking Financial Company \(NBFC\) registered with RBI\s+(Commercial & Industrial|Banking Company|Insurance Company|Power Company|Non[ -]banking Financial Company(?: \(NBFC\))?)/i],
    ['industry.SERVER_ADDR1', /computer servers \(Storing Accounting and data\) Address Line 1\s+(.+?)\s+Address Line 2/i],
    ['industry.SERVER_ADDR2', /computer servers.*?Address Line 2\s+(.+?)\s+Country\s/i],
    ['industry.SERVER_COUNTRY', /computer servers.*?Address Line 2.*?\sCountry\s+([A-Za-z ]+?)\s+Pin Code/i],
    ['industry.SERVER_PIN', /computer servers.*?Pin Code\/Zip Code\s+(\d{6})/i],
    ['industry.SERVER_AREA', /computer servers.*?Area\/Locality\s+(.+?)\s+City\s/i],
    ['industry.SERVER_CITY', /computer servers.*?Area\/Locality.*?\sCity\s+(.+?)\s+District\s/i],
    ['industry.SERVER_DISTRICT', /computer servers.*?\sDistrict\s+(.+?)\s+State\/UT/i],
    ['industry.SERVER_STATE', /computer servers.*?State\/UT\s+([A-Za-z ]+?)\s+\(c\)/i],
    ['industry.SERVICE_PROVIDER_NAME', /\(i\) Name of the service provider\s+([^()]+?)\s+\(ii\) Internet protocol/i],
    ['_form.NET_WORTH', /Net Worth of the company\s+(-?\d+)\b/i],
    ['principalProducts.TOTAL_CATEGORIES', /Total number of product\/ ?services? category\(ies\)\s+(\d+)/i]
  ];
  const isFormText = text => /Form No\. AOC-4|FORM NO\. AOC-4|Form for filing financial statement and other documents/i.test(text || '');

  function extractFormText(text, file) {
    const t = normText(text);
    const facts = [];
    const add = (path, value, quote, confidence = 0.9) => { if (value != null && String(value).trim() !== '') facts.push({ path, value: typeof value === 'string' ? normText(value) : value, quote: normText(quote).slice(0, 140), confidence }); };
    for (const [path, re] of FORM_FIELDS) {
      const m = re.exec(t);
      if (!m) continue;
      const v = m.slice(1).find(g => g != null);
      add(path, /NET_WORTH|TOTAL_CATEGORIES/.test(path) ? parseAmount(v) : v, m[0]);
    }
    // Product/service table: "... (in Rupees) 9992 EDUCATION SERVICES 9961629 99929199 Other education ... 9961629 Note - ..."
    const prod = /Turnover of the product or service category \(in Rupees\).*?Turnover of highest contributing product or service \(in Rupees\)\s+(\d{4})\s+(.+?)\s+(\d{4,})\s+(\d{8})\s+(.+?)\s+(\d{4,})\s+(?:Note\b|SEGMENT)/i.exec(t);
    if (prod) {
      add('principalProducts.CATEGORY_CODE', prod[1], prod[0]); add('principalProducts.CATEGORY_DESC', prod[2], prod[0]); add('_form.CATEGORY_TURNOVER', +prod[3], prod[0]);
      add('principalProducts.HIGHEST_CODE', prod[4], prod[0]); add('principalProducts.HIGHEST_DESC', prod[5], prod[0]); add('_form.HIGHEST_TURNOVER', +prod[6], prod[0]);
    }
    // Period of this form and its balance-sheet / P&L figures ("(a) Share capital 100000 100000").
    const fyTo = facts.find(f => f.path === '_form.FY_TO')?.value;
    const fyFrom = facts.find(f => f.path === '_form.FY_FROM')?.value;
    const toISO = d => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d || ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
    const curEnd = toISO(fyTo), prevEnd = curEnd ? `${+curEnd.slice(0, 4) - 1}${curEnd.slice(4)}` : null;
    const lines = [];
    if (curEnd) {
      const labelTexts = { ...Object.fromEntries(LINE_ITEMS.map(i => [i.key, i])) };
      const segments = t.split(/(?=\(\s*[a-z]\s*\)|(?<=\s)\d{1,2}\s+(?=[A-Z]))/);
      for (const seg of segments) {
        const mm = /^(.*?[a-z)])\s+(-?\d[\d,]*)\s+(-?\d[\d,]*)(?:\s|$)/.exec(seg.trim());
        if (!mm) continue;
        const labelNorm = normLabel(mm[1].replace(/\(i+\)|\(net\)/gi, ' '));
        const hit = matchItem(labelNorm);
        if (!hit || hit.section) continue;
        const cur = parseAmount(mm[2]), prev = parseAmount(mm[3]);
        if (cur === null || prev === null) continue;
        if (lines.some(l => l.key === hit.item.key)) continue;
        lines.push({ key: hit.item.key, label: normText(mm[1]), values: { [curEnd]: cur, [prevEnd]: prev }, where: 'form', ctx: hit.item.ctx });
      }
    }
    return { facts, lines, formFyFrom: fyFrom, formFyTo: fyTo, file };
  }

  /* ───────────── documents → proposals ───────────── */
  /**
   * doc: { name, kind: 'sheet'|'pdf'|'text', sheets?: [{name, rows}], pages?: [{n, items}|{n, lines}], text }
   * Returns { lines, facts, signatories, fyEnd, formPeriod }.
   */
  function analyzeDocument(doc) {
    const fullText = doc.text || '';
    const docUnit = detectUnit(fullText.slice(0, 4000)) || null;
    const lines = [], facts = [], signatories = [];
    let fyEnd = null, signed = null, form = null;
    if (isFormText(fullText)) {
      form = extractFormText(fullText, doc.name);
      facts.push(...form.facts);
      lines.push(...form.lines.map(l => ({ ...l, where: `${doc.name} (form)` })));
      const ef = extractFacts(fullText, null);
      signatories.push(...ef.signatories);
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(form.formFyTo || '');
      if (m) fyEnd = `${m[3]}-${m[2]}-${m[1]}`;   // the form's own year, so its signatories and dates stay with that year
    }
    if (doc.kind === 'sheet') {
      for (const sh of doc.sheets || []) {
        const rows = rowsFromSheet(sh.rows);
        rows.mode = 'sheet';
        const sheetUnit = detectUnit(rows.slice(0, 8).map(r => r.text).join(' ')) || docUnit;
        const ctxHint = /^bs$|balance/i.test(sh.name) ? 'bs' : /^pl$|p&l|profit/i.test(sh.name) ? 'pl' : /note/i.test(sh.name) ? 'notes' : null;
        lines.push(...scanGrid(rows, { mode: 'sheet', docUnit: sheetUnit, where: r => `${sh.name}!R${r.y + 1}`, ctxHint }));
        const ef = extractFacts(rows.map(r => r.text).join('\n'), Object.assign(rows, { mode: 'sheet' }));
        facts.push(...ef.facts.map(f => ({ ...f, where: sh.name }))); signatories.push(...ef.signatories);
        fyEnd = fyEnd || ef.fyEnd; signed = signed || ef.signed;
      }
    } else if (doc.kind === 'pdf' && !form) {
      for (const page of doc.pages || []) {
        const pdfLines = page.lines || linesFromItems(page.items || []);
        pdfLines.mode = 'pdf';
        const pageText = pdfLines.map(l => l.text).join('\n');
        const pageUnit = detectUnit(pdfLines.slice(0, 6).map(l => l.text).join(' ')) || docUnit;
        lines.push(...scanGrid(pdfLines, { mode: 'pdf', docUnit: pageUnit, where: r => `${doc.name} p${page.n}` }));
        const ef = extractFacts(pageText, pdfLines);
        facts.push(...ef.facts.map(f => ({ ...f, where: `p${page.n}` }))); signatories.push(...ef.signatories);
        fyEnd = fyEnd || ef.fyEnd; signed = signed || ef.signed;
      }
    } else if (!form) {
      const ef = extractFacts(fullText, null);
      facts.push(...ef.facts); signatories.push(...ef.signatories); fyEnd = ef.fyEnd; signed = ef.signed;
      // Plain text statements: one line per row, amounts at the end.
      const rows = fullText.split(/\r?\n/).map((l, i) => ({ y: i, cells: l.split(/\s{2,}|\t/).filter(Boolean).map((text, x) => ({ text: normText(text), x })), text: l }));
      lines.push(...scanGrid(rows, { mode: 'sheet', docUnit, where: r => `${doc.name} line ${r.y + 1}` }));
    }
    // The signing date often sits on another page than the DIN block.
    if (signed) for (const s of signatories) if (!s.date) s.date = dmyFromISO(signed);
    return { doc, lines, facts: dedupe(facts, f => `${f.path}|${f.value}`), signatories: dedupe(signatories, s => s.din), fyEnd, signed, form };
  }

  /** Financial year "2025-26" from a balance-sheet date. */
  const fyFromEnd = end => { const y = +String(end).slice(0, 4); const mth = +String(end).slice(5, 7); const y2 = mth >= 4 ? y + 1 : y; return `${y2 - 1}-${String(y2).slice(2)}`; };
  const fyEnds = fy => { const m = /^(\d{4})-(\d{2})$/.exec(fy || ''); if (!m) return null; const y1 = +m[1]; return { current: `${y1 + 1}-03-31`, previous: `${y1}-03-31` }; };
  const dayDiff = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);

  /**
   * analyses: analyzeDocument() results; fy: target financial year ("2025-26") or null to infer.
   * Returns { proposals, signatoriesFS, fy, fyInferred, unmappedPeriods, checks }.
   */
  function buildProposals(analyses, fy, opts = {}) {
    const periodsSeen = new Set();
    for (const a of analyses) for (const l of a.lines) for (const p of Object.keys(l.values)) periodsSeen.add(p);
    let fyInferred = false;
    if (!fy) {
      const ends = [...periodsSeen].filter(p => /-03-31$/.test(p)).sort();
      const fromFacts = analyses.map(a => a.fyEnd).filter(Boolean).sort();
      const end = fromFacts[fromFacts.length - 1] || ends[ends.length - 1];
      if (end) { fy = fyFromEnd(end); fyInferred = true; }
    }
    const ends = fyEnds(fy);
    const column = period => {
      if (!ends) return null;
      if (dayDiff(period, ends.current) <= 20) return 'current';
      if (dayDiff(period, ends.previous) <= 20) return 'previous';
      return null;
    };
    const proposals = [];
    const unmapped = new Set();
    const push = p => proposals.push(p);
    for (const a of analyses) {
      const file = a.doc.name;
      for (const l of a.lines) {
        if (l.check) continue;
        for (const [period, value] of Object.entries(l.values)) {
          if (value === null || value === undefined) continue;
          if (l.ctx === 'sc' || ['AUTH_SHARES', 'AUTH_NOMINAL', 'PAID_UP_SHARES', 'PAID_UP_NOMINAL', 'FACE_VALUE'].includes(l.key)) {
            if (column(period) !== 'current') continue;
            // Spreadsheet formulas carry fractions of a rupee; the form takes whole rupees.
            push({ path: `shareCapital.${l.key}`, value: l.key === 'FACE_VALUE' ? Math.round(value * 100) / 100 : Math.round(value), period, evidence: { file, where: l.where, quote: l.label }, confidence: 0.8, method: 'rules' });
            continue;
          }
          const col = column(period);
          if (!col) { unmapped.add(period); continue; }
          const base = BS_KEYS.has(l.key) ? 'balanceSheet' : PL_KEYS.has(l.key) ? 'profitLoss' : null;
          if (!base) continue;
          const ctxOk = (base === 'balanceSheet' && (l.ctx === 'bs' || l.ctx === 'other')) || (base === 'profitLoss' && (l.ctx === 'pl' || l.ctx === 'other')) || l.where.includes('(form)');
          push({ path: `${base}.${col}.${l.key}`, value: Math.round(value), period, evidence: { file, where: l.where, quote: l.label }, confidence: ctxOk ? (l.section ? 0.75 : 0.9) : 0.6, method: 'rules' });
        }
      }
      for (const f of a.facts) {
        if (f.path.startsWith('_form.')) {
          // Dates and figures of a filed form belong to that form's year; only reuse them when it is the target year.
          const key = f.path.slice(6);
          const sameYear = a.form && fy && a.form.formFyTo === `31/03/${fyEnds(fy).current.slice(0, 4)}`;
          if (!sameYear) continue;
          const map = { FY_FROM: 'general.FY_FROM', FY_TO: 'general.FY_TO', BOARD_MEETING_DATE: 'general.BOARD_MEETING_DATE', BOARD_REPORT_DATE: 'general.BOARD_REPORT_DATE', AUDITOR_SIGN_DATE: 'general.AUDITOR_SIGN_DATE', AGM_DATE: 'general.AGM_DATE', AGM_DUE_DATE: 'general.AGM_DUE_DATE', NET_WORTH: 'financialParametersBS.NET_WORTH', CATEGORY_TURNOVER: 'principalProducts.CATEGORY_TURNOVER', HIGHEST_TURNOVER: 'principalProducts.HIGHEST_TURNOVER' };
          if (map[key]) push({ path: map[key], value: f.value, period: null, evidence: { file, where: f.where || 'form', quote: f.quote }, confidence: f.confidence, method: 'rules' });
          continue;
        }
        if (f.path === '_meta.fyEnd' || f.path === '_meta.udin') continue;
        // Signing dates found in statements belong to the statements' year.
        if (/general\.(AUDITOR_SIGN_DATE|BOARD_MEETING_DATE)/.test(f.path) && a.fyEnd && ends && dayDiff(a.fyEnd, ends.current) > 20) continue;
        push({ path: f.path, value: f.value, period: null, evidence: { file, where: f.where || '', quote: f.quote }, confidence: f.confidence, method: 'rules' });
      }
    }
    if (fy && (fyInferred || opts.proposeFy)) push({ path: 'meta.fy', value: fy, period: null, evidence: { file: analyses[0]?.doc.name || '', where: '', quote: 'statement date' }, confidence: fyInferred ? 0.8 : 0.9, method: 'rules' });
    // Signatories: those who signed the target year's statements. When no document of that year names
    // any, last year's signatories are offered as names only (no dates), to be confirmed.
    const signatoriesFS = [];
    const isThisYear = a => !a.fyEnd || !ends || dayDiff(a.fyEnd, ends.current) <= 20;
    for (const a of analyses) {
      if (!isThisYear(a)) continue;
      for (const s of a.signatories) if (!signatoriesFS.some(x => x.din === s.din)) signatoriesFS.push({ ...s, file: a.doc.name });
    }
    let signatoriesCarried = false;
    if (!signatoriesFS.length) {
      for (const a of analyses) for (const s of a.signatories) if (!signatoriesFS.some(x => x.din === s.din)) { signatoriesFS.push({ ...s, date: '', file: a.doc.name, carried: true }); signatoriesCarried = true; }
    }
    const checks = analyses.flatMap(a => a.lines.filter(l => l.check).map(l => ({ key: l.key, values: l.values, file: a.doc.name, where: l.where })));
    // Only year-end dates are worth reporting as "ignored": asset schedules and tax tables carry other dates.
    const unmappedPeriods = [...unmapped].filter(p => /-03-/.test(p)).sort();
    return { proposals: dedupeProposals(proposals), signatoriesFS, signatoriesCarried, fy, fyInferred, unmappedPeriods, checks };
  }

  function dedupeProposals(list) {
    const byPath = new Map();
    for (const p of list) {
      const prev = byPath.get(p.path);
      if (!prev) { byPath.set(p.path, p); continue; }
      if (sameValue(prev.value, p.value)) { prev.confidence = Math.min(0.98, Math.max(prev.confidence, p.confidence) + 0.05); prev.also = (prev.also || 0) + 1; continue; }
      const alternative = { value: p.value, evidence: p.evidence, method: p.method };
      if (p.confidence > prev.confidence) {
        const alternatives = [...(prev.alternatives || []), { value: prev.value, evidence: prev.evidence, method: prev.method }];
        p.alternatives = [...(p.alternatives || []), ...alternatives];
        p.conflict = alternatives[0];
        byPath.set(p.path, p);
      } else {
        prev.alternatives = [...(prev.alternatives || []), alternative];
        prev.conflict = prev.conflict || alternative;
      }
    }
    return [...byPath.values()];
  }
  function sameValue(a, b) {
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= Math.max(1, Math.abs(a) * 0.002);
    return normText(a).toLowerCase() === normText(b).toLowerCase();
  }

  /* ───────────── AI: request pieces and response normalisation (provider-neutral) ───────────── */
  /** JSON schema for structured extraction output (Anthropic output_config.format / OpenAI response_format). */
  function extractionSchema() {
    const str = { type: 'string' };
    const strOrNull = { anyOf: [{ type: 'string' }, { type: 'null' }] };
    const sig = { type: 'object', additionalProperties: false, required: ['din_or_pan', 'name', 'designation', 'date'], properties: { din_or_pan: str, name: str, designation: str, date: strOrNull } };
    return {
      type: 'object', additionalProperties: false, required: ['fields', 'signatoriesFS', 'signatoriesBR', 'notes'],
      properties: {
        fields: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['path', 'value', 'period_end', 'evidence', 'confidence'], properties: { path: str, value: str, period_end: strOrNull, evidence: str, confidence: { type: 'number' } } } },
        signatoriesFS: { type: 'array', items: sig },
        signatoriesBR: { type: 'array', items: sig },
        notes: { type: 'array', items: str }
      }
    };
  }

  function extractionSystemPrompt(fy) {
    return [
      'You are an Indian chartered accountant preparing Form AOC-4 (Companies Act, 2013) from a client\'s documents: audited financial statements (Schedule III), trial balances or workbooks, board\'s and auditor\'s reports, and sometimes the previous year\'s filed AOC-4.',
      `The form being prepared is for financial year ${fy || '(unknown — infer it from the latest balance sheet date)'}.`,
      'Return only the JSON object described by the schema. Rules:',
      '- value is always a string. Amounts: absolute rupees as plain digits (no commas, symbols or units). Apply any unit stated in the document ("in hundreds", "Rs. \'000", "in lakhs") before writing the number. Negative amounts start with "-". Dates: DD/MM/YYYY. Yes/No fields: exactly "Yes" or "No".',
      '- For balance-sheet and profit-and-loss paths use the period-neutral paths given in the catalogue (balanceSheet.KEY / profitLoss.KEY) and set period_end to the balance-sheet date (YYYY-MM-DD) that figure belongs to. Give every period the document shows (current and previous year) as separate entries. For other paths period_end is null.',
      '- A previous year\'s AOC-4 form is authoritative for company, auditor, server-address and industry details; its figures carry that form\'s own period_end.',
      '- evidence: the document name plus the page or sheet and a short quote of the label and number you read. confidence: 0 to 1.',
      '- Map Schedule III line items to the catalogue keys. Do not invent, estimate or net figures; omit anything the documents do not state. Sub-items that the form does not ask for are skipped, not summed.',
      '- signatoriesFS: directors (DIN) or officers (PAN) who signed the financial statements, with designation and signing date; signatoriesBR: those who signed the board\'s report (empty if not shown).'
    ].join('\n');
  }

  function extractionUserText(catalog, docsText, context) {
    const cat = catalog.map(c => `${c.path} — ${c.label} [${c.type}${c.options ? ': ' + c.options.join(' | ') : ''}]`).join('\n');
    return `Field catalogue (path — meaning [type]):\n${cat}\n\nForm context: ${JSON.stringify(context)}\n\nDocuments (text extracted by the app; PDFs may also be attached in full):\n${docsText}`;
  }

  /** Model output → proposals in the same shape as the rules produce. */
  function normalizeAiOutput(out, catalog, fy) {
    const byPath = new Map(catalog.map(c => [c.path, c]));
    const ends = fyEnds(fy);
    const proposals = [], unmapped = new Set();
    const toNum = v => parseAmount(v);
    for (const f of (out && out.fields) || []) {
      if (!f || typeof f.path !== 'string') continue;
      let path = f.path.trim();
      let period = f.period_end ? parsePeriod(f.period_end) : null;
      const neutral = /^(balanceSheet|profitLoss)\.([A-Z0-9_]+)$/.exec(path);
      if (neutral) {
        if (!period || !ends) { unmapped.add(period || '?'); continue; }
        const col = dayDiff(period, ends.current) <= 20 ? 'current' : dayDiff(period, ends.previous) <= 20 ? 'previous' : null;
        if (!col) { unmapped.add(period); continue; }
        path = `${neutral[1]}.${col}.${neutral[2]}`;
      }
      const c = byPath.get(path) || byPath.get(path.replace(/\.(current|previous)\./, '.'));
      if (!c) continue;
      let value;
      if (c.type === 'number') { value = toNum(f.value); if (value === null) continue; }
      else if (c.type === 'date') { const p = parsePeriod(f.value); if (!p) continue; value = dmyFromISO(p); }
      else { value = normText(f.value); if (!value) continue; if (c.options) { const hit = c.options.find(o => o.toLowerCase() === value.toLowerCase()); if (!hit) continue; value = hit; } }
      const confidence = Math.max(0, Math.min(1, Number(f.confidence) || 0.6));
      proposals.push({ path, value, period, evidence: { file: '', where: 'AI', quote: normText(f.evidence).slice(0, 160) }, confidence, method: 'ai' });
    }
    const sigs = list => (Array.isArray(list) ? list : []).map(s => ({ din: normText(s.din_or_pan || s.din || ''), name: normText(s.name || '').toUpperCase(), designation: DESIGNATIONS.find(d => d.toLowerCase() === normText(s.designation || '').toLowerCase()) || 'Director', date: s.date ? dmyFromISO(parsePeriod(s.date) || '') || normText(s.date) : '' })).filter(s => s.din && s.name);
    return { proposals: dedupeProposals(proposals), signatoriesFS: sigs(out?.signatoriesFS), signatoriesBR: sigs(out?.signatoriesBR), notes: Array.isArray(out?.notes) ? out.notes.map(normText) : [], unmappedPeriods: [...unmapped] };
  }

  /** Rules + AI → one list per path with agreement / conflict marks. */
  function mergeProposals(rules, ai) {
    const map = new Map();
    for (const p of rules) map.set(p.path, { ...p, sources: ['rules'] });
    for (const p of ai) {
      const prev = map.get(p.path);
      if (!prev) { map.set(p.path, { ...p, sources: ['ai'] }); continue; }
      if (sameValue(prev.value, p.value)) { prev.sources = ['rules', 'ai']; prev.confidence = Math.min(0.99, Math.max(prev.confidence, p.confidence) + 0.08); prev.aiEvidence = p.evidence; continue; }
      // Disagreement: keep the more confident one, show the other as an alternative.
      const [keep, other] = p.confidence > prev.confidence ? [{ ...p, sources: ['ai'] }, prev] : [prev, { ...p, sources: ['ai'] }];
      keep.conflict = { value: other.value, method: other.sources[0], evidence: other.evidence };
      keep.alternatives = [...(keep.alternatives || []), { value: other.value, evidence: other.evidence, method: other.sources[0] }];
      map.set(p.path, keep);
    }
    return [...map.values()];
  }

  return {
    parseAmount, parsePeriod, detectUnit, normLabel, linesFromItems, rowsFromSheet, scanGrid, extractFacts, extractFormText, isFormText,
    analyzeDocument, buildProposals, mergeProposals, extractionSchema, extractionSystemPrompt, extractionUserText, normalizeAiOutput,
    fyFromEnd, fyEnds, LINE_ITEMS, CHECK_ITEMS, DESIGNATIONS
  };
});
