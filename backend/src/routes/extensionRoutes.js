import express from 'express';
import { requireExtensionKey } from '../middleware/auth.js';
import { ExtensionContractService } from '../services/extension/extensionContract.js';

const router = express.Router();

/**
 * Endpoint called exclusively by the MCA Browser Extension
 * Protected by X-Extension-Key header
 */
router.get('/cases/:caseId/dossier', requireExtensionKey, (req, res, next) => {
  try {
    const extensionClientId = req.headers['x-extension-client-id'] || 'MCA_EXTENSION_V1';
    const dossier = ExtensionContractService.getDossierForExtension(req.params.caseId, extensionClientId);
    res.json(dossier);
  } catch (err) {
    next(err);
  }
});

export default router;
