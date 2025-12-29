import { Router } from 'express';
import { quotaController } from './quota.controller';
import { quotaValidator } from './quota.validator';
import { validate } from '../../../middleware/validation.middleware';
import { galleryAuthenticate } from '../../../middleware/gallery-auth.middleware';

const router = Router();

/**
 * @route GET /api/gallery/quota
 * @desc Get current quota status
 * @access Private
 */
router.get(
  '/',
  galleryAuthenticate(),
  quotaController.getStatus
);

/**
 * @route GET /api/gallery/quota/history
 * @desc Get token transaction history
 * @access Private
 */
router.get(
  '/history',
  galleryAuthenticate(),
  validate(quotaValidator.list),
  quotaController.getHistory
);

/**
 * @route POST /api/gallery/quota/check
 * @desc Check if user has sufficient quota
 * @access Private
 */
router.post(
  '/check',
  galleryAuthenticate(),
  validate(quotaValidator.checkQuota),
  quotaController.checkQuota
);

export const quotaRouter = router;
