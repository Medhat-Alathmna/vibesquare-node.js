import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ApiResponse } from '../../../shared/utils/ApiResponse';
import { quotaService } from './quota.service';

export const quotaController = {
  /**
   * Get current quota status
   * GET /api/gallery/quota
   */
  getStatus: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const status = await quotaService.getQuotaStatus(req.galleryUser.id);

    res.json(ApiResponse.success(status));
  }),

  /**
   * Get transaction history
   * GET /api/gallery/quota/history
   */
  getHistory: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { page = 1, limit = 20 } = req.query;

    const history = await quotaService.getTransactionHistory(
      req.galleryUser.id,
      Number(page),
      Number(limit)
    );

    res.json(ApiResponse.success(history));
  }),

  /**
   * Check quota for estimated tokens
   * POST /api/gallery/quota/check
   */
  checkQuota: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { estimatedTokens } = req.body;

    const result = await quotaService.checkQuota(req.galleryUser.id, estimatedTokens);

    res.json(ApiResponse.success(result));
  })
};
