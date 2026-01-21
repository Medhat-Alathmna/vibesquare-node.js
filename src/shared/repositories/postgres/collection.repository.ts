import { getKnex } from '../../../config/knex';
import { ICollectionRepository, CollectionData, CollectionsResult, ProjectData, CreateCollectionData, UpdateCollectionData } from '../interfaces';
import { v4 as uuidv4 } from 'uuid';
import { getCategoryRepository } from '../index';

export class PostgresCollectionRepository implements ICollectionRepository {
  private get db() {
    return getKnex();
  }

  private mapRowToCollection(row: any): CollectionData {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      thumbnail: row.thumbnail,
      projectIds: row.project_ids || [],
      tags: row.tags || [],
      createdAt: row.created_at,
      featured: row.featured || false
    };
  }

  private mapRowToProject(row: any): ProjectData {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      shortDescription: row.short_description,
      thumbnail: row.thumbnail,
      screenshots: row.screenshots || [],
      demoUrl: row.demo_url,
      downloadUrl: row.download_url,
      sourceCodeFile: row.source_code_file,
      prompt: row.prompt || {},
      framework: row.framework,
      tags: row.tags || [],
      styles: row.styles || [],
      category: row.category,
      likes: row.likes || 0,
      views: row.views || 0,
      downloads: row.downloads || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      collectionIds: row.collection_ids || []
    };
  }

  async findAll(page: number = 1, limit: number = 12, categoryIds?: string[]): Promise<CollectionsResult> {
    const offset = (page - 1) * limit;

    let query = this.db('collections');
    let countQuery = this.db('collections');

    // NEW: Filter by categoryIds (many-to-many relationship)
    if (categoryIds && categoryIds.length > 0) {
      query = query
        .join('collection_categories', 'collections.id', 'collection_categories.collection_id')
        .whereIn('collection_categories.category_id', categoryIds)
        .groupBy('collections.id');

      countQuery = countQuery
        .join('collection_categories', 'collections.id', 'collection_categories.collection_id')
        .whereIn('collection_categories.category_id', categoryIds)
        .groupBy('collections.id');
    }

    const [countResult, collections] = await Promise.all([
      countQuery.count('collections.id as count').first(),
      query
        .select('collections.*')
        .orderBy([
          { column: 'collections.featured', order: 'desc' },
          { column: 'collections.created_at', order: 'desc' }
        ])
        .limit(limit)
        .offset(offset)
    ]);

    const total = parseInt(String(countResult?.count || 0), 10);

    return {
      collections: collections.map((row: any) => this.mapRowToCollection(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }

  async findById(id: string): Promise<CollectionData | null> {
    const collection = await this.db('collections')
      .where({ id })
      .first();

    if (!collection) {
      return null;
    }

    // NEW: Fetch and include categories
    const categoryRepo = getCategoryRepository();
    const categories = await categoryRepo.getCollectionCategories(id);

    return {
      ...this.mapRowToCollection(collection),
      categories
    };
  }

  async findFeatured(): Promise<CollectionData[]> {
    const collections = await this.db('collections')
      .where({ featured: true })
      .orderBy('created_at', 'desc')
      .limit(6);

    return collections.map((row: any) => this.mapRowToCollection(row));
  }

  async findProjectsByCollectionId(projectIds: string[]): Promise<ProjectData[]> {
    if (projectIds.length === 0) {
      return [];
    }

    const projects = await this.db('projects')
      .select(
        'id', 'title', 'description', 'short_description', 'thumbnail', 'screenshots',
        'demo_url', 'download_url', 'source_code_file', 'prompt', 'framework', 'tags',
        'styles', 'category', 'likes', 'views', 'downloads', 'collection_ids',
        'created_at', 'updated_at'
      )
      .whereIn('id', projectIds);

    return projects.map((row: any) => this.mapRowToProject(row));
  }

  // ============================================
  // CRUD Operations for Admin
  // ============================================

  /**
   * التحقق من وجود collection بنفس العنوان
   * @param title - العنوان المطلوب التحقق منه
   * @param excludeId - ID collection نريد استثناءه (مفيد للتحديث)
   */
  async existsByTitle(title: string, excludeId?: string): Promise<boolean> {
    let query = this.db('collections')
      .whereRaw('LOWER(title) = LOWER(?)', [title])
      .count('* as count')
      .first();

    // استثناء collection معين عند التحديث
    if (excludeId) {
      query = query.whereNot('id', excludeId);
    }

    const result = await query;
    const count = parseInt(String(result?.count || 0), 10);

    return count > 0;
  }

  /**
   * إنشاء collection جديد
   */
  async create(data: CreateCollectionData): Promise<CollectionData> {
    const id = `coll-${uuidv4()}`;

    const [collection] = await this.db('collections')
      .insert({
        id,
        title: data.title,
        description: data.description,
        thumbnail: data.thumbnail,
        project_ids: JSON.stringify(data.projectIds || []),
        tags: JSON.stringify(data.tags || []),
        featured: data.featured || false,
        created_at: this.db.fn.now()
      })
      .returning('*');

    return this.mapRowToCollection(collection);
  }

  /**
   * تحديث collection موجود
   */
  async update(id: string, data: UpdateCollectionData): Promise<CollectionData | null> {
    // بناء الـ update object ديناميكياً (فقط الحقول الموجودة)
    const updateData: any = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.thumbnail !== undefined) {
      updateData.thumbnail = data.thumbnail;
    }

    if (data.projectIds !== undefined) {
      updateData.project_ids = JSON.stringify(data.projectIds);
    }

    if (data.tags !== undefined) {
      updateData.tags = JSON.stringify(data.tags);
    }

    if (data.featured !== undefined) {
      updateData.featured = data.featured;
    }

    // إذا لم يتم إرسال أي حقل للتحديث
    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    // إضافة updated_at
    updateData.updated_at = this.db.fn.now();

    const [collection] = await this.db('collections')
      .where({ id })
      .update(updateData)
      .returning('*');

    if (!collection) {
      return null;
    }

    return this.mapRowToCollection(collection);
  }

  /**
   * حذف collection
   */
  async delete(id: string): Promise<boolean> {
    const deletedCount = await this.db('collections')
      .where({ id })
      .delete();

    // deletedCount يحتوي على عدد الصفوف المحذوفة
    return deletedCount > 0;
  }
}
