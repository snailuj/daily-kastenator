import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OpenRouterProvider,
  OPENROUTER_MODELS,
  DEFAULT_OPENROUTER_MODEL,
} from '../../../src/services/llm/openrouter';

// Mock Obsidian's requestUrl
vi.mock('obsidian', () => ({
  requestUrl: vi.fn(),
}));

import { requestUrl } from 'obsidian';

describe('OpenRouterProvider', () => {
  let provider: OpenRouterProvider;
  const mockRequestUrl = vi.mocked(requestUrl);

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenRouterProvider('sk-or-test-key-12345');
  });

  describe('constructor', () => {
    it('uses default model when not specified', () => {
      const p = new OpenRouterProvider('test-key');
      expect(p.getModel()).toBe(DEFAULT_OPENROUTER_MODEL);
    });

    it('uses provided model', () => {
      const p = new OpenRouterProvider('test-key', 'openai/gpt-4o');
      expect(p.getModel()).toBe('openai/gpt-4o');
    });
  });

  describe('getName', () => {
    it('returns "OpenRouter"', () => {
      expect(provider.getName()).toBe('OpenRouter');
    });
  });

  describe('getType', () => {
    it('returns "openrouter"', () => {
      expect(provider.getType()).toBe('openrouter');
    });
  });

  describe('isAvailable', () => {
    it('returns true when API key is set', async () => {
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false when API key is empty', async () => {
      const p = new OpenRouterProvider('');
      expect(await p.isAvailable()).toBe(false);
    });
  });

  describe('complete', () => {
    it('sends correct request to OpenRouter API', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: {
          choices: [{ message: { content: 'Test response' } }],
        },
      } as any);

      await provider.complete('Test prompt');

      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'https://openrouter.ai/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-or-test-key-12345',
          'HTTP-Referer': 'https://github.com/daily-kastenator',
          'X-Title': 'Daily Kastenator',
        },
        body: expect.stringContaining('Test prompt'),
      });
    });

    it('returns content from response', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: {
          choices: [{ message: { content: 'This is the response' } }],
        },
      } as any);

      const result = await provider.complete('Test');

      expect(result).toBe('This is the response');
    });

    it('throws error on API error response', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 400,
        json: {
          error: { message: 'Invalid request', code: 'invalid_request' },
        },
      } as any);

      await expect(provider.complete('Test')).rejects.toThrow('Invalid request');
    });

    it('throws error on empty choices', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: { choices: [] },
      } as any);

      await expect(provider.complete('Test')).rejects.toThrow('Empty response');
    });

    it('throws error when no content in message', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: {
          choices: [{ message: {} }],
        },
      } as any);

      await expect(provider.complete('Test')).rejects.toThrow('No content');
    });

    it('throws error when API key not configured', async () => {
      const p = new OpenRouterProvider('');

      await expect(p.complete('Test')).rejects.toThrow('API key not configured');
    });

    it('includes model in request body', async () => {
      const p = new OpenRouterProvider('key', 'openai/gpt-4o-mini');
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: { choices: [{ message: { content: 'OK' } }] },
      } as any);

      await p.complete('Test');

      const call = mockRequestUrl.mock.calls[0][0];
      const body = JSON.parse(call.body);
      expect(body.model).toBe('openai/gpt-4o-mini');
    });

    it('uses OpenAI-compatible message format', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: { choices: [{ message: { content: 'OK' } }] },
      } as any);

      await provider.complete('Hello world');

      const call = mockRequestUrl.mock.calls[0][0];
      const body = JSON.parse(call.body);
      expect(body.messages).toEqual([
        { role: 'user', content: 'Hello world' },
      ]);
    });
  });

  describe('setModel', () => {
    it('updates the model', () => {
      provider.setModel('meta-llama/llama-3.1-70b-instruct');
      expect(provider.getModel()).toBe('meta-llama/llama-3.1-70b-instruct');
    });
  });

  describe('OPENROUTER_MODELS', () => {
    it('includes Claude models', () => {
      const modelIds = OPENROUTER_MODELS.map((m) => m.id);

      expect(modelIds).toContain('anthropic/claude-sonnet-4');
      expect(modelIds).toContain('anthropic/claude-3.5-sonnet');
    });

    it('includes OpenAI models', () => {
      const modelIds = OPENROUTER_MODELS.map((m) => m.id);

      expect(modelIds).toContain('openai/gpt-4o');
      expect(modelIds).toContain('openai/gpt-4o-mini');
    });

    it('includes open-source models', () => {
      const modelIds = OPENROUTER_MODELS.map((m) => m.id);

      expect(modelIds).toContain('meta-llama/llama-3.1-70b-instruct');
      expect(modelIds).toContain('mistralai/mistral-large');
    });

    it('has name for each model', () => {
      for (const model of OPENROUTER_MODELS) {
        expect(model.name).toBeTruthy();
        expect(model.id).toBeTruthy();
      }
    });
  });
});
