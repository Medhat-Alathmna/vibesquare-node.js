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
   * Get public profile by username
   * GET /api/gallery/users/profile/:username
   */
  getPublicProfile: asyncHandler(async (req: Request, res: Response) => {
    const { username } = req.params;

    const profile = await galleryUsersService.getPublicProfile(username);

    if (!profile) {
      return res.status(httpStatus.NOT_FOUND).json(
        ApiResponse.error('User not found', httpStatus.NOT_FOUND)
      );
    }

    res.json(ApiResponse.success(profile));
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
