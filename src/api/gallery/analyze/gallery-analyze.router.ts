import { Router } from 'express';
import { galleryAnalyzeController } from './gallery-analyze.controller';
import { galleryAnalyzeValidator } from './gallery-analyze.validator';
import { validate } from '../../../middleware/validation.middleware';
import { galleryAuthenticate, requireGalleryEmailVerified } from '../../../middleware/gallery-auth.middleware';

const router = Router();

/**
 * @route POST /api/gallery/analyze/estimate
 * @desc Estimate tokens for URL analysis
 * @access Private (requires verified email)
 */
router.post(
  '/estimate',
  galleryAuthenticate(),
  requireGalleryEmailVerified(),
  validate(galleryAnalyzeValidator.estimate),
  galleryAnalyzeController.estimate
);

/**
 * @route POST /api/gallery/analyze/confirm
 * @desc Execute analysis after user confirmation
 * @access Private (requires verified email)
 */
router.post(
  '/confirm',
  galleryAuthenticate(),
  requireGalleryEmailVerified(),
  validate(galleryAnalyzeValidator.confirm),
  galleryAnalyzeController.confirm
);

/**
 * @route GET /api/gallery/analyze/history
 * @desc Get analysis history
 * @access Private
 */
router.get(
  '/history',
  galleryAuthenticate(),
  validate(galleryAnalyzeValidator.history),
  galleryAnalyzeController.getHistory
);

/**
 * @route GET /api/gallery/analyze/recent
 * @desc Get recent analyses
 * @access Private
 */
router.get(
  '/recent',
  galleryAuthenticate(),
  validate(galleryAnalyzeValidator.recent),
  galleryAnalyzeController.getRecent
);

/**
 * @route GET /api/gallery/analyze/:id
 * @desc Get specific analysis by ID
 * @access Private
 */
router.get(
  '/:id',
  galleryAuthenticate(),
  validate(galleryAnalyzeValidator.getById),
  galleryAnalyzeController.getById
);

/**
 * @route DELETE /api/gallery/analyze/:id
 * @desc Delete analysis
 * @access Private
 */
router.delete(
  '/:id',
  galleryAuthenticate(),
  validate(galleryAnalyzeValidator.getById),
  galleryAnalyzeController.delete
);

export const galleryAnalyzeRouter = router;
