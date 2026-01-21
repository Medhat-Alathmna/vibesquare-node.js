import { Collection } from '../../../api/collection/collection.model';
import { Project } from '../../../api/project/project.model';
import { ICollectionRepository, CollectionData, CollectionsResult, ProjectData, CreateCollectionData, UpdateCollectionData } from '../interfaces';

export class MongoCollectionRepository implements ICollectionRepository {
  async findAll(page: number = 1, limit: number = 12, categoryIds?: string[]): Promise<CollectionsResult> {
    const skip = (page - 1) * limit;

    // Note: categoryIds filtering not fully implemented for MongoDB
    // Use PostgreSQL for production
    const [collections, total] = await Promise.all([
      Collection.find()
        .sort({ featured: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Collection.countDocuments()
    ]);

    return {
      collections: collections as unknown as CollectionData[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }

  async findById(id: string): Promise<CollectionData | null> {
    const collection = await Collection.findOne({ id }).lean();
    return collection as unknown as CollectionData | null;
  }

  async findFeatured(): Promise<CollectionData[]> {
    const collections = await Collection.find({ featured: true })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    return collections as unknown as CollectionData[];
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

  // ============================================
  // Stub implementations for admin operations
  // These are not used since we're using PostgreSQL
  // but required to satisfy the interface
  // ============================================

  async create(data: CreateCollectionData): Promise<CollectionData> {
    throw new Error('MongoDB implementation not supported. Use PostgreSQL.');
  }

  async update(id: string, data: UpdateCollectionData): Promise<CollectionData | null> {
    throw new Error('MongoDB implementation not supported. Use PostgreSQL.');
  }

  async delete(id: string): Promise<boolean> {
    throw new Error('MongoDB implementation not supported. Use PostgreSQL.');
  }

  async existsByTitle(title: string, excludeId?: string): Promise<boolean> {
    throw new Error('MongoDB implementation not supported. Use PostgreSQL.');
  }
}
