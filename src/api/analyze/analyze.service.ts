import { executePipeline, executePipelineV2, LLMModel, PipelineResult, UserTier, PipelineV2Result } from './pipeline';

export interface AnalyzeOptions {
  url: string;
  model?: LLMModel;
  tier?: UserTier;
}

export interface AnalyzeV2Options {
  url: string;
  tier?: UserTier;
  includeDebug?: boolean;
}

export class AnalyzeService {
  /**
   * V1: Analyze a URL using single LLM
   *
   * @param options - Analysis options
   * @returns Pipeline result with prompt and metadata
   */
  async analyzeUrl(options: AnalyzeOptions): Promise<PipelineResult> {
    return executePipeline({
      url: options.url,
      model: options.model,
      tier: options.tier,
    });
  }

  /**
   * V2: Analyze a URL using multi-agent orchestration
   *
   * Uses LangGraph with specialized agents:
   * - Layout Analyzer
   * - Component Identifier
   * - Design System Extractor
   * - Conflict Resolver
   * - Prompt Synthesizer
   *
   * Falls back to single-LLM on critical failures.
   *
   * @param options - V2 Analysis options
   * @returns Pipeline result with prompt, user questions, and metadata
   */
  async analyzeUrlV2(options: AnalyzeV2Options): Promise<PipelineV2Result> {
    return executePipelineV2({
      url: options.url,
      tier: options.tier,
      includeDebug: options.includeDebug,
    });
  }
}

export const analyzeService = new AnalyzeService();
