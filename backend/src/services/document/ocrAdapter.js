import fs from 'fs';
import path from 'path';
import { config } from '../../config/env.js';

class BaseOcrAdapter {
  async extractText(filePath, mimeType) {
    throw new Error('extractText method must be implemented');
  }
}

/**
 * Real OCR Adapter using Tesseract.js for actual image/PDF text extraction.
 */
export class TesseractOcrAdapter extends BaseOcrAdapter {
  constructor() {
    super();
    this._worker = null;
  }

  async _getWorker() {
    if (this._worker) return this._worker;
    const Tesseract = await import('tesseract.js');
    this._worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\r[OCR] Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    return this._worker;
  }

  async extractText(filePath, mimeType) {
    if (!filePath || !fs.existsSync(filePath)) {
      return { text: '', readabilityScore: 0.1, isReadable: false, error: `File not found: ${filePath}` };
    }

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      return { text: '', readabilityScore: 0.1, isReadable: false, error: 'Document is empty (0 bytes)' };
    }

    // Check if file is already plain text (synthetic/mock documents)
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const printableRatio = (raw.match(/[\x20-\x7E\n\r\t]/g) || []).length / raw.length;
      if (printableRatio > 0.85 && raw.length > 10) {
        console.log(`[OCR] File is readable text (${(printableRatio * 100).toFixed(0)}% printable), skipping Tesseract.`);
        return { text: raw, readabilityScore: 0.95, isReadable: true };
      }
    } catch (e) { /* binary file, proceed to OCR */ }

    console.log(`[OCR] Starting Tesseract on: ${path.basename(filePath)} (${mimeType || 'auto'})`);

    try {
      const worker = await this._getWorker();

      // Run Tesseract directly on the original image - no preprocessing
      // PAN/Aadhaar cards are colored documents; aggressive preprocessing destroys them
      let data;
      try {
        const result = await worker.recognize(filePath);
        data = result.data;
      } catch (ocrErr) {
        console.warn(`[OCR] Tesseract failed: ${ocrErr.message}`);
        // Last resort: try reading as text
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          if (raw.length > 5) return { text: raw, readabilityScore: 0.80, isReadable: true };
        } catch (e) { /* truly binary and unreadable */ }
        return { text: '', readabilityScore: 0.1, isReadable: false, error: 'Could not process file. Upload a clear JPG/PNG image.' };
      }

      const rawText = (data.text || '').trim();
      const confidence = data.confidence || 0;

      // Smart readability: don't rely solely on Tesseract confidence.
      // Indian ID cards have Hindi + English text, which tanks confidence even when
      // the English extraction is perfectly usable.
      const cleanText = rawText.replace(/[^a-zA-Z0-9\s]/g, '').trim();
      const englishWords = cleanText.split(/\s+/).filter(w => w.length > 1);
      const hasIdentityMarkers = /PAN|AADHAAR|INCOME\s*TAX|PERMANENT|ACCOUNT|GOVERNMENT|INDIA|NAME|FATHER|DOB|BIRTH/i.test(rawText);
      const hasPanNumber = /[A-Z]{5}[0-9]{4}[A-Z]/.test(rawText);
      const hasAadhaarNumber = /\d{4}\s?\d{4}\s?\d{4}/.test(rawText);

      // Compute a content-based readability score
      let readabilityScore;
      if (hasIdentityMarkers && (hasPanNumber || hasAadhaarNumber || englishWords.length >= 5)) {
        // Strong identity document - usable regardless of Tesseract confidence
        readabilityScore = Math.max(0.80, confidence / 100);
      } else if (englishWords.length >= 8) {
        // Decent text extraction
        readabilityScore = Math.max(0.70, confidence / 100);
      } else if (englishWords.length >= 3) {
        readabilityScore = Math.max(0.50, confidence / 100);
      } else {
        readabilityScore = confidence / 100;
      }

      console.log(`\n[OCR] Done: ${englishWords.length} words, confidence=${confidence}%, score=${readabilityScore.toFixed(2)}, markers=${hasIdentityMarkers}, PAN=${hasPanNumber}`);

      if (englishWords.length < 2 && rawText.length < 10) {
        return {
          text: rawText,
          readabilityScore: 0.1,
          isReadable: false,
          error: 'No readable text found. Please upload a clearer image.'
        };
      }

      return {
        text: rawText,
        readabilityScore,
        isReadable: readabilityScore >= 0.30,
        wordCount: englishWords.length,
        confidence,
        hasIdentityMarkers,
        hasPanNumber,
        hasAadhaarNumber
      };
    } catch (err) {
      console.error('[OCR Error]', err.message);
      return { text: '', readabilityScore: 0.1, isReadable: false, error: `OCR failed: ${err.message}` };
    }
  }

  async terminate() {
    if (this._worker) {
      await this._worker.terminate();
      this._worker = null;
    }
  }
}

/**
 * Mock OCR Adapter for development and synthetic documents
 */
export class MockOcrAdapter extends BaseOcrAdapter {
  async extractText(filePath, mimeType) {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        return { text: '', readabilityScore: 0.1, isReadable: false, error: 'Document is empty' };
      }
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        if (raw.includes('PAN') || raw.includes('DIRECTOR') || raw.includes('COMPANY') || raw.includes('NAME:')) {
          return { text: raw, readabilityScore: 0.98, isReadable: true };
        }
      } catch (e) { /* not text */ }
    }

    const filename = (filePath || '').toLowerCase();
    if (filename.includes('unreadable') || filename.includes('corrupt')) {
      return { text: '### CORRUPTED SCAN ###', readabilityScore: 0.25, isReadable: false, error: 'Scan quality too low.' };
    }
    if (filename.includes('pan')) {
      return {
        text: `INCOME TAX DEPARTMENT - GOVT OF INDIA\nPermanent Account Number: ABCDE1234F\nName: RAJESH SHARMA\nFather's Name: SURESH SHARMA\nDOB: 15/08/1985`,
        readabilityScore: 0.96, isReadable: true
      };
    }
    if (filename.includes('aadhaar')) {
      return {
        text: `GOVERNMENT OF INDIA - UNIQUE IDENTIFICATION AUTHORITY\nName: RAJESH SHARMA\nDOB: 15/08/1985\nGender: Male\nAadhaar Number: 1234 5678 9012\nAddress: Flat 402, Lotus Towers, Andheri East, Mumbai, Maharashtra 400069`,
        readabilityScore: 0.94, isReadable: true
      };
    }
    return {
      text: `PROPOSED INCORPORATION DETAILS\nProposed Company Name: Apex Cloud Technologies Private Limited\nState: Maharashtra\nDistrict: Mumbai Suburban\nAuthorized Capital: INR 5,00,000\nDirector 1: Rajesh Sharma (PAN: ABCDE1234F)\nDirector 2: Priya Sharma (PAN: FGHIJ5678K)`,
      readabilityScore: 0.95, isReadable: true
    };
  }
}

export function getOcrAdapter() {
  const provider = config.ai.ocrProvider;
  switch (provider) {
    case 'tesseract':
      return new TesseractOcrAdapter();
    case 'mock':
    default:
      return new MockOcrAdapter();
  }
}
