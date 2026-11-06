import fs from 'fs';
import path from 'path';
import { db } from '../../models/db.js';
import { getOcrAdapter } from './ocrAdapter.js';
import { getLlmAdapter, GeminiVisionAdapter } from './llmAdapter.js';
import { validateDossierSchema } from './schemas.js';
import { WorkflowStateMachine, CASE_STATES } from '../intake/workflowStateMachine.js';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.webp', '.tiff']);

class DocumentPipeline {
  constructor() {
    this.ocr = getOcrAdapter();
    this.llm = getLlmAdapter();
    this.vision = new GeminiVisionAdapter();
  }

  /**
   * Process an uploaded document end-to-end
   */
  async processDocument(documentId) {
    const doc = db.getDocumentById(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const caseRecord = db.getCaseById(doc.case_id);
    if (!caseRecord) throw new Error(`Case ${doc.case_id} not found`);

    console.log(`[Document Pipeline] Processing doc ${doc.original_filename} (Case ${caseRecord.case_number})...`);

    // 1. Advance case state to PROCESSING if appropriate
    if (caseRecord.status === CASE_STATES.NEW || caseRecord.status === CASE_STATES.DOCUMENTS_PENDING) {
      WorkflowStateMachine.transition(caseRecord.id, CASE_STATES.PROCESSING, 'SYSTEM', 'SYSTEM', 'Document processing started');
    }

    db.updateDocument(documentId, { processing_status: 'PROCESSING' });

    try {
      // 2. Check if this is an image file that can use direct AI vision
      const fileExt = path.extname(doc.stored_path || doc.original_filename).toLowerCase();
      const isImage = IMAGE_EXTENSIONS.has(fileExt);
      let extraction;

      if (isImage && this.vision.isAvailable) {
        // VISION PATH: Send image directly to AI — no OCR needed
        console.log(`[Document Pipeline] Using AI Vision for ${doc.original_filename} (skipping OCR)`);
        db.updateDocument(documentId, { readability_score: 0.95, extracted_raw_text: '[AI Vision - image sent directly to Gemini]' });

        extraction = await this.vision.extractFromImage(doc.stored_path, doc.original_filename);
        if (extraction.documentType) {
          db.updateDocument(documentId, { detected_doc_type: extraction.documentType });
        }
      } else {
        // OCR PATH: Extract text first, then parse with LLM
        const ocrResult = await this.ocr.extractText(doc.stored_path, doc.mime_type);

        db.updateDocument(documentId, {
          readability_score: ocrResult.readabilityScore,
          extracted_raw_text: ocrResult.text
        });

        if (!ocrResult.isReadable || ocrResult.readabilityScore < 0.30) {
          db.updateDocument(documentId, {
            processing_status: 'FAILED',
            error_message: ocrResult.error || 'Scan is blurry, unreadable, or corrupted'
          });

          db.addAuditLog({
            caseId: caseRecord.id,
            actorId: 'SYSTEM',
            actorRole: 'SYSTEM',
            action: 'DOCUMENT_UNREADABLE',
            details: { filename: doc.original_filename, score: ocrResult.readabilityScore }
          });

          WorkflowStateMachine.transition(caseRecord.id, CASE_STATES.NEEDS_CORRECTION, 'SYSTEM', 'SYSTEM', `Document ${doc.original_filename} unreadable`);
          return { success: false, error: 'Document unreadable' };
        }

        console.log(`[Document Pipeline] OCR text (${ocrResult.text.length} chars), running LLM extraction...`);
        extraction = await this.llm.extractEntities(ocrResult.text, doc.original_filename);
        if (extraction.documentType) {
          db.updateDocument(documentId, { detected_doc_type: extraction.documentType });
        }
      }

      // 5. Persist Extracted Fields with Confidence
      let hasLowConfidence = false;
      const caseUpdates = {};

      for (const f of extraction.fields) {
        const added = db.addExtractedField({
          caseId: caseRecord.id,
          documentId: doc.id,
          entityType: f.entityType,
          entityIndex: f.entityIndex,
          fieldKey: f.fieldKey,
          extractedValue: f.extractedValue,
          confidence: f.confidence,
          sourceDocumentName: doc.original_filename,
          flaggedForReview: f.flaggedForReview,
          flagReason: f.flagReason
        });

        if (f.confidence < 0.85) {
          hasLowConfidence = true;
        }

        // Apply high-confidence updates to case record
        if (f.confidence >= 0.85) {
          if (f.fieldKey === 'proposed_company_name' && !caseRecord.proposed_company_name) {
            caseUpdates.proposed_company_name = f.extractedValue;
          }
          if (f.fieldKey === 'registered_office_state' && !caseRecord.registered_office_state) {
            caseUpdates.registered_office_state = f.extractedValue;
          }
          if (f.fieldKey === 'registered_office_district' && !caseRecord.registered_office_district) {
            caseUpdates.registered_office_district = f.extractedValue;
          }
        }
      }

      if (Object.keys(caseUpdates).length > 0) {
        db.updateCase(caseRecord.id, caseUpdates);
      }

      db.updateDocument(documentId, {
        processing_status: hasLowConfidence ? 'HUMAN_REVIEW' : 'EXTRACTED'
      });

      // 6. Schema and Completeness Validation
      const currentFields = db.getExtractedFieldsByCaseId(caseRecord.id);
      const reconstructedDossier = {
        proposedName: caseUpdates.proposed_company_name || caseRecord.proposed_company_name,
        registeredOfficeState: caseUpdates.registered_office_state || caseRecord.registered_office_state,
        directors: currentFields
          .filter(f => f.field_key === 'director_name')
          .map((dirField, i) => {
            const panField = currentFields.find(
              f => f.field_key === 'director_pan' && f.entity_index === dirField.entity_index
            );
            return {
              fullName: dirField.extracted_value,
              pan: panField ? panField.extracted_value : null
            };
          })
      };

      const validation = validateDossierSchema(reconstructedDossier);

      // 7. Transition to CLIENT_CONFIRMATION or MANUAL_REVIEW
      const targetState = (!validation.isValid || hasLowConfidence) ? CASE_STATES.MANUAL_REVIEW : CASE_STATES.CLIENT_CONFIRMATION;
      const transitionReason = (!validation.isValid || hasLowConfidence)
        ? `Anomalies or low-confidence fields detected (${validation.errors.join('; ')})`
        : 'Document extraction completed successfully with high confidence';

      if (WorkflowStateMachine.canTransition(caseRecord.status, targetState)) {
        WorkflowStateMachine.transition(
          caseRecord.id,
          targetState,
          'SYSTEM',
          'SYSTEM',
          transitionReason
        );
      }

      return {
        success: true,
        extractedCount: extraction.fields.length,
        hasLowConfidence,
        validation
      };
    } catch (err) {
      console.error(`[Document Pipeline Error] Doc ${documentId}:`, err);
      db.updateDocument(documentId, {
        processing_status: 'FAILED',
        error_message: err.message
      });
      if (WorkflowStateMachine.canTransition(caseRecord.status, CASE_STATES.FAILED_RETRYABLE)) {
        WorkflowStateMachine.transition(caseRecord.id, CASE_STATES.FAILED_RETRYABLE, 'SYSTEM', 'SYSTEM', err.message);
      }
      throw err;
    }
  }
}

export const documentPipeline = new DocumentPipeline();
