import { pgPool } from '../../../config/database';
import { ICollectionRepository, CollectionData, CollectionsResult, ProjectData, CreateCollectionData, UpdateCollectionData } from '../interfaces';
import { v4 as uuidv4 } from 'uuid';

export class PostgresCollectionRepository implements ICollectionRepository {
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

  async findAll(page: number = 1, limit: number = 12): Promise<CollectionsResult> {
    const offset = (page - 1) * limit;

    const [countResult, dataResult] = await Promise.all([
      pgPool.query('SELECT COUNT(*) FROM collections'),
      pgPool.query(
        `SELECT * FROM collections ORDER BY featured DESC, created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      )
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      collections: dataResult.rows.map(row => this.mapRowToCollection(row)),
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
    const result = await pgPool.query(
      'SELECT * FROM collections WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToCollection(result.rows[0]);
  }

  async findFeatured(): Promise<CollectionData[]> {
    const result = await pgPool.query(
      'SELECT * FROM collections WHERE featured = true ORDER BY created_at DESC LIMIT 6'
    );

    return result.rows.map(row => this.mapRowToCollection(row));
  }

  async findProjectsByCollectionId(projectIds: string[]): Promise<ProjectData[]> {
    if (projectIds.length === 0) {
      return [];
    }

    const result = await pgPool.query(
      `SELECT id, title, description, short_description, thumbnail, screenshots,
              demo_url, download_url, source_code_file, prompt, framework, tags, styles, category,
              likes, views, downloads, collection_ids, created_at, updated_at
       FROM projects WHERE id = ANY($1)`,
      [projectIds]
    );

    return result.rows.map(row => this.mapRowToProject(row));
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
    let query = 'SELECT COUNT(*) FROM collections WHERE LOWER(title) = LOWER($1)';
    const params: any[] = [title];

    // استثناء collection معين عند التحديث
    if (excludeId) {
      query += ' AND id != $2';
      params.push(excludeId);
    }

    const result = await pgPool.query(query, params);
    const count = parseInt(result.rows[0].count, 10);

    return count > 0;
  }

  /**
   * إنشاء collection جديد
   */
  async create(data: CreateCollectionData): Promise<CollectionData> {
    const id = `coll-${uuidv4()}`;

    const result = await pgPool.query(
      `INSERT INTO collections (
        id, title, description, thumbnail, project_ids, tags, featured, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *`,
      [
        id,
        data.title,
        data.description,
        data.thumbnail,
        JSON.stringify(data.projectIds || []),
        JSON.stringify(data.tags || []),
        data.featured || false
      ]
    );

    return this.mapRowToCollection(result.rows[0]);
  }

  /**
   * تحديث collection موجود
   */
  async update(id: string, data: UpdateCollectionData): Promise<CollectionData | null> {
    // بناء الـ query ديناميكياً (فقط الحقول الموجودة)
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }

    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }

    if (data.thumbnail !== undefined) {
      fields.push(`thumbnail = $${paramIndex++}`);
      values.push(data.thumbnail);
    }

    if (data.projectIds !== undefined) {
      fields.push(`project_ids = $${paramIndex++}`);
      values.push(JSON.stringify(data.projectIds));
    }

    if (data.tags !== undefined) {
      fields.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(data.tags));
    }

    if (data.featured !== undefined) {
      fields.push(`featured = $${paramIndex++}`);
      values.push(data.featured);
    }

    // إذا لم يتم إرسال أي حقل للتحديث
    if (fields.length === 0) {
      return this.findById(id);
    }

    // إضافة ID في النهاية
    values.push(id);

    const query = `
      UPDATE collections 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await pgPool.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToCollection(result.rows[0]);
  }

  /**
   * حذف collection
   */
  async delete(id: string): Promise<boolean> {
    const result = await pgPool.query(
      'DELETE FROM collections WHERE id = $1',
      [id]
    );

    // rowCount يحتوي على عدد الصفوف المحذوفة
    return (result.rowCount || 0) > 0;
  }
}
