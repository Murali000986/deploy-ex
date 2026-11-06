// Admin -> Extension bridge
// Runs on the admin panel (localhost:3000 / localhost:4000) and listens for
// a window.postMessage from a Ledgerly admin "Load and Fill in Extension" button.
// Forwards the payload to background.js which seeds chrome.storage.local and
// shows a toast. Also marks the DOM so admin can detect the extension is live.

(function () {
  "use strict";
  if (window.__ledgerlyAdminBridgeLoaded) return;
  window.__ledgerlyAdminBridgeLoaded = true;

  // Mark the DOM so admin pages can detect the extension is present.
  try {
    const marker = document.createElement("meta");
    marker.id = "ledgerly-bridge-ready";
    marker.setAttribute("data-version", "1");
    (document.head || document.documentElement).appendChild(marker);
  } catch (_) { /* ignore */ }

  window.addEventListener("message", (ev) => {
    // Only accept messages from the same window and from http://localhost:*
    if (ev.source !== window) return;
    const data = ev.data;
    if (!data || typeof data !== "object") return;
    if (data.type !== "LEDGERLY_LOAD_INTO_EXTENSION") return;

    const { formType, formData, clientInfo } = data;
    if (!formType || typeof formType !== "string") return;

    chrome.runtime.sendMessage(
      {
        action: "LOAD_FROM_ADMIN",
        formType: String(formType).toLowerCase(),
        formData: formData || {},
        clientInfo: clientInfo || null,
      },
      (res) => {
        try {
          window.postMessage(
            {
              type: "LEDGERLY_LOAD_INTO_EXTENSION_RESULT",
              ok: !!(res && res.ok),
              error: res && res.error,
            },
            "*"
          );
        } catch (_) { /* ignore */ }
      }
    );
  });
})();
