importScripts("js/storage.js");

const SUPPORTED_FORMS = ["aoc4", "aoc4_offline", "spice_a", "inc32", "dir3"];

// Clicking the toolbar icon opens the Germin8 side panel (docked on the browser's side).
// Unlike a popup it stays open while the user works on the MCA page. Set on every worker
// start so the behaviour survives extension reloads.
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function (e) {
    console.warn("Germin8: could not enable side panel on icon click:", e && e.message);
  });
}

chrome.runtime.onInstalled.addListener(function () {
  console.log("Germin8 v" + chrome.runtime.getManifest().version + " installed");
});

// Service-worker scope error reporting — surfaces SW crashes to the popup
// drawer on next open.
self.addEventListener("error", function (e) {
  try {
    Storage.saveLogs({ level: "critical", code: "ERR_SW_INACTIVE", msg: "SW error: " + (e && e.message), ts: Date.now() });
  } catch (_) {}
});
self.addEventListener("unhandledrejection", function (e) {
  try {
    Storage.saveLogs({ level: "critical", code: "ERR_SW_INACTIVE", msg: "SW unhandledrejection: " + (e && e.reason && e.reason.message), ts: Date.now() });
  } catch (_) {}
});

chrome.runtime.onMessage.addListener(function (req, _sender, send) {
  if (!req || typeof req !== "object") return;
  try {
    if (req.action === "logAction") {
      Storage.saveLogs(req.data || {}).then(function () { send({ ok: true }); });
      return true;
    }
    if (req.action === "WRITE_LOG") {
      const entry = {
        level: req.level || "info",
        msg: req.message || "",
        code: req.code,
        source: req.source || "popup",
        ts: req.at || Date.now(),
        context: req.context || null,
      };
      Storage.saveLogs(entry).then(function () { send({ ok: true }); });
      return true;
    }
    if (req.action === "UPDATE_AUTOMATION_STEP") {
      const payload = {
        step: req.step,
        status: req.status,
        source: req.source || "unknown",
        message: req.message,
        detail: req.detail,
        error: req.error,
        at: Date.now(),
      };
      chrome.storage.local.set({ mcaAutomationStep: payload }, function () { send({ ok: true }); });
      return true;
    }
  } catch (e) {
    try { send({ ok: false, error: e.message }); } catch (_) {}
  }
});

// Allow the Dashboard (served from localhost) to hand prepared data straight
// to the extension across all 5 supported forms.
chrome.runtime.onMessageExternal.addListener(function (req, sender, send) {
  (async function () {
    try {
      const manifest = chrome.runtime.getManifest();
      if (req && req.action === "ping") {
        return send({ ok: true, name: manifest.name, version: manifest.version, supports: SUPPORTED_FORMS });
      }

      if (req && req.action === "importClient") {
        return send(await handleImportClient(req, sender));
      }

      send({ ok: false, error: 'Unknown action "' + (req && req.action) + '".' });
    } catch (e) {
      send({ ok: false, error: e.message });
    }
  })();
  return true; // async reply
});

async function handleImportClient(req, sender) {
  const formType = SUPPORTED_FORMS.indexOf(req.formType) >= 0 ? req.formType : "aoc4";

  // Legacy AOC-4 shape: a nested client with general.CIN.
  const legacyClient = req.client;
  const flatFormData = req.formData || null;
  const clientInfo = req.clientInfo || null;

  if (formType === "aoc4" && legacyClient && typeof legacyClient === "object" && !flatFormData) {
    if (!legacyClient.general || !legacyClient.general.CIN) {
      return { ok: false, error: "This is not an AOC-4 client file (no general.CIN)." };
    }
    const fallbackId = legacyClient.general.CIN + "_" + String(legacyClient.general.FY_TO || "").replace(/\D/g, "");
    const id = String(legacyClient.clientId || fallbackId).toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const stored = await chrome.storage.local.get(["importedClients"]);
    const imported = stored.importedClients || {};
    const replaced = !!imported[id];
    imported[id] = legacyClient;
    const info = {
      id: id,
      name: legacyClient.displayName || id,
      cin: legacyClient.general.CIN,
      fy: { from: legacyClient.general.FY_FROM, to: legacyClient.general.FY_TO },
      source: "dashboard",
    };
    await chrome.storage.local.set({
      importedClients: imported,
      currentForm: "aoc4",
      clientInfo: info,
    });
    await Storage.saveLogs({ action: "importClientFromDashboard", id: id, replaced: replaced, formType: "aoc4", from: sender.origin || sender.url || "" });
    return { ok: true, id: id, replaced: replaced, name: info.name, formType: "aoc4" };
  }

  // New shape — flat formData per form.
  if (!flatFormData || typeof flatFormData !== "object") {
    return { ok: false, error: "Missing formData for " + formType + "." };
  }
  const validationErr = validateFormData(formType, flatFormData, clientInfo);
  if (validationErr) return { ok: false, error: validationErr };

  const info = clientInfo || inferClientInfo(formType, flatFormData);
  const id = String((info && info.id) || (info && info.cin) || Date.now())
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");

  const stored = await chrome.storage.local.get(["importedClients"]);
  const imported = stored.importedClients || {};
  imported[id] = { clientInfo: info, formType: formType, formData: flatFormData, importedAt: Date.now() };

  const toSet = {
    importedClients: imported,
    currentForm: formType,
    clientInfo: info,
  };
  toSet["mcaFormData_" + formType] = flatFormData;
  await chrome.storage.local.set(toSet);
  await Storage.saveLogs({ action: "importClientFromDashboard", id: id, formType: formType, keys: Object.keys(flatFormData).length, from: sender.origin || sender.url || "" });
  return { ok: true, id: id, formType: formType, name: info.name, storedKeys: Object.keys(flatFormData) };
}

function validateFormData(formType, formData, clientInfo) {
  switch (formType) {
    case "aoc4":
    case "aoc4_offline": {
      const cin = (clientInfo && clientInfo.cin) || formData.cin || formData.CIN;
      if (!cin) return "Missing CIN for " + formType + ".";
      return null;
    }
    case "spice_a": {
      if (!formData.proposedName1) return "Missing proposedName1 for SPICe+ Part A.";
      return null;
    }
    case "inc32": {
      const cin = (clientInfo && clientInfo.cin) || formData.cin || formData.CIN;
      if (!cin && !formData.proposedName1) return "Missing CIN or proposedName1 for INC-32.";
      return null;
    }
    case "dir3": {
      if (!formData.din) return "Missing DIN for DIR-3 KYC.";
      return null;
    }
    default:
      return "Unsupported formType " + formType + ".";
  }
}

function inferClientInfo(formType, formData) {
  return {
    id: formData.clientId || formData.cin || formData.din || "manual_" + Date.now(),
    name: formData.displayName || formData.name || formData.companyName || formData.proposedName1 || "Imported entry",
    cin: formData.cin || formData.CIN || null,
    din: formData.din || null,
    fy: formData.financialYearFrom && formData.financialYearTo
      ? { from: formData.financialYearFrom, to: formData.financialYearTo }
      : null,
    source: "dashboard",
  };
}
