import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';

import webhookRoutes from './routes/webhookRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import superadminRoutes from './routes/superadminRoutes.js';
import extensionRoutes from './routes/extensionRoutes.js';
import mockRoutes from './routes/mockRoutes.js';
import mcaRoutes from './routes/mcaRoutes.js';

const app = express();

// Security and CORS
app.use(cors({ origin: true, credentials: true }));

// Raw body parser preserved for Meta Webhook signature verification
app.use(
  express.json({
    limit: '20mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Global rate limiting
app.use(rateLimiter({ windowMs: 60000, maxRequests: 200 }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Ledgerly WhatsApp Automation Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    metaApiVersion: config.whatsapp.apiVersion,
    mockMode: config.whatsapp.mockMode
  });
});

// Modular Route Handlers
app.use('/api/webhook', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/extension', extensionRoutes);
app.use('/api/mock', mockRoutes);
app.use('/api/mca', mcaRoutes);

// Sanitized centralized error handler
app.use(errorHandler);

// Start Server
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(config.port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Ledgerly MCA WhatsApp Automation Service Running`);
    console.log(`📡 Port: ${config.port}`);
    console.log(`🔧 WhatsApp Mock Mode: ${config.whatsapp.mockMode ? 'ENABLED (Zero-Credential Mode)' : 'DISABLED (Live Meta Cloud API)'}`);
    console.log(`🤖 AI LLM Provider: ${config.ai.llmProvider.toUpperCase()}`);
    console.log(`👁️ OCR Provider: ${config.ai.ocrProvider.toUpperCase()}`);
    console.log(`=======================================================`);
  });

  const shutdown = () => {
    console.log('\n[Server] Gracefully shutting down...');
    server.close(() => {
      console.log('[Server] Closed all active connections.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
