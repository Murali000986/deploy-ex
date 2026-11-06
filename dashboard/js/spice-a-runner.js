// SPICe+ Part A (Name Reservation) — orchestration. Reuses getActiveMcaTab() and withTimeout()
// from phase-runner.js (loaded earlier in popup.html) and Storage from storage.js.
// Unlike AOC-4's doFill(), this form has one section and no "Save and continue" loop: fill, then
// (optionally) click Auto Check. Submit is never clicked by this extension — the instruction kit
// treats it as the final, fee-triggering step, and the filer should see the page before committing.

async function doFillSpiceA(clickAutoCheck) {
  const tab = await getActiveMcaTab();
  if (!tab) throw new Error('Open the SPICe+ Part A form on mca.gov.in first.');

  const jobs = spiceABuildJobs(currentSpiceData || {});
  if (!jobs.length) throw new Error('Nothing to fill — load a client first.');

  const [fillRes] = await withTimeout(
    chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: spiceAPageFill, args: [jobs] }),
    30000, 'Fill timed out — the page is not responding.'
  );
  const fill = fillRes?.result || { results: [] };
  await Storage.saveLogs({ action: 'spiceAFill', url: fill.href, results: fill.results });

  let autoCheck = null;
  if (clickAutoCheck) {
    const [acRes] = await withTimeout(
      chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: spiceAPageAutoCheck }),
      15000, 'Auto Check timed out.'
    );
    autoCheck = acRes?.result || { clicked: false, messages: [] };
    await Storage.saveLogs({ action: 'spiceAAutoCheck', result: autoCheck });
  }

  return { fill, autoCheck };
}

async function diagnoseSpiceA() {
  const tab = await getActiveMcaTab();
  if (!tab) throw new Error('Open the SPICe+ Part A form on mca.gov.in first.');
  const [res] = await withTimeout(
    chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: spiceAPageDiagnose }),
    15000, 'Diagnosis timed out.'
  );
  return res?.result || {};
}
