import { Router } from 'express';
import { authController } from './auth.controller';
import { authValidator } from './auth.validator';
import { validate } from '../../middleware/validation.middleware';
import { authenticate, optionalAuth } from '../../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';

const router = Router();

// Rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: env.LOGIN_RATE_LIMIT_MAX, // 5 requests per window
  message: {
    success: false,
    message: 'Too many attempts. Please try again later.',
    statusCode: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use X-Forwarded-For header for IP (Vercel/serverless)
  keyGenerator: (req) => {
    return req.ip || req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
  }
});

// ============================================
// Public Routes (no auth required)
// ============================================

// Register
router.post(
  '/register',
  authLimiter,
  validate(authValidator.register),
  authController.register
);

// Login
router.post(
  '/login',
  authLimiter,
  validate(authValidator.login),
  authController.login
);

// Refresh token
router.post(
  '/refresh',
  authController.refreshToken
);

// Logout (can be called without auth)
router.post(
  '/logout',
  optionalAuth(),
  authController.logout
);

// Email verification
router.post(
  '/verify-email',
  validate(authValidator.verifyEmail),
  authController.verifyEmail
);

// Resend verification email
router.post(
  '/resend-verification',
  authLimiter,
  validate(authValidator.resendVerification),
  authController.resendVerification
);

// Forgot password
router.post(
  '/forgot-password',
  authLimiter,
  validate(authValidator.forgotPassword),
  authController.forgotPassword
);

// Reset password
router.post(
  '/reset-password',
  authLimiter,
  validate(authValidator.resetPassword),
  authController.resetPassword
);

// ============================================
// OAuth Routes
// ============================================

// Google OAuth
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);

// GitHub OAuth
router.get('/github', authController.githubAuth);
router.get('/github/callback', authController.githubCallback);

// ============================================
// Protected Routes (auth required)
// ============================================

// Get current user
router.get(
  '/me',
  authenticate(),
  authController.getCurrentUser
);

// Update profile
router.patch(
  '/me',
  authenticate(),
  validate(authValidator.updateProfile),
  authController.updateProfile
);

// Change password
router.post(
  '/change-password',
  authenticate(),
  validate(authValidator.changePassword),
  authController.changePassword
);

export default router;
