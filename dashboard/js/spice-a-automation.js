// SPICe+ Part A (Name Reservation) — page-side automation, mirroring page-automation.js's approach
// for AOC-4 (native setter + dispatched events, no AEM-internal events, no forced validate() calls).
//
// Each pageXxx function below is injected with chrome.scripting.executeScript({ func, world: 'MAIN' }),
// which serializes the function by source text alone — it CANNOT reference anything outside its own
// body (see the note in phase-runner.js). Every helper used here is therefore declared *inside* the
// function that uses it, even though that duplicates a little code across the three functions.

// jobs: [{ key, label, kind: 'select'|'text'|'nic', labelRe, index, value, optionMap, onlyIfEmpty }]
async function spiceAPageFill(jobs) {
  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
      : window.HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
  }

  function labelFor(el) {
    let text = el.getAttribute('aria-label') || el.placeholder || '';
    if (!text && el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) text = lbl.textContent.trim();
    }
    if (!text && el.labels && el.labels[0]) text = el.labels[0].textContent.trim();
    if (!text) {
      const row = el.closest('tr, .form-row, .row, li, div');
      if (row) text = (row.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    }
    return text || '';
  }

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  }

  function matchesByLabel(tagSelector, labelRe) {
    const re = new RegExp(labelRe, 'i');
    return Array.from(document.querySelectorAll(tagSelector))
      .filter(el => el.type !== 'hidden' && isVisible(el) && re.test(labelFor(el)));
  }

  function fireCommonEvents(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }

  async function typeChars(el, value) {
    el.focus();
    setNativeValue(el, '');
    fireCommonEvents(el);
    for (const ch of String(value)) {
      setNativeValue(el, (el.value || '') + ch);
      const k = { key: ch, bubbles: true };
      el.dispatchEvent(new KeyboardEvent('keydown', k));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', k));
      await new Promise(r => setTimeout(r, 20));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findAutocompleteMatch(text) {
    const needle = String(text).trim().toLowerCase();
    if (!needle) return null;
    const candidates = document.querySelectorAll(
      '[role="option"], [role="listbox"] li, .ui-autocomplete li, .ui-menu-item, .autocomplete-item, ' +
      'ul.suggestions li, .dropdown-item, .guideAutosuggest li'
    );
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const t = (el.textContent || '').trim().toLowerCase();
      if (t && (t.includes(needle) || needle.includes(t))) return el;
    }
    return null;
  }

  const results = [];
  for (const job of jobs) {
    const result = { key: job.key, label: job.label, ok: false, note: '' };
    try {
      if (job.kind === 'select') {
        const el = matchesByLabel('select', job.labelRe)[job.index || 0];
        if (!el) { result.note = 'field not found on this page'; results.push(result); continue; }
        if (job.onlyIfEmpty && el.value) { result.ok = true; result.note = 'already set — left as is'; results.push(result); continue; }
        let optionEl = null;
        const rule = job.optionMap && job.optionMap[job.value];
        if (rule && rule.re) {
          const re = new RegExp(rule.re, 'i');
          optionEl = Array.from(el.options).find(o => re.test(o.textContent || ''));
        }
        if (!optionEl) optionEl = Array.from(el.options).find(o => (o.textContent || '').trim().toLowerCase() === String(job.value).toLowerCase());
        if (!optionEl) { result.note = `no dropdown option matched "${job.value}" — verify MCA's option text`; results.push(result); continue; }
        setNativeValue(el, optionEl.value);
        fireCommonEvents(el);
        result.ok = true;
        results.push(result);
        continue;
      }

      // 'text' and 'nic'
      const el = matchesByLabel('input:not([type="hidden"]):not([type="file"]), textarea', job.labelRe)[job.index || 0];
      if (!el) { result.note = 'field not found on this page'; results.push(result); continue; }
      if (job.onlyIfEmpty && el.value) { result.ok = true; result.note = 'already set — left as is'; results.push(result); continue; }
      await typeChars(el, job.value);

      if (job.kind === 'nic') {
        await new Promise(r => setTimeout(r, 900));
        const match = findAutocompleteMatch(job.value);
        if (match) {
          for (const ev of ['mousedown', 'mouseup', 'click']) match.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true, view: window }));
          result.note = 'typed and selected from the suggestion list';
        } else {
          result.note = 'typed — no suggestion list detected; confirm the pick on MCA';
        }
      }
      result.ok = true;
      results.push(result);
    } catch (e) {
      result.note = `error: ${e.message}`;
      results.push(result);
    }
  }
  return { results, href: location.href };
}

// Clicks "Auto Check" and reports whatever MCA shows. Does not touch Submit.
async function spiceAPageAutoCheck() {
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  }
  function textOf(el) { return (el.value || el.textContent || el.getAttribute('aria-label') || '').trim(); }

  const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a[role="button"]'))
    .filter(el => isVisible(el) && /auto[\s-]*check/i.test(textOf(el)));
  if (!buttons.length) return { clicked: false, found: 0, messages: [] };

  const btn = buttons[0];
  btn.scrollIntoView({ block: 'center' });
  btn.click();
  await new Promise(r => setTimeout(r, 2500));

  const messages = Array.from(document.querySelectorAll(
    '[role="alert"], .guideFieldErrorMessage, .error, .errorMessage, .cmp-adaptiveform-errormessage, .validation-message'
  )).filter(isVisible).map(textOf).filter(Boolean);

  return { clicked: true, found: buttons.length, messages: Array.from(new Set(messages)) };
}

// Debug helper, same spirit as pageDiagnoseSave() in page-automation.js, scoped to this form.
function spiceAPageDiagnose() {
  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none';
  }
  function textOf(el) { return (el.value || el.textContent || el.getAttribute('aria-label') || '').trim(); }
  const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'))
    .filter(isVisible).map(el => ({ text: textOf(el).slice(0, 60), disabled: !!el.disabled }));
  return { url: location.href, buttons, totalInputs: document.querySelectorAll('input, select, textarea').length };
}
