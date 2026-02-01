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
  categoryIds?: string[]; // NEW: Array of category IDs (at least 1 required in validation)
  featured?: boolean;
}

// Collection update data (all fields optional)
export interface UpdateCollectionData {
  title?: string;
  description?: string;
  thumbnail?: string;
  projectIds?: string[];
  categoryIds?: string[]; // NEW: Update collection categories
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
  findAll(page: number, limit: number, categoryIds?: string[]): Promise<CollectionsResult>;
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

// ============================================
// PRD Repository Interface (Technical Pipeline)
// ============================================

export type PRDPipelineType = 'visual' | 'technical' | 'both';
export type PRDDetailLevel = 'basic' | 'detailed' | 'comprehensive';

export interface PRDData {
  id: string;
  userId?: string;
  sourceUrl: string;
  pipelineType: PRDPipelineType;
  detailLevel: PRDDetailLevel;

  // Analysis data
  visualAnalysis?: Record<string, any>;
  databaseSchema?: string;
  backendArchitecture?: string;
  securityRecommendations?: string;
  testingStrategy?: string;
  devopsConfig?: string;

  // Validation
  validationResult?: string;
  validationScore?: number;
  qaReview?: string;
  qaIterations: number;
  qaApproved: boolean;

  // Final output
  prdMarkdown: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface PRDSummary {
  id: string;
  sourceUrl: string;
  pipelineType: PRDPipelineType;
  detailLevel: PRDDetailLevel;
  validationScore?: number;
  qaApproved: boolean;
  createdAt: Date;
}

export interface PRDListResult {
  prds: PRDSummary[];
  pagination: PaginationResult;
}

export interface CreatePRDDTO {
  userId?: string;
  sourceUrl: string;
  pipelineType: PRDPipelineType;
  detailLevel: PRDDetailLevel;
  visualAnalysis?: Record<string, any>;
  databaseSchema?: string;
  backendArchitecture?: string;
  securityRecommendations?: string;
  testingStrategy?: string;
  devopsConfig?: string;
  validationResult?: string;
  validationScore?: number;
  qaReview?: string;
  qaIterations?: number;
  qaApproved?: boolean;
  prdMarkdown: string;
}

export interface UpdatePRDDTO {
  visualAnalysis?: Record<string, any>;
  databaseSchema?: string;
  backendArchitecture?: string;
  securityRecommendations?: string;
  testingStrategy?: string;
  devopsConfig?: string;
  validationResult?: string;
  validationScore?: number;
  qaReview?: string;
  qaIterations?: number;
  qaApproved?: boolean;
  prdMarkdown?: string;
}

export interface IPRDRepository {
  // Read operations
  findById(id: string): Promise<PRDData | null>;
  findByUserId(userId: string, page?: number, limit?: number): Promise<PRDListResult>;
  findByUrl(url: string): Promise<PRDData[]>;
  findBySourceUrl(sourceUrl: string): Promise<PRDData | null>;

  // CRUD operations
  create(data: CreatePRDDTO): Promise<PRDData>;
  update(id: string, data: UpdatePRDDTO): Promise<PRDData | null>;
  delete(id: string): Promise<boolean>;

  // Helper methods
  getMarkdown(id: string): Promise<string | null>;
}

// ============================================
// Visual Pipeline Cache Repository Interface
// ============================================

/**
 * Visual Pipeline Cache Data Structure
 *
 * Stores cached results from the Visual Pipeline (V2) to avoid
 * redundant processing of the same URL.
 *
 * Cache Strategy:
 * - Global cache (shared across all users)
 * - 7-day TTL by default
 * - URL normalization for deduplication
 */
export interface VisualPipelineCacheData {
  id: string;
  normalizedUrl: string;
  originalUrl: string;
  finalPrompt: string;
  userQuestions?: any[]; // UserQuestion[] from agent.types.ts
  metadata: any; // PipelineMetadata from agent.types.ts
  layoutAnalysis?: any; // LayoutAnalysisOutput from agent.types.ts
  componentIdentification?: any; // ComponentIdentificationOutput from agent.types.ts
  designSystem?: any; // DesignSystemOutput from agent.types.ts
  cachedAt: Date;
  expiresAt: Date;
  hitCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO for creating a new visual pipeline cache entry
 */
export interface CreateVisualPipelineCacheDTO {
  normalizedUrl: string;
  originalUrl: string;
  finalPrompt: string;
  userQuestions?: any[];
  metadata: any;
  layoutAnalysis?: any;
  componentIdentification?: any;
  designSystem?: any;
  ttlDays?: number; // Default: 7
}

/**
 * Repository interface for Visual Pipeline Cache operations
 */
export interface IVisualPipelineCacheRepository {
  /**
   * Find a cached entry by normalized URL
   * Returns null if not found or if expired
   */
  findByUrl(normalizedUrl: string): Promise<VisualPipelineCacheData | null>;

  /**
   * Create a new cache entry
   * Automatically calculates expiresAt based on ttlDays
   */
  create(data: CreateVisualPipelineCacheDTO): Promise<VisualPipelineCacheData>;

  /**
   * Increment the hit count for a cache entry
   * Called when cached data is used
   */
  incrementHitCount(id: string): Promise<void>;

  /**
   * Delete all expired cache entries
   * Returns the count of deleted entries
   * Used by background cleanup job
   */
  deleteExpired(): Promise<number>;

  /**
   * Delete a specific cache entry by ID
   */
  delete(id: string): Promise<boolean>;

  /**
   * Check if a cache entry is expired
   */
  isExpired(cachedAt: Date, ttlDays: number): boolean;
}
