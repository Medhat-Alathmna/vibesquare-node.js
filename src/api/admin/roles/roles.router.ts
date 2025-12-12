import { Router } from 'express';
import { rolesController } from './roles.controller';
import { rolesValidator } from './roles.validator';
import { validate } from '../../../middleware/validation.middleware';
import { authenticate, requireAdminAccess, requirePermission } from '../../../middleware/auth.middleware';

const router = Router();

// All routes require authentication and admin access
router.use(authenticate());
router.use(requireAdminAccess());

// ============================================
// Roles Routes
// ============================================

// GET /api/admin/roles - List all roles
router.get(
  '/',
  requirePermission('roles.read'),
  rolesController.getRoles
);

// GET /api/admin/roles/:id - Get role by ID
router.get(
  '/:id',
  requirePermission('roles.read'),
  rolesController.getRoleById
);

// POST /api/admin/roles - Create new role
router.post(
  '/',
  requirePermission('roles.create'),
  validate(rolesValidator.createRole),
  rolesController.createRole
);

// PATCH /api/admin/roles/:id - Update role
router.patch(
  '/:id',
  requirePermission('roles.update'),
  validate(rolesValidator.updateRole),
  rolesController.updateRole
);

// DELETE /api/admin/roles/:id - Delete role
router.delete(
  '/:id',
  requirePermission('roles.delete'),
  rolesController.deleteRole
);

export default router;
