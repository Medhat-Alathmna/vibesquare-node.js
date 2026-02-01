import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ApiResponse } from '../../../shared/utils/ApiResponse';
import { galleryPRDService } from './prd.service';

export const galleryPRDController = {
  /**
   * Get user's PRDs with pagination
   * GET /api/gallery/prd
   */
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { page = 1, limit = 10 } = req.query;

    const result = await galleryPRDService.getUserPRDs(
      req.galleryUser.id,
      Number(page),
      Number(limit)
    );

    res.json(ApiResponse.success(result));
  }),

  /**
   * Get PRD by source URL
   * GET /api/gallery/prd/by-url?url=...
   * URL should be URL-encoded in query parameter
   */
  getByUrl: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    let { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(httpStatus.BAD_REQUEST).json(
        ApiResponse.error('URL parameter is required', httpStatus.BAD_REQUEST)
      );
    }

    // Decode URL in case it was URL-encoded
    try {
      url = decodeURIComponent(url);
    } catch {
      // If decoding fails, use as-is
    }

    const prd = await galleryPRDService.getPRDByUrl(req.galleryUser.id, url);

    res.json(ApiResponse.success(prd));
  }),

  /**
   * Get specific PRD by ID
   * GET /api/gallery/prd/:id
   */
  getById: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { id } = req.params;

    const prd = await galleryPRDService.getPRDById(req.galleryUser.id, id);

    res.json(ApiResponse.success(prd));
  }),

  /**
   * Download PRD as markdown file
   * GET /api/gallery/prd/:id/download
   */
  download: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { id } = req.params;

    const prd = await galleryPRDService.getPRDById(req.galleryUser.id, id);

    const filename = `prd-${prd.sourceUrl.replace(/https?:\/\//, '').replace(/\//g, '-')}.md`;

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(prd.prdMarkdown);
  }),

  /**
   * Delete PRD
   * DELETE /api/gallery/prd/:id
   */
  delete: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { id } = req.params;

    await galleryPRDService.deletePRD(req.galleryUser.id, id);

    res.json(ApiResponse.success(null, 'PRD deleted successfully'));
  })
};
