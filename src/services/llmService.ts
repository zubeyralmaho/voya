import * as vscode from 'vscode';
import { DetailLevel } from '../core/types';

/**
 * System prompts for different detail levels
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
 * Language instructions for localized explanations
 */
const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: '',
  tr: '\n\nIMPORTANT: Write your explanation in Turkish (Türkçe).',
  de: '\n\nIMPORTANT: Write your explanation in German (Deutsch).',
  fr: '\n\nIMPORTANT: Write your explanation in French (Français).',
  es: '\n\nIMPORTANT: Write your explanation in Spanish (Español).',
  zh: '\n\nIMPORTANT: Write your explanation in Chinese (中文).',
  ja: '\n\nIMPORTANT: Write your explanation in Japanese (日本語).',
  ko: '\n\nIMPORTANT: Write your explanation in Korean (한국어).'
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
  outputLanguage?: string;
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

export interface TourGenerationRequest {
  code: string;
  filePath: string;
  startLine: number;
  endLine: number;
  detailLevel: DetailLevel;
  outputLanguage?: string;
  additionalContext?: string;
}

export interface GeneratedStep {
  summary: string;
  explanation: string;
  startLine: number;
  endLine: number;
}

type LLMProvider = 'openai' | 'anthropic';

/**
 * LLM Service for generating code explanations
 * Supports OpenAI and Anthropic APIs
 */
export class LLMService {
  private getConfig() {
    const config = vscode.workspace.getConfiguration('voya');
    return {
      provider: config.get<LLMProvider>('llm.provider', 'openai'),
      apiKey: config.get<string>('llm.apiKey', ''),
      model: config.get<string>('llm.model', 'gpt-4-turbo-preview'),
      language: config.get<string>('language', 'en'),
      detailLevel: config.get<DetailLevel>('defaultDetailLevel', 'general')
    };
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    const { apiKey } = this.getConfig();
    return apiKey.length > 0;
  }

  /**
   * Build the full prompt for the LLM
   */
  buildPrompt(request: LLMRequest): { system: string; user: string } {
    const config = this.getConfig();
    let system = SYSTEM_PROMPTS[request.detailLevel];
    
    // Add language-specific context if detected
    if (request.language && LANGUAGE_CONTEXT[request.language]) {
      system += `\n\n${LANGUAGE_CONTEXT[request.language]}`;
    }

    // Add output language instruction
    const outputLang = request.outputLanguage || config.language;
    if (outputLang && LANGUAGE_INSTRUCTIONS[outputLang]) {
      system += LANGUAGE_INSTRUCTIONS[outputLang];
    }

    const user = `File: ${request.filePath} (lines ${request.startLine}-${request.endLine})

\`\`\`
${request.code}
\`\`\`${request.additionalContext ? `\n\nAdditional context: ${request.additionalContext}` : ''}`;

    return { system, user };
  }

  /**
   * Generate explanation for code
   */
  async generateExplanation(request: LLMRequest): Promise<LLMResponse> {
    const config = this.getConfig();

    if (!this.isConfigured()) {
      return this.generateStubResponse(request);
    }

    const { system, user } = this.buildPrompt(request);

    try {
      if (config.provider === 'anthropic') {
        return await this.callAnthropicAPI(system, user, config.apiKey, config.model);
      } else {
        return await this.callOpenAIAPI(system, user, config.apiKey, config.model);
      }
    } catch (error) {
      console.error('LLM API error:', error);
      throw error;
    }
  }

  /**
   * Generate a complete tour from code selection
   * This analyzes the code and creates logical steps
   */
  async generateTour(request: TourGenerationRequest): Promise<GeneratedStep[]> {
    const config = this.getConfig();

    if (!this.isConfigured()) {
      return this.generateStubSteps(request);
    }

    const contextSection = request.additionalContext 
      ? `\n\nUse this additional context to provide better explanations:\n${request.additionalContext}`
      : '';

    const system = `You are a code tour generator. Your task is to analyze code and break it down into logical, sequential steps for a guided walkthrough.

For the given code, identify 2-6 logical sections that should be explained separately. Each section should represent a coherent unit of functionality.

Respond ONLY with valid JSON in this exact format (no markdown, no explanation):
{
  "steps": [
    {
      "summary": "Short title for this step (3-7 words)",
      "explanation": "Clear explanation of what this code section does (2-4 paragraphs)",
      "startLine": <number>,
      "endLine": <number>
    }
  ]
}

Guidelines:
- Line numbers are relative to the provided code snippet (starting from 1)
- Each step should cover a logical unit (function, class, block, etc.)
- Summaries should be concise and action-oriented
- Explanations should be suitable for a teleprompter-style reading
- Steps should flow naturally from one to the next
- Use the provided context about imports, dependencies, and related code to enrich explanations
- Mention how this code relates to other parts of the codebase when relevant${LANGUAGE_INSTRUCTIONS[request.outputLanguage || config.language] || ''}`;

    const user = `Analyze this code and generate tour steps:

File: ${request.filePath} (lines ${request.startLine}-${request.endLine})

\`\`\`
${request.code}
\`\`\`${contextSection}`;

    try {
      let response: LLMResponse;
      
      if (config.provider === 'anthropic') {
        response = await this.callAnthropicAPI(system, user, config.apiKey, config.model);
      } else {
        response = await this.callOpenAIAPI(system, user, config.apiKey, config.model);
      }

      // Parse the JSON response
      const parsed = JSON.parse(response.explanation);
      
      // Adjust line numbers to be absolute
      return parsed.steps.map((step: GeneratedStep) => ({
        ...step,
        startLine: request.startLine + step.startLine - 1,
        endLine: request.startLine + step.endLine - 1
      }));
    } catch (error) {
      console.error('Failed to generate tour:', error);
      return this.generateStubSteps(request);
    }
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAIAPI(
    system: string,
    user: string,
    apiKey: string,
    model: string
  ): Promise<LLMResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.3,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      explanation: data.choices[0].message.content,
      tokens: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0
      }
    };
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropicAPI(
    system: string,
    user: string,
    apiKey: string,
    model: string
  ): Promise<LLMResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4096,
        system: system,
        messages: [
          { role: 'user', content: user }
        ]
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      explanation: data.content[0].text,
      tokens: {
        prompt: data.usage?.input_tokens || 0,
        completion: data.usage?.output_tokens || 0
      }
    };
  }

  /**
   * Generate stub response when no API key is configured
   */
  private generateStubResponse(request: LLMRequest): LLMResponse {
    const levelDescriptions: Record<DetailLevel, string> = {
      tldr: `This code handles ${request.filePath.split('/').pop()} logic (lines ${request.startLine}-${request.endLine}).`,
      
      general: `This section of code in ${request.filePath} (lines ${request.startLine}-${request.endLine}) implements core functionality for the module.

The code follows a clear pattern: it initializes necessary state, processes the input data, and returns the transformed result. Key functions work together to ensure data integrity throughout the pipeline.

⚠️ To get AI-powered explanations, configure your API key in VS Code settings:
1. Open Settings (Cmd+,)
2. Search for "voya"  
3. Set your OpenAI or Anthropic API key`,
      
      detailed: `## Overview
This code block in ${request.filePath} spans lines ${request.startLine} to ${request.endLine}.

## How to Enable AI Analysis
To receive intelligent, context-aware explanations:

1. **Get an API Key**: Sign up at OpenAI (platform.openai.com) or Anthropic (console.anthropic.com)
2. **Configure Voya**: 
   - Open VS Code Settings (Cmd+,)
   - Search for "voya.llm"
   - Set your API key and preferred provider
3. **Create a New Tour**: The next tour you create will use AI-powered analysis

## Supported Providers
- **OpenAI**: GPT-4, GPT-4 Turbo (recommended for code)
- **Anthropic**: Claude 3 Opus, Claude 3 Sonnet`,
      
      extreme_detail: `# Demo Mode - AI Not Configured

This is a placeholder explanation. To unlock the full power of Voya's AI-driven code analysis:

## Quick Setup Guide

### Step 1: Choose Your Provider
- **OpenAI GPT-4**: Best for detailed code analysis, supports function calling
- **Anthropic Claude 3**: Excellent for nuanced explanations, 200K context window

### Step 2: Get API Key
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/

### Step 3: Configure Voya
Open VS Code settings and search for "voya":

\`\`\`json
{
  "voya.llm.provider": "openai",
  "voya.llm.apiKey": "your-api-key-here",
  "voya.llm.model": "gpt-4-turbo-preview"
}
\`\`\`

### Step 4: Create Your First AI Tour
Select code → Right click → "Voya: Create Tour from Selection"

---
File: ${request.filePath}
Lines: ${request.startLine}-${request.endLine}`
    };

    return {
      explanation: levelDescriptions[request.detailLevel],
      summary: `Analysis of ${request.filePath}`,
      tokens: { prompt: 0, completion: 0 }
    };
  }

  /**
   * Generate stub steps for tour when no API key is configured
   */
  private generateStubSteps(request: TourGenerationRequest): GeneratedStep[] {
    const lines = request.code.split('\n');
    const totalLines = lines.length;
    const stepsCount = Math.min(Math.max(2, Math.ceil(totalLines / 10)), 5);
    const linesPerStep = Math.ceil(totalLines / stepsCount);

    const steps: GeneratedStep[] = [];
    
    for (let i = 0; i < stepsCount; i++) {
      const stepStartLine = request.startLine + (i * linesPerStep);
      const stepEndLine = Math.min(request.startLine + ((i + 1) * linesPerStep) - 1, request.endLine);

      steps.push({
        summary: i === 0 ? 'Introduction & Setup' : 
                 i === stepsCount - 1 ? 'Wrapping Up' : 
                 `Section ${i + 1}: Core Logic`,
        explanation: i === 0 
          ? `Welcome to this code tour! This walkthrough will guide you through the code in ${request.filePath}.

To enable AI-powered explanations that analyze your actual code:
1. Open VS Code Settings (Cmd+,)
2. Search for "voya.llm.apiKey"
3. Enter your OpenAI or Anthropic API key

Let's begin exploring this code section by section.`
          : `This section covers lines ${stepStartLine} to ${stepEndLine}. 

When AI analysis is enabled, you'll see:
- Detailed explanation of what this code does
- Why certain patterns or approaches were chosen
- How this section connects to the rest of the codebase
- Potential edge cases or considerations

Configure your LLM API key to unlock these insights!`,
        startLine: stepStartLine,
        endLine: stepEndLine
      });
    }

    return steps;
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
      'kt': 'kotlin',
      'vue': 'vue',
      'rb': 'ruby',
      'php': 'php',
      'cs': 'csharp',
      'scala': 'scala'
    };
    return ext ? languageMap[ext] : undefined;
  }
}

// Singleton instance
export const llmService = new LLMService();
