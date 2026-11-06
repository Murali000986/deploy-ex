async function pageFill(jobs) {
  // Native dialogs block the page thread and would freeze the fill; record and auto-accept them.
  const dialogs = [];
  const saved = { alert: window.alert, confirm: window.confirm, prompt: window.prompt };
  window.alert = m => { dialogs.push({ type: 'alert', msg: String(m) }); };
  window.confirm = m => { dialogs.push({ type: 'confirm', msg: String(m) }); return true; };
  window.prompt = (m, d) => { dialogs.push({ type: 'prompt', msg: String(m) }); return d ?? ''; };
  const pause = ms => new Promise(res => setTimeout(res, ms));

  const $ = window.jQuery;
  // AEM keeps hidden questions in the DOM; setting them can wedge its rules, so leave them alone.
  // Radios are often visually replaced by a styled label, so a visible parent counts; other inputs must render themselves.
  const shown = el => el.type === 'radio'
    ? !!(el.getClientRects().length || (el.parentElement && el.parentElement.getClientRects().length))
    : el.getClientRects().length > 0;
  const norm = s => String(s || '').replace(/[’‘]/g, "'").replace(/&/g, 'and').replace(/\s+/g, ' ').trim().toLowerCase();
  async function closeDataAddedModal(waitMs = 0) {
    const started = Date.now();
    while (true) {
      const dialogs = [...document.querySelectorAll('[role="dialog"], .modal, .modal-dialog, .ui-dialog, .swal2-popup, div')]
        .filter(node => node.getClientRects().length && norm(node.innerText || node.textContent).includes('data added successfully'))
        .sort((a, b) => (a.innerText || a.textContent || '').length - (b.innerText || b.textContent || '').length);
      const dialog = dialogs.find(node => [...node.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"], a')]
        .some(button => button.getClientRects().length && /^(ok|okay)$/i.test((button.textContent || button.value || '').trim())));
      if (dialog) {
        const button = [...dialog.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"], a')]
          .find(candidate => candidate.getClientRects().length && /^(ok|okay)$/i.test((candidate.textContent || candidate.value || '').trim()));
        button?.click();
        await pause(200);
        dialogsOut.push({ type: 'page-success', msg: 'Data Added Successfully', closed: true });
        return true;
      }
      if (Date.now() - started >= waitMs) return false;
      await pause(150);
    }
  }
  const protoFor = el => el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
    : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;

  function setNative(el, v) {
    const d = Object.getOwnPropertyDescriptor(protoFor(el), 'value');
    if (d && d.set) d.set.call(el, v); else el.value = v;
  }
  // A radio or checkbox carries its option's value attribute whether or not it is chosen, so
  // .value is not an answer. Ask the group which member is actually checked.
  const answeredValue = el => {
    if (el && (el.type === 'radio' || el.type === 'checkbox')) {
      const group = el.name ? [...document.querySelectorAll('input[type="' + el.type + '"]')].filter(x => x.name === el.name) : [el];
      const hit = group.find(x => x.checked);
      return hit ? String(hit.value || 'on').trim() : '';
    }
    return String((el && el.value) || '').trim();
  };
  function fire(el) {
    for (const t of ['input', 'change']) el.dispatchEvent(new Event(t, { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur'));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    if ($) { try { $(el).trigger('input').trigger('change').trigger('blur').trigger('focusout'); } catch (_) { } }
  }

  // AEM keeps the real value in its form model; DOM-only edits get wiped when MCA re-renders after the CIN lookup.
  // Widget ids are "<componentId>_widget" (radios: "<componentId>-N_widget").
  let nodes = null;
  function modelNode(el) {
    const gb = window.guideBridge;
    if (!gb || typeof gb.visit !== 'function') return null;
    if (!nodes) {
      nodes = new Map();
      try { gb.visit(c => { if (c && c.id) nodes.set(c.id, c); }); } catch (_) { return null; }
    }
    const id = (el.id || '').replace(/-\d+_widget$/, '').replace(/_widget$/, '');
    let node = nodes.get(id);
    if (!node) {
      // Fallback: try name-based lookup (select elements may use name as component id).
      const name = (el.name || '').replace(/___jqName$/, '').replace(/_widget$/, '');
      node = nodes.get(name);
    }
    if (!node) {
      // Last resort: a suffix match. One hit is taken as is. Several hits normally mean a repeated
      // table row — the signatory tables give one node per row the same id suffix — so pick the one
      // at this element's row position, and only when the counts line up exactly. Refusing them all
      // would leave the row's model unset, and AEM then repaints the widget from that empty model
      // and wipes whatever was typed into it.
      const elId = id || (el.name || '').replace(/___jqName$/, '').replace(/_widget$/, '');
      if (elId.length >= 12) {
        const hits = [];
        for (const [k, v] of nodes) if (k.length >= 12 && (elId.endsWith(k) || k.endsWith(elId))) hits.push(v);
        if (hits.length === 1) node = hits[0];
        else if (hits.length > 1) {
          const tail = (el.name || '').slice(-55);
          const peers = tail ? [...document.querySelectorAll(el.tagName)].filter(x => (x.name || '').slice(-55) === tail) : [];
          const pos = peers.indexOf(el);
          if (pos >= 0 && peers.length === hits.length) node = hits[pos];
        }
      }
    }
    return node || null;
  }
  function setModel(el, v) {
    const node = modelNode(el);
    if (!node) return false;
    let val = v;
    // AEM date fields store ISO (YYYY-MM-DD). Detect by: className on the node,
    // OR input type=text with a DD/MM/YYYY placeholder/pattern, OR the DOM element
    // sits inside a datepicker wrapper.
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
      const isDate = /datepicker/i.test(node.className || '')
        || el.placeholder === 'DD/MM/YYYY'
        || el.getAttribute('data-format') === 'DD/MM/YYYY'
        || !!el.closest('.guide-fw-datePicker, .datePicker, [data-guide-fieldType="guideDateTime"], [data-guide-fieldType="guideDatePicker"]')
        || !!el.parentElement?.querySelector('.guideCalendarIcon, [class*="calendar"], [class*="datepicker"]');
      if (isDate) {
        const [d, m, y] = v.split('/');
        val = `${y}-${m}-${d}`;
      }
    }
    // Re-writing a value AEM already holds runs its dependency rules a second time. Those rules
    // are MCA's own scripts; one of them throwing is what leaves the page unable to save.
    try { if (String(node.value ?? '') === String(val)) return true; } catch (_) { }
    try { node.value = val; return true; } catch (_) { return false; }
  }

  async function waitForVisible(selector, timeoutMs = 10000, sectionHeading = null, fieldLabel = null) {
    if (!selector && !(sectionHeading && fieldLabel)) return true;
    const isVisible = () => {
      if (selector && [...document.querySelectorAll(selector)].some(shown)) return true;
      if (sectionHeading && fieldLabel) {
        const field = findFieldBySectionLabel(sectionHeading, fieldLabel);
        if (field && shown(field)) return true;
      }
      return false;
    };
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      if (isVisible()) return true;
      await pause(250);
    }
    return isVisible();
  }

  const compactLabel = value => norm(value).replace(/[^a-z0-9]/g, '');
  function findFieldBySectionLabel(sectionHeading, fieldLabel, columnIndex = 0, rowOccurrence = 0) {
    if (!sectionHeading || !fieldLabel) return null;
    const headingKey = compactLabel(sectionHeading);
    const headingNodes = [...document.querySelectorAll('h1,h2,h3,h4,h5,legend,label,p,span,strong,td,th,div')]
      .filter(node => shown(node) && compactLabel(node.innerText || node.textContent).includes(headingKey)
        && compactLabel(node.innerText || node.textContent).length <= headingKey.length + 100)
      .sort((a, b) => (a.innerText || a.textContent || '').length - (b.innerText || b.textContent || '').length);
    const heading = headingNodes[0];
    if (!heading) return null;
    let section = null;
    for (let parent = heading; parent && parent !== document.body; parent = parent.parentElement) {
      const controls = [...parent.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(shown);
      if (controls.length >= 4) { section = parent; break; }
    }
    if (!section) return null;

    const labelKey = compactLabel(fieldLabel);
    const labelNodes = [...section.querySelectorAll('tr,[role="row"],td,th,div,label,span,p,strong')]
      .filter(node => shown(node) && compactLabel(node.innerText || node.textContent).includes(labelKey)
        && compactLabel(node.innerText || node.textContent).length <= labelKey.length + 100)
      .sort((a, b) => {
        const aText = compactLabel(a.innerText || a.textContent);
        const bText = compactLabel(b.innerText || b.textContent);
        return Number(bText === labelKey) - Number(aText === labelKey)
          || aText.length - bText.length;
      });
    const rows = [];
    const seen = new Set();
    for (const labelNode of labelNodes) {
      for (let parent = labelNode; parent && parent !== section.parentElement && section.contains(parent); parent = parent.parentElement) {
        const rowControls = [...parent.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(shown);
        const rowText = compactLabel(parent.innerText || parent.textContent);
        if (rowControls.length >= columnIndex + 1 && rowControls.length <= 6 && rowText.includes(labelKey)) {
          const identity = rowControls.map(control => control.id || control.name || control.outerHTML.slice(0, 80)).join('|');
          if (!seen.has(identity)) {
            seen.add(identity);
            rows.push({
              controls: rowControls,
              score: (parent.innerText || parent.textContent || '').length,
              exactLabel: compactLabel(labelNode.innerText || labelNode.textContent) === labelKey
            });
          }
          break;
        }
        if (parent === section) break;
      }
    }
    rows.sort((a, b) => Number(b.exactLabel) - Number(a.exactLabel) || a.score - b.score);
    return rows[rowOccurrence]?.controls[columnIndex] || null;
  }

  function findRadioGroupBySectionLabel(sectionHeading, fieldLabel, rowOccurrence = 0) {
    const firstRadio = findFieldBySectionLabel(sectionHeading, fieldLabel, 0, rowOccurrence);
    if (!firstRadio || firstRadio.type !== 'radio') return [];
    const labelKey = compactLabel(fieldLabel);
    for (let parent = firstRadio.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const rowText = compactLabel(parent.innerText || parent.textContent);
      if (!rowText.includes(labelKey) || rowText.length > labelKey.length + 100) continue;
      const rowRadios = [...parent.querySelectorAll('input[type="radio"]')].filter(shown);
      if (rowRadios.length < 2) continue;
      const name = firstRadio.name;
      return name ? rowRadios.filter(radio => radio.name === name) : rowRadios;
    }
    return [];
  }

  function findRadioGroup(job) {
    const radios = [...document.querySelectorAll('input[type="radio"]')];
    let group = job.name ? radios.filter(radio => radio.name === job.name) : [];
    if (!group.length && job.name) {
      const suffix = job.name.split('-').slice(-2).join('-');
      if (suffix) group = radios.filter(radio => radio.name && radio.name.includes(suffix));
    }
    if (!group.length && job.selector) {
      group = [...document.querySelectorAll(job.selector)].filter(radio => radio.type === 'radio');
    }
    let visibleGroup = group.filter(shown);
    if (!visibleGroup.length && job.sectionHeading && job.fieldLabel) {
      visibleGroup = findRadioGroupBySectionLabel(job.sectionHeading, job.fieldLabel, job.rowOccurrence);
    }
    if (!visibleGroup.length && job.selector) {
      visibleGroup = [...document.querySelectorAll(job.selector)].filter(radio => radio.type === 'radio' && shown(radio));
    }
    return visibleGroup.length ? visibleGroup : group;
  }

  function radioOptionTexts(radio) {
    const texts = [radio.getAttribute('aria-label'), radio.value,
      ...(radio.labels ? [...radio.labels].map(label => label.innerText || label.textContent) : [])];
    if (radio.id) {
      const label = [...document.querySelectorAll('label[for]')]
        .find(item => item.htmlFor === radio.id && shown(item));
      if (label) texts.push(label.innerText || label.textContent);
    }
    for (const neighbor of [radio.closest('label'), radio.nextElementSibling, radio.previousElementSibling, radio.parentElement]) {
      const text = String(neighbor?.innerText || neighbor?.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^(yes|no|not applicable)$/i.test(text)) texts.push(text);
    }
    return [...new Set(texts.map(norm).filter(Boolean))];
  }

  function findRadioOption(group, value) {
    const want = norm(value);
    const exact = group.find(radio => radioOptionTexts(radio).some(text => text === want));
    if (exact) return exact;
    const partial = group.find(radio => radioOptionTexts(radio).some(text => text && (text.includes(want) || want.includes(text))));
    if (partial) return partial;
    if (group.length === 2 && (want === 'yes' || want === 'no')) return group[want === 'yes' ? 0 : 1];
    return null;
  }

  const results = [];
  const dialogsOut = dialogs;
  try {
    for (const j of jobs) {
      await closeDataAddedModal(0);
      // This short yield lets MCA finish any synchronous render without adding a
      // quarter-second delay to every one of the form's many numeric fields.
      await pause(25);
      try {
        if (j.kind === 'radio') {
          const group = findRadioGroup(j);
          if (!group.length) { results.push({ id: j.id, ok: false, err: 'radio group not found' }); continue; }
          const hit = findRadioOption(group, j.value);
          if (!hit) { results.push({ id: j.id, ok: false, err: `option "${j.value}" not in group [${group.map(r => r.getAttribute('aria-label') || r.value).join(', ')}]` }); continue; }
          // Skip if already selected.
          if (hit.checked) {
            const dependentReady = await waitForVisible(
              j.waitForSelector, 10000, j.waitForSectionHeading, j.waitForFieldLabel);
            results.push({
              id: j.id, ok: dependentReady, note: dependentReady ? 'already selected' : undefined,
              err: dependentReady ? null : 'dependent address fields did not appear after selection'
            });
            continue;
          }
          if (!shown(hit)) { results.push({ id: j.id, ok: true, hidden: true, note: 'not shown on form — skipped' }); continue; }
          if (hit.disabled) { results.push({ id: j.id, ok: true, hidden: true, note: 'locked by MCA — skipped' }); continue; }
          // Click the associated label where available to update AEM's styled radio state.
          hit.scrollIntoView({ block: 'center', behavior: 'smooth' });
          await pause(300);
          const optionLabel = [...(hit.labels || [])].find(shown)
            || (hit.id && [...document.querySelectorAll('label[for]')]
              .find(item => item.htmlFor === hit.id && shown(item)))
            || hit;
          optionLabel.click();
          await pause(200);
          if (!hit.checked) {
            hit.checked = true;
            hit.dispatchEvent(new Event('input', { bubbles: true }));
            hit.dispatchEvent(new Event('change', { bubbles: true }));
            if ($) { try { $(hit).trigger('input').trigger('change'); } catch (_) { } }
          }
          setModel(hit, hit.value);
          // MCA may replace the widget after updating its model; verify the live group.
          let selectedOption = null;
          for (let w = 0; w < 6; w++) {
            await pause(500);
            const liveGroup = findRadioGroup(j);
            const liveOption = findRadioOption(liveGroup, j.value);
            if (liveOption?.checked) { selectedOption = liveOption; break; }
          }
          if (selectedOption) setModel(selectedOption, selectedOption.value);
          const dependentReady = !!selectedOption && await waitForVisible(
            j.waitForSelector, 10000, j.waitForSectionHeading, j.waitForFieldLabel);
          results.push({
            id: j.id, ok: dependentReady, via: 'label+dom+model',
            err: !selectedOption ? `radio option "${j.value}" did not stay selected` : dependentReady ? null : 'dependent field did not appear after selection'
          });
          continue;
        }

        if (j.kind === 'addRows') {
          const rowEls = document.querySelectorAll(j.selector);
          const have = rowEls.length;
          const need = j.need || 2;
          if (have >= need) {
            results.push({ id: j.id, ok: true, note: `table already has ${have} rows` });
          } else {
            let addBtn = null;
            if (have > 0) {
              const table = rowEls[0].closest('table') || rowEls[0].closest('[class*="table"]') || rowEls[0].closest('.guideTableNode');
              if (table) addBtn = table.parentElement.querySelector('button[class*="addRow"], button.tableAddRow, button[title*="Add"], button[aria-label*="Add"]');
            }
            if (!addBtn) {
              // AEM tables: look for the closest repeatable panel's add button
              if (have > 0) {
                const panel = rowEls[0].closest('.guideTableRuntimeRow, [data-guide-table-row], .guide-table-row, .guideTableNode, [class*="panel"]');
                if (panel) {
                  const container = panel.parentElement;
                  if (container) addBtn = container.querySelector('button[class*="add"], button.guideTableAdd, [class*="addButton"], [class*="addRow"]');
                }
              }
            }
            if (!addBtn) addBtn = document.querySelector('button.tableAddRow, button[class*="addRow"], button[title*="Add Row"], button[aria-label*="add"]');
            if (addBtn) {
              for (let c = have; c < need; c++) {
                addBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
                await pause(300);
                addBtn.click();
                await pause(300);
                await closeDataAddedModal(600);
              }
            }
            const nowHave = document.querySelectorAll(j.selector).length;
            results.push({ id: j.id, ok: nowHave >= need, note: `expanded ${have} → ${nowHave} rows (need ${need})` });
          }
          continue;
        }

        // PIN fields trigger MCA's postal lookup. Type the PIN first, then wait for
        // the dependent locality list and address fields before the next mapped job.
        if (j.kind === 'pinCode') {
          const pin = findFieldBySectionLabel(j.sectionHeading, j.fieldLabel, j.columnIndex, j.rowOccurrence)
            || document.querySelector(j.pinSelector || j.selector);
          if (!pin) { results.push({ id: j.id, ok: false, err: 'PIN field not found' }); continue; }
          const area = j.areaSelector ? document.querySelector(j.areaSelector) : null;
          const city = j.citySelector ? document.querySelector(j.citySelector) : null;
          const wantedPin = String(j.value || '').trim();
          const lookupComplete = (!area || (area.selectedIndex > 0 && !!area.value)) && (!city || !!city.value.trim());
          if (j.onlyIfEmpty && pin.value.trim() === wantedPin && lookupComplete) {
            results.push({ id: j.id, ok: true, note: 'kept PIN and completed address lookup already on form' });
            continue;
          }
          const lookupPending = (area && (area.options.length <= 1 || area.selectedIndex <= 0)) || (city && !city.value.trim());
          if (pin.value.trim() !== wantedPin || lookupPending) {
            pin.focus();
            setNative(pin, '');
            pin.dispatchEvent(new Event('input', { bubbles: true }));
            for (const ch of wantedPin) {
              pin.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true }));
              setNative(pin, pin.value + ch);
              pin.dispatchEvent(new Event('input', { bubbles: true }));
              pin.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true }));
              await pause(35);
            }
            setModel(pin, wantedPin);
            pin.dispatchEvent(new Event('change', { bubbles: true }));
            pin.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
            pin.blur();
            if ($) { try { $(pin).trigger('input').trigger('change').trigger('blur'); } catch (_) { } }
          }
          const until = Date.now() + 12000;
          while (Date.now() < until) {
            const optionsReady = area && area.options.length > 1;
            const addressReady = city && city.value.trim();
            if (optionsReady || addressReady) break;
            await pause(300);
          }
          const ok = pin.value.trim() === wantedPin;
          results.push({
            id: j.id, ok, err: ok ? null : `PIN shows "${pin.value}" instead of "${wantedPin}"`,
            note: area?.options.length > 1 ? 'locality options loaded' : city?.value ? 'postal address lookup completed' : 'PIN set; no lookup response observed'
          });
          continue;
        }

        const allRaw = [...document.querySelectorAll(j.selector)];
        const visible = allRaw.filter(shown);
        // When any matching controls are visible, index only those controls. Falling
        // back to hidden AEM template rows can target the wrong signatory's date.
        const all = visible.length ? visible : allRaw;
        let el = all[j.index || 0];
        const semanticEl = findFieldBySectionLabel(j.sectionHeading, j.fieldLabel, j.columnIndex, j.rowOccurrence);
        if (j.requireSemantic && !semanticEl) {
          results.push({ id: j.id, ok: false, err: `labeled row not found: ${j.fieldLabel}` });
          continue;
        }
        if (semanticEl) el = semanticEl;
        if (!el) {
          if (j.optional) {
            results.push({ id: j.id, ok: true, optionalMissing: true, note: 'optional locality field not present' });
            continue;
          }
          results.push({ id: j.id, ok: false, err: j.index ? `row ${j.index + 1} not found (form has ${all.length})` : 'element not found' });
          continue;
        }
        if (j.dateInRow) {
          let row = el.closest('tr, [role="row"], .guideTableRuntimeRow, [data-guide-table-row]');
          if (!row) {
            for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
              if ([...parent.querySelectorAll('input:not([type="hidden"]), textarea')].filter(shown).length >= 3) {
                row = parent;
                break;
              }
            }
          }
          const rowInputs = row ? [...row.querySelectorAll('input:not([type="hidden"]), textarea')].filter(shown) : [];
          // The date box announces itself with a DD/MM/YYYY placeholder or a datepicker wrapper.
          // Taking "the last input in the row" instead breaks the moment MCA adds another column.
          const others = rowInputs.filter(input => input !== el);
          const dateInput = others.find(input => input.placeholder === 'DD/MM/YYYY'
            || input.getAttribute('data-format') === 'DD/MM/YYYY'
            || !!input.closest('.guide-fw-datePicker, .datePicker, [data-guide-fieldType="guideDateTime"], [data-guide-fieldType="guideDatePicker"]')
            || !!input.parentElement?.querySelector('.guideCalendarIcon, [class*="calendar"], [class*="datepicker"]'))
            || others.at(-1);
          if (!dateInput) {
            results.push({ id: j.id, ok: false, err: 'date input not found in this visible signatory row' });
            continue;
          }
          el = dateInput;
        }

        if (j.kind === 'waitFor') {
          const until = Date.now() + j.timeout;
          let nudged = false;
          while (!el.value.trim() && Date.now() < until) {
            await pause(250);
            // Lookup didn't start: poke the source field again (Enter + leave), once, halfway through.
            if (j.nudge && !nudged && until - Date.now() < j.timeout / 2) {
              nudged = true;
              const src = document.querySelector(j.nudge);
              if (src) {
                src.focus();
                for (const t of ['keydown', 'keypress', 'keyup'])
                  src.dispatchEvent(new KeyboardEvent(t, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
                src.dispatchEvent(new Event('change', { bubbles: true }));
                src.blur();
                if ($) { try { $(src).trigger('change').trigger('blur'); } catch (_) { } }
              }
            }
          }
          if (!el.value.trim()) {
            results.push({ id: j.id, wait: true, ok: false, err: `MCA did not auto-fill within ${j.timeout / 1000}s — check the CIN` });
            continue;
          }
          // The name arrives first; MCA keeps loading (application history etc.) and rewrites fields for a while.
          // Wait until nothing on the form has changed for 3s (max 15s) so we don't fill into a moving target.
          const snap = () => [...document.querySelectorAll('input, select, textarea')]
            .map(e => (e.type === 'radio' || e.type === 'checkbox') ? (e.checked ? 1 : 0) : e.value).join('\u0001');
          let last = snap(), quietSince = Date.now();
          const hardStop = Date.now() + 15000;
          while (Date.now() - quietSince < 3000 && Date.now() < hardStop) {
            await pause(500);
            const s = snap();
            if (s !== last) { last = s; quietSince = Date.now(); }
          }
          await closeDataAddedModal(300);
          results.push({ id: j.id, wait: true, ok: true, note: `form settled after ${Math.round((Date.now() - until + j.timeout) / 1000)}s` });
          continue;
        }

        if (!shown(el)) { results.push({ id: j.id, ok: true, hidden: true, note: 'not shown on form — skipped' }); continue; }
        if (j.onlyIfEmpty) {
          const currentText = el.tagName === 'SELECT'
            ? (el.options[el.selectedIndex]?.textContent || '').trim()
            : answeredValue(el);
          const isPlaceholder = el.tagName === 'SELECT' && /^(?:select(?: here)?|choose(?: here)?|select one)$/i.test(currentText);
          if (currentText && !isPlaceholder) {
            results.push({ id: j.id, ok: true, note: 'kept existing MCA value' });
            continue;
          }
        }
        if (el.disabled || el.readOnly) {
          // Only unlock empty controls (e.g. read-only date boxes). A locked control that
          // already holds a value was filled by MCA's own lookup and must stay as is.
          if (j.forceFill && !j.mcaOwned && el.tagName !== 'SELECT' && !String(el.value || '').trim()) {
            el.disabled = false;
            el.readOnly = false;
            el.removeAttribute('disabled');
            el.removeAttribute('readonly');
          } else {
            results.push({ id: j.id, ok: true, hidden: true, note: `locked by MCA — skipped${el.value ? ` (has "${el.value}")` : ''}` });
            continue;
          }
        }

        // Avoid a smooth-scroll animation for every cell in long financial tables.
        // Scroll instantly only when needed; MCA fields that are already visible can
        // be filled immediately.
        const rect = el.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > innerHeight || rect.left < 0 || rect.right > innerWidth) {
          el.scrollIntoView({ block: 'center', behavior: 'auto' });
          await pause(35);
        }

        // Skip if field already has the correct value (avoids retyping on re-runs).
        // For selects: also check for AEM validation errors — if error shows, don't skip even if value looks correct.
        {
          const cur = el.value.trim();
          const want = (j.value || '').trim();
          const digits = s => String(s).replace(/[^\d]/g, '');
          if (el.tagName === 'SELECT') {
            const selText = norm(el.options[el.selectedIndex]?.textContent || '');
            if (selText === norm(want) || norm(cur) === norm(want)) {
              const errW = el.closest('.guideFieldNode, .guideFieldWrapper, [data-guide-au]');
              const hasVisibleErr = errW && errW.querySelector('.guideFieldError, [class*="error"]:not([style*="display: none"])');
              if (!hasVisibleErr) {
                results.push({ id: j.id, ok: true, note: 'already correct' });
                continue;
              }
            }
          } else if (cur && (cur === want || cur.toUpperCase() === want.toUpperCase()
            || cur.toUpperCase().includes(want.toUpperCase()) || digits(cur) === digits(want))) {
            results.push({ id: j.id, ok: true, note: 'already correct' });
            continue;
          }
        }

        if (el.tagName === 'SELECT') {
          // MCA's DIN lookup fills the signatory designation itself when it can. Wait a moment for it
          // and keep whatever it chose, even if the client file says something else — MCA knows the
          // director's role from the DIN. When it leaves the box on "Select Here", we choose the value
          // ourselves, through the same code every other dropdown on this form uses.
          const isDesig = !!j.mcaOwned || !!(j.id && /DESIG/i.test(j.id));
          if (isDesig) {
            const placeholder = /^(?:select(?: here)?|choose(?: here)?|select one)?$/i;
            const current = () => {
              const t = (el.options[el.selectedIndex]?.textContent || '').trim();
              return el.selectedIndex > 0 && !placeholder.test(t) ? t : '';
            };
            for (let w = 0; w < 4 && !current(); w++) await pause(500);
            const mcaText = current();
            if (mcaText) {
              const same = norm(mcaText) === norm(j.value);
              results.push({ id: j.id, ok: true, note: same ? 'MCA auto-filled correctly' : `kept MCA's designation "${mcaText}" (client file says "${j.value}")` });
              continue;
            }
          }

          // If select options are not yet populated (e.g. AJAX lookup after typing PIN code), wait up to 5s.
          if (el.options.length <= 1) {
            for (let w = 0; w < 10; w++) {
              await pause(500);
              if (el.options.length > 1) break;
            }
          }

          const opts = [...el.options].filter(o => o.value !== '');
          let opt;
          if (j.optionRe) {
            const re = new RegExp(j.optionRe, 'i');
            const not = j.optionNot ? new RegExp(j.optionNot, 'i') : null;
            opt = opts.find(o => re.test(o.textContent) && !(not && not.test(o.textContent)));
          } else {
            const want = norm(j.value);
            opt = opts.find(o => norm(o.textContent) === want || norm(o.value) === want)
              || opts.find(o => norm(o.textContent).includes(want) || want.includes(norm(o.textContent)));
          }
          if (!opt) {
            if (j.optional) {
              results.push({
                id: j.id, ok: true, optionalMissing: true,
                note: `no matching locality for "${j.value}"; keeping MCA's selection`
              });
              continue;
            }
            results.push({ id: j.id, ok: false, err: `option "${j.value}" not in list [${opts.map(o => o.textContent.trim()).join(' | ')}]` });
            continue;
          }

          const selNode = modelNode(el);
          const optIdx = [...el.options].indexOf(opt);
          let via = 'none';
          let errCleared = false;
          const preSetValue = el.options[el.selectedIndex]?.textContent?.trim() || '(empty)';

          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          await pause(300);

          // ── APPROACH 1: Find & click AEM's custom dropdown widget ──
          // AEM adaptive forms often render a custom UI over the native <select>.
          // Look for the interactive wrapper and click through it like a real user would.
          const guideNode = el.closest('.guideDropDownList, .guideFieldNode, .guideFieldWrapper, [data-guide-au]');
          let widgetClicked = false;
          if (guideNode) {
            // AEM renders a styled button/trigger for the dropdown.
            const trigger = guideNode.querySelector(
              'button.guideDropDownButton, button[class*="dropdown"], .guideWidgetContainer > button, ' +
              '.coral-Select-button, [role="combobox"], [role="listbox"], .guide-dropdown-trigger'
            ) || null; // never fall back to an arbitrary button: field wrappers also hold help/calendar buttons

            // Also look for any custom list container that appears when dropdown opens.
            if (trigger) {
              trigger.scrollIntoView({ block: 'center', behavior: 'smooth' });
              await pause(200);
              trigger.click();
              await pause(500);

              // Look for the opened custom option list.
              const listContainer = guideNode.querySelector(
                '.coral-SelectList, [role="listbox"], ul.guide-dropdown-options, ' +
                '.guideDropDownOptions, ul[class*="select"], ul[class*="dropdown"]'
              ) || document.querySelector('.coral-SelectList:not([style*="display: none"])');

              if (listContainer) {
                const listItems = [...listContainer.querySelectorAll(
                  'li, [role="option"], .coral-SelectList-item, .guide-dropdown-item'
                )];
                const wantNorm = norm(opt.textContent.trim());
                const hit = listItems.find(li => norm(li.textContent) === wantNorm)
                  || listItems.find(li => norm(li.textContent).includes(wantNorm));
                if (hit) {
                  hit.scrollIntoView({ block: 'center' });
                  await pause(100);
                  // Full mouse event sequence to simulate a real click.
                  for (const ev of ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click']) {
                    hit.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true, view: window }));
                  }
                  await pause(500);
                  widgetClicked = true;
                  via = 'widget-click';
                }
              }
              // Close dropdown if it's still open (click outside).
              if (!widgetClicked) {
                document.body.click();
                await pause(200);
              }
            }
          }

          // ── APPROACH 2: Native <select> + jQuery change (fallback) ──
          if (!widgetClicked) {
            el.focus();
            el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
            await pause(150);
            el.selectedIndex = optIdx;
            setNative(el, opt.value);
            await pause(100);
            el.dispatchEvent(new Event('change', { bubbles: true }));
            await pause(300);
            el.blur();
            el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
            el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
            if ($) {
              try { $(el).val(opt.value).trigger('change').trigger('blur').trigger('focusout'); } catch (_) { }
            }
            await pause(300);
            via = 'dom';
          }

          // ── APPROACH 3: AEM model sync ──
          // If AEM's change handler didn't propagate, set the model directly.
          let modelOk = false;
          if (selNode) {
            const curVal = selNode.value;
            if (norm(String(curVal)) === norm(opt.value) || norm(String(curVal)) === norm(opt.textContent.trim())) {
              modelOk = true;
            }
            if (!modelOk) {
              let enumVal = opt.value;
              const enums = selNode.enum_ || selNode['enum'] || selNode.options;
              const enumNames = selNode.enumNames || selNode.optionNames;
              if (enumNames && enums) {
                const idx = (Array.isArray(enumNames) ? enumNames : []).findIndex(n => norm(n) === norm(opt.textContent.trim()));
                const enumArr = Array.isArray(enums) ? enums : [];
                if (idx >= 0 && enumArr[idx] !== undefined) enumVal = enumArr[idx];
              }
              try { selNode.value = enumVal; modelOk = true; via += '+model'; } catch (_) { }
            }
          }

          // AEM's own events (guideValueChanged, guideValueCommit, elementValueChanged,
          // guideFieldValueChanged) are deliberately NOT fired here, and the model is not asked to
          // validate. Those events carry a payload only AEM can build, so dispatching them bare
          // makes MCA's handlers read a missing object ("Cannot read properties of null") and the
          // page stops responding to Save — for a human click as much as for this extension.
          // The change and blur events above are what a real selection fires; MCA validates on its
          // own when the field loses focus and again when Save is pressed.
          await pause(300);

          // AEM can repaint a dropdown from its model a moment after the change and put it back to
          // the placeholder. Check once more and choose again if that happened.
          await pause(350);
          const chosen = () => el.selectedIndex === optIdx
            || norm(el.options[el.selectedIndex]?.textContent || '') === norm(opt.textContent);
          if (!chosen()) {
            // Choose it again the way a person would, and deliberately do NOT write the form model
            // this time: if AEM has just repainted the widget, its model holds a value in a shape of
            // its own, and writing our display text over it is what made the repaint happen.
            el.focus();
            el.selectedIndex = optIdx;
            setNative(el, opt.value);
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.blur();
            fire(el);
            await pause(300);
            via += '+again';
          }

          // ── ERROR CHECK & RECOVERY ──
          await pause(500);
          const errWidget = el.closest('.guideFieldNode, .guideFieldWrapper, [data-guide-au]');
          let hasErr = errWidget && errWidget.querySelector('.guideFieldError:not(:empty), [class*="error"]:not([style*="display: none"]):not(:empty)');

          if (hasErr) {
            // Recovery: click the native <select> to open it, then use keyboard to select.
            el.focus();
            await pause(200);
            el.click();
            await pause(300);
            // Set to empty first, then to target — simulates user changing selection.
            el.selectedIndex = 0;
            setNative(el, '');
            el.dispatchEvent(new Event('change', { bubbles: true }));
            await pause(200);
            el.selectedIndex = optIdx;
            setNative(el, opt.value);
            el.dispatchEvent(new Event('change', { bubbles: true }));
            await pause(300);
            el.blur();
            fire(el);
            if ($) { try { $(el).val(opt.value).trigger('change'); } catch (_) { } }
            if (selNode) { try { selNode.value = opt.value; } catch (_) { } }
            await pause(500);

            // Re-check the error after the re-selection. Never hide MCA validation
            // messages here: that would make the form look valid without fixing it.
            hasErr = errWidget && errWidget.querySelector('.guideFieldError:not(:empty), [class*="error"]:not([style*="display: none"]):not(:empty)');
          }

          const took = el.value === opt.value;
          // Collect diagnostic info.
          let debug = null;
          try {
            // Capture error text if present.
            const finalErrEls = errWidget ? errWidget.querySelectorAll('.guideFieldError, [class*="error"]') : [];
            const errTexts = [...finalErrEls].map(e => e.textContent.trim()).filter(Boolean);
            debug = {
              via,
              widgetClicked,
              errCleared,
              errorTexts: errTexts.length ? errTexts : undefined,
              preSetValue: isDesig ? preSetValue : undefined,
              optValue: opt.value,
              optText: opt.textContent.trim(),
              domValue: el.value,
              domSelectedText: el.options[el.selectedIndex]?.textContent?.trim(),
              selectVisible: el.getClientRects().length > 0,
              selectOpacity: getComputedStyle(el).opacity,
              allOpts: opts.map(o => ({ v: o.value, t: o.textContent.trim() })),
              guideNodeClass: guideNode?.className || null,
              guideNodeHTML: guideNode ? guideNode.innerHTML.slice(0, 500) : null,
            };
            if (selNode) {
              debug.nodeId = selNode.id;
              debug.nodeValue = selNode.value;
              debug.nodeClass = selNode.className;
              debug.nodeProps = Object.keys(selNode).filter(k => typeof selNode[k] !== 'function').slice(0, 15);
              const enums = selNode.enum_ || selNode['enum'] || selNode.options;
              const enumNames = selNode.enumNames || selNode.optionNames;
              if (enums) debug.enums = Array.isArray(enums) ? enums : String(enums);
              if (enumNames) debug.enumNames = Array.isArray(enumNames) ? enumNames : String(enumNames);
            }
          } catch (_) { }
          const valid = took && !hasErr;
          results.push({
            id: j.id, ok: valid, via, widgetClicked, errCleared, debug,
            err: !took ? `select shows "${el.options[el.selectedIndex]?.text}" instead of "${opt.text}"`
              : hasErr ? `MCA still reports a designation error after re-selecting "${opt.text}"` : null
          });
          continue;
        }

        if (j.typeChars) {
          const done = j.doneSelector && document.querySelector(j.doneSelector);
          if (el.value.trim().toUpperCase() === j.value.toUpperCase() && done && done.value.trim()) {
            results.push({ id: j.id, ok: true, note: 'already loaded on page' });
            continue;
          }
          // Behave like a person typing: MCA's lookup listens on key events and leaving the field.
          el.focus();
          setNative(el, '');
          el.dispatchEvent(new Event('input', { bubbles: true }));
          for (const ch of j.value) {
            const k = { key: ch, code: `Key${ch}`, bubbles: true };
            el.dispatchEvent(new KeyboardEvent('keydown', k));
            el.dispatchEvent(new KeyboardEvent('keypress', k));
            setNative(el, el.value + ch);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', k));
            await pause(15);
          }
          const want = j.value.toUpperCase();
          let picked = null;
          // Only search for type-ahead suggestions for CIN-style fields (which have a doneSelector).
          // DIN fields are regular inputs — they validate on blur, no suggestion to pick.
          if (j.doneSelector && j.selectSuggestion) {
            for (let t = 0; t < 10 && !picked; t++) {
              await pause(250);
              const has = n => (n.textContent || '').toUpperCase().includes(want);
              picked = [...document.querySelectorAll('li, a, [role="option"], .ui-menu-item, .ui-menu-item-wrapper, div, span, td')]
                .filter(n => n !== el && !n.contains(el) && n.childElementCount < 4 && n.getClientRects().length
                  && has(n) && ![...n.children].some(has))[0] || null;
            }
            if (picked) {
              for (const t of ['mouseover', 'mousedown', 'mouseup', 'click'])
                picked.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
              await pause(300);
            } else {
              // Fallback: press Down arrow to highlight first suggestion, then Enter to confirm.
              el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true }));
              el.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true }));
              await pause(200);
              el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
              el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
              el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
              await pause(500);
            }
          }
          if (j.commitEnter) {
            for (const type of ['keydown', 'keypress', 'keyup']) {
              el.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            }
            await closeDataAddedModal(600);
          }
          // For DIN fields (with nameSelector): defer setModel until AFTER MCA's AJAX
          // lookup completes. Calling it early races with MCA's own DIN handler and
          // leaves stale "Please enter a valid DIN" errors.
          const isDinField = !!j.nameSelector && !j.doneSelector && !j.selectSuggestion;
          if (!isDinField) setModel(el, j.value);
          el.dispatchEvent(new Event('change', { bubbles: true }));
          // Simulate Tab key to leave the field — MCA validates DIN on blur/tab.
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
          el.blur();
          el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
          if ($) { try { $(el).trigger('keyup').trigger('change').trigger('blur').trigger('focusout'); } catch (_) { } }
          // For DIN: move focus to the Name field to complete the Tab simulation.
          // MCA's event handlers check activeElement to decide whether to validate.
          if (isDinField) {
            const nextAll = [...document.querySelectorAll(j.nameSelector)];
            const nextVis = nextAll.filter(shown);
            const nextEl = (nextVis.length ? nextVis : nextAll)[j.index || 0];
            if (nextEl) { nextEl.focus(); await pause(50); }
          }
          await closeDataAddedModal(300);
          let okCin = el.value.toUpperCase().includes(want);
          // Check → fill → check: if CIN didn't take, clear and retry once.
          if (!okCin && j.doneSelector && j.selectSuggestion) {
            await pause(500);
            el.focus();
            setNative(el, '');
            el.dispatchEvent(new Event('input', { bubbles: true }));
            await pause(200);
            for (const ch of j.value) {
              const k2 = { key: ch, code: `Key${ch}`, bubbles: true };
              el.dispatchEvent(new KeyboardEvent('keydown', k2));
              el.dispatchEvent(new KeyboardEvent('keypress', k2));
              setNative(el, el.value + ch);
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new KeyboardEvent('keyup', k2));
              await pause(15);
            }
            await pause(400);
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true }));
            await pause(150);
            el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
            await pause(500);
            el.blur();
            okCin = el.value.toUpperCase().includes(want);
          }
          results.push({
            id: j.id, ok: okCin, note: picked ? 'picked MCA suggestion' : undefined,
            err: okCin ? null : `field shows "${el.value}"`
          });
          if (j.nameSelector) {
            // Human-like: wait until MCA auto-fills the Director Name & Designation (up to 6s, polling every 200ms)
            const nameCandidates = [...document.querySelectorAll(j.nameSelector)];
            const visibleNames = nameCandidates.filter(shown);
            const nameEl = (visibleNames.length ? visibleNames : nameCandidates)[j.index || 0];
            const desigCandidates = j.desigSelector ? [...document.querySelectorAll(j.desigSelector)] : [];
            const visibleDesigs = desigCandidates.filter(shown);
            const desigEl = j.desigSelector ? (visibleDesigs.length ? visibleDesigs : desigCandidates)[j.index || 0] : null;
            if (nameEl) {
              for (let w = 0; w < 30; w++) {
                await pause(200);
                const hasName = nameEl.value && nameEl.value.trim();
                const hasDesig = desigEl && desigEl.selectedIndex > 0 && !/^select$/i.test(desigEl.options[desigEl.selectedIndex]?.textContent || '');
                if (hasName && (!desigEl || hasDesig)) break;
              }
              // Settle pause to ensure MCA's DIN AJAX has completely finished updating the row model
              await pause(400);
              // Now that MCA's AJAX lookup completed, sync DIN model and clear stale errors.
              setModel(el, j.value);
              // The designation is MCA's: its model is not rewritten and its change events are not re-fired here
              // (doing so left Part A unsaveable). The DESIG job keeps whatever MCA set.
              // Focus the name field then blur to stabilize the row's validation state
              nameEl.focus();
              await pause(100);
              nameEl.blur();
            }
          } else if (j.waitAfterMs) {
            await pause(j.waitAfterMs);
          }
          continue;
        }

        if (j.kind === 'date') {
          // Always type dates key-by-key so MCA's datepicker event handlers fire on each keystroke.
          el.focus();
          setNative(el, '');
          el.dispatchEvent(new Event('input', { bubbles: true }));
          for (const ch of j.value) {
            const k = { key: ch, code: ch >= '0' && ch <= '9' ? `Digit${ch}` : 'Slash', bubbles: true };
            el.dispatchEvent(new KeyboardEvent('keydown', k));
            el.dispatchEvent(new KeyboardEvent('keypress', k));
            setNative(el, el.value + ch);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent('keyup', k));
            await pause(10);
          }
          // Commit with Tab and fire events (DO NOT send Escape key which clears/cancels datepickers).
          el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
          el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
          el.blur();
          fire(el);

          // AEM stores dates in ISO format (YYYY-MM-DD) internally, but the display
          // shows DD/MM/YYYY.  setModel's className-based detection doesn't work on
          // guideBridge component objects, so we convert explicitly here.
          const dateParts = j.value.split('/');
          const isoDate = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}` : j.value;
          const dateObj = dateParts.length === 3 ? new Date(+dateParts[2], +dateParts[1] - 1, +dateParts[0]) : null;

          if ($) {
            try { $(el).val(j.value).trigger('input').trigger('change').trigger('blur').trigger('focusout'); } catch (_) { }
            try { if (dateObj) $(el).datepicker('setDate', dateObj); } catch (_) { }
          }

          // Sync the AEM model with ISO date and validate to clear errors.
          const dateNode = modelNode(el);
          if (dateNode) {
            try { dateNode.value = isoDate; } catch (_) {}
          }
          // The datepicker, or AEM repainting the widget from its model, can blank the box a moment
          // after we type — which is how the signatory signing dates ended up empty on the real
          // form. Type, wait, look again; retype if it went, and confirm it survives a second wait.
          const wantD = String(j.value).replace(/[^\d]/g, '');
          const dateHeld = () => {
            const v = String(el.value || '').trim();
            return v !== '' && v !== 'DD/MM/YYYY' && v.replace(/[^\d]/g, '') === wantD;
          };
          for (let attempt = 0; attempt < 3; attempt++) {
            await pause(300);
            if (dateHeld()) { if (attempt > 0) break; continue; }
            setNative(el, j.value);
            fire(el);
            if ($) { try { $(el).val(j.value).trigger('change'); } catch (_) { } }
            if (dateNode) { try { dateNode.value = isoDate; } catch (_) {} }
          }
        } else {
          const viaModel = setModel(el, j.value);
          if (!viaModel) el.focus();
          setNative(el, j.value);
          fire(el);
          // Give AEM one render tick after input/change; the phase-level verifier
          // handles slower updates once, instead of waiting 150ms for every cell.
          await pause(35);
          // MCA sometimes leaves a required numeric cell visually blank after a
          // zero was entered. Explicitly sync and validate zero values so nil
          // disclosures (such as royalty/know-how/fees) satisfy required checks.
          if (j.kind === 'number' && Number(j.value) === 0) {
            const numericNode = modelNode(el);
            if (numericNode) {
              try { numericNode.value = '0'; } catch (_) {}
            }
            setNative(el, '0');
            fire(el);
          }
        }
        const digits = s => String(s).replace(/\.0+$/, '').replace(/[^\d\-]/g, '');
        const took = el.value === j.value || (el.value !== '' && digits(el.value) === digits(j.value));
        results.push({
          id: j.id, ok: took, via: j.kind === 'date' ? 'typed' : 'dom',
          err: took ? null : `page rejected value (now "${el.value}")`
        });
      } catch (e) {
        results.push({ id: j.id, ok: false, err: e.message });
      }
    }
  } finally {
    await pause(25); // yield once to AEM while avoiding a per-field quarter-second idle
    Object.assign(window, saved);
  }
  return { results, dialogs };
}

// Returns the fields whose value no longer matches what was filled.
async function pageVerify(jobs) {
  // A radio or checkbox carries its option's value attribute whether or not it is chosen, so
  // .value is not an answer. Ask the group which member is actually checked.
  const verifyAnswered = el => {
    if (el && (el.type === 'radio' || el.type === 'checkbox')) {
      const group = el.name ? [...document.querySelectorAll('input[type="' + el.type + '"]')].filter(x => x.name === el.name) : [el];
      const hit = group.find(x => x.checked);
      return hit ? String(hit.value || 'on').trim() : '';
    }
    return String((el && el.value) || '').trim();
  };

  await new Promise(r => setTimeout(r, 2000));
  const norm = s => String(s || '').replace(/[’‘]/g, "'").replace(/&/g, 'and').replace(/\s+/g, ' ').trim().toLowerCase();
  const digits = s => String(s).replace(/\.0+$/, '').replace(/[^\d\-]/g, '');
  const isShown = el => el.type === 'radio'
    ? !!(el.getClientRects().length || (el.parentElement && el.parentElement.getClientRects().length))
    : el.getClientRects().length > 0;
  const compactLabel = value => norm(value).replace(/[^a-z0-9]/g, '');
  function findFieldBySectionLabel(sectionHeading, fieldLabel, columnIndex = 0, rowOccurrence = 0) {
    if (!sectionHeading || !fieldLabel) return null;
    const headingKey = compactLabel(sectionHeading);
    const headingNodes = [...document.querySelectorAll('h1,h2,h3,h4,h5,legend,label,p,span,strong,td,th,div')]
      .filter(node => isShown(node) && compactLabel(node.innerText || node.textContent).includes(headingKey)
        && compactLabel(node.innerText || node.textContent).length <= headingKey.length + 100)
      .sort((a, b) => (a.innerText || a.textContent || '').length - (b.innerText || b.textContent || '').length);
    const heading = headingNodes[0];
    if (!heading) return null;
    let section = null;
    for (let parent = heading; parent && parent !== document.body; parent = parent.parentElement) {
      const controls = [...parent.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(isShown);
      if (controls.length >= 4) { section = parent; break; }
    }
    if (!section) return null;
    const labelKey = compactLabel(fieldLabel);
    const labelNodes = [...section.querySelectorAll('tr,[role="row"],td,th,div,label,span,p,strong')]
      .filter(node => isShown(node) && compactLabel(node.innerText || node.textContent).includes(labelKey)
        && compactLabel(node.innerText || node.textContent).length <= labelKey.length + 100)
      .sort((a, b) => {
        const aText = compactLabel(a.innerText || a.textContent);
        const bText = compactLabel(b.innerText || b.textContent);
        return Number(bText === labelKey) - Number(aText === labelKey)
          || aText.length - bText.length;
      });
    const rows = [];
    const seen = new Set();
    for (const labelNode of labelNodes) {
      for (let parent = labelNode; parent && parent !== section.parentElement && section.contains(parent); parent = parent.parentElement) {
        const rowControls = [...parent.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter(isShown);
        const rowText = compactLabel(parent.innerText || parent.textContent);
        if (rowControls.length >= columnIndex + 1 && rowControls.length <= 6 && rowText.includes(labelKey)) {
          const identity = rowControls.map(control => control.id || control.name || control.outerHTML.slice(0, 80)).join('|');
          if (!seen.has(identity)) {
            seen.add(identity);
            rows.push({
              controls: rowControls,
              score: (parent.innerText || parent.textContent || '').length,
              exactLabel: compactLabel(labelNode.innerText || labelNode.textContent) === labelKey
            });
          }
          break;
        }
        if (parent === section) break;
      }
    }
    rows.sort((a, b) => Number(b.exactLabel) - Number(a.exactLabel) || a.score - b.score);
    return rows[rowOccurrence]?.controls[columnIndex] || null;
  }
  function findRadioGroup(job) {
    const radios = [...document.querySelectorAll('input[type="radio"]')];
    let group = job.name ? radios.filter(radio => radio.name === job.name) : [];
    if (!group.length && job.name) {
      const suffix = job.name.split('-').slice(-2).join('-');
      if (suffix) group = radios.filter(radio => radio.name && radio.name.includes(suffix));
    }
    if (!group.length && job.selector) {
      group = [...document.querySelectorAll(job.selector)].filter(radio => radio.type === 'radio');
    }
    let visibleGroup = group.filter(isShown);
    if (!visibleGroup.length && job.sectionHeading && job.fieldLabel) {
      const firstRadio = findFieldBySectionLabel(job.sectionHeading, job.fieldLabel, 0, job.rowOccurrence);
      if (firstRadio?.type === 'radio') {
        const labelKey = compactLabel(job.fieldLabel);
        for (let parent = firstRadio.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          const rowText = compactLabel(parent.innerText || parent.textContent);
          if (!rowText.includes(labelKey) || rowText.length > labelKey.length + 100) continue;
          const rowRadios = [...parent.querySelectorAll('input[type="radio"]')].filter(isShown);
          if (rowRadios.length >= 2) {
            visibleGroup = firstRadio.name ? rowRadios.filter(radio => radio.name === firstRadio.name) : rowRadios;
            break;
          }
        }
      }
    }
    if (!visibleGroup.length && job.selector) {
      visibleGroup = [...document.querySelectorAll(job.selector)].filter(radio => radio.type === 'radio' && isShown(radio));
    }
    return visibleGroup.length ? visibleGroup : group;
  }
  function radioOptionTexts(radio) {
    const texts = [radio.getAttribute('aria-label'), radio.value,
      ...(radio.labels ? [...radio.labels].map(label => label.innerText || label.textContent) : [])];
    if (radio.id) {
      const label = [...document.querySelectorAll('label[for]')]
        .find(item => item.htmlFor === radio.id && isShown(item));
      if (label) texts.push(label.innerText || label.textContent);
    }
    for (const neighbor of [radio.closest('label'), radio.nextElementSibling, radio.previousElementSibling, radio.parentElement]) {
      const text = String(neighbor?.innerText || neighbor?.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^(yes|no|not applicable)$/i.test(text)) texts.push(text);
    }
    return [...new Set(texts.map(norm).filter(Boolean))];
  }
  function findRadioOption(group, value) {
    const want = norm(value);
    const exact = group.find(radio => radioOptionTexts(radio).some(text => text === want));
    if (exact) return exact;
    const partial = group.find(radio => radioOptionTexts(radio).some(text => text && (text.includes(want) || want.includes(text))));
    if (partial) return partial;
    if (group.length === 2 && (want === 'yes' || want === 'no')) return group[want === 'yes' ? 0 : 1];
    return null;
  }
  const out = [];
  for (const j of jobs) {
    if (j.kind === 'radio') {
      const group = findRadioGroup(j);
      const expected = findRadioOption(group, j.value);
      if (!expected?.checked) {
        const selected = group.find(radio => radio.checked);
        const now = selected ? radioOptionTexts(selected).join(' / ') || selected.value : 'nothing selected';
        out.push({ id: j.id, want: j.value, now });
      }
      continue;
    }
    const candidates = [...document.querySelectorAll(j.selector)];
    const visible = candidates.filter(isShown);
    const fields = visible.length ? visible : candidates;
    const semanticEl = findFieldBySectionLabel(j.sectionHeading, j.fieldLabel, j.columnIndex, j.rowOccurrence);
    if (j.requireSemantic && !semanticEl) { out.push({ id: j.id, want: j.value, now: `labeled row not found: ${j.fieldLabel}` }); continue; }
    let el = semanticEl || fields[j.index || 0];
    if (!el) { out.push({ id: j.id, want: j.value, now: 'field gone' }); continue; }
    if (j.dateInRow) {
      let row = el.closest('tr, [role="row"], .guideTableRuntimeRow, [data-guide-table-row]');
      if (!row) {
        for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          if ([...parent.querySelectorAll('input:not([type="hidden"]), textarea')].filter(isShown).length >= 3) {
            row = parent;
            break;
          }
        }
      }
      const rowInputs = row ? [...row.querySelectorAll('input:not([type="hidden"]), textarea')].filter(isShown) : [];
      const verifyOthers = rowInputs.filter(input => input !== el);
      const dateInput = verifyOthers.find(input => input.placeholder === 'DD/MM/YYYY'
        || input.getAttribute('data-format') === 'DD/MM/YYYY'
        || !!input.closest('.guide-fw-datePicker, .datePicker, [data-guide-fieldType="guideDateTime"], [data-guide-fieldType="guideDatePicker"]'))
        || verifyOthers.at(-1);
      if (!dateInput) { out.push({ id: j.id, want: j.value, now: 'date input not found in visible signatory row' }); continue; }
      el = dateInput;
    }
    if (j.onlyIfEmpty) {
      const currentText = el.tagName === 'SELECT'
        ? (el.options[el.selectedIndex]?.textContent || '').trim()
        : verifyAnswered(el);
      const isPlaceholder = el.tagName === 'SELECT' && /^(?:select(?: here)?|choose(?: here)?|select one)$/i.test(currentText);
      if (currentText && !isPlaceholder) continue;
    }
    if (j.optional) continue;
    if (el.tagName === 'SELECT') {
      const selText = el.options[el.selectedIndex]?.text?.trim() || '';
      if (j.mcaOwned) {
        // MCA's DIN lookup owns this dropdown. Whatever it chose is right, whatever the client file
        // says; only an empty one needs fixing.
        const stillBlank = !el.value || !selText || /^(?:select(?: here)?|choose(?: here)?|select one)$/i.test(selText);
        if (stillBlank) out.push({ id: j.id, want: j.value, now: selText || 'nothing selected' });
        continue;
      }
      const matchesMappedOption = j.optionRe
        ? new RegExp(j.optionRe, 'i').test(selText) && !(j.optionNot && new RegExp(j.optionNot, 'i').test(selText))
        : (norm(selText) === norm(j.value) || norm(el.value) === norm(j.value));
      if (!el.value || !matchesMappedOption) {
        out.push({ id: j.id, want: j.value, now: selText || 'nothing selected' });
      }
      continue;
    }
    if (el.value !== j.value && digits(el.value) !== digits(j.value)) out.push({ id: j.id, want: j.value, now: el.value || 'empty' });
  }
  return out;
}

// Sweep visible AEM validation error widgets. For each field that already holds
// a value, re-sync its model node and call validate() to clear stale errors.
async function pageValidationCleanup(ownedSelectors = []) {
  const pause = ms => new Promise(res => setTimeout(res, ms));
  const gb = window.guideBridge;
  if (!gb || typeof gb.visit !== 'function') return;
  const $ = window.jQuery;
  // Fields MCA's own lookups control (signatory designations): re-validating them re-fires MCA's handlers.
  const isOwned = field => ownedSelectors.some(sel => { try { return field.matches(sel); } catch (_) { return false; } });

  const nodes = new Map();
  try { gb.visit(c => { if (c && c.id) nodes.set(c.id, c); }); } catch (_) { return; }

  function nodeFor(el) {
    const id = (el.id || '').replace(/-\d+_widget$/, '').replace(/_widget$/, '');
    let node = nodes.get(id);
    if (!node) {
      const name = (el.name || '').replace(/___jqName$/, '').replace(/_widget$/, '');
      node = nodes.get(name);
    }
    if (!node) {
      const elId = id || (el.name || '').replace(/___jqName$/, '');
      for (const [k, v] of nodes) {
        if (elId.endsWith(k) || k.endsWith(elId)) { node = v; break; }
      }
    }
    return node || null;
  }

  // A radio or checkbox carries its option's value attribute whether or not it is chosen, so
  // .value is not an answer. Ask the group which member is actually checked.
  const answeredValue = el => {
    if (el && (el.type === 'radio' || el.type === 'checkbox')) {
      const group = el.name ? [...document.querySelectorAll('input[type="' + el.type + '"]')].filter(x => x.name === el.name) : [el];
      const hit = group.find(x => x.checked);
      return hit ? String(hit.value || 'on').trim() : '';
    }
    return String((el && el.value) || '').trim();
  };

  const errorWrappers = [...document.querySelectorAll('.guideFieldNode, .guideFieldWrapper')]
    .filter(w => {
      const err = w.querySelector('.guideFieldError:not(:empty)');
      return err && err.getClientRects().length > 0;
    });

  for (const wrapper of errorWrappers) {
    const field = wrapper.querySelector('input:not([type="hidden"]), select, textarea');
    if (!field || isOwned(field)) continue;
    // An unanswered mandatory Yes/No is exactly what shows a visible error and reaches this loop.
    // Writing the first radio's value attribute into the model would answer it silently, and because
    // no change event fires, MCA's dependent-field scripts never run: the fields that answer should
    // reveal stay missing and Save then fails against model errors with nothing on screen to fix.
    const answer = field.tagName === 'SELECT'
      ? (field.selectedIndex > 0 && !/^select$/i.test((field.options[field.selectedIndex]?.textContent || '').trim()) ? 'select' : '')
      : answeredValue(field);
    if (!answer) continue;

    const node = nodeFor(field);
    if (node) {
      if (field.tagName === 'SELECT') {
        const opt = field.options[field.selectedIndex];
        const enums = node.enum_ || node['enum'] || node.options;
        const enumNames = node.enumNames || node.optionNames;
        let enumVal = opt?.value;
        if (enumNames && enums && opt) {
          const norm = s => String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
          const idx = (Array.isArray(enumNames)?enumNames:[]).findIndex(n => norm(n) === norm(opt.textContent));
          const arr = Array.isArray(enums) ? enums : [];
          if (idx >= 0 && arr[idx] !== undefined) enumVal = arr[idx];
        }
        try { node.value = enumVal; } catch (_) {}
      } else {
        let modelVal = answeredValue(field);
        // Date fields: convert DD/MM/YYYY display value to ISO YYYY-MM-DD for the AEM model.
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(modelVal)) {
          const isDate = field.placeholder === 'DD/MM/YYYY'
            || field.getAttribute('data-format') === 'DD/MM/YYYY'
            || !!field.closest('.guide-fw-datePicker, .datePicker, [data-guide-fieldType="guideDateTime"], [data-guide-fieldType="guideDatePicker"]')
            || !!field.parentElement?.querySelector('.guideCalendarIcon, [class*="calendar"], [class*="datepicker"]');
          if (isDate) {
            const [dd, mm, yy] = modelVal.split('/');
            modelVal = `${yy}-${mm}-${dd}`;
          }
        }
        try { node.value = modelVal; } catch (_) {}
      }
      await pause(50);
    }

    // Whatever still shows after validate() is MCA's verdict; it stays visible so Save can report it.
  }

  // No AEM-internal events are fired here either: see the note in the select branch of pageFill.
  await pause(300);
}

// Watches the user-entered Q12(c) service-provider fields and saves Phase 2 once
// all editable text fields have values and a cloud Yes/No choice is selected.
function pageArmManualSave(saveIndex, saveAnchor) {
  const stateKey = '__aoc4ManualProviderSave';
  const prior = window[stateKey];
  if (prior?.armed && !prior.completed) return { armed: true, alreadyArmed: true };
  if (prior?.completed) delete window[stateKey];

  const compact = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const visible = el => !!el.getClientRects().length;
  const headingText = 'particulars of the service provider';
  function findSection() {
    const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,legend,label,p,span,strong,div')]
      .filter(el => visible(el) && compact(el.innerText || el.textContent).includes(compact(headingText))
        && compact(el.innerText || el.textContent).length < compact(headingText).length + 100)
      .sort((a, b) => (a.innerText || a.textContent || '').length - (b.innerText || b.textContent || '').length);
    let root = headings[0] || null;
    while (root && root !== document.body) {
      const count = [...root.querySelectorAll('input:not([type="hidden"]),textarea,select')].filter(visible).length;
      if (count >= 4) return root;
      root = root.parentElement;
    }
    return null;
  }
  const section = findSection();
  if (!section) return { armed: false, reason: 'service-provider section not found' };

  let debounce = null;
  let observer = null;
  const state = { armed: true, completed: false, saveIndex, saveAnchor };
  window[stateKey] = state;

  function showToast(message, success) {
    let toast = document.getElementById('aoc4-manual-save-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'aoc4-manual-save-toast';
      toast.style.cssText = 'position:fixed;z-index:2147483647;right:24px;bottom:24px;padding:12px 18px;border-radius:6px;color:#fff;font:14px Arial,sans-serif;box-shadow:0 2px 12px #0005;';
      document.body.appendChild(toast);
    }
    toast.style.background = success ? '#176b3a' : '#8b5d00';
    toast.textContent = message;
    setTimeout(() => toast?.remove(), 7000);
  }

  function removeListeners() {
    clearTimeout(debounce);
    observer?.disconnect();
    for (const type of ['input', 'change', 'focusout']) document.removeEventListener(type, onManualEdit, true);
  }

  function scheduleCheck() {
    clearTimeout(debounce);
    debounce = setTimeout(checkAndSave, 600);
  }

  async function closeSuccessModal() {
    const isSaveDoneMsg = text =>
      /(data added successfully|saved successfully|save done|data saved|record saved|form saved|successfully)/i.test(text || '');
    const candidates = [...document.querySelectorAll('[role="dialog"],.modal,.modal-dialog,.ui-dialog,.swal2-popup,div')]
      .filter(el => visible(el) && isSaveDoneMsg(el.innerText || el.textContent || ''))
      .sort((a, b) => (a.innerText || a.textContent || '').length - (b.innerText || b.textContent || '').length);
    const dialog = candidates.find(el => [...el.querySelectorAll('button,input[type="button"],input[type="submit"],[role="button"],a')]
      .some(button => visible(button) && /^(ok|okay)$/i.test((button.textContent || button.value || '').trim())));
    if (!dialog) return false;
    const ok = [...dialog.querySelectorAll('button,input[type="button"],input[type="submit"],[role="button"],a')]
      .find(button => visible(button) && /^(ok|okay)$/i.test((button.textContent || button.value || '').trim()));
    ok?.click();
    return true;
  }

  async function checkAndSave() {
    if (state.completed) return;
    const currentSection = findSection();
    if (!currentSection) return;
    const editableText = [...currentSection.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]),textarea')]
      .filter(el => visible(el) && !el.disabled && !el.readOnly);
    const hasCloudChoice = [...currentSection.querySelectorAll('input[type="radio"]')]
      .some(el => visible(el) && el.checked);
    if (!editableText.length || editableText.some(el => !String(el.value || '').trim()) || !hasCloudChoice) return;

    const buttons = [...document.querySelectorAll('button,input[type="button"],input[type="submit"]')]
      .filter(button => visible(button) && /^\s*save\s*$/i.test(button.textContent || button.value || ''));
    let button = null;
    if (saveAnchor) {
      const anchorKey = compact(saveAnchor);
      const anchors = [...document.querySelectorAll('h1,h2,h3,h4,h5,legend,label,p,span,strong,div')]
        .filter(el => visible(el) && compact(el.innerText || el.textContent).includes(anchorKey)
          && compact(el.innerText || el.textContent).length < anchorKey.length + 120)
        .sort((a, b) => (a.innerText || a.textContent || '').length - (b.innerText || b.textContent || '').length);
      const anchor = anchors[0];
      if (anchor) button = buttons.find(candidate =>
        anchor.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING) || null;
    } else {
      button = buttons[saveIndex] || buttons[buttons.length - 1] || null;
    }
    if (!button) {
      showToast('Could not find the Q12(c) Save button. Click the Save below that section manually.', false);
      return;
    }

    state.completed = true;
    removeListeners();
    button.scrollIntoView({ block: 'center' });
    button.click();
    await new Promise(resolve => setTimeout(resolve, 1800));
    const confirmed = await closeSuccessModal();
    showToast(confirmed
      ? 'MCA confirmed the Phase 2 save. The success dialog was closed.'
      : 'Phase 2 Save was clicked. Check the MCA page for its result or any validation message.', confirmed);
  }

  function onManualEdit(event) {
    const activeSection = findSection();
    if (activeSection && activeSection.contains(event.target)) scheduleCheck();
  }

  for (const type of ['input', 'change', 'focusout']) document.addEventListener(type, onManualEdit, true);
  observer = new MutationObserver(records => {
    const activeSection = findSection();
    if (!activeSection) return;
    const sectionChanged = records.some(record => activeSection.contains(record.target)
      || [...record.addedNodes].some(node => node === activeSection || (node.nodeType === 1 && node.contains(activeSection))));
    if (sectionChanged) scheduleCheck();
  });
  observer.observe(document.body, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['disabled', 'readonly', 'checked', 'class', 'style', 'value']
  });
  scheduleCheck();
  return { armed: true, sectionFound: true };
}

// Open a phase only through a visible, enabled navigation control with the exact mapped section title.
function pageActivateSection(anchorText) {
  const compact = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = compact(anchorText);
  if (!wanted) return { clicked: false, reason: 'no section title' };
  const visible = el => el.getClientRects().length > 0;
  const controls = [...document.querySelectorAll('a, button, [role="tab"], [role="button"], [tabindex]')]
    .filter(el => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true')
    .map(el => ({ el, text: compact(el.innerText || el.textContent) }))
    .filter(item => item.text.includes(wanted))
    .sort((a, b) => a.text.length - b.text.length);
  if (!controls.length) return { clicked: false, reason: 'no matching visible navigation control' };
  const target = controls[0].el;
  target.scrollIntoView({ block: 'center' });
  target.click();
  return { clicked: true };
}

function pageWaitForSectionReady(readySelector, anchorText, timeoutMs = 15000) {
  const compact = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const anchorKey = compact(anchorText);
  const isReady = () => {
    const fieldReady = readySelector && [...document.querySelectorAll(readySelector)]
      .some(field => field.getClientRects().length > 0);
    if (fieldReady) return true;
    if (!anchorKey) return false;
    return [...document.querySelectorAll('h1,h2,h3,h4,h5,legend,label,p,span,strong,th,td,div')]
      .some(node => {
        if (!node.getClientRects().length) return false;
        const text = compact(node.innerText || node.textContent);
        return text.includes(anchorKey) && text.length <= anchorKey.length + 140;
      });
  };
  return new Promise(resolve => {
    const started = Date.now();
    const poll = () => {
      if (isReady()) return resolve(true);
      if (Date.now() - started >= timeoutMs) return resolve(false);
      setTimeout(poll, 250);
    };
    poll();
  });
}

// Installed once per page load: native alert/confirm/prompt would block the page thread
// and stall the fill, so they are auto-accepted and recorded for the popup's logs.
function pageInstallDialogGuard() {
  if (window.__aoc4DialogGuard) return { installed: true, already: true };
  const log = window.__aoc4Dialogs = window.__aoc4Dialogs || [];
  // Confirmations that would throw work away are declined (never one that mentions saving);
  // everything else is accepted. The guard expires on its own in case the popup is closed mid-run.
  const destructive = /\b(delete|discard|remove|reset|clear all|log ?out|sign ?out|leave (?:this )?page)\b/i;
  const orig = { alert: window.alert, confirm: window.confirm, prompt: window.prompt };
  const installedAt = Date.now(), ttl = 20 * 60 * 1000;
  const expired = () => Date.now() - installedAt > ttl;
  // Script errors thrown by MCA's own handlers (e.g. inside a Save click) are the usual reason a
  // button "does nothing"; keep the last few so the popup can show them.
  const errs = window.__aoc4Errors = window.__aoc4Errors || [];
  const describeError = e => {
    const err = e?.error || e?.reason;
    const msg = String(err?.message || e?.message || err || 'error').slice(0, 200);
    const src = e?.filename ? ` @ ${String(e.filename).split('/').pop().split('?')[0]}:${e.lineno || 0}:${e.colno || 0}` : '';
    const frames = String(err?.stack || '').split('\n').slice(1, 3).map(s => s.trim().replace(/^at\s+/, '')).join(' ← ');
    return `${msg}${src}${frames ? ` [${frames}]` : ''}`.slice(0, 420);
  };
  const onErr = e => { errs.push({ msg: describeError(e), at: Date.now() }); if (errs.length > 30) errs.shift(); };
  window.addEventListener('error', onErr);
  window.addEventListener('unhandledrejection', onErr);
  orig.onErr = onErr;
  window.__aoc4DialogGuard = orig;
  window.alert = m => { if (expired()) return orig.alert.call(window, m); log.push({ type: 'alert', msg: String(m), at: Date.now() }); };
  window.confirm = m => {
    if (expired()) return orig.confirm.call(window, m);
    const s = String(m);
    const ok = !submitWord.test(s) && !(destructive.test(s) && !/\bsave\b/i.test(s));
    log.push({ type: 'confirm', msg: s, answer: ok, at: Date.now() });
    return ok;
  };
  window.prompt = (m, d) => { if (expired()) return orig.prompt.call(window, m, d); log.push({ type: 'prompt', msg: String(m), at: Date.now() }); return d ?? ''; };
  return { installed: true };
}

function pageUninstallDialogGuard() {
  const g = window.__aoc4DialogGuard;
  if (!g) return { removed: false };
  window.alert = g.alert; window.confirm = g.confirm; window.prompt = g.prompt;
  if (g.onErr) { window.removeEventListener('error', g.onErr); window.removeEventListener('unhandledrejection', g.onErr); }
  delete window.__aoc4DialogGuard;
  return { removed: true };
}

function pageReadGuardDialogs() {
  const log = window.__aoc4Dialogs || [];
  const out = log.splice(0, log.length).map(d => ({ type: `native-${d.type}`, msg: d.msg, closed: true }));
  const errs = window.__aoc4Errors || [];
  for (const e of errs.splice(0, errs.length)) out.push({ type: 'page-error', msg: e.msg });
  return out;
}

// Debug-tab inspector for a Save button that "does nothing": what covers it, whether it is
// disabled, which layers/modals are up, which fields the form model rejects, recent script errors.
function pageDiagnoseSave() {
  const visible = el => !!el && el.getClientRects().length > 0;
  const describe = el => {
    if (!el || el === document.documentElement) return null;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''}`;
  };
  const text = el => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const saveButtons = [...document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]')]
    .filter(b => /^\s*save\s*$/i.test(b.textContent || b.value || ''))
    .map(b => {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let coveredBy = null;
      if (visible(b) && cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight) {
        const top = document.elementFromPoint(cx, cy);
        if (top && top !== b && !b.contains(top)) coveredBy = describe(top);
      }
      const s = getComputedStyle(b);
      return { id: b.id || null, visible: visible(b), disabled: !!b.disabled || b.getAttribute('aria-disabled') === 'true', pointerEvents: s.pointerEvents, opacity: s.opacity, inViewport: cy >= 0 && cy <= innerHeight, coveredBy };
    });
  const layers = [];
  for (const el of document.querySelectorAll('body *')) {
    if (layers.length >= 10 || !visible(el)) continue;
    const s = getComputedStyle(el);
    if (s.position !== 'fixed' && s.position !== 'absolute') continue;
    const r = el.getBoundingClientRect();
    if (r.width >= innerWidth * 0.8 && r.height >= innerHeight * 0.6 && s.pointerEvents !== 'none') layers.push({ el: describe(el), zIndex: s.zIndex, opacity: s.opacity, text: text(el).slice(0, 80) });
  }
  const modals = [...document.querySelectorAll('[role="dialog"], .modal, .modal-backdrop, .ui-dialog, .ui-widget-overlay, .blockUI, .blockOverlay, .guideDialogNode, dialog[open]')]
    .filter(visible).map(el => ({ el: describe(el), text: text(el).slice(0, 80) }));
  const errorEls = [...document.querySelectorAll('.guideFieldError')];
  const gb = window.guideBridge;
  // Read-only: gb.validate() would re-run MCA's validation scripts over the whole form and can
  // leave it unable to save, which is exactly the fault this screen is meant to diagnose.
  let modelInvalid = null;
  if (gb && typeof gb.visit === 'function') {
    modelInvalid = [];
    try {
      gb.visit(node => {
        if (!node || modelInvalid.length >= 20) return;
        let invalid = false;
        try { invalid = node.isValid === false || !!node._failedTest; } catch (_) { return; }
        if (!invalid) return;
        let t = '', m = '';
        try { t = String(node.title || node.name || node.somExpression || '').replace(/<[^>]+>/g, '').trim(); } catch (_) { }
        try { m = String(node.errorMessage || node.validationMessage || node.mandatoryMessage || '').trim(); } catch (_) { }
        if (t || m) modelInvalid.push(`${t}${m ? ': ' + m : ''}`);
      });
    } catch (e) { modelInvalid = `reading the form model threw: ${e.message}`; }
  }
  let jqActive = null; try { jqActive = window.jQuery ? window.jQuery.active : 'no jQuery'; } catch (_) { }
  // Signatory rows: the designation is MCA-owned; its state is the usual difference between a working and a dead Save.
  const signatories = [...document.querySelectorAll('select[name$="headerItem1643788021607___jqName"]')].filter(visible).map(sel => {
    const row = sel.closest('tr, [role="row"]') || sel.parentElement;
    const inputs = row ? [...row.querySelectorAll('input:not([type="hidden"])')].filter(visible) : [];
    const wrap = sel.closest('.guideFieldNode, .guideFieldWrapper');
    return {
      din: inputs[0]?.value || '', name: inputs[1]?.value || '',
      designation: (sel.options[sel.selectedIndex]?.textContent || '').trim(), disabled: !!sel.disabled,
      error: text(wrap?.querySelector('.guideFieldError')) || ''
    };
  });
  return {
    url: location.href, readyState: document.readyState, jQueryActive: jqActive, signatories,
    saveButtons, blockingLayers: layers, visibleModals: modals,
    errorElements: { total: errorEls.length, hidden: errorEls.filter(e => e.style.display === 'none').length, visibleWithText: errorEls.filter(e => visible(e) && text(e)).slice(0, 10).map(text) },
    formModel: { guideBridge: !!gb, invalidFields: modelInvalid },
    dialogGuardInstalled: !!window.__aoc4DialogGuard,
    recentScriptErrors: (window.__aoc4Errors || []).slice(-10).map(e => e.msg),
    bodyClass: document.body.className, bodyPointerEvents: getComputedStyle(document.body).pointerEvents,
    activeElement: describe(document.activeElement)
  };
}

// Resolves when the page is idle; closes popups it meets on the way. Self-contained.
async function pageWaitForIdle(maxWaitMs = 10000) {
  const pause = ms => new Promise(res => setTimeout(res, ms));
  const visible = el => {
    if (!el || !el.getClientRects().length) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.opacity !== '0';
  };
  const text = el => String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const dialogs = [];
  const serverErrorRe = /service (?:is )?(?:temporarily )?unavailable|server (?:is )?(?:busy|error)|too many requests|gateway time-?out|bad gateway|error 50\d|technical (?:error|difficult)|try again (?:later|after some ?time)|site can.?t be reached/i;
  const busyTextRe = /^(?:please wait|loading|processing|saving|fetching|submitting|validating)\b/i;
  const loaderSelector = [
    '.guide-loading', '.guideLoading', '.loading', '.loader', '.spinner', '.ajax-loader', '.blockUI', '.blockOverlay',
    '.ui-widget-overlay', '.modal-backdrop', '[aria-busy="true"]', '[class*="spinner"]', '[class*="preloader"]',
    '[class*="page-loader"]', '[class*="pageLoader"]', '[class*="loading-overlay"]', '[class*="loadingOverlay"]',
    '[class*="ajaxLoader"]', '[class*="ajax-loader"]', '[id*="loader" i]', '[id*="loading" i]'
  ].join(', ');
  const buttonLabel = c => (c.textContent || c.value || c.getAttribute('aria-label') || '').trim();

  // Only real modal containers: class-substring matches ("...-dialog", "...popup") also hit ordinary page panels.
  const dialogSelector = '[role="dialog"], [role="alertdialog"], .modal, .modal-dialog, .ui-dialog, .swal2-popup, .guideDialogNode';
  const destructive = /\b(delete|discard|remove|reset|clear all|log ?out|sign ?out|leave (?:this )?page)\b/i;
  const submitWord = /\bsubmit\b/i;
  const isDestructive = t => submitWord.test(t) || (destructive.test(t) && !/\bsave\b/i.test(t));
  // Earlier versions blanked MCA's error elements with inline display:none; AEM writes its Save
  // messages into those same elements, so restore any that were left hidden and empty.
  document.querySelectorAll('.guideFieldError').forEach(e => {
    if (e.style.display === 'none' && !(e.textContent || '').trim()) e.style.removeProperty('display');
  });
  // A modal floats above the page; an in-flow element that merely carries a "modal" class is page content.
  const floats = node => { for (let el = node; el && el !== document.body; el = el.parentElement) { const pos = getComputedStyle(el).position; if (pos === 'fixed' || pos === 'absolute') return true; } return false; };
  function dismissDialogs() {
    const containers = [...document.querySelectorAll(dialogSelector)]
      .filter(node => visible(node) && floats(node) && text(node).length > 0 && text(node).length <= 600)
      .sort((a, b) => text(a).length - text(b).length);
    for (const node of containers) {
      const controls = [...node.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"], a')].filter(visible);
      const yes = controls.find(c => /^(ok|okay|yes|continue|proceed|confirm|done)$/i.test(buttonLabel(c)));
      const no = controls.find(c => /^(no|cancel|close|dismiss|×|x)$/i.test(buttonLabel(c)) || /close/i.test(c.getAttribute('aria-label') || ''));
      // Session-timeout style popups are answered with Continue/Yes; anything that would throw
      // work away (delete, discard, leave page) is declined instead.
      const control = isDestructive(text(node)) ? (no || null) : (yes || no);
      if (!control) continue;
      dialogs.push({ type: 'page-dialog', msg: text(node).slice(0, 160), button: buttonLabel(control) || 'close', closed: true });
      control.click();
      return true; // one at a time; the next poll handles any that follow
    }
    return false;
  }

  function busyReason() {
    if (document.readyState !== 'complete') return 'MCA page is still loading';
    try { if (window.jQuery && window.jQuery.active > 0) return 'MCA server request in progress'; } catch (_) { }
    for (const el of document.querySelectorAll(loaderSelector)) {
      if (!visible(el) || el.matches('input, select, textarea, button, label, option, img')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;
      const cls = String(el.className || '');
      // Overlays/backdrops only count when they actually cover the page.
      if (/backdrop|overlay|blockui|blockoverlay/i.test(cls) && (rect.width < innerWidth * 0.5 || rect.height < innerHeight * 0.5)) continue;
      const tag = cls.split(/\s+/).find(c => /load|spin|overlay|backdrop|block|busy/i.test(c)) || el.id || 'overlay';
      return `MCA is showing a loading indicator (${tag})`;
    }
    // Leaf nodes and textContent only: innerText on every block forces layout on the large AEM page.
    for (const el of document.querySelectorAll('div, span, p, h1, h2, h3, h4, strong')) {
      if (el.childElementCount > 1) continue;
      const t = (el.textContent || '').trim();
      if (t.length === 0 || t.length > 60 || !busyTextRe.test(t)) continue;
      if (visible(el)) return `MCA says "${t.replace(/\s+/g, ' ')}"`;
    }
    return null;
  }

  const started = Date.now();
  let reason = null;
  while (true) {
    if (dismissDialogs()) {
      await pause(300);
      if (Date.now() - started < maxWaitMs) continue;
    }
    reason = busyReason();
    if (!reason || Date.now() - started >= maxWaitMs) break;
    await pause(300);
  }
  const inputs = document.querySelectorAll('input:not([type="hidden"]), select, textarea').length;
  // Reading innerText forces layout across the whole AEM page. Only inspect the
  // page text on a likely error document, where MCA rendered fewer than 5 inputs.
  const serverMatch = inputs < 5
    ? (document.body?.innerText || document.body?.textContent || '').slice(0, 6000).match(serverErrorRe)
    : null;
  return { idle: !reason, reason, waitedMs: Date.now() - started, dialogs, serverError: serverMatch ? serverMatch[0] : null };
}

// After a Save click: waits (longer while MCA is busy) for the success dialog, closes it,
// or reports the field errors MCA raised instead. Self-contained.
async function pageConfirmSave(waitMs = 12000, markerSource = null, phaseLabels = []) {
  const pause = ms => new Promise(res => setTimeout(res, ms));
  const visible = el => !!el && el.getClientRects().length > 0;
  const text = el => String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  // Same scoping as pageSave: only errors that belong to this phase's section count against it.
  const marker = markerSource ? new RegExp(markerSource, 'i') : null;
  const normalize = v => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const labels = phaseLabels.map(normalize).filter(l => l.length >= 12);
  const inPhase = errEl => {
    if (!marker && !labels.length) return true;
    const wrap = errEl.closest('.guideFieldNode, .guideFieldWrapper, [data-guide-au]') || errEl.parentElement;
    const ctx = normalize(wrap ? (wrap.innerText || wrap.textContent) : text(errEl));
    return (marker && marker.test(ctx)) || labels.some(l => ctx.includes(l));
  };
  const dialogs = [];
  const isSaveDoneMsg = t => /(data added successfully|saved successfully|save done|data saved|record saved|form saved|saved|successfully)/i.test(t || '');
  const isOkBtn = c => /^(ok|okay|close|confirm|proceed|done|continue|yes)$/i.test((c.textContent || c.value || c.getAttribute('aria-label') || '').trim());
  const busy = () => {
    try { if (window.jQuery && window.jQuery.active > 0) return true; } catch (_) { }
    return [...document.querySelectorAll('.guide-loading, .guideLoading, .loading, .loader, .spinner, .blockUI, .blockOverlay, .ui-widget-overlay, [class*="spinner"], [class*="loading-overlay"]')]
      .some(el => visible(el) && el.getBoundingClientRect().width >= 8);
  };
  const closeSuccessDialog = () => {
    const candidates = [...document.querySelectorAll('[role="dialog"], .modal, .modal-dialog, .ui-dialog, .swal2-popup, .guideDialogNode, div')]
      .filter(node => visible(node) && text(node).length <= 400 && isSaveDoneMsg(text(node)))
      .sort((a, b) => text(a).length - text(b).length);
    for (const node of candidates) {
      const ok = [...node.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"], a')].find(c => visible(c) && isOkBtn(c));
      if (ok) { dialogs.push({ type: 'page-success', msg: text(node).slice(0, 80), closed: true }); ok.click(); return true; }
    }
    return false;
  };
  const fieldErrors = () => [...document.querySelectorAll('.guideFieldError')].filter(n => visible(n) && text(n) && inPhase(n)).map(text);
  const started = Date.now();
  const hardStop = started + Math.max(waitMs, 40000); // the popup allows 50s for this call
  while (Date.now() < hardStop) {
    if (closeSuccessDialog()) { await pause(300); return { confirmed: true, dialogs, waitedMs: Date.now() - started }; }
    const isBusy = busy();
    if (!isBusy) {
      const errs = fieldErrors();
      if (errs.length) return { confirmed: false, errorsVisible: true, errorTexts: [...new Set(errs)].slice(0, 8), dialogs, waitedMs: Date.now() - started };
      if (Date.now() - started >= waitMs) break;
    }
    await pause(250);
  }
  return { confirmed: false, errorsVisible: false, dialogs, waitedMs: Date.now() - started };
}

// Clicks the Save button of the current phase. Match the older working main flow:
// choose the first Save after the phase anchor, otherwise use that phase's Save index.
async function pageSave(index, anchorText, phaseId, phaseValidationLabels = [], deferredPartAValidationLabels = []) {
  const dialogs = [];
  const saved = { alert: window.alert, confirm: window.confirm };
  window.alert = m => { dialogs.push({ type: 'alert', msg: String(m) }); };
  window.confirm = m => { dialogs.push({ type: 'confirm', msg: String(m) }); return true; };
  try {
    const visible = el => !!el && el.getClientRects().length > 0;
    const isSaveDoneMsg = text =>
      /(data added successfully|saved successfully|save done|data saved|record saved|form saved|saved|successfully)/i.test(text || '');
    const isOkBtn = control => {
      const val = (control.textContent || control.value || control.getAttribute('aria-label') || '').trim();
      return /^(ok|okay|close|confirm|proceed|done)$/i.test(val);
    };
    // A real success dialog is small; a 400-char cap keeps page-level containers out.
    const findSuccessDialog = () => {
      const candidates = [...document.querySelectorAll('[role="dialog"], .modal, .modal-dialog, .ui-dialog, .swal2-popup, .guideDialogNode, div')]
        .filter(node => {
          if (!visible(node)) return false;
          const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
          return text.length <= 400 && isSaveDoneMsg(text);
        })
        .sort((a, b) => (a.innerText || a.textContent || '').length - (b.innerText || b.textContent || '').length);
      for (const node of candidates) {
        const ok = [...node.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"], a')]
          .find(control => visible(control) && isOkBtn(control));
        if (ok) return { node, ok };
      }
      return null;
    };
    const closeSuccessDialog = () => {
      const found = findSuccessDialog();
      if (!found) return false;
      found.ok.click();
      dialogs.push({ type: 'page-success', msg: (found.node.innerText || '').slice(0, 80).replace(/\s+/g, ' ').trim(), closed: true });
      return true;
    };

    // Clear any existing success modal before trying to interact with Save.
    for (let attempt = 0; attempt < 5; attempt++) {
      if (closeSuccessDialog()) break;
      await new Promise(r => setTimeout(r, 100));
    }

    // Keep the exact button discovery used by the working main snapshot.
    const buttons = [...document.querySelectorAll('button, input[type="button"], input[type="submit"]')]
      // offsetParent is null for a button inside a position:fixed toolbar even though it is on
      // screen, so fall back to whether the element actually renders a box.
      .filter(b => /^\s*save\s*$/i.test(b.textContent || b.value || '')
        && (b.offsetParent !== null || b.getClientRects().length > 0) && !b.disabled);
    const follows = (ref, candidate) => !!(ref.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING);
    let btn = null;
    let via = null;

    // Prefer the phase's configured Save anchor, as in the older working flow.
    if (anchorText) {
      const compact = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const anchorKey = compact(anchorText);
      const anchors = [...document.querySelectorAll('h1,h2,h3,h4,h5,legend,label,p,span,strong,div')]
        .filter(el => visible(el) && compact(el.innerText || el.textContent).includes(anchorKey)
          && compact(el.innerText || el.textContent).length < anchorKey.length + 120)
        .sort((a, b) => (a.innerText || a.textContent || '').length - (b.innerText || b.textContent || '').length);
      const anchor = anchors[0];
      if (anchor) btn = buttons.find(candidate => follows(anchor, candidate)) || null;
      if (btn) via = 'after-anchor';
    }

    // Preserve the phase's original Save index when no matching anchor is present.
    if (!btn) {
      btn = (index !== undefined && buttons[index]) ? buttons[index] : (buttons[buttons.length - 1] || null);
      if (btn) via = 'index';
    }
    if (!btn) return { clicked: false, found: buttons.length, dialogs };

    // Re-sync date model values to ISO right before Save.  MCA's async event
    // handlers (from the fill step's blur/change events) may have overwritten
    // the ISO value we set with the DD/MM/YYYY display value.
    const gb = window.guideBridge;
    if (gb && typeof gb.visit === 'function') {
      const dateNodes = new Map();
      try { gb.visit(c => { if (c && c.id) dateNodes.set(c.id, c); }); } catch (_) {}
      const dateInputs = [...document.querySelectorAll('input')]
        .filter(inp => inp.getClientRects().length > 0
          && (inp.type === 'text' || inp.type === '')
          && /^\d{2}\/\d{2}\/\d{4}$/.test(inp.value));
      for (const inp of dateInputs) {
        const isDate = inp.placeholder === 'DD/MM/YYYY'
          || inp.getAttribute('data-format') === 'DD/MM/YYYY'
          || !!inp.closest('.guide-fw-datePicker, .datePicker, [data-guide-fieldType="guideDateTime"], [data-guide-fieldType="guideDatePicker"]')
          || !!inp.parentElement?.querySelector('.guideCalendarIcon, [class*="calendar"], [class*="datepicker"]');
        if (!isDate) continue;
        const [dd, mm, yy] = inp.value.split('/');
        const iso = `${yy}-${mm}-${dd}`;
        const nodeId = (inp.id || '').replace(/-\d+_widget$/, '').replace(/_widget$/, '');
        let node = dateNodes.get(nodeId);
        if (!node) {
          const name = (inp.name || '').replace(/___jqName$/, '').replace(/_widget$/, '');
          node = dateNodes.get(name);
        }
        if (!node) {
          // Only an unambiguous suffix match: binding the wrong node here would rewrite another
          // field's date right before Save.
          const elId = nodeId || (inp.name || '').replace(/___jqName$/, '');
          if (elId.length >= 12) {
            const hits = [];
            for (const [k, v] of dateNodes) {
              if (k.length >= 12 && (elId.endsWith(k) || k.endsWith(elId))) hits.push(v);
              if (hits.length > 1) break;
            }
            if (hits.length === 1) node = hits[0];
          }
        }
        if (node) {
          // Set the value only when it differs, and never call validate(): MCA validates on Save.
          try { if (String(node.value ?? '') !== iso) node.value = iso; } catch (_) {}
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
    // Earlier versions hid MCA's error elements with inline display:none. AEM writes its Save
    // validation messages into those same elements, so a hidden one makes Save look dead
    // (nothing appears, manually or automatically). Give any blanked ones their display back.
    document.querySelectorAll('.guideFieldError').forEach(e => {
      if (e.style.display === 'none' && !(e.textContent || '').trim()) e.style.removeProperty('display');
    });

    // A Save that "does nothing" is usually a script error in MCA's click handler or a silent
    // client-side validation failure; record both so the popup can show the real cause.
    const jsErrors = [];
    const onPageError = e => {
      const err = e?.error || e?.reason;
      const src = e?.filename ? ` @ ${String(e.filename).split('/').pop().split('?')[0]}:${e.lineno || 0}:${e.colno || 0}` : '';
      const frames = String(err?.stack || '').split('\n').slice(1, 3).map(s => s.trim().replace(/^at\s+/, '')).join(' ← ');
      jsErrors.push(`${String(err?.message || e?.message || err || 'error').slice(0, 200)}${src}${frames ? ` [${frames}]` : ''}`.slice(0, 420));
    };
    window.addEventListener('error', onPageError);
    window.addEventListener('unhandledrejection', onPageError);

    // Match the old Save path exactly: scroll to the selected button and click immediately.
    btn.scrollIntoView({ block: 'center' });
    btn.click();
    await new Promise(r => setTimeout(r, 1500));
    // MCA answers the Save with a success dialog or inline field errors. Wait up to ~10s
    // for either, longer (max 40s) while MCA is still busy with the request.
    let successModalClosed = false;
    const visibleFieldErrors = () => [...document.querySelectorAll('.guideFieldError')]
      .some(node => visible(node) && (node.innerText || node.textContent || '').trim());
    const busy = () => {
      try { if (window.jQuery && window.jQuery.active > 0) return true; } catch (_) { }
      return [...document.querySelectorAll('.guide-loading, .guideLoading, .loading, .loader, .spinner, .blockUI, .blockOverlay, .ui-widget-overlay, [class*="spinner"], [class*="loading-overlay"]')]
        .some(el => visible(el) && el.getBoundingClientRect().width >= 8);
    };
    const clickedAt = Date.now();
    while (Date.now() - clickedAt < 40000) {
      if (closeSuccessDialog()) { successModalClosed = true; break; }
      const isBusy = busy();
      if (!isBusy && Date.now() - clickedAt >= 1000 && visibleFieldErrors()) break;
      if (!isBusy && Date.now() - clickedAt >= 10000) break;
      await new Promise(r => setTimeout(r, 200));
    }
    window.removeEventListener('error', onPageError);
    window.removeEventListener('unhandledrejection', onPageError);
    // MCA may answer the Save with a native alert()/confirm() instead of a DOM dialog. Those were
    // captured (not shown) above: a success text counts as confirmation, anything else is its verdict.
    const nativeMsgs = dialogs.filter(d => d.type === 'alert' || d.type === 'confirm').map(d => d.msg).filter(Boolean);
    const nativeSuccess = nativeMsgs.filter(m => isSaveDoneMsg(m));
    const nativeErrors = nativeMsgs.filter(m => !isSaveDoneMsg(m));
    if (!successModalClosed && nativeSuccess.length) successModalClosed = true;
    const validationMarkers = {
      1: /\b(cin|financial year|date of incorporation|registered office|agm|annual general meeting|signing of reports)\b/i,
      2: /\b(subsidiary|adt.?1|number of auditors|income.?tax pan|auditor.?s firm|membership number|name of the auditor|address line 1|pin code|state\/ut|schedule\s*iii|consolidated financial statements|books of account|computer servers|service provider)\b/i,
      3: /\b(break.?up of figures|trade receivables|long.?term borrowings|short.?term borrowings|total assets)\b/i,
      4: /\b(operating lease|net worth|unpaid dividend|iepf|share application money|shares bought back|unclaimed matured debentures|commercial paper|foreign exchange exposure)\b/i,
      5: /\b(share capital|cost records|cost audit)\b/i,
      6: /\b(profit.?and.?loss|revenue from operations|earnings per share|profit before|foreign exchange|income in foreign currency|expenditure in foreign currency)\b/i,
      7: /\b(transactions entered with related party|auditor.?s report|csr applicability|secretarial audit|product or service|product category|turnover of the product)\b/i
    };
    const validationMarker = validationMarkers[phaseId] || /$a/;
    // Part A (Q1–12) has one Save: after a Phase 1 Save the Q8–12 errors count too, after a Phase 2 Save the Q1–7 ones.
    const partA = phaseId === 1 || phaseId === 2;
    const deferredPartAMarker = phaseId === 2 ? validationMarkers[1] : validationMarkers[2];
    const normalizeValidationText = value => String(value || '').toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    const validationStopWords = new Set([
      'whether', 'the', 'of', 'and', 'or', 'is', 'are', 'a', 'an', 'in', 'during', 'for', 'to', 'from',
      'as', 'under', 'part', 'segment', 'amount', 'rupees', 'period', 'company', 'current', 'reporting', 'details'
    ]);
    const matchesValidationLabels = (context, labels) => {
      const normalizedContext = normalizeValidationText(context);
      if (!normalizedContext) return false;
      return labels.some(label => {
        const normalizedLabel = normalizeValidationText(label);
        if (normalizedLabel.length >= 12 && normalizedContext.includes(normalizedLabel)) return true;
        const tokens = [...new Set(normalizedLabel.split(' ').filter(token => token.length > 2 && !validationStopWords.has(token)))];
        if (tokens.length < 3) return false;
        const matched = tokens.filter(token => normalizedContext.includes(token)).length;
        return matched >= Math.max(3, Math.ceil(tokens.length * 0.6));
      });
    };
    // Read each field's own verdict instead of calling gb.validate(). A full validate() re-runs
    // MCA's validation scripts across every section, including ones that were never rendered; a
    // throw inside one of those scripts leaves the whole form unable to save.
    const collectInvalid = (bridge, limit) => {
      const out = [];
      if (!bridge || typeof bridge.visit !== 'function') return out;
      try {
        bridge.visit(node => {
          if (!node || out.length >= limit) return;
          let invalid = false;
          try { invalid = node.isValid === false || !!node._failedTest; } catch (_) { return; }
          if (!invalid) return;
          let title = '', msg = '';
          try { title = String(node.title || node.name || node.somExpression || '').replace(/<[^>]+>/g, '').trim(); } catch (_) { }
          try { msg = String(node.errorMessage || node.validationMessage || node.mandatoryMessage || '').trim(); } catch (_) { }
          if (title || msg) out.push({ text: `${title}${msg ? ': ' + msg : ''}` });
        });
      } catch (_) { }
      return out;
    };
    const modelErrors = successModalClosed ? [] : collectInvalid(gb, 80);
    const errorMessagePattern = /please enter|please select|please provide|relevant details|invalid|cannot be blank|must be provided|must be completed|is required|is mandatory/i;
    const errorLike = node => /error|invalid|alert|mandatory/i.test(node.className || '') || node.getAttribute('role') === 'alert';
    const errorNodes = [...document.querySelectorAll('.guideFieldError,[class*="error"],[role="alert"],span,div,p')]
      .filter(node => visible(node))
      .filter(node => {
        const text = String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text || !errorMessagePattern.test(text)) return false;
        // Error widgets may be longer; plain text nodes must be short leaf messages,
        // so static help text on the form is not mistaken for a validation error.
        return errorLike(node) ? text.length <= 200 : (text.length <= 120 && node.childElementCount <= 1);
      });
    const validationContexts = errorNodes.map(node => {
      let context = String(node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
      for (let parent = node.parentElement, depth = 0;
        parent && parent !== document.body && depth < 6; depth++, parent = parent.parentElement) {
        const text = String(parent.innerText || parent.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length > 500) break;
        context = text;
        if (parent.querySelector('input:not([type="hidden"]),select,textarea')) break;
      }
      return context;
    });
    const allValidationContexts = [...new Set(validationContexts)];
    const phaseValidationErrors = allValidationContexts.filter(text =>
      matchesValidationLabels(text, phaseValidationLabels) || validationMarker.test(text));
    const deferredPartAValidationErrors = partA
      ? allValidationContexts.filter(text =>
        matchesValidationLabels(text, deferredPartAValidationLabels) || deferredPartAMarker.test(text)) : [];
    const otherSectionValidationErrors = allValidationContexts.filter(text =>
      !phaseValidationErrors.includes(text) && !deferredPartAValidationErrors.includes(text));
    // Model-reported errors are scoped the same way as the visible ones.
    const modelPhaseErrors = modelErrors.filter(e => matchesValidationLabels(e.text, phaseValidationLabels) || validationMarker.test(e.text)).map(e => e.text);
    const modelDeferredErrors = partA
      ? modelErrors.filter(e => matchesValidationLabels(e.text, deferredPartAValidationLabels) || deferredPartAMarker.test(e.text)).map(e => e.text) : [];
    // A native message raised by this very click belongs to this phase, whatever it says.
    const allPhaseErrors = [...new Set([...phaseValidationErrors, ...modelPhaseErrors, ...nativeErrors.map(m => `MCA said: ${m}`)])];
    const allDeferredErrors = [...new Set([...deferredPartAValidationErrors, ...modelDeferredErrors])];
    const validationErrors = partA ? [...new Set([...allPhaseErrors, ...allDeferredErrors])] : allPhaseErrors;
    const modelErrorsOther = modelErrors.length - new Set([...modelPhaseErrors, ...modelDeferredErrors]).size;
    const blockedByOtherSections = !successModalClosed && (modelErrorsOther > 0 || otherSectionValidationErrors.length > 0);
    if (validationErrors.length) {
      return {
        clicked: false,
        attempted: true,
        found: buttons.length,
        via,
        targetAnchor: anchorText || null,
        validationErrors,
        phaseValidationErrors: allPhaseErrors,
        deferredPartAValidationErrors: allDeferredErrors,
        otherSectionValidationErrors,
        blockedByOtherSections,
        jsErrors,
        modelErrorsOther,
        dialogs
      };
    }
    if (blockedByOtherSections) {
      return {
        clicked: false,
        attempted: true,
        found: buttons.length,
        via,
        targetAnchor: anchorText || null,
        otherSectionValidationErrors,
        blockedByOtherSections: true,
        jsErrors,
        modelErrorsOther,
        dialogs
      };
    }
    return {
      clicked: true, found: buttons.length, via, targetAnchor: anchorText || null,
      targetIndex: via === 'index' ? index : null, dialogs, successModalClosed, jsErrors, modelErrorsOther
    };
  } finally {
    Object.assign(window, saved);
  }
}

