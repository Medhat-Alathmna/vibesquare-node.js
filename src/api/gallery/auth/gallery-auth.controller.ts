import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ApiResponse } from '../../../shared/utils/ApiResponse';
import { galleryAuthService } from './gallery-auth.service';
import { env } from '../../../config/env';

// Cookie options for refresh token
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/'
};

export const galleryAuthController = {
  /**
   * Register new gallery user
   * POST /api/gallery/auth/register
   */
  register: asyncHandler(async (req: Request, res: Response) => {
    const { username, email, password } = req.body;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await galleryAuthService.register(
      { username, email, password },
      userAgent,
      ipAddress
    );

    res.status(httpStatus.CREATED).json(
      ApiResponse.success(result, 'Registration successful. Please check your email to verify your account.')
    );
  }),

  /**
   * Login
   * POST /api/gallery/auth/login
   */
  login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const result = await galleryAuthService.login(
      { email, password },
      userAgent,
      ipAddress
    );

    // Set refresh token in HTTP-only cookie
    res.cookie('gallery_refresh_token', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    // Don't include refresh token in response body
    const { refreshToken, ...responseData } = result;

    res.json(ApiResponse.success(responseData, 'Login successful'));
  }),

  /**
   * Logout
   * POST /api/gallery/auth/logout
   */
  logout: asyncHandler(async (req: Request, res: Response) => {
    if (req.galleryUser) {
      await galleryAuthService.logout(req.galleryUser.id);
    }

    // Clear refresh token cookie
    res.clearCookie('gallery_refresh_token', { path: '/' });

    res.json(ApiResponse.success(null, 'Logout successful'));
  }),

  /**
   * Refresh access token
   * POST /api/gallery/auth/refresh
   */
  refresh: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies.gallery_refresh_token;

    if (!refreshToken) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('No refresh token provided', httpStatus.UNAUTHORIZED)
      );
    }

    const userAgent = req.headers['user-agent'];
    const ipAddress = req.ip || req.socket.remoteAddress;

    const tokens = await galleryAuthService.refreshToken(refreshToken, userAgent, ipAddress);

    // Set new refresh token in cookie
    res.cookie('gallery_refresh_token', tokens.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    res.json(ApiResponse.success({ accessToken: tokens.accessToken }, 'Token refreshed'));
  }),

  /**
   * Verify email
   * POST /api/gallery/auth/verify-email
   */
  verifyEmail: asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;

    await galleryAuthService.verifyEmail(token);

    res.json(ApiResponse.success(null, 'Email verified successfully'));
  }),

  /**
   * Resend verification email
   * POST /api/gallery/auth/resend-verification
   */
  resendVerification: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    await galleryAuthService.resendVerificationEmail(req.galleryUser.id);

    res.json(ApiResponse.success(null, 'Verification email sent'));
  }),

  /**
   * Request password reset
   * POST /api/gallery/auth/forgot-password
   */
  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    await galleryAuthService.forgotPassword(email);

    // Always return success to prevent email enumeration
    res.json(ApiResponse.success(null, 'If the email exists, a reset link has been sent'));
  }),

  /**
   * Reset password
   * POST /api/gallery/auth/reset-password
   */
  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    await galleryAuthService.resetPassword(token, newPassword);

    res.json(ApiResponse.success(null, 'Password reset successful. Please login with your new password.'));
  }),

  /**
   * Change password (for logged in users)
   * PATCH /api/gallery/auth/change-password
   */
  changePassword: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { currentPassword, newPassword } = req.body;

    await galleryAuthService.changePassword(req.galleryUser.id, currentPassword, newPassword);

    // Clear refresh token cookie (logout)
    res.clearCookie('gallery_refresh_token', { path: '/' });

    res.json(ApiResponse.success(null, 'Password changed. Please login again.'));
  }),

  /**
   * Get current user
   * GET /api/gallery/auth/me
   */
  getCurrentUser: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const safeUser = galleryAuthService.toSafeUser(req.galleryUser);

    res.json(ApiResponse.success(safeUser));
  })
};
