Project Overview: Voya
1. Vision & Purpose
Voya is an AI-powered VS Code extension designed to eliminate the "black box" effect of AI-generated code (e.g., GitHub Copilot, Cursor). It transforms static code blocks into interactive, step-by-step visual "tours." By generating playable walkthroughs with scrolling explanations (teleprompter style), Voya empowers developers to quickly understand, review, and master complex codebases and AI-generated logic.

2. Core Features
AI-Driven Code Analysis: Automatically analyzes selected code blocks or Git diffs using LLMs to extract logical steps.

Interactive Playback UI (The Player): A React-based Webview panel featuring a "teleprompter" or marquee style auto-scrolling text for seamless reading.

Editor Synchronization: Automatically highlights code lines and moves the editor cursor as the tour progresses.

Customizable Experience: Supports manual navigation (Next/Prev), autoplay with adjustable speeds, and on-the-fly translations or deeper explanations.

3. High-Level Architecture
Voya operates on a decoupled architecture, ensuring smooth UI performance without blocking the VS Code editor:

Extension Host (Node.js/TypeScript): Handles VS Code API interactions (document changes, cursor movements, text highlighting) and communicates with the LLM.

Webview UI (React): Manages the visual player, state of the current tour, and user interactions.

Messaging Bridge: Uses vscode.postMessage for bidirectional communication between the Host and the Webview.

Storage Layer: Saves generated tours locally in a .voya/ directory within the workspace.

4. High-Level Data Structures
Note: The exact serialization schema for .voya files will be refined later. These are the core TypeScript interfaces driving the application state.

A. The Tour Object (Core Domain Model)

This structure represents the entirely generated tour before it is serialized into a .voya file.

TypeScript
interface VoyaTour {
  id: string;                  // Unique identifier (e.g., UUID or hash)
  title: string;               // Auto-generated title of the tour
  createdAt: string;           // ISO Timestamp
  sourceContext: {
    repository?: string;
    branch?: string;
  };
  steps: VoyaStep[];           // Array of sequential code explanations
}
B. The Step Object (The Playable Unit)

Each step represents a single "scene" in the Voya player.

TypeScript
interface VoyaStep {
  stepIndex: number;           // Sequential order (0, 1, 2...)
  filePath: string;            // Relative path to the file being explained
  range: {
    startLine: number;
    endLine: number;
  };
  content: {
    summary: string;           // Short title for the step (e.g., "Initialize State")
    explanation: string;       // The text that will scroll in the UI
    translation?: string;      // Optional localized text based on user settings
  };
}
C. The Player State (Webview UI State)

This structure manages what the user is currently seeing and interacting with in the Webview panel.

TypeScript
interface PlayerState {
  activeTourId: string | null;
  currentStepIndex: number;
  isPlaying: boolean;          // True if autoplay/teleprompter mode is ON
  playbackSpeed: number;       // Multiplier for scrolling speed (e.g., 1.0, 1.5)
  preferences: {
    language: string;          // e.g., 'en', 'tr'
    detailLevel: 'high' | 'low'; 
  };
}
5. Next Implementation Phases
Phase 1: Scaffolding & Bridge: Initialize the VS Code extension and establish the postMessage bridge between the Extension Host and a basic React Webview.

Phase 2: The LLM Engine: Develop the prompt engineering and API integration to generate VoyaStep arrays from selected text.

Phase 3: The Voya Player: Build the React UI (Play/Pause, Marquee text) and bind it to the VS Code TextEditor API for cursor highlighting.