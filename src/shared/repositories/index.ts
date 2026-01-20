import { env } from '../../config/env';
import { IProjectRepository, ICollectionRepository, ICategoryRepository } from './interfaces';
import { PostgresProjectRepository, PostgresCollectionRepository, PostgresCategoryRepository } from './postgres';
import { MongoProjectRepository, MongoCollectionRepository } from './mongodb';

export * from './interfaces';

// Singleton instances
let projectRepository: IProjectRepository | null = null;
let collectionRepository: ICollectionRepository | null = null;
let categoryRepository: ICategoryRepository | null = null;

export function getProjectRepository(): IProjectRepository {
  if (!projectRepository) {
    if (env.DB_TYPE === 'mongodb') {
      projectRepository = new MongoProjectRepository();
    } else {
      projectRepository = new PostgresProjectRepository();
    }
  }
  return projectRepository;
}

export function getCollectionRepository(): ICollectionRepository {
  if (!collectionRepository) {
    if (env.DB_TYPE === 'mongodb') {
      collectionRepository = new MongoCollectionRepository();
    } else {
      collectionRepository = new PostgresCollectionRepository();
    }
  }
  return collectionRepository;
}

/**
 * Get Category Repository instance (PostgreSQL only)
 * Note: MongoDB is not supported for categories
 */
export function getCategoryRepository(): ICategoryRepository {
  if (!categoryRepository) {
    // Categories are PostgreSQL-only (no MongoDB support)
    categoryRepository = new PostgresCategoryRepository();
  }
  return categoryRepository;
}
