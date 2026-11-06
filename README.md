# Germin8 dashboard

Clean code export of `dashboard/` from the real Germin8 project (main checkout, branch
`chrome-connector-murali-v2`) — the local dashboard that pairs with the Germin8 Chrome extension.
Plain Node, no build step.

This replaces the earlier content of this repo (an unrelated "Ledgerly" admin/backend prototype),
which has been removed.

## What's excluded (see `.gitignore`)

- `dashboard/config.local.js` — holds live credentials (Germin8 API gateway token). Copy
  `dashboard/config.local.example.js` to `dashboard/config.local.js` and fill in your own.
- `dashboard/clients/` — real client data (contains PAN, DIN and other PII). Never committed.
- `dashboard/data/app.db*` — local SQLite login/pairing-key database.
- `dashboard/libs/pdf.min.js`, `pdf.worker.js`, `pdf.worker.min.js` — large third-party binaries;
  see `dashboard/libs/README.txt` for where to get them.

## Run locally

```bash
cd dashboard
npm install
node server.js
```

Note: this checkout's `server.js` binds to `0.0.0.0` instead of `127.0.0.1` — that one line was
changed from the real local-dev checkout so Railway (or any host) can actually reach it. Everything
else is unmodified.

## Deploying to Railway

1. New service → Deploy from this GitHub repo → **Settings → Source → Root Directory** → `dashboard`.
2. No environment variables are required. The dashboard's Gateway credentials (`config.local.js` /
   the Settings panel) live in the browser and are sent per-request to this server's `/api/gateway`
   proxy — nothing server-side to configure. Railway injects `PORT` automatically and `server.js`
   already reads `process.env.PORT`.
3. **Settings → Networking → Generate Domain** for a public URL.
4. First visit redirects to `/login.html` and offers account setup (`needsSetup`) — create your admin
   account there; there's no seeded login.
5. **Storage is not persistent across redeploys.** `dashboard/data/app.db` (logins, pairing keys) and
   anything in `dashboard/clients/` (deliberately not included in this export — see below) live on
   local disk, which Railway resets on redeploy/restart. Add a Volume mounted at `dashboard/data` if
   you need accounts/pairing keys to survive a redeploy.
6. `dashboard/clients/` was excluded from this export (real client PAN/DIN/financial data — see
   `.gitignore`). The deployed dashboard starts with no clients; add them through the dashboard's own
   UI after it's live, the same way you would locally.
7. `node:sqlite` (used for login/sessions) needs a fairly recent Node — `dashboard/package.json` now
   pins `"engines": { "node": ">=22.13.0" }` so Railway's build should pick a Node version that has it
   without the old `--experimental-sqlite` flag. If the build log shows an error requiring that flag
   or failing to resolve `node:sqlite`, send me the exact error.
