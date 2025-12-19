import { Router } from 'express';
import { galleryUsersController } from './gallery-users.controller';
import { galleryUsersValidator } from './gallery-users.validator';
import { validate } from '../../../middleware/validation.middleware';
import {
  galleryAuthenticate,
  requireGalleryEmailVerified
} from '../../../middleware/gallery-auth.middleware';

const router = Router();

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

/**
 * @route GET /api/gallery/users/profile/:username
 * @desc Get public profile by username
 * @access Public
 */
router.get(
  '/profile/:username',
  validate(galleryUsersValidator.getPublicProfile),
  galleryUsersController.getPublicProfile
);

export const galleryUsersRouter = router;
