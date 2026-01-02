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
  // 'none' is required for cross-domain cookies (backend on vercel, frontend on different domain)
  sameSite: env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
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
  }),

  /**
   * Initiate Google OAuth
   * GET /api/gallery/auth/google
   */
  googleAuth: asyncHandler(async (req: Request, res: Response) => {
    const state = req.query.returnUrl
      ? Buffer.from(JSON.stringify({ returnUrl: req.query.returnUrl })).toString('base64')
      : Buffer.from(JSON.stringify({ returnUrl: '/' })).toString('base64');

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set('redirect_uri', env.GOOGLE_CALLBACK_URL);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', state);

    res.redirect(googleAuthUrl.toString());
  }),

  /**
   * Google OAuth callback
   * GET /api/gallery/auth/google/callback
   */
  googleCallback: asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: env.GOOGLE_CALLBACK_URL,
          grant_type: 'authorization_code'
        })
      });

      const tokens = await tokenResponse.json();

      if (!tokens.access_token) {
        return res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
      }

      // Get user info
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      const userInfo = await userInfoResponse.json();

      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Handle OAuth login
      const result = await galleryAuthService.handleOAuthLogin(
        'google',
        {
          id: userInfo.id,
          email: userInfo.email,
          username: userInfo.email.split('@')[0],
          avatarUrl: userInfo.picture
        },
        ipAddress,
        userAgent
      );

      // Set refresh token cookie
      res.cookie('gallery_refresh_token', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

      // Parse state for return URL
      let returnUrl = '/';
      try {
        const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
        returnUrl = stateData.returnUrl || '/';
      } catch { }

      // Redirect to frontend with access token
      res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${result.accessToken}&returnUrl=${encodeURIComponent(returnUrl)}`);
    } catch (error) {
      console.error('Google OAuth error:', error);
      res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
    }
  }),

  /**
   * Initiate GitHub OAuth
   * GET /api/gallery/auth/github
   */
  githubAuth: asyncHandler(async (req: Request, res: Response) => {
    const state = req.query.returnUrl
      ? Buffer.from(JSON.stringify({ returnUrl: req.query.returnUrl })).toString('base64')
      : Buffer.from(JSON.stringify({ returnUrl: '/' })).toString('base64');

    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
    githubAuthUrl.searchParams.set('redirect_uri', env.GITHUB_CALLBACK_URL);
    githubAuthUrl.searchParams.set('scope', 'user:email');
    githubAuthUrl.searchParams.set('state', state);

    res.redirect(githubAuthUrl.toString());
  }),

  /**
   * GitHub OAuth callback
   * GET /api/gallery/auth/github/callback
   */
  githubCallback: asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
    }

    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: code as string,
          redirect_uri: env.GITHUB_CALLBACK_URL
        })
      });

      const tokens = await tokenResponse.json();

      if (!tokens.access_token) {
        return res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
      }

      // Get user info
      const userInfoResponse = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      const userInfo = await userInfoResponse.json();

      // Get primary email
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      const emails = await emailsResponse.json();
      const primaryEmail = emails.find((e: any) => e.primary)?.email || emails[0]?.email;

      if (!primaryEmail) {
        return res.redirect(`${env.FRONTEND_URL}/login?error=no_email`);
      }

      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Handle OAuth login
      const result = await galleryAuthService.handleOAuthLogin(
        'github',
        {
          id: userInfo.id.toString(),
          email: primaryEmail,
          username: userInfo.login,
          avatarUrl: userInfo.avatar_url
        },
        ipAddress,
        userAgent
      );

      // Set refresh token cookie
      res.cookie('gallery_refresh_token', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

      // Parse state for return URL
      let returnUrl = '/';
      try {
        const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
        returnUrl = stateData.returnUrl || '/';
      } catch { }

      // Redirect to frontend with access token
      res.redirect(`${env.FRONTEND_URL}/auth/callback?token=${result.accessToken}&returnUrl=${encodeURIComponent(returnUrl)}`);
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      res.redirect(`${env.FRONTEND_URL}/login?error=oauth_failed`);
    }
  })
};
