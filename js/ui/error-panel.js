// Sticky critical error panel controller — shown for severity 'critical' or
// errors the user must acknowledge before continuing.

(function (root) {
  "use strict";
  if (root.ErrorPanel) return;

  let catalog = null;
  let lastCtx = null;

  async function loadCatalog() {
    if (catalog) return catalog;
    try {
      const url = chrome.runtime.getURL("data/err-catalog.json");
      const res = await fetch(url);
      catalog = await res.json();
    } catch (_) {
      catalog = {};
    }
    return catalog;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  async function show(info) {
    info = info || {};
    const panel = document.getElementById("errorPanel");
    if (!panel) return;
    const cat = await loadCatalog();
    const entry = (cat && info.code && cat[info.code]) || {};
    const code = info.code || "ERR_UNKNOWN";
    const title = info.title || entry.title || "Something went wrong";
    const body = info.body || entry.body || "The last step did not complete.";
    const remedy = info.remedy || entry.remedy || [];
    lastCtx = info;

    const codeEl = document.getElementById("errCode");
    const titleEl = document.getElementById("errTitle");
    const bodyEl = document.getElementById("errBody");
    const remedyEl = document.getElementById("errRemedy");
    if (codeEl) codeEl.textContent = code;
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = body;
    if (remedyEl) {
      remedyEl.innerHTML = "";
      for (const step of remedy) {
        const li = document.createElement("li");
        li.textContent = step;
        remedyEl.appendChild(li);
      }
    }
    const retryBtn = document.getElementById("errRetry");
    if (retryBtn) {
      retryBtn.classList.toggle("hidden", !info.onRetry);
      retryBtn.onclick = function () { try { if (info.onRetry) info.onRetry(); } catch (_) {} hide(); };
    }
    panel.classList.remove("hidden");
  }

  function hide() {
    const panel = document.getElementById("errorPanel");
    if (panel) panel.classList.add("hidden");
    lastCtx = null;
  }

  function bind() {
    const close = document.getElementById("errClose");
    const report = document.getElementById("errReport");
    if (close) close.addEventListener("click", hide);
    if (report) report.addEventListener("click", async function () {
      try {
        const r = await chrome.storage.local.get(["logs"]);
        const tail = (r.logs || []).slice(-50);
        const payload = JSON.stringify({ code: lastCtx && lastCtx.code, title: lastCtx && lastCtx.title, body: lastCtx && lastCtx.body, context: lastCtx && lastCtx.context, logs: tail }, null, 2);
        await navigator.clipboard.writeText(payload);
        if (root.Toasts) root.Toasts.success({ title: "Report copied" });
      } catch (e) {
        if (root.Toasts) root.Toasts.error({ title: "Copy failed", body: e.message });
      }
    });
  }

  root.ErrorPanel = { show: show, hide: hide, bind: bind };
})(typeof window !== "undefined" ? window : globalThis);
