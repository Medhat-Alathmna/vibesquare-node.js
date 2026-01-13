import { pgPool } from '../../../config/database';
import { ICollectionRepository, CollectionsResult, ProjectData } from '../interfaces';
import { Collection, CreateCollectionDTO, UpdateCollectionDTO, CollectionProject, OwnerType, CollectionActivity } from '../../../api/collection/collection.types';
import { v4 as uuidv4 } from 'uuid';
import { CollectionQueryOptions } from '../../../shared/types';

export class PostgresCollectionRepository implements ICollectionRepository {
  private mapRowToCollection(row: any): Collection {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      thumbnail: row.thumbnail,
      tags: row.tags || [],
      ownerId: row.owner_id,
      ownerType: row.owner_type,
      visibility: row.visibility,
      featured: row.featured || false,
      clonedFromId: row.cloned_from_id,
      isDeleted: row.is_deleted || false,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
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

  async findAll(options: CollectionQueryOptions): Promise<CollectionsResult> {
    const { page = 1, limit = 12, search, sortBy, visibility = 'public', ownerType, ownerId, isDeleted = false } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    // Visibility Filter - if 'all', don't filter
    if (visibility !== 'all' && visibility) {
      conditions.push(`visibility = $${paramIndex++}`);
      params.push(visibility);
    }

    // Is Deleted
    conditions.push(`is_deleted = $${paramIndex++}`);
    params.push(isDeleted);

    // Owner Type & ID
    if (ownerType) {
      conditions.push(`owner_type = $${paramIndex++}`);
      params.push(ownerType);
    }
    if (ownerId) {
      conditions.push(`owner_id = $${paramIndex++}`);
      params.push(ownerId);
    }

    // Search
    if (search) {
      conditions.push(`search_vector @@ plainto_tsquery('english', $${paramIndex++})`);
      params.push(search);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.map(c => `c.${c}`).join(' AND ')}` : '';

    // Sorting
    let orderBy = 'ORDER BY c.featured DESC, c.created_at DESC'; // default
    if (sortBy === 'recent') orderBy = 'ORDER BY c.created_at DESC';
    if (sortBy === 'popular') orderBy = 'ORDER BY views DESC';
    if (sortBy === 'mostLiked') orderBy = 'ORDER BY c.likes DESC'; // Assuming collections table has likes or join likewise. For now c.likes.

    if (search) {
      const searchParamIndex = params.indexOf(search) + 1;
      orderBy = `ORDER BY ts_rank(c.search_vector, plainto_tsquery('english', $${searchParamIndex})) DESC`;
    }

    const countQuery = `SELECT COUNT(*) FROM collections c ${whereClause}`;
    const dataQuery = `
      SELECT c.*, COALESCE(s.views, 0) as views, COALESCE(s.project_clicks, 0) as project_clicks 
      FROM collections c 
      LEFT JOIN collection_stats s ON c.id = s.collection_id
      ${whereClause} 
      ${orderBy} 
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;

    // Limits
    params.push(limit, offset);

    const [countResult, dataResult] = await Promise.all([
      pgPool.query(countQuery, params.slice(0, params.length - 2)),
      pgPool.query(dataQuery, params)
    ]);

    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    return {
      collections: dataResult.rows.map(row => this.mapRowToCollection(row)),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
        hasMore: page * limit < total
      }
    };
  }

  async findById(id: string): Promise<Collection | null> {
    const result = await pgPool.query(
      'SELECT * FROM collections WHERE id = $1 AND is_deleted = false',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToCollection(result.rows[0]);
  }

  async findFeatured(): Promise<Collection[]> {
    const result = await pgPool.query(
      `SELECT * FROM collections 
       WHERE featured = true AND is_deleted = false AND visibility = 'public'
       ORDER BY created_at DESC LIMIT 6`
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

  // New CRUD methods
  async create(data: CreateCollectionDTO & { ownerId?: string | null, ownerType?: string }): Promise<Collection> {
    const id = uuidv4();
    const {
      title, description, thumbnail, tags = [], visibility = 'public',
      ownerId = null, ownerType = 'system'
    } = data;

    const result = await pgPool.query(
      `INSERT INTO collections (
        id, title, description, thumbnail, tags, 
        owner_id, owner_type, visibility, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *`,
      [id, title, description, thumbnail, tags, ownerId, ownerType, visibility]
    );

    return this.mapRowToCollection(result.rows[0]);
  }

  async update(id: string, data: UpdateCollectionDTO): Promise<Collection | null> {
    const setClause: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    if (data.title) {
      setClause.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.description) {
      setClause.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.thumbnail) {
      setClause.push(`thumbnail = $${paramIndex++}`);
      values.push(data.thumbnail);
    }
    if (data.tags) {
      setClause.push(`tags = $${paramIndex++}`);
      values.push(data.tags);
    }
    if (data.visibility) {
      setClause.push(`visibility = $${paramIndex++}`);
      values.push(data.visibility);
    }
    if (data.featured !== undefined) {
      setClause.push(`featured = $${paramIndex++}`);
      values.push(data.featured);
    }

    if (setClause.length === 0) return this.findById(id);

    setClause.push(`updated_at = NOW()`);

    const result = await pgPool.query(
      `UPDATE collections 
       SET ${setClause.join(', ')} 
       WHERE id = $1 AND is_deleted = false
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    return this.mapRowToCollection(result.rows[0]);
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await pgPool.query(
      `UPDATE collections 
       SET is_deleted = true, deleted_at = NOW(), updated_at = NOW() 
       WHERE id = $1 AND is_deleted = false`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async restore(id: string): Promise<boolean> {
    const result = await pgPool.query(
      `UPDATE collections 
       SET is_deleted = false, deleted_at = NULL, updated_at = NOW() 
       WHERE id = $1 AND is_deleted = true`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // Project management methods
  async addProject(data: CollectionProject): Promise<void> {
    await pgPool.query(
      `INSERT INTO collection_projects (
        id, collection_id, project_id, position, added_at, notes
      ) VALUES ($1, $2, $3, $4, NOW(), $5)
      ON CONFLICT (collection_id, project_id) DO NOTHING`,
      [uuidv4(), data.collectionId, data.projectId, data.position, data.notes]
    );
  }

  async removeProject(collectionId: string, projectId: string): Promise<void> {
    await pgPool.query(
      `DELETE FROM collection_projects 
       WHERE collection_id = $1 AND project_id = $2`,
      [collectionId, projectId]
    );
  }

  async reorderProjects(collectionId: string, projectIds: string[]): Promise<void> {
    // Note: In a real generic implementation, this might need to be more efficient.
    // Here we assume projectIds is the full list in order.
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      // Update positions efficiently? 
      // A simple loop for now as requested by the basic logic
      let position = 1000;
      for (const projectId of projectIds) {
        await client.query(
          `UPDATE collection_projects 
           SET position = $1 
           WHERE collection_id = $2 AND project_id = $3`,
          [position, collectionId, projectId]
        );
        position += 1000; // gap-based
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async findByOwner(ownerId: string, ownerType: string): Promise<Collection[]> {
    const result = await pgPool.query(
      `SELECT * FROM collections 
       WHERE owner_id = $1 AND owner_type = $2 AND is_deleted = false
       ORDER BY created_at DESC`,
      [ownerId, ownerType]
    );

    return result.rows.map(row => this.mapRowToCollection(row));
  }

  async removeProjectFromAllCollections(projectId: string): Promise<void> {
    await pgPool.query(
      'DELETE FROM collection_projects WHERE project_id = $1',
      [projectId]
    );
  }

  async softDeleteAllByOwner(ownerId: string, ownerType: string): Promise<void> {
    await pgPool.query(
      `UPDATE collections 
       SET is_deleted = true, deleted_at = NOW() 
       WHERE owner_id = $1 AND owner_type = $2 AND is_deleted = false`,
      [ownerId, ownerType]
    );
  }

  async incrementStat(collectionId: string, field: 'views' | 'clones' | 'project_clicks'): Promise<void> {
    const allowedFields = ['views', 'clones', 'project_clicks'];
    if (!allowedFields.includes(field)) return;

    await pgPool.query(
      `INSERT INTO collection_stats (collection_id, ${field}, last_viewed_at, updated_at)
       VALUES ($1, 1, NOW(), NOW())
       ON CONFLICT (collection_id) DO UPDATE SET
         ${field} = collection_stats.${field} + 1,
         last_viewed_at = CASE WHEN $2 = 'views' THEN NOW() ELSE collection_stats.last_viewed_at END,
         updated_at = NOW()`,
      [collectionId, field]
    );
  }

  async trackActivity(activity: Partial<CollectionActivity>): Promise<void> {
    const { collectionId, action, actorId, actorType, details } = activity;
    const id = uuidv4();

    await pgPool.query(
      `INSERT INTO collection_activity (
        id, collection_id, action, actor_id, actor_type, details, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, collectionId, action, actorId, actorType, JSON.stringify(details || {})]
    );
  }
}
