// Ledgerly API communication layer for the extension popup.
// LEDGERLY_BASE is defined in utils.js (loaded before this file)

class AuthError extends Error { constructor(msg) { super(msg); this.name = "AuthError"; } }
class NetworkError extends Error { constructor(msg) { super(msg); this.name = "NetworkError"; } }
class ApiError extends Error {
  constructor(status, msg) { super(msg); this.name = "ApiError"; this.status = status; }
}

/**
 * Exchange the current Ledgerly session cookie for an extension JWT.
 * Admin must already be signed in to Ledgerly in this browser profile.
 */
async function exchangeToken() {
  let res;
  try {
    res = await fetch(`${LEDGERLY_BASE}/api/extension/token`, {
      method: "POST",
      credentials: "include", // sends the NextAuth session cookie
    });
  } catch (e) {
    throw new NetworkError("Cannot reach Ledgerly at " + LEDGERLY_BASE);
  }
  if (res.status === 401) throw new AuthError("Not signed in to Ledgerly. Please sign in and try again.");
  if (!res.ok) throw new ApiError(res.status, `Token exchange failed (${res.status})`);
  return res.json(); // { token, expiresAt, user }
}

/**
 * Fetch drafts for the current admin, optionally filtered by form type.
 * @param {string} token
 * @param {string} [formType]  One of spice_a, inc32, dir3, aoc4, aoc4_offline (default spice_a)
 */
async function fetchDrafts(token, formType) {
  let res;
  const qs = formType ? `?formType=${encodeURIComponent(formType)}` : "";
  try {
    res = await fetch(`${LEDGERLY_BASE}/api/extension/drafts${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    throw new NetworkError("Cannot reach Ledgerly at " + LEDGERLY_BASE);
  }
  if (res.status === 401) throw new AuthError("Session expired. Reconnect to Ledgerly.");
  if (!res.ok) throw new ApiError(res.status, `Drafts fetch failed (${res.status})`);
  const data = await res.json();
  return data.drafts; // ClientRequest[]
}

/**
 * Fetch full detail for a single draft.
 */
async function fetchDraft(token, id) {
  let res;
  try {
    res = await fetch(`${LEDGERLY_BASE}/api/extension/drafts/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    throw new NetworkError("Cannot reach Ledgerly at " + LEDGERLY_BASE);
  }
  if (res.status === 401) throw new AuthError("Session expired. Reconnect to Ledgerly.");
  if (res.status === 403) throw new AuthError("You are not authorized to access this draft.");
  if (res.status === 404) throw new ApiError(404, "Draft not found.");
  if (!res.ok) throw new ApiError(res.status, `Draft fetch failed (${res.status})`);
  const data = await res.json();
  return data.draft;
}
