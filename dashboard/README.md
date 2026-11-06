# AOC-4 Auto Filler

Chrome Extension that extracts data from a PDF and auto-fills the MCA AOC-4 form, and now also
SPICe+ Part A (Name Reservation) — see [SPICe+ Part A](#spice-part-a-name-reservation) below.

## Install

1. Download **PDF.js** build (two files) from https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/
   - `pdf.min.js`
   - `pdf.worker.min.js`
   Put both in `aoc4-autofiller/libs/`.
2. Open `chrome://extensions/`.
3. Toggle **Developer mode** on.
4. Click **Load unpacked** and pick the `aoc4-autofiller/` folder.
5. Copy the extension's **ID** from that page — the dashboard needs it to hand clients over directly.

## API keys and the extension ID

Copy `config.local.example.js` to `config.local.js` in the same folder and fill in the Gateway URL/token, an optional AI key, and the extension ID. The dashboard loads that file on start and uses it as the defaults in **Settings**, so nobody retypes credentials; anything saved in Settings afterwards wins over the file.

For AI extraction, either set `ai.key` for a direct Anthropic/OpenAI/Gemini key, or set `ai.provider` to `'gateway'` and fill in `gateway.url`/`gateway.token` to route Claude calls through the Germin8 API gateway instead — the real provider key then stays server-side and only the gateway's own scoped token reaches the browser. The same Gateway, regardless of `ai.provider`, is also what powers **Filesure** company master-data lookups (CIN → name, address, capital, directors) — Sandbox is no longer used for this. Get the gateway URL and token from Sumit.

`config.local.js` is listed in `.gitignore` because it holds live credentials. Never commit it, and never paste its values into a chat, an issue or a screenshot.

### Pairing key (optional, recommended)

`manifest.json`'s `externally_connectable` trusts *any* page served from `http://localhost`/`http://127.0.0.1`, not just this Dashboard — so without a pairing key, another local page could in principle hand the extension a client. Generate one in the extension popup (**Settings → Security → Generate key**), copy it, and paste the same value into the Dashboard's **Settings → Extension → Pairing key**. Once generated, `background.js` rejects any `importClient` call whose key doesn't match; until you generate one, nothing changes — existing setups keep working exactly as before.

## Prepare a client in the dashboard

Run `node server.js` from the `aoc4-autofiller/` folder, then open `http://127.0.0.1:5173/dashboard.html`. The local server serves the dashboard and proxies its Gateway requests, avoiding browser cross-origin blocks. It binds only to localhost and does not write API credentials to disk. The dashboard builds the client JSON the extension fills from:

1. **Filesure lookup** — enter the CIN to pull company master data (name, registered office, capital, class, status, incorporation date, directors). Set the Gateway URL and token in Settings → AI extraction, or in `config.local.js`. The lookup goes through this server's `/api/gateway` proxy to the Germin8 Gateway's `filesure-company` route, body `{"cin": "…"}`; the CIN is checked for its 21-character form before anything is sent. That endpoint takes a CIN only, so company-name search in the dashboard searches companies already saved in this browser.
2. **Data Entry** — fill the remaining fields. The form is grouped into collapsible cards (company, dates, signatories, auditor, industry and the statements) with a client summary and completeness rail beside it; the bar at the top jumps to a card, and **Search fields** (<kbd>Ctrl</kbd>+<kbd>K</kbd>) filters every field. Pick the financial year and the dates, AGM due date, balance-sheet totals, net worth, PAT, EPS, detail rows and the opening share-capital row are derived (marked *auto*; edit any of them to override). The auditor block can be saved once as "My firm" and applied with one click; PIN codes look up area/city/district/state.
3. **Upload & AI** — add Excel workbooks, CSV, text-layer PDFs, Word documents, or a filed AOC-4 PDF/text dump. Choose **Extract values** to parse the documents locally; no AI key is needed for supported text and spreadsheet files. To also read scanned PDFs, save an Anthropic API key in Settings and enable **Also ask the AI model**. The review table shows each proposed value, its current form value, source, confidence, and source excerpt. Resolve highlighted disagreements between files or between document extraction and AI with **use that**, edit the proposed value, or leave the row unchecked. Nothing is sent to the extension until you select **Apply selected to the form**.
4. **Review & Send** — fix any errors, then **Send to extension**. The client is stored in the extension straight away, with no file to download and import. This needs the extension ID in Settings and the dashboard opened over `http://127.0.0.1` or `http://localhost`, the two origins the manifest allows to connect. **Settings → Chrome extension → Test connection** reports which part is missing. If the connection is unavailable the client is downloaded instead, and **Download client JSON** plus the popup's **Import JSON…** remain as the manual route.

## AOC-4 Online vs. AOC-4 Offline

MCA offers two filing modes for AOC-4, not one — this extension automates **AOC-4 Online** (the whole form, filled directly in the browser with real-time auto-population). **AOC-4 Offline** instead has you fill basic details online, then MCA generates a per-filing Excel workbook you complete and upload back; the extension does not yet fill that Excel (see `AOC4_Validations_FY2025-26.md` for the cell-level map already worked out, and the SPICe+ Part A section below for the same "not built yet" treatment of its Excel-fill feature). The Dashboard's Form dropdown offers both modes — they share the exact same Data Entry/Filesure lookup/Upload & AI panels and client data, since both need the same company details, dates, signatories and statements; only Review & Send differs.

## Use

1. Open the AOC-4 Online form on `www.mca.gov.in` and click the extension icon.
2. Choose a client (bundled, or one imported from the dashboard) and click **Load & Fill All Phases**. The fill runs in a separate small **fill window**: Chrome closes the toolbar popup (and the run with it) the moment you click the MCA page, so the popup only hands over. Keep the fill window open; you can scroll and click on the MCA tab meanwhile.
3. The run fills Phases 1–7 in order, clicking each section's Save and waiting for MCA's confirmation before moving on.
   - Part A (Q1–12) has a single Save button that validates all of it, so Phase 1 only fills and Part A is saved once after Phase 2.
   - The signatory **designations** belong to MCA's DIN lookup: whatever MCA selects is kept (even if the client file says otherwise), they are never unlocked or retried, and an empty one is set quietly through the form model.
   - **The fill only does what a person at the keyboard does.** The MCA form is an AEM Adaptive Form, and its Save handler stops working for the rest of the page's life once one of MCA's own scripts throws — after which neither the extension nor a human click does anything. So the extension never dispatches AEM's internal events (`guideValueChanged` and its siblings), never calls the form model's `validate()`, never asks `guideBridge` to validate the whole form, and never rewrites a model value that is already correct. It reads the model's verdict instead of provoking one. If a page is already in that stuck state from an earlier run, reload the AOC-4 form before filling again.
   - Before every field and every Save, the extension waits while MCA is loading, busy with a server request, or showing a popup (popups are answered with OK/Continue, destructive ones are declined; native alerts are captured and logged). A busy page is waited on for up to 2 minutes; a server error page stops the run with instructions.
   - After clicking Save it waits for MCA's confirmation dialog and closes it. If no confirmation appears, Save is clicked once more.
   - Fields that could not be filled, slow MCA lookups (CIN, ADT-1 SRN) and sections whose Save MCA rejected do not stop the run: the remaining sections are still filled, every rejected Save is clicked once more at the end, and the final message lists what MCA still refuses, with MCA's own validation texts.
4. Turn on **Show preview before fill** to review the data first; **Confirm & Fill** then starts the fill window.
5. If MCA does not expose the next section, the run pauses and selects that phase. Open the section on MCA and click **Fill Form** (in the fill window or the popup) to resume from it.
6. **Debug → Diagnose Save** inspects the Save buttons, overlays, form-model errors and recent script errors on the MCA page; **Test Save (selected phase)** runs only the Save step and shows the full result (including any script error MCA's page throws, with file and line). **Logs** shows the latest 100 local actions; **PDF** extracts PDF text for reference only.

## Files

```
aoc4-autofiller/
  manifest.json
  server.js                  (dashboard host + Sandbox proxy: node server.js)
  config.local.example.js    (copy to config.local.js — git-ignored, holds the keys)
  popup.html
  popup.js
  js/page-automation.js
  js/phase-runner.js
  content_script.js
  background.js
  dashboard.html
  js/dashboard.js
  css/dashboard.css         (dashboard design system)
  css/styles.css            (popup)
  js/
    pdf-extractor.js
    extractor.js
    field-mapper.js
    validator.js
    storage.js
  data/field-mappings.json
  libs/ (you add pdf.min.js + pdf.worker.min.js)

  js/spice-a-shared.js        (name/NIC validation — shared by dashboard.js and the popup)
  js/spice-a-field-mapper.js  (field list for the extension's fill engine)
  js/spice-a-automation.js    (page-side fill / Auto Check / diagnose)
  js/spice-a-runner.js        (orchestration)
```

The dashboard uses the bundled PDF.js files for PDF text extraction. Scanned PDFs require the optional Anthropic path; the local extractor cannot read image-only pages. Keep the uploaded files available in the browser until extraction and review are complete.

## Notes

- Patterns in `js/field-mapper.js` are regex-based. Tune `pattern:` strings to your real PDF layout.
- Form selectors assume `aria-label` text on MCA inputs. If MCA updates markup, update `selector:`.
- Values go through the React/Angular-safe native setter, so inputs register the change.
- **Click each section's Save and continue** is on by default; untick it to fill the selected phase only, without saving.
- Client JSON is stored with the extension and locally in Chrome storage. The extension has no separate backend; it enters values into the MCA page you open.

## Debug

- Right-click the popup → **Inspect** for popup logs.
- On the MCA tab, DevTools console shows content-script errors.
- `chrome://extensions/` → **service worker** opens background logs.

## SPICe+ Part A (Name Reservation)

A second, self-contained section for Form No. SPICe+ Part A (Rule 8 & 9, Companies (Incorporation)
Rules, 2014 — see `Instruction Kit_SPICe+Part A.pdf`). It reuses this extension and dashboard but
has its own dashboard page, client shape and fill engine, since the two MCA forms share nothing
beyond "fill a form on mca.gov.in":

- **Dashboard** — lives in the *same* `dashboard.html` / `js/dashboard.js` as AOC-4, not a
  separate page. The **Form** dropdown under the logo now has three options — "AOC-4 Online",
  "AOC-4 Offline", "SPICe+ Part A (Name Reservation)" — and swaps the sidebar's client-box and nav,
  and the content panels, in place; nothing about the AOC-4 UI changes when another option is
  picked. SPICe+ Part A has the same 4-step nav as AOC-4 (Data Entry → Sandbox lookup → Upload &
  AI → Review & Send): Data Entry covers type of company, LLPIN, up to three NIC codes and proposed
  name 1/2; Sandbox lookup (optional) reuses the same CIN master-data fetch as AOC-4, useful for a
  name-change filing on an existing CIN; Upload & AI keeps the optional-attachments uploader (AI
  extraction itself is not built for this form yet — see below). It has its own client ("+ New" /
  "Import JSON…", separate from AOC-4's client list) and its own draft autosave — the existing
  Settings modal (extension id, pairing key, etc.) is shared. Validation follows the Instruction
  Kit literally: 75-character limit, ASCII only, Annexure B's allowed special characters, the
  banned "Pvt"/"(P)"/"Ltd" abbreviations, and a soft check that the name's ending matches the
  illustrative form for the chosen company type (§3.1, point v).
- **Extension popup** — the same idea, same place: the **Form** dropdown there switches between
  "AOC-4 Online" and "SPICe+ Part A (Name Reservation)" panels (AOC-4 Offline has no extra
  automation yet, so it isn't a separate option here — its Data Entry is prepared in the Dashboard
  and sent to the extension the same way as AOC-4 Online's). The SPICe+ Part A panel has its own
  client picker (clients sent from the Dashboard or imported as JSON, stored separately from
  AOC-4 clients) and a **Load & Fill SPICe+ Part A** button.
- **Fill engine** — `js/spice-a-field-mapper.js`, `js/spice-a-automation.js`, `js/spice-a-runner.js`.
  Unlike AOC-4's field-mapper (which needs MCA's generated `name` attributes for repeated table
  rows), SPICe+ Part A fields are matched **by label text** — the same technique
  `content_script.js`'s scanner already uses (aria-label, then placeholder, then `<label for>`,
  then the nearest row's text). This is simpler and more resilient for a short, non-repeating
  form, but it is still a best-effort guess at MCA's live wording: if a field is not found, use
  **Settings → Debug tools → Diagnose SPICe+ Part A** (and **Scan Form Fields**, which works on
  any mca.gov.in tab) to read the live labels and tune `labelRe` in `spice-a-field-mapper.js`.
- **Auto Check vs Submit** — the extension can click **Auto Check** (non-committal, just runs
  MCA's validation) but **never clicks Submit**, since that is the step that generates an SRN and
  starts the fee clock. Review the filled page on MCA, then submit yourself.
- **NIC code selection** — typed into the matching field, with a best-effort attempt to pick a
  matching entry from whatever suggestion list MCA shows; if none is found the code is left typed
  for you to confirm on the page.
- **Attachments** — the dashboard stores optional attachments (PDF/JPG, ≤2 MB each, up to 5) with
  the client record and offers a one-click download, but does not try to inject them into MCA's
  file inputs; attach them yourself, the same way you would without this tool.

This section has been checked against the Instruction Kit's text and exercised in the dashboard;
like the rest of this extension, it has not been run against the live SPICe+ Part A page, so
confirm field placement with Diagnose/Scan before relying on it for a real filing.
