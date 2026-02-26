import * as vscode from 'vscode';
import * as path from 'path';
import { VoyaTour, VoyaStep, DetailLevel } from '../core/types';
import { llmService } from './llmService';

export class TourService {
  private readonly voyaDir = '.voya';

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Create a tour using LLM-powered analysis
   */
  async createTour(
    filePath: string,
    selectedText: string,
    startLine: number,
    endLine: number,
    onProgress?: (message: string) => void
  ): Promise<VoyaTour> {
    const tourId = this.generateId();
    const config = vscode.workspace.getConfiguration('voya');
    const detailLevel = config.get<DetailLevel>('defaultDetailLevel', 'general');
    const language = config.get<string>('language', 'en');

    onProgress?.('Analyzing code structure...');

    // Generate tour steps using LLM
    const generatedSteps = await llmService.generateTour({
      code: selectedText,
      filePath,
      startLine,
      endLine,
      detailLevel,
      outputLanguage: language
    });

    onProgress?.('Creating tour steps...');

    // Convert generated steps to VoyaStep format
    const steps: VoyaStep[] = generatedSteps.map((step, index) => ({
      stepIndex: index,
      filePath,
      range: {
        startLine: step.startLine,
        endLine: step.endLine
      },
      content: {
        summary: step.summary,
        explanation: step.explanation
      },
      codeSnippet: this.extractCodeSnippet(selectedText, step.startLine - startLine, step.endLine - startLine)
    }));

    // Generate tour title using LLM or fallback
    const title = await this.generateTourTitle(filePath, selectedText);

    const tour: VoyaTour = {
      id: tourId,
      title,
      createdAt: new Date().toISOString(),
      sourceContext: {
        repository: await this.getRepoName(),
        branch: await this.getBranchName()
      },
      steps
    };

    onProgress?.('Saving tour...');

    // Save the tour
    await this.saveTour(tour);

    return tour;
  }

  /**
   * Extract code snippet for a step
   */
  private extractCodeSnippet(fullCode: string, relativeStart: number, relativeEnd: number): string {
    const lines = fullCode.split('\n');
    return lines.slice(relativeStart, relativeEnd + 1).join('\n');
  }

  /**
   * Generate a descriptive title for the tour
   */
  private async generateTourTitle(filePath: string, code: string): Promise<string> {
    if (!llmService.isConfigured()) {
      return `Tour of ${path.basename(filePath)}`;
    }

    try {
      const response = await llmService.generateExplanation({
        code: code.slice(0, 500), // First 500 chars for context
        filePath,
        startLine: 1,
        endLine: 1,
        detailLevel: 'tldr',
        language: llmService.detectLanguage(filePath)
      });

      // Extract a short title from the response
      const title = response.explanation
        .replace(/^(This code|The code|This|It)\s+/i, '')
        .split(/[.!?\n]/)[0]
        .trim();

      return title.length > 50 ? title.slice(0, 47) + '...' : title;
    } catch {
      return `Tour of ${path.basename(filePath)}`;
    }
  }

  /**
   * Save a tour to the .voya directory
   */
  async saveTour(tour: VoyaTour): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const voyaDirUri = vscode.Uri.joinPath(workspaceFolders[0].uri, this.voyaDir);
    const tourFileUri = vscode.Uri.joinPath(voyaDirUri, `${tour.id}.json`);

    // Ensure .voya directory exists
    try {
      await vscode.workspace.fs.createDirectory(voyaDirUri);
    } catch {
      // Directory might already exist
    }

    const content = Buffer.from(JSON.stringify(tour, null, 2), 'utf-8');
    await vscode.workspace.fs.writeFile(tourFileUri, content);
  }

  /**
   * Load a tour by ID
   */
  async loadTour(tourId: string): Promise<VoyaTour | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return null;

    const tourFileUri = vscode.Uri.joinPath(
      workspaceFolders[0].uri,
      this.voyaDir,
      `${tourId}.json`
    );

    try {
      const content = await vscode.workspace.fs.readFile(tourFileUri);
      return JSON.parse(Buffer.from(content).toString('utf-8')) as VoyaTour;
    } catch {
      return null;
    }
  }

  /**
   * List all saved tours
   */
  async listTours(): Promise<VoyaTour[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return [];

    const voyaDirUri = vscode.Uri.joinPath(workspaceFolders[0].uri, this.voyaDir);

    try {
      const files = await vscode.workspace.fs.readDirectory(voyaDirUri);
      const tours: VoyaTour[] = [];

      for (const [fileName, fileType] of files) {
        if (fileType === vscode.FileType.File && fileName.endsWith('.json')) {
          const tour = await this.loadTour(fileName.replace('.json', ''));
          if (tour) {
            tours.push(tour);
          }
        }
      }

      return tours.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch {
      return [];
    }
  }

  /**
   * Delete a tour
   */
  async deleteTour(tourId: string): Promise<boolean> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return false;

    const tourFileUri = vscode.Uri.joinPath(
      workspaceFolders[0].uri,
      this.voyaDir,
      `${tourId}.json`
    );

    try {
      await vscode.workspace.fs.delete(tourFileUri);
      return true;
    } catch {
      return false;
    }
  }

  private generateId(): string {
    return `tour_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async getRepoName(): Promise<string | undefined> {
    // In a real implementation, this would use git
    return undefined;
  }

  private async getBranchName(): Promise<string | undefined> {
    // In a real implementation, this would use git
    return undefined;
  }
}
