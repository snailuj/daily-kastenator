/**
 * Mock implementations of Obsidian API for testing
 */

import { vi } from 'vitest';

export class TFile {
  path: string;
  basename: string;
  extension: string;
  parent: TFolder | null;

  constructor(path: string) {
    this.path = path;
    this.basename = path.split('/').pop()?.replace(/\.md$/, '') ?? '';
    this.extension = 'md';
    this.parent = null;
  }
}

export class TFolder {
  path: string;
  name: string;

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() ?? '';
  }
}

export class TAbstractFile {
  path: string;

  constructor(path: string) {
    this.path = path;
  }
}

export interface CachedMetadata {
  frontmatter?: Record<string, unknown>;
  sections?: Array<{ type: string; position: { start: { line: number } } }>;
}

export class Vault {
  private files: Map<string, string> = new Map();
  private folders: Set<string> = new Set();

  async read(file: TFile): Promise<string> {
    return this.files.get(file.path) ?? '';
  }

  async cachedRead(file: TFile): Promise<string> {
    return this.read(file);
  }

  async create(path: string, content: string): Promise<TFile> {
    this.files.set(path, content);
    return new TFile(path);
  }

  async modify(file: TFile, content: string): Promise<void> {
    this.files.set(file.path, content);
  }

  async createFolder(path: string): Promise<void> {
    this.folders.add(path);
  }

  getAbstractFileByPath(path: string): TAbstractFile | null {
    if (this.files.has(path)) {
      return new TFile(path);
    }
    if (this.folders.has(path)) {
      return new TFolder(path);
    }
    return null;
  }

  getMarkdownFiles(): TFile[] {
    return Array.from(this.files.keys())
      .filter((path) => path.endsWith('.md'))
      .map((path) => new TFile(path));
  }

  // Test helpers
  _setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  _setFolder(path: string): void {
    this.folders.add(path);
  }

  _clear(): void {
    this.files.clear();
    this.folders.clear();
  }
}

export class MetadataCache {
  private cache: Map<string, CachedMetadata> = new Map();

  getFileCache(file: TFile): CachedMetadata | null {
    return this.cache.get(file.path) ?? null;
  }

  // Test helper
  _setCache(path: string, metadata: CachedMetadata): void {
    this.cache.set(path, metadata);
  }

  _clear(): void {
    this.cache.clear();
  }
}

export class App {
  vault: Vault;
  metadataCache: MetadataCache;
  workspace: Workspace;
  plugins: { plugins: Record<string, unknown> };

  constructor() {
    this.vault = new Vault();
    this.metadataCache = new MetadataCache();
    this.workspace = new Workspace();
    this.plugins = { plugins: {} };
  }
}

export class Workspace {
  getLeaf = vi.fn();
  getLeavesOfType = vi.fn().mockReturnValue([]);
  getRightLeaf = vi.fn();
  revealLeaf = vi.fn();
  detachLeavesOfType = vi.fn();
  on = vi.fn();
}

export class Plugin {
  app: App;
  manifest: { id: string; name: string; version: string };

  constructor() {
    this.app = new App();
    this.manifest = { id: 'test-plugin', name: 'Test Plugin', version: '1.0.0' };
  }

  loadData = vi.fn().mockResolvedValue({});
  saveData = vi.fn().mockResolvedValue(undefined);
  addCommand = vi.fn();
  addRibbonIcon = vi.fn();
  addSettingTab = vi.fn();
  registerEvent = vi.fn();
  registerInterval = vi.fn();
  registerView = vi.fn();
}

export class Notice {
  message: string;
  duration: number;

  constructor(message: string, duration?: number) {
    this.message = message;
    this.duration = duration ?? 5000;
  }

  hide = vi.fn();
}

export class Modal {
  app: App;
  contentEl: HTMLElement;
  containerEl: HTMLElement;

  constructor(app: App) {
    this.app = app;
    this.contentEl = document.createElement('div');
    this.containerEl = document.createElement('div');
  }

  open = vi.fn();
  close = vi.fn();
  onOpen(): void {}
  onClose(): void {}
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl: HTMLElement;

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }

  display(): void {}
  hide(): void {}
}

export class Setting {
  constructor(_containerEl: HTMLElement) {}

  setName = vi.fn().mockReturnThis();
  setDesc = vi.fn().mockReturnThis();
  addText = vi.fn().mockReturnThis();
  addToggle = vi.fn().mockReturnThis();
  addDropdown = vi.fn().mockReturnThis();
  addButton = vi.fn().mockReturnThis();
}

export class ItemView {
  app: App;
  leaf: WorkspaceLeaf;
  containerEl: HTMLElement;
  contentEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.app = leaf.view?.app ?? new App();
    this.containerEl = document.createElement('div');
    this.contentEl = document.createElement('div');
    this.containerEl.appendChild(this.contentEl);
  }

  getViewType(): string {
    return '';
  }

  getDisplayText(): string {
    return '';
  }

  getIcon(): string {
    return '';
  }

  onOpen(): Promise<void> {
    return Promise.resolve();
  }

  onClose(): Promise<void> {
    return Promise.resolve();
  }
}

export class WorkspaceLeaf {
  view: ItemView | null = null;

  setViewState = vi.fn();
  getViewState = vi.fn();
}

export const MarkdownRenderer = {
  render: vi.fn(),
  renderMarkdown: vi.fn(),
};

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function setIcon(_el: HTMLElement, _iconId: string): void {}
