import { config } from '../../config/env.js';
import { db } from '../../models/db.js';
import { conversationManager } from '../intake/conversationManager.js';

/**
 * WhatsApp Webhook Verification and Event Dispatcher.
 * Guarantees zero-loss webhook acknowledgment and idempotent background execution.
 */
class WebhookHandler {
  /**
   * Handle Meta Hub Challenge for Webhook setup
   */
  handleVerification(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      console.log('[Webhook] Meta verification challenge succeeded.');
      return res.status(200).send(challenge);
    }

    console.warn('[Webhook] Verification failed. Token mismatch.');
    return res.status(403).json({ error: 'Verification token mismatch' });
  }

  /**
   * Handle Inbound Webhook Notifications
   */
  async handleInbound(req, res) {
    const body = req.body;

    // Fast 200 OK response to satisfy Meta API requirements (< 3s response time)
    res.status(200).json({ status: 'EVENT_RECEIVED' });

    if (!body || body.object !== 'whatsapp_business_account') {
      return;
    }

    try {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== 'messages') continue;
          const value = change.value || {};

          // 1. Process Message Status Updates (sent, delivered, read, failed)
          if (value.statuses && Array.isArray(value.statuses)) {
            for (const statusObj of value.statuses) {
              const wamid = statusObj.id;
              const status = statusObj.status?.toUpperCase(); // 'SENT' | 'DELIVERED' | 'READ' | 'FAILED'
              const failureReason = statusObj.errors ? JSON.stringify(statusObj.errors) : null;
              db.updateMessageStatus(wamid, status, failureReason);
            }
          }

          // 2. Process Inbound Messages (text, image, document, interactive button replies)
          if (value.messages && Array.isArray(value.messages)) {
            const contact = (value.contacts && value.contacts[0]) || {};
            const senderPhone = contact.wa_id || value.messages[0].from;
            const senderName = contact.profile?.name || '';

            for (const message of value.messages) {
              const messageId = message.id;

              // Webhook Idempotency Check
              if (db.isEventProcessed(messageId)) {
                console.log(`[Webhook] Duplicate event ${messageId} ignored.`);
                continue;
              }
              db.markEventProcessed(messageId);

              // Asynchronous conversation processing
              conversationManager.handleIncomingMessage({
                whatsappMessageId: messageId,
                senderPhone,
                senderName,
                messageObj: message
              }).catch(err => {
                console.error(`[Conversation Manager Error] ${messageId}:`, err);
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[Webhook Processing Error]:', err);
    }
  }
}

export const webhookHandler = new WebhookHandler();
