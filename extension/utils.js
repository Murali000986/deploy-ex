// Shared utilities — used by popup.js and content.js

// Points at the admin/ Next.js app. For local dev this is localhost:3000.
// Once admin/ is deployed (e.g. to Railway), change this to that deployment's
// https URL — it must also be covered by host_permissions in manifest.json
// (https://*.up.railway.app/* is already allowed there).
const LEDGERLY_BASE = "http://localhost:3000";

/** Decode JWT payload without verifying (verification done server-side). */
function decodeTokenPayload(token) {
  try {
    const part = token.split(".")[1];
    return JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/** True if token is absent, malformed, or expired (with 30s buffer). */
function isTokenExpired(token) {
  if (!token) return true;
  const p = decodeTokenPayload(token);
  if (!p?.exp) return true;
  return p.exp - 30 < Math.floor(Date.now() / 1000);
}

/** Map a ClientRequest draft to field values used by content.js fill logic. */
function mapDraftToFields(draft) {
  const names = (draft.proposedNames || []).map(n => n.name);
  const fields = draft.submittedFields || {};

  return {
    proposedName1: names[0] || "",
    proposedName2: names[1] || "",
    proposedName3: names[2] || "",
    "Company type": fields["Company type"] || draft.companyType || "",
    "Company category": fields["Company category"] || "",
    "Company sub-category": fields["Company sub-category"] || "",
    "NIC code": fields["NIC code"] || "",
    "Business activity": fields["Business activity"] || "",
    "Trademark number": fields["Trademark number"] || "",
  };
}

/**
 * Validate a single field value before filling.
 * Returns null if valid, or an error string.
 */
function validateFieldValue(key, value) {
  if (!value || String(value).trim() === "") {
    return "Empty value";
  }
  if (key.startsWith("proposedName") && value.length > 60) {
    return "Name too long (> 60 chars)";
  }
  if (key === "nicCode" && !/^\d{4,5}$/.test(value.trim())) {
    return "NIC code should be 4-5 digits";
  }
  return null;
}

/**
 * Format field results for display in the popup.
 * results: [{ key, label, status, reason }]
 */
function formatResults(results) {
  const icons = { filled: "✓", skipped: "○", invalid: "✗", "needs-review": "⚠" };
  return results.map(r => ({
    ...r,
    icon: icons[r.status] || "?",
    cssClass: r.status.replace("-", "_"),
  }));
}

/** Sanitize a string value before injecting into a DOM input. */
function sanitizeValue(val) {
  return String(val ?? "").trim().slice(0, 500);
}
