/**
 * Vibe Square - Analysis Pipeline Orchestrator
 *
 * This is the main entry point for the URL-to-Prompt pipeline.
 * It orchestrates all pipeline stages in sequence:
 *
 * 1. Fetch URL (HTTP)
 * 2. Normalize HTML (cleanup)
 * 3. Parse DOM (jsdom)
 * 4. Structural Analysis (deterministic)
 * 5. Design Interpretation → Final Prompt (OpenAI or Gemini LLM)
 *    LLM generates the production-ready prompt directly
 */

import { fetcher } from './fetcher';
import { normalizer, NormalizationResult } from './normalizer';
import { parser } from './parser';
import { analyzer } from './analyzer';
import { interpreter, LLMModel } from './interpreter';
import {
  AnalysisResult,
  FetchResult,
  RawParsedDOM,
  StructuralAnalysis,
  DesignPromptResult,
  EnhancedParsedDOM,
  VisualParsedDOM,
} from './ir.types';

import { encode } from '@toon-format/toon';
import { UserTier } from './token-budget';

export interface PipelineOptions {
  url: string;
  model?: LLMModel;
  tier?: UserTier;
  useEnhancedParser?: boolean;  // Use enhanced parser with layout/visual signals
  useVisualParser?: boolean;    // Use V2 visual parser (complete redesign)
}

export interface PipelineDebug {
  fetchResult: FetchResult;
  normalizedResult: Omit<NormalizationResult, 'html'>; // Exclude HTML (too large)
  parsedDOM: RawParsedDOM | EnhancedParsedDOM | VisualParsedDOM;
  structuralAnalysis?: StructuralAnalysis;
  designPrompt?: DesignPromptResult;
  parsedDOMTokens?: number;
  parsedDOMTokenTOON?: number;
}

export interface PipelineResult extends AnalysisResult {
  processingTimeMs: number;
  debug?: PipelineDebug;
}

/**
 * Main pipeline execution function
 */

export async function executePipeline(options: PipelineOptions): Promise<PipelineResult> {
  const startTime = Date.now();
  const { url, model = 'gemini-1.5-flash', tier, useEnhancedParser, useVisualParser } = options;

  // Step 1: Fetch URL
  const fetchResult = await fetcher.fetch(url);

  // Step 2: Normalize HTML
  const normalizedResult = await normalizer.clean(fetchResult.html, fetchResult.finalUrl);

  // Standard Parser Path
  const parsedDOM = parser.parse(normalizedResult, fetchResult.finalUrl);

  // Step 4: Structural Analysis (NO AI)
  const structuralAnalysis = analyzer.analyze(parsedDOM);

  // Step 5: Design Interpretation → Final Prompt (OpenAI or Gemini)
  // LLM generates the production-ready prompt directly
  const designPrompt = await interpreter.interpret(parsedDOM, structuralAnalysis, model);

  // Use finalPrompt directly from LLM - no synthesizer needed
  const prompt = designPrompt.finalPrompt;

  const processingTimeMs = Date.now() - startTime;

  return {
    prompt,
    metadata: {
      sourceUrl: fetchResult.finalUrl,
      nodesFound: structuralAnalysis.nodeCount,
      layoutType: structuralAnalysis.layoutType,
      difficulty: structuralAnalysis.difficulty,
      language: parsedDOM.language,
      processingTimeMs,
    },
    processingTimeMs,
  };
}

// Export all pipeline modules for direct access if needed
export { fetcher } from './fetcher';
export { normalizer } from './normalizer';
export { parser } from './parser';
export { analyzer } from './analyzer';
export { interpreter } from './interpreter';

// Export model types and utilities
export type {
  GeminiModel,
  OpenAIModel,
  LLMModel,
  LLMProvider,
} from './interpreter';

export {
  GEMINI_MODELS,
  OPENAI_MODELS,
  ALL_MODELS,
  getProvider,
  isValidModel,
} from './interpreter';

// Export token budget utilities
export { estimateTokens, UserTier, TIER_CONFIGS } from './token-budget';
