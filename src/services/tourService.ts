import * as vscode from 'vscode';
import * as path from 'path';
import { VoyaTour, VoyaStep } from '../core/types';

export class TourService {
  private readonly voyaDir = '.voya';

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Create a demo tour (placeholder until LLM integration in Phase 2)
   */
  async createDemoTour(
    filePath: string,
    selectedText: string,
    startLine: number,
    endLine: number
  ): Promise<VoyaTour> {
    const tourId = this.generateId();
    const lines = selectedText.split('\n');
    const totalLines = lines.length;
    
    // Create steps by splitting the selection into chunks
    const stepsCount = Math.min(Math.max(1, Math.ceil(totalLines / 5)), 5);
    const linesPerStep = Math.ceil(totalLines / stepsCount);
    
    const steps: VoyaStep[] = [];
    
    for (let i = 0; i < stepsCount; i++) {
      const stepStartOffset = i * linesPerStep;
      const stepEndOffset = Math.min((i + 1) * linesPerStep - 1, totalLines - 1);
      
      steps.push({
        stepIndex: i,
        filePath,
        range: {
          startLine: startLine + stepStartOffset,
          endLine: startLine + stepEndOffset
        },
        content: {
          summary: `Step ${i + 1}: Code Section`,
          explanation: `This section covers lines ${startLine + stepStartOffset} to ${startLine + stepEndOffset}. ` +
            `In Phase 2, this will be replaced with AI-generated explanations that describe what the code does, ` +
            `its purpose, and how it fits into the broader codebase. The teleprompter will smoothly scroll ` +
            `through this explanation while highlighting the relevant code.`
        }
      });
    }

    const tour: VoyaTour = {
      id: tourId,
      title: `Tour of ${path.basename(filePath)}`,
      createdAt: new Date().toISOString(),
      sourceContext: {
        repository: await this.getRepoName(),
        branch: await this.getBranchName()
      },
      steps
    };

    // Save the tour
    await this.saveTour(tour);

    return tour;
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
