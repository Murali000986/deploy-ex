/* ═══════════════════════════════════════════════════════════════════
   Germin8 dashboard — one flow per form.

   AOC-4 keeps its own engine in dashboard.js (financial statements, balance sheet, AI over
   Schedule III). Every other form has different fields, different documents and different
   checks, so each gets its own Data Entry, Upload & AI and Review & Send here:

     form          steps                                   why
     AOC-4         data · sandbox · upload · review        (dashboard.js)
     AOC-4 Offline data · sandbox · upload · review        has a CIN to look up
     SPICe+ Part A data · upload · review                  new company: nothing to look up
     INC-32        data · upload · review                  new company: nothing to look up
     DIR-3 KYC     data · upload · review                  a director, not a company

   This file is loaded before dashboard.js and only defines things; it uses dashboard.js's
   globals ($, esc, settings, docs, state, ...) when its functions are called, never while loading.
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  /* ───────── flow registry ───────── */
  const FLOW = {
    aoc4: { panels: ['data', 'sandbox', 'upload', 'review'] },
    aoc4_offline: {
      panels: ['data', 'sandbox', 'upload', 'review'],
      identity: ['cin'],
      docs: "the signed financial statements, board's report, auditor's report or last year's AOC-4",
    },
    spice_a: {
      panels: ['data', 'upload', 'review'],
      identity: ['proposedName1'],
      required: ['proposedName1', 'Company type', 'Company class', 'Company category', 'NIC code', 'Business activity'],
      docs: 'name-approval or trademark papers and the founders’ ID proofs',
      groups: [
        { id: 'request', label: 'Request', icon: 'file', keys: ['Language', 'Request type'] },
        { id: 'company', label: 'Company', icon: 'building', keys: ['Company type', 'Company class', 'Company category', 'Company sub-category', 'LLPIN/CIN type', 'LLPIN', 'CIN'] },
        { id: 'names', label: 'Proposed names', icon: 'tag', keys: ['proposedName1', 'proposedName2', 'proposedName3', 'Trademark number', 'Comments'] },
        { id: 'activity', label: 'Business activity', icon: 'sliders', keys: ['NIC code', 'Business activity'] },
      ],
    },
    inc32: {
      panels: ['data', 'upload', 'review'],
      identity: ['proposedName1', 'CIN'],
      docs: 'the MoA/AoA, proof of registered office and the directors’ ID and address proofs',
      hideCategories: ['system_fields'],
    },
    dir3: {
      panels: ['data', 'upload', 'review'],
      identity: ['name', 'din'],
      docs: 'the director’s PAN, Aadhaar and address proof',
    },
  };

  // Where MCA gives a fixed list the field map has `options`; where it does not, the dashboard offers
  // suggestions only, because the extension matches dropdown text loosely and a wrong fixed list would
  // block valid entries.
  const SUGGEST = {
    Language: ['English', 'Hindi'],
    'Company type': ['Company', 'LLP'],
    'Company class': ['Private', 'Public', 'One Person Company'],
    'Company category': ['Company limited by Shares', 'Company limited by Guarantee', 'Unlimited Company'],
    'Company sub-category': ['Non-govt company', 'Subsidiary of foreign company'],
    'LLPIN/CIN type': ['CIN', 'LLPIN'],
    gender: ['Male', 'Female', 'Transgender'],
    nationality: ['Indian'],
    country: ['India'],
  };

  const SRC_LABEL = { manual: 'manual', doc: 'document', ai: 'AI', sandbox: 'MCA' };
  const NATURE = {
    adopted: 'Adopted Financial statements',
    provisional: 'Provisional un-adopted Financial statements',
    revised130: 'Revised Financial statements u/s 130',
    revised131: 'Revised Financial statements u/s 131',
  };

  /* ───────── fields of a form ───────── */
  const isOther = () => currentForm !== 'aoc4';
  const flowOf = f => FLOW[f] || FLOW.aoc4;

  function rawCategories(form) {
    const w = root;
    switch (form) {
      case 'aoc4_offline': return w.AOC4_OFFLINE_CATEGORIES || [];
      case 'inc32': return w.INC32_CATEGORIES || [];
      case 'dir3': return w.DIR3_CATEGORIES || [];
      case 'spice_a': {
        const all = w.SPICE_PART_A_FIELDS || [];
        const groups = FLOW.spice_a.groups;
        const byKey = new Map(all.map(f => [f.dataKey, f]));
        const used = new Set();
        const cats = groups.map(g => ({ id: g.id, label: g.label, icon: g.icon, fields: g.keys.map(k => byKey.get(k)).filter(Boolean) }));
        cats.forEach(c => c.fields.forEach(f => used.add(f.dataKey)));
        const rest = all.filter(f => !used.has(f.dataKey));
        if (rest.length) cats.push({ id: 'other', label: 'Other', icon: 'file', fields: rest });
        return cats;
      }
      default: return [];
    }
  }

  const catCache = {};
  function categories(form) {
    if (catCache[form]) return catCache[form];
    const hide = new Set(flowOf(form).hideCategories || []);
    const cats = rawCategories(form)
      .filter(c => !hide.has(c.id))
      .map(c => ({ ...c, fields: (c.fields || []).filter(f => f.type !== 'file') }))
      .filter(c => c.fields.length);
    if (cats.length) catCache[form] = cats;
    return cats;
  }
  const allFields = form => categories(form).flatMap(c => c.fields.map(f => ({ ...f, _group: c.label })));
  const isReq = (form, f) => !!f.required || (flowOf(form).required || []).includes(f.dataKey);
  const fieldByKey = (form, key) => allFields(form).find(f => f.dataKey === key);

  /* ───────── a client of this form: saved list + the one being edited ───────── */
  const KEY = f => 'germin8_clients_' + f;
  const ACTIVE = f => 'germin8_active_' + f;
  const work = {};
  const blank = () => ({ id: null, name: '', data: {}, sources: {}, meta: {} });
  const store = f => LS.get(KEY(f), {});

  function current(f) {
    f = f || currentForm;
    if (!work[f]) {
      const id = LS.get(ACTIVE(f), null);
      const rec = id && store(f)[id];
      work[f] = rec ? { id, name: rec.name, data: rec.data || {}, sources: rec.sources || {}, meta: rec.meta || {} } : blank();
      // Values typed on the earlier single-copy version of this screen become the first saved client.
      const legacy = !rec && LS.get('germin8_form_' + f, null);
      if (legacy && Object.keys(legacy).length) {
        LS.del('germin8_form_' + f);
        for (const [k, v] of Object.entries(legacy)) if (v !== '' && v != null) work[f].data[k] = String(v);
        persist(f);
      }
    }
    return work[f];
  }

  function identity(f, w) {
    if (w.meta && w.meta.companyName) return w.meta.companyName;
    for (const k of flowOf(f).identity || []) if (w.data[k]) return String(w.data[k]);
    return '';
  }

  function persist(f) {
    f = f || currentForm;
    const w = current(f);
    if (!Object.keys(w.data).length) return;
    if (!w.id) w.id = 'c' + Date.now().toString(36);
    w.name = identity(f, w) || w.name || 'Untitled ' + new Date().toLocaleDateString();
    const s = store(f);
    s[w.id] = { name: w.name, data: w.data, sources: w.sources, meta: w.meta, savedAt: Date.now() };
    LS.set(KEY(f), s);
    LS.set(ACTIVE(f), w.id);
    if (f === currentForm) { renderFormClients(); $('#saveState').textContent = 'Draft saved ' + new Date().toLocaleTimeString(); }
  }
  let persistTimer;
  const persistSoon = f => { clearTimeout(persistTimer); persistTimer = setTimeout(() => persist(f), 600); };

  function setField(f, key, value, src) {
    const w = current(f);
    if (value === '' || value == null) { delete w.data[key]; delete w.sources[key]; }
    else { w.data[key] = String(value); w.sources[key] = src || 'manual'; }
    persistSoon(f);
  }

  function renderFormClients() {
    const f = currentForm, w = current(f);
    const rows = Object.entries(store(f)).sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0));
    $('#clientSelect').innerHTML = '<option value="">New client</option>' +
      rows.map(([id, r]) => `<option value="${esc(id)}" ${id === w.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
  }

  /* Clients shipped with the extension (clients/index.json, entries with a formType) are saved once into
     this form's client list, so the same data the extension offers is here too. */
  const seeded = {};
  async function seedBundled(f) {
    if (seeded[f]) return;
    seeded[f] = true;
    try {
      const idx = await (await fetch('clients/index.json')).json();
      const saved = store(f);
      let added = 0;
      for (const c of (idx.clients || []).filter(x => x.formType === f)) {
        const id = 'bundled_' + c.id;
        if (saved[id]) continue;
        const j = await (await fetch(c.file)).json();
        const data = {}, sources = {};
        for (const [k, v] of Object.entries(j.formData || {})) if (v !== '' && v != null) { data[k] = String(v); sources[k] = 'bundled'; }
        saved[id] = { name: c.name, data, sources, meta: {}, savedAt: Date.now(), bundled: true };
        added++;
      }
      if (!added) return;
      LS.set(KEY(f), saved);
      // A form with no client open yet starts on the bundled one.
      if (!LS.get(ACTIVE(f), null) && !Object.keys(current(f).data).length) {
        const first = Object.keys(saved).find(id => saved[id].bundled);
        if (first) { LS.set(ACTIVE(f), first); delete work[f]; }
      }
      if (f === currentForm) { refreshAll(); toast('Loaded bundled client data'); }
    } catch (_) { /* no bundled clients reachable (opened from file://): nothing to add */ }
  }

  function loadClient(id) {
    const f = currentForm, rec = store(f)[id];
    if (!rec) return;
    work[f] = { id, name: rec.name, data: rec.data || {}, sources: rec.sources || {}, meta: rec.meta || {} };
    LS.set(ACTIVE(f), id);
    refreshAll();
    showPanel('data');
    toast('Loaded ' + rec.name);
  }

  function newClient() {
    const f = currentForm;
    work[f] = blank();
    LS.del(ACTIVE(f));
    uploadedFiles.length = 0; docs.length = 0; renderFiles();
    refreshAll();
    $('#saveState').textContent = 'New client — not saved yet';
    showPanel('data');
  }

  function loadData(data, name, src) {
    const f = currentForm, w = blank();
    for (const [k, v] of Object.entries(data || {})) if (v !== '' && v != null && typeof v !== 'object') { w.data[k] = String(v); w.sources[k] = src || 'manual'; }
    work[f] = w;
    if (name) w.meta.companyName = f === 'aoc4_offline' ? name : '';
    if (name && f !== 'aoc4_offline') w.name = name;
    persist(f);
    refreshAll();
  }

  function refreshAll() {
    renderData(); renderFormClients(); updateCounts();
    const cin = $('#sbCin'); if (cin && flowOf(currentForm).panels.includes('sandbox')) { cin.value = current().data.cin || ''; cin.dispatchEvent(new Event('input')); }
    if (typeof activePanel !== 'undefined' && activePanel === 'review') renderReview();
  }

  /* ───────── checks ───────── */
  const DMY = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  function validDate(v) {
    const m = DMY.exec(v); if (!m) return false;
    const d = +m[1], mo = +m[2], y = +m[3];
    const t = new Date(y, mo - 1, d);
    return t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d;
  }
  function problemWith(f, v) {
    const key = f.dataKey;
    if (f.type === 'date') return validDate(v) ? '' : 'must be a real date written DD/MM/YYYY';
    if (/^cin$/i.test(key)) return RE.cin.test(v) ? '' : 'is not a valid 21-character CIN';
    if (/^(pan|auditorPAN)$/.test(key)) return RE.pan.test(v) ? '' : 'is not a valid PAN (5 letters, 4 digits, 1 letter)';
    if (key === 'din') return RE.din.test(v) ? '' : 'must be an 8-digit DIN';
    if (/^(director\d+DIN|br\d+DIN)$/.test(key)) return RE.din.test(v) || RE.pan.test(v) ? '' : 'must be an 8-digit DIN or a PAN';
    if (key === 'email') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? '' : 'is not a valid email address';
    if (key === 'mobile') return /^[6-9]\d{9}$/.test(v) ? '' : 'must be a 10-digit Indian mobile number';
    if (/pincode$/i.test(key)) return RE.pin.test(v) ? '' : 'must be a 6-digit PIN code';
    if (key === 'srnADT1') return RE.srn.test(v) ? '' : 'does not look like an SRN (for example AC0363504)';
    return '';
  }
  function check(form) {
    form = form || currentForm;
    const w = current(form), errors = [], warnings = [];
    for (const f of allFields(form)) {
      const v = (w.data[f.dataKey] || '').trim();
      const label = f.label || f.dataKey;
      if (!v) { if (isReq(form, f)) errors.push({ key: f.dataKey, msg: `${label} is required.` }); continue; }
      const p = problemWith(f, v);
      if (p) errors.push({ key: f.dataKey, msg: `${label} ${p}.` });
    }
    if (form === 'aoc4_offline') {
      if (w.data.agmHeld === 'Yes' && !w.data.agmDate) warnings.push({ key: 'agmDate', msg: 'The AGM was held but its date is blank.' });
      if (w.data.isSubsidiary === 'Yes' && !w.data.hasSubsidiaryOrAssociate) warnings.push({ key: 'hasSubsidiaryOrAssociate', msg: 'Say whether the company has a subsidiary, associate or joint venture.' });
    }
    return { errors, warnings };
  }

  function progress(form) {
    const w = current(form), fields = allFields(form);
    const filled = f => (w.data[f.dataKey] || '').trim() !== '';
    const req = fields.filter(f => isReq(form, f));
    return { total: fields.length, filled: fields.filter(filled).length, reqTotal: req.length, reqFilled: req.filter(filled).length };
  }

  /* ───────── Data Entry ───────── */
  function fieldHtml(form, f, w) {
    const key = f.dataKey;
    const id = `pf_${form}_${key.replace(/[^A-Za-z0-9]+/g, '_')}`;
    const val = w.data[key] == null ? '' : String(w.data[key]);
    const src = w.sources[key];
    const badge = src && src !== 'manual' ? ` <span class="badge ${src === 'doc' ? 'doc' : src}">${esc(SRC_LABEL[src] || src)}</span>` : '';
    const label = `<label class="per-form-label" for="${id}">${esc(f.label || key)}${isReq(form, f) ? '<span class="per-form-req" aria-label="required">*</span>' : ''}${badge}</label>`;
    const attrs = `data-perform-input data-form="${esc(form)}" data-key="${esc(key)}"`;
    const sug = SUGGEST[key];
    let control;
    if ((f.type === 'select') && f.options) {
      control = `<select class="sel" id="${id}" ${attrs}><option value="">— Select —</option>${f.options.map(o => `<option value="${esc(o)}"${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    } else if (f.type === 'radio' && f.options) {
      control = `<div class="per-form-radios">${f.options.map((o, i) => `<label class="per-form-radio"><input type="radio" ${i === 0 ? `id="${id}"` : ''} name="${id}" value="${esc(o)}"${o === val ? ' checked' : ''} ${attrs}>${esc(o)}</label>`).join('')}</div>`;
    } else if (f.type === 'textarea') {
      control = `<textarea class="ta" id="${id}" ${attrs}>${esc(val)}</textarea>`;
    } else {
      const ph = f.type === 'date' ? 'DD/MM/YYYY' : '';
      const list = sug ? ` list="${id}_list"` : '';
      control = `<input class="in" type="text" id="${id}" value="${esc(val)}" placeholder="${ph}"${list} ${attrs}>` +
        (sug ? `<datalist id="${id}_list">${sug.map(o => `<option value="${esc(o)}"></option>`).join('')}</datalist>` : '');
    }
    return `<div class="per-form-field" data-field="${esc(key)}"><div>${label}</div>${control}</div>`;
  }

  function renderData() {
    const panel = $('#panel-data'), host = $('#perFormHost');
    if (!panel || !host) return;
    panel.classList.toggle('per-form-mode', isOther());
    if (!isOther()) { host.innerHTML = ''; return; }
    const form = currentForm, def = FORM_DEFS[form], w = current(form), cats = categories(form);
    const p = progress(form);
    const pct = p.reqTotal ? Math.round(p.reqFilled / p.reqTotal * 100) : p.total ? Math.round(p.filled / p.total * 100) : 0;
    const body = cats.length ? cats.map(c => `
      <details class="per-form-block" open>
        <summary><span class="per-form-cat-icon">${iconSvg(c.icon)}</span> ${esc(c.label)}
          <span class="per-form-cat-count">${c.fields.length} field${c.fields.length === 1 ? '' : 's'}</span></summary>
        <div class="per-form-grid">${c.fields.map(f => fieldHtml(form, f, w)).join('')}</div>
      </details>`).join('') : `<div class="per-form-empty">The field list for <strong>${esc(def.label)}</strong> did not load. Reload the page.</div>`;
    host.innerHTML = `
      <div class="per-form-shell" data-form="${esc(form)}">
        <div class="per-form-head">
          <div class="per-form-title"><strong>${esc(def.label)}</strong><span class="per-form-desc">${esc(def.description)}</span></div>
          <div class="per-form-stats">
            <span class="per-form-prefill">${p.reqTotal ? `${p.reqFilled} of ${p.reqTotal} required filled` : `${p.filled} of ${p.total} filled`}</span>
            <div class="per-form-ratio"><i style="width:${pct}%"></i></div>
          </div>
          <div class="per-form-actions"><button class="btn sm" type="button" data-perform-clear>Clear</button></div>
        </div>
        ${body}
      </div>`;
  }

  function refreshProgress() {
    const shell = $('#perFormHost .per-form-shell'); if (!shell) return;
    const p = progress(currentForm);
    const pct = p.reqTotal ? Math.round(p.reqFilled / p.reqTotal * 100) : p.total ? Math.round(p.filled / p.total * 100) : 0;
    shell.querySelector('.per-form-ratio i').style.width = pct + '%';
    shell.querySelector('.per-form-prefill').textContent = p.reqTotal ? `${p.reqFilled} of ${p.reqTotal} required filled` : `${p.filled} of ${p.total} filled`;
    updateCounts();
  }

  function focusField(key) {
    showPanel('data');
    setTimeout(() => {
      const el = document.querySelector(`#perFormHost [data-key="${CSS.escape(key)}"]`); if (!el) return;
      const block = el.closest('details'); if (block) block.open = true;
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.focus({ preventScroll: true });
    }, 60);
  }

  function updateCounts() {
    if (!isOther()) return;
    const f = currentForm, w = current(f), p = progress(f), { errors, warnings } = check(f);
    $('#cnt-data').textContent = `${p.filled}/${p.total}`;
    $('#cnt-sandbox').innerHTML = w.sources.cin === 'sandbox' ? iconSvg('check') : '';
    $('#cnt-sandbox').className = 'count ok';
    $('#cnt-upload').textContent = uploadedFiles.length ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}` : '';
    $('#cnt-review').textContent = errors.length ? `${errors.length} error${errors.length > 1 ? 's' : ''}` : warnings.length ? `${warnings.length} warn` : (p.filled ? 'ready' : '');
    $('#cnt-review').className = 'count ' + (errors.length ? 'err' : warnings.length ? '' : (p.filled ? 'ok' : ''));
    $('#companyTag').textContent = identity(f, w) || w.name || '';
  }

  /* ───────── Sandbox (AOC-4 Offline) ───────── */
  function applyMaster(d) {
    const f = currentForm, w = current(f);
    w.meta.companyName = d.company_name || '';
    setField(f, 'cin', d.cin, 'sandbox');
    if (d.authorized_capital != null) setField(f, 'authorisedCapital', String(num(d.authorized_capital)), 'sandbox');
    const list = getMasterList(); list[d.cin] = Object.assign({}, d, { _savedAt: Date.now() }); LS.set('aoc4_company_master_list', list);
    persist(f);
    renderData(); updateCounts();
    renderSandboxResult(d);
    $('#sbApplied').textContent = 'Filled in the form: CIN and authorised capital. The rest of this form is not on MCA’s master data, so enter or upload it.';
    renderSavedCompanies();
  }

  /* ───────── Upload & AI ───────── */
  let aoc4Upload = null;   // the texts AOC-4 shows, remembered so they can be restored
  function prepareUpload() {
    const f = currentForm, def = FORM_DEFS[f];
    if (!aoc4Upload) aoc4Upload = { meta: $('#docsMeta').textContent, note: $('#extractNote').textContent, summary: $('#reqSummary').textContent };
    if (isOther()) {
      $('#docsMeta').textContent = `Upload ${flowOf(f).docs} — PDF, Word, Excel, text or a photo`;
      $('#extractNote').textContent = `The app looks for identity numbers (CIN, PAN, DIN, email, mobile, PIN, date of birth) in the documents itself. With an AI key saved in Settings it also reads the other ${def.label} fields. Nothing is written into the form until you apply it in the review below.`;
      $('#reqSummary').textContent = `Documents MCA will ask for when filing ${def.label}`;
    } else {
      $('#docsMeta').textContent = aoc4Upload.meta;
      $('#extractNote').textContent = aoc4Upload.note;
      $('#reqSummary').textContent = aoc4Upload.summary;
    }
    $('#reqList').innerHTML = def.requirements.map(r => `<li><span class="tag ${r.tag}">${r.tag}</span><span>${esc(r.text)}</span></li>`).join('');
    proposals = []; proposalSigs = { FS: [], BR: [] }; lastExtraction = null;
    $('#reviewBlock').classList.add('hidden'); $('#applyResult').innerHTML = ''; $('#docNotes').innerHTML = ''; $('#extractStatus').textContent = '';
    setStep(1);
    updateExtractBtn();
  }

  function prepareSandbox() {
    const other = isOther();
    $('#sbServerAddrBtn').classList.toggle('hidden', other);
    $('#sbResultBlock').classList.add('hidden');
    $('#sbStatus').innerHTML = '';
    const cin = $('#sbCin');
    cin.value = other ? (current().data.cin || '') : (state.general.CIN || '');
    cin.dispatchEvent(new Event('input'));
  }

  /* what to look for without an AI model: numbers that identify a person or company */
  const IDENT = [
    { keys: ['cin', 'CIN'], conf: 0.9, find: t => { const m = /\b([LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/.exec(t); return m && { value: m[1], quote: m[0] }; } },
    { keys: ['pan'], conf: 0.85, find: t => { const m = /\b([A-Z]{5}\d{4}[A-Z])\b/.exec(t); return m && { value: m[1], quote: m[0] }; } },
    { keys: ['din'], conf: 0.85, find: t => { const m = /\bDIN\b\D{0,15}(\d{8})\b/i.exec(t); return m && { value: m[1], quote: m[0].trim() }; } },
    { keys: ['email'], conf: 0.7, find: t => { const m = /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/.exec(t); return m && { value: m[1], quote: m[0] }; } },
    { keys: ['mobile'], conf: 0.7, find: t => { const m = /(?:mobile|phone|contact|mob)\b\D{0,20}(?:\+?91[\s-]?)?([6-9]\d{9})\b/i.exec(t); return m && { value: m[1], quote: m[0].trim() }; } },
    { keys: ['pincode'], conf: 0.7, find: t => { const m = /(?:pin\s*code|pincode|\bpin\b)\D{0,6}(\d{6})\b/i.exec(t); return m && { value: m[1], quote: m[0].trim() }; } },
    { keys: ['dob'], conf: 0.8, find: t => { const m = /(?:date of birth|\bdob\b|d\.o\.b\.?)\D{0,10}(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/i.exec(t); return m && { value: `${m[1]}/${m[2]}/${m[3]}`, quote: m[0].trim() }; } },
    { keys: ['fatherName'], conf: 0.55, find: t => { const m = /father'?s?\s*name\s*[:\-]\s*([A-Za-z][A-Za-z .]{2,60})/i.exec(t); return m && { value: m[1].trim().replace(/\s+/g, ' '), quote: m[0].trim() }; } },
    { keys: ['name'], conf: 0.45, find: t => { const m = /(?:^|\n)\s*name\s*[:\-]\s*([A-Za-z][A-Za-z .]{2,60})/i.exec(t); return m && { value: m[1].trim().replace(/\s+/g, ' '), quote: m[0].trim() }; } },
  ];

  /* AOC-4 Offline asks for the same facts as AOC-4, so the existing AOC-4 document reader is reused. */
  const OFFLINE_MAP = {
    cin: 'general.CIN', financialYearFrom: 'general.FY_FROM', financialYearTo: 'general.FY_TO',
    boardMeetingDateFS: 'general.BOARD_MEETING_DATE', natureOfFS: 'general.NATURE_FS',
    provisionalFSFiled: 'general.PROVISIONAL_FILED_EARLIER', adoptedInAdjournedAGM: 'general.ADOPTED_IN_ADJOURNED_AGM',
    boardMeetingDateBR: 'general.BOARD_REPORT_DATE', auditorSigningDate: 'general.AUDITOR_SIGN_DATE',
    agmHeld: 'general.AGM_HELD', agmDate: 'general.AGM_DATE', agmDueDate: 'general.AGM_DUE_DATE', agmExtension: 'general.AGM_EXTENSION',
    isSubsidiary: 'subsidiary.IS_SUBSIDIARY', hasSubsidiaryOrAssociate: 'subsidiary.HAS_SUBSIDIARY_OR_JV',
    srnADT1: 'auditor.ADT_SRN', numberOfAuditors: 'auditor.NUM_AUDITORS', auditorPAN: 'auditor.AUDITOR_PAN',
    auditorCategory: 'auditor.AUDITOR_CATEGORY', auditorMembershipNo: 'auditor.AUDITOR_FIRM_REG', auditorName: 'auditor.AUDITOR_NAME',
    auditorAddress1: 'auditor.AUDITOR_ADDR1', auditorAddress2: 'auditor.AUDITOR_ADDR2', auditorCountry: 'auditor.AUDITOR_COUNTRY',
    auditorPincode: 'auditor.AUDITOR_PIN', auditorLocality: 'auditor.AUDITOR_AREA', auditorCity: 'auditor.AUDITOR_CITY',
    auditorDistrict: 'auditor.AUDITOR_DISTRICT', auditorState: 'auditor.AUDITOR_STATE',
    signingMemberName: 'auditor.MEMBER_NAME', signingMembershipNo: 'auditor.MEMBER_NUMBER',
    industryType: 'industry.TYPE_OF_INDUSTRY', scheduleIIIApplicable: 'industry.SCHEDULE_III', consolidatedFS: 'industry.CONSOLIDATED_FS',
    booksInElectricForm: 'industry.MAINTAIN_ELECTRONIC_BOOKS',
    serverAddress1: 'industry.SERVER_ADDR1', serverAddress2: 'industry.SERVER_ADDR2', serverCountry: 'industry.SERVER_COUNTRY',
    serverPincode: 'industry.SERVER_PIN', serverLocality: 'industry.SERVER_AREA', serverCity: 'industry.SERVER_CITY',
    serverDistrict: 'industry.SERVER_DISTRICT', serverState: 'industry.SERVER_STATE',
    relatedPartyTransactions: 'relatedParty.ANY_TRANSACTION', cagCommented: 'auditorReport.CAG_COMMENTED',
    csrApplicability: 'csr.CSR_APPLICABILITY', secretarialAudit: 'secretarialAudit.SECRETARIAL_AUDIT_APPLICABLE',
    authorisedCapital: 'shareCapital.AUTH_NOMINAL',
  };
  const OFFLINE_REV = Object.fromEntries(Object.entries(OFFLINE_MAP).map(([k, p]) => [p, k]));

  // Value → what the field accepts (a listed option, case-insensitively), or '' if it does not fit.
  function coerce(form, key, value) {
    const f = fieldByKey(form, key);
    let v = typeof value === 'number' ? String(Math.round(value)) : String(value ?? '').replace(/\s+/g, ' ').trim();
    if (!f || v === '') return '';
    if (key === 'natureOfFS' && NATURE[v]) v = NATURE[v];
    if (f.options) { const hit = f.options.find(o => o.toLowerCase() === v.toLowerCase()); return hit || ''; }
    const suggested = (SUGGEST[key] || []).find(o => o.toLowerCase() === v.toLowerCase());
    if (suggested) return suggested;
    if (f.type === 'date') {
      if (DMY.test(v)) return v;
      const iso = AOC4Extract.parsePeriod(v);
      return iso ? fromISO(iso) : '';
    }
    return v;
  }

  // A whole AOC-4 client file → AOC-4 Offline field values.
  function aoc4ToOffline(c) {
    const out = {};
    for (const [key, path] of Object.entries(OFFLINE_MAP)) {
      const v = coerce('aoc4_offline', key, getPath(c, path));
      if (v) out[key] = v;
    }
    const fs = c.signatoriesFS || [];
    const br = (c.signatoriesBR && c.signatoriesBR.length) ? c.signatoriesBR : fs;
    [0, 1].forEach(i => {
      const s = fs[i], b = br[i];
      if (s) for (const [k, v] of [[`director${i + 1}DIN`, s.din], [`director${i + 1}Name`, s.name], [`director${i + 1}Designation`, s.designation || 'Director'], [`director${i + 1}DateFS`, s.date]]) { const x = coerce('aoc4_offline', k, v); if (x) out[k] = x; }
      if (b) for (const [k, v] of [[`br${i + 1}DIN`, b.din], [`br${i + 1}Name`, b.name], [`br${i + 1}Designation`, b.designation || 'Director'], [`br${i + 1}DateBR`, b.date]]) { const x = coerce('aoc4_offline', k, v); if (x) out[k] = x; }
    });
    return out;
  }

  function ruleProposals(form, ready) {
    const out = [], have = new Set(allFields(form).map(f => f.dataKey));
    for (const rule of IDENT) {
      const key = rule.keys.find(k => have.has(k)); if (!key) continue;
      for (const d of ready) {
        const m = d.text && rule.find(d.text); if (!m) continue;
        const value = coerce(form, key, m.value); if (!value) continue;
        out.push({ path: key, value, period: null, evidence: { file: d.name, where: '', quote: m.quote }, confidence: rule.conf, method: 'rules' });
        break;
      }
    }
    if (form === 'aoc4_offline') {
      const analyses = ready.filter(d => d.analysis).map(d => d.analysis);
      if (analyses.length) {
        try {
          const r = AOC4Extract.buildProposals(analyses, null, { proposeFy: false });
          for (const p of r.proposals) {
            const key = OFFLINE_REV[p.path]; if (!key) continue;
            const value = coerce(form, key, p.value); if (!value) continue;
            out.push({ ...p, path: key, value });
          }
          r.signatoriesFS.slice(0, 2).forEach((s, i) => {
            const ev = { file: s.file || '', where: 'signatures', quote: `${s.name} (DIN ${s.din})` };
            for (const [k, v] of [[`director${i + 1}DIN`, s.din], [`director${i + 1}Name`, s.name], [`director${i + 1}Designation`, s.designation], [`director${i + 1}DateFS`, s.date]]) {
              const x = coerce(form, k, v); if (x) out.push({ path: k, value: x, period: null, evidence: ev, confidence: 0.8, method: 'rules' });
            }
          });
        } catch (_) { /* the AOC-4 reader is a bonus here; identity numbers above still apply */ }
      }
    }
    const seen = new Set();
    return out.filter(p => !seen.has(p.path) && seen.add(p.path));
  }

  const FORM_SCHEMA = {
    type: 'object', additionalProperties: false, required: ['fields', 'notes'],
    properties: {
      fields: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'value', 'evidence', 'confidence'], properties: { key: { type: 'string' }, value: { type: 'string' }, evidence: { type: 'string' }, confidence: { type: 'number' } } } },
      notes: { type: 'array', items: { type: 'string' } },
    },
  };

  async function extractWithModelForm(form, ready) {
    const def = FORM_DEFS[form], fields = allFields(form);
    const system = [
      `You are an Indian company-law practitioner preparing MCA form ${def.label} (${def.description}) from a client's documents.`,
      'Fill the field catalogue given by the user. Return only the JSON object described by the schema. Rules:',
      '- value is always a string. Dates: DD/MM/YYYY. Yes/No fields: exactly "Yes" or "No". Amounts: plain digits in rupees. Fields with a list of options: use one of the options exactly.',
      '- Copy names, addresses and numbers exactly as the documents state them. Never invent, estimate or guess: omit a field the documents do not state.',
      '- evidence: the document name, the page or sheet, and a short quote of what you read. confidence: 0 to 1.',
    ].join('\n');
    const catalogue = fields.map(f => `${f.dataKey} — ${f.label || f.dataKey} [${f.type}${f.options ? ': ' + f.options.join(' | ') : ''}]`).join('\n');
    const text = ready.filter(d => d.text).map(d => `=== ${d.name} (${TYPE_LABEL[d.type] || d.type}) ===\n${d.text.slice(0, 150000)}`).join('\n\n');
    const user = `Field catalogue (key — meaning [type]):\n${catalogue}\n\nDocuments (text extracted by the app; PDFs and images may also be attached in full):\n${text || '(no text could be extracted; read the attached files)'}`;
    return callModel({ system, user, schema: FORM_SCHEMA, schemaName: 'form_extraction', attachments: ready, plainHint: 'Return only one JSON object with the keys fields and notes, and nothing else.' });
  }

  function normalizeModelForm(form, out) {
    const proposals = [];
    for (const f of (out && out.fields) || []) {
      if (!f || typeof f.key !== 'string' || !fieldByKey(form, f.key.trim())) continue;
      const key = f.key.trim(), value = coerce(form, key, f.value); if (!value) continue;
      proposals.push({ path: key, value, period: null, evidence: { file: '', where: 'AI', quote: String(f.evidence || '').replace(/\s+/g, ' ').slice(0, 160) }, confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0.6)), method: 'ai' });
    }
    return { proposals, notes: Array.isArray(out && out.notes) ? out.notes.map(n => String(n)) : [] };
  }

  async function runExtraction() {
    const form = currentForm;
    const ready = docs.filter(d => d && d.status === 'ok' && !d.clientJson);
    if (!ready.length) return;
    const btn = $('#extractBtn'); btn.disabled = true; setStep(2);
    $('#reviewBlock').classList.add('hidden'); $('#applyResult').innerHTML = ''; $('#docNotes').innerHTML = '';
    const status = html => { $('#extractStatus').innerHTML = html; };
    try {
      status('<span class="spin"></span> Reading the documents…');
      const rules = ruleProposals(form, ready);
      let ai = { proposals: [], notes: [] }, aiError = null;
      if ($('#useAi').checked && settings.llmKey) {
        status(`<span class="spin"></span> Asking ${settings.llmProvider === 'anthropic' ? 'Claude' : settings.llmProvider}… this can take a minute`);
        try { ai = normalizeModelForm(form, await extractWithModelForm(form, ready)); } catch (e) { aiError = e.message; }
      }
      const w = current(form), order = categories(form).map(c => c.label);
      const merged = AOC4Extract.mergeProposals(rules, ai.proposals);
      proposals = merged.map(p => {
        const f = fieldByKey(form, p.path);
        return { ...p, label: f.label || f.dataKey, type: f.options ? 'select' : 'text', options: f.options, group: f._group, current: w.data[p.path] };
      }).sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
      proposalSigs = { FS: [], BR: [] };
      lastExtraction = {
        rules: { fy: null, fyInferred: false, unmappedPeriods: [], signatoriesFS: [], signatoriesCarried: false },
        aiNorm: { proposals: ai.proposals, notes: ai.notes, unmappedPeriods: [], signatoriesFS: [], signatoriesBR: [] },
        aiError, files: ready.map(d => d.name),
      };
      renderProposals();
      setStep(3);
      status(proposals.length ? 'Review the values below, then apply the ones you accept.' : 'Nothing usable was found in these documents.');
      if (!proposals.length) setStep(1);
    } catch (e) {
      status(`<span style="color:var(--err)">${esc(e.message)}</span>`); setStep(1);
    } finally { updateExtractBtn(); }
  }

  function applyProposals() {
    const form = currentForm;
    let n = 0;
    $$('#aiDiffTable input[type=checkbox]:checked').forEach(c => {
      const p = proposals[+c.dataset.i]; if (!p) return;
      const value = coerce(form, p.path, p.value); if (!value) return;
      setField(form, p.path, value, p.sources && p.sources.includes('rules') ? 'doc' : 'ai');
      n++;
    });
    persist(form);
    renderData(); updateCounts();
    const { errors, warnings } = check(form);
    setStep(4);
    $('#applyResult').innerHTML = `<div class="note ${errors.length ? 'warn' : 'ok'}"><strong>${n} value${n === 1 ? '' : 's'} applied.</strong> ${FORM_DEFS[form].label} now has ${errors.length} error${errors.length === 1 ? '' : 's'} and ${warnings.length} warning${warnings.length === 1 ? '' : 's'}. <button class="btn sm primary" data-go="review" style="margin-left:8px">Open Review &amp; Send</button> <button class="btn sm" data-go="data">Check in Data Entry</button></div>`;
    $$('#applyResult [data-go]').forEach(b => b.addEventListener('click', () => showPanel(b.dataset.go)));
    toast(`${n} value${n === 1 ? '' : 's'} applied from the documents`);
    for (const p of proposals) p.current = current(form).data[p.path];
    renderProposals();
  }

  /* ───────── Review & Send ───────── */
  function clientInfo(form) {
    const w = current(form), d = w.data;
    const info = { id: w.id || (identity(form, w) || form).toLowerCase().replace(/[^a-z0-9]+/g, '_'), name: identity(form, w) || w.name || FORM_DEFS[form].label + ' client', cin: d.cin || d.CIN || null, source: 'dashboard' };
    if (d.din) info.din = d.din;
    if (d.financialYearFrom && d.financialYearTo) info.fy = { from: d.financialYearFrom, to: d.financialYearTo };
    return info;
  }
  const payload = form => { form = form || currentForm; return { formType: form, clientInfo: clientInfo(form), formData: { ...current(form).data } }; };

  function renderReview() {
    const f = currentForm, w = current(f), { errors, warnings } = check(f);
    $('#issueSummary').textContent = errors.length || warnings.length ? `${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : 'All checks passed';
    const li = (sev, i) => `<li><span class="sev ${sev}"></span><span>${esc(i.msg)}</span><a href="#" data-focus="${esc(i.key)}">Go to field</a></li>`;
    $('#issueList').innerHTML = errors.map(i => li('err', i)).concat(warnings.map(i => li('warn', i))).join('') ||
      '<li><span class="sev" style="background:var(--ok)"></span><span>No issues. The data is ready for the extension.</span></li>';
    const counts = { manual: 0, sandbox: 0, doc: 0, ai: 0 };
    for (const k of Object.keys(w.data)) counts[w.sources[k] in counts ? w.sources[k] : 'manual']++;
    $('#sourceChips').innerHTML = [['manual', 'entered by hand'], ['sandbox', 'from MCA (Sandbox)'], ['doc', 'read from documents'], ['ai', 'from the AI model']].map(([k, label]) => `<span class="chip"><strong>${counts[k]}</strong> ${label}</span>`).join('');
    if (!jsonEditing) $('#jsonPreview').textContent = JSON.stringify(payload(f), null, 2);
    $('#sendBtn').disabled = errors.length > 0;
    $('#sendBtn').title = errors.length ? 'Clear the errors above first' : '';
  }

  function applyJson(text) {
    const j = JSON.parse(text);
    const data = j && j.formData && typeof j.formData === 'object' ? j.formData : j;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('expected a JSON object of field values');
    loadData(data, j && j.clientInfo && j.clientInfo.name, 'manual');
  }

  function download() {
    const p = payload(), blob = new Blob([JSON.stringify({ ...p, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${p.clientInfo.id}_${p.formType}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    persist();
    toast(`Downloaded ${a.download}`);
  }

  async function send() {
    const f = currentForm, note = html => { $('#sendResult').innerHTML = html; };
    const { errors } = check(f);
    if (errors.length) return toast('Clear the errors first', true);
    const p = payload(f);
    if (!settings.extId) {
      download();
      return note('<div class="note warn">No extension id saved, so the data was downloaded instead. Add the id in <strong>Settings → Chrome extension</strong> to send it directly.</div>');
    }
    note('<div class="note"><span class="spin"></span> Sending to the extension…</div>');
    try {
      await sendToExtension({ action: 'importClient', formType: f, formData: p.formData, clientInfo: p.clientInfo });
      persist(f);
      note(`<div class="note ok"><strong>${esc(p.clientInfo.name)}</strong> is now in the Germin8 extension as <strong>${esc(FORM_DEFS[f].label)}</strong>. Open the extension on the MCA page, choose this form and client, then click Fill.</div>`);
      toast('Sent to the extension');
    } catch (e) {
      download();
      note(`<div class="note err"><strong>Could not reach the extension:</strong> ${esc(e.message)}<br>The data was downloaded instead — import it in the extension with <strong>Import JSON</strong>.</div>`);
    }
  }

  /* ───────── samples & import ───────── */
  const SAMPLES = {
    aoc4_offline: { name: 'LESSONBOARD EDU SOLUTIONS PRIVATE LIMITED', data: {
      cin: 'U80904KA2018PTC119370', authorisedCapital: '1000000', financialYearFrom: '01/04/2025', financialYearTo: '31/03/2026',
      natureOfFS: 'Adopted Financial statements', provisionalFSFiled: 'No', adoptedInAdjournedAGM: 'No', agmHeld: 'Yes', agmExtension: 'No',
      director1DIN: '08302207', director1Name: 'PUNIT AHUJA', director1Designation: 'Director', director2DIN: '08302208', director2Name: 'KIRTI PUNIT AHUJA', director2Designation: 'Director',
      isSubsidiary: 'No', hasSubsidiaryOrAssociate: 'No', srnADT1: 'AC0363504', numberOfAuditors: '1', auditorPAN: 'AAOFJ5797P', auditorCategory: "Auditor's firm",
      auditorMembershipNo: '018971S', auditorName: 'Jain S A K and Co', auditorAddress1: 'S3, 2nd Floor White House', auditorAddress2: 'St Marks Road, Bangalore',
      auditorCountry: 'India', auditorPincode: '560001', auditorLocality: 'CMM Court Complex', auditorCity: 'Bangalore', auditorDistrict: 'Bangalore', auditorState: 'Karnataka',
      signingMemberName: 'Sumit Jain', signingMembershipNo: '235818', industryType: 'Commercial & Industrial', scheduleIIIApplicable: 'Yes', consolidatedFS: 'No', booksInElectricForm: 'Yes',
      relatedPartyTransactions: 'No', cagCommented: 'Not Applicable', csrApplicability: 'Not applicable', secretarialAudit: 'No',
    } },
    spice_a: { name: 'ACME LEARNING PRIVATE LIMITED', data: {
      Language: 'English', 'Company type': 'Company', 'Company class': 'Private', 'Company category': 'Company limited by Shares', 'Company sub-category': 'Non-govt company',
      proposedName1: 'ACME LEARNING PRIVATE LIMITED', proposedName2: 'ACME EDUTECH PRIVATE LIMITED', 'NIC code': '85421', 'Business activity': 'Online coaching and training services',
    } },
    inc32: { name: 'ACME LEARNING PRIVATE LIMITED', data: {
      'Company type': 'Company', 'Company class': 'Private', 'Company category': 'Company limited by Shares', 'Company sub-category': 'Non-govt company',
      proposedName1: 'ACME LEARNING PRIVATE LIMITED', proposedName2: 'ACME EDUTECH PRIVATE LIMITED', 'NIC code': '85421', 'Business activity': 'Online coaching and training services',
    } },
    dir3: { name: 'SAMPLE DIRECTOR', data: {
      din: '12345678', pan: 'ABCDE1234F', name: 'SAMPLE DIRECTOR', fatherName: 'SAMPLE FATHER', dob: '01/01/1980', gender: 'Male', nationality: 'Indian',
      mobile: '9876543210', email: 'director@example.com', addr1: '1 Example Street', city: 'Bangalore', state: 'Karnataka', country: 'India', pincode: '560001',
    } },
  };
  function loadSample() {
    const s = SAMPLES[currentForm]; if (!s) return;
    loadData(s.data, s.name, 'manual');
    toast(`Sample ${FORM_DEFS[currentForm].label} client loaded`);
  }

  async function importFile(file) {
    const j = JSON.parse(await file.text());
    // An AOC-4 client file can seed AOC-4 Offline: it holds the same facts.
    if (currentForm === 'aoc4_offline' && j && j.general && !j.formData) {
      const name = (j.displayName || '').replace(/\s*\(FY.*$/, '');
      loadData(aoc4ToOffline(j), name, 'manual');
      return toast(`Imported ${file.name} (read as an AOC-4 client file)`);
    }
    applyJson(JSON.stringify(j));
    toast(`Imported ${file.name}`);
  }

  /* ───────── nav, form change, binding ───────── */
  function panelText(name) {
    const def = FORM_DEFS[currentForm], flow = flowOf(currentForm);
    switch (name) {
      case 'data': return ['Data Entry', `Fill in the fields of ${def.label}. Fields marked * are required.`];
      case 'sandbox': return ['Sandbox lookup', 'Enter a CIN to pull the company master data (CIN and authorised capital) from MCA.'];
      case 'upload': return ['Upload & AI', `Upload ${flow.docs}; the ${def.label} fields found in them are proposed for you to accept.`];
      default: return ['Review & Send', 'Fix the checks, then hand the data to the Germin8 extension.'];
    }
  }

  function applyNav() {
    let n = 0;
    $$('.nav button').forEach(b => {
      const on = PANELS.includes(b.dataset.panel);
      b.classList.toggle('hidden', !on);
      if (on) { n++; b.querySelector('.step').textContent = n; }
    });
  }

  const FORM_ICON = { aoc4: 'file', aoc4_offline: 'filedown', spice_a: 'building', inc32: 'clipboard', dir3: 'usercheck' };
  function onFormChange() {
    const f = currentForm;
    PANELS = flowOf(f).panels.slice();
    const sel = $('#formSelect'); if (sel && sel.value !== f) sel.value = f;
    const ico = $('#formSelectIco'); if (ico) ico.innerHTML = iconSvg(FORM_ICON[f]);
    const desc = $('#formSelectDesc'); if (desc) desc.textContent = FORM_DEFS[f].description;
    applyNav();
    renderData();
    prepareUpload();
    prepareSandbox();
    if (isOther()) { renderFormClients(); updateCounts(); seedBundled(f); } else { root.renderClientList(); render(true); }
    showPanel(PANELS.includes(activePanel) ? activePanel : 'data');
  }

  // Header chip: is the Germin8 extension reachable from this page?
  async function checkExtension() {
    const m = $('#bridgeMark'), t = $('#bridgeMarkText'); if (!m || !t) return;
    m.classList.remove('on');
    if (!settings.extId) { t.textContent = 'Extension ID not set (Settings)'; return; }
    try { const r = await sendToExtension({ action: 'ping' }); m.classList.add('on'); t.textContent = `${r.name || 'Extension'} connected`; }
    catch (_) { t.textContent = 'Extension not reachable'; }
  }

  function bind() {
    const sel = $('#formSelect');
    sel.innerHTML = Object.keys(FORM_DEFS).map(k => `<option value="${k}">${esc(FORM_DEFS[k].label)}</option>`).join('');
    sel.value = currentForm;
    sel.addEventListener('change', () => setCurrentForm(sel.value));
    const host = $('#perFormHost');
    const onInput = e => {
      const el = e.target.closest('[data-perform-input]'); if (!el) return;
      setField(el.dataset.form, el.dataset.key, el.value, 'manual');
      const badge = el.closest('.per-form-field').querySelector('.badge'); if (badge) badge.remove();
      refreshProgress();
    };
    host.addEventListener('input', onInput);
    host.addEventListener('change', onInput);
    host.addEventListener('click', e => {
      if (!e.target.closest('[data-perform-clear]')) return;
      const f = currentForm, w = current(f);
      if (w.id) { const saved = store(f); delete saved[w.id]; LS.set(KEY(f), saved); }
      LS.del(ACTIVE(f));
      work[f] = blank();
      renderData(); renderFormClients(); updateCounts();
      toast(`Cleared ${FORM_DEFS[f].label} fields`);
    });
    checkExtension();
  }

  root.FormFlow = {
    FLOW, panelsFor: f => flowOf(f).panels.slice(), panelText, onFormChange, bind, checkExtension,
    renderClientList: renderFormClients, loadClient, newClient, importFile, loadSample, updateCounts, focusField,
    runExtraction, applyProposals, applyMaster, renderReview, applyJson, download, send, payload,
    // exposed for tests
    _check: check, _categories: categories, _coerce: coerce, _aoc4ToOffline: aoc4ToOffline, _ruleProposals: ruleProposals,
  };
})(typeof window !== 'undefined' ? window : globalThis);
