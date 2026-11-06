// Run status card: shows the AOC-4 Offline fill that is running, or the last one that ran.
// The fill runs inside the MCA page and saves its progress to chrome.storage (offlineRun), so the card
// is right even if the side panel was closed and opened again while the fill kept going.

(function (root) {
  "use strict";
  if (root.RunStatus) return;

  const $ = id => document.getElementById(id);
  const STALE_MS = 45000;      // a running fill saves progress every 5 s; silence this long means it is gone
  const STOP_GRACE_MS = 15000; // after Stop, how long to wait for the page to confirm
  let current = null;
  let ticker = null;

  const pad = n => String(n).padStart(2, "0");
  const clock = ms => { const s = Math.max(0, Math.round(ms / 1000)); return pad(Math.floor(s / 60)) + ":" + pad(s % 60); };

  // What to show for a saved state, including fills whose page went away.
  function effective(st) {
    if (!st) return null;
    const age = Date.now() - (st.updatedAt || 0);
    if (st.status === "running" && age > STALE_MS) return Object.assign({}, st, { status: "interrupted", current: "The MCA page stopped reporting (reloaded or closed)" });
    if (st.status === "stopping" && age > STOP_GRACE_MS) return Object.assign({}, st, { status: "stopped", current: "Stopped" });
    return st;
  }

  const CHIP = {
    running: ["Running", "running"], stopping: ["Stopping…", "running"], done: ["Finished", "done"],
    stopped: ["Stopped", "stopped"], error: ["Error", "error"], interrupted: ["Interrupted", "error"],
  };

  function render() {
    const card = $("runCard");
    if (!card) return;
    const st = effective(current);
    if (!st) { card.classList.add("hidden"); stopTicker(); return; }
    card.classList.remove("hidden");
    const live = st.status === "running" || st.status === "stopping";
    const [label, tone] = CHIP[st.status] || ["", ""];
    $("runChip").textContent = label;
    $("runChip").dataset.state = tone;
    $("runCurrent").textContent = st.fatal && !live ? st.fatal : (st.current || "");
    const total = st.total || 0, idx = Math.min(st.index || 0, total);
    $("runFill").style.width = (total ? Math.round((idx / total) * 100) : 0) + "%";
    $("runFill").dataset.pct = st.status === "error" || st.status === "interrupted" ? "skip" : st.status === "stopped" ? "warn" : "ok";
    $("runCount").textContent = idx + " / " + total + " steps";
    const s = st.summary;
    $("runSummary").textContent = s ? [s.filled && s.filled + " filled", s.already && s.already + " already set", s.failed && s.failed + " failed", s.missing && s.missing + " not on page"].filter(Boolean).join(" · ") : "";
    $("runStopBtn").classList.toggle("hidden", !live);
    $("runStopBtn").disabled = st.status === "stopping";
    $("runDismissBtn").classList.toggle("hidden", live);
    tick();
    if (live) startTicker(); else stopTicker();
    if (typeof renderOfflineResults === "function") renderOfflineResults({ results: st.results || [] }, $("runList"));
  }

  function tick() {
    const st = effective(current);
    if (!st) return;
    const live = st.status === "running" || st.status === "stopping";
    $("runElapsed").textContent = clock((live ? Date.now() : st.updatedAt) - (st.startedAt || Date.now()));
  }
  function startTicker() { if (!ticker) ticker = setInterval(() => { tick(); if (!isRunning()) render(); }, 1000); }
  function stopTicker() { clearInterval(ticker); ticker = null; }

  function isRunning() { const st = effective(current); return !!st && (st.status === "running" || st.status === "stopping"); }

  async function tabIdForStop() {
    try { const r = await chrome.storage.local.get("offlineRunTab"); if (r.offlineRunTab) return r.offlineRunTab; } catch (_) { /* fall through */ }
    return typeof getActiveMcaTab === "function" ? ((await getActiveMcaTab()) || {}).id : null;
  }

  async function stop() {
    const id = await tabIdForStop();
    if (id) await root.OfflineEngine.stop(id);
    else await root.OfflineEngine.setState({ status: "stopped", current: "Stopped" });
  }

  async function bind() {
    if (!$("runCard")) return;
    $("runStopBtn").addEventListener("click", stop);
    $("runDismissBtn").addEventListener("click", async () => { await root.OfflineEngine.clearState(); current = null; render(); });
    try { current = await root.OfflineEngine.getState(); } catch (_) { current = null; }
    render();
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes.offlineRun) return;
        current = changes.offlineRun.newValue || null;
        render();
      });
    } catch (_) { /* storage events unavailable */ }
  }

  root.RunStatus = { bind, isRunning };
})(typeof window !== "undefined" ? window : globalThis);
