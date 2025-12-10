import { pgPool } from '../../../config/database';
import { IProjectRepository, ProjectData, ProjectsResult } from '../interfaces';
import { ProjectQueryOptions, SearchOptions, SortOption } from '../../types';

export class PostgresProjectRepository implements IProjectRepository {
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

  private getSortColumn(sortBy: SortOption): string {
    switch (sortBy) {
      case 'popular': return 'views DESC';
      case 'mostLiked': return 'likes DESC';
      case 'mostDownloaded': return 'downloads DESC';
      case 'recent':
      default: return 'created_at DESC';
    }
  }

  async findAll(options: ProjectQueryOptions): Promise<ProjectsResult> {
    const { page = 1, limit = 12, framework, category, tags, sortBy = 'recent' } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (framework) {
      conditions.push(`framework = $${paramIndex++}`);
      params.push(framework);
    }
    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }
    if (tags && tags.length > 0) {
      conditions.push(`tags ?| $${paramIndex++}`);
      params.push(tags);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = this.getSortColumn(sortBy);

    const countQuery = `SELECT COUNT(*) FROM projects ${whereClause}`;
    const dataQuery = `
      SELECT id, title, description, short_description, thumbnail, screenshots,
             demo_url, download_url, prompt, framework, tags, styles, category,
             likes, views, downloads, collection_ids, created_at, updated_at
      FROM projects
      ${whereClause}
      ORDER BY ${sortColumn}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    const [countResult, dataResult] = await Promise.all([
      pgPool.query(countQuery, params),
      pgPool.query(dataQuery, [...params, limit, offset])
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      projects: dataResult.rows.map(row => this.mapRowToProject(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }

  async search(options: SearchOptions): Promise<ProjectsResult> {
    const { query, frameworks, categories, tags, sortBy = 'recent', page = 1, limit = 12 } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query) {
      conditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${query}%`);
      paramIndex++;
    }
    if (frameworks && frameworks.length > 0) {
      conditions.push(`framework = ANY($${paramIndex++})`);
      params.push(frameworks);
    }
    if (categories && categories.length > 0) {
      conditions.push(`category = ANY($${paramIndex++})`);
      params.push(categories);
    }
    if (tags && tags.length > 0) {
      conditions.push(`tags ?| $${paramIndex++}`);
      params.push(tags);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sortColumn = this.getSortColumn(sortBy);

    const countQuery = `SELECT COUNT(*) FROM projects ${whereClause}`;
    const dataQuery = `
      SELECT id, title, description, short_description, thumbnail, screenshots,
             demo_url, download_url, prompt, framework, tags, styles, category,
             likes, views, downloads, collection_ids, created_at, updated_at
      FROM projects
      ${whereClause}
      ORDER BY ${sortColumn}
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;

    const [countResult, dataResult] = await Promise.all([
      pgPool.query(countQuery, params),
      pgPool.query(dataQuery, [...params, limit, offset])
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    return {
      projects: dataResult.rows.map(row => this.mapRowToProject(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }

  async findById(id: string): Promise<ProjectData | null> {
    const result = await pgPool.query(
      `SELECT * FROM projects WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToProject(result.rows[0]);
  }

  async incrementStat(id: string, field: 'views' | 'likes' | 'downloads'): Promise<ProjectData | null> {
    const result = await pgPool.query(
      `UPDATE projects SET ${field} = ${field} + 1, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToProject(result.rows[0]);
  }
}
