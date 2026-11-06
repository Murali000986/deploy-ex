import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000',

  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || 'mock_access_token',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || 'mock_phone_id_10987654321',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || 'mock_waba_id_987654321',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'ledgerly_meta_webhook_secret_verify_token_2026',
    appSecret: process.env.WHATSAPP_APP_SECRET || 'mock_app_secret_0123456789abcdef0123456789abcdef',
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
    mockMode: process.env.WHATSAPP_MOCK_MODE !== 'false', // Default to true for zero-credential startup
    graphApiBase: 'https://graph.facebook.com'
  },

  ai: {
    llmProvider: process.env.LLM_PROVIDER || 'groq',
    groqApiKey: process.env.GROQ_API_KEY || '',
    groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    ocrProvider: process.env.OCR_PROVIDER || 'tesseract'
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || 'ledgerly_secret_jwt_key_default_insecure_dev',
    extensionApiKey: process.env.EXTENSION_API_KEY || 'ext_ledgerly_mca_bridge_token_2026',
    maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_BYTES || '10485760', 10),
    documentStorageDir: process.env.DOCUMENT_STORAGE_DIR || './uploads/documents'
  }
};
