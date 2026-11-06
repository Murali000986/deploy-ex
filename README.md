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
