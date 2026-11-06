# Deploying admin/ + backend/ to Railway (MVP testing)

This repo is a clean code export (no PII, no secrets, no git history) meant for a manual testing
setup: enter a client's data in the admin dashboard, pull it into the Chrome extension, and run the
fill on mca.gov.in by hand.

## What goes where

- **`admin/`** — Next.js dashboard. This is what the extension calls "Ledgerly"
  (`extension/utils.js`'s `LEDGERLY_BASE`). This is "the dashboard" you manually enter client data into.
- **`backend/`** — Express service (WhatsApp intake, OCR, MCA lookups). Not required for the manual
  flow below, but deploy it too if you plan to exercise those routes.
- **`extension/`** — the Chrome extension. This is **not** deployed; it stays on your machine, loaded
  unpacked, and points at the deployed `admin/` URL.

## 1. Create two Railway services from this repo

In Railway: New Project → Deploy from GitHub repo → pick this repo, then repeat for a second service.
For each service, set **Settings → Root Directory**:

- Service 1: Root Directory `admin`, Railway auto-detects Next.js (Nixpacks) and runs `npm run build`
  / `npm run start`.
- Service 2: Root Directory `backend`, Nixpacks picks up `"start": "node src/server.js"` from
  `backend/package.json` automatically.

## 2. Environment variables

Set these in each service's **Variables** tab — never in a committed file. Templates are at
[`admin/.env.example`](admin/.env.example) and [`backend/.env.example`](backend/.env.example).

**admin/**
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` — the admin service's own Railway URL once assigned (e.g.
  `https://<admin-service>.up.railway.app`)

**backend/**
- `JWT_SECRET`, `EXTENSION_API_KEY` — generate real random values; the defaults in
  `backend/src/config/env.js` are dev-only placeholders and must not be used anywhere reachable
  from outside your machine
- Leave `WHATSAPP_MOCK_MODE=true` and the LLM keys (`GROQ_API_KEY` etc.) blank until you actually
  need those features — manual data entry doesn't need them
- Everything else in `backend/.env.example` can stay at its default for MVP testing

## 3. Known limitation: backend storage is not persistent

`backend/src/models/db.js` reads/writes a single JSON file (`backend/data/ledgerly_db.json`) and
`backend/uploads/documents/` on local disk. Railway's default filesystem is ephemeral — both reset on
every redeploy/restart. That's fine for short MVP test sessions; if you need data to survive restarts,
add a Railway Volume mounted at `backend/data` and `backend/uploads` (Settings → Volumes), or swap the
JSON file for a real database later.

## 4. Point the extension at the deployed admin

Once `admin/`'s Railway URL is live:

1. Open `extension/utils.js`, change `LEDGERLY_BASE` to that URL (it already has
   `https://*.up.railway.app/*` allowed in `extension/manifest.json`'s `host_permissions` and the
   `admin-bridge.js` content script's `matches`, so no manifest edit needed for a `*.up.railway.app`
   domain — only for a custom domain).
2. In `chrome://extensions`, Developer mode on → **Load unpacked** → pick `extension/` → reload after
   any edit.

## 5. Manual testing flow

1. Sign in to the deployed admin dashboard. Demo accounts are in
   [`admin/lib/mock-data.ts`](admin/lib/mock-data.ts) (e.g. `superadmin@ledgerly.in` / `super123`) —
   replace these before this is anything but a private MVP test.
2. Enter/approve a client draft in admin.
3. Open the extension popup on an `mca.gov.in` form tab, pull the draft (token exchange via
   `admin/app/api/extension/token` + `/drafts`), and click fill.
4. Check the popup's result summary / Activity log for what filled, what was skipped, and why.

## Security notes

- Nothing in this repo contains real client PII, uploaded documents, or API keys — those were
  deliberately excluded from this export. Keep it that way: don't commit anything under
  `backend/uploads/documents/` or `backend/data/*.json` (see `backend/.gitignore`), and don't commit a
  filled-in `.env`/`.env.local`.
- The admin login above uses mock, hardcoded demo passwords. Fine for an internal MVP test behind a
  private Railway URL; replace with real auth before sharing this more widely.
