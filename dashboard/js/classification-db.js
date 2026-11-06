// Storage for the official ITC (goods) / NPCS (services) classification code reference data used to
// ground AOC-4 "principal product or service" AI suggestions. SQLite via node:sqlite, kept in a
// separate .db file from app.db (auth-db.js) because this is bulk, versioned reference data imported
// offline by dashboard/scripts/import-classification.js, not operational auth state. Server-side only
// (required from server.js / classification-lookup.js / the import script) — never loaded in the browser.
'use strict';
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'data', 'classification', 'classification.db');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheme TEXT NOT NULL,
    code TEXT NOT NULL,
    level INTEGER NOT NULL,
    parent_code TEXT,
    description TEXT NOT NULL,
    section_desc TEXT,
    division_desc TEXT,
    group_desc TEXT,
    class_desc TEXT,
    source_doc TEXT NOT NULL,
    source_page INTEGER,
    dataset_version TEXT NOT NULL,
    imported_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_codes_scheme_code ON codes(scheme, code);
  CREATE INDEX IF NOT EXISTS idx_codes_parent ON codes(scheme, parent_code);
  CREATE INDEX IF NOT EXISTS idx_codes_level ON codes(scheme, level);

  CREATE TABLE IF NOT EXISTS classification_meta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheme TEXT NOT NULL,
    dataset_version TEXT NOT NULL,
    source_file TEXT NOT NULL,
    source_sha256 TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    spot_check_sample TEXT NOT NULL,
    imported_at INTEGER NOT NULL
  );
`;

function openClassificationDb(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA);

  function insertCode(row) {
    db.prepare(`
      INSERT INTO codes (scheme, code, level, parent_code, description, section_desc, division_desc,
                          group_desc, class_desc, source_doc, source_page, dataset_version, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.scheme, row.code, row.level, row.parentCode || null, row.description,
      row.sectionDesc || null, row.divisionDesc || null, row.groupDesc || null, row.classDesc || null,
      row.sourceDoc, row.sourcePage || null, row.datasetVersion, row.importedAt || Date.now()
    );
  }

  function insertCodesBatch(rows) {
    db.exec('BEGIN');
    try {
      for (const row of rows) insertCode(row);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }

  function clearScheme(scheme) {
    db.prepare('DELETE FROM codes WHERE scheme = ?').run(scheme);
  }

  function insertMeta(meta) {
    db.prepare(`
      INSERT INTO classification_meta (scheme, dataset_version, source_file, source_sha256, row_count, spot_check_sample, imported_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(meta.scheme, meta.datasetVersion, meta.sourceFile, meta.sourceSha256, meta.rowCount,
      JSON.stringify(meta.spotCheckSample || []), meta.importedAt || Date.now());
  }

  function getMeta(scheme) {
    return db.prepare('SELECT * FROM classification_meta WHERE scheme = ? ORDER BY id DESC LIMIT 1').get(scheme) || null;
  }

  function rowToCode(r) {
    if (!r) return null;
    return {
      code: r.code, level: r.level, parentCode: r.parent_code, description: r.description,
      sectionDesc: r.section_desc, divisionDesc: r.division_desc, groupDesc: r.group_desc, classDesc: r.class_desc,
      sourceDoc: r.source_doc, sourcePage: r.source_page, datasetVersion: r.dataset_version
    };
  }

  function getByCode(scheme, code) {
    return rowToCode(db.prepare('SELECT * FROM codes WHERE scheme = ? AND code = ?').get(scheme, code));
  }

  function getChildren(scheme, parentCode) {
    return db.prepare('SELECT * FROM codes WHERE scheme = ? AND parent_code = ? ORDER BY code')
      .all(scheme, parentCode).map(rowToCode);
  }

  function countByScheme(scheme) {
    return db.prepare('SELECT COUNT(*) AS n FROM codes WHERE scheme = ?').get(scheme).n;
  }

  function searchRows(scheme, { limit = 500 } = {}) {
    return db.prepare('SELECT * FROM codes WHERE scheme = ? LIMIT ?').all(scheme, limit).map(rowToCode);
  }

  // Raw substring search used by classification-lookup.js's ranking layer: returns every row whose
  // description contains ANY of the given lowercase tokens, capped at `cap` rows for the caller to
  // re-rank in JS. node:sqlite has no guaranteed FTS5, so this is a plain bounded LIKE scan — adequate
  // at tens-of-thousands-of-rows scale.
  function searchByTokens(scheme, tokens, { cap = 500, parentCode } = {}) {
    if (!tokens.length) return [];
    const clauses = tokens.map(() => 'LOWER(description) LIKE ?').join(' OR ');
    const params = tokens.map(t => `%${t}%`);
    let sql = `SELECT * FROM codes WHERE scheme = ? AND (${clauses})`;
    const args = [scheme, ...params];
    if (parentCode) { sql += ' AND parent_code = ?'; args.push(parentCode); }
    sql += ' LIMIT ?';
    args.push(cap);
    return db.prepare(sql).all(...args).map(rowToCode);
  }

  return {
    raw: db,
    insertCode, insertCodesBatch, clearScheme, insertMeta, getMeta,
    getByCode, getChildren, countByScheme, searchRows, searchByTokens,
    close: () => db.close()
  };
}

let _default = null;
function defaultDb() {
  if (!_default) _default = openClassificationDb(DEFAULT_DB_PATH);
  return _default;
}

module.exports = { openClassificationDb, defaultDb, DEFAULT_DB_PATH };
