import { Request, Response } from 'express';
import httpStatus from 'http-status';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { ApiResponse } from '../../../shared/utils/ApiResponse';
import { notificationsService } from './notifications.service';

export const notificationsController = {
  /**
   * Get user's notifications
   * GET /api/gallery/notifications
   */
  list: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { page = 1, limit = 20 } = req.query;

    const result = await notificationsService.getNotifications(
      req.galleryUser.id,
      Number(page),
      Number(limit)
    );

    res.json(ApiResponse.success(result));
  }),

  /**
   * Get unread count
   * GET /api/gallery/notifications/unread-count
   */
  unreadCount: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const count = await notificationsService.getUnreadCount(req.galleryUser.id);

    res.json(ApiResponse.success({ count }));
  }),

  /**
   * Mark notification as read
   * PATCH /api/gallery/notifications/:id/read
   */
  markAsRead: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { id } = req.params;

    await notificationsService.markAsRead(req.galleryUser.id, id);

    res.json(ApiResponse.success(null, 'Notification marked as read'));
  }),

  /**
   * Mark all notifications as read
   * PATCH /api/gallery/notifications/read-all
   */
  markAllAsRead: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    await notificationsService.markAllAsRead(req.galleryUser.id);

    res.json(ApiResponse.success(null, 'All notifications marked as read'));
  }),

  /**
   * Delete a notification
   * DELETE /api/gallery/notifications/:id
   */
  delete: asyncHandler(async (req: Request, res: Response) => {
    if (!req.galleryUser) {
      return res.status(httpStatus.UNAUTHORIZED).json(
        ApiResponse.error('Authentication required', httpStatus.UNAUTHORIZED)
      );
    }

    const { id } = req.params;

    await notificationsService.deleteNotification(req.galleryUser.id, id);

    res.json(ApiResponse.success(null, 'Notification deleted'));
  })
};
