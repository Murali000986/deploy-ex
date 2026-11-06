"use client";
import type { ClientRequest } from "./types";
import type { FormDescriptor } from "./forms";

/**
 * Load a form request into the Ledgerly browser extension. Posts a window
 * message that the extension's admin-bridge content script picks up and
 * forwards to the background service worker, which writes the per-form draft
 * (`mcaFormData_<extensionKey>`) and sets `mcaSelectedForm`.
 *
 * Falls back to a JSON file download when no extension is detected on the
 * page — the user can import it manually from the extension popup.
 */
export function loadIntoExtension(form: FormDescriptor, request: ClientRequest) {
  const payload = {
    type: "LEDGERLY_LOAD_INTO_EXTENSION" as const,
    formType: form.extensionKey,
    formData: request.submittedFields,
    clientInfo: {
      requestId: request.id,
      clientName: request.clientName,
      cin: request.cin ?? "",
      financialYear: request.financialYear ?? "",
      companyType: request.companyType,
    },
    source: "ledgerly-admin",
    at: Date.now(),
  };

  if (typeof window === "undefined") return;

  const ok = detectExtension();
  if (ok) {
    try {
      window.postMessage(payload, window.location.origin);
      flash(`Loaded ${request.id} into extension — open the Ledgerly popup to review and fill.`);
      return;
    } catch (err) {
      console.warn("[Ledgerly] postMessage failed, falling back to download", err);
    }
  }
  downloadJson(`ledgerly-${form.extensionKey}-${request.id}.json`, payload);
  flash(
    "Extension not detected — downloaded JSON. Install the Ledgerly extension and import it from the popup.",
    { tone: "warn" }
  );
}

function detectExtension(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.getElementById("ledgerly-bridge-ready"));
}

function downloadJson(filename: string, data: unknown) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  } catch (err) {
    console.error("[Ledgerly] download fallback failed", err);
  }
}

/** Lightweight transient toast; avoids a new dependency for this one flow. */
function flash(message: string, opts: { tone?: "info" | "warn" } = {}) {
  if (typeof document === "undefined") return;
  const tone = opts.tone ?? "info";
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.textContent = message;
  el.style.cssText = `
    position: fixed; left: 50%; bottom: 32px; transform: translateX(-50%);
    padding: 10px 14px; border-radius: 6px; z-index: 9999;
    font-size: 13px; max-width: 480px; line-height: 1.3;
    box-shadow: 0 6px 24px rgba(0,0,0,.12);
    background: ${tone === "warn" ? "#fff7ed" : "#111"};
    color: ${tone === "warn" ? "#9a3412" : "#fff"};
    border: 1px solid ${tone === "warn" ? "#fed7aa" : "transparent"};
  `;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .25s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 3200);
}
