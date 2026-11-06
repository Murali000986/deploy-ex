const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ReviewStore } = require('../js/review-store.js');

function freshStore() {
  const map = new Map();
  const backend = { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
  return new ReviewStore({ backend });
}

test('review-store: a new field defaults to pending with no audit entries', () => {
  const store = freshStore();
  const rec = store.getRecord('client1', 'balanceSheet.current.PPE');
  assert.equal(rec.status, 'pending');
  assert.deepEqual(store.getAuditTrail('client1'), []);
});

test('review-store: accept/reject/edit/mark-reviewed/note/re-validate each update status and log an audit entry', () => {
  const store = freshStore();
  const path = 'balanceSheet.current.PPE';
  store.apply('client1', path, 'accept', { value: 300000, by: 'Reviewer A' });
  assert.equal(store.getRecord('client1', path).status, 'accepted');

  store.apply('client1', path, 'edit', { value: 310000, prevValue: 300000, by: 'Reviewer A', note: 'corrected per note 4' });
  assert.equal(store.getRecord('client1', path).status, 'edited');
  assert.equal(store.getRecord('client1', path).value, 310000);

  store.apply('client1', path, 'mark-reviewed', { by: 'Reviewer A' });
  assert.equal(store.getRecord('client1', path).status, 'reviewed');

  store.apply('client1', path, 'reject', { by: 'Reviewer B', note: 'does not match auditor report' });
  assert.equal(store.getRecord('client1', path).status, 'rejected');

  store.apply('client1', path, 'note', { by: 'Reviewer B', note: 'follow up with client' });
  assert.equal(store.getRecord('client1', path).note, 'follow up with client');
  assert.equal(store.getRecord('client1', path).status, 'rejected'); // a note alone doesn't change status

  const trail = store.getAuditTrail('client1');
  assert.equal(trail.length, 5);
  assert.deepEqual(trail.map(e => e.action), ['accept', 'edit', 'mark-reviewed', 'reject', 'note']);
  assert.equal(trail[1].prevValue, 300000);
  assert.equal(trail[1].newValue, 310000);
});

test('review-store: records and audit trails are kept separate per client', () => {
  const store = freshStore();
  store.apply('clientA', 'p', 'accept', { by: 'x' });
  store.apply('clientB', 'p', 'reject', { by: 'y' });
  assert.equal(store.getRecord('clientA', 'p').status, 'accepted');
  assert.equal(store.getRecord('clientB', 'p').status, 'rejected');
  assert.equal(store.getAuditTrail('clientA').length, 1);
  assert.equal(store.getAuditTrail('clientB').length, 1);
});

test('review-store: exportAudit returns valid JSON of the audit trail', () => {
  const store = freshStore();
  store.apply('client1', 'p', 'accept', { by: 'x' });
  const parsed = JSON.parse(store.exportAudit('client1'));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].action, 'accept');
});

test('review-store: persists independently of the client draft key (does not touch state/filing JSON)', () => {
  const map = new Map();
  const backend = { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) };
  const store = new ReviewStore({ backend });
  store.apply('client1', 'p', 'accept', { by: 'x' });
  assert.ok(map.has('aoc4_review_client1'));
  assert.ok(!map.has('aoc4_draft_client1'));
});
