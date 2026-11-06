import crypto from 'crypto';

/**
 * In-memory WhatsApp Simulator for local development & automated testing.
 * Records all outbound messages and simulates Meta Cloud API responses.
 */
class MockWhatsAppService {
  constructor() {
    this.outboundMessages = [];
    this.mockMediaStore = new Map();
  }

  reset() {
    this.outboundMessages = [];
    this.mockMediaStore.clear();
  }

  recordOutbound(messagePayload) {
    const wamid = 'wamid.MOCK_' + crypto.randomBytes(8).toString('hex');
    const record = {
      wamid,
      ...messagePayload,
      timestamp: new Date().toISOString(),
      status: 'DELIVERED'
    };
    this.outboundMessages.push(record);
    return {
      messaging_product: 'whatsapp',
      contacts: [{ input: messagePayload.to, wa_id: messagePayload.to }],
      messages: [{ id: wamid, message_status: 'accepted' }]
    };
  }

  getOutboundHistory(recipientPhone = null) {
    if (!recipientPhone) return this.outboundMessages;
    return this.outboundMessages.filter(m => m.to === recipientPhone);
  }

  storeMockMedia(buffer, mimeType, filename, customMediaId = null) {
    const mediaId = customMediaId || ('mock_media_' + crypto.randomBytes(6).toString('hex'));
    this.mockMediaStore.set(mediaId, { buffer, mimeType, filename });
    return {
      id: mediaId,
      url: `http://localhost:4000/api/mock/media/${mediaId}`
    };
  }

  getMockMedia(mediaId) {
    return this.mockMediaStore.get(mediaId) || null;
  }
}

export const mockWhatsAppService = new MockWhatsAppService();
