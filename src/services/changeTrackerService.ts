import * as vscode from 'vscode';
import * as path from 'path';
import { llmService } from './llmService';

/**
 * Represents a tracked code change
 */
export interface CodeChange {
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
 * Code Journal entry - a session of changes
 */
export interface JournalEntry {
  id: string;
  sessionStart: string;
  sessionEnd?: string;
  title?: string;
  changes: CodeChange[];
  summary?: string;
}

/**
 * Service for tracking code changes and maintaining a code journal
 */
export class ChangeTrackerService {
  private changes: Map<string, CodeChange> = new Map();
  private currentJournal: JournalEntry | null = null;
  private fileWatchers: vscode.FileSystemWatcher[] = [];
  private documentChangeListener: vscode.Disposable | null = null;
  private pendingChanges: Map<string, NodeJS.Timeout> = new Map();
  private isTracking = false;
  
  // Debounce time for grouping rapid changes
  private readonly DEBOUNCE_MS = 2000;
  
  // Callbacks for UI updates
  private onChangeCallbacks: ((change: CodeChange) => void)[] = [];
  private onJournalUpdateCallbacks: ((journal: JournalEntry) => void)[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Start tracking changes in the workspace
   */
  startTracking() {
    if (this.isTracking) return;
    this.isTracking = true;

    // Start a new journal session
    this.currentJournal = {
      id: this.generateId(),
      sessionStart: new Date().toISOString(),
      changes: []
    };

    // Watch for document changes (typing, pasting, agent additions)
    this.documentChangeListener = vscode.workspace.onDidChangeTextDocument(
      (event) => this.handleDocumentChange(event)
    );

    // Watch for file saves
    const saveWatcher = vscode.workspace.onDidSaveTextDocument(
      (document) => this.handleFileSave(document)
    );
    this.context.subscriptions.push(saveWatcher);

    console.log('Voya: Change tracking started');
  }

  /**
   * Stop tracking and finalize journal
   */
  stopTracking(): JournalEntry | null {
    if (!this.isTracking) return null;
    this.isTracking = false;

    // Clean up listeners
    this.documentChangeListener?.dispose();
    this.fileWatchers.forEach(w => w.dispose());
    this.fileWatchers = [];

    // Clear pending debounced changes
    this.pendingChanges.forEach(timeout => clearTimeout(timeout));
    this.pendingChanges.clear();

    // Finalize journal
    if (this.currentJournal) {
      this.currentJournal.sessionEnd = new Date().toISOString();
      const journal = this.currentJournal;
      this.currentJournal = null;
      return journal;
    }

    return null;
  }

  /**
   * Handle document text changes
   */
  private async handleDocumentChange(event: vscode.TextDocumentChangeEvent) {
    // Ignore output/debug panels and non-file schemes
    if (event.document.uri.scheme !== 'file') return;
    
    // Ignore if no actual content changes
    if (event.contentChanges.length === 0) return;

    // Skip certain file types
    const filePath = event.document.uri.fsPath;
    if (this.shouldIgnoreFile(filePath)) return;

    // Process each content change
    for (const change of event.contentChanges) {
      // Only track additions (not deletions for now)
      if (change.text.trim().length === 0) continue;
      
      // Skip tiny changes (single characters while typing)
      const lines = change.text.split('\n');
      if (lines.length === 1 && change.text.length < 10) continue;

      // Create a change ID based on file and position
      const changeKey = `${filePath}:${change.range.start.line}`;
      
      // Debounce rapid changes to the same location
      if (this.pendingChanges.has(changeKey)) {
        clearTimeout(this.pendingChanges.get(changeKey));
      }

      this.pendingChanges.set(changeKey, setTimeout(() => {
        this.processChange(event.document, change);
        this.pendingChanges.delete(changeKey);
      }, this.DEBOUNCE_MS));
    }
  }

  /**
   * Process a detected code change
   */
  private async processChange(
    document: vscode.TextDocument,
    change: vscode.TextDocumentContentChangeEvent
  ) {
    const filePath = this.getRelativePath(document.uri);
    const startLine = change.range.start.line + 1;
    const endLine = startLine + change.text.split('\n').length - 1;

    // Determine if this looks like an agent-generated change
    // Heuristics: multi-line, structured, appears suddenly
    const isLikelyAgent = this.detectAgentChange(change.text);

    const codeChange: CodeChange = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      filePath,
      changeType: 'added',
      range: { startLine, endLine },
      code: change.text,
      status: 'pending',
      source: isLikelyAgent ? 'agent' : 'manual'
    };

    this.changes.set(codeChange.id, codeChange);
    
    if (this.currentJournal) {
      this.currentJournal.changes.push(codeChange);
    }

    // Notify listeners - UI will show the change, user decides when to explain
    this.notifyChangeListeners(codeChange);
    this.notifyJournalListeners();
  }

  /**
   * Handle file save - good time to process any pending explanations
   */
  private async handleFileSave(document: vscode.TextDocument) {
    // Could trigger batch explanation of pending changes here
    const pending = Array.from(this.changes.values())
      .filter(c => c.status === 'pending' && c.filePath === this.getRelativePath(document.uri));
    
    for (const change of pending) {
      await this.explainChange(change.id);
    }
  }

  /**
   * Detect if a change looks like it came from an AI agent
   */
  private detectAgentChange(text: string): boolean {
    // Heuristics for detecting agent-generated code:
    
    // 1. Multi-line with consistent indentation
    const lines = text.split('\n');
    if (lines.length < 3) return false;

    // 2. Contains common code patterns (functions, classes, imports)
    const codePatterns = [
      /^(export\s+)?(async\s+)?function\s+/m,
      /^(export\s+)?class\s+/m,
      /^(export\s+)?interface\s+/m,
      /^(export\s+)?const\s+\w+\s*[=:]/m,
      /^import\s+/m,
      /^\/\*\*/m,  // JSDoc
      /^\s*\/\//m, // Comments
    ];

    const hasCodePattern = codePatterns.some(p => p.test(text));
    
    // 3. Well-structured (has matching braces, proper indentation)
    const openBraces = (text.match(/\{/g) || []).length;
    const closeBraces = (text.match(/\}/g) || []).length;
    const isBalanced = openBraces === closeBraces;

    // 4. Contains multiple statements or declarations
    const statements = (text.match(/[;{}]\s*$/gm) || []).length;
    const hasMultipleStatements = statements >= 2;

    return hasCodePattern && isBalanced && (hasMultipleStatements || lines.length >= 5);
  }

  /**
   * Generate explanation for a specific change
   */
  async explainChange(changeId: string): Promise<void> {
    const change = this.changes.get(changeId);
    if (!change || change.status === 'explaining' || change.status === 'explained') {
      return;
    }

    change.status = 'explaining';
    this.notifyChangeListeners(change);

    try {
      // Get the document for context
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) throw new Error('No workspace');

      const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, change.filePath);
      
      // Generate explanation
      const response = await llmService.generateExplanation({
        code: change.code,
        filePath: change.filePath,
        startLine: change.range.startLine,
        endLine: change.range.endLine,
        detailLevel: 'general',
        language: llmService.detectLanguage(change.filePath),
        additionalContext: `This code was just ${change.source === 'agent' ? 'generated by an AI assistant' : 'written'}. Explain what it does and why it might have been added.`
      });

      change.explanation = response.explanation;
      change.status = 'explained';
    } catch (error) {
      console.error('Failed to explain change:', error);
      change.status = 'error';
    }

    this.notifyChangeListeners(change);
    this.notifyJournalListeners();
  }

  /**
   * Get all tracked changes
   */
  getChanges(): CodeChange[] {
    return Array.from(this.changes.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get current journal
   */
  getCurrentJournal(): JournalEntry | null {
    return this.currentJournal;
  }

  /**
   * Generate summary for the current journal session
   */
  async generateJournalSummary(): Promise<string> {
    if (!this.currentJournal || this.currentJournal.changes.length === 0) {
      return 'No changes recorded in this session.';
    }

    const explainedChanges = this.currentJournal.changes.filter(c => c.explanation);
    
    if (explainedChanges.length === 0) {
      return `${this.currentJournal.changes.length} changes recorded, pending explanation.`;
    }

    // Create a summary of all changes
    const changesSummary = explainedChanges
      .map(c => `- ${c.filePath} (lines ${c.range.startLine}-${c.range.endLine}): ${c.explanation?.split('.')[0]}`)
      .join('\n');

    try {
      const response = await llmService.generateExplanation({
        code: changesSummary,
        filePath: 'session-summary',
        startLine: 1,
        endLine: 1,
        detailLevel: 'tldr',
        language: 'markdown',
        additionalContext: 'Summarize these code changes into a brief session overview.'
      });

      this.currentJournal.summary = response.explanation;
      return response.explanation;
    } catch {
      return `Session with ${explainedChanges.length} explained changes across ${new Set(explainedChanges.map(c => c.filePath)).size} files.`;
    }
  }

  /**
   * Subscribe to change notifications
   */
  onChangeDetected(callback: (change: CodeChange) => void): vscode.Disposable {
    this.onChangeCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const index = this.onChangeCallbacks.indexOf(callback);
      if (index >= 0) this.onChangeCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to journal updates
   */
  onJournalUpdate(callback: (journal: JournalEntry) => void): vscode.Disposable {
    this.onJournalUpdateCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const index = this.onJournalUpdateCallbacks.indexOf(callback);
      if (index >= 0) this.onJournalUpdateCallbacks.splice(index, 1);
    });
  }

  private notifyChangeListeners(change: CodeChange) {
    this.onChangeCallbacks.forEach(cb => cb(change));
  }

  private notifyJournalListeners() {
    if (this.currentJournal) {
      this.onJournalUpdateCallbacks.forEach(cb => cb(this.currentJournal!));
    }
  }

  /**
   * Check if file should be ignored
   */
  private shouldIgnoreFile(filePath: string): boolean {
    const ignorePatterns = [
      /node_modules/,
      /\.git/,
      /dist\//,
      /build\//,
      /\.voya\//,
      /\.next\//,
      /package-lock\.json/,
      /yarn\.lock/,
      /\.min\./,
      /\.map$/,
    ];
    return ignorePatterns.some(p => p.test(filePath));
  }

  private getRelativePath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      return path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    }
    return uri.fsPath;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all tracked changes
   */
  clear() {
    this.changes.clear();
    if (this.currentJournal) {
      this.currentJournal.changes = [];
    }
  }
}

// Singleton instance
let changeTrackerInstance: ChangeTrackerService | null = null;

export function getChangeTracker(context: vscode.ExtensionContext): ChangeTrackerService {
  if (!changeTrackerInstance) {
    changeTrackerInstance = new ChangeTrackerService(context);
  }
  return changeTrackerInstance;
}
