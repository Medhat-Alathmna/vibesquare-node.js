import { Router } from 'express';
import { uploadController } from './upload.controller';
import { authenticate, requireAdminAccess, requirePermission } from '../../middleware/auth.middleware';

const router = Router();

// All upload routes require admin authentication
router.use(authenticate());
router.use(requireAdminAccess());

/**
 * @route POST /api/upload/image
 * @desc Upload a single image
 * @access Admin (projects.create)
 */
router.post(
  '/image',
  requirePermission('projects.create'),
  uploadController.uploadImage
);

/**
 * @route POST /api/upload/images
 * @desc Upload multiple images (max 10)
 * @access Admin (projects.create)
 */
router.post(
  '/images',
  requirePermission('projects.create'),
  uploadController.uploadImages
);

/**
 * @route POST /api/upload/thumbnail
 * @desc Upload a thumbnail image
 * @access Admin (projects.create)
 */
router.post(
  '/thumbnail',
  requirePermission('projects.create'),
  uploadController.uploadThumbnail
);

/**
 * @route POST /api/upload/source-code
 * @desc Upload source code archive (zip/rar)
 * @access Admin (projects.create)
 */
router.post(
  '/source-code',
  requirePermission('projects.create'),
  uploadController.uploadSourceCode
);

/**
 * @route DELETE /api/upload/file
 * @desc Delete a file from S3
 * @access Admin (projects.delete)
 * @query key - The S3 key (URL encoded)
 */
router.delete(
  '/file',
  requirePermission('projects.delete'),
  uploadController.deleteFile
);

export default router;
