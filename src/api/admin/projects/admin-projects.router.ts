import { Router } from 'express';
import { adminProjectsController } from './admin-projects.controller';
import { adminProjectsValidator } from './admin-projects.validator';
import { validate } from '../../../middleware/validation.middleware';
import { authenticate, requireAdminAccess, requirePermission } from '../../../middleware/auth.middleware';

const router = Router();

// All routes require authentication and admin access
router.use(authenticate());
router.use(requireAdminAccess());

/**
 * @route GET /api/admin/projects
 * @desc List projects with pagination and filters
 * @access Admin (projects.read)
 */
router.get(
  '/',
  requirePermission('projects.read'),
  validate(adminProjectsValidator.list),
  adminProjectsController.list
);

/**
 * @route POST /api/admin/projects
 * @desc Create a new project
 * @access Admin (projects.create)
 */
router.post(
  '/',
  requirePermission('projects.create'),
  validate(adminProjectsValidator.create),
  adminProjectsController.create
);

/**
 * @route GET /api/admin/projects/:id
 * @desc Get project by ID
 * @access Admin (projects.read)
 */
router.get(
  '/:id',
  requirePermission('projects.read'),
  validate(adminProjectsValidator.projectId),
  adminProjectsController.getById
);

/**
 * @route PATCH /api/admin/projects/:id
 * @desc Update project
 * @access Admin (projects.update)
 */
router.patch(
  '/:id',
  requirePermission('projects.update'),
  validate(adminProjectsValidator.update),
  adminProjectsController.update
);

/**
 * @route DELETE /api/admin/projects/:id
 * @desc Delete project
 * @access Admin (projects.delete)
 */
router.delete(
  '/:id',
  requirePermission('projects.delete'),
  validate(adminProjectsValidator.projectId),
  adminProjectsController.delete
);

export const adminProjectsRouter = router;
