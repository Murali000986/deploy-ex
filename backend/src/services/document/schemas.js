/**
 * Official MCA SPICe+ Part A & Part B Data Extraction Schema Definitions.
 */

export const COMPANY_TYPES = ['PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'ONE_PERSON_COMPANY', 'SECTION_8'];
export const COMPANY_CATEGORIES = ['COMPANY_LIMITED_BY_SHARES', 'COMPANY_LIMITED_BY_GUARANTEE', 'UNLIMITED_COMPANY'];

export const CONFIDENCE_THRESHOLD = 0.85;

/**
 * Validates extracted PAN format (Indian Income Tax Permanent Account Number):
 * 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)
 */
export function isValidPan(pan) {
  if (!pan || typeof pan !== 'string') return false;
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.trim().toUpperCase());
}

/**
 * Validates Indian PIN code (6 digits)
 */
export function isValidPinCode(pin) {
  if (!pin || typeof pin !== 'string') return false;
  return /^[1-9][0-9]{5}$/.test(pin.trim());
}

/**
 * Validates DIN (Director Identification Number) (8 digits)
 */
export function isValidDin(din) {
  if (!din) return true; // DIN is optional before incorporation
  return /^[0-9]{8}$/.test(String(din).trim());
}

/**
 * Full schema validation for company incorporation dossier
 */
export function validateDossierSchema(data) {
  const errors = [];
  const warnings = [];

  // 1. Proposed Company Name
  if (!data.proposedName || data.proposedName.trim().length < 3) {
    errors.push('Proposed Company Name is missing or too short');
  } else {
    const nameUpper = data.proposedName.toUpperCase();
    if (!nameUpper.includes('PRIVATE LIMITED') && !nameUpper.includes('PVT LTD') && !nameUpper.includes('LIMITED') && !nameUpper.includes('OPC')) {
      warnings.push("Proposed name does not specify entity suffix (e.g., 'Private Limited')");
    }
  }

  // 2. Registered Office
  if (!data.registeredOfficeState) {
    warnings.push('Registered office state is not specified');
  }

  // 3. Directors
  if (!data.directors || !Array.isArray(data.directors) || data.directors.length === 0) {
    errors.push('At least one director or subscriber is required');
  } else {
    data.directors.forEach((dir, idx) => {
      const dirNum = idx + 1;
      if (!dir.fullName || dir.fullName.trim().length < 2) {
        errors.push(`Director #${dirNum}: Full Name is missing`);
      }
      if (dir.pan) {
        if (!isValidPan(dir.pan)) {
          errors.push(`Director #${dirNum} (${dir.fullName || 'Unknown'}): Invalid PAN format '${dir.pan}'`);
        }
      } else {
        warnings.push(`Director #${dirNum}: PAN is not detected from uploaded identity documents`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
