import { Router } from 'express';
import { galleryAuthController } from './gallery-auth.controller';
import { galleryAuthValidator } from './gallery-auth.validator';
import { validate } from '../../../middleware/validation.middleware';
import { galleryAuthenticate } from '../../../middleware/gallery-auth.middleware';

const router = Router();

/**
 * @route POST /api/gallery/auth/register
 * @desc Register a new gallery user
 * @access Public
 */
router.post(
  '/register',
  validate(galleryAuthValidator.register),
  galleryAuthController.register
);

/**
 * @route POST /api/gallery/auth/login
 * @desc Login with email and password
 * @access Public
 */
router.post(
  '/login',
  validate(galleryAuthValidator.login),
  galleryAuthController.login
);

/**
 * @route POST /api/gallery/auth/logout
 * @desc Logout and revoke tokens
 * @access Private (optional - works even if not logged in)
 */
router.post(
  '/logout',
  galleryAuthenticate(false), // Optional auth
  galleryAuthController.logout
);

/**
 * @route POST /api/gallery/auth/refresh
 * @desc Refresh access token using refresh token cookie
 * @access Public (uses cookie)
 */
router.post(
  '/refresh',
  galleryAuthController.refresh
);

/**
 * @route POST /api/gallery/auth/verify-email
 * @desc Verify email with token
 * @access Public
 */
router.post(
  '/verify-email',
  validate(galleryAuthValidator.verifyEmail),
  galleryAuthController.verifyEmail
);

/**
 * @route POST /api/gallery/auth/resend-verification
 * @desc Resend email verification
 * @access Private
 */
router.post(
  '/resend-verification',
  galleryAuthenticate(),
  galleryAuthController.resendVerification
);

/**
 * @route POST /api/gallery/auth/forgot-password
 * @desc Request password reset email
 * @access Public
 */
router.post(
  '/forgot-password',
  validate(galleryAuthValidator.forgotPassword),
  galleryAuthController.forgotPassword
);

/**
 * @route POST /api/gallery/auth/reset-password
 * @desc Reset password with token
 * @access Public
 */
router.post(
  '/reset-password',
  validate(galleryAuthValidator.resetPassword),
  galleryAuthController.resetPassword
);

/**
 * @route PATCH /api/gallery/auth/change-password
 * @desc Change password for logged in user
 * @access Private
 */
router.patch(
  '/change-password',
  galleryAuthenticate(),
  validate(galleryAuthValidator.changePassword),
  galleryAuthController.changePassword
);

/**
 * @route GET /api/gallery/auth/me
 * @desc Get current user info
 * @access Private
 */
router.get(
  '/me',
  galleryAuthenticate(),
  galleryAuthController.getCurrentUser
);

export const galleryAuthRouter = router;
