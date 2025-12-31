import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import {
  IGalleryUser,
  SafeGalleryUser,
  PublicGalleryProfile,
  UpdateGalleryProfileRequest,
  CanDownloadResponse,
  ISocialLinks,
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_PATTERN,
  RESERVED_USERNAMES,
  FREE_USER_DOWNLOAD_COOLDOWN_MS,
  FREE_USER_DOWNLOAD_COOLDOWN_DAYS,
  EnhancedPublicProfile,
  OwnProfileStats,
  FavoriteWithProject,
  ActivityLogItem,
  PaginatedResult,
  AnalysisHistoryItem,
  IGalleryActivityLog,
  ActivityAction,
  QUOTA_LIMITS
} from '../gallery.types';
import {
  galleryUserRepository,
  galleryActivityLogRepository,
  galleryFavoritesRepository
} from '../../../shared/repositories/postgres/gallery.repository';
import { galleryTokenService } from '../auth/gallery-token.service';
import { galleryAnalysisRepository } from '../../../shared/repositories/postgres/gallery-analysis.repository';
import { galleryTokenUsageRepository } from '../../../shared/repositories/postgres/gallery-token.repository';
import { getProjectRepository } from '../../../shared/repositories';

export class GalleryUsersService {
  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<IGalleryUser | null> {
    return galleryUserRepository.findById(id);
  }

  /**
   * Get public profile by username
   */
  async getPublicProfile(username: string): Promise<PublicGalleryProfile | null> {
    const user = await galleryUserRepository.findByUsername(username.toLowerCase());

    if (!user || !user.isActive) {
      return null;
    }

    return {
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      socialLinks: user.socialLinks,
      createdAt: user.createdAt
    };
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: UpdateGalleryProfileRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SafeGalleryUser> {
    const user = await galleryUserRepository.findById(userId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Validate username if being changed
    if (data.username && data.username.toLowerCase() !== user.username) {
      this.validateUsername(data.username);

      // Check if username is taken
      const existingUser = await galleryUserRepository.findByUsername(data.username.toLowerCase());
      if (existingUser && existingUser.id !== userId) {
        throw new ApiError(httpStatus.CONFLICT, 'Username already taken');
      }
    }

    // Validate social links
    if (data.socialLinks) {
      this.validateSocialLinks(data.socialLinks);
    }

    // Prepare update data
    const updateData: Partial<IGalleryUser> = {};

    if (data.username) {
      updateData.username = data.username.toLowerCase();
    }
    if (data.avatarUrl !== undefined) {
      updateData.avatarUrl = data.avatarUrl;
    }
    if (data.bio !== undefined) {
      // Limit bio to 500 characters
      updateData.bio = data.bio?.slice(0, 500);
    }
    if (data.socialLinks) {
      // Merge with existing social links
      updateData.socialLinks = {
        ...user.socialLinks,
        ...data.socialLinks
      };
    }

    const updatedUser = await galleryUserRepository.update(userId, updateData);

    if (!updatedUser) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update profile');
    }

    // Log activity
    await galleryActivityLogRepository.create({
      userId,
      action: 'profile_update',
      metadata: { fields: Object.keys(updateData) },
      ipAddress,
      userAgent
    });

    return this.toSafeUser(updatedUser);
  }

  /**
   * Check if user can download
   */
  canDownload(user: IGalleryUser): CanDownloadResponse {
    // Must be email verified
    if (!user.emailVerified) {
      return {
        canDownload: false,
        reason: 'not_verified'
      };
    }

    // Pro users can always download
    if (user.subscriptionTier === 'pro') {
      return {
        canDownload: true,
        reason: 'ok'
      };
    }

    // Free users: check cooldown
    if (!user.lastDownloadAt) {
      return {
        canDownload: true,
        reason: 'ok'
      };
    }

    const lastDownload = user.lastDownloadAt.getTime();
    const now = Date.now();
    const cooldownEnd = lastDownload + FREE_USER_DOWNLOAD_COOLDOWN_MS;

    if (now >= cooldownEnd) {
      return {
        canDownload: true,
        reason: 'ok'
      };
    }

    return {
      canDownload: false,
      reason: 'cooldown',
      nextDownloadAt: new Date(cooldownEnd),
      remainingCooldown: Math.ceil((cooldownEnd - now) / 1000)
    };
  }

  /**
   * Record a download
   */
  async recordDownload(
    userId: string,
    projectId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const user = await galleryUserRepository.findById(userId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Check eligibility
    const eligibility = this.canDownload(user);
    if (!eligibility.canDownload) {
      if (eligibility.reason === 'not_verified') {
        throw new ApiError(httpStatus.FORBIDDEN, 'Email verification required to download');
      }

      const remainingHours = Math.ceil((eligibility.remainingCooldown || 0) / 3600);
      throw new ApiError(
        httpStatus.TOO_MANY_REQUESTS,
        `Download limit reached. Try again in ${remainingHours} hours, or upgrade to Premium.`,
        false,
        '',
        {
          reason: 'cooldown',
          nextDownloadAt: eligibility.nextDownloadAt?.toISOString(),
          remainingSeconds: eligibility.remainingCooldown
        }
      );
    }

    // Update last download time
    await galleryUserRepository.updateLastDownload(userId);

    // Log activity
    await galleryActivityLogRepository.create({
      userId,
      action: 'download',
      resourceType: 'project',
      resourceId: projectId,
      metadata: { projectId },
      ipAddress,
      userAgent
    });
  }

  /**
   * Soft delete user account
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await galleryUserRepository.findById(userId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Soft delete
    await galleryUserRepository.softDelete(userId);

    // Revoke all tokens
    await galleryTokenService.revokeAllUserTokens(userId);
  }

  /**
   * Get enhanced public profile with stats
   */
  async getEnhancedPublicProfile(username: string): Promise<EnhancedPublicProfile | null> {
    const user = await galleryUserRepository.findByUsername(username.toLowerCase());

    if (!user || !user.isActive) {
      return null;
    }

    // Get stats in parallel
    const [favoritesCount, analysesCount] = await Promise.all([
      galleryFavoritesRepository.countByUserId(user.id),
      galleryAnalysisRepository.countByUserId(user.id)
    ]);

    return {
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      socialLinks: user.socialLinks,
      subscriptionTier: user.subscriptionTier,
      memberSince: user.createdAt,
      stats: {
        totalFavorites: favoritesCount,
        totalAnalyses: analysesCount
      }
    };
  }

  /**
   * Get detailed stats for own profile
   */
  async getOwnProfileStats(userId: string): Promise<OwnProfileStats> {
    const user = await galleryUserRepository.findById(userId);

    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Get all stats in parallel
    const [favoritesCount, analysesCount, tokenUsage, lastActivity] = await Promise.all([
      galleryFavoritesRepository.countByUserId(userId),
      galleryAnalysisRepository.countByUserId(userId),
      galleryTokenUsageRepository.findByUserId(userId),
      galleryActivityLogRepository.getLastActivityDate(userId)
    ]);

    const quotaLimit = QUOTA_LIMITS[user.subscriptionTier];
    const tokensUsedThisWeek = tokenUsage?.tokensUsed || 0;
    const quotaRemaining = Math.max(0, quotaLimit - tokensUsedThisWeek);

    return {
      totalFavorites: favoritesCount,
      totalAnalyses: analysesCount,
      totalTokensUsed: tokenUsage?.totalTokensUsed || 0,
      tokensUsedThisWeek,
      analysisThisWeek: tokenUsage?.analysisCount || 0,
      quotaLimit,
      quotaRemaining,
      quotaPeriodEnd: tokenUsage?.quotaPeriodEnd || new Date(),
      lastActiveAt: lastActivity || undefined,
      lastAnalysisAt: tokenUsage?.lastAnalysisAt,
      memberSince: user.createdAt
    };
  }

  /**
   * Get user's favorites with project details (public)
   */
  async getUserFavoritesWithProjects(
    username: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResult<FavoriteWithProject>> {
    const user = await galleryUserRepository.findByUsername(username.toLowerCase());

    if (!user || !user.isActive) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const favorites = await galleryFavoritesRepository.findByUserId(user.id, page, limit);
    const projectIds = favorites.data.map(f => f.projectId);

    // Fetch project details
    const projectRepository = getProjectRepository();
    const projects = await projectRepository.findByIds(projectIds);
    const projectMap = new Map(projects.map(p => [p.id, p]));

    const favoritesWithProjects: FavoriteWithProject[] = favorites.data.map(fav => {
      const project = projectMap.get(fav.projectId);
      return {
        id: fav.id,
        projectId: fav.projectId,
        favoritedAt: fav.createdAt,
        project: project ? {
          id: project.id,
          title: project.title,
          shortDescription: project.shortDescription,
          thumbnail: project.thumbnail,
          framework: project.framework,
          category: project.category,
          tags: project.tags,
          likes: project.likes,
          views: project.views
        } : null
      };
    });

    return {
      data: favoritesWithProjects,
      total: favorites.total,
      page: favorites.page,
      limit: favorites.limit,
      totalPages: favorites.totalPages
    };
  }

  /**
   * Get own analysis history (paginated)
   */
  async getOwnAnalysisHistory(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResult<AnalysisHistoryItem>> {
    return galleryAnalysisRepository.findByUserId(userId, page, limit);
  }

  /**
   * Get own activity log (paginated)
   */
  async getOwnActivityLog(
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<PaginatedResult<ActivityLogItem>> {
    const activities = await galleryActivityLogRepository.findByUserId(userId, page, limit);

    // Map to ActivityLogItem with human-readable descriptions
    const activityItems: ActivityLogItem[] = activities.data.map(activity => ({
      id: activity.id,
      action: activity.action,
      resourceType: activity.resourceType,
      resourceId: activity.resourceId,
      description: this.formatActivityDescription(activity),
      createdAt: activity.createdAt
    }));

    return {
      data: activityItems,
      total: activities.total,
      page: activities.page,
      limit: activities.limit,
      totalPages: activities.totalPages
    };
  }

  /**
   * Format activity to human-readable description
   */
  private formatActivityDescription(activity: IGalleryActivityLog): string {
    const actionDescriptions: Record<ActivityAction, string> = {
      login: 'Logged in',
      logout: 'Logged out',
      download: 'Downloaded project',
      favorite: 'Added to favorites',
      unfavorite: 'Removed from favorites',
      view: 'Viewed project',
      ai_use: 'Ran AI analysis',
      profile_update: 'Updated profile'
    };

    let description = actionDescriptions[activity.action] || activity.action;

    if (activity.resourceType && activity.resourceId) {
      description += ` (${activity.resourceType}: ${activity.resourceId})`;
    }

    return description;
  }

  /**
   * Validate username
   */
  private validateUsername(username: string): void {
    if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters`
      );
    }

    if (!USERNAME_PATTERN.test(username.toLowerCase())) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Username must start with a letter and contain only lowercase letters, numbers, and underscores'
      );
    }

    if (RESERVED_USERNAMES.includes(username.toLowerCase())) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'This username is not available');
    }
  }

  /**
   * Validate social links
   */
  private validateSocialLinks(links: Partial<ISocialLinks>): void {
    const urlPattern = /^https?:\/\/.+/;

    for (const [key, value] of Object.entries(links)) {
      if (value && value.trim() && !urlPattern.test(value)) {
        throw new ApiError(httpStatus.BAD_REQUEST, `Invalid URL for ${key}`);
      }
    }
  }

  /**
   * Convert to safe user (public data)
   */
  toSafeUser(user: IGalleryUser): SafeGalleryUser {
    const downloadStatus = this.canDownload(user);

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
      canDownload: downloadStatus.canDownload,
      hasPanelAccess: !!user.panelUserId,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    };
  }
}

export const galleryUsersService = new GalleryUsersService();
