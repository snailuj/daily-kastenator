import { describe, it, expect, beforeEach } from 'vitest';
import { AtomisationService } from '../../src/services/atomisation';
import { App, TFile } from '../mocks/obsidian';
import { KastenatorSettings, QuarryNote, AtomCandidate } from '../../src/types';

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
});

const createQuarryNote = (overrides: Partial<QuarryNote> = {}): QuarryNote => ({
  file: new TFile('Fleeting notes/test-note.md') as any,
  title: 'Test Note',
  content: '# Test Note\n\nSome content to atomise',
  frontmatter: {},
  migrationStatus: 'quarry',
  ...overrides,
});

describe('AtomisationService', () => {
  let app: App;
  let settings: KastenatorSettings;
  let service: AtomisationService;

  beforeEach(() => {
    app = new App();
    settings = createDefaultSettings();
    service = new AtomisationService(app as any, settings);
  });

  describe('session management', () => {
    it('starts a new session with a quarry note', () => {
      const note = createQuarryNote();
      const session = service.startSession(note);

      expect(session.sourceNote).toBe(note);
      expect(session.candidates).toEqual([]);
      expect(session.phase).toBe('introduction');
      expect(session.completed).toBe(false);
    });

    it('returns current session via getSession', () => {
      const note = createQuarryNote();
      service.startSession(note);

      const session = service.getSession();

      expect(session).not.toBeNull();
      expect(session?.sourceNote.title).toBe('Test Note');
    });

    it('returns null when no session is active', () => {
      expect(service.getSession()).toBeNull();
    });

    it('ends session and clears state', () => {
      const note = createQuarryNote();
      service.startSession(note);

      service.endSession();

      expect(service.getSession()).toBeNull();
    });
  });

  describe('phase management', () => {
    beforeEach(() => {
      const note = createQuarryNote();
      service.startSession(note);
    });

    it('advances through phases in order', () => {
      expect(service.getSession()?.phase).toBe('introduction');

      expect(service.advancePhase()).toBe('identification');
      expect(service.advancePhase()).toBe('explanation');
      expect(service.advancePhase()).toBe('critique');
      expect(service.advancePhase()).toBe('refinement');
      expect(service.advancePhase()).toBe('confirmation');
      expect(service.advancePhase()).toBe('creation');
      expect(service.advancePhase()).toBe('complete');
    });

    it('stays at complete phase when already complete', () => {
      // Advance to complete
      for (let i = 0; i < 8; i++) {
        service.advancePhase();
      }

      expect(service.advancePhase()).toBe('complete');
    });

    it('allows setting a specific phase', () => {
      service.setPhase('confirmation');

      expect(service.getSession()?.phase).toBe('confirmation');
    });

    it('throws when advancing without session', () => {
      service.endSession();

      expect(() => service.advancePhase()).toThrow('No active session');
    });

    it('throws when setting phase without session', () => {
      service.endSession();

      expect(() => service.setPhase('explanation')).toThrow('No active session');
    });
  });

  describe('candidate management', () => {
    beforeEach(() => {
      const note = createQuarryNote();
      service.startSession(note);
    });

    it('adds a new candidate with generated ID', () => {
      const candidate = service.addCandidate('Concept about testing');

      expect(candidate.id).toMatch(/^atom-\d+-[a-z0-9]+$/);
      expect(candidate.concept).toBe('Concept about testing');
      expect(candidate.explanation).toBe('');
      expect(candidate.approved).toBe(false);
    });

    it('suggests a title based on concept', () => {
      const candidate = service.addCandidate('testing is important');

      expect(candidate.suggestedTitle).toBe('Testing is important');
    });

    it('truncates long titles', () => {
      const longConcept = 'A'.repeat(100);
      const candidate = service.addCandidate(longConcept);

      expect(candidate.suggestedTitle.length).toBeLessThanOrEqual(80);
      expect(candidate.suggestedTitle).toContain('...');
    });

    it('adds candidate to session', () => {
      service.addCandidate('First concept');
      service.addCandidate('Second concept');

      const session = service.getSession();
      expect(session?.candidates).toHaveLength(2);
    });

    it('updates candidate properties', () => {
      const candidate = service.addCandidate('Test concept');

      const updated = service.updateCandidate(candidate.id, {
        explanation: 'This is my explanation',
        evidence: 'Source says X',
        approved: true,
      });

      expect(updated?.explanation).toBe('This is my explanation');
      expect(updated?.evidence).toBe('Source says X');
      expect(updated?.approved).toBe(true);
    });

    it('returns null when updating non-existent candidate', () => {
      const result = service.updateCandidate('fake-id', { explanation: 'test' });

      expect(result).toBeNull();
    });

    it('removes candidate by ID', () => {
      const candidate = service.addCandidate('To be removed');

      const removed = service.removeCandidate(candidate.id);

      expect(removed).toBe(true);
      expect(service.getSession()?.candidates).toHaveLength(0);
    });

    it('returns false when removing non-existent candidate', () => {
      const result = service.removeCandidate('fake-id');

      expect(result).toBe(false);
    });

    it('throws when adding candidate without session', () => {
      service.endSession();

      expect(() => service.addCandidate('test')).toThrow('No active session');
    });
  });

  describe('validateExplanation', () => {
    const createCandidate = (overrides: Partial<AtomCandidate> = {}): AtomCandidate => ({
      id: 'test-id',
      concept: 'Testing is important',
      explanation: 'A thorough explanation of why testing matters in software development',
      evidence: 'Studies show...',
      suggestedTitle: 'Testing is important',
      tags: [],
      relatedAtoms: [],
      critique: '',
      approved: false,
      ...overrides,
    });

    it('rejects explanations that are too short', () => {
      const candidate = createCandidate({ explanation: 'Too short' });

      const result = service.validateExplanation(candidate);

      expect(result.valid).toBe(false);
      expect(result.feedback).toContain('Too brief');
    });

    it('rejects explanations with vague language', () => {
      const candidate = createCandidate({
        explanation: 'Testing is kind of important because it sort of helps',
      });

      const result = service.validateExplanation(candidate);

      expect(result.valid).toBe(false);
      expect(result.feedback).toContain('hedging language');
    });

    it('rejects explanations that repeat the concept', () => {
      const candidate = createCandidate({
        concept: 'Testing quality assurance verification',
        explanation: 'Testing quality assurance verification is what testing quality assurance verification does',
      });

      const result = service.validateExplanation(candidate);

      expect(result.valid).toBe(false);
      expect(result.feedback).toContain('repeats the concept');
    });

    it('flags potential non-atomic explanations', () => {
      const candidate = createCandidate({
        explanation:
          'Testing verifies correctness and also documentation is important for maintenance',
      });

      const result = service.validateExplanation(candidate);

      expect(result.valid).toBe(false);
      expect(result.feedback).toContain('multiple concepts');
    });

    it('accepts valid explanations', () => {
      const candidate = createCandidate({
        concept: 'Unit tests',
        explanation:
          'Automated verification of individual code units in isolation ensures each component behaves correctly before integration',
      });

      const result = service.validateExplanation(candidate);

      expect(result.valid).toBe(true);
    });

    it('provides suggestions when validation fails', () => {
      const candidate = createCandidate({ explanation: 'Short' });

      const result = service.validateExplanation(candidate);

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
    });
  });

  describe('generateCritique', () => {
    const createCandidate = (overrides: Partial<AtomCandidate> = {}): AtomCandidate => ({
      id: 'test-id',
      concept: 'Testing',
      explanation: 'A thorough explanation of testing practices',
      evidence: 'Research indicates that testing reduces defects by 40%',
      suggestedTitle: 'Testing practices',
      tags: [],
      relatedAtoms: ['Related note'],
      critique: '',
      approved: false,
      ...overrides,
    });

    it('critiques short titles', () => {
      const candidate = createCandidate({ suggestedTitle: 'Test' });

      const critique = service.generateCritique(candidate);

      expect(critique).toContain('Title is too short');
    });

    it('critiques excessively long titles', () => {
      const candidate = createCandidate({
        suggestedTitle: 'A'.repeat(100),
      });

      const critique = service.generateCritique(candidate);

      expect(critique).toContain('Title is too long');
    });

    it('critiques missing evidence', () => {
      const candidate = createCandidate({ evidence: '' });

      const critique = service.generateCritique(candidate);

      expect(critique).toContain('No supporting evidence');
    });

    it('critiques sparse evidence', () => {
      const candidate = createCandidate({ evidence: 'Source says so' });

      const critique = service.generateCritique(candidate);

      expect(critique).toContain('Evidence is sparse');
    });

    it('critiques missing related atoms', () => {
      const candidate = createCandidate({ relatedAtoms: [] });

      const critique = service.generateCritique(candidate);

      expect(critique).toContain('No related atoms');
    });

    it('returns positive message when no issues found', () => {
      const candidate = createCandidate({
        concept: 'Verification methods',
        suggestedTitle: 'Automated verification reduces defects',
        explanation:
          'Systematic automated checks at multiple levels catch bugs before production deployment',
        evidence:
          'Industry studies consistently show 40-60% reduction in production defects when using CI/CD pipelines',
        relatedAtoms: ['Continuous integration', 'Quality assurance'],
      });

      const critique = service.generateCritique(candidate);

      expect(critique).toContain('No significant issues');
    });
  });

  describe('createAtoms', () => {
    beforeEach(() => {
      const note = createQuarryNote();
      service.startSession(note);
      app.vault._setFolder('Atoms');
    });

    it('creates files for approved candidates only', async () => {
      service.addCandidate('Approved concept');
      service.addCandidate('Rejected concept');

      const candidates = service.getSession()!.candidates;
      service.updateCandidate(candidates[0].id, {
        explanation: 'This is approved',
        approved: true,
      });
      // Second candidate remains unapproved

      const files = await service.createAtoms();

      expect(files).toHaveLength(1);
      expect(files[0].basename).toBe('Approved concept');
    });

    it('creates atom folder if it does not exist', async () => {
      app.vault._clear();
      // Folder does not exist

      const candidate = service.addCandidate('Test concept');
      service.updateCandidate(candidate.id, {
        explanation: 'Explanation here',
        approved: true,
      });

      await service.createAtoms();

      // Verify folder was created (file creation would fail otherwise)
      const file = app.vault.getAbstractFileByPath('Atoms/Test concept.md');
      expect(file).not.toBeNull();
    });

    it('generates correct atom content structure', async () => {
      const candidate = service.addCandidate('Knowledge atoms');
      service.updateCandidate(candidate.id, {
        suggestedTitle: 'Knowledge atoms',
        explanation: 'Atomic notes contain single ideas',
        evidence: 'Luhmann wrote about this',
        tags: ['zettelkasten', 'notes'],
        relatedAtoms: ['Zettelkasten method'],
        approved: true,
      });

      const files = await service.createAtoms();
      const content = await app.vault.read(files[0] as any);

      expect(content).toContain('# Knowledge atoms');
      expect(content).toContain('Atomic notes contain single ideas');
      expect(content).toContain('Luhmann wrote about this');
      expect(content).toContain('[[Zettelkasten method]]');
      expect(content).toContain('type: atom');
      expect(content).toContain('tags: [zettelkasten, notes]');
    });

    it('links back to source note', async () => {
      const candidate = service.addCandidate('Test');
      service.updateCandidate(candidate.id, {
        explanation: 'Test explanation here',
        approved: true,
      });

      const files = await service.createAtoms();
      const content = await app.vault.read(files[0] as any);

      expect(content).toContain('source: "[[Test Note]]"');
    });

    it('handles filename collisions with timestamp', async () => {
      // Pre-create a file with the same name
      app.vault._setFile('Atoms/Duplicate name.md', 'existing content');

      const candidate = service.addCandidate('Duplicate name');
      service.updateCandidate(candidate.id, {
        explanation: 'This should get a unique name',
        approved: true,
      });

      const files = await service.createAtoms();

      expect(files[0].path).toMatch(/Atoms\/Duplicate name-\d+\.md/);
    });

    it('sanitises filenames', async () => {
      const candidate = service.addCandidate('Test: with <special> chars?');
      service.updateCandidate(candidate.id, {
        explanation: 'Testing filename sanitisation',
        approved: true,
      });

      const files = await service.createAtoms();

      expect(files[0].path).not.toContain(':');
      expect(files[0].path).not.toContain('<');
      expect(files[0].path).not.toContain('>');
      expect(files[0].path).not.toContain('?');
    });

    it('marks session as completed after creation', async () => {
      const candidate = service.addCandidate('Test');
      service.updateCandidate(candidate.id, {
        explanation: 'Complete the session',
        approved: true,
      });

      await service.createAtoms();

      expect(service.getSession()?.completed).toBe(true);
    });

    it('throws when no session is active', async () => {
      service.endSession();

      await expect(service.createAtoms()).rejects.toThrow('No active session');
    });

    it('returns empty array when no candidates approved', async () => {
      service.addCandidate('Unapproved');

      const files = await service.createAtoms();

      expect(files).toHaveLength(0);
    });
  });

  describe('template support', () => {
    beforeEach(() => {
      const note = createQuarryNote();
      service.startSession(note);
      app.vault._setFolder('Atoms');
    });

    it('applies template when configured', async () => {
      const template = `---
created: {{date}}
---

# {{title}}

## Summary

{{explanation}}

## Source

{{evidence}}
`;
      app.vault._setFile('Templates/Atom.md', template);
      settings.atomTemplatePath = 'Templates/Atom.md';
      service.updateSettings(settings);

      const candidate = service.addCandidate('Templated atom');
      service.updateCandidate(candidate.id, {
        explanation: 'My explanation',
        evidence: 'My evidence',
        approved: true,
      });

      const files = await service.createAtoms();
      const content = await app.vault.read(files[0] as any);

      expect(content).toContain('## Summary');
      expect(content).toContain('My explanation');
      expect(content).toContain('## Source');
      expect(content).toContain('My evidence');
    });

    it('falls back to default content when template not found', async () => {
      settings.atomTemplatePath = 'NonExistent/Template.md';
      service.updateSettings(settings);

      const candidate = service.addCandidate('No template');
      service.updateCandidate(candidate.id, {
        explanation: 'Fallback content',
        approved: true,
      });

      const files = await service.createAtoms();
      const content = await app.vault.read(files[0] as any);

      // Should have default structure
      expect(content).toContain('# No template');
      expect(content).toContain('Fallback content');
    });
  });
});
