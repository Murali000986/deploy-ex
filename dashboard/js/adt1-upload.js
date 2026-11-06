/* ═══════════════════════════════════════════════════════════════════
   ADT-1 "Upload & AI" step (browser half). Loaded AFTER js/adt1-form.js and js/adt1-extractor.js, BEFORE
   js/dashboard.js. Everything here runs at CALL time, so it may use dashboard.js globals ($, $$, esc, toast,
   settings, aiKeyPresent, callAiJson, fileKind, loadScript, LIBS, showPanel) and adt1-form.js globals
   (adt1State, ADT1_FIELD_LIST, ADT1_FIELD_BY_KEY, ADT1_SECTIONS, renderAdt1, saveAdt1Draft, validateAdt1).

   Speed design:
     - files are read as soon as they are dropped, several at once (bounded pool), one pdf.js worker shared,
       all pages of a PDF in parallel, empty pages skipped, text cached by name+size+lastModified;
     - "Extract values" shows the RULES result at once (a few ms); the AI call (one request for all documents,
       timeout, cancellable) runs in the background and is merged in when it arrives;
     - scanned PDFs / images are NOT sent to the AI unless the user ticks the box.
   ═══════════════════════════════════════════════════════════════════ */

const ADT1_UP_POOL = 4;               // files read at the same time
const ADT1_UP_MAX_PAGES = 40;         // an ADT-1 document is a few pages; stop reading a huge file
const ADT1_UP_AI_TIMEOUT = { default: 30000, gateway: 60000 };

const adt1Up = {
  items: [],            // { id, file, key, status:'reading'|'ok'|'scanned'|'error', text, docType, ms, pages, kind, mime, error, json, cached }
  cache: new Map(),     // name|size|lastModified -> finished item fields (text is never read twice)
  seq: 0,
  rules: [],            // proposals from the rules (all files, merged)
  ai: [],               // proposals from the AI
  merged: [],           // rules + AI merged
  rows: [],             // one per dataKey: { key, list:[proposal...], value, accept }
  edits: new Map(),     // key -> { value, accept }: what the user changed, kept across re-renders
  aiCtl: null, aiRun: 0, extracting: false, filter: 'all',
  timing: {}
};
const adt1UpNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const adt1UpKey = f => `${f.name}|${f.size}|${f.lastModified || 0}`;
// The only file types this step can read. Anything else (an old .doc, .rtf, a spreadsheet, ...) is refused with a plain message
// instead of being read as text and reported as "ok".
const ADT1_UP_TYPES = { pdf: 'pdf', docx: 'docx', txt: 'text', json: 'json', png: 'image', jpg: 'image', jpeg: 'image' };
const adt1UpExt = name => String(name || '').split('.').pop().toLowerCase();
const ADT1_UP_TYPE_MSG = 'this file type cannot be read. Save it as PDF or Word (.docx) and add it again.';
function adt1UpPdfError(e) {
  const m = String((e && (e.message || e.name)) || '');
  if (/pdf\.js is missing/.test(m)) return m;
  if (/password/i.test(m)) return 'This PDF is password-protected. Remove the password (for example by printing it to a new PDF) and add it again.';
  if (/invalid|corrupt|xref|structure|unexpected|format|missing|header/i.test(m) || (e && e.name === 'InvalidPDFException')) return 'This PDF looks damaged or is not really a PDF. Open it in a PDF reader, save a fresh copy and add that.';
  return `This PDF could not be read${m ? ` (${m})` : ''}. Save a fresh copy of it and try again.`;
}

/* ───────────── reading files ───────────── */
// A small pool of long-lived pdf.js workers (created once, reused for every file). Measured: workers cost ~0.4 s to boot, so they are
// started as soon as the Upload & AI panel is shown (while the user picks files) and warmed with a tiny PDF.
const ADT1_UP_WORKERS = 3;
const ADT1_WARM_PDF = ['%PDF-1.1', '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj', '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj', '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj', 'trailer<</Root 1 0 R>>', ''].join('\n');
function adt1UpWorker(i) {
  if (!window.pdfjsLib) return null;
  if (!adt1Up.workers) { adt1Up.workers = []; adt1Up.workersWarm = false; }
  const k = i % ADT1_UP_WORKERS;
  if (!adt1Up.workers[k]) { try { adt1Up.workers[k] = new pdfjsLib.PDFWorker({ name: 'adt1-' + k }); } catch (_) { adt1Up.workers[k] = null; } }
  return adt1Up.workers[k];
}
function adt1UpPrewarm() {
  if (adt1Up.workersWarm || !window.pdfjsLib) return;
  adt1Up.workersWarm = true;
  for (let k = 0; k < ADT1_UP_WORKERS; k++) {
    const w = adt1UpWorker(k); if (!w) continue;
    const bytes = new TextEncoder().encode(ADT1_WARM_PDF);
    pdfjsLib.getDocument({ data: bytes, worker: w, disableFontFace: true }).promise
      .then(pdf => pdf.getPage(1)).then(p => p.getTextContent()).catch(() => { /* warming is best effort */ });
  }
}

async function adt1UpReadPdf(file, slot) {
  if (!window.pdfjsLib) throw new Error('pdf.js is missing from libs/ (see README)');
  const data = new Uint8Array(await file.arrayBuffer());
  const params = { data, disableFontFace: true };   // text only: no need to build page fonts
  const w = adt1UpWorker(slot); if (w) params.worker = w;
  const pdf = await pdfjsLib.getDocument(params).promise;
  const n = Math.min(pdf.numPages, ADT1_UP_MAX_PAGES);
  // all pages at once: getPage/getTextContent run inside the worker, so this is real parallelism
  const pages = await Promise.all(Array.from({ length: n }, async (_, i) => {
    const page = await pdf.getPage(i + 1);
    const tc = await page.getTextContent();
    page.cleanup();
    return tc.items.map(it => it.str).join(' ');
  }));
  try { pdf.destroy(); } catch (_) { /* ignore */ }
  const text = pages.filter(t => t.trim()).join('\n');   // empty pages skipped
  return { text, pages: pdf.numPages, truncated: pdf.numPages > n, scanned: text.replace(/\s/g, '').length < 25 * n };
}

async function adt1UpReadFile(file, slot) {
  const kind = ADT1_UP_TYPES[adt1UpExt(file.name)];
  if (!kind) throw new Error(ADT1_UP_TYPE_MSG);
  const out = { kind, mime: file.type || '', text: '', pages: 0, status: 'ok' };
  if (kind === 'pdf') {
    let r;
    try { r = await adt1UpReadPdf(file, slot); } catch (e) { throw new Error(adt1UpPdfError(e)); }
    Object.assign(out, r);
    if (r.scanned) out.status = 'scanned';
  } else if (kind === 'docx') {
    try { await loadScript(LIBS.jszip); } catch (_) { throw new Error('The Word reader could not be loaded (is the internet connection off?). Save the file as PDF and add that instead.'); }
    let zip;
    try { zip = await JSZip.loadAsync(await file.arrayBuffer()); } catch (_) { throw new Error('This Word file looks damaged, or it is not a real .docx file. Open it in Word and save it again as .docx, or save it as PDF.'); }
    const entry = zip.file('word/document.xml');
    if (!entry) throw new Error('This Word file has no document text inside it (it may be damaged, or an old .doc file renamed to .docx). Save it again from Word as .docx, or as PDF.');
    const xml = await entry.async('string');
    out.text = xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  } else if (kind === 'image') {
    out.status = 'scanned';
  } else {
    out.text = await file.text();
    if (kind === 'json') {
      try { const j = JSON.parse(out.text); adt1StateFromJson(j); out.json = j; } catch (_) { /* plain text file */ }
    }
  }
  out.docType = out.json ? 'adt1-json' : out.status === 'scanned' ? 'scanned' : ADT1Extract.detectDocType(out.text);
  return out;
}

async function adt1UpAddFiles(fileList) {
  const added = [];
  for (const f of Array.from(fileList || [])) {
    if (f.size > 25 * 1024 * 1024) { toast(`Too large: ${f.name} (25 MB limit)`, true); continue; }
    const key = adt1UpKey(f);
    if (adt1Up.items.some(i => i.key === key)) { toast(`${f.name} is already in the list`); continue; }
    const item = { id: ++adt1Up.seq, file: f, key, status: 'reading', text: '', docType: '', ms: 0, pages: 0 };
    if (!ADT1_UP_TYPES[adt1UpExt(f.name)]) {
      // refused up front: it stays in the list as "Could not read" so the user sees why, and is never read as text
      Object.assign(item, { status: 'error', error: ADT1_UP_TYPE_MSG.replace(/^this/, 'This'), docType: 'unknown', kind: 'other' });
      toast(`${f.name}: ${ADT1_UP_TYPE_MSG}`, true);
    }
    const hit = adt1Up.cache.get(key);
    if (hit) Object.assign(item, hit, { ms: 0, cached: true });
    adt1Up.items.push(item); added.push(item);
  }
  if (!added.length) return;
  adt1UpRenderFiles(); adt1UpSteps(1); adt1UpUpdateButtons();
  // bounded pool: several files at a time, each rendered the moment it is ready
  let next = 0;
  const worker = async () => {
    while (next < added.length) {
      const item = added[next++];
      if (item.status !== 'reading') continue;   // served from the cache
      const t0 = adt1UpNow();
      try {
        Object.assign(item, await adt1UpReadFile(item.file, item.id));
        item.ms = Math.round(adt1UpNow() - t0);
        adt1Up.cache.set(item.key, { status: item.status, text: item.text, docType: item.docType, pages: item.pages, kind: item.kind, mime: item.mime, json: item.json, truncated: item.truncated });
      } catch (e) { item.status = 'error'; item.error = e && e.message ? e.message : 'This file could not be read.'; item.docType = 'unknown'; item.ms = Math.round(adt1UpNow() - t0); }
      adt1Up.timing[item.file.name] = item.ms;
      adt1UpRenderFiles(); adt1UpUpdateButtons();
    }
  };
  await Promise.all(Array.from({ length: Math.min(ADT1_UP_POOL, added.length) }, worker));
  adt1UpRenderFiles(); adt1UpUpdateButtons();
}

function adt1UpSteps(n) { $$('#au1Steps .step').forEach(s => { const k = +s.dataset.step; s.classList.toggle('on', k === n); s.classList.toggle('done', k < n); }); }

function adt1UpRenderFiles() {
  const tag = d => (ADT1Extract.DOC_LABELS[d] || 'Other document');
  $('#au1Files').innerHTML = adt1Up.items.map(it => {
    const done = it.status !== 'reading';
    const bits = [];
    if (it.pages) bits.push(`${it.pages} page${it.pages > 1 ? 's' : ''}`);
    if (done && it.status === 'ok') bits.push(it.json ? 'a client file saved earlier' : `${it.text.length.toLocaleString()} characters read`);
    if (it.status === 'scanned') bits.push('no text layer: only the AI can read this, and only if you tick the scanned-pages box below');
    if (it.truncated) bits.push(`only the first ${ADT1_UP_MAX_PAGES} pages were read`);
    if (it.status === 'error') bits.push(it.error);
    if (done && it.kind !== 'other') bits.push(it.cached ? 'already read (kept)' : `read in ${it.ms} ms`);
    const chip = done ? `<span class="kind ${it.status === 'error' ? 'err' : ''}">${esc(it.status === 'error' ? 'Could not read' : tag(it.docType))}</span>` : '<span class="spin"></span>';
    return `<div class="file"><span class="fname"><svg class="ico" viewBox="0 0 24 24" style="vertical-align:-2px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>${esc(it.file.name)} <span class="muted">${(it.file.size / 1024).toFixed(0)} KB</span>${chip}</span><span class="meta">${done ? esc(bits.join(' · ')) : 'Reading…'}</span><span class="btn-row"><button class="btn sm" data-au1-rm="${it.id}">Remove</button></span></div>`;
  }).join('');
  $$('#au1Files [data-au1-rm]').forEach(b => b.addEventListener('click', () => {
    adt1Up.items = adt1Up.items.filter(i => i.id !== +b.dataset.au1Rm);
    adt1UpRenderFiles(); adt1UpUpdateButtons();
  }));
}

function adt1UpProviderLabel() {
  const p = settings.llmProvider;
  return { anthropic: 'Claude', openai: 'OpenAI', gemini: 'Gemini', gateway: 'Claude via Germin8 Gateway' }[p] || p;
}
function adt1UpUpdateButtons() {
  const usable = adt1Up.items.filter(i => i.status === 'ok');
  const scannedOnly = adt1Up.items.filter(i => i.status === 'scanned');
  const aiReady = aiKeyPresent();
  const useAi = $('#au1UseAi'), sc = $('#au1Scanned');
  useAi.disabled = !aiReady;
  if (!aiReady) useAi.checked = false; else if (!useAi.dataset.touched) useAi.checked = true;
  sc.disabled = !aiReady || !useAi.checked || !['anthropic', 'gateway'].includes(settings.llmProvider);
  if (sc.disabled) sc.checked = false;
  const wantsScans = sc.checked && scannedOnly.length;
  $('#au1Extract').disabled = adt1Up.extracting || (!usable.length && !wantsScans) || adt1Up.items.some(i => i.status === 'reading');
  $('#au1Provider').textContent = aiReady
    ? `AI: ${adt1UpProviderLabel()} · ${settings.llmProvider === 'gateway' ? 'token' : 'key'} saved. The rules answer first; the AI answer is added when it arrives.`
    : 'Rules only: add an AI API key (or the Gateway token) in Settings to also ask the AI model.';
}

/* ───────────── extraction ───────────── */
function adt1UpRunRules() {
  const t0 = adt1UpNow();
  const usable = adt1Up.items.filter(i => i.status === 'ok');
  // formCin: the company check compares every document's CIN with the one already in the form
  const res = ADT1Extract.extractAdt1(usable.map(i => (i.json ? { name: i.file.name, json: i.json } : { name: i.file.name, text: i.text, docType: i.docType })), { formCin: adt1State.cin });
  adt1Up.rules = res.proposals;
  adt1Up.docTypes = res.docTypes; adt1Up.ruleNotes = res.notes; adt1Up.company = res.company;
  adt1Up.timing.rulesMs = Math.round((adt1UpNow() - t0) * 10) / 10;
  return res;
}

async function adt1UpAskAi(run) {
  const docs = adt1Up.items.filter(i => i.status === 'ok' && !i.json).map(i => ({ name: i.file.name, text: i.text, docType: i.docType }));
  const attachments = [];
  const native = ['anthropic', 'gateway'].includes(settings.llmProvider);
  if ($('#au1Scanned').checked && native) {
    for (const it of adt1Up.items.filter(i => i.status === 'scanned')) {
      attachments.push({ name: it.file.name, kind: it.kind === 'pdf' ? 'pdf' : 'image', mime: it.mime, bytes: new Uint8Array(await it.file.arrayBuffer()) });
    }
  }
  if (!docs.length && !attachments.length) return { proposals: [], notes: [], skipped: 'There was no readable text to send to the AI.' };
  const user = ADT1Extract.aiUserText(docs) + (attachments.length ? `\n\nAttached files (read them too): ${attachments.map(a => a.name).join(', ')}` : '');
  adt1Up.aiCtl = new AbortController();
  const t0 = adt1UpNow();
  const timeoutMs = settings.llmProvider === 'gateway' ? ADT1_UP_AI_TIMEOUT.gateway : ADT1_UP_AI_TIMEOUT.default;
  const out = await callAiJson({ system: ADT1Extract.aiSystemPrompt(), user, schema: ADT1Extract.aiSchema(), attachments, maxTokens: 4000, timeoutMs, signal: adt1Up.aiCtl.signal });
  adt1Up.timing.aiMs = Math.round(adt1UpNow() - t0);
  const norm = ADT1Extract.normalizeAiOutput(out, docs);
  return { proposals: norm.proposals, notes: norm.notes, dropped: norm.dropped };
}

async function adt1UpExtract() {
  if (adt1Up.extracting) return;
  const t0 = adt1UpNow();
  const run = ++adt1Up.aiRun;
  if (adt1Up.aiCtl) { try { adt1Up.aiCtl.abort(); } catch (_) { /* ignore */ } }
  adt1Up.extracting = true; adt1Up.ai = []; adt1Up.edits.clear();
  adt1UpSteps(2); adt1UpUpdateButtons();
  $('#au1Result').innerHTML = ''; $('#au1Notes').innerHTML = '';
  const wantAi = $('#au1UseAi').checked && aiKeyPresent();
  // 1. start the AI in the background FIRST (its first step is synchronous and cheap), 2. run the rules, 3. show them.
  const aiPromise = wantAi ? adt1UpAskAi(run).catch(e => ({ error: e })) : null;
  const res = adt1UpRunRules();
  adt1Up.merged = adt1Up.rules.slice();
  adt1UpBuildRows(); adt1UpRenderReview();
  adt1Up.timing.firstResultMs = Math.round((adt1UpNow() - t0) * 10) / 10;
  adt1Up.extracting = false; adt1UpUpdateButtons();
  adt1UpSteps(3);
  const scannedPending = adt1Up.items.filter(i => i.status === 'scanned');
  const notes = (res.notes || []).filter(n => !/tick boxes/.test(n.text) || adt1Up.items.some(i => i.docType === 'filed-adt1')).map(n => `<div class="note warn">${n.file ? `<b>${esc(n.file)}</b>: ` : ''}${esc(n.text)}</div>`);
  if (res.company && !res.company.ok) notes.unshift(adt1UpCompanyHtml(res.company));
  if (scannedPending.length && !(wantAi && $('#au1Scanned').checked)) notes.push(`<div class="note warn">${scannedPending.map(i => esc(i.file.name)).join(', ')} ${scannedPending.length > 1 ? 'have' : 'has'} no text layer (scanned), so the rules could not read ${scannedPending.length > 1 ? 'them' : 'it'}. Tick “Also read scanned pages and images with the AI” to try (slower), or type the values in Data Entry.</div>`);
  if (!wantAi) notes.push(`<div class="note">${aiKeyPresent() ? 'AI is switched off for this run: rules only.' : 'Rules only: no AI key is saved. Add one in Settings to let the AI double-check the documents.'}</div>`);
  $('#au1Notes').innerHTML = notes.join('');
  $('#au1Status').textContent = `${adt1Up.rows.length} value${adt1Up.rows.length === 1 ? '' : 's'} found by the rules in ${adt1Up.timing.rulesMs} ms`;
  if (!aiPromise) return;
  adt1UpSetAiBanner(`<span class="spin"></span> Asking ${esc(adt1UpProviderLabel())}… the rule results above are already usable. <button class="btn sm" id="au1AiCancel" type="button">Skip the AI</button>`);
  const cancel = $('#au1AiCancel'); if (cancel) cancel.addEventListener('click', () => { if (adt1Up.aiCtl) adt1Up.aiCtl.abort(); });
  const r = await aiPromise;
  if (run !== adt1Up.aiRun) return;   // a newer extraction started
  adt1Up.aiCtl = null;
  if (r.error) {
    const cancelled = /abort|cancel/i.test(r.error.message || '') && !/did not answer/i.test(r.error.message || '');
    adt1UpSetAiBanner(`<div class="note ${cancelled ? '' : 'err'}">${cancelled ? 'AI skipped.' : `AI step failed: ${esc(r.error.message)}.`} The values below come from the document rules only.</div>`);
    return;
  }
  if (r.skipped) { adt1UpSetAiBanner(`<div class="note">${esc(r.skipped)}</div>`); return; }
  adt1Up.ai = r.proposals;
  adt1Up.merged = ADT1Extract.mergeProposals(adt1Up.rules.concat(adt1Up.ai));
  adt1UpBuildRows(); adt1UpRenderReview();
  const agree = adt1Up.merged.filter(p => p.method === 'both').length, conflicts = new Set(adt1Up.merged.filter(p => p.conflict).map(p => p.key)).size;
  adt1UpSetAiBanner(`<div class="note ok">AI answer merged in ${adt1Up.timing.aiMs} ms: ${r.proposals.length} value${r.proposals.length === 1 ? '' : 's'}, ${agree} confirmed by both${conflicts ? `, ${conflicts} to decide` : ''}.${(r.dropped && r.dropped.length) ? ` ${r.dropped.length} AI answer${r.dropped.length === 1 ? ' was' : 's were'} ignored because ${r.dropped.length === 1 ? 'it was' : 'they were'} not valid or not found in the documents.` : ''}${r.notes && r.notes.length ? ' Model notes: ' + esc(r.notes.join(' · ')) : ''}</div>`);
}
function adt1UpSetAiBanner(html) { $('#au1AiBanner').innerHTML = html; }
const adt1UpCompanyHtml = c => `<div class="note err"><strong>Company check:</strong> ${esc(c.text)}</div>`;

/* ───────────── review table ───────────── */
const adt1UpCur = key => { const v = adt1State[key]; return v == null ? '' : String(v); };
const adt1UpCmp = (key, v) => { const f = ADT1_FIELD_BY_KEY[key]; return f && f.type === 'date' ? String(v || '') : String(v || '').trim().toLowerCase(); };
// true when every document behind a proposal belongs to the "other" company (see ADT1Extract.companyCheck)
function adt1UpFromOtherCompany(p) {
  const odd = (adt1Up.company && adt1Up.company.odd) || [];
  if (!odd.length) return false;
  const files = [p.evidence && p.evidence.file].concat(p.alsoIn || []).filter(Boolean);
  return files.length > 0 && files.every(f => odd.includes(f));
}

// Rows are rebuilt from adt1State every time the panel is shown and just before applying, so `same` and
// `shown` ("In the form now") always describe the form as it is NOW, not as it was when the table was first drawn.
function adt1UpBuildRows() {
  const byKey = new Map();
  for (const p of adt1Up.merged) { if (!ADT1_FIELD_BY_KEY[p.key]) continue; if (!byKey.has(p.key)) byKey.set(p.key, []); byKey.get(p.key).push(p); }
  adt1Up.rows = [...byKey.entries()].map(([key, list]) => {
    const p = list[0]; const cur = adt1UpCur(key);
    const same = adt1UpCmp(key, cur) === adt1UpCmp(key, p.value);
    const edit = adt1Up.edits.get(key);
    const odd = adt1UpFromOtherCompany(p);
    return { key, list, idx: 0, value: edit && edit.value != null ? edit.value : p.value, same, shown: cur, odd,
      accept: edit && edit.accept != null ? edit.accept : (!same && p.confidence >= 0.8 && !p.conflict && cur === '' && !odd) };
  });
  const order = ADT1_FIELD_LIST.map(f => f.key);
  adt1Up.rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
}

function adt1UpControl(row) {
  const f = ADT1_FIELD_BY_KEY[row.key]; const v = row.value == null ? '' : String(row.value);
  if (f.type === 'select') return `<select class="sel" data-au1-edit="${row.key}">${(f.opts.includes(v) ? '' : `<option value="" selected>Select…</option>`)}${f.opts.map(o => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  if (f.type === 'date') return `<input class="in" type="date" data-au1-edit="${row.key}" value="${esc(adt1ToISO(v))}">`;
  return `<input class="in" type="text" data-au1-edit="${row.key}" value="${esc(v)}"${f.upper ? ' style="text-transform:uppercase"' : ''}>`;
}
const adt1UpShow = (key, v) => { const f = ADT1_FIELD_BY_KEY[key]; if (v === '' || v == null) return '<span class="muted">empty</span>'; return esc(f.type === 'date' ? (adt1ToDMY(v) || v) : String(v)); };

function adt1UpRenderReview() {
  const rows = adt1Up.rows;
  $('#au1Review').classList.remove('hidden');
  // the company warning is repeated inside the review card, right above the table
  let cw = document.getElementById('au1Company');
  if (!cw) { cw = document.createElement('div'); cw.id = 'au1Company'; cw.className = 'mb12'; $('#au1Chips').before(cw); }
  cw.innerHTML = adt1Up.company && !adt1Up.company.ok ? adt1UpCompanyHtml(adt1Up.company) : '';
  const conflicts = rows.filter(r => r.list.length > 1).length, both = rows.filter(r => r.list[0].method === 'both').length;
  const changes = rows.filter(r => !r.same).length;
  $('#au1Chips').innerHTML = [
    `<span class="chip"><strong>${rows.length}</strong> value${rows.length === 1 ? '' : 's'} from ${adt1Up.items.filter(i => i.status === 'ok').length} file${adt1Up.items.length === 1 ? '' : 's'}</span>`,
    `<span class="chip"><strong>${changes}</strong> differ from the form</span>`,
    both ? `<span class="chip"><strong>${both}</strong> confirmed by documents and AI</span>` : '',
    conflicts ? `<span class="chip" style="color:var(--warn)"><strong>${conflicts}</strong> conflict${conflicts > 1 ? 's' : ''} to decide</span>` : ''
  ].join('');
  $('#au1Title').textContent = rows.length ? `${rows.length} proposed value${rows.length === 1 ? '' : 's'}` : 'Nothing usable was found';
  if (!rows.length) { $('#au1Table').innerHTML = '<tbody><tr><td class="muted">No ADT-1 values were found in these documents. Nothing is guessed: enter the values by hand in Data Entry.</td></tr></tbody>'; return; }
  const srcBadge = p => `<span class="badge ${p.method === 'ai' ? 'ai' : 'doc'}">${p.method === 'both' ? 'Document + AI' : p.method === 'ai' ? 'AI' : 'Document'}</span>`;
  const confHtml = p => { const c = Math.round(p.confidence * 100); const cls = p.confidence >= 0.8 ? '' : p.confidence >= 0.6 ? 'mid' : 'low'; return `<span class="conf ${cls}" title="confidence ${c}%"><i style="width:${c}%"></i></span> <span class="muted">${c}%</span>`; };
  let html = '<thead><tr><th style="width:28px"></th><th>Field</th><th>Proposed value</th><th>In the form now</th><th>Source and quote</th><th>Confidence</th></tr></thead><tbody>';
  let section = null;
  rows.forEach((r, i) => {
    const f = ADT1_FIELD_BY_KEY[r.key]; const p = r.list[r.idx];
    if (f.section !== section) { section = f.section; const s = ADT1_SECTIONS.find(x => x.id === section); html += `<tr class="group"><td colspan="6">${esc(s ? s.title : section)}</td></tr>`; }
    const cur = adt1UpCur(r.key);
    const alts = r.list.map((q, j) => j === r.idx ? '' : `<div class="alt">${q.method === 'ai' ? 'The AI read' : 'Another document shows'} <strong>${adt1UpShow(r.key, q.value)}</strong>${q.evidence && q.evidence.file ? ` <span class="muted">(${esc(q.evidence.file)})</span>` : ''}<button class="btn sm" data-au1-swap="${i}:${j}" type="button">use that</button></div>`).join('');
    const ev = p.evidence || {};
    const evHtml = `<div class="ev">${ev.file ? `<b>${esc(ev.file)}</b>` : ''}${ev.quote ? ` “${esc(ev.quote)}”` : ''}${p.alsoIn && p.alsoIn.length ? ` <span class="muted">also in ${esc(p.alsoIn.join(', '))}</span>` : ''}${p.aiEvidence && p.aiEvidence.quote ? ` <span class="muted">AI: ${esc(p.aiEvidence.quote)}</span>` : ''}</div>`;
    const unv = p.unverified ? `<div class="alt">${p.unverifiedWhy === 'quote' ? 'The AI gave this answer, but the words it quoted do not show it: check the document yourself.' : 'The AI gave this value but it is not in your documents: check it carefully.'}</div>` : '';
    const other = r.odd ? '<div class="alt">From a document of a different company (see the company check above): not ticked by default.</div>' : '';
    const overwrite = unv + other + (cur !== '' && !r.same ? '<div class="alt">Ticking this replaces what is in the form.</div>' : '');
    html += `<tr data-au1-row="${i}" class="${r.list.length > 1 ? 'conflict' : ''}" data-same="${r.same ? 1 : 0}" data-conflict="${r.list.length > 1 ? 1 : 0}" data-low="${p.confidence < 0.6 ? 1 : 0}"><td><input type="checkbox" data-au1-ck="${i}" ${r.accept ? 'checked' : ''} aria-label="Use this value"></td><td class="lbl">${esc(f.label)}</td><td>${adt1UpControl(r)}${p.conflict ? ' <span class="badge" style="background:var(--warn-soft);color:var(--warn)">conflict</span>' : ''}${r.odd ? ' <span class="badge" style="background:var(--err-soft);color:var(--err)">other company</span>' : ''}${alts}</td><td class="muted">${adt1UpShow(r.key, cur)}${r.same ? ' <span class="same">(same)</span>' : ''}${overwrite}</td><td><span class="src">${srcBadge(p)}</span>${evHtml}</td><td>${confHtml(p)}</td></tr>`;
  });
  $('#au1Table').innerHTML = html + '</tbody>';
  $$('#au1Table [data-au1-edit]').forEach(el => el.addEventListener('change', () => {
    const r = adt1Up.rows[+el.closest('tr').dataset.au1Row]; if (!r) return;
    r.value = el.value; r.accept = true; adt1Up.edits.set(r.key, { value: r.value, accept: true });
    const cb = el.closest('tr').querySelector('[data-au1-ck]'); if (cb) cb.checked = true;
  }));
  $$('#au1Table [data-au1-ck]').forEach(cb => cb.addEventListener('change', () => {
    const r = adt1Up.rows[+cb.dataset.au1Ck]; r.accept = cb.checked; const e = adt1Up.edits.get(r.key) || {}; e.accept = cb.checked; adt1Up.edits.set(r.key, e);
  }));
  $$('#au1Table [data-au1-swap]').forEach(b => b.addEventListener('click', () => {
    const [i, j] = b.dataset.au1Swap.split(':').map(Number); const r = adt1Up.rows[i];
    r.idx = j; r.value = r.list[j].value; r.list = [r.list[j]].concat(r.list.filter((_, k) => k !== j)); r.idx = 0;
    adt1Up.edits.set(r.key, { value: r.value, accept: r.accept }); adt1UpRenderReview();
  }));
  adt1UpApplyFilter();
}
function adt1UpApplyFilter() {
  const m = adt1Up.filter;
  $$('#au1Table tr[data-au1-row]').forEach(tr => {
    const show = m === 'all' || (m === 'changes' && tr.dataset.same === '0') || (m === 'conflicts' && tr.dataset.conflict === '1') || (m === 'low' && tr.dataset.low === '1');
    tr.classList.toggle('hidden', !show);
  });
  $$('#au1Table tr.group').forEach(g => { let n = g.nextElementSibling, any = false; while (n && !n.classList.contains('group')) { if (!n.classList.contains('hidden')) any = true; n = n.nextElementSibling; } g.classList.toggle('hidden', !any); });
}

/* ───────────── apply to the form ───────────── */
function adt1UpApply() {
  const picked = adt1Up.rows.filter(r => r.accept);
  if (!picked.length) return toast('Tick at least one value first', true);
  const applied = [], skipped = [], changed = [];
  const from = Object.assign({}, adt1State._fromDoc);
  for (const r of picked) {
    const f = ADT1_FIELD_BY_KEY[r.key];
    // The form moved on since this table was drawn (typed in Data Entry): never overwrite that silently.
    if (adt1UpCur(r.key) !== r.shown) { changed.push(f.label); continue; }
    let v = String(r.value == null ? '' : r.value).trim();
    if (f.type === 'date') v = adt1ToISO(v);
    else if (f.type === 'select') v = (f.opts.find(o => o.toLowerCase() === v.toLowerCase()) || '');
    else if (f.upper || f.fmt === 'cin' || f.fmt === 'pan') v = v.toUpperCase();
    if (!v) { skipped.push(f.label); continue; }
    adt1State[r.key] = v;
    from[r.key] = { v, f: (r.list[0].evidence && r.list[0].evidence.file) || '' };
    adt1Touched.add(r.key);
    applied.push(r.key);
  }
  adt1State._fromDoc = from;
  if (applied.length) { renderAdt1(); saveAdt1Draft(); adt1MarkFromDoc(); }
  // Applied rows are un-ticked for good (the edits map would otherwise re-tick them on the next rebuild); rows whose form
  // value changed under them must be ticked again on purpose.
  for (const k of applied.concat(picked.filter(r => changed.includes(ADT1_FIELD_BY_KEY[r.key].label)).map(r => r.key))) adt1Up.edits.set(k, Object.assign(adt1Up.edits.get(k) || {}, { accept: false }));
  adt1UpBuildRows(); adt1UpRenderReview();
  adt1UpSteps(4);
  toast(`${applied.length} value${applied.length === 1 ? '' : 's'} put into the form${skipped.length ? `; ${skipped.length} skipped (not a valid answer)` : ''}${changed.length ? `; ${changed.length} not applied (changed in the form since)` : ''}`, changed.length > 0);
  adt1UpRenderResult(applied.length, skipped, changed);
}

function adt1UpRenderResult(n, skipped, changed) {
  const { errors, warnings } = validateAdt1(adt1State);
  const missing = errors.concat(warnings.filter(w => w.kind === 'required'));
  const li = m => `<li><span class="sev ${errors.includes(m) ? 'err' : 'warn'}"></span><span>${esc(m.msg)}</span></li>`;
  const kept = changed && changed.length ? `<div class="note warn"><strong>Not applied: ${esc(changed.join(', '))}.</strong> ${changed.length === 1 ? 'This field was' : 'These fields were'} changed in Data Entry after this table was drawn, so what you typed was kept. The table now shows the current form values: tick ${changed.length === 1 ? 'it' : 'them'} again if you really want to replace what you typed.</div>` : '';
  $('#au1Result').innerHTML = `${kept}<div class="note ok"><strong>${n} value${n === 1 ? '' : 's'} applied to the form.</strong> They are marked “from document” in Data Entry. Check them against the originals before you send anything.${skipped.length ? ` Skipped: ${esc(skipped.join(', '))}.` : ''}</div>
    <div class="subblock mt12"><strong>Still missing or wrong for MCA (${missing.length})</strong>${missing.length ? `<ul class="issues mt8">${missing.slice(0, 14).map(li).join('')}${missing.length > 14 ? `<li><span class="muted">…and ${missing.length - 14} more in Review &amp; Send</span></li>` : ''}</ul>` : '<p class="muted mt8">Nothing required is missing.</p>'}</div>
    <div class="btn-row mt12"><button class="btn primary" id="au1GoData" type="button">Go to Data Entry</button><button class="btn" id="au1GoReview" type="button">Review &amp; Send</button></div>`;
  $('#au1GoData').addEventListener('click', () => showPanel('data-adt1'));
  $('#au1GoReview').addEventListener('click', () => showPanel('review-adt1'));
}

/* Small "from document" badge on the Data Entry labels (only while the field still holds the applied value). */
function adt1MarkFromDoc() {
  const from = adt1State._fromDoc || {};
  for (const f of ADT1_FIELD_LIST) {
    const wrap = document.getElementById('adF_' + f.key); if (!wrap) continue;
    const label = wrap.querySelector('label'); if (!label) continue;
    const old = label.querySelector('.au1-doc-badge'); if (old) old.remove();
    const m = from[f.key];
    if (m && String(adt1State[f.key] || '') === m.v) {
      const b = document.createElement('span'); b.className = 'badge doc au1-doc-badge'; b.textContent = 'from document'; b.title = m.f ? `Filled from ${m.f}` : 'Filled from a document';
      label.appendChild(document.createTextNode(' ')); label.appendChild(b);
    }
  }
}

/* ───────────── wiring ───────────── */
function adt1UpRenderStatic() {
  $('#au1Req').innerHTML = ADT1Extract.ATTACHMENTS.map(a => `<li><span class="tag ${a.tag}">${a.tag}</span><span>${esc(a.text)}</span></li>`).join('');
}
function adt1UpOnShow() {
  adt1UpPrewarm(); adt1UpUpdateButtons();
  // the form may have been edited since the table was drawn: redraw "In the form now" and the (same) marks from the current state
  if (adt1Up.rows.length || adt1Up.merged.length) { adt1UpBuildRows(); adt1UpRenderReview(); }
  adt1UpSteps(adt1Up.rows.length ? 3 : 1);
}

/* Called (guarded) from adt1Replace in js/adt1-form.js whenever another client is put on screen (+New, Sample, Import,
   client switch, Delete): the files, proposals, ticks and the "applied" message all belonged to the previous client. */
function adt1UpReset() {
  if (adt1Up.aiCtl) { try { adt1Up.aiCtl.abort(); } catch (_) { /* ignore */ } adt1Up.aiCtl = null; }
  adt1Up.aiRun++;   // a late AI answer for the old client is ignored
  const had = adt1Up.items.length > 0 || adt1Up.rows.length > 0 || adt1Up.merged.length > 0;
  adt1Up.items = []; adt1Up.rules = []; adt1Up.ai = []; adt1Up.merged = []; adt1Up.rows = []; adt1Up.edits.clear();
  adt1Up.company = null; adt1Up.docTypes = null; adt1Up.ruleNotes = null; adt1Up.extracting = false; adt1Up.filter = 'all';
  if (!document.getElementById('au1Files')) return;
  $('#au1Files').innerHTML = ''; $('#au1Result').innerHTML = ''; $('#au1AiBanner').innerHTML = ''; $('#au1Table').innerHTML = ''; $('#au1Chips').innerHTML = '';
  $('#au1Status').textContent = ''; $('#au1Review').classList.add('hidden');
  const cw = document.getElementById('au1Company'); if (cw) cw.innerHTML = '';
  $('#au1Notes').innerHTML = had ? '<div class="note">You switched to a different client, so the documents and values from the previous client were cleared. Add this client\'s documents and extract again.</div>' : '';
  $$('#au1Filter button').forEach(x => x.classList.toggle('on', x.dataset.f === 'all'));
  adt1UpSteps(1);
  try { adt1UpUpdateButtons(); } catch (_) { /* dashboard.js globals not ready yet */ }
}

function bindAdt1Upload() {
  const zone = $('#au1Drop'), input = $('#au1Input');
  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); adt1UpAddFiles(e.dataTransfer.files); });
  input.addEventListener('change', () => { adt1UpAddFiles(input.files); input.value = ''; });
  $('#au1UseAi').addEventListener('change', e => { e.target.dataset.touched = '1'; adt1UpUpdateButtons(); });
  $('#au1Scanned').addEventListener('change', adt1UpUpdateButtons);
  $('#au1Extract').addEventListener('click', adt1UpExtract);
  $('#au1Apply').addEventListener('click', adt1UpApply);
  $('#au1SelHigh').addEventListener('click', () => { adt1Up.rows.forEach(r => { const p = r.list[0]; r.accept = !r.same && p.confidence >= 0.8 && r.list.length === 1 && !r.odd; adt1Up.edits.set(r.key, Object.assign(adt1Up.edits.get(r.key) || {}, { accept: r.accept })); }); adt1UpRenderReview(); });
  $('#au1SelNone').addEventListener('click', () => { adt1Up.rows.forEach(r => { r.accept = false; adt1Up.edits.set(r.key, Object.assign(adt1Up.edits.get(r.key) || {}, { accept: false })); }); adt1UpRenderReview(); });
  $$('#au1Filter button').forEach(b => b.addEventListener('click', () => { adt1Up.filter = b.dataset.f; $$('#au1Filter button').forEach(x => x.classList.toggle('on', x === b)); adt1UpApplyFilter(); }));
  adt1UpRenderStatic(); adt1UpUpdateButtons(); adt1MarkFromDoc();
}
