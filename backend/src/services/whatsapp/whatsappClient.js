import { config } from '../../config/env.js';
import { mockWhatsAppService } from './mockWhatsAppService.js';
import fs from 'fs';
import path from 'path';

/**
 * Production Client for Meta WhatsApp Business Platform Cloud API.
 * Adheres to official Meta API v20.0 specs with full mock fallback.
 */
class WhatsAppClient {
  constructor() {
    this.token = config.whatsapp.accessToken;
    this.phoneNumberId = config.whatsapp.phoneNumberId;
    this.apiVersion = config.whatsapp.apiVersion;
    this.mockMode = config.whatsapp.mockMode;
    this.baseUrl = `${config.whatsapp.graphApiBase}/${this.apiVersion}/${this.phoneNumberId}`;
  }

  /**
   * Internal HTTP dispatcher with retry and error sanitation
   */
  async _request(endpoint, options = {}, retries = 2) {
    if (this.mockMode) {
      return null;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const response = await fetch(url, { ...options, headers });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          const errMsg = data?.error?.message || `WhatsApp API error HTTP ${response.status}`;
          throw new Error(errMsg);
        }
        return data;
      } catch (err) {
        if (attempt > retries) {
          // Never log raw access token in errors
          console.error(`[WhatsApp API Error] Endpoint ${endpoint}:`, err.message);
          throw err;
        }
        // Exponential backoff
        await new Promise(r => setTimeout(r, attempt * 500));
      }
    }
  }

  /**
   * Send standard text message
   */
  async sendTextMessage(to, text) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text }
    };

    if (this.mockMode) {
      return mockWhatsAppService.recordOutbound(payload);
    }

    return this._request('/messages', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Send interactive button message (up to 3 buttons)
   */
  async sendInteractiveButtons(to, bodyText, buttons = [], headerText = null) {
    const interactive = {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.substring(0, 20) }
        }))
      }
    };

    if (headerText) {
      interactive.header = { type: 'text', text: headerText };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive
    };

    if (this.mockMode) {
      return mockWhatsAppService.recordOutbound(payload);
    }

    return this._request('/messages', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Send interactive list message (for multiple choices)
   */
  async sendInteractiveList(to, bodyText, buttonText, sections) {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonText.substring(0, 20),
          sections
        }
      }
    };

    if (this.mockMode) {
      return mockWhatsAppService.recordOutbound(payload);
    }

    return this._request('/messages', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId) {
    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    };

    if (this.mockMode) {
      return { success: true };
    }

    return this._request('/messages', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * Securely download media attachment from Meta Cloud API
   */
  async downloadMedia(mediaId, destinationDir = config.security.documentStorageDir) {
    if (this.mockMode) {
      const mock = mockWhatsAppService.getMockMedia(mediaId);
      if (mock) {
        if (!fs.existsSync(destinationDir)) fs.mkdirSync(destinationDir, { recursive: true });
        const filePath = path.join(destinationDir, mock.filename || `mock_${mediaId}.pdf`);
        fs.writeFileSync(filePath, mock.buffer);
        return {
          filePath,
          mimeType: mock.mimeType,
          fileSize: mock.buffer.length
        };
      }
      return null;
    }

    // Step 1: Query media URL
    const mediaMeta = await this._request(`/${mediaId}`, { method: 'GET' });
    if (!mediaMeta || !mediaMeta.url) throw new Error('Failed to retrieve media metadata from Meta API');

    // Step 2: Download raw binary with auth header
    const response = await fetch(mediaMeta.url, {
      headers: { Authorization: `Bearer ${this.token}` }
    });

    if (!response.ok) throw new Error(`Media binary download failed with HTTP ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!fs.existsSync(destinationDir)) fs.mkdirSync(destinationDir, { recursive: true });

    const ext = mediaMeta.mime_type?.includes('pdf') ? '.pdf' : '.jpg';
    const filePath = path.join(destinationDir, `media_${mediaId}_${Date.now()}${ext}`);
    fs.writeFileSync(filePath, buffer);

    return {
      filePath,
      mimeType: mediaMeta.mime_type,
      fileSize: mediaMeta.file_size || buffer.length
    };
  }
}

export const whatsappClient = new WhatsAppClient();
