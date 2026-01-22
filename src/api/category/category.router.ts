import { Router } from 'express';
import { categoryController } from './category.controller';
import {
    createCategory,
    updateCategory,
    categoryIdParam,
    categorySlugParam,
    listCategories
} from './category.validator';
import { validate } from '../../middleware/validation.middleware';
import { authenticate, requireAdminAccess, requirePermission } from '../../middleware/auth.middleware';

const router = Router();

// ============================================
// Public Routes (Gallery Users)
// ============================================

/**
 * GET /api/categories
 * List all active categories
 * Used by Gallery Users for filtering and search
 * Supports multiple category filtering
 */
router.get(
    '/',
    validate(listCategories),
    categoryController.list
);

/**
 * GET /api/categories/slug/:slug
 * Get category by slug
 * IMPORTANT: Must come BEFORE /:id to avoid slug being matched as id
 */
router.get(
    '/slug/:slug',
    validate(categorySlugParam),
    categoryController.getBySlug
);

/**
 * GET /api/categories/:id
 * Get single category by ID
 */
router.get(
    '/:id',
    validate(categoryIdParam),
    categoryController.getById
);

// ============================================
// Admin Routes (Protected)
// ============================================

/**
 * POST /api/categories
 * Create a new category
 * @requires Authentication + Admin Access + categories.create permission
 */
router.post(
    '/',
    authenticate(),
    requireAdminAccess(),
    requirePermission('category.create'),
    validate(createCategory),
    categoryController.create
);

/**
 * PUT /api/categories/:id
 * Update an existing category
 * @requires Authentication + Admin Access + categories.update permission
 */
router.put(
    '/:id',
    authenticate(),
    requireAdminAccess(),
    requirePermission('category.update'),
    validate(updateCategory),
    categoryController.update
);

/**
 * DELETE /api/categories/:id
 * Soft delete a category
 * @requires Authentication + Admin Access + categories.delete permission
 */
router.delete(
    '/:id',
    authenticate(),
    requireAdminAccess(),
    requirePermission('category.delete'),
    validate(categoryIdParam),
    categoryController.delete
);

/**
 * POST /api/categories/:id/restore
 * Restore a soft-deleted category
 * @requires Authentication + Admin Access + categories.restore permission
 */
router.post(
    '/:id/restore',
    authenticate(),
    requireAdminAccess(),
    requirePermission('category.restore'),
    validate(categoryIdParam),
    categoryController.restore
);

export const categoryRouter = router;
