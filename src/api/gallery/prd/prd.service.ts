import { getPRDRepository } from '../../../shared/repositories';
import { ApiError } from '../../../shared/utils/ApiError';
import httpStatus from 'http-status';

export class GalleryPRDService {
  /**
   * Validate if a string is a valid UUID
   */
  private isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  /**
   * Get PRDs for a specific user with pagination
   */
  async getUserPRDs(userId: string, page = 1, limit = 10) {
    const prdRepo = getPRDRepository();
    return prdRepo.findByUserId(userId, page, limit);
  }

  /**
   * Get specific PRD by ID (with user ownership check)
   */
  async getPRDById(userId: string, prdId: string) {
    // Validate UUID format
    if (!this.isValidUUID(prdId)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Invalid PRD ID format. Please provide a valid UUID.`
      );
    }

    const prdRepo = getPRDRepository();
    const prd = await prdRepo.findById(prdId);

    if (!prd) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        `PRD with ID "${prdId}" not found. It may have been deleted or the ID is incorrect.`
      );
    }

    // Privacy check: user can see their own PRDs or public PRDs (user_id = null)
    if (prd.userId !== null && prd.userId !== userId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'This PRD belongs to another user. You can only view your own PRDs or public PRDs.'
      );
    }

    return prd;
  }

  /**
   * Get specific PRD by source URL (with user ownership check)
   * Handles URL normalization to match stored URLs
   */
  async getPRDByUrl(userId: string, sourceUrl: string) {
    const prdRepo = getPRDRepository();

    // Normalize URL: remove trailing slash and convert to lowercase for matching
    const normalizedUrl = this.normalizeUrl(sourceUrl);

    // Try exact match first
    let prd = await prdRepo.findBySourceUrl(sourceUrl);

    // If not found, try with normalized URL
    if (!prd) {
      // Try finding all PRDs with this URL and match by normalized form
      const allPrds = await prdRepo.findByUrl(sourceUrl);

      if (allPrds.length === 0) {
        // Try normalized version
        const normalizedPrds = await (prdRepo as any).findByNormalizedUrl?.(normalizedUrl);
        if (normalizedPrds && normalizedPrds.length > 0) {
          prd = normalizedPrds[0];
        }
      } else {
        prd = allPrds[0]; // Return most recent
      }
    }

    if (!prd) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        `No PRD found for "${sourceUrl}". This URL hasn't been analyzed yet. Please run an analysis first to generate a PRD.`
      );
    }

    // Privacy check: user can see their own PRDs or public PRDs (user_id = null)
    if (prd.userId !== null && prd.userId !== userId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'This PRD belongs to another user. You can only view your own PRDs or public PRDs.'
      );
    }

    return prd;
  }

  /**
   * Normalize URL for matching
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove trailing slash, use lowercase for domain
      let normalized = urlObj.href.toLowerCase();
      if (normalized.endsWith('/') && normalized.split('/').length === 4) {
        // Remove trailing slash only for root paths (http://example.com/)
        normalized = normalized.slice(0, -1);
      }
      return normalized;
    } catch {
      // If URL is invalid, return as-is
      return url.toLowerCase().replace(/\/$/, '');
    }
  }

  /**
   * Check if PRD exists for URL (lightweight cache check)
   * Returns only basic info without sensitive analysis data
   * Respects privacy: doesn't leak existence of other users' private PRDs
   */
  async checkPRDCache(userId: string, sourceUrl: string) {
    const prdRepo = getPRDRepository();
    const normalizedUrl = this.normalizeUrl(sourceUrl);

    // Try to find PRD with same normalization logic as getPRDByUrl
    let prd = await prdRepo.findBySourceUrl(sourceUrl);

    if (!prd) {
      const allPrds = await prdRepo.findByUrl(sourceUrl);
      if (allPrds.length === 0) {
        const normalizedPrds = await (prdRepo as any).findByNormalizedUrl?.(normalizedUrl);
        if (normalizedPrds && normalizedPrds.length > 0) {
          prd = normalizedPrds[0];
        }
      } else {
        prd = allPrds[0]; // Return most recent
      }
    }

    // If not found, return not cached
    if (!prd) {
      return { cached: false };
    }

    // Privacy check: only return info for own PRDs or public PRDs (user_id = null)
    if (prd.userId !== null && prd.userId !== userId) {
      return { cached: false }; // Don't leak existence of other users' private PRDs
    }

    // Return minimal info without sensitive data
    return {
      cached: true,
      id: prd.id,
      sourceUrl: prd.sourceUrl,
      createdAt: prd.createdAt
    };
  }

  /**
   * Delete PRD (with user ownership check)
   */
  async deletePRD(userId: string, prdId: string) {
    // Validate UUID format
    if (!this.isValidUUID(prdId)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Invalid PRD ID format. Please provide a valid UUID.`
      );
    }

    const prdRepo = getPRDRepository();
    const prd = await prdRepo.findById(prdId);

    if (!prd) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        `PRD with ID "${prdId}" not found. It may have already been deleted.`
      );
    }

    if (prd.userId !== userId) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        'Cannot delete this PRD. You can only delete your own PRDs.'
      );
    }

    await prdRepo.delete(prdId);
  }
}

export const galleryPRDService = new GalleryPRDService();
