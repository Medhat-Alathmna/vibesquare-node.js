import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ApiResponse } from '../../../shared/utils/ApiResponse';
import { favoritesService } from './favorites.service';

export const favoritesController = {
  /**
   * Get user's favorites
   * GET /api/gallery/favorites
   */
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { page = 1, limit = 20 } = req.query;

    const result = await favoritesService.getFavorites(
      req.galleryUser.id,
      Number(page),
      Number(limit)
    );

    res.json(ApiResponse.success(result));
  }),

  /**
   * Get favorite project IDs only
   * GET /api/gallery/favorites/ids
   */
  getIds: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const ids = await favoritesService.getFavoriteProjectIds(req.galleryUser.id);

    res.json(ApiResponse.success({ projectIds: ids }));
  }),

  /**
   * Add to favorites
   * POST /api/gallery/favorites/:projectId
   */
  add: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { projectId } = req.params;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const favorite = await favoritesService.addFavorite(
      req.galleryUser.id,
      projectId,
      ipAddress,
      userAgent
    );

    res.status(httpStatus.CREATED).json(
      ApiResponse.success(favorite, 'Added to favorites')
    );
  }),

  /**
   * Remove from favorites
   * DELETE /api/gallery/favorites/:projectId
   */
  remove: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { projectId } = req.params;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await favoritesService.removeFavorite(
      req.galleryUser.id,
      projectId,
      ipAddress,
      userAgent
    );

    res.json(ApiResponse.success(null, 'Removed from favorites'));
  }),

  /**
   * Check if project is favorited
   * GET /api/gallery/favorites/check/:projectId
   */
  check: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { projectId } = req.params;

    const isFavorited = await favoritesService.isFavorited(req.galleryUser.id, projectId);

    res.json(ApiResponse.success({ isFavorited }));
  }),

  /**
   * Check multiple projects at once
   * POST /api/gallery/favorites/check-multiple
   */
  checkMultiple: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { projectIds } = req.body;

    const result = await favoritesService.checkMultipleFavorites(
      req.galleryUser.id,
      projectIds
    );

    res.json(ApiResponse.success(result));
  }),

  /**
   * Get favorites count
   * GET /api/gallery/favorites/count
   */
  count: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const count = await favoritesService.getFavoritesCount(req.galleryUser.id);

    res.json(ApiResponse.success({ count }));
  })
};
