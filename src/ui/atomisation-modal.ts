import { Modal, App, TFile } from 'obsidian';
import { QuarryNote } from '../types';

/**
 * Quick modal for showing atomisation notifications
 *
 * This modal provides a quick-action interface when the daily
 * notification fires. Users can choose to start the full
 * atomisation flow or defer.
 */
export class AtomisationModal extends Modal {
  private note: QuarryNote;
  private onStart: () => void;
  private onDefer: () => void;

  constructor(
    app: App,
    note: QuarryNote,
    onStart: () => void,
    onDefer: () => void
  ) {
    super(app);
    this.note = note;
    this.onStart = onStart;
    this.onDefer = onDefer;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.addClass('kastenator-modal');

    // Header
    contentEl.createEl('h2', { text: 'Time to Atomise' });

    // Note preview
    const preview = contentEl.createDiv({ cls: 'kastenator-modal-preview' });
    preview.createEl('h3', { text: this.note.title });

    // Content excerpt
    const excerpt = this.getExcerpt(this.note.content, 300);
    preview.createEl('p', { text: excerpt });

    // Metadata
    const meta = contentEl.createDiv({ cls: 'kastenator-modal-meta' });
    meta.createEl('span', {
      text: `Folder: ${this.note.file.parent?.path ?? 'Root'}`,
    });

    // Actions
    const actions = contentEl.createDiv({ cls: 'kastenator-modal-actions' });

    const startBtn = actions.createEl('button', {
      text: 'Start Atomisation',
      cls: 'mod-cta',
    });
    startBtn.addEventListener('click', () => {
      this.close();
      this.onStart();
    });

    const deferBtn = actions.createEl('button', {
      text: 'Remind Me Later',
      cls: 'mod-secondary',
    });
    deferBtn.addEventListener('click', () => {
      this.close();
      this.onDefer();
    });

    const skipBtn = actions.createEl('button', {
      text: 'Skip Today',
    });
    skipBtn.addEventListener('click', () => {
      this.close();
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }

  /**
   * Get a text excerpt from markdown content
   */
  private getExcerpt(content: string, maxLength: number): string {
    // Remove frontmatter
    const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '');

    // Remove markdown formatting
    const plainText = withoutFrontmatter
      .replace(/#+\s/g, '') // Headers
      .replace(/\*\*|__/g, '') // Bold
      .replace(/\*|_/g, '') // Italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Images
      .replace(/`{1,3}[^`]*`{1,3}/g, '') // Code
      .replace(/^\s*[-*+]\s/gm, '') // List markers
      .replace(/^\s*\d+\.\s/gm, '') // Numbered lists
      .replace(/\n{2,}/g, '\n') // Multiple newlines
      .trim();

    if (plainText.length <= maxLength) {
      return plainText;
    }

    // Truncate at word boundary
    const truncated = plainText.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.slice(0, lastSpace) + '...';
  }
}
