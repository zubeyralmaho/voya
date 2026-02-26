/**
 * Detail level for explanations - from quick review to deep dive
 */
export type DetailLevel = 'tldr' | 'general' | 'detailed' | 'extreme_detail';

/**
 * Labels and descriptions for each detail level
 */
export const DETAIL_LEVEL_META: Record<DetailLevel, { label: string; description: string }> = {
  tldr: { 
    label: 'TL;DR', 
    description: 'One-sentence summary for quick review' 
  },
  general: { 
    label: 'General', 
    description: 'Standard explanation with key points' 
  },
  detailed: { 
    label: 'Detailed', 
    description: 'In-depth analysis with context' 
  },
  extreme_detail: { 
    label: 'Deep Dive', 
    description: 'Line-by-line breakdown with rationale' 
  }
};

/**
 * Core domain model representing a complete Voya tour
 */
export interface VoyaTour {
  id: string;
  title: string;
  createdAt: string;
  sourceContext: {
    repository?: string;
    branch?: string;
  };
  steps: VoyaStep[];
}

/**
 * Cached explanations at different detail levels
 */
export interface StepExplanations {
  tldr?: string;
  general?: string;
  detailed?: string;
  extreme_detail?: string;
}

/**
 * A single step/scene in the Voya player
 */
export interface VoyaStep {
  stepIndex: number;
  filePath: string;
  range: {
    startLine: number;
    endLine: number;
  };
  content: {
    summary: string;
    explanation: string;          // Default explanation (general level)
    explanations?: StepExplanations;  // Cached explanations per detail level
    translation?: string;
  };
  codeSnippet?: string;           // The actual code for this step (for LLM context)
}

/**
 * State managed by the Webview player UI
 */
export interface PlayerState {
  activeTourId: string | null;
  currentStepIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  isLoadingDeepen: boolean;       // True when fetching deeper explanation
  preferences: {
    language: string;
    detailLevel: DetailLevel;
  };
}

/**
 * Messages sent from Extension Host to Webview
 */
export type ExtensionToWebviewMessage =
  | { type: 'tourLoaded'; tour: VoyaTour }
  | { type: 'tourList'; tours: VoyaTour[] }
  | { type: 'stepChanged'; stepIndex: number }
  | { type: 'playbackStateChanged'; isPlaying: boolean }
  | { type: 'deepenStarted'; stepIndex: number }
  | { type: 'deepenComplete'; stepIndex: number; detailLevel: DetailLevel; explanation: string }
  | { type: 'settingsLoaded'; provider: string; apiKey: string; model: string }
  | { type: 'settingsSaved' }
  | { type: 'journalUpdate'; journal: CodeJournal }
  | { type: 'changeDetected'; change: TrackedChange }
  | { type: 'changeExplained'; changeId: string; explanation: string }
  | { type: 'trackingStateChanged'; isTracking: boolean }
  | { type: 'error'; message: string };

/**
 * Messages sent from Webview to Extension Host
 */
export type WebviewToExtensionMessage =
  | { type: 'requestTourList' }
  | { type: 'loadTour'; tourId: string }
  | { type: 'goToStep'; stepIndex: number }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'nextStep' }
  | { type: 'prevStep' }
  | { type: 'setPlaybackSpeed'; speed: number }
  | { type: 'setDetailLevel'; level: DetailLevel }
  | { type: 'requestDeepen'; stepIndex: number; targetLevel: DetailLevel }
  | { type: 'createTourFromSelection' }
  | { type: 'getSettings' }
  | { type: 'saveSettings'; provider: string; apiKey: string; model: string }
  | { type: 'startTracking' }
  | { type: 'stopTracking' }
  | { type: 'getJournal' }
  | { type: 'explainChange'; changeId: string }
  | { type: 'explainAllPending' }
  | { type: 'clearJournal' }
  | { type: 'goToChange'; changeId: string };

/**
 * Tracked code change
 */
export interface TrackedChange {
  id: string;
  timestamp: string;
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted';
  range: {
    startLine: number;
    endLine: number;
  };
  code: string;
  explanation?: string;
  status: 'pending' | 'explaining' | 'explained' | 'error';
  source?: 'manual' | 'agent' | 'auto';
}

/**
 * Code Journal - session of tracked changes
 */
export interface CodeJournal {
  id: string;
  sessionStart: string;
  sessionEnd?: string;
  title?: string;
  changes: TrackedChange[];
  summary?: string;
  isTracking: boolean;
}
