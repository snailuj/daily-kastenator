import { requestUrl } from 'obsidian';
import { LLMProvider, LLMProviderType } from './index';

/**
 * Available Claude models
 */
export const CLAUDE_MODELS = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
] as const;

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/**
 * Claude API response structure
 */
interface ClaudeResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  error?: {
    type: string;
    message: string;
  };
}

/**
 * Direct Claude API provider
 *
 * Uses Anthropic's Messages API directly with user-provided API key
 */
export class ClaudeProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  private static readonly API_URL = 'https://api.anthropic.com/v1/messages';
  private static readonly API_VERSION = '2023-06-01';
  private static readonly MAX_TOKENS = 1024;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model ?? DEFAULT_CLAUDE_MODEL;
  }

  getName(): string {
    return 'Claude';
  }

  getType(): LLMProviderType {
    return 'claude';
  }

  /**
   * Check if API key is configured
   */
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Get completion from Claude API
   */
  async complete(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Claude API key not configured');
    }

    const response = await requestUrl({
      url: ClaudeProvider.API_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ClaudeProvider.API_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: ClaudeProvider.MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (response.status !== 200) {
      const error = response.json as ClaudeResponse;
      throw new Error(
        error?.error?.message ?? `Claude API error: ${response.status}`
      );
    }

    const data = response.json as ClaudeResponse;

    if (!data.content || data.content.length === 0) {
      throw new Error('Empty response from Claude API');
    }

    const textContent = data.content.find((c) => c.type === 'text');
    if (!textContent) {
      throw new Error('No text content in Claude response');
    }

    return textContent.text;
  }

  /**
   * Update the model
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Get current model ID
   */
  getModel(): string {
    return this.model;
  }
}
