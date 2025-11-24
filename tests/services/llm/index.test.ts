import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createLLMProvider,
  getLLMConfigFromSettings,
  LLMService,
  LLMConfig,
} from '../../../src/services/llm/index';
import { App } from '../../mocks/obsidian';
import { KastenatorSettings } from '../../../src/types';

const createDefaultSettings = (): KastenatorSettings => ({
  notificationHour: 9,
  notificationMinute: 0,
  quarryFolders: ['Fleeting notes'],
  migrationField: 'Migration',
  quarryValue: 'quarry',
  atomFolder: 'Atoms',
  atomTemplatePath: '',
  lastNotificationDate: '',
  notificationEnabled: true,
  llmProvider: 'none',
  useLLMCritique: true,
});

describe('LLM Provider Factory', () => {
  let app: App;

  beforeEach(() => {
    app = new App();
  });

  describe('createLLMProvider', () => {
    it('returns null for provider type "none"', () => {
      const config: LLMConfig = { provider: 'none' };
      const provider = createLLMProvider(app as any, config);
      expect(provider).toBeNull();
    });

    it('creates SmartConnectionsProvider for "smart-connections"', () => {
      const config: LLMConfig = { provider: 'smart-connections' };
      const provider = createLLMProvider(app as any, config);

      expect(provider).not.toBeNull();
      expect(provider?.getType()).toBe('smart-connections');
      expect(provider?.getName()).toBe('Smart Connections');
    });

    it('creates ClaudeProvider when API key provided', () => {
      const config: LLMConfig = {
        provider: 'claude',
        claudeApiKey: 'sk-ant-test-key',
        claudeModel: 'claude-3-5-sonnet-20241022',
      };
      const provider = createLLMProvider(app as any, config);

      expect(provider).not.toBeNull();
      expect(provider?.getType()).toBe('claude');
      expect(provider?.getName()).toBe('Claude');
    });

    it('returns null for Claude without API key', () => {
      const config: LLMConfig = { provider: 'claude' };
      const provider = createLLMProvider(app as any, config);
      expect(provider).toBeNull();
    });

    it('creates OpenRouterProvider when API key provided', () => {
      const config: LLMConfig = {
        provider: 'openrouter',
        openrouterApiKey: 'sk-or-test-key',
        openrouterModel: 'anthropic/claude-3.5-sonnet',
      };
      const provider = createLLMProvider(app as any, config);

      expect(provider).not.toBeNull();
      expect(provider?.getType()).toBe('openrouter');
      expect(provider?.getName()).toBe('OpenRouter');
    });

    it('returns null for OpenRouter without API key', () => {
      const config: LLMConfig = { provider: 'openrouter' };
      const provider = createLLMProvider(app as any, config);
      expect(provider).toBeNull();
    });
  });

  describe('getLLMConfigFromSettings', () => {
    it('extracts LLM config from settings', () => {
      const settings: KastenatorSettings = {
        ...createDefaultSettings(),
        llmProvider: 'claude',
        claudeApiKey: 'test-key',
        claudeModel: 'claude-3-opus',
      };

      const config = getLLMConfigFromSettings(settings);

      expect(config.provider).toBe('claude');
      expect(config.claudeApiKey).toBe('test-key');
      expect(config.claudeModel).toBe('claude-3-opus');
    });

    it('defaults to "none" when provider not set', () => {
      const settings = createDefaultSettings();
      delete (settings as any).llmProvider;

      const config = getLLMConfigFromSettings(settings);

      expect(config.provider).toBe('none');
    });
  });
});

describe('LLMService', () => {
  let app: App;
  let settings: KastenatorSettings;
  let service: LLMService;

  beforeEach(() => {
    app = new App();
    settings = createDefaultSettings();
    service = new LLMService(app as any, settings);
  });

  describe('isAvailable', () => {
    it('returns false when no provider configured', async () => {
      const available = await service.isAvailable();
      expect(available).toBe(false);
    });

    it('returns true for Claude with API key', async () => {
      settings.llmProvider = 'claude';
      settings.claudeApiKey = 'test-key';
      service.updateSettings(settings);

      const available = await service.isAvailable();
      expect(available).toBe(true);
    });

    it('returns true for OpenRouter with API key', async () => {
      settings.llmProvider = 'openrouter';
      settings.openrouterApiKey = 'test-key';
      service.updateSettings(settings);

      const available = await service.isAvailable();
      expect(available).toBe(true);
    });
  });

  describe('getProviderName', () => {
    it('returns "None" when no provider configured', () => {
      expect(service.getProviderName()).toBe('None');
    });

    it('returns provider name when configured', () => {
      settings.llmProvider = 'claude';
      settings.claudeApiKey = 'test-key';
      service.updateSettings(settings);

      expect(service.getProviderName()).toBe('Claude');
    });
  });

  describe('complete', () => {
    it('returns error result when no provider configured', async () => {
      const result = await service.complete('test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('No LLM provider configured');
      expect(result.provider).toBe('none');
    });

    it('returns error when provider not available', async () => {
      settings.llmProvider = 'smart-connections';
      service.updateSettings(settings);

      // SC is not available in test environment
      const result = await service.complete('test prompt');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });
  });

  describe('buildCritiquePrompt', () => {
    it('constructs prompt with all parameters', () => {
      const prompt = service.buildCritiquePrompt(
        'Test concept',
        'This is my explanation',
        'Source says X',
        'Full source content here'
      );

      expect(prompt).toContain('Test concept');
      expect(prompt).toContain('This is my explanation');
      expect(prompt).toContain('Source says X');
      expect(prompt).toContain('Full source content here');
      expect(prompt).toContain('Atomicity');
      expect(prompt).toContain('Clarity');
    });

    it('truncates long source content', () => {
      const longContent = 'A'.repeat(5000);
      const prompt = service.buildCritiquePrompt(
        'Concept',
        'Explanation',
        'Evidence',
        longContent
      );

      // Source should be truncated to 2000 chars
      expect(prompt.length).toBeLessThan(longContent.length);
    });

    it('includes evaluation criteria', () => {
      const prompt = service.buildCritiquePrompt('C', 'E', 'V', 'S');

      expect(prompt).toContain('Atomicity');
      expect(prompt).toContain('Clarity');
      expect(prompt).toContain('Substance');
      expect(prompt).toContain('Evidence');
      expect(prompt).toContain('Accuracy');
    });
  });

  describe('updateSettings', () => {
    it('reinitialises provider when settings change', async () => {
      // Initially no provider
      expect(service.getProviderName()).toBe('None');

      // Update to use Claude
      settings.llmProvider = 'claude';
      settings.claudeApiKey = 'new-key';
      service.updateSettings(settings);

      expect(service.getProviderName()).toBe('Claude');
    });

    it('clears provider when switched to none', async () => {
      settings.llmProvider = 'claude';
      settings.claudeApiKey = 'test-key';
      service.updateSettings(settings);
      expect(service.getProviderName()).toBe('Claude');

      settings.llmProvider = 'none';
      service.updateSettings(settings);
      expect(service.getProviderName()).toBe('None');
    });
  });
});
