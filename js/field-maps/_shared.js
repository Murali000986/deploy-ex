// Shared helpers for all per-form fillers (ISOLATED-world content script).
// These functions mirror the semantics from extension/login-assist.js so the
// per-form fillers can reuse them without duplicating the logic.

(function (root) {
  "use strict";
  if (root.__aocSharedLoaded) return;
  root.__aocSharedLoaded = true;

  // Label-mapping tables used by SPICe+/INC-32 fillers.
  const COMPANY_TYPE_MAP = {
    PRIVATE_LIMITED: "Private",
    OPC: "One Person Company",
    PUBLIC_LIMITED: "Public",
  };
  const COMPANY_FORM_MAP = {
    PRIVATE_LIMITED: "Company",
    OPC: "Company",
    LLP: "LLP",
    PUBLIC_LIMITED: "Company",
  };
  const COMPANY_CATEGORY_MAP = {
    PRIVATE_LIMITED: "Company limited by Shares",
    OPC: "Company limited by Shares",
    PUBLIC_LIMITED: "Company limited by Shares",
  };

  // AEM-ish Angular field name regex — these inputs own their own blur/change
  // bindings and misbehave when a blur event is fired synthetically.
  const AEM_NAME_RE = /___jqName|guideContainer-rootPanel/;

  function findFirst(selectors) {
    const list = Array.isArray(selectors)
      ? selectors
      : String(selectors).split(",").map(function (s) { return s.trim(); });
    for (var i = 0; i < list.length; i++) {
      try {
        var el = document.querySelector(list[i]);
        if (el && el.offsetParent !== null && !el.disabled) return el;
      } catch (_) { /* bad selector */ }
    }
    return null;
  }

  function nativeSet(el, value) {
    if (!el) return;
    var proto =
      el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, "value");
    setter = setter && setter.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    // Only fire blur on non-Angular fields — AEM re-validates on blur and
    // can clear the value for fields it owns otherwise.
    if (!AEM_NAME_RE.test(el.name || "") && !AEM_NAME_RE.test(el.id || "")) {
      el.dispatchEvent(new Event("blur", { bubbles: true }));
    }
  }

  function fillSelectEl(el, value) {
    if (!el || el.tagName !== "SELECT") return false;
    var options = Array.prototype.slice.call(el.options);
    var norm = function (v) {
      return String(v == null ? "" : v)
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
    };
    var target = norm(value);
    var m = options.filter(function (o) { return o.value === String(value); });
    if (m.length !== 1) m = options.filter(function (o) { return norm(o.textContent) === target; });
    if (m.length !== 1) {
      m = options.filter(function (o) {
        var t = norm(o.textContent);
        return t.indexOf(target) !== -1 || target.indexOf(t) !== -1;
      });
    }
    if (!m.length) return false;
    el.value = m[0].value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function fillRadioGroupEl(selectorStr, value) {
    var norm = function (v) {
      return String(v == null ? "" : v)
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");
    };
    var target = norm(value);
    var sels = String(selectorStr).split(",").map(function (s) { return s.trim(); });
    var radios = [];
    sels.forEach(function (sel) {
      try {
        document.querySelectorAll(sel).forEach(function (el) { radios.push(el); });
      } catch (_) {}
    });
    var visible = radios.filter(function (el) { return el.offsetParent !== null && !el.disabled; });
    for (var i = 0; i < visible.length; i++) {
      var r = visible[i];
      var labels = [r.value, r.getAttribute("aria-label"), r.getAttribute("title")];
      if (r.labels) Array.prototype.forEach.call(r.labels, function (l) { labels.push(l.innerText); });
      var wrap = r.closest("label");
      if (wrap) labels.push(wrap.innerText);
      if (r.nextElementSibling) labels.push(r.nextElementSibling.innerText);
      if (labels.some(function (l) { return norm(l) === target; })) {
        var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "checked");
        setter = setter && setter.set;
        if (setter) setter.call(r, true);
        else r.checked = true;
        r.dispatchEvent(new Event("input", { bubbles: true }));
        r.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function highlight(el, color) {
    if (!el) return;
    var prev = el.style.outline;
    el.style.outline = "3px solid " + (color || "#2a7");
    el.style.outlineOffset = "1px";
    setTimeout(function () {
      el.style.outline = prev;
      el.style.outlineOffset = "";
    }, 4000);
  }

  // Scope lookup to a specific row or section — fixes the "first substring
  // match" bug when multiple sections repeat the same label.
  function scopeFor(fieldDef, root) {
    root = root || document;
    if (fieldDef.sectionHeading) {
      var heads = root.querySelectorAll("h1,h2,h3,h4,h5,legend,strong,caption");
      for (var i = 0; i < heads.length; i++) {
        var txt = (heads[i].textContent || "").trim().toLowerCase();
        if (txt.indexOf(fieldDef.sectionHeading.toLowerCase()) !== -1) {
          var section = heads[i].closest("section,fieldset,div,tbody,table") || heads[i].parentElement;
          if (section) return section;
        }
      }
    }
    if (fieldDef.rowIndex != null) {
      var rows = root.querySelectorAll("tr, .form-row");
      if (rows[fieldDef.rowIndex]) return rows[fieldDef.rowIndex];
    }
    return root;
  }

  root.AocShared = {
    COMPANY_TYPE_MAP: COMPANY_TYPE_MAP,
    COMPANY_FORM_MAP: COMPANY_FORM_MAP,
    COMPANY_CATEGORY_MAP: COMPANY_CATEGORY_MAP,
    findFirst: findFirst,
    nativeSet: nativeSet,
    fillSelectEl: fillSelectEl,
    fillRadioGroupEl: fillRadioGroupEl,
    highlight: highlight,
    scopeFor: scopeFor,
  };
})(typeof window !== "undefined" ? window : globalThis);
