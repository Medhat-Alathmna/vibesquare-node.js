import { Collection } from './collection.model';
import { Project } from '../project/project.model';
import { ApiError } from '../../shared/utils/ApiError';
import { PaginationResult } from '../../shared/types';
import httpStatus from 'http-status';

interface CollectionsResult {
  collections: any[];
  pagination: PaginationResult;
}

export class CollectionService {
  async getCollections(page: number = 1, limit: number = 12): Promise<CollectionsResult> {
    const skip = (page - 1) * limit;

    const [collections, total] = await Promise.all([
      Collection.find()
        .sort({ featured: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Collection.countDocuments()
    ]);

    return {
      collections,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }

  async getCollectionById(id: string): Promise<any> {
    const collection = await Collection.findOne({ id }).lean();
    if (!collection) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Collection not found');
    }

    // Fetch projects in this collection
    const projects = await Project.find({ id: { $in: collection.projectIds } })
      .select('-codeFiles')
      .lean();

    return {
      ...collection,
      projects
    };
  }

  async getFeaturedCollections(): Promise<any[]> {
    const collections = await Collection.find({ featured: true })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    return collections;
  }
}

export const collectionService = new CollectionService();
