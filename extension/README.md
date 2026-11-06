# Ledgerly MCA Chrome Extension

Manifest V3 Chrome extension that connects to the Ledgerly Next.js backend and assists admins in filling SPICe+ Part A forms on the MCA portal.

---

## Installation

### 1. Start Ledgerly backend

```bash
cd C:\Users\murali\Desktop\mca
npm run dev
```

Backend must be running at **http://localhost:3000**.

### 2. Load extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select `C:\Users\murali\Desktop\extenstion`
5. The **Ledgerly MCA Assistant** icon appears in the toolbar

---

## Configuration

No `.env` file needed in the extension — it always talks to `http://localhost:3000`.

### Backend environment (`C:\Users\murali\Desktop\mca\.env.local`)

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-only-change-in-prod-ba1f9a0e2c7d4e6b8a0f1c2d3e4f5a6b
```

These are already present. The extension token is signed with `NEXTAUTH_SECRET` — change it in production.

---

## Usage

1. In Chrome, go to `http://localhost:3000` and sign in (e.g. `priya@ledgerly.in` / `admin123`)
2. Click the extension icon
3. Click **Connect to Ledgerly** — the extension reads your session cookie and stores a 15-minute token
4. Select a **READY_FOR_PART_A** draft from the dropdown
5. Navigate to the MCA SPICe+ Part A form page
6. Click **Validate Fields** to preview what will be filled
7. Click **Fill MCA Form** — each field shows: ✓ filled · ○ skipped · ✗ invalid · ⚠ needs review
8. **Review every field** before proceeding — the extension does not submit the form

---

## API Endpoints Added to Ledgerly

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/extension/token` | Exchange NextAuth session cookie → 15-min extension JWT |
| GET  | `/api/extension/drafts` | List READY_FOR_PART_A drafts for the caller |
| GET  | `/api/extension/drafts/:id` | Get full draft detail |

All endpoints require prior Ledgerly authentication. The extension JWT is validated server-side on every request.

---

## Permissions & Why

| Permission | Reason |
|------------|--------|
| `storage` | Store session token in `chrome.storage.session` (cleared on browser close) |
| `activeTab` | Read current tab URL for page detection |
| `scripting` | Inject content script on demand if needed |
| `http://localhost:3000/*` | Communicate with Ledgerly backend |
| `https://www.mca.gov.in/*` | Fill fields on MCA portal via content script |

---

## Testing

### Demo form (offline — no MCA login needed)

1. Open `C:\Users\murali\Desktop\extenstion\demo\test-form.html` in Chrome
2. **Note:** Content scripts only run on `https://www.mca.gov.in/*`. For offline testing, open the test form at a local server URL. Quickest way:
   ```bash
   # In the extenstion folder:
   npx serve demo
   # Then open http://localhost:3000 equivalent — but this conflicts with Ledgerly.
   # Alternative: open the file via file:// and use scripting API manually, OR
   # serve on port 4000:
   npx -y serve demo -l 4000
   ```
   Then add `http://localhost:4000/*` to `host_permissions` in `manifest.json` for testing.
3. Click **Fill MCA Form** — should fill all matching fields and show the result log

### Live MCA portal

- Navigate to `https://www.mca.gov.in/` and open SPICe+ Part A
- MCA requires login + CAPTCHA — solve manually
- Extension will detect the page and fill supported fields only
- Any selector that doesn't exist will be reported as **skipped**

---

## Known Limitations

| Limitation | Notes |
|------------|-------|
| MCA portal selectors unverified | SPICe+ Part A is behind CAPTCHA/login. Selectors in `field-map.js` are best-effort. Update them after inspecting the live form. |
| CAPTCHA | Cannot and will not be automated. Admin must solve manually. |
| No auto-submit | By design. Admin must review and submit manually. |
| Name availability | Extension shows screening result from Ledgerly. Never claims availability based on unverified data. |
| 15-min token | Click **Connect** again after expiry — no automatic refresh (to avoid silent re-auth). |
| Localhost only | Extension is configured for `http://localhost:3000`. Update `LEDGERLY_BASE` in `api.js` and the manifest if deploying to a hosted URL. |
| Mock data | Ledgerly uses in-memory mock data. Changes don't persist across server restarts. |

---

## Updating MCA Selectors

When you have access to the live SPICe+ Part A form, inspect each field's `name` / `id` attribute and update `field-map.js`:

```js
{
  key: "proposedName1",
  label: "Proposed company name (1st choice)",
  selector: "input[name='THE_ACTUAL_NAME']",   // ← update this
  type: "text",
  dataKey: "proposedName1",
},
```

No other file needs to change.
