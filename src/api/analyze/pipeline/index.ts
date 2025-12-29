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
import { enhancedParser } from './enhanced-parser';
import { visualParser } from './visual-parser';
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
import {
  UserTier,
  TokenBudgetConfig,
  applyTokenBudget,
  applyCustomBudget,
  ReducedParsedDOM,
  estimateTokens,
} from './token-budget';
import { encode } from '@toon-format/toon';

export interface PipelineOptions {
  url: string;
  model?: LLMModel;
  tier?: UserTier;
  customBudget?: Partial<TokenBudgetConfig>;
  useEnhancedParser?: boolean;  // Use enhanced parser with layout/visual signals
  useVisualParser?: boolean;    // Use V2 visual parser (complete redesign)
}

export interface PipelineDebug {
  fetchResult: FetchResult;
  normalizedResult: Omit<NormalizationResult, 'html'>; // Exclude HTML (too large)
  parsedDOM: RawParsedDOM | ReducedParsedDOM | EnhancedParsedDOM | VisualParsedDOM;
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
  const { url, model = 'gemini-1.5-flash', tier, customBudget, useEnhancedParser, useVisualParser } = options;

  // Step 1: Fetch URL
  const fetchResult = await fetcher.fetch(url);

  // Step 2: Normalize HTML
  const normalizedResult = await normalizer.clean(fetchResult.html, fetchResult.finalUrl);


  // V2 Visual Parser - Complete Redesign
  if (useVisualParser) {
    const visualParsedDOM = visualParser.parse(normalizedResult, fetchResult.finalUrl);
    const processingTimeMs = Date.now() - startTime;

    return {
      prompt: '', // Visual parser outputs JSON directly for LLM
      metadata: {
        sourceUrl: fetchResult.finalUrl,
        nodesFound: visualParsedDOM.visualTree.length,
        layoutType: 'mixed',
        difficulty: 'medium',
        language: visualParsedDOM.meta.language,
        processingTimeMs,
      },
      processingTimeMs,
    };
  }

  // Enhanced Parser (V1)
  if (useEnhancedParser) {
    // Enhanced Parser Path - outputs JSON directly for LLM consumption
    const enhancedParsedDOM = enhancedParser.parse(normalizedResult, fetchResult.finalUrl);
    const processingTimeMs = Date.now() - startTime;

    return {
      prompt: '', // No prompt synthesis for enhanced parser
      metadata: {
        sourceUrl: fetchResult.finalUrl,
        nodesFound: enhancedParsedDOM.totalNodes,
        layoutType: 'mixed', // Enhanced parser doesn't compute layout type
        difficulty: 'medium', // Enhanced parser doesn't compute difficulty
        language: enhancedParsedDOM.language,
        processingTimeMs,
      },
      processingTimeMs,
    };
  }

  // Standard Parser Path
  const parsedDOM = parser.parse(normalizedResult, fetchResult.finalUrl);

  // Step 3.5: Apply Token Budget (if tier or custom budget specified)
  let finalParsedDOM: RawParsedDOM | ReducedParsedDOM = parsedDOM;
  if (customBudget) {
    finalParsedDOM = applyCustomBudget(parsedDOM, customBudget);
  } else if (tier) {
    finalParsedDOM = applyTokenBudget(parsedDOM, tier);
  }

  // Step 4: Structural Analysis (NO AI)
  const structuralAnalysis = analyzer.analyze(finalParsedDOM as RawParsedDOM);

  // Step 5: Design Interpretation → Final Prompt (OpenAI or Gemini)
  // LLM generates the production-ready prompt directly
  const designPrompt = await interpreter.interpret(finalParsedDOM as RawParsedDOM, structuralAnalysis, model);

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
      language: finalParsedDOM.language,
      processingTimeMs,
    },
    processingTimeMs,
  };
}

// Export all pipeline modules for direct access if needed
export { fetcher } from './fetcher';
export { normalizer } from './normalizer';
export { parser } from './parser';
export { enhancedParser } from './enhanced-parser';
export { visualParser } from './visual-parser';
export { analyzer } from './analyzer';
export { interpreter } from './interpreter';

// Export token budget utilities
export {
  UserTier,
  TokenBudgetConfig,
  TIER_CONFIGS,
  applyTokenBudget,
  applyCustomBudget,
  estimateTokens,
} from './token-budget';
export type { ReducedParsedDOM } from './token-budget';

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
