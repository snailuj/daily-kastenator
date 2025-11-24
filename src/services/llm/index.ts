import { App } from 'obsidian';
import { KastenatorSettings } from '../../types';
import { SmartConnectionsProvider } from './smart-connections';
import { ClaudeProvider } from './claude';
import { OpenRouterProvider } from './openrouter';

/**
 * Available LLM provider types
 */
export type LLMProviderType = 'none' | 'smart-connections' | 'claude' | 'openrouter';

/**
 * Common interface for all LLM providers
 */
export interface LLMProvider {
  /** Check if the provider is available and configured */
  isAvailable(): Promise<boolean>;

  /** Get a completion from the LLM */
  complete(prompt: string): Promise<string>;

  /** Get the display name of this provider */
  getName(): string;

  /** Get the provider type identifier */
  getType(): LLMProviderType;
}

/**
 * Result of an LLM completion request
 */
export interface LLMResult {
  success: boolean;
  content: string;
  error?: string;
  provider: string;
}

/**
 * Configuration for LLM providers
 */
export interface LLMConfig {
  provider: LLMProviderType;
  claudeApiKey?: string;
  claudeModel?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
}

/**
 * Factory for creating LLM provider instances
 */
export function createLLMProvider(
  app: App,
  config: LLMConfig
): LLMProvider | null {
  switch (config.provider) {
    case 'smart-connections':
      return new SmartConnectionsProvider(app);

    case 'claude':
      if (!config.claudeApiKey) return null;
      return new ClaudeProvider(config.claudeApiKey, config.claudeModel);

    case 'openrouter':
      if (!config.openrouterApiKey) return null;
      return new OpenRouterProvider(config.openrouterApiKey, config.openrouterModel);

    case 'none':
    default:
      return null;
  }
}

/**
 * Extract LLM config from plugin settings
 */
export function getLLMConfigFromSettings(settings: KastenatorSettings): LLMConfig {
  return {
    provider: settings.llmProvider ?? 'none',
    claudeApiKey: settings.claudeApiKey,
    claudeModel: settings.claudeModel,
    openrouterApiKey: settings.openrouterApiKey,
    openrouterModel: settings.openrouterModel,
  };
}

/**
 * Service for managing LLM interactions with fallback support
 */
export class LLMService {
  private app: App;
  private settings: KastenatorSettings;
  private provider: LLMProvider | null = null;

  constructor(app: App, settings: KastenatorSettings) {
    this.app = app;
    this.settings = settings;
    this.initialiseProvider();
  }

  /**
   * Update settings and reinitialise provider
   */
  updateSettings(settings: KastenatorSettings): void {
    this.settings = settings;
    this.initialiseProvider();
  }

  /**
   * Initialise the configured provider
   */
  private initialiseProvider(): void {
    const config = getLLMConfigFromSettings(this.settings);
    this.provider = createLLMProvider(this.app, config);
  }

  /**
   * Check if an LLM provider is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.provider) return false;
    return this.provider.isAvailable();
  }

  /**
   * Get the current provider name
   */
  getProviderName(): string {
    return this.provider?.getName() ?? 'None';
  }

  /**
   * Get a completion from the configured LLM
   */
  async complete(prompt: string): Promise<LLMResult> {
    if (!this.provider) {
      return {
        success: false,
        content: '',
        error: 'No LLM provider configured',
        provider: 'none',
      };
    }

    const available = await this.provider.isAvailable();
    if (!available) {
      return {
        success: false,
        content: '',
        error: `${this.provider.getName()} is not available`,
        provider: this.provider.getType(),
      };
    }

    try {
      const content = await this.provider.complete(prompt);
      return {
        success: true,
        content,
        provider: this.provider.getType(),
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : String(error),
        provider: this.provider.getType(),
      };
    }
  }

  /**
   * Generate a critique prompt for atomisation
   */
  buildCritiquePrompt(
    concept: string,
    explanation: string,
    evidence: string,
    sourceContent: string
  ): string {
    return `You are a rigorous knowledge management assistant helping to atomise notes into discrete concepts.

Evaluate the following atomic note candidate. Be direct and objective -- no praise, encouragement, or emotional padding. Focus only on issues that need addressing.

## Source Note Context
${sourceContent.slice(0, 2000)}

## Candidate Atom
**Concept:** ${concept}
**Explanation:** ${explanation}
**Evidence:** ${evidence}

## Evaluation Criteria
1. **Atomicity**: Does this express exactly one idea? Flag if multiple concepts are bundled
2. **Clarity**: Is the explanation clear and self-contained without the source?
3. **Substance**: Does it go beyond restating the concept?
4. **Evidence**: Is the supporting evidence sufficient and relevant?
5. **Accuracy**: Does the explanation faithfully represent the source material?

Provide a concise critique (2-4 sentences) identifying any issues. If the candidate is acceptable, state "No significant issues identified." Do not use bullet points or numbered lists.`;
  }
}
