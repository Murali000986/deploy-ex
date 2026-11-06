class Validator {
  static validateField(f, value) {
    if (value === undefined || value === null || value === '') {
      return f.required
        ? { valid: false, error: `${f.label} is required` }
        : { valid: true };
    }

    const v = String(value);

    if (f.maxLength && v.length > f.maxLength) {
      return { valid: false, error: `${f.label} exceeds max length ${f.maxLength}` };
    }

    if (f.validation && !f.validation.test(v)) {
      return { valid: false, error: `${f.label} format invalid` };
    }

    if (f.type === 'date' && !this.isValidDate(v)) {
      return { valid: false, error: `${f.label} invalid date` };
    }

    if (f.type === 'email' && !this.isValidEmail(v)) {
      return { valid: false, error: `${f.label} invalid email` };
    }

    if (f.type === 'radio' && f.values && !f.values.includes(v)) {
      return { valid: false, error: `${f.label} must be one of ${f.values.join(', ')}` };
    }

    if (f.type === 'select' && f.options && !f.options.includes(v)) {
      return { valid: false, error: `${f.label} must be a valid option` };
    }

    return { valid: true };
  }

  static validateAll(data, mappings) {
    const errors = [];
    for (const f of mappings) {
      const r = this.validateField(f, data[f.pdfField]);
      if (!r.valid) errors.push({ field: f.id, error: r.error });
    }
    return { isValid: errors.length === 0, errors };
  }

  static isValidDate(s) {
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(s)) return true;
    const d = new Date(s);
    return d instanceof Date && !isNaN(d);
  }

  static isValidEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  static normalizeCurrency(v) {
    if (v === undefined || v === null) return 0;
    const n = parseInt(String(v).replace(/[^\d\-]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  static normalizeDate(s) {
    if (!s) return null;
    const parts = String(s).trim().split(/[\/\-\.]/);
    if (parts.length !== 3) return null;

    let d, m, y;
    if (parts[0].length === 4) {
      [y, m, d] = parts;
    } else if (parseInt(parts[0], 10) > 12) {
      [d, m, y] = parts;
    } else {
      [d, m, y] = parts;
    }

    d = String(d).padStart(2, '0');
    m = String(m).padStart(2, '0');
    y = String(y);
    if (y.length === 2) y = (parseInt(y, 10) > 50 ? '19' : '20') + y;

    return `${d}/${m}/${y}`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Validator };
}
