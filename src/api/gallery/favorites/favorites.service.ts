import httpStatus from 'http-status';
import { ApiError } from '../../../shared/utils/ApiError';
import { IGalleryFavorite, PaginatedResult } from '../gallery.types';
import {
  galleryFavoritesRepository,
  galleryActivityLogRepository
} from '../../../shared/repositories/postgres/gallery.repository';

export class FavoritesService {
  /**
   * Get user's favorites with pagination
   */
  async getFavorites(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<PaginatedResult<IGalleryFavorite>> {
    return galleryFavoritesRepository.findByUserId(userId, page, limit);
  }

  /**
   * Get all favorite project IDs for a user
   */
  async getFavoriteProjectIds(userId: string): Promise<string[]> {
    return galleryFavoritesRepository.getProjectIds(userId);
  }

  /**
   * Add project to favorites
   */
  async addFavorite(
    userId: string,
    projectId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IGalleryFavorite> {
    // Check if already favorited
    const existing = await galleryFavoritesRepository.findByUserAndProject(userId, projectId);
    if (existing) {
      return existing; // Already favorited, return existing
    }

    const favorite = await galleryFavoritesRepository.create(userId, projectId);

    // Log activity
    await galleryActivityLogRepository.create({
      userId,
      action: 'favorite',
      resourceType: 'project',
      resourceId: projectId,
      ipAddress,
      userAgent
    });

    return favorite;
  }

  /**
   * Remove project from favorites
   */
  async removeFavorite(
    userId: string,
    projectId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const deleted = await galleryFavoritesRepository.delete(userId, projectId);

    if (!deleted) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Favorite not found');
    }

    // Log activity
    await galleryActivityLogRepository.create({
      userId,
      action: 'unfavorite',
      resourceType: 'project',
      resourceId: projectId,
      ipAddress,
      userAgent
    });
  }

  /**
   * Check if project is favorited
   */
  async isFavorited(userId: string, projectId: string): Promise<boolean> {
    const favorite = await galleryFavoritesRepository.findByUserAndProject(userId, projectId);
    return !!favorite;
  }

  /**
   * Get count of favorites for a user
   */
  async getFavoritesCount(userId: string): Promise<number> {
    return galleryFavoritesRepository.countByUserId(userId);
  }

  /**
   * Check multiple projects at once (for list views)
   */
  async checkMultipleFavorites(
    userId: string,
    projectIds: string[]
  ): Promise<Record<string, boolean>> {
    const favoriteIds = await galleryFavoritesRepository.getProjectIds(userId);
    const favoriteSet = new Set(favoriteIds);

    const result: Record<string, boolean> = {};
    for (const projectId of projectIds) {
      result[projectId] = favoriteSet.has(projectId);
    }

    return result;
  }
}

export const favoritesService = new FavoritesService();
