// Status notice — one message at a time, shown inline under the header (#notice).
// It never floats over the page or stacks. Same API as before (info / success /
// warning / error), so callers don't change. Errors stay until dismissed; the
// rest clear themselves.

(function (root) {
  "use strict";
  if (root.Toasts) return;

  const AUTO_DISMISS = { info: 4000, success: 4000, warning: 7000, error: 0 };
  const ICON = { info: "i-info", success: "i-checkcircle", warning: "i-alert", error: "i-xcircle" };
  let timer = null;

  function box() { return document.getElementById("notice"); }

  function dismiss() {
    clearTimeout(timer);
    timer = null;
    const n = box();
    if (n) n.classList.add("hidden");
  }

  function show(level, opts) {
    opts = opts || {};
    const n = box();
    if (!n) return;
    clearTimeout(timer);

    n.dataset.level = level;
    n.querySelector(".notice-ico").className = "notice-ico " + ICON[level];
    n.querySelector(".notice-title").textContent = opts.title || "";
    const text = n.querySelector(".notice-text");
    text.textContent = opts.body || "";
    text.classList.toggle("hidden", !opts.body);

    const act = n.querySelector(".notice-action");
    if (opts.action && opts.action.label) {
      act.textContent = opts.action.label;
      act.classList.remove("hidden");
      act.onclick = function () {
        try { if (typeof opts.action.onClick === "function") opts.action.onClick(); } catch (_) {}
        dismiss();
      };
    } else {
      act.classList.add("hidden");
      act.onclick = null;
    }

    n.classList.remove("hidden");
    const ms = AUTO_DISMISS[level];
    if (ms) timer = setTimeout(dismiss, ms);
  }

  const close = box() && box().querySelector(".notice-close");
  if (close) close.addEventListener("click", dismiss);

  root.Toasts = {
    info:    function (opts) { show("info", opts); },
    success: function (opts) { show("success", opts); },
    warning: function (opts) { show("warning", opts); },
    error:   function (opts) { show("error", opts); },
    dismiss: dismiss,
  };
})(typeof window !== "undefined" ? window : globalThis);
