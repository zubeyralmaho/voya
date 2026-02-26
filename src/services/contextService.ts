import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Represents a symbol in the codebase with its relationships
 */
export interface CodeSymbol {
  name: string;
  kind: vscode.SymbolKind;
  filePath: string;
  range: {
    startLine: number;
    endLine: number;
  };
  children?: CodeSymbol[];
}

/**
 * Import/export relationship between files
 */
export interface FileRelation {
  from: string;
  to: string;
  imports: string[];
}

/**
 * Git information for a code range
 */
export interface GitContext {
  lastModified?: string;
  author?: string;
  commitMessage?: string;
  recentChanges?: Array<{
    date: string;
    message: string;
    author: string;
  }>;
}

/**
 * Complete context for a code selection
 */
export interface CodeContext {
  // The selected code itself
  selection: {
    code: string;
    filePath: string;
    startLine: number;
    endLine: number;
    language: string;
  };
  
  // Symbols defined in the selection
  definedSymbols: CodeSymbol[];
  
  // Symbols referenced/used in the selection
  referencedSymbols: Array<{
    name: string;
    definition?: {
      filePath: string;
      line: number;
      snippet: string;
    };
  }>;
  
  // Files that import this file
  importedBy: string[];
  
  // Files this code imports from
  importsFrom: FileRelation[];
  
  // Git history context
  git?: GitContext;
  
  // Related test files
  testFiles?: string[];
  
  // Project structure context
  projectContext?: {
    packageName?: string;
    framework?: string;
    relevantConfigs?: string[];
  };
}

/**
 * Service for gathering rich context about code selections
 */
export class ContextService {
  private symbolCache: Map<string, CodeSymbol[]> = new Map();
  private fileRelationsCache: Map<string, FileRelation[]> = new Map();

  constructor() {}

  /**
   * Build complete context for a code selection
   */
  async buildContext(
    document: vscode.TextDocument,
    selection: vscode.Selection
  ): Promise<CodeContext> {
    const filePath = this.getRelativePath(document.uri);
    const code = document.getText(selection);
    const language = document.languageId;

    // Gather all context in parallel where possible
    const [
      definedSymbols,
      referencedSymbols,
      fileRelations,
      gitContext,
      testFiles,
      projectContext
    ] = await Promise.all([
      this.getDefinedSymbols(document, selection),
      this.getReferencedSymbols(document, selection),
      this.getFileRelations(document),
      this.getGitContext(document.uri, selection),
      this.findRelatedTestFiles(filePath),
      this.getProjectContext()
    ]);

    return {
      selection: {
        code,
        filePath,
        startLine: selection.start.line + 1,
        endLine: selection.end.line + 1,
        language
      },
      definedSymbols,
      referencedSymbols,
      importedBy: await this.findImportedBy(filePath),
      importsFrom: fileRelations,
      git: gitContext,
      testFiles,
      projectContext
    };
  }

  /**
   * Get symbols defined within the selection
   */
  private async getDefinedSymbols(
    document: vscode.TextDocument,
    selection: vscode.Selection
  ): Promise<CodeSymbol[]> {
    try {
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
      );

      if (!symbols) return [];

      const flatSymbols = this.flattenSymbols(symbols, document.uri);
      
      // Filter to symbols within selection
      return flatSymbols.filter(sym => 
        sym.range.startLine >= selection.start.line + 1 &&
        sym.range.endLine <= selection.end.line + 1
      );
    } catch {
      return [];
    }
  }

  /**
   * Flatten nested document symbols
   */
  private flattenSymbols(
    symbols: vscode.DocumentSymbol[],
    uri: vscode.Uri,
    parent?: string
  ): CodeSymbol[] {
    const result: CodeSymbol[] = [];
    const filePath = this.getRelativePath(uri);

    for (const sym of symbols) {
      const codeSymbol: CodeSymbol = {
        name: parent ? `${parent}.${sym.name}` : sym.name,
        kind: sym.kind,
        filePath,
        range: {
          startLine: sym.range.start.line + 1,
          endLine: sym.range.end.line + 1
        }
      };
      result.push(codeSymbol);

      if (sym.children?.length) {
        result.push(...this.flattenSymbols(sym.children, uri, sym.name));
      }
    }

    return result;
  }

  /**
   * Find symbols that are referenced in the selection
   */
  private async getReferencedSymbols(
    document: vscode.TextDocument,
    selection: vscode.Selection
  ): Promise<Array<{ name: string; definition?: { filePath: string; line: number; snippet: string } }>> {
    const text = document.getText(selection);
    const references: Array<{ name: string; definition?: { filePath: string; line: number; snippet: string } }> = [];
    
    // Extract potential identifiers (simple regex approach)
    const identifierRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
    const seen = new Set<string>();
    let match;

    while ((match = identifierRegex.exec(text)) !== null) {
      const name = match[1];
      
      // Skip common keywords and already seen
      if (seen.has(name) || this.isKeyword(name, document.languageId)) continue;
      seen.add(name);

      // Try to find definition
      try {
        const position = document.positionAt(document.getText().indexOf(name));
        const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
          'vscode.executeDefinitionProvider',
          document.uri,
          position
        );

        if (definitions?.length) {
          const def = definitions[0];
          const defDoc = await vscode.workspace.openTextDocument(def.uri);
          const defLine = defDoc.lineAt(def.range.start.line);
          
          references.push({
            name,
            definition: {
              filePath: this.getRelativePath(def.uri),
              line: def.range.start.line + 1,
              snippet: defLine.text.trim()
            }
          });
        }
      } catch {
        references.push({ name });
      }
    }

    return references.slice(0, 20); // Limit to avoid too much context
  }

  /**
   * Get import/export relationships for a file
   */
  private async getFileRelations(document: vscode.TextDocument): Promise<FileRelation[]> {
    const relations: FileRelation[] = [];
    const text = document.getText();
    const filePath = this.getRelativePath(document.uri);

    // Match import statements (JS/TS)
    const importRegex = /import\s+(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(text)) !== null) {
      const imports = match[1] 
        ? match[1].split(',').map(s => s.trim().split(' as ')[0].trim())
        : [match[2] || match[3]];
      
      relations.push({
        from: filePath,
        to: match[4],
        imports: imports.filter(Boolean)
      });
    }

    // Match require statements
    const requireRegex = /(?:const|let|var)\s+(?:{([^}]+)}|(\w+))\s*=\s*require\(['"]([^'"]+)['"]\)/g;
    
    while ((match = requireRegex.exec(text)) !== null) {
      const imports = match[1]
        ? match[1].split(',').map(s => s.trim())
        : [match[2]];
      
      relations.push({
        from: filePath,
        to: match[3],
        imports: imports.filter(Boolean)
      });
    }

    return relations;
  }

  /**
   * Find files that import the given file
   */
  private async findImportedBy(filePath: string): Promise<string[]> {
    const importers: string[] = [];
    const fileName = path.basename(filePath, path.extname(filePath));
    
    try {
      // Search for files that import this module
      const files = await vscode.workspace.findFiles(
        '**/*.{ts,tsx,js,jsx}',
        '**/node_modules/**',
        100
      );

      for (const file of files) {
        const doc = await vscode.workspace.openTextDocument(file);
        const text = doc.getText();
        
        // Check if this file imports our target
        if (text.includes(fileName) && 
            (text.includes(`from '`) || text.includes(`from "`) || text.includes('require('))) {
          const relativePath = this.getRelativePath(file);
          if (relativePath !== filePath) {
            importers.push(relativePath);
          }
        }
      }
    } catch {
      // Ignore errors
    }

    return importers.slice(0, 10);
  }

  /**
   * Get git context for the selection
   */
  private async getGitContext(
    uri: vscode.Uri,
    selection: vscode.Selection
  ): Promise<GitContext | undefined> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (!gitExtension?.isActive) {
        await gitExtension?.activate();
      }

      const git = gitExtension?.exports?.getAPI(1);
      if (!git) return undefined;

      const repo = git.repositories[0];
      if (!repo) return undefined;

      // Get recent commits for this file
      const log = await repo.log({ maxEntries: 5, path: uri.fsPath });
      
      if (!log?.length) return undefined;

      return {
        lastModified: log[0].commitDate?.toISOString(),
        author: log[0].authorName,
        commitMessage: log[0].message?.split('\n')[0],
        recentChanges: log.slice(0, 3).map((commit: any) => ({
          date: commit.commitDate?.toISOString() || '',
          message: commit.message?.split('\n')[0] || '',
          author: commit.authorName || ''
        }))
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Find test files related to the source file
   */
  private async findRelatedTestFiles(filePath: string): Promise<string[]> {
    const baseName = path.basename(filePath, path.extname(filePath));
    const testPatterns = [
      `**/${baseName}.test.*`,
      `**/${baseName}.spec.*`,
      `**/__tests__/${baseName}.*`,
      `**/test/${baseName}.*`
    ];

    const testFiles: string[] = [];

    for (const pattern of testPatterns) {
      try {
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 5);
        testFiles.push(...files.map(f => this.getRelativePath(f)));
      } catch {
        // Ignore
      }
    }

    return [...new Set(testFiles)];
  }

  /**
   * Get project-level context
   */
  private async getProjectContext(): Promise<CodeContext['projectContext']> {
    try {
      const packageFiles = await vscode.workspace.findFiles('package.json', '**/node_modules/**', 1);
      
      if (!packageFiles.length) return undefined;

      const doc = await vscode.workspace.openTextDocument(packageFiles[0]);
      const pkg = JSON.parse(doc.getText());

      // Detect framework
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      let framework: string | undefined;
      
      if (deps['react']) framework = 'React';
      else if (deps['vue']) framework = 'Vue';
      else if (deps['@angular/core']) framework = 'Angular';
      else if (deps['svelte']) framework = 'Svelte';
      else if (deps['next']) framework = 'Next.js';
      else if (deps['express']) framework = 'Express';

      return {
        packageName: pkg.name,
        framework,
        relevantConfigs: ['tsconfig.json', 'package.json']
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Format context for LLM prompt
   */
  formatForPrompt(context: CodeContext): string {
    const parts: string[] = [];

    // Project context
    if (context.projectContext) {
      parts.push(`## Project Context`);
      if (context.projectContext.packageName) {
        parts.push(`Package: ${context.projectContext.packageName}`);
      }
      if (context.projectContext.framework) {
        parts.push(`Framework: ${context.projectContext.framework}`);
      }
      parts.push('');
    }

    // File relationships
    if (context.importsFrom.length > 0) {
      parts.push(`## Dependencies`);
      parts.push(`This code imports from:`);
      for (const rel of context.importsFrom.slice(0, 5)) {
        parts.push(`- ${rel.to}: { ${rel.imports.join(', ')} }`);
      }
      parts.push('');
    }

    if (context.importedBy.length > 0) {
      parts.push(`## Used By`);
      parts.push(`This module is imported by:`);
      for (const file of context.importedBy.slice(0, 5)) {
        parts.push(`- ${file}`);
      }
      parts.push('');
    }

    // Referenced symbols with definitions
    const externalRefs = context.referencedSymbols.filter(
      s => s.definition && s.definition.filePath !== context.selection.filePath
    );
    
    if (externalRefs.length > 0) {
      parts.push(`## Key Symbol Definitions`);
      for (const ref of externalRefs.slice(0, 8)) {
        if (ref.definition) {
          parts.push(`### ${ref.name} (${ref.definition.filePath}:${ref.definition.line})`);
          parts.push('```');
          parts.push(ref.definition.snippet);
          parts.push('```');
        }
      }
      parts.push('');
    }

    // Git context
    if (context.git) {
      parts.push(`## Recent Changes`);
      if (context.git.lastModified) {
        parts.push(`Last modified: ${context.git.lastModified} by ${context.git.author}`);
      }
      if (context.git.commitMessage) {
        parts.push(`Last commit: "${context.git.commitMessage}"`);
      }
      parts.push('');
    }

    // Test files
    if (context.testFiles?.length) {
      parts.push(`## Related Tests`);
      for (const test of context.testFiles) {
        parts.push(`- ${test}`);
      }
      parts.push('');
    }

    // The actual code
    parts.push(`## Selected Code`);
    parts.push(`File: ${context.selection.filePath}`);
    parts.push(`Lines: ${context.selection.startLine}-${context.selection.endLine}`);
    parts.push(`Language: ${context.selection.language}`);
    parts.push('```' + context.selection.language);
    parts.push(context.selection.code);
    parts.push('```');

    return parts.join('\n');
  }

  /**
   * Check if a word is a language keyword
   */
  private isKeyword(word: string, language: string): boolean {
    const keywords: Record<string, string[]> = {
      typescript: [
        'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum',
        'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
        'return', 'throw', 'try', 'catch', 'finally', 'new', 'delete', 'typeof',
        'instanceof', 'void', 'null', 'undefined', 'true', 'false', 'this', 'super',
        'import', 'export', 'from', 'as', 'default', 'async', 'await', 'yield',
        'static', 'public', 'private', 'protected', 'readonly', 'abstract', 'extends',
        'implements', 'get', 'set', 'string', 'number', 'boolean', 'any', 'unknown'
      ],
      javascript: [
        'const', 'let', 'var', 'function', 'class', 'if', 'else', 'for', 'while',
        'do', 'switch', 'case', 'break', 'continue', 'return', 'throw', 'try',
        'catch', 'finally', 'new', 'delete', 'typeof', 'instanceof', 'void',
        'null', 'undefined', 'true', 'false', 'this', 'super', 'import', 'export',
        'from', 'as', 'default', 'async', 'await', 'yield', 'static', 'get', 'set'
      ]
    };

    const langKeywords = keywords[language] || keywords.javascript || [];
    return langKeywords.includes(word);
  }

  /**
   * Get workspace-relative path
   */
  private getRelativePath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      return path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    }
    return uri.fsPath;
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.symbolCache.clear();
    this.fileRelationsCache.clear();
  }
}

// Singleton instance
export const contextService = new ContextService();
