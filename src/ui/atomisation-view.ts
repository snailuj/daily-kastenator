import {
  ItemView,
  WorkspaceLeaf,
  TFile,
  MarkdownRenderer,
  setIcon,
} from 'obsidian';
import DailyKastenatorPlugin from '../main';
import { AtomisationService } from '../services/atomisation';
import { QuarryService } from '../services/quarry';
import {
  QuarryNote,
  AtomCandidate,
  AtomisationPhase,
  AtomisationSession,
} from '../types';

export const ATOMISATION_VIEW_TYPE = 'kastenator-atomisation-view';

/**
 * Main view for the atomisation quiz workflow
 *
 * This view guides the user through identifying, explaining,
 * and creating atomic notes from a quarry source.
 */
export class AtomisationView extends ItemView {
  private plugin: DailyKastenatorPlugin;
  private atomisationService: AtomisationService;
  private quarryService: QuarryService;
  private currentNote: QuarryNote | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: DailyKastenatorPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.atomisationService = new AtomisationService(
      this.app,
      this.plugin.settings
    );
    this.quarryService = new QuarryService(this.app, this.plugin.settings);
  }

  getViewType(): string {
    return ATOMISATION_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Atomisation';
  }

  getIcon(): string {
    return 'pickaxe';
  }

  async onOpen(): Promise<void> {
    this.contentEl = this.containerEl.children[1] as HTMLElement;
    this.contentEl.empty();
    this.contentEl.addClass('kastenator-view');
    this.renderWelcome();
  }

  async onClose(): Promise<void> {
    this.atomisationService.endSession();
  }

  /**
   * Start an atomisation session for a specific file
   */
  async startSession(file: TFile): Promise<void> {
    const content = await this.app.vault.cachedRead(file);
    const cache = this.app.metadataCache.getFileCache(file);

    this.currentNote = {
      file,
      title: file.basename,
      content,
      frontmatter: cache?.frontmatter ?? {},
      migrationStatus: this.plugin.settings.quarryValue,
    };

    this.atomisationService.startSession(this.currentNote);
    this.renderPhase('introduction');
  }

  /**
   * Render the welcome screen when no session is active
   */
  private renderWelcome(): void {
    this.contentEl.empty();

    const container = this.contentEl.createDiv({ cls: 'kastenator-welcome' });

    container.createEl('h2', { text: 'Daily Kastenator' });
    container.createEl('p', {
      text: 'Transform your quarry notes into atomic knowledge.',
    });

    const button = container.createEl('button', {
      text: 'Start Random Session',
      cls: 'mod-cta',
    });

    button.addEventListener('click', () => {
      this.plugin.triggerDailyNotification();
    });
  }

  /**
   * Render the current phase of the atomisation workflow
   */
  private renderPhase(phase: AtomisationPhase): void {
    this.contentEl.empty();

    const session = this.atomisationService.getSession();
    if (!session) {
      this.renderWelcome();
      return;
    }

    // Header with progress
    this.renderHeader(session);

    // Phase-specific content
    switch (phase) {
      case 'introduction':
        this.renderIntroduction(session);
        break;
      case 'identification':
        this.renderIdentification(session);
        break;
      case 'explanation':
        this.renderExplanation(session);
        break;
      case 'critique':
        this.renderCritique(session);
        break;
      case 'refinement':
        this.renderRefinement(session);
        break;
      case 'confirmation':
        this.renderConfirmation(session);
        break;
      case 'creation':
        this.renderCreation(session);
        break;
      case 'complete':
        this.renderComplete(session);
        break;
    }
  }

  /**
   * Render the header with progress indicator
   */
  private renderHeader(session: AtomisationSession): void {
    const header = this.contentEl.createDiv({ cls: 'kastenator-header' });

    // Title
    header.createEl('h3', { text: `Atomising: ${session.sourceNote.title}` });

    // Phase indicator
    const phases: AtomisationPhase[] = [
      'introduction',
      'identification',
      'explanation',
      'critique',
      'refinement',
      'confirmation',
      'creation',
      'complete',
    ];

    const progress = header.createDiv({ cls: 'kastenator-progress' });
    const currentIndex = phases.indexOf(session.phase);

    phases.forEach((phase, index) => {
      const step = progress.createDiv({
        cls: `kastenator-step ${index === currentIndex ? 'active' : ''} ${
          index < currentIndex ? 'completed' : ''
        }`,
      });
      step.createSpan({ text: (index + 1).toString() });
    });
  }

  /**
   * Phase: Introduction
   * Show the source note and explain the process
   */
  private renderIntroduction(session: AtomisationSession): void {
    const container = this.contentEl.createDiv({ cls: 'kastenator-phase' });

    container.createEl('h4', { text: 'Source Note' });

    // Render source content preview
    const preview = container.createDiv({ cls: 'kastenator-preview' });
    MarkdownRenderer.render(
      this.app,
      session.sourceNote.content,
      preview,
      session.sourceNote.file.path,
      this
    );

    // Instructions
    const instructions = container.createDiv({ cls: 'kastenator-instructions' });
    instructions.createEl('h4', { text: 'Your Task' });
    instructions.createEl('p', {
      text: 'Read through this note carefully. Your goal is to identify discrete, atomic concepts that can stand alone as independent notes.',
    });
    instructions.createEl('p', {
      text: 'Each atom should express exactly one idea. If a concept requires another to be understood, they may need to be separate linked atoms.',
    });

    // Action button
    this.renderActionButton(container, 'Begin Identification', () => {
      this.atomisationService.advancePhase();
      this.renderPhase('identification');
    });
  }

  /**
   * Phase: Identification
   * User identifies atomic concepts from the source
   */
  private renderIdentification(session: AtomisationSession): void {
    const container = this.contentEl.createDiv({ cls: 'kastenator-phase' });

    container.createEl('h4', { text: 'Identify Atomic Concepts' });
    container.createEl('p', {
      text: 'What discrete concepts can you extract from this note? List each one.',
    });

    // Input for new concepts
    const inputGroup = container.createDiv({ cls: 'kastenator-input-group' });
    const input = inputGroup.createEl('textarea', {
      placeholder: 'Describe an atomic concept...',
      cls: 'kastenator-concept-input',
    });

    const addButton = inputGroup.createEl('button', { text: 'Add Concept' });
    addButton.addEventListener('click', () => {
      const value = input.value.trim();
      if (value) {
        this.atomisationService.addCandidate(value);
        input.value = '';
        this.renderPhase('identification'); // Re-render to show new candidate
      }
    });

    // List of added concepts
    if (session.candidates.length > 0) {
      const list = container.createDiv({ cls: 'kastenator-candidate-list' });
      list.createEl('h5', { text: 'Identified Concepts' });

      for (const candidate of session.candidates) {
        const item = list.createDiv({ cls: 'kastenator-candidate-item' });
        item.createSpan({ text: candidate.concept });

        const removeBtn = item.createEl('button', {
          cls: 'kastenator-remove-btn',
        });
        setIcon(removeBtn, 'x');
        removeBtn.addEventListener('click', () => {
          this.atomisationService.removeCandidate(candidate.id);
          this.renderPhase('identification');
        });
      }
    }

    // Source reference (collapsed)
    this.renderSourceReference(container, session);

    // Navigation
    const nav = container.createDiv({ cls: 'kastenator-nav' });

    if (session.candidates.length > 0) {
      this.renderActionButton(nav, 'Continue to Explanations', () => {
        this.atomisationService.advancePhase();
        this.renderPhase('explanation');
      });
    } else {
      nav.createEl('p', {
        text: 'Add at least one concept to continue.',
        cls: 'kastenator-hint',
      });
    }
  }

  /**
   * Phase: Explanation
   * User explains each identified concept
   */
  private renderExplanation(session: AtomisationSession): void {
    const container = this.contentEl.createDiv({ cls: 'kastenator-phase' });

    container.createEl('h4', { text: 'Explain Each Concept' });
    container.createEl('p', {
      text: 'For each concept, provide an explanation that would make sense without the source note.',
    });

    // Render each candidate with explanation input
    for (const candidate of session.candidates) {
      const card = container.createDiv({ cls: 'kastenator-explanation-card' });

      card.createEl('h5', { text: candidate.concept });

      // Title input
      const titleGroup = card.createDiv({ cls: 'kastenator-field-group' });
      titleGroup.createEl('label', { text: 'Title' });
      const titleInput = titleGroup.createEl('input', {
        type: 'text',
        value: candidate.suggestedTitle,
      });
      titleInput.addEventListener('change', () => {
        this.atomisationService.updateCandidate(candidate.id, {
          suggestedTitle: titleInput.value,
        });
      });

      // Explanation input
      const explainGroup = card.createDiv({ cls: 'kastenator-field-group' });
      explainGroup.createEl('label', { text: 'Explanation' });
      const explainInput = explainGroup.createEl('textarea', {
        placeholder: 'Explain this concept in your own words...',
      });
      explainInput.value = candidate.explanation;
      explainInput.addEventListener('change', () => {
        this.atomisationService.updateCandidate(candidate.id, {
          explanation: explainInput.value,
        });
      });

      // Evidence input
      const evidenceGroup = card.createDiv({ cls: 'kastenator-field-group' });
      evidenceGroup.createEl('label', { text: 'Supporting Evidence' });
      const evidenceInput = evidenceGroup.createEl('textarea', {
        placeholder: 'Quote or reference from the source...',
      });
      evidenceInput.value = candidate.evidence;
      evidenceInput.addEventListener('change', () => {
        this.atomisationService.updateCandidate(candidate.id, {
          evidence: evidenceInput.value,
        });
      });
    }

    // Source reference
    this.renderSourceReference(container, session);

    // Navigation
    this.renderActionButton(container, 'Submit for Critique', () => {
      this.atomisationService.advancePhase();
      this.renderPhase('critique');
    });
  }

  /**
   * Phase: Critique
   * System provides critique of explanations
   */
  private renderCritique(session: AtomisationSession): void {
    const container = this.contentEl.createDiv({ cls: 'kastenator-phase' });

    container.createEl('h4', { text: 'Critique' });
    container.createEl('p', {
      text: 'Review the following assessment of your explanations.',
    });

    // Generate and display critique for each candidate
    for (const candidate of session.candidates) {
      const critique = this.atomisationService.generateCritique(candidate);
      this.atomisationService.updateCandidate(candidate.id, { critique });

      const card = container.createDiv({ cls: 'kastenator-critique-card' });
      card.createEl('h5', { text: candidate.suggestedTitle });

      const validation = this.atomisationService.validateExplanation(candidate);

      // Status indicator
      const status = card.createDiv({
        cls: `kastenator-status ${validation.valid ? 'valid' : 'needs-work'}`,
      });
      status.createSpan({
        text: validation.valid ? 'Acceptable' : 'Needs refinement',
      });

      // Critique content
      const critiqueEl = card.createDiv({ cls: 'kastenator-critique-content' });
      critiqueEl.createEl('p', { text: critique });

      // Suggestions if any
      if (validation.suggestions && validation.suggestions.length > 0) {
        const suggestionsEl = card.createDiv({ cls: 'kastenator-suggestions' });
        suggestionsEl.createEl('strong', { text: 'Consider:' });
        const list = suggestionsEl.createEl('ul');
        for (const suggestion of validation.suggestions) {
          list.createEl('li', { text: suggestion });
        }
      }
    }

    // Navigation
    const nav = container.createDiv({ cls: 'kastenator-nav' });

    const refineBtn = nav.createEl('button', { text: 'Refine Explanations' });
    refineBtn.addEventListener('click', () => {
      this.atomisationService.advancePhase();
      this.renderPhase('refinement');
    });

    const skipBtn = nav.createEl('button', {
      text: 'Skip to Confirmation',
      cls: 'mod-secondary',
    });
    skipBtn.addEventListener('click', () => {
      this.atomisationService.setPhase('confirmation');
      this.renderPhase('confirmation');
    });
  }

  /**
   * Phase: Refinement
   * User refines explanations based on critique
   */
  private renderRefinement(session: AtomisationSession): void {
    const container = this.contentEl.createDiv({ cls: 'kastenator-phase' });

    container.createEl('h4', { text: 'Refine Your Explanations' });
    container.createEl('p', {
      text: 'Address the critique and improve your explanations.',
    });

    for (const candidate of session.candidates) {
      const card = container.createDiv({ cls: 'kastenator-refinement-card' });

      // Show critique
      if (candidate.critique) {
        const critiqueEl = card.createDiv({ cls: 'kastenator-previous-critique' });
        critiqueEl.createEl('strong', { text: 'Previous critique:' });
        critiqueEl.createEl('p', { text: candidate.critique });
      }

      card.createEl('h5', { text: candidate.suggestedTitle });

      // Editable explanation
      const explainGroup = card.createDiv({ cls: 'kastenator-field-group' });
      explainGroup.createEl('label', { text: 'Explanation' });
      const explainInput = explainGroup.createEl('textarea');
      explainInput.value = candidate.explanation;
      explainInput.addEventListener('change', () => {
        this.atomisationService.updateCandidate(candidate.id, {
          explanation: explainInput.value,
        });
      });

      // Evidence
      const evidenceGroup = card.createDiv({ cls: 'kastenator-field-group' });
      evidenceGroup.createEl('label', { text: 'Evidence' });
      const evidenceInput = evidenceGroup.createEl('textarea');
      evidenceInput.value = candidate.evidence;
      evidenceInput.addEventListener('change', () => {
        this.atomisationService.updateCandidate(candidate.id, {
          evidence: evidenceInput.value,
        });
      });
    }

    // Source reference
    this.renderSourceReference(container, session);

    // Navigation
    this.renderActionButton(container, 'Continue to Confirmation', () => {
      this.atomisationService.advancePhase();
      this.renderPhase('confirmation');
    });
  }

  /**
   * Phase: Confirmation
   * Final review before creating atoms
   */
  private renderConfirmation(session: AtomisationSession): void {
    const container = this.contentEl.createDiv({ cls: 'kastenator-phase' });

    container.createEl('h4', { text: 'Final Confirmation' });
    container.createEl('p', {
      text: 'Select which atoms to create. Unselected items will be discarded.',
    });

    for (const candidate of session.candidates) {
      const card = container.createDiv({ cls: 'kastenator-confirm-card' });

      // Checkbox for approval
      const checkGroup = card.createDiv({ cls: 'kastenator-check-group' });
      const checkbox = checkGroup.createEl('input', { type: 'checkbox' });
      checkbox.checked = candidate.approved;
      checkbox.addEventListener('change', () => {
        this.atomisationService.updateCandidate(candidate.id, {
          approved: checkbox.checked,
        });
      });

      const label = checkGroup.createEl('label', {
        text: candidate.suggestedTitle,
      });

      // Summary
      const summary = card.createDiv({ cls: 'kastenator-confirm-summary' });
      summary.createEl('p', { text: candidate.explanation });

      if (candidate.evidence) {
        summary.createEl('blockquote', { text: candidate.evidence });
      }
    }

    // Count selected
    const selectedCount = session.candidates.filter((c) => c.approved).length;
    container.createEl('p', {
      text: `${selectedCount} of ${session.candidates.length} atoms selected for creation.`,
      cls: 'kastenator-selection-count',
    });

    // Navigation
    const nav = container.createDiv({ cls: 'kastenator-nav' });

    if (selectedCount > 0) {
      this.renderActionButton(nav, `Create ${selectedCount} Atoms`, () => {
        this.atomisationService.advancePhase();
        this.renderPhase('creation');
      });
    }

    const cancelBtn = nav.createEl('button', {
      text: 'Cancel',
      cls: 'mod-secondary',
    });
    cancelBtn.addEventListener('click', () => {
      this.atomisationService.endSession();
      this.renderWelcome();
    });
  }

  /**
   * Phase: Creation
   * Actually create the atom files
   */
  private async renderCreation(session: AtomisationSession): Promise<void> {
    const container = this.contentEl.createDiv({ cls: 'kastenator-phase' });

    container.createEl('h4', { text: 'Creating Atoms...' });

    const progress = container.createDiv({ cls: 'kastenator-creation-progress' });
    progress.createEl('p', { text: 'Creating atom files...' });

    try {
      const createdFiles = await this.atomisationService.createAtoms();

      // Mark source as atomised
      if (this.currentNote) {
        await this.quarryService.markAsAtomised(this.currentNote.file);
      }

      // Show completion
      this.atomisationService.advancePhase();
      this.renderComplete(session, createdFiles);
    } catch (error) {
      progress.empty();
      progress.createEl('p', {
        text: `Error creating atoms: ${error}`,
        cls: 'kastenator-error',
      });
    }
  }

  /**
   * Phase: Complete
   * Show summary and links to created atoms
   */
  private renderComplete(session: AtomisationSession, createdFiles?: TFile[]): void {
    const container = this.contentEl.createDiv({ cls: 'kastenator-phase' });

    container.createEl('h4', { text: 'Atomisation Complete' });

    if (createdFiles && createdFiles.length > 0) {
      container.createEl('p', {
        text: `Created ${createdFiles.length} atom${createdFiles.length > 1 ? 's' : ''}:`,
      });

      const list = container.createEl('ul', { cls: 'kastenator-created-list' });
      for (const file of createdFiles) {
        const item = list.createEl('li');
        const link = item.createEl('a', { text: file.basename });
        link.addEventListener('click', () => {
          this.app.workspace.getLeaf().openFile(file);
        });
      }
    }

    // Source note link
    if (this.currentNote) {
      const sourceSection = container.createDiv({ cls: 'kastenator-source-link' });
      sourceSection.createEl('p', { text: 'Source note has been marked as atomised.' });

      const openSource = sourceSection.createEl('a', {
        text: `Open ${this.currentNote.title}`,
      });
      openSource.addEventListener('click', () => {
        if (this.currentNote) {
          this.app.workspace.getLeaf().openFile(this.currentNote.file);
        }
      });
    }

    // Start new session button
    this.renderActionButton(container, 'Start New Session', () => {
      this.atomisationService.endSession();
      this.currentNote = null;
      this.plugin.triggerDailyNotification();
    });

    // Close button
    const closeBtn = container.createEl('button', {
      text: 'Close',
      cls: 'mod-secondary',
    });
    closeBtn.addEventListener('click', () => {
      this.atomisationService.endSession();
      this.currentNote = null;
      this.renderWelcome();
    });
  }

  /**
   * Render a collapsible source reference
   */
  private renderSourceReference(
    container: HTMLElement,
    session: AtomisationSession
  ): void {
    const details = container.createEl('details', { cls: 'kastenator-source-ref' });
    const summary = details.createEl('summary', { text: 'View Source Note' });

    const content = details.createDiv({ cls: 'kastenator-source-content' });
    MarkdownRenderer.render(
      this.app,
      session.sourceNote.content,
      content,
      session.sourceNote.file.path,
      this
    );
  }

  /**
   * Render a primary action button
   */
  private renderActionButton(
    container: HTMLElement,
    text: string,
    onClick: () => void
  ): void {
    const button = container.createEl('button', {
      text,
      cls: 'mod-cta kastenator-action-btn',
    });
    button.addEventListener('click', onClick);
  }
}
