import { Collection as CollectionModel } from '../../../api/collection/collection.model';
import { Project } from '../../../api/project/project.model';
import { ICollectionRepository, CollectionsResult, ProjectData } from '../interfaces';
import { Collection, CreateCollectionDTO, UpdateCollectionDTO, CollectionProject, OwnerType, CollectionActivity } from '../../../api/collection/collection.types';

import { CollectionQueryOptions } from '../../../shared/types';

export class MongoCollectionRepository implements ICollectionRepository {
  async findAll(options: CollectionQueryOptions): Promise<CollectionsResult> {
    const { page = 1, limit = 12 } = options;
    const skip = (page - 1) * limit;

    const [collections, total] = await Promise.all([
      CollectionModel.find()
        .sort({ featured: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CollectionModel.countDocuments()
    ]);

    return {
      collections: collections.map(c => ({
        ...c,
        id: c.id || c._id.toString(),
        tags: c.tags || [],
        // Map other fields safely if needed, or assume schema matches
      })) as unknown as Collection[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }

  async findById(id: string): Promise<Collection | null> {
    const collection = await CollectionModel.findOne({ id }).lean();
    return collection as unknown as Collection | null;
  }

  async findFeatured(): Promise<Collection[]> {
    const collections = await CollectionModel.find({ featured: true })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    return collections as unknown as Collection[];
  }

  async findProjectsByCollectionId(projectIds: string[]): Promise<ProjectData[]> {
    if (projectIds.length === 0) {
      return [];
    }

    const projects = await Project.find({ id: { $in: projectIds } })
      .select('-codeFiles')
      .lean();

    return projects as unknown as ProjectData[];
  }

  // Stubs for new methods (MongoDB implementation skipped as per user request)
  async create(data: CreateCollectionDTO & { ownerId?: string | null; ownerType?: OwnerType }): Promise<Collection> {
    throw new Error('Method not implemented.');
  }
  async update(id: string, data: UpdateCollectionDTO): Promise<Collection | null> {
    throw new Error('Method not implemented.');
  }
  async softDelete(id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  async restore(id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  async addProject(data: CollectionProject): Promise<void> {
    throw new Error('Method not implemented.');
  }
  async removeProject(collectionId: string, projectId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  async reorderProjects(collectionId: string, projectIds: string[]): Promise<void> {
    throw new Error('Method not implemented.');
  }
  async findByOwner(ownerId: string, ownerType: string): Promise<Collection[]> {
    throw new Error('Method not implemented.');
  }
  async removeProjectFromAllCollections(projectId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  async softDeleteAllByOwner(ownerId: string, ownerType: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  async incrementStat(collectionId: string, field: 'views' | 'clones' | 'project_clicks'): Promise<void> {
    throw new Error('Method not implemented.');
  }
  async trackActivity(activity: Partial<CollectionActivity>): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
