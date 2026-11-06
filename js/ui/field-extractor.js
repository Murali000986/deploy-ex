// Page field extractor: reads every input / dropdown / radio on the open MCA page (all frames),
// lists them in a searchable table, and lets the user copy or download them as JSON. The result is
// what a field map for a new form is built from (labels, names, aria-labels, options).

(function (root) {
  "use strict";
  if (root.FieldExtractor) return;

  let rows = [];
  let pageInfo = null;

  // Runs inside the MCA page (every frame). Must stay self-contained: it is serialized for injection.
  function pageScan() {
    const clean = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    const visible = el => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return (r.width > 0 || r.height > 0) && st.visibility !== "hidden" && st.display !== "none";
    };
    const labelOf = el => {
      const aria = clean(el.getAttribute("aria-label"));
      if (aria) return { label: aria, from: "aria-label" };
      const lb = el.getAttribute("aria-labelledby");
      if (lb) {
        const t = lb.split(/\s+/).map(id => { const n = document.getElementById(id); return n ? clean(n.textContent) : ""; }).join(" ").trim();
        if (t) return { label: t, from: "aria-labelledby" };
      }
      if (el.id) {
        try {
          const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
          if (l && clean(l.textContent)) return { label: clean(l.textContent), from: "label[for]" };
        } catch (_) { /* odd id */ }
      }
      const wrap = el.closest("label");
      if (wrap && clean(wrap.textContent)) return { label: clean(wrap.textContent), from: "wrapping label" };
      // The question text usually sits in a nearby container: climb until one has text of its own.
      let node = el.parentElement;
      for (let i = 0; i < 6 && node; i++, node = node.parentElement) {
        const clone = node.cloneNode(true);
        clone.querySelectorAll("input,select,textarea,script,style,option").forEach(n => n.remove());
        const t = clean(clone.textContent);
        if (t.length >= 3) return { label: t.slice(0, 160), from: "nearby text (level " + (i + 1) + ")" };
      }
      return { label: clean(el.placeholder), from: el.placeholder ? "placeholder" : "none" };
    };
    const sectionOf = el => {
      // The closest heading-like text above the field.
      const heads = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,legend,caption,[role=heading]")];
      let best = "";
      for (const h of heads) {
        if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) best = clean(h.textContent);
      }
      return best.slice(0, 120);
    };
    const out = [];
    // Where a control sits in a table: row, column and the column heading.
    const cellInfo = el => {
      const td = el.closest("td, th, [role=cell], [role=gridcell]");
      if (!td) return null;
      const tr = td.closest("tr, [role=row]");
      const table = td.closest("table, [role=table]");
      const cells = tr ? [...tr.children] : [];
      const col = cells.indexOf(td);
      const rows = table ? [...table.querySelectorAll("tr, [role=row]")] : [];
      let head = "";
      if (table) {
        const hr = table.querySelector("thead tr, tr:has(th), [role=row]");
        if (hr && hr.children[col]) head = clean(hr.children[col].textContent);
      }
      return { table: table && table.id ? "#" + table.id : "", row: rows.indexOf(tr), col, header: head };
    };
    document.querySelectorAll("input, select, textarea, mat-select, .mat-select, .mat-mdc-select, [role=combobox], [role=listbox], [aria-haspopup=listbox]").forEach((el, i) => {
      const custom = !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
      const type = custom ? "custom-dropdown" : el.tagName === "SELECT" ? "select" : el.tagName === "TEXTAREA" ? "textarea" : (el.type || "text");
      if (custom && el.querySelector("input, select, textarea") && !el.matches("mat-select, .mat-select, .mat-mdc-select")) return;
      if (type === "hidden") return;
      const l = labelOf(el);
      const row = {
        idx: i,
        tag: el.tagName.toLowerCase(),
        type,
        label: l.label,
        labelFrom: l.from,
        name: el.name || "",
        id: el.id || "",
        ariaLabel: clean(el.getAttribute("aria-label")),
        placeholder: clean(el.placeholder),
        title: clean(el.title),
        value: type === "password" ? "" : clean(el.value).slice(0, 80),
        visible: visible(el),
        readOnly: !!el.readOnly,
        disabled: !!el.disabled,
        required: !!el.required || el.getAttribute("aria-required") === "true",
        section: sectionOf(el),
      };
      if (custom) { row.text = clean(el.textContent).slice(0, 80); row.classes = String(el.className || "").slice(0, 100); }
      const cell = cellInfo(el);
      if (cell) row.cell = cell;
      if (type === "select") row.options = [...el.options].slice(0, 80).map(o => clean(o.textContent));
      if (type === "radio" || type === "checkbox") { row.checked = el.checked; row.optionValue = el.value; }
      if (el.dataset && el.dataset.guideId) row.guideId = el.dataset.guideId;
      out.push(row);
    });
    return { url: location.href, isTop: window === window.top, title: document.title, count: out.length, fields: out };
  }

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const $ = id => document.getElementById(id);

  function haystack(r) {
    return [r.label, r.name, r.id, r.ariaLabel, r.placeholder, r.section, r.type, (r.options || []).join(" ")].join(" ").toLowerCase();
  }

  function render() {
    const list = $("exList"), meta = $("exMeta"), q = ($("exSearch").value || "").trim().toLowerCase();
    if (!list) return;
    const terms = q ? q.split(/\s+/) : [];
    const shown = rows.filter(r => terms.every(t => haystack(r).includes(t)));
    $("exCopyBtn").disabled = $("exDownloadBtn").disabled = !rows.length;
    if (!rows.length) { list.innerHTML = ""; return; }
    meta.textContent = shown.length === rows.length
      ? rows.length + " fields on this page"
      : shown.length + " of " + rows.length + " fields match";
    list.innerHTML = shown.slice(0, 400).map(r => {
      const tags = [r.type, r.visible ? "" : "hidden", r.readOnly || r.disabled ? "read-only" : "", r.required ? "required" : ""].filter(Boolean);
      const sub = [r.name && "name: " + r.name, r.options && r.options.length ? r.options.length + " options" : ""].filter(Boolean).join(" · ");
      return '<li><div class="ex-main"><span class="ex-label">' + esc(r.label || "(no label)") + "</span>" +
        (sub ? '<span class="ex-sub">' + esc(sub) + "</span>" : "") + '</div><span class="ex-tags">' +
        tags.map(t => "<em>" + esc(t) + "</em>").join("") + "</span></li>";
    }).join("") + (shown.length > 400 ? '<li class="ex-more">Showing the first 400 — narrow the search, or copy all as JSON.</li>' : "");
  }

  function payload() {
    return JSON.stringify({
      extractedAt: new Date().toISOString(),
      page: pageInfo,
      total: rows.length,
      fields: rows,
    }, null, 2);
  }

  async function extract() {
    const btn = $("exRunBtn");
    const say = (level, title, body) => { if (root.Toasts) root.Toasts[level]({ title, body }); };
    btn.disabled = true;
    try {
      if (typeof getActiveMcaTab !== "function") throw new Error("Tab lookup is not available.");
      if (typeof RUN !== "undefined") RUN.tabId = null;
      const tab = await getActiveMcaTab();
      if (!tab) { say("error", "No MCA tab", "Open the form page on mca.gov.in, then extract."); return; }
      const res = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: pageScan });
      const frames = res.map(r => r && r.result).filter(Boolean);
      rows = [];
      frames.forEach((f, fi) => f.fields.forEach(r => rows.push(Object.assign({ frame: fi, frameUrl: f.isTop ? "top" : f.url }, r))));
      pageInfo = { url: tab.url, title: (frames[0] && frames[0].title) || "", frames: frames.map(f => ({ url: f.url, isTop: f.isTop, fields: f.count })) };
      $("exSearch").disabled = false;
      render();
      if (!rows.length) say("warning", "No fields found", "The page has no inputs yet. Scroll to the form, wait for it to load, and try again.");
      else say("success", rows.length + " fields extracted", "Search the list, then Copy JSON or Download.");
    } catch (err) {
      if (root.ErrorHandler) root.ErrorHandler.handle(err, { source: "fieldExtract" });
      else say("error", "Could not read the page", err.message);
    } finally {
      btn.disabled = false;
    }
  }

  async function copy() {
    const text = payload();
    try { await navigator.clipboard.writeText(text); }
    catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } finally { ta.remove(); }
    }
    if (root.Toasts) root.Toasts.success({ title: "Copied " + rows.length + " fields as JSON" });
  }

  function download() {
    const blob = new Blob([payload()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mca-page-fields.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function bind() {
    if (!$("exRunBtn")) return;
    $("exRunBtn").addEventListener("click", extract);
    $("exSearch").addEventListener("input", render);
    $("exCopyBtn").addEventListener("click", copy);
    $("exDownloadBtn").addEventListener("click", download);
  }

  root.FieldExtractor = { bind, extract, _pageScan: pageScan };
})(typeof window !== "undefined" ? window : globalThis);
