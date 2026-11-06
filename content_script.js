// MCA content script (ISOLATED world) — dispatcher.
// Handles:
//   { action: 'ping' }                → health probe (also keeps legacy popup.js happy)
//   { action: 'getFormFields' }       → DOM scan (used by Debug tab)
//   { action: 'fill',    formType, formData, phase } → Filler.fill(...)
//   { action: 'scan',    formType }   → Filler.scan(...)
//   { action: 'clear',   formType }   → wipes the per-form data key
//   { action: 'detectPage' }          → url-based form classification
// Also installs a MutationObserver that triggers autoFillOnMount when
// chrome.storage.local.mcaAutomationActive is true (ported from
// extension/login-assist.js lifecycle).

(function () {
  "use strict";
  const extensionRuntime = globalThis.chrome && globalThis.chrome.runtime;
  if (!extensionRuntime || !extensionRuntime.onMessage || !extensionRuntime.onMessage.addListener) return;
  if (globalThis.__aocDispatcherLoaded) return;
  globalThis.__aocDispatcherLoaded = true;

  function reply(send, payload) {
    try { send(payload); } catch (_) { /* popup gone */ }
  }

  extensionRuntime.onMessage.addListener(function (req, _sender, send) {
    if (!req || typeof req !== "object") return;
    try {
      if (req.action === "ping") {
        reply(send, { pong: true, href: location.href });
        return;
      }
      if (req.action === "getFormFields") {
        reply(send, { fields: scanFormFields() });
        return;
      }
      if (req.action === "detectPage") {
        reply(send, (window.Filler && window.Filler.detectPage()) || { url: location.href, formType: null });
        return;
      }
      if (req.action === "fill") {
        const formType = req.formType || "aoc4";
        const formData = req.formData || {};
        if (!window.Filler) { reply(send, { ok: false, formType: formType, err: { code: "ERR_INJECT_BLOCKED", title: "Filler not loaded", retryable: true } }); return; }
        const result = window.Filler.fill(formType, formData);
        reply(send, result);
        return;
      }
      if (req.action === "scan") {
        const formType = req.formType || "aoc4";
        reply(send, window.Filler ? window.Filler.scan(formType) : { url: location.href, totalFound: 0, totalExpected: 0, fields: [] });
        return;
      }
      if (req.action === "clear") {
        const formType = req.formType || "aoc4";
        chrome.storage.local.remove(["mcaFormData_" + formType], function () { reply(send, { ok: true }); });
        return true; // async
      }
    } catch (err) {
      reply(send, { ok: false, err: { code: "ERR_UNKNOWN", title: "Dispatcher failed", body: err && err.message } });
    }
  });

  // ── Scan helper (used by Debug tab in the popup) ─────────────────────
  function scanFormFields() {
    const out = [];
    const nodes = document.querySelectorAll("input, select, textarea");
    nodes.forEach(function (el, i) {
      if (el.type === "hidden") return;
      let labelText = el.getAttribute("aria-label") || el.placeholder || "";
      if (!labelText && el.id) {
        const lbl = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (lbl) labelText = lbl.textContent.trim();
      }
      if (!labelText && el.labels && el.labels[0]) labelText = el.labels[0].textContent.trim();
      if (!labelText) {
        const row = el.closest("tr, .form-row, .row, li, div");
        if (row) labelText = (row.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120);
      }
      const tr = el.closest("tr");
      const rowText = tr ? (tr.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120) : null;
      out.push({
        idx: i, rowText: rowText, tag: el.tagName.toLowerCase(), type: el.type || null,
        name: el.name || null, id: el.id || null,
        ariaLabel: el.getAttribute("aria-label") || null,
        placeholder: el.placeholder || null,
        label: (labelText || "").slice(0, 160),
      });
    });
    return { url: location.href, inFrame: window !== window.top, frames: window.frames.length, totalInputs: nodes.length, fields: out };
  }

  // ── Auto-fill-on-mount (opt-in via chrome.storage.local.mcaAutomationActive) ─
  let autoFillInFlight = false;
  const observer = new MutationObserver(function () {
    if (autoFillInFlight) return;
    chrome.storage.local.get(["mcaAutomationActive", "currentForm"], function (res) {
      if (!res || !res.mcaAutomationActive || !window.Filler) return;
      const formType = res.currentForm || "aoc4";
      chrome.storage.local.get(["mcaFormData_" + formType], function (r) {
        const data = r && r["mcaFormData_" + formType];
        if (!data || !Object.keys(data).length) return;
        autoFillInFlight = true;
        try {
          const result = window.Filler.fill(formType, data);
          chrome.storage.local.set({ mcaAutomationLastResult: result });
        } catch (err) {
          chrome.runtime.sendMessage({ action: "logAction", data: { level: "error", msg: "autoFillOnMount: " + (err && err.message) } }, function () { void chrome.runtime.lastError; });
        } finally {
          // Clear the switch so we don't re-fire on every mutation.
          chrome.storage.local.set({ mcaAutomationActive: false });
          autoFillInFlight = false;
        }
      });
    });
  });
  try { observer.observe(document.documentElement || document.body, { childList: true, subtree: true }); } catch (_) {}
})();
