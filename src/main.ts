import { Plugin, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import { KastenatorSettings } from './types';
import { KastenatorSettingTab } from './settings';
import { NotificationScheduler } from './services/scheduler';
import { QuarryService } from './services/quarry';
import { AtomisationModal } from './ui/atomisation-modal';
import { ATOMISATION_VIEW_TYPE, AtomisationView } from './ui/atomisation-view';

const DEFAULT_SETTINGS: KastenatorSettings = {
  notificationHour: 9,
  notificationMinute: 0,
  quarryFolders: ['Fleeting notes', 'Source notes'],
  migrationField: 'Migration',
  quarryValue: 'quarry',
  atomFolder: 'Atoms',
  atomTemplatePath: '',
  lastNotificationDate: '',
  notificationEnabled: true,
  llmProvider: 'none',
  useLLMCritique: true,
};

export default class DailyKastenatorPlugin extends Plugin {
  settings: KastenatorSettings;
  private scheduler: NotificationScheduler;
  private quarryService: QuarryService;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Initialise services
    this.quarryService = new QuarryService(this.app, this.settings);
    this.scheduler = new NotificationScheduler(
      this,
      this.settings,
      () => this.triggerDailyNotification()
    );

    // Register the atomisation view
    this.registerView(
      ATOMISATION_VIEW_TYPE,
      (leaf) => new AtomisationView(leaf, this)
    );

    // Add ribbon icon for manual trigger
    this.addRibbonIcon('pickaxe', 'Daily Kastenator', () => {
      this.triggerDailyNotification();
    });

    // Register commands
    this.addCommand({
      id: 'trigger-daily-kastenator',
      name: 'Start atomisation session',
      callback: () => this.triggerDailyNotification(),
    });

    this.addCommand({
      id: 'open-random-quarry-note',
      name: 'Open random quarry note',
      callback: () => this.openRandomQuarryNote(),
    });

    this.addCommand({
      id: 'show-quarry-stats',
      name: 'Show quarry statistics',
      callback: () => this.showQuarryStats(),
    });

    // Add settings tab
    this.addSettingTab(new KastenatorSettingTab(this.app, this));

    // Start the scheduler
    this.scheduler.start();

    // Check if we missed today's notification
    this.checkMissedNotification();
  }

  onunload(): void {
    this.scheduler?.stop();
    this.app.workspace.detachLeavesOfType(ATOMISATION_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Update services with new settings
    this.quarryService?.updateSettings(this.settings);
    this.scheduler?.updateSettings(this.settings);
  }

  /**
   * Main entry point: trigger the daily notification and atomisation flow
   */
  async triggerDailyNotification(): Promise<void> {
    const quarryNote = await this.quarryService.getRandomQuarryNote();

    if (!quarryNote) {
      new Notice('No quarry notes found. Your quarry is empty!');
      return;
    }

    // Show notification with note title
    const notice = new Notice(
      `Time to atomise: "${quarryNote.title}"`,
      0  // Persistent until dismissed
    );

    // Open the atomisation view
    await this.activateAtomisationView(quarryNote.file);

    // Update last notification date
    this.settings.lastNotificationDate = new Date().toISOString().split('T')[0];
    await this.saveSettings();
  }

  /**
   * Open the atomisation view for a specific file
   */
  async activateAtomisationView(file: TFile): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(ATOMISATION_VIEW_TYPE);

    if (leaves.length > 0) {
      // Reuse existing leaf
      leaf = leaves[0];
    } else {
      // Create new leaf in right sidebar
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: ATOMISATION_VIEW_TYPE,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
      const view = leaf.view as AtomisationView;
      await view.startSession(file);
    }
  }

  /**
   * Open a random quarry note in the editor (without atomisation flow)
   */
  async openRandomQuarryNote(): Promise<void> {
    const quarryNote = await this.quarryService.getRandomQuarryNote();

    if (!quarryNote) {
      new Notice('No quarry notes found');
      return;
    }

    await this.app.workspace.getLeaf().openFile(quarryNote.file);
    new Notice(`Opened: ${quarryNote.title}`);
  }

  /**
   * Display statistics about the quarry
   */
  async showQuarryStats(): Promise<void> {
    const notes = await this.quarryService.getAllQuarryNotes();

    const stats = [
      `Quarry Statistics`,
      `─────────────────`,
      `Total notes: ${notes.length}`,
      `Folders: ${this.settings.quarryFolders.join(', ')}`,
      `Field: ${this.settings.migrationField}:: ${this.settings.quarryValue}`,
    ];

    new Notice(stats.join('\n'), 10000);
  }

  /**
   * Check if we missed today's notification (e.g., app wasn't open)
   */
  private checkMissedNotification(): void {
    if (!this.settings.notificationEnabled) return;

    const today = new Date().toISOString().split('T')[0];
    const lastNotification = this.settings.lastNotificationDate;

    if (lastNotification === today) return;

    const now = new Date();
    const scheduledHour = this.settings.notificationHour;
    const scheduledMinute = this.settings.notificationMinute;

    // If we're past the scheduled time, offer to catch up
    if (now.getHours() > scheduledHour ||
        (now.getHours() === scheduledHour && now.getMinutes() >= scheduledMinute)) {
      new Notice(
        'Daily Kastenator: You have a pending atomisation session. ' +
        'Click the pickaxe icon to start.',
        10000
      );
    }
  }
}
