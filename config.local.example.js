/* Local machine settings for dashboard.html.
 *
 * Copy this file to `config.local.js` (same folder) and fill in your own keys. The dashboard
 * loads `config.local.js` if it is there and uses these values as the defaults in Settings, so
 * nobody has to retype them. Anything saved in Settings afterwards wins over this file.
 *
 * `config.local.js` is listed in .gitignore because it holds live credentials. Never commit it,
 * and never paste these values into a chat, an issue or a screenshot.
 */
window.AOC4_LOCAL_CONFIG = {
  sandbox: {
    // 'https://api.sandbox.co.in' for live keys (key_live_… / secret_live_…),
    // 'https://test-api.sandbox.co.in' for test keys (key_test_… / secret_test_…).
    env: 'https://api.sandbox.co.in',
    key: '',
    secret: '',
    version: ''            // optional x-api-version, e.g. '1.0'
  },
  ai: {
    provider: 'anthropic', // 'anthropic' | 'openai' | 'gemini'
    key: ''
  },
  // Chrome extension id of the AOC-4 Auto Filler, from chrome://extensions with Developer mode on.
  // With it set, Review & Send can hand the client straight to the extension.
  extensionId: ''
};
