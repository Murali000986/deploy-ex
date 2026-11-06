import express from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { conversationManager } from '../services/intake/conversationManager.js';
import { mockWhatsAppService } from '../services/whatsapp/mockWhatsAppService.js';
import { db } from '../models/db.js';
import { config } from '../config/env.js';

const router = express.Router();

// Configure multer for real file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = config.security.documentStorageDir;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.security.maxFileSizeBytes },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|bmp|tiff|tif|webp|pdf|doc|docx|txt)$/i;
    if (allowed.test(path.extname(file.originalname)) || file.mimetype.startsWith('image/') ||
        file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload an image or PDF.'));
    }
  }
});

// Wrap multer upload to handle errors gracefully
function uploadWithErrorHandling(req, res) {
  return new Promise((resolve, reject) => {
    upload.single('document')(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Real file upload endpoint - accepts actual image/PDF files for OCR processing
 */
router.post('/upload-document', async (req, res) => {
  try {
    await uploadWithErrorHandling(req, res);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const { senderPhone = '919876543210', senderName = 'Rajesh Sharma' } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please attach a document.' });
  }

  const filename = req.file.originalname;
  const filePath = req.file.path;
  const mimeType = req.file.mimetype;
  const fileSize = req.file.size;

  console.log(`[Upload] Real file received: ${filename} (${mimeType}, ${(fileSize / 1024).toFixed(1)} KB)`);

  const wamid = 'wamid.HBg' + crypto.randomBytes(16).toString('hex');
  const mediaId = 'media_' + crypto.randomBytes(8).toString('hex');

  // Store the real file buffer in mock media service so downloadMedia() can find it
  const fileBuffer = fs.readFileSync(filePath);
  mockWhatsAppService.storeMockMedia(fileBuffer, mimeType, filename, mediaId);

  const messageObj = {
    id: wamid,
    from: senderPhone,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    type: mimeType.startsWith('image/') ? 'image' : 'document'
  };

  messageObj[messageObj.type] = {
    id: mediaId,
    filename,
    mime_type: mimeType,
    caption: `Uploaded ${filename}`
  };

  try {
    await conversationManager.handleIncomingMessage({
      whatsappMessageId: wamid,
      senderPhone,
      senderName,
      messageObj
    });

    const client = db.getClientByPhone(senderPhone);
    const activeCase = client ? db.getActiveCaseByClientId(client.id) : null;

    // Gather extracted fields for response — filter to THIS document's fields
    const allFields = activeCase ? db.getExtractedFieldsByCaseId(activeCase.id) : [];
    const docFields = allFields.filter(f => f.source_document_name === filename);
    const docs = activeCase ? db.getDocumentsByCaseId(activeCase.id) : [];
    const doc = docs.find(d => d.original_filename === filename) || docs[docs.length - 1];

    // Build structured extraction result for frontend
    const extraction = {};
    for (const f of docFields) {
      extraction[f.field_key] = f.extracted_value;
    }

    res.json({
      success: true,
      wamid,
      filename,
      mimeType,
      fileSize,
      caseNumber: activeCase?.case_number,
      caseStatus: activeCase?.status,
      extractedFieldsCount: allFields.length,
      documentType: doc?.detected_doc_type || 'PAN',
      extraction,
      outboundCount: mockWhatsAppService.getOutboundHistory(senderPhone).length
    });
  } catch (err) {
    console.error('[Upload Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Simulate inbound message directly as if sent from Meta Webhook
 */
router.post('/simulate-inbound', async (req, res) => {
  const { senderPhone = '919876543210', senderName = 'Rajesh Sharma', type = 'text', text, filename, buttonId } = req.body;

  const wamid = 'wamid.HBg' + crypto.randomBytes(16).toString('hex');
  const messageObj = {
    id: wamid,
    from: senderPhone,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    type
  };

  if (type === 'text') {
    messageObj.text = { body: text || 'Hello, I want to incorporate a private limited company' };
  } else if (type === 'document' || type === 'image') {
    const fname = filename || 'director_pan_aadhaar.pdf';
    const clientName = senderName || 'Rajesh Sharma';
    const isSunita = senderPhone?.includes('9811223344') || clientName.includes('Sunita');
    const isVikram = senderPhone?.includes('9988776655') || clientName.includes('Vikram');
    const isAisha = senderPhone?.includes('9700001111') || clientName.includes('Aisha');

    const compName = isSunita ? 'Zenith NextGen Logistics Private Limited' :
      isVikram ? 'National Infrastructure Advisory Limited' :
      isAisha ? 'GreenLeaf Ventures Private Limited' :
      'Apex Cloud Technologies Private Limited';

    const panNum = isSunita ? 'XYZAB5678Q' :
      isVikram ? 'VIKRM1234M' :
      isAisha ? 'AISHAP9988P' :
      'ABCDE1234F';

    const stateName = isSunita ? 'Delhi' : isVikram ? 'Karnataka' : isAisha ? 'Gujarat' : 'Maharashtra';

    let ocrText = `INCOME TAX DEPARTMENT - GOVT OF INDIA\nPermanent Account Number: ${panNum}\nName: ${clientName.toUpperCase()}\nFather's Name: SURESH ${clientName.split(' ')[1] || 'SHARMA'}\nDOB: 15/08/1985\nProposed Company Name: ${compName}\nState: ${stateName}\nDirector 1: ${clientName}\nPAN: ${panNum}`;

    if (fname.includes('unreadable') || fname.includes('blurry') || fname.includes('corrupt')) {
      ocrText = '### CORRUPTED SCAN ### [BLURRY / UNREADABLE OCR]';
    }

    const stored = mockWhatsAppService.storeMockMedia(
      Buffer.from(ocrText),
      type === 'document' ? 'application/pdf' : 'image/jpeg',
      fname
    );

    messageObj[type] = {
      id: stored.id,
      filename: fname,
      mime_type: type === 'document' ? 'application/pdf' : 'image/jpeg',
      caption: `Uploaded ${fname}`
    };
  } else if (type === 'interactive') {
    messageObj.interactive = {
      type: 'button_reply',
      button_reply: { id: buttonId || 'BTN_CONFIRM_DETAILS', title: 'Confirm Details' }
    };
  }

  try {
    await conversationManager.handleIncomingMessage({
      whatsappMessageId: wamid,
      senderPhone,
      senderName,
      messageObj
    });

    const activeCase = db.getActiveCaseByClientId(db.getClientByPhone(senderPhone)?.id);
    res.json({
      success: true,
      wamid,
      caseNumber: activeCase?.case_number,
      caseStatus: activeCase?.status,
      outboundCount: mockWhatsAppService.getOutboundHistory(senderPhone).length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * View all simulated outbound messages
 */
router.get('/outbound', (req, res) => {
  const { phone } = req.query;
  res.json(mockWhatsAppService.getOutboundHistory(phone));
});

/**
 * Send simulated outbound message to client
 */
router.post('/send-outbound', (req, res) => {
  const { phone, text, buttons } = req.body;
  if (!phone || !text) {
    return res.status(400).json({ error: 'phone and text are required' });
  }

  const payload = {
    to: phone,
    type: buttons && buttons.length ? 'interactive' : 'text',
    text: { body: text },
  };

  if (buttons && buttons.length) {
    payload.interactive = {
      type: 'button',
      body: { text },
      action: {
        buttons: buttons.map((b, i) => ({
          type: 'reply',
          reply: { id: b.id || `btn_${i}`, title: b.title || b },
        })),
      },
    };
  }

  const result = mockWhatsAppService.recordOutbound(payload);
  res.json({ success: true, result });
});

/**
 * Seed realistic demo data
 */
router.post('/seed-demo', (req, res) => {
  let c1 = db.getClientByPhone('919876543210');
  if (!c1) c1 = db.createClient({ phoneNumber: '919876543210', fullName: 'Rajesh Sharma', email: 'rajesh@apexcloud.io' });
  const case1 = db.createCase({ clientId: c1.id, proposedCompanyName: 'Apex Cloud Technologies Private Limited' });
  db.updateCase(case1.id, {
    status: 'CLIENT_CONFIRMATION',
    registered_office_state: 'Maharashtra',
    registered_office_district: 'Mumbai Suburban'
  });

  const doc1 = db.createDocument({
    caseId: case1.id,
    clientId: c1.id,
    originalFilename: 'director_rajesh_pan.pdf',
    storedPath: './uploads/pan_rajesh.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 425600,
    docType: 'PAN'
  });
  db.updateDocument(doc1.id, { processing_status: 'EXTRACTED', readability_score: 0.98 });

  db.addExtractedField({ caseId: case1.id, documentId: doc1.id, entityType: 'COMPANY', fieldKey: 'proposed_company_name', extractedValue: 'Apex Cloud Technologies Private Limited', confidence: 0.96, sourceDocumentName: 'director_rajesh_pan.pdf' });
  db.addExtractedField({ caseId: case1.id, documentId: doc1.id, entityType: 'DIRECTOR', entityIndex: 0, fieldKey: 'director_name', extractedValue: 'Rajesh Sharma', confidence: 0.94, sourceDocumentName: 'director_rajesh_pan.pdf' });
  db.addExtractedField({ caseId: case1.id, documentId: doc1.id, entityType: 'DIRECTOR', entityIndex: 0, fieldKey: 'director_pan', extractedValue: 'ABCDE1234F', confidence: 0.99, sourceDocumentName: 'director_rajesh_pan.pdf' });

  let c2 = db.getClientByPhone('919811223344');
  if (!c2) c2 = db.createClient({ phoneNumber: '919811223344', fullName: 'Sunita Verma', email: 'sunita@zenith.in' });
  const case2 = db.createCase({ clientId: c2.id, proposedCompanyName: 'Zenith NextGen Logistics Private Limited' });
  db.updateCase(case2.id, {
    status: 'READY_FOR_EXTENSION',
    registered_office_state: 'Delhi',
    registered_office_district: 'New Delhi',
    client_confirmed: true,
    client_confirmation_timestamp: new Date().toISOString()
  });

  db.addExtractedField({ caseId: case2.id, entityType: 'COMPANY', fieldKey: 'proposed_company_name', extractedValue: 'Zenith NextGen Logistics Private Limited', confidence: 0.98, sourceDocumentName: 'moa_aoa_draft.pdf', verificationStatus: 'HUMAN_VERIFIED' });
  db.addExtractedField({ caseId: case2.id, entityType: 'DIRECTOR', entityIndex: 0, fieldKey: 'director_name', extractedValue: 'Sunita Verma', confidence: 0.95, sourceDocumentName: 'passport_scan.pdf', verificationStatus: 'HUMAN_VERIFIED' });
  db.addExtractedField({ caseId: case2.id, entityType: 'DIRECTOR', entityIndex: 0, fieldKey: 'director_pan', extractedValue: 'XYZAB5678Q', confidence: 0.99, sourceDocumentName: 'pan_card.pdf', verificationStatus: 'HUMAN_VERIFIED' });

  let c3 = db.getClientByPhone('919988776655');
  if (!c3) c3 = db.createClient({ phoneNumber: '919988776655', fullName: 'Vikram Malhotra', email: 'vikram@malhotra.org' });
  const case3 = db.createCase({ clientId: c3.id, proposedCompanyName: 'National Infrastructure Advisory Limited' });
  db.updateCase(case3.id, { status: 'MANUAL_REVIEW', registered_office_state: 'Karnataka' });

  db.addExtractedField({ caseId: case3.id, entityType: 'COMPANY', fieldKey: 'proposed_company_name', extractedValue: 'National Infrastructure Advisory Limited', confidence: 0.92, sourceDocumentName: 'notes.pdf', flaggedForReview: true, flagReason: "Contains restricted word 'National'" });
  db.addExtractedField({ caseId: case3.id, entityType: 'DIRECTOR', entityIndex: 0, fieldKey: 'director_name', extractedValue: 'Vikram Malhotra', confidence: 0.72, sourceDocumentName: 'blurry_aadhar.jpg', flaggedForReview: true, flagReason: 'Low OCR confidence score (< 0.85). Blurry scan.' });

  res.json({ success: true, message: 'Seeded 3 realistic demo cases' });
});

router.post('/reset', (req, res) => {
  mockWhatsAppService.reset();
  res.json({ success: true, message: 'Mock state cleared' });
});

router.get('/media/:mediaId', (req, res) => {
  const media = mockWhatsAppService.getMockMedia(req.params.mediaId);
  if (!media) return res.status(404).json({ error: 'Mock media not found' });
  res.set('Content-Type', media.mimeType);
  res.set('Content-Disposition', `attachment; filename="${media.filename}"`);
  res.send(media.buffer);
});

export default router;
