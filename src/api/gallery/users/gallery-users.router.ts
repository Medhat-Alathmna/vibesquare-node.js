import { Router } from 'express';
import { galleryUsersController } from './gallery-users.controller';
import { galleryUsersValidator } from './gallery-users.validator';
import { validate } from '../../../middleware/validation.middleware';
import {
  galleryAuthenticate,
  requireGalleryEmailVerified
} from '../../../middleware/gallery-auth.middleware';

const router = Router();

// ============================================
// Own profile routes (/me/*)
// Must come before :username routes
// ============================================

/**
 * @route GET /api/gallery/users/me
 * @desc Get current user profile
 * @access Private
 */
router.get(
  '/me',
  galleryAuthenticate(),
  galleryUsersController.getMe
);

/**
 * @route GET /api/gallery/users/me/stats
 * @desc Get detailed stats for own profile
 * @access Private
 */
router.get(
  '/me/stats',
  galleryAuthenticate(),
  galleryUsersController.getMyStats
);

/**
 * @route GET /api/gallery/users/me/analyses
 * @desc Get own analysis history (paginated)
 * @access Private
 */
router.get(
  '/me/analyses',
  galleryAuthenticate(),
  validate(galleryUsersValidator.pagination),
  galleryUsersController.getMyAnalyses
);

/**
 * @route GET /api/gallery/users/me/activity
 * @desc Get own activity log (paginated)
 * @access Private
 */
router.get(
  '/me/activity',
  galleryAuthenticate(),
  validate(galleryUsersValidator.pagination),
  galleryUsersController.getMyActivity
);

/**
 * @route PATCH /api/gallery/users/me
 * @desc Update current user profile
 * @access Private
 */
router.patch(
  '/me',
  galleryAuthenticate(),
  validate(galleryUsersValidator.updateProfile),
  galleryUsersController.updateMe
);

/**
 * @route DELETE /api/gallery/users/me
 * @desc Delete current user account (soft delete)
 * @access Private
 */
router.delete(
  '/me',
  galleryAuthenticate(),
  galleryUsersController.deleteMe
);

/**
 * @route GET /api/gallery/users/me/can-download
 * @desc Check if user can download
 * @access Private
 */
router.get(
  '/me/can-download',
  galleryAuthenticate(),
  galleryUsersController.canDownload
);

/**
 * @route POST /api/gallery/users/me/download/:projectId
 * @desc Record a download (updates last_download_at)
 * @access Private + Email Verified
 */
router.post(
  '/me/download/:projectId',
  galleryAuthenticate(),
  requireGalleryEmailVerified(),
  validate(galleryUsersValidator.recordDownload),
  galleryUsersController.recordDownload
);

// ============================================
// Public profile routes
// ============================================

/**
 * @route GET /api/gallery/users/profile/:username
 * @desc Get enhanced public profile by username (with stats)
 * @access Public
 */
router.get(
  '/profile/:username',
  validate(galleryUsersValidator.getPublicProfile),
  galleryUsersController.getPublicProfile
);

/**
 * @route GET /api/gallery/users/:username/favorites
 * @desc Get user's public favorites with project details (paginated)
 * @access Public
 */
router.get(
  '/:username/favorites',
  validate(galleryUsersValidator.getUserFavorites),
  galleryUsersController.getUserFavorites
);

export const galleryUsersRouter = router;
