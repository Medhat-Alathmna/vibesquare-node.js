import { getCollectionRepository, CollectionsResult } from '../../shared/repositories';
import { ApiError } from '../../shared/utils/ApiError';
import httpStatus from 'http-status';
import { Collection, CreateCollectionDTO, UpdateCollectionDTO, AddProjectDTO, CollectionShareMetadata } from './collection.types';
import { env } from '../../config/env';

export class CollectionService {
  private get repository() {
    return getCollectionRepository();
  }

  async getCollections(
    page: number = 1,
    limit: number = 12,
    filters: { search?: string; sort?: string; visibility?: string } = {}
  ): Promise<CollectionsResult> {
    return this.repository.findAll({
      page,
      limit,
      search: filters.search,
      sortBy: filters.sort as any,
      visibility: filters.visibility as any
    });
  }

  async getCollectionById(id: string): Promise<Collection & { projects: any[] }> {
    const collection = await this.repository.findById(id);
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }

    // Increment views asynchronously
    this.repository.incrementStat(id, 'views').catch(err => {
      console.error(`Failed to increment views for collection ${id}:`, err);
    });

    // TEMPORARY FIX: Start with empty projects until we implement the junction lookup
    return {
      ...collection,
      projects: []
    };
  }

  async getShareMetadata(id: string): Promise<CollectionShareMetadata> {
    const collection = await this.repository.findById(id);
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }

    if (collection.isDeleted) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }

    // For now, only public collections can have share metadata for social bots
    if (collection.visibility !== 'public') {
      throw new ApiError(httpStatus.FORBIDDEN, 'Private collections cannot be shared publicly');
    }

    const shareUrl = `${env.FRONTEND_URL}/collections/${collection.id}`;
    const embedCode = `<iframe src="${env.FRONTEND_URL}/collections/embed/${collection.id}" width="100%" height="600px" frameborder="0" allowfullscreen></iframe>`;

    return {
      title: collection.title,
      description: collection.description,
      image: collection.thumbnail,
      url: shareUrl,
      embedCode,
      ogTags: {
        'og:title': collection.title,
        'og:description': collection.description,
        'og:image': collection.thumbnail,
        'og:url': shareUrl,
        'og:type': 'website',
        'og:site_name': 'VibeSquare'
      },
      twitterTags: {
        'twitter:card': 'summary_large_image',
        'twitter:title': collection.title,
        'twitter:description': collection.description,
        'twitter:image': collection.thumbnail
      }
    };
  }

  async trackProjectClick(collectionId: string, projectId: string): Promise<void> {
    await this.repository.incrementStat(collectionId, 'project_clicks');
    await this.repository.trackActivity({
      collectionId,
      action: 'PROJECT_CLICK' as any,
      details: { projectId }
    });
  }

  async getFeaturedCollections(): Promise<Collection[]> {
    return this.repository.findFeatured();
  }

  async createSystemCollection(data: CreateCollectionDTO): Promise<Collection> {
    const collection = await this.repository.create({
      ...data,
      ownerType: 'system',
      ownerId: null
    });

    this.repository.trackActivity({
      collectionId: collection.id,
      action: 'created',
      actorType: 'admin',
      details: { title: collection.title }
    }).catch(console.error);

    return collection;
  }

  async updateCollection(id: string, data: UpdateCollectionDTO): Promise<Collection> {
    const collection = await this.repository.findById(id);
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }

    const updated = await this.repository.update(id, data);
    if (!updated) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update collection');
    }

    this.repository.trackActivity({
      collectionId: id,
      action: 'updated',
      actorType: 'admin',
      details: data
    }).catch(console.error);

    return updated;
  }

  async softDeleteCollection(id: string): Promise<void> {
    const collection = await this.repository.findById(id);
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }
    await this.repository.softDelete(id);

    this.repository.trackActivity({
      collectionId: id,
      action: 'deleted',
      actorType: 'admin'
    }).catch(console.error);
  }

  async restoreCollection(id: string): Promise<void> {
    // Note: findById won't find it if we filter by is_deleted=false. 
    // We might need a generic findById that includes deleted ones or a specific restore method in repo that checks existence.
    const success = await this.repository.restore(id);
    if (!success) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found or not deleted');
    }

    this.repository.trackActivity({
      collectionId: id,
      action: 'restored',
      actorType: 'admin'
    }).catch(console.error);
  }

  async addProject(collectionId: string, data: AddProjectDTO): Promise<void> {
    const collection = await this.repository.findById(collectionId);
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }

    await this.repository.addProject({
      id: '', // Will be generated by repo
      collectionId,
      projectId: data.projectId,
      position: data.position || 1000, // Default to end
      addedAt: new Date(),
      addedBy: null, // System/Admin action
      notes: data.notes || null
    });

    this.repository.trackActivity({
      collectionId,
      action: 'project_added',
      actorType: 'admin',
      details: { projectId: data.projectId }
    }).catch(console.error);
  }

  async removeProject(collectionId: string, projectId: string): Promise<void> {
    const collection = await this.repository.findById(collectionId);
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }
    await this.repository.removeProject(collectionId, projectId);
  }

  async reorderProjects(collectionId: string, projectIds: string[]): Promise<void> {
    const collection = await this.repository.findById(collectionId);
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }
    await this.repository.reorderProjects(collectionId, projectIds);
  }
  // ... Previous methods ...

  async createUserCollection(userId: string, data: CreateCollectionDTO): Promise<Collection> {
    // TODO: Check limits (e.g. max 10 active collections)
    const collections = await this.repository.findByOwner(userId, 'gallery_user');
    const activeCollections = collections.filter(c => !c.isDeleted);
    if (activeCollections.length >= 10) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Maximum number of active collections (10) reached');
    }

    const collection = await this.repository.create({
      ...data,
      ownerType: 'gallery_user',
      ownerId: userId
    });

    this.repository.trackActivity({
      collectionId: collection.id,
      action: 'created',
      actorId: userId,
      actorType: 'gallery_user',
      details: { title: collection.title }
    }).catch(console.error);

    return collection;
  }

  async getCollectionsByOwner(ownerId: string, ownerType: string): Promise<Collection[]> {
    const collections = await this.repository.findByOwner(ownerId, ownerType);
    return collections.filter(c => !c.isDeleted);
  }

  async updateUserCollection(id: string, userId: string, data: UpdateCollectionDTO): Promise<Collection> {
    const collection = await this.repository.findById(id);
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }
    if (collection.ownerId !== userId || collection.ownerType !== 'gallery_user') {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to modify this collection');
    }

    // Prevent gallery user from setting system-only fields if any (currently none critical exposed in invalid DTOs but good to be safe)
    // For now simple pass through
    const updated = await this.repository.update(id, data);
    if (!updated) {
      throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to update collection');
    }

    this.repository.trackActivity({
      collectionId: id,
      action: 'updated',
      actorId: userId,
      actorType: 'gallery_user',
      details: data
    }).catch(console.error);

    return updated;
  }

  async deleteUserCollection(id: string, userId: string): Promise<void> {
    const collection = await this.repository.findById(id);
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }
    if (collection.ownerId !== userId || collection.ownerType !== 'gallery_user') {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to delete this collection');
    }
    await this.repository.softDelete(id);
  }

  async addUserCollectionProject(collectionId: string, userId: string, data: AddProjectDTO): Promise<void> {
    const collection = await this.repository.findById(collectionId);
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }
    if (collection.ownerId !== userId || collection.ownerType !== 'gallery_user') {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to modify this collection');
    }

    await this.repository.addProject({
      id: '', // Generated
      collectionId,
      projectId: data.projectId,
      position: data.position || 1000,
      addedAt: new Date(),
      addedBy: userId,
      notes: data.notes || null
    });

    this.repository.trackActivity({
      collectionId,
      action: 'project_added',
      actorId: userId,
      actorType: 'gallery_user',
      details: { projectId: data.projectId }
    }).catch(console.error);
  }

  async removeUserCollectionProject(collectionId: string, userId: string, projectId: string): Promise<void> {
    const collection = await this.repository.findById(collectionId);
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }
    if (collection.ownerId !== userId || collection.ownerType !== 'gallery_user') {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to modify this collection');
    }
    await this.repository.removeProject(collectionId, projectId);
  }

  async reorderUserCollectionProjects(collectionId: string, userId: string, projectIds: string[]): Promise<void> {
    const collection = await this.repository.findById(collectionId);
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }
    if (collection.ownerId !== userId || collection.ownerType !== 'gallery_user') {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to modify this collection');
    }
    await this.repository.reorderProjects(collectionId, projectIds);
  }
  // ...
}

export const collectionService = new CollectionService();
