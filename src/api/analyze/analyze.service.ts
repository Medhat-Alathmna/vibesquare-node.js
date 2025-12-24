import { executePipeline, LLMModel, PipelineResult, UserTier, TokenBudgetConfig } from './pipeline';

export interface AnalyzeOptions {
  url: string;
  model?: LLMModel;
  tier?: UserTier;
  customBudget?: Partial<TokenBudgetConfig>;
}

export class AnalyzeService {
  /**
   * Analyze a URL and generate a professional prompt
   *
   * @param options - Analysis options
   * @returns Pipeline result with prompt and metadata
   */
  async analyzeUrl(options: AnalyzeOptions): Promise<PipelineResult> {
    return executePipeline({
      url: options.url,
      model: options.model,
      tier: options.tier,
      customBudget: options.customBudget,
    });
  }
}

export const analyzeService = new AnalyzeService();
