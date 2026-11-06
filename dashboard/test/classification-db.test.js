const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openClassificationDb } = require('../js/classification-db.js');
const lookup = require('../js/classification-lookup.js');

function tempDb() {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cls-db-')), 'classification.db');
  return openClassificationDb(dbPath);
}

function seed(db) {
  const now = Date.now();
  const rows = [
    { scheme: 'NPCS', code: '9992', level: 4, parentCode: null, description: 'Education services', sourceDoc: 'npcs.pdf', sourcePage: 10, datasetVersion: 'npcs-v1-test', importedAt: now },
    { scheme: 'NPCS', code: '99921', level: 5, parentCode: '9992', description: 'Pre-primary education services', sourceDoc: 'npcs.pdf', sourcePage: 10, datasetVersion: 'npcs-v1-test', importedAt: now },
    { scheme: 'NPCS', code: '99929199', level: 8, parentCode: '9992', description: 'Other education and training services n.e.c.', sourceDoc: 'npcs.pdf', sourcePage: 11, datasetVersion: 'npcs-v1-test', importedAt: now },
    { scheme: 'NPCS', code: '99929110', level: 8, parentCode: '9992', description: 'Curriculum development services', sourceDoc: 'npcs.pdf', sourcePage: 11, datasetVersion: 'npcs-v1-test', importedAt: now },
    { scheme: 'NPCS', code: '9953', level: 4, parentCode: null, description: 'Construction services of buildings', sourceDoc: 'npcs.pdf', sourcePage: 1, datasetVersion: 'npcs-v1-test', importedAt: now }
  ];
  db.insertCodesBatch(rows);
  db.insertMeta({ scheme: 'NPCS', datasetVersion: 'npcs-v1-test', sourceFile: 'npcs.pdf', sourceSha256: 'deadbeef', rowCount: rows.length, spotCheckSample: [], importedAt: now });
}

test('getByCode: returns a code row, null for unknown code', () => {
  const db = tempDb();
  seed(db);
  assert.equal(db.getByCode('NPCS', '9992').description, 'Education services');
  assert.equal(db.getByCode('NPCS', '0000'), null);
  db.close();
});

test('getChildren: returns only direct children of a 4-digit category', () => {
  const db = tempDb();
  seed(db);
  const children = db.getChildren('NPCS', '9992');
  assert.deepEqual(children.map(c => c.code).sort(), ['99921', '99929110', '99929199']);
  db.close();
});

test('classification-lookup.validateCode: valid code with a valid parent', () => {
  const db = tempDb();
  seed(db);
  const result = lookup.validateCode('NPCS', '99929199', { db });
  assert.deepEqual(result, { valid: true, description: 'Other education and training services n.e.c.', parentCode: '9992', parentValid: true });
  db.close();
});

test('classification-lookup.validateCode: unknown code is invalid, never fabricated', () => {
  const db = tempDb();
  seed(db);
  const result = lookup.validateCode('NPCS', '99999999', { db });
  assert.equal(result.valid, false);
  db.close();
});

test('classification-lookup.searchByText: finds codes by description keywords, ranked by relevance', () => {
  const db = tempDb();
  seed(db);
  const results = lookup.searchByText('NPCS', 'education training', { db });
  assert.ok(results.length > 0);
  assert.equal(results[0].code, '99929199'); // matches both tokens — should outrank single-token matches
  assert.equal(results[0].parentDescription, 'Education services');
});

test('classification-lookup.searchByText: unrelated query returns no results (never guesses)', () => {
  const db = tempDb();
  seed(db);
  const results = lookup.searchByText('NPCS', 'zebra xenotransplant quokka', { db });
  assert.deepEqual(results, []);
  db.close();
});

test('classification-lookup.getChildren: wraps db children into {code, description} only', () => {
  const db = tempDb();
  seed(db);
  const children = lookup.getChildren('NPCS', '9992', { db });
  assert.deepEqual(children.sort((a, b) => a.code.localeCompare(b.code)), [
    { code: '99921', description: 'Pre-primary education services' },
    { code: '99929110', description: 'Curriculum development services' },
    { code: '99929199', description: 'Other education and training services n.e.c.' }
  ]);
  db.close();
});
