import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import DailyKastenatorPlugin from './main';
import { LLMProviderType } from './types';
import { CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL } from './services/llm/claude';
import { OPENROUTER_MODELS, DEFAULT_OPENROUTER_MODEL } from './services/llm/openrouter';

/**
 * Settings tab for Daily Kastenator plugin
 */
export class KastenatorSettingTab extends PluginSettingTab {
  plugin: DailyKastenatorPlugin;

  constructor(app: App, plugin: DailyKastenatorPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Daily Kastenator Settings' });

    // Notification Settings Section
    containerEl.createEl('h3', { text: 'Notification Schedule' });

    new Setting(containerEl)
      .setName('Enable daily notification')
      .setDesc('Receive a daily reminder to atomise a quarry note')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.notificationEnabled)
          .onChange(async (value) => {
            this.plugin.settings.notificationEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Notification time')
      .setDesc('Time of day to receive the daily notification')
      .addDropdown((dropdown) => {
        // Hours
        for (let h = 0; h < 24; h++) {
          const label = h.toString().padStart(2, '0') + ':00';
          dropdown.addOption(h.toString(), label);
        }
        dropdown.setValue(this.plugin.settings.notificationHour.toString());
        dropdown.onChange(async (value) => {
          this.plugin.settings.notificationHour = parseInt(value, 10);
          await this.plugin.saveSettings();
        });
      })
      .addDropdown((dropdown) => {
        // Minutes (15-min intervals)
        for (let m = 0; m < 60; m += 15) {
          const label = ':' + m.toString().padStart(2, '0');
          dropdown.addOption(m.toString(), label);
        }
        dropdown.setValue(this.plugin.settings.notificationMinute.toString());
        dropdown.onChange(async (value) => {
          this.plugin.settings.notificationMinute = parseInt(value, 10);
          await this.plugin.saveSettings();
        });
      });

    // Quarry Settings Section
    containerEl.createEl('h3', { text: 'Quarry Configuration' });

    new Setting(containerEl)
      .setName('Quarry folders')
      .setDesc('Folders to search for quarry notes (comma-separated)')
      .addText((text) =>
        text
          .setPlaceholder('Fleeting notes, Source notes')
          .setValue(this.plugin.settings.quarryFolders.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.quarryFolders = value
              .split(',')
              .map((f) => f.trim())
              .filter((f) => f.length > 0);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Migration field')
      .setDesc('Dataview inline field name for migration status')
      .addText((text) =>
        text
          .setPlaceholder('Migration')
          .setValue(this.plugin.settings.migrationField)
          .onChange(async (value) => {
            this.plugin.settings.migrationField = value.trim() || 'Migration';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Quarry value')
      .setDesc('Field value indicating a note is in the quarry')
      .addText((text) =>
        text
          .setPlaceholder('quarry')
          .setValue(this.plugin.settings.quarryValue)
          .onChange(async (value) => {
            this.plugin.settings.quarryValue = value.trim() || 'quarry';
            await this.plugin.saveSettings();
          })
      );

    // Atom Output Settings Section
    containerEl.createEl('h3', { text: 'Atom Output' });

    new Setting(containerEl)
      .setName('Atom folder')
      .setDesc('Folder where new atom notes will be created')
      .addText((text) =>
        text
          .setPlaceholder('Atoms')
          .setValue(this.plugin.settings.atomFolder)
          .onChange(async (value) => {
            this.plugin.settings.atomFolder = value.trim() || 'Atoms';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Atom template')
      .setDesc('Template file to use for new atoms (optional)')
      .addText((text) =>
        text
          .setPlaceholder('Templates/Atom.md')
          .setValue(this.plugin.settings.atomTemplatePath)
          .onChange(async (value) => {
            this.plugin.settings.atomTemplatePath = value.trim();
            await this.plugin.saveSettings();
          })
      );

    // Template variables info
    const templateInfo = containerEl.createDiv({ cls: 'kastenator-template-info' });
    templateInfo.createEl('p', {
      text: 'Available template variables:',
      cls: 'setting-item-description',
    });
    const varList = templateInfo.createEl('ul');
    const variables = [
      '{{title}} - Atom title',
      '{{concept}} - Original concept text',
      '{{explanation}} - Your explanation',
      '{{evidence}} - Supporting evidence',
      '{{tags}} - Comma-separated tags',
      '{{date}} - Creation date (YYYY-MM-DD)',
      '{{content}} - Default atom content',
    ];
    for (const v of variables) {
      varList.createEl('li', { text: v });
    }

    // LLM Settings Section
    containerEl.createEl('h3', { text: 'AI Critique (Optional)' });

    containerEl.createEl('p', {
      text: 'Configure an LLM provider for AI-powered critique during atomisation. Falls back to rule-based critique if not configured.',
      cls: 'setting-item-description',
    });

    new Setting(containerEl)
      .setName('Use AI critique')
      .setDesc('When enabled and a provider is configured, uses LLM for critique instead of rule-based heuristics')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.useLLMCritique ?? true)
          .onChange(async (value) => {
            this.plugin.settings.useLLMCritique = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('LLM Provider')
      .setDesc('Choose how to access AI for critique')
      .addDropdown((dropdown) => {
        dropdown.addOption('none', 'None (rule-based only)');
        dropdown.addOption('smart-connections', 'Smart Connections');
        dropdown.addOption('claude', 'Claude (direct API)');
        dropdown.addOption('openrouter', 'OpenRouter');
        dropdown.setValue(this.plugin.settings.llmProvider ?? 'none');
        dropdown.onChange(async (value) => {
          this.plugin.settings.llmProvider = value as LLMProviderType;
          await this.plugin.saveSettings();
          // Re-render to show/hide provider-specific settings
          this.display();
        });
      });

    // Smart Connections info
    if (this.plugin.settings.llmProvider === 'smart-connections') {
      const scInfo = containerEl.createDiv({ cls: 'kastenator-provider-info' });
      scInfo.createEl('p', {
        text: 'Uses your existing Smart Connections configuration. Supports local LLMs (Ollama, LM Studio) and cloud providers.',
        cls: 'setting-item-description',
      });
    }

    // Claude settings
    if (this.plugin.settings.llmProvider === 'claude') {
      new Setting(containerEl)
        .setName('Claude API Key')
        .setDesc('Your Anthropic API key')
        .addText((text) =>
          text
            .setPlaceholder('sk-ant-...')
            .setValue(this.plugin.settings.claudeApiKey ?? '')
            .onChange(async (value) => {
              this.plugin.settings.claudeApiKey = value.trim();
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName('Claude Model')
        .setDesc('Model to use for critique')
        .addDropdown((dropdown) => {
          for (const model of CLAUDE_MODELS) {
            dropdown.addOption(model.id, model.name);
          }
          dropdown.setValue(
            this.plugin.settings.claudeModel ?? DEFAULT_CLAUDE_MODEL
          );
          dropdown.onChange(async (value) => {
            this.plugin.settings.claudeModel = value;
            await this.plugin.saveSettings();
          });
        });
    }

    // OpenRouter settings
    if (this.plugin.settings.llmProvider === 'openrouter') {
      new Setting(containerEl)
        .setName('OpenRouter API Key')
        .setDesc('Your OpenRouter API key')
        .addText((text) =>
          text
            .setPlaceholder('sk-or-...')
            .setValue(this.plugin.settings.openrouterApiKey ?? '')
            .onChange(async (value) => {
              this.plugin.settings.openrouterApiKey = value.trim();
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName('OpenRouter Model')
        .setDesc('Model to use for critique')
        .addDropdown((dropdown) => {
          for (const model of OPENROUTER_MODELS) {
            dropdown.addOption(model.id, model.name);
          }
          dropdown.setValue(
            this.plugin.settings.openrouterModel ?? DEFAULT_OPENROUTER_MODEL
          );
          dropdown.onChange(async (value) => {
            this.plugin.settings.openrouterModel = value;
            await this.plugin.saveSettings();
          });
        });

      const orInfo = containerEl.createDiv({ cls: 'kastenator-provider-info' });
      orInfo.createEl('p', {
        text: 'OpenRouter provides access to 100+ models with a single API key.',
        cls: 'setting-item-description',
      });
    }

    // Actions Section
    containerEl.createEl('h3', { text: 'Actions' });

    new Setting(containerEl)
      .setName('Test quarry query')
      .setDesc('Check how many notes match your quarry configuration')
      .addButton((button) =>
        button.setButtonText('Test Query').onClick(async () => {
          await this.testQuarryQuery();
        })
      );

    new Setting(containerEl)
      .setName('Trigger notification now')
      .setDesc('Manually trigger the daily atomisation notification')
      .addButton((button) =>
        button
          .setButtonText('Trigger Now')
          .setCta()
          .onClick(() => {
            this.plugin.triggerDailyNotification();
          })
      );
  }

  /**
   * Test the quarry query and show results
   */
  private async testQuarryQuery(): Promise<void> {
    const { quarryFolders, migrationField, quarryValue } = this.plugin.settings;

    new Notice('Testing quarry query...');

    try {
      // Use the command to get stats
      await this.plugin.showQuarryStats();
    } catch (error) {
      new Notice(`Query failed: ${error}`);
    }
  }
}
