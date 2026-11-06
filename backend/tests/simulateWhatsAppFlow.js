/**
 * ============================================================================
 * Ledgerly WhatsApp Flow Simulator (with Groq LLM & SPICe+ Verification)
 * ============================================================================
 * Runs a complete end-to-end simulation of a client interacting with Ledgerly
 * via WhatsApp Business Platform Cloud API, including:
 * 1. Client greeting & consent registration
 * 2. Automated Welcome & MCA guidance
 * 3. Client uploads identity & incorporation document
 * 4. Document processing with Groq LLM entity extraction & confidence scoring
 * 5. Automated WhatsApp summary with interactive confirmation buttons
 * 6. Client button click: "Confirm Details"
 * 7. SPICe+ Part A Name Availability Check
 * 8. CA Admin signoff & MCA browser extension dossier handoff
 */

import { db } from '../src/models/db.js';
import { conversationManager } from '../src/services/intake/conversationManager.js';
import { mockWhatsAppService } from '../src/services/whatsapp/mockWhatsAppService.js';
import { documentPipeline } from '../src/services/document/documentPipeline.js';
import { ExtensionContractService } from '../src/services/extension/extensionContract.js';
import { CASE_STATES, WorkflowStateMachine } from '../src/services/intake/workflowStateMachine.js';
import { config } from '../src/config/env.js';

const SLEEP = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runWhatsAppSimulation() {
  const simulationPhone = '91' + Math.floor(9000000000 + Math.random() * 999999999);
  const clientName = 'Rajesh Sharma';

  console.log('\n================================================================');
  console.log('📱 LEDGERLY WHATSAPP AUTOMATION SIMULATOR');
  console.log(`🤖 AI LLM Engine: ${config.ai.llmProvider.toUpperCase()} (${config.ai.groqModel})`);
  console.log('================================================================\n');

  mockWhatsAppService.reset();

  // --------------------------------------------------------------------------
  // STEP 1: Client sends initial WhatsApp message
  // --------------------------------------------------------------------------
  console.log(`[STEP 1/6] Client sends initial WhatsApp message...`);
  console.log(`💬 [WhatsApp Client -> Ledgerly] (+${simulationPhone}):`);
  console.log(`   "Hello, I need to register a new private limited company for our cloud tech venture."`);

  await conversationManager.handleIncomingMessage({
    whatsappMessageId: 'wamid.SIM_' + Date.now() + '_1',
    senderPhone: simulationPhone,
    senderName: clientName,
    messageObj: {
      id: 'wamid.SIM_01',
      type: 'text',
      text: { body: 'Hello, I need to register a new private limited company for our cloud tech venture.' }
    }
  });

  const client = db.getClientByPhone(simulationPhone);
  const activeCase = db.getActiveCaseByClientId(client.id);

  console.log(`\n🤖 [Ledgerly Bot -> Client] (Case Ref: ${activeCase.case_number}):`);
  const outbound1 = mockWhatsAppService.getOutboundHistory(simulationPhone);
  console.log(`   ${outbound1[outbound1.length - 1]?.text?.body.replace(/\n/g, '\n   ')}`);
  console.log(`\n✔ Client registered | Case State: ${activeCase.status}\n`);

  await SLEEP(500);

  // --------------------------------------------------------------------------
  // STEP 2: Client uploads Director & Company Details Document
  // --------------------------------------------------------------------------
  console.log(`[STEP 2/6] Client uploads incorporation document via WhatsApp...`);
  console.log(`📄 [WhatsApp Client -> Ledgerly]: Uploaded file "apex_incorporation_pan.pdf"`);

  // Pre-seed mock document data for OCR
  const sampleDocText = `
PROPOSED INCORPORATION DETAILS
Proposed Company Name: Apex Cloud Technologies Private Limited
Company Type: Private Limited
Registered Office State: Maharashtra
Registered Office District: Mumbai Suburban
Authorized Capital: INR 5,00,000
Director 1: Rajesh Sharma (PAN: ABCDE1234F)
Director 2: Priya Sharma (PAN: FGHIJ5678K)
Business Sector: Cloud Software & IT Services
  `.trim();

  mockWhatsAppService.storeMockMedia(
    Buffer.from(sampleDocText),
    'application/pdf',
    'apex_incorporation_pan.pdf'
  );

  await conversationManager.handleIncomingMessage({
    whatsappMessageId: 'wamid.SIM_' + Date.now() + '_2',
    senderPhone: simulationPhone,
    senderName: clientName,
    messageObj: {
      id: 'wamid.SIM_02',
      type: 'document',
      document: {
        id: 'media_doc_apex_01',
        filename: 'apex_incorporation_pan.pdf',
        mime_type: 'application/pdf',
        caption: 'Director PAN and proposed incorporation details'
      }
    }
  });

  const fields = db.getExtractedFieldsByCaseId(activeCase.id);
  console.log(`\n🧠 AI Extraction Results (Provider: ${config.ai.llmProvider}):`);
  fields.forEach((f) => {
    console.log(`   • ${f.field_key.padEnd(26)} : ${String(f.extracted_value || '').padEnd(35)} (Confidence: ${Math.round(f.confidence * 100)}%)`);
  });

  const updatedCaseAfterDoc = db.getCaseById(activeCase.id);
  console.log(`\n✔ Extraction Completed | Case State: ${updatedCaseAfterDoc.status}\n`);

  await SLEEP(500);

  // --------------------------------------------------------------------------
  // STEP 3: Ledgerly Bot sends Summary with Interactive Confirmation Buttons
  // --------------------------------------------------------------------------
  console.log(`[STEP 3/6] Bot dispatches interactive WhatsApp confirmation card...`);
  const outboundSummary = mockWhatsAppService.getOutboundHistory(simulationPhone);
  const interactiveMsg = outboundSummary.find((m) => m.type === 'interactive');
  if (interactiveMsg) {
    console.log(`🤖 [Ledgerly Bot -> Client Interactive Card]:`);
    console.log(`   Header: ${interactiveMsg.interactive?.header?.text || 'MCA Filing Review'}`);
    console.log(`   Body:\n   ${interactiveMsg.interactive?.body?.text.replace(/\n/g, '\n   ')}`);
    console.log(`   Buttons: [✅ Confirm Details] [✏️ Correct Details] [📞 Talk to CA]`);
  }
  console.log(`\n✔ Interactive confirmation delivered to client\n`);

  await SLEEP(500);

  // --------------------------------------------------------------------------
  // STEP 4: Client clicks "Confirm Details"
  // --------------------------------------------------------------------------
  console.log(`[STEP 4/6] Client taps [Confirm Details] on WhatsApp...`);
  console.log(`🔘 [WhatsApp Client Action]: Clicked button "BTN_CONFIRM_DETAILS"`);

  await conversationManager.handleIncomingMessage({
    whatsappMessageId: 'wamid.SIM_' + Date.now() + '_3',
    senderPhone: simulationPhone,
    senderName: clientName,
    messageObj: {
      id: 'wamid.SIM_03',
      type: 'interactive',
      interactive: {
        type: 'button_reply',
        button_reply: { id: 'BTN_CONFIRM_DETAILS', title: 'Confirm Details' }
      }
    }
  });

  const caseAfterConfirm = db.getCaseById(activeCase.id);
  const nameChecks = db.getNameChecksByCaseId(activeCase.id);

  console.log(`\n🔍 SPICe+ Part A Automated Name Review Results:`);
  nameChecks.forEach((chk) => {
    console.log(`   [${chk.check_source.padEnd(16)}] Result: ${chk.check_result.padEnd(15)} | Notes: ${chk.notes}`);
  });

  console.log(`\n✔ SPICe+ Name Check Completed | Case State: ${caseAfterConfirm.status}\n`);

  await SLEEP(500);

  // --------------------------------------------------------------------------
  // STEP 5: CA Partner reviews dossier and approves for MCA Extension
  // --------------------------------------------------------------------------
  console.log(`[STEP 5/6] CA Partner reviews dossier in Ledgerly Admin Dashboard...`);
  WorkflowStateMachine.transition(
    activeCase.id,
    CASE_STATES.ADMIN_REVIEW,
    'ca_senior_partner',
    'ADMIN',
    'Name check reviewed and certified by CA Sunil Mehta'
  );
  WorkflowStateMachine.transition(
    activeCase.id,
    CASE_STATES.READY_FOR_EXTENSION,
    'ca_senior_partner',
    'ADMIN',
    'Approved by CA Sunil Mehta for SPICe+ MCA filing'
  );
  const caseApproved = db.getCaseById(activeCase.id);
  console.log(`✔ Case ${caseApproved.case_number} signed off | State: ${caseApproved.status}\n`);

  await SLEEP(500);

  // --------------------------------------------------------------------------
  // STEP 6: MCA Browser Extension fetches authorized dossier contract
  // --------------------------------------------------------------------------
  console.log(`[STEP 6/6] MCA Browser Extension fetches validated filing payload...`);
  const extensionDossier = ExtensionContractService.getDossierForExtension(activeCase.id, 'MCA_EXTENSION_BROWSER_V1');
  console.log(`📦 Extension Contract Payload:`);
  console.log(`   • Case Number   : ${extensionDossier.case_reference}`);
  console.log(`   • Proposed Name : ${extensionDossier.spice_plus_part_a.proposed_name_primary}`);
  console.log(`   • Company Type  : ${extensionDossier.spice_plus_part_a.company_type}`);
  console.log(`   • State / ROC   : ${extensionDossier.spice_plus_part_b.registered_office.ro_jurisdiction}`);
  console.log(`   • Capital       : INR ${extensionDossier.spice_plus_part_b.capital_structure.authorized_capital.toLocaleString()}`);
  console.log(`   • Directors     : ${extensionDossier.spice_plus_part_b.subscribers_and_directors.map((d) => `${d.full_name} (${d.pan})`).join(', ')}`);
  console.log(`   • Certified For : MCA SPICe+ Part A & B Auto-Fill`);

  console.log('\n================================================================');
  console.log('🎉 SIMULATION COMPLETED WITH 100% SUCCESS!');
  console.log('================================================================\n');
}

runWhatsAppSimulation().catch((err) => {
  console.error('\n❌ Simulation failed:', err);
  process.exit(1);
});
