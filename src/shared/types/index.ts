// Framework types
export const FRAMEWORKS = ['Angular', 'React', 'Vue', 'Svelte', 'Next.js', 'Nuxt.js', 'Vanilla'] as const;
export type Framework = typeof FRAMEWORKS[number];

// Category types
export const CATEGORIES = ['Dashboard', 'Landing Page', 'E-commerce', 'Portfolio', 'Blog', 'Admin Panel', 'SaaS', 'Other'] as const;
export type Category = typeof CATEGORIES[number];

// Sort options
export const SORT_OPTIONS = ['recent', 'popular', 'mostLiked', 'mostDownloaded'] as const;
export type SortOption = typeof SORT_OPTIONS[number];

// LLM types
export const LLM_TYPES = ['gpt-5', 'opus-4.5', 'gemini-3'] as const;
export type LlmType = typeof LLM_TYPES[number];

// Prompt interface
export interface Prompt {
  text: string;
  model: string;
  version?: string;
  parameters?: Record<string, any>;
}

// CodeFile interface
export interface CodeFile {
  filename: string;
  language: string;
  content: string;
  path?: string;
}

// Pagination interface
export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

// Query options
export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: SortOption;
}

export interface ProjectQueryOptions extends QueryOptions {
  framework?: Framework;
  category?: Category; // Legacy: Keep for backward compatibility
  categoryIds?: string[]; // NEW: Filter by multiple category IDs
}

export interface SearchOptions extends ProjectQueryOptions {
  query?: string;
  frameworks?: Framework[];
  categories?: Category[]; // Legacy
  categoryIds?: string[]; // NEW: Filter by multiple category IDs
}

// Builder Social Links interface
export interface BuilderSocialLinks {
  github?: string;
  twitter?: string;
  linkedin?: string;
  portfolio?: string;
}

// Builder interface
export interface Builder {
  userId?: string;
  name: string;
  avatarUrl?: string;
}

// Create Project DTO
export interface CreateProjectDTO {
  title: string;
  description: string;
  shortDescription: string;
  thumbnail: string;
  screenshots?: string[];
  demoUrl?: string;
  downloadUrl?: string;
  sourceCodeFile?: string;
  prompt: Prompt;
  framework: Framework;
  styles?: string[];
  category: Category; // Legacy: Keep for backward compatibility
  categoryIds?: string[]; // NEW: Array of category IDs (at least 1 required in validation)
  builder?: Builder;
  builderSocialLinks?: BuilderSocialLinks;
}

// Update Project DTO
export interface UpdateProjectDTO {
  title?: string;
  description?: string;
  shortDescription?: string;
  thumbnail?: string;
  screenshots?: string[];
  demoUrl?: string;
  downloadUrl?: string;
  sourceCodeFile?: string;
  prompt?: Prompt;
  framework?: Framework;
  styles?: string[];
  category?: Category; // Legacy
  categoryIds?: string[]; // NEW: Update project categories
  builder?: Builder;
  builderSocialLinks?: BuilderSocialLinks;
}

// ============================================
// Category System Types (New)
// ============================================

// Category Data Interface
export interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Create Category DTO
export interface CreateCategoryDTO {
  name: string;
  description?: string;
  isActive?: boolean;
}

// Update Category DTO
export interface UpdateCategoryDTO {
  name?: string;
  description?: string;
  isActive?: boolean;
}

// Categories Result (with pagination)
export interface CategoriesResult {
  categories: CategoryData[];
  pagination: PaginationResult;
}

// Category Query Options
export interface CategoryQueryOptions extends QueryOptions {
  isActive?: boolean;
  includeDeleted?: boolean;
  includeUsageStats?: boolean;
}
