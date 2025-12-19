import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { notificationsValidator } from './notifications.validator';
import { validate } from '../../../middleware/validation.middleware';
import { galleryAuthenticate } from '../../../middleware/gallery-auth.middleware';

const router = Router();

/**
 * @route GET /api/gallery/notifications
 * @desc Get user's notifications with pagination
 * @access Private
 */
router.get(
  '/',
  galleryAuthenticate(),
  validate(notificationsValidator.list),
  notificationsController.list
);

/**
 * @route GET /api/gallery/notifications/unread-count
 * @desc Get unread notifications count
 * @access Private
 */
router.get(
  '/unread-count',
  galleryAuthenticate(),
  notificationsController.unreadCount
);

/**
 * @route PATCH /api/gallery/notifications/read-all
 * @desc Mark all notifications as read
 * @access Private
 */
router.patch(
  '/read-all',
  galleryAuthenticate(),
  notificationsController.markAllAsRead
);

/**
 * @route PATCH /api/gallery/notifications/:id/read
 * @desc Mark a notification as read
 * @access Private
 */
router.patch(
  '/:id/read',
  galleryAuthenticate(),
  validate(notificationsValidator.notificationId),
  notificationsController.markAsRead
);

/**
 * @route DELETE /api/gallery/notifications/:id
 * @desc Delete a notification
 * @access Private
 */
router.delete(
  '/:id',
  galleryAuthenticate(),
  validate(notificationsValidator.notificationId),
  notificationsController.delete
);

export const notificationsRouter = router;
