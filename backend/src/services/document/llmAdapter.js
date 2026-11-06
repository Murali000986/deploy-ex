import fs from 'fs';
import path from 'path';
import { config } from '../../config/env.js';

class BaseLlmAdapter {
  async extractEntities(rawText, sourceDocName) {
    throw new Error('extractEntities must be implemented');
  }
}

/**
 * Enhanced LLM Extraction Adapter with smart document-type detection
 * and specialized parsers for Indian identity documents.
 */
export class MockLlmAdapter extends BaseLlmAdapter {
  async extractEntities(rawText, sourceDocName = 'attachment.pdf') {
    const text = rawText || '';
    const fields = [];

    const addField = (key, value, confidence, entityType = 'COMPANY', entityIndex = 0, flagReason = null) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        fields.push({
          fieldKey: key,
          extractedValue: String(value).trim(),
          confidence,
          entityType,
          entityIndex,
          sourceDocumentName: sourceDocName,
          flaggedForReview: confidence < 0.85 || Boolean(flagReason),
          flagReason
        });
      }
    };

    // Detect document type from content
    const docType = this._detectDocumentType(text, sourceDocName);
    console.log(`[LLM Extractor] Detected document type: ${docType} from "${sourceDocName}"`);

    switch (docType) {
      case 'PAN':
        this._extractPanCard(text, fields, addField);
        break;
      case 'AADHAAR':
        this._extractAadhaarCard(text, fields, addField);
        break;
      case 'DRIVING_LICENSE':
        this._extractDrivingLicense(text, fields, addField);
        break;
      case 'GST':
        this._extractGstCertificate(text, fields, addField);
        break;
      default:
        this._extractGenericDocument(text, fields, addField);
        break;
    }

    return {
      success: true,
      documentType: docType,
      fieldsCount: fields.length,
      fields
    };
  }

  _detectDocumentType(text, filename) {
    const upper = text.toUpperCase();
    const fname = (filename || '').toLowerCase();

    if (fname.includes('pan') || upper.includes('PERMANENT ACCOUNT NUMBER') ||
        upper.includes('INCOME TAX DEPARTMENT') || upper.includes('INCOME TAX PAN') ||
        /\bPAN\b/.test(upper)) {
      return 'PAN';
    }
    if (fname.includes('aadhaar') || fname.includes('aadhar') || fname.includes('uid') ||
        upper.includes('UNIQUE IDENTIFICATION') || upper.includes('AADHAAR') ||
        upper.includes('UIDAI') || /\d{4}\s?\d{4}\s?\d{4}/.test(text)) {
      return 'AADHAAR';
    }
    if (fname.includes('driv') || fname.includes('license') || fname.includes('dl') ||
        upper.includes('DRIVING LICENCE') || upper.includes('DRIVING LICENSE') ||
        upper.includes('TRANSPORT')) {
      return 'DRIVING_LICENSE';
    }
    if (fname.includes('gst') || upper.includes('GOODS AND SERVICES TAX') ||
        upper.includes('GSTIN') || /\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d][A-Z]/.test(text)) {
      return 'GST';
    }
    return 'GENERAL';
  }

  _extractPanCard(text, fields, addField) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // PAN Number - strict AAAAA0000A, also try common OCR errors (I↔1, O↔0)
    let panMatch = text.match(/([A-Z]{5}[0-9]{4}[A-Z])/);
    if (!panMatch) {
      // Try fixing common OCR substitutions
      const cleaned = text.replace(/[Il|]/g, '1').replace(/[Oo]/g, '0');
      panMatch = cleaned.match(/([A-Z]{5}[0-9]{4}[A-Z])/);
    }
    if (panMatch) {
      addField('director_pan', panMatch[1], 0.96, 'DIRECTOR', 0);
    }

    // Name extraction - scan lines for sequences of 2+ uppercase words
    // Real OCR output has names as capitalized words mixed with garbage
    const skipWords = new Set(['INCOME', 'TAX', 'DEPARTMENT', 'GOVT', 'INDIA', 'PERMANENT',
      'ACCOUNT', 'NUMBER', 'CARD', 'GOVERNMENT', 'SIGNATURE', 'DATE', 'BIRTH', 'DOB',
      'NAME', 'FATHER', 'NAAM', 'OF', 'THE', 'AND', 'FOR', 'FROM']);

    let foundName = null;
    let foundFather = null;
    let fatherLineNext = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if this line mentions "Father" - next clean name line is the father
      if (/father/i.test(line)) {
        fatherLineNext = true;
        // Also try to extract father's name from same line after the label
        const afterLabel = line.replace(/.*(?:Father'?s?\s*Name|Father)\s*/i, '').trim();
        const fatherInline = this._extractNameFromText(afterLabel, skipWords);
        if (fatherInline) {
          foundFather = fatherInline;
          fatherLineNext = false;
        }
        continue;
      }

      // Extract name-like text from this line
      const nameCandidate = this._extractNameFromText(line, skipWords);
      if (!nameCandidate) continue;

      if (fatherLineNext) {
        foundFather = nameCandidate;
        fatherLineNext = false;
      } else if (!foundName) {
        // First name-like text after header lines = cardholder name
        const isHeaderLine = /INCOME|TAX|DEPARTMENT|GOVT|PERMANENT|ACCOUNT|NUMBER/i.test(line);
        if (!isHeaderLine) {
          foundName = nameCandidate;
        }
      }
    }

    // Fallback: try regex on "Name" label
    if (!foundName) {
      const m = text.match(/(?:Name|Naam)\s*[:\-\/]?\s*([A-Z][A-Za-z\s]{2,30})/i);
      if (m) foundName = m[1].trim().replace(/\s+/g, ' ');
    }

    if (foundName) addField('director_name', this._titleCase(foundName), 0.90, 'DIRECTOR', 0);
    if (foundFather) addField('director_father_name', this._titleCase(foundFather), 0.85, 'DIRECTOR', 0);

    // Date of Birth - find DD/MM/YYYY pattern anywhere
    const dobMatch = text.match(/(\d{1,2}[\s\/\-\.]\d{1,2}[\s\/\-\.]\d{4})/);
    if (dobMatch) {
      addField('director_dob', dobMatch[1].trim(), 0.88, 'DIRECTOR', 0);
    }

    this._extractCompanyFields(text, fields, addField);
  }

  _extractNameFromText(text, skipWords) {
    // Find sequences of 2+ uppercase words (Indian names are typically 2-3 words)
    const matches = text.match(/\b([A-Z][A-Z]+(?:\s+[A-Z][A-Z]+)+)\b/);
    if (matches) {
      const words = matches[1].split(/\s+/).filter(w => w.length >= 2 && !skipWords.has(w));
      if (words.length >= 2) return words.join(' ');
    }
    // Try mixed case: "Sample Kumar", "Aakash Dhurve"
    const mixedMatch = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/);
    if (mixedMatch) {
      const words = mixedMatch[1].split(/\s+/).filter(w => w.length >= 2 && !skipWords.has(w.toUpperCase()));
      if (words.length >= 2) return words.join(' ');
    }
    return null;
  }

  _extractAadhaarCard(text, fields, addField) {
    // Aadhaar Number - 12 digits (may have spaces)
    const aadhaarMatch = text.match(/(\d{4}\s?\d{4}\s?\d{4})/);
    if (aadhaarMatch) {
      const aadhaarNum = aadhaarMatch[1].replace(/\s/g, '');
      if (aadhaarNum.length === 12) {
        addField('director_aadhaar', aadhaarNum, 0.96, 'DIRECTOR', 0);
      }
    }

    // VID (Virtual ID) - 16 digits
    const vidMatch = text.match(/(?:VID|Virtual\s*ID)\s*[:\-]?\s*(\d{4}\s?\d{4}\s?\d{4}\s?\d{4})/i);
    if (vidMatch) {
      addField('director_vid', vidMatch[1].replace(/\s/g, ''), 0.90, 'DIRECTOR', 0);
    }

    // Name
    const namePatterns = [
      /(?:^|\n)\s*(?:Name|Naam)\s*[:\-]?\s*([A-Za-z][A-Za-z\s.]+?)(?:\n|$)/im,
      /(?:INDIA|AUTHORITY|UIDAI)\s*\n+\s*([A-Z][A-Z\s]{2,30})\s*\n/i,
    ];
    for (const pattern of namePatterns) {
      const m = text.match(pattern);
      if (m && m[1]) {
        const candidate = m[1].trim().replace(/\s+/g, ' ');
        if (candidate.length > 2 && candidate.length < 50 &&
            !candidate.includes('GOVERNMENT') && !candidate.includes('UNIQUE') &&
            !candidate.includes('IDENTIFICATION') && !candidate.includes('AUTHORITY')) {
          addField('director_name', this._titleCase(candidate), 0.92, 'DIRECTOR', 0);
          break;
        }
      }
    }

    // DOB
    const dobMatch = text.match(/(?:DOB|Date\s*of\s*Birth|Year\s*of\s*Birth|Birth)\s*[:\-]?\s*(\d{1,2}[\s\/\-\.]\d{1,2}[\s\/\-\.]\d{2,4}|\d{4})/i);
    if (dobMatch) {
      addField('director_dob', dobMatch[1].trim(), 0.88, 'DIRECTOR', 0);
    }

    // Gender
    const genderMatch = text.match(/(?:Gender|Sex|Linag)\s*[:\-]?\s*(Male|Female|MALE|FEMALE|Transgender|पुरुष|महिला)/i);
    if (genderMatch) {
      addField('director_gender', genderMatch[1].trim(), 0.95, 'DIRECTOR', 0);
    }

    // Address
    const addressPatterns = [
      /(?:Address|Pata)\s*[:\-]?\s*(.+?)(?:\n\s*\n|\d{4}\s?\d{4}\s?\d{4}|$)/is,
    ];
    for (const pattern of addressPatterns) {
      const m = text.match(pattern);
      if (m && m[1]) {
        const addr = m[1].replace(/\n/g, ', ').replace(/\s+/g, ' ').trim();
        if (addr.length > 10 && addr.length < 300) {
          addField('director_address', addr, 0.85, 'DIRECTOR', 0);

          // Extract PIN code from address
          const pinMatch = addr.match(/(\d{6})/);
          if (pinMatch) {
            addField('registered_office_pin', pinMatch[1], 0.90, 'COMPANY', 0);
          }

          // Extract state from address
          const states = ['Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat',
            'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Madhya Pradesh', 'Bihar',
            'Andhra Pradesh', 'Telangana', 'Kerala', 'Punjab', 'Haryana',
            'Jharkhand', 'Chhattisgarh', 'Uttarakhand', 'Goa', 'Odisha',
            'Assam', 'Himachal Pradesh', 'Jammu', 'Kashmir'];
          for (const state of states) {
            if (addr.toLowerCase().includes(state.toLowerCase())) {
              addField('registered_office_state', state, 0.88);
              break;
            }
          }
          break;
        }
      }
    }

    this._extractCompanyFields(text, fields, addField);
  }

  _extractDrivingLicense(text, fields, addField) {
    // DL Number
    const dlMatch = text.match(/(?:DL\s*No|License\s*No|Licence\s*No|D\.L\.)\s*[:\-]?\s*([A-Z]{2}\d{2}\s?\d{4,}\d*)/i);
    if (dlMatch) {
      addField('director_dl_number', dlMatch[1].replace(/\s/g, ''), 0.92, 'DIRECTOR', 0);
    }

    // Name
    const nameMatch = text.match(/(?:Name|Naam)\s*[:\-]?\s*([A-Za-z][A-Za-z\s.]+?)(?:\n|$)/im);
    if (nameMatch) {
      addField('director_name', this._titleCase(nameMatch[1].trim()), 0.90, 'DIRECTOR', 0);
    }

    // DOB
    const dobMatch = text.match(/(?:DOB|Date\s*of\s*Birth)\s*[:\-]?\s*(\d{1,2}[\s\/\-\.]\d{1,2}[\s\/\-\.]\d{2,4})/i);
    if (dobMatch) {
      addField('director_dob', dobMatch[1].trim(), 0.88, 'DIRECTOR', 0);
    }

    // Address
    const addrMatch = text.match(/(?:Address|Add)\s*[:\-]?\s*(.+?)(?:\n\s*\n|$)/is);
    if (addrMatch) {
      addField('director_address', addrMatch[1].replace(/\n/g, ', ').trim(), 0.82, 'DIRECTOR', 0);
    }

    this._extractCompanyFields(text, fields, addField);
  }

  _extractGstCertificate(text, fields, addField) {
    // GSTIN
    const gstMatch = text.match(/(\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d][A-Z])/);
    if (gstMatch) {
      addField('gstin', gstMatch[1], 0.97);
      // Extract PAN from GSTIN (characters 3-12)
      const panFromGst = gstMatch[1].substring(2, 12);
      addField('director_pan', panFromGst, 0.95, 'DIRECTOR', 0);
    }

    // Legal Name
    const legalMatch = text.match(/(?:Legal\s*Name|Trade\s*Name|Business\s*Name)\s*[:\-]?\s*(.+?)(?:\n|$)/i);
    if (legalMatch) {
      addField('proposed_company_name', legalMatch[1].trim(), 0.93);
    }

    this._extractCompanyFields(text, fields, addField);
  }

  _extractCompanyFields(text, fields, addField) {
    const existingKeys = new Set(fields.map(f => f.fieldKey));

    // Proposed Company Name (only match explicit company name labels, not generic "Name:")
    if (!existingKeys.has('proposed_company_name')) {
      const nameMatch = text.match(/(?:Proposed Company Name|Company Name|Trade Name|Legal Name|Business Name)[:\s]+([^\n\r]+)/i);
      if (nameMatch) {
        const candidate = nameMatch[1].trim();
        if (candidate.length > 5 && (candidate.toLowerCase().includes('private') ||
            candidate.toLowerCase().includes('limited') || candidate.toLowerCase().includes('llp') ||
            candidate.toLowerCase().includes('pvt') || candidate.toLowerCase().includes('inc') ||
            candidate.toLowerCase().includes('technologies') || candidate.toLowerCase().includes('solutions') ||
            candidate.toLowerCase().includes('ventures') || candidate.toLowerCase().includes('enterprises'))) {
          addField('proposed_company_name', candidate, 0.94);
        }
      }
    }

    // State & District
    if (!existingKeys.has('registered_office_state')) {
      const stateMatch = text.match(/(?:State)[:\s]+([^\n\r,]+)/i);
      if (stateMatch) addField('registered_office_state', stateMatch[1].trim(), 0.92);
    }
    if (!existingKeys.has('registered_office_district')) {
      const districtMatch = text.match(/(?:District)[:\s]+([^\n\r,]+)/i);
      if (districtMatch) addField('registered_office_district', districtMatch[1].trim(), 0.90);
    }

    // Capital
    const capitalMatch = text.match(/(?:Authorized Capital|Capital)[:\s]+(?:INR\s*)?([0-9,]+)/i);
    if (capitalMatch) {
      addField('authorized_capital', capitalMatch[1].replace(/,/g, ''), 0.95);
    }

    // Additional directors from structured text
    const dirMatches = [...text.matchAll(/(?:Director\s*(\d+)?:?\s*|Name:\s*)([A-Za-z\s]+?)(?:\s*\(|\s*\n|\s*Father)/gi)];
    const panMatches = [...text.matchAll(/([A-Z]{5}[0-9]{4}[A-Z])/g)];
    const pans = [...new Set(panMatches.map(m => m[1]))];
    const existingPans = new Set(fields.filter(f => f.fieldKey === 'director_pan').map(f => f.extractedValue));
    const existingNames = new Set(fields.filter(f => f.fieldKey === 'director_name').map(f => f.extractedValue.toUpperCase()));

    let dirIndex = fields.filter(f => f.entityType === 'DIRECTOR' && f.fieldKey === 'director_name').length;

    for (const match of dirMatches) {
      const candidateName = match[2].trim();
      if (candidateName.length > 2 && !candidateName.toUpperCase().includes('PROPOSED') &&
          !candidateName.toUpperCase().includes('INCOME TAX') &&
          !existingNames.has(candidateName.toUpperCase())) {
        const pan = pans.find(p => !existingPans.has(p));
        addField('director_name', candidateName, 0.92, 'DIRECTOR', dirIndex);
        if (pan) {
          addField('director_pan', pan, 0.98, 'DIRECTOR', dirIndex);
          existingPans.add(pan);
        }
        existingNames.add(candidateName.toUpperCase());
        dirIndex++;
        if (dirIndex >= 4) break;
      }
    }
  }

  _titleCase(str) {
    return str.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
  }
}

/**
 * Groq Cloud LLM Adapter (Ultra-Fast Llama-3.3-70b-versatile)
 */
export class GroqLlmAdapter extends BaseLlmAdapter {
  constructor() {
    super();
    this.apiKey = config.ai.groqApiKey;
    this.model = config.ai.groqModel || 'llama-3.3-70b-versatile';
    this.fallbackAdapter = new MockLlmAdapter();
  }

  async extractEntities(rawText, sourceDocName = 'attachment.pdf') {
    if (!this.apiKey) {
      console.warn('[Groq LLM] No GROQ_API_KEY detected. Using enhanced heuristic extraction.');
      return this.fallbackAdapter.extractEntities(rawText, sourceDocName);
    }

    try {
      console.log(`[Groq LLM] Dispatching extraction to Groq (${this.model})...`);
      const systemPrompt = `You are an expert Indian document data extractor. You extract structured data from OCR text of Indian identity documents (PAN Card, Aadhaar Card, Driving License, GST Certificate) and company incorporation documents.

Extract ALL available fields from the raw OCR text. Return a valid JSON object:
{
  "document_type": "PAN" | "AADHAAR" | "DRIVING_LICENSE" | "GST" | "GENERAL",
  "proposed_company_name": string or null,
  "registered_office_state": string or null,
  "registered_office_district": string or null,
  "authorized_capital": number or null,
  "directors": [
    {
      "name": string,
      "pan": string or null,
      "aadhaar": string or null,
      "din": string or null,
      "dob": string or null,
      "father_name": string or null,
      "address": string or null,
      "gender": string or null,
      "confidence": number between 0.0 and 1.0,
      "flag_reason": string or null
    }
  ],
  "name_confidence": number,
  "state_confidence": number,
  "raw_summary": string (2-3 line human-readable summary of what was found)
}

CRITICAL RULES:
1. Never hallucinate or invent data not present in OCR text.
2. OCR text may have errors - try to correct obvious OCR mistakes (0 vs O, 1 vs I, etc).
3. Valid Indian PAN: 5 uppercase letters + 4 digits + 1 uppercase letter (e.g. ABCDE1234F).
4. Valid Aadhaar: 12 digits (may have spaces: 1234 5678 9012).
5. If a field is not found in text, set it to null.
6. Confidence should reflect OCR quality and extraction certainty.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Extract all data from document [${sourceDocName}]:\n\n${rawText}` }
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Groq API Error HTTP ${response.status}: ${errText}`);
      }

      const resData = await response.json();
      const content = resData.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content);

      const fields = [];
      if (parsed.proposed_company_name) {
        fields.push({
          fieldKey: 'proposed_company_name', extractedValue: parsed.proposed_company_name,
          confidence: parsed.name_confidence || 0.95, entityType: 'COMPANY', entityIndex: 0,
          sourceDocumentName: sourceDocName, flaggedForReview: (parsed.name_confidence || 0.95) < 0.85
        });
      }
      if (parsed.registered_office_state) {
        fields.push({
          fieldKey: 'registered_office_state', extractedValue: parsed.registered_office_state,
          confidence: parsed.state_confidence || 0.92, entityType: 'COMPANY', entityIndex: 0,
          sourceDocumentName: sourceDocName, flaggedForReview: false
        });
      }
      if (parsed.registered_office_district) {
        fields.push({
          fieldKey: 'registered_office_district', extractedValue: parsed.registered_office_district,
          confidence: 0.90, entityType: 'COMPANY', entityIndex: 0,
          sourceDocumentName: sourceDocName, flaggedForReview: false
        });
      }
      if (parsed.authorized_capital) {
        fields.push({
          fieldKey: 'authorized_capital', extractedValue: String(parsed.authorized_capital),
          confidence: 0.95, entityType: 'COMPANY', entityIndex: 0,
          sourceDocumentName: sourceDocName, flaggedForReview: false
        });
      }

      if (parsed.directors && Array.isArray(parsed.directors)) {
        parsed.directors.forEach((dir, idx) => {
          if (dir.name) {
            fields.push({
              fieldKey: 'director_name', extractedValue: dir.name,
              confidence: dir.confidence || 0.94, entityType: 'DIRECTOR', entityIndex: idx,
              sourceDocumentName: sourceDocName, flaggedForReview: (dir.confidence || 0.94) < 0.85
            });
          }
          if (dir.pan) {
            fields.push({
              fieldKey: 'director_pan', extractedValue: dir.pan,
              confidence: 0.98, entityType: 'DIRECTOR', entityIndex: idx,
              sourceDocumentName: sourceDocName, flaggedForReview: false
            });
          }
          if (dir.aadhaar) {
            fields.push({
              fieldKey: 'director_aadhaar', extractedValue: dir.aadhaar,
              confidence: 0.96, entityType: 'DIRECTOR', entityIndex: idx,
              sourceDocumentName: sourceDocName, flaggedForReview: false
            });
          }
          if (dir.dob) {
            fields.push({
              fieldKey: 'director_dob', extractedValue: dir.dob,
              confidence: 0.90, entityType: 'DIRECTOR', entityIndex: idx,
              sourceDocumentName: sourceDocName, flaggedForReview: false
            });
          }
          if (dir.father_name) {
            fields.push({
              fieldKey: 'director_father_name', extractedValue: dir.father_name,
              confidence: 0.88, entityType: 'DIRECTOR', entityIndex: idx,
              sourceDocumentName: sourceDocName, flaggedForReview: false
            });
          }
          if (dir.address) {
            fields.push({
              fieldKey: 'director_address', extractedValue: dir.address,
              confidence: 0.85, entityType: 'DIRECTOR', entityIndex: idx,
              sourceDocumentName: sourceDocName, flaggedForReview: false
            });
          }
          if (dir.gender) {
            fields.push({
              fieldKey: 'director_gender', extractedValue: dir.gender,
              confidence: 0.90, entityType: 'DIRECTOR', entityIndex: idx,
              sourceDocumentName: sourceDocName, flaggedForReview: false
            });
          }
        });
      }

      return {
        success: true,
        provider: 'groq',
        model: this.model,
        documentType: parsed.document_type || 'GENERAL',
        rawSummary: parsed.raw_summary || null,
        fieldsCount: fields.length,
        fields
      };
    } catch (err) {
      console.warn('[Groq LLM Fallback] Error contacting Groq API:', err.message);
      return this.fallbackAdapter.extractEntities(rawText, sourceDocName);
    }
  }
}

/**
 * Vision-based document extraction using Google Gemini.
 * Sends the actual image to the AI — no OCR needed.
 */
export class GeminiVisionAdapter {
  constructor() {
    this.apiKey = config.ai.geminiApiKey;
    this.model = config.ai.geminiModel || 'gemini-2.0-flash';
  }

  get isAvailable() {
    return Boolean(this.apiKey);
  }

  async extractFromImage(imagePath, sourceDocName = 'document.jpg') {
    if (!this.apiKey) throw new Error('GEMINI_API_KEY not configured');

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.bmp': 'image/bmp', '.webp': 'image/webp', '.tiff': 'image/tiff' };
    const mimeType = mimeMap[ext] || 'image/jpeg';

    console.log(`[Gemini Vision] Sending image ${path.basename(imagePath)} (${(imageBuffer.length / 1024).toFixed(0)} KB)...`);

    const prompt = `You are an expert Indian document data extractor. Look at this document image carefully and extract ALL visible data.

Return a valid JSON object with this exact structure:
{
  "document_type": "PAN" | "AADHAAR" | "DRIVING_LICENSE" | "VOTER_ID" | "PASSPORT" | "GST" | "GENERAL",
  "directors": [
    {
      "name": "Full name as printed on card",
      "pan": "PAN number (format: ABCDE1234F) or null",
      "aadhaar": "12 digit Aadhaar number or null",
      "dob": "Date of birth as printed or null",
      "father_name": "Father's name or null",
      "address": "Full address or null",
      "gender": "Male/Female or null",
      "confidence": 0.95
    }
  ],
  "raw_summary": "2-3 line summary of what was extracted"
}

RULES:
1. Read the ACTUAL text visible in the image. Do NOT hallucinate.
2. PAN format: exactly 5 uppercase letters + 4 digits + 1 uppercase letter.
3. Aadhaar: exactly 12 digits (may have spaces).
4. Extract name, father's name, DOB exactly as printed.
5. Set confidence based on how clearly you can read each field.`;

    const modelsToTry = [this.model, 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash'];
    const uniqueModels = [...new Set(modelsToTry)];

    let parsed;
    for (const model of uniqueModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
      console.log(`[Gemini Vision] Trying model: ${model}...`);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Image } }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      });

      if (response.ok) {
        const resData = await response.json();
        const content = resData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (content) {
          parsed = JSON.parse(content);
          console.log(`[Gemini Vision] Success with ${model}`);
          break;
        }
      } else if (response.status === 503) {
        console.warn(`[Gemini Vision] ${model} overloaded, trying next...`);
        continue;
      } else {
        const errText = await response.text();
        throw new Error(`Gemini API Error ${response.status}: ${errText}`);
      }
    }

    if (!parsed) throw new Error('All Gemini models unavailable. Try again shortly.');
    console.log(`[Gemini Vision] Extracted: ${JSON.stringify(parsed, null, 2)}`);

    const fields = [];
    const addField = (key, value, confidence, entityType = 'DIRECTOR', entityIndex = 0) => {
      if (value && String(value).trim()) {
        fields.push({
          fieldKey: key, extractedValue: String(value).trim(),
          confidence, entityType, entityIndex,
          sourceDocumentName: sourceDocName,
          flaggedForReview: confidence < 0.85
        });
      }
    };

    if (parsed.directors && Array.isArray(parsed.directors)) {
      parsed.directors.forEach((dir, idx) => {
        if (dir.name) addField('director_name', dir.name, dir.confidence || 0.95, 'DIRECTOR', idx);
        if (dir.pan) addField('director_pan', dir.pan, 0.98, 'DIRECTOR', idx);
        if (dir.aadhaar) addField('director_aadhaar', dir.aadhaar, 0.96, 'DIRECTOR', idx);
        if (dir.dob) addField('director_dob', dir.dob, 0.92, 'DIRECTOR', idx);
        if (dir.father_name) addField('director_father_name', dir.father_name, 0.90, 'DIRECTOR', idx);
        if (dir.address) addField('director_address', dir.address, 0.85, 'DIRECTOR', idx);
        if (dir.gender) addField('director_gender', dir.gender, 0.90, 'DIRECTOR', idx);
      });
    }

    return {
      success: true,
      provider: 'gemini-vision',
      model: this.model,
      documentType: parsed.document_type || 'GENERAL',
      rawSummary: parsed.raw_summary || null,
      fieldsCount: fields.length,
      fields
    };
  }
}

export function getLlmAdapter() {
  const provider = (config.ai.llmProvider || 'groq').toLowerCase();
  switch (provider) {
    case 'groq':
      return new GroqLlmAdapter();
    case 'mock':
    default:
      return new MockLlmAdapter();
  }
}
