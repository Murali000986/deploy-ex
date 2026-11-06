// Background service worker (MV3)
// Handles: token storage, message routing between popup and content script,
//          message origin validation.

const VALID_ACTIONS = new Set([
  "FILL_FORM", "VALIDATE_FIELDS", "CLEAR_FORM", "DETECT_PAGE", "SCAN_FIELDS", "TEST_FILL",
  "GET_TOKEN", "SET_TOKEN", "CLEAR_TOKEN",
  "DETECT_LOGIN_PAGE", "FILL_LOGIN", "FILL_OTP", "CLICK_LOGIN_BTN",
  "SCAN_PAGE_FORMS", "AUTO_FILL_PROFILE", "SHOW_OVERLAY",
  "SAVE_CREDENTIALS", "GET_CREDENTIALS", "CLEAR_CREDENTIALS",
  "SAVE_PROFILE", "GET_PROFILE",
  "LOGIN_AUTO_FILLED", "OTP_PAGE_DETECTED", "PAGE_NAVIGATED", "PAGE_STATE_CHANGED",
  "START_AUTOMATION", "STOP_AUTOMATION", "GET_AUTOMATION_STATE",
  "UPDATE_AUTOMATION_STEP", "LOAD_FROM_ADMIN",
  "WRITE_LOG", "RELOAD_FROM_ADMIN", "RETRY_AUTOMATION", "RETRY_AUTOMATION_STEP",
  "CLEAR_AUTOMATION_LOGS", "AUTOMATION_STEP_CHANGED", "AUTOMATION_LOG_APPENDED",
  "CRITICAL_ERROR_RAISED", "CLIENT_DATA_LOADED",
]);

// Background-side log helpers
function bgAppendLog(entry) {
  try {
    chrome.storage.local.get(["mcaAutomationLogs"], (data) => {
      const logs = Array.isArray(data.mcaAutomationLogs) ? data.mcaAutomationLogs : [];
      logs.unshift(entry);
      if (logs.length > 100) logs.length = 100;
      chrome.storage.local.set({ mcaAutomationLogs: logs }, () => {
        try {
          chrome.runtime.sendMessage({ action: "AUTOMATION_LOG_APPENDED", entry }, () => { const _ = chrome.runtime.lastError; });
        } catch (_) {}
      });
    });
  } catch (_) {}
}
function bgErrorHandler(err, context) {
  context = context || {};
  const level = context.severity || "error";
  const code = context.code || "E-UNK-00";
  const message = (err && err.message) || String(err || "unknown");
  bgAppendLog({ at: Date.now(), level, source: context.source || "bg", message: `${code}: ${message}`, context: { op: context.op } });
  if (!context.silent && (level === "error" || level === "critical")) {
    try {
      chrome.runtime.sendMessage({
        action: "CRITICAL_ERROR_RAISED",
        error: { code, title: context.title || "Automation error", desc: message, steps: context.steps || [], at: Date.now(), severity: level }
      }, () => { const _ = chrome.runtime.lastError; });
    } catch (_) {}
  }
  try { console.error("[bgErrorHandler]", code, err, context); } catch (_) {}
}

const VALID_FORM_TYPES = new Set(["spice_a", "inc32", "dir3", "aoc4", "aoc4_offline"]);

function deliverToContentScript(tabId, message, sendResponse, retried = false) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    const messageError = chrome.runtime.lastError?.message;
    if (!messageError) {
      sendResponse(response || { ok: false, error: "The page script did not return a response." });
      return;
    }

    if (retried || !messageError.includes("Receiving end does not exist")) {
      sendResponse({ ok: false, error: messageError });
      return;
    }

    // The tab may have been open before the extension was loaded or refreshed.
    // Reuse any already-loaded field map, then inject the missing content script.
    chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      func: () => ({
        hasFieldMap: typeof SPICE_PART_A_FIELDS !== "undefined",
        hasContentScript: Boolean(window.__ledgerlyMcaAssistantLoaded),
        hasLoginAssist: Boolean(window.__mcaLoginAssistLoaded),
      }),
    }, (results) => {
      const inspectError = chrome.runtime.lastError?.message;
      if (inspectError) {
        sendResponse({ ok: false, error: `Could not prepare the page scanner: ${inspectError}` });
        return;
      }

      const state = results?.[0]?.result || {};
      const files = [];
      if (!state.hasFieldMap) files.push("field-map.js");
      if (!state.hasContentScript) files.push("content.js");
      if (!state.hasLoginAssist) files.push("login-assist.js");
      if (!files.length) {
        sendResponse({ ok: false, error: "The page script is present but did not respond. Reload the page and try again." });
        return;
      }

      chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files }, () => {
        const injectError = chrome.runtime.lastError?.message;
        if (injectError) {
          sendResponse({ ok: false, error: `Could not start the page scanner: ${injectError}` });
          return;
        }
        deliverToContentScript(tabId, message, sendResponse, true);
      });
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only accept messages from our own extension pages or content scripts
  if (sender.id !== chrome.runtime.id) return;

  const action = message?.action;
  if (!action || !VALID_ACTIONS.has(action)) {
    sendResponse({ ok: false, error: "Unknown action" });
    return;
  }

  // Token management (popup ↔ storage)
  if (action === "GET_TOKEN") {
    chrome.storage.session.get(["extToken", "extTokenMeta"], (data) => {
      sendResponse({ ok: true, token: data.extToken || null, meta: data.extTokenMeta || null });
    });
    return true; // async
  }

  if (action === "SET_TOKEN") {
    const { token, meta } = message;
    if (!token) { sendResponse({ ok: false, error: "No token" }); return; }
    chrome.storage.session.set({ extToken: token, extTokenMeta: meta }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (action === "CLEAR_TOKEN") {
    chrome.storage.session.remove(["extToken", "extTokenMeta"], () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  // ── Credential storage (chrome.storage.local — persists across sessions) ──

  if (action === "SAVE_CREDENTIALS") {
    const { username, password, autoLogin, autoFillForms } = message;
    chrome.storage.local.set({
      mcaUsername: username || "",
      mcaPassword: password || "",
      mcaAutoLogin: !!autoLogin,
      mcaAutoFillForms: !!autoFillForms,
    }, () => sendResponse({ ok: true }));
    return true;
  }

  if (action === "GET_CREDENTIALS") {
    chrome.storage.local.get(["mcaUsername", "mcaPassword", "mcaAutoLogin", "mcaAutoFillForms"], (data) => {
      sendResponse({ ok: true, ...data });
    });
    return true;
  }

  if (action === "CLEAR_CREDENTIALS") {
    chrome.storage.local.remove(["mcaUsername", "mcaPassword", "mcaAutoLogin", "mcaAutoFillForms"], () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  // ── Profile data storage ──

  if (action === "SAVE_PROFILE") {
    chrome.storage.local.set({ mcaProfile: message.profile || {} }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (action === "GET_PROFILE") {
    chrome.storage.local.get(["mcaProfile"], (data) => {
      sendResponse({ ok: true, profile: data.mcaProfile || {} });
    });
    return true;
  }

  // ── Automation control ──

  if (action === "START_AUTOMATION") {
    const { username, password, formType, formData } = message;
    if (!VALID_FORM_TYPES.has(formType)) {
      const err = `Unknown form type: ${formType}. Supported: ${[...VALID_FORM_TYPES].join(", ")}`;
      bgErrorHandler(new Error(err), { source: "bg", op: "START_AUTOMATION", code: "E-OPEN-01" });
      sendResponse({ ok: false, error: err });
      return true;
    }
    const safeFormType = formType;
    const startedAt = Date.now();
    chrome.storage.local.set({
      mcaUsername: username || "",
      mcaPassword: password || "",
      mcaAutoLogin: true,
      mcaAutoFillForms: true,
      mcaAutomationActive: true,
      mcaSelectedForm: safeFormType,
      mcaFormData: formData || {},
      [`mcaFormData_${safeFormType}`]: formData || {},
      mcaAutomationStep: { step: "open_mca", status: "active", startedAt, at: startedAt, detail: "Opening MCA login page" },
      mcaCriticalError: null,
    }, () => {
      bgAppendLog({ at: Date.now(), level: "info", source: "bg", message: `Automation started for ${safeFormType.toUpperCase()}` });
      const loginUrl = "https://www.mca.gov.in/content/mca/global/en/foportal/fologin.html";
      chrome.tabs.query({ url: "https://*.mca.gov.in/*" }, (tabs) => {
        try {
          if (tabs.length > 0) {
            chrome.tabs.update(tabs[0].id, { active: true, url: loginUrl });
            chrome.windows.update(tabs[0].windowId, { focused: true });
            sendResponse({ ok: true });
          } else {
            chrome.tabs.create({ url: loginUrl }, (tab) => {
              const err = chrome.runtime.lastError?.message;
              if (err) {
                chrome.storage.local.set({
                  mcaAutomationStep: {
                    step: "open_mca", status: "error", startedAt, finishedAt: Date.now(),
                    at: Date.now(), message: err,
                    error: { code: "E-OPEN-01", message: err, hint: "Check network and reopen the popup." },
                  },
                  mcaAutomationActive: false,
                });
                bgErrorHandler(new Error(err), { source: "bg", op: "chrome.tabs.create", code: "E-OPEN-01", severity: "error" });
                sendResponse({ ok: false, error: err });
              } else {
                sendResponse({ ok: true });
              }
            });
          }
        } catch (err) {
          chrome.storage.local.set({
            mcaAutomationStep: {
              step: "open_mca", status: "error", startedAt, finishedAt: Date.now(),
              at: Date.now(), message: err.message,
              error: { code: "E-OPEN-01", message: err.message, hint: "Check network connection, then retry." },
            },
            mcaAutomationActive: false,
          });
          bgErrorHandler(err, { source: "bg", op: "START_AUTOMATION", code: "E-OPEN-01", severity: "critical" });
          sendResponse({ ok: false, error: err.message });
        }
      });
    });
    return true;
  }

  if (action === "WRITE_LOG") {
    bgAppendLog({
      at: message.at || Date.now(),
      level: message.level || "info",
      source: message.source || "popup",
      message: message.message || "",
      context: message.context || null,
    });
    sendResponse({ ok: true });
    return true;
  }

  if (action === "CLEAR_AUTOMATION_LOGS") {
    chrome.storage.local.set({ mcaAutomationLogs: [] }, () => sendResponse({ ok: true }));
    return true;
  }

  if (action === "RELOAD_FROM_ADMIN") {
    // Signal to any admin bridge listeners; also broadcast CLIENT_DATA_LOADED after a short delay
    try {
      chrome.runtime.sendMessage({ action: "CLIENT_DATA_LOADED" }, () => { const _ = chrome.runtime.lastError; });
    } catch (_) {}
    sendResponse({ ok: true });
    return true;
  }

  if (action === "RETRY_AUTOMATION" || action === "RETRY_AUTOMATION_STEP") {
    // Clear critical error; a popup click handler drives the actual retry
    chrome.storage.local.set({ mcaCriticalError: null }, () => sendResponse({ ok: true }));
    return true;
  }

  if (action === "STOP_AUTOMATION") {
    chrome.storage.local.set({ mcaAutomationActive: false, mcaAutomationStep: null }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (action === "UPDATE_AUTOMATION_STEP") {
    const { step, status, message: stepMessage, detail, error } = message;
    const now = Date.now();
    // Normalize status (completed -> done)
    const normStatus = status === "completed" ? "done" : (status || "active");
    // Preserve startedAt for the active step; set finishedAt when done/error
    chrome.storage.local.get(["mcaAutomationStep"], (prev) => {
      const prevStep = prev.mcaAutomationStep || {};
      const sameStep = prevStep && prevStep.step === step;
      const payload = {
        step,
        status: normStatus,
        startedAt: sameStep && prevStep.startedAt ? prevStep.startedAt : (normStatus === "active" ? now : (prevStep.startedAt || now)),
        at: now,
      };
      if (normStatus === "done" || normStatus === "error") payload.finishedAt = now;
      if (stepMessage) payload.message = stepMessage;
      if (detail) payload.detail = detail;
      if (error && typeof error === "object") payload.error = error;
      else if (normStatus === "error" && stepMessage) {
        // auto-wrap plain error message
        payload.error = { code: "E-UNK-00", message: stepMessage, hint: "" };
      }
      chrome.storage.local.set({ mcaAutomationStep: payload }, () => {
        // Append log entry
        const level = normStatus === "error" ? "error" : (normStatus === "done" ? "success" : "info");
        bgAppendLog({
          at: now, level, source: message.source || "content",
          message: `${step}:${normStatus}${stepMessage ? " — " + stepMessage : ""}`,
          context: { step, status: normStatus },
        });
        // Broadcast to any open popup
        try {
          chrome.runtime.sendMessage({ action: "AUTOMATION_STEP_CHANGED", step: payload }, () => {
            const _ = chrome.runtime.lastError;
          });
        } catch (_) {}
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (action === "GET_AUTOMATION_STATE") {
    chrome.storage.local.get(
      ["mcaAutomationActive", "mcaSelectedForm", "mcaFormData", "mcaUsername", "mcaPassword", "mcaAutomationStep"],
      (data) => sendResponse({ ok: true, ...data })
    );
    return true;
  }

  if (action === "LOAD_FROM_ADMIN") {
    const { formType, formData, clientInfo } = message;
    if (!VALID_FORM_TYPES.has(formType)) {
      sendResponse({ ok: false, error: "Unknown form type" });
      return;
    }
    const now = Date.now();
    const currentClientInfo = clientInfo ? {
      name: clientInfo.name || clientInfo.clientName || "Unnamed client",
      cin: clientInfo.cin || clientInfo.clientId || "",
      financialYear: clientInfo.financialYear || clientInfo.fy || "",
      source: "admin",
      loadedAt: now,
    } : null;
    chrome.storage.local.set({
      [`mcaFormData_${formType}`]: formData || {},
      mcaSelectedForm: formType,
      mcaFormData: formData || {},
      mcaAdminLoadedAt: now,
      mcaAdminClientInfo: clientInfo || null,
      mcaCurrentClientInfo: currentClientInfo,
    }, () => {
      bgAppendLog({ at: now, level: "success", source: "bg", message: `Loaded from admin: ${formType.toUpperCase()}${currentClientInfo && currentClientInfo.name ? " (" + currentClientInfo.name + ")" : ""}` });
      try {
        if (chrome.notifications && chrome.notifications.create) {
          chrome.notifications.create({
            type: "basic",
            iconUrl: "icons/icon48.png",
            title: "Ledgerly — form loaded",
            message: `${formType.toUpperCase()} data loaded. Open the extension popup to review and fill.`,
            priority: 1,
          }, () => { const _ = chrome.runtime.lastError; });
        }
      } catch (e) {
        bgErrorHandler(e, { source: "bg", op: "chrome.notifications.create", severity: "warning", silent: true });
      }
      try {
        chrome.runtime.sendMessage({ action: "CLIENT_DATA_LOADED" }, () => { const _ = chrome.runtime.lastError; });
      } catch (_) {}
      sendResponse({ ok: true });
    });
    return true;
  }

  // ── Events from content script (login-assist) — just acknowledge ──

  if (["LOGIN_AUTO_FILLED", "OTP_PAGE_DETECTED", "PAGE_NAVIGATED", "PAGE_STATE_CHANGED"].includes(action)) {
    sendResponse({ ok: true });
    return;
  }

  // Content script actions — relay to active tab
  const CONTENT_ACTIONS = [
    "FILL_FORM", "VALIDATE_FIELDS", "CLEAR_FORM", "DETECT_PAGE", "SCAN_FIELDS", "TEST_FILL",
    "DETECT_LOGIN_PAGE", "FILL_LOGIN", "FILL_OTP", "CLICK_LOGIN_BTN",
    "SCAN_PAGE_FORMS", "AUTO_FILL_PROFILE", "SHOW_OVERLAY",
  ];
  if (CONTENT_ACTIONS.includes(action)) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ ok: false, error: "No active tab" });
        return;
      }
      if (message.sampleData === true && !tab.url?.startsWith("http://localhost:4000/")) {
        sendResponse({ ok: false, error: "Sample data is restricted to the local demo form at localhost:4000." });
        return;
      }
      // Guard: FILL/VALIDATE/CLEAR/SCAN only allowed on MCA domain (any subdomain) or local test server
      const isMCA = tab.url?.includes("mca.gov.in") || tab.url?.startsWith("http://localhost:4000/");
      if (action !== "DETECT_PAGE" && !isMCA) {
        sendResponse({ ok: false, error: "Active tab is not an MCA page. Navigate to the MCA portal (mca.gov.in) or the local test form." });
        return;
      }
      deliverToContentScript(tab.id, message, sendResponse);
    });
    return true; // async
  }
});
