import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import {
  IGalleryUser,
  SafeGalleryUser,
  PaginatedResult,
  FREE_USER_DOWNLOAD_COOLDOWN_MS,
  QUOTA_LIMITS,
  GallerySubscriptionTier
} from '../../gallery/gallery.types';
import {
  galleryUserRepository,
  galleryActivityLogRepository,
  galleryNotificationRepository,
  gallerySubscriptionRepository
} from '../../../shared/repositories/postgres/gallery.repository';
import {
  galleryTokenUsageRepository,
  galleryTokenTransactionRepository
} from '../../../shared/repositories/postgres/gallery-token.repository';
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
      subscriptionTier?: 'free' | 'pro';
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
      subscriptionTier?: 'free' | 'pro';
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
    proUsers: number;
    activeUsers: number;
    usersWithPanelAccess: number;
  }> {
    const [total, freeCount, proCount] = await Promise.all([
      galleryUserRepository.count(),
      galleryUserRepository.countBySubscriptionTier('free'),
      galleryUserRepository.countBySubscriptionTier('pro')
    ]);

    // For active users and panel access, we need to query
    const result = await galleryUserRepository.findAll(1, 10000);
    const activeUsers = result.data.filter(u => u.isActive).length;
    const usersWithPanelAccess = result.data.filter(u => u.panelUserId).length;

    return {
      totalUsers: total,
      freeUsers: freeCount,
      proUsers: proCount,
      activeUsers,
      usersWithPanelAccess
    };
  }

  // ==================== QUOTA MANAGEMENT ====================

  /**
   * Get user's current token quota status
   */
  async getUserQuota(userId: string): Promise<{
    userId: string;
    tier: GallerySubscriptionTier;
    quota: {
      limit: number;
      used: number;
      remaining: number;
      usagePercentage: number;
      periodStart: Date;
      periodEnd: Date;
      isCustom: boolean;
      customLimit: number | null;
      tierDefaultLimit: number;
    };
    stats: {
      totalTokensUsed: number;
      analysisCount: number;
      lastAnalysisAt: Date | null;
    };
  }> {
    const user = await galleryUserRepository.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    let usage = await galleryTokenUsageRepository.findByUserId(userId);

    // If no usage record, create one
    if (!usage) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      usage = await galleryTokenUsageRepository.create({
        userId,
        tokensUsed: 0,
        quotaPeriodStart: now,
        quotaPeriodEnd: periodEnd,
        totalTokensUsed: 0,
        analysisCount: 0,
        totalAnalysisCount: 0
      });
    }

    const hasCustomQuota = usage.customQuotaLimit !== null && usage.customQuotaLimit !== undefined;
    const customLimit = hasCustomQuota ? Number(usage.customQuotaLimit) : null;
    const tierDefaultLimit = QUOTA_LIMITS[user.subscriptionTier];
    const limit = hasCustomQuota ? customLimit! : tierDefaultLimit;

    const used = Number(usage.tokensUsed);
    const remaining = Math.max(0, limit - used);
    const usagePercentage = Math.min(100, (used / limit) * 100);

    return {
      userId,
      tier: user.subscriptionTier,
      quota: {
        limit,
        used,
        remaining,
        usagePercentage: Math.round(usagePercentage * 10) / 10,
        periodStart: usage.quotaPeriodStart,
        periodEnd: usage.quotaPeriodEnd,
        isCustom: hasCustomQuota,
        customLimit: customLimit,
        tierDefaultLimit: tierDefaultLimit
      },
      stats: {
        totalTokensUsed: Number(usage.totalTokensUsed),
        analysisCount: usage.analysisCount,
        lastAnalysisAt: usage.lastAnalysisAt || null
      }
    };
  }

  /**
   * Get user's token transaction history
   */
  async getUserQuotaHistory(userId: string, page: number = 1, limit: number = 50) {
    const user = await galleryUserRepository.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    return galleryTokenTransactionRepository.findByUserId(userId, page, limit);
  }

  /**
   * Reset user's token quota
   */
  async resetUserQuota(userId: string, reason: string): Promise<{
    message: string;
    newQuota: {
      limit: number;
      used: number;
      remaining: number;
      periodEnd: Date;
    };
  }> {
    const user = await galleryUserRepository.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    let usage = await galleryTokenUsageRepository.findByUserId(userId);
    const tokensBefore = usage ? Number(usage.tokensUsed) : 0;

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (usage) {
      await galleryTokenUsageRepository.resetQuota(userId, now, periodEnd);
    } else {
      usage = await galleryTokenUsageRepository.create({
        userId,
        tokensUsed: 0,
        quotaPeriodStart: now,
        quotaPeriodEnd: periodEnd,
        totalTokensUsed: 0,
        analysisCount: 0,
        totalAnalysisCount: 0
      });
    }

    // Log transaction
    await galleryTokenTransactionRepository.create({
      userId,
      type: 'reset',
      tokensAmount: 0,
      tokensBefore,
      tokensAfter: 0,
      description: `Admin reset: ${reason}`,
      metadata: {}
    });

    const limit = QUOTA_LIMITS[user.subscriptionTier];

    return {
      message: 'Quota reset successfully',
      newQuota: {
        limit,
        used: 0,
        remaining: limit,
        periodEnd
      }
    };
  }

  /**
   * Add bonus tokens to user's quota
   */
  async addBonusTokens(userId: string, amount: number, reason: string): Promise<{
    message: string;
    newQuota: {
      limit: number;
      used: number;
      remaining: number;
      bonusAdded: number;
    };
  }> {
    const user = await galleryUserRepository.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    if (amount <= 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Amount must be positive');
    }

    let usage = await galleryTokenUsageRepository.findByUserId(userId);

    if (!usage) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      usage = await galleryTokenUsageRepository.create({
        userId,
        tokensUsed: 0,
        quotaPeriodStart: now,
        quotaPeriodEnd: periodEnd,
        totalTokensUsed: 0,
        analysisCount: 0,
        totalAnalysisCount: 0
      });
    }

    const tokensBefore = Number(usage.tokensUsed);
    // Reduce used tokens (effectively adding tokens)
    const newUsed = Math.max(0, tokensBefore - amount);

    await galleryTokenUsageRepository.update(usage.id, {
      tokensUsed: newUsed
    });

    // Log transaction
    await galleryTokenTransactionRepository.create({
      userId,
      type: 'bonus',
      tokensAmount: amount,
      tokensBefore,
      tokensAfter: newUsed,
      description: `Bonus tokens: ${reason}`,
      metadata: {}
    });

    const limit = QUOTA_LIMITS[user.subscriptionTier];

    return {
      message: `${amount.toLocaleString()} tokens added successfully`,
      newQuota: {
        limit,
        used: newUsed,
        remaining: limit - newUsed,
        bonusAdded: amount
      }
    };
  }

  /**
   * Get quota statistics across all users
   */
  async getQuotaStatistics(): Promise<{
    overview: {
      totalTokensUsed: number;
      totalAnalyses: number;
      averageTokensPerAnalysis: number;
    };
    byTier: {
      free: {
        users: number;
        totalTokensUsed: number;
        averageUsagePercent: number;
        quotaExceededCount: number;
      };
      pro: {
        users: number;
        totalTokensUsed: number;
        averageUsagePercent: number;
        quotaExceededCount: number;
      };
    };
    topUsers: Array<{
      userId: string;
      username: string;
      tier: GallerySubscriptionTier;
      tokensUsed: number;
      analysisCount: number;
    }>;
  }> {
    // Get all users and their usage
    const usersResult = await galleryUserRepository.findAll(1, 10000);
    const users = usersResult.data;

    const allUsage = await galleryTokenUsageRepository.findAll();

    // Create usage map
    const usageMap = new Map(allUsage.map(u => [u.userId, u]));

    let totalTokensUsed = 0;
    let totalAnalyses = 0;

    const tierStats = {
      free: { users: 0, totalTokensUsed: 0, usageSum: 0, exceededCount: 0 },
      pro: { users: 0, totalTokensUsed: 0, usageSum: 0, exceededCount: 0 }
    };

    const userUsageList: Array<{
      userId: string;
      username: string;
      tier: GallerySubscriptionTier;
      tokensUsed: number;
      analysisCount: number;
    }> = [];

    for (const user of users) {
      const usage = usageMap.get(user.id);
      const tokensUsed = usage ? Number(usage.tokensUsed) : 0;
      const analysisCount = usage?.analysisCount || 0;
      const limit = QUOTA_LIMITS[user.subscriptionTier];

      totalTokensUsed += usage ? Number(usage.totalTokensUsed) : 0;
      totalAnalyses += analysisCount;

      const tier = user.subscriptionTier;
      tierStats[tier].users++;
      tierStats[tier].totalTokensUsed += tokensUsed;
      tierStats[tier].usageSum += (tokensUsed / limit) * 100;
      if (tokensUsed >= limit) {
        tierStats[tier].exceededCount++;
      }

      userUsageList.push({
        userId: user.id,
        username: user.username,
        tier: user.subscriptionTier,
        tokensUsed,
        analysisCount
      });
    }

    // Sort by tokens used and get top 10
    const topUsers = userUsageList
      .sort((a, b) => b.tokensUsed - a.tokensUsed)
      .slice(0, 10);

    return {
      overview: {
        totalTokensUsed,
        totalAnalyses,
        averageTokensPerAnalysis: totalAnalyses > 0 ? Math.round(totalTokensUsed / totalAnalyses) : 0
      },
      byTier: {
        free: {
          users: tierStats.free.users,
          totalTokensUsed: tierStats.free.totalTokensUsed,
          averageUsagePercent: tierStats.free.users > 0
            ? Math.round(tierStats.free.usageSum / tierStats.free.users * 10) / 10
            : 0,
          quotaExceededCount: tierStats.free.exceededCount
        },
        pro: {
          users: tierStats.pro.users,
          totalTokensUsed: tierStats.pro.totalTokensUsed,
          averageUsagePercent: tierStats.pro.users > 0
            ? Math.round(tierStats.pro.usageSum / tierStats.pro.users * 10) / 10
            : 0,
          quotaExceededCount: tierStats.pro.exceededCount
        }
      },
      topUsers
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
    if (user.subscriptionTier === 'pro') return true;
    if (!user.lastDownloadAt) return true;
    const cooldownEnd = user.lastDownloadAt.getTime() + FREE_USER_DOWNLOAD_COOLDOWN_MS;
    return Date.now() >= cooldownEnd;
  }

  /**
   * Set custom quota limit for a user
   */
  async setCustomQuota(userId: string, customLimit: number, reason: string): Promise<{
    message: string;
    quota: {
      previousLimit: number;
      newLimit: number;
      isCustom: boolean;
      tier: GallerySubscriptionTier;
    };
  }> {
    const user = await galleryUserRepository.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    if (customLimit < 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Custom limit must be non-negative');
    }

    let usage = await galleryTokenUsageRepository.findByUserId(userId);
    if (!usage) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      usage = await galleryTokenUsageRepository.create({
        userId,
        tokensUsed: 0,
        quotaPeriodStart: now,
        quotaPeriodEnd: periodEnd,
        totalTokensUsed: 0,
        analysisCount: 0,
        totalAnalysisCount: 0
      });
    }

    const previousLimit = usage.customQuotaLimit ?? QUOTA_LIMITS[user.subscriptionTier];

    // Update custom quota
    await galleryTokenUsageRepository.update(userId, {
      customQuotaLimit: customLimit
    });

    // Log transaction
    await galleryTokenTransactionRepository.create({
      userId,
      type: 'custom_quota_set',
      tokensAmount: customLimit - previousLimit,
      tokensBefore: usage.tokensUsed,
      tokensAfter: usage.tokensUsed,
      description: `Admin set custom quota: ${reason}`,
      metadata: {
        previousLimit,
        newLimit: customLimit,
        tier: user.subscriptionTier,
        setBy: 'admin'
      }
    });

    return {
      message: 'Custom quota set successfully',
      quota: {
        previousLimit,
        newLimit: customLimit,
        isCustom: true,
        tier: user.subscriptionTier
      }
    };
  }

  /**
   * Remove custom quota and revert to tier default
   */
  async removeCustomQuota(userId: string, reason: string): Promise<{
    message: string;
    quota: {
      previousLimit: number;
      newLimit: number;
      isCustom: false;
      tier: GallerySubscriptionTier;
    };
  }> {
    const user = await galleryUserRepository.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Gallery user not found');
    }

    let usage = await galleryTokenUsageRepository.findByUserId(userId);
    if (!usage || usage.customQuotaLimit === null || usage.customQuotaLimit === undefined) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'User does not have a custom quota');
    }

    const previousLimit = Number(usage.customQuotaLimit);
    const tierLimit = QUOTA_LIMITS[user.subscriptionTier];

    // Remove custom quota (set to NULL)
    await galleryTokenUsageRepository.update(userId, {
      customQuotaLimit: null
    });

    // Log transaction
    await galleryTokenTransactionRepository.create({
      userId,
      type: 'custom_quota_set',
      tokensAmount: tierLimit - previousLimit,
      tokensBefore: usage.tokensUsed,
      tokensAfter: usage.tokensUsed,
      description: `Admin removed custom quota: ${reason}`,
      metadata: {
        previousLimit,
        newLimit: tierLimit,
        tier: user.subscriptionTier,
        revertedToTier: true
      }
    });

    return {
      message: 'Custom quota removed, reverted to tier default',
      quota: {
        previousLimit,
        newLimit: tierLimit,
        isCustom: false,
        tier: user.subscriptionTier
      }
    };
  }

  /**
   * Get list of users with custom quotas
   */
  async getUsersWithCustomQuotas(
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResult<{
    userId: string;
    username: string;
    email: string;
    tier: GallerySubscriptionTier;
    customLimit: number;
    tierDefaultLimit: number;
    tokensUsed: number;
  }>> {
    const offset = (page - 1) * limit;

    const allUsage = await galleryTokenUsageRepository.findAllWithCustomQuota();
    const filtered = allUsage.filter(u => u.customQuotaLimit !== null);

    const paginatedUsage = filtered.slice(offset, offset + limit);

    const results = await Promise.all(
      paginatedUsage.map(async (usage) => {
        const user = await galleryUserRepository.findById(usage.userId);
        if (!user) return null;

        return {
          userId: user.id,
          username: user.username,
          email: user.email,
          tier: user.subscriptionTier,
          customLimit: Number(usage.customQuotaLimit),
          tierDefaultLimit: QUOTA_LIMITS[user.subscriptionTier],
          tokensUsed: Number(usage.tokensUsed)
        };
      })
    );

    const data = results.filter(r => r !== null) as any[];

    return {
      data,
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit)
    };
  }
}

export const adminGalleryUsersService = new AdminGalleryUsersService();
