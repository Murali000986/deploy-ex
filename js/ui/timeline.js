// Live Process Timeline controller — renders a vertical ordered list of
// per-form steps and animates state changes (pending → active → done | error).

(function (root) {
  "use strict";
  if (root.Timeline) return;

  let currentForm = "aoc4";
  let startedAt = 0;
  let clockTimer = null;
  let activeStepId = null;
  let stepTimings = {};

  function fmt(ms) {
    if (!ms || ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return mm + ":" + ss;
  }

  function stopClock() {
    if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
  }

  function startClock() {
    stopClock();
    startedAt = startedAt || Date.now();
    clockTimer = setInterval(function () {
      const el = document.getElementById("tlClock");
      if (el) el.textContent = fmt(Date.now() - startedAt);
      // Also update elapsed on the active step.
      if (activeStepId) {
        const sub = document.querySelector('.tl-step[data-step="' + activeStepId + '"] .tl-elapsed');
        if (sub) sub.textContent = fmt(Date.now() - (stepTimings[activeStepId] || Date.now()));
      }
    }, 1000);
  }

  function render(formType) {
    currentForm = formType || "aoc4";
    const forms = root.FORMS || {};
    const def = forms[currentForm];
    if (!def) return;
    const ol = document.getElementById("timeline");
    if (!ol) return;
    ol.innerHTML = "";
    for (const phase of def.phases) {
      const li = document.createElement("li");
      li.className = "tl-step pending";
      li.dataset.step = phase.id;
      li.innerHTML =
        '<span class="tl-ico"></span>' +
        '<div class="tl-body">' +
          '<div class="tl-label">' + escapeHtml(phase.label) + '</div>' +
          '<div class="tl-sub">Pending</div>' +
        '</div>';
      ol.appendChild(li);
    }
    activeStepId = null;
    startedAt = 0;
    stepTimings = {};
    const clock = document.getElementById("tlClock");
    if (clock) clock.textContent = "00:00";
    stopClock();
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function update(stepId, patch) {
    if (!stepId) return;
    const li = document.querySelector('.tl-step[data-step="' + stepId + '"]');
    if (!li) return;
    const state = patch && patch.state;
    const sub = patch && patch.sub;
    const ts = patch && patch.ts;

    if (state) {
      li.classList.remove("pending", "active", "done", "error");
      li.classList.add(state);
      const ico = li.querySelector(".tl-ico");
      if (ico) {
        // Glyphs (check / alert / pending dot) are drawn in CSS from the icon classes.
        ico.className = "tl-ico" + (state === "active" ? " tl-spin" : state === "done" ? " i-check" : state === "error" ? " i-alert" : "");
      }
      if (state === "active") {
        activeStepId = stepId;
        if (!startedAt) startedAt = Date.now();
        stepTimings[stepId] = Date.now();
        startClock();
      } else if (state === "done") {
        const subEl = li.querySelector(".tl-sub");
        const elapsed = Date.now() - (stepTimings[stepId] || Date.now());
        if (subEl && !sub) subEl.textContent = "Done in " + fmt(elapsed);
      } else if (state === "error") {
        activeStepId = null;
      }
      if (state !== "active") stopClock();
    }
    if (sub) {
      const subEl = li.querySelector(".tl-sub");
      if (subEl) subEl.textContent = sub;
    }
    if (ts) {
      const tsEl = li.querySelector(".tl-ts");
      if (tsEl) tsEl.textContent = ts;
      else {
        const body = li.querySelector(".tl-body");
        if (body) {
          const n = document.createElement("div");
          n.className = "tl-ts";
          n.textContent = ts;
          body.appendChild(n);
        }
      }
    }
    // Emit log event for the drawer.
    try {
      window.dispatchEvent(new CustomEvent("aoc:log", {
        detail: { ts: Date.now(), level: state === "error" ? "error" : "info", code: null, msg: li.querySelector(".tl-label").textContent + (sub ? " — " + sub : ""), ctx: { stepId: stepId, state: state } }
      }));
    } catch (_) {}
  }

  function setActive(stepId, sub) {
    // Mark all earlier steps done, this one active.
    const def = (root.FORMS || {})[currentForm];
    if (!def) return;
    let hit = false;
    for (const phase of def.phases) {
      if (phase.id === stepId) { update(phase.id, { state: "active", sub: sub || "In progress…" }); hit = true; break; }
      update(phase.id, { state: "done" });
    }
    if (!hit) update(stepId, { state: "active", sub: sub });
  }

  function setDone(stepId, sub) { update(stepId, { state: "done", sub: sub }); }
  function setError(stepId, patch) {
    update(stepId, { state: "error", sub: (patch && patch.title) || "Error" });
    const li = document.querySelector('.tl-step[data-step="' + stepId + '"] .tl-body');
    if (li && patch && typeof patch.onRetry === "function") {
      let btn = li.querySelector(".tl-retry");
      if (!btn) {
        btn = document.createElement("button");
        btn.className = "tl-retry small";
        btn.textContent = "Retry step";
        li.appendChild(btn);
      }
      btn.onclick = patch.onRetry;
    }
  }

  function activeStep() { return activeStepId; }
  function reset() { render(currentForm); }

  root.Timeline = {
    render: render,
    update: update,
    setActive: setActive,
    setDone: setDone,
    setError: setError,
    activeStep: activeStep,
    reset: reset,
    elapsed: function () { return startedAt ? Date.now() - startedAt : 0; },
  };
})(typeof window !== "undefined" ? window : globalThis);
