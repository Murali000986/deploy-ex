/* Generic chunk-call resilience (Phase: JSON chunking/parsing fixes) — provider-agnostic retry/split
 * policy for calling a rate- or size-limited AI endpoint in batches. The actual HTTP call is injected
 * (`callChunk`), so this same, tested policy drives the real Gateway calls in js/dashboard.js AND runs
 * under plain Node tests against a fake, deliberately-flaky `callChunk`.
 *
 * Policy: for each chunk, call `callChunk`; on failure, retry at the SAME size up to `retries` times
 * (LLM output is non-deterministic — a retry often just works); if still failing and the chunk has
 * more than one item, split it in half and retry each half independently (recursively, down to one
 * item); a single item that still fails is given up on and recorded in `diagnostics`, never guessed
 * at or fabricated. One bad item can therefore never lose the rest of a run.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AOC4ChunkResilience = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * items: the full list to process in chunks (e.g. the field catalogue).
   * chunkSize: items per call.
   * retries: attempts at the same size before splitting (>=1).
   * concurrency: how many chunk calls are in flight at once (default 4). A 24-chunk extraction run
   *   one-at-a-time takes roughly 24x a single call's latency; at concurrency 4 it takes roughly 6x —
   *   this is the main lever for "uploading an Excel file takes a long time to extract".
   * callChunk(itemsSlice, {attempt, includeExtras}): async, returns
   *   {fields, signatoriesFS, signatoriesBR, notes} or throws (Error, optionally with .truncated/.rawText).
   * isFirst(chunkIndex): which chunk index is "the first" — passed includeExtras:true (e.g. attachments
   *   / a one-per-document schema addition that every other chunk should skip to save budget). This
   *   stays well-defined under concurrency: it's the chunk's fixed position in the catalogue, not
   *   which one happens to finish first.
   * Returns { fields, signatoriesFS, signatoriesBR, notes, diagnostics, stats }.
   */
  async function processInChunks({ items, chunkSize, retries = 2, callChunk, isFirst = i => i === 0, concurrency = 4 }) {
    const chunks = [];
    for (let i = 0; i < items.length; i += chunkSize) chunks.push(items.slice(i, i + chunkSize));
    const merged = { fields: [], signatoriesFS: [], signatoriesBR: [], notes: [] };
    const seenFS = new Set(), seenBR = new Set();
    const diagnostics = [];
    const stats = { chunksTotal: chunks.length, chunksSucceededFirstTry: 0, chunksRecoveredByRetry: 0, chunksRecoveredBySplit: 0, chunksFailed: 0 };
    const mergeOne = out => {
      if (Array.isArray(out.fields)) merged.fields.push(...out.fields);
      for (const s of out.signatoriesFS || []) { const k = s.identifier || s.din || s.name; if (k && !seenFS.has(k)) { seenFS.add(k); merged.signatoriesFS.push(s); } }
      for (const s of out.signatoriesBR || []) { const k = s.identifier || s.din || s.name; if (k && !seenBR.has(k)) { seenBR.add(k); merged.signatoriesBR.push(s); } }
      if (Array.isArray(out.notes)) merged.notes.push(...out.notes);
    };
    // A small fixed-size worker pool: each worker pulls the next not-yet-started chunk off the queue
    // as soon as it finishes its current one, so slow/retried/split chunks never stall the others —
    // there's no fixed pairing of worker-to-chunk, just a shared cursor.
    let next = 0;
    async function worker() {
      while (next < chunks.length) {
        const i = next++;
        mergeOne(await callOneChunk(chunks[i], { includeExtras: isFirst(i) }, callChunk, retries, diagnostics, stats));
      }
    }
    await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, chunks.length)) }, worker));
    stats.chunksFailed = diagnostics.filter(d => d.items.length === 1).length; // leaf (un-splittable) failures only
    return { ...merged, diagnostics, stats };
  }

  async function callOneChunk(items, opts, callChunk, retries, diagnostics, stats, attempt = 1) {
    try {
      const out = await callChunk(items, { ...opts, attempt });
      if (attempt === 1) stats.chunksSucceededFirstTry++; else stats.chunksRecoveredByRetry++;
      return { fields: [], signatoriesFS: [], signatoriesBR: [], notes: [], ...out };
    } catch (e) {
      if (attempt < retries) return callOneChunk(items, opts, callChunk, retries, diagnostics, stats, attempt + 1);
      if (items.length > 1) {
        const mid = Math.ceil(items.length / 2);
        const [a, b] = [items.slice(0, mid), items.slice(mid)];
        const [ra, rb] = await Promise.all([
          callOneChunk(a, opts, callChunk, retries, diagnostics, stats),
          callOneChunk(b, { ...opts, includeExtras: false }, callChunk, retries, diagnostics, stats)
        ]);
        stats.chunksRecoveredBySplit++;
        return { fields: [...ra.fields, ...rb.fields], signatoriesFS: ra.signatoriesFS, signatoriesBR: ra.signatoriesBR, notes: [...ra.notes, ...rb.notes] };
      }
      diagnostics.push({ items, attempt, error: e.message, truncated: !!e.truncated, rawTextSnippet: String(e.rawText || '').slice(0, 1000) });
      return { fields: [], signatoriesFS: [], signatoriesBR: [], notes: [] };
    }
  }

  /** Collapses near-identical notes (same text, ignoring case/punctuation) to one — a 19-chunk run
   * should not repeat the same sentence 19 times. */
  function dedupeSimilarNotes(notes) {
    const seen = new Set(), out = [];
    for (const n of notes || []) {
      const key = String(n).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key); out.push(n);
    }
    return out;
  }

  return { processInChunks, dedupeSimilarNotes };
});
