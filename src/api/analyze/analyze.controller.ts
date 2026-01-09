import { Request, Response } from 'express';
import { analyzeService } from './analyze.service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { LLMModel } from './pipeline';

/**
 * V1 Analyze URL - Single LLM
 */
export const analyzeUrl = asyncHandler(async (req: Request, res: Response) => {
  const { url, model, tier } = req.body;

  const result = await analyzeService.analyzeUrl({
    url,
    model: model as LLMModel,
    tier,
  });

  res.json(new ApiResponse(200, {
    prompt: result.prompt,
    metadata: result.metadata,
    debug: result.debug,
  }, 'Analysis completed successfully'));
});

/**
 * V2 Analyze URL - Multi-Agent Orchestration
 *
 * Uses LangGraph with specialized agents for better analysis:
 * - Layout Analyzer
 * - Component Identifier
 * - Design System Extractor
 * - Conflict Resolver
 * - Prompt Synthesizer
 *
 * Returns finalPrompt + optional userQuestions for ambiguities
 */
export const analyzeUrlV2 = asyncHandler(async (req: Request, res: Response) => {
  const { url, tier, includeDebug } = req.body;

  const result = await analyzeService.analyzeUrlV2({
    url,
    tier,
    includeDebug: includeDebug ?? false,
  });

  res.json(new ApiResponse(200, {
    finalPrompt: result.finalPrompt,
    userQuestions: result.userQuestions,
    metadata: result.metadata,
    debug: includeDebug ? result.debug : undefined,
  }, 'V2 Analysis completed successfully'));
});
