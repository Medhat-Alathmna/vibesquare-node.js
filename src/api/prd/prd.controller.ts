/**
 * PRD Controller
 *
 * HTTP handlers for PRD (Product Requirements Document) endpoints.
 */

import { Request, Response } from 'express';
import { prdService } from './prd.service';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { ApiError } from '../../shared/utils/ApiError';

/**
 * GET /api/prd/:id
 * Get PRD by ID
 */
export const getPRDById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const prd = await prdService.getById(id);

  if (!prd) {
    throw new ApiError(404, 'PRD not found');
  }

  res.json(new ApiResponse(200, prd, 'PRD retrieved successfully'));
});

/**
 * GET /api/prd
 * Get PRDs for authenticated user
 */
export const getUserPRDs = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;

  if (!userId) {
    throw new ApiError(401, 'Authentication required');
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  const result = await prdService.getByUserId(userId, page, limit);

  res.json(new ApiResponse(200, result, 'PRDs retrieved successfully'));
});

/**
 * GET /api/prd/:id/download
 * Download PRD as markdown file
 */
export const downloadPRD = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const markdown = await prdService.getMarkdown(id);

  if (!markdown) {
    throw new ApiError(404, 'PRD not found');
  }

  // Get PRD for filename
  const prd = await prdService.getById(id);
  const filename = prd
    ? `prd-${new URL(prd.sourceUrl).hostname}-${id.substring(0, 8)}.md`
    : `prd-${id.substring(0, 8)}.md`;

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(markdown);
});

/**
 * DELETE /api/prd/:id
 * Delete PRD by ID
 */
export const deletePRD = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userId = (req as any).user?.id;

  // Verify ownership (if auth is enabled)
  if (userId) {
    const prd = await prdService.getById(id);
    if (!prd) {
      throw new ApiError(404, 'PRD not found');
    }
    if (prd.userId && prd.userId !== userId) {
      throw new ApiError(403, 'Not authorized to delete this PRD');
    }
  }

  const deleted = await prdService.delete(id);

  if (!deleted) {
    throw new ApiError(404, 'PRD not found');
  }

  res.json(new ApiResponse(200, { deleted: true }, 'PRD deleted successfully'));
});

/**
 * GET /api/prd/by-url
 * Get PRDs by source URL
 */
export const getPRDsByUrl = asyncHandler(async (req: Request, res: Response) => {
  const url = req.query.url as string;

  if (!url) {
    throw new ApiError(400, 'URL query parameter is required');
  }

  const prds = await prdService.getByUrl(url);

  res.json(new ApiResponse(200, prds, 'PRDs retrieved successfully'));
});
