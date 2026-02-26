import { DetailLevel } from '../core/types';

/**
 * System prompts for different detail levels
 * These instruct the LLM how to explain code based on user's needs
 */
export const SYSTEM_PROMPTS: Record<DetailLevel, string> = {
  tldr: `You are a code explanation assistant for senior engineers doing quick code reviews.
Your task: Provide a ONE SENTENCE summary of what this code does.
- Be extremely concise
- Focus only on the primary purpose
- Assume the reader is an experienced developer
- No code examples, no setup instructions
Format: Just the single sentence, nothing else.`,

  general: `You are a code explanation assistant helping developers understand codebases.
Your task: Provide a clear, digestible explanation of this code.
Guidelines:
- 2-4 paragraphs maximum
- Explain the main purpose and how it works
- Mention key functions/methods and their roles
- Note any important patterns or practices used
- Keep it accessible but not dumbed down
Format: Flowing prose, easy to read in a teleprompter-style UI.`,

  detailed: `You are a code explanation assistant for developers learning or debugging code.
Your task: Provide an in-depth analysis of this code.
Guidelines:
- Explain the purpose and context
- Break down the logic step by step
- Explain WHY certain approaches were chosen
- Mention relevant design patterns
- Note any edge cases or important considerations
- Explain how this code fits into larger systems
Format: Well-structured explanation with clear sections.`,

  extreme_detail: `You are a meticulous code explanation assistant for deep learning and debugging.
Your task: Provide an exhaustive, line-by-line analysis of this code.
Guidelines:
- Start with a high-level overview
- Then analyze each significant line or block
- Explain every function call, variable, and operation
- Discuss performance implications
- Explain memory/resource considerations
- Detail error handling and edge cases
- Explain architectural decisions and their tradeoffs
- Mention any potential improvements or gotchas
- Reference relevant documentation or best practices
Format: Comprehensive breakdown, suitable for someone who needs to deeply understand every aspect.`
};

/**
 * Language-specific context additions for prompts
 */
export const LANGUAGE_CONTEXT: Record<string, string> = {
  typescript: 'This is TypeScript code. Pay attention to type annotations, interfaces, and generics.',
  javascript: 'This is JavaScript code. Note any ES6+ features being used.',
  python: 'This is Python code. Note any pythonic patterns, decorators, or type hints.',
  rust: 'This is Rust code. Pay special attention to ownership, borrowing, and lifetime annotations.',
  go: 'This is Go code. Note goroutines, channels, and error handling patterns.',
  c: 'This is C code. Pay attention to memory management, pointers, and potential safety issues.',
  cpp: 'This is C++ code. Note RAII patterns, smart pointers, and STL usage.',
  java: 'This is Java code. Note OOP patterns, annotations, and framework usage.',
  swift: 'This is Swift code. Note optionals, protocols, and memory management.',
  kotlin: 'This is Kotlin code. Note null safety, coroutines, and extension functions.',
  react: 'This appears to be React code. Focus on component lifecycle, hooks, and state management.',
  vue: 'This appears to be Vue.js code. Focus on reactivity, composition API, and component structure.'
};

export interface LLMRequest {
  code: string;
  filePath: string;
  startLine: number;
  endLine: number;
  detailLevel: DetailLevel;
  language?: string;
  additionalContext?: string;
}

export interface LLMResponse {
  explanation: string;
  summary?: string;
  tokens?: {
    prompt: number;
    completion: number;
  };
}

/**
 * LLM Service for generating code explanations
 * This is a stub that will be connected to actual LLM APIs in Phase 2
 */
export class LLMService {
  private apiKey: string | null = null;
  private model: string = 'gpt-4';

  constructor() {
    // API key will be configured via VS Code settings
  }

  /**
   * Configure the LLM service
   */
  configure(apiKey: string, model?: string): void {
    this.apiKey = apiKey;
    if (model) this.model = model;
  }

  /**
   * Build the full prompt for the LLM
   */
  buildPrompt(request: LLMRequest): { system: string; user: string } {
    let system = SYSTEM_PROMPTS[request.detailLevel];
    
    // Add language-specific context if detected
    if (request.language && LANGUAGE_CONTEXT[request.language]) {
      system += `\n\n${LANGUAGE_CONTEXT[request.language]}`;
    }

    const user = `File: ${request.filePath} (lines ${request.startLine}-${request.endLine})

\`\`\`
${request.code}
\`\`\`${request.additionalContext ? `\n\nAdditional context: ${request.additionalContext}` : ''}`;

    return { system, user };
  }

  /**
   * Generate explanation for code
   * Currently returns a stub response - will integrate with actual LLM API
   */
  async generateExplanation(request: LLMRequest): Promise<LLMResponse> {
    const { system, user } = this.buildPrompt(request);

    // TODO: Replace with actual LLM API call in Phase 2
    // For now, return a detailed stub based on detail level
    
    if (!this.apiKey) {
      return this.generateStubResponse(request);
    }

    // Placeholder for actual API integration
    // This will support:
    // - OpenAI GPT-4 / GPT-4 Turbo
    // - Anthropic Claude
    // - VS Code's built-in Copilot API (if available)
    
    try {
      // const response = await this.callLLMAPI(system, user);
      // return response;
      return this.generateStubResponse(request);
    } catch (error) {
      console.error('LLM API error:', error);
      return this.generateStubResponse(request);
    }
  }

  /**
   * Generate a stub response for testing without API key
   */
  private generateStubResponse(request: LLMRequest): LLMResponse {
    const levelDescriptions: Record<DetailLevel, string> = {
      tldr: `This code handles ${request.filePath.split('/').pop()} logic (lines ${request.startLine}-${request.endLine}).`,
      
      general: `This section of code in ${request.filePath} (lines ${request.startLine}-${request.endLine}) implements core functionality for the module.

The code follows a clear pattern: it initializes necessary state, processes the input data, and returns the transformed result. Key functions work together to ensure data integrity throughout the pipeline.

This is a placeholder explanation. Once you configure an LLM API key in settings, Voya will generate intelligent, context-aware explanations tailored to your selected detail level.`,
      
      detailed: `## Overview
This code block in ${request.filePath} spans lines ${request.startLine} to ${request.endLine} and serves as a critical component in the application architecture.

## Purpose
The primary purpose of this code is to [placeholder - LLM will analyze actual purpose]. It acts as an intermediary between the data layer and the presentation layer.

## Key Components
- **Initialization**: Sets up required state and dependencies
- **Processing Logic**: Transforms input according to business rules
- **Error Handling**: Manages edge cases and failure scenarios

## Design Decisions
The code employs [placeholder] pattern which provides benefits for maintainability and testability.

---
*This is a placeholder. Configure LLM settings for real analysis.*`,
      
      extreme_detail: `# Comprehensive Code Analysis
**File**: ${request.filePath}
**Lines**: ${request.startLine}-${request.endLine}

## Executive Summary
This code section is responsible for [placeholder functionality]. It represents a critical path in the application's execution flow.

## Line-by-Line Breakdown

### Initialization Phase
The first few lines establish the execution context. Variables are declared with appropriate scope to prevent memory leaks and ensure garbage collection efficiency.

### Core Logic
The main algorithm employs [placeholder pattern]. Each operation is designed to be:
- **Idempotent**: Safe to retry without side effects
- **Isolated**: Minimal coupling with external state
- **Observable**: Easy to debug and monitor

### Error Boundaries
Exception handling follows the fail-fast principle. Errors are caught at appropriate boundaries and transformed into domain-specific exceptions.

## Performance Considerations
- Time Complexity: O(n) where n is [placeholder]
- Space Complexity: O(1) auxiliary space
- Memory allocation is minimized through [placeholder technique]

## Potential Improvements
1. Consider extracting [placeholder] into a separate utility
2. The [placeholder] could benefit from caching
3. Error messages could be more descriptive

## Related Patterns
- This implementation resembles the [placeholder] pattern
- Similar approaches can be found in [placeholder] libraries

---
*This is a detailed placeholder. To receive actual AI-powered analysis, please configure your LLM API key in VS Code settings (voya.llm.apiKey).*`
    };

    return {
      explanation: levelDescriptions[request.detailLevel],
      summary: `Analysis of ${request.filePath}`,
      tokens: { prompt: 0, completion: 0 }
    };
  }

  /**
   * Detect programming language from file extension
   */
  detectLanguage(filePath: string): string | undefined {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'rs': 'rust',
      'go': 'go',
      'c': 'c',
      'h': 'c',
      'cpp': 'cpp',
      'cc': 'cpp',
      'hpp': 'cpp',
      'java': 'java',
      'swift': 'swift',
      'kt': 'kotlin'
    };
    return ext ? languageMap[ext] : undefined;
  }
}

// Singleton instance
export const llmService = new LLMService();
