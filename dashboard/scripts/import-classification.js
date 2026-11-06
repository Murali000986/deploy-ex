#!/usr/bin/env node
// One-time, manually-run importer for the official ITC (goods) / NPCS (services) classification code
// lists into dashboard/data/classification/classification.db. NEVER invoked by the server or any API
// route — classification-lookup.js only ever reads data this script has already validated and committed.
//
// Usage:
//   node dashboard/scripts/import-classification.js --scheme NPCS --file ./source/npcs.csv
//   node dashboard/scripts/import-classification.js --scheme ITC  --file ./source/itc-hs.pdf --force
//
// Supported source formats:
//   .csv / .tsv  — columns: code,level,parentCode,description[,sectionDesc,divisionDesc,groupDesc,classDesc,page]
//                  (the reliable path — prefer a structured source over a PDF whenever one exists)
//   .pdf         — best-effort, position-aware text extraction via pdfjs-dist. The source documents for
//                  this classification (multi-level Section/Division/Group/Class/Sub-class tables) are
//                  known to confuse naive text extraction (plain `pdftotext -layout` already mis-aligns
//                  columns on the NPCS services PDF) — this is a heuristic line-based reconstruction,
//                  NOT guaranteed correct. It exists to produce a CANDIDATE row set that a human then
//                  spot-checks against the real source pages before the import is trusted. Do not skip
//                  the spot-check step. If a structured (CSV/Excel) source can be found instead, use it.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { openClassificationDb, DEFAULT_DB_PATH } = require('../js/classification-db.js');

const CODE_LEVELS = { 4: 4, 6: 6, 8: 8 };

// ─── Validation (pure, unit-tested in dashboard/test/classification-import.test.js) ───

function validateRows(rows, { scheme }) {
  const errors = [];
  const warnings = [];
  const seen = new Set();
  const byCode = new Map();
  for (const r of rows) byCode.set(r.code, r);

  for (const [i, r] of rows.entries()) {
    const where = `row ${i + 1} (code "${r.code}")`;
    if (!/^\d{4}$/.test(r.code) && !/^\d{6}$/.test(r.code) && !/^\d{8}$/.test(r.code)) {
      errors.push(`${where}: code must be exactly 4, 6, or 8 digits, got "${r.code}".`);
      continue;
    }
    const expectedLevel = r.code.length;
    if (r.level !== expectedLevel) {
      errors.push(`${where}: declared level ${r.level} does not match code length ${expectedLevel}.`);
    }
    if (seen.has(r.code)) {
      errors.push(`${where}: duplicate code within scheme ${scheme}.`);
    }
    seen.add(r.code);

    if (r.parentCode) {
      if (!byCode.has(r.parentCode)) {
        errors.push(`${where}: parent code "${r.parentCode}" does not exist in this import batch.`);
      } else if (!r.code.startsWith(r.parentCode)) {
        errors.push(`${where}: code does not start with its declared parent code "${r.parentCode}".`);
      }
    } else if (expectedLevel > 4) {
      warnings.push(`${where}: a ${expectedLevel}-digit code has no parentCode set.`);
    }

    const desc = String(r.description || '').trim();
    if (desc.length < 4) {
      errors.push(`${where}: description is missing or too short ("${desc}") — likely column misalignment.`);
    } else if (/^\d+$/.test(desc)) {
      errors.push(`${where}: description is all-digits ("${desc}") — likely a code landed in the description column.`);
    }
  }
  return { errors, warnings, rowCount: rows.length };
}

function buildSpotCheckSample(rows, n = 40) {
  if (rows.length <= n) return rows.map(r => ({ code: r.code, description: r.description, sourcePage: r.sourcePage || null }));
  const sample = [];
  const used = new Set();
  while (sample.length < n) {
    const idx = Math.floor(Math.random() * rows.length);
    if (used.has(idx)) continue;
    used.add(idx);
    const r = rows[idx];
    sample.push({ code: r.code, description: r.description, sourcePage: r.sourcePage || null });
  }
  return sample;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

// ─── Structured (CSV/TSV) source parsing — the reliable, preferred path ───

function parseDelimited(text, delimiter) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const header = lines[0].split(delimiter).map(h => h.trim());
  const idx = name => header.indexOf(name);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter);
    const code = (cells[idx('code')] || '').trim();
    if (!code) continue;
    rows.push({
      code,
      level: Number(cells[idx('level')]) || code.length,
      parentCode: (cells[idx('parentCode')] || '').trim() || null,
      description: (cells[idx('description')] || '').trim(),
      sectionDesc: (cells[idx('sectionDesc')] || '').trim() || null,
      divisionDesc: (cells[idx('divisionDesc')] || '').trim() || null,
      groupDesc: (cells[idx('groupDesc')] || '').trim() || null,
      classDesc: (cells[idx('classDesc')] || '').trim() || null,
      sourcePage: Number(cells[idx('page')]) || null
    });
  }
  return rows;
}

// ─── PDF source parsing — best-effort, see module header warning ───

function groupTextItemsIntoLines(items, yTolerance = 2) {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const item of sorted) {
    let line = lines.find(l => Math.abs(l.y - item.y) <= yTolerance);
    if (!line) { line = { y: item.y, items: [] }; lines.push(line); }
    line.items.push(item);
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines.sort((a, b) => a.y - b.y);
}

// Heuristic cascading-column reconstruction: tracks the most-recently-seen 4-digit and 6-digit code as
// the running parent context (matching the Section>Division>Group>Class>Sub-class>Product layout seen
// in the NPCS/ITC source documents), and treats the longest non-code text run on a line as its description.
function reconstructRowsFromLines(lines, { scheme, sourceDoc }) {
  const rows = [];
  let current4 = null, current6 = null;
  for (const line of lines) {
    const text = line.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
    const codeMatches = [...text.matchAll(/\b\d{4,8}\b/g)].map(m => m[0]);
    const description = text.replace(/\b\d{4,8}\b/g, '').replace(/\s+/g, ' ').trim();
    for (const code of codeMatches) {
      if (!/^\d{4}$/.test(code) && !/^\d{6}$/.test(code) && !/^\d{8}$/.test(code)) continue;
      let parentCode = null;
      if (code.length === 6) parentCode = current4;
      if (code.length === 8) parentCode = current6 && code.startsWith(current6) ? current6 : current4;
      if (description) rows.push({ code, level: code.length, parentCode, description, scheme, sourceDoc, sourcePage: line.page || null });
      if (code.length === 4) current4 = code;
      if (code.length === 6) current6 = code;
    }
  }
  return rows;
}

async function extractRowsFromPdf(filePath, { scheme }) {
  // Lazy require: pdfjs-dist is a devDependency used only by this script, kept out of the server/
  // browser runtime entirely (see dashboard/package.json).
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const allLines = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items.map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
    const lines = groupTextItemsIntoLines(items);
    for (const l of lines) l.page = pageNum;
    allLines.push(...lines);
  }
  return reconstructRowsFromLines(allLines, { scheme, sourceDoc: path.basename(filePath) });
}

// ─── CLI ───

async function main(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { args[argv[i].slice(2)] = argv[i + 1]; i++; }
  }
  const { scheme, file, force } = args;
  if (!scheme || !file) {
    console.error('Usage: node import-classification.js --scheme NPCS|ITC --file <path> [--force]');
    process.exit(1);
  }
  if (!['NPCS', 'ITC'].includes(scheme)) {
    console.error(`Unknown scheme "${scheme}" — must be NPCS or ITC.`);
    process.exit(1);
  }
  const ext = path.extname(file).toLowerCase();
  let rows;
  if (ext === '.csv' || ext === '.tsv') {
    rows = parseDelimited(fs.readFileSync(file, 'utf8'), ext === '.csv' ? ',' : '\t')
      .map(r => ({ ...r, scheme, sourceDoc: path.basename(file) }));
  } else if (ext === '.pdf') {
    rows = await extractRowsFromPdf(file, { scheme });
  } else {
    console.error(`Unsupported source extension "${ext}" — provide a .csv, .tsv, or .pdf file.`);
    process.exit(1);
  }

  const { errors, warnings, rowCount } = validateRows(rows, { scheme });
  console.log(`Parsed ${rowCount} rows for scheme ${scheme} from ${file}.`);
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings.slice(0, 20)) console.log(`  - ${w}`);
    if (warnings.length > 20) console.log(`  ...and ${warnings.length - 20} more.`);
  }
  if (errors.length) {
    console.error(`\n${errors.length} validation error(s) — import ABORTED, nothing was written:`);
    for (const e of errors.slice(0, 30)) console.error(`  - ${e}`);
    if (errors.length > 30) console.error(`  ...and ${errors.length - 30} more.`);
    process.exit(1);
  }

  const sample = buildSpotCheckSample(rows, 40);
  console.log(`\nSpot-check sample (${sample.length} rows) — verify these against the source document before trusting this import:`);
  for (const s of sample) console.log(`  ${s.code}  ${s.description}${s.sourcePage ? `  (p.${s.sourcePage})` : ''}`);

  const db = openClassificationDb(DEFAULT_DB_PATH);
  const existingMeta = db.getMeta(scheme);
  if (existingMeta && !force) {
    console.error(`\nScheme ${scheme} already has an imported dataset (${existingMeta.dataset_version}, ${existingMeta.row_count} rows). Pass --force to replace it (a timestamped backup of the .db file is NOT automatic — copy it yourself first if you want to keep the old one).`);
    db.close();
    process.exit(1);
  }
  if (existingMeta && force) {
    const backupPath = DEFAULT_DB_PATH.replace(/\.db$/, `.backup-${Date.now()}.db`);
    fs.copyFileSync(DEFAULT_DB_PATH, backupPath);
    console.log(`\nBacked up previous database to ${backupPath}`);
    db.clearScheme(scheme);
  }

  const datasetVersion = `${scheme.toLowerCase()}-v1-${new Date().toISOString().slice(0, 10)}`;
  const importedAt = Date.now();
  db.insertCodesBatch(rows.map(r => ({ ...r, datasetVersion, importedAt, sourceDoc: r.sourceDoc })));
  db.insertMeta({
    scheme, datasetVersion, sourceFile: path.basename(file),
    sourceSha256: sha256File(file), rowCount: rows.length, spotCheckSample: sample, importedAt
  });

  const logDir = path.join(__dirname, '..', 'data', 'classification', 'import-log');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  fs.writeFileSync(
    path.join(logDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${scheme.toLowerCase()}-import.json`),
    JSON.stringify({ scheme, datasetVersion, file: path.basename(file), rowCount: rows.length, warnings, spotCheckSample: sample, importedAt }, null, 2)
  );

  console.log(`\nImported ${rows.length} ${scheme} codes as dataset version ${datasetVersion}.`);
  db.close();
}

module.exports = { validateRows, buildSpotCheckSample, parseDelimited, groupTextItemsIntoLines, reconstructRowsFromLines };

if (require.main === module) {
  main(process.argv.slice(2)).catch(e => { console.error(e); process.exit(1); });
}
