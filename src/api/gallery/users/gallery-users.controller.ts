import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ApiResponse } from '../../../shared/utils/ApiResponse';
import { galleryUsersService } from './gallery-users.service';

export const galleryUsersController = {
  /**
   * Get current user profile
   * GET /api/gallery/users/me
   */
  getMe: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const safeUser = galleryUsersService.toSafeUser(req.galleryUser);

    res.json(ApiResponse.success(safeUser));
  }),

  /**
   * Update current user profile
   * PATCH /api/gallery/users/me
   */
  updateMe: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const updatedUser = await galleryUsersService.updateProfile(
      req.galleryUser.id,
      req.body,
      ipAddress,
      userAgent
    );

    res.json(ApiResponse.success(updatedUser, 'Profile updated successfully'));
  }),

  /**
   * Delete current user account (soft delete)
   * DELETE /api/gallery/users/me
   */
  deleteMe: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    await galleryUsersService.deleteAccount(req.galleryUser.id);

    // Clear refresh token cookie
    res.clearCookie('gallery_refresh_token', { path: '/' });

    res.json(ApiResponse.success(null, 'Account deleted successfully'));
  }),

  /**
   * Get enhanced public profile by username (with stats)
   * GET /api/gallery/users/profile/:username
   */
  getPublicProfile: asyncHandler(async (req: Request, res: Response) => {
    const { username } = req.params;

    const profile = await galleryUsersService.getEnhancedPublicProfile(username);

    if (!profile) {
      return res.status(httpStatus.NOT_FOUND).json(
        ApiResponse.error('User not found', httpStatus.NOT_FOUND)
      );
    }

    res.json(ApiResponse.success(profile));
  }),

  /**
   * Get detailed stats for own profile
   * GET /api/gallery/users/me/stats
   */
  getMyStats: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const stats = await galleryUsersService.getOwnProfileStats(req.galleryUser.id);

    res.json(ApiResponse.success(stats));
  }),

  /**
   * Get user's public favorites with project details
   * GET /api/gallery/users/:username/favorites
   */
  getUserFavorites: asyncHandler(async (req: Request, res: Response) => {
    const { username } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const favorites = await galleryUsersService.getUserFavoritesWithProjects(
      username,
      page,
      Math.min(limit, 50) // Cap at 50
    );

    res.json(ApiResponse.success(favorites));
  }),

  /**
   * Get own analysis history
   * GET /api/gallery/users/me/analyses
   */
  getMyAnalyses: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const analyses = await galleryUsersService.getOwnAnalysisHistory(
      req.galleryUser.id,
      page,
      Math.min(limit, 100) // Cap at 100
    );

    res.json(ApiResponse.success(analyses));
  }),

  /**
   * Get own activity log
   * GET /api/gallery/users/me/activity
   */
  getMyActivity: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const activity = await galleryUsersService.getOwnActivityLog(
      req.galleryUser.id,
      page,
      Math.min(limit, 100) // Cap at 100
    );

    res.json(ApiResponse.success(activity));
  }),

  /**
   * Check if user can download
   * GET /api/gallery/users/me/can-download
   */
  canDownload: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const result = galleryUsersService.canDownload(req.galleryUser);

    res.json(ApiResponse.success(result));
  }),

  /**
   * Record a download
   * POST /api/gallery/users/me/download/:projectId
   */
  recordDownload: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { projectId } = req.params;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await galleryUsersService.recordDownload(
      req.galleryUser.id,
      projectId,
      ipAddress,
      userAgent
    );

    res.json(ApiResponse.success(null, 'Download recorded'));
  })
};
