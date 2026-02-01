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
