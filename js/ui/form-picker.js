// Form dropdown controller.
// Fills #formSelect from the FORMS registry, persists the choice to
// chrome.storage.local.currentForm, shows the matching workflow panel, and
// re-renders the timeline + data card. Other modules (popup.js) learn about
// changes through the "germin8:formchange" window event.

(function (root) {
  "use strict";
  if (root.FormPicker) return;

  const WORKFLOW_PANEL = {
    aoc4: "aoc4Workflow",
    aoc4_offline: "aoc4OfflineWorkflow",
    spice_a: "spiceAWorkflow",
    inc32: "inc32Workflow",
    dir3: "dir3Workflow",
  };

  function swapWorkflows(formType) {
    for (const key in WORKFLOW_PANEL) {
      const el = document.getElementById(WORKFLOW_PANEL[key]);
      if (el) el.classList.toggle("hidden", key !== formType);
    }
    // AOC-4 Offline reports through the Run status card, so the generic step timeline is not shown for it.
    const tl = document.getElementById("timelineWrap");
    if (tl) tl.classList.toggle("hidden", formType === "aoc4_offline");
  }

  // Header context line, the hint under the dropdown, and the icon inside it.
  function updateContext(formType) {
    const form = (root.FORMS || {})[formType];
    if (!form) return;
    const desc = document.getElementById("formDesc");
    const ctx = document.getElementById("ctxForm");
    const ico = document.getElementById("formSelectIco");
    if (desc) desc.textContent = form.description || "";
    if (ctx) ctx.textContent = form.label;
    if (ico) ico.innerHTML = form.iconSvg || "";
  }

  function render(current) {
    const select = document.getElementById("formSelect");
    if (!select) return;
    const forms = root.FORMS || {};
    const order = root.FORM_ORDER || Object.keys(forms);
    select.innerHTML = "";
    for (const key of order) {
      if (!forms[key]) continue;
      select.add(new Option(forms[key].label, key));
    }
    select.value = current;
    swapWorkflows(current);
    updateContext(current);
  }

  function announce(formType) {
    try {
      root.dispatchEvent(new CustomEvent("germin8:formchange", { detail: { form: formType } }));
    } catch (_) {}
  }

  function refreshPanels(formType) {
    if (root.Timeline && typeof root.Timeline.render === "function") root.Timeline.render(formType);
    if (root.DataCard && typeof root.DataCard.render === "function") root.DataCard.render(formType);
  }

  async function pick(formType) {
    try {
      await chrome.storage.local.set({ currentForm: formType });
    } catch (_) {}
    const select = document.getElementById("formSelect");
    if (select && select.value !== formType) select.value = formType;
    swapWorkflows(formType);
    updateContext(formType);
    refreshPanels(formType);
    announce(formType);
  }

  async function init() {
    let current = "aoc4";
    try {
      const r = await chrome.storage.local.get(["currentForm"]);
      if (r.currentForm && (root.FORMS || {})[r.currentForm]) current = r.currentForm;
    } catch (_) {}
    render(current);
    const select = document.getElementById("formSelect");
    if (select) select.addEventListener("change", function () { pick(select.value); });
    refreshPanels(current);
    announce(current);
    return current;
  }

  root.FormPicker = { init: init, pick: pick };
})(typeof window !== "undefined" ? window : globalThis);
