// Read-only search/validation API over the classification reference data (classification-db.js).
// This is the ONLY place in the codebase allowed to say a code is real — the classification engine
// (Phase B) and the dashboard's manual-search UI (Phase C) both go through here, never trusting a
// code string from anywhere else (including a Claude response) without a lookup against this module.
'use strict';
const { defaultDb } = require('./classification-db.js');

const STOPWORDS = new Set(['and', 'or', 'the', 'of', 'for', 'a', 'an', 'in', 'to', 'n.e.c', 'nec']);

function tokenize(query) {
  return String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

function scoreRow(row, tokens, rawQuery) {
  const desc = row.description.toLowerCase();
  let score = 0;
  for (const t of tokens) if (desc.includes(t)) score += 1;
  if (tokens.length && score === tokens.length) score += 1; // all tokens matched
  if (rawQuery && desc.includes(String(rawQuery).toLowerCase().trim())) score += 2; // contiguous phrase match
  if (row.code === String(rawQuery || '').trim()) score += 10; // exact code lookup typed into the search box
  return score;
}

function searchByText(scheme, query, { limit = 20, parentCode, db } = {}) {
  const d = db || defaultDb();
  const tokens = tokenize(query);
  if (!tokens.length) return [];
  const candidates = d.searchByTokens(scheme, tokens, { cap: 500, parentCode });
  return candidates
    .map(row => ({ ...row, score: scoreRow(row, tokens, query) }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || a.description.length - b.description.length)
    .slice(0, limit)
    .map(({ code, level, description, parentCode: pc, score }) => {
      const parent = pc ? d.getByCode(scheme, pc) : null;
      return { code, level, description, parentCode: pc || null, parentDescription: parent ? parent.description : null, score };
    });
}

function getByCode(scheme, code, { db } = {}) {
  const d = db || defaultDb();
  const row = d.getByCode(scheme, code);
  if (!row) return null;
  const parent = row.parentCode ? d.getByCode(scheme, row.parentCode) : null;
  return { code: row.code, level: row.level, description: row.description, parentCode: row.parentCode || null, parentDescription: parent ? parent.description : null };
}

function validateCode(scheme, code, { db } = {}) {
  const d = db || defaultDb();
  const row = d.getByCode(scheme, code);
  if (!row) return { valid: false, description: null, parentCode: null, parentValid: false };
  const parentValid = !row.parentCode || !!d.getByCode(scheme, row.parentCode);
  return { valid: true, description: row.description, parentCode: row.parentCode || null, parentValid };
}

function getChildren(scheme, categoryCode4, { db } = {}) {
  const d = db || defaultDb();
  return d.getChildren(scheme, categoryCode4).map(({ code, description }) => ({ code, description }));
}

module.exports = { searchByText, getByCode, validateCode, getChildren, tokenize };
