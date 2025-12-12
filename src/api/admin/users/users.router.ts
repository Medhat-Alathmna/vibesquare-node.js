import { Router } from 'express';
import { usersController } from './users.controller';
import { usersValidator } from './users.validator';
import { validate } from '../../../middleware/validation.middleware';
import { authenticate, requireAdminAccess, requirePermission } from '../../../middleware/auth.middleware';

const router = Router();

// All routes require authentication and admin access
router.use(authenticate());
router.use(requireAdminAccess());

// GET /api/admin/users - List all users
router.get(
  '/',
  requirePermission('users.read'),
  usersController.getUsers
);

// GET /api/admin/users/:id - Get user by ID
router.get(
  '/:id',
  requirePermission('users.read'),
  usersController.getUserById
);

// POST /api/admin/users - Create new user
router.post(
  '/',
  requirePermission('users.create'),
  validate(usersValidator.createUser),
  usersController.createUser
);

// PATCH /api/admin/users/:id - Update user
router.patch(
  '/:id',
  requirePermission('users.update'),
  validate(usersValidator.updateUser),
  usersController.updateUser
);

// DELETE /api/admin/users/:id - Delete user
router.delete(
  '/:id',
  requirePermission('users.delete'),
  usersController.deleteUser
);

// POST /api/admin/users/:id/reset-password - Reset user password
router.post(
  '/:id/reset-password',
  requirePermission('users.manage'),
  validate(usersValidator.resetPassword),
  usersController.resetPassword
);

// POST /api/admin/users/:id/toggle-status - Toggle user active status
router.post(
  '/:id/toggle-status',
  requirePermission('users.update'),
  usersController.toggleStatus
);

// POST /api/admin/users/:id/assign-role - Assign role to user
router.post(
  '/:id/assign-role',
  requirePermission(['users.update', 'roles.update']),
  validate(usersValidator.assignRole),
  usersController.assignRole
);

export default router;
