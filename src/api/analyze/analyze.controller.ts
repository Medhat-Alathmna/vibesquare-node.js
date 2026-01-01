import { Request, Response } from 'express';
import { analyzeService } from './analyze.service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { LLMModel } from './pipeline';

export const analyzeUrl = asyncHandler(async (req: Request, res: Response) => {
  const { url, model } = req.body;

  const result = await analyzeService.analyzeUrl({
    url,
    model: model as LLMModel,
  });

  res.json(new ApiResponse(200, {
    prompt: result.prompt,
    metadata: result.metadata,
    debug: result.debug,
  }, 'Analysis completed successfully'));
});
