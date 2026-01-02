import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { authService } from './services/auth.service';
import { ApiResponse } from '../../shared/utils/ApiResponse';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { env } from '../../config/env';
import { GoogleUserInfo, GitHubUserInfo, OAuthTokenResponse } from './auth.types';

// Cookie options for refresh token
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  // 'none' is required for cross-domain cookies (backend on vercel, frontend on different domain)
  // 'lax' works for same-domain only
  sameSite: env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/'
};



export class AuthController {
  /**
   * Register new user
   * POST /api/auth/register
   */
  register = asyncHandler(async (req: Request, res: Response) => {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await authService.register(req.body, ipAddress, userAgent);

    res.status(httpStatus.CREATED).json(
      ApiResponse.success(result, result.message)
    );
  });

  /**
   * Login user
   * POST /api/auth/login
   */
  login = asyncHandler(async (req: Request, res: Response) => {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const { user, accessToken, refreshToken } = await authService.login(
      req.body,
      ipAddress,
      userAgent
    );

    // Set refresh token in HttpOnly cookie
    res.cookie('refreshToken', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    res.status(httpStatus.OK).json(
      ApiResponse.success({ user, accessToken }, 'Login successful')
    );
  });

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Refresh token not found', httpStatus.UNAUTHORIZED)
      );
    }

    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await authService.refreshToken(refreshToken, ipAddress, userAgent);

    // Set new refresh token in cookie
    res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    res.status(httpStatus.OK).json(
      ApiResponse.success(
        { user: result.user, accessToken: result.accessToken },
        'Token refreshed successfully'
      )
    );
  });

  /**
   * Logout user
   * POST /api/auth/logout
   */
  logout = asyncHandler(async (req: Request, res: Response) => {
    if (req.user) {
      await authService.logout(req.user.id);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { path: '/' });

    res.status(httpStatus.OK).json(
      ApiResponse.success(null, 'Logout successful')
    );
  });

  /**
   * Verify email
   * POST /api/auth/verify-email
   */
  verifyEmail = asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;
    const result = await authService.verifyEmail(token);

    res.status(httpStatus.OK).json(
      ApiResponse.success(result, result.message)
    );
  });

  /**
   * Resend verification email
   * POST /api/auth/resend-verification
   */
  resendVerification = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await authService.resendVerificationEmail(email);

    res.status(httpStatus.OK).json(
      ApiResponse.success(null, result.message)
    );
  });

  /**
   * Request password reset
   * POST /api/auth/forgot-password
   */
  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const result = await authService.requestPasswordReset(email);

    res.status(httpStatus.OK).json(
      ApiResponse.success(null, result.message)
    );
  });

  /**
   * Reset password with token
   * POST /api/auth/reset-password
   */
  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;
    const result = await authService.resetPassword(token, newPassword);

    res.status(httpStatus.OK).json(
      ApiResponse.success(null, result.message)
    );
  });

  /**
   * Change password (authenticated)
   * POST /api/auth/change-password
   */
  changePassword = asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user!.id, currentPassword, newPassword);

    // Clear refresh token after password change
    res.clearCookie('refreshToken', { path: '/' });

    res.status(httpStatus.OK).json(
      ApiResponse.success(null, result.message)
    );
  });

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getCurrentUser(req.user!.id);

    res.status(httpStatus.OK).json(
      ApiResponse.success({ user }, 'User retrieved successfully')
    );
  });

  /**
   * Update profile
   * PATCH /api/auth/me
   */
  updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const { userRepository } = await import('../../shared/repositories/postgres/auth.repository');

    const updatedUser = await userRepository.update(req.user!.id, {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      avatarUrl: req.body.avatarUrl
    });

    res.status(httpStatus.OK).json(
      ApiResponse.success({ user: updatedUser }, 'Profile updated successfully')
    );
  });

  // ============================================
  // OAuth Endpoints
  // ============================================

  /**
   * Initiate Google OAuth
   * GET /api/auth/google
   */
  googleAuth = asyncHandler(async (req: Request, res: Response) => {
    const clientId = env.GOOGLE_CLIENT_ID;
    const redirectUri = env.GOOGLE_CALLBACK_URL;

    if (!clientId) {
      return res.status(httpStatus.SERVICE_UNAVAILABLE).json(
        ApiResponse.error('Google OAuth is not configured', httpStatus.SERVICE_UNAVAILABLE)
      );
    }

    const scope = encodeURIComponent('openid email profile');
    const state = Buffer.from(JSON.stringify({ returnUrl: req.query.returnUrl || '/' })).toString('base64');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${scope}&` +
      `state=${state}&` +
      `access_type=offline&` +
      `prompt=consent`;

    res.redirect(authUrl);
  });

  /**
   * Google OAuth callback
   * GET /api/auth/google/callback
   */
  googleCallback = asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.query;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!code) {
      return res.redirect(`${env.FRONTEND_URL}/auth/login?error=oauth_failed`);
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

      const tokens = await tokenResponse.json() as OAuthTokenResponse;

      if (!tokens.access_token) {
        return res.redirect(`${env.FRONTEND_URL}/auth/login?error=oauth_failed`);
      }

      // Get user info
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      const userInfo = await userInfoResponse.json() as GoogleUserInfo;

      // Handle OAuth login
      const result = await authService.handleOAuthLogin(
        {
          id: userInfo.id,
          email: userInfo.email,
          firstName: userInfo.given_name,
          lastName: userInfo.family_name,
          avatarUrl: userInfo.picture,
          provider: 'google'
        },
        ipAddress,
        userAgent
      );

      // Set refresh token cookie
      res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

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
      res.redirect(`${env.FRONTEND_URL}/auth/login?error=oauth_failed`);
    }
  });

  /**
   * Initiate GitHub OAuth
   * GET /api/auth/github
   */
  githubAuth = asyncHandler(async (req: Request, res: Response) => {
    const clientId = env.GITHUB_CLIENT_ID;
    const redirectUri = env.GITHUB_CALLBACK_URL;

    if (!clientId) {
      return res.status(httpStatus.SERVICE_UNAVAILABLE).json(
        ApiResponse.error('GitHub OAuth is not configured', httpStatus.SERVICE_UNAVAILABLE)
      );
    }

    const scope = encodeURIComponent('user:email read:user');
    const state = Buffer.from(JSON.stringify({ returnUrl: req.query.returnUrl || '/' })).toString('base64');

    const authUrl = `https://github.com/login/oauth/authorize?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${scope}&` +
      `state=${state}`;

    res.redirect(authUrl);
  });

  /**
   * GitHub OAuth callback
   * GET /api/auth/github/callback
   */
  githubCallback = asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = req.query;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!code) {
      return res.redirect(`${env.FRONTEND_URL}/auth/login?error=oauth_failed`);
    }

    try {
      // Exchange code for token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code: code,
          redirect_uri: env.GITHUB_CALLBACK_URL
        })
      });

      const tokens = await tokenResponse.json() as OAuthTokenResponse;

      if (!tokens.access_token) {
        return res.redirect(`${env.FRONTEND_URL}/auth/login?error=oauth_failed`);
      }

      // Get user info
      const userInfoResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'User-Agent': 'VibeSquare'
        }
      });

      const userInfo = await userInfoResponse.json() as GitHubUserInfo;

      // Get primary email
      const emailsResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'User-Agent': 'VibeSquare'
        }
      });

      const emails = await emailsResponse.json() as any[];
      const primaryEmail = emails.find((e: any) => e.primary)?.email || userInfo.email;

      // Split name
      const nameParts = (userInfo.name || userInfo.login || '').split(' ');
      const firstName = nameParts[0] || userInfo.login;
      const lastName = nameParts.slice(1).join(' ') || '';

      // Handle OAuth login
      const result = await authService.handleOAuthLogin(
        {
          id: userInfo.id.toString(),
          email: primaryEmail,
          firstName,
          lastName,
          avatarUrl: userInfo.avatar_url,
          provider: 'github'
        },
        ipAddress,
        userAgent
      );

      // Set refresh token cookie
      res.cookie('refreshToken', result.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

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
      res.redirect(`${env.FRONTEND_URL}/auth/login?error=oauth_failed`);
    }
  });
}

export const authController = new AuthController();
