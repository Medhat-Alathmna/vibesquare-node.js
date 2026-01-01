import { executePipeline, LLMModel, PipelineResult } from './pipeline';

export interface AnalyzeOptions {
  url: string;
  model?: LLMModel;
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
    });
  }
}

export const analyzeService = new AnalyzeService();
