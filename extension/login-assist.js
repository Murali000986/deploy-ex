// Login-assist content script — MCA portal login automation
// Auto-fills credentials, pauses for CAPTCHA/OTP, resumes after manual steps.
// Injected on *.mca.gov.in/* pages alongside the existing content.js

(function () {
  "use strict";

  if (window.__mcaLoginAssistLoaded) return;
  window.__mcaLoginAssistLoaded = true;

  // ── Automation-step emission helper ──
  // status: 'active' | 'completed' | 'done' | 'error'
  // extras: { message, detail, error: { code, message, hint } }
  function emitStep(step, status, messageOrExtras) {
    try {
      const extras = (typeof messageOrExtras === "string")
        ? { message: messageOrExtras }
        : (messageOrExtras && typeof messageOrExtras === "object" ? messageOrExtras : {});
      chrome.runtime.sendMessage({
        action: "UPDATE_AUTOMATION_STEP",
        step,
        status,
        source: "content",
        message: extras.message,
        detail: extras.detail,
        error: extras.error,
      }, () => { const _ = chrome.runtime.lastError; });
    } catch (e) {
      try { console.warn("[login-assist] emitStep failed", e); } catch (_) {}
    }
  }
  // Error helper for the step payload
  function stepError(code, message, hint) {
    return { code, message, hint: hint || "" };
  }
  function writeLog(level, message, context) {
    try {
      chrome.runtime.sendMessage({
        action: "WRITE_LOG",
        level, source: "content", message, context: context || null, at: Date.now(),
      }, () => { const _ = chrome.runtime.lastError; });
    } catch (_) {}
  }

  // ── Selector lists — broad patterns to cover MCA V2/V3 login variants ──

  const SEL = {
    username: [
      'input[name="username"]', 'input[name="userName"]', 'input[name="userId"]',
      'input[name="loginid"]', 'input[name="loginId"]', 'input[name="user_id"]',
      'input[name="email"]', 'input[type="email"]',
      'input[id*="user" i]', 'input[id*="login" i]', 'input[id*="email" i]',
      'input[placeholder*="User" i]', 'input[placeholder*="Email" i]',
      'input[placeholder*="Login" i]', 'input[placeholder*="ID" i]',
      'input[aria-label*="user" i]', 'input[aria-label*="login" i]',
    ],
    password: [
      'input[type="password"]',
      'input[name="password"]', 'input[name="passwd"]', 'input[name="pwd"]',
    ],
    captcha: [
      'input[name*="captcha" i]', 'input[id*="captcha" i]',
      'input[placeholder*="captcha" i]', 'input[placeholder*="Captcha"]',
      'input[aria-label*="captcha" i]',
    ],
    captchaImage: [
      'img[id*="captcha" i]', 'img[alt*="captcha" i]',
      'img[src*="captcha" i]', 'img[class*="captcha" i]',
      'canvas[id*="captcha" i]',
    ],
    otp: [
      'input[name*="otp" i]', 'input[id*="otp" i]',
      'input[placeholder*="OTP" i]', 'input[placeholder*="otp"]',
      'input[aria-label*="OTP" i]',
      'input[type="number"][maxlength="6"]', 'input[type="tel"][maxlength="6"]',
    ],
    loginButton: [
      'button[type="submit"]', 'input[type="submit"]',
      'button[id*="login" i]', 'button[id*="signIn" i]', 'button[id*="signin" i]',
      'a[id*="login" i]', 'a[id*="signin" i]',
      '#loginBtn', '#signInBtn', '#btnLogin', '#btnSignIn',
    ],
  };

  // ── Helpers ──

  function findFirst(selectorList) {
    for (const sel of selectorList) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null && !el.disabled) return el;
      } catch { /* invalid selector */ }
    }
    return null;
  }

  function findAll(selectorList) {
    const found = new Set();
    for (const sel of selectorList) {
      try { document.querySelectorAll(sel).forEach(el => found.add(el)); } catch {}
    }
    return Array.from(found).filter(el => el.offsetParent !== null && !el.disabled);
  }

  function nativeSet(el, value) {
    const proto = el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function highlight(el, color) {
    if (!el) return;
    const prev = el.style.outline;
    el.style.outline = `3px solid ${color}`;
    el.style.outlineOffset = "1px";
    setTimeout(() => { el.style.outline = prev; el.style.outlineOffset = ""; }, 4000);
  }

  // ── Page detection ──

  function detectPage() {
    const url = window.location.href.toLowerCase();
    const userEl = findFirst(SEL.username);
    const passEl = findFirst(SEL.password);
    const captchaEl = findFirst(SEL.captcha);
    const captchaImg = findFirst(SEL.captchaImage);
    const otpEl = findFirst(SEL.otp);
    const loginBtn = findFirst(SEL.loginButton);

    const isLoginPage = !!(userEl && passEl);
    const isOtpPage = !!otpEl && !isLoginPage;

    let pageType = "unknown";
    if (isOtpPage) pageType = "otp";
    else if (isLoginPage) pageType = "login";
    else if (url.includes("dashboard") || url.includes("home") || url.includes("workspace")) pageType = "dashboard";
    else if (document.querySelector("form") && !isLoginPage) pageType = "form";

    return {
      url: window.location.href,
      title: document.title,
      pageType,
      isLoginPage,
      isOtpPage,
      hasCaptcha: !!(captchaEl || captchaImg),
      hasCaptchaInput: !!captchaEl,
      hasOtp: !!otpEl,
      hasUsername: !!userEl,
      hasPassword: !!passEl,
      hasLoginButton: !!loginBtn,
    };
  }

  // ── Login fill ──

  function fillLogin(username, password) {
    const results = { username: false, password: false, captchaFocused: false };

    const userEl = findFirst(SEL.username);
    if (userEl && username) {
      nativeSet(userEl, username);
      highlight(userEl, "#2a7");
      results.username = true;
    }

    const passEl = findFirst(SEL.password);
    if (passEl && password) {
      nativeSet(passEl, password);
      highlight(passEl, "#2a7");
      results.password = true;
    }

    // Focus the CAPTCHA input so user can type immediately
    const captchaEl = findFirst(SEL.captcha);
    if (captchaEl) {
      captchaEl.focus();
      highlight(captchaEl, "#e90");
      results.captchaFocused = true;
    }

    return results;
  }

  // ── OTP fill ──

  function fillOtp(otpValue) {
    const otpEl = findFirst(SEL.otp);
    if (!otpEl) return { ok: false, error: "OTP field not found" };
    nativeSet(otpEl, otpValue);
    highlight(otpEl, "#2a7");
    return { ok: true };
  }

  // ── Click login / submit button ──

  function clickLogin() {
    // Try specific login buttons first, then generic submit
    const btn = findFirst(SEL.loginButton);
    if (btn) {
      btn.click();
      return { ok: true, clicked: true };
    }
    // Fallback: find any visible button whose text says login/sign in/submit
    const allBtns = document.querySelectorAll("button, input[type='submit'], a.btn");
    for (const b of allBtns) {
      const txt = (b.textContent || b.value || "").toLowerCase();
      if (/(sign\s*in|log\s*in|submit|verify)/i.test(txt) && b.offsetParent !== null) {
        b.click();
        return { ok: true, clicked: true };
      }
    }
    return { ok: false, error: "No login/submit button found" };
  }

  // ── Overlay notification on page ──

  function showOverlay(message, type) {
    const existing = document.getElementById("mca-assist-overlay");
    if (existing) existing.remove();

    const colors = {
      info: { bg: "#111", icon: "🔑" },
      success: { bg: "#1a6b3c", icon: "✓" },
      warning: { bg: "#b45309", icon: "⚠" },
      waiting: { bg: "#1e40af", icon: "⏳" },
    };
    const c = colors[type] || colors.info;

    const el = document.createElement("div");
    el.id = "mca-assist-overlay";
    el.innerHTML = `
      <div style="position:fixed;top:12px;right:12px;z-index:99999;background:${c.bg};color:#fff;
        padding:14px 18px;border-radius:10px;font:13px/1.5 'Segoe UI',system-ui,sans-serif;
        box-shadow:0 4px 24px rgba(0,0,0,.35);max-width:340px;display:flex;align-items:flex-start;gap:10px;
        animation:mcaSlideIn .3s ease-out;">
        <span style="font-size:18px;flex-shrink:0;margin-top:1px">${c.icon}</span>
        <span style="flex:1">${message}</span>
        <button onclick="this.parentElement.parentElement.remove()"
          style="background:rgba(255,255,255,.15);border:none;color:#fff;cursor:pointer;
          font-size:14px;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;
          flex-shrink:0;">✕</button>
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      @keyframes mcaSlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
      }
    `;
    el.appendChild(style);
    document.body.appendChild(el);

    if (type !== "waiting") {
      setTimeout(() => el.remove(), 8000);
    }
    return el;
  }

  // ── Auto-detect & auto-fill on page load ──

  async function autoDetectAndFill() {
    const page = detectPage();
    if (!page.isLoginPage && !page.isOtpPage) return;

    let data;
    try {
      data = await chrome.storage.local.get(["mcaAutoLogin", "mcaUsername", "mcaPassword"]);
    } catch { return; }

    if (!data.mcaAutoLogin || !data.mcaUsername) return;

    if (page.isLoginPage) {
      emitStep("open_mca", "done", { detail: "Login page detected" });
      setTimeout(() => {
        const result = fillLogin(data.mcaUsername, data.mcaPassword);
        if (result.username || result.password) {
          emitStep("fill_login", "done", { detail: "Credentials filled" });
          if (page.hasCaptcha) {
            emitStep("captcha", "active", { detail: "Please solve the CAPTCHA" });
            showOverlay(
              "<b>Credentials filled!</b><br>Please solve the CAPTCHA and click <b>Sign In</b>.",
              "waiting"
            );
          } else {
            emitStep("captcha", "done", { detail: "No CAPTCHA required" });
            showOverlay(
              "<b>Credentials filled!</b><br>Click <b>Sign In</b> to continue.",
              "success"
            );
          }
        }
        chrome.runtime.sendMessage({
          action: "LOGIN_AUTO_FILLED",
          ...page,
          fillResult: result,
        });
      }, 1200);
    }

    if (page.isOtpPage) {
      emitStep("captcha", "done", { detail: "CAPTCHA solved" });
      emitStep("otp", "active", { detail: "Waiting for OTP from user" });
      showOverlay(
        "<b>OTP Required</b><br>Enter the OTP sent to your registered mobile/email, then click <b>Verify</b>.",
        "waiting"
      );
      chrome.runtime.sendMessage({
        action: "OTP_PAGE_DETECTED",
        ...page,
      });
    }
  }

  // ── Watch for post-login navigation & form pages ──

  let lastUrl = window.location.href;

  function onUrlChange() {
    if (window.location.href === lastUrl) return;
    lastUrl = window.location.href;

    setTimeout(() => {
      const page = detectPage();
      chrome.runtime.sendMessage({
        action: "PAGE_NAVIGATED",
        ...page,
      });

      if (page.pageType === "dashboard") {
        chrome.storage.local.get(["mcaAutomationActive", "mcaSelectedForm"], (sdata) => {
          if (sdata.mcaAutomationActive) {
            const formNames = { spice_a: "SPICe+ Part A", inc32: "INC-32", dir3: "DIR-3 KYC", aoc4: "AOC-4", aoc4_offline: "AOC-4 Offline" };
            const fname = formNames[sdata.mcaSelectedForm] || "your target form";
            showOverlay(`<b>Logged in!</b><br>Now navigate to <b>${fname}</b>. Auto-fill will activate when the form loads.`, "success");
          } else {
            showOverlay("Logged in successfully! Navigate to your form.", "success");
          }
        });
      }
      if (page.isOtpPage) {
        emitStep("captcha", "completed");
        emitStep("otp", "active");
        showOverlay(
          "<b>OTP Required</b><br>Enter the OTP sent to your registered mobile/email.",
          "waiting"
        );
      }
      if (page.pageType === "form") {
        emitStep("otp", "completed");
        emitStep("detect_form", "completed");
        emitStep("fill_fields", "active");
        checkAndAutoFillForm();
      }
    }, 1500);
  }

  // Poll for URL changes (covers SPA navigation)
  setInterval(onUrlChange, 1000);

  // Also watch for DOM changes that signal page transitions
  const navObserver = new MutationObserver(() => {
    onUrlChange();
    // Re-check for login/OTP fields that appeared dynamically
    const page = detectPage();
    if (page.isLoginPage || page.isOtpPage) {
      autoDetectAndFill();
    }
  });
  navObserver.observe(document.body, { childList: true, subtree: true });

  // ── Scan all visible form fields on current page ──

  function scanFormFields() {
    const fields = [];
    const seen = new Set();
    document.querySelectorAll("input, select, textarea").forEach(el => {
      if (el.offsetParent === null) return;
      const tag = el.tagName.toLowerCase();
      const type = el.getAttribute("type") || tag;
      if (["hidden", "submit", "button", "image", "reset"].includes(type)) return;

      const name = el.getAttribute("name") || "";
      const id = el.getAttribute("id") || "";
      const key = `${tag}__${name}__${id}`;
      if (seen.has(key)) return;
      seen.add(key);

      const label = (() => {
        if (id) {
          const lbl = document.querySelector(`label[for="${id}"]`);
          if (lbl) return lbl.innerText.trim().slice(0, 80);
        }
        let p = el.parentElement;
        for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
          if (p.tagName === "LABEL") return p.innerText.trim().slice(0, 80);
        }
        return el.getAttribute("placeholder") || el.getAttribute("aria-label") || "";
      })();

      fields.push({
        tag, type, name, id, label: label || name || id,
        placeholder: el.getAttribute("placeholder") || "",
        value: el.value || "",
        selector: id ? `#${id}` : name ? `[name="${name}"]` : "",
      });
    });
    return fields;
  }

  // ── Auto-fill form fields from saved profile ──

  function autoFillFormFromProfile(profile) {
    if (!profile || typeof profile !== "object") return { ok: false, error: "No profile data" };

    const fields = scanFormFields();
    const filled = [];
    const skipped = [];

    for (const field of fields) {
      const fieldKey = (field.label + " " + field.name + " " + field.id + " " + field.placeholder).toLowerCase();
      let matched = false;

      for (const [profileKey, profileValue] of Object.entries(profile)) {
        if (!profileValue) continue;
        const pk = profileKey.toLowerCase();
        if (fieldKey.includes(pk) || pk.includes(field.name.toLowerCase()) || pk.includes(field.id.toLowerCase())) {
          const el = field.selector ? document.querySelector(field.selector) : null;
          if (el && el.offsetParent !== null) {
            nativeSet(el, profileValue);
            highlight(el, "#2a7");
            filled.push({ label: field.label || field.name, value: profileValue });
            matched = true;
            break;
          }
        }
      }

      if (!matched && field.type !== "password") {
        skipped.push({ label: field.label || field.name, reason: "No matching profile data" });
      }
    }

    return { ok: true, filled, skipped, totalFields: fields.length };
  }

  // ── Auto-fill form after login (automation mode) ──

  let formAutoFillDone = false;

  function fillSelectEl(el, value) {
    const options = Array.from(el.options);
    const norm = v => String(v ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    const target = norm(value);
    let matches = options.filter(o => o.value === String(value));
    if (matches.length !== 1) matches = options.filter(o => norm(o.textContent) === target);
    if (matches.length !== 1) matches = options.filter(o => norm(o.textContent).includes(target) || target.includes(norm(o.textContent)));
    if (matches.length < 1) return false;
    el.value = matches[0].value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function fillRadioGroupEl(selectorStr, value) {
    const norm = v => String(v ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    const target = norm(value);
    const elements = [];
    for (const sel of selectorStr.split(",").map(s => s.trim())) {
      try { document.querySelectorAll(sel).forEach(el => elements.push(el)); } catch {}
    }
    for (const radio of elements.filter(el => el.offsetParent !== null && !el.disabled)) {
      const labels = [radio.value, radio.getAttribute("aria-label"), radio.getAttribute("title")];
      if (radio.labels) labels.push(...Array.from(radio.labels, l => l.innerText));
      const wrap = radio.closest("label");
      if (wrap) labels.push(wrap.innerText);
      if (radio.nextElementSibling) labels.push(radio.nextElementSibling.innerText);
      if (labels.some(l => norm(l) === target)) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
        if (setter) setter.call(radio, true); else radio.checked = true;
        radio.dispatchEvent(new Event("input", { bubbles: true }));
        radio.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function autoFillSpiceFields(formData) {
    if (typeof SPICE_PART_A_FIELDS === "undefined") return 0;
    const ct = formData.companyType || "";
    const isLLP = ct === "LLP";
    const values = {
      proposedName1: formData.proposedName1 || "",
      proposedName2: formData.proposedName2 || "",
      proposedName3: formData.proposedName3 || "",
      "Language": "English",
      "Company type": isLLP ? "LLP" : "Company",
      "Company class": isLLP ? "" : (formData.companyClass || ""),
      "Company category": isLLP ? "" : (formData.companyCategory || ""),
      "Company sub-category": isLLP ? "" : (formData.companySubCategory || ""),
      "LLPIN/CIN type": isLLP ? "LLPIN" : (ct ? "CIN" : ""),
      "LLPIN": formData.llpin || "",
      "NIC code": formData.nicCode || "",
      "Business activity": formData.mainActivity || "",
    };
    let filled = 0;
    for (const fieldDef of SPICE_PART_A_FIELDS) {
      const value = values[fieldDef.dataKey];
      if (!value) continue;
      if (fieldDef.type === "radio") {
        if (fillRadioGroupEl(fieldDef.selector, value)) filled++;
        continue;
      }
      const selectors = fieldDef.selector.split(",").map(s => s.trim());
      const el = findFirst(selectors);
      if (!el) continue;
      const tag = el.tagName.toLowerCase();
      if (tag === "select") {
        if (fillSelectEl(el, value)) { highlight(el, "#2a7"); filled++; }
      } else {
        nativeSet(el, value);
        highlight(el, "#2a7");
        filled++;
      }
    }
    return filled;
  }

  function autoFillAoc4Fields(formData) {
    const fieldMap = typeof AOC4_FIELDS !== "undefined" ? AOC4_FIELDS : (typeof AOC4_OFFLINE_FIELDS !== "undefined" ? AOC4_OFFLINE_FIELDS : null);
    if (!fieldMap) return 0;
    let filled = 0;

    for (const fieldDef of fieldMap) {
      const value = formData[fieldDef.dataKey];
      if (!value) continue;
      const labels = document.querySelectorAll("label, span, td, th");
      for (const lbl of labels) {
        const txt = lbl.innerText?.trim().toLowerCase() || "";
        if (!txt.includes((fieldDef.matchLabel || fieldDef.label || "").toLowerCase())) continue;

        const container = lbl.closest("tr, div, fieldset") || lbl.parentElement;
        if (!container) continue;

        let el = null;
        if (fieldDef.type === "select") {
          el = container.querySelector("select");
        } else if (fieldDef.type === "date") {
          el = container.querySelector("input[type='date'], input[type='text']");
        } else {
          el = container.querySelector("input[type='text'], input:not([type]), textarea");
        }
        if (!el || el.disabled || el.readOnly) continue;
        if (el.value && el.value.trim()) continue;

        if (el.tagName.toLowerCase() === "select") {
          if (fillSelectEl(el, value)) { highlight(el, "#2a7"); filled++; }
        } else {
          nativeSet(el, value);
          highlight(el, "#2a7");
          filled++;
        }
        break;
      }
    }
    return filled;
  }

  function autoFillAoc4OfflineFields(formData) {
    if (typeof AOC4_OFFLINE_FIELDS === "undefined") return 0;
    let filled = 0;

    for (const fieldDef of AOC4_OFFLINE_FIELDS) {
      const value = formData[fieldDef.dataKey];
      if (!value) continue;

      if (fieldDef.type === "radio") {
        const labels = document.querySelectorAll("label, span, td");
        for (const lbl of labels) {
          const txt = lbl.innerText?.trim().toLowerCase() || "";
          if (!txt.includes(fieldDef.matchLabel.toLowerCase())) continue;
          const container = lbl.closest("tr, div, fieldset, td") || lbl.parentElement;
          if (!container) continue;
          const radios = container.querySelectorAll("input[type='radio']");
          for (const radio of radios) {
            const rLabels = [radio.value, radio.getAttribute("aria-label")];
            if (radio.labels) rLabels.push(...Array.from(radio.labels, l => l.innerText));
            if (radio.nextElementSibling) rLabels.push(radio.nextElementSibling.innerText);
            const norm = s => String(s ?? "").trim().toLowerCase();
            if (rLabels.some(l => norm(l) === norm(value))) {
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
              if (setter) setter.call(radio, true); else radio.checked = true;
              radio.dispatchEvent(new Event("input", { bubbles: true }));
              radio.dispatchEvent(new Event("change", { bubbles: true }));
              filled++;
              break;
            }
          }
          break;
        }
        continue;
      }

      const labels = document.querySelectorAll("label, span, td, th");
      for (const lbl of labels) {
        const txt = lbl.innerText?.trim().toLowerCase() || "";
        if (!txt.includes(fieldDef.matchLabel.toLowerCase())) continue;

        const container = lbl.closest("tr, div, fieldset") || lbl.parentElement;
        if (!container) continue;

        let el = null;
        if (fieldDef.type === "select") {
          el = container.querySelector("select");
        } else if (fieldDef.type === "date") {
          el = container.querySelector("input[type='date'], input[type='text']");
        } else {
          el = container.querySelector("input[type='text'], input:not([type]), textarea");
        }
        if (!el || el.disabled || el.readOnly) continue;
        if (el.value && el.value.trim()) continue;

        if (el.tagName.toLowerCase() === "select") {
          if (fillSelectEl(el, value)) { highlight(el, "#2a7"); filled++; }
        } else {
          nativeSet(el, value);
          highlight(el, "#2a7");
          filled++;
        }
        break;
      }
    }
    return filled;
  }

  async function checkAndAutoFillForm() {
    if (formAutoFillDone) return;

    const page = detectPage();
    if (page.pageType !== "form") return;

    let data;
    try {
      data = await chrome.storage.local.get(["mcaAutomationActive", "mcaFormData", "mcaSelectedForm"]);
    } catch { return; }

    if (!data.mcaAutomationActive || !data.mcaFormData) return;

    formAutoFillDone = true;
    showOverlay("<b>Form detected!</b><br>Auto-filling fields...", "info");

    await new Promise(r => setTimeout(r, 2500));

    const formData = data.mcaFormData;
    const formType = data.mcaSelectedForm || "spice_a";
    let filledCount = 0;

    try {
      if (formType === "aoc4_offline") {
        filledCount += autoFillAoc4OfflineFields(formData);
      } else if (formType === "aoc4") {
        filledCount += autoFillAoc4Fields(formData);
      } else {
        filledCount += autoFillSpiceFields(formData);
      }
    } catch (err) {
      emitStep("fill_fields", "error", {
        message: err?.message || "Fill failed",
        error: stepError("E-FILL-06", err?.message || "Fill failed", "Check the client data profile covers this form.")
      });
      writeLog("error", `E-FILL-06: ${err?.message || "Fill failed"} (formType=${formType})`);
    }

    try {
      const profile = {
        name: formData.name || "",
        din: formData.din || "",
        pan: formData.pan || "",
        email: formData.email || "",
        mobile: formData.mobile || "",
        dob: formData.dob || "",
        address: formData.address || "",
        city: formData.city || "",
        state: formData.state || "",
        pincode: formData.pincode || "",
      };
      const profileResult = autoFillFormFromProfile(profile);
      if (profileResult?.ok) filledCount += (profileResult.filled?.length || 0);
    } catch {}

    showOverlay(
      `<b>Auto-fill complete!</b><br>${filledCount} fields filled. Review and submit manually.`,
      "success"
    );

    if (filledCount > 0) {
      emitStep("fill_fields", "done", { detail: `${filledCount} fields filled` });
      emitStep("done", "done", { message: `${filledCount} fields filled`, detail: `${filledCount} fields filled` });
      writeLog("success", `Auto-fill complete: ${filledCount} fields filled (formType=${formType})`);
    } else {
      emitStep("fill_fields", "error", {
        message: "No fields matched",
        error: stepError("E-FILL-06", "No fields matched the client data profile",
          "Check that the client data profile covers this form's fields.")
      });
      writeLog("error", `E-FILL-06: No fields matched (formType=${formType})`);
    }

    chrome.storage.local.set({ mcaAutomationActive: false });
  }

  // ── Message listener ──

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const action = msg?.action;

    if (action === "DETECT_LOGIN_PAGE") {
      sendResponse({ ok: true, ...detectPage() });
      return;
    }

    if (action === "FILL_LOGIN") {
      const result = fillLogin(msg.username, msg.password);
      if (result.username || result.password) {
        const page = detectPage();
        if (page.hasCaptcha) {
          showOverlay("<b>Credentials filled!</b><br>Solve the CAPTCHA and click Sign In.", "waiting");
        } else {
          showOverlay("<b>Credentials filled!</b>", "success");
        }
      }
      sendResponse({ ok: true, ...result });
      return;
    }

    if (action === "FILL_OTP") {
      const result = fillOtp(msg.otp);
      sendResponse(result);
      return;
    }

    if (action === "CLICK_LOGIN_BTN") {
      const result = clickLogin();
      sendResponse(result);
      return;
    }

    if (action === "SCAN_PAGE_FORMS") {
      const fields = scanFormFields();
      sendResponse({ ok: true, fields, url: window.location.href, title: document.title });
      return;
    }

    if (action === "AUTO_FILL_PROFILE") {
      const result = autoFillFormFromProfile(msg.profile);
      sendResponse(result);
      return;
    }

    if (action === "SHOW_OVERLAY") {
      showOverlay(msg.message, msg.type || "info");
      sendResponse({ ok: true });
      return;
    }
  });

  // ── Init ──
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(autoDetectAndFill, 800);
  } else {
    window.addEventListener("DOMContentLoaded", () => setTimeout(autoDetectAndFill, 800));
  }
})();
