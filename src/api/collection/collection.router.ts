import { Router } from 'express';
import * as collectionController from './collection.controller';
import { validate } from '../../middleware/validation.middleware';
import { authenticate, requireAdminAccess, requirePermission } from '../../middleware/auth.middleware';
import * as collectionValidator from './collection.validator';

const router = Router();

// ============================================
// Public Routes
// ============================================

// GET /api/collections - List all collections
router.get('/',
  validate(collectionValidator.listCollections),
  collectionController.getCollections
);

// GET /api/collections/featured - Get featured collections
router.get('/featured', collectionController.getFeaturedCollections);

// GET /api/collections/:id - Single collection with projects
router.get('/:id',
  validate(collectionValidator.getCollectionById),
  collectionController.getCollectionById
);

// ============================================
// Admin Routes (Protected)
// ============================================

/**
 * POST /api/collections
 * إنشاء collection جديد
 * @requires Authentication + Admin Access + collections.create permission
 */
router.post('/',
  authenticate(),
  requireAdminAccess(),
  requirePermission('collections.create'),
  validate(collectionValidator.createCollection),
  collectionController.createCollection
);

/**
 * PATCH /api/collections/:id
 * تحديث collection موجود
 * @requires Authentication + Admin Access + collections.update permission
 */
router.patch('/:id',
  authenticate(),
  requireAdminAccess(),
  requirePermission('collections.update'),
  validate(collectionValidator.updateCollection),
  collectionController.updateCollection
);

/**
 * DELETE /api/collections/:id
 * حذف collection
 * @requires Authentication + Admin Access + collections.delete permission
 */
router.delete('/:id',
  authenticate(),
  requireAdminAccess(),
  requirePermission('collections.delete'),
  validate(collectionValidator.collectionIdParam),
  collectionController.deleteCollection
);

export default router;
