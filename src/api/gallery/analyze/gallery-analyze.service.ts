import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import {
  AnalysisEstimate,
  GallerySubscriptionTier,
  QUOTA_LIMITS,
  IGalleryAnalysis,
  AnalysisHistoryItem,
  PaginatedResult,
  GalleryAnalysisV25Result
} from '../gallery.types';
import { quotaService } from '../quota/quota.service';
import { galleryUserRepository } from '../../../shared/repositories/postgres/gallery.repository';
import { galleryAnalysisRepository } from '../../../shared/repositories/postgres/gallery-analysis.repository';
import {
  executePipeline,
  PipelineResult,
  LLMModel,
  estimateTokens,
  fetcher,
  normalizer,
  parser
} from '../../analyze/pipeline';
import { analyzeService } from '../../analyze/analyze.service';
import { PipelineType as AnalyzePipelineType, DetailLevel, APIStyle } from '../../analyze/technical/core/technical-agent.types';

export interface GalleryAnalyzeOptions {
  url: string;
  model?: LLMModel;
}

export interface GalleryAnalysisResult extends PipelineResult {
  analysisId: string;
  tokensUsed: number;
  quota: {
    remaining: number;
    limit: number;
  };
}

export class GalleryAnalyzeService {
  /**
   * Estimate tokens for an analysis (lightweight - only fetches and parses)
   */
  async estimateAnalysis(userId: string, url: string): Promise<AnalysisEstimate> {
    try {
      // Quick estimation: Fetch and parse only (no LLM call)
      const fetchResult = await fetcher.fetch(url);
      const normalizedResult = await normalizer.clean(fetchResult.html, fetchResult.finalUrl);
      const parsedDOM = parser.parse(normalizedResult, fetchResult.finalUrl);

      // Estimate tokens for the parsed DOM
      const estimatedTokens = estimateTokens(parsedDOM);

      // Add ~2000 tokens for LLM overhead (system prompt + response)
      const totalEstimate = estimatedTokens + 2000;

      // Check quota
      const quotaCheck = await quotaService.checkQuota(userId, totalEstimate);

      // Build user-friendly message
      let message: string;
      if (quotaCheck.sufficient) {
        message = `This analysis will consume approximately ${totalEstimate.toLocaleString()} tokens. You have ${quotaCheck.remaining.toLocaleString()} tokens remaining.`;
      } else {
        message = `This analysis requires approximately ${totalEstimate.toLocaleString()} tokens, but you only have ${quotaCheck.remaining.toLocaleString()} remaining. Please upgrade to Pro for more tokens.`;
      }

      return {
        estimatedTokens: totalEstimate,
        quota: quotaCheck,
        requiresConfirmation: true,
        message
      };

    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Failed to estimate analysis: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Execute analysis with quota enforcement
   */
  async executeAnalysis(
    userId: string,
    options: GalleryAnalyzeOptions
  ): Promise<GalleryAnalysisResult> {
    const { url, model = 'gemini-1.5-flash' } = options;

    // Get user's tier and quota
    const user = await galleryUserRepository.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }

    const tier = user.subscriptionTier as GallerySubscriptionTier;

    // Get current quota status
    const quotaStatus = await quotaService.getQuotaStatus(userId);

    // Quick estimate before executing
    const estimate = await this.estimateAnalysis(userId, url);

    // Check if user has sufficient quota
    if (!estimate.quota.sufficient) {
      throw new ApiError(
        httpStatus.PAYMENT_REQUIRED,
        `Token quota exceeded. You have used ${quotaStatus.quota.used.toLocaleString()} of ${quotaStatus.quota.limit.toLocaleString()} tokens this week.`,
        true,
        '',
        {
          errorCode: 'QUOTA_EXCEEDED',
          quota: {
            limit: quotaStatus.quota.limit,
            used: quotaStatus.quota.used,
            remaining: quotaStatus.quota.remaining,
            resetAt: quotaStatus.quota.periodEnd
          },
          upgrade: tier === 'free' ? {
            tier: 'pro',
            limit: QUOTA_LIMITS.pro
          } : undefined
        }
      );
    }

    // Create initial analysis record
    const analysis = await galleryAnalysisRepository.create({
      userId,
      url,
      tokensUsed: 0,
      status: 'processing',
      metadata: { model }
    });

    try {
      const result = await executePipeline({
        url,
        model,
        tier: this.mapGalleryTierToPipelineTier(tier)
      });

      // Calculate actual tokens used
      const tokensUsed = result.debug?.parsedDOMTokens || estimate.estimatedTokens;

      // Format the prompt to fix \n issues
      const formattedPrompt = this.formatPromptResponse(result.prompt);

      // Extract page info from parsedDOM metadata
      const parsedDOM = result.debug?.parsedDOM as any;
      const pageTitle = parsedDOM?.metadata?.title;
      const pageDescription = parsedDOM?.metadata?.description;

      // Update analysis record with results
      await galleryAnalysisRepository.markCompleted(
        analysis.id,
        formattedPrompt,
        tokensUsed,
        {
          model,
          pageTitle,
          pageDescription
        }
      );

      // Deduct tokens
      await quotaService.deductTokens(userId, tokensUsed, {
        analysisUrl: url,
        analysisId: analysis.id,
        model
      });

      // Get updated quota
      const updatedQuota = await quotaService.getQuotaStatus(userId);

      return {
        ...result,
        prompt: formattedPrompt,
        analysisId: analysis.id,
        tokensUsed,
        quota: {
          remaining: updatedQuota.quota.remaining,
          limit: updatedQuota.quota.limit
        }
      };

    } catch (error) {
      // Mark analysis as failed
      await galleryAnalysisRepository.markFailed(
        analysis.id,
        error instanceof Error ? error.message : 'Unknown error'
      );

      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get analysis history for a user
   */
  async getAnalysisHistory(userId: string, page = 1, limit = 20): Promise<PaginatedResult<AnalysisHistoryItem>> {
    return galleryAnalysisRepository.findByUserId(userId, page, limit);
  }

  /**
   * Get a specific analysis by ID
   */
  async getAnalysisById(userId: string, analysisId: string): Promise<IGalleryAnalysis> {
    const analysis = await galleryAnalysisRepository.findByIdAndUserId(analysisId, userId);
    if (!analysis) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Analysis not found');
    }
    return analysis;
  }

  /**
   * Get recent analyses for a user
   */
  async getRecentAnalyses(userId: string, limit = 5): Promise<AnalysisHistoryItem[]> {
    return galleryAnalysisRepository.getRecentByUserId(userId, limit);
  }

  /**
   * Delete an analysis
   */
  async deleteAnalysis(userId: string, analysisId: string): Promise<void> {
    const analysis = await galleryAnalysisRepository.findByIdAndUserId(analysisId, userId);
    if (!analysis) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Analysis not found');
    }
    await galleryAnalysisRepository.softDelete(analysisId);
  }

  /**
   * Estimate tokens for V2.5 analysis
   * Fixed estimate: 15,000 tokens
   */
  async estimateAnalysisV25(userId: string, url: string): Promise<AnalysisEstimate> {
    const FIXED_V25_ESTIMATE = 15000;

    // Check quota
    const quotaCheck = await quotaService.checkQuota(userId, FIXED_V25_ESTIMATE);

    let message: string;
    if (quotaCheck.sufficient) {
      message = `V2.5 analysis will consume approximately ${FIXED_V25_ESTIMATE.toLocaleString()} tokens (Visual + Technical Architecture). You have ${quotaCheck.remaining.toLocaleString()} tokens remaining.`;
    } else {
      message = `V2.5 analysis requires ${FIXED_V25_ESTIMATE.toLocaleString()} tokens, but you only have ${quotaCheck.remaining.toLocaleString()} remaining. Please upgrade to Pro for more tokens.`;
    }

    return {
      estimatedTokens: FIXED_V25_ESTIMATE,
      quota: quotaCheck,
      requiresConfirmation: true,
      message
    };
  }

  /**
   * Execute V2.5 analysis with quota enforcement
   */
  async executeAnalysisV25(
    userId: string,
    options: {
      url: string;
      pipelineType?: AnalyzePipelineType;
      detailLevel?: DetailLevel;
      apiStyle?: APIStyle;
    }
  ): Promise<GalleryAnalysisV25Result> {
    const { url, pipelineType = 'both', detailLevel = 'detailed', apiStyle = 'REST' } = options;

    // 1. Get user info and verify email
    const user = await galleryUserRepository.findById(userId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
    }
    if (!user.emailVerified) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Email verification required for V2.5 analysis');
    }

    // 2. Check quota
    const estimate = await this.estimateAnalysisV25(userId, url);
    const quotaStatus = await quotaService.getQuotaStatus(userId);

    if (!estimate.quota.sufficient) {
      throw new ApiError(
        httpStatus.PAYMENT_REQUIRED,
        `Token quota exceeded. You have used ${quotaStatus.quota.used.toLocaleString()} of ${quotaStatus.quota.limit.toLocaleString()} tokens this week.`,
        true,
        '',
        {
          errorCode: 'QUOTA_EXCEEDED',
          quota: {
            limit: quotaStatus.quota.limit,
            used: quotaStatus.quota.used,
            remaining: quotaStatus.quota.remaining,
            resetAt: quotaStatus.quota.periodEnd
          },
          upgrade: user.subscriptionTier === 'free' ? {
            tier: 'pro',
            limit: QUOTA_LIMITS.pro
          } : undefined
        }
      );
    }

    // 3. Create initial analysis record
    const analysis = await galleryAnalysisRepository.create({
      userId,
      url,
      tokensUsed: 0,
      status: 'processing',
      pipelineType: 'v2.5',
      metadata: { pipelineType, detailLevel, apiStyle }
    });

    try {
      // 4. Execute V2.5 pipeline (reuse existing service)
      const startTime = Date.now();
      const v25Result = await analyzeService.analyzeUrlV25({
        url,
        pipelineType,
        detailLevel,
        apiStyle,
        userId,
        tier: this.mapGalleryTierToPipelineTier(user.subscriptionTier),
        includeDebug: false,
        forceRefresh: false
      });

      // 5. Calculate tokens - always charge fixed estimate
      const tokensToDeduct = estimate.estimatedTokens; // Always 15,000

      // 6. Update analysis record with PRD link
      const formattedPrompt = this.formatPromptResponse(v25Result.prdMarkdown);

      await galleryAnalysisRepository.update(analysis.id, {
        prompt: formattedPrompt,
        tokensUsed: tokensToDeduct,
        status: 'completed',
        prdId: v25Result.prdId,
        metadata: {
          pipelineType,
          detailLevel,
          apiStyle,
          cached: v25Result.metadata.cached,
          cachedAt: v25Result.metadata.cachedAt,
          validationScore: v25Result.metadata.validationScore,
          qaApproved: v25Result.metadata.qaApproved,
          processingTimeMs: Date.now() - startTime
        },
        completedAt: new Date()
      });

      // 7. Deduct tokens from quota
      await quotaService.deductTokens(userId, tokensToDeduct, {
        analysisUrl: url,
        analysisId: analysis.id,
        pipelineType: 'v2.5',
        prdId: v25Result.prdId
      });

      // 8. Get updated quota
      const updatedQuota = await quotaService.getQuotaStatus(userId);

      return {
        analysisId: analysis.id,
        prdId: v25Result.prdId,
        prdMarkdown: formattedPrompt,
        tokensUsed: tokensToDeduct,
        metadata: {
          cached: v25Result.metadata.cached,
          cachedAt: v25Result.metadata.cachedAt,
          validationScore: v25Result.metadata.validationScore,
          qaApproved: v25Result.metadata.qaApproved
        },
        quota: {
          remaining: updatedQuota.quota.remaining,
          limit: updatedQuota.quota.limit
        }
      };

    } catch (error) {
      // Handle partial failure
      await this.handleV25PartialFailure(analysis.id, error, userId);
      throw error;
    }
  }

  /**
   * Handle partial failure scenarios for V2.5 analysis
   */
  private async handleV25PartialFailure(
    analysisId: string,
    error: any,
    userId: string
  ): Promise<void> {
    // Determine which part failed
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isVisualFailure = errorMessage.includes('visual') || errorMessage.includes('V2');
    const isTechnicalFailure = errorMessage.includes('technical') || errorMessage.includes('PRD');

    // Calculate refund based on failure type
    const VISUAL_TOKENS = 8000;
    const TECHNICAL_TOKENS = 7000;
    let refundAmount = 0;

    if (isVisualFailure) {
      refundAmount = 15000; // Full refund - nothing completed
    } else if (isTechnicalFailure) {
      refundAmount = TECHNICAL_TOKENS; // Partial refund - visual succeeded
    }

    // Mark as partial or failed
    const status = refundAmount < 15000 ? 'partial' : 'failed';

    await galleryAnalysisRepository.update(analysisId, {
      status,
      metadata: {
        error: errorMessage,
        refundAmount,
        partialCompletion: refundAmount < 15000
      },
      completedAt: new Date()
    });

    // Issue refund if applicable
    if (refundAmount > 0) {
      await quotaService.refundTokens(userId, refundAmount, {
        reason: 'Partial pipeline failure',
        analysisId
      });
    }
  }

  /**
   * Map gallery subscription tier to pipeline user tier
   */
  private mapGalleryTierToPipelineTier(tier: GallerySubscriptionTier): 'free' | 'basic' | 'pro' | 'enterprise' {
    switch (tier) {
      case 'free':
        return 'basic'; // Gallery free users get basic tier data extraction
      case 'pro':
        return 'pro';
      default:
        return 'basic';
    }
  }

  /**
   * Format prompt response to fix escape sequences
   */
  private formatPromptResponse(prompt: string): string {
    if (!prompt) return prompt;

    return prompt
      // Convert literal \n to actual newlines
      .replace(/\\n/g, '\n')
      // Convert literal \t to actual tabs
      .replace(/\\t/g, '\t')
      // Convert literal \r to actual carriage returns
      .replace(/\\r/g, '\r')
      // Clean up any double escapes
      .replace(/\\\\/g, '\\');
  }
}

export const galleryAnalyzeService = new GalleryAnalyzeService();
