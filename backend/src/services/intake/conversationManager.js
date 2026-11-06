import { db } from '../../models/db.js';
import { whatsappClient } from '../whatsapp/whatsappClient.js';
import { WorkflowStateMachine, CASE_STATES } from './workflowStateMachine.js';
import { documentPipeline } from '../document/documentPipeline.js';
import { NameReviewService } from '../validation/nameReviewService.js';

export class ConversationManager {
  /**
   * Main entrypoint for handling inbound WhatsApp messages
   */
  async handleIncomingMessage({ whatsappMessageId, senderPhone, senderName, messageObj }) {
    console.log(`[Conversation] Message from ${senderPhone}: type=${messageObj.type}`);

    // 1. Identify or register Client
    let client = db.getClientByPhone(senderPhone);
    const isNewClient = !client;

    if (!client) {
      client = db.createClient({
        phoneNumber: senderPhone,
        fullName: senderName || 'Valued Client'
      });
      db.addAuditLog({
        actorId: client.id,
        actorRole: 'CLIENT',
        action: 'CLIENT_REGISTERED',
        details: { phone: senderPhone, name: senderName }
      });
    }

    // Check if opted out
    if (client.opted_out && !messageObj.text?.body?.toLowerCase().includes('start')) {
      console.log(`[Conversation] Client ${senderPhone} has opted out. Ignoring message.`);
      return;
    }

    // 2. Identify or create Case
    let activeCase = db.getActiveCaseByClientId(client.id);
    if (!activeCase) {
      activeCase = db.createCase({ clientId: client.id });
      db.addAuditLog({
        caseId: activeCase.id,
        actorId: client.id,
        actorRole: 'CLIENT',
        action: 'CASE_CREATED',
        details: { caseNumber: activeCase.case_number }
      });
    }

    // 3. Mark message as read on WhatsApp
    await whatsappClient.markAsRead(whatsappMessageId).catch(() => {});

    // 4. Save inbound message in database
    const msgType = messageObj.type;
    let textContent = '';
    let mediaId = null;
    let mediaFilename = null;
    let mediaMime = null;

    if (msgType === 'text') {
      textContent = messageObj.text?.body || '';
    } else if (msgType === 'interactive') {
      textContent = messageObj.interactive?.button_reply?.id || messageObj.interactive?.list_reply?.id || '';
    } else if (['document', 'image'].includes(msgType)) {
      const mediaObj = messageObj[msgType];
      mediaId = mediaObj.id;
      mediaMime = mediaObj.mime_type;
      mediaFilename = mediaObj.filename || `${msgType}_${mediaId}.${msgType === 'document' ? 'pdf' : 'jpg'}`;
      textContent = mediaObj.caption || `[Attachment: ${mediaFilename}]`;
    }

    db.createMessage({
      caseId: activeCase.id,
      clientId: client.id,
      whatsappMessageId,
      direction: 'INBOUND',
      messageType: msgType,
      content: textContent,
      mediaId,
      mediaMimeType: mediaMime,
      mediaFilename,
      deliveryStatus: 'READ'
    });

    // 5. Handle Opt-out / Global Commands
    const cleanText = textContent.trim().toUpperCase();
    if (cleanText === 'STOP') {
      db.updateClient(client.id, { opted_out: true });
      await whatsappClient.sendTextMessage(
        senderPhone,
        'You have opted out of automated updates from Ledgerly. Reply START anytime to resume.'
      );
      return;
    }

    if (cleanText === 'START') {
      db.updateClient(client.id, { opted_out: false });
      await whatsappClient.sendTextMessage(
        senderPhone,
        'Welcome back to Ledgerly MCA incorporation assistant! How can we assist you today?'
      );
      return;
    }

    if (cleanText === 'HUMAN' || cleanText === 'HELP' || cleanText === 'TALK TO CA') {
      WorkflowStateMachine.transition(
        activeCase.id,
        CASE_STATES.MANUAL_REVIEW,
        client.id,
        'CLIENT',
        'Client requested human assistance'
      );
      await whatsappClient.sendTextMessage(
        senderPhone,
        'A Chartered Accountant from Ledgerly has been alerted and will reach out to you directly on this chat shortly.'
      );
      return;
    }

    // 6. Handle Interactive Button Replies
    if (msgType === 'interactive' || cleanText.startsWith('BTN_')) {
      await this.handleInteractiveButton(client, activeCase, textContent);
      return;
    }

    // 7. Handle Attachments (Documents / Images)
    if (['document', 'image'].includes(msgType)) {
      await this.handleDocumentAttachment(client, activeCase, mediaId, mediaMime, mediaFilename);
      return;
    }

    // 8. Handle Standard Intake Flow
    if (isNewClient || activeCase.status === CASE_STATES.NEW) {
      await this.sendWelcomeMessage(senderPhone, client.full_name, activeCase.case_number);
      WorkflowStateMachine.transition(
        activeCase.id,
        CASE_STATES.DOCUMENTS_PENDING,
        'SYSTEM',
        'SYSTEM',
        'Welcome message sent'
      );
      return;
    }

    // 9. Handle corrections when case is in NEEDS_CORRECTION or CLIENT_CONFIRMATION
    if ([CASE_STATES.CLIENT_CONFIRMATION, CASE_STATES.NEEDS_CORRECTION].includes(activeCase.status)) {
      await this.handleClientCorrectionText(client, activeCase, textContent);
      return;
    }

    // 10. Default helper response
    await whatsappClient.sendTextMessage(
      senderPhone,
      `Thank you for reaching out. Your MCA case reference is *${activeCase.case_number}* (Status: ${activeCase.status}).\n\nPlease send your documents (PAN, Aadhaar, MOA draft) or type *HELP* to connect with our CA team.`
    );
  }

  /**
   * Send friendly onboarding message explaining MCA service
   */
  async sendWelcomeMessage(phone, clientName, caseNumber) {
    const welcome =
      `Hello ${clientName}! 👋 Welcome to *Ledgerly* — your MCA Company Incorporation Preparation Partner.\n\n` +
      `We assist CA firms and entrepreneurs in assembling verified incorporation dossiers for MCA SPICe+ Part A & B filings.\n\n` +
      `📁 *Case Reference:* \`${caseNumber}\`\n\n` +
      `To get started:\n` +
      `1️⃣ Reply with your proposed Company Name(s).\n` +
      `2️⃣ Send Director Identity documents (PAN Card, Aadhaar, or Passport as PDF or photo).\n\n` +
      `You can type *STOP* to opt out or *HELP* to speak with our CA team at any time.`;

    await whatsappClient.sendTextMessage(phone, welcome);
    db.createMessage({
      clientId: phone,
      direction: 'OUTBOUND',
      messageType: 'text',
      content: welcome
    });
  }

  /**
   * Handle incoming document/image attachments
   */
  async handleDocumentAttachment(client, activeCase, mediaId, mimeType, filename) {
    await whatsappClient.sendTextMessage(
      client.phone_number,
      `📄 Received *${filename}*.\n🔍 Running Ledgerly AI OCR extraction...`
    );

    try {
      const downloadResult = await whatsappClient.downloadMedia(mediaId);

      // Auto-detect document type from filename
      const fnLower = (filename || '').toLowerCase();
      let docType = 'OTHER';
      if (fnLower.includes('pan')) docType = 'PAN';
      else if (fnLower.includes('aadhaar') || fnLower.includes('aadhar') || fnLower.includes('uid')) docType = 'AADHAAR';
      else if (fnLower.includes('gst')) docType = 'GST';
      else if (fnLower.includes('driv') || fnLower.includes('license') || fnLower.includes('dl')) docType = 'DRIVING_LICENSE';
      else if (mimeType && mimeType.startsWith('image/')) docType = 'IDENTITY_SCAN';

      const doc = db.createDocument({
        caseId: activeCase.id,
        clientId: client.id,
        originalFilename: filename,
        storedPath: downloadResult ? downloadResult.filePath : `./uploads/${filename}`,
        mimeType: mimeType || 'application/pdf',
        fileSizeBytes: downloadResult ? downloadResult.fileSize : 1024,
        docType
      });

      const result = await documentPipeline.processDocument(doc.id);

      if (result.success) {
        const fieldWord = result.extractedCount === 1 ? 'field' : 'fields';
        await whatsappClient.sendTextMessage(
          client.phone_number,
          `✅ *Document processed successfully!*\n📊 Extracted *${result.extractedCount} ${fieldWord}* from your document.\n${result.hasLowConfidence ? '⚠️ Some fields need verification.\n' : ''}`
        );
        await this.sendExtractionSummary(client, activeCase);
      } else {
        await whatsappClient.sendTextMessage(
          client.phone_number,
          `⚠️ We could not read *${filename}* clearly. Please ensure the document is:\n• Flat and well-lit\n• Not blurry or tilted\n• All text is visible\n\nThen re-upload the document.`
        );
      }
    } catch (err) {
      console.error('[Document Handling Error]:', err.message);
      await whatsappClient.sendTextMessage(
        client.phone_number,
        `⚠️ There was a technical issue processing this document. Our CA team has been notified and will assist you shortly.`
      );
    }
  }

  /**
   * Send concise extraction summary and interactive confirmation buttons
   */
  async sendExtractionSummary(client, activeCase) {
    const c = db.getCaseById(activeCase.id);
    const fields = db.getExtractedFieldsByCaseId(activeCase.id);

    const proposedName = c.proposed_company_name || 'Pending Submission';
    const state = c.registered_office_state || 'Not specified';

    // Build director details — de-duplicate by name, keep entry with most extracted fields
    const directorMap = new Map();
    const nameEntries = fields.filter(f => f.field_key === 'director_name');

    for (const f of nameEntries) {
      const idx = f.entity_index;
      const src = f.source_document_name;
      const findField = (key) => fields.find(p =>
        p.field_key === key && p.entity_index === idx && p.source_document_name === src
      );
      const pan = findField('director_pan');
      const aadhaar = findField('director_aadhaar');
      const dob = findField('director_dob');
      const father = findField('director_father_name');

      const panVal = pan?.extracted_value;
      const aadhaarVal = aadhaar?.extracted_value;
      const dobVal = dob?.extracted_value;
      const fatherVal = father?.extracted_value;

      const subDetails = [];
      if (panVal) subDetails.push(`PAN: ${panVal}`);
      if (aadhaarVal) subDetails.push(`Aadhaar: ${aadhaarVal.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')}`);
      if (dobVal) subDetails.push(`DOB: ${dobVal}`);
      if (fatherVal) subDetails.push(`Father: ${fatherVal}`);

      let details = `• *${f.extracted_value}*`;
      if (subDetails.length > 0) details += `\n  ${subDetails.join(' | ')}`;
      if (!panVal && !aadhaarVal) details += '\n  _Identity document pending_';

      // De-duplicate by normalized name — keep entry with more details
      const nameKey = f.extracted_value.trim().toUpperCase();
      const existing = directorMap.get(nameKey);
      if (!existing || subDetails.length > existing.fieldCount) {
        directorMap.set(nameKey, { details, fieldCount: subDetails.length });
      }
    }
    const directors = Array.from(directorMap.values()).map(e => e.details).join('\n');

    // Count extracted fields for confidence display
    const totalFields = fields.length;
    const highConfidence = fields.filter(f => f.confidence >= 0.85).length;

    const summaryText =
      `📋 *Ledgerly MCA Dossier Summary*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 *Proposed Name:* ${proposedName}\n` +
      `📍 *State:* ${state}\n` +
      `👥 *Directors:*\n${directors || '• To be uploaded'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 _${highConfidence}/${totalFields} fields extracted with high confidence_\n\n` +
      `Please review and confirm these details before we run the SPICe+ Part A official name check.`;

    const buttons = [
      { id: 'BTN_CONFIRM_DETAILS', title: '✅ Confirm Details' },
      { id: 'BTN_CORRECT_DETAILS', title: '✏️ Correct Details' },
      { id: 'BTN_TALK_CA', title: '📞 Talk to CA' }
    ];

    await whatsappClient.sendInteractiveButtons(
      client.phone_number,
      summaryText,
      buttons,
      'MCA Filing Review'
    );
  }

  /**
   * Handle Interactive Button Actions
   */
  async handleInteractiveButton(client, activeCase, buttonId) {
    const action = buttonId.trim().toUpperCase();

    if (action.includes('CONFIRM')) {
      db.updateCase(activeCase.id, {
        client_confirmed: true,
        client_confirmation_timestamp: new Date().toISOString()
      });

      WorkflowStateMachine.transition(
        activeCase.id,
        CASE_STATES.NAME_REVIEW,
        client.id,
        'CLIENT',
        'Client confirmed extracted dossier'
      );

      await whatsappClient.sendTextMessage(
        client.phone_number,
        '✅ Details confirmed! Running official SPICe+ Part A name availability and trademark checks...'
      );

      // Run automated SPICe+ Name Review
      const nameReview = NameReviewService.runNameReview(
        activeCase.id,
        activeCase.proposed_company_name || 'Apex Technologies Private Limited'
      );

      if (nameReview.hasConflict) {
        await whatsappClient.sendTextMessage(
          client.phone_number,
          `⚠️ *Name Review Notice:* ${nameReview.conflictReason}\n\n` +
          `Please reply with an alternative proposed company name to test.`
        );
      } else {
        WorkflowStateMachine.transition(
          activeCase.id,
          CASE_STATES.ADMIN_REVIEW,
          'SYSTEM',
          'SYSTEM',
          'Preliminary name check passed'
        );

        await whatsappClient.sendTextMessage(
          client.phone_number,
          `🎉 Preliminary SPICe+ Part A name search passed with no direct conflicts!\n\n` +
          `Your case has been forwarded to our CA Partner for final review and SPICe+ filing preparation.\n\n` +
          `_${nameReview.legalNotice}_`
        );
      }
    } else if (action.includes('CORRECT')) {
      WorkflowStateMachine.transition(
        activeCase.id,
        CASE_STATES.NEEDS_CORRECTION,
        client.id,
        'CLIENT',
        'Client requested correction'
      );

      await whatsappClient.sendTextMessage(
        client.phone_number,
        '✏️ Please reply with the corrected information in plain text (e.g., "Company Name: Zenith Cloud Solutions Private Limited" or "State: Karnataka").'
      );
    } else if (action.includes('TALK') || action.includes('CA')) {
      WorkflowStateMachine.transition(
        activeCase.id,
        CASE_STATES.MANUAL_REVIEW,
        client.id,
        'CLIENT',
        'Client requested human assistance via button'
      );

      await whatsappClient.sendTextMessage(
        client.phone_number,
        '🤝 You have been routed to our senior MCA specialist. We will respond shortly!'
      );
    }
  }

  /**
   * Handle client text corrections
   */
  async handleClientCorrectionText(client, activeCase, text) {
    const updates = {};
    if (text.toLowerCase().includes('name:')) {
      const parts = text.split(/name:/i);
      updates.proposed_company_name = parts[1].trim();
    } else if (text.length > 5 && !activeCase.proposed_company_name) {
      updates.proposed_company_name = text.trim();
    }

    if (Object.keys(updates).length > 0) {
      db.updateCase(activeCase.id, updates);
      db.addAuditLog({
        caseId: activeCase.id,
        actorId: client.id,
        actorRole: 'CLIENT',
        action: 'CLIENT_CORRECTION_SUBMITTED',
        details: updates
      });

      await whatsappClient.sendTextMessage(
        client.phone_number,
        `Updated details recorded! New proposed name: *${updates.proposed_company_name || activeCase.proposed_company_name}*`
      );

      await this.sendExtractionSummary(client, activeCase);
    } else {
      await whatsappClient.sendTextMessage(
        client.phone_number,
        `Thank you. Your correction notes have been added to case *${activeCase.case_number}* for admin verification.`
      );
    }
  }
}

export const conversationManager = new ConversationManager();
