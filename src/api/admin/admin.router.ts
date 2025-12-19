import { Router } from 'express';
import { usersRouter } from './users';
import { rolesRouter } from './roles';
import { adminGalleryUsersRouter } from './gallery-users';
import { rolesController } from './roles/roles.controller';
import { authenticate, requireAdminAccess, requirePermission } from '../../middleware/auth.middleware';

const router = Router();

// Users management (Panel Users)
router.use('/users', usersRouter);

// Roles management
router.use('/roles', rolesRouter);

// Gallery Users management
router.use('/gallery-users', adminGalleryUsersRouter);

// Permissions routes (separate from roles for easier access)
router.get(
  '/permissions',
  authenticate(),
  requireAdminAccess(),
  requirePermission('roles.read'),
  rolesController.getPermissions
);

router.get(
  '/permissions/grouped',
  authenticate(),
  requireAdminAccess(),
  requirePermission('roles.read'),
  rolesController.getPermissionsGrouped
);

export default router;
