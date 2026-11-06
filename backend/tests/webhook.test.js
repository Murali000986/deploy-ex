import assert from 'assert';
import crypto from 'crypto';
import { config } from '../src/config/env.js';
import { db } from '../src/models/db.js';
import { webhookHandler } from '../src/services/whatsapp/webhookHandler.js';

export async function testWebhookVerification() {
  console.log('  ▸ Testing Webhook Hub Verification Challenge...');

  // 1. Valid challenge verification
  let statusCode = 0;
  let responseBody = '';
  const mockReq = {
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': config.whatsapp.verifyToken,
      'hub.challenge': 'CHALLENGE_CODE_12345'
    }
  };
  const mockRes = {
    status: (code) => {
      statusCode = code;
      return {
        send: (body) => { responseBody = body; },
        json: (data) => { responseBody = JSON.stringify(data); }
      };
    }
  };

  webhookHandler.handleVerification(mockReq, mockRes);
  assert.strictEqual(statusCode, 200, 'Expected status code 200 on valid verification token');
  assert.strictEqual(responseBody, 'CHALLENGE_CODE_12345', 'Expected challenge to be echoed back');

  // 2. Invalid token rejection
  const invalidReq = {
    query: {
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong_token',
      'hub.challenge': 'CHALLENGE_CODE_12345'
    }
  };
  webhookHandler.handleVerification(invalidReq, mockRes);
  assert.strictEqual(statusCode, 403, 'Expected status code 403 on invalid token');
  console.log('    ✔ Webhook verification challenge passed');
}

export async function testWebhookIdempotency() {
  console.log('  ▸ Testing Webhook Duplicate Event & Idempotency...');

  const duplicateEventId = 'wamid.DUP_' + Date.now();
  assert.strictEqual(db.isEventProcessed(duplicateEventId), false, 'Event should not be processed yet');

  db.markEventProcessed(duplicateEventId);
  assert.strictEqual(db.isEventProcessed(duplicateEventId), true, 'Event should be recorded as processed');

  // Second check ensures duplicate is detected
  const isDuplicate = db.isEventProcessed(duplicateEventId);
  assert.strictEqual(isDuplicate, true, 'Duplicate check must return true');
  console.log('    ✔ Webhook duplicate event idempotency confirmed');
}
