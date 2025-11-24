import { TFile } from 'obsidian';

/**
 * Plugin settings interface
 */
/**
 * Available LLM provider types
 */
export type LLMProviderType = 'none' | 'smart-connections' | 'claude' | 'openrouter';

export interface KastenatorSettings {
  /** Hour of day to show notification (0-23) */
  notificationHour: number;
  /** Minute of hour to show notification (0-59) */
  notificationMinute: number;
  /** Folders to search for quarry notes */
  quarryFolders: string[];
  /** Dataview field name for migration status */
  migrationField: string;
  /** Value indicating note is in quarry */
  quarryValue: string;
  /** Folder to create atom notes in */
  atomFolder: string;
  /** Template file path for new atoms */
  atomTemplatePath: string;
  /** Last notification date (ISO string) */
  lastNotificationDate: string;
  /** Whether daily notification is enabled */
  notificationEnabled: boolean;

  /** LLM provider for AI-powered critique */
  llmProvider: LLMProviderType;
  /** Whether to use LLM critique when available */
  useLLMCritique: boolean;
  /** Claude API key (direct) */
  claudeApiKey?: string;
  /** Claude model ID */
  claudeModel?: string;
  /** OpenRouter API key */
  openrouterApiKey?: string;
  /** OpenRouter model ID */
  openrouterModel?: string;
}

/**
 * Represents a note candidate for atomisation
 */
export interface QuarryNote {
  file: TFile;
  title: string;
  content: string;
  frontmatter: Record<string, unknown>;
  migrationStatus: string;
}

/**
 * A single atomic concept extracted from a quarry note
 */
export interface AtomCandidate {
  /** Unique ID for this candidate */
  id: string;
  /** The core concept/claim */
  concept: string;
  /** User's explanation of the concept */
  explanation: string;
  /** Supporting evidence or context from source */
  evidence: string;
  /** Suggested title for the atom note */
  suggestedTitle: string;
  /** Tags to apply */
  tags: string[];
  /** Links to related atoms */
  relatedAtoms: string[];
  /** Critique feedback from the quiz */
  critique: string;
  /** Whether this candidate is approved for creation */
  approved: boolean;
}

/**
 * State of an atomisation session
 */
export interface AtomisationSession {
  /** The source note being atomised */
  sourceNote: QuarryNote;
  /** Candidates identified so far */
  candidates: AtomCandidate[];
  /** Current phase of the quiz */
  phase: AtomisationPhase;
  /** Session start time */
  startedAt: Date;
  /** Whether session is complete */
  completed: boolean;
}

/**
 * Phases of the atomisation quiz workflow
 */
export type AtomisationPhase =
  | 'introduction'      // Show the note, explain the process
  | 'identification'    // User identifies atomic concepts
  | 'explanation'       // User explains each concept
  | 'critique'          // System critiques the explanations
  | 'refinement'        // User refines based on critique
  | 'confirmation'      // Final review before creation
  | 'creation'          // Creating the atom files
  | 'complete';         // Session finished

/**
 * Quiz question structure
 */
export interface QuizQuestion {
  id: string;
  phase: AtomisationPhase;
  prompt: string;
  hint?: string;
  validationFn?: (answer: string) => ValidationResult;
}

/**
 * Result of validating a quiz answer
 */
export interface ValidationResult {
  valid: boolean;
  feedback: string;
  suggestions?: string[];
}

/**
 * Dataview API interface (partial, for type safety)
 */
export interface DataviewApi {
  pages: (source?: string) => DataviewPages;
  page: (path: string) => DataviewPage | undefined;
}

export interface DataviewPages {
  where: (predicate: (page: DataviewPage) => boolean) => DataviewPage[];
  array: () => DataviewPage[];
}

export interface DataviewPage {
  file: {
    path: string;
    name: string;
    folder: string;
    mtime: Date;
    ctime: Date;
  };
  [key: string]: unknown;
}
