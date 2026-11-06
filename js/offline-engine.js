// AOC-4 Offline filler. The offline eForm (mca.gov.in/v3offline/ui/#/form/AOC-4) is an Angular app:
// most fields have stable ids, many stay disabled or hidden until MCA has looked up the CIN, and the
// dates are read-only Material date pickers. pageRun() therefore works step by step, waiting for each
// field to exist and be enabled, and checks every value after writing it.
//
// Field list comes from a "Extract page fields" capture of the live page. Fields that were not on the
// page at capture time (nature of FS, signatory tables, server address, ...) are found by their label
// text; the ones MCA fills in itself after the CIN (name, address, auditor details) are left alone.

(function (root) {
  "use strict";

  // kind: cin | text | date | select | radio.
  //   id / sel   exact element
  //   ids        radio options -> element id
  //   re         normalised label text (lower case, letters/digits/spaces) used when there is no id
  //   idx        fallback position among the page's DD/MM/YYYY inputs
  //   onlyIf     skip unless another key has this (normalised) value
  //   optional   not stopping the run if this field is not on the page
  //   sigtable   a signatory table (rows of DIN / name / designation / date)
  //   scope      text of a section heading: the field is looked for only inside that section
  //   lookup     a text box that makes MCA fill other boxes (watchRe = one of them); waits for that
  //   auto       filled by MCA itself: the filler only confirms it (never blocks the run)
  //   covers     other client keys this step accounts for
  //   save       click the section's Save, then OK in the popup MCA shows (anchorText = the section heading)
  const SPEC = [
    { key: "cin", label: "1(a) CIN", kind: "cin", id: "CIN", covers: ["authorisedCapital"] },
    { key: "financialYearFrom", label: "3 Financial year from", kind: "date", re: "financial year start date", idx: 0 },
    { key: "financialYearTo", label: "3 Financial year to", kind: "date", re: "financial year end date", idx: 1 },
    { key: "boardMeetingDateFS", label: "4(a) Board meeting (financial statements)", kind: "date", re: ["board of directors meeting in which financial statements are approved", "board of directors meeting date"], idx: 2 },
    { key: "natureOfFS", label: "4(b)(i) Nature of financial statements", kind: "select", re: "nature of financial statements" },
    { key: "provisionalFSFiled", label: "4(b)(iii) Provisional statements filed earlier", kind: "radio", re: "provisional financial statements filed earlier" },
    { key: "adoptedInAdjournedAGM", label: "4(b)(iv) Adopted in adjourned AGM", kind: "radio", re: "adopted in adjourned agm" },
    { key: "sig_fs", label: "4(c) Signatories of the financial statements", kind: "sigtable" },
    { key: "boardMeetingDateBR", label: "5(a) Board meeting (Board's report)", kind: "date", re: ["boards report referred under section 134"] },
    { key: "sig_br", label: "5(b) Signatories of the Board's report", kind: "sigtable" },
    { key: "auditorSigningDate", label: "6 Auditors' signing date", kind: "date", re: ["signing of reports on the financial statements by the auditors", "date of signing by auditors"] },
    { key: "agmHeld", label: "7(a) AGM held", kind: "radio", ids: { yes: "annualGeneralMeetingYes", no: "annualGeneralMeetingNo", "not applicable": "annualGeneralMeetingNotApplicable" } },
    { key: "agmDate", label: "7(b) Date of AGM", kind: "date", re: ["if yes date of agm"], onlyIf: { key: "agmHeld", is: "yes" } },
    { key: "agmDueDate", label: "7(c) Due date of AGM", kind: "date", re: ["due date of agm"], onlyIf: { key: "agmHeld", is: "yes" }, optional: true },
    { key: "agmExtension", label: "7(d) Extension of AGM granted", kind: "radio", ids: { yes: "extensionAGMGrantedYes", no: "extensionAGMGrantedNo" } },
    { key: "save_agm", label: "Save the AGM details", kind: "save", anchorText: "agm details", anchorId: "annualGeneralMeetingYes" },
    { key: "isSubsidiary", label: "8(a) Subsidiary company", kind: "radio", ids: { yes: "subsidiaryCompanyYes", no: "subsidiaryCompanyNo" } },
    { key: "hasSubsidiaryOrAssociate", label: "8(e) Has subsidiary / associate / JV", kind: "radio", ids: { yes: "jointCompanyYes", no: "jointCompanyNo" } },
    { key: "srnADT1", label: "9 SRN of Form ADT-1", kind: "text", id: "srnForm" },
    { key: "auditorAuto", label: "9 Auditor details (MCA fills them from the SRN)", kind: "auto", re: "name of the auditor",
      covers: ["numberOfAuditors", "auditorPAN", "auditorCategory", "auditorMembershipNo", "auditorName", "auditorAddress1", "auditorAddress2", "auditorCountry", "auditorPincode", "auditorLocality", "auditorCity", "auditorDistrict", "auditorState", "signingMemberName", "signingMembershipNo"] },
    { key: "industryType", label: "10(a) Type of industry", kind: "select", sel: 'select[name="industryName"]' },
    { key: "scheduleIIIApplicable", label: "10(b) Schedule III applicable", kind: "radio", ids: { yes: "scheduleCompanyYes", no: "scheduleCompanyNo" } },
    { key: "consolidatedFS", label: "11 Consolidated statements required", kind: "radio", ids: { yes: "consolidatedFinStatementYes", no: "consolidatedFinStatementNo" } },
    { key: "booksInElectricForm", label: "12(a) Books kept in electronic form", kind: "radio", re: "books of account", optional: true },
    { key: "serverAddress1", label: "12(b) Server address line 1", kind: "text", re: "address line 1", scope: "maintenance of computer servers", onlyIf: { key: "booksInElectricForm", is: "yes" } },
    { key: "serverAddress2", label: "12(b) Server address line 2", kind: "text", re: "address line 2", scope: "maintenance of computer servers", onlyIf: { key: "booksInElectricForm", is: "yes" } },
    { key: "serverCountry", label: "12(b) Server country", kind: "select", re: "country", scope: "maintenance of computer servers", onlyIf: { key: "booksInElectricForm", is: "yes" } },
    { key: "serverPincode", label: "12(b) Server PIN code (MCA then fills city, district, state)", kind: "lookup", re: "pin code zip code", watchRe: "city", scope: "maintenance of computer servers", onlyIf: { key: "booksInElectricForm", is: "yes" } },
    { key: "serverLocality", label: "12(b) Server area / locality", kind: "select", re: "area locality", scope: "maintenance of computer servers", onlyIf: { key: "booksInElectricForm", is: "yes" } },
    { key: "serverCity", label: "12(b) Server city (from the PIN)", kind: "auto", re: "city", scope: "maintenance of computer servers", onlyIf: { key: "booksInElectricForm", is: "yes" } },
    { key: "serverDistrict", label: "12(b) Server district (from the PIN)", kind: "auto", re: "district", scope: "maintenance of computer servers", onlyIf: { key: "booksInElectricForm", is: "yes" } },
    { key: "serverState", label: "12(b) Server state (from the PIN)", kind: "auto", re: "state ut", scope: "maintenance of computer servers", onlyIf: { key: "booksInElectricForm", is: "yes" } },
    { key: "relatedPartyTransactions", label: "III-1 Related party transactions", kind: "radio", ids: { yes: "transactRelatedYes", no: "transactRelatedNo" } },
    { key: "cagCommented", label: "IV-1(a) CAG comments", kind: "radio", ids: { yes: "supplementedAuditReportYes", no: "supplementedAuditReportNo", "not applicable": "supplementedAuditReportNA" } },
    { key: "csrApplicability", label: "V-1 CSR applicability", kind: "select", re: "csr applicability", optional: true },
    { key: "secretarialAudit", label: "VI-1 Secretarial audit applicable", kind: "radio", ids: { yes: "secretarialAuditYes", no: "secretarialAuditNo" } },
  ];

  // Runs inside the MCA page. Self-contained: it is serialised for injection.
  // mode "fill" writes values; mode "check" only reports which fields can be found.
  async function pageRun(spec, data, mode) {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const clean = s => String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    const norm = s => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const waitFor = async (fn, ms, step) => {
      const end = Date.now() + ms;
      for (;;) {
        let v = null;
        try { v = fn(); } catch (_) { v = null; }
        if (v) return v;
        if (window.__g8Abort || Date.now() > end) return null;
        await sleep(step || 150);
      }
    };
    const fire = (el, types) => types.forEach(t => el.dispatchEvent(new Event(t, { bubbles: true })));
    const setValue = (el, v) => {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const d = Object.getOwnPropertyDescriptor(proto, "value");
      if (d && d.set) d.set.call(el, v); else el.value = v;
    };
    const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 || r.height > 0; };
    const enabled = el => !el.disabled && el.getAttribute("aria-disabled") !== "true";

    // ---- finding fields ----
    const textAround = (el, levels) => {
      const out = [];
      let n = el.parentElement;
      for (let i = 0; i < levels && n; i++, n = n.parentElement) out.push({ node: n, text: norm(n.textContent) });
      return out;
    };
    const matches = (text, re) => [].concat(re).some(r => text.includes(r));
    // The nearest container whose text matches `re` (a phrase or a list of phrases) and that holds just this one control of `selector`.
    const byLabel = (selector, re, maxInGroup) => {
      let best = null;
      for (const el of document.querySelectorAll(selector)) {
        const around = textAround(el, 8);
        for (let i = 0; i < around.length; i++) {
          const { node, text } = around[i];
          if (node.querySelectorAll(selector).length > maxInGroup) break;
          if (matches(text, re)) { if (!best || i < best.level) best = { el, node, level: i }; break; }
        }
      }
      return best;
    };
    const dateInputs = () => [...document.querySelectorAll('input[placeholder="DD/MM/YYYY"]')];
    const findDate = s => {
      const hit = byLabel('input[placeholder="DD/MM/YYYY"]', s.re, 1);
      if (hit) return hit.el;
      const all = dateInputs();
      return s.idx != null && all[s.idx] ? all[s.idx] : null;
    };
    const optionLabel = r => {
      if (r.id) {
        const l = document.querySelector('label[for="' + CSS.escape(r.id) + '"]');
        if (l && clean(l.textContent)) return clean(l.textContent);
      }
      return clean(r.parentElement ? r.parentElement.textContent : "");
    };
    const findRadio = (s, value) => {
      if (s.ids) { const id = s.ids[value]; return id ? document.getElementById(id) : null; }
      const hit = byLabel('input[type="radio"]', s.re, 3);
      if (!hit) return null;
      return [...hit.node.querySelectorAll('input[type="radio"]')].find(r => norm(optionLabel(r)) === value) || null;
    };
    const findSelect = s => {
      if (s.sel) return document.querySelector(s.sel);
      const hit = byLabel("select", s.re, 1);
      return hit ? hit.el : null;
    };
    const CONTROL = "input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select, textarea";
    const labelText = e => { const c = e.cloneNode(true); c.querySelectorAll("option, script, style").forEach(x => x.remove()); return norm(c.textContent); };
    const findScope = s => {
      const want = norm(s.scope);
      const c = [...document.querySelectorAll("div, section, fieldset, form, table")].filter(e => norm(e.textContent).includes(want) && e.querySelectorAll(CONTROL).length >= 3);
      c.sort((a, b) => a.textContent.length - b.textContent.length);
      return c[0] || null;
    };
    const inScope = (root, re) => {
      let best = null;
      for (const el of root.querySelectorAll(CONTROL)) {
        let n = el.parentElement;
        for (let i = 0; i < 5 && n; i++, n = n.parentElement) {
          if (n.querySelectorAll(CONTROL).length > 1) break;
          if (matches(labelText(n), re)) { if (!best || i < best.level) best = { el, level: i }; break; }
          if (n === root) break;
        }
      }
      return best ? best.el : null;
    };
    const findControl = s => {
      if (s.scope) { const root = findScope(s); return root ? inScope(root, s.re) : null; }
      const hit = byLabel(CONTROL, s.re, 1);
      return hit ? hit.el : null;
    };
    const find = (s, value) => {
      if (s.scope || s.kind === "auto" || s.kind === "lookup") return findControl(s);
      if (s.kind === "radio") return findRadio(s, value);
      if (s.kind === "select") return findSelect(s);
      if (s.kind === "date") return findDate(s);
      return s.id ? document.getElementById(s.id) : null;
    };

    // ---- writing values ----
    const typeInto = async (el, v) => {
      el.focus();
      setValue(el, "");
      fire(el, ["input"]);
      for (let i = 1; i <= v.length; i++) {
        setValue(el, v.slice(0, i));
        el.dispatchEvent(new InputEvent("input", { bubbles: true, data: v[i - 1], inputType: "insertText" }));
        el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: v[i - 1] }));
      }
      fire(el, ["change", "blur", "focusout"]);
    };
    const setPlain = async (el, v) => {
      el.focus();
      setValue(el, v);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: v, inputType: "insertText" }));
      fire(el, ["change", "blur", "focusout"]);
      await sleep(250);
      return el.value === v;
    };
    const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const pickFromCalendar = async (el, v) => {
      const [dd, mm, yyyy] = v.split("/").map(Number);
      let n = el.parentElement, toggle = null;
      for (let i = 0; i < 6 && n && !toggle; i++, n = n.parentElement) {
        toggle = n.querySelector("mat-datepicker-toggle button, .mat-datepicker-toggle button, button[aria-label*='alendar']");
      }
      (toggle || el).click();
      const cal = await waitFor(() => document.querySelector("mat-calendar, .mat-calendar"), 3000);
      if (!cal) return false;
      const cell = async (match) => {
        await sleep(250);
        const c = [...cal.querySelectorAll(".mat-calendar-body-cell")].find(x => match(clean(x.textContent).toLowerCase(), clean(x.getAttribute("aria-label")).toLowerCase()));
        if (!c) return false;
        c.click();
        return true;
      };
      const period = cal.querySelector(".mat-calendar-period-button");
      if (period) period.click();
      if (!await cell(t => t === String(yyyy))) return false;
      if (!await cell((t, a) => t.startsWith(MONTHS[mm - 1]) || a.startsWith(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][mm - 1]))) return false;
      if (!await cell(t => t === String(dd))) return false;
      await sleep(300);
      return true;
    };
    const fillDate = async (el, v) => {
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(v)) return "expected DD/MM/YYYY";
      if (await setPlain(el, v) && !el.classList.contains("ng-invalid")) return null;
      // The picker did not take typed text: choose the date in its calendar instead.
      if (await pickFromCalendar(el, v) && el.value === v) return null;
      return "the date picker did not accept " + v;
    };
    const fillSelect = async (el, v) => {
      const want = norm(v);
      const opts = [...el.options];
      const opt = opts.find(o => norm(o.textContent) === want) || opts.find(o => want && norm(o.textContent).includes(want)) || opts.find(o => want && want.includes(norm(o.textContent)) && norm(o.textContent));
      if (!opt) return 'no option "' + v + '"';
      el.value = opt.value;
      fire(el, ["input", "change", "blur"]);
      await sleep(250);
      return el.options[el.selectedIndex] && el.options[el.selectedIndex].text === opt.text ? null : "the dropdown did not keep the choice";
    };
    // Angular Material / custom dropdowns (not a <select>): open it, then click the matching option.
    const CUSTOM_SELECT = "mat-select, .mat-select, .mat-mdc-select, [role=combobox], [role=listbox], [aria-haspopup=listbox]";
    const OPTION = ".mat-option, mat-option, .mat-mdc-option, [role=option], li.dropdown-item, .dropdown-menu a";
    const fillCustomSelect = async (trigger, v) => {
      const want = norm(v);
      trigger.click();
      const list = await waitFor(() => { const o = [...document.querySelectorAll(OPTION)].filter(shown); return o.length ? o : null; }, 3000);
      if (!list) return "the dropdown did not open";
      const opt = list.find(o => norm(o.textContent) === want) || list.find(o => want && norm(o.textContent).includes(want));
      if (!opt) { document.body.click(); return 'no option "' + v + '" (the list has: ' + list.slice(0, 8).map(o => clean(o.textContent)).join(", ") + ")"; }
      opt.click();
      await sleep(300);
      return null;
    };
    const fillRadio = async (el) => {
      el.click();
      await sleep(200);
      if (!el.checked) {
        const l = el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        if (l) l.click(); else if (el.parentElement) el.parentElement.click();
        await sleep(200);
      }
      return el.checked ? null : "the option did not stay selected";
    };

    // ---- Save buttons and MCA's confirmation popup ----
    const DIALOG = ".modal.show, .modal.in, .modal[style*='display: block'], mat-dialog-container, .mat-mdc-dialog-container, .cdk-overlay-pane, [role=dialog], [role=alertdialog], .swal2-popup, .sweet-alert.visible, .bootbox";
    const openDialog = () => [...document.querySelectorAll(DIALOG)].filter(d => shown(d) && clean(d.textContent)).pop() || null;
    const buttonIn = (rootEl, re) => [...rootEl.querySelectorAll("button, a.btn, input[type=button], input[type=submit], [role=button]")].filter(shown).find(b => re.test(norm(b.textContent || b.value)));
    const findSave = s => {
      // The first Save button after the section heading (or after its first field).
      let anchor = null;
      const want = norm(s.anchorText || "");
      if (want) {
        const heads = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,legend,label,span,div,p")].filter(e => norm(e.textContent) === want);
        anchor = heads[0] || null;
      }
      if (!anchor && s.anchorId) anchor = document.getElementById(s.anchorId);
      const saves = [...document.querySelectorAll("button, input[type=button], input[type=submit], [role=button]")].filter(b => shown(b) && norm(b.textContent || b.value) === "save");
      if (!anchor) return saves[0] || null;
      return saves.find(b => anchor.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) || null;
    };
    const runSave = async s => {
      const btn = await waitFor(() => findSave(s), mode === "check" ? 300 : 10000);
      if (!btn) { push(s, "missing", "the Save button for this section is not on the page"); return; }
      if (mode === "check") { push(s, "found", enabled(btn) ? "" : "Save is disabled until the section is complete"); return; }
      if (!enabled(btn) && !(await waitFor(() => enabled(btn), 8000))) { push(s, "disabled", "the Save button is disabled: a required field in this section is still empty"); return; }
      btn.scrollIntoView({ block: "center" });
      await sleep(300);
      btn.click();
      const dlg = await waitFor(openDialog, 12000);
      if (!dlg) {
        const errs = [...document.querySelectorAll(".mat-error, .text-danger, .invalid-feedback, .error-message, .error")].filter(shown).map(e => clean(e.textContent)).filter(Boolean).slice(0, 4);
        push(s, "failed", "Save was clicked but MCA showed no confirmation popup" + (errs.length ? ". MCA shows: " + errs.join("; ") : ""));
        return;
      }
      const dlgCopy = dlg.cloneNode(true);
      dlgCopy.querySelectorAll("button, a.btn, input, .close").forEach(n => n.remove());
      const text = clean(dlgCopy.textContent).slice(0, 200) || clean(dlg.textContent).slice(0, 200);
      const ok = buttonIn(dlg, /^(ok|okay)$/) || buttonIn(dlg, /^(close|yes|continue|done|got it|confirm)$/) || [...dlg.querySelectorAll("button")].filter(shown)[0];
      if (!ok) { push(s, "failed", "the popup has no OK button. It says: " + text); return; }
      ok.click();
      let closed = await waitFor(() => !openDialog(), 6000);
      if (!closed) {
        const x = dlg.querySelector("button.close, [aria-label=Close], [aria-label=close]");
        if (x) { x.click(); closed = await waitFor(() => !openDialog(), 4000); }
      }
      const bad = /error|invalid|mandatory|required|fail|not valid|please (enter|select|fill)/i.test(text) && !/success/i.test(text);
      if (bad) { push(s, "failed", "MCA did not accept the Save. The popup says: " + text); return; }
      if (!closed) { push(s, "failed", "the popup did not close after OK. It says: " + text); return; }
      push(s, "filled", "saved. The popup said: " + text);
    };

    // A box MCA fills itself: wait for its value, report it, never block the run.
    const runAuto = async s => {
      const el = await waitFor(() => findControl(s), mode === "check" ? 300 : 12000);
      if (!el) { push(s, "skipped", "not on the page, so there was nothing to confirm"); return; }
      if (mode === "check") { push(s, "found", ""); return; }
      const v = await waitFor(() => clean(el.value), 15000);
      push(s, v ? "filled" : "skipped", v ? "filled by MCA: " + v.slice(0, 60) : "MCA left it empty");
    };

    // ---- rules ----
    // 1. Look first: a control that already holds the value is left alone ("already").
    // 2. Otherwise fill it, then check the page really kept the value.
    // 3. If it did not, look the control up again (MCA may have re-rendered) and retry, up to MAX_TRIES.
    // 4. Still wrong: report it with the reason; nothing else stops. Run Fill again to retry only those.
    const MAX_TRIES = 3;
    const errText = e => (e && e.message ? e.message : String(e));
    const ensure = async ({ get, isDone, apply }) => {
      let err = null;
      for (let n = 1; n <= MAX_TRIES; n++) {
        if (window.__g8Abort) return { ok: false, err: "stopped", tries: n - 1 };
        let el = get();
        if (el && isDone(el)) return { ok: true, already: n === 1, tries: n - 1 };
        if (!el) { err = "the field disappeared from the page"; await sleep(500 * n); continue; }
        if (!enabled(el)) {
          const ok = await waitFor(() => { const e2 = get() || el; return enabled(e2); }, 9000);
          if (window.__g8Abort) return { ok: false, err: "stopped", tries: n - 1 };
          if (!ok) return { ok: false, disabled: true, err: "MCA keeps this field disabled", tries: n - 1 };
        }
        try { err = await apply(get() || el, n); } catch (e) { err = errText(e); }
        await sleep(300 * n);
        el = get();
        if (el && isDone(el)) return { ok: true, already: false, tries: n };
      }
      return { ok: false, err: (err || "the value did not stay on the page") + " (tried " + MAX_TRIES + " times)", tries: MAX_TRIES };
    };

    // Does this control already hold the wanted value?
    const holds = (s, el, value) => {
      const nv = norm(value);
      if (s.kind === "radio") return !!el.checked;
      if (s.kind === "select") {
        const o = el.options[el.selectedIndex];
        const t = o ? norm(o.textContent) : "";
        return !!t && (t === nv || t.includes(nv));
      }
      if (s.kind === "cin") { const n = document.getElementById("nameOfCompany"); return clean(el.value) === value && !!(n && n.value); }
      if (s.kind === "lookup") { const w = findControl({ scope: s.scope, re: s.watchRe }); return clean(el.value) === value && !!(w && w.value); }
      return clean(el.value) === value;
    };
    const askMca = async (typedInto, getResult, ms) => {
      let got = await waitFor(getResult, ms);
      if (!got) {
        // The lookup did not start from typing alone: press Enter in the box.
        ["keydown", "keypress", "keyup"].forEach(t => typedInto.dispatchEvent(new KeyboardEvent(t, { bubbles: true, key: "Enter", keyCode: 13, which: 13 })));
        got = await waitFor(getResult, ms);
      }
      return got;
    };
    const applyOne = async (s, el, value, nv) => {
      if (s.kind === "cin") {
        await typeInto(el, value);
        const got = await askMca(el, () => { const n = document.getElementById("nameOfCompany"); return n && n.value; }, 15000);
        if (!got) return "MCA did not return the company details for this CIN";
        await sleep(1200);
        return null;
      }
      if (s.kind === "lookup") {
        await typeInto(el, value);
        const got = await askMca(el, () => { const w = findControl({ scope: s.scope, re: s.watchRe }); return w && w.value; }, 12000);
        if (!got) return "MCA did not return the city and state for this PIN code";
        await sleep(800);
        return null;
      }
      if (s.kind === "date") return fillDate(el, value);
      if (s.kind === "select") { await waitFor(() => el.options && el.options.length > 1, 8000); return fillSelect(el, value); }
      if (s.kind === "radio") return fillRadio(el);
      return (await setPlain(el, value)) ? null : "the page did not keep the value";
    };

    // ---- run ----
    const results = [];
    const done = {};
    const push = (s, status, reason) => results.push({ key: s.key, label: s.label, status, reason: reason || "" });
    const note = (r, what) => (r.already ? "was already set" : r.tries > 1 ? "after " + r.tries + " tries" : "") || what || "";
    const mapped = new Set(spec.map(s => s.key));
    spec.forEach(s => (s.covers || []).forEach(k => mapped.add(k)));

    // ---- progress, saved to chrome.storage so the side panel can show it live or after it was closed ----
    const STORE = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
    const state = { id: String(Date.now()), status: "running", startedAt: Date.now(), updatedAt: Date.now(), current: "Starting…", index: 0, total: spec.length, results, summary: null, fatal: null };
    const sync = () => {
      if (mode === "check" || !STORE) return;
      state.updatedAt = Date.now();
      try { STORE.set({ offlineRun: JSON.parse(JSON.stringify(state)) }); } catch (_) { /* panel storage unavailable */ }
    };
    const setCurrent = text => { state.current = text; sync(); };
    const summarize = () => {
      const c = k => results.filter(r => r.status === k).length;
      return { filled: c("filled"), already: c("already"), failed: c("failed") + c("disabled"), missing: c("missing"), skipped: c("skipped"), unmapped: c("unmapped") };
    };
    let heartbeat = null;
    const finish = (status, fatal) => {
      clearInterval(heartbeat);
      state.status = status;
      state.fatal = fatal || null;
      state.current = status === "done" ? "Finished" : status === "stopped" ? "Stopped" : "Stopped with an error";
      if (status === "done") state.index = state.total;
      state.summary = summarize();
      sync();
    };
    const realPush = results.push;
    results.push = function () { const n = realPush.apply(this, arguments); sync(); return n; };

    if (mode !== "check") {
      if (window.__g8OfflineRunning) return { fatal: "A fill is already running on this page. Wait for it to finish, or press Stop.", results };
      const onForm = await waitFor(() => document.getElementById("CIN"), 6000);
      if (!onForm) {
        const msg = "This is not the AOC-4 Offline form: the CIN box was not found. Open the form page, then fill.";
        finish("error", msg);
        return { fatal: msg, results };
      }
    }
    if (mode !== "check") {
      window.__g8OfflineRunning = true; window.__g8Abort = false;
      sync();
      heartbeat = setInterval(sync, 5000);
    }
    try {
      // ---- signatory tables: DIN/PAN | Name | Designation | Date, one row per person ----
      const SIGS = {
        sig_fs: { title: "Signatory", prefix: "director", dateKey: "DateFS", re: "din or income tax pan", rows: 5 },
        sig_br: { title: "Board's report signatory", prefix: "br", dateKey: "DateBR", re: "din pan", rows: 5 },
      };
      const findTable = re => {
        const tables = [...document.querySelectorAll("table, [role=table]")].filter(t => norm(t.textContent).includes(re));
        tables.sort((a, b) => a.textContent.length - b.textContent.length);
        return tables[0] || null;
      };
      const dataRows = t => [...t.querySelectorAll("tr, [role=row]")].filter(r => r.querySelector("input, select"));
      // Fills one signatory table. Writes its own result lines.
      const runSig = async (s, sg) => {
        const wanted = [];
        for (let i = 1; i <= sg.rows; i++) if (clean(data[sg.prefix + i + "DIN"])) wanted.push(i);
        wanted.forEach(i => ["DIN", "Name", "Designation", sg.dateKey].forEach(f => mapped.add(sg.prefix + i + f)));
        if (!wanted.length && mode !== "check") { push(s, "skipped", "no signatory in the client data"); return; }
        const table = await waitFor(() => findTable(sg.re), mode === "check" ? 300 : 12000);
        if (!table) { push(s, "missing", "the signatory table is not on the page"); return; }
        if (mode === "check") { push(s, "found", dataRows(table).length + " rows"); return; }
        for (const i of wanted) {
          const label = sg.title + " " + i;
          setCurrent("Filling: " + label + " (DIN, designation, date)");
          const out = (f, label2, status, reason) => results.push({ key: sg.prefix + i + f, label: label + " " + label2, status, reason: reason || "" });
          // The row is looked up again on every try: MCA re-renders the table as rows are filled.
          const parts = () => {
            const t = findTable(sg.re), rowEl = t && dataRows(t)[i - 1];
            if (!rowEl) return {};
            const inputs = [...rowEl.querySelectorAll("input")].filter(x => !["hidden", "radio", "checkbox"].includes(x.type));
            const dateEl = rowEl.querySelector('input[placeholder="DD/MM/YYYY"]');
            const texts = inputs.filter(x => x !== dateEl);
            return { rowEl, dinEl: texts[0], nameEl: texts[1], desigEl: rowEl.querySelector("select") || rowEl.querySelector(CUSTOM_SELECT), dateEl };
          };
          try {
            if (window.__g8Abort) { out("DIN", "DIN", "skipped", "stopped before this row"); return; }
            const din = clean(data[sg.prefix + i + "DIN"]);
            if (!parts().dinEl) { out("DIN", "DIN", "missing", "row " + i + " or its DIN box is not in the table"); return; }
            const dinDone = () => { const p = parts(); return p.dinEl && clean(p.dinEl.value) === din && (!p.nameEl || !!p.nameEl.value); };
            const rDin = await ensure({
              get: () => parts().dinEl,
              isDone: () => dinDone(),
              apply: async () => {
                const p = parts();
                await typeInto(p.dinEl, din);
                const nameOk = p.nameEl ? await askMca(p.dinEl, () => parts().nameEl && parts().nameEl.value, 8000) : true;
                if (nameOk) return null;
                const typed = clean(data[sg.prefix + i + "Name"]);
                const q = parts();
                if (typed && q.nameEl && enabled(q.nameEl) && !q.nameEl.readOnly && await setPlain(q.nameEl, typed)) return null;
                return /valid DIN/i.test((q.rowEl && q.rowEl.textContent) || "") ? "MCA says this DIN or PAN is not valid" : "MCA did not return a name for this DIN";
              },
            });
            out("DIN", "DIN", rDin.ok ? (rDin.already ? "already" : "filled") : "failed", rDin.ok ? note(rDin) : rDin.err);
            if (!rDin.ok) return;
            out("Name", "name", "filled", "filled by MCA from the DIN");

            const desig = clean(data[sg.prefix + i + "Designation"]);
            if (desig && !parts().desigEl) {
              const p = parts(), n = p.rowEl ? p.rowEl.querySelectorAll("input").length : 0;
              out("Designation", "designation", "failed", "designation control not recognised in row " + i + " (the row has " + n + " inputs, " + (p.rowEl ? p.rowEl.querySelectorAll("select").length : 0) + " dropdowns). Use Extract page fields and send the result.");
              return;
            }
            if (desig) {
              const rD = await ensure({
                get: () => parts().desigEl,
                isDone: e => e.tagName === "SELECT" ? holds({ kind: "select" }, e, desig) : norm(e.textContent).includes(norm(desig)),
                apply: async e => {
                  if (e.tagName !== "SELECT") return fillCustomSelect(e, desig);
                  await waitFor(() => e.options.length > 1, 5000);
                  return fillSelect(e, desig);
                },
              });
              out("Designation", "designation", rD.ok ? (rD.already ? "already" : "filled") : (rD.disabled ? "disabled" : "failed"), rD.ok ? note(rD) : rD.err);
              if (!rD.ok) return;
            }
            const date = clean(data[sg.prefix + i + sg.dateKey]);
            if (date) {
              const rT = await ensure({
                get: () => parts().dateEl,
                isDone: e => clean(e.value) === date,
                apply: e => fillDate(e, date),
              });
              out(sg.dateKey, "date", rT.ok ? (rT.already ? "already" : "filled") : (rT.disabled ? "disabled" : "failed"), rT.ok ? note(rT) : rT.err);
              if (!rT.ok) return;
            }
          } catch (e) {
            out("DIN", "", "failed", errText(e));
            return;
          }
        }
      };

      // ---- the steps, in page order. A step that cannot be completed stops the run right there:
      // later answers depend on earlier ones, so nothing is filled out of order. ----
      for (const sg of Object.values(SIGS)) for (let i = 1; i <= sg.rows; i++) ["DIN", "Name", "Designation", sg.dateKey].forEach(f => mapped.add(sg.prefix + i + f));
      const BAD = new Set(["failed", "missing", "disabled"]);
      let blocked = null;
      let stepNo = 0;
      for (const s of spec) {
        stepNo++;
        if (mode !== "check") { if (!window.__g8Abort && !blocked) state.index++; setCurrent(window.__g8Abort ? "Stopping…" : blocked ? "Stopped" : "Step " + stepNo + " of " + spec.length + ": " + s.label); }
        if (blocked) { push(s, "skipped", 'not reached: stopped at "' + blocked.label + '"'); continue; }
        if (window.__g8Abort) { push(s, "skipped", "stopped before this field"); continue; }
        const before = results.length;
        if (mode !== "check" && s.onlyIf && done[s.onlyIf.key] !== s.onlyIf.is) { push(s, "skipped", "only needed when " + s.onlyIf.key + " is " + s.onlyIf.is); continue; }
        if (s.kind === "sigtable") {
          await runSig(s, SIGS[s.key]);
        } else if (s.kind === "save") {
          await runSave(s);
        } else if (s.kind === "auto") {
          await runAuto(s);
        } else {
          const raw = data[s.key];
          const value = raw == null ? "" : clean(raw);
          const nv = norm(value);
          if (mode !== "check" && !value) { push(s, "skipped", "no value in the client data"); continue; }
          if (mode !== "check" && s.onlyIf && done[s.onlyIf.key] !== s.onlyIf.is) { push(s, "skipped", "only needed when " + s.onlyIf.key + " is " + s.onlyIf.is); continue; }
          if (mode !== "check" && s.kind === "radio" && s.ids && !s.ids[nv]) { push(s, "failed", 'no option "' + value + '" (choose ' + Object.keys(s.ids).join(" / ") + ")"); }
          else {
            // Sections appear as earlier answers are filled in: wait for the control to exist.
            const probe = mode !== "check" ? (s.kind === "radio" ? nv : value) : (s.kind === "radio" && s.ids ? Object.keys(s.ids)[0] : (s.kind === "radio" ? "yes" : value));
            const get = () => find(s, probe);
            const el = await waitFor(get, mode === "check" ? 300 : (s.key === "cin" ? 3000 : 12000));
            if (!el) push(s, s.optional ? "skipped" : "missing", s.optional ? "this field is not on the page, so it was left out" : "not on the page (it may appear after other answers)");
            else if (mode === "check") push(s, "found", enabled(el) ? "" : "disabled until MCA enables it");
            else {
              try {
                const r = await ensure({ get, isDone: e => holds(s, e, value), apply: e => applyOne(s, e, value, nv) });
                if (r.ok) { done[s.key] = s.kind === "radio" ? nv : value; push(s, r.already ? "already" : "filled", note(r)); }
                else if (r.err === "stopped") push(s, "skipped", "stopped before this field");
                else push(s, r.disabled ? "disabled" : "failed", r.err);
              } catch (e) {
                push(s, "failed", errText(e));
              }
              await sleep(120);
            }
          }
        }
        const bad = mode !== "check" && results.slice(before).find(r => BAD.has(r.status));
        if (bad) blocked = { label: s.label, reason: bad.reason, no: stepNo };
      }

      if (blocked) {
        for (const k of Object.keys(data)) if (!mapped.has(k) && data[k] != null && String(data[k]).trim() !== "") results.push({ key: k, label: k, status: "unmapped", reason: "no field map yet for this value" });
        const msg = "Stopped at step " + blocked.no + " of " + spec.length + ": " + blocked.label + " — " + blocked.reason + ". Fix it on the page, then click Fill: steps already done are skipped.";
        finish("error", msg);
        return { fatal: msg, results };
      }

      // Final check: a later answer can make MCA clear an earlier one, so confirm every value is still there.
      if (mode !== "check" && !window.__g8Abort) {
        setCurrent("Final check: confirming every value is still there…");
        for (const s of spec) {
          if (s.kind === "sigtable" || s.kind === "save" || s.kind === "auto" || done[s.key] === undefined) continue;
          const value = clean(data[s.key]), nv = norm(value);
          const get = () => find(s, s.kind === "radio" ? nv : value);
          const el = get();
          if (el && holds(s, el, value)) continue;
          const r = await ensure({ get, isDone: e => holds(s, e, value), apply: e => applyOne(s, e, value, nv) });
          push(s, r.ok ? "filled" : "failed", r.ok ? "MCA had cleared it; filled again" : "MCA cleared it and it could not be filled again: " + r.err);
        }
      }
    } catch (e) {
      const msg = "The fill stopped unexpectedly: " + errText(e);
      if (mode !== "check") finish("error", msg);
      return { fatal: msg, results };
    } finally {
      if (mode !== "check") window.__g8OfflineRunning = false;
    }
    // Client values that have no field map yet.
    if (mode !== "check") {
      for (const k of Object.keys(data)) {
        if (!mapped.has(k) && data[k] != null && String(data[k]).trim() !== "") results.push({ key: k, label: k, status: "unmapped", reason: "no field map yet for this value" });
      }
      finish(window.__g8Abort ? "stopped" : "done");
    }
    return { url: location.href, results, stopped: !!window.__g8Abort };
  }

  // Plain-language version of the errors chrome.scripting throws.
  function friendly(err) {
    const m = (err && err.message) || String(err);
    if (/cannot access|host permission|permission/i.test(m)) return "Germin8 is not allowed to use this page. Open the MCA tab (mca.gov.in) and try again.";
    if (/frame.*(removed|detached)|no frame|no tab|tab.*(closed|removed)|receiving end|context.*(invalidated|destroyed)|navigat/i.test(m)) return "The MCA page reloaded or was closed during the fill. Open the form again and click Fill: fields that are already filled are skipped.";
    if (/timed out|too long/i.test(m)) return m;
    return m;
  }

  const getState = async () => { try { return (await chrome.storage.local.get("offlineRun")).offlineRun || null; } catch (_) { return null; } };
  const setState = async patch => {
    try { const cur = (await getState()) || {}; await chrome.storage.local.set({ offlineRun: Object.assign(cur, patch, { updatedAt: Date.now() }) }); } catch (_) { /* ignore */ }
  };
  const clearState = async () => { try { await chrome.storage.local.remove("offlineRun"); } catch (_) { /* ignore */ } };

  // Asks a running fill to stop after the field it is on. Works even if the panel was closed and reopened.
  async function stop(tabId) {
    try { await chrome.scripting.executeScript({ target: { tabId }, func: () => { window.__g8Abort = true; } }); } catch (_) { /* page gone */ }
    await setState({ status: "stopping", current: "Stopping…" });
  }

  // Runs pageRun on the MCA tab; returns { results, summary, fatal? }. Never throws.
  async function run(tabId, data, mode) {
    const LIMIT = 8 * 60 * 1000;
    if (mode !== "check") {
      await chrome.storage.local.set({ offlineRunTab: tabId });
      await setState({ id: "pending", status: "running", startedAt: Date.now(), current: "Starting…", index: 0, total: SPEC.length, results: [], summary: null, fatal: null });
    }
    let out = { results: [], fatal: null };
    let timer;
    try {
      const job = chrome.scripting.executeScript({ target: { tabId }, func: pageRun, args: [SPEC, data || {}, mode || "fill"] });
      const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("The fill took too long and was stopped. Click Fill again: fields that are already filled are skipped.")), LIMIT); });
      const [res] = await Promise.race([job, timeout]);
      out = (res && res.result) || { results: [], fatal: "The page returned no result. Reload the MCA page and try again." };
    } catch (e) {
      out = { results: [], fatal: friendly(e) };
      try { await chrome.scripting.executeScript({ target: { tabId }, func: () => { window.__g8Abort = true; } }); } catch (_) { /* page gone */ }
      if (mode !== "check") await setState({ status: "error", fatal: out.fatal, current: "Stopped with an error" });
    } finally {
      clearTimeout(timer);
    }
    const count = s => out.results.filter(r => r.status === s).length;
    out.summary = {
      filled: count("filled"), already: count("already"), failed: count("failed") + count("disabled"), missing: count("missing"),
      skipped: count("skipped"), unmapped: count("unmapped"), found: count("found"), total: SPEC.length,
    };
    return out;
  }

  root.OfflineEngine = { SPEC, run, stop, getState, setState, clearState, _pageRun: pageRun };
})(typeof window !== "undefined" ? window : globalThis);
