import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { usersService } from './users.service';
import { ApiResponse } from '../../../shared/utils/ApiResponse';
import { asyncHandler } from '../../../shared/utils/asyncHandler';

export class UsersController {
  /**
   * Get all users
   * GET /api/admin/users
   */
  getUsers = asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20 } = req.query;

    const result = await usersService.getUsers({
      page: Number(page),
      limit: Number(limit)
    });

    res.status(httpStatus.OK).json(
      ApiResponse.success(result, 'Users retrieved successfully')
    );
  });

  /**
   * Get user by ID
   * GET /api/admin/users/:id
   */
  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.getUserById(req.params.id);

    res.status(httpStatus.OK).json(
      ApiResponse.success({ user }, 'User retrieved successfully')
    );
  });

  /**
   * Create new user
   * POST /api/admin/users
   */
  createUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.createUser(req.body);

    res.status(httpStatus.CREATED).json(
      ApiResponse.success({ user }, 'User created successfully')
    );
  });

  /**
   * Update user
   * PATCH /api/admin/users/:id
   */
  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.updateUser(req.params.id, req.body);

    res.status(httpStatus.OK).json(
      ApiResponse.success({ user }, 'User updated successfully')
    );
  });

  /**
   * Delete user
   * DELETE /api/admin/users/:id
   */
  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    await usersService.deleteUser(req.params.id);

    res.status(httpStatus.OK).json(
      ApiResponse.success(null, 'User deleted successfully')
    );
  });

  /**
   * Reset user password
   * POST /api/admin/users/:id/reset-password
   */
  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { newPassword } = req.body;
    await usersService.resetUserPassword(req.params.id, newPassword);

    res.status(httpStatus.OK).json(
      ApiResponse.success(null, 'Password reset successfully')
    );
  });

  /**
   * Toggle user status
   * POST /api/admin/users/:id/toggle-status
   */
  toggleStatus = asyncHandler(async (req: Request, res: Response) => {
    const user = await usersService.toggleUserStatus(req.params.id);

    res.status(httpStatus.OK).json(
      ApiResponse.success({ user }, `User ${user.isActive ? 'activated' : 'deactivated'} successfully`)
    );
  });

  /**
   * Assign role to user
   * POST /api/admin/users/:id/assign-role
   */
  assignRole = asyncHandler(async (req: Request, res: Response) => {
    const { roleId } = req.body;
    const user = await usersService.assignRole(req.params.id, roleId);

    res.status(httpStatus.OK).json(
      ApiResponse.success({ user }, 'Role assigned successfully')
    );
  });
}

export const usersController = new UsersController();
