// Loaded Data Card controller — renders empty vs loaded state,
// prefill ratio bar, and per-section breakdown.

(function (root) {
  "use strict";
  if (root.DataCard) return;

  const SOURCE_LABEL = {
    bundled: "Bundled",
    imported: "Imported",
    dashboard: "Dashboard",
    manual: "Manual",
  };

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pctClass(pct) {
    if (pct >= 80) return "ok";
    if (pct >= 40) return "warn";
    return "skip";
  }

  async function render(formType) {
    const empty = document.getElementById("dataEmpty");
    const loaded = document.getElementById("dataLoaded");
    if (!empty || !loaded) return;

    let formData = {};
    let clientInfo = null;
    try {
      const r = await chrome.storage.local.get(["mcaFormData_" + formType, "clientInfo", "lastClient"]);
      formData = r["mcaFormData_" + formType] || {};
      clientInfo = r.clientInfo || null;
      // Fallback: for AOC-4 the legacy flow stores under lastClient.
      if (formType === "aoc4" && (!formData || !Object.keys(formData).length) && r.lastClient && r.lastClient.data) {
        formData = r.lastClient.data;
      }
    } catch (_) {}

    const hasData = formData && Object.keys(formData).length > 0;
    if (!hasData) {
      empty.classList.remove("hidden");
      loaded.classList.add("hidden");
      return;
    }
    empty.classList.add("hidden");
    loaded.classList.remove("hidden");

    const name = (clientInfo && clientInfo.name) || formData.displayName || formData.name || formData.companyName || "Loaded client";
    const cin = (clientInfo && clientInfo.cin) || formData.cin || formData.CIN || formData.din || "—";
    const fy = (clientInfo && clientInfo.fy)
      ? (clientInfo.fy.from || "") + " → " + (clientInfo.fy.to || "")
      : (formData.FY_FROM && formData.FY_TO ? formData.FY_FROM + " → " + formData.FY_TO
         : (formData.financialYearFrom && formData.financialYearTo ? formData.financialYearFrom + " → " + formData.financialYearTo : "—"));
    const source = (clientInfo && clientInfo.source) || "bundled";

    const n = document.getElementById("ciName");
    const c = document.getElementById("ciCin");
    const fyEl = document.getElementById("ciFy");
    const srcBadge = document.getElementById("ciSourceBadge");
    if (n) n.textContent = name;
    if (c) c.textContent = cin;
    if (fyEl) fyEl.textContent = fy;
    if (srcBadge) {
      srcBadge.textContent = SOURCE_LABEL[source] || "Bundled";
      srcBadge.dataset.src = source;
    }

    // Prefill ratio.
    let expected = (root.FORMS_REGISTRY && root.FORMS_REGISTRY.expectedFieldsFor(formType)) || 0;
    let defs = (root.FORMS_REGISTRY && root.FORMS_REGISTRY.fieldsFor(formType)) || [];
    // AOC-4 is filled from the field map in js/field-mapper.js (keys like CIN, SHARE_CAPITAL_CUR),
    // so count the client against that map, section by section.
    if (formType === "aoc4" && typeof FIELD_MAPPINGS !== "undefined" && typeof PHASES !== "undefined") {
      defs = FIELD_MAPPINGS.filter(f => f.kind !== "waitFor" && f.kind !== "addRows" && !f.manualOnly && f.key).map(f => {
        const ph = PHASES.find(p => p.id === f.phase);
        return { key: f.key, category: "p" + f.phase, categoryLabel: ph ? ph.label.replace(/^Phase (\d+) — /, "$1. ").split(" (")[0] : "Phase " + f.phase };
      });
      expected = new Set(defs.map(d => d.key)).size;
    }
    let haveCount = 0;
    const counted = new Set();
    const perCategory = {};
    for (const d of defs) {
      const cat = d.category || d._category || "general";
      const label = d.categoryLabel || d._categoryLabel || cat;
      if (!perCategory[cat]) perCategory[cat] = { label: label, filled: 0, total: 0 };
      perCategory[cat].total++;
      const key = d.dataKey || d.key;
      if (key && formData[key] != null && formData[key] !== "" && !counted.has(key)) {
        counted.add(key);
        perCategory[cat].filled++;
        haveCount++;
      }
    }
    const pct = expected ? Math.min(100, Math.round((haveCount / expected) * 100)) : 0;

    const fill = document.getElementById("prefillFill");
    const text = document.getElementById("prefillText");
    if (fill) {
      fill.style.width = pct + "%";
      fill.dataset.pct = pctClass(pct);
    }
    if (text) text.textContent = haveCount + " / " + expected + " fields ready (" + pct + "%)";

    const list = document.getElementById("sectList");
    if (list) {
      list.innerHTML = "";
      for (const cat in perCategory) {
        if (!Object.prototype.hasOwnProperty.call(perCategory, cat)) continue;
        const row = perCategory[cat];
        const li = document.createElement("li");
        const rp = row.total ? Math.round((row.filled / row.total) * 100) : 0;
        const chipCls = row.filled === 0 ? "sect-skip" : (rp >= 80 ? "sect-ok" : "sect-warn");
        li.innerHTML = "<span>" + esc(row.label) + "</span><b class='" + chipCls + "'>" + row.filled + "/" + row.total + "</b>";
        list.appendChild(li);
      }
    }
  }

  async function clear(formType) {
    try {
      const key = "mcaFormData_" + formType;
      await chrome.storage.local.remove([key]);
      if (formType === "aoc4") await chrome.storage.local.remove(["lastClient"]);
    } catch (_) {}
    render(formType);
  }

  function bind() {
    const edit = document.getElementById("editBtn");
    const clearBtn = document.getElementById("clearBtn");
    const reimport = document.getElementById("reimportBtn");
    // Edit opens an inline JSON editor inside the card (native prompt() dialogs are not
    // reliable in a side panel). Clicking Edit again closes it.
    if (edit) edit.addEventListener("click", async function () {
      const open = document.getElementById("dataEditor");
      if (open) { open.remove(); return; }
      const formType = ((root.FORMS_REGISTRY && (await root.FORMS_REGISTRY.getActiveForm())) || "aoc4");
      const key = "mcaFormData_" + formType;
      let curr = {};
      try { curr = (await chrome.storage.local.get([key]))[key] || {}; } catch (_) {}

      const editor = document.createElement("div");
      editor.id = "dataEditor";
      editor.className = "data-editor";
      editor.innerHTML =
        '<label for="dataEditorText">Form data (JSON)</label>' +
        '<textarea id="dataEditorText" spellcheck="false"></textarea>' +
        '<div class="data-editor-err hidden" id="dataEditorErr" role="alert"></div>' +
        '<div class="data-editor-actions">' +
          '<button class="primary small has-ico i-check" id="dataEditorSave">Save</button>' +
          '<button class="small has-ico i-x" id="dataEditorCancel">Cancel</button>' +
        '</div>';
      const actions = document.querySelector("#dataLoaded .data-actions");
      if (!actions) return;
      actions.parentNode.insertBefore(editor, actions);
      const ta = document.getElementById("dataEditorText");
      const err = document.getElementById("dataEditorErr");
      ta.value = JSON.stringify(curr, null, 2);
      ta.focus();

      document.getElementById("dataEditorCancel").addEventListener("click", function () { editor.remove(); });
      document.getElementById("dataEditorSave").addEventListener("click", async function () {
        try {
          const parsed = JSON.parse(ta.value);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object of field values.");
          await chrome.storage.local.set({ [key]: parsed });
          editor.remove();
          render(formType);
          try { root.dispatchEvent(new CustomEvent("germin8:datachange", { detail: { form: formType, data: parsed } })); } catch (_) {}
          if (root.Toasts) root.Toasts.success({ title: "Form data updated" });
        } catch (e) {
          err.textContent = e.message;
          err.classList.remove("hidden");
        }
      });
    });
    if (clearBtn) clearBtn.addEventListener("click", async function () {
      const formType = ((root.FORMS_REGISTRY && (await root.FORMS_REGISTRY.getActiveForm())) || "aoc4");
      await clear(formType);
      if (root.Toasts) root.Toasts.info({ title: "Form data cleared" });
    });
    if (reimport) reimport.addEventListener("click", function () {
      const btn = document.getElementById("importClientBtn");
      if (btn) btn.click();
    });
  }

  root.DataCard = { render: render, clear: clear, bind: bind };
})(typeof window !== "undefined" ? window : globalThis);
