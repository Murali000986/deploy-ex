import express from 'express';
import { db } from '../models/db.js';
import { requireAuth } from '../middleware/auth.js';
import { WorkflowStateMachine } from '../services/intake/workflowStateMachine.js';
import { NameReviewService } from '../services/validation/nameReviewService.js';

const router = express.Router();
router.use(requireAuth(['ADMIN', 'SUPERADMIN']));

/**
 * Dashboard stats overview
 */
router.get('/stats', (req, res) => {
  const allCases = db.getAllCases();
  const allMessages = Array.from(db.messages.values());
  const allDocs = Array.from(db.documents.values());
  const allFields = Array.from(db.extractedFields.values());

  const pendingConfirmation = allCases.filter(c => c.status === 'CLIENT_CONFIRMATION').length;
  const manualReview = allCases.filter(c => c.status === 'MANUAL_REVIEW').length;
  const readyExtension = allCases.filter(c => c.status === 'READY_FOR_EXTENSION').length;
  const lowConfidenceFields = allFields.filter(f => f.flagged_for_review).length;

  res.json({
    totalCases: allCases.length,
    activeCases: allCases.filter(c => c.status !== 'CANCELLED').length,
    pendingConfirmation,
    manualReview,
    readyExtension,
    lowConfidenceFields,
    totalDocumentsReceived: allDocs.length,
    totalMessagesExchanged: allMessages.length
  });
});

/**
 * Get cases list with optional filtering
 */
router.get('/cases', (req, res) => {
  const { status, search } = req.query;
  const cases = db.getAllCases({ status, search });
  const casesWithClients = cases.map(c => ({
    ...c,
    client: db.getClientById(c.client_id)
  }));
  res.json(casesWithClients);
});

/**
 * Get full case detail dossier
 */
router.get('/cases/:id', (req, res) => {
  const caseId = req.params.id;
  const c = db.getCaseById(caseId);
  if (!c) return res.status(404).json({ error: 'Case not found' });

  const client = db.getClientById(c.client_id);
  const documents = db.getDocumentsByCaseId(caseId);
  const extractedFields = db.getExtractedFieldsByCaseId(caseId);
  const nameChecks = db.getNameChecksByCaseId(caseId);
  const messages = db.getMessagesByCaseId(caseId);
  const auditTrail = db.getAuditLogs({ caseId });

  res.json({
    case: c,
    client,
    documents,
    extractedFields,
    nameChecks,
    messages,
    auditTrail
  });
});

/**
 * Update case workflow state
 */
router.patch('/cases/:id/state', (req, res) => {
  const caseId = req.params.id;
  const { newState, reason } = req.body;
  if (!newState) return res.status(400).json({ error: 'newState is required' });

  try {
    const updated = WorkflowStateMachine.transition(
      caseId,
      newState,
      req.user.id,
      req.user.role,
      reason || 'Admin state override'
    );
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Edit or verify an extracted field
 */
router.patch('/fields/:fieldId', (req, res) => {
  const fieldId = req.params.fieldId;
  const { verifiedValue, status } = req.body;

  const updated = db.updateExtractedField(fieldId, {
    verified_value: verifiedValue,
    verification_status: status || 'HUMAN_VERIFIED',
    flagged_for_review: false
  });

  if (!updated) return res.status(404).json({ error: 'Field not found' });

  db.addAuditLog({
    caseId: updated.case_id,
    actorId: req.user.id,
    actorRole: req.user.role,
    action: 'FIELD_VERIFIED_BY_ADMIN',
    details: { fieldKey: updated.field_key, verifiedValue }
  });

  res.json(updated);
});

/**
 * Trigger SPICe+ Part A Name Review
 */
router.post('/cases/:id/name-review', (req, res) => {
  const caseId = req.params.id;
  const c = db.getCaseById(caseId);
  if (!c) return res.status(404).json({ error: 'Case not found' });

  const proposedName = req.body.proposedName || c.proposed_company_name;
  if (!proposedName) {
    return res.status(400).json({ error: 'No proposed company name specified' });
  }

  const reviewResult = NameReviewService.runNameReview(caseId, proposedName);
  res.json(reviewResult);
});

/**
 * Get system audit logs
 */
router.get('/audit-logs', (req, res) => {
  const logs = db.getAuditLogs({
    caseId: req.query.caseId,
    actorRole: req.query.actorRole
  });
  res.json(logs);
});

export default router;
