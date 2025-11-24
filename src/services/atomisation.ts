import { App, TFile, normalizePath } from 'obsidian';
import {
  KastenatorSettings,
  QuarryNote,
  AtomCandidate,
  AtomisationSession,
  AtomisationPhase,
  ValidationResult,
} from '../types';
import { LLMService } from './llm/index';

/**
 * Manages the atomisation workflow and atom creation
 */
export class AtomisationService {
  private app: App;
  private settings: KastenatorSettings;
  private currentSession: AtomisationSession | null = null;
  private llmService: LLMService;

  constructor(app: App, settings: KastenatorSettings) {
    this.app = app;
    this.settings = settings;
    this.llmService = new LLMService(app, settings);
  }

  /**
   * Update settings reference
   */
  updateSettings(settings: KastenatorSettings): void {
    this.settings = settings;
    this.llmService.updateSettings(settings);
  }

  /**
   * Start a new atomisation session
   */
  startSession(sourceNote: QuarryNote): AtomisationSession {
    this.currentSession = {
      sourceNote,
      candidates: [],
      phase: 'introduction',
      startedAt: new Date(),
      completed: false,
    };
    return this.currentSession;
  }

  /**
   * Get the current session
   */
  getSession(): AtomisationSession | null {
    return this.currentSession;
  }

  /**
   * Advance to the next phase
   */
  advancePhase(): AtomisationPhase {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const phaseOrder: AtomisationPhase[] = [
      'introduction',
      'identification',
      'explanation',
      'critique',
      'refinement',
      'confirmation',
      'creation',
      'complete',
    ];

    const currentIndex = phaseOrder.indexOf(this.currentSession.phase);
    const nextPhase = phaseOrder[currentIndex + 1] ?? 'complete';
    this.currentSession.phase = nextPhase;

    return nextPhase;
  }

  /**
   * Set a specific phase
   */
  setPhase(phase: AtomisationPhase): void {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    this.currentSession.phase = phase;
  }

  /**
   * Add a new atom candidate
   */
  addCandidate(concept: string): AtomCandidate {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const candidate: AtomCandidate = {
      id: this.generateId(),
      concept,
      explanation: '',
      evidence: '',
      suggestedTitle: this.suggestTitle(concept),
      tags: [],
      relatedAtoms: [],
      critique: '',
      approved: false,
    };

    this.currentSession.candidates.push(candidate);
    return candidate;
  }

  /**
   * Update a candidate's properties
   */
  updateCandidate(id: string, updates: Partial<AtomCandidate>): AtomCandidate | null {
    if (!this.currentSession) return null;

    const candidate = this.currentSession.candidates.find((c) => c.id === id);
    if (!candidate) return null;

    Object.assign(candidate, updates);
    return candidate;
  }

  /**
   * Remove a candidate
   */
  removeCandidate(id: string): boolean {
    if (!this.currentSession) return false;

    const index = this.currentSession.candidates.findIndex((c) => c.id === id);
    if (index === -1) return false;

    this.currentSession.candidates.splice(index, 1);
    return true;
  }

  /**
   * Validate a user's explanation of a concept
   * Returns honest critique without emotional padding
   */
  validateExplanation(candidate: AtomCandidate): ValidationResult {
    const { explanation, concept } = candidate;

    // Check for minimum length
    if (explanation.length < 20) {
      return {
        valid: false,
        feedback: 'Too brief. An atomic concept requires a substantive explanation.',
        suggestions: [
          'What is the core claim or idea?',
          'Why does this matter?',
          'How would you explain this to someone unfamiliar with the source?',
        ],
      };
    }

    // Check for vagueness markers
    const vagueMarkers = [
      'something like',
      'kind of',
      'sort of',
      'basically',
      'generally',
      'usually',
      'I think maybe',
    ];
    const hasVagueness = vagueMarkers.some((marker) =>
      explanation.toLowerCase().includes(marker)
    );

    if (hasVagueness) {
      return {
        valid: false,
        feedback: 'The explanation contains hedging language. Be precise.',
        suggestions: [
          'Remove qualifiers and state the concept directly',
          'If uncertain, identify what specifically is unclear',
        ],
      };
    }

    // Check if explanation just repeats the concept
    const conceptWords = concept.toLowerCase().split(/\s+/);
    const explanationWords = explanation.toLowerCase().split(/\s+/);
    const overlap = conceptWords.filter((word) =>
      explanationWords.includes(word) && word.length > 3
    );

    if (overlap.length > conceptWords.length * 0.7) {
      return {
        valid: false,
        feedback: 'The explanation largely repeats the concept rather than explaining it.',
        suggestions: [
          'Explain what the concept means, not just what it is',
          'Add context or implications',
        ],
      };
    }

    // Check for atomicity (single concept)
    const conjunctions = ['and', 'also', 'additionally', 'furthermore', 'moreover'];
    const hasMultipleConcepts = conjunctions.some((conj) => {
      const pattern = new RegExp(`\\b${conj}\\b.*\\b(is|are|means|implies)\\b`, 'i');
      return pattern.test(explanation);
    });

    if (hasMultipleConcepts) {
      return {
        valid: false,
        feedback: 'This may contain multiple concepts. Each atom should express one idea.',
        suggestions: [
          'Consider splitting into separate atoms',
          'Identify the primary concept and extract secondary ideas',
        ],
      };
    }

    // Passed basic validation
    return {
      valid: true,
      feedback: 'Explanation is acceptable. Consider: does this stand alone without the source?',
    };
  }

  /**
   * Generate critique for a candidate using rule-based heuristics
   */
  generateRuleBasedCritique(candidate: AtomCandidate): string {
    const issues: string[] = [];

    // Title critique
    if (candidate.suggestedTitle.length < 10) {
      issues.push('Title is too short to be descriptive.');
    }
    if (candidate.suggestedTitle.length > 80) {
      issues.push('Title is too long. Aim for concise but complete.');
    }

    // Evidence critique
    if (!candidate.evidence) {
      issues.push('No supporting evidence provided. Atoms should trace to sources.');
    } else if (candidate.evidence.length < 30) {
      issues.push('Evidence is sparse. Include enough context to verify the claim.');
    }

    // Explanation validation
    const validation = this.validateExplanation(candidate);
    if (!validation.valid) {
      issues.push(validation.feedback);
    }

    // Check for missing links
    if (candidate.relatedAtoms.length === 0) {
      issues.push('No related atoms linked. Consider connections to existing knowledge.');
    }

    if (issues.length === 0) {
      return 'No significant issues identified. Ready for creation.';
    }

    return issues.join('\n\n');
  }

  /**
   * Generate critique for a candidate (sync version, rule-based only)
   * For backwards compatibility and tests
   */
  generateCritique(candidate: AtomCandidate): string {
    return this.generateRuleBasedCritique(candidate);
  }

  /**
   * Generate critique using LLM (if enabled) with fallback to rule-based
   */
  async generateCritiqueAsync(candidate: AtomCandidate): Promise<string> {
    // Check if LLM critique is enabled in settings
    if (!this.settings.useLLMCritique) {
      return this.generateRuleBasedCritique(candidate);
    }

    const llmAvailable = await this.llmService.isAvailable();

    if (!llmAvailable) {
      return this.generateRuleBasedCritique(candidate);
    }

    // Get source content from current session
    const sourceContent = this.currentSession?.sourceNote.content ?? '';

    const prompt = this.llmService.buildCritiquePrompt(
      candidate.concept,
      candidate.explanation,
      candidate.evidence,
      sourceContent
    );

    const result = await this.llmService.complete(prompt);

    if (result.success) {
      return result.content;
    }

    // Fallback to rule-based on LLM failure
    console.warn(`LLM critique failed: ${result.error}. Falling back to rules.`);
    return this.generateRuleBasedCritique(candidate);
  }

  /**
   * Check if LLM critique is enabled and available
   */
  async shouldUseLLMCritique(): Promise<boolean> {
    if (!this.settings.useLLMCritique) return false;
    return this.llmService.isAvailable();
  }

  /**
   * Check if LLM critique is available
   */
  async isLLMAvailable(): Promise<boolean> {
    return this.llmService.isAvailable();
  }

  /**
   * Get the name of the configured LLM provider
   */
  getLLMProviderName(): string {
    return this.llmService.getProviderName();
  }

  /**
   * Create atom files for approved candidates
   */
  async createAtoms(): Promise<TFile[]> {
    if (!this.currentSession) {
      throw new Error('No active session');
    }

    const approvedCandidates = this.currentSession.candidates.filter((c) => c.approved);
    const createdFiles: TFile[] = [];

    for (const candidate of approvedCandidates) {
      const file = await this.createAtomFile(candidate);
      if (file) {
        createdFiles.push(file);
      }
    }

    this.currentSession.completed = true;
    return createdFiles;
  }

  /**
   * Create a single atom file
   */
  private async createAtomFile(candidate: AtomCandidate): Promise<TFile | null> {
    const { atomFolder, atomTemplatePath } = this.settings;

    // Ensure atom folder exists
    const folderPath = normalizePath(atomFolder);
    const folderExists = this.app.vault.getAbstractFileByPath(folderPath);
    if (!folderExists) {
      await this.app.vault.createFolder(folderPath);
    }

    // Generate filename
    const sanitisedTitle = candidate.suggestedTitle
      .replace(/[\\/:*?"<>|]/g, '')
      .trim();
    const filename = `${sanitisedTitle}.md`;
    const filepath = normalizePath(`${atomFolder}/${filename}`);

    // Build content
    let content = await this.buildAtomContent(candidate);

    // Apply template if configured
    if (atomTemplatePath) {
      const templateFile = this.app.vault.getAbstractFileByPath(atomTemplatePath);
      if (templateFile instanceof TFile) {
        const templateContent = await this.app.vault.read(templateFile);
        content = this.applyTemplate(templateContent, candidate, content);
      }
    }

    // Check for existing file
    const existing = this.app.vault.getAbstractFileByPath(filepath);
    if (existing) {
      // Append timestamp to make unique
      const timestamp = Date.now();
      const uniquePath = normalizePath(
        `${atomFolder}/${sanitisedTitle}-${timestamp}.md`
      );
      return await this.app.vault.create(uniquePath, content);
    }

    return await this.app.vault.create(filepath, content);
  }

  /**
   * Build the content for an atom file
   */
  private async buildAtomContent(candidate: AtomCandidate): Promise<string> {
    const sourceNote = this.currentSession?.sourceNote;
    const lines: string[] = [];

    // Frontmatter
    lines.push('---');
    lines.push(`created: ${new Date().toISOString()}`);
    lines.push('type: atom');
    if (candidate.tags.length > 0) {
      lines.push(`tags: [${candidate.tags.join(', ')}]`);
    }
    if (sourceNote) {
      lines.push(`source: "[[${sourceNote.title}]]"`);
    }
    lines.push('---');
    lines.push('');

    // Title
    lines.push(`# ${candidate.suggestedTitle}`);
    lines.push('');

    // Core explanation
    lines.push(candidate.explanation);
    lines.push('');

    // Evidence section
    if (candidate.evidence) {
      lines.push('## Evidence');
      lines.push('');
      lines.push(`> ${candidate.evidence}`);
      lines.push('');
    }

    // Related atoms
    if (candidate.relatedAtoms.length > 0) {
      lines.push('## Related');
      lines.push('');
      for (const related of candidate.relatedAtoms) {
        lines.push(`- [[${related}]]`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Apply a template to atom content
   */
  private applyTemplate(
    template: string,
    candidate: AtomCandidate,
    defaultContent: string
  ): string {
    // Replace template variables
    return template
      .replace(/\{\{title\}\}/g, candidate.suggestedTitle)
      .replace(/\{\{concept\}\}/g, candidate.concept)
      .replace(/\{\{explanation\}\}/g, candidate.explanation)
      .replace(/\{\{evidence\}\}/g, candidate.evidence)
      .replace(/\{\{tags\}\}/g, candidate.tags.join(', '))
      .replace(/\{\{date\}\}/g, new Date().toISOString().split('T')[0])
      .replace(/\{\{content\}\}/g, defaultContent);
  }

  /**
   * Suggest a title based on the concept
   */
  private suggestTitle(concept: string): string {
    // Capitalise first letter, trim to reasonable length
    const trimmed = concept.trim();
    const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

    // Truncate if too long
    if (capitalised.length > 80) {
      return capitalised.slice(0, 77) + '...';
    }

    return capitalised;
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `atom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * End the current session
   */
  endSession(): void {
    this.currentSession = null;
  }
}
