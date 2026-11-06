/* AOC-4 Review & Approval store (Phase 7) — per-field review decisions and an append-only audit
 * trail, kept COMPLETELY SEPARATE from the client's `state` object (the actual AOC-4 filing data
 * sent to the extension). This is a hard requirement from the brief: no migration, no new keys, no
 * risk to the filing JSON contract. Persisted under its own localStorage key per client,
 * `aoc4_review_<clientId>`, next to the existing `aoc4_draft_<clientId>` key dashboard.js already
 * uses for the client's form state.
 *
 * A storage backend can be injected (opts.backend), defaulting to the global `localStorage` when one
 * exists and to an in-memory Map otherwise — so this runs the same way under plain Node tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AOC4ReviewStore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function memoryBackend() {
    const map = new Map();
    return { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
  }
  function defaultBackend() {
    try { if (typeof localStorage !== 'undefined') return localStorage; } catch (_) { /* privacy mode etc. */ }
    return memoryBackend();
  }

  const STATUSES = ['pending', 'accepted', 'rejected', 'edited', 'reviewed'];

  function keyFor(clientId) { return `aoc4_review_${clientId || 'draft'}`; }

  class ReviewStore {
    constructor(opts = {}) {
      this.backend = opts.backend || defaultBackend();
    }
    _load(clientId) {
      try {
        const raw = this.backend.getItem(keyFor(clientId));
        if (!raw) return { records: {}, audit: [] };
        const parsed = JSON.parse(raw);
        return { records: parsed.records || {}, audit: parsed.audit || [] };
      } catch (_) { return { records: {}, audit: [] }; }
    }
    _save(clientId, data) { this.backend.setItem(keyFor(clientId), JSON.stringify(data)); }

    getRecord(clientId, path) {
      const { records } = this._load(clientId);
      return records[path] || { status: 'pending', note: '', updatedBy: null, updatedAt: null };
    }
    getAllRecords(clientId) { return this._load(clientId).records; }
    getAuditTrail(clientId) { return this._load(clientId).audit; }

    /** action: 'accept' | 'reject' | 'edit' | 'mark-reviewed' | 'note' | 're-validate'. */
    apply(clientId, path, action, { value, prevValue, by = 'unknown', note = '' } = {}) {
      const data = this._load(clientId);
      const prevRecord = data.records[path] || { status: 'pending', note: '', updatedBy: null, updatedAt: null };
      const statusByAction = { accept: 'accepted', reject: 'rejected', edit: 'edited', 'mark-reviewed': 'reviewed', note: prevRecord.status, 're-validate': prevRecord.status };
      const newStatus = statusByAction[action] || prevRecord.status;
      const newRecord = { status: newStatus, note: note || prevRecord.note, value: value !== undefined ? value : prevRecord.value, updatedBy: by, updatedAt: new Date().toISOString() };
      data.records[path] = newRecord;
      data.audit.push({ path, action, prevStatus: prevRecord.status, newStatus, prevValue: prevValue !== undefined ? prevValue : (prevRecord.value ?? null), newValue: value !== undefined ? value : (prevRecord.value ?? null), note, by, at: newRecord.updatedAt });
      this._save(clientId, data);
      return newRecord;
    }

    exportAudit(clientId) {
      const { audit } = this._load(clientId);
      return JSON.stringify(audit, null, 2);
    }
    clear(clientId) { this.backend.removeItem(keyFor(clientId)); }
  }

  return { ReviewStore, STATUSES, keyFor };
});
