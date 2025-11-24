import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaudeProvider, CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL } from '../../../src/services/llm/claude';

// Mock Obsidian's requestUrl
vi.mock('obsidian', () => ({
  requestUrl: vi.fn(),
}));

import { requestUrl } from 'obsidian';

describe('ClaudeProvider', () => {
  let provider: ClaudeProvider;
  const mockRequestUrl = vi.mocked(requestUrl);

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ClaudeProvider('sk-ant-test-key-12345');
  });

  describe('constructor', () => {
    it('uses default model when not specified', () => {
      const p = new ClaudeProvider('test-key');
      expect(p.getModel()).toBe(DEFAULT_CLAUDE_MODEL);
    });

    it('uses provided model', () => {
      const p = new ClaudeProvider('test-key', 'claude-3-opus-20240229');
      expect(p.getModel()).toBe('claude-3-opus-20240229');
    });
  });

  describe('getName', () => {
    it('returns "Claude"', () => {
      expect(provider.getName()).toBe('Claude');
    });
  });

  describe('getType', () => {
    it('returns "claude"', () => {
      expect(provider.getType()).toBe('claude');
    });
  });

  describe('isAvailable', () => {
    it('returns true when API key is set', async () => {
      expect(await provider.isAvailable()).toBe(true);
    });

    it('returns false when API key is empty', async () => {
      const p = new ClaudeProvider('');
      expect(await p.isAvailable()).toBe(false);
    });
  });

  describe('complete', () => {
    it('sends correct request to Claude API', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: {
          content: [{ type: 'text', text: 'Test response' }],
        },
      } as any);

      await provider.complete('Test prompt');

      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-ant-test-key-12345',
          'anthropic-version': '2023-06-01',
        },
        body: expect.stringContaining('Test prompt'),
      });
    });

    it('returns text content from response', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: {
          content: [{ type: 'text', text: 'This is the response' }],
        },
      } as any);

      const result = await provider.complete('Test');

      expect(result).toBe('This is the response');
    });

    it('throws error on API error response', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 400,
        json: {
          error: { type: 'invalid_request', message: 'Bad request' },
        },
      } as any);

      await expect(provider.complete('Test')).rejects.toThrow('Bad request');
    });

    it('throws error on empty response', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: { content: [] },
      } as any);

      await expect(provider.complete('Test')).rejects.toThrow('Empty response');
    });

    it('throws error when no text content in response', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: {
          content: [{ type: 'image', data: 'base64...' }],
        },
      } as any);

      await expect(provider.complete('Test')).rejects.toThrow('No text content');
    });

    it('throws error when API key not configured', async () => {
      const p = new ClaudeProvider('');

      await expect(p.complete('Test')).rejects.toThrow('API key not configured');
    });

    it('includes model in request body', async () => {
      const p = new ClaudeProvider('key', 'claude-3-opus-20240229');
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: { content: [{ type: 'text', text: 'OK' }] },
      } as any);

      await p.complete('Test');

      const call = mockRequestUrl.mock.calls[0][0];
      const body = JSON.parse(call.body);
      expect(body.model).toBe('claude-3-opus-20240229');
    });
  });

  describe('setModel', () => {
    it('updates the model', () => {
      provider.setModel('claude-3-5-haiku-20241022');
      expect(provider.getModel()).toBe('claude-3-5-haiku-20241022');
    });
  });

  describe('CLAUDE_MODELS', () => {
    it('includes expected models', () => {
      const modelIds = CLAUDE_MODELS.map((m) => m.id);

      expect(modelIds).toContain('claude-sonnet-4-20250514');
      expect(modelIds).toContain('claude-3-5-sonnet-20241022');
      expect(modelIds).toContain('claude-3-5-haiku-20241022');
    });

    it('has name for each model', () => {
      for (const model of CLAUDE_MODELS) {
        expect(model.name).toBeTruthy();
        expect(model.id).toBeTruthy();
      }
    });
  });
});
