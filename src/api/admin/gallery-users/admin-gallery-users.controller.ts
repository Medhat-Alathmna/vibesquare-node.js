import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ApiResponse } from '../../../shared/utils/ApiResponse';
import { adminGalleryUsersService } from './admin-gallery-users.service';

export const adminGalleryUsersController = {
  /**
   * List gallery users
   * GET /api/admin/gallery-users
   */
  list: asyncHandler(async (req: Request, res: Response) => {
    const { page = 1, limit = 20, search } = req.query;

    const result = await adminGalleryUsersService.getUsers(
      Number(page),
      Number(limit),
      search as string | undefined
    );

    res.json(ApiResponse.success(result));
  }),

  /**
   * Get gallery user by ID
   * GET /api/admin/gallery-users/:id
   */
  getById: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await adminGalleryUsersService.getUserById(id);

    res.json(ApiResponse.success(user));
  }),

  /**
   * Update gallery user
   * PATCH /api/admin/gallery-users/:id
   */
  update: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await adminGalleryUsersService.updateUser(id, req.body);

    res.json(ApiResponse.success(user, 'User updated successfully'));
  }),

  /**
   * Toggle user status (active/inactive)
   * POST /api/admin/gallery-users/:id/toggle-status
   */
  toggleStatus: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await adminGalleryUsersService.toggleStatus(id);

    res.json(ApiResponse.success(user, `User ${user.isActive ? 'activated' : 'deactivated'} successfully`));
  }),

  /**
   * Delete gallery user (soft delete)
   * DELETE /api/admin/gallery-users/:id
   */
  delete: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    await adminGalleryUsersService.deleteUser(id);

    res.json(ApiResponse.success(null, 'User deleted successfully'));
  }),

  /**
   * Upgrade to panel user
   * POST /api/admin/gallery-users/:id/upgrade-to-panel
   */
  upgradeToPanel: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { roleId } = req.body;

    const result = await adminGalleryUsersService.upgradeToPanel(id, roleId);

    res.json(ApiResponse.success(result, 'User upgraded to panel successfully'));
  }),

  /**
   * Remove panel access
   * POST /api/admin/gallery-users/:id/remove-panel-access
   */
  removePanelAccess: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await adminGalleryUsersService.removePanelAccess(id);

    res.json(ApiResponse.success(user, 'Panel access removed successfully'));
  }),

  /**
   * Get user activity log
   * GET /api/admin/gallery-users/:id/activity
   */
  getActivity: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const result = await adminGalleryUsersService.getUserActivity(
      id,
      Number(page),
      Number(limit)
    );

    res.json(ApiResponse.success(result));
  }),

  /**
   * Send notification to user
   * POST /api/admin/gallery-users/:id/send-notification
   */
  sendNotification: asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { title, message } = req.body;

    await adminGalleryUsersService.sendNotification(id, title, message);

    res.json(ApiResponse.success(null, 'Notification sent successfully'));
  }),

  /**
   * Send bulk notification
   * POST /api/admin/gallery-users/send-notification
   */
  sendBulkNotification: asyncHandler(async (req: Request, res: Response) => {
    const { title, message, filter } = req.body;

    const count = await adminGalleryUsersService.sendBulkNotification(title, message, filter);

    res.json(ApiResponse.success({ sentTo: count }, `Notification sent to ${count} users`));
  }),

  /**
   * Get statistics
   * GET /api/admin/gallery-users/statistics
   */
  getStatistics: asyncHandler(async (req: Request, res: Response) => {
    const stats = await adminGalleryUsersService.getStatistics();

    res.json(ApiResponse.success(stats));
  })
};
