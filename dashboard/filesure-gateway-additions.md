# Filesure Gateway — code for the 11 missing routes

Paste these `case` blocks into the same `switch (route)` (or `if/else` chain) that already
handles `filesure-resolve`, `filesure-company`, `filesure-filings`, `filesure-director-resolve`
and `filesure-director` in the Supabase Edge Function.

**Before using this:** open the existing `filesure-company` case and copy from it:
- the exact Filesure base URL (`FILESURE_BASE_URL` below is a guess — replace with whatever
  `filesure-company` actually calls)
- how the Filesure API key is read (env var name) and sent (header name/format)
- how errors from Filesure are turned into the gateway's JSON error shape

Everything else below follows the same shape as those 5 working routes, so it should drop in
cleanly once those three details are copied over correctly.

```ts
// Adjust to match whatever filesure-company/filesure-resolve already use.
const FILESURE_BASE_URL = "https://api.filesure.in/v1"; // <-- CONFIRM against the working routes
const FILESURE_API_KEY = Deno.env.get("FILESURE_API_KEY")!; // <-- CONFIRM the env var name

async function filesureFetch(path: string, init: RequestInit = {}) {
  const resp = await fetch(`${FILESURE_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${FILESURE_API_KEY}`, // <-- CONFIRM header name/format
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await resp.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!resp.ok) {
    throw new Error(
      (data as any)?.error || (data as any)?.message || `Filesure ${resp.status}`,
    );
  }
  return data;
}

switch (route) {
  // ── existing, working routes stay as they are ──
  // case "filesure-resolve": ...
  // case "filesure-company": ...
  // case "filesure-filings": ...
  // case "filesure-director-resolve": ...
  // case "filesure-director": ...

  // ── new routes below ──

  case "filesure-companies-update": {
    const { cin } = body;
    if (!cin) return jsonError(400, "cin is required");
    const data = await filesureFetch(`/companies/${cin}/refresh`, { method: "POST" });
    return jsonOk(data);
  }

  case "filesure-companies-unlock": {
    const { cin } = body;
    if (!cin) return jsonError(400, "cin is required");
    const data = await filesureFetch(`/companies/${cin}/unlock`, { method: "POST" });
    return jsonOk(data);
  }

  case "filesure-filings-refresh": {
    const { cin } = body;
    if (!cin) return jsonError(400, "cin is required");
    const data = await filesureFetch(`/companies/${cin}/filings/refresh`, { method: "POST" });
    return jsonOk(data);
  }

  case "filesure-filings-download": {
    const { cin, filingId } = body;
    if (!cin || !filingId) return jsonError(400, "cin and filingId are required");
    const data = await filesureFetch(`/companies/${cin}/filings/${filingId}/download`);
    return jsonOk(data);
  }

  case "filesure-documents-fetch": {
    const { cin, documentId } = body;
    if (!cin || !documentId) return jsonError(400, "cin and documentId are required");
    const data = await filesureFetch(`/companies/${cin}/documents/${documentId}`);
    return jsonOk(data);
  }

  case "filesure-extractions-years": {
    const { cin } = body;
    if (!cin) return jsonError(400, "cin is required");
    const data = await filesureFetch(`/companies/${cin}/extractions/years`);
    return jsonOk(data);
  }

  case "filesure-extractions-list": {
    const { cin } = body;
    if (!cin) return jsonError(400, "cin is required");
    const data = await filesureFetch(`/companies/${cin}/extractions`);
    return jsonOk(data);
  }

  case "filesure-extractions-data": {
    const { cin, year } = body;
    if (!cin || !year) return jsonError(400, "cin and year are required");
    const data = await filesureFetch(`/companies/${cin}/extractions/${year}`);
    return jsonOk(data);
  }

  case "filesure-directors-contact": {
    const { din } = body;
    if (!din) return jsonError(400, "din is required");
    const data = await filesureFetch(`/directors/${din}/contact`);
    return jsonOk(data);
  }

  case "filesure-directors-unlock": {
    const { din } = body;
    if (!din) return jsonError(400, "din is required");
    const data = await filesureFetch(`/directors/${din}/unlock`, { method: "POST" });
    return jsonOk(data);
  }

  case "filesure-directors-update": {
    const { din } = body;
    if (!din) return jsonError(400, "din is required");
    const data = await filesureFetch(`/directors/${din}/refresh`, { method: "POST" });
    return jsonOk(data);
  }
}
```

`jsonOk`/`jsonError` are assumed to already exist as helpers in the function (used by the 5
working routes) — reuse those, don't redefine them.

## After this is deployed

Tell me which routes went in successfully (ideally exact route-name confirmation, since I used
the same names already configured in `js/dashboard.js`'s `FILESURE_ENDPOINTS`). Once deployed,
flip each one's `route: null` to the real route string in that file and it becomes callable from
the test console immediately — no other change needed.
