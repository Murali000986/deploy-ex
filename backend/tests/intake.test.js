import assert from 'assert';
import { db } from '../src/models/db.js';
import { conversationManager } from '../src/services/intake/conversationManager.js';
import { mockWhatsAppService } from '../src/services/whatsapp/mockWhatsAppService.js';
import { CASE_STATES } from '../src/services/intake/workflowStateMachine.js';

export async function testClientIntakeWorkflow() {
  console.log('  ▸ Testing Client Intake Workflow & State Machine...');

  const testPhone = '91' + Math.floor(9000000000 + Math.random() * 999999999);
  mockWhatsAppService.reset();

  // 1. Inbound greeting from new client
  await conversationManager.handleIncomingMessage({
    whatsappMessageId: 'wamid.INTAKE_01',
    senderPhone: testPhone,
    senderName: 'Anil Kumar',
    messageObj: {
      id: 'wamid.INTAKE_01',
      type: 'text',
      text: { body: 'Hello, need to register a new pvt ltd company' }
    }
  });

  const client = db.getClientByPhone(testPhone);
  assert(client, 'Client must be created in DB');
  assert.strictEqual(client.phone_number, testPhone);

  const activeCase = db.getActiveCaseByClientId(client.id);
  assert(activeCase, 'Active case must be generated for new intake');
  assert.strictEqual(activeCase.status, CASE_STATES.DOCUMENTS_PENDING, 'Case must transition to DOCUMENTS_PENDING');

  // Verify welcome message was sent
  const outbound = mockWhatsAppService.getOutboundHistory(testPhone);
  assert(outbound.length >= 1, 'Welcome message must be dispatched');
  assert(outbound[0].text.body.includes('Welcome to *Ledgerly*'));

  // 2. Client requests human assistance
  await conversationManager.handleIncomingMessage({
    whatsappMessageId: 'wamid.INTAKE_02',
    senderPhone: testPhone,
    senderName: 'Anil Kumar',
    messageObj: {
      id: 'wamid.INTAKE_02',
      type: 'text',
      text: { body: 'HELP' }
    }
  });

  const updatedCase = db.getCaseById(activeCase.id);
  assert.strictEqual(updatedCase.status, CASE_STATES.MANUAL_REVIEW, 'Case must transition to MANUAL_REVIEW upon HELP');

  // 3. Client opt-out
  await conversationManager.handleIncomingMessage({
    whatsappMessageId: 'wamid.INTAKE_03',
    senderPhone: testPhone,
    senderName: 'Anil Kumar',
    messageObj: {
      id: 'wamid.INTAKE_03',
      type: 'text',
      text: { body: 'STOP' }
    }
  });

  const optedOutClient = db.getClientById(client.id);
  assert.strictEqual(optedOutClient.opted_out, true, 'Client must be flagged opted_out');
  console.log('    ✔ Client intake, state transitions, human handoff, and opt-out passed');
}
