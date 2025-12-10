import { getCollectionRepository, CollectionData, CollectionsResult } from '../../shared/repositories';
import { ApiError } from '../../shared/utils/ApiError';
import httpStatus from 'http-status';

export class CollectionService {
  private get repository() {
    return getCollectionRepository();
  }

  async getCollections(page: number = 1, limit: number = 12): Promise<CollectionsResult> {
    return this.repository.findAll(page, limit);
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
}

export const collectionService = new CollectionService();
