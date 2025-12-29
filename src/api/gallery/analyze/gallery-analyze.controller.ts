import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ApiResponse } from '../../../shared/utils/ApiResponse';
import { galleryAnalyzeService } from './gallery-analyze.service';

export const galleryAnalyzeController = {
  /**
   * Estimate tokens for analysis
   * POST /api/gallery/analyze/estimate
   */
  estimate: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { url } = req.body;

    const estimate = await galleryAnalyzeService.estimateAnalysis(
      req.galleryUser.id,
      url
    );

    res.json(ApiResponse.success(estimate));
  }),

  /**
   * Execute analysis with quota enforcement
   * POST /api/gallery/analyze/confirm
   */
  confirm: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { url } = req.body;

    const result = await galleryAnalyzeService.executeAnalysis(
      req.galleryUser.id,
      { url, model: 'gpt-4o-mini' }
    );

    res.json(ApiResponse.success(result, 'Analysis completed successfully'));
  }),

  /**
   * Get analysis history
   * GET /api/gallery/analyze/history
   */
  getHistory: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { page = 1, limit = 20 } = req.query;

    const history = await galleryAnalyzeService.getAnalysisHistory(
      req.galleryUser.id,
      Number(page),
      Number(limit)
    );

    res.json(ApiResponse.success(history));
  }),

  /**
   * Get specific analysis by ID
   * GET /api/gallery/analyze/:id
   */
  getById: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { id } = req.params;

    const analysis = await galleryAnalyzeService.getAnalysisById(
      req.galleryUser.id,
      id
    );

    res.json(ApiResponse.success(analysis));
  }),

  /**
   * Get recent analyses
   * GET /api/gallery/analyze/recent
   */
  getRecent: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { limit = 5 } = req.query;

    const analyses = await galleryAnalyzeService.getRecentAnalyses(
      req.galleryUser.id,
      Number(limit)
    );

    res.json(ApiResponse.success(analyses));
  }),

  /**
   * Delete analysis
   * DELETE /api/gallery/analyze/:id
   */
  delete: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { id } = req.params;

    await galleryAnalyzeService.deleteAnalysis(req.galleryUser.id, id);

    res.json(ApiResponse.success(null, 'Analysis deleted successfully'));
  })
};
