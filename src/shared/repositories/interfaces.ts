import { ProjectQueryOptions, SearchOptions, PaginationResult, SortOption, CreateProjectDTO, UpdateProjectDTO, Builder, BuilderSocialLinks, CollectionQueryOptions } from '../types';
import { Collection, CreateCollectionDTO, UpdateCollectionDTO, CollectionProject, OwnerType, CollectionActivity } from '../../api/collection/collection.types';

// Project Summary for list view (lightweight)
export interface ProjectSummary {
  id: string;
  title: string;
  shortDescription: string;
  thumbnail: string;
  framework: string;
  category: string;
  tags: string[];
  likes: number;
  views: number;
  downloads: number;
  createdAt: Date;
  builder?: {
    name: string;
    avatarUrl?: string;
  };
  hasLiked?: boolean;
}

// Full Project data for detail view
export interface ProjectData {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  thumbnail: string;
  screenshots: string[];
  demoUrl?: string;
  downloadUrl?: string;
  sourceCodeFile?: string;
  prompt: {
    text: string;
    model: string;
    version?: string;
    parameters?: any;
  };
  framework: string;
  tags: string[];
  styles: string[];
  category: string;
  likes: number;
  views: number;
  downloads: number;
  createdAt: Date;
  updatedAt: Date;
  collectionIds: string[];
  builder?: Builder;
  builderSocialLinks?: BuilderSocialLinks;
  hasLiked?: boolean;
}

export interface ProjectsResult {
  projects: ProjectData[];
  pagination: PaginationResult;
}

export interface ProjectListResult {
  projects: ProjectSummary[];
  pagination: PaginationResult;
}

export interface CollectionsResult {
  collections: Collection[];
  pagination: PaginationResult;
}

// Repository interfaces
export interface IProjectRepository {
  findAll(options: ProjectQueryOptions): Promise<ProjectListResult>;
  search(options: SearchOptions): Promise<ProjectListResult>;
  findById(id: string): Promise<ProjectData | null>;
  findByIds(ids: string[]): Promise<ProjectSummary[]>;
  incrementStat(id: string, field: 'views' | 'likes' | 'downloads'): Promise<ProjectData | null>;
  decrementStat(id: string, field: 'views' | 'likes' | 'downloads'): Promise<ProjectData | null>;
  create(data: CreateProjectDTO): Promise<ProjectData>;
  update(id: string, data: UpdateProjectDTO): Promise<ProjectData | null>;
  delete(id: string): Promise<boolean>;
}

export interface ICollectionRepository {
  findAll(options: CollectionQueryOptions): Promise<CollectionsResult>;
  findById(id: string): Promise<Collection | null>;
  findFeatured(): Promise<Collection[]>;
  findProjectsByCollectionId(projectIds: string[]): Promise<ProjectData[]>;

  // New methods
  create(data: CreateCollectionDTO & { ownerId?: string | null; ownerType?: OwnerType }): Promise<Collection>;
  update(id: string, data: UpdateCollectionDTO): Promise<Collection | null>;
  softDelete(id: string): Promise<boolean>;
  restore(id: string): Promise<boolean>;

  // Project management methods
  addProject(data: CollectionProject): Promise<void>;
  removeProject(collectionId: string, projectId: string): Promise<void>;
  reorderProjects(collectionId: string, projectIds: string[]): Promise<void>;
  findByOwner(ownerId: string, ownerType: string): Promise<Collection[]>;
  removeProjectFromAllCollections(projectId: string): Promise<void>;
  softDeleteAllByOwner(ownerId: string, ownerType: string): Promise<void>;

  // Stat tracking methods
  incrementStat(collectionId: string, field: 'views' | 'clones' | 'project_clicks'): Promise<void>;
  trackActivity(activity: Partial<CollectionActivity>): Promise<void>;
}
