// Content script — runs on https://www.mca.gov.in/*
// Receives messages from the background service worker.
// Fills, validates, or clears SPICe+ Part A form fields.
// SPICE_PART_A_FIELDS and MCA mapping tables are defined in field-map.js (injected first)

(function () {
  "use strict";

  // Prevent duplicate listeners if the background worker has to inject this
  // script into a tab that was already open when the extension was loaded.
  if (window.__ledgerlyMcaAssistantLoaded) return;
  window.__ledgerlyMcaAssistantLoaded = true;

  /** Try each comma-separated selector until one matches. Returns element or null. */
  function findElements(selectorList) {
    const matches = new Set();
    for (const sel of selectorList.split(",").map(s => s.trim())) {
      try {
        document.querySelectorAll(sel).forEach(el => matches.add(el));
      } catch { /* invalid selector — skip */ }
    }
    return Array.from(matches);
  }
  function isUsableField(el) {
    return el.type !== "hidden" && !el.disabled && el.getClientRects().length > 0;
  }
  function findElement(selectorList) { return findElements(selectorList).find(isUsableField) || null; }

  function normalizeChoice(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\*/g, "").replace(/\s+/g, " ");
  }

  /** Fill a text input. Dispatches input + change so the page recognizes the value. */
  function fillText(el, value) {
    const prototype = el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const nativeInputSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (nativeInputSetter) nativeInputSetter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Select a dropdown option by value or visible text (case-insensitive partial match). */
  function fillSelect(el, value) {
    const options = Array.from(el.options);
    let matches = options.filter(o => o.value === String(value));
    if (matches.length !== 1) {
      const choice = normalizeChoice(value);
      matches = options.filter(o => normalizeChoice(o.textContent) === choice);
    }
    if (matches.length !== 1) return false;
    const opt = matches[0];
    el.value = opt.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  /** Select one radio only when its value or visible label exactly matches the draft. */
  function fillRadioGroup(elements, value) {
    const target = normalizeChoice(value);
    const matches = elements.filter(el => {
      const labels = [el.value, el.getAttribute("aria-label"), el.getAttribute("title")];
      if (el.labels) labels.push(...Array.from(el.labels, label => label.innerText || label.textContent));
      const wrappingLabel = el.closest("label");
      if (wrappingLabel) labels.push(wrappingLabel.innerText || wrappingLabel.textContent);
      if (el.nextElementSibling) labels.push(el.nextElementSibling.innerText || el.nextElementSibling.textContent);
      const parent = el.parentElement;
      if (parent && parent.querySelectorAll("input[type='radio']").length === 1) {
        labels.push(parent.innerText || parent.textContent);
      }
      return labels.some(label => normalizeChoice(label) === target);
    });
    if (matches.length !== 1) return false;

    const radio = matches[0];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
    if (setter) setter.call(radio, true);
    else radio.checked = true;
    radio.dispatchEvent(new Event("input", { bubbles: true }));
    radio.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  /** Apply an explicit boolean draft value to one mapped checkbox. */
  function fillCheckbox(el, value) {
    const choice = normalizeChoice(value);
    const checked = ["true", "yes", "1", "checked"].includes(choice)
      ? true
      : ["false", "no", "0", "unchecked"].includes(choice)
        ? false
        : null;
    if (checked === null) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
    if (setter) setter.call(el, checked);
    else el.checked = checked;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  /** Map draft data to field values. */
  function buildFieldValues(draft) {
    const names = (draft.proposedNames || []).map(n => n.name);
    const sf = draft.submittedFields || {};
    const ct = draft.companyType || "";
    const isLLP = ct === "LLP" || /^(LLP|Limited Liability Partnership)$/i.test(sf["Company type"] || "");
    return {
      proposedName1: names[0] || "",
      proposedName2: names[1] || "",
      proposedName3: names[2] || "",
      "Company type": COMPANY_FORM_MAP[ct] || sf["Company type"] || "",
      "Company class": isLLP ? "" : COMPANY_TYPE_MAP[ct] || sf["Company class"] || sf["Company type"] || "",
      "Company category": isLLP ? "" : COMPANY_CATEGORY_MAP[ct] || sf["Company category"] || "",
      "Company sub-category": isLLP ? "" : sf["Company sub-category"] || "",
      "LLPIN/CIN type": isLLP ? "LLPIN" : ct ? "CIN" : sf["LLPIN/CIN type"] || "",
      "NIC code": sf["NIC code"] || "",
      "Business activity": sf["Business activity"] || "",
      "Trademark number": sf["Trademark number"] || "",
      "LLPIN": sf["LLPIN"] || "",
      "Language": sf["Language"] || "",
      "Request type": sf["Request type"] || "",
      "CIN": sf["CIN"] || "",
      "Comments": sf["Comments"] || "",
    };
  }

  /** Process one field. Returns result object. */
  function processField(fieldDef, values, write) {
    const rawValue = values[fieldDef.dataKey] ?? "";
    const result = { key: fieldDef.key, label: fieldDef.label, status: "skipped", reason: "" };

    const missingValue = rawValue === null || rawValue === undefined ||
      (typeof rawValue === "string" && rawValue.trim() === "");
    if (missingValue && fieldDef.optional) {
      result.reason = "Optional — no value";
      return result;
    }
    if (missingValue) {
      result.status = "skipped";
      result.reason = "No value in draft";
      return result;
    }

    const elements = findElements(fieldDef.selector).filter(isUsableField);
    const el = elements[0] || null;
    if (!el) {
      result.status = "skipped";
      result.reason = "Field not present on this page";
      return result;
    }

    if (!write) {
      // Validate-only
      result.status = "needs-review";
      result.reason = `Would fill: "${rawValue}"`;
      return result;
    }

    try {
      const tag = el.tagName.toLowerCase();
      if (fieldDef.type === "radio") {
        const ok = fillRadioGroup(elements, rawValue);
        if (ok) result.status = "filled";
        else { result.status = "invalid"; result.reason = `No unique radio option matches "${rawValue}"`; }
      } else if (fieldDef.type === "checkbox") {
        const ok = fillCheckbox(el, rawValue);
        if (ok) result.status = "filled";
        else { result.status = "invalid"; result.reason = `Checkbox value must be an explicit true/false choice`; }
      } else if (tag === "select") {
        const ok = fillSelect(el, rawValue);
        if (ok) { result.status = "filled"; }
        else { result.status = "invalid"; result.reason = `Option "${rawValue}" not in dropdown`; }
      } else if (tag === "input" || tag === "textarea") {
        fillText(el, rawValue);
        result.status = "filled";
      } else {
        result.status = "skipped";
        result.reason = `Unsupported element type: ${tag}`;
      }
    } catch (e) {
      result.status = "invalid";
      result.reason = `Fill error: ${e.message}`;
    }
    return result;
  }

  /** Wait for form to be present (up to 5s). */
  function waitForForm(timeout = 5000) {
    return new Promise((resolve) => {
      const formCheck = () => {
        const hasAny = SPICE_PART_A_FIELDS.some(f => findElement(f.selector));
        if (hasAny) return resolve(true);
      };
      formCheck();
      const obs = new MutationObserver(formCheck);
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); resolve(false); }, timeout);
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const action = message?.action;

    if (action === "DETECT_PAGE") {
      const isSpice = window.location.href.includes("mca.gov.in") &&
        (document.title.toLowerCase().includes("spice") ||
         document.querySelector("input[name='proposedName1']") !== null ||
         document.querySelector("input[name='companyClass']") !== null);
      sendResponse({
        ok: true,
        url: window.location.href,
        title: document.title,
        isSpicePartA: isSpice,
        formPresent: SPICE_PART_A_FIELDS.some(f => findElement(f.selector)),
      });
      return;
    }

    if (action === "VALIDATE_FIELDS") {
      const draft = message.draft;
      const values = buildFieldValues(draft);
      const results = SPICE_PART_A_FIELDS.map(f => processField(f, values, false));
      sendResponse({ ok: true, results });
      return;
    }

    if (action === "FILL_FORM") {
      const draft = message.draft;
      if (!draft) { sendResponse({ ok: false, error: "No draft provided" }); return; }
      const values = buildFieldValues(draft);

      waitForForm().then(formReady => {
        if (!formReady) {
          sendResponse({ ok: false, error: "SPICe+ Part A form fields not detected on this page. Please navigate to the correct form page." });
          return;
        }
        const results = SPICE_PART_A_FIELDS.map(f => processField(f, values, true));
        const filled = results.filter(r => r.status === "filled").length;
        const skipped = results.filter(r => r.status === "skipped").length;
        const invalid = results.filter(r => r.status === "invalid").length;
        // Notify the page so mock form can display result panel
        document.dispatchEvent(new CustomEvent("ledgerly:fillResult", { detail: { results, summary: { filled, skipped, invalid } } }));
        sendResponse({ ok: true, results, summary: { filled, skipped, invalid } });
      });
      return true; // async
    }

    if (action === "CLEAR_FORM") {
      const cleared = [];
      SPICE_PART_A_FIELDS.forEach(f => {
        const elements = findElements(f.selector).filter(isUsableField);
        const el = elements[0];
        if (!el) return;
        if (f.type === "radio" || f.type === "checkbox") {
          let changed = false;
          elements.forEach(control => {
            if (!control.checked) return;
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked")?.set;
            if (setter) setter.call(control, false);
            else control.checked = false;
            control.dispatchEvent(new Event("input", { bubbles: true }));
            control.dispatchEvent(new Event("change", { bubbles: true }));
            changed = true;
          });
          if (changed) cleared.push(f.key);
          return;
        }
        const tag = el.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea") fillText(el, "");
        else if (tag === "select") { el.selectedIndex = 0; el.dispatchEvent(new Event("change", { bubbles: true })); }
        cleared.push(f.key);
      });
      sendResponse({ ok: true, cleared });
      return;
    }

    if (action === "TEST_FILL") {
      // Try selectors from the message first, then fall back to any visible text input
      const testValue = message.value || "Ledgerly ✓";
      const candidates = message.selectors || ["#searchbox", "input[name='query']", "input[type='search']", "input[type='text']"];
      let filled = null;
      for (const sel of candidates) {
        try {
          const el = document.querySelector(sel);
          if (!el) continue;
          if (el.offsetParent === null) continue; // skip hidden
          // Fill using native setter so React/Angular apps react
          const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          if (setter) setter.call(el, testValue); else el.value = testValue;
          el.dispatchEvent(new Event("input",  { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.style.outline = "2px solid #003366";
          setTimeout(() => { el.style.outline = ""; }, 3000);
          filled = { selector: sel, tag: el.tagName.toLowerCase(), id: el.id || "", name: el.name || "" };
          break;
        } catch { /* skip */ }
      }
      if (filled) {
        sendResponse({ ok: true, filled, value: testValue, url: window.location.href });
      } else {
        sendResponse({ ok: false, error: "No visible text input found on this page to test with." });
      }
      return;
    }

    if (action === "SCAN_FIELDS") {
      // Collect all input/select/textarea fields on the page — no DevTools needed
      const seen = new Set();
      const fields = [];
      document.querySelectorAll("input, select, textarea").forEach(el => {
        const tag  = el.tagName.toLowerCase();
        const name = el.getAttribute("name") || "";
        const id   = el.getAttribute("id") || "";
        const type = el.getAttribute("type") || tag;
        const placeholder = el.getAttribute("placeholder") || "";
        const label = (() => {
          // Try to find associated <label>
          if (id) {
            const lbl = document.querySelector(`label[for="${id}"]`);
            if (lbl) return lbl.innerText.trim().slice(0, 60);
          }
          // Walk up to find parent label
          let p = el.parentElement;
          for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
            if (p.tagName === "LABEL") return p.innerText.trim().slice(0, 60);
          }
          return "";
        })();
        const key = `${tag}__${name}__${id}`;
        if (seen.has(key)) return;
        seen.add(key);
        // Skip hidden, submit, button, image types
        if (["hidden", "submit", "button", "image", "reset"].includes(type)) return;
        const fieldInfo = { tag, name, id, type, placeholder, label: label || placeholder || name || id };
        if (tag === "select") {
          fieldInfo.options = Array.from(el.options, option => ({
            label: (option.textContent || "").trim(),
            value: option.value,
          }));
        }
        if (type === "radio" || type === "checkbox") fieldInfo.checked = el.checked;
        fields.push(fieldInfo);
      });
      sendResponse({ ok: true, fields, url: window.location.href, title: document.title, total: fields.length });
      return;
    }
  });
})();
