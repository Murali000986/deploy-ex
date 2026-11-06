/* AOC-4 field-record builder (Phase 6) — turns one merged proposal from js/extractor.js
 * (buildProposals()/mergeProposals() output: { path, value, period, evidence, confidence, method,
 * sources, conflict, edited, ... }) into the fuller, review-oriented record the dashboard's Source
 * Evidence and Review & Approval panels show. This is a presentation/analysis layer on TOP of the
 * extractor's existing proposal shape — it does not replace or change that shape, so nothing that
 * already reads a proposal object breaks.
 *
 * Record shape:
 *   { path, value, originalValue, normalizedValue, sourceFile, sourceSheetOrPage,
 *     sourceCellOrLocation, financialYear, confidenceScore, extractionMethod, mappingExplanation,
 *     validationStatus, reviewRequired }
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AOC4FieldRecords = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const pct = c => `${Math.round((c || 0) * 100)}%`;

  /** Best-effort split of extractor's `where` strings ("Sheet1!R23", "statement.pdf p4", "form")
   * into a sheet/page label and a finer cell/location when one is present. */
  function splitLocation(where) {
    const w = String(where || '');
    let m;
    if ((m = /^(.+?)!R(\d+)$/.exec(w))) return { sheetOrPage: m[1], cellOrLocation: `Row ${m[2]}` };
    if ((m = /\bp(\d+)$/.exec(w))) return { sheetOrPage: w, cellOrLocation: `Page ${m[1]}` };
    if ((m = /\bline (\d+)$/.exec(w))) return { sheetOrPage: w, cellOrLocation: `Line ${m[1]}` };
    if (w === 'form' || /\(form\)$/.test(w)) return { sheetOrPage: w, cellOrLocation: 'Filed AOC-4 form text' };
    return { sheetOrPage: w, cellOrLocation: w || null };
  }

  /** The raw figure as printed, pulled out of the evidence quote when possible; falls back to the
   * quote itself (the clearest "as seen" text we kept) when a clean number can't be isolated. */
  function guessOriginalValue(proposal) {
    const quote = proposal.evidence && proposal.evidence.quote;
    if (!quote) return proposal.value;
    if (typeof proposal.value === 'number') {
      const m = String(quote).match(/\(?-?₹?\s*[\d,]+(?:\.\d+)?\)?/g);
      if (m && m.length) return m[m.length - 1].trim();
    }
    return quote;
  }

  function extractionMethodOf(proposal) {
    const sources = proposal.sources || [proposal.method || 'rules'];
    let method = sources.includes('rules') && sources.includes('ai') ? 'rules+ai' : sources.includes('ai') ? 'ai' : 'rules';
    if (proposal.edited) method += '+manual-edit';
    return method;
  }

  function mappingExplanationOf(proposal, catalogLabel) {
    const sources = proposal.sources || [proposal.method || 'rules'];
    const where = proposal.evidence && proposal.evidence.where;
    const quote = proposal.evidence && proposal.evidence.quote;
    const confPct = pct(proposal.confidence);
    if (proposal.edited) return `Reviewer entered this value by hand, overriding the extracted figure.`;
    if (sources.includes('rules') && sources.includes('ai')) {
      return `Both the document rules and the AI model agree on this value (confidence ${confPct}). Rules matched the source label "${quote || catalogLabel}" at ${where || 'the document'}; the AI model mapped it from the field catalogue entry "${catalogLabel}".`;
    }
    if (sources.includes('ai') && !sources.includes('rules')) {
      return `The AI model mapped this field from the catalogue description "${catalogLabel}" (confidence ${confPct}). No deterministic pattern in the document rules matched this field.`;
    }
    return `Matched the source label "${quote || catalogLabel}" at ${where || 'the document'} against the Schedule III / AOC-4 pattern catalogue for ${proposal.path} (confidence ${confPct}).`;
  }

  /**
   * proposal: one merged proposal (see js/extractor.js buildProposals/mergeProposals).
   * opts.catalogLabel: human label for the field (from aiCatalog()/catalogEntry()).
   * opts.financialYear: the filing's target FY ("2025-26"), used to label which column this figure is.
   * opts.column: 'current' | 'previous' | null — precomputed via AOC4Extract.columnForPeriod.
   * opts.validationStatus: a status already computed by js/comparison.js / js/reconciliation.js for
   *   this path, if any ('MATCHED', 'MISMATCH', ... or a reconciliation issue code). Defaults to a
   *   best-guess derived from confidence/conflict alone when the caller hasn't computed one yet.
   */
  function buildFieldRecord(proposal, opts = {}) {
    const { sheetOrPage, cellOrLocation } = splitLocation(proposal.evidence && proposal.evidence.where);
    const confidenceScore = typeof proposal.confidence === 'number' ? proposal.confidence : 0;
    let validationStatus = opts.validationStatus;
    if (!validationStatus) validationStatus = proposal.conflict ? 'NEEDS_REVIEW' : (confidenceScore < 0.6 ? 'NEEDS_REVIEW' : 'NOT_VERIFIABLE');
    const reviewRequired = !!proposal.conflict || confidenceScore < 0.7 || ['MISMATCH', 'NEEDS_REVIEW', 'MISSING_IN_DASHBOARD', 'MISSING_IN_DOCUMENT'].includes(validationStatus);
    return {
      path: proposal.path,
      value: proposal.value,
      originalValue: guessOriginalValue(proposal),
      normalizedValue: proposal.value,
      sourceFile: (proposal.evidence && proposal.evidence.file) || '',
      sourceSheetOrPage: sheetOrPage || '',
      sourceCellOrLocation: cellOrLocation || '',
      financialYear: opts.column ? `FY ${opts.financialYear || '?'} (${opts.column})` : (opts.financialYear || null),
      confidenceScore,
      extractionMethod: extractionMethodOf(proposal),
      mappingExplanation: mappingExplanationOf(proposal, opts.catalogLabel || proposal.label || proposal.path),
      validationStatus,
      reviewRequired
    };
  }

  /**
   * Extraction completeness metrics (Phase 7). Nothing here counts a default/blank value as a
   * success — "successfully extracted" means a proposal with real evidence behind it.
   * catalog: aiCatalog()-shaped list of { path, ... }.
   * proposals: the merged, enriched proposals shown in the review table (excludes the signatories
   *   pseudo-row, which has no single catalogue path).
   * aiNorm: normalizeAiOutput() result (for unmappedFields) — optional.
   * aiOut: the raw model output for this run (for diagnostics/stats on the gateway path) — optional.
   */
  function computeCompletenessMetrics(catalog, proposals, aiNorm, aiOut) {
    const fieldProposals = (proposals || []).filter(p => p.type !== 'signatories');
    const byPath = new Set(fieldProposals.map(p => p.path));
    const successfullyExtracted = fieldProposals.length;
    const verifiedZeroFields = fieldProposals.filter(p => p.value === 0 && p.evidence && p.evidence.quote).length;
    const missingFields = (catalog || []).filter(c => !byPath.has(c.path)).length;
    const diagnostics = (aiOut && aiOut.diagnostics) || [];
    const failedFields = diagnostics.reduce((n, d) => n + (d.items ? d.items.length : 0), 0);
    const unmappedFields = (aiNorm && aiNorm.unmappedFields && aiNorm.unmappedFields.length) || 0;
    const withEvidence = fieldProposals.filter(p => p.evidence && p.evidence.quote).length;
    return {
      totalExpectedFields: (catalog || []).length,
      successfullyExtracted,
      verifiedZeroFields,
      missingFields,
      failedFields,
      needsReviewFields: fieldProposals.filter(p => p.conflict || (p.confidence || 0) < 0.7).length,
      unmappedFields,
      jsonParsingFailures: diagnostics.filter(d => d.error).length,
      sourceEvidenceCoveragePct: successfullyExtracted ? Math.round((withEvidence / successfullyExtracted) * 100) : 0
    };
  }

  return { buildFieldRecord, splitLocation, computeCompletenessMetrics };
});
