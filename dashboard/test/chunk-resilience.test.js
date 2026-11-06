const { test } = require('node:test');
const assert = require('node:assert/strict');
const { processInChunks, dedupeSimilarNotes } = require('../js/chunk-resilience.js');

const items = n => Array.from({ length: n }, (_, i) => ({ path: `field.${i}` }));
const okResult = fields => ({ fields, signatoriesFS: [], signatoriesBR: [], notes: [] });

test('processInChunks: every chunk succeeds on the first try', async () => {
  let calls = 0;
  const result = await processInChunks({
    items: items(20), chunkSize: 5, retries: 2,
    callChunk: async (slice) => { calls++; return okResult(slice.map(i => ({ path: i.path, value: '1' }))); }
  });
  assert.equal(calls, 4); // 20 items / 5 per chunk
  assert.equal(result.fields.length, 20);
  assert.equal(result.stats.chunksSucceededFirstTry, 4);
  assert.equal(result.stats.chunksFailed, 0);
  assert.equal(result.diagnostics.length, 0);
});

test('processInChunks: a chunk that fails once then succeeds is recovered by retry, not lost', async () => {
  let attemptsForChunk1 = 0;
  const result = await processInChunks({
    items: items(10), chunkSize: 5, retries: 2,
    callChunk: async (slice, { attempt }) => {
      if (slice[0].path === 'field.5' && attempt === 1) { attemptsForChunk1++; throw new Error('Expected \',\' or \']\' after array element'); }
      return okResult(slice.map(i => ({ path: i.path, value: '1' })));
    }
  });
  assert.equal(attemptsForChunk1, 1);
  assert.equal(result.fields.length, 10, 'no fields should be lost — the retry recovered the chunk');
  assert.equal(result.stats.chunksRecoveredByRetry, 1);
  assert.equal(result.stats.chunksFailed, 0);
});

test('processInChunks: a chunk that keeps failing at its size is split in half and recovered', async () => {
  const result = await processInChunks({
    items: items(8), chunkSize: 8, retries: 2,
    callChunk: async (slice) => {
      // Simulate exactly the reported symptom: a batch that is "too big" for this content always
      // truncates, but each half of it fits comfortably.
      if (slice.length > 4) { const e = new Error("Expected ',' or ']' after array element"); e.truncated = true; throw e; }
      return okResult(slice.map(i => ({ path: i.path, value: '1' })));
    }
  });
  assert.equal(result.fields.length, 8, 'both halves should have succeeded after the split');
  assert.equal(result.stats.chunksRecoveredBySplit, 1);
  assert.equal(result.stats.chunksFailed, 0);
});

test('processInChunks: a field that fails all the way down to a single item is given up on and diagnosed, not fabricated', async () => {
  const result = await processInChunks({
    items: items(4), chunkSize: 4, retries: 2,
    callChunk: async (slice) => {
      if (slice.some(i => i.path === 'field.2')) { const e = new Error('model did not return JSON'); e.rawText = '{"fields":[{"path":"field.2"'; throw e; }
      return okResult(slice.map(i => ({ path: i.path, value: '1' })));
    }
  });
  const paths = result.fields.map(f => f.path).sort();
  assert.deepEqual(paths, ['field.0', 'field.1', 'field.3']); // field.2 is the only one missing
  assert.equal(result.stats.chunksFailed, 1);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].items.length, 1);
  assert.equal(result.diagnostics[0].items[0].path, 'field.2');
  assert.match(result.diagnostics[0].rawTextSnippet, /field\.2/);
});

test('processInChunks: this mirrors the reported run — 19 chunks, several of them failing and recovering by different routes', async () => {
  // Chunks (0-indexed) 11, 13, 14, 15, 16, 18 fail at least once — matching "Part 12/19, 14/19, 15/19,
  // 16/19, 17/19, 19/19" in the bug report (1-indexed there).
  const FLAKY = new Set([11, 13, 14, 15, 16, 18]);
  let chunkIndex = -1;
  const seenAttemptsPerChunk = new Map();
  const result = await processInChunks({
    items: items(19 * 6), chunkSize: 6, retries: 2,
    callChunk: async (slice, { attempt }) => {
      // Recover chunk index from the first item's numeric suffix / chunk size (stable per call group).
      const firstIdx = Number(slice[0].path.split('.')[1]);
      const idx = Math.floor(firstIdx / 6);
      const key = `${idx}:${slice.length}`;
      const n = (seenAttemptsPerChunk.get(key) || 0) + 1; seenAttemptsPerChunk.set(key, n);
      if (FLAKY.has(idx) && n === 1) throw new Error("Expected ',' or ']' after array element");
      return okResult(slice.map(i => ({ path: i.path, value: '1' })));
    }
  });
  assert.equal(result.fields.length, 19 * 6, 'every field should still be recovered after retries');
  assert.equal(result.stats.chunksFailed, 0);
  assert.ok(result.stats.chunksRecoveredByRetry >= 6);
});

test('processInChunks: concurrency actually overlaps calls — wall time is well under fully-sequential', async () => {
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const CALL_MS = 40, CHUNKS = 12, CONCURRENCY = 4;
  const start = Date.now();
  await processInChunks({
    items: items(CHUNKS * 5), chunkSize: 5, retries: 1, concurrency: CONCURRENCY,
    callChunk: async (slice) => { await delay(CALL_MS); return okResult(slice.map(i => ({ path: i.path, value: '1' }))); }
  });
  const elapsed = Date.now() - start;
  const sequential = CHUNKS * CALL_MS;
  const expectedParallel = Math.ceil(CHUNKS / CONCURRENCY) * CALL_MS;
  assert.ok(elapsed < sequential * 0.7, `expected well under the fully-sequential time (${sequential}ms); took ${elapsed}ms`);
  assert.ok(elapsed < expectedParallel + 150, `expected close to the parallel-batch time (${expectedParallel}ms); took ${elapsed}ms`);
});

test('processInChunks: concurrency=1 behaves exactly like the old fully-sequential path', async () => {
  const order = [];
  await processInChunks({
    items: items(15), chunkSize: 5, retries: 1, concurrency: 1,
    callChunk: async (slice) => { order.push(slice[0].path); return okResult(slice.map(i => ({ path: i.path, value: '1' }))); }
  });
  assert.deepEqual(order, ['field.0', 'field.5', 'field.10']);
});

test('processInChunks: results are identical regardless of concurrency — nothing depends on arrival order', async () => {
  const run = async concurrency => {
    const r = await processInChunks({
      items: items(40), chunkSize: 5, retries: 2, concurrency,
      callChunk: async (slice, { attempt }) => {
        await new Promise(res => setTimeout(res, Math.random() * 10));
        if (slice[0].path === 'field.20' && attempt === 1) throw new Error("Expected ',' or ']' after array element");
        return okResult(slice.map(i => ({ path: i.path, value: '1' })));
      }
    });
    return r.fields.map(f => f.path).sort();
  };
  const seq = await run(1), par = await run(6);
  assert.deepEqual(seq, par);
  assert.equal(seq.length, 40);
});

test('dedupeSimilarNotes: collapses repeated period-mismatch style notes from many chunks into one', () => {
  const notes = [
    'Figures dated 31/03/2024 were ignored because they belong to neither year of FY 2025-26.',
    'Figures dated 31/03/2024 were ignored because they belong to neither year of FY 2025-26.',
    'Figures dated 31/03/2024 were ignored because they belong to neither year of FY 2025-26!',
    'A completely different note.'
  ];
  const out = dedupeSimilarNotes(notes);
  assert.equal(out.length, 2);
});
