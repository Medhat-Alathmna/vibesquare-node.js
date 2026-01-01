import { ProjectQueryOptions, SearchOptions, PaginationResult, SortOption, CreateProjectDTO, UpdateProjectDTO, Builder, BuilderSocialLinks } from '../types';

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

// Collection types
export interface CollectionData {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  projectIds: string[];
  tags: string[];
  createdAt: Date;
  featured: boolean;
}

export interface CollectionsResult {
  collections: CollectionData[];
  pagination: PaginationResult;
}

// Repository interfaces
export interface IProjectRepository {
  findAll(options: ProjectQueryOptions): Promise<ProjectListResult>;
  search(options: SearchOptions): Promise<ProjectListResult>;
  findById(id: string): Promise<ProjectData | null>;
  findByIds(ids: string[]): Promise<ProjectSummary[]>;
  incrementStat(id: string, field: 'views' | 'likes' | 'downloads'): Promise<ProjectData | null>;
  create(data: CreateProjectDTO): Promise<ProjectData>;
  update(id: string, data: UpdateProjectDTO): Promise<ProjectData | null>;
  delete(id: string): Promise<boolean>;
}

export interface ICollectionRepository {
  findAll(page: number, limit: number): Promise<CollectionsResult>;
  findById(id: string): Promise<CollectionData | null>;
  findFeatured(): Promise<CollectionData[]>;
  findProjectsByCollectionId(projectIds: string[]): Promise<ProjectData[]>;
}
