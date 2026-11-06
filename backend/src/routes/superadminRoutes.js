import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config/env.js';
import { db } from '../models/db.js';

const router = express.Router();
router.use(requireAuth(['SUPERADMIN']));

/**
 * Get safe integration settings (tokens masked!)
 */
router.get('/settings', (req, res) => {
  res.json({
    whatsapp: {
      phoneNumberId: config.whatsapp.phoneNumberId,
      businessAccountId: config.whatsapp.businessAccountId,
      apiVersion: config.whatsapp.apiVersion,
      mockMode: config.whatsapp.mockMode,
      verifyTokenConfigured: Boolean(config.whatsapp.verifyToken),
      accessTokenConfigured: Boolean(config.whatsapp.accessToken && config.whatsapp.accessToken !== 'mock_access_token')
    },
    ai: {
      llmProvider: config.ai.llmProvider,
      ocrProvider: config.ai.ocrProvider,
      geminiConfigured: Boolean(config.ai.geminiApiKey),
      openaiConfigured: Boolean(config.ai.openaiApiKey)
    },
    security: {
      retentionDays: 90,
      maxFileSizeBytes: config.security.maxFileSizeBytes
    }
  });
});

/**
 * Update system adapters/config
 */
router.post('/settings', (req, res) => {
  const { mockMode, llmProvider, ocrProvider } = req.body;
  if (mockMode !== undefined) config.whatsapp.mockMode = Boolean(mockMode);
  if (llmProvider) config.ai.llmProvider = llmProvider;
  if (ocrProvider) config.ai.ocrProvider = ocrProvider;

  db.addAuditLog({
    actorId: req.user.id,
    actorRole: 'SUPERADMIN',
    action: 'SYSTEM_SETTINGS_UPDATED',
    details: { mockMode, llmProvider, ocrProvider }
  });

  res.json({ success: true, message: 'Settings updated successfully' });
});

/**
 * Get CA Firm staff members
 */
router.get('/team', (req, res) => {
  res.json([
    { id: 'usr_01', name: 'R. K. Agrawal & Co.', role: 'SUPERADMIN', email: 'partner@rkaca.in', status: 'ACTIVE' },
    { id: 'usr_02', name: 'Sunil Mehta (CA)', role: 'ADMIN', email: 'sunil@rkaca.in', status: 'ACTIVE' },
    { id: 'usr_03', name: 'Neha Singhal (CS)', role: 'ADMIN', email: 'neha@rkaca.in', status: 'ACTIVE' }
  ]);
});

export default router;
