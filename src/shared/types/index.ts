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
  category?: Category;
  tags?: string[];
}

export interface SearchOptions extends ProjectQueryOptions {
  query?: string;
  frameworks?: Framework[];
  categories?: Category[];
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
  tags?: string[];
  styles?: string[];
  category: Category;
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
  tags?: string[];
  styles?: string[];
  category?: Category;
  builder?: Builder;
  builderSocialLinks?: BuilderSocialLinks;
}
