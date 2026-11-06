let currentData = null;    // flat {KEY: value}
let currentClient = null;  // meta
let clientsIndex = null;
let clientLoadInProgress = false;
let fillInProgress = false;
// The UI lives in the browser side panel, which stays open while the user works on the MCA page,
// so a fill runs right here. The MCA tab is looked up when a run starts and then kept for the whole
// run (windowMode makes getActiveMcaTab() stick to RUN.tabId even if the user switches tabs).
const RUN = { windowMode: true, tabId: null };

// The form currently chosen in the Form dropdown (kept in sync via "germin8:formchange").
let activeForm = 'aoc4';
// Data textarea of each simplified (non-AOC-4) form; the Client dropdown fills these.
const FORM_TEXTAREA = {
  aoc4_offline: 'aoc4OffFormData',
  spice_a: 'spiceAFormData',
  inc32: 'inc32FormData',
  dir3: 'dir3FormData',
};
const FORM_LABEL = { aoc4: 'AOC-4', aoc4_offline: 'AOC-4 Offline', spice_a: 'SPICe+ Part A', inc32: 'INC-32', dir3: 'DIR-3 KYC' };

window.addEventListener('germin8:formchange', e => {
  activeForm = (e.detail && e.detail.form) || 'aoc4';
  rebuildClientSelect();
});

// The data card's inline editor saved new values: keep this form's data box (and, for AOC-4, the
// values the next fill will use) in step with them.
window.addEventListener('germin8:datachange', e => {
  const { form, data } = e.detail || {};
  if (!form || !data) return;
  const box = document.getElementById(FORM_TEXTAREA[form]);
  if (box) box.value = JSON.stringify(data, null, 2);
  if (form === 'aoc4') {
    currentData = data;
    if (document.getElementById('tab-preview').classList.contains('active')) displayFieldList(currentData);
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  // Wire up the shared UI first so toasts/timeline/error-panel are ready before anything fires.
  await initChrome();

  bindTabs();
  bindMain();
  bindPdf();
  bindMultiFormWorkflows();
  bindMcaStatus();
  const ps = document.getElementById('phaseSelect');
  for (const p of PHASES) ps.add(new Option(p.label, p.id));
  ps.addEventListener('change', () => { if (currentData) displayFieldList(currentData); });
  await loadClientsIndex();
});

async function initChrome() {
  try {
    if (window.Toasts) { /* ready */ }
    if (window.ErrorPanel && typeof window.ErrorPanel.bind === 'function') window.ErrorPanel.bind();
    if (window.DataCard && typeof window.DataCard.bind === 'function') window.DataCard.bind();
    if (window.FieldExtractor) window.FieldExtractor.bind();
    if (window.RunStatus && window.OfflineEngine) window.RunStatus.bind();
    if (window.ErrorHandler && typeof window.ErrorHandler.installPopupListeners === 'function') {
      window.ErrorHandler.installPopupListeners();
    }
    if (window.FormPicker && typeof window.FormPicker.init === 'function') activeForm = await window.FormPicker.init();
  } catch (err) {
    console.error('UI init failed', err);
  }
}

// Header chip: is an MCA page open? Updates as the user switches tabs or navigates.
function bindMcaStatus() {
  const chip = document.getElementById('mcaChip');
  const text = document.getElementById('mcaChipText');
  if (!chip || !text) return;
  const MCA = /mca\.gov\.in/;
  const MCA_PATTERNS = ['https://www.mca.gov.in/*', 'https://*.mca.gov.in/*'];
  const set = (state, label) => { chip.dataset.state = state; text.textContent = label; };
  const refresh = async () => {
    try {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (active && active.url && MCA.test(active.url)) return set('on', 'MCA page open');
      const any = await chrome.tabs.query({ url: MCA_PATTERNS });
      set(any.length ? 'other' : 'off', any.length ? 'MCA in another tab' : 'No MCA tab');
    } catch (_) { set('off', 'No MCA tab'); }
  };
  refresh();
  const t = chrome.tabs;
  if (t.onActivated) t.onActivated.addListener(refresh);
  if (t.onRemoved) t.onRemoved.addListener(refresh);
  if (t.onUpdated) t.onUpdated.addListener((_id, info) => { if (info.status === 'complete' || info.url) refresh(); });
  if (chrome.windows && chrome.windows.onFocusChanged) chrome.windows.onFocusChanged.addListener(refresh);
}

// Starts the fill. Forgetting the previous run's tab makes getActiveMcaTab() pick the MCA tab the
// user is on now; it then stays fixed for the duration of this run.
async function startRun() {
  RUN.tabId = null;
  return doFill();
}

function bindTabs() {
  // Only the AOC-4 workflow uses the tabbed Client/PDF/Preview rail.
  document.querySelectorAll('#aoc4Workflow .tab').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
}
function switchTab(name) {
  const scope = document.getElementById('aoc4Workflow');
  if (!scope) return;
  scope.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  scope.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
  if (name === 'preview' && currentData) displayFieldList(currentData);
}

/* ---------- Clients ---------- */
let importedClients = {};
async function loadClientsIndex() {
  try {
    const url = chrome.runtime.getURL('clients/index.json');
    const res = await fetch(url);
    clientsIndex = await res.json();
    // "Germin8 Advisors / Jain S A K & Co." is too long for the header line: show the first name only.
    if (clientsIndex.firm) document.getElementById('ctxFirm').textContent = clientsIndex.firm.split(' / ')[0];
    importedClients = (await Storage.get('importedClients')) || {};
    rebuildClientSelect();
  } catch (e) {
    showMessage('error', `Clients index load failed: ${e.message}`);
  }
}

// An imported entry belongs to one form. Legacy AOC-4 client files carry no formType.
const entryForm = entry => (entry && entry.formType) || 'aoc4';

// Bundled clients (clients/index.json) belong to one form; entries without a formType are AOC-4.
const bundledFor = form => (clientsIndex?.clients || []).filter(c => entryForm(c) === form);

// Lists the clients that can be used with the form chosen in the Form dropdown: the bundled ones
// for that form, plus what was imported or sent from the dashboard for it.
function rebuildClientSelect(selectedId) {
  const sel = document.getElementById('clientSelect');
  const isAoc4 = activeForm === 'aoc4';
  const bundledList = bundledFor(activeForm);
  sel.innerHTML = '';
  sel.add(new Option(isAoc4 || bundledList.length ? '— choose a client —' : '— enter data manually —', ''));
  if (bundledList.length) {
    const bundled = document.createElement('optgroup');
    bundled.label = 'Bundled';
    for (const c of bundledList) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = String(c.name).includes(c.fy) ? c.name : `${c.name} — FY ${c.fy}`;
      bundled.appendChild(opt);
    }
    if (bundled.children.length) sel.appendChild(bundled);
  }
  const ids = Object.keys(importedClients).filter(id => entryForm(importedClients[id]) === activeForm);
  if (ids.length) {
    const grp = document.createElement('optgroup');
    grp.label = 'Imported from dashboard';
    for (const id of ids) {
      const opt = document.createElement('option');
      opt.value = id;
      // Imported entries can now be either the legacy raw client JSON or the
      // new {clientInfo, formType, formData} envelope.
      const entry = importedClients[id];
      const name = entry?.clientInfo?.name || entry?.displayName || id;
      opt.textContent = name;
      grp.appendChild(opt);
    }
    sel.appendChild(grp);
  }
  if (selectedId) sel.value = selectedId;
  toggleRemoveBtn();
}

function clientMeta(id) {
  const bundled = (clientsIndex?.clients || []).find(c => c.id === id);
  if (bundled) return bundled;
  if (importedClients[id]) {
    const entry = importedClients[id];
    const name = entry?.clientInfo?.name || entry?.displayName || id;
    return { id, name, imported: true };
  }
  return null;
}

function toggleRemoveBtn() {
  const id = document.getElementById('clientSelect').value;
  document.getElementById('removeClientBtn').classList.toggle('hidden', !importedClients[id]);
}

function bindMain() {
  document.getElementById('loadBtn').addEventListener('click', () => onLoadClient(true));
  document.getElementById('clientSelect').addEventListener('change', () => {
    toggleRemoveBtn();
    const id = document.getElementById('clientSelect').value;
    if (activeForm !== 'aoc4') return loadFormClient(activeForm, id);
    if (!id || fillInProgress) return;
    document.getElementById('phaseSelect').value = '1';
    onLoadClient(false);
  });
  document.getElementById('fillBtn').addEventListener('click', onFill);
  document.getElementById('confirmBtn').addEventListener('click', startRun);
  document.getElementById('cancelBtn').addEventListener('click', () => switchTab('main'));

  document.getElementById('importClientBtn').addEventListener('click', () => document.getElementById('importClientInput').click());
  document.getElementById('importClientInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      if (activeForm !== 'aoc4') return await importFormClient(activeForm, json, file.name);
      if (!json?.general?.CIN) throw new Error('this is not an AOC-4 client JSON (no general.CIN)');
      const id = String(json.clientId || file.name.replace(/\.json$/i, '')).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      importedClients[id] = json;
      await Storage.save('importedClients', importedClients);
      // Also publish a normalized clientInfo so the data card can light up.
      try {
        await chrome.storage.local.set({ clientInfo: {
          id, name: json.displayName || id, cin: json.general.CIN,
          fy: { from: json.general.FY_FROM, to: json.general.FY_TO },
          source: 'imported',
        }});
        if (window.DataCard) window.DataCard.render('aoc4');
      } catch (_) {}
      await Storage.saveLogs({ action: 'importClient', id, file: file.name, keys: Object.keys(json).length });
      rebuildClientSelect(id);
      document.getElementById('phaseSelect').value = '1';
      showMessage('success', `Imported ${json.displayName || id}. Open the AOC-4 form on MCA, then click Load & Fill All Phases.`, 12000);
      if (window.Toasts) window.Toasts.success({ title: 'Client imported', body: json.displayName || id });
    } catch (err) {
      showMessage('error', `Import failed: ${err.message}`, 12000);
      if (window.Toasts) window.Toasts.error({ title: 'Import failed', body: err.message });
    }
  });
  document.getElementById('removeClientBtn').addEventListener('click', async () => {
    const id = document.getElementById('clientSelect').value;
    if (!importedClients[id]) return;
    delete importedClients[id];
    await Storage.save('importedClients', importedClients);
    rebuildClientSelect();
    showMessage('info', 'Imported client removed.');
    if (window.Toasts) window.Toasts.info({ title: 'Imported client removed' });
  });
}

// Non-AOC-4 forms: put the chosen client's saved data into that form's data box and the data card.
async function loadFormClient(formType, id) {
  if (!id) return;
  let entry = importedClients[id];
  const bundledMeta = !entry && bundledFor(formType).find(c => c.id === id);
  try {
    if (bundledMeta) {
      const res = await fetch(chrome.runtime.getURL(bundledMeta.file));
      entry = await res.json();
      entry.clientInfo = Object.assign({}, entry.clientInfo, { source: 'bundled' });
    }
    if (!entry || !entry.formData) return;
    const box = document.getElementById(FORM_TEXTAREA[formType]);
    if (box) box.value = JSON.stringify(entry.formData, null, 2);
    await chrome.storage.local.set({
      ['mcaFormData_' + formType]: entry.formData,
      clientInfo: Object.assign({ source: 'imported' }, entry.clientInfo || {}),
    });
    if (window.DataCard) window.DataCard.render(formType);
    if (window.Toasts) window.Toasts.success({ title: 'Client data loaded', body: (entry.clientInfo && entry.clientInfo.name) || id });
  } catch (err) {
    if (window.ErrorHandler) window.ErrorHandler.handle(err, { source: 'loadFormClient' });
    else if (window.Toasts) window.Toasts.error({ title: 'Could not load client', body: err.message });
  }
}

// Non-AOC-4 forms: Import JSON takes a flat {field: value} file and files it under that form.
async function importFormClient(formType, json, fileName) {
  // A file exported by the Germin8 dashboard wraps the values: { formType, clientInfo, formData }.
  let info = null;
  if (json && json.formData && typeof json.formData === 'object' && !Array.isArray(json.formData)) {
    info = json.clientInfo || null;
    json = json.formData;
  }
  if (!json || typeof json !== 'object' || Array.isArray(json) || !Object.keys(json).length) {
    throw new Error('expected a JSON object with the ' + FORM_LABEL[formType] + ' field values');
  }
  const name = (info && info.name) || json.displayName || json.name || json.companyName || json.proposedName1 || fileName.replace(/\.json$/i, '');
  const id = String((info && info.id) || json.clientId || fileName.replace(/\.json$/i, '')).toLowerCase().replace(/[^a-z0-9_]/g, '_');
  importedClients[id] = {
    clientInfo: Object.assign({ id, name, cin: json.cin || json.CIN || null, din: json.din || null, source: 'imported' }, info || {}),
    formType, formData: json, importedAt: Date.now(),
  };
  await Storage.save('importedClients', importedClients);
  rebuildClientSelect(id);
  await loadFormClient(formType, id);
}

async function onLoadClient(fillAfter = true, startPhase = 1) {
  if (clientLoadInProgress || fillInProgress) return;
  const id = document.getElementById('clientSelect').value;
  if (!id) return showMessage('error', 'Pick a client.');
  const meta = clientMeta(id);
  if (!meta) return showMessage('error', 'Client not found.');

  clientLoadInProgress = true;
  const loadBtn = document.getElementById('loadBtn');
  loadBtn.disabled = true;
  try {
    let client;
    if (meta.imported) {
      // Imported entries can be either the raw client JSON (legacy) or the
      // new {clientInfo, formType, formData} envelope — unwrap transparently.
      const entry = importedClients[id];
      client = entry && entry.formData ? entry.formData : entry;
    } else {
      const res = await fetch(chrome.runtime.getURL(meta.file));
      client = await res.json();
    }
    currentClient = client;
    currentData = flattenClient(client);
    await Storage.save('lastClient', { id: meta.id, data: currentData });
    await Storage.saveLogs({ action: 'loadClient', id: meta.id, keys: Object.keys(currentData).length });

    // Publish the loaded client for the data card.
    try {
      await chrome.storage.local.set({
        clientInfo: {
          id: meta.id,
          name: client.displayName || meta.name,
          cin: client.general?.CIN || currentData.CIN,
          fy: { from: client.general?.FY_FROM, to: client.general?.FY_TO },
          source: meta.imported ? 'imported' : 'bundled',
        },
        mcaFormData_aoc4: currentData,
      });
      if (window.DataCard) window.DataCard.render('aoc4');
    } catch (_) {}

    document.getElementById('fillBtn').disabled = false;
    document.getElementById('phaseSelect').value = String(startPhase);
    switchTab('preview');
    if (!fillAfter) {
      showMessage('success', `Loaded ${Object.keys(currentData).length} values. Open the AOC-4 form on MCA, then click Load & Fill All Phases.`, 10000);
      return;
    }
    if (document.getElementById('showPreview').checked) {
      showMessage('success', `Loaded ${Object.keys(currentData).length} values. Review them, then click Confirm & Fill to start all phases.`);
      return;
    }
    showMessage('success', `Loaded ${Object.keys(currentData).length} values. Starting automatic fill from Phase ${startPhase}…`, 12000);
    await startRun();
  } catch (e) {
    showMessage('error', `Load failed: ${e.message}`);
    if (window.ErrorHandler) window.ErrorHandler.handle(e, { source: 'loadClient' });
  } finally {
    clientLoadInProgress = false;
    loadBtn.disabled = false;
  }
}

async function onFill() {
  if (!currentData) {
    const last = await Storage.get('lastClient');
    if (last) currentData = last.data;
  }
  if (!currentData) return showMessage('error', 'Load a client first.');

  if (document.getElementById('showPreview').checked) {
    switchTab('preview');
    displayFieldList(currentData);
    return;
  }
  await startRun();
}

async function ensureInjected(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    if (res && res.pong) return;
  } catch (_) { /* fall through and inject */ }
  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world: 'ISOLATED',
    files: [
      'js/field-maps/_shared.js',
      'js/field-maps/aoc4.js',
      'js/field-maps/aoc4-offline.js',
      'js/field-maps/spice-a.js',
      'js/field-maps/inc32.js',
      'js/field-maps/dir3.js',
      'js/forms-registry.js',
      'js/filler.js',
      'content_script.js',
    ],
  });
  await new Promise(r => setTimeout(r, 150));
}

/* ---------- PDF (ad-hoc) ---------- */
function bindPdf() {
  document.getElementById('extractBtn').addEventListener('click', async () => {
    const f = document.getElementById('pdfInput').files[0];
    if (!f) return showMessage('error', 'Pick a PDF first.');
    try {
      const raw = await PDFExtractor.extractText(f);
      document.getElementById('pdfRaw').textContent = raw.slice(0, 50000);
      showMessage('success', `Extracted ${raw.length} chars.`);
      await Storage.saveLogs({ action: 'pdfExtract', chars: raw.length });
    } catch (e) {
      showMessage('error', `Extract failed: ${e.message}`);
    }
  });
}

/* ---------- Multi-form workflows (AOC-4 Offline / SPICe+ A / INC-32 / DIR-3) ---------- */
function bindMultiFormWorkflows() {
  const wire = (fillId, scanId, textareaId, formType, friendly) => {
    const fillBtn = document.getElementById(fillId);
    const scanBtn = document.getElementById(scanId);
    const ta = document.getElementById(textareaId);
    if (!fillBtn || !ta) return;

    // Seed the textarea from existing stored form data when the user picks that pill.
    chrome.storage.local.get(['mcaFormData_' + formType], res => {
      const stored = res && res['mcaFormData_' + formType];
      if (stored && Object.keys(stored).length) ta.value = JSON.stringify(stored, null, 2);
    });

    fillBtn.addEventListener('click', async () => {
      await runMultiFormFill(formType, friendly, ta);
    });
    if (scanBtn) scanBtn.addEventListener('click', async () => {
      await runMultiFormScan(formType, friendly);
    });
  };

  wire('aoc4OffFillBtn', 'aoc4OffScanBtn', 'aoc4OffFormData', 'aoc4_offline', 'AOC-4 Offline');
  wire('spiceAFillBtn',   'spiceAScanBtn',   'spiceAFormData',   'spice_a',      'SPICe+ Part A');
  wire('inc32FillBtn',    'inc32ScanBtn',    'inc32FormData',    'inc32',        'INC-32');
  wire('dir3FillBtn',     'dir3ScanBtn',     'dir3FormData',     'dir3',         'DIR-3 KYC');
}

async function runMultiFormFill(formType, friendly, textarea) {
  let data;
  try {
    const raw = (textarea.value || '').trim();
    data = raw ? JSON.parse(raw) : {};
  } catch (err) {
    if (window.Toasts) window.Toasts.error({ title: 'Invalid JSON', body: err.message });
    return;
  }
  if (!data || !Object.keys(data).length) {
    if (window.Toasts) window.Toasts.warning({ title: 'No data entered', body: 'Paste form JSON before clicking Fill.' });
    return;
  }
  // AOC-4 Offline has its own filler for the offline eForm (js/offline-engine.js).
  if (formType === 'aoc4_offline') return runOfflineFill(data);
  RUN.tabId = null;
  const tab = await getActiveMcaTab();
  if (!tab) {
    if (window.Toasts) window.Toasts.error({ title: 'No MCA tab', body: 'Open the ' + friendly + ' form on mca.gov.in first.' });
    return;
  }
  try {
    await chrome.storage.local.set({ ['mcaFormData_' + formType]: data, currentForm: formType });
    if (window.DataCard) window.DataCard.render(formType);
    if (window.Timeline) {
      window.Timeline.render(formType);
      window.Timeline.setActive('prepare', 'Flattened ' + Object.keys(data).length + ' keys');
      setTimeout(() => window.Timeline.setDone('prepare', 'Flattened ' + Object.keys(data).length + ' keys'), 200);
      window.Timeline.setActive('open', 'Reaching ' + friendly + ' tab');
    }
    await ensureInjected(tab.id);
    if (window.Timeline) window.Timeline.setDone('open', 'Tab ready at ' + (tab.url || 'MCA'));
    const phases = (window.FORMS && window.FORMS[formType] && window.FORMS[formType].phases) || [];
    const workSteps = phases.filter(p => p.id !== 'prepare' && p.id !== 'open' && p.id !== 'complete');
    for (const step of workSteps) {
      if (window.Timeline) window.Timeline.setActive(step.id, 'Writing fields');
    }
    const result = await chrome.tabs.sendMessage(tab.id, {
      action: 'fill', formType, formData: data,
    });
    const summary = (result && result.summary) || { filled: 0, skipped: 0, invalid: 0, needsReview: 0 };
    if (window.Timeline) {
      for (const step of workSteps) window.Timeline.setDone(step.id, 'Filled');
      window.Timeline.setActive('complete', summary.filled + ' filled, ' + (summary.invalid + summary.empty) + ' missed');
      window.Timeline.setDone('complete', summary.filled + ' filled, ' + (summary.invalid + summary.empty || 0) + ' missed');
    }
    const msg = summary.filled + ' filled, ' + (summary.needsReview || 0) + ' need review, ' + (summary.invalid || 0) + ' failed';
    if (window.Toasts) {
      if (!summary.filled) window.Toasts.error({ title: 'Nothing was filled on this page', body: 'None of the ' + friendly + ' fields were found. Open the form page itself, then use Check fields.' });
      else if (result && result.ok) window.Toasts.success({ title: friendly + ' fill complete', body: msg });
      else window.Toasts.warning({ title: friendly + ' fill finished with issues', body: msg });
    }
    await Storage.saveLogs({ action: 'fill', formType, summary });
  } catch (err) {
    if (window.ErrorHandler) window.ErrorHandler.handle(err, { stepId: 'open', source: 'multiFormFill' });
    else if (window.Toasts) window.Toasts.error({ title: 'Fill failed', body: err.message });
  }
}

// AOC-4 Offline has its own filler (js/offline-engine.js): the offline eForm is a different page from
// the online AOC-4 form. It waits for MCA's CIN lookup, so a run takes a minute or so.
let offlineBusy = false;
const OFFLINE_TAG = { filled: ['ok', 'filled'], already: ['ok', 'already set'], found: ['ok', 'found'], failed: ['bad', 'failed'], disabled: ['bad', 'disabled'], missing: ['warn', 'not on page'], skipped: ['', 'skipped'], unmapped: ['warn', 'no map yet'] };
function renderOfflineResults(out, target) {
  const ul = target || document.getElementById('offResult');
  if (!ul) return;
  const order = { failed: 0, disabled: 0, missing: 1, unmapped: 2, filled: 3, already: 3, found: 3, skipped: 4 };
  const rows = out.results.slice().sort((a, b) => order[a.status] - order[b.status]);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  ul.innerHTML = rows.map(r => {
    const [cls, text] = OFFLINE_TAG[r.status] || ['', r.status];
    return '<li><div class="ex-main"><span class="ex-label">' + esc(r.label) + '</span>' +
      (r.reason ? '<span class="ex-sub">' + esc(r.reason) + '</span>' : '') + '</div><span class="ex-tags"><em class="' + cls + '">' + text + '</em></span></li>';
  }).join('');
}

async function runOfflineFill(data) {
  if (offlineBusy) return;
  if (window.RunStatus && window.RunStatus.isRunning()) {
    if (window.Toasts) window.Toasts.info({ title: 'A fill is already running', body: 'See Run status above, or press Stop first.' });
    return;
  }
  RUN.tabId = null;
  const tab = await getActiveMcaTab();
  if (!tab) {
    if (window.Toasts) window.Toasts.error({ title: 'No MCA tab', body: 'Open the AOC-4 Offline form on mca.gov.in first.' });
    return;
  }
  const btn = document.getElementById('aoc4OffFillBtn');
  offlineBusy = true; btn.disabled = true;
  try {
    await chrome.storage.local.set({ mcaFormData_aoc4_offline: data, currentForm: 'aoc4_offline' });
    if (window.DataCard) window.DataCard.render('aoc4_offline');
    if (window.Toasts) window.Toasts.info({ title: 'Filling AOC-4 Offline…', body: 'Keep the MCA tab open. MCA looks up the CIN first, so this takes a minute.' });
    const out = await window.OfflineEngine.run(tab.id, data, 'fill');
    const s = out.summary;
    await Storage.saveLogs({ action: 'fill', formType: 'aoc4_offline', summary: s, fatal: out.fatal || null });
    if (window.Toasts) {
      if (out.fatal) {
        window.Toasts.error({ title: 'AOC-4 Offline fill stopped', body: out.fatal + (s.filled + s.already ? ' ' + s.filled + ' filled and ' + s.already + ' already set before it stopped.' : '') });
        return;
      }
      if (out.stopped) { window.Toasts.warning({ title: 'AOC-4 Offline fill stopped', body: s.filled + ' filled, ' + s.already + ' already set before you pressed Stop.' }); return; }
      const body = [s.filled && s.filled + ' filled', s.already && s.already + ' already set', s.failed && s.failed + ' failed', s.missing && s.missing + ' not on the page', s.unmapped && s.unmapped + ' without a field map yet'].filter(Boolean).join(', ');
      if (!s.filled && !s.already) window.Toasts.error({ title: 'Nothing was filled', body: body + '. See the list below.' });
      else if (s.failed || s.missing) window.Toasts.warning({ title: 'AOC-4 Offline filled with issues', body: body + '. Click Fill again to retry only those.' });
      else window.Toasts.success({ title: 'AOC-4 Offline filled and checked', body });
    }
  } catch (err) {
    if (window.ErrorHandler) window.ErrorHandler.handle(err, { source: 'offlineFill' });
    else if (window.Toasts) window.Toasts.error({ title: 'Fill failed', body: err.message });
  } finally {
    offlineBusy = false; btn.disabled = false;
  }
}

async function runMultiFormScan(formType, friendly) {
  if (formType === 'aoc4_offline') {
    RUN.tabId = null;
    const tab = await getActiveMcaTab();
    if (!tab) {
      if (window.Toasts) window.Toasts.error({ title: 'No MCA tab', body: 'Open the AOC-4 Offline form on mca.gov.in first.' });
      return;
    }
    try {
      const out = await window.OfflineEngine.run(tab.id, {}, 'check');
      renderOfflineResults(out);
      if (window.Toasts) window.Toasts.info({ title: out.summary.found + ' / ' + out.summary.total + ' fields found on this page', body: 'Some fields only appear after the CIN is filled in.' });
    } catch (err) {
      if (window.ErrorHandler) window.ErrorHandler.handle(err, { source: 'offlineCheck' });
    }
    return;
  }
  RUN.tabId = null;
  const tab = await getActiveMcaTab();
  if (!tab) {
    if (window.Toasts) window.Toasts.error({ title: 'No MCA tab', body: 'Open the ' + friendly + ' form on mca.gov.in first.' });
    return;
  }
  try {
    await ensureInjected(tab.id);
    const result = await chrome.tabs.sendMessage(tab.id, { action: 'scan', formType });
    const hits = result && result.totalFound;
    const total = result && result.totalExpected;
    if (window.Toasts) window.Toasts.info({ title: friendly + ' scan', body: hits + ' / ' + total + ' fields located on this page' });
    await Storage.saveLogs({ action: 'scan', formType, hits, total });
  } catch (err) {
    if (window.ErrorHandler) window.ErrorHandler.handle(err, { source: 'multiFormScan' });
  }
}

/* ---------- Helpers ---------- */
function showMessage(type, text, ms = 6000) {
  const el = document.getElementById('message');
  if (el) {
    el.className = `msg ${type}`;
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(showMessage._t);
    showMessage._t = setTimeout(() => el.classList.add('hidden'), ms);
  }
  // The banner above only exists inside the AOC-4 workflow. When it isn't on screen (another
  // form is selected), use the header notice instead so the message is not lost.
  try {
    const bannerVisible = el && el.offsetParent !== null;
    if (window.Toasts && !bannerVisible) {
      const level = type === 'success' ? 'success' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info';
      window.Toasts[level]({ title: text });
    }
  } catch (_) {}
}

function updateProgress(cur, total) {
  const pct = total ? Math.round((cur / total) * 100) : 0;
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');
  if (fill) fill.style.width = pct + '%';
  if (text) text.textContent = `${cur} / ${total}`;
}
function displayFieldList(data) {
  const ul = document.getElementById('fieldList');
  if (!ul) return;
  ul.innerHTML = '';
  const phase = currentPhase();
  document.getElementById('previewTitle').textContent = phase.label;
  const fields = phaseFields(phase.id);
  for (const m of fields) {
    const v = data[m.key];
    const optionalSkipped = m.optionalGroup && !hasOptionalGroupData(data, m.optionalGroup);
    const invalidIdentifier = !optionalSkipped && isZeroIdentifier(m, v);
    const has = !optionalSkipped && !invalidIdentifier && v !== undefined && v !== null && v !== '';
    const status = invalidIdentifier ? 'invalid · blocked' : has ? (m.onlyIfEmpty ? 'if empty' : 'fill') : 'skip';
    const cls = invalidIdentifier ? 'empty' : has ? (m.onlyIfEmpty ? 'skipped' : 'filled') : 'empty';
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="fname">${escape(m.label || m.key)}</span>
      <span class="fval" title="${escape(optionalSkipped || v == null ? '' : v)}">${invalidIdentifier ? '0 — blocked (invalid identifier)' : has ? escape(v) : '—'}</span>
      <span class="fstat ${cls}">${status}</span>`;
    ul.appendChild(li);
  }
}
function escape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
