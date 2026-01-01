import { Router } from 'express';
import { favoritesController } from './favorites.controller';
import { favoritesValidator } from './favorites.validator';
import { validate } from '../../../middleware/validation.middleware';
import { galleryAuthenticate } from '../../../middleware/gallery-auth.middleware';

const router = Router();

/**
 * @route GET /api/gallery/favorites
 * @desc Get user's favorites with pagination
 * @access Private
 */
router.get(
  '/',
  galleryAuthenticate(),
  validate(favoritesValidator.list),
  favoritesController.list
);

/**
 * @route GET /api/gallery/favorites/ids
 * @desc Get only favorite project IDs
 * @access Private
 */
router.get(
  '/ids',
  galleryAuthenticate(),
  favoritesController.getIds
);

/**
 * @route GET /api/gallery/favorites/count
 * @desc Get favorites count
 * @access Private
 */
router.get(
  '/count',
  galleryAuthenticate(),
  favoritesController.count
);

/**
 * @route GET /api/gallery/favorites/check/:projectId
 * @desc Check if a specific project is favorited
 * @access Private
 */
router.get(
  '/check/:projectId',
  galleryAuthenticate(),
  validate(favoritesValidator.projectId),
  favoritesController.check
);

/**
 * @route POST /api/gallery/favorites/:projectId
 * @desc Add project to favorites
 * @access Private
 */
router.post(
  '/:projectId',
  galleryAuthenticate(),
  validate(favoritesValidator.projectId),
  favoritesController.add
);

/**
 * @route DELETE /api/gallery/favorites/:projectId
 * @desc Remove project from favorites
 * @access Private
 */
router.delete(
  '/:projectId',
  galleryAuthenticate(),
  validate(favoritesValidator.projectId),
  favoritesController.remove
);

export const favoritesRouter = router;
