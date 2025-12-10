import { Request, Response } from 'express';
import { analyzeService } from './analyze.service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { LlmType } from '../../shared/types';

export const analyzeUrl = asyncHandler(async (req: Request, res: Response) => {
  const { url, llmType } = req.body;

  const result = await analyzeService.analyzeUrl(url, llmType as LlmType);

  res.json(new ApiResponse(200, result, 'Analysis completed'));
});
