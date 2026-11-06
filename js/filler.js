// Unified multi-form filler used by content_script.js in the ISOLATED world.
// Dispatches on formType and runs per-form processField pipeline. Returns a
// unified result shape and dispatches a 'aoc:fillResult' CustomEvent.

(function (root) {
  "use strict";
  if (root.Filler) return;

  const S = root.AocShared || {};

  function processField(fieldDef, values, formType) {
    try {
      const value = values[fieldDef.dataKey];
      if (value == null || value === "") {
        return { dataKey: fieldDef.dataKey, label: fieldDef.label, status: "skipped", reason: "no value" };
      }
      // Resolve element.
      let el = null;
      let scope = document;
      if (fieldDef.sectionHeading || fieldDef.rowIndex != null) {
        scope = S.scopeFor ? S.scopeFor(fieldDef, document) : document;
      }
      if (fieldDef.selector) {
        el = S.findFirst ? S.findFirst(fieldDef.selector) : document.querySelector(fieldDef.selector);
      } else if (fieldDef.matchLabel) {
        // Label-match fallback: find any label-like element whose text contains matchLabel.
        const labels = scope.querySelectorAll("label, span, td, th, legend");
        const needle = String(fieldDef.matchLabel).toLowerCase();
        for (const lbl of labels) {
          const txt = (lbl.innerText || lbl.textContent || "").trim().toLowerCase();
          if (!txt.includes(needle)) continue;
          const container = lbl.closest("tr, div, fieldset") || lbl.parentElement;
          if (!container) continue;
          if (fieldDef.type === "select")      el = container.querySelector("select");
          else if (fieldDef.type === "date")   el = container.querySelector("input[type='date'], input[type='text']");
          else if (fieldDef.type === "textarea") el = container.querySelector("textarea");
          else if (fieldDef.type === "radio")  el = container.querySelector("input[type='radio']");
          else                                 el = container.querySelector("input[type='text'], input:not([type]), textarea");
          if (el && !el.disabled && !el.readOnly) break;
          el = null;
        }
      }
      if (!el) {
        return { dataKey: fieldDef.dataKey, label: fieldDef.label, status: "empty", reason: "not found" };
      }
      if (el.disabled || el.readOnly) {
        return { dataKey: fieldDef.dataKey, label: fieldDef.label, status: "invalid", reason: "read-only" };
      }
      // Radio.
      if (fieldDef.type === "radio" && fieldDef.selector) {
        const ok = S.fillRadioGroupEl && S.fillRadioGroupEl(fieldDef.selector, value);
        if (!ok) return { dataKey: fieldDef.dataKey, label: fieldDef.label, status: "invalid", reason: "no matching option" };
        return { dataKey: fieldDef.dataKey, label: fieldDef.label, status: "filled" };
      }
      // Select.
      if (el.tagName === "SELECT") {
        const ok = S.fillSelectEl && S.fillSelectEl(el, value);
        if (!ok) return { dataKey: fieldDef.dataKey, label: fieldDef.label, status: "invalid", reason: "no matching option" };
        if (S.highlight) S.highlight(el, "#2a7");
        if (fieldDef.manualAfterFill) {
          return { dataKey: fieldDef.dataKey, label: fieldDef.label, status: "needs-review", reason: "manual step required" };
        }
        return { dataKey: fieldDef.dataKey, label: fieldDef.label, status: "filled" };
      }
      // Text / date / number / textarea.
      if (S.nativeSet) S.nativeSet(el, value);
      else { el.value = value; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
      if (S.highlight) S.highlight(el, "#2a7");
      if (fieldDef.manualAfterFill) {
        return { dataKey: fieldDef.dataKey, label: fieldDef.label, status: "needs-review", reason: "manual step required (OTP)" };
      }
      return { dataKey: fieldDef.dataKey, label: fieldDef.label, status: "filled" };
    } catch (err) {
      return { dataKey: fieldDef.dataKey, label: fieldDef.label, status: "invalid", reason: err && err.message };
    }
  }

  function fieldsForForm(formType) {
    switch (formType) {
      case "aoc4":         return root.AOC4_FIELDS || [];
      case "aoc4_offline": return root.AOC4_OFFLINE_FIELDS || [];
      case "spice_a":      return root.SPICE_PART_A_FIELDS || [];
      case "inc32":        return root.INC32_FIELDS || [];
      case "dir3":         return root.DIR3_FIELDS || [];
      default:             return [];
    }
  }

  function summarize(fields) {
    const summary = { filled: 0, skipped: 0, invalid: 0, empty: 0, needsReview: 0 };
    for (const f of fields) {
      if (f.status === "filled")      summary.filled++;
      else if (f.status === "skipped") summary.skipped++;
      else if (f.status === "invalid") summary.invalid++;
      else if (f.status === "empty")   summary.empty++;
      else if (f.status === "needs-review") summary.needsReview++;
    }
    return summary;
  }

  function fill(formType, formData) {
    const fieldDefs = fieldsForForm(formType);
    if (!fieldDefs.length) {
      return { ok: false, formType: formType, err: { code: "ERR_FORM_UNSUPPORTED", title: "Unknown form", body: "No field map for " + formType, retryable: false }, summary: { filled: 0, skipped: 0, invalid: 0, needsReview: 0 }, fields: [] };
    }
    const results = [];
    for (const def of fieldDefs) {
      results.push(processField(def, formData || {}, formType));
    }
    const summary = summarize(results);
    const payload = {
      ok: summary.filled > 0 || results.length === 0,
      formType: formType,
      summary: { filled: summary.filled, skipped: summary.skipped, invalid: summary.invalid, needsReview: summary.needsReview },
      fields: results,
    };
    try {
      document.dispatchEvent(new CustomEvent("aoc:fillResult", { detail: payload }));
    } catch (_) {}
    return payload;
  }

  function scan(formType) {
    const defs = fieldsForForm(formType);
    const seen = [];
    for (const def of defs) {
      let el = null;
      if (def.selector) {
        el = S.findFirst ? S.findFirst(def.selector) : document.querySelector(def.selector);
      } else if (def.matchLabel) {
        const labels = document.querySelectorAll("label, span, td, th, legend");
        const needle = String(def.matchLabel).toLowerCase();
        for (const lbl of labels) {
          const txt = (lbl.innerText || lbl.textContent || "").trim().toLowerCase();
          if (!txt.includes(needle)) continue;
          const container = lbl.closest("tr, div, fieldset") || lbl.parentElement;
          if (container) el = container.querySelector("input, select, textarea");
          if (el) break;
        }
      }
      seen.push({ dataKey: def.dataKey, label: def.label, found: !!el, type: def.type || "text" });
    }
    return {
      url: location.href,
      inFrame: window !== window.top,
      formType: formType,
      totalExpected: defs.length,
      totalFound: seen.filter(function (s) { return s.found; }).length,
      fields: seen,
    };
  }

  function detectPage() {
    const url = location.href.toLowerCase();
    const forms = root.FORMS || {};
    for (const key in forms) {
      if (!Object.prototype.hasOwnProperty.call(forms, key)) continue;
      const patterns = forms[key].urlPatterns || [];
      for (const p of patterns) {
        if (p && p.test && p.test(url)) return { url: location.href, formType: key };
      }
    }
    return { url: location.href, formType: null };
  }

  root.Filler = {
    fill: fill,
    scan: scan,
    detectPage: detectPage,
    processField: processField,
  };
})(typeof window !== "undefined" ? window : globalThis);
