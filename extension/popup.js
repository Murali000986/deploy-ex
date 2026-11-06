// Popup controller — orchestrates auth, draft loading, and extension actions.
// Uses: utils.js (mapDraftToFields, isTokenExpired, formatResults)
//       api.js (exchangeToken, fetchDrafts, fetchDraft)
//       field-map-inc32.js (INC32_CATEGORIES)

(async function () {
  "use strict";

  // ── DOM refs ──
  const $ = id => document.getElementById(id);
  const connDot     = $("connDot"),     connLabel   = $("connLabel");
  const pageRow     = $("pageRow"),     pageDot     = $("pageDot"),   pageLabel = $("pageLabel");
  const authPanel   = $("authPanel"),   mainPanel   = $("mainPanel");
  const authError   = $("authError");
  const btnConnect  = $("btnConnect");
  const userName    = $("userName"),    btnDisconnect = $("btnDisconnect");
  const draftSelect = $("draftSelect"), draftCard   = $("draftCard");
  const btnSampleDraft = $("btnSampleDraft");
  const draftClient = $("draftClient"), draftType   = $("draftType");
  const draftName   = $("draftName"),   draftVerdict = $("draftVerdict");
  const draftAvailability = $("draftAvailability");
  const validationPanel = $("validationPanel"), issueList = $("issueList");
  const btnFill     = $("btnFill"),     btnValidate = $("btnValidate");
  const btnRefresh  = $("btnRefresh"),  btnClear    = $("btnClear");
  const btnScan     = $("btnScan"),     btnCopyScan = $("btnCopyScan"),  btnTest = $("btnTest");
  const scanPanel   = $("scanPanel"),   scanCount   = $("scanCount");
  const scanUrl     = $("scanUrl"),     scanBody    = $("scanBody");
  const resultPanel = $("resultPanel"), resultSummary = $("resultSummary");
  const resultList  = $("resultList");
  const spinner     = $("spinner"),     errorBanner = $("errorBanner");
  const clearDialog = $("clearDialog"), btnClearConfirm = $("btnClearConfirm"), btnClearCancel = $("btnClearCancel");

  // Tab refs
  const tabLogin       = $("tabLogin"),      tabPartA       = $("tabPartA"),      tabNewCo       = $("tabNewCo");
  const tabPanelLogin  = $("tabPanelLogin"), tabPanelPartA  = $("tabPanelPartA"), tabPanelNewCo  = $("tabPanelNewCo");

  // Automation tab refs
  const mcaUsernameInput = $("mcaUsername"),   mcaPasswordInput = $("mcaPassword");
  const btnTogglePass    = $("btnTogglePass");
  const autoStatusCard   = $("autoStatusCard");
  const autoStatusIcon   = $("autoStatusIcon"), autoStatusLabel = $("autoStatusLabel"), autoStatusDetail = $("autoStatusDetail");
  const btnRunAutomation = $("btnRunAutomation"), btnStopAuto = $("btnStopAuto");
  const btnRetryAuto     = $("btnRetryAuto");
  const formTypeSelect   = $("formTypeSelect");
  const formGrid         = $("formGrid");
  const clientDataContainer = $("clientDataContainer");
  const cdsEmpty         = $("cdsEmpty");
  const cdsHint          = $("cdsHint");
  const cdsErrorBanner   = $("cdsErrorBanner");
  const cdsCounts        = $("cdsCounts");
  const cdsRequiredCount = $("cdsRequiredCount");
  const cdsFilledCount   = $("cdsFilledCount");
  const cdsFilledTotal   = $("cdsFilledTotal");
  const btnLoadFill      = $("btnLoadFill");
  const btnSaveDraft     = $("btnSaveDraft");
  const mcaStepper       = $("mcaStepper");
  const btnSaveAllData   = $("btnSaveAllData"), btnClearAllData = $("btnClearAllData");

  // Form group map (form value -> container element id)
  const FORM_GROUPS = {
    spice_a:      "fieldsSpiceA",
    inc32:        "fieldsInc32",
    dir3:         "fieldsDir3",
    aoc4:         "fieldsAoc4",
    aoc4_offline: "fieldsAoc4Offline",
  };
  const FORM_LABELS = {
    spice_a:      "SPICe+ Part A",
    inc32:        "INC-32",
    dir3:         "DIR-3 KYC",
    aoc4:         "AOC-4",
    aoc4_offline: "AOC-4 Offline",
  };

  // Client identity bar
  const clientIdentityBar = $("clientIdentityBar");
  const cibClientName     = $("cibClientName");
  const cibClientId       = $("cibClientId");
  const cibCategory       = $("cibCategory");
  const cibBadge          = $("cibBadge");

  // New Company Reg refs
  const ncoDraftSelect   = $("ncoDraftSelect");
  const ncoCategoryList  = $("ncoCategoryList");
  const ncoBtnFill       = $("ncoBtnFill");
  const ncoBtnValidate   = $("ncoBtnValidate");
  const ncoBtnRefresh    = $("ncoBtnRefresh");
  const ncoBtnClear      = $("ncoBtnClear");
  const ncoResultPanel   = $("ncoResultPanel");
  const ncoResultSummary = $("ncoResultSummary");
  const ncoResultList    = $("ncoResultList");
  const ncoDraftCount    = $("ncoDraftCount");

  // ── State ──
  let token = null;
  let currentDraft = null;
  let ncoDraft = null;
  let drafts = [];
  let ncoDrafts = [];
  let lastScanData = [];
  let activeTabUrl = "";
  let isSampleDraft = false;
  let activeTab = "login";

  // ── Helpers ──
  function showSpinner(yes) { spinner.style.display = yes ? "flex" : "none"; }
  function showError(msg) {
    // v2: route to toast system, but also keep legacy banner updated for backward-compat
    try {
      if (errorBanner) {
        errorBanner.textContent = msg || "";
        errorBanner.style.display = msg ? "block" : "none";
      }
      if (msg && typeof toast === "object" && toast.error) {
        toast.error(String(msg), { dedupeKey: "popup-error-" + String(msg).slice(0, 40) });
      }
    } catch (_) {
      if (errorBanner) {
        errorBanner.textContent = msg || "";
        errorBanner.style.display = msg ? "block" : "none";
      }
    }
  }
  function clearError() {
    try {
      if (errorBanner) {
        errorBanner.textContent = "";
        errorBanner.style.display = "none";
      }
    } catch (_) {}
  }

  function setConn(state, label) {
    connDot.className = "dot " + state;
    connLabel.textContent = label;
  }

  function setPageStatus(tab) {
    activeTabUrl = tab?.url || "";
    pageRow.style.display = "flex";
    if (!tab) { pageDot.className = "dot-page"; pageLabel.textContent = "No active tab"; btnSampleDraft.disabled = true; return; }
    const isMCA = tab.url?.includes("mca.gov.in") || tab.url?.startsWith("http://localhost:4000/");
    pageDot.className = "dot-page " + (isMCA ? "active" : "inactive");
    const isDemo = tab.url?.startsWith("http://localhost:4000/");
    pageLabel.textContent = isDemo ? "Local demo form detected" : isMCA ? "MCA form detected" : "Not on MCA portal";
    btnSampleDraft.disabled = !isDemo;
    btnSampleDraft.title = isDemo ? "Load sample data for the local demo form" : "Open the local demo form at localhost:4000 to use sample data";
  }

  function companyTypeLabel(ct) {
    const m = { PRIVATE_LIMITED: "Private Limited", OPC: "One Person Company", LLP: "LLP", PUBLIC_LIMITED: "Public Limited" };
    return m[ct] || ct || "—";
  }

  // ── Client identity bar ──
  function showClientIdentity(draft, category) {
    if (!draft) { clientIdentityBar.style.display = "none"; return; }
    clientIdentityBar.style.display = "flex";
    cibClientName.textContent = draft.clientName || "—";
    cibClientId.textContent   = draft.clientId ? `ID: ${draft.clientId}` : draft.id || "—";
    cibCategory.textContent   = category || companyTypeLabel(draft.companyType);
    cibBadge.textContent      = category || "Client";
  }

  function showMain(user) {
    authPanel.style.display = "none";
    mainPanel.style.display = "flex";
    setConn("online", "Connected to Ledgerly");
    userName.textContent = user?.name ? `${user.name} (${user.role})` : "";
  }

  function showAuth(errorMsg) {
    authPanel.style.display = "flex";
    mainPanel.style.display = "none";
    setConn("", "Not connected");
    if (errorMsg) authError.textContent = errorMsg;
    else authError.textContent = "";
  }

  // ── Tab switching ──
  function switchTab(tab) {
    activeTab = tab;
    tabLogin.classList.toggle("tab-active", tab === "login");
    tabPartA.classList.toggle("tab-active", tab === "partA");
    tabNewCo.classList.toggle("tab-active", tab === "newCo");
    tabPanelLogin.style.display = tab === "login" ? "" : "none";
    tabPanelPartA.style.display = tab === "partA" ? "" : "none";
    tabPanelNewCo.style.display = tab === "newCo" ? "" : "none";
    if (tab === "login") refreshAutoStatus();
  }

  tabLogin.addEventListener("click", () => switchTab("login"));
  tabPartA.addEventListener("click", () => switchTab("partA"));
  tabNewCo.addEventListener("click", () => switchTab("newCo"));

  // ── Render draft card (Part A) ──
  function renderDraftCard(draft) {
    if (!draft) { draftCard.style.display = "none"; validationPanel.style.display = "none"; showClientIdentity(null); return; }
    draftCard.style.display = "flex";
    draftClient.textContent   = draft.clientName || "—";
    draftType.textContent     = companyTypeLabel(draft.companyType);
    const name0 = draft.proposedNames?.[0];
    draftName.textContent     = name0?.name || "—";
    const verdict = name0?.verdict || "—";
    draftVerdict.textContent  = verdict.replace(/_/g, " ").toLowerCase();
    draftVerdict.className    = "verdict-badge" + (verdict === "NO_MATCH" ? "" : " warn");
    if (verdict === "NO_MATCH" && name0?.source) {
      draftAvailability.textContent = `No match found (${name0.source})`;
      draftAvailability.style.color = "#333";
    } else {
      draftAvailability.textContent = "Name availability not verified";
      draftAvailability.style.color = "#888";
    }
    const issues = draft.validation || [];
    if (issues.length) {
      validationPanel.style.display = "block";
      issueList.innerHTML = issues.map(v =>
        `<li class="${v.severity === "ERROR" ? "error" : "warn"}">${v.severity}: ${v.message}</li>`
      ).join("");
    } else {
      validationPanel.style.display = "none";
    }
    const errorCount = issues.filter(v => v.severity === "ERROR").length;
    btnFill.disabled     = errorCount > 0;
    btnValidate.disabled = false;
    btnClear.disabled    = false;
    btnFill.title = errorCount > 0 ? "Resolve validation errors before filling" : "";
    showClientIdentity(draft, "SPICe+ Part A");
  }

  // ── Render results (shared) ──
  function renderResults(results, summaryEl, listEl, panelEl) {
    panelEl.style.display = "block";
    const filled  = results.filter(r => r.status === "filled").length;
    const skipped = results.filter(r => r.status === "skipped").length;
    const invalid = results.filter(r => r.status === "invalid").length;
    const review  = results.filter(r => r.status === "needs-review").length;
    summaryEl.textContent = `${filled} filled · ${skipped} skipped · ${invalid} invalid · ${review} needs review`;
    const formatted = formatResults(results);
    listEl.innerHTML = formatted.map(r =>
      `<li class="status_${r.cssClass}">
        <span class="r-icon">${r.icon}</span>
        <span class="r-label">${r.label}</span>
        <span class="r-reason">${r.reason || ""}</span>
      </li>`
    ).join("");
  }

  // ── Render NCO categories ──
  function renderNCOCategories(draft) {
    if (!draft) {
      ncoCategoryList.style.display = "none";
      ncoBtnFill.disabled = ncoBtnValidate.disabled = ncoBtnClear.disabled = true;
      showClientIdentity(null);
      return;
    }

    // Show client identity bar
    showClientIdentity(draft, "New Company Registration");

    const fields = draft.submittedFields || {};

    ncoCategoryList.innerHTML = INC32_CATEGORIES.map(cat => {
      const rows = cat.fields.map(f => {
        const val = fields[f.dataKey] || fields[f.key] || "";
        const isEmpty = !val;
        const statusClass = isEmpty ? (f.required ? "nco-empty nco-required" : "nco-empty") : "nco-filled";
        const statusIcon  = isEmpty ? (f.required ? "⚠" : "–") : "✓";
        return `
          <div class="nco-field-row ${statusClass}">
            <span class="nco-field-icon">${statusIcon}</span>
            <span class="nco-field-label">${escHtml(f.label)}</span>
            <span class="nco-field-val">${val ? escHtml(String(val)) : isEmpty && f.required ? '<em class="nco-missing">Missing</em>' : '<em class="nco-optional">—</em>'}</span>
          </div>`;
      }).join("");

      const filledCount  = cat.fields.filter(f => !!(fields[f.dataKey] || fields[f.key])).length;
      const totalCount   = cat.fields.length;
      const pct          = Math.round((filledCount / totalCount) * 100);
      const allFilled    = filledCount === totalCount;

      return `
        <div class="nco-category">
          <div class="nco-cat-header" data-cat="${cat.id}">
            <span class="nco-cat-icon">${cat.icon}</span>
            <span class="nco-cat-label">${cat.label}</span>
            <span class="nco-cat-progress ${allFilled ? "nco-progress-done" : ""}">${filledCount}/${totalCount}</span>
            <span class="nco-cat-chevron">›</span>
          </div>
          <div class="nco-cat-body" id="catBody_${cat.id}" style="display:none">
            <div class="nco-progress-bar"><div class="nco-progress-fill" style="width:${pct}%"></div></div>
            ${rows}
          </div>
        </div>`;
    }).join("");

    // Accordion toggle
    ncoCategoryList.querySelectorAll(".nco-cat-header").forEach(hdr => {
      hdr.addEventListener("click", () => {
        const body = $("catBody_" + hdr.dataset.cat);
        const chevron = hdr.querySelector(".nco-cat-chevron");
        const open = body.style.display !== "none";
        body.style.display = open ? "none" : "block";
        chevron.style.transform = open ? "" : "rotate(90deg)";
      });
    });

    ncoCategoryList.style.display = "block";
    ncoBtnFill.disabled     = false;
    ncoBtnValidate.disabled = false;
    ncoBtnClear.disabled    = false;
  }

  // ── Token management ──
  function getStoredToken() {
    return new Promise(resolve =>
      chrome.runtime.sendMessage({ action: "GET_TOKEN" }, res => resolve(res?.token || null))
    );
  }
  function storeToken(t, meta) {
    return new Promise(resolve =>
      chrome.runtime.sendMessage({ action: "SET_TOKEN", token: t, meta }, resolve)
    );
  }
  function clearToken() {
    return new Promise(resolve =>
      chrome.runtime.sendMessage({ action: "CLEAR_TOKEN" }, resolve)
    );
  }

  function sendToContent(msg) {
    return new Promise((resolve) =>
      chrome.runtime.sendMessage(msg, res => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(res || { ok: false, error: "No response" });
        }
      })
    );
  }

  // ── Load Part A drafts ──
  async function loadDrafts() {
    btnRefresh.disabled = true;
    showSpinner(true); clearError();
    try {
      drafts = await fetchDrafts(token);
      draftSelect.innerHTML = '<option value="">— Select a draft —</option>' +
        drafts.map(d => `<option value="${d.id}">${d.id} — ${d.clientName}</option>`).join("");
      if (drafts.length === 0) {
        draftSelect.innerHTML = '<option value="">No READY_FOR_PART_A drafts</option>';
      }
    } catch (e) {
      if (e.name === "AuthError") { await clearToken(); showAuth(e.message); return; }
      showError(e.message);
    } finally {
      showSpinner(false); btnRefresh.disabled = false;
    }
  }

  // ── Load New Company drafts ──
  async function loadNCODrafts() {
    ncoBtnRefresh.disabled = true;
    showSpinner(true); clearError();
    try {
      // Fetch INC-32 drafts explicitly from the form-typed endpoint
      const inc32 = await fetchDrafts(token, "inc32");
      ncoDrafts = Array.isArray(inc32) ? inc32 : [];
      ncoDraftCount.textContent = `${ncoDrafts.length} pending`;
      ncoDraftSelect.innerHTML = '<option value="">— Select a client draft —</option>' +
        ncoDrafts.map(d => `<option value="${d.id}">${d.clientName || d.id}${d.clientId ? " · " + d.clientId : ""}</option>`).join("");
      if (ncoDrafts.length === 0) {
        ncoDraftSelect.innerHTML = '<option value="">No New Company drafts</option>';
        ncoDraftCount.textContent = "0 pending";
      }
    } catch (e) {
      if (e.name === "AuthError") { await clearToken(); showAuth(e.message); return; }
      showError(e.message);
    } finally {
      showSpinner(false); ncoBtnRefresh.disabled = false;
    }
  }

  // ── Init ──
  async function init() {
    setConn("", "Checking…");
    token = await getStoredToken();
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => setPageStatus(tabs[0]));
    if (!token || isTokenExpired(token)) { showAuth(); return; }
    const payload = decodeTokenPayload(token);
    showMain(payload);
    await loadDrafts();
    await loadNCODrafts();
  }

  // ── Event: Connect ──
  btnConnect.addEventListener("click", async () => {
    authError.textContent = "";
    showSpinner(true);
    try {
      const result = await exchangeToken();
      token = result.token;
      await storeToken(token, { user: result.user, expiresAt: result.expiresAt });
      showMain(result.user);
      await loadDrafts();
      await loadNCODrafts();
    } catch (e) {
      authError.textContent = e.message;
      if (e.name === "NetworkError") {
        authError.textContent = "Cannot reach Ledgerly. Is the server running at http://localhost:3000?";
      }
    } finally {
      showSpinner(false);
    }
  });

  btnDisconnect.addEventListener("click", async () => {
    token = null; currentDraft = null; ncoDraft = null; isSampleDraft = false;
    await clearToken();
    showAuth();
    resultPanel.style.display = "none";
    ncoResultPanel.style.display = "none";
    clearError();
  });

  // ── Event: Part A draft select ──
  draftSelect.addEventListener("change", async () => {
    const id = draftSelect.value;
    isSampleDraft = false;
    resultPanel.style.display = "none";
    clearError();
    if (!id) { currentDraft = null; renderDraftCard(null); btnFill.disabled = btnValidate.disabled = btnClear.disabled = true; return; }
    showSpinner(true);
    try {
      currentDraft = await fetchDraft(token, id);
      renderDraftCard(currentDraft);
    } catch (e) {
      showError(e.message);
      if (e.name === "AuthError") { await clearToken(); showAuth(e.message); }
    } finally { showSpinner(false); }
  });

  // ── Event: NCO draft select ──
  ncoDraftSelect.addEventListener("change", async () => {
    const id = ncoDraftSelect.value;
    ncoResultPanel.style.display = "none";
    clearError();
    if (!id) { ncoDraft = null; renderNCOCategories(null); return; }
    showSpinner(true);
    try {
      ncoDraft = await fetchDraft(token, id);
      renderNCOCategories(ncoDraft);
    } catch (e) {
      showError(e.message);
      if (e.name === "AuthError") { await clearToken(); showAuth(e.message); }
    } finally { showSpinner(false); }
  });

  btnRefresh.addEventListener("click", () => {
    isSampleDraft = false;
    currentDraft = null; draftCard.style.display = "none";
    resultPanel.style.display = "none"; validationPanel.style.display = "none";
    btnFill.disabled = btnValidate.disabled = btnClear.disabled = true;
    showClientIdentity(null);
    loadDrafts();
  });

  ncoBtnRefresh.addEventListener("click", () => {
    ncoDraft = null;
    ncoCategoryList.style.display = "none";
    ncoResultPanel.style.display = "none";
    showClientIdentity(null);
    loadNCODrafts();
  });

  btnSampleDraft.addEventListener("click", () => {
    if (!activeTabUrl.startsWith("http://localhost:4000/")) {
      showError("Sample data is available only on the local demo form at localhost:4000.");
      return;
    }
    currentDraft = {
      id: "LOCAL-SAMPLE-SPICE-A",
      clientName: "Sample LLP (local test data)",
      clientId: "CLT-0001",
      companyType: "LLP",
      proposedNames: [
        { name: "Northstar Digital Services LLP", verdict: "SAMPLE_ONLY" },
        { name: "Northstar Data Systems LLP", verdict: "SAMPLE_ONLY" },
      ],
      submittedFields: {
        "LLPIN": "LLPIN-TEST-0001",
        "NIC code": "62011",
        "Business activity": "Computer programming activities",
        "Language": "English",
      },
      validation: [],
      demoOnly: true,
    };
    isSampleDraft = true;
    draftSelect.value = "";
    resultPanel.style.display = "none";
    clearError();
    renderDraftCard(currentDraft);
  });

  // ── Event: Part A Fill/Validate/Clear ──
  btnFill.addEventListener("click", async () => {
    if (!currentDraft) return;
    clearError(); showSpinner(true);
    const res = await sendToContent({ action: "FILL_FORM", draft: currentDraft, sampleData: isSampleDraft });
    showSpinner(false);
    if (!res.ok) { showError(res.error); return; }
    renderResults(res.results, resultSummary, resultList, resultPanel);
  });

  btnValidate.addEventListener("click", async () => {
    if (!currentDraft) return;
    clearError(); showSpinner(true);
    const res = await sendToContent({ action: "VALIDATE_FIELDS", draft: currentDraft, sampleData: isSampleDraft });
    showSpinner(false);
    if (!res.ok) { showError(res.error); return; }
    renderResults(res.results, resultSummary, resultList, resultPanel);
  });

  btnClear.addEventListener("click", () => { clearDialog.style.display = "flex"; });
  btnClearCancel.addEventListener("click", () => { clearDialog.style.display = "none"; });
  btnClearConfirm.addEventListener("click", async () => {
    clearDialog.style.display = "none";
    clearError(); showSpinner(true);
    const res = await sendToContent({ action: "CLEAR_FORM" });
    showSpinner(false);
    if (!res.ok) { showError(res.error); return; }
    resultPanel.style.display = "none";
  });

  // ── Event: NCO Fill/Validate/Clear ──
  ncoBtnFill.addEventListener("click", async () => {
    if (!ncoDraft) return;
    clearError(); showSpinner(true);
    const res = await sendToContent({ action: "FILL_FORM", draft: ncoDraft, formType: "INC32" });
    showSpinner(false);
    if (!res.ok) { showError(res.error); return; }
    renderResults(res.results, ncoResultSummary, ncoResultList, ncoResultPanel);
  });

  ncoBtnValidate.addEventListener("click", async () => {
    if (!ncoDraft) return;
    clearError(); showSpinner(true);
    const res = await sendToContent({ action: "VALIDATE_FIELDS", draft: ncoDraft, formType: "INC32" });
    showSpinner(false);
    if (!res.ok) { showError(res.error); return; }
    renderResults(res.results, ncoResultSummary, ncoResultList, ncoResultPanel);
  });

  ncoBtnClear.addEventListener("click", async () => {
    clearError(); showSpinner(true);
    const res = await sendToContent({ action: "CLEAR_FORM" });
    showSpinner(false);
    if (!res.ok) { showError(res.error); return; }
    ncoResultPanel.style.display = "none";
  });

  // ── Event: Scan Page Fields ──
  btnScan.addEventListener("click", async () => {
    clearError(); showSpinner(true);
    scanPanel.style.display = "none";
    const res = await sendToContent({ action: "SCAN_FIELDS" });
    showSpinner(false);
    if (!res.ok) {
      showError(res.error || "Could not scan page. Reload the tab and try again.");
      return;
    }
    lastScanData = res.fields || [];
    scanCount.textContent = `(${res.total} found on ${res.title || res.url})`;
    scanUrl.textContent = res.url || "";
    scanBody.innerHTML = lastScanData.length === 0
      ? `<tr><td colspan="4" style="color:#888;padding:8px">No form fields found on this page.</td></tr>`
      : lastScanData.map(f => `
          <tr>
            <td>${f.label ? escHtml(f.label) : "<span style='color:#bbb'>—</span>"}</td>
            <td class="mono">${f.tag}</td>
            <td class="mono">${f.name ? escHtml(f.name) : "<span style='color:#bbb'>—</span>"}</td>
            <td class="mono">${f.id  ? escHtml(f.id)   : "<span style='color:#bbb'>—</span>"}</td>
          </tr>`).join("");
    scanPanel.style.display = "block";
  });

  btnCopyScan.addEventListener("click", () => {
    if (!lastScanData.length) return;
    const text = JSON.stringify(lastScanData, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      btnCopyScan.textContent = "Copied scan data";
      setTimeout(() => { btnCopyScan.textContent = "Copy scan data"; }, 2000);
    });
  });

  function escHtml(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  btnTest.addEventListener("click", async () => {
    clearError(); showSpinner(true);
    const res = await sendToContent({ action: "TEST_FILL", value: "Ledgerly ✓" });
    showSpinner(false);
    if (!res.ok) {
      showError(res.error || "Test fill failed. Reload the page tab and try again.");
      return;
    }
    showError("");
    const banner = $("errorBanner");
    banner.textContent = `Test fill successful. Filled ${res.filled.selector} with "${res.value}". Check the page for the outline.`;
    banner.style.display = "block";
    banner.style.background = "#f1f1f1";
    banner.style.color = "#222";
    banner.style.border = "1px solid #d5d5d5";
    setTimeout(() => {
      banner.style.display = "none";
      banner.style.background = "";
      banner.style.color = "";
      banner.style.border = "";
    }, 5000);
  });

  // ══════════════════════════ Automation Tab Logic ══════════════════════════

  // ── Password toggle ──
  btnTogglePass.addEventListener("click", () => {
    mcaPasswordInput.type = mcaPasswordInput.type === "password" ? "text" : "password";
  });

  // ── Toggle form fields based on selected form type ──
  function toggleFormFields() {
    try {
      const value = formTypeSelect.value;
      const hasSelection = !!value && !!FORM_GROUPS[value];
      // Hide all groups
      Object.values(FORM_GROUPS).forEach(id => {
        const el = $(id);
        if (el) el.style.display = "none";
      });
      // Show the chosen one
      if (hasSelection) {
        const el = $(FORM_GROUPS[value]);
        if (el) el.style.display = "";
      }
      cdsEmpty.style.display = hasSelection ? "none" : "";
      cdsHint.textContent = hasSelection
        ? `${FORM_LABELS[value]} — fill required details`
        : "Select a form to continue";
      cdsCounts.style.display = hasSelection ? "" : "none";

      // Update card active states
      document.querySelectorAll(".form-card").forEach(card => {
        const isActive = card.dataset.form === value;
        card.classList.toggle("form-card-active", isActive);
        card.setAttribute("aria-checked", isActive ? "true" : "false");
      });

      updateCountsAndValidate();
      // v2: refresh category badge + client data card
      try { updateCategoryBadge(value || null); } catch(_) {}
      try { recomputeFieldCompletion(value); hydrateClientDataCard(); } catch(_) {}
    } catch (e) {
      try { errorHandler(e, { source: "popup", op: "toggleFormFields", severity: "warning", silent: true }); } catch (_) { console.error(e); }
    }
  }
  formTypeSelect.addEventListener("change", toggleFormFields);

  // Form card click -> set hidden select and dispatch change
  function setupFormCards() {
    document.querySelectorAll(".form-card").forEach(card => {
      card.addEventListener("click", () => {
        formTypeSelect.value = card.dataset.form;
        formTypeSelect.dispatchEvent(new Event("change"));
      });
    });
  }
  setupFormCards();

  // ── Visible-group helpers ──
  function visibleGroupEl() {
    const value = formTypeSelect.value;
    if (!value || !FORM_GROUPS[value]) return null;
    return $(FORM_GROUPS[value]);
  }

  function requiredFieldsInVisible() {
    const el = visibleGroupEl();
    if (!el) return [];
    const required = [];
    el.querySelectorAll(".field-label").forEach(lbl => {
      if (lbl.textContent.includes("*")) {
        // Find the input/select/textarea in the same field-group
        const fg = lbl.closest(".field-group");
        if (!fg) return;
        const input = fg.querySelector("[data-key]");
        if (input) required.push({ input, label: lbl.textContent.replace(/\s*\*\s*$/, "").trim() });
      }
    });
    return required;
  }

  function updateCountsAndValidate() {
    const el = visibleGroupEl();
    if (!el) {
      btnLoadFill.disabled = true;
      return;
    }
    const required = requiredFieldsInVisible();
    const missing = required.filter(({ input }) => !String(input.value || "").trim());
    const allFields = el.querySelectorAll("[data-key]");
    const filled = Array.from(allFields).filter(i => !!String(i.value || "").trim()).length;

    cdsRequiredCount.textContent = String(required.length);
    cdsFilledCount.textContent = String(required.length - missing.length);
    cdsFilledTotal.textContent = String(filled);

    btnLoadFill.disabled = missing.length > 0;
  }

  // Live update of counts on any input in client data area
  if (clientDataContainer) {
    clientDataContainer.addEventListener("input", updateCountsAndValidate);
    clientDataContainer.addEventListener("change", updateCountsAndValidate);
  }

  // ── Gather form data from the visible group only ──
  function gatherFormData() {
    const data = {};
    const el = visibleGroupEl();
    if (!el) return data;
    el.querySelectorAll("[data-key]").forEach(input => {
      const key = input.dataset.key;
      const val = input.tagName === "SELECT" ? input.value : (input.value || "").trim();
      if (val !== "" && val !== undefined && val !== null) data[key] = val;
    });
    return data;
  }

  // ── Stepper rendering ──
  const STEP_ORDER = ["open_mca", "fill_login", "captcha", "otp", "detect_form", "fill_fields", "done"];

  function renderStepper(stepKey, status, message, error) {
    if (!mcaStepper) return;
    // normalize status (completed -> done migration shim)
    const normStatus = normalizeStatus(status);
    // Build state map
    const activeIdx = STEP_ORDER.indexOf(stepKey);
    STEP_ORDER.forEach((key, idx) => {
      const el = $("step-" + key);
      if (!el) return;
      let state = "pending";
      if (normStatus === "error" && key === stepKey) state = "error";
      else if (activeIdx === -1) state = "pending";
      else if (idx < activeIdx) state = "completed";
      else if (idx === activeIdx) state = (normStatus === "done") ? "completed" : "active";
      else state = "pending";
      el.setAttribute("data-state", state);
    });
    if (normStatus === "error" && (message || error)) {
      autoStatusLabel.textContent = "Error";
      autoStatusDetail.textContent = (error && error.message) || message;
      if (btnRetryAuto) btnRetryAuto.style.display = "";
    } else {
      if (btnRetryAuto) btnRetryAuto.style.display = "none";
    }
    // Also render into the richer v2 timeline
    try { renderLiveTimeline({ step: stepKey, status: normStatus, message, error }); } catch (_) {}
  }

  function resetStepper() {
    if (!mcaStepper) return;
    STEP_ORDER.forEach(key => {
      const el = $("step-" + key);
      if (el) el.setAttribute("data-state", "pending");
    });
    if (btnRetryAuto) btnRetryAuto.style.display = "none";
  }

  // ── Update automation status display ──
  function updateAutoStatus(active, stepData) {
    try {
      if (active) {
        if (autoStatusCard) autoStatusCard.classList.add("auto-active-card");
        autoStatusLabel.textContent = "Automation Active";
        autoStatusDetail.textContent = stepData?.detail || stepData?.message || "Login → CAPTCHA → OTP → auto-fill form";
        btnStopAuto.style.display = "";
        // v2: start elapsed clock
        try {
          const startAt = stepData?.startedAt || Date.now();
          startElapsedClock(startAt);
        } catch (_) {}
      } else {
        if (autoStatusCard) autoStatusCard.classList.remove("auto-active-card");
        const stepKey = stepData?.step;
        autoStatusLabel.textContent = stepKey === "done" ? "Complete" : "Ready";
        autoStatusDetail.textContent = stepKey === "done"
          ? "Fields filled. Review and submit manually."
          : "Pick a form and click Load & Fill";
        btnStopAuto.style.display = "none";
        if (btnLoadFill) {
          btnLoadFill.classList.remove("btn-loadfill-progress");
          const label = btnLoadFill.querySelector(".btn-loadfill-label");
          if (label) label.textContent = "Load & Fill";
        }
        try { stopElapsedClock(); } catch (_) {}
      }
      if (stepData && stepData.step) {
        renderStepper(stepData.step, stepData.status, stepData.message || stepData.detail, stepData.error);
      } else if (!active) {
        resetStepper();
        try { renderLiveTimeline(null); } catch (_) {}
      }
      // v2: update category badge stage
      try {
        const formKey = formTypeSelect?.value || null;
        const stage = deriveStageFromStep(active, stepData);
        updateCategoryBadge(formKey, stage, stepData?.detail);
      } catch (_) {}
    } catch (e) {
      try { errorHandler(e, { source: "popup", op: "updateAutoStatus", severity: "warning", silent: true }); } catch (_) { console.error(e); }
    }
  }

  async function refreshAutoStatus() {
    const state = await new Promise(resolve =>
      chrome.runtime.sendMessage({ action: "GET_AUTOMATION_STATE" }, resolve)
    );
    if (state?.ok) updateAutoStatus(!!state.mcaAutomationActive, state.mcaAutomationStep);
  }

  // Listen for storage changes (so the stepper updates live when content script emits events)
  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      try {
        if (changes.mcaAutomationStep || changes.mcaAutomationActive) {
          refreshAutoStatus();
        }
        if (changes.mcaAutomationLogs) {
          try { renderLogDrawer(); } catch (_) {}
        }
        if (changes.mcaCurrentClientInfo || changes.mcaAdminClientInfo ||
            changes.mcaAdminLoadedAt || changes.mcaFieldCompletion) {
          try { hydrateClientDataCard(); } catch (_) {}
        }
        if (changes.mcaCriticalError) {
          try { renderErrorPanel(changes.mcaCriticalError.newValue); } catch (_) {}
        }
        if (changes.mcaSelectedForm) {
          try { updateCategoryBadge(changes.mcaSelectedForm.newValue || null); } catch (_) {}
        }
      } catch (e) {
        try { errorHandler(e, { source: "popup", op: "storage.onChanged", severity: "warning", silent: true }); } catch (_) {}
      }
    });
  }

  // Listen for runtime broadcasts from background / login-assist
  try {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      try {
        if (!msg || !msg.action) return;
        if (msg.action === "AUTOMATION_STEP_CHANGED") {
          const step = msg.step || null;
          if (step && typeof step === "object") {
            refreshAutoStatus();
          }
        } else if (msg.action === "AUTOMATION_LOG_APPENDED") {
          try { prependLogEntry(msg.entry); } catch (_) {}
        } else if (msg.action === "CRITICAL_ERROR_RAISED") {
          try { publishCriticalError(msg.error); } catch (_) {}
        } else if (msg.action === "CLIENT_DATA_LOADED") {
          try { hydrateClientDataCard(); } catch (_) {}
        }
      } catch (e) {
        try { errorHandler(e, { source: "popup", op: "runtime.onMessage", severity: "warning", silent: true }); } catch (_) {}
      }
    });
  } catch (_) {}

  // ── Load saved form data (per-form namespaced + legacy fallback) ──
  async function loadSavedFormData() {
    const creds = await new Promise(resolve =>
      chrome.runtime.sendMessage({ action: "GET_CREDENTIALS" }, resolve)
    );
    if (creds?.ok) {
      mcaUsernameInput.value = creds.mcaUsername || "";
      mcaPasswordInput.value = creds.mcaPassword || "";
    }

    // Fetch ALL per-form drafts in one call
    const perFormKeys = Object.keys(FORM_GROUPS).map(f => `mcaFormData_${f}`);
    const data = await new Promise(resolve =>
      chrome.storage.local.get(
        ["mcaSelectedForm", "mcaFormData", "mcaAutomationActive", "mcaAutomationStep", ...perFormKeys],
        resolve
      )
    );
    const selectedForm = data.mcaSelectedForm && FORM_GROUPS[data.mcaSelectedForm]
      ? data.mcaSelectedForm
      : "";
    if (selectedForm) formTypeSelect.value = selectedForm;
    toggleFormFields();

    // Populate every per-form group from namespaced storage
    for (const form of Object.keys(FORM_GROUPS)) {
      const groupEl = $(FORM_GROUPS[form]);
      if (!groupEl) continue;
      const stored = data[`mcaFormData_${form}`]
        || (form === selectedForm ? data.mcaFormData : null)
        || null;
      if (!stored || typeof stored !== "object") continue;
      groupEl.querySelectorAll("[data-key]").forEach(input => {
        const key = input.dataset.key;
        if (stored[key] !== undefined && stored[key] !== null) input.value = stored[key];
      });
    }

    updateAutoStatus(!!data.mcaAutomationActive, data.mcaAutomationStep);
    updateCountsAndValidate();
  }

  function showBanner(msg) {
    const banner = $("errorBanner");
    banner.textContent = msg;
    banner.style.display = "block";
    banner.style.background = "#f1f1f1"; banner.style.color = "#222"; banner.style.border = "1px solid #d5d5d5";
    setTimeout(() => { banner.style.display = "none"; banner.style.background = ""; banner.style.color = ""; banner.style.border = ""; }, 4000);
  }

  // ── Save Draft (persist per-form data silently) ──
  async function persistCurrentForm() {
    const form = formTypeSelect.value;
    if (!form || !FORM_GROUPS[form]) return;
    const formData = gatherFormData();
    const toSet = {
      [`mcaFormData_${form}`]: formData,
      mcaSelectedForm: form,
      mcaFormData: formData,
    };
    await new Promise(resolve => chrome.storage.local.set(toSet, resolve));
    await new Promise(resolve => chrome.runtime.sendMessage({
      action: "SAVE_CREDENTIALS",
      username: mcaUsernameInput.value.trim(),
      password: mcaPasswordInput.value,
      autoLogin: true,
      autoFillForms: true,
    }, resolve));
  }

  if (btnSaveDraft) {
    btnSaveDraft.addEventListener("click", async () => {
      if (!formTypeSelect.value) {
        showError("Choose a form first");
        if (formGrid) {
          formGrid.classList.add("shake");
          setTimeout(() => formGrid.classList.remove("shake"), 400);
        }
        return;
      }
      clearError(); showSpinner(true);
      await persistCurrentForm();
      showSpinner(false);
      showBanner("Draft saved locally.");
    });
  }

  // Legacy handlers still work (hidden buttons) — persist/clear
  if (btnSaveAllData) {
    btnSaveAllData.addEventListener("click", async () => {
      clearError(); showSpinner(true);
      await persistCurrentForm();
      showSpinner(false);
      showBanner("All data saved locally.");
    });
  }
  if (btnClearAllData) {
    btnClearAllData.addEventListener("click", async () => {
      clearError(); showSpinner(true);
      mcaUsernameInput.value = "";
      mcaPasswordInput.value = "";
      Object.values(FORM_GROUPS).forEach(id => {
        const el = $(id);
        if (!el) return;
        el.querySelectorAll("[data-key]").forEach(input => {
          if (input.tagName === "SELECT") input.selectedIndex = 0;
          else input.value = "";
        });
      });
      const removeKeys = ["mcaSelectedForm", "mcaFormData", "mcaAutomationActive", "mcaAutomationStep",
        ...Object.keys(FORM_GROUPS).map(f => `mcaFormData_${f}`)];
      await Promise.all([
        new Promise(resolve => chrome.runtime.sendMessage({ action: "CLEAR_CREDENTIALS" }, resolve)),
        new Promise(resolve => chrome.storage.local.remove(removeKeys, resolve)),
      ]);
      updateAutoStatus(false);
      updateCountsAndValidate();
      showSpinner(false);
    });
  }

  // ── Load & Fill button ──
  function markInvalid(input, label) {
    input.classList.add("field-invalid");
    const fg = input.closest(".field-group");
    if (!fg) return;
    let err = fg.querySelector(".field-error");
    if (!err) {
      err = document.createElement("div");
      err.className = "field-error";
      fg.appendChild(err);
    }
    err.textContent = `Required: ${label}`;
  }
  function clearInvalidMarks() {
    document.querySelectorAll(".field-invalid").forEach(el => el.classList.remove("field-invalid"));
    document.querySelectorAll(".field-error").forEach(el => el.remove());
    cdsErrorBanner.style.display = "none";
    cdsErrorBanner.textContent = "";
  }

  async function startLoadAndFill() {
   try {
    clearError();
    clearInvalidMarks();

    if (!formTypeSelect.value || !FORM_GROUPS[formTypeSelect.value]) {
      try { toast && toast.warning("Choose a form first", { dedupeKey: "no-form" }); } catch (_) {}
      showError("Choose a form first");
      if (formGrid) {
        formGrid.classList.add("shake");
        setTimeout(() => formGrid.classList.remove("shake"), 400);
      }
      return;
    }
    const username = mcaUsernameInput.value.trim();
    const password = mcaPasswordInput.value;
    if (!username || !password) {
      try { toast && toast.warning("Enter both Login ID and Password", { dedupeKey: "no-creds" }); } catch (_) {}
      showError("Enter both Login ID and Password");
      return;
    }

    // Validate required fields
    const required = requiredFieldsInVisible();
    const missing = required.filter(({ input }) => !String(input.value || "").trim());
    if (missing.length) {
      missing.forEach(({ input, label }) => markInvalid(input, label));
      cdsErrorBanner.style.display = "";
      cdsErrorBanner.innerHTML = `<strong>Missing required fields:</strong> ${missing.map(m => m.label).join(", ")}`;
      try { toast && toast.warning(`${missing.length} required field${missing.length === 1 ? "" : "s"} missing`, { dedupeKey: "req-missing" }); } catch (_) {}
      return;
    }

    const formData = gatherFormData();

    // Persist per-form + active copy
    await new Promise(resolve => chrome.storage.local.set({
      [`mcaFormData_${formTypeSelect.value}`]: formData,
      mcaSelectedForm: formTypeSelect.value,
      mcaFormData: formData,
    }, resolve));

    // Switch button to progress state
    btnLoadFill.classList.add("btn-loadfill-progress");
    const label = btnLoadFill.querySelector(".btn-loadfill-label");
    if (label) label.textContent = "Fill in progress";
    btnLoadFill.disabled = true;
    resetStepper();
    renderStepper("open_mca", "active");

    showSpinner(true);
    const res = await new Promise(resolve =>
      chrome.runtime.sendMessage({
        action: "START_AUTOMATION",
        username,
        password,
        formType: formTypeSelect.value,
        formData,
      }, resolve)
    );
    showSpinner(false);

    if (res?.ok) {
      updateAutoStatus(true, { step: "open_mca", status: "active", startedAt: Date.now() });
      try { toast && toast.info("Automation started. Opening MCA portal…", { dedupeKey: "auto-start" }); } catch (_) {}
    } else {
      const errMsg = res?.error || "Could not start automation";
      try {
        errorHandler(new Error(errMsg), { source: "popup", op: "startLoadAndFill", severity: "error", code: "E-OPEN-01" });
      } catch (_) { showError(errMsg); }
      btnLoadFill.classList.remove("btn-loadfill-progress");
      if (label) label.textContent = "Load & Fill";
      btnLoadFill.disabled = false;
      renderStepper("open_mca", "error", errMsg, { code: "E-OPEN-01", message: errMsg, hint: ERROR_CATALOG["E-OPEN-01"].hint });
    }
   } catch (e) {
    try { errorHandler(e, { source: "popup", op: "startLoadAndFill", severity: "error" }); } catch (_) { showError(extractMessage(e)); }
    try {
      btnLoadFill.classList.remove("btn-loadfill-progress");
      const label2 = btnLoadFill.querySelector(".btn-loadfill-label");
      if (label2) label2.textContent = "Load & Fill";
      btnLoadFill.disabled = false;
    } catch (_) {}
   }
  }

  if (btnLoadFill) btnLoadFill.addEventListener("click", startLoadAndFill);
  if (btnRunAutomation) btnRunAutomation.addEventListener("click", startLoadAndFill);
  if (btnRetryAuto) btnRetryAuto.addEventListener("click", startLoadAndFill);

  // ── Stop automation ──
  btnStopAuto.addEventListener("click", async () => {
    clearError(); showSpinner(true);
    await new Promise(resolve =>
      chrome.runtime.sendMessage({ action: "STOP_AUTOMATION" }, resolve)
    );
    updateAutoStatus(false);
    showSpinner(false);
    showBanner("Automation stopped.");
  });

  // ══════════════════════════ End Automation Tab ══════════════════════════

  // ── Init — also load automation data ──
  async function initLogin() {
    await loadSavedFormData();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ═════════════════════ v2 UI polish — Automation ═════════════════════
  // ═══════════════════════════════════════════════════════════════════════

  // Form metadata — short name, full name, category, icon, color
  const FORM_META = {
    aoc4: {
      short: "AOC-4", full: "Financial Statement Filing",
      category: "annual-filings", categoryLabel: "Annual Filings",
    },
    aoc4_offline: {
      short: "AOC-4 Offline", full: "Financial Statement Filing (Offline)",
      category: "annual-filings", categoryLabel: "Annual Filings",
    },
    mgt7: {
      short: "MGT-7", full: "Annual Return",
      category: "annual-filings", categoryLabel: "Annual Filings",
    },
    spice_a: {
      short: "SPICe+ Part A", full: "Company Name Reservation",
      category: "incorporation", categoryLabel: "Incorporation",
    },
    inc32: {
      short: "INC-32", full: "Company Incorporation",
      category: "incorporation", categoryLabel: "Incorporation",
    },
    dir3: {
      short: "DIR-3 KYC", full: "Director Identification KYC",
      category: "kyc", categoryLabel: "KYC",
    },
  };

  // Step metadata — label, manual flag
  const STEP_META = [
    { key: "open_mca",    title: "Open MCA Portal",    manual: false },
    { key: "fill_login",  title: "Fill Credentials",   manual: false },
    { key: "captcha",     title: "Solve CAPTCHA",      manual: true  },
    { key: "otp",         title: "Enter OTP",          manual: true  },
    { key: "detect_form", title: "Detect Form",        manual: false },
    { key: "fill_fields", title: "Auto-fill Fields",   manual: false, progress: true },
    { key: "done",        title: "Complete",           manual: false },
  ];

  // Error catalog — code → { title, hint, severity, steps? }
  const ERROR_CATALOG = {
    "E-OPEN-01":   { title: "Could not open MCA portal",      hint: "Open MCA portal manually, then click Retry.", severity: "error", steps: ["Check network connection.", "Open https://www.mca.gov.in manually.", "Click Retry below."] },
    "E-LOGIN-02":  { title: "Login failed",                   hint: "Credentials rejected — re-enter and retry.", severity: "error" },
    "E-CAPTCHA-03":{ title: "CAPTCHA incorrect",              hint: "Refresh the CAPTCHA image and solve again.", severity: "warning" },
    "E-OTP-04":    { title: "OTP invalid or expired",         hint: "Request a fresh OTP and try again.", severity: "warning" },
    "E-DETECT-05": { title: "Form not detected",              hint: "Confirm the URL opened the expected eForm.", severity: "error" },
    "E-FILL-06":   { title: "No fields matched",              hint: "Check the client data profile covers this form.", severity: "error" },
    "E-BRIDGE-07": { title: "Extension bridge timed out",     hint: "Reload the MCA tab and try again.", severity: "critical", steps: ["Reload the MCA tab (Ctrl+R).", "Confirm the Ledgerly extension is enabled on mca.gov.in.", "Click Retry below."] },
    "E-AUTH-08":   { title: "Not signed in to Ledgerly",      hint: "Reconnect from the top of the popup.", severity: "warning" },
    "E-NET-09":    { title: "Network error",                  hint: "Check connectivity and retry.", severity: "error" },
    "E-UNK-00":    { title: "Unexpected error",               hint: "Open logs for details.", severity: "error" },
  };

  function normalizeStatus(status) {
    if (!status) return "pending";
    if (status === "completed") return "done";
    if (["pending", "active", "done", "error", "skipped"].includes(status)) return status;
    return "pending";
  }

  function deriveStageFromStep(active, stepData) {
    if (!stepData || !stepData.step) return active ? "loading" : "idle";
    const st = normalizeStatus(stepData.status);
    if (st === "error") return "error";
    if (stepData.step === "done" && st === "done") return "done";
    if (stepData.step === "captcha" || stepData.step === "otp") return st === "active" ? "waiting" : "loading";
    if (stepData.step === "fill_fields") return st === "active" ? "active" : "loading";
    if (!active) return "idle";
    return "loading";
  }

  // ── v2 DOM refs ──
  const elCategoryBadgeWrap = $("elCategoryBadgeWrap");
  const elCategoryBadge     = $("elCategoryBadge");
  const elCategoryBadgeShort= $("elCategoryBadgeShort");
  const elCategoryBadgeFull = $("elCategoryBadgeFull");
  const elCategoryBadgeCategoryChip = $("elCategoryBadgeCategoryChip");
  const elCategoryBadgeStage= $("elCategoryBadgeStage");
  const elCategoryBadgeChange = $("elCategoryBadgeChange");
  const elClientDataCard    = $("elClientDataCard");
  const elCdcardHeader      = $("elCdcardHeader");
  const elCdcardAvatarInitials = $("elCdcardAvatarInitials");
  const elCdcardName        = $("elCdcardName");
  const elCdcardSourceBadge = $("elCdcardSourceBadge");
  const elCdcardCin         = $("elCdcardCin");
  const elCdcardFy          = $("elCdcardFy");
  const elCdcardLoadedAt    = $("elCdcardLoadedAt");
  const elCdcardRingFill    = $("elCdcardRingFill");
  const elCdcardFilled      = $("elCdcardFilled");
  const elCdcardTotal       = $("elCdcardTotal");
  const elCdcardToggle      = $("elCdcardToggle");
  const elCdcardBody        = $("elCdcardBody");
  const elCdcardGroups      = $("elCdcardGroups");
  const elCdcardEdit        = $("elCdcardEdit");
  const elCdcardReload      = $("elCdcardReload");
  const elCdcardClear       = $("elCdcardClear");
  const elTimeline          = $("elTimeline");
  const elAutoClock         = $("elAutoClock");
  const elAutoClockText     = $("elAutoClockText");
  const elLogDrawer         = $("elLogDrawer");
  const elLogDrawerToggle   = $("elLogDrawerToggle");
  const elLogDrawerCount    = $("elLogDrawerCount");
  const elLogDrawerList     = $("elLogDrawerList");
  const elLogDrawerFooter   = $("elLogDrawerFooter");
  const elLogDrawerCopy     = $("elLogDrawerCopy");
  const elLogDrawerClear    = $("elLogDrawerClear");
  const elToastRegion       = $("elToastRegion");
  const elCriticalErrorRegion = $("elCriticalErrorRegion");
  const elErrorPanelCode    = $("elErrorPanelCode");
  const elErrorPanelTitle   = $("elErrorPanelTitle");
  const elErrorPanelDesc    = $("elErrorPanelDesc");
  const elErrorPanelSteps   = $("elErrorPanelSteps");
  const elErrorPanelRetry   = $("elErrorPanelRetry");
  const elErrorPanelReport  = $("elErrorPanelReport");
  const elErrorPanelLogs    = $("elErrorPanelLogs");
  const elErrorPanelDismiss = $("elErrorPanelDismiss");

  // ── Category badge ──
  function updateCategoryBadge(formKey, stage, detail) {
    if (!elCategoryBadge) return;
    const meta = formKey && FORM_META[formKey];
    if (!meta) {
      elCategoryBadge.setAttribute("data-form", "");
      elCategoryBadge.setAttribute("data-category", "");
      if (elCategoryBadgeShort) elCategoryBadgeShort.textContent = "Select a form";
      if (elCategoryBadgeFull)  elCategoryBadgeFull.textContent  = "Choose from grid below";
      if (elCategoryBadgeCategoryChip) {
        elCategoryBadgeCategoryChip.textContent = "";
        elCategoryBadgeCategoryChip.hidden = true;
      }
      setBadgeStage("idle", "Ready");
      return;
    }
    elCategoryBadge.setAttribute("data-form", formKey);
    elCategoryBadge.setAttribute("data-category", meta.category);
    if (elCategoryBadgeShort) elCategoryBadgeShort.textContent = meta.short;
    if (elCategoryBadgeFull)  elCategoryBadgeFull.textContent  = meta.full;
    if (elCategoryBadgeCategoryChip) {
      elCategoryBadgeCategoryChip.textContent = meta.categoryLabel;
      elCategoryBadgeCategoryChip.hidden = false;
    }
    if (stage) setBadgeStage(stage, detail || stageDefaultLabel(stage));
    else if (!elCategoryBadge.getAttribute("data-stage")) setBadgeStage("idle", "Ready to fill");
  }
  function setBadgeStage(stage, text) {
    if (!elCategoryBadgeStage) return;
    elCategoryBadge.setAttribute("data-stage", stage);
    elCategoryBadgeStage.setAttribute("data-stage", stage);
    const textEl = elCategoryBadgeStage.querySelector(".cat-badge__stage-text");
    if (textEl) textEl.textContent = text || stageDefaultLabel(stage);
  }
  function stageDefaultLabel(stage) {
    return ({ idle: "Ready to fill", loading: "Loading…", active: "Auto-filling…", waiting: "Waiting for user", error: "Error — see details", done: "Complete" }[stage] || "Ready");
  }

  // Change button scrolls to form grid + pulses active card
  if (elCategoryBadgeChange) {
    elCategoryBadgeChange.addEventListener("click", () => {
      try {
        const grid = $("formGrid");
        if (grid && grid.scrollIntoView) grid.scrollIntoView({ behavior: "smooth", block: "center" });
        const active = document.querySelector(".form-card-active");
        if (active) {
          active.classList.add("form-card-pulse");
          setTimeout(() => active.classList.remove("form-card-pulse"), 650);
        }
      } catch (_) {}
    });
  }

  // ── Client Data Card ──
  function hydrateClientDataCard() {
    if (!elClientDataCard) return;
    chrome.storage.local.get(
      ["mcaCurrentClientInfo", "mcaAdminClientInfo", "mcaAdminLoadedAt", "mcaFieldCompletion", "mcaSelectedForm"],
      (data) => {
        try {
          const info = data.mcaCurrentClientInfo
            || (data.mcaAdminClientInfo ? deriveCurrentFromAdmin(data.mcaAdminClientInfo, data.mcaAdminLoadedAt) : null);
          const comp = data.mcaFieldCompletion || { total: 0, filled: 0, byCategory: {} };

          if (!info) {
            elClientDataCard.setAttribute("data-state", "empty");
            elClientDataCard.setAttribute("data-source", "manual");
            if (elCdcardAvatarInitials) elCdcardAvatarInitials.textContent = "—";
            if (elCdcardName) elCdcardName.textContent = "No client data loaded";
            if (elCdcardSourceBadge) elCdcardSourceBadge.hidden = true;
            if (elCdcardCin) elCdcardCin.textContent = "—";
            if (elCdcardFy) elCdcardFy.textContent = "—";
            if (elCdcardLoadedAt) elCdcardLoadedAt.textContent = "—";
          } else {
            elClientDataCard.setAttribute("data-source", info.source || "manual");
            if (elCdcardAvatarInitials) elCdcardAvatarInitials.textContent = getInitials(info.name);
            if (elCdcardName) elCdcardName.textContent = info.name || "—";
            if (elCdcardSourceBadge) {
              elCdcardSourceBadge.hidden = false;
              elCdcardSourceBadge.setAttribute("data-source", info.source || "manual");
              elCdcardSourceBadge.textContent = sourceLabel(info.source);
            }
            if (elCdcardCin) elCdcardCin.textContent = info.cin || "—";
            if (elCdcardFy) elCdcardFy.textContent = info.financialYear || "—";
            if (elCdcardLoadedAt) {
              elCdcardLoadedAt.textContent = info.loadedAt ? formatRelativeTime(info.loadedAt) : "—";
              elCdcardLoadedAt.title = info.loadedAt ? new Date(info.loadedAt).toLocaleString() : "";
            }
            if (elClientDataCard.getAttribute("data-state") === "empty") {
              elClientDataCard.setAttribute("data-state", "collapsed");
            }
          }

          // Progress ring
          const pct = comp.total > 0 ? Math.round((comp.filled / comp.total) * 100) : 0;
          if (elCdcardRingFill) elCdcardRingFill.setAttribute("stroke-dasharray", `${pct},100`);
          if (elCdcardFilled) elCdcardFilled.textContent = String(comp.filled || 0);
          if (elCdcardTotal) elCdcardTotal.textContent = String(comp.total || 0);
          const level = pct >= 100 ? "full" : pct >= 67 ? "high" : pct >= 34 ? "mid" : "low";
          elClientDataCard.setAttribute("data-ring-level", level);

          renderClientDataGroups(comp.byCategory);
        } catch (e) {
          try { errorHandler(e, { source: "popup", op: "hydrateClientDataCard", severity: "warning", silent: true }); } catch (_) {}
        }
      }
    );
  }
  function deriveCurrentFromAdmin(adminInfo, loadedAt) {
    if (!adminInfo || typeof adminInfo !== "object") return null;
    return {
      name: adminInfo.name || adminInfo.clientName || "—",
      cin: adminInfo.cin || adminInfo.clientId || "",
      financialYear: adminInfo.financialYear || adminInfo.fy || "",
      source: "admin",
      loadedAt: loadedAt || Date.now(),
    };
  }
  function sourceLabel(src) {
    return ({ dashboard: "Dashboard", admin: "Admin", manual: "Manual", draft: "Saved draft" }[src] || "Manual");
  }
  function getInitials(name) {
    if (!name) return "—";
    const parts = String(name).trim().split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]).join("").toUpperCase() || "—";
  }
  function renderClientDataGroups(byCategory) {
    if (!elCdcardGroups) return;
    if (!byCategory || typeof byCategory !== "object") {
      elCdcardGroups.innerHTML = "";
      return;
    }
    const entries = Object.entries(byCategory);
    if (!entries.length) { elCdcardGroups.innerHTML = ""; return; }
    elCdcardGroups.innerHTML = entries.map(([name, counts]) => {
      const total = counts.total || 0;
      const filled = counts.filled || 0;
      const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
      const status = total === 0 ? "empty" : filled === total ? "complete" : filled === 0 ? "empty" : "partial";
      return `<li class="cdcard__group" data-group="${escHtml(name)}" data-status="${status}">
        <span class="cdcard__group-icon" aria-hidden="true">•</span>
        <span class="cdcard__group-label">${escHtml(name)}</span>
        <span class="cdcard__group-counts"><b>${filled}</b>/${total}</span>
        <span class="cdcard__group-status"></span>
        <span class="cdcard__group-bar"><span class="cdcard__group-bar-fill" style="width:${pct}%"></span></span>
      </li>`;
    }).join("");
  }

  function recomputeFieldCompletion(formKey) {
    const key = formKey || formTypeSelect.value;
    if (!key || !FORM_GROUPS[key]) return;
    const groupEl = $(FORM_GROUPS[key]);
    if (!groupEl) return;
    // Walk children; each tools-heading starts a new section
    let currentSection = "General";
    const byCategory = {};
    let total = 0, filled = 0;
    const walker = groupEl.children;
    for (const node of walker) {
      if (node.classList && node.classList.contains("tools-heading")) {
        const span = node.querySelector("span:not(.tools-rule):not(.cds-cat-icon)");
        if (span) currentSection = span.textContent.trim();
        if (!byCategory[currentSection]) byCategory[currentSection] = { total: 0, filled: 0 };
      } else if (node.classList && node.classList.contains("field-group")) {
        const input = node.querySelector("[data-key]");
        if (!input) continue;
        if (!byCategory[currentSection]) byCategory[currentSection] = { total: 0, filled: 0 };
        byCategory[currentSection].total++;
        total++;
        if (String(input.value || "").trim()) {
          byCategory[currentSection].filled++;
          filled++;
        }
      }
    }
    const comp = { total, filled, byCategory };
    try {
      chrome.storage.local.set({ mcaFieldCompletion: comp });
    } catch (_) {}
    return comp;
  }

  // Expand/collapse
  function toggleCdcard() {
    if (!elClientDataCard) return;
    const state = elClientDataCard.getAttribute("data-state");
    if (state === "empty") return;
    const expanded = state === "expanded";
    elClientDataCard.setAttribute("data-state", expanded ? "collapsed" : "expanded");
    if (elCdcardHeader) elCdcardHeader.setAttribute("aria-expanded", expanded ? "false" : "true");
    if (elCdcardBody) elCdcardBody.hidden = expanded;
  }
  if (elCdcardHeader) {
    elCdcardHeader.addEventListener("click", toggleCdcard);
    elCdcardHeader.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleCdcard(); } });
  }
  if (elCdcardToggle) elCdcardToggle.addEventListener("click", (e) => { e.stopPropagation(); toggleCdcard(); });
  if (elCdcardEdit) elCdcardEdit.addEventListener("click", () => {
    try {
      const groupEl = visibleGroupEl();
      if (groupEl) {
        groupEl.scrollIntoView({ behavior: "smooth", block: "start" });
        const first = groupEl.querySelector("[data-key]");
        if (first) first.focus();
      }
    } catch (_) {}
  });
  if (elCdcardReload) elCdcardReload.addEventListener("click", () => {
    toast.info("Reloading from Dashboard…", { duration: 2500 });
    try { chrome.runtime.sendMessage({ action: "RELOAD_FROM_ADMIN" }, () => { const _ = chrome.runtime.lastError; }); } catch (_) {}
  });
  if (elCdcardClear) elCdcardClear.addEventListener("click", () => {
    if (clearDialog) clearDialog.style.display = "flex";
  });

  // Loaded-at relative refresh
  let loadedAtTimer = null;
  function refreshLoadedAt() {
    if (!elCdcardLoadedAt) return;
    chrome.storage.local.get(["mcaAdminLoadedAt", "mcaCurrentClientInfo"], (data) => {
      const ts = (data.mcaCurrentClientInfo && data.mcaCurrentClientInfo.loadedAt) || data.mcaAdminLoadedAt;
      if (ts) {
        elCdcardLoadedAt.textContent = formatRelativeTime(ts);
        elCdcardLoadedAt.title = new Date(ts).toLocaleString();
      }
    });
  }

  function formatRelativeTime(ts) {
    if (!ts) return "—";
    const diff = Math.max(0, Date.now() - ts);
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    const d = new Date(ts);
    const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
    return `${d.getDate()} ${m} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }

  // ── Live Timeline ──
  function renderLiveTimeline(stepData) {
    if (!elTimeline) return;
    const step = stepData && stepData.step;
    const status = normalizeStatus(stepData && stepData.status);
    const activeIdx = STEP_META.findIndex(s => s.key === step);
    const now = Date.now();
    elTimeline.innerHTML = STEP_META.map((meta, idx) => {
      let state = "pending";
      if (status === "error" && meta.key === step) state = "error";
      else if (activeIdx === -1) state = "pending";
      else if (idx < activeIdx) state = "done";
      else if (idx === activeIdx) state = (status === "done" ? "done" : status === "error" ? "error" : "active");
      else state = "pending";

      const chip = meta.manual ? `<span class="timeline__chip timeline__chip--manual">You</span>` : "";
      let sub = "";
      let timeTxt = "";
      let errHtml = "";
      if (idx === activeIdx) {
        if (stepData && stepData.startedAt) timeTxt = formatRelativeTime(stepData.startedAt);
        if (stepData && (stepData.detail || stepData.message)) sub = escHtml(stepData.detail || stepData.message);
        if (state === "error") {
          const err = stepData.error || { code: "E-UNK-00", message: stepData.message || "Unknown error", hint: "" };
          const catEntry = ERROR_CATALOG[err.code] || ERROR_CATALOG["E-UNK-00"];
          errHtml = `
            <div class="timeline__error">
              <svg class="timeline__error-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2L2 20h20L12 2zM12 10v5M12 18v.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
              <div class="timeline__error-text">
                <b class="timeline__error-code">${escHtml(err.code || "E-UNK-00")}</b>
                <span class="timeline__error-msg">${escHtml(err.message || catEntry.title)}</span>
                <span class="timeline__error-hint">${escHtml(err.hint || catEntry.hint || "")}</span>
              </div>
              <button class="timeline__error-retry" type="button" data-step="${escHtml(meta.key)}">Retry step</button>
            </div>
          `;
        }
      } else if (idx < activeIdx) {
        sub = "Done";
      }

      return `
        <li class="timeline__step" data-step="${escHtml(meta.key)}" data-state="${state}">
          <div class="timeline__rail" aria-hidden="true">
            <div class="timeline__connector timeline__connector--up"></div>
            <div class="timeline__node">
              <svg class="timeline__icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>
            </div>
            <div class="timeline__connector timeline__connector--down"></div>
          </div>
          <div class="timeline__content">
            <div class="timeline__title-row">
              <span class="timeline__title">${escHtml(meta.title)}</span>
              ${chip}
              <span class="timeline__time">${escHtml(timeTxt)}</span>
            </div>
            <div class="timeline__sub">${sub}</div>
            ${meta.progress && state === "active" ? '<div class="timeline__bar"><div class="timeline__bar-fill"></div></div>' : ""}
            ${errHtml}
          </div>
        </li>
      `;
    }).join("");

    // wire error-step retry buttons
    elTimeline.querySelectorAll(".timeline__error-retry").forEach(btn => {
      btn.addEventListener("click", () => {
        const stepKey = btn.getAttribute("data-step");
        try { chrome.runtime.sendMessage({ action: "RETRY_AUTOMATION_STEP", step: stepKey }, () => { const _ = chrome.runtime.lastError; }); } catch (_) {}
        try { retryLastOp("startLoadAndFill"); } catch (_) {}
      });
    });
  }

  // ── Elapsed clock ──
  let elapsedTimer = null;
  function startElapsedClock(startAt) {
    if (!elAutoClock || !elAutoClockText) return;
    elAutoClock.hidden = false;
    stopElapsedClock();
    const baseline = startAt || Date.now();
    const tick = () => {
      const diff = Math.max(0, Math.floor((Date.now() - baseline) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      elAutoClockText.textContent = h > 0
        ? `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
        : `${m}:${String(s).padStart(2,"0")}`;
    };
    tick();
    elapsedTimer = setInterval(tick, 1000);
  }
  function stopElapsedClock() {
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
    if (elAutoClock) elAutoClock.hidden = true;
  }

  // ── Log drawer ──
  function renderLogDrawer() {
    if (!elLogDrawerList) return;
    chrome.storage.local.get(["mcaAutomationLogs"], (data) => {
      try {
        const logs = Array.isArray(data.mcaAutomationLogs) ? data.mcaAutomationLogs : [];
        if (elLogDrawerCount) elLogDrawerCount.textContent = String(logs.length);
        elLogDrawerList.innerHTML = logs.slice(0, 100).map(logEntryHtml).join("");
      } catch (_) {}
    });
  }
  function prependLogEntry(entry) {
    if (!entry) return;
    if (elLogDrawerCount) {
      const n = parseInt(elLogDrawerCount.textContent, 10) || 0;
      elLogDrawerCount.textContent = String(Math.min(100, n + 1));
    }
    if (elLogDrawerList) {
      const tmp = document.createElement("template");
      tmp.innerHTML = logEntryHtml(entry);
      elLogDrawerList.prepend(tmp.content.firstElementChild);
      while (elLogDrawerList.children.length > 100) elLogDrawerList.removeChild(elLogDrawerList.lastChild);
    }
  }
  function logEntryHtml(entry) {
    const t = entry.at ? new Date(entry.at) : new Date();
    const time = `${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}:${String(t.getSeconds()).padStart(2,"0")}`;
    const level = (entry.level || "info").toLowerCase();
    return `<li class="log-entry" data-level="${escHtml(level)}">
      <span class="log-entry__time">${time}</span>
      <span class="log-entry__level log-entry__level--${escHtml(level)}">${escHtml(level)}</span>
      <span class="log-entry__source">${escHtml(entry.source || "popup")}</span>
      <span class="log-entry__msg">${escHtml(entry.message || "")}</span>
    </li>`;
  }
  function openLogDrawer() {
    if (!elLogDrawer) return;
    elLogDrawer.setAttribute("data-state", "expanded");
    if (elLogDrawerToggle) elLogDrawerToggle.setAttribute("aria-expanded", "true");
    if (elLogDrawerList) elLogDrawerList.hidden = false;
    if (elLogDrawerFooter) elLogDrawerFooter.hidden = false;
    renderLogDrawer();
    try { elLogDrawer.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (_) {}
  }
  function closeLogDrawer() {
    if (!elLogDrawer) return;
    elLogDrawer.setAttribute("data-state", "collapsed");
    if (elLogDrawerToggle) elLogDrawerToggle.setAttribute("aria-expanded", "false");
    if (elLogDrawerList) elLogDrawerList.hidden = true;
    if (elLogDrawerFooter) elLogDrawerFooter.hidden = true;
  }
  if (elLogDrawerToggle) {
    elLogDrawerToggle.addEventListener("click", () => {
      const expanded = elLogDrawer.getAttribute("data-state") === "expanded";
      expanded ? closeLogDrawer() : openLogDrawer();
    });
  }
  if (elLogDrawerCopy) elLogDrawerCopy.addEventListener("click", () => {
    chrome.storage.local.get(["mcaAutomationLogs"], (data) => {
      const logs = Array.isArray(data.mcaAutomationLogs) ? data.mcaAutomationLogs : [];
      const text = logs.map(e => {
        const d = e.at ? new Date(e.at) : new Date();
        const time = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
        return `${time} [${(e.level||"info").toUpperCase()}] ${e.source||"popup"}: ${e.message||""}`;
      }).join("\n");
      try {
        navigator.clipboard.writeText(text).then(() => toast.info("Logs copied"));
      } catch (_) {}
    });
  });
  if (elLogDrawerClear) elLogDrawerClear.addEventListener("click", () => {
    chrome.storage.local.set({ mcaAutomationLogs: [] }, () => {
      renderLogDrawer();
      toast.info("Logs cleared");
    });
  });

  // ── Toast system ──
  let toastSeq = 0;
  const toastQueue = [];
  const toastDurations = { info: 4000, success: 4000, warning: 7000, error: 0, critical: 0 };
  const toast = {
    info:    (msg, opts) => renderToast("info", msg, opts),
    success: (msg, opts) => renderToast("success", msg, opts),
    warning: (msg, opts) => renderToast("warning", msg, opts),
    error:   (msg, opts) => renderToast("error", msg, opts),
    critical:(msg, opts) => renderToast("critical", msg, opts),
    dismiss: (id) => dismissToast(id),
  };
  function toastIcon(level) {
    const icons = {
      info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8h.01M11 12h1v4h1" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
      success: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12l3 3 5-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      warning: '<svg viewBox="0 0 24 24"><path d="M12 3L2 20h20L12 3zM12 10v5M12 18v.01" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      error: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
      critical: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 7v6M12 17v.01" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>',
    };
    return icons[level] || icons.info;
  }
  function renderToast(level, msg, opts) {
    if (!elToastRegion) return null;
    opts = opts || {};
    // dedupe
    if (opts.dedupeKey) {
      const existing = elToastRegion.querySelector(`[data-dedupe-key="${CSS.escape(opts.dedupeKey)}"]`);
      if (existing) {
        const msgEl = existing.querySelector(".toast__msg");
        if (msgEl) msgEl.textContent = msg;
        return existing.getAttribute("data-id");
      }
    }
    // enforce max 4
    while (elToastRegion.children.length >= 4) {
      const first = elToastRegion.firstElementChild;
      if (first) dismissToast(first.getAttribute("data-id"));
      else break;
    }
    const id = "t_" + (++toastSeq);
    const duration = opts.duration != null ? opts.duration : toastDurations[level];
    const title = opts.title || "";
    const actionsHtml = (opts.actions || []).map((a, i) =>
      `<button class="toast__action${a.variant === "ghost" ? " toast__action--ghost" : ""}" data-idx="${i}" type="button">${escHtml(a.label)}</button>`
    ).join("");
    const node = document.createElement("div");
    node.className = "toast";
    node.setAttribute("data-level", level);
    node.setAttribute("data-id", id);
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    if (opts.dedupeKey) node.setAttribute("data-dedupe-key", opts.dedupeKey);
    node.innerHTML = `
      <span class="toast__icon" aria-hidden="true">${toastIcon(level)}</span>
      <div class="toast__body">
        ${title ? `<div class="toast__title">${escHtml(title)}</div>` : ""}
        <div class="toast__msg">${escHtml(String(msg || ""))}</div>
        ${actionsHtml ? `<div class="toast__actions">${actionsHtml}</div>` : ""}
      </div>
      <button class="toast__close" type="button" aria-label="Dismiss">×</button>
      ${duration > 0 ? `<div class="toast__timer" style="animation-duration:${duration}ms"></div>` : ""}
    `;
    elToastRegion.appendChild(node);
    node.querySelector(".toast__close").addEventListener("click", () => dismissToast(id));
    if (opts.actions) {
      node.querySelectorAll(".toast__action").forEach(btn => {
        btn.addEventListener("click", () => {
          try {
            const idx = parseInt(btn.getAttribute("data-idx"), 10);
            const act = opts.actions[idx];
            if (act && typeof act.onClick === "function") act.onClick();
          } catch (_) {}
          dismissToast(id);
        });
      });
    }
    if (duration > 0) setTimeout(() => dismissToast(id), duration);
    return id;
  }
  function dismissToast(id) {
    if (!elToastRegion || !id) return;
    const node = elToastRegion.querySelector(`[data-id="${id}"]`);
    if (!node) return;
    node.classList.add("toast--exit");
    setTimeout(() => { try { node.remove(); } catch (_) {} }, 170);
  }
  // Esc dismisses sticky toasts
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!elToastRegion) return;
    const stickies = elToastRegion.querySelectorAll('.toast[data-level="error"], .toast[data-level="critical"]');
    if (stickies.length) dismissToast(stickies[stickies.length - 1].getAttribute("data-id"));
  });

  // ── Error handling ──
  function inferSeverity(err) {
    if (!err) return "error";
    if (err.name === "AuthError") return "warning";
    if (err instanceof TypeError || err instanceof ReferenceError) return "critical";
    const msg = String(err.message || err || "").toLowerCase();
    if (msg.includes("timeout") || msg.includes("timed out")) return "error";
    if (msg.includes("network") || msg.includes("fetch")) return "error";
    return "error";
  }
  function mapErrorToCode(err) {
    const msg = String((err && err.message) || err || "").toLowerCase();
    if (!msg) return "E-UNK-00";
    if (msg.includes("bridge") || msg.includes("receiving end")) return "E-BRIDGE-07";
    if (msg.includes("open") && msg.includes("mca")) return "E-OPEN-01";
    if (msg.includes("auth") || msg.includes("sign in") || msg.includes("token")) return "E-AUTH-08";
    if (msg.includes("captcha")) return "E-CAPTCHA-03";
    if (msg.includes("otp")) return "E-OTP-04";
    if (msg.includes("no fields matched") || msg.includes("field")) return "E-FILL-06";
    if (msg.includes("form") && (msg.includes("not") || msg.includes("detect"))) return "E-DETECT-05";
    if (msg.includes("network") || msg.includes("fetch")) return "E-NET-09";
    if (msg.includes("timeout")) return "E-BRIDGE-07";
    return "E-UNK-00";
  }
  function extractMessage(err) {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message || err.toString();
    if (err.error) return String(err.error);
    if (err.message) return String(err.message);
    try { return JSON.stringify(err).slice(0, 200); } catch (_) { return String(err).slice(0, 200); }
  }
  function appendLog(entry) {
    try {
      chrome.storage.local.get(["mcaAutomationLogs"], (data) => {
        const logs = Array.isArray(data.mcaAutomationLogs) ? data.mcaAutomationLogs : [];
        logs.unshift(entry);
        if (logs.length > 100) logs.length = 100;
        chrome.storage.local.set({ mcaAutomationLogs: logs });
      });
    } catch (_) {}
    try { prependLogEntry(entry); } catch (_) {}
  }
  function errorHandler(err, context) {
    context = context || {};
    const level = context.severity || inferSeverity(err);
    const code  = context.code || mapErrorToCode(err);
    const message = extractMessage(err);
    const cat = ERROR_CATALOG[code] || ERROR_CATALOG["E-UNK-00"];
    const hint = context.hint || cat.hint || "";

    // 1. Log
    appendLog({
      at: Date.now(),
      level,
      source: context.source || "popup",
      message: `${code}: ${message}`,
      context: { op: context.op, stack: err && err.stack },
    });

    // 2. Toast
    if (!context.silent) {
      try {
        const actions = (level === "error" || level === "critical")
          ? [{ label: "View logs", onClick: openLogDrawer, variant: "ghost" }]
          : undefined;
        toast[level === "critical" ? "critical" : level]
          ? toast[level === "critical" ? "critical" : level](message, { title: cat.title, dedupeKey: code, actions })
          : toast.error(message, { title: cat.title, dedupeKey: code });
      } catch (_) {}
    }

    // 3. Critical panel
    if (level === "critical") {
      try {
        publishCriticalError({
          code, title: cat.title, desc: message,
          steps: cat.steps || [], at: Date.now(), severity: "critical", context,
        });
      } catch (_) {}
    }

    // 4. Never swallow — console
    try { console.error("[errorHandler]", code, err, context); } catch (_) {}
  }
  function wrapAsync(fn, context) {
    return async function (...args) {
      try { return await fn.apply(this, args); }
      catch (e) { errorHandler(e, context || {}); return null; }
    };
  }
  function retryLastOp(op) {
    try {
      if (op === "startLoadAndFill") return startLoadAndFill();
      if (op === "RELOAD_FROM_ADMIN") {
        chrome.runtime.sendMessage({ action: "RELOAD_FROM_ADMIN" }, () => { const _ = chrome.runtime.lastError; });
        return;
      }
      if (op === "RETRY_AUTOMATION") {
        chrome.runtime.sendMessage({ action: "RETRY_AUTOMATION" }, () => { const _ = chrome.runtime.lastError; });
        return;
      }
    } catch (_) {}
  }

  // Critical error panel
  function renderErrorPanel(err) {
    if (!elCriticalErrorRegion) return;
    if (!err) {
      elCriticalErrorRegion.hidden = true;
      return;
    }
    const cat = ERROR_CATALOG[err.code] || ERROR_CATALOG["E-UNK-00"];
    elCriticalErrorRegion.hidden = false;
    if (elErrorPanelCode)  elErrorPanelCode.textContent  = err.code || "E-UNK-00";
    if (elErrorPanelTitle) elErrorPanelTitle.textContent = err.title || cat.title;
    if (elErrorPanelDesc)  elErrorPanelDesc.textContent  = err.desc || "";
    if (elErrorPanelSteps) {
      const steps = Array.isArray(err.steps) ? err.steps : (cat.steps || []);
      elErrorPanelSteps.innerHTML = steps.map(s => `<li>${escHtml(s)}</li>`).join("");
    }
  }
  function publishCriticalError(err) {
    try { chrome.storage.local.set({ mcaCriticalError: err }); } catch (_) {}
    renderErrorPanel(err);
  }
  function clearCriticalError() {
    try { chrome.storage.local.set({ mcaCriticalError: null }); } catch (_) {}
    renderErrorPanel(null);
  }
  if (elErrorPanelRetry) elErrorPanelRetry.addEventListener("click", () => {
    elErrorPanelRetry.disabled = true;
    try { clearCriticalError(); } catch (_) {}
    try { startLoadAndFill(); } catch (e) { errorHandler(e, { source: "popup", op: "errorPanelRetry" }); }
    setTimeout(() => { elErrorPanelRetry.disabled = false; }, 1500);
  });
  if (elErrorPanelReport) elErrorPanelReport.addEventListener("click", () => {
    chrome.storage.local.get(["mcaAutomationLogs", "mcaCriticalError"], (data) => {
      try {
        const logs = (data.mcaAutomationLogs || []).slice(0, 20).map(e => {
          const d = e.at ? new Date(e.at) : new Date();
          const time = d.toISOString();
          return `${time} [${(e.level||"info").toUpperCase()}] ${e.source||"popup"}: ${e.message||""}`;
        }).join("\n");
        const err = data.mcaCriticalError || {};
        const body = `Code: ${err.code}\nTitle: ${err.title}\nTime: ${new Date(err.at || Date.now()).toISOString()}\n\nLast logs:\n${logs}`;
        const mailto = `mailto:?subject=${encodeURIComponent("Ledgerly MCA — "+(err.code||"error"))}&body=${encodeURIComponent(body.slice(0, 2000))}`;
        window.open(mailto, "_blank");
      } catch (_) {}
    });
  });
  if (elErrorPanelLogs) elErrorPanelLogs.addEventListener("click", openLogDrawer);
  if (elErrorPanelDismiss) elErrorPanelDismiss.addEventListener("click", () => {
    if (elCriticalErrorRegion) elCriticalErrorRegion.hidden = true;
  });

  // Global catch-alls
  try {
    window.addEventListener("error", (ev) => {
      try { errorHandler(ev.error || new Error(ev.message || "window.onerror"), { source: "popup", op: "window.onerror", severity: "critical" }); } catch (_) {}
    });
    window.addEventListener("unhandledrejection", (ev) => {
      try { errorHandler(ev.reason || new Error("Unhandled rejection"), { source: "popup", op: "unhandledrejection", severity: "critical" }); } catch (_) {}
    });
  } catch (_) {}

  // Bootstrap v2
  function bootstrapV2() {
    try {
      updateCategoryBadge(formTypeSelect?.value || null, "idle", "Ready");
      hydrateClientDataCard();
      renderLogDrawer();
      renderLiveTimeline(null);
      chrome.storage.local.get(["mcaCriticalError"], (data) => {
        if (data.mcaCriticalError) renderErrorPanel(data.mcaCriticalError);
      });
      if (loadedAtTimer) clearInterval(loadedAtTimer);
      loadedAtTimer = setInterval(refreshLoadedAt, 30000);
    } catch (e) {
      try { errorHandler(e, { source: "popup", op: "bootstrapV2", severity: "warning", silent: true }); } catch (_) {}
    }
  }

  init();
  initLogin().then(bootstrapV2).catch((e) => {
    try { errorHandler(e, { source: "popup", op: "initLogin", severity: "error" }); } catch (_) {}
    bootstrapV2();
  });
})();
