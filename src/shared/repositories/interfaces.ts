import { ProjectQueryOptions, SearchOptions, PaginationResult, SortOption, CreateProjectDTO, UpdateProjectDTO, Builder, BuilderSocialLinks } from '../types';

// Project types
export interface ProjectData {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  thumbnail: string;
  screenshots: string[];
  demoUrl?: string;
  downloadUrl?: string;
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
  codeFiles: Array<{
    filename: string;
    language: string;
    content: string;
    path?: string;
  }>;
  builder?: Builder;
  builderSocialLinks?: BuilderSocialLinks;
}

export interface ProjectsResult {
  projects: ProjectData[];
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
  findAll(options: ProjectQueryOptions): Promise<ProjectsResult>;
  search(options: SearchOptions): Promise<ProjectsResult>;
  findById(id: string): Promise<ProjectData | null>;
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
