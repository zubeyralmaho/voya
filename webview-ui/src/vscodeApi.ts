import { WebviewToExtensionMessage, ExtensionToWebviewMessage } from '../../src/core/types';

interface VsCodeApi {
  postMessage(message: WebviewToExtensionMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare global {
  function acquireVsCodeApi(): VsCodeApi;
}

class VSCodeAPIWrapper {
  private readonly vsCodeApi: VsCodeApi | undefined;

  constructor() {
    if (typeof acquireVsCodeApi === 'function') {
      this.vsCodeApi = acquireVsCodeApi();
    }
  }

  public postMessage(message: WebviewToExtensionMessage): void {
    if (this.vsCodeApi) {
      this.vsCodeApi.postMessage(message);
    } else {
      console.log('Message to extension:', message);
    }
  }

  public onMessage(callback: (message: ExtensionToWebviewMessage) => void): () => void {
    const handler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      callback(event.data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }
}

export const vscode = new VSCodeAPIWrapper();
