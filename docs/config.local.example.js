/**
 * Local Configuration Template
 *
 * Copy this file to `config.local.js` and fill in your API keys.
 * The file `config.local.js` is gitignored and will NOT be committed.
 *
 * IMPORTANT: Only use this for LOCAL development!
 * Never commit actual API keys to version control.
 *
 * Usage:
 *   1. Copy this file: cp config.local.example.js config.local.js
 *   2. Edit config.local.js and add your API keys
 *   3. Refresh the page - keys will be loaded automatically
 */

export const LOCAL_CONFIG = {
    apiKeys: {
        // Google Gemini API Key
        // Get yours at: https://aistudio.google.com/app/apikey
        gemini: '',

        // OpenAI API Key
        // Get yours at: https://platform.openai.com/api-keys
        openai: '',

        // Anthropic API Key
        // Get yours at: https://console.anthropic.com/settings/keys
        anthropic: ''
    },

    // Optional: Set default provider ('gemini', 'openai', 'anthropic', 'ollama')
    // defaultProvider: 'gemini',

    // Optional: Ollama configuration (no API key needed)
    // ollama: {
    //     endpoint: 'http://localhost:11434',
    //     model: 'llama3'
    // }
};
