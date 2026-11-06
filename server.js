// Local dashboard server with a narrow Sandbox API proxy.
// Credentials stay in the browser and are forwarded only to Sandbox over HTTPS.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5173;
const SANDBOX_HOSTS = {
  test: 'https://test-api.sandbox.co.in',
  production: 'https://api.sandbox.co.in'
};
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.pdf': 'application/pdf'
};

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

async function proxySandbox(req, res, pathname) {
  const env = req.headers['x-sandbox-environment'] === 'test' ? 'test' : 'production';
  const base = SANDBOX_HOSTS[env];
  const apiKey = String(req.headers['x-api-key'] || '').trim();
  if (!apiKey) return send(res, 400, JSON.stringify({ error: 'Sandbox API key is required.' }));

  const headers = { accept: 'application/json', 'x-api-key': apiKey };
  const version = String(req.headers['x-api-version'] || '').trim();
  if (version) headers['x-api-version'] = version;
  let body;

  if (pathname === '/api/sandbox/authenticate' && req.method === 'POST') {
    const secret = String(req.headers['x-api-secret'] || '').trim();
    if (!secret) return send(res, 400, JSON.stringify({ error: 'Sandbox API secret is required.' }));
    headers['x-api-secret'] = secret;
  } else if (pathname === '/api/sandbox/mca/company-master-data' && req.method === 'POST') {
    const token = String(req.headers.authorization || '').trim();
    if (!token) return send(res, 400, JSON.stringify({ error: 'Sandbox access token is required.' }));
    headers.authorization = token;
    headers['content-type'] = 'application/json';
    body = await readBody(req);
  } else {
    return send(res, 404, JSON.stringify({ error: 'Unknown Sandbox proxy route.' }));
  }

  try {
    // Sandbox's MCA endpoints live under /kyc/. The CIN lookup is /kyc/mca/company/master-data;
    // there is no /search variant, and the un-prefixed path answers 404.
    const endpoint = pathname.endsWith('/authenticate')
      ? `${base}/authenticate`
      : `${base}/kyc/mca/company/master-data`;
    const upstream = await fetch(endpoint, { method: 'POST', headers, body });
    const payload = await upstream.text();
    send(res, upstream.status, payload || '{}', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  } catch (error) {
    send(res, 502, JSON.stringify({ error: `Could not reach Sandbox: ${error.message}` }));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  if (url.pathname.startsWith('/api/sandbox/')) {
    try { await proxySandbox(req, res, url.pathname); }
    catch (error) { if (!res.headersSent) send(res, 400, JSON.stringify({ error: error.message })); }
    return;
  }

  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch (_) { return send(res, 400, 'Bad path', 'text/plain'); }
  if (pathname === '/') pathname = '/dashboard.html';
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

server.listen(PORT, '127.0.0.1', () => console.log(`AOC-4 Dashboard: http://127.0.0.1:${PORT}/dashboard.html`));
