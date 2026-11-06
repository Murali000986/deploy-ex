const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRows, buildSpotCheckSample, parseDelimited, groupTextItemsIntoLines, reconstructRowsFromLines } = require('../scripts/import-classification.js');

test('validateRows: accepts a clean, consistent batch', () => {
  const rows = [
    { code: '9992', level: 4, parentCode: null, description: 'Education services' },
    { code: '99929199', level: 8, parentCode: '9992', description: 'Other education and training services n.e.c.' }
  ];
  const { errors, warnings } = validateRows(rows, { scheme: 'NPCS' });
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test('validateRows: rejects a code with the wrong digit count', () => {
  const rows = [{ code: '99929', level: 5, parentCode: null, description: 'Something' }];
  const { errors } = validateRows(rows, { scheme: 'NPCS' });
  assert.match(errors[0], /must be exactly 4, 6, or 8 digits/);
});

test('validateRows: rejects an 8-digit code whose parent is not in the batch', () => {
  const rows = [{ code: '99929199', level: 8, parentCode: '9992', description: 'Other education and training services n.e.c.' }];
  const { errors } = validateRows(rows, { scheme: 'NPCS' });
  assert.match(errors[0], /parent code "9992" does not exist/);
});

test('validateRows: rejects a child code that does not actually start with its declared parent (misalignment guard)', () => {
  const rows = [
    { code: '9992', level: 4, parentCode: null, description: 'Education services' },
    { code: '12345678', level: 8, parentCode: '9992', description: 'Mismatched product' }
  ];
  const { errors } = validateRows(rows, { scheme: 'NPCS' });
  assert.match(errors.join('\n'), /does not start with its declared parent/);
});

test('validateRows: rejects duplicate codes within the same scheme', () => {
  const rows = [
    { code: '9992', level: 4, parentCode: null, description: 'Education services' },
    { code: '9992', level: 4, parentCode: null, description: 'Education services (dup)' }
  ];
  const { errors } = validateRows(rows, { scheme: 'NPCS' });
  assert.match(errors.join('\n'), /duplicate code/);
});

test('validateRows: rejects a garbled/too-short description (misalignment signal)', () => {
  const rows = [{ code: '9992', level: 4, parentCode: null, description: 'Ed' }];
  const { errors } = validateRows(rows, { scheme: 'NPCS' });
  assert.match(errors[0], /too short/);
});

test('validateRows: rejects an all-digit description (a code likely landed in the wrong column)', () => {
  const rows = [{ code: '9992', level: 4, parentCode: null, description: '99531110' }];
  const { errors } = validateRows(rows, { scheme: 'NPCS' });
  assert.match(errors[0], /all-digits/);
});

test('buildSpotCheckSample: returns every row when the batch is small, random sample otherwise', () => {
  const small = [{ code: '9992', description: 'Education services' }];
  assert.deepEqual(buildSpotCheckSample(small, 40), [{ code: '9992', description: 'Education services', sourcePage: null }]);

  const big = Array.from({ length: 100 }, (_, i) => ({ code: String(1000 + i), description: `Item ${i}` }));
  const sample = buildSpotCheckSample(big, 40);
  assert.equal(sample.length, 40);
  const codes = new Set(sample.map(s => s.code));
  assert.equal(codes.size, 40); // no duplicates drawn
});

test('parseDelimited: parses a CSV with the expected columns', () => {
  const csv = 'code,level,parentCode,description,page\n9992,4,,Education services,10\n99929199,8,9992,Other education and training services n.e.c.,11\n';
  const rows = parseDelimited(csv, ',');
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { code: '9992', level: 4, parentCode: null, description: 'Education services', sectionDesc: null, divisionDesc: null, groupDesc: null, classDesc: null, sourcePage: 10 });
  assert.equal(rows[1].parentCode, '9992');
});

test('groupTextItemsIntoLines: groups items with close y-coordinates into the same line, sorted by x', () => {
  const items = [
    { str: 'World', x: 50, y: 100 }, { str: 'Hello', x: 10, y: 100.5 },
    { str: '9992', x: 5, y: 80 }
  ];
  const lines = groupTextItemsIntoLines(items);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[1].items.map(i => i.str), ['Hello', 'World']); // sorted by y then x within tolerance
});

test('reconstructRowsFromLines: tracks running 4-digit/6-digit parent context across lines', () => {
  const lines = [
    { y: 1, page: 10, items: [{ str: '9992' }, { str: 'Education services' }] },
    { y: 2, page: 11, items: [{ str: '99929199' }, { str: 'Other education and training services n.e.c.' }] }
  ];
  const rows = reconstructRowsFromLines(lines, { scheme: 'NPCS', sourceDoc: 'npcs.pdf' });
  assert.equal(rows.length, 2);
  const byCode = Object.fromEntries(rows.map(r => [r.code, r]));
  assert.equal(byCode['9992'].parentCode, null);
  assert.equal(byCode['99929199'].parentCode, '9992');
  assert.equal(byCode['99929199'].sourcePage, 11);
});
