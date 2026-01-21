import {
  ProjectQueryOptions,
  SearchOptions,
  PaginationResult,
  SortOption,
  CreateProjectDTO,
  UpdateProjectDTO,
  Builder,
  BuilderSocialLinks,
  CategoryData,
  CreateCategoryDTO,
  UpdateCategoryDTO,
  CategoriesResult,
  CategoryQueryOptions
} from '../types';

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
  category: string; // Legacy: Keep for backward compatibility
  categories?: CategoryData[]; // NEW: Array of category objects
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
  categories?: CategoryData[]; // NEW: Array of category objects
  createdAt: Date;
  featured: boolean;
}

export interface CollectionsResult {
  collections: CollectionData[];
  pagination: PaginationResult;
}

// Collection creation data
export interface CreateCollectionData {
  title: string;
  description: string;
  thumbnail: string;
  projectIds?: string[];
  tags?: string[];
  featured?: boolean;
}

// Collection update data (all fields optional)
export interface UpdateCollectionData {
  title?: string;
  description?: string;
  thumbnail?: string;
  projectIds?: string[];
  tags?: string[];
  featured?: boolean;
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
  findAll(page: number, limit: number): Promise<CollectionsResult>;
  findById(id: string): Promise<CollectionData | null>;
  findFeatured(): Promise<CollectionData[]>;
  findProjectsByCollectionId(projectIds: string[]): Promise<ProjectData[]>;

  // CRUD operations for admin
  create(data: CreateCollectionData): Promise<CollectionData>;
  update(id: string, data: UpdateCollectionData): Promise<CollectionData | null>;
  delete(id: string): Promise<boolean>;

  // Helper methods
  existsByTitle(title: string, excludeId?: string): Promise<boolean>;
}

// ============================================
// Category Repository Interface (New)
// ============================================

export interface ICategoryRepository {
  // Read operations
  findAll(options: CategoryQueryOptions): Promise<CategoriesResult>;
  findById(id: string): Promise<CategoryData | null>;
  findBySlug(slug: string): Promise<CategoryData | null>;
  findByIds(ids: string[]): Promise<CategoryData[]>;

  // CRUD operations
  create(data: CreateCategoryDTO): Promise<CategoryData>;
  update(id: string, data: UpdateCategoryDTO): Promise<CategoryData | null>;
  softDelete(id: string): Promise<boolean>;
  restore(id: string): Promise<CategoryData | null>;

  // Validation helpers
  existsByName(name: string, excludeId?: string): Promise<boolean>;
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>;
  isCategoryInUse(id: string): Promise<boolean>;

  // Many-to-many relationships for Projects
  addToProject(projectId: string, categoryIds: string[]): Promise<void>;
  removeFromProject(projectId: string, categoryIds: string[]): Promise<void>;
  getProjectCategories(projectId: string): Promise<CategoryData[]>;

  // Many-to-many relationships for Collections
  addToCollection(collectionId: string, categoryIds: string[]): Promise<void>;
  removeFromCollection(collectionId: string, categoryIds: string[]): Promise<void>;
  getCollectionCategories(collectionId: string): Promise<CategoryData[]>;
}
