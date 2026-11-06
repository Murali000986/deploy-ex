import express from 'express';
import { webhookHandler } from '../services/whatsapp/webhookHandler.js';
import { verifyWebhookSignature } from '../middleware/verifyWebhookSignature.js';

const router = express.Router();

/**
 * Meta Webhook verification challenge (GET)
 */
router.get('/whatsapp', (req, res) => {
  webhookHandler.handleVerification(req, res);
});

/**
 * Meta Webhook event receiver (POST) with HMAC signature check
 */
router.post('/whatsapp', verifyWebhookSignature, (req, res) => {
  webhookHandler.handleInbound(req, res);
});

export default router;
