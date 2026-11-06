import assert from 'assert';
import { db } from '../src/models/db.js';
import { documentPipeline } from '../src/services/document/documentPipeline.js';
import { CASE_STATES } from '../src/services/intake/workflowStateMachine.js';

export async function testDocumentPipeline() {
  console.log('  ▸ Testing Document Processing Pipeline & Schema Validation...');

  const testPhone = '919876500002';
  let client = db.getClientByPhone(testPhone);
  if (!client) client = db.createClient({ phoneNumber: testPhone, fullName: 'Deepak Chopra' });

  const activeCase = db.createCase({ clientId: client.id });

  // 1. Clean valid document processing
  const validDoc = db.createDocument({
    caseId: activeCase.id,
    clientId: client.id,
    originalFilename: 'apex_incorporation_clean_pan.pdf',
    storedPath: './uploads/apex_clean.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 204800,
    docType: 'PAN'
  });

  const validResult = await documentPipeline.processDocument(validDoc.id);
  assert.strictEqual(validResult.success, true, 'Clean document processing should succeed');

  const fields = db.getExtractedFieldsByCaseId(activeCase.id);
  assert(fields.length > 0, 'Extracted fields must be saved to DB');

  const panField = fields.find(f => f.field_key === 'director_pan');
  assert(panField, 'Director PAN must be extracted');
  assert(panField.confidence >= 0.85, 'PAN confidence should meet threshold');

  // 2. Corrupt / Unreadable document rejection
  const corruptCase = db.createCase({ clientId: client.id });
  const corruptDoc = db.createDocument({
    caseId: corruptCase.id,
    clientId: client.id,
    originalFilename: 'unreadable_blurry_scan_corrupt.pdf',
    storedPath: './uploads/corrupt.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1024,
    docType: 'OTHER'
  });

  const corruptResult = await documentPipeline.processDocument(corruptDoc.id);
  assert.strictEqual(corruptResult.success, false, 'Unreadable document must fail extraction');

  const updatedCorruptCase = db.getCaseById(corruptCase.id);
  assert.strictEqual(
    updatedCorruptCase.status,
    CASE_STATES.NEEDS_CORRECTION,
    'Case must transition to NEEDS_CORRECTION on unreadable document'
  );

  console.log('    ✔ Document pipeline, confidence scoring, and unreadable scan rejection passed');
}
