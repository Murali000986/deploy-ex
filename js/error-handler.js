// Central error handler — normalizes known MCA errors, decides severity,
// dispatches toasts / errorPanel / timeline / logs. All popup click handlers
// and awaitable chrome.scripting.executeScript calls go through wrap().

(function (root) {
  "use strict";
  if (root.ErrorHandler) return;

  const RULES = [
    { re: /session.*(expired|invalid|lost)|please.*login|unauthoriz/i, code: "ERR_MCA_SESSION_LOST", severity: "critical", retryable: false, title: "MCA session lost" },
    { re: /read.?only|disabled.*field|locked/i,                        code: "ERR_FIELD_READONLY",   severity: "warning",  retryable: true,  title: "Field is read-only" },
    { re: /save.*(reject|fail|error)/i,                                 code: "ERR_SAVE_REJECTED",   severity: "error",    retryable: true,  title: "Save rejected" },
    { re: /timeout|timed out/i,                                         code: "ERR_IDLE_TIMEOUT",    severity: "error",    retryable: true,  title: "Timed out" },
    { re: /frame.*reload|detached|navigat/i,                            code: "ERR_FRAME_RELOAD",    severity: "error",    retryable: true,  title: "Page reloaded" },
    { re: /no.*(input|field|element) found|not found/i,                 code: "ERR_FIELD_NOT_FOUND", severity: "warning",  retryable: true,  title: "Field not found" },
    { re: /invalid.*client|not.*aoc.?4|missing.*cin/i,                  code: "ERR_CLIENT_INVALID",  severity: "error",    retryable: false, title: "Client data is invalid" },
    { re: /unknown form|unsupported form|form.*not.*supported/i,        code: "ERR_FORM_UNSUPPORTED",severity: "error",    retryable: false, title: "Form not supported" },
    { re: /service worker|background.*(crash|inactive)/i,               code: "ERR_SW_INACTIVE",     severity: "critical", retryable: true,  title: "Extension service worker inactive" },
    { re: /inject|cannot access|scripting/i,                            code: "ERR_INJECT_BLOCKED",  severity: "critical", retryable: true,  title: "Cannot inject into MCA page" },
    { re: /otp|verification.*code/i,                                    code: "ERR_OTP_REQUIRED",    severity: "warning",  retryable: false, title: "OTP required" },
  ];

  function normalize(err) {
    const msg = (err && (err.message || err.toString())) || "Unknown error";
    for (const rule of RULES) {
      if (rule.re.test(msg)) {
        return { code: rule.code, title: rule.title, body: msg, severity: rule.severity, retryable: rule.retryable };
      }
    }
    return { code: "ERR_UNKNOWN", title: "Unexpected error", body: msg, severity: "error", retryable: true };
  }

  function saveLog(entry) {
    try {
      if (root.Storage && typeof root.Storage.saveLogs === "function") {
        root.Storage.saveLogs(entry);
      } else if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: "logAction", data: entry }, function () { void chrome.runtime.lastError; });
      }
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent("aoc:log", { detail: entry }));
    } catch (_) {}
  }

  function handle(err, ctx) {
    ctx = ctx || {};
    const n = normalize(err);
    const stepId = ctx.stepId || (root.Timeline && root.Timeline.activeStep && root.Timeline.activeStep());
    const entry = {
      ts: Date.now(),
      level: n.severity,
      code: n.code,
      msg: n.title + ": " + n.body,
      ctx: Object.assign({}, ctx, { stepId: stepId }),
    };
    saveLog(entry);
    // Dispatch UI.
    if (n.severity === "critical") {
      if (root.ErrorPanel && typeof root.ErrorPanel.show === "function") {
        root.ErrorPanel.show({ code: n.code, title: n.title, body: n.body, onRetry: ctx.onRetry, context: ctx });
      }
      if (root.Toasts) root.Toasts.error({ title: n.title, body: n.body });
    } else if (n.severity === "error") {
      if (root.Toasts) root.Toasts.error({ title: n.title, body: n.body, action: ctx.onRetry && { label: "Retry", onClick: ctx.onRetry } });
    } else if (n.severity === "warning") {
      if (root.Toasts) root.Toasts.warning({ title: n.title, body: n.body });
    } else {
      if (root.Toasts) root.Toasts.info({ title: n.title, body: n.body });
    }
    if (stepId && root.Timeline && typeof root.Timeline.setError === "function" && n.severity !== "warning") {
      root.Timeline.setError(stepId, { title: n.title, onRetry: ctx.onRetry });
    }
    return { ok: false, code: n.code, title: n.title, retryable: n.retryable };
  }

  function wrap(fn, ctx) {
    return async function () {
      try { return await fn.apply(this, arguments); }
      catch (err) { handle(err, ctx || {}); throw err; }
    };
  }

  function installPopupListeners() {
    window.addEventListener("error", function (e) {
      handle(e.error || new Error(e.message || "window error"), { source: "window.error" });
    });
    window.addEventListener("unhandledrejection", function (e) {
      handle(e.reason || new Error("unhandled rejection"), { source: "unhandledrejection" });
    });
  }

  root.ErrorHandler = {
    normalize: normalize,
    handle: handle,
    wrap: wrap,
    installPopupListeners: installPopupListeners,
    RULES: RULES,
  };
})(typeof window !== "undefined" ? window : globalThis);
