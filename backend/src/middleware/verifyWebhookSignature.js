import crypto from 'crypto';
import { config } from '../config/env.js';

/**
 * Meta WhatsApp Business Platform Webhook Signature Verification.
 * Validates 'X-Hub-Signature-256' using HMAC-SHA256 with WHATSAPP_APP_SECRET.
 * If WHATSAPP_MOCK_MODE is enabled, signature verification is bypassed for local development/simulation.
 */
export function verifyWebhookSignature(req, res, next) {
  if (config.whatsapp.mockMode) {
    return next();
  }

  const signatureHeader = req.headers['x-hub-signature-256'];
  if (!signatureHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-Hub-Signature-256 header'
    });
  }

  const [prefix, signature] = signatureHeader.split('=');
  if (prefix !== 'sha256' || !signature) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Malformed X-Hub-Signature-256 header'
    });
  }

  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', config.whatsapp.appSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (
      expectedBuffer.length !== signatureBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
    ) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid webhook signature'
      });
    }

    next();
  } catch (err) {
    console.error('[Webhook Signature Error]:', err.message);
    return res.status(500).json({ error: 'Signature verification failure' });
  }
}
