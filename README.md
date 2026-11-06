# AOC-4 Auto Filler

Chrome Extension that extracts data from a PDF and auto-fills the MCA AOC-4 form.

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

Copy `config.local.example.js` to `config.local.js` in the same folder and fill in the Sandbox API key and secret, an optional AI key, and the extension ID. The dashboard loads that file on start and uses it as the defaults in **Settings**, so nobody retypes credentials; anything saved in Settings afterwards wins over the file.

`config.local.js` is listed in `.gitignore` because it holds live credentials. Never commit it, and never paste its values into a chat, an issue or a screenshot. Use `https://api.sandbox.co.in` with `key_live_…` credentials and `https://test-api.sandbox.co.in` with `key_test_…` ones; the wrong pairing fails authentication.

## Prepare a client in the dashboard

Run `node server.js` from the `aoc4-autofiller/` folder, then open `http://127.0.0.1:5173/dashboard.html`. The local server serves the dashboard and proxies its narrow Sandbox authentication and CIN lookup requests, avoiding browser cross-origin blocks. It binds only to localhost and does not write API credentials to disk. The dashboard builds the client JSON the extension fills from:

1. **Sandbox lookup** — enter the CIN to pull company master data (name, registered office, capital, class, status, incorporation date). Set the Sandbox API key and secret in Settings, or in `config.local.js`. The lookup goes through this server's proxy to `POST /kyc/mca/company/master-data`, whose body is exactly `{"cin": "…"}`; the CIN is checked for its 21-character form before anything is sent. That endpoint takes a CIN or LLPIN only, so company-name search in the dashboard searches companies already saved in this browser.
2. **Data Entry** — fill the remaining fields. Pick the financial year and the dates, AGM due date, balance-sheet totals, net worth, PAT, EPS, detail rows and the opening share-capital row are derived (marked *auto*; edit any of them to override). The auditor block can be saved once as "My firm" and applied with one click; PIN codes look up area/city/district/state.
3. **Upload & AI** — add Excel workbooks, CSV, text-layer PDFs, Word documents, or a filed AOC-4 PDF/text dump. Choose **Extract values** to parse the documents locally; no AI key is needed for supported text and spreadsheet files. To also read scanned PDFs, save an Anthropic API key in Settings and enable **Also ask the AI model**. The review table shows each proposed value, its current form value, source, confidence, and source excerpt. Resolve highlighted disagreements between files or between document extraction and AI with **use that**, edit the proposed value, or leave the row unchecked. Nothing is sent to the extension until you select **Apply selected to the form**.
4. **Review & Send** — fix any errors, then **Send to extension**. The client is stored in the extension straight away, with no file to download and import. This needs the extension ID in Settings and the dashboard opened over `http://127.0.0.1` or `http://localhost`, the two origins the manifest allows to connect. **Settings → Chrome extension → Test connection** reports which part is missing. If the connection is unavailable the client is downloaded instead, and **Download client JSON** plus the popup's **Import JSON…** remain as the manual route.

## Use

1. Open the AOC-4 form on `www.mca.gov.in` and click the extension icon.
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
  css/styles.css
  js/
    pdf-extractor.js
    extractor.js
    field-mapper.js
    validator.js
    storage.js
  data/field-mappings.json
  libs/ (you add pdf.min.js + pdf.worker.min.js)
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
