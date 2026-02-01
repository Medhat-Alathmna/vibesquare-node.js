import { getPRDRepository } from '../../../shared/repositories';
import { ApiError } from '../../../shared/utils/ApiError';
import httpStatus from 'http-status';

export class GalleryPRDService {
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
    const prdRepo = getPRDRepository();
    const prd = await prdRepo.findById(prdId);

    if (!prd) {
      throw new ApiError(httpStatus.NOT_FOUND, 'PRD not found');
    }

    // Privacy check: user can only see their own PRDs
    if (prd.userId !== userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Access denied - you can only view your own PRDs');
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
      throw new ApiError(httpStatus.NOT_FOUND, 'PRD not found for this URL');
    }

    // Privacy check: user can only see their own PRDs
    if (prd.userId !== userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Access denied - you can only view your own PRDs');
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
   * Delete PRD (with user ownership check)
   */
  async deletePRD(userId: string, prdId: string) {
    const prdRepo = getPRDRepository();
    const prd = await prdRepo.findById(prdId);

    if (!prd) {
      throw new ApiError(httpStatus.NOT_FOUND, 'PRD not found');
    }

    if (prd.userId !== userId) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Access denied - you can only delete your own PRDs');
    }

    await prdRepo.delete(prdId);
  }
}

export const galleryPRDService = new GalleryPRDService();
