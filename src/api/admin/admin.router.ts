import { Router } from 'express';
import { usersRouter } from './users';
import { rolesRouter } from './roles';
import { rolesController } from './roles/roles.controller';
import { authenticate, requireAdminAccess, requirePermission } from '../../middleware/auth.middleware';

const router = Router();

// Users management
router.use('/users', usersRouter);

// Roles management
router.use('/roles', rolesRouter);

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
