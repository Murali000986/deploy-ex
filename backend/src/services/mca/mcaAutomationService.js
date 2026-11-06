import puppeteer from 'puppeteer';
import { SPICE_PART_A_FIELDS, buildFieldValues } from './spicePlusMapper.js';

const MCA_HOME = 'https://www.mca.gov.in/';

class McaAutomationService {
  constructor() {
    this.browser = null;
    this.page = null;
    this.status = 'idle';
    this.statusMessage = '';
    this.credentials = null;
    this.logs = [];
  }

  _log(msg) {
    const entry = { time: new Date().toISOString(), message: msg };
    this.logs.push(entry);
    if (this.logs.length > 200) this.logs.shift();
    console.log(`[MCA-Auto] ${msg}`);
  }

  setCredentials(username, password) {
    this.credentials = { username, password };
    this._log('MCA credentials saved');
  }

  getStatus() {
    return {
      status: this.status,
      message: this.statusMessage,
      logs: this.logs.slice(-30),
      browserOpen: !!this.browser,
    };
  }

  async launchBrowser() {
    if (this.browser) {
      this._log('Browser already open, reusing');
      return;
    }

    this.status = 'launching';
    this.statusMessage = 'Launching Chrome browser...';
    this._log('Launching browser (visible mode)');

    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-infobars',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    const pages = await this.browser.pages();
    this.page = pages[0] || await this.browser.newPage();

    // Remove automation fingerprints
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      delete navigator.__proto__.webdriver;
      window.chrome = { runtime: {} };
    });

    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    this.browser.on('disconnected', () => {
      this._log('Browser closed');
      this.browser = null;
      this.page = null;
      this.status = 'idle';
      this.statusMessage = 'Browser closed';
    });

    this._log('Browser launched');
  }

  /**
   * Step 1: Open MCA homepage, find Login link, click it, fill credentials.
   * CAPTCHA + OTP are manual.
   */
  async startLogin() {
    if (!this.credentials) {
      throw new Error('No MCA credentials saved. Please save your ID and password first.');
    }

    await this.launchBrowser();

    this.status = 'login_page';
    this.statusMessage = 'Opening MCA homepage...';
    this._log(`Navigating to ${MCA_HOME}`);

    try {
      await this.page.goto(MCA_HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (err) {
      this._log(`Navigation issue: ${err.message} — continuing anyway`);
    }

    this._log('MCA homepage loaded, waiting for JS to settle...');
    await new Promise(r => setTimeout(r, 5000));

    // Find and click the Login link on the homepage
    this._log('Looking for Login link on homepage...');
    const loginClicked = await this.page.evaluate(() => {
      // Search all links and buttons for "Login" text
      const candidates = [...document.querySelectorAll('a, button, [role="button"], [onclick]')];
      for (const el of candidates) {
        const text = (el.textContent || '').trim().toLowerCase();
        const href = (el.getAttribute('href') || '').toLowerCase();
        if (text.includes('login') || text.includes('sign in') || href.includes('login')) {
          el.click();
          return { found: true, text: el.textContent.trim(), tag: el.tagName, href: el.getAttribute('href') || '' };
        }
      }
      return { found: false };
    });

    if (loginClicked.found) {
      this._log(`Clicked Login link: "${loginClicked.text}" (${loginClicked.tag}, href: ${loginClicked.href})`);
    } else {
      this._log('No Login link found on homepage — trying direct navigation to login page');
      try {
        await this.page.goto('https://www.mca.gov.in/content/mca/global/en/mca/login.html', {
          waitUntil: 'domcontentloaded', timeout: 30000
        });
      } catch (err) {
        this._log(`Direct login nav: ${err.message}`);
      }
    }

    // Wait for login form to appear
    this._log('Waiting for login form to render...');
    await new Promise(r => setTimeout(r, 5000));

    // Try to fill credentials using native value setters (like the Chrome extension does)
    const filled = await this.page.evaluate((creds) => {
      const results = { username: false, password: false, method: '' };

      // Native setter — ensures React/Angular/AEM forms pick up the value
      function nativeFill(el, value) {
        const proto = el.tagName === 'TEXTAREA'
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (setter) setter.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }

      const allInputs = document.querySelectorAll('input');
      for (const inp of allInputs) {
        if (inp.offsetParent === null || inp.type === 'hidden') continue;

        const type = (inp.type || '').toLowerCase();
        const name = (inp.name || '').toLowerCase();
        const id = (inp.id || '').toLowerCase();
        const placeholder = (inp.placeholder || '').toLowerCase();
        const ariaLabel = (inp.getAttribute('aria-label') || '').toLowerCase();
        // Also check parent label text
        const labelEl = inp.closest('.guideFieldNode')?.querySelector('.guideFieldLabel');
        const labelText = (labelEl?.textContent || '').toLowerCase();

        const allHints = [name, id, placeholder, ariaLabel, labelText].join(' ');

        if (!results.username && type !== 'password' &&
            (allHints.includes('email') || allHints.includes('user') || allHints.includes('login') || allHints.includes('mobile'))) {
          nativeFill(inp, creds.username);
          results.username = true;
          results.method += `user:${inp.id || inp.name}; `;
        }

        if (!results.password && type === 'password') {
          nativeFill(inp, creds.password);
          results.password = true;
          results.method += `pass:${inp.id || inp.name}; `;
        }
      }

      // Fallback: if no field matched by hints, try first text + first password
      if (!results.username) {
        const firstText = [...document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])')].find(
          el => el.offsetParent !== null && el.type !== 'hidden'
        );
        if (firstText) {
          nativeFill(firstText, creds.username);
          results.username = true;
          results.method += 'user:fallback-first-text; ';
        }
      }
      if (!results.password) {
        const firstPass = document.querySelector('input[type="password"]');
        if (firstPass && firstPass.offsetParent !== null) {
          nativeFill(firstPass, creds.password);
          results.password = true;
          results.method += 'pass:fallback-first-password; ';
        }
      }

      return results;
    }, this.credentials);

    if (filled.username) this._log(`Username filled (${filled.method})`);
    else this._log('Could not find username field — please fill manually in the browser');

    if (filled.password) this._log(`Password filled (${filled.method})`);
    else this._log('Could not find password field — please fill manually in the browser');

    this.status = 'waiting_captcha';
    this.statusMessage = 'Please solve CAPTCHA and enter OTP in the browser window, then click "I\'ve Completed Login" here.';
    this._log('Waiting for manual CAPTCHA + OTP');

    return { filled, status: this.status, message: this.statusMessage };
  }

  /**
   * Step 2: Check if login succeeded
   */
  async confirmLogin() {
    if (!this.page) throw new Error('No browser page open');

    this._log('Checking login status...');
    await new Promise(r => setTimeout(r, 2000));

    const currentUrl = this.page.url();
    this._log(`Current URL: ${currentUrl}`);

    // Check page content for signs of authentication
    const authCheck = await this.page.evaluate(() => {
      const bodyText = document.body?.innerText || '';
      const hasLogout = bodyText.toLowerCase().includes('logout') || bodyText.toLowerCase().includes('sign out');
      const hasDashboard = bodyText.toLowerCase().includes('dashboard') || bodyText.toLowerCase().includes('my workspace');
      const hasWelcome = bodyText.toLowerCase().includes('welcome');
      const stillOnLogin = document.querySelector('input[type="password"]')?.offsetParent !== null;
      return { hasLogout, hasDashboard, hasWelcome, stillOnLogin };
    });

    const isLoggedIn = (authCheck.hasLogout || authCheck.hasDashboard || authCheck.hasWelcome) && !authCheck.stillOnLogin;

    if (isLoggedIn) {
      this.status = 'logged_in';
      this.statusMessage = 'Logged into MCA portal!';
      this._log('Login confirmed — session active');
    } else if (authCheck.stillOnLogin) {
      this.status = 'waiting_captcha';
      this.statusMessage = 'Still on login page. Please complete CAPTCHA/OTP and click Login on the MCA site.';
      this._log('Still on login page');
    } else {
      // Might be logged in but page doesn't have clear indicators — trust the user
      this.status = 'logged_in';
      this.statusMessage = 'Login check inconclusive — assuming logged in. Navigate to SPICe+ form when ready.';
      this._log('Login check inconclusive — proceeding');
    }

    return { loggedIn: isLoggedIn || !authCheck.stillOnLogin, url: currentUrl, status: this.status };
  }

  /**
   * Step 3: Navigate to SPICe+ Part A and fill the form
   */
  async fillSpicePlusForm(caseData, directors = [], options = {}) {
    if (!this.page) throw new Error('No browser page open');

    this.status = 'filling_form';
    this.statusMessage = 'Navigating to SPICe+ Part A...';

    // Try navigating to SPICe+ form
    const spiceUrl = 'https://www.mca.gov.in/content/mca/global/en/mca/spice-plus-parta.html';
    this._log(`Navigating to SPICe+ form: ${spiceUrl}`);

    try {
      await this.page.goto(spiceUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (err) {
      this._log(`Navigation issue: ${err.message} — continuing`);
    }

    // Wait for AEM form to render
    this._log('Waiting for AEM form to render...');
    await new Promise(r => setTimeout(r, 8000));

    // Build field values from case data
    const values = buildFieldValues(caseData, directors, options);
    this._log(`Prepared ${Object.keys(values).length} field values from case data`);

    // Fill each field using the robust extension approach
    const results = [];

    for (const fieldDef of SPICE_PART_A_FIELDS) {
      const rawValue = values[fieldDef.dataKey] ?? '';
      if (!rawValue && fieldDef.optional) {
        results.push({ key: fieldDef.key, label: fieldDef.label, status: 'skipped', reason: 'Optional — no value' });
        continue;
      }
      if (!rawValue) {
        results.push({ key: fieldDef.key, label: fieldDef.label, status: 'skipped', reason: 'No value in case data' });
        continue;
      }

      try {
        // Small pause between fields
        await new Promise(r => setTimeout(r, 500));

        const fillResult = await this.page.evaluate((selector, value, type) => {
          function findUsable(selectorList) {
            for (const sel of selectorList.split(',').map(s => s.trim())) {
              try {
                const els = document.querySelectorAll(sel);
                for (const el of els) {
                  if (el.type !== 'hidden' && !el.disabled && el.getClientRects().length > 0) {
                    return el;
                  }
                }
              } catch {}
            }
            return null;
          }

          function findAll(selectorList) {
            const matches = [];
            for (const sel of selectorList.split(',').map(s => s.trim())) {
              try { document.querySelectorAll(sel).forEach(el => { if (el.getClientRects().length > 0) matches.push(el); }); } catch {}
            }
            return matches;
          }

          function nativeFill(el, val) {
            const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            if (setter) setter.call(el, val);
            else el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }

          const el = findUsable(selector);
          if (!el) return { success: false, reason: 'Field not found on page' };

          const tag = el.tagName.toLowerCase();

          if (type === 'radio') {
            const all = findAll(selector);
            const norm = String(value).trim().toLowerCase().replace(/[_-]+/g, ' ');
            const match = all.find(r => {
              const labels = [r.value, r.getAttribute('aria-label')];
              if (r.labels) labels.push(...Array.from(r.labels, l => l.textContent));
              if (r.nextElementSibling) labels.push(r.nextElementSibling.textContent);
              return labels.some(l => (l || '').trim().toLowerCase().replace(/[_-]+/g, ' ') === norm);
            });
            if (!match) return { success: false, reason: `No radio matches "${value}"` };
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')?.set;
            if (setter) setter.call(match, true); else match.checked = true;
            match.dispatchEvent(new Event('input', { bubbles: true }));
            match.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true };
          }

          if (tag === 'select') {
            const opts = Array.from(el.options);
            const norm = String(value).trim().toLowerCase();
            const match = opts.find(o => o.value === String(value)) ||
                          opts.find(o => o.textContent.trim().toLowerCase() === norm);
            if (!match) return { success: false, reason: `Option "${value}" not in dropdown` };
            el.value = match.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true };
          }

          // Text / textarea
          nativeFill(el, value);
          return { success: true };
        }, fieldDef.selector, rawValue, fieldDef.type || 'text');

        if (fillResult.success) {
          this._log(`Filled: ${fieldDef.label} = "${rawValue}"`);
          results.push({ key: fieldDef.key, label: fieldDef.label, status: 'filled', value: rawValue });
        } else {
          this._log(`Skip: ${fieldDef.label} — ${fillResult.reason}`);
          results.push({ key: fieldDef.key, label: fieldDef.label, status: 'skipped', reason: fillResult.reason });
        }

        // Extra wait after dropdowns for dependent fields to load
        if (fieldDef.type === 'select') {
          await new Promise(r => setTimeout(r, 1500));
        }
      } catch (err) {
        this._log(`Error on ${fieldDef.label}: ${err.message}`);
        results.push({ key: fieldDef.key, label: fieldDef.label, status: 'error', reason: err.message });
      }
    }

    const filledCount = results.filter(r => r.status === 'filled').length;
    this.status = 'form_filled';
    this.statusMessage = `Form filled: ${filledCount}/${SPICE_PART_A_FIELDS.length} fields. Please review and submit.`;
    this._log(this.statusMessage);

    return { results, total: SPICE_PART_A_FIELDS.length, success: filledCount, status: this.status };
  }

  async takeScreenshot() {
    if (!this.page) throw new Error('No browser page open');
    const buffer = await this.page.screenshot({ encoding: 'base64', fullPage: false });
    return `data:image/png;base64,${buffer}`;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.status = 'idle';
      this.statusMessage = 'Browser closed';
      this._log('Browser closed');
    }
  }
}

export const mcaAutomation = new McaAutomationService();
