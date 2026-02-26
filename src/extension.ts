import * as vscode from 'vscode';
import { VoyaWebviewProvider } from './providers/VoyaWebviewProvider';
import { TourService } from './services/tourService';

let tourService: TourService;

export function activate(context: vscode.ExtensionContext) {
  console.log('Voya extension is now active');

  // Initialize services
  tourService = new TourService(context);

  // Create webview provider
  const webviewProvider = new VoyaWebviewProvider(context, tourService);

  // Register the webview panel serializer for persistence
  context.subscriptions.push(
    vscode.window.registerWebviewPanelSerializer(VoyaWebviewProvider.viewType, {
      async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
        webviewProvider.revive(webviewPanel);
      }
    })
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('voya.openPlayer', () => {
      webviewProvider.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('voya.createTour', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showErrorMessage('Please select some code first');
        return;
      }

      const selectedText = editor.document.getText(selection);
      const filePath = vscode.workspace.asRelativePath(editor.document.uri);
      
      // Create a demo tour for now (LLM integration comes in Phase 2)
      const tour = await tourService.createDemoTour(
        filePath,
        selectedText,
        selection.start.line + 1,
        selection.end.line + 1
      );

      // Show the player with the new tour
      webviewProvider.show();
      webviewProvider.loadTour(tour);

      vscode.window.showInformationMessage(`Tour "${tour.title}" created!`);
    })
  );
}

export function deactivate() {
  console.log('Voya extension is now deactivated');
}
