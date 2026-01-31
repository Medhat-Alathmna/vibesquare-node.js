import { env } from '../../config/env';
import {
  IProjectRepository,
  ICollectionRepository,
  ICategoryRepository,
  IPRDRepository,
  IVisualPipelineCacheRepository
} from './interfaces';
import {
  PostgresProjectRepository,
  PostgresCollectionRepository,
  PostgresCategoryRepository,
  PostgresPRDRepository
} from './postgres';
import { MongoProjectRepository, MongoCollectionRepository } from './mongodb';
import { PostgresVisualPipelineCacheRepository } from './postgres/visual-pipeline-cache.repository';
import { MongoDBVisualPipelineCacheRepository } from './mongodb/visual-pipeline-cache.repository';

export * from './interfaces';

// Singleton instances
let projectRepository: IProjectRepository | null = null;
let collectionRepository: ICollectionRepository | null = null;
let categoryRepository: ICategoryRepository | null = null;
let prdRepository: IPRDRepository | null = null;
let visualPipelineCacheRepository: IVisualPipelineCacheRepository | null = null;

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

/**
 * Get PRD Repository instance (PostgreSQL only)
 * Note: PRDs are stored in PostgreSQL only
 */
export function getPRDRepository(): IPRDRepository {
  if (!prdRepository) {
    // PRDs are PostgreSQL-only (no MongoDB support)
    prdRepository = new PostgresPRDRepository();
  }
  return prdRepository;
}

/**
 * Get Visual Pipeline Cache Repository instance
 * Supports both PostgreSQL and MongoDB based on DB_TYPE env variable
 */
export function getVisualPipelineCacheRepository(): IVisualPipelineCacheRepository {
  if (!visualPipelineCacheRepository) {
    if (env.DB_TYPE === 'mongodb') {
      visualPipelineCacheRepository = new MongoDBVisualPipelineCacheRepository();
    } else {
      visualPipelineCacheRepository = new PostgresVisualPipelineCacheRepository();
    }
  }
  return visualPipelineCacheRepository;
}
