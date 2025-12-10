import { pgPool } from '../../../config/database';
import { ICollectionRepository, CollectionData, CollectionsResult, ProjectData } from '../interfaces';

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
      collectionIds: row.collection_ids || [],
      codeFiles: row.code_files || []
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
              demo_url, download_url, prompt, framework, tags, styles, category,
              likes, views, downloads, collection_ids, created_at, updated_at
       FROM projects WHERE id = ANY($1)`,
      [projectIds]
    );

    return result.rows.map(row => this.mapRowToProject(row));
  }
}
