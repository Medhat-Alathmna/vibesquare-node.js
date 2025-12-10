import { env } from '../../config/env';
import { IProjectRepository, ICollectionRepository } from './interfaces';
import { PostgresProjectRepository, PostgresCollectionRepository } from './postgres';
import { MongoProjectRepository, MongoCollectionRepository } from './mongodb';

export * from './interfaces';

// Singleton instances
let projectRepository: IProjectRepository | null = null;
let collectionRepository: ICollectionRepository | null = null;

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
