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
  ai: {
    provider: 'anthropic', // 'anthropic' | 'openai' | 'gemini' | 'gateway'
    key: ''
  },
  // Germin8 API gateway (Supabase edge function): centralizes the real Claude/Filesure keys
  // server-side so only this scoped, revocable token ever reaches the browser. Get both values
  // from Sumit. Used when ai.provider is 'gateway', and always used for company master-data
  // lookups (route "filesure-company") regardless of ai.provider.
  gateway: {
    url: '',
    token: ''
  },
  // Chrome extension id of the AOC-4 Auto Filler, from chrome://extensions with Developer mode on.
  // With it set, Review & Send can hand the client straight to the extension.
  extensionId: ''
};
