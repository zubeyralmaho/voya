import * as vscode from 'vscode';
import { VoyaWebviewProvider } from './providers/VoyaWebviewProvider';
import { TourService } from './services/tourService';
import { llmService } from './services/llmService';

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

  // Set API Key command
  context.subscriptions.push(
    vscode.commands.registerCommand('voya.setApiKey', async () => {
      const config = vscode.workspace.getConfiguration('voya');
      const currentProvider = config.get<string>('llm.provider', 'openai');

      const provider = await vscode.window.showQuickPick(
        [
          { label: 'OpenAI', value: 'openai', description: 'GPT-4, GPT-4 Turbo' },
          { label: 'Anthropic', value: 'anthropic', description: 'Claude 3 Opus, Sonnet' }
        ],
        { 
          placeHolder: 'Select LLM provider',
          title: 'Voya: Configure AI Provider'
        }
      );

      if (!provider) return;

      const apiKey = await vscode.window.showInputBox({
        prompt: `Enter your ${provider.label} API key`,
        password: true,
        placeHolder: provider.value === 'openai' ? 'sk-...' : 'sk-ant-...',
        ignoreFocusOut: true
      });

      if (!apiKey) return;

      // Get model suggestion based on provider
      const defaultModel = provider.value === 'openai' 
        ? 'gpt-4-turbo-preview' 
        : 'claude-3-opus-20240229';

      const model = await vscode.window.showInputBox({
        prompt: 'Model to use (press Enter for default)',
        value: defaultModel,
        placeHolder: defaultModel
      });

      // Save configuration
      await config.update('llm.provider', provider.value, vscode.ConfigurationTarget.Global);
      await config.update('llm.apiKey', apiKey, vscode.ConfigurationTarget.Global);
      if (model) {
        await config.update('llm.model', model, vscode.ConfigurationTarget.Global);
      }

      vscode.window.showInformationMessage(`Voya configured with ${provider.label}! You can now create AI-powered tours.`);
    })
  );

  // Create Tour command with progress
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

      // Check if LLM is configured, offer to configure if not
      if (!llmService.isConfigured()) {
        const configure = await vscode.window.showWarningMessage(
          'No LLM API key configured. Tour will use placeholder explanations.',
          'Configure Now',
          'Continue Anyway'
        );

        if (configure === 'Configure Now') {
          await vscode.commands.executeCommand('voya.setApiKey');
          return;
        }

        if (!configure) return;
      }

      // Create tour with progress indicator
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Creating Voya Tour',
          cancellable: false
        },
        async (progress) => {
          try {
            progress.report({ message: 'Gathering context...' });

            // Use new context-aware tour creation
            const tour = await tourService.createTour(
              editor.document,
              selection,
              (message: string) => progress.report({ message })
            );

            // Show the player with the new tour
            webviewProvider.show();
            webviewProvider.loadTour(tour);

            vscode.window.showInformationMessage(
              `Tour "${tour.title}" created with ${tour.steps.length} steps!`
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`Failed to create tour: ${errorMessage}`);
          }
        }
      );
    })
  );
}

export function deactivate() {
  console.log('Voya extension is now deactivated');
}
