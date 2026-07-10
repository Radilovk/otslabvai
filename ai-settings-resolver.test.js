import { resolveAIApiKey, loadResolvedAISettings } from './ai-settings-resolver.js';

const defaultSettings = () => ({
  provider: 'openai',
  model: 'gpt-4',
  apiKey: '',
  temperature: 0.3,
  maxTokens: 4096,
  promptTemplate: 'test'
});

describe('resolveAIApiKey', () => {
  test('връща apiKey от настройките ако е зададен', async () => {
    const env = {};
    const key = await resolveAIApiKey(env, { provider: 'openai', apiKey: 'sk-from-settings' });
    expect(key).toBe('sk-from-settings');
  });

  test('взима OPENAI_API_KEY от Worker secret', async () => {
    const env = { OPENAI_API_KEY: 'sk-env' };
    const key = await resolveAIApiKey(env, { provider: 'openai' });
    expect(key).toBe('sk-env');
  });

  test('взима GOOGLE_AI_API_KEY от Worker secret', async () => {
    const env = { GOOGLE_AI_API_KEY: 'g-env' };
    const key = await resolveAIApiKey(env, { provider: 'google' });
    expect(key).toBe('g-env');
  });

  test('взима provider-specific ключ от KV', async () => {
    const env = {
      PAGE_CONTENT: {
        get: async (k) => (k === 'ai_openai_api_key' ? 'sk-kv' : null)
      }
    };
    const key = await resolveAIApiKey(env, { provider: 'openai' });
    expect(key).toBe('sk-kv');
  });

  test('взима generic ai_api_key от KV', async () => {
    const env = {
      PAGE_CONTENT: {
        get: async (k) => (k === 'ai_api_key' ? 'sk-generic' : null)
      }
    };
    const key = await resolveAIApiKey(env, { provider: 'google' });
    expect(key).toBe('sk-generic');
  });
});

describe('loadResolvedAISettings', () => {
  test('слива KV, override и резолвира apiKey', async () => {
    const env = {
      OPENAI_API_KEY: 'sk-secret',
      PAGE_CONTENT: {
        get: async (k) => (k === 'ai_settings' ? JSON.stringify({ provider: 'openai', model: 'gpt-4', temperature: 0.5 }) : null)
      }
    };
    const settings = await loadResolvedAISettings(env, { maxTokens: 8192 }, defaultSettings);
    expect(settings.provider).toBe('openai');
    expect(settings.model).toBe('gpt-4');
    expect(settings.temperature).toBe(0.5);
    expect(settings.maxTokens).toBe(8192);
    expect(settings.apiKey).toBe('sk-secret');
  });

  test('override apiKey има приоритет пред secret', async () => {
    const env = { OPENAI_API_KEY: 'sk-secret', PAGE_CONTENT: { get: async () => null } };
    const settings = await loadResolvedAISettings(env, { provider: 'openai', apiKey: 'sk-override' }, defaultSettings);
    expect(settings.apiKey).toBe('sk-override');
  });
});
