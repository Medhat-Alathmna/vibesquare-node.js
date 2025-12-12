import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { rolesService } from './roles.service';
import { ApiResponse } from '../../../shared/utils/ApiResponse';
import { asyncHandler } from '../../../shared/utils/asyncHandler';

export class RolesController {
  /**
   * Get all roles
   * GET /api/admin/roles
   */
  getRoles = asyncHandler(async (req: Request, res: Response) => {
    const result = await rolesService.getRoles();

    res.status(httpStatus.OK).json(
      ApiResponse.success(result, 'Roles retrieved successfully')
    );
  });

  /**
   * Get role by ID
   * GET /api/admin/roles/:id
   */
  getRoleById = asyncHandler(async (req: Request, res: Response) => {
    const role = await rolesService.getRoleById(req.params.id);

    res.status(httpStatus.OK).json(
      ApiResponse.success({ role }, 'Role retrieved successfully')
    );
  });

  /**
   * Create new role
   * POST /api/admin/roles
   */
  createRole = asyncHandler(async (req: Request, res: Response) => {
    const role = await rolesService.createRole(req.body);

    res.status(httpStatus.CREATED).json(
      ApiResponse.success({ role }, 'Role created successfully')
    );
  });

  /**
   * Update role
   * PATCH /api/admin/roles/:id
   */
  updateRole = asyncHandler(async (req: Request, res: Response) => {
    const role = await rolesService.updateRole(req.params.id, req.body);

    res.status(httpStatus.OK).json(
      ApiResponse.success({ role }, 'Role updated successfully')
    );
  });

  /**
   * Delete role
   * DELETE /api/admin/roles/:id
   */
  deleteRole = asyncHandler(async (req: Request, res: Response) => {
    await rolesService.deleteRole(req.params.id);

    res.status(httpStatus.OK).json(
      ApiResponse.success(null, 'Role deleted successfully')
    );
  });

  /**
   * Get all permissions
   * GET /api/admin/permissions
   */
  getPermissions = asyncHandler(async (req: Request, res: Response) => {
    const result = await rolesService.getPermissions();

    res.status(httpStatus.OK).json(
      ApiResponse.success(result, 'Permissions retrieved successfully')
    );
  });

  /**
   * Get permissions grouped by module
   * GET /api/admin/permissions/grouped
   */
  getPermissionsGrouped = asyncHandler(async (req: Request, res: Response) => {
    const grouped = await rolesService.getPermissionsGrouped();

    res.status(httpStatus.OK).json(
      ApiResponse.success({ permissions: grouped }, 'Permissions retrieved successfully')
    );
  });
}

export const rolesController = new RolesController();
