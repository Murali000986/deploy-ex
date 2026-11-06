// Local auth store for the dashboard: users, roles/permissions, sessions, dashboard↔extension
// pairing keys. SQLite via Node's built-in node:sqlite (no npm install needed). Server-side only
// (required from server.js) — never loaded in the browser.
'use strict';
const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DB_DIR, 'app.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    permissions TEXT NOT NULL,
    is_system INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    created_by INTEGER
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pairing_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_value TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id),
    label TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    last_used_at INTEGER,
    revoked INTEGER NOT NULL DEFAULT 0
  );
`);

const PERMISSIONS = [
  { key: 'clients.view', label: 'View clients' },
  { key: 'clients.edit', label: 'Edit client data' },
  { key: 'clients.send', label: 'Send clients to the extension' },
  { key: 'sandbox.use', label: 'Use Sandbox MCA lookup' },
  { key: 'ai.use', label: 'Use AI document extraction' },
  { key: 'keys.generate', label: 'Generate own pairing keys' },
  { key: 'keys.manage_all', label: "Manage everyone's pairing keys" },
  { key: 'users.manage', label: 'Manage users and roles (admin)' }
];
const ALL_PERMISSION_KEYS = PERMISSIONS.map(p => p.key);
const STAFF_PERMISSIONS = ['clients.view', 'clients.edit', 'clients.send', 'sandbox.use', 'ai.use', 'keys.generate'];

function ensureSeedRoles() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM roles').get();
  if (row.n > 0) return;
  db.prepare('INSERT INTO roles (name, permissions, is_system) VALUES (?, ?, 1)')
    .run('Super Admin', JSON.stringify(ALL_PERMISSION_KEYS));
  db.prepare('INSERT INTO roles (name, permissions, is_system) VALUES (?, ?, 1)')
    .run('Staff', JSON.stringify(STAFF_PERMISSIONS));
}
ensureSeedRoles();

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [scheme, salt, hashHex] = String(stored || '').split(':');
  if (scheme !== 'scrypt' || !salt || !hashHex) return false;
  const check = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hashHex, 'hex');
  if (check.length !== expected.length) return false;
  return crypto.timingSafeEqual(check, expected);
}

function needsSetup() {
  return db.prepare('SELECT COUNT(*) AS n FROM users').get().n === 0;
}

function roleById(id) { return db.prepare('SELECT * FROM roles WHERE id = ?').get(id); }
function roleRow(r) { return r && { id: r.id, name: r.name, permissions: JSON.parse(r.permissions), isSystem: !!r.is_system }; }
function listRoles() { return db.prepare('SELECT * FROM roles ORDER BY id').all().map(roleRow); }
function createRole({ name, permissions }) {
  name = String(name || '').trim();
  if (!name) throw new Error('Role name is required.');
  const perms = (Array.isArray(permissions) ? permissions : []).filter(p => ALL_PERMISSION_KEYS.includes(p));
  const info = db.prepare('INSERT INTO roles (name, permissions, is_system) VALUES (?, ?, 0)').run(name, JSON.stringify(perms));
  return roleRow(roleById(Number(info.lastInsertRowid)));
}
function updateRolePermissions(id, permissions) {
  const role = roleById(id);
  if (!role) throw new Error('Role not found.');
  if (role.is_system) throw new Error('Built-in roles cannot be edited.');
  const perms = (Array.isArray(permissions) ? permissions : []).filter(p => ALL_PERMISSION_KEYS.includes(p));
  db.prepare('UPDATE roles SET permissions = ? WHERE id = ?').run(JSON.stringify(perms), id);
  return roleRow(roleById(id));
}

function userRow(u) {
  if (!u) return null;
  const role = roleRow(roleById(u.role_id));
  return { id: u.id, username: u.username, active: !!u.active, createdAt: u.created_at, role };
}
function listUsers() { return db.prepare('SELECT * FROM users ORDER BY id').all().map(userRow); }
function userByUsername(username) { return db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim().toLowerCase()); }
function userById(id) { return db.prepare('SELECT * FROM users WHERE id = ?').get(id); }

function createSuperAdmin(username, password) {
  if (!needsSetup()) throw new Error('Setup has already been completed.');
  if (!username || !password || password.length < 8) throw new Error('Username and an 8+ character password are required.');
  const superAdminRole = db.prepare('SELECT * FROM roles WHERE name = ?').get('Super Admin');
  const info = db.prepare('INSERT INTO users (username, password_hash, role_id, active, created_at) VALUES (?, ?, ?, 1, ?)')
    .run(username.trim().toLowerCase(), hashPassword(password), superAdminRole.id, Date.now());
  return userRow(userById(Number(info.lastInsertRowid)));
}

function createUser({ username, password, roleId, createdBy }) {
  username = String(username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error('Username must be 3-40 characters: letters, numbers, dot, dash, underscore.');
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');
  if (userByUsername(username)) throw new Error('That username is already taken.');
  const role = roleById(roleId);
  if (!role) throw new Error('Unknown role.');
  const info = db.prepare('INSERT INTO users (username, password_hash, role_id, active, created_at, created_by) VALUES (?, ?, ?, 1, ?, ?)')
    .run(username, hashPassword(password), role.id, Date.now(), createdBy || null);
  return userRow(userById(Number(info.lastInsertRowid)));
}

function updateUser(id, { active, roleId, password }) {
  const u = userById(id);
  if (!u) throw new Error('User not found.');
  if (typeof active === 'boolean') db.prepare('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, id);
  if (roleId != null) {
    if (!roleById(roleId)) throw new Error('Unknown role.');
    db.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(roleId, id);
  }
  if (password) {
    if (password.length < 8) throw new Error('Password must be at least 8 characters.');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), id);
  }
  return userRow(userById(id));
}

function verifyLogin(username, password) {
  const u = userByUsername(username);
  if (!u || !u.active) return null;
  if (!verifyPassword(password, u.password_hash)) return null;
  return userRow(u);
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
function createSession(userId) {
  const id = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(id, userId, now, now + SESSION_TTL_MS);
  return id;
}
function getSession(sid) {
  if (!sid) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
  if (!row || row.expires_at < Date.now()) return null;
  const user = userById(row.user_id);
  if (!user || !user.active) return null;
  return { user: userRow(user), permissions: roleRow(roleById(user.role_id)).permissions };
}
function destroySession(sid) { if (sid) db.prepare('DELETE FROM sessions WHERE id = ?').run(sid); }

function keyRow(k) { return k && { id: k.id, key: k.key_value, userId: k.user_id, label: k.label, createdAt: k.created_at, lastUsedAt: k.last_used_at, revoked: !!k.revoked }; }
function listKeys({ userId, all }) {
  const rows = all ? db.prepare('SELECT * FROM pairing_keys ORDER BY id DESC').all()
    : db.prepare('SELECT * FROM pairing_keys WHERE user_id = ? ORDER BY id DESC').all(userId);
  return rows.map(keyRow);
}
function generateKey(userId, label) {
  const key = `pk_${crypto.randomBytes(24).toString('base64url')}`;
  const info = db.prepare('INSERT INTO pairing_keys (key_value, user_id, label, created_at) VALUES (?, ?, ?, ?)')
    .run(key, userId, String(label || '').trim().slice(0, 80), Date.now());
  return keyRow(db.prepare('SELECT * FROM pairing_keys WHERE id = ?').get(Number(info.lastInsertRowid)));
}
function revokeKey(id, { userId, canManageAll }) {
  const row = db.prepare('SELECT * FROM pairing_keys WHERE id = ?').get(id);
  if (!row) throw new Error('Key not found.');
  if (row.user_id !== userId && !canManageAll) throw new Error('Not your key.');
  db.prepare('UPDATE pairing_keys SET revoked = 1 WHERE id = ?').run(id);
}

module.exports = {
  PERMISSIONS, ALL_PERMISSION_KEYS,
  needsSetup, createSuperAdmin, verifyLogin,
  createSession, getSession, destroySession,
  listUsers, createUser, updateUser,
  listRoles, createRole, updateRolePermissions,
  listKeys, generateKey, revokeKey
};
