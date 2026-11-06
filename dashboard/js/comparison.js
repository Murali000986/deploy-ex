/* AOC-4 Data Comparison engine (Phase 7) — compares the dashboard's current form values against the
 * values js/extractor.js proposed from the uploaded documents, field by field, and assigns each row
 * one of the statuses the spec requires. Pure and dependency-injected (no DOM, no `state` global) so
 * it runs the same way in the dashboard and under plain Node tests.
 *
 * Statuses: MATCHED, MATCHED_AFTER_ROUNDING, MISMATCH, MISSING_IN_DOCUMENT, MISSING_IN_DASHBOARD,
 * NOT_COMPARABLE, NEEDS_REVIEW, NOT_VERIFIABLE.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AOC4Compare = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const isEmptyNumber = v => v === undefined || v === null || v === '' || (typeof v === 'number' && v === 0) || (typeof v === 'string' && Number(v) === 0 && v.trim() !== '' && !isNaN(Number(v)));
  const isEmptyText = v => v === undefined || v === null || String(v).trim() === '';
  const toNum = v => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : null; };
  function tol(...vals) { const m = Math.max(0, ...vals.map(v => Math.abs(Number(v) || 0))); return Math.max(1, Math.round(m * 0.005 * 100) / 100); }

  /**
   * field: { path, label, type: 'number'|'text'|'date'|'select', comparable?: boolean, forceStatus? }
   * proposalByPath: Map<path, mergedProposal> (from AOC4Extract.mergeProposals output, keyed by path)
   * getDashboardValue: path => current value in the dashboard's form state
   * notComparablePaths: Set<path> of fields whose financial-year column wasn't present in ANY
   *   uploaded document (so a document figure genuinely could not be compared, not merely absent).
   */
  function buildComparisonRows(fields, proposalByPath, getDashboardValue, notComparablePaths = new Set()) {
    const rows = [];
    for (const field of fields) {
      const path = field.path;
      const dv = getDashboardValue(path);
      const p = proposalByPath.get(path);
      const isNumeric = field.type === 'number';
      const dashboardEmpty = isNumeric ? isEmptyNumber(dv) : isEmptyText(dv);
      const docEmpty = !p || p.value === undefined || p.value === null || (isNumeric ? isEmptyNumber(p.value) : isEmptyText(p.value));

      let status, detail = '';
      if (field.forceStatus) {
        status = field.forceStatus;
      } else if (field.comparable === false) {
        status = 'NOT_VERIFIABLE';
        detail = 'This field cannot be deterministically verified from the extracted figures.';
      } else if (dashboardEmpty && docEmpty) {
        continue; // nothing on either side worth a row, even if the FY column was also unavailable
      } else if (notComparablePaths.has(path) && docEmpty) {
        status = 'NOT_COMPARABLE';
        detail = "The right financial-year column for this field wasn't present in any uploaded document.";
      } else if (docEmpty) {
        status = 'MISSING_IN_DOCUMENT';
        detail = 'The dashboard has a value here but no uploaded document confirmed it.';
      } else if (dashboardEmpty) {
        status = 'MISSING_IN_DASHBOARD';
        detail = 'The documents give a value for this field that has not been entered in the dashboard yet.';
      } else if (p.conflict) {
        status = 'NEEDS_REVIEW';
        detail = `The document rules and the AI model disagree (${JSON.stringify(p.conflict.value)} vs ${JSON.stringify(p.value)}) — resolve before comparing.`;
      } else if (isNumeric) {
        const a = toNum(dv), b = toNum(p.value);
        if (a === null || b === null) { status = 'NEEDS_REVIEW'; detail = 'One of the two values is not a usable number.'; }
        else if (a === b) status = 'MATCHED';
        else if (Math.abs(a - b) <= tol(a, b)) status = 'MATCHED_AFTER_ROUNDING';
        else { status = 'MISMATCH'; detail = `Dashboard: ${a.toLocaleString('en-IN')} · Document: ${b.toLocaleString('en-IN')} · difference ${(a - b).toLocaleString('en-IN')}.`; }
      } else {
        const a = String(dv ?? '').trim().toLowerCase(), b = String(p.value ?? '').trim().toLowerCase();
        status = a === b ? 'MATCHED' : 'MISMATCH';
        if (status === 'MISMATCH') detail = `Dashboard: "${dv}" · Document: "${p.value}".`;
      }

      rows.push({
        path, label: field.label || path, type: field.type || 'text',
        dashboardValue: dv, extractedValue: p ? p.value : undefined,
        status, detail,
        confidenceScore: p ? p.confidence : null,
        evidence: p ? p.evidence : null,
        sources: p ? p.sources : null
      });
    }
    return rows;
  }

  function summarize(rows) {
    const s = { total: rows.length };
    for (const r of rows) s[r.status] = (s[r.status] || 0) + 1;
    return s;
  }

  return { buildComparisonRows, summarize };
});
