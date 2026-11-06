/* AOC-4 unified issue management service (Phase: AI notes and issue management). Takes the separate
 * outputs the pipeline already produces — js/reconciliation.js's issues, the AI chunking diagnostics,
 * auditor candidates, normalizeAiOutput's unmappedFields, and which document types were uploaded —
 * and turns them into ONE deduplicated list in the ten categories the brief asks for, instead of each
 * stage appending its own ad-hoc note string (which is how the same warning ended up repeated once
 * per chunk).
 *
 * Issue shape: { id, category, severity, field, financialYear, title, detail, evidence,
 *                recommendedAction, reviewStatus, occurrences }
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AOC4IssueStore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CATEGORIES = ['PERIOD_MISMATCH', 'JSON_PARSE_ERROR', 'FIELD_MAPPING_MISSING', 'FINANCIAL_MISMATCH', 'AUDITOR_CONFLICT', 'SIGNATORY_MISSING', 'UNIT_CONFLICT', 'SOURCE_PLACEHOLDER', 'MISSING_DOCUMENT', 'EXTRACTION_FAILED'];

  let seq = 0;
  const makeId = (category, key) => `${category}:${key}:${seq++}`;

  /** js/reconciliation.js's six internal categories → the ten unified ones. */
  function mapReconciliationIssue(iss) {
    if (iss.category === 'fy') return 'PERIOD_MISMATCH';
    if (iss.code === 'UNIT_CONFLICT') return 'UNIT_CONFLICT';
    if (iss.category === 'missing') return 'FIELD_MAPPING_MISSING';
    return 'FINANCIAL_MISMATCH'; // critical, discrepancy, classification (non-unit), warning
  }
  const SEVERITY_BY_RECONCILE = { critical: 'error', discrepancy: 'warning', missing: 'warning', classification: 'warning', fy: 'warning', warning: 'info' };

  function fromReconciliation(reconciliation) {
    return (reconciliation && reconciliation.issues ? reconciliation.issues : []).map(iss => ({
      id: makeId(mapReconciliationIssue(iss), iss.code),
      category: mapReconciliationIssue(iss),
      severity: SEVERITY_BY_RECONCILE[iss.category] || 'warning',
      field: (iss.paths && iss.paths[0]) || null,
      financialYear: iss.financialYearColumn || null,
      title: iss.title,
      detail: iss.detail,
      evidence: { file: iss.file || null, where: null, quote: null },
      recommendedAction: recommendedActionFor(mapReconciliationIssue(iss), iss.code),
      reviewStatus: 'open',
      occurrences: 1
    }));
  }

  function recommendedActionFor(category, code) {
    const byCode = {
      BS_DOES_NOT_BALANCE: 'Re-check the balance sheet line items read from the source — one is very likely misread or misclassified.',
      BS_TOTALS_DISAGREE: "Open the source document and confirm which of the two printed totals is correct.",
      BS_ROUNDING_DIFFERENCE: 'Confirm with the client whether this is an accepted rounding difference before filing.',
      PBT_ARITHMETIC: 'Verify income and expense line items against the source P&L; one figure is likely wrong.',
      PAT_ARITHMETIC: 'Verify the tax figures and profit-before-tax against the source P&L.',
      CASH_FLOW_ARITHMETIC: "Re-check the cash flow statement's opening balance and the three activity totals.",
      CASH_FLOW_VS_BALANCE_SHEET: 'Confirm the cash flow statement and balance sheet are for the same reporting date.',
      BORROWINGS_BREAKUP_MISMATCH: 'Reconcile the borrowings note against the balance sheet figure before filing — do not file the balance sheet figure unreviewed.',
      CROSS_REFERENCE_MISMATCH: 'Open both source locations and confirm which figure is correct.',
      DOC_WRONG_YEAR: 'Confirm this document belongs to the filing year, or remove it from this extraction.',
      MULTIPLE_CANDIDATE_FY: 'Confirm which financial year is actually being filed before applying any figures.'
    };
    return byCode[code] || (category === 'UNIT_CONFLICT' ? 'Confirm which figure is in absolute rupees and which is still in the stated unit.' : 'Review the two figures against the source documents.');
  }

  function fromExtractionDiagnostics(diagnostics) {
    return (diagnostics || []).map(d => {
      const isParseError = d.truncated || /json|parse|array element|not valid/i.test(d.error || '');
      const fieldPaths = (d.items || []).map(i => i.path).filter(Boolean);
      return {
        id: makeId(isParseError ? 'JSON_PARSE_ERROR' : 'EXTRACTION_FAILED', fieldPaths.join(',') || 'chunk'),
        category: isParseError ? 'JSON_PARSE_ERROR' : 'EXTRACTION_FAILED',
        severity: 'warning',
        field: fieldPaths[0] || null,
        financialYear: null,
        title: isParseError ? "The AI model's response for these fields could not be parsed as JSON" : 'The AI model could not extract these fields',
        detail: `${fieldPaths.length ? fieldPaths.join(', ') : 'A batch of fields'}: ${d.error || 'no further detail'}.${d.truncated ? ' The response was cut off before it finished (token limit).' : ''} These fields were left for the document-rules pass / manual entry.`,
        evidence: { file: null, where: 'AI response', quote: (d.rawTextSnippet || '').slice(0, 200) || null },
        recommendedAction: 'Enter these fields manually, or re-run extraction (a retry often succeeds where a transient response failed).',
        reviewStatus: 'open',
        occurrences: 1
      };
    });
  }

  function fromUnmappedFields(unmappedFields) {
    return (unmappedFields || []).map(f => ({
      id: makeId('FIELD_MAPPING_MISSING', f.path || 'unknown'),
      category: 'FIELD_MAPPING_MISSING',
      severity: 'info',
      field: f.path || null,
      financialYear: null,
      title: f.path ? `"${f.path}" from the AI could not be mapped to a form field` : 'A field from the AI had no usable path',
      detail: `${f.reason}.${f.value !== undefined ? ` Value offered: ${JSON.stringify(f.value)}.` : ''}`,
      evidence: { file: null, where: 'AI response', quote: null },
      recommendedAction: f.reason && f.reason.includes('not in the field catalogue') ? 'If this is a real field the catalogue is missing, add it (see the field-catalogue report) rather than ignoring it.' : 'Check the source document and enter this value manually if correct.',
      reviewStatus: 'open',
      occurrences: 1
    }));
  }

  function fromAuditorCandidates(auditorCandidates) {
    if (!auditorCandidates || auditorCandidates.length < 2) return [];
    return [{
      id: makeId('AUDITOR_CONFLICT', 'auditor'),
      category: 'AUDITOR_CONFLICT',
      severity: 'error',
      field: 'auditor.AUDITOR_NAME',
      financialYear: null,
      title: `${auditorCandidates.length} different audit firms were found in the uploaded documents`,
      detail: auditorCandidates.map(c => `${c.name || '(name not read)'} — FRN ${c.frn || '(not read)'}${c.memberNumber ? `, membership no. ${c.memberNumber}` : ''} (${c.file || c.where || 'source not recorded'}${c.date ? `, signed ${c.date}` : ''})`).join(' · '),
      evidence: { file: auditorCandidates.map(c => c.file).filter(Boolean).join(', ') || null, where: auditorCandidates.map(c => c.where).filter(Boolean).join(', ') || null, quote: auditorCandidates.map(c => c.quote).filter(Boolean).join(' | ').slice(0, 300) || null },
      recommendedAction: 'Confirm which audit firm actually signed THIS year\'s financial statements before filing — do not let either one win automatically.',
      reviewStatus: 'open',
      occurrences: 1,
      candidates: auditorCandidates
    }];
  }

  function fromSignatories({ signatoriesFS, signatoriesBR, hasBoardReportDoc }) {
    const issues = [];
    if (!signatoriesFS || !signatoriesFS.length) {
      issues.push({ id: makeId('SIGNATORY_MISSING', 'FS'), category: 'SIGNATORY_MISSING', severity: 'warning', field: 'signatoriesFS', financialYear: null, title: 'No signatories found for the financial statements', detail: 'No DIN/designation/date block was read from any uploaded document for the financial-statement signatories.', evidence: { file: null, where: null, quote: null }, recommendedAction: 'Enter the signatories manually from the signed financial statements.', reviewStatus: 'open', occurrences: 1 });
    }
    if (hasBoardReportDoc === false && signatoriesBR && signatoriesBR.length) {
      // Signatories were offered for the Board's Report, but no document classified as a board report
      // was ever uploaded — the figures most likely leaked in from the financial statements or an
      // unrelated page, not a genuine Board's Report signature block.
      issues.push({ id: makeId('SOURCE_PLACEHOLDER', 'signatoriesBR'), category: 'SOURCE_PLACEHOLDER', severity: 'warning', field: 'signatoriesBR', financialYear: null, title: "Board's Report signatories were populated without a Board's Report ever being uploaded", detail: `${signatoriesBR.length} signatory candidate(s) were offered for the Board's Report, but no uploaded document was identified as a Board's Report.`, evidence: { file: null, where: null, quote: null }, recommendedAction: "Confirm these names actually come from the Board's Report, or clear them and enter the Board's Report signatories manually once that document is available.", reviewStatus: 'open', occurrences: 1 });
    } else if (hasBoardReportDoc && (!signatoriesBR || !signatoriesBR.length)) {
      issues.push({ id: makeId('SIGNATORY_MISSING', 'BR'), category: 'SIGNATORY_MISSING', severity: 'info', field: 'signatoriesBR', financialYear: null, title: "No signatories found for the Board's Report", detail: "A Board's Report was uploaded, but no DIN/designation/date block was read from it.", evidence: { file: null, where: null, quote: null }, recommendedAction: "Enter the Board's Report signatories manually.", reviewStatus: 'open', occurrences: 1 });
    }
    return issues;
  }

  function fromMissingDocuments(docTypesPresent) {
    const present = new Set(docTypesPresent || []);
    const expected = [
      { types: ['financials', 'balance-sheet'], label: 'Balance sheet' },
      { types: ['financials', 'profit-loss'], label: 'Profit and loss statement' },
      { types: ['auditor-report'], label: "Auditor's report" }
    ];
    return expected.filter(e => !e.types.some(t => present.has(t))).map(e => ({
      id: makeId('MISSING_DOCUMENT', e.label),
      category: 'MISSING_DOCUMENT',
      severity: 'info',
      field: null,
      financialYear: null,
      title: `${e.label} not identified among the uploaded documents`,
      detail: `No uploaded file was classified as containing the ${e.label.toLowerCase()}. Figures that depend on it may be incomplete.`,
      evidence: { file: null, where: null, quote: null },
      recommendedAction: `Upload the ${e.label.toLowerCase()} if it exists, or confirm it is genuinely not applicable.`,
      reviewStatus: 'open',
      occurrences: 1
    }));
  }

  /** Groups issues whose category + field + near-identical title are the same into one, with an
   * `occurrences` count and the union of files/quotes in `detail` — this is what keeps a 19-chunk
   * extraction from showing the same finding 19 times. */
  function dedupe(issues) {
    const byKey = new Map();
    for (const iss of issues) {
      const key = `${iss.category}|${iss.field || ''}|${String(iss.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60)}`;
      const prev = byKey.get(key);
      if (!prev) { byKey.set(key, { ...iss }); continue; }
      prev.occurrences += 1;
      if (iss.evidence && iss.evidence.file && prev.evidence && !String(prev.evidence.file || '').includes(iss.evidence.file)) {
        prev.evidence = { ...prev.evidence, file: [prev.evidence.file, iss.evidence.file].filter(Boolean).join(', ') };
      }
    }
    return [...byKey.values()];
  }

  /**
   * opts: { reconciliation, extractionDiagnostics, unmappedFields, auditorCandidates,
   *         signatoriesFS, signatoriesBR, hasBoardReportDoc, docTypesPresent }
   * Returns { issues, summary: { <category>: count, total } }.
   */
  function collectIssues(opts = {}) {
    const all = [
      ...fromReconciliation(opts.reconciliation),
      ...fromExtractionDiagnostics(opts.extractionDiagnostics),
      ...fromUnmappedFields(opts.unmappedFields),
      ...fromAuditorCandidates(opts.auditorCandidates),
      ...fromSignatories(opts),
      ...fromMissingDocuments(opts.docTypesPresent)
    ];
    const issues = dedupe(all);
    const summary = { total: issues.length };
    for (const c of CATEGORIES) summary[c] = 0;
    for (const i of issues) summary[i.category] = (summary[i.category] || 0) + 1;
    return { issues, summary };
  }

  return { collectIssues, CATEGORIES, dedupe };
});
