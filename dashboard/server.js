// Local dashboard server with a generic Gateway proxy, and a local login/roles system.
// Credentials stay in the browser and are forwarded only to the Gateway over HTTPS.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const auth = require('./js/auth-db.js');
const classificationLookup = require('./js/classification-lookup.js');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5173;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.pdf': 'application/pdf'
};
const SESSION_COOKIE = 'aoc4_sid';

function readCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setSessionCookie(res, sid) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}
function getAuth(req) {
  const sid = readCookies(req)[SESSION_COOKIE];
  return auth.getSession(sid);
}
function hasPerm(session, perm) { return !!session && session.permissions.includes(perm); }
async function readJsonBody(req, limit = 1024 * 1024) {
  const raw = await readBody(req, limit);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { throw new Error('Invalid JSON body.'); }
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (body.length > limit) { reject(new Error('Request body too large')); req.destroy(); }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function send(res, status, body, contentType = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

// The Germin8 Gateway's CORS policy only allows requests from https://www.mca.gov.in (it was built
// for the extension's content script, which runs on that origin) — a browser calling it directly
// from this dashboard's own origin gets blocked with "Failed to fetch" before any response even
// arrives. This proxy sidesteps that: the browser calls same-origin (no CORS involved), and this
// server makes the real request to the gateway itself (server-to-server requests aren't subject to
// CORS at all).
async function proxyGateway(req, res) {
  let payload;
  try { payload = JSON.parse(await readBody(req, 30 * 1024 * 1024)); }
  catch (e) { return send(res, 400, JSON.stringify({ error: 'Invalid JSON body.' })); }
  const { url, token, body } = payload || {};
  if (!url) return send(res, 400, JSON.stringify({ error: 'Gateway URL is required.' }));
  if (!token) return send(res, 400, JSON.stringify({ error: 'Gateway token is required.' }));
  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const text = await upstream.text();
    send(res, upstream.status, text || '{}', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  } catch (error) {
    send(res, 502, JSON.stringify({ error: `Could not reach the Gateway: ${error.message}` }));
  }
}

// ─── Auth / admin / pairing-key API ───
async function handleApi(req, res, pathname, session, searchParams) {
  const need = (ok, msg) => { if (!ok) { send(res, ok === false ? 403 : 401, JSON.stringify({ error: msg })); return false; } return true; };

  if (pathname === '/api/auth/status' && req.method === 'GET') {
    return send(res, 200, JSON.stringify({ needsSetup: auth.needsSetup(), user: session?.user || null, permissions: session?.permissions || [] }));
  }
  if (pathname === '/api/auth/setup' && req.method === 'POST') {
    if (!auth.needsSetup()) return send(res, 400, JSON.stringify({ error: 'Setup already completed — log in instead.' }));
    try {
      const { username, password } = await readJsonBody(req);
      const user = auth.createSuperAdmin(username, password);
      const sid = auth.createSession(user.id);
      setSessionCookie(res, sid);
      return send(res, 200, JSON.stringify({ ok: true, user }));
    } catch (e) { return send(res, 400, JSON.stringify({ error: e.message })); }
  }
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const { username, password } = await readJsonBody(req);
      const user = auth.verifyLogin(username, password);
      if (!user) return send(res, 401, JSON.stringify({ error: 'Wrong username or password.' }));
      const sid = auth.createSession(user.id);
      setSessionCookie(res, sid);
      return send(res, 200, JSON.stringify({ ok: true, user }));
    } catch (e) { return send(res, 400, JSON.stringify({ error: e.message })); }
  }
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    auth.destroySession(readCookies(req)[SESSION_COOKIE]);
    clearSessionCookie(res);
    return send(res, 200, JSON.stringify({ ok: true }));
  }

  // Everything below requires a logged-in user.
  if (!need(!!session, 'Not logged in.')) return;

  if (pathname === '/api/keys' && req.method === 'GET') {
    const all = hasPerm(session, 'keys.manage_all');
    return send(res, 200, JSON.stringify({ keys: auth.listKeys({ userId: session.user.id, all }) }));
  }
  if (pathname === '/api/keys' && req.method === 'POST') {
    if (!need(hasPerm(session, 'keys.generate'), 'You do not have permission to generate keys.')) return;
    try {
      const { label } = await readJsonBody(req);
      return send(res, 200, JSON.stringify({ key: auth.generateKey(session.user.id, label) }));
    } catch (e) { return send(res, 400, JSON.stringify({ error: e.message })); }
  }
  const keyIdMatch = pathname.match(/^\/api\/keys\/(\d+)$/);
  if (keyIdMatch && req.method === 'DELETE') {
    try {
      auth.revokeKey(Number(keyIdMatch[1]), { userId: session.user.id, canManageAll: hasPerm(session, 'keys.manage_all') });
      return send(res, 200, JSON.stringify({ ok: true }));
    } catch (e) { return send(res, 400, JSON.stringify({ error: e.message })); }
  }

  // Admin: users & roles — super admin / anyone with users.manage only.
  if (pathname.startsWith('/api/admin/')) {
    if (!need(hasPerm(session, 'users.manage'), 'You do not have permission to manage users.')) return;

    if (pathname === '/api/admin/users' && req.method === 'GET') return send(res, 200, JSON.stringify({ users: auth.listUsers() }));
    if (pathname === '/api/admin/users' && req.method === 'POST') {
      try {
        const { username, password, roleId } = await readJsonBody(req);
        const user = auth.createUser({ username, password, roleId, createdBy: session.user.id });
        return send(res, 200, JSON.stringify({ user }));
      } catch (e) { return send(res, 400, JSON.stringify({ error: e.message })); }
    }
    const userIdMatch = pathname.match(/^\/api\/admin\/users\/(\d+)$/);
    if (userIdMatch && req.method === 'PATCH') {
      try {
        const body = await readJsonBody(req);
        const user = auth.updateUser(Number(userIdMatch[1]), body);
        return send(res, 200, JSON.stringify({ user }));
      } catch (e) { return send(res, 400, JSON.stringify({ error: e.message })); }
    }
    if (pathname === '/api/admin/roles' && req.method === 'GET') {
      return send(res, 200, JSON.stringify({ roles: auth.listRoles(), permissions: auth.PERMISSIONS }));
    }
    if (pathname === '/api/admin/roles' && req.method === 'POST') {
      try {
        const { name, permissions } = await readJsonBody(req);
        return send(res, 200, JSON.stringify({ role: auth.createRole({ name, permissions }) }));
      } catch (e) { return send(res, 400, JSON.stringify({ error: e.message })); }
    }
    const roleIdMatch = pathname.match(/^\/api\/admin\/roles\/(\d+)$/);
    if (roleIdMatch && req.method === 'PATCH') {
      try {
        const { permissions } = await readJsonBody(req);
        return send(res, 200, JSON.stringify({ role: auth.updateRolePermissions(Number(roleIdMatch[1]), permissions) }));
      } catch (e) { return send(res, 400, JSON.stringify({ error: e.message })); }
    }
  }

  // Classification reference database — read-only lookups grounding AI-suggested ITC/NPCS codes.
  if (pathname.startsWith('/api/aoc4/classification/')) {
    if (!need(hasPerm(session, 'ai.use'), 'You do not have permission to use AI classification.')) return;

    if (pathname === '/api/aoc4/classification/search' && req.method === 'GET') {
      const scheme = String(searchParams.get('scheme') || '').toUpperCase();
      if (!['NPCS', 'ITC'].includes(scheme)) return send(res, 400, JSON.stringify({ error: 'scheme must be NPCS or ITC.' }));
      const q = searchParams.get('q') || '';
      const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);
      const parentCode = searchParams.get('parentCode') || undefined;
      try {
        return send(res, 200, JSON.stringify({ results: classificationLookup.searchByText(scheme, q, { limit, parentCode }) }));
      } catch (e) { return send(res, 400, JSON.stringify({ error: e.message })); }
    }
    const codeMatch = pathname.match(/^\/api\/aoc4\/classification\/code\/(NPCS|ITC)\/(\d{4,8})$/i);
    if (codeMatch && req.method === 'GET') {
      const scheme = codeMatch[1].toUpperCase();
      const result = classificationLookup.getByCode(scheme, codeMatch[2]);
      if (!result) return send(res, 404, JSON.stringify({ error: 'Code not found.' }));
      return send(res, 200, JSON.stringify(result));
    }
  }

  return send(res, 404, JSON.stringify({ error: 'Unknown API route.' }));
}

const PUBLIC_PAGES = new Set(['/login.html']);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const session = getAuth(req);

  if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/admin/') || url.pathname.startsWith('/api/keys') || url.pathname.startsWith('/api/aoc4/')) {
    try { await handleApi(req, res, url.pathname, session, url.searchParams); }
    catch (error) { if (!res.headersSent) send(res, 500, JSON.stringify({ error: error.message })); }
    return;
  }
  if (url.pathname === '/api/gateway' && req.method === 'POST') {
    if (!session) return send(res, 401, JSON.stringify({ error: 'Log in to the dashboard first.' }));
    try { await proxyGateway(req, res); }
    catch (error) { if (!res.headersSent) send(res, 400, JSON.stringify({ error: error.message })); }
    return;
  }

  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch (_) { return send(res, 400, 'Bad path', 'text/plain'); }
  if (pathname === '/') pathname = '/dashboard.html';
  const isHtmlPage = pathname.endsWith('.html');
  if (isHtmlPage && !PUBLIC_PAGES.has(pathname) && !session) {
    res.writeHead(302, { Location: '/login.html', 'Cache-Control': 'no-store' });
    return res.end();
  }
  const file = path.resolve(ROOT, `.${pathname}`);
  if (!file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (error, data) => {
    if (error) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    // No caching. Without this the browser decides for itself how long to keep dashboard.js, and
    // an edit to the app silently has no effect until a hard reload — which looked like the app
    // still having a bug that was already fixed.
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(data);
  });
});

// Bound to 127.0.0.1 only in the real local-dev checkout, on purpose (local-only tool).
// This deploy copy binds to all interfaces so Railway's proxy can actually reach it.
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => console.log(`AOC-4 Dashboard listening on ${HOST}:${PORT}`));
