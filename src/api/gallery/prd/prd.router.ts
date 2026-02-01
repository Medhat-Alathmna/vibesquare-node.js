import { Router } from 'express';
import { galleryPRDController } from './prd.controller';
import { galleryAuthenticate } from '../../../middleware/gallery-auth.middleware';

const router = Router();

/**
 * @route GET /api/gallery/prd
 * @desc Get user's PRDs with pagination
 * @access Private
 */
router.get(
  '/',
  galleryAuthenticate(),
  galleryPRDController.list
);

/**
 * @route GET /api/gallery/prd/by-url
 * @desc Get PRD by source URL
 * @access Private
 */
router.get(
  '/by-url',
  galleryAuthenticate(),
  galleryPRDController.getByUrl
);

/**
 * @route GET /api/gallery/prd/:id
 * @desc Get specific PRD by ID
 * @access Private
 */
router.get(
  '/:id',
  galleryAuthenticate(),
  galleryPRDController.getById
);

/**
 * @route GET /api/gallery/prd/:id/download
 * @desc Download PRD as markdown file
 * @access Private
 */
router.get(
  '/:id/download',
  galleryAuthenticate(),
  galleryPRDController.download
);

/**
 * @route DELETE /api/gallery/prd/:id
 * @desc Delete PRD
 * @access Private
 */
router.delete(
  '/:id',
  galleryAuthenticate(),
  galleryPRDController.delete
);

export const galleryPRDRouter = router;
