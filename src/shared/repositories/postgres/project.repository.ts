import { v4 as uuidv4 } from 'uuid';
import { pgPool } from '../../../config/database';
import { IProjectRepository, ProjectData, ProjectListResult, ProjectSummary } from '../interfaces';
import { ProjectQueryOptions, SearchOptions, SortOption, CreateProjectDTO, UpdateProjectDTO } from '../../types';

export class PostgresProjectRepository implements IProjectRepository {
  // Map row to summary (for list views)
  private mapRowToSummary(row: any): ProjectSummary {
    return {
      id: row.id,
      title: row.title,
      shortDescription: row.short_description,
      thumbnail: row.thumbnail,
      framework: row.framework,
      category: row.category,
      tags: row.tags || [],
      likes: row.likes || 0,
      views: row.views || 0,
      downloads: row.downloads || 0,
      createdAt: row.created_at,
      builder: row.builder ? {
        name: row.builder.name,
        avatarUrl: row.builder.avatarUrl
      } : undefined
    };
  }

  // Map row to full project (for detail view)
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
      collectionIds: row.collection_ids || [],
      builder: row.builder,
      builderSocialLinks: row.builder_social_links
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

  async findAll(options: ProjectQueryOptions): Promise<ProjectListResult> {
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
    // Only select fields needed for list view
    const dataQuery = `
      SELECT id, title, short_description, thumbnail, framework, category,
             tags, likes, views, downloads, created_at, builder
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
      projects: dataResult.rows.map(row => this.mapRowToSummary(row)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total
      }
    };
  }

  async search(options: SearchOptions): Promise<ProjectListResult> {
    const { query, frameworks, categories, tags, sortBy = 'recent', page = 1, limit = 12 } = options;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (query) {
      conditions.push(`(title ILIKE $${paramIndex} OR short_description ILIKE $${paramIndex})`);
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
    // Only select fields needed for list view
    const dataQuery = `
      SELECT id, title, short_description, thumbnail, framework, category,
             tags, likes, views, downloads, created_at, builder
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
      projects: dataResult.rows.map(row => this.mapRowToSummary(row)),
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

  async findByIds(ids: string[]): Promise<ProjectSummary[]> {
    if (ids.length === 0) return [];

    const result = await pgPool.query(
      `SELECT id, title, short_description, thumbnail, framework, category,
              tags, likes, views, downloads, created_at, builder
       FROM projects
       WHERE id = ANY($1)`,
      [ids]
    );

    return result.rows.map(row => this.mapRowToSummary(row));
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

  async decrementStat(id: string, field: 'views' | 'likes' | 'downloads'): Promise<ProjectData | null> {
    const result = await pgPool.query(
      `UPDATE projects SET ${field} = GREATEST(${field} - 1, 0), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToProject(result.rows[0]);
  }

  async create(data: CreateProjectDTO): Promise<ProjectData> {
    const id = uuidv4();
    const result = await pgPool.query(
      `INSERT INTO projects (
        id, title, description, short_description, thumbnail, screenshots,
        demo_url, download_url, source_code_file, prompt, framework, tags, styles, category,
        builder, builder_social_links, likes, views, downloads,
        collection_ids, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        0, 0, 0, '{}', NOW(), NOW()
      ) RETURNING *`,
      [
        id,
        data.title,
        data.description,
        data.shortDescription,
        data.thumbnail,
        JSON.stringify(data.screenshots || []),
        data.demoUrl || null,
        data.downloadUrl || null,
        data.sourceCodeFile || null,
        JSON.stringify(data.prompt),
        data.framework,
        JSON.stringify(data.tags || []),
        JSON.stringify(data.styles || []),
        data.category,
        data.builder ? JSON.stringify(data.builder) : null,
        data.builderSocialLinks ? JSON.stringify(data.builderSocialLinks) : null
      ]
    );

    return this.mapRowToProject(result.rows[0]);
  }

  async update(id: string, data: UpdateProjectDTO): Promise<ProjectData | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.shortDescription !== undefined) {
      updates.push(`short_description = $${paramIndex++}`);
      values.push(data.shortDescription);
    }
    if (data.thumbnail !== undefined) {
      updates.push(`thumbnail = $${paramIndex++}`);
      values.push(data.thumbnail);
    }
    if (data.screenshots !== undefined) {
      updates.push(`screenshots = $${paramIndex++}`);
      values.push(JSON.stringify(data.screenshots));
    }
    if (data.demoUrl !== undefined) {
      updates.push(`demo_url = $${paramIndex++}`);
      values.push(data.demoUrl);
    }
    if (data.downloadUrl !== undefined) {
      updates.push(`download_url = $${paramIndex++}`);
      values.push(data.downloadUrl);
    }
    if (data.prompt !== undefined) {
      updates.push(`prompt = $${paramIndex++}`);
      values.push(JSON.stringify(data.prompt));
    }
    if (data.framework !== undefined) {
      updates.push(`framework = $${paramIndex++}`);
      values.push(data.framework);
    }
    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(data.tags));
    }
    if (data.styles !== undefined) {
      updates.push(`styles = $${paramIndex++}`);
      values.push(JSON.stringify(data.styles));
    }
    if (data.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(data.category);
    }
    if (data.sourceCodeFile !== undefined) {
      updates.push(`source_code_file = $${paramIndex++}`);
      values.push(data.sourceCodeFile);
    }
    if (data.builder !== undefined) {
      updates.push(`builder = $${paramIndex++}`);
      values.push(JSON.stringify(data.builder));
    }
    if (data.builderSocialLinks !== undefined) {
      updates.push(`builder_social_links = $${paramIndex++}`);
      values.push(JSON.stringify(data.builderSocialLinks));
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    const result = await pgPool.query(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToProject(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await pgPool.query(
      `DELETE FROM projects WHERE id = $1`,
      [id]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }
}
