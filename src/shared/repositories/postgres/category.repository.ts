import { Knex } from 'knex';
import { getKnex } from '../../../config/knex';
import { ICategoryRepository } from '../interfaces';
import {
  CategoryData,
  CategoriesResult,
  CreateCategoryDTO,
  UpdateCategoryDTO,
  CategoryQueryOptions,
} from '../../types';
import { generateSlug } from '../../utils/slug';

export class PostgresCategoryRepository implements ICategoryRepository {
  private get knex(): Knex {
    return getKnex();
  }

  /**
   * Maps a database row to CategoryData interface
   */
  private mapRowToCategory(row: any): CategoryData {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description || undefined,
      isActive: row.is_active,
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  // ============================================
  // READ OPERATIONS
  // ============================================

  /**
   * Find all categories with pagination and filters
   */
  async findAll(options: CategoryQueryOptions): Promise<CategoriesResult> {
    const { page = 1, limit = 20, isActive, includeDeleted = false } = options;
    const offset = (page - 1) * limit;

    // Build base query
    let query = this.knex('categories');

    // Apply filters
    if (!includeDeleted) {
      query = query.whereNull('deleted_at');
    }

    if (isActive !== undefined) {
      query = query.where({ is_active: isActive });
    }

    // Execute count and data queries in parallel
    const [countResult, categories] = await Promise.all([
      query.clone().count('* as count').first(),
      query
        .clone()
        .select('*')
        .orderBy('name', 'asc')
        .limit(limit)
        .offset(offset),
    ]);

    const total = parseInt(countResult?.count as string || '0', 10);

    return {
      categories: categories.map((row) => this.mapRowToCategory(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  /**
   * Find category by ID
   */
  async findById(id: string): Promise<CategoryData | null> {
    const row = await this.knex('categories')
      .where({ id })
      .whereNull('deleted_at')
      .first();

    if (!row) {
      return null;
    }

    return this.mapRowToCategory(row);
  }

  /**
   * Find category by slug
   */
  async findBySlug(slug: string): Promise<CategoryData | null> {
    const row = await this.knex('categories')
      .where({ slug })
      .whereNull('deleted_at')
      .first();

    if (!row) {
      return null;
    }

    return this.mapRowToCategory(row);
  }

  /**
   * Find multiple categories by IDs
   */
  async findByIds(ids: string[]): Promise<CategoryData[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.knex('categories')
      .whereIn('id', ids)
      .whereNull('deleted_at')
      .orderBy('name', 'asc');

    return rows.map((row) => this.mapRowToCategory(row));
  }

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Create a new category
   */
  async create(data: CreateCategoryDTO): Promise<CategoryData> {
    const slug = generateSlug(data.name);
    const isActive = data.isActive !== undefined ? data.isActive : true;

    const [row] = await this.knex('categories')
      .insert({
        name: data.name,
        slug: slug,
        description: data.description || null,
        is_active: isActive,
        created_at: this.knex.fn.now(),
        updated_at: this.knex.fn.now(),
      })
      .returning('*');

    return this.mapRowToCategory(row);
  }

  /**
   * Update a category
   */
  async update(
    id: string,
    data: UpdateCategoryDTO
  ): Promise<CategoryData | null> {
    const updates: Record<string, any> = {
      updated_at: this.knex.fn.now(),
    };

    // Build dynamic update object
    if (data.name !== undefined) {
      updates.name = data.name;
      updates.slug = generateSlug(data.name);
    }

    if (data.description !== undefined) {
      updates.description = data.description || null;
    }

    if (data.isActive !== undefined) {
      updates.is_active = data.isActive;
    }

    // If no fields to update (only updated_at), return existing
    if (Object.keys(updates).length === 1) {
      return this.findById(id);
    }

    const [row] = await this.knex('categories')
      .where({ id })
      .whereNull('deleted_at')
      .update(updates)
      .returning('*');

    if (!row) {
      return null;
    }

    return this.mapRowToCategory(row);
  }

  /**
   * Soft delete a category
   */
  async softDelete(id: string): Promise<boolean> {
    const count = await this.knex('categories')
      .where({ id })
      .whereNull('deleted_at')
      .update({
        deleted_at: this.knex.fn.now(),
        updated_at: this.knex.fn.now(),
      });

    return count > 0;
  }

  /**
   * Restore a soft-deleted category
   */
  async restore(id: string): Promise<CategoryData | null> {
    const [row] = await this.knex('categories')
      .where({ id })
      .whereNotNull('deleted_at')
      .update({
        deleted_at: null,
        updated_at: this.knex.fn.now(),
      })
      .returning('*');

    if (!row) {
      return null;
    }

    return this.mapRowToCategory(row);
  }

  // ============================================
  // VALIDATION HELPERS
  // ============================================

  /**
   * Check if a category with the given name exists (case-insensitive)
   */
  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    let query = this.knex('categories')
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .whereNull('deleted_at');

    if (excludeId) {
      query = query.whereNot({ id: excludeId });
    }

    const result = await query.count('* as count').first();
    return parseInt(result?.count as string || '0', 10) > 0;
  }

  /**
   * Check if a category with the given slug exists
   */
  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    let query = this.knex('categories')
      .where({ slug })
      .whereNull('deleted_at');

    if (excludeId) {
      query = query.whereNot({ id: excludeId });
    }

    const result = await query.count('* as count').first();
    return parseInt(result?.count as string || '0', 10) > 0;
  }

  // ============================================
  // MANY-TO-MANY: PROJECTS
  // ============================================

  /**
   * Add categories to a project
   */
  async addToProject(projectId: string, categoryIds: string[]): Promise<void> {
    if (categoryIds.length === 0) return;

    const records = categoryIds.map((categoryId) => ({
      project_id: projectId,
      category_id: categoryId,
    }));

    await this.knex('project_categories')
      .insert(records)
      .onConflict(['project_id', 'category_id'])
      .ignore();
  }

  /**
   * Remove categories from a project
   */
  async removeFromProject(
    projectId: string,
    categoryIds: string[]
  ): Promise<void> {
    if (categoryIds.length === 0) return;

    await this.knex('project_categories')
      .where({ project_id: projectId })
      .whereIn('category_id', categoryIds)
      .delete();
  }

  /**
   * Get all categories for a project
   */
  async getProjectCategories(projectId: string): Promise<CategoryData[]> {
    const rows = await this.knex('categories as c')
      .join('project_categories as pc', 'c.id', 'pc.category_id')
      .where({ 'pc.project_id': projectId })
      .whereNull('c.deleted_at')
      .select('c.*')
      .orderBy('c.name', 'asc');

    return rows.map((row) => this.mapRowToCategory(row));
  }

  // ============================================
  // MANY-TO-MANY: COLLECTIONS
  // ============================================

  /**
   * Add categories to a collection
   */
  async addToCollection(
    collectionId: string,
    categoryIds: string[]
  ): Promise<void> {
    if (categoryIds.length === 0) return;

    const records = categoryIds.map((categoryId) => ({
      collection_id: collectionId,
      category_id: categoryId,
    }));

    await this.knex('collection_categories')
      .insert(records)
      .onConflict(['collection_id', 'category_id'])
      .ignore();
  }

  /**
   * Remove categories from a collection
   */
  async removeFromCollection(
    collectionId: string,
    categoryIds: string[]
  ): Promise<void> {
    if (categoryIds.length === 0) return;

    await this.knex('collection_categories')
      .where({ collection_id: collectionId })
      .whereIn('category_id', categoryIds)
      .delete();
  }

  /**
   * Get all categories for a collection
   */
  async getCollectionCategories(
    collectionId: string
  ): Promise<CategoryData[]> {
    const rows = await this.knex('categories as c')
      .join('collection_categories as cc', 'c.id', 'cc.category_id')
      .where({ 'cc.collection_id': collectionId })
      .whereNull('c.deleted_at')
      .select('c.*')
      .orderBy('c.name', 'asc');

    return rows.map((row) => this.mapRowToCategory(row));
  }
}
