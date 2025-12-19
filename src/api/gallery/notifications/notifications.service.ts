import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import { IGalleryNotification, NotificationType, PaginatedResult } from '../gallery.types';
import { galleryNotificationRepository } from '../../../shared/repositories/postgres/gallery.repository';

export class NotificationsService {
  /**
   * Get user's notifications with pagination
   */
  async getNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResult<IGalleryNotification>> {
    return galleryNotificationRepository.findByUserId(userId, page, limit);
  }

  /**
   * Get unread notifications count
   */
  async getUnreadCount(userId: string): Promise<number> {
    return galleryNotificationRepository.countUnread(userId);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<void> {
    // Note: We should verify the notification belongs to the user
    // For now, we trust the notification ID
    await galleryNotificationRepository.markAsRead(notificationId);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    await galleryNotificationRepository.markAllAsRead(userId);
  }

  /**
   * Delete a notification
   */
  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const deleted = await galleryNotificationRepository.delete(notificationId);
    if (!deleted) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Notification not found');
    }
  }

  /**
   * Create a notification for a user
   */
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<IGalleryNotification> {
    return galleryNotificationRepository.create({
      userId,
      type,
      title,
      message,
      data: data || {}
    });
  }

  /**
   * Create notifications for multiple users (bulk)
   */
  async createBulkNotifications(
    userIds: string[],
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<number> {
    return galleryNotificationRepository.createBulk(userIds, {
      type,
      title,
      message,
      data: data || {}
    });
  }

  /**
   * Send "download available" notification
   * Called when a free user's cooldown expires
   */
  async sendDownloadAvailableNotification(userId: string): Promise<void> {
    await this.createNotification(
      userId,
      'download_available',
      'Download Available!',
      'Your download cooldown has expired. You can now download a new project.',
      { action: 'download' }
    );
  }

  /**
   * Send "subscription expiring" notification
   * Called before subscription expires
   */
  async sendSubscriptionExpiringNotification(
    userId: string,
    daysRemaining: number
  ): Promise<void> {
    await this.createNotification(
      userId,
      'subscription_expiring',
      'Subscription Expiring Soon',
      `Your premium subscription will expire in ${daysRemaining} day(s). Renew now to continue enjoying unlimited downloads and AI features.`,
      { daysRemaining, action: 'renew' }
    );
  }

  /**
   * Clean up old notifications (older than 30 days)
   */
  async cleanupOldNotifications(): Promise<number> {
    return galleryNotificationRepository.deleteOld(30);
  }
}

export const notificationsService = new NotificationsService();
