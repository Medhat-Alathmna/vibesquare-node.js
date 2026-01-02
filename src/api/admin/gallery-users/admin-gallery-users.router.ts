import { Router } from 'express';
import { adminGalleryUsersController } from './admin-gallery-users.controller';
import { adminGalleryUsersValidator } from './admin-gallery-users.validator';
import { validate } from '../../../middleware/validation.middleware';
import { authenticate, requireAdminAccess, requirePermission } from '../../../middleware/auth.middleware';

const router = Router();

// All routes require authentication and admin access
router.use(authenticate());
router.use(requireAdminAccess());

/**
 * @route GET /api/admin/gallery-users/statistics
 * @desc Get gallery users statistics
 * @access Admin (gallery_users.read)
 */
router.get(
  '/statistics',
  requirePermission('gallery_users.read'),
  adminGalleryUsersController.getStatistics
);

/**
 * @route POST /api/admin/gallery-users/send-notification
 * @desc Send notification to all/filtered users
 * @access Admin (gallery_users.manage)
 */
router.post(
  '/send-notification',
  requirePermission('gallery_users.manage'),
  validate(adminGalleryUsersValidator.sendBulkNotification),
  adminGalleryUsersController.sendBulkNotification
);

/**
 * @route GET /api/admin/gallery-users/quota-statistics
 * @desc Get quota statistics across all users
 * @access Admin (gallery_users.read)
 */
router.get(
  '/quota-statistics',
  requirePermission('gallery_users.read'),
  adminGalleryUsersController.getQuotaStatistics
);

/**
 * @route GET /api/admin/gallery-users/custom-quotas
 * @desc Get all users with custom quotas
 * @access Admin (gallery_users.read)
 */
router.get(
  '/custom-quotas',
  requirePermission('gallery_users.read'),
  validate(adminGalleryUsersValidator.list),
  adminGalleryUsersController.getUsersWithCustomQuotas
);

/**
 * @route GET /api/admin/gallery-users
 * @desc List gallery users with pagination
 * @access Admin (gallery_users.read)
 */
router.get(
  '/',
  requirePermission('gallery_users.read'),
  validate(adminGalleryUsersValidator.list),
  adminGalleryUsersController.list
);

/**
 * @route GET /api/admin/gallery-users/:id
 * @desc Get gallery user by ID
 * @access Admin (gallery_users.read)
 */
router.get(
  '/:id',
  requirePermission('gallery_users.read'),
  validate(adminGalleryUsersValidator.userId),
  adminGalleryUsersController.getById
);

/**
 * @route PATCH /api/admin/gallery-users/:id
 * @desc Update gallery user
 * @access Admin (gallery_users.update)
 */
router.patch(
  '/:id',
  requirePermission('gallery_users.update'),
  validate(adminGalleryUsersValidator.update),
  adminGalleryUsersController.update
);

/**
 * @route DELETE /api/admin/gallery-users/:id
 * @desc Delete gallery user (soft delete)
 * @access Admin (gallery_users.delete)
 */
router.delete(
  '/:id',
  requirePermission('gallery_users.delete'),
  validate(adminGalleryUsersValidator.userId),
  adminGalleryUsersController.delete
);

/**
 * @route POST /api/admin/gallery-users/:id/toggle-status
 * @desc Toggle user active status
 * @access Admin (gallery_users.update)
 */
router.post(
  '/:id/toggle-status',
  requirePermission('gallery_users.update'),
  validate(adminGalleryUsersValidator.userId),
  adminGalleryUsersController.toggleStatus
);

/**
 * @route POST /api/admin/gallery-users/:id/upgrade-to-panel
 * @desc Upgrade gallery user to panel user
 * @access Admin (gallery_users.manage)
 */
router.post(
  '/:id/upgrade-to-panel',
  requirePermission('gallery_users.manage'),
  validate(adminGalleryUsersValidator.upgradeToPanel),
  adminGalleryUsersController.upgradeToPanel
);

/**
 * @route POST /api/admin/gallery-users/:id/remove-panel-access
 * @desc Remove panel access from gallery user
 * @access Admin (gallery_users.manage)
 */
router.post(
  '/:id/remove-panel-access',
  requirePermission('gallery_users.manage'),
  validate(adminGalleryUsersValidator.userId),
  adminGalleryUsersController.removePanelAccess
);

/**
 * @route GET /api/admin/gallery-users/:id/activity
 * @desc Get user activity log
 * @access Admin (gallery_users.read)
 */
router.get(
  '/:id/activity',
  requirePermission('gallery_users.read'),
  validate(adminGalleryUsersValidator.activity),
  adminGalleryUsersController.getActivity
);

/**
 * @route POST /api/admin/gallery-users/:id/send-notification
 * @desc Send notification to specific user
 * @access Admin (gallery_users.manage)
 */
router.post(
  '/:id/send-notification',
  requirePermission('gallery_users.manage'),
  validate(adminGalleryUsersValidator.sendNotification),
  adminGalleryUsersController.sendNotification
);

// ==================== QUOTA MANAGEMENT ====================

/**
 * @route GET /api/admin/gallery-users/:id/quota
 * @desc Get user's token quota
 * @access Admin (gallery_users.read)
 */
router.get(
  '/:id/quota',
  requirePermission('gallery_users.read'),
  validate(adminGalleryUsersValidator.userId),
  adminGalleryUsersController.getUserQuota
);

/**
 * @route GET /api/admin/gallery-users/:id/quota/history
 * @desc Get user's quota transaction history
 * @access Admin (gallery_users.read)
 */
router.get(
  '/:id/quota/history',
  requirePermission('gallery_users.read'),
  validate(adminGalleryUsersValidator.quotaHistory),
  adminGalleryUsersController.getUserQuotaHistory
);

/**
 * @route POST /api/admin/gallery-users/:id/quota/reset
 * @desc Reset user's quota
 * @access Admin (gallery_users.manage)
 */
router.post(
  '/:id/quota/reset',
  requirePermission('gallery_users.manage'),
  validate(adminGalleryUsersValidator.resetQuota),
  adminGalleryUsersController.resetUserQuota
);

/**
 * @route POST /api/admin/gallery-users/:id/quota/add-tokens
 * @desc Add bonus tokens to user
 * @access Admin (gallery_users.manage)
 */
router.post(
  '/:id/quota/add-tokens',
  requirePermission('gallery_users.manage'),
  validate(adminGalleryUsersValidator.addBonusTokens),
  adminGalleryUsersController.addBonusTokens
);

/**
 * @route POST /api/admin/gallery-users/:id/quota/set-custom
 * @desc Set custom quota limit for user
 * @access Admin (gallery_users.manage)
 */
router.post(
  '/:id/quota/set-custom',
  requirePermission('gallery_users.manage'),
  validate(adminGalleryUsersValidator.setCustomQuota),
  adminGalleryUsersController.setCustomQuota
);

/**
 * @route POST /api/admin/gallery-users/:id/quota/remove-custom
 * @desc Remove custom quota (revert to tier default)
 * @access Admin (gallery_users.manage)
 */
router.post(
  '/:id/quota/remove-custom',
  requirePermission('gallery_users.manage'),
  validate(adminGalleryUsersValidator.removeCustomQuota),
  adminGalleryUsersController.removeCustomQuota
);

export const adminGalleryUsersRouter = router;
