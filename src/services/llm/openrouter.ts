import { requestUrl } from 'obsidian';
import { LLMProvider, LLMProviderType } from './index';

/**
 * Popular OpenRouter models for knowledge work
 */
export const OPENROUTER_MODELS = [
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' },
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large' },
] as const;

export const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-sonnet-4';

/**
 * OpenRouter API response structure (OpenAI-compatible)
 */
interface OpenRouterResponse {
  choices?: Array<{
    message: {
      content: string;
    };
  }>;
  error?: {
    message: string;
    code?: string;
  };
}

/**
 * OpenRouter provider
 *
 * OpenRouter provides a unified API to access 100+ LLM models
 * using OpenAI-compatible endpoints. Single API key, multiple providers.
 *
 * https://openrouter.ai/docs
 */
export class OpenRouterProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  private static readonly API_URL = 'https://openrouter.ai/api/v1/chat/completions';
  private static readonly MAX_TOKENS = 1024;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model ?? DEFAULT_OPENROUTER_MODEL;
  }

  getName(): string {
    return 'OpenRouter';
  }

  getType(): LLMProviderType {
    return 'openrouter';
  }

  /**
   * Check if API key is configured
   */
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Get completion from OpenRouter API
   */
  async complete(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const response = await requestUrl({
      url: OpenRouterProvider.API_URL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com/daily-kastenator',
        'X-Title': 'Daily Kastenator',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: OpenRouterProvider.MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (response.status !== 200) {
      const error = response.json as OpenRouterResponse;
      throw new Error(
        error?.error?.message ?? `OpenRouter API error: ${response.status}`
      );
    }

    const data = response.json as OpenRouterResponse;

    if (!data.choices || data.choices.length === 0) {
      throw new Error('Empty response from OpenRouter API');
    }

    const content = data.choices[0].message?.content;
    if (!content) {
      throw new Error('No content in OpenRouter response');
    }

    return content;
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
