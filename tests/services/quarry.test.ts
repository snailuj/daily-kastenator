import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QuarryService } from '../../src/services/quarry';
import { App, TFile, Vault, MetadataCache } from '../mocks/obsidian';
import { KastenatorSettings } from '../../src/types';

const createDefaultSettings = (): KastenatorSettings => ({
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
  useLLMCritique: false,
});

describe('QuarryService', () => {
  let app: App;
  let settings: KastenatorSettings;
  let service: QuarryService;

  beforeEach(() => {
    app = new App();
    settings = createDefaultSettings();
    service = new QuarryService(app as any, settings);
  });

  describe('getAllQuarryNotes', () => {
    it('returns empty array when no files exist', async () => {
      const notes = await service.getAllQuarryNotes();
      expect(notes).toEqual([]);
    });

    it('returns empty array when files exist but none have quarry status', async () => {
      app.vault._setFile('Fleeting notes/note1.md', '# Note 1\n\nSome content');
      app.vault._setFile('Fleeting notes/note2.md', '# Note 2\n\nMore content');
      app.metadataCache._setCache('Fleeting notes/note1.md', {});
      app.metadataCache._setCache('Fleeting notes/note2.md', {});

      const notes = await service.getAllQuarryNotes();
      expect(notes).toEqual([]);
    });

    it('finds notes with quarry status in frontmatter', async () => {
      const content = '---\nMigration: quarry\n---\n# Note 1\n\nContent';
      app.vault._setFile('Fleeting notes/note1.md', content);
      app.metadataCache._setCache('Fleeting notes/note1.md', {
        frontmatter: { Migration: 'quarry' },
      });

      const notes = await service.getAllQuarryNotes();

      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('note1');
      expect(notes[0].content).toBe(content);
    });

    it('ignores notes outside quarry folders', async () => {
      app.vault._setFile('Other folder/note1.md', '# Note');
      app.metadataCache._setCache('Other folder/note1.md', {
        frontmatter: { Migration: 'quarry' },
      });

      const notes = await service.getAllQuarryNotes();
      expect(notes).toEqual([]);
    });

    it('finds notes in multiple quarry folders', async () => {
      app.vault._setFile('Fleeting notes/fleeting1.md', '# Fleeting');
      app.vault._setFile('Source notes/source1.md', '# Source');
      app.metadataCache._setCache('Fleeting notes/fleeting1.md', {
        frontmatter: { Migration: 'quarry' },
      });
      app.metadataCache._setCache('Source notes/source1.md', {
        frontmatter: { Migration: 'quarry' },
      });

      const notes = await service.getAllQuarryNotes();

      expect(notes).toHaveLength(2);
      const titles = notes.map((n) => n.title).sort();
      expect(titles).toEqual(['fleeting1', 'source1']);
    });

    it('excludes notes with different migration status', async () => {
      app.vault._setFile('Fleeting notes/quarry.md', '# Quarry note');
      app.vault._setFile('Fleeting notes/atomised.md', '# Atomised note');
      app.metadataCache._setCache('Fleeting notes/quarry.md', {
        frontmatter: { Migration: 'quarry' },
      });
      app.metadataCache._setCache('Fleeting notes/atomised.md', {
        frontmatter: { Migration: 'atomised' },
      });

      const notes = await service.getAllQuarryNotes();

      expect(notes).toHaveLength(1);
      expect(notes[0].title).toBe('quarry');
    });

    it('uses custom migration field name from settings', async () => {
      settings.migrationField = 'Status';
      settings.quarryValue = 'pending';
      service.updateSettings(settings);

      app.vault._setFile('Fleeting notes/note1.md', '# Note');
      app.metadataCache._setCache('Fleeting notes/note1.md', {
        frontmatter: { Status: 'pending' },
      });

      const notes = await service.getAllQuarryNotes();

      expect(notes).toHaveLength(1);
    });

    it('handles files with no metadata cache gracefully', async () => {
      app.vault._setFile('Fleeting notes/note1.md', '# Note');
      // No cache set

      const notes = await service.getAllQuarryNotes();
      expect(notes).toEqual([]);
    });
  });

  describe('getRandomQuarryNote', () => {
    it('returns null when no quarry notes exist', async () => {
      const note = await service.getRandomQuarryNote();
      expect(note).toBeNull();
    });

    it('returns a note when quarry notes exist', async () => {
      app.vault._setFile('Fleeting notes/note1.md', '# Note 1');
      app.metadataCache._setCache('Fleeting notes/note1.md', {
        frontmatter: { Migration: 'quarry' },
      });

      const note = await service.getRandomQuarryNote();

      expect(note).not.toBeNull();
      expect(note?.title).toBe('note1');
    });

    it('returns different notes over multiple calls (randomness)', async () => {
      // Set up multiple notes
      for (let i = 1; i <= 10; i++) {
        app.vault._setFile(`Fleeting notes/note${i}.md`, `# Note ${i}`);
        app.metadataCache._setCache(`Fleeting notes/note${i}.md`, {
          frontmatter: { Migration: 'quarry' },
        });
      }

      // Call multiple times and collect unique results
      const results = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const note = await service.getRandomQuarryNote();
        if (note) results.add(note.title);
      }

      // With 10 notes and 50 attempts, we should see variety
      // (statistically unlikely to get the same note every time)
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('isQuarryNote', () => {
    it('returns true for files in quarry', async () => {
      app.vault._setFile('Fleeting notes/note1.md', '# Note');
      app.metadataCache._setCache('Fleeting notes/note1.md', {
        frontmatter: { Migration: 'quarry' },
      });

      const file = new TFile('Fleeting notes/note1.md');
      const result = await service.isQuarryNote(file as any);

      expect(result).toBe(true);
    });

    it('returns false for files not in quarry', async () => {
      app.vault._setFile('Fleeting notes/note1.md', '# Note');
      app.metadataCache._setCache('Fleeting notes/note1.md', {
        frontmatter: { Migration: 'atomised' },
      });

      const file = new TFile('Fleeting notes/note1.md');
      const result = await service.isQuarryNote(file as any);

      expect(result).toBe(false);
    });
  });

  describe('markAsAtomised', () => {
    it('updates inline Migration field from quarry to atomised', async () => {
      const originalContent = '# Note\n\nMigration:: quarry\n\nContent here';
      app.vault._setFile('Fleeting notes/note1.md', originalContent);

      const file = new TFile('Fleeting notes/note1.md');
      await service.markAsAtomised(file as any);

      const modifiedContent = await app.vault.read(file as any);
      expect(modifiedContent).toBe('# Note\n\nMigration:: atomised\n\nContent here');
    });

    it('handles multiple occurrences of the field', async () => {
      const originalContent = 'Migration:: quarry\n\nText\n\nMigration:: quarry';
      app.vault._setFile('Fleeting notes/note1.md', originalContent);

      const file = new TFile('Fleeting notes/note1.md');
      await service.markAsAtomised(file as any);

      const modifiedContent = await app.vault.read(file as any);
      expect(modifiedContent).toBe('Migration:: atomised\n\nText\n\nMigration:: atomised');
    });

    it('does not modify content without the quarry field', async () => {
      const originalContent = '# Note\n\nNo migration field here';
      app.vault._setFile('Fleeting notes/note1.md', originalContent);

      const file = new TFile('Fleeting notes/note1.md');
      await service.markAsAtomised(file as any);

      const modifiedContent = await app.vault.read(file as any);
      expect(modifiedContent).toBe(originalContent);
    });

    it('uses custom field name from settings', async () => {
      settings.migrationField = 'Status';
      settings.quarryValue = 'pending';
      service.updateSettings(settings);

      const originalContent = '# Note\n\nStatus:: pending';
      app.vault._setFile('Fleeting notes/note1.md', originalContent);

      const file = new TFile('Fleeting notes/note1.md');
      await service.markAsAtomised(file as any);

      const modifiedContent = await app.vault.read(file as any);
      expect(modifiedContent).toBe('# Note\n\nStatus:: atomised');
    });
  });

  describe('updateSettings', () => {
    it('updates internal settings reference', async () => {
      const newSettings = {
        ...settings,
        quarryFolders: ['Custom folder'],
      };

      service.updateSettings(newSettings);

      // Verify by checking that queries use new folder
      app.vault._setFile('Custom folder/note1.md', '# Note');
      app.metadataCache._setCache('Custom folder/note1.md', {
        frontmatter: { Migration: 'quarry' },
      });

      const notes = await service.getAllQuarryNotes();
      expect(notes).toHaveLength(1);
    });
  });
});
