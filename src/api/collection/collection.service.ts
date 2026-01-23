import { getCollectionRepository, getCategoryRepository, CollectionData, CollectionsResult, CreateCollectionData, UpdateCollectionData } from '../../shared/repositories';
import { ApiError } from '../../shared/utils/ApiError';
import httpStatus from 'http-status';

export class CollectionService {
  private get repository() {
    return getCollectionRepository();
  }

  async getCollections(page: number = 1, limit: number = 12, categoryIds?: string[]): Promise<CollectionsResult> {
    return this.repository.findAll(page, limit, categoryIds);
  }

  async getCollectionById(id: string): Promise<CollectionData & { projects: any[] }> {
    const collection = await this.repository.findById(id);
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }

    const projects = await this.repository.findProjectsByCollectionId(collection.projectIds);

    return {
      ...collection,
      projects
    };
  }

  async getFeaturedCollections(): Promise<CollectionData[]> {
    return this.repository.findFeatured();
  }

  // ============================================
  // Admin CRUD Operations
  // ============================================

  /**
   * إنشاء collection جديد
   * @param data - بيانات الـ collection الجديد
   * @throws ApiError 400 - إذا كان العنوان مكرر
   */
  async createCollection(data: CreateCollectionData): Promise<CollectionData> {
    // التحقق من عدم تكرار العنوان
    const titleExists = await this.repository.existsByTitle(data.title);
    if (titleExists) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        'Collection with this title already exists'
      );
    }

    // If categoryIds provided, validate they exist
    if (data.categoryIds && data.categoryIds.length > 0) {
      const categoryRepo = getCategoryRepository();
      const categories = await categoryRepo.findByIds(data.categoryIds);

      if (categories.length !== data.categoryIds.length) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'One or more category IDs are invalid'
        );
      }
    }

    // إنشاء Collection جديد
    const collection = await this.repository.create(data);

    // Link categories if provided
    if (data.categoryIds && data.categoryIds.length > 0) {
      const categoryRepo = getCategoryRepository();
      await categoryRepo.addToCollection(collection.id, data.categoryIds);
    }

    // Return collection with categories
    return this.repository.findById(collection.id) as Promise<CollectionData>;
  }

  /**
   * تحديث collection موجود
   * @param id - معرف الـ collection
   * @param data - البيانات المراد تحديثها
   * @throws ApiError 404 - إذا كان Collection غير موجود
   * @throws ApiError 400 - إذا كان العنوان الجديد مكرر
   */
  async updateCollection(id: string, data: UpdateCollectionData): Promise<CollectionData> {
    // التحقق من وجود Collection
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }

    // إذا تم تغيير العنوان، نتحقق من عدم التكرار
    if (data.title && data.title !== existing.title) {
      const titleExists = await this.repository.existsByTitle(data.title, id);
      if (titleExists) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Collection with this title already exists'
        );
      }
    }

    // If categoryIds provided, validate and update them
    if (data.categoryIds) {
      if (data.categoryIds.length === 0) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'At least one category is required'
        );
      }

      const categoryRepo = getCategoryRepository();
      const categories = await categoryRepo.findByIds(data.categoryIds);

      if (categories.length !== data.categoryIds.length) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'One or more category IDs are invalid'
        );
      }

      // Get existing categories
      const existingCategories = await categoryRepo.getCollectionCategories(id);
      const existingCategoryIds = existingCategories.map(c => c.id);

      // Remove old categories
      if (existingCategoryIds.length > 0) {
        await categoryRepo.removeFromCollection(id, existingCategoryIds);
      }

      // Add new categories
      await categoryRepo.addToCollection(id, data.categoryIds);
    }

    // تحديث Collection
    const updated = await this.repository.update(id, data);

    // هذا لن يحدث عملياً لأننا تحققنا من الوجود، لكن للأمان
    if (!updated) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update collection');
    }

    // Return collection with updated categories
    return this.repository.findById(id) as Promise<CollectionData>;
  }

  /**
   * حذف collection
   * @param id - معرف الـ collection
   * @throws ApiError 404 - إذا كان Collection غير موجود
   */
  async deleteCollection(id: string): Promise<void> {
    // التحقق من وجود Collection
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }

    // حذف Collection
    await this.repository.delete(id);
  }
}

export const collectionService = new CollectionService();
