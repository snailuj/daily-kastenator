import { App, TFile, CachedMetadata } from 'obsidian';
import { KastenatorSettings, QuarryNote, DataviewApi } from '../types';

/**
 * Service for finding and managing quarry notes
 *
 * Quarry notes are notes marked with Migration:: quarry that are
 * candidates for atomisation into atomic notes.
 *
 * Note: This implementation supports both Dataview-based queries
 * and fallback to native Obsidian metadata cache for vaults
 * without Dataview installed.
 */
export class QuarryService {
  private app: App;
  private settings: KastenatorSettings;

  constructor(app: App, settings: KastenatorSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: KastenatorSettings): void {
    this.settings = settings;
  }

  /**
   * Get the Dataview API if available
   */
  private getDataviewApi(): DataviewApi | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dv = (this.app as any).plugins?.plugins?.dataview?.api;
    return dv ?? null;
  }

  /**
   * Get all notes matching quarry criteria
   */
  async getAllQuarryNotes(): Promise<QuarryNote[]> {
    const dv = this.getDataviewApi();

    if (dv) {
      return this.getQuarryNotesDataview(dv);
    }
    return this.getQuarryNotesFallback();
  }

  /**
   * Get quarry notes using Dataview API
   */
  private async getQuarryNotesDataview(dv: DataviewApi): Promise<QuarryNote[]> {
    const quarryNotes: QuarryNote[] = [];
    const { migrationField, quarryValue, quarryFolders } = this.settings;

    for (const folder of quarryFolders) {
      try {
        const pages = dv.pages(`"${folder}"`);
        const filtered = pages.where((page) => {
          const fieldValue = page[migrationField];
          return fieldValue === quarryValue;
        });

        for (const page of filtered) {
          const file = this.app.vault.getAbstractFileByPath(page.file.path);
          if (file instanceof TFile) {
            const quarryNote = await this.buildQuarryNote(file);
            if (quarryNote) {
              quarryNotes.push(quarryNote);
            }
          }
        }
      } catch {
        // Folder might not exist, continue
        console.debug(`Quarry folder not found: ${folder}`);
      }
    }

    return quarryNotes;
  }

  /**
   * Fallback method using Obsidian's metadata cache
   */
  private async getQuarryNotesFallback(): Promise<QuarryNote[]> {
    const quarryNotes: QuarryNote[] = [];
    const { migrationField, quarryValue, quarryFolders } = this.settings;
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      // Check if file is in a quarry folder
      const inQuarryFolder = quarryFolders.some((folder) =>
        file.path.startsWith(folder + '/')
      );

      if (!inQuarryFolder) continue;

      // Check metadata cache for the migration field
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache) continue;

      const hasQuarryStatus = this.checkQuarryStatus(cache, migrationField, quarryValue);

      if (hasQuarryStatus) {
        const quarryNote = await this.buildQuarryNote(file);
        if (quarryNote) {
          quarryNotes.push(quarryNote);
        }
      }
    }

    return quarryNotes;
  }

  /**
   * Check if a file has the quarry status in its metadata
   */
  private checkQuarryStatus(
    cache: CachedMetadata,
    field: string,
    value: string
  ): boolean {
    // Check frontmatter
    if (cache.frontmatter?.[field] === value) {
      return true;
    }

    // Check inline fields (Dataview syntax: Field:: value)
    // These appear in the sections/content, need to parse manually
    // For now, we check frontmatter only in fallback mode
    // Full inline field support requires reading file content

    return false;
  }

  /**
   * Build a QuarryNote object from a TFile
   */
  private async buildQuarryNote(file: TFile): Promise<QuarryNote | null> {
    try {
      const content = await this.app.vault.cachedRead(file);
      const cache = this.app.metadataCache.getFileCache(file);

      return {
        file,
        title: file.basename,
        content,
        frontmatter: cache?.frontmatter ?? {},
        migrationStatus: this.settings.quarryValue,
      };
    } catch {
      console.error(`Failed to read quarry note: ${file.path}`);
      return null;
    }
  }

  /**
   * Get a random note from the quarry
   *
   * V1: Pure random selection
   * Future: Will use file mod times, git logs, etc. for semantic selection
   */
  async getRandomQuarryNote(): Promise<QuarryNote | null> {
    const notes = await this.getAllQuarryNotes();

    if (notes.length === 0) {
      return null;
    }

    // V1: Simple random selection
    const randomIndex = Math.floor(Math.random() * notes.length);
    return notes[randomIndex];
  }

  /**
   * Check if a specific file is a quarry note
   */
  async isQuarryNote(file: TFile): Promise<boolean> {
    const notes = await this.getAllQuarryNotes();
    return notes.some((note) => note.file.path === file.path);
  }

  /**
   * Update a note's migration status after atomisation
   */
  async markAsAtomised(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);

    // Replace Migration:: quarry with Migration:: atomised
    const { migrationField, quarryValue } = this.settings;
    const pattern = new RegExp(`${migrationField}::\\s*${quarryValue}`, 'g');
    const newContent = content.replace(pattern, `${migrationField}:: atomised`);

    if (newContent !== content) {
      await this.app.vault.modify(file, newContent);
    }
  }
}
