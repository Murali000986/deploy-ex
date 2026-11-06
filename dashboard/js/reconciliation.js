/* AOC-4 reconciliation engine — deterministic arithmetic and consistency checks over the figures
 * js/extractor.js already pulled out of uploaded documents (js/extractor.js's analyzeDocument()
 * output). Nothing here calls an AI model and nothing here invents or corrects a value: every issue
 * either quotes two numbers the documents themselves state, or quotes one number and an arithmetic
 * relationship it fails (A + B should equal C). Shared by the dashboard (js/dashboard.js, the
 * Validation Centre) and the Node tests (test/*.test.js).
 *
 * Categories (Phase 7's Validation Centre groups issues by these):
 *   'critical'       — an accounting identity the source document itself fails (BS does not balance,
 *                       PBT/PAT arithmetic wrong) — almost certainly a misread or a real error upstream.
 *   'discrepancy'     — two figures that should agree don't, outside rounding tolerance.
 *   'missing'         — a figure needed for a check could not be found in any uploaded document.
 *   'classification'  — the same line item recurs at two different places with two different values
 *                       (e.g. a note vs the face of the balance sheet) — likely a mapping ambiguity.
 *   'fy'              — the figure's financial year does not match the filing's current/previous
 *                       columns and so was excluded from comparison ("Not available for comparison").
 *   'warning'         — informational: approximate checks (EPS uses period-end shares, not the
 *                       weighted average) or anything else worth a second look but not wrong.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AOC4Reconcile = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const Extract = (typeof module !== 'undefined' && module.exports) ? require('./extractor.js') : (typeof self !== 'undefined' ? self.AOC4Extract : this.AOC4Extract);

  // Mirrors js/dashboard.js's BS_LIAB / BS_ASSET / PL_IN key lists (the Schedule III line items the
  // dashboard's own data-entry form holds). Kept here as a second, independent copy rather than a
  // shared import so a change to the dashboard's own field list can never silently change which keys
  // this engine treats as "the equity & liabilities side" vs "the assets side" without being noticed —
  // the Phase 9 tests pin these lists.
  const BS_LIAB_KEYS = ['SHARE_CAPITAL', 'RESERVES_SURPLUS', 'MONEY_AGAINST_WARRANTS', 'SHARE_APP_PENDING', 'LONG_TERM_BORROWINGS', 'DEFERRED_TAX_LIAB', 'OTHER_LONG_TERM_LIAB', 'LONG_TERM_PROVISIONS', 'SHORT_TERM_BORROWINGS', 'TRADE_PAYABLES_MSME', 'TRADE_PAYABLES_OTHER', 'OTHER_CURRENT_LIAB', 'SHORT_TERM_PROVISIONS'];
  const BS_ASSET_KEYS = ['PPE', 'INTANGIBLE_ASSETS', 'CWIP', 'INTANGIBLE_UNDER_DEV', 'NON_CURRENT_INVESTMENTS', 'DEFERRED_TAX_ASSETS', 'LONG_TERM_LOANS_ADVANCES', 'OTHER_NON_CURRENT_ASSETS', 'CURRENT_INVESTMENTS', 'INVENTORIES', 'TRADE_RECEIVABLES', 'CASH_EQUIVALENTS', 'SHORT_TERM_LOANS_ADVANCES', 'OTHER_CURRENT_ASSETS'];
  const PL_INCOME_KEYS = ['REVENUE_OPERATIONS', 'OTHER_INCOME'];
  const PL_EXPENSE_KEYS = ['EMPLOYEE_EXPENSES', 'MANAGERIAL_REMUNERATION', 'FINANCE_COSTS', 'DEPRECIATION', 'OTHER_EXPENSES'];
  const PL_TAX_KEYS = ['CURRENT_TAX', 'DEFERRED_TAX'];
  const BORROWINGS_LT_KEYS = (Extract.BORROWINGS_BREAKUP_ITEMS ? Extract.BORROWINGS_BREAKUP_ITEMS.lt : []).map(i => i.key);
  const BORROWINGS_ST_KEYS = (Extract.BORROWINGS_BREAKUP_ITEMS ? Extract.BORROWINGS_BREAKUP_ITEMS.st : []).map(i => i.key);
  const UNIT_SCALES = [100, 1000, 100000, 10000000]; // hundreds, thousands, lakhs, crores

  const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  /** Rupee-rounding tolerance for figures built from MANY line items: the larger of ₹1 or 0.5% of the
   * bigger figure (accumulated rounding across dozens of lines from different sources). */
  function tolerance(...vals) {
    const m = Math.max(0, ...vals.map(v => Math.abs(Number(v) || 0)));
    return Math.max(1, round2(m * 0.005));
  }
  /** Tight tolerance for a SINGLE fact restated in two places (e.g. profit for the year repeated in a
   * note) — these should match exactly, so this is a flat ₹1 (float/formula noise only), never a
   * percentage of the value: ₹79,035 vs ₹79,037 is not "0.003% rounding", it's two different numbers. */
  const RESTATEMENT_TOLERANCE = 1;
  const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
  const fmt = n => (n == null ? '—' : Number(n).toLocaleString('en-IN'));
  /** Two figures that disagree by close to a round unit-scale ratio (100/1,000/1,00,000/1,00,00,000)
   * are very likely the same fact read under two different stated units, not a real discrepancy. */
  function unitRatio(a, b) {
    if (!a || !b) return null;
    const hi = Math.max(Math.abs(a), Math.abs(b)), lo = Math.min(Math.abs(a), Math.abs(b));
    if (lo === 0) return null;
    const ratio = hi / lo;
    const scale = UNIT_SCALES.find(s => Math.abs(ratio - s) / s < 0.03);
    return scale || null;
  }

  function sumByPeriod(lines, keys, period, ctxFilter) {
    let sum = 0, found = [];
    for (const l of lines) {
      if (!keys.includes(l.key)) continue;
      if (ctxFilter && l.ctx !== ctxFilter) continue;
      const v = l.values[period];
      if (v === undefined || v === null) continue;
      sum += v; found.push(l);
    }
    return { sum: round2(sum), found };
  }
  function valuesFor(lines, key, period) {
    return lines.filter(l => l.key === key && l.values[period] !== undefined && l.values[period] !== null);
  }

  /** One document's own internal consistency, independent of which financial year it belongs to. */
  function reconcileDocumentPeriod(lines, period, file) {
    const issues = [];
    const push = (category, severity, code, title, detail, extra = {}) => issues.push({ category, severity, code, title, detail, file, period, paths: [], ...extra });

    // ── Balance sheet: Assets = Equity + Liabilities ──
    const bsLines = lines.filter(l => l.ctx === 'bs' || l.ctx === 'other');
    const liab = sumByPeriod(bsLines, BS_LIAB_KEYS, period);
    const asset = sumByPeriod(bsLines, BS_ASSET_KEYS, period);
    const totalRows = valuesFor(lines, 'TOTAL_BS', period);
    if (liab.found.length && asset.found.length) {
      const diff = round2(liab.sum - asset.sum);
      const tol = tolerance(liab.sum, asset.sum);
      if (diff !== 0 && !near(liab.sum, asset.sum, tol)) {
        push('critical', 'error', 'BS_DOES_NOT_BALANCE', 'Balance sheet does not balance', `Sum of equity & liabilities line items (₹${fmt(liab.sum)}) does not equal sum of asset line items (₹${fmt(asset.sum)}) — difference ₹${fmt(diff)}.`, { amounts: { liabilitiesAndEquity: liab.sum, assets: asset.sum, difference: diff } });
      } else if (diff !== 0) {
        // Within tolerance, but NOT zero — a filed balance sheet should tie exactly; a ₹1-2 gap is
        // usually an Excel rounding artefact, but it is shown, never silently absorbed.
        push('discrepancy', 'warning', 'BS_ROUNDING_DIFFERENCE', 'Balance sheet is off by a small rounding difference', `Sum of equity & liabilities line items (₹${fmt(liab.sum)}) differs from the sum of asset line items (₹${fmt(asset.sum)}) by ₹${fmt(Math.abs(diff))} — likely a rounding artefact, but a filed balance sheet should tie exactly.`, { amounts: { liabilitiesAndEquity: liab.sum, assets: asset.sum, difference: diff } });
      }
    } else if (bsLines.length) {
      push('missing', 'warning', 'BS_INCOMPLETE', 'Balance sheet could not be fully read', `Found ${liab.found.length} equity/liability line item(s) and ${asset.found.length} asset line item(s) for this period — too few to check that the balance sheet balances.`, {});
    }
    if (totalRows.length >= 2) {
      // Schedule III prints two "Total" rows (equity & liabilities, and assets) that must agree with
      // each other regardless of how we classified individual line items.
      const vals = totalRows.map(r => r.values[period]);
      const tol = tolerance(...vals);
      for (let i = 1; i < vals.length; i++) {
        if (!near(vals[0], vals[i], tol)) { push('critical', 'error', 'BS_TOTALS_DISAGREE', "The document's own balance-sheet totals disagree", `"${totalRows[0].label}" (₹${fmt(vals[0])}) at ${totalRows[0].where} does not equal "${totalRows[i].label}" (₹${fmt(vals[i])}) at ${totalRows[i].where}.`, {}); break; }
      }
    } else if (totalRows.length === 1 && (liab.found.length || asset.found.length)) {
      const docTotal = totalRows[0].values[period];
      const tol = tolerance(docTotal, liab.sum, asset.sum);
      if (!near(docTotal, liab.sum, tol) && !near(docTotal, asset.sum, tol)) {
        push('discrepancy', 'warning', 'BS_TOTAL_UNRECONCILED', "Balance-sheet total doesn't match the figures we could read", `"${totalRows[0].label}" states ₹${fmt(docTotal)} at ${totalRows[0].where}, but neither our equity & liabilities sum (₹${fmt(liab.sum)}) nor our assets sum (₹${fmt(asset.sum)}) matches it — some line item may be missing or misclassified.`, {});
      }
    }

    // ── Profit and loss arithmetic ──
    const plLines = lines.filter(l => l.ctx === 'pl' || l.ctx === 'other' || l.ctx === 'notes');
    const income = sumByPeriod(plLines, PL_INCOME_KEYS, period);
    const expense = sumByPeriod(plLines, PL_EXPENSE_KEYS, period);
    const tax = sumByPeriod(plLines, PL_TAX_KEYS, period);
    const totalIncomeDoc = valuesFor(lines, 'TOTAL_INCOME', period)[0];
    const totalExpenseDoc = valuesFor(lines, 'TOTAL_EXPENSES', period)[0];
    const pbtDoc = valuesFor(lines, 'PBT', period)[0];
    const patDoc = valuesFor(lines, 'PAT', period)[0];
    if (totalIncomeDoc && income.found.length) {
      const tol = tolerance(income.sum, totalIncomeDoc.values[period]);
      if (!near(income.sum, totalIncomeDoc.values[period], tol)) push('discrepancy', 'warning', 'PL_TOTAL_INCOME_MISMATCH', 'Total income does not match its components', `Revenue from operations + other income (₹${fmt(income.sum)}) does not equal the document's stated total income (₹${fmt(totalIncomeDoc.values[period])}) at ${totalIncomeDoc.where}.`, {});
    }
    if (totalExpenseDoc && expense.found.length) {
      const tol = tolerance(expense.sum, totalExpenseDoc.values[period]);
      if (!near(expense.sum, totalExpenseDoc.values[period], tol)) push('discrepancy', 'warning', 'PL_TOTAL_EXPENSE_MISMATCH', 'Total expenses do not match their components', `Sum of expense line items (₹${fmt(expense.sum)}) does not equal the document's stated total expenses (₹${fmt(totalExpenseDoc.values[period])}) at ${totalExpenseDoc.where}.`, {});
    }
    let pbtComputed = null;
    if (income.found.length && expense.found.length) {
      pbtComputed = round2(income.sum - expense.sum);
      if (pbtDoc) {
        const tol = tolerance(pbtComputed, pbtDoc.values[period]);
        if (!near(pbtComputed, pbtDoc.values[period], tol)) push('critical', 'error', 'PBT_ARITHMETIC', 'Profit before tax does not add up', `Income (₹${fmt(income.sum)}) − expenses (₹${fmt(expense.sum)}) = ₹${fmt(pbtComputed)}, but the document states profit before tax as ₹${fmt(pbtDoc.values[period])} at ${pbtDoc.where}.`, {});
      }
    }
    const pbtForPat = pbtDoc ? pbtDoc.values[period] : pbtComputed;
    if (pbtForPat != null && tax.found.length && patDoc) {
      const patComputed = round2(pbtForPat - tax.sum);
      const tol = tolerance(patComputed, patDoc.values[period]);
      if (!near(patComputed, patDoc.values[period], tol)) push('critical', 'error', 'PAT_ARITHMETIC', 'Profit after tax does not add up', `Profit before tax (₹${fmt(pbtForPat)}) − current tax + deferred tax (₹${fmt(tax.sum)}) = ₹${fmt(patComputed)}, but the document states profit after tax as ₹${fmt(patDoc.values[period])} at ${patDoc.where}.`, {});
    }
    // EPS: a best-effort check only — EPS legally uses the weighted-average share count for the year,
    // which this engine cannot derive from a single period-end share count, so this is flagged as a
    // 'warning', never 'critical', and uses a wide tolerance.
    const epsBasicDoc = valuesFor(lines, 'EPS_BASIC', period)[0];
    const paidShares = valuesFor(lines, 'PAID_UP_SHARES', period)[0];
    const patForEps = patDoc ? patDoc.values[period] : (pbtForPat != null && tax.found.length ? round2(pbtForPat - tax.sum) : null);
    if (epsBasicDoc && paidShares && paidShares.values[period] > 0 && patForEps != null) {
      const epsComputed = round2(patForEps / paidShares.values[period]);
      const tol = Math.max(0.5, Math.abs(epsComputed) * 0.1); // wide: period-end shares ≠ weighted average
      if (!near(epsComputed, epsBasicDoc.values[period], tol)) push('warning', 'info', 'EPS_APPROXIMATE_MISMATCH', 'Basic EPS looks inconsistent with profit and share count (approximate check)', `Profit after tax (₹${fmt(patForEps)}) ÷ period-end paid-up shares (${fmt(paidShares.values[period])}) ≈ ₹${epsComputed}, vs the document's stated basic EPS of ₹${fmt(epsBasicDoc.values[period])} at ${epsBasicDoc.where}. This check uses the period-end share count, not the legally-required weighted average, so a mismatch alone is not conclusive — confirm manually if shares were issued or bought back during the year.`, {});
    }

    // ── Share capital note ──
    const authShares = valuesFor(lines, 'AUTH_SHARES', period)[0], authNominal = valuesFor(lines, 'AUTH_NOMINAL', period)[0];
    const faceValue = valuesFor(lines, 'FACE_VALUE', period)[0];
    if (authShares && faceValue && authNominal) {
      const computed = round2(authShares.values[period] * faceValue.values[period]);
      const tol = tolerance(computed, authNominal.values[period]);
      if (!near(computed, authNominal.values[period], tol)) push('discrepancy', 'warning', 'AUTH_CAPITAL_ARITHMETIC', 'Authorised share capital does not match shares × face value', `${fmt(authShares.values[period])} shares × ₹${faceValue.values[period]} face value = ₹${fmt(computed)}, but authorised capital is stated as ₹${fmt(authNominal.values[period])}.`, {});
    }
    if (paidShares && faceValue) {
      const paidNominal = valuesFor(lines, 'PAID_UP_NOMINAL', period)[0];
      if (paidNominal) {
        const computed = round2(paidShares.values[period] * faceValue.values[period]);
        const tol = tolerance(computed, paidNominal.values[period]);
        if (!near(computed, paidNominal.values[period], tol)) push('discrepancy', 'warning', 'PAID_UP_CAPITAL_ARITHMETIC', 'Paid-up share capital does not match shares × face value', `${fmt(paidShares.values[period])} shares × ₹${faceValue.values[period]} face value = ₹${fmt(computed)}, but paid-up capital is stated as ₹${fmt(paidNominal.values[period])}.`, {});
      }
    }
    if (authShares && paidShares && authShares.values[period] < paidShares.values[period]) {
      push('critical', 'error', 'PAID_UP_EXCEEDS_AUTHORISED', 'Paid-up shares exceed authorised shares', `Paid-up shares (${fmt(paidShares.values[period])}) exceed authorised shares (${fmt(authShares.values[period])}) — one of the two is very likely misread.`, {});
    }

    // ── Cash flow statement ──
    const opening = valuesFor(lines, 'CF_OPENING_CASH', period)[0], closing = valuesFor(lines, 'CF_CLOSING_CASH', period)[0];
    const opn = valuesFor(lines, 'CF_NET_OPERATING', period)[0], inv = valuesFor(lines, 'CF_NET_INVESTING', period)[0], fin = valuesFor(lines, 'CF_NET_FINANCING', period)[0];
    if (opening && closing && opn && inv && fin) {
      const computed = round2(opening.values[period] + opn.values[period] + inv.values[period] + fin.values[period]);
      const tol = tolerance(computed, closing.values[period]);
      if (!near(computed, closing.values[period], tol)) push('critical', 'error', 'CASH_FLOW_ARITHMETIC', "Cash flow statement doesn't reconcile", `Opening cash (₹${fmt(opening.values[period])}) + net operating (₹${fmt(opn.values[period])}) + net investing (₹${fmt(inv.values[period])}) + net financing (₹${fmt(fin.values[period])}) = ₹${fmt(computed)}, but closing cash is stated as ₹${fmt(closing.values[period])}.`, {});
    } else if ((opening || closing) && !(opn && inv && fin)) {
      push('missing', 'info', 'CASH_FLOW_INCOMPLETE', 'Cash flow statement only partly read', 'Opening/closing cash was found but not all three activity totals (operating, investing, financing), so the opening-to-closing arithmetic could not be checked.', {});
    }
    const cashOnBs = valuesFor(lines, 'CASH_EQUIVALENTS', period)[0];
    if (closing && cashOnBs) {
      const tol = tolerance(closing.values[period], cashOnBs.values[period]);
      if (!near(closing.values[period], cashOnBs.values[period], tol)) push('discrepancy', 'warning', 'CASH_FLOW_VS_BALANCE_SHEET', 'Cash flow closing balance does not match the balance sheet', `The cash flow statement's closing cash (₹${fmt(closing.values[period])}) does not match cash and cash equivalents on the balance sheet (₹${fmt(cashOnBs.values[period])}) for the same date.`, {});
    }

    // ── Notes vs face of the statement: same key, two different contexts, two different values ──
    const byKeyCtx = new Map();
    for (const l of lines) {
      if (l.values[period] === undefined || l.values[period] === null) continue;
      const k = l.key; if (!byKeyCtx.has(k)) byKeyCtx.set(k, []);
      byKeyCtx.get(k).push(l);
    }
    for (const [key, entries] of byKeyCtx) {
      const distinctCtx = new Map();
      for (const e of entries) if (!distinctCtx.has(e.ctx)) distinctCtx.set(e.ctx, e);
      if (distinctCtx.size < 2) continue;
      const vals = [...distinctCtx.values()];
      // A figure restated in two places should match almost exactly — it's the same fact, not a sum
      // of many lines — so this uses a tight tolerance, not the generic 0.5%-of-value one.
      const tol = RESTATEMENT_TOLERANCE;
      for (let i = 1; i < vals.length; i++) {
        const a = vals[0].values[period], b = vals[i].values[period];
        if (near(a, b, tol)) continue;
        const scale = unitRatio(a, b);
        if (scale) {
          push('classification', 'warning', 'UNIT_CONFLICT', `${key.replace(/_/g, ' ')} looks like it is stated in two different units`, `"${vals[0].label}" (${vals[0].ctx}, ${vals[0].where}) reads ₹${fmt(a)}, "${vals[i].label}" (${vals[i].ctx}, ${vals[i].where}) reads ₹${fmt(b)} — a ratio of about ${scale.toLocaleString('en-IN')}×, close to a standard unit scale (hundreds/thousands/lakhs/crores). One of these two is very likely still in the document's stated unit while the other has already been converted to absolute rupees.`, {});
        } else {
          push('classification', 'warning', 'CROSS_REFERENCE_MISMATCH', `${key.replace(/_/g, ' ')} differs between two places in the document`, `"${vals[0].label}" (${vals[0].ctx}, ${vals[0].where}) reads ₹${fmt(a)}, but "${vals[i].label}" (${vals[i].ctx}, ${vals[i].where}) reads ₹${fmt(b)} for the same period.`, {});
        }
        break;
      }
    }

    // ── Borrowings breakup note vs the balance sheet's own borrowings line ──
    for (const [bsKey, breakupKeys, label] of [['LONG_TERM_BORROWINGS', BORROWINGS_LT_KEYS, 'Long-term borrowings'], ['SHORT_TERM_BORROWINGS', BORROWINGS_ST_KEYS, 'Short-term borrowings']]) {
      const bsLine = valuesFor(lines, bsKey, period)[0];
      const breakup = sumByPeriod(lines, breakupKeys, period, 'notes');
      if (!breakup.found.length) continue;
      if (!bsLine) { push('missing', 'warning', 'BORROWINGS_BS_FIGURE_MISSING', `${label} note found but no balance-sheet figure to check it against`, `The borrowings breakup note gives a total of ₹${fmt(breakup.sum)}, but no "${label}" figure was read from the face of the balance sheet for this period.`, {}); continue; }
      const tol = tolerance(bsLine.values[period], breakup.sum);
      if (!near(bsLine.values[period], breakup.sum, tol)) {
        push('discrepancy', 'error', 'BORROWINGS_BREAKUP_MISMATCH', `${label} on the balance sheet does not match its own note`, `The balance sheet states ${label.toLowerCase()} of ₹${fmt(bsLine.values[period])} at ${bsLine.where}, but the breakup note's components add up to ₹${fmt(breakup.sum)} at ${breakup.found[0].where} — difference ₹${fmt(round2(bsLine.values[period] - breakup.sum))}.`, {});
      }
    }
    return issues;
  }

  /**
   * analyses: AOC4Extract.analyzeDocument() results. fy: target financial year ("2025-26") or null.
   * Returns { issues, summary: { critical, discrepancy, missing, classification, fy, warning, total } }.
   */
  function reconcile(analyses, fy) {
    const issues = [];
    const offYearFiles = new Map(); // fyEnd -> [file, ...], consolidated into one issue per distinct year
    for (const a of analyses || []) {
      const lines = a.lines || [];
      const periods = new Set();
      for (const l of lines) for (const p of Object.keys(l.values)) periods.add(p);
      for (const period of periods) issues.push(...reconcileDocumentPeriod(lines, period, a.doc.name).map(iss => ({ ...iss, financialYearColumn: fy ? Extract.columnForPeriod(period, fy) : null })));
      if (fy && a.fyEnd && !Extract.columnForPeriod(a.fyEnd, fy)) {
        if (!offYearFiles.has(a.fyEnd)) offYearFiles.set(a.fyEnd, []);
        offYearFiles.get(a.fyEnd).push(a.doc.name);
      }
    }
    // One issue per distinct off-year, naming every affected file, instead of repeating the same
    // warning once per document (a client who uploads a 3-sheet workbook from the wrong year would
    // otherwise see the same message 3 times).
    for (const [fyEnd, files] of offYearFiles) {
      issues.push({ category: 'fy', severity: 'warning', code: 'DOC_WRONG_YEAR', title: 'Document(s) for a different financial year', detail: `${files.join(', ')} appear${files.length === 1 ? 's' : ''} to be for the year ended ${fyEnd}, which is neither the current nor the previous year of the filing year FY ${fy}. ${files.length === 1 ? 'Its' : 'Their'} figures were not used for comparison.`, file: files.join(', '), period: fyEnd, paths: [], financialYearColumn: null });
    }
    // Multiple documents declaring genuinely different candidate filing years (e.g. a previous year's
    // filed AOC-4 form says FY 2024-25, this year's workbook says FY 2025-26) is worth calling out
    // explicitly, once, rather than letting the "last one wins" FY inference pass silently.
    const candidateYears = new Map(); // FY label -> [file, ...]
    for (const a of analyses || []) {
      if (!a.fyEnd) continue;
      const label = Extract.fyFromEnd(a.fyEnd);
      if (!candidateYears.has(label)) candidateYears.set(label, []);
      candidateYears.get(label).push(a.doc.name);
    }
    if (candidateYears.size > 1) {
      const parts = [...candidateYears.entries()].map(([y, files]) => `${files.join(', ')} → FY ${y}`);
      issues.push({ category: 'fy', severity: 'warning', code: 'MULTIPLE_CANDIDATE_FY', title: 'Uploaded documents disagree on the financial year', detail: `${parts.join('; ')}.${fy ? ` Using FY ${fy} as the filing year — confirm this is correct before relying on the comparative figures.` : ''}`, file: [...candidateYears.values()].flat().join(', '), period: null, paths: [], financialYearColumn: null });
    }
    const summary = { critical: 0, discrepancy: 0, missing: 0, classification: 0, fy: 0, warning: 0, total: issues.length };
    for (const i of issues) summary[i.category] = (summary[i.category] || 0) + 1;
    return { issues, summary };
  }

  return { reconcile, reconcileDocumentPeriod, tolerance, BS_LIAB_KEYS, BS_ASSET_KEYS, PL_INCOME_KEYS, PL_EXPENSE_KEYS, PL_TAX_KEYS, BORROWINGS_LT_KEYS, BORROWINGS_ST_KEYS, unitRatio };
});
