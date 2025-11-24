import { App } from 'obsidian';
import { LLMProvider, LLMProviderType } from './index';

/**
 * Smart Connections plugin interface (partial)
 * Based on SC v3.x API
 */
interface SmartConnectionsPlugin {
  brain?: unknown;
  api?: {
    search: (query: string) => Promise<Array<{ link: string }>>;
  };
  settings?: {
    chat_model_platform?: string;
    model_name?: string;
  };
}

/**
 * Global smart_env interface for completions
 */
interface SmartEnv {
  complete?: (prompt: string) => Promise<string>;
}

declare global {
  interface Window {
    smart_env?: SmartEnv;
  }
}

/**
 * LLM provider that integrates with the Smart Connections plugin
 *
 * Uses the user's existing Smart Connections configuration,
 * which may be local (Ollama, LM Studio) or cloud (OpenAI, Claude, etc.)
 */
export class SmartConnectionsProvider implements LLMProvider {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  getName(): string {
    return 'Smart Connections';
  }

  getType(): LLMProviderType {
    return 'smart-connections';
  }

  /**
   * Check if Smart Connections is installed, enabled, and has a chat model configured
   */
  async isAvailable(): Promise<boolean> {
    const sc = this.getPlugin();
    if (!sc) return false;

    // Check if brain is loaded (indicates SC is fully initialised)
    if (!sc.brain) return false;

    // Check if smart_env is available for completions
    if (typeof window !== 'undefined' && window.smart_env?.complete) {
      return true;
    }

    // Fallback: check if chat model is configured in settings
    return !!sc.settings?.chat_model_platform;
  }

  /**
   * Get completion using Smart Connections' configured LLM
   */
  async complete(prompt: string): Promise<string> {
    // Primary method: use global smart_env
    if (typeof window !== 'undefined' && window.smart_env?.complete) {
      const result = await window.smart_env.complete(prompt);
      return result;
    }

    // Fallback: try to access via plugin directly
    const sc = this.getPlugin();
    if (!sc) {
      throw new Error('Smart Connections plugin not available');
    }

    // SC v3.x may expose complete on the plugin itself
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scAny = sc as any;
    if (typeof scAny.complete === 'function') {
      return await scAny.complete(prompt);
    }

    throw new Error(
      'Smart Connections completion API not available. ' +
      'Ensure Smart Chat is configured in Smart Connections settings.'
    );
  }

  /**
   * Get the Smart Connections plugin instance
   */
  private getPlugin(): SmartConnectionsPlugin | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugins = (this.app as any).plugins?.plugins;
    if (!plugins) return null;

    return plugins['smart-connections'] ?? null;
  }

  /**
   * Get information about the configured model (for display)
   */
  getModelInfo(): string {
    const sc = this.getPlugin();
    if (!sc?.settings) return 'Unknown';

    const platform = sc.settings.chat_model_platform ?? 'Unknown';
    const model = sc.settings.model_name ?? '';

    return model ? `${platform} (${model})` : platform;
  }
}
