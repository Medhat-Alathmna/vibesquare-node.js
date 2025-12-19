import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import {
  IGalleryUser,
  SafeGalleryUser,
  PaginatedResult,
  FREE_USER_DOWNLOAD_COOLDOWN_MS
} from '../../gallery/gallery.types';
import {
  galleryUserRepository,
  galleryActivityLogRepository,
  galleryNotificationRepository,
  gallerySubscriptionRepository
} from '../../../shared/repositories/postgres/gallery.repository';
import { userRepository, roleRepository } from '../../../shared/repositories/postgres/auth.repository';
import { galleryTokenService } from '../../gallery/auth/gallery-token.service';

export class AdminGalleryUsersService {
  /**
   * Get all gallery users with pagination
   */
  async getUsers(
    page: number = 1,
    limit: number = 20,
    search?: string
  ): Promise<PaginatedResult<SafeGalleryUser>> {
    let result: PaginatedResult<IGalleryUser>;

    if (search) {
      result = await galleryUserRepository.search(search, page, limit);
    } else {
      result = await galleryUserRepository.findAll(page, limit);
    }

    return {
      ...result,
      data: result.data.map(this.toSafeUser.bind(this))
    };
  }

  /**
   * Get gallery user by ID
   */
  async getUserById(id: string): Promise<SafeGalleryUser> {
    const user = await galleryUserRepository.findById(id);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    return this.toSafeUser(user);
  }

  /**
   * Update gallery user
   */
  async updateUser(
    id: string,
    data: {
      username?: string;
      email?: string;
      avatarUrl?: string;
      bio?: string;
      isActive?: boolean;
      emailVerified?: boolean;
      subscriptionTier?: 'free' | 'premium';
    }
  ): Promise<SafeGalleryUser> {
    const user = await galleryUserRepository.findById(id);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    // Check for conflicts if email or username is being changed
    if (data.email && data.email.toLowerCase() !== user.email) {
      const existingEmail = await galleryUserRepository.findByEmail(data.email);
      if (existingEmail) {
        throw new ApiError(httpStatus.CONFLICT, 'Email already in use');
      }
    }

    if (data.username && data.username.toLowerCase() !== user.username) {
      const existingUsername = await galleryUserRepository.findByUsername(data.username);
      if (existingUsername) {
        throw new ApiError(httpStatus.CONFLICT, 'Username already in use');
      }
    }

    const updateData: Partial<IGalleryUser> = {};

    if (data.username !== undefined) updateData.username = data.username.toLowerCase();
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.emailVerified !== undefined) updateData.emailVerified = data.emailVerified;
    if (data.subscriptionTier !== undefined) {
      updateData.subscriptionTier = data.subscriptionTier;
      // Also update the subscription record
      await gallerySubscriptionRepository.updateByUserId(id, { tier: data.subscriptionTier });
    }

    const updatedUser = await galleryUserRepository.update(id, updateData);

    if (!updatedUser) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update user');
    }

    return this.toSafeUser(updatedUser);
  }

  /**
   * Toggle user active status
   */
  async toggleStatus(id: string): Promise<SafeGalleryUser> {
    const user = await galleryUserRepository.findById(id);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    const updatedUser = await galleryUserRepository.update(id, {
      isActive: !user.isActive
    });

    // If deactivating, revoke all tokens
    if (user.isActive) {
      await galleryTokenService.revokeAllUserTokens(id);
    }

    return this.toSafeUser(updatedUser!);
  }

  /**
   * Delete gallery user (soft delete)
   */
  async deleteUser(id: string): Promise<void> {
    const user = await galleryUserRepository.findById(id);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    // Soft delete
    await galleryUserRepository.softDelete(id);

    // Revoke all tokens
    await galleryTokenService.revokeAllUserTokens(id);
  }

  /**
   * Upgrade gallery user to panel user
   * Creates a copy in the users table with a role
   */
  async upgradeToPanel(galleryUserId: string, roleId: string): Promise<{ galleryUser: SafeGalleryUser; panelUserId: string }> {
    const galleryUser = await galleryUserRepository.findById(galleryUserId);

    if (!galleryUser) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    if (galleryUser.panelUserId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User already has panel access');
    }

    // Verify the role exists and has admin access
    const role = await roleRepository.findById(roleId);
    if (!role) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
    }

    if (!role.canAccessAdmin) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Selected role does not have admin access');
    }

    // Check if email already exists in panel users
    const existingPanelUser = await userRepository.findByEmail(galleryUser.email);
    if (existingPanelUser) {
      throw new ApiError(httpStatus.CONFLICT, 'Email already exists in panel users');
    }

    // Create panel user
    const panelUser = await userRepository.create({
      email: galleryUser.email,
      password: galleryUser.password, // Already hashed
      firstName: galleryUser.username, // Use username as first name
      lastName: 'User', // Default last name
      avatarUrl: galleryUser.avatarUrl,
      isActive: true,
      emailVerified: galleryUser.emailVerified,
      mustChangePassword: false,
      isSystem: false,
      roleId: roleId,
      subscriptionTier: 'free',
      googleId: galleryUser.googleId,
      githubId: galleryUser.githubId
    });

    // Link gallery user to panel user
    await galleryUserRepository.update(galleryUserId, {
      panelUserId: panelUser.id
    });

    const updatedGalleryUser = await galleryUserRepository.findById(galleryUserId);

    return {
      galleryUser: this.toSafeUser(updatedGalleryUser!),
      panelUserId: panelUser.id
    };
  }

  /**
   * Remove panel access from gallery user
   * Does NOT delete the panel user, just removes the link
   */
  async removePanelAccess(galleryUserId: string): Promise<SafeGalleryUser> {
    const galleryUser = await galleryUserRepository.findById(galleryUserId);

    if (!galleryUser) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    if (!galleryUser.panelUserId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User does not have panel access');
    }

    // Deactivate the panel user (don't delete, just deactivate)
    await userRepository.update(galleryUser.panelUserId, {
      isActive: false
    });

    // Remove the link
    await galleryUserRepository.update(galleryUserId, {
      panelUserId: undefined
    });

    const updatedGalleryUser = await galleryUserRepository.findById(galleryUserId);

    return this.toSafeUser(updatedGalleryUser!);
  }

  /**
   * Get user's activity log
   */
  async getUserActivity(userId: string, page: number = 1, limit: number = 50) {
    const user = await galleryUserRepository.findById(userId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    return galleryActivityLogRepository.findByUserId(userId, page, limit);
  }

  /**
   * Send notification to specific user
   */
  async sendNotification(
    userId: string,
    title: string,
    message: string
  ): Promise<void> {
    const user = await galleryUserRepository.findById(userId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    await galleryNotificationRepository.create({
      userId,
      type: 'system',
      title,
      message,
      data: { fromAdmin: true }
    });
  }

  /**
   * Send notification to all users
   */
  async sendBulkNotification(
    title: string,
    message: string,
    filter?: {
      subscriptionTier?: 'free' | 'premium';
      isActive?: boolean;
    }
  ): Promise<number> {
    // Get all users matching filter
    let users: IGalleryUser[];
    const result = await galleryUserRepository.findAll(1, 10000); // Get all users
    users = result.data;

    if (filter?.subscriptionTier) {
      users = users.filter(u => u.subscriptionTier === filter.subscriptionTier);
    }

    if (filter?.isActive !== undefined) {
      users = users.filter(u => u.isActive === filter.isActive);
    }

    const userIds = users.map(u => u.id);

    if (userIds.length === 0) {
      return 0;
    }

    return galleryNotificationRepository.createBulk(userIds, {
      type: 'system',
      title,
      message,
      data: { fromAdmin: true }
    });
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    totalUsers: number;
    freeUsers: number;
    premiumUsers: number;
    activeUsers: number;
    usersWithPanelAccess: number;
  }> {
    const [total, freeCount, premiumCount] = await Promise.all([
      galleryUserRepository.count(),
      galleryUserRepository.countBySubscriptionTier('free'),
      galleryUserRepository.countBySubscriptionTier('premium')
    ]);

    // For active users and panel access, we need to query
    const result = await galleryUserRepository.findAll(1, 10000);
    const activeUsers = result.data.filter(u => u.isActive).length;
    const usersWithPanelAccess = result.data.filter(u => u.panelUserId).length;

    return {
      totalUsers: total,
      freeUsers: freeCount,
      premiumUsers: premiumCount,
      activeUsers,
      usersWithPanelAccess
    };
  }

  /**
   * Convert to safe user
   */
  private toSafeUser(user: IGalleryUser): SafeGalleryUser {
    const canDownload = this.checkCanDownload(user);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      socialLinks: user.socialLinks,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      subscriptionTier: user.subscriptionTier,
      lastDownloadAt: user.lastDownloadAt,
      canDownload,
      hasPanelAccess: !!user.panelUserId,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    };
  }

  private checkCanDownload(user: IGalleryUser): boolean {
    if (user.subscriptionTier === 'premium') return true;
    if (!user.lastDownloadAt) return true;
    const cooldownEnd = user.lastDownloadAt.getTime() + FREE_USER_DOWNLOAD_COOLDOWN_MS;
    return Date.now() >= cooldownEnd;
  }
}

export const adminGalleryUsersService = new AdminGalleryUsersService();
