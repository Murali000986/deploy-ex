// Requires pdf.js loaded as `pdfjsLib` (libs/pdf.min.js in popup.html).
class PDFExtractor {
  static async _initWorker() {
    if (!self.pdfjsLib) throw new Error('pdf.js library not loaded');
    const workerUrl = chrome.runtime.getURL('libs/pdf.worker.min.js');
    self.pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  }

  static async extractText(pdfFile) {
    await this._initWorker();
    const buf = await pdfFile.arrayBuffer();
    const pdf = await self.pdfjsLib.getDocument({ data: buf }).promise;
    let full = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      full += '\n' + tc.items.map(it => it.str).join(' ');
    }
    return full;
  }

  static parse(rawText, mappings) {
    const data = {};
    for (const m of mappings) {
      if (!m.pattern) continue;
      try {
        const re = new RegExp(m.pattern, 'i');
        const hit = rawText.match(re);
        if (hit) {
          const raw = (hit[1] ?? hit[0]).trim();
          data[m.pdfField] = this._normalize(m, raw);
        }
      } catch (e) {
        console.warn('Bad pattern for', m.id, e);
      }
    }
    return data;
  }

  static _normalize(m, val) {
    if (m.type === 'number') return String(Validator.normalizeCurrency(val));
    if (m.type === 'date') return Validator.normalizeDate(val) || val;
    return val.replace(/\s+/g, ' ').trim();
  }

  static async extract(pdfFile, mappings = FIELD_MAPPINGS) {
    const raw = await this.extractText(pdfFile);
    const data = this.parse(raw, mappings);
    return { raw, data };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PDFExtractor };
}
