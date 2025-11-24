import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SmartConnectionsProvider } from '../../../src/services/llm/smart-connections';
import { App } from '../../mocks/obsidian';

describe('SmartConnectionsProvider', () => {
  let app: App;
  let provider: SmartConnectionsProvider;

  beforeEach(() => {
    app = new App();
    provider = new SmartConnectionsProvider(app as any);
    // Clear any global smart_env
    if (typeof window !== 'undefined') {
      delete (window as any).smart_env;
    }
  });

  afterEach(() => {
    if (typeof window !== 'undefined') {
      delete (window as any).smart_env;
    }
  });

  describe('getName', () => {
    it('returns "Smart Connections"', () => {
      expect(provider.getName()).toBe('Smart Connections');
    });
  });

  describe('getType', () => {
    it('returns "smart-connections"', () => {
      expect(provider.getType()).toBe('smart-connections');
    });
  });

  describe('isAvailable', () => {
    it('returns false when Smart Connections not installed', async () => {
      expect(await provider.isAvailable()).toBe(false);
    });

    it('returns false when SC installed but brain not loaded', async () => {
      (app as any).plugins.plugins['smart-connections'] = {
        brain: null,
        settings: {},
      };

      expect(await provider.isAvailable()).toBe(false);
    });

    it('returns true when smart_env.complete is available', async () => {
      (app as any).plugins.plugins['smart-connections'] = {
        brain: {},
        settings: { chat_model_platform: 'openai' },
      };
      (window as any).smart_env = {
        complete: vi.fn(),
      };

      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns true when brain loaded and chat model configured', async () => {
      (app as any).plugins.plugins['smart-connections'] = {
        brain: { loaded: true },
        settings: { chat_model_platform: 'anthropic' },
      };

      expect(await provider.isAvailable()).toBe(true);
    });
  });

  describe('complete', () => {
    it('uses smart_env.complete when available', async () => {
      const mockComplete = vi.fn().mockResolvedValue('AI response');
      (window as any).smart_env = { complete: mockComplete };

      const result = await provider.complete('Test prompt');

      expect(mockComplete).toHaveBeenCalledWith('Test prompt');
      expect(result).toBe('AI response');
    });

    it('throws error when SC not available', async () => {
      await expect(provider.complete('Test')).rejects.toThrow(
        'Smart Connections plugin not available'
      );
    });

    it('falls back to plugin.complete if smart_env not available', async () => {
      const mockComplete = vi.fn().mockResolvedValue('Fallback response');
      (app as any).plugins.plugins['smart-connections'] = {
        brain: {},
        complete: mockComplete,
      };

      const result = await provider.complete('Test prompt');

      expect(mockComplete).toHaveBeenCalledWith('Test prompt');
      expect(result).toBe('Fallback response');
    });

    it('throws helpful error when no completion API available', async () => {
      (app as any).plugins.plugins['smart-connections'] = {
        brain: {},
        settings: {},
      };

      await expect(provider.complete('Test')).rejects.toThrow(
        'Smart Connections completion API not available'
      );
    });
  });

  describe('getModelInfo', () => {
    it('returns "Unknown" when SC not available', () => {
      expect(provider.getModelInfo()).toBe('Unknown');
    });

    it('returns platform when no model specified', () => {
      (app as any).plugins.plugins['smart-connections'] = {
        settings: { chat_model_platform: 'openai' },
      };

      expect(provider.getModelInfo()).toBe('openai');
    });

    it('returns platform and model when both specified', () => {
      (app as any).plugins.plugins['smart-connections'] = {
        settings: {
          chat_model_platform: 'anthropic',
          model_name: 'claude-3-sonnet',
        },
      };

      expect(provider.getModelInfo()).toBe('anthropic (claude-3-sonnet)');
    });

    it('returns "Unknown" when no settings', () => {
      (app as any).plugins.plugins['smart-connections'] = {};

      expect(provider.getModelInfo()).toBe('Unknown');
    });
  });
});
