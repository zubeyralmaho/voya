import * as vscode from 'vscode';
import { VoyaTour, WebviewToExtensionMessage, ExtensionToWebviewMessage, VoyaStep, DetailLevel, CodeJournal, TrackedChange } from '../core/types';
import { TourService } from '../services/tourService';
import { llmService } from '../services/llmService';
import { getChangeTracker, ChangeTrackerService, CodeChange } from '../services/changeTrackerService';

export class VoyaWebviewProvider {
  public static readonly viewType = 'voya.player';
  
  private panel: vscode.WebviewPanel | undefined;
  private currentTour: VoyaTour | null = null;
  private currentStepIndex = 0;
  private highlightDecoration: vscode.TextEditorDecorationType;
  private changeTracker: ChangeTrackerService;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly tourService: TourService
  ) {
    this.highlightDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
      isWholeLine: true
    });
    
    // Initialize change tracker
    this.changeTracker = getChangeTracker(context);
    
    // Subscribe to change events
    this.changeTracker.onChangeDetected((change) => {
      this.sendMessage({
        type: 'changeDetected',
        change: this.convertToTrackedChange(change)
      });
    });
  }

  public show() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      VoyaWebviewProvider.viewType,
      'Voya Player',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.context.extensionUri, 'dist')
        ]
      }
    );

    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
    this.setupMessageListener();

    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.clearHighlight();
    });
  }

  public revive(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);
    this.setupMessageListener();
  }

  public loadTour(tour: VoyaTour) {
    this.currentTour = tour;
    this.currentStepIndex = 0;
    this.sendMessage({ type: 'tourLoaded', tour });
    this.highlightCurrentStep();
  }

  private setupMessageListener() {
    this.panel?.webview.onDidReceiveMessage(
      async (message: WebviewToExtensionMessage) => {
        switch (message.type) {
          case 'requestTourList':
            const tours = await this.tourService.listTours();
            this.sendMessage({ type: 'tourList', tours });
            break;

          case 'loadTour':
            const tour = await this.tourService.loadTour(message.tourId);
            if (tour) {
              this.loadTour(tour);
            }
            break;

          case 'goToStep':
            this.goToStep(message.stepIndex);
            break;

          case 'nextStep':
            this.goToStep(this.currentStepIndex + 1);
            break;

          case 'prevStep':
            this.goToStep(this.currentStepIndex - 1);
            break;

          case 'play':
            this.sendMessage({ type: 'playbackStateChanged', isPlaying: true });
            break;

          case 'pause':
            this.sendMessage({ type: 'playbackStateChanged', isPlaying: false });
            break;

          case 'setDetailLevel':
            // Detail level is managed in webview state, no action needed here
            break;

          case 'requestDeepen':
            await this.handleDeepenRequest(message.stepIndex, message.targetLevel);
            break;

          case 'getSettings':
            await this.handleGetSettings();
            break;

          case 'saveSettings':
            await this.handleSaveSettings(message.provider, message.apiKey, message.model);
            break;

          // Journal/Tracking messages
          case 'startTracking':
            this.changeTracker.startTracking();
            this.sendMessage({ type: 'trackingStateChanged', isTracking: true });
            this.sendJournalUpdate();
            break;

          case 'stopTracking':
            this.changeTracker.stopTracking();
            this.sendMessage({ type: 'trackingStateChanged', isTracking: false });
            this.sendJournalUpdate();
            break;

          case 'getJournal':
            this.sendJournalUpdate();
            break;

          case 'explainChange':
            await this.handleExplainChange(message.changeId);
            break;

          case 'explainAllPending':
            await this.handleExplainAllPending();
            break;

          case 'clearJournal':
            this.changeTracker.clear();
            this.sendJournalUpdate();
            break;

          case 'goToChange':
            await this.handleGoToChange(message.changeId);
            break;
        }
      }
    );
  }

  /**
   * Get current LLM settings and send to webview
   */
  private async handleGetSettings() {
    const config = vscode.workspace.getConfiguration('voya');
    this.sendMessage({
      type: 'settingsLoaded',
      provider: config.get<string>('llm.provider', 'openai'),
      apiKey: config.get<string>('llm.apiKey', ''),
      model: config.get<string>('llm.model', 'gpt-4-turbo-preview')
    });
  }

  /**
   * Save LLM settings from webview
   */
  private async handleSaveSettings(provider: string, apiKey: string, model: string) {
    const config = vscode.workspace.getConfiguration('voya');
    
    await config.update('llm.provider', provider, vscode.ConfigurationTarget.Global);
    await config.update('llm.apiKey', apiKey, vscode.ConfigurationTarget.Global);
    await config.update('llm.model', model, vscode.ConfigurationTarget.Global);
    
    this.sendMessage({ type: 'settingsSaved' });
    vscode.window.showInformationMessage('Voya settings saved');
  }

  /**
   * Send current journal state to webview
   */
  private sendJournalUpdate() {
    const internalJournal = this.changeTracker.getCurrentJournal();
    const journal: CodeJournal = {
      id: internalJournal?.id || '',
      sessionStart: internalJournal?.sessionStart || new Date().toISOString(),
      sessionEnd: internalJournal?.sessionEnd,
      title: internalJournal?.title,
      changes: this.changeTracker.getChanges().map(c => this.convertToTrackedChange(c)),
      summary: internalJournal?.summary,
      isTracking: !!internalJournal && !internalJournal.sessionEnd
    };
    this.sendMessage({ type: 'journalUpdate', journal });
  }

  /**
   * Convert internal CodeChange to TrackedChange for webview
   */
  private convertToTrackedChange(change: CodeChange): TrackedChange {
    return {
      id: change.id,
      timestamp: change.timestamp,
      filePath: change.filePath,
      changeType: change.changeType,
      range: change.range,
      code: change.code,
      explanation: change.explanation,
      status: change.status,
      source: change.source
    };
  }

  /**
   * Handle explain change request
   */
  private async handleExplainChange(changeId: string) {
    await this.changeTracker.explainChange(changeId);
    
    // Send the updated change
    const changes = this.changeTracker.getChanges();
    const change = changes.find(c => c.id === changeId);
    if (change && change.explanation) {
      this.sendMessage({
        type: 'changeExplained',
        changeId,
        explanation: change.explanation
      });
    }
    
    this.sendJournalUpdate();
  }

  /**
   * Handle explain all pending changes
   */
  private async handleExplainAllPending() {
    const changes = this.changeTracker.getChanges();
    const pending = changes.filter(c => c.status === 'pending');
    
    for (const change of pending) {
      await this.changeTracker.explainChange(change.id);
      
      // Send update after each explanation
      if (change.explanation) {
        this.sendMessage({
          type: 'changeExplained',
          changeId: change.id,
          explanation: change.explanation
        });
      }
    }
    
    this.sendJournalUpdate();
  }

  /**
   * Navigate to a specific change in the editor
   */
  private async handleGoToChange(changeId: string) {
    const changes = this.changeTracker.getChanges();
    const change = changes.find(c => c.id === changeId);
    if (!change) return;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, change.filePath);
    
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
      
      const startLine = Math.max(0, change.range.startLine - 1);
      const endLine = Math.max(0, change.range.endLine - 1);
      const range = new vscode.Range(startLine, 0, endLine, Number.MAX_VALUE);
      
      editor.setDecorations(this.highlightDecoration, [range]);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      console.error('Failed to navigate to change:', error);
    }
  }

  /**
   * Handle request to generate deeper explanation for a step
   */
  private async handleDeepenRequest(stepIndex: number, targetLevel: DetailLevel) {
    if (!this.currentTour) return;
    
    const step = this.currentTour.steps[stepIndex];
    if (!step) return;

    // Check if we already have this detail level cached
    if (step.content.explanations?.[targetLevel]) {
      this.sendMessage({
        type: 'deepenComplete',
        stepIndex,
        detailLevel: targetLevel,
        explanation: step.content.explanations[targetLevel]!
      });
      return;
    }

    // Notify UI that we're starting to load
    this.sendMessage({ type: 'deepenStarted', stepIndex });

    try {
      // Get the code snippet for this step
      const codeSnippet = await this.getCodeSnippet(step);
      
      // Generate explanation using LLM service
      const response = await llmService.generateExplanation({
        code: codeSnippet,
        filePath: step.filePath,
        startLine: step.range.startLine,
        endLine: step.range.endLine,
        detailLevel: targetLevel,
        language: llmService.detectLanguage(step.filePath)
      });

      // Cache the explanation in the tour
      if (!step.content.explanations) {
        step.content.explanations = {};
      }
      step.content.explanations[targetLevel] = response.explanation;

      // Save updated tour
      await this.tourService.saveTour(this.currentTour);

      // Send the explanation to webview
      this.sendMessage({
        type: 'deepenComplete',
        stepIndex,
        detailLevel: targetLevel,
        explanation: response.explanation
      });
    } catch (error) {
      console.error('Failed to generate deeper explanation:', error);
      this.sendMessage({
        type: 'error',
        message: 'Failed to generate explanation. Please try again.'
      });
    }
  }

  /**
   * Get the code snippet for a step from the actual file
   */
  private async getCodeSnippet(step: VoyaStep): Promise<string> {
    if (step.codeSnippet) return step.codeSnippet;

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return '';

    const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, step.filePath);
    
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const startLine = Math.max(0, step.range.startLine - 1);
      const endLine = Math.min(document.lineCount - 1, step.range.endLine - 1);
      
      const range = new vscode.Range(startLine, 0, endLine, Number.MAX_VALUE);
      return document.getText(range);
    } catch {
      return '';
    }
  }

  private goToStep(stepIndex: number) {
    if (!this.currentTour) return;
    
    const maxIndex = this.currentTour.steps.length - 1;
    this.currentStepIndex = Math.max(0, Math.min(stepIndex, maxIndex));
    
    this.sendMessage({ type: 'stepChanged', stepIndex: this.currentStepIndex });
    this.highlightCurrentStep();
  }

  private async highlightCurrentStep() {
    if (!this.currentTour) return;
    
    const step = this.currentTour.steps[this.currentStepIndex];
    if (!step) return;

    // Find or open the file
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, step.filePath);
    
    try {
      const document = await vscode.workspace.openTextDocument(fileUri);
      const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
      
      // Create range for highlighting
      const startLine = Math.max(0, step.range.startLine - 1);
      const endLine = Math.max(0, step.range.endLine - 1);
      const range = new vscode.Range(startLine, 0, endLine, Number.MAX_VALUE);
      
      // Apply highlight decoration
      editor.setDecorations(this.highlightDecoration, [range]);
      
      // Scroll to the highlighted range
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (error) {
      console.error('Failed to highlight step:', error);
    }
  }

  private clearHighlight() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.setDecorations(this.highlightDecoration, []);
    }
  }

  private sendMessage(message: ExtensionToWebviewMessage) {
    this.panel?.webview.postMessage(message);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview.js')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Voya Player</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      height: 100vh;
      overflow: hidden;
    }
    #root {
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
