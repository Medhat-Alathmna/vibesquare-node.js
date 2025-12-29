import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import {
  IGalleryTokenUsage,
  IGalleryTokenTransaction,
  QuotaStatus,
  QuotaCheckResult,
  GallerySubscriptionTier,
  QUOTA_LIMITS,
  TokenDeductionMetadata,
  PaginatedResult
} from '../gallery.types';
import {
  galleryTokenUsageRepository,
  galleryTokenTransactionRepository
} from '../../../shared/repositories/postgres/gallery-token.repository';
import {
  galleryUserRepository,
  galleryNotificationRepository
} from '../../../shared/repositories/postgres/gallery.repository';

export class QuotaService {
  /**
   * Get current quota status for a user
   */
  async getQuotaStatus(userId: string): Promise<QuotaStatus> {
    // Get user's subscription tier
    const user = await galleryUserRepository.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Get or initialize token usage
    let usage = await galleryTokenUsageRepository.findByUserId(userId);
    if (!usage) {
      usage = await galleryTokenUsageRepository.initializeForUser(userId);
    }

    // Check if quota period has expired
    if (new Date() > usage.quotaPeriodEnd) {
      usage = await this.resetQuota(userId);
    }

    const tier = user.subscriptionTier as GallerySubscriptionTier;
    const limit = QUOTA_LIMITS[tier] || QUOTA_LIMITS.free;
    const remaining = Math.max(0, limit - usage.tokensUsed);

    return {
      tier,
      quota: {
        limit,
        used: usage.tokensUsed,
        remaining,
        periodStart: usage.quotaPeriodStart,
        periodEnd: usage.quotaPeriodEnd,
        analysisCount: usage.analysisCount
      },
      lifetime: {
        totalTokensUsed: usage.totalTokensUsed,
        totalAnalyses: usage.totalAnalysisCount
      }
    };
  }

  /**
   * Check if user has sufficient quota for an analysis
   */
  async checkQuota(userId: string, estimatedTokens: number): Promise<QuotaCheckResult> {
    const status = await this.getQuotaStatus(userId);
    const sufficient = status.quota.remaining >= estimatedTokens;

    return {
      sufficient,
      remaining: status.quota.remaining,
      required: estimatedTokens,
      shortfall: sufficient ? undefined : estimatedTokens - status.quota.remaining
    };
  }

  /**
   * Deduct tokens after successful analysis
   */
  async deductTokens(
    userId: string,
    tokensUsed: number,
    metadata: TokenDeductionMetadata
  ): Promise<void> {
    // Get current usage
    let usage = await galleryTokenUsageRepository.findByUserId(userId);
    if (!usage) {
      usage = await galleryTokenUsageRepository.initializeForUser(userId);
    }

    const tokensBefore = usage.tokensUsed;
    const tokensAfter = tokensBefore + tokensUsed;

    // Deduct tokens
    await galleryTokenUsageRepository.incrementTokensUsed(userId, tokensUsed, metadata.analysisUrl);

    // Log transaction
    await galleryTokenTransactionRepository.create({
      userId,
      type: 'analysis',
      tokensAmount: -tokensUsed, // Negative for deduction
      tokensBefore,
      tokensAfter,
      analysisUrl: metadata.analysisUrl,
      analysisId: metadata.analysisId,
      description: `Analysis of ${metadata.analysisUrl}`,
      metadata: { model: metadata.model }
    });

    // Check if quota is low (80% used)
    const user = await galleryUserRepository.findById(userId);
    if (user) {
      const tier = user.subscriptionTier as GallerySubscriptionTier;
      const limit = QUOTA_LIMITS[tier] || QUOTA_LIMITS.free;
      const usedPercentage = (tokensAfter / limit) * 100;

      if (usedPercentage >= 80 && usedPercentage < 100) {
        await galleryNotificationRepository.create({
          userId,
          type: 'system',
          title: 'Quota Running Low',
          message: `You have used ${usedPercentage.toFixed(0)}% of your weekly token quota. Consider upgrading to Pro for more tokens.`,
          data: { quotaPercentage: usedPercentage, tier }
        });
      }
    }
  }

  /**
   * Reset quota for a user (weekly reset)
   */
  async resetQuota(userId: string): Promise<IGalleryTokenUsage> {
    let usage = await galleryTokenUsageRepository.findByUserId(userId);
    if (!usage) {
      return galleryTokenUsageRepository.initializeForUser(userId);
    }

    const tokensBefore = usage.tokensUsed;
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Reset quota
    const updatedUsage = await galleryTokenUsageRepository.resetQuota(userId, now, weekLater);

    // Log transaction
    await galleryTokenTransactionRepository.create({
      userId,
      type: 'reset',
      tokensAmount: 0,
      tokensBefore,
      tokensAfter: 0,
      description: 'Weekly quota reset',
      metadata: {}
    });

    return updatedUsage!;
  }

  /**
   * Initialize quota for a new user
   */
  async initializeQuota(userId: string): Promise<IGalleryTokenUsage> {
    const existing = await galleryTokenUsageRepository.findByUserId(userId);
    if (existing) {
      return existing;
    }
    return galleryTokenUsageRepository.initializeForUser(userId);
  }

  /**
   * Process weekly resets for all users with expired quotas
   */
  async processWeeklyResets(): Promise<number> {
    const expiredQuotas = await galleryTokenUsageRepository.findExpiredQuotas();
    let resetCount = 0;

    for (const quota of expiredQuotas) {
      try {
        await this.resetQuota(quota.userId);

        // Send notification
        await galleryNotificationRepository.create({
          userId: quota.userId,
          type: 'system',
          title: 'Quota Reset',
          message: 'Your weekly token quota has been reset. You can now analyze more URLs!',
          data: { action: 'analyze' }
        });

        resetCount++;
      } catch (error) {
        console.error(`Failed to reset quota for user ${quota.userId}:`, error);
      }
    }

    return resetCount;
  }

  /**
   * Get transaction history for a user
   */
  async getTransactionHistory(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResult<IGalleryTokenTransaction>> {
    return galleryTokenTransactionRepository.findByUserId(userId, page, limit);
  }

  /**
   * Add bonus tokens to a user (admin action)
   */
  async addBonusTokens(userId: string, tokens: number, reason: string): Promise<void> {
    let usage = await galleryTokenUsageRepository.findByUserId(userId);
    if (!usage) {
      usage = await galleryTokenUsageRepository.initializeForUser(userId);
    }

    const tokensBefore = usage.tokensUsed;
    // Bonus tokens reduce the used count (effectively increasing remaining)
    const tokensAfter = Math.max(0, tokensBefore - tokens);

    await galleryTokenUsageRepository.update(userId, { tokensUsed: tokensAfter });

    await galleryTokenTransactionRepository.create({
      userId,
      type: 'bonus',
      tokensAmount: tokens,
      tokensBefore,
      tokensAfter,
      description: reason,
      metadata: {}
    });

    await galleryNotificationRepository.create({
      userId,
      type: 'system',
      title: 'Bonus Tokens Added',
      message: `You received ${tokens.toLocaleString()} bonus tokens! ${reason}`,
      data: { tokens, reason }
    });
  }

  /**
   * Refund tokens for a failed analysis
   */
  async refundTokens(userId: string, tokens: number, analysisId: string, reason: string): Promise<void> {
    let usage = await galleryTokenUsageRepository.findByUserId(userId);
    if (!usage) {
      return; // No usage to refund
    }

    const tokensBefore = usage.tokensUsed;
    const tokensAfter = Math.max(0, tokensBefore - tokens);

    await galleryTokenUsageRepository.update(userId, {
      tokensUsed: tokensAfter,
      totalTokensUsed: Math.max(0, usage.totalTokensUsed - tokens)
    });

    await galleryTokenTransactionRepository.create({
      userId,
      type: 'refund',
      tokensAmount: tokens,
      tokensBefore,
      tokensAfter,
      analysisId,
      description: reason,
      metadata: {}
    });
  }

  /**
   * Handle tier upgrade - optionally reset quota
   */
  async handleTierUpgrade(userId: string, newTier: GallerySubscriptionTier): Promise<void> {
    // Update user's tier
    await galleryUserRepository.update(userId, { subscriptionTier: newTier });

    // Optionally reset quota on upgrade to give fresh start
    // This is a business decision - uncomment if desired
    // await this.resetQuota(userId);

    await galleryNotificationRepository.create({
      userId,
      type: 'system',
      title: 'Subscription Upgraded',
      message: `Your subscription has been upgraded to ${newTier.toUpperCase()}. You now have ${QUOTA_LIMITS[newTier].toLocaleString()} tokens per week!`,
      data: { tier: newTier, limit: QUOTA_LIMITS[newTier] }
    });
  }
}

export const quotaService = new QuotaService();
