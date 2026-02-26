import * as vscode from 'vscode';
import { VoyaTour, WebviewToExtensionMessage, ExtensionToWebviewMessage, VoyaStep, DetailLevel } from '../core/types';
import { TourService } from '../services/tourService';
import { llmService } from '../services/llmService';

export class VoyaWebviewProvider {
  public static readonly viewType = 'voya.player';
  
  private panel: vscode.WebviewPanel | undefined;
  private currentTour: VoyaTour | null = null;
  private currentStepIndex = 0;
  private highlightDecoration: vscode.TextEditorDecorationType;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly tourService: TourService
  ) {
    this.highlightDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
      isWholeLine: true
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
        }
      }
    );
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
