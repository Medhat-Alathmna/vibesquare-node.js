/**
 * Vibe Square - Analysis Pipeline Orchestrator
 *
 * This is the main entry point for the URL-to-Prompt pipeline.
 * It orchestrates all pipeline stages in sequence:
 *
 * V1 Pipeline (Single LLM):
 * 1. Fetch URL (HTTP)
 * 2. Normalize HTML (cleanup)
 * 3. Parse DOM (jsdom)
 * 4. Structural Analysis (deterministic)
 * 5. Design Interpretation → Final Prompt (Single LLM)
 *
 * V2 Pipeline (Multi-Agent):
 * 1. Fetch URL (HTTP)
 * 2. Normalize HTML (cleanup)
 * 3. Parse DOM (jsdom)
 * 4. Structural Analysis (deterministic)
 * 5. Multi-Agent Orchestration → Final Prompt + User Questions
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

// V2 Multi-Agent imports
import { executeAgentPipeline } from '../agents/orchestration/graph';
import { PipelineV2Result, UserQuestion } from '../agents/core/agent.types';

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
  parsedDOM: RawParsedDOM | EnhancedParsedDOM | VisualParsedDOM;
  structuralAnalysis: StructuralAnalysis;
  debug?: PipelineDebug;
}

/**
 * Main pipeline execution function
 */

export async function executePipeline(options: PipelineOptions): Promise<PipelineResult> {
  const startTime = Date.now();
  const { url, model = 'gemini-1.5-flash', tier} = options;

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
  // const designPrompt = await interpreter.interpret(parsedDOM, structuralAnalysis, model);

  // Use finalPrompt directly from LLM - no synthesizer needed
  // const prompt = designPrompt.finalPrompt;

  const processingTimeMs = Date.now() - startTime;

  return {
    prompt: '', // V1 pipeline - use executePipelineV2 for multi-agent prompt generation
    parsedDOM,
    structuralAnalysis,
    metadata: {
      sourceUrl: fetchResult.finalUrl,
      nodesFound: structuralAnalysis.nodeCount,
      layoutType: structuralAnalysis.layoutType,
      difficulty: structuralAnalysis.difficulty,
      language: parsedDOM.language,
      processingTimeMs,
    },
    processingTimeMs,
    debug: {
      fetchResult,
      normalizedResult,
      parsedDOM,
      structuralAnalysis,
    },
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

// ============ V2 Pipeline (Multi-Agent) ============

export interface PipelineV2Options {
  url: string;
  tier?: UserTier;
  includeDebug?: boolean;
}

export interface PipelineV2DebugInfo {
  parsedDOM: RawParsedDOM;
  structuralAnalysis: StructuralAnalysis;
  fetchResult: FetchResult;
}

/**
 * V2 Pipeline execution function (Multi-Agent)
 *
 * Uses LangGraph orchestration with multiple specialized agents:
 * - Layout Analyzer: Identifies visual sections and layout patterns
 * - Component Identifier: Detects UI components (cards, forms, navigation)
 * - Design System Extractor: Extracts colors, fonts, visual identity
 * - Conflict Resolver: Resolves conflicts between agent outputs
 * - Prompt Synthesizer: Generates final production-ready prompt
 * - User Question Collector: Collects ambiguities for user clarification
 *
 * Falls back to single-LLM (V1) on critical failures.
 */
export async function executePipelineV2(options: PipelineV2Options): Promise<PipelineV2Result> {
  const startTime = Date.now();
  const { url, includeDebug = false } = options;

  console.log(`[Pipeline V2] Starting analysis for: ${url}`);

  // Step 1: Fetch URL
  const fetchResult = await fetcher.fetch(url);

  // Step 2: Normalize HTML
  const normalizedResult = await normalizer.clean(fetchResult.html, fetchResult.finalUrl);

  // Step 3: Parse DOM
  const parsedDOM = parser.parse(normalizedResult, fetchResult.finalUrl);

  // Step 4: Structural Analysis (deterministic, no AI)
  const structuralAnalysis = analyzer.analyze(parsedDOM);

  // Step 5: Multi-Agent Orchestration
  const result = await executeAgentPipeline(parsedDOM, structuralAnalysis);

  // Update metadata with actual source URL
  result.metadata.sourceUrl = fetchResult.finalUrl;

  // Add debug info if requested
  if (includeDebug) {
    result.debug = {
      ...result.debug,
      parsedDOM,
      agentOutputs: result.debug?.agentOutputs || {},
    };
  }

  const totalProcessingTime = Date.now() - startTime;
  result.metadata.processingTimeMs = totalProcessingTime;

  console.log(`[Pipeline V2] Completed in ${totalProcessingTime}ms`);

  return result;
}

// Export V2 types
export type { PipelineV2Result, UserQuestion } from '../agents/core/agent.types';
