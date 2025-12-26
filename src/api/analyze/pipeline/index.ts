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
 * 5. Design Interpretation (OpenAI or Gemini LLM)
 * 6. Build IR (intermediate representation)
 * 7. Synthesize Prompt (final output)
 */

import { fetcher } from './fetcher';
import { normalizer, NormalizationResult } from './normalizer';
import { parser } from './parser';
import { analyzer } from './analyzer';
import { interpreter, LLMModel } from './interpreter';
import { synthesizer } from './synthesizer';
import {
  AnalysisResult,
  FetchResult,
  RawParsedDOM,
  StructuralAnalysis,
  DesignInterpretation,
  IntermediateRepresentation,
} from './ir.types';
import {
  UserTier,
  TokenBudgetConfig,
  applyTokenBudget,
  applyCustomBudget,
  ReducedParsedDOM,
} from './token-budget';

export interface PipelineOptions {
  url: string;
  model?: LLMModel;
  tier?: UserTier;
  customBudget?: Partial<TokenBudgetConfig>;
}

export interface PipelineDebug {
  fetchResult: FetchResult;
  normalizedResult: Omit<NormalizationResult, 'html'>; // Exclude HTML (too large)
  parsedDOM: RawParsedDOM | ReducedParsedDOM;
  structuralAnalysis: StructuralAnalysis;
  designInterpretation: DesignInterpretation;
  ir: IntermediateRepresentation;
}

export interface PipelineResult extends AnalysisResult {
  processingTimeMs: number;
  debug: PipelineDebug;
}

/**
 * Main pipeline execution function
 */
export async function executePipeline(options: PipelineOptions): Promise<PipelineResult> {
  const startTime = Date.now();
  const { url, model = 'gemini-1.5-flash', tier, customBudget } = options;

  // Step 1: Fetch URL
  const fetchResult = await fetcher.fetch(url);

  // Step 2: Normalize HTML
  const normalizedResult = await normalizer.clean(fetchResult.html, fetchResult.finalUrl);

  // Step 3: Parse DOM
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

  // Step 5: Design Interpretation (OpenAI or Gemini)
  // const designInterpretation = await interpreter.interpret(finalParsedDOM as RawParsedDOM, structuralAnalysis, model);

  // // Step 6: Build Intermediate Representation
  // const ir = synthesizer.buildIR(fetchResult.finalUrl, finalParsedDOM as RawParsedDOM, structuralAnalysis, designInterpretation);

  // Step 7: Synthesize Prompt
  // const prompt = synthesizer.synthesize(ir);

  const processingTimeMs = Date.now() - startTime;

  // Build result
  const result: AnalysisResult | any = {
    // prompt,
    // ir,
    metadata: {
      sourceUrl: fetchResult.finalUrl,
      nodesFound: structuralAnalysis.nodeCount,
      layoutType: structuralAnalysis.layoutType,
      difficulty: structuralAnalysis.difficulty,
      language: finalParsedDOM.language,
      processingTimeMs,
    },
  };

  return {
    ...result,
    processingTimeMs,
    debug: {
      fetchResult,
      normalizedResult: {
        extractedFonts: normalizedResult.extractedFonts,
        extractedEmbeds: normalizedResult.extractedEmbeds,
        extractedCSS: normalizedResult.extractedCSS,
      },
      parsedDOM: finalParsedDOM,
      structuralAnalysis,
      // designInterpretation,
      // ir,
    },
  };
}

// Export all pipeline modules for direct access if needed
export { fetcher } from './fetcher';
export { normalizer } from './normalizer';
export { parser } from './parser';
export { analyzer } from './analyzer';
export { interpreter } from './interpreter';
export { synthesizer } from './synthesizer';
export * from './ir.types';

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
